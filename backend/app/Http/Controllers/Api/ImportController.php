<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\BuyerQualification;
use App\Models\Activity;
use App\Models\LeadSource;
use App\Models\LeadSubSource;
use App\Models\Developer;
use App\Models\Community;
use App\Models\Project;
use App\Models\PropertyType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ImportController extends Controller
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

        // Noise words for developers/projects/communities/property types
        $noiseWords = ['properties', 'developments', 'development', 'developer', 'realty', 'real estate', 'group', 'holding', 'holdings', 'llc', 'tower', 'towers', 'residence', 'residences', 'dubai', 'the', 'project'];
        $cleanVal = preg_replace('/\b(' . implode('|', $noiseWords) . ')\b/iu', '', $val);
        $cleanVal = trim(preg_replace('/\s+/u', ' ', $cleanVal));

        foreach ($catalogList as $catItem) {
            $cat = trim((string)$catItem);
            $catLower = mb_strtolower($cat, 'UTF-8');

            // 1. Exact match (case-insensitive)
            if ($catLower === $val) {
                return ['match' => $cat, 'confidence' => 100];
            }

            // 2. Cleaned comparison (noise-words stripped)
            $cleanCat = preg_replace('/\b(' . implode('|', $noiseWords) . ')\b/iu', '', $catLower);
            $cleanCat = trim(preg_replace('/\s+/u', ' ', $cleanCat));

            if (!empty($cleanVal) && !empty($cleanCat) && $cleanVal === $cleanCat) {
                if ($highestScore < 95) {
                    $highestScore = 95;
                    $bestMatch = $cat;
                }
            }

            // 3. Substring match
            if (str_contains($catLower, $val) || str_contains($val, $catLower)) {
                $subScore = 85;
                if ($subScore > $highestScore) {
                    $highestScore = $subScore;
                    $bestMatch = $cat;
                }
            }

            // 4. similar_text percentage
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
     * Recursively convert and sanitize strings to valid UTF-8.
     */
    private function cleanUtf8($data)
    {
        if (is_string($data)) {
            if (!mb_check_encoding($data, 'UTF-8')) {
                $data = mb_convert_encoding($data, 'UTF-8', 'ISO-8859-1, Windows-1252, ASCII');
            }
            return mb_convert_encoding($data, 'UTF-8', 'UTF-8');
        }
        if (is_array($data)) {
            $cleaned = [];
            foreach ($data as $key => $val) {
                $cleanKey = is_string($key) ? mb_convert_encoding($key, 'UTF-8', 'UTF-8') : $key;
                $cleaned[$cleanKey] = $this->cleanUtf8($val);
            }
            return $cleaned;
        }
        return $data;
    }

    /**
     * Helper to search for field values across multiple header aliases (including Bitrix24 formats).
     */
    private function getFieldValue($row, array $keys, $default = '')
    {
        foreach ($keys as $k) {
            if (isset($row[$k]) && trim((string)$row[$k]) !== '') {
                return trim((string)$row[$k]);
            }
            foreach ($row as $rowKey => $rowVal) {
                if (strcasecmp(trim((string)$rowKey), trim($k)) === 0 && trim((string)$rowVal) !== '') {
                    return trim((string)$rowVal);
                }
            }
        }
        return $default;
    }

    /**
     * Multibyte UTF-8 safe initials generator.
     */
    private function generateInitials($name)
    {
        $cleanName = mb_convert_encoding($name, 'UTF-8', 'UTF-8');
        $words = preg_split('/\s+/u', trim($cleanName));
        $initials = '';
        foreach ($words as $w) {
            if (!empty($w)) {
                $initials .= mb_strtoupper(mb_substr($w, 0, 1, 'UTF-8'), 'UTF-8');
            }
        }
        $res = mb_substr($initials, 0, 2, 'UTF-8');
        return !empty($res) ? $res : 'LD';
    }

    /**
     * Helper to normalize phone numbers for accurate duplicate comparison.
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
     * Parse dates flexibly across Excel numbers, European, US, and ISO formats.
     */
    private function parseFlexibleDate($dateStr)
    {
        if (empty($dateStr)) {
            return now();
        }

        $str = trim((string)$dateStr);
        
        // Handle Excel numeric timestamps (e.g. 45527.453)
        if (is_numeric($str) && (float)$str > 20000 && (float)$str < 70000) {
            $timestamp = (int)(($str - 25569) * 86400);
            return Carbon::createFromTimestamp($timestamp);
        }

        // Try standard Carbon parse
        try {
            return Carbon::parse($str);
        } catch (\Exception $e) {}

        // Try specific common date formats
        $formats = [
            'd-m-Y H:i:s', 'd/m/Y H:i:s', 'd-m-Y H:i', 'd/m/Y H:i',
            'Y-m-d H:i:s', 'Y/m/d H:i:s', 'Y-m-d\TH:i:s.v\Z', 'Y-m-d\TH:i:s\Z',
            'd-m-Y', 'd/m/Y', 'm/d/Y H:i:s', 'm/d/Y H:i', 'm/d/Y', 'Y-m-d'
        ];

        foreach ($formats as $fmt) {
            try {
                return Carbon::createFromFormat($fmt, $str);
            } catch (\Exception $ex) {}
        }

        return now();
    }

    /**
     * Intelligently resolve combined source string if Source/Sub-Source is missing.
     */
    private function resolveSourceAndSubSource($rawSource, $rawSubSource)
    {
        $source = trim((string)($rawSource ?? ''));
        $subSource = trim((string)($rawSubSource ?? ''));

        if (!empty($source)) {
            $dbSrc = LeadSource::where('name', 'like', $source)->first();
            if ($dbSrc) {
                $source = $dbSrc->name;
            }
        }

        if (!empty($subSource)) {
            $dbSub = LeadSubSource::where('name', 'like', $subSource)->first();
            if ($dbSub) {
                $subSource = $dbSub->name;
            }
        }

        if (!empty($source) && !empty($subSource)) {
            if (!str_contains(strtolower($source), strtolower($subSource))) {
                return "{$source} ({$subSource})";
            }
            return $source;
        }

        if (!empty($source)) {
            return $source;
        }

        if (!empty($subSource)) {
            return $subSource;
        }

        return null;
    }

    /**
     * Preview and analyze CSV / Excel records for duplicates before saving.
     */
    public function preview(Request $request)
    {
        $rawRecords = $request->input('records', []);
        $records = $this->cleanUtf8($rawRecords);

        if (empty($records)) {
            return response()->json(['message' => 'No records provided.'], 400);
        }

        // Validate Header Structure
        $firstRow = reset($records);
        if (!is_array($firstRow)) {
            return response()->json([
                'message' => 'Invalid file format. Please upload a valid Excel or CSV file using our sample template.'
            ], 422);
        }

        $headers = array_keys($firstRow);
        $hasNameHeader = false;
        $hasPhoneHeader = false;

        $nameAliases = ['name', 'Name', 'Lead Name', 'Full Name', 'Client Name', 'Contact Name'];
        $phoneAliases = [
            'phone', 'Primary Phone', 'Phone', 'Work Phone',
            'secondary_phone', 'Secondary Phone', 'Sec Phone', 'Other Phone Number',
            'mobile_phone', 'Mobile No', 'Mobile Number', 'Mobile', 'Cell No', 'Cell'
        ];

        foreach ($headers as $h) {
            $hTrim = trim((string)$h);
            foreach ($nameAliases as $na) {
                if (strcasecmp($hTrim, $na) === 0) $hasNameHeader = true;
            }
            foreach ($phoneAliases as $pa) {
                if (strcasecmp($hTrim, $pa) === 0) $hasPhoneHeader = true;
            }
        }

        if (!$hasNameHeader && !$hasPhoneHeader) {
            return response()->json([
                'message' => 'Invalid file structure! The uploaded file does not match system columns (Missing Name, Primary Phone, or Mobile No columns). Please click "Download Sample Excel Template" to use the correct format.'
            ], 422);
        }

        // Duplicate check is scoped strictly within the uploaded file itself.
        // Database duplicate checking is intentionally removed per requirement.
        $filePhoneMap = [];

        // Fetch Master Catalogs for Value Mapping and Standardization
        $catalogDevelopers = Developer::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();
        $catalogCommunities = Community::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();
        $catalogProjects = Project::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();
        $catalogPropertyTypes = PropertyType::where('is_active', true)->orderBy('name')->pluck('name')->values()->all();

        $catValues = [
            'developer' => [],
            'community' => [],
            'project' => [],
            'property_type' => [],
        ];

        $analyzedRecords = [];
        $duplicatesList = [];
        $newCount = 0;
        $duplicateCount = 0;

        foreach ($records as $index => $row) {
            $name = $this->getFieldValue($row, ['name', 'Name', 'Lead Name', 'Full Name', 'Client Name', 'Contact Name'], 'Lead #' . ($index + 1));
            
            $phone = mb_substr($this->getFieldValue($row, ['phone', 'Primary Phone', 'Phone', 'Work Phone']), 0, 250, 'UTF-8');
            $secPhone = mb_substr($this->getFieldValue($row, ['secondary_phone', 'Secondary Phone', 'Sec Phone', 'Other Phone Number', 'Home Phone', 'Other Phone', 'mobile_phone', 'Mobile No', 'Mobile Number', 'Mobile', 'Mobile Phone', 'Cell No', 'Cell']), 0, 250, 'UTF-8');

            $rawEmail = $this->getFieldValue($row, ['email', 'Email', 'Work E-mail', 'Home E-mail', 'Other E-mail', 'E-mail', 'Newsletters email']);
            if (!empty($rawEmail) && str_contains($rawEmail, '@') && str_contains($rawEmail, '.')) {
                $email = mb_substr($rawEmail, 0, 250, 'UTF-8');
            } else {
                $email = '';
            }
            $nationality = $this->getFieldValue($row, ['nationality', 'Nationality']);
            
            // Flexible date parsing
            $rawCreatedAt = $this->getFieldValue($row, ['created_at', 'Created Date', 'Create Date', 'Created', 'Date']);
            $createdAt = !empty($rawCreatedAt) ? $this->parseFlexibleDate($rawCreatedAt)->format('Y-m-d H:i:s') : now()->format('Y-m-d H:i:s');

            $rawSrc = $this->getFieldValue($row, [
                'source', 'Source', 'Lead Source', 'Source Channel', 'Channel', 'utm_source', 'ORIGIN_ID', 'source_id', 'Source Name'
            ]);
            $rawSubSrc = $this->getFieldValue($row, [
                'sub_source', 'Sub-Source', 'Sub Source', 'Subsource', 'Sub Channel', 'utm_medium', 'campaign', 'sub_source_id', 'Sub Source Name'
            ]);
            $finalSource = $this->resolveSourceAndSubSource($rawSrc, $rawSubSrc);

            // Specs
            $opportunityType = $this->getFieldValue($row, ['opportunity_type', 'Opportunity Type']);
            $developer = $this->getFieldValue($row, ['developer', 'Developer']);
            $community = $this->getFieldValue($row, ['community', 'Community']);
            $project = $this->getFieldValue($row, ['project', 'Project']);
            $projectProperty = $this->getFieldValue($row, ['project_property', 'Unit / Property', 'Property', 'property_type', 'Property Type']);
            $bedrooms = $this->getFieldValue($row, ['bedrooms', 'Bedrooms']);
            $budgetMin = $this->getFieldValue($row, ['budget_min', 'Min Budget', 'Budget Min']);
            $budgetMax = $this->getFieldValue($row, ['budget_max', 'Max Budget', 'Budget Max']);
            $cashOrFinance = $this->getFieldValue($row, ['cash_or_finance', 'Payment Method']);
            $keyReq = $this->getFieldValue($row, ['key_requirement', 'Key Requirement']);

            // Catalog frequency counts for mapping preview
            if (!empty($developer)) {
                $catValues['developer'][$developer] = ($catValues['developer'][$developer] ?? 0) + 1;
            }
            if (!empty($community)) {
                $catValues['community'][$community] = ($catValues['community'][$community] ?? 0) + 1;
            }
            if (!empty($project)) {
                $catValues['project'][$project] = ($catValues['project'][$project] ?? 0) + 1;
            }
            if (!empty($projectProperty)) {
                $catValues['property_type'][$projectProperty] = ($catValues['property_type'][$projectProperty] ?? 0) + 1;
            }

            // SLA & Owner
            $assignedOwner = $this->getFieldValue($row, ['assigned_owner', 'Assigned Owner', 'Owner', 'Responsible', 'Created by'], 'Unassigned');
            $nextAction = $this->getFieldValue($row, ['next_action', 'Next Action']);
            $nextActionDue = $this->getFieldValue($row, ['next_action_due_at', 'Next Action Due']);

            $normP = $this->normalizePhone($phone);
            $normS = $this->normalizePhone($secPhone);

            $isDuplicate = false;
            $matchedContactInfo = null;

            if (!empty($normP) && isset($filePhoneMap[$normP])) {
                $isDuplicate = true;
                $matchedContactInfo = $filePhoneMap[$normP];
            } elseif (!empty($normS) && isset($filePhoneMap[$normS])) {
                $isDuplicate = true;
                $matchedContactInfo = $filePhoneMap[$normS];
            }

            $recordData = [
                'row_index' => $index + 1,
                'name' => $name,
                'phone' => $phone,
                'secondary_phone' => $secPhone,
                'email' => $email,
                'nationality' => $nationality,
                'created_at' => $createdAt,
                'source' => $finalSource,
                'raw_source' => $rawSrc,
                'sub_source' => $rawSubSrc,
                'opportunity_type' => $opportunityType,
                'developer' => $developer,
                'community' => $community,
                'project' => $project,
                'project_property' => $projectProperty,
                'bedrooms' => $bedrooms,
                'budget_min' => $budgetMin,
                'budget_max' => $budgetMax,
                'cash_or_finance' => $cashOrFinance,
                'key_requirement' => $keyReq,
                'assigned_owner' => $assignedOwner,
                'next_action' => $nextAction,
                'next_action_due_at' => $nextActionDue,
                'is_duplicate' => $isDuplicate,
                'matched_with' => $matchedContactInfo ? $matchedContactInfo['name'] . ' [' . $matchedContactInfo['matched_field'] . ']' : null,
                'matched_contact_id' => null,
            ];

            if ($isDuplicate) {
                $duplicateCount++;
                $duplicatesList[] = $recordData;
            } else {
                $newCount++;
                if (!empty($normP)) {
                    $filePhoneMap[$normP] = ['id' => null, 'name' => $name, 'matched_field' => 'Row #' . ($index + 1) . ' in File'];
                }
                if (!empty($normS)) {
                    $filePhoneMap[$normS] = ['id' => null, 'name' => $name, 'matched_field' => 'Row #' . ($index + 1) . ' in File'];
                }
            }

            $analyzedRecords[] = $recordData;
        }

        // Compute Unmatched Values and Suggestions
        $unmatched = [
            'developer' => [],
            'community' => [],
            'project' => [],
            'property_type' => [],
        ];

        $catalogsMap = [
            'developer' => $catalogDevelopers,
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
                // Exact match exists in catalog
                if (isset($catalogLowerLookup[$rawLower])) {
                    continue;
                }

                $best = $this->findBestMatch($rawVal, $catalogList);
                $unmatched[$category][] = [
                    'file_value' => $rawVal,
                    'count' => $count,
                    'suggested_match' => $best['match'],
                    'confidence' => $best['confidence'],
                ];
            }
        }

        $hasUnmatched = (
            count($unmatched['developer']) > 0 ||
            count($unmatched['community']) > 0 ||
            count($unmatched['project']) > 0 ||
            count($unmatched['property_type']) > 0
        );

        return response()->json($this->cleanUtf8([
            'total_records' => count($records),
            'new_count' => $newCount,
            'duplicate_count' => $duplicateCount,
            'duplicates' => $duplicatesList,
            'analyzed_records' => $analyzedRecords,
            'has_unmatched' => $hasUnmatched,
            'unmatched' => $unmatched,
            'catalogs' => [
                'developer' => $catalogDevelopers,
                'community' => $catalogCommunities,
                'project' => $catalogProjects,
                'property_type' => $catalogPropertyTypes,
            ],
        ]));
    }

    /**
     * Execute final database import with selected duplicate strategy and value mappings.
     */
    public function execute(Request $request)
    {
        $rawRecords = $request->input('records', []);
        $records = $this->cleanUtf8($rawRecords);
        $duplicateMode = $request->input('duplicate_mode', 'skip');
        $valueMappings = $request->input('value_mappings', []);
        $newCatalogItems = $request->input('new_catalog_items', []);

        if (empty($records)) {
            return response()->json(['message' => 'No analyzed records provided for import.'], 400);
        }

        $importedCount = 0;
        $skippedCount = 0;
        $updatedCount = 0;

        DB::beginTransaction();
        try {
            // Register any newly approved catalog items into Master Settings
            if (!empty($newCatalogItems) && is_array($newCatalogItems)) {
                foreach ($newCatalogItems as $newItem) {
                    $cat = $newItem['category'] ?? '';
                    $name = trim((string)($newItem['name'] ?? ''));
                    if (empty($name)) continue;

                    if ($cat === 'developer') {
                        Developer::firstOrCreate(
                            ['name' => mb_substr($name, 0, 255, 'UTF-8')],
                            ['is_active' => true, 'sort_order' => 99]
                        );
                    } elseif ($cat === 'community') {
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

            foreach ($records as $row) {
                $isDuplicate = !empty($row['is_duplicate']);
                $matchedContactId = $row['matched_contact_id'] ?? null;

                if ($isDuplicate) {
                    if ($duplicateMode === 'skip') {
                        $skippedCount++;
                        continue;
                    } elseif ($duplicateMode === 'update' && $matchedContactId) {
                        // Update existing contact details
                        $contact = Contact::find($matchedContactId);
                        if ($contact) {
                            $updateData = [];
                            if (!empty($row['email'])) $updateData['email'] = mb_substr($row['email'], 0, 250, 'UTF-8');
                            if (!empty($row['secondary_phone'])) {
                                $updateData['secondary_phone'] = mb_substr($row['secondary_phone'], 0, 250, 'UTF-8');
                            } elseif (!empty($row['mobile_phone'])) {
                                $updateData['secondary_phone'] = mb_substr($row['mobile_phone'], 0, 250, 'UTF-8');
                            }
                            if (!empty($row['nationality'])) $updateData['nationality'] = mb_substr($row['nationality'], 0, 100, 'UTF-8');
                            
                            if (!empty($updateData)) {
                                $contact->update($updateData);
                            }
                            
                            Activity::create([
                                'contact_id' => $contact->id,
                                'user_name' => 'Excel Importer',
                                'type' => 'note',
                                'description' => "Updated contact info from import batch.",
                            ]);
                            $updatedCount++;
                            continue;
                        }
                    }
                }

                // Apply Value Mappings / Substitutions
                $dev = $row['developer'] ?? null;
                if (!empty($dev) && isset($valueMappings['developer'][$dev])) {
                    $dev = $valueMappings['developer'][$dev];
                }
                $comm = $row['community'] ?? null;
                if (!empty($comm) && isset($valueMappings['community'][$comm])) {
                    $comm = $valueMappings['community'][$comm];
                }
                $proj = $row['project'] ?? null;
                if (!empty($proj) && isset($valueMappings['project'][$proj])) {
                    $proj = $valueMappings['project'][$proj];
                }
                $prop = $row['project_property'] ?? null;
                if (!empty($prop) && isset($valueMappings['property_type'][$prop])) {
                    $prop = $valueMappings['property_type'][$prop];
                }

                // Multibyte safe initials calculation
                $initials = $this->generateInitials($row['name']);

                // Auto-register new Source & Sub-Source into Master Catalog database if not already present
                $rawSrcName = $this->getFieldValue($row, [
                    'raw_source', 'source', 'Source', 'Lead Source', 'Source Channel', 'Channel', 'utm_source', 'ORIGIN_ID', 'source_id', 'Source Name'
                ]);
                $rawSubSrcName = $this->getFieldValue($row, [
                    'sub_source', 'Sub-Source', 'Sub Source', 'Subsource', 'Sub Channel', 'utm_medium', 'campaign', 'sub_source_id', 'Sub Source Name'
                ]);

                if (!empty($rawSrcName)) {
                    $parentSource = LeadSource::firstOrCreate(
                        ['name' => mb_substr($rawSrcName, 0, 100, 'UTF-8')],
                        ['is_active' => true, 'sort_order' => 99]
                    );

                    if (!empty($rawSubSrcName)) {
                        LeadSubSource::firstOrCreate(
                            ['lead_source_id' => $parentSource->id, 'name' => mb_substr($rawSubSrcName, 0, 100, 'UTF-8')],
                            ['is_active' => true, 'sort_order' => 99]
                        );
                    }
                }

                $finalSource = $this->resolveSourceAndSubSource($rawSrcName, $rawSubSrcName);
                $contactState = ($isDuplicate && $duplicateMode === 'import_duplicate') ? 'duplicate' : 'available';

                $recordCreatedAt = !empty($row['created_at']) ? $this->parseFlexibleDate($row['created_at']) : now();

                $contactData = [
                    'name' => mb_substr($row['name'] ?? 'Lead', 0, 250, 'UTF-8'),
                    'initials' => mb_substr($initials, 0, 10, 'UTF-8'),
                    'phone' => mb_substr($row['phone'] ?? '', 0, 250, 'UTF-8'),
                    'secondary_phone' => !empty($row['secondary_phone']) ? mb_substr($row['secondary_phone'], 0, 250, 'UTF-8') : (!empty($row['mobile_phone']) ? mb_substr($row['mobile_phone'], 0, 250, 'UTF-8') : null),
                    'email' => (!empty($row['email']) && str_contains($row['email'], '@')) ? mb_substr($row['email'], 0, 250, 'UTF-8') : null,
                    'nationality' => !empty($row['nationality']) ? mb_substr($row['nationality'], 0, 100, 'UTF-8') : 'Emirati',
                    'source' => !empty($finalSource) ? mb_substr($finalSource, 0, 250, 'UTF-8') : 'Database',
                    'state' => $contactState,
                    'last_activity_at' => now(),
                    'created_at' => $recordCreatedAt,
                    'updated_at' => $recordCreatedAt,
                ];

                $contact = Contact::create($contactData);

                // Lead Assignment: Assign to specific advisor if provided, otherwise auto-assign via Round-Robin
                // If the lead was marked as duplicate, preserve its 'duplicate' state and do not auto-assign to advisor pool
                if ($contactState !== 'duplicate') {
                    $assignedOwner = !empty($row['assigned_owner']) && $row['assigned_owner'] !== 'Unassigned' ? trim($row['assigned_owner']) : null;
                    if (!empty($assignedOwner) && $assignedOwner !== 'auto') {
                        $contact->update([
                            'assigned_to' => $assignedOwner,
                            'assigned_at' => now(),
                            'state'       => 'assigned',
                        ]);
                    } else {
                        \App\Services\LeadDistributionService::autoAssignContact($contact);
                        $contact->refresh();
                    }
                } else {
                    Activity::create([
                        'contact_id'  => $contact->id,
                        'user_name'   => 'Excel Importer',
                        'type'        => 'note',
                        'description' => "Imported as duplicate record from file batch (Row #" . ($row['row_index'] ?? 'N/A') . "). Displayed in Duplicate tab.",
                    ]);
                }

                // Specification summary recorded in initial audit activity note (Opportunity is created MANUALLY by agent from My Queue)
                $specSummary = [];
                if (!empty($dev)) $specSummary[] = "Dev: {$dev}";
                if (!empty($proj)) $specSummary[] = "Project: {$proj}";
                if (!empty($comm)) $specSummary[] = "Area: {$comm}";
                if (!empty($prop)) $specSummary[] = "Prop: {$prop}";
                if (!empty($row['bedrooms'])) $specSummary[] = "Beds: {$row['bedrooms']}";
                if (!empty($row['budget_min']) || !empty($row['budget_max'])) {
                    $specSummary[] = "Budget: " . ($row['budget_min'] ?? '0') . ' - ' . ($row['budget_max'] ?? 'Max');
                }
                $specNote = !empty($specSummary) ? ' | ' . implode(', ', $specSummary) : '';

                Activity::create([
                    'contact_id' => $contact->id,
                    'opportunity_id' => null,
                    'user_name' => 'Excel Importer',
                    'type' => 'note',
                    'description' => "Lead created via Batch Excel / CSV Importer{$specNote}.",
                ]);

                $importedCount++;
            }

            DB::commit();

            return response()->json($this->cleanUtf8([
                'success' => true,
                'imported_count' => $importedCount,
                'skipped_count' => $skippedCount,
                'updated_count' => $updatedCount,
                'message' => "Successfully imported {$importedCount} leads into Lead Pool.",
            ]));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json($this->cleanUtf8([
                'message' => 'Failed to process import batch: ' . $e->getMessage(),
            ]), 500);
        }
    }
}
