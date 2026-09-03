<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadDistributionSetting;
use App\Models\LeadDistributionLog;
use App\Models\User;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\OwnerRecord;
use App\Services\LeadDistributionService;
use Illuminate\Http\Request;

class LeadDistributionController extends Controller
{
    /**
     * Get distribution settings, agent rotation pool, counts and audit logs
     */
    public function getSettings(Request $request)
    {
        $settings = LeadDistributionService::getSettings();

        $agents = User::where('is_active', true)
            ->select([
                'id', 'name', 'email', 'phone', 'role', 'department',
                'in_distribution_pool', 'distribution_weight', 'daily_lead_cap',
                'today_assigned_count', 'last_assigned_at'
            ])
            ->orderBy('name')
            ->get();

        $unassignedLeads = Contact::where(function ($q) {
            $q->whereDoesntHave('opportunities')
              ->orWhereHas('opportunities', function ($oppQ) {
                  $oppQ->whereNull('current_owner_name')
                       ->orWhere('current_owner_name', '')
                       ->orWhere('current_owner_name', 'Mako')
                       ->orWhere('current_owner_name', 'Unassigned');
              });
        })->count();

        $unassignedOwners = OwnerRecord::where(function ($q) {
            $q->whereNull('assigned_to')
              ->orWhere('assigned_to', '')
              ->orWhere('assigned_to', 'Unassigned');
        })->count();

        $logPerPage = (int) $request->input('per_page', 10);
        $logs = LeadDistributionLog::orderByDesc('id')->paginate($logPerPage);

        return response()->json([
            'settings' => $settings,
            'agents' => $agents,
            'unassigned_leads_count' => $unassignedLeads,
            'unassigned_owners_count' => $unassignedOwners,
            'recent_logs' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
                'from'         => $logs->firstItem(),
                'to'           => $logs->lastItem(),
            ],
        ]);
    }

    /**
     * Update distribution settings
     */
    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'is_enabled' => 'nullable|boolean',
            'distribution_mode' => 'nullable|in:round_robin,load_balanced,weighted',
            'apply_to_lead_pool' => 'nullable|boolean',
            'apply_to_owner_data' => 'nullable|boolean',
            'fallback_user_name' => 'nullable|string',
            'max_daily_leads_per_agent' => 'nullable|integer|min:1',
        ]);

        $settings = LeadDistributionService::getSettings();
        $settings->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Lead distribution rules updated successfully.',
            'settings' => $settings->fresh(),
        ]);
    }

    /**
     * Toggle agent's participation in distribution pool
     */
    public function toggleAgentPool($id)
    {
        $user = User::findOrFail($id);
        $user->in_distribution_pool = !$user->in_distribution_pool;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => "{$user->name} is now " . ($user->in_distribution_pool ? 'included in' : 'excluded from') . ' distribution rotation.',
            'in_distribution_pool' => $user->in_distribution_pool,
        ]);
    }

    /**
     * Update agent distribution capacity and weight
     */
    public function updateAgentConfig(Request $request, $id)
    {
        $validated = $request->validate([
            'in_distribution_pool' => 'nullable|boolean',
            'distribution_weight' => 'nullable|integer|min:1|max:10',
            'daily_lead_cap' => 'nullable|integer|min:1|max:500',
        ]);

        $user = User::findOrFail($id);
        $user->update($validated);

        return response()->json([
            'success' => true,
            'message' => "Distribution settings for {$user->name} updated.",
            'agent' => $user,
        ]);
    }

    /**
     * Execute on-demand auto-distribution of unassigned lead pool items
     */
    public function runLeadPoolDistribution()
    {
        $result = LeadDistributionService::batchDistributeLeadPool(100);

        return response()->json([
            'success' => true,
            'message' => "Auto-distributed {$result['assigned_count']} leads to active sales advisors.",
            'assigned_count' => $result['assigned_count'],
            'remaining_unassigned' => $result['remaining_unassigned'],
        ]);
    }

    /**
     * Execute on-demand auto-distribution of unassigned owner records
     */
    public function runOwnerDataDistribution()
    {
        $result = LeadDistributionService::batchDistributeOwnerData(200);

        return response()->json([
            'success' => true,
            'message' => "Auto-distributed {$result['assigned_count']} property owner records to active agents.",
            'assigned_count' => $result['assigned_count'],
            'remaining_unassigned' => $result['remaining_unassigned'],
        ]);
    }

    /**
     * Get paginated distribution audit logs
     */
    public function getLogs(Request $request)
    {
        $perPage = (int) $request->input('per_page', 10);
        $logs = LeadDistributionLog::orderByDesc('id')->paginate($perPage);

        return response()->json([
            'success'    => true,
            'logs'       => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
                'from'         => $logs->firstItem(),
                'to'           => $logs->lastItem(),
            ],
        ]);
    }

    /**
     * Reset today's distribution counts for all agents
     */
    public function resetTodayCounters(Request $request)
    {
        User::query()->update(['today_assigned_count' => 0]);

        return response()->json([
            'success' => true,
            'message' => 'Daily lead counters have been reset to 0 for all sales advisors.',
        ]);
    }

    /**
     * Clear distribution audit activity logs
     */
    public function clearLogs()
    {
        LeadDistributionLog::truncate();

        return response()->json([
            'success' => true,
            'message' => 'Distribution activity logs have been cleared successfully.',
        ]);
    }
}
