import Swal from 'sweetalert2';
import { fetchApi } from './api';

export interface DialOptions {
  phone: string;
  contactId?: number | null;
  contactName?: string;
  opportunityId?: number | null;
  ownerRecordId?: number | null;
  currentUser?: { name?: string; email?: string } | null;
  onSuccess?: () => void;
}

/**
 * Sanitize and clean phone number for 3CX Softphone & Desktop App protocol dialing
 */
export function sanitizePhoneForDialer(phone: string): string {
  if (!phone) return '';
  let clean = phone.trim().replace(/[^0-9+]/g, '');
  if (clean.startsWith('00')) {
    clean = '+' + clean.substring(2);
  }
  return clean;
}

/**
 * Triggers 3CX Click-to-Call using standard OS protocol handler (tel:, 3cx:, or callto:).
 * This hands off the call to the 3CX Desktop App or 3CX Web Client extension on the user's PC.
 */
export function trigger3cxDial(rawPhone: string): boolean {
  const cleanPhone = sanitizePhoneForDialer(rawPhone);
  if (!cleanPhone) {
    console.warn('[3CX Dialer] No valid phone number provided to dial.');
    return false;
  }

  // Retrieve preferred protocol handler (default: 'tel')
  let protocol = 'tel';
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('crm_3cx_protocol');
      if (stored && ['tel', 'callto', '3cx'].includes(stored)) {
        protocol = stored;
      }
    } catch (e) {}
  }

  const dialUri = `${protocol}:${cleanPhone}`;

  if (typeof window !== 'undefined') {
    try {
      const link = document.createElement('a');
      link.href = dialUri;
      link.style.display = 'none';
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Dispatch dial event for any reactive CRM listeners
      window.dispatchEvent(new CustomEvent('crm:3cx-dialed', { detail: { phone: rawPhone, cleanPhone, dialUri } }));
      return true;
    } catch (err) {
      console.error('[3CX Dialer] Failed to launch dialer URI:', err);
      return false;
    }
  }

  return false;
}

/**
 * Unified 3CX Call Initiation & Outcome Logging Dialog
 * 1. Automatically initiates 3CX call via OS protocol handler
 * 2. Presents disposition modal for 1-click outcome, SLA timer, and discussion notes
 * 3. Saves call log to CRM backend (/activities) and syncs contact state
 */
