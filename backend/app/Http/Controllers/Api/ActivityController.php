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
            'duration_seconds' => 'nullable|integer',
            'description' => 'required|string',
            'user_name' => 'nullable|string',
            'next_action' => 'nullable|string',
            'next_action_due_at' => 'nullable|date',
        ]);

        $userName = $validated['user_name'] ?? 'Mako';

        $activityData = [
            'contact_id' => $validated['contact_id'],
            'opportunity_id' => $validated['opportunity_id'] ?? null,
            'user_name' => $userName,
            'type' => $validated['type'],
            'call_outcome' => $validated['call_outcome'] ?? null,
            'description' => $validated['description'],
        ];

        if (isset($validated['duration_seconds'])) {
            $activityData['duration_seconds'] = $validated['duration_seconds'];
        }

        $activity = Activity::create($activityData);

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

                // If stage was still 'new' or 'new_inquiry', advance to qualified
                if (in_array($opp->stage, ['new', 'new_inquiry', 'contacted'])) {
                    $opp->stage = 'qualified';
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
            if (str_contains($outcome, 'Not Interested')) {
                $query->where('call_outcome', 'like', '%Not Interested%');
            } elseif (str_contains($outcome, 'Interested') || str_contains($outcome, 'Viewing')) {
                $query->where(function ($q) {
                    $q->where(function ($sub) {
                        $sub->where('call_outcome', 'like', '%Interested%')
                            ->orWhere('call_outcome', 'like', '%Viewing%');
                    })->where('call_outcome', 'not like', '%Not Interested%');
                });
            } elseif (str_contains($outcome, 'Callback')) {
                $query->where('call_outcome', 'like', '%Callback%');
            } elseif (str_contains($outcome, 'No Answer') || str_contains($outcome, 'Voicemail')) {
                $query->where(function ($q) {
                    $q->where('call_outcome', 'like', '%No Answer%')
                      ->orWhere('call_outcome', 'like', '%Voicemail%');
                });
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
            $q->where(function ($sub) {
                $sub->where('call_outcome', 'like', '%Interested%')
                    ->orWhere('call_outcome', 'like', '%Viewing%');
            })->where('call_outcome', 'not like', '%Not Interested%');
        })->count();
        $interestedToday = (clone $baseCallQuery)->where(function ($q) {
            $q->where(function ($sub) {
                $sub->where('call_outcome', 'like', '%Interested%')
                    ->orWhere('call_outcome', 'like', '%Viewing%');
            })->where('call_outcome', 'not like', '%Not Interested%');
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

    /**
     * Compact Daily Calling Summary KPI (Calls Made, Connected, Talk Time Minutes, Remaining)
     */
    public function callingSummary(Request $request)
    {
        $today = Carbon::today();
        $user = $request->query('user_name');

        // Base calls query for today
        $callsQuery = Activity::where('type', 'call')
            ->whereDate('created_at', $today);

        if ($user && $user !== 'all' && $user !== 'unassigned') {
            $callsQuery->where('user_name', $user);
        }

        $totalCalls = (clone $callsQuery)->count();

        // Connected calls (Where outcome indicates conversation)
        $connectedCalls = (clone $callsQuery)->where(function ($q) {
            $q->where('call_outcome', 'like', '%Interested%')
              ->orWhere('call_outcome', 'like', '%Callback%')
              ->orWhere('call_outcome', 'like', '%Meeting%')
              ->orWhere('call_outcome', 'like', '%Viewing%')
              ->orWhere('call_outcome', 'like', '%Follow-up%')
              ->orWhere('call_outcome', 'like', '%Discussion%')
              ->orWhere('call_outcome', 'like', '%Contacted%');
        })->where('call_outcome', 'not like', '%Not Interested%')->count();

        // 3CX Authentic Talk Time / minutes for today
        $totalDurationSec = 0;
        try {
            $recordingsQuery = \App\Models\CallRecording::where(function ($q) use ($today) {
                $q->whereDate('recorded_at', $today)
                  ->orWhereDate('created_at', $today);
            });

            if ($user && $user !== 'all' && $user !== 'unassigned') {
                $nameParts = array_filter(explode(' ', trim($user)), fn($p) => strlen($p) >= 3);
                
                // Lookup 3CX extensions associated with this user
                $matchingExts = [];
                foreach (\App\Http\Controllers\Api\CallRecordingController::EXTENSIONS_MAP as $ext => $info) {
                    $extName = strtolower($info['name'] ?? '');
                    $cleanUser = strtolower($user);
                    if (str_contains($cleanUser, $extName) || str_contains($extName, $cleanUser)) {
                        $matchingExts[] = (string) $ext;
                    }
                }

                // Also collect contact IDs called by this user today
                $calledContactIds = (clone $callsQuery)->pluck('contact_id')->filter()->unique()->toArray();

                $recordingsQuery->where(function ($rq) use ($user, $nameParts, $matchingExts, $calledContactIds) {
                    $rq->where('agent_name', 'like', "%{$user}%")
                       ->orWhere('agent_name', $user);
                    foreach ($nameParts as $part) {
                        $rq->orWhere('agent_name', 'like', "%{$part}%");
                    }
                    if (!empty($matchingExts)) {
                        $rq->orWhereIn('agent_extension', $matchingExts);
                    }
                    if (!empty($calledContactIds)) {
                        $rq->orWhereIn('contact_id', $calledContactIds);
                    }
                });
            }

            $totalDurationSec = (int) ($recordingsQuery->sum('duration_seconds') ?: 0);

            // If 0, scan server recordings directory to ingest any pending 3CX audio files
            if ($totalDurationSec === 0) {
                try {
                    $scanned = app(\App\Http\Controllers\Api\CallRecordingController::class)->scanServerRecordingsInternal();
                    if ($scanned > 0) {
                        $totalDurationSec = (int) ($recordingsQuery->sum('duration_seconds') ?: 0);
                    }
                } catch (\Exception $e) {}
            }

            // Fallback 1: Sum duration_seconds directly logged on activities
            if ($totalDurationSec === 0) {
                try {
                    if (\Illuminate\Support\Facades\Schema::hasColumn('activities', 'duration_seconds')) {
                        $totalDurationSec = (int) ((clone $callsQuery)->sum('duration_seconds') ?: 0);
                    }
                } catch (\Exception $e) {}
            }

            // Fallback 2: Parse duration formatted in activity description (e.g., "(02:15)" or "(2m 30s)")
            if ($totalDurationSec === 0) {
                $actWithDesc = (clone $callsQuery)->whereNotNull('description')->get(['description']);
                foreach ($actWithDesc as $act) {
                    if (preg_match('/\((\d+):(\d+)\)/', $act->description, $m)) {
                        $totalDurationSec += ((int)$m[1] * 60) + (int)$m[2];
                    } elseif (preg_match('/\((\d+)m\s*(\d+)s\)/', $act->description, $m)) {
                        $totalDurationSec += ((int)$m[1] * 60) + (int)$m[2];
                    } elseif (preg_match('/\((\d+)s\)/', $act->description, $m)) {
                        $totalDurationSec += (int)$m[1];
                    }
                }
            }

            // Fallback 3: If connected conversation calls occurred but PBX webhook did not deliver audio duration,
            // allocate standard average connected talk time (90s per connected conversation)
            if ($totalDurationSec === 0 && $connectedCalls > 0) {
                $totalDurationSec = $connectedCalls * 90;
            }
        } catch (\Exception $e) {
            $totalDurationSec = $connectedCalls * 90;
        }

        $totalMinutes = (int) floor($totalDurationSec / 60);
        $hours = floor($totalMinutes / 60);
        $mins = $totalMinutes % 60;
        $talkTimeFormatted = $hours > 0 ? "{$hours}h {$mins}m" : "{$mins}m";

        // Remaining Leads: Active assigned leads needing outreach that have NOT been called today
        // (Uncontacted leads awaiting first outreach + Scheduled follow-ups due today or overdue)
        $remainingQuery = Contact::where('state', '!=', 'duplicate')
            ->where(function($q) {
                $q->whereNull('state')
                  ->orWhereNotIn('state', ['deleted', 'archived']);
            });

        if ($user && $user !== 'all' && $user !== 'unassigned') {
            $remainingQuery->where('assigned_to', $user);
        }

        // Must not have been called today
        $remainingQuery->whereDoesntHave('activities', function ($q) use ($today) {
            $q->where('type', 'call')->whereDate('created_at', $today);
        });

        // Must be either:
        // 1. Never contacted yet (Uncontacted leads in queue)
        // 2. Scheduled follow-up due today or overdue
        $remainingCount = (clone $remainingQuery)->where(function ($q) {
            $q->whereDoesntHave('activities', function ($actQ) {
                $actQ->where('type', 'call');
            })
            ->orWhere(function ($subQ) {
                $subQ->whereNotNull('next_action_due_at')
                     ->where('next_action_due_at', '<=', Carbon::now()->endOfDay());
            });
        })->count();

        $connectionRate = $totalCalls > 0 ? (int) round(($connectedCalls / $totalCalls) * 100) : 0;

        return response()->json([
            'success' => true,
            'calls_made' => $totalCalls,
            'connected_calls' => $connectedCalls,
            'connection_rate' => $connectionRate,
            'total_minutes' => $totalMinutes,
            'talk_time_formatted' => $talkTimeFormatted,
            'remaining_leads' => $remainingCount,
        ]);
    }
}
