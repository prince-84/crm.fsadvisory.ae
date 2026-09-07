<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\BuyerQualification;
use App\Models\SellerQualification;
use App\Models\LandlordQualification;
use App\Models\TenantQualification;
use App\Models\OwnershipHistory;
use App\Models\Activity;
use App\Models\OwnerRecord;
use App\Models\User;
use App\Models\EmailSetting;
use App\Mail\OpportunityEmailMailable;
use App\Services\LeadDistributionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class OpportunityController extends Controller
{
    public function index(Request $request)
    {
        $query = Opportunity::with([
            'contact', 
            'buyerQualification',
            'sellerQualification',
            'landlordQualification',
            'tenantQualification',
            'activities',
        ])->latest();

        if ($request->filled('owner') && $request->owner !== 'all') {
            $query->where('current_owner_name', $request->owner);
        }

        $opportunities = $query->get();

        $pipeline = [
            'contacted' => $opportunities->whereIn('stage', ['contacted', 'new'])->values(),
            'qualified' => $opportunities->whereIn('stage', ['qualified', 'qualification'])->values(),
            'option_sent' => $opportunities->whereIn('stage', ['option_sent', 'handover_pending'])->values(),
            'follow_up' => $opportunities->where('stage', 'follow_up')->values(),
            'meeting' => $opportunities->whereIn('stage', ['meeting', 'sales_in_progress'])->values(),
            'future_prospectus' => $opportunities->where('stage', 'future_prospectus')->values(),
            'closed' => $opportunities->whereIn('stage', ['closed', 'closed_won', 'closed_lost'])->values(),
        ];

        return response()->json([
            'pipeline' => $pipeline,
            'total' => $opportunities->count(),
        ]);
    }

    public function getStages()
    {
        $canonicalStages = [
            ['key' => 'contacted', 'label' => '1. Contacted'],
            ['key' => 'qualified', 'label' => '2. Qualified / Lead Qualification'],
            ['key' => 'option_sent', 'label' => '3. Option Sent'],
            ['key' => 'follow_up', 'label' => '4. Follow up'],
            ['key' => 'meeting', 'label' => '5. Meeting / Viewing Scheduled'],
            ['key' => 'future_prospectus', 'label' => '6. Future Prospectus'],
            ['key' => 'closed', 'label' => '7. Closed Won 🏆'],
            ['key' => 'closed_lost', 'label' => 'Closed Lost'],
        ];

        $dbStages = Opportunity::select('stage')
            ->whereNotNull('stage')
            ->where('stage', '!=', '')
            ->distinct()
            ->pluck('stage')
            ->toArray();

        $existingKeys = array_column($canonicalStages, 'key');
        foreach ($dbStages as $st) {
            if (!in_array($st, $existingKeys) && !in_array($st, ['new', 'qualification', 'handover_pending', 'sales_in_progress', 'closed_won'])) {
                $canonicalStages[] = [
                    'key' => $st,
                    'label' => ucwords(str_replace('_', ' ', $st)),
                ];
                $existingKeys[] = $st;
            }
        }

        return response()->json([
            'success' => true,
            'stages' => $canonicalStages,
        ]);
    }

    public function show($id)
    {
        if (!is_numeric($id) || (int)$id <= 0) {
            return response()->json([
                'success' => false,
                'message' => "Opportunity #{$id} does not exist. This lead has not been converted to an opportunity deal yet.",
            ], 404);
        }

        $opportunity = Opportunity::with([
            'contact',
            'buyerQualification',
            'sellerQualification',
            'landlordQualification',
            'tenantQualification',
            'activities',
            'ownershipHistories',
            'slaBreaches'
        ])->find($id);

        if (!$opportunity) {
            return response()->json([
                'success' => false,
                'message' => "Opportunity #{$id} was not found. It may have been deleted or archived.",
            ], 404);
        }

        return response()->json($opportunity);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_id' => 'nullable|exists:contacts,id',
            'owner_record_id' => 'nullable|exists:owner_records,id',
            'stage' => 'nullable|string',
            'opportunity_type' => 'nullable|string',
            'temperature' => 'nullable|string',
            'budget_min' => 'nullable|numeric',
            'budget_max' => 'nullable|numeric',
            'key_requirement' => 'nullable|string',
            'next_action' => 'nullable|string',
            'next_action_due_at' => 'nullable|date',
            'current_owner_name' => 'nullable|string',
            'developer' => 'nullable|string',
            'community' => 'nullable|string',
            'property_type' => 'nullable|string',
            'bedrooms' => 'nullable|string',
            'building_name' => 'nullable|string',
            'unit_number' => 'nullable|string',
            'cash_or_finance' => 'nullable|string',
            'client_intent' => 'nullable|string',
            'project' => 'nullable|string',
            'project_property' => 'nullable|string',
        ]);

        $ownerRecord = null;
        if (!empty($validated['owner_record_id'])) {
            $ownerRecord = OwnerRecord::find($validated['owner_record_id']);
        }

        if (!empty($validated['contact_id'])) {
            $contact = Contact::findOrFail($validated['contact_id']);
        } elseif ($ownerRecord) {
            $phone = $ownerRecord->mobile_number ?: ($ownerRecord->phone_number ?: '+971500000000');
            $contact = Contact::firstOrCreate(
                ['phone' => $phone],
                [
                    'name' => $ownerRecord->owner_name ?: 'Property Owner',
                    'email' => $ownerRecord->email,
                    'source' => 'Owner Data',
                    'state' => 'active',
                    'assigned_to' => $ownerRecord->assigned_to ?: ($validated['current_owner_name'] ?? 'Unassigned'),
                ]
            );
        } else {
            return response()->json(['message' => 'Either contact_id or owner_record_id is required.'], 422);
        }

        $owner = $validated['current_owner_name'] ?? ($ownerRecord ? $ownerRecord->assigned_to : null);
        $contact->update([
            'state' => 'active',
            'assigned_to' => $owner ?: ($contact->assigned_to ?: 'Unassigned'),
        ]);
        $oppType = $validated['opportunity_type'] ?? ($ownerRecord ? 'seller' : 'buyer');

        $opportunity = Opportunity::create([
            'contact_id' => $contact->id,
            'opportunity_type' => $oppType,
            'stage' => $validated['stage'] ?? 'contacted',
            'temperature' => $validated['temperature'] ?? 'hot',
            'current_owner_name' => $owner ?: 'Unassigned',
            'originating_agent_name' => $owner ?: ($ownerRecord ? 'Owner Data Bank' : 'System Ingest'),
            'department' => 'telesales',
            'budget_min' => $validated['budget_min'] ?? 1800000,
            'budget_max' => $validated['budget_max'] ?? 2200000,
            'next_action' => $validated['next_action'] ?? 'Contact owner/lead — confirm requirement details',
            'next_action_due_at' => $validated['next_action_due_at'] ?? now()->addHours(2),
            'sla_status' => 'on_track',
            'key_requirement' => $validated['key_requirement'] ?? 'New Inquiry',
        ]);

        if (empty($owner) || $owner === 'auto' || $owner === 'Mako' || $owner === 'Unassigned') {
            LeadDistributionService::autoAssignOpportunity($opportunity);
            $opportunity->refresh();
        }

        // Seamlessly link prior qualification calls logged from My Queue to this newly created Opportunity
        \App\Models\Activity::where('contact_id', $contact->id)
            ->whereNull('opportunity_id')
            ->update(['opportunity_id' => $opportunity->id]);

        $isSeller = $oppType === 'seller' || $ownerRecord !== null;

        if ($isSeller) {
            SellerQualification::create([
                'opportunity_id' => $opportunity->id,
                'community' => $validated['community'] ?? ($ownerRecord ? $ownerRecord->area : null),
                'building_name' => $validated['building_name'] ?? ($ownerRecord ? $ownerRecord->building_name : null),
                'unit_number' => $validated['unit_number'] ?? ($ownerRecord ? $ownerRecord->property_number : null),
                'listing_price' => $validated['budget_min'] ?? null,
                'seller_notes' => $validated['key_requirement'] ?? ($ownerRecord ? $ownerRecord->notes : null),
            ]);
        }

        BuyerQualification::create([
            'opportunity_id' => $opportunity->id,
            'client_intent' => $validated['client_intent'] ?? ($isSeller ? 'investor' : 'end_user'),
            'purchase_timeline' => '1-3 months',
            'is_first_time_buyer' => false,
            'cash_or_finance' => $validated['cash_or_finance'] ?? 'cash',
            'community' => $validated['community'] ?? ($ownerRecord ? $ownerRecord->area : null),
            'developer' => $validated['developer'] ?? null,
            'project' => $validated['project'] ?? ($ownerRecord ? $ownerRecord->building_name : null),
            'project_property' => $validated['project_property'] ?? ($ownerRecord ? $ownerRecord->property_number : null),
            'property_type' => $validated['property_type'] ?? ($ownerRecord ? $ownerRecord->property_type : null),
            'bedrooms' => $validated['bedrooms'] ?? ($ownerRecord ? $ownerRecord->bedrooms : null),
            'lead_score' => $validated['temperature'] === 'hot' ? 84 : 65,
            'qualification_notes' => $isSeller ? 'Newly created Seller opportunity from Owner Data' : 'Newly created Buyer opportunity',
        ]);

        Activity::create([
            'contact_id' => $contact->id,
            'opportunity_id' => $opportunity->id,
            'user_name' => $owner,
            'type' => 'note',
            'description' => "Created new {$oppType} opportunity" . ($ownerRecord ? " from Owner Data ({$ownerRecord->building_name})" : "") . ". Initial temperature set to " . strtoupper($validated['temperature'] ?? 'hot') . ".",
        ]);

        return response()->json($opportunity->load(['contact', 'buyerQualification', 'sellerQualification']), 201);
    }

    public function qualify(Request $request, $id)
    {
        $opportunity = Opportunity::with('buyerQualification')->findOrFail($id);

        $validated = $request->validate([
            'opportunity_type' => 'nullable|string',
            'temperature' => 'nullable|string',
            'budget_min' => 'nullable|numeric',
            'budget_max' => 'nullable|numeric',
            'key_requirement' => 'nullable|string',
            'current_owner_name' => 'nullable|string',
            'developer' => 'nullable|string',
            'community' => 'nullable|string',
            'project' => 'nullable|string',
            'project_property' => 'nullable|string',
            'property_type' => 'nullable|string',
            'bedrooms' => 'nullable|string',
            'cash_or_finance' => 'nullable|string',
            'next_action' => 'nullable|string',
            'next_action_due_at' => 'nullable|date',
            'sla_status' => 'nullable|string',
        ]);

        // Audit Trail: Track field changes before and after
        $changes = [];

        if (isset($validated['opportunity_type']) && $opportunity->opportunity_type != $validated['opportunity_type']) {
            $changes[] = "Opportunity Type: '" . ucfirst($opportunity->opportunity_type ?? 'N/A') . "' ➔ '" . ucfirst($validated['opportunity_type']) . "'";
        }
        if (isset($validated['temperature']) && $opportunity->temperature != $validated['temperature']) {
            $changes[] = "Temperature: '" . strtoupper($opportunity->temperature ?? 'N/A') . "' ➔ '" . strtoupper($validated['temperature']) . "'";
        }
        if (isset($validated['budget_min']) && (float)$opportunity->budget_min != (float)$validated['budget_min']) {
            $changes[] = "Min Budget: 'AED " . number_format((float)($opportunity->budget_min ?: 0)) . "' ➔ 'AED " . number_format((float)$validated['budget_min']) . "'";
        }
        if (isset($validated['budget_max']) && (float)$opportunity->budget_max != (float)$validated['budget_max']) {
            $changes[] = "Max Budget: 'AED " . number_format((float)($opportunity->budget_max ?: 0)) . "' ➔ 'AED " . number_format((float)$validated['budget_max']) . "'";
        }
        if (isset($validated['key_requirement']) && trim((string)$opportunity->key_requirement) !== trim((string)$validated['key_requirement'])) {
            $changes[] = "Key Requirement / Notes updated";
        }
        if (isset($validated['current_owner_name']) && $opportunity->current_owner_name != $validated['current_owner_name']) {
            $changes[] = "Assigned Owner: '" . ($opportunity->current_owner_name ?: 'Unassigned') . "' ➔ '" . $validated['current_owner_name'] . "'";
        }
        if (isset($validated['next_action']) && $opportunity->next_action != $validated['next_action']) {
            $changes[] = "Next Action: '" . ($opportunity->next_action ?: 'None') . "' ➔ '" . $validated['next_action'] . "'";
        }
        if (isset($validated['next_action_due_at'])) {
            $oldDue = $opportunity->next_action_due_at ? Carbon::parse($opportunity->next_action_due_at)->format('Y-m-d H:i') : 'None';
            $newDue = Carbon::parse($validated['next_action_due_at'])->format('Y-m-d H:i');
            if ($oldDue !== $newDue) {
                $changes[] = "Next Action Due: '{$oldDue}' ➔ '{$newDue}'";
            }
        }

        $bQual = $opportunity->buyerQualification;
        if (isset($validated['developer']) && optional($bQual)->developer != $validated['developer']) {
            $changes[] = "Developer: '" . (optional($bQual)->developer ?: 'None') . "' ➔ '" . $validated['developer'] . "'";
        }
        if (isset($validated['community']) && optional($bQual)->community != $validated['community']) {
            $changes[] = "Community: '" . (optional($bQual)->community ?: 'None') . "' ➔ '" . $validated['community'] . "'";
        }
        if (isset($validated['project']) && optional($bQual)->project != $validated['project']) {
            $changes[] = "Project: '" . (optional($bQual)->project ?: 'None') . "' ➔ '" . $validated['project'] . "'";
        }
        if (isset($validated['property_type']) && optional($bQual)->property_type != $validated['property_type']) {
            $changes[] = "Property Type: '" . (optional($bQual)->property_type ?: 'None') . "' ➔ '" . $validated['property_type'] . "'";
        }
        if (isset($validated['bedrooms']) && optional($bQual)->bedrooms != $validated['bedrooms']) {
            $changes[] = "Bedrooms: '" . (optional($bQual)->bedrooms ?: 'None') . "' ➔ '" . $validated['bedrooms'] . "'";
        }
        if (isset($validated['project_property']) && optional($bQual)->project_property != $validated['project_property']) {
            $changes[] = "Specific Unit: '" . (optional($bQual)->project_property ?: 'None') . "' ➔ '" . $validated['project_property'] . "'";
        }
        if (isset($validated['cash_or_finance']) && optional($bQual)->cash_or_finance != $validated['cash_or_finance']) {
            $changes[] = "Payment Method: '" . (optional($bQual)->cash_or_finance ?: 'None') . "' ➔ '" . $validated['cash_or_finance'] . "'";
        }

        $opportunityData = [];
        if (isset($validated['opportunity_type'])) $opportunityData['opportunity_type'] = $validated['opportunity_type'];
        if (isset($validated['temperature'])) $opportunityData['temperature'] = $validated['temperature'];
        if (isset($validated['budget_min'])) $opportunityData['budget_min'] = $validated['budget_min'];
        if (isset($validated['budget_max'])) $opportunityData['budget_max'] = $validated['budget_max'];
        if (isset($validated['key_requirement'])) $opportunityData['key_requirement'] = $validated['key_requirement'];
        if (isset($validated['current_owner_name'])) $opportunityData['current_owner_name'] = $validated['current_owner_name'];
        if (isset($validated['next_action'])) $opportunityData['next_action'] = $validated['next_action'];
        
        if (isset($validated['next_action_due_at'])) {
            $opportunityData['next_action_due_at'] = $validated['next_action_due_at'];
            $dueAt = Carbon::parse($validated['next_action_due_at']);
            if ($dueAt->isPast()) {
                $opportunityData['sla_status'] = 'overdue';
            } elseif ($dueAt->diffInMinutes(Carbon::now()) <= 30) {
                $opportunityData['sla_status'] = 'due_soon';
            } else {
                $opportunityData['sla_status'] = 'on_track';
            }
        } elseif (isset($validated['sla_status'])) {
            $opportunityData['sla_status'] = $validated['sla_status'];
        }

        if (!empty($opportunityData)) {
            $opportunity->update($opportunityData);
        }

        $buyerQualData = array_filter([
            'developer' => $validated['developer'] ?? null,
            'community' => $validated['community'] ?? null,
            'project' => $validated['project'] ?? null,
            'project_property' => $validated['project_property'] ?? null,
            'property_type' => $validated['property_type'] ?? null,
            'bedrooms' => $validated['bedrooms'] ?? null,
            'cash_or_finance' => $validated['cash_or_finance'] ?? null,
        ], function ($val) { return !is_null($val); });

        if ($opportunity->buyerQualification) {
            $opportunity->buyerQualification->update($buyerQualData);
        } else {
            BuyerQualification::create(array_merge(['opportunity_id' => $opportunity->id], $buyerQualData));
        }

        if (!empty($changes)) {
            Activity::create([
                'contact_id' => $opportunity->contact_id,
                'opportunity_id' => $opportunity->id,
                'user_name' => $validated['current_owner_name'] ?? $opportunity->current_owner_name ?? 'Advisor',
                'type' => 'requirement_change',
                'description' => implode("\n", $changes),
            ]);
        }

        return response()->json($opportunity->load(['contact', 'buyerQualification', 'activities']));
    }

    public function update(Request $request, $id)
    {
        return $this->qualify($request, $id);
    }

    public function handover(Request $request, $id)
    {
        $opportunity = Opportunity::findOrFail($id);
        $previousOwner = $opportunity->current_owner_name;
        $previousDept = $opportunity->department;
        $newOwner = $request->input('sales_agent_name', 'Faraz Shafi');
        $notes = $request->input('notes', 'Qualified lead handed over from Telesales to Sales Closer.');

        $opportunity->update([
            'current_owner_name' => $newOwner,
            'department' => 'sales',
            'stage' => 'meeting',
            'sla_status' => 'on_track',
            'next_action' => 'Sales Consultation & Viewing Tour',
            'next_action_due_at' => now()->addHours(24),
        ]);

        OwnershipHistory::create([
            'opportunity_id' => $opportunity->id,
            'previous_owner' => $previousOwner,
            'new_owner' => $newOwner,
            'department_from' => $previousDept,
            'department_to' => 'sales',
            'reason' => $notes,
        ]);

        Activity::create([
            'contact_id' => $opportunity->contact_id,
            'opportunity_id' => $opportunity->id,
            'user_name' => $previousOwner ?? 'Telesales',
            'type' => 'status_change',
            'description' => "Deal handed over to {$newOwner} (Sales). Reason: {$notes}",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Opportunity successfully handed over to {$newOwner} in Sales.",
            'opportunity' => $opportunity->load(['contact', 'buyerQualification', 'ownershipHistories', 'activities']),
        ]);
    }

    public function updateStage(Request $request, $id)
    {
        $opportunity = Opportunity::findOrFail($id);
        $stage = $request->input('stage', 'sales_in_progress');

        $opportunity->update([
            'stage' => $stage,
            'sla_status' => 'on_track',
        ]);

        Activity::create([
            'contact_id' => $opportunity->contact_id,
            'opportunity_id' => $opportunity->id,
            'user_name' => $opportunity->current_owner_name ?? 'System',
            'type' => 'status_change',
            'description' => "Opportunity stage updated to " . strtoupper(str_replace('_', ' ', $stage)) . ".",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Opportunity stage updated to {$stage}.",
            'opportunity' => $opportunity,
        ]);
    }

    /**
     * Delete an individual opportunity.
     * Respects Real Estate Domain Rule: Contact record remains permanent in Lead Pool.
     */
    public function destroy($id)
    {
        $opportunity = Opportunity::findOrFail($id);
        $contactId = $opportunity->contact_id;
        $oppId = $opportunity->id;

        // Clean up qualification child records if any
        $opportunity->buyerQualification()?->delete();
        $opportunity->sellerQualification()?->delete();
        $opportunity->landlordQualification()?->delete();
        $opportunity->tenantQualification()?->delete();

        $opportunity->delete();

        // Check if permanent Contact has any remaining active opportunities
        if ($contactId) {
            $contact = Contact::find($contactId);
            if ($contact) {
                $hasRemaining = Opportunity::where('contact_id', $contactId)
                    ->whereNotIn('stage', ['closed_won', 'closed_lost'])
                    ->exists();
                if (!$hasRemaining && $contact->state === 'assigned') {
                    $contact->update(['state' => 'available']);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Opportunity #{$oppId} deleted successfully."
        ]);
    }

    public function qualifySeller(Request $request, $id)
    {
        $opportunity = Opportunity::with('sellerQualification')->findOrFail($id);

        $validated = $request->validate([
            'community' => 'nullable|string',
            'building_name' => 'nullable|string',
            'unit_number' => 'nullable|string',
            'built_up_area_sqft' => 'nullable|numeric',
            'listing_price' => 'nullable|numeric',
            'cma_estimated_value' => 'nullable|numeric',
        ]);

        if ($opportunity->sellerQualification) {
            $opportunity->sellerQualification->update($validated);
        } else {
            SellerQualification::create(array_merge(['opportunity_id' => $opportunity->id], $validated));
        }

        Activity::create([
            'contact_id' => $opportunity->contact_id,
            'opportunity_id' => $opportunity->id,
            'user_name' => $opportunity->current_owner_name ?? 'System',
            'type' => 'note',
            'description' => "Updated Seller Listing & CMA Data.",
        ]);

        return response()->json($opportunity->load('sellerQualification'));
    }

    public function qualifyLandlord(Request $request, $id)
    {
        $opportunity = Opportunity::with('landlordQualification')->findOrFail($id);

        $validated = $request->validate([
            'community' => 'nullable|string',
            'expected_annual_rent' => 'nullable|numeric',
            'payment_cheques_pref' => 'nullable|string',
            'furnishing_status' => 'nullable|string',
            'management_type' => 'nullable|string',
        ]);

        if ($opportunity->landlordQualification) {
            $opportunity->landlordQualification->update($validated);
        } else {
            LandlordQualification::create(array_merge(['opportunity_id' => $opportunity->id], $validated));
        }

        Activity::create([
            'contact_id' => $opportunity->contact_id,
            'opportunity_id' => $opportunity->id,
            'user_name' => $opportunity->current_owner_name ?? 'System',
            'type' => 'note',
            'description' => "Updated Landlord Rental Listing & Terms.",
        ]);

        return response()->json($opportunity->load('landlordQualification'));
    }

    public function qualifyTenant(Request $request, $id)
    {
        $opportunity = Opportunity::with('tenantQualification')->findOrFail($id);

        $validated = $request->validate([
            'move_in_date' => 'nullable|date',
            'annual_budget' => 'nullable|numeric',
            'max_cheques' => 'nullable|integer',
            'preferred_communities' => 'nullable|string',
            'family_or_single' => 'nullable|string',
        ]);

        if ($opportunity->tenantQualification) {
            $opportunity->tenantQualification->update($validated);
        } else {
            TenantQualification::create(array_merge(['opportunity_id' => $opportunity->id], $validated));
        }

        Activity::create([
            'contact_id' => $opportunity->contact_id,
            'opportunity_id' => $opportunity->id,
            'user_name' => $opportunity->current_owner_name ?? 'System',
            'type' => 'note',
            'description' => "Updated Tenant Qualification & Budget.",
        ]);

        return response()->json($opportunity->load('tenantQualification'));
    }

    public function releaseToBank(Request $request, $id)
    {
        $opportunity = Opportunity::with('contact')->findOrFail($id);
        $reason = $request->input('reason', 'Client currently not looking; released to Available Lead Bank.');

        $opportunity->update([
            'stage' => 'closed_lost',
            'temperature' => 'cold',
            'next_action' => 'In Available Lead Bank for future campaign reactivation',
            'sla_status' => 'on_track',
        ]);

        $contact = $opportunity->contact;
        if ($contact) {
            $contact->update([
                'state' => 'available',
                'last_activity_at' => now(),
            ]);
        }

        Activity::create([
            'contact_id' => $opportunity->contact_id,
            'opportunity_id' => $opportunity->id,
            'user_name' => $opportunity->current_owner_name,
            'type' => 'note',
            'description' => "Released Lead to Bank. Contact state updated to AVAILABLE. Reason: {$reason}",
        ]);

        return response()->json([
            'success' => true,
            'message' => "Lead closed and Contact released to Available state in Lead Bank.",
            'contact' => $contact,
            'opportunity' => $opportunity,
        ]);
    }

    /**
     * Bulk delete selected opportunities.
     * Respects Real Estate Domain Rule: Contact records remain permanent in Lead Pool.
     */
    public function bulkDelete(Request $request)
    {
        $ids = $request->input('ids', $request->input('opportunity_ids', []));

        if (empty($ids) || !is_array($ids)) {
            return response()->json([
                'success' => false,
                'message' => 'No Opportunity IDs provided for bulk deletion.',
            ], 400);
        }

        $opportunities = Opportunity::whereIn('id', $ids)->get();
        $contactIds = $opportunities->pluck('contact_id')->filter()->unique();

        foreach ($opportunities as $opp) {
            $opp->buyerQualification()?->delete();
            $opp->sellerQualification()?->delete();
            $opp->landlordQualification()?->delete();
            $opp->tenantQualification()?->delete();
        }

        $deletedCount = Opportunity::whereIn('id', $ids)->delete();

        // Update contact state if they no longer have open active opportunities
        foreach ($contactIds as $cid) {
            $contact = Contact::find($cid);
            if ($contact) {
                $hasRemaining = Opportunity::where('contact_id', $cid)
                    ->whereNotIn('stage', ['closed_won', 'closed_lost'])
                    ->exists();
                if (!$hasRemaining && $contact->state === 'assigned') {
                    $contact->update(['state' => 'available']);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$deletedCount} opportunities deleted successfully.",
            'count' => $deletedCount,
        ]);
    }

    /**
     * Dispatch an official branded property proposal / viewing email to client
     */
    public function sendEmail(Request $request, $id)
    {
        $validated = $request->validate([
            'recipient_email' => 'required|email',
            'subject'         => 'required|string|max:255',
            'body'            => 'required|string',
            'template_name'   => 'nullable|string',
            'attachments.*'   => 'nullable|file|max:15360', // max 15MB
        ]);

        $opportunity = Opportunity::with([
            'contact',
            'buyerQualification',
            'sellerQualification',
        ])->findOrFail($id);

        $clientName = $opportunity->contact ? $opportunity->contact->name : 'Valued Client';
        $ownerName = $opportunity->current_owner_name ?: 'Faraz Shafi';

        // Resolve Agent User profile
        $agentUser = User::where('name', $ownerName)->first();
        $emailSetting = EmailSetting::current();
        $domain = $emailSetting->default_domain ?: 'fsadvisory.ae';

        $agentEmail = $agentUser && !empty($agentUser->email)
            ? $agentUser->email
            : strtolower(preg_replace('/[^a-zA-Z0-9]/', '', explode(' ', $ownerName)[0])) . '@' . $domain;

        $agentPhone = $agentUser?->phone ?? '+971 4 000 0000';

        // Prepare property specification details
        $bQual = $opportunity->buyerQualification;
        $sQual = $opportunity->sellerQualification;

        $propertyDetails = [
            'project'       => $bQual?->project ?? $sQual?->building_name ?? null,
            'community'     => $bQual?->community ?? $sQual?->community ?? null,
            'property_type' => $bQual?->property_type ?? null,
            'bedrooms'      => $bQual?->bedrooms ?? null,
            'budget'        => ($opportunity->budget_min || $opportunity->budget_max)
                ? 'AED ' . number_format($opportunity->budget_min ?: 0) . ' – ' . number_format($opportunity->budget_max ?: 0)
                : null,
        ];

        // Process attachments
        $uploadedAttachments = [];
        $tempFilePaths = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $filename = $file->getClientOriginalName();
                $tempPath = $file->storeAs('email_attachments/' . uniqid(), $filename);
                $fullPath = storage_path('app/' . $tempPath);
                $uploadedAttachments[] = [
                    'path' => $fullPath,
                    'name' => $filename,
                    'mime' => $file->getClientMimeType(),
                ];
                $tempFilePaths[] = $fullPath;
            }
        }

        $emailSetting->applyToRuntimeConfig();

        try {
            Mail::to($validated['recipient_email'])->send(
                new OpportunityEmailMailable(
                    $opportunity,
                    $clientName,
                    $validated['subject'],
                    $validated['body'],
                    $ownerName,
                    $agentEmail,
                    $agentPhone,
                    $propertyDetails,
                    $uploadedAttachments
                )
            );

            // Clean up temporary files
            foreach ($tempFilePaths as $path) {
                if (file_exists($path)) {
                    @unlink($path);
                }
            }

            // Record in Activity Timeline
            $attachmentNames = !empty($uploadedAttachments) 
                ? ' (Attachments: ' . implode(', ', array_column($uploadedAttachments, 'name')) . ')' 
                : '';

            $templateNote = !empty($validated['template_name']) 
                ? " [Template: {$validated['template_name']}]" 
                : '';

            Activity::create([
                'contact_id'     => $opportunity->contact_id,
                'opportunity_id' => $opportunity->id,
                'user_name'      => $ownerName,
                'type'           => 'email',
                'description'    => "Property Email Sent to {$validated['recipient_email']}: \"{$validated['subject']}\"{$templateNote}{$attachmentNames}",
            ]);

            return response()->json([
                'success' => true,
                'message' => "Official property email dispatched to {$validated['recipient_email']} successfully!",
            ]);
        } catch (\Throwable $e) {
            // Clean up temp files on failure
            foreach ($tempFilePaths as $path) {
                if (file_exists($path)) {
                    @unlink($path);
                }
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to send email: ' . $e->getMessage(),
            ], 500);
        }
    }
}
