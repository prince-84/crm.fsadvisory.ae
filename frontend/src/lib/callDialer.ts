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

export type DialFormatType = 'intl00' | 'e164' | 'localUae' | 'digitsOnly';

export interface ParsedPhoneNumber {
  raw: string;
  digitsOnly: string;
  e164: string;           // e.g. "+971585686896"
  intl00: string;         // e.g. "00971585686896"
  localUae: string | null; // e.g. "0585686896" (if UAE number)
  recommended: string;    // Based on user preference
  activeFormat: DialFormatType;
}

/**
 * Intelligent phone parser and normalizer.
 * Normalizes numbers regardless of whether they were stored:
 * - with '+' or without '+' (e.g. +9715... vs 9715...)
 * - with '00' prefix (e.g. 009715...)
 * - with local UAE mobile format (e.g. 058... or 58...)
 * - with spaces, dashes, dots, or parentheses
 */
export function parsePhoneNumber(rawPhone: string): ParsedPhoneNumber | null {
  if (!rawPhone) return null;

  const raw = String(rawPhone).trim();
  // Strip spaces, dashes, dots, parentheses, commas
  const clean = raw.replace(/[\s\-\(\)\.\,]/g, '');
  if (!clean) return null;

  let digits = '';
  const hadPlus = clean.startsWith('+');
  const had00 = clean.startsWith('00');

  if (hadPlus) {
    digits = clean.substring(1).replace(/[^0-9]/g, '');
  } else if (had00) {
    digits = clean.substring(2).replace(/[^0-9]/g, '');
  } else if (/^05[0-9]{8}$/.test(clean)) {
    // UAE local mobile e.g. 0585686896 -> 971585686896
    digits = '971' + clean.substring(1);
  } else if (/^5[0-9]{8}$/.test(clean)) {
    // UAE mobile without leading zero e.g. 585686896 -> 971585686896
    digits = '971' + clean;
  } else {
    digits = clean.replace(/[^0-9]/g, '');
  }

  if (!digits) return null;

  // Detect UAE local equivalent (05x for mobile or 02/03/04/06/07/09 for landlines)
  let localUae: string | null = null;
  if (digits.startsWith('9715') && digits.length === 12) {
    localUae = '0' + digits.substring(3);
  } else if (digits.startsWith('971') && (digits.length === 11 || digits.length === 12)) {
    localUae = '0' + digits.substring(3);
  }

  const e164 = '+' + digits;
  const intl00 = '00' + digits;
  const digitsOnly = digits;

  // Retrieve user saved format preference (default to 'intl00' for 3CX compatibility)
  let activeFormat: DialFormatType = 'intl00';
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('crm_3cx_format');
      if (saved && ['intl00', 'e164', 'localUae', 'digitsOnly'].includes(saved)) {
        activeFormat = saved as DialFormatType;
      }
    } catch (e) {}
  }

  let recommended = intl00;
  if (activeFormat === 'e164') {
    recommended = e164;
  } else if (activeFormat === 'localUae' && localUae) {
    recommended = localUae;
  } else if (activeFormat === 'digitsOnly') {
    recommended = digitsOnly;
  } else {
    recommended = intl00;
  }

  return {
    raw,
    digitsOnly,
    e164,
    intl00,
    localUae,
    recommended,
    activeFormat,
  };
}

/**
 * Backward compatible sanitize function
 */
export function sanitizePhoneForDialer(phone: string): string {
  const parsed = parsePhoneNumber(phone);
  return parsed ? parsed.recommended : '';
}

/**
 * Triggers 3CX Click-to-Call using 3CX Desktop App or standard OS protocol handler.
 * Default protocol: 'tel' (triggers 3CX Desktop App on Windows)
 * Alternative protocols: '3cx' or 'callto'
 */
