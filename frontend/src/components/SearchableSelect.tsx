'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Plus } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  key?: string;
}

interface SearchableSelectProps {
  options: (SelectOption | string)[];
  value: string;
  onChange: (value: string) => void;
  onAddOption?: (newOption: string) => void;
  allowCustomAdd?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  onAddOption,
  allowCustomAdd = true,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SelectOption format with unique key
  const normalizedOptions: SelectOption[] = options.map((opt, idx) =>
    typeof opt === 'string'
      ? { value: opt, label: opt, key: `${opt}-${idx}` }
      : { ...opt, key: opt.key || `${opt.value}-${idx}` }
  );

  // Find currently selected option
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Filter options based on search input
  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search query already matches an existing option exactly
  const hasExactMatch = normalizedOptions.some(
    (opt) => opt.label.toLowerCase() === search.trim().toLowerCase() || opt.value.toLowerCase() === search.trim().toLowerCase()
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleCreateNewOption = (customVal: string) => {
    const trimmed = customVal.trim();
    if (!trimmed) return;

    if (onAddOption) {
      onAddOption(trimmed);
    }

    onChange(trimmed);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] font-medium flex items-center justify-between gap-2 text-left focus:outline-none focus:border-[#C8A147] focus:bg-white transition-colors disabled:opacity-50"
      >
        <span className={`truncate ${!selectedOption && !value ? 'text-[#6E6E6E] font-normal' : ''}`}>
          {selectedOption ? selectedOption.label : value || placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#6E6E6E] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Overlay Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#E8E4DC] rounded-md shadow-xl overflow-hidden animate-in fade-in duration-100">
          {/* Search Box Header */}
          <div className="p-2 border-b border-[#E8E4DC] bg-[#FAF8F5] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search or type new option..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0].value);
                  } else if (allowCustomAdd && search.trim()) {
                    handleCreateNewOption(search);
                  }
                }
              }}
              className="w-full bg-transparent text-xs text-[#1A1A1A] focus:outline-none placeholder-[#6E6E6E]"
            />
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full p-2 text-left text-xs rounded flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#F3EEDD] text-[#081428] font-bold'
                        : 'text-[#1A1A1A] hover:bg-slate-50 font-normal'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />}
                  </button>
                );
              })
            ) : null}

            {/* Inline "+ Add '{search}'" option item */}
            {allowCustomAdd && search.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={() => handleCreateNewOption(search)}
                className="w-full p-2 text-left text-xs rounded font-bold text-[#C8A147] hover:bg-amber-50 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 shrink-0 text-[#C8A147]" />
                <span className="truncate">Add &quot;{search.trim()}&quot;</span>
              </button>
            )}

            {filteredOptions.length === 0 && (!allowCustomAdd || !search.trim()) && (
              <div className="p-3 text-center text-xs text-[#6E6E6E] italic">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
