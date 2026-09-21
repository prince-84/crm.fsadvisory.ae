<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    /**
     * Get list of all departments with member count
     */
    public function index()
    {
        $departments = Department::orderBy('id', 'asc')->get()->map(function ($dept) {
            $dept->users_count = User::where('department', $dept->name)->count();
            return $dept;
        });

        return response()->json([
            'success' => true,
            'departments' => $departments,
        ]);
    }

    /**
     * Create a new department
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:departments,name',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $department = Department::create([
            'name' => trim($validated['name']),
            'code' => !empty($validated['code']) ? strtoupper(trim($validated['code'])) : strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $validated['name']), 0, 10)),
            'description' => $validated['description'] ?? null,
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Department created successfully.',
            'department' => $department,
        ]);
    }

    /**
     * Update department details
     */
    public function update(Request $request, $id)
    {
        $department = Department::findOrFail($id);
        $oldName = $department->name;

        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:departments,name,' . $id,
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $newName = trim($validated['name']);

        $department->update([
            'name' => $newName,
            'code' => !empty($validated['code']) ? strtoupper(trim($validated['code'])) : $department->code,
            'description' => $validated['description'] ?? $department->description,
            'is_active' => $request->has('is_active') ? $request->boolean('is_active') : $department->is_active,
        ]);

        // If department name changed, update matching user department strings
        if ($oldName !== $newName) {
            User::where('department', $oldName)->update(['department' => $newName]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Department updated successfully.',
            'department' => $department,
        ]);
    }

    /**
     * Delete department
     */
    public function destroy($id)
    {
        $department = Department::findOrFail($id);

        // Check if any users are assigned to this department
        $userCount = User::where('department', $department->name)->count();
        if ($userCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete department '{$department->name}' because {$userCount} user(s) are assigned to it.",
            ], 422);
        }

        $department->delete();

        return response()->json([
            'success' => true,
            'message' => 'Department deleted successfully.',
        ]);
    }
}
