'use client';

export interface UserPermissionProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
  permissions: string[] | null;
  is_active: boolean;
}

/**
 * Retrieve current user from localStorage.
 */
export function getCurrentUser(): UserPermissionProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('crm_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check if current user has a specific granular permission key.
 * Super Admin or '*' wildcard automatically passes all checks.
 */
export function hasPermission(permissionKey: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'Super Admin') return true;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return perms.includes(permissionKey);
}

/**
 * Check if current user has any of the given permission keys.
 */
export function hasAnyPermission(permissionKeys: string[]): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'Super Admin') return true;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return permissionKeys.some((k) => perms.includes(k));
}

/**
 * Refresh user profile and permissions from backend and sync with localStorage.
 */
import { API_BASE_URL } from './api';

export async function refreshCurrentUser(): Promise<UserPermissionProfile | null> {
  const user = getCurrentUser();
  if (!user || !user.id) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/users?search=${encodeURIComponent(user.email)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      const match = data.users.find((u: any) => u.id === user.id || u.email === user.email);
      if (match) {
        const updated: UserPermissionProfile = {
          id: match.id,
          name: match.name,
          email: match.email,
          role: match.role,
          department: match.department,
          permissions: match.permissions,
          is_active: match.is_active,
        };
        localStorage.setItem('crm_user', JSON.stringify(updated));
        window.dispatchEvent(new Event('crm_user_updated'));
        return updated;
      }
    }
  } catch (e) {
    console.error('Failed to refresh permissions', e);
  }
  return user;
}
