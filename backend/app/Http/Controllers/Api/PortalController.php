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

        // Match existing contact by phone or create new
        $contact = Contact::where('phone', $validated['client_phone'])->first();

        if ($contact) {
            // Existing Contact Re-inquiry
            $contact->update([
                'state' => 'active',
                'last_activity_at' => now(),
                'landing_page_url' => $validated['landing_page_url'] ?? $contact->landing_page_url,
                'utm_source' => $validated['utm_source'] ?? $contact->utm_source,
                'utm_medium' => $validated['utm_medium'] ?? $contact->utm_medium,
                'utm_campaign' => $validated['utm_campaign'] ?? $contact->utm_campaign,
                'utm_term' => $validated['utm_term'] ?? $contact->utm_term,
                'utm_content' => $validated['utm_content'] ?? $contact->utm_content,
            ]);
            $isReInquiry = true;
        } else {
            // Brand New Contact
            $words = explode(' ', $validated['client_name']);
            $initials = strtoupper(substr($words[0] ?? 'C', 0, 1) . substr($words[1] ?? 'T', 0, 1));

            $contact = Contact::create([
                'name' => $validated['client_name'],
                'initials' => $initials,
                'nationality' => 'Expat / UAE Resident',
                'phone' => $validated['client_phone'],
                'email' => $validated['client_email'] ?? strtolower(str_replace(' ', '.', $validated['client_name'])) . '@portal-lead.ae',
                'source' => ucfirst(str_replace('_', ' ', $validated['portal_name'])),
                'state' => 'active',
                'last_activity_at' => now(),
                'landing_page_url' => $validated['landing_page_url'] ?? null,
                'utm_source' => $validated['utm_source'] ?? null,
                'utm_medium' => $validated['utm_medium'] ?? null,
                'utm_campaign' => $validated['utm_campaign'] ?? null,
                'utm_term' => $validated['utm_term'] ?? null,
                'utm_content' => $validated['utm_content'] ?? null,
            ]);
            $isReInquiry = false;
        }

        $budget = $validated['budget'] ?? 2500000;

        // Auto create Opportunity
        $opp = Opportunity::create([
            'contact_id' => $contact->id,
            'opportunity_type' => 'buyer',
            'stage' => 'qualification',
            'temperature' => 'hot',
            'current_owner_name' => 'Faraz Shafi',
            'originating_agent_name' => 'Portal Ingest',
            'department' => 'sales',
            'budget_min' => $budget * 0.9,
            'budget_max' => $budget * 1.1,
            'next_action' => 'Contact lead re-inquiry from ' . ucfirst(str_replace('_', ' ', $validated['portal_name'])),
            'next_action_due_at' => Carbon::now()->addMinutes(15), // Urgent SLA
            'sla_status' => 'due_soon',
            'key_requirement' => 'Inquiry from ' . ucfirst(str_replace('_', ' ', $validated['portal_name'])) . ' for ' . ($validated['community'] ?? 'Downtown Dubai'),
        ]);

        // Auto-assign to dynamic agent rotation pool
        $assignedAgent = LeadDistributionService::autoAssignOpportunity($opp);
        if ($assignedAgent) {
            $opp->refresh();
        }

        BuyerQualification::create([
            'opportunity_id' => $opp->id,
            'client_intent' => 'end_user',
            'purchase_timeline' => 'Immediate',
            'community' => $validated['community'] ?? 'Downtown Dubai',
            'property_type' => 'Apartment',
            'bedrooms' => '2 BR',
            'lead_score' => 90,
            'qualification_notes' => 'Ingested from portal ' . $validated['portal_name'] . ($isReInquiry ? ' (Re-inquiry matched to existing Contact)' : ''),
        ]);

        Activity::create([
            'contact_id' => $contact->id,
            'opportunity_id' => $opp->id,
            'user_name' => 'System / Webhook',
            'type' => 'note',
            'description' => $isReInquiry 
                ? "Re-inquiry received via " . ucfirst(str_replace('_', ' ', $validated['portal_name'])) . ". Matched to existing Contact #{$contact->id}. Created new Opportunity #{$opp->id} & 15-min SLA assigned to Mako."
                : "New Lead Ingested from " . ucfirst(str_replace('_', ' ', $validated['portal_name'])) . ". Created Contact #{$contact->id} & 15-min SLA assigned to Mako.",
        ]);

        return response()->json([
            'success' => true,
            'is_re_inquiry' => $isReInquiry,
            'message' => $isReInquiry 
                ? "Re-inquiry matched to existing Contact {$contact->name}. Created Opportunity #{$opp->id} & assigned to Telesales."
                : "New Lead ingested. Created Contact & Opportunity #{$opp->id}.",
            'contact' => $contact,
            'opportunity' => $opp,
        ], 201);
    }
}
