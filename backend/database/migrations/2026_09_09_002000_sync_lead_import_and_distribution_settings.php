<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Ensure `is_imported` exists in `contacts` table
        if (Schema::hasTable('contacts')) {
            Schema::table('contacts', function (Blueprint $table) {
                if (!Schema::hasColumn('contacts', 'is_imported')) {
                    $table->boolean('is_imported')->default(false)->after('source')->index();
                }
            });
        }

        // 2. Ensure `apply_to_lead_import` exists in `lead_distribution_settings` table
        if (Schema::hasTable('lead_distribution_settings')) {
            Schema::table('lead_distribution_settings', function (Blueprint $table) {
                if (!Schema::hasColumn('lead_distribution_settings', 'apply_to_lead_import')) {
                    $table->boolean('apply_to_lead_import')->default(true)->after('apply_to_lead_pool');
                }
            });

            // 3. Ensure active settings enable lead pool & import auto-distribution
            try {
                DB::table('lead_distribution_settings')
                    ->where('id', 1)
                    ->update([
                        'is_enabled' => true,
                        'apply_to_lead_pool' => true,
                        'apply_to_lead_import' => true,
                        'updated_at' => now(),
                    ]);
            } catch (\Throwable $e) {
                // Ignore if row 1 doesn't exist yet
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('contacts')) {
            Schema::table('contacts', function (Blueprint $table) {
                if (Schema::hasColumn('contacts', 'is_imported')) {
                    $table->dropColumn('is_imported');
                }
            });
        }

        if (Schema::hasTable('lead_distribution_settings')) {
            Schema::table('lead_distribution_settings', function (Blueprint $table) {
                if (Schema::hasColumn('lead_distribution_settings', 'apply_to_lead_import')) {
                    $table->dropColumn('apply_to_lead_import');
                }
            });
        }
    }
};
