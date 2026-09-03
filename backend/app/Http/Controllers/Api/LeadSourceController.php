<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadSource;
use App\Models\LeadSubSource;
use Illuminate\Http\Request;

class LeadSourceController extends Controller
{
    public function index()
    {
        $sources = LeadSource::with(['subSources' => function($q) {
            $q->orderBy('sort_order')->orderBy('name');
        }])->orderBy('sort_order')->orderBy('name')->get();

        // Seed default sources and sub-sources if database is empty
        if ($sources->isEmpty()) {
            $this->seedDefaults();
            $sources = LeadSource::with(['subSources' => function($q) {
                $q->orderBy('sort_order')->orderBy('name');
            }])->orderBy('sort_order')->orderBy('name')->get();
        }

        return response()->json($sources);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $source = LeadSource::create([
            'name' => $validated['name'],
            'icon' => $validated['icon'] ?? '🌐',
            'is_active' => $validated['is_active'] ?? true,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json($source->load('subSources'), 201);
    }

    public function update(Request $request, $id)
    {
        $source = LeadSource::findOrFail($id);
        $oldName = $source->name;

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $source->update($validated);

        if (!empty($validated['name']) && strcasecmp($oldName, $validated['name']) !== 0) {
            $newName = $validated['name'];
            \App\Models\Contact::where('source', 'like', "%{$oldName}%")->get()->each(function($c) use ($oldName, $newName) {
                $c->update(['source' => str_ireplace($oldName, $newName, $c->source)]);
            });
        }

        return response()->json($source->load('subSources'));
    }

    public function destroy($id)
    {
        $source = LeadSource::findOrFail($id);
        $source->delete();

        return response()->json(['success' => true, 'message' => 'Lead source deleted successfully.']);
    }

    public function storeSubSource(Request $request, $sourceId)
    {
        $source = LeadSource::findOrFail($sourceId);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $subSource = LeadSubSource::create([
            'lead_source_id' => $source->id,
            'name' => $validated['name'],
            'is_active' => $validated['is_active'] ?? true,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json($subSource, 201);
    }

    public function updateSubSource(Request $request, $id)
    {
        $subSource = LeadSubSource::findOrFail($id);
        $oldName = $subSource->name;

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $subSource->update($validated);

        if (!empty($validated['name']) && strcasecmp($oldName, $validated['name']) !== 0) {
            $newName = $validated['name'];
            \App\Models\Contact::where('source', 'like', "%{$oldName}%")->get()->each(function($c) use ($oldName, $newName) {
                $c->update(['source' => str_ireplace($oldName, $newName, $c->source)]);
            });
        }

        return response()->json($subSource);
    }

    public function destroySubSource($id)
    {
        $subSource = LeadSubSource::findOrFail($id);
        $subSource->delete();

        return response()->json(['success' => true, 'message' => 'Lead sub-source deleted successfully.']);
    }

    private function seedDefaults()
    {
        $defaults = [
            [
                'name' => 'Website',
                'icon' => '🌐',
                'sub_sources' => [
                    '🌐 Official Website Form',
                    '📩 Contact Us Page',
                    '🤖 Live Chatbot Inquiry',
                    '🔍 Organic Google Search (SEO)',
                    '🔗 Direct URL Visit',
                ],
            ],
            [
                'name' => 'Meta Ads',
                'icon' => '📱',
                'sub_sources' => [
                    '📱 Facebook Lead Form',
                    '📸 Instagram Direct Ad',
                    '🎬 Meta Stories / Reels Ad',
                    '🎯 Retargeting Campaign',
                    '👥 Custom Audience Campaign',
                ],
            ],
            [
                'name' => 'Google Ads',
                'icon' => '🔍',
                'sub_sources' => [
                    '🔍 Google Search PPC',
                    '🖼️ Display Network Banner',
                    '⚡ Performance Max (PMax)',
                    '▶️ YouTube Video Ad',
                ],
            ],
            [
                'name' => 'Property Finder',
                'icon' => '🏢',
                'sub_sources' => [
                    '🌟 Premium Featured Listing',
                    '✅ Verified Unit Badge',
                    '💬 Portal WhatsApp Inquiry',
                    '📞 Agent Profile Direct Call',
                ],
            ],
            [
                'name' => 'Bayut',
                'icon' => '🏙️',
                'sub_sources' => [
                    '✅ TruCheck Verified Listing',
                    '🏙️ Bayut Pro Banner Ad',
                    '🔥 Hot Listing Portal Inquiry',
                ],
            ],
            [
                'name' => 'Dubizzle',
                'icon' => '📣',
                'sub_sources' => [
                    '📣 Dubizzle Premium Ad',
                    '🔑 Verified Seller Inquiry',
                    '📋 Classified Listing Call',
                ],
            ],
            [
                'name' => 'Referral',
                'icon' => '👥',
                'sub_sources' => [
                    '👥 Existing Client Referral',
                    '🤝 Partner Broker / Agency',
                    '🏠 Staff / Family Referral',
                    '💼 VIP Network Intro',
                ],
            ],
            [
                'name' => 'Walk-in',
                'icon' => '🚶',
                'sub_sources' => [
                    '🏢 Head Office Reception',
                    '🏛️ Sales Presentation Center',
                    '🎪 Property Exhibition / Event',
                ],
            ],
            [
                'name' => 'Database',
                'icon' => '🗄️',
                'sub_sources' => [
                    '📞 Cold Telesales Campaign',
                    '📲 SMS Broadcast Campaign',
                    '📧 Email Newsletter Blast',
                    '🔄 Past Client Re-engagement',
                ],
            ],
        ];

        foreach ($defaults as $order => $item) {
            $source = LeadSource::create([
                'name' => $item['name'],
                'icon' => $item['icon'],
                'sort_order' => $order,
                'is_active' => true,
            ]);

            foreach ($item['sub_sources'] as $subOrder => $subName) {
                LeadSubSource::create([
                    'lead_source_id' => $source->id,
                    'name' => $subName,
                    'sort_order' => $subOrder,
                    'is_active' => true,
                ]);
            }
        }
    }
}
