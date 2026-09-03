'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { 
  Calendar as CalendarIcon, Clock, MapPin, User, ChevronLeft, ChevronRight, 
  Plus, CheckCircle2, AlertCircle, Phone, FileCheck, Building, Filter,
  CalendarDays, Tag, ShieldAlert, Sparkles, X, Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useEffect } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  category: 'viewing' | 'spa' | 'meeting' | 'valuation';
  date: string; // YYYY-MM-DD
  time: string;
  clientName: string;
  clientPhone: string;
  agentName: string;
  location: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'normal';
  notes?: string;
}

export default function CalendarPage() {
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 7, 1)); // August 2026
  const [selectedDateStr, setSelectedDateStr] = useState('2026-08-24');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Initial Sample Events
  const [events, setEvents] = useState<CalendarEvent[]>([
    {
      id: 'ev-1',
      title: 'Property Tour — Downtown 2BR Apartment',
      category: 'viewing',
      date: '2026-08-24',
      time: '10:00 AM',
      clientName: 'Ahmed Al Mansoori',
      clientPhone: '+971 50 123 4567',
      agentName: 'Faraz Shafi',
      location: 'Burj Crown, Downtown Dubai',
      status: 'scheduled',
      priority: 'high',
      notes: 'Client interested in high-floor units with full Burj Khalifa view.'
    },
    {
      id: 'ev-2',
      title: 'CMA Valuation & Listing Agreement Presentation',
      category: 'valuation',
      date: '2026-08-24',
      time: '02:30 PM',
      clientName: 'Fatima Al Sayed',
      clientPhone: '+971 52 444 8899',
      agentName: 'Faraz Shafi',
      location: 'FS Advisory Head Office, Business Bay',
      status: 'scheduled',
      priority: 'medium',
      notes: 'Discuss exclusivity period and 2% seller commission agreement.'
    },
    {
      id: 'ev-3',
      title: 'SPA Contract Signing & Cheque Deposit',
      category: 'spa',
      date: '2026-08-24',
      time: '05:00 PM',
      clientName: 'Tariq Mahmood',
      clientPhone: '+971 54 777 2211',
      agentName: 'Mako / Faraz',
      location: 'Dubai Land Department (DLD) Trustee Office',
      status: 'scheduled',
      priority: 'high',
      notes: 'Ensure client brings original Emirates ID and passport copy.'
    },
    {
      id: 'ev-4',
      title: 'VIP Beachfront Villa Site Inspection',
      category: 'viewing',
      date: '2026-08-25',
      time: '11:30 AM',
      clientName: 'David Miller',
      clientPhone: '+971 55 999 3322',
      agentName: 'Hassan Qasimi',
      location: 'Palm Beach Towers, Palm Jumeirah',
      status: 'scheduled',
      priority: 'high',
      notes: 'Arrange access pass with Nakheel security.'
    },
    {
      id: 'ev-5',
      title: 'Mortgage Pre-Approval Bank Consultation',
      category: 'meeting',
      date: '2026-08-26',
      time: '01:00 PM',
      clientName: 'Sarah Jenkins',
      clientPhone: '+971 56 111 4455',
      agentName: 'Waqar Ahmed',
      location: 'Emirates NBD Main Branch',
      status: 'scheduled',
      priority: 'normal',
    }
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fs_calendar_events');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const savedIds = new Set(parsed.map(e => e.id));
          setEvents(prev => {
            const filteredDefaults = prev.filter(e => !savedIds.has(e.id));
            return [...parsed, ...filteredDefaults];
          });
        }
      }
    } catch (e) {
      console.error('Failed to load calendar events:', e);
    }
  }, []);

  const handleDeleteEvent = (id: string, title: string) => {
    Swal.fire({
      title: 'Delete Appointment?',
      text: `Are you sure you want to permanently delete "${title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Delete',
    }).then((result) => {
      if (result.isConfirmed) {
        setEvents(prev => {
          const updated = prev.filter(ev => ev.id !== id);
          localStorage.setItem('fs_calendar_events', JSON.stringify(updated));
          return updated;
        });
        Swal.fire('Deleted', 'Appointment removed.', 'success');
      }
    });
  };

  // Form State for Add Event Modal
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'viewing' as CalendarEvent['category'],
    date: '2026-08-24',
    time: '11:00 AM',
    clientName: '',
    clientPhone: '',
    agentName: 'Faraz Shafi',
    location: '',
    priority: 'normal' as CalendarEvent['priority'],
    notes: '',
  });

  // Calendar Date Math
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthName = currentMonthDate.toLocaleString('default', { month: 'long' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: (firstDayOfWeek + 6) % 7 }, (_, i) => i); // Mon = 0 start

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date(2026, 7, 24);
    setCurrentMonthDate(new Date(2026, 7, 1));
    setSelectedDateStr('2026-08-24');
  };

  const formatDateStr = (dayNum: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.clientName) {
      Swal.fire('Required Fields', 'Please enter Event Title and Client Name.', 'warning');
      return;
    }

    const created: CalendarEvent = {
      id: `ev-${Date.now()}`,
      ...newEvent,
      status: 'scheduled',
    };

    setEvents([created, ...events]);
    setIsAddModalOpen(false);
    setSelectedDateStr(newEvent.date);

    Swal.fire({
      icon: 'success',
      title: 'Appointment Scheduled!',
      text: `Scheduled "${newEvent.title}" for ${newEvent.date} at ${newEvent.time}.`,
      confirmButtonColor: '#081428',
    });

    // Reset Form
    setNewEvent({
      title: '',
      category: 'viewing',
      date: selectedDateStr,
      time: '11:00 AM',
      clientName: '',
      clientPhone: '',
      agentName: 'Faraz Shafi',
      location: '',
      priority: 'normal',
      notes: '',
    });
  };

  const handleMarkCompleted = (id: string) => {
    setEvents(events.map(ev => ev.id === id ? { ...ev, status: 'completed' } : ev));
    Swal.fire({
      icon: 'success',
      title: 'Appointment Completed',
      text: 'Event status updated to completed.',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const handleCancelEvent = (id: string) => {
    Swal.fire({
      title: 'Cancel Appointment?',
      text: 'Are you sure you want to cancel this scheduled appointment?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93838',
      cancelButtonColor: '#6E6E6E',
      confirmButtonText: 'Yes, Cancel Appointment',
    }).then((result) => {
      if (result.isConfirmed) {
        setEvents(events.map(ev => ev.id === id ? { ...ev, status: 'cancelled' } : ev));
        Swal.fire('Cancelled', 'The appointment has been marked as cancelled.', 'info');
      }
    });
  };

  // Filtered Events
  const filteredEvents = events.filter(ev => {
    const matchesDate = ev.date === selectedDateStr;
    const matchesCategory = activeCategory === 'all' || ev.category === activeCategory;
    return matchesDate && matchesCategory;
  });

  const getCategoryBadge = (cat: CalendarEvent['category']) => {
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

  // Stats Counters
  const selectedDayEvents = events.filter(ev => ev.date === selectedDateStr);
  const viewingCount = selectedDayEvents.filter(ev => ev.category === 'viewing').length;
  const spaCount = selectedDayEvents.filter(ev => ev.category === 'spa').length;
  const completedCount = selectedDayEvents.filter(ev => ev.status === 'completed').length;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Top Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <CalendarIcon className="w-4 h-4" />
                <span>06 — Appointments & Viewing Center</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                Appointments & Viewing Schedule
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Schedule client property tours, SPA contract signings, CMA valuations, and consultation meetings.
              </p>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#C8A147]" />
              <span>Schedule New Appointment</span>
            </button>
          </div>

          {/* KPI Overview Bar for Selected Date */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-[#E8E4DC] rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-[#6E6E6E] uppercase tracking-wider">Total Appointments</div>
                <div className="font-heading text-xl font-bold text-[#081428] mt-0.5">{selectedDayEvents.length}</div>
              </div>
              <CalendarDays className="w-6 h-6 text-[#C8A147]" />
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Property Tours</div>
                <div className="font-heading text-xl font-bold text-amber-900 mt-0.5">{viewingCount}</div>
              </div>
              <Building className="w-6 h-6 text-amber-700" />
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">SPA Signings</div>
                <div className="font-heading text-xl font-bold text-emerald-900 mt-0.5">{spaCount}</div>
              </div>
              <FileCheck className="w-6 h-6 text-emerald-700" />
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Completed Today</div>
                <div className="font-heading text-xl font-bold text-blue-900 mt-0.5">{completedCount}</div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-blue-700" />
            </div>
          </div>

          {/* Main Grid: Calendar Month View + Selected Day Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left 7 Cols: Month Interactive Grid */}
            <div className="lg:col-span-7 bg-white border border-[#E8E4DC] rounded-lg p-5 space-y-4 shadow-2xs">
              {/* Month Controls */}
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-lg text-[#081428]">
                    {monthName} {year}
                  </h2>
                  <button
                    onClick={handleToday}
                    className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 text-[#081428] font-bold text-[11px] rounded transition-colors"
                  >
                    Today
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 rounded text-[#081428] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 rounded text-[#081428] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-[#6E6E6E] uppercase tracking-wider pb-1">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
                <div>Sun</div>
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {paddingDays.map((_, idx) => (
                  <div key={`pad-${idx}`} className="h-14 bg-[#FAF8F5]/40 rounded opacity-30 border border-transparent"></div>
                ))}

                {daysArray.map(dayNum => {
                  const dateStr = formatDateStr(dayNum);
                  const isSelected = dateStr === selectedDateStr;
                  const isToday = dateStr === '2026-08-24';
                  const dayEvents = events.filter(e => e.date === dateStr);

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
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C8A147]"></span>
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
                              title={ev.title}
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

              {/* Legend Bar */}
              <div className="pt-3 border-t border-[#E8E4DC] flex items-center justify-between text-[11px] text-[#6E6E6E]">
                <div className="flex items-center gap-3">
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
              </div>
            </div>

            {/* Right 5 Cols: Selected Date Event Timeline */}
            <div className="lg:col-span-5 bg-white border border-[#E8E4DC] rounded-lg p-5 space-y-4 shadow-2xs flex flex-col">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div>
                  <h3 className="font-heading font-bold text-base text-[#081428]">
                    Timeline — {new Date(selectedDateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="text-[11px] text-[#6E6E6E]">
                    {filteredEvents.length} appointments scheduled
                  </div>
                </div>

                {/* Category Filter */}
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs font-semibold text-[#081428] focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="viewing">Property Tours</option>
                  <option value="spa">SPA Signings</option>
                  <option value="valuation">Valuations</option>
                  <option value="meeting">Meetings</option>
                </select>
              </div>

              {/* Events List */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px] pr-1">
                {filteredEvents.length === 0 ? (
                  <div className="p-10 border-2 border-dashed border-[#E8E4DC] rounded-lg text-center space-y-2">
                    <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="font-bold text-xs text-[#081428]">No Appointments Scheduled</div>
                    <p className="text-[11px] text-[#6E6E6E]">Click "Schedule New Appointment" to add a viewing or meeting for this date.</p>
                  </div>
                ) : (
                  filteredEvents.map((ev) => (
                    <div 
                      key={ev.id}
                      className={`p-4 rounded-lg border transition-all space-y-2.5 relative ${
                        ev.status === 'completed' ? 'bg-slate-50 border-slate-200 opacity-75' :
                        ev.status === 'cancelled' ? 'bg-red-50/40 border-red-200 opacity-60' :
                        'bg-[#FAF8F5] border-[#E8E4DC] hover:border-[#C8A147]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 bg-[#081428] text-[#C8A147] font-bold text-xs rounded font-mono shrink-0">
                            {ev.time}
                          </div>
                          {getCategoryBadge(ev.category)}
                        </div>

                        {ev.status === 'completed' && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase">Completed</span>
                        )}
                        {ev.status === 'cancelled' && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded uppercase">Cancelled</span>
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
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#C8A147]" />
                          <span>Client: <strong className="text-[#081428]">{ev.clientName}</strong></span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#C8A147]" />
                          <span>Advisor: <strong className="text-[#081428]">{ev.agentName}</strong></span>
                        </div>
                      </div>

                      {ev.location && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}

                      {/* Event Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E4DC]">
                        {ev.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleMarkCompleted(ev.id)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] rounded flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Done</span>
                            </button>
                            <button
                              onClick={() => handleCancelEvent(ev.id)}
                              className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[10px] rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteEvent(ev.id, ev.title)}
                          className="px-2 py-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-[10px] rounded transition-colors cursor-pointer flex items-center gap-1"
                          title="Delete appointment"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                          <span>Delete</span>
                        </button>
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
                <span className="font-heading font-bold text-sm">Schedule New Appointment</span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateEvent} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#081428] mb-1">Appointment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Property Tour — Downtown 2BR Apartment"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#081428] mb-1">Category</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  >
                    <option value="viewing">Property Tour (Viewing)</option>
                    <option value="spa">SPA Contract Signing</option>
                    <option value="valuation">CMA Valuation</option>
                    <option value="meeting">Client Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#081428] mb-1">Priority</label>
                  <select
                    value={newEvent.priority}
                    onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#081428] mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#081428] mb-1">Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:30 AM"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#081428] mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmed Al Mansoori"
                    value={newEvent.clientName}
                    onChange={(e) => setNewEvent({ ...newEvent, clientName: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#081428] mb-1">Client Phone</label>
                  <input
                    type="text"
                    placeholder="+971 50 123 4567"
                    value={newEvent.clientPhone}
                    onChange={(e) => setNewEvent({ ...newEvent, clientPhone: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#081428] mb-1">Location / Property Address</label>
                <input
                  type="text"
                  placeholder="e.g. Merano Tower, Business Bay, Dubai"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#081428] mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Special client requirements or viewing access notes..."
                  value={newEvent.notes}
                  onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded font-medium text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"
                ></textarea>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-bold rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-xs transition-colors cursor-pointer"
                >
                  Save & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
