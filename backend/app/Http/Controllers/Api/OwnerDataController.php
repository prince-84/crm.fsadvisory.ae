<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OwnerRecord;
use App\Services\LeadDistributionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OwnerDataController extends Controller
{
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

        // Area Filter
        if ($request->filled('area') && $request->area !== 'all') {
            $query->where('area', $request->area);
        }

        // Property Type Filter
        if ($request->filled('property_type') && $request->property_type !== 'all') {
            $query->where('property_type', $request->property_type);
        }

        // Bedrooms Filter
        if ($request->filled('bedrooms') && $request->bedrooms !== 'all') {
            $query->where('bedrooms', $request->bedrooms);
        }

        // Status Filter
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Tab: unassigned
        if ($tab === 'unassigned') {
            $query->where(function ($q) {
                $q->whereNull('assigned_to')->orWhere('assigned_to', '');
            });
        }

        // KPI Summary Statistics
        $totalAll = OwnerRecord::count();
        $totalAvailable = OwnerRecord::where('status', 'Available')->count();
        $totalRented = OwnerRecord::where('status', 'Rented')->count();
        $totalSold = OwnerRecord::where('status', 'Sold')->count();
        $totalAreas = OwnerRecord::distinct('area')->whereNotNull('area')->where('area', '!=', '')->count('area');
        $totalDeleted = OwnerRecord::onlyTrashed()->count();

        // Distinct filter options
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
            ->pluck('property_type');

        $distinctBedrooms = OwnerRecord::select('bedrooms')
            ->whereNotNull('bedrooms')
            ->where('bedrooms', '!=', '')
            ->distinct()
            ->orderBy('bedrooms')
            ->pluck('bedrooms');

        // Sorting
        $allowedSorts = [
            'id', 'property_name', 'area', 'property_number', 'building_name',
            'bedrooms', 'property_type', 'owner_name', 'phone_number', 'mobile_number',
            'email', 'status', 'created_at', 'updated_at'
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
                'available' => $totalAvailable,
                'rented' => $totalRented,
                'sold' => $totalSold,
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

        $record = OwnerRecord::create($validator->validated());

        if (empty($record->assigned_to)) {
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

        $record->update($validator->validated());

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
     * Bulk import owner records from CSV / array payload
     */
    public function import(Request $request)
    {
        $rows = $request->input('records', []);

        if (empty($rows) || !is_array($rows)) {
            return response()->json(['success' => false, 'message' => 'No import rows provided'], 400);
        }

        $imported = 0;
        DB::beginTransaction();
        try {
            foreach ($rows as $row) {
                if (empty($row['owner_name'])) continue;

                $createdRecord = OwnerRecord::create([
                    'property_name'   => $row['property_name'] ?? null,
                    'area'            => $row['area'] ?? null,
                    'property_number' => $row['property_number'] ?? null,
                    'building_name'   => $row['building_name'] ?? null,
                    'bedrooms'        => $row['bedrooms'] ?? null,
                    'property_type'   => $row['property_type'] ?? null,
                    'owner_name'      => $row['owner_name'],
                    'phone_number'    => $row['phone_number'] ?? null,
                    'mobile_number'   => $row['mobile_number'] ?? null,
                    'email'           => $row['email'] ?? null,
                    'notes'           => $row['notes'] ?? null,
                    'status'          => $row['status'] ?? 'active',
                    'assigned_to'     => $row['assigned_to'] ?? null,
                ]);

                if (empty($row['assigned_to'])) {
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
