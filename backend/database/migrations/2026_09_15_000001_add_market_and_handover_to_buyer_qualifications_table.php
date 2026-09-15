<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('buyer_qualifications', function (Blueprint $table) {
            if (!Schema::hasColumn('buyer_qualifications', 'market')) {
                $table->string('market')->nullable()->after('property_type'); // Offplan, Secondary
            }
            if (!Schema::hasColumn('buyer_qualifications', 'handover_year')) {
                $table->string('handover_year')->nullable()->after('market'); // e.g. 2024, 2025, Ready
            }
        });
    }

    public function down(): void
    {
        Schema::table('buyer_qualifications', function (Blueprint $table) {
            if (Schema::hasColumn('buyer_qualifications', 'market')) {
                $table->dropColumn('market');
            }
            if (Schema::hasColumn('buyer_qualifications', 'handover_year')) {
                $table->dropColumn('handover_year');
            }
        });
    }
};
