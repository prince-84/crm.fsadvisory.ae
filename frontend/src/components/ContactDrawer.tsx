'use client';

import { useState, useEffect } from 'react';
import { 
  X, Phone, Mail, Clock, MessageSquare, 
  PhoneCall, Edit2, Target, Link2, ExternalLink, Copy 
} from 'lucide-react';
import Link from 'next/link';

interface ContactDrawerProps {
  contact: any | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateOpportunity?: (contact: any) => void;
  onEditLead?: (contact: any) => void;
}

export default function ContactDrawer({ 
  contact, 
  isOpen, 
  onClose, 
  onCreateOpportunity,
  onEditLead 
}: ContactDrawerProps) {
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    setShowPhone(false);
  }, [contact?.id]);

  if (!isOpen || !contact) return null;

  const rawOpp = contact.opportunities?.find((o: any) => o.stage !== 'closed_won' && o.stage !== 'closed_lost') || contact.active_opportunity;
  const activeOpp = (rawOpp && Number(rawOpp.id) > 0 && rawOpp.has_opportunity !== false) ? rawOpp : null;
  const qual = activeOpp?.buyer_qualification || {};

  const maskPhone = (phoneStr: string) => {
    if (!phoneStr) return '************';
    return phoneStr.replace(/\d/g, '*');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/25 backdrop-blur-2xs transition-opacity animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white border-l border-[#E8E4DC] shadow-2xl flex flex-col">
          
          {/* Top Contact Profile First Section */}
          <div className="p-6 border-b border-[#E8E4DC] relative bg-[#FAF8F5]">
            <button 
              onClick={onClose} 
              className="absolute right-5 top-4 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* First Section Sub-Header with Edit Option */}
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E8E4DC]/80 pr-8">
              <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase">CLIENT CONTACT PROFILE</span>
              <Link
                href={`/leads/${contact.id}/edit`}
                onClick={onClose}
                className="text-[11px] font-semibold text-[#6E6E6E] hover:text-[#081428] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Edit2 className="w-3 h-3 text-[#C8A147]" />
                <span>Edit</span>
              </Link>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[#F3EEDD] border border-[#C8A147]/40 text-[#081428] font-heading font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
                {contact.initials || contact.name?.substring(0, 2).toUpperCase() || 'CT'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-heading font-bold text-lg text-[#081428]">{contact.name}</h2>
                  {contact.state === 'duplicate' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-300">
                      <Copy className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                      <span>Duplicate</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#6E6E6E] space-y-0.5">
                  <div>{contact.nationality || 'Emirati'}</div>
                  <div className="text-[11px] text-slate-500">Arabic / English</div>
                  
                  {/* Phone Masking & Toggle on Direct Click */}
                  <div 
                    onClick={() => setShowPhone(!showPhone)}
                    className="flex items-center gap-2 font-medium text-[#081428] pt-1 cursor-pointer select-none group w-fit"
                    title={showPhone ? "Click to hide phone number" : "Click to reveal phone number"}
                  >
                    <Phone className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                    <span className="font-mono text-xs group-hover:text-[#C8A147] transition-colors">
                      {showPhone ? contact.phone : maskPhone(contact.phone)}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#6E6E6E]">{contact.email || 'ahmed.alrashidi@gmail.com'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white text-xs">
            
            {/* ACTIVE OPPORTUNITY Box */}
            {activeOpp ? (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase">ACTIVE OPPORTUNITY</span>
                  <Link 
                    href={`/opportunities/${activeOpp.id}`}
                    onClick={onClose}
                    className="text-[11px] font-semibold text-[#6E6E6E] hover:text-[#081428] flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3 text-[#C8A147]" />
                    <span>Edit</span>
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#D93838]" />
                    <span className="font-bold text-[#081428] text-xs">
                      {activeOpp.opportunity_type ? activeOpp.opportunity_type.charAt(0).toUpperCase() + activeOpp.opportunity_type.slice(1) : 'Buyer'} · <span className="text-[#D93838] uppercase">{activeOpp.temperature || 'HOT'}</span>
                    </span>
                  </div>

                  <div className="font-bold text-[#081428] text-sm">
                    AED {(activeOpp.budget_min/1000000).toFixed(1)}M – {(activeOpp.budget_max/1000000).toFixed(1)}M
                  </div>

                  <div className="text-xs text-[#6E6E6E]">
                    {qual.community || 'Downtown Dubai'} – {qual.bedrooms || '2BR'} {qual.property_type || 'Apartment'}
                  </div>

                  {/* Score Progress Bar */}
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-[#6E6E6E]">Score {qual.lead_score || 84} / 100</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#E8E4DC] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#C8A147] rounded-full" 
                        style={{ width: `${qual.lead_score || 84}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-[#C8A147]">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">Awaiting Qualification</span>
                </div>
                <p className="text-[11px] text-[#6E6E6E]">
                  This contact has no active deal yet. Deals are qualified and created from the <strong className="text-[#081428]">My Queue</strong> calling desk.
                </p>
                {contact.assigned_to && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#E8E4DC] rounded text-[11px] text-[#081428] font-medium mt-1">
                    <span className="text-[#6E6E6E]">Assigned Advisor:</span>
                    <strong className="text-[#C8A147] font-semibold">{contact.assigned_to}</strong>
                  </div>
                )}
              </div>
            )}

            {/* UTM Campaign Attribution Details */}
            {(contact.utm_source || contact.utm_medium || contact.utm_campaign || contact.utm_term || contact.utm_content || contact.landing_page_url) && (
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#C8A147] uppercase flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>CAMPAIGN ATTRIBUTION</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">UTM</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {contact.utm_source && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Source</span>
                      <span className="font-semibold text-[#081428]">{contact.utm_source}</span>
                    </div>
                  )}
                  {contact.utm_medium && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Medium</span>
                      <span className="font-semibold text-[#081428]">{contact.utm_medium}</span>
                    </div>
                  )}
                  {contact.utm_campaign && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC] col-span-2">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Campaign</span>
                      <span className="font-semibold text-[#081428]">{contact.utm_campaign}</span>
                    </div>
                  )}
                  {contact.utm_term && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Term / Keyword</span>
                      <span className="font-semibold text-[#081428]">{contact.utm_term}</span>
                    </div>
                  )}
                  {contact.utm_content && (
                    <div className="bg-white p-2 rounded border border-[#E8E4DC]">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Content</span>
                      <span className="font-semibold text-[#081428]">{contact.utm_content}</span>
                    </div>
                  )}
                  {(contact.landing_page_url || contact.campaign_url) && (
                    <div className="bg-white p-2.5 rounded border border-[#E8E4DC] col-span-2 space-y-1">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-[#C8A147]" />
                          <span>Campaign / Landing Page URL</span>
                        </span>
                        <a
                          href={contact.campaign_url || contact.landing_page_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#C8A147] hover:underline flex items-center gap-0.5 lowercase text-[10px]"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </span>
                      <a
                        href={contact.campaign_url || contact.landing_page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 font-mono break-all line-clamp-2 block underline underline-offset-2"
                      >
                        {contact.campaign_url || contact.landing_page_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CURRENT OWNER Section */}
            {activeOpp && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider text-[#6E6E6E] uppercase">CURRENT OWNER</span>
                <div className="flex items-center justify-between p-3 border border-[#E8E4DC] rounded-lg bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#081428] text-white font-bold text-xs flex items-center justify-center">
                      MK
                    </div>
                    <div>
                      <div className="font-bold text-[#081428]">{activeOpp.current_owner_name || 'Mako'}</div>
                      <div className="text-[11px] text-[#6E6E6E]">{activeOpp.department === 'sales' ? 'Sales Advisor' : 'Telesales Agent'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 border border-[#E8E4DC] rounded-md text-slate-600 hover:bg-slate-100 transition-colors">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-2 border border-[#E8E4DC] rounded-md text-slate-600 hover:bg-slate-100 transition-colors">
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* NEXT ACTION Section */}
            {activeOpp && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider text-[#6E6E6E] uppercase">NEXT ACTION</span>
                <div className="p-4 border border-[#E8E4DC] rounded-lg bg-white space-y-3">
                  <div className="font-bold text-[#081428] text-xs">
                    {activeOpp.next_action || 'Call client Today, 2:00 PM'}
                  </div>
                  <div className="text-[11px] text-[#6E6E6E]">
                    Today, 2:00 PM
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>22 minutes remaining</span>
                  </div>

                  <Link 
                    href={`/opportunities/${activeOpp.id}`}
                    onClick={onClose}
                    className="w-full py-2.5 bg-[#081428] hover:bg-[#122444] text-white font-semibold text-xs rounded-md text-center block transition-colors shadow-xs"
                  >
                    Open Opportunity
                  </Link>
                </div>
              </div>
            )}

            {/* RECENT ACTIVITY Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#6E6E6E] uppercase">RECENT ACTIVITY</span>
                <button className="text-[11px] text-[#C8A147] font-semibold hover:underline">View all</button>
              </div>

              <div className="space-y-3.5 pl-2 border-l border-[#E8E4DC]">
                {contact.activities && contact.activities.length > 0 ? (
                  contact.activities.map((act: any) => (
                    <div key={act.id} className="relative pl-4 space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#081428] capitalize">
                          {act.type} {act.call_outcome ? `· ${act.call_outcome}` : ''}
                        </span>
                        <span className="text-[10px] text-[#6E6E6E]">
                          {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6E6E6E]">{act.description}</div>
                      <div className="text-[10px] text-slate-400">by {act.user_name || 'Mako'}</div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="relative pl-4 space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#081428]">Call · Interested</span>
                        <span className="text-[10px] text-[#6E6E6E]">Today, 09:05 AM</span>
                      </div>
                      <div className="text-[11px] text-[#6E6E6E]">Interested · 4m 22s by Mako</div>
                    </div>
                    <div className="relative pl-4 space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#081428]">WhatsApp</span>
                        <span className="text-[10px] text-[#6E6E6E]">Yesterday, 06:12 PM</span>
                      </div>
                      <div className="text-[11px] text-[#6E6E6E]">Project brochure sent by Mako</div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
