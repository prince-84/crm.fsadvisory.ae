'use client';

import React from 'react';
import { 
  X, Briefcase, User, Phone, Mail, Globe, Tag, Calendar, 
  Clock, DollarSign, Building2, Home, ExternalLink, MessageSquare, 
  Edit3, ShieldCheck, Sparkles, CheckCircle2, AlertCircle, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface OpportunityQuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: any | null;
  opportunity?: any | null;
}

export default function OpportunityQuickViewModal({
  isOpen,
  onClose,
  contact,
  opportunity: passedOpp
}: OpportunityQuickViewModalProps) {
  if (!isOpen || !contact) return null;

  // Find active opportunity: passed explicit opportunity or first opportunity of contact
  const opp = passedOpp || (contact.opportunities && contact.opportunities.length > 0 ? contact.opportunities[0] : null);
  const bq = opp?.buyer_qualification || opp?.buyerQualification || {};

  const getStageBadgeColor = (stage?: string) => {
    switch (stage?.toLowerCase()) {
      case 'new':
      case 'new_lead':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'contacted':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'meeting_scheduled':
      case 'viewing':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'negotiation':
      case 'offer_made':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'closed_won':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'closed_lost':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatCurrency = (val: any) => {
    if (!val || isNaN(Number(val))) return '—';
    return `AED ${Number(val).toLocaleString()}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081428]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white border border-[#E8E4DC] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between border-b border-[#1A2A44] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8A147]/20 border border-[#C8A147]/40 flex items-center justify-center text-[#C8A147]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">{contact.name || 'Lead Opportunity'}</h3>
                {opp?.id && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1A2A44] text-[#C8A147] border border-[#C8A147]/30">
                    DEAL #{opp.id}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Contact ID: #{contact.id}</span>
                <span>•</span>
                <span className="text-[#C8A147]">{contact.assigned_to || opp?.current_owner_name || 'Unassigned'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs">
          {/* Top Deal Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Pipeline Stage</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] border capitalize ${getStageBadgeColor(opp?.stage)}`}>
                {opp?.stage ? opp.stage.replace('_', ' ') : 'Active Lead'}
              </span>
            </div>

            <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Budget / Value</span>
              <span className="font-bold text-[#081428] text-xs mt-1 block">
                {opp?.budget_max || opp?.budget_min ? (
                  `${formatCurrency(opp.budget_min || 0)} - ${formatCurrency(opp.budget_max || 0)}`
                ) : (
                  'Not Specified'
                )}
              </span>
            </div>

            <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Opp Type</span>
              <span className="font-bold text-[#081428] text-xs mt-1 block capitalize">
                {opp?.opportunity_type || 'Buyer'}
              </span>
            </div>

            <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Lead SLA</span>
              <span className={`font-bold text-xs mt-1 block capitalize ${contact.sla_status === 'overdue' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {contact.sla_status || 'On Track'}
              </span>
            </div>
          </div>

          {/* Client & Contact Info Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-[#081428] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#C8A147]" />
              <span>Client Contact Details</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-semibold text-slate-800">{contact.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-semibold text-slate-800">{contact.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium">Nationality:</span>
                <span className="font-semibold text-slate-800">{contact.nationality || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium">Source:</span>
                <span className="font-semibold text-[#081428] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                  {contact.source || 'Direct'}
                </span>
              </div>
            </div>
          </div>

          {/* Property Specifications & Preferences Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-[#081428] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
              <span>Property Specs & Qualification Preferences</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] font-medium block">Developer</span>
                <span className="font-semibold text-slate-800">{opp?.developer || bq.developer || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-medium block">Project</span>
                <span className="font-semibold text-slate-800">{opp?.project || bq.project || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-medium block">Community / Area</span>
                <span className="font-semibold text-slate-800">{opp?.community || bq.community || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-medium block">Property Type</span>
                <span className="font-semibold text-slate-800">{opp?.project_property || bq.property_type || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-medium block">Bedrooms</span>
                <span className="font-semibold text-slate-800">{opp?.bedrooms || bq.bedrooms || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-medium block">Payment Method</span>
                <span className="font-semibold text-slate-800">{opp?.cash_or_finance || bq.cash_or_finance || '—'}</span>
              </div>
            </div>
          </div>

          {/* Notes & SLA Next Action */}
          {opp?.next_action || opp?.notes ? (
            <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-xl p-4 space-y-2">
              {opp?.next_action && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#C8A147] tracking-wider block">Next Follow-Up Action</span>
                  <p className="text-xs text-slate-800 font-semibold mt-0.5">{opp.next_action}</p>
                </div>
              )}
              {opp?.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Opportunity Notes</span>
                  <p className="text-xs text-slate-600 italic mt-0.5">{opp.notes}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-[#FAF8F5] px-6 py-3 border-t border-[#E8E4DC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/whatsapp?phone=${encodeURIComponent(contact.phone || '')}&name=${encodeURIComponent(contact.name || '')}`}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg border border-emerald-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </Link>

            <Link
              href={`/leads/${contact.id}/edit`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-[#081428] text-slate-700 hover:text-[#C8A147] rounded-lg border border-slate-300 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Lead</span>
            </Link>
          </div>

          {opp?.id ? (
            <Link
              href={`/opportunities/${opp.id}`}
              className="px-4 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Open Full Deal Pipeline</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#081428] text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors"
            >
              Close Quick View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
