<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use Illuminate\Http\Request;
use Carbon\Carbon;

class QueueController extends Controller
{
    public function index(Request $request)
    {
        $query = Opportunity::with(['contact', 'buyerQualification'])
            ->whereNotIn('stage', ['closed_won', 'closed_lost']);

        if ($request->filled('owner') && $request->owner !== 'all') {
            $query->where('current_owner_name', $request->owner);
        }

        $opportunities = $query->get();

        // Dynamically update SLA status based on current time
        $now = Carbon::now();
        foreach ($opportunities as $opp) {
            if (!$opp->next_action_due_at || !$opp->next_action) {
                $opp->is_orphaned = true;
            } else {
                $dueAt = Carbon::parse($opp->next_action_due_at);
                if ($dueAt->isPast()) {
                    $opp->sla_status = 'overdue';
                } elseif ($dueAt->diffInMinutes($now) <= 30) {
                    $opp->sla_status = 'due_soon';
                } else {
                    $opp->sla_status = 'on_track';
                }
            }
            $opp->save();
        }

        $overdue = $opportunities->where('sla_status', 'overdue')->values();
        $dueNow = $opportunities->where('sla_status', 'due_soon')->values();
        $hotLeads = $opportunities->where('temperature', 'hot')->whereNotIn('sla_status', ['overdue'])->values();
        $upcoming = $opportunities->where('sla_status', 'on_track')->where('temperature', '!=', 'hot')->values();

        $byStage = [
            'new' => $opportunities->where('stage', 'new')->values(),
            'qualification' => $opportunities->where('stage', 'qualification')->values(),
            'handover_pending' => $opportunities->where('stage', 'handover_pending')->values(),
            'sales_in_progress' => $opportunities->where('stage', 'sales_in_progress')->values(),
        ];

        return response()->json([
            'all' => $opportunities->values(),
            'by_stage' => $byStage,
            'overdue' => $overdue,
            'due_now' => $dueNow,
            'hot_leads' => $hotLeads,
            'upcoming' => $upcoming,
            'counts' => [
                'all' => $opportunities->count(),
                'overdue' => $overdue->count(),
                'due_now' => $dueNow->count(),
                'hot_leads' => $hotLeads->count(),
                'upcoming' => $upcoming->count(),
                'new' => $opportunities->where('stage', 'new')->count(),
                'qualification' => $opportunities->where('stage', 'qualification')->count(),
                'handover_pending' => $opportunities->where('stage', 'handover_pending')->count(),
                'sales_in_progress' => $opportunities->where('stage', 'sales_in_progress')->count(),
            ]
        ]);
    }
}
