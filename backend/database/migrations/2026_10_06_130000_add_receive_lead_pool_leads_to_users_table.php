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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'receive_lead_pool_leads')) {
                $table->boolean('receive_lead_pool_leads')->default(true)->after('in_distribution_pool');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'receive_lead_pool_leads')) {
                $table->dropColumn('receive_lead_pool_leads');
            }
        });
    }
};
