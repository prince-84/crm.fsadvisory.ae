'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, Phone, Mail, Clock, MessageSquare, 
  PhoneCall, Edit2, Target, Link2, ExternalLink, Copy, Check,
  Building2, Home, DollarSign, User, Sparkles, Plus, RefreshCw,
  Calendar, Layers, CheckCircle2, AlertCircle, Briefcase, FileText, UserCheck, ArrowRightLeft,
  FileAudio, PhoneIncoming, PhoneOutgoing, Send, Download
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { fetchApi } from '@/lib/api';
import { hasAnyPermission, getCurrentUser } from '@/lib/permissions';

const getPlayableAudioUrl = (url: string | null | undefined, recId?: number) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fsadvisory.ae/api';
  if (!url) {
    return recId ? `${API_BASE_URL}/3cx/recordings/${recId}/stream` : '';
  }
  if (url.includes('actions.google.com') || url.includes('ukits.3cx.ae')) {
    return recId ? `${API_BASE_URL}/3cx/recordings/${recId}/stream` : `${API_BASE_URL}/3cx/recordings/1/stream`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = API_BASE_URL.replace(/\/api$/, '');
  const clean = url.startsWith('/') ? url : `/${url}`;
  return `${backendBase}${clean}`;
};

interface ContactDrawerProps {
  contact: any | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateOpportunity?: (contact: any) => void;
  onEditLead?: (contact: any) => void;
  onQuickCall?: (contact: any) => void;
  onContactUpdated?: (updatedContact: any) => void;
}