export async function launch3cxCallDialog(options: DialOptions): Promise<boolean> {
  const rawPhone = options.phone || '';
  const cleanPhone = sanitizePhoneForDialer(rawPhone);
  const contactName = options.contactName || 'Client';

  // 1. Trigger the 3CX softphone dialer immediately
  if (cleanPhone) {
    trigger3cxDial(cleanPhone);
  }

  const now = new Date();
  const nowLocalIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const tomorrowLocalIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  let currentAdvisorName = options.currentUser?.name;
  if (!currentAdvisorName && typeof window !== 'undefined') {
    try {
      const u = localStorage.getItem('crm_user');
      if (u) {
        const parsed = JSON.parse(u);
        currentAdvisorName = parsed.name || parsed.email;
      }
    } catch (e) {}
  }

  // 2. Open Call Outcome & SLA logging modal
  const { value: formValues } = await Swal.fire({
    title: `<div class="text-[#081428] font-bold text-base flex items-center justify-center gap-2">
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
        3CX Dialer
      </span>
      <span>Log Call — ${contactName}</span>
    </div>`,
    html: `
      <div class="space-y-3.5 text-left p-1 text-xs font-['Poppins',sans-serif]">
        <!-- 3CX Calling Status Banner -->
        <div class="text-[11px] bg-gradient-to-r from-emerald-50 to-teal-50/50 p-2.5 rounded-lg border border-emerald-200 text-emerald-950 flex flex-col gap-2">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
              <div>
                <div class="font-bold text-[#081428]">Dialing: <span class="font-mono text-emerald-700">${rawPhone || 'No phone'}</span></div>
                <div class="text-[10px] text-slate-500">Handshake sent to your computer's active 3CX App.</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" id="swal-redial-btn" class="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[10px] font-bold text-emerald-800 transition-colors cursor-pointer shadow-2xs" title="Trigger 3CX Desktop App dial again">
                📞 3CX App
              </button>
              <a href="https://ukits.3cx.ae/webclient/#/call?phone=${cleanPhone}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1" title="Open in 3CX Web Client">
                🌐 Web Client
              </a>
            </div>
          </div>
          <div class="text-[10px] text-slate-600 bg-white/80 p-1.5 rounded border border-emerald-100">
            ℹ️ Call us agent ki extension se dial hogi jo is PC par 3CX app me logged in hai.
          </div>
        </div>

        <!-- Outcome Selector -->
        <div>
          <label class="block text-[#081428] font-bold mb-1">Call Outcome Status</label>
          <select id="swal-call-outcome" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none cursor-pointer">
            <option value="Interested">Interested (🟢 Positive response)</option>
            <option value="Callback">Callback (🟡 Client requested call later)</option>
            <option value="Follow-up">Follow-up (🔵 Regular pipeline nurturing)</option>
            <option value="No Answer">No Answer (⚪ Handset rang / no pickup)</option>
            <option value="Busy">Busy / Call Rejected (🟣 Number busy)</option>
            <option value="Not Interested">Not Interested (🔴 Closed / No requirement)</option>
            <option value="Wrong Number">Wrong Number (⚫ Invalid or incorrect person)</option>
            <option value="Real Estate Agent">Real Estate Agent (🟠 Agent / Broker contact)</option>
          </select>
        </div>

        <!-- Next Action & SLA Schedule -->
        <div id="swal-next-schedule-container">
          <label class="block text-[#081428] font-bold mb-1">Next Follow-up & SLA Schedule</label>
          <select id="swal-next-schedule" class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium focus:ring-2 focus:ring-[#C8A147] focus:outline-none cursor-pointer">
            <option value="24h">📅 Tomorrow at Same Time (24h) — [On Track 🟢]</option>
            <option value="15m">⚡ Quick Callback in 15 mins — [Due Soon 🟡]</option>
            <option value="2h">⏰ Later Today (in 2 hours) — [On Track 🟢]</option>
            <option value="5h">⏳ In 5 Hours — [On Track 🟢]</option>
            <option value="48h">📆 In 2 Days — [On Track 🟢]</option>
            <option value="custom">🗓️ Pick Specific Date & Time (Calendar)</option>
            <option value="now">🚨 Immediate Escalation (Now) — [Overdue 🔴]</option>
          </select>
          <div id="swal-custom-datetime-container" style="display: none;" class="mt-2.5 p-2.5 bg-amber-50/50 border border-amber-200 rounded text-left">
            <label class="block text-[#081428] font-semibold text-[11px] mb-1">🗓️ Choose Custom Follow-up Date & Time:</label>
            <input type="datetime-local" id="swal-custom-datetime" value="${tomorrowLocalIso}" min="${nowLocalIso}" class="w-full p-2 bg-white border border-[#C8A147] rounded text-xs text-[#081428] font-mono focus:ring-2 focus:ring-[#C8A147] focus:outline-none" />
            <p class="text-[10px] text-slate-500 mt-1">SLA alert will trigger 10 minutes prior to this scheduled time.</p>
          </div>
        </div>

        <!-- Discussion Notes -->
        <div>
          <label class="block text-[#081428] font-bold mb-1">Call Notes / Discussion Summary</label>
          <textarea id="swal-call-notes" rows="3" placeholder="Enter key discussion summary, requirements, budget, or agreed next steps..." class="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] focus:ring-2 focus:ring-[#C8A147] focus:outline-none"></textarea>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Save Call Log & Next',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#16A34A',
    cancelButtonColor: '#6E6E6E',
    didOpen: (popup) => {
      // Re-dial button hook
      const redialBtn = popup.querySelector('#swal-redial-btn');
      if (redialBtn && cleanPhone) {
        redialBtn.addEventListener('click', () => {
          trigger3cxDial(cleanPhone);
        });
      }

      const outcomeSelect = popup.querySelector('#swal-call-outcome') as HTMLSelectElement | null;
      const scheduleContainer = popup.querySelector('#swal-next-schedule-container') as HTMLElement | null;
      const scheduleSelect = popup.querySelector('#swal-next-schedule') as HTMLSelectElement | null;
      const customContainer = popup.querySelector('#swal-custom-datetime-container') as HTMLElement | null;

      if (scheduleSelect && customContainer) {
        const toggleCustom = () => {
          customContainer.style.display = scheduleSelect.value === 'custom' ? 'block' : 'none';
        };
        scheduleSelect.addEventListener('change', toggleCustom);
        toggleCustom();
      }

      if (outcomeSelect && scheduleContainer) {
        const toggleSchedule = () => {
          const val = outcomeSelect.value || '';
          const isTerminal = val.includes('Not Interested') || val.includes('Wrong Number') || val.includes('Real Estate Agent');
          scheduleContainer.style.display = isTerminal ? 'none' : 'block';
        };
        outcomeSelect.addEventListener('change', toggleSchedule);
        toggleSchedule();
      }
    },
    preConfirm: () => {
      const outcome = (document.getElementById('swal-call-outcome') as HTMLSelectElement)?.value;
      const schedule = (document.getElementById('swal-next-schedule') as HTMLSelectElement)?.value;
      const customDateTime = (document.getElementById('swal-custom-datetime') as HTMLInputElement)?.value;
      const notes = (document.getElementById('swal-call-notes') as HTMLTextAreaElement)?.value;

      if (!notes || notes.trim() === '') {
        Swal.showValidationMessage('Please enter call notes / summary before saving.');
        return false;
      }

      const isTerminal = outcome?.includes('Not Interested') || outcome?.includes('Wrong Number') || outcome?.includes('Real Estate Agent');

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

  if (!formValues) {
    return false;
  }

  // Calculate dueAt timestamp
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

  try {
    const payload: any = {
      type: 'call',
      call_outcome: formValues.outcome,
      description: `3CX Call: ${formValues.outcome} — ${formValues.notes}`,
      user_name: currentAdvisorName || 'Agent',
      next_action: formValues.isTerminal ? `Closed: ${formValues.outcome}` : `Follow-up: ${formValues.outcome}`,
      next_action_due_at: dueAt ? dueAt.toISOString() : null,
    };

    if (options.contactId) {
      payload.contact_id = options.contactId;
    }
    if (options.opportunityId) {
      payload.opportunity_id = options.opportunityId;
    }
    if (options.ownerRecordId) {
      payload.owner_record_id = options.ownerRecordId;
    }
    if (!payload.contact_id && rawPhone) {
      payload.phone = rawPhone;
      payload.contact_name = contactName;
    }

    await fetchApi('/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2400,
      timerProgressBar: true,
    });
    Toast.fire({
      icon: 'success',
      title: `3CX Call saved for ${contactName} (${formValues.outcome})`,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm:contact-updated'));
      window.dispatchEvent(new CustomEvent('crm_call_logged'));
      window.dispatchEvent(new CustomEvent('crm:notification-bell-refresh'));
    }

    if (options.onSuccess) {
      options.onSuccess();
    }

    return true;
  } catch (err: any) {
    Swal.fire({
      icon: 'error',
      title: 'Failed to Save Call Log',
      text: err.message || 'Server error occurred while saving call log.',
    });
    return false;
  }
}
