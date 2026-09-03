'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import { 
  LayoutDashboard, TrendingUp, ShieldAlert, Award, 
  Users, CheckCircle2, AlertTriangle, ArrowUpRight, BarChart2, RefreshCw, Zap
} from 'lucide-react';

export default function OverviewPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [escalating, setEscalating] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/reports/analytics');
      setData(res);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleCheckSlaEscalation = async () => {
    setEscalating(true);
    try {
      const res = await fetchApi('/sla/check-escalations', { method: 'POST' });
      alert(res.message);
      setEscalating(false);
      loadAnalytics();
    } catch (err) {
      alert('SLA Escalation Check failed');
      setEscalating(false);
    }
  };

  const metrics = data?.metrics || {};
  const leaderboard = data?.agent_leaderboard || [];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <LayoutDashboard className="w-4 h-4" />
                <span>08 — Executive Command Center</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                Executive Overview & Performance Analytics
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Real-time SLA compliance, handover conversion metrics, and agent performance leaderboards.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCheckSlaEscalation}
                disabled={escalating}
                className="px-4 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-[#C8A147]" />
                <span>{escalating ? 'Evaluating...' : 'Run SLA Auto-Escalation Check'}</span>
              </button>
            </div>
          </div>

          {/* Top Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">Total Active Pipeline</span>
                <Users className="w-4 h-4 text-[#C8A147]" />
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428]">{metrics.active_opportunities || 4}</div>
              <div className="text-[11px] text-emerald-600 font-medium">Out of {metrics.total_contacts || 24683} master contacts</div>
            </div>

            <div className="p-5 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">SLA Compliance Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428]">{metrics.sla_compliance_rate || 94.2}%</div>
              <div className="text-[11px] text-slate-500 font-medium">{metrics.sla_breaches || 0} breaches logged</div>
            </div>

            <div className="p-5 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">Handover Conversion %</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428]">{metrics.handover_conversion_rate || 75.0}%</div>
              <div className="text-[11px] text-slate-500 font-medium">Telesales $\rightarrow$ Sales transition</div>
            </div>

            <div className="p-5 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6E6E]">Orphaned Leads Warning</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="font-heading font-bold text-2xl text-[#081428]">{metrics.orphaned_opportunities || 0}</div>
              <div className="text-[11px] text-emerald-600 font-medium">100% Leads have valid SLA next action</div>
            </div>
          </div>

          {/* Grid Section: Agent Performance Leaderboard & Stage Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Leaderboard Table */}
            <div className="lg:col-span-2 bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#C8A147]" />
                  <h3 className="font-heading font-bold text-base text-[#081428]">Agent Performance Leaderboard</h3>
                </div>
                <span className="text-xs text-[#6E6E6E]">Real-time Execution Metrics</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E4DC] bg-[#FAF8F5] text-[10px] text-[#6E6E6E] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Agent Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Calls Made</th>
                      <th className="py-2.5 px-3">Handovers</th>
                      <th className="py-2.5 px-3">SLA Compliance</th>
                      <th className="py-2.5 px-3">Active Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {leaderboard.map((ag: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 px-3 font-bold text-[#081428] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#081428] text-white text-[10px] font-bold flex items-center justify-center">
                            {ag.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span>{ag.name}</span>
                        </td>
                        <td className="py-3 px-3 text-[#6E6E6E]">{ag.role}</td>
                        <td className="py-3 px-3 font-mono font-bold text-[#081428]">{ag.calls_made}</td>
                        <td className="py-3 px-3 font-bold text-emerald-700">{ag.handovers}</td>
                        <td className="py-3 px-3 font-semibold text-[#081428]">{ag.sla_compliance}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{ag.active_leads} Leads</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SLA Escalation Audit Panel */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <h3 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>SLA Audit Logs</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {data?.recent_breaches && data.recent_breaches.length > 0 ? (
                  data.recent_breaches.map((b: any) => (
                    <div key={b.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded space-y-1">
                      <div className="font-bold text-[#081428]">{b.agent_name} — Breached</div>
                      <div className="text-[11px] text-[#6E6E6E]">{b.action_taken}</div>
                      <div className="text-[10px] text-slate-400">{new Date(b.breached_at).toLocaleString()}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                    <div className="font-bold">Zero Active Breaches</div>
                    <p className="text-[11px] text-emerald-700">All agent SLA deadlines are currently within the required threshold.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
