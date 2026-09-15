<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\Activity;
use Illuminate\Http\Request;
use Carbon\Carbon;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Appointment::with(['contact', 'opportunity']);

        // 1. Date / Month / Range filtering
        if ($request->filled('date')) {
            $query->whereDate('appointment_date', $request->date);
        } elseif ($request->filled('month') && $request->filled('year')) {
            $query->whereYear('appointment_date', $request->year)
                  ->whereMonth('appointment_date', $request->month);
        } elseif ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('appointment_date', [$request->from, $request->to]);
        }

        // 2. Category filtering
        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        // 3. Agent / Scope filtering
        $agentFilter = $request->get('agent_name', $request->get('agent', $request->get('owner')));
        if (!empty($agentFilter) && $agentFilter !== 'all') {
            $query->where('agent_name', $agentFilter);
        }

        // 4. Status filtering
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // 5. Search query
        if ($request->filled('q')) {
            $search = trim($request->q);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('client_name', 'like', "%{$search}%")
                  ->orWhere('client_phone', 'like', "%{$search}%")
                  ->orWhere('location', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        $appointments = $query->orderBy('appointment_date', 'asc')
            ->orderBy('start_time', 'asc')
            ->get();

        // Compute Live Summary Stats (Scoped to current agent filter if set)
        $statsQuery = Appointment::query();
        if (!empty($agentFilter) && $agentFilter !== 'all') {
            $statsQuery->where('agent_name', $agentFilter);
        }

        $today = Carbon::today()->toDateString();
        $stats = [
            'total' => (clone $statsQuery)->count(),
            'viewings' => (clone $statsQuery)->where('category', 'viewing')->count(),
            'spas' => (clone $statsQuery)->where('category', 'spa')->count(),
            'completed' => (clone $statsQuery)->where('status', 'completed')->count(),
            'today_count' => (clone $statsQuery)->whereDate('appointment_date', $today)->count(),
        ];

        return response()->json([
            'success' => true,
            'appointments' => $appointments,
            'stats' => $stats,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'category' => 'required|string|in:viewing,meeting,spa,valuation',
            'appointment_date' => 'required|date',
            'start_time' => 'required|string|max:50',
            'end_time' => 'nullable|string|max:50',
            'client_name' => 'required|string|max:255',
            'client_phone' => 'required|string|max:100',
            'client_email' => 'nullable|email|max:255',
            'agent_name' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:scheduled,completed,cancelled',
            'priority' => 'nullable|string|in:high,medium,normal',
            'notes' => 'nullable|string',
            'contact_id' => 'nullable|exists:contacts,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
        ]);

        if (empty($validated['status'])) {
            $validated['status'] = 'scheduled';
        }
        if (empty($validated['priority'])) {
            $validated['priority'] = 'normal';
        }

        // Auto-match Contact by phone if contact_id is missing
        if (empty($validated['contact_id']) && !empty($validated['client_phone'])) {
            $cleanPhone = preg_replace('/[^0-9]/', '', $validated['client_phone']);
            if (strlen($cleanPhone) >= 7) {
                $last7 = substr($cleanPhone, -7);
                $matchedContact = Contact::where('phone', 'like', "%{$last7}%")
                    ->orWhere('secondary_phone', 'like', "%{$last7}%")
                    ->first();

                if ($matchedContact) {
                    $validated['contact_id'] = $matchedContact->id;
                    if (empty($validated['opportunity_id'])) {
                        $latestOpp = $matchedContact->opportunities()->latest('id')->first();
                        if ($latestOpp) {
                            $validated['opportunity_id'] = $latestOpp->id;
                        }
                    }
                }
            }
        }

        $appointment = Appointment::create($validated);

        // Auto-log audit note on Client Timeline if linked to Contact
        if ($appointment->contact_id) {
            try {
                $categoryLabel = ucfirst($appointment->category);
                Activity::create([
                    'contact_id' => $appointment->contact_id,
                    'opportunity_id' => $appointment->opportunity_id,
                    'user_name' => $appointment->agent_name,
                    'type' => 'note',
                    'description' => "📅 Appointment Scheduled: [{$categoryLabel}] {$appointment->title} on {$appointment->appointment_date->format('Y-m-d')} at {$appointment->start_time}" . ($appointment->location ? " ({$appointment->location})" : ""),
                ]);
            } catch (\Exception $e) {
                // Do not block appointment creation if activity log fails
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Appointment scheduled successfully.',
            'appointment' => $appointment->load(['contact', 'opportunity']),
        ], 201);
    }

    public function show($id)
    {
        $appointment = Appointment::with(['contact', 'opportunity'])->find($id);

        if (!$appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Appointment not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'appointment' => $appointment,
        ]);
    }

    public function update(Request $request, $id)
    {
        $appointment = Appointment::find($id);

        if (!$appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Appointment not found.',
            ], 404);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'category' => 'sometimes|required|string|in:viewing,meeting,spa,valuation',
            'appointment_date' => 'sometimes|required|date',
            'start_time' => 'sometimes|required|string|max:50',
            'end_time' => 'nullable|string|max:50',
            'client_name' => 'sometimes|required|string|max:255',
            'client_phone' => 'sometimes|required|string|max:100',
            'client_email' => 'nullable|email|max:255',
            'agent_name' => 'sometimes|required|string|max:255',
            'location' => 'nullable|string|max:255',
            'status' => 'sometimes|required|string|in:scheduled,completed,cancelled',
            'priority' => 'sometimes|required|string|in:high,medium,normal',
            'notes' => 'nullable|string',
            'contact_id' => 'nullable|exists:contacts,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
        ]);

        $appointment->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Appointment updated successfully.',
            'appointment' => $appointment->fresh(['contact', 'opportunity']),
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $appointment = Appointment::find($id);

        if (!$appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Appointment not found.',
            ], 404);
        }

        $validated = $request->validate([
            'status' => 'required|string|in:scheduled,completed,cancelled',
        ]);

        $prevStatus = $appointment->status;
        $appointment->update(['status' => $validated['status']]);

        // If status changed and linked to a contact, log activity
        if ($appointment->contact_id && $prevStatus !== $validated['status']) {
            try {
                $statusLabel = ucfirst($validated['status']);
                Activity::create([
                    'contact_id' => $appointment->contact_id,
                    'opportunity_id' => $appointment->opportunity_id,
                    'user_name' => $appointment->agent_name,
                    'type' => 'note',
                    'description' => "📅 Appointment Status Changed: \"{$appointment->title}\" marked as [{$statusLabel}].",
                ]);
            } catch (\Exception $e) {
                // Ignore audit activity log error
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Appointment marked as {$validated['status']}.",
            'appointment' => $appointment->fresh(['contact', 'opportunity']),
        ]);
    }

    public function destroy($id)
    {
        $appointment = Appointment::find($id);

        if (!$appointment) {
            return response()->json([
                'success' => false,
                'message' => 'Appointment not found.',
            ], 404);
        }

        $appointment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Appointment removed successfully.',
        ]);
    }
}
