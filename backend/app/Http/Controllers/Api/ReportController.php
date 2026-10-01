<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\Activity;
use App\Models\User;
use App\Models\CallRecording;
use App\Models\OwnerRecord;
use App\Models\SlaBreach;
use App\Models\Appointment;
use App\Models\Project;
use App\Models\Community;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Helper to format duration in seconds into human-readable string (e.g., "1h 24m", "4m 12s", "45s")
     */
    private function formatDuration($seconds)
    {
        $seconds = (int) $seconds;
        if ($seconds <= 0) {
            return '0s';
        }
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $remSecs = $seconds % 60;

        if ($hours > 0) {
            return "{$hours}h {$minutes}m";
        }
        if ($minutes > 0) {
            return "{$minutes}m {$remSecs}s";
        }
        return "{$remSecs}s";
    }

    /**
     * Comprehensive Team Performance & Leaderboard (100% Database Connected)
     */
    public function teamPerformance(Request $request)
    {
        $timeRange = $request->query('time_range', 'all');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $dateFilter = $this->resolveDateRange($timeRange, $dateFrom, $dateTo);
        $startDate = $dateFilter['start'];
        $endDate = $dateFilter['end'];

        $users = User::where('is_active', true)->orderBy('name', 'asc')->get();
        $leaderboard = [];

        foreach ($users as $u) {
            $assignedContactsQuery = Contact::where('assigned_to', $u->name);
            $oppQuery = Opportunity::where('current_owner_name', $u->name);
            $apptsQuery = Appointment::where('agent_name', $u->name);
            $activityCallsQuery = Activity::where('user_name', $u->name)->where('type', 'call');
            $dbRecordingsQuery = CallRecording::where(function ($q) use ($u) {
                $q->where('agent_name', 'like', "%{$u->name}%")
                  ->orWhere('agent_extension', $u->id);
            });

            if ($startDate && $endDate) {
                $activityCallsQuery->whereBetween('created_at', [$startDate, $endDate]);
                $dbRecordingsQuery->whereBetween('created_at', [$startDate, $endDate]);
                $oppQuery->whereBetween('created_at', [$startDate, $endDate]);
                $apptsQuery->whereBetween('created_at', [$startDate, $endDate]);
            }

            $assignedContactsCount = $assignedContactsQuery->count();
            $assignedIds = (clone $assignedContactsQuery)->pluck('id');

            // Contacted vs Uncontacted Leads
            $contactedCount = Activity::whereIn('contact_id', $assignedIds)
                ->where('type', 'call')
                ->distinct('contact_id')
                ->count('contact_id');
            $uncontactedCount = max(0, $assignedContactsCount - $contactedCount);

            // Calls and Talk Time
            $activityCallsCount = $activityCallsQuery->count();
            $dbRecordingsCount = $dbRecordingsQuery->count();
            $callsCount = $activityCallsCount + $dbRecordingsCount;

            // Connected Calls
            $connectedOutcomes = ['Interested', 'Interested - Schedule Viewing', 'Callback', 'Follow-up', 'Meeting Scheduled', 'Answered', 'Connected', 'Contacted'];
            $connectedActivities = (clone $activityCallsQuery)
                ->where(function ($q) use ($connectedOutcomes) {
                    $q->whereIn('call_outcome', $connectedOutcomes)
                      ->orWhere('duration_seconds', '>', 0);
                })->count();
            $connectedRecordings = (clone $dbRecordingsQuery)
                ->where(function ($q) {
                    $q->where('call_status', 'answered')
                      ->orWhere('duration_seconds', '>', 0);
                })->count();
            $connectedCallsCount = $connectedActivities + $connectedRecordings;
            $connectedRate = $callsCount > 0 ? round(($connectedCallsCount / $callsCount) * 100, 1) : 0.0;

            // Talk Time Seconds
            $activityTalkSecs = (int) (clone $activityCallsQuery)->sum('duration_seconds');
            $recordingTalkSecs = (int) (clone $dbRecordingsQuery)->sum('duration_seconds');
            $totalTalkSecs = $activityTalkSecs + $recordingTalkSecs;

            // Opportunities
            $oppCount = (clone $oppQuery)->count();
            $closedWonCount = (clone $oppQuery)->whereIn('stage', ['closed', 'closed_won'])->count();
            $closedWonAed = (float) (clone $oppQuery)->whereIn('stage', ['closed', 'closed_won'])->sum('budget_max');
            $pipelineAed = (float) (clone $oppQuery)->whereNotIn('stage', ['closed_lost'])->sum('budget_max');

            // Appointments
            $apptsCount = (clone $apptsQuery)->count();

            // SLA Compliance
            $overdueCount = (clone $oppQuery)->where('sla_status', 'overdue')->count();
            $slaCompliance = $oppCount > 0 
                ? round((($oppCount - $overdueCount) / $oppCount) * 100, 1) 
                : 100.0;

            $conversionRate = $assignedContactsCount > 0 
                ? round(($oppCount / $assignedContactsCount) * 100, 1) 
                : 0.0;

            $leaderboard[] = [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'department' => $u->department ?? 'Sales',
                'initials' => strtoupper(substr($u->name, 0, 2)),
                'is_active' => $u->is_active,
                'assigned_leads' => $assignedContactsCount,
                'contacted_leads' => $contactedCount,
                'uncontacted_leads' => $uncontactedCount,
                'calls_made' => $callsCount,
                'connected_calls' => $connectedCallsCount,
                'connected_rate' => $connectedRate,
                'total_talk_time_seconds' => $totalTalkSecs,
                'talk_time_formatted' => $this->formatDuration($totalTalkSecs),
                'appointments' => $apptsCount,
                'opportunities_count' => $oppCount,
                'closed_won_count' => $closedWonCount,
                'closed_won_aed' => $closedWonAed,
                'pipeline_aed' => $pipelineAed,
                'sla_compliance' => $slaCompliance,
                'conversion_rate' => $conversionRate,
                'tier' => $closedWonAed > 0 ? 'Closed Producer' : ($oppCount > 0 ? 'Active Advisor' : 'Onboarding'),
            ];
        }

        // Sort descending by Closed Won Volume, then Opportunities, then Calls
        usort($leaderboard, function ($a, $b) {
            if ($b['closed_won_aed'] !== $a['closed_won_aed']) {
                return $b['closed_won_aed'] <=> $a['closed_won_aed'];
            }
            if ($b['opportunities_count'] !== $a['opportunities_count']) {
                return $b['opportunities_count'] <=> $a['opportunities_count'];
            }
            return $b['calls_made'] <=> $a['calls_made'];
        });

        foreach ($leaderboard as $idx => &$item) {
            $item['rank'] = $idx + 1;
        }

        $totalClosedWonAed = array_sum(array_column($leaderboard, 'closed_won_aed'));
        $totalPipelineAed = array_sum(array_column($leaderboard, 'pipeline_aed'));
        $totalCalls = array_sum(array_column($leaderboard, 'calls_made'));
        $avgSla = count($leaderboard) > 0 
            ? round(array_sum(array_column($leaderboard, 'sla_compliance')) / count($leaderboard), 1) 
            : 100.0;

        return response()->json([
            'success' => true,
            'summary' => [
                'total_closed_won_aed' => $totalClosedWonAed,
                'total_pipeline_aed' => $totalPipelineAed,
                'total_calls' => $totalCalls,
                'average_sla_compliance' => $avgSla,
                'top_advisor' => $leaderboard[0]['name'] ?? 'None',
                'team_members_count' => count($leaderboard),
            ],
            'leaderboard' => $leaderboard,
        ]);
    }

    public function analytics(Request $request)
    {
        $agent = $request->query('agent');
        $timeRange = $request->query('time_range', $request->query('period', 'all'));
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $authUser = $request->user();
        $canViewAll = false;
        if ($authUser) {
            $role = strtolower($authUser->role ?? '');
            $perms = $authUser->permissions ?? [];
            if (is_string($perms)) {
                $perms = json_decode($perms, true) ?: [];
            }
            if (
                str_contains($role, 'admin') ||
                str_contains($role, 'manager') ||
                str_contains($role, 'director') ||
                str_contains($role, 'ceo') ||
                $authUser->email === 'faraz@fsadvisory.ae' ||
                in_array('*', $perms) ||
                in_array('leads.view_all', $perms) ||
                in_array('reports.view_financials', $perms)
            ) {
                $canViewAll = true;
            }
        } else {
            $canViewAll = true;
        }

        // If regular advisor/agent, strictly lock to their own profile
        if (!$canViewAll && $authUser) {
            $agent = $authUser->name;
        }

        $isAll = empty($agent) || $agent === 'all';

        // 1. Date Range Filter Resolution
        $dateFilter = $this->resolveDateRange($timeRange, $dateFrom, $dateTo);
        $startDate = $dateFilter['start'];
        $endDate = $dateFilter['end'];

        // 2. Fetch all active advisors for top dropdown
        $allActiveUsers = User::where('is_active', true)->orderBy('name', 'asc')->get();
        $advisorsList = $allActiveUsers->map(function ($u) {
            $cCount = Contact::where('assigned_to', $u->name)->count();
            $oCount = Opportunity::where('current_owner_name', $u->name)->count();
            $calls = Activity::where('user_name', $u->name)->where('type', 'call')->count()
                   + CallRecording::where('agent_name', 'like', "%{$u->name}%")->count();

            return [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role,
                'email' => $u->email,
                'department' => $u->department ?? 'Sales',
                'initials' => strtoupper(substr($u->name, 0, 2)),
                'assigned_leads' => $cCount,
                'opportunities_count' => $oCount,
                'calls_made' => $calls,
            ];
        });

        // 3. Base Database Queries conditioned on Selected Advisor
        $contactsQuery = Contact::query();
        $oppsQuery = Opportunity::query();
        $apptsQuery = Appointment::query();
        $activitiesQuery = Activity::query();
        $callRecordingsQuery = CallRecording::query();

        if (!$isAll) {
            $contactsQuery->where('assigned_to', $agent);
            $oppsQuery->where('current_owner_name', $agent);
            $apptsQuery->where('agent_name', $agent);
            $activitiesQuery->where('user_name', $agent);
            $callRecordingsQuery->where(function ($q) use ($agent) {
                $q->where('agent_name', 'like', "%{$agent}%");
            });
        }

        // Apply Date Range to Activities, Appointments, Call Recordings, and Opportunities
        if ($startDate && $endDate) {
            $activitiesQuery->whereBetween('created_at', [$startDate, $endDate]);
            $callRecordingsQuery->whereBetween('created_at', [$startDate, $endDate]);
            $oppsQuery->whereBetween('created_at', [$startDate, $endDate]);
            $apptsQuery->whereBetween('created_at', [$startDate, $endDate]);
        }

        // 4. Real Database Lead Metrics
        $totalContactsInDb = Contact::count();
        $filteredContactsCount = (clone $contactsQuery)->count();
        $assignedIds = (clone $contactsQuery)->pluck('id');

        // Contacted vs Uncontacted (Remaining) Leads
        $contactedLeadsCount = Activity::whereIn('contact_id', $assignedIds)
            ->where('type', 'call')
            ->distinct('contact_id')
            ->count('contact_id');
        $uncontactedLeadsCount = max(0, $filteredContactsCount - $contactedLeadsCount);
        $contactedRate = $filteredContactsCount > 0 ? round(($contactedLeadsCount / $filteredContactsCount) * 100, 1) : 0.0;

        // Fresh / Uncontacted leads awaiting outreach
        $newLeadsCount = $uncontactedLeadsCount;

        // 5. Real Telephony & Calling Activity Stats
        $callActivitiesQuery = (clone $activitiesQuery)->where('type', 'call');
        $activityCallsCount = (clone $callActivitiesQuery)->count();
        $dbCallsCount = (clone $callRecordingsQuery)->count();
        $totalCallsLogged = $activityCallsCount + $dbCallsCount;

        // Connected Calls & Talk Time
        $connectedOutcomes = ['Interested', 'Interested - Schedule Viewing', 'Callback', 'Follow-up', 'Meeting Scheduled', 'Answered', 'Connected', 'Contacted'];
        $connectedActivities = (clone $callActivitiesQuery)
            ->where(function ($q) use ($connectedOutcomes) {
                $q->whereIn('call_outcome', $connectedOutcomes)
                  ->orWhere('duration_seconds', '>', 0);
            })->count();
        $connectedRecordings = (clone $callRecordingsQuery)
            ->where(function ($q) {
                $q->where('call_status', 'answered')
                  ->orWhere('duration_seconds', '>', 0);
            })->count();
        $connectedCalls = $connectedActivities + $connectedRecordings;
        $connectedRate = $totalCallsLogged > 0 ? round(($connectedCalls / $totalCallsLogged) * 100, 1) : 0.0;

        $totalTalkSeconds = (int) (clone $callActivitiesQuery)->sum('duration_seconds')
                          + (int) (clone $callRecordingsQuery)->sum('duration_seconds');
        $avgTalkSeconds = $connectedCalls > 0 ? round($totalTalkSeconds / $connectedCalls) : 0;

        // Call Outcomes Distribution Breakdown
        $allCallOutcomes = (clone $callActivitiesQuery)
            ->select('call_outcome', DB::raw('count(*) as count'))
            ->groupBy('call_outcome')
            ->get();

        $callOutcomesBreakdown = [];
        $totalOutcomesLogged = 0;
        foreach ($allCallOutcomes as $item) {
            $outcomeName = trim($item->call_outcome ?: 'Not Specified');
            $callOutcomesBreakdown[$outcomeName] = ($callOutcomesBreakdown[$outcomeName] ?? 0) + $item->count;
            $totalOutcomesLogged += $item->count;
        }

        $formattedCallOutcomes = [];
        foreach ($callOutcomesBreakdown as $outName => $cnt) {
            $formattedCallOutcomes[] = [
                'outcome' => $outName,
                'count' => $cnt,
                'percentage' => $totalOutcomesLogged > 0 ? round(($cnt / $totalOutcomesLogged) * 100, 1) : 0,
            ];
        }
        usort($formattedCallOutcomes, fn($a, $b) => $b['count'] <=> $a['count']);

        // 6. Appointments Breakdown
        $totalAppointments = (clone $apptsQuery)->count();
        $scheduledAppointments = (clone $apptsQuery)->where('status', 'scheduled')->count();
        $completedAppointments = (clone $apptsQuery)->where('status', 'completed')->count();
        $cancelledAppointments = (clone $apptsQuery)->where('status', 'cancelled')->count();

        $upcomingAppointments = (clone $apptsQuery)
            ->orderBy('appointment_date', 'asc')
            ->orderBy('start_time', 'asc')
            ->limit(8)
            ->get(['id', 'title', 'category', 'appointment_date', 'start_time', 'client_name', 'client_phone', 'agent_name', 'location', 'status', 'priority']);

        // 7. Opportunities & Financials
        $totalOpportunities = (clone $oppsQuery)->count();
        $qualifiedOpportunities = (clone $oppsQuery)->whereIn('stage', ['qualified', 'qualification'])->count();
        $activeOpportunities = (clone $oppsQuery)->whereNotIn('stage', ['closed', 'closed_won', 'closed_lost'])->count();
        $closedDeals = (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->count();

        $totalPipelineAed = (float) (clone $oppsQuery)->whereNotIn('stage', ['closed_lost'])->sum('budget_max');
        $totalClosedWonAed = (float) (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->sum('budget_max');
        $avgDealSizeAed = $closedDeals > 0 ? round($totalClosedWonAed / $closedDeals) : 0;

        // SLA Compliance
        $overdueCount = (clone $oppsQuery)->where('sla_status', 'overdue')->count();
        $slaComplianceRate = $totalOpportunities > 0
            ? round((($totalOpportunities - $overdueCount) / $totalOpportunities) * 100, 1)
            : 100.0;

        // Conversion Rate
        $conversionRate = $filteredContactsCount > 0 
            ? round(($totalOpportunities / $filteredContactsCount) * 100, 1) 
            : 0.0;

        // 8. Real Stage Breakdown directly from DB
        $stageBreakdown = [
            'qualified' => [
                'label' => '1. Qualified',
                'count' => (clone $oppsQuery)->whereIn('stage', ['qualified', 'qualification'])->count(),
                'volume_aed' => (float) (clone $oppsQuery)->whereIn('stage', ['qualified', 'qualification'])->sum('budget_max'),
                'color' => '#2563EB',
            ],
            'option_sent' => [
                'label' => '2. Option Sent',
                'count' => (clone $oppsQuery)->where('stage', 'option_sent')->count(),
                'volume_aed' => (float) (clone $oppsQuery)->where('stage', 'option_sent')->sum('budget_max'),
                'color' => '#6366F1',
            ],
            'follow_up' => [
                'label' => '3. Follow up',
                'count' => (clone $oppsQuery)->where('stage', 'follow_up')->count(),
                'volume_aed' => (float) (clone $oppsQuery)->where('stage', 'follow_up')->sum('budget_max'),
                'color' => '#D97706',
            ],
            'meeting' => [
                'label' => '4. Meeting',
                'count' => (clone $oppsQuery)->whereIn('stage', ['meeting', 'sales_in_progress'])->count(),
                'volume_aed' => (float) (clone $oppsQuery)->whereIn('stage', ['meeting', 'sales_in_progress'])->sum('budget_max'),
                'color' => '#9333EA',
            ],
            'future_prospectus' => [
                'label' => '5. Future Prospectus',
                'count' => (clone $oppsQuery)->where('stage', 'future_prospectus')->count(),
                'volume_aed' => (float) (clone $oppsQuery)->where('stage', 'future_prospectus')->sum('budget_max'),
                'color' => '#0D9488',
            ],
            'closed' => [
                'label' => '6. Closed Won',
                'count' => (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->count(),
                'volume_aed' => (float) (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->sum('budget_max'),
                'color' => '#059669',
            ],
            'closed_lost' => [
                'label' => '7. Closed Lost',
                'count' => (clone $oppsQuery)->where('stage', 'closed_lost')->count(),
                'volume_aed' => (float) (clone $oppsQuery)->where('stage', 'closed_lost')->sum('budget_max'),
                'color' => '#EF4444',
            ],
        ];

        // 9. Lead Sources Breakdown directly from DB
        $contactsForAttribution = (clone $contactsQuery)->get(['id', 'source', 'utm_source', 'assigned_to']);
        $sourceAggregates = [];

        foreach ($contactsForAttribution as $c) {
            $raw = trim($c->source ?? 'Direct Inbound');
            if (preg_match('/^([^(]+)\s*\((.*?)\)/', $raw, $matches)) {
                $main = trim($matches[1]);
            } elseif (stripos($raw, 'uae-offplan') !== false) {
                $main = 'Website (uae-offplan)';
            } elseif (stripos($raw, 'facebook') !== false) {
                $main = 'Meta Ads (Facebook / Instagram)';
            } elseif (stripos($raw, 'google') !== false) {
                $main = 'Google Ads Search';
            } elseif (stripos($raw, 'property finder') !== false || stripos($raw, 'propertyfinder') !== false) {
                $main = 'Property Finder Portal';
            } elseif (stripos($raw, 'bayut') !== false) {
                $main = 'Bayut UAE Portal';
            } else {
                $main = $raw;
            }

            if (!isset($sourceAggregates[$main])) {
                $sourceAggregates[$main] = [
                    'source' => $main,
                    'count' => 0,
                    'opportunities' => 0,
                    'closed_won' => 0,
                ];
            }
            $sourceAggregates[$main]['count']++;
        }

        // Link opportunities to source
        $oppsByContact = Opportunity::when(!$isAll, fn($q) => $q->where('current_owner_name', $agent))
            ->whereNotNull('contact_id')
            ->pluck('stage', 'contact_id');

        foreach ($contactsForAttribution as $c) {
            if (isset($oppsByContact[$c->id])) {
                $stg = $oppsByContact[$c->id];
                $raw = trim($c->source ?? 'Direct Inbound');
                $main = $raw;
                if (stripos($raw, 'uae-offplan') !== false) $main = 'Website (uae-offplan)';
                elseif (stripos($raw, 'facebook') !== false) $main = 'Meta Ads (Facebook / Instagram)';
                elseif (stripos($raw, 'google') !== false) $main = 'Google Ads Search';
                elseif (stripos($raw, 'property finder') !== false) $main = 'Property Finder Portal';
                elseif (stripos($raw, 'bayut') !== false) $main = 'Bayut UAE Portal';

                if (isset($sourceAggregates[$main])) {
                    $sourceAggregates[$main]['opportunities']++;
                    if ($stg === 'closed' || $stg === 'closed_won') {
                        $sourceAggregates[$main]['closed_won']++;
                    }
                }
            }
        }

        $leadSourcesList = [];
        $totalAttributed = max(1, array_sum(array_column($sourceAggregates, 'count')));
        foreach ($sourceAggregates as $src) {
            $leadSourcesList[] = [
                'source' => $src['source'],
                'leads_count' => $src['count'],
                'opportunities' => $src['opportunities'],
                'closed_won' => $src['closed_won'],
                'percentage' => round(($src['count'] / $totalAttributed) * 100, 1),
                'conversion_rate' => $src['count'] > 0 ? round(($src['opportunities'] / $src['count']) * 100, 1) : 0.0,
            ];
        }
        usort($leadSourcesList, fn($a, $b) => $b['leads_count'] <=> $a['leads_count']);

        // 10. Live Agent Work Trail / Activity Audit Trail
        $recentActivities = (clone $activitiesQuery)
            ->with(['contact:id,name,phone,source', 'opportunity:id,stage,budget_max'])
            ->latest()
            ->limit(35)
            ->get()
            ->map(function ($act) {
                return [
                    'id' => $act->id,
                    'user_name' => $act->user_name,
                    'type' => $act->type,
                    'call_outcome' => $act->call_outcome,
                    'duration_seconds' => $act->duration_seconds,
                    'duration_formatted' => $this->formatDuration($act->duration_seconds),
                    'description' => $act->description,
                    'contact_name' => $act->contact->name ?? 'N/A',
                    'contact_phone' => $act->contact->phone ?? '',
                    'contact_source' => $act->contact->source ?? '',
                    'created_at' => $act->created_at ? $act->created_at->format('Y-m-d H:i') : null,
                    'time_ago' => $act->created_at ? $act->created_at->diffForHumans() : '',
                ];
            });

        // 11. Full Team Comparison Leaderboard directly from DB
        $leaderboard = [];
        foreach ($allActiveUsers as $u) {
            $uContacts = Contact::where('assigned_to', $u->name);
            $uAssignedCount = $uContacts->count();
            $uAssignedIds = (clone $uContacts)->pluck('id');

            $uContactedCount = Activity::whereIn('contact_id', $uAssignedIds)
                ->where('type', 'call')
                ->distinct('contact_id')
                ->count('contact_id');
            $uUncontactedCount = max(0, $uAssignedCount - $uContactedCount);

            $uActCalls = Activity::where('user_name', $u->name)->where('type', 'call')->count();
            $uRecCalls = CallRecording::where('agent_name', 'like', "%{$u->name}%")->count();
            $uCallsCount = $uActCalls + $uRecCalls;

            $uConnectedAct = Activity::where('user_name', $u->name)->where('type', 'call')
                ->where(function ($q) use ($connectedOutcomes) {
                    $q->whereIn('call_outcome', $connectedOutcomes)->orWhere('duration_seconds', '>', 0);
                })->count();
            $uConnectedRec = CallRecording::where('agent_name', 'like', "%{$u->name}%")
                ->where(function ($q) {
                    $q->where('call_status', 'answered')->orWhere('duration_seconds', '>', 0);
                })->count();
            $uConnectedCalls = $uConnectedAct + $uConnectedRec;

            $uTalkSecs = (int) Activity::where('user_name', $u->name)->where('type', 'call')->sum('duration_seconds')
                       + (int) CallRecording::where('agent_name', 'like', "%{$u->name}%")->sum('duration_seconds');

            $uOpps = Opportunity::where('current_owner_name', $u->name)->count();
            $uAppts = Appointment::where('agent_name', $u->name)->count();
            $uClosedWon = Opportunity::where('current_owner_name', $u->name)->whereIn('stage', ['closed', 'closed_won'])->count();
            $uClosedWonAed = (float) Opportunity::where('current_owner_name', $u->name)->whereIn('stage', ['closed', 'closed_won'])->sum('budget_max');
            $uPipelineAed = (float) Opportunity::where('current_owner_name', $u->name)->whereNotIn('stage', ['closed_lost'])->sum('budget_max');

            $uOverdue = Opportunity::where('current_owner_name', $u->name)->where('sla_status', 'overdue')->count();
            $uSla = $uOpps > 0 ? round((($uOpps - $uOverdue) / $uOpps) * 100, 1) : 100.0;
            $uConv = $uAssignedCount > 0 ? round(($uOpps / $uAssignedCount) * 100, 1) : 0.0;

            $leaderboard[] = [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'department' => $u->department ?? 'Sales',
                'initials' => strtoupper(substr($u->name, 0, 2)),
                'assigned_leads' => $uAssignedCount,
                'contacted_leads' => $uContactedCount,
                'uncontacted_leads' => $uUncontactedCount,
                'calls_made' => $uCallsCount,
                'connected_calls' => $uConnectedCalls,
                'connected_rate' => $uCallsCount > 0 ? round(($uConnectedCalls / $uCallsCount) * 100, 1) : 0,
                'total_talk_time_seconds' => $uTalkSecs,
                'talk_time_formatted' => $this->formatDuration($uTalkSecs),
                'appointments' => $uAppts,
                'opportunities_count' => $uOpps,
                'closed_won_count' => $uClosedWon,
                'closed_won_aed' => $uClosedWonAed,
                'pipeline_aed' => $uPipelineAed,
                'sla_compliance' => $uSla,
                'conversion_rate' => $uConv,
                'tier' => $uClosedWonAed > 0 ? 'Closed Producer' : ($uOpps > 0 ? 'Active Advisor' : 'Onboarding'),
            ];
        }

        usort($leaderboard, function ($a, $b) {
            if ($b['closed_won_aed'] !== $a['closed_won_aed']) {
                return $b['closed_won_aed'] <=> $a['closed_won_aed'];
            }
            if ($b['opportunities_count'] !== $a['opportunities_count']) {
                return $b['opportunities_count'] <=> $a['opportunities_count'];
            }
            return $b['calls_made'] <=> $a['calls_made'];
        });

        foreach ($leaderboard as $idx => &$item) {
            $item['rank'] = $idx + 1;
        }

        // 12. Selected Agent Dossier / Profile
        $selectedAgentProfile = null;
        if (!$isAll) {
            foreach ($leaderboard as $row) {
                if ($row['name'] === $agent) {
                    $selectedAgentProfile = $row;
                    break;
                }
            }
            if (!$selectedAgentProfile) {
                $uObj = User::where('name', $agent)->first();
                if ($uObj) {
                    $selectedAgentProfile = [
                        'id' => $uObj->id,
                        'name' => $uObj->name,
                        'email' => $uObj->email,
                        'role' => $uObj->role,
                        'department' => $uObj->department ?? 'Sales',
                        'initials' => strtoupper(substr($uObj->name, 0, 2)),
                        'assigned_leads' => $filteredContactsCount,
                        'contacted_leads' => $contactedLeadsCount,
                        'uncontacted_leads' => $uncontactedLeadsCount,
                        'calls_made' => $totalCallsLogged,
                        'connected_calls' => $connectedCalls,
                        'connected_rate' => $connectedRate,
                        'total_talk_time_seconds' => $totalTalkSeconds,
                        'talk_time_formatted' => $this->formatDuration($totalTalkSeconds),
                        'appointments' => $totalAppointments,
                        'opportunities_count' => $totalOpportunities,
                        'closed_won_count' => $closedDeals,
                        'closed_won_aed' => $totalClosedWonAed,
                        'pipeline_aed' => $totalPipelineAed,
                        'sla_compliance' => $slaComplianceRate,
                        'conversion_rate' => $conversionRate,
                        'tier' => 'Active Advisor',
                        'rank' => '-',
                    ];
                }
            }
        }

        // 13. Property Units from DB
        $totalListedUnits = OwnerRecord::count();
        $availableUnits = OwnerRecord::where('status', 'available')->count();
        $rentedUnits = OwnerRecord::where('status', 'rented')->count();
        $soldUnits = OwnerRecord::where('status', 'sold')->count();

        // 14. Telephony Summary
        $telephonyAnsweredRate = $totalCallsLogged > 0 ? round(($connectedCalls / $totalCallsLogged) * 100, 1) : 0.0;

        $metricsData = [
            'total_contacts' => $filteredContactsCount,
            'total_leads' => $filteredContactsCount,
            'total_leads_master' => $totalContactsInDb,
            'contacted_leads' => $contactedLeadsCount,
            'uncontacted_leads' => $uncontactedLeadsCount,
            'contacted_rate' => $contactedRate,
            'new_leads' => $newLeadsCount,
            'total_appointments' => $totalAppointments,
            'scheduled_appointments' => $scheduledAppointments,
            'completed_appointments' => $completedAppointments,
            'cancelled_appointments' => $cancelledAppointments,
            'qualified_opportunities' => $qualifiedOpportunities,
            'active_opportunities' => $activeOpportunities,
            'total_opportunities' => $totalOpportunities,
            'closed_deals' => $closedDeals,
            'closed_won_count' => $closedDeals,
            'calls_logged' => $totalCallsLogged,
            'total_calls' => $totalCallsLogged,
            'connected_calls' => $connectedCalls,
            'connected_rate' => $connectedRate,
            'total_talk_time_seconds' => $totalTalkSeconds,
            'talk_time_formatted' => $this->formatDuration($totalTalkSeconds),
            'avg_talk_time_seconds' => $avgTalkSeconds,
            'avg_talk_time_formatted' => $this->formatDuration($avgTalkSeconds),
            'total_pipeline_aed' => $totalPipelineAed,
            'total_closed_won_aed' => $totalClosedWonAed,
            'avg_deal_size_aed' => $avgDealSizeAed,
            'sla_compliance_rate' => $slaComplianceRate,
            'conversion_rate' => $conversionRate,
            'avg_days_to_close' => 14,
        ];

        return response()->json([
            'success' => true,
            'selected_agent' => $isAll ? 'all' : $agent,
            'is_all_advisors' => $isAll,
            'selected_agent_profile' => $selectedAgentProfile,
            'time_range' => $timeRange,
            'date_from' => $startDate ? $startDate->format('Y-m-d') : null,
            'date_to' => $endDate ? $endDate->format('Y-m-d') : null,
            'advisors_list' => $advisorsList,
            'metrics' => $metricsData,
            'call_outcomes_breakdown' => $formattedCallOutcomes,
            'recent_activities' => $recentActivities,
            'appointments_data' => [
                'total' => $totalAppointments,
                'scheduled' => $scheduledAppointments,
                'completed' => $completedAppointments,
                'cancelled' => $cancelledAppointments,
                'upcoming' => $upcomingAppointments,
            ],
            'sources_breakdown' => $leadSourcesList,
            'lead_sources' => $leadSourcesList,
            'stage_breakdown' => $stageBreakdown,
            'stageBreakdown' => $stageBreakdown,
            'agent_leaderboard' => $leaderboard,
            'leaderboard' => $leaderboard,
            'owner_stats' => [
                'total_units' => $totalListedUnits,
                'available' => $availableUnits,
                'rented' => $rentedUnits,
                'sold' => $soldUnits,
            ],
            'call_stats' => [
                'total_recordings' => $totalCallsLogged,
                'inbound_calls' => (clone $callRecordingsQuery)->where('direction', 'inbound')->count(),
                'outbound_calls' => $totalCallsLogged,
                'answered_rate' => $telephonyAnsweredRate,
                'avg_talk_time_secs' => $avgTalkSeconds,
                'avg_talk_time_formatted' => $this->formatDuration($avgTalkSeconds),
            ],
        ]);
    }

    /**
     * Resolves start and end Carbon timestamps based on time range string or custom dates.
     */
    private function resolveDateRange($timeRange, $dateFrom = null, $dateTo = null)
    {
        if (!empty($dateFrom) && !empty($dateTo)) {
            try {
                return [
                    'start' => Carbon::parse($dateFrom)->startOfDay(),
                    'end' => Carbon::parse($dateTo)->endOfDay(),
                ];
            } catch (\Exception $e) {}
        }

        $now = Carbon::now();
        switch ($timeRange) {
            case 'today':
                return [
                    'start' => $now->copy()->startOfDay(),
                    'end' => $now->copy()->endOfDay(),
                ];
            case 'yesterday':
                return [
                    'start' => $now->copy()->subDay()->startOfDay(),
                    'end' => $now->copy()->subDay()->endOfDay(),
                ];
            case 'week':
                return [
                    'start' => $now->copy()->startOfWeek(),
                    'end' => $now->copy()->endOfWeek(),
                ];
            case 'month':
                return [
                    'start' => $now->copy()->startOfMonth(),
                    'end' => $now->copy()->endOfMonth(),
                ];
            case 'quarter':
                return [
                    'start' => $now->copy()->firstOfQuarter(),
                    'end' => $now->copy()->lastOfQuarter(),
                ];
            case 'ytd':
                return [
                    'start' => $now->copy()->startOfYear(),
                    'end' => $now->copy()->endOfYear(),
                ];
            case 'all':
            default:
                return [
                    'start' => null,
                    'end' => null,
                ];
        }
    }
}
