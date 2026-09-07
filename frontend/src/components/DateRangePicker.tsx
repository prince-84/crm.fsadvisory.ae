'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown, X, Check } from 'lucide-react';

export interface DateRangeValue {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  preset: string; // 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'this_month' | 'last_month' | 'custom'
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (val: DateRangeValue) => void;
}

const formatDateYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (ymd: string): string => {
  if (!ymd) return '';
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return ymd;
  }
};

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tempFrom, setTempFrom] = useState(value.from || '');
  const [tempTo, setTempTo] = useState(value.to || '');

  useEffect(() => {
    setTempFrom(value.from || '');
    setTempTo(value.to || '');
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectPreset = (presetKey: string) => {
    const now = new Date();
    let from = '';
    let to = '';

    if (presetKey === 'all') {
      from = '';
      to = '';
    } else if (presetKey === 'today') {
      from = formatDateYMD(now);
      to = formatDateYMD(now);
    } else if (presetKey === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      from = formatDateYMD(y);
      to = formatDateYMD(y);
    } else if (presetKey === 'last7') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      from = formatDateYMD(past);
      to = formatDateYMD(now);
    } else if (presetKey === 'last30') {
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      from = formatDateYMD(past);
      to = formatDateYMD(now);
    } else if (presetKey === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      from = formatDateYMD(firstDay);
      to = formatDateYMD(now);
    } else if (presetKey === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      from = formatDateYMD(firstDay);
      to = formatDateYMD(lastDay);
    }

    setTempFrom(from);
    setTempTo(to);
    onChange({ from, to, preset: presetKey });
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (tempFrom && tempTo && tempFrom > tempTo) {
      // Auto swap if user picked reversed dates
      onChange({ from: tempTo, to: tempFrom, preset: 'custom' });
    } else {
      onChange({ from: tempFrom, to: tempTo, preset: 'custom' });
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: '', to: '', preset: 'all' });
    setTempFrom('');
    setTempTo('');
  };

  const isFiltered = value.preset !== 'all' && (value.from !== '' || value.to !== '');

  const getLabel = () => {
    if (!isFiltered) return 'Date: All Time';
    if (value.preset === 'today') return 'Today';
    if (value.preset === 'yesterday') return 'Yesterday';
    if (value.preset === 'last7') return 'Last 7 Days';
    if (value.preset === 'last30') return 'Last 30 Days';
    if (value.preset === 'this_month') return 'This Month';
    if (value.preset === 'last_month') return 'Last Month';
    if (value.from && value.to) {
      if (value.from === value.to) return formatDisplayDate(value.from);
      return `${formatDisplayDate(value.from)} – ${formatDisplayDate(value.to)}`;
    }
    if (value.from) return `From ${formatDisplayDate(value.from)}`;
    if (value.to) return `Up to ${formatDisplayDate(value.to)}`;
    return 'Custom Date';
  };

  const PRESETS = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last7', label: 'Last 7 Days' },
    { key: 'last30', label: 'Last 30 Days' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
  ];

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`p-1.5 px-3 rounded border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
          isFiltered
            ? 'bg-[#081428] text-[#C8A147] border-[#C8A147] shadow-xs'
            : 'bg-[#FAF8F5] border-[#E8E4DC] text-[#081428] hover:border-[#C8A147]'
        }`}
        title="Filter leads by Date Range (created_at)"
      >
        <CalendarIcon className={`w-3.5 h-3.5 ${isFiltered ? 'text-[#C8A147]' : 'text-slate-500'}`} />
        <span className="truncate max-w-[190px]">{getLabel()}</span>
        
        {isFiltered ? (
          <span
            onClick={handleClear}
            className="p-0.5 hover:bg-white/20 rounded-full cursor-pointer ml-0.5"
            title="Clear date filter"
          >
            <X className="w-3 h-3 text-slate-300 hover:text-white" />
          </span>
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 sm:w-96 bg-white border border-[#E8E4DC] rounded-xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E8E4DC]">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#C8A147]" />
              <span className="font-heading font-bold text-xs text-[#081428] uppercase tracking-wider">
                Filter by Date Range
              </span>
            </div>
            {isFiltered && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {PRESETS.map((p) => {
              const active = value.preset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleSelectPreset(p.key)}
                  className={`text-left px-2.5 py-1.5 rounded text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#081428] text-[#C8A147] font-bold'
                      : 'bg-[#FAF8F5] text-slate-700 hover:bg-[#F2EFE9]'
                  }`}
                >
                  <span>{p.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-[#C8A147]" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Inputs */}
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg p-3 space-y-2.5">
            <div className="text-[11px] font-bold text-[#081428] uppercase tracking-wider">
              Custom Range (Calendar Date)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  className="w-full bg-white border border-[#E8E4DC] rounded px-2 py-1 text-xs text-[#081428] font-medium focus:border-[#C8A147] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  className="w-full bg-white border border-[#E8E4DC] rounded px-2 py-1 text-xs text-[#081428] font-medium focus:border-[#C8A147] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 rounded text-xs font-semibold text-slate-600 hover:bg-slate-200/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!tempFrom && !tempTo}
                className="px-3 py-1 rounded bg-[#081428] hover:bg-[#122444] text-[#C8A147] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