export default function ContactDrawer({ 
  contact, 
  isOpen, 
  onClose, 
  onCreateOpportunity,
  onEditLead,
  onQuickCall,
  onContactUpdated
}: ContactDrawerProps) {
  const [liveContact, setLiveContact] = useState<any | null>(contact);
  const [isLoading, setIsLoading] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showSecondaryPhone, setShowSecondaryPhone] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeActivityTab, setActiveActivityTab] = useState<'calls' | 'recordings' | 'whatsapp' | 'all'>('calls');
  const [clientRecordings, setClientRecordings] = useState<any[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [clientChat, setClientChat] = useState<any | null>(null);
  const [whatsAppMessages, setWhatsAppMessages] = useState<any[]>([]);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [newWhatsAppMsg, setNewWhatsAppMsg] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [reassigning, setReassigning] = useState(false);

  // Load active agents list for re-assignment
  useEffect(() => {
    if (isOpen) {
      fetchApi('/users')
        .then((res) => {
          if (res.success && res.users) {
            setActiveAgents(res.users.filter((u: any) => u.is_active));
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Load voice recordings for this contact
  const fetchClientRecordings = useCallback(async (contactId: number) => {
    if (!contactId) return;
    setLoadingRecordings(true);
    try {
      const res = await fetchApi(`/recordings?contact_id=${contactId}&per_page=50`);
      if (res && res.recordings && res.recordings.data) {
        setClientRecordings(res.recordings.data);
      } else if (res && res.data) {
        setClientRecordings(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch voice recordings:', err);
    } finally {
      setLoadingRecordings(false);
    }
  }, []);

  // Load WhatsApp conversation history for this contact
  const fetchClientWhatsApp = useCallback(async (contactId: number) => {
    if (!contactId) return;
    setLoadingWhatsApp(true);
    try {
      const res = await fetchApi(`/whatsapp/contact-history?contact_id=${contactId}`);
      if (res && res.success) {
        setClientChat(res.chat || null);
        setWhatsAppMessages(res.messages || []);
      }
    } catch (err) {
      console.warn('Failed to fetch WhatsApp history:', err);
    } finally {
      setLoadingWhatsApp(false);
    }
  }, []);

  // Send WhatsApp message directly from drawer
  const handleSendDrawerWhatsApp = async () => {
    if (!newWhatsAppMsg.trim() || !liveContact) return;
    setSendingWhatsApp(true);
    try {
      const phone = liveContact.phone || '';
      if (clientChat?.id) {
        await fetchApi(`/whatsapp/chats/${clientChat.id}/send`, {
          method: 'POST',
          body: JSON.stringify({ text: newWhatsAppMsg.trim() }),
        });
      } else {
        await fetchApi('/whatsapp/chats/start', {
          method: 'POST',
          body: JSON.stringify({
            phone: phone,
            contact_name: liveContact.name,
            initial_message: newWhatsAppMsg.trim(),
          }),
        });
      }
      setNewWhatsAppMsg('');
      await fetchClientWhatsApp(liveContact.id);
    } catch (err: any) {
      Swal.fire('WhatsApp Error', err.message || 'Failed to send WhatsApp message.', 'error');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Load fresh contact details from database whenever drawer opens or contact changes
  const fetchLiveContact = useCallback(async (contactId: number) => {
    if (!contactId) return;
    setIsLoading(true);
    try {
      const data = await fetchApi(`/contacts/${contactId}`);
      if (data && data.id) {
        setLiveContact(data);
      }
    } catch (err) {
      console.error('Failed to load contact details:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && contact?.id) {
      setLiveContact(contact);
      setShowPhone(false);
      setShowSecondaryPhone(false);
      fetchLiveContact(contact.id);
      fetchClientRecordings(contact.id);
      fetchClientWhatsApp(contact.id);
    } else if (!isOpen) {
      setLiveContact(null);
      setClientRecordings([]);
      setWhatsAppMessages([]);
      setClientChat(null);
    }
  }, [isOpen, contact?.id, fetchLiveContact, fetchClientRecordings, fetchClientWhatsApp]);

  // Sync live contact whenever contact prop updates from parent
  useEffect(() => {
    if (isOpen && contact) {
      setLiveContact(contact);
    }
  }, [isOpen, contact]);

  // Auto-refresh drawer activities whenever a call log or activity is updated anywhere in the CRM
  useEffect(() => {
    const handleRemoteUpdate = (e: any) => {
      const updatedId = e.detail?.contactId;
      if (isOpen && contact?.id && (!updatedId || Number(updatedId) === Number(contact.id))) {
        fetchLiveContact(contact.id);
        fetchClientRecordings(contact.id);
        fetchClientWhatsApp(contact.id);
      }
    };
    window.addEventListener('crm:contact-updated', handleRemoteUpdate);
    return () => {
      window.removeEventListener('crm:contact-updated', handleRemoteUpdate);
    };
  }, [isOpen, contact?.id, fetchLiveContact, fetchClientRecordings, fetchClientWhatsApp]);

  if (!isOpen || !liveContact) return null;

  const currentContact = liveContact;
  const canReassign = hasAnyPermission(['leads.reassign', 'leads.assign']);

  // Identify active opportunity if one exists
  const rawOpp = currentContact.opportunities?.find((o: any) => o.stage !== 'closed_won' && o.stage !== 'closed_lost') 
    || currentContact.active_opportunity;
  const activeOpp = (rawOpp && Number(rawOpp.id) > 0 && rawOpp.has_opportunity !== false) ? rawOpp : null;
  const qual = activeOpp?.buyer_qualification || {};

  // Extract inquiry specs parsed by backend virtual attribute or direct properties
  const specs = currentContact.inquiry_specs || {};

  // Helpers
  const maskPhone = (phoneStr: string) => {
    if (!phoneStr) return '************';
    return phoneStr.replace(/\d/g, '*');
  };

  const copyToClipboard = (text: string, fieldId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${mins}`;
    } catch {
      return String(dateStr);
    }
  };

  const handleReassignLead = async () => {
    if (!canReassign) {
      Swal.fire({
        title: 'Access Restricted',
        text: 'You do not have permission to re-assign leads (Required key: leads.reassign). Please contact your administrator.',
        icon: 'warning',
        confirmButtonColor: '#081428',
      });
      return;
    }

    const currentOwner = currentContact.assigned_to || currentContact.assigned_owner_name || 'Unassigned';
    const agentsList = activeAgents.length > 0
      ? activeAgents
      : [{ id: 0, name: 'Faraz Shafi', role: 'Super Admin' }];

    const agentOptionsHtml = agentsList
      .map((ag) => `<option value="${ag.name}" ${ag.name === currentOwner ? 'selected' : ''}>${ag.name} (${ag.role || 'Advisor'})</option>`)
      .join('');

    const { value: selectedAdvisor } = await Swal.fire({
      title: `<div class="text-[#081428] font-bold text-base">Re-assign Lead Ownership</div>`,
      html: `
        <div class="space-y-3.5 text-left p-1 text-xs font-['Poppins',sans-serif]">
          <div class="text-[11px] text-[#6E6E6E] bg-slate-50 p-2.5 rounded border border-[#E8E4DC]">
            Transfer client <strong>${currentContact.name}</strong> and all associated opportunities to another sales advisor. An audit log will be permanently recorded.
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Current Owner</label>
            <div class="p-2 bg-slate-100 rounded text-slate-700 font-semibold text-xs border border-slate-200">
              ${currentOwner}
            </div>
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Select New Advisor / Owner</label>
            <select id="swal-reassign-select" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-semibold focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="">-- Choose Sales Advisor --</option>
              ${agentOptionsHtml}
              <option value="Unassigned">Unassigned (Return to Available Pool)</option>
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Confirm Re-assign',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#C8A147',
      cancelButtonColor: '#6B7280',
      preConfirm: () => {
        const select = document.getElementById('swal-reassign-select') as HTMLSelectElement | null;
        const val = select?.value?.trim();
        if (!val) {
          Swal.showValidationMessage('Please select an advisor or Unassigned.');
          return false;
        }
        if (val === currentOwner) {
          Swal.showValidationMessage('Lead is already assigned to this advisor.');
          return false;
        }
        return val;
      }
    });

    if (!selectedAdvisor) return;

    setReassigning(true);
    try {
      const currentUser = getCurrentUser();
      const res = await fetchApi(`/contacts/${currentContact.id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          assigned_owner: selectedAdvisor,
          assigned_by: currentUser?.name || 'Admin',
        }),
      });

      if (res.success) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Lead re-assigned to ${selectedAdvisor}`,
          showConfirmButton: false,
          timer: 3000,
        });

        if (res.contact) {
          setLiveContact(res.contact);
          if (onContactUpdated) onContactUpdated(res.contact);
        } else {
          fetchLiveContact(currentContact.id);
          if (onContactUpdated) onContactUpdated({ ...currentContact, assigned_to: selectedAdvisor });
        }
      } else {
        throw new Error(res.message || 'Failed to re-assign lead');
      }
    } catch (err: any) {
      Swal.fire('Re-assignment Failed', err.message || 'An error occurred during re-assignment.', 'error');
    } finally {
      setReassigning(false);
    }
  };

  const formatCurrencyAED = (val: number | string | null | undefined) => {
    if (!val) return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num) || num <= 0) return null;
    if (num >= 1000000) {
      return `AED ${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    return `AED ${num.toLocaleString()}`;
  };

  // Internal Quick Call Logger using SweetAlert2 connected directly to DB
  const handleLogCallInternal = async () => {
    if (onQuickCall) {
      await onQuickCall(currentContact);
      if (currentContact?.id) {
        await fetchLiveContact(currentContact.id);
      }
      return;
    }

    const now = new Date();
    const nowLocalIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const tomorrowLocalIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const { value: formValues } = await Swal.fire({
      title: `<div class="text-[#081428] font-bold text-base">Log Call Outcome — ${currentContact.name}</div>`,
      html: `
        <div class="space-y-3.5 text-left p-1 text-xs font-['Poppins',sans-serif]">
          <div class="text-[11px] text-[#6E6E6E] bg-[#FAF8F5] p-2.5 rounded border border-[#E8E4DC]">
            📞 Dial client at <strong>${currentContact.phone}</strong>. Record call outcome and notes to save to CRM database immediately.
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Call Outcome</label>
            <select id="drawer-swal-outcome" class="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="Interested">Interested</option>
              <option value="Callback">Callback</option>
              <option value="Follow-up">Follow-up</option>
              <option value="No Answer">No Answer</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Wrong Number">Wrong Number</option>
            </select>
          </div>
          <div id="drawer-swal-schedule-box">
            <label class="block text-[#081428] font-bold mb-1">Next Follow-up & SLA Schedule</label>
            <select id="drawer-swal-schedule" class="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none">
              <option value="24h">📅 Tomorrow at Same Time (24h) — [On Track 🟢]</option>
              <option value="15m">⚡ Quick Callback in 15 mins — [Due Soon 🟡]</option>
              <option value="2h">⏰ Later Today (in 2 hours) — [On Track 🟢]</option>
              <option value="5h">⏳ In 5 Hours — [On Track 🟢]</option>
              <option value="48h">📆 In 2 Days — [On Track 🟢]</option>
              <option value="custom">🗓️ Pick Specific Date & Time (Calendar)</option>
              <option value="now">🚨 Immediate Escalation (Now) — [Overdue 🔴]</option>
            </select>
            <div id="drawer-custom-datetime-container" style="display: none;" class="mt-2.5 p-2.5 bg-amber-50/50 border border-amber-200 rounded text-left">
              <label class="block text-[#081428] font-semibold text-[11px] mb-1">🗓️ Choose Custom Follow-up Date & Time:</label>
              <input type="datetime-local" id="drawer-custom-datetime" value="${tomorrowLocalIso}" min="${nowLocalIso}" class="w-full p-2 bg-white border border-[#C8A147] rounded text-xs text-[#081428] font-mono focus:ring-2 focus:ring-[#C8A147] focus:outline-none" />
              <p class="text-[10px] text-slate-500 mt-1">SLA alert will trigger 10 minutes prior to scheduled time.</p>
            </div>
          </div>
          <div>
            <label class="block text-[#081428] font-bold mb-1">Call Discussion Notes</label>
            <textarea id="drawer-swal-notes" rows="3" placeholder="Enter key conversation points, requirements, or next steps..." class="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"></textarea>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save Call to Database',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16A34A',
      cancelButtonColor: '#6E6E6E',
      didOpen: (popup) => {
        const outcomeSel = popup.querySelector('#drawer-swal-outcome') as HTMLSelectElement | null;
        const scheduleBox = popup.querySelector('#drawer-swal-schedule-box') as HTMLElement | null;
        const scheduleSelect = popup.querySelector('#drawer-swal-schedule') as HTMLSelectElement | null;
        const customContainer = popup.querySelector('#drawer-custom-datetime-container') as HTMLElement | null;

        if (scheduleSelect && customContainer) {
          const toggleCustom = () => {
            customContainer.style.display = scheduleSelect.value === 'custom' ? 'block' : 'none';
          };
          scheduleSelect.addEventListener('change', toggleCustom);
          toggleCustom();
        }

        if (outcomeSel && scheduleBox) {
          const toggle = () => {
            const isTerminal = outcomeSel.value.includes('Not Interested') || outcomeSel.value.includes('Wrong Number');
            scheduleBox.style.display = isTerminal ? 'none' : 'block';
          };
          outcomeSel.addEventListener('change', toggle);
          toggle();
        }
      },
      preConfirm: () => {
        const outcome = (document.getElementById('drawer-swal-outcome') as HTMLSelectElement)?.value;
        const schedule = (document.getElementById('drawer-swal-schedule') as HTMLSelectElement)?.value;
        const customDateTime = (document.getElementById('drawer-custom-datetime') as HTMLInputElement)?.value;
        const notes = (document.getElementById('drawer-swal-notes') as HTMLTextAreaElement)?.value;
        if (!notes || !notes.trim()) {
          Swal.showValidationMessage('Please enter call notes before saving.');
          return false;
        }
        const isTerminal = outcome?.includes('Not Interested') || outcome?.includes('Wrong Number');

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

      let storedUser: any = null;
      try {
        const u = localStorage.getItem('crm_user');
        if (u) storedUser = JSON.parse(u);
      } catch (e) {}

      try {
        await fetchApi('/activities', {
          method: 'POST',
          body: JSON.stringify({
            contact_id: currentContact.id,
            opportunity_id: activeOpp?.id || null,
            type: 'call',
            call_outcome: formValues.outcome,
            description: `Quick Call: ${formValues.outcome} — ${formValues.notes}`,
            user_name: storedUser?.name || 'Advisor',
            next_action: formValues.isTerminal ? `Closed: ${formValues.outcome}` : `Follow-up: ${formValues.outcome}`,
            next_action_due_at: dueAt ? dueAt.toISOString() : null,
          }),
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
          title: 'Call logged to database!',
        });

        // Refresh live contact from DB
        await fetchLiveContact(currentContact.id);
        if (onContactUpdated) {
          onContactUpdated(currentContact);
        }
        window.dispatchEvent(new CustomEvent('crm:contact-updated', { detail: { contactId: currentContact.id } }));
      } catch (err: any) {
        Swal.fire('Error', err.message || 'Failed to save call activity.', 'error');
      }
    }
  };

  // Outcome badge styling
  const getOutcomeBadgeClass = (outcome: string | null | undefined) => {
    if (!outcome) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (outcome.includes('Interested') || outcome.includes('Viewing')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    }
    if (outcome.includes('Callback')) {
      return 'bg-amber-50 text-amber-800 border-amber-300';
    }
    if (outcome.includes('Follow-up')) {
      return 'bg-blue-50 text-blue-800 border-blue-300';
    }
    if (outcome.includes('No Answer') || outcome.includes('Voicemail')) {
      return 'bg-rose-50 text-rose-800 border-rose-300';
    }
    if (outcome.includes('Not Interested') || outcome.includes('Wrong Number')) {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }
    return 'bg-amber-50 text-amber-800 border-amber-200';
  };

  // All activities from contact and opportunities combined & deduplicated
  const rawActivities: any[] = [
    ...(currentContact.activities || []),
    ...(activeOpp?.activities || [])
  ];
  
  // Deduplicate by ID
  const activityMap = new Map<number, any>();
  rawActivities.forEach(a => {
    if (a && a.id && !activityMap.has(a.id)) {
      activityMap.set(a.id, a);
    }
  });

  const sortedActivities = Array.from(activityMap.values()).sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Filter out automated system/robotic logs so only genuine agent updates and assignment history are shown
  const isSystemTechnicalLog = (act: any) => {
    if (!act) return false;
    const desc = (act.description || '').toLowerCase();
    const user = (act.user_name || '').toLowerCase();
    const type = (act.type || '').toLowerCase();

    // Calls with outcomes are always genuine human activities
    if (type === 'call' || !!act.call_outcome) return false;

    // Ownership and Assignment changes must be shown so advisors see who assigned the lead
    if (type === 'ownership_change') return false;

    // Automated system bots
    if (user === 'lead engine' || user === 'system agent' || user === 'system / webhook' || user === 'system') return true;

    // Automated ingestion and filler text patterns
    if (desc.startsWith('initial inquiry requirements:') || desc.startsWith('initial inquiry details:')) return true;
    if (desc.includes('new lead registered') || desc.includes('placed in new leads pool')) return true;
    if (desc.includes('client submitted get in touch')) return true;
    if (desc.includes('duplicate status') || desc.includes('duplicate contact created') || desc.includes('routed to duplicate tab')) return true;
    if (desc.includes('updated client contact profile details')) return true;

    return false;
  };

  const humanActivities = sortedActivities.filter(a => !isSystemTechnicalLog(a));
  const callActivities = humanActivities.filter(a => a.type === 'call' || !!a.call_outcome);

  const displayedActivities = activeActivityTab === 'calls' ? callActivities : humanActivities;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-2xs transition-opacity animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white border-l border-[#E8E4DC] shadow-2xl flex flex-col">
          
          {/* Top Contact Profile Header */}
          <div className="p-6 border-b border-[#E8E4DC] relative bg-[#FAF8F5]">
            <button 
              onClick={onClose} 
              className="absolute right-5 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Bar Navigation / Quick Actions */}
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E8E4DC]/80 pr-8">
              <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>LEAD CONTACT PROFILE</span>
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchLiveContact(currentContact.id)}
                  className={`text-[11px] font-semibold text-[#6E6E6E] hover:text-[#081428] flex items-center gap-1 transition-colors ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                  title="Reload real-time data from database"
                >
                  <RefreshCw className={`w-3 h-3 text-[#C8A147] ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <Link
                  href={`/leads/${currentContact.id}/edit`}
                  onClick={onClose}
                  className="text-[11px] font-semibold text-[#6E6E6E] hover:text-[#081428] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-[#C8A147]" />
                  <span>Edit</span>
                </Link>
              </div>
            </div>

            {/* Avatar & Key Profile Info */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[#081428] border-2 border-[#C8A147]/50 text-white font-heading font-bold text-lg flex items-center justify-center shadow-md shrink-0">
                {currentContact.initials || currentContact.name?.substring(0, 2).toUpperCase() || 'LD'}
              </div>
              
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-heading font-bold text-lg text-[#081428] truncate max-w-[210px]" title={currentContact.name}>
                    {currentContact.name}
                  </h2>
                  {currentContact.state === 'duplicate' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-300">
                      <Copy className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                      <span>Duplicate</span>
                    </span>
                  )}
                  {!currentContact.is_imported && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Inbound
                    </span>
                  )}
                </div>

                <div className="text-xs text-[#6E6E6E] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#081428]">{currentContact.nationality || 'UAE Resident'}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] text-slate-500">English / Arabic</span>
                  </div>
                  
                  {/* Primary Phone Mask / Reveal & Direct Copy */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <div 
                      onClick={() => setShowPhone(!showPhone)}
                      className="flex items-center gap-1.5 font-medium text-[#081428] cursor-pointer select-none group"
                      title={showPhone ? "Click to hide phone" : "Click to reveal phone"}
                    >
                      <Phone className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                      <span className="font-mono text-xs group-hover:text-[#C8A147] transition-colors">
                        {showPhone ? currentContact.phone : maskPhone(currentContact.phone)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => copyToClipboard(currentContact.phone, 'phone', e)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                      title="Copy phone number"
                    >
                      {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Secondary Phone if available */}
                  {currentContact.secondary_phone && (
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={() => setShowSecondaryPhone(!showSecondaryPhone)}
                        className="flex items-center gap-1.5 font-medium text-slate-600 cursor-pointer select-none group"
                        title={showSecondaryPhone ? "Click to hide secondary phone" : "Click to reveal secondary phone"}
                      >
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono text-[11px] group-hover:text-[#C8A147] transition-colors">
                          {showSecondaryPhone ? currentContact.secondary_phone : maskPhone(currentContact.secondary_phone)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => copyToClipboard(currentContact.secondary_phone, 'secondary_phone', e)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copy secondary phone"
                      >
                        {copiedField === 'secondary_phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}

                  {/* Email & Direct Copy */}
                  {currentContact.email && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#6E6E6E] truncate max-w-[240px]">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{currentContact.email}</span>
                      </div>
                      <button
                        onClick={(e) => copyToClipboard(currentContact.email, 'email', e)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copy email address"
                      >
                        {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metadata Bar */}
            <div className="mt-4 pt-3 border-t border-[#E8E4DC]/80 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium uppercase">Created Date</span>
                <span className="font-semibold text-[#081428] flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3 text-[#C8A147]" />
                  {formatDateTime(currentContact.created_at)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium uppercase">Assigned Advisor</span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="font-semibold text-[#081428] flex items-center gap-1 truncate text-xs">
                    <User className="w-3 h-3 text-[#C8A147] shrink-0" />
                    <span className="truncate">{currentContact.assigned_to || currentContact.assigned_owner_name || 'Unassigned'}</span>
                  </span>
                  {canReassign && (
                    <button
                      type="button"
                      onClick={handleReassignLead}
                      disabled={reassigning}
                      className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-amber-50 hover:bg-[#C8A147] text-[#C8A147] hover:text-[#081428] border border-[#C8A147]/60 rounded transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                      title="Re-assign this lead to another sales advisor"
                    >
                      <ArrowRightLeft className="w-2.5 h-2.5 shrink-0" />
                      <span>{reassigning ? '...' : 'Re-assign'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white text-xs">
            
            {/* 1. DEAL QUALIFICATION & OPPORTUNITY STATUS (Replacing old My Queue block) */}
            {activeOpp ? (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>ACTIVE DEAL / OPPORTUNITY</span>
                  </span>
                  <Link 
                    href={`/opportunities/${activeOpp.id}`}
                    onClick={onClose}
                    className="text-[11px] font-semibold text-[#6E6E6E] hover:text-[#081428] flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-[#C8A147]" />
                    <span>Open Deal</span>
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#D93838]" />
                    <span className="font-bold text-[#081428] text-xs">
                      {activeOpp.opportunity_type ? activeOpp.opportunity_type.charAt(0).toUpperCase() + activeOpp.opportunity_type.slice(1) : 'Buyer'} · <span className="text-[#D93838] uppercase">{activeOpp.temperature || 'HOT'}</span>
                    </span>
                    <span className="ml-auto text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {activeOpp.stage?.replace(/_/g, ' ') || 'New'}
                    </span>
                  </div>

                  {(activeOpp.budget_min || activeOpp.budget_max) && (
                    <div className="font-bold text-[#081428] text-sm">
                      {formatCurrencyAED(activeOpp.budget_min)} – {formatCurrencyAED(activeOpp.budget_max)}
                    </div>
                  )}

                  <div className="text-xs text-[#6E6E6E]">
                    {qual.community || specs.community || 'Dubai Area'} – {qual.bedrooms || specs.bedrooms || '2BR'} {qual.property_type || specs.property_type || 'Apartment'}
                  </div>

                  {/* Score Progress Bar */}
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-[#6E6E6E]">Qualification Score {qual.lead_score || 84} / 100</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#E8E4DC] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#C8A147] rounded-full transition-all" 
                        style={{ width: `${qual.lead_score || 84}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Direct Action Link */}
                <div className="pt-2">
                  <Link 
                    href={`/opportunities/${activeOpp.id}`}
                    onClick={onClose}
                    className="w-full py-2 bg-[#081428] hover:bg-[#122444] text-white font-semibold text-xs rounded-md text-center block transition-colors shadow-xs"
                  >
                    View Opportunity Workspace
                  </Link>
                </div>

                {/* Multi-Deal List if client has multiple opportunities */}
                {Array.isArray(currentContact.opportunities) && currentContact.opportunities.length > 1 && (
                  <div className="pt-3 border-t border-[#E8E4DC] space-y-2">
                    <div className="text-[11px] font-bold text-[#081428] uppercase flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#C8A147]">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>All Deals for this Client ({currentContact.opportunities.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onCreateOpportunity) onCreateOpportunity(currentContact);
                          else window.location.href = `/opportunities/create?contact_id=${currentContact.id}`;
                        }}
                        className="text-[10px] font-bold text-[#C8A147] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" /> New Deal
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {currentContact.opportunities
                        .filter((o: any) => o.id !== activeOpp.id)
                        .map((o: any) => (
                          <Link
                            key={o.id}
                            href={`/opportunities/${o.id}`}
                            onClick={onClose}
                            className="p-2 bg-white hover:bg-slate-50 border border-[#E8E4DC] rounded-md flex items-center justify-between text-xs transition-colors block"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[#081428] truncate text-xs">
                                {o.project || o.community || o.title || 'Dubai Deal'}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                {o.budget_min ? (
                                  <span className="font-mono text-emerald-700 font-semibold">AED {(Number(o.budget_min) / 1000000).toFixed(1)}M</span>
                                ) : null}
                                <span>·</span>
                                <span>{o.current_owner_name ? `Owner: ${o.current_owner_name}` : 'Unassigned'}</span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                              {(o.stage || 'new').replace('_', ' ')}
                            </span>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>LEAD STATUS & QUALIFICATION</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                    {currentContact.state || 'Available'}
                  </span>
                </div>

                <p className="text-[11px] text-[#6E6E6E]">
                  This lead is active in the pool. Qualify buyer requirements directly to open a dedicated deal.
                </p>

                {/* Scheduled Follow-up Banner if set */}
                {(currentContact.next_action_due_at || activeOpp?.next_action_due_at) && (
                  <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-md flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-950 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#C8A147]" />
                        <span>Scheduled Follow-up</span>
                      </span>
                      <span className="text-xs font-semibold text-[#081428] block mt-0.5">
                        {currentContact.next_action || activeOpp?.next_action || 'Follow-up Call'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono font-bold text-[#081428] block">
                        {formatDateTime(currentContact.next_action_due_at || activeOpp?.next_action_due_at)}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border inline-block mt-0.5 ${
                        (currentContact.sla_status || activeOpp?.sla_status) === 'overdue'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : (currentContact.sla_status || activeOpp?.sla_status) === 'due_soon'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {(currentContact.sla_status || activeOpp?.sla_status || 'on_track').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Direct 1-Click Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (onCreateOpportunity) {
                        onCreateOpportunity(currentContact);
                      } else {
                        window.location.href = `/opportunities/create?contact_id=${currentContact.id}`;
                      }
                    }}
                    className="py-2.5 px-3 bg-[#081428] hover:bg-[#122444] text-white font-semibold text-xs rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>Qualify Deal</span>
                  </button>

                  <button
                    onClick={handleLogCallInternal}
                    className="py-2.5 px-3 bg-white hover:bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-md border border-emerald-300 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Log Call</span>
                  </button>
                </div>
              </div>
            )}



            {/* 3. CAMPAIGN ATTRIBUTION & LEAD SOURCE */}
            {(currentContact.source || currentContact.utm_source || currentContact.utm_campaign || currentContact.landing_page_url || currentContact.campaign_url) && (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>CAMPAIGN ATTRIBUTION</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">SOURCE</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Channel</span>
                    <span className="font-semibold text-[#081428] block truncate" title={currentContact.source}>
                      {currentContact.source || 'Website / Direct'}
                    </span>
                  </div>

                  {currentContact.sub_source && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Sub-Source</span>
                      <span className="font-semibold text-[#081428] block truncate" title={currentContact.sub_source}>
                        {currentContact.sub_source}
                      </span>
                    </div>
                  )}

                  {currentContact.utm_source && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">UTM Source</span>
                      <span className="font-semibold text-[#081428]">{currentContact.utm_source}</span>
                    </div>
                  )}

                  {currentContact.utm_medium && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Medium</span>
                      <span className="font-semibold text-[#081428]">{currentContact.utm_medium}</span>
                    </div>
                  )}

                  {currentContact.utm_campaign && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC] col-span-2">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Campaign</span>
                      <span className="font-semibold text-[#081428] truncate block" title={currentContact.utm_campaign}>
                        {currentContact.utm_campaign}
                      </span>
                    </div>
                  )}

                  {(currentContact.landing_page_url || currentContact.campaign_url) && (
                    <div className="bg-white p-2.5 rounded border border-[#E8E4DC] col-span-2 space-y-1">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-[#C8A147]" />
                          <span>Campaign Landing Page</span>
                        </span>
                        <a
                          href={currentContact.campaign_url || currentContact.landing_page_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#C8A147] hover:underline flex items-center gap-0.5 lowercase text-[10px]"
                        >
                          <span>Open URL</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </span>
                      <a
                        href={currentContact.campaign_url || currentContact.landing_page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 font-mono break-all line-clamp-2 block underline underline-offset-2"
                      >
                        {currentContact.campaign_url || currentContact.landing_page_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. REAL CALL ACTIVITY & CRM TIMELINE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider text-[#081428] uppercase flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>CALL ACTIVITY & LOGS</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#FAF8F5] text-[#6E6E6E] border border-[#E8E4DC] rounded-full">
                    {callActivities.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogCallInternal}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Log Call</span>
                  </button>
                </div>
              </div>

              {/* Activity Filter Tabs */}
              <div className="flex items-center justify-between border-b border-[#E8E4DC]/60 pb-1.5 gap-2 overflow-x-auto">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveActivityTab('calls')}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap ${
                      activeActivityTab === 'calls' 
                        ? 'bg-[#081428] text-white' 
                        : 'text-[#6E6E6E] hover:bg-slate-100'
                    }`}
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span>Calls ({callActivities.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveActivityTab('recordings')}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap ${
                      activeActivityTab === 'recordings' 
                        ? 'bg-[#081428] text-white' 
                        : 'text-[#6E6E6E] hover:bg-slate-100'
                    }`}
                  >
                    <FileAudio className="w-2.5 h-2.5 text-[#C8A147]" />
                    <span>Recordings ({clientRecordings.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveActivityTab('whatsapp')}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap ${
                      activeActivityTab === 'whatsapp' 
                        ? 'bg-[#081428] text-white' 
                        : 'text-[#6E6E6E] hover:bg-slate-100'
                    }`}
                  >
                    <MessageSquare className="w-2.5 h-2.5 text-emerald-500" />
                    <span>WhatsApp ({whatsAppMessages.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveActivityTab('all')}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap ${
                      activeActivityTab === 'all' 
                        ? 'bg-[#081428] text-white' 
                        : 'text-[#6E6E6E] hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-2.5 h-2.5" />
                    <span>All Activity ({humanActivities.length})</span>
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              {activeActivityTab === 'recordings' ? (
                <div className="space-y-3">
                  {loadingRecordings ? (
                    <div className="p-6 text-center text-xs text-[#6E6E6E]">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#C8A147] mx-auto mb-1.5" />
                      <span>Loading voice recordings...</span>
                    </div>
                  ) : clientRecordings.length > 0 ? (
                    clientRecordings.map((rec: any) => {
                      const isOutbound = rec.direction === 'outbound';
                      const durMins = Math.floor((rec.duration_seconds || 0) / 60);
                      const durSecs = (rec.duration_seconds || 0) % 60;
                      const durStr = `${String(durMins).padStart(2, '0')}:${String(durSecs).padStart(2, '0')}`;
                      const playUrl = getPlayableAudioUrl(rec.audio_url, rec.id);

                      return (
                        <div key={rec.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-2 text-xs shadow-2xs">
                          <div className="flex items-center justify-between flex-wrap gap-1.5 border-b border-[#E8E4DC]/60 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              {isOutbound ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                                  <PhoneOutgoing className="w-2.5 h-2.5" /> Outbound
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-0.5">
                                  <PhoneIncoming className="w-2.5 h-2.5" /> Inbound
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-slate-500 font-semibold">
                                {rec.pbx_call_id || `REC-${rec.id}`}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                                {durStr}
                              </span>
                            </div>

                            <span className="text-[10px] text-[#6E6E6E] font-mono">
                              {rec.recorded_at ? formatDateTime(rec.recorded_at) : '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-700">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-[#C8A147]" />
                              <span>Advisor: <strong className="text-[#081428]">{rec.agent_name || 'Advisor'}</strong></span>
                              <span className="text-slate-400 font-mono">(Ext {rec.agent_extension || '1030'})</span>
                            </div>
                            {rec.call_outcome && (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${getOutcomeBadgeClass(rec.call_outcome)}`}>
                                {rec.call_outcome}
                              </span>
                            )}
                          </div>

                          {/* Audio Player */}
                          <div className="pt-1">
                            <audio controls preload="none" src={playUrl} className="w-full h-8 rounded" />
                          </div>

                          {rec.notes && (
                            <div className="text-[11px] text-[#6E6E6E] bg-white p-2 rounded border border-[#E8E4DC] leading-relaxed">
                              {rec.notes}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 bg-[#FAF8F5] border border-dashed border-[#E8E4DC] rounded-lg text-center space-y-2">
                      <FileAudio className="w-6 h-6 text-slate-400 mx-auto" />
                      <div className="text-xs font-semibold text-[#081428]">No Call Recordings Found</div>
                      <p className="text-[11px] text-[#6E6E6E]">
                        Calls placed or received with this client will automatically archive here with audio playback.
                      </p>
                    </div>
                  )}
                </div>
              ) : activeActivityTab === 'whatsapp' ? (
                <div className="space-y-3">
                  {/* Top Bar with Open in WhatsApp Web */}
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-[#E8E4DC]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">
                        WA
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-[#081428] block">{currentContact.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{currentContact.phone}</span>
                      </div>
                    </div>

                    <Link
                      href={`/whatsapp?phone=${encodeURIComponent(currentContact.phone || '')}&name=${encodeURIComponent(currentContact.name || '')}`}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                      title="Open full chat in WhatsApp Command Center"
                    >
                      <span>Open Full Chat</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Messages Feed */}
                  {loadingWhatsApp ? (
                    <div className="p-6 text-center text-xs text-[#6E6E6E]">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 mx-auto mb-1.5" />
                      <span>Loading WhatsApp history...</span>
                    </div>
                  ) : whatsAppMessages.length > 0 ? (
                    <div className="p-3 bg-[#EFEAE2] rounded-lg border border-[#E8E4DC] max-h-[320px] overflow-y-auto space-y-2 text-xs">
                      {whatsAppMessages.map((msg: any, mIdx: number) => {
                        const isMe = msg.from_me;
                        return (
                          <div
                            key={msg.id || mIdx}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`p-2.5 rounded-lg max-w-[85%] shadow-2xs text-xs space-y-0.5 ${
                                isMe
                                  ? 'bg-[#DCF8C6] text-[#081428] rounded-tr-none'
                                  : 'bg-white text-[#081428] rounded-tl-none border border-slate-200'
                              }`}
                            >
                              <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                              <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 pt-0.5">
                                <span>
                                  {msg.timestamp
                                    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : ''}
                                </span>
                                {isMe && (
                                  <span className={msg.status === 'read' ? 'text-[#34B7F1]' : 'text-slate-400'}>
                                    ✓✓
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-[#FAF8F5] border border-dashed border-[#E8E4DC] rounded-lg text-center space-y-2">
                      <MessageSquare className="w-6 h-6 text-emerald-400 mx-auto" />
                      <div className="text-xs font-semibold text-[#081428]">No WhatsApp Messages Yet</div>
                      <p className="text-[11px] text-[#6E6E6E]">
                        Start a conversation below or open the WhatsApp suite to send brochures and chat with this client.
                      </p>
                    </div>
                  )}

                  {/* Inline Message Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newWhatsAppMsg}
                      onChange={(e) => setNewWhatsAppMsg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendDrawerWhatsApp();
                        }
                      }}
                      placeholder="Type a WhatsApp message..."
                      className="flex-1 p-2 bg-white border border-[#E8E4DC] rounded-md text-xs text-[#081428] focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendDrawerWhatsApp}
                      disabled={sendingWhatsApp || !newWhatsAppMsg.trim()}
                      className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                      title="Send message"
                    >
                      {sendingWhatsApp ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Activity Records Timeline (Calls and All Activity) */
                <div className="space-y-3 pl-2 border-l-2 border-[#E8E4DC]">
                  {displayedActivities.length > 0 ? (
                    displayedActivities.map((act: any) => {
                      const isCall = act.type === 'call' || !!act.call_outcome;
                      return (
                        <div key={act.id} className="relative pl-4 space-y-1">
                          <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#C8A147]" />
                          
                          <div className="flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isCall ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getOutcomeBadgeClass(act.call_outcome)}`}>
                                  {act.call_outcome || 'Phone Call'}
                                </span>
                              ) : act.type === 'ownership_change' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                                  <UserCheck className="w-2.5 h-2.5 text-indigo-600" />
                                  <span>Ownership Change</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                  {act.type?.replace(/_/g, ' ') || 'Activity'}
                                </span>
                              )}
                            </div>
                            
                            <span className="text-[10px] text-[#6E6E6E] font-mono shrink-0">
                              {formatDateTime(act.created_at)}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#081428] font-normal leading-relaxed bg-[#FAF8F5] p-2 rounded border border-[#E8E4DC]/60">
                            {act.description}
                          </div>

                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-slate-400" />
                            <span>
                              {act.type === 'ownership_change' ? 'Assigned by ' : 'Logged by '}
                              <strong className="text-slate-600 font-medium">{act.user_name || 'Admin'}</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 bg-[#FAF8F5] border border-dashed border-[#E8E4DC] rounded-lg text-center space-y-2">
                      <Phone className="w-5 h-5 text-slate-400 mx-auto" />
                      <div className="text-xs font-semibold text-[#081428]">
                        {activeActivityTab === 'calls' ? 'No Call Records Logged Yet' : 'No Activities Recorded Yet'}
                      </div>
                      <p className="text-[11px] text-[#6E6E6E]">
                        Connect with this client and record discussion notes to maintain continuous CRM history.
                      </p>
                      <button
                        onClick={handleLogCallInternal}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#081428] hover:bg-[#122444] text-white rounded text-[11px] font-semibold transition-colors shadow-xs"
                      >
                        <PhoneCall className="w-3 h-3 text-[#C8A147]" />
                        <span>Log First Call Outcome</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
