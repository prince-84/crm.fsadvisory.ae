'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import Swal from 'sweetalert2';
import { hasAnyPermission } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';
import {
  FileText,
  TrendingUp,
  BarChart3,
  PieChart,
  DollarSign,
  Download,
  Calendar,
  Layers,
  Building2,
  PhoneCall,
  ShieldCheck,
  CheckCircle2,
  Target,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Award,
  Filter,
  Users,
  Clock,
  UserCheck,
  PhoneIncoming,
  PhoneOutgoing,
  Check,
  Search,
  ChevronDown,
  Briefcase,
  AlertCircle,
  HelpCircle,
  PhoneForwarded,
  MessageSquare,
  CalendarCheck
} from 'lucide-react';

export default function ReportsPage() {
  const [canViewReports, setCanViewReports] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPerms = () => {
      setCanViewReports(hasAnyPermission(['reports.view_financials', 'reports.export']));
    };
    checkPerms();
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'agent_work' | 'overview' | 'sources' | 'properties' | 'telephony'>('agent_work');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'ytd'>('all');
  const [agentSearch, setAgentSearch] = useState('');

  const loadReportData = async (agent = selectedAgent, range = timeRange) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (agent && agent !== 'all') {
        queryParams.set('agent', agent);
      }
      if (range) {
        queryParams.set('time_range', range);
      }
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await fetchApi(`/reports/analytics${qs}`);
      if (res && res.success) {
        setData(res);
      }
    } catch (err: any) {
      console.error('Failed to load report analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData(selectedAgent, timeRange);
  }, [selectedAgent, timeRange]);

  // Real Database Metrics from API
  const metrics = data?.metrics || {
    total_contacts: 0,
    total_leads: 0,
    contacted_leads: 0,
    uncontacted_leads: 0,
    contacted_rate: 0,
    total_opportunities: 0,
    active_opportunities: 0,
    total_closed_won_aed: 0,
    total_pipeline_aed: 0,
    total_calls: 0,
    calls_logged: 0,
    connected_calls: 0,
    connected_rate: 0,
    total_talk_time_seconds: 0,
    talk_time_formatted: '0s',
    avg_talk_time_formatted: '0s',
    total_appointments: 0,
    sla_compliance_rate: 100,
    avg_deal_size_aed: 0,
    conversion_rate: 0,
  };

  const stageBreakdown = data?.stage_breakdown || data?.stageBreakdown || {};
  const leadSources = data?.lead_sources || data?.sources_breakdown || [];
  const agentLeaderboard = data?.agent_leaderboard || data?.leaderboard || [];
  const advisorsList = data?.advisors_list || [];
  const callOutcomes = data?.call_outcomes_breakdown || [];
  const recentActivities = data?.recent_activities || [];
  const selectedAgentProfile = data?.selected_agent_profile || null;
  const ownerStats = data?.owner_stats || { total_units: 0, available: 0, rented: 0, sold: 0 };
  const callStats = data?.call_stats || { total_recordings: 0, inbound_calls: 0, outbound_calls: 0, answered_rate: 0, avg_talk_time_formatted: '0s' };

  // Filter advisors for dropdown
  const filteredAdvisors = advisorsList.filter((a: any) =>
    a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
    (a.role && a.role.toLowerCase().includes(agentSearch.toLowerCase()))
  );

  const exportCurrentReport = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    const sanitizedAgent = selectedAgent === 'all' ? 'All_Agents' : selectedAgent.replace(/\s+/g, '_');
    let filename = `FS_Advisory_${activeTab}_${sanitizedAgent}_${timeRange}.csv`;

    if (activeTab === 'agent_work') {
      if (selectedAgent === 'all') {
        headers = [
          'Rank',
          'Agent Name',
          'Role',
          'Department',
          'Assigned Leads',
          'Contacted Leads',
          'Uncontacted Leads',
          'Calls Made',
          'Connected Calls',
          'Connect Rate %',
          'Talk Time',
          'Appointments',
          'Opportunities',
          'Closed Won Deals',
          'Closed Won AED',
          'Pipeline AED',
          'SLA Compliance %',
          'Conversion Rate %'
        ];
        rows = agentLeaderboard.map((a: any) => [
          a.rank,
          `"${a.name}"`,
          `"${a.role}"`,
          `"${a.department || 'Sales'}"`,
          a.assigned_leads,
          a.contacted_leads,
          a.uncontacted_leads,
          a.calls_made,
          a.connected_calls,
          `${a.connected_rate}%`,
          `"${a.talk_time_formatted}"`,
          a.appointments,
          a.opportunities_count,
          a.closed_won_count,
          a.closed_won_aed,
          a.pipeline_aed,
          `${a.sla_compliance}%`,
          `${a.conversion_rate}%`
        ]);
      } else {
        headers = ['Timestamp', 'Action Type', 'Outcome', 'Client Name', 'Phone', 'Duration', 'Notes / Remarks'];
        rows = recentActivities.map((act: any) => [
          `"${act.created_at || ''}"`,
          `"${act.type}"`,
          `"${act.call_outcome || 'N/A'}"`,
          `"${act.contact_name}"`,
          `"${act.contact_phone}"`,
          `"${act.duration_formatted || '0s'}"`,
          `"${(act.description || '').replace(/"/g, '""')}"`
        ]);
      }
    } else if (activeTab === 'sources') {
      headers = ['Marketing Channel', 'Leads Acquired', 'Opportunities', 'Won Deals', 'Share %', 'Conversion Rate %'];
      rows = leadSources.map((s: any) => [
        `"${s.source}"`,
        s.leads_count,
        s.opportunities,
        s.closed_won,
        `${s.percentage}%`,
        `${s.conversion_rate}%`,
      ]);
    } else {
      headers = ['Deal Stage', 'Count', 'Volume AED'];
      rows = Object.values(stageBreakdown).map((st: any) => [
        `"${st.label}"`,
        st.count,
        st.volume_aed,
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      icon: 'success',
      title: 'Report Exported',
      text: `${filename} successfully downloaded.`,
      timer: 1600,
      showConfirmButton: false,
    });
  };

  if (canViewReports === false) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex font-sans">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col min-w-0">
          <Navbar />
          <AccessDenied moduleName="Analytics & Reports" requiredPermission="reports.view_financials" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex font-sans">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Header Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <FileText className="w-4 h-4" />
                <span>Executive Business Intelligence & Audit</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428] flex items-center gap-2">
                <span>CRM Analytics & Agent Performance</span>
                {selectedAgent !== 'all' && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#081428] text-[#C8A147] font-semibold border border-[#C8A147]/30">
                    Agent: {selectedAgent}
                  </span>
                )}
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Audit exact live database performance per advisor: leads assigned, calls made, talk time, active opportunities, and deal closure.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Agent Selector Dropdown */}
              <div className="flex items-center bg-white border border-[#E8E4DC] rounded-lg px-2.5 py-1.5 shadow-2xs">
                <Users className="w-4 h-4 text-[#C8A147] mr-2 shrink-0" />
                <span className="text-xs font-bold text-slate-500 mr-2">Advisor:</span>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#081428] focus:outline-none cursor-pointer max-w-[190px]"
                >
                  <option value="all">🌟 All Advisors (Full Team)</option>
                  {advisorsList.map((adv: any) => (
                    <option key={adv.id} value={adv.name}>
                      {adv.name} ({adv.assigned_leads} Leads)
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Range Filter */}
              <div className="flex items-center bg-white border border-[#E8E4DC] rounded-lg p-1 shadow-2xs text-xs font-semibold overflow-x-auto">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'quarter', label: 'This Quarter' },
                  { key: 'ytd', label: 'YTD' }
                ].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setTimeRange(r.key as any)}
                    className={`px-3 py-1 rounded transition-all cursor-pointer whitespace-nowrap ${
                      timeRange === r.key
                        ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-[#081428]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Export Button */}
              <button
                onClick={exportCurrentReport}
                className="px-3.5 py-2 bg-white border border-[#E8E4DC] hover:border-[#C8A147] text-[#081428] hover:text-[#C8A147] font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => loadReportData(selectedAgent, timeRange)}
                disabled={loading}
                className="p-2 bg-white border border-[#E8E4DC] hover:border-[#C8A147] text-slate-700 hover:text-[#081428] rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Refresh Analytics from Database"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C8A147]' : ''}`} />
              </button>
            </div>
          </div>

          {/* 4 Core Financial & Productivity KPIs (100% Real Database Values) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Leads & Outreach */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs hover:border-[#C8A147]/50 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Assigned Leads & Outreach</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-2xl text-[#081428]">
                  {metrics.total_leads.toLocaleString()} Leads
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold mt-1">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {metrics.contacted_leads} Contacted ({metrics.contacted_rate}%)
                  </span>
                  <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {metrics.uncontacted_leads} Remaining
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Telephony & Call Workload */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs hover:border-[#C8A147]/50 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Telephony & Call Output</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <PhoneCall className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-2xl text-[#081428]">
                  {metrics.total_calls.toLocaleString()} Calls
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold mt-1">
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {metrics.connected_calls} Connected ({metrics.connected_rate}%)
                  </span>
                  <span className="text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#C8A147]" />
                    <span>Talk: {metrics.talk_time_formatted}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Closed Deals & Revenue */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs hover:border-[#C8A147]/50 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Closed Revenue & Pipeline</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-[#C8A147]">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-2xl text-emerald-700">
                  AED {metrics.total_closed_won_aed.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-600 font-semibold mt-1 flex items-center justify-between">
                  <span>{metrics.closed_deals} Won Deals</span>
                  <span className="text-blue-600">Pipeline: AED {metrics.total_pipeline_aed.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Card 4: SLA Compliance & Conversion */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs hover:border-[#C8A147]/50 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">SLA Compliance & Meetings</span>
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-2xl text-[#081428] flex items-center gap-1.5">
                  <span>{metrics.sla_compliance_rate}%</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    On-Time
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 font-semibold mt-1 flex items-center justify-between">
                  <span>{metrics.total_appointments} Viewings Booked</span>
                  <span className="text-emerald-700">{metrics.conversion_rate}% Conv.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-[#E8E4DC] bg-white px-3 py-1.5 rounded-t-lg shadow-2xs text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('agent_work')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'agent_work'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Agent Performance & Work Audit</span>
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Deal Pipeline & Funnel</span>
            </button>

            <button
              onClick={() => setActiveTab('sources')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'sources'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Lead Sources & Channels</span>
            </button>

            <button
              onClick={() => setActiveTab('properties')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'properties'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Property Portfolio</span>
            </button>

            <button
              onClick={() => setActiveTab('telephony')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'telephony'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>3CX Telephony & Call Logs</span>
            </button>
          </div>

          {/* ================= TAB 1: AGENT WORK AUDIT & PERFORMANCE ================= */}
          {activeTab === 'agent_work' && (
            <div className="space-y-6 animate-fade-in">
              {/* Agent Mode: ALL AGENTS LEADERBOARD & COMPARISON TABLE */}
              {selectedAgent === 'all' ? (
                <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-[#E8E4DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#C8A147]" />
                        <span>Advisor Workload & Productivity Leaderboard</span>
                      </h3>
                      <p className="text-xs text-[#6E6E6E]">
                        Comparative audit of all advisors: leads handled, calling velocity, talk duration, pipeline created, and closed sales.
                      </p>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      Total Active Advisors: <span className="font-bold text-[#081428]">{agentLeaderboard.length}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F5] text-[#6E6E6E] font-semibold border-b border-[#E8E4DC]">
                          <th className="py-3 px-3 text-center">Rank</th>
                          <th className="py-3 px-4">Advisor Name</th>
                          <th className="py-3 px-3">Role</th>
                          <th className="py-3 px-3 text-center">Assigned Leads</th>
                          <th className="py-3 px-3 text-center">Contacted / Remaining</th>
                          <th className="py-3 px-3 text-center">Calls Made</th>
                          <th className="py-3 px-3 text-center">Connected %</th>
                          <th className="py-3 px-3 text-center">Total Talk Time</th>
                          <th className="py-3 px-3 text-center">Appts</th>
                          <th className="py-3 px-3 text-center">Deals Won</th>
                          <th className="py-3 px-4 text-right">Closed Won (AED)</th>
                          <th className="py-3 px-4 text-right">Pipeline (AED)</th>
                          <th className="py-3 px-3 text-center">SLA %</th>
                          <th className="py-3 px-3 text-center">Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E4DC]">
                        {agentLeaderboard.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="py-8 text-center text-slate-400">
                              No advisor activity records found in selected period.
                            </td>
                          </tr>
                        ) : (
                          agentLeaderboard.map((adv: any) => (
                            <tr key={adv.id} className="hover:bg-[#FAF8F5] transition-colors">
                              <td className="py-3 px-3 text-center font-bold text-[#081428]">
                                {adv.rank === 1 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                                    🥇
                                  </span>
                                ) : adv.rank === 2 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold">
                                    🥈
                                  </span>
                                ) : adv.rank === 3 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-700 font-bold">
                                    🥉
                                  </span>
                                ) : (
                                  `#${adv.rank}`
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-[#081428] flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-[#081428] text-[#C8A147] font-bold text-[10px] flex items-center justify-center">
                                    {adv.initials}
                                  </span>
                                  <span>{adv.name}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 pl-8">{adv.email}</div>
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-medium">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                                  {adv.role}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-[#081428]">
                                {adv.assigned_leads}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="inline-flex items-center gap-1 text-[11px] font-semibold">
                                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {adv.contacted_leads}
                                  </span>
                                  <span className="text-slate-400">/</span>
                                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    {adv.uncontacted_leads}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-800">
                                {adv.calls_made}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  adv.connected_rate >= 50
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  {adv.connected_rate}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-700 whitespace-nowrap">
                                {adv.talk_time_formatted}
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-[#081428]">
                                {adv.appointments}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                  {adv.closed_won_count}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                                AED {adv.closed_won_aed.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-blue-700 whitespace-nowrap">
                                AED {adv.pipeline_aed.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                                  adv.sla_compliance >= 90
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {adv.sla_compliance}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => setSelectedAgent(adv.name)}
                                  className="px-2.5 py-1 bg-[#081428] hover:bg-[#081428]/80 text-[#C8A147] rounded text-[11px] font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                                >
                                  Inspect Work
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* SPECIFIC AGENT WORK DOSSIER & CALL LOG AUDIT */
                <div className="space-y-6">
                  {/* Agent Header Dossier Card */}
                  <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-[#081428] text-[#C8A147] font-bold text-xl flex items-center justify-center shadow-sm border-2 border-[#C8A147]">
                        {selectedAgentProfile?.initials || selectedAgent.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-heading font-bold text-xl text-[#081428]">
                            {selectedAgent}
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                            {selectedAgentProfile?.tier || 'Active Advisor'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedAgentProfile?.role || 'Telesales Agent'} • {selectedAgentProfile?.department || 'Property Sales'} • {selectedAgentProfile?.email || 'advisor@fsadvisory.ae'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedAgent('all')}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        ← Back to All Advisors
                      </button>
                    </div>
                  </div>

                  {/* Outreach & Remaining Work Progress Bar */}
                  <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <h4 className="font-heading font-bold text-sm text-[#081428]">
                          Lead Queue Coverage & Remaining Work
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Work breakdown of assigned contacts contacted vs uncontacted in queue.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-base text-[#081428]">{metrics.contacted_rate}%</span>
                        <span className="text-[11px] text-slate-500 ml-1">Contacted</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-3 bg-amber-100 rounded-full overflow-hidden flex shadow-inner">
                      <div
                        className="bg-emerald-600 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, metrics.contacted_rate)}%` }}
                        title={`Contacted: ${metrics.contacted_leads}`}
                      />
                      <div
                        className="bg-amber-400 h-full transition-all duration-500"
                        style={{ width: `${Math.max(0, 100 - metrics.contacted_rate)}%` }}
                        title={`Remaining: ${metrics.uncontacted_leads}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                        <span className="font-semibold text-emerald-800">
                          Contacted: {metrics.contacted_leads} leads
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                        <span className="font-semibold text-amber-800">
                          Remaining to Call: {metrics.uncontacted_leads} leads
                        </span>
                      </div>
                      <div className="text-slate-500 font-semibold">
                        Total Pool: {metrics.total_leads}
                      </div>
                    </div>
                  </div>

                  {/* Call Outcomes Distribution for this Agent */}
                  <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                      <div>
                        <h4 className="font-heading font-bold text-sm text-[#081428] flex items-center gap-2">
                          <PhoneCall className="w-4 h-4 text-[#C8A147]" />
                          <span>Call Outcomes & Telephonic Results for {selectedAgent}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Distribution of telephonic conversation results logged in CRM.
                        </p>
                      </div>
                      <div className="text-xs font-bold text-[#081428]">
                        Total Calls: {metrics.total_calls} • Talk Time: {metrics.talk_time_formatted}
                      </div>
                    </div>

                    {callOutcomes.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">
                        No call activity logged for this advisor yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {callOutcomes.map((item: any, idx: number) => {
                          const isPositive = ['Interested', 'Interested - Schedule Viewing', 'Callback', 'Follow-up', 'Meeting Scheduled'].includes(item.outcome);
                          const isNeutral = ['No Answer', 'No Answer / Left Voicemail', 'Busy'].includes(item.outcome);
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border text-center transition-all ${
                                isPositive
                                  ? 'bg-emerald-50/50 border-emerald-200'
                                  : isNeutral
                                  ? 'bg-slate-50 border-slate-200'
                                  : 'bg-amber-50/50 border-amber-200'
                              }`}
                            >
                              <div className="text-[11px] font-semibold text-slate-600 truncate" title={item.outcome}>
                                {item.outcome}
                              </div>
                              <div className="font-heading font-bold text-xl text-[#081428] mt-1">
                                {item.count}
                              </div>
                              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                {item.percentage}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Live Activity & Work Audit Trail */}
                  <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-2xs overflow-hidden">
                    <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-between">
                      <div>
                        <h4 className="font-heading font-bold text-sm text-[#081428] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Live Work Audit Trail: Recent Actions by {selectedAgent}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Chronological audit log of actual calls, remarks, WhatsApp messages, and status updates submitted.
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {recentActivities.length} Recent Actions
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#FAF8F5] text-[#6E6E6E] font-semibold border-b border-[#E8E4DC]">
                            <th className="py-2.5 px-4">Date & Time</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Outcome</th>
                            <th className="py-2.5 px-4">Client Name & Phone</th>
                            <th className="py-2.5 px-3 text-center">Duration</th>
                            <th className="py-2.5 px-5">Agent Remarks / Call Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8E4DC]">
                          {recentActivities.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">
                                No recent activity logged by this advisor in the database.
                              </td>
                            </tr>
                          ) : (
                            recentActivities.map((act: any) => (
                              <tr key={act.id} className="hover:bg-[#FAF8F5] transition-colors">
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <div className="font-bold text-[#081428]">{act.created_at}</div>
                                  <div className="text-[10px] text-slate-400">{act.time_ago}</div>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] border ${
                                    act.type === 'call'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : act.type === 'whatsapp'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}>
                                    {act.type === 'call' ? <PhoneCall className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                                    <span className="capitalize">{act.type}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  {act.call_outcome ? (
                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                                      ['Interested', 'Interested - Schedule Viewing', 'Callback', 'Follow-up'].includes(act.call_outcome)
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : ['No Answer', 'Busy'].includes(act.call_outcome)
                                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                      {act.call_outcome}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-[#081428]">{act.contact_name}</div>
                                  <div className="text-[11px] text-slate-500 font-mono">{act.contact_phone}</div>
                                </td>
                                <td className="py-3 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                                  {act.duration_formatted}
                                </td>
                                <td className="py-3 px-5 text-slate-700 max-w-md">
                                  <div className="text-xs leading-relaxed font-normal">
                                    {act.description || '—'}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: DEAL PIPELINE & FUNNEL ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#081428]">
                      Stage-by-Stage Deal Pipeline Velocity
                    </h3>
                    <p className="text-xs text-[#6E6E6E]">
                      Live opportunity valuation and stage conversion distribution {selectedAgent !== 'all' ? `for ${selectedAgent}` : 'across the sales desk'}.
                    </p>
                  </div>
                  <div className="text-xs font-bold text-[#081428]">
                    Total Pipeline: AED {metrics.total_pipeline_aed.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  {Object.entries(stageBreakdown).map(([key, st]: [string, any]) => (
                    <div
                      key={key}
                      className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-2 hover:border-[#C8A147] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#081428]">{st.label}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                      </div>
                      <div className="font-heading font-bold text-xl text-[#081428]">
                        AED {st.volume_aed.toLocaleString()}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6E6E6E] pt-1 border-t border-[#E8E4DC]">
                        <span>{st.count} Active Deals</span>
                        <span className="font-semibold text-[#081428]">
                          {metrics.total_pipeline_aed > 0
                            ? `${Math.round((st.volume_aed / metrics.total_pipeline_aed) * 100)}%`
                            : '0%'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: LEAD SOURCES & MARKETING ROI ================= */}
          {activeTab === 'sources' && (
            <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-2xs overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#081428]">
                    Marketing Channel Attribution & Conversion Analysis
                  </h3>
                  <p className="text-[11px] text-[#6E6E6E]">
                    Audited lead volume, conversion rate, and won deals by acquisition source from real database records.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-[#6E6E6E] font-semibold border-b border-[#E8E4DC]">
                      <th className="py-3 px-4">Marketing Channel</th>
                      <th className="py-3 px-4 text-center">Leads Acquired</th>
                      <th className="py-3 px-4 text-center">Opportunities</th>
                      <th className="py-3 px-4 text-center">Won Deals</th>
                      <th className="py-3 px-4 text-center">Share %</th>
                      <th className="py-3 px-4 text-center">Conversion %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {leadSources.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No lead source records available in database.
                        </td>
                      </tr>
                    ) : (
                      leadSources.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#081428]">{item.source}</td>
                          <td className="py-3 px-4 text-center font-semibold text-[#081428]">
                            {item.leads_count.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-700">{item.opportunities}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              {item.closed_won} Won
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-slate-600">
                            {item.percentage}%
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-[#081428]">
                            {item.conversion_rate}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 4: PROPERTY PORTFOLIO & UNITS ================= */}
          {activeTab === 'properties' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-slate-500 font-semibold">Total Listed Units</span>
                  <div className="font-heading font-bold text-2xl text-[#081428] mt-1">
                    {ownerStats.total_units} Units
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-emerald-700 font-semibold">🟢 Available Units</span>
                  <div className="font-heading font-bold text-2xl text-emerald-700 mt-1">
                    {ownerStats.available} Available
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-blue-700 font-semibold">🔵 Rented Units</span>
                  <div className="font-heading font-bold text-2xl text-blue-700 mt-1">
                    {ownerStats.rented} Rented
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-slate-700 font-semibold">🔴 Sold Units</span>
                  <div className="font-heading font-bold text-2xl text-slate-800 mt-1">
                    {ownerStats.sold} Sold
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: 3CX TELEPHONY & CALL LOGS ================= */}
          {activeTab === 'telephony' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-slate-500 font-semibold">Total Telephonic Calls</span>
                  <div className="font-heading font-bold text-2xl text-[#081428] mt-1">
                    {metrics.total_calls} Calls
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-emerald-700 font-semibold">Connected / Answered Rate</span>
                  <div className="font-heading font-bold text-2xl text-emerald-700 mt-1">
                    {metrics.connected_rate}%
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-blue-700 font-semibold">Total Talk Time</span>
                  <div className="font-heading font-bold text-2xl text-blue-700 mt-1">
                    {metrics.talk_time_formatted}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-amber-700 font-semibold">SLA First-Response</span>
                  <div className="font-heading font-bold text-2xl text-[#C8A147] mt-1">
                    {metrics.sla_compliance_rate}%
                  </div>
                </div>
              </div>

              {/* Call Outcomes Breakdown in Telephony tab */}
              <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs space-y-4">
                <h4 className="font-heading font-bold text-sm text-[#081428]">
                  Outreach Outcome Distribution
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                  {callOutcomes.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-center">
                      <div className="text-[11px] font-semibold text-slate-600 truncate">{item.outcome}</div>
                      <div className="font-heading font-bold text-xl text-[#081428] mt-1">{item.count}</div>
                      <div className="text-[10px] text-slate-500 font-bold mt-0.5">{item.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
