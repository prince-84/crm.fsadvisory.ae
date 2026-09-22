'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ContactDrawer from '@/components/ContactDrawer';
import CreateContactModal from '@/components/CreateContactModal';
import CreateLeadModal from '@/components/CreateLeadModal';
import CreateOpportunityModal from '@/components/CreateOpportunityModal';
import ImportLeadsModal from '@/components/ImportLeadsModal';
import OpportunityQuickViewModal from '@/components/OpportunityQuickViewModal';
import AdvancedFilterModal, { AdvancedFiltersState, INITIAL_ADVANCED_FILTERS } from '@/components/AdvancedFilterModal';
import DateRangePicker, { DateRangeValue } from '@/components/DateRangePicker';
import { fetchApi } from '@/lib/api';
import { getGlobalColumnSettings, saveGlobalColumnSettings } from '@/lib/tableSettings';
import Swal from 'sweetalert2';
import { 
  Search, Download, Upload, Plus, Users, CheckCircle2, Briefcase, 
  RotateCcw, Copy, ChevronLeft, ChevronRight, RefreshCw, Trash2, Undo2, UserX,
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, GripVertical, UserCheck, X,
  Eye, Edit3, MessageSquare, Check, Zap, Filter, PhoneCall, AlertCircle, Sparkles, ListOrdered, Phone,
  Bell, Clock, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import { hasPermission, refreshCurrentUser, isSuperUser } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';

const formatCallOutcome = (outcome: string | null | undefined): string => {
  if (!outcome) return '';
  const o = outcome.trim();
  if (o.includes('Not Interested')) return 'Not Interested';
  if (o.includes('Real Estate Agent') || o.includes('Real Estate') || o.includes('Agent') || o.includes('Broker')) return 'Real Estate Agent';
  if (o.includes('Interested') || o.includes('Viewing') || o.includes('Meeting')) return 'Interested';
  if (o.includes('Callback')) return 'Callback';
  if (o.includes('Follow-up') || o.includes('Follow up')) return 'Follow-up';
  if (o.includes('No Answer') || o.includes('Voicemail')) return 'No Answer';
  if (o.includes('Wrong Number') || o.includes('Invalid')) return 'Wrong Number';
  return o;
};

const getStageBadgeInfo = (stage: string | null | undefined) => {
  const s = (stage || 'new').toLowerCase().replace('-', '_');
  switch (s) {
    case 'closed_won':
    case 'won':
      return { label: 'Won 🏆', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'negotiation':
      return { label: 'Negotiation', cls: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    case 'meeting_scheduled':
    case 'viewing_scheduled':
      return { label: 'Meeting', cls: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'qualified':
      return { label: 'Qualified', cls: 'bg-blue-100 text-blue-800 border-blue-300' };
    case 'contacted':
      return { label: 'Contacted', cls: 'bg-cyan-100 text-cyan-800 border-cyan-300' };
    case 'closed_lost':
    case 'lost':
      return { label: 'Lost', cls: 'bg-slate-100 text-slate-700 border-slate-300' };
    case 'new':
    case 'new_inquiry':
    default:
      return { label: 'New Inquiry', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
};

const getOutcomeBadgeClass = (outcome: string | null | undefined) => {
  if (!outcome) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (outcome.includes('Real Estate Agent') || outcome.includes('Real Estate') || outcome.includes('Agent') || outcome.includes('Broker')) {
    return 'bg-purple-50 text-purple-800 border-purple-300';
  }
  if (outcome.includes('Not Interested') || outcome.includes('Wrong Number') || outcome.includes('Invalid')) {
    return 'bg-slate-100 text-slate-700 border-slate-300';
  }
  if (outcome.includes('Interested') || outcome.includes('Viewing') || outcome.includes('Meeting')) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-300';
  }
  if (outcome.includes('Callback')) {
    return 'bg-amber-50 text-amber-800 border-amber-300';
  }
  if (outcome.includes('Follow-up') || outcome.includes('Follow up')) {
    return 'bg-blue-50 text-blue-800 border-blue-300';
  }
  if (outcome.includes('No Answer') || outcome.includes('Voicemail')) {
    return 'bg-rose-50 text-rose-800 border-rose-300';
  }
  return 'bg-amber-50 text-amber-800 border-amber-200';
};

export default function LeadPoolPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, available: 0, active: 0, reactivation: 0, duplicates: 0 });

  // Bulk Checkbox Selection & Assignment State
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [bulkAssignOwner, setBulkAssignOwner] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [canViewLeads, setCanViewLeads] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedOwner, setSelectedOwner] = useState<string>('auto');
  const [mounted, setMounted] = useState<boolean>(false);

  // Real-time 10-minute follow-up alerts state
  const [upcomingAlerts, setUpcomingAlerts] = useState<any[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<number[]>([]);
  const [currentAlertIndex, setCurrentAlertIndex] = useState<number>(0);
  const [isAlertsExpanded, setIsAlertsExpanded] = useState<boolean>(false);
  const [alertPosition, setAlertPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingAlert, setIsDraggingAlert] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const [bubblePosition, setBubblePosition] = useState<{ x: number; y: number } | null>(null);
  const bubbleDragMovedRef = useRef<boolean>(false);

  const handleBubbleMouseDown = (e: React.MouseEvent) => {
    // Only left click triggers drag
    if (e.button !== 0) return;
    
    e.preventDefault();
    bubbleDragMovedRef.current = false;

    const element = document.getElementById('floating-followup-bubble');
    const rect = element ? element.getBoundingClientRect() : { left: window.innerWidth - 260, top: window.innerHeight - 80 };

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = rect.left;
    const initialY = rect.top;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        bubbleDragMovedRef.current = true;
      }

      const bubbleWidth = element?.offsetWidth || 230;
      const bubbleHeight = element?.offsetHeight || 50;

      const newX = Math.max(10, Math.min(window.innerWidth - bubbleWidth - 10, initialX + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - bubbleHeight - 10, initialY + deltaY));

      setBubblePosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    isDraggingRef.current = true;
    setIsDraggingAlert(true);

    const element = document.getElementById('floating-followup-window');
    const rect = element ? element.getBoundingClientRect() : { left: window.innerWidth - 410, top: window.innerHeight - 500 };

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.startX;
      const deltaY = moveEvent.clientY - dragStartRef.current.startY;

      const newX = Math.max(10, Math.min(window.innerWidth - 400, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - 150, dragStartRef.current.initialY + deltaY));

      setAlertPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDraggingAlert(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const playAlertSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  const fetchUpcomingAlerts = async () => {
    try {
      const res = await fetchApi('/contacts/upcoming-alerts');
      if (res && Array.isArray(res.alerts)) {
        setUpcomingAlerts(res.alerts);
      }
    } catch (e) {
      console.error('Error fetching upcoming follow-up alerts:', e);
    }
  };

  const handleSnoozeAlert = async (contactId: number, minutes = 10) => {
    try {
      await fetchApi(`/contacts/${contactId}/snooze-followup`, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      });
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
      Toast.fire({
        icon: 'success',
        title: `Follow-up postponed/snoozed by ${minutes} minutes!`,
      });
      fetchUpcomingAlerts();
      loadData(currentPage);
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to snooze follow-up.', 'error');
    }
  };

  useEffect(() => {
    fetchUpcomingAlerts();
    const alertTimer = setInterval(() => {
      fetchUpcomingAlerts();
    }, 30000);
    return () => clearInterval(alertTimer);
  }, []);

  useEffect(() => {
    setMounted(true);
    const syncUser = () => {
      try {
        const raw = localStorage.getItem('crm_user');
        if (raw) {
          const u = JSON.parse(raw);
          setCurrentUser(u);
          const canViewAll = isSuperUser(u) || (u?.permissions && (u.permissions.includes('*') || u.permissions.includes('leads.view_all')));
          if (!canViewAll && u?.name) {
            setSelectedOwner(u.name);
          }
        }
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

  // Top Tabs State: 'all' | 'new' | 'contacted' | 'overdue' | 'opportunities' | 'unassigned' | 'duplicate' | 'deleted'
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'contacted' | 'overdue' | 'opportunities' | 'unassigned' | 'duplicate' | 'deleted'>('all');
  const [tabCounts, setTabCounts] = useState({ all: 0, new: 0, contacted: 0, overdue: 0, opportunities: 0, unassigned: 0, duplicate: 0, deleted: 0 });
  const [isQuickViewModalOpen, setIsQuickViewModalOpen] = useState(false);
  const [quickViewContact, setQuickViewContact] = useState<any | null>(null);

  const handleOpenQuickView = (contact: any) => {
    setQuickViewContact(contact);
    setIsQuickViewModalOpen(true);
  };

  // Sorting State connected to database (default: newest Created Date first)
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Secondary Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedCallOutcome, setSelectedCallOutcome] = useState<string>('all');
  const [opportunityModalContact, setOpportunityModalContact] = useState<any | null>(null);
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState<boolean>(false);
  
  // Date Range Calendar State (filters created_at in database)
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: '',
    to: '',
    preset: 'all',
  });

  // Advanced Filters State & Modal (includes Lifecycle State & Availability)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(INITIAL_ADVANCED_FILTERS);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

  const activeAdvancedCount = useMemo(() => {
    return Object.values(advancedFilters).filter((v) => v && v.trim() !== '' && v !== 'all').length;
  }, [advancedFilters]);

  const VISIBILITY_STORAGE_KEY = 'leads_column_visibility_v8';
  const ORDER_STORAGE_KEY = 'leads_column_order_v8';

  const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
    name: true,
    phone: true,
    lead_type: true,
    call_status: true,
    source: true,
    assigned_owner: true,
    created_at: true,
    updated_at: true,
    actions: true,
    state: false,
    secondary_phone: false,
    email: false,
    nationality: false,
    sub_source: false,
    utm_campaign: false,
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

  // Dynamic Column Visibility State (Persisted in localStorage)
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY);

  const updateColumnVisibility = (newVisibility: Record<string, boolean>) => {
    setColumnVisibility(newVisibility);
    if (typeof window !== 'undefined') {
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(newVisibility));
    }
    saveGlobalColumnSettings('leads', { visibility: newVisibility, order: columnOrder });
  };

  const DEFAULT_COLUMN_ORDER = [
    'name',
    'phone',
    'lead_type',
    'call_status',
    'source',
    'assigned_owner',
    'created_at',
    'updated_at',
    'state',
    'secondary_phone',
    'email',
    'nationality',
    'sub_source',
    'utm_campaign',
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

  // Drag & Drop Column Order State (Persisted in localStorage & Database)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);

  const updateColumnOrder = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(newOrder));
    }
    saveGlobalColumnSettings('leads', { visibility: columnVisibility, order: newOrder });
  };

  // Load saved column preferences from localStorage & Global Database
  useEffect(() => {
    const validKeys = ALL_COLUMNS.map((c) => c.key);

    const applyVisibility = (rawVis: any) => {
      const cleanVis: Record<string, boolean> = { ...DEFAULT_COLUMN_VISIBILITY };
      validKeys.forEach((k) => {
        if (k in rawVis) {
          cleanVis[k] = !!rawVis[k];
        }
      });
      cleanVis.created_at = true; // By default Created Date must be visible
      cleanVis.lead_type = rawVis.lead_type !== undefined ? !!rawVis.lead_type : true;
      cleanVis.actions = true;
      setColumnVisibility(cleanVis);
      if (typeof window !== 'undefined') {
        localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(cleanVis));
      }
    };

    const applyOrder = (rawOrder: any) => {
      if (Array.isArray(rawOrder) && rawOrder.length > 0) {
        let sanitized = rawOrder.filter((k: string) => validKeys.includes(k) && k !== 'actions');
        if (!sanitized.includes('created_at')) {
          sanitized.push('created_at');
        }
        if (!sanitized.includes('updated_at')) {
          sanitized.push('updated_at');
        }
        if (!sanitized.includes('lead_type')) {
          const pIdx = sanitized.indexOf('phone');
          if (pIdx !== -1) {
            sanitized.splice(pIdx + 1, 0, 'lead_type');
          } else {
            sanitized.splice(2, 0, 'lead_type');
          }
        }
        const missing = DEFAULT_COLUMN_ORDER.filter((k) => !sanitized.includes(k) && k !== 'actions');
        const finalOrder = Array.from(new Set([...sanitized, ...missing, 'actions']));
        setColumnOrder(finalOrder);
        if (typeof window !== 'undefined') {
          localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(finalOrder));
        }
      }
    };

    // 1. Instant fallback from localStorage
    if (typeof window !== 'undefined') {
      const savedVis = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (savedVis) {
        try {
          applyVisibility(JSON.parse(savedVis));
        } catch (e) {
          console.error('Error parsing column visibility:', e);
        }
      }
      const savedOrder = localStorage.getItem(ORDER_STORAGE_KEY);
      if (savedOrder) {
        try {
          applyOrder(JSON.parse(savedOrder));
        } catch (e) {
          console.error('Error parsing column order:', e);
        }
      }
    }

    // 2. Fetch global database configuration (cross-browser / cross-user)
    getGlobalColumnSettings('leads').then((globalSettings) => {
      if (!globalSettings) return;
      if (globalSettings.visibility) {
        applyVisibility(globalSettings.visibility);
      }
      if (globalSettings.order) {
        applyOrder(globalSettings.order);
      }
    });
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

  const ALL_COLUMNS = [
    { key: 'name', label: 'Client Profile', category: 'Core' },
    { key: 'phone', label: 'Primary Phone', category: 'Client Details' },
    { key: 'lead_type', label: 'Lead Type (Paid/Organic)', category: 'Core' },
    { key: 'call_status', label: 'Call Status', category: 'Core' },
    { key: 'source', label: 'Source', category: 'Core' },
    { key: 'assigned_owner', label: 'Assigned Owner', category: 'SLA & Owner' },
    { key: 'created_at', label: 'Created Date', category: 'Client Details' },
    { key: 'updated_at', label: 'Last Update', category: 'Client Details' },
    { key: 'state', label: 'Lifecycle State', category: 'Core' },
    { key: 'secondary_phone', label: 'Secondary Phone', category: 'Client Details' },
    { key: 'email', label: 'Email Address', category: 'Client Details' },
    { key: 'nationality', label: 'Nationality', category: 'Client Details' },
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
    { key: 'next_action', label: 'Next Action', category: 'SLA & Owner' },
    { key: 'next_action_due_at', label: 'Next Action Due', category: 'SLA & Owner' },
    { key: 'actions', label: 'Actions', category: 'Core' },
  ];

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
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-60 hover:opacity-100 shrink-0 cursor-grab" />
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

      case 'call_status': {
        const oppCount = (Array.isArray(ct.opportunities) && ct.opportunities.length > 0)
          ? ct.opportunities.length
          : (ct.opportunities_count || (ct.active_opportunity ? 1 : 0));

        if (oppCount > 0) {
          return (
            <td key={colKey} className="p-3">
              <span 
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#081428] text-[#C8A147] border border-[#C8A147] shadow-xs cursor-pointer hover:bg-[#C8A147] hover:text-[#081428] transition-all"
                title={`${oppCount} Deal / Opportunity created for this lead${ct.latest_call_outcome ? ` | Last Call: ${ct.latest_call_outcome}` : ''}. Click to open client profile.`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDrawer(ct);
                }}
              >
                <Briefcase className="w-3 h-3 text-[#C8A147] shrink-0" />
                <span>Deal {oppCount}</span>
              </span>
            </td>
          );
        }

        const rawOutcome = ct.latest_call_outcome;
        const outcome = formatCallOutcome(rawOutcome);
        if (outcome) {
          return (
            <td key={colKey} className="p-3">
              <span 
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-xs ${getOutcomeBadgeClass(rawOutcome)}`}
                title={`Last Call Outcome: ${rawOutcome}`}
              >
                <Phone className="w-2.5 h-2.5 shrink-0" />
                <span>{outcome}</span>
              </span>
            </td>
          );
        }

        return (
          <td key={colKey} className="p-3">
            <span 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs border border-emerald-400"
              title={ct.assigned_to ? `Assigned to ${ct.assigned_to} (Awaiting first call)` : "Fresh Inbound Lead in Pool (Awaiting call)"}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
              <span>NEW</span>
            </span>
          </td>
        );
      }

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

      case 'lead_type': {
        const rawType = (ct.lead_type || 'Organic').trim();
        const isPaid = rawType.toLowerCase() === 'paid';
        return (
          <td key={colKey} className="p-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                isPaid
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
              title={`Traffic Channel: ${isPaid ? 'Paid Ads Campaign' : 'Organic Traffic'}`}
            >
              {isPaid ? (
                <>
                  <Zap className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                  <span>PAID</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                  <span>ORGANIC</span>
                </>
              )}
            </span>
          </td>
        );
      }

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
        return <td key={colKey} className="p-3 text-slate-600 font-medium">{ct.email || '—'}</td>;

      case 'nationality':
        return <td key={colKey} className="p-3 text-slate-700 font-medium">{ct.nationality || '—'}</td>;

      case 'created_at':
        return (
          <td key={colKey} className="p-3 text-slate-600 font-medium text-xs font-mono">
            {ct.created_at ? ct.created_at.replace('T', ' ').substring(0, 16) : '—'}
          </td>
        );

      case 'updated_at':
        return (
          <td key={colKey} className="p-3 text-slate-600 font-medium text-xs font-mono">
            {ct.updated_at ? ct.updated_at.replace('T', ' ').substring(0, 16) : '—'}
          </td>
        );

      case 'source': {
        const rawSource = ct.source || 'Direct Inbound';
        const match = rawSource.match(/^(.*?)\s*\((.*?)\)$/);
        const main = match ? match[1].trim() : null;
        const sub = match ? match[2].trim() : null;

        return (
          <td key={colKey} className="p-3">
            <div 
              className="inline-flex flex-col justify-center px-2.5 py-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-left min-w-[130px] max-w-[220px]" 
              title={rawSource}
            >
              {main && sub ? (
                <>
                  <span className="text-[11px] font-bold text-[#081428] leading-tight whitespace-nowrap">
                    {main}
                  </span>
                  <span className="text-[10px] text-[#6E6E6E] font-medium leading-tight mt-0.5 whitespace-normal break-words">
                    ({sub})
                  </span>
                </>
              ) : (
                <span className="text-[11px] font-medium text-[#1A1A1A] leading-snug line-clamp-2">
                  {rawSource}
                </span>
              )}
            </div>
          </td>
        );
      }

      case 'sub_source':
        return <td key={colKey} className="p-3 text-slate-600">{ct.source?.match(/\((.*?)\)/)?.[1] || '—'}</td>;

      case 'utm_campaign': {
        const campaign = ct.utm_campaign || ct.utm_source;
        const campaignUrl = ct.campaign_url || ct.landing_page_url;
        return (
          <td key={colKey} className="p-3 text-xs">
            <div className="flex flex-col gap-0.5 max-w-[200px]">
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
            {activeTab === 'deleted' ? (
              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px] uppercase font-bold flex items-center gap-1 w-fit">
                <Trash2 className="w-3 h-3 shrink-0" />
                <span>Deleted</span>
              </span>
            ) : (
              <>
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
                    Available Pool
                  </span>
                )}
                {ct.state === 'reactivation' && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-[10px] uppercase font-bold">
                    Reactivation
                  </span>
                )}
                {ct.state === 'duplicate' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] uppercase font-bold border border-purple-300">
                    <Copy className="w-3 h-3 text-purple-600 shrink-0" />
                    <span>Duplicate</span>
                  </span>
                )}
              </>
            )}
          </td>
        );

      case 'opportunity': {
        const opps: any[] = Array.isArray(ct.opportunities) && ct.opportunities.length > 0 
          ? ct.opportunities 
          : (ct.active_opportunity ? [ct.active_opportunity] : (opp ? [opp] : []));

        if (opps.length === 0) {
          return (
            <td key={colKey} className="p-3">
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                  No Deal
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpportunityModalContact(ct);
                    setIsOpportunityModalOpen(true);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-[#C8A147] hover:text-[#081428] hover:bg-amber-100/50 rounded border border-[#C8A147]/50 flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
                  title="Create deal for this lead"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Deal</span>
                </button>
              </div>
            </td>
          );
        }

        // Identify primary/active deal: prefer active (non-closed) deals, latest first
        const activeList = opps.filter((o: any) => o.stage !== 'closed_won' && o.stage !== 'closed_lost');
        const primary = activeList.length > 0 ? activeList[0] : opps[0];
        const primaryBadge = getStageBadgeInfo(primary.stage);
        const hasMultiple = opps.length > 1;

        return (
          <td key={colKey} className="p-3">
            <div className="space-y-1 max-w-[240px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={`/opportunities/${primary.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-[#081428] hover:text-[#C8A147] hover:underline text-xs truncate max-w-[120px]"
                  title={primary.project || primary.community || primary.title || 'Dubai Property Deal'}
                >
                  {primary.project || primary.community || primary.title || 'Dubai Deal'}
                </Link>

                <span 
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border shadow-2xs ${primaryBadge.cls}`}
                  title={`Stage: ${primaryBadge.label}`}
                >
                  {primaryBadge.label}
                </span>

                {hasMultiple && (
                  <div className="relative group/deals inline-block" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-[#081428] border border-[#C8A147] hover:bg-[#C8A147] hover:text-white transition-all cursor-pointer shadow-2xs"
                      title={`Client has ${opps.length} deals. Hover to view all.`}
                    >
                      <Briefcase className="w-2.5 h-2.5 shrink-0" />
                      <span>+{opps.length - 1} Deals</span>
                    </button>

                    {/* Popover on hover/focus */}
                    <div className="hidden group-hover/deals:block absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-[#E8E4DC] p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="text-[10px] font-extrabold text-[#081428] uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-[#C8A147]" />
                          <span>All Deals ({opps.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOpportunityModalContact(ct);
                            setIsOpportunityModalOpen(true);
                          }}
                          className="text-[9px] font-bold text-[#C8A147] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" /> New Deal
                        </button>
                      </div>

                      <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto mt-1">
                        {opps.map((o: any) => {
                          const ob = getStageBadgeInfo(o.stage);
                          return (
                            <Link
                              key={o.id}
                              href={`/opportunities/${o.id}`}
                              className="py-1.5 px-1 hover:bg-slate-50 flex items-center justify-between gap-2 rounded transition-colors block text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-[#081428] truncate text-[11px]">
                                  {o.project || o.community || o.title || 'Dubai Deal'}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                  {o.budget_min ? (
                                    <span className="font-mono text-emerald-700 font-semibold">AED {(Number(o.budget_min) / 1000000).toFixed(1)}M</span>
                                  ) : null}
                                  <span>·</span>
                                  <span className="truncate">{o.current_owner_name || ct.assigned_to || 'Unassigned'}</span>
                                </div>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 border ${ob.cls}`}>
                                {ob.label}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                {primary.budget_min ? (
                  <span className="font-mono text-emerald-700 font-bold">AED {(Number(primary.budget_min) / 1000000).toFixed(1)}M</span>
                ) : null}
                <span className="text-slate-300">·</span>
                <span className="truncate">{primary.current_owner_name || ct.assigned_to || 'Unassigned'}</span>
              </div>
            </div>
          </td>
        );
      }

      case 'opportunity_type':
        return <td key={colKey} className="p-3 font-semibold uppercase text-[11px] text-slate-700">{opp?.opportunity_type || ct.inquiry_specs?.opportunity_type || (ct.inquiry_specs ? 'buyer' : '—')}</td>;

      case 'developer':
        return <td key={colKey} className="p-3 text-slate-700 font-medium">{opp?.developer || bq.developer || ct.inquiry_specs?.developer || '—'}</td>;

      case 'community':
        return <td key={colKey} className="p-3 text-slate-700">{opp?.community || bq.community || ct.inquiry_specs?.community || '—'}</td>;

      case 'project':
        return <td key={colKey} className="p-3 text-slate-700 font-semibold">{opp?.project || bq.project || ct.inquiry_specs?.project || '—'}</td>;

      case 'project_property':
        return <td key={colKey} className="p-3 text-slate-700">{opp?.project_property || bq.project_property || ct.inquiry_specs?.project_property || '—'}</td>;

      case 'bedrooms':
        return <td key={colKey} className="p-3 text-slate-700">{opp?.bedrooms || bq.bedrooms || ct.inquiry_specs?.bedrooms || '—'}</td>;

      case 'budget_min': {
        const bMin = opp?.budget_min || ct.inquiry_specs?.budget_min;
        return <td key={colKey} className="p-3 font-mono text-emerald-700 font-semibold">{bMin ? `AED ${Number(bMin).toLocaleString()}` : '—'}</td>;
      }

      case 'budget_max': {
        const bMax = opp?.budget_max || ct.inquiry_specs?.budget_max;
        return <td key={colKey} className="p-3 font-mono text-emerald-700 font-semibold">{bMax ? `AED ${Number(bMax).toLocaleString()}` : '—'}</td>;
      }

      case 'cash_or_finance':
        return <td key={colKey} className="p-3 text-slate-700 font-medium">{opp?.cash_or_finance || bq.cash_or_finance || ct.inquiry_specs?.cash_or_finance || '—'}</td>;

      case 'key_requirement':
        return <td key={colKey} className="p-3 text-slate-600 max-w-[200px] truncate">{opp?.key_requirement || ct.inquiry_specs?.key_requirement || '—'}</td>;

      case 'assigned_owner':
        const ownerName = ct.assigned_to || opp?.current_owner_name || 'Unassigned';
        const isUnassigned = !ownerName || ownerName === 'Unassigned';
        return (
          <td key={colKey} className="p-3">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${
              isUnassigned 
                ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                : 'bg-[#FAF8F5] text-[#081428] border border-[#E8E4DC]'
            }`}>
              <UserCheck className={`w-3.5 h-3.5 ${isUnassigned ? 'text-slate-400' : 'text-[#C8A147]'}`} />
              <span>{ownerName}</span>
            </span>
          </td>
        );

      case 'next_action': {
        const nextActionVal = ct.next_action || opp?.next_action || '—';
        return <td key={colKey} className="p-3 text-slate-600 max-w-[180px] truncate">{nextActionVal}</td>;
      }

      case 'next_action_due_at': {
        const dueAtVal = ct.next_action_due_at || opp?.next_action_due_at;
        if (!dueAtVal) {
          return <td key={colKey} className="p-3 text-slate-400 text-xs">—</td>;
        }
        const dueTime = new Date(dueAtVal).getTime();
        const diffMs = dueTime - Date.now();
        const diffMins = Math.round(diffMs / 60000);
        const formattedDate = String(dueAtVal).substring(0, 16).replace('T', ' ');

        if (diffMins < 0) {
          const absMins = Math.abs(diffMins);
          const timeStr = absMins < 60 ? `${absMins}m` : `${Math.floor(absMins / 60)}h ${absMins % 60}m`;
          return (
            <td key={colKey} className="p-3">
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-300 animate-pulse w-fit" title={`Overdue by ${timeStr} (${formattedDate})`}>
                  <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                  <span>Overdue {timeStr}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">{formattedDate}</span>
              </div>
            </td>
          );
        } else if (diffMins <= 10) {
          return (
            <td key={colKey} className="p-3">
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse w-fit" title={`Due in ${diffMins} mins (${formattedDate})`}>
                  <Zap className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                  <span>Due in {diffMins}m</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">{formattedDate}</span>
              </div>
            </td>
          );
        }

        return (
          <td key={colKey} className="p-3">
            <span className="font-mono text-xs text-slate-700">{formattedDate}</span>
          </td>
        );
      }

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
                {mounted && hasPermission('leads.restore') && (
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
                {/* 1. Log Phone Call & Outcome */}
                <button
                  onClick={() => handleQuickCall(ct)}
                  className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded border border-emerald-200 transition-colors cursor-pointer"
                  title="Log Phone Call Outcome & Update SLA"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                </button>

                {/* 2. Open Deal / Create Opportunity */}
                {opp && Number(opp.id) > 0 ? (
                  <Link
                    href={`/opportunities/${opp.id}`}
                    className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C8A147] text-slate-600 rounded border border-slate-200 transition-colors cursor-pointer inline-flex items-center justify-center"
                    title="Open Opportunity Deal Pipeline"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                  </Link>
                ) : (
                  <button
                    onClick={() => handleOpenOpportunityModalForContact(ct)}
                    className="p-1.5 bg-[#C8A147]/10 hover:bg-[#C8A147] hover:text-[#081428] text-[#C8A147] rounded border border-[#C8A147]/30 transition-colors cursor-pointer"
                    title="Create Opportunity from Lead"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* 3. View Lead Details */}
                <button
                  onClick={() => handleOpenDrawer(ct)}
                  className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-500 rounded border border-slate-200 transition-colors cursor-pointer"
                  title="View Lead Summary Drawer"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                {/* 4. WhatsApp Direct Chat */}
                <Link
                  href={`/whatsapp?phone=${encodeURIComponent(ct.phone || '')}&name=${encodeURIComponent(ct.name || '')}`}
                  className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded border border-emerald-200 transition-colors inline-flex items-center justify-center"
                  title="Open WhatsApp Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </Link>

                {/* 5. Edit Lead Profile (Full Page) */}
                {mounted && hasPermission('leads.edit') && (
                  <Link
                    href={`/leads/${ct.id}/edit`}
                    className="p-1.5 bg-slate-50 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-500 rounded border border-slate-200 transition-colors cursor-pointer inline-flex items-center justify-center"
                    title="Edit Lead Record"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Link>
                )}



                {/* 6. Soft Delete / Trash Lead */}
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

  const [loading, setLoading] = useState(true);

  // Pagination state connected to database
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [paginationMeta, setPaginationMeta] = useState({
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0,
    total: 0,
  });
  
  // Drawer & Modal states
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateContactModalOpen, setIsCreateContactModalOpen] = useState(false);
  const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleOpenOpportunityModalForContact = (contact: any) => {
    setSelectedContact(contact);
    setOpportunityModalContact(contact);
    setIsOpportunityModalOpen(true);
  };

  const handleQuickCall = async (contact: any) => {
    const opp = contact.active_opportunity || contact.opportunities?.[0];
    const oppId = opp?.id || null;
    const contactId = contact.id;
    const contactName = contact.name || 'Client';

    const now = new Date();
    const nowLocalIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const tomorrowLocalIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const { value: formValues } = await Swal.fire({
      title: `<div class="text-[#081428] font-bold text-base">Log Call Outcome — ${contactName}</div>`,
      html: `
        <div class="space-y-3.5 text-left p-1 text-xs font-['Poppins',sans-serif]">
          <div class="text-[11px] text-[#6E6E6E] bg-slate-50 p-2.5 rounded border border-[#E8E4DC]">
            📱 <strong>Agent Note:</strong> Dial client from handset. Log discussion points and outcome below to record activity & update SLA timer.
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Call Outcome Status</label>
            <select id="swal-call-outcome" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="Interested">Interested</option>
              <option value="Callback">Callback</option>
              <option value="Follow-up">Follow-up</option>
              <option value="No Answer">No Answer</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Wrong Number">Wrong Number</option>
              <option value="Real Estate Agent">Real Estate Agent</option>
            </select>
          </div>
          <div id="swal-next-schedule-container">
            <label class="block text-[#081428] font-bold mb-1">Next Follow-up & SLA Schedule</label>
            <select id="swal-next-schedule" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="24h">📅 Tomorrow at Same Time (24h) — [On Track 🟢]</option>
              <option value="15m">⚡ Quick Callback in 15 mins — [Due Soon 🟡]</option>
              <option value="2h">⏰ Later Today (in 2 hours) — [On Track 🟢]</option>
              <option value="5h">⏳ In 5 Hours — [On Track 🟢]</option>
              <option value="48h">📆 In 2 Days — [On Track 🟢]</option>
              <option value="custom">🗓️ Pick Specific Date & Time (Calendar)</option>
              <option value="now">🚨 Immediate Escalation (Now) — [Overdue 🔴]</option>
            </select>
            <div id="swal-custom-datetime-container" style="display: none;" class="mt-2.5 p-2.5 bg-amber-50/50 border border-amber-200 rounded text-left">
              <label class="block text-[#081428] font-semibold text-[11px] mb-1">🗓️ Choose Custom Follow-up Date & Time:</label>
              <input type="datetime-local" id="swal-custom-datetime" value="${tomorrowLocalIso}" min="${nowLocalIso}" class="w-full p-2 bg-white border border-[#C8A147] rounded text-xs text-[#081428] font-mono focus:ring-2 focus:ring-[#C8A147] focus:outline-none" />
              <p class="text-[10px] text-slate-500 mt-1">SLA alert will trigger 10 minutes prior to this scheduled time.</p>
            </div>
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
        const scheduleSelect = popup.querySelector('#swal-next-schedule') as HTMLSelectElement | null;
        const customContainer = popup.querySelector('#swal-custom-datetime-container') as HTMLElement | null;

        if (scheduleSelect && customContainer) {
          const toggleCustom = () => {
            customContainer.style.display = scheduleSelect.value === 'custom' ? 'block' : 'none';
          };
          scheduleSelect.addEventListener('change', toggleCustom);
          toggleCustom();
        }

        if (outcomeSelect && scheduleContainer) {
          const toggleSchedule = () => {
            const val = outcomeSelect.value || '';
            const isTerminal = val.includes('Not Interested') || val.includes('Wrong Number') || val.includes('Real Estate Agent');
            scheduleContainer.style.display = isTerminal ? 'none' : 'block';
          };
          outcomeSelect.addEventListener('change', toggleSchedule);
          toggleSchedule();
        }
      },
      preConfirm: () => {
        const outcome = (document.getElementById('swal-call-outcome') as HTMLSelectElement)?.value;
        const schedule = (document.getElementById('swal-next-schedule') as HTMLSelectElement)?.value;
        const customDateTime = (document.getElementById('swal-custom-datetime') as HTMLInputElement)?.value;
        const notes = (document.getElementById('swal-call-notes') as HTMLTextAreaElement)?.value;
        if (!notes || notes.trim() === '') {
          Swal.showValidationMessage('Please enter call notes / summary before saving.');
          return false;
        }
        const isTerminal = outcome?.includes('Not Interested') || outcome?.includes('Wrong Number') || outcome?.includes('Real Estate Agent');

        if (!isTerminal && schedule === 'custom') {
          if (!customDateTime) {
            Swal.showValidationMessage('Please select a date and time from the calendar.');
            return false;
          }
          const dt = new Date(customDateTime);
          if (isNaN(dt.getTime())) {
            Swal.showValidationMessage('Invalid date & time selected.');
            return false;
          }
        }

        return { outcome, schedule: isTerminal ? null : schedule, customDateTime, notes, isTerminal };
      }
    });

    if (formValues) {
      let dueAt: Date | null = null;
      if (!formValues.isTerminal && formValues.schedule) {
        if (formValues.schedule === 'custom' && formValues.customDateTime) {
          dueAt = new Date(formValues.customDateTime);
        } else if (formValues.schedule === '15m') {
          dueAt = new Date(Date.now() + 15 * 60 * 1000);
        } else if (formValues.schedule === '2h') {
          dueAt = new Date(Date.now() + 2 * 3600 * 1000);
        } else if (formValues.schedule === '5h') {
          dueAt = new Date(Date.now() + 5 * 3600 * 1000);
        } else if (formValues.schedule === '24h') {
          dueAt = new Date(Date.now() + 24 * 3600 * 1000);
        } else if (formValues.schedule === '48h') {
          dueAt = new Date(Date.now() + 48 * 3600 * 1000);
        } else if (formValues.schedule === 'now') {
          dueAt = new Date(Date.now() - 5 * 60 * 1000);
        }
      }

      try {
        await fetchApi('/activities', {
          method: 'POST',
          body: JSON.stringify({
            contact_id: contactId,
            opportunity_id: oppId,
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

        loadData(currentPage);
        fetchUpcomingAlerts();
        window.dispatchEvent(new CustomEvent('crm:contact-updated', { detail: { contactId } }));
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to save call activity.', 'error');
      }
    }
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
      let endpoint = `/contacts?leads_desk=1&page=${page}&per_page=${limit}&tab=${activeTab}&sort_by=${sBy}&sort_order=${sOrder}`;
      if (searchQuery) {
        endpoint += `&search=${encodeURIComponent(searchQuery)}`;
      }
      if (selectedStage && selectedStage !== 'all') {
        endpoint += `&stage=${encodeURIComponent(selectedStage)}`;
      }
      if (selectedCallOutcome && selectedCallOutcome !== 'all') {
        endpoint += `&call_outcome=${encodeURIComponent(selectedCallOutcome)}`;
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

      const canViewAllLeads = isSuperUser(user) || (user?.permissions && (user.permissions.includes('*') || user.permissions.includes('leads.view_all')));
      let targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;
      if (!canViewAllLeads) {
        targetOwner = user?.name || 'Unassigned';
      } else if (targetOwner === 'auto') {
        targetOwner = 'all';
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

      setStats(res.stats || { total: 0, available: 0, active: 0, reactivation: 0, duplicates: 0, new_leads: 0, contacted: 0, contacted_today: 0, overdue: 0 });
      setTabCounts(res.tab_counts || { all: 0, new: 0, contacted: 0, overdue: 0, unassigned: 0, duplicate: 0, deleted: 0 });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('crm_new_leads_count', { detail: res.tab_counts?.new ?? 0 }));
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      setContacts([]);
      setLoading(false);
    }
  };

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

  const handleExecuteBulkAssign = async () => {
    if (!bulkAssignOwner) {
      Swal.fire('Select Owner', 'Please select an Advisor / Owner from the dropdown.', 'warning');
      return;
    }

    setBulkLoading(true);
    try {
      const res = await fetchApi('/contacts/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          contact_ids: selectedContactIds,
          assigned_owner: bulkAssignOwner,
        }),
      });

      Swal.fire({
        icon: 'success',
        title: 'Bulk Assignment Complete!',
        text: res.message || `${selectedContactIds.length} leads assigned to ${bulkAssignOwner}.`,
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

  const handleExecuteBulkDelete = async () => {
    Swal.fire({
      title: 'Move Selected Leads to Trash?',
      text: `Are you sure you want to move ${selectedContactIds.length} selected leads to trash?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Delete Selected',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setBulkLoading(true);
        try {
          await fetchApi('/contacts/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ contact_ids: selectedContactIds }),
          });

          Swal.fire({
            icon: 'success',
            title: 'Leads Moved to Trash',
            text: `${selectedContactIds.length} leads moved to trash.`,
            timer: 1800,
            showConfirmButton: false,
          });

          setSelectedContactIds([]);
          loadData(currentPage);
        } catch (err: any) {
          Swal.fire('Error', err.message || 'Bulk deletion failed.', 'error');
        } finally {
          setBulkLoading(false);
        }
      }
    });
  };

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

  // Export CSV for Lead Pool
  const handleExportCsv = () => {
    if (contacts.length === 0) {
      Swal.fire({ icon: 'info', title: 'No Data', text: 'No leads available to export.' });
      return;
    }

    const headers = [
      'Client Name',
      'Primary Phone',
      'Secondary Phone',
      'Email',
      'Nationality',
      'Created Date',
      'Source Channel',
      'Sub-Source Campaign',
      'UTM Campaign',
      'Lifecycle State',
      'Opportunity Type',
      'Assigned Advisor'
    ];

    const rows = contacts.map((c) => {
      const opp = c.active_opportunity || c.opportunities?.[0];
      return [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${c.phone || ''}"`,
        `"${c.secondary_phone || ''}"`,
        `"${c.email || ''}"`,
        `"${c.nationality || ''}"`,
        `"${c.created_at || ''}"`,
        `"${c.source || ''}"`,
        `"${c.sub_source || ''}"`,
        `"${c.utm_campaign || ''}"`,
        `"${c.state || ''}"`,
        `"${opp?.opportunity_type || ''}"`,
        `"${opp?.current_owner_name || c.assigned_to || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lead_pool_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData(1, perPage, sortBy, sortOrder, selectedOwner);
  }, [activeTab, searchQuery, selectedOwner, selectedStage, selectedCallOutcome, advancedFilters, dateRange]);

  const handleSort = (columnKey: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === columnKey) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Default to descending for dates and numbers (most recent or highest first)
      if (['created_at', 'updated_at', 'budget_min', 'budget_max', 'next_action_due_at'].includes(columnKey)) {
        newOrder = 'desc';
      } else {
        newOrder = 'asc';
      }
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
    const canViewAll = isSuperUser(currentUser) || hasPermission('leads.view_all');
    setSelectedOwner(canViewAll ? 'all' : (currentUser?.name || 'Unassigned'));
    setSelectedStage('all');
    setSelectedCallOutcome('all');
    setAdvancedFilters(INITIAL_ADVANCED_FILTERS);
    setDateRange({ from: '', to: '', preset: 'all' });
    setSearchQuery('');
    setSortBy('created_at');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const handleOpenDrawer = async (contact: any) => {
    if (activeTab === 'deleted') return;
    try {
      const fullContact = await fetchApi(`/contacts/${contact.id}`).catch(() => contact);
      setSelectedContact(fullContact || contact);
      setIsDrawerOpen(true);
    } catch (err) {
      setSelectedContact(contact);
      setIsDrawerOpen(true);
    }
  };

  // SweetAlert2 Soft Delete Handler
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

  // SweetAlert2 Restore Handler
  const handleRestoreContact = async (contactId: number, contactName: string) => {
    try {
      await fetchApi(`/contacts/${contactId}/restore`, { method: 'POST' });
      Swal.fire({
        title: 'Restored!',
        text: `Lead "${contactName}" has been restored to active Lead Pool.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
      });
      loadData();
    } catch (err: any) {
      Swal.fire('Error!', err.message || 'Failed to restore contact', 'error');
    }
  };

  // SweetAlert2 Permanent Purge Handler
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

  // Helper to generate dynamic page numbers
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

  // Render Sort Header Column Helper
  const renderSortableHeader = (columnKey: string, label: string) => {
    const isSorted = sortBy === columnKey;
    return (
      <th 
        key={columnKey}
        onClick={() => handleSort(columnKey)}
        className="p-3 cursor-pointer hover:bg-[#F3EEDD] transition-colors select-none group"
      >
        <div className="flex items-center gap-1.5 font-semibold">
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

    if (canViewLeads === false) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
          <Sidebar />
          <div className="flex-1 pl-56 flex flex-col min-w-0">
            <Navbar />
            <AccessDenied moduleName="Lead Pool & Master Directory" requiredPermission="leads.view" />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
        {/* Deep Navy Sidebar */}
        <Sidebar />

        {/* Main Viewport */}
        <div className="flex-1 pl-56 flex flex-col min-w-0">
          <Navbar 
            teamSelector={
              mounted && (isSuperUser(currentUser) || hasPermission('leads.view_all')) ? (
                <div className="flex items-center gap-1.5 bg-[#FAF8F4] border border-[#E8E2D9] hover:border-[#C8A147] rounded-md px-2.5 py-1.5 text-xs shadow-2xs transition-colors">
                  <UserCheck className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                  <select
                    value={selectedOwner === 'auto' ? 'all' : selectedOwner}
                    onChange={(e) => {
                      setSelectedOwner(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all">👥 All Assigned Leads (Entire Team)</option>
                    <option value="unassigned">⏳ Unassigned Leads (Pool)</option>
                    {currentUser?.name && (
                      <option value={currentUser.name}>⭐ My Leads ({currentUser.name})</option>
                    )}
                    {activeAgents.filter((a) => a.name !== currentUser?.name).map((a) => (
                      <option key={a.id} value={a.name}>👤 {a.name} ({a.role})</option>
                    ))}
                  </select>
                </div>
              ) : mounted && currentUser?.name ? (
                <div className="flex items-center gap-1.5 bg-[#FAF8F4] border border-[#E8E2D9] rounded-md px-2.5 py-1.5 text-xs text-[#081428] font-bold shadow-2xs">
                  <UserCheck className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                  <span>⭐ My Assigned Leads ({currentUser.name})</span>
                </div>
              ) : null
            }
          />
          
          {/* MAIN LEADS TOP TAB & ACTIONS BAR (Attached directly to Top Bar, Edge-to-Edge) */}
          <div className="w-full bg-white border-b border-[#E8E4DC] px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs shrink-0 py-1 md:py-0">
            {/* Left: Optimized 5 Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
              {[
                { id: 'all', label: 'All Leads', count: tabCounts.all },
                { id: 'new', label: 'New', count: tabCounts.new },
                { id: 'contacted', label: 'Contacted', count: tabCounts.contacted },
                { id: 'overdue', label: 'Overdue', count: tabCounts.overdue },
                { id: 'opportunities', label: 'Opportunity Quick View', count: tabCounts.opportunities || 0 },
                { id: 'deleted', label: 'Deleted', count: tabCounts.deleted },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setCurrentPage(1);
                    }}
                    className={`px-3 sm:px-4 py-3 text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
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

            {/* Right: Import CSV, Export & Create Lead Action Buttons */}
            <div className="flex items-center gap-2 text-xs font-medium shrink-0 py-1.5 md:py-0">
              {mounted ? (
                <>
                  {hasPermission('leads.import') && (
                    <button 
                      onClick={() => setIsImportModalOpen(true)}
                      className="px-3 py-1.5 bg-white border border-[#E8E4DC] rounded-md text-[#1A1A1A] hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer font-medium"
                    >
                      <Download className="w-3.5 h-3.5 text-[#6E6E6E]" />
                      <span>Import CSV</span>
                    </button>
                  )}
                  {hasPermission('leads.export') && (
                    <button 
                      onClick={handleExportCsv}
                      className="px-3 py-1.5 bg-white border border-[#E8E4DC] rounded-md text-[#1A1A1A] hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer font-medium"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#6E6E6E]" />
                      <span>Export</span>
                    </button>
                  )}

                  {hasPermission('leads.create') && (
                    <Link
                      href="/leads/create"
                      className="px-3.5 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-white" />
                      <span className="text-white">Create Lead</span>
                    </Link>
                  )}
                </>
              ) : null}
            </div>
          </div>

          <main className="p-6 space-y-4 w-full">

          {/* Secondary Filter Bar */}
          <div className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left Group: Search Input + Filters + Reset */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Live Search Input */}
              <div className="flex items-center gap-2 w-52 sm:w-60 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors shrink-0">
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

              {/* Pipeline Stage Filter Dropdown */}
              <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 shrink-0">
                <Briefcase className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                <select
                  value={selectedStage}
                  onChange={(e) => {
                    setSelectedStage(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer max-w-[130px] truncate"
                >
                  <option value="all">📊 All Stages</option>
                  <option value="no_deal">⚠️ No Deal Created</option>
                  <option value="new_inquiry">New Inquiry</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="meeting_scheduled">Meeting Scheduled</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Won</option>
                  <option value="closed_lost">Lost</option>
                </select>
              </div>

              {/* Call Outcome Filter Dropdown */}
              <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 shrink-0">
                <PhoneCall className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                <select
                  value={selectedCallOutcome}
                  onChange={(e) => {
                    setSelectedCallOutcome(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">📞 All Outcomes</option>
                  <option value="deal">💼 Deals / Opportunities</option>
                  <option value="uncontacted">🟢 New / Uncontacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Callback">Callback</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Wrong Number">Wrong Number</option>
                  <option value="Real Estate Agent">Real Estate Agent</option>
                </select>
              </div>

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


              {/* Reset Button */}
              <button 
                onClick={handleResetFilters} 
                className="text-xs text-[#C8A147] font-bold hover:underline px-1 transition-colors ml-1"
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

          {/* Master Table Card with Drag & Drop Dynamic Columns */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E8E4DC] text-[#6E6E6E] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-3 pl-4 w-10">
                      <input
                        type="checkbox"
                        checked={contacts.length > 0 && selectedContactIds.length === contacts.length}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-[#E8E4DC] accent-[#C8A147] cursor-pointer"
                        title="Select all on current page"
                      />
                    </th>
                    {columnOrder.map((colKey) => renderHeaderCell(colKey))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DC]">
                  {loading ? (
                    <tr>
                      <td colSpan={(Object.values(columnVisibility).filter(Boolean).length || 1) + 1} className="p-8 text-center text-[#6E6E6E]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                        <span>Loading leads from database...</span>
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={(Object.values(columnVisibility).filter(Boolean).length || 1) + 1} className="p-8 text-center text-[#6E6E6E]">
                        No contacts found in &quot;{activeTab.toUpperCase()}&quot; view.
                      </td>
                    </tr>
                  ) : contacts.map((ct) => {
                    const opp = ct.opportunities && ct.opportunities.length > 0 ? ct.opportunities[0] : ct.active_opportunity;
                    const bq = opp?.buyer_qualification || {};
                    const isSelected = selectedContactIds.includes(ct.id);

                    return (
                      <tr 
                        key={ct.id} 
                        className={`transition-colors ${
                          isSelected ? 'bg-amber-50/60' :
                          ct.state === 'duplicate' ? 'bg-purple-50/30 hover:bg-purple-50/50' :
                          activeTab === 'deleted' ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="p-3 pl-4 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(ct.id)}
                            className="w-4 h-4 rounded border-[#E8E4DC] accent-[#C8A147] cursor-pointer"
                          />
                        </td>
                        {columnOrder.map((colKey) => renderBodyCell(ct, opp, bq, colKey))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* FLOATING BULK ASSIGNMENT & ACTION BAR */}
            {selectedContactIds.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#081428] text-white border border-[#C8A147]/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center gap-2 text-xs font-bold border-r border-[#152744] pr-4">
                  <span className="w-6 h-6 rounded-full bg-[#C8A147] text-[#081428] flex items-center justify-center font-mono text-xs font-extrabold">
                    {selectedContactIds.length}
                  </span>
                  <span>Leads Selected</span>
                </div>

                {activeTab === 'deleted' ? (
                  <div className="flex items-center gap-2">
                    {mounted && hasPermission('leads.restore') && (
                      <button
                        onClick={handleExecuteBulkRestore}
                        disabled={bulkLoading}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        title="Restore all selected leads back to active Lead Pool"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>{bulkLoading ? 'Restoring...' : 'Restore Selected'}</span>
                      </button>
                    )}

                    {mounted && hasPermission('leads.restore') && (
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
                      {activeAgents.map((ag) => (
                        <option key={ag.id} value={ag.name}>
                          {ag.name} ({ag.role || 'Agent'})
                        </option>
                      ))}
                      <option value="Unassigned">Unassigned</option>
                    </select>

                    <button
                      onClick={handleExecuteBulkAssign}
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
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
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
                      className={`w-7 h-7 rounded text-xs transition-colors ${
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
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Per Page Select Dropdown */}
              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
                className="p-1.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-medium cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
                <option value={500}>500 / page</option>
              </select>
            </div>
          </div>

        </main>
      </div>

      {/* Quick Contact Modal */}
      <CreateContactModal
        isOpen={isCreateContactModalOpen}
        onClose={() => setIsCreateContactModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Manual Create Lead Modal */}
      <CreateLeadModal
        isOpen={isCreateLeadModalOpen}
        onClose={() => setIsCreateLeadModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Right Contact Drawer */}
      <ContactDrawer
        contact={selectedContact}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onCreateOpportunity={(ct) => {
          setIsDrawerOpen(false);
          handleOpenOpportunityModalForContact(ct);
        }}
        onQuickCall={async (ct) => {
          await handleQuickCall(ct);
          if (ct?.id) {
            try {
              const updated = await fetchApi(`/contacts/${ct.id}`);
              setSelectedContact(updated);
            } catch (e) {}
          }
        }}
        onContactUpdated={() => {
          loadData(currentPage);
        }}
      />

      {/* Import CSV Leads Modal */}
      <ImportLeadsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadData()}
      />


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

      {/* Contextual Create Opportunity Modal */}
      <CreateOpportunityModal
        isOpen={isOpportunityModalOpen}
        onClose={() => {
          setIsOpportunityModalOpen(false);
          setOpportunityModalContact(null);
        }}
        contact={opportunityModalContact}
        onSuccess={() => {
          setIsOpportunityModalOpen(false);
          setOpportunityModalContact(null);
          loadData(currentPage);
        }}
      />

      {/* FLOATING CHAT-STYLE 10-MINUTE FOLLOW-UP & SLA ALERT WIDGET */}
      {(() => {
        const activeAlerts = upcomingAlerts.filter((a) => !dismissedAlertIds.includes(a.id));
        if (activeAlerts.length === 0) return null;

        const hasOverdue = activeAlerts.some((a) => a.is_overdue);

        // 1. Collapsed State: Sleek Floating Chat Badge / Bubble (Moveable anywhere)
        if (!isAlertsExpanded) {
          return (
            <div
              id="floating-followup-bubble"
              style={
                bubblePosition
                  ? { left: `${bubblePosition.x}px`, top: `${bubblePosition.y}px`, bottom: 'auto', right: 'auto' }
                  : {}
              }
              className={`fixed z-50 animate-in slide-in-from-bottom-3 duration-200 select-none ${
                !bubblePosition ? 'bottom-6 right-6' : ''
              }`}
            >
              <button
                type="button"
                onMouseDown={handleBubbleMouseDown}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setBubblePosition(null);
                }}
                onClick={() => {
                  if (!bubbleDragMovedRef.current) {
                    setIsAlertsExpanded(true);
                  }
                }}
                className={`group px-4 py-3 rounded-full shadow-2xl flex items-center gap-3 transition-all transform hover:scale-105 cursor-grab active:cursor-grabbing border backdrop-blur-md select-none ${
                  hasOverdue
                    ? 'bg-[#180b0b] border-rose-500 text-white ring-2 ring-rose-500/40 shadow-rose-950/50'
                    : 'bg-[#081428] border-[#C8A147] text-white ring-2 ring-[#C8A147]/40 shadow-slate-950/50'
                }`}
                title="Drag to move anywhere · Double click to reset · Click to view follow-ups"
              >
                {/* Pulsing indicator */}
                <div className="relative flex items-center justify-center pointer-events-none">
                  <span className={`animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full opacity-75 ${
                    hasOverdue ? 'bg-rose-500' : 'bg-amber-400'
                  }`} />
                  <div className={`w-3 h-3 rounded-full ${
                    hasOverdue ? 'bg-rose-500' : 'bg-[#C8A147]'
                  }`} />
                </div>

                <div className="flex items-center gap-2 pointer-events-none">
                  <PhoneCall className={`w-4 h-4 ${hasOverdue ? 'text-rose-400' : 'text-[#C8A147]'}`} />
                  <span className="text-xs font-bold font-heading tracking-wide">
                    {hasOverdue ? 'Follow-ups Overdue' : 'Follow-ups Due'}
                  </span>
                </div>

                {/* Count Badge */}
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-extrabold shadow-xs pointer-events-none ${
                  hasOverdue ? 'bg-rose-500 text-white' : 'bg-[#C8A147] text-[#081428]'
                }`}>
                  {activeAlerts.length}
                </span>

                <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors ml-0.5 pointer-events-none" />
              </button>
            </div>
          );
        }

        // 2. Expanded State: Floating Chat / Task Drawer Window (Moveable & Scrollable)
        return (
          <div 
            id="floating-followup-window"
            style={
              alertPosition
                ? { left: `${alertPosition.x}px`, top: `${alertPosition.y}px`, bottom: 'auto', right: 'auto' }
                : {}
            }
            className={`fixed z-50 w-96 max-w-[calc(100vw-2rem)] flex flex-col bg-[#081428] border border-[#C8A147]/80 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200 select-none ${
              !alertPosition ? 'bottom-6 right-6' : ''
            }`}
          >
            {/* Window Draggable Header */}
            <div 
              onMouseDown={handleDragMouseDown}
              onDoubleClick={() => setAlertPosition(null)}
              className={`p-3 flex items-center justify-between border-b border-white/10 select-none transition-colors cursor-grab active:cursor-grabbing ${
                hasOverdue ? 'bg-[#180b0b]' : 'bg-[#0b1b36]'
              }`}
              title="Click & drag to move window anywhere | Double click to reset to bottom-right"
            >
              <div className="flex items-center gap-2">
                {/* Drag Handle Icon */}
                <div className="flex items-center justify-center p-1 rounded hover:bg-white/10 text-[#C8A147]/70 hover:text-[#C8A147] cursor-grab active:cursor-grabbing shrink-0" title="Drag to move">
                  <GripVertical className="w-4 h-4" />
                </div>

                <div className="relative flex items-center justify-center">
                  <span className={`animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-75 ${
                    hasOverdue ? 'bg-rose-500' : 'bg-amber-400'
                  }`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    hasOverdue ? 'bg-rose-500' : 'bg-[#C8A147]'
                  }`} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#C8A147] flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Follow-up Tasks ({activeAlerts.length})</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Drag header to move · {activeAlerts.length} to contact
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {alertPosition && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlertPosition(null);
                    }}
                    className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-amber-300 text-[10px] font-mono transition-colors cursor-pointer"
                    title="Reset to bottom-right corner"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAlertsExpanded(false);
                  }}
                  className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimize / Collapse"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable List of Due Contacts with explicit vertical scrollbar */}
            <div className="overflow-y-auto max-h-[380px] p-3 space-y-2.5 divide-y divide-white/5 [scrollbar-width:thin] [scrollbar-color:#C8A147_rgba(255,255,255,0.08)]">
              {activeAlerts.map((alertItem) => (
                <div key={alertItem.id} className="pt-2.5 first:pt-0 space-y-2">
                  {/* Client Name & Urgency Status */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetCt = alertItem.contact || { id: alertItem.contact_id, name: alertItem.client_name, phone: alertItem.phone };
                        handleOpenDrawer(targetCt);
                      }}
                      className="font-bold text-sm text-white hover:text-[#C8A147] transition-colors truncate text-left cursor-pointer flex items-center gap-1"
                      title="Open Lead Drawer"
                    >
                      <span className="truncate">{alertItem.client_name}</span>
                      <Eye className="w-3 h-3 text-slate-400 shrink-0" />
                    </button>

                    <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold shrink-0 ${
                      alertItem.is_overdue
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {alertItem.status_label}
                    </span>
                  </div>

                  {/* Phone number */}
                  <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#C8A147] shrink-0" />
                      <span>{alertItem.phone || 'No phone'}</span>
                      {alertItem.phone && (
                        <button
                          type="button"
                          onClick={(e) => copyToClipboard(alertItem.phone, `alert-phone-${alertItem.id}`, e)}
                          className="text-slate-400 hover:text-[#C8A147] cursor-pointer"
                          title="Copy Phone"
                        >
                          {copiedField === `alert-phone-${alertItem.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 font-sans">
                      Owner: {alertItem.assigned_owner || 'Unassigned'}
                    </span>
                  </div>

                  {/* Follow-up Note & Scheduled time */}
                  <div className="text-[11px] text-slate-300 bg-black/40 p-2 rounded-md border border-white/5 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>Scheduled Follow-up:</span>
                      <span className="text-amber-300 font-mono">
                        {new Date(alertItem.next_action_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-amber-200 text-xs font-medium truncate">
                      {alertItem.next_action}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const targetCt = alertItem.contact || { id: alertItem.contact_id, name: alertItem.client_name, phone: alertItem.phone };
                        handleQuickCall(targetCt);
                      }}
                      className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>Call Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSnoozeAlert(alertItem.contact_id, 10)}
                      className="py-1.5 px-2.5 bg-white/10 hover:bg-white/20 text-amber-300 font-medium text-xs rounded border border-amber-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Postpone / Snooze follow-up by 10 minutes"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Snooze 10m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedAlertIds((prev) => [...prev, alertItem.id])}
                      className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors cursor-pointer"
                      title="Dismiss from list"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Summary */}
            <div className="p-2.5 bg-black/50 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>{activeAlerts.length} total pending {activeAlerts.length === 1 ? 'contact' : 'contacts'}</span>
              <button
                type="button"
                onClick={() => setIsAlertsExpanded(false)}
                className="text-xs font-semibold text-[#C8A147] hover:underline cursor-pointer"
              >
                Minimize Window
              </button>
            </div>
          </div>
        );
      })()}
      {/* Opportunity Quick View Modal */}
      <OpportunityQuickViewModal
        isOpen={isQuickViewModalOpen}
        onClose={() => {
          setIsQuickViewModalOpen(false);
          setQuickViewContact(null);
        }}
        contact={quickViewContact}
      />
    </div>
  );
}
