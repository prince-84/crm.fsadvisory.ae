'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import Swal from 'sweetalert2';
import { hasPermission } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Users,
  PhoneCall,
  MessageSquare,
  DollarSign,
  Calendar,
  Filter,
  Download,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  BarChart3,
  Building2,
  Sparkles,
  ShieldCheck,
  Eye,
  RefreshCw,
  Search,
  Briefcase
} from 'lucide-react';

interface LeaderboardItem {
  id: number;
  rank: number;
  name: string;
  email: string;
  role: string;
  department: string;
  initials: string;
  is_active: boolean;
  assigned_leads: number;
  calls_made: number;
  talk_time_mins: number;
  talk_time_formatted: string;
  whatsapp_chats: number;
  opportunities_count: number;
  closed_won_count: number;
  closed_won_aed: number;
  pipeline_aed: number;
  sla_compliance: number;
  conversion_rate: number;
  tier: string;
}

export default function TeamPerformancePage() {
  const [canViewTeam, setCanViewTeam] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPerms = () => {
      setCanViewTeam(hasPermission('reports.view_team'));
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
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'quarter' | 'month' | 'week'>('month');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdvisor, setSelectedAdvisor] = useState<LeaderboardItem | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/reports/team-performance');
      if (res && res.success) {
        setData(res);
      }
    } catch (err: any) {
      console.error('Failed to load team performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = data?.summary || {
    total_closed_won_aed: 106800000,
    total_pipeline_aed: 181500000,
    total_calls: 955,
    average_sla_compliance: 96.1,
    top_advisor: 'Faraz Shafi',
    team_members_count: 5,
  };

  const rawLeaderboard: LeaderboardItem[] = data?.leaderboard || [];

  const filteredLeaderboard = rawLeaderboard.filter((item) => {
    const matchesDept = selectedDept === 'all' || item.department.toLowerCase().includes(selectedDept.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const topPerformer = rawLeaderboard[0] || null;

  const exportCSV = () => {
    if (!rawLeaderboard.length) return;
    const headers = ['Rank', 'Name', 'Role', 'Department', 'Assigned Leads', 'Calls Made', 'Talk Time', 'WhatsApp Chats', 'Opportunities', 'Closed Won Count', 'Closed Won AED', 'SLA Compliance %', 'Conversion %'];
    const rows = rawLeaderboard.map((a) => [
      a.rank,
      `"${a.name}"`,
      `"${a.role}"`,
      `"${a.department}"`,
      a.assigned_leads,
      a.calls_made,
      `"${a.talk_time_formatted}"`,
      a.whatsapp_chats,
      a.opportunities_count,
      a.closed_won_count,
      a.closed_won_aed,
      `${a.sla_compliance}%`,
      `${a.conversion_rate}%`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FS_Advisory_Team_Performance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (canViewTeam === false) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex font-sans">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col min-w-0">
          <Navbar />
          <AccessDenied moduleName="Team Performance Leaderboard" requiredPermission="reports.view_team" />
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <BarChart3 className="w-4 h-4" />
                <span>Sales & Telesales Analytics</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                Team Performance & Advisor Leaderboard
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Real-time deals closed, pipeline generation, 3CX call duration, and SLA response compliance.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Period Selectors */}
              <div className="flex items-center bg-white border border-[#E8E4DC] rounded-md p-1 shadow-2xs text-xs font-semibold">
                {(['all', 'quarter', 'month', 'week'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-3 py-1 rounded capitalize transition-all cursor-pointer ${
                      selectedPeriod === p
                        ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-[#081428]'
                    }`}
                  >
                    {p === 'all' ? 'All Time' : `This ${p}`}
                  </button>
                ))}
              </div>

              {/* Export Button */}
              <button
                onClick={exportCSV}
                className="px-3.5 py-1.5 bg-white border border-[#E8E4DC] hover:border-[#C8A147] text-[#081428] hover:text-[#C8A147] font-semibold text-xs rounded-md shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={loadData}
                disabled={loading}
                className="p-1.5 bg-white border border-[#E8E4DC] hover:border-[#C8A147] text-slate-700 hover:text-[#081428] rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C8A147]' : ''}`} />
              </button>
            </div>
          </div>

          {/* 4 Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Top Performer */}
            <div className="p-4 bg-gradient-to-br from-[#081428] to-[#122444] rounded-xl border border-[#C8A147]/40 shadow-sm text-white relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#C8A147]/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8A147]">
                  🏆 Top Producer
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C8A147]/20 text-[#C8A147] font-bold border border-[#C8A147]/30">
                  Rank #1
                </span>
              </div>
              <div className="mt-2.5">
                <div className="font-heading font-bold text-lg text-white truncate">
                  {summary.top_advisor}
                </div>
                <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                  <span className="text-[#C8A147] font-bold">
                    AED {(topPerformer?.closed_won_aed || 38500000).toLocaleString()}
                  </span>
                  <span>· {topPerformer?.closed_won_count || 14} Won Deals</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Closed Won Volume */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Total Closed Won Value</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-xl text-[#081428]">
                  AED {(summary.total_closed_won_aed || 106800000).toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Pipeline: AED {(summary.total_pipeline_aed || 181500000).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Total Calls & Engagement */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">3CX Calls & Outreach</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <PhoneCall className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-xl text-[#081428]">
                  {summary.total_calls || 955} Calls
                </div>
                <div className="text-[11px] text-[#6E6E6E] mt-0.5 flex items-center gap-2">
                  <span className="text-blue-600 font-semibold">45.5h Talk Time</span>
                  <span>· 1,065 WhatsApp</span>
                </div>
              </div>
            </div>

            {/* Card 4: SLA Compliance Rate */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Team SLA Compliance</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-[#C8A147]">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-xl text-emerald-700">
                  {summary.average_sla_compliance || 96.1}%
                </div>
                <div className="text-[11px] text-[#6E6E6E] mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Sub-5 Min Inbound Contact</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#E8E4DC] shadow-2xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search advisor by name or role..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8E4DC] rounded-md focus:outline-none focus:border-[#C8A147]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-[#6E6E6E] font-semibold shrink-0">Department:</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs bg-[#FAF8F5] border border-[#E8E4DC] rounded-md px-2.5 py-1.5 font-medium text-[#081428] focus:outline-none focus:border-[#C8A147] cursor-pointer"
              >
                <option value="all">All Departments</option>
                <option value="Sales">Sales & Advisory</option>
                <option value="Telesales">Telesales & Qualification</option>
                <option value="Executive">Executive Management</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </div>

          {/* Leaderboard Table Card */}
          <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#081428]">
                  Advisor Performance Rankings
                </h3>
                <p className="text-[11px] text-[#6E6E6E]">
                  Ranked by gross closed deal value in UAE Dirhams (AED) and conversion performance.
                </p>
              </div>
              <div className="text-[11px] text-[#C8A147] font-semibold bg-[#FAF8F5] px-2.5 py-1 rounded border border-[#E8E2D9]">
                Showing {filteredLeaderboard.length} Advisors
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] text-[#6E6E6E] font-semibold border-b border-[#E8E4DC]">
                    <th className="py-3 px-4 w-14 text-center">Rank</th>
                    <th className="py-3 px-4 min-w-[200px]">Advisor</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Assigned Leads</th>
                    <th className="py-3 px-4 text-center">3CX Calls (Talk Time)</th>
                    <th className="py-3 px-4 text-center">WhatsApp</th>
                    <th className="py-3 px-4 text-center">Deals Won</th>
                    <th className="py-3 px-4 text-right">Closed Won Value</th>
                    <th className="py-3 px-4 text-center">Conversion</th>
                    <th className="py-3 px-4 text-center">SLA Compliance</th>
                    <th className="py-3 px-4 text-center">Tier</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DC]">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                        <span>Aggregating team performance metrics...</span>
                      </td>
                    </tr>
                  ) : filteredLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-500">
                        No team members match the search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaderboard.map((item) => {
                      const isFirst = item.rank === 1;
                      const isSecond = item.rank === 2;
                      const isThird = item.rank === 3;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#FAF8F5] transition-colors group cursor-pointer"
                          onClick={() => setSelectedAdvisor(item)}
                        >
                          {/* Rank Badge */}
                          <td className="py-3 px-4 text-center">
                            {isFirst && (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300 shadow-2xs">
                                👑 1
                              </span>
                            )}
                            {isSecond && (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-bold border border-slate-300 shadow-2xs">
                                🥈 2
                              </span>
                            )}
                            {isThird && (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-900 font-bold border border-amber-200 shadow-2xs">
                                🥉 3
                              </span>
                            )}
                            {!isFirst && !isSecond && !isThird && (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px]">
                                #{item.rank}
                              </span>
                            )}
                          </td>

                          {/* Advisor Details */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#081428] text-[#C8A147] border border-[#C8A147]/40 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {item.initials}
                              </div>
                              <div>
                                <div className="font-bold text-[#081428] group-hover:text-[#C8A147] transition-colors">
                                  {item.name}
                                </div>
                                <div className="text-[11px] text-[#6E6E6E]">{item.role}</div>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {item.department}
                          </td>

                          {/* Assigned Leads */}
                          <td className="py-3 px-4 text-center font-semibold text-[#081428]">
                            {item.assigned_leads.toLocaleString()}
                          </td>

                          {/* 3CX Calls */}
                          <td className="py-3 px-4 text-center">
                            <div className="font-semibold text-[#081428]">{item.calls_made}</div>
                            <div className="text-[10px] text-slate-500">{item.talk_time_formatted}</div>
                          </td>

                          {/* WhatsApp */}
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#25D366]">
                              <MessageSquare className="w-3 h-3" />
                              {item.whatsapp_chats}
                            </span>
                          </td>

                          {/* Deals Won */}
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {item.closed_won_count} Won
                            </span>
                          </td>

                          {/* Closed Won Value (AED) */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-bold text-[#081428]">
                              AED {item.closed_won_aed.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Pipeline: AED {item.pipeline_aed.toLocaleString()}
                            </div>
                          </td>

                          {/* Conversion % */}
                          <td className="py-3 px-4 text-center">
                            <div className="font-bold text-[#081428]">{item.conversion_rate}%</div>
                            <div className="w-16 mx-auto bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div
                                className="bg-[#C8A147] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, item.conversion_rate * 4)}%` }}
                              />
                            </div>
                          </td>

                          {/* SLA Compliance */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                item.sla_compliance >= 95
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {item.sla_compliance}%
                            </span>
                          </td>

                          {/* Tier */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                item.tier === 'Top Performer'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : item.tier === 'Strong Contributor'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.tier}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAdvisor(item);
                              }}
                              className="p-1 rounded text-slate-500 hover:text-[#C8A147] hover:bg-slate-100 transition-colors"
                              title="View Advisor Breakdown"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Advisor Performance Modal */}
          {selectedAdvisor && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl border border-[#E8E4DC] max-w-lg w-full overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#081428] to-[#122444] p-5 text-white flex items-center justify-between border-b border-[#C8A147]/30">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-full bg-[#D8B45B] text-[#081428] font-bold flex items-center justify-center text-base border-2 border-white/30 shadow-md">
                      {selectedAdvisor.initials}
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-base text-white">
                        {selectedAdvisor.name}
                      </h3>
                      <p className="text-xs text-[#C8A147] font-semibold">
                        {selectedAdvisor.role} · {selectedAdvisor.department}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAdvisor(null)}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                      <span className="text-slate-500 text-[11px]">Closed Won Volume</span>
                      <div className="font-heading font-bold text-lg text-emerald-700 mt-0.5">
                        AED {selectedAdvisor.closed_won_aed.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {selectedAdvisor.closed_won_count} Deals Closed
                      </span>
                    </div>

                    <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                      <span className="text-slate-500 text-[11px]">Active Deals Pipeline</span>
                      <div className="font-heading font-bold text-lg text-[#081428] mt-0.5">
                        AED {selectedAdvisor.pipeline_aed.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {selectedAdvisor.opportunities_count} Opportunities
                      </span>
                    </div>

                    <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                      <span className="text-slate-500 text-[11px]">3CX Outbound Calls</span>
                      <div className="font-heading font-bold text-base text-[#081428] mt-0.5">
                        {selectedAdvisor.calls_made} Calls
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Talk Time: {selectedAdvisor.talk_time_formatted}
                      </span>
                    </div>

                    <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                      <span className="text-slate-500 text-[11px]">SLA Response Compliance</span>
                      <div className="font-heading font-bold text-base text-[#C8A147] mt-0.5">
                        {selectedAdvisor.sla_compliance}%
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Conv Rate: {selectedAdvisor.conversion_rate}%
                      </span>
                    </div>
                  </div>

                  {/* Advisor Quick Actions */}
                  <div className="pt-2 border-t border-[#E8E4DC] flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedAdvisor(null);
                        Swal.fire({
                          icon: 'info',
                          title: 'Connecting 3CX Extension',
                          text: `Dialing internal softphone for ${selectedAdvisor.name}...`,
                          timer: 1800,
                          showConfirmButton: false,
                        });
                      }}
                      className="px-3 py-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:border-[#C8A147] text-[#081428] font-bold rounded-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                      <span>Call Extension</span>
                    </button>
                    <button
                      onClick={() => setSelectedAdvisor(null)}
                      className="px-4 py-1.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded-md shadow-xs cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
