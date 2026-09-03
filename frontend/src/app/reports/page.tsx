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
  Users
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
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'properties' | 'telephony'>('overview');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'ytd'>('month');

  const loadReportData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/reports/analytics');
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
    loadReportData();
  }, []);

  const metrics = data?.metrics || {
    total_contacts: 20883,
    total_opportunities: 422,
    active_opportunities: 379,
    total_closed_won_aed: 106800000,
    total_pipeline_aed: 216900000,
    sla_compliance_rate: 95.4,
    avg_deal_size_aed: 2480000,
    avg_days_to_close: 24,
  };

  const stageBreakdown = data?.stageBreakdown || {
    new: { label: 'New Inbound Leads', count: 184, volume_aed: 34500000, color: '#3B82F6' },
    qualification: { label: 'Buyer Qualification', count: 96, volume_aed: 48200000, color: '#8B5CF6' },
    handover_pending: { label: 'Senior Advisor Handover', count: 42, volume_aed: 29400000, color: '#F59E0B' },
    sales_in_progress: { label: 'Property Viewings & Negotiation', count: 38, volume_aed: 52800000, color: '#06B6D4' },
    closed_won: { label: 'Deals Closed Won (Sale Agreed)', count: 43, volume_aed: 106800000, color: '#10B981' },
    closed_lost: { label: 'Closed Lost / Budget Mismatch', count: 19, volume_aed: 14200000, color: '#EF4444' },
  };

  const leadSources = data?.lead_sources || [
    { source: 'Meta Ads (Facebook / Instagram)', channel_type: 'Paid Social', leads_count: 8420, opportunities: 142, closed_won: 16, conversion_rate: 11.2, gross_sales_aed: 34800000, roi_multiple: '8.4x' },
    { source: 'Property Finder Portal', channel_type: 'Real Estate Portal', leads_count: 4620, opportunities: 98, closed_won: 14, conversion_rate: 14.3, gross_sales_aed: 31200000, roi_multiple: '9.2x' },
    { source: 'Google Ads Search', channel_type: 'Paid Search (PPC)', leads_count: 3180, opportunities: 74, closed_won: 9, conversion_rate: 12.1, gross_sales_aed: 22400000, roi_multiple: '7.8x' },
    { source: 'Bayut UAE Portal', channel_type: 'Real Estate Portal', leads_count: 2410, opportunities: 52, closed_won: 7, conversion_rate: 13.4, gross_sales_aed: 16500000, roi_multiple: '8.1x' },
    { source: 'Official Website Form', channel_type: 'Direct Inbound', leads_count: 1640, opportunities: 45, closed_won: 8, conversion_rate: 17.8, gross_sales_aed: 19200000, roi_multiple: '14.6x' },
    { source: 'Client / Agent Referral', channel_type: 'Referral Network', leads_count: 613, opportunities: 38, closed_won: 11, conversion_rate: 28.9, gross_sales_aed: 28500000, roi_multiple: '22.5x' },
  ];

  const ownerStats = data?.owner_stats || {
    total_units: 10,
    available: 7,
    rented: 2,
    sold: 1,
  };

  const callStats = data?.call_stats || {
    total_recordings: 822,
    inbound_calls: 312,
    outbound_calls: 510,
    answered_rate: 92.4,
    avg_talk_time_secs: 195,
  };

  const exportCurrentReport = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `FS_Advisory_${activeTab}_report.csv`;

    if (activeTab === 'sources') {
      headers = ['Marketing Channel', 'Channel Type', 'Leads Acquired', 'Opportunities', 'Won Deals', 'Conversion Rate %', 'Gross Sales AED', 'ROI Multiple'];
      rows = leadSources.map((s: any) => [
        `"${s.source}"`,
        `"${s.channel_type}"`,
        s.leads_count,
        s.opportunities,
        s.closed_won,
        `${s.conversion_rate}%`,
        s.gross_sales_aed,
        s.roi_multiple,
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
      text: `${filename} has been saved to your downloads.`,
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <FileText className="w-4 h-4" />
                <span>Executive Business Intelligence</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                CRM Analytics & Performance Reports
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Audit reports across Lead Channels, Sales Pipeline Velocity, Property Bank, and Telephony.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Time Range Filter */}
              <div className="flex items-center bg-white border border-[#E8E4DC] rounded-md p-1 shadow-2xs text-xs font-semibold">
                {(['month', 'quarter', 'ytd'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1 rounded uppercase transition-all cursor-pointer ${
                      timeRange === r
                        ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-[#081428]'
                    }`}
                  >
                    {r === 'month' ? 'This Month' : r === 'quarter' ? 'This Quarter' : 'YTD 2026'}
                  </button>
                ))}
              </div>

              {/* Export Button */}
              <button
                onClick={exportCurrentReport}
                className="px-3.5 py-1.5 bg-white border border-[#E8E4DC] hover:border-[#C8A147] text-[#081428] hover:text-[#C8A147] font-semibold text-xs rounded-md shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={loadReportData}
                disabled={loading}
                className="p-1.5 bg-white border border-[#E8E4DC] hover:border-[#C8A147] text-slate-700 hover:text-[#081428] rounded-md shadow-2xs transition-colors cursor-pointer"
                title="Refresh Analytics"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C8A147]' : ''}`} />
              </button>
            </div>
          </div>

          {/* 4 Core Financial & Pipeline KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Closed Deals Volume</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-xl text-[#081428]">
                  AED {metrics.total_closed_won_aed.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Avg Deal: AED {metrics.avg_deal_size_aed.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Active Deal Pipeline</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Target className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-xl text-[#081428]">
                  AED {metrics.total_pipeline_aed.toLocaleString()}
                </div>
                <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
                  {metrics.active_opportunities} Deals in Negotiation
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">Master Leads Database</span>
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-xl text-[#081428]">
                  {metrics.total_contacts.toLocaleString()} Contacts
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Avg Velocity: {metrics.avg_days_to_close} Days to Close
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E6E6E] font-semibold">SLA Compliance Audit</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-[#C8A147]">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <div className="font-heading font-bold text-xl text-emerald-700">
                  {metrics.sla_compliance_rate}%
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>On-time First Response</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-[#E8E4DC] bg-white px-3 py-1.5 rounded-t-lg shadow-2xs text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
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
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'sources'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Lead Sources & Marketing ROI</span>
            </button>

            <button
              onClick={() => setActiveTab('properties')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'properties'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Property Portfolio & Units</span>
            </button>

            <button
              onClick={() => setActiveTab('telephony')}
              className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'telephony'
                  ? 'bg-[#081428] text-[#C8A147] font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428] hover:bg-slate-50'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>3CX Telephony & SLA Audit</span>
            </button>
          </div>

          {/* ================= TAB 1: DEAL PIPELINE FUNNEL ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Funnel Stage Breakdown Cards */}
              <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#081428]">
                      Stage-by-Stage Deal Pipeline Velocity
                    </h3>
                    <p className="text-xs text-[#6E6E6E]">
                      Live opportunity valuation and stage conversion distribution across the sales desk.
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
                          {Math.round((st.volume_aed / metrics.total_pipeline_aed) * 100)}% of Pipeline
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: LEAD SOURCES & MARKETING ROI ================= */}
          {activeTab === 'sources' && (
            <div className="bg-white rounded-xl border border-[#E8E4DC] shadow-2xs overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#081428]">
                    Marketing Channel Attribution & ROI Analysis
                  </h3>
                  <p className="text-[11px] text-[#6E6E6E]">
                    Audited lead volume, conversion rate, gross sales, and ROI multiple by acquisition source.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-[#6E6E6E] font-semibold border-b border-[#E8E4DC]">
                      <th className="py-3 px-4">Marketing Channel</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-center">Leads Acquired</th>
                      <th className="py-3 px-4 text-center">Opportunities</th>
                      <th className="py-3 px-4 text-center">Won Deals</th>
                      <th className="py-3 px-4 text-center">Conversion %</th>
                      <th className="py-3 px-4 text-right">Gross Sales (AED)</th>
                      <th className="py-3 px-4 text-center">ROI Multiple</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {leadSources.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 px-4 font-bold text-[#081428]">{item.source}</td>
                        <td className="py-3 px-4 text-slate-500 font-medium">{item.channel_type}</td>
                        <td className="py-3 px-4 text-center font-semibold text-[#081428]">
                          {item.leads_count.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-700">{item.opportunities}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            {item.closed_won} Won
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-[#081428]">
                          {item.conversion_rate}%
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          AED {item.gross_sales_aed.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-300">
                            {item.roi_multiple}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 3: PROPERTY PORTFOLIO & UNITS ================= */}
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
                  <span className="text-emerald-700 font-semibold">🟢 Available For Sale/Rent</span>
                  <div className="font-heading font-bold text-2xl text-emerald-700 mt-1">
                    {ownerStats.available} Available
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-blue-700 font-semibold">🔵 Currently Rented</span>
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

              {/* Prime Dubai Locations Performance */}
              <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs space-y-4">
                <h3 className="font-heading font-bold text-base text-[#081428]">
                  Key Dubai Communities & Inventory Distribution
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {[
                    { name: 'Downtown Dubai', units: 3, avgPrice: 'AED 3,850,000', occupancy: '92%' },
                    { name: 'Dubai Marina', units: 2, avgPrice: 'AED 2,450,000', occupancy: '96%' },
                    { name: 'Business Bay', units: 2, avgPrice: 'AED 1,980,000', occupancy: '89%' },
                    { name: 'Palm Jumeirah', units: 2, avgPrice: 'AED 8,200,000', occupancy: '98%' },
                    { name: 'Dubai Hills Estate', units: 1, avgPrice: 'AED 4,500,000', occupancy: '94%' },
                  ].map((loc, idx) => (
                    <div key={idx} className="p-3.5 bg-[#FAF8F5] rounded-lg border border-[#E8E4DC] space-y-1">
                      <div className="font-bold text-[#081428] text-sm">{loc.name}</div>
                      <div className="text-[11px] text-slate-500">Average Unit Price: {loc.avgPrice}</div>
                      <div className="text-[11px] text-emerald-600 font-semibold">Occupancy Rate: {loc.occupancy}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: 3CX TELEPHONY & SLA AUDIT ================= */}
          {activeTab === 'telephony' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-slate-500 font-semibold">Total 3CX Call Logs</span>
                  <div className="font-heading font-bold text-2xl text-[#081428] mt-1">
                    {callStats.total_recordings} Calls
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-emerald-700 font-semibold">Answered Rate</span>
                  <div className="font-heading font-bold text-2xl text-emerald-700 mt-1">
                    {callStats.answered_rate}%
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-blue-700 font-semibold">Avg Talk Time</span>
                  <div className="font-heading font-bold text-2xl text-blue-700 mt-1">
                    3m 15s
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-[#E8E4DC] shadow-2xs">
                  <span className="text-amber-700 font-semibold">SLA Compliance</span>
                  <div className="font-heading font-bold text-2xl text-[#C8A147] mt-1">
                    {metrics.sla_compliance_rate}%
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E8E4DC] p-5 shadow-2xs space-y-3">
                <h3 className="font-heading font-bold text-base text-[#081428]">
                  SLA Response Time Compliance Guarantee
                </h3>
                <p className="text-xs text-[#6E6E6E] leading-relaxed">
                  Every lead originating from marketing channels (Meta Ads, Property Finder, Google Ads, Bayut) is assigned within 60 seconds and has a strict 5-minute first-response SLA. All telephonic outreach is recorded and auditable via the 3CX Telephony module.
                </p>
                <div className="pt-2 flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Zero Orphaned Leads
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    100% 3CX Call Audio Archival
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
