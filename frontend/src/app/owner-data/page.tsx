'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '@/lib/api';
import { getGlobalColumnSettings, saveGlobalColumnSettings } from '@/lib/tableSettings';
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
  Zap,
  UserCheck,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { hasPermission, refreshCurrentUser, isSuperUser, getCurrentUser } from '@/lib/permissions';
import * as XLSX from 'xlsx';
import AccessDenied from '@/components/AccessDenied';
import { fetchApi } from '@/lib/api';
import DateRangePicker, { DateRangeValue } from '@/components/DateRangePicker';
import MultiCheckboxDropdown from '@/components/MultiCheckboxDropdown';
import SearchableSelect from '@/components/SearchableSelect';
import PhoneInput from '@/components/PhoneInput';

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
  category?: string | null;
  notes: string | null;
  status: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  category: 'Owner Info' | 'Property Details' | 'Contact Details' | 'Record Details';
}

const ALL_OWNER_COLUMNS: ColumnConfig[] = [
  { key: 'owner_name', label: 'Owner Name', category: 'Owner Info' },
  { key: 'assigned_to', label: 'Assigned Advisor', category: 'Owner Info' },
  { key: 'property_name', label: 'Property Name', category: 'Property Details' },
  { key: 'property_number', label: 'Unit / Prop #', category: 'Property Details' },
  { key: 'building_name', label: 'Building & Area', category: 'Property Details' },
  { key: 'bedrooms', label: 'Type & Bedrooms', category: 'Property Details' },
  { key: 'category', label: 'Category', category: 'Record Details' },
  { key: 'mobile_number', label: 'Primary Phone', category: 'Contact Details' },
  { key: 'phone_number', label: 'Secondary Phone', category: 'Contact Details' },
  { key: 'email', label: 'Email Address', category: 'Contact Details' },
  { key: 'created_at', label: 'Created Date', category: 'Record Details' },
  { key: 'notes', label: 'Notes', category: 'Record Details' },
];

const DEFAULT_OWNER_COLUMN_VISIBILITY: Record<string, boolean> = {
  owner_name: true,
  assigned_to: true,
  property_name: true,
  property_number: true,
  building_name: true,
  bedrooms: true,
  category: true,
  mobile_number: true,
  phone_number: false,
  email: true,
  created_at: true,
  notes: false,
  actions: true,
};

const DEFAULT_COMMUNITIES = [
  'Downtown Dubai',
  'Palm Jumeirah',
  'Business Bay',
  'Dubai Marina',
  'Dubai Hills Estate',
  'Jumeirah Golf Estates',
  'Arabian Ranches',
  'Dubai Creek Harbour',
  'MBR City (Sobha Hartland)',
  'Emaar Beachfront',
  'Arjan',
  'Jumeirah Village Circle (JVC)',
  'Jumeirah Village Triangle (JVT)',
  'DAMAC Hills',
  'DAMAC Hills 2',
  'Meydan',
  'Al Barari',
  'City Walk',
  'Bluewaters Island',
  'Dubai South',
  'Al Furjan',
  'Jumeirah Lake Towers (JLT)',
  'DIFC',
];

const DEFAULT_PROJECTS = [
  'Burj Crown Residences',
  'Sobha Hartland Waves',
  'Dubai Creek Residences',
  'Marina Gate Towers',
  'Palm Beach Towers',
  'DAMAC Hills Villa Cluster',
  'Address Sky View',
  'Princess Tower',
  'Downtown Views II',
  'Creek Beach',
  '48 Parkside',
  'Waves Grande',
  'Creek Rise',
  'Act One Act Two',
  'Grande at Opera District',
  'Address Harbour Point',
];

const DEFAULT_PROPERTY_NAMES = [
  '1BR Luxury Suite',
  '2BR Boulevard View Apartment',
  '3BR Premium Sky Collection',
  '4BR Grand Penthouse',
  'Luxury Waterfront Villa',
  'Garden View Townhouse',
  'Duplex Sky Suite',
  'Commercial Office Space',
  'Residential Plot',
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'Apartment', label: 'Apartment' },
  { value: 'Villa', label: 'Villa / Mansion' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'Penthouse', label: 'Penthouse' },
  { value: 'Duplex', label: 'Duplex' },
  { value: 'Commercial', label: 'Commercial / Office' },
  { value: 'Plot', label: 'Residential Plot / Land' },
];

const DEFAULT_BEDROOM_OPTIONS = [
  { value: 'Studio', label: 'Studio' },
  { value: '1 Bedroom', label: '1 Bedroom (1 BR)' },
  { value: '2 Bedrooms', label: '2 Bedrooms (2 BR)' },
  { value: '3 Bedrooms', label: '3 Bedrooms (3 BR)' },
  { value: '4 Bedrooms', label: '4 Bedrooms (4 BR)' },
  { value: '5 Bedrooms', label: '5 Bedrooms (5 BR)' },
  { value: '6+ Bedrooms', label: '6+ Bedrooms (6+ BR)' },
  { value: 'Commercial', label: 'Commercial / Retail' },
];

const normalizeOwnerBedrooms = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (/^studio$/i.test(trimmed)) return 'Studio';
  if (/^(1\s*(bed|beds|bedroom|bedrooms|br)|1)$/i.test(trimmed)) return '1 Bedroom';
  if (/^(2\s*(bed|beds|bedroom|bedrooms|br)|2)$/i.test(trimmed)) return '2 Bedrooms';
  if (/^(3\s*(bed|beds|bedroom|bedrooms|br)|3)$/i.test(trimmed)) return '3 Bedrooms';
  if (/^(4\s*(bed|beds|bedroom|bedrooms|br)|4)$/i.test(trimmed)) return '4 Bedrooms';
  if (/^(5\s*(bed|beds|bedroom|bedrooms|br)|5)$/i.test(trimmed)) return '5 Bedrooms';
  if (/^(6\+|6|7|8)\s*(bed|beds|bedroom|bedrooms|br)?$/i.test(trimmed)) return '6+ Bedrooms';
  if (/commercial/i.test(trimmed)) return 'Commercial';
  return trimmed;
};

const normalizeOwnerPropertyType = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'apartment' || lower === 'apartments' || lower === 'flat') return 'Apartment';
  if (lower === 'villa' || lower === 'mansion' || lower.includes('villa / mansion') || lower.includes('villa/mansion')) return 'Villa';
  if (lower === 'townhouse' || lower === 'town house') return 'Townhouse';
  if (lower === 'penthouse') return 'Penthouse';
  if (lower === 'duplex') return 'Duplex';
  if (lower === 'commercial' || lower === 'office' || lower.includes('commercial')) return 'Commercial';
  if (lower === 'plot' || lower === 'land' || lower.includes('plot')) return 'Plot';
  return trimmed;
};

const formatPhoneForInput = (val?: string | null): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  const cleanDigits = trimmed.replace(/[\s-]/g, '');
  if (/^\d+$/.test(cleanDigits)) {
    return `+${cleanDigits}`;
  }
  return trimmed;
};

