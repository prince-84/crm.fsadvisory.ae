'use client';

import { useState, useEffect, use } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import SearchableSelect from '@/components/SearchableSelect';
import PhoneInput from '@/components/PhoneInput';
import { COUNTRIES, WORLD_NATIONALITIES } from '@/data/countries';
import { fetchApi } from '@/lib/api';
import Swal from 'sweetalert2';
import { 
  User, Globe, Briefcase, Plus, 
  ArrowLeft, AlertCircle, Building2, Clock, Save, Target, Link2
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

// Helper normalizers to guarantee 100% field mapping across all data formats
const normalizeNationality = (rawVal: string): string => {
  if (!rawVal) return '';
  const trimmed = rawVal.trim();
  const found = COUNTRIES.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase() ||
           c.nationality.toLowerCase() === trimmed.toLowerCase() ||
           c.code.toLowerCase() === trimmed.toLowerCase()
  );
  return found ? found.nationality : trimmed;
};

const normalizePropertyType = (rawType: string): string => {
  if (!rawType) return '';
  const trimmed = rawType.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'villa' || lower === 'mansion' || lower.includes('villa / mansion') || lower.includes('villa/mansion')) {
    return 'Villa / Mansion';
  }
  if (lower === 'town house' || lower === 'townhouse') {
    return 'Townhouse';
  }
  if (lower === 'apartment' || lower === 'flat') {
    return 'Apartment';
  }
  if (lower === 'penthouse') {
    return 'Penthouse';
  }
  if (lower === 'duplex') {
    return 'Duplex';
  }
  if (lower === 'plot' || lower === 'land' || lower === 'land plot') {
    return 'Land Plot';
  }
  if (lower === 'office' || lower === 'commercial' || lower === 'commercial office') {
    return 'Commercial Office';
  }
  return trimmed;
};

const normalizeBedrooms = (rawBeds: string): string => {
  if (!rawBeds) return '';
  const trimmed = rawBeds.trim();
  if (/^5\+?\s*BR$/i.test(trimmed) || /^5$/i.test(trimmed) || /^5\+$/i.test(trimmed)) {
    return '5+ BR';
  }
  const match = trimmed.match(/^(\d+)\s*BR$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 5) return '5+ BR';
    return `${num} BR`;
  }
  if (/^studio$/i.test(trimmed)) return 'Studio';
  return trimmed;
};

const normalizePaymentMethod = (rawPm: string): string => {
  if (!rawPm) return '';
  const lower = rawPm.trim().toLowerCase();
  if (lower.includes('cash')) return 'cash';
  if (lower.includes('fin') || lower.includes('mortgage') || lower.includes('loan')) return 'finance';
  if (lower.includes('plan') || lower.includes('offplan') || lower.includes('install')) return 'offplan_plan';
  return lower;
};

