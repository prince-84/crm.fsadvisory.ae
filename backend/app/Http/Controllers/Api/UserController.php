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
            'receive_lead_pool_leads' => 'nullable|boolean',
            'password' => 'nullable|string|min:6',
        ]);

        $words = explode(' ', $validated['name']);
        $initials = '';
        foreach ($words as $w) {
            $initials .= strtoupper(substr($w, 0, 1));
        }
        $initials = substr($initials, 0, 2);

        // Resolve Role Model as single source of truth
        $roleModel = null;
        if (!empty($validated['role_id'])) {
            $roleModel = Role::find($validated['role_id']);
        }
        if (!$roleModel && !empty($validated['role'])) {
            $cleanRole = trim($validated['role']);
            $roleModel = Role::where('name', $cleanRole)
                ->orWhere('slug', Str::slug($cleanRole))
                ->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($cleanRole)])
                ->orWhereRaw('LOWER(TRIM(slug)) = ?', [strtolower($cleanRole)])
                ->first();
        }

        $roleId = $roleModel?->id;
        $roleName = $roleModel ? $roleModel->name : $validated['role'];
        $isSuper = strtolower($roleName) === 'super admin' || $roleId === 1;
        $permissions = $isSuper ? ['*'] : ($roleModel?->permissions ?? []);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'role' => $roleName,
            'department' => $validated['department'] ?? 'Sales',
            'role_id' => $roleId,
            'permissions' => $permissions,
            'initials' => $initials,
            'is_active' => $validated['is_active'] ?? true,
            'in_distribution_pool' => $request->has('in_distribution_pool') ? $request->boolean('in_distribution_pool') : true,
            'receive_lead_pool_leads' => $request->has('receive_lead_pool_leads') ? $request->boolean('receive_lead_pool_leads') : true,
            'password' => Hash::make($validated['password'] ?? 'password123'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Agent / User created successfully.',
            'user' => $user->load('roleModel'),
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
            'receive_lead_pool_leads' => 'nullable|boolean',
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

        // Always resolve Role model and assign its permissions strictly
        $roleModel = null;
        if (!empty($validated['role_id'])) {
            $roleModel = Role::find($validated['role_id']);
        }
        if (!$roleModel && !empty($validated['role'])) {
            $cleanRole = trim($validated['role']);
            $roleModel = Role::where('name', $cleanRole)
                ->orWhere('slug', Str::slug($cleanRole))
                ->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($cleanRole)])
                ->orWhereRaw('LOWER(TRIM(slug)) = ?', [strtolower($cleanRole)])
                ->first();
        }

        if ($roleModel) {
            $validated['role_id'] = $roleModel->id;
            $validated['role'] = $roleModel->name;
        }

        $isSuper = strtolower($validated['role']) === 'super admin' || ($roleModel && $roleModel->id === 1) || $user->id === 1;
        $validated['permissions'] = $isSuper ? ['*'] : ($roleModel?->permissions ?? []);

        $user->update($validated);

        if (\Illuminate\Support\Facades\Schema::hasTable('whatsapp_channels')) {
            $chan = \App\Models\WhatsAppChannel::where('user_id', $user->id)
                ->orWhere('agent_name', $user->name)
                ->first();
            if ($chan) {
                $chanUpdates = [
                    'agent_name' => $user->name,
                    'session_name' => $user->name,
                ];
                if (array_key_exists('phone', $validated)) {
                    $chanUpdates['phone_number'] = $validated['phone'];
                }
                $chan->update($chanUpdates);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'User details updated successfully.',
            'user' => $user->fresh()->load('roleModel'),
        ]);
    }

    /**
     * Update Granular Permissions directly for a user.
     * Centralized to the user's assigned Role so all role members stay 100% in sync.
     */
    public function updatePermissions(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'permissions' => 'required|array',
        ]);

        $newPermissions = $validated['permissions'];

        // Synchronize permissions to the assigned Role
        $role = null;
        if ($user->role_id) {
            $role = Role::find($user->role_id);
        }
        if (!$role && $user->role) {
            $role = Role::where('name', $user->role)->first();
        }

        if ($role && strtolower($role->name) !== 'super admin') {
            $role->update([
                'permissions' => $newPermissions,
            ]);

            // Sync to all users who share this role
            User::where(function($q) use ($role) {
                    $q->where('role_id', $role->id)
                      ->orWhere('role', $role->name);
                })
                ->get()
                ->each(function ($u) use ($role, $newPermissions) {
                    $u->update([
                        'role_id' => $role->id,
                        'permissions' => $newPermissions,
                    ]);
                });
        } else {
            $user->update([
                'permissions' => $newPermissions,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Permissions updated and synced for role '{$user->role}' successfully.",
            'permissions' => $user->fresh()->effective_permissions,
            'user' => $user->fresh()->load('roleModel'),
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
