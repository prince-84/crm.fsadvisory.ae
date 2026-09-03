'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface SalesHandoverModalProps {
  opportunity: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SalesHandoverModal({ opportunity, isOpen, onClose, onSuccess }: SalesHandoverModalProps) {
  const [salesAgents, setSalesAgents] = useState<any[]>([]);
  const [salesAgentName, setSalesAgentName] = useState('Faraz Shafi');
  const [handoverNotes, setHandoverNotes] = useState('Client mortgage pre-approved. Budget and community preferences confirmed. Ready for property tours.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi('/users')
      .then((data) => {
        const rawUsers = Array.isArray(data) ? data : (data?.users || []);
        if (rawUsers.length > 0) {
          const activeOnly = rawUsers.filter((u: any) => u.is_active !== false);
          setSalesAgents(activeOnly);

          // Find sales consultant or advisor first
          const defaultAgent = activeOnly.find((u: any) => 
            u.role?.toLowerCase().includes('consultant') || 
            u.role?.toLowerCase().includes('advisor') || 
            u.department?.toLowerCase().includes('sales')
          ) || activeOnly[0];

          if (defaultAgent) {
            setSalesAgentName(defaultAgent.name);
          }
        }
      })
      .catch((err) => console.error('Failed to load sales agents:', err));
  }, []);

  if (!isOpen || !opportunity) return null;

  const contact = opportunity.contact || {};
  const qual = opportunity.buyer_qualification || {};

  // Check mandatory validation items
  const checks = [
    { label: 'Contact Phone & Identity Verified', passed: Boolean(contact.phone), detail: contact.phone },
    { label: 'Budget Captured & Confirmed', passed: Boolean(opportunity.budget_min && opportunity.budget_max), detail: `AED ${(opportunity.budget_min/1000000).toFixed(1)}M - ${(opportunity.budget_max/1000000).toFixed(1)}M` },
    { label: 'Purchase Timeline Captured', passed: Boolean(qual.purchase_timeline), detail: qual.purchase_timeline || 'Not captured' },
    { label: 'Buyer Intent & Finance Type Specified', passed: Boolean(qual.client_intent && qual.cash_or_finance), detail: `${qual.client_intent || ''} (${qual.cash_or_finance || ''})` },
    { label: 'Temperature & Lead Score Assigned', passed: Boolean(opportunity.temperature), detail: `${opportunity.temperature?.toUpperCase()} (Score: ${qual.lead_score || 50})` },
  ];

  const allPassed = checks.every(c => c.passed);

  const handleExecuteHandover = async () => {
    setLoading(true);
    setError('');

    try {
      await fetchApi(`/opportunities/${opportunity.id}/handover`, {
        method: 'POST',
        body: JSON.stringify({
          sales_agent_name: salesAgentName,
          notes: handoverNotes,
          force: true,
        }),
      });

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Handover failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E2D9] rounded-lg max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-[#1B2A4A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#C9A84C]" />
            <div>
              <h2 className="font-heading font-semibold text-lg">Sales Handover Validation</h2>
              <p className="text-xs text-[#C9A84C]">Controlled Ownership Transfer: Telesales ➔ Sales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 bg-[#FAF8F4] text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Validation Checklist */}
          <div className="bg-white border border-[#E8E2D9] rounded-md p-4 space-y-3 shadow-2xs">
            <h3 className="font-semibold text-[#1B2A4A] border-b border-[#E8E2D9] pb-2 uppercase tracking-wider">
              Mandatory Qualification Checklist
            </h3>
            <div className="space-y-2">
              {checks.map((chk, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#FAF8F4] border border-[#E8E2D9]">
                  <div className="flex items-center gap-2">
                    {chk.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span className="font-medium text-[#2C2C2C]">{chk.label}</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${chk.passed ? 'text-[#1B2A4A]' : 'text-amber-600'}`}>
                    {chk.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ownership Transition Box */}
          <div className="bg-white border border-[#E8E2D9] rounded-md p-4 space-y-3 shadow-2xs">
            <h3 className="font-semibold text-[#1B2A4A] border-b border-[#E8E2D9] pb-2 uppercase tracking-wider">
              Ownership Assignment
            </h3>
            
            <div className="flex items-center justify-between p-3 bg-[#FAF8F4] border border-[#E8E2D9] rounded">
              <div className="text-center">
                <div className="text-[10px] text-[#7A7A7A] uppercase font-semibold">Current Owner</div>
                <div className="text-[10px] text-slate-500 capitalize">{opportunity.department || 'Telesales'} Department</div>
              </div>

              <ArrowRight className="w-5 h-5 text-[#C9A84C]" />

              <div className="text-center">
                <div className="text-[10px] text-[#7A7A7A] uppercase font-semibold">Target Sales Advisor</div>
                <select
                  value={salesAgentName}
                  onChange={(e) => setSalesAgentName(e.target.value)}
                  className="mt-0.5 p-1.5 bg-white border border-[#C9A84C] font-bold text-[#1B2A4A] text-xs rounded max-w-[220px] focus:ring-2 focus:ring-[#C9A84C] focus:outline-none cursor-pointer"
                >
                  {salesAgents.length > 0 ? (
                    salesAgents.map((ag) => (
                      <option key={ag.id} value={ag.name}>
                        {ag.name} ({ag.role || ag.department || 'Property Consultant'})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Faraz Shafi">Faraz Shafi (Super Admin)</option>
                      <option value="Babar Ali Khan">Babar Ali Khan (Property Consultant)</option>
                    </>
                  )}
                </select>
                <div className="text-[10px] text-emerald-700 font-medium">Sales Department</div>
              </div>
            </div>

            <div>
              <label className="block text-[#1B2A4A] font-semibold mb-1">Handover Notes / Briefing for Sales</label>
              <textarea
                rows={2}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className="w-full p-2 bg-white border border-[#E8E2D9] rounded text-xs text-[#2C2C2C]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E8E2D9]">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E8E2D9] text-[#7A7A7A] font-medium rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteHandover}
              disabled={loading}
              className="px-5 py-2 bg-[#1B2A4A] hover:bg-[#273B66] text-[#C9A84C] font-bold rounded shadow-sm transition-colors flex items-center gap-2"
            >
              {loading ? 'Processing...' : 'Confirm Sales Handover'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
