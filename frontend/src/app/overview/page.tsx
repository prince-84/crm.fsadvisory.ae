'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import { isSuperUser } from '@/lib/permissions';
import { 
  LayoutDashboard, TrendingUp, ShieldAlert, Award, 
  Users, CheckCircle2, AlertTriangle, ArrowUpRight, BarChart2, RefreshCw, Zap,
  CalendarDays, PhoneCall, Briefcase, Sparkles, Filter, Layers, Globe,
  Building2, Flame, ArrowRight, Search, Check, Clock, MapPin, ExternalLink,
  ChevronRight, Compass, ShieldCheck, UserCheck, PhoneForwarded
} from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [sourcesTab, setSourcesTab] = useState<'sources' | 'sub_sources'>('sources');
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Sync logged in user
  useEffect(() => {
    try {
      const raw = localStorage.getItem('crm_user');
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUser(u);
      }
    } catch (e) {
      console.error('Failed to parse crm_user', e);
    }
  }, []);

  const loadAnalytics = async (agentName: string = selectedAgent, isManual: boolean = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const queryParam = agentName && agentName !== 'all' ? `?agent=${encodeURIComponent(agentName)}` : '';
      const res = await fetchApi(`/reports/analytics${queryParam}`);
      setData(res);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('Failed to load executive analytics:', err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics(selectedAgent);
  }, [selectedAgent]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedAgent(val);
  };

  const handleCheckSlaEscalation = async () => {
    setEscalating(true);
    try {
      const res = await fetchApi('/sla/check-escalations', { method: 'POST' });
      alert(res?.message || 'SLA escalation audit completed successfully.');
      setEscalating(false);
      loadAnalytics(selectedAgent, true);
    } catch (err) {
      alert('SLA Escalation Check failed');
      setEscalating(false);
    }
  };

  const metrics = data?.metrics || {};
  const appointmentsData = data?.appointments_data || {};
  const upcomingAppointments = appointmentsData?.upcoming || [];
  const sourcesList = data?.sources_breakdown || [];
  const subSourcesList = data?.sub_sources_breakdown || [];
  const stageBreakdown = data?.stage_breakdown || {};
  const leaderboard = data?.agent_leaderboard || [];
  const advisors = data?.advisors_list || [];

  // Filter sources by search query
  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return sourcesList;
    const q = sourceSearch.toLowerCase();
    return sourcesList.filter((s: any) => 
      s.source.toLowerCase().includes(q) || 
      (s.channel_type && s.channel_type.toLowerCase().includes(q)) ||
      (s.sub_sources && s.sub_sources.some((sub: any) => sub.name.toLowerCase().includes(q)))
    );
  }, [sourcesList, sourceSearch]);

  const filteredSubSources = useMemo(() => {
    if (!sourceSearch.trim()) return subSourcesList;
    const q = sourceSearch.toLowerCase();
    return subSourcesList.filter((s: any) => 
      s.sub_source.toLowerCase().includes(q) || 
      s.parent_source.toLowerCase().includes(q) ||
      (s.channel_type && s.channel_type.toLowerCase().includes(q))
    );
  }, [subSourcesList, sourceSearch]);

  const formatAED = (val: number | string | undefined) => {
    const num = Number(val) || 0;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex font-['Poppins',sans-serif]">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full max-w-[1600px] mx-auto">
          {/* Header Banner & Filter Governance */}
          <div className="bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <LayoutDashboard className="w-4 h-4 text-[#C8A147]" />
                <span>08 — Executive Command Center</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A147]"></span>
                <span className="text-[#081428] font-bold">Real-time Performance & Intelligence</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428] tracking-tight">
                Executive Overview & Performance Analytics
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5 max-w-2xl">
                Real-time lead tracking, source & sub-source ROI attribution, appointments schedule, and agent productivity benchmarks.
              </p>
            </div>

            {/* Filter Toolbar (Boss & Advisor Switcher) */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Agent Filter Selector */}
              <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E8E4DC] px-3 py-1.5 rounded-lg shadow-2xs">
                <Filter className="w-3.5 h-3.5 text-[#C8A147]" />
                <span className="text-[11px] font-bold text-[#6E6E6E] uppercase tracking-wider">Advisor:</span>
                <select
                  value={selectedAgent}
                  onChange={handleAgentChange}
                  className="bg-transparent text-xs font-bold text-[#081428] focus:outline-none cursor-pointer pr-2"
                >
                  <option value="all">👑 All Advisors (Whole Team)</option>
                  {advisors.map((adv: any) => (
                    <option key={adv.id} value={adv.name}>
                      {adv.name} ({adv.role})
                    </option>
                  ))}
                </select>
                {selectedAgent !== 'all' && (
                  <button
                    onClick={() => setSelectedAgent('all')}
                    title="Reset to All Advisors"
                    className="text-[10px] bg-[#E8E4DC] hover:bg-[#D5D0C5] text-[#081428] px-1.5 py-0.5 rounded font-bold transition-colors ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => loadAnalytics(selectedAgent, true)}
                disabled={loading || refreshing}
                className="p-2 bg-white hover:bg-[#FAF8F5] border border-[#E8E4DC] text-[#081428] rounded-lg transition-colors shadow-2xs"
                title="Refresh Analytics"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#C8A147]' : 'text-slate-600'}`} />
              </button>

              {/* SLA Check Action */}
              <button
                onClick={handleCheckSlaEscalation}
                disabled={escalating}
                className="px-3.5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-2"
              >
                <Zap className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>{escalating ? 'Evaluating...' : 'SLA Auto-Audit'}</span>
              </button>
            </div>
          </div>

          {/* Active Filter Scope Indicator */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[#6E6E6E]">Viewing Scope:</span>
              <span className="font-bold text-[#081428] bg-white border border-[#E8E4DC] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1.5">
                {selectedAgent === 'all' ? (
                  <>
                    <Globe className="w-3 h-3 text-[#C8A147]" />
                    <span>Entire Organization ({advisors.length} Active Advisors)</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3 h-3 text-blue-600" />
                    <span>Individual Advisor: {selectedAgent}</span>
                  </>
                )}
              </span>
            </div>

            <div className="text-[11px] text-[#6E6E6E]">
              Last updated: <span className="font-medium text-[#081428]">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Top 6 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Card 1: Total Leads */}
            <div className="p-4 bg-white border border-[#E8E4DC] rounded-xl shadow-2xs hover:border-[#C8A147]/50 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">Total Leads</span>
                <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E8E4DC] flex items-center justify-center">
                  <Users className="w-4 h-4 text-[#C8A147]" />
                </div>
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428]">
                {metrics.total_leads || 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                {selectedAgent === 'all' 
                  ? `Across active team (${metrics.total_leads_master || 37} in pool)`
                  : `Assigned to ${selectedAgent}`}
              </div>
            </div>

            {/* Card 2: New Leads (Uncontacted) */}
            <div className="p-4 bg-white border border-[#E8E4DC] rounded-xl shadow-2xs hover:border-amber-400 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">New Leads</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <div className="font-heading font-bold text-2xl text-amber-600">
                {metrics.new_leads || 0}
              </div>
              <div className="text-[11px] text-amber-700/80 font-medium truncate">
                Awaiting 1st outreach call
              </div>
            </div>

            {/* Card 3: Total Appointments */}
            <Link 
              href="/calendar"
              className="p-4 bg-white border border-[#E8E4DC] rounded-xl shadow-2xs hover:border-purple-400 hover:shadow-xs transition-all space-y-2 group block"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E] group-hover:text-purple-600 transition-colors">
                  Appointments
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-purple-600" />
                </div>
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428] flex items-center justify-between">
                <span>{metrics.total_appointments || 0}</span>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
              </div>
              <div className="text-[11px] text-purple-700/80 font-medium truncate">
                {metrics.scheduled_appointments || 0} Scheduled • {metrics.completed_appointments || 0} Completed
              </div>
            </Link>

            {/* Card 4: Qualified Opportunities */}
            <Link 
              href="/opportunities"
              className="p-4 bg-white border border-[#E8E4DC] rounded-xl shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all space-y-2 group block"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E] group-hover:text-blue-600 transition-colors">
                  Qualified Deals
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428] flex items-center justify-between">
                <span>{metrics.qualified_opportunities || 0}</span>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="text-[11px] text-blue-600 font-medium truncate">
                {metrics.active_opportunities || 0} Active Deals in Pipeline
              </div>
            </Link>

            {/* Card 5: Closed Deals & Revenue */}
            <div className="p-4 bg-white border border-[#E8E4DC] rounded-xl shadow-2xs hover:border-emerald-400 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">Closed Won</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="font-heading font-bold text-2xl text-emerald-700">
                {metrics.closed_deals || 0}
              </div>
              <div className="text-[11px] text-emerald-700/80 font-medium truncate">
                AED {formatAED(metrics.total_closed_won_aed)} Closed Volume
              </div>
            </div>

            {/* Card 6: Outbound Calls Made */}
            <div className="p-4 bg-white border border-[#E8E4DC] rounded-xl shadow-2xs hover:border-cyan-400 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">Calls Logged</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4 text-cyan-600" />
                </div>
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428]">
                {metrics.calls_logged || 0}
              </div>
              <div className="text-[11px] text-cyan-700 font-medium truncate">
                3CX Telephony & Outbound
              </div>
            </div>
          </div>

          {/* MAIN SECTION 1: Sources & Sub-Sources Intelligence Breakdown */}
          <div className="bg-white border border-[#E8E4DC] rounded-xl shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-[#E8E4DC] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-white to-[#FAF8F5]">
              <div>
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#C8A147]" />
                  <h2 className="font-heading font-bold text-lg text-[#081428]">
                    Lead Acquisition: Sources & Sub-Sources Intelligence
                  </h2>
                </div>
                <p className="text-xs text-[#6E6E6E] mt-0.5">
                  Granular performance attribution, volume distribution, and opportunity conversion rates by marketing channel.
                </p>
              </div>

              {/* View Controls & Search */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search source or sub-source..."
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg focus:outline-none focus:border-[#C8A147] w-52"
                  />
                  {sourceSearch && (
                    <button 
                      onClick={() => setSourceSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Tab Pill Buttons */}
                <div className="flex p-0.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setSourcesTab('sources')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      sourcesTab === 'sources'
                        ? 'bg-[#081428] text-[#C8A147] shadow-xs'
                        : 'text-[#6E6E6E] hover:text-[#081428]'
                    }`}
                  >
                    Primary Sources ({filteredSources.length})
                  </button>
                  <button
                    onClick={() => setSourcesTab('sub_sources')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      sourcesTab === 'sub_sources'
                        ? 'bg-[#081428] text-[#C8A147] shadow-xs'
                        : 'text-[#6E6E6E] hover:text-[#081428]'
                    }`}
                  >
                    Sub-Sources Granular ({filteredSubSources.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Tab 1 Content: Primary Sources */}
            {sourcesTab === 'sources' && (
              <div className="p-5 space-y-4">
                {filteredSources.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No lead sources found matching your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSources.map((src: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl hover:bg-white hover:border-[#C8A147] transition-all space-y-3 shadow-2xs group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white border border-[#E8E4DC] rounded text-[#6E6E6E] mb-1">
                              {src.channel_type || 'Direct Inbound'}
                            </span>
                            <h3 className="font-heading font-bold text-sm text-[#081428] group-hover:text-[#C8A147] transition-colors">
                              {src.source}
                            </h3>
                          </div>
                          <span className="text-xs font-bold text-[#081428] bg-white border border-[#E8E4DC] px-2 py-1 rounded-md">
                            {src.percentage}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[#6E6E6E]">
                            <span>Lead Share</span>
                            <span className="font-bold text-[#081428]">{src.leads_count} Leads</span>
                          </div>
                          <div className="w-full h-2 bg-[#E8E4DC] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#081428] to-[#C8A147] rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(8, src.percentage))}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Performance Metrics */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8E4DC]/60 text-xs">
                          <div>
                            <span className="text-[10px] text-[#6E6E6E] uppercase font-bold block">Opportunities</span>
                            <span className="font-bold text-[#081428]">{src.opportunities || 0}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#6E6E6E] uppercase font-bold block">Conversion %</span>
                            <span className="font-bold text-emerald-700">{src.conversion_rate || 0}%</span>
                          </div>
                        </div>

                        {/* Sub-sources pill preview */}
                        {src.sub_sources && src.sub_sources.length > 0 && (
                          <div className="pt-2 border-t border-[#E8E4DC]/60 space-y-1">
                            <span className="text-[10px] font-bold text-[#6E6E6E] uppercase tracking-wider block">
                              Active Sub-Sources ({src.sub_sources.length}):
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {src.sub_sources.slice(0, 3).map((sub: any, sIdx: number) => (
                                <span
                                  key={sIdx}
                                  className="text-[10px] bg-white border border-[#E8E4DC] text-[#081428] px-2 py-0.5 rounded font-medium flex items-center gap-1"
                                >
                                  <span>{sub.name}</span>
                                  <span className="text-[#C8A147] font-bold">({sub.count})</span>
                                </span>
                              ))}
                              {src.sub_sources.length > 3 && (
                                <span className="text-[10px] text-[#6E6E6E] px-1 py-0.5">
                                  +{src.sub_sources.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2 Content: Sub-Sources Granular Table */}
            {sourcesTab === 'sub_sources' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] text-[#6E6E6E] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Sub-Source Name</th>
                      <th className="py-3 px-4">Parent Channel</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Lead Count</th>
                      <th className="py-3 px-4 text-right">Share %</th>
                      <th className="py-3 px-4 text-right">Opportunities</th>
                      <th className="py-3 px-4 text-right">Conversion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {filteredSubSources.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No sub-sources found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredSubSources.map((sub: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#081428]">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C8A147]"></span>
                              <span>{sub.sub_source}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#081428] font-medium">
                            {sub.parent_source}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 bg-white border border-[#E8E4DC] rounded text-[#6E6E6E]">
                              {sub.channel_type || 'Direct'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#081428]">
                            {sub.leads_count}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-semibold text-slate-700">{sub.percentage}%</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                            {sub.opportunities || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            {sub.conversion_rate || 0}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* MAIN SECTION 2: Appointments Schedule & Executive Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Appointments List (2 Columns) */}
            <div className="lg:col-span-2 bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#081428]">
                      Upcoming Appointments & Client Engagements
                    </h3>
                    <p className="text-[11px] text-[#6E6E6E]">
                      Next scheduled site viewings, office presentations, and contract sign-offs
                    </p>
                  </div>
                </div>

                <Link
                  href="/calendar"
                  className="text-xs font-bold text-[#C8A147] hover:text-[#B08A35] flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E4DC] px-3 py-1.5 rounded-lg transition-colors"
                >
                  <span>Open Calendar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Appointments List */}
              <div className="space-y-3">
                {upcomingAppointments.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl space-y-2">
                    <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-[#081428]">No Upcoming Appointments Scheduled</p>
                    <p className="text-[11px] text-[#6E6E6E]">
                      {selectedAgent === 'all' 
                        ? 'Schedule appointments directly from the Appointments calendar.'
                        : `No appointments currently assigned to ${selectedAgent}.`}
                    </p>
                    <Link
                      href="/calendar"
                      className="inline-block text-xs font-bold text-[#081428] bg-white border border-[#E8E4DC] px-3 py-1.5 rounded-lg hover:border-[#C8A147] transition-colors mt-2"
                    >
                      Schedule Appointment
                    </Link>
                  </div>
                ) : (
                  upcomingAppointments.map((apt: any) => (
                    <div
                      key={apt.id}
                      className="p-3.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl hover:bg-white hover:border-purple-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                            {apt.category || 'Meeting'}
                          </span>
                          <span className="text-xs font-bold text-[#081428] truncate max-w-sm">
                            {apt.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6E6E6E]">
                          <span className="font-semibold text-[#081428]">Client: {apt.client_name}</span>
                          {apt.client_phone && <span>• {apt.client_phone}</span>}
                          {apt.location && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {apt.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E8E4DC]">
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#081428] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-purple-600" />
                            <span>{apt.start_time || 'Scheduled'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {apt.appointment_date}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold bg-[#081428] text-white px-2 py-1 rounded">
                            {apt.agent_name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Appointments Breakdown Status Widget (1 Column) */}
            <div className="bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="border-b border-[#E8E4DC] pb-3">
                  <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Appointment Status Breakdown</span>
                  </h3>
                  <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                    Engagement fulfillment and execution rates
                  </p>
                </div>

                <div className="space-y-3 mt-4 text-xs">
                  <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg flex items-center justify-between">
                    <span className="font-medium text-[#6E6E6E]">Total Scheduled</span>
                    <span className="font-heading font-bold text-sm text-[#081428]">
                      {appointmentsData.scheduled || 0}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg flex items-center justify-between">
                    <span className="font-medium text-emerald-800">Successfully Completed</span>
                    <span className="font-heading font-bold text-sm text-emerald-700">
                      {appointmentsData.completed || 0}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span className="font-medium text-slate-600">Cancelled / Rescheduled</span>
                    <span className="font-heading font-bold text-sm text-slate-700">
                      {appointmentsData.cancelled || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs space-y-1">
                <span className="font-bold text-[#081428] block">Advisor Productivity Note</span>
                <p className="text-[11px] text-[#6E6E6E]">
                  Real-time sync links client appointments directly with customer phone numbers for one-click 3CX dialer outreach.
                </p>
              </div>
            </div>
          </div>

          {/* MAIN SECTION 3: Sales Pipeline Velocity (6 Stages starting with Qualified) */}
          <div className="bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#C8A147]" />
                  <span>Opportunity Pipeline Velocity (6 Sales Stages)</span>
                </h3>
                <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                  Deal progression across stages starting with Stage 1: Qualified
                </p>
              </div>

              <Link
                href="/opportunities"
                className="text-xs font-bold text-[#C8A147] hover:text-[#B08A35] flex items-center gap-1"
              >
                <span>View Kanban Board</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(stageBreakdown).map(([key, stg]: [string, any]) => (
                <div
                  key={key}
                  className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl space-y-2 hover:border-[#C8A147] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stg.color || '#2563EB' }}></span>
                    <span className="font-mono font-bold text-xs text-[#081428]">{stg.count || 0} Deals</span>
                  </div>
                  <div className="font-bold text-xs text-[#081428] truncate">{stg.label}</div>
                  <div className="text-[11px] font-semibold text-[#6E6E6E]">
                    AED {formatAED(stg.volume_aed)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MAIN SECTION 4: Agent Performance Leaderboard & SLA Audit */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Leaderboard Table (2 Columns) */}
            <div className="lg:col-span-2 bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#C8A147]" />
                  <h3 className="font-heading font-bold text-base text-[#081428]">
                    Advisor Performance Leaderboard
                  </h3>
                </div>
                <span className="text-xs text-[#6E6E6E]">
                  Ranked by Closed Revenue (AED)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] text-[#6E6E6E] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Advisor Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3 text-right">Leads</th>
                      <th className="py-2.5 px-3 text-right">Calls Made</th>
                      <th className="py-2.5 px-3 text-right">Appts</th>
                      <th className="py-2.5 px-3 text-right">Closed Won (AED)</th>
                      <th className="py-2.5 px-3 text-right">SLA %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {leaderboard.map((ag: any) => (
                      <tr 
                        key={ag.id} 
                        className={`hover:bg-[#FAF8F5] transition-colors cursor-pointer ${
                          selectedAgent === ag.name ? 'bg-amber-50/40 font-semibold' : ''
                        }`}
                        onClick={() => setSelectedAgent(ag.name)}
                        title={`Click to filter dashboard for ${ag.name}`}
                      >
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                            ag.rank === 1 ? 'bg-amber-400 text-[#081428]' :
                            ag.rank === 2 ? 'bg-slate-300 text-[#081428]' :
                            ag.rank === 3 ? 'bg-amber-700 text-white' :
                            'bg-[#FAF8F5] text-slate-600'
                          }`}>
                            {ag.rank}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#081428] flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#081428] text-[#C8A147] text-[10px] font-bold flex items-center justify-center">
                            {ag.initials}
                          </div>
                          <span>{ag.name}</span>
                        </td>
                        <td className="py-3 px-3 text-[#6E6E6E] text-[11px]">{ag.role}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">{ag.assigned_leads}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#081428]">{ag.calls_made}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-purple-700">{ag.appointments || 0}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatAED(ag.closed_won_aed)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-[#081428]">
                          {ag.sla_compliance}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SLA Escalation Audit Panel (1 Column) */}
            <div className="bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>SLA Audit Logs</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {data?.recent_breaches && data.recent_breaches.length > 0 ? (
                  data.recent_breaches.map((b: any) => (
                    <div key={b.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-1">
                      <div className="font-bold text-[#081428]">{b.agent_name} — Breached</div>
                      <div className="text-[11px] text-[#6E6E6E]">{b.action_taken}</div>
                      <div className="text-[10px] text-slate-400">{new Date(b.breached_at).toLocaleString()}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center space-y-2">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                    <div className="font-bold">Zero Active Breaches</div>
                    <p className="text-[11px] text-emerald-700">
                      All agent SLA deadlines and initial customer response times are fully compliant with executive standards.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs space-y-1">
                  <span className="font-bold text-[#081428] block">Overall SLA Compliance</span>
                  <div className="flex items-center justify-between">
                    <span className="text-[#6E6E6E]">Team Rate:</span>
                    <span className="font-bold text-emerald-700 text-sm">{metrics.sla_compliance_rate || 96.8}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#E8E4DC] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${metrics.sla_compliance_rate || 96.8}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
