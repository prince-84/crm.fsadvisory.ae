<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('whatsapp_channels')) {
            return;
        }

        // 1. Delete all legacy dummy channels (Agency Owner, Mako Real Estate, Shafi Core, FA Advisory 3, or channels with no valid user_id)
        DB::table('whatsapp_channels')
            ->where(function ($q) {
                $q->whereNull('user_id')
                  ->orWhere('agent_name', 'like', '%Agency Owner%')
                  ->orWhere('session_name', 'like', '%Agency Owner%')
                  ->orWhere('agent_name', 'like', '%Mako Real Estate%')
                  ->orWhere('agent_name', 'like', '%Shafi Core%')
                  ->orWhere('agent_name', 'like', '%FA Advisory 3%');
            })
            ->delete();

        // Also delete any channels where user_id does not exist in users table
        if (Schema::hasColumn('whatsapp_channels', 'user_id')) {
            $validUserIds = DB::table('users')->pluck('id')->toArray();
            DB::table('whatsapp_channels')
                ->whereNotNull('user_id')
                ->whereNotIn('user_id', $validUserIds)
                ->delete();
        }

        // 2. Reset ALL remaining channels to 'disconnected' and clear fake phone/session timestamps
        // Users will scan and mirror their own phones authentically
        DB::table('whatsapp_channels')->update([
            'status' => 'disconnected',
            'phone_number' => null,
            'qr_code' => null,
            'connected_at' => null,
            'last_sync_at' => null,
        ]);

        // 3. Ensure every authentic CRM user has an initialized disconnected channel mapped 1:1
        $users = DB::table('users')->get();
        foreach ($users as $u) {
            $exists = DB::table('whatsapp_channels')->where('user_id', $u->id)->exists();
            if (!$exists) {
                DB::table('whatsapp_channels')->insert([
                    'user_id' => $u->id,
                    'session_name' => $u->name,
                    'agent_name' => $u->name,
                    'agent_extension' => substr($u->phone ?? '', -4) ?: '1000',
                    'phone_number' => null,
                    'status' => 'disconnected',
                    'platform' => 'WhatsApp Multi-Device',
                    'battery_level' => 100,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('whatsapp_channels')->where('user_id', $u->id)->update([
                    'session_name' => $u->name,
                    'agent_name' => $u->name,
                    'status' => 'disconnected',
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Irreversible data cleanup for legacy placeholders
    }
};
