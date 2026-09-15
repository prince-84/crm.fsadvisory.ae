'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { 
  Calendar as CalendarIcon, Clock, MapPin, User, ChevronLeft, ChevronRight, 
  Plus, CheckCircle2, AlertCircle, Phone, FileCheck, Building, Filter,
  CalendarDays, Tag, Sparkles, X, Trash2, RefreshCw, Check, Search, ExternalLink
} from 'lucide-react';
import Swal from 'sweetalert2';
import { fetchApi } from '@/lib/api';
import { isSuperUser } from '@/lib/permissions';
import Link from 'next/link';

interface Appointment {
  id: number;
  contact_id?: number | null;
  opportunity_id?: number | null;
  title: string;
  category: 'viewing' | 'spa' | 'meeting' | 'valuation';
  appointment_date: string; // YYYY-MM-DD
  start_time: string;
  end_time?: string | null;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  agent_name: string;
  location?: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'normal';
  notes?: string | null;
  contact?: any;
  opportunity?: any;
}

export default function CalendarPage() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Live Database States
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    viewings: 0,
    spas: 0,
    completed: 0,
    today_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Current User & Team Scope
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teamAgents, setTeamAgents] = useState<any[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [contactsList, setContactsList] = useState<any[]>([]);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Initial Form State
  const initialFormState = {
    title: '',
    category: 'viewing' as Appointment['category'],
    appointment_date: todayStr,
    start_time: '10:30 AM',
    client_name: '',
    client_phone: '',
    client_email: '',
    agent_name: 'Faraz Shafi',
    location: '',
    priority: 'normal' as Appointment['priority'],
    notes: '',
    contact_id: null as number | null,
    opportunity_id: null as number | null,
  };
  const [formData, setFormData] = useState(initialFormState);

  // Sync Current User & Team Agents
  useEffect(() => {
    try {
      const raw = localStorage.getItem('crm_user');
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUser(u);
        setFormData(prev => ({
          ...prev,
          agent_name: u?.name || 'Faraz Shafi',
        }));
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

    fetchApi('/contacts?per_page=50')
      .then((data) => {
        const list = data?.contacts?.data || (Array.isArray(data) ? data : []);
        setContactsList(list);
      })
      .catch(console.error);
  }, []);

  // Fetch Appointments from Backend
  const loadAppointments = async (monthOverride?: number, yearOverride?: number, ownerOverride?: string) => {
    setLoading(true);
    try {
      const targetYear = yearOverride !== undefined ? yearOverride : currentMonthDate.getFullYear();
      const targetMonth = monthOverride !== undefined ? monthOverride : currentMonthDate.getMonth() + 1;
      const targetOwner = ownerOverride !== undefined ? ownerOverride : selectedOwner;

      let url = `/appointments?year=${targetYear}&month=${String(targetMonth).padStart(2, '0')}`;
      if (targetOwner && targetOwner !== 'all') {
        url += `&agent_name=${encodeURIComponent(targetOwner)}`;
      }

      const res = await fetchApi(url);
      if (res && res.success) {
        setAppointments(res.appointments || []);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [currentMonthDate, selectedOwner]);

  // Calendar Date Math
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthName = currentMonthDate.toLocaleString('default', { month: 'long' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: (firstDayOfWeek + 6) % 7 }, (_, i) => i); // Mon = 0 start

  const handlePrevMonth = () => {
    const prevDate = new Date(year, month - 1, 1);
    setCurrentMonthDate(prevDate);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month + 1, 1);
    setCurrentMonthDate(nextDate);
  };

  const handleToday = () => {
    const realNow = new Date();
    setCurrentMonthDate(new Date(realNow.getFullYear(), realNow.getMonth(), 1));
    setSelectedDateStr(todayStr);
  };

  const formatDateStr = (dayNum: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Client Selection in Modal
  const handleSelectExistingContact = (contactId: number) => {
    const c = contactsList.find((item) => item.id === contactId);
    if (c) {
      setFormData(prev => ({
        ...prev,
        contact_id: c.id,
        client_name: c.name,
        client_phone: c.phone,
        client_email: c.email || '',
        agent_name: c.assigned_to && c.assigned_to !== 'Unassigned' ? c.assigned_to : (currentUser?.name || prev.agent_name),
      }));
    }
  };

  // Create Appointment in MySQL Database
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.client_name || !formData.client_phone) {
      Swal.fire('Required Fields', 'Please enter Title, Client Name, and Primary Phone.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchApi('/appointments', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res && res.success) {
        setIsAddModalOpen(false);
        setSelectedDateStr(formData.appointment_date);
        setFormData({
          ...initialFormState,
          appointment_date: formData.appointment_date,
          agent_name: currentUser?.name || 'Faraz Shafi',
        });

        Swal.fire({
          icon: 'success',
          title: 'Appointment Scheduled!',
          text: `"${res.appointment.title}" scheduled for ${res.appointment.appointment_date} at ${res.appointment.start_time}.`,
          timer: 2000,
          showConfirmButton: false,
        });

        loadAppointments();
      } else {
        throw new Error(res?.message || 'Failed to schedule appointment.');
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', err.message || 'Failed to save appointment to database.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Mark Completed in Database
  const handleMarkCompleted = async (id: number) => {
    try {
      const res = await fetchApi(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });

      if (res && res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Appointment Completed',
          text: 'Status updated to completed.',
          timer: 1500,
          showConfirmButton: false,
        });
        loadAppointments();
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to update status.', 'error');
    }
  };

  // Cancel Appointment in Database
  const handleCancelEvent = async (id: number) => {
    const result = await Swal.fire({
      title: 'Cancel Appointment?',
      text: 'Are you sure you want to mark this scheduled appointment as cancelled?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Cancel Appointment',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetchApi(`/appointments/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'cancelled' }),
        });

        if (res && res.success) {
          Swal.fire('Cancelled', 'The appointment has been marked as cancelled.', 'info');
          loadAppointments();
        }
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to cancel appointment.', 'error');
      }
    }
  };

  // Delete Appointment from Database
  const handleDeleteAppointment = async (id: number, title: string) => {
    const result = await Swal.fire({
      title: 'Delete Appointment?',
      text: `Are you sure you want to permanently remove "${title}" from the database?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Delete Permanently',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetchApi(`/appointments/${id}`, {
          method: 'DELETE',
        });

        if (res && res.success) {
          Swal.fire('Deleted', 'Appointment removed from database.', 'success');
          loadAppointments();
        }
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to delete appointment.', 'error');
      }
    }
  };

  // Filtered Events for the Selected Date
  const filteredDayAppointments = useMemo(() => {
    return appointments.filter(ev => {
      // Normalize appointment_date (may be ISO string or YYYY-MM-DD)
      const evDate = (ev.appointment_date || '').substring(0, 10);
      const matchesDate = evDate === selectedDateStr;
      const matchesCategory = activeCategory === 'all' || ev.category === activeCategory;
      
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        matchesSearch = (ev.title || '').toLowerCase().includes(q) ||
          (ev.client_name || '').toLowerCase().includes(q) ||
          (ev.client_phone || '').toLowerCase().includes(q) ||
          (ev.location || '').toLowerCase().includes(q) ||
          (ev.agent_name || '').toLowerCase().includes(q);
      }

      return matchesDate && matchesCategory && matchesSearch;
    });
  }, [appointments, selectedDateStr, activeCategory, searchQuery]);

  // Category Badge Renderer
  const getCategoryBadge = (cat: Appointment['category']) => {
    switch (cat) {
      case 'viewing':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">Property Tour</span>;
      case 'spa':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">SPA Contract</span>;
      case 'valuation':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-900 border border-purple-300">Valuation</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-900 border border-blue-300">Client Meeting</span>;
    }
  };

  // Selected Day Appointments & Stats
  const selectedDayAppointments = appointments.filter(ev => (ev.appointment_date || '').substring(0, 10) === selectedDateStr);
  const selectedDayViewings = selectedDayAppointments.filter(ev => ev.category === 'viewing').length;
  const selectedDaySpas = selectedDayAppointments.filter(ev => ev.category === 'spa').length;
  const selectedDayCompleted = selectedDayAppointments.filter(ev => ev.status === 'completed').length;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-4 w-full max-w-7xl mx-auto">
          {/* Top Actions Bar (Title, Advisor Filter & Schedule Button) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E8E4DC] p-3.5 rounded-lg shadow-2xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#C8A147]" />
                <h1 className="font-heading font-bold text-lg text-[#081428]">
                  Appointments & Viewings Calendar
                </h1>
              </div>

              {/* Advisor Scope Selector */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:border-[#C8A147] rounded-md px-3 py-1.5 shrink-0 transition-colors">
                <User className="w-3.5 h-3.5 text-[#C8A147]" />
                <select
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  className="bg-transparent border-none text-xs text-[#081428] font-bold focus:outline-none cursor-pointer"
                >
                  {isSuperUser(currentUser) ? (
                    <>
                      <option value="all">👥 All Advisors (Entire Team)</option>
                      {currentUser?.name && (
                        <option value={currentUser.name}>⭐ My Schedule ({currentUser.name})</option>
                      )}
                      {teamAgents.filter((a) => a.name !== currentUser?.name).map((a) => (
                        <option key={a.id} value={a.name}>👤 {a.name} ({a.role})</option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value={currentUser?.name || 'me'}>🎯 My Schedule ({currentUser?.name || 'Me'})</option>
                      <option value="all">👥 View Team Schedule</option>
                    </>
                  )}
                </select>
              </div>

              {/* Quick Refresh Button */}
              <button
                onClick={() => loadAppointments()}
                disabled={loading}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                title="Refresh from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C8A147]' : ''}`} />
              </button>
            </div>

            <button
              onClick={() => {
                setFormData({
                  ...initialFormState,
                  appointment_date: selectedDateStr,
                  agent_name: currentUser?.name || 'Faraz Shafi',
                });
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Schedule New Appointment</span>
            </button>
          </div>

          {/* KPI Overview Bar (Live DB Metrics for Selected Date) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-[#E8E4DC] rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-[#6E6E6E] uppercase tracking-wider">Scheduled on Day</div>
                <div className="font-heading text-xl font-bold text-[#081428] mt-0.5">{selectedDayAppointments.length}</div>
              </div>
              <CalendarDays className="w-6 h-6 text-[#C8A147]" />
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Property Tours</div>
                <div className="font-heading text-xl font-bold text-amber-900 mt-0.5">{selectedDayViewings}</div>
              </div>
              <Building className="w-6 h-6 text-amber-700" />
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">SPA Signings</div>
                <div className="font-heading text-xl font-bold text-emerald-900 mt-0.5">{selectedDaySpas}</div>
              </div>
              <FileCheck className="w-6 h-6 text-emerald-700" />
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Completed on Day</div>
                <div className="font-heading text-xl font-bold text-blue-900 mt-0.5">{selectedDayCompleted}</div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-blue-700" />
            </div>
          </div>

          {/* Main Grid: Calendar Month Interactive View + Selected Day Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Left 7 Cols: Month Interactive Grid */}
            <div className="lg:col-span-7 bg-white border border-[#E8E4DC] rounded-lg p-5 space-y-4 shadow-2xs">
              {/* Month Header Controls */}
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-base text-[#081428]">
                    {monthName} {year}
                  </h2>
                  <button
                    onClick={handleToday}
                    className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 text-[#081428] font-bold text-[11px] rounded transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 rounded text-[#081428] transition-colors cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 rounded text-[#081428] transition-colors cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-[#6E6E6E] uppercase tracking-wider pb-1">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
                <div>Sun</div>
              </div>

              {/* Month Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {paddingDays.map((_, idx) => (
                  <div key={`pad-${idx}`} className="h-14 bg-[#FAF8F5]/40 rounded opacity-30 border border-transparent"></div>
                ))}

                {daysArray.map(dayNum => {
                  const dateStr = formatDateStr(dayNum);
                  const isSelected = dateStr === selectedDateStr;
                  const isToday = dateStr === todayStr;
                  const dayEvents = appointments.filter(e => (e.appointment_date || '').substring(0, 10) === dateStr);

                  return (
                    <button
                      key={dayNum}
                      onClick={() => setSelectedDateStr(dateStr)}
                      className={`h-14 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all relative cursor-pointer ${
                        isSelected 
                          ? 'bg-[#081428] text-white border-[#081428] shadow-md ring-2 ring-[#C8A147]' 
                          : isToday 
                          ? 'bg-amber-50/80 border-[#C8A147] text-[#081428]' 
                          : 'bg-white border-[#E8E4DC] hover:border-[#C8A147] text-[#081428]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-[#C8A147]' : ''}`}>{dayNum}</span>
                        {isToday && !isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C8A147]" title="Today"></span>
                        )}
                      </div>

                      {/* Event Dot Indicators */}
                      {dayEvents.length > 0 && (
                        <div className="flex items-center gap-1 overflow-hidden">
                          {dayEvents.slice(0, 3).map((ev, eIdx) => (
                            <span 
                              key={eIdx} 
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                ev.category === 'viewing' ? 'bg-amber-500' :
                                ev.category === 'spa' ? 'bg-emerald-500' :
                                ev.category === 'valuation' ? 'bg-purple-500' : 'bg-blue-500'
                              }`} 
                              title={`${ev.start_time} - ${ev.title}`}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className={`text-[9px] font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Category Legend Bar */}
              <div className="pt-3 border-t border-[#E8E4DC] flex items-center justify-between text-[11px] text-[#6E6E6E]">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>Property Tour</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>SPA Signing</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span>Valuation</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>Meeting</span>
                  </div>
                </div>

                <div className="font-bold text-[#081428] text-xs">
                  {appointments.length} Total in {monthName}
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Selected Date Event Timeline */}
            <div className="lg:col-span-5 bg-white border border-[#E8E4DC] rounded-lg p-5 space-y-4 shadow-2xs flex flex-col">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3 gap-2 flex-wrap">
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#081428]">
                    {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="text-[11px] text-[#6E6E6E]">
                    {filteredDayAppointments.length} appointments scheduled
                  </div>
                </div>

                {/* Category Filter */}
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="px-2 py-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs font-semibold text-[#081428] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="viewing">Property Tours</option>
                  <option value="spa">SPA Signings</option>
                  <option value="valuation">Valuations</option>
                  <option value="meeting">Meetings</option>
                </select>
              </div>

              {/* Timeline Search */}
              <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors">
                <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
                <input
                  type="text"
                  placeholder="Search client, title, location..."
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

              {/* Appointments List */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px] pr-1">
                {loading ? (
                  <div className="py-12 text-center text-[#6E6E6E]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                    <span className="text-xs">Loading appointments...</span>
                  </div>
                ) : filteredDayAppointments.length === 0 ? (
                  <div className="p-10 border-2 border-dashed border-[#E8E4DC] rounded-lg text-center space-y-2">
                    <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="font-bold text-xs text-[#081428]">No Appointments on this Date</div>
                    <p className="text-[11px] text-[#6E6E6E]">
                      Click "Schedule New Appointment" to add a client property tour or meeting.
                    </p>
                  </div>
                ) : (
                  filteredDayAppointments.map((ev) => (
                    <div 
                      key={ev.id}
                      className={`p-3.5 rounded-lg border transition-all space-y-2 relative ${
                        ev.status === 'completed' ? 'bg-slate-50/90 border-slate-200' :
                        ev.status === 'cancelled' ? 'bg-red-50/40 border-red-200 opacity-60' :
                        'bg-[#FAF8F5] border-[#E8E4DC] hover:border-[#C8A147]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-0.5 bg-[#081428] text-[#C8A147] font-bold text-[11px] rounded font-mono shrink-0">
                            {ev.start_time}
                          </div>
                          {getCategoryBadge(ev.category)}
                        </div>

                        {ev.status === 'completed' && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase">Completed</span>
                        )}
                        {ev.status === 'cancelled' && (
                          <span className="text-[9px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded uppercase">Cancelled</span>
                        )}
                        {ev.priority === 'high' && ev.status === 'scheduled' && (
                          <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded uppercase">High Priority</span>
                        )}
                      </div>

                      <div>
                        <h4 className={`font-bold text-xs text-[#081428] ${ev.status === 'cancelled' ? 'line-through' : ''}`}>
                          {ev.title}
                        </h4>
                        {ev.notes && (
                          <p className="text-[11px] text-[#6E6E6E] mt-0.5 italic">
                            "{ev.notes}"
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E6E6E] pt-1 border-t border-[#E8E4DC]/60">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                          <span className="truncate">Client: <strong className="text-[#081428]">{ev.client_name}</strong></span>
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-mono text-xs text-[#081428] truncate">{ev.client_phone}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10.5px] text-[#6E6E6E]">
                        <div className="flex items-center gap-1.5 truncate">
                          <Tag className="w-3 h-3 text-[#C8A147] shrink-0" />
                          <span className="truncate">Advisor: <strong className="text-[#081428]">{ev.agent_name}</strong></span>
                        </div>

                        {ev.location && (
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="truncate" title={ev.location}>{ev.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Event Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#E8E4DC]">
                        {ev.contact_id ? (
                          <Link
                            href={`/opportunities/${ev.opportunity_id || ''}`}
                            className="text-[10px] text-[#C8A147] hover:underline font-bold flex items-center gap-0.5"
                          >
                            <span>Client Profile</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        ) : <div></div>}

                        <div className="flex items-center gap-1.5">
                          {ev.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => handleMarkCompleted(ev.id)}
                                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] rounded flex items-center gap-1 transition-colors cursor-pointer"
                                title="Mark as Completed"
                              >
                                <Check className="w-3 h-3" />
                                <span>Done</span>
                              </button>
                              <button
                                onClick={() => handleCancelEvent(ev.id)}
                                className="px-2 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[10px] rounded transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteAppointment(ev.id, ev.title)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* SCHEDULE NEW APPOINTMENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#081428]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="bg-[#081428] p-4 text-white flex items-center justify-between border-b border-[#152744]">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#C8A147]" />
                <span className="font-heading font-bold text-sm">Schedule Client Appointment</span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAppointment} className="p-5 space-y-3.5 text-xs">
              {/* Optional: Pick Existing Client */}
              {contactsList.length > 0 && (
                <div>
                  <label className="block font-bold text-[#6E6E6E] mb-1 text-[11px]">
                    Quick Select from Existing Contacts (Optional)
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleSelectExistingContact(Number(e.target.value));
                      }
                    }}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="">-- Or type client manually below --</option>
                    {contactsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        👤 {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-[#081428] mb-1">Appointment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Property Tour — Downtown 2BR Luxury Unit"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#081428] mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none cursor-pointer"
                  >
                    <option value="viewing">Property Tour (Viewing)</option>
                    <option value="spa">SPA Contract Signing</option>
                    <option value="valuation">CMA Valuation Presentation</option>
                    <option value="meeting">Client Consultation Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#081428] mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none cursor-pointer"
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="high">🔥 High Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#081428] mb-1">Appointment Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#081428] mb-1">Start Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10:30 AM"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#081428] mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rashid Al Nuaimi"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#081428] mb-1">Client Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +971 50 123 4567"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#081428] mb-1">Assigned Advisor *</label>
                  <select
                    value={formData.agent_name}
                    onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none cursor-pointer"
                  >
                    {teamAgents.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                    {teamAgents.length === 0 && (
                      <option value="Faraz Shafi">Faraz Shafi</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#081428] mb-1">Property / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Burj Crown, Downtown Dubai"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#081428] mb-1">Access Notes / Client Requirements</label>
                <textarea
                  rows={2}
                  placeholder="Security access instructions, key locations, or client preferences..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:border-[#C8A147] focus:outline-none"
                ></textarea>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-bold rounded hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save & Schedule</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