export function trigger3cxDial(phone: string, overrideProtocol?: string): boolean {
  if (!phone) {
    console.warn('[3CX Dialer] No phone number provided to dial.');
    return false;
  }

  // Retrieve protocol
  let protocol = overrideProtocol;
  if (!protocol && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('crm_3cx_protocol');
      if (stored && ['tel', 'callto', '3cx'].includes(stored)) {
        protocol = stored;
      }
    } catch (e) {}
  }
  if (!protocol) protocol = 'tel';

  // Construct target URI
  // If the number already has 00 or + or digits, use as-is; otherwise parse
  let targetPhone = phone.trim();
  if (!targetPhone.startsWith('+') && !targetPhone.startsWith('00')) {
    const parsed = parsePhoneNumber(targetPhone);
    if (parsed) {
      targetPhone = parsed.recommended;
    }
  }

  // For 3cx: custom protocol, can use 3cx:XXXX or 3cx:dial?number=XXXX
  const dialUri = protocol === '3cx' 
    ? `3cx:${encodeURIComponent(targetPhone)}` 
    : `${protocol}:${encodeURIComponent(targetPhone).replace(/%2B/g, '+')}`;

  if (typeof window !== 'undefined') {
    try {
      const link = document.createElement('a');
      link.href = dialUri;
      link.style.display = 'none';
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.dispatchEvent(new CustomEvent('crm:3cx-dialed', { detail: { phone, dialUri, protocol } }));
      return true;
    } catch (err) {
      console.error('[3CX Dialer] Failed to trigger dial URI:', err);
      // Fallback
      try {
        window.location.href = dialUri;
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  return false;
}

/**
 * Opens 3CX Web Client as a dedicated companion floating dialer widget
 */
export function open3cxFloatingDialer(phone: string): Window | null {
  const parsed = parsePhoneNumber(phone);
  const cleanPhone = parsed ? parsed.recommended : phone.trim();
  if (!cleanPhone || typeof window === 'undefined') return null;

  const width = 430;
  const height = 690;
  const screenWidth = window.screen.availWidth || window.screen.width || 1440;
  const left = Math.max(0, screenWidth - width - 24);
  const top = 40;

  // Use encodeURIComponent to ensure '+' or '00' isn't corrupted by URL query decoding
  const url = `https://ukits.3cx.ae/webclient/#/call?phone=${encodeURIComponent(cleanPhone)}`;
  try {
    const dialerWin = window.open(
      url,
      '3CX_CRM_Floating_Dialer',
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes`
    );
    if (dialerWin) {
      dialerWin.focus();
    }
    return dialerWin;
  } catch (e) {
    console.warn('[3CX Dialer] Floating window blocked or failed:', e);
    return null;
  }
}

/**
 * Unified 3CX Call Initiation & Outcome Logging Dialog
 * Default Mode: 3CX Desktop App (Option 1)
 * Features:
 * - Triggers 3CX Desktop App directly without obstructing the CRM window
 * - Smart phone normalizer with 1-click format switcher (+ Prefix, 00 Prefix, UAE Local 05x, Raw Digits)
 * - Remembers chosen dialing format in localStorage
 * - Outcome logging, Next follow-up SLA schedule, and Contact Activity recording
 */
export async function launch3cxCallDialog(options: DialOptions): Promise<boolean> {
  const rawPhone = options.phone || '';
  const parsed = parsePhoneNumber(rawPhone);
  const contactName = options.contactName || 'Client';

  let currentDialNumber = parsed ? parsed.recommended : rawPhone;
  let activeFormat: DialFormatType = parsed ? parsed.activeFormat : 'intl00';

  // 1. Trigger call in 3CX Desktop App (Option 1: Native app direct dial)
  if (currentDialNumber) {
    trigger3cxDial(currentDialNumber);
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
        const parsedUser = JSON.parse(u);
        currentAdvisorName = parsedUser.name || parsedUser.email;
      }
    } catch (e) {}
  }

  // 2. Open Call Outcome & SLA logging modal
  const { value: formValues } = await Swal.fire({
    title: `<div class="text-[#081428] font-bold text-base flex items-center justify-center gap-2">
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
        3CX Desktop App
      </span>
      <span>Log Call — ${contactName}</span>
    </div>`,
    html: `
      <div class="space-y-3.5 text-left p-1 text-xs font-['Poppins',sans-serif]">
        <!-- 3CX Calling Status & Format Banner -->
        <div class="text-[11px] bg-gradient-to-r from-emerald-50 via-teal-50/50 to-blue-50/40 p-3 rounded-lg border border-emerald-200 text-emerald-950 flex flex-col gap-2.5">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
              <div>
                <div class="font-bold text-[#081428] flex items-center gap-1.5">
                  <span>Dialing:</span>
                  <span id="swal-dialed-number-display" class="font-mono text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300 font-bold text-xs">${currentDialNumber || 'No phone'}</span>
                </div>
                <div class="text-[10px] text-slate-500">Connected to 3CX Desktop App (Option 1)</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" id="swal-redial-btn" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1" title="Re-dial in 3CX App">
                ⚡ Re-Dial
              </button>
              <button type="button" id="swal-web-dialer-btn" class="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[10px] font-bold text-emerald-800 transition-colors cursor-pointer shadow-2xs" title="Open 3CX Web Client Floating Window">
                🌐 Web Dialer
              </button>
            </div>
          </div>

          <!-- Format Switcher Chips (Solves Country Code & '+' issues) -->
          ${parsed ? `
          <div class="pt-2 border-t border-emerald-200/60">
            <div class="text-[10px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Choose Dial Format (Click to Switch & Re-dial):</span>
              <span class="text-[9px] text-emerald-700 font-medium">Auto-saves preference</span>
            </div>
            <div class="flex items-center gap-1 flex-wrap" id="swal-format-chips">
              <button type="button" data-format="intl00" data-number="${parsed.intl00}" class="swal-chip-btn px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${activeFormat === 'intl00' ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'}">
                00 Prefix: ${parsed.intl00} (Recommended)
              </button>
              <button type="button" data-format="e164" data-number="${parsed.e164}" class="swal-chip-btn px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${activeFormat === 'e164' ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'}">
                + Prefix: ${parsed.e164}
              </button>
              ${parsed.localUae ? `
              <button type="button" data-format="localUae" data-number="${parsed.localUae}" class="swal-chip-btn px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${activeFormat === 'localUae' ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'}">
                UAE Local: ${parsed.localUae}
              </button>
              ` : ''}
              <button type="button" data-format="digitsOnly" data-number="${parsed.digitsOnly}" class="swal-chip-btn px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${activeFormat === 'digitsOnly' ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'}">
                Digits: ${parsed.digitsOnly}
              </button>
            </div>
          </div>
          ` : ''}

          <!-- Guidance Note for 3CX App Pin -->
          <div class="text-[10px] text-slate-600 bg-white/90 p-1.5 rounded border border-emerald-100 flex items-center justify-between">
            <span>📌 <strong>3CX App Tip:</strong> 3CX App ke top bar mein <strong>Pin (📌)</strong> click karein taake dialer hamesha screen par samne rahe.</span>
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
      const displaySpan = popup.querySelector('#swal-dialed-number-display');
      const redialBtn = popup.querySelector('#swal-redial-btn');
      const webDialerBtn = popup.querySelector('#swal-web-dialer-btn');
      const chipBtns = popup.querySelectorAll('.swal-chip-btn');

      // Re-dial button click
      if (redialBtn) {
        redialBtn.addEventListener('click', () => {
          if (currentDialNumber) {
            trigger3cxDial(currentDialNumber);
          }
        });
      }

      // Web dialer companion button click
      if (webDialerBtn) {
        webDialerBtn.addEventListener('click', () => {
          if (currentDialNumber) {
            open3cxFloatingDialer(currentDialNumber);
          }
        });
      }

      // Format switcher chips click
      chipBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const newNumber = btn.getAttribute('data-number');
          const newFormat = btn.getAttribute('data-format') as DialFormatType;
          if (newNumber) {
            currentDialNumber = newNumber;
            if (displaySpan) {
              displaySpan.textContent = newNumber;
            }
            if (newFormat) {
              activeFormat = newFormat;
              try {
                localStorage.setItem('crm_3cx_format', newFormat);
              } catch (e) {}

              // Update active styling
              chipBtns.forEach((b) => {
                b.className = 'swal-chip-btn px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer bg-white text-slate-700 border-slate-300 hover:bg-emerald-50';
              });
              btn.className = 'swal-chip-btn px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer bg-emerald-700 text-white border-emerald-700 font-bold shadow-xs';
            }

            // Immediately trigger re-dial with the newly chosen format
            trigger3cxDial(newNumber);
          }
        });
      });

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
      payload.phone = currentDialNumber || rawPhone;
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
