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
        if ($leadType === 'lead_import' && !($settings->apply_to_lead_import ?? $settings->apply_to_lead_pool)) {
            return null;
        }
        if ($leadType === 'owner_data' && !$settings->apply_to_owner_data) {
            return null;
        }

        // 3. Fetch all active sales advisors (all active users participate automatically)
        $candidates = User::where('is_active', true)
            ->where('email', '!=', 'faraz@fsadvisory.ae')
            ->where('name', '!=', 'Faraz Shafi')
            ->get();

        if ($candidates->isEmpty()) {
            $candidates = User::where('is_active', true)->get();
        }

        // Reset daily counts for users if their last assigned date was before today
        foreach ($candidates as $candidate) {
            if ($candidate->last_assigned_at && !Carbon::parse($candidate->last_assigned_at)->isToday()) {
                $candidate->today_assigned_count = 0;
                $candidate->save();
            }
        }

        // Filter out agents who have reached the global daily lead capacity
        $globalCap = (int) ($settings->max_daily_leads_per_agent ?: 20);
        $available = $candidates->filter(function ($agent) use ($globalCap) {
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
            ? (bool) ($settings->apply_to_lead_import ?? $settings->apply_to_lead_pool)
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
}
