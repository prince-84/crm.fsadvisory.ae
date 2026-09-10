'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import { hasPermission, isSuperUser } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';
import ContactDetailModal from '@/components/ContactDetailModal';
import OwnerDetailModal from '@/components/OwnerDetailModal';
import CreateOpportunityModal from '@/components/CreateOpportunityModal';
import AdvancedFilterModal, { AdvancedFiltersState, INITIAL_ADVANCED_FILTERS } from '@/components/AdvancedFilterModal';
import DateRangePicker, { DateRangeValue } from '@/components/DateRangePicker';
import MultiCheckboxDropdown from '@/components/MultiCheckboxDropdown';
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
  Briefcase,
  Users,
  Building2,
  Eye,
  Plus,
  Copy,
  Check,
  Building,
  Home,
  MessageCircle,
  MessageSquare,
  ExternalLink,
  GripVertical,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';

function MyQueueContent() {
  const searchParams = useSearchParams();
  const urlTab = searchParams ? searchParams.get('tab') : null;

  // Permission State for Bulk Deletion
  const [canBulkDeleteQueue, setCanBulkDeleteQueue] = useState<boolean>(false);

  useEffect(() => {
    const checkPerms = () => {
      setCanBulkDeleteQueue(hasPermission('queue.bulk_delete'));
    };
    checkPerms();
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);

  // Primary Channel Tab: Regular Leads (Lead Pool) vs Owner Leads (Owner Data)
  const [queueChannel, setQueueChannel] = useState<'regular' | 'owner'>('regular');

  const [queueData, setQueueData] = useState<any>({ 
    all: [], 
    new_leads: [],
    contacted_today: [],
    overdue: [], 
    due_now: [], 
    hot_leads: [], 
    upcoming: [], 
    recent: [],
    with_opportunity: [],
    without_opportunity: [],
    counts: {},
    channel_counts: { regular: 0, owner: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>((urlTab as any) || 'all');

  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedCallOutcome, setSelectedCallOutcome] = useState<string>('all');

  // Regular Leads: Date Range & Advanced Filters (matching Lead Pool)
  const [regDateRange, setRegDateRange] = useState<DateRangeValue>({ from: '', to: '', preset: 'all' });
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(INITIAL_ADVANCED_FILTERS);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

  const activeAdvancedCount = useMemo(() => {
    return Object.values(advancedFilters).filter((v) => v && v.trim() !== '' && v !== 'all').length;
  }, [advancedFilters]);

  // Owner Leads: Date Range & Multi-Checkbox Filters (matching Owner Data)
  const [ownerDateRange, setOwnerDateRange] = useState<DateRangeValue>({ from: '', to: '', preset: 'all' });
  const [selectedOwnerAreas, setSelectedOwnerAreas] = useState<string[]>([]);
  const [selectedOwnerPropertyTypes, setSelectedOwnerPropertyTypes] = useState<string[]>([]);
  const [selectedOwnerBedrooms, setSelectedOwnerBedrooms] = useState<string[]>([]);

  // Distinct Options for Owner MultiCheckbox Dropdowns
  const ownerAreasList = useMemo(() => {
    const allRecs: any[] = queueData.all || [];
    const extracted = Array.from(new Set(allRecs.map((r: any) => (r.area || '').trim()).filter(Boolean)));
    const defaults = [
      'Downtown Dubai', 'Dubai Marina', 'Palm Jumeirah', 'Business Bay', 
      'Jumeirah Village Circle (JVC)', 'Dubai Hills Estate', 'Arabian Ranches', 
      'Damac Hills', 'Dubai Creek Harbour', 'MBR City'
    ];
    return Array.from(new Set([...extracted, ...defaults])).sort();
  }, [queueData.all]);

  const ownerPropTypesList = useMemo(() => {
    const allRecs: any[] = queueData.all || [];
    const extracted = Array.from(new Set(allRecs.map((r: any) => (r.property_type || '').trim()).filter(Boolean)));
    const defaults = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Commercial', 'Residential Plot'];
    return Array.from(new Set([...extracted, ...defaults])).sort();
  }, [queueData.all]);

  const ownerBedroomsList = useMemo(() => {
    const allRecs: any[] = queueData.all || [];
    const extracted = Array.from(new Set(allRecs.map((r: any) => (r.bedrooms || '').trim()).filter(Boolean)));
    const defaults = ['Studio', '1 BR', '2 BR', '3 BR', '4 BR', '5+ BR'];
    return Array.from(new Set([...defaults, ...extracted]));
  }, [queueData.all]);

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Checkbox Selection State
  const [selectedOppIds, setSelectedOppIds] = useState<number[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<number[]>([]);
  const [bulkStage, setBulkStage] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [availableStages, setAvailableStages] = useState<Array<{ key: string; label: string }>>([
    { key: 'new', label: 'New' },
    { key: 'contacted', label: '1. Contacted' },
    { key: 'qualified', label: '2. Qualified / Lead Qualification' },
    { key: 'option_sent', label: '3. Option Sent' },
    { key: 'follow_up', label: '4. Follow up' },
    { key: 'meeting', label: '5. Meeting / Viewing Scheduled' },
    { key: 'future_prospectus', label: '6. Future Prospectus' },
    { key: 'closed_won', label: '7. Closed Won 🏆' },
    { key: 'closed_lost', label: 'Closed Lost' },
  ]);

  // Read-only Modal & Opportunity Modal States
  const [selectedContactForModal, setSelectedContactForModal] = useState<any | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const [selectedOwnerForModal, setSelectedOwnerForModal] = useState<any | null>(null);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);

  const [opportunityModalContact, setOpportunityModalContact] = useState<any | null>(null);
  const [opportunityModalOwner, setOpportunityModalOwner] = useState<any | null>(null);
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);

  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Column Visibility & Order for Regular Leads
  const DEFAULT_REGULAR_COLUMNS: Record<string, boolean> = {
    client: true,
    phone: true,
    source: true,
    created_at: true,
    type_temp: true,
    budget_community: true,
    stage: true,
    call_outcome: true,
    sla: true,
    next_action: true,
    owner: true,
    actions: true,
  };

  const DEFAULT_REGULAR_COLUMN_ORDER = [
    'client',
    'phone',
    'source',
    'created_at',
    'type_temp',
    'budget_community',
    'stage',
    'call_outcome',
    'sla',
    'next_action',
    'owner',
    'actions',
  ];

  const REGULAR_COLUMNS = [
    { key: 'client', label: 'Client' },
    { key: 'phone', label: 'Phone' },
    { key: 'source', label: 'Source' },
    { key: 'created_at', label: 'Created Date' },
    { key: 'type_temp', label: 'Type Temp' },
    { key: 'budget_community', label: 'Budget Community' },
    { key: 'stage', label: 'Stage' },
    { key: 'call_outcome', label: 'Call Outcome' },
    { key: 'sla', label: 'Sla' },
    { key: 'next_action', label: 'Next Action' },
    { key: 'owner', label: 'Assigned Advisor' },
    { key: 'actions', label: 'Actions' },
  ];

  // Column Visibility & Order for Owner Leads
  const DEFAULT_OWNER_COLUMNS: Record<string, boolean> = {
    owner_name: true,
    phone: true,
    building_area: true,
    unit_specs: true,
    created_at: true,
    deal_status: true,
    call_outcome: true,
    assigned_to: true,
    actions: true,
  };

  const DEFAULT_OWNER_COLUMN_ORDER = [
    'owner_name',
    'phone',
    'building_area',
    'unit_specs',
    'created_at',
    'deal_status',
    'call_outcome',
    'assigned_to',
    'actions',
  ];

  const OWNER_COLUMNS = [
    { key: 'owner_name', label: 'Owner Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'building_area', label: 'Building Area' },
    { key: 'unit_specs', label: 'Unit Specs' },
    { key: 'created_at', label: 'Created Date' },
    { key: 'deal_status', label: 'Deal Status' },
    { key: 'call_outcome', label: 'Call Outcome' },
    { key: 'assigned_to', label: 'Assigned Advisor' },
    { key: 'actions', label: 'Actions' },
  ];

  const cleanPhone = (p?: string) => (p || '').replace(/[^0-9]/g, '');
  const formatDateTime = (raw?: any) => {
    if (!raw) return '—';
    if (typeof raw === 'string') {
      return raw.replace('T', ' ').substring(0, 16);
    }
    try {
      return new Date(raw).toISOString().replace('T', ' ').substring(0, 16);
    } catch {
      return '—';
    }
  };

  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [regularColumnVisibility, setRegularColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_REGULAR_COLUMNS);
  const [ownerColumnVisibility, setOwnerColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_OWNER_COLUMNS);
  const [regularColumnOrder, setRegularColumnOrder] = useState<string[]>(DEFAULT_REGULAR_COLUMN_ORDER);
  const [ownerColumnOrder, setOwnerColumnOrder] = useState<string[]>(DEFAULT_OWNER_COLUMN_ORDER);

  const updateRegularColumnVisibility = (newVisibility: Record<string, boolean>) => {
    setRegularColumnVisibility(newVisibility);
    if (typeof window !== 'undefined') {
      localStorage.setItem('queue_regular_column_visibility', JSON.stringify(newVisibility));
    }
  };

  const updateOwnerColumnVisibility = (newVisibility: Record<string, boolean>) => {
    setOwnerColumnVisibility(newVisibility);
    if (typeof window !== 'undefined') {
      localStorage.setItem('queue_owner_column_visibility', JSON.stringify(newVisibility));
    }
  };

  const updateRegularColumnOrder = (newOrder: string[]) => {
    setRegularColumnOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem('queue_regular_column_order', JSON.stringify(newOrder));
    }
  };

  const updateOwnerColumnOrder = (newOrder: string[]) => {
    setOwnerColumnOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem('queue_owner_column_order', JSON.stringify(newOrder));
    }
  };

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

    if (queueChannel === 'regular') {
      const newOrder = [...regularColumnOrder];
      const draggedIndex = newOrder.indexOf(draggedColKey);
      const targetIndex = newOrder.indexOf(targetColKey);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedColKey);
        updateRegularColumnOrder(newOrder);
      }
    } else {
      const newOrder = [...ownerColumnOrder];
      const draggedIndex = newOrder.indexOf(draggedColKey);
      const targetIndex = newOrder.indexOf(targetColKey);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedColKey);
        updateOwnerColumnOrder(newOrder);
      }
    }
    setDraggedColKey(null);
  };

  // Owner & Scope State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teamAgents, setTeamAgents] = useState<any[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('auto');

  useEffect(() => {
    const syncUser = () => {
      try {
        const raw = localStorage.getItem('crm_user');
        if (raw) {
          setCurrentUser(JSON.parse(raw));
        }
      } catch (e) {
        console.error(e);
      }
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
    // Load saved column preferences & order from localStorage
    if (typeof window !== 'undefined') {
      const savedReg = localStorage.getItem('queue_regular_column_visibility');
      if (savedReg) {
        try {
          const parsed = JSON.parse(savedReg);
          const clean: Record<string, boolean> = { ...DEFAULT_REGULAR_COLUMNS };
          Object.keys(DEFAULT_REGULAR_COLUMNS).forEach((k) => {
            if (k in parsed) clean[k] = !!parsed[k];
          });
          clean.created_at = true; // Always visible by default
          clean.call_outcome = parsed.call_outcome !== undefined ? !!parsed.call_outcome : true;
          setRegularColumnVisibility(clean);
        } catch (e) {
          console.error('Error loading saved regular columns:', e);
        }
      }

      const savedRegOrder = localStorage.getItem('queue_regular_column_order');
      if (savedRegOrder) {
        try {
          const parsed = JSON.parse(savedRegOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            let sanitized = parsed.filter((k: string) => DEFAULT_REGULAR_COLUMN_ORDER.includes(k) && k !== 'actions');
            if (!sanitized.includes('created_at')) {
              const srcIdx = sanitized.indexOf('source');
              if (srcIdx !== -1) {
                sanitized.splice(srcIdx + 1, 0, 'created_at');
              } else {
                sanitized.splice(3, 0, 'created_at');
              }
            }
            if (!sanitized.includes('call_outcome')) {
              const stageIdx = sanitized.indexOf('stage');
              if (stageIdx !== -1) {
                sanitized.splice(stageIdx + 1, 0, 'call_outcome');
              } else {
                sanitized.splice(7, 0, 'call_outcome');
              }
            }
            const missing = DEFAULT_REGULAR_COLUMN_ORDER.filter((k) => !sanitized.includes(k) && k !== 'actions');
            setRegularColumnOrder([...sanitized, ...missing, 'actions']);
          }
        } catch (e) {
          console.error('Error loading saved regular column order:', e);
        }
      }

      const savedOwner = localStorage.getItem('queue_owner_column_visibility');
      if (savedOwner) {
        try {
          const parsed = JSON.parse(savedOwner);
          const clean: Record<string, boolean> = { ...DEFAULT_OWNER_COLUMNS };
          Object.keys(DEFAULT_OWNER_COLUMNS).forEach((k) => {
            if (k in parsed) clean[k] = !!parsed[k];
          });
          clean.created_at = true; // Always visible by default
          clean.call_outcome = parsed.call_outcome !== undefined ? !!parsed.call_outcome : true;
          setOwnerColumnVisibility(clean);
        } catch (e) {
          console.error('Error loading saved owner columns:', e);
        }
      }

      const savedOwnerOrder = localStorage.getItem('queue_owner_column_order');
      if (savedOwnerOrder) {
        try {
          const parsed = JSON.parse(savedOwnerOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            let sanitized = parsed.filter((k: string) => DEFAULT_OWNER_COLUMN_ORDER.includes(k) && k !== 'actions');
            if (!sanitized.includes('created_at')) {
              const unitIdx = sanitized.indexOf('unit_specs');
              if (unitIdx !== -1) {
                sanitized.splice(unitIdx + 1, 0, 'created_at');
              } else {
                sanitized.splice(4, 0, 'created_at');
              }
            }
            if (!sanitized.includes('call_outcome')) {
              const dealIdx = sanitized.indexOf('deal_status');
              if (dealIdx !== -1) {
                sanitized.splice(dealIdx + 1, 0, 'call_outcome');
              } else {
                sanitized.splice(6, 0, 'call_outcome');
              }
            }
            const missing = DEFAULT_OWNER_COLUMN_ORDER.filter((k) => !sanitized.includes(k) && k !== 'actions');
            setOwnerColumnOrder([...sanitized, ...missing, 'actions']);
          }
        } catch (e) {
          console.error('Error loading saved owner column order:', e);
        }
      }
    }

    fetchApi('/users')
      .then((data) => {
        const rawUsers = Array.isArray(data) ? data : (data?.users || []);
        if (rawUsers.length > 0) {
          setTeamAgents(rawUsers.filter((u: any) => u.is_active));
        }
      })
      .catch(console.error);

    fetchApi('/opportunities/stages')
      .then((res) => {
        if (res.stages && Array.isArray(res.stages)) {
          const list = [...res.stages];
          if (!list.some((s) => s.key === 'new')) {
            list.unshift({ key: 'new', label: 'New' });
          }
          setAvailableStages(list);
        }
      })
      .catch(console.error);
  }, []);

  const loadQueue = async (ownerOverride?: string, channelOverride?: 'regular' | 'owner') => {
    setLoading(true);
    try {
      let raw = localStorage.getItem('crm_user');
      let user = currentUser;
      if (!user && raw) {
        try { user = JSON.parse(raw); } catch {}
      }

      const activeChannel = channelOverride !== undefined ? channelOverride : queueChannel;
      let url = `/queue?channel=${activeChannel}`;
      let targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;
      if (!isSuperUser(user)) {
        targetOwner = user?.name || 'auto';
      } else if (targetOwner === 'auto') {
        targetOwner = 'all';
      }

      if (targetOwner && targetOwner !== 'all') {
        url += `&owner=${encodeURIComponent(targetOwner)}`;
      }

      const data = await fetchApi(url);
      setQueueData(data);
      if (data.stages && Array.isArray(data.stages)) {
        const list = [...data.stages];
        if (!list.some((s) => s.key === 'new')) {
          list.unshift({ key: 'new', label: 'New' });
        }
        setAvailableStages(list);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load queue:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [selectedOwner, queueChannel]);

  const handleSwitchChannel = (newChannel: 'regular' | 'owner') => {
    if (newChannel === queueChannel) return;
    setQueueChannel(newChannel);
    setActiveTab('all');
    setCurrentPage(1);
    setSelectedOppIds([]);
    setSelectedOwnerIds([]);
    setSearchQuery('');
    setSelectedStage('all');
    setSelectedCallOutcome('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const copyToClipboard = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 1500);
  };


  // Quick call for Regular Leads
  const handleQuickCall = async (oppId: number, contactId: number, contactName: string = 'Client') => {
    const { value: formValues } = await Swal.fire({
      title: `<div class="text-[#081428] font-bold text-base">Log Call Outcome — ${contactName}</div>`,
      html: `
        <div class="space-y-3.5 text-left p-1 text-xs font-['Poppins',sans-serif]">
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
          <div id="swal-next-schedule-container">
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
      didOpen: (popup) => {
        const outcomeSelect = popup.querySelector('#swal-call-outcome') as HTMLSelectElement | null;
        const scheduleContainer = popup.querySelector('#swal-next-schedule-container') as HTMLElement | null;
        if (outcomeSelect && scheduleContainer) {
          const toggleSchedule = () => {
            const val = outcomeSelect.value || '';
            const isTerminal = val.includes('Not Interested') || val.includes('Wrong Number');
            scheduleContainer.style.display = isTerminal ? 'none' : 'block';
          };
          outcomeSelect.addEventListener('change', toggleSchedule);
          toggleSchedule();
        }
      },
      preConfirm: () => {
        const outcome = (document.getElementById('swal-call-outcome') as HTMLSelectElement)?.value;
        const schedule = (document.getElementById('swal-next-schedule') as HTMLSelectElement)?.value;
        const notes = (document.getElementById('swal-call-notes') as HTMLTextAreaElement)?.value;
        if (!notes || notes.trim() === '') {
          Swal.showValidationMessage('Please enter call notes / summary before saving.');
          return false;
        }
        const isTerminal = outcome?.includes('Not Interested') || outcome?.includes('Wrong Number');
        return { outcome, schedule: isTerminal ? null : schedule, notes, isTerminal };
      }
    });

    if (formValues) {
      let dueAt: Date | null = null;
      if (!formValues.isTerminal && formValues.schedule) {
        dueAt = new Date(Date.now() + 24 * 3600 * 1000);
        if (formValues.schedule === '15m') dueAt = new Date(Date.now() + 15 * 60 * 1000);
        else if (formValues.schedule === '2h') dueAt = new Date(Date.now() + 2 * 3600 * 1000);
        else if (formValues.schedule === '48h') dueAt = new Date(Date.now() + 48 * 3600 * 1000);
        else if (formValues.schedule === 'now') dueAt = new Date(Date.now() - 5 * 60 * 1000);
      }

      try {
        await fetchApi('/activities', {
          method: 'POST',
          body: JSON.stringify({
            contact_id: contactId,
            opportunity_id: (oppId && oppId > 0) ? oppId : null,
            type: 'call',
            call_outcome: formValues.outcome,
            description: `Quick Call: ${formValues.outcome} — ${formValues.notes}`,
            user_name: currentUser?.name || 'Agent',
            next_action: formValues.isTerminal ? `Closed: ${formValues.outcome}` : `Follow-up: ${formValues.outcome}`,
            next_action_due_at: dueAt ? dueAt.toISOString() : null,
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

  // Quick call for Owner Leads
  const handleQuickCallOwner = async (record: any) => {
    const ownerName = record.owner_name || record.name || 'Owner';
    const phone = record.mobile_number || record.phone_number;
    const { value: formValues } = await Swal.fire({
      title: `<div class="text-[#081428] font-bold text-base">Log Call Outcome — ${ownerName}</div>`,
      html: `
        <div class="space-y-3.5 text-left p-1 text-xs font-['Poppins',sans-serif]">
          <div class="text-[11px] text-[#6E6E6E] bg-slate-50 p-2.5 rounded border border-[#E8E4DC]">
            📞 <strong>Owner Contact:</strong> ${phone || 'No phone'} (${record.building_name || record.area || 'Property Owner'}). Record call outcome & notes below.
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Call Outcome Status</label>
            <select id="swal-call-outcome" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="Interested - Wants to List Property">Interested — Wants to List / Sell / Rent Property</option>
              <option value="Interested - Needs Market Valuation">Interested — Needs Market Valuation / Pricing Advice</option>
              <option value="Callback Requested">Callback Requested — Busy Right Now</option>
              <option value="Follow-up Required">Follow-up Required — Considering Options</option>
              <option value="No Answer / Sent WhatsApp">No Answer — Sent WhatsApp / Left Message</option>
              <option value="Not Interested / Already Rented">Not Interested — Already Rented / Not Selling</option>
              <option value="Wrong Number">Wrong Number / Invalid Contact Info</option>
            </select>
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Call Notes / Owner Feedback</label>
            <textarea id="swal-call-notes" rows="3" placeholder="Enter owner discussion summary, asking price, availability, property condition..." class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"></textarea>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save Call Log',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16A34A',
      cancelButtonColor: '#6E6E6E',
      preConfirm: () => {
        const outcome = (document.getElementById('swal-call-outcome') as HTMLSelectElement)?.value;
        const notes = (document.getElementById('swal-call-notes') as HTMLTextAreaElement)?.value;
        if (!notes || notes.trim() === '') {
          Swal.showValidationMessage('Please enter call notes / summary before saving.');
          return false;
        }
        return { outcome, notes };
      }
    });

    if (formValues) {
      const isTerminal = formValues.outcome?.includes('Not Interested') || formValues.outcome?.includes('Wrong Number');
      try {
        await fetchApi('/activities', {
          method: 'POST',
          body: JSON.stringify({
            owner_record_id: record.id,
            contact_id: record.contact_id || null,
            phone: phone,
            contact_name: ownerName,
            opportunity_id: record.active_opportunity?.id || null,
            type: 'call',
            call_outcome: formValues.outcome,
            description: `Owner Call (${record.building_name || record.area || 'Property'}): ${formValues.outcome} — ${formValues.notes}`,
            user_name: currentUser?.name || 'Agent',
            next_action: isTerminal ? `Closed: ${formValues.outcome}` : `Follow-up: ${formValues.outcome}`,
            next_action_due_at: isTerminal ? null : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
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
          title: 'Owner call logged successfully!',
        });

        loadQueue();
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to save call activity.', 'error');
      }
    }
  };

  // Open Opportunity creation modal for Owner Record
  const handleOpenOpportunityModalForOwner = (record: any) => {
    setSelectedOwnerForModal(record);
    setOpportunityModalOwner(record);
    setOpportunityModalContact({
      id: record.contact_id || 0,
      name: record.owner_name || record.name || 'Property Owner',
      phone: record.mobile_number || record.phone_number,
      source: 'Owner Data',
    });
    setIsOpportunityModalOpen(true);
  };

  // Open Opportunity creation modal for Regular Contact
  const handleOpenOpportunityModalForContact = (contact: any) => {
    setSelectedContactForModal(contact);
    setOpportunityModalContact(contact);
    setOpportunityModalOwner(null);
    setIsOpportunityModalOpen(true);
  };

  // Bulk actions for Regular Leads
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      if (queueChannel === 'regular') {
        setSelectedOppIds(paginatedOpps.map((o: any) => o.id));
      } else {
        setSelectedOwnerIds(paginatedOwners.map((o: any) => o.id));
      }
    } else {
      if (queueChannel === 'regular') {
        setSelectedOppIds([]);
      } else {
        setSelectedOwnerIds([]);
      }
    }
  };

  const handleSelectOne = (id: number) => {
    if (queueChannel === 'regular') {
      if (selectedOppIds.includes(id)) {
        setSelectedOppIds(selectedOppIds.filter((item) => item !== id));
      } else {
        setSelectedOppIds([...selectedOppIds, id]);
      }
    } else {
      if (selectedOwnerIds.includes(id)) {
        setSelectedOwnerIds(selectedOwnerIds.filter((item) => item !== id));
      } else {
        setSelectedOwnerIds([...selectedOwnerIds, id]);
      }
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

      const stageObj = availableStages.find((s) => s.key === bulkStage);
      const stageLabel = stageObj ? stageObj.label : bulkStage.replace('_', ' ').toUpperCase();

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
      });
      Toast.fire({
        icon: 'success',
        title: `Updated ${selectedOppIds.length} leads to stage: ${stageLabel}`,
      });

      setSelectedOppIds([]);
      setBulkStage('');
      loadQueue();
    } catch (err: any) {
      console.error('Failed to update stages:', err);
      Swal.fire('Error', 'Failed to update stages.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStageUpdateOwner = async () => {
    if (!bulkStage || selectedOwnerIds.length === 0) return;

    setBulkLoading(true);
    try {
      const allOwners: any[] = queueData.all || [];
      const selectedOwners = allOwners.filter((o) => selectedOwnerIds.includes(o.id));

      await Promise.all(
        selectedOwners.map(async (record) => {
          if (record.active_opportunity?.id) {
            return fetchApi(`/opportunities/${record.active_opportunity.id}/stage`, {
              method: 'PUT',
              body: JSON.stringify({ stage: bulkStage }),
            });
          } else {
            return fetchApi('/opportunities', {
              method: 'POST',
              body: JSON.stringify({
                owner_record_id: record.id,
                contact_id: record.contact_id || null,
                opportunity_type: 'seller',
                stage: bulkStage,
                temperature: 'warm',
                current_owner_name: record.assigned_to || currentUser?.name || 'Advisor',
                key_requirement: `Bulk stage updated from Owner Queue to: ${bulkStage.replace('_', ' ')}`,
              }),
            });
          }
        })
      );

      const stageObj = availableStages.find((s) => s.key === bulkStage);
      const stageLabel = stageObj ? stageObj.label : bulkStage.replace('_', ' ').toUpperCase();

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
      });
      Toast.fire({
        icon: 'success',
        title: `Updated ${selectedOwnerIds.length} owner leads to stage: ${stageLabel}`,
      });

      setSelectedOwnerIds([]);
      setBulkStage('');
      loadQueue();
    } catch (err: any) {
      console.error('Failed to update owner stages:', err);
      Swal.fire('Update Failed', err.message || 'Could not update stages for selected owner leads.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk Delete for Regular Leads (Lead Pool)
  const handleBulkDeleteRegular = async () => {
    if (selectedOppIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Delete Selected Leads?',
      text: `Are you sure you want to delete ${selectedOppIds.length} selected lead(s) from your queue?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: `Yes, Delete ${selectedOppIds.length} Leads`,
    });

    if (result.isConfirmed) {
      setBulkLoading(true);
      try {
        await fetchApi('/queue/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({
            channel: 'regular',
            ids: selectedOppIds,
          }),
        });

        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
        });
        Toast.fire({
          icon: 'success',
          title: `Deleted ${selectedOppIds.length} lead(s) from queue`,
        });

        setSelectedOppIds([]);
        loadQueue();
      } catch (err: any) {
        console.error('Failed to bulk delete leads:', err);
        Swal.fire('Error', err.message || 'Failed to delete leads from queue.', 'error');
      } finally {
        setBulkLoading(false);
      }
    }
  };

  // Bulk Delete for Owner Leads (Owner Data)
  const handleBulkDeleteOwner = async () => {
    if (selectedOwnerIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Delete Selected Owner Leads?',
      text: `Are you sure you want to permanently delete ${selectedOwnerIds.length} selected owner record(s)?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: `Yes, Delete ${selectedOwnerIds.length} Owner Records`,
    });

    if (result.isConfirmed) {
      setBulkLoading(true);
      try {
        await fetchApi('/queue/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({
            channel: 'owner',
            ids: selectedOwnerIds,
          }),
        });

        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
        });
        Toast.fire({
          icon: 'success',
          title: `Deleted ${selectedOwnerIds.length} owner record(s)`,
        });

        setSelectedOwnerIds([]);
        loadQueue();
      } catch (err: any) {
        console.error('Failed to bulk delete owner leads:', err);
        Swal.fire('Error', err.message || 'Failed to delete owner records.', 'error');
      } finally {
        setBulkLoading(false);
      }
    }
  };

  // ---------------- REGULAR LEADS LOGIC ----------------
  const allRawOpps: any[] = useMemo(() => {
    if (queueChannel !== 'regular') return [];
    const all = queueData.all || [
      ...(queueData.overdue || []),
      ...(queueData.due_now || []),
      ...(queueData.hot_leads || []),
      ...(queueData.upcoming || [])
    ];
    const uniqueMap = new Map();
    all.forEach((item: any) => uniqueMap.set(item.id, item));
    return Array.from(uniqueMap.values());
  }, [queueData, queueChannel]);

  const tabFilteredOpps = useMemo(() => {
    if (queueChannel !== 'regular') return [];
    if (activeTab === 'new') return allRawOpps.filter((opp: any) => !opp.call_outcome);
    if (activeTab === 'contacted') return allRawOpps.filter((opp: any) => !!opp.call_outcome);
    if (activeTab === 'contacted_today') return allRawOpps.filter((opp: any) => opp.contacted_today);
    if (activeTab === 'overdue') return queueData.overdue || [];
    if (activeTab === 'due_now') return queueData.due_now || [];
    if (activeTab === 'hot') return queueData.hot_leads || [];
    if (activeTab === 'upcoming') return queueData.upcoming || [];
    return allRawOpps;
  }, [activeTab, queueData, allRawOpps, queueChannel]);

  const filteredOpps = useMemo(() => {
    if (queueChannel !== 'regular') return [];
    return tabFilteredOpps.filter((opp: any) => {
      const contact = opp.contact || {};
      const qual = opp.buyer_qualification || opp.buyerQualification || {};
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

      // Date Range Filter on created_at (Lead Pool pattern)
      if (regDateRange.from) {
        const itemDate = (opp.created_at || contact.created_at || '').substring(0, 10);
        if (itemDate && itemDate < regDateRange.from) return false;
      }
      if (regDateRange.to) {
        const itemDate = (opp.created_at || contact.created_at || '').substring(0, 10);
        if (itemDate && itemDate > regDateRange.to) return false;
      }

      // Advanced Filters (Lead Pool pattern)
      if (advancedFilters.source && (contact.source || '').toLowerCase() !== advancedFilters.source.toLowerCase()) {
        return false;
      }
      if (advancedFilters.subSource && (contact.sub_source || '').toLowerCase() !== advancedFilters.subSource.toLowerCase()) {
        return false;
      }
      if (advancedFilters.opportunityType && (opp.opportunity_type || '').toLowerCase() !== advancedFilters.opportunityType.toLowerCase()) {
        return false;
      }
      if (advancedFilters.temperature && (opp.temperature || '').toLowerCase() !== advancedFilters.temperature.toLowerCase()) {
        return false;
      }
      if (advancedFilters.paymentMethod && (qual.payment_method || '').toLowerCase() !== advancedFilters.paymentMethod.toLowerCase()) {
        return false;
      }
      if (advancedFilters.developer && !(qual.developer || '').toLowerCase().includes(advancedFilters.developer.toLowerCase())) {
        return false;
      }
      if (advancedFilters.community && !(qual.community || '').toLowerCase().includes(advancedFilters.community.toLowerCase())) {
        return false;
      }
      if (advancedFilters.propertyType && !(qual.property_type || '').toLowerCase().includes(advancedFilters.propertyType.toLowerCase())) {
        return false;
      }
      if (advancedFilters.bedrooms && !(qual.bedrooms || '').toLowerCase().includes(advancedFilters.bedrooms.toLowerCase())) {
        return false;
      }
      if (advancedFilters.budgetMin && Number(opp.budget_min || 0) < Number(advancedFilters.budgetMin)) {
        return false;
      }
      if (advancedFilters.budgetMax && Number(opp.budget_max || opp.budget_min || 0) > Number(advancedFilters.budgetMax)) {
        return false;
      }

      // Stage Filter (database pipeline stage or no deal created)
      if (selectedStage !== 'all') {
        if (selectedStage === 'no_deal') {
          if (opp.has_opportunity) return false;
        } else {
          if (!opp.has_opportunity || (opp.stage || 'new').toLowerCase() !== selectedStage.toLowerCase()) {
            return false;
          }
        }
      }

      // Call Outcome Filter (database call outcome)
      if (selectedCallOutcome !== 'all') {
        if (selectedCallOutcome === 'uncontacted') {
          if (opp.call_outcome) return false;
        } else {
          if (!opp.call_outcome || (opp.call_outcome || '').toLowerCase() !== selectedCallOutcome.toLowerCase()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [tabFilteredOpps, searchQuery, regDateRange, advancedFilters, selectedStage, selectedCallOutcome, queueChannel]);

  const sortedOpps = useMemo(() => {
    if (queueChannel !== 'regular') return [];
    const list = [...filteredOpps];
    list.sort((a, b) => {
      if (sortBy === 'created_at') {
        const timeA = new Date(a.created_at || a.contact?.created_at || 0).getTime();
        const timeB = new Date(b.created_at || b.contact?.created_at || 0).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      let valA: any = a[sortBy] ?? '';
      let valB: any = b[sortBy] ?? '';

      if (sortBy === 'client') {
        valA = a.contact?.name || '';
        valB = b.contact?.name || '';
      } else if (sortBy === 'phone') {
        valA = a.contact?.phone || '';
        valB = b.contact?.phone || '';
      } else if (sortBy === 'source') {
        valA = a.contact?.source || '';
        valB = b.contact?.source || '';
      } else if (sortBy === 'type_temp') {
        valA = `${a.opportunity_type || ''} ${a.temperature || ''}`;
        valB = `${b.opportunity_type || ''} ${b.temperature || ''}`;
      } else if (sortBy === 'budget_community' || sortBy === 'budget') {
        valA = Number(a.budget_min || a.budget_max || 0);
        valB = Number(b.budget_min || b.budget_max || 0);
      } else if (sortBy === 'stage') {
        valA = a.stage || '';
        valB = b.stage || '';
      } else if (sortBy === 'sla' || sortBy === 'next_action_due_at') {
        const slaOrder: Record<string, number> = { overdue: 1, due_soon: 2, on_track: 3 };
        valA = slaOrder[a.sla_status] || (a.next_action_due_at ? 4 : 5);
        valB = slaOrder[b.sla_status] || (b.next_action_due_at ? 4 : 5);
      } else if (sortBy === 'next_action') {
        valA = a.next_action || '';
        valB = b.next_action || '';
      } else if (sortBy === 'owner') {
        valA = a.current_owner_name || '';
        valB = b.current_owner_name || '';
      } else if (sortBy === 'call_outcome') {
        valA = a.call_outcome || '';
        valB = b.call_outcome || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredOpps, sortBy, sortOrder, queueChannel]);

  const paginatedOpps = useMemo(() => {
    if (queueChannel !== 'regular') return [];
    const startIndex = (currentPage - 1) * perPage;
    return sortedOpps.slice(startIndex, startIndex + perPage);
  }, [sortedOpps, currentPage, perPage, queueChannel]);

  // ---------------- OWNER LEADS LOGIC ----------------
  const tabFilteredOwners: any[] = useMemo(() => {
    if (queueChannel !== 'owner') return [];
    const all = queueData.all || [];
    if (activeTab === 'new') return all.filter((rec: any) => !rec.call_outcome);
    if (activeTab === 'contacted') return all.filter((rec: any) => !!rec.call_outcome);
    if (activeTab === 'contacted_today') return all.filter((rec: any) => rec.contacted_today);
    if (activeTab === 'recent') return queueData.recent || [];
    if (activeTab === 'with_opportunity') return queueData.with_opportunity || [];
    if (activeTab === 'without_opportunity') return queueData.without_opportunity || [];
    return all;
  }, [activeTab, queueData, queueChannel]);

  const filteredOwners = useMemo(() => {
    if (queueChannel !== 'owner') return [];
    return tabFilteredOwners.filter((rec: any) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const nameMatch = (rec.owner_name || rec.name || '').toLowerCase().includes(q);
        const mobileMatch = (rec.mobile_number || '').toLowerCase().includes(q);
        const phoneMatch = (rec.phone_number || '').toLowerCase().includes(q);
        const emailMatch = (rec.email || '').toLowerCase().includes(q);
        const buildingMatch = (rec.building_name || rec.property_name || '').toLowerCase().includes(q);
        const areaMatch = (rec.area || '').toLowerCase().includes(q);
        const unitMatch = (rec.unit_number || rec.property_number || '').toLowerCase().includes(q);
        const typeMatch = (rec.property_type || '').toLowerCase().includes(q);
        const advisorMatch = (rec.assigned_to || '').toLowerCase().includes(q);

        if (!nameMatch && !mobileMatch && !phoneMatch && !emailMatch && !buildingMatch && !areaMatch && !unitMatch && !typeMatch && !advisorMatch) {
          return false;
        }
      }

      // Date Range Filter on created_at (Owner Data pattern)
      if (ownerDateRange.from) {
        const itemDate = (rec.created_at || '').substring(0, 10);
        if (itemDate && itemDate < ownerDateRange.from) return false;
      }
      if (ownerDateRange.to) {
        const itemDate = (rec.created_at || '').substring(0, 10);
        if (itemDate && itemDate > ownerDateRange.to) return false;
      }

      // Area Multi-Checkbox Filter (Owner Data pattern)
      if (selectedOwnerAreas.length > 0) {
        const recArea = (rec.area || '').trim().toLowerCase();
        if (!selectedOwnerAreas.some(a => a.toLowerCase() === recArea)) {
          return false;
        }
      }

      // Property Type Multi-Checkbox Filter (Owner Data pattern)
      if (selectedOwnerPropertyTypes.length > 0) {
        const recType = (rec.property_type || '').trim().toLowerCase();
        if (!selectedOwnerPropertyTypes.some(t => t.toLowerCase() === recType)) {
          return false;
        }
      }

      // Bedrooms Multi-Checkbox Filter (Owner Data pattern)
      if (selectedOwnerBedrooms.length > 0) {
        const recBed = (rec.bedrooms || '').trim().toLowerCase();
        if (!selectedOwnerBedrooms.some(b => b.toLowerCase() === recBed)) {
          return false;
        }
      }

      // Stage Filter (database active opportunity stage or no deal created)
      if (selectedStage !== 'all') {
        if (selectedStage === 'no_deal') {
          if (rec.active_opportunity) return false;
        } else {
          if (!rec.active_opportunity || (rec.active_opportunity.stage || 'new').toLowerCase() !== selectedStage.toLowerCase()) {
            return false;
          }
        }
      }

      // Call Outcome Filter (database call outcome)
      if (selectedCallOutcome !== 'all') {
        if (selectedCallOutcome === 'uncontacted') {
          if (rec.call_outcome) return false;
        } else {
          if (!rec.call_outcome || (rec.call_outcome || '').toLowerCase() !== selectedCallOutcome.toLowerCase()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [tabFilteredOwners, searchQuery, ownerDateRange, selectedOwnerAreas, selectedOwnerPropertyTypes, selectedOwnerBedrooms, selectedStage, selectedCallOutcome, queueChannel]);

  const sortedOwners = useMemo(() => {
    if (queueChannel !== 'owner') return [];
    const list = [...filteredOwners];
    list.sort((a, b) => {
      if (sortBy === 'created_at') {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      let valA: any = a[sortBy] ?? '';
      let valB: any = b[sortBy] ?? '';

      if (sortBy === 'owner_name') {
        valA = a.owner_name || a.name || '';
        valB = b.owner_name || b.name || '';
      } else if (sortBy === 'phone') {
        valA = a.mobile_number || a.phone_number || '';
        valB = b.mobile_number || b.phone_number || '';
      } else if (sortBy === 'building_area') {
        valA = `${a.building_name || ''} ${a.area || ''}`;
        valB = `${b.building_name || ''} ${b.area || ''}`;
      } else if (sortBy === 'unit_specs') {
        valA = `${a.unit_number || ''} ${a.property_type || ''} ${a.bedrooms || ''}`;
        valB = `${b.unit_number || ''} ${b.property_type || ''} ${b.bedrooms || ''}`;
      } else if (sortBy === 'deal_status') {
        valA = a.active_opportunity?.stage || '';
        valB = b.active_opportunity?.stage || '';
      } else if (sortBy === 'assigned_to') {
        valA = a.assigned_to || '';
        valB = b.assigned_to || '';
      } else if (sortBy === 'call_outcome') {
        valA = a.call_outcome || '';
        valB = b.call_outcome || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredOwners, sortBy, sortOrder, queueChannel]);

  const paginatedOwners = useMemo(() => {
    if (queueChannel !== 'owner') return [];
    const startIndex = (currentPage - 1) * perPage;
    return sortedOwners.slice(startIndex, startIndex + perPage);
  }, [sortedOwners, currentPage, perPage, queueChannel]);

  // Current active data set & pagination count
  const currentTotalItems = queueChannel === 'regular' ? sortedOpps.length : sortedOwners.length;
  const totalPages = Math.ceil(currentTotalItems / perPage) || 1;

  const handleSort = (colKey: string) => {
    if (colKey === 'actions') return;
    if (sortBy === colKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(colKey);
      setSortOrder(colKey === 'created_at' ? 'desc' : 'asc');
    }
  };

  const renderRegularHeaderCell = (colKey: string) => {
    const colMeta = REGULAR_COLUMNS.find((c) => c.key === colKey);
    if (!colMeta || (colKey !== 'actions' && !regularColumnVisibility[colKey])) return null;

    const label = colMeta.label;
    const isSortable = colKey !== 'actions';
    const isSorted = sortBy === colKey || (colKey === 'budget_community' && sortBy === 'budget') || (colKey === 'sla' && sortBy === 'next_action_due_at');

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
          <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0 cursor-grab active:cursor-grabbing" />
          <span>{label}</span>
          {isSortable && (
            isSorted ? (
              sortOrder === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )
          )}
        </div>
      </th>
    );
  };

  const renderOwnerHeaderCell = (colKey: string) => {
    const colMeta = OWNER_COLUMNS.find((c) => c.key === colKey);
    if (!colMeta || (colKey !== 'actions' && !ownerColumnVisibility[colKey])) return null;

    const label = colMeta.label;
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
          <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0 cursor-grab active:cursor-grabbing" />
          <span>{label}</span>
          {isSortable && (
            isSorted ? (
              sortOrder === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )
          )}
        </div>
      </th>
    );
  };

  const renderCallOutcomeBadge = (outcome?: string | null) => {
    if (!outcome) {
      return <span className="text-slate-400 font-mono text-[11px]">—</span>;
    }
    const o = outcome.trim();
    if (o.includes('Interested') || o.includes('Viewing') || o.includes('List') || o.includes('Valuation')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
          {o}
        </span>
      );
    }
    if (o.includes('Callback')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
          {o}
        </span>
      );
    }
    if (o.includes('Follow-up')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap">
          {o}
        </span>
      );
    }
    if (o.includes('No Answer') || o.includes('Voicemail')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-300 whitespace-nowrap">
          {o}
        </span>
      );
    }
    if (o.includes('Not Interested') || o.includes('Rented')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-300 whitespace-nowrap">
          {o}
        </span>
      );
    }
    if (o.includes('Wrong Number') || o.includes('Invalid')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
          {o}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 whitespace-nowrap">
        {o}
      </span>
    );
  };

  const renderRegularBodyCell = (opp: any, contact: any, qual: any, colKey: string) => {
    if (colKey !== 'actions' && !regularColumnVisibility[colKey]) return null;

    switch (colKey) {
      case 'client':
        const isNewLead = !opp.call_outcome;
        return (
          <td key={colKey} className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#081428] text-[#C8A147] font-bold text-xs flex items-center justify-center shrink-0">
                {contact.name ? contact.name.substring(0, 2).toUpperCase() : 'LE'}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const hasValidDeal = opp.has_opportunity && Number(opp.id) > 0;
                      setSelectedContactForModal({
                        ...contact,
                        active_opportunity: hasValidDeal ? opp : null,
                        opportunities: hasValidDeal ? [opp] : [],
                      });
                      setIsContactModalOpen(true);
                    }}
                    className="font-bold text-[#081428] hover:text-[#C8A147] transition-colors text-left cursor-pointer"
                    title="Click to view full lead profile popup"
                  >
                    {contact.name || `Lead #${contact.id || opp.contact_id || Math.abs(opp.id)}`}
                  </button>
                  {isNewLead ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      NEW
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-500 bg-slate-100">
                      Contacted
                    </span>
                  )}
                </div>
              </div>
            </div>
          </td>
        );

      case 'phone':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            <div className="font-mono text-xs text-[#081428] flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-[#C8A147]" />
              <span>{contact.phone || '—'}</span>
              {contact.phone && (
                <button
                  type="button"
                  onClick={(e) => copyToClipboard(contact.phone, `contact-phone-${opp.id}`, e)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                  title="Copy phone"
                >
                  {copiedPhoneId === `contact-phone-${opp.id}` ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </td>
        );

      case 'source':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
              {contact.source || 'Portal'}
            </span>
          </td>
        );

      case 'created_at': {
        const rawDate = opp.created_at || contact.created_at;
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            <div className="font-mono text-[11px] text-[#081428] flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#C8A147] shrink-0" />
              <span>{formatDateTime(rawDate)}</span>
            </div>
          </td>
        );
      }

      case 'type_temp':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
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
        );

      case 'budget_community':
        return (
          <td key={colKey} className="p-3">
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
        );

      case 'stage':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            {opp.has_opportunity ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                {(opp.stage || 'new').replace('_', ' ')}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                No Deal Created
              </span>
            )}
          </td>
        );

      case 'call_outcome':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            {renderCallOutcomeBadge(opp.call_outcome)}
          </td>
        );

      case 'sla':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
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
        );

      case 'next_action':
        return (
          <td key={colKey} className="p-3 max-w-xs">
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
        );

      case 'owner':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap font-medium text-slate-700">
            {opp.current_owner_name || 'Unassigned'}
          </td>
        );

      case 'actions':
        return (
          <td key={colKey} className="p-3 pr-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1.5">
              {/* 1. Log Phone Call */}
              <button
                onClick={() => handleQuickCall(opp.has_opportunity ? opp.id : 0, contact.id, contact.name)}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded border border-emerald-200 transition-colors cursor-pointer"
                title="Log Phone Call Outcome & Update SLA"
              >
                <PhoneCall className="w-3.5 h-3.5" />
              </button>

              {/* 2. View Lead Details */}
              <button
                onClick={() => {
                  const hasValidDeal = opp.has_opportunity && Number(opp.id) > 0;
                  setSelectedContactForModal({
                    ...contact,
                    active_opportunity: hasValidDeal ? opp : null,
                    opportunities: hasValidDeal ? [opp] : [],
                  });
                  setIsContactModalOpen(true);
                }}
                className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C8A147] text-slate-500 rounded border border-slate-200 transition-colors cursor-pointer"
                title="View Read-Only Lead Details Popup"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>

              {/* 3. WhatsApp Direct Chat */}
              <Link
                href={`/whatsapp?phone=${encodeURIComponent(contact.phone || '')}&name=${encodeURIComponent(contact.name || '')}`}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded border border-emerald-200 transition-colors"
                title="Open WhatsApp Chat"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </Link>

              {/* 4. Open Deal / Create Opportunity */}
              {opp.has_opportunity && Number(opp.id) > 0 ? (
                <Link
                  href={`/opportunities/${opp.id}`}
                  className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C8A147] text-slate-600 rounded border border-slate-200 transition-colors cursor-pointer"
                  title="Open Opportunity Deal Pipeline"
                >
                  <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                </Link>
              ) : (
                <button
                  onClick={() => handleOpenOpportunityModalForContact(contact)}
                  className="p-1.5 bg-[#C8A147]/10 hover:bg-[#C8A147] hover:text-[#081428] text-[#C8A147] rounded border border-[#C8A147]/30 transition-colors cursor-pointer"
                  title="Create Opportunity from Regular Lead"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>
        );

      default:
        return null;
    }
  };

  const renderOwnerBodyCell = (record: any, colKey: string) => {
    if (colKey !== 'actions' && !ownerColumnVisibility[colKey]) return null;
    const phone = record.mobile_number || record.phone_number;
    const activeOpp = (record.active_opportunity && Number(record.active_opportunity.id) > 0) ? record.active_opportunity : null;

    switch (colKey) {
      case 'owner_name': {
        const displayName = record.owner_name || record.name || `Owner #${record.id}`;
        const initials = (record.owner_name || record.name)
          ? (record.owner_name || record.name).trim().substring(0, 2).toUpperCase()
          : 'OW';
        const isNewOwner = !record.call_outcome;

        return (
          <td key={colKey} className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#081428] text-[#C8A147] font-bold text-xs flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOwnerForModal(record);
                      setIsOwnerModalOpen(true);
                    }}
                    className="font-bold text-[#081428] hover:text-[#C8A147] transition-colors text-left cursor-pointer"
                    title="Click to view complete owner and property profile popup"
                  >
                    {displayName}
                  </button>
                  {isNewOwner ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      NEW
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-500 bg-slate-100">
                      Contacted
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#6E6E6E]">
                  ID: #{record.id} · Added {record.created_at ? new Date(record.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </td>
        );
      }

      case 'phone':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <div className="font-mono text-xs text-[#081428] flex items-center gap-1">
                <Phone className="w-3 h-3 text-[#C8A147]" />
                <span>{phone || '—'}</span>
              </div>

              {phone && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => copyToClipboard(phone, `owner-phone-${record.id}`, e)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Copy Phone Number"
                  >
                    {copiedPhoneId === `owner-phone-${record.id}` ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  <a
                    href={`https://wa.me/${cleanPhone(phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                    title="Open in WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </td>
        );

      case 'building_area':
        return (
          <td key={colKey} className="p-3">
            <div className="font-bold text-[#081428] flex items-center gap-1 truncate max-w-[180px]">
              <Building2 className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
              <span className="truncate">{record.building_name || record.property_name || 'Property'}</span>
            </div>
            {record.area && (
              <div className="text-[10px] text-[#6E6E6E] flex items-center gap-1 mt-0.5 truncate max-w-[160px]">
                <MapPin className="w-2.5 h-2.5 text-red-500 shrink-0" />
                <span className="truncate">{record.area}</span>
              </div>
            )}
          </td>
        );

      case 'unit_specs': {
        const unit = record.property_number || record.unit_number;
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            <div className="font-semibold text-[#081428]">
              {unit ? `Unit #${unit}` : 'Unit Pending'}
            </div>
            <div className="text-[10px] text-[#6E6E6E]">
              {record.property_type || 'Property'} {record.bedrooms ? `· ${record.bedrooms}` : ''}
            </div>
          </td>
        );
      }

      case 'created_at': {
        const rawDate = record.created_at;
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            <div className="font-mono text-[11px] text-[#081428] flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#C8A147] shrink-0" />
              <span>{formatDateTime(rawDate)}</span>
            </div>
          </td>
        );
      }

      case 'deal_status':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            {activeOpp ? (
              <Link
                href={`/opportunities/${activeOpp.id}`}
                className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-[10px] uppercase flex items-center gap-1.5 w-fit transition-colors"
                title="Open Linked Deal in Pipeline"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>{(activeOpp.stage || 'Pipeline').replace('_', ' ')}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </Link>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                No Deal Created
              </span>
            )}
          </td>
        );

      case 'call_outcome':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap">
            {renderCallOutcomeBadge(record.call_outcome)}
          </td>
        );

      case 'assigned_to':
        return (
          <td key={colKey} className="p-3 whitespace-nowrap font-medium text-slate-700">
            {record.assigned_to || 'Unassigned'}
          </td>
        );

      case 'actions':
        return (
          <td key={colKey} className="p-3 pr-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1.5">
              {/* 1. Log Phone Call */}
              <button
                onClick={() => handleQuickCallOwner(record)}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded border border-emerald-200 transition-colors cursor-pointer"
                title="Log Phone Call Outcome & Update SLA"
              >
                <PhoneCall className="w-3.5 h-3.5" />
              </button>

              {/* 2. View Details Popup */}
              <button
                onClick={() => {
                  setSelectedOwnerForModal(record);
                  setIsOwnerModalOpen(true);
                }}
                className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C8A147] text-slate-500 rounded border border-slate-200 transition-colors cursor-pointer"
                title="View Read-Only Owner Details Popup"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>

              {/* 3. WhatsApp Direct Chat */}
              <Link
                href={`/whatsapp?phone=${encodeURIComponent(phone || '')}&name=${encodeURIComponent(record.owner_name || record.name || '')}`}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded border border-emerald-200 transition-colors"
                title="Open WhatsApp Chat"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </Link>

              {/* 4. Create Opportunity / Deal */}
              {activeOpp ? (
                <Link
                  href={`/opportunities/${activeOpp.id}`}
                  className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C8A147] text-slate-600 rounded border border-slate-200 transition-colors cursor-pointer"
                  title="Open Linked Pipeline Deal"
                >
                  <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                </Link>
              ) : (
                <button
                  onClick={() => handleOpenOpportunityModalForOwner(record)}
                  className="p-1.5 bg-[#C8A147]/10 hover:bg-[#C8A147] hover:text-[#081428] text-[#C8A147] rounded border border-[#C8A147]/30 transition-colors cursor-pointer"
                  title="Create Opportunity from Owner Lead"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>
        );

      default:
        return null;
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStage('all');
    setSelectedCallOutcome('all');
    if (queueChannel === 'regular') {
      setRegDateRange({ from: '', to: '', preset: 'all' });
      setAdvancedFilters(INITIAL_ADVANCED_FILTERS);
    } else {
      setOwnerDateRange({ from: '', to: '', preset: 'all' });
      setSelectedOwnerAreas([]);
      setSelectedOwnerPropertyTypes([]);
      setSelectedOwnerBedrooms([]);
    }
    if (isSuperUser(currentUser)) {
      setSelectedOwner('all');
    } else {
      setSelectedOwner(currentUser?.name || 'auto');
    }
    setActiveTab('all');
    setCurrentPage(1);
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const isFilterActive = queueChannel === 'regular'
    ? (searchQuery !== '' || regDateRange.preset !== 'all' || activeAdvancedCount > 0 || activeTab !== 'all' || selectedStage !== 'all' || selectedCallOutcome !== 'all' || (isSuperUser(currentUser) && selectedOwner !== 'all'))
    : (searchQuery !== '' || ownerDateRange.preset !== 'all' || selectedOwnerAreas.length > 0 || selectedOwnerPropertyTypes.length > 0 || selectedOwnerBedrooms.length > 0 || activeTab !== 'all' || selectedStage !== 'all' || selectedCallOutcome !== 'all' || (isSuperUser(currentUser) && selectedOwner !== 'all'));

  const isAllPageSelected = queueChannel === 'regular'
    ? (paginatedOpps.length > 0 && paginatedOpps.every((o: any) => selectedOppIds.includes(o.id)))
    : (paginatedOwners.length > 0 && paginatedOwners.every((o: any) => selectedOwnerIds.includes(o.id)));

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
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex font-['Poppins',sans-serif]">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <ListOrdered className="w-4 h-4" />
                <span>04 — Priority Calling & Follow-up Center</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                My Queue & Action Center
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Execute client calling queues, manage Regular and Owner follow-ups, and convert leads into active opportunities.
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
            </div>
          </div>

          {/* DUAL PRIMARY TABS: REGULAR LEADS vs OWNER LEADS & SUPER ADMIN AGENT SELECTOR (ABOVE CARDS) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-[#F0EDE8] p-1.5 rounded-xl border border-[#E8E4DC] shadow-inner">
              <button
                onClick={() => handleSwitchChannel('regular')}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  queueChannel === 'regular'
                    ? 'bg-[#081428] text-white shadow-md'
                    : 'text-[#6E6E6E] hover:text-[#081428] hover:bg-white/60'
                }`}
              >
                <Users className="w-4 h-4 text-[#C8A147]" />
                <span>Regular Leads (Lead Pool)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  queueChannel === 'regular'
                    ? 'bg-[#C8A147] text-[#081428]'
                    : 'bg-white text-slate-700 border border-[#E8E4DC]'
                }`}>
                  {queueData.channel_counts?.regular ?? 0}
                </span>
              </button>

              <button
                onClick={() => handleSwitchChannel('owner')}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  queueChannel === 'owner'
                    ? 'bg-[#081428] text-white shadow-md'
                    : 'text-[#6E6E6E] hover:text-[#081428] hover:bg-white/60'
                }`}
              >
                <Building2 className="w-4 h-4 text-[#C8A147]" />
                <span>Owner Leads (Owner Data)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  queueChannel === 'owner'
                    ? 'bg-[#C8A147] text-[#081428]'
                    : 'bg-white text-slate-700 border border-[#E8E4DC]'
                }`}>
                  {queueData.channel_counts?.owner ?? 0}
                </span>
              </button>
            </div>

            {/* Agent / Scope Selector - ONLY visible for Super Admin above the cards! */}
            {isSuperUser(currentUser) && (
              <div className="flex items-center gap-2 bg-white border border-[#E8E4DC] rounded-xl px-3 py-2 shadow-2xs">
                <UserCheck className="w-4 h-4 text-[#C8A147]" />
                <span className="text-xs font-bold text-[#6E6E6E]">Team View:</span>
                <select
                  value={selectedOwner === 'auto' ? 'all' : selectedOwner}
                  onChange={(e) => {
                    setSelectedOwner(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1 text-xs text-[#081428] font-bold focus:outline-none focus:ring-1 focus:ring-[#C8A147] cursor-pointer"
                >
                  <option value="all">👥 All Assigned Leads (Entire Team)</option>
                  {currentUser?.name && (
                    <option value={currentUser.name}>⭐ My Leads ({currentUser.name})</option>
                  )}
                  {teamAgents.filter((a) => a.name !== currentUser?.name).map((a) => (
                    <option key={a.id} value={a.name}>👤 {a.name} ({a.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* KPI SLA Stat Summary Cards */}
          {queueChannel === 'regular' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'all', label: 'All Active Leads', value: queueData.counts?.all ?? allRawOpps.length, sub: 'Total Queue Count', subColor: 'text-[#081428]', icon: ListOrdered, iconBg: 'bg-[#081428] text-[#C8A147]' },
                { id: 'new', label: '🟢 New Assigned', value: queueData.counts?.new_leads ?? allRawOpps.filter((o: any) => !o.call_outcome).length, sub: 'Never Called / Fresh', subColor: 'text-emerald-700', icon: Sparkles, iconBg: 'bg-emerald-100 text-emerald-800' },
                { id: 'contacted', label: '✅ Total Contacted', value: queueData.counts?.contacted ?? allRawOpps.filter((o: any) => !!o.call_outcome).length, sub: `${queueData.counts?.contacted_today ?? allRawOpps.filter((o: any) => o.contacted_today).length} Calls Logged Today`, subColor: 'text-blue-700', icon: CheckCircle2, iconBg: 'bg-blue-100 text-blue-700' },
                { id: 'overdue', label: '🚨 Overdue SLA', value: queueData.counts?.overdue ?? 0, sub: 'Immediate attention', subColor: 'text-red-700', icon: AlertCircle, iconBg: 'bg-red-100 text-red-700' },
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
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'all', label: 'All Owner Leads', value: queueData.counts?.all ?? 0, sub: 'Assigned Owner Records', subColor: 'text-[#081428]', icon: Building2, iconBg: 'bg-[#081428] text-[#C8A147]' },
                { id: 'new', label: '🟢 New Assigned', value: queueData.counts?.new_leads ?? (queueData.all || []).filter((r: any) => !r.call_outcome).length, sub: 'Untouched Owner Records', subColor: 'text-emerald-700', icon: Sparkles, iconBg: 'bg-emerald-100 text-emerald-800' },
                { id: 'contacted', label: '✅ Total Contacted', value: queueData.counts?.contacted ?? (queueData.all || []).filter((r: any) => !!r.call_outcome).length, sub: `${queueData.counts?.contacted_today ?? (queueData.all || []).filter((r: any) => r.contacted_today).length} Calls Logged Today`, subColor: 'text-blue-700', icon: CheckCircle2, iconBg: 'bg-blue-100 text-blue-700' },
                { id: 'without_opportunity', label: 'Ready to Call (No Opp)', value: queueData.counts?.without_opportunity ?? 0, sub: 'Awaiting Opportunity Deal', subColor: 'text-purple-700', icon: Briefcase, iconBg: 'bg-purple-100 text-purple-700' },
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
          )}

          {/* Sub-Tabs */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg px-4 shadow-2xs flex items-center gap-2 overflow-x-auto">
            {queueChannel === 'regular' ? (
              [
                { id: 'all', label: 'All Queue Leads' },
                { id: 'new', label: '🟢 New / Uncontacted' },
                { id: 'contacted', label: 'Contacted Leads ✅' },
                { id: 'overdue', label: 'Overdue / Breached 🚨' },
                { id: 'due_now', label: 'Due Soon (< 30 Mins) ⏰' },
                { id: 'hot', label: 'Hot Leads 🔥' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setCurrentPage(1);
                    }}
                    className={`px-4 py-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'border-[#C8A147] text-[#081428]'
                        : 'border-transparent text-[#6E6E6E] hover:text-[#081428] hover:border-slate-300'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })
            ) : (
              [
                { id: 'all', label: 'All Owner Leads' },
                { id: 'new', label: '🟢 New / Uncontacted' },
                { id: 'contacted', label: 'Contacted Leads ✅' },
                { id: 'without_opportunity', label: 'Calling Queue (No Deal Yet) 📞' },
                { id: 'with_opportunity', label: 'With Active Deal 💼' },
                { id: 'recent', label: 'Recent (Last 7 Days) ⚡' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setCurrentPage(1);
                    }}
                    className={`px-4 py-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'border-[#C8A147] text-[#081428]'
                        : 'border-transparent text-[#6E6E6E] hover:text-[#081428] hover:border-slate-300'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Control Bar: Filters & Columns (One Single Line) */}
          <div className="p-2.5 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-nowrap min-w-0 flex-1">
              {/* Search */}
              <div className="flex items-center gap-2 w-40 sm:w-44 lg:w-48 xl:w-56 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors shrink-0">
                <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
                <input
                  type="text"
                  placeholder={queueChannel === 'regular' ? "Search client, phone, action..." : "Search owner, building, area..."}
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

              {queueChannel === 'regular' ? (
                <>
                  {/* Date Range Calendar Filter (Lead Pool pattern) */}
                  <DateRangePicker
                    value={regDateRange}
                    onChange={(val) => {
                      setRegDateRange(val);
                      setCurrentPage(1);
                    }}
                  />

                  {/* Advanced Filter Button (Lead Pool pattern) */}
                  <button
                    type="button"
                    onClick={() => setIsAdvancedFilterOpen(true)}
                    className={`p-1.5 px-2.5 rounded border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
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
                </>
              ) : (
                <>
                  {/* Date Range Calendar Filter (Owner Data pattern) */}
                  <DateRangePicker
                    value={ownerDateRange}
                    onChange={(val) => {
                      setOwnerDateRange(val);
                      setCurrentPage(1);
                    }}
                  />

                  {/* Area Multi-Checkbox Filter (Owner Data pattern) */}
                  <MultiCheckboxDropdown
                    label="Area"
                    placeholder="All Areas"
                    options={ownerAreasList}
                    selected={selectedOwnerAreas}
                    onChange={(val) => {
                      setSelectedOwnerAreas(val);
                      setCurrentPage(1);
                    }}
                  />

                  {/* Property Types Multi-Checkbox Filter (Owner Data pattern) */}
                  <MultiCheckboxDropdown
                    label="Property Types"
                    placeholder="All Property Types"
                    options={ownerPropTypesList}
                    selected={selectedOwnerPropertyTypes}
                    onChange={(val) => {
                      setSelectedOwnerPropertyTypes(val);
                      setCurrentPage(1);
                    }}
                  />

                  {/* Bedrooms Multi-Checkbox Filter (Owner Data pattern) */}
                  <MultiCheckboxDropdown
                    label="Bedrooms"
                    placeholder="All Bedrooms"
                    options={ownerBedroomsList}
                    selected={selectedOwnerBedrooms}
                    onChange={(val) => {
                      setSelectedOwnerBedrooms(val);
                      setCurrentPage(1);
                    }}
                  />
                </>
              )}

              {/* Stage Filter Dropdown (from database stages) */}
              <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2 py-1.5 shrink-0 focus-within:border-[#C8A147]">
                <Briefcase className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                <select
                  value={selectedStage}
                  onChange={(e) => {
                    setSelectedStage(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer max-w-[120px] xl:max-w-[140px] truncate"
                >
                  <option value="all">📊 All Stages</option>
                  <option value="no_deal">⚠️ No Deal Created</option>
                  {availableStages.map((st) => (
                    <option key={st.key} value={st.key}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Call Outcome Filter Dropdown (from database call outcomes) */}
              <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2 py-1.5 shrink-0 focus-within:border-[#C8A147]">
                <PhoneCall className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                <select
                  value={selectedCallOutcome}
                  onChange={(e) => {
                    setSelectedCallOutcome(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer max-w-[130px] xl:max-w-[160px] truncate"
                >
                  <option value="all">📞 All Outcomes</option>
                  <option value="uncontacted">🟢 New / Uncontacted</option>
                  <option value="Interested - Schedule Viewing">Interested — Schedule Viewing</option>
                  <option value="Callback Requested">Callback Requested</option>
                  <option value="Follow-up Required">Follow-up Required</option>
                  <option value="No Answer / Left Voicemail">No Answer / Left Voicemail</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Wrong Number">Wrong Number</option>
                </select>
              </div>

              {/* Reset Button (Always visible like Lead Pool / Owner Data) */}
              <button
                onClick={handleResetFilters}
                className="text-xs text-[#C8A147] font-bold hover:underline px-1 transition-colors shrink-0 cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setColumnsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-52 bg-white border border-[#E8E4DC] rounded-lg shadow-xl p-2.5 z-50 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-1.5 mb-1 font-bold text-[#081428]">
                        <span className="text-[10px] font-bold text-[#6E6E6E] uppercase tracking-wider">Toggle Columns</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (queueChannel === 'regular') {
                              updateRegularColumnVisibility(DEFAULT_REGULAR_COLUMNS);
                              updateRegularColumnOrder(DEFAULT_REGULAR_COLUMN_ORDER);
                            } else {
                              updateOwnerColumnVisibility(DEFAULT_OWNER_COLUMNS);
                              updateOwnerColumnOrder(DEFAULT_OWNER_COLUMN_ORDER);
                            }
                          }}
                          className="text-[11px] text-[#C8A147] hover:underline font-semibold cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="space-y-1 max-h-72 overflow-y-auto">
                        {queueChannel === 'regular' ? (
                          REGULAR_COLUMNS.filter((col) => col.key !== 'actions').map((col) => (
                            <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-[#FAF8F5] rounded cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!regularColumnVisibility[col.key]}
                                onChange={(e) =>
                                  updateRegularColumnVisibility({
                                    ...regularColumnVisibility,
                                    [col.key]: e.target.checked,
                                  })
                                }
                                className="rounded text-[#C8A147] focus:ring-[#C8A147] cursor-pointer"
                              />
                              <span className={regularColumnVisibility[col.key] ? 'font-medium text-[#081428]' : 'text-slate-400'}>
                                {col.label}
                              </span>
                            </label>
                          ))
                        ) : (
                          OWNER_COLUMNS.filter((col) => col.key !== 'actions').map((col) => (
                            <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-[#FAF8F5] rounded cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!ownerColumnVisibility[col.key]}
                                onChange={(e) =>
                                  updateOwnerColumnVisibility({
                                    ...ownerColumnVisibility,
                                    [col.key]: e.target.checked,
                                  })
                                }
                                className="rounded text-[#C8A147] focus:ring-[#C8A147] cursor-pointer"
                              />
                              <span className={ownerColumnVisibility[col.key] ? 'font-medium text-[#081428]' : 'text-slate-400'}>
                                {col.label}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="text-[11px] font-medium text-[#6E6E6E] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#C8A147]" />
                <span>Showing {currentTotalItems} Leads</span>
              </div>
            </div>
          </div>

          {/* MASTER TABLE: REGULAR LEADS VIEW */}
          {queueChannel === 'regular' && (
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
                      {regularColumnOrder.map((colKey) => renderRegularHeaderCell(colKey))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#E8E4DC]">
                    {loading ? (
                      <tr>
                        <td colSpan={regularColumnOrder.filter((k) => k === 'actions' || regularColumnVisibility[k]).length + 1} className="p-8 text-center text-[#6E6E6E]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                          <span>Loading sales calling queue...</span>
                        </td>
                      </tr>
                    ) : paginatedOpps.length === 0 ? (
                      <tr>
                        <td colSpan={regularColumnOrder.filter((k) => k === 'actions' || regularColumnVisibility[k]).length + 1} className="p-12 text-center text-[#6E6E6E] space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                          <div className="font-bold text-sm text-[#081428]">Queue is Clear!</div>
                          <p className="text-xs text-[#6E6E6E]">No regular leads matching your current tab or search criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedOpps.map((opp: any) => {
                        const contact = opp.contact || {};
                        const qual = opp.buyer_qualification || opp.buyerQualification || {};
                        const isSelected = selectedOppIds.includes(opp.id);

                        return (
                          <tr
                            key={opp.has_opportunity ? `opp-${opp.id}` : `ct-${contact.id || opp.contact_id || opp.id}`}
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
                            {regularColumnOrder.map((colKey) => renderRegularBodyCell(opp, contact, qual, colKey))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Floating Bulk Action Bar for Regular Leads */}
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
                      className="p-1.5 bg-[#122444] border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#C8A147] cursor-pointer"
                    >
                      <option value="">Move to Stage...</option>
                      {availableStages.map((st) => (
                        <option key={st.key} value={st.key}>
                          {st.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleBulkStageUpdate}
                      disabled={!bulkStage || bulkLoading}
                      className="px-3 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold rounded transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {bulkLoading ? 'Updating...' : 'Update Stage'}
                    </button>

                    {canBulkDeleteQueue && (
                      <button
                        onClick={handleBulkDeleteRegular}
                        disabled={bulkLoading}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{bulkLoading ? 'Deleting...' : 'Delete Selected'}</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedOppIds([])}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer ml-2"
                  >
                    Deselect All
                  </button>
                </div>
              )}

              {/* Regular Leads Pagination Footer */}
              <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6E6E]">
                <div>
                  Showing <span className="font-bold text-[#081428]">{sortedOpps.length > 0 ? (currentPage - 1) * perPage + 1 : 0}</span> to{' '}
                  <span className="font-bold text-[#081428]">{Math.min(currentPage * perPage, sortedOpps.length)}</span> of{' '}
                  <span className="font-bold text-[#081428]">{sortedOpps.length}</span> regular leads
                </div>

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
          )}

          {/* MASTER TABLE: OWNER LEADS VIEW */}
          {queueChannel === 'owner' && (
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
                      {ownerColumnOrder.map((colKey) => renderOwnerHeaderCell(colKey))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#E8E4DC]">
                    {loading ? (
                      <tr>
                        <td colSpan={ownerColumnOrder.filter((k) => k === 'actions' || ownerColumnVisibility[k]).length + 1} className="p-8 text-center text-[#6E6E6E]">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                          <span>Loading owner calling queue...</span>
                        </td>
                      </tr>
                    ) : paginatedOwners.length === 0 ? (
                      <tr>
                        <td colSpan={ownerColumnOrder.filter((k) => k === 'actions' || ownerColumnVisibility[k]).length + 1} className="p-12 text-center text-[#6E6E6E] space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                          <div className="font-bold text-sm text-[#081428]">No Owner Leads in this Queue!</div>
                          <p className="text-xs text-[#6E6E6E]">Try changing your sub-tab or search criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedOwners.map((record: any) => {
                        const isSelected = selectedOwnerIds.includes(record.id);

                        return (
                          <tr
                            key={record.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isSelected ? 'bg-amber-50/50' : ''
                            }`}
                          >
                            <td className="p-3 pl-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectOne(record.id)}
                                className="rounded text-[#C8A147] focus:ring-[#C8A147] cursor-pointer"
                              />
                            </td>
                            {ownerColumnOrder.map((colKey) => renderOwnerBodyCell(record, colKey))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Owner Leads Pagination Footer */}
              <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6E6E]">
                <div>
                  Showing <span className="font-bold text-[#081428]">{sortedOwners.length > 0 ? (currentPage - 1) * perPage + 1 : 0}</span> to{' '}
                  <span className="font-bold text-[#081428]">{Math.min(currentPage * perPage, sortedOwners.length)}</span> of{' '}
                  <span className="font-bold text-[#081428]">{sortedOwners.length}</span> owner leads
                </div>

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

              {/* Floating Bulk Action Bar for Owner Leads */}
              {selectedOwnerIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#081428] text-white border border-[#C8A147]/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#C8A147] text-[#081428] font-bold text-xs flex items-center justify-center font-mono">
                      {selectedOwnerIds.length}
                    </span>
                    <span className="text-xs font-semibold">Owner Leads Selected</span>
                  </div>

                  <div className="h-4 w-px bg-slate-700" />

                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={bulkStage}
                      onChange={(e) => setBulkStage(e.target.value)}
                      className="p-1.5 bg-[#122444] border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#C8A147] cursor-pointer"
                    >
                      <option value="">Move to Stage...</option>
                      {availableStages.map((st) => (
                        <option key={st.key} value={st.key}>
                          {st.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleBulkStageUpdateOwner}
                      disabled={!bulkStage || bulkLoading}
                      className="px-3 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold rounded transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {bulkLoading ? 'Updating...' : 'Update Stage'}
                    </button>

                    {canBulkDeleteQueue && (
                      <button
                        onClick={handleBulkDeleteOwner}
                        disabled={bulkLoading}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{bulkLoading ? 'Deleting...' : 'Delete Selected'}</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedOwnerIds([])}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer ml-2"
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>
          )}

          {/* READ-ONLY CENTERED POPUP MODAL FOR REGULAR CLIENT CONTACT */}
          <ContactDetailModal
            contact={selectedContactForModal}
            isOpen={isContactModalOpen}
            onClose={() => setIsContactModalOpen(false)}
            onCreateOpportunity={(contact) => {
              setIsContactModalOpen(false);
              handleOpenOpportunityModalForContact(contact);
            }}
          />

          {/* READ-ONLY CENTERED POPUP MODAL FOR OWNER DATA RECORD */}
          <OwnerDetailModal
            owner={selectedOwnerForModal}
            isOpen={isOwnerModalOpen}
            onClose={() => setIsOwnerModalOpen(false)}
            onCreateOpportunity={(owner) => {
              setIsOwnerModalOpen(false);
              handleOpenOpportunityModalForOwner(owner);
            }}
          />

          {/* CONTEXTUAL CREATE OPPORTUNITY MODAL (REGULAR VS OWNER) */}
          <CreateOpportunityModal
            isOpen={isOpportunityModalOpen}
            onClose={() => {
              setIsOpportunityModalOpen(false);
              setOpportunityModalContact(null);
              setOpportunityModalOwner(null);
            }}
            contact={opportunityModalContact}
            ownerRecord={opportunityModalOwner}
            onSuccess={() => {
              setIsOpportunityModalOpen(false);
              setOpportunityModalContact(null);
              setOpportunityModalOwner(null);
              loadQueue();
            }}
          />

          {/* ADVANCED FILTERS MODAL FOR REGULAR LEADS */}
          <AdvancedFilterModal
            isOpen={isAdvancedFilterOpen}
            onClose={() => setIsAdvancedFilterOpen(false)}
            filters={advancedFilters}
            activeCount={activeAdvancedCount}
            onApply={(newFilters) => {
              setAdvancedFilters(newFilters);
              setCurrentPage(1);
            }}
            onReset={() => {
              setAdvancedFilters(INITIAL_ADVANCED_FILTERS);
              setCurrentPage(1);
            }}
          />
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
