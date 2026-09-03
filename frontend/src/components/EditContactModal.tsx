'use client';

import { useState, useEffect } from 'react';
import { X, Edit3, AlertCircle, Target, Link2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import SearchableSelect from './SearchableSelect';
import PhoneInput from './PhoneInput';
import { WORLD_NATIONALITIES } from '@/data/countries';
import Swal from 'sweetalert2';

interface EditContactModalProps {
  isOpen: boolean;
  contact: any | null;
  onClose: () => void;
  onSuccess: (updatedContact: any) => void;
}

export default function EditContactModal({ isOpen, contact, onClose, onSuccess }: EditContactModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [source, setSource] = useState('');

  // UTM Parameters State
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; email?: string }>({});
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setPhone(contact.phone || '');
      setEmail(contact.email || '');
      setNationality(contact.nationality || '');
      setSource(contact.source || '');
      setUtmSource(contact.utm_source || '');
      setUtmMedium(contact.utm_medium || '');
      setUtmCampaign(contact.utm_campaign || '');
      setUtmTerm(contact.utm_term || '');
      setUtmContent(contact.utm_content || '');
      setLandingPageUrl(contact.landing_page_url || '');
      setFieldErrors({});
      setGeneralError('');
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  const validate = () => {
    const errs: { name?: string; phone?: string; email?: string } = {};
    if (!name.trim()) errs.name = 'Client Full Name is required.';
    if (!phone.trim()) errs.phone = 'Primary Phone Number is required.';
    if (!email.trim()) errs.email = 'Email Address is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Please enter a valid email address.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setGeneralError('');

    try {
      const updated = await fetchApi(`/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          phone,
          email,
          nationality,
          source,
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          utm_campaign: utmCampaign || null,
          utm_term: utmTerm || null,
          utm_content: utmContent || null,
          landing_page_url: landingPageUrl || null,
        }),
      });

      setLoading(false);
      Swal.fire({
        title: 'Updated!',
        text: `Contact profile for "${name}" has been updated successfully.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setLoading(false);
      if (err.errors) {
        setFieldErrors({
          name: err.errors.name ? err.errors.name[0] : undefined,
          phone: err.errors.phone ? err.errors.phone[0] : undefined,
          email: err.errors.email ? err.errors.email[0] : undefined,
        });
      }
      setGeneralError(err.message || 'Failed to update contact profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E4DC] rounded-lg max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#C8A147]" />
            <div>
              <h2 className="font-heading font-semibold text-lg">Edit Contact Profile</h2>
              <p className="text-xs text-[#C8A147]">Update master contact bank record</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#FAF8F5] text-xs">
          {generalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <div>
            <label className="block text-[#081428] font-semibold mb-1">Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Rashid Al Mahmoud"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`w-full p-2 bg-white border rounded text-xs text-[#1A1A1A] ${
                fieldErrors.name ? 'border-red-500 bg-red-50/20' : 'border-[#E8E4DC]'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-red-500 text-[11px] font-semibold mt-1">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-[#081428] font-semibold mb-1">Phone Number *</label>
            <PhoneInput
              value={phone}
              onChange={(val) => {
                setPhone(val);
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              hasError={!!fieldErrors.phone}
            />
            {fieldErrors.phone && (
              <p className="text-red-500 text-[11px] font-semibold mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-[#081428] font-semibold mb-1">Email Address *</label>
            <input
              type="email"
              placeholder="rashid@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              className={`w-full p-2 bg-white border rounded text-xs text-[#1A1A1A] ${
                fieldErrors.email ? 'border-red-500 bg-red-50/20' : 'border-[#E8E4DC]'
              }`}
            />
            {fieldErrors.email && (
              <p className="text-red-500 text-[11px] font-semibold mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#081428] font-semibold mb-1">Nationality</label>
              <SearchableSelect
                options={WORLD_NATIONALITIES}
                value={nationality}
                onChange={setNationality}
                placeholder="Please Select..."
              />
            </div>

            <div>
              <label className="block text-[#081428] font-semibold mb-1">Lead Source</label>
              <SearchableSelect
                options={[
                  { value: 'Website', label: 'Website' },
                  { value: 'Meta Ads', label: 'Meta Ads' },
                  { value: 'Google Ads', label: 'Google Ads' },
                  { value: 'Property Finder', label: 'Property Finder' },
                  { value: 'Bayut', label: 'Bayut' },
                  { value: 'Dubizzle', label: 'Dubizzle' },
                  { value: 'Walk-in', label: 'Walk-in' },
                  { value: 'Referral', label: 'Referral' },
                  { value: 'Database', label: 'Database' },
                ]}
                value={source}
                onChange={setSource}
                placeholder="Please Select..."
              />
            </div>
          </div>

          {/* UTM Parameters Section */}
          <div className="bg-white border border-[#E8E4DC] rounded-md p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E8E4DC] pb-2">
              <h3 className="font-bold text-[#081428] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <Target className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>Marketing & UTM Parameters</span>
              </h3>
              <span className="text-[10px] text-[#C8A147] font-semibold uppercase tracking-wider bg-[#F9F6EE] px-1.5 py-0.5 rounded border border-[#C8A147]/30">Attribution</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[#081428] font-semibold mb-1 text-[11px]">UTM Source</label>
                <input
                  type="text"
                  placeholder="e.g. google, meta, pf"
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1 text-[11px]">UTM Medium</label>
                <input
                  type="text"
                  placeholder="e.g. cpc, paid_social"
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1 text-[11px]">UTM Campaign</label>
                <input
                  type="text"
                  placeholder="e.g. launch_q3"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1 text-[11px]">UTM Term</label>
                <input
                  type="text"
                  placeholder="e.g. apartments"
                  value={utmTerm}
                  onChange={(e) => setUtmTerm(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1 text-[11px]">UTM Content</label>
                <input
                  type="text"
                  placeholder="e.g. hero_banner"
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#081428] font-semibold mb-1 text-[11px] flex items-center gap-1">
                  <Link2 className="w-3 h-3 text-[#C8A147]" />
                  <span>Complete Campaign URL</span>
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://fsadvisory.ae/..."
                  value={landingPageUrl}
                  onChange={(e) => setLandingPageUrl(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] focus:border-[#C8A147] focus:bg-white focus:outline-none transition-colors"
                />
              </div>
            </div>
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
              {loading ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
