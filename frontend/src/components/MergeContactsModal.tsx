'use client';

import { useState } from 'react';
import { X, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface MergeContactsModalProps {
  primaryContact: any | null;
  duplicateContact: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MergeContactsModal({ 
  primaryContact, 
  duplicateContact, 
  isOpen, 
  onClose, 
  onSuccess 
}: MergeContactsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !primaryContact || !duplicateContact) return null;

  const handleExecuteMerge = async () => {
    setLoading(true);
    setError('');

    try {
      await fetchApi('/contacts/merge', {
        method: 'POST',
        body: JSON.stringify({
          primary_contact_id: primaryContact.id,
          duplicate_contact_id: duplicateContact.id,
        }),
      });

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to merge contact records');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E4DC] rounded-lg max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-[#C8A147]" />
            <div>
              <h2 className="font-heading font-semibold text-lg">Merge Duplicate Contact Records</h2>
              <p className="text-xs text-[#C8A147]">Consolidates opportunities & activities under primary master profile.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 bg-[#FAF8F5] text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Primary Profile */}
            <div className="p-4 bg-white border border-emerald-300 rounded-md space-y-2">
              <div className="text-[10px] font-bold text-emerald-700 uppercase">Primary Master Record</div>
              <div className="font-bold text-[#081428] text-sm">{primaryContact.name}</div>
              <div className="text-[#6E6E6E]">{primaryContact.phone}</div>
              <div className="text-[10px] text-slate-500">Source: {primaryContact.source}</div>
            </div>

            {/* Duplicate Profile */}
            <div className="p-4 bg-white border border-red-200 rounded-md space-y-2">
              <div className="text-[10px] font-bold text-red-700 uppercase">Duplicate Record To Merge</div>
              <div className="font-bold text-[#081428] text-sm">{duplicateContact.name}</div>
              <div className="text-[#6E6E6E]">{duplicateContact.phone}</div>
              <div className="text-[10px] text-slate-500">Will be safely deleted</div>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-700" />
              <span>Consolidation Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              All linked active & past opportunities, activity logs, and qualification records will be transferred to {primaryContact.name}.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#E8E4DC]">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-medium rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteMerge}
              disabled={loading}
              className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-xs transition-colors"
            >
              {loading ? 'Merging...' : 'Confirm & Execute Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
