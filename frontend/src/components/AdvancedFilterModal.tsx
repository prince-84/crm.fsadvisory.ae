'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Filter, RotateCcw, Globe, Briefcase, Building2, Check, Sparkles, SlidersHorizontal } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import SearchableSelect from './SearchableSelect';

export interface AdvancedFiltersState {
  state: string;
  availability: string;
  source: string;
  subSource: string;
  opportunityType: string;
  temperature: string;
  paymentMethod: string;
  developer: string;
  community: string;
  project: string;
  propertyType: string;
  bedrooms: string;
  projectProperty: string;
  budgetMin: string;
  budgetMax: string;
}

export const INITIAL_ADVANCED_FILTERS: AdvancedFiltersState = {
  state: '',
  availability: '',
  source: '',
  subSource: '',
  opportunityType: '',
  temperature: '',
  paymentMethod: '',
  developer: '',
  community: '',
  project: '',
  propertyType: '',
  bedrooms: '',
  projectProperty: '',
  budgetMin: '',
  budgetMax: '',
};

const LIFECYCLE_STATES = [
  { value: '', label: 'All Lifecycle States' },
  { value: 'available', label: 'Available Pool' },
  { value: 'active', label: 'Active Deals' },
  { value: 'reactivation', label: 'Reactivation Eligible' },
  { value: 'duplicate', label: 'Duplicates' },
];

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Availability: All' },
  { value: 'available', label: 'Available Only (Unassigned)' },
  { value: 'busy', label: 'Assigned / Busy' },
];

const INITIAL_LEAD_SOURCES = [
  { value: 'Website', label: 'Official Website Inbound' },
  { value: 'Meta Ads', label: 'Meta Ads (Facebook & Instagram)' },
  { value: 'Google Ads', label: 'Google Ads Search' },
  { value: 'Property Finder', label: 'Property Finder Portal' },
  { value: 'Bayut', label: 'Bayut UAE Portal' },
  { value: 'Dubizzle', label: 'Dubizzle Property' },
  { value: 'Referral', label: 'Client / Agent Referral' },
  { value: 'Walk-in', label: 'Walk-in Direct Client' },
  { value: 'Database', label: 'Master Cold Database' },
];

const INITIAL_SUB_SOURCES: Record<string, string[]> = {
  Website: ['Official Website Form', 'Contact Us Page', 'Live Chatbot Inquiry', 'Organic Google Search (SEO)', 'Direct URL Visit'],
  'Meta Ads': ['Facebook Lead Form', 'Instagram Direct Ad', 'Meta Stories / Reels Ad', 'Retargeting Campaign', 'Custom Audience Campaign'],
  'Google Ads': ['Google Search PPC', 'Display Network Banner', 'Performance Max (PMax)', 'YouTube Video Ad'],
  'Property Finder': ['Premium Featured Listing', 'Verified Unit Badge', 'Portal WhatsApp Inquiry', 'Agent Profile Direct Call'],
  Bayut: ['TruCheck Verified Listing', 'Bayut Pro Banner Ad', 'Hot Listing Portal Inquiry'],
  Dubizzle: ['Dubizzle Premium Ad', 'Verified Seller Inquiry', 'Classified Listing Call'],
  Referral: ['Existing Client Referral', 'Partner Broker / Agency', 'Staff / Family Referral', 'VIP Network Intro'],
  'Walk-in': ['Head Office Reception', 'Sales Presentation Center', 'Property Exhibition / Event'],
  Database: ['Cold Telesales Campaign', 'SMS Broadcast Campaign', 'Email Newsletter Blast', 'Past Client Re-engagement'],
};

const INITIAL_DEVELOPERS = [
  'Emaar Properties', 'Nakheel', 'DAMAC Properties', 'Sobha Realty',
  'Meraas', 'Dubai Properties', 'Aldar Properties', 'Danube Properties',
  'Ellington Properties', 'Omniyat', 'Select Group', 'Binghatti Developers',
];

const INITIAL_COMMUNITIES = [
  'Downtown Dubai', 'Palm Jumeirah', 'Business Bay', 'Dubai Marina',
  'Dubai Hills Estate', 'Jumeirah Golf Estates', 'Arabian Ranches',
  'Dubai Creek Harbour', 'MBR City (Sobha Hartland)', 'Emaar Beachfront',
];

const INITIAL_PROJECTS = [
  'Burj Crown Residences', 'Sobha Hartland Waves', 'Dubai Creek Residences',
  'Marina Gate Towers', 'Palm Beach Towers', 'DAMAC Hills Villa Cluster',
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
};

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
  'Apartment', 'Villa / Mansion', 'Townhouse', 'Penthouse',
  'Duplex', 'Land Plot', 'Commercial Office',
];

const BEDROOMS = ['Studio', '1 BR', '2 BR', '3 BR', '4 BR', '5+ BR'];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Ready Cash / Equity' },
  { value: 'finance', label: 'Bank Mortgage Approved' },
  { value: 'offplan_plan', label: 'Off-Plan Payment Plan' },
];

interface AdvancedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedFiltersState;
  onApply: (newFilters: AdvancedFiltersState) => void;
  onReset: () => void;
  activeCount: number;
}

