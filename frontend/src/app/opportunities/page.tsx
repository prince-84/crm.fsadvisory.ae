'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import CreateOpportunityModal from '@/components/CreateOpportunityModal';
import { fetchApi } from '@/lib/api';
import { hasPermission, isSuperUser } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';
import { 
  Briefcase, 
  ChevronRight, 
  Filter, 
  Search, 
  Flame, 
  Clock, 
  Plus, 
  Trash2, 
  Kanban, 
  List, 
  Sparkles, 
  FileText,
  User, 
  Phone, 
  Building, 
  DollarSign, 
  MapPin, 
  GripVertical, 
  PhoneCall, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  TrendingUp,
  X,
  SlidersHorizontal,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function OpportunitiesPage() {
  const [canViewDeals, setCanViewDeals] = useState<boolean | null>(null);
  const [canDeleteDeals, setCanDeleteDeals] = useState<boolean>(false);
  const [canBulkDeleteDeals, setCanBulkDeleteDeals] = useState<boolean>(false);

  useEffect(() => {
    const checkPerms = () => {
      setCanViewDeals(hasPermission('deals.view'));
      setCanDeleteDeals(hasPermission('deals.delete'));
      setCanBulkDeleteDeals(hasPermission('deals.bulk_delete'));
    };
    checkPerms();
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);

  // Multi-Selection State for Bulk Actions
  const [selectedOppIds, setSelectedOppIds] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pipelineData, setPipelineData] = useState<any>({
    contacted: [],
    qualified: [],
    option_sent: [],
    follow_up: [],
    meeting: [],
    future_prospectus: [],
    closed: [],
  });
  const [allOpps, setAllOpps] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'kanban' or 'list'
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTemp, setFilterTemp] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Drag & Drop states for Kanban
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Modal states
  const [isOppModalOpen, setIsOppModalOpen] = useState(false);
  const [selectedContactForOpp, setSelectedContactForOpp] = useState<any | null>(null);

  // Owner & Scope State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teamAgents, setTeamAgents] = useState<any[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('auto');

  // Copy to clipboard helper
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = (text: string, fieldKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Opportunity Columns Spectrum
  const ALL_OPP_COLUMNS = [
    { key: 'id', label: 'Deal ID', category: 'Core' },
    { key: 'client', label: 'Client Contact', category: 'Core' },
    { key: 'phone', label: 'Primary Phone', category: 'Client Details' },
    { key: 'type_temp', label: 'Type & Temp', category: 'Core' },
    { key: 'budget', label: 'Budget Range', category: 'Core' },
    { key: 'stage', label: 'Pipeline Stage', category: 'Core' },
    { key: 'developer', label: 'Developer', category: 'Property Specs' },
    { key: 'community', label: 'Community', category: 'Property Specs' },
    { key: 'project', label: 'Project', category: 'Property Specs' },
    { key: 'project_property', label: 'Unit / Property', category: 'Property Specs' },
    { key: 'property_type', label: 'Property Type', category: 'Property Specs' },
    { key: 'bedrooms', label: 'Bedrooms', category: 'Property Specs' },
    { key: 'cash_or_finance', label: 'Payment Method', category: 'Property Specs' },
    { key: 'owner', label: 'Advisor / Owner', category: 'Core' },
    { key: 'next_action', label: 'Next Action', category: 'SLA & Timestamps' },
    { key: 'next_action_due_at', label: 'Next Action Due', category: 'SLA & Timestamps' },
    { key: 'sla_status', label: 'SLA Status', category: 'SLA & Timestamps' },
    { key: 'created_at', label: 'Created Date', category: 'SLA & Timestamps' },
    { key: 'updated_at', label: 'Last Update', category: 'SLA & Timestamps' },
    { key: 'secondary_phone', label: 'Secondary Phone', category: 'Client Details' },
    { key: 'email', label: 'Email Address', category: 'Client Details' },
    { key: 'nationality', label: 'Nationality', category: 'Client Details' },
    { key: 'source', label: 'Source Channel', category: 'Client Details' },
    { key: 'purchase_timeline', label: 'Purchase Timeline', category: 'Property Specs' },
    { key: 'lead_score', label: 'Lead Score', category: 'Property Specs' },
    { key: 'key_requirement', label: 'Key Requirement', category: 'Property Specs' },
    { key: 'actions', label: 'Actions', category: 'Core' },
  ];

  const DEFAULT_OPP_COLUMN_VISIBILITY: Record<string, boolean> = {
    id: true,
    client: true,
    phone: true,
    type_temp: true,
    budget: true,
    stage: true,
    developer: true,
    community: true,
    project: false,
    project_property: false,
    property_type: false,
    bedrooms: false,
    cash_or_finance: false,
    owner: true,
    next_action: true,
    next_action_due_at: false,
    sla_status: true,
    created_at: true,
    updated_at: false,
    secondary_phone: false,
    email: false,
    nationality: false,
    source: false,
    purchase_timeline: false,
    lead_score: false,
    key_requirement: false,
    actions: true,
  };

  const DEFAULT_OPP_COLUMN_ORDER = [
    'id',
    'client',
    'phone',
    'type_temp',
    'budget',
    'stage',
    'developer',
    'community',
    'project',
    'project_property',
    'property_type',
    'bedrooms',
    'cash_or_finance',
    'owner',
    'next_action',
    'next_action_due_at',
    'sla_status',
    'created_at',
    'updated_at',
    'secondary_phone',
    'email',
    'nationality',
    'source',
    'purchase_timeline',
    'lead_score',
    'key_requirement',
    'actions',
  ];

  const OPP_VISIBILITY_STORAGE_KEY = 'opportunities_column_visibility_v1';
  const OPP_ORDER_STORAGE_KEY = 'opportunities_column_order_v1';

  // Dynamic Column Visibility & Order States
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_OPP_COLUMN_VISIBILITY);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_OPP_COLUMN_ORDER);

  // Database Sorting State
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Drag and Drop States for Header Reordering
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  const handleColDragStart = (e: React.DragEvent, colKey: string) => {
    if (colKey === 'actions') return;
    setDraggedColKey(colKey);
    e.dataTransfer.setData('text/plain', colKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColDragOver = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    if (targetColKey === 'actions') return;
    if (draggedColKey && draggedColKey !== targetColKey) {
      setDragOverColKey(targetColKey);
    }
  };

  const handleColDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColKey(null);
  };

  const handleColDrop = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    setDragOverColKey(null);
    if (!draggedColKey || draggedColKey === targetColKey || targetColKey === 'actions') return;

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColKey);
    const targetIndex = newOrder.indexOf(targetColKey);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedColKey);
      // Guarantee actions always remains pinned at the end
      const withoutActions = newOrder.filter((k) => k !== 'actions');
      withoutActions.push('actions');
      updateColumnOrder(withoutActions);
    }
    setDraggedColKey(null);
  };

  const updateColumnVisibility = (newVisibility: Record<string, boolean>) => {
    setColumnVisibility(newVisibility);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OPP_VISIBILITY_STORAGE_KEY, JSON.stringify(newVisibility));
    }
  };

  const updateColumnOrder = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OPP_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
    }
  };

  // Load saved column preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const validKeys = ALL_OPP_COLUMNS.map((c) => c.key);
      const savedVis = localStorage.getItem(OPP_VISIBILITY_STORAGE_KEY);
      if (savedVis) {
        try {
          const parsedVis = JSON.parse(savedVis);
          const cleanVis: Record<string, boolean> = { ...DEFAULT_OPP_COLUMN_VISIBILITY };
          validKeys.forEach((k) => {
            if (k in parsedVis) {
              cleanVis[k] = !!parsedVis[k];
            }
          });
          cleanVis.created_at = true; // By default Created Date must be enabled
          cleanVis.actions = true;
          setColumnVisibility(cleanVis);
        } catch (e) {
          console.error('Error parsing opportunities column visibility:', e);
        }
      }

      const savedOrder = localStorage.getItem(OPP_ORDER_STORAGE_KEY);
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            let sanitized = parsed.filter((k: string) => validKeys.includes(k) && k !== 'actions');
            if (!sanitized.includes('created_at')) sanitized.push('created_at');
            sanitized.push('actions');
            setColumnOrder(sanitized);
          }
        } catch (e) {
          console.error('Error parsing opportunities column order:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('crm_user');
      if (raw) {
        setCurrentUser(JSON.parse(raw));
      }
    } catch (e) {
      console.error(e);
    }

    fetchApi('/users')
      .then((data) => {
        const rawUsers = Array.isArray(data) ? data : (data?.users || []);
        if (rawUsers.length > 0) {
          setTeamAgents(rawUsers.filter((u: any) => u.is_active));
        }
      })
      .catch(console.error);
  }, []);

  const loadOpportunitiesData = async (ownerOverride?: string, sByOverride?: string, sOrderOverride?: string) => {
    setLoading(true);
    try {
      let raw = localStorage.getItem('crm_user');
      let user = currentUser;
      if (!user && raw) {
        try { user = JSON.parse(raw); } catch {}
      }

      const curSortBy = sByOverride !== undefined ? sByOverride : sortBy;
      const curSortOrder = sOrderOverride !== undefined ? sOrderOverride : sortOrder;

      let url = `/opportunities?sort_by=${encodeURIComponent(curSortBy)}&sort_order=${encodeURIComponent(curSortOrder)}`;
      let targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;
      if (targetOwner === 'auto') {
        targetOwner = isSuperUser(user) ? 'all' : (user?.name || 'all');
      }

      if (targetOwner && targetOwner !== 'all') {
        url += `&owner=${encodeURIComponent(targetOwner)}`;
      }

      const res = await fetchApi(url);
      const pipe = res.pipeline || {
        contacted: [],
        qualified: [],
        option_sent: [],
        follow_up: [],
        meeting: [],
        future_prospectus: [],
        closed: [],
      };
      setPipelineData(pipe);

      const flattened = [
        ...(pipe.contacted || []),
        ...(pipe.qualified || []),
        ...(pipe.option_sent || []),
        ...(pipe.follow_up || []),
        ...(pipe.meeting || []),
        ...(pipe.future_prospectus || []),
        ...(pipe.closed || []),
      ];
      // Use database-sorted opportunities for List View; fallback to flattened
      setAllOpps(res.opportunities || flattened);

      const contactsRes = await fetchApi('/contacts');
      setContacts(contactsRes.contacts?.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load opportunities:', err);
      setLoading(false);
    }
  };

  const handleSort = (colKey: string) => {
    if (colKey === 'actions') return;
    if (sortBy === colKey) {
      const nextOrder: 'asc' | 'desc' = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(nextOrder);
      loadOpportunitiesData(undefined, colKey, nextOrder);
    } else {
      const defaultOrder: 'asc' | 'desc' = ['created_at', 'updated_at', 'budget', 'lead_score', 'next_action_due_at'].includes(colKey)
        ? 'desc'
        : 'asc';
      setSortBy(colKey);
      setSortOrder(defaultOrder);
      loadOpportunitiesData(undefined, colKey, defaultOrder);
    }
  };

  useEffect(() => {
    loadOpportunitiesData();
  }, [selectedOwner]);

  // Filtered Opportunities
  const filteredOpps = useMemo(() => {
    return allOpps.filter((opp: any) => {
      const contact = opp.contact || {};
      const qual = opp.buyer_qualification || {};
      const query = searchQuery.toLowerCase().trim();

      if (query) {
        const nameMatch = (contact.name || '').toLowerCase().includes(query);
        const phoneMatch = (contact.phone || '').toLowerCase().includes(query);
        const commMatch = (qual.community || '').toLowerCase().includes(query);
        const devMatch = (qual.developer || '').toLowerCase().includes(query);
        const ownerMatch = (opp.current_owner_name || '').toLowerCase().includes(query);
        const idMatch = String(opp.id).includes(query);
        if (!nameMatch && !phoneMatch && !commMatch && !devMatch && !ownerMatch && !idMatch) {
          return false;
        }
      }

      if (filterTemp !== 'all' && opp.temperature !== filterTemp) return false;
      if (filterType !== 'all' && opp.opportunity_type !== filterType) return false;

      return true;
    });
  }, [allOpps, searchQuery, filterTemp, filterType]);

  // Drag & Drop Handler for Kanban
  const handleDrop = async (oppId: number, targetStage: string) => {
    setDragOverCol(null);
    setDraggingId(null);

    const targetOpp = allOpps.find((o) => o.id === oppId);
    if (!targetOpp || targetOpp.stage === targetStage) return;

    // Optimistic UI update
    setAllOpps((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, stage: targetStage } : o))
    );
    setPipelineData((prev: any) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((st) => {
        updated[st] = (updated[st] || []).filter((o: any) => o.id !== oppId);
      });
      if (!updated[targetStage]) updated[targetStage] = [];
      updated[targetStage] = [{ ...targetOpp, stage: targetStage }, ...updated[targetStage]];
      return updated;
    });

    try {
      await fetchApi(`/opportunities/${oppId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: targetStage }),
      });

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1800,
      });
      Toast.fire({
        icon: 'success',
        title: `Stage updated to ${targetStage.replace('_', ' ').toUpperCase()}`,
      });

      loadOpportunitiesData();
    } catch (err) {
      console.error('Failed to update stage:', err);
      Swal.fire('Error', 'Failed to update opportunity stage.', 'error');
      loadOpportunitiesData();
    }
  };

  const handleDeleteOpportunity = async (oppId: number, oppName: string) => {
    const result = await Swal.fire({
      title: 'Delete Opportunity?',
      text: `Are you sure you want to permanently delete Opportunity #${oppId} (${oppName})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Delete Deal',
    });

    if (result.isConfirmed) {
      try {
        await fetchApi(`/opportunities/${oppId}`, { method: 'DELETE' });
        Swal.fire('Deleted', 'Opportunity has been removed.', 'success');
        loadOpportunitiesData();
      } catch (err) {
        console.error('Failed to delete opportunity:', err);
        Swal.fire('Error', 'Failed to delete opportunity.', 'error');
      }
    }
  };

  // Clear selection whenever view mode or filters change
  useEffect(() => {
    setSelectedOppIds([]);
  }, [viewMode, searchQuery, filterTemp, filterType, selectedOwner]);

  // Toggle selection for a single opportunity
  const handleToggleSelectOpp = (id: number) => {
    setSelectedOppIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all on current filtered list
  const handleToggleSelectAllOpps = () => {
    if (selectedOppIds.length === filteredOpps.length && filteredOpps.length > 0) {
      setSelectedOppIds([]);
    } else {
      setSelectedOppIds(filteredOpps.map((o: any) => o.id));
    }
  };

  // Bulk Delete Opportunities
  const handleBulkDeleteOpps = async () => {
    if (selectedOppIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Delete Selected Deals?',
      text: `Are you sure you want to permanently delete ${selectedOppIds.length} selected opportunities? Associated contact profiles will remain intact in the Lead Pool.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: `Yes, Delete ${selectedOppIds.length} Deals`,
    });

    if (result.isConfirmed) {
      setBulkLoading(true);
      try {
        await fetchApi('/opportunities/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: selectedOppIds }),
        });

        Swal.fire({
          icon: 'success',
          title: 'Opportunities Deleted',
          text: `${selectedOppIds.length} opportunities have been successfully deleted.`,
          timer: 1800,
          showConfirmButton: false,
        });

        setSelectedOppIds([]);
        loadOpportunitiesData();
      } catch (err: any) {
        console.error('Failed to bulk delete opportunities:', err);
        Swal.fire('Error', err.message || 'Failed to delete opportunities.', 'error');
      } finally {
        setBulkLoading(false);
      }
    }
  };

  const handleOpenCreateOppModal = () => {
    setSelectedContactForOpp(null);
    setIsOppModalOpen(true);
  };

  // Stage column definitions (7 Sales Stages)
  const STAGE_COLUMNS = [
    {
      key: 'contacted',
      label: '1. Contacted',
      color: 'border-sky-500',
      headerBg: 'bg-sky-50/70',
      tagBg: 'bg-sky-100 text-sky-800',
      desc: 'Initial outreach & call connected',
    },
    {
      key: 'qualified',
      label: '2. Qualified',
      color: 'border-blue-600',
      headerBg: 'bg-blue-50/70',
      tagBg: 'bg-blue-100 text-blue-800',
      desc: 'Budget & property requirements verified',
    },
    {
      key: 'option_sent',
      label: '3. Option Sent',
      color: 'border-indigo-500',
      headerBg: 'bg-indigo-50/70',
      tagBg: 'bg-indigo-100 text-indigo-800',
      desc: 'Brochures & property options shared',
    },
    {
      key: 'follow_up',
      label: '4. Follow up',
      color: 'border-amber-500',
      headerBg: 'bg-amber-50/70',
      tagBg: 'bg-amber-100 text-amber-800',
      desc: 'Client review & feedback follow-up',
    },
    {
      key: 'meeting',
      label: '5. Meeting',
      color: 'border-purple-600',
      headerBg: 'bg-purple-50/70',
      tagBg: 'bg-purple-100 text-purple-800',
      desc: 'In-person / Zoom developer meeting',
    },
    {
      key: 'future_prospectus',
      label: '6. Future Prospectus',
      color: 'border-teal-600',
      headerBg: 'bg-teal-50/70',
      tagBg: 'bg-teal-100 text-teal-800',
      desc: 'Long-term prospect for upcoming launches',
    },
    {
      key: 'closed',
      label: '7. Closed 🏆',
      color: 'border-emerald-700',
      headerBg: 'bg-emerald-100/80',
      tagBg: 'bg-emerald-700 text-white',
      desc: 'Deal finalized & booking concluded',
    },
  ];

  // Render table header cell based on columnVisibility with Draggable Reordering and Database Sorting
  const renderOppHeaderCell = (colKey: string) => {
    const colMeta = ALL_OPP_COLUMNS.find((c) => c.key === colKey);
    if (!colMeta || !columnVisibility[colKey]) return null;

    if (colKey === 'actions') {
      return (
        <th key={colKey} className="py-3 px-3 text-right">
          {colMeta.label}
        </th>
      );
    }

    const isSortable = true;
    const isSorted = sortBy === colKey;

    return (
      <th
        key={colKey}
        draggable
        onDragStart={(e) => handleColDragStart(e, colKey)}
        onDragOver={(e) => handleColDragOver(e, colKey)}
        onDragLeave={handleColDragLeave}
        onDrop={(e) => handleColDrop(e, colKey)}
        onClick={() => handleSort(colKey)}
        className={`py-3 px-3 whitespace-nowrap font-semibold uppercase tracking-wider text-[10px] select-none transition-all group hover:bg-[#F3EEDD] cursor-pointer ${
          dragOverColKey === colKey ? 'border-l-2 border-[#C8A147] bg-amber-50/60' : ''
        } ${draggedColKey === colKey ? 'opacity-40' : ''}`}
        title="Click to sort from database | Drag & drop to reorder column"
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100 shrink-0 cursor-grab active:cursor-grabbing" />
          <span>{colMeta.label}</span>
          {isSorted ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </th>
    );
  };

  // Render table body cell for each opportunity
  const renderOppBodyCell = (colKey: string, opp: any) => {
    const qual = opp.buyer_qualification || opp.seller_qualification || opp.landlord_qualification || opp.tenant_qualification || {};
    const contact = opp.contact || {};

    switch (colKey) {
      case 'id':
        return (
          <td key={colKey} className="py-3.5 px-4 font-mono font-bold text-[#081428]">
            #{opp.id}
          </td>
        );

      case 'client':
        return (
          <td key={colKey} className="py-3.5 px-4 font-bold text-[#081428]">
            <Link
              href={`/opportunities/${opp.id}`}
              className="hover:text-[#C8A147] hover:underline transition-colors flex items-center gap-1.5"
            >
              <span>{contact.name || `Opportunity #${opp.id}`}</span>
            </Link>
          </td>
        );

      case 'phone':
        return (
          <td key={colKey} className="py-3.5 px-4 font-mono text-xs text-slate-700">
            {contact.phone ? (
              <div className="flex items-center gap-1.5">
                <span>{contact.phone}</span>
                <button
                  type="button"
                  onClick={(e) => copyToClipboard(contact.phone, `phone-${opp.id}`, e)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                  title="Copy Phone"
                >
                  {copiedField === `phone-${opp.id}` ? (
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
          <td key={colKey} className="py-3.5 px-4 font-mono text-xs text-slate-600">
            {contact.secondary_phone ? (
              <div className="flex items-center gap-1.5">
                <span>{contact.secondary_phone}</span>
                <button
                  type="button"
                  onClick={(e) => copyToClipboard(contact.secondary_phone, `sec-phone-${opp.id}`, e)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                  title="Copy Secondary Phone"
                >
                  {copiedField === `sec-phone-${opp.id}` ? (
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
        return (
          <td key={colKey} className="py-3.5 px-4 text-xs text-slate-600">
            {contact.email || '—'}
          </td>
        );

      case 'nationality':
        return (
          <td key={colKey} className="py-3.5 px-4 text-xs text-slate-700 font-medium">
            {contact.nationality || '—'}
          </td>
        );

      case 'source':
        return (
          <td key={colKey} className="py-3.5 px-4 text-xs">
            {contact.source ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {contact.source}
              </span>
            ) : (
              '—'
            )}
          </td>
        );

      case 'type_temp':
        return (
          <td key={colKey} className="py-3.5 px-4 whitespace-nowrap">
            <span className="uppercase font-bold text-[#081428] text-xs">{opp.opportunity_type || 'Buyer'}</span> ·{' '}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                opp.temperature === 'hot'
                  ? 'bg-red-100 text-red-700'
                  : opp.temperature === 'cold'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {opp.temperature || 'warm'}
            </span>
          </td>
        );

      case 'budget':
        return (
          <td key={colKey} className="py-3.5 px-4 font-bold text-[#081428] whitespace-nowrap">
            {opp.budget_min
              ? `AED ${(opp.budget_min / 1000000).toFixed(1)}M${
                  opp.budget_max ? ` – ${(opp.budget_max / 1000000).toFixed(1)}M` : ''
                }`
              : 'Pending'}
          </td>
        );

      case 'stage':
        return (
          <td key={colKey} className="py-3.5 px-4 whitespace-nowrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
              {(opp.stage || 'new').replace(/_/g, ' ')}
            </span>
          </td>
        );

      case 'developer':
        return (
          <td key={colKey} className="py-3.5 px-4 font-medium text-[#081428]">
            {qual.developer || '—'}
          </td>
        );

      case 'community':
        return (
          <td key={colKey} className="py-3.5 px-4 font-medium text-[#081428]">
            {qual.community || '—'}
          </td>
        );

      case 'project':
        return (
          <td key={colKey} className="py-3.5 px-4 text-slate-700">
            {qual.project || '—'}
          </td>
        );

      case 'project_property':
        return (
          <td key={colKey} className="py-3.5 px-4 text-slate-700">
            {qual.project_property || '—'}
          </td>
        );

      case 'property_type':
        return (
          <td key={colKey} className="py-3.5 px-4 text-slate-700">
            {qual.property_type || '—'}
          </td>
        );

      case 'bedrooms':
        return (
          <td key={colKey} className="py-3.5 px-4 text-slate-700 font-mono">
            {qual.bedrooms || '—'}
          </td>
        );

      case 'cash_or_finance':
        return (
          <td key={colKey} className="py-3.5 px-4 text-slate-700">
            {qual.cash_or_finance
              ? qual.cash_or_finance === 'cash'
                ? 'Cash'
                : 'Mortgage / Finance'
              : '—'}
          </td>
        );

      case 'purchase_timeline':
        return (
          <td key={colKey} className="py-3.5 px-4 text-slate-700">
            {qual.purchase_timeline || '—'}
          </td>
        );

      case 'lead_score':
        return (
          <td key={colKey} className="py-3.5 px-4">
            {qual.lead_score ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {qual.lead_score}/100
              </span>
            ) : (
              '—'
            )}
          </td>
        );

      case 'key_requirement':
        return (
          <td key={colKey} className="py-3.5 px-4 text-slate-700 max-w-xs truncate" title={opp.key_requirement || qual.qualification_notes || ''}>
            {opp.key_requirement || qual.qualification_notes || '—'}
          </td>
        );

      case 'owner':
        return (
          <td key={colKey} className="py-3.5 px-4 font-semibold text-[#081428] whitespace-nowrap">
            {opp.current_owner_name || 'Unassigned'}
          </td>
        );

      case 'next_action':
        return (
          <td key={colKey} className="py-3.5 px-4 text-[#6E6E6E] max-w-xs truncate" title={opp.next_action || ''}>
            {opp.next_action || 'Follow up'}
          </td>
        );

      case 'next_action_due_at':
        return (
          <td key={colKey} className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
            {opp.next_action_due_at ? opp.next_action_due_at.replace('T', ' ').substring(0, 16) : '—'}
          </td>
        );

      case 'sla_status':
        return (
          <td key={colKey} className="py-3.5 px-4 whitespace-nowrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                opp.sla_status === 'overdue'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : opp.sla_status === 'due_soon'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {opp.sla_status || 'On Track'}
            </span>
          </td>
        );

      case 'created_at':
        return (
          <td key={colKey} className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
            {opp.created_at ? opp.created_at.replace('T', ' ').substring(0, 16) : '—'}
          </td>
        );

      case 'updated_at':
        return (
          <td key={colKey} className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
            {opp.updated_at ? opp.updated_at.replace('T', ' ').substring(0, 16) : '—'}
          </td>
        );

      case 'actions':
        return (
          <td key={colKey} className="py-3.5 px-3 text-right whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
              <Link
                href={`/opportunities/${opp.id}`}
                className="px-2.5 py-1 bg-[#081428] hover:bg-[#122444] text-white font-bold text-xs rounded transition-colors"
              >
                View Deal
              </Link>
              {canDeleteDeals && (
                <button
                  onClick={() =>
                    handleDeleteOpportunity(opp.id, contact.name || `Opportunity #${opp.id}`)
                  }
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                  title="Delete Opportunity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </td>
        );

      default:
        return null;
    }
  };

  if (canViewDeals === false) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col min-w-0">
          <Navbar />
          <AccessDenied moduleName="Opportunities Pipeline" requiredPermission="deals.view" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-4 w-full max-w-7xl mx-auto">
          {/* Top Actions Bar (View Switcher, Advisor Scope Selector & Create Opportunity) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E8E4DC] p-3 rounded-lg shadow-2xs">
            <div className="flex items-center gap-3 flex-wrap">
              {/* View Switcher: Kanban vs List */}
              <div className="bg-[#EFECE6] p-1 rounded-lg flex items-center border border-[#E0DBD1]">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'kanban'
                      ? 'bg-[#081428] text-[#C8A147] shadow-xs'
                      : 'text-[#6E6E6E] hover:text-[#081428]'
                  }`}
                  title="Kanban Board View"
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Kanban Board</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-[#081428] text-[#C8A147] shadow-xs'
                      : 'text-[#6E6E6E] hover:text-[#081428]'
                  }`}
                  title="Table List View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List View</span>
                </button>
              </div>

              {/* Advisor / Scope Selector */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:border-[#C8A147] rounded-md px-3 py-1.5 shrink-0 transition-colors">
                <User className="w-3.5 h-3.5 text-[#C8A147]" />
                <select
                  value={selectedOwner === 'auto' ? (isSuperUser(currentUser) ? 'all' : (currentUser?.name || 'auto')) : selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer"
                >
                  {isSuperUser(currentUser) ? (
                    <>
                      <option value="all">👥 All Deals (Entire Team)</option>
                      {currentUser?.name && (
                        <option value={currentUser.name}>⭐ My Deals ({currentUser.name})</option>
                      )}
                      {teamAgents.filter((a) => a.name !== currentUser?.name).map((a) => (
                        <option key={a.id} value={a.name}>👤 {a.name} ({a.role})</option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value={currentUser?.name || 'auto'}>🎯 My Deals ({currentUser?.name || 'Assigned to Me'})</option>
                      <option value="all">👥 View Team Pipeline</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateOppModal}
              className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Create Opportunity</span>
            </button>
          </div>

          {/* Filters & Search Bar */}
          <div className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <div className="flex items-center gap-2 w-64 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors shrink-0">
                <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
                <input
                  type="text"
                  placeholder="Search deal ID, client, community..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none focus:outline-none text-xs text-[#1A1A1A] placeholder-[#6E6E6E]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <select
                value={filterTemp}
                onChange={(e) => setFilterTemp(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Temperatures</option>
                <option value="hot">🔥 Hot Deals</option>
                <option value="warm">Warm Deals</option>
                <option value="cold">Cold Deals</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Deal Types</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="investor">Investor</option>
              </select>

              {(searchQuery || filterTemp !== 'all' || filterType !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterTemp('all');
                    setFilterType('all');
                  }}
                  className="text-xs text-[#C8A147] font-bold hover:underline px-1 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {viewMode === 'list' && (
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
                          <span>Manage Deal Columns</span>
                          <button
                            type="button"
                            onClick={() => {
                              updateColumnVisibility(DEFAULT_OPP_COLUMN_VISIBILITY);
                              updateColumnOrder(DEFAULT_OPP_COLUMN_ORDER);
                            }}
                            className="text-[11px] text-[#C8A147] hover:underline cursor-pointer"
                          >
                            Reset Default
                          </button>
                        </div>

                        {['Core', 'Client Details', 'Property Specs', 'SLA & Timestamps'].map((cat) => (
                          <div key={cat} className="space-y-1 pt-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E6E] bg-[#FAF8F5] px-1.5 py-0.5 rounded">
                              {cat}
                            </div>
                            {ALL_OPP_COLUMNS.filter((c) => c.category === cat).map((col) => {
                              const isAction = col.key === 'actions';
                              return (
                                <label
                                  key={col.key}
                                  className={`flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 select-none ${
                                    isAction ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={isAction}
                                    checked={isAction || !!columnVisibility[col.key]}
                                    onChange={(e) => {
                                      if (isAction) return;
                                      updateColumnVisibility({
                                        ...columnVisibility,
                                        [col.key]: e.target.checked,
                                      });
                                    }}
                                    className="rounded border-slate-300 text-[#C8A147] focus:ring-[#C8A147] accent-[#C8A147]"
                                  />
                                  <span className={columnVisibility[col.key] ? 'font-medium text-[#081428]' : 'text-slate-500'}>
                                    {col.label}
                                  </span>
                                  {isAction && (
                                    <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded ml-auto">
                                      Required
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="text-[11px] font-medium text-[#6E6E6E] flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-[#C8A147]" />
                <span>Showing {filteredOpps.length} Opportunities</span>
              </div>
            </div>
          </div>

          {/* ===================== KANBAN BOARD VIEW ===================== */}
          {viewMode === 'kanban' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#6E6E6E] px-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#081428]">Opportunity Pipeline Board</span>
                  <span>•</span>
                  <span>Drag deal cards between stage columns to advance opportunities.</span>
                </div>
              </div>

              {/* Responsive 7-column Kanban Grid with generous card width and horizontal scroll */}
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 items-start min-w-max">
                  {STAGE_COLUMNS.map((col) => {
                    const items = filteredOpps.filter(
                      (o) => o.stage === col.key || (col.key === 'contacted' && (!o.stage || o.stage === 'new'))
                    );
                  const isOver = dragOverCol === col.key;

                  return (
                    <div
                      key={col.key}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverCol !== col.key) setDragOverCol(col.key);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        if (dragOverCol === col.key) setDragOverCol(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const oppIdStr = e.dataTransfer.getData('text/plain');
                        if (oppIdStr) {
                          handleDrop(Number(oppIdStr), col.key);
                        }
                      }}
                      className={`w-[295px] shrink-0 bg-white border rounded-lg shadow-2xs flex flex-col transition-all min-h-[520px] ${
                        isOver
                          ? 'border-[#C8A147] ring-2 ring-[#C8A147]/50 bg-amber-50/20'
                          : 'border-[#E8E4DC]'
                      }`}
                    >
                      {/* Column Header */}
                      <div className={`p-3.5 border-b border-[#E8E4DC] ${col.headerBg} rounded-t-lg`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-heading font-bold text-xs text-[#081428] truncate pr-1">
                            {col.label}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${col.tagBg}`}>
                            {items.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#6E6E6E] mt-0.5 truncate">{col.desc}</p>
                      </div>

                      {/* Card Container */}
                      <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[640px]">
                        {items.length === 0 ? (
                          <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-3 text-center text-slate-400">
                            <span className="text-[11px] font-medium">Drop deal here</span>
                          </div>
                        ) : (
                          items.map((opp: any) => {
                            const contact = opp.contact || {};
                            const qual = opp.buyer_qualification || {};
                            const isDragging = draggingId === opp.id;
                            const lastNote = (opp.activities || []).find((a: any) => a.type === 'note')?.description 
                              || opp.key_requirement 
                              || '';

                            return (
                              <div
                                key={opp.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', String(opp.id));
                                  setDraggingId(opp.id);
                                }}
                                onDragEnd={() => {
                                  setDraggingId(null);
                                  setDragOverCol(null);
                                }}
                                className={`p-3.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg shadow-2xs hover:shadow-md hover:border-[#C8A147] transition-all space-y-2.5 cursor-grab active:cursor-grabbing relative ${
                                  isDragging ? 'opacity-40 scale-95 border-dashed border-[#C8A147]' : ''
                                }`}
                              >
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    <Link
                                      href={`/opportunities/${opp.id}`}
                                      className="font-heading font-bold text-xs text-[#081428] hover:text-[#C8A147] hover:underline truncate"
                                      title={contact.name || `Opportunity #${opp.id}`}
                                    >
                                      {contact.name || `Opportunity #${opp.id}`}
                                    </Link>
                                  </div>

                                  {opp.temperature === 'hot' && (
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 font-bold text-[9px] rounded flex items-center gap-0.5 shrink-0">
                                      <Flame className="w-2.5 h-2.5" />
                                      <span>HOT</span>
                                    </span>
                                  )}
                                </div>

                                {/* Deal Specifications */}
                                <div className="space-y-1 text-[11px] text-[#6E6E6E]">
                                  {contact.phone && (
                                    <div className="flex items-center gap-1 font-mono text-slate-600">
                                      <Phone className="w-2.5 h-2.5 text-slate-400" />
                                      <span>{contact.phone}</span>
                                    </div>
                                  )}

                                  {(qual.community || qual.developer) && (
                                    <div className="flex items-center gap-1 text-slate-700 font-medium truncate">
                                      <MapPin className="w-2.5 h-2.5 text-red-500 shrink-0" />
                                      <span className="truncate">
                                        {qual.community || qual.developer}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-1 font-bold text-[#081428]">
                                    <DollarSign className="w-2.5 h-2.5 text-[#C8A147]" />
                                    <span>
                                      {opp.budget_min
                                        ? `AED ${(opp.budget_min / 1000000).toFixed(1)}M${
                                            opp.budget_max ? ` – ${(opp.budget_max / 1000000).toFixed(1)}M` : ''
                                          }`
                                        : 'Budget Pending'}
                                    </span>
                                  </div>
                                </div>

                                {/* Last Summary Note Display */}
                                {lastNote && (
                                  <div className="p-2 bg-amber-50/70 border border-amber-200/80 rounded-md space-y-1">
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-amber-800 uppercase tracking-wider">
                                      <FileText className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                      <span>Summary Note</span>
                                    </div>
                                    <p className="text-[10.5px] text-[#081428] leading-snug line-clamp-2 italic">
                                      "{lastNote}"
                                    </p>
                                  </div>
                                )}

                                {/* Card Footer Actions */}
                                <div className="pt-2 border-t border-[#E8E4DC] flex items-center justify-between gap-1">
                                  <div className="text-[10px] text-slate-600 font-semibold truncate">
                                    👤 {opp.current_owner_name || 'Agent'}
                                  </div>

                                  <Link
                                    href={`/opportunities/${opp.id}`}
                                    className="px-2 py-1 bg-[#081428] hover:bg-[#122444] text-white font-bold text-[10px] rounded transition-colors flex items-center gap-0.5 shrink-0"
                                  >
                                    <span>View Deal</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}

          {/* ===================== LIST TABLE VIEW ===================== */}
          {viewMode === 'list' && (() => {
            const visibleColumnCount = columnOrder.filter((k) => columnVisibility[k]).length;
            const totalCols = canBulkDeleteDeals ? visibleColumnCount + 1 : visibleColumnCount;

            return (
              <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xs overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] tracking-wider font-bold text-[#6E6E6E] uppercase">
                        {canBulkDeleteDeals && (
                          <th className="py-3 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={filteredOpps.length > 0 && selectedOppIds.length === filteredOpps.length}
                              onChange={handleToggleSelectAllOpps}
                              className="w-4 h-4 rounded border-[#E8E4DC] accent-[#C8A147] cursor-pointer align-middle"
                              title="Select all on current list"
                            />
                          </th>
                        )}
                        {columnOrder.map((colKey) => renderOppHeaderCell(colKey))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E4DC]">
                      {loading ? (
                        <tr>
                          <td colSpan={totalCols} className="py-8 text-center text-[#6E6E6E]">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                            <span>Loading Opportunities...</span>
                          </td>
                        </tr>
                      ) : filteredOpps.length === 0 ? (
                        <tr>
                          <td colSpan={totalCols} className="py-12 text-center text-[#6E6E6E] space-y-2">
                            <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
                            <div className="font-bold text-sm text-[#081428]">No Opportunities Found</div>
                            <p className="text-xs text-[#6E6E6E]">Try adjusting your search or filters.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredOpps.map((opp: any) => (
                          <tr 
                            key={opp.id} 
                            className={`transition-colors ${
                              selectedOppIds.includes(opp.id) ? 'bg-[#FAF6EC] hover:bg-[#F5EEDC]' : 'hover:bg-[#FAF8F5]'
                            }`}
                          >
                            {canBulkDeleteDeals && (
                              <td className="py-3.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedOppIds.includes(opp.id)}
                                  onChange={() => handleToggleSelectOpp(opp.id)}
                                  className="w-4 h-4 rounded border-[#E8E4DC] accent-[#C8A147] cursor-pointer align-middle"
                                />
                              </td>
                            )}
                            {columnOrder.map((colKey) =>
                              columnVisibility[colKey] ? renderOppBodyCell(colKey, opp) : null
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* FLOATING BULK DELETE ACTION BAR */}
          {canBulkDeleteDeals && selectedOppIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#081428] text-white px-5 py-3 rounded-xl shadow-2xl border border-[#C8A147]/40 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="bg-[#C8A147] text-[#081428] w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold">
                  {selectedOppIds.length}
                </span>
                <span>{selectedOppIds.length === 1 ? 'Deal Selected' : 'Deals Selected'}</span>
              </div>

              <div className="h-4 w-px bg-white/20" />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDeleteOpps}
                  disabled={bulkLoading}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{bulkLoading ? 'Deleting...' : 'Delete Selected'}</span>
                </button>

                <button
                  onClick={() => setSelectedOppIds([])}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer rounded"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Opportunity Modal */}
      <CreateOpportunityModal
        contact={selectedContactForOpp}
        isOpen={isOppModalOpen}
        onClose={() => setIsOppModalOpen(false)}
        onSuccess={() => loadOpportunitiesData()}
      />
    </div>
  );
}
