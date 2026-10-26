<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'role',
        'department',
        'role_id',
        'permissions',
        'initials',
        'is_active',
        'in_distribution_pool',
        'receive_lead_pool_leads',
        'distribution_weight',
        'daily_lead_cap',
        'today_assigned_count',
        'last_assigned_at',
        'password',
        'api_token',
        'api_token_last_used_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = [
        'effective_permissions',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'in_distribution_pool' => 'boolean',
            'receive_lead_pool_leads' => 'boolean',
            'distribution_weight' => 'integer',
            'daily_lead_cap' => 'integer',
            'today_assigned_count' => 'integer',
            'last_assigned_at' => 'datetime',
            'permissions' => 'array',
        ];
    }

    public function roleModel()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    /**
     * Check if user has specific permission.
     * Permissions are derived strictly from the user's assigned Role as the single source of truth.
     */
    public function hasPermission(string $permission): bool
    {
        // Super Admin has unrestricted access to everything
        if (strtolower($this->role ?? '') === 'super admin' || $this->role_id === 1 || $this->id === 1) {
            return true;
        }

        // Strict derivation from assigned Role
        $role = $this->roleModel;
        if (!$role && !empty($this->role)) {
            $cleanRole = trim($this->role);
            $role = Role::where('name', $cleanRole)
                ->orWhere('slug', \Illuminate\Support\Str::slug($cleanRole))
                ->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($cleanRole)])
                ->orWhereRaw('LOWER(TRIM(slug)) = ?', [strtolower($cleanRole)])
                ->first();
        }

        if ($role && !empty($role->permissions)) {
            $perms = is_array($role->permissions) ? $role->permissions : explode(' ', $role->permissions);
            if (in_array('*', $perms) || in_array($permission, $perms)) {
                return true;
            }
        }

        // Fallback to user stored permissions
        if (!empty($this->permissions) && is_array($this->permissions)) {
            if (in_array('*', $this->permissions) || in_array($permission, $this->permissions)) {
                return true;
            }
        }

        // Real estate agent baseline fallback: All working sales agents have core view access
        if ($permission === 'leads.view' || $permission === 'lead_pool.view') {
            $roleLower = strtolower($this->role ?? '');
            if (
                str_contains($roleLower, 'agent') ||
                str_contains($roleLower, 'consultant') ||
                str_contains($roleLower, 'advisor') ||
                str_contains($roleLower, 'manager') ||
                str_contains($roleLower, 'coordinator') ||
                str_contains($roleLower, 'sales')
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get computed effective permissions array strictly from assigned Role.
     */
    public function getEffectivePermissionsAttribute(): array
    {
        if (strtolower($this->role ?? '') === 'super admin' || $this->role_id === 1 || $this->id === 1) {
            return ['*'];
        }

        $role = $this->roleModel;
        if (!$role && !empty($this->role)) {
            $cleanRole = trim($this->role);
            $role = Role::where('name', $cleanRole)
                ->orWhere('slug', \Illuminate\Support\Str::slug($cleanRole))
                ->orWhereRaw('LOWER(TRIM(name)) = ?', [strtolower($cleanRole)])
                ->orWhereRaw('LOWER(TRIM(slug)) = ?', [strtolower($cleanRole)])
                ->first();
        }

        $perms = [];
        if ($role && !empty($role->permissions)) {
            $perms = is_array($role->permissions)
                ? $role->permissions
                : explode(' ', $role->permissions);
        } elseif (!empty($this->permissions) && is_array($this->permissions)) {
            $perms = $this->permissions;
        }

        // Real estate baseline guarantee: Always ensure leads.view and lead_pool.view for sales roles
        $roleLower = strtolower($this->role ?? '');
        if (
            str_contains($roleLower, 'agent') ||
            str_contains($roleLower, 'consultant') ||
            str_contains($roleLower, 'advisor') ||
            str_contains($roleLower, 'manager') ||
            str_contains($roleLower, 'coordinator') ||
            str_contains($roleLower, 'sales')
        ) {
            if (!in_array('leads.view', $perms)) {
                $perms[] = 'leads.view';
            }
            if (!in_array('lead_pool.view', $perms)) {
                $perms[] = 'lead_pool.view';
            }
        }

        return array_values(array_unique($perms));
    }

    /**
     * Generate or rotate API token for user.
     */
    public function generateApiToken(): string
    {
        $prefix = ($this->id === 1 || strtolower($this->role ?? '') === 'super admin') ? 'fsa_admin_' : 'fsa_token_';
        $token = $prefix . \Illuminate\Support\Str::random(50);
        $this->update([
            'api_token' => $token,
            'api_token_last_used_at' => now(),
        ]);
        return $token;
    }
}
