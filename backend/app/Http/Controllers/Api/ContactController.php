<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\Activity;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function index(Request $request)
    {
        $tab = $request->get('tab', 'all');

        if ($tab === 'deleted') {
            $query = Contact::onlyTrashed()->with(['opportunities.buyerQualification', 'activities' => function($q) {
                $q->latest()->limit(1);
            }]);
        } else {
            $query = Contact::with(['opportunities.buyerQualification', 'activities' => function($q) {
                $q->latest()->limit(1);
            }]);
        }

        // Apply Tab Filter Logic
        if ($tab === 'unassigned') {
            $query->where(function($q) {
                $q->whereDoesntHave('opportunities')
                  ->orWhereHas('opportunities', function($oppQ) {
                      $oppQ->whereNull('current_owner_name')
                           ->orWhere('current_owner_name', '')
                           ->orWhere('current_owner_name', 'Unassigned');
                  });
            });
        } elseif ($tab === 'duplicate') {
            $query->where('state', 'duplicate');
        }

        if ($request->has('state') && $request->state !== 'all') {
            $query->where('state', $request->state);
        }

        if ($request->has('source') && !empty($request->source) && $request->source !== 'all') {
            $query->where('source', 'like', "%{$request->source}%");
        }

        if ($request->filled('assigned_owner') && $request->assigned_owner !== 'all') {
            $owner = $request->assigned_owner;
            $query->whereHas('opportunities', function($q) use ($owner) {
                $q->where('current_owner_name', $owner);
            });
        }

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('secondary_phone', 'like', "%{$search}%")
                  ->orWhere('mobile_phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $sortBy = $request->get('sort_by', 'updated_at');
        $sortOrder = strtolower($request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';

        $contactSorts = ['name', 'phone', 'secondary_phone', 'mobile_phone', 'email', 'nationality', 'source', 'state', 'created_at', 'updated_at'];
        $oppSorts = [
            'opportunity_type' => 'opportunity_type',
            'developer' => 'developer',
            'community' => 'community',
            'project' => 'project',
            'project_property' => 'project_property',
            'bedrooms' => 'bedrooms',
            'budget_min' => 'budget_min',
            'budget_max' => 'budget_max',
            'cash_or_finance' => 'cash_or_finance',
            'key_requirement' => 'key_requirement',
            'assigned_owner' => 'current_owner_name',
            'next_action' => 'next_action',
            'next_action_due_at' => 'next_action_due_at',
            'sla' => 'sla_status',
            'sla_status' => 'sla_status',
        ];

        if (array_key_exists($sortBy, $oppSorts)) {
            $dbCol = $oppSorts[$sortBy];
            $query->leftJoin('opportunities', 'contacts.id', '=', 'opportunities.contact_id')
                  ->select('contacts.*')
                  ->distinct()
                  ->orderBy("opportunities.{$dbCol}", $sortOrder);
        } elseif (in_array($sortBy, $contactSorts)) {
            $query->orderBy("contacts.{$sortBy}", $sortOrder);
        } else {
            $query->orderBy("contacts.updated_at", "desc");
        }

        $perPage = (int) $request->get('per_page', 20);
        $contacts = $query->paginate($perPage);

        // Stats calculation for Top KPI Cards & Tab Badge Counts
        $stats = [
            'total' => Contact::count(),
            'available' => Contact::where('state', 'available')->count(),
            'active' => Contact::where('state', 'active')->count(),
            'reactivation' => Contact::where('state', 'reactivation')->count(),
            'duplicates' => Contact::where('state', 'duplicate')->count(),
        ];

        $tabCounts = [
            'all' => Contact::count(),
            'unassigned' => Contact::where(function($q) {
                $q->whereDoesntHave('opportunities')
                  ->orWhereHas('opportunities', function($oppQ) {
                      $oppQ->whereNull('current_owner_name')
                           ->orWhere('current_owner_name', '')
                           ->orWhere('current_owner_name', 'Unassigned');
                  });
            })->count(),
            'duplicate' => Contact::where('state', 'duplicate')->count(),
            'deleted' => Contact::onlyTrashed()->count(),
        ];

        return response()->json([
            'contacts' => $contacts,
            'stats' => $stats,
            'tab_counts' => $tabCounts,
        ]);
    }

    public function show($id)
    {
        $contact = Contact::with([
            'opportunities.buyerQualification',
            'opportunities.sellerQualification',
            'opportunities.landlordQualification',
            'opportunities.tenantQualification',
            'activities',
        ])->findOrFail($id);

        return response()->json($contact);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:50',
            'secondary_phone' => 'nullable|string|max:255',
            'email' => 'required|email|max:255',
            'nationality' => 'nullable|string|max:100',
            'source' => 'nullable|string|max:100',
            'initials' => 'nullable|string|max:10',
            'utm_source' => 'nullable|string|max:255',
            'utm_medium' => 'nullable|string|max:255',
            'utm_campaign' => 'nullable|string|max:255',
            'utm_term' => 'nullable|string|max:255',
            'utm_content' => 'nullable|string|max:255',
            'landing_page_url' => 'nullable|string|max:2048',
        ]);

        if (empty($validated['initials'])) {
            $words = explode(' ', $validated['name']);
            $initials = '';
            foreach ($words as $w) {
                $initials .= strtoupper(substr($w, 0, 1));
            }
            $validated['initials'] = substr($initials, 0, 2);
        }

        $validated['source'] = $validated['source'] ?? 'Database';
        $contact = Contact::create($validated);

        if ($request->has('activity_description')) {
            Activity::create([
                'contact_id' => $contact->id,
                'user_name' => $request->get('user_name', 'System Agent'),
                'type' => $request->get('activity_type', 'note'),
                'description' => $request->get('activity_description'),
            ]);
            $contact->update(['last_activity_at' => now()]);
        } else {
            $contact->update(['last_activity_at' => now()]);
        }

        return response()->json($contact, 201);
    }

    public function update(Request $request, $id)
    {
        $contact = Contact::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:50',
            'secondary_phone' => 'nullable|string|max:255',
            'email' => 'required|email|max:255',
            'nationality' => 'nullable|string|max:100',
            'source' => 'nullable|string|max:100',
            'utm_source' => 'nullable|string|max:255',
            'utm_medium' => 'nullable|string|max:255',
            'utm_campaign' => 'nullable|string|max:255',
            'utm_term' => 'nullable|string|max:255',
            'utm_content' => 'nullable|string|max:255',
            'landing_page_url' => 'nullable|string|max:2048',
        ]);

        if (!empty($validated['name'])) {
            $words = explode(' ', $validated['name']);
            $initials = '';
            foreach ($words as $w) {
                $initials .= strtoupper(substr($w, 0, 1));
            }
            $validated['initials'] = substr($initials, 0, 2);
        }

        $contact->update($validated);

        Activity::create([
            'contact_id' => $contact->id,
            'user_name' => 'System Agent',
            'type' => 'note',
            'description' => "Updated client contact profile details.",
        ]);

        return response()->json($contact);
    }

    public function destroy($id)
    {
        $contact = Contact::findOrFail($id);
        $contact->delete();

        return response()->json(['message' => 'Contact moved to trash successfully.']);
    }

    public function restore($id)
    {
        $contact = Contact::onlyTrashed()->findOrFail($id);
        $contact->restore();

        return response()->json(['message' => 'Contact restored successfully.']);
    }

    public function forceDelete($id)
    {
        $contact = Contact::onlyTrashed()->findOrFail($id);
        $contact->forceDelete();

        return response()->json(['message' => 'Contact permanently deleted.']);
    }

    public function bulkAssign(Request $request)
    {
        $request->validate([
            'contact_ids' => 'required|array',
            'contact_ids.*' => 'integer|exists:contacts,id',
            'assigned_owner' => 'required|string|max:255',
        ]);

        $ids = $request->input('contact_ids', []);
        $owner = $request->input('assigned_owner');

        $opportunities = Opportunity::whereIn('contact_id', $ids)->get();
        foreach ($opportunities as $opp) {
            $opp->update(['current_owner_name' => $owner]);
        }

        $existingOppContactIds = $opportunities->pluck('contact_id')->toArray();
        $contactsWithoutOpp = Contact::whereIn('id', array_diff($ids, $existingOppContactIds))->get();

        foreach ($contactsWithoutOpp as $c) {
            $opp = Opportunity::create([
                'contact_id' => $c->id,
                'opportunity_type' => 'buyer',
                'stage' => 'qualified',
                'current_owner_name' => $owner,
                'sla_status' => 'on_track',
                'next_action_due_at' => now()->addHours(24),
            ]);

            \App\Models\BuyerQualification::create([
                'opportunity_id' => $opp->id,
                'community' => 'Downtown Dubai',
                'budget_min' => 1000000,
                'budget_max' => 5000000,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => count($ids) . " leads successfully assigned to {$owner}.",
        ]);
    }

    public function bulkDelete(Request $request)
    {
        $request->validate([
            'contact_ids' => 'required|array',
            'contact_ids.*' => 'integer|exists:contacts,id',
        ]);

        $ids = $request->input('contact_ids', []);
        Contact::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => count($ids) . " leads moved to trash.",
        ]);
    }
}
