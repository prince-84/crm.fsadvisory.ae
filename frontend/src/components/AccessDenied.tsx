'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

interface AccessDeniedProps {
  moduleName?: string;
  requiredPermission?: string;
  fallbackUrl?: string;
  fallbackText?: string;
}

export default function AccessDenied({
  moduleName = 'This Module',
  requiredPermission,
  fallbackUrl = '/overview',
  fallbackText = 'Return to Overview',
}: AccessDeniedProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#E8E2D9] rounded-xl p-8 text-center shadow-lg space-y-5">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider rounded-full inline-flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Permission Required</span>
          </span>
          <h2 className="text-xl font-heading font-bold text-[#081428]">
            Access Restricted
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your current role and profile do not have permission to access <strong>{moduleName}</strong>.
          </p>
          {requiredPermission && (
            <div className="mt-2 p-2 bg-[#FAF8F5] border border-[#E8E2D9] rounded text-[11px] font-mono text-slate-700">
              Required Key: <span className="font-bold text-[#C9A84C]">{requiredPermission}</span>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 pt-2 border-t border-[#E8E2D9]">
          Please contact your CRM Super Administrator to grant granular access for your account.
        </div>

        <div>
          <Link
            href={fallbackUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{fallbackText}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
