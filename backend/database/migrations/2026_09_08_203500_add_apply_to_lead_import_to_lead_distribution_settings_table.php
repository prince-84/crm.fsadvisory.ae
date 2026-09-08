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
        Schema::table('lead_distribution_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('lead_distribution_settings', 'apply_to_lead_import')) {
                $table->boolean('apply_to_lead_import')->default(true)->after('apply_to_lead_pool');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_distribution_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('lead_distribution_settings', 'apply_to_lead_import')) {
                $table->dropColumn('apply_to_lead_import');
            }
        });
    }
};
