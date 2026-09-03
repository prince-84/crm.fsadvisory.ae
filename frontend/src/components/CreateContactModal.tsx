'use client';

import { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import SearchableSelect from './SearchableSelect';
import PhoneInput from './PhoneInput';
import { WORLD_NATIONALITIES } from '@/data/countries';

interface CreateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateContactModal({ isOpen, onClose, onSuccess }: CreateContactModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('Emirati');
  const [source, setSource] = useState('Walk-in');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await fetchApi('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          secondary_phone: secondaryPhone,
          email,
          nationality,
          source,
        }),
      });

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to create contact');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E4DC] rounded-lg max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#C8A147]" />
            <div>
              <h2 className="font-heading font-semibold text-lg">Quick Contact Registration</h2>
              <p className="text-xs text-[#C8A147]">Save person into Lead Bank (State: Available)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#FAF8F5] text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[#081428] font-semibold mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rashid Al Mahmoud"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Primary Phone Number *</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                required
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1">Secondary Phone <span className="text-slate-400 font-normal">(Optional)</span></label>
              <PhoneInput
                value={secondaryPhone}
                onChange={setSecondaryPhone}
                placeholder="Optional secondary number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Email Address</label>
              <input
                type="email"
                placeholder="rashid@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A]"
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1">Nationality *</label>
              <SearchableSelect
                options={WORLD_NATIONALITIES}
                value={nationality}
                onChange={setNationality}
                placeholder="Select Nationality..."
              />
            </div>
          </div>

          <div>
            <label className="block text-[#081428] font-semibold mb-1">Lead Source *</label>
            <SearchableSelect
              options={[
                { value: 'Walk-in', label: 'Walk-in / Direct Meeting' },
                { value: 'Referral', label: 'Client Referral' },
                { value: 'Database', label: 'Master Database' },
                { value: 'Website', label: 'Website Inquiry' },
              ]}
              value={source}
              onChange={setSource}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#E8E4DC]">
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
              className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded text-xs shadow-xs transition-colors"
            >
              {loading ? 'Saving...' : 'Save Contact to Bank'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
