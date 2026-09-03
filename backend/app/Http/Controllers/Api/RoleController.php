<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RoleController extends Controller
{
    public function index()
    {
        $roles = Role::withCount('users')->orderBy('id', 'asc')->get();
        return response()->json([
            'success' => true,
            'roles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:roles,name',
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'permissions' => $validated['permissions'] ?? [],
            'is_system' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'New Role created successfully.',
            'role' => $role,
        ]);
    }

    public function update(Request $request, $id)
    {
        $role = Role::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:roles,name,' . $id,
            'description' => 'nullable|string|max:255',
            'permissions' => 'nullable|array',
        ]);

        $role->update([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'description' => $validated['description'] ?? $role->description,
            'permissions' => $validated['permissions'] ?? $role->permissions,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Role updated successfully.',
            'role' => $role,
        ]);
    }

    public function destroy($id)
    {
        $role = Role::findOrFail($id);

        if ($role->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'System default roles cannot be deleted.',
            ], 422);
        }

        $role->delete();

        return response()->json([
            'success' => true,
            'message' => 'Role deleted successfully.',
        ]);
    }

    /**
     * Get the master permission dictionary categorized by CRM module
     */
    public function permissionsMatrix()
    {
        $matrix = [
            [
                'module' => 'Lead Pool',
                'description' => 'Master client directory, inbound allocations and lead qualification',
                'permissions' => [
                    ['key' => 'leads.view', 'label' => 'View Leads Pool', 'desc' => 'Access and browse client database and filter tabs'],
                    ['key' => 'leads.create', 'label' => 'Create New Lead', 'desc' => 'Manually add new inbound lead profiles'],
                    ['key' => 'leads.edit', 'label' => 'Edit Lead Profiles', 'desc' => 'Modify client details, budgets and requirements'],
                    ['key' => 'leads.delete', 'label' => 'Trash Leads', 'desc' => 'Soft-delete leads to trash archive'],
                    ['key' => 'leads.restore', 'label' => 'Restore / Purge Leads', 'desc' => 'Restore from trash or permanently purge records'],
                    ['key' => 'leads.assign', 'label' => 'Bulk Lead Assignment', 'desc' => 'Reallocate leads between advisors and agents'],
                    ['key' => 'leads.export', 'label' => 'Export CSV Data', 'desc' => 'Download client spreadsheets'],
                    ['key' => 'leads.import', 'label' => 'Bulk CSV Import', 'desc' => 'Upload and ingest external lead sheets'],
                ]
            ],
            [
                'module' => 'Owner Data Bank',
                'description' => 'Direct Dubai property registry, title deed units and owner contacts',
                'permissions' => [
                    ['key' => 'owner_data.view', 'label' => 'View Owner Data', 'desc' => 'Search and browse Dubai property title registry'],
                    ['key' => 'owner_data.create', 'label' => 'Add Owner Property', 'desc' => 'Register new property unit and owner info'],
                    ['key' => 'owner_data.edit', 'label' => 'Edit Owner Record', 'desc' => 'Update property details, price, status and contacts'],
                    ['key' => 'owner_data.delete', 'label' => 'Delete Owner Record', 'desc' => 'Remove records from owner database'],
                    ['key' => 'owner_data.export', 'label' => 'Export Owner Data (CSV)', 'desc' => 'Download property bank spreadsheets'],
                    ['key' => 'owner_data.import', 'label' => 'Import Owner Data (CSV)', 'desc' => 'Bulk upload owner property records'],
                ]
            ],
            [
                'module' => 'Sales Queue & Follow-ups',
                'description' => 'Daily agent queue, follow-up alarms, and appointments',
                'permissions' => [
                    ['key' => 'queue.view', 'label' => 'View Sales Queue', 'desc' => 'Access My Queue and pending follow-ups'],
                    ['key' => 'queue.update_status', 'label' => 'Update Actions & Status', 'desc' => 'Log communication and schedule next actions'],
                    ['key' => 'queue.calendar', 'label' => 'Manage Calendar & Appointments', 'desc' => 'Book client viewings and calendar appointments'],
                ]
            ],
            [
                'module' => 'Opportunities Pipeline',
                'description' => 'Kanban deal board, commercial stages and contract milestones',
                'permissions' => [
                    ['key' => 'deals.view', 'label' => 'View Deals Pipeline', 'desc' => 'Access Kanban board and sales stages'],
                    ['key' => 'deals.create', 'label' => 'Create Opportunities', 'desc' => 'Open deals from qualified leads'],
                    ['key' => 'deals.edit', 'label' => 'Move Stages & Financials', 'desc' => 'Advance pipeline stages and update commission numbers'],
                    ['key' => 'deals.delete', 'label' => 'Delete Opportunities', 'desc' => 'Archive or cancel ongoing deals'],
                ]
            ],
            [
                'module' => '3CX Telephony & Calls',
                'description' => 'Web dialer, live call popups, telephony logs and audio recordings',
                'permissions' => [
                    ['key' => 'calls.make', 'label' => 'Make Outbound Calls', 'desc' => 'Trigger 1-click web phone dialer'],
                    ['key' => 'calls.view_logs', 'label' => 'View Call Activity Logs', 'desc' => 'Inspect agent call duration and timestamps'],
                    ['key' => 'calls.listen_recordings', 'label' => 'Listen to Audio Recordings', 'desc' => 'Play call audio in browser player'],
                    ['key' => 'calls.download_recordings', 'label' => 'Download Audio Files', 'desc' => 'Export WAV/MP3 call recordings'],
                ]
            ],
            [
                'module' => 'WhatsApp Web Gateway',
                'description' => 'Real-time multi-agent WhatsApp messaging and audio voice notes',
                'permissions' => [
                    ['key' => 'whatsapp.view', 'label' => 'Access WhatsApp Web', 'desc' => 'View live conversations and client chats'],
                    ['key' => 'whatsapp.send_messages', 'label' => 'Send WhatsApp Messages', 'desc' => 'Send real-time replies and templates'],
                    ['key' => 'whatsapp.send_voice', 'label' => 'Record & Send Voice Notes', 'desc' => 'Record browser mic and send WhatsApp PTT audio'],
                    ['key' => 'whatsapp.manage_channels', 'label' => 'Sync / Unlink Devices', 'desc' => 'Scan QR code and manage linked WhatsApp numbers'],
                ]
            ],
            [
                'module' => 'Reports & Performance',
                'description' => 'Advisor leaderboards, conversion KPIs and financial analytics',
                'permissions' => [
                    ['key' => 'reports.view_team', 'label' => 'View Team Performance', 'desc' => 'Inspect agent conversion stats and SLAs'],
                    ['key' => 'reports.view_financials', 'label' => 'View Revenue & Financials', 'desc' => 'Access gross commission and deal values'],
                    ['key' => 'reports.export', 'label' => 'Export Analytic Reports', 'desc' => 'Download PDF and Excel performance sheets'],
                ]
            ],
            [
                'module' => 'System Administration',
                'description' => 'User provisioning, security controls and system settings',
                'permissions' => [
                    ['key' => 'users.manage', 'label' => 'Manage Team Members', 'desc' => 'Create, edit, activate/deactivate agents and users'],
                    ['key' => 'roles.manage', 'label' => 'Manage Roles & Permissions', 'desc' => 'Configure granular permission checkbox matrices'],
                    ['key' => 'settings.view', 'label' => 'System Settings Access', 'desc' => 'Access API keys, portal sync and integrations'],
                ]
            ],
        ];

        return response()->json([
            'success' => true,
            'matrix' => $matrix,
        ]);
    }
}
