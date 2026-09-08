'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import {
  Search,
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

interface NavbarProps {
  onSearch?: (query: string) => void;
}

export default function Navbar({ onSearch }: NavbarProps) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
    initials: string;
  } | null>(null);

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
      {/* 1. Global Search */}
      <div className="relative w-72 sm:w-96">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A7A7A]" />
        <input
          type="text"
          placeholder="Search Lead Bank (Name, Phone, Email)..."
          onChange={(e) => onSearch && onSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-[#FAF8F4] border border-[#E8E2D9] rounded-md text-xs text-[#2C2C2C] placeholder-[#7A7A7A] focus:outline-none focus:ring-1 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
        />
      </div>

      {/* 2. Header Info & Right Profile */}
      <div className="flex items-center gap-5">
        {/* SLA Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#FAF8F4] border border-[#E8E2D9] rounded-md text-xs">
          <Clock className="w-3.5 h-3.5 text-[#C9A84C]" />
          <span className="text-[#2C2C2C] font-medium">SLA Engine:</span>
          <span className="font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Active (Auto-Escalation)
          </span>
        </div>

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
