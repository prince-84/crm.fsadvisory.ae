'use client';

import { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle, Building2, MapPin, Home, Bed, DollarSign, Calendar, Layers } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import SearchableSelect from './SearchableSelect';

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contact?: {
    id: number;
    name: string;
    phone: string;
    source?: string;
    nationality?: string;
  } | null;
  ownerRecord?: any | null;
}

const DEFAULT_OPPORTUNITY_TYPES = [
  { value: 'buyer', label: 'Buyer Opportunity' },
  { value: 'seller', label: 'Seller Opportunity' },
  { value: 'landlord', label: 'Landlord Opportunity' },
  { value: 'tenant', label: 'Tenant Opportunity' },
];

const TEMPERATURES = [
  { value: 'hot', label: '🔴 Hot (Ready to proceed)' },
  { value: 'warm', label: '🟠 Warm (Requires follow-up)' },
  { value: 'cold', label: '🔵 Cold (Long-term potential)' },
];

const DEFAULT_DEVELOPERS = [
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
  'Other / General',
];

const DEFAULT_COMMUNITIES = [
  'Downtown Dubai',
  'Dubai Marina',
  'Palm Jumeirah',
  'Business Bay',
  'Dubai Hills Estate',
  'Dubai Creek Harbour',
  'Jumeirah Village Circle (JVC)',
  'MBR City (Sobha Hartland)',
  'Arabian Ranches',
  'Damac Hills',
  'Bluewaters Island',
  'City Walk',
  'DIFC',
  'Jumeirah Beach Residence (JBR)',
  'Other / General',
];

const DEFAULT_PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Townhouse',
  'Penthouse',
  'Duplex',
  'Plot / Land',
  'Commercial / Office',
  'Whole Building',
  'Other',
];

const BEDROOM_OPTIONS = [
  'Studio',
  '1 Bedroom',
  '2 Bedrooms',
  '3 Bedrooms',
  '4 Bedrooms',
  '5 Bedrooms',
  '6+ Bedrooms',
  'Penthouse',
  'Duplex',
  'Villa / Townhouse',
];

const MARKET_OPTIONS = [
  { value: 'Offplan', label: 'Offplan' },
  { value: 'Secondary', label: 'Secondary' },
];

