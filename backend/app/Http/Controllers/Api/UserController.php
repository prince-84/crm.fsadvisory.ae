<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Models\Activity;
use App\Mail\AccountActivatedMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'in_distribution_pool' => 'nullable|boolean',
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
            'in_distribution_pool' => $request->has('in_distribution_pool') ? $request->boolean('in_distribution_pool') : true,
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
            'in_distribution_pool' => 'nullable|boolean',
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
     * Ensures permissions are isolated strictly to this specific user profile
     * without modifying the global Role or other users.
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
            'message' => "Granular permissions updated for {$user->name} successfully.",
            'permissions' => $user->permissions,
            'user' => $user,
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

    /**
     * Force sign out a specific user from all active sessions.
     */
    public function forceLogoutUser(Request $request, $id)
    {
        $currentUser = $request->user();
        $isSuperAdmin = $currentUser && ($currentUser->id === 1 || strtolower($currentUser->role ?? '') === 'super admin' || in_array('*', $currentUser->effective_permissions ?? []));

        if (!$isSuperAdmin && (!$currentUser || !$currentUser->hasPermission('users.manage'))) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Administrators can terminate user sessions.',
            ], 403);
        }

        $user = User::findOrFail($id);

        // Invalidate active API token and remember token
        $user->api_token = 'fsa_revoked_' . Str::random(40);
        $user->remember_token = null;
        $user->save();

        // Clear sessions from sessions table if exists
        try {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        } catch (\Throwable $e) {}

        // Log audit activity
        try {
            Activity::create([
                'user_id' => $currentUser?->id,
                'action' => 'force_logout',
                'description' => "Administrator forced sign out for user {$user->name} (#{$user->id}, {$user->email}).",
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {}

        return response()->json([
            'success' => true,
            'message' => "{$user->name} has been forcefully signed out from all active sessions.",
            'user_id' => $user->id,
        ]);
    }

    /**
     * Force sign out ALL users CRM-wide in 1-click (except the active admin).
     */
    public function forceLogoutAll(Request $request)
    {
        $currentUser = $request->user();
        $isSuperAdmin = $currentUser && ($currentUser->id === 1 || strtolower($currentUser->role ?? '') === 'super admin' || in_array('*', $currentUser->effective_permissions ?? []));

        if (!$isSuperAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only Super Administrators can execute global 1-click force sign out.',
            ], 403);
        }

        $currentAdminId = $currentUser ? $currentUser->id : 1;

        // Query all users except current admin
        $usersToSignOut = User::where('id', '!=', $currentAdminId)->get();
        $count = 0;

        foreach ($usersToSignOut as $u) {
            $u->api_token = 'fsa_revoked_' . Str::random(40);
            $u->remember_token = null;
            $u->save();
            $count++;
        }

        // Clear database sessions for everyone except current admin
        try {
            DB::table('sessions')->where('user_id', '!=', $currentAdminId)->delete();
        } catch (\Throwable $e) {}

        // Log audit activity
        try {
            Activity::create([
                'user_id' => $currentAdminId,
                'action' => 'force_logout_all',
                'description' => "Global 1-click force sign out executed. {$count} user account session(s) revoked.",
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {}

        return response()->json([
            'success' => true,
            'message' => "Successfully signed out {$count} user(s) from all active sessions across the CRM.",
            'revoked_count' => $count,
        ]);
    }
}
