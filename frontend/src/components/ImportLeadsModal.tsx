'use client';

import { useState } from 'react';
import { 
  X, Upload, FileText, Download, CheckCircle2, AlertTriangle, 
  ArrowLeft, RefreshCw, Layers, UserCheck, UserPlus, AlertCircle,
  Sparkles, Sliders, Check, Plus, Database, ArrowRight
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Swal from 'sweetalert2';

import * as XLSX from 'xlsx';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportLeadsModal({ isOpen, onClose, onSuccess }: ImportLeadsModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'success'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    total_records: number;
    new_count: number;
    duplicate_count: number;
    duplicates: any[];
    analyzed_records: any[];
    has_unmatched?: boolean;
    unmatched?: Record<string, any[]>;
    catalogs?: Record<string, string[]>;
  } | null>(null);

  // Value Mapping State
  const [valueMappings, setValueMappings] = useState<Record<string, Record<string, string>>>({
    developer: {},
    community: {},
    project: {},
    property_type: {},
  });

  // Approved new catalog items to create in master tables
  const [newCatalogItems, setNewCatalogItems] = useState<Array<{ category: string; name: string }>>([]);

  // Active action mode per unmatched value: key = `${cat}::${fileVal}` -> 'map' | 'new' | 'keep'
  const [mappingActions, setMappingActions] = useState<Record<string, 'map' | 'new' | 'keep'>>({});
  const [mappingCategoryTab, setMappingCategoryTab] = useState<'all' | 'developer' | 'project' | 'community' | 'property_type'>('all');

  // Duplicate Action Mode: 'skip' | 'import_duplicate' | 'update'
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'import_duplicate' | 'update'>('skip');
  const [showDuplicatesTable, setShowDuplicatesTable] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  if (!isOpen) return null;

  // Generate and download a structured XLSX Sample Excel Template
  const handleDownloadTemplate = () => {
    const headers = [
      'Name', 'Primary Phone', 'Secondary Phone', 'Mobile No', 'Email', 'Nationality', 'Created Date',
      'Source', 'Sub-Source', 'Opportunity Type', 'Developer', 'Community', 'Project',
      'Unit / Property', 'Bedrooms', 'Min Budget', 'Max Budget', 'Payment Method',
      'Key Requirement', 'Assigned Owner', 'Next Action', 'Next Action Due'
    ];

    const sampleRows = [
      [
        'Rashid Al Mansoori', '+971 50 123 4567', '+971 55 987 6543', '+971 52 111 2233', 'rashid@example.com', 'Emirati', '2026-08-20 14:30:00',
        'Meta Ads', 'Facebook Lead Form', 'Buyer', 'Emaar', 'Dubai Marina', 'Marina Gate',
        'Tower 1 - 1204', '2BR', '2500000', '3500000', 'Cash', 'High Floor Sea View Unit',
        'Waqar Ahmed', 'Call back client for viewing', '2026-08-24 10:00:00'
      ],
      [
        'Sarah Jenkins', '+971 52 444 8899', '', '+971 54 888 9900', 'sarah.j@example.com', 'British', '2026-08-21 11:15:00',
        'Website', 'Direct Contact Us Form', 'Buyer', 'DAMAC', 'Downtown Dubai', 'Burj Crown',
        'Suite 802', '1BR', '1500000', '2000000', 'Finance', 'Full Burj Khalifa View',
        'Hassan Qasimi', 'Send brochure & price list', '2026-08-23 18:00:00'
      ],
      [
        'Tariq Mahmood', '+971 54 777 2211', '+971 50 777 2211', '', 'tariq@example.com', 'Pakistani', '2026-08-22 09:00:00',
        'Google Ads', 'PPC Search Campaign', 'Buyer', 'Nakheel', 'Palm Jumeirah', 'Palm Beach Towers',
        'Villa 45', '3BR', '4500000', '6000000', 'Cash', 'Beachfront Luxury Villa',
        'Unassigned', 'Qualify lead requirements', '2026-08-24 12:00:00'
      ]
    ];

    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lead Import Template');
    XLSX.writeFile(wb, 'lead_pool_import_template.xlsx');
  };

  // Helper to parse CSV text
  const parseCSVContent = (text: string) => {
    let cleanText = text.replace(/^\uFEFF/, '');
    cleanText = cleanText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    const lines = cleanText.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return [];

    const rawHeaders = lines[0].split(',').map(h => h.replace(/^"(.*)"$/, '$1').trim());
    const dataRows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      const cleanedValues = values.map(v => v.replace(/^"(.*)"$/, '$1').trim());

      const rowObj: Record<string, string> = {};
      rawHeaders.forEach((header, idx) => {
        if (header) {
          rowObj[header] = cleanedValues[idx] || '';
        }
      });
      dataRows.push(rowObj);
    }
    return dataRows;
  };

  // Handle File Selection (Strictly .xlsx files ONLY)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx');

      if (!isXlsx) {
        setSelectedFile(null);
        setParsedRows([]);
        e.target.value = '';
        Swal.fire({
          icon: 'error',
          title: 'Invalid File Format',
          text: 'Only .xlsx (Excel Spreadsheet) files are allowed for lead import. CSV and other formats are strictly not supported. Please download and use our official .xlsx template.',
          confirmButtonColor: '#081428',
        });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd hh:mm:ss' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });

          const rows = jsonRows.map((r) => {
            const cleanedObj: Record<string, string> = {};
            Object.keys(r).forEach((k) => {
              cleanedObj[k.trim()] = String(r[k] ?? '').trim();
            });
            return cleanedObj;
          });
          setParsedRows(rows);
        } catch (err: any) {
          Swal.fire('File Error', 'Failed to read Excel .xlsx file. Please ensure it is a valid file.', 'error');
        }
      };

      reader.readAsArrayBuffer(file);
    }
  };

  // Step 1 -> Step 2: Analyze records & check duplicates against DB
  const handleAnalyzeDuplicates = async () => {
    if (parsedRows.length === 0) {
      Swal.fire('No Data Found', 'Please select a valid .xlsx Excel file containing contact records.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi('/contacts/import-preview', {
        method: 'POST',
        body: JSON.stringify({ records: parsedRows }),
      });

      setPreviewData(res);

      if (res.has_unmatched) {
        const initialMappings: Record<string, Record<string, string>> = {
          developer: {},
          community: {},
          project: {},
          property_type: {},
        };
        const initialActions: Record<string, 'map' | 'new' | 'keep'> = {};

        ['developer', 'community', 'project', 'property_type'].forEach((cat) => {
          (res.unmatched?.[cat] || []).forEach((item: any) => {
            const key = `${cat}::${item.file_value}`;
            if (item.suggested_match && item.confidence >= 60) {
              initialMappings[cat][item.file_value] = item.suggested_match;
              initialActions[key] = 'map';
            } else {
              initialActions[key] = 'keep';
            }
          });
        });

        setValueMappings(initialMappings);
        setMappingActions(initialActions);
        setStep('mapping');
      } else {
        setStep('preview');
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Excel File Structure',
        text: err.message || 'The uploaded .xlsx file does not match CRM column structure. Please click "Download XLSX Template" to use the correct format.',
        confirmButtonColor: '#081428',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2 (Mapping) -> Step 3 (Preview): Apply selected value mappings & register new catalog items
  const handleApplyMappingsAndProceed = () => {
    if (!previewData) return;

    const approvedNewItems: Array<{ category: string; name: string }> = [];
    const activeMappings: Record<string, Record<string, string>> = {
      developer: {},
      community: {},
      project: {},
      property_type: {},
    };

    ['developer', 'community', 'project', 'property_type'].forEach((cat) => {
      (previewData.unmatched?.[cat] || []).forEach((item: any) => {
        const key = `${cat}::${item.file_value}`;
        const action = mappingActions[key] || 'keep';

        if (action === 'new') {
          approvedNewItems.push({ category: cat, name: item.file_value });
        } else if (action === 'map') {
          const target = valueMappings[cat]?.[item.file_value];
          if (target) {
            activeMappings[cat][item.file_value] = target;
          }
        }
      });
    });

    setNewCatalogItems(approvedNewItems);
    setValueMappings(activeMappings);

    // Apply mappings to in-memory analyzed_records
    const updatedRecords = (previewData.analyzed_records || []).map((r: any) => {
      const rec = { ...r };
      if (rec.developer && activeMappings.developer[rec.developer]) {
        rec.developer = activeMappings.developer[rec.developer];
      }
      if (rec.community && activeMappings.community[rec.community]) {
        rec.community = activeMappings.community[rec.community];
      }
      if (rec.project && activeMappings.project[rec.project]) {
        rec.project = activeMappings.project[rec.project];
      }
      if (rec.project_property && activeMappings.property_type[rec.project_property]) {
        rec.project_property = activeMappings.property_type[rec.project_property];
      }
      return rec;
    });

    setPreviewData({
      ...previewData,
      analyzed_records: updatedRecords,
    });

    setStep('preview');
  };

  // Step 3 -> Step 4: Execute final import
  const handleExecuteImport = async () => {
    if (!previewData) return;

    setLoading(true);
    try {
      const res = await fetchApi('/contacts/import-execute', {
        method: 'POST',
        body: JSON.stringify({
          records: previewData.analyzed_records,
          duplicate_mode: duplicateMode,
          value_mappings: valueMappings,
          new_catalog_items: newCatalogItems,
        }),
      });

      setImportResult(res);
      setStep('success');
    } catch (err: any) {
      Swal.fire('Import Failed', err.message || 'Failed to execute import batch.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    if (step === 'success') {
      onSuccess();
    }
    setStep('upload');
    setSelectedFile(null);
    setParsedRows([]);
    setPreviewData(null);
    setImportResult(null);
    setValueMappings({ developer: {}, community: {}, project: {}, property_type: {} });
    setNewCatalogItems([]);
    setMappingActions({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`bg-white border border-[#E8E4DC] rounded-xl ${step === 'mapping' || step === 'preview' ? 'max-w-4xl' : 'max-w-2xl'} w-full shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150`}>
        
        {/* Header */}
        <div className="p-5 bg-[#081428] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C8A147]/20 border border-[#C8A147]/40 flex items-center justify-center text-[#C8A147]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-white">Lead Pool CSV Importer</h2>
              <p className="text-xs text-[#C8A147]">Batch import contacts with within-file duplicate checking.</p>
            </div>
          </div>
          <button onClick={handleModalClose} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 bg-[#FAF8F5] text-xs">
          
          {/* STEP 1: FILE UPLOAD & TEMPLATE DOWNLOAD */}
          {step === 'upload' && (
            <div className="space-y-5">
              
              {/* Template Banner */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[#081428]">
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-[#081428]">
                    <FileText className="w-4 h-4 text-[#C8A147]" />
                    <span>Download Sample Excel (.xlsx) Template</span>
                  </div>
                  <p className="text-[11px] text-[#6E6E6E]">
                    Includes pre-formatted Excel columns for Primary/Secondary Phone, Mobile No, Email, Created Date, Source & Specs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-white border border-[#E8E4DC] hover:border-[#C8A147] text-[#081428] font-bold rounded flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#C8A147]" />
                  <span>Download XLSX Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="p-8 border-2 border-dashed border-[#E8E4DC] hover:border-[#C8A147] bg-white rounded-lg text-center space-y-3 transition-colors">
                <FileText className="w-10 h-10 text-[#C8A147] mx-auto" />
                <div>
                  <div className="font-bold text-[#081428] text-sm">Select Excel (.xlsx) File Only</div>
                  <p className="text-[11px] text-[#6E6E6E] mt-0.5">Strictly .xlsx files are supported (CSV and other formats not allowed)</p>
                </div>

                <input
                  type="file"
                  accept=".xlsx"
                  id="csv-file-input"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <label
                  htmlFor="csv-file-input"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 text-[#081428] font-bold rounded cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-[#C8A147]" />
                  <span>{selectedFile ? selectedFile.name : 'Choose .xlsx File'}</span>
                </label>

                {parsedRows.length > 0 && (
                  <div className="pt-2 text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Loaded {parsedRows.length} rows from {selectedFile?.name}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-bold rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAnalyzeDuplicates}
                  disabled={loading || parsedRows.length === 0}
                  className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-xs disabled:opacity-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{loading ? 'Checking Duplicates...' : 'Analyze & Check Duplicates'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: VALUE MAPPING & CATALOG STANDARDIZATION SCREEN */}
          {step === 'mapping' && previewData && (
            <div className="space-y-4">
              {/* Header Info Banner */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-lg flex items-start gap-2.5 text-[#081428]">
                <Sparkles className="w-4 h-4 text-[#C8A147] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-[#081428]">Standardize Imported Catalog Values</div>
                  <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                    We found values in your file that do not match existing Settings master catalogs (Developer, Project, Community, or Property Type).
                    Choose whether to map to an existing catalog name, add as a new official entry, or keep the raw value.
                  </p>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-[#E8E4DC] pb-2 overflow-x-auto">
                {[
                  { key: 'all', label: 'All Unmatched' },
                  { key: 'developer', label: 'Developers', count: previewData.unmatched?.developer?.length || 0 },
                  { key: 'project', label: 'Projects', count: previewData.unmatched?.project?.length || 0 },
                  { key: 'community', label: 'Communities', count: previewData.unmatched?.community?.length || 0 },
                  { key: 'property_type', label: 'Property Types', count: previewData.unmatched?.property_type?.length || 0 },
                ].map((tab) => {
                  const isActive = mappingCategoryTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMappingCategoryTab(tab.key as any)}
                      className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-[#081428] text-[#C8A147] shadow-2xs'
                          : 'bg-white border border-[#E8E4DC] text-[#6E6E6E] hover:text-[#081428]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          isActive ? 'bg-[#C8A147] text-[#081428]' : 'bg-amber-100 text-amber-900 font-bold'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Mapping Rows Table / List */}
              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {['developer', 'project', 'community', 'property_type']
                  .filter((cat) => mappingCategoryTab === 'all' || mappingCategoryTab === cat)
                  .flatMap((cat) => (previewData.unmatched?.[cat] || []).map((item) => ({ ...item, category: cat })))
                  .map((item) => {
                    const key = `${item.category}::${item.file_value}`;
                    const currentAction = mappingActions[key] || 'keep';
                    const targetVal = valueMappings[item.category]?.[item.file_value] || '';
                    const catalogOptions = previewData.catalogs?.[item.category] || [];

                    const categoryLabels: Record<string, string> = {
                      developer: 'Developer',
                      project: 'Project',
                      community: 'Community',
                      property_type: 'Property Type',
                    };

                    return (
                      <div
                        key={key}
                        className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs space-y-2.5 hover:border-[#C8A147]/50 transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                              {categoryLabels[item.category] || item.category}
                            </span>
                            <span className="font-bold text-[#081428] text-xs">
                              &quot;{item.file_value}&quot;
                            </span>
                            <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 text-[10px] rounded font-semibold border border-amber-200">
                              {item.count} {item.count === 1 ? 'row' : 'rows'}
                            </span>
                          </div>

                          {/* Suggested Match Indicator */}
                          {item.suggested_match && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-[#6E6E6E]">Suggested:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setMappingActions((prev) => ({ ...prev, [key]: 'map' }));
                                  setValueMappings((prev) => ({
                                    ...prev,
                                    [item.category]: {
                                      ...prev[item.category],
                                      [item.file_value]: item.suggested_match,
                                    },
                                  }));
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded cursor-pointer transition-colors text-[10px]"
                                title="Click to apply suggested match"
                              >
                                <span>🎯 {item.suggested_match}</span>
                                <span className="text-emerald-600 font-mono">({item.confidence}%)</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action Selection Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                          {/* 1. Map to Existing */}
                          <label
                            className={`flex flex-col gap-1.5 p-2 rounded border cursor-pointer transition-all ${
                              currentAction === 'map'
                                ? 'bg-amber-50/50 border-[#C8A147] ring-1 ring-[#C8A147]/40'
                                : 'bg-slate-50/60 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#081428]">
                              <input
                                type="radio"
                                name={`action_${key}`}
                                checked={currentAction === 'map'}
                                onChange={() => {
                                  setMappingActions((prev) => ({ ...prev, [key]: 'map' }));
                                  if (!targetVal && item.suggested_match) {
                                    setValueMappings((prev) => ({
                                      ...prev,
                                      [item.category]: {
                                        ...prev[item.category],
                                        [item.file_value]: item.suggested_match,
                                      },
                                    }));
                                  } else if (!targetVal && catalogOptions.length > 0) {
                                    setValueMappings((prev) => ({
                                      ...prev,
                                      [item.category]: {
                                        ...prev[item.category],
                                        [item.file_value]: catalogOptions[0],
                                      },
                                    }));
                                  }
                                }}
                                className="accent-[#C8A147]"
                              />
                              <span>Map to Catalog</span>
                            </div>

                            {currentAction === 'map' && (
                              <select
                                value={targetVal}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setValueMappings((prev) => ({
                                    ...prev,
                                    [item.category]: {
                                      ...prev[item.category],
                                      [item.file_value]: v,
                                    },
                                  }));
                                }}
                                className="w-full text-[11px] px-2 py-1 bg-white border border-[#E8E4DC] rounded focus:border-[#C8A147] font-medium"
                              >
                                {catalogOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>

                          {/* 2. Add as New to Catalog */}
                          <label
                            className={`flex flex-col gap-1 p-2 rounded border cursor-pointer transition-all ${
                              currentAction === 'new'
                                ? 'bg-emerald-50/50 border-emerald-400 ring-1 ring-emerald-300'
                                : 'bg-slate-50/60 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#081428]">
                              <input
                                type="radio"
                                name={`action_${key}`}
                                checked={currentAction === 'new'}
                                onChange={() => setMappingActions((prev) => ({ ...prev, [key]: 'new' }))}
                                className="accent-emerald-600"
                              />
                              <span className="text-emerald-800">+ Add to Master Catalog</span>
                            </div>
                            <span className="text-[10px] text-slate-500 pl-4">
                              Registers as official Settings entry
                            </span>
                          </label>

                          {/* 3. Keep Raw Value */}
                          <label
                            className={`flex flex-col gap-1 p-2 rounded border cursor-pointer transition-all ${
                              currentAction === 'keep'
                                ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-300'
                                : 'bg-slate-50/60 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#081428]">
                              <input
                                type="radio"
                                name={`action_${key}`}
                                checked={currentAction === 'keep'}
                                onChange={() => setMappingActions((prev) => ({ ...prev, [key]: 'keep' }))}
                                className="accent-slate-600"
                              />
                              <span>Keep Raw String</span>
                            </div>
                            <span className="text-[10px] text-slate-500 pl-4">
                              Stores unmapped text as-is
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-3.5 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-bold rounded hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to File</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyMappingsAndProceed}
                  className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Continue to Duplicate Check</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PRE-IMPORT DUPLICATE REVIEW & DECISION SCREEN */}
          {step === 'preview' && previewData && (
            <div className="space-y-5">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-white border border-[#E8E4DC] rounded-lg text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E6E]">Total Rows</div>
                  <div className="text-xl font-extrabold text-[#081428] mt-0.5">{previewData.total_records}</div>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">New Unique Leads</div>
                  <div className="text-xl font-extrabold text-emerald-800 mt-0.5">{previewData.new_count}</div>
                </div>

                <div className={`p-3.5 rounded-lg text-center border ${
                  previewData.duplicate_count > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${
                    previewData.duplicate_count > 0 ? 'text-amber-800' : 'text-slate-600'
                  }`}>Duplicates (In File)</div>
                  <div className={`text-xl font-extrabold mt-0.5 ${
                    previewData.duplicate_count > 0 ? 'text-amber-900' : 'text-slate-700'
                  }`}>{previewData.duplicate_count}</div>
                </div>
              </div>

              {/* Duplicate Handling Options */}
              {previewData.duplicate_count > 0 ? (
                <div className="space-y-3 bg-white border border-[#E8E4DC] p-4 rounded-lg">
                  <div className="font-bold text-[#081428] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Choose How to Handle Duplicate Contacts</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDuplicatesTable(!showDuplicatesTable)}
                      className="text-[11px] text-[#C8A147] font-bold hover:underline cursor-pointer"
                    >
                      {showDuplicatesTable ? 'Hide Details' : `View ${previewData.duplicate_count} Duplicates`}
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    {/* Option 1: Skip Duplicates */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      duplicateMode === 'skip' ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300' : 'bg-[#FAF8F5] border-[#E8E4DC]'
                    }`}>
                      <input
                        type="radio"
                        name="duplicateMode"
                        value="skip"
                        checked={duplicateMode === 'skip'}
                        onChange={() => setDuplicateMode('skip')}
                        className="mt-0.5 accent-[#C8A147]"
                      />
                      <div>
                        <div className="font-bold text-[#081428] flex items-center gap-1.5">
                          <span>Skip Duplicates (Recommended)</span>
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">Safe</span>
                        </div>
                        <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                          Import only the <strong className="text-[#081428]">{previewData.new_count} unique leads</strong>. The {previewData.duplicate_count} duplicate contacts will be skipped.
                        </p>
                      </div>
                    </label>

                    {/* Option 2: Import All & Flag as Duplicate */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      duplicateMode === 'import_duplicate' ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300' : 'bg-[#FAF8F5] border-[#E8E4DC]'
                    }`}>
                      <input
                        type="radio"
                        name="duplicateMode"
                        value="import_duplicate"
                        checked={duplicateMode === 'import_duplicate'}
                        onChange={() => setDuplicateMode('import_duplicate')}
                        className="mt-0.5 accent-[#C8A147]"
                      />
                      <div>
                        <div className="font-bold text-[#081428]">Import All & Route to Duplicate Tab</div>
                        <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                          Import all <strong className="text-[#081428]">{previewData.total_records} records</strong>. The {previewData.duplicate_count} duplicate leads in this file will be saved with <strong className="text-amber-800">&quot;Duplicate&quot;</strong> state and displayed in the Duplicate tab.
                        </p>
                      </div>
                    </label>

                    {/* Option 3: Update Existing Contacts */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      duplicateMode === 'update' ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-300' : 'bg-[#FAF8F5] border-[#E8E4DC]'
                    }`}>
                      <input
                        type="radio"
                        name="duplicateMode"
                        value="update"
                        checked={duplicateMode === 'update'}
                        onChange={() => setDuplicateMode('update')}
                        className="mt-0.5 accent-[#C8A147]"
                      />
                      <div>
                        <div className="font-bold text-[#081428]">Update Existing Contact Records</div>
                        <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                          Import {previewData.new_count} new leads and update details (Email, Secondary Phone) for {previewData.duplicate_count} matching contacts.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold">No Duplicates Found!</div>
                    <p className="text-[11px] text-emerald-700">
                      All {previewData.total_records} contacts in this file are unique and ready to import into the Lead Pool.
                    </p>
                  </div>
                </div>
              )}

              {/* Collapsible Duplicates Inspection Table */}
              {showDuplicatesTable && previewData.duplicates.length > 0 && (
                <div className="space-y-2 bg-white border border-[#E8E4DC] p-3 rounded-lg max-h-52 overflow-y-auto">
                  <div className="font-bold text-[#081428] text-[11px] uppercase tracking-wider">Duplicate Contacts List</div>
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#E8E4DC] text-[#6E6E6E]">
                        <th className="p-1.5">Row</th>
                        <th className="p-1.5">CSV Lead Name</th>
                        <th className="p-1.5">CSV Phone Numbers</th>
                        <th className="p-1.5">Matches Within File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E4DC]">
                      {previewData.duplicates.map((dup) => (
                        <tr key={dup.row_index} className="hover:bg-slate-50">
                          <td className="p-1.5 font-bold">#{dup.row_index}</td>
                          <td className="p-1.5 font-semibold text-[#081428]">{dup.name}</td>
                          <td className="p-1.5 font-mono text-slate-700">
                            {dup.phone} {dup.secondary_phone ? `/ ${dup.secondary_phone}` : ''}
                          </td>
                          <td className="p-1.5 text-amber-800 font-medium">{dup.matched_with}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setStep(previewData.has_unmatched ? 'mapping' : 'upload')}
                  className="px-3.5 py-2 bg-white border border-[#E8E4DC] text-[#6E6E6E] font-bold rounded hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{previewData.has_unmatched ? 'Back to Value Mapping' : 'Back to File'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={loading}
                  className="px-6 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{loading ? 'Processing Import...' : 'Confirm & Execute Import'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS RESULT SCREEN */}
          {step === 'success' && importResult && (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-xl text-[#081428]">Import Completed Successfully!</h3>
                <p className="text-xs text-[#6E6E6E]">The database has been updated with your CSV lead batch.</p>
              </div>

              <div className="max-w-md mx-auto p-4 bg-white border border-[#E8E4DC] rounded-lg grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-[10px] text-[#6E6E6E] uppercase font-bold">Imported</div>
                  <div className="text-lg font-bold text-emerald-700">{importResult.imported_count}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#6E6E6E] uppercase font-bold">Skipped</div>
                  <div className="text-lg font-bold text-amber-700">{importResult.skipped_count}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#6E6E6E] uppercase font-bold">Updated</div>
                  <div className="text-lg font-bold text-blue-700">{importResult.updated_count}</div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-6 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold rounded shadow-md transition-colors cursor-pointer"
                >
                  Done & Refresh Lead Pool
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
