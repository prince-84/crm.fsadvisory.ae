'use client';

import { useState, useEffect } from 'react';
import { 
  X, Mail, Send, Paperclip, CheckCircle2, AlertCircle, FileText, 
  Building2, MapPin, DollarSign, Sparkles, RefreshCw, Eye
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Swal from 'sweetalert2';

interface SendEmailModalProps {
  opportunity: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SendEmailModal({ opportunity, isOpen, onClose, onSuccess }: SendEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateName, setTemplateName] = useState('offplan');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  // Derive specs from opportunity
  const contact = opportunity?.contact || {};
  const bQual = opportunity?.buyer_qualification || {};
  const sQual = opportunity?.seller_qualification || {};
  const projectName = bQual?.project || sQual?.building_name || 'Prime Dubai Development';
  const communityName = bQual?.community || sQual?.community || 'Dubai';
  const propertyType = bQual?.property_type || 'Luxury Residence';
  const bedrooms = bQual?.bedrooms || '2-3 Bedrooms';
  const budget = (opportunity?.budget_min || opportunity?.budget_max)
    ? `AED ${(opportunity?.budget_min || 0).toLocaleString()} – ${(opportunity?.budget_max || 0).toLocaleString()}`
    : 'Upon Request';
  const agentName = opportunity?.current_owner_name || 'Faraz Shafi';
  const agentEmail = `${agentName.toLowerCase().replace(/[^a-z0-9]/g, '')}@fsadvisory.ae`;

  const templates: Record<string, { title: string; subject: string; body: string; badge: string }> = {
    offplan: {
      title: 'Off-Plan Brochure & Payment Plan',
      badge: 'Brochure',
      subject: `[FS Advisory] Exclusive Investment Presentation: ${projectName} (${communityName})`,
      body: `Dear ${contact.name || 'Valued Client'},

It is my distinct pleasure to present this premier off-plan investment opportunity at ${projectName}, nestled within prestigious ${communityName}.

Key Property Highlights:
• Property Typology: ${propertyType} (${bedrooms})
• Indicative Pricing: ${budget}
• Attractive developer payment plan with high projected rental yields and capital appreciation.

Please review the attached project overview and floor plan details. I would welcome the opportunity to walk you through unit availability and reserve the highest-yielding layouts for you.

Looking forward to speaking with you shortly.

Warm regards,

${agentName}
Senior Real Estate Advisor | FS Advisory Luxury Real Estate
Phone: +971 4 000 0000 | Email: ${agentEmail}
Emaar Square, Downtown Dubai, UAE`,
    },
    viewing: {
      title: 'VIP Private Viewing Tour',
      badge: 'Viewing',
      subject: `[VIP Viewing Invitation] Exclusive Property Tour: ${projectName}`,
      body: `Dear ${contact.name || 'Valued Client'},

Following our recent conversation regarding your property search in ${communityName}, I have coordinated a private VIP viewing tour for you at ${projectName}.

Viewing Itinerary:
• Property: ${projectName}, ${communityName}
• Unit Classification: ${propertyType} (${bedrooms})
• Meeting Point: Concierge Desk / Project Sales Pavilion
• Dedicated Advisor: ${agentName} (+971 4 000 0000)

Kindly confirm if tomorrow afternoon or this weekend works best for your schedule so our team can prepare private valet access and refreshments.

Warm regards,

${agentName}
FS Advisory Luxury Real Estate
Downtown Dubai, UAE`,
    },
    cma: {
      title: 'CMA Valuation & Market Analysis',
      badge: 'CMA Report',
      subject: `[Comparative Market Valuation] Exclusive Market Report: ${projectName}`,
      body: `Dear ${contact.name || 'Valued Client'},

Please find enclosed the comprehensive Comparative Market Analysis (CMA) prepared specifically for your portfolio in ${communityName}.

Our advisory desk evaluated recent registered Dubai Land Department (DLD) transactions, average price per square foot metrics, and prime absorption rates in ${projectName}.

Highlights of this analysis:
1. Prevailing market valuation range: ${budget}
2. Premium rental yields benchmarks for ${propertyType}
3. Capital gain projections over the upcoming 24-month pipeline

I am at your service to discuss strategic positioning or listing timelines at your earliest convenience.

Sincerely,

${agentName}
Senior Real Estate Advisor | FS Advisory Luxury Real Estate
Downtown Dubai, UAE`,
    },
    custom: {
      title: 'Custom Advisory Consultation',
      badge: 'Custom',
      subject: `FS Advisory Luxury Real Estate - Property Consultation for ${contact.name || 'Client'}`,
      body: `Dear ${contact.name || 'Valued Client'},

Thank you for your continued interest in FS Advisory's portfolio. 

[Please enter your tailored advisory notes, property options, or contract terms here]

Warm regards,

${agentName}
FS Advisory Luxury Real Estate
Downtown Dubai, UAE`,
    },
  };

  useEffect(() => {
    if (opportunity) {
      const email = contact.email || '';
      setRecipientEmail(email);
      applyTemplate('offplan');
    }
  }, [opportunity]);

  const applyTemplate = (key: string) => {
    setTemplateName(key);
    const tmpl = templates[key] || templates.offplan;
    setSubject(tmpl.subject);
    setBody(tmpl.body);
  };

  if (!isOpen || !opportunity) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientEmail.trim()) {
      Swal.fire('Email Required', 'Please enter a valid recipient email address.', 'warning');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      Swal.fire('Required Fields', 'Subject and Body message cannot be empty.', 'warning');
      return;
    }

    setSending(true);

    try {
      const formData = new FormData();
      formData.append('recipient_email', recipientEmail.trim());
      formData.append('subject', subject.trim());
      formData.append('body', body.trim());
      formData.append('template_name', templateName);

      attachments.forEach((file) => {
        formData.append('attachments[]', file);
      });

      const res = await fetchApi(`/opportunities/${opportunity.id}/send-email`, {
        method: 'POST',
        body: formData,
      });

      if (res && res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Proposal Dispatched!',
          text: `Official proposal delivered to ${recipientEmail} with Reply-To: ${agentEmail}`,
          timer: 2500,
          showConfirmButton: false,
        });

        onSuccess();
        onClose();
      } else {
        Swal.fire('Dispatch Issue', res.message || 'Failed to dispatch email.', 'error');
      }
    } catch (err: any) {
      Swal.fire('SMTP Error', err.message || 'Failed to send email via SMTP server.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-[#E8E2D9] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between border-b border-[#C9A84C]/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F2244] border border-[#C9A84C]/40 flex items-center justify-center text-[#C9A84C] shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-lg text-white">
                  Send Property Proposal
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40 uppercase tracking-wider font-mono">
                  Official SMTP
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Dispatched to <strong className="text-white">{contact.name || 'Client'}</strong> with automatic activity logging.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSend} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Quick Property Context Pill Bar */}
          <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl flex flex-wrap items-center justify-between gap-3 text-slate-700">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#C9A84C] shrink-0" />
              <span className="font-bold text-[#081428]">{projectName}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">{communityName}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-white border border-[#E8E4DC] text-slate-700">
                {propertyType} ({bedrooms})
              </span>
              <span className="px-2 py-0.5 rounded bg-[#081428] text-[#C9A84C] font-bold">
                {budget}
              </span>
            </div>
          </div>

          {/* 1-Click Template Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
              <span>Select Luxury Proposal Template:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(templates).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyTemplate(key)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    templateName === key
                      ? 'bg-[#081428] text-[#C9A84C] border-[#081428] shadow-xs'
                      : 'bg-white text-slate-700 border-[#E8E4DC] hover:border-[#C9A84C]/60 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">
                    {t.badge}
                  </span>
                  <span className="font-bold text-xs mt-1 truncate">
                    {t.title.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recipient Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@domain.com"
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reply-To Advisor Routing
              </label>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 flex items-center justify-between">
                <span className="truncate">{agentEmail}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#081428] font-bold uppercase">
                  Advisor
                </span>
              </div>
            </div>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Subject Line <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-semibold text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
          </div>

          {/* Body Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Proposal Message Body <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={8}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-xs font-medium text-[#081428] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] leading-relaxed resize-y font-sans"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Dispatched with official FS Advisory Navy & Gold header, dynamic property badges, and verified RERA footer.
            </p>
          </div>

          {/* File Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[#C9A84C]" />
                <span>PDF Brochures & Attachments (Max 15MB each):</span>
              </label>
              <label className="px-3 py-1 bg-[#FAF8F5] hover:bg-[#081428] text-[#081428] hover:text-[#C9A84C] border border-[#E8E4DC] rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1">
                <span>+ Add Files</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#C9A84C]" />
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-[#E8E4DC] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Auto-logs to Opportunity & Contact Timelines</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 bg-[#FAF8F5] hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={sending}
                className="px-6 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C9A84C]" />
                    <span>Transmitting Proposal...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#C9A84C]" />
                    <span>Send Proposal Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
