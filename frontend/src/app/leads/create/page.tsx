'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import SearchableSelect from '@/components/SearchableSelect';
import PhoneInput from '@/components/PhoneInput';
import { WORLD_NATIONALITIES } from '@/data/countries';
import { fetchApi } from '@/lib/api';
import { 
  User, Globe, Briefcase, Plus, 
  ArrowLeft, AlertCircle, Building2, Clock, Target, Link2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const INITIAL_LEAD_SOURCES = [
  { value: 'Website', label: 'Official Website Form' },
  { value: 'Meta Ads', label: 'Meta Ads (Facebook / Instagram)' },
  { value: 'Google Ads', label: 'Google Ads Search' },
  { value: 'Property Finder', label: 'Property Finder Portal' },
  { value: 'Bayut', label: 'Bayut UAE Portal' },
  { value: 'Dubizzle', label: 'Dubizzle Property' },
  { value: 'Referral', label: 'Client / Agent Referral' },
  { value: 'Walk-in', label: 'Walk-in Direct Client' },
  { value: 'Database', label: 'Master Cold Database' },
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

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Ready Cash / Equity' },
  { value: 'finance', label: 'Bank Mortgage Approved' },
  { value: 'offplan_plan', label: 'Off-Plan Payment Plan' },
];

const ASSIGNED_OWNERS = [
  { value: 'Unassigned', label: 'Unassigned / Auto-Distribute (Rotation Pool)' },
  { value: 'Faraz Shafi', label: 'Faraz Shafi (Super Admin)' },
  { value: 'Babar Ali Khan', label: 'Babar Ali Khan (Property Consultant)' },
];

export default function CreateLeadPage() {
  const router = useRouter();

  // Dynamic Options Lists
  const [nationalities, setNationalities] = useState<any[]>(WORLD_NATIONALITIES);
  const [leadSourceOptions, setLeadSourceOptions] = useState<any[]>(INITIAL_LEAD_SOURCES);
  const [subSourcesMap, setSubSourcesMap] = useState<Record<string, string[]>>(INITIAL_SUB_SOURCES);
  const [developers, setDevelopers] = useState<string[]>(INITIAL_DEVELOPERS);
  const [communities, setCommunities] = useState<string[]>(INITIAL_COMMUNITIES);
  const [projects, setProjects] = useState<string[]>(INITIAL_PROJECTS);
  const [projectPropertiesMap, setProjectPropertiesMap] = useState<Record<string, string[]>>(INITIAL_PROJECT_PROPERTIES);

  // Mandatory Section 1: Client Personal Information (Full Name, Phone & Email ONLY)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Optional Fields initialized to empty ('' = Please Select)
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [emiratesId, setEmiratesId] = useState('');

  // Section 2: Lead Origin & Source
  const [source, setSource] = useState('');
  const [subSource, setSubSource] = useState('');

  // UTM Marketing Parameters
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');

  // Section 3: Opportunity Requirements & Deal Specs
  const [opportunityType, setOpportunityType] = useState('');
  const [temperature, setTemperature] = useState('');
  const [developer, setDeveloper] = useState('');
  const [community, setCommunity] = useState('');
  const [project, setProject] = useState('');
  const [projectProperty, setProjectProperty] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [keyRequirement, setKeyRequirement] = useState('');

  // Section 4: SLA Action & Ownership
  const [assignedOwner, setAssignedOwner] = useState('');
  const [ownerOptions, setOwnerOptions] = useState<any[]>(ASSIGNED_OWNERS);
  const [nextAction, setNextAction] = useState('');
  const [nextActionDueDate, setNextActionDueDate] = useState('');

  // Field-level Validation Errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [opportunityTypeOptions, setOpportunityTypeOptions] = useState<any[]>(OPPORTUNITY_TYPES);

  useEffect(() => {
    Promise.all([
      fetchApi('/users').catch(() => null),
      fetchApi('/lead-sources').catch(() => []),
      fetchApi('/catalog/developers').catch(() => []),
      fetchApi('/catalog/projects').catch(() => []),
      fetchApi('/catalog/properties').catch(() => []),
      fetchApi('/catalog/communities').catch(() => []),
      fetchApi('/catalog/opportunity-types').catch(() => []),
    ])
      .then(([usersData, lsData, devData, projData, propData, commData, oppTypesData]) => {
        const rawUsers = Array.isArray(usersData) ? usersData : (usersData?.users || []);
        if (rawUsers.length > 0) {
          const userOpts = rawUsers.map((u: any) => ({
            value: u.name,
            label: `${u.name} (${u.role || u.department || 'Sales Advisor'})`,
          }));
          setOwnerOptions([
            { value: 'Unassigned', label: 'Unassigned / Auto-Distribute (Rotation Pool)' },
            ...userOpts,
          ]);
        }
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

        if (Array.isArray(commData) && commData.length > 0) {
          setCommunities(commData.filter((c: any) => c.is_active).map((c: any) => c.name));
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

  // Dynamic Handlers
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Step 1: Run Frontend Validation
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Step 2: Create Contact in Lead Bank
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
      const oppRes = await fetchApi('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: contactId,
          opportunity_type: opportunityType || 'buyer',
          temperature: temperature || 'hot',
          developer: developer || null,
          community: community || null,
          project: project || null,
          project_property: projectProperty || null,
          property_type: propertyType || null,
          bedrooms: bedrooms || null,
          cash_or_finance: paymentMethod || null,
          budget_min: budgetMin ? Number(budgetMin) : null,
          budget_max: budgetMax ? Number(budgetMax) : null,
          key_requirement: keyRequirement || 'New Inquiry',
          next_action: nextAction || 'Contact new lead — confirm requirement details',
          next_action_due_at: nextActionDueDate || null,
          current_owner_name: assignedOwner || 'Mako',
        }),
      });

      setLoading(false);
      router.push(`/opportunities/${oppRes.id}`);
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
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full">
          {/* Top Breadcrumb & Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <Link 
                href="/" 
                className="inline-flex items-center gap-1.5 text-xs text-[#C8A147] font-semibold hover:underline mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Lead Pool</span>
              </Link>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                Create New Lead & Opportunity
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Register contact into Lead Bank and instantiate an active deal. Mandatory fields: Full Name, Primary Phone & Email.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-6 text-xs">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* SECTION 1: Client Personal Information */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <h2 className="font-heading font-bold text-base text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
                <User className="w-4 h-4 text-[#C8A147]" />
                <span>1. Client Personal Details</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                {/* Primary Phone */}
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

                {/* Secondary Phone (Together with Primary Phone) */}
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

              {/* Row 2: Email Address, Nationality, Emirates ID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#081428] font-bold mb-1">Email Address *</label>
                  <input
                    type="email"
                    placeholder="tariq@example.com"
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

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Nationality</label>
                  <SearchableSelect
                    options={nationalities}
                    value={nationality}
                    onChange={setNationality}
                    onAddOption={(newNat) => setNationalities((prev) => [...prev, newNat])}
                    placeholder="Please Select Nationality..."
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Emirates ID / Passport #</label>
                  <input
                    type="text"
                    placeholder="784-1990-1234567-1"
                    value={emiratesId}
                    onChange={(e) => setEmiratesId(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Lead Origin & Channel Source */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <h2 className="font-heading font-bold text-base text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
                <Globe className="w-4 h-4 text-[#C8A147]" />
                <span>2. Lead Origin & Channel Source</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Lead Source Channel</label>
                  <SearchableSelect
                    options={leadSourceOptions}
                    value={source}
                    onChange={handleSourceChange}
                    placeholder="Please Select Lead Source..."
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Sub-Source Channel</label>
                  <SearchableSelect
                    options={currentSubSources}
                    value={subSource}
                    onChange={setSubSource}
                    placeholder="Please Select Sub-Source..."
                    disabled={!source}
                  />
                </div>
              </div>
            </div>

            {/* SECTION: Marketing & UTM Attribution Parameters */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E8E4DC] pb-3 flex items-center justify-between">
                <h2 className="font-heading font-bold text-base text-[#081428] flex items-center gap-2 uppercase tracking-wider">
                  <Target className="w-4 h-4 text-[#C8A147]" />
                  <span>Marketing & UTM Parameters</span>
                </h2>
                <span className="text-[10px] text-[#C8A147] font-semibold uppercase tracking-wider bg-[#F9F6EE] px-2.5 py-1 rounded border border-[#C8A147]/30">Campaign Attribution</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. UTM Source */}
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">UTM Source</label>
                  <input
                    type="text"
                    placeholder="e.g. google, meta, tiktok, propertyfinder"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Platform or referrer (e.g. google, facebook)</p>
                </div>

                {/* 2. UTM Medium */}
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">UTM Medium</label>
                  <input
                    type="text"
                    placeholder="e.g. cpc, paid_social, banner, email"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Marketing medium (e.g. cpc, organic)</p>
                </div>

                {/* 3. UTM Campaign */}
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">UTM Campaign</label>
                  <input
                    type="text"
                    placeholder="e.g. downtown_launch_q3"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Specific product or promo campaign</p>
                </div>

                {/* 4. UTM Term */}
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">UTM Term</label>
                  <input
                    type="text"
                    placeholder="e.g. luxury apartments dubai"
                    value={utmTerm}
                    onChange={(e) => setUtmTerm(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Paid search keywords</p>
                </div>

                {/* 5. UTM Content */}
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">UTM Content</label>
                  <input
                    type="text"
                    placeholder="e.g. ad_variant_b, hero_cta"
                    value={utmContent}
                    onChange={(e) => setUtmContent(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Ad creative or link variation</p>
                </div>

                {/* 6. Complete Campaign / Referral URL */}
                <div>
                  <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>Complete Campaign URL</span>
                  </label>
                  <input
                    type="url"
                    placeholder="e.g. https://fsadvisory.ae/properties/burj-crown..."
                    value={landingPageUrl}
                    onChange={(e) => setLandingPageUrl(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Full landing page or referrer URL</p>
                </div>
              </div>
            </div>

            {/* SECTION 3: Opportunity Requirements & Deal Specs */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <h2 className="font-heading font-bold text-base text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
                <Briefcase className="w-4 h-4 text-[#C8A147]" />
                <span>3. Opportunity Requirements & Property Preferences</span>
              </h2>

              {/* Row 1: Opportunity Type, Temperature & Payment Method (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Payment Method</label>
                  <SearchableSelect
                    options={PAYMENT_METHODS}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    placeholder="Please Select Payment Method..."
                  />
                </div>
              </div>

              {/* Row 2: Developer, Community & Project (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="block text-[#081428] font-semibold mb-1">Target Location / Community</label>
                  <SearchableSelect
                    options={communities}
                    value={community}
                    onChange={setCommunity}
                    placeholder="Please Select Community..."
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

              {/* Row 3: Property Type, Bedrooms & Specific Unit Model (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Property Type</label>
                  <SearchableSelect
                    options={PROPERTY_TYPES}
                    value={propertyType}
                    onChange={setPropertyType}
                    placeholder="Please Select Type..."
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Bedrooms Preference</label>
                  <SearchableSelect
                    options={BEDROOMS}
                    value={bedrooms}
                    onChange={setBedrooms}
                    placeholder="Please Select Bedrooms..."
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>Specific Unit {project ? `in ${project}` : ''}</span>
                  </label>
                  <SearchableSelect
                    options={currentProjectProperties}
                    value={projectProperty}
                    onChange={setProjectProperty}
                    onAddOption={handleAddCustomProjectProperty}
                    placeholder={project ? `Select Unit in ${project}...` : 'Select Project First...'}
                    disabled={!project}
                  />
                </div>
              </div>

              {/* Row 4: Min Budget, Max Budget & Budget Range Indicator (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Min Budget (AED)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1800000"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Max Budget (AED)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2500000"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">
                    Target Budget Range <span className="text-slate-400 font-normal">(Auto-calculated)</span>
                  </label>
                  <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#081428] font-medium flex items-center justify-between h-[38px]">
                    <span className="text-[#6E6E6E] text-[11px]">Calculated Range:</span>
                    <span className="font-semibold text-[#C8A147]">
                      {budgetMin || budgetMax ? (
                        `AED ${budgetMin ? Number(budgetMin).toLocaleString() : '0'} – ${budgetMax ? Number(budgetMax).toLocaleString() : 'Max'}`
                      ) : (
                        'AED Not Specified'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 5: Key Requirement & Notes */}
              <div>
                <label className="block text-[#081428] font-semibold mb-1">Key Requirement Overview & Notes</label>
                <textarea
                  rows={2}
                  value={keyRequirement}
                  onChange={(e) => setKeyRequirement(e.target.value)}
                  placeholder="Enter specific client requirements, preferred views, amenities..."
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                />
              </div>
            </div>

            {/* SECTION 4: SLA Action & Ownership */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 space-y-4 shadow-2xs">
              <h2 className="font-heading font-bold text-base text-[#081428] border-b border-amber-200 pb-3 flex items-center gap-2 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>4. SLA Next Action & Ownership Assignment</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Assigned Agent / Owner</label>
                  <SearchableSelect
                    options={ownerOptions}
                    value={assignedOwner}
                    onChange={setAssignedOwner}
                    placeholder="Please Select Owner..."
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Next Required Action</label>
                  <input
                    type="text"
                    placeholder="e.g. Contact new lead — confirm requirement details"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-semibold mb-1">Due Date & Time</label>
                  <input
                    type="datetime-local"
                    value={nextActionDueDate}
                    onChange={(e) => setNextActionDueDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Submission Bar */}
            <div className="flex items-center justify-end gap-4 border-t border-[#E8E4DC] pt-4">
              <Link
                href="/"
                className="px-5 py-2.5 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-medium rounded-md hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-md transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>{loading ? 'Creating Lead...' : 'Save Lead & Create Opportunity Workspace'}</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
