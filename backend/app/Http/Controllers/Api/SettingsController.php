<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function getSettings()
    {
        return response()->json([
            'system_name' => 'FS Advisory Enterprise CRM',
            'company' => 'FS Advisory Real Estate LLC',
            'branch' => 'Dubai Headquarters — Downtown Office',
            'currency' => 'AED',
            'sla_warning_mins' => 30,
            'sla_grace_period_mins' => 15,
            'auto_reassign_hot_leads' => true,
            'auto_merge_duplicates' => false,
            'departments' => ['Telesales', 'Sales Advisors', 'Property Management', 'Administration'],
            'webhooks' => [
                'property_finder' => 'http://127.0.0.1:8000/api/portals/ingest?portal=property_finder',
                'bayut' => 'http://127.0.0.1:8000/api/portals/ingest?portal=bayut',
                'dubizzle' => 'http://127.0.0.1:8000/api/portals/ingest?portal=dubizzle',
            ]
        ]);
    }

    public function saveSettings(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'CRM System settings saved successfully.',
        ]);
    }
}
