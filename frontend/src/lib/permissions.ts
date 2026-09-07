'use client';

import { fetchApi } from './api';

export interface UserPermissionProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
  permissions: string[] | null;
  is_active: boolean;
}

// Default bootstrap user profile for Faraz Shafi (Executive Management / Super Admin)
export const DEFAULT_CRM_USER: UserPermissionProfile = {
  id: 1,
  name: 'Faraz Shafi',
  email: 'faraz@fsadvisory.ae',
  role: 'Super Admin',
  department: 'Executive Management',
  permissions: ['*'],
  is_active: true,
};

/**
 * Determine if a user profile represents an executive, founder, CEO, or Super Admin.
 * Super users automatically bypass all granular permission restrictions.
 */
export function isSuperUser(user: UserPermissionProfile | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const name = (user.name || '').toLowerCase();
  const email = (user.email || '').toLowerCase();

  // 1. Role keywords for full system authority
  if (
    role.includes('admin') ||
    role.includes('ceo') ||
    role.includes('director') ||
    role.includes('founder') ||
    role.includes('owner') ||
    role.includes('executive')
  ) {
    return true;
  }

  // 2. Named accounts with full master authority
  if (email === 'faraz@fsadvisory.ae' || name.includes('faraz')) {
    return true;
  }

  // 3. Explicit wildcard permission
  const perms = user.permissions || [];
  if (perms.includes('*')) {
    return true;
  }

  return false;
}

/**
 * Retrieve current user from localStorage with auto-healing fallback to DEFAULT_CRM_USER.
 */
export function getCurrentUser(): UserPermissionProfile | null {
  if (typeof window === 'undefined') return DEFAULT_CRM_USER;
  try {
    const raw = localStorage.getItem('crm_user');
    if (!raw) {
      localStorage.setItem('crm_user', JSON.stringify(DEFAULT_CRM_USER));
      return DEFAULT_CRM_USER;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.name) {
      localStorage.setItem('crm_user', JSON.stringify(DEFAULT_CRM_USER));
      return DEFAULT_CRM_USER;
    }

    // Auto-heal permissions if user is CEO / Super Admin but cached without wildcard
    if (isSuperUser(parsed)) {
      if (!parsed.permissions || !parsed.permissions.includes('*')) {
        parsed.permissions = ['*'];
        localStorage.setItem('crm_user', JSON.stringify(parsed));
      }
    }

    return parsed;
  } catch {
    return DEFAULT_CRM_USER;
  }
}

/**
 * Check if current user has a specific granular permission key.
 * Super Admin, CEO, or '*' wildcard automatically passes all checks.
 */
export function hasPermission(permissionKey: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (isSuperUser(user)) return true;
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
  if (isSuperUser(user)) return true;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return permissionKeys.some((k) => perms.includes(k));
}

/**
 * Refresh user profile and permissions from backend via authenticated fetchApi and sync with localStorage.
 */
export async function refreshCurrentUser(): Promise<UserPermissionProfile | null> {
  try {
    const data = await fetchApi('/auth/me');
    if (data && data.success && data.user) {
      const isSuper = isSuperUser(data.user);
      const perms = isSuper ? ['*'] : (data.user.permissions || []);
      const updated: UserPermissionProfile = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        department: data.user.department,
        permissions: perms,
        is_active: data.user.is_active,
      };
      localStorage.setItem('crm_user', JSON.stringify(updated));
      window.dispatchEvent(new Event('crm_user_updated'));
      return updated;
    }
  } catch (e) {
    console.error('Failed to refresh permissions', e);
  }
  return getCurrentUser();
}
