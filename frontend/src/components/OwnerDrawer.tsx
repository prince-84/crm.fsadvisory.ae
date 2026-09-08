'use client';

import { useState, useEffect } from 'react';
import { 
  X, Phone, Smartphone, Mail, Building2, 
  MapPin, Home, MessageSquare, Briefcase, Plus, ExternalLink, Copy, Check
} from 'lucide-react';
import Link from 'next/link';

interface OwnerDrawerProps {
  owner: any | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateOpportunity: (owner: any) => void;
}

export default function OwnerDrawer({ 
  owner, 
  isOpen, 
  onClose, 
  onCreateOpportunity 
}: OwnerDrawerProps) {
  const [showPhone, setShowPhone] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setShowPhone(false);
  }, [owner?.id]);

  if (!isOpen || !owner) return null;

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

  const activeOpp = (owner.active_opportunity && Number(owner.active_opportunity.id) > 0) ? owner.active_opportunity : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/25 backdrop-blur-2xs transition-opacity animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white border-l border-[#E8E4DC] shadow-2xl flex flex-col font-['Poppins',sans-serif]">
          
          {/* Top Owner Profile Header Section */}
          <div className="p-6 border-b border-[#E8E4DC] relative bg-[#FAF8F5]">
            <button 
              onClick={onClose} 
              className="absolute right-5 top-4 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E8E4DC]/80 pr-8">
              <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase">PROPERTY OWNER PROFILE</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C8A147]/15 text-[#8F7424] border border-[#C8A147]/30">
                Owner Registry
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[#081428] border border-[#C8A147]/40 text-[#C8A147] font-heading font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
                {owner.owner_name ? owner.owner_name.substring(0, 2).toUpperCase() : 'OW'}
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h2 className="font-heading font-bold text-lg text-[#081428] truncate">{owner.owner_name}</h2>
                <div className="text-xs text-[#6E6E6E] space-y-0.5">
                  <div className="text-[11px] text-slate-500 font-mono">ID: #{owner.id} · Assigned to: <strong className="text-[#081428]">{owner.assigned_to || 'Unassigned'}</strong></div>
                  
                  {/* Mobile Masking & Toggle on Direct Click */}
                  {owner.mobile_number && (
                    <div className="flex items-center gap-2 font-medium text-[#081428] pt-1">
                      <div 
                        onClick={() => setShowPhone(!showPhone)}
                        className="flex items-center gap-1.5 cursor-pointer select-none group w-fit"
                        title={showPhone ? "Click to hide phone number" : "Click to reveal phone number"}
                      >
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-mono text-xs group-hover:text-[#C8A147] transition-colors">
                          {showPhone ? owner.mobile_number : maskPhone(owner.mobile_number)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => copyToClipboard(owner.mobile_number, `mob-${owner.id}`, e)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                        title="Copy Primary Phone"
                      >
                        {copiedField === `mob-${owner.id}` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}

                  {owner.phone_number && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-mono">{owner.phone_number}</span>
                    </div>
                  )}

                  {owner.email && (
                    <div className="text-[11px] text-[#6E6E6E] truncate">{owner.email}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white text-xs">
            
            {/* Active Opportunity Card */}
            {activeOpp ? (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase">ACTIVE OPPORTUNITY</span>
                  <Link 
                    href={`/opportunities/${activeOpp.id}`}
                    onClick={onClose}
                    className="text-[11px] font-semibold text-[#6E6E6E] hover:text-[#081428] flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Deal</span>
                    <ExternalLink className="w-3 h-3 text-[#C8A147]" />
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="font-bold text-[#081428] text-xs">
                      {activeOpp.opportunity_type ? activeOpp.opportunity_type.charAt(0).toUpperCase() + activeOpp.opportunity_type.slice(1) : 'Seller'} Opportunity · <span className="text-emerald-700 uppercase">{activeOpp.stage?.replace('_', ' ') || 'ACTIVE'}</span>
                    </span>
                  </div>

                  <div className="font-bold text-[#081428] text-sm">
                    AED {(Number(activeOpp.budget_min || 0) / 1000000).toFixed(1)}M – {(Number(activeOpp.budget_max || 0) / 1000000).toFixed(1)}M
                  </div>

                  <div className="text-xs text-[#6E6E6E]">
                    {activeOpp.key_requirement || 'Property Sale Inquiry'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#FAF8F5] border border-dashed border-[#C8A147]/70 rounded-lg text-center space-y-3">
                <div>
                  <p className="font-bold text-[#081428] text-xs">Ready to work on this owner property?</p>
                  <p className="text-[11px] text-[#6E6E6E] mt-0.5">Call owner and instantiate an active Seller/Landlord opportunity deal.</p>
                </div>
                <button
                  onClick={() => onCreateOpportunity(owner)}
                  className="w-full py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Briefcase className="w-4 h-4 text-[#C8A147]" />
                  <span>Create Opportunity for Owner</span>
                </button>
              </div>
            )}

            {/* Property Details Card */}
            <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>PROPERTY ASSET SPECIFICATIONS</span>
                </span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded text-[10px] font-bold">
                  {owner.property_type || 'Residential'}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Property Name</div>
                  <div className="font-bold text-sm text-[#081428]">{owner.property_name || 'N/A'}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="p-2 bg-white rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-500 block">Unit / Prop #</span>
                    <strong className="text-[#081428] font-mono text-xs">{owner.property_number || '—'}</strong>
                  </div>

                  <div className="p-2 bg-white rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-500 block">Bedrooms</span>
                    <strong className="text-[#081428] text-xs">{owner.bedrooms || '—'}</strong>
                  </div>

                  <div className="p-2 bg-white rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-500 block">Building Name</span>
                    <strong className="text-[#081428] text-xs truncate block" title={owner.building_name || ''}>{owner.building_name || '—'}</strong>
                  </div>

                  <div className="p-2 bg-white rounded border border-[#E8E4DC]">
                    <span className="text-[10px] text-slate-500 block">Area / Location</span>
                    <strong className="text-[#081428] text-xs flex items-center gap-1 text-[#C8A147]">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{owner.area || 'Dubai'}</span>
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Owner Notes Section */}
            {owner.notes && (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-1.5">
                <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase">OWNER NOTES</span>
                <p className="text-slate-700 leading-relaxed text-xs">{owner.notes}</p>
              </div>
            )}
          </div>

          {/* Drawer Bottom Action Toolbar */}
          <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex items-center gap-2">
            <Link
              href={`/whatsapp?phone=${encodeURIComponent(owner.mobile_number || owner.phone_number || '')}&name=${encodeURIComponent(owner.owner_name || '')}`}
              className="flex-1 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-[#081428] font-bold text-xs rounded flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              <span>WhatsApp</span>
            </Link>

            {!activeOpp && (
              <button
                onClick={() => onCreateOpportunity(owner)}
                className="flex-1 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Opportunity</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
