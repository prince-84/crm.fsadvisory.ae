<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('lead_distribution_settings')) {
            Schema::table('lead_distribution_settings', function (Blueprint $table) {
                if (!Schema::hasColumn('lead_distribution_settings', 'inactivity_reassign_days')) {
                    $table->integer('inactivity_reassign_days')->default(3)->after('max_daily_leads_per_agent');
                }
                if (!Schema::hasColumn('lead_distribution_settings', 'recycle_to_pool_days')) {
                    $table->integer('recycle_to_pool_days')->default(45)->after('inactivity_reassign_days');
                }
                if (!Schema::hasColumn('lead_distribution_settings', 'auto_reassign_idle_leads')) {
                    $table->boolean('auto_reassign_idle_leads')->default(true)->after('recycle_to_pool_days');
                }
                if (!Schema::hasColumn('lead_distribution_settings', 'auto_recycle_dormant_leads')) {
                    $table->boolean('auto_recycle_dormant_leads')->default(true)->after('auto_reassign_idle_leads');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('lead_distribution_settings')) {
            Schema::table('lead_distribution_settings', function (Blueprint $table) {
                $columns = ['inactivity_reassign_days', 'recycle_to_pool_days', 'auto_reassign_idle_leads', 'auto_recycle_dormant_leads'];
                foreach ($columns as $col) {
                    if (Schema::hasColumn('lead_distribution_settings', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
