'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Swal from 'sweetalert2';
import {
  Clock,
  CheckCircle2,
  ChevronDown,
  LogOut,
  User,
  ShieldCheck,
  Settings,
  MoreVertical,
  Mail,
  Crown
} from 'lucide-react';

const ROUTE_HEADINGS: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Leads',
    subtitle: 'Unified Leads Hub • Real-time Inbound, Cold Pool & Assigned Pipeline',
  },
  '/queue': {
    title: 'My Queue & Action Center',
    subtitle: 'Priority Calling & Telesales Follow-up Execution Desk',
  },
  '/owner-data': {
    title: 'Owner Data Pool',
    subtitle: 'Dubai Property Title Deed Registry & Owner Contacts',
  },
  '/opportunities': {
    title: 'Opportunities',
    subtitle: 'Sales Deals Pipeline & Revenue Management Workspace',
  },
  '/pipeline': {
    title: 'Pipeline Kanban',
    subtitle: 'Visual Opportunity Deal Stages & Stage Progression',
  },
  '/call-activity': {
    title: 'Call Activity',
    subtitle: '3CX Telephony PBX Logs & Call History',
  },
  '/calendar': {
    title: 'Appointments & Calendar',
    subtitle: 'Client Meetings, Site Viewings & Schedule',
  },
  '/appointments': {
    title: 'Appointments & Calendar',
    subtitle: 'Client Meetings, Site Viewings & Schedule',
  },
  '/recordings': {
    title: 'Audio Recordings',
    subtitle: '3CX PBX Customer Call Audio Archive & QA',
  },
  '/whatsapp': {
    title: 'WhatsApp Web',
    subtitle: 'Multi-Device Direct Client Messaging Suite',
  },
  '/users': {
    title: 'Users & Access Control',
    subtitle: 'Team Management & Granular Permission Matrix',
  },
  '/settings': {
    title: 'System Settings',
    subtitle: 'Configuration, Lead Auto-Distribution & SMTP Setup',
  },
  '/leads/create': {
    title: 'Create Lead',
    subtitle: 'Manually Add Inbound Client Profile',
  },
  '/opportunities/create': {
    title: 'Create Opportunity',
    subtitle: 'Qualify & Launch New Deal Workspace',
  },
  '/team-performance': {
    title: 'Team Performance',
    subtitle: 'Sales Advisor Conversion & Activity Leaderboard',
  },
  '/reports': {
    title: 'Reports & Analytics',
    subtitle: 'Performance, Pipeline & Deal Conversion Reports',
  },
  '/overview': {
    title: 'Executive Overview',
    subtitle: 'Real Estate Advisory Analytics & Key Metrics',
  },
};

interface NavbarProps {
  title?: string;
  subtitle?: string;
  onSearch?: (query: string) => void;
  actions?: React.ReactNode;
  teamSelector?: React.ReactNode;
}

