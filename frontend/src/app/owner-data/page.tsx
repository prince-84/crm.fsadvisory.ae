'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '@/lib/api';
import { 
  Building2, 
  Search, 
  Plus, 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Phone, 
  Smartphone, 
  Mail, 
  Home, 
  MapPin, 
  Layers, 
  CheckSquare, 
  Square, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Copy, 
  Check, 
  MessageSquare, 
  FileSpreadsheet, 
  AlertCircle,
  KeyRound,
  Eye,
  SlidersHorizontal,
  Calendar,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';
import { fetchApi } from '@/lib/api';

interface OwnerRecord {
  id: number;
  property_name: string | null;
  area: string | null;
  property_number: string | null;
  building_name: string | null;
  bedrooms: string | null;
  property_type: string | null;
  owner_name: string;
  phone_number: string | null;
  mobile_number: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  category: 'Owner Info' | 'Property Details' | 'Contact Details' | 'Meta & Actions';
}

const ALL_OWNER_COLUMNS: ColumnConfig[] = [
  { key: 'owner_name', label: 'Owner Name', category: 'Owner Info' },
  { key: 'property_name', label: 'Property Name', category: 'Property Details' },
  { key: 'property_number', label: 'Unit / Prop #', category: 'Property Details' },
  { key: 'building_name', label: 'Building & Area', category: 'Property Details' },
  { key: 'bedrooms', label: 'Type & Bedrooms', category: 'Property Details' },
  { key: 'mobile_number', label: 'Mobile & WhatsApp', category: 'Contact Details' },
  { key: 'phone_number', label: 'Landline Phone', category: 'Contact Details' },
  { key: 'email', label: 'Email Address', category: 'Contact Details' },
  { key: 'status', label: 'Status', category: 'Meta & Actions' },
  { key: 'notes', label: 'Notes', category: 'Meta & Actions' },
  { key: 'created_at', label: 'Date Added', category: 'Meta & Actions' },
  { key: 'actions', label: 'Actions', category: 'Meta & Actions' },
];

const DEFAULT_OWNER_COLUMN_VISIBILITY: Record<string, boolean> = {
  owner_name: true,
  property_name: true,
  property_number: true,
  building_name: true,
  bedrooms: true,
  mobile_number: true,
  phone_number: false,
  email: true,
  status: true,
  notes: false,
  created_at: false,
  actions: true,
};

export default function OwnerDataPage() {
  const [canViewOwnerData, setCanViewOwnerData] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPerms = () => {
      setCanViewOwnerData(hasPermission('owner_data.view'));
    };
    checkPerms();
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);
  // State
  const [records, setRecords] = useState<OwnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    available?: number;
    rented?: number;
    sold?: number;
    active?: number;
    areas_count: number;
    deleted: number;
  }>({ total: 0, available: 0, rented: 0, sold: 0, areas_count: 0, deleted: 0 });
  const [filterOptions, setFilterOptions] = useState<{
    areas: string[];
    property_types: string[];
    bedrooms: string[];
  }>({
    areas: [],
    property_types: [],
    bedrooms: [],
  });

  // Filter & Search State (Placed on Left together with Search)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedPropertyType, setSelectedPropertyType] = useState('all');
  const [selectedBedrooms, setSelectedBedrooms] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Columns Visibility State (Persisted in localStorage, like Lead Pool)
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_OWNER_COLUMN_VISIBILITY);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('owner_data_column_visibility');
      if (saved) {
        setColumnVisibility({ ...DEFAULT_OWNER_COLUMN_VISIBILITY, ...JSON.parse(saved) });
      }
    } catch (_) {}
  }, []);

  const updateColumnVisibility = (newVisibility: Record<string, boolean>) => {
    setColumnVisibility(newVisibility);
    try {
      localStorage.setItem('owner_data_column_visibility', JSON.stringify(newVisibility));
    } catch (_) {}
  };

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activeRecordId, setActiveRecordId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    property_name: '',
    area: '',
    property_number: '',
    building_name: '',
    bedrooms: '2 Bedrooms',
    property_type: 'Apartment',
    owner_name: '',
    phone_number: '',
    mobile_number: '',
    email: '',
    notes: '',
    status: 'Available',
  });

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick View Drawer State
  const [viewRecord, setViewRecord] = useState<OwnerRecord | null>(null);

  // Fetch Owner Data
  const loadRecords = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '25',
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedArea !== 'all') params.append('area', selectedArea);
      if (selectedPropertyType !== 'all') params.append('property_type', selectedPropertyType);
      if (selectedBedrooms !== 'all') params.append('bedrooms', selectedBedrooms);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await fetch(`${API_BASE_URL}/owner-data?${params.toString()}`);
      const result = await res.json();

      if (result.success) {
        setRecords(result.data || []);
        setCurrentPage(result.current_page || 1);
        setLastPage(result.last_page || 1);
        setTotalCount(result.total || 0);
        if (result.stats) setStats(result.stats);
        if (result.filters) setFilterOptions(result.filters);
      }
    } catch (e) {
      console.error('Failed to load owner data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords(1);
  }, [selectedArea, selectedPropertyType, selectedBedrooms, selectedStatus, sortBy, sortOrder]);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      loadRecords(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Handle Sort Toggle
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setActiveRecordId(null);
    setFormData({
      property_name: '',
      area: 'Downtown Dubai',
      property_number: '',
      building_name: '',
      bedrooms: '2 Bedrooms',
      property_type: 'Apartment',
      owner_name: '',
      phone_number: '',
      mobile_number: '',
      email: '',
      notes: '',
      status: 'Available',
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: OwnerRecord) => {
    setModalMode('edit');
    setActiveRecordId(rec.id);
    setFormData({
      property_name: rec.property_name || '',
      area: rec.area || '',
      property_number: rec.property_number || '',
      building_name: rec.building_name || '',
      bedrooms: rec.bedrooms || '2 Bedrooms',
      property_type: rec.property_type || 'Apartment',
      owner_name: rec.owner_name || '',
      phone_number: rec.phone_number || '',
      mobile_number: rec.mobile_number || '',
      email: rec.email || '',
      notes: rec.notes || '',
      status: rec.status || 'Available',
    });
    setIsModalOpen(true);
  };

  // Submit Modal Form (Create / Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.owner_name.trim()) {
      Swal.fire({ icon: 'warning', title: 'Owner Name Required', text: 'Please enter the owner’s full name.' });
      return;
    }

    setSubmitting(true);
    try {
      const url = modalMode === 'create'
        ? `${API_BASE_URL}/owner-data`
        : `${API_BASE_URL}/owner-data/${activeRecordId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setIsModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: modalMode === 'create' ? 'Owner Record Added!' : 'Owner Record Updated!',
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        loadRecords(currentPage);
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Could not save owner record.' });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Request Failed', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Single Record
  const handleDelete = async (id: number, name: string) => {
    const confirm = await Swal.fire({
      title: 'Delete Owner Record?',
      text: `Are you sure you want to remove ${name} from Owner Data?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E11D48',
      cancelButtonColor: '#081428',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE_URL}/owner-data/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'Deleted!', text: data.message, timer: 1400, showConfirmButton: false });
          setSelectedIds((prev) => prev.filter((i) => i !== id));
          loadRecords(currentPage);
        }
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', text: err.message });
      }
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirm = await Swal.fire({
      title: `Delete ${selectedIds.length} Owner Records?`,
      text: 'Selected records will be moved to trash.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E11D48',
      cancelButtonColor: '#081428',
      confirmButtonText: `Delete ${selectedIds.length} Records`,
      cancelButtonText: 'Cancel',
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE_URL}/owner-data/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'Deleted!', text: data.message, timer: 1500, showConfirmButton: false });
          setSelectedIds([]);
          loadRecords(1);
        }
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Bulk Delete Failed', text: err.message });
      }
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (records.length === 0) {
      Swal.fire({ icon: 'info', title: 'No Data', text: 'No records available to export.' });
      return;
    }

    const headers = [
      'Property Name',
      'Area',
      'Property Number',
      'Building Name',
      'Bedrooms',
      'Property Type',
      'Owner Name',
      'Phone Number',
      'Mobile Number',
      'Email',
      'Status',
      'Notes'
    ];

    const rows = records.map((r) => [
      `"${r.property_name || ''}"`,
      `"${r.area || ''}"`,
      `"${r.property_number || ''}"`,
      `"${r.building_name || ''}"`,
      `"${r.bedrooms || ''}"`,
      `"${r.property_type || ''}"`,
      `"${r.owner_name || ''}"`,
      `"${r.phone_number || ''}"`,
      `"${r.mobile_number || ''}"`,
      `"${r.email || ''}"`,
      `"${r.status || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `owner_data_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample CSV Template
  const handleDownloadSampleCsv = () => {
    const headers = [
      'Property Name',
      'Area',
      'Property Number',
      'Building Name',
      'Bedrooms',
      'Property Types',
      'Owner Name',
      'Phone Number',
      'Mobile Number',
      'Email'
    ];
    const sampleRows = [
      ['Marina Gate 2 Luxury', 'Dubai Marina', 'Unit 1402', 'Marina Gate 2', '2 Bedrooms', 'Apartment', 'Tariq Mansoor', '+971 4 399 1122', '+971 50 123 4567', 'tariq@gmail.com'],
      ['Downtown Views Penthouse', 'Downtown Dubai', 'PH-01', 'Downtown Views II', '4 Bedrooms', 'Penthouse', 'Alexander Ivanov', '+971 4 456 7890', '+971 52 987 6543', 'alex.ivanov@mail.ru'],
      ['Palm Frond Villa', 'Palm Jumeirah', 'Villa K-12', 'Frond K', '5 Bedrooms', 'Villa', 'Fatima Al-Nuaimi', '+971 4 888 2211', '+971 55 444 3322', 'fatima.nuaimi@holding.ae'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map((r) => r.map(c => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'owner_data_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle CSV File Upload & Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        Swal.fire({ icon: 'warning', title: 'Empty CSV', text: 'The CSV file does not contain any data rows.' });
        return;
      }

      // Parse CSV Rows
      const recordsToImport: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());

        if (cols.length >= 7) {
          recordsToImport.push({
            property_name: cols[0] || null,
            area: cols[1] || null,
            property_number: cols[2] || null,
            building_name: cols[3] || null,
            bedrooms: cols[4] || null,
            property_type: cols[5] || null,
            owner_name: cols[6] || 'Unknown Owner',
            phone_number: cols[7] || null,
            mobile_number: cols[8] || null,
            email: cols[9] || null,
          });
        }
      }

      if (recordsToImport.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Invalid Format', text: 'Could not parse owner rows from this file.' });
        return;
      }

      setImporting(true);
      try {
        const res = await fetch(`${API_BASE_URL}/owner-data/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: recordsToImport }),
        });
        const data = await res.json();

        if (data.success) {
          setIsImportModalOpen(false);
          Swal.fire({
            icon: 'success',
            title: 'Import Successful!',
            text: `Imported ${data.imported} owner property records.`,
          });
          loadRecords(1);
        } else {
          Swal.fire({ icon: 'error', title: 'Import Failed', text: data.message });
        }
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (canViewOwnerData === false) {
    return (
      <div className="flex h-screen bg-[#F8F9FA] text-[#1B2A4A] overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col h-screen overflow-hidden min-w-0">
          <Navbar />
          <AccessDenied moduleName="Owner Data Bank" requiredPermission="owner_data.view" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#1B2A4A] overflow-hidden font-sans">
      {/* Sidebar with Owner Data link active */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 pl-56 flex flex-col h-screen overflow-hidden min-w-0">
        <Navbar />

        {/* 1. Header with Breadcrumb & Action Bar */}
        <header className="bg-white border-b border-[#E8E2D9] px-6 py-4 shrink-0 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#081428] text-[#C9A84C] flex items-center justify-center font-bold shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-lg text-[#081428] tracking-tight">
                  Owner Data Pool
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C9A84C]/15 text-[#8F7424] border border-[#C9A84C]/30">
                  Property Bank
                </span>
              </div>
              <p className="text-xs text-[#7A7A7A]">
                Comprehensive Dubai property title registry & owner contact information
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Bulk Delete Button if items checked */}
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer animate-fade-in"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => loadRecords(currentPage)}
              className="p-2 border border-[#E8E2D9] rounded-md hover:bg-slate-50 text-[#7A7A7A] hover:text-[#1B2A4A] transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-white border border-[#E8E2D9] text-[#1B2A4A] hover:bg-[#FAF8F5] text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-[#7A7A7A]" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Import CSV */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 bg-white border border-[#E8E2D9] text-[#1B2A4A] hover:bg-[#FAF8F5] text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Upload className="w-4 h-4 text-[#7A7A7A]" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>

            {/* Auto-Distribute Unassigned Owners */}
            <button
              onClick={async () => {
                try {
                  const res = await fetchApi('/distribution/run/owner-data', { method: 'POST' });
                  Swal.fire({
                    icon: 'success',
                    title: 'Owners Auto-Distributed!',
                    text: res.message || `Successfully distributed ${res.assigned_count} property records to active sales advisors.`,
                  });
                  loadRecords(currentPage);
                } catch (e: any) {
                  Swal.fire('Error', e.message || 'Auto-distribution failed', 'error');
                }
              }}
              className="px-3 py-2 bg-[#FAF8F5] border border-[#C9A84C] text-[#081428] hover:bg-[#081428] hover:text-[#C9A84C] text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Auto-distribute unassigned owner records across active sales advisors"
            >
              <Zap className="w-3.5 h-3.5 text-[#C9A84C]" />
              <span className="hidden sm:inline">Auto-Distribute</span>
            </button>

            {/* Add Owner Property */}
            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-md shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Owner Property</span>
            </button>
          </div>
        </header>

        {/* 2. Top Stats KPI Cards */}
        <div className="px-6 py-3.5 bg-[#FAF8F5] border-b border-[#E8E2D9] shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Total Properties</div>
              <div className="text-xl font-bold text-[#081428] mt-0.5">{stats.total}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-[#FAF8F5] border border-[#E8E2D9] flex items-center justify-center text-[#C9A84C]">
              <Home className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Available</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{stats.available ?? stats.active ?? 0}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Rented & Sold</div>
              <div className="text-xl font-bold text-indigo-700 mt-0.5">{(stats.rented || 0) + (stats.sold || 0)}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Prime Areas</div>
              <div className="text-xl font-bold text-[#081428] mt-0.5">{stats.areas_count}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-[#FAF8F5] border border-[#E8E2D9] flex items-center justify-center text-[#1B2A4A]">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 3. Search, Filters & Columns Control Bar (Aligned like Lead Pool) */}
        <div className="p-3 px-6 bg-white border-b border-[#E8E2D9] shrink-0 flex flex-wrap items-center justify-between gap-3">
          {/* Left Group: Search input + All Areas + Property Type + Bedrooms + Status + Reset */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            {/* Search input */}
            <div className="relative w-64 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
              <input
                type="text"
                placeholder="Search Owner, Property, Unit, Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] text-[#081428]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Area Filter Dropdown */}
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-md text-xs font-semibold text-[#1B2A4A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
            >
              <option value="all">All Areas ({filterOptions.areas.length})</option>
              {filterOptions.areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Property Type Filter Dropdown */}
            <select
              value={selectedPropertyType}
              onChange={(e) => setSelectedPropertyType(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-md text-xs font-semibold text-[#1B2A4A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
            >
              <option value="all">All Property Types</option>
              {filterOptions.property_types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Bedrooms Filter Dropdown */}
            <select
              value={selectedBedrooms}
              onChange={(e) => setSelectedBedrooms(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-md text-xs font-semibold text-[#1B2A4A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
            >
              <option value="all">All Bedrooms</option>
              {filterOptions.bedrooms.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Status Filter Dropdown (Available / Sold / Rented) */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-md text-xs font-semibold text-[#1B2A4A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Rented">Rented</option>
              <option value="Sold">Sold</option>
            </select>

            {/* Reset Filters */}
            {(selectedArea !== 'all' || selectedPropertyType !== 'all' || selectedBedrooms !== 'all' || selectedStatus !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedArea('all');
                  setSelectedPropertyType('all');
                  setSelectedBedrooms('all');
                  setSelectedStatus('all');
                  setSearchQuery('');
                }}
                className="text-xs text-[#C8A147] font-bold hover:underline px-1 cursor-pointer transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Right Group: Columns Selector Dropdown (Like Lead Pool) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setColumnsDropdownOpen(!columnsDropdownOpen)}
              className="px-3 py-1.5 bg-[#FAF8F5] border border-[#E8E2D9] hover:border-[#C9A84C] rounded-md text-xs text-[#081428] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C9A84C]" />
              <span>Columns</span>
              <span className="bg-[#C9A84C] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {Object.values(columnVisibility).filter(Boolean).length}
              </span>
            </button>

            {columnsDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setColumnsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E8E2D9] rounded-lg shadow-xl z-50 p-3 text-xs space-y-2 max-h-96 overflow-y-auto animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-2 font-bold text-[#081428]">
                    <span>Manage Table Columns</span>
                    <button
                      type="button"
                      onClick={() => updateColumnVisibility(DEFAULT_OWNER_COLUMN_VISIBILITY)}
                      className="text-[11px] text-[#C9A84C] hover:underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>

                  {(['Owner Info', 'Property Details', 'Contact Details', 'Meta & Actions'] as const).map((cat) => (
                    <div key={cat} className="space-y-1 pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A7A7A] bg-[#FAF8F5] px-1.5 py-0.5 rounded">
                        {cat}
                      </div>
                      {ALL_OWNER_COLUMNS.filter((c) => c.category === cat).map((col) => (
                        <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-[#FAF8F5] rounded cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!columnVisibility[col.key]}
                            onChange={(e) => {
                              updateColumnVisibility({
                                ...columnVisibility,
                                [col.key]: e.target.checked,
                              });
                            }}
                            className="accent-[#C9A84C] rounded cursor-pointer"
                          />
                          <span className={columnVisibility[col.key] ? 'font-semibold text-[#081428]' : 'text-slate-500'}>
                            {col.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 4. Main Interactive Data Table with Dynamic Column Visibility */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#FAF8F5] border-b border-[#E8E2D9] sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[#7A7A7A]">
              <tr>
                <th className="py-3 px-4 w-10">
                  <button onClick={toggleSelectAll} className="cursor-pointer text-slate-500 hover:text-[#081428]">
                    {selectedIds.length > 0 && selectedIds.length === records.length ? (
                      <CheckSquare className="w-4 h-4 text-[#C9A84C]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>

                {/* 1. Owner Name */}
                {columnVisibility.owner_name && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('owner_name')}>
                    <div className="flex items-center gap-1.5">
                      <span>Owner Name</span>
                      {sortBy === 'owner_name' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 2. Property Name */}
                {columnVisibility.property_name && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('property_name')}>
                    <div className="flex items-center gap-1.5">
                      <span>Property Name</span>
                      {sortBy === 'property_name' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 3. Property Number */}
                {columnVisibility.property_number && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('property_number')}>
                    <div className="flex items-center gap-1.5">
                      <span>Unit / Prop #</span>
                      {sortBy === 'property_number' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 4. Building Name & Area */}
                {columnVisibility.building_name && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('building_name')}>
                    <div className="flex items-center gap-1.5">
                      <span>Building & Area</span>
                      {sortBy === 'building_name' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 5. Bedrooms & Property Types */}
                {columnVisibility.bedrooms && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('bedrooms')}>
                    <div className="flex items-center gap-1.5">
                      <span>Type / Beds</span>
                      {sortBy === 'bedrooms' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 6. Mobile Number */}
                {columnVisibility.mobile_number && (
                  <th className="py-3 px-4">Mobile (WhatsApp)</th>
                )}

                {/* 7. Phone Number */}
                {columnVisibility.phone_number && (
                  <th className="py-3 px-4">Landline Phone</th>
                )}

                {/* 8. Email */}
                {columnVisibility.email && (
                  <th className="py-3 px-4">Email</th>
                )}

                {/* 9. Status */}
                {columnVisibility.status && (
                  <th className="py-3 px-4">Status</th>
                )}

                {/* 10. Notes */}
                {columnVisibility.notes && (
                  <th className="py-3 px-4">Notes</th>
                )}

                {/* 11. Date Added */}
                {columnVisibility.created_at && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1.5">
                      <span>Date Added</span>
                      {sortBy === 'created_at' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 12. Actions */}
                {columnVisibility.actions && (
                  <th className="py-3 px-4 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2D9] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#C9A84C] mx-auto mb-2" />
                    <span>Loading Owner Property Registry...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-500">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No Owner Records Found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or add a new owner record.</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isChecked = selectedIds.includes(r.id);

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                        isChecked ? 'bg-[#C9A84C]/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleSelectOne(r.id)}
                          className="cursor-pointer text-slate-400 hover:text-[#081428]"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#C9A84C]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* 1. Owner Name with Avatar */}
                      {columnVisibility.owner_name && (
                        <td className="py-3.5 px-4 font-semibold text-[#081428]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#081428] text-[#C9A84C] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {r.owner_name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold hover:text-[#C9A84C] transition-colors cursor-pointer" onClick={() => setViewRecord(r)}>
                                {r.owner_name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: #{r.id}</div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* 2. Property Name */}
                      {columnVisibility.property_name && (
                        <td className="py-3.5 px-4 font-medium text-[#081428]">
                          <div className="flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-[#C9A84C] shrink-0" />
                            <span className="truncate max-w-[180px]" title={r.property_name || 'N/A'}>
                              {r.property_name || '—'}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 3. Property Number */}
                      {columnVisibility.property_number && (
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] border border-slate-200">
                            {r.property_number || '—'}
                          </span>
                        </td>
                      )}

                      {/* 4. Building Name & Area */}
                      {columnVisibility.building_name && (
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[#081428] truncate max-w-[170px]" title={r.building_name || ''}>
                            {r.building_name || '—'}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-[#C9A84C] font-semibold mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{r.area || 'Dubai'}</span>
                          </div>
                        </td>
                      )}

                      {/* 5. Bedrooms & Property Types */}
                      {columnVisibility.bedrooms && (
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded text-[10px] font-bold">
                              {r.bedrooms || '—'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                              {r.property_type || '—'}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 6. Mobile with 1-Click WhatsApp & Copy */}
                      {columnVisibility.mobile_number && (
                        <td className="py-3.5 px-4">
                          {r.mobile_number ? (
                            <div className="flex items-center gap-1.5">
                              <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="font-mono text-[11px] text-slate-800 font-medium">{r.mobile_number}</span>
                              <Link
                                href="/whatsapp"
                                className="p-1 text-[#25D366] hover:bg-emerald-50 rounded"
                                title="Open WhatsApp Chat"
                              >
                                <MessageSquare className="w-3 h-3 fill-current" />
                              </Link>
                              <button
                                onClick={() => copyToClipboard(r.mobile_number || '', `mob-${r.id}`)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Copy Mobile"
                              >
                                {copiedField === `mob-${r.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      )}

                      {/* 7. Phone Number */}
                      {columnVisibility.phone_number && (
                        <td className="py-3.5 px-4">
                          {r.phone_number ? (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-mono text-[10px]">{r.phone_number}</span>
                              <button
                                onClick={() => copyToClipboard(r.phone_number || '', `ph-${r.id}`)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Copy Phone"
                              >
                                {copiedField === `ph-${r.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      )}

                      {/* 8. Email */}
                      {columnVisibility.email && (
                        <td className="py-3.5 px-4">
                          {r.email ? (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <a
                                href={`mailto:${r.email}`}
                                className="text-[11px] hover:text-[#C9A84C] hover:underline truncate max-w-[150px]"
                                title={r.email}
                              >
                                {r.email}
                              </a>
                              <button
                                onClick={() => copyToClipboard(r.email || '', `em-${r.id}`)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Copy Email"
                              >
                                {copiedField === `em-${r.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      )}

                      {/* 9. Status (Available / Rented / Sold) */}
                      {columnVisibility.status && (
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            r.status === 'Available' || r.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.status === 'Rented'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : r.status === 'Sold'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {r.status === 'active' ? 'Available' : (r.status || 'Available')}
                          </span>
                        </td>
                      )}

                      {/* 10. Notes */}
                      {columnVisibility.notes && (
                        <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-500" title={r.notes || ''}>
                          {r.notes || '—'}
                        </td>
                      )}

                      {/* 11. Date Added */}
                      {columnVisibility.created_at && (
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                        </td>
                      )}

                      {/* 12. Actions */}
                      {columnVisibility.actions && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewRecord(r)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(r)}
                              className="p-1.5 bg-slate-100 hover:bg-[#081428] hover:text-[#C9A84C] text-slate-600 rounded cursor-pointer transition-colors"
                              title="Edit Owner Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.owner_name)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded cursor-pointer transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer */}
        <footer className="bg-white border-t border-[#E8E2D9] px-6 py-3 shrink-0 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <strong className="text-[#081428]">{records.length}</strong> of{' '}
            <strong className="text-[#081428]">{totalCount}</strong> owner properties
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadRecords(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 border border-[#E8E2D9] rounded-md text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 font-mono text-xs text-slate-500">
              Page {currentPage} of {lastPage || 1}
            </span>
            <button
              onClick={() => loadRecords(currentPage + 1)}
              disabled={currentPage >= lastPage || loading}
              className="px-3 py-1.5 border border-[#E8E2D9] rounded-md text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </footer>
      </div>

      {/* 6. CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#C9A84C]" />
                <h2 className="font-heading font-bold text-base tracking-wide">
                  {modalMode === 'create' ? 'Add New Owner Property' : 'Edit Owner Property Record'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Section 1: Property Information */}
              <div>
                <h3 className="font-bold text-sm text-[#081428] border-b border-[#E8E2D9] pb-1.5 mb-3 flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-[#C9A84C]" />
                  <span>1. Property & Location Details</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Property Name <span className="text-slate-400 font-normal">(e.g. Marina Gate 2 Duplex)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.property_name}
                      onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
                      placeholder="e.g. Burj Crown High Floor"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Area / Community <span className="text-slate-400 font-normal">(e.g. Downtown Dubai)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder="e.g. Palm Jumeirah, Downtown"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Property / Unit Number <span className="text-slate-400 font-normal">(e.g. Unit 1204)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.property_number}
                      onChange={(e) => setFormData({ ...formData, property_number: e.target.value })}
                      placeholder="e.g. Villa N-24, Unit 3804"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Building / Cluster Name <span className="text-slate-400 font-normal">(e.g. Princess Tower)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.building_name}
                      onChange={(e) => setFormData({ ...formData, building_name: e.target.value })}
                      placeholder="e.g. Burj Crown, Address Sky View"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Property Type</label>
                    <select
                      value={formData.property_type}
                      onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] bg-white cursor-pointer"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Townhouse">Townhouse</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Duplex">Duplex</option>
                      <option value="Commercial">Commercial / Office</option>
                      <option value="Plot">Residential Plot</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. of Bedrooms</label>
                    <select
                      value={formData.bedrooms}
                      onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] bg-white cursor-pointer"
                    >
                      <option value="Studio">Studio</option>
                      <option value="1 Bedroom">1 Bedroom</option>
                      <option value="2 Bedrooms">2 Bedrooms</option>
                      <option value="3 Bedrooms">3 Bedrooms</option>
                      <option value="4 Bedrooms">4 Bedrooms</option>
                      <option value="5 Bedrooms">5 Bedrooms</option>
                      <option value="6+ Bedrooms">6+ Bedrooms</option>
                      <option value="Commercial">Commercial / Retail</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Owner Contact Details */}
              <div>
                <h3 className="font-bold text-sm text-[#081428] border-b border-[#E8E2D9] pb-1.5 mb-3 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-[#C9A84C]" />
                  <span>2. Owner Contact Details</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Owner Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.owner_name}
                      onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                      placeholder="e.g. Tariq Mansoor Al-Hashemi"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-semibold text-[#081428]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-slate-400 font-normal">(WhatsApp active)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.mobile_number}
                      onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                      placeholder="e.g. +971 50 123 4567"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phone Number <span className="text-slate-400 font-normal">(Landline / Office)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      placeholder="e.g. +971 4 399 1122"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. owner@example.com"
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Property Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C] bg-white cursor-pointer font-semibold text-[#081428]"
                    >
                      <option value="Available">Available (Open for Sale / Lease)</option>
                      <option value="Rented">Rented (Currently Tenanted)</option>
                      <option value="Sold">Sold (Deal Completed)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Notes / Qualification</label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="e.g. Motivated seller, tenanted until Q4 2026, viewing on 24h notice..."
                      className="w-full px-3 py-2 border border-[#E8E2D9] rounded-md focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-[#E8E2D9] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E8E2D9] rounded-md text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded-md shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  <span>{modalMode === 'create' ? 'Create Owner Record' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. CSV IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#C9A84C]" />
                <h2 className="font-heading font-bold text-base">Import Owner Data (CSV)</h2>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Expected CSV Header Format:</p>
                  <p className="text-[11px] text-amber-800 mt-1 font-mono">
                    Property Name, Area, Property Number, Building Name, Bedrooms, Property Types, Owner Name, Phone Number, Mobile Number, Email
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-600">Need the exact CSV format?</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#081428] font-bold rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#C9A84C]" />
                  <span>Download Sample Template</span>
                </button>
              </div>

              <div className="border-2 border-dashed border-[#E8E2D9] rounded-xl p-8 text-center bg-[#FAF8F5] hover:bg-slate-50 transition-colors">
                <Upload className="w-8 h-8 text-[#C9A84C] mx-auto mb-2" />
                <p className="font-bold text-sm text-[#081428]">Select CSV File to Upload</p>
                <p className="text-slate-400 text-xs mt-1">Supports UTF-8 formatted CSV spreadsheets</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="mt-4 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#081428] file:text-[#C9A84C] hover:file:bg-[#122444] cursor-pointer"
                />
              </div>

              {importing && (
                <div className="flex items-center justify-center gap-2 text-[#081428] font-semibold py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C9A84C]" />
                  <span>Ingesting and indexing records...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. QUICK VIEW DRAWER */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#E8E2D9] flex flex-col">
            <div className="bg-[#081428] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/10 text-[#C9A84C] flex items-center justify-center font-bold text-sm">
                  {viewRecord.owner_name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{viewRecord.owner_name}</h3>
                  <p className="text-[10px] text-[#C9A84C] font-mono">Property Owner Registry</p>
                </div>
              </div>
              <button onClick={() => setViewRecord(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E8E2D9] space-y-2">
                <div className="text-[11px] font-bold text-[#7A7A7A] uppercase tracking-wider">Property Details</div>
                <div className="text-base font-bold text-[#081428]">{viewRecord.property_name || 'N/A'}</div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600">
                  <div>Unit: <strong className="text-[#081428]">{viewRecord.property_number || '—'}</strong></div>
                  <div>Building: <strong className="text-[#081428]">{viewRecord.building_name || '—'}</strong></div>
                  <div>Area: <strong className="text-[#081428]">{viewRecord.area || '—'}</strong></div>
                  <div>Bedrooms: <strong className="text-[#081428]">{viewRecord.bedrooms || '—'}</strong></div>
                  <div>Type: <strong className="text-[#081428]">{viewRecord.property_type || '—'}</strong></div>
                  <div>Status: <span className={`px-2 py-0.5 font-bold rounded text-[10px] uppercase border ${
                    viewRecord.status === 'Available' || viewRecord.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : viewRecord.status === 'Rented'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : viewRecord.status === 'Sold'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>{viewRecord.status === 'active' ? 'Available' : (viewRecord.status || 'Available')}</span></div>
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E8E2D9] space-y-2.5">
                <div className="text-[11px] font-bold text-[#7A7A7A] uppercase tracking-wider">Owner Contact Info</div>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Mobile:
                    </span>
                    <span className="font-mono font-bold text-[#081428]">{viewRecord.mobile_number || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Landline:
                    </span>
                    <span className="font-mono font-bold text-[#081428]">{viewRecord.phone_number || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
                    </span>
                    <span className="font-medium text-[#081428]">{viewRecord.email || '—'}</span>
                  </div>
                </div>
              </div>

              {viewRecord.notes && (
                <div className="bg-white p-3.5 rounded-lg border border-[#E8E2D9] space-y-1">
                  <div className="text-[11px] font-bold text-[#7A7A7A] uppercase tracking-wider">Notes</div>
                  <p className="text-slate-700 leading-relaxed">{viewRecord.notes}</p>
                </div>
              )}

              <div className="pt-4 flex gap-2">
                <Link
                  href="/whatsapp"
                  className="flex-1 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-[#081428] font-bold rounded-md flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 fill-current" />
                  <span>WhatsApp Message</span>
                </Link>
                <button
                  onClick={() => {
                    setViewRecord(null);
                    handleOpenEdit(viewRecord);
                  }}
                  className="px-4 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
