'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';
import { 
  Clock, 
  PhoneCall, 
  Flame, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  ListOrdered, 
  Calendar, 
  Globe, 
  Zap, 
  Search, 
  Filter, 
  User, 
  Phone, 
  Mail,
  MapPin, 
  DollarSign, 
  X,
  Sparkles,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  RefreshCw,
  PhoneForwarded,
  UserCheck,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { Suspense } from 'react';

function MyQueueContent() {
  const searchParams = useSearchParams();
  const urlTab = searchParams ? searchParams.get('tab') : null;

  const [queueData, setQueueData] = useState<any>({ 
    all: [], 
    overdue: [], 
    due_now: [], 
    hot_leads: [], 
    upcoming: [], 
    counts: {} 
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'due_now' | 'hot' | 'upcoming'>((urlTab as any) || 'all');
  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    if (urlTab === 'upcoming' || urlTab === 'overdue' || urlTab === 'due_now' || urlTab === 'hot' || urlTab === 'all') {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTemp, setFilterTemp] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');

  // Sorting
  const [sortBy, setSortBy] = useState('next_action_due_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Checkbox Selection State
  const [selectedOppIds, setSelectedOppIds] = useState<number[]>([]);
  const [bulkStage, setBulkStage] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  // Column Visibility
  const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
    client: true,
    phone: true,
    source: true,
    type_temp: true,
    budget_community: true,
    stage: true,
    sla: true,
    next_action: true,
    owner: true,
    actions: true,
    email: false,
    created_at: false,
  };

  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);

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

  const loadQueue = async (ownerOverride?: string) => {
    setLoading(true);
    try {
      let raw = localStorage.getItem('crm_user');
      let user = currentUser;
      if (!user && raw) {
        try { user = JSON.parse(raw); } catch {}
      }

      let url = '/queue';
      let targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;
      if (targetOwner === 'auto') {
        targetOwner = user?.role === 'Super Admin' ? 'all' : (user?.name || 'all');
      }

      if (targetOwner && targetOwner !== 'all') {
        url += `?owner=${encodeURIComponent(targetOwner)}`;
      }

      const data = await fetchApi(url);
      setQueueData(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load queue:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [selectedOwner]);

  const handleSimulatePortalLead = async () => {
    setIngesting(true);
    try {
      const res = await fetchApi('/portals/ingest', {
        method: 'POST',
        body: JSON.stringify({
          portal_name: 'property_finder',
          client_name: 'Zayed Al Nahyan',
          client_phone: '+971 50 777 8899',
          client_email: 'zayed.n@example.com',
          community: 'Palm Jumeirah',
          budget: 5500000,
        }),
      });

      Swal.fire({
        icon: 'success',
        title: 'Portal Lead Ingested!',
        text: res.message || 'New Property Finder lead added to queue.',
        confirmButtonColor: '#081428',
      });
      setIngesting(false);
      loadQueue();
    } catch (err: any) {
      Swal.fire('Ingestion Error', err.message || 'Portal lead ingestion failed.', 'error');
      setIngesting(false);
    }
  };

  const handleQuickCall = async (oppId: number, contactId: number, contactName: string = 'Client') => {
    const { value: formValues } = await Swal.fire({
      title: `<div class="text-[#081428] font-bold text-base">Log Call Outcome — ${contactName}</div>`,
      html: `
        <div class="space-y-3.5 text-left p-1 text-xs">
          <div class="text-[11px] text-[#6E6E6E] bg-slate-50 p-2.5 rounded border border-[#E8E4DC]">
            📱 <strong>Agent Note:</strong> Dial the client from your phone handset. Log discussion points and outcome below to record activity & update SLA timer.
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Call Outcome Status</label>
            <select id="swal-call-outcome" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="Interested - Schedule Viewing">Interested — Schedule Viewing / Meeting</option>
              <option value="Callback Requested">Callback Requested — Busy Right Now</option>
              <option value="Follow-up Required">Follow-up Required — Thinking / Comparing Options</option>
              <option value="No Answer / Left Voicemail">No Answer — Left Voicemail / Sent WhatsApp</option>
              <option value="Not Interested">Not Interested — Out of Budget / Changed Mind</option>
              <option value="Wrong Number">Wrong Number / Invalid Contact Info</option>
            </select>
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Next Follow-up & SLA Schedule</label>
            <select id="swal-next-schedule" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="24h">📅 Tomorrow at Same Time (24h) — [On Track 🟢]</option>
              <option value="15m">⚡ Quick Callback in 15 mins — [Due Soon 🟡]</option>
              <option value="2h">⏰ Later Today (in 2 hours) — [On Track 🟢]</option>
              <option value="48h">📆 In 2 Days — [On Track 🟢]</option>
              <option value="now">🚨 Immediate Escalation (Now) — [Overdue 🔴]</option>
            </select>
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Call Notes / Discussion Summary</label>
            <textarea id="swal-call-notes" rows="3" placeholder="Enter key discussion summary, buyer preferences, or next steps..." class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"></textarea>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save Call Log & Next',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16A34A',
      cancelButtonColor: '#6E6E6E',
      preConfirm: () => {
        const outcome = (document.getElementById('swal-call-outcome') as HTMLSelectElement)?.value;
        const schedule = (document.getElementById('swal-next-schedule') as HTMLSelectElement)?.value;
        const notes = (document.getElementById('swal-call-notes') as HTMLTextAreaElement)?.value;
        if (!notes || notes.trim() === '') {
          Swal.showValidationMessage('Please enter call notes / summary before saving.');
          return false;
        }
        return { outcome, schedule, notes };
      }
    });

    if (formValues) {
      let dueAt = new Date(Date.now() + 24 * 3600 * 1000);
      if (formValues.schedule === '15m') dueAt = new Date(Date.now() + 15 * 60 * 1000);
      else if (formValues.schedule === '2h') dueAt = new Date(Date.now() + 2 * 3600 * 1000);
      else if (formValues.schedule === '48h') dueAt = new Date(Date.now() + 48 * 3600 * 1000);
      else if (formValues.schedule === 'now') dueAt = new Date(Date.now() - 5 * 60 * 1000);

      try {
        await fetchApi('/activities', {
          method: 'POST',
          body: JSON.stringify({
            contact_id: contactId,
            opportunity_id: oppId,
            type: 'call',
            call_outcome: formValues.outcome,
            description: `Quick Call: ${formValues.outcome} — ${formValues.notes}`,
            user_name: 'Agent',
            next_action: `Follow-up: ${formValues.outcome}`,
            next_action_due_at: dueAt.toISOString(),
          }),
        });

        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2200,
          timerProgressBar: true,
        });
        Toast.fire({
          icon: 'success',
          title: 'Call logged & SLA status updated!',
        });

        loadQueue();
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to save call activity.', 'error');
      }
    }
  };

  // Bulk actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOppIds(paginatedOpps.map((o: any) => o.id));
    } else {
      setSelectedOppIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedOppIds.includes(id)) {
      setSelectedOppIds(selectedOppIds.filter((item) => item !== id));
    } else {
      setSelectedOppIds([...selectedOppIds, id]);
    }
  };

  const handleBulkStageUpdate = async () => {
    if (!bulkStage || selectedOppIds.length === 0) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        selectedOppIds.map((id) =>
          fetchApi(`/opportunities/${id}/stage`, {
            method: 'PUT',
            body: JSON.stringify({ stage: bulkStage }),
          })
        )
      );

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
      });
      Toast.fire({
        icon: 'success',
        title: `Updated ${selectedOppIds.length} leads to stage: ${bulkStage.toUpperCase()}`,
      });

      setSelectedOppIds([]);
      setBulkStage('');
      loadQueue();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Bulk stage update failed.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // Filter & Search Logic
  const allRawOpps: any[] = useMemo(() => {
    const all = queueData.all || [
      ...(queueData.overdue || []),
      ...(queueData.due_now || []),
      ...(queueData.hot_leads || []),
      ...(queueData.upcoming || [])
    ];
    const uniqueMap = new Map();
    all.forEach((item: any) => uniqueMap.set(item.id, item));
    return Array.from(uniqueMap.values());
  }, [queueData]);

  // Tab Filtering
  const tabFilteredOpps = useMemo(() => {
    if (activeTab === 'overdue') return queueData.overdue || [];
    if (activeTab === 'due_now') return queueData.due_now || [];
    if (activeTab === 'hot') return queueData.hot_leads || [];
    if (activeTab === 'upcoming') return queueData.upcoming || [];
    return allRawOpps;
  }, [activeTab, queueData, allRawOpps]);

  // Full Filter Application (Search + Temp + Type + Source)
  const filteredOpps = useMemo(() => {
    return tabFilteredOpps.filter((opp: any) => {
      const contact = opp.contact || {};
      const qual = opp.buyer_qualification || {};
      const query = searchQuery.toLowerCase().trim();

      if (query) {
        const nameMatch = (contact.name || '').toLowerCase().includes(query);
        const phoneMatch = (contact.phone || '').toLowerCase().includes(query);
        const emailMatch = (contact.email || '').toLowerCase().includes(query);
        const communityMatch = (qual.community || '').toLowerCase().includes(query);
        const actionMatch = (opp.next_action || '').toLowerCase().includes(query);
        const typeMatch = (opp.opportunity_type || '').toLowerCase().includes(query);
        const ownerMatch = (opp.current_owner_name || '').toLowerCase().includes(query);

        if (!nameMatch && !phoneMatch && !emailMatch && !communityMatch && !actionMatch && !typeMatch && !ownerMatch) {
          return false;
        }
      }

      if (filterTemp !== 'all' && opp.temperature !== filterTemp) return false;
      if (filterType !== 'all' && opp.opportunity_type !== filterType) return false;
      if (filterSource !== 'all' && (contact.source || 'portal') !== filterSource) return false;

      return true;
    });
  }, [tabFilteredOpps, searchQuery, filterTemp, filterType, filterSource]);

  // Sorting
  const sortedOpps = useMemo(() => {
    const list = [...filteredOpps];
    list.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';

      if (sortBy === 'client') {
        valA = a.contact?.name || '';
        valB = b.contact?.name || '';
      } else if (sortBy === 'phone') {
        valA = a.contact?.phone || '';
        valB = b.contact?.phone || '';
      } else if (sortBy === 'source') {
        valA = a.contact?.source || '';
        valB = b.contact?.source || '';
      } else if (sortBy === 'budget') {
        valA = a.budget_min || 0;
        valB = b.budget_min || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredOpps, sortBy, sortOrder]);

  // Pagination
  const paginatedOpps = useMemo(() => {
    const startIndex = (currentPage - 1) * perPage;
    return sortedOpps.slice(startIndex, startIndex + perPage);
  }, [sortedOpps, currentPage, perPage]);

  const totalPages = Math.ceil(sortedOpps.length / perPage) || 1;

  const handleSort = (colKey: string) => {
    if (sortBy === colKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(colKey);
      setSortOrder('asc');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterTemp('all');
    setFilterType('all');
    setFilterSource('all');
    setActiveTab('all');
    setCurrentPage(1);
  };

  const isFilterActive = searchQuery !== '' || filterTemp !== 'all' || filterType !== 'all' || filterSource !== 'all' || activeTab !== 'all';

  const isAllPageSelected = paginatedOpps.length > 0 && paginatedOpps.every((o: any) => selectedOppIds.includes(o.id));

  // Dynamic Page Numbers generator
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <ListOrdered className="w-4 h-4" />
                <span>04 — Sales Action Center</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                My Queue & Priority Calling Center
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Priority-ranked dialer sheet for agents to execute follow-ups and log call outcomes with real-time SLA tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/opportunities"
                className="px-3.5 py-2 bg-white border border-[#E8E4DC] hover:bg-slate-50 text-[#081428] font-bold text-xs rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="View Full Opportunities Pipeline"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Opportunities Pipeline</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </Link>

              {/* Simulate Ingestion Button */}
              <button
                onClick={handleSimulatePortalLead}
                disabled={ingesting}
                className="px-3.5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>{ingesting ? 'Ingesting...' : 'Simulate Portal Lead'}</span>
              </button>
            </div>
          </div>

          {/* 5 KPI SLA Stat Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'all', label: 'All Active Leads', value: queueData.counts?.all ?? allRawOpps.length, sub: 'Total Queue Count', subColor: 'text-[#081428]', icon: ListOrdered, iconBg: 'bg-[#081428] text-[#C8A147]' },
              { id: 'overdue', label: 'Overdue SLA', value: queueData.counts?.overdue ?? 0, sub: 'Immediate attention', subColor: 'text-red-700', icon: AlertCircle, iconBg: 'bg-red-100 text-red-700' },
              { id: 'due_now', label: 'Due Soon', value: queueData.counts?.due_now ?? 0, sub: 'Within 30 mins', subColor: 'text-amber-800', icon: Clock, iconBg: 'bg-amber-100 text-amber-800' },
              { id: 'hot', label: 'Hot Leads', value: queueData.counts?.hot_leads ?? 0, sub: 'Priority clients', subColor: 'text-orange-700', icon: Flame, iconBg: 'bg-orange-100 text-orange-700' },
              { id: 'upcoming', label: 'Upcoming Today', value: queueData.counts?.upcoming ?? 0, sub: 'Scheduled future', subColor: 'text-blue-700', icon: Calendar, iconBg: 'bg-blue-100 text-blue-700' },
            ].map((card) => {
              const Icon = card.icon;
              const isCardActive = activeTab === card.id;

              return (
                <button
                  key={card.id}
                  onClick={() => {
                    setActiveTab(card.id as any);
                    setCurrentPage(1);
                  }}
                  className={`p-4 rounded-lg border text-left transition-all relative cursor-pointer shadow-2xs ${
                    isCardActive
                      ? 'bg-white border-[#C8A147] ring-2 ring-[#C8A147]/50 shadow-md'
                      : 'bg-white border-[#E8E4DC] hover:border-[#C8A147]/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#6E6E6E] uppercase tracking-wider">{card.label}</span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${card.iconBg}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="font-heading font-bold text-2xl text-[#081428] mt-1">{card.value}</div>
                  <div className={`text-[10px] font-semibold ${card.subColor} mt-0.5`}>{card.sub}</div>
                </button>
              );
            })}
          </div>

          {/* Lead Pool Style Top Tabs */}
          <div className="border-b border-[#E8E4DC] flex items-center gap-2 overflow-x-auto pt-2">
            {[
              { id: 'all', label: 'All Queue Leads' },
              { id: 'overdue', label: 'Overdue / Breached 🚨' },
              { id: 'due_now', label: 'Due Soon (< 30 Mins) ⏳' },
              { id: 'hot', label: 'Hot Leads 🔥' },
              { id: 'upcoming', label: 'Upcoming Today 📅' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                    isActive
                      ? 'border-[#C8A147] text-[#081428] bg-white shadow-2xs rounded-t-md'
                      : 'border-transparent text-[#6E6E6E] hover:text-[#081428] hover:bg-white/50'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Control Bar: Filters & Columns */}
          <div className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Search */}
              <div className="flex items-center gap-2 w-64 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors shrink-0">
                <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
                <input
                  type="text"
                  placeholder="Search client name, phone, action..."
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

              {/* Agent / Scope Selector */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 shrink-0">
                <User className="w-3.5 h-3.5 text-[#C8A147]" />
                <select
                  value={selectedOwner}
                  onChange={(e) => {
                    setSelectedOwner(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer"
                >
                  {currentUser?.role === 'Super Admin' ? (
                    <>
                      <option value="all">👥 Full Team Queue (All Agents)</option>
                      {currentUser?.name && (
                        <option value={currentUser.name}>⭐ My Tasks ({currentUser.name})</option>
                      )}
                      {teamAgents.filter((a) => a.name !== currentUser?.name).map((a) => (
                        <option key={a.id} value={a.name}>👤 {a.name} ({a.role})</option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value={currentUser?.name || 'auto'}>🎯 My Daily Action Queue ({currentUser?.name || 'Assigned to Me'})</option>
                      <option value="all">👥 View Team Pool</option>
                    </>
                  )}
                </select>
              </div>

              {/* Temperature Filter */}
              <select
                value={filterTemp}
                onChange={(e) => setFilterTemp(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Temperatures</option>
                <option value="hot">🔥 Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="investor">Investor</option>
              </select>

              {/* Source Filter */}
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Sources</option>
                <option value="property_finder">Property Finder</option>
                <option value="bayut">Bayut</option>
                <option value="dubizzle">Dubizzle</option>
                <option value="referral">Referral</option>
                <option value="website">Direct Website</option>
              </select>

              {isFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-[#C8A147] font-bold hover:underline px-1 transition-colors ml-1 cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Columns Visibility Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setColumnsDropdownOpen(!columnsDropdownOpen)}
                  className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs font-semibold text-[#081428] hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Columns</span>
                </button>

                {columnsDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E8E4DC] rounded-lg shadow-xl p-2.5 z-40 space-y-1 text-xs">
                    <div className="text-[10px] font-bold text-[#6E6E6E] uppercase border-b border-[#E8E4DC] pb-1 mb-1">
                      Toggle Columns
                    </div>
                    {Object.keys(columnVisibility).map((colKey) => (
                      <label key={colKey} className="flex items-center gap-2 p-1 hover:bg-[#FAF8F5] rounded cursor-pointer capitalize">
                        <input
                          type="checkbox"
                          checked={columnVisibility[colKey]}
                          onChange={(e) =>
                            setColumnVisibility({
                              ...columnVisibility,
                              [colKey]: e.target.checked,
                            })
                          }
                          className="rounded text-[#C8A147] focus:ring-[#C8A147]"
                        />
                        <span>{colKey.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-[11px] font-medium text-[#6E6E6E] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#C8A147]" />
                <span>Showing {filteredOpps.length} Leads</span>
              </div>
            </div>
          </div>

          {/* Master Table View */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E8E4DC] text-[#6E6E6E] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-3 pl-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllPageSelected}
                        onChange={handleSelectAll}
                        className="rounded text-[#C8A147] focus:ring-[#C8A147] cursor-pointer"
                      />
                    </th>

                    {columnVisibility.client && (
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('client')}>
                        <div className="flex items-center gap-1">
                          <span>Client Name</span>
                          <ArrowUpDown className="w-3 h-3 opacity-60" />
                        </div>
                      </th>
                    )}

                    {columnVisibility.phone && (
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('phone')}>
                        <div className="flex items-center gap-1">
                          <span>Phone / Contact</span>
                          <ArrowUpDown className="w-3 h-3 opacity-60" />
                        </div>
                      </th>
                    )}

                    {columnVisibility.source && (
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('source')}>
                        <div className="flex items-center gap-1">
                          <span>Source</span>
                          <ArrowUpDown className="w-3 h-3 opacity-60" />
                        </div>
                      </th>
                    )}

                    {columnVisibility.type_temp && (
                      <th className="p-3">Type & Temp</th>
                    )}

                    {columnVisibility.budget_community && (
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('budget')}>
                        <div className="flex items-center gap-1">
                          <span>Budget & Location</span>
                          <ArrowUpDown className="w-3 h-3 opacity-60" />
                        </div>
                      </th>
                    )}

                    {columnVisibility.stage && (
                      <th className="p-3">Stage</th>
                    )}

                    {columnVisibility.sla && (
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('next_action_due_at')}>
                        <div className="flex items-center gap-1">
                          <span>SLA Urgency</span>
                          <ArrowUpDown className="w-3 h-3 text-[#C8A147]" />
                        </div>
                      </th>
                    )}

                    {columnVisibility.next_action && (
                      <th className="p-3">Next Action</th>
                    )}

                    {columnVisibility.owner && (
                      <th className="p-3">Assigned Advisor</th>
                    )}

                    {columnVisibility.actions && (
                      <th className="p-3 pr-4 text-right">Action</th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8E4DC]">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-[#6E6E6E]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                        <span>Loading sales calling queue...</span>
                      </td>
                    </tr>
                  ) : paginatedOpps.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-[#6E6E6E] space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                        <div className="font-bold text-sm text-[#081428]">Queue is Clear!</div>
                        <p className="text-xs text-[#6E6E6E]">No leads matching your current tab or search criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOpps.map((opp: any) => {
                      const contact = opp.contact || {};
                      const qual = opp.buyer_qualification || {};
                      const isSelected = selectedOppIds.includes(opp.id);

                      return (
                        <tr
                          key={opp.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <td className="p-3 pl-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOne(opp.id)}
                              className="rounded text-[#C8A147] focus:ring-[#C8A147] cursor-pointer"
                            />
                          </td>

                          {columnVisibility.client && (
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#081428] text-[#C8A147] font-bold text-xs flex items-center justify-center shrink-0">
                                  {contact.name ? contact.name.substring(0, 2).toUpperCase() : 'LE'}
                                </div>
                                <div>
                                  <Link
                                    href={`/opportunities/${opp.id}`}
                                    className="font-bold text-[#081428] hover:text-[#C8A147] transition-colors"
                                  >
                                    {contact.name || `Lead #${opp.id}`}
                                  </Link>
                                </div>
                              </div>
                            </td>
                          )}

                          {columnVisibility.phone && (
                            <td className="p-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-[#081428] flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#C8A147]" />
                                <span>{contact.phone || '—'}</span>
                              </div>
                            </td>
                          )}

                          {columnVisibility.source && (
                            <td className="p-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                                {contact.source || 'Portal'}
                              </span>
                            </td>
                          )}

                          {columnVisibility.type_temp && (
                            <td className="p-3 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <span className="font-bold uppercase text-[10px] text-[#081428]">
                                  {opp.opportunity_type || 'Buyer'}
                                </span>
                                <span>·</span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                    opp.temperature === 'hot'
                                      ? 'bg-red-100 text-red-700 font-extrabold'
                                      : opp.temperature === 'warm'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {opp.temperature || 'warm'}
                                </span>
                              </div>
                            </td>
                          )}

                          {columnVisibility.budget_community && (
                            <td className="p-3">
                              <div className="font-bold text-[#081428]">
                                {opp.budget_min && opp.budget_max
                                  ? `AED ${(opp.budget_min / 1000000).toFixed(1)}M – ${(opp.budget_max / 1000000).toFixed(1)}M`
                                  : opp.budget_min
                                  ? `AED ${(opp.budget_min / 1000000).toFixed(1)}M`
                                  : 'Pending'}
                              </div>
                              {(qual.community || qual.developer) && (
                                <div className="text-[10px] text-[#6E6E6E] flex items-center gap-1 mt-0.5 truncate max-w-[140px]">
                                  <MapPin className="w-2.5 h-2.5 text-red-500 shrink-0" />
                                  <span className="truncate">{qual.community || qual.developer}</span>
                                </div>
                              )}
                            </td>
                          )}

                          {columnVisibility.stage && (
                            <td className="p-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                                {(opp.stage || 'new').replace('_', ' ')}
                              </span>
                            </td>
                          )}

                          {columnVisibility.sla && (
                            <td className="p-3 whitespace-nowrap">
                              {opp.sla_status === 'overdue' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1 w-fit">
                                  <AlertCircle className="w-3 h-3 text-red-700" />
                                  <span>SLA BREACH</span>
                                </span>
                              ) : opp.sla_status === 'due_soon' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3 text-amber-800" />
                                  <span>DUE SOON</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  <span>ON TRACK</span>
                                </span>
                              )}
                            </td>
                          )}

                          {columnVisibility.next_action && (
                            <td className="p-3 max-w-xs">
                              <div className="font-semibold text-[#081428] truncate">
                                {opp.next_action || 'Dial Client'}
                              </div>
                              <div className="text-[10px] text-[#6E6E6E] flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                <span>
                                  {opp.next_action_due_at
                                    ? new Date(opp.next_action_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : 'Immediate'}
                                </span>
                              </div>
                            </td>
                          )}

                          {columnVisibility.owner && (
                            <td className="p-3 whitespace-nowrap font-medium text-slate-700">
                              {opp.current_owner_name || 'Unassigned'}
                            </td>
                          )}

                          {columnVisibility.actions && (
                            <td className="p-3 pr-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleQuickCall(opp.id, contact.id, contact.name)}
                                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                  title="Log phone call discussion & update SLA"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>Log Call</span>
                                </button>

                                <Link
                                  href={`/opportunities/${opp.id}`}
                                  className="px-3 py-1.5 bg-[#081428] hover:bg-[#122444] text-white font-semibold text-xs rounded shadow-2xs transition-colors flex items-center gap-1.5"
                                  title="Open Opportunity Details"
                                >
                                  <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                                  <span>Opportunity</span>
                                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                                </Link>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* FLOATING BULK BAR */}
            {selectedOppIds.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#081428] text-white border border-[#C8A147]/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#C8A147] text-[#081428] font-bold text-xs flex items-center justify-center">
                    {selectedOppIds.length}
                  </span>
                  <span className="text-xs font-semibold">Leads Selected</span>
                </div>

                <div className="h-4 w-px bg-slate-700" />

                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={bulkStage}
                    onChange={(e) => setBulkStage(e.target.value)}
                    className="p-1.5 bg-[#122444] border border-slate-700 rounded text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Move to Stage...</option>
                    <option value="qualification">Lead Qualification</option>
                    <option value="handover_pending">Handover Pending</option>
                    <option value="sales_in_progress">Sales In Progress</option>
                  </select>

                  <button
                    onClick={handleBulkStageUpdate}
                    disabled={!bulkStage || bulkLoading}
                    className="px-3 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {bulkLoading ? 'Updating...' : 'Update Stage'}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedOppIds([])}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer ml-2"
                >
                  Deselect All
                </button>
              </div>
            )}

            {/* Pagination Footer */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6E6E]">
              <div>
                Showing <span className="font-bold text-[#081428]">{sortedOpps.length > 0 ? (currentPage - 1) * perPage + 1 : 0}</span> to{' '}
                <span className="font-bold text-[#081428]">{Math.min(currentPage * perPage, sortedOpps.length)}</span> of{' '}
                <span className="font-bold text-[#081428]">{sortedOpps.length}</span> leads
              </div>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

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
                      onClick={() => setCurrentPage(p as number)}
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

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages || loading}
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Per Page Select Dropdown */}
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="p-1.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-medium cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function QueuePage() {
  const [canViewQueue, setCanViewQueue] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPerms = () => {
      setCanViewQueue(hasPermission('queue.view'));
    };
    checkPerms();
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);

  if (canViewQueue === false) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col min-w-0">
          <Navbar />
          <AccessDenied moduleName="Sales Queue & Follow-ups" requiredPermission="queue.view" />
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-xs text-slate-400">Loading Queue...</div>}>
      <MyQueueContent />
    </Suspense>
  );
}
