'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import SearchableSelect from '@/components/SearchableSelect';
import { fetchApi } from '@/lib/api';
import { 
  Briefcase, UserCheck, ArrowLeft, Plus, AlertCircle, Clock, Building2 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

const COMMUNITIES = [
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

const DEVELOPERS = [
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
  { value: 'Mako', label: 'Mako (Telesales Senior)' },
  { value: 'Hiba', label: 'Hiba (Telesales Advisor)' },
  { value: 'Faraz Shafi', label: 'Faraz Shafi (Sales Manager / CEO)' },
];

export default function CreateOpportunityPage() {
  const router = useRouter();

  const [contactsList, setContactsList] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  // Opportunity Specs
  const [opportunityType, setOpportunityType] = useState('buyer');
  const [temperature, setTemperature] = useState('hot');
  const [developer, setDeveloper] = useState('Emaar Properties');
  const [community, setCommunity] = useState('Downtown Dubai');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bedrooms, setBedrooms] = useState('2 BR');
  const [budgetMin, setBudgetMin] = useState('1800000');
  const [budgetMax, setBudgetMax] = useState('2200000');
  const [keyRequirement, setKeyRequirement] = useState('');

  // SLA Action Assignment
  const [assignedOwner, setAssignedOwner] = useState('Mako');
  const [nextAction, setNextAction] = useState('Call client — confirm requirement details');
  const [nextActionDueDate, setNextActionDueDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi('/contacts').then((res) => {
      const list = Array.isArray(res) ? res : res.contacts?.data || res.data || [];
      setContactsList(list);
      if (list.length > 0) {
        setSelectedContactId(String(list[0].id));
      }
    }).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) {
      setError('Please select an existing contact from the Lead Bank.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const oppRes = await fetchApi('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: Number(selectedContactId),
          opportunity_type: opportunityType,
          temperature,
          developer,
          community,
          property_type: propertyType,
          bedrooms,
          budget_min: Number(budgetMin),
          budget_max: Number(budgetMax),
          key_requirement: keyRequirement || `Interested in ${bedrooms} ${propertyType} by ${developer} in ${community}`,
          next_action: nextAction,
          next_action_due_at: nextActionDueDate,
          current_owner_name: assignedOwner,
        }),
      });

      setLoading(false);
      router.push(`/opportunities/${oppRes.id}`);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to create opportunity');
    }
  };

  const contactOptions = contactsList.map((c) => ({
    value: String(c.id),
    label: `👤 ${c.name} (${c.phone}) — ${c.nationality || 'Emirati'} · Source: ${c.source || 'Database'}`,
  }));

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
                href="/opportunities" 
                className="inline-flex items-center gap-1.5 text-xs text-[#C8A147] font-semibold hover:underline mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Opportunities List</span>
              </Link>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                Create Opportunity for Existing Contact
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Instantiate a new deal / transaction for an existing contact in the Master Lead Bank.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* SECTION 1: Existing Contact Selection */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <h2 className="font-heading font-bold text-base text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
                <UserCheck className="w-4 h-4 text-[#C8A147]" />
                <span>1. Select Existing Contact from Lead Bank</span>
              </h2>

              <div>
                <label className="block text-[#081428] font-bold mb-1">Select Client Contact *</label>
                <SearchableSelect
                  options={contactOptions}
                  value={selectedContactId}
                  onChange={setSelectedContactId}
                  placeholder="Search contact name, phone, or nationality..."
                />
              </div>
            </div>

            {/* SECTION 2: Opportunity Specifications */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 space-y-4 shadow-2xs">
              <h2 className="font-heading font-bold text-base text-[#081428] border-b border-[#E8E4DC] pb-3 flex items-center gap-2 uppercase tracking-wider">
                <Briefcase className="w-4 h-4 text-[#C8A147]" />
                <span>2. Opportunity Specifications & Preferences</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[#081428] font-bold mb-1">Opportunity Type *</label>
                  <SearchableSelect
                    options={OPPORTUNITY_TYPES}
                    value={opportunityType}
                    onChange={setOpportunityType}
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-bold mb-1">Initial Temperature *</label>
                  <SearchableSelect
                    options={TEMPERATURES}
                    value={temperature}
                    onChange={setTemperature}
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-bold mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#C8A147]" />
                    <span>Developer *</span>
                  </label>
                  <SearchableSelect
                    options={DEVELOPERS}
                    value={developer}
                    onChange={setDeveloper}
                    placeholder="Select Developer..."
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-bold mb-1">Target Location / Community *</label>
                  <SearchableSelect
                    options={COMMUNITIES}
                    value={community}
                    onChange={setCommunity}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#081428] font-bold mb-1">Property Type *</label>
                  <SearchableSelect
                    options={PROPERTY_TYPES}
                    value={propertyType}
                    onChange={setPropertyType}
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-bold mb-1">Bedrooms Preference</label>
                  <SearchableSelect
                    options={BEDROOMS}
                    value={bedrooms}
                    onChange={setBedrooms}
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-bold mb-1">Min Budget (AED) *</label>
                  <input
                    type="number"
                    required
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#081428] font-bold mb-1">Max Budget (AED) *</label>
                  <input
                    type="number"
                    required
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#081428] font-bold mb-1">Key Requirement Overview & Notes</label>
                <textarea
                  rows={3}
                  value={keyRequirement}
                  onChange={(e) => setKeyRequirement(e.target.value)}
                  placeholder="Enter specific client requirements, preferred views, amenities..."
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] focus:bg-white focus:outline-none focus:border-[#C8A147]"
                />
              </div>
            </div>

            {/* SECTION 3: Mandatory SLA Action & Ownership */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 space-y-4 shadow-2xs">
              <h2 className="font-heading font-bold text-base text-[#081428] border-b border-amber-200 pb-3 flex items-center gap-2 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>3. Mandatory SLA Next Action & Ownership Assignment</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#081428] font-bold mb-1">Assigned Agent / Owner *</label>
                  <SearchableSelect
                    options={ASSIGNED_OWNERS}
                    value={assignedOwner}
                    onChange={setAssignedOwner}
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-bold mb-1">Next Required Action *</label>
                  <input
                    type="text"
                    required
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[#081428] font-bold mb-1">Due Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
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
                href="/opportunities"
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
                <span>{loading ? 'Creating...' : 'Create Opportunity Workspace'}</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
