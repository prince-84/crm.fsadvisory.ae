'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi, API_BASE_URL } from '@/lib/api';
import { 
  Mic, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Download, 
  Search, 
  Filter, 
  Clock, 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOutgoing, 
  User, 
  Phone, 
  Briefcase, 
  ChevronRight, 
  ChevronLeft, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  Sparkles, 
  Radio, 
  Flame,
  FileAudio,
  Settings,
  HelpCircle,
  Copy,
  ExternalLink,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';

// 5 exact 3CX Users & Extensions from 3CX Console
const PBX_USERS = [
  { ext: '1030', name: 'Mako Real Estate', email: 'mako@salwaproperties.com', dept: 'Real Estate, All', role: 'Manager' },
  { ext: '1031', name: 'Shafi Core', email: 'shafi@coreunitysolutions.com', dept: 'coreunitysolutions, All', role: 'Advisor' },
  { ext: '1033', name: 'Hiba Alam', email: 'hiba@fsadvisory.ae', dept: 'fs advisory, All', role: 'Advisor' },
  { ext: '1034', name: 'Rayyan', email: 'rayyan@fsadvisory.ae', dept: 'fsadvisory2, All', role: 'Advisor' },
  { ext: '1035', name: 'FA Advisory 3', email: 'admin@fsadvisory.ae', dept: 'fsadvisory3, All', role: 'Advisor' },
];

export default function CallRecordingsPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total_recordings: 0,
    total_talk_time_minutes: 0,
    total_talk_time_hours: 0,
    avg_duration_formatted: '00:00',
    inbound_count: 0,
    outbound_count: 0,
    positive_sentiment_count: 0,
    user_stats: [],
  });
  const [pbxStatus, setPbxStatus] = useState<any>({
    server_host: '3cx.fsadvisory.ae',
    gateway_status: 'ONLINE',
    active_users_count: 5,
    webhook_url: `${API_BASE_URL}/3cx/call-event`,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedExtToSync, setSelectedExtToSync] = useState('1030');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedDuration, setSelectedDuration] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [paginationMeta, setPaginationMeta] = useState({
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0,
    total: 0,
  });

  // Audio Player State
  const [activeRecording, setActiveRecording] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadRecordings = async (page = currentPage, limit = perPage) => {
    setLoading(true);
    try {
      let endpoint = `/recordings?page=${page}&per_page=${limit}`;
      if (selectedDirection !== 'all') endpoint += `&direction=${selectedDirection}`;
      if (selectedAgent !== 'all') endpoint += `&agent_name=${encodeURIComponent(selectedAgent)}`;
      if (selectedDuration !== 'all') endpoint += `&duration_filter=${selectedDuration}`;
      if (searchQuery) endpoint += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetchApi(endpoint);
      if (res.recordings) {
        setRecordings(res.recordings.data || []);
        setPaginationMeta({
          current_page: res.recordings.current_page || page,
          last_page: res.recordings.last_page || 1,
          from: res.recordings.from || 0,
          to: res.recordings.to || 0,
          total: res.recordings.total || 0,
        });
      }
      if (res.stats) setStats(res.stats);
      if (res.pbx_status) setPbxStatus(res.pbx_status);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load 3CX recordings:', err);
      setRecordings([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadRecordings(1, perPage);
  }, [selectedDirection, selectedAgent, selectedDuration, searchQuery]);

  const [importingCsv, setImportingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csv_file', file);

    setImportingCsv(true);
    try {
      const data = await fetchApi('/3cx/import-csv', {
        method: 'POST',
        body: formData,
      });

      Swal.fire({
        icon: 'success',
        title: '3CX Call Logs Imported!',
        text: `Successfully imported ${data.imported_count || 0} calls from 3CX into CRM.`,
        confirmButtonColor: '#081428',
      });
      loadRecordings();
    } catch (err: any) {
      Swal.fire('Import Error', err.message || 'Failed to import 3CX CSV.', 'error');
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleAttachAudio = async (recId: number, file: File) => {
    const formData = new FormData();
    formData.append('audio_file', file);
    try {
      const data = await fetchApi(`/recordings/${recId}/attach-audio`, {
        method: 'POST',
        body: formData,
      });
      Swal.fire({
        icon: 'success',
        title: 'WAV Audio Attached!',
        text: 'Voice recording attached! Press Play to listen.',
        timer: 2000,
        showConfirmButton: false,
      });
      loadRecordings();
    } catch (err: any) {
      Swal.fire('Upload Error', err.message || 'Failed to upload audio file', 'error');
    }
  };

  const handleSync3cx = async () => {
    setSyncing(true);
    try {
      const res = await fetchApi('/recordings/sync-3cx', {
        method: 'POST',
        body: JSON.stringify({ extension: selectedExtToSync }),
      });
      Swal.fire({
        icon: 'success',
        title: '3CX Call Synchronized!',
        text: res.message || 'Latest call recording ingested from 3CX Gateway.',
        confirmButtonColor: '#081428',
      });
      setSyncing(false);
      loadRecordings();
    } catch (err: any) {
      Swal.fire('Sync Error', err.message || 'Failed to sync with 3CX server.', 'error');
      setSyncing(false);
    }
  };

  // Audio Playback Controls & Progress Ticker
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && activeRecording) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const maxDur = duration || activeRecording.duration_seconds || 133;
          const next = prev + 1;
          if (next >= maxDur) {
            setIsPlaying(false);
            return maxDur;
          }
          return next;
        });
      }, 1000 / playbackSpeed);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration, playbackSpeed, activeRecording]);

  const handlePlayRecording = (rec: any) => {
    if (activeRecording?.id === rec.id) {
      if (isPlaying) {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();
      } else {
        setIsPlaying(true);
        if (audioRef.current && rec.audio_url && rec.audio_url.startsWith('http')) {
          audioRef.current.play().catch(() => {});
        }
      }
    } else {
      setActiveRecording(rec);
      setIsPlaying(true);
      setCurrentTime(0);
      const recDur = rec.duration_seconds || 133;
      setDuration(recDur);
      if (audioRef.current && rec.audio_url) {
        audioRef.current.src = rec.audio_url;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.currentTime > 0) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatDisplayPhone = (rawPhone: string) => {
    if (!rawPhone) return 'Direct Caller';
    let clean = String(rawPhone).trim();
    if (clean.startsWith('00')) {
      clean = '+' + clean.substring(2);
    } else if (!clean.startsWith('+')) {
      if (clean.startsWith('05') || clean.startsWith('5')) {
        clean = '+971' + (clean.startsWith('0') ? clean.substring(1) : clean);
      } else if (clean.startsWith('971')) {
        clean = '+' + clean;
      }
    }

    // Format specific country prefixes with clean spacing
    if (clean.startsWith('+971')) {
      const rest = clean.substring(4).replace(/\s+/g, '');
      if (rest.length === 9) {
        return `+971 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
      }
      return `+971 ${rest}`;
    }
    if (clean.startsWith('+44')) {
      const rest = clean.substring(3).replace(/\s+/g, '');
      if (rest.length >= 9) {
        return `+44 ${rest.slice(0, 4)} ${rest.slice(4)}`;
      }
      return `+44 ${rest}`;
    }
    if (clean.startsWith('+92')) {
      const rest = clean.substring(3).replace(/\s+/g, '');
      if (rest.length >= 10) {
        return `+92 ${rest.slice(0, 3)} ${rest.slice(3)}`;
      }
      return `+92 ${rest}`;
    }
    if (clean.startsWith('+353')) {
      const rest = clean.substring(4).replace(/\s+/g, '');
      return `+353 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
    }
    return clean;
  };

  const cleanCallSummary = (notes: string, aiSummary: string, clientPhone: string) => {
    const formatted = formatDisplayPhone(clientPhone);
    let text = notes || aiSummary || '';
    if (!text) {
      return `3CX Call Discussion with ${formatted}. Logged automatically.`;
    }
    text = text.replace(/Client\s+([0-9+]+)\s*\(\1\)/gi, `Client ${formatted}`);
    text = text.replace(/Client\s+([0-9+]+)/gi, `Client ${formatted}`);
    text = text.replace(/\(([0-9+]{8,15})\)\s*\(\1\)/gi, `(${formatted})`);
    return text;
  };

  const getOutcomeBadgeStyle = (outcome: string) => {
    const lower = (outcome || '').toLowerCase();
    if (lower.includes('schedule') || lower.includes('viewing') || lower.includes('contract')) {
      return 'bg-amber-100 text-amber-900 border border-amber-300';
    }
    if (lower.includes('callback') || lower.includes('follow-up')) {
      return 'bg-blue-100 text-blue-900 border border-blue-300';
    }
    if (lower.includes('qualified') || lower.includes('completed') || lower.includes('consultation')) {
      return 'bg-emerald-100 text-emerald-900 border border-emerald-300';
    }
    return 'bg-slate-100 text-slate-800 border border-slate-200';
  };

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > paginationMeta.last_page) return;
    setCurrentPage(newPage);
    loadRecordings(newPage, perPage);
  };

  const handlePerPageChange = (newLimit: number) => {
    setPerPage(newLimit);
    setCurrentPage(1);
    loadRecordings(1, newLimit);
  };

  const handleCopyWebhook = () => {
    const url = `${API_BASE_URL}/3cx/call-event`;
    navigator.clipboard.writeText(url);
    Swal.fire({
      icon: 'success',
      title: 'Copied to Clipboard!',
      text: '3CX Webhook Ingestion URL copied.',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const isFilterActive = searchQuery !== '' || selectedDirection !== 'all' || selectedAgent !== 'all' || selectedDuration !== 'all';

  const getPageNumbers = () => {
    const totalPages = paginationMeta.last_page;
    const current = paginationMeta.current_page;
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex pb-28">
      {/* Audio element for playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        src={activeRecording?.audio_url || 'https://actions.google.com/sounds/v1/ambiences/office_murmur.ogg'}
      />

      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E8E4DC] pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8A147] uppercase tracking-wider mb-1">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>07 — 3CX Phone System & Call Recordings</span>
              </div>
              <h1 className="font-heading font-bold text-2xl text-[#081428]">
                3CX Call Recordings & Audio Intelligence
              </h1>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Centralized repository of all inbound and outbound client phone recordings synchronized from 3CX IP-PBX Gateway for 5 active extensions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Hidden CSV File Input */}
              <input
                type="file"
                ref={csvInputRef}
                onChange={handleImportCsv}
                accept=".csv,text/csv"
                className="hidden"
              />

              {/* Import 3CX CSV Button */}
              <button
                onClick={() => csvInputRef.current?.click()}
                disabled={importingCsv}
                className="px-3 py-2 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer border border-[#C8A147]/40"
                title="Export Call Reports CSV from 3CX and upload here to import all call history"
              >
                <Upload className={`w-3.5 h-3.5 text-[#C8A147] ${importingCsv ? 'animate-bounce' : ''}`} />
                <span>{importingCsv ? 'Importing CSV...' : '📥 Import 3CX Call Reports (CSV)'}</span>
              </button>

              {/* PBX Setup Modal Button */}
              <button
                onClick={() => setIsSetupModalOpen(true)}
                className="px-3 py-2 bg-white border border-[#E8E4DC] hover:bg-slate-50 text-[#081428] font-bold text-xs rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>3CX Webhook Setup</span>
              </button>

              {/* Extension Select & Ingest Button */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E8E4DC] p-1 rounded-md">
                <select
                  value={selectedExtToSync}
                  onChange={(e) => setSelectedExtToSync(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#081428] focus:outline-none p-1 cursor-pointer"
                >
                  <option value="1030">Ext 1030 (Mako)</option>
                  <option value="1031">Ext 1031 (Shafi)</option>
                  <option value="1033">Ext 1033 (Hiba)</option>
                  <option value="1034">Ext 1034 (Rayyan)</option>
                  <option value="1035">Ext 1035 (FA Admin)</option>
                </select>

                <button
                  onClick={handleSync3cx}
                  disabled={syncing}
                  className="px-3 py-1.5 bg-[#081428] hover:bg-[#122444] text-[#C8A147] font-bold text-xs rounded shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#C8A147] ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Ingesting...' : 'Sync Call'}</span>
                </button>
              </div>
            </div>
          </div>


          {/* 4 Top KPI Stat Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-[#6E6E6E] uppercase tracking-wider">Total Recorded Calls</div>
              <div className="font-heading text-2xl font-bold text-[#081428] mt-1">
                {stats.total_recordings || paginationMeta.total}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Across 5 active extensions</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Total Talk Time</div>
              <div className="font-heading text-2xl font-bold text-amber-800 mt-1">
                {stats.total_talk_time_minutes || 0} Mins
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">Approx {stats.total_talk_time_hours || 0} hours total</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Average Duration</div>
              <div className="font-heading text-2xl font-bold text-blue-800 mt-1">
                {stats.avg_duration_formatted || '03:45'}
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">Per conversation session</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs">
              <div className="text-[10px] font-bold text-[#C8A147] uppercase tracking-wider">Call Breakdown</div>
              <div className="font-heading text-lg font-bold text-[#081428] mt-1">
                {stats.outbound_count} Outbound · {stats.inbound_count} Inbound
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                {stats.positive_sentiment_count} High-intent discussions
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-3 bg-white border border-[#E8E4DC] rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Search */}
              <div className="flex items-center gap-2 w-64 bg-[#FAF8F5] border border-[#E8E4DC] rounded px-2.5 py-1.5 focus-within:border-[#C8A147] focus-within:bg-white transition-colors shrink-0">
                <Search className="w-3.5 h-3.5 text-[#6E6E6E] shrink-0" />
                <input
                  type="text"
                  placeholder="Search 3CX ID, client, phone, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none focus:outline-none text-xs text-[#1A1A1A] placeholder-[#6E6E6E]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Direction Filter */}
              <select
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Directions</option>
                <option value="outbound">Outbound Calls 📤</option>
                <option value="inbound">Inbound Calls 📥</option>
              </select>

              {/* Agent Filter (5 3CX Users) */}
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All 5 3CX Advisors</option>
                <option value="Mako Real Estate">Mako Real Estate (Ext 1030)</option>
                <option value="Shafi Core">Shafi Core (Ext 1031)</option>
                <option value="Hiba Alam">Hiba Alam (Ext 1033)</option>
                <option value="Rayyan">Rayyan (Ext 1034)</option>
                <option value="FA Advisory 3">FA Advisory 3 (Ext 1035)</option>
              </select>

              {/* Duration Filter */}
              <select
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(e.target.value)}
                className="p-1.5 bg-[#FAF8F5] border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-semibold focus:border-[#C8A147] focus:outline-none cursor-pointer"
              >
                <option value="all">All Call Durations</option>
                <option value="short">Short (&lt; 1 min)</option>
                <option value="medium">Medium (1 – 5 mins)</option>
                <option value="long">Long (&gt; 5 mins)</option>
              </select>

              {isFilterActive && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDirection('all');
                    setSelectedAgent('all');
                    setSelectedDuration('all');
                  }}
                  className="text-xs text-[#C8A147] font-bold hover:underline px-1 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="text-[11px] font-medium text-[#6E6E6E] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#C8A147]" />
              <span>Showing {paginationMeta.total} 3CX Recordings</span>
            </div>
          </div>

          {/* Recordings Master Table */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E8E4DC] text-[#6E6E6E] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="p-3 pl-4 w-12 text-center">Audio</th>
                    <th className="p-3">3CX Call ID & Date</th>
                    <th className="p-3">Direction</th>
                    <th className="p-3">3CX User & Ext</th>
                    <th className="p-3">Client Contact</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Outcome & AI Key Summary</th>
                    <th className="p-3">Linked Deal</th>
                    <th className="p-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8E4DC]">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[#6E6E6E]">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#C8A147] mb-2" />
                        <span>Loading 3CX call recordings...</span>
                      </td>
                    </tr>
                  ) : recordings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-[#6E6E6E] space-y-2">
                        <FileAudio className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="font-bold text-sm text-[#081428]">No Call Recordings Found</div>
                        <p className="text-xs text-[#6E6E6E]">Click "Sync Call" to fetch recordings from 3CX PBX.</p>
                      </td>
                    </tr>
                  ) : (
                    recordings.map((rec) => {
                      const contact = rec.contact || {};
                      const opp = rec.opportunity || {};
                      const isThisActive = activeRecording?.id === rec.id;
                      const isCurrentlyPlaying = isThisActive && isPlaying;

                      const isOutbound = rec.direction === 'outbound';
                      const clientRawNumber = isOutbound
                        ? (rec.destination_number || rec.caller_number)
                        : (rec.caller_number || rec.destination_number);
                      const clientFormatted = formatDisplayPhone(clientRawNumber);

                      const pbxAgent = PBX_USERS.find((u) => u.ext === String(rec.agent_extension));
                      const advisorDisplayName = (rec.agent_name && rec.agent_name !== 'Advisor')
                        ? rec.agent_name
                        : (pbxAgent?.name || 'Mako Real Estate');

                      return (
                        <tr
                          key={rec.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isThisActive ? 'bg-amber-50/40 border-l-4 border-l-[#C8A147]' : ''
                          }`}
                        >
                          {/* Play Button */}
                          <td className="p-3 pl-4 text-center">
                            <button
                              onClick={() => handlePlayRecording(rec)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-2xs cursor-pointer ${
                                isCurrentlyPlaying
                                  ? 'bg-[#C8A147] text-[#081428] ring-2 ring-[#C8A147]/50'
                                  : 'bg-[#081428] text-white hover:bg-[#122444]'
                              }`}
                              title={isCurrentlyPlaying ? 'Pause Audio' : 'Play 3CX Audio'}
                            >
                              {isCurrentlyPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>
                          </td>

                          {/* 3CX ID & Date */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-mono font-bold text-[#081428] text-xs">
                              {rec.pbx_call_id}
                            </div>
                            <div className="text-[10px] text-[#6E6E6E]">
                              {rec.recorded_at ? new Date(rec.recorded_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </div>
                          </td>

                          {/* Direction */}
                          <td className="p-3 whitespace-nowrap">
                            {rec.direction === 'inbound' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1 w-fit">
                                <PhoneIncoming className="w-2.5 h-2.5" />
                                <span>Inbound 📥</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                                <PhoneOutgoing className="w-2.5 h-2.5" />
                                <span>Outbound 📤</span>
                              </span>
                            )}
                          </td>

                          {/* 3CX User & Ext */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-semibold text-[#081428] flex items-center gap-1">
                              <User className="w-3 h-3 text-[#C8A147]" />
                              <span>{advisorDisplayName}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              3CX Ext: <strong className="text-[#081428]">{rec.agent_extension || '1030'}</strong>
                            </div>
                          </td>

                          {/* Client Contact */}
                          <td className="p-3">
                            <div className="font-bold text-[#081428] flex items-center gap-1.5 flex-wrap">
                              <span>{contact.name || `Client (${clientFormatted})`}</span>
                              {contact.id && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Lead
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-[#6E6E6E] flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              <span>{clientFormatted}</span>
                            </div>
                          </td>

                          {/* Duration */}
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-mono font-bold text-xs text-[#081428] bg-slate-100 px-2 py-0.5 rounded w-fit">
                              {formatSeconds(rec.duration_seconds)}
                            </div>
                          </td>

                          {/* Outcome & AI Summary */}
                          <td className="p-3 max-w-md">
                            <div className="font-semibold text-xs text-[#081428] flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getOutcomeBadgeStyle(rec.call_outcome)}`}>
                                {rec.call_outcome || 'Discussion'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                              {cleanCallSummary(rec.notes, rec.ai_summary, clientRawNumber)}
                            </p>
                          </td>

                          {/* Linked Deal */}
                          <td className="p-3 whitespace-nowrap">
                            {opp.id ? (
                              <Link
                                href={`/opportunities/${opp.id}`}
                                className="font-bold text-[#081428] hover:text-[#C8A147] hover:underline flex items-center gap-1"
                              >
                                <Briefcase className="w-3 h-3 text-[#C8A147]" />
                                <span>Opportunity #{opp.id}</span>
                              </Link>
                            ) : contact.id ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Contact Record
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Direct {isOutbound ? 'Outbound' : 'Inbound'} Lead</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 pr-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handlePlayRecording(rec)}
                                className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E8E4DC] hover:bg-slate-100 text-[#081428] font-semibold text-xs rounded transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span>{isCurrentlyPlaying ? 'Pause' : 'Listen'}</span>
                              </button>

                              {/* Attach WAV from 3CX */}
                              <label
                                className="p-1.5 text-slate-500 hover:text-[#C8A147] hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                title="Attach 3CX .WAV Audio Recording"
                              >
                                <input
                                  type="file"
                                  accept=".wav,.mp3,.ogg,.m4a,audio/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAttachAudio(rec.id, f);
                                  }}
                                  className="hidden"
                                />
                                <Upload className="w-3.5 h-3.5" />
                              </label>

                              <a
                                href={rec.audio_url || '#'}
                                target="_blank"
                                download={`3CX-${rec.pbx_call_id}.wav`}
                                className="p-1.5 text-slate-500 hover:text-[#081428] hover:bg-slate-100 rounded transition-colors"
                                title="Download WAV Recording"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E4DC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6E6E]">
              <div>
                Showing <span className="font-bold text-[#081428]">{paginationMeta.from || 0}</span> to{' '}
                <span className="font-bold text-[#081428]">{paginationMeta.to || 0}</span> of{' '}
                <span className="font-bold text-[#081428]">{Number(paginationMeta.total || 0).toLocaleString()}</span> recordings
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

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
                      onClick={() => handlePageChange(p as number)}
                      disabled={loading}
                      className={`w-7 h-7 rounded text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? 'font-bold bg-[#C8A147] text-white shadow-xs'
                          : 'font-medium border border-[#E8E4DC] hover:bg-white text-[#1A1A1A]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= paginationMeta.last_page || loading}
                  className="p-1.5 border border-[#E8E4DC] rounded hover:bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <select
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
                className="p-1.5 bg-white border border-[#E8E4DC] rounded text-xs text-[#1A1A1A] font-medium cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </main>
      </div>

      {/* STICKY BOTTOM AUDIO PLAYER */}
      {activeRecording && (() => {
        const activeClientNum = activeRecording.direction === 'outbound'
          ? (activeRecording.destination_number || activeRecording.caller_number)
          : (activeRecording.caller_number || activeRecording.destination_number);
        const formattedActiveClient = formatDisplayPhone(activeClientNum);
        const activePbxUser = PBX_USERS.find(u => u.ext === String(activeRecording.agent_extension));
        const activeAdvisorName = (activeRecording.agent_name && activeRecording.agent_name !== 'Advisor')
          ? activeRecording.agent_name
          : (activePbxUser?.name || 'Mako Real Estate');

        return (
          <div className="fixed bottom-0 left-56 right-0 z-50 bg-[#081428] text-white border-t border-[#C8A147]/50 shadow-2xl p-3.5 px-6 animate-in slide-in-from-bottom duration-200">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left: Call Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#122444] border border-[#C8A147]/30 flex items-center justify-center text-[#C8A147] shrink-0">
                  <Mic className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-white truncate flex items-center gap-2">
                    <span>{activeRecording.contact?.name || `Client (${formattedActiveClient})`}</span>
                    <span className="text-[10px] font-mono text-[#C8A147]">({activeRecording.pbx_call_id})</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                      activeRecording.direction === 'outbound'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                        : 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                    }`}>
                      {activeRecording.direction === 'outbound' ? 'Outbound 📤' : 'Inbound 📥'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate mt-0.5">
                    3CX Advisor: <strong className="text-white font-semibold">{activeAdvisorName}</strong> (Ext {activeRecording.agent_extension || '1030'}) · <span className="text-[#C8A147]">{activeRecording.call_outcome || 'Discussion'}</span>
                  </div>
                </div>
              </div>

            {/* Center: Playback Controls & Scrubber */}
            <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePlayRecording(activeRecording)}
                  className="w-9 h-9 rounded-full bg-[#C8A147] hover:bg-[#b48e35] text-[#081428] font-bold flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* Progress Slider */}
              <div className="w-full flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>{formatSeconds(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 180}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#C8A147]"
                />
                <span>{formatSeconds(duration)}</span>
              </div>
            </div>

            {/* Right: Speed, Volume & Close */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 bg-[#122444] rounded p-0.5 text-[10px] font-bold font-mono">
                {[1, 1.25, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => handleSpeedChange(spd)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      playbackSpeed === spd ? 'bg-[#C8A147] text-[#081428]' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <button
                onClick={toggleMute}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  audioRef.current?.pause();
                  setIsPlaying(false);
                  setActiveRecording(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer"
                title="Close Player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );
    })()}

      {/* 3CX WEBHOOK SETUP INSTRUCTION MODAL */}
      {isSetupModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#081428]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E4DC] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-[#081428] p-4 text-white flex items-center justify-between border-b border-[#152744]">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#C8A147]" />
                <span className="font-heading font-bold text-sm">3CX Server Integration & Webhook Guide</span>
              </div>
              <button
                onClick={() => setIsSetupModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-[#1A1A1A] max-h-[520px] overflow-y-auto">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900">5 Active 3CX Extensions Mapped</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    Ext 1030 (Mako), Ext 1031 (Shafi Core), Ext 1033 (Hiba Alam), Ext 1034 (Rayyan), Ext 1035 (FA Advisory 3).
                  </div>
                </div>
              </div>

              {/* Webhook Endpoint */}
              <div className="space-y-1.5">
                <label className="block font-bold text-[#081428]">3CX Webhook / CDR Ingestion Endpoint</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${API_BASE_URL}/3cx/call-event`}
                    className="flex-1 p-2 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] text-[#081428] select-all"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="px-3 py-2 bg-[#081428] text-[#C8A147] font-bold rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </button>
                </div>
              </div>

              {/* Step by Step instructions */}
              <div className="space-y-2 border-t border-[#E8E4DC] pt-3">
                <div className="font-bold text-[#081428]">How to configure in 3CX Management Console:</div>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                  <li>Open your 3CX Console (<code>https://3cx.fsadvisory.ae</code>) &rarr; <strong>Settings</strong> &rarr; <strong>CRM Integration</strong>.</li>
                  <li>Select <strong>Server Side</strong> &rarr; <strong>Webhook / REST API</strong>.</li>
                  <li>Paste the Webhook URL above into the <strong>Call Report URL</strong> field.</li>
                  <li>Enable <strong>Post Call Recordings & Call Duration</strong> for extensions <code>1030, 1031, 1033, 1034, 1035</code>.</li>
                  <li>Click <strong>Save</strong>. All calls made by the 5 users will stream into this CRM automatically!</li>
                </ol>
              </div>

              {/* JSON Payload Spec */}
              <div className="space-y-1.5 border-t border-[#E8E4DC] pt-3">
                <div className="font-bold text-[#081428]">Sample JSON Payload sent by 3CX:</div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded text-[10px] font-mono overflow-x-auto">
{`{
  "CallId": "3CX-REC-20260829-9182",
  "AgentExtension": "1033",
  "CallerNumber": "+97143001033",
  "DestinationNumber": "+971501234567",
  "Direction": "outbound",
  "CallDuration": 245,
  "RecordingUrl": "https://3cx.fsadvisory.ae/recordings/rec-1033.wav",
  "CallNotes": "Client interested in Palm Jumeirah 2BR"
}`}
                </pre>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-[#E8E4DC]">
                <button
                  onClick={() => setIsSetupModalOpen(false)}
                  className="px-4 py-2 bg-[#081428] text-white font-bold rounded hover:bg-[#122444] transition-colors"
                >
                  Close Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