export default function OwnerDataPage() {
  const [canViewOwnerData, setCanViewOwnerData] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  useEffect(() => {
    const checkPerms = () => {
      const u = getCurrentUser();
      setCurrentUser(u);
      setCanViewOwnerData(hasPermission('owner_data.view'));
    };
    checkPerms();
    refreshCurrentUser().then(checkPerms);
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);

  const canClaim = Boolean(
    hasPermission('owner_data.claim') ||
    hasPermission('owner_data.assign') ||
    hasPermission('lead_pool.claim') ||
    hasPermission('lead_pool.assign') ||
    isSuperUser(currentUser)
  );
  // State
  const [records, setRecords] = useState<OwnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    assigned?: number;
    unassigned?: number;
    areas_count: number;
    deleted: number;
  }>({ total: 0, assigned: 0, unassigned: 0, areas_count: 0, deleted: 0 });
  const [filterOptions, setFilterOptions] = useState<{
    areas: string[];
    property_types: string[];
    bedrooms: string[];
    categories?: string[];
  }>({
    areas: [],
    property_types: [],
    bedrooms: [],
    categories: ['Business Executives'],
  });

  // Filter & Search State (Placed on Left together with Search)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availableCategories, setAvailableCategories] = useState<string[]>(['Business Executives']);
  const [selectedImportCategory, setSelectedImportCategory] = useState<string>('Business Executives');
  const [showNewCategoryModal, setShowNewCategoryModal] = useState<boolean>(false);
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [selectedBedrooms, setSelectedBedrooms] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '', preset: 'all' });

  // Columns Visibility State (Persisted in localStorage, like Lead Pool)
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_OWNER_COLUMN_VISIBILITY);

  const formatDateTime = (raw?: any) => {
    if (!raw) return '—';
    if (typeof raw === 'string') {
      return raw.replace('T', ' ').substring(0, 16);
    }
    try {
      return new Date(raw).toISOString().replace('T', ' ').substring(0, 16);
    } catch {
      return '—';
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('owner_data_column_visibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumnVisibility({
          ...DEFAULT_OWNER_COLUMN_VISIBILITY,
          ...parsed,
          created_at: true,
        });
      }
    } catch (_) {}

    getGlobalColumnSettings('owner_data').then((res) => {
      if (res && res.visibility) {
        setColumnVisibility({
          ...DEFAULT_OWNER_COLUMN_VISIBILITY,
          ...res.visibility,
          created_at: true,
        });
        try {
          localStorage.setItem('owner_data_column_visibility', JSON.stringify({
            ...DEFAULT_OWNER_COLUMN_VISIBILITY,
            ...res.visibility,
            created_at: true,
          }));
        } catch (_) {}
      }
    });
  }, []);

  const updateColumnVisibility = (newVisibility: Record<string, boolean>) => {
    setColumnVisibility(newVisibility);
    try {
      localStorage.setItem('owner_data_column_visibility', JSON.stringify(newVisibility));
    } catch (_) {}
    saveGlobalColumnSettings('owner_data', { visibility: newVisibility });
  };

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [fromCount, setFromCount] = useState(0);
  const [toCount, setToCount] = useState(0);

  // Multi-Selection State & Floating Action Bar
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [bulkAssignOwner, setBulkAssignOwner] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Master Catalog State for Dropdowns
  const [catalogCommunities, setCatalogCommunities] = useState<string[]>([]);
  const [catalogProjects, setCatalogProjects] = useState<string[]>([]);
  const [catalogProperties, setCatalogProperties] = useState<string[]>([]);
  const [catalogPropertyTypes, setCatalogPropertyTypes] = useState<string[]>([]);

  // Custom user-added options state
  const [customCommunities, setCustomCommunities] = useState<string[]>([]);
  const [customProjects, setCustomProjects] = useState<string[]>([]);
  const [customPropertyNames, setCustomPropertyNames] = useState<string[]>([]);
  const [customPropertyTypes, setCustomPropertyTypes] = useState<string[]>([]);
  const [customBedrooms, setCustomBedrooms] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetchApi('/users').catch(() => null),
      fetchApi('/catalog/communities').catch(() => []),
      fetchApi('/catalog/projects').catch(() => []),
      fetchApi('/catalog/properties').catch(() => []),
    ])
      .then(([userData, commData, projData, propData]) => {
        const rawUsers = Array.isArray(userData) ? userData : (userData?.users || []);
        if (rawUsers.length > 0) {
          setActiveAgents(rawUsers.filter((u: any) => u.is_active));
        }
        if (Array.isArray(commData) && commData.length > 0) {
          setCatalogCommunities(commData.filter((c: any) => c.is_active !== false).map((c: any) => c.name));
        }
        if (Array.isArray(projData) && projData.length > 0) {
          setCatalogProjects(projData.filter((p: any) => p.is_active !== false).map((p: any) => p.name));
        }
        if (Array.isArray(propData) && propData.length > 0) {
          setCatalogPropertyTypes(propData.filter((p: any) => p.is_active !== false).map((p: any) => p.name));
        }
      })
      .catch(console.error);
  }, []);

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
    bedrooms: '',
    property_type: '',
    owner_name: '',
    phone_number: '',
    mobile_number: '',
    email: '',
    category: 'Business Executives',
    notes: '',
    assigned_to: '',
    status: 'active',
  });

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);
  const [importPreviewData, setImportPreviewData] = useState<{
    total_records: number;
    new_count?: number;
    duplicate_count?: number;
    db_duplicate_count?: number;
    file_duplicate_count?: number;
    duplicates?: Array<{
      row_index: number;
      owner_name: string;
      phone: string;
      email: string;
      property_number: string;
      building_name: string;
      area: string;
      is_duplicate: boolean;
      duplicate_source: 'database' | 'file';
      matched_with: string;
      matched_record_id?: number | null;
    }>;
    has_unmatched?: boolean;
    unmatched?: Record<string, any[]>;
    auto_mapped?: Record<string, any[]>;
    auto_mapped_lookup?: Record<string, Record<string, string>>;
    auto_mapped_count?: number;
    catalogs?: Record<string, string[]>;
  } | null>(null);

  const [ownerDuplicateMode, setOwnerDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [showDuplicatesTable, setShowDuplicatesTable] = useState(false);
  const [showCatalogMappings, setShowCatalogMappings] = useState(false);

  const [ownerValueMappings, setOwnerValueMappings] = useState<Record<string, Record<string, string>>>({
    community: {},
    project: {},
    property_type: {},
  });
  const [ownerNewCatalogItems, setOwnerNewCatalogItems] = useState<Array<{ category: string; name: string }>>([]);
  const [ownerMappingActions, setOwnerMappingActions] = useState<Record<string, 'map' | 'new' | 'keep'>>({});
  const [ownerMappingCategoryTab, setOwnerMappingCategoryTab] = useState<'all' | 'community' | 'project' | 'property_type'>('all');

  // Quick View Drawer State
  const [viewRecord, setViewRecord] = useState<OwnerRecord | null>(null);

  // Fetch Categories from Backend API (extensible for future)
  const loadCategories = async () => {
    try {
      const res = await fetchApi('/owner-data/categories');
      if (res && res.success && Array.isArray(res.categories)) {
        setAvailableCategories(Array.from(new Set(['Business Executives', ...res.categories])));
      }
    } catch (e) {
      console.error('Failed to load owner categories', e);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAddNewCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await fetchApi('/owner-data/categories', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed }),
      });
      if (res && res.success) {
        setAvailableCategories((prev) => Array.from(new Set([...prev, trimmed])));
        setSelectedImportCategory(trimmed);
        setNewCategoryInput('');
        setShowNewCategoryModal(false);
      }
    } catch (e) {
      console.error('Failed to create new category', e);
      setAvailableCategories((prev) => Array.from(new Set([...prev, trimmed])));
      setSelectedImportCategory(trimmed);
      setNewCategoryInput('');
      setShowNewCategoryModal(false);
    }
  };

  // Fetch Owner Data
  const loadRecords = async (page = currentPage, limit = perPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(limit),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedAreas.length > 0) params.append('area', selectedAreas.join(','));
      if (selectedPropertyTypes.length > 0) params.append('property_type', selectedPropertyTypes.join(','));
      if (selectedBedrooms.length > 0) params.append('bedrooms', selectedBedrooms.join(','));
      if (dateRange.from) params.append('date_from', dateRange.from);
      if (dateRange.to) params.append('date_to', dateRange.to);

      const result = await fetchApi(`/owner-data?${params.toString()}`);

      if (result.success) {
        setRecords(result.data || []);
        const cur = result.current_page || page;
        const last = result.last_page || 1;
        const total = result.total || 0;
        const count = result.data?.length || 0;
        setCurrentPage(cur);
        setLastPage(last);
        setTotalCount(total);
        setFromCount(result.from ?? (total > 0 ? (cur - 1) * limit + 1 : 0));
        setToCount(result.to ?? ((cur - 1) * limit + count));
        if (result.stats) setStats(result.stats);
        if (result.filters) {
          setFilterOptions(result.filters);
          if (Array.isArray(result.filters.categories)) {
            setAvailableCategories((prev) => Array.from(new Set(['Business Executives', ...prev, ...result.filters.categories])));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load owner data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords(1, perPage);
  }, [selectedCategory, selectedAreas, selectedPropertyTypes, selectedBedrooms, dateRange, sortBy, sortOrder]);

  // Debounced search trigger (avoids duplicate initial mount call)
  const isSearchMounted = useRef(false);
  useEffect(() => {
    if (!isSearchMounted.current) {
      isSearchMounted.current = true;
      return;
    }
    const handler = setTimeout(() => {
      setCurrentPage(1);
      loadRecords(1, perPage);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handlePerPageChange = (newLimit: number) => {
    setPerPage(newLimit);
    setCurrentPage(1);
    loadRecords(1, newLimit);
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (lastPage <= maxVisible + 2) {
      for (let i = 1; i <= lastPage; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(lastPage - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < lastPage - 2) pages.push('...');
      pages.push(lastPage);
    }
    return pages;
  };

  // Handle Sort Toggle
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Reset Filters Handler (Same as Lead Pool)
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedAreas([]);
    setSelectedPropertyTypes([]);
    setSelectedBedrooms([]);
    setDateRange({ from: '', to: '', preset: 'all' });
    setSearchQuery('');
    setCurrentPage(1);
    loadRecords(1, perPage);
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

  // Computed Dropdown Options for Add/Edit Form
  const computedCommunityOptions = useMemo(() => {
    const all = Array.from(new Set([
      ...DEFAULT_COMMUNITIES,
      ...catalogCommunities,
      ...(filterOptions.areas || []),
      ...customCommunities,
      ...(formData.area ? [formData.area] : []),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return all.map((c) => ({ value: c, label: c }));
  }, [catalogCommunities, filterOptions.areas, customCommunities, formData.area]);

  const computedProjectOptions = useMemo(() => {
    const all = Array.from(new Set([
      ...DEFAULT_PROJECTS,
      ...catalogProjects,
      ...customProjects,
      ...(formData.building_name ? [formData.building_name] : []),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return all.map((p) => ({ value: p, label: p }));
  }, [catalogProjects, customProjects, formData.building_name]);

  const computedPropertyNameOptions = useMemo(() => {
    const existingPropertyNames = records.map((r) => r.property_name).filter(Boolean) as string[];
    const all = Array.from(new Set([
      ...DEFAULT_PROPERTY_NAMES,
      ...catalogProjects,
      ...existingPropertyNames,
      ...customPropertyNames,
      ...(formData.property_name ? [formData.property_name] : []),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return all.map((p) => ({ value: p, label: p }));
  }, [catalogProjects, records, customPropertyNames, formData.property_name]);

  const computedPropertyTypeOptions = useMemo(() => {
    const opts = [...PROPERTY_TYPE_OPTIONS];
    catalogPropertyTypes.forEach((t) => {
      if (!opts.some((o) => o.value.toLowerCase() === t.toLowerCase())) {
        opts.push({ value: t, label: t });
      }
    });
    customPropertyTypes.forEach((t) => {
      if (!opts.some((o) => o.value.toLowerCase() === t.toLowerCase())) {
        opts.push({ value: t, label: t });
      }
    });
    if (formData.property_type && !opts.some((o) => o.value.toLowerCase() === formData.property_type.toLowerCase())) {
      opts.unshift({ value: formData.property_type, label: formData.property_type });
    }
    return opts;
  }, [catalogPropertyTypes, customPropertyTypes, formData.property_type]);

  const computedBedroomOptions = useMemo(() => {
    const opts = [...DEFAULT_BEDROOM_OPTIONS];
    customBedrooms.forEach((b) => {
      if (!opts.some((o) => o.value.toLowerCase() === b.toLowerCase())) {
        opts.push({ value: b, label: b });
      }
    });
    if (formData.bedrooms && !opts.some((o) => o.value.toLowerCase() === formData.bedrooms.toLowerCase())) {
      opts.push({ value: formData.bedrooms, label: formData.bedrooms });
    }
    return opts;
  }, [customBedrooms, formData.bedrooms]);

  const ownerSelectOptions = useMemo(() => {
    const opts = [
      { value: '', label: 'Unassigned / Auto-Distribute (Rotation Pool)' },
      { value: 'Unassigned', label: 'Unassigned (No Distribution)' },
      ...activeAgents.map((ag) => ({
        value: ag.name,
        label: `${ag.name} (${ag.role || ag.department || 'Sales Advisor'})`,
      })),
    ];
    if (formData.assigned_to && !opts.some((o) => o.value === formData.assigned_to)) {
      opts.push({
        value: formData.assigned_to,
        label: `${formData.assigned_to} (Current Advisor)`,
      });
    }
    return opts;
  }, [activeAgents, formData.assigned_to]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setActiveRecordId(null);
    setFormData({
      property_name: '',
      area: '',
      property_number: '',
      building_name: '',
      bedrooms: '',
      property_type: '',
      owner_name: '',
      phone_number: '',
      mobile_number: '',
      email: '',
      category: 'Business Executives',
      notes: '',
      assigned_to: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal with Complete Normalization & Fresh Sync
  const handleOpenEdit = async (rec: OwnerRecord) => {
    setModalMode('edit');
    setActiveRecordId(rec.id);

    // Normalize bedrooms and property_type
    const normalizedBeds = normalizeOwnerBedrooms(rec.bedrooms) || rec.bedrooms || '';
    const normalizedType = normalizeOwnerPropertyType(rec.property_type) || rec.property_type || '';

    setFormData({
      property_name: rec.property_name || '',
      area: rec.area || '',
      property_number: rec.property_number || '',
      building_name: rec.building_name || '',
      bedrooms: normalizedBeds,
      property_type: normalizedType,
      owner_name: rec.owner_name || '',
      phone_number: formatPhoneForInput(rec.phone_number),
      mobile_number: formatPhoneForInput(rec.mobile_number),
      email: rec.email || '',
      category: rec.category || 'Business Executives',
      notes: rec.notes || '',
      assigned_to: rec.assigned_to || '',
      status: rec.status || 'active',
    });
    setIsModalOpen(true);

    // Background fetch fresh record from API to ensure 100% field mapping & fresh DB data
    try {
      const res = await fetchApi(`/owner-data/${rec.id}`);
      if (res && res.success && res.record) {
        const full = res.record;
        const freshBeds = normalizeOwnerBedrooms(full.bedrooms) || full.bedrooms || '';
        const freshType = normalizeOwnerPropertyType(full.property_type) || full.property_type || '';
        setFormData({
          property_name: full.property_name || '',
          area: full.area || '',
          property_number: full.property_number || '',
          building_name: full.building_name || '',
          bedrooms: freshBeds,
          property_type: freshType,
          owner_name: full.owner_name || '',
          phone_number: formatPhoneForInput(full.phone_number),
          mobile_number: formatPhoneForInput(full.mobile_number),
          email: full.email || '',
          category: full.category || rec.category || 'Business Executives',
          notes: full.notes || '',
          assigned_to: full.assigned_to || '',
          status: full.status || 'active',
        });
      }
    } catch (err) {
      console.warn('Could not fetch fresh record details for edit:', err);
    }
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
      const path = modalMode === 'create'
        ? '/owner-data'
        : `/owner-data/${activeRecordId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const payload = {
        ...formData,
        email: formData.email ? formData.email.trim() : null,
        phone_number: formData.phone_number ? formData.phone_number.trim() : null,
        mobile_number: formData.mobile_number ? formData.mobile_number.trim() : null,
      };

      const data = await fetchApi(path, {
        method,
        body: JSON.stringify(payload),
      });

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
        const data = await fetchApi(`/owner-data/${id}`, { method: 'DELETE' });
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

  // Bulk Assign Handler (Same as Lead Pool)
  const handleExecuteBulkAssign = async () => {
    if (!bulkAssignOwner || selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      const data = await fetchApi('/owner-data/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          ids: selectedIds,
          assigned_to: bulkAssignOwner,
        }),
      });
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Properties Assigned!',
          text: `Successfully assigned ${data.count} property record(s) to ${bulkAssignOwner}.`,
          timer: 1800,
          showConfirmButton: false,
        });
        setSelectedIds([]);
        setBulkAssignOwner('');
        loadRecords(currentPage);
      } else {
        Swal.fire({ icon: 'error', title: 'Assignment Failed', text: data.message });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setBulkLoading(false);
    }
  };

  // Claim Single Record
  const handleClaimRecord = async (recordId: number, ownerName: string) => {
    const userName = currentUser?.name || 'yourself';
    const confirm = await Swal.fire({
      title: 'Claim This Property Record?',
      text: `Do you want to claim "${ownerName}" and assign it to ${userName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Claim Property',
      cancelButtonText: 'Cancel',
    });

    if (!confirm.isConfirmed) return;

    setClaimingId(recordId);
    try {
      const res = await fetchApi(`/owner-data/${recordId}/claim`, {
        method: 'POST',
      });

      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Record Claimed!',
          text: `You have successfully claimed "${ownerName}".`,
          timer: 1800,
          showConfirmButton: false,
        });
        loadRecords(currentPage);
      } else {
        throw new Error(res.error || res.message || 'Failed to claim record');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to claim record.', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  // Bulk Claim Handler (Self-Assign)
  const handleExecuteBulkClaim = async () => {
    if (selectedIds.length === 0) return;

    const userName = currentUser?.name || 'yourself';
    const selectedOwnerRecords = records.filter((r) => selectedIds.includes(r.id));
    const unassignedCount = selectedOwnerRecords.filter(
      (r) => !r.assigned_to || r.assigned_to === 'Unassigned'
    ).length;
    const skippedCount = selectedOwnerRecords.length - unassignedCount;

    if (unassignedCount === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Already Assigned',
        text: 'None of the selected property records can be claimed because they are already assigned to advisors.',
      });
      return;
    }

    const confirmText =
      skippedCount > 0
        ? `You selected ${selectedIds.length} property records, but ${skippedCount} are already assigned to other advisors. Do you want to claim the remaining ${unassignedCount} unassigned records to ${userName}?`
        : `Are you sure you want to claim ${unassignedCount} unassigned property records and assign them to ${userName}?`;

    const confirm = await Swal.fire({
      title: `Claim ${unassignedCount} Unassigned Records?`,
      text: confirmText,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Claim to Me',
      cancelButtonText: 'Cancel',
    });

    if (!confirm.isConfirmed) return;

    setBulkLoading(true);
    try {
      const res = await fetchApi('/owner-data/bulk-claim', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Records Claimed!',
          text: res.message || `Successfully claimed ${res.claimed_count} property records!`,
        });
        setSelectedIds([]);
        loadRecords(currentPage);
      } else {
        throw new Error(res.error || res.message || 'Failed to claim records');
      }
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Failed to claim selected records.', 'error');
    } finally {
      setBulkLoading(false);
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
        const data = await fetchApi('/owner-data/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: selectedIds }),
        });
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
      'Primary Phone',
      'Secondary Phone',
      'Email',
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
      `"${r.mobile_number || ''}"`,
      `"${r.phone_number || ''}"`,
      `"${r.email || ''}"`,
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
      'Property Type',
      'Owner Name',
      'Primary Phone',
      'Secondary Phone',
      'Email'
    ];
    const sampleRows = [
      ['Marina Gate 2 Luxury', 'Dubai Marina', 'Unit 1402', 'Marina Gate 2', '2 Bedrooms', 'Apartment', 'Tariq Mansoor', '+971 50 123 4567', '+971 4 399 1122', 'tariq@gmail.com'],
      ['Downtown Views Penthouse', 'Downtown Dubai', 'PH-01', 'Downtown Views II', '4 Bedrooms', 'Penthouse', 'Alexander Ivanov', '+971 52 987 6543', '+971 4 456 7890', 'alex.ivanov@mail.ru'],
      ['Palm Frond Villa', 'Palm Jumeirah', 'Villa K-12', 'Frond K', '5 Bedrooms', 'Villa', 'Fatima Al-Nuaimi', '+971 55 444 3322', '+971 4 888 2211', 'fatima.nuaimi@holding.ae'],
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

  // Handle File Upload & Parsing (Supports both .xlsx/.xls and .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      let recordsToImport: any[] = [];
      try {
        if (isExcel) {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });

          if (jsonRows.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Empty Excel File', text: 'The Excel file does not contain any data rows.' });
            return;
          }

          const firstRow = jsonRows[0];
          const keys = Object.keys(firstRow);
          const findKey = (candidates: string[]) => {
            return keys.find(k => candidates.some(cand => k.toLowerCase().includes(cand))) || '';
          };

          const kPropName = findKey(['property name', 'prop name']);
          const kArea = findKey(['area', 'community', 'location']);
          const kPropNum = findKey(['property number', 'property #', 'unit', 'prop #']);
          const kBuilding = findKey(['building name', 'building', 'project']);
          const kBedrooms = findKey(['bedroom', 'bed']);
          const kPropType = findKey(['property type', 'property types', 'type']);
          const kOwner = findKey(['owner name', 'owner', 'client name', 'name']);
          let kPrimary = findKey(['primary', 'mobile', 'whatsapp']);
          let kSecondary = findKey(['secondary', 'landline']);
          if (!kPrimary) kPrimary = findKey(['phone']);
          const kEmail = findKey(['email', 'mail']);
          const kAssigned = findKey(['assigned advisor', 'assigned to', 'assigned_to', 'advisor', 'agent']);

          recordsToImport = jsonRows.map((r) => {
            let b = r[kBedrooms] || null;
            let pt = r[kPropType] || null;
            const typeKeywords = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial', 'office', 'plot', 'mansion'];
            if (b && !pt && typeKeywords.some(kw => String(b).toLowerCase().includes(kw))) {
              pt = b;
              b = null;
            }
            return {
              property_name: r[kPropName] || null,
              area: r[kArea] || null,
              property_number: r[kPropNum] || null,
              building_name: r[kBuilding] || null,
              bedrooms: b,
              property_type: pt,
              owner_name: r[kOwner] || 'Unknown Owner',
              mobile_number: r[kPrimary] || null,
              phone_number: r[kSecondary] || null,
              email: r[kEmail] || null,
              assigned_to: kAssigned && r[kAssigned] ? r[kAssigned] : null,
            };
          });
        } else {
          // CSV Parsing
          const text = evt.target?.result as string;
          if (!text) return;
          const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
          if (lines.length <= 1) {
            Swal.fire({ icon: 'warning', title: 'Empty CSV', text: 'The CSV file does not contain any data rows.' });
            return;
          }

          const headerLine = lines[0];
          const headerCols = headerLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim().toLowerCase());

          const findColIdx = (candidates: string[], fallbackIdx: number) => {
            const found = headerCols.findIndex(h => candidates.some(cand => h.includes(cand)));
            return found !== -1 ? found : fallbackIdx;
          };

          const idxPropName = findColIdx(['property name', 'prop name'], 0);
          const idxArea = findColIdx(['area', 'community', 'location'], 1);
          const idxPropNum = findColIdx(['property number', 'property #', 'unit', 'prop #'], 2);
          const idxBuilding = findColIdx(['building name', 'building', 'project'], 3);
          const idxBedrooms = findColIdx(['bedroom', 'bed'], 4);
          const idxPropType = findColIdx(['property type', 'property types', 'type'], 5);
          const idxOwner = findColIdx(['owner name', 'owner', 'client name'], 6);

          let idxPrimary = headerCols.findIndex(h => h.includes('primary') || h.includes('mobile') || h.includes('whatsapp'));
          let idxSecondary = headerCols.findIndex(h => h.includes('secondary') || h.includes('landline') || (h.includes('phone') && !h.includes('primary') && !h.includes('mobile')));

          if (idxPrimary === -1) {
            const pIdx = headerCols.findIndex(h => h.includes('phone'));
            idxPrimary = pIdx !== -1 ? pIdx : 7;
          }
          if (idxSecondary === -1) {
            idxSecondary = (idxPrimary === 7) ? 8 : 7;
          }
          const idxEmail = findColIdx(['email', 'mail'], 9);
          const idxAssigned = findColIdx(['assigned advisor', 'assigned to', 'assigned_to', 'advisor', 'sales advisor', 'agent'], -1);

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());

            if (cols.length >= 6) {
              let b = cols[idxBedrooms] || null;
              let pt = cols[idxPropType] || null;
              const typeKeywords = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial', 'office', 'plot', 'mansion'];
              if (b && !pt && typeKeywords.some(kw => (b as string).toLowerCase().includes(kw))) {
                pt = b;
                b = null;
              }

              recordsToImport.push({
                property_name: cols[idxPropName] || null,
                area: cols[idxArea] || null,
                property_number: cols[idxPropNum] || null,
                building_name: cols[idxBuilding] || null,
                bedrooms: b,
                property_type: pt,
                owner_name: cols[idxOwner] || 'Unknown Owner',
                mobile_number: cols[idxPrimary] || null,
                phone_number: cols[idxSecondary] || null,
                email: cols[idxEmail] || null,
                assigned_to: idxAssigned !== -1 && cols[idxAssigned] ? cols[idxAssigned] : null,
              });
            }
          }
        }
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'File Error', text: 'Failed to read file: ' + err.message });
        return;
      }

      if (recordsToImport.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Invalid Format', text: 'Could not parse owner rows from this file.' });
        return;
      }

      setImporting(true);
      try {
        const previewRes = await fetchApi('/owner-data/import-preview', {
          method: 'POST',
          body: JSON.stringify({ records: recordsToImport }),
        });

        setParsedImportRows(recordsToImport);
        setImportPreviewData(previewRes);

        const initialMappings: Record<string, Record<string, string>> = {
          community: {},
          project: {},
          property_type: {},
        };
        const initialActions: Record<string, 'map' | 'new' | 'keep'> = {};

        // Pre-populate auto_mapped_lookup so it is preserved and submitted
        if (previewRes.auto_mapped_lookup) {
          ['community', 'project', 'property_type'].forEach((cat) => {
            if (previewRes.auto_mapped_lookup[cat]) {
              Object.entries(previewRes.auto_mapped_lookup[cat]).forEach(([rawVal, targetVal]) => {
                initialMappings[cat][rawVal] = targetVal as string;
              });
            }
          });
        }

        ['community', 'project', 'property_type'].forEach((cat) => {
          (previewRes.unmatched?.[cat] || []).forEach((item: any) => {
            const key = `${cat}::${item.file_value}`;
            if (item.suggested_match && item.confidence >= 60) {
              initialMappings[cat][item.file_value] = item.suggested_match;
              initialActions[key] = 'map';
            } else {
              initialActions[key] = 'keep';
            }
          });
        });

        setOwnerValueMappings(initialMappings);
        setOwnerMappingActions(initialActions);
        setImportStep('preview');
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Import Preview Failed', text: err.message });
      } finally {
        setImporting(false);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Execute Final Owner Data Import with mappings and newly approved master catalog entries
  const executeOwnerImport = async (records: any[], mappings: any, newItems: any[], duplicateMode = 'skip') => {
    setImporting(true);
    try {
      const data = await fetchApi('/owner-data/import', {
        method: 'POST',
        body: JSON.stringify({
          records,
          value_mappings: mappings,
          new_catalog_items: newItems,
          duplicate_mode: duplicateMode,
          category: selectedImportCategory || 'Business Executives',
        }),
      });

      if (data.success) {
        setIsImportModalOpen(false);
        setImportStep('upload');
        setParsedImportRows([]);
        setImportPreviewData(null);
        setOwnerValueMappings({ community: {}, project: {}, property_type: {} });
        setOwnerNewCatalogItems([]);
        setOwnerMappingActions({});
        setShowDuplicatesTable(false);
        setShowCatalogMappings(false);
        Swal.fire({
          icon: 'success',
          title: 'Import Successful!',
          text: `Imported ${data.imported} property records under '${selectedImportCategory || 'Business Executives'}'${data.skipped ? `, ${data.skipped} skipped` : ''}${data.updated ? `, ${data.updated} updated` : ''}.`,
        });
        loadCategories();
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

  const handleConfirmOwnerMappingAndImport = async () => {
    const approvedNewItems: Array<{ category: string; name: string }> = [];
    const activeMappings: Record<string, Record<string, string>> = {
      community: {},
      project: {},
      property_type: {},
    };

    ['community', 'project', 'property_type'].forEach((cat) => {
      // Include any pre-existing auto-mappings
      if (importPreviewData?.auto_mapped_lookup?.[cat]) {
        Object.entries(importPreviewData.auto_mapped_lookup[cat]).forEach(([rawVal, targetVal]) => {
          activeMappings[cat][rawVal] = targetVal as string;
        });
      }

      (importPreviewData?.unmatched?.[cat] || []).forEach((item: any) => {
        const key = `${cat}::${item.file_value}`;
        const action = ownerMappingActions[key] || 'keep';

        if (action === 'new') {
          approvedNewItems.push({ category: cat, name: item.file_value });
        } else if (action === 'map') {
          const target = ownerValueMappings[cat]?.[item.file_value];
          if (target) {
            activeMappings[cat][item.file_value] = target;
          }
        }
      });
    });

    await executeOwnerImport(parsedImportRows, activeMappings, approvedNewItems, ownerDuplicateMode);
  };

  if (canViewOwnerData === false) {
    return (
      <div className="flex h-screen bg-[#FAF8F5] text-[#1B2A4A] overflow-hidden">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col h-screen overflow-hidden min-w-0">
          <Navbar />
          <AccessDenied moduleName="Owner Data Bank" requiredPermission="owner_data.view" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAF8F5] text-[#1B2A4A] overflow-hidden">
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
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Assigned Properties</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{stats.assigned ?? 0}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#E8E2D9] shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7A7A]">Unassigned Properties</div>
              <div className="text-xl font-bold text-amber-700 mt-0.5">{stats.unassigned ?? 0}</div>
            </div>
            <div className="w-9 h-9 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
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

            {/* Date Range Calendar Filter (At the Start, like Lead Pool) */}
            <DateRangePicker
              value={dateRange}
              onChange={(val) => {
                setDateRange(val);
                setCurrentPage(1);
              }}
            />

            {/* Area Filter Dropdown */}
            <MultiCheckboxDropdown
              label="Area"
              placeholder="All Areas"
              options={filterOptions.areas}
              selected={selectedAreas}
              onChange={(val) => {
                setSelectedAreas(val);
                setCurrentPage(1);
              }}
            />

            {/* Property Type Filter Dropdown */}
            <MultiCheckboxDropdown
              label="Property Types"
              placeholder="All Property Types"
              options={filterOptions.property_types}
              selected={selectedPropertyTypes}
              onChange={(val) => {
                setSelectedPropertyTypes(val);
                setCurrentPage(1);
              }}
            />

            {/* Bedrooms Filter Dropdown */}
            <MultiCheckboxDropdown
              label="Bedrooms"
              placeholder="All Bedrooms"
              options={filterOptions.bedrooms}
              selected={selectedBedrooms}
              onChange={(val) => {
                setSelectedBedrooms(val);
                setCurrentPage(1);
              }}
            />

            {/* Category Filter Dropdown (Future-Proof & Dynamic) */}
            <div className="relative shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className={`text-xs font-semibold py-1.5 px-3 rounded-md border transition-colors cursor-pointer appearance-none pr-7 bg-no-repeat bg-[right_8px_center] ${
                  selectedCategory !== 'all'
                    ? 'bg-[#C9A84C]/15 border-[#C9A84C] text-[#081428] font-bold'
                    : 'bg-[#FAF8F5] border-[#E8E2D9] text-slate-700 hover:border-[#C9A84C]'
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23C9A84C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundSize: '12px',
                }}
                title="Filter by Category"
              >
                <option value="all">All Categories</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button (Always visible like Lead Pool) */}
            <button
              onClick={handleResetFilters}
              className="text-xs text-[#C8A147] font-bold hover:underline px-1 cursor-pointer transition-colors ml-1"
            >
              Reset
            </button>
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

                  {(['Owner Info', 'Property Details', 'Contact Details', 'Record Details'] as const).map((cat) => (
                    <div key={cat} className="space-y-1 pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A7A7A] bg-[#FAF8F5] px-1.5 py-0.5 rounded">
                        {cat}
                      </div>
                      {ALL_OWNER_COLUMNS.filter((c) => c.category === cat && c.key !== 'actions').map((col) => (
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

                {/* Assigned Advisor */}
                {columnVisibility.assigned_to && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('assigned_to')}>
                    <div className="flex items-center gap-1.5">
                      <span>Assigned Advisor</span>
                      {sortBy === 'assigned_to' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
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

                {/* Category Column */}
                {columnVisibility.category && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('category')}>
                    <div className="flex items-center gap-1.5">
                      <span>Category</span>
                      {sortBy === 'category' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 6. Mobile Number */}
                {columnVisibility.mobile_number && (
                  <th className="py-3 px-4">Primary Phone</th>
                )}

                {/* 7. Phone Number */}
                {columnVisibility.phone_number && (
                  <th className="py-3 px-4">Secondary Phone</th>
                )}

                {/* 8. Email */}
                {columnVisibility.email && (
                  <th className="py-3 px-4">Email</th>
                )}


                {/* 10. Created Date */}
                {columnVisibility.created_at && (
                  <th className="py-3 px-4 cursor-pointer hover:text-[#081428]" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1.5">
                      <span>Created Date</span>
                      {sortBy === 'created_at' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#C9A84C]" /> : <ArrowDown className="w-3 h-3 text-[#C9A84C]" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                    </div>
                  </th>
                )}

                {/* 11. Notes */}
                {columnVisibility.notes && (
                  <th className="py-3 px-4">Notes</th>
                )}

                {/* 12. Actions - Permanent & Mandatory */}
                <th className="py-3 px-4 text-right">Actions</th>
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

                      {/* Assigned Advisor */}
                      {columnVisibility.assigned_to && (
                        <td className="py-3.5 px-4 font-semibold text-xs whitespace-nowrap">
                          {r.assigned_to && r.assigned_to !== 'Unassigned' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#081428] text-[#C9A84C] border border-[#C9A84C]/30 shadow-2xs">
                              <UserCheck className="w-3.5 h-3.5 text-[#C9A84C]" />
                              <span>{r.assigned_to}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              Unassigned
                            </span>
                          )}
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

                      {/* Category Column */}
                      {columnVisibility.category && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                            💼 {r.category || 'Business Executives'}
                          </span>
                        </td>
                      )}

                      {/* 6. Mobile Number with Copy */}
                      {columnVisibility.mobile_number && (
                        <td className="py-3.5 px-4">
                          {r.mobile_number ? (
                            <div className="flex items-center gap-1.5">
                              <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="font-mono text-[11px] text-slate-800 font-medium">{r.mobile_number}</span>
                              <button
                                onClick={() => copyToClipboard(r.mobile_number || '', `mob-${r.id}`)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Copy Primary Phone"
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
                                title="Copy Secondary Phone"
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


                      {/* 10. Created Date */}
                      {columnVisibility.created_at && (
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-[#C9A84C] shrink-0" />
                            <span>{formatDateTime(r.created_at)}</span>
                          </div>
                        </td>
                      )}

                      {/* 11. Notes */}
                      {columnVisibility.notes && (
                        <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-500" title={r.notes || ''}>
                          {r.notes || '—'}
                        </td>
                      )}

                      {/* 12. Actions - Permanent & Mandatory */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                            {canClaim && (!r.assigned_to || r.assigned_to === 'Unassigned') && (
                              <button
                                onClick={() => handleClaimRecord(r.id, r.owner_name)}
                                disabled={claimingId === r.id}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded border border-emerald-200 cursor-pointer transition-colors"
                                title="Claim this unassigned property to yourself"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            )}
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
                            <Link
                              href={`/whatsapp?phone=${encodeURIComponent(r.mobile_number || r.phone_number || '')}&name=${encodeURIComponent(r.owner_name || '')}`}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded border border-emerald-200 transition-colors"
                              title="Open WhatsApp Chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(r.id, r.owner_name)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded cursor-pointer transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. SERVER-SIDE DATABASE PAGINATION FOOTER BAR */}
        <footer className="bg-[#FAF8F5] border-t border-[#E8E2D9] px-6 py-3 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <strong className="text-[#081428]">{fromCount}</strong> to{' '}
            <strong className="text-[#081428]">{toCount}</strong> of{' '}
            <strong className="text-[#081428]">{Number(totalCount).toLocaleString()}</strong> owner properties
          </div>

          <div className="flex items-center gap-1">
            {/* Prev Button */}
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                  loadRecords(currentPage - 1, perPage);
                }
              }}
              disabled={currentPage <= 1 || loading}
              className="p-1.5 border border-[#E8E2D9] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dynamic Page Buttons */}
            {getPageNumbers().map((p, idx) => {
              if (typeof p === 'string') {
                return (
                  <span key={`dots-${idx}`} className="px-1 text-slate-400 font-semibold">
                    ...
                  </span>
                );
              }
              const isCurrent = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  onClick={() => {
                    setCurrentPage(p as number);
                    loadRecords(p as number, perPage);
                  }}
                  disabled={loading}
                  className={`w-7 h-7 rounded text-xs transition-colors cursor-pointer ${
                    isCurrent
                      ? 'font-bold bg-[#C8A147] text-white shadow-xs'
                      : 'font-medium border border-[#E8E2D9] hover:bg-white text-[#1A1A1A]'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              onClick={() => {
                if (currentPage < lastPage) {
                  setCurrentPage(currentPage + 1);
                  loadRecords(currentPage + 1, perPage);
                }
              }}
              disabled={currentPage >= lastPage || loading}
              className="p-1.5 border border-[#E8E2D9] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Per Page Select Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Per Page:</span>
            <select
              value={perPage}
              onChange={(e) => handlePerPageChange(Number(e.target.value))}
              className="p-1.5 bg-white border border-[#E8E2D9] rounded text-xs text-[#1A1A1A] font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C8A147]"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
              <option value={500}>500 / page</option>
            </select>
          </div>
        </footer>
      </div>

      {/* FLOATING BULK ASSIGNMENT & ACTION BAR (Same as Lead Pool) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#081428] text-white border border-[#C8A147]/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 text-xs font-bold border-r border-[#152744] pr-4">
            <span className="w-6 h-6 rounded-full bg-[#C8A147] text-[#081428] flex items-center justify-center font-mono text-xs font-extrabold">
              {selectedIds.length}
            </span>
            <span>Records Selected</span>
          </div>

          <div className="flex items-center gap-2">
            {canClaim && (
              <button
                onClick={handleExecuteBulkClaim}
                disabled={bulkLoading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Claim all selected unassigned records to yourself"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{bulkLoading ? 'Claiming...' : 'Claim to Me'}</span>
              </button>
            )}

            <select
              value={bulkAssignOwner}
              onChange={(e) => setBulkAssignOwner(e.target.value)}
              className="bg-[#122444] border border-[#1f3864] text-white text-xs font-semibold rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#C8A147] cursor-pointer"
            >
              <option value="">Select Advisor / Owner...</option>
              {activeAgents.map((ag) => (
                <option key={ag.id} value={ag.name}>
                  {ag.name} ({ag.role || 'Agent'})
                </option>
              ))}
              <option value="Unassigned">Unassigned</option>
            </select>

            <button
              onClick={handleExecuteBulkAssign}
              disabled={!bulkAssignOwner || bulkLoading}
              className="px-3.5 py-1.5 bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{bulkLoading ? 'Assigning...' : 'Assign Selected'}</span>
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Trash</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                      Property Name <span className="text-slate-400 font-normal">(e.g. 48 Parkside, Marina Gate 2)</span>
                    </label>
                    <SearchableSelect
                      options={computedPropertyNameOptions}
                      value={formData.property_name}
                      onChange={(val) => setFormData({ ...formData, property_name: val })}
                      onAddOption={(newVal) => {
                        setCustomPropertyNames((prev) => [...prev, newVal]);
                        setFormData({ ...formData, property_name: newVal });
                      }}
                      allowCustomAdd={true}
                      placeholder="Search or enter property name..."
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Area / Community <span className="text-slate-400 font-normal">(e.g. Arjan, Downtown Dubai)</span>
                    </label>
                    <SearchableSelect
                      options={computedCommunityOptions}
                      value={formData.area}
                      onChange={(val) => setFormData({ ...formData, area: val })}
                      onAddOption={(newVal) => {
                        setCustomCommunities((prev) => [...prev, newVal]);
                        setFormData({ ...formData, area: newVal });
                      }}
                      allowCustomAdd={true}
                      placeholder="Search or enter area / community..."
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Property / Unit Number <span className="text-slate-400 font-normal">(e.g. Unit 1204, Villa N-24)</span>
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
                      Building / Cluster Name <span className="text-slate-400 font-normal">(e.g. 104, Princess Tower)</span>
                    </label>
                    <SearchableSelect
                      options={computedProjectOptions}
                      value={formData.building_name}
                      onChange={(val) => setFormData({ ...formData, building_name: val })}
                      onAddOption={(newVal) => {
                        setCustomProjects((prev) => [...prev, newVal]);
                        setFormData({ ...formData, building_name: newVal });
                      }}
                      allowCustomAdd={true}
                      placeholder="Search or enter building / cluster..."
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Property Type</label>
                    <SearchableSelect
                      options={computedPropertyTypeOptions}
                      value={formData.property_type}
                      onChange={(val) => setFormData({ ...formData, property_type: val })}
                      onAddOption={(newVal) => {
                        setCustomPropertyTypes((prev) => [...prev, newVal]);
                        setFormData({ ...formData, property_type: newVal });
                      }}
                      allowCustomAdd={true}
                      placeholder="Select or enter property type..."
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. of Bedrooms</label>
                    <SearchableSelect
                      options={computedBedroomOptions}
                      value={formData.bedrooms}
                      onChange={(val) => setFormData({ ...formData, bedrooms: val })}
                      onAddOption={(newVal) => {
                        setCustomBedrooms((prev) => [...prev, newVal]);
                        setFormData({ ...formData, bedrooms: newVal });
                      }}
                      allowCustomAdd={true}
                      placeholder="Select or enter bedrooms..."
                    />
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
                      Primary Phone Number <span className="text-slate-400 font-normal">(WhatsApp active)</span>
                    </label>
                    <PhoneInput
                      value={formData.mobile_number}
                      onChange={(val) => setFormData({ ...formData, mobile_number: val })}
                      placeholder="e.g. +971 50 123 4567"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Secondary Phone Number <span className="text-slate-400 font-normal">(Landline / Office / Alt)</span>
                    </label>
                    <PhoneInput
                      value={formData.phone_number}
                      onChange={(val) => setFormData({ ...formData, phone_number: val })}
                      placeholder="e.g. +971 4 399 1122"
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

              {/* Section 3: Lead Assignment & Ownership */}
              <div className="bg-[#FAF8F5] p-4 rounded-lg border border-[#E8E2D9] space-y-3">
                <h3 className="font-bold text-sm text-[#081428] border-b border-[#E8E2D9] pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#C9A84C]" />
                    <span>3. Lead Assignment & Ownership</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#C9A84C] bg-[#081428] px-2 py-0.5 rounded">
                    Sales Distribution
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assigned Agent / Owner <span className="text-slate-400 font-normal">(Sales Advisor)</span>
                    </label>
                    <SearchableSelect
                      options={ownerSelectOptions}
                      value={formData.assigned_to}
                      onChange={(val) => setFormData({ ...formData, assigned_to: val })}
                      placeholder="Select Advisor or Auto-Distribute..."
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                      <span>💡</span>
                      <span>
                        Choose advisor or <strong>"Auto-Distribute"</strong> for rotation.
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Category <span className="text-[#C9A84C] font-bold">*</span>
                    </label>
                    <select
                      value={formData.category || 'Business Executives'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] font-medium focus:outline-none focus:border-[#C8A147] focus:bg-white transition-colors cursor-pointer"
                    >
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Contact category classification.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Record Status
                    </label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded-md text-xs text-[#1A1A1A] font-medium focus:outline-none focus:border-[#C8A147] focus:bg-white transition-colors cursor-pointer"
                    >
                      <option value="active">Active (Available)</option>
                      <option value="contacted">Contacted / In Discussion</option>
                      <option value="unresponsive">Unresponsive</option>
                      <option value="deal_closed">Deal Closed</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Current lifecycle state in Property Owner Bank.
                    </p>
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

      {/* 7. IMPORT MODAL WITH CROSS-DATABASE DUPLICATE AUDIT & CATALOG STANDARDIZATION */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-xl shadow-2xl border border-[#E8E2D9] w-full ${importStep === 'preview' ? 'max-w-4xl' : 'max-w-lg'} overflow-hidden animate-fade-in transition-all flex flex-col max-h-[92vh]`}>
            {/* Modal Header */}
            <div className="bg-[#081428] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#C9A84C]" />
                <h2 className="font-heading font-bold text-base">
                  {importStep === 'preview'
                    ? `Import Preview & Duplicate Audit (${parsedImportRows.length} Records)`
                    : 'Import Owner Data (Excel / CSV)'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStep('upload');
                  setParsedImportRows([]);
                  setImportPreviewData(null);
                  setShowDuplicatesTable(false);
                  setShowCatalogMappings(false);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: FILE UPLOAD */}
            {importStep === 'upload' && (
              <div className="p-6 space-y-4 text-xs overflow-y-auto">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Expected File Format (Excel .xlsx or CSV):</p>
                    <p className="text-[11px] text-amber-800 mt-1 font-mono">
                      Property Name, Area, Property Number, Building Name, Bedrooms, Property Type, Owner Name, Primary Phone, Secondary Phone, Email
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-600">Need the exact template format?</span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#081428] font-bold rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C9A84C]" />
                    <span>Download Sample Template</span>
                  </button>
                </div>

                {/* Category Selection Dropdown (Defaults to Business Executives, Extensible) */}
                <div className="p-3.5 bg-gradient-to-r from-[#FAF8F5] to-amber-50/50 border border-[#E8E2D9] rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-[#081428] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Target Category</span>
                      <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-1.5 py-0.2 rounded">Required</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryModal(true)}
                      className="text-[11px] text-[#C9A84C] hover:text-[#081428] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add New Category</span>
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedImportCategory}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setShowNewCategoryModal(true);
                        } else {
                          setSelectedImportCategory(e.target.value);
                        }
                      }}
                      className="w-full p-2.5 bg-white border border-[#E8E2D9] focus:border-[#C9A84C] rounded-lg text-xs font-semibold text-[#081428] shadow-2xs cursor-pointer appearance-none pr-8 bg-no-repeat bg-[right_10px_center]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23C9A84C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                        backgroundSize: '14px',
                      }}
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          💼 {cat}
                        </option>
                      ))}
                      <option value="__add_new__" className="text-[#C9A84C] font-bold">
                        ➕ + Create New Category...
                      </option>
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    All imported properties will be tagged under category: <strong className="text-[#081428]">{selectedImportCategory}</strong>.
                  </p>
                </div>

                <div className="border-2 border-dashed border-[#E8E2D9] rounded-xl p-8 text-center bg-[#FAF8F5] hover:bg-slate-50 transition-colors">
                  <Upload className="w-8 h-8 text-[#C9A84C] mx-auto mb-2" />
                  <p className="font-bold text-sm text-[#081428]">Select Excel (.xlsx, .xls) or CSV File</p>
                  <p className="text-slate-400 text-xs mt-1">Uploaded records remain unassigned for sales advisors to claim</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="mt-4 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#081428] file:text-[#C9A84C] hover:file:bg-[#122444] cursor-pointer"
                  />
                </div>

                {importing && (
                  <div className="flex items-center justify-center gap-2 text-[#081428] font-semibold py-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C9A84C]" />
                    <span>Auditing duplicates against Owner Data database & catalogs...</span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: PREVIEW, DUPLICATE AUDIT & CATALOG STANDARDIZATION */}
            {importStep === 'preview' && importPreviewData && (
              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Target Category Confirmation in Preview */}
                <div className="p-3 bg-gradient-to-r from-[#FAF8F5] to-amber-50/50 border border-[#E8E2D9] rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#081428] uppercase tracking-wider">Target Category:</span>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-200 rounded-md font-bold text-xs">
                      💼 {selectedImportCategory}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedImportCategory}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setShowNewCategoryModal(true);
                        } else {
                          setSelectedImportCategory(e.target.value);
                        }
                      }}
                      className="px-2 py-1 bg-white border border-[#E8E2D9] rounded text-xs font-semibold text-[#081428] cursor-pointer"
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__add_new__">+ Add New...</option>
                    </select>
                  </div>
                </div>

                {/* Auto-Mapped Notification Banner */}
                {Boolean(importPreviewData?.auto_mapped_count && importPreviewData.auto_mapped_count > 0) && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>{importPreviewData.auto_mapped_count} catalog {importPreviewData.auto_mapped_count === 1 ? 'value' : 'values'}</strong> automatically standardized with high confidence.
                      </span>
                    </div>
                  </div>
                )}

                {/* 1. Summary Metric Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#E8E2D9] text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Records in File</span>
                    <div className="text-xl font-extrabold text-[#081428] mt-0.5">{importPreviewData.total_records}</div>
                  </div>
                  <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 text-center">
                    <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-semibold">Unique / Safe to Import</span>
                    <div className="text-xl font-extrabold text-emerald-800 mt-0.5">{importPreviewData.new_count ?? 0}</div>
                  </div>
                  <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 text-center">
                    <span className="text-[10px] text-amber-700 uppercase tracking-wider font-semibold">Duplicates Detected</span>
                    <div className="text-xl font-extrabold text-amber-900 mt-0.5">{importPreviewData.duplicate_count ?? 0}</div>
                    {(importPreviewData.duplicate_count ?? 0) > 0 && (
                      <div className="text-[10px] font-semibold mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                        {(importPreviewData.db_duplicate_count ?? 0) > 0 && (
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">
                            {importPreviewData.db_duplicate_count} in Owner Data
                          </span>
                        )}
                        {(importPreviewData.file_duplicate_count ?? 0) > 0 && (
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                            {importPreviewData.file_duplicate_count} in File
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Duplicate Handling Strategy Selector */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-[#081428] uppercase tracking-wider">
                    Duplicate Resolution Strategy
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      ownerDuplicateMode === 'skip'
                        ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-400'
                        : 'border-[#E8E2D9] hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="ownerDuplicateMode"
                        value="skip"
                        checked={ownerDuplicateMode === 'skip'}
                        onChange={() => setOwnerDuplicateMode('skip')}
                        className="mt-1 accent-emerald-600"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#081428]">Skip Duplicates</span>
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">Recommended</span>
                        </div>
                        <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                          Import only the <strong className="text-[#081428]">{importPreviewData.new_count ?? 0} unique records</strong>. All {importPreviewData.duplicate_count ?? 0} duplicates ({importPreviewData.db_duplicate_count || 0} already in Owner Data, {importPreviewData.file_duplicate_count || 0} repeated in file) will be skipped.
                        </p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      ownerDuplicateMode === 'update'
                        ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-400'
                        : 'border-[#E8E2D9] hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="ownerDuplicateMode"
                        value="update"
                        checked={ownerDuplicateMode === 'update'}
                        onChange={() => setOwnerDuplicateMode('update')}
                        className="mt-1 accent-blue-600"
                      />
                      <div>
                        <div className="font-bold text-[#081428]">Update Existing Contact & Property Info</div>
                        <p className="text-[11px] text-[#6E6E6E] mt-0.5">
                          Import {importPreviewData.new_count ?? 0} new records and update details (phones, email, bedrooms, notes) for {importPreviewData.db_duplicate_count || 0} matching records already in Owner Data.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. Collapsible Duplicates Audit Table */}
                {(importPreviewData.duplicates?.length ?? 0) > 0 && (
                  <div className="space-y-2 border border-[#E8E2D9] rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-[#081428] text-xs">
                          Duplicate Records Audit ({importPreviewData.duplicates?.length} items)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDuplicatesTable(!showDuplicatesTable)}
                        className="text-xs font-semibold text-[#C9A84C] hover:text-[#081428] underline cursor-pointer"
                      >
                        {showDuplicatesTable ? 'Hide Audit Table ▲' : 'Inspect Duplicate Records ▼'}
                      </button>
                    </div>

                    {showDuplicatesTable && (
                      <div className="max-h-56 overflow-y-auto bg-white border border-[#E8E2D9] rounded-lg mt-2">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="border-b border-[#E8E2D9] text-[#6E6E6E] bg-slate-50 sticky top-0">
                              <th className="p-2 w-12">Row</th>
                              <th className="p-2">Owner Name</th>
                              <th className="p-2">Phone / Email</th>
                              <th className="p-2">Unit & Building</th>
                              <th className="p-2">Duplicate Source</th>
                              <th className="p-2">Matched Info / Existing Record</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E8E2D9]">
                            {importPreviewData.duplicates?.map((dup) => (
                              <tr key={dup.row_index} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2 font-bold text-slate-500">#{dup.row_index}</td>
                                <td className="p-2 font-semibold text-[#081428]">{dup.owner_name}</td>
                                <td className="p-2 font-mono text-slate-700">
                                  <div>{dup.phone || '-'}</div>
                                  {dup.email && <div className="text-[10px] text-slate-500">{dup.email}</div>}
                                </td>
                                <td className="p-2 text-slate-700">
                                  <div>{dup.property_number ? `Unit ${dup.property_number}` : '-'}</div>
                                  <div className="text-[10px] text-slate-500">{dup.building_name || dup.area || ''}</div>
                                </td>
                                <td className="p-2">
                                  {dup.duplicate_source === 'database' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                      Already in Owner Data
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                      Duplicate in File
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 text-[#081428] font-medium text-[11px]">
                                  {dup.matched_with}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Master Catalogs Standardization (Collapsible if unmatched exists) */}
                {importPreviewData.has_unmatched && (
                  <div className="space-y-2 border border-[#E8E2D9] rounded-lg p-3 bg-amber-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#C9A84C]" />
                        <span className="font-bold text-[#081428] text-xs">
                          Catalog Standardization Options (Area, Project, Type)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCatalogMappings(!showCatalogMappings)}
                        className="text-xs font-semibold text-[#081428] hover:text-[#C9A84C] underline cursor-pointer"
                      >
                        {showCatalogMappings ? 'Collapse Catalogs ▲' : 'Review & Map Catalogs ▼'}
                      </button>
                    </div>

                    {showCatalogMappings && (
                      <div className="space-y-3 pt-2">
                        {/* Category Filter Tabs */}
                        <div className="flex items-center gap-2 border-b border-[#E8E2D9] pb-2 overflow-x-auto">
                          {[
                            { key: 'all', label: 'All Unmatched' },
                            { key: 'community', label: 'Communities / Areas', count: importPreviewData.unmatched?.community?.length || 0 },
                            { key: 'project', label: 'Projects / Buildings', count: importPreviewData.unmatched?.project?.length || 0 },
                            { key: 'property_type', label: 'Property Types', count: importPreviewData.unmatched?.property_type?.length || 0 },
                          ].map((tab) => {
                            const isActive = ownerMappingCategoryTab === tab.key;
                            return (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => setOwnerMappingCategoryTab(tab.key as any)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                  isActive
                                    ? 'bg-[#081428] text-[#C9A84C] shadow-2xs'
                                    : 'bg-white border border-[#E8E2D9] text-[#6E6E6E] hover:text-[#081428]'
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

                        {/* Mapping Rows List */}
                        <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                          {['community', 'project', 'property_type']
                            .filter((cat) => ownerMappingCategoryTab === 'all' || ownerMappingCategoryTab === cat)
                            .flatMap((cat) => (importPreviewData.unmatched?.[cat] || []).map((item) => ({ ...item, category: cat })))
                            .map((item) => {
                              const key = `${item.category}::${item.file_value}`;
                              const currentAction = ownerMappingActions[key] || 'keep';
                              const targetVal = ownerValueMappings[item.category]?.[item.file_value] || '';
                              const catalogOptions = importPreviewData.catalogs?.[item.category] || [];

                              const categoryLabels: Record<string, string> = {
                                community: 'Area / Community',
                                project: 'Building / Project',
                                property_type: 'Property Type',
                              };

                              return (
                                <div
                                  key={key}
                                  className="p-3 bg-white border border-[#E8E2D9] rounded-lg shadow-2xs space-y-2 hover:border-[#C9A84C]/50 transition-colors"
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

                                    {item.suggested_match && (
                                      <div className="flex items-center gap-1 text-[11px]">
                                        <span className="text-[#6E6E6E]">Suggested:</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOwnerMappingActions((prev) => ({ ...prev, [key]: 'map' }));
                                            setOwnerValueMappings((prev) => ({
                                              ...prev,
                                              [item.category]: {
                                                ...prev[item.category],
                                                [item.file_value]: item.suggested_match,
                                              },
                                            }));
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded cursor-pointer transition-colors text-[10px]"
                                        >
                                          <span>🎯 {item.suggested_match}</span>
                                          <span className="text-emerald-600 font-mono">({item.confidence}%)</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                                    <label className={`flex flex-col gap-1 p-2 rounded border cursor-pointer ${
                                      currentAction === 'map' ? 'bg-amber-50/50 border-[#C9A84C]' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#081428]">
                                        <input
                                          type="radio"
                                          name={`owner_action_${key}`}
                                          checked={currentAction === 'map'}
                                          onChange={() => {
                                            setOwnerMappingActions((prev) => ({ ...prev, [key]: 'map' }));
                                            if (!targetVal && item.suggested_match) {
                                              setOwnerValueMappings((prev) => ({
                                                ...prev,
                                                [item.category]: {
                                                  ...prev[item.category],
                                                  [item.file_value]: item.suggested_match,
                                                },
                                              }));
                                            } else if (!targetVal && catalogOptions.length > 0) {
                                              setOwnerValueMappings((prev) => ({
                                                ...prev,
                                                [item.category]: {
                                                  ...prev[item.category],
                                                  [item.file_value]: catalogOptions[0],
                                                },
                                              }));
                                            }
                                          }}
                                          className="accent-[#C9A84C]"
                                        />
                                        <span>Map to Catalog</span>
                                      </div>
                                      {currentAction === 'map' && (
                                        <select
                                          value={targetVal}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setOwnerValueMappings((prev) => ({
                                              ...prev,
                                              [item.category]: {
                                                ...prev[item.category],
                                                [item.file_value]: v,
                                              },
                                            }));
                                          }}
                                          className="w-full text-[11px] px-2 py-1 bg-white border border-[#E8E2D9] rounded focus:border-[#C9A84C] font-medium mt-1"
                                        >
                                          {catalogOptions.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      )}
                                    </label>

                                    <label className={`flex flex-col gap-1 p-2 rounded border cursor-pointer ${
                                      currentAction === 'new' ? 'bg-emerald-50/50 border-emerald-400' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#081428]">
                                        <input
                                          type="radio"
                                          name={`owner_action_${key}`}
                                          checked={currentAction === 'new'}
                                          onChange={() => setOwnerMappingActions((prev) => ({ ...prev, [key]: 'new' }))}
                                          className="accent-emerald-600"
                                        />
                                        <span className="text-emerald-800">+ Add to Catalog</span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 pl-4">Registers new setting</span>
                                    </label>

                                    <label className={`flex flex-col gap-1 p-2 rounded border cursor-pointer ${
                                      currentAction === 'keep' ? 'bg-slate-100 border-slate-400' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#081428]">
                                        <input
                                          type="radio"
                                          name={`owner_action_${key}`}
                                          checked={currentAction === 'keep'}
                                          onChange={() => setOwnerMappingActions((prev) => ({ ...prev, [key]: 'keep' }))}
                                          className="accent-slate-600"
                                        />
                                        <span>Keep Raw String</span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 pl-4">Stores raw as-is</span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Unassigned Notification Note */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center gap-2 text-[11px] text-blue-900">
                  <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Claim Protection Active:</strong> Imported records will remain <strong>Unassigned</strong> so that sales advisors can manually claim their own properties.
                  </span>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E8E2D9] shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setImportStep('upload');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3.5 py-2 bg-white border border-[#E8E2D9] text-[#6E6E6E] font-bold rounded hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to File</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmOwnerMappingAndImport}
                    disabled={importing}
                    className="px-5 py-2 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold rounded shadow-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {importing && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>{importing ? 'Importing Records...' : `Confirm & Import ${parsedImportRows.length} Records`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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

                </div>
              </div>

              <div className="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E8E2D9] space-y-2.5">
                <div className="text-[11px] font-bold text-[#7A7A7A] uppercase tracking-wider">Owner Contact Info</div>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Primary Phone:
                    </span>
                    <span className="font-mono font-bold text-[#081428]">{viewRecord.mobile_number || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Secondary Phone:
                    </span>
                    <span className="font-mono font-bold text-[#081428]">{viewRecord.phone_number || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
                    </span>
                    <span className="font-medium text-[#081428]">{viewRecord.email || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" /> Category:
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                      💼 {viewRecord.category || 'Business Executives'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#E8E2D9]">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <UserCheck className="w-3.5 h-3.5 text-[#C9A84C]" /> Assigned Advisor:
                    </span>
                    <span className="font-bold text-[#081428]">
                      {viewRecord.assigned_to && viewRecord.assigned_to !== 'Unassigned' ? (
                        <span className="px-2 py-0.5 rounded bg-[#081428] text-[#C9A84C] text-[10px] font-bold">
                          {viewRecord.assigned_to}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unassigned</span>
                      )}
                    </span>
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

      {/* 8. QUICK NEW CATEGORY MODAL (For Real-Time Extensibility) */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E8E2D9] max-w-sm w-full p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-[#081428] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C9A84C]" />
                <span>Create New Owner Category</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Enter category name (e.g., VIP Investors, Commercial Owners). It will be saved permanently in the CRM for future imports and filtering.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. VIP Investors, Commercial Landlords..."
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewCategory(newCategoryInput);
                }
              }}
              className="w-full p-2.5 border border-[#E8E2D9] rounded-lg text-xs font-semibold text-[#081428] focus:border-[#C9A84C] focus:outline-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewCategoryModal(false)}
                className="px-3 py-1.5 border border-[#E8E2D9] rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAddNewCategory(newCategoryInput)}
                disabled={!newCategoryInput.trim()}
                className="px-4 py-1.5 bg-[#081428] text-[#C9A84C] rounded-lg text-xs font-bold hover:bg-[#122444] transition-colors cursor-pointer disabled:opacity-50"
              >
                Save & Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
