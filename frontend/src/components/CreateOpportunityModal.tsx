'use client';

import { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle, Building2 } from 'lucide-react';
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

const OPPORTUNITY_TYPES = [
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

export default function CreateOpportunityModal({
  isOpen,
  onClose,
  onSuccess,
  contact,
  ownerRecord,
}: CreateOpportunityModalProps) {
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [opportunityType, setOpportunityType] = useState('buyer');
  const [temperature, setTemperature] = useState('hot');
  const [developer, setDeveloper] = useState('Emaar Properties');
  const [budgetMin, setBudgetMin] = useState('1800000');
  const [budgetMax, setBudgetMax] = useState('2200000');
  const [keyRequirement, setKeyRequirement] = useState('Interested in 2BR Apartment in Business Bay');
  const [nextAction, setNextAction] = useState('Call lead to confirm criteria & budget');
  const [nextActionDueDate, setNextActionDueDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opportunityTypeOptions, setOpportunityTypeOptions] = useState<any[]>(OPPORTUNITY_TYPES);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (ownerRecord) {
        setOpportunityType('seller');
        setDeveloper('Other / General');
        setBudgetMin('1500000');
        setBudgetMax('2500000');
        setKeyRequirement(
          `Selling / Leasing ${ownerRecord.bedrooms || ''} ${ownerRecord.property_type || 'Property'} in ${ownerRecord.building_name || ownerRecord.area || 'Dubai'}${ownerRecord.property_number ? ` (Unit #${ownerRecord.property_number})` : ''}`
        );
        setNextAction(`Call owner (${ownerRecord.owner_name}) to confirm listing agreement & expected price`);
      } else if (contact) {
        setSelectedContactId(String(contact.id));
        setOpportunityType('buyer');
      } else {
        // Fetch contacts if creating without a specific contact selected
        fetchApi('/contacts')
          .then((data) => {
            const list = Array.isArray(data) ? data : data.data || [];
            setContactsList(list);
            if (list.length > 0) setSelectedContactId(String(list[0].id));
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
        opportunity_type: opportunityType,
        temperature,
        developer,
        budget_min: Number(budgetMin),
        budget_max: Number(budgetMax),
        key_requirement: keyRequirement,
        next_action: nextAction,
        next_action_due_at: nextActionDueDate,
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
        payload.community = ownerRecord.area;
        payload.building_name = ownerRecord.building_name;
        payload.unit_number = ownerRecord.property_number;
        payload.property_type = ownerRecord.property_type;
        payload.bedrooms = ownerRecord.bedrooms;
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
      <div className="bg-white border border-[#E8E4DC] rounded-lg max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[#081428] font-bold mb-1">
              {ownerRecord ? 'Property Owner & Asset Info *' : 'Select Existing Contact from Lead Bank *'}
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
              <div className="p-2.5 bg-[#FAF8F5] border border-emerald-300 rounded font-bold text-[#081428] text-xs">
                {contact.name} ({contact.phone}) — <span className="text-emerald-700 font-normal">{contact.nationality || 'Emirati'}</span>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Opportunity Type *</label>
              <SearchableSelect
                options={opportunityTypeOptions}
                value={opportunityType}
                onChange={setOpportunityType}
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1">Temperature *</label>
              <SearchableSelect
                options={TEMPERATURES}
                value={temperature}
                onChange={setTemperature}
              />
            </div>
          </div>

          <div>
            <label className="block text-[#081428] font-semibold mb-1 flex items-center gap-1">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Min Budget (AED)</label>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]"
              />
            </div>
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Max Budget (AED)</label>
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#081428] font-semibold mb-1">Key Requirement Overview</label>
            <input
              type="text"
              value={keyRequirement}
              onChange={(e) => setKeyRequirement(e.target.value)}
              placeholder="e.g. 2BR Apartment in Business Bay"
              className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-2">
            <div className="font-semibold text-[#081428] flex items-center gap-1.5">
              <span>Mandatory SLA Next Action</span>
            </div>
            <div>
              <label className="block text-[#6E6E6E] mb-1">Next Action *</label>
              <input
                type="text"
                required
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]"
              />
            </div>
            <div>
              <label className="block text-[#6E6E6E] mb-1">Next Action Due Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={nextActionDueDate}
                onChange={(e) => setNextActionDueDate(e.target.value)}
                className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#E8E4DC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] hover:bg-slate-50 font-medium rounded text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              {loading ? 'Creating...' : '+ Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
