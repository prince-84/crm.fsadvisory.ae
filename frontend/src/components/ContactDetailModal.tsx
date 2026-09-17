'use client';

import { useState, useEffect } from 'react';
import { 
  X, Phone, Mail, Clock, MessageSquare, 
  MapPin, DollarSign, Calendar, User, 
  Briefcase, Sparkles, Copy, Check, 
  ExternalLink, Globe, Target, AlertCircle, 
  CheckCircle2, Flame, Building2, FileAudio,
  PhoneIncoming, PhoneOutgoing, Send, Download, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';

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
  const [modalTab, setModalTab] = useState<'profile' | 'recordings' | 'whatsapp'>('profile');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [whatsAppMessages, setWhatsAppMessages] = useState<any[]>([]);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [whatsAppChat, setWhatsAppChat] = useState<any | null>(null);
  const [newWhatsAppMsg, setNewWhatsAppMsg] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => {
    setShowPhone(false);
    setModalTab('profile');
    if (contact?.id) {
      setLoadingRecordings(true);
      fetchApi(`/recordings?contact_id=${contact.id}&per_page=50`)
        .then((res) => {
          if (res && res.recordings && res.recordings.data) {
            setRecordings(res.recordings.data);
          } else if (res && res.data) {
            setRecordings(res.data);
          } else {
            setRecordings([]);
          }
        })
        .catch(() => setRecordings([]))
        .finally(() => setLoadingRecordings(false));

      setLoadingWhatsApp(true);
      fetchApi(`/whatsapp/contact-history?contact_id=${contact.id}`)
        .then((res) => {
          if (res && res.success) {
            setWhatsAppChat(res.chat || null);
            setWhatsAppMessages(res.messages || []);
          } else {
            setWhatsAppMessages([]);
          }
        })
        .catch(() => setWhatsAppMessages([]))
        .finally(() => setLoadingWhatsApp(false));
    }
  }, [contact?.id]);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSendModalWhatsApp = async () => {
    if (!newWhatsAppMsg.trim() || !contact) return;
    setSendingWhatsApp(true);
    try {
      const phone = contact.phone || '';
      if (whatsAppChat?.id) {
        await fetchApi(`/whatsapp/chats/${whatsAppChat.id}/send`, {
          method: 'POST',
          body: JSON.stringify({ text: newWhatsAppMsg.trim() }),
        });
      } else {
        await fetchApi('/whatsapp/chats/start', {
          method: 'POST',
          body: JSON.stringify({
            phone: phone,
            contact_name: contact.name,
            initial_message: newWhatsAppMsg.trim(),
          }),
        });
      }
      setNewWhatsAppMsg('');
      const res = await fetchApi(`/whatsapp/contact-history?contact_id=${contact.id}`);
      if (res && res.success) {
        setWhatsAppChat(res.chat || null);
        setWhatsAppMessages(res.messages || []);
      }
    } catch (err: any) {
      console.error('Failed to send WhatsApp message:', err);
    } finally {
      setSendingWhatsApp(false);
    }
  };

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
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-['Poppins',sans-serif] cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-[#E8E4DC] rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
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

        {/* Tab Switcher */}
        <div className="bg-[#081428] px-5 py-2 flex items-center gap-2 border-b border-white/10 text-xs shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setModalTab('profile')}
            className={`px-3 py-1.5 rounded font-bold text-xs transition-colors cursor-pointer whitespace-nowrap ${
              modalTab === 'profile' ? 'bg-[#C8A147] text-[#081428]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Profile & Requirements
          </button>
          <button
            type="button"
            onClick={() => setModalTab('recordings')}
            className={`px-3 py-1.5 rounded font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              modalTab === 'recordings' ? 'bg-[#C8A147] text-[#081428]' : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Call Recordings ({recordings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('whatsapp')}
            className={`px-3 py-1.5 rounded font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              modalTab === 'whatsapp' ? 'bg-[#C8A147] text-[#081428]' : 'text-slate-300 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp Chat ({whatsAppMessages.length})</span>
          </button>
        </div>

        {/* Modal Body (Scrollable Read-Only Information) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FAF8F5] text-xs">
          {modalTab === 'profile' && (
            <>
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
            </>
          )}

          {/* Tab 2: Call Audio Recordings */}
          {modalTab === 'recordings' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8E4DC]">
                <div>
                  <h4 className="text-xs font-bold text-[#081428] uppercase tracking-wide flex items-center gap-1.5">
                    <FileAudio className="w-4 h-4 text-[#C8A147]" />
                    <span>Client Call Recordings ({recordings.length})</span>
                  </h4>
                  <p className="text-[11px] text-[#6E6E6E]">
                    Audio call records linked to {contact.name || 'this client'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (contact?.id) {
                      setLoadingRecordings(true);
                      fetchApi(`/recordings?contact_id=${contact.id}&per_page=50`)
                        .then((res) => {
                          if (res && res.recordings && res.recordings.data) {
                            setRecordings(res.recordings.data);
                          } else if (res && res.data) {
                            setRecordings(res.data);
                          } else {
                            setRecordings([]);
                          }
                        })
                        .catch(() => setRecordings([]))
                        .finally(() => setLoadingRecordings(false));
                    }
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-[#081428] transition-colors cursor-pointer"
                  title="Refresh recordings"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRecordings ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingRecordings ? (
                <div className="p-8 text-center text-xs text-[#6E6E6E]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#C8A147] mx-auto mb-2" />
                  <span>Loading call recordings...</span>
                </div>
              ) : recordings.length > 0 ? (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {recordings.map((rec: any) => {
                    const audioSrc = getPlayableAudioUrl(rec.audio_url, rec.id);
                    const isIncoming = rec.direction === 'inbound';
                    return (
                      <div
                        key={rec.id}
                        className="bg-white p-3.5 rounded-xl border border-[#E8E4DC] shadow-2xs space-y-2 hover:border-[#C8A147]/50 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-full ${
                                isIncoming ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}
                              title={isIncoming ? 'Inbound Client Call' : 'Outbound Advisor Call'}
                            >
                              {isIncoming ? (
                                <PhoneIncoming className="w-3.5 h-3.5" />
                              ) : (
                                <PhoneOutgoing className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <div>
                              <div className="font-bold text-[#081428] text-xs">
                                {isIncoming ? 'Inbound Call' : 'Outbound Call'} ·{' '}
                                <span className="font-mono text-[11px] text-[#6E6E6E]">
                                  {rec.duration_formatted || (rec.duration ? `${rec.duration}s` : '00:00')}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {rec.call_start ? new Date(rec.call_start).toLocaleString() : '—'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {rec.extension && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                Ext {rec.extension}
                              </span>
                            )}
                            {audioSrc && (
                              <a
                                href={audioSrc}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                title="Download Audio File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Audio Streaming Player */}
                        {audioSrc && (
                          <div className="pt-1">
                            <audio controls preload="none" className="w-full h-8 rounded accent-[#C8A147]">
                              <source src={audioSrc} type="audio/wav" />
                              <source src={audioSrc} type="audio/mpeg" />
                              Your browser does not support audio playback.
                            </audio>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-[#FAF8F5]">
                          <span>Advisor: <strong>{rec.agent_name || rec.user?.name || 'Assigned Agent'}</strong></span>
                          <span className="font-mono text-slate-400">{rec.caller_number || rec.destination_number || ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 bg-white border border-dashed border-[#E8E4DC] rounded-xl text-center space-y-2">
                  <FileAudio className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-xs font-bold text-[#081428]">No Call Audio Recordings Found</div>
                  <p className="text-[11px] text-[#6E6E6E] max-w-sm mx-auto">
                    When calls are conducted with this client phone number via the telephony system, call recordings will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: WhatsApp Chat History */}
          {modalTab === 'whatsapp' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8E4DC]">
                <div>
                  <h4 className="text-xs font-bold text-[#081428] uppercase tracking-wide flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp Conversation</span>
                  </h4>
                  <p className="text-[11px] text-[#6E6E6E]">
                    Direct chat with {contact.name || 'Client'} ({contact.phone || 'No phone'})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/whatsapp?phone=${encodeURIComponent(contact.phone || '')}&name=${encodeURIComponent(contact.name || '')}`}
                    onClick={onClose}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <span>Open in WhatsApp</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (contact?.id) {
                        setLoadingWhatsApp(true);
                        fetchApi(`/whatsapp/contact-history?contact_id=${contact.id}`)
                          .then((res) => {
                            if (res && res.success) {
                              setWhatsAppChat(res.chat || null);
                              setWhatsAppMessages(res.messages || []);
                            } else {
                              setWhatsAppMessages([]);
                            }
                          })
                          .catch(() => setWhatsAppMessages([]))
                          .finally(() => setLoadingWhatsApp(false));
                      }
                    }}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-[#081428] transition-colors cursor-pointer"
                    title="Refresh chat"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingWhatsApp ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Messages Feed */}
              {loadingWhatsApp ? (
                <div className="p-8 text-center text-xs text-[#6E6E6E]">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600 mx-auto mb-2" />
                  <span>Loading WhatsApp conversation...</span>
                </div>
              ) : whatsAppMessages.length > 0 ? (
                <div className="p-4 bg-[#EFEAE2] rounded-xl border border-[#E8E4DC] max-h-[360px] overflow-y-auto space-y-2.5 text-xs">
                  {whatsAppMessages.map((msg: any, mIdx: number) => {
                    const isMe = msg.from_me;
                    return (
                      <div
                        key={msg.id || mIdx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`p-2.5 rounded-xl max-w-[80%] shadow-2xs text-xs space-y-0.5 ${
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
                <div className="p-8 bg-white border border-dashed border-[#E8E4DC] rounded-xl text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="text-xs font-bold text-[#081428]">No WhatsApp Messages Yet</div>
                  <p className="text-[11px] text-[#6E6E6E] max-w-sm mx-auto">
                    Type a message below to start chatting with {contact.name || 'this client'} directly on WhatsApp.
                  </p>
                </div>
              )}

              {/* Inline Quick Message Sender */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newWhatsAppMsg}
                  onChange={(e) => setNewWhatsAppMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendModalWhatsApp();
                    }
                  }}
                  placeholder="Type a WhatsApp message to client..."
                  className="flex-1 p-2.5 bg-white border border-[#E8E4DC] rounded-lg text-xs text-[#081428] focus:border-emerald-500 focus:outline-none shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleSendModalWhatsApp}
                  disabled={sendingWhatsApp || !newWhatsAppMsg.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs font-semibold text-xs flex items-center gap-1.5"
                >
                  {sendingWhatsApp ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send</span>
                </button>
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
