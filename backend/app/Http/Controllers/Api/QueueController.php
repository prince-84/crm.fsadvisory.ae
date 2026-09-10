<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opportunity;
use App\Models\OwnerRecord;
use App\Models\Contact;
use Illuminate\Http\Request;
use Carbon\Carbon;

class QueueController extends Controller
{
    public function index(Request $request)
    {
        $channel = $request->get('channel', 'regular'); // 'regular' or 'owner'
        $owner = $request->get('owner');

        // Calculate channel badges for tabs
        $regBadgeCount = Opportunity::whereNotIn('stage', ['closed_won', 'closed_lost'])
            ->whereNotNull('current_owner_name')
            ->where('current_owner_name', '!=', '')
            ->where('current_owner_name', '!=', 'Unassigned')
            ->when($owner && $owner !== 'all', fn($q) => $q->where('current_owner_name', $owner))
            ->count() +
            Contact::whereNotNull('assigned_to')
            ->where('assigned_to', '!=', '')
            ->where('assigned_to', '!=', 'Unassigned')
            ->whereDoesntHave('opportunities', function ($q) {
                $q->whereNotIn('stage', ['closed_won', 'closed_lost']);
            })
            ->when($owner && $owner !== 'all', fn($q) => $q->where('assigned_to', $owner))
            ->count();
        $totalRegularCount = $regBadgeCount;

        $ownerBadgeQuery = OwnerRecord::query()
            ->whereNotNull('assigned_to')
            ->where('assigned_to', '!=', '')
            ->where('assigned_to', '!=', 'Unassigned');

        if ($owner && $owner !== 'all') {
            $ownerBadgeQuery->where('assigned_to', $owner);
        }
        $totalOwnerCount = $ownerBadgeQuery->count();

        if ($channel === 'owner') {
            $ownerQuery = OwnerRecord::query()
                ->whereNotNull('assigned_to')
                ->where('assigned_to', '!=', '')
                ->where('assigned_to', '!=', 'Unassigned')
                ->latest('created_at');

            if ($owner && $owner !== 'all') {
                $ownerQuery->where('assigned_to', $owner);
            }

            if ($request->filled('search')) {
                $ownerQuery->search($request->search);
            }

            $ownerRecords = $ownerQuery->get();

            // Link any existing opportunities for these owners
            $phoneList = $ownerRecords->pluck('mobile_number')
                ->filter()
                ->merge($ownerRecords->pluck('phone_number')->filter())
                ->unique();

            $linkedContacts = Contact::whereIn('phone', $phoneList)->with([
                'opportunities' => function ($q) {
                    $q->whereNotIn('stage', ['closed_won', 'closed_lost'])
                      ->with(['activities' => fn($qa) => $qa->where('type', 'call')->latest()])
                      ->latest();
                },
                'activities' => function ($q) {
                    $q->where('type', 'call')->latest();
                }
            ])->get()->keyBy('phone');

            $enrichedOwners = $ownerRecords->map(function ($record) use ($linkedContacts) {
                $contact = $linkedContacts->get($record->mobile_number) ?? $linkedContacts->get($record->phone_number);
                $opp = $contact && $contact->opportunities->count() > 0 ? $contact->opportunities->first() : null;
                $latestCall = $opp?->activities?->first() ?? $contact?->activities?->first();

                $record->active_opportunity = $opp;
                $record->contact_id = $contact ? $contact->id : null;
                $record->name = $record->owner_name;
                $record->call_outcome = $latestCall?->call_outcome ?? null;
                $record->is_new = empty($record->call_outcome);
                $record->contacted_today = (bool)($latestCall && $latestCall->created_at && Carbon::parse($latestCall->created_at)->isToday());
                return $record;
            });

            $all = $enrichedOwners->sortByDesc(function ($record) {
                return $record->created_at ? Carbon::parse($record->created_at)->timestamp : 0;
            })->values();
            $recent = $enrichedOwners->where('created_at', '>=', Carbon::now()->subDays(7))->values();
            $withOpportunity = $enrichedOwners->whereNotNull('active_opportunity')->values();
            $withoutOpportunity = $enrichedOwners->whereNull('active_opportunity')->values();
            $newOwnerLeads = $enrichedOwners->filter(fn($r) => empty($r->call_outcome))->values();
            $pendingOwnerCalls = $enrichedOwners->filter(fn($r) => empty($r->call_outcome) || ($r->active_opportunity && in_array($r->active_opportunity->sla_status, ['overdue', 'due_soon'])))->values();
            $contactedTodayOwner = $enrichedOwners->filter(fn($r) => !empty($r->contacted_today))->values();

            $canonicalStages = $this->getPipelineStages();

            return response()->json([
                'channel' => 'owner',
                'all' => $all,
                'new_leads' => $newOwnerLeads,
                'pending' => $pendingOwnerCalls,
                'contacted_today' => $contactedTodayOwner,
                'recent' => $recent,
                'with_opportunity' => $withOpportunity,
                'without_opportunity' => $withoutOpportunity,
                'counts' => [
                    'all' => $all->count(),
                    'new_leads' => $newOwnerLeads->count(),
                    'pending' => $pendingOwnerCalls->count(),
                    'contacted_today' => $contactedTodayOwner->count(),
                    'recent' => $recent->count(),
                    'with_opportunity' => $withOpportunity->count(),
                    'without_opportunity' => $withoutOpportunity->count(),
                ],
                'channel_counts' => [
                    'regular' => $totalRegularCount,
                    'owner' => $totalOwnerCount,
                ],
                'stages' => $canonicalStages
            ]);
        }

        // Regular Leads: Active Opportunities + Assigned Contacts (Awaiting qualification call)
        $oppQuery = Opportunity::with([
            'contact.activities' => fn($q) => $q->where('type', 'call')->latest(),
            'buyerQualification',
            'sellerQualification',
            'activities' => fn($q) => $q->where('type', 'call')->latest(),
        ])
            ->whereNotIn('stage', ['closed_won', 'closed_lost'])
            ->whereNotNull('current_owner_name')
            ->where('current_owner_name', '!=', '')
            ->where('current_owner_name', '!=', 'Unassigned')
            ->latest('created_at');

        if ($owner && $owner !== 'all') {
            $oppQuery->where('current_owner_name', $owner);
        }

        $opportunities = $oppQuery->get();

        // Dynamically update SLA status based on current time
        $now = Carbon::now();
        foreach ($opportunities as $opp) {
            $latestCall = $opp->activities->first() ?? $opp->contact?->activities?->first();
            $callOutcome = $latestCall?->call_outcome ?? null;

            $isTerminal = $callOutcome && (str_contains($callOutcome, 'Not Interested') || str_contains($callOutcome, 'Wrong Number'));

            if ($isTerminal) {
                $opp->sla_status = 'on_track';
                $opp->is_orphaned = false;
            } else if (!$opp->next_action_due_at || !$opp->next_action) {
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
            $opp->call_outcome = $callOutcome;
            $opp->has_opportunity = true;
            $opp->is_new = empty($callOutcome);
            $opp->contacted_today = (bool)($latestCall && $latestCall->created_at && Carbon::parse($latestCall->created_at)->isToday());
        }

        // Query assigned contacts that do NOT have an active opportunity yet
        $assignedContactsQuery = Contact::whereNotNull('assigned_to')
            ->where('assigned_to', '!=', '')
            ->where('assigned_to', '!=', 'Unassigned')
            ->whereDoesntHave('opportunities', function ($q) {
                $q->whereNotIn('stage', ['closed_won', 'closed_lost']);
            })
            ->latest('created_at');

        if ($owner && $owner !== 'all') {
            $assignedContactsQuery->where('assigned_to', $owner);
        }

        $assignedContacts = $assignedContactsQuery->with(['activities' => fn($q) => $q->where('type', 'call')->latest()])->get();

        $virtualItems = $assignedContacts->map(function ($c) use ($now) {
            $latestCall = $c->activities->first();
            $assignedAt = $c->assigned_at ? Carbon::parse($c->assigned_at) : ($c->created_at ? Carbon::parse($c->created_at) : $now);
            
            $nextAction = 'Contact new lead — confirm requirement details';
            $dueAt = $assignedAt->copy()->addHours(2);
            $slaStatus = 'on_track';

            if ($latestCall && $latestCall->call_outcome) {
                $isTerminal = str_contains($latestCall->call_outcome, 'Not Interested') || str_contains($latestCall->call_outcome, 'Wrong Number');
                if ($isTerminal) {
                    $nextAction = "Closed: {$latestCall->call_outcome}";
                    $dueAt = null;
                    $slaStatus = 'on_track';
                } else {
                    $nextAction = "Follow-up: {$latestCall->call_outcome}";
                    $dueAt = Carbon::parse($latestCall->created_at)->addHours(24);
                    if ($dueAt->isPast()) {
                        $slaStatus = 'overdue';
                    } elseif ($dueAt->diffInMinutes($now) <= 30) {
                        $slaStatus = 'due_soon';
                    }
                }
            } else {
                if ($dueAt->isPast()) {
                    $slaStatus = 'overdue';
                } elseif ($dueAt->diffInMinutes($now) <= 30) {
                    $slaStatus = 'due_soon';
                }
            }

            return (object) [
                'id' => -$c->id,
                'contact_id' => $c->id,
                'has_opportunity' => false,
                'contact' => $c,
                'current_owner_name' => $c->assigned_to,
                'opportunity_type' => 'buyer',
                'temperature' => 'warm',
                'stage' => 'unqualified',
                'sla_status' => $slaStatus,
                'call_outcome' => $latestCall?->call_outcome ?? null,
                'is_new' => empty($latestCall?->call_outcome),
                'contacted_today' => (bool)($latestCall && $latestCall->created_at && Carbon::parse($latestCall->created_at)->isToday()),
                'next_action' => $nextAction,
                'next_action_due_at' => $dueAt ? $dueAt->toIso8601String() : null,
                'budget_min' => null,
                'budget_max' => null,
                'buyer_qualification' => null,
                'buyerQualification' => null,
                'created_at' => $c->created_at ? $c->created_at->toIso8601String() : $now->toIso8601String(),
                'updated_at' => $c->updated_at ? $c->updated_at->toIso8601String() : $now->toIso8601String(),
            ];
        });

        $allItems = $opportunities->concat($virtualItems)
            ->sortByDesc(function ($item) {
                $date = $item->created_at ?? $item->contact?->created_at ?? null;
                return $date ? Carbon::parse($date)->timestamp : 0;
            })
            ->values();

        $newLeads = $allItems->filter(fn($item) => empty($item->call_outcome))->values();
        $pendingCalls = $allItems->filter(fn($item) => empty($item->call_outcome) || in_array($item->sla_status, ['overdue', 'due_soon']))->values();
        $contactedTodayList = $allItems->filter(fn($item) => !empty($item->contacted_today))->values();

        $overdue = $allItems->where('sla_status', 'overdue')->values();
        $dueNow = $allItems->where('sla_status', 'due_soon')->values();
        $hotLeads = $allItems->where('temperature', 'hot')->whereNotIn('sla_status', ['overdue'])->values();
        $upcoming = $allItems->where('sla_status', 'on_track')->where('temperature', '!=', 'hot')->values();

        $byStage = [
            'unqualified' => $allItems->where('stage', 'unqualified')->values(),
            'new' => $allItems->where('stage', 'new')->values(),
            'qualification' => $allItems->where('stage', 'qualification')->values(),
            'handover_pending' => $allItems->where('stage', 'handover_pending')->values(),
            'sales_in_progress' => $allItems->where('stage', 'sales_in_progress')->values(),
        ];

        return response()->json([
            'channel' => 'regular',
            'all' => $allItems->values(),
            'new_leads' => $newLeads,
            'pending' => $pendingCalls,
            'contacted_today' => $contactedTodayList,
            'by_stage' => $byStage,
            'overdue' => $overdue,
            'due_now' => $dueNow,
            'hot_leads' => $hotLeads,
            'upcoming' => $upcoming,
            'counts' => [
                'all' => $allItems->count(),
                'new_leads' => $newLeads->count(),
                'pending' => $pendingCalls->count(),
                'contacted_today' => $contactedTodayList->count(),
                'overdue' => $overdue->count(),
                'due_now' => $dueNow->count(),
                'hot_leads' => $hotLeads->count(),
                'upcoming' => $upcoming->count(),
                'unqualified' => $allItems->where('stage', 'unqualified')->count(),
                'new' => $allItems->where('stage', 'new')->count(),
                'qualification' => $allItems->where('stage', 'qualification')->count(),
                'handover_pending' => $allItems->where('stage', 'handover_pending')->count(),
                'sales_in_progress' => $allItems->where('stage', 'sales_in_progress')->count(),
            ],
            'channel_counts' => [
                'regular' => $totalRegularCount,
                'owner' => $totalOwnerCount,
            ],
            'stages' => $this->getPipelineStages(),
        ]);
    }

    private function getPipelineStages()
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

        return $canonicalStages;
    }

