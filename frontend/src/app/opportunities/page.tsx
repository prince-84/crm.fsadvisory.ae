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
  X
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

  const loadOpportunitiesData = async (ownerOverride?: string) => {
    setLoading(true);
    try {
      let raw = localStorage.getItem('crm_user');
      let user = currentUser;
      if (!user && raw) {
        try { user = JSON.parse(raw); } catch {}
      }

      let url = '/opportunities';
      let targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;
      if (targetOwner === 'auto') {
        targetOwner = isSuperUser(user) ? 'all' : (user?.name || 'all');
      }

      if (targetOwner && targetOwner !== 'all') {
        url += `?owner=${encodeURIComponent(targetOwner)}`;
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
      setAllOpps(flattened);

      const contactsRes = await fetchApi('/contacts');
      setContacts(contactsRes.contacts?.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load opportunities:', err);
      setLoading(false);
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
    if (contacts.length > 0) {
      setSelectedContactForOpp(contacts[0]);
      setIsOppModalOpen(true);
    } else {
      Swal.fire('No Contacts', 'Please add a Contact in Lead Pool first.', 'info');
    }
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

  // Pipeline metrics calculation
  const totalPipelineBudget = allOpps.reduce((sum, opp) => sum + (opp.budget_min || 0), 0);
  const activeOpportunitiesCount = allOpps.filter(
    (o) => o.stage !== 'closed' && o.stage !== 'closed_won' && o.stage !== 'closed_lost'
  ).length;
  const wonCount = allOpps.filter((o) => o.stage === 'closed' || o.stage === 'closed_won').length;
  const meetingCount = allOpps.filter((o) => o.stage === 'meeting').length;

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

        <main className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <Briefcase className="w-4 h-4" />
                <span>03 — Deal Pipeline & Opportunities</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                Opportunities & Sales Pipeline
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Drag deals across pipeline stages to track buyer qualifications, viewings, and SPA closures.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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

              <Link
                href="/opportunities/create"
                className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Create Opportunity</span>
              </Link>
            </div>
          </div>

          {/* 4 Top Pipeline KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-[#6E6E6E] uppercase tracking-wider">Active Pipeline</div>
              <div className="font-heading text-2xl font-bold text-[#081428] mt-1">{activeOpportunitiesCount} Deals</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Across 4 active stages</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">Active Meetings</div>
              <div className="font-heading text-2xl font-bold text-purple-800 mt-1">{meetingCount} Meetings</div>
              <div className="text-[10px] text-purple-700 mt-0.5">Developer viewings & Zoom</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Closed Won 🏆</div>
              <div className="font-heading text-2xl font-bold text-emerald-800 mt-1">{wonCount} Deals</div>
              <div className="text-[10px] text-emerald-700 mt-0.5">Successfully closed SPAs</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-[#C8A147] uppercase tracking-wider">Total Pipeline Value</div>
              <div className="font-heading text-2xl font-bold text-[#081428] mt-1">
                AED {totalPipelineBudget > 0 ? (totalPipelineBudget / 1000000).toFixed(1) + 'M' : '15.5M'}
              </div>
              <div className="text-[10px] text-[#C8A147] font-semibold mt-0.5">Combined buyer budget</div>
            </div>
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

              {/* Agent / Scope Selector */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 shrink-0">
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

            <div className="text-[11px] font-medium text-[#6E6E6E] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#C8A147]" />
              <span>Showing {filteredOpps.length} Opportunities</span>
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
          {viewMode === 'list' && (
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
                      <th className="py-3 px-4">Deal ID</th>
                      <th className="py-3 px-4">Client Contact</th>
                      <th className="py-3 px-4">Type & Temp</th>
                      <th className="py-3 px-4">Budget Range</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4">Advisor / Owner</th>
                      <th className="py-3 px-4">Next Action</th>
                      <th className="py-3 px-4">SLA Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {loading ? (
                      <tr>
                        <td colSpan={canBulkDeleteDeals ? 10 : 9} className="py-8 text-center text-[#6E6E6E]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                          <span>Loading Opportunities...</span>
                        </td>
                      </tr>
                    ) : filteredOpps.length === 0 ? (
                      <tr>
                        <td colSpan={canBulkDeleteDeals ? 10 : 9} className="py-12 text-center text-[#6E6E6E] space-y-2">
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
                          <td className="py-3.5 px-4 font-mono font-bold text-[#081428]">#{opp.id}</td>
                          <td className="py-3.5 px-4 font-bold text-[#081428]">
                            <Link
                              href={`/opportunities/${opp.id}`}
                              className="hover:text-[#C8A147] hover:underline transition-colors"
                            >
                              {opp.contact?.name || `Opportunity #${opp.id}`}
                            </Link>
                            {opp.contact?.phone && (
                              <div className="text-[10px] font-mono text-[#6E6E6E]">{opp.contact.phone}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="uppercase font-bold text-[#081428]">{opp.opportunity_type || 'Buyer'}</span> ·{' '}
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                opp.temperature === 'hot'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {opp.temperature || 'warm'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#081428]">
                            {opp.budget_min
                              ? `AED ${(opp.budget_min / 1000000).toFixed(1)}M${
                                  opp.budget_max ? ` – ${(opp.budget_max / 1000000).toFixed(1)}M` : ''
                                }`
                              : 'Pending'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                              {(opp.stage || 'new').replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#081428]">
                            {opp.current_owner_name || 'Faraz Shafi'}
                          </td>
                          <td className="py-3.5 px-4 text-[#6E6E6E]">{opp.next_action || 'Follow up'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {opp.sla_status || 'On Track'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
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
                                    handleDeleteOpportunity(opp.id, opp.contact?.name || `Opportunity #${opp.id}`)
                                  }
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="Delete Opportunity"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
