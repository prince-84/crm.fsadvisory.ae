'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import Swal from 'sweetalert2';
import { fetchApi, API_BASE_URL } from '@/lib/api';
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
  CheckCircle2,
  Building2,
  HelpCircle
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
  in_distribution_pool?: boolean;
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

interface DepartmentItem {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
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

  // Tabs: 'users' | 'roles' | 'departments'
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'departments'>('users');

  // Core Data States
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
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

  // User Add/Edit Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create');
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Telesales Agent',
    department: 'Sales',
    password: '',
    is_active: true,
    in_distribution_pool: true,
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  // Role Add/Edit Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<'create' | 'edit'>('create');
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });
  const [submittingRole, setSubmittingRole] = useState(false);

  // Department Add/Edit Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptModalMode, setDeptModalMode] = useState<'create' | 'edit'>('create');
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
  });
  const [submittingDept, setSubmittingDept] = useState(false);

  // Granular Permissions Modal State
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [permTargetUser, setPermTargetUser] = useState<UserItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Helper: Extract all keys from matrix
  const getAllMatrixKeys = (): string[] => {
    const keys: string[] = [];
    permMatrix.forEach((mod) => {
      mod.permissions.forEach((p) => keys.push(p.key));
    });
    return keys;
  };

  // Helper: Expand '*' wildcard into explicit key list
  const expandPermissions = (perms: string[]): string[] => {
    if (!perms || perms.length === 0) return [];
    if (perms.includes('*')) {
      return getAllMatrixKeys();
    }
    return [...perms];
  };

  // Fetch Data Functions
  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedRole !== 'all') params.append('role', selectedRole);
      if (selectedDepartment !== 'all') params.append('department', selectedDepartment);
      if (selectedStatus !== 'all') params.append('is_active', selectedStatus === 'active' ? 'true' : 'false');

      const data = await fetchApi(`/users?${params.toString()}`);
      if (data.success) {
        setUsers(data.users || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  const loadRolesAndMatrix = async () => {
    try {
      const [rolesData, matrixData] = await Promise.all([
        fetchApi('/roles'),
        fetchApi('/permissions/matrix'),
      ]);
      if (rolesData.success) setRoles(rolesData.roles || []);
      if (matrixData.success) setPermMatrix(matrixData.matrix || []);
    } catch (e) {
      console.error('Failed to load roles and matrix', e);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await fetchApi('/departments');
      if (data.success) setDepartments(data.departments || []);
    } catch (e) {
      console.error('Failed to load departments', e);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [selectedRole, selectedDepartment, selectedStatus]);

  useEffect(() => {
    loadRolesAndMatrix();
    loadDepartments();
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
      role: roles.length > 0 ? roles[0].name : 'Telesales Agent',
      department: departments.length > 0 ? departments[0].name : 'Sales',
      password: '',
      is_active: true,
      in_distribution_pool: true,
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
      role: u.role || 'Telesales Agent',
      department: u.department || 'Sales',
      password: '',
      is_active: u.is_active ?? true,
      in_distribution_pool: u.in_distribution_pool ?? true,
    });
    setIsUserModalOpen(true);
  };

  // Submit User Form
  const handleSubmitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUser(true);
    try {
      const path = userModalMode === 'create' ? '/users' : `/users/${activeUserId}`;
      const method = userModalMode === 'create' ? 'POST' : 'PUT';

      const data = await fetchApi(path, {
        method,
        body: JSON.stringify(userFormData),
      });

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
      Swal.fire({ icon: 'error', title: 'Submission Failed', text: err.message || 'Failed to submit user.' });
    } finally {
      setSubmittingUser(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (id: number, name: string) => {
    const res = await Swal.fire({
      title: 'Remove Team Member?',
      text: `Are you sure you want to remove user "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Remove User',
    });

    if (res.isConfirmed) {
      try {
        const data = await fetchApi(`/users/${id}`, { method: 'DELETE' });
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'Removed!', text: data.message, timer: 1400, showConfirmButton: false });
          loadUsers();
        } else {
          Swal.fire('Error', data.message || 'Failed to remove user', 'error');
        }
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to remove user', 'error');
      }
    }
  };

  // Role CRUD Handlers
  const handleOpenCreateRole = () => {
    setRoleModalMode('create');
    setActiveRoleId(null);
    setRoleFormData({ name: '', description: '', permissions: [] });
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (r: RoleItem) => {
    setRoleModalMode('edit');
    setActiveRoleId(r.id);
    const expanded = expandPermissions(r.permissions || []);
    setRoleFormData({
      name: r.name,
      description: r.description || '',
      permissions: expanded,
    });
    setIsRoleModalOpen(true);
  };

  // Role Modal Permission Toggle Helpers
  const handleRoleToggleKey = (key: string) => {
    if (roleFormData.permissions.includes(key)) {
      setRoleFormData({
        ...roleFormData,
        permissions: roleFormData.permissions.filter((k) => k !== key && k !== '*'),
      });
    } else {
      setRoleFormData({
        ...roleFormData,
        permissions: [...roleFormData.permissions.filter((k) => k !== '*'), key],
      });
    }
  };

  const handleRoleSelectAllGlobal = () => {
    setRoleFormData({ ...roleFormData, permissions: getAllMatrixKeys() });
  };

  const handleRoleDeselectAllGlobal = () => {
    setRoleFormData({ ...roleFormData, permissions: [] });
  };

  const handleRoleToggleModule = (modKeys: string[]) => {
    const allSelected = modKeys.every((k) => roleFormData.permissions.includes(k));
    if (allSelected) {
      setRoleFormData({
        ...roleFormData,
        permissions: roleFormData.permissions.filter((k) => !modKeys.includes(k) && k !== '*'),
      });
    } else {
      const set = new Set([...roleFormData.permissions.filter((k) => k !== '*'), ...modKeys]);
      setRoleFormData({ ...roleFormData, permissions: Array.from(set) });
    }
  };

  const handleSubmitRoleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRole(true);
    try {
      const path = roleModalMode === 'create' ? '/roles' : `/roles/${activeRoleId}`;
      const method = roleModalMode === 'create' ? 'POST' : 'PUT';

      const data = await fetchApi(path, {
        method,
        body: JSON.stringify(roleFormData),
      });

      if (data.success) {
        setIsRoleModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: roleModalMode === 'create' ? 'Role Created!' : 'Role Updated!',
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        loadRolesAndMatrix();
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Role operation failed.' });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Operation failed.' });
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    if (role.is_system) {
      Swal.fire('Restricted', 'System default roles cannot be deleted.', 'info');
      return;
    }
    const res = await Swal.fire({
      title: `Delete Role "${role.name}"?`,
      text: 'Are you sure you want to remove this role?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Delete Role',
    });

    if (res.isConfirmed) {
      try {
        const data = await fetchApi(`/roles/${role.id}`, { method: 'DELETE' });
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'Deleted!', text: data.message, timer: 1400, showConfirmButton: false });
          loadRolesAndMatrix();
        } else {
          Swal.fire('Error', data.message || 'Failed to delete role', 'error');
        }
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to delete role', 'error');
      }
    }
  };

  // Department CRUD Handlers
  const handleOpenCreateDept = () => {
    setDeptModalMode('create');
    setActiveDeptId(null);
    setDeptFormData({ name: '', code: '', description: '', is_active: true });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (d: DepartmentItem) => {
    setDeptModalMode('edit');
    setActiveDeptId(d.id);
    setDeptFormData({
      name: d.name,
      code: d.code || '',
      description: d.description || '',
      is_active: d.is_active ?? true,
    });
    setIsDeptModalOpen(true);
  };

  const handleSubmitDeptForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDept(true);
    try {
      const path = deptModalMode === 'create' ? '/departments' : `/departments/${activeDeptId}`;
      const method = deptModalMode === 'create' ? 'POST' : 'PUT';

      const data = await fetchApi(path, {
        method,
        body: JSON.stringify(deptFormData),
      });

      if (data.success) {
        setIsDeptModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: deptModalMode === 'create' ? 'Department Created!' : 'Department Updated!',
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        loadDepartments();
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Department operation failed.' });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Operation failed.' });
    } finally {
      setSubmittingDept(false);
    }
  };

  const handleDeleteDept = async (dept: DepartmentItem) => {
    const res = await Swal.fire({
      title: `Delete Department "${dept.name}"?`,
      text: 'Are you sure you want to remove this department?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Delete Department',
    });

    if (res.isConfirmed) {
      try {
        const data = await fetchApi(`/departments/${dept.id}`, { method: 'DELETE' });
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'Deleted!', text: data.message, timer: 1400, showConfirmButton: false });
          loadDepartments();
        } else {
          Swal.fire('Error', data.message || 'Failed to delete department', 'error');
        }
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to delete department', 'error');
      }
    }
  };

  // Granular Permissions Handlers (User Modal)
  const handleOpenPermModal = (u: UserItem) => {
    setPermTargetUser(u);
    const raw = u.permissions || (u.role_model?.permissions) || [];
    const expanded = expandPermissions(raw);
    setSelectedPermissions(expanded);
    setIsPermModalOpen(true);
  };

  const handleTogglePermKey = (key: string) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter((k) => k !== key && k !== '*'));
    } else {
      setSelectedPermissions([...selectedPermissions.filter((k) => k !== '*'), key]);
    }
  };

  const handleUserSelectAllGlobal = () => {
    setSelectedPermissions(getAllMatrixKeys());
  };

  const handleUserDeselectAllGlobal = () => {
    setSelectedPermissions([]);
  };

  const handleUserToggleModule = (modKeys: string[]) => {
    const allSelected = modKeys.every((k) => selectedPermissions.includes(k));
    if (allSelected) {
      setSelectedPermissions(selectedPermissions.filter((k) => !modKeys.includes(k) && k !== '*'));
    } else {
      const set = new Set([...selectedPermissions.filter((k) => k !== '*'), ...modKeys]);
      setSelectedPermissions(Array.from(set));
    }
  };

  const handleApplyRolePresetInPermModal = (roleName: string) => {
    const matchedRole = roles.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
    if (matchedRole) {
      const expanded = expandPermissions(matchedRole.permissions || []);
      setSelectedPermissions(expanded);
    }
  };

  const handleSavePermissions = async () => {
    if (!permTargetUser) return;
    setSavingPermissions(true);
    try {
      const data = await fetchApi(`/users/${permTargetUser.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: selectedPermissions }),
      });

      if (data.success) {
        setIsPermModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: 'Permissions Updated!',
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        loadUsers();
      } else {
        Swal.fire('Error', data.message || 'Failed to save permissions', 'error');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to save permissions', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  if (canManageUsers === false) {
    return <AccessDenied moduleName="User Management & Access Governance" requiredPermission="users.manage" />;
  }

  return (
    <div className="flex h-screen bg-[#FAF8F5] overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0 overflow-hidden">
        <Navbar title="User & Permissions Management" />

        {/* Header Action Bar */}
        <div className="bg-white border-b border-[#E8E2D9] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#081428] text-[#C9A84C] flex items-center justify-center font-bold shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg text-[#081428]">Team & Access Governance</h1>
              <p className="text-xs text-slate-500">
                Manage accounts, auto-lead distribution switches, dynamic roles, and departments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'users' && (
              <button
                onClick={handleOpenCreateUser}
                className="px-4 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Team Member</span>
              </button>
            )}

            {activeTab === 'roles' && (
              <button
                onClick={handleOpenCreateRole}
                className="px-4 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create New Role</span>
              </button>
            )}

            {activeTab === 'departments' && (
              <button
                onClick={handleOpenCreateDept}
                className="px-4 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Department</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Stats Cards */}
        <div className="bg-white border-b border-[#E8E2D9] px-6 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#081428]/10 text-[#081428] flex items-center justify-center font-bold">
              <Users className="w-4 h-4 text-[#C9A84C]" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Total Members</span>
              <span className="font-bold text-base text-[#081428]">{stats.total || users.length}</span>
            </div>
          </div>

          <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Active Accounts</span>
              <span className="font-bold text-base text-emerald-700">{stats.active || users.filter(u => u.is_active).length}</span>
            </div>
          </div>

          <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Configured Roles</span>
              <span className="font-bold text-base text-indigo-900">{roles.length} Roles</span>
            </div>
          </div>

          <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Departments</span>
              <span className="font-bold text-base text-purple-900">{departments.length} Depts</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-[#E8E2D9] px-6 flex items-center gap-2 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-[#C9A84C] text-[#081428]'
                : 'border-transparent text-slate-500 hover:text-[#081428]'
            }`}
          >
            <Users className="w-4 h-4 text-[#C9A84C]" />
            <span>Team Members ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'roles'
                ? 'border-[#C9A84C] text-[#081428]'
                : 'border-transparent text-slate-500 hover:text-[#081428]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#C9A84C]" />
            <span>Roles & Permissions Matrix ({roles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'departments'
                ? 'border-[#C9A84C] text-[#081428]'
                : 'border-transparent text-slate-500 hover:text-[#081428]'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#C9A84C]" />
            <span>Departments CRUD ({departments.length})</span>
          </button>
        </div>

        {/* TAB 1: TEAM MEMBERS LIST */}
        {activeTab === 'users' ? (
          <>
            {/* Filter Bar */}
            <div className="bg-white border-b border-[#E8E2D9] px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user name, email, phone, role..."
                  className="w-full pl-9 pr-3 py-1.5 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-3 py-1.5 border border-[#E8E2D9] rounded-md bg-white font-semibold cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.slug} value={r.name}>{r.name}</option>
                  ))}
                </select>

                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-3 py-1.5 border border-[#E8E2D9] rounded-md bg-white font-semibold cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="flex-1 overflow-auto p-6 bg-[#FAF8F5]">
              <div className="bg-white rounded-xl border border-[#E8E2D9] shadow-2xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#081428] text-white text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Role & Permissions</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4 text-center">Auto-Lead Switch</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2D9] text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#C9A84C]" />
                          Loading team directory...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                          No team members found matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isSuperAdmin = u.role?.toLowerCase() === 'super admin' || u.id === 1;
                        const inPool = u.in_distribution_pool ?? true;

                        return (
                          <tr key={u.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-[#081428]">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#081428] text-[#C9A84C] font-bold text-xs flex items-center justify-center border border-[#C9A84C]/30">
                                  {u.initials || u.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-[#081428]">{u.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: #{u.id}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-block px-2.5 py-0.5 rounded font-bold text-[11px] bg-[#081428] text-[#C9A84C]">
                                {u.role || 'Advisor'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-medium text-slate-700">
                              {u.department || 'Sales'}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              <div>{u.email}</div>
                              {u.phone && <div className="text-[11px] text-slate-400">{u.phone}</div>}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {inPool ? (
                                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200" title="Participates in Round-Robin, 3-day & 45-day rules">
                                  ✓ Auto-Assign ON
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300" title="Reviewer/Auditor mode: Excluded from auto-assignment">
                                  ✕ Auto-Assign OFF
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {u.is_active ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  Inactive
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenPermModal(u)}
                                  className="p-1.5 bg-slate-100 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-600 rounded transition-colors cursor-pointer"
                                  title="Manage Permissions Matrix"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 bg-slate-100 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-600 rounded transition-colors cursor-pointer"
                                  title="Edit Member Profile & Distribution Switch"
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
            </div>
          </>
        ) : activeTab === 'roles' ? (
          /* TAB 2: DYNAMIC ROLES & PERMISSION MATRIX */
          <div className="flex-1 overflow-auto p-6 space-y-6 bg-[#FAF8F5]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-[#081428]">Configured System & Custom Roles</h2>
                <p className="text-xs text-slate-500">Add, edit, or delete dynamic user roles with custom permission profiles</p>
              </div>
              <button
                onClick={handleOpenCreateRole}
                className="px-3.5 py-1.5 bg-[#C9A84C] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Custom Role</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roles.map((r) => {
                const isAll = r.permissions.includes('*');
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-[#E8E2D9] p-5 shadow-2xs space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#081428] text-[#C9A84C]">
                        {r.slug}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">
                          {r.users_count ?? 0} Users
                        </span>
                        <button
                          onClick={() => handleOpenEditRole(r)}
                          className="p-1 text-slate-400 hover:text-[#081428] transition-colors cursor-pointer"
                          title="Edit Role & Permissions"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!r.is_system && (
                          <button
                            onClick={() => handleDeleteRole(r)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#081428]">{r.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {r.description || 'Custom company role.'}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-[#E8E2D9] flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-600">
                        {isAll ? 'Full Access (*)' : `${r.permissions.length} Permissions`}
                      </span>
                      <span className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded ${r.is_system ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                        {r.is_system ? 'System Default' : 'Custom Role'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* TAB 3: DYNAMIC DEPARTMENTS CRUD */
          <div className="flex-1 overflow-auto p-6 space-y-6 bg-[#FAF8F5]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-[#081428]">Company Departments</h2>
                <p className="text-xs text-slate-500">Manage company operational departments and team structures</p>
              </div>
              <button
                onClick={handleOpenCreateDept}
                className="px-3.5 py-1.5 bg-[#C9A84C] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Department</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departments.map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-[#E8E2D9] p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                      {d.code || 'DEPT'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500 mr-1">
                        {d.users_count ?? 0} Members
                      </span>
                      <button
                        onClick={() => handleOpenEditDept(d)}
                        className="p-1 text-slate-400 hover:text-[#081428] transition-colors cursor-pointer"
                        title="Edit Department"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(d)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-[#081428]">{d.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {d.description || 'Company operational department.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#E8E2D9] flex items-center justify-between text-xs">
                    <span className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded ${d.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* USER CREATE / EDIT MODAL */}
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
                  placeholder="e.g. Faraz Shafi"
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
                    placeholder="e.g. faraz@fsadvisory.ae"
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
                      <option key={r.id} value={r.name}>{r.name}</option>
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
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                    <option value="Sales">Sales</option>
                    <option value="Telesales">Telesales</option>
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

              {/* Status & Auto-Lead Distribution Switch Section */}
              <div className="pt-3 border-t border-[#E8E2D9] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.is_active}
                      onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                      className="accent-[#C9A84C] rounded w-4 h-4"
                    />
                    <span className="font-bold text-slate-800 text-xs">Active CRM Account</span>
                  </label>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="auto_dist_switch"
                    checked={userFormData.in_distribution_pool}
                    onChange={(e) => setUserFormData({ ...userFormData, in_distribution_pool: e.target.checked })}
                    className="accent-[#C9A84C] rounded w-4 h-4 mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="auto_dist_switch" className="cursor-pointer">
                    <span className="font-bold text-[#081428] block text-xs">
                      Include in Auto-Lead Distribution (Round-Robin & 3-Day/45-Day Rules)
                    </span>
                    <span className="text-[10px] text-slate-600 block mt-0.5 leading-tight">
                      Turn ON for working sales agents to receive automatic leads. Turn OFF for reviewers, auditors, or executives so zero leads get assigned to them.
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E8E2D9]">
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
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC ROLE CREATE / EDIT MODAL */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#C9A84C]" />
                <h2 className="font-heading font-bold text-base">
                  {roleModalMode === 'create' ? 'Create Custom Role' : 'Edit Role Details'}
                </h2>
              </div>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRoleForm} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role Title Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  placeholder="e.g. Operations Coordinator"
                  className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-semibold text-[#081428]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Description</label>
                <textarea
                  value={roleFormData.description}
                  onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  placeholder="Responsibilities and permission overview..."
                  rows={2}
                  className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Module Permissions Checklist Header with Global Select All / Deselect All */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-bold text-[#081428] uppercase tracking-wider text-[11px]">
                    Module Permissions Preset ({roleFormData.permissions.length} Selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRoleSelectAllGlobal}
                      className="text-[11px] font-bold text-[#081428] hover:text-[#C9A84C] bg-white px-2.5 py-1 rounded border border-[#E8E2D9] cursor-pointer shadow-2xs"
                    >
                      ✓ Select All (All Modules)
                    </button>
                    <button
                      type="button"
                      onClick={handleRoleDeselectAllGlobal}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-white px-2.5 py-1 rounded border border-[#E8E2D9] cursor-pointer shadow-2xs"
                    >
                      ✕ Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto border border-[#E8E2D9] rounded-lg p-3 bg-[#FAF8F5]">
                  {permMatrix.map((mod) => {
                    const modKeys = mod.permissions.map((p) => p.key);
                    const allModSelected = modKeys.every((k) => roleFormData.permissions.includes(k));
                    const selectedCount = modKeys.filter((k) => roleFormData.permissions.includes(k)).length;

                    return (
                      <div key={mod.module} className="bg-white p-3 rounded-lg border border-[#E8E2D9] space-y-2">
                        <div className="flex items-center justify-between font-bold text-[#081428] text-xs border-b border-[#E8E2D9] pb-1.5">
                          <span className="uppercase tracking-wider font-extrabold">{mod.module}</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-[#C9A84C] font-mono font-bold">
                              {selectedCount} / {modKeys.length} Selected
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRoleToggleModule(modKeys)}
                              className="text-[10px] font-bold text-[#081428] hover:text-[#C9A84C] bg-[#FAF8F5] hover:bg-[#FAF5E8] px-2 py-0.5 rounded border border-[#E8E2D9] cursor-pointer transition-colors"
                            >
                              {allModSelected ? '✕ Deselect Module' : '✓ Select All Module'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {mod.permissions.map((p) => {
                            const checked = roleFormData.permissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                className={`p-2 rounded border transition-all cursor-pointer flex items-start gap-2 ${
                                  checked ? 'bg-[#FAF8F4] border-[#C9A84C]' : 'bg-white border-[#E8E2D9]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleRoleToggleKey(p.key)}
                                  className="accent-[#C9A84C] rounded mt-0.5 cursor-pointer"
                                />
                                <div>
                                  <div className="font-semibold text-slate-800 text-xs">{p.label}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{p.key}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E8E2D9]">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-3.5 py-1.5 border border-[#E8E2D9] rounded text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRole}
                  className="px-4 py-1.5 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded shadow-sm transition-all"
                >
                  {submittingRole ? 'Saving...' : roleModalMode === 'create' ? 'Create Role' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC DEPARTMENT CREATE / EDIT MODAL */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full max-w-md overflow-hidden animate-fade-in flex flex-col">
            <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#C9A84C]" />
                <h2 className="font-heading font-bold text-base">
                  {deptModalMode === 'create' ? 'Create Department' : 'Edit Department'}
                </h2>
              </div>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeptForm} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  placeholder="e.g. Off-Plan Advisory"
                  className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-semibold text-[#081428]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department Code</label>
                <input
                  type="text"
                  value={deptFormData.code}
                  onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value })}
                  placeholder="e.g. OFFPLAN"
                  className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={deptFormData.description}
                  onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  placeholder="Department scope and objectives..."
                  rows={2}
                  className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#E8E2D9]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deptFormData.is_active}
                    onChange={(e) => setDeptFormData({ ...deptFormData, is_active: e.target.checked })}
                    className="accent-[#C9A84C] rounded"
                  />
                  <span className="font-semibold text-slate-700">Active Status</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(false)}
                    className="px-3.5 py-1.5 border border-[#E8E2D9] rounded text-slate-600 hover:bg-slate-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDept}
                    className="px-4 py-1.5 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded shadow-sm transition-all"
                  >
                    {submittingDept ? 'Saving...' : deptModalMode === 'create' ? 'Create Department' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRANULAR PERMISSION MATRIX CHECKBOX MODAL (USER MODAL) */}
      {isPermModalOpen && permTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full max-w-4xl overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
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
                    Toggle individual permission checkboxes across all CRM modules or select all per section.
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

            {/* Global Controls & Preset Bar */}
            <div className="bg-[#FAF8F5] border-b border-[#E8E2D9] px-6 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Apply Role Preset:</span>
                <select
                  onChange={(e) => handleApplyRolePresetInPermModal(e.target.value)}
                  className="px-2.5 py-1 border border-[#E8E2D9] rounded bg-white font-semibold cursor-pointer text-xs"
                >
                  <option value="">Select Role Preset...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUserSelectAllGlobal}
                  className="text-[11px] font-bold text-[#081428] hover:text-[#C9A84C] bg-white px-2.5 py-1 rounded border border-[#E8E2D9] cursor-pointer shadow-2xs"
                >
                  ✓ Select All (All Modules)
                </button>
                <button
                  type="button"
                  onClick={handleUserDeselectAllGlobal}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-white px-2.5 py-1 rounded border border-[#E8E2D9] cursor-pointer shadow-2xs"
                >
                  ✕ Deselect All
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {permMatrix.map((mod) => {
                const modKeys = mod.permissions.map((p) => p.key);
                const allModSelected = modKeys.every((k) => selectedPermissions.includes(k));
                const selectedCount = modKeys.filter((k) => selectedPermissions.includes(k)).length;

                return (
                  <div key={mod.module} className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E8E2D9] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-2">
                      <strong className="text-xs text-[#081428] font-bold uppercase tracking-wider">{mod.module}</strong>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#C9A84C] font-bold">
                          {selectedCount} / {modKeys.length} Selected
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUserToggleModule(modKeys)}
                          className="text-[10px] font-bold text-[#081428] hover:text-[#C9A84C] bg-white px-2 py-0.5 rounded border border-[#E8E2D9] cursor-pointer transition-colors"
                        >
                          {allModSelected ? '✕ Deselect Module' : '✓ Select All Module'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {mod.permissions.map((p) => {
                        const checked = selectedPermissions.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                              checked ? 'bg-white border-[#C9A84C] shadow-2xs' : 'bg-white/60 border-[#E8E2D9]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleTogglePermKey(p.key)}
                              className="accent-[#C9A84C] rounded mt-0.5 cursor-pointer"
                            />
                            <div>
                              <div className="font-bold text-[#081428]">{p.label}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.key}</div>
                              <div className="text-[11px] text-slate-600 mt-0.5">{p.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

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
    </div>
  );
}
