'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface MultiCheckboxDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiCheckboxDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder,
}: MultiCheckboxDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  // Button title formatting
  const getButtonText = () => {
    if (selected.length === 0) {
      return placeholder || `All ${label}`;
    }
    if (selected.length === 1) {
      return selected[0];
    }
    return `${label} (${selected.length})`;
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
          selected.length > 0
            ? 'bg-amber-50/70 border-[#C9A84C] text-[#081428]'
            : 'bg-[#FAF8F5] border-[#E8E2D9] text-[#1B2A4A] hover:border-[#C9A84C]'
        }`}
      >
        <span className="truncate max-w-[130px]">{getButtonText()}</span>
        {selected.length > 1 && (
          <span className="w-4 h-4 rounded-full bg-[#C9A84C] text-white text-[10px] font-bold flex items-center justify-center">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-56 max-h-64 bg-white border border-[#E8E2D9] rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in-50 duration-150">
          {/* Header with Quick Actions */}
          <div className="p-2 border-b border-[#E8E2D9] bg-[#FAF8F5] flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-bold text-[#081428]">Select {label}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[#C9A84C] hover:underline font-semibold cursor-pointer"
              >
                {selected.length === options.length ? 'Clear All' : 'Select All'}
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1 text-xs">
            {options.length === 0 ? (
              <div className="p-2.5 text-center text-slate-400 text-xs">No options found</div>
            ) : (
              options.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded hover:bg-slate-50 cursor-pointer select-none transition-colors"
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        isChecked
                          ? 'bg-[#081428] border-[#081428] text-[#C9A84C]'
                          : 'border-slate-300 bg-white hover:border-[#C9A84C]'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className={`text-xs ${isChecked ? 'font-bold text-[#081428]' : 'text-slate-700'}`}>
                      {opt}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer with Clear button if active */}
          {selected.length > 0 && (
            <div className="p-1.5 border-t border-[#E8E2D9] bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium pl-1">
                {selected.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold px-2 py-0.5 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
