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
use App\Models\OwnershipHistory;
use App\Models\Appointment;
use App\Models\LeadSource;
use App\Models\LeadSubSource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Comprehensive Team Performance & Leaderboard (100% Database Connected)
     */
    public function teamPerformance(Request $request)
    {
        $users = User::orderBy('name', 'asc')->get();

        $leaderboard = [];

        foreach ($users as $u) {
            $assignedContacts = Contact::where('assigned_to', $u->name)->count();

            // Real calls from call_recordings + activities where type = call
            $dbRecordings = CallRecording::where('agent_name', 'like', "%{$u->name}%")
                ->orWhere('agent_extension', $u->id)
                ->count();
            $activityCalls = Activity::where('user_name', $u->name)
                ->where('type', 'call')
                ->count();
            $callsCount = $dbRecordings + $activityCalls;

            // Real opportunities
            $oppCount = Opportunity::where('current_owner_name', $u->name)->count();
            $closedWonCount = Opportunity::where('current_owner_name', $u->name)
                ->whereIn('stage', ['closed', 'closed_won'])
                ->count();
            $closedWonAed = (float) Opportunity::where('current_owner_name', $u->name)
                ->whereIn('stage', ['closed', 'closed_won'])
                ->sum('budget_max');
            $pipelineAed = (float) Opportunity::where('current_owner_name', $u->name)
                ->whereNotIn('stage', ['closed_lost'])
                ->sum('budget_max');

            // Real appointments
            $apptsCount = Appointment::where('agent_name', $u->name)->count();

            // Real SLA compliance
            $overdueCount = Opportunity::where('current_owner_name', $u->name)
                ->where('sla_status', 'overdue')
                ->count();
            $slaCompliance = $oppCount > 0 
                ? round((($oppCount - $overdueCount) / $oppCount) * 100, 1) 
                : 100.0;

            $conversionRate = $assignedContacts > 0 
                ? round(($oppCount / $assignedContacts) * 100, 1) 
                : 0.0;

            $leaderboard[] = [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'department' => $u->department ?? 'Sales',
                'initials' => strtoupper(substr($u->name, 0, 2)),
                'is_active' => $u->is_active,
                'assigned_leads' => $assignedContacts,
                'calls_made' => $callsCount,
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

        // Sort descending by Closed Won Volume, then by opportunities, then by leads
        usort($leaderboard, function ($a, $b) {
            if ($b['closed_won_aed'] !== $a['closed_won_aed']) {
                return $b['closed_won_aed'] <=> $a['closed_won_aed'];
            }
            if ($b['opportunities_count'] !== $a['opportunities_count']) {
                return $b['opportunities_count'] <=> $a['opportunities_count'];
            }
            return $b['assigned_leads'] <=> $a['assigned_leads'];
        });

        // Assign ranking #1 to #N
        foreach ($leaderboard as $idx => &$item) {
            $item['rank'] = $idx + 1;
        }

        // Summary Aggregates directly from DB
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

    /**
     * Master Executive Dashboard Analytics (100% Database Connected)
     * Real-time metrics for Boss view ('all') and Individual Advisor filters.
     */
    public function analytics(Request $request)
    {
        $agent = $request->query('agent');
        $isAll = empty($agent) || $agent === 'all';

        // 1. Fetch active advisors directly from DB for top bar filter
        $advisorsList = User::where('is_active', true)
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'role', 'email'])
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'role' => $u->role,
                    'email' => $u->email,
                    'initials' => strtoupper(substr($u->name, 0, 2)),
                    'assigned_leads' => Contact::where('assigned_to', $u->name)->count(),
                    'opportunities_count' => Opportunity::where('current_owner_name', $u->name)->count(),
                    'appointments_count' => Appointment::where('agent_name', $u->name)->count(),
                ];
            });

        // 2. Base database queries conditioned on selected advisor
        $contactsQuery = Contact::query();
        $oppsQuery = Opportunity::query();
        $apptsQuery = Appointment::query();
        $callsQuery = CallRecording::query();

        if (!$isAll) {
            $contactsQuery->where('assigned_to', $agent);
            $oppsQuery->where('current_owner_name', $agent);
            $apptsQuery->where('agent_name', $agent);
            $callsQuery->where('agent_name', 'like', "%{$agent}%");
        }

        // 3. Real Database Metric Counts
        $totalContactsInDb = Contact::count();
        $filteredContactsCount = (clone $contactsQuery)->count();

        // Fresh / Uncontacted leads awaiting outreach
        $newLeadsCount = (clone $contactsQuery)
            ->whereDoesntHave('activities', fn($q) => $q->where('type', 'call'))
            ->count();

        // Appointments from DB
        $totalAppointments = (clone $apptsQuery)->count();
        $scheduledAppointments = (clone $apptsQuery)->where('status', 'scheduled')->count();
        $completedAppointments = (clone $apptsQuery)->where('status', 'completed')->count();
        $cancelledAppointments = (clone $apptsQuery)->where('status', 'cancelled')->count();

        // Real upcoming appointments list from DB
        $upcomingAppointments = (clone $apptsQuery)
            ->orderBy('appointment_date', 'asc')
            ->orderBy('start_time', 'asc')
            ->limit(8)
            ->get(['id', 'title', 'category', 'appointment_date', 'start_time', 'client_name', 'client_phone', 'agent_name', 'location', 'status', 'priority']);

        // Opportunities from DB
        $totalOpportunities = (clone $oppsQuery)->count();
        $qualifiedOpportunities = (clone $oppsQuery)->whereIn('stage', ['qualified', 'qualification'])->count();
        $activeOpportunities = (clone $oppsQuery)->whereNotIn('stage', ['closed', 'closed_won', 'closed_lost'])->count();
        $closedDeals = (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->count();

        // Real financial sums directly from DB
        $totalPipelineAed = (float) (clone $oppsQuery)->whereNotIn('stage', ['closed_lost'])->sum('budget_max');
        $totalClosedWonAed = (float) (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->sum('budget_max');

        // Real calls logged from DB
        $dbCallsCount = (clone $callsQuery)->count();
        $activityCallsCount = Activity::when(!$isAll, fn($q) => $q->where('user_name', $agent))
            ->where('type', 'call')
            ->count();
        $callsLogged = $dbCallsCount + $activityCallsCount;

        // SLA Compliance directly from DB
        $overdueCount = (clone $oppsQuery)->where('sla_status', 'overdue')->count();
        $slaComplianceRate = $totalOpportunities > 0
            ? round((($totalOpportunities - $overdueCount) / $totalOpportunities) * 100, 1)
            : 100.0;

        // Conversion Rate directly from DB
        $conversionRate = $filteredContactsCount > 0 
            ? round(($totalOpportunities / $filteredContactsCount) * 100, 1) 
            : 0.0;

        // 4. Sources & Sub-Sources Breakdown directly from DB
        $contactsForAttribution = (clone $contactsQuery)->get(['id', 'source', 'utm_source', 'assigned_to']);

        $sourceAggregates = [];
        $subSourceAggregates = [];

        foreach ($contactsForAttribution as $c) {
            $raw = trim($c->source ?? 'Direct Inbound');

            if (preg_match('/^([^(]+)\s*\((.*?)\)/', $raw, $matches)) {
                $main = trim($matches[1]);
                $sub = trim($matches[2]);
            } elseif (stripos($raw, 'uae-offplan') !== false) {
                $main = 'Website';
                $sub = 'uae-offplan';
            } elseif (stripos($raw, 'facebook') !== false) {
                $main = 'Meta Ads (Facebook)';
                $sub = $c->utm_source ?: 'Digital Campaign';
            } elseif (stripos($raw, 'google') !== false) {
                $main = 'Google Ads Search';
                $sub = $c->utm_source ?: 'PPC Search';
            } elseif (stripos($raw, 'property finder') !== false || stripos($raw, 'propertyfinder') !== false) {
                $main = 'Property Finder Portal';
                $sub = 'Listing Inbound';
            } elseif (stripos($raw, 'bayut') !== false) {
                $main = 'Bayut UAE Portal';
                $sub = 'Listing Inbound';
            } else {
                $main = $raw;
                $sub = $c->utm_source ?: 'General / Direct';
            }

            if ($main === 'Website' || $main === 'WEB' || $main === 'Website Inbound') {
                $main = 'Website & Landing Pages';
            } elseif (stripos($main, 'Facebook') !== false || stripos($main, 'Meta') !== false) {
                $main = 'Meta Ads (Facebook / Instagram)';
            }

            $channel = 'Direct Inbound';
            if (stripos($main, 'Meta') !== false || stripos($main, 'Facebook') !== false || stripos($main, 'Instagram') !== false || stripos($main, 'TikTok') !== false) {
                $channel = 'Paid Social';
            } elseif (stripos($main, 'Google') !== false) {
                $channel = 'Paid Search (PPC)';
            } elseif (stripos($main, 'Property Finder') !== false || stripos($main, 'Bayut') !== false || stripos($main, 'Dubizzle') !== false) {
                $channel = 'Real Estate Portal';
            } elseif (stripos($main, 'Referral') !== false) {
                $channel = 'Referral Network';
            }

            if (!isset($sourceAggregates[$main])) {
                $sourceAggregates[$main] = [
                    'source' => $main,
                    'channel_type' => $channel,
                    'count' => 0,
                    'opportunities' => 0,
                    'closed_won' => 0,
                    'sub_sources' => [],
                ];
            }
            $sourceAggregates[$main]['count']++;
            if (!isset($sourceAggregates[$main]['sub_sources'][$sub])) {
                $sourceAggregates[$main]['sub_sources'][$sub] = 0;
            }
            $sourceAggregates[$main]['sub_sources'][$sub]++;

            $subKey = $main . '|||' . $sub;
            if (!isset($subSourceAggregates[$subKey])) {
                $subSourceAggregates[$subKey] = [
                    'sub_source' => $sub,
                    'parent_source' => $main,
                    'channel_type' => $channel,
                    'count' => 0,
                    'opportunities' => 0,
                ];
            }
            $subSourceAggregates[$subKey]['count']++;
        }

        // Link opportunities directly by contact_id
        $contactOpps = Opportunity::when(!$isAll, fn($q) => $q->where('current_owner_name', $agent))
            ->whereNotNull('contact_id')
            ->pluck('stage', 'contact_id');

        foreach ($contactsForAttribution as $c) {
            if (isset($contactOpps[$c->id])) {
                $stg = $contactOpps[$c->id];
                $raw = trim($c->source ?? 'Direct Inbound');
                $main = 'Website & Landing Pages';
                $sub = 'General';

                if (preg_match('/^([^(]+)\s*\((.*?)\)/', $raw, $matches)) {
                    $main = trim($matches[1]);
                    $sub = trim($matches[2]);
                } elseif (stripos($raw, 'uae-offplan') !== false) {
                    $main = 'Website & Landing Pages';
                    $sub = 'uae-offplan';
                } elseif (stripos($raw, 'facebook') !== false) {
                    $main = 'Meta Ads (Facebook / Instagram)';
                    $sub = $c->utm_source ?: 'Digital Campaign';
                }

                if (isset($sourceAggregates[$main])) {
                    $sourceAggregates[$main]['opportunities']++;
                    if ($stg === 'closed' || $stg === 'closed_won') {
                        $sourceAggregates[$main]['closed_won']++;
                    }
                }

                $subKey = $main . '|||' . $sub;
                if (isset($subSourceAggregates[$subKey])) {
                    $subSourceAggregates[$subKey]['opportunities']++;
                }
            }
        }

        // Format Sources List
        $totalAttributedLeads = max(1, array_sum(array_column($sourceAggregates, 'count')));
        $leadSourcesList = [];
        foreach ($sourceAggregates as $src) {
            $formattedSub = [];
            foreach ($src['sub_sources'] as $sName => $sCount) {
                $formattedSub[] = [
                    'name' => $sName,
                    'count' => $sCount,
                    'percentage' => round(($sCount / max(1, $src['count'])) * 100, 1),
                ];
            }
            usort($formattedSub, fn($a, $b) => $b['count'] <=> $a['count']);

            $leadSourcesList[] = [
                'source' => $src['source'],
                'channel_type' => $src['channel_type'],
                'leads_count' => $src['count'],
                'percentage' => round(($src['count'] / $totalAttributedLeads) * 100, 1),
                'opportunities' => $src['opportunities'],
                'closed_won' => $src['closed_won'],
                'conversion_rate' => $src['count'] > 0 ? round(($src['opportunities'] / $src['count']) * 100, 1) : 0.0,
                'sub_sources' => $formattedSub,
            ];
        }
        usort($leadSourcesList, fn($a, $b) => $b['leads_count'] <=> $a['leads_count']);

        // Format Sub-Sources List
        $subSourcesList = [];
        foreach ($subSourceAggregates as $subItem) {
            $subSourcesList[] = [
                'sub_source' => $subItem['sub_source'],
                'parent_source' => $subItem['parent_source'],
                'channel_type' => $subItem['channel_type'],
                'leads_count' => $subItem['count'],
                'percentage' => round(($subItem['count'] / $totalAttributedLeads) * 100, 1),
                'opportunities' => $subItem['opportunities'],
                'conversion_rate' => $subItem['count'] > 0 ? round(($subItem['opportunities'] / $subItem['count']) * 100, 1) : 0.0,
            ];
        }
        usort($subSourcesList, fn($a, $b) => $b['leads_count'] <=> $a['leads_count']);

        // 5. Real Stage Breakdown directly from DB
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
                'label' => '6. Closed',
                'count' => (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->count(),
                'volume_aed' => (float) (clone $oppsQuery)->whereIn('stage', ['closed', 'closed_won'])->sum('budget_max'),
                'color' => '#059669',
            ],
        ];

        // 6. Advisor Performance Leaderboard directly from DB
        $users = User::orderBy('name', 'asc')->get();
        $leaderboard = [];

        foreach ($users as $u) {
            $realCalls = CallRecording::where('agent_name', 'like', "%{$u->name}%")->count();
            $actCalls = Activity::where('user_name', $u->name)->where('type', 'call')->count();
            $callsCount = $realCalls + $actCalls;

            $oppCount = Opportunity::where('current_owner_name', $u->name)->count();
            $contactsCount = Contact::where('assigned_to', $u->name)->count();
            $apptsCount = Appointment::where('agent_name', $u->name)->count();
            $closedCount = Opportunity::where('current_owner_name', $u->name)->whereIn('stage', ['closed', 'closed_won'])->count();
            $closedAed = (float) Opportunity::where('current_owner_name', $u->name)->whereIn('stage', ['closed', 'closed_won'])->sum('budget_max');

            $userOverdue = Opportunity::where('current_owner_name', $u->name)->where('sla_status', 'overdue')->count();
            $userSla = $oppCount > 0 ? round((($oppCount - $userOverdue) / $oppCount) * 100, 1) : 100.0;

            $leaderboard[] = [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'initials' => strtoupper(substr($u->name, 0, 2)),
                'assigned_leads' => $contactsCount,
                'calls_made' => $callsCount,
                'appointments' => $apptsCount,
                'opportunities_count' => $oppCount,
                'closed_won_count' => $closedCount,
                'closed_won_aed' => $closedAed,
                'sla_compliance' => $userSla,
                'tier' => $closedAed > 0 ? 'Closed Producer' : ($oppCount > 0 ? 'Active Advisor' : 'Onboarding'),
            ];
        }

        // Sort descending by Closed Won AED, then Opportunities, then Leads
        usort($leaderboard, function ($a, $b) {
            if ($b['closed_won_aed'] !== $a['closed_won_aed']) {
                return $b['closed_won_aed'] <=> $a['closed_won_aed'];
            }
            if ($b['opportunities_count'] !== $a['opportunities_count']) {
                return $b['opportunities_count'] <=> $a['opportunities_count'];
            }
            return $b['assigned_leads'] <=> $a['assigned_leads'];
        });

        foreach ($leaderboard as $idx => &$item) {
            $item['rank'] = $idx + 1;
        }

        // 7. Recent SLA Breaches directly from DB
        $recentBreaches = SlaBreach::latest()->limit(5)->get();

        return response()->json([
            'success' => true,
            'selected_agent' => $isAll ? 'all' : $agent,
            'is_all_advisors' => $isAll,
            'advisors_list' => $advisorsList,
            'metrics' => [
                'total_leads' => $filteredContactsCount,
                'total_leads_master' => $totalContactsInDb,
                'new_leads' => $newLeadsCount,
                'total_appointments' => $totalAppointments,
                'scheduled_appointments' => $scheduledAppointments,
                'completed_appointments' => $completedAppointments,
                'cancelled_appointments' => $cancelledAppointments,
                'qualified_opportunities' => $qualifiedOpportunities,
                'active_opportunities' => $activeOpportunities,
                'total_opportunities' => $totalOpportunities,
                'closed_deals' => $closedDeals,
                'calls_logged' => $callsLogged,
                'total_pipeline_aed' => $totalPipelineAed,
                'total_closed_won_aed' => $totalClosedWonAed,
                'sla_compliance_rate' => $slaComplianceRate,
                'conversion_rate' => $conversionRate,
            ],
            'appointments_data' => [
                'total' => $totalAppointments,
                'scheduled' => $scheduledAppointments,
                'completed' => $completedAppointments,
                'cancelled' => $cancelledAppointments,
                'upcoming' => $upcomingAppointments,
            ],
            'sources_breakdown' => $leadSourcesList,
            'sub_sources_breakdown' => $subSourcesList,
            'stage_breakdown' => $stageBreakdown,
            'agent_leaderboard' => $leaderboard,
            'recent_breaches' => $recentBreaches,
        ]);
    }
}
