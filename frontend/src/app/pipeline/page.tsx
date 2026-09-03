'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { fetchApi } from '@/lib/api';
import { Kanban, User, GripVertical, FileText } from 'lucide-react';
import Link from 'next/link';

export default function SalesPipelinePage() {
  const [pipeline, setPipeline] = useState<any>({
    new: [],
    qualification: [],
    handover_pending: [],
    sales_in_progress: [],
    closed_won: [],
    closed_lost: [],
  });
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const loadPipeline = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/opportunities');
      setPipeline(res.pipeline || {});
      setLoading(false);
    } catch (err) {
      console.error('Failed to load pipeline:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipeline();
  }, []);

  const handleStageChange = async (oppId: number, newStage: string) => {
    // Optimistic UI Update
    setPipeline((prev: any) => {
      let movedOpp: any = null;
      const updated = { ...prev };

      // Find and remove from existing array
      Object.keys(updated).forEach((key) => {
        const index = updated[key].findIndex((o: any) => o.id === oppId);
        if (index !== -1) {
          movedOpp = { ...updated[key][index], stage: newStage };
          updated[key] = updated[key].filter((o: any) => o.id !== oppId);
        }
      });

      // Add to target array
      if (movedOpp && updated[newStage]) {
        updated[newStage] = [movedOpp, ...updated[newStage]];
      }

      return updated;
    });

    try {
      await fetchApi(`/opportunities/${oppId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: newStage }),
      });
      loadPipeline();
    } catch (err) {
      console.error('Failed to update stage:', err);
      alert('Failed to update opportunity stage.');
      loadPipeline();
    }
  };

  const columns = [
    { key: 'contacted', label: '1. Contacted', color: 'border-sky-500', bg: 'bg-sky-50/50' },
    { key: 'qualified', label: '2. Qualified', color: 'border-blue-600', bg: 'bg-blue-50/50' },
    { key: 'option_sent', label: '3. Option Sent', color: 'border-indigo-500', bg: 'bg-indigo-50/50' },
    { key: 'follow_up', label: '4. Follow up', color: 'border-amber-500', bg: 'bg-amber-50/50' },
    { key: 'meeting', label: '5. Meeting', color: 'border-purple-600', bg: 'bg-purple-50/50' },
    { key: 'future_prospectus', label: '6. Future Prospectus', color: 'border-teal-600', bg: 'bg-teal-50/50' },
    { key: 'closed', label: '7. Closed 🏆', color: 'border-emerald-700', bg: 'bg-emerald-100/50' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#2C2C2C] flex">
      <Sidebar />

      <div className="flex-1 pl-56 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 space-y-6 w-full">
          {/* Header */}
          <div className="border-b border-[#E8E2D9] pb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#C9A84C] uppercase tracking-wider mb-1">
              <Kanban className="w-4 h-4" />
              <span>07 — Sales Pipeline Module</span>
            </div>
            <h1 className="font-heading font-bold text-2xl text-[#1B2A4A] tracking-tight">
              Opportunities & Handover Kanban
            </h1>
            <p className="text-xs text-[#7A7A7A] mt-1">
              Drag and drop opportunity cards between columns to update stage instantly. Click client name to view details.
            </p>
          </div>

          {/* Kanban Board Columns with smooth horizontal scroll */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 items-start min-w-max">
            {columns.map((col) => {
              const list = pipeline[col.key] || [];
              const isOver = dragOverCol === col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverCol !== col.key) setDragOverCol(col.key);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (dragOverCol === col.key) setDragOverCol(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const oppIdStr = e.dataTransfer.getData('text/plain');
                    if (oppIdStr) {
                      handleStageChange(Number(oppIdStr), col.key);
                    }
                  }}
                  className={`w-[295px] shrink-0 bg-white border rounded-lg overflow-hidden shadow-2xs transition-all duration-150 ${
                    isOver
                      ? 'border-[#C8A147] ring-2 ring-[#C8A147]/50 bg-[#FAF8F5]'
                      : 'border-[#E8E2D9]'
                  }`}
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b border-[#E8E2D9] border-t-4 ${col.color} ${col.bg} flex items-center justify-between`}>
                    <h3 className="font-semibold text-xs text-[#1B2A4A]">{col.label}</h3>
                    <span className="w-5 h-5 rounded-full bg-[#1B2A4A] text-[#FAF8F4] text-[10px] font-bold flex items-center justify-center">
                      {list.length}
                    </span>
                  </div>

                  {/* Column Body Cards Container */}
                  <div className={`p-3 space-y-3 min-h-[480px] transition-colors ${isOver ? 'bg-[#C8A147]/5' : 'bg-[#FAF8F4]'}`}>
                    {loading ? (
                      <div className="text-center py-6 text-xs text-[#7A7A7A]">Loading...</div>
                    ) : list.length === 0 ? (
                      <div className="text-center py-8 text-[11px] text-[#7A7A7A] italic border-2 border-dashed border-[#E8E2D9] rounded-md">
                        Drop opportunity here
                      </div>
                    ) : (
                      list.map((opp: any) => {
                        const contact = opp.contact || {};
                        const qual = opp.buyer_qualification || {};
                        const isDragging = draggingId === opp.id;

                        const lastNote = (opp.activities || []).find((a: any) => a.type === 'note')?.description 
                          || opp.key_requirement 
                          || '';

                        return (
                          <div
                            key={opp.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(opp.id));
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggingId(opp.id);
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverCol(null);
                            }}
                            className={`p-4 bg-white border rounded-md shadow-2xs hover:shadow-md hover:border-[#C8A147] transition-all space-y-2.5 cursor-grab active:cursor-grabbing select-none ${
                              isDragging
                                ? 'opacity-40 border-[#C8A147] ring-2 ring-[#C8A147]'
                                : 'border-[#E8E2D9]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 cursor-grab" />
                                <Link
                                  href={`/opportunities/${opp.id}`}
                                  className="font-bold text-xs text-[#1B2A4A] group-hover:text-[#C9A84C] transition-colors hover:underline truncate"
                                >
                                  {contact.name}
                                </Link>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                                opp.temperature === 'hot' ? 'bg-red-100 text-red-700' :
                                opp.temperature === 'warm' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {opp.temperature}
                              </span>
                            </div>

                            <Link href={`/opportunities/${opp.id}`} className="block text-[11px] text-[#7A7A7A] space-y-1">
                              <div>{opp.opportunity_type?.toUpperCase()} · {qual.property_type || opp.property_type || 'Apartment'}</div>
                              <div className="font-semibold text-[#1B2A4A]">
                                {opp.budget_min && opp.budget_max ? (
                                  `AED ${(opp.budget_min/1000000).toFixed(1)}M – ${(opp.budget_max/1000000).toFixed(1)}M`
                                ) : (
                                  'Budget Not Specified'
                                )}
                              </div>
                            </Link>

                            {/* Latest Summary Note Display */}
                            {lastNote && (
                              <div className="p-2 bg-amber-50/70 border border-amber-200/80 rounded-md space-y-1 text-left">
                                <div className="flex items-center gap-1 text-[9px] font-bold text-amber-800 uppercase tracking-wider">
                                  <FileText className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                  <span>Summary Note</span>
                                </div>
                                <p className="text-[10.5px] text-[#081428] leading-snug line-clamp-2 italic">
                                  "{lastNote}"
                                </p>
                              </div>
                            )}

                            <div className="pt-2 border-t border-[#E8E2D9] flex items-center justify-between text-[10px] text-[#7A7A7A]">
                              <span className="flex items-center gap-1 font-medium text-[#1B2A4A] truncate">
                                <User className="w-3 h-3 text-[#C9A84C] shrink-0" />
                                {opp.current_owner_name || 'Unassigned'}
                              </span>
                              <span className="text-[9px] text-[#C8A147] font-semibold flex items-center gap-0.5">
                                ✋ Drag to Move
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
