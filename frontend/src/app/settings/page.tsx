'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi, API_BASE_URL } from '@/lib/api';
import { 
  Settings, Globe, Shield, Clock, Save, Layers, Building2, Plus, 
  Trash2, Edit2, Check, X, MapPin, Home, HardHat, Briefcase, Users, UserPlus, ShieldCheck, User, Search,
  ArrowLeft, ChevronRight, ChevronLeft, Zap, Play, Cpu, RefreshCw, CheckCircle2, AlertCircle, RotateCcw,
  Mail, Send, Lock, Server, Eye, EyeOff
} from 'lucide-react';
import Swal from 'sweetalert2';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const activeTab = selectedModule;

  useEffect(() => {
    const mod = searchParams.get('module') || searchParams.get('tab');
    setSelectedModule(mod || null);
  }, [searchParams]);

  const handleOpenModule = (modId: string) => {
    setSelectedModule(modId);
    router.push(`/settings?module=${modId}`);
  };

  const handleBackToHub = () => {
    setSelectedModule(null);
    router.push('/settings');
  };

  const [settings, setSettings] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [portals, setPortals] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [opportunityTypes, setOpportunityTypes] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 0. Team Members / Users State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState('Senior Property Advisor');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserActive, setEditUserActive] = useState(true);

  // 1. Lead Source State
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceIcon, setNewSourceIcon] = useState('🌐');
  const [newSubSourceInputs, setNewSubSourceInputs] = useState<Record<number, string>>({});
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [editSourceName, setEditSourceName] = useState('');
  const [editSourceIcon, setEditSourceIcon] = useState('');
  const [editingSubSourceId, setEditingSubSourceId] = useState<number | null>(null);
  const [editSubSourceName, setEditSubSourceName] = useState('');

  // 2. Developer State
  const [newDevName, setNewDevName] = useState('');
  const [editingDevId, setEditingDevId] = useState<number | null>(null);
  const [editDevName, setEditDevName] = useState('');

  // 3. Project State
  const [newProjName, setNewProjName] = useState('');
  const [newProjDev, setNewProjDev] = useState('');
  const [newProjComm, setNewProjComm] = useState('');
  const [editingProjId, setEditingProjId] = useState<number | null>(null);
  const [editProjName, setEditProjName] = useState('');
  const [searchProj, setSearchProj] = useState('');
  const [searchDev, setSearchDev] = useState('');

  // 4. Property Type State
  const [newPropName, setNewPropName] = useState('');
  const [editingPropId, setEditingPropId] = useState<number | null>(null);
  const [editPropName, setEditPropName] = useState('');

  // 5. Community State
  const [newCommName, setNewCommName] = useState('');
  const [editingCommId, setEditingCommId] = useState<number | null>(null);
  const [editCommName, setEditCommName] = useState('');

  // 6. Opportunity Types State
  const [newOppTypeName, setNewOppTypeName] = useState('');
  const [newOppTypeIcon, setNewOppTypeIcon] = useState('💼');
  const [editingOppTypeId, setEditingOppTypeId] = useState<number | null>(null);
  const [editOppTypeName, setEditOppTypeName] = useState('');
  const [editOppTypeIcon, setEditOppTypeIcon] = useState('');

  // 7. Lead Distribution & Automation State
  const [distSettings, setDistSettings] = useState<any>({
    is_enabled: true,
    distribution_mode: 'round_robin',
    apply_to_lead_pool: true,
    apply_to_owner_data: true,
    max_daily_leads_per_agent: 20,
    fallback_user_name: 'Faraz Shafi',
  });
  const [distAgents, setDistAgents] = useState<any[]>([]);
  const [unassignedLeadsCount, setUnassignedLeadsCount] = useState<number>(0);
  const [unassignedOwnersCount, setUnassignedOwnersCount] = useState<number>(0);
  const [distLogs, setDistLogs] = useState<any[]>([]);
  const [distLogsPage, setDistLogsPage] = useState<number>(1);
  const [distLogsPerPage, setDistLogsPerPage] = useState<number>(10);
  const [distLogsPagination, setDistLogsPagination] = useState<any>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
    from: 0,
    to: 0,
  });
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [savingDist, setSavingDist] = useState<boolean>(false);
  const [runningBatch, setRunningBatch] = useState<boolean>(false);

  // 8. Email & SMTP Configuration State
  const [emailSettings, setEmailSettings] = useState<any>({
    mail_mailer: 'smtp',
    mail_host: '',
    mail_port: 587,
    mail_username: '',
    mail_password: '',
    mail_encryption: 'tls',
    mail_from_address: 'advisory@fsadvisory.ae',
    mail_from_name: 'FS Advisory Luxury Real Estate',
    default_domain: 'fsadvisory.ae',
    is_active: true,
  });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const fetchDistLogs = async (page = 1, perPage = distLogsPerPage) => {
    try {
      setLoadingLogs(true);
      const res = await fetchApi(`/distribution/logs?page=${page}&per_page=${perPage}`);
      if (res && res.success) {
        setDistLogs(res.logs || []);
        if (res.pagination) {
          setDistLogsPagination(res.pagination);
          setDistLogsPage(res.pagination.current_page);
        }
      }
    } catch (e) {
      console.error('Failed to load distribution logs', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, pData, lsData, devData, projData, propData, commData, oppTypesData, uData, distData, emailData] = await Promise.all([
        fetchApi('/settings'),
        fetchApi('/portals'),
        fetchApi('/lead-sources'),
        fetchApi('/catalog/developers'),
        fetchApi('/catalog/projects'),
        fetchApi('/catalog/properties'),
        fetchApi('/catalog/communities'),
        fetchApi('/catalog/opportunity-types'),
        fetchApi('/users'),
        fetchApi('/distribution/settings').catch(() => null),
        fetchApi('/settings/email').catch(() => null),
      ]);
      setSettings(sData);
      setPortals(pData || []);
      setLeadSources(lsData || []);
      setDevelopers(devData || []);
      setProjects(projData || []);
      setPropertyTypes(propData || []);
      setCommunities(commData || []);
      setOpportunityTypes(oppTypesData || []);
      const userList = Array.isArray(uData) ? uData : (uData?.users || []);
      setUsers(userList);

      if (distData) {
        setDistSettings(distData.settings || {});
        setDistAgents(distData.agents || []);
        setUnassignedLeadsCount(distData.unassigned_leads_count || 0);
        setUnassignedOwnersCount(distData.unassigned_owners_count || 0);
        setDistLogs(distData.recent_logs || []);
        if (distData.pagination) {
          setDistLogsPagination(distData.pagination);
          setDistLogsPage(distData.pagination.current_page);
        }
      }

      if (emailData && emailData.success && emailData.settings) {
        setEmailSettings(emailData.settings);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load settings catalog data:', err);
      setLoading(false);
    }
  };

  const handleSaveEmailSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingEmail(true);
    setTestEmailFeedback(null);
    try {
      const res = await fetchApi('/settings/email', {
        method: 'POST',
        body: JSON.stringify(emailSettings),
      });
      if (res && res.success) {
        setEmailSettings(res.settings);
        Swal.fire({
          icon: 'success',
          title: 'Email Settings Saved',
          text: 'Corporate SMTP settings and domain defaults updated successfully.',
          timer: 1800,
          showConfirmButton: false,
        });
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to save email settings', 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailRecipient.trim()) {
      Swal.fire('Recipient Missing', 'Please enter a target email address to receive the test verification email.', 'warning');
      return;
    }
    setTestingEmail(true);
    setTestEmailFeedback(null);
    try {
      const res = await fetchApi('/settings/email/test', {
        method: 'POST',
        body: JSON.stringify({ test_email: testEmailRecipient.trim() }),
      });
      if (res && res.success) {
        setTestEmailFeedback({ success: true, message: res.message || 'Test email dispatched successfully!' });
        Swal.fire({
          icon: 'success',
          title: 'Test Email Sent!',
          text: `Verification email delivered to ${testEmailRecipient}`,
          timer: 2500,
          showConfirmButton: false,
        });
      } else {
        setTestEmailFeedback({ success: false, message: res.message || 'Test email delivery failed.' });
        Swal.fire('Delivery Issue', res.message || 'Could not verify delivery', 'error');
      }
    } catch (err: any) {
      const errMsg = err.message || 'SMTP Connection Error';
      setTestEmailFeedback({ success: false, message: errMsg });
      Swal.fire('SMTP Error', errMsg, 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveDistSettings = async () => {
    setSavingDist(true);
    try {
      await fetchApi('/distribution/settings', {
        method: 'PUT',
        body: JSON.stringify(distSettings),
      });
      Swal.fire({
        icon: 'success',
        title: 'Rules Saved!',
        text: 'Lead Distribution rules updated successfully.',
        timer: 1600,
        showConfirmButton: false,
      });
      loadData();
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Failed to save rules', 'error');
    } finally {
      setSavingDist(false);
    }
  };

  const handleToggleAgentPool = async (agentId: number) => {
    try {
      const res = await fetchApi(`/distribution/agent/${agentId}/toggle`, { method: 'POST' });
      setDistAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, in_distribution_pool: res.in_distribution_pool } : a))
      );
    } catch (e: any) {
      alert(e.message || 'Failed to toggle agent');
    }
  };

  const handleSaveAgentConfig = async (agentId: number, config: any) => {
    try {
      await fetchApi(`/distribution/agent/${agentId}/config`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
      Swal.fire({
        icon: 'success',
        title: 'Agent Updated',
        text: 'Agent capacity and weight saved.',
        timer: 1400,
        showConfirmButton: false,
      });
      loadData();
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Failed to update agent', 'error');
    }
  };

  const handleRunLeadPoolBatch = async () => {
    setRunningBatch(true);
    try {
      const res = await fetchApi('/distribution/run/lead-pool', { method: 'POST' });
      Swal.fire({
        icon: 'success',
        title: 'Leads Auto-Distributed!',
        text: res.message || `Successfully distributed ${res.assigned_count} leads.`,
      });
      loadData();
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Distribution failed', 'error');
    } finally {
      setRunningBatch(false);
    }
  };

  const handleRunOwnerDataBatch = async () => {
    setRunningBatch(true);
    try {
      const res = await fetchApi('/distribution/run/owner-data', { method: 'POST' });
      Swal.fire({
        icon: 'success',
        title: 'Owners Auto-Distributed!',
        text: res.message || `Successfully distributed ${res.assigned_count} owner records.`,
      });
      loadData();
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Distribution failed', 'error');
    } finally {
      setRunningBatch(false);
    }
  };

  const [resettingCounters, setResettingCounters] = useState<boolean>(false);

  const handleResetCounters = async () => {
    Swal.fire({
      title: "Reset Today's Counts?",
      text: 'This will reset the "Assigned Today" lead counter back to 0 for all active sales advisors so they can receive fresh daily allocations.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#081428',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Reset to 0',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setResettingCounters(true);
        try {
          const res = await fetchApi('/distribution/reset-counters', { method: 'POST' });
          Swal.fire({
            icon: 'success',
            title: 'Counters Reset!',
            text: res.message || 'Daily lead counters reset to 0.',
            timer: 1500,
            showConfirmButton: false,
          });
          loadData();
        } catch (e: any) {
          Swal.fire('Error', e.message || 'Failed to reset counters', 'error');
        } finally {
          setResettingCounters(false);
        }
      }
    });
  };

  const [clearingLogs, setClearingLogs] = useState<boolean>(false);

  const handleClearLogs = async () => {
    Swal.fire({
      title: 'Clear Distribution Logs?',
      text: 'This will purge all recent auto-assignment activity logs from the audit table.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Clear All Logs',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setClearingLogs(true);
        try {
          const res = await fetchApi('/distribution/logs', { method: 'DELETE' });
          Swal.fire({
            icon: 'success',
            title: 'Logs Cleared!',
            text: res.message || 'Audit logs have been cleared.',
            timer: 1500,
            showConfirmButton: false,
          });
          setDistLogs([]);
          setDistLogsPagination({
            current_page: 1,
            last_page: 1,
            per_page: distLogsPerPage,
            total: 0,
            from: 0,
            to: 0,
          });
          setDistLogsPage(1);
        } catch (e: any) {
          Swal.fire('Error', e.message || 'Failed to clear logs', 'error');
        } finally {
          setClearingLogs(false);
        }
      }
    });
  };

  // Team & Agents CRUD
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      Swal.fire('Required Fields', 'Please enter Agent Name and Email Address.', 'warning');
      return;
    }

    try {
      await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          phone: newUserPhone,
          role: newUserRole,
          is_active: true,
        }),
      });

      Swal.fire({
        icon: 'success',
        title: 'Team Member Created!',
        text: `${newUserName} added to the team.`,
        timer: 1800,
        showConfirmButton: false,
      });

      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setShowAddUserModal(false);
      loadData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to create team member.', 'error');
    }
  };

  const handleUpdateUser = async (id: number) => {
    if (!editUserName.trim() || !editUserEmail.trim()) return;
    try {
      await fetchApi(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editUserName,
          email: editUserEmail,
          phone: editUserPhone,
          role: editUserRole,
          is_active: editUserActive,
        }),
      });

      Swal.fire({
        icon: 'success',
        title: 'Agent Updated',
        text: 'Agent details updated successfully.',
        timer: 1500,
        showConfirmButton: false,
      });

      setEditingUserId(null);
      loadData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to update agent.', 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    Swal.fire({
      title: 'Remove Team Member?',
      text: 'Are you sure you want to remove this agent from the team?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Remove Agent',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await fetchApi(`/users/${id}`, { method: 'DELETE' });
          Swal.fire('Removed', 'Agent removed successfully.', 'info');
          loadData();
        } catch (err: any) {
          Swal.fire('Error', err.message || 'Failed to delete agent.', 'error');
        }
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi('/settings', { method: 'POST' });
      alert('System Settings saved successfully!');
      setSaving(false);
    } catch (err) {
      alert('Save failed');
      setSaving(false);
    }
  };

  // Lead Source CRUD
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    try {
      await fetchApi('/lead-sources', {
        method: 'POST',
        body: JSON.stringify({ name: newSourceName, icon: newSourceIcon || '🌐' }),
      });
      setNewSourceName('');
      setShowAddSourceModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add source');
    }
  };

  const handleUpdateSource = async (id: number) => {
    if (!editSourceName.trim()) return;
    try {
      await fetchApi(`/lead-sources/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editSourceName, icon: editSourceIcon }),
      });
      setEditingSourceId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update source');
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!confirm('Delete lead source and its sub-sources?')) return;
    try {
      await fetchApi(`/lead-sources/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete source');
    }
  };

  const handleAddSubSource = async (sourceId: number) => {
    const subName = newSubSourceInputs[sourceId];
    if (!subName || !subName.trim()) return;
    try {
      await fetchApi(`/lead-sources/${sourceId}/sub-sources`, {
        method: 'POST',
        body: JSON.stringify({ name: subName }),
      });
      setNewSubSourceInputs((prev) => ({ ...prev, [sourceId]: '' }));
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add sub-source');
    }
  };

  const handleUpdateSubSource = async (id: number) => {
    if (!editSubSourceName.trim()) return;
    try {
      await fetchApi(`/lead-sub-sources/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editSubSourceName }),
      });
      setEditingSubSourceId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update sub-source');
    }
  };

  const handleDeleteSubSource = async (id: number) => {
    if (!confirm('Delete this sub-source?')) return;
    try {
      await fetchApi(`/lead-sub-sources/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete sub-source');
    }
  };

  // Developer CRUD
  const handleAddDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName.trim()) return;
    try {
      await fetchApi('/catalog/developers', {
        method: 'POST',
        body: JSON.stringify({ name: newDevName }),
      });
      setNewDevName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add developer');
    }
  };

  const handleUpdateDeveloper = async (id: number) => {
    if (!editDevName.trim()) return;
    try {
      await fetchApi(`/catalog/developers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editDevName }),
      });
      setEditingDevId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update developer');
    }
  };

  const handleDeleteDeveloper = async (id: number) => {
    if (!confirm('Delete this developer?')) return;
    try {
      await fetchApi(`/catalog/developers/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete developer');
    }
  };

  // Project CRUD
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    try {
      await fetchApi('/catalog/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjName,
          developer_name: newProjDev,
          community_name: newProjComm,
        }),
      });
      setNewProjName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add project');
    }
  };

  const handleUpdateProject = async (id: number) => {
    if (!editProjName.trim()) return;
    try {
      await fetchApi(`/catalog/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editProjName }),
      });
      setEditingProjId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update project');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Delete this project?')) return;
    try {
      await fetchApi(`/catalog/projects/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    }
  };

  // Property Type CRUD
  const handleAddPropertyType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropName.trim()) return;
    try {
      await fetchApi('/catalog/properties', {
        method: 'POST',
        body: JSON.stringify({ name: newPropName }),
      });
      setNewPropName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add property unit');
    }
  };

  const handleUpdatePropertyType = async (id: number) => {
    if (!editPropName.trim()) return;
    try {
      await fetchApi(`/catalog/properties/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editPropName }),
      });
      setEditingPropId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update property unit');
    }
  };

  const handleDeletePropertyType = async (id: number) => {
    if (!confirm('Delete this property unit?')) return;
    try {
      await fetchApi(`/catalog/properties/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete property unit');
    }
  };

  // Community CRUD
  const handleAddCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommName.trim()) return;
    try {
      await fetchApi('/catalog/communities', {
        method: 'POST',
        body: JSON.stringify({ name: newCommName }),
      });
      setNewCommName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add community');
    }
  };

  const handleUpdateCommunity = async (id: number) => {
    if (!editCommName.trim()) return;
    try {
      await fetchApi(`/catalog/communities/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editCommName }),
      });
      setEditingCommId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update community');
    }
  };

  const handleDeleteCommunity = async (id: number) => {
    if (!confirm('Delete this community?')) return;
    try {
      await fetchApi(`/catalog/communities/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete community');
    }
  };

  // Opportunity Types CRUD
  const handleAddOpportunityType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOppTypeName.trim()) return;
    try {
      await fetchApi('/catalog/opportunity-types', {
        method: 'POST',
        body: JSON.stringify({ name: newOppTypeName, icon: newOppTypeIcon }),
      });
      setNewOppTypeName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add opportunity type');
    }
  };

  const handleUpdateOpportunityType = async (id: number) => {
    if (!editOppTypeName.trim()) return;
    try {
      await fetchApi(`/catalog/opportunity-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editOppTypeName, icon: editOppTypeIcon }),
      });
      setEditingOppTypeId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update opportunity type');
    }
  };

  const handleDeleteOpportunityType = async (id: number) => {
    if (!confirm('Delete this opportunity type?')) return;
    try {
      await fetchApi(`/catalog/opportunity-types/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete opportunity type');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <Settings className="w-4 h-4" />
                <span>Administration & Governance</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                CRM System Master Settings
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Manage Master Catalogs (Developers, Projects, Properties, Communities, Sources) and System Governance.
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>

          {/* ================= VIEW 1: MASTER CATALOGS CARDS HUB (When no module is selected) ================= */}
          {!selectedModule ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-widest text-[#8A9AB5] uppercase">
                    Master System Catalogs
                  </span>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Select any catalog card below to open its dedicated full management page.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    id: 'users',
                    title: 'Team & Agents',
                    count: `${users.length} Members`,
                    icon: Users,
                    description: 'Sales advisors, designations, contact numbers, and lead routing eligibility.',
                    badge: 'Staff',
                  },
                  {
                    id: 'sources',
                    title: 'Lead Sources',
                    count: `${leadSources.length} Channels`,
                    icon: Layers,
                    description: 'Inbound advertising channels, social campaigns, portals and sub-sources.',
                    badge: 'Marketing',
                  },
                  {
                    id: 'developers',
                    title: 'Master Developers',
                    count: `${developers.length} Developers`,
                    icon: HardHat,
                    description: 'Emaar, Nakheel, Damac, Sobha, Meraas and top Dubai property developers.',
                    badge: 'Registry',
                  },
                  {
                    id: 'projects',
                    title: 'Projects & Launches',
                    count: `${projects.length} Projects`,
                    icon: Building2,
                    description: 'Master towers, off-plan developments, locations, and developer associations.',
                    badge: 'Off-Plan',
                  },
                  {
                    id: 'properties',
                    title: 'Property & Unit Types',
                    count: `${propertyTypes.length} Types`,
                    icon: Home,
                    description: 'Apartments, penthouses, luxury villas, townhouses, and commercial units.',
                    badge: 'Inventory',
                  },
                  {
                    id: 'communities',
                    title: 'Communities & Areas',
                    count: `${communities.length} Communities`,
                    icon: MapPin,
                    description: 'Downtown Dubai, Palm Jumeirah, Dubai Marina, Business Bay master areas.',
                    badge: 'Locations',
                  },
                  {
                    id: 'opp_types',
                    title: 'Opportunity Types',
                    count: `${opportunityTypes.length} Types`,
                    icon: Briefcase,
                    description: 'Off-Plan Sales, Secondary Resale, Luxury Buy, and Commercial Lease stages.',
                    badge: 'Pipeline',
                  },
                  {
                    id: 'portals',
                    title: 'Portals Webhooks',
                    count: `${portals.length} Portals`,
                    icon: Globe,
                    description: 'Automated webhook sync for Property Finder, Bayut, and Dubizzle leads.',
                    badge: 'API Sync',
                  },
                  {
                    id: 'sla',
                    title: 'SLA Governance',
                    count: 'Enforced',
                    icon: Clock,
                    description: 'Speed-to-lead response timers, overdue alarms & team escalation rules.',
                    badge: 'Policies',
                  },
                  {
                    id: 'distribution',
                    title: 'Lead Distribution & Automation',
                    count: distSettings.is_enabled
                      ? (distSettings.distribution_mode === 'round_robin' ? 'Active (Round Robin)' : distSettings.distribution_mode === 'load_balanced' ? 'Active (Load Balanced)' : 'Active (Weighted)')
                      : 'Disabled',
                    icon: Zap,
                    description: 'Dynamic automated lead routing for Lead Pool & Owner Data across active sales advisors.',
                    badge: 'Automation',
                  },
                  {
                    id: 'email',
                    title: 'Email & SMTP Server',
                    count: emailSettings?.mail_host ? `${emailSettings.mail_host}:${emailSettings.mail_port}` : 'Configured',
                    icon: Mail,
                    description: 'Corporate SMTP relay (@fsadvisory.ae), SSL/TLS ports, credentials and instant connection tester.',
                    badge: 'Email',
                  },
                ].map((card) => {
                  const Icon = card.icon;

                  return (
                    <div
                      key={card.id}
                      onClick={() => handleOpenModule(card.id)}
                      className="group relative p-6 bg-white border border-[#E8E2D9] hover:border-[#C9A84C] rounded-2xl shadow-2xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between hover:translate-y-[-2px]"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 rounded-xl bg-[#081428] text-[#C9A84C] flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                            <Icon className="w-6 h-6" />
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-[#FAF8F5] text-[#081428] border border-[#E8E2D9]">
                            {card.count}
                          </span>
                        </div>

                        <h3 className="font-heading font-bold text-lg text-[#081428] mb-1.5 group-hover:text-[#C9A84C] transition-colors">
                          {card.title}
                        </h3>

                        <p className="text-xs text-slate-500 leading-relaxed mb-4">
                          {card.description}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#081428] group-hover:text-[#C9A84C] transition-colors">
                        <span className="flex items-center gap-1">
                          Open {card.badge} Page
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#C9A84C] group-hover:translate-x-1.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================= VIEW 2: DEDICATED SEPARATE MODULE PAGE ================= */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Navigation Bar with Back Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 border border-[#E8E4DC] rounded-xl shadow-2xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToHub}
                    className="px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#081428] border border-[#E8E4DC] hover:border-[#081428] text-[#081428] hover:text-[#C9A84C] font-bold text-xs rounded-lg flex items-center gap-2 transition-all shadow-2xs cursor-pointer group"
                    title="Back to All Settings Cards"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>Back to Settings Hub</span>
                  </button>

                  <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]">
                      Settings / Catalog
                    </div>
                    <h2 className="font-heading font-bold text-lg text-[#081428] flex items-center gap-2">
                      <span>
                        {selectedModule === 'users' && '👥 Team Members & Sales Advisors'}
                        {selectedModule === 'sources' && '🌐 Lead Sources & Campaign Sub-Sources'}
                        {selectedModule === 'developers' && '🏗️ Master Real Estate Developers'}
                        {selectedModule === 'projects' && '🏢 Projects & Off-Plan Developments'}
                        {selectedModule === 'properties' && '🏠 Property & Unit Classifications'}
                        {selectedModule === 'communities' && '📍 Dubai Communities & Master Localities'}
                        {selectedModule === 'opp_types' && '💼 Opportunity & Deal Types'}
                        {selectedModule === 'portals' && '🔌 Property Portals Webhook Sync'}
                        {selectedModule === 'sla' && '⏱️ SLA Response & Escalation Governance'}
                        {selectedModule === 'distribution' && '⚡ Lead Distribution & Dynamic Auto-Assignment'}
                        {selectedModule === 'email' && '✉️ Corporate Email & SMTP Server Configuration'}
                      </span>
                    </h2>
                  </div>
                </div>

                {/* Jump to Another Module Dropdown */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold hidden md:inline">Switch Catalog:</span>
                  <select
                    value={selectedModule}
                    onChange={(e) => handleOpenModule(e.target.value)}
                    className="p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg font-bold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] cursor-pointer"
                  >
                    <option value="users">👥 Team & Agents</option>
                    <option value="sources">🌐 Lead Sources</option>
                    <option value="developers">🏗️ Master Developers</option>
                    <option value="projects">🏢 Projects & Launches</option>
                    <option value="properties">🏠 Property & Unit Types</option>
                    <option value="communities">📍 Communities & Areas</option>
                    <option value="opp_types">💼 Opportunity Types</option>
                    <option value="portals">🔌 Portals Webhooks</option>
                    <option value="sla">⏱️ SLA Governance</option>
                    <option value="distribution">⚡ Lead Distribution & Automation</option>
                    <option value="email">✉️ Email & SMTP Server</option>
                  </select>
                </div>
              </div>

              {/* TAB CONTENTS */}
              <div className="space-y-6">

            {/* TAB 0: TEAM MEMBERS & AGENTS CRUD */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border border-[#E8E4DC] rounded-lg shadow-2xs">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-[#081428]">Team Members & Sales Advisors</h3>
                    <p className="text-xs text-[#6E6E6E]">Manage agents, designations, contact numbers, and lead assignment eligibility.</p>
                  </div>
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="px-4 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-[#C8A147]" />
                    <span>+ Add New Team Member</span>
                  </button>
                </div>

                {/* Users Cards / Table */}
                <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xs overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF8F5] border-b border-[#E8E4DC] text-[#6E6E6E] font-semibold uppercase tracking-wider text-[10px]">
                        <th className="p-3 pl-4">Team Member</th>
                        <th className="p-3">Role / Designation</th>
                        <th className="p-3">Email Address</th>
                        <th className="p-3">Phone Number</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E4DC]">
                      {(Array.isArray(users) ? users : []).map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 pl-4">
                            {editingUserId === u.id ? (
                              <input
                                type="text"
                                value={editUserName}
                                onChange={(e) => setEditUserName(e.target.value)}
                                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-bold w-full"
                              />
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#081428] text-[#C8A147] font-bold text-xs flex items-center justify-center border border-[#C8A147]/40 shrink-0 font-mono">
                                  {u.initials || 'AG'}
                                </div>
                                <span className="font-bold text-[#081428]">{u.name}</span>
                              </div>
                            )}
                          </td>

                          <td className="p-3">
                            {editingUserId === u.id ? (
                              <input
                                type="text"
                                value={editUserRole}
                                onChange={(e) => setEditUserRole(e.target.value)}
                                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] w-full"
                              />
                            ) : (
                              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                {u.role || 'Property Advisor'}
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-slate-600">
                            {editingUserId === u.id ? (
                              <input
                                type="email"
                                value={editUserEmail}
                                onChange={(e) => setEditUserEmail(e.target.value)}
                                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] w-full"
                              />
                            ) : (
                              u.email
                            )}
                          </td>

                          <td className="p-3 font-mono text-slate-700">
                            {editingUserId === u.id ? (
                              <input
                                type="text"
                                value={editUserPhone}
                                onChange={(e) => setEditUserPhone(e.target.value)}
                                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] w-full"
                              />
                            ) : (
                              u.phone || 'N/A'
                            )}
                          </td>

                          <td className="p-3">
                            {editingUserId === u.id ? (
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editUserActive}
                                  onChange={(e) => setEditUserActive(e.target.checked)}
                                  className="w-4 h-4 rounded text-[#C8A147]"
                                />
                                <span className="text-xs font-semibold">Active Agent</span>
                              </label>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                u.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                              }`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </td>

                          <td className="p-3 pr-4 text-right">
                            {editingUserId === u.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleUpdateUser(u.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                  title="Save"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setEditingUserId(u.id);
                                    setEditUserName(u.name);
                                    setEditUserEmail(u.email);
                                    setEditUserPhone(u.phone || '');
                                    setEditUserRole(u.role || '');
                                    setEditUserActive(u.is_active);
                                  }}
                                  className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Modal for Adding New User */}
                {showAddUserModal && (
                  <div className="fixed inset-0 z-50 bg-[#081428]/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
                      <div className="bg-[#081428] p-4 text-white flex items-center justify-between border-b border-[#152744]">
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-[#C8A147]" />
                          <span className="font-heading font-bold text-sm">Add New Team Member</span>
                        </div>
                        <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleAddUser} className="p-5 space-y-4 text-xs">
                        <div>
                          <label className="block font-bold text-[#081428] mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Faraz Shafi"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#081428] mb-1">Email Address *</label>
                          <input
                            type="email"
                            required
                            placeholder="faraz@fsadvisory.ae"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#081428] mb-1">Phone Number</label>
                          <input
                            type="text"
                            placeholder="+971 50 123 4567"
                            value={newUserPhone}
                            onChange={(e) => setNewUserPhone(e.target.value)}
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#081428] mb-1">Role / Designation</label>
                          <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value)}
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                          >
                            <option value="Senior Property Advisor">Senior Property Advisor</option>
                            <option value="Property Consultant">Property Consultant</option>
                            <option value="Telesales Lead Agent">Telesales Lead Agent</option>
                            <option value="Sales Director / CEO">Sales Director / CEO</option>
                            <option value="Listing Manager">Listing Manager</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E4DC]">
                          <button
                            type="button"
                            onClick={() => setShowAddUserModal(false)}
                            className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-bold rounded hover:bg-slate-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-xs transition-colors cursor-pointer"
                          >
                            Save Team Member
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: LEAD SOURCES & SUB-SOURCES */}
            {activeTab === 'sources' && (
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#C8A147]" />
                      <span>Lead Sources & Sub-Sources Manager</span>
                    </h3>
                    <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                      Create main lead channels and sub-sources dynamically.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddSourceModal(true)}
                    className="px-3 py-1.5 bg-[#081428] hover:bg-[#122444] text-white font-bold text-xs rounded-md flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>Add Main Source</span>
                  </button>
                </div>

                {showAddSourceModal && (
                  <form onSubmit={handleAddSource} className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-3">
                    <div className="font-bold text-[#081428]">Add New Lead Source Channel</div>
                    <div>
                      <label className="block text-[#6E6E6E] mb-1 font-semibold">Source Name *</label>
                      <input
                        type="text"
                        required
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        placeholder="e.g. TikTok Ads"
                        className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSourceModal(false)}
                        className="px-3 py-1.5 bg-white border border-[#E8E4DC] text-[#6E6E6E] rounded"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="px-4 py-1.5 bg-[#C8A147] text-white font-bold rounded">
                        Create Source
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-4">
                  {leadSources.map((src) => (
                    <div key={src.id} className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between gap-4 border-b border-[#E8E4DC] pb-2">
                        {editingSourceId === src.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              value={editSourceName}
                              onChange={(e) => setEditSourceName(e.target.value)}
                              className="flex-1 p-1 bg-white border border-[#E8E4DC] rounded text-xs font-bold"
                            />
                            <button onClick={() => handleUpdateSource(src.id)} className="p-1 bg-emerald-600 text-white rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingSourceId(null)} className="p-1 bg-slate-400 text-white rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 font-bold text-[#081428] text-sm">
                              <span>{src.name}</span>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px]">
                                {src.sub_sources?.length || 0} Sub-Sources
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingSourceId(src.id);
                                  setEditSourceName(src.name);
                                }}
                                className="p-1 text-[#6E6E6E] hover:text-[#081428]"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteSource(src.id)} className="p-1 text-red-500 hover:text-red-700">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="pl-4 border-l-2 border-[#C8A147]/40 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {src.sub_sources?.map((sub: any) => (
                            <div key={sub.id} className="p-2 bg-white border border-[#E8E4DC] rounded flex items-center justify-between text-xs">
                              {editingSubSourceId === sub.id ? (
                                <div className="flex items-center gap-1 w-full">
                                  <input
                                    type="text"
                                    value={editSubSourceName}
                                    onChange={(e) => setEditSubSourceName(e.target.value)}
                                    className="flex-1 p-1 border rounded text-xs"
                                  />
                                  <button onClick={() => handleUpdateSubSource(sub.id)} className="p-1 bg-emerald-600 text-white rounded">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setEditingSubSourceId(null)} className="p-1 bg-slate-400 text-white rounded">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span>{sub.name}</span>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditingSubSourceId(sub.id); setEditSubSourceName(sub.name); }} className="p-0.5 text-slate-400 hover:text-slate-700">
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleDeleteSubSource(sub.id)} className="p-0.5 text-red-400 hover:text-red-600">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={`+ Add sub-source for ${src.name}...`}
                            value={newSubSourceInputs[src.id] || ''}
                            onChange={(e) => setNewSubSourceInputs((prev) => ({ ...prev, [src.id]: e.target.value }))}
                            className="flex-1 p-2 bg-white border border-[#E8E4DC] rounded text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddSubSource(src.id)}
                            className="px-3 py-2 bg-[#081428] text-white font-bold rounded text-xs"
                          >
                            + Add Sub
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: DEVELOPERS */}
            {activeTab === 'developers' && (
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                    <HardHat className="w-5 h-5 text-[#C8A147]" />
                    <span>Real Estate Developers Catalog</span>
                  </h3>
                </div>

                {/* Add Developer Form */}
                <form onSubmit={handleAddDeveloper} className="flex items-center gap-2 p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                  <input
                    type="text"
                    required
                    placeholder="Enter Developer Name (e.g. Binghatti Developers)..."
                    value={newDevName}
                    onChange={(e) => setNewDevName(e.target.value)}
                    className="flex-1 p-2 bg-white border border-[#E8E4DC] rounded text-xs"
                  />
                  <button type="submit" className="px-4 py-2 bg-[#081428] text-[#C8A147] font-bold rounded text-xs shadow-xs">
                    + Add Developer
                  </button>
                </form>

                {/* Developers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {developers.map((dev) => (
                    <div key={dev.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md flex items-center justify-between gap-2 shadow-2xs">
                      {editingDevId === dev.id ? (
                        <div className="flex items-center gap-1 w-full">
                          <input
                            type="text"
                            value={editDevName}
                            onChange={(e) => setEditDevName(e.target.value)}
                            className="flex-1 p-1 border rounded text-xs"
                          />
                          <button onClick={() => handleUpdateDeveloper(dev.id)} className="p-1 bg-emerald-600 text-white rounded">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingDevId(null)} className="p-1 bg-slate-400 text-white rounded">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="font-bold text-[#081428] flex items-center gap-1.5">
                            <span>🏗️</span>
                            <span>{dev.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingDevId(dev.id); setEditDevName(dev.name); }} className="p-1 text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteDeveloper(dev.id)} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: PROJECTS */}
            {activeTab === 'projects' && (
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#C8A147]" />
                    <span>Real Estate Projects Catalog</span>
                  </h3>
                </div>

                {/* Add Project Form */}
                <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-5 gap-2.5 p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl">
                  <input
                    type="text"
                    required
                    placeholder="Project Name (e.g. Marina Gate)..."
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    className="p-2.5 bg-white border border-[#E8E4DC] rounded-lg text-xs md:col-span-2 font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  />
                  <select
                    value={newProjDev}
                    onChange={(e) => setNewProjDev(e.target.value)}
                    className="p-2.5 bg-white border border-[#E8E4DC] rounded-lg text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  >
                    <option value="">Select Developer...</option>
                    {developers.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                  <select
                    value={newProjComm}
                    onChange={(e) => setNewProjComm(e.target.value)}
                    className="p-2.5 bg-white border border-[#E8E4DC] rounded-lg text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  >
                    <option value="">Select Community...</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <button type="submit" className="px-4 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer">
                    + Add Project
                  </button>
                </form>

                {/* Quick Search Bar */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg px-2.5 py-1.5 w-72">
                    <Search className="w-3.5 h-3.5 text-[#6E6E6E]" />
                    <input
                      type="text"
                      placeholder="Search projects or developer..."
                      value={searchProj}
                      onChange={(e) => setSearchProj(e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-xs w-full font-medium"
                    />
                    {searchProj && (
                      <button onClick={() => setSearchProj('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {projects.filter(p => !searchProj || p.name?.toLowerCase().includes(searchProj.toLowerCase()) || p.developer_name?.toLowerCase().includes(searchProj.toLowerCase())).length} of {projects.length} Projects Listed
                  </span>
                </div>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projects
                    .filter(p => !searchProj || p.name?.toLowerCase().includes(searchProj.toLowerCase()) || p.developer_name?.toLowerCase().includes(searchProj.toLowerCase()))
                    .map((proj) => (
                    <div key={proj.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md flex items-center justify-between gap-2 shadow-2xs">
                      {editingProjId === proj.id ? (
                        <div className="flex items-center gap-1 w-full">
                          <input
                            type="text"
                            value={editProjName}
                            onChange={(e) => setEditProjName(e.target.value)}
                            className="flex-1 p-1 border rounded text-xs"
                          />
                          <button onClick={() => handleUpdateProject(proj.id)} className="p-1 bg-emerald-600 text-white rounded">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingProjId(null)} className="p-1 bg-slate-400 text-white rounded">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="font-bold text-[#081428] flex items-center gap-1.5">
                              <span>🏢</span>
                              <span>{proj.name}</span>
                            </div>
                            <div className="text-[10px] text-[#6E6E6E]">
                              {proj.developer_name || 'General'} • {proj.community_name || 'Dubai'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingProjId(proj.id); setEditProjName(proj.name); }} className="p-1 text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteProject(proj.id)} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: PROPERTY / UNIT TYPES */}
            {activeTab === 'properties' && (
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                    <Home className="w-5 h-5 text-[#C8A147]" />
                    <span>Property & Unit Types Catalog</span>
                  </h3>
                </div>

                {/* Add Property Form */}
                <form onSubmit={handleAddPropertyType} className="flex items-center gap-2 p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                  <input
                    type="text"
                    required
                    placeholder="Enter Property / Unit Type (e.g. 3BR Duplex Sky Suite)..."
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    className="flex-1 p-2 bg-white border border-[#E8E4DC] rounded text-xs"
                  />
                  <button type="submit" className="px-4 py-2 bg-[#081428] text-[#C8A147] font-bold rounded text-xs shadow-xs">
                    + Add Property Type
                  </button>
                </form>

                {/* Properties Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {propertyTypes.map((prop) => (
                    <div key={prop.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md flex items-center justify-between gap-2 shadow-2xs">
                      {editingPropId === prop.id ? (
                        <div className="flex items-center gap-1 w-full">
                          <input
                            type="text"
                            value={editPropName}
                            onChange={(e) => setEditPropName(e.target.value)}
                            className="flex-1 p-1 border rounded text-xs"
                          />
                          <button onClick={() => handleUpdatePropertyType(prop.id)} className="p-1 bg-emerald-600 text-white rounded">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingPropId(null)} className="p-1 bg-slate-400 text-white rounded">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="font-bold text-[#081428] flex items-center gap-1.5">
                            <span>🏠</span>
                            <span>{prop.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingPropId(prop.id); setEditPropName(prop.name); }} className="p-1 text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeletePropertyType(prop.id)} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: COMMUNITIES */}
            {activeTab === 'communities' && (
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#C8A147]" />
                    <span>Communities & Locations Catalog</span>
                  </h3>
                </div>

                {/* Add Community Form */}
                <form onSubmit={handleAddCommunity} className="flex items-center gap-2 p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                  <input
                    type="text"
                    required
                    placeholder="Enter Community Name (e.g. Dubai Creek Harbour)..."
                    value={newCommName}
                    onChange={(e) => setNewCommName(e.target.value)}
                    className="flex-1 p-2 bg-white border border-[#E8E4DC] rounded text-xs"
                  />
                  <button type="submit" className="px-4 py-2 bg-[#081428] text-[#C8A147] font-bold rounded text-xs shadow-xs">
                    + Add Community
                  </button>
                </form>

                {/* Communities Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {communities.map((comm) => (
                    <div key={comm.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md flex items-center justify-between gap-2 shadow-2xs">
                      {editingCommId === comm.id ? (
                        <div className="flex items-center gap-1 w-full">
                          <input
                            type="text"
                            value={editCommName}
                            onChange={(e) => setEditCommName(e.target.value)}
                            className="flex-1 p-1 border rounded text-xs"
                          />
                          <button onClick={() => handleUpdateCommunity(comm.id)} className="p-1 bg-emerald-600 text-white rounded">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingCommId(null)} className="p-1 bg-slate-400 text-white rounded">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="font-bold text-[#081428] flex items-center gap-1.5">
                            <span>📍</span>
                            <span>{comm.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingCommId(comm.id); setEditCommName(comm.name); }} className="p-1 text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteCommunity(comm.id)} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: PORTALS */}
            {activeTab === 'portals' && (
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#C8A147]" />
                    <span>Real Estate Portals Auto-Sync</span>
                  </h3>
                  <span className="text-xs text-[#6E6E6E]">Active Webhook Ingestion</span>
                </div>

                <div className="space-y-3">
                  {portals.map((p) => (
                    <div key={p.id} className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg flex items-center justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="font-bold text-[#081428] text-sm flex items-center gap-2">
                          <span>{p.display_name}</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] uppercase font-bold">
                            {p.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6E6E6E] font-mono">
                          Webhook: {API_BASE_URL}/portals/ingest?portal={p.portal_name}
                        </div>
                        <div className="text-[10px] text-slate-400">Total Leads Synced: {p.synced_count}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 bg-white border border-[#E8E4DC] rounded font-semibold text-slate-700 text-[11px]">
                          Configure
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: SLA */}
            {activeTab === 'sla' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
                <div className="lg:col-span-2 bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs">
                  <h3 className="font-heading font-bold text-base text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#C8A147]" />
                    <span>SLA Thresholds & Auto-Escalation Rules</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#6E6E6E] mb-1 font-semibold">SLA Warning Time (Minutes)</label>
                      <input type="number" defaultValue={30} className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]" />
                    </div>
                    <div>
                      <label className="block text-[#6E6E6E] mb-1 font-semibold">Grace Period Limit (Minutes)</label>
                      <input type="number" defaultValue={15} className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]" />
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-700" />
                      <span>Auto-Escalation Active</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Overdue leads exceeding 15 minutes grace period will log a permanent SLA breach and re-assign HOT leads to Faraz Shafi (Manager).
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs">
                  <h3 className="font-heading font-bold text-base text-[#081428] border-b border-[#E8E4DC] pb-3">
                    Branch Information
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[10px] text-[#6E6E6E] uppercase font-semibold">Company Name</div>
                      <div className="font-bold text-[#081428]">FS Advisory Real Estate LLC</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#6E6E6E] uppercase font-semibold">Branch Office</div>
                      <div className="font-bold text-[#081428]">Dubai Headquarters — Downtown Office</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#6E6E6E] uppercase font-semibold">Base Currency</div>
                      <div className="font-bold text-[#081428]">AED (United Arab Emirates Dirham)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: OPPORTUNITY TYPES */}
            {activeTab === 'opp_types' && (
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-6 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-4">
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#C8A147]" />
                      <span>Opportunity Types Catalog & Governance</span>
                    </h3>
                    <p className="text-xs text-[#6E6E6E]">
                      Manage all master Opportunity Types used across Lead Forms and Opportunities (e.g. Buyer, Seller, Landlord, Tenant, Off-Plan Investor).
                    </p>
                  </div>
                </div>

                {/* Add New Opportunity Type Form */}
                <form onSubmit={handleAddOpportunityType} className="flex gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Opportunity Type Name (e.g. Off-Plan Investor Opportunity)"
                    value={newOppTypeName}
                    onChange={(e) => setNewOppTypeName(e.target.value)}
                    className="flex-1 p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium focus:border-[#C8A147] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Opportunity Type</span>
                  </button>
                </form>

                {/* Opportunity Types Table */}
                <div className="overflow-x-auto border border-[#E8E4DC] rounded-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF8F5] border-b border-[#E8E4DC] text-[#6E6E6E] font-semibold uppercase text-[10px]">
                        <th className="p-3">Type Name</th>
                        <th className="p-3">Slug Key</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E4DC]">
                      {opportunityTypes.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="p-3 font-bold text-[#081428]">
                            {editingOppTypeId === item.id ? (
                              <input
                                type="text"
                                value={editOppTypeName}
                                onChange={(e) => setEditOppTypeName(e.target.value)}
                                className="p-1 bg-white border border-[#C8A147] rounded w-full text-xs font-bold"
                              />
                            ) : (
                              item.name
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-[#6E6E6E]">{item.slug}</td>
                          <td className="p-3 text-right space-x-2">
                            {editingOppTypeId === item.id ? (
                              <button
                                onClick={() => handleUpdateOpportunityType(item.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingOppTypeId(item.id);
                                  setEditOppTypeName(item.name);
                                }}
                                className="p-1 text-slate-500 hover:text-[#081428] rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteOpportunityType(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 9: LEAD DISTRIBUTION & AUTOMATION ENGINE */}
            {selectedModule === 'distribution' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Top Strategy & Manual Distribution Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Col 1 & 2: Strategy & Scopes */}
                  <div className="lg:col-span-2 bg-white p-6 border border-[#E8E4DC] rounded-xl shadow-2xs space-y-6">
                    <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-4">
                      <div>
                        <h3 className="font-heading font-bold text-lg text-[#081428] flex items-center gap-2">
                          <Zap className="w-5 h-5 text-[#C9A84C]" />
                          <span>Distribution Engine Rules</span>
                        </h3>
                        <p className="text-xs text-[#6E6E6E]">
                          Configure real-time auto-assignment algorithms and routing triggers.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#081428]">
                          {distSettings.is_enabled ? 'Engine Active' : 'Engine Paused'}
                        </span>
                        <button
                          onClick={() => setDistSettings({ ...distSettings, is_enabled: !distSettings.is_enabled })}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            distSettings.is_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              distSettings.is_enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Algorithm Selection */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-[#081428] uppercase tracking-wider">
                        Distribution Strategy
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          {
                            key: 'round_robin',
                            title: '🔄 Round Robin',
                            desc: 'Equal cyclic distribution 1-by-1 among all active agents in rotation.',
                          },
                          {
                            key: 'load_balanced',
                            title: '⚖️ Load-Balanced',
                            desc: 'Assigns leads to the agent who currently has the least active open deals.',
                          },
                          {
                            key: 'weighted',
                            title: '🎯 Weighted Quota',
                            desc: 'Distributes proportionally by agent quota weight (e.g. 2x for Senior Closers).',
                          },
                        ].map((strategy) => (
                          <div
                            key={strategy.key}
                            onClick={() => setDistSettings({ ...distSettings, distribution_mode: strategy.key })}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                              distSettings.distribution_mode === strategy.key
                                ? 'border-[#C9A84C] bg-[#FAF8F4] ring-2 ring-[#C9A84C]/25 shadow-xs'
                                : 'border-[#E8E4DC] hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div className="font-bold text-xs text-[#081428] mb-1">{strategy.title}</div>
                            <div className="text-[11px] text-slate-500 leading-snug">{strategy.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Channel Scopes */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-[#081428] uppercase tracking-wider">
                        Auto-Assignment Scopes
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-start gap-3 p-3.5 rounded-lg border border-[#E8E4DC] bg-white cursor-pointer hover:border-[#C9A84C] transition-colors">
                          <input
                            type="checkbox"
                            checked={Boolean(distSettings.apply_to_lead_pool)}
                            onChange={(e) => setDistSettings({ ...distSettings, apply_to_lead_pool: e.target.checked })}
                            className="mt-0.5 rounded text-[#C9A84C] focus:ring-[#C9A84C]"
                          />
                          <div>
                            <div className="font-bold text-xs text-[#081428]">Inbound Lead Pool & Portals</div>
                            <div className="text-[11px] text-slate-500">Auto-routes Property Finder, Bayut, Dubizzle and new inquiries.</div>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3.5 rounded-lg border border-[#E8E4DC] bg-white cursor-pointer hover:border-[#C9A84C] transition-colors">
                          <input
                            type="checkbox"
                            checked={Boolean(distSettings.apply_to_owner_data)}
                            onChange={(e) => setDistSettings({ ...distSettings, apply_to_owner_data: e.target.checked })}
                            className="mt-0.5 rounded text-[#C9A84C] focus:ring-[#C9A84C]"
                          />
                          <div>
                            <div className="font-bold text-xs text-[#081428]">Owner Data & Resale Inquiries</div>
                            <div className="text-[11px] text-slate-500">Auto-routes imported or created property owner records.</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Global Daily Cap & Fallback */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E4DC]">
                      <div>
                        <label className="block text-xs font-bold text-[#081428] mb-1">Global Default Daily Cap (Leads/Agent)</label>
                        <input
                          type="number"
                          min={1}
                          value={distSettings.max_daily_leads_per_agent || 20}
                          onChange={(e) => setDistSettings({ ...distSettings, max_daily_leads_per_agent: Number(e.target.value) })}
                          className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-bold text-[#081428] focus:ring-2 focus:ring-[#C9A84C] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#081428] mb-1">Fallback Assignee (If pool exhausted)</label>
                        <input
                          type="text"
                          value={distSettings.fallback_user_name || 'Faraz Shafi'}
                          onChange={(e) => setDistSettings({ ...distSettings, fallback_user_name: e.target.value })}
                          className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-bold text-[#081428] focus:ring-2 focus:ring-[#C9A84C] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleSaveDistSettings}
                        disabled={savingDist}
                        className="px-5 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Save className="w-4 h-4" />
                        <span>{savingDist ? 'Saving Rules...' : 'Save Distribution Rules'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Col 3: On-Demand Manual Triggers */}
                  <div className="space-y-4">
                    <div className="bg-white p-5 border border-[#E8E4DC] rounded-xl shadow-2xs space-y-4">
                      <h4 className="font-heading font-bold text-sm text-[#081428] flex items-center gap-2">
                        <Play className="w-4 h-4 text-[#C9A84C]" />
                        <span>Manual Distribution Trigger</span>
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Instantly run the active distribution algorithm to divide all currently unassigned records among active agents.
                      </p>

                      <div className="space-y-3 pt-2">
                        <button
                          onClick={handleRunLeadPoolBatch}
                          disabled={runningBatch}
                          className="w-full p-3.5 bg-[#FAF8F4] hover:bg-[#081428] border border-[#C9A84C] text-[#081428] hover:text-[#C9A84C] font-bold text-xs rounded-xl shadow-2xs flex items-center justify-between group transition-all cursor-pointer"
                        >
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-[#C9A84C]" />
                              <span>Distribute Lead Pool</span>
                            </div>
                            <div className="text-[10px] text-slate-500 group-hover:text-slate-300 font-normal">
                              {unassignedLeadsCount} unassigned leads waiting
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-[#081428] group-hover:bg-[#C9A84C] text-[#C9A84C] group-hover:text-[#081428] text-[10px] font-mono font-bold">
                            Run Now →
                          </span>
                        </button>

                        <button
                          onClick={handleRunOwnerDataBatch}
                          disabled={runningBatch}
                          className="w-full p-3.5 bg-[#FAF8F4] hover:bg-[#081428] border border-[#C9A84C] text-[#081428] hover:text-[#C9A84C] font-bold text-xs rounded-xl shadow-2xs flex items-center justify-between group transition-all cursor-pointer"
                        >
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-[#C9A84C]" />
                              <span>Distribute Owner Data</span>
                            </div>
                            <div className="text-[10px] text-slate-500 group-hover:text-slate-300 font-normal">
                              {unassignedOwnersCount} unassigned owners waiting
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-[#081428] group-hover:bg-[#C9A84C] text-[#C9A84C] group-hover:text-[#081428] text-[10px] font-mono font-bold">
                            Run Now →
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* KPI Mini-Card */}
                    <div className="bg-gradient-to-br from-[#081428] to-[#122444] text-white p-5 rounded-xl shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Active Rotation Stats</div>
                        <button
                          onClick={handleResetCounters}
                          disabled={resettingCounters}
                          title="Reset Today's Assigned Counters to 0"
                          className="px-2 py-0.5 text-[10px] font-bold text-[#C9A84C] hover:text-white bg-white/10 hover:bg-white/20 rounded border border-[#C9A84C]/30 flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{resettingCounters ? 'Resetting...' : 'Reset Counts'}</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="text-2xl font-bold font-mono text-white">
                            {distAgents.filter(a => a.in_distribution_pool).length}
                          </div>
                          <div className="text-[11px] text-slate-300">Agents in Pool</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold font-mono text-[#C9A84C]">
                            {distAgents.reduce((sum, a) => sum + (a.today_assigned_count || 0), 0)}
                          </div>
                          <div className="text-[11px] text-slate-300">Assigned Today</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent Rotation Pool Table */}
                <div className="bg-white border border-[#E8E4DC] rounded-xl shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-[#E8E4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading font-bold text-base text-[#081428]">Sales Advisors Rotation Pool</h3>
                      <p className="text-xs text-[#6E6E6E]">Manage individual advisor participation, priority weighting, and daily caps.</p>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      Showing {distAgents.length} Active Agents
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F5] text-[#7A7A7A] border-b border-[#E8E4DC] text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Sales Advisor</th>
                          <th className="py-3 px-4">Role & Department</th>
                          <th className="py-3 px-4 text-center">In Rotation Pool</th>
                          <th className="py-3 px-4 text-center">Daily Cap (Leads)</th>
                          <th className="py-3 px-4 text-center">Priority Weight</th>
                          <th className="py-3 px-4 text-center">Assigned Today</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E4DC]">
                        {distAgents.map((agent) => (
                          <tr key={agent.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#081428] text-[#C9A84C] font-bold flex items-center justify-center text-xs">
                                  {agent.name?.charAt(0) || 'A'}
                                </div>
                                <div>
                                  <div className="font-bold text-[#081428]">{agent.name}</div>
                                  <div className="text-[11px] text-slate-400">{agent.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {agent.role || 'Sales Advisor'}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">{agent.department || 'Sales'}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleToggleAgentPool(agent.id)}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                                  agent.in_distribution_pool
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                {agent.in_distribution_pool ? '✓ In Pool' : '✕ Excluded'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="number"
                                min={1}
                                value={agent.daily_lead_cap || 20}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setDistAgents(distAgents.map(a => a.id === agent.id ? { ...a, daily_lead_cap: val } : a));
                                }}
                                className="w-16 p-1 text-center bg-[#FAF8F5] border border-[#E8E4DC] rounded font-mono font-bold text-xs text-[#081428]"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <select
                                value={agent.distribution_weight || 1}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setDistAgents(distAgents.map(a => a.id === agent.id ? { ...a, distribution_weight: val } : a));
                                }}
                                className="p-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-bold text-xs text-[#081428] cursor-pointer"
                              >
                                <option value={1}>1x Normal</option>
                                <option value={2}>2x Priority</option>
                                <option value={3}>3x High</option>
                                <option value={5}>5x VIP Closer</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                                {agent.today_assigned_count || 0} leads
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleSaveAgentConfig(agent.id, {
                                  in_distribution_pool: agent.in_distribution_pool,
                                  daily_lead_cap: agent.daily_lead_cap,
                                  distribution_weight: agent.distribution_weight,
                                })}
                                className="px-3 py-1 bg-white hover:bg-[#081428] text-[#081428] hover:text-[#C9A84C] border border-[#E8E4DC] rounded text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Save
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Distribution Audit Logs */}
                <div className="bg-white border border-[#E8E4DC] rounded-xl shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-[#E8E4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading font-bold text-base text-[#081428]">Recent Auto-Assignment Activity Log</h3>
                      <p className="text-xs text-[#6E6E6E]">Real-time audit log of leads automatically assigned to advisors.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <span>Show:</span>
                        <select
                          value={distLogsPerPage}
                          onChange={(e) => {
                            const newPerPage = Number(e.target.value);
                            setDistLogsPerPage(newPerPage);
                            fetchDistLogs(1, newPerPage);
                          }}
                          className="bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2 py-1 text-xs font-bold text-[#081428] focus:outline-none focus:ring-1 focus:ring-[#C9A84C] cursor-pointer"
                        >
                          <option value={10}>10 / page</option>
                          <option value={25}>25 / page</option>
                          <option value={50}>50 / page</option>
                        </select>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#FAF8F5] text-[#081428] border border-[#E8E4DC]">
                        {distLogsPagination.total || distLogs.length} Total Records
                      </span>
                      <button
                        onClick={handleClearLogs}
                        disabled={clearingLogs || (distLogsPagination.total === 0 && distLogs.length === 0)}
                        title="Clear all activity audit logs"
                        className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{clearingLogs ? 'Clearing...' : 'Clear Logs'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F5] text-[#7A7A7A] border-b border-[#E8E4DC] text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-4">Time</th>
                          <th className="py-2.5 px-4">Scope</th>
                          <th className="py-2.5 px-4">Lead / Owner Record</th>
                          <th className="py-2.5 px-4">Assigned To</th>
                          <th className="py-2.5 px-4">Algorithm Used</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E4DC]">
                        {distLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No automated distribution events recorded yet. Click "Run Now" or wait for inbound leads.
                            </td>
                          </tr>
                        ) : (
                          distLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  log.lead_type === 'lead_pool'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}>
                                  {log.lead_type === 'lead_pool' ? 'Lead Pool' : 'Owner Data'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-bold text-[#081428]">
                                {log.record_name || `Record #${log.record_id}`}
                              </td>
                              <td className="py-2.5 px-4 font-bold text-emerald-700">
                                👤 {log.assigned_to_user_name}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-500 capitalize">
                                {log.strategy_used?.replace('_', ' ')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="p-4 border-t border-[#E8E4DC] bg-[#FAF8F5]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-500 font-medium">
                      Showing{' '}
                      <span className="font-bold text-[#081428]">{distLogsPagination.from || (distLogs.length > 0 ? 1 : 0)}</span>
                      {' '}to{' '}
                      <span className="font-bold text-[#081428]">{distLogsPagination.to || distLogs.length}</span>
                      {' '}of{' '}
                      <span className="font-bold text-[#081428]">{distLogsPagination.total || distLogs.length}</span>
                      {' '}events
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => fetchDistLogs(distLogsPage - 1, distLogsPerPage)}
                        disabled={distLogsPage <= 1 || loadingLogs}
                        className="px-2.5 py-1.5 bg-white border border-[#E8E4DC] hover:border-[#C9A84C] disabled:opacity-40 disabled:hover:border-[#E8E4DC] rounded-md text-xs font-bold text-[#081428] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>

                      {/* Page indicator pills */}
                      <div className="flex items-center gap-1">
                        {(() => {
                          const totalPages = distLogsPagination.last_page || 1;
                          const current = distLogsPage;
                          
                          if (totalPages <= 7) {
                            return Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                              <button
                                key={pageNum}
                                onClick={() => fetchDistLogs(pageNum, distLogsPerPage)}
                                disabled={loadingLogs}
                                className={`w-7 h-7 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                                  current === pageNum
                                    ? 'bg-[#081428] text-[#C9A84C] shadow-xs'
                                    : 'bg-white border border-[#E8E4DC] text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {pageNum}
                              </button>
                            ));
                          }

                          const pages: (number | string)[] = [];
                          if (current <= 4) {
                            for (let i = 1; i <= 5; i++) pages.push(i);
                            pages.push('...next');
                            pages.push(totalPages);
                          } else if (current >= totalPages - 3) {
                            pages.push(1);
                            pages.push('...prev');
                            for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            pages.push('...prev');
                            pages.push(current - 1);
                            pages.push(current);
                            pages.push(current + 1);
                            pages.push('...next');
                            pages.push(totalPages);
                          }

                          return pages.map((p, idx) => {
                            if (typeof p === 'string') {
                              const targetPage = p === '...prev' ? Math.max(1, current - 4) : Math.min(totalPages, current + 4);
                              return (
                                <button
                                  key={`ellipsis-${idx}`}
                                  onClick={() => fetchDistLogs(targetPage, distLogsPerPage)}
                                  title={`Jump to page ${targetPage}`}
                                  className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-[#081428] font-bold text-xs hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                >
                                  ...
                                </button>
                              );
                            }

                            return (
                              <button
                                key={p}
                                onClick={() => fetchDistLogs(p, distLogsPerPage)}
                                disabled={loadingLogs}
                                className={`w-7 h-7 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                                  current === p
                                    ? 'bg-[#081428] text-[#C9A84C] shadow-xs'
                                    : 'bg-white border border-[#E8E4DC] text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          });
                        })()}
                      </div>

                      <button
                        onClick={() => fetchDistLogs(distLogsPage + 1, distLogsPerPage)}
                        disabled={distLogsPage >= (distLogsPagination.last_page || 1) || loadingLogs}
                        className="px-2.5 py-1.5 bg-white border border-[#E8E4DC] hover:border-[#C9A84C] disabled:opacity-40 disabled:hover:border-[#E8E4DC] rounded-md text-xs font-bold text-[#081428] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: EMAIL & SMTP SERVER CONFIGURATION */}
            {activeTab === 'email' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border border-[#E8E4DC] rounded-xl shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#081428] text-[#C9A84C] tracking-wider uppercase font-mono">
                        Enterprise Relay
                      </span>
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        Domain: @{emailSettings.default_domain || 'fsadvisory.ae'}
                      </span>
                    </div>
                    <h3 className="font-heading font-bold text-xl text-[#081428]">
                      Corporate Email & SMTP Server Configuration
                    </h3>
                    <p className="text-xs text-[#6E6E6E] mt-0.5 max-w-2xl">
                      Configure authenticated corporate SMTP credentials to dispatch off-plan brochures, viewing invitations, and CMA valuations directly to VIP clients with official FS Advisory branding.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEmailSettings}
                      disabled={savingEmail}
                      className="px-5 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 text-[#C8A147]" />
                      <span>{savingEmail ? 'Saving...' : 'Save Email Configuration'}</span>
                    </button>
                  </div>
                </div>

                {/* Main Settings Grid */}
                <form onSubmit={handleSaveEmailSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column (2 Cols): Connection & Credentials */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* SMTP Credentials Card */}
                    <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Server className="w-5 h-5 text-[#C9A84C]" />
                          <h4 className="font-heading font-bold text-base text-[#081428]">
                            SMTP Server Connection
                          </h4>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(emailSettings.is_active)}
                            onChange={(e) => setEmailSettings({ ...emailSettings, is_active: e.target.checked })}
                            className="rounded text-[#081428] focus:ring-[#C9A84C] h-4 w-4"
                          />
                          <span className="text-xs font-bold text-slate-700">Relay Enabled</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Mail Driver / Protocol
                          </label>
                          <select
                            value={emailSettings.mail_mailer || 'smtp'}
                            onChange={(e) => setEmailSettings({ ...emailSettings, mail_mailer: e.target.value })}
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                          >
                            <option value="smtp">SMTP (Standard Mail Protocol)</option>
                            <option value="sendmail">Sendmail</option>
                            <option value="log">Log Only (Testing / Staging)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            SMTP Host / Mail Server <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={emailSettings.mail_host || ''}
                            onChange={(e) => setEmailSettings({ ...emailSettings, mail_host: e.target.value })}
                            placeholder="e.g. smtp.titan.email or mail.fsadvisory.ae"
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">Enterprise SMTP hostname or IP</span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            SMTP Port <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            value={emailSettings.mail_port || 587}
                            onChange={(e) => setEmailSettings({ ...emailSettings, mail_port: parseInt(e.target.value) || 587 })}
                            placeholder="587 or 465"
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">587 for TLS, 465 for SSL</span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Encryption Security
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {['tls', 'ssl', 'none'].map((enc) => (
                              <button
                                key={enc}
                                type="button"
                                onClick={() => setEmailSettings({ ...emailSettings, mail_encryption: enc })}
                                className={`py-2 text-xs font-bold uppercase rounded-lg border transition-all cursor-pointer ${
                                  emailSettings.mail_encryption === enc
                                    ? 'bg-[#081428] text-[#C9A84C] border-[#081428] shadow-xs'
                                    : 'bg-[#FAF8F5] text-slate-600 border-[#E8E4DC] hover:bg-slate-100'
                                }`}
                              >
                                {enc}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            SMTP Username <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={emailSettings.mail_username || ''}
                            onChange={(e) => setEmailSettings({ ...emailSettings, mail_username: e.target.value })}
                            placeholder="advisory@fsadvisory.ae"
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">Official corporate mailbox account</span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            SMTP Password <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showEmailPassword ? 'text' : 'password'}
                              value={emailSettings.mail_password || ''}
                              onChange={(e) => setEmailSettings({ ...emailSettings, mail_password: e.target.value })}
                              placeholder="••••••••••••"
                              className="w-full p-2.5 pr-10 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEmailPassword(!showEmailPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title={showEmailPassword ? 'Hide password' : 'Show password'}
                            >
                              {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">Leave unchanged to keep current password</span>
                        </div>
                      </div>
                    </div>

                    {/* Sender Identity & Domain Configuration */}
                    <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-5">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Mail className="w-5 h-5 text-[#C9A84C]" />
                        <h4 className="font-heading font-bold text-base text-[#081428]">
                          Sender Identity & Domain Defaults
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Default "From" Address <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            value={emailSettings.mail_from_address || ''}
                            onChange={(e) => setEmailSettings({ ...emailSettings, mail_from_address: e.target.value })}
                            placeholder="advisory@fsadvisory.ae"
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Default "From" Display Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={emailSettings.mail_from_name || ''}
                            onChange={(e) => setEmailSettings({ ...emailSettings, mail_from_name: e.target.value })}
                            placeholder="FS Advisory Luxury Real Estate"
                            className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Corporate Domain Policy
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={emailSettings.default_domain || 'fsadvisory.ae'}
                              onChange={(e) => setEmailSettings({ ...emailSettings, default_domain: e.target.value })}
                              placeholder="fsadvisory.ae"
                              className="w-full max-w-xs p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-bold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                            />
                            <span className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Official Agent Domain
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                            Sales advisors with an email matching <strong className="text-[#081428]">@{emailSettings.default_domain || 'fsadvisory.ae'}</strong> will have client replies automatically routed directly to their corporate mailbox via the <code className="text-[#081428] font-bold">Reply-To</code> email header.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (1 Col): Live Tester & Quick Help */}
                  <div className="space-y-6">
                    {/* Live Connection Tester Card */}
                    <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Send className="w-5 h-5 text-[#C9A84C]" />
                        <h4 className="font-heading font-bold text-base text-[#081428]">
                          Live Connection Tester
                        </h4>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed">
                        Verify SMTP credentials and server handshake by sending a live verification email to any test recipient.
                      </p>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Recipient Email Address
                        </label>
                        <input
                          type="email"
                          value={testEmailRecipient}
                          onChange={(e) => setTestEmailRecipient(e.target.value)}
                          placeholder="e.g. yourname@fsadvisory.ae or client@gmail.com"
                          className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={testingEmail}
                        className="w-full py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {testingEmail ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-[#C9A84C]" />
                            <span>Connecting to SMTP...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 text-[#C9A84C]" />
                            <span>Send Verification Email</span>
                          </>
                        )}
                      </button>

                      {testEmailFeedback && (
                        <div
                          className={`p-3 rounded-lg text-xs border animate-in fade-in duration-200 ${
                            testEmailFeedback.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {testEmailFeedback.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-0.5">
                              <span className="font-bold">
                                {testEmailFeedback.success ? 'Delivery Success' : 'Connection Failed'}
                              </span>
                              <p className="text-[11px] leading-relaxed break-words">
                                {testEmailFeedback.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* How It Works Explainer Card */}
                    <div className="bg-[#081428] text-white rounded-xl p-5 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-[#C9A84C] text-xs font-bold uppercase tracking-wider">
                        <Lock className="w-4 h-4" />
                        <span>Security & Routing Policy</span>
                      </div>
                      <h5 className="font-heading font-bold text-sm text-white">
                        Executive Brokerage Standards
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-2 leading-relaxed list-disc list-inside">
                        <li>
                          <strong className="text-white">Encrypted Relay:</strong> Passwords are encrypted at rest and never returned in plaintext to the browser.
                        </li>
                        <li>
                          <strong className="text-white">Automated Timeline:</strong> Every dispatched email automatically logs as an activity with timestamps, recipient, and subject.
                        </li>
                        <li>
                          <strong className="text-white">Dedicated Inboxes:</strong> Clients reply straight to the assigned property advisor's personal mailbox.
                        </li>
                      </ul>
                    </div>
                  </div>
                </form>
              </div>
            )}


              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-xs text-slate-400 font-medium">Loading Master Settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
