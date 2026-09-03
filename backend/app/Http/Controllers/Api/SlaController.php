<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use App\Models\SlaBreach;
use App\Models\Activity;
use App\Models\OwnershipHistory;
use Illuminate\Http\Request;
use Carbon\Carbon;

class SlaController extends Controller
{
    public function checkEscalations(Request $request)
    {
        $now = Carbon::now();
        $overdueOpps = Opportunity::whereNotIn('stage', ['closed_won', 'closed_lost'])
            ->where('next_action_due_at', '<', $now->copy()->subMinutes(15)) // Grace period 15 mins
            ->get();

        $breachedCount = 0;
        foreach ($overdueOpps as $opp) {
            // Check if breach already logged in past 24 hours
            $recentBreach = SlaBreach::where('opportunity_id', $opp->id)
                ->where('created_at', '>=', $now->copy()->subHours(24))
                ->first();

            if (!$recentBreach) {
                SlaBreach::create([
                    'opportunity_id' => $opp->id,
                    'agent_name' => $opp->current_owner_name,
                    'breached_at' => $now,
                    'grace_period_mins' => 15,
                    'reassigned_to_manager' => $opp->temperature === 'hot',
                    'action_taken' => $opp->temperature === 'hot' 
                        ? 'Auto-Escalated: Grace period expired for HOT lead. Reassigned to Manager (Faraz Shafi).' 
                        : 'SLA Breach logged against agent record.',
                ]);

                // Auto reassign HOT leads to manager
                if ($opp->temperature === 'hot' && $opp->current_owner_name !== 'Faraz Shafi') {
                    $prev = $opp->current_owner_name;
                    $opp->current_owner_name = 'Faraz Shafi';
                    $opp->department = 'sales';
                    $opp->sla_status = 'overdue';
                    $opp->save();

                    OwnershipHistory::create([
                        'opportunity_id' => $opp->id,
                        'previous_owner' => $prev,
                        'new_owner' => 'Faraz Shafi',
                        'department_from' => 'telesales',
                        'department_to' => 'sales',
                        'reason' => 'SLA Auto-Escalation: Hot Lead SLA Breached',
                    ]);
                }

                $breachedCount++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "SLA Auto-Escalation Check completed. {$breachedCount} new breaches logged.",
            'breaches_logged' => $breachedCount,
        ]);
    }
}
