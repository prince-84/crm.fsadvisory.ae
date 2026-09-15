<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Contact;
use App\Models\Opportunity;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ActivityController extends Controller
{
    public function store(Request $request)
    {
        if (!$request->contact_id && ($request->phone || $request->owner_record_id)) {
            $phone = $request->phone;
            $name = $request->contact_name ?? 'Owner Client';
            if ($request->owner_record_id) {
                $ownerRec = \App\Models\OwnerRecord::find($request->owner_record_id);
                if ($ownerRec) {
                    $phone = $ownerRec->mobile_number ?: ($ownerRec->phone_number ?: $phone);
                    $name = $ownerRec->name ?: $name;
                }
            }
            if ($phone) {
                $contact = Contact::firstOrCreate(
                    ['phone' => $phone],
                    ['name' => $name, 'source' => 'Owner Data']
                );
                $request->merge(['contact_id' => $contact->id]);
            }
        }

        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
            'type' => 'required|string',
            'call_outcome' => 'nullable|string',
            'description' => 'required|string',
            'user_name' => 'nullable|string',
            'next_action' => 'nullable|string',
            'next_action_due_at' => 'nullable|date',
        ]);

        $userName = $validated['user_name'] ?? 'Mako';

        $activity = Activity::create([
            'contact_id' => $validated['contact_id'],
            'opportunity_id' => $validated['opportunity_id'] ?? null,
            'user_name' => $userName,
            'type' => $validated['type'],
            'call_outcome' => $validated['call_outcome'] ?? null,
            'description' => $validated['description'],
        ]);

        $outcome = $validated['call_outcome'] ?? '';
        $isTerminal = str_contains($outcome, 'Not Interested') || str_contains($outcome, 'Wrong Number');

        $nextAction = $validated['next_action'] ?? null;
        $dueAt = null;
        $slaStatus = 'on_track';

        if (!empty($nextAction)) {
            if (!$isTerminal && !empty($validated['next_action_due_at'])) {
                $dueAt = Carbon::parse($validated['next_action_due_at']);
                if ($dueAt->isPast()) {
                    $slaStatus = 'overdue';
                } elseif ($dueAt->diffInMinutes(Carbon::now()) <= 15) {
                    $slaStatus = 'due_soon';
                } else {
                    $slaStatus = 'on_track';
                }
            }
        }

        // Update contact last activity, next follow-up and SLA status
        $contact = Contact::find($validated['contact_id']);
        if ($contact) {
            $contactUpdates = [
                'last_activity_at' => now(),
            ];
            if (!empty($nextAction)) {
                $contactUpdates['next_action'] = $nextAction;
                $contactUpdates['next_action_due_at'] = $dueAt;
                $contactUpdates['sla_status'] = $slaStatus;
            }
            $contact->update($contactUpdates);
        }

        // If opportunity exists or was provided, update opportunity
        $opp = null;
        if (!empty($validated['opportunity_id'])) {
            $opp = Opportunity::find($validated['opportunity_id']);
        }
        if (!$opp && !empty($validated['contact_id'])) {
            $opp = Opportunity::where('contact_id', $validated['contact_id'])->latest()->first();
        }

        if ($opp) {
            // Associate activity with opportunity if not already set
            if (!$activity->opportunity_id) {
                $activity->opportunity_id = $opp->id;
                $activity->save();
            }

            if (!empty($nextAction)) {
                $opp->next_action = $nextAction;
                $opp->next_action_due_at = $dueAt;
                $opp->sla_status = $slaStatus;
                $opp->is_orphaned = false;

                // If stage was still 'new' or 'new_inquiry', advance to contacted
                if (in_array($opp->stage, ['new', 'new_inquiry'])) {
                    $opp->stage = 'contacted';
                }

                $opp->save();
            }
        }

        return response()->json($activity, 201);
    }

    public function index(Request $request)
    {
        $query = Activity::with(['contact', 'opportunity.buyerQualification'])->latest();

        if ($request->has('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->has('call_outcome') && $request->call_outcome !== 'all') {
            $outcome = $request->call_outcome;
            if (str_contains($outcome, 'Interested') || str_contains($outcome, 'Viewing')) {
                $query->where(function ($q) {
                    $q->where('call_outcome', 'like', '%Interested%')
                      ->orWhere('call_outcome', 'like', '%Viewing%');
                });
            } elseif (str_contains($outcome, 'Callback')) {
                $query->where('call_outcome', 'like', '%Callback%');
            } elseif (str_contains($outcome, 'No Answer') || str_contains($outcome, 'Voicemail')) {
                $query->where(function ($q) {
                    $q->where('call_outcome', 'like', '%No Answer%')
                      ->orWhere('call_outcome', 'like', '%Voicemail%');
                });
            } elseif (str_contains($outcome, 'Not Interested')) {
                $query->where('call_outcome', 'like', '%Not Interested%');
            } elseif (str_contains($outcome, 'Follow-up')) {
                $query->where('call_outcome', 'like', '%Follow-up%');
            } else {
                $query->where('call_outcome', $outcome);
            }
        }

        if ($request->has('user_name') && $request->user_name !== 'all') {
            $query->where('user_name', $request->user_name);
        }

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('call_outcome', 'like', "%{$search}%")
                  ->orWhere('user_name', 'like', "%{$search}%")
                  ->orWhereHas('contact', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%");
                  });
            });
        }

        $activities = $query->paginate($request->input('per_page', 25));

        // Summary statistics calculated specifically for call activities
        $today = Carbon::today();
        $baseCallQuery = Activity::where('type', 'call');

        $totalCalls = (clone $baseCallQuery)->count();
        $callsToday = (clone $baseCallQuery)->whereDate('created_at', $today)->count();

        $interestedTotal = (clone $baseCallQuery)->where(function ($q) {
            $q->where('call_outcome', 'like', '%Interested%')
              ->orWhere('call_outcome', 'like', '%Viewing%');
        })->count();
        $interestedToday = (clone $baseCallQuery)->where(function ($q) {
            $q->where('call_outcome', 'like', '%Interested%')
              ->orWhere('call_outcome', 'like', '%Viewing%');
        })->whereDate('created_at', $today)->count();

        $callbackTotal = (clone $baseCallQuery)->where('call_outcome', 'like', '%Callback%')->count();
        $callbackToday = (clone $baseCallQuery)->where('call_outcome', 'like', '%Callback%')->whereDate('created_at', $today)->count();

        $noAnswerTotal = (clone $baseCallQuery)->where(function ($q) {
            $q->where('call_outcome', 'like', '%No Answer%')
              ->orWhere('call_outcome', 'like', '%Voicemail%');
        })->count();
        $noAnswerToday = (clone $baseCallQuery)->where(function ($q) {
            $q->where('call_outcome', 'like', '%No Answer%')
              ->orWhere('call_outcome', 'like', '%Voicemail%');
        })->whereDate('created_at', $today)->count();

        return response()->json([
            'activities' => $activities,
            'stats' => [
                'total_all_time' => $totalCalls,
                'total_today' => Activity::whereDate('created_at', $today)->count(),
                'calls_today' => $callsToday,
                'interested_count' => $interestedTotal,
                'interested_today' => $interestedToday,
                'callback_count' => $callbackTotal,
                'callback_today' => $callbackToday,
                'no_answer_count' => $noAnswerTotal,
                'no_answer_today' => $noAnswerToday,
            ]
        ]);
    }
}
