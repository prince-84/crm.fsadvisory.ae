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

        // Update contact last activity
        Contact::where('id', $validated['contact_id'])->update([
            'last_activity_at' => now(),
        ]);

        // If opportunity and next action provided, update opportunity
        if (!empty($validated['opportunity_id']) && !empty($validated['next_action'])) {
            $opp = Opportunity::find($validated['opportunity_id']);
            if ($opp) {
                $dueAt = !empty($validated['next_action_due_at']) 
                    ? Carbon::parse($validated['next_action_due_at']) 
                    : Carbon::now()->addHours(24);

                $opp->next_action = $validated['next_action'];
                $opp->next_action_due_at = $dueAt;
                $opp->is_orphaned = false;
                
                // SLA check
                if ($dueAt->isPast()) {
                    $opp->sla_status = 'overdue';
                } elseif ($dueAt->diffInMinutes(Carbon::now()) <= 30) {
                    $opp->sla_status = 'due_soon';
                } else {
                    $opp->sla_status = 'on_track';
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
            $query->where('call_outcome', $request->call_outcome);
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

        // Summary statistics for today
        $today = Carbon::today();
        $totalToday = Activity::whereDate('created_at', $today)->count();
        $callsToday = Activity::where('type', 'call')->whereDate('created_at', $today)->count();
        $interestedToday = Activity::where('call_outcome', 'like', '%Interested%')->whereDate('created_at', $today)->count();
        $callbackToday = Activity::where('call_outcome', 'like', '%Callback%')->whereDate('created_at', $today)->count();
        $noAnswerToday = Activity::where('call_outcome', 'like', '%No Answer%')->whereDate('created_at', $today)->count();

        return response()->json([
            'activities' => $activities,
            'stats' => [
                'total_today' => $totalToday,
                'calls_today' => $callsToday,
                'interested_today' => $interestedToday,
                'callback_today' => $callbackToday,
                'no_answer_today' => $noAnswerToday,
                'total_all_time' => Activity::count(),
            ]
        ]);
    }
}
