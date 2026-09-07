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
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, UserCheck, X,
  Eye, Edit3, MessageSquare, Check, Zap, Filter, Flame, Globe, Radio
} from 'lucide-react';
import Link from 'next/link';
import { hasPermission, refreshCurrentUser } from '@/lib/permissions';
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
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [mounted, setMounted] = useState<boolean>(false);

  // Drawer & Modals
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Top Tabs State: 'unassigned' (Default) | 'all' | 'assigned' | 'duplicate'
  const [activeTab, setActiveTab] = useState<'unassigned' | 'all' | 'assigned' | 'duplicate'>('unassigned');
  const [tabCounts, setTabCounts] = useState({ all: 0, unassigned: 0, new: 0, assigned: 0, duplicate: 0, deleted: 0 });

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
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

  // Default Column Visibility
  const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
    name: true,
    phone: true,
    secondary_phone: false,
    email: true,
    nationality: true,
    source: true,
    utm_campaign: true,
    state: true,
    assigned_owner: true,
    created_at: true,
    actions: true,
  };

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  const AVAILABLE_COLUMNS = [
    { key: 'name', label: 'Client Name', mandatory: true },
    { key: 'phone', label: 'Primary Phone', mandatory: true },
    { key: 'secondary_phone', label: 'Secondary Phone', mandatory: false },
    { key: 'email', label: 'Email Address', mandatory: true },
    { key: 'nationality', label: 'Nationality', mandatory: false },
    { key: 'source', label: 'Inbound Channel / Portal', mandatory: false },
    { key: 'utm_campaign', label: 'UTM Campaign / URL', mandatory: false },
    { key: 'state', label: 'Lifecycle Status', mandatory: false },
    { key: 'assigned_owner', label: 'Assigned Advisor', mandatory: false },
    { key: 'created_at', label: 'Created Date & Time', mandatory: false },
    { key: 'actions', label: 'Actions', mandatory: true },
  ];

  const toggleColumn = (colKey: string) => {
    if (colKey === 'name' || colKey === 'phone' || colKey === 'email' || colKey === 'actions') return;
    setColumnVisibility((prev) => ({ ...prev, [colKey]: !prev[colKey] }));
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
    try {
      const raw = localStorage.getItem('crm_user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {}
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
    dateRangeOverride?: DateRangeValue,
    chanOverride?: string
  ) => {
    setLoading(true);
    try {
      // inbound_only=1 strictly excludes batch file imports
      let endpoint = `/contacts?inbound_only=1&page=${page}&per_page=${limit}&tab=${activeTab}&sort_by=${sBy}&sort_order=${sOrder}`;
      
      if (searchQuery) {
        endpoint += `&search=${encodeURIComponent(searchQuery)}`;
      }

      // Channel / Portal Filter
      const activeChan = chanOverride !== undefined ? chanOverride : channelFilter;
      if (activeChan && activeChan !== 'all') {
        endpoint += `&source=${encodeURIComponent(activeChan)}`;
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
      if (activeFilters.source && (!activeChan || activeChan === 'all')) {
        endpoint += `&source=${encodeURIComponent(activeFilters.source)}`;
      }
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

      const targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;
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

      setTabCounts(res.tab_counts || { all: 0, unassigned: 0, new: 0, assigned: 0, duplicate: 0, deleted: 0 });
      setLoading(false);
    } catch (err) {
      console.error('Failed to load inbound contacts:', err);
      setContacts([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData(1, perPage, sortBy, sortOrder, selectedOwner, advancedFilters, dateRange, channelFilter);
  }, [activeTab, searchQuery, selectedOwner, channelFilter, advancedFilters, dateRange]);

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
    setActiveTab('unassigned');
    setSelectedOwner('all');
    setChannelFilter('all');
    setAdvancedFilters(INITIAL_ADVANCED_FILTERS);
    setDateRange({ from: '', to: '', preset: 'all' });
    setSearchQuery('');
    setSortBy('created_at');
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

  // Render Table Cell Helper
  const renderCell = (colKey: string, ct: any) => {
    switch (colKey) {
      case 'name':
        return (
          <td key={colKey} className="p-3 font-medium text-[#1A1A1A]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#081428] text-[#C8A147] font-bold text-[11px] flex items-center justify-center shrink-0 shadow-xs border border-[#C8A147]/30">
                {ct.initials || ct.name?.substring(0, 2).toUpperCase() || 'CT'}
              </div>
              <button
                onClick={() => handleOpenDrawer(ct)}
                className="font-bold text-[#081428] hover:text-[#C8A147] transition-colors text-left flex items-center gap-1.5 cursor-pointer"
              >
                <span>{ct.name}</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-normal bg-slate-100 text-slate-500 border border-slate-200">
                  #{ct.id}
                </span>
              </button>
            </div>
          </td>
        );

      case 'phone':
        return (
          <td key={colKey} className="p-3 font-mono text-[#1A1A1A] font-semibold">
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="font-mono text-xs text-slate-800">{ct.phone}</span>
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

      case 'source':
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

      case 'utm_campaign':
        const campaign = ct.utm_campaign || ct.utm_source;
        return (
          <td key={colKey} className="p-3 text-xs max-w-[180px] truncate text-slate-600">
            {campaign ? (
              <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100" title={ct.landing_page_url || campaign}>
                {campaign}
              </span>
            ) : ct.landing_page_url ? (
              <span className="text-[10px] text-slate-500 truncate" title={ct.landing_page_url}>
                {ct.landing_page_url}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        );

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
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] uppercase font-bold">
                Duplicate
              </span>
            )}
          </td>
        );

      case 'assigned_owner':
        const ownerName = ct.assigned_to || ct.opportunity?.current_owner_name || 'Unassigned';
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

      case 'created_at':
        return (
          <td key={colKey} className="p-3 text-slate-600 font-medium text-xs font-mono">
            {ct.created_at ? ct.created_at.replace('T', ' ').substring(0, 16) : '—'}
          </td>
        );

      case 'actions':
        return (
          <td key={colKey} className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
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
          </td>
        );

      default:
        return <td key={colKey} className="p-3 text-slate-400 text-xs">—</td>;
    }
  };

  // Render Sort Header Helper
  const renderSortableHeader = (columnKey: string, label: string) => {
    const isSorted = sortBy === columnKey;
    return (
      <th 
        key={columnKey}
        onClick={() => handleSort(columnKey)}
        className="p-3 cursor-pointer hover:bg-[#F3EEDD] transition-colors select-none group"
      >
        <div className="flex items-center gap-1.5 font-semibold text-xs text-[#081428]">
          <span>{label}</span>
          {isSorted ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-[#C8A147]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-[#C8A147]" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </th>
    );
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
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex font-['Poppins',sans-serif]">
      {/* Deep Navy Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar onSearch={(q) => setSearchQuery(q)} />

        <main className="p-6 space-y-6 w-full">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-2xl text-[#081428]">New Leads</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Flame className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span>Live Inbound</span>
                </span>
              </div>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Real-time portal webhooks, campaign inquiries, and manual registrations awaiting allocation
              </p>
            </div>

            <div className="flex items-center gap-2.5 text-xs font-medium min-h-[36px]">
              {mounted && hasPermission('leads.create') && (
                <Link
                  href="/leads/create"
                  className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span className="text-white">Create Lead</span>
                </Link>
              )}
            </div>
          </div>

          {/* 5 KPI Stat Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Inbound Leads', value: Number(stats?.inbound_total || stats?.total || 0).toLocaleString(), sub: 'Non-Imported Master Pool', subColor: 'text-emerald-600', icon: Users, iconBg: 'bg-amber-100 text-amber-800' },
              { label: 'Awaiting Allocation', value: Number(stats?.inbound_unassigned || stats?.available || 0).toLocaleString(), sub: 'Requires Assignment', subColor: 'text-rose-600', icon: CheckCircle2, iconBg: 'bg-rose-100 text-rose-700' },
              { label: 'Portal Inquiries', value: Number(stats?.inbound_portals || 0).toLocaleString(), sub: 'PF, Bayut, Dubizzle', subColor: 'text-purple-600', icon: Radio, iconBg: 'bg-purple-100 text-purple-700' },
              { label: 'Campaign Ads', value: Number(stats?.inbound_campaigns || 0).toLocaleString(), sub: 'Meta, Google & Web', subColor: 'text-blue-600', icon: Globe, iconBg: 'bg-blue-100 text-blue-700' },
              { label: 'Allocated / In Deal', value: Number(tabCounts?.assigned || stats?.active || 0).toLocaleString(), sub: 'Assigned to Advisors', subColor: 'text-emerald-600', icon: UserCheck, iconBg: 'bg-emerald-100 text-emerald-700' },
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

          {/* Top Tab Navigation (New / Unassigned, All Inbound, Assigned, Duplicate) */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg px-4 shadow-2xs flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'unassigned', label: 'New / Awaiting Allocation', count: tabCounts.new ?? tabCounts.unassigned, color: 'text-amber-800' },
              { id: 'all', label: 'All Inbound Leads', count: tabCounts.all, color: 'text-[#081428]' },
              { id: 'assigned', label: 'Assigned', count: tabCounts.assigned, color: 'text-emerald-800' },
              { id: 'duplicate', label: 'Duplicate', count: tabCounts.duplicate, color: 'text-purple-800' },
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

          {/* Secondary Filter Toolbar */}
          <div className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left Group: Search, Date, Channel, Advisor, Advanced */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
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

              {/* Date Range Calendar */}
              <DateRangePicker
                value={dateRange}
                onChange={(val) => {
                  setDateRange(val);
                  setCurrentPage(1);
                }}
              />

              {/* Inbound Channel / Portal Filter */}
              <select
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] font-medium focus:outline-none focus:border-[#C8A147]"
              >
                <option value="all">All Inbound Channels</option>
                <option value="Property Finder">Property Finder</option>
                <option value="Bayut">Bayut UAE</option>
                <option value="Dubizzle">Dubizzle</option>
                <option value="Meta Ads">Meta (Facebook / IG)</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Website">Direct Website Form</option>
                <option value="Manual">Manual Entry</option>
              </select>

              {/* Assigned Advisor Filter */}
              <select
                value={selectedOwner}
                onChange={(e) => {
                  setSelectedOwner(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] font-medium focus:outline-none focus:border-[#C8A147]"
              >
                <option value="all">All Advisors</option>
                <option value="Unassigned">Unassigned Only</option>
                {activeAgents.map((agent: any) => (
                  <option key={agent.id} value={agent.name}>
                    {agent.name} ({agent.role || 'Advisor'})
                  </option>
                ))}
              </select>

              {/* Advanced Filters Trigger Button */}
              <button
                onClick={() => setIsAdvancedFilterOpen(true)}
                className={`px-3 py-1.5 rounded border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeAdvancedCount > 0
                    ? 'bg-[#081428] text-[#C8A147] border-[#081428]'
                    : 'bg-[#FAF8F5] text-[#1A1A1A] border-[#E8E4DC] hover:bg-slate-100'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeAdvancedCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#C8A147] text-white text-[10px] font-bold flex items-center justify-center">
                    {activeAdvancedCount}
                  </span>
                )}
              </button>

              {/* Reset Filters */}
              {(searchQuery || selectedOwner !== 'all' || channelFilter !== 'all' || activeAdvancedCount > 0 || dateRange.from || activeTab !== 'unassigned') && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#6E6E6E] hover:text-[#081428] rounded border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                  title="Reset all active filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Right Group: Column Customization Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                className="px-3 py-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-white text-[#1A1A1A] rounded flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#6E6E6E]" />
                <span>Customize Columns</span>
              </button>

              {isColumnDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E8E4DC] rounded-lg shadow-xl z-20 p-2 space-y-1">
                  <div className="text-[11px] font-bold text-[#6E6E6E] px-2 py-1 uppercase tracking-wider">
                    Toggle Table Columns
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {AVAILABLE_COLUMNS.map((col) => {
                      // Actions column is permanent and mandatory per domain rule
                      if (col.key === 'actions') return null;
                      return (
                        <label
                          key={col.key}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs"
                        >
                          <span className={col.mandatory ? 'font-semibold text-slate-700' : 'text-slate-600'}>
                            {col.label} {col.mandatory && <span className="text-[10px] text-slate-400">(Required)</span>}
                          </span>
                          <input
                            type="checkbox"
                            checked={!!columnVisibility[col.key]}
                            onChange={() => toggleColumn(col.key)}
                            disabled={col.mandatory}
                            className="rounded border-slate-300 text-[#C8A147] focus:ring-[#C8A147]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Bulk Assignment Action Bar */}
          {selectedContactIds.length > 0 && (
            <div className="p-3 bg-[#081428] text-white rounded-lg shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-[#C8A147] text-[#081428] font-bold rounded text-xs font-mono">
                  {selectedContactIds.length} Selected
                </span>
                <span className="text-xs text-slate-300">
                  Bulk allocate inbound leads to an advisor or trigger round-robin distribution:
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Advisor Select Dropdown */}
                <select
                  value={bulkAssignOwner}
                  onChange={(e) => setBulkAssignOwner(e.target.value)}
                  disabled={bulkLoading}
                  className="bg-[#152744] text-white border border-[#233d66] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#C8A147]"
                >
                  <option value="">-- Choose Advisor --</option>
                  {activeAgents.map((agent: any) => (
                    <option key={agent.id} value={agent.name}>
                      {agent.name} ({agent.role || 'Advisor'})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleExecuteBulkAssign()}
                  disabled={bulkLoading || !bulkAssignOwner}
                  className="px-3 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assign to Advisor</span>
                </button>

                {/* Auto-Distribute Selected Button */}
                <button
                  onClick={() => handleExecuteBulkAssign('auto')}
                  disabled={bulkLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  title="Distribute evenly across active advisors using intelligent round-robin"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Auto-Distribute</span>
                </button>

                {/* Bulk Delete */}
                <button
                  onClick={handleExecuteBulkDelete}
                  disabled={bulkLoading}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Trash</span>
                </button>

                {/* Cancel / Clear Selection */}
                <button
                  onClick={() => setSelectedContactIds([])}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#152744] transition-colors cursor-pointer"
                  title="Clear Selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

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
                    {AVAILABLE_COLUMNS.filter((c) => columnVisibility[c.key]).map((col) => {
                      if (col.key === 'actions') {
                        return (
                          <th key={col.key} className="p-3 pr-4 text-right">
                            <span className="font-semibold text-xs text-[#081428]">{col.label}</span>
                          </th>
                        );
                      }
                      return renderSortableHeader(col.key, col.label);
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8E4DC]">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="p-12 text-center text-[#6E6E6E]">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <RefreshCw className="w-6 h-6 animate-spin text-[#C8A147]" />
                          <span className="font-medium">Loading New Inbound Leads...</span>
                        </div>
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-16 text-center">
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
                      const isSelected = selectedContactIds.includes(contact.id);
                      return (
                        <tr
                          key={contact.id}
                          onClick={() => handleOpenDrawer(contact)}
                          className={`hover:bg-[#FAF8F5]/80 transition-colors cursor-pointer ${
                            isSelected ? 'bg-amber-50/60' : ''
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
                          {AVAILABLE_COLUMNS.filter((c) => columnVisibility[c.key]).map((col) =>
                            renderCell(col.key, contact)
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-[#6E6E6E]">
                <span>
                  Showing <span className="font-bold text-[#081428]">{paginationMeta.from}</span> to{' '}
                  <span className="font-bold text-[#081428]">{paginationMeta.to}</span> of{' '}
                  <span className="font-bold text-[#081428]">{paginationMeta.total}</span> inbound leads
                </span>

                <div className="flex items-center gap-1.5 ml-2">
                  <span>Per page:</span>
                  <select
                    value={perPage}
                    onChange={(e) => handlePerPageChange(Number(e.target.value))}
                    className="bg-white border border-[#E8E4DC] rounded px-2 py-1 text-xs font-semibold text-[#081428] focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1.5 bg-white border border-[#E8E4DC] rounded text-[#081428] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                {getPageNumbers().map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400">
                        ...
                      </span>
                    );
                  }
                  const isCur = currentPage === p;
                  return (
                    <button
                      key={`page-${p}`}
                      onClick={() => handlePageChange(Number(p))}
                      className={`w-7 h-7 rounded text-xs font-bold transition-colors cursor-pointer ${
                        isCur
                          ? 'bg-[#081428] text-[#C8A147] shadow-2xs'
                          : 'bg-white border border-[#E8E4DC] text-[#081428] hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= paginationMeta.last_page}
                  className="px-2.5 py-1.5 bg-white border border-[#E8E4DC] rounded text-[#081428] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
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
