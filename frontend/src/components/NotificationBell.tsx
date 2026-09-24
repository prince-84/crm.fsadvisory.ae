'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bell, Phone, PhoneCall, RotateCcw, Check, Copy, X, Clock, 
  Calendar, Volume2, VolumeX, RefreshCw, Sparkles, ExternalLink
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Swal from 'sweetalert2';

interface AlertItem {
  id: string;
  opportunity_id: number | null;
  contact_id: number;
  contact: any | null;
  client_name: string;
  phone: string;
  assigned_owner: string;
  next_action: string;
  call_outcome?: string | null;
  next_action_due_at: string;
  is_overdue: boolean;
  urgency: 'overdue' | 'imminent' | 'upcoming';
  diff_minutes: number;
  sla_status: string;
  status_label: string;
}

interface NotificationBellProps {
  onOpenContact?: (contact: any) => void;
}

export default function NotificationBell({ onOpenContact }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'urgent' | 'today'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const alertedIdsRef = useRef<Set<string>>(new Set());

  // Load sound & desktop permission settings on mount
  useEffect(() => {
    try {
      const storedSound = localStorage.getItem('crm_notification_sound');
      if (storedSound !== null) {
        setSoundEnabled(storedSound === 'true');
      }
    } catch {}

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopPermission(Notification.permission);
    }
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('crm_notification_sound', String(next));
    } catch {}
  };

  const requestDesktopPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setDesktopPermission(perm);
        if (perm === 'granted') {
          new Notification('FS Advisory CRM', {
            body: 'Desktop notifications for callbacks and follow-ups are now enabled!',
            icon: '/logo.svg',
          });
        }
      } catch (e) {
        console.error('Error requesting desktop notification permission:', e);
      }
    }
  };

  // Play audio chime for new due follow-ups
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Dual-tone chime: 587Hz (D5) -> 880Hz (A5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch {}
  }, [soundEnabled]);

  // Fetch upcoming follow-up & callback alerts from backend
  const fetchAlerts = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetchApi('/contacts/upcoming-alerts');
      if (res && Array.isArray(res.alerts)) {
        const rawAlerts: AlertItem[] = res.alerts;
        setAlerts(rawAlerts);
        setUnreadCount(res.unread_count || 0);

        // Check if any new urgent/imminent alerts arrived that haven't been alerted yet
        const urgentItems = rawAlerts.filter(a => a.urgency === 'overdue' || a.urgency === 'imminent');
        let hasNewUrgent = false;

        urgentItems.forEach(item => {
          if (!alertedIdsRef.current.has(item.id)) {
            alertedIdsRef.current.add(item.id);
            hasNewUrgent = true;

            // Trigger Desktop Notification if permission is granted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              const notif = new Notification(`${item.urgency === 'overdue' ? '🚨 Overdue' : '⏰ Callback Due'}: ${item.client_name}`, {
                body: `${item.phone ? `${item.phone} • ` : ''}${item.status_label}\n${item.next_action}`,
                icon: '/logo.svg',
                tag: item.id,
              });
              notif.onclick = () => {
                window.focus();
                handleOpenLead(item);
                notif.close();
              };
            }
          }
        });

        if (hasNewUrgent) {
          playChime();
        }
      }
    } catch (e) {
      console.error('Error fetching callback alerts:', e);
    } finally {
      if (isManual) setLoading(false);
    }
  }, [playChime]);

  // Initial fetch and 30-second polling interval
  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000);

    const handleRefresh = () => fetchAlerts();
    window.addEventListener('crm:contact-updated', handleRefresh);
    window.addEventListener('crm_call_logged', handleRefresh);
    window.addEventListener('crm:notification-bell-refresh', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('crm:contact-updated', handleRefresh);
      window.removeEventListener('crm_call_logged', handleRefresh);
      window.removeEventListener('crm:notification-bell-refresh', handleRefresh);
    };
  }, [fetchAlerts]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Snooze follow-up by 10 minutes
  const handleSnooze = async (alert: AlertItem, minutes = 10) => {
    try {
      await fetchApi(`/contacts/${alert.contact_id}/snooze-followup`, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      });

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
      Toast.fire({
        icon: 'success',
        title: `Snoozed by ${minutes}m for ${alert.client_name}`,
      });

      fetchAlerts();
      window.dispatchEvent(new CustomEvent('crm:contact-updated'));
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to snooze callback.', 'error');
    }
  };

  // Open Lead profile drawer
  const handleOpenLead = (alert: AlertItem) => {
    setIsOpen(false);
    const targetContact = alert.contact || {
      id: alert.contact_id,
      name: alert.client_name,
      phone: alert.phone,
      assigned_to: alert.assigned_owner,
    };

    if (onOpenContact) {
      onOpenContact(targetContact);
    }

    // Also dispatch global event so any active page drawer responds
    window.dispatchEvent(new CustomEvent('crm:open-contact-drawer', {
      detail: { contact: targetContact, contactId: alert.contact_id }
    }));
  };

  const copyPhone = (phone: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Filter alerts based on active filter tab and session dismissals
  const activeAlerts = alerts.filter(a => !dismissedIds.includes(a.id));
  const filteredAlerts = activeAlerts.filter(a => {
    if (filterTab === 'urgent') return a.urgency === 'overdue' || a.urgency === 'imminent';
    if (filterTab === 'today') return a.urgency === 'upcoming';
    return true;
  });

  const urgentCount = activeAlerts.filter(a => a.urgency === 'overdue' || a.urgency === 'imminent').length;
  const hasUrgent = urgentCount > 0;

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg border transition-all cursor-pointer select-none flex items-center justify-center ${
          isOpen
            ? 'bg-[#081428] text-[#C8A147] border-[#C8A147]'
            : hasUrgent
            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
            : 'bg-white hover:bg-[#FAF8F5] text-slate-700 hover:text-[#081428] border-slate-200'
        }`}
        title={
          hasUrgent
            ? `${urgentCount} Overdue / Due Callbacks! Click to view.`
            : activeAlerts.length > 0
            ? `${activeAlerts.length} Scheduled Follow-ups today`
            : 'Follow-up & Callback Notifications'
        }
      >
        <Bell className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${hasUrgent ? 'animate-bounce text-rose-600' : ''}`} />
        
        {/* Badge Counter */}
        {activeAlerts.length > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center border shadow-xs ${
            hasUrgent
              ? 'bg-rose-600 text-white border-white animate-pulse'
              : 'bg-[#C8A147] text-[#081428] border-white'
          }`}>
            {activeAlerts.length > 99 ? '99+' : activeAlerts.length}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[410px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-[#081428] via-[#0E203C] to-[#081428] text-white flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#C8A147]/20 border border-[#C8A147]/40 flex items-center justify-center text-[#C8A147]">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                  Follow-ups & Callbacks
                  {urgentCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-600 text-white">
                      {urgentCount} Urgent
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-300">Scheduled advisor reminders & alerts</p>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  soundEnabled ? 'text-[#C8A147] hover:bg-white/10' : 'text-slate-400 hover:bg-white/10'
                }`}
                title={soundEnabled ? 'Notification Sound Enabled (Click to mute)' : 'Muted (Click to unmute)'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
              </button>

              <button
                type="button"
                onClick={() => fetchAlerts(true)}
                disabled={loading}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Refresh Alerts"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C8A147]' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Desktop Push Prompt (if not granted) */}
          {desktopPermission === 'default' && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-[11px] text-amber-900">
              <span>Enable desktop popups for callbacks?</span>
              <button
                type="button"
                onClick={requestDesktopPermission}
                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
              >
                Allow
              </button>
            </div>
          )}

          {/* Segmented Filter Pills */}
          <div className="px-3 py-2 bg-[#FAF8F5] border-b border-[#E8E2D9] flex items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-[#081428] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                All ({activeAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('urgent')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterTab === 'urgent'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-100/60'
                }`}
              >
                <span>🔴 Urgent</span>
                <span>({urgentCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('today')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  filterTab === 'today'
                    ? 'bg-[#081428] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                📅 Today ({activeAlerts.filter(a => a.urgency === 'upcoming').length})
              </button>
            </div>

            {activeAlerts.length > 0 && (
              <button
                type="button"
                onClick={() => setDismissedIds(activeAlerts.map(a => a.id))}
                className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
              >
                Dismiss All
              </button>
            )}
          </div>

          {/* Alerts List */}
          <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 [scrollbar-width:thin] [scrollbar-color:#C8A147_#F1EFE9]">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="font-heading font-bold text-xs text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 max-w-[240px]">
                  {filterTab === 'urgent'
                    ? 'No overdue or imminent callbacks right now.'
                    : 'No pending follow-ups or callbacks scheduled for today.'}
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-3 transition-colors hover:bg-slate-50/80 ${
                    alert.urgency === 'overdue'
                      ? 'bg-rose-50/30'
                      : alert.urgency === 'imminent'
                      ? 'bg-amber-50/30'
                      : ''
                  }`}
                >
                  {/* Top row: Client name & Status pill */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenLead(alert)}
                      className="font-heading font-bold text-xs sm:text-sm text-[#081428] hover:text-[#C8A147] transition-colors truncate text-left cursor-pointer flex items-center gap-1 group"
                      title="Open Lead Profile"
                    >
                      <span className="truncate">{alert.client_name}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#C8A147] shrink-0" />
                    </button>

                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                      alert.urgency === 'overdue'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : alert.urgency === 'imminent'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {alert.status_label}
                    </span>
                  </div>

                  {/* Middle row: Phone & Owner info */}
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#C8A147] shrink-0" />
                      <span>{alert.phone || 'No phone'}</span>
                      {alert.phone && (
                        <button
                          type="button"
                          onClick={(e) => copyPhone(alert.phone, alert.id, e)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer ml-0.5"
                          title="Copy phone"
                        >
                          {copiedId === alert.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 font-sans">
                      {alert.assigned_owner || 'Unassigned'}
                    </span>
                  </div>

                  {/* Note / Action preview */}
                  <div className="mt-1.5 p-2 bg-[#F6F4EE] rounded-md border border-[#E8E2D9] text-[11px] text-slate-700 flex items-start gap-1.5">
                    <Clock className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                    <div className="truncate min-w-0">
                      <span className="font-semibold text-slate-800 mr-1">
                        {new Date(alert.next_action_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}:
                      </span>
                      <span className="text-slate-600">{alert.next_action}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenLead(alert)}
                      className="flex-1 py-1 px-2 bg-[#081428] hover:bg-[#0E203C] text-[#C8A147] hover:text-white font-bold text-xs rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <PhoneCall className="w-3 h-3 text-[#C8A147]" />
                      <span>Call & Open Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSnooze(alert, 10)}
                      className="py-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-xs rounded border border-amber-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Postpone callback by 10 minutes"
                    >
                      <RotateCcw className="w-3 h-3 text-amber-600" />
                      <span>Snooze 10m</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDismissedIds(prev => [...prev, alert.id])}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                      title="Dismiss from list"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-[#FAF8F5] border-t border-[#E8E2D9] flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {activeAlerts.length} {activeAlerts.length === 1 ? 'alert' : 'alerts'} for today
            </span>
            <span className="text-[10px] text-slate-400">
              Auto-refreshes every 30s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
