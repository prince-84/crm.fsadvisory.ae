<?php

namespace App\Services;

use App\Models\LeadDistributionSetting;
use App\Models\LeadDistributionLog;
use App\Models\User;
use App\Models\Opportunity;
use App\Models\OwnerRecord;
use App\Models\Contact;
use App\Models\BuyerQualification;
use App\Models\Activity;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class LeadDistributionService
{
    /**
     * Fetch the current active singleton settings
     */
    public static function getSettings(): LeadDistributionSetting
    {
        return LeadDistributionSetting::current();
    }

    /**
     * Pick the next agent according to the active strategy and rules
     */
    public static function getNextAgent(string $leadType = 'lead_pool'): ?User
    {
        $settings = static::getSettings();

        // 1. Check if global distribution is enabled
        if (!$settings->is_enabled) {
            return null;
        }

        // 2. Check channel-specific scope
        if ($leadType === 'lead_pool' && !$settings->apply_to_lead_pool) {
            return null;
        }
        if ($leadType === 'lead_import' && !($settings->apply_to_lead_import ?? false)) {
            return null;
        }
        if ($leadType === 'owner_data' && !$settings->apply_to_owner_data) {
            return null;
        }

        // 3. Fetch all active users included in distribution pool
        $candidates = User::where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('in_distribution_pool')
                  ->orWhere('in_distribution_pool', true);
            })->get();

        // Reset daily counts for users if their last assigned date was before today
        foreach ($candidates as $candidate) {
            if ($candidate->last_assigned_at && !Carbon::parse($candidate->last_assigned_at)->isToday()) {
                $candidate->today_assigned_count = 0;
                $candidate->save();
            }
        }

        // Filter out agents who have reached the global daily lead capacity (if configured)
        $globalCap = !empty($settings->max_daily_leads_per_agent) ? (int) $settings->max_daily_leads_per_agent : null;
        $available = $candidates->filter(function ($agent) use ($globalCap) {
            if ($globalCap === null || $globalCap <= 0) {
                return true;
            }
            return $agent->today_assigned_count < $globalCap;
        });

        // Strict Cap: If all agents in pool reached their daily cap, stop assignment
        if ($available->isEmpty()) {
            return null;
        }

        $chosenAgent = null;

        // 4. Distribution Strategy Execution
        switch ($settings->distribution_mode) {
            case 'load_balanced':
                // Pick agent with least active open opportunities
                $chosenAgent = $available->sortBy(function ($agent) {
                    return Opportunity::where('current_owner_name', $agent->name)
                        ->whereNotIn('stage', ['closed_won', 'closed_lost'])
                        ->count();
                })->first();
                break;

            case 'weighted':
                // Weighted lottery pick
                $lottery = [];
                foreach ($available as $agent) {
                    $weight = max(1, (int)$agent->distribution_weight);
                    for ($i = 0; $i < $weight; $i++) {
                        $lottery[] = $agent;
                    }
                }
                $chosenAgent = !empty($lottery) ? $lottery[array_rand($lottery)] : $available->first();
                break;

            case 'round_robin':
            default:
                // Standard cyclic rotation based on agent IDs
                $sorted = $available->sortBy('id')->values();
                $lastId = $settings->last_assigned_user_id;

                // Find candidate with ID strictly greater than lastId
                $next = $sorted->first(fn($a) => $a->id > $lastId);
                $chosenAgent = $next ?: $sorted->first();
                break;
        }

        if (!$chosenAgent) {
            $chosenAgent = $candidates->first();
        }

        // 5. Update Chosen Agent statistics & Settings pointer
        if ($chosenAgent) {
            $chosenAgent->increment('today_assigned_count');
            $chosenAgent->update(['last_assigned_at' => Carbon::now()]);

            $settings->update(['last_assigned_user_id' => $chosenAgent->id]);
        }

        return $chosenAgent;
    }

    /**
     * Auto-assign an Opportunity / Lead Pool item
     */
    public static function autoAssignOpportunity(Opportunity $opportunity): ?User
    {
        $settings = static::getSettings();
        if (!$settings->is_enabled || !$settings->apply_to_lead_pool) {
            return null;
        }

        $agent = static::getNextAgent('lead_pool');
        if (!$agent) {
            if (!empty($settings->fallback_user_name)) {
                $opportunity->update([
                    'current_owner_name' => $settings->fallback_user_name,
                ]);
            }
            return null;
        }

        $opportunity->update([
            'current_owner_name' => $agent->name,
        ]);

        // Audit Activity
        $contactName = $opportunity->contact ? $opportunity->contact->name : "Opportunity #{$opportunity->id}";
        Activity::create([
            'contact_id' => $opportunity->contact_id,
            'opportunity_id' => $opportunity->id,
            'user_name' => 'Auto-Distribution Engine',
            'type' => 'ownership_change',
            'description' => "Lead assigned to {$agent->name} via {$settings->distribution_mode} auto-distribution.",
        ]);

        // Distribution Log
        LeadDistributionLog::create([
            'lead_type' => 'lead_pool',
            'record_id' => $opportunity->id,
            'record_name' => $contactName,
            'assigned_to_user_id' => $agent->id,
            'assigned_to_user_name' => $agent->name,
            'strategy_used' => $settings->distribution_mode,
            'created_at' => Carbon::now(),
        ]);

        return $agent;
    }

    /**
     * Auto-assign an OwnerRecord item
     */
    public static function autoAssignOwnerRecord(OwnerRecord $ownerRecord): ?User
    {
        $settings = static::getSettings();
        if (!$settings->is_enabled || !$settings->apply_to_owner_data) {
            return null;
        }

        $agent = static::getNextAgent('owner_data');
        if (!$agent) {
            if (!empty($settings->fallback_user_name)) {
                $ownerRecord->update([
                    'assigned_to' => $settings->fallback_user_name,
                ]);
            }
            return null;
        }

        $ownerRecord->update([
            'assigned_to' => $agent->name,
        ]);

        // Distribution Log
        LeadDistributionLog::create([
            'lead_type' => 'owner_data',
            'record_id' => $ownerRecord->id,
            'record_name' => $ownerRecord->owner_name . ' (' . ($ownerRecord->property_name ?? 'Unit ' . $ownerRecord->property_number) . ')',
            'assigned_to_user_id' => $agent->id,
            'assigned_to_user_name' => $agent->name,
            'strategy_used' => $settings->distribution_mode,
            'created_at' => Carbon::now(),
        ]);

        return $agent;
    }

    /**
     * Auto-assign a Contact from Lead Pool WITHOUT auto-creating an Opportunity.
     * The sales advisor will qualify the contact first from My Queue and create an opportunity manually.
     */
    public static function autoAssignContact(Contact $contact, string $scope = 'lead_pool'): ?User
    {
        // Never auto-assign duplicate contacts; keep them isolated in the Duplicate tab
        if ($contact->state === 'duplicate') {
            return null;
        }

        $settings = static::getSettings();
        if (!$settings->is_enabled) {
            return null;
        }

        $isScopeActive = ($scope === 'lead_import')
            ? (bool) ($settings->apply_to_lead_import ?? false)
            : (bool) $settings->apply_to_lead_pool;

        if (!$isScopeActive) {
            return null;
        }

        $agent = static::getNextAgent($scope);
        if (!$agent) {
            if (!empty($settings->fallback_user_name)) {
                $contact->update([
                    'assigned_to' => $settings->fallback_user_name,
                    'assigned_at' => Carbon::now(),
                    'state'       => 'assigned',
                ]);
            }
            return null;
        }

        // Auto-assign the contact to the chosen advisor
        $contact->update([
            'assigned_to' => $agent->name,
            'assigned_at' => Carbon::now(),
            'state'       => 'assigned',
        ]);

        // If an opportunity already exists for this contact, synchronize its owner
        $opp = $contact->opportunities()->first();
        if ($opp) {
            $opp->update([
                'current_owner_name' => $agent->name,
            ]);
        }

        // Audit Activity
        Activity::create([
            'contact_id'     => $contact->id,
            'opportunity_id' => $opp?->id,
            'user_name'      => 'Auto-Distribution Engine',
            'type'           => 'ownership_change',
            'description'    => "Lead assigned to {$agent->name} via {$settings->distribution_mode} auto-distribution (Awaiting qualification call).",
        ]);

        // Distribution Log
        LeadDistributionLog::create([
            'lead_type'             => 'lead_pool',
            'record_id'             => $contact->id,
            'record_name'           => $contact->name . ' (' . ($contact->phone ?: $contact->email) . ')',
            'assigned_to_user_id'   => $agent->id,
            'assigned_to_user_name' => $agent->name,
            'strategy_used'         => $settings->distribution_mode,
            'created_at'            => Carbon::now(),
        ]);

        return $agent;
    }

    /**
     * Batch distribute unassigned leads in Lead Pool
     */
    public static function batchDistributeLeadPool(int $limit = 200): array
    {
        $settings = static::getSettings();
        $fallback = $settings->fallback_user_name ?: 'Faraz Shafi';

        // Distribute truly unassigned leads OR leads currently assigned to fallback assignee without an active opportunity
        $unassignedContactsQuery = Contact::where(function ($q) use ($fallback) {
            $q->whereNull('assigned_to')
              ->orWhere('assigned_to', '')
              ->orWhere('assigned_to', 'Unassigned')
              ->orWhere(function ($fbQ) use ($fallback) {
                  $fbQ->where('assigned_to', $fallback)
                      ->whereDoesntHave('opportunities');
              });
        })->where('state', '!=', 'duplicate');

        $totalUnassigned = $unassignedContactsQuery->count();
        $contacts = $unassignedContactsQuery->limit($limit)->get();

        $assignedCount = 0;
        foreach ($contacts as $contact) {
            $assigned = static::autoAssignContact($contact);
            if ($assigned) {
                $assignedCount++;
            } else {
                // If pool is exhausted (e.g. all agent daily limits reached), stop
                break;
            }
        }

        return [
            'assigned_count' => $assignedCount,
            'remaining_unassigned' => max(0, $totalUnassigned - $assignedCount),
        ];
    }

    /**
     * Batch distribute unassigned owner records in Owner Data
     */
    public static function batchDistributeOwnerData(int $limit = 100): array
    {
        $unassignedQuery = OwnerRecord::where(function ($q) {
            $q->whereNull('assigned_to')
              ->orWhere('assigned_to', '')
              ->orWhere('assigned_to', 'Unassigned');
        });

        $totalUnassigned = $unassignedQuery->count();
        $records = $unassignedQuery->limit($limit)->get();

        $assignedCount = 0;
        foreach ($records as $owner) {
            $assigned = static::autoAssignOwnerRecord($owner);
            if ($assigned) {
                $assignedCount++;
            } else {
                break;
            }
        }

        return [
            'assigned_count' => $assignedCount,
            'remaining_unassigned' => max(0, $totalUnassigned - $assignedCount),
        ];
    }

    /**
     * Pick the next active agent excluding a specific agent (for re-assigning idle leads)
     */
    public static function getNextAgentExcluding(string $excludeName, string $leadType = 'lead_pool'): ?User
    {
        $settings = static::getSettings();
        if (!$settings->is_enabled) {
            return null;
        }

        // Fetch all active advisors excluding current owner who are included in distribution pool
        $candidates = User::where('is_active', true)
            ->where('name', '!=', $excludeName)
            ->where(function ($q) {
                $q->whereNull('in_distribution_pool')
                  ->orWhere('in_distribution_pool', true);
            })
            ->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        // Reset daily counts for users if their last assigned date was before today
        foreach ($candidates as $candidate) {
            if ($candidate->last_assigned_at && !Carbon::parse($candidate->last_assigned_at)->isToday()) {
                $candidate->today_assigned_count = 0;
                $candidate->save();
            }
        }

        // Filter out agents who have reached the global daily lead capacity (if configured)
        $globalCap = !empty($settings->max_daily_leads_per_agent) ? (int) $settings->max_daily_leads_per_agent : null;
        $available = $candidates->filter(function ($agent) use ($globalCap) {
            if ($globalCap === null || $globalCap <= 0) {
                return true;
            }
            return $agent->today_assigned_count < $globalCap;
        });

        if ($available->isEmpty()) {
            $available = $candidates;
        }

        $sorted = $available->sortBy('id')->values();
        $lastId = $settings->last_assigned_user_id;

        // Find candidate with ID strictly greater than lastId
        $next = $sorted->first(fn($a) => $a->id > $lastId);
        $chosenAgent = $next ?: $sorted->first();

        if ($chosenAgent) {
            $chosenAgent->increment('today_assigned_count');
            $chosenAgent->update(['last_assigned_at' => Carbon::now()]);
            $settings->update(['last_assigned_user_id' => $chosenAgent->id]);
        }

        return $chosenAgent;
    }

    /**
     * Process 3-Day Inactivity Auto-Rotation & 45-Day Lead Pool Recycling
     */
    public static function processIdleAndDormantLeads(): array
    {
        $settings = static::getSettings();
        $reassignDays = (int) ($settings->inactivity_reassign_days ?: 3);
        $recycleDays = (int) ($settings->recycle_to_pool_days ?: 45);
        $autoReassign = $settings->auto_reassign_idle_leads ?? true;
        $autoRecycle = $settings->auto_recycle_dormant_leads ?? true;

        $reassigned = [];
        $recycled = [];

        // 1. Fetch all assigned contacts (both inbound and imported)
        $assignedContacts = Contact::whereNotNull('assigned_to')
            ->where('assigned_to', '!=', '')
            ->where('assigned_to', '!=', 'Unassigned')
            ->where('state', '!=', 'duplicate')
            ->get();

        $now = Carbon::now();

        foreach ($assignedContacts as $contact) {
            $currentOwner = $contact->assigned_to;
            $opp = $contact->opportunities()->first();

            // Never re-assign or recycle Won deals
            if ($opp && in_array(strtolower($opp->stage), ['closed_won', 'won'])) {
                continue;
            }

            // Check genuine agent interactions (calls or non-system activities)
            $lastCall = Activity::where('contact_id', $contact->id)
                ->where('type', 'call')
                ->latest('created_at')
                ->first();

            $lastGenuineActivity = Activity::where('contact_id', $contact->id)
                ->where('type', '!=', 'ownership_change')
                ->latest('created_at')
                ->first();

            $lastActionTime = $lastCall ? Carbon::parse($lastCall->created_at) : ($lastGenuineActivity ? Carbon::parse($lastGenuineActivity->created_at) : null);

            $rawOutcome = $lastCall?->call_outcome 
                ?? $contact->call_outcome 
                ?? $contact->latest_call_outcome 
                ?? '';
            $outcome = strtolower(trim($rawOutcome));

            // Exemption flags: Protect qualified deals, engaged clients, and scheduled appointments
            $hasActiveDeal = ($opp && !in_array(strtolower($opp->stage), ['closed_lost', 'lost']))
                || $contact->opportunities()->whereNotIn('stage', ['closed_lost', 'lost'])->exists();

            $isEngagedOutcome = (str_contains($outcome, 'interested') && !str_contains($outcome, 'not interested'))
                || str_contains($outcome, 'meeting')
                || str_contains($outcome, 'viewing');

            $scheduledDue = $contact->next_action_due_at 
                ? Carbon::parse($contact->next_action_due_at) 
                : ($opp?->next_action_due_at ? Carbon::parse($opp->next_action_due_at) : null);

            $isTerminal = str_contains($outcome, 'not interested') 
                || str_contains($outcome, 'wrong number') 
                || str_contains($outcome, 'real estate agent')
                || str_contains($outcome, 'broker');

            // =========================================================================
            // RULE 2: 45-Day Total Inactivity Recycling back to Lead Pool
            // If lead has been assigned/in system for >= 45 days without work or won deal
            // =========================================================================
            $contactAgeDays = Carbon::parse($contact->created_at)->diffInDays($now);
            $idleSinceDays = $lastActionTime ? $lastActionTime->diffInDays($now) : $contactAgeDays;
            $idleSinceDaysInt = (int) round($idleSinceDays);

            // Never recycle active deals or engaged prospects with upcoming scheduled actions
            if ($hasActiveDeal) {
                continue;
            }
            if ($isEngagedOutcome && $scheduledDue && $scheduledDue->isFuture()) {
                continue;
            }

            if ($autoRecycle && $idleSinceDays >= $recycleDays) {
                // Recycle back to Lead Pool as fresh unassigned lead
                $contact->update([
                    'assigned_to' => null,
                    'assigned_at' => null,
                    'state'       => 'available',
                    'is_imported' => true, // Places strictly in Lead Pool
                ]);

                if ($opp && !in_array(strtolower($opp->stage), ['closed_won', 'won'])) {
                    $opp->update(['current_owner_name' => null]);
                }

                // Log Activity in Timeline
                Activity::create([
                    'contact_id'     => $contact->id,
                    'opportunity_id' => $opp?->id,
                    'user_name'      => 'System SLA Engine',
                    'type'           => 'ownership_change',
                    'description'    => "Lead recycled back to Lead Pool as fresh unassigned lead due to {$idleSinceDaysInt} days of dormancy without progress (previously assigned to {$currentOwner}).",
                ]);

                // Log in Lead Distribution Log
                LeadDistributionLog::create([
                    'lead_type'             => 'lead_pool',
                    'record_id'             => $contact->id,
                    'record_name'           => $contact->name . ' (' . ($contact->phone ?: $contact->email) . ')',
                    'assigned_to_user_id'   => null,
                    'assigned_to_user_name' => 'Lead Pool (Unassigned)',
                    'strategy_used'         => "dormancy_recycle_{$recycleDays}d",
                    'created_at'            => Carbon::now(),
                ]);

                $recycled[] = [
                    'id' => $contact->id,
                    'name' => $contact->name,
                    'previous_owner' => $currentOwner,
                    'dormant_days' => $idleSinceDaysInt,
                ];

                continue; // Successfully recycled, move to next lead
            }

            // =========================================================================
            // RULE 1: 3-Day Inactivity Auto-Rotation
            // If held by current agent for >= 3 days without any call/update, rotate to next agent
            // =========================================================================
            if (!$autoReassign) {
                continue;
            }

            // Exemption 1: Never auto-rotate leads with an active opportunity or deal in progress
            if ($hasActiveDeal) {
                continue;
            }

            // Exemption 2: Never auto-rotate leads where client is Interested, in Meeting, or Viewing
            if ($isEngagedOutcome) {
                continue;
            }

            // Exemption 3: Never auto-rotate if a future follow-up or callback is scheduled (or within grace window)
            if ($scheduledDue && ($scheduledDue->isFuture() || $scheduledDue->diffInDays($now, false) < $reassignDays)) {
                continue;
            }

            // Exemption 4: Never auto-rotate terminal / disqualified leads (Not Interested, Wrong Number, Broker)
            if ($isTerminal) {
                continue;
            }

            $assignedAt = $contact->assigned_at ? Carbon::parse($contact->assigned_at) : Carbon::parse($contact->updated_at);
            $daysWithAgent = $assignedAt->diffInDays($now);

            if ($daysWithAgent < $reassignDays) {
                continue; // Still within grace period
            }

            // Check if agent performed any call or genuine update in the last 3 days
            $hasRecentWork = Activity::where('contact_id', $contact->id)
                ->where('type', '!=', 'ownership_change')
                ->where('created_at', '>=', $now->copy()->subDays($reassignDays))
                ->exists();

            if ($hasRecentWork) {
                continue; // Agent actively engaged with the lead
            }

            // Check if last_activity_at was recent
            if ($contact->last_activity_at && Carbon::parse($contact->last_activity_at)->diffInDays($now) < $reassignDays) {
                continue;
            }

            // Auto-reassign to next active advisor excluding current owner
            $nextAgent = static::getNextAgentExcluding($currentOwner);
            if (!$nextAgent || $nextAgent->name === $currentOwner) {
                continue; // No other advisor available to take the lead
            }

            $daysWithAgentInt = (int) round($daysWithAgent);

            // Update contact ownership
            $contact->update([
                'assigned_to' => $nextAgent->name,
                'assigned_at' => Carbon::now(),
                'state'       => 'assigned',
            ]);

            if ($opp && !in_array(strtolower($opp->stage), ['closed_won', 'won'])) {
                $opp->update([
                    'current_owner_name' => $nextAgent->name,
                ]);
            }

            // Record Ownership Change Activity in Timeline
            Activity::create([
                'contact_id'     => $contact->id,
                'opportunity_id' => $opp?->id,
                'user_name'      => 'System SLA Engine',
                'type'           => 'ownership_change',
                'description'    => "Lead auto-reassigned from {$currentOwner} to {$nextAgent->name} due to {$daysWithAgentInt} days of advisor inactivity.",
            ]);

            // Record in Distribution Log
            LeadDistributionLog::create([
                'lead_type'             => 'lead_pool',
                'record_id'             => $contact->id,
                'record_name'           => $contact->name . ' (' . ($contact->phone ?: $contact->email) . ')',
                'assigned_to_user_id'   => $nextAgent->id,
                'assigned_to_user_name' => $nextAgent->name,
                'strategy_used'         => "inactivity_reassign_{$reassignDays}d",
                'created_at'            => Carbon::now(),
            ]);

            $reassigned[] = [
                'id' => $contact->id,
                'name' => $contact->name,
                'from_owner' => $currentOwner,
                'to_owner' => $nextAgent->name,
                'days_inactive' => $daysWithAgentInt,
            ];
        }

        return [
            'reassigned_count' => count($reassigned),
            'recycled_count'   => count($recycled),
            'reassigned'       => $reassigned,
            'recycled'         => $recycled,
        ];
    }
}