    /**
     * Bulk delete items from My Queue (supports both regular leads and owner leads).
     * Strictly preserves Contact permanency rule for regular leads.
     */
    public function bulkDelete(Request $request)
    {
        $channel = $request->input('channel', 'regular');
        $ids = $request->input('ids', []);

        if (empty($ids) || !is_array($ids)) {
            return response()->json([
                'success' => false,
                'message' => 'No IDs provided for bulk deletion.'
            ], 400);
        }

        if ($channel === 'owner') {
            $deletedCount = OwnerRecord::whereIn('id', $ids)->delete();
            return response()->json([
                'success' => true,
                'message' => "{$deletedCount} owner lead(s) deleted successfully.",
                'count' => $deletedCount,
            ]);
        }

        // Regular Leads channel:
        // Items in regular queue can be:
        // 1. Opportunities with positive IDs (opp.id > 0)
        // 2. Assigned Contacts awaiting qualification with negative IDs (-contact.id < 0)
        $oppIds = [];
        $contactIds = [];

        foreach ($ids as $id) {
            $num = (int)$id;
            if ($num > 0) {
                $oppIds[] = $num;
            } elseif ($num < 0) {
                $contactIds[] = abs($num);
            }
        }

        $deletedOppCount = 0;
        if (!empty($oppIds)) {
            $opps = Opportunity::whereIn('id', $oppIds)->get();
            $linkedContactIds = $opps->pluck('contact_id')->filter()->unique();

            foreach ($opps as $opp) {
                $opp->buyerQualification()?->delete();
                $opp->sellerQualification()?->delete();
                $opp->landlordQualification()?->delete();
                $opp->tenantQualification()?->delete();
            }

            $deletedOppCount = Opportunity::whereIn('id', $oppIds)->delete();

            // Contact permanency: Contact records are NEVER deleted when opportunities are removed.
            // Reset contact state to available if they have no other open deals.
            foreach ($linkedContactIds as $cid) {
                $c = Contact::find($cid);
                if ($c) {
                    $hasRemaining = Opportunity::where('contact_id', $cid)
                        ->whereNotIn('stage', ['closed_won', 'closed_lost'])
                        ->exists();
                    if (!$hasRemaining && $c->state === 'assigned') {
                        $c->update(['state' => 'available']);
                    }
                }
            }
        }

        $deletedContactCount = 0;
        if (!empty($contactIds)) {
            // Contacts awaiting qualification in My Queue: move to trash (soft delete)
            $deletedContactCount = Contact::whereIn('id', $contactIds)->delete();
        }

        $totalCount = $deletedOppCount + $deletedContactCount;

        return response()->json([
            'success' => true,
            'message' => "{$totalCount} lead(s) deleted successfully from queue.",
            'count' => $totalCount,
        ]);
    }
}
