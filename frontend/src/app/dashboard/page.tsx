'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/overview');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#081428] flex items-center justify-center text-[#C8A147]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#C8A147] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs uppercase tracking-wider font-semibold">Redirecting to Executive Dashboard...</p>
      </div>
    </div>
  );
}
