<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TableColumnSetting;
use Illuminate\Http\Request;

class TableColumnSettingController extends Controller
{
    /**
     * Get global column visibility and order for a specific table.
     */
    public function getSettings(string $table)
    {
        $setting = TableColumnSetting::where('table_name', $table)->first();

        return response()->json([
            'success' => true,
            'table_name' => $table,
            'visibility' => $setting ? $setting->visibility : null,
            'order' => $setting ? $setting->order : null,
            'updated_by' => $setting ? $setting->updated_by : null,
            'updated_at' => $setting ? $setting->updated_at : null,
        ]);
    }

    /**
     * Save global column visibility and order for a specific table.
     */
    public function saveSettings(Request $request, string $table)
    {
        $validated = $request->validate([
            'visibility' => 'nullable|array',
            'order' => 'nullable|array',
            'updated_by' => 'nullable|string',
        ]);

        $setting = TableColumnSetting::updateOrCreate(
            ['table_name' => $table],
            [
                'visibility' => $validated['visibility'] ?? null,
                'order' => $validated['order'] ?? null,
                'updated_by' => $validated['updated_by'] ?? ($request->user()?->name ?? 'System User'),
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Table column settings for '{$table}' saved successfully.",
            'data' => $setting,
        ]);
    }
}
