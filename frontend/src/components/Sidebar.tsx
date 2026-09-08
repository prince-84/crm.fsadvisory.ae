'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Kanban, 
  Calendar, 
  ListOrdered, 
  Clock, 
  PhoneCall, 
  CalendarDays, 
  BarChart3, 
  FileText, 
  Settings, 
  ChevronLeft, 
  MoreVertical, 
  Mic, 
  MessageSquare,
  Building2,
  ShieldCheck,
  Flame 
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { isSuperUser } from '@/lib/permissions';

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams ? searchParams.get('tab') : null;
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [newLeadsCount, setNewLeadsCount] = React.useState<number>(0);

  React.useEffect(() => {
    const fetchNewLeadsCount = () => {
      fetchApi('/contacts?inbound_only=1&tab=new&per_page=1')
        .then((res) => {
          const count = res?.tab_counts?.new ?? res?.tab_counts?.unassigned ?? res?.contacts?.total ?? 0;
          setNewLeadsCount(Number(count) || 0);
        })
        .catch(() => {});
    };

    fetchNewLeadsCount();
    const interval = setInterval(fetchNewLeadsCount, 30000);

    const handleCountUpdate = (e: any) => {
      if (e?.detail !== undefined && typeof e.detail === 'number') {
        setNewLeadsCount(e.detail);
      } else {
        fetchNewLeadsCount();
      }
    };

    window.addEventListener('crm_new_leads_count', handleCountUpdate);
    window.addEventListener('crm_contacts_updated', fetchNewLeadsCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener('crm_new_leads_count', handleCountUpdate);
      window.removeEventListener('crm_contacts_updated', fetchNewLeadsCount);
    };
  }, []);

  React.useEffect(() => {
    const syncUser = () => {
      try {
        const raw = localStorage.getItem('crm_user');
        if (raw) setCurrentUser(JSON.parse(raw));
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

  const hasAccess = (permission?: string) => {
    if (!permission) return true;
    if (!currentUser) return true; // Initial load fallback
    if (isSuperUser(currentUser)) return true;
    const perms: string[] = currentUser.permissions || [];
    if (perms.includes('*')) return true;
    return perms.includes(permission);
  };

  const sections = [
    {
      title: 'COMMAND CENTER',
      items: [
        { key: 'overview', name: 'Overview', href: '/overview', icon: LayoutDashboard },
      ]
    },
    {
      title: 'SALES',
      items: [
        { key: 'new_leads', name: 'New Leads', href: '/new-leads', icon: Flame, permission: 'leads.view' },
        { key: 'lead_pool', name: 'Lead Pool', href: '/', icon: Users, permission: 'leads.view' },
        { key: 'owner_data', name: 'Owner Data', href: '/owner-data', icon: Building2, permission: 'owner_data.view' },
        { key: 'queue', name: 'My Queue', href: '/queue', icon: ListOrdered, permission: 'queue.view' },
        { key: 'opportunities', name: 'Opportunities', href: '/opportunities', icon: Briefcase, permission: 'deals.view' },
        { key: 'call_activity', name: 'Call Activity', href: '/call-activity', icon: PhoneCall, permission: 'calls.view_logs' },
        { key: 'appointments', name: 'Appointments', href: '/calendar', icon: CalendarDays, permission: 'queue.calendar' },
        { key: 'recordings', name: 'Recordings', href: '/recordings', icon: Mic, permission: 'calls.listen_recordings' },
        { key: 'whatsapp', name: 'WhatsApp Web', href: '/whatsapp', icon: MessageSquare, badge: 'Live', permission: 'whatsapp.view' },
      ]
    },
    {
      title: 'PERFORMANCE',
      items: [
        { key: 'team_perf', name: 'Team Performance', href: '/team-performance', icon: BarChart3, permission: 'reports.view_team' },
        { key: 'reports', name: 'Reports', href: '/reports', icon: FileText, permission: 'reports.view_financials' },
      ]
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { key: 'users', name: 'User Management', href: '/users', icon: ShieldCheck, permission: 'users.manage' },
        { key: 'settings', name: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
      ]
    }
  ];

  return (
    <aside className="w-56 bg-[#081428] text-[#B0C0D8] flex flex-col h-screen fixed left-0 top-0 z-30 shadow-2xl border-r border-[#152744] font-['Poppins',sans-serif]">
      {/* Brand Header */}
      <div className="px-4 py-5 border-b border-[#152744] flex items-center justify-center">
        <Link href="/" className="flex items-center justify-center group transition-transform hover:scale-[1.02]">
          <Image
            src="/logo.svg"
            alt="FS Advisory"
            width={160}
            height={41}
            className="w-40 h-auto object-contain"
            priority
          />
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {sections.map((sec) => {
          const visibleItems = sec.items.filter((item) => hasAccess((item as any).permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={sec.title} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold tracking-widest text-[#8A9AB5] uppercase">
                {sec.title}
              </div>
              {visibleItems.map((item) => {
                let isActive = false;
                if (item.href === '/') {
                  isActive = pathname === '/';
                } else if (item.href.includes('?')) {
                  const [itemPath, itemQuery] = item.href.split('?');
                  const itemTab = new URLSearchParams(itemQuery).get('tab');
                  isActive = pathname === itemPath && currentTab === itemTab;
                } else {
                  isActive = pathname === item.href && !currentTab;
                }

                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#C8A147] text-[#081428] font-bold shadow-xs'
                        : 'text-[#B0C0D8] hover:bg-[#122444] hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#081428]' : 'text-[#8A9AB5]'}`} />
                    <span className="flex-1">{item.name}</span>
                    {item.key === 'new_leads' ? (
                      <span
                        className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors shadow-xs ${
                          isActive
                            ? 'bg-[#081428] text-[#C8A147]'
                            : 'bg-[#C8A147] text-[#081428]'
                        }`}
                      >
                        {newLeadsCount}
                      </span>
                    ) : (item as any).badge ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {(item as any).badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={<aside className="w-56 bg-[#081428] h-screen fixed left-0 top-0 z-30 border-r border-[#152744]" />}>
      <SidebarInner />
    </Suspense>
  );
}
