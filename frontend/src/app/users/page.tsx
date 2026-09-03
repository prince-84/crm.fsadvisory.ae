'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '@/lib/api';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Building,
  Search,
  Plus,
  Edit3,
  Trash2,
  KeyRound,
  Check,
  X,
  RefreshCw,
  SlidersHorizontal,
  Lock,
  Mail,
  Phone,
  CheckSquare,
  Square,
  ChevronDown,
  Layers,
  Sparkles,
  UserPlus,
  CheckCircle2
} from 'lucide-react';
import { hasAnyPermission } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';

interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  role_id: number | null;
  permissions: string[] | null;
  initials: string;
  is_active: boolean;
  created_at?: string;
  role_model?: any;
}

interface RoleItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  users_count?: number;
}

interface PermissionCategory {
  module: string;
  description: string;
  permissions: {
    key: string;
    label: string;
    desc: string;
  }[];
}

export default function UserManagementPage() {
  const [canManageUsers, setCanManageUsers] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPerms = () => {
      setCanManageUsers(hasAnyPermission(['users.manage', 'roles.manage']));
    };
    checkPerms();
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);
  // Tabs: 'users' | 'roles'
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  // Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permMatrix, setPermMatrix] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    roles_count: 0,
    departments_count: 0,
  });

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Filter options
  const [filterOptions, setFilterOptions] = useState<{
    roles: string[];
    departments: string[];
  }>({
    roles: [],
    departments: [],
  });

  // User Add/Edit Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create');
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Property Consultant',
    department: 'Off-Plan Sales',
    password: '',
    is_active: true,
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  // Granular Permissions Modal State
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [permTargetUser, setPermTargetUser] = useState<UserItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Fetch Data
  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedRole !== 'all') params.append('role', selectedRole);
      if (selectedDepartment !== 'all') params.append('department', selectedDepartment);
      if (selectedStatus !== 'all') params.append('is_active', selectedStatus === 'active' ? 'true' : 'false');

      const res = await fetch(`${API_BASE_URL}/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        if (data.stats) setStats(data.stats);
        if (data.filters) setFilterOptions(data.filters);
      }
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  const loadRolesAndMatrix = async () => {
    try {
      const [rolesRes, matrixRes] = await Promise.all([
        fetch(`${API_BASE_URL}/roles`),
        fetch(`${API_BASE_URL}/permissions/matrix`),
      ]);
      const rolesData = await rolesRes.json();
      const matrixData = await matrixRes.json();

      if (rolesData.success) setRoles(rolesData.roles || []);
      if (matrixData.success) setPermMatrix(matrixData.matrix || []);
    } catch (e) {
      console.error('Failed to load roles and matrix', e);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [selectedRole, selectedDepartment, selectedStatus]);

  useEffect(() => {
    loadRolesAndMatrix();
  }, []);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Open User Create Modal
  const handleOpenCreateUser = () => {
    setUserModalMode('create');
    setActiveUserId(null);
    setUserFormData({
      name: '',
      email: '',
      phone: '',
      role: 'Property Consultant',
      department: 'Off-Plan Sales',
      password: '',
      is_active: true,
    });
    setIsUserModalOpen(true);
  };

  // Open User Edit Modal
  const handleOpenEditUser = (u: UserItem) => {
    setUserModalMode('edit');
    setActiveUserId(u.id);
    setUserFormData({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'Property Consultant',
      department: u.department || 'Sales',
      password: '',
      is_active: u.is_active ?? true,
    });
    setIsUserModalOpen(true);
  };

  // Submit User Form
  const handleSubmitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUser(true);
    try {
      const url = userModalMode === 'create'
        ? `${API_BASE_URL}/users`
        : `${API_BASE_URL}/users/${activeUserId}`;
      const method = userModalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData),
      });
      const data = await res.json();

      if (data.success) {
        setIsUserModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: userModalMode === 'create' ? 'Member Added!' : 'Member Updated!',
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        loadUsers();
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Operation failed.' });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Request Failed', text: err.message });
    } finally {
      setSubmittingUser(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (id: number, name: string) => {
    const confirm = await Swal.fire({
      title: 'Remove Team Member?',
      text: `Are you sure you want to remove ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E11D48',
      cancelButtonColor: '#081428',
      confirmButtonText: 'Yes, Remove',
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'Removed!', text: data.message, timer: 1400, showConfirmButton: false });
          loadUsers();
        } else {
          Swal.fire({ icon: 'error', title: 'Cannot Remove', text: data.message });
        }
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
      }
    }
  };

  // Activate Inactive User & Dispatch Activation Email
  const handleActivateUser = async (user: UserItem) => {
    const { value: formValues } = await Swal.fire({
      title: `Approve & Activate Account?`,
      html: `
        <div class="text-left text-xs space-y-3 mt-2">
          <p class="text-slate-600">Assign official Department and Role for <b>${user.name}</b> (${user.email}).</p>
          <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-medium">
            ✉️ An official activation email with the direct login link will be dispatched from <b>notifications@crm.fsadvisory.ae</b>.
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Department</label>
            <select id="swal-dept" class="w-full p-2 border border-slate-300 rounded text-xs bg-white text-slate-800 font-medium">
              <option value="TeleSales" ${user.department === 'TeleSales' ? 'selected' : ''}>TeleSales</option>
              <option value="Off-Plan Sales" ${user.department === 'Off-Plan Sales' ? 'selected' : ''}>Off-Plan Sales</option>
              <option value="Secondary & Luxury" ${user.department === 'Secondary & Luxury' ? 'selected' : ''}>Secondary & Luxury</option>
              <option value="Executive Management" ${user.department === 'Executive Management' ? 'selected' : ''}>Executive Management</option>
              <option value="Operations & Compliance" ${user.department === 'Operations & Compliance' ? 'selected' : ''}>Operations & Compliance</option>
              <option value="Client Relations / Inbound" ${user.department === 'Client Relations / Inbound' ? 'selected' : ''}>Client Relations / Inbound</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Designated Role</label>
            <select id="swal-role" class="w-full p-2 border border-slate-300 rounded text-xs bg-white text-slate-800 font-medium">
              <option value="Telesales Agent">Telesales Agent</option>
              <option value="Property Consultant">Property Consultant</option>
              <option value="Senior Property Advisor">Senior Property Advisor</option>
              <option value="Sales Manager">Sales Manager</option>
              <option value="Operations Coordinator">Operations Coordinator</option>
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Approve & Send Activation Email',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
      preConfirm: () => {
        return {
          department: (document.getElementById('swal-dept') as HTMLSelectElement).value,
          role: (document.getElementById('swal-role') as HTMLSelectElement).value,
        };
      },
    });

    if (!formValues) return;

    try {
      const res = await fetch(`${API_BASE_URL}/users/${user.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Account Activated!',
          text: data.message,
          timer: 2000,
          showConfirmButton: false,
        });
        loadUsers();
      } else {
        Swal.fire({ icon: 'error', title: 'Activation Failed', text: data.message });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Failed to activate account' });
    }
  };

  // Open Granular Permissions Modal
  const handleOpenPermModal = (u: UserItem) => {
    setPermTargetUser(u);
    let perms = u.permissions || [];
    // If empty, find role defaults
    if (perms.length === 0 && u.role) {
      const matchRole = roles.find((r) => r.name.toLowerCase() === u.role.toLowerCase());
      if (matchRole && matchRole.permissions) {
        perms = matchRole.permissions;
      }
    }
    setSelectedPermissions([...perms]);
    setIsPermModalOpen(true);
  };

  // Toggle single permission key
  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) => {
      // If super admin wildcard is active and unticking, remove wildcard
      if (prev.includes('*')) {
        const allKeys = permMatrix.flatMap((m) => m.permissions.map((p) => p.key));
        return allKeys.filter((k) => k !== key);
      }
      return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    });
  };

  // Toggle entire category
  const toggleCategory = (cat: PermissionCategory) => {
    const catKeys = cat.permissions.map((p) => p.key);
    const hasAll = catKeys.every((k) => selectedPermissions.includes(k) || selectedPermissions.includes('*'));

    setSelectedPermissions((prev) => {
      let base = prev.includes('*') ? permMatrix.flatMap((m) => m.permissions.map((p) => p.key)) : [...prev];
      if (hasAll) {
        return base.filter((k) => !catKeys.includes(k));
      } else {
        return Array.from(new Set([...base, ...catKeys]));
      }
    });
  };

  // Copy permissions from Role preset
  const handleApplyRolePreset = (roleSlug: string) => {
    const r = roles.find((role) => role.slug === roleSlug);
    if (r) {
      setSelectedPermissions([...r.permissions]);
    }
  };

  // Select all permissions
  const handleSelectAll = () => {
    const allKeys = permMatrix.flatMap((m) => m.permissions.map((p) => p.key));
    setSelectedPermissions(allKeys);
  };

  // Clear all permissions
  const handleClearAll = () => {
    setSelectedPermissions([]);
  };

  // Save Permissions to Backend
  const handleSavePermissions = async () => {
    if (!permTargetUser) return;
    setSavingPermissions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${permTargetUser.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selectedPermissions }),
      });
      const data = await res.json();

      if (data.success) {
        // If current logged-in user's permissions were edited, sync immediately
        try {
          const raw = localStorage.getItem('crm_user');
          if (raw) {
            const current = JSON.parse(raw);
            if (current.id === permTargetUser.id || current.email === permTargetUser.email) {
              current.permissions = selectedPermissions;
              localStorage.setItem('crm_user', JSON.stringify(current));
              window.dispatchEvent(new Event('crm_user_updated'));
            }
          }
        } catch (err) {
          console.error(err);
        }

        setIsPermModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: 'Permissions Saved!',
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        loadUsers();
      } else {
        Swal.fire({ icon: 'error', title: 'Save Failed', text: data.message });
      }
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    } finally {
      setSavingPermissions(false);
    }
  };

  // Helper to get total permission count for a user
  const getUserPermCountText = (u: UserItem) => {
    if (u.permissions && u.permissions.includes('*')) {
      return 'Full Access (*)';
    }
    if (u.role === 'Super Admin') {
      return 'Super Admin (*)';
    }
    const count = u.permissions?.length || 0;
    return `${count} Perms`;
  };

  if (canManageUsers === false) {
    return (
      <div className="flex h-screen bg-[#F8F9FA] text-[#1B2A4A] overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col h-screen overflow-hidden min-w-0">
          <Navbar />
          <AccessDenied moduleName="User & Role Management" requiredPermission="users.manage" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#1B2A4A] overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col h-screen overflow-hidden min-w-0">
        <Navbar />

        {/* 1. Page Header */}
        <header className="bg-white border-b border-[#E8E2D9] px-6 py-4 shrink-0 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#081428] text-[#C9A84C] flex items-center justify-center font-bold shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-lg text-[#081428] tracking-tight">
                  User Management & Roles
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#081428] text-[#C9A84C]">
                  Security Control
                </span>
              </div>
              <p className="text-xs text-[#7A7A7A]">
                Manage agent profiles, roles, and granular permission access matrices across all CRM modules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tab Switcher */}
            <div className="flex bg-[#FAF8F5] border border-[#E8E2D9] rounded-md p-0.5">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-[#081428] text-[#C9A84C] shadow-2xs'
                    : 'text-[#7A7A7A] hover:text-[#081428]'
                }`}
              >
                Team Members ({stats.total})
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-[#081428] text-[#C9A84C] shadow-2xs'
                    : 'text-[#7A7A7A] hover:text-[#081428]'
                }`}
              >
                Roles & Matrix ({roles.length})
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={loadUsers}
              className="p-2 border border-[#E8E2D9] rounded-md hover:bg-slate-50 text-[#7A7A7A] hover:text-[#1B2A4A] transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Add Member Button */}
            <button
              onClick={handleOpenCreateUser}
              className="px-3.5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-md shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Team Member</span>
            </button>
          </div>
        </header>

        {/* 2. Top Stats KPI Cards */}
        <div className="px-6 py-3.5 bg-[#FAF8F5] border-b border-[#E8E2D9] shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Total Team Members</div>
              <div className="text-xl font-bold text-[#081428] mt-0.5">{stats.total}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-[#FAF8F5] border border-[#E8E2D9] flex items-center justify-center text-[#C9A84C]">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Active Advisors</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{stats.active}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Security Roles</div>
              <div className="text-xl font-bold text-indigo-700 mt-0.5">{stats.roles_count}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Departments</div>
              <div className="text-xl font-bold text-[#081428] mt-0.5">{stats.departments_count}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-[#FAF8F5] border border-[#E8E2D9] flex items-center justify-center text-[#1B2A4A]">
              <Building className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 3. Main Body */}
        {activeTab === 'users' ? (
          <>
            {/* Filter Bar */}
            <div className="p-3 px-6 bg-white border-b border-[#E8E2D9] shrink-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                {/* Search */}
                <div className="relative w-64 sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                  <input
                    type="text"
                    placeholder="Search name, email, phone, role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] text-[#081428]"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Role Filter */}
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-md text-xs font-semibold text-[#1B2A4A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
                >
                  <option value="all">All Roles ({filterOptions.roles.length})</option>
                  {filterOptions.roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                {/* Department Filter */}
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-md text-xs font-semibold text-[#1B2A4A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {filterOptions.departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-md text-xs font-semibold text-[#1B2A4A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive</option>
                </select>

                {(searchQuery || selectedRole !== 'all' || selectedDepartment !== 'all' || selectedStatus !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRole('all');
                      setSelectedDepartment('all');
                      setSelectedStatus('all');
                    }}
                    className="text-xs text-[#C8A147] font-bold hover:underline px-1 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Users Table */}
            <div className="flex-1 overflow-auto bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#FAF8F5] border-b border-[#E8E2D9] sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[#7A7A7A]">
                  <tr>
                    <th className="py-3 px-4">Team Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Phone / Mobile</th>
                    <th className="py-3 px-4">Granular Permissions</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D9] text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#C9A84C] mx-auto mb-2" />
                        <span>Loading team members...</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-500">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No Team Members Found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or click Add Team Member.</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSuperAdmin = u.role === 'Super Admin' || u.id === 1;

                      return (
                        <tr key={u.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                          {/* 1. Member Profile */}
                          <td className="py-3 px-4 font-semibold text-[#081428]">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#081428] text-[#C9A84C] flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                                {u.initials || u.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-[#081428] flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isSuperAdmin && (
                                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">Root</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{u.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Role */}
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              u.role === 'Super Admin'
                                ? 'bg-[#081428] text-[#C9A84C] border border-[#C9A84C]/40'
                                : u.role === 'Sales Manager'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : u.role === 'Senior Property Advisor'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : u.role === 'Telesales Agent'
                                ? 'bg-amber-50 text-amber-800 border border-amber-300 font-bold'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {u.role}
                            </span>
                          </td>

                          {/* 3. Department */}
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {u.department ? (
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700 border border-slate-200">
                                {u.department}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* 4. Phone */}
                          <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                            {u.phone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{u.phone}</span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* 5. Granular Permissions Button */}
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleOpenPermModal(u)}
                              className="px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#C9A84C]/15 border border-[#E8E2D9] hover:border-[#C9A84C] rounded-md text-[11px] font-bold text-[#081428] flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Click to customize granular checkboxes"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-[#C9A84C]" />
                              <span>{getUserPermCountText(u)}</span>
                            </button>
                          </td>

                          {/* 6. Active Status */}
                          <td className="py-3 px-4">
                            {u.is_active ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300 inline-block">
                                  ⏳ Pending Review
                                </span>
                                <div>
                                  <button
                                    onClick={() => handleActivateUser(u)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                    title="Approve & Send Activation Email"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Approve & Activate</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 7. Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPermModal(u)}
                                className="p-1.5 bg-slate-100 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-600 rounded transition-colors cursor-pointer"
                                title="Manage Permissions"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1.5 bg-slate-100 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-600 rounded transition-colors cursor-pointer"
                                title="Edit Member Profile"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {!isSuperAdmin && (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.name)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Remove Member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* Tab 2: Roles & Permission Matrix */
          <div className="flex-1 overflow-auto p-6 space-y-6 bg-[#FAF8F5]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roles.map((r) => {
                const isAll = r.permissions.includes('*');
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-[#E8E2D9] p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#081428] text-[#C9A84C]">
                        {r.slug}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {r.users_count ?? 0} Users
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#081428]">{r.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {r.description || 'System standard role.'}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-[#E8E2D9] flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-600">
                        {isAll ? 'Full Access (*)' : `${r.permissions.length} Permissions`}
                      </span>
                      <span className="text-emerald-700 font-bold text-[10px] uppercase bg-emerald-50 px-2 py-0.5 rounded">
                        Configured
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Matrix Documentation */}
            <div className="bg-white rounded-xl border border-[#E8E2D9] p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-[#E8E2D9] pb-3">
                <ShieldCheck className="w-5 h-5 text-[#C9A84C]" />
                <h3 className="font-bold text-base text-[#081428]">
                  Granular Permission Breakdown Across 8 CRM Modules
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {permMatrix.map((mod) => (
                  <div key={mod.module} className="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E8E2D9] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-[#081428] font-bold">{mod.module}</strong>
                      <span className="text-[10px] font-mono text-[#C9A84C] font-bold">
                        {mod.permissions.length} Keys
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{mod.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {mod.permissions.map((p) => (
                        <span key={p.key} className="px-2 py-0.5 bg-white border border-[#E8E2D9] rounded text-[10px] font-mono text-slate-700">
                          {p.key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. GRANULAR PERMISSION CHECKBOX MATRIX MODAL */}
      {isPermModalOpen && permTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full max-w-4xl overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10 text-[#C9A84C] flex items-center justify-center font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading font-bold text-base tracking-wide">
                      Granular CRM Permissions: {permTargetUser.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#C9A84C] text-[#081428]">
                      {permTargetUser.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Toggle individual permission checkboxes across all 8 CRM modules or copy presets from roles.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Preset Bar */}
            <div className="bg-[#FAF8F5] border-b border-[#E8E2D9] px-6 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Preset:</span>
                <select
                  onChange={(e) => handleApplyRolePreset(e.target.value)}
                  defaultValue=""
                  className="px-2.5 py-1 bg-white border border-[#E8E2D9] rounded text-xs font-semibold text-[#081428] cursor-pointer"
                >
                  <option value="" disabled>Apply Role Preset...</option>
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 bg-white border border-[#E8E2D9] hover:bg-slate-50 text-[#081428] font-bold rounded text-[11px] transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 bg-white border border-[#E8E2D9] hover:bg-slate-50 text-slate-600 font-semibold rounded text-[11px] transition-colors cursor-pointer"
                >
                  Clear All
                </button>
                <span className="px-2 py-0.5 bg-[#081428] text-[#C9A84C] font-mono font-bold rounded text-[11px]">
                  {selectedPermissions.includes('*') ? 'All (*)' : `${selectedPermissions.length} Active`}
                </span>
              </div>
            </div>

            {/* Modal Body: Module Checkbox Matrix */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {permMatrix.map((cat) => {
                const catKeys = cat.permissions.map((p) => p.key);
                const isAllChecked = catKeys.every((k) => selectedPermissions.includes(k) || selectedPermissions.includes('*'));
                const someChecked = catKeys.some((k) => selectedPermissions.includes(k)) && !isAllChecked;

                return (
                  <div key={cat.module} className="bg-white border border-[#E8E2D9] rounded-xl overflow-hidden shadow-2xs">
                    {/* Category Header with Toggle */}
                    <div
                      onClick={() => toggleCategory(cat)}
                      className="bg-[#FAF8F5] px-4 py-2.5 border-b border-[#E8E2D9] flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    >
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-[#C9A84C] cursor-pointer">
                          {isAllChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#C9A84C]" />
                          ) : someChecked ? (
                            <div className="w-4 h-4 rounded border-2 border-[#C9A84C] flex items-center justify-center">
                              <div className="w-2 h-2 bg-[#C9A84C] rounded-xs" />
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <strong className="text-xs text-[#081428] font-bold">{cat.module}</strong>
                        <span className="text-[11px] text-slate-400 font-normal">— {cat.description}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {catKeys.filter((k) => selectedPermissions.includes(k) || selectedPermissions.includes('*')).length} / {catKeys.length}
                      </span>
                    </div>

                    {/* Permissions Grid */}
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {cat.permissions.map((p) => {
                        const isChecked = selectedPermissions.includes(p.key) || selectedPermissions.includes('*');

                        return (
                          <label
                            key={p.key}
                            className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                              isChecked
                                ? 'bg-[#C9A84C]/5 border-[#C9A84C]/40'
                                : 'bg-white border-[#E8E2D9] hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(p.key)}
                              className="mt-0.5 accent-[#C9A84C] rounded cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className={`font-semibold text-xs ${isChecked ? 'text-[#081428]' : 'text-slate-700'}`}>
                                {p.label}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                                {p.desc}
                              </p>
                              <span className="font-mono text-[9px] text-slate-400 block mt-1">
                                {p.key}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="bg-white border-t border-[#E8E2D9] px-6 py-3.5 shrink-0 flex items-center justify-between text-xs">
              <div className="text-slate-500 text-[11px]">
                Target: <strong className="text-[#081428]">{permTargetUser.name}</strong> ({permTargetUser.email})
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPermModalOpen(false)}
                  className="px-4 py-2 border border-[#E8E2D9] rounded-md text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded-md shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingPermissions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Granular Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD / EDIT TEAM MEMBER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full max-w-lg overflow-hidden animate-fade-in flex flex-col">
            <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#C9A84C]" />
                <h2 className="font-heading font-bold text-base">
                  {userModalMode === 'create' ? 'Add New Team Member' : 'Edit Member Profile'}
                </h2>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUserForm} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="e.g. Tariq Al-Mansoor"
                  className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-semibold text-[#081428]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="e.g. tariq@fsadvisory.ae"
                    className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="e.g. +971 50 123 4567"
                    className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Role</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] bg-white cursor-pointer font-semibold"
                  >
                    {roles.map((r) => (
                      <option key={r.slug} value={r.name}>{r.name}</option>
                    ))}
                    <option value="Telesales Agent">Telesales Agent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={userFormData.department}
                    onChange={(e) => setUserFormData({ ...userFormData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] bg-white cursor-pointer font-semibold"
                  >
                    <option value="TeleSales">TeleSales</option>
                    <option value="Off-Plan Sales">Off-Plan Sales</option>
                    <option value="Secondary & Luxury">Secondary & Luxury</option>
                    <option value="Executive Management">Executive Management</option>
                    <option value="Client Relations / Inbound">Client Relations / Inbound</option>
                    <option value="Operations & Compliance">Operations & Compliance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password {userModalMode === 'edit' && <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder={userModalMode === 'create' ? 'Min 6 characters' : '••••••••'}
                  className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#E8E2D9]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userFormData.is_active}
                    onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                    className="accent-[#C9A84C] rounded"
                  />
                  <span className="font-semibold text-slate-700">Active Account</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-3.5 py-1.5 border border-[#E8E2D9] rounded text-slate-600 hover:bg-slate-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUser}
                    className="px-4 py-1.5 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded shadow-sm transition-all"
                  >
                    {submittingUser ? 'Saving...' : userModalMode === 'create' ? 'Create Member' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
