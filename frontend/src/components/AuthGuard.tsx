'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Allow public routes
    if (pathname === '/login') {
      setIsAuthenticated(true);
      return;
    }

    // 2. Verify active user session
    try {
      const token = localStorage.getItem('crm_token');
      const user = localStorage.getItem('crm_user');

      if (!token || !user) {
        setIsAuthenticated(false);
        router.replace('/login');
      } else {
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
      router.replace('/login');
    }
  }, [pathname, router]);

  // If on login page, render immediately
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // If unauthenticated or verifying, prevent protected content from flashing
  if (isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center gap-3 select-none">
        <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        <span className="text-[11px] font-bold text-[#081428] tracking-wider uppercase">
          FS ADVISORY CRM
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