export default function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contactId = resolvedParams.id;
  const router = useRouter();

  // Dynamic Options Lists
  const [nationalities, setNationalities] = useState<any[]>(WORLD_NATIONALITIES);
  const [leadSourceOptions, setLeadSourceOptions] = useState<any[]>(INITIAL_LEAD_SOURCES);
  const [subSourcesMap, setSubSourcesMap] = useState<Record<string, string[]>>(INITIAL_SUB_SOURCES);
  const [developers, setDevelopers] = useState<string[]>(INITIAL_DEVELOPERS);
  const [communities, setCommunities] = useState<string[]>(INITIAL_COMMUNITIES);
  const [projects, setProjects] = useState<string[]>(INITIAL_PROJECTS);
  const [projectPropertiesMap, setProjectPropertiesMap] = useState<Record<string, string[]>>(INITIAL_PROJECT_PROPERTIES);
  const [propertyTypeOptions, setPropertyTypeOptions] = useState<string[]>(PROPERTY_TYPES);
  const [bedroomOptions, setBedroomOptions] = useState<string[]>(BEDROOMS);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<any[]>(PAYMENT_METHODS);

  // Mandatory Section 1: Client Personal Information
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Optional Fields
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
  const [activeOppId, setActiveOppId] = useState<number | null>(null);
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
  const [opportunityTypeOptions, setOpportunityTypeOptions] = useState<any[]>(OPPORTUNITY_TYPES);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load Database Data & Master Catalogs
  useEffect(() => {
    Promise.all([
      fetchApi(`/contacts/${contactId}`),
      fetchApi('/users').catch(() => null),
      fetchApi('/lead-sources').catch(() => []),
      fetchApi('/catalog/developers').catch(() => []),
      fetchApi('/catalog/projects').catch(() => []),
      fetchApi('/catalog/properties').catch(() => []),
      fetchApi('/catalog/communities').catch(() => []),
      fetchApi('/catalog/opportunity-types').catch(() => []),
    ])
      .then(([contactData, usersData, lsData, devData, projData, propData, commData, oppTypesData]) => {
        if (!contactData) {
          setError('Lead record not found in database.');
          setLoading(false);
          return;
        }

        // 1. Mandatory & Personal Profile
        setName(contactData.name || '');
        setPhone(contactData.phone || '');
        setSecondaryPhone(contactData.secondary_phone || '');
        setEmail(contactData.email || '');
        setEmiratesId(contactData.emirates_id || '');

        // 2. Nationality Mapping & Dynamic Inclusion
        const rawNat = contactData.nationality || '';
        const normalizedNat = normalizeNationality(rawNat);
        setNationality(normalizedNat);
        if (normalizedNat) {
          setNationalities((prev) => {
            if (prev.some((n) => n.value.toLowerCase() === normalizedNat.toLowerCase())) return prev;
            return [{ value: normalizedNat, label: `🌍 ${normalizedNat}`, key: `nat-${normalizedNat}` }, ...prev];
          });
        }

        // 3. Marketing & UTM Parameters
        setUtmSource(contactData.utm_source || '');
        setUtmMedium(contactData.utm_medium || '');
        setUtmCampaign(contactData.utm_campaign || '');
        setUtmTerm(contactData.utm_term || '');
        setUtmContent(contactData.utm_content || '');
        setLandingPageUrl(contactData.campaign_url || contactData.landing_page_url || '');

        // 4. Source & Sub-Source Parsing
        let parsedSource = '';
        let parsedSubSource = '';
        if (contactData.source) {
          const match = contactData.source.match(/^(.*?)(?:\s*\((.*?)\))?$/);
          if (match && match[2]) {
            parsedSource = match[1].trim();
            parsedSubSource = match[2].trim();
          } else {
            parsedSource = contactData.source.trim();
          }
        }
        if (!parsedSubSource) {
          parsedSubSource = (contactData.sub_source || contactData.utm_source || '').trim();
        }
        setSource(parsedSource);
        setSubSource(parsedSubSource);

        // Merge Lead Sources from DB + Initial + Contact's parsedSource
        const dbSources = Array.isArray(lsData) && lsData.length > 0
          ? lsData.filter((s: any) => s.is_active).map((s: any) => ({
              value: s.name,
              label: `${s.icon || '🌐'} ${s.name}`,
            }))
          : [...INITIAL_LEAD_SOURCES];

        if (parsedSource && !dbSources.some((s: any) => s.value.toLowerCase() === parsedSource.toLowerCase())) {
          dbSources.push({ value: parsedSource, label: `🌐 ${parsedSource}` });
        }
        setLeadSourceOptions(dbSources);

        // Merge Sub-Sources Map
        const mergedSubMap: Record<string, string[]> = { ...INITIAL_SUB_SOURCES };
        if (Array.isArray(lsData)) {
          lsData.forEach((s: any) => {
            if (s.sub_sources && s.sub_sources.length > 0) {
              mergedSubMap[s.name] = s.sub_sources.filter((sub: any) => sub.is_active).map((sub: any) => sub.name);
            }
          });
        }
        if (parsedSource && parsedSubSource) {
          mergedSubMap[parsedSource] = Array.from(new Set([...(mergedSubMap[parsedSource] || []), parsedSubSource]));
        }
        setSubSourcesMap(mergedSubMap);

        // 5. Opportunity Workspace & Qualification (Check opp or parse activity fallback)
        const opp = contactData.opportunities && contactData.opportunities.length > 0 ? contactData.opportunities[0] : null;
        const qual = opp
          ? (opp.buyer_qualification || opp.buyerQualification
             || opp.seller_qualification || opp.sellerQualification
             || opp.landlord_qualification || opp.landlordQualification
             || opp.tenant_qualification || opp.tenantQualification || {})
          : (contactData.inquiry_specs || {});

        // Fallback parsers for contacts created without opportunity
        let fbDev = contactData.inquiry_specs?.developer || '';
        let fbComm = contactData.inquiry_specs?.community || '';
        let fbProj = contactData.inquiry_specs?.project || '';
        let fbUnit = contactData.inquiry_specs?.project_property || '';
        let fbPropType = contactData.inquiry_specs?.property_type || '';
        let fbBeds = contactData.inquiry_specs?.bedrooms || '';
        let fbMin = contactData.inquiry_specs?.budget_min ? String(contactData.inquiry_specs.budget_min) : '';
        let fbMax = contactData.inquiry_specs?.budget_max ? String(contactData.inquiry_specs.budget_max) : '';
        let fbPm = contactData.inquiry_specs?.cash_or_finance || '';
        let fbKeyReq = contactData.inquiry_specs?.key_requirement || '';
        let fbNextAction = '';
        let fbOppType = contactData.inquiry_specs?.opportunity_type || '';
        let fbTemp = '';

        if (!opp && Array.isArray(contactData.activities)) {
          for (const act of contactData.activities) {
            const desc = act.description || '';
            if (desc.includes('Initial Inquiry Requirements:') || desc.includes('Initial Inquiry Details:') || desc.includes('Initial Inquiry') || desc.includes('Lead created via')) {
              const devMatch = desc.match(/(?:Developer|Dev):\s*([^,|]+)/i);
              if (devMatch) fbDev = devMatch[1].trim();

              const projMatch = desc.match(/Project:\s*([^,|]+)/i);
              if (projMatch) fbProj = projMatch[1].trim();

              const commMatch = desc.match(/(?:Location\/Community|Community|Area):\s*([^,|]+)/i);
              if (commMatch) fbComm = commMatch[1].trim();

              const propMatch = desc.match(/(?:Unit|Prop):\s*([^,|]+)/i);
              if (propMatch) fbUnit = propMatch[1].trim();

              const typeMatch = desc.match(/(?:Property Type|Type):\s*([^,|]+)/i);
              if (typeMatch && !desc.includes('Opportunity Type:')) fbPropType = typeMatch[1].trim();

              const oppTypeMatch = desc.match(/Opportunity Type:\s*([^,|]+)/i);
              if (oppTypeMatch) fbOppType = oppTypeMatch[1].trim().toLowerCase();

              const tempMatch = desc.match(/Initial Temp(?:erature)?:\s*([^,|]+)/i);
              if (tempMatch) fbTemp = tempMatch[1].trim().toLowerCase();

              const bedsMatch = desc.match(/Beds?(?:rooms)?:\s*([^,|]+)/i);
              if (bedsMatch) fbBeds = bedsMatch[1].trim();

              const budgetMatch = desc.match(/Budget:\s*(?:AED\s*)?([0-9,]+)\s*(?:–|-)\s*([0-9,]+|Max)/i);
              if (budgetMatch) {
                fbMin = budgetMatch[1].replace(/,/g, '');
                if (budgetMatch[2] !== 'Max') fbMax = budgetMatch[2].replace(/,/g, '');
              }

              const payMatch = desc.match(/Payment Method:\s*([^,|]+)/i);
              if (payMatch) fbPm = payMatch[1].trim();

              const notesMatch = desc.match(/Notes:\s*([^,|]+)/i);
              if (notesMatch) fbKeyReq = notesMatch[1].trim();

              const nextMatch = desc.match(/Next Action:\s*([^,|]+)/i);
              if (nextMatch) fbNextAction = nextMatch[1].trim();
              break;
            }
          }
        }

        if (opp) {
          setActiveOppId(opp.id);
        }

        // Opportunity Type
        const oppTypeVal = (opp?.opportunity_type || fbOppType || 'buyer').toLowerCase();
        setOpportunityType(oppTypeVal);

        const loadedOppTypes = Array.isArray(oppTypesData) && oppTypesData.length > 0
          ? oppTypesData.filter((ot: any) => ot.is_active).map((ot: any) => ({
              value: (ot.slug || ot.name).toLowerCase(),
              label: ot.name,
            }))
          : [...OPPORTUNITY_TYPES];

        if (oppTypeVal && !loadedOppTypes.some((t: any) => t.value === oppTypeVal)) {
          loadedOppTypes.push({ value: oppTypeVal, label: `${oppTypeVal.toUpperCase()} Opportunity` });
        }
        setOpportunityTypeOptions(loadedOppTypes);

        // Temperature
        const tempVal = (opp?.temperature || fbTemp || 'warm').toLowerCase();
        setTemperature(tempVal);

        // Target Developer
        const devVal = opp ? (opp.developer || qual.developer || '') : fbDev;
        setDeveloper(devVal);

        const activeCatalogDevs = Array.isArray(devData) ? devData.filter((d: any) => d.is_active).map((d: any) => d.name) : [];
        const allDevs = Array.from(new Set([...INITIAL_DEVELOPERS, ...activeCatalogDevs, devVal].filter(Boolean)));
        setDevelopers(allDevs);

        // Preferred Community
        const commVal = opp ? (opp.community || qual.community || '') : fbComm;
        setCommunity(commVal);

        const activeCatalogComms = Array.isArray(commData) ? commData.filter((c: any) => c.is_active).map((c: any) => c.name) : [];
        const allComms = Array.from(new Set([...INITIAL_COMMUNITIES, ...activeCatalogComms, commVal].filter(Boolean)));
        setCommunities(allComms);

        // Target Project
        const projVal = opp ? (opp.project || qual.project || qual.building_name || '') : fbProj;
        setProject(projVal);

        const activeCatalogProjs = Array.isArray(projData) ? projData.filter((p: any) => p.is_active).map((p: any) => p.name) : [];
        const allProjs = Array.from(new Set([...INITIAL_PROJECTS, ...activeCatalogProjs, projVal].filter(Boolean)));
        setProjects(allProjs);

        // Specific Property Unit
        const propVal = opp ? (opp.project_property || qual.project_property || qual.unit_number || '') : fbUnit;
        setProjectProperty(propVal);

        const updatedPropMap: Record<string, string[]> = { ...INITIAL_PROJECT_PROPERTIES };
        if (projVal && propVal) {
          updatedPropMap[projVal] = Array.from(new Set([...(updatedPropMap[projVal] || []), propVal]));
        }
        setProjectPropertiesMap(updatedPropMap);

        // Property Type
        const rawPropType = opp ? (opp.property_type || qual.property_type || '') : fbPropType;
        const normPropType = normalizePropertyType(rawPropType);
        setPropertyType(normPropType);

        if (normPropType && !PROPERTY_TYPES.includes(normPropType)) {
          setPropertyTypeOptions((prev) => Array.from(new Set([...prev, normPropType])));
        }

        // Bedrooms
        const rawBeds = opp ? (opp.bedrooms || qual.bedrooms || '') : fbBeds;
        const normBeds = normalizeBedrooms(rawBeds);
        setBedrooms(normBeds);

        if (normBeds && !BEDROOMS.includes(normBeds)) {
          setBedroomOptions((prev) => Array.from(new Set([...prev, normBeds])));
        }

        // Budget Min & Max
        const bMin = opp ? (opp.budget_min ? String(opp.budget_min) : '') : fbMin;
        const bMax = opp ? (opp.budget_max ? String(opp.budget_max) : '') : fbMax;
        setBudgetMin(bMin);
        setBudgetMax(bMax);

        // Payment Method
        const rawPm = opp ? (opp.cash_or_finance || qual.cash_or_finance || '') : fbPm;
        const normPm = normalizePaymentMethod(rawPm);
        setPaymentMethod(normPm);

        if (normPm && !PAYMENT_METHODS.some((pm) => pm.value === normPm)) {
          setPaymentMethodOptions((prev) => [...prev, { value: normPm, label: rawPm || normPm }]);
        }

        // Key Requirement / Notes
        const keyReqVal = opp ? (opp.key_requirement || '') : fbKeyReq;
        setKeyRequirement(keyReqVal);

        // Sales Ownership
        const ownerVal = opp ? (opp.current_owner_name || contactData.assigned_to || '') : (contactData.assigned_to || '');
        setAssignedOwner(ownerVal);

        const rawUsers = Array.isArray(usersData) ? usersData : (usersData?.users || []);
        const userOpts = rawUsers.map((u: any) => ({
          value: u.name,
          label: `${u.name} (${u.role || u.department || 'Sales Advisor'})`,
        }));
        const allOwnerOpts = [
          { value: 'Unassigned', label: 'Unassigned / Auto-Distribute (Rotation Pool)' },
          ...userOpts,
        ];
        if (ownerVal && !allOwnerOpts.some((o: any) => o.value === ownerVal)) {
          allOwnerOpts.push({ value: ownerVal, label: `${ownerVal} (Assigned Advisor)` });
        }
        setOwnerOptions(allOwnerOpts);

        // Next Action & Due Date
        const nextActionVal = opp ? (opp.next_action || '') : fbNextAction;
        setNextAction(nextActionVal);

        const dueDateVal = opp && opp.next_action_due_at ? opp.next_action_due_at.substring(0, 16) : '';
        setNextActionDueDate(dueDateVal);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading lead record:", err);
        setError("Failed to load lead record details from database.");
        setLoading(false);
      });
  }, [contactId]);

  // Frontend Validation (3 mandatory fields)
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

  // Dynamic Option Handlers
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

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Update Contact Details
      await fetchApi(`/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          phone,
          secondary_phone: secondaryPhone || null,
          email,
          nationality: nationality || null,
          emirates_id: emiratesId || null,
          source: source ? (subSource ? `${source} (${subSource})` : source) : null,
          sub_source: subSource || null,
          assigned_owner: assignedOwner || null,
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          utm_campaign: utmCampaign || null,
          utm_term: utmTerm || null,
          utm_content: utmContent || null,
          landing_page_url: landingPageUrl || null,
          campaign_url: landingPageUrl || null,
        }),
      });

      // Step 2: If an active Opportunity exists, update its qualification details, or create one if specs are provided
      const oppPayload = {
        contact_id: contactId,
        opportunity_type: opportunityType || 'buyer',
        temperature: temperature || 'warm',
        developer: developer || null,
        community: community || null,
        project: project || null,
        project_property: projectProperty || null,
        property_type: propertyType || null,
        bedrooms: bedrooms || null,
        cash_or_finance: paymentMethod || null,
        budget_min: budgetMin ? Number(budgetMin) : null,
        budget_max: budgetMax ? Number(budgetMax) : null,
        key_requirement: keyRequirement || 'Updated Inquiry Details',
        next_action: nextAction || 'Follow up with updated lead requirements',
        next_action_due_at: nextActionDueDate || null,
        current_owner_name: assignedOwner && assignedOwner !== 'Unassigned' ? assignedOwner : 'Unassigned',
      };

      if (activeOppId) {
        await fetchApi(`/opportunities/${activeOppId}/qualify`, {
          method: 'POST',
          body: JSON.stringify(oppPayload),
        });
      } else if (developer || community || project || budgetMin || budgetMax || nextAction || opportunityType) {
        await fetchApi('/opportunities', {
          method: 'POST',
          body: JSON.stringify({
            ...oppPayload,
            stage: 'new',
          }),
        });
      }

      setSubmitting(false);
      Swal.fire({
        title: 'Lead Updated!',
        text: `Lead record for "${name}" has been updated successfully in database.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
      });
      router.push('/');
    } catch (err: any) {
      setSubmitting(false);
      if (err.errors && typeof err.errors === 'object') {
        const backendErrs: Record<string, string> = {};
        if (err.errors.name) backendErrs.name = err.errors.name[0];
        if (err.errors.phone) backendErrs.phone = err.errors.phone[0];
        if (err.errors.email) backendErrs.email = err.errors.email[0];
        setFieldErrors((prev) => ({ ...prev, ...backendErrs }));
      }
      setError(err.message || 'Failed to update lead record.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
        <Sidebar />
        <div className="flex-1 pl-56 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-[#C8A147] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#6E6E6E]">Loading Lead Record #{contactId} from database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex">
      {/* Deep Navy Sidebar */}
      <Sidebar />

      {/* Main Viewport matching standard full-width layout */}
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
                Edit Lead Record #{contactId}
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Update client details, source channel & opportunity workspace qualification. Mandatory fields: Full Name, Primary Phone & Email.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-4 py-2.5 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-medium rounded-md hover:bg-slate-50 text-xs transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-white" />
                <span className="text-white">{submitting ? 'Updating...' : 'Save Lead Changes'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MAIN FORM CONTAINER */}
          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            
            {/* SECTION 1: Client Personal Profile */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-3">
                <div className="flex items-center gap-2 text-[#081428] font-bold text-sm">
                  <User className="w-4 h-4 text-[#C8A147]" />
                  <span>1. Client Personal Profile</span>
                </div>
                <span className="text-[10px] text-red-500 font-semibold">* Red label fields are mandatory</span>
              </div>

              {/* Grid 1: Name, Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Client Full Name */}
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Client Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Zayed Al Nahyan"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    className={`w-full p-2.5 bg-white border rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none ${
                      fieldErrors.name ? 'border-red-500 bg-red-50/20' : 'border-[#E8E4DC]'
                    }`}
                  />
                  {fieldErrors.name && (
                    <p className="text-red-500 text-[11px] font-semibold mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Primary Phone Number */}
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Primary Phone Number <span className="text-red-500">*</span>
                  </label>
                  <PhoneInput
                    value={phone}
                    onChange={(val) => {
                      setPhone(val);
                      if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    hasError={!!fieldErrors.phone}
                  />
                  {fieldErrors.phone && (
                    <p className="text-red-500 text-[11px] font-semibold mt-1">{fieldErrors.phone}</p>
                  )}
                </div>

                {/* Secondary Phone */}
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Secondary Phone <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <PhoneInput
                    value={secondaryPhone}
                    onChange={setSecondaryPhone}
                    placeholder="Optional secondary phone"
                  />
                </div>
              </div>

              {/* Grid 2: Email Address, Nationality & Emirates ID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                {/* Email Address */}
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="zayed@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    className={`w-full p-2.5 bg-white border rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none ${
                      fieldErrors.email ? 'border-red-500 bg-red-50/20' : 'border-[#E8E4DC]'
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="text-red-500 text-[11px] font-semibold mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Nationality <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={nationalities}
                    value={nationality}
                    onChange={setNationality}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Emirates ID / Passport No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 784-1990-1234567-1"
                    value={emiratesId}
                    onChange={(e) => setEmiratesId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Lead Origin & Source */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 text-[#081428] font-bold text-sm border-b border-[#E8E4DC] pb-3">
                <Globe className="w-4 h-4 text-[#C8A147]" />
                <span>2. Lead Origin & Source Channel</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Lead Source Channel */}
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Lead Source Channel <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={leadSourceOptions}
                    value={source}
                    onChange={handleSourceChange}
                    placeholder="Please Select..."
                  />
                </div>

                {/* Sub-Source Campaign */}
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Sub-Source Campaign <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={(subSourcesMap[source] || []).map((sub) => ({ value: sub, label: sub }))}
                    value={subSource}
                    onChange={setSubSource}
                    placeholder={source ? `Please Select ${source} Sub-Source...` : 'Please Select Source First...'}
                    disabled={!source}
                  />
                </div>
              </div>
            </div>

            {/* SECTION: Marketing & UTM Attribution Parameters */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="border-b border-[#E8E4DC] pb-3 flex items-center justify-between">
                <h2 className="font-heading font-bold text-sm text-[#081428] flex items-center gap-2 uppercase tracking-wider">
                  <Target className="w-4 h-4 text-[#C8A147]" />
                  <span>Marketing & UTM Parameters</span>
                </h2>
                <span className="text-[10px] text-[#C8A147] font-semibold uppercase tracking-wider bg-[#F9F6EE] px-2.5 py-1 rounded border border-[#C8A147]/30">Campaign Attribution</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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

            {/* SECTION 3: Opportunity Requirements & Investment Qualifications */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 text-[#081428] font-bold text-sm border-b border-[#E8E4DC] pb-3">
                <Briefcase className="w-4 h-4 text-[#C8A147]" />
                <span>3. Opportunity Workspace & Investment Qualifications</span>
              </div>

              {/* Row 1: Opportunity Type, Temperature & Payment Plan (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Opportunity Type <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={opportunityTypeOptions}
                    value={opportunityType}
                    onChange={setOpportunityType}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Temperature / Urgency <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={TEMPERATURES}
                    value={temperature}
                    onChange={setTemperature}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Payment Plan / Funding <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={paymentMethodOptions}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    placeholder="Please Select..."
                  />
                </div>
              </div>

              {/* Row 2: Developer, Community & Project (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Target Developer <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={developers.map((d) => ({ value: d, label: `🏗️ ${d}` }))}
                    value={developer}
                    onChange={setDeveloper}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Preferred Community <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={communities.map((c) => ({ value: c, label: `📍 ${c}` }))}
                    value={community}
                    onChange={setCommunity}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Target Project <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={projects.map((p) => ({ value: p, label: `🏢 ${p}` }))}
                    value={project}
                    onChange={handleProjectChange}
                    onAddOption={handleAddCustomProject}
                    placeholder="Please Select..."
                  />
                </div>
              </div>

              {/* Row 3: Property Type, Bedrooms & Specific Unit (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Property Type <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={propertyTypeOptions.map((pt) => ({ value: pt, label: pt }))}
                    value={propertyType}
                    onChange={setPropertyType}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Bedrooms <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={bedroomOptions.map((b) => ({ value: b, label: b }))}
                    value={bedrooms}
                    onChange={setBedrooms}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Specific Property Unit {project ? `in ${project}` : ''} <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={project ? (projectPropertiesMap[project] || []).map((prop) => ({ value: prop, label: `🔑 ${prop}` })) : []}
                    value={projectProperty}
                    onChange={setProjectProperty}
                    onAddOption={handleAddCustomProjectProperty}
                    placeholder={project ? `Select Property Unit...` : 'Select Project First...'}
                    disabled={!project}
                  />
                </div>
              </div>

              {/* Row 4: Min Budget, Max Budget & Budget Range Indicator (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Min Budget (AED) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1500000"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Max Budget (AED) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 3000000"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Target Budget Range <span className="text-slate-400 font-normal">(Auto-calculated)</span>
                  </label>
                  <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#081428] font-medium flex items-center justify-between h-[38px]">
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
              <div className="pt-2">
                <label className="block font-semibold text-[#081428] mb-1">
                  Key Requirement & Specific Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Looking for high floor unit with Sea View and Post-Handover payment plan..."
                  value={keyRequirement}
                  onChange={(e) => setKeyRequirement(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none"
                />
              </div>
            </div>

            {/* SECTION 4: Sales Ownership & SLA Engine */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 text-[#081428] font-bold text-sm border-b border-[#E8E4DC] pb-3">
                <Building2 className="w-4 h-4 text-[#C8A147]" />
                <span>4. Sales Ownership & Immediate Next Action</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Assigned Sales Owner / Advisor <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <SearchableSelect
                    options={ownerOptions}
                    value={assignedOwner}
                    onChange={setAssignedOwner}
                    placeholder="Please Select..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Immediate Next Action <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Call client to confirm requirements..."
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#081428] mb-1">
                    Next Action Due Date & Time <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={nextActionDueDate}
                    onChange={(e) => setNextActionDueDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions Footer */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E8E4DC]">
              <Link
                href="/"
                className="px-5 py-2.5 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-medium rounded-md hover:bg-slate-50 text-xs transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#C8A147] hover:bg-[#b48e35] text-white font-bold rounded-md text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-white" />
                <span className="text-white">{submitting ? 'Updating...' : 'Save Lead Changes'}</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
