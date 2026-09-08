'use client';

import { useState, useEffect } from 'react';
import { 
  X, Phone, Mail, Clock, MessageSquare, 
  MapPin, DollarSign, Calendar, User, 
  Briefcase, Sparkles, Copy, Check, 
  ExternalLink, Globe, Target, AlertCircle, 
  CheckCircle2, Flame, Building2
} from 'lucide-react';
import Link from 'next/link';

interface ContactDetailModalProps {
  contact: any | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateOpportunity: (contact: any) => void;
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onCreateOpportunity,
}: ContactDetailModalProps) {
  const [showPhone, setShowPhone] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setShowPhone(false);
  }, [contact?.id]);

  if (!isOpen || !contact) return null;

  const rawOpp = contact.active_opportunity || 
    (contact.opportunities && contact.opportunities.find((o: any) => o.stage !== 'closed_won' && o.stage !== 'closed_lost')) ||
    (contact.opportunities && contact.opportunities[0]);

  const activeOpp = (rawOpp && Number(rawOpp.id) > 0 && rawOpp.has_opportunity !== false) ? rawOpp : null;

  const qual = activeOpp?.buyer_qualification || activeOpp?.buyerQualification || {};

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

  const cleanPhone = (phone?: string) => (phone || '').replace(/[^0-9]/g, '');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-['Poppins',sans-serif]">
      <div className="bg-white border border-[#E8E4DC] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between border-b border-[#E8E4DC]/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#C8A147] text-[#081428] font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
              {contact.name ? contact.name.substring(0, 2).toUpperCase() : 'LE'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C8A147] bg-[#C8A147]/15 px-2 py-0.5 rounded border border-[#C8A147]/30">
                  Lead Profile (Read-Only)
                </span>
                <span className="text-xs text-slate-300 font-mono">ID #{contact.id}</span>
              </div>
              <h2 className="font-heading font-bold text-lg text-white mt-0.5">
                {contact.name || 'Client Contact'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable Read-Only Information) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FAF8F5] text-xs">
          
          {/* Section 1: Contact Information */}
          <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
              <span className="text-[11px] font-bold text-[#C8A147] uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Client Contact Information</span>
              </span>
              <span className="text-[10px] font-semibold text-[#6E6E6E] uppercase bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E8E4DC]">
                Source: {contact.source || 'Lead Pool'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Full Name</label>
                <div className="font-bold text-[#081428] text-sm">{contact.name || '—'}</div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Primary Phone</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#081428]">
                    {showPhone ? (contact.phone || '—') : maskPhone(contact.phone)}
                  </span>
                  {contact.phone && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPhone(!showPhone)}
                        className="text-[10px] text-[#C8A147] hover:underline font-semibold cursor-pointer"
                      >
                        {showPhone ? 'Hide' : 'Reveal'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => copyToClipboard(contact.phone, 'phone', e)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Copy phone"
                      >
                        {copiedField === 'phone' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <a
                        href={`https://wa.me/${cleanPhone(contact.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Chat on WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Email Address</label>
                <div className="font-medium text-[#081428]">{contact.email || 'Not Provided'}</div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Nationality & Language</label>
                <div className="font-medium text-[#081428]">
                  {contact.nationality || 'Not specified'} {contact.preferred_language ? `· ${contact.preferred_language}` : ''}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Assigned Advisor</label>
                <div className="font-semibold text-[#081428]">
                  {contact.assigned_agent || contact.assigned_to || contact.current_owner_name || 'Unassigned'}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Date Added</label>
                <div className="font-medium text-[#081428]">
                  {contact.created_at ? new Date(contact.created_at).toLocaleString() : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Active Opportunity Deal & Requirements */}
          <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
              <span className="text-[11px] font-bold text-[#C8A147] uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Opportunity & Property Requirements</span>
              </span>
              {activeOpp && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200">
                  Stage: {(activeOpp.stage || 'new').replace('_', ' ')}
                </span>
              )}
            </div>

            {activeOpp ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Opportunity Type & Urgency</label>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#081428] uppercase text-xs">
                        {activeOpp.opportunity_type || 'Buyer'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        activeOpp.temperature === 'hot'
                          ? 'bg-red-100 text-red-700 font-extrabold'
                          : activeOpp.temperature === 'warm'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {activeOpp.temperature || 'warm'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Budget Range</label>
                    <div className="font-bold text-[#081428] text-sm">
                      {activeOpp.budget_min && activeOpp.budget_max
                        ? `AED ${(activeOpp.budget_min / 1000000).toFixed(1)}M – ${(activeOpp.budget_max / 1000000).toFixed(1)}M`
                        : activeOpp.budget_min
                        ? `AED ${(activeOpp.budget_min / 1000000).toFixed(1)}M`
                        : 'Budget Pending'}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Preferred Location / Community</label>
                    <div className="font-semibold text-[#081428] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span>{qual.community || qual.developer || 'Any Prime Dubai Area'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Property Type & Bedrooms</label>
                    <div className="font-semibold text-[#081428]">
                      {qual.property_type || 'Residential'} {qual.bedrooms ? `· ${qual.bedrooms}` : ''}
                    </div>
                  </div>

                  {qual.developer && (
                    <div>
                      <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Developer Preference</label>
                      <div className="font-semibold text-[#081428]">{qual.developer}</div>
                    </div>
                  )}

                  {activeOpp.sla_status && (
                    <div>
                      <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">SLA Tracking Status</label>
                      <div className="font-bold">
                        {activeOpp.sla_status === 'overdue' ? (
                          <span className="text-red-700 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> SLA Breach (Overdue)
                          </span>
                        ) : activeOpp.sla_status === 'due_soon' ? (
                          <span className="text-amber-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Due Soon (&lt; 30 Mins)
                          </span>
                        ) : (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> On Track
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {activeOpp.next_action && (
                  <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E4DC]">
                    <div className="text-[10px] font-bold text-[#6E6E6E] uppercase mb-1">Scheduled Next Action</div>
                    <div className="font-semibold text-[#081428]">{activeOpp.next_action}</div>
                    {activeOpp.next_action_due_at && (
                      <div className="text-[11px] text-[#6E6E6E] mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Due: {new Date(activeOpp.next_action_due_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-[#FAF8F5] rounded-lg border border-[#E8E4DC] text-center space-y-2">
                <p className="text-xs text-[#6E6E6E]">
                  No active opportunity deal currently linked to this client.
                </p>
                <button
                  type="button"
                  onClick={() => onCreateOpportunity(contact)}
                  className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Opportunity Now</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Digital Marketing & UTM Campaign Attribution */}
          {(contact.utm_source || contact.utm_medium || contact.utm_campaign || contact.utm_term || contact.landing_page_url) && (
            <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                <span className="text-[11px] font-bold text-[#C8A147] uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Digital Marketing & Attribution</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Campaign UTM</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {contact.utm_source && (
                  <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Source</span>
                    <span className="font-semibold text-[#081428]">{contact.utm_source}</span>
                  </div>
                )}
                {contact.utm_medium && (
                  <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Medium</span>
                    <span className="font-semibold text-[#081428]">{contact.utm_medium}</span>
                  </div>
                )}
                {contact.utm_campaign && (
                  <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Campaign</span>
                    <span className="font-semibold text-[#081428]">{contact.utm_campaign}</span>
                  </div>
                )}
                {contact.utm_term && (
                  <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Keyword Term</span>
                    <span className="font-semibold text-[#081428]">{contact.utm_term}</span>
                  </div>
                )}
                {contact.landing_page_url && (
                  <div className="bg-[#FAF8F5] p-2 rounded border border-[#E8E4DC] col-span-2">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Landing Page</span>
                    <span className="font-mono text-[11px] text-blue-600 truncate block">{contact.landing_page_url}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-white border-t border-[#E8E4DC] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#081428] font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {activeOpp ? (
              <Link
                href={`/opportunities/${activeOpp.id}`}
                onClick={onClose}
                className="px-4 py-2 bg-[#081428] hover:bg-[#122444] text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Open Opportunity Deal</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onCreateOpportunity(contact)}
                className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Opportunity</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
