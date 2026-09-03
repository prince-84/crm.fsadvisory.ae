<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Developer;
use App\Models\Project;
use App\Models\PropertyType;
use App\Models\Community;
use App\Models\OpportunityType;
use Illuminate\Http\Request;

class MasterCatalogController extends Controller
{
    // ==================== OPPORTUNITY TYPES ====================
    public function getOpportunityTypes()
    {
        $items = OpportunityType::orderBy('sort_order')->orderBy('name')->get();
        if ($items->isEmpty()) {
            $this->seedOpportunityTypes();
            $items = OpportunityType::orderBy('sort_order')->orderBy('name')->get();
        }
        return response()->json($items);
    }

    public function storeOpportunityType(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
        ]);

        $slug = $validated['slug'] ?? \Illuminate\Support\Str::slug($validated['name']);

        $item = OpportunityType::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'icon' => $validated['icon'] ?? '💼',
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($item, 201);
    }

    public function updateOpportunityType(Request $request, $id)
    {
        $item = OpportunityType::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
        ]);
        if (isset($validated['name']) && !isset($validated['slug'])) {
            $validated['slug'] = \Illuminate\Support\Str::slug($validated['name']);
        }
        $item->update($validated);
        return response()->json($item);
    }

    public function destroyOpportunityType($id)
    {
        $item = OpportunityType::findOrFail($id);
        $item->delete();
        return response()->json(['success' => true]);
    }

    // ==================== SEEDERS ====================
    private function seedOpportunityTypes()
    {
        $types = [
            ['name' => 'Buyer Opportunity', 'slug' => 'buyer', 'icon' => '💼'],
            ['name' => 'Seller Opportunity', 'slug' => 'seller', 'icon' => '🏡'],
            ['name' => 'Landlord Opportunity', 'slug' => 'landlord', 'icon' => '🔑'],
            ['name' => 'Tenant Opportunity', 'slug' => 'tenant', 'icon' => '🛋️'],
            ['name' => 'Investor / Off-Plan Opportunity', 'slug' => 'investor', 'icon' => '📈'],
        ];

        foreach ($types as $i => $t) {
            OpportunityType::create([
                'name' => $t['name'],
                'slug' => $t['slug'],
                'icon' => $t['icon'],
                'sort_order' => $i,
            ]);
        }
    }
    // ==================== DEVELOPERS ====================
    public function getDevelopers()
    {
        $items = Developer::orderBy('sort_order')->orderBy('name')->get();
        if ($items->isEmpty()) {
            $this->seedDevelopers();
            $items = Developer::orderBy('sort_order')->orderBy('name')->get();
        }
        return response()->json($items);
    }

    public function storeDeveloper(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'logo_icon' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
        ]);

        $item = Developer::create([
            'name' => $validated['name'],
            'logo_icon' => $validated['logo_icon'] ?? '🏗️',
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($item, 201);
    }

    public function updateDeveloper(Request $request, $id)
    {
        $item = Developer::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'logo_icon' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
        ]);
        $item->update($validated);
        return response()->json($item);
    }

    public function destroyDeveloper($id)
    {
        $item = Developer::findOrFail($id);
        $item->delete();
        return response()->json(['success' => true]);
    }

    // ==================== PROJECTS ====================
    public function getProjects()
    {
        $items = Project::orderBy('sort_order')->orderBy('name')->get();
        if ($items->isEmpty()) {
            $this->seedProjects();
            $items = Project::orderBy('sort_order')->orderBy('name')->get();
        }
        return response()->json($items);
    }

    public function storeProject(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'developer_name' => 'nullable|string|max:255',
            'community_name' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $item = Project::create([
            'name' => $validated['name'],
            'developer_name' => $validated['developer_name'] ?? 'Emaar Properties',
            'community_name' => $validated['community_name'] ?? 'Downtown Dubai',
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($item, 201);
    }

    public function updateProject(Request $request, $id)
    {
        $item = Project::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'developer_name' => 'nullable|string|max:255',
            'community_name' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ]);
        $item->update($validated);
        return response()->json($item);
    }

    public function destroyProject($id)
    {
        $item = Project::findOrFail($id);
        $item->delete();
        return response()->json(['success' => true]);
    }

    // ==================== PROPERTY TYPES / UNITS ====================
    public function getPropertyTypes()
    {
        $items = PropertyType::orderBy('sort_order')->orderBy('name')->get();
        if ($items->isEmpty()) {
            $this->seedPropertyTypes();
            $items = PropertyType::orderBy('sort_order')->orderBy('name')->get();
        }
        return response()->json($items);
    }

    public function storePropertyType(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $item = PropertyType::create([
            'name' => $validated['name'],
            'category' => $validated['category'] ?? 'Residential',
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($item, 201);
    }

    public function updatePropertyType(Request $request, $id)
    {
        $item = PropertyType::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'category' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ]);
        $item->update($validated);
        return response()->json($item);
    }

    public function destroyPropertyType($id)
    {
        $item = PropertyType::findOrFail($id);
        $item->delete();
        return response()->json(['success' => true]);
    }

    // ==================== COMMUNITIES ====================
    public function getCommunities()
    {
        $items = Community::orderBy('sort_order')->orderBy('name')->get();
        if ($items->isEmpty()) {
            $this->seedCommunities();
            $items = Community::orderBy('sort_order')->orderBy('name')->get();
        }
        return response()->json($items);
    }

    public function storeCommunity(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'city' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $item = Community::create([
            'name' => $validated['name'],
            'city' => $validated['city'] ?? 'Dubai',
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($item, 201);
    }

    public function updateCommunity(Request $request, $id)
    {
        $item = Community::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'city' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ]);
        $item->update($validated);
        return response()->json($item);
    }

    public function destroyCommunity($id)
    {
        $item = Community::findOrFail($id);
        $item->delete();
        return response()->json(['success' => true]);
    }

    // ==================== SEEDERS ====================
    private function seedDevelopers()
    {
        $devs = [
            'Emaar Properties', 'Nakheel', 'DAMAC Properties', 'Sobha Realty',
            'Meraas', 'Dubai Holding', 'Select Group', 'Danube Properties',
            'Binghatti', 'Aldar Properties', 'Azizi Developments', 'Deyaar',
            'Ellington Properties', 'Omniyat', 'Samana Developers'
        ];

        foreach ($devs as $i => $name) {
            Developer::create(['name' => $name, 'logo_icon' => '🏗️', 'sort_order' => $i]);
        }
    }

    private function seedProjects()
    {
        $projs = [
            ['name' => 'Burj Crown Residences', 'developer_name' => 'Emaar Properties', 'community_name' => 'Downtown Dubai'],
            ['name' => 'Sobha Hartland Waves', 'developer_name' => 'Sobha Realty', 'community_name' => 'MBR City (Sobha Hartland)'],
            ['name' => 'Dubai Creek Residences', 'developer_name' => 'Emaar Properties', 'community_name' => 'Dubai Creek Harbour'],
            ['name' => 'Marina Gate Towers', 'developer_name' => 'Select Group', 'community_name' => 'Dubai Marina'],
            ['name' => 'Palm Beach Towers', 'developer_name' => 'Nakheel', 'community_name' => 'Palm Jumeirah'],
            ['name' => 'DAMAC Hills Villa Cluster', 'developer_name' => 'DAMAC Properties', 'community_name' => 'DAMAC Hills'],
            ['name' => 'Select Avenue Residences', 'developer_name' => 'Select Group', 'community_name' => 'Business Bay'],
        ];

        foreach ($projs as $i => $item) {
            Project::create([
                'name' => $item['name'],
                'developer_name' => $item['developer_name'],
                'community_name' => $item['community_name'],
                'sort_order' => $i,
            ]);
        }
    }

    private function seedPropertyTypes()
    {
        $types = [
            '1BR Luxury Executive Suite', '2BR Boulevard View Apartment', '3BR Premium Sky Collection',
            '4BR Grand Penthouse Residence', '1BR Waterfront Apartment', '2BR Lagoon View Residence',
            '3BR Duplex Sky Suite', '1BR Harbour Gate View', '2BR Creek Beachfront Apartment',
            '3BR Island District Luxury Suite', '1BR Marina Skyline Suite', '2BR Full Marina View Unit',
            '3BR Penthouse Duplex', '1BR Royal Palm Apartment', '2BR Sea & Sunset View Residence',
            '3BR Waterfront Villa Suite', '4BR Sky Mansion Villa', '3BR Golf Crest Townhouse',
            '4BR Trump Estate Mansion', '5BR Luxury Parkland Villa', 'Studio Apartment',
            'Villa / Mansion', 'Townhouse', 'Penthouse', 'Duplex', 'Land Plot', 'Commercial Office'
        ];

        foreach ($types as $i => $name) {
            PropertyType::create(['name' => $name, 'category' => 'Residential', 'sort_order' => $i]);
        }
    }

    private function seedCommunities()
    {
        $comms = [
            'Downtown Dubai', 'Palm Jumeirah', 'Business Bay', 'Dubai Marina',
            'Dubai Hills Estate', 'Jumeirah Golf Estates', 'Arabian Ranches',
            'Dubai Creek Harbour', 'MBR City (Sobha Hartland)', 'Emaar Beachfront',
            'Jumeirah Lake Towers (JLT)', 'Jumeirah Village Circle (JVC)', 'Bluewaters Island'
        ];

        foreach ($comms as $i => $name) {
            Community::create(['name' => $name, 'city' => 'Dubai', 'sort_order' => $i]);
        }
    }
}
