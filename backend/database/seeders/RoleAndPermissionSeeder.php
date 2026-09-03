<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RoleAndPermissionSeeder extends Seeder
{
    public function run(): void
    {
        // All Granular Permission Keys categorized by Module
        $allPermissions = [
            // 1. Lead Pool
            'leads.view',
            'leads.create',
            'leads.edit',
            'leads.delete',
            'leads.restore',
            'leads.assign',
            'leads.export',
            'leads.import',

            // 2. Owner Data Pool
            'owner_data.view',
            'owner_data.create',
            'owner_data.edit',
            'owner_data.delete',
            'owner_data.export',
            'owner_data.import',

            // 3. Sales Queue & Follow-ups
            'queue.view',
            'queue.update_status',
            'queue.calendar',

            // 4. Opportunities Pipeline
            'deals.view',
            'deals.create',
            'deals.edit',
            'deals.delete',

            // 5. 3CX Telephony & Calls
            'calls.make',
            'calls.view_logs',
            'calls.listen_recordings',
            'calls.download_recordings',

            // 6. WhatsApp Web Gateway
            'whatsapp.view',
            'whatsapp.send_messages',
            'whatsapp.send_voice',
            'whatsapp.manage_channels',

            // 7. Reports & Analytics
            'reports.view_team',
            'reports.view_financials',
            'reports.export',

            // 8. System & Administration
            'users.manage',
            'roles.manage',
            'settings.view',
        ];

        // 1. Super Admin Role
        $superAdmin = Role::updateOrCreate(
            ['slug' => 'super-admin'],
            [
                'name' => 'Super Admin',
                'description' => 'Unrestricted access to all CRM data, financial reports, users, telephony and system configuration.',
                'permissions' => ['*'],
                'is_system' => true,
            ]
        );

        // 2. Sales Manager Role
        $salesManager = Role::updateOrCreate(
            ['slug' => 'sales-manager'],
            [
                'name' => 'Sales Manager',
                'description' => 'Full control over sales pipeline, agent queue routing, lead assignment, call monitoring and performance reports.',
                'permissions' => [
                    'leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'leads.assign', 'leads.export', 'leads.import',
                    'owner_data.view', 'owner_data.create', 'owner_data.edit', 'owner_data.export',
                    'queue.view', 'queue.update_status', 'queue.calendar',
                    'deals.view', 'deals.create', 'deals.edit',
                    'calls.make', 'calls.view_logs', 'calls.listen_recordings',
                    'whatsapp.view', 'whatsapp.send_messages', 'whatsapp.send_voice',
                    'reports.view_team', 'reports.view_financials', 'reports.export',
                    'users.manage',
                ],
                'is_system' => true,
            ]
        );

        // 3. Senior Property Advisor Role
        $seniorAdvisor = Role::updateOrCreate(
            ['slug' => 'senior-advisor'],
            [
                'name' => 'Senior Property Advisor',
                'description' => 'Comprehensive sales access to Lead Pool, Owner Database, Deal Pipeline, 3CX Telephony and WhatsApp Web.',
                'permissions' => [
                    'leads.view', 'leads.create', 'leads.edit', 'leads.export',
                    'owner_data.view', 'owner_data.create', 'owner_data.edit', 'owner_data.export',
                    'queue.view', 'queue.update_status', 'queue.calendar',
                    'deals.view', 'deals.create', 'deals.edit',
                    'calls.make', 'calls.view_logs', 'calls.listen_recordings',
                    'whatsapp.view', 'whatsapp.send_messages', 'whatsapp.send_voice',
                ],
                'is_system' => true,
            ]
        );

        // 4. Property Consultant / Agent Role
        $agentRole = Role::updateOrCreate(
            ['slug' => 'agent'],
            [
                'name' => 'Property Consultant',
                'description' => 'Access to assigned sales leads, personal queue follow-ups, opportunities, WhatsApp web and outgoing calls.',
                'permissions' => [
                    'leads.view', 'leads.create', 'leads.edit',
                    'owner_data.view',
                    'queue.view', 'queue.update_status', 'queue.calendar',
                    'deals.view', 'deals.create', 'deals.edit',
                    'calls.make',
                    'whatsapp.view', 'whatsapp.send_messages', 'whatsapp.send_voice',
                ],
                'is_system' => true,
            ]
        );

        // 5. Operations Coordinator Role
        $operations = Role::updateOrCreate(
            ['slug' => 'operations'],
            [
                'name' => 'Operations Coordinator',
                'description' => 'Responsible for data hygiene, lead imports, owner database verification and CSV reports.',
                'permissions' => [
                    'leads.view', 'leads.create', 'leads.edit', 'leads.assign', 'leads.export', 'leads.import',
                    'owner_data.view', 'owner_data.create', 'owner_data.edit', 'owner_data.export', 'owner_data.import',
                    'reports.view_team', 'reports.export',
                ],
                'is_system' => true,
            ]
        );

        // 6. Telesales Agent Role
        $telesalesRole = Role::updateOrCreate(
            ['slug' => 'telesales-agent'],
            [
                'name' => 'Telesales Agent',
                'description' => 'Dedicated telesales representative focused on client outreach, lead qualification, queue follow-ups, telephony calls, and WhatsApp communication.',
                'permissions' => [
                    'leads.view', 'leads.create', 'leads.edit',
                    'queue.view', 'queue.update_status', 'queue.calendar',
                    'deals.view', 'deals.create',
                    'calls.make', 'calls.view_logs', 'calls.listen_recordings',
                    'whatsapp.view', 'whatsapp.send_messages', 'whatsapp.send_voice',
                ],
                'is_system' => true,
            ]
        );

        // Seed / Update standard team members with roles and departments
        $teamUsers = [
            [
                'name' => 'Faraz Shafi',
                'email' => 'faraz@fsadvisory.ae',
                'phone' => '+971 50 123 4567',
                'role' => 'Super Admin',
                'department' => 'Executive Management',
                'role_id' => $superAdmin->id,
                'permissions' => ['*'],
                'initials' => 'FS',
                'is_active' => true,
            ],
            [
                'name' => 'Hassan Qasimi',
                'email' => 'hassan@fsadvisory.ae',
                'phone' => '+971 55 999 3322',
                'role' => 'Sales Manager',
                'department' => 'Off-Plan Sales',
                'role_id' => $salesManager->id,
                'permissions' => $salesManager->permissions,
                'initials' => 'HQ',
                'is_active' => true,
            ],
            [
                'name' => 'Waqar Ahmed',
                'email' => 'waqar@fsadvisory.ae',
                'phone' => '+971 56 111 4455',
                'role' => 'Senior Property Advisor',
                'department' => 'Secondary & Luxury',
                'role_id' => $seniorAdvisor->id,
                'permissions' => $seniorAdvisor->permissions,
                'initials' => 'WA',
                'is_active' => true,
            ],
            [
                'name' => 'Zara Al-Sayed',
                'email' => 'zara@fsadvisory.ae',
                'phone' => '+971 52 444 8811',
                'role' => 'Operations Coordinator',
                'department' => 'Operations & Compliance',
                'role_id' => $operations->id,
                'permissions' => $operations->permissions,
                'initials' => 'ZA',
                'is_active' => true,
            ],
            // --- TeleSales Department Agents ---
            [
                'name' => 'Hiba Aslam',
                'email' => 'hiba@fsadvisory.ae',
                'phone' => '+971 58 441 2233',
                'role' => 'Telesales Agent',
                'department' => 'TeleSales',
                'role_id' => $telesalesRole->id,
                'permissions' => $telesalesRole->permissions,
                'initials' => 'HA',
                'is_active' => true,
            ],
            [
                'name' => 'Shafiuddin',
                'email' => 'shafiuddin@fsadvisory.ae',
                'phone' => '+971 55 597 7700',
                'role' => 'Telesales Agent',
                'department' => 'TeleSales',
                'role_id' => $telesalesRole->id,
                'permissions' => $telesalesRole->permissions,
                'initials' => 'SH',
                'is_active' => true,
            ],
            [
                'name' => 'Rayyan',
                'email' => 'rayyan@fsadvisory.ae',
                'phone' => '+971 56 946 8277',
                'role' => 'Telesales Agent',
                'department' => 'TeleSales',
                'role_id' => $telesalesRole->id,
                'permissions' => $telesalesRole->permissions,
                'initials' => 'RA',
                'is_active' => true,
            ],
            [
                'name' => 'Saad',
                'email' => 'saad@fsadvisory.ae',
                'phone' => '+971 54 330 1035',
                'role' => 'Telesales Agent',
                'department' => 'TeleSales',
                'role_id' => $telesalesRole->id,
                'permissions' => $telesalesRole->permissions,
                'initials' => 'SA',
                'is_active' => true,
            ],
            [
                'name' => 'Mako',
                'email' => 'mako@fsadvisory.ae',
                'phone' => '+971 52 987 6543',
                'role' => 'Telesales Agent',
                'department' => 'TeleSales',
                'role_id' => $telesalesRole->id,
                'permissions' => $telesalesRole->permissions,
                'initials' => 'MK',
                'is_active' => true,
            ],
        ];

        foreach ($teamUsers as $u) {
            User::updateOrCreate(
                ['email' => $u['email']],
                [
                    'name' => $u['name'],
                    'phone' => $u['phone'],
                    'role' => $u['role'],
                    'department' => $u['department'],
                    'role_id' => $u['role_id'],
                    'permissions' => $u['permissions'],
                    'initials' => $u['initials'],
                    'is_active' => $u['is_active'],
                    'password' => Hash::make('password123'),
                ]
            );
        }
    }
}
