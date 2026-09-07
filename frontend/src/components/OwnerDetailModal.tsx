'use client';

import { useState, useEffect } from 'react';
import { 
  X, Phone, Smartphone, Mail, Building2, 
  MapPin, Home, MessageSquare, Briefcase, Plus, 
  ExternalLink, Copy, Check, Calendar, User, 
  Sparkles, FileText
} from 'lucide-react';
import Link from 'next/link';

interface OwnerDetailModalProps {
  owner: any | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateOpportunity: (owner: any) => void;
}

export default function OwnerDetailModal({
  owner,
  isOpen,
  onClose,
  onCreateOpportunity,
}: OwnerDetailModalProps) {
  const [showPhone, setShowPhone] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setShowPhone(false);
  }, [owner?.id]);

  if (!isOpen || !owner) return null;

  const activeOpp = (owner.active_opportunity && Number(owner.active_opportunity.id) > 0) ? owner.active_opportunity : null;

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
  const primaryPhone = owner.mobile_number || owner.phone_number;
  const ownerDisplayName = owner.owner_name || owner.name || 'Property Owner';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-['Poppins',sans-serif]">
      <div className="bg-white border border-[#E8E4DC] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between border-b border-[#E8E4DC]/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#C8A147] text-[#081428] font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
              <Building2 className="w-6 h-6 text-[#081428]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C8A147] bg-[#C8A147]/15 px-2 py-0.5 rounded border border-[#C8A147]/30">
                  Property Owner Profile (Read-Only)
                </span>
                <span className="text-xs text-slate-300 font-mono">ID #{owner.id}</span>
              </div>
              <h2 className="font-heading font-bold text-lg text-white mt-0.5">
                {ownerDisplayName}
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
          
          {/* Section 1: Owner Profile Information */}
          <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
              <span className="text-[11px] font-bold text-[#C8A147] uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Owner Contact Information</span>
              </span>
              <span className="text-[10px] font-semibold text-[#6E6E6E] uppercase bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E8E4DC]">
                Owner Registry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Owner Full Name</label>
                <div className="font-bold text-[#081428] text-sm">{ownerDisplayName}</div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Primary Mobile Number</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#081428]">
                    {showPhone ? (primaryPhone || '—') : maskPhone(primaryPhone)}
                  </span>
                  {primaryPhone && (
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
                        onClick={(e) => copyToClipboard(primaryPhone, 'mobile', e)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Copy phone"
                      >
                        {copiedField === 'mobile' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <a
                        href={`https://wa.me/${cleanPhone(primaryPhone)}`}
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

              {owner.phone_number && owner.phone_number !== owner.mobile_number && (
                <div>
                  <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Secondary Landline / Phone</label>
                  <div className="font-mono text-xs font-medium text-[#081428]">
                    {showPhone ? owner.phone_number : maskPhone(owner.phone_number)}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Email Address</label>
                <div className="font-medium text-[#081428]">{owner.email || 'Not Provided'}</div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Assigned Advisor</label>
                <div className="font-semibold text-[#081428]">
                  {owner.assigned_to || 'Unassigned'}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Registry Entry Date</label>
                <div className="font-medium text-[#081428]">
                  {owner.created_at ? new Date(owner.created_at).toLocaleString() : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Property Specifications */}
          <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
              <span className="text-[11px] font-bold text-[#C8A147] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Registered Property Asset Specifications</span>
              </span>
              <span className="text-[10px] font-semibold text-[#081428] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Unit #{owner.property_number || owner.unit_number || 'TBD'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Building / Project Name</label>
                <div className="font-bold text-[#081428] text-sm flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                  <span>{owner.building_name || owner.property_name || 'Property'}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Community & Location</label>
                <div className="font-semibold text-[#081428] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>{owner.area || 'Dubai'}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Property Type</label>
                <div className="font-semibold text-[#081428]">
                  {owner.property_type || 'Residential'}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Bedrooms / Configuration</label>
                <div className="font-semibold text-[#081428]">
                  {owner.bedrooms || 'Not Specified'}
                </div>
              </div>

              {owner.property_name && owner.property_name !== owner.building_name && (
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-semibold text-[#6E6E6E] uppercase block mb-0.5">Property Asset Title</label>
                  <div className="font-medium text-[#081428] bg-[#FAF8F5] p-2 rounded border border-[#E8E4DC]">
                    {owner.property_name}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Opportunity Deal Status */}
          <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
              <span className="text-[11px] font-bold text-[#C8A147] uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Opportunity Pipeline Status</span>
              </span>
              {activeOpp ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Deal Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                  No Deal
                </span>
              )}
            </div>

            {activeOpp ? (
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#081428] text-xs">
                    Opportunity Deal #{activeOpp.id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                    {(activeOpp.stage || 'Pipeline').replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E6E6E] pt-1">
                  <div>
                    Type: <strong className="text-[#081428] capitalize">{activeOpp.opportunity_type || 'Seller'}</strong>
                  </div>
                  <div>
                    Urgency: <strong className="text-[#081428] uppercase">{activeOpp.temperature || 'Warm'}</strong>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={`/opportunities/${activeOpp.id}`}
                    onClick={onClose}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1"
                  >
                    <span>View opportunity details in sales pipeline</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#FAF8F5] rounded-lg border border-[#E8E4DC] text-center space-y-2">
                <p className="text-xs text-[#6E6E6E]">
                  This owner is not yet listed in the Opportunities pipeline.
                </p>
                <button
                  type="button"
                  onClick={() => onCreateOpportunity(owner)}
                  className="px-4 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Seller / Landlord Opportunity</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 4: Notes / Remarks */}
          {(owner.notes || owner.remarks) && (
            <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-2">
              <span className="text-[11px] font-bold text-[#C8A147] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Owner Notes & Remarks</span>
              </span>
              <p className="text-xs text-[#081428] bg-[#FAF8F5] p-3 rounded-lg border border-[#E8E4DC] whitespace-pre-wrap leading-relaxed">
                {owner.notes || owner.remarks}
              </p>
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
                onClick={() => onCreateOpportunity(owner)}
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
