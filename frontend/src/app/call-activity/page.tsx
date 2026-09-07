'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import { 
  PhoneCall, 
  Search, 
  Filter, 
  Clock, 
  Calendar, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  Briefcase, 
  ChevronRight, 
  ChevronLeft,
  RefreshCw, 
  X,
  PhoneForwarded,
  PhoneMissed,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function CallActivityPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total_today: 0,
    calls_today: 0,
    interested_today: 0,
    callback_today: 0,
    no_answer_today: 0,
    total_all_time: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'interested' | 'callback' | 'voicemail' | 'not_interested'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [paginationMeta, setPaginationMeta] = useState({
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0,
    total: 0,
  });

  const loadActivities = async (page = currentPage, limit = perPage) => {
    setLoading(true);
    try {
      let endpoint = `/activities?page=${page}&per_page=${limit}&type=call`;
      
      if (selectedOutcome !== 'all') {
        endpoint += `&call_outcome=${encodeURIComponent(selectedOutcome)}`;
      } else if (activeTab === 'interested') {
        endpoint += `&call_outcome=Interested - Schedule Viewing`;
      } else if (activeTab === 'callback') {
        endpoint += `&call_outcome=Callback Requested`;
      } else if (activeTab === 'voicemail') {
        endpoint += `&call_outcome=No Answer / Left Voicemail`;
      } else if (activeTab === 'not_interested') {
        endpoint += `&call_outcome=Not Interested`;
      }

      if (selectedAgent !== 'all') {
        endpoint += `&user_name=${encodeURIComponent(selectedAgent)}`;
      }
      if (searchQuery) {
        endpoint += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const res = await fetchApi(endpoint);
      if (res.activities) {
        setActivities(res.activities.data || []);
        setPaginationMeta({
          current_page: res.activities.current_page || page,
          last_page: res.activities.last_page || 1,
          from: res.activities.from || 0,
          to: res.activities.to || 0,
          total: res.activities.total || 0,
        });
      }
      if (res.stats) {
        setStats(res.stats);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load call activities:', err);
      setActivities([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadActivities(1, perPage);
  }, [selectedOutcome, selectedAgent, activeTab, searchQuery]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > paginationMeta.last_page) return;
    setCurrentPage(newPage);
    loadActivities(newPage, perPage);
  };

  const handlePerPageChange = (newLimit: number) => {
    setPerPage(newLimit);
    setCurrentPage(1);
    loadActivities(1, newLimit);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedOutcome('all');
    setSelectedAgent('all');
    setActiveTab('all');
    setCurrentPage(1);
  };

  const isFilterActive = searchQuery !== '' || selectedOutcome !== 'all' || selectedAgent !== 'all' || activeTab !== 'all';

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">Note / Call</span>;
    }

    if (outcome.includes('Interested') || outcome.includes('Viewing')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">Interested 🎯</span>;
    }
    if (outcome.includes('Callback')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">Callback Req 📞</span>;
    }
    if (outcome.includes('Follow-up')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-300">Follow-up 📅</span>;
    }
    if (outcome.includes('No Answer') || outcome.includes('Voicemail')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-300">No Answer ⏳</span>;
    }
    if (outcome.includes('Not Interested')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-300">Not Interested ❌</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">{outcome}</span>;
  };

  // Helper for dynamic page buttons
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

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <PhoneCall className="w-4 h-4" />
                <span>05 — Sales Call Activity</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                Call Activity & Sales Dialing Stream
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Complete audit trail of all agent phone interactions, client call outcomes, and discussion notes.
              </p>
            </div>

            <Link
              href="/queue"
              className="px-4 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-2 w-fit"
            >
              <span>Go to My Queue</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 5 KPI Stat Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { 
                label: 'Total Calls Logged', 
                value: stats.total_all_time ?? paginationMeta.total ?? 0, 
                sub: stats.calls_today > 0 ? `${stats.calls_today} logged today` : 'All-time activity count', 
                icon: PhoneCall, 
                iconBg: 'bg-[#081428] text-[#C8A147]', 
                subColor: 'text-[#081428]' 
              },
              { 
                label: 'Interested / Viewings', 
                value: (stats.interested_count !== undefined && stats.interested_count > 0) ? stats.interested_count : (stats.interested_today || 0), 
                sub: stats.interested_today > 0 ? `${stats.interested_today} hot leads today` : 'Hot buyer leads', 
                icon: CheckCircle2, 
                iconBg: 'bg-emerald-100 text-emerald-800', 
                subColor: 'text-emerald-700' 
              },
              { 
                label: 'Callback Requests', 
                value: (stats.callback_count !== undefined && stats.callback_count > 0) ? stats.callback_count : (stats.callback_today || 0), 
                sub: stats.callback_today > 0 ? `${stats.callback_today} requested today` : 'Need follow-up call', 
                icon: PhoneForwarded, 
                iconBg: 'bg-amber-100 text-amber-800', 
                subColor: 'text-amber-700' 
              },
              { 
                label: 'Voicemail / No Answer', 
                value: (stats.no_answer_count !== undefined && stats.no_answer_count > 0) ? stats.no_answer_count : (stats.no_answer_today || 0), 
                sub: stats.no_answer_today > 0 ? `${stats.no_answer_today} left today` : 'WhatsApp message sent', 
                icon: PhoneMissed, 
                iconBg: 'bg-purple-100 text-purple-800', 
                subColor: 'text-purple-700' 
              },
              { 
                label: 'Calls Logged Today', 
                value: stats.calls_today || 0, 
                sub: 'Daily agent productivity', 
                icon: Clock, 
                iconBg: 'bg-blue-100 text-blue-800', 
                subColor: 'text-blue-700' 
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${card.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-heading font-bold text-xl text-[#081428] leading-tight">
                      {Number(card.value || 0).toLocaleString()}
                    </div>
                    <div className="text-[11px] font-medium text-[#6E6E6E]">{card.label}</div>
                    <div className={`text-[10px] font-semibold ${card.subColor}`}>{card.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Outcome Filter Tabs */}
          <div className="border-b border-[#E8E4DC] flex items-center gap-2 overflow-x-auto pt-2">
            {[
              { id: 'all', label: 'All Call Logs' },
              { id: 'interested', label: 'Interested / Viewings 🎯' },
              { id: 'callback', label: 'Callbacks 📞' },
              { id: 'voicemail', label: 'Voicemail / No Answer ⏳' },
              { id: 'not_interested', label: 'Not Interested ❌' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedOutcome('all');
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

          {/* Filter & Search Controls Bar */}
          <div className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Live Search */}
              <div className="flex items-center gap-2 w-64 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors shrink-0">
                <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
                <input
                  type="text"
                  placeholder="Search client name, phone, notes..."
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

              {/* Outcome Filter */}
              <select
                value={selectedOutcome}
                onChange={(e) => {
                  setSelectedOutcome(e.target.value);
                  setActiveTab('all');
                }}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Call Outcomes</option>
                <option value="Interested - Schedule Viewing">Interested — Schedule Viewing</option>
                <option value="Callback Requested">Callback Requested</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="No Answer / Left Voicemail">No Answer / Left Voicemail</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Wrong Number">Wrong Number</option>
              </select>

              {/* Agent Filter */}
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Agents</option>
                <option value="Hiba Aslam">Hiba Aslam</option>
                <option value="Shafiuddin">Shafiuddin</option>
                <option value="Rayyan">Rayyan</option>
                <option value="Saad">Saad</option>
                <option value="Mako">Mako</option>
                <option value="Faraz Shafi">Faraz Shafi</option>
                <option value="Babar Ali Khan">Babar Ali Khan</option>
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

            <div className="text-[11px] font-medium text-[#6E6E6E] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#C8A147]" />
              <span>Showing {paginationMeta.total} Logged Calls</span>
            </div>
          </div>

          {/* Call Activity Table */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E8E4DC] text-[#6E6E6E] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-3 pl-4">Timestamp</th>
                    <th className="p-3">Agent</th>
                    <th className="p-3">Client Contact</th>
                    <th className="p-3">Call Outcome</th>
                    <th className="p-3">Discussion Notes & Summary</th>
                    <th className="p-3">Linked Deal / Opp</th>
                    <th className="p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8E4DC]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#6E6E6E]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                        <span>Loading call activity stream...</span>
                      </td>
                    </tr>
                  ) : activities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-[#6E6E6E] space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                        <div className="font-bold text-sm text-[#081428]">No Call Records Found</div>
                        <p className="text-xs text-[#6E6E6E]">Log phone calls in My Queue to see real-time activities here.</p>
                      </td>
                    </tr>
                  ) : (
                    activities.map((act) => {
                      const contact = act.contact || {};
                      const opp = act.opportunity || {};

                      return (
                        <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Timestamp */}
                          <td className="p-3 pl-4 whitespace-nowrap">
                            <div className="font-mono font-semibold text-[#081428] text-xs">
                              {act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                            <div className="text-[10px] text-[#6E6E6E] font-mono">
                              {act.created_at ? new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </div>
                          </td>

                          {/* Agent */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-semibold text-[#081428]">
                              <User className="w-3 h-3 text-[#C8A147]" />
                              <span>{act.user_name || 'Agent'}</span>
                            </div>
                          </td>

                          {/* Client Contact */}
                          <td className="p-3">
                            <div className="font-bold text-[#081428]">
                              {contact.name || `Contact #${act.contact_id}`}
                            </div>
                            {contact.phone && (
                              <div className="text-[10px] font-mono text-[#6E6E6E] flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 text-slate-400" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                          </td>

                          {/* Outcome */}
                          <td className="p-3 whitespace-nowrap">
                            {getOutcomeBadge(act.call_outcome)}
                          </td>

                          {/* Discussion Notes */}
                          <td className="p-3 max-w-md">
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                              {act.description || 'No notes provided.'}
                            </p>
                          </td>

                          {/* Linked Deal */}
                          <td className="p-3 whitespace-nowrap">
                            {opp.id ? (
                              <Link
                                href={`/opportunities/${opp.id}`}
                                className="font-bold text-[#081428] hover:text-[#C8A147] hover:underline flex items-center gap-1"
                              >
                                <Briefcase className="w-3 h-3 text-[#C8A147]" />
                                <span>Opportunity #{opp.id}</span>
                              </Link>
                            ) : (
                              <span className="text-[11px] text-slate-400">Direct Contact</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="p-3 pr-4 text-right whitespace-nowrap">
                            {opp.id ? (
                              <Link
                                href={`/opportunities/${opp.id}`}
                                className="px-2.5 py-1 bg-[#081428] hover:bg-[#122444] text-white font-semibold text-xs rounded transition-colors inline-flex items-center gap-1"
                              >
                                <span>Opportunity</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            ) : (
                              <Link
                                href="/"
                                className="px-2.5 py-1 bg-white border border-[#E8E4DC] hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded transition-colors inline-flex items-center gap-1"
                              >
                                <span>Lead Pool</span>
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6E6E]">
              <div>
                Showing <span className="font-bold text-[#081428]">{paginationMeta.from || 0}</span> to{' '}
                <span className="font-bold text-[#081428]">{paginationMeta.to || 0}</span> of{' '}
                <span className="font-bold text-[#081428]">{Number(paginationMeta.total || 0).toLocaleString()}</span> results
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
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
                      onClick={() => handlePageChange(p as number)}
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
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= paginationMeta.last_page || loading}
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
                className="p-1.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-medium cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
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
