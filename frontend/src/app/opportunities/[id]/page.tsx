'use client';

import { useState, useEffect, use } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import SalesHandoverModal from '@/components/SalesHandoverModal';
import SendEmailModal from '@/components/SendEmailModal';
import SearchableSelect from '@/components/SearchableSelect';
import { fetchApi } from '@/lib/api';
import { 
  Building2, User, Phone, Mail, Clock, ShieldCheck, Flame, 
  CheckCircle2, ArrowRight, Activity as ActivityIcon, MessageSquare, Plus, FileText, Sparkles, RotateCcw, Loader2,
  DollarSign, MapPin, Compass, Layers, Globe, Tag, Award, Wallet, Building, Save, Briefcase, Edit3, History, X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

const OPPORTUNITY_TYPES = [
  { value: 'buyer', label: 'Buyer Opportunity' },
  { value: 'seller', label: 'Seller Opportunity' },
  { value: 'landlord', label: 'Landlord Opportunity' },
  { value: 'tenant', label: 'Tenant Opportunity' },
];

const TEMPERATURES = [
  { value: 'hot', label: '🔴 HOT (Immediate / Ready to proceed)' },
  { value: 'warm', label: '🟠 WARM (1–3 Months / Nurturing)' },
  { value: 'cold', label: '🔵 COLD (Long-Term Potential)' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Ready Cash / Equity' },
  { value: 'mortgage', label: 'Bank Mortgage Approved' },
  { value: 'offplan_plan', label: 'Off-Plan Payment Plan' },
];

const INITIAL_DEVELOPERS = [
  'Emaar Properties',
  'Nakheel',
  'DAMAC Properties',
  'Sobha Realty',
  'Meraas',
  'Dubai Holding',
  'Select Group',
  'Danube Properties',
  'Binghatti',
  'Aldar Properties',
  'Azizi Developments',
  'Deyaar',
  'Ellington Properties',
  'Omniyat',
  'Samana Developers',
];

const INITIAL_COMMUNITIES = [
  'Downtown Dubai',
  'Palm Jumeirah',
  'Business Bay',
  'Dubai Marina',
  'Dubai Hills Estate',
  'Jumeirah Golf Estates',
  'Arabian Ranches',
  'Dubai Creek Harbour',
  'MBR City (Sobha Hartland)',
  'Emaar Beachfront',
];

const INITIAL_PROJECTS = [
  'Burj Crown',
  'Palm Beach Towers',
  'Creek Horizon',
  'Marina Vista',
  'Address Residences',
  'Sobha Waves',
  'Act One Act Two',
  'Damac Lagoons',
];

const INITIAL_PROJECT_PROPERTIES: Record<string, string[]> = {
  'Burj Crown': ['1BR Executive Suite', '2BR Luxury Apartment', '3BR Sky Collection'],
  'Palm Beach Towers': ['1BR Waterfront Suite', '2BR Panoramic Beachfront', '3BR Royal Residence', '4BR Duplex Penthouse'],
  'Creek Horizon': ['1BR Boulevard View', '2BR Creek Park View', '3BR Waterfront Tower A'],
  'Marina Vista': ['1BR Sea View', '2BR Marina Skyline View', '3BR Beachfront Luxury'],
  'Address Residences': ['1BR Serviced Luxury', '2BR Burj View Suite', '3BR Sky Collection'],
  'Sobha Waves': ['1BR Waterfront Apartment', '2BR Canal View Suite'],
  'Act One Act Two': ['1BR Opera District Suite', '2BR Boulevard Residence', '3BR Penthouse'],
  'Damac Lagoons': ['4BR Mediterranean Villa', '5BR Luxury Cluster Villa', '6BR Venetian Mansion'],
};

const PROPERTY_TYPES = [
  'Apartment',
  'Villa / Mansion',
  'Townhouse',
  'Penthouse',
  'Duplex',
  'Land Plot',
  'Commercial Office',
];

const BEDROOMS = [
  'Studio',
  '1 BR',
  '2 BR',
  '3 BR',
  '4 BR',
  '5+ BR',
];

const ASSIGNED_OWNERS = [
  { value: 'Faraz Shafi', label: 'Faraz Shafi (Sales Manager / CEO)' },
  { value: 'Mako', label: 'Mako (Telesales Senior)' },
  { value: 'Hiba', label: 'Hiba (Telesales Advisor)' },
];

const parseRequirementDiff = (desc: string) => {
  if (!desc) return [];
  const lines = desc.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.toLowerCase().includes('requirements modified'));

  return lines.map(line => {
    const clean = line.replace(/^[•\-\*\s]+/, '').trim();
    const parts = clean.split('➔');
    if (parts.length === 2) {
      const left = parts[0].trim();
      const newVal = parts[1].trim().replace(/^['"]|['"]$/g, '');
      const colonIdx = left.indexOf(':');
      if (colonIdx > -1) {
        const field = left.slice(0, colonIdx).trim();
        const oldVal = left.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        return { field, oldVal, newVal };
      }
      return { field: 'Updated', oldVal: left, newVal };
    }
    const colonIdx = clean.indexOf(':');
    if (colonIdx > -1) {
      return {
        field: clean.slice(0, colonIdx).trim(),
        oldVal: '',
        newVal: clean.slice(colonIdx + 1).trim(),
      };
    }
    return { field: 'Update', oldVal: '', newVal: clean };
  });
};

export default function OpportunityWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: oppId } = use(params);
  const [opp, setOpp] = useState<any | null>(null);
  const [aiScore, setAiScore] = useState<any | null>(null);
  const [predictingAi, setPredictingAi] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'history'>('overview');
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Section 3: Opportunity Requirements & Deal Specs (matching Lead Pool form)
  const [opportunityType, setOpportunityType] = useState('buyer');
  const [temperature, setTemperature] = useState('hot');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [developer, setDeveloper] = useState('Emaar Properties');
  const [community, setCommunity] = useState('Downtown Dubai');
  const [project, setProject] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bedrooms, setBedrooms] = useState('2 BR');
  const [projectProperty, setProjectProperty] = useState('');
  const [budgetMin, setBudgetMin] = useState('1800000');
  const [budgetMax, setBudgetMax] = useState('2200000');
  const [keyRequirement, setKeyRequirement] = useState('');
  const [assignedOwner, setAssignedOwner] = useState('Faraz Shafi');
  const [summaryNoteText, setSummaryNoteText] = useState('');
  const [savingSummaryNote, setSavingSummaryNote] = useState(false);

  // Next Action & SLA schedule states
  const [nextAction, setNextAction] = useState('');
  const [nextDueDate, setNextDueDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [submittingAct, setSubmittingAct] = useState(false);

  const handleProjectChange = (val: string) => {
    setProject(val);
    setProjectProperty('');
  };

  const currentProjectProperties = project && INITIAL_PROJECT_PROPERTIES[project]
    ? INITIAL_PROJECT_PROPERTIES[project]
    : [];

  const loadOpportunity = async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      if (!oppId || Number(oppId) <= 0 || isNaN(Number(oppId))) {
        setLoadError(`Opportunity #${oppId} does not exist. This lead has not been converted to an opportunity deal yet.`);
        setOpp(null);
        setLoading(false);
        return;
      }
      const data = await fetchApi(`/opportunities/${oppId}`);
      if (!data || data.message || data.error) {
        setLoadError(data.message || 'Opportunity record not found.');
        setOpp(null);
        setLoading(false);
        return;
      }
      setOpp(data);
      
      const bQual = data.buyer_qualification || {};
      const sQual = data.seller_qualification || {};
      const lQual = data.landlord_qualification || {};

      setOpportunityType(data.opportunity_type || 'buyer');
      setTemperature(data.temperature || 'hot');
      setPaymentMethod(bQual.cash_or_finance || 'cash');
      setDeveloper(bQual.developer || data.developer || 'Emaar Properties');
      setCommunity(bQual.community || sQual.community || lQual.community || data.community || 'Downtown Dubai');
      setProject(bQual.project || data.project || '');
      setPropertyType(bQual.property_type || data.property_type || 'Apartment');
      setBedrooms(bQual.bedrooms || data.bedrooms || '2 BR');
      setProjectProperty(bQual.project_property || data.project_property || '');
      setBudgetMin(String(data.budget_min ?? 1800000));
      setBudgetMax(String(data.budget_max ?? 2200000));
      setKeyRequirement(data.key_requirement || '');
      setAssignedOwner(data.current_owner_name || 'Faraz Shafi');

      if (data.next_action) setNextAction(data.next_action);
      if (data.next_action_due_at) setNextDueDate(data.next_action_due_at.slice(0, 16));
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load opportunity workspace:', err);
      setLoadError(err.message || 'Opportunity record could not be loaded.');
      setOpp(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunity();
  }, [oppId]);

  const handleDirectStageChange = async (newStage: string) => {
    if (updatingStageId || opp?.stage === newStage) return;

    setUpdatingStageId(newStage);
    setOpp((prev: any) => (prev ? { ...prev, stage: newStage } : prev));

    try {
      await fetchApi(`/opportunities/${oppId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: newStage }),
      });

      Swal.fire({
        icon: 'success',
        title: 'Stage Updated!',
        text: `Opportunity stage updated to "${newStage.replace('_', ' ').toUpperCase()}".`,
        timer: 1400,
        showConfirmButton: false,
      });

      await loadOpportunity(true);
    } catch (err: any) {
      console.error('Failed to update stage:', err);
      Swal.fire('Error', err.message || 'Failed to update opportunity stage.', 'error');
      await loadOpportunity(true);
    } finally {
      setUpdatingStageId(null);
    }
  };

  const handleDirectOpportunityTypeChange = async (newType: string) => {
    try {
      await fetchApi(`/opportunities/${oppId}/qualify`, {
        method: 'POST',
        body: JSON.stringify({ opportunity_type: newType }),
      });
      setActiveTab('overview');
      loadOpportunity();
    } catch (err) {
      console.error('Failed to update opportunity type:', err);
      alert('Failed to update opportunity type.');
    }
  };

  const handleReleaseToBank = async () => {
    const reason = prompt("Enter reason for releasing lead back to Available Lead Bank:", "Client currently not looking; released to Available Lead Bank.");
    if (!reason) return;

    setReleasing(true);
    try {
      const res = await fetchApi(`/opportunities/${oppId}/release-to-bank`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      alert(res.message);
      setReleasing(false);
      loadOpportunity();
    } catch (err) {
      alert('Failed to release lead to bank');
      setReleasing(false);
    }
  };

  const handlePredictAi = async () => {
    setPredictingAi(true);
    try {
      const aiData = await fetchApi(`/opportunities/${oppId}/ai-predict`, { method: 'POST' });
      setAiScore(aiData);
      setPredictingAi(false);
    } catch (err) {
      console.error('AI prediction failed:', err);
      setPredictingAi(false);
    }
  };

  const handleUpdateNextAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opp || !nextAction.trim()) return;
    setSubmittingAct(true);

    try {
      const selectedIsoDate = nextDueDate ? new Date(nextDueDate).toISOString() : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const formattedDate = nextDueDate ? new Date(nextDueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Immediate';

      await fetchApi('/activities', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: opp.contact_id,
          opportunity_id: opp.id,
          type: 'task',
          description: `Scheduled Next Action: "${nextAction.trim()}" (Due: ${formattedDate})`,
          user_name: opp.current_owner_name || 'Advisor',
          next_action: nextAction.trim(),
          next_action_due_at: selectedIsoDate,
        }),
      });

      // Sync to Calendar page events list
      if (syncToCalendar && nextDueDate) {
        try {
          const datePart = nextDueDate.split('T')[0];
          const timePartStr = new Date(nextDueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newCalEvent = {
            id: `ev-${Date.now()}`,
            title: `ACTION: ${nextAction.trim()}`,
            category: 'viewing',
            date: datePart,
            time: timePartStr,
            clientName: opp.contact?.name || 'Client',
            clientPhone: opp.contact?.phone || 'N/A',
            agentName: opp.current_owner_name || 'Agent',
            location: 'Client Meeting / Viewing',
            status: 'scheduled',
            priority: 'high',
            notes: `Next Action scheduled: ${nextAction.trim()}`,
          };

          const existingStr = localStorage.getItem('fs_calendar_events');
          const existing = existingStr ? JSON.parse(existingStr) : [];
          localStorage.setItem('fs_calendar_events', JSON.stringify([newCalEvent, ...existing]));
        } catch (e) {
          console.error('Calendar sync error:', e);
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Next Action & SLA Updated!',
        text: `Next action scheduled for ${formattedDate} and SLA clock reset.`,
        timer: 1800,
        showConfirmButton: false,
      });

      setSubmittingAct(false);
      loadOpportunity(true);
    } catch (err: any) {
      console.error('Failed to update next action:', err);
      Swal.fire('Error', err.message || 'Failed to update next action.', 'error');
      setSubmittingAct(false);
    }
  };

  const handleSaveSummaryNote = async () => {
    if (!opp || !summaryNoteText.trim()) return;
    setSavingSummaryNote(true);
    try {
      await fetchApi('/activities', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: opp.contact_id,
          opportunity_id: opp.id,
          type: 'note',
          description: summaryNoteText.trim(),
          user_name: opp.current_owner_name || 'Advisor',
        }),
      });

      setSummaryNoteText('');
      await loadOpportunity(true);
      Swal.fire({
        icon: 'success',
        title: 'Note Saved!',
        text: 'Summary note recorded successfully.',
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error('Failed to save summary note:', err);
      Swal.fire('Error', err.message || 'Failed to save note.', 'error');
    } finally {
      setSavingSummaryNote(false);
    }
  };

  const handleSendWhatsApp = () => {
    const phone = opp?.contact?.phone || '';
    const name = opp?.contact?.name || '';
    router.push(`/whatsapp?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-xs text-[#6E6E6E]">
        Loading Opportunity Workspace...
      </div>
    );
  }

  if (loadError || (!loading && !opp)) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex font-['Poppins',sans-serif]">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col min-w-0">
          <Navbar />
          <div className="p-8 max-w-md mx-auto my-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-[#C8A147] flex items-center justify-center mx-auto shadow-xs">
              <Briefcase className="w-8 h-8" />
            </div>
            <h2 className="font-heading font-bold text-xl text-[#081428]">Opportunity Not Found</h2>
            <p className="text-xs text-[#6E6E6E] leading-relaxed">
              {loadError || 'This opportunity deal does not exist or has not been created yet.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/queue"
                className="px-4 py-2 bg-[#081428] hover:bg-[#122444] text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
              >
                Return to My Queue
              </Link>
              <Link
                href="/opportunities"
                className="px-4 py-2 bg-white hover:bg-slate-50 text-[#081428] border border-[#E8E4DC] font-bold text-xs rounded-lg transition-colors"
              >
                All Deals
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const contact = opp.contact || {};
  const qual = opp.buyer_qualification || {};
  const sellerQual = opp.seller_qualification || {};

  const dynamicTabs = [
    { id: 'overview', label: 'Overview & Requirements' },
    { id: 'activity', label: 'Activity Timeline' },
    { id: 'history', label: 'Ownership Log' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full">
          {/* Header Block */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#6E6E6E] uppercase">Opportunity #{opp.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    opp.temperature === 'hot' ? 'bg-red-100 text-red-700 border border-red-200' :
                    opp.temperature === 'warm' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    {opp.temperature}
                  </span>
                </div>
                <h1 className="font-heading font-bold text-2xl text-[#081428] tracking-tight">
                  {contact.name} — <span className="uppercase">{opp.opportunity_type} Opportunity</span>
                </h1>
                <p className="text-xs text-[#6E6E6E] flex items-center gap-3">
                  <span>Phone: <strong className="text-[#081428]">{contact.phone}</strong></span>
                  <span>•</span>
                  <span>Email: <strong className="text-[#081428]">{contact.email || 'N/A'}</strong></span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                <button
                  onClick={handleReleaseToBank}
                  disabled={releasing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#081428] border border-slate-300 font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  title="Close deal and revert Contact to Available state in Lead Bank"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span className="whitespace-nowrap">{releasing ? 'Releasing...' : 'Release to Bank'}</span>
                </button>

                <button
                  onClick={handleSendWhatsApp}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">WhatsApp Brochure</span>
                </button>

                <button
                  onClick={() => setIsEmailModalOpen(true)}
                  className="px-3 py-1.5 bg-[#0F2244] hover:bg-[#1A335E] text-[#C9A84C] border border-[#C9A84C]/40 font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Send luxury property proposal, viewing invitation, or CMA valuation via official SMTP"
                >
                  <Mail className="w-3.5 h-3.5 text-[#C9A84C] shrink-0" />
                  <span className="whitespace-nowrap">Send Property Email</span>
                </button>

                <button
                  onClick={() => setIsHandoverModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                  <span className="whitespace-nowrap">Hand Over to Sales</span>
                </button>
              </div>
            </div>

            {/* AI Prediction Widget Banner */}
            {aiScore && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-md text-xs space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-700" />
                    AI Purchase Intent Prediction: {aiScore.purchase_probability_pct}% Probability ({aiScore.intent_rating?.toUpperCase()})
                  </span>
                </div>
                <div className="font-medium text-slate-800">Recommendation: {aiScore.ai_recommendation}</div>
                <div className="text-[10px] text-purple-700">Signals: {aiScore.key_signals}</div>
              </div>
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-4 text-xs pt-1">
              <div>
                <div className="text-[10px] text-[#6E6E6E] font-semibold uppercase">Current Owner</div>
                <div className="font-bold text-[#081428] mt-0.5">{opp.current_owner_name} ({opp.department})</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6E6E6E] font-semibold uppercase">Originating Agent</div>
                <div className="font-semibold text-[#1A1A1A] mt-0.5">{opp.originating_agent_name}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6E6E6E] font-semibold uppercase">Budget / Listing Price</div>
                <div className="font-bold text-[#081428] mt-0.5">AED {(opp.budget_min/1000000).toFixed(1)}M – {(opp.budget_max/1000000).toFixed(1)}M</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6E6E6E] font-semibold uppercase">Qualification Score</div>
                <div className="font-bold text-emerald-700 mt-0.5">{qual.lead_score || 84} / 100</div>
              </div>
            </div>
          </div>

          {/* Main Grid Workspace & Right Action Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2 Columns: Tabbed Contents */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* BITRIX24-STYLE STAGE CHEVRON PIPELINE BAR */}
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#6E6E6E] px-1 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-[#081428]">
                    <Sparkles className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>Bitrix24 Deal Pipeline Stage Bar</span>
                  </div>
                  <span className="text-[#C8A147] font-mono text-[10px]">1-Click Instant DB Sync</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 font-semibold text-xs">
                  {[
                    { id: 'contacted', label: '1. Contacted', activeBg: 'bg-sky-600 text-white ring-2 ring-sky-300' },
                    { id: 'qualified', label: '2. Qualified', activeBg: 'bg-blue-600 text-white ring-2 ring-blue-300' },
                    { id: 'option_sent', label: '3. Option Sent', activeBg: 'bg-indigo-600 text-white ring-2 ring-indigo-300' },
                    { id: 'follow_up', label: '4. Follow up', activeBg: 'bg-amber-600 text-white ring-2 ring-amber-300' },
                    { id: 'meeting', label: '5. Meeting', activeBg: 'bg-purple-600 text-white ring-2 ring-purple-300' },
                    { id: 'future_prospectus', label: '6. Future Prospectus', activeBg: 'bg-teal-600 text-white ring-2 ring-teal-300' },
                    { id: 'closed', label: '7. Closed 🏆', activeBg: 'bg-emerald-600 text-white ring-2 ring-emerald-300' },
                  ].map((st, idx) => {
                    const normalizeStage = (s: string) => {
                      if (!s) return 'contacted';
                      const lower = s.toLowerCase();
                      if (lower === 'new' || lower === 'contacted') return 'contacted';
                      if (lower === 'qualification' || lower === 'qualified') return 'qualified';
                      if (lower === 'option_sent' || lower === 'handover_pending' || lower === 'handover') return 'option_sent';
                      if (lower === 'follow_up' || lower === 'followup') return 'follow_up';
                      if (lower === 'meeting' || lower === 'sales_in_progress') return 'meeting';
                      if (lower === 'future_prospectus' || lower === 'prospectus') return 'future_prospectus';
                      if (lower === 'closed' || lower === 'closed_won' || lower === 'closed_lost') return 'closed';
                      return lower;
                    };

                    const stagesOrder = ['contacted', 'qualified', 'option_sent', 'follow_up', 'meeting', 'future_prospectus', 'closed'];
                    const currentStage = normalizeStage(opp.stage);
                    
                    const currentIdx = stagesOrder.indexOf(currentStage);
                    const isCurrent = currentStage === st.id;
                    const isPassed = currentIdx >= 0 && idx < currentIdx;

                    return (
                      <button
                        key={st.id}
                        disabled={updatingStageId !== null}
                        onClick={() => handleDirectStageChange(st.id)}
                        className={`py-2.5 px-2 rounded-md font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 relative cursor-pointer shadow-2xs ${
                          isCurrent
                            ? `${st.activeBg} shadow-md scale-[1.02] z-10 font-extrabold`
                            : isPassed
                            ? 'bg-[#081428] text-[#C8A147] hover:bg-[#122444]'
                            : 'bg-[#FAF8F5] text-slate-700 border border-[#E8E4DC] hover:border-[#C8A147] hover:bg-amber-50/50'
                        } ${updatingStageId === st.id ? 'opacity-80 animate-pulse' : ''}`}
                        title={`Click to set stage to ${st.label}`}
                      >
                        {updatingStageId === st.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-current shrink-0" />
                        ) : isCurrent ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                        ) : isPassed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                        ) : null}
                        <span className="truncate">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-2 border-b border-[#E8E4DC] text-xs font-semibold overflow-x-auto">
                {dynamicTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === t.id ? 'border-[#C8A147] text-[#081428] font-bold bg-white' : 'border-transparent text-[#6E6E6E] hover:text-[#081428]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Overview & Requirements (Strictly Read-Only from Lead + Summary Notes) */}
              {activeTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  {/* SECTION 3: Opportunity Requirements & Deal Specs (Read-Only) */}
                  <div className="bg-white border border-[#E8E4DC] rounded-lg p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#C8A147]/10 flex items-center justify-center text-[#C8A147] shrink-0">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-heading font-bold text-sm text-[#081428] uppercase tracking-wider">
                            3. Opportunity Requirements & Property Preferences
                          </h3>
                          <p className="text-[10px] text-[#6E6E6E]">Client mandate recorded from lead intake (Read-Only)</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded bg-[#FAF8F5] text-[#6E6E6E] border border-[#E8E4DC] font-semibold">
                        Lead Ingestion Record
                      </span>
                    </div>

                    {/* Row 1: Commercial Deal Mandate (3 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Opportunity Type</span>
                        <div className="font-semibold text-xs text-[#081428] capitalize flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#C8A147]" />
                          <span>{opp.opportunity_type || 'Buyer'} Opportunity</span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Deal Temperature</span>
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            opp.temperature === 'hot' ? 'bg-red-100 text-red-700 border border-red-200' :
                            opp.temperature === 'warm' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {opp.temperature === 'hot' ? '🔴 HOT (Immediate / Ready)' : opp.temperature === 'warm' ? '🟠 WARM (1–3 Months)' : '🔵 COLD (Long-Term)'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Payment Method</span>
                        <div className="font-semibold text-xs text-[#081428] flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-[#C8A147]" />
                          <span>
                            {paymentMethod === 'cash' ? '💵 Ready Cash / Equity' :
                             paymentMethod === 'mortgage' ? '🏦 Bank Mortgage Approved' :
                             '💳 Off-Plan Payment Plan'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Location & Inventory Mandate (3 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-[#C8A147]" /> Master Developer
                        </span>
                        <div className="font-semibold text-xs text-[#081428] truncate">
                          {developer || qual.developer || opp.developer || 'Emaar Properties'}
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#C8A147]" /> Target Location / Community
                        </span>
                        <div className="font-semibold text-xs text-[#081428] truncate">
                          {community || qual.community || opp.community || 'Downtown Dubai'}
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold flex items-center gap-1">
                          <Layers className="w-3 h-3 text-[#C8A147]" /> Project
                        </span>
                        <div className="font-semibold text-xs text-[#081428] truncate">
                          {project || qual.project || opp.project || 'General Portfolio'}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Architectural Layout Specs (3 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold flex items-center gap-1">
                          <Compass className="w-3 h-3 text-[#C8A147]" /> Property Type
                        </span>
                        <div className="font-semibold text-xs text-[#081428] truncate">
                          {propertyType || qual.property_type || opp.property_type || 'Apartment'}
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Bedrooms Preference</span>
                        <div className="font-semibold text-xs text-[#081428] truncate">
                          {bedrooms || qual.bedrooms || opp.bedrooms || '2 BR'}
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Specific Unit</span>
                        <div className="font-semibold text-xs text-[#081428] truncate">
                          {projectProperty || qual.project_property || 'Open Selection'}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Budget & Financial Range (3 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Min Budget (AED)</span>
                        <div className="font-semibold text-xs text-[#081428]">
                          AED {opp.budget_min ? Number(opp.budget_min).toLocaleString() : Number(budgetMin).toLocaleString()}
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Max Budget (AED)</span>
                        <div className="font-semibold text-xs text-[#081428]">
                          AED {opp.budget_max ? Number(opp.budget_max).toLocaleString() : Number(budgetMax).toLocaleString()}
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1 flex flex-col justify-center">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Target Budget Range</span>
                        <div className="font-bold text-xs text-[#C8A147]">
                          AED {opp.budget_min ? Number(opp.budget_min).toLocaleString() : '1,800,000'} – {opp.budget_max ? Number(opp.budget_max).toLocaleString() : '2,200,000'}
                        </div>
                      </div>
                    </div>

                    {/* Row 5: Key Requirement Overview & Notes */}
                    <div className="p-3.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md space-y-1.5">
                      <span className="text-[10px] text-[#6E6E6E] uppercase font-bold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#C8A147]" /> Initial Intake Requirement Brief
                      </span>
                      <div className="text-[#1A1A1A] font-medium text-xs leading-relaxed italic">
                        "{opp.key_requirement || keyRequirement || 'No key requirement brief recorded.'}"
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: SLA Action & Ownership Governance (Read-Only) */}
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#081428] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-700" />
                        <span>4. SLA Next Action & Ownership Assignment</span>
                      </h4>
                      <span className="text-[10px] text-emerald-700 font-bold uppercase flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> SLA Status: {opp.sla_status === 'overdue' ? '🔴 Overdue' : '🟢 Compliant On Track'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-white border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Assigned Agent / Owner</span>
                        <div className="font-semibold text-xs text-[#081428] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#C8A147]" />
                          <span>{opp.current_owner_name || assignedOwner}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-white border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Immediate Next Action</span>
                        <div className="font-medium text-xs text-[#081428] truncate">
                          {opp.next_action || nextAction || 'Client Follow-up Required'}
                        </div>
                      </div>

                      <div className="p-3 bg-white border border-[#E8E4DC] rounded-md space-y-1">
                        <span className="text-[10px] text-[#6E6E6E] uppercase font-bold">Next Action Due Date & Time</span>
                        <div className="font-semibold text-xs text-[#081428]">
                          {opp.next_action_due_at ? new Date(opp.next_action_due_at).toLocaleString() : 'Not Set'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SUMMARY NOTES SECTION */}
                  <div className="bg-white border border-[#E8E4DC] rounded-lg p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#C8A147]" />
                        <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#081428]">
                          Summary Notes
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveSummaryNote}
                        disabled={savingSummaryNote || !summaryNoteText.trim()}
                        className="px-3 py-1.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingSummaryNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save</span>
                      </button>
                    </div>

                    {/* Textarea to type notes */}
                    <div>
                      <textarea
                        rows={3}
                        value={summaryNoteText}
                        onChange={(e) => setSummaryNoteText(e.target.value)}
                        placeholder="Type summary notes or updates regarding this deal..."
                        className="w-full p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-all resize-y"
                      />
                    </div>

                    {/* Summary Notes List Display (Chronological with Date & Time) */}
                    <div className="space-y-2.5 pt-2 border-t border-[#E8E4DC]/60">
                      <div className="text-[11px] font-bold text-[#6E6E6E] uppercase tracking-wider flex items-center justify-between">
                        <span>Notes History</span>
                        <span>
                          {opp.activities ? opp.activities.filter((a: any) => a.type === 'note').length : 0} Notes
                        </span>
                      </div>

                      {opp.activities && opp.activities.filter((a: any) => a.type === 'note').length > 0 ? (
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {opp.activities
                            .filter((a: any) => a.type === 'note')
                            .map((note: any) => (
                              <div key={note.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-[#6E6E6E] border-b border-[#E8E4DC]/60 pb-1 flex-wrap gap-1">
                                  <span className="font-semibold text-[#081428] flex items-center gap-1">
                                    <User className="w-3 h-3 text-[#C8A147]" />
                                    <span>{note.user_name || 'Advisor'}</span>
                                  </span>
                                  <span className="text-[10px] text-[#6E6E6E] flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-[#6E6E6E]" />
                                    <span>
                                      {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </span>
                                </div>
                                <div className="text-[#1A1A1A] text-xs leading-relaxed whitespace-pre-line pt-0.5">
                                  {note.description}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-[#FAF8F5] border border-dashed border-[#E8E4DC] rounded-md text-center text-xs text-[#6E6E6E]">
                          No summary notes added yet. Type an update above and click "Save".
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Activity Timeline */}
              {activeTab === 'activity' && (
                <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs">
                  <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                    <h3 className="font-semibold text-sm text-[#081428] uppercase tracking-wider flex items-center gap-2">
                      <ActivityIcon className="w-4 h-4 text-[#C8A147]" />
                      <span>Opportunity Activity Logs & Timeline</span>
                    </h3>
                    <span className="text-[10px] text-[#6E6E6E]">
                      {opp.activities?.length || 0} Total Events
                    </span>
                  </div>
                  
                  <div className="space-y-4 pl-3 border-l-2 border-[#E8E4DC] ml-2 my-2">
                    {opp.activities && opp.activities.length > 0 ? (
                      [...(opp.activities)]
                        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((act: any) => (
                          <div key={act.id} className="relative pl-4 space-y-1">
                            {/* Marker dot on the timeline border */}
                            <div className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              act.type === 'requirement_change' ? 'bg-[#C8A147]' :
                              act.type === 'call' ? 'bg-blue-600' :
                              act.type === 'status_change' || act.type === 'stage_change' ? 'bg-emerald-600' :
                              'bg-[#081428]'
                            }`} />

                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <div className="text-xs font-semibold text-[#081428] flex items-center gap-1.5">
                                {act.type === 'requirement_change' ? (
                                  <span className="text-[#081428] font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
                                    <History className="w-3.5 h-3.5 text-[#C8A147]" />
                                    <span>Requirements Updated</span>
                                  </span>
                                ) : (
                                  <span className="uppercase tracking-wider text-[11px]">
                                    {act.type} {act.call_outcome ? `· ${act.call_outcome}` : ''}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-[#6E6E6E]">
                                {new Date(act.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Diff Content for requirement_change: NO big box, clean inline values */}
                            {act.type === 'requirement_change' ? (
                              <div className="space-y-1 py-0.5 text-xs">
                                {parseRequirementDiff(act.description).map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 flex-wrap text-[11px] text-[#1A1A1A]">
                                    <span className="font-semibold text-[#6E6E6E]">• {item.field}:</span>
                                    {item.oldVal ? (
                                      <span className="line-through text-slate-400 font-mono">{item.oldVal}</span>
                                    ) : null}
                                    {item.oldVal && item.newVal ? (
                                      <span className="text-[#C8A147] font-bold">➔</span>
                                    ) : null}
                                    <span className="font-semibold text-[#081428] font-mono">
                                      {item.newVal}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[#1A1A1A] text-xs leading-relaxed">{act.description}</div>
                            )}

                            <div className="text-[10px] text-[#6E6E6E]">
                              Logged by {act.user_name}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-xs text-[#6E6E6E] pl-2">No activity logs found.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Ownership History */}
              {activeTab === 'history' && (
                <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs text-xs">
                  <h3 className="font-semibold text-sm text-[#081428] border-b border-[#E8E4DC] pb-2 uppercase tracking-wider">
                    Ownership Change History
                  </h3>

                  <div className="space-y-3">
                    {opp.ownership_histories && opp.ownership_histories.length > 0 ? (
                      opp.ownership_histories.map((h: any) => (
                        <div key={h.id} className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded space-y-1">
                          <div className="font-semibold text-[#081428] flex items-center gap-2">
                            <span>{h.previous_owner} ({h.department_from})</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#C8A147]" />
                            <span>{h.new_owner} ({h.department_to})</span>
                          </div>
                          <div className="text-[11px] text-[#1A1A1A]">Reason: {h.reason || 'Handover'}</div>
                          <div className="text-[10px] text-[#6E6E6E]">Date: {new Date(h.created_at).toLocaleString()}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[#6E6E6E]">No ownership transfers recorded yet. Currently owned by {opp.current_owner_name}.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Sticky Action Panel (SLA Tracker & Next Action Scheduler) */}
            <div className="space-y-4 lg:sticky lg:top-20">
              {/* Mandatory SLA Card */}
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                  <h3 className="font-semibold text-xs text-[#081428] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#C8A147]" />
                    <span>SLA Status</span>
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    opp.sla_status === 'overdue' ? 'bg-red-100 text-red-700' :
                    opp.sla_status === 'due_soon' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {opp.sla_status?.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-[10px] text-[#6E6E6E] font-semibold uppercase">Next Required Action</div>
                  <div className="font-bold text-[#081428] p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded">
                    {opp.next_action || 'Call client — confirm requirement details'}
                  </div>
                  <div className="text-[11px] text-[#6E6E6E] pt-1">
                    Due Date: <strong>{opp.next_action_due_at ? new Date(opp.next_action_due_at).toLocaleString() : 'Immediate'}</strong>
                  </div>
                </div>
              </div>

              {/* Schedule Next Action & SLA Due Date */}
              <div className="bg-white border border-[#E8E4DC] rounded-lg p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
                  <h3 className="font-semibold text-xs text-[#081428] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>Schedule Next Action</span>
                  </h3>
                  <span className="text-[10px] text-[#6E6E6E]">SLA Governance</span>
                </div>

                <form onSubmit={handleUpdateNextAction} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#6E6E6E] mb-1 font-semibold">Immediate Next Action *</label>
                    <input
                      type="text"
                      required
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      placeholder="e.g. Schedule developer site viewing, Send contract draft..."
                      className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#6E6E6E] mb-1 font-semibold flex items-center justify-between">
                      <span>Next Action Due Date & Time *</span>
                      <span className="text-[10px] text-[#C8A147] font-bold">📅 Calendar Picker</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#C8A147] rounded text-xs text-[#081428] font-bold focus:outline-none shadow-2xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="sync_calendar"
                      checked={syncToCalendar}
                      onChange={(e) => setSyncToCalendar(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#081428] cursor-pointer"
                    />
                    <label htmlFor="sync_calendar" className="text-[11px] text-[#1A1A1A] font-medium cursor-pointer">
                      Auto-Sync appointment to <strong>Calendar Page</strong>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAct || !nextAction.trim()}
                    className="w-full py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingAct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                    <span>{submittingAct ? 'Updating SLA...' : 'Update Next Action & SLA'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Sales Handover Modal */}
      <SalesHandoverModal
        opportunity={opp}
        isOpen={isHandoverModalOpen}
        onClose={() => setIsHandoverModalOpen(false)}
        onSuccess={() => loadOpportunity()}
      />

      {/* Send Luxury Property Email Modal */}
      <SendEmailModal
        opportunity={opp}
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSuccess={() => loadOpportunity(true)}
      />
    </div>
  );
}
