'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ContactDrawer from '@/components/ContactDrawer';
import AdvancedFilterModal, { AdvancedFiltersState, INITIAL_ADVANCED_FILTERS } from '@/components/AdvancedFilterModal';
import DateRangePicker, { DateRangeValue } from '@/components/DateRangePicker';
import { fetchApi } from '@/lib/api';
import Swal from 'sweetalert2';
import { 
  Search, Plus, Users, CheckCircle2, RotateCcw, Copy, 
  ChevronLeft, ChevronRight, RefreshCw, Trash2, Undo2, UserX,
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, GripVertical, UserCheck, X,
  Eye, Edit3, MessageSquare, Check, Zap, Filter, Flame, Globe, Radio,
  Briefcase, Upload
} from 'lucide-react';
import Link from 'next/link';
import { hasPermission, refreshCurrentUser, isSuperUser } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';

export default function NewLeadsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total: 0,
    available: 0,
    active: 0,
    reactivation: 0,
    duplicates: 0,
    inbound_total: 0,
    inbound_unassigned: 0,
    inbound_portals: 0,
    inbound_campaigns: 0,
  });

  // Bulk Selection & Assignment State
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [bulkAssignOwner, setBulkAssignOwner] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [canViewLeads, setCanViewLeads] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [mounted, setMounted] = useState<boolean>(false);

  // Drawer & Modals
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Top Tabs State: 'all' (Default) | 'unassigned' | 'duplicate' | 'deleted'
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned' | 'duplicate' | 'deleted'>('all');
  const [tabCounts, setTabCounts] = useState({ all: 0, unassigned: 0, new: 0, assigned: 0, duplicate: 0, deleted: 0 });

  // Sorting
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Date Range Calendar State
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: '',
    to: '',
    preset: 'all',
  });

  // Advanced Filters State & Modal
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(INITIAL_ADVANCED_FILTERS);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

  const activeAdvancedCount = useMemo(() => {
    return Object.values(advancedFilters).filter((v) => v && v.trim() !== '' && v !== 'all').length;
  }, [advancedFilters]);

  // Categorized Table Columns Definition (Matching Lead Pool Architecture)
  const ALL_COLUMNS = [
    { key: 'name', label: 'Client Profile', category: 'Core' },
    { key: 'source', label: 'Source Channel', category: 'Core' },
    { key: 'state', label: 'Lifecycle State', category: 'Core' },
    { key: 'opportunity', label: 'Opportunity Workspace', category: 'Core' },
    { key: 'phone', label: 'Primary Phone', category: 'Client Details' },
    { key: 'secondary_phone', label: 'Secondary Phone', category: 'Client Details' },
    { key: 'email', label: 'Email Address', category: 'Client Details' },
    { key: 'nationality', label: 'Nationality', category: 'Client Details' },
    { key: 'created_at', label: 'Created Date', category: 'Client Details' },
    { key: 'sub_source', label: 'Sub-Source Campaign', category: 'Source Details' },
    { key: 'utm_campaign', label: 'UTM Campaign / URL', category: 'Source Details' },
    { key: 'opportunity_type', label: 'Opportunity Type', category: 'Opportunity Specs' },
    { key: 'developer', label: 'Developer', category: 'Opportunity Specs' },
    { key: 'community', label: 'Community', category: 'Opportunity Specs' },
    { key: 'project', label: 'Project', category: 'Opportunity Specs' },
    { key: 'project_property', label: 'Unit / Property Type', category: 'Opportunity Specs' },
    { key: 'bedrooms', label: 'Bedrooms', category: 'Opportunity Specs' },
    { key: 'budget_min', label: 'Min Budget', category: 'Opportunity Specs' },
    { key: 'budget_max', label: 'Max Budget', category: 'Opportunity Specs' },
    { key: 'cash_or_finance', label: 'Payment Method', category: 'Opportunity Specs' },
    { key: 'key_requirement', label: 'Key Requirement', category: 'Opportunity Specs' },
    { key: 'assigned_owner', label: 'Assigned Owner', category: 'SLA & Owner' },
    { key: 'next_action', label: 'Next Action', category: 'SLA & Owner' },
    { key: 'next_action_due_at', label: 'Next Action Due', category: 'SLA & Owner' },
    { key: 'actions', label: 'Actions', category: 'Core' },
  ];

  const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
    name: true,
    source: true,
    phone: true,
    email: true,
    assigned_owner: true,
    created_at: true,
    utm_campaign: true,
    actions: true,
    state: false,
    opportunity: false,
    secondary_phone: false,
    nationality: false,
    sub_source: false,
    opportunity_type: false,
    developer: false,
    community: false,
    project: false,
    project_property: false,
    bedrooms: false,
    budget_min: false,
    budget_max: false,
    cash_or_finance: false,
    key_requirement: false,
    next_action: false,
    next_action_due_at: false,
  };

  const DEFAULT_COLUMN_ORDER = [
    'name',
    'source',
    'phone',
    'email',
    'assigned_owner',
    'created_at',
    'utm_campaign',
    'state',
    'opportunity',
    'secondary_phone',
    'nationality',
    'sub_source',
    'opportunity_type',
    'developer',
    'community',
    'project',
    'project_property',
    'bedrooms',
    'budget_min',
    'budget_max',
    'cash_or_finance',
    'key_requirement',
    'next_action',
    'next_action_due_at',
    'actions',
  ];

  // Dynamic Column Visibility State (Persisted in localStorage)
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);

  const updateColumnVisibility = (newVisibility: Record<string, boolean>) => {
    setColumnVisibility(newVisibility);
    if (typeof window !== 'undefined') {
      localStorage.setItem('new_leads_column_visibility', JSON.stringify(newVisibility));
    }
  };

  // Drag & Drop Column Order State (Persisted in localStorage)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);

  const updateColumnOrder = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem('new_leads_column_order', JSON.stringify(newOrder));
    }
  };

  // Load saved column preferences from localStorage after client hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const validKeys = ALL_COLUMNS.map((c) => c.key);
      const savedVis = localStorage.getItem('new_leads_column_visibility');
      if (savedVis) {
        try {
          const parsedVis = JSON.parse(savedVis);
          const cleanVis: Record<string, boolean> = { ...DEFAULT_COLUMN_VISIBILITY };
          validKeys.forEach((k) => {
            if (k in parsedVis) {
              cleanVis[k] = !!parsedVis[k];
            }
          });
          cleanVis.created_at = true; // By default Created Date must be visible
          cleanVis.actions = true;
          cleanVis.name = true;
          setColumnVisibility(cleanVis);
        } catch (e) {
          console.error('Error parsing column visibility:', e);
        }
      }
      const savedOrder = localStorage.getItem('new_leads_column_order');
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            let sanitized = parsed.filter((k: string) => validKeys.includes(k) && k !== 'actions');
            if (!sanitized.includes('created_at')) {
              const srcIdx = sanitized.indexOf('assigned_owner');
              if (srcIdx !== -1) {
                sanitized.splice(srcIdx + 1, 0, 'created_at');
              } else {
                sanitized.splice(5, 0, 'created_at');
              }
            }
            const missing = DEFAULT_COLUMN_ORDER.filter((k) => !sanitized.includes(k) && k !== 'actions');
            const finalOrder = [...sanitized, ...missing, 'actions'];
            setColumnOrder(finalOrder);
            localStorage.setItem('new_leads_column_order', JSON.stringify(finalOrder));
          }
        } catch (e) {
          console.error('Error parsing column order:', e);
        }
      }
    }
  }, []);

  // Drag and Drop States for Header Reordering
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, colKey: string) => {
    setDraggedColKey(colKey);
    e.dataTransfer.setData('text/plain', colKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    if (draggedColKey && draggedColKey !== targetColKey) {
      setDragOverColKey(targetColKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColKey(null);
  };

  const handleDrop = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    setDragOverColKey(null);
    if (!draggedColKey || draggedColKey === targetColKey) return;

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColKey);
    const targetIndex = newOrder.indexOf(targetColKey);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedColKey);
      updateColumnOrder(newOrder);
    }
    setDraggedColKey(null);
  };

  // Pagination
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [paginationMeta, setPaginationMeta] = useState({
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0,
    total: 0,
  });

  useEffect(() => {
    setMounted(true);
    const syncUser = () => {
      try {
        const raw = localStorage.getItem('crm_user');
        if (raw) setCurrentUser(JSON.parse(raw));
      } catch {}
    };
    syncUser();
    window.addEventListener('crm_user_updated', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('crm_user_updated', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    const checkPerms = () => {
      setCanViewLeads(hasPermission('leads.view'));
    };
    checkPerms();
    refreshCurrentUser().then(checkPerms);
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);

  useEffect(() => {
    fetchApi('/users')
      .then((data) => {
        const rawUsers = Array.isArray(data) ? data : (data?.users || []);
        if (rawUsers.length > 0) {
          setActiveAgents(rawUsers.filter((u: any) => u.is_active));
        }
      })
      .catch(console.error);
  }, []);

  const copyToClipboard = (text: string, fieldId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const loadData = async (
    page = currentPage,
    limit = perPage,
    sBy = sortBy,
    sOrder = sortOrder,
    ownerOverride?: string,
    advFiltersOverride?: AdvancedFiltersState,
    dateRangeOverride?: DateRangeValue
  ) => {
    setLoading(true);
    try {
      // inbound_only=1 strictly excludes batch file imports
      let endpoint = `/contacts?inbound_only=1&page=${page}&per_page=${limit}&tab=${activeTab}&sort_by=${sBy}&sort_order=${sOrder}`;
      
      if (searchQuery) {
        endpoint += `&search=${encodeURIComponent(searchQuery)}`;
      }

      // Date Range Calendar Filter
      const curDateRange = dateRangeOverride || dateRange;
      if (curDateRange.from) {
        endpoint += `&date_from=${encodeURIComponent(curDateRange.from)}`;
      }
      if (curDateRange.to) {
        endpoint += `&date_to=${encodeURIComponent(curDateRange.to)}`;
      }

      // Advanced Filters
      const activeFilters = advFiltersOverride || advancedFilters;
      if (activeFilters.state && activeFilters.state !== 'all') {
        endpoint += `&state=${encodeURIComponent(activeFilters.state)}`;
      }
      if (activeFilters.availability && activeFilters.availability !== 'all') {
        endpoint += `&availability=${encodeURIComponent(activeFilters.availability)}`;
      }
      if (activeFilters.source) endpoint += `&source=${encodeURIComponent(activeFilters.source)}`;
      if (activeFilters.subSource) endpoint += `&sub_source=${encodeURIComponent(activeFilters.subSource)}`;
      if (activeFilters.opportunityType) endpoint += `&opportunity_type=${encodeURIComponent(activeFilters.opportunityType)}`;
      if (activeFilters.temperature) endpoint += `&temperature=${encodeURIComponent(activeFilters.temperature)}`;
      if (activeFilters.paymentMethod) endpoint += `&payment_method=${encodeURIComponent(activeFilters.paymentMethod)}`;
      if (activeFilters.developer) endpoint += `&developer=${encodeURIComponent(activeFilters.developer)}`;
      if (activeFilters.community) endpoint += `&community=${encodeURIComponent(activeFilters.community)}`;
      if (activeFilters.project) endpoint += `&project=${encodeURIComponent(activeFilters.project)}`;
      if (activeFilters.propertyType) endpoint += `&property_type=${encodeURIComponent(activeFilters.propertyType)}`;
      if (activeFilters.bedrooms) endpoint += `&bedrooms=${encodeURIComponent(activeFilters.bedrooms)}`;
      if (activeFilters.projectProperty) endpoint += `&project_property=${encodeURIComponent(activeFilters.projectProperty)}`;
      if (activeFilters.budgetMin) endpoint += `&budget_min=${encodeURIComponent(activeFilters.budgetMin)}`;
      if (activeFilters.budgetMax) endpoint += `&budget_max=${encodeURIComponent(activeFilters.budgetMax)}`;

      let raw = localStorage.getItem('crm_user');
      let user = currentUser;
      if (!user && raw) {
        try { user = JSON.parse(raw); } catch {}
      }

      let targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;
      if (targetOwner === 'auto') {
        targetOwner = isSuperUser(user) ? 'all' : (user?.name || 'all');
      }

      if (targetOwner && targetOwner !== 'all') {
        endpoint += `&assigned_owner=${encodeURIComponent(targetOwner)}`;
      }

      const res = await fetchApi(endpoint);

      if (res.contacts) {
        setContacts(res.contacts.data || []);
        setPaginationMeta({
          current_page: res.contacts.current_page || page,
          last_page: res.contacts.last_page || 1,
          from: res.contacts.from || 0,
          to: res.contacts.to || 0,
          total: res.contacts.total || 0,
        });
      } else {
        setContacts([]);
        setPaginationMeta({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 });
      }

      setStats(res.stats || {
        total: 0,
        available: 0,
        active: 0,
        reactivation: 0,
        duplicates: 0,
        inbound_total: 0,
        inbound_unassigned: 0,
        inbound_portals: 0,
        inbound_campaigns: 0,
      });

      const freshTabCounts = res.tab_counts || { all: 0, unassigned: 0, new: 0, assigned: 0, duplicate: 0, deleted: 0 };
      setTabCounts(freshTabCounts);
      if (typeof window !== 'undefined') {
        const count = freshTabCounts.new ?? freshTabCounts.unassigned ?? 0;
        window.dispatchEvent(new CustomEvent('crm_new_leads_count', { detail: count }));
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load inbound contacts:', err);
      setContacts([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData(1, perPage, sortBy, sortOrder, selectedOwner, advancedFilters, dateRange);
  }, [activeTab, searchQuery, selectedOwner, advancedFilters, dateRange]);

  const handleSort = (columnKey: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === columnKey) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(columnKey);
    setSortOrder(newOrder);
    setCurrentPage(1);
    loadData(1, perPage, columnKey, newOrder);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > paginationMeta.last_page) return;
    setCurrentPage(newPage);
    loadData(newPage, perPage, sortBy, sortOrder);
  };

  const handlePerPageChange = (newLimit: number) => {
    setPerPage(newLimit);
    setCurrentPage(1);
    loadData(1, newLimit, sortBy, sortOrder);
  };

  const handleResetFilters = () => {
    setActiveTab('all');
    setSelectedOwner('all');
    setAdvancedFilters(INITIAL_ADVANCED_FILTERS);
    setDateRange({ from: '', to: '', preset: 'all' });
    setSearchQuery('');
    setSortBy('updated_at');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const handleOpenDrawer = async (contact: any) => {
    try {
      const fullContact = await fetchApi(`/contacts/${contact.id}`).catch(() => contact);
      setSelectedContact(fullContact || contact);
      setIsDrawerOpen(true);
    } catch (err) {
      setSelectedContact(contact);
      setIsDrawerOpen(true);
    }
  };

  // Bulk Checkboxes
  const handleToggleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map((c) => c.id));
    }
  };

  const handleToggleSelectOne = (id: number) => {
    if (selectedContactIds.includes(id)) {
      setSelectedContactIds(selectedContactIds.filter((i) => i !== id));
    } else {
      setSelectedContactIds([...selectedContactIds, id]);
    }
  };

  // Bulk Assign Handler
  const handleExecuteBulkAssign = async (targetOwner?: string) => {
    const ownerToAssign = targetOwner || bulkAssignOwner;
    if (!ownerToAssign) {
      Swal.fire('Select Advisor', 'Please select an Advisor from the dropdown or click Auto-Distribute.', 'warning');
      return;
    }

    setBulkLoading(true);
    try {
      const res = await fetchApi('/contacts/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          contact_ids: selectedContactIds,
          assigned_owner: ownerToAssign,
        }),
      });

      Swal.fire({
        icon: 'success',
        title: 'Bulk Allocation Complete!',
        text: res.message || `${selectedContactIds.length} inbound leads allocated to ${ownerToAssign}.`,
        confirmButtonColor: '#081428',
      });

      setSelectedContactIds([]);
      setBulkAssignOwner('');
      loadData(currentPage);
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Bulk assignment failed.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk Soft Delete
  const handleExecuteBulkDelete = async () => {
    Swal.fire({
      title: 'Move Selected Leads to Trash?',
      text: `Are you sure you want to move ${selectedContactIds.length} selected inbound leads to trash?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Move to Trash',
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      color: '#1A1A1A',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setBulkLoading(true);
        try {
          const res = await fetchApi('/contacts/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ contact_ids: selectedContactIds }),
          });

          Swal.fire({
            icon: 'success',
            title: 'Moved to Trash!',
            text: res.message || `${selectedContactIds.length} leads moved to trash.`,
            confirmButtonColor: '#081428',
          });

          setSelectedContactIds([]);
          loadData(currentPage);
        } catch (err: any) {
          Swal.fire('Error', err.message || 'Bulk delete failed.', 'error');
        } finally {
          setBulkLoading(false);
        }
      }
    });
  };

  // Single Soft Delete
  const handleSoftDeleteContact = (contactId: number, contactName: string) => {
    Swal.fire({
      title: 'Move Lead to Trash?',
      text: `Are you sure you want to move lead "${contactName}" to trash?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#081428',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Move to Trash',
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      color: '#1A1A1A',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await fetchApi(`/contacts/${contactId}`, { method: 'DELETE' });
          Swal.fire({
            title: 'Moved to Trash!',
            text: `Lead "${contactName}" has been moved to trash.`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false,
          });
          loadData();
        } catch (err: any) {
          Swal.fire('Error!', err.message || 'Failed to move contact to trash', 'error');
        }
      }
    });
  };

  // Restore Single Contact
  const handleRestoreContact = async (contactId: number, contactName: string) => {
    try {
      await fetchApi(`/contacts/${contactId}/restore`, { method: 'POST' });
      Swal.fire({
        title: 'Restored!',
        text: `Lead "${contactName}" has been restored to active pool.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
      });
      loadData();
    } catch (err: any) {
      Swal.fire('Error!', err.message || 'Failed to restore contact', 'error');
    }
  };

  // Permanent Purge Single Contact
  const handleForceDeleteContact = (contactId: number, contactName: string) => {
    Swal.fire({
      title: 'Permanently Purge Contact?',
      text: `PERMANENT ACTION: Are you sure you want to permanently delete "${contactName}"? This cannot be undone!`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Purge Permanently',
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      color: '#1A1A1A',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await fetchApi(`/contacts/${contactId}/force`, { method: 'DELETE' });
          Swal.fire({
            title: 'Purged!',
            text: `Lead "${contactName}" has been permanently deleted from database.`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false,
          });
          loadData();
        } catch (err: any) {
          Swal.fire('Error!', err.message || 'Failed to purge contact', 'error');
        }
      }
    });
  };

  // Bulk Restore
  const handleExecuteBulkRestore = async () => {
    Swal.fire({
      title: 'Restore Selected Leads?',
      text: `Are you sure you want to restore ${selectedContactIds.length} selected leads back to active pool?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Restore Selected',
      cancelButtonText: 'Cancel',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setBulkLoading(true);
        try {
          const res = await fetchApi('/contacts/bulk-restore', {
            method: 'POST',
            body: JSON.stringify({ contact_ids: selectedContactIds }),
          });

          Swal.fire({
            icon: 'success',
            title: 'Leads Restored',
            text: res.message || `${selectedContactIds.length} leads restored successfully.`,
            timer: 1800,
            showConfirmButton: false,
          });

          setSelectedContactIds([]);
          loadData(currentPage);
        } catch (err: any) {
          Swal.fire('Error', err.message || 'Bulk restore failed.', 'error');
        } finally {
          setBulkLoading(false);
        }
      }
    });
  };

  // Bulk Permanent Force Delete
  const handleExecuteBulkPermanentDelete = async () => {
    Swal.fire({
      title: 'Permanently Purge Selected Leads?',
      text: `PERMANENT ACTION: Are you sure you want to permanently delete ${selectedContactIds.length} selected leads from database? This CANNOT be undone!`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Purge Permanently',
      cancelButtonText: 'Cancel',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setBulkLoading(true);
        try {
          const res = await fetchApi('/contacts/bulk-force-delete', {
            method: 'POST',
            body: JSON.stringify({ contact_ids: selectedContactIds }),
          });

          Swal.fire({
            icon: 'success',
            title: 'Leads Purged',
            text: res.message || `${selectedContactIds.length} leads permanently deleted.`,
            timer: 1800,
            showConfirmButton: false,
          });

          setSelectedContactIds([]);
          loadData(currentPage);
        } catch (err: any) {
          Swal.fire('Error', err.message || 'Permanent bulk deletion failed.', 'error');
        } finally {
          setBulkLoading(false);
        }
      }
    });
  };

  const renderHeaderCell = (colKey: string) => {
    const colMeta = ALL_COLUMNS.find((c) => c.key === colKey);
    if (!colMeta || !columnVisibility[colKey]) return null;

    const label = colMeta.label || colKey;
    const isSortable = colKey !== 'actions';
    const isSorted = sortBy === colKey;

    return (
      <th
        key={colKey}
        draggable
        onDragStart={(e) => handleDragStart(e, colKey)}
        onDragOver={(e) => handleDragOver(e, colKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, colKey)}
        onClick={() => {
          if (isSortable) handleSort(colKey);
        }}
        className={`p-3 font-semibold uppercase tracking-wider text-[10px] select-none transition-all group ${
          colKey === 'actions' ? 'text-right pr-4' : ''
        } ${isSortable ? 'hover:bg-[#F3EEDD] cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${
          dragOverColKey === colKey ? 'border-l-2 border-[#C8A147] bg-amber-50/60' : ''
        } ${draggedColKey === colKey ? 'opacity-40' : ''}`}
        title={isSortable ? 'Click to sort | Drag & drop to reorder column' : 'Drag & drop to reorder column'}
      >
        <div className={`flex items-center gap-1.5 ${colKey === 'actions' ? 'justify-end' : ''}`}>
          {colKey !== 'actions' && (
            <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-60 hover:opacity-100 shrink-0 cursor-grab" />
          )}
          <span>{label}</span>
          {isSortable && (
            isSorted ? (
              sortOrder === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
            )
          )}
        </div>
      </th>
    );
  };

  // Render Table Cell Helper (Matching Lead Pool Architecture)
  const renderBodyCell = (ct: any, opp: any, bq: any, colKey: string) => {
    const colMeta = ALL_COLUMNS.find((c) => c.key === colKey);
    if (!colMeta || !columnVisibility[colKey]) return null;

    switch (colKey) {
      case 'name':
        return (
          <td key={colKey} className="p-3 pl-4">
            <div 
              className="flex items-center gap-2.5 cursor-pointer group w-fit"
              onClick={() => handleOpenDrawer(ct)}
            >
              <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                activeTab === 'deleted' ? 'bg-red-100 text-red-800' : 'bg-[#081428] text-[#C8A147] group-hover:bg-[#C8A147] group-hover:text-white transition-colors'
              }`}>
                {ct.initials || ct.name?.substring(0, 2).toUpperCase() || 'CT'}
              </div>
              <div>
                <div className="font-bold text-[#081428] group-hover:text-[#C8A147] group-hover:underline transition-colors text-xs flex items-center gap-1.5 flex-wrap">
                  <span>{ct.name}</span>
                  {ct.state === 'duplicate' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-300">
                      <Copy className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                      <span>Duplicate</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </td>
        );

      case 'phone':
        return (
          <td key={colKey} className="p-3 font-mono text-slate-700 font-medium">
            {ct.phone ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="font-mono text-xs">{ct.phone}</span>
                <button
                  onClick={(e) => copyToClipboard(ct.phone, `phone-${ct.id}`, e)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                  title="Copy Phone"
                >
                  {copiedField === `phone-${ct.id}` ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ) : (
              '—'
            )}
          </td>
        );

      case 'secondary_phone':
        return (
          <td key={colKey} className="p-3 font-mono text-slate-600 font-medium">
            {ct.secondary_phone ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="font-mono text-xs">{ct.secondary_phone}</span>
                <button
                  onClick={(e) => copyToClipboard(ct.secondary_phone, `sec-phone-${ct.id}`, e)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                  title="Copy Secondary Phone"
                >
                  {copiedField === `sec-phone-${ct.id}` ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ) : (
              '—'
            )}
          </td>
        );

      case 'email':
        return <td key={colKey} className="p-3 text-slate-600 font-medium text-xs truncate max-w-[200px]">{ct.email || '—'}</td>;

      case 'nationality':
        return <td key={colKey} className="p-3 text-slate-700 font-medium text-xs">{ct.nationality || '—'}</td>;

      case 'created_at':
        return (
          <td key={colKey} className="p-3 text-slate-600 font-medium text-xs font-mono">
            {ct.created_at ? ct.created_at.replace('T', ' ').substring(0, 16) : '—'}
          </td>
        );

      case 'source': {
        const src = ct.source || 'Direct Inbound';
        const isPortal = src.includes('Property Finder') || src.includes('Bayut') || src.includes('Dubizzle');
        const isCampaign = src.includes('Meta') || src.includes('Facebook') || src.includes('Google') || src.includes('Ads');
        return (
          <td key={colKey} className="p-3">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
              isPortal 
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : isCampaign
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              {isPortal ? <Radio className="w-3 h-3" /> : isCampaign ? <Globe className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
              <span>{src}</span>
            </span>
          </td>
        );
      }

      case 'sub_source':
        return <td key={colKey} className="p-3 text-slate-600 text-xs">{ct.source?.match(/\((.*?)\)/)?.[1] || ct.utm_source || '—'}</td>;

      case 'utm_campaign': {
        const campaign = ct.utm_campaign || ct.utm_source;
        const campaignUrl = ct.campaign_url || ct.landing_page_url;
        return (
          <td key={colKey} className="p-3 text-xs">
            <div className="flex flex-col gap-0.5 max-w-[180px]">
              {campaign ? (
                <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 truncate inline-block" title={campaignUrl || campaign}>
                  {campaign}
                </span>
              ) : null}
              {campaignUrl ? (
                <a
                  href={campaignUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 hover:underline truncate block"
                  title={campaignUrl}
                >
                  {campaignUrl}
                </a>
              ) : !campaign ? (
                <span className="text-slate-400 text-xs">—</span>
              ) : null}
            </div>
          </td>
        );
      }

      case 'state':
        return (
          <td key={colKey} className="p-3">
            {ct.state === 'assigned' && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] uppercase font-bold">
                Assigned
              </span>
            )}
            {ct.state === 'active' && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] uppercase font-bold">
                Active Deal
              </span>
            )}
            {ct.state === 'available' && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] uppercase font-bold">
                New / Awaiting
              </span>
            )}
            {ct.state === 'duplicate' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] uppercase font-bold border border-purple-300">
                <Copy className="w-3 h-3 text-purple-600 shrink-0" />
                <span>Duplicate</span>
              </span>
            )}
          </td>
        );

      case 'opportunity':
        return (
          <td key={colKey} className="p-3">
            {opp ? (
              <div className="space-y-0.5">
                <Link 
                  href={`/opportunities/${opp.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-[#081428] hover:text-[#C8A147] hover:underline text-xs flex items-center gap-1"
                >
                  <span>{opp.buyer_qualification?.community || opp.community || 'Dubai Project'}</span>
                  <span className="text-[10px] font-normal text-[#6E6E6E]">({opp.bedrooms || '2BR'})</span>
                </Link>
                <div className="text-[10px] text-[#6E6E6E]">
                  Owner: <span className="font-semibold text-[#081428]">{opp.current_owner_name || ct.assigned_to || 'Unassigned'}</span>
                </div>
              </div>
            ) : ct.assigned_to ? (
              <div className="space-y-0.5">
                <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Assigned (No Deal Yet)
                </span>
                <div className="text-[10px] text-[#6E6E6E]">
                  Advisor: <span className="font-semibold text-[#081428]">{ct.assigned_to}</span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-[#6E6E6E] font-medium">Unassigned Lead</span>
            )}
          </td>
        );

      case 'opportunity_type':
        return <td key={colKey} className="p-3 font-semibold uppercase text-[11px] text-slate-700">{opp?.opportunity_type || ct.inquiry_specs?.opportunity_type || (ct.inquiry_specs ? 'buyer' : '—')}</td>;

      case 'developer':
        return <td key={colKey} className="p-3 text-slate-700 font-medium text-xs">{opp?.developer || bq?.developer || ct.inquiry_specs?.developer || '—'}</td>;

      case 'community':
        return <td key={colKey} className="p-3 text-slate-700 text-xs">{opp?.community || bq?.community || ct.inquiry_specs?.community || '—'}</td>;

      case 'project':
        return <td key={colKey} className="p-3 text-slate-700 font-semibold text-xs">{opp?.project || bq?.project || ct.inquiry_specs?.project || '—'}</td>;

      case 'project_property':
        return <td key={colKey} className="p-3 text-slate-700 text-xs">{opp?.project_property || bq?.project_property || ct.inquiry_specs?.project_property || '—'}</td>;

      case 'bedrooms':
        return <td key={colKey} className="p-3 text-slate-700 text-xs">{opp?.bedrooms || bq?.bedrooms || ct.inquiry_specs?.bedrooms || '—'}</td>;

      case 'budget_min': {
        const bMin = opp?.budget_min || ct.inquiry_specs?.budget_min;
        return <td key={colKey} className="p-3 font-mono text-emerald-700 font-semibold text-xs">{bMin ? `AED ${Number(bMin).toLocaleString()}` : '—'}</td>;
      }

      case 'budget_max': {
        const bMax = opp?.budget_max || ct.inquiry_specs?.budget_max;
        return <td key={colKey} className="p-3 font-mono text-emerald-700 font-semibold text-xs">{bMax ? `AED ${Number(bMax).toLocaleString()}` : '—'}</td>;
      }

      case 'cash_or_finance':
        return <td key={colKey} className="p-3 text-slate-700 font-medium text-xs">{opp?.cash_or_finance || bq?.cash_or_finance || ct.inquiry_specs?.cash_or_finance || '—'}</td>;

      case 'key_requirement':
        return <td key={colKey} className="p-3 text-slate-600 max-w-[200px] truncate text-xs">{opp?.key_requirement || ct.inquiry_specs?.key_requirement || '—'}</td>;

      case 'assigned_owner': {
        const ownerName = ct.assigned_to || opp?.current_owner_name || 'Unassigned';
        const isUnassigned = !ownerName || ownerName === 'Unassigned';
        return (
          <td key={colKey} className="p-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
              isUnassigned 
                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              <UserCheck className={`w-3.5 h-3.5 ${isUnassigned ? 'text-rose-500' : 'text-emerald-600'}`} />
              <span>{ownerName}</span>
            </span>
          </td>
        );
      }

      case 'next_action':
        return <td key={colKey} className="p-3 text-slate-600 max-w-[180px] truncate text-xs">{opp?.next_action || '—'}</td>;

      case 'next_action_due_at':
        return <td key={colKey} className="p-3 text-slate-600 text-xs">{opp?.next_action_due_at ? opp.next_action_due_at.substring(0, 16).replace('T', ' ') : '—'}</td>;

      case 'actions':
        return (
          <td key={colKey} className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
            {activeTab === 'deleted' ? (
              <div className="flex items-center justify-end gap-1.5">
                {mounted && hasPermission('leads.restore') && (
                  <button
                    onClick={() => handleRestoreContact(ct.id, ct.name)}
                    className="px-2 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded font-bold text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Restore</span>
                  </button>
                )}
                {mounted && hasPermission('leads.delete') && (
                  <button
                    onClick={() => handleForceDeleteContact(ct.id, ct.name)}
                    className="px-2 py-1 bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 rounded font-bold text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <UserX className="w-3 h-3" />
                    <span>Purge</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-end gap-1.5">
                {/* 1. View Summary Drawer */}
                <button
                  onClick={() => handleOpenDrawer(ct)}
                  className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-500 rounded border border-slate-200 transition-colors cursor-pointer"
                  title="View Lead Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                {/* 2. Edit Lead */}
                {mounted && hasPermission('leads.edit') && (
                  <Link
                    href={`/leads/${ct.id}/edit`}
                    className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-500 rounded border border-slate-200 transition-colors cursor-pointer inline-flex items-center justify-center"
                    title="Edit Lead Record"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Link>
                )}

                {/* 3. WhatsApp Direct Chat */}
                <Link
                  href={`/whatsapp?phone=${encodeURIComponent(ct.phone || '')}&name=${encodeURIComponent(ct.name || '')}`}
                  className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded border border-emerald-200 transition-colors"
                  title="Open WhatsApp Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </Link>

                {/* 4. Soft Delete */}
                {mounted && hasPermission('leads.delete') && (
                  <button
                    onClick={() => handleSoftDeleteContact(ct.id, ct.name)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-500 rounded border border-rose-200 transition-colors cursor-pointer"
                    title="Move to Trash Archive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </td>
        );

      default:
        return <td key={colKey} className="p-3 text-slate-400 text-xs">—</td>;
    }
  };

  // Dynamic Page Numbers
  const getPageNumbers = () => {
    const totalPages = paginationMeta.last_page;
    const current = paginationMeta.current_page;
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (canViewLeads === false) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col min-w-0">
          <Navbar />
          <AccessDenied moduleName="New Inbound Leads" requiredPermission="leads.view" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      {/* Deep Navy Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar onSearch={(q) => setSearchQuery(q)} />

        <main className="p-6 space-y-6 w-full">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">New Leads</h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Centralized Lead Bank for all Website, Social Media, Portals & Live Inbound Leads
              </p>
            </div>

            <div className="flex items-center gap-2.5 text-xs font-medium min-h-[36px]">
              {mounted ? (
                <>
                  {hasPermission('leads.export') && (
                    <button 
                      onClick={() => alert("Exporting New Leads database to Excel format...")}
                      className="px-3 py-2 bg-white border border-[#E8E4DC] rounded-md text-[#1A1A1A] hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#6E6E6E]" />
                      <span>Export</span>
                    </button>
                  )}

                  {hasPermission('leads.create') && (
                    <Link
                      href="/leads/create"
                      className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-white" />
                      <span className="text-white">Create Lead</span>
                    </Link>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* 5 KPI Stat Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Contacts', value: Number(stats?.total || 0).toLocaleString(), sub: 'Master Lead Bank', subColor: 'text-emerald-600', icon: Users, iconBg: 'bg-amber-100 text-amber-800' },
              { label: 'Available', value: Number(stats?.available || 0).toLocaleString(), sub: 'Ready to assign', subColor: 'text-emerald-600', icon: CheckCircle2, iconBg: 'bg-emerald-100 text-emerald-700' },
              { label: 'Active Opportunities', value: Number(stats?.active || 0).toLocaleString(), sub: 'In-progress deals', subColor: 'text-slate-500', icon: Briefcase, iconBg: 'bg-blue-100 text-blue-700' },
              { label: 'Reactivation', value: Number(stats?.reactivation || 0).toLocaleString(), sub: 'Eligible', subColor: 'text-slate-500', icon: RotateCcw, iconBg: 'bg-orange-100 text-orange-700' },
              { label: 'Duplicates', value: Number(stats?.duplicates || 0).toLocaleString(), sub: 'Need review', subColor: 'text-purple-600', icon: Copy, iconBg: 'bg-purple-100 text-purple-700' },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${card.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-heading font-bold text-xl text-[#081428] leading-tight">{card.value}</div>
                    <div className="text-[11px] font-medium text-[#6E6E6E]">{card.label}</div>
                    <div className={`text-[10px] font-semibold ${card.subColor}`}>{card.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MAIN NEW LEADS TOP TAB NAVIGATION (All, New, Duplicate, Deleted) */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg px-4 shadow-2xs flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'all', label: 'All Leads', count: tabCounts.all, color: 'text-[#081428]' },
              { id: 'unassigned', label: 'New', count: tabCounts.unassigned ?? tabCounts.new, color: 'text-amber-800' },
              { id: 'duplicate', label: 'Duplicate', count: tabCounts.duplicate, color: 'text-purple-800' },
              { id: 'deleted', label: 'Deleted', count: tabCounts.deleted, color: 'text-red-800' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                    isActive
                      ? 'border-[#C8A147] text-[#081428]'
                      : 'border-transparent text-[#6E6E6E] hover:text-[#081428] hover:border-slate-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition-colors ${
                      isActive
                        ? 'bg-[#081428] text-[#C8A147]'
                        : 'bg-slate-100 text-[#6E6E6E] border border-slate-200'
                    }`}
                  >
                    {Number(tab.count || 0).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary Filter Bar (Search, Date, Advanced, Advisor Selector, Reset on Left | Columns on Right) */}
          <div className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left Group: Search Input + Filters + Reset */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Live Search Input (Compact) */}
              <div className="flex items-center gap-2 w-56 sm:w-64 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors shrink-0">
                <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
                <input
                  type="text"
                  placeholder="Search name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none focus:outline-none text-xs text-[#1A1A1A] placeholder-[#6E6E6E]"
                />
              </div>

              {/* Date Range Calendar Filter */}
              <DateRangePicker
                value={dateRange}
                onChange={(val) => {
                  setDateRange(val);
                  setCurrentPage(1);
                }}
              />

              {/* Advanced Filter Button */}
              <button
                type="button"
                onClick={() => setIsAdvancedFilterOpen(true)}
                className={`p-1.5 px-3 rounded border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeAdvancedCount > 0
                    ? 'bg-[#081428] text-[#C8A147] border-[#C8A147] shadow-xs'
                    : 'bg-[#FAF8F5] border-[#E8E4DC] text-[#081428] hover:border-[#C8A147]'
                }`}
                title="Open Advanced Filters"
              >
                <Filter className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Advanced</span>
                {activeAdvancedCount > 0 && (
                  <span className="bg-[#C8A147] text-[#081428] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
                    {activeAdvancedCount}
                  </span>
                )}
              </button>

              {/* Agent / Scope Selector */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 shrink-0">
                <UserCheck className="w-3.5 h-3.5 text-[#C8A147]" />
                <select
                  value={selectedOwner === 'auto' ? (isSuperUser(currentUser) ? 'all' : (currentUser?.name || 'auto')) : selectedOwner}
                  onChange={(e) => {
                    setSelectedOwner(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer"
                >
                  {isSuperUser(currentUser) ? (
                    <>
                      <option value="all">👥 All Assigned Leads (Entire Team)</option>
                      {currentUser?.name && (
                        <option value={currentUser.name}>⭐ My Leads ({currentUser.name})</option>
                      )}
                      {activeAgents.filter((a) => a.name !== currentUser?.name).map((a) => (
                        <option key={a.id} value={a.name}>👤 {a.name} ({a.role})</option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value={currentUser?.name || 'auto'}>🎯 My Assigned Leads ({currentUser?.name || 'Assigned to Me'})</option>
                      <option value="all">👥 View Entire Lead Pool</option>
                    </>
                  )}
                </select>
              </div>

              {/* Reset Button */}
              <button 
                onClick={handleResetFilters} 
                className="text-xs text-[#C8A147] font-bold hover:underline px-1 transition-colors ml-1 cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Right Group: Columns Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnsDropdownOpen(!columnsDropdownOpen)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:border-[#C8A147] rounded text-xs text-[#081428] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Columns</span>
                <span className="bg-[#C8A147] text-white text-[10px] px-1.5 rounded-full font-bold">
                  {Object.values(columnVisibility).filter(Boolean).length}
                </span>
              </button>

              {columnsDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setColumnsDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E8E4DC] rounded-lg shadow-xl z-50 p-3 text-xs space-y-2 max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2 font-bold text-[#081428]">
                      <span>Manage Table Columns</span>
                      <button
                        type="button"
                        onClick={() => {
                          updateColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
                          updateColumnOrder(DEFAULT_COLUMN_ORDER);
                        }}
                        className="text-[11px] text-[#C8A147] hover:underline cursor-pointer"
                      >
                        Reset Default
                      </button>
                    </div>

                    {['Core', 'Client Details', 'Source Details', 'Opportunity Specs', 'SLA & Owner'].map((cat) => (
                      <div key={cat} className="space-y-1 pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E6E] bg-[#FAF8F5] px-1.5 py-0.5 rounded">
                          {cat}
                        </div>
                        {ALL_COLUMNS.filter((c) => c.category === cat && c.key !== 'actions').map((col) => (
                          <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-[#FAF8F5] rounded cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!columnVisibility[col.key]}
                              onChange={(e) => {
                                updateColumnVisibility({
                                  ...columnVisibility,
                                  [col.key]: e.target.checked,
                                });
                              }}
                              className="accent-[#C8A147] rounded cursor-pointer"
                            />
                            <span className={columnVisibility[col.key] ? 'font-semibold text-[#081428]' : 'text-slate-500'}>
                              {col.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* New Inbound Leads Table */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E8E4DC] text-[#6E6E6E] uppercase tracking-wider font-semibold">
                    <th className="p-3 pl-4 w-10">
                      <input
                        type="checkbox"
                        checked={contacts.length > 0 && selectedContactIds.length === contacts.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-[#C8A147] focus:ring-[#C8A147] cursor-pointer"
                      />
                    </th>
                    {columnOrder.map((colKey) => renderHeaderCell(colKey))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8E4DC]">
                  {loading ? (
                    <tr>
                      <td colSpan={(Object.values(columnVisibility).filter(Boolean).length || 1) + 1} className="p-12 text-center text-[#6E6E6E]">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <RefreshCw className="w-6 h-6 animate-spin text-[#C8A147]" />
                          <span className="font-medium">Loading New Inbound Leads...</span>
                        </div>
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={(Object.values(columnVisibility).filter(Boolean).length || 1) + 1} className="p-16 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center justify-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                            <Flame className="w-6 h-6" />
                          </div>
                          <h3 className="font-heading font-bold text-base text-[#081428]">No Inbound Leads Found</h3>
                          <p className="text-xs text-[#6E6E6E]">
                            No leads currently match the active filters. Live portal inquiries and campaign leads will appear here automatically.
                          </p>
                          <button
                            onClick={handleResetFilters}
                            className="mt-2 px-3 py-1.5 bg-[#081428] hover:bg-[#152744] text-[#C8A147] font-bold rounded text-xs transition-colors cursor-pointer"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    contacts.map((contact) => {
                      const opp = contact.opportunities && contact.opportunities.length > 0 ? contact.opportunities[0] : (contact.active_opportunity || contact.opportunity);
                      const bq = opp?.buyer_qualification || {};
                      const isSelected = selectedContactIds.includes(contact.id);
                      return (
                        <tr
                          key={contact.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-amber-50/60' :
                            contact.state === 'duplicate' ? 'bg-purple-50/30 hover:bg-purple-50/50' :
                            'hover:bg-[#FAF8F5]/80'
                          }`}
                        >
                          <td className="p-3 pl-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(contact.id)}
                              className="rounded border-slate-300 text-[#C8A147] focus:ring-[#C8A147] cursor-pointer"
                            />
                          </td>
                          {columnOrder.map((colKey) => renderBodyCell(contact, opp, bq, colKey))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SERVER-SIDE DATABASE PAGINATION FOOTER BAR */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6E6E]">
              <div>
                Showing <span className="font-bold text-[#081428]">{paginationMeta.from || 0}</span> to{' '}
                <span className="font-bold text-[#081428]">{paginationMeta.to || 0}</span> of{' '}
                <span className="font-bold text-[#081428]">{Number(paginationMeta.total || 0).toLocaleString()}</span> results
              </div>

              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Dynamic Page Buttons */}
                {getPageNumbers().map((p, idx) => {
                  if (typeof p === 'string') {
                    return (
                      <span key={`dots-${idx}`} className="px-1 text-slate-400 font-semibold">
                        ...
                      </span>
                    );
                  }

                  const isCurrent = p === currentPage;
                  return (
                    <button
                      key={`page-${p}`}
                      onClick={() => handlePageChange(p as number)}
                      disabled={loading}
                      className={`w-7 h-7 rounded text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? 'font-bold bg-[#C8A147] text-white shadow-xs'
                          : 'font-medium border border-[#E8E4DC] hover:bg-white text-[#1A1A1A]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= paginationMeta.last_page || loading}
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Per Page Select Dropdown */}
              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
                className="p-1.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-medium"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedContactIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#081428] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-4 border border-[#C8A147]/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#C8A147] text-[#081428] font-bold text-xs flex items-center justify-center">
                  {selectedContactIds.length}
                </span>
                <span className="text-xs font-semibold">Leads Selected</span>
              </div>

              <div className="h-4 w-px bg-white/20" />

              {activeTab === 'deleted' ? (
                <div className="flex items-center gap-2">
                  {mounted && hasPermission('leads.restore') && (
                    <button
                      onClick={handleExecuteBulkRestore}
                      disabled={bulkLoading}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      title="Restore selected leads back to Lead Pool"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>{bulkLoading ? 'Restoring...' : 'Restore to Pool'}</span>
                    </button>
                  )}

                  {mounted && hasPermission('leads.delete') && (
                    <button
                      onClick={handleExecuteBulkPermanentDelete}
                      disabled={bulkLoading}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      title="Permanently purge selected leads from database"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>{bulkLoading ? 'Purging...' : 'Purge Permanently'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedContactIds([])}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={bulkAssignOwner}
                    onChange={(e) => setBulkAssignOwner(e.target.value)}
                    className="bg-[#122444] border border-[#1f3864] text-white text-xs font-semibold rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#C8A147]"
                  >
                    <option value="">Select Advisor / Owner...</option>
                    {activeAgents.map((ag: any) => (
                      <option key={ag.id} value={ag.name}>
                        {ag.name} ({ag.role || 'Agent'})
                      </option>
                    ))}
                    <option value="Unassigned">Unassigned</option>
                  </select>

                  <button
                    onClick={() => handleExecuteBulkAssign()}
                    disabled={!bulkAssignOwner || bulkLoading}
                    className="px-3.5 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{bulkLoading ? 'Assigning...' : 'Assign Selected'}</span>
                  </button>

                  <button
                    onClick={handleExecuteBulkDelete}
                    disabled={bulkLoading}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Trash</span>
                  </button>

                  <button
                    onClick={() => setSelectedContactIds([])}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Advanced Filter Modal */}
      <AdvancedFilterModal
        isOpen={isAdvancedFilterOpen}
        onClose={() => setIsAdvancedFilterOpen(false)}
        filters={advancedFilters}
        onApply={(newFilters) => {
          setAdvancedFilters(newFilters);
          setCurrentPage(1);
        }}
        onReset={() => {
          setAdvancedFilters(INITIAL_ADVANCED_FILTERS);
          setCurrentPage(1);
        }}
        activeCount={activeAdvancedCount}
      />

      {/* Full Contact Summary Drawer */}
      <ContactDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        contact={selectedContact}
      />
    </div>
  );
}
