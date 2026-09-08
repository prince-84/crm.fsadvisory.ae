<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OwnerRecord;
use App\Models\Community;
use App\Models\Project;
use App\Models\PropertyType;
use App\Models\User;
use App\Services\LeadDistributionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OwnerDataController extends Controller
{
    /**
     * Find closest matching string from a catalog list using fuzzy / normalized scoring.
     */
    private function findBestMatch(string $value, array $catalogList): array
    {
        $val = trim(mb_strtolower($value, 'UTF-8'));
        if (empty($val) || empty($catalogList)) {
            return ['match' => null, 'confidence' => 0];
        }

        $bestMatch = null;
        $highestScore = 0;

        // Common real estate aliases / abbreviations to standard catalog representations
        $aliases = [
            'jvc' => 'jumeirah village circle',
            'jlt' => 'jumeirah lake towers',
            'jvt' => 'jumeirah village triangle',
            'downtown' => 'downtown dubai',
            'mbr' => 'mbr city',
            'mbrc' => 'mbr city',
            'bb' => 'business bay',
            'emaar' => 'emaar properties',
            'damac' => 'damac properties',
            'sobha' => 'sobha realty',
            'danube' => 'danube properties',
            'nakheel' => 'nakheel',
            'aldar' => 'aldar properties',
            'azizi' => 'azizi developments',
            'ellington' => 'ellington properties',
            'deyaar' => 'deyaar',
            'apt' => 'apartment',
            'appt' => 'apartment',
            'flat' => 'apartment',
            'th' => 'townhouse',
            'ph' => 'penthouse',
            'villa' => 'villa',
        ];

        // Noise words for developers/projects/communities/property types
        $noiseWords = ['properties', 'developments', 'development', 'developer', 'realty', 'real estate', 'group', 'holding', 'holdings', 'llc', 'tower', 'towers', 'residence', 'residences', 'dubai', 'the', 'project', 'estate', 'city'];
        $cleanVal = preg_replace('/\b(' . implode('|', $noiseWords) . ')\b/iu', '', $val);
        $cleanVal = trim(preg_replace('/\s+/u', ' ', $cleanVal));

        foreach ($catalogList as $catItem) {
            $cat = trim((string)$catItem);
            $catLower = mb_strtolower($cat, 'UTF-8');

            // 1. Exact match (case-insensitive)
            if ($catLower === $val) {
                return ['match' => $cat, 'confidence' => 100];
            }

            // 2. Alias resolution (e.g. 'Downtown' -> 'Downtown Dubai', 'JVC' -> 'Jumeirah Village Circle (JVC)')
            if (isset($aliases[$val])) {
                $targetAlias = $aliases[$val];
                if ($catLower === $targetAlias || str_contains($catLower, $targetAlias) || str_contains($targetAlias, $catLower)) {
                    return ['match' => $cat, 'confidence' => 98];
                }
            }

            // 3. Cleaned comparison (noise-words stripped)
            $cleanCat = preg_replace('/\b(' . implode('|', $noiseWords) . ')\b/iu', '', $catLower);
            $cleanCat = trim(preg_replace('/\s+/u', ' ', $cleanCat));

            if (!empty($cleanVal) && !empty($cleanCat) && $cleanVal === $cleanCat) {
                if ($highestScore < 95) {
                    $highestScore = 95;
                    $bestMatch = $cat;
                }
            }

            // 4. Word-boundary whole word match
            if (!empty($cleanVal) && mb_strlen($cleanVal) >= 3 && preg_match('/\b' . preg_quote($cleanVal, '/') . '\b/iu', $cleanCat)) {
                if ($highestScore < 90) {
                    $highestScore = 90;
                    $bestMatch = $cat;
                }
            }

            // 5. Substring match (with min length 4 to avoid false matches on short fragments)
            if (mb_strlen($val) >= 4 && mb_strlen($catLower) >= 4) {
                if (str_contains($catLower, $val) || str_contains($val, $catLower)) {
                    $subScore = 85;
                    if ($subScore > $highestScore) {
                        $highestScore = $subScore;
                        $bestMatch = $cat;
                    }
                }
            }

            // 6. similar_text percentage
            similar_text($val, $catLower, $percent);
            if ($percent > $highestScore) {
                $highestScore = (int)$percent;
                $bestMatch = $cat;
            }

            if (!empty($cleanVal) && !empty($cleanCat)) {
                similar_text($cleanVal, $cleanCat, $cleanPercent);
                if ($cleanPercent > $highestScore) {
                    $highestScore = (int)$cleanPercent;
                    $bestMatch = $cat;
                }
            }
        }

        if ($highestScore >= 60) {
            return ['match' => $bestMatch, 'confidence' => $highestScore];
        }

        return ['match' => null, 'confidence' => $highestScore];
    }
    /**
     * Display a listing of owner records with filtering, search, and KPI stats
     */
    public function index(Request $request)
    {
        $tab = $request->get('tab', 'all');

        if ($tab === 'deleted') {
            $query = OwnerRecord::onlyTrashed();
        } else {
            $query = OwnerRecord::query();
        }

        // Search query
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        // Area Filter (Supports Multi or Single)
        if ($request->has('area') && !empty($request->area) && $request->area !== 'all') {
            $areas = is_array($request->area) ? $request->area : explode(',', $request->area);
            $areas = array_filter(array_map('trim', $areas));
            if (!empty($areas)) {
                $query->whereIn('area', $areas);
            }
        }

        // Property Type Filter (Supports Multi or Single)
        if ($request->has('property_type') && !empty($request->property_type) && $request->property_type !== 'all') {
            $types = is_array($request->property_type) ? $request->property_type : explode(',', $request->property_type);
            $types = array_filter(array_map('trim', $types));
            if (!empty($types)) {
                $query->whereIn('property_type', $types);
            }
        }

        // Bedrooms Filter (Supports Multi or Single)
        if ($request->has('bedrooms') && !empty($request->bedrooms) && $request->bedrooms !== 'all') {
            $beds = is_array($request->bedrooms) ? $request->bedrooms : explode(',', $request->bedrooms);
            $beds = array_filter(array_map('trim', $beds));
            if (!empty($beds)) {
                $query->whereIn('bedrooms', $beds);
            }
        }

        // Date Range Filter on created_at
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Tab: unassigned
        if ($tab === 'unassigned') {
            $query->where(function ($q) {
                $q->whereNull('assigned_to')->orWhere('assigned_to', '');
            });
        }

        // KPI Summary Statistics
        $totalAll = OwnerRecord::count();
        $totalAssigned = OwnerRecord::whereNotNull('assigned_to')->where('assigned_to', '!=', '')->count();
        $totalUnassigned = OwnerRecord::where(function ($q) {
            $q->whereNull('assigned_to')->orWhere('assigned_to', '');
        })->count();
        $totalAreas = OwnerRecord::distinct('area')->whereNotNull('area')->where('area', '!=', '')->count('area');
        $totalDeleted = OwnerRecord::onlyTrashed()->count();

        // Distinct filter options
        $distinctAreas = OwnerRecord::select('area')
            ->whereNotNull('area')
            ->where('area', '!=', '')
            ->distinct()
            ->orderBy('area')
            ->pluck('area');

        $defaultTypes = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Commercial', 'Plot'];
        $defaultBedrooms = ['Studio', '1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4 Bedrooms', '5+ Bedrooms'];

        $distinctPropertyTypes = OwnerRecord::select('property_type')
            ->whereNotNull('property_type')
            ->where('property_type', '!=', '')
            ->distinct()
            ->orderBy('property_type')
            ->pluck('property_type')
            ->merge($defaultTypes)
            ->unique()
            ->values();

        $distinctBedrooms = OwnerRecord::select('bedrooms')
            ->whereNotNull('bedrooms')
            ->where('bedrooms', '!=', '')
            ->whereNotIn('bedrooms', ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Plot'])
            ->distinct()
            ->orderBy('bedrooms')
            ->pluck('bedrooms')
            ->merge($defaultBedrooms)
            ->unique()
            ->values();

        // Sorting
        $allowedSorts = [
            'id', 'property_name', 'area', 'property_number', 'building_name',
            'bedrooms', 'property_type', 'owner_name', 'phone_number', 'mobile_number',
            'email', 'created_at', 'updated_at'
        ];
        $sortBy = in_array($request->get('sort_by'), $allowedSorts) ? $request->get('sort_by') : 'created_at';
        $sortOrder = strtolower($request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sortBy, $sortOrder);

        $perPage = (int) $request->get('per_page', 25);
        $records = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $records->items(),
            'current_page' => $records->currentPage(),
            'last_page' => $records->lastPage(),
            'per_page' => $records->perPage(),
            'total' => $records->total(),
            'stats' => [
                'total' => $totalAll,
                'assigned' => $totalAssigned,
                'unassigned' => $totalUnassigned,
                'areas_count' => $totalAreas,
                'deleted' => $totalDeleted,
            ],
            'filters' => [
                'areas' => $distinctAreas,
                'property_types' => $distinctPropertyTypes,
                'bedrooms' => $distinctBedrooms,
            ],
        ]);
    }

    /**
     * Store a newly created owner record in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'owner_name'      => 'required|string|max:255',
            'property_name'   => 'nullable|string|max:255',
            'area'            => 'nullable|string|max:255',
            'property_number' => 'nullable|string|max:255',
            'building_name'   => 'nullable|string|max:255',
            'bedrooms'        => 'nullable|string|max:100',
            'property_type'   => 'nullable|string|max:100',
            'phone_number'    => 'nullable|string|max:50',
            'mobile_number'   => 'nullable|string|max:50',
            'email'           => 'nullable|email|max:255',
            'notes'           => 'nullable|string',
            'status'          => 'nullable|string|max:50',
            'assigned_to'     => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $rawAssignedTo = !empty($data['assigned_to']) ? trim((string)$data['assigned_to']) : '';
        $unassignedPlaceholders = ['unassigned', 'auto', 'none', '-', '--', 'n/a', 'na', 'not assigned', 'not_assigned', 'null', ''];
        $isPlaceholder = in_array(mb_strtolower($rawAssignedTo, 'UTF-8'), $unassignedPlaceholders, true);
        $isExplicitUnassigned = ($rawAssignedTo === 'Unassigned');

        $matchedActiveUser = null;
        if (!$isPlaceholder && !empty($rawAssignedTo)) {
            $matchedActiveUser = User::where('is_active', true)->get()->first(function ($u) use ($rawAssignedTo) {
                return strcasecmp($u->name, $rawAssignedTo) === 0 || strcasecmp($u->email, $rawAssignedTo) === 0;
            });
        }

        $data['assigned_to'] = $matchedActiveUser ? $matchedActiveUser->name : null;

        $record = OwnerRecord::create($data);

        // Auto-distribute if empty/rotation selected, unless explicitly set to 'Unassigned'
        if (empty($record->assigned_to) && !$isExplicitUnassigned) {
            LeadDistributionService::autoAssignOwnerRecord($record);
            $record->refresh();
        }

        return response()->json([
            'success' => true,
            'message' => 'Owner property record created successfully!',
            'record'  => $record,
        ], 201);
    }

    /**
     * Display the specified owner record.
     */
    public function show($id)
    {
        $record = OwnerRecord::withTrashed()->find($id);

        if (!$record) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }

        return response()->json([
            'success' => true,
            'record'  => $record,
        ]);
    }

    /**
     * Update the specified owner record in storage.
     */
    public function update(Request $request, $id)
    {
        $record = OwnerRecord::find($id);

        if (!$record) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'owner_name'      => 'required|string|max:255',
            'property_name'   => 'nullable|string|max:255',
            'area'            => 'nullable|string|max:255',
            'property_number' => 'nullable|string|max:255',
            'building_name'   => 'nullable|string|max:255',
            'bedrooms'        => 'nullable|string|max:100',
            'property_type'   => 'nullable|string|max:100',
            'phone_number'    => 'nullable|string|max:50',
            'mobile_number'   => 'nullable|string|max:50',
            'email'           => 'nullable|email|max:255',
            'notes'           => 'nullable|string',
            'status'          => 'nullable|string|max:50',
            'assigned_to'     => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        if (array_key_exists('assigned_to', $data) && $data['assigned_to'] === '') {
            $data['assigned_to'] = null;
        }

        $record->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Owner property record updated successfully!',
            'record'  => $record,
        ]);
    }

    /**
     * Remove the specified owner record from storage (soft delete).
     */
    public function destroy($id)
    {
        $record = OwnerRecord::find($id);

        if (!$record) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }

        $record->delete();

        return response()->json([
            'success' => true,
            'message' => 'Owner record deleted successfully.',
        ]);
    }

    /**
     * Restore a soft-deleted owner record.
     */
    public function restore($id)
    {
        $record = OwnerRecord::onlyTrashed()->find($id);

        if (!$record) {
            return response()->json(['success' => false, 'message' => 'Record not found in recycle bin'], 404);
        }

        $record->restore();

        return response()->json([
            'success' => true,
            'message' => 'Owner record restored successfully.',
            'record'  => $record,
        ]);
    }

    /**
     * Bulk delete selected owner records.
     */
    public function bulkDelete(Request $request)
    {
        $ids = $request->input('ids', []);

        if (empty($ids) || !is_array($ids)) {
            return response()->json(['success' => false, 'message' => 'No IDs provided'], 400);
        }

        $deletedCount = OwnerRecord::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => "{$deletedCount} owner record(s) deleted successfully.",
            'count'   => $deletedCount,
        ]);
    }

    /**
     * Bulk assign selected owner records to an advisor.
     */
    public function bulkAssign(Request $request)
    {
        $ids = $request->input('ids', []);
        $assignedTo = $request->input('assigned_to');

        if (empty($ids) || !is_array($ids)) {
            return response()->json(['success' => false, 'message' => 'No IDs provided'], 400);
        }

        if ($assignedTo === 'Unassigned') {
            $assignedTo = null;
        }

        $count = OwnerRecord::whereIn('id', $ids)->update(['assigned_to' => $assignedTo]);

        return response()->json([
            'success' => true,
            'message' => "{$count} property record(s) assigned successfully.",
            'count'   => $count,
        ]);
    }

    /**
     * Preview and analyze CSV / Excel owner records against Master Catalogs before saving.
     */
    public function preview(Request $request)
    {
        $rows = $request->input('records', []);

        if (empty($rows) || !is_array($rows)) {
            return response()->json(['success' => false, 'message' => 'No import rows provided'], 400);
        }

        // Fetch Master Catalogs
        $catalogCommunities = Community::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();
        $catalogProjects = Project::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();
        $catalogPropertyTypes = PropertyType::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();

        $catValues = [
            'community' => [],
            'project' => [],
            'property_type' => [],
        ];

        $propertyTypeKeywords = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial', 'office', 'plot', 'mansion'];

        foreach ($rows as $row) {
            $area = trim((string)($row['area'] ?? ''));
            $building = trim((string)($row['building_name'] ?? ''));
            $propName = trim((string)($row['property_name'] ?? ''));
            $rawBedrooms = trim((string)($row['bedrooms'] ?? ''));
            $rawPropType = trim((string)($row['property_type'] ?? ''));

            if (!empty($rawBedrooms) && empty($rawPropType)) {
                foreach ($propertyTypeKeywords as $kw) {
                    if (stripos($rawBedrooms, $kw) !== false) {
                        $rawPropType = $rawBedrooms;
                        break;
                    }
                }
            }

            if (!empty($area)) {
                $catValues['community'][$area] = ($catValues['community'][$area] ?? 0) + 1;
            }
            if (!empty($building)) {
                $catValues['project'][$building] = ($catValues['project'][$building] ?? 0) + 1;
            } elseif (!empty($propName)) {
                $catValues['project'][$propName] = ($catValues['project'][$propName] ?? 0) + 1;
            }
            if (!empty($rawPropType)) {
                $catValues['property_type'][$rawPropType] = ($catValues['property_type'][$rawPropType] ?? 0) + 1;
            }
        }

        // Solution A: Compute Auto-Mapped (>=80% confidence) vs Truly Unmatched (<80% confidence)
        $unmatched = [
            'community' => [],
            'project' => [],
            'property_type' => [],
        ];
        $autoMapped = [
            'community' => [],
            'project' => [],
            'property_type' => [],
        ];
        $autoMappedLookup = [
            'community' => [],
            'project' => [],
            'property_type' => [],
        ];

        $catalogsMap = [
            'community' => $catalogCommunities,
            'project' => $catalogProjects,
            'property_type' => $catalogPropertyTypes,
        ];

        foreach ($catValues as $category => $values) {
            $catalogList = $catalogsMap[$category];
            $catalogLowerLookup = [];
            foreach ($catalogList as $item) {
                $catalogLowerLookup[mb_strtolower(trim($item), 'UTF-8')] = $item;
            }

            foreach ($values as $rawVal => $count) {
                $rawLower = mb_strtolower(trim($rawVal), 'UTF-8');
                // 1. Exact match exists in catalog -> case-standardized
                if (isset($catalogLowerLookup[$rawLower])) {
                    $stdVal = $catalogLowerLookup[$rawLower];
                    if ($stdVal !== $rawVal) {
                        $autoMappedLookup[$category][$rawVal] = $stdVal;
                    }
                    continue;
                }

                $best = $this->findBestMatch($rawVal, $catalogList);

                // Solution A: High confidence match (>= 80%) is AUTO-MAPPED in background
                if (!empty($best['match']) && $best['confidence'] >= 80) {
                    $autoMapped[$category][] = [
                        'file_value' => $rawVal,
                        'mapped_to' => $best['match'],
                        'confidence' => $best['confidence'],
                        'count' => $count,
                    ];
                    $autoMappedLookup[$category][$rawVal] = $best['match'];
                    continue;
                }

                // Truly ambiguous or unknown (< 80%) requires user review
                $unmatched[$category][] = [
                    'file_value' => $rawVal,
                    'count' => $count,
                    'suggested_match' => $best['match'],
                    'confidence' => $best['confidence'],
                ];
            }
        }

        $hasUnmatched = (
            count($unmatched['community']) > 0 ||
            count($unmatched['project']) > 0 ||
            count($unmatched['property_type']) > 0
        );

        $autoMappedCount = (
            count($autoMapped['community']) +
            count($autoMapped['project']) +
            count($autoMapped['property_type'])
        );

        return response()->json([
            'success' => true,
            'total_records' => count($rows),
            'has_unmatched' => $hasUnmatched,
            'unmatched' => $unmatched,
            'auto_mapped' => $autoMapped,
            'auto_mapped_lookup' => $autoMappedLookup,
            'auto_mapped_count' => $autoMappedCount,
            'catalogs' => [
                'community' => $catalogCommunities,
                'project' => $catalogProjects,
                'property_type' => $catalogPropertyTypes,
            ],
        ]);
    }

    /**
     * Bulk import owner records from CSV / array payload with value mappings.
     */
    public function import(Request $request)
    {
        $rows = $request->input('records', []);
        $valueMappings = $request->input('value_mappings', []);
        $newCatalogItems = $request->input('new_catalog_items', []);

        if (empty($rows) || !is_array($rows)) {
            return response()->json(['success' => false, 'message' => 'No import rows provided'], 400);
        }

        $imported = 0;
        DB::beginTransaction();
        try {
            // Register any newly approved catalog items into Master Settings
            if (!empty($newCatalogItems) && is_array($newCatalogItems)) {
                foreach ($newCatalogItems as $newItem) {
                    $cat = $newItem['category'] ?? '';
                    $name = trim((string)($newItem['name'] ?? ''));
                    if (empty($name)) continue;

                    if ($cat === 'community') {
                        Community::firstOrCreate(
                            ['name' => mb_substr($name, 0, 255, 'UTF-8')],
                            ['city' => 'Dubai', 'is_active' => true, 'sort_order' => 99]
                        );
                    } elseif ($cat === 'project') {
                        Project::firstOrCreate(
                            ['name' => mb_substr($name, 0, 255, 'UTF-8')],
                            ['is_active' => true, 'sort_order' => 99]
                        );
                    } elseif ($cat === 'property_type') {
                        PropertyType::firstOrCreate(
                            ['name' => mb_substr($name, 0, 255, 'UTF-8')],
                            ['is_active' => true, 'sort_order' => 99]
                        );
                    }
                }
            }

            $fallbackComms = Community::where('is_active', true)->pluck('name')->toArray();
            $fallbackProjs = Project::where('is_active', true)->pluck('name')->toArray();
            $fallbackProps = PropertyType::where('is_active', true)->pluck('name')->toArray();
            $activeUsers = User::where('is_active', true)->get();

            foreach ($rows as $row) {
                if (empty($row['owner_name'])) continue;

                $rawBedrooms = $row['bedrooms'] ?? null;
                $rawPropType = $row['property_type'] ?? null;

                // Smart detection: if bedrooms contains a property type word and property_type is empty, reassign
                $propertyTypeKeywords = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial', 'office', 'plot', 'mansion'];
                if (!empty($rawBedrooms) && empty($rawPropType)) {
                    foreach ($propertyTypeKeywords as $kw) {
                        if (stripos($rawBedrooms, $kw) !== false) {
                            $rawPropType = $rawBedrooms;
                            $rawBedrooms = null;
                            break;
                        }
                    }
                }

                // Apply Value Mappings / Substitutions with Auto-Standardization Fallback
                $area = $row['area'] ?? null;
                if (!empty($area)) {
                    if (isset($valueMappings['community'][$area])) {
                        $area = $valueMappings['community'][$area];
                    } else {
                        $match = $this->findBestMatch($area, $fallbackComms);
                        if (!empty($match['match']) && $match['confidence'] >= 80) {
                            $area = $match['match'];
                        }
                    }
                }

                $building = $row['building_name'] ?? null;
                if (!empty($building)) {
                    if (isset($valueMappings['project'][$building])) {
                        $building = $valueMappings['project'][$building];
                    } else {
                        $match = $this->findBestMatch($building, $fallbackProjs);
                        if (!empty($match['match']) && $match['confidence'] >= 80) {
                            $building = $match['match'];
                        }
                    }
                }

                $propName = $row['property_name'] ?? null;
                if (!empty($propName)) {
                    if (isset($valueMappings['project'][$propName])) {
                        $propName = $valueMappings['project'][$propName];
                    } else {
                        $match = $this->findBestMatch($propName, $fallbackProjs);
                        if (!empty($match['match']) && $match['confidence'] >= 80) {
                            $propName = $match['match'];
                        }
                    }
                }

                if (!empty($rawPropType)) {
                    if (isset($valueMappings['property_type'][$rawPropType])) {
                        $rawPropType = $valueMappings['property_type'][$rawPropType];
                    } else {
                        $match = $this->findBestMatch($rawPropType, $fallbackProps);
                        if (!empty($match['match']) && $match['confidence'] >= 80) {
                            $rawPropType = $match['match'];
                        }
                    }
                }

                $rawAssignedTo = !empty($row['assigned_to']) ? trim((string)$row['assigned_to']) : '';
                $unassignedPlaceholders = ['unassigned', 'auto', 'none', '-', '--', 'n/a', 'na', 'not assigned', 'not_assigned', 'null', ''];
                $isPlaceholder = in_array(mb_strtolower($rawAssignedTo, 'UTF-8'), $unassignedPlaceholders, true);

                $matchedActiveUser = null;
                if (!$isPlaceholder && !empty($rawAssignedTo)) {
                    $matchedActiveUser = $activeUsers->first(function ($u) use ($rawAssignedTo) {
                        return strcasecmp($u->name, $rawAssignedTo) === 0 || strcasecmp($u->email, $rawAssignedTo) === 0;
                    });
                }

                $assignedTo = $matchedActiveUser ? $matchedActiveUser->name : null;

                $createdRecord = OwnerRecord::create([
                    'property_name'   => $propName,
                    'area'            => $area,
                    'property_number' => $row['property_number'] ?? null,
                    'building_name'   => $building,
                    'bedrooms'        => $rawBedrooms,
                    'property_type'   => $rawPropType,
                    'owner_name'      => $row['owner_name'],
                    'phone_number'    => $row['phone_number'] ?? null,
                    'mobile_number'   => $row['mobile_number'] ?? null,
                    'email'           => $row['email'] ?? null,
                    'notes'           => $row['notes'] ?? null,
                    'status'          => $row['status'] ?? 'active',
                    'assigned_to'     => $assignedTo,
                ]);

                // Auto-assign to sales advisors via Round-Robin if not explicitly assigned to a valid active advisor
                if (empty($assignedTo)) {
                    LeadDistributionService::autoAssignOwnerRecord($createdRecord);
                }

                $imported++;
            }
            DB::commit();

            return response()->json([
                'success'  => true,
                'message'  => "Successfully imported {$imported} owner records!",
                'imported' => $imported,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Import failed: ' . $e->getMessage()], 500);
        }
    }
}
