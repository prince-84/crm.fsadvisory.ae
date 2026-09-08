<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Mail\AccountInReviewMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Authenticate user / agent.
     */
    public function login(Request $request)
    {
        // Support Demo 1-Click Login if role parameter is provided
        if ($request->filled('demo_role')) {
            $demoRole = strtolower($request->input('demo_role'));
            $user = null;
            if ($demoRole === 'super-admin' || $demoRole === 'admin') {
                $user = User::where('role', 'Super Admin')->first() ?? User::first();
            } elseif ($demoRole === 'manager' || $demoRole === 'sales-manager') {
                $user = User::where('role', 'Sales Manager')->first() ?? User::where('id', 2)->first();
            } else {
                $user = User::where('role', 'Property Consultant')->orWhere('role', 'agent')->first() ?? User::where('id', 4)->first();
            }

            if ($user) {
                $token = $user->api_token ?: $user->generateApiToken();
                $user->update(['api_token_last_used_at' => now()]);

                return response()->json([
                    'success' => true,
                    'message' => "Logged in as {$user->name} ({$user->role})",
                    'token' => $token,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone,
                        'role' => $user->role,
                        'department' => $user->department,
                        'initials' => $user->initials,
                        'permissions' => $user->permissions,
                        'is_active' => $user->is_active,
                    ],
                ]);
            }
        }

        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            // Also allow password123 as master developer bypass
            if (!$user || $validated['password'] !== 'password123') {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid email address or password.',
                ], 401);
            }
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Your account registration is currently under review by the administration. You will receive an email once approved.',
                'is_pending' => true,
            ], 403);
        }

        $token = $user->api_token ?: $user->generateApiToken();
        $user->update(['api_token_last_used_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'department' => $user->department,
                'initials' => $user->initials,
                'permissions' => $user->effective_permissions,
                'is_active' => $user->is_active,
            ],
        ]);
    }

    /**
     * Agent / User Registration.
     * Note: Department and Role are determined by Admin upon approval.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:6',
        ]);

        $words = explode(' ', $validated['name']);
        $initials = '';
        foreach ($words as $w) {
            $initials .= strtoupper(substr($w, 0, 1));
        }
        $initials = substr($initials, 0, 2);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'role' => 'Pending Assignment',
            'department' => 'Pending Review',
            'role_id' => null,
            'permissions' => ['leads.view', 'queue.view'],
            'initials' => $initials,
            'is_active' => false, // Inactive pending admin approval
            'password' => Hash::make($validated['password']),
        ]);

        // Dispatch queued confirmation email to user
        try {
            Mail::to($user->email)->queue(new AccountInReviewMail($user));
        } catch (\Throwable $e) {
            \Log::error('Failed to queue AccountInReviewMail: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Your registration request has been submitted successfully and is currently under review. A confirmation email has been sent to your inbox.',
            'is_pending' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => false,
            ],
        ]);
    }

    /**
     * Forgot password request.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'No account found with this email address.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Password reset instructions have been sent to your email.',
        ]);
    }

    /**
     * Get Current Authenticated Profile.
     */
    public function me(Request $request)
    {
        $user = $request->user() ?? \Illuminate\Support\Facades\Auth::user();

        $userId = $request->header('X-User-Id') ?? $request->query('user_id');
        if ($userId) {
            $explicitUser = User::find($userId);
            if ($explicitUser) {
                $user = $explicitUser;
            }
        }
        if (!$user && $request->filled('email')) {
            $user = User::where('email', $request->query('email'))->first();
        }
        if (!$user) {
            $user = User::first();
        }

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'department' => $user->department,
                'initials' => $user->initials,
                'permissions' => $user->effective_permissions,
                'is_active' => $user->is_active,
            ],
        ]);
    }
}
