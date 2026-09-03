'use client';

import { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, User, Briefcase, Building2, Target, Globe, Link2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import SearchableSelect from './SearchableSelect';
import PhoneInput from './PhoneInput';
import { WORLD_NATIONALITIES } from '@/data/countries';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const INITIAL_LEAD_SOURCES = [
  { value: 'Website', label: 'Official Website' },
  { value: 'Meta Ads', label: 'Meta Ads (Facebook / Instagram)' },
  { value: 'Google Ads', label: 'Google Ads Search' },
  { value: 'Property Finder', label: 'Property Finder' },
  { value: 'Bayut', label: 'Bayut UAE' },
  { value: 'Dubizzle', label: 'Dubizzle Property' },
  { value: 'Referral', label: 'Client Referral' },
  { value: 'Walk-in', label: 'Walk-in / Direct' },
  { value: 'Database', label: 'Master Database' },
];

const INITIAL_SUB_SOURCES: Record<string, string[]> = {
  Website: [
    'Official Website Form',
    'Contact Us Page',
    'Live Chatbot Inquiry',
    'Organic Google Search (SEO)',
    'Direct URL Visit',
  ],
  'Meta Ads': [
    'Facebook Lead Form',
    'Instagram Direct Ad',
    'Meta Stories / Reels Ad',
    'Retargeting Campaign',
    'Custom Audience Campaign',
  ],
  'Google Ads': [
    'Google Search PPC',
    'Display Network Banner',
    'Performance Max (PMax)',
    'YouTube Video Ad',
  ],
  'Property Finder': [
    'Premium Featured Listing',
    'Verified Unit Badge',
    'Portal WhatsApp Inquiry',
    'Agent Profile Direct Call',
  ],
  Bayut: [
    'TruCheck Verified Listing',
    'Bayut Pro Banner Ad',
    'Hot Listing Portal Inquiry',
  ],
  Dubizzle: [
    'Dubizzle Premium Ad',
    'Verified Seller Inquiry',
    'Classified Listing Call',
  ],
  Referral: [
    'Existing Client Referral',
    'Partner Broker / Agency',
    'Staff / Family Referral',
    'VIP Network Intro',
  ],
  'Walk-in': [
    'Head Office Reception',
    'Sales Presentation Center',
    'Property Exhibition / Event',
  ],
  Database: [
    'Cold Telesales Campaign',
    'SMS Broadcast Campaign',
    'Email Newsletter Blast',
    'Past Client Re-engagement',
  ],
};

const INITIAL_PROJECTS = [
  'Burj Crown Residences',
  'Sobha Hartland Waves',
  'Dubai Creek Residences',
  'Marina Gate Towers',
  'Palm Beach Towers',
  'DAMAC Hills Villa Cluster',
];

const INITIAL_PROJECT_PROPERTIES: Record<string, string[]> = {
  'Burj Crown Residences': [
    '1BR Luxury Executive Suite (AED 1.8M)',
    '2BR Boulevard View Apartment (AED 2.5M)',
    '3BR Premium Sky Collection (AED 4.2M)',
    '4BR Grand Penthouse Residence (AED 8.5M)',
  ],
  'Sobha Hartland Waves': [
    '1BR Waterfront Apartment (AED 1.4M)',
    '2BR Lagoon View Residence (AED 2.2M)',
    '3BR Duplex Sky Suite (AED 3.8M)',
  ],
  'Dubai Creek Residences': [
    '1BR Harbour Gate View (AED 1.6M)',
    '2BR Creek Beachfront Apartment (AED 2.4M)',
    '3BR Island District Luxury Suite (AED 3.9M)',
  ],
  'Marina Gate Towers': [
    '1BR Marina Skyline Suite (AED 1.9M)',
    '2BR Full Marina View Unit (AED 3.1M)',
    '3BR Penthouse Duplex (AED 6.5M)',
  ],
  'Palm Beach Towers': [
    '1BR Royal Palm Apartment (AED 2.8M)',
    '2BR Sea & Sunset View Residence (AED 4.5M)',
    '3BR Waterfront Villa Suite (AED 7.9M)',
    '4BR Sky Mansion Villa (AED 14.5M)',
  ],
  'DAMAC Hills Villa Cluster': [
    '3BR Golf Crest Townhouse (AED 2.6M)',
    '4BR Trump Estate Mansion (AED 5.2M)',
    '5BR Luxury Parkland Villa (AED 8.8M)',
  ],
};

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

const OPPORTUNITY_TYPES = [
  { value: 'buyer', label: 'Buyer Opportunity' },
  { value: 'seller', label: 'Seller Opportunity' },
  { value: 'landlord', label: 'Landlord Opportunity' },
  { value: 'tenant', label: 'Tenant Opportunity' },
];

const TEMPERATURES = [
  { value: 'hot', label: '🔴 HOT (Immediate / Ready to proceed)' },
  { value: 'warm', label: '🟠 WARM (Interested / Nurturing needed)' },
  { value: 'cold', label: '🔵 COLD (Long-term potential)' },
];

export default function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  // Dynamic Options Lists
  const [nationalities, setNationalities] = useState<any[]>(WORLD_NATIONALITIES);
  const [leadSourceOptions, setLeadSourceOptions] = useState<any[]>(INITIAL_LEAD_SOURCES);
  const [subSourcesMap, setSubSourcesMap] = useState<Record<string, string[]>>(INITIAL_SUB_SOURCES);
  const [developers, setDevelopers] = useState<string[]>(INITIAL_DEVELOPERS);
  const [projects, setProjects] = useState<string[]>(INITIAL_PROJECTS);
  const [projectPropertiesMap, setProjectPropertiesMap] = useState<Record<string, string[]>>(INITIAL_PROJECT_PROPERTIES);

  // Mandatory Client Contact Details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');

  // Optional Fields initialized to empty ('' = Please Select)
  const [nationality, setNationality] = useState('');
  const [source, setSource] = useState('');
  const [subSource, setSubSource] = useState('');

  // UTM Marketing Parameters
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');

  // Projects & Properties State
  const [project, setProject] = useState('');
  const [projectProperty, setProjectProperty] = useState('');

  // Opportunity & Deal Details
  const [opportunityType, setOpportunityType] = useState('');
  const [temperature, setTemperature] = useState('');
  const [developer, setDeveloper] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [keyRequirement, setKeyRequirement] = useState('');

  // SLA Next Action
  const [nextAction, setNextAction] = useState('');
  const [nextActionDueDate, setNextActionDueDate] = useState('');

  // Field-level Validation Errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [opportunityTypeOptions, setOpportunityTypeOptions] = useState<any[]>(OPPORTUNITY_TYPES);

  useEffect(() => {
    Promise.all([
      fetchApi('/lead-sources'),
      fetchApi('/catalog/developers'),
      fetchApi('/catalog/projects'),
      fetchApi('/catalog/properties'),
      fetchApi('/catalog/communities'),
      fetchApi('/catalog/opportunity-types'),
    ])
      .then(([lsData, devData, projData, propData, commData, oppTypesData]) => {
        if (Array.isArray(lsData) && lsData.length > 0) {
          const dbOptions = lsData.filter((s: any) => s.is_active).map((s: any) => ({
            value: s.name,
            label: s.name,
          }));
          setLeadSourceOptions(dbOptions);

          const dbSubMap: Record<string, string[]> = {};
          lsData.forEach((s: any) => {
            if (s.sub_sources && s.sub_sources.length > 0) {
              dbSubMap[s.name] = s.sub_sources.filter((sub: any) => sub.is_active).map((sub: any) => sub.name);
            }
          });
          setSubSourcesMap((prev) => ({ ...prev, ...dbSubMap }));
        }

        if (Array.isArray(devData) && devData.length > 0) {
          setDevelopers(devData.filter((d: any) => d.is_active).map((d: any) => d.name));
        }

        if (Array.isArray(projData) && projData.length > 0) {
          setProjects(projData.filter((p: any) => p.is_active).map((p: any) => p.name));
        }

        if (Array.isArray(oppTypesData) && oppTypesData.length > 0) {
          setOpportunityTypeOptions(
            oppTypesData.filter((ot: any) => ot.is_active).map((ot: any) => ({
              value: ot.slug || ot.name,
              label: ot.name,
            }))
          );
        }
      })
      .catch(console.error);
  }, []);

  // Frontend Validation
  const validateForm = () => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Client Full Name is required.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!phone.trim() || cleanPhone.length < 7) {
      errs.phone = 'Valid Primary Phone Number is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = 'Email Address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address (e.g. name@domain.com).';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSourceChange = (newSource: string) => {
    setSource(newSource);
    setSubSource('');
  };

  const handleAddCustomSource = (newSource: string) => {
    if (!leadSourceOptions.some((s) => s.value === newSource)) {
      setLeadSourceOptions((prev) => [...prev, { value: newSource, label: `📌 ${newSource}` }]);
    }
    if (!subSourcesMap[newSource]) {
      setSubSourcesMap((prev) => ({ ...prev, [newSource]: [`General ${newSource}`] }));
    }
  };

  const handleAddCustomSubSource = (newSub: string) => {
    setSubSourcesMap((prev) => ({
      ...prev,
      [source]: [...(prev[source] || []), newSub],
    }));
  };

  const handleProjectChange = (projName: string) => {
    setProject(projName);
    setProjectProperty('');
  };

  const handleAddCustomProject = (newProj: string) => {
    if (!projects.includes(newProj)) {
      setProjects((prev) => [...prev, newProj]);
    }
    if (!projectPropertiesMap[newProj]) {
      setProjectPropertiesMap((prev) => ({ ...prev, [newProj]: ['Standard Unit'] }));
    }
  };

  const handleAddCustomProjectProperty = (newProp: string) => {
    setProjectPropertiesMap((prev) => ({
      ...prev,
      [project]: [...(prev[project] || []), newProp],
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Step 1: Run Frontend Validation
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Step 2: Create Contact in Lead Pool
      const contactRes = await fetchApi('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          secondary_phone: secondaryPhone || null,
          email,
          nationality: nationality || null,
          source: source ? (subSource ? `${source} (${subSource})` : source) : null,
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          utm_campaign: utmCampaign || null,
          utm_term: utmTerm || null,
          utm_content: utmContent || null,
          landing_page_url: landingPageUrl || null,
        }),
      });

      const contactId = contactRes.id;

      // Step 3: Create Opportunity for Contact
      await fetchApi('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: contactId,
          opportunity_type: opportunityType || 'buyer',
          temperature: temperature || 'hot',
          developer: developer || null,
          project: project || null,
          project_property: projectProperty || null,
          budget_min: budgetMin ? Number(budgetMin) : null,
          budget_max: budgetMax ? Number(budgetMax) : null,
          key_requirement: keyRequirement || 'New Inquiry',
          next_action: nextAction || 'Contact new lead — confirm requirement details',
          next_action_due_at: nextActionDueDate || null,
          current_owner_name: (() => {
            try {
              const raw = localStorage.getItem('crm_user');
              if (raw) return JSON.parse(raw).name || 'Faraz Shafi';
            } catch {}
            return 'Faraz Shafi';
          })(),
        }),
      });

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);

      // Handle Backend Validation Errors (422)
      if (err.errors && typeof err.errors === 'object') {
        const backendErrs: Record<string, string> = {};
        if (err.errors.name) backendErrs.name = err.errors.name[0];
        if (err.errors.phone) backendErrs.phone = err.errors.phone[0];
        if (err.errors.email) backendErrs.email = err.errors.email[0];

        if (Object.keys(backendErrs).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...backendErrs }));
        }
      }

      setError(err.message || 'Failed to create lead');
    }
  };

  const currentSubSources = source ? (subSourcesMap[source] || ['General Inbound']) : [];
  const currentProjectProperties = project ? (projectPropertiesMap[project] || ['Standard Unit']) : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E4DC] rounded-lg max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#C8A147] text-white font-bold flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-lg">Create New Manual Lead</h2>
              <p className="text-xs text-[#C8A147]">Mandatory Fields: Full Name, Primary Phone & Email</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5 bg-[#FAF8F5] text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Lead Source & Contact Info */}
          <div className="bg-white border border-[#E8E4DC] rounded-md p-4 space-y-3 shadow-2xs">
            <h3 className="font-bold text-[#081428] border-b border-[#E8E4DC] pb-2 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#C8A147]" />
              <span>Client Contact & Source Details</span>
            </h3>

            <div>
              <label className="block text-[#081428] font-bold mb-1">Client Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Tariq Al Hassan"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
                }}
                className={`w-full p-2.5 bg-[#FAF8F5] border rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none transition-colors ${
                  fieldErrors.name
                    ? 'border-red-500 bg-red-50/30 focus:border-red-500'
                    : 'border-[#E8E4DC] focus:border-[#C8A147]'
                }`}
              />
              {fieldErrors.name && (
                <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{fieldErrors.name}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#081428] font-bold mb-1">Primary Phone Number *</label>
                <PhoneInput
                  value={phone}
                  onChange={(val) => {
                    setPhone(val);
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  hasError={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone && (
                  <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1 animate-in fade-in">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fieldErrors.phone}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1">
                  Secondary Phone <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <PhoneInput
                  value={secondaryPhone}
                  onChange={setSecondaryPhone}
                  placeholder="Optional secondary phone"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#081428] font-bold mb-1">Email Address *</label>
              <input
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                className={`w-full p-2.5 bg-[#FAF8F5] border rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none transition-colors ${
                  fieldErrors.email
                    ? 'border-red-500 bg-red-50/30 focus:border-red-500'
                    : 'border-[#E8E4DC] focus:border-[#C8A147]'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold mb-1">Lead Source</label>
                <SearchableSelect
                  options={leadSourceOptions}
                  value={source}
                  onChange={handleSourceChange}
                  placeholder="Please Select Lead Source..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1">Sub-Source</label>
                <SearchableSelect
                  options={currentSubSources}
                  value={subSource}
                  onChange={setSubSource}
                  placeholder="Please Select Sub-Source..."
                  disabled={!source}
                />
              </div>
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1">Nationality</label>
              <SearchableSelect
                options={nationalities}
                value={nationality}
                onChange={setNationality}
                placeholder="Please Select Nationality..."
              />
            </div>
          </div>

          {/* Section: Marketing & UTM Parameters */}
          <div className="bg-white border border-[#E8E4DC] rounded-md p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
              <h3 className="font-bold text-[#081428] uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#C8A147]" />
                <span>Marketing & UTM Parameters</span>
              </h3>
              <span className="text-[10px] text-[#C8A147] font-semibold uppercase tracking-wider bg-[#F9F6EE] px-2 py-0.5 rounded border border-[#C8A147]/30">Campaign Tracking</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#081428] font-semibold mb-1">UTM Source</label>
                <input
                  type="text"
                  placeholder="e.g. google, meta, propertyfinder"
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1">UTM Medium</label>
                <input
                  type="text"
                  placeholder="e.g. cpc, paid_social, banner, email"
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1">UTM Campaign</label>
                <input
                  type="text"
                  placeholder="e.g. downtown_launch_q3"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1">UTM Term</label>
                <input
                  type="text"
                  placeholder="e.g. luxury apartments dubai"
                  value={utmTerm}
                  onChange={(e) => setUtmTerm(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1">UTM Content</label>
                <input
                  type="text"
                  placeholder="e.g. ad_variant_b, hero_cta"
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Complete Campaign URL</span>
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://fsadvisory.ae/..."
                  value={landingPageUrl}
                  onChange={(e) => setLandingPageUrl(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Opportunity & Deal Requirements */}
          <div className="bg-[#FAF8F4] border border-[#E8E4DC] rounded-md p-4 space-y-3 shadow-2xs">
            <h3 className="font-bold text-[#081428] border-b border-[#E8E4DC] pb-2 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#C8A147]" />
              <span>Opportunity Requirements & Temperature</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold mb-1">Opportunity Type</label>
                <SearchableSelect
                  options={opportunityTypeOptions}
                  value={opportunityType}
                  onChange={setOpportunityType}
                  placeholder="Please Select Opportunity Type..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1">Initial Temperature</label>
                <SearchableSelect
                  options={TEMPERATURES}
                  value={temperature}
                  onChange={setTemperature}
                  placeholder="Please Select Temperature..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Developer</span>
                </label>
                <SearchableSelect
                  options={developers}
                  value={developer}
                  onChange={setDeveloper}
                  placeholder="Please Select Developer..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Project</span>
                </label>
                <SearchableSelect
                  options={projects}
                  value={project}
                  onChange={handleProjectChange}
                  placeholder="Please Select Project..."
                />
              </div>
            </div>

            {project && (
              <div>
                <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Property / Unit Type in {project}</span>
                </label>
                <SearchableSelect
                  options={currentProjectProperties}
                  value={projectProperty}
                  onChange={setProjectProperty}
                  placeholder="Please Select Property Unit..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold mb-1">Min Budget (AED)</label>
                <input
                  type="number"
                  placeholder="e.g. 1800000"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A]"
                />
              </div>
              <div>
                <label className="block text-[#081428] font-semibold mb-1">Max Budget (AED)</label>
                <input
                  type="number"
                  placeholder="e.g. 2500000"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1">Key Requirement Overview</label>
              <input
                type="text"
                value={keyRequirement}
                onChange={(e) => setKeyRequirement(e.target.value)}
                placeholder="e.g. 2BR Apartment in Downtown / Business Bay"
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A]"
              />
            </div>
          </div>

          {/* Section 3: SLA Action */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md space-y-2">
            <div className="font-semibold text-[#081428] flex items-center gap-1.5">
              <span>SLA Next Action Assignment</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#6E6E6E] mb-1 font-medium">Next Required Action</label>
                <input
                  type="text"
                  placeholder="e.g. Contact new lead — confirm requirement details"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#6E6E6E] mb-1 font-medium">Due Date & Time</label>
                <input
                  type="datetime-local"
                  value={nextActionDueDate}
                  onChange={(e) => setNextActionDueDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A]"
                />
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E8E4DC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-medium rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              {loading ? 'Processing Lead...' : '+ Save Lead to Pool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
