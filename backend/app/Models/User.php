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
        'distribution_weight',
        'daily_lead_cap',
        'today_assigned_count',
        'last_assigned_at',
        'password',
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
     */
    public function hasPermission(string $permission): bool
    {
        // Super Admin has everything
        if (strtolower($this->role) === 'super admin' || $this->role_id === 1) {
            return true;
        }

        // Check user-specific granular permissions override
        if (!empty($this->permissions) && is_array($this->permissions)) {
            if (in_array('*', $this->permissions) || in_array($permission, $this->permissions)) {
                return true;
            }
        }

        // Fallback to role permissions
        if ($this->roleModel && !empty($this->roleModel->permissions)) {
            if (in_array('*', $this->roleModel->permissions) || in_array($permission, $this->roleModel->permissions)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get computed effective permissions array.
     */
    public function getEffectivePermissionsAttribute(): array
    {
        if (strtolower($this->role ?? '') === 'super admin' || $this->role_id === 1) {
            return ['*'];
        }
        if (!empty($this->permissions) && is_array($this->permissions)) {
            return $this->permissions;
        }
        if ($this->roleModel && !empty($this->roleModel->permissions)) {
            return is_array($this->roleModel->permissions)
                ? $this->roleModel->permissions
                : explode(' ', $this->roleModel->permissions);
        }
        $role = Role::where('name', $this->role)->first();
        if ($role && !empty($role->permissions)) {
            return is_array($role->permissions)
                ? $role->permissions
                : explode(' ', $role->permissions);
        }
        return [];
    }
}
