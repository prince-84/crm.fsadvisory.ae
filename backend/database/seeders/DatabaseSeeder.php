<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\BuyerQualification;
use App\Models\Activity;
use App\Models\OwnershipHistory;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(LeadSourceSeeder::class);

        $now = Carbon::now();

        // 1. Ahmed Al Rashidi (Active Buyer with Multiple Opportunities as described in SCOPE.md)
        $ahmed = Contact::create([
            'name' => 'Ahmed Al Rashidi',
            'initials' => 'AR',
            'nationality' => 'Emirati',
            'phone' => '+971 50 123 4567',
            'email' => 'ahmed.alrashidi@example.com',
            'source' => 'Google Ads',
            'state' => 'active',
            'last_activity_at' => $now->copy()->subMinutes(12),
        ]);

        // Opportunity 001 - Closed Lost
        $opp1 = Opportunity::create([
            'contact_id' => $ahmed->id,
            'opportunity_type' => 'buyer',
            'stage' => 'closed_lost',
            'temperature' => 'cold',
            'current_owner_name' => 'Mako',
            'originating_agent_name' => 'Mako',
            'department' => 'telesales',
            'budget_min' => 1500000,
            'budget_max' => 1800000,
            'next_action' => 'Archived lead',
            'next_action_due_at' => $now->copy()->subMonths(6),
            'sla_status' => 'on_track',
            'key_requirement' => 'Buyer Opportunity #001 — Budget mismatch for Downtown 2BR',
            'created_at' => $now->copy()->subMonths(6),
        ]);

        // Opportunity 002 - Active HOT Overdue Lead
        $opp2 = Opportunity::create([
            'contact_id' => $ahmed->id,
            'opportunity_type' => 'buyer',
            'stage' => 'qualification',
            'temperature' => 'hot',
            'current_owner_name' => 'Mako',
            'originating_agent_name' => 'Mako',
            'department' => 'telesales',
            'budget_min' => 1800000,
            'budget_max' => 2200000,
            'next_action' => 'Call client — confirm appointment for Saturday viewing',
            'next_action_due_at' => $now->copy()->subMinutes(12), // Overdue by 12 mins
            'sla_status' => 'overdue',
            'key_requirement' => 'Buyer Opportunity #002 — Ready to purchase 2BR Apartment in Business Bay / Downtown',
            'created_at' => $now->copy()->subDays(3),
        ]);

        BuyerQualification::create([
            'opportunity_id' => $opp2->id,
            'client_intent' => 'end_user',
            'purchase_timeline' => 'Immediate (within 30 days)',
            'is_first_time_buyer' => false,
            'cash_or_finance' => 'cash',
            'community' => 'Downtown / Business Bay',
            'project' => 'Peninsula Three / Creek Horizon',
            'developer' => 'Select Group / Emaar',
            'property_type' => 'Apartment',
            'bedrooms' => '2 BR',
            'lead_score' => 84,
            'qualification_notes' => 'High intent buyer, cash in hand, wants sea or canal view.',
        ]);

        Activity::create([
            'contact_id' => $ahmed->id,
            'opportunity_id' => $opp2->id,
            'user_name' => 'Mako',
            'type' => 'call',
            'call_outcome' => 'interested',
            'description' => 'Call · 4m 22s — Client confirmed interest in Business Bay luxury apartments. Requested Saturday site tour.',
            'created_at' => $now->copy()->subMinutes(12),
        ]);

        // Opportunity 003 - Seller Future
        Opportunity::create([
            'contact_id' => $ahmed->id,
            'opportunity_type' => 'seller',
            'stage' => 'new',
            'temperature' => 'warm',
            'current_owner_name' => 'Mako',
            'originating_agent_name' => 'Mako',
            'department' => 'telesales',
            'budget_min' => 3200000,
            'budget_max' => 3500000,
            'next_action' => 'Follow up on property listing documents for Palm Jumeirah unit',
            'next_action_due_at' => $now->copy()->addDays(5),
            'sla_status' => 'on_track',
            'key_requirement' => 'Seller Opportunity #003 — Listing Palm Jumeirah Apartment Q4',
            'created_at' => $now->copy()->subDays(1),
        ]);

        // 2. Fatima Al Mansoori (Handover Pending to Sales)
        $fatima = Contact::create([
            'name' => 'Fatima Al Mansoori',
            'initials' => 'FM',
            'nationality' => 'Emirati',
            'phone' => '+971 52 987 6543',
            'email' => 'fatima.m@example.com',
            'source' => 'Meta Ads',
            'state' => 'active',
            'last_activity_at' => $now->copy()->subHours(1),
        ]);

        $oppFatima = Opportunity::create([
            'contact_id' => $fatima->id,
            'opportunity_type' => 'buyer',
            'stage' => 'handover_pending',
            'temperature' => 'hot',
            'current_owner_name' => 'Mako',
            'originating_agent_name' => 'Mako',
            'department' => 'telesales',
            'budget_min' => 4500000,
            'budget_max' => 6000000,
            'next_action' => 'Execute Telesales -> Sales Handover to Faraz',
            'next_action_due_at' => $now->copy()->addMinutes(15), // Due Soon
            'sla_status' => 'due_soon',
            'key_requirement' => '4BR Villa in Dubai Hills Estate / District One',
            'created_at' => $now->copy()->subDays(2),
        ]);

        BuyerQualification::create([
            'opportunity_id' => $oppFatima->id,
            'client_intent' => 'end_user',
            'purchase_timeline' => '1-3 months',
            'is_first_time_buyer' => true,
            'cash_or_finance' => 'finance',
            'payment_plan_pref' => '50/50 Handover Plan',
            'community' => 'Dubai Hills Estate',
            'project' => 'Golf Place / Sidra',
            'developer' => 'Emaar',
            'property_type' => 'Villa',
            'bedrooms' => '4 BR',
            'lead_score' => 92,
            'qualification_notes' => 'Pre-approved mortgage of 5M AED. Fully qualified for sales handover.',
        ]);

        Activity::create([
            'contact_id' => $fatima->id,
            'opportunity_id' => $oppFatima->id,
            'user_name' => 'Mako',
            'type' => 'note',
            'description' => 'Completed all qualification fields. Verified budget and mortgage pre-approval letter.',
        ]);

        // 3. Tariq Hassan (Sales In Progress - Owned by Faraz)
        $tariq = Contact::create([
            'name' => 'Tariq Hassan',
            'initials' => 'TH',
            'nationality' => 'British',
            'phone' => '+971 55 444 3322',
            'email' => 'tariq.hassan@example.com',
            'source' => 'Property Finder',
            'state' => 'active',
            'last_activity_at' => $now->copy()->subHours(4),
        ]);

        $oppTariq = Opportunity::create([
            'contact_id' => $tariq->id,
            'opportunity_type' => 'buyer',
            'stage' => 'sales_in_progress',
            'temperature' => 'warm',
            'current_owner_name' => 'Faraz',
            'originating_agent_name' => 'Mako',
            'department' => 'sales',
            'budget_min' => 2500000,
            'budget_max' => 3000000,
            'next_action' => 'Present Booking Agreement & collect deposit cheque',
            'next_action_due_at' => $now->copy()->addHours(3),
            'sla_status' => 'on_track',
            'key_requirement' => 'Townhouse in Arabian Ranches 3',
            'created_at' => $now->copy()->subDays(5),
        ]);

        BuyerQualification::create([
            'opportunity_id' => $oppTariq->id,
            'client_intent' => 'investor',
            'purchase_timeline' => '1-3 months',
            'is_first_time_buyer' => false,
            'cash_or_finance' => 'cash',
            'community' => 'Arabian Ranches 3',
            'property_type' => 'Townhouse',
            'bedrooms' => '3 BR',
            'lead_score' => 78,
            'qualification_notes' => 'Investor looking for 7%+ ROI guaranteed rental yield.',
        ]);

        OwnershipHistory::create([
            'opportunity_id' => $oppTariq->id,
            'previous_owner' => 'Mako',
            'new_owner' => 'Faraz',
            'department_from' => 'telesales',
            'department_to' => 'sales',
            'reason' => 'Qualified buyer handover for contract closing',
            'created_at' => $now->copy()->subDays(2),
        ]);

        // 4. Sarah Jenkins (Available Lead Bank contact)
        Contact::create([
            'name' => 'Sarah Jenkins',
            'initials' => 'SJ',
            'nationality' => 'Australian',
            'phone' => '+971 58 111 2233',
            'email' => 'sarah.j@example.com',
            'source' => 'Bayut',
            'state' => 'available',
            'last_activity_at' => $now->copy()->subDays(10),
        ]);

        // 5. Omar Al Hashimi (Reactivation Contact)
        Contact::create([
            'name' => 'Omar Al Hashimi',
            'initials' => 'OH',
            'nationality' => 'Emirati',
            'phone' => '+971 50 888 9900',
            'email' => 'omar.hashimi@example.com',
            'source' => 'Referral',
            'state' => 'reactivation',
            'last_activity_at' => $now->copy()->subMonths(2),
        ]);

        echo "Database seeded with FS Advisory CRM sample dataset successfully.\n";
    }
}
