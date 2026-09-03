<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Mail\AccountActivatedMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('roleModel');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('role', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }

        if ($request->filled('department')) {
            $query->where('department', $request->input('department'));
        }

        if ($request->has('is_active') && $request->input('is_active') !== 'all') {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $users = $query->orderBy('name', 'asc')->get();

        // Calculate KPI Stats
        $totalUsers = User::count();
        $activeUsers = User::where('is_active', true)->count();
        $rolesCount = Role::count();
        $departmentsCount = User::distinct('department')->whereNotNull('department')->where('department', '!=', '')->count('department');

        $distinctRoles = Role::orderBy('name')->pluck('name');
        $distinctDepartments = User::select('department')->whereNotNull('department')->where('department', '!=', '')->distinct()->orderBy('department')->pluck('department');

        return response()->json([
            'success' => true,
            'users' => $users,
            'stats' => [
                'total' => $totalUsers,
                'active' => $activeUsers,
                'roles_count' => $rolesCount,
                'departments_count' => $departmentsCount,
            ],
            'filters' => [
                'roles' => $distinctRoles,
                'departments' => $distinctDepartments,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:50',
            'role' => 'required|string|max:100',
            'department' => 'nullable|string|max:100',
            'role_id' => 'nullable|integer',
            'permissions' => 'nullable|array',
            'is_active' => 'boolean',
            'password' => 'nullable|string|min:6',
        ]);

        $words = explode(' ', $validated['name']);
        $initials = '';
        foreach ($words as $w) {
            $initials .= strtoupper(substr($w, 0, 1));
        }
        $initials = substr($initials, 0, 2);

        // If role_id not provided, match by name
        $roleId = $validated['role_id'] ?? null;
        if (!$roleId) {
            $roleModel = Role::where('name', $validated['role'])->first();
            $roleId = $roleModel?->id;
        }

        // Default permissions from role if not explicitly customized
        $permissions = $validated['permissions'] ?? null;
        if ($permissions === null && $roleId) {
            $roleModel = Role::find($roleId);
            $permissions = $roleModel?->permissions;
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'role' => $validated['role'],
            'department' => $validated['department'] ?? 'Sales',
            'role_id' => $roleId,
            'permissions' => $permissions ?? [],
            'initials' => $initials,
            'is_active' => $validated['is_active'] ?? true,
            'password' => Hash::make($validated['password'] ?? 'password123'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Agent / User created successfully.',
            'user' => $user,
        ]);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $id,
            'phone' => 'nullable|string|max:50',
            'role' => 'required|string|max:100',
            'department' => 'nullable|string|max:100',
            'role_id' => 'nullable|integer',
            'permissions' => 'nullable|array',
            'is_active' => 'boolean',
            'password' => 'nullable|string|min:6',
        ]);

        $words = explode(' ', $validated['name']);
        $initials = '';
        foreach ($words as $w) {
            $initials .= strtoupper(substr($w, 0, 1));
        }
        $validated['initials'] = substr($initials, 0, 2);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'User details updated successfully.',
            'user' => $user,
        ]);
    }

    /**
     * Update Granular Permissions directly for a user.
     */
    public function updatePermissions(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'permissions' => 'required|array',
        ]);

        $user->permissions = $validated['permissions'];
        $user->save();

        return response()->json([
            'success' => true,
            'message' => "Granular permissions updated for {$user->name}.",
            'permissions' => $user->permissions,
        ]);
    }

    /**
     * Activate an inactive user and dispatch activation email.
     */
    public function activate(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'role' => 'nullable|string|max:100',
            'department' => 'nullable|string|max:100',
        ]);

        $user->is_active = true;

        if (!empty($validated['role'])) {
            $user->role = $validated['role'];
            $roleModel = Role::where('name', $validated['role'])->first();
            if ($roleModel) {
                $user->role_id = $roleModel->id;
                $user->permissions = $roleModel->permissions;
            }
        } elseif ($user->role === 'Pending Assignment' || empty($user->role)) {
            $user->role = 'Property Consultant';
            $roleModel = Role::where('name', 'Property Consultant')->first();
            if ($roleModel) {
                $user->role_id = $roleModel->id;
                $user->permissions = $roleModel->permissions;
            }
        }

        if (!empty($validated['department'])) {
            $user->department = $validated['department'];
        } elseif ($user->department === 'Pending Review' || empty($user->department)) {
            $user->department = 'Sales';
        }

        $user->save();

        // Dispatch queued activation email to the user
        try {
            $loginUrl = 'http://localhost:3000/login';
            Mail::to($user->email)->queue(new AccountActivatedMail($user, $loginUrl));
        } catch (\Throwable $e) {
            \Log::error('Failed to queue AccountActivatedMail: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => "Account for {$user->name} has been activated successfully and notification email dispatched.",
            'user' => $user->load('roleModel'),
        ]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        
        // Prevent deleting Faraz Shafi (primary root user)
        if ($user->id === 1) {
            return response()->json([
                'success' => false,
                'message' => 'Super Administrator cannot be removed.',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'User / Agent removed successfully.',
        ]);
    }
}