export default function Navbar({ title, subtitle, onSearch, actions, teamSelector }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
    initials: string;
  } | null>(null);

  // Determine dynamic heading
  let currentTitle = title;
  let currentSubtitle = subtitle;
  if (!currentTitle) {
    if (pathname && ROUTE_HEADINGS[pathname]) {
      currentTitle = ROUTE_HEADINGS[pathname].title;
      currentSubtitle = ROUTE_HEADINGS[pathname].subtitle;
    } else if (pathname?.startsWith('/opportunities/')) {
      currentTitle = 'Opportunity Workspace';
      currentSubtitle = 'Deal Profile, Property Specs & Qualification';
    } else if (pathname?.startsWith('/leads/') && pathname?.includes('/edit')) {
      currentTitle = 'Edit Lead Profile';
      currentSubtitle = 'Update Client Record';
    } else if (pathname?.startsWith('/leads/')) {
      currentTitle = 'Lead Profile';
      currentSubtitle = 'Client Master Profile & Activities';
    } else if (pathname) {
      const clean = pathname.replace(/^\//, '').split('/')[0];
      currentTitle = clean.charAt(0).toUpperCase() + clean.slice(1).replace(/-/g, ' ');
      currentSubtitle = 'FS Advisory CRM';
    } else {
      currentTitle = 'Leads';
      currentSubtitle = 'Unified Leads Hub';
    }
  }

  useEffect(() => {
    setMounted(true);
    const syncUser = () => {
      try {
        const stored = localStorage.getItem('crm_user');
        if (stored) {
          const u = JSON.parse(stored);
          const computedInitials = u.initials || (u.name ? u.name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'FA');
          setCurrentUser({
            name: u.name || 'Advisor',
            email: u.email || '',
            role: u.role ? (u.role.includes('·') ? u.role : `${u.role} · FS Advisory`) : 'FS Advisory',
            initials: computedInitials,
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    syncUser();
    window.addEventListener('crm_user_updated', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('crm_user_updated', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Logout Handler
  const handleLogout = () => {
    setIsDropdownOpen(false);
    Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to log out from FS Advisory CRM?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#081428',
      cancelButtonColor: '#7A7A7A',
      confirmButtonText: 'Yes, Sign Out',
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('crm_user');
        localStorage.removeItem('crm_token');

        Swal.fire({
          icon: 'success',
          title: 'Signed Out',
          text: 'You have been safely logged out.',
          timer: 1200,
          showConfirmButton: false,
        });

        setTimeout(() => {
          router.push('/login');
        }, 600);
      }
    });
  };

  return (
    <header className="h-16 bg-white border-b border-[#E8E2D9] px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* 1. Page Main Heading (Replaces Search Input in Top Bar) */}
      <div className="flex flex-col justify-center min-w-0 pr-4">
        <h1 className="font-heading font-bold text-lg sm:text-xl text-[#081428] tracking-tight leading-tight truncate">
          {currentTitle}
        </h1>
        {currentSubtitle && (
          <p className="text-[11px] text-[#6E6E6E] font-medium leading-tight truncate mt-0.5 hidden sm:block">
            {currentSubtitle}
          </p>
        )}
      </div>

      {/* 2. Header Info & Right Profile */}
      <div className="flex items-center gap-3 sm:gap-5">
        {actions && <div className="flex items-center gap-2">{actions}</div>}

        {/* Team / Advisor Selector (Replaced SLA Engine) */}
        {teamSelector ? (
          <div className="flex items-center">{teamSelector}</div>
        ) : null}

        {/* 3. User Profile Widget with Dropdown on the Right Side End */}
        <div className="relative" ref={dropdownRef}>
          {!mounted || !currentUser ? (
            <div className="flex items-center gap-3 p-1.5 pr-2.5 rounded-lg border border-transparent select-none">
              {/* Skeleton Avatar */}
              <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
              {/* Skeleton Text */}
              <div className="hidden sm:flex flex-col gap-1.5">
                <div className="w-20 h-2.5 bg-slate-200 rounded animate-pulse" />
                <div className="w-14 h-2 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 p-1.5 pr-2.5 rounded-lg hover:bg-[#FAF8F5] border border-transparent hover:border-[#E8E2D9] transition-all cursor-pointer select-none"
            >
              {/* Avatar Initials Circle with Gold Styling */}
              <div className="w-8 h-8 rounded-full bg-[#081428] text-[#C9A84C] font-bold text-xs flex items-center justify-center border border-[#C9A84C]/40 shadow-2xs shrink-0">
                {currentUser.initials}
              </div>

              {/* Name & Role */}
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-[#081428] leading-tight flex items-center gap-1">
                  <span>{currentUser.name}</span>
                </div>
                <div className="text-[10px] text-[#7A7A7A] leading-tight">
                  {currentUser.role}
                </div>
              </div>

              {/* Chevron Arrow */}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-[#C9A84C]' : ''}`} />
            </button>
          )}

          {/* Dropdown Menu */}
          {isDropdownOpen && currentUser && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E2D9] py-2 z-50 animate-fade-in text-xs">
              {/* Dropdown Header: User Info Card */}
              <div className="px-4 py-3 border-b border-[#E8E2D9] bg-[#FAF8F5]/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#081428] text-[#C9A84C] font-bold text-sm flex items-center justify-center border border-[#C9A84C]/40 shadow-xs shrink-0">
                  {currentUser.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#081428] truncate text-xs">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-[#7A7A7A] truncate">
                    {currentUser.email}
                  </div>
                  <div className="mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#081428] text-[#C9A84C]">
                      {(currentUser.role || '').split('·')[0].trim()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="py-1.5">
                <Link
                  href="/users"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-[#FAF8F5] hover:text-[#081428] transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-[#C9A84C]" />
                  <span>User Management & Roles</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-[#FAF8F5] hover:text-[#081428] transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>System Settings</span>
                </Link>
              </div>

              {/* Logout Option */}
              <div className="border-t border-[#E8E2D9] pt-1 mt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Sign Out / Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