export default function AdvancedFilterModal({
  isOpen,
  onClose,
  filters,
  onApply,
  onReset,
  activeCount,
}: AdvancedFilterModalProps) {
  const [draft, setDraft] = useState<AdvancedFiltersState>(filters);

  // Dynamic Catalogs
  const [leadSourceOptions, setLeadSourceOptions] = useState<any[]>(INITIAL_LEAD_SOURCES);
  const [subSourcesMap, setSubSourcesMap] = useState<Record<string, string[]>>(INITIAL_SUB_SOURCES);
  const [developers, setDevelopers] = useState<string[]>(INITIAL_DEVELOPERS);
  const [communities, setCommunities] = useState<string[]>(INITIAL_COMMUNITIES);
  const [projects, setProjects] = useState<string[]>(INITIAL_PROJECTS);
  const [projectPropertiesMap, setProjectPropertiesMap] = useState<Record<string, string[]>>(INITIAL_PROJECT_PROPERTIES);

  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
    }
  }, [isOpen, filters]);

  // Load Catalogs from Backend
  useEffect(() => {
    Promise.all([
      fetchApi('/lead-sources').catch(() => null),
      fetchApi('/developers').catch(() => null),
      fetchApi('/communities').catch(() => null),
      fetchApi('/projects').catch(() => null),
    ]).then(([sourcesData, devData, commData, projData]) => {
      if (Array.isArray(sourcesData) && sourcesData.length > 0) {
        const formatted = sourcesData.map((s: any) => ({
          value: s.name,
          label: s.name,
        }));
        setLeadSourceOptions(formatted);

        const subMap: Record<string, string[]> = { ...INITIAL_SUB_SOURCES };
        sourcesData.forEach((s: any) => {
          if (Array.isArray(s.sub_sources) && s.sub_sources.length > 0) {
            subMap[s.name] = s.sub_sources.map((ss: any) => ss.name || ss);
          }
        });
        setSubSourcesMap(subMap);
      }

      if (Array.isArray(devData) && devData.length > 0) {
        setDevelopers(devData.map((d: any) => d.name));
      }

      if (Array.isArray(commData) && commData.length > 0) {
        setCommunities(commData.map((c: any) => c.name));
      }

      if (Array.isArray(projData) && projData.length > 0) {
        setProjects(projData.map((p: any) => p.name));
      }
    });
  }, []);

  const currentSubSources = useMemo(() => {
    return draft.source ? (subSourcesMap[draft.source] || ['General Inbound']) : [];
  }, [draft.source, subSourcesMap]);

  const currentProjectProperties = useMemo(() => {
    return draft.project ? (projectPropertiesMap[draft.project] || ['Standard Unit']) : [];
  }, [draft.project, projectPropertiesMap]);

  const calculatedBudgetRange = useMemo(() => {
    const min = draft.budgetMin ? Number(draft.budgetMin) : null;
    const max = draft.budgetMax ? Number(draft.budgetMax) : null;

    if (!min && !max) return 'AED Not Specified';
    if (min && max) return `AED ${min.toLocaleString()} – ${max.toLocaleString()}`;
    if (min && !max) return `From AED ${min.toLocaleString()}`;
    if (!min && max) return `Up to AED ${max.toLocaleString()}`;
    return 'AED Not Specified';
  }, [draft.budgetMin, draft.budgetMax]);

  const draftActiveCount = useMemo(() => {
    return Object.values(draft).filter((v) => v && v.trim() !== '' && v !== 'all').length;
  }, [draft]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E4DC] rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between border-b border-[#122444]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C8A147] text-[#081428] font-bold flex items-center justify-center shadow-xs">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-lg text-white">Advanced Lead Filters</h2>
                {draftActiveCount > 0 && (
                  <span className="bg-[#C8A147] text-[#081428] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {draftActiveCount} active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Filter Lead Pool by acquisition source channel, opportunity requirements, community, and budget.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#122444] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-[#FAF8F5]">
          {/* LEAD STATUS & AVAILABILITY */}
          <div className="bg-white border border-[#E8E4DC] rounded-xl p-5 space-y-4 shadow-2xs">
            <h3 className="font-heading font-bold text-sm text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
              <SlidersHorizontal className="w-4 h-4 text-[#C8A147]" />
              <span>Lead Lifecycle & Availability</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Lifecycle State
                </label>
                <SearchableSelect
                  options={LIFECYCLE_STATES}
                  value={draft.state}
                  onChange={(val) => setDraft((prev) => ({ ...prev, state: val }))}
                  placeholder="All Lifecycle States"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Lead Availability
                </label>
                <SearchableSelect
                  options={AVAILABILITY_OPTIONS}
                  value={draft.availability}
                  onChange={(val) => setDraft((prev) => ({ ...prev, availability: val }))}
                  placeholder="Availability: All"
                />
              </div>
            </div>
          </div>

          {/* LEAD ORIGIN & CHANNEL SOURCE */}
          <div className="bg-white border border-[#E8E4DC] rounded-xl p-5 space-y-4 shadow-2xs">
            <h3 className="font-heading font-bold text-sm text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
              <Globe className="w-4 h-4 text-[#C8A147]" />
              <span>Lead Origin & Channel Source</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Lead Source Channel
                </label>
                <SearchableSelect
                  options={leadSourceOptions}
                  value={draft.source}
                  onChange={(val) => {
                    setDraft((prev) => ({
                      ...prev,
                      source: val,
                      subSource: '', // reset sub-source when parent changes
                    }));
                  }}
                  placeholder="Please Select Lead Source..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Sub-Source Channel
                </label>
                <SearchableSelect
                  options={currentSubSources}
                  value={draft.subSource}
                  onChange={(val) => setDraft((prev) => ({ ...prev, subSource: val }))}
                  placeholder={draft.source ? 'Please Select Sub-Source...' : 'Select Source Channel First...'}
                  disabled={!draft.source}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: OPPORTUNITY REQUIREMENTS & PROPERTY PREFERENCES */}
          <div className="bg-white border border-[#E8E4DC] rounded-xl p-5 space-y-4 shadow-2xs">
            <h3 className="font-heading font-bold text-sm text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
              <Briefcase className="w-4 h-4 text-[#C8A147]" />
              <span>Opportunity Requirements & Property Preferences</span>
            </h3>

            {/* Row 1: Opportunity Type, Initial Temperature & Payment Method */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Opportunity Type
                </label>
                <SearchableSelect
                  options={OPPORTUNITY_TYPES}
                  value={draft.opportunityType}
                  onChange={(val) => setDraft((prev) => ({ ...prev, opportunityType: val }))}
                  placeholder="Please Select Opportunity Type..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Initial Temperature
                </label>
                <SearchableSelect
                  options={TEMPERATURES}
                  value={draft.temperature}
                  onChange={(val) => setDraft((prev) => ({ ...prev, temperature: val }))}
                  placeholder="Please Select Temperature..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Payment Method
                </label>
                <SearchableSelect
                  options={PAYMENT_METHODS}
                  value={draft.paymentMethod}
                  onChange={(val) => setDraft((prev) => ({ ...prev, paymentMethod: val }))}
                  placeholder="Please Select Payment Method..."
                />
              </div>
            </div>

            {/* Row 2: Developer, Community & Project */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Developer</span>
                </label>
                <SearchableSelect
                  options={developers}
                  value={draft.developer}
                  onChange={(val) => setDraft((prev) => ({ ...prev, developer: val }))}
                  placeholder="Please Select Developer..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Target Location / Community
                </label>
                <SearchableSelect
                  options={communities}
                  value={draft.community}
                  onChange={(val) => setDraft((prev) => ({ ...prev, community: val }))}
                  placeholder="Please Select Community..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Project</span>
                </label>
                <SearchableSelect
                  options={projects}
                  value={draft.project}
                  onChange={(val) => {
                    setDraft((prev) => ({
                      ...prev,
                      project: val,
                      projectProperty: '', // reset unit when project changes
                    }));
                  }}
                  placeholder="Please Select Project..."
                />
              </div>
            </div>

            {/* Row 3: Property Type, Bedrooms Preference & Specific Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Property Type
                </label>
                <SearchableSelect
                  options={PROPERTY_TYPES}
                  value={draft.propertyType}
                  onChange={(val) => setDraft((prev) => ({ ...prev, propertyType: val }))}
                  placeholder="Please Select Type..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Bedrooms Preference
                </label>
                <SearchableSelect
                  options={BEDROOMS}
                  value={draft.bedrooms}
                  onChange={(val) => setDraft((prev) => ({ ...prev, bedrooms: val }))}
                  placeholder="Please Select Bedrooms..."
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Specific Unit</span>
                </label>
                <SearchableSelect
                  options={currentProjectProperties}
                  value={draft.projectProperty}
                  onChange={(val) => setDraft((prev) => ({ ...prev, projectProperty: val }))}
                  placeholder={draft.project ? `Select Unit in ${draft.project}...` : 'Select Project First...'}
                  disabled={!draft.project}
                />
              </div>
            </div>

            {/* Row 4: Min Budget, Max Budget & Auto-calculated Target Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Min Budget (AED)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1800000"
                  value={draft.budgetMin}
                  onChange={(e) => setDraft((prev) => ({ ...prev, budgetMin: e.target.value }))}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Max Budget (AED)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2500000"
                  value={draft.budgetMax}
                  onChange={(e) => setDraft((prev) => ({ ...prev, budgetMax: e.target.value }))}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold text-xs mb-1.5">
                  Target Budget Range <span className="text-slate-400 font-normal">(Auto-calculated)</span>
                </label>
                <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#081428] font-medium flex items-center justify-between h-[38px]">
                  <span className="text-[#6E6E6E] text-[11px]">Calculated Range:</span>
                  <span className="font-semibold text-[#C8A147]">
                    {calculatedBudgetRange}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-[#E8E4DC] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setDraft(INITIAL_ADVANCED_FILTERS);
              onReset();
              onClose();
            }}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="px-5 py-2 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Filters {draftActiveCount > 0 ? `(${draftActiveCount})` : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