const HANDOVER_YEARS = [
  { value: 'Ready / Completed', label: 'Ready / Completed' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
  { value: '2028', label: '2028' },
  { value: '2029', label: '2029' },
  { value: '2030+', label: '2030+' },
];

export default function CreateOpportunityModal({
  isOpen,
  onClose,
  onSuccess,
  contact,
  ownerRecord,
}: CreateOpportunityModalProps) {
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  // Form fields (blank by default, no pre-filled values)
  const [opportunityType, setOpportunityType] = useState('');
  const [temperature, setTemperature] = useState('');
  const [developer, setDeveloper] = useState('');
  const [community, setCommunity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [paymentPlan, setPaymentPlan] = useState('');
  const [market, setMarket] = useState('');
  const [handover, setHandover] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [keyRequirement, setKeyRequirement] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dynamic catalogs loaded from DB
  const [opportunityTypeOptions, setOpportunityTypeOptions] = useState<any[]>(DEFAULT_OPPORTUNITY_TYPES);
  const [developerOptions, setDeveloperOptions] = useState<string[]>(DEFAULT_DEVELOPERS);
  const [communityOptions, setCommunityOptions] = useState<string[]>(DEFAULT_COMMUNITIES);
  const [propertyTypeOptions, setPropertyTypeOptions] = useState<string[]>(DEFAULT_PROPERTY_TYPES);

  useEffect(() => {
    // 1. Opportunity Types
    fetchApi('/catalog/opportunity-types')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setOpportunityTypeOptions(
            data.filter((ot: any) => ot.is_active).map((ot: any) => ({
              value: ot.slug || ot.name,
              label: ot.name,
            }))
          );
        }
      })
      .catch(() => {});

    // 2. Developers
    fetchApi('/catalog/developers')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.filter((d: any) => d.is_active).map((d: any) => d.name);
          if (names.length > 0) setDeveloperOptions(names);
        }
      })
      .catch(() => {});

    // 3. Communities
    fetchApi('/catalog/communities')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.filter((c: any) => c.is_active).map((c: any) => c.name);
          if (names.length > 0) setCommunityOptions(names);
        }
      })
      .catch(() => {});

    // 4. Property Types
    fetchApi('/catalog/properties')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.filter((p: any) => p.is_active).map((p: any) => p.name);
          if (names.length > 0) setPropertyTypeOptions(names);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError('');
      // By default all fields start completely blank (not prefilled)
      setOpportunityType('');
      setTemperature('');
      setDeveloper('');
      setCommunity('');
      setPropertyType('');
      setBedrooms('');
      setPaymentPlan('');
      setMarket('');
      setHandover('');
      setBudgetMin('');
      setBudgetMax('');
      setKeyRequirement('');

      if (contact) {
        setSelectedContactId(String(contact.id));
      } else if (ownerRecord) {
        setSelectedContactId('');
      } else {
        setSelectedContactId('');
        // Fetch contacts if creating without a preselected contact
        fetchApi('/contacts')
          .then((data) => {
            const list = Array.isArray(data) ? data : (data?.contacts?.data || data?.contacts || data?.data || []);
            setContactsList(list);
          })
          .catch(() => {});
      }
    }
  }, [isOpen, contact, ownerRecord]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const targetContactId = contact ? contact.id : (selectedContactId ? Number(selectedContactId) : null);

    if (!targetContactId && !ownerRecord) {
      setError('Please select a contact from Lead Bank or an Owner Record');
      setLoading(false);
      return;
    }

    try {
      const payload: any = {
        opportunity_type: opportunityType || 'buyer',
        temperature: temperature || 'hot',
        developer: developer || null,
        community: community || null,
        property_type: propertyType || null,
        bedrooms: bedrooms || null,
        payment_plan: paymentPlan || null,
        market: market || null,
        handover_year: handover || null,
        budget_min: budgetMin !== '' ? Number(budgetMin) : null,
        budget_max: budgetMax !== '' ? Number(budgetMax) : null,
        key_requirement: keyRequirement || null,
        current_owner_name: (() => {
          try {
            const raw = localStorage.getItem('crm_user');
            if (raw) return JSON.parse(raw).name || 'Faraz Shafi';
          } catch {}
          return 'Faraz Shafi';
        })(),
      };

      if (ownerRecord) {
        payload.owner_record_id = ownerRecord.id;
        if (!payload.community && ownerRecord.area) payload.community = ownerRecord.area;
        if (!payload.property_type && ownerRecord.property_type) payload.property_type = ownerRecord.property_type;
        if (!payload.bedrooms && ownerRecord.bedrooms) payload.bedrooms = ownerRecord.bedrooms;
        payload.building_name = ownerRecord.building_name;
        payload.unit_number = ownerRecord.property_number;
      } else {
        payload.contact_id = targetContactId;
      }

      await fetchApi('/opportunities', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to create opportunity');
    }
  };

  const contactSelectOptions = contactsList.map((c) => ({
    value: String(c.id),
    label: `👤 ${c.name} (${c.phone}) — ${c.source || 'Database'}`,
  }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E4DC] rounded-lg max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#C8A147] text-white font-bold flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-base">
                {ownerRecord ? 'Create Opportunity for Property Owner' : 'Create New Active Opportunity'}
              </h2>
              <p className="text-xs text-[#C8A147]">
                {ownerRecord
                  ? `Instantiate a deal for ${ownerRecord.owner_name} (${ownerRecord.building_name || ownerRecord.area || 'Owner Registry'})`
                  : 'Instantiate a new deal under an existing Lead Bank contact.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-300 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Contact Selection */}
          <div>
            <label className="block text-[#081428] font-bold mb-1">
              {ownerRecord ? 'Property Owner & Asset Info' : 'Select Existing Contact from Lead Bank'}
            </label>
            {ownerRecord ? (
              <div className="p-3 bg-[#FAF8F5] border border-[#C8A147]/70 rounded-md font-bold text-[#081428] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">👤 {ownerRecord.owner_name}</span>
                  <span className="px-2 py-0.5 bg-[#081428] text-[#C8A147] rounded text-[10px] font-bold uppercase">
                    Owner Data Bank
                  </span>
                </div>
                <div className="text-xs text-slate-700 font-mono font-normal">
                  📱 {ownerRecord.mobile_number || ownerRecord.phone_number || '—'}{' '}
                  {ownerRecord.email ? `· ✉️ ${ownerRecord.email}` : ''}
                </div>
                <div className="text-[11px] text-slate-600 font-medium pt-1.5 border-t border-[#E8E4DC] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                  <span>
                    <strong>{ownerRecord.building_name || 'Building'}</strong>
                    {ownerRecord.property_number ? ` · Unit: ${ownerRecord.property_number}` : ''}
                    {ownerRecord.area ? ` · ${ownerRecord.area}` : ''}
                    {ownerRecord.bedrooms ? ` (${ownerRecord.bedrooms} ${ownerRecord.property_type || ''})` : ''}
                  </span>
                </div>
              </div>
            ) : contact ? (
              <div className="p-2.5 bg-[#FAF8F5] border border-emerald-300 rounded font-bold text-[#081428] text-xs flex items-center justify-between">
                <span>
                  👤 {contact.name} ({contact.phone})
                </span>
                <span className="text-emerald-700 font-semibold">{contact.nationality || 'Expat / UAE Resident'}</span>
              </div>
            ) : (
              <SearchableSelect
                options={contactSelectOptions}
                value={selectedContactId}
                onChange={setSelectedContactId}
                placeholder="Search contact name or phone..."
              />
            )}
          </div>

          {/* Opportunity Type & Temperature */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Opportunity Type</label>
              <SearchableSelect
                options={opportunityTypeOptions}
                value={opportunityType}
                onChange={setOpportunityType}
                placeholder="Select Opportunity Type..."
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1">Temperature</label>
              <SearchableSelect
                options={TEMPERATURES}
                value={temperature}
                onChange={setTemperature}
                placeholder="Select Temperature..."
              />
            </div>
          </div>

          {/* Developer & Community/Area/Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Developer</span>
              </label>
              <SearchableSelect
                options={developerOptions}
                value={developer}
                onChange={setDeveloper}
                placeholder="Select Developer..."
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Community / Area / Location</span>
              </label>
              <SearchableSelect
                options={communityOptions}
                value={community}
                onChange={setCommunity}
                placeholder="Select Community..."
              />
            </div>
          </div>

          {/* Property Type & Bedrooms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                <Home className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Property Type</span>
              </label>
              <SearchableSelect
                options={propertyTypeOptions}
                value={propertyType}
                onChange={setPropertyType}
                placeholder="Select Property Type..."
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                <Bed className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Bedrooms</span>
              </label>
              <SearchableSelect
                options={BEDROOM_OPTIONS}
                value={bedrooms}
                onChange={setBedrooms}
                placeholder="Select Bedrooms..."
              />
            </div>
          </div>

          {/* Market & Handover */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Market</span>
              </label>
              <SearchableSelect
                options={MARKET_OPTIONS}
                value={market}
                onChange={setMarket}
                placeholder="Select Market (Offplan / Secondary)..."
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Handover</span>
              </label>
              <SearchableSelect
                options={HANDOVER_YEARS}
                value={handover}
                onChange={setHandover}
                placeholder="Select Handover Year..."
              />
            </div>
          </div>

          {/* Payment Plan */}
          <div>
            <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-[#C8A147]" />
              <span>Payment Plan</span>
            </label>
            <input
              type="text"
              value={paymentPlan}
              onChange={(e) => setPaymentPlan(e.target.value)}
              placeholder="e.g. 60/40 on Handover, 50/50, 1% Monthly or Cash"
              className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C8A147]"
            />
          </div>

          {/* Min & Max Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Min Budget (AED)</label>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="e.g. 1500000"
                className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C8A147]"
              />
            </div>
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Max Budget (AED)</label>
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="e.g. 2500000"
                className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C8A147]"
              />
            </div>
          </div>

          {/* Key Requirement Overview */}
          <div>
            <label className="block text-[#081428] font-semibold mb-1">Key Requirement Overview</label>
            <input
              type="text"
              value={keyRequirement}
              onChange={(e) => setKeyRequirement(e.target.value)}
              placeholder="e.g. Interested in 2BR Apartment in Business Bay with Canal view"
              className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C8A147]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#E8E4DC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] hover:bg-slate-50 font-medium rounded text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating...' : '+ Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
