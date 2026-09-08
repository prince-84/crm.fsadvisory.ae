<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortalIntegration;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\BuyerQualification;
use App\Models\Activity;
use App\Services\LeadDistributionService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PortalController extends Controller
{
    public function index()
    {
        $portals = PortalIntegration::all();

        if ($portals->isEmpty()) {
            $defaultPortals = [
                ['portal_name' => 'property_finder', 'display_name' => 'Property Finder Dubai', 'is_active' => true, 'synced_count' => 1420, 'status' => 'active'],
                ['portal_name' => 'bayut', 'display_name' => 'Bayut UAE', 'is_active' => true, 'synced_count' => 980, 'status' => 'active'],
                ['portal_name' => 'dubizzle', 'display_name' => 'Dubizzle Property', 'is_active' => true, 'synced_count' => 640, 'status' => 'active'],
                ['portal_name' => 'google_ads', 'display_name' => 'Google Search Ads', 'is_active' => true, 'synced_count' => 3100, 'status' => 'active'],
                ['portal_name' => 'meta_ads', 'display_name' => 'Meta Lead Forms (FB/IG)', 'is_active' => true, 'synced_count' => 2450, 'status' => 'active'],
            ];

            foreach ($defaultPortals as $p) {
                PortalIntegration::create($p);
            }
            $portals = PortalIntegration::all();
        }

        return response()->json($portals);
    }

    public function ingest(Request $request)
    {
        $validated = $request->validate([
            'portal_name' => 'required|string',
            'client_name' => 'required|string',
            'client_phone' => 'required|string',
            'client_email' => 'nullable|email',
            'community' => 'nullable|string',
            'budget' => 'nullable|numeric',
            'landing_page_url' => 'nullable|string',
            'utm_source' => 'nullable|string',
            'utm_medium' => 'nullable|string',
            'utm_campaign' => 'nullable|string',
            'utm_term' => 'nullable|string',
            'utm_content' => 'nullable|string',
        ]);

        $portal = PortalIntegration::where('portal_name', $validated['portal_name'])->first();
        if ($portal) {
            $portal->increment('synced_count');
            $portal->update(['last_synced_at' => now()]);
        }

        $portalName = ucfirst(str_replace('_', ' ', $validated['portal_name']));

        // Check if phone matches any existing contact in database
        $existingContact = Contact::where('phone', $validated['client_phone'])
            ->orWhere('secondary_phone', $validated['client_phone'])
            ->first();

        $words = explode(' ', $validated['client_name']);
        $initials = strtoupper(substr($words[0] ?? 'C', 0, 1) . substr($words[1] ?? 'T', 0, 1));

        $isDuplicate = (bool) $existingContact;
        $state = $isDuplicate ? 'duplicate' : 'available';

        // ALWAYS create a new permanent Contact profile for incoming leads (no overwrite or merging)
        $contact = Contact::create([
            'name' => $validated['client_name'],
            'initials' => $initials,
            'nationality' => 'Expat / UAE Resident',
            'phone' => $validated['client_phone'],
            'email' => $validated['client_email'] ?? strtolower(str_replace(' ', '.', $validated['client_name'])) . '@portal-lead.ae',
            'source' => $portalName,
            'is_imported' => false,
            'state' => $state,
            'last_activity_at' => now(),
            'landing_page_url' => $validated['landing_page_url'] ?? null,
            'utm_source' => $validated['utm_source'] ?? null,
            'utm_medium' => $validated['utm_medium'] ?? null,
            'utm_campaign' => $validated['utm_campaign'] ?? null,
            'utm_term' => $validated['utm_term'] ?? null,
            'utm_content' => $validated['utm_content'] ?? null,
        ]);

        if ($isDuplicate) {
            // Duplicate Lead: routed to dedicated Duplicate tab for review; not auto-assigned to advisor rotation
            Activity::create([
                'contact_id' => $contact->id,
                'opportunity_id' => null,
                'user_name' => 'System / Webhook',
                'type' => 'note',
                'description' => "Duplicate inquiry received via {$portalName}. Matches existing Contact #{$existingContact->id} ({$existingContact->name}, Phone: {$existingContact->phone}). Displayed in Duplicate tab for review.",
            ]);

            Activity::create([
                'contact_id' => $existingContact->id,
                'opportunity_id' => null,
                'user_name' => 'System / Webhook',
                'type' => 'note',
                'description' => "Re-inquiry received from {$portalName}. A new duplicate profile #{$contact->id} was created and displayed in Duplicate tab.",
            ]);

            return response()->json([
                'success' => true,
                'is_duplicate' => true,
                'message' => "Duplicate inquiry received from {$portalName}. Profile #{$contact->id} created and displayed in Duplicate tab.",
                'contact' => $contact,
                'matched_contact_id' => $existingContact->id,
            ], 201);
        }

        // Dynamic Lead Distribution according to Master Settings scope
        $settings = LeadDistributionService::getSettings();
        $assignedAgent = null;
        if ($settings->is_enabled && $settings->apply_to_lead_pool) {
            $assignedAgent = LeadDistributionService::autoAssignContact($contact, 'lead_pool');
            $contact->refresh();
        }

        if (!$assignedAgent) {
            Activity::create([
                'contact_id' => $contact->id,
                'opportunity_id' => null,
                'user_name' => 'System / Webhook',
                'type' => 'note',
                'description' => "New Inbound Lead ingested from {$portalName}. Placed in New Leads pool awaiting manual allocation.",
            ]);
        }

        return response()->json([
            'success' => true,
            'is_duplicate' => false,
            'message' => $assignedAgent ? "New Lead ingested from {$portalName} and assigned to {$assignedAgent->name}." : "New Lead ingested from {$portalName}. Contact #{$contact->id} placed in New Leads pool.",
            'contact' => $contact->fresh(),
            'assigned_agent' => $assignedAgent ? $assignedAgent->name : null,
        ], 201);
    }
}
