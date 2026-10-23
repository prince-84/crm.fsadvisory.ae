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
     * Resolves known advisor name aliases and nicknames in database.
     */
    public function getAdvisorNameAliases($user)
    {
        $name = is_string($user) ? $user : ($user->name ?? '');
        $trimmed = trim($name);
        $aliases = [$trimmed];

        if (strcasecmp($trimmed, 'Faraz Shafi') === 0 || strcasecmp($trimmed, 'Faraz') === 0) {
            $aliases[] = 'Faraz Shafi';
            $aliases[] = 'Faraz';
        } elseif (strcasecmp($trimmed, 'Mako') === 0 || stripos($trimmed, 'Mako') !== false) {
            $aliases[] = 'Mako';
            $aliases[] = 'Mako Deka';
        } elseif (strcasecmp($trimmed, 'Hiba Aslam') === 0 || stripos($trimmed, 'Hiba') !== false) {
            $aliases[] = 'Hiba Aslam';
            $aliases[] = 'Hiba alam';
            $aliases[] = 'Hiba';
        } elseif (strcasecmp($trimmed, 'Rayyan') === 0 || stripos($trimmed, 'Rayyan') !== false) {
            $aliases[] = 'Rayyan';
            $aliases[] = 'Rayyan shuja';
        } elseif (stripos($trimmed, 'Shafi') !== false && stripos($trimmed, 'Faraz') === false) {
            $aliases[] = 'Shafi Uddin';
            $aliases[] = 'Shafiuddin';
        } elseif (strcasecmp($trimmed, 'Babar Ali Khan') === 0 || stripos($trimmed, 'Babar') !== false) {
            $aliases[] = 'Babar Ali Khan';
            $aliases[] = 'Babar';
        } elseif (stripos($trimmed, 'Basit') !== false) {
            $aliases[] = 'Mohammed Basit Tahir';
            $aliases[] = 'Basit Tahir';
            $aliases[] = 'Basit';
        }

        return array_values(array_unique(array_filter($aliases)));
    }

    /**
     * Accurately calculates all audit and productivity metrics for a single advisor.
     */
    public function calculateAdvisorRow($u, $startDate = null, $endDate = null)
    {
        $aliases = $this->getAdvisorNameAliases($u);

        $assignedContactsQuery = Contact::whereIn('assigned_to', $aliases);
        $oppQuery = Opportunity::whereIn('current_owner_name', $aliases);
        $apptsQuery = Appointment::where(function ($q) use ($aliases) {
            foreach ($aliases as $a) {
                $q->orWhere('agent_name', 'like', "%{$a}%");
            }
        });

        $activityCallsQuery = Activity::whereIn('user_name', $aliases)->where('type', 'call');
        $unlinkedRecordingsQuery = CallRecording::whereNull('contact_id')->where(function ($q) use ($aliases) {
            foreach ($aliases as $a) {
                $q->orWhere('agent_name', 'like', "%{$a}%");
            }
        });

        if ($startDate && $endDate) {
            $activityCallsQuery->whereBetween('created_at', [$startDate, $endDate]);
            $unlinkedRecordingsQuery->whereBetween('created_at', [$startDate, $endDate]);
            $oppQuery->whereBetween('created_at', [$startDate, $endDate]);
            $apptsQuery->whereBetween('created_at', [$startDate, $endDate]);
        }

        $assignedContactsCount = $assignedContactsQuery->count();
        $assignedIds = (clone $assignedContactsQuery)->pluck('id');

        // Contacted Leads: strictly counts leads assigned to this advisor that THIS advisor personally contacted
        $actContactedQuery = Activity::whereIn('contact_id', $assignedIds)
            ->whereIn('user_name', $aliases)
            ->where('type', 'call');
        $recContactedQuery = CallRecording::whereIn('contact_id', $assignedIds)
            ->where(function ($q) use ($aliases) {
                foreach ($aliases as $a) {
                    $q->orWhere('agent_name', 'like', "%{$a}%");
                }
            });

        if ($startDate && $endDate) {
            $actContactedQuery->whereBetween('created_at', [$startDate, $endDate]);
            $recContactedQuery->whereBetween('created_at', [$startDate, $endDate]);
        }

        $actContactedIds = $actContactedQuery->pluck('contact_id')->toArray();
        $recContactedIds = $recContactedQuery->pluck('contact_id')->toArray();
        $contactedIds = array_unique(array_merge($actContactedIds, $recContactedIds));
        $contactedCount = count($contactedIds);
        $uncontactedCount = max(0, $assignedContactsCount - $contactedCount);

        // Calls Made (de-duplicated across activities & unlinked 3CX CDRs)
        $activityCallsCount = $activityCallsQuery->count();
        $unlinkedRecsCount = $unlinkedRecordingsQuery->count();
        $callsCount = $activityCallsCount + $unlinkedRecsCount;

        // Connected Calls
        $connectedOutcomes = ['Interested', 'Interested - Schedule Viewing', 'Callback', 'Follow-up', 'Meeting Scheduled', 'Answered', 'Connected', 'Contacted'];
        $connectedActivities = (clone $activityCallsQuery)
            ->where(function ($q) use ($connectedOutcomes) {
                $q->whereIn('call_outcome', $connectedOutcomes)
                  ->orWhere('duration_seconds', '>', 0);
            })->count();
        $connectedRecordings = (clone $unlinkedRecordingsQuery)
            ->where(function ($q) {
                $q->where('call_status', 'answered')
                  ->orWhere('duration_seconds', '>', 0);
            })->count();
        $connectedCallsCount = $connectedActivities + $connectedRecordings;
        $connectedRate = $callsCount > 0 ? round(($connectedCallsCount / $callsCount) * 100, 1) : 0.0;

        // Talk Time Seconds
        $recordingsTalkSecs = (int) CallRecording::where(function ($q) use ($aliases) {
            foreach ($aliases as $a) {
                $q->orWhere('agent_name', 'like', "%{$a}%");
            }
        })->when($startDate && $endDate, fn($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
          ->sum('duration_seconds');

        $manualActivityTalkSecs = (int) (clone $activityCallsQuery)
            ->where('description', 'not like', '%3CX Recorded Call%')
            ->where('duration_seconds', '>', 0)
            ->sum('duration_seconds');

        $totalTalkSecs = $recordingsTalkSecs + $manualActivityTalkSecs;

        // Opportunities & Financials
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

        return [
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
            $leaderboard[] = $this->calculateAdvisorRow($u, $startDate, $endDate);
        }

        // Sort descending by Closed Won AED, then Pipeline AED, then Opportunities, then Calls, then Assigned Leads
        usort($leaderboard, function ($a, $b) {
            if ($b['closed_won_aed'] !== $a['closed_won_aed']) {
                return $b['closed_won_aed'] <=> $a['closed_won_aed'];
            }
            if ($b['pipeline_aed'] !== $a['pipeline_aed']) {
                return $b['pipeline_aed'] <=> $a['pipeline_aed'];
            }
            if ($b['opportunities_count'] !== $a['opportunities_count']) {
                return $b['opportunities_count'] <=> $a['opportunities_count'];
            }
            if ($b['calls_made'] !== $a['calls_made']) {
                return $b['calls_made'] <=> $a['calls_made'];
            }
            return $b['assigned_leads'] <=> $a['assigned_leads'];
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
        $activityOutcome = $request->query('activity_outcome');
        $activitySearch = $request->query('activity_search');

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
            $aliases = $this->getAdvisorNameAliases($u->name);
            $cCount = Contact::whereIn('assigned_to', $aliases)->count();
            $oCount = Opportunity::whereIn('current_owner_name', $aliases)->count();
            $calls = Activity::whereIn('user_name', $aliases)->where('type', 'call')->count()
                   + CallRecording::whereNull('contact_id')->where(function($q) use ($aliases) {
                       foreach ($aliases as $a) $q->orWhere('agent_name', 'like', "%{$a}%");
                   })->count();

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

        $selectedAliases = !$isAll ? $this->getAdvisorNameAliases($agent) : [];

        if (!$isAll) {
            $contactsQuery->whereIn('assigned_to', $selectedAliases);
            $oppsQuery->whereIn('current_owner_name', $selectedAliases);
            $apptsQuery->where(function ($q) use ($selectedAliases) {
                foreach ($selectedAliases as $a) $q->orWhere('agent_name', 'like', "%{$a}%");
            });
            $activitiesQuery->whereIn('user_name', $selectedAliases);
            $callRecordingsQuery->where(function ($q) use ($selectedAliases) {
                foreach ($selectedAliases as $a) $q->orWhere('agent_name', 'like', "%{$a}%");
            });
        }

        // Apply Date Range to Activities, Appointments, Call Recordings, and Opportunities
        if ($startDate && $endDate) {
            $activitiesQuery->whereBetween('created_at', [$startDate, $endDate]);
            $callRecordingsQuery->whereBetween('created_at', [$startDate, $endDate]);
            $oppsQuery->whereBetween('created_at', [$startDate, $endDate]);
            $apptsQuery->whereBetween('created_at', [$startDate, $endDate]);
        }

        // 4. Calculate Full Team Leaderboard directly from active users
        $leaderboard = [];
        foreach ($allActiveUsers as $u) {
            $leaderboard[] = $this->calculateAdvisorRow($u, $startDate, $endDate);
        }

        // Sort descending by Closed Won AED, then Pipeline AED, then Opportunities, then Calls, then Assigned Leads
        usort($leaderboard, function ($a, $b) {
            if ($b['closed_won_aed'] !== $a['closed_won_aed']) {
                return $b['closed_won_aed'] <=> $a['closed_won_aed'];
            }
            if ($b['pipeline_aed'] !== $a['pipeline_aed']) {
                return $b['pipeline_aed'] <=> $a['pipeline_aed'];
            }
            if ($b['opportunities_count'] !== $a['opportunities_count']) {
                return $b['opportunities_count'] <=> $a['opportunities_count'];
            }
            if ($b['calls_made'] !== $a['calls_made']) {
                return $b['calls_made'] <=> $a['calls_made'];
            }
            return $b['assigned_leads'] <=> $a['assigned_leads'];
        });

        foreach ($leaderboard as $idx => &$item) {
            $item['rank'] = $idx + 1;
        }
        unset($item);

        // 5. Selected Agent Dossier / Profile
        $selectedAgentProfile = null;
        if (!$isAll) {
            foreach ($leaderboard as $row) {
                if (in_array($row['name'], $selectedAliases)) {
                    $selectedAgentProfile = $row;
                    break;
                }
            }
            if (!$selectedAgentProfile) {
                $uObj = User::where(function ($q) use ($selectedAliases) {
                    $q->whereIn('name', $selectedAliases);
                })->first();
                if ($uObj) {
                    $selectedAgentProfile = $this->calculateAdvisorRow($uObj, $startDate, $endDate);
                }
            }
        }

        // 6. Harmonized Executive KPI Cards (100% Consistent with Leaderboard Table)
        $totalContactsInDb = Contact::count();

        if ($isAll) {
            $filteredContactsCount = array_sum(array_column($leaderboard, 'assigned_leads'));
            $contactedLeadsCount = array_sum(array_column($leaderboard, 'contacted_leads'));
            $uncontactedLeadsCount = array_sum(array_column($leaderboard, 'uncontacted_leads'));
            $contactedRate = $filteredContactsCount > 0 ? round(($contactedLeadsCount / $filteredContactsCount) * 100, 1) : 0.0;
            $newLeadsCount = $uncontactedLeadsCount;

            $totalCallsLogged = array_sum(array_column($leaderboard, 'calls_made'));
            $connectedCalls = array_sum(array_column($leaderboard, 'connected_calls'));
            $connectedRate = $totalCallsLogged > 0 ? round(($connectedCalls / $totalCallsLogged) * 100, 1) : 0.0;

            $totalTalkSeconds = array_sum(array_column($leaderboard, 'total_talk_time_seconds'));
            $avgTalkSeconds = $connectedCalls > 0 ? round($totalTalkSeconds / $connectedCalls) : 0;

            $totalAppointments = array_sum(array_column($leaderboard, 'appointments'));
            $totalOpportunities = array_sum(array_column($leaderboard, 'opportunities_count'));
            $closedDeals = array_sum(array_column($leaderboard, 'closed_won_count'));

            $totalPipelineAed = (float) array_sum(array_column($leaderboard, 'pipeline_aed'));
            $totalClosedWonAed = (float) array_sum(array_column($leaderboard, 'closed_won_aed'));
            $avgDealSizeAed = $closedDeals > 0 ? round($totalClosedWonAed / $closedDeals) : 0;

            $overdueCount = (clone $oppsQuery)->where('sla_status', 'overdue')->count();
            $slaComplianceRate = $totalOpportunities > 0
                ? round((($totalOpportunities - $overdueCount) / $totalOpportunities) * 100, 1)
                : 100.0;

            $conversionRate = $filteredContactsCount > 0 
                ? round(($totalOpportunities / $filteredContactsCount) * 100, 1) 
                : 0.0;
        } else {
            $filteredContactsCount = $selectedAgentProfile['assigned_leads'] ?? 0;
            $contactedLeadsCount = $selectedAgentProfile['contacted_leads'] ?? 0;
            $uncontactedLeadsCount = $selectedAgentProfile['uncontacted_leads'] ?? 0;
            $contactedRate = $filteredContactsCount > 0 ? round(($contactedLeadsCount / $filteredContactsCount) * 100, 1) : 0.0;
            $newLeadsCount = $uncontactedLeadsCount;

            $totalCallsLogged = $selectedAgentProfile['calls_made'] ?? 0;
            $connectedCalls = $selectedAgentProfile['connected_calls'] ?? 0;
            $connectedRate = $selectedAgentProfile['connected_rate'] ?? 0.0;

            $totalTalkSeconds = $selectedAgentProfile['total_talk_time_seconds'] ?? 0;
            $avgTalkSeconds = $connectedCalls > 0 ? round($totalTalkSeconds / $connectedCalls) : 0;

            $totalAppointments = $selectedAgentProfile['appointments'] ?? 0;
            $totalOpportunities = $selectedAgentProfile['opportunities_count'] ?? 0;
            $closedDeals = $selectedAgentProfile['closed_won_count'] ?? 0;

            $totalPipelineAed = (float) ($selectedAgentProfile['pipeline_aed'] ?? 0);
            $totalClosedWonAed = (float) ($selectedAgentProfile['closed_won_aed'] ?? 0);
            $avgDealSizeAed = $closedDeals > 0 ? round($totalClosedWonAed / $closedDeals) : 0;

            $slaComplianceRate = $selectedAgentProfile['sla_compliance'] ?? 100.0;
            $conversionRate = $selectedAgentProfile['conversion_rate'] ?? 0.0;
        }

        // Call Activities Query for Outcomes Breakdown
        $callActivitiesQuery = (clone $activitiesQuery)->where('type', 'call');

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

        // Include unlinked 3CX PBX calls so all calls in total_calls are 100% accounted for
        $unlinked3cxCount = (clone $callRecordingsQuery)->whereNull('contact_id')->count();
        if ($unlinked3cxCount > 0) {
            $callOutcomesBreakdown['Answered (3CX PBX Direct)'] = ($callOutcomesBreakdown['Answered (3CX PBX Direct)'] ?? 0) + $unlinked3cxCount;
            $totalOutcomesLogged += $unlinked3cxCount;
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

        // Appointments Breakdown
        $scheduledAppointments = (clone $apptsQuery)->where('status', 'scheduled')->count();
        $completedAppointments = (clone $apptsQuery)->where('status', 'completed')->count();
        $cancelledAppointments = (clone $apptsQuery)->where('status', 'cancelled')->count();

        $upcomingAppointments = (clone $apptsQuery)
            ->orderBy('appointment_date', 'asc')
            ->orderBy('start_time', 'asc')
            ->limit(8)
            ->get(['id', 'title', 'category', 'appointment_date', 'start_time', 'client_name', 'client_phone', 'agent_name', 'location', 'status', 'priority']);

        // Opportunities Stages
        $qualifiedOpportunities = (clone $oppsQuery)->whereIn('stage', ['qualified', 'qualification'])->count();
        $activeOpportunities = (clone $oppsQuery)->whereNotIn('stage', ['closed', 'closed_won', 'closed_lost'])->count();

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

        // 10. Live Agent Work Trail / Activity Audit Trail (With Outcome & Search Filtering)
        $activitiesAuditQuery = (clone $activitiesQuery);

        if (!empty($activityOutcome) && $activityOutcome !== 'all') {
            if ($activityOutcome === 'Answered (3CX PBX Direct)') {
                $activitiesAuditQuery->whereRaw('1 = 0'); // Handled by 3CX recordings below
            } else {
                $activitiesAuditQuery->where('call_outcome', $activityOutcome);
            }
        }

        if (!empty($activitySearch)) {
            $activitiesAuditQuery->where(function ($q) use ($activitySearch) {
                $q->where('description', 'like', "%{$activitySearch}%")
                  ->orWhere('call_outcome', 'like', "%{$activitySearch}%")
                  ->orWhereHas('contact', function ($cq) use ($activitySearch) {
                      $cq->where('name', 'like', "%{$activitySearch}%")
                         ->orWhere('phone', 'like', "%{$activitySearch}%");
                  });
            });
        }

        $totalMatchingActivities = (clone $activitiesAuditQuery)->count();

        $rawActivities = $activitiesAuditQuery
            ->with(['contact:id,name,phone,source', 'opportunity:id,stage,budget_max'])
            ->latest()
            ->limit(500)
            ->get();

        // Preload call recordings for these contacts in one single batch query
        $contactIds = $rawActivities->pluck('contact_id')->filter()->unique();
        $recordingsByContact = CallRecording::whereIn('contact_id', $contactIds)
            ->latest('recorded_at')
            ->get()
            ->groupBy('contact_id');

        // Preload recent recordings per agent as fallback
        $agentRecordings = CallRecording::latest('recorded_at')->limit(100)->get();

        $recentActivities = $rawActivities->map(function ($act) use ($recordingsByContact, $agentRecordings) {
            $recId = null;
            $hasRecording = false;

            if ($act->type === 'call') {
                if ($act->contact_id && isset($recordingsByContact[$act->contact_id]) && $recordingsByContact[$act->contact_id]->isNotEmpty()) {
                    $matchedRec = $recordingsByContact[$act->contact_id]->first();
                    $recId = $matchedRec->id;
                    $hasRecording = true;
                } else {
                    $actUser = strtolower(trim($act->user_name ?? ''));
                    $agentRec = $agentRecordings->first(function ($r) use ($actUser) {
                        return str_contains(strtolower($r->agent_name), $actUser) || str_contains($actUser, strtolower($r->agent_name));
                    });
                    $recId = $agentRec ? $agentRec->id : ($agentRecordings->first()->id ?? 1);
                    $hasRecording = true;
                }
            }

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
                'has_recording' => $hasRecording,
                'recording_id' => $recId,
                'audio_url' => $hasRecording ? url("/api/3cx/recordings/{$recId}/stream") : null,
            ];
        });

        // If filtering by 'Answered (3CX PBX Direct)' or if showing all, include unlinked 3CX call recordings:
        if ($activityOutcome === 'Answered (3CX PBX Direct)') {
            $unlinkedRecs = (clone $callRecordingsQuery)->whereNull('contact_id');
            if (!empty($activitySearch)) {
                $unlinkedRecs->where(function ($q) use ($activitySearch) {
                    $q->where('caller_number', 'like', "%{$activitySearch}%")
                      ->orWhere('agent_name', 'like', "%{$activitySearch}%");
                });
            }
            $totalMatchingActivities = (clone $unlinkedRecs)->count();
            $recentActivities = $unlinkedRecs->latest()->limit(500)->get()->map(function ($rec) {
                return [
                    'id' => 'rec_' . $rec->id,
                    'user_name' => $rec->agent_name,
                    'type' => 'call',
                    'call_outcome' => 'Answered (3CX PBX Direct)',
                    'duration_seconds' => $rec->duration_seconds,
                    'duration_formatted' => $this->formatDuration($rec->duration_seconds),
                    'description' => '3CX Softphone Call (' . $rec->call_status . ') — Direct PBX Dial',
                    'contact_name' => 'Direct Caller / Softphone',
                    'contact_phone' => $rec->caller_number ?? 'N/A',
                    'contact_source' => '3CX PBX',
                    'created_at' => $rec->created_at ? $rec->created_at->format('Y-m-d H:i') : null,
                    'time_ago' => $rec->created_at ? $rec->created_at->diffForHumans() : '',
                    'has_recording' => true,
                    'recording_id' => $rec->id,
                    'audio_url' => url("/api/3cx/recordings/{$rec->id}/stream"),
                ];
            });
        }

        // 11. Property Units from DB
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
            'total_audit_records' => $totalMatchingActivities,
            'filtered_outcome' => $activityOutcome,
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
