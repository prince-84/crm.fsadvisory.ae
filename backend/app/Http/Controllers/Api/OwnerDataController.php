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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OwnerDataController extends Controller
{
    /**
     * Clear cached stats and filter options when data changes.
     */
    public static function clearOwnerCache()
    {
        Cache::forget('owner_data_kpi_stats');
        Cache::forget('owner_data_filter_options');
    }

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
     * Normalize international phone numbers by extracting the last 9 digits.
     */
    private function normalizePhone($phone)
    {
        if (empty($phone)) return '';
        $digits = preg_replace('/[^0-9]/', '', (string)$phone);
        if (strlen($digits) >= 9) {
            return substr($digits, -9);
        }
        return $digits;
    }

    /**
     * Recursively clean UTF-8 strings to prevent JSON encoding errors.
     */
    private function cleanUtf8($data)
    {
        if (is_string($data)) {
            return mb_convert_encoding($data, 'UTF-8', 'UTF-8');
        }
        if (is_array($data)) {
            foreach ($data as $key => $val) {
                $data[$key] = $this->cleanUtf8($val);
            }
        }
        return $data;
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

        // KPI Summary Statistics (Cached for fast page flipping)
        $kpiStats = Cache::remember('owner_data_kpi_stats', 60, function () {
            return [
                'totalAll' => OwnerRecord::count(),
                'totalAssigned' => OwnerRecord::whereNotNull('assigned_to')->where('assigned_to', '!=', '')->count(),
                'totalUnassigned' => OwnerRecord::where(function ($q) {
                    $q->whereNull('assigned_to')->orWhere('assigned_to', '');
                })->count(),
                'totalAreas' => OwnerRecord::distinct('area')->whereNotNull('area')->where('area', '!=', '')->count('area'),
                'totalDeleted' => OwnerRecord::onlyTrashed()->count(),
            ];
        });
        $totalAll = $kpiStats['totalAll'];
        $totalAssigned = $kpiStats['totalAssigned'];
        $totalUnassigned = $kpiStats['totalUnassigned'];
        $totalAreas = $kpiStats['totalAreas'];
        $totalDeleted = $kpiStats['totalDeleted'];

        // Distinct filter options (Cached for 5 minutes so paginated page queries are instantaneous)
        $filterOptions = Cache::remember('owner_data_filter_options', 300, function () {
            $defaultTypes = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Commercial', 'Plot'];
            $defaultBedrooms = ['Studio', '1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4 Bedrooms', '5+ Bedrooms'];

            $distinctAreas = OwnerRecord::select('area')
                ->whereNotNull('area')
                ->where('area', '!=', '')
                ->distinct()
                ->orderBy('area')
                ->pluck('area');

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

            return [
                'areas' => $distinctAreas,
                'property_types' => $distinctPropertyTypes,
                'bedrooms' => $distinctBedrooms,
            ];
        });

        $distinctAreas = $filterOptions['areas'];
        $distinctPropertyTypes = $filterOptions['property_types'];
        $distinctBedrooms = $filterOptions['bedrooms'];

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

        static::clearOwnerCache();

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
        static::clearOwnerCache();

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
        static::clearOwnerCache();

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
        static::clearOwnerCache();

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
        static::clearOwnerCache();

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
        static::clearOwnerCache();

        return response()->json([
            'success' => true,
            'message' => "{$count} property record(s) assigned successfully.",
            'count'   => $count,
        ]);
    }

    /**
     * Preview and analyze CSV / Excel owner records against database duplicates and Master Catalogs before saving.
     */
    public function preview(Request $request)
    {
        $rawRows = $request->input('records', []);
        $rows = $this->cleanUtf8($rawRows);

        if (empty($rows) || !is_array($rows)) {
            return response()->json(['success' => false, 'message' => 'No import rows provided'], 400);
        }

        // 1. Preload existing database Owner Records for cross-matching duplicates
        $existingOwnerRecords = OwnerRecord::withoutTrashed()
            ->select('id', 'owner_name', 'phone_number', 'mobile_number', 'email', 'property_number', 'building_name', 'property_name')
            ->get();

        $dbPhoneMap = [];
        $dbEmailMap = [];
        $dbUnitMap = [];

        foreach ($existingOwnerRecords as $r) {
            $normP = $this->normalizePhone($r->mobile_number);
            if (!empty($normP) && !isset($dbPhoneMap[$normP])) {
                $dbPhoneMap[$normP] = [
                    'id' => $r->id,
                    'name' => $r->owner_name,
                    'phone' => $r->mobile_number,
                    'email' => $r->email,
                ];
            }
            $normS = $this->normalizePhone($r->phone_number);
            if (!empty($normS) && !isset($dbPhoneMap[$normS])) {
                $dbPhoneMap[$normS] = [
                    'id' => $r->id,
                    'name' => $r->owner_name,
                    'phone' => $r->phone_number,
                    'email' => $r->email,
                ];
            }
            if (!empty($r->email)) {
                $normEmail = mb_strtolower(trim($r->email), 'UTF-8');
                if (!isset($dbEmailMap[$normEmail])) {
                    $dbEmailMap[$normEmail] = [
                        'id' => $r->id,
                        'name' => $r->owner_name,
                        'email' => $r->email,
                        'phone' => $r->mobile_number ?: $r->phone_number,
                    ];
                }
            }
            $unitNum = trim((string)$r->property_number);
            $bldgName = trim((string)($r->building_name ?: $r->property_name));
            if (!empty($unitNum) && !empty($bldgName)) {
                $unitKey = mb_strtolower($unitNum . '::' . $bldgName, 'UTF-8');
                if (!isset($dbUnitMap[$unitKey])) {
                    $dbUnitMap[$unitKey] = [
                        'id' => $r->id,
                        'name' => $r->owner_name,
                        'unit' => $unitNum,
                        'building' => $bldgName,
                    ];
                }
            }
        }

        // 2. In-file duplicate trackers & duplicate counters
        $filePhoneMap = [];
        $fileEmailMap = [];
        $fileUnitMap = [];

        $duplicateCount = 0;
        $dbDuplicateCount = 0;
        $fileDuplicateCount = 0;
        $newCount = 0;
        $duplicatesList = [];

        // 3. Fetch Master Catalogs
        $catalogCommunities = Community::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();
        $catalogProjects = Project::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();
        $catalogPropertyTypes = PropertyType::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();

        $catValues = [
            'community' => [],
            'project' => [],
            'property_type' => [],
        ];

        $propertyTypeKeywords = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial', 'office', 'plot', 'mansion'];

        foreach ($rows as $index => $row) {
            $ownerName = trim((string)($row['owner_name'] ?? ''));
            if (empty($ownerName)) $ownerName = 'Unknown Owner';

            $mobilePhone = trim((string)($row['mobile_number'] ?? ''));
            $secPhone = trim((string)($row['phone_number'] ?? ''));
            $email = trim((string)($row['email'] ?? ''));
            $propNum = trim((string)($row['property_number'] ?? ''));
            $bldg = trim((string)($row['building_name'] ?? ''));
            $propName = trim((string)($row['property_name'] ?? ''));
            $area = trim((string)($row['area'] ?? ''));
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
            if (!empty($bldg)) {
                $catValues['project'][$bldg] = ($catValues['project'][$bldg] ?? 0) + 1;
            } elseif (!empty($propName)) {
                $catValues['project'][$propName] = ($catValues['project'][$propName] ?? 0) + 1;
            }
            if (!empty($rawPropType)) {
                $catValues['property_type'][$rawPropType] = ($catValues['property_type'][$rawPropType] ?? 0) + 1;
            }

            // Duplicate Detection
            $normP = $this->normalizePhone($mobilePhone);
            $normS = $this->normalizePhone($secPhone);
            $normEmail = !empty($email) ? mb_strtolower($email, 'UTF-8') : null;
            $unitKey = (!empty($propNum) && (!empty($bldg) || !empty($propName))) 
                ? mb_strtolower($propNum . '::' . ($bldg ?: $propName), 'UTF-8') 
                : null;

            $isDuplicate = false;
            $duplicateSource = null;
            $matchedInfo = null;
            $matchedRecordId = null;

            // Check A: Database matches (Lead Pool / Owner Data)
            if (!empty($normP) && isset($dbPhoneMap[$normP])) {
                $isDuplicate = true;
                $duplicateSource = 'database';
                $dbHit = $dbPhoneMap[$normP];
                $matchedRecordId = $dbHit['id'];
                $matchedInfo = "Already in Owner Data: {$dbHit['name']} (#{$dbHit['id']}) [Phone: {$dbHit['phone']}]";
            } elseif (!empty($normS) && isset($dbPhoneMap[$normS])) {
                $isDuplicate = true;
                $duplicateSource = 'database';
                $dbHit = $dbPhoneMap[$normS];
                $matchedRecordId = $dbHit['id'];
                $matchedInfo = "Already in Owner Data: {$dbHit['name']} (#{$dbHit['id']}) [Sec Phone: {$dbHit['phone']}]";
            } elseif (!empty($normEmail) && isset($dbEmailMap[$normEmail])) {
                $isDuplicate = true;
                $duplicateSource = 'database';
                $dbHit = $dbEmailMap[$normEmail];
                $matchedRecordId = $dbHit['id'];
                $matchedInfo = "Already in Owner Data: {$dbHit['name']} (#{$dbHit['id']}) [Email: {$dbHit['email']}]";
            } elseif (!empty($unitKey) && isset($dbUnitMap[$unitKey])) {
                $isDuplicate = true;
                $duplicateSource = 'database';
                $dbHit = $dbUnitMap[$unitKey];
                $matchedRecordId = $dbHit['id'];
                $matchedInfo = "Already in Owner Data: {$dbHit['name']} (#{$dbHit['id']}) [Unit: {$dbHit['unit']} in {$dbHit['building']}]";
            }
            // Check B: Duplicates repeating within the uploaded file
            elseif (!empty($normP) && isset($filePhoneMap[$normP])) {
                $isDuplicate = true;
                $duplicateSource = 'file';
                $fHit = $filePhoneMap[$normP];
                $matchedInfo = "Duplicate in File: Row #{$fHit['row']} ({$fHit['name']})";
            } elseif (!empty($normS) && isset($filePhoneMap[$normS])) {
                $isDuplicate = true;
                $duplicateSource = 'file';
                $fHit = $filePhoneMap[$normS];
                $matchedInfo = "Duplicate in File: Row #{$fHit['row']} ({$fHit['name']})";
            } elseif (!empty($normEmail) && isset($fileEmailMap[$normEmail])) {
                $isDuplicate = true;
                $duplicateSource = 'file';
                $fHit = $fileEmailMap[$normEmail];
                $matchedInfo = "Duplicate in File: Row #{$fHit['row']} ({$fHit['name']})";
            } elseif (!empty($unitKey) && isset($fileUnitMap[$unitKey])) {
                $isDuplicate = true;
                $duplicateSource = 'file';
                $fHit = $fileUnitMap[$unitKey];
                $matchedInfo = "Duplicate in File: Row #{$fHit['row']} ({$fHit['name']}) [Same Unit]";
            }

            $dupData = [
                'row_index' => $index + 1,
                'owner_name' => $ownerName,
                'phone' => $mobilePhone ?: $secPhone,
                'email' => $email,
                'property_number' => $propNum,
                'building_name' => $bldg ?: $propName,
                'area' => $area,
                'is_duplicate' => $isDuplicate,
                'duplicate_source' => $duplicateSource,
                'matched_with' => $matchedInfo,
                'matched_record_id' => $matchedRecordId,
            ];

            if ($isDuplicate) {
                $duplicateCount++;
                if ($duplicateSource === 'database') {
                    $dbDuplicateCount++;
                } else {
                    $fileDuplicateCount++;
                }
                $duplicatesList[] = $dupData;
            } else {
                $newCount++;
                if (!empty($normP)) $filePhoneMap[$normP] = ['row' => $index + 1, 'name' => $ownerName];
                if (!empty($normS)) $filePhoneMap[$normS] = ['row' => $index + 1, 'name' => $ownerName];
                if (!empty($normEmail)) $fileEmailMap[$normEmail] = ['row' => $index + 1, 'name' => $ownerName];
                if (!empty($unitKey)) $fileUnitMap[$unitKey] = ['row' => $index + 1, 'name' => $ownerName];
            }
        }

        // 4. Compute Auto-Mapped (>=80% confidence) vs Truly Unmatched (<80% confidence) for Catalogs
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
                // Exact match exists in catalog -> case-standardized
                if (isset($catalogLowerLookup[$rawLower])) {
                    $stdVal = $catalogLowerLookup[$rawLower];
                    if ($stdVal !== $rawVal) {
                        $autoMappedLookup[$category][$rawVal] = $stdVal;
                    }
                    continue;
                }

                $best = $this->findBestMatch($rawVal, $catalogList);

                // High confidence match (>= 80%) is AUTO-MAPPED in background
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

        return response()->json($this->cleanUtf8([
            'success' => true,
            'total_records' => count($rows),
            'new_count' => $newCount,
            'duplicate_count' => $duplicateCount,
            'db_duplicate_count' => $dbDuplicateCount,
            'file_duplicate_count' => $fileDuplicateCount,
            'duplicates' => $duplicatesList,
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
        ]));
    }

    /**
     * Bulk import owner records from CSV / array payload with value mappings and duplicate resolution.
     */
    public function import(Request $request)
    {
        $rawRows = $request->input('records', []);
        $rows = $this->cleanUtf8($rawRows);
        $valueMappings = $request->input('value_mappings', []);
        $newCatalogItems = $request->input('new_catalog_items', []);
        $duplicateMode = $request->input('duplicate_mode', 'skip'); // 'skip' or 'update'

        if (empty($rows) || !is_array($rows)) {
            return response()->json(['success' => false, 'message' => 'No import rows provided'], 400);
        }

        $imported = 0;
        $skipped = 0;
        $updated = 0;

        // Preload database contacts for duplicate detection
        $existingOwnerRecords = OwnerRecord::withoutTrashed()
            ->select('id', 'owner_name', 'phone_number', 'mobile_number', 'email', 'property_number', 'building_name', 'property_name')
            ->get();

        $dbPhoneMap = [];
        $dbEmailMap = [];
        $dbUnitMap = [];

        foreach ($existingOwnerRecords as $r) {
            $normP = $this->normalizePhone($r->mobile_number);
            if (!empty($normP) && !isset($dbPhoneMap[$normP])) {
                $dbPhoneMap[$normP] = ['id' => $r->id, 'name' => $r->owner_name];
            }
            $normS = $this->normalizePhone($r->phone_number);
            if (!empty($normS) && !isset($dbPhoneMap[$normS])) {
                $dbPhoneMap[$normS] = ['id' => $r->id, 'name' => $r->owner_name];
            }
            if (!empty($r->email)) {
                $normEmail = mb_strtolower(trim($r->email), 'UTF-8');
                if (!isset($dbEmailMap[$normEmail])) {
                    $dbEmailMap[$normEmail] = ['id' => $r->id, 'name' => $r->owner_name];
                }
            }
            $unitNum = trim((string)$r->property_number);
            $bldgName = trim((string)($r->building_name ?: $r->property_name));
            if (!empty($unitNum) && !empty($bldgName)) {
                $unitKey = mb_strtolower($unitNum . '::' . $bldgName, 'UTF-8');
                if (!isset($dbUnitMap[$unitKey])) {
                    $dbUnitMap[$unitKey] = ['id' => $r->id, 'name' => $r->owner_name];
                }
            }
        }

        $filePhoneMap = [];
        $fileEmailMap = [];
        $fileUnitMap = [];

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

            foreach ($rows as $index => $row) {
                if (empty($row['owner_name'])) continue;

                $mobilePhone = trim((string)($row['mobile_number'] ?? ''));
                $secPhone = trim((string)($row['phone_number'] ?? ''));
                $email = trim((string)($row['email'] ?? ''));
                $propNum = trim((string)($row['property_number'] ?? ''));
                $building = trim((string)($row['building_name'] ?? ''));
                $propName = trim((string)($row['property_name'] ?? ''));
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

                // Check Duplicate Status
                $normP = $this->normalizePhone($mobilePhone);
                $normS = $this->normalizePhone($secPhone);
                $normEmail = !empty($email) ? mb_strtolower($email, 'UTF-8') : null;
                $unitKey = (!empty($propNum) && (!empty($building) || !empty($propName))) 
                    ? mb_strtolower($propNum . '::' . ($building ?: $propName), 'UTF-8') 
                    : null;

                $isDuplicate = false;
                $matchedDbId = null;

                // Database Duplicate Check
                if (!empty($normP) && isset($dbPhoneMap[$normP])) {
                    $isDuplicate = true;
                    $matchedDbId = $dbPhoneMap[$normP]['id'];
                } elseif (!empty($normS) && isset($dbPhoneMap[$normS])) {
                    $isDuplicate = true;
                    $matchedDbId = $dbPhoneMap[$normS]['id'];
                } elseif (!empty($normEmail) && isset($dbEmailMap[$normEmail])) {
                    $isDuplicate = true;
                    $matchedDbId = $dbEmailMap[$normEmail]['id'];
                } elseif (!empty($unitKey) && isset($dbUnitMap[$unitKey])) {
                    $isDuplicate = true;
                    $matchedDbId = $dbUnitMap[$unitKey]['id'];
                }
                // File Duplicate Check
                elseif (!empty($normP) && isset($filePhoneMap[$normP])) {
                    $isDuplicate = true;
                } elseif (!empty($normS) && isset($filePhoneMap[$normS])) {
                    $isDuplicate = true;
                } elseif (!empty($normEmail) && isset($fileEmailMap[$normEmail])) {
                    $isDuplicate = true;
                } elseif (!empty($unitKey) && isset($fileUnitMap[$unitKey])) {
                    $isDuplicate = true;
                }

                // Handle Duplicate Resolution
                if ($isDuplicate) {
                    if ($duplicateMode === 'skip') {
                        $skipped++;
                        continue;
                    } elseif ($duplicateMode === 'update') {
                        if ($matchedDbId) {
                            $existing = OwnerRecord::find($matchedDbId);
                            if ($existing) {
                                $updateData = [];
                                if (!empty($mobilePhone)) $updateData['mobile_number'] = $mobilePhone;
                                if (!empty($secPhone)) $updateData['phone_number'] = $secPhone;
                                if (!empty($email)) $updateData['email'] = $email;
                                if (!empty($row['notes'])) $updateData['notes'] = $row['notes'];
                                if (!empty($rawBedrooms)) $updateData['bedrooms'] = $rawBedrooms;
                                if (!empty($rawPropType)) $updateData['property_type'] = $rawPropType;

                                if (!empty($updateData)) {
                                    $existing->update($updateData);
                                }
                                $updated++;
                                continue;
                            }
                        }
                        // If file-only duplicate, skip to prevent creating duplicate records
                        $skipped++;
                        continue;
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

                // Assign to active advisor only if explicitly specified in the row, otherwise leave UNASSIGNED
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

                // Create the Owner Record (NO automatic auto-assignment; records remain unassigned for agents to claim)
                $createdRecord = OwnerRecord::create([
                    'property_name'   => $propName,
                    'area'            => $area,
                    'property_number' => $propNum ?: null,
                    'building_name'   => $building,
                    'bedrooms'        => $rawBedrooms,
                    'property_type'   => $rawPropType,
                    'owner_name'      => $row['owner_name'],
                    'phone_number'    => $secPhone ?: null,
                    'mobile_number'   => $mobilePhone ?: null,
                    'email'           => $email ?: null,
                    'notes'           => $row['notes'] ?? null,
                    'status'          => $row['status'] ?? 'active',
                    'assigned_to'     => $assignedTo,
                ]);

                // Track in file maps
                if (!empty($normP)) $filePhoneMap[$normP] = ['id' => $createdRecord->id, 'name' => $createdRecord->owner_name];
                if (!empty($normS)) $filePhoneMap[$normS] = ['id' => $createdRecord->id, 'name' => $createdRecord->owner_name];
                if (!empty($normEmail)) $fileEmailMap[$normEmail] = ['id' => $createdRecord->id, 'name' => $createdRecord->owner_name];
                if (!empty($unitKey)) $fileUnitMap[$unitKey] = ['id' => $createdRecord->id, 'name' => $createdRecord->owner_name];

                $imported++;
            }
            DB::commit();
            static::clearOwnerCache();

            return response()->json($this->cleanUtf8([
                'success'  => true,
                'message'  => "Successfully imported {$imported} owner records!",
                'imported' => $imported,
                'skipped'  => $skipped,
                'updated'  => $updated,
            ]));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Import failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Claim an unassigned owner property record to the authenticated user.
     */
    public function claim(Request $request, $id)
    {
        $authUser = $request->user();
        if (!$authUser) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $canClaim = $authUser->hasPermission('*') || 
                    $authUser->hasPermission('owner_data.claim') || 
                    $authUser->hasPermission('owner_data.assign') ||
                    $authUser->hasPermission('lead_pool.claim') || 
                    $authUser->hasPermission('lead_pool.assign');

        if (!$canClaim) {
            return response()->json([
                'error' => 'Unauthorized: You do not have permission to claim records from Owner Data.'
            ], 403);
        }

        $record = OwnerRecord::findOrFail($id);

        if (!empty($record->assigned_to) && $record->assigned_to !== 'Unassigned') {
            return response()->json([
                'error' => "This owner property record is already assigned to {$record->assigned_to} and cannot be claimed."
            ], 422);
        }

        $agentName = $authUser->name;
        $record->update([
            'assigned_to' => $agentName,
        ]);
        static::clearOwnerCache();

        return response()->json([
            'success' => true,
            'message' => "Owner property record successfully claimed by {$agentName}!",
            'record'  => $record->fresh(),
        ]);
    }

    /**
     * Bulk claim multiple unassigned owner records.
     */
    public function bulkClaim(Request $request)
    {
        $authUser = $request->user();
        if (!$authUser) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $canClaim = $authUser->hasPermission('*') || 
                    $authUser->hasPermission('owner_data.claim') || 
                    $authUser->hasPermission('owner_data.assign') ||
                    $authUser->hasPermission('lead_pool.claim') || 
                    $authUser->hasPermission('lead_pool.assign');

        if (!$canClaim) {
            return response()->json([
                'error' => 'Unauthorized: You do not have permission to claim records from Owner Data.'
            ], 403);
        }

        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = $request->input('ids', []);
        if (empty($ids)) {
            return response()->json(['error' => 'No records selected.'], 422);
        }

        $unassignedRecords = OwnerRecord::whereIn('id', $ids)
            ->where(function($q) {
                $q->whereNull('assigned_to')
                  ->orWhere('assigned_to', '')
                  ->orWhere('assigned_to', 'Unassigned');
            })
            ->get();

        if ($unassignedRecords->isEmpty()) {
            return response()->json([
                'error' => 'None of the selected records can be claimed because they are already assigned to an advisor.'
            ], 422);
        }

        $agentName = $authUser->name;
        $claimedCount = 0;
        foreach ($unassignedRecords as $record) {
            $record->update(['assigned_to' => $agentName]);
            $claimedCount++;
        }
        static::clearOwnerCache();

        $skippedCount = count($ids) - $claimedCount;
        $msg = "{$claimedCount} owner record(s) successfully claimed by {$agentName}!";
        if ($skippedCount > 0) {
            $msg .= " ({$skippedCount} already assigned record(s) skipped).";
        }

        return response()->json([
            'success' => true,
            'message' => $msg,
            'claimed_count' => $claimedCount,
            'skipped_count' => $skippedCount,
        ]);
    }
}
