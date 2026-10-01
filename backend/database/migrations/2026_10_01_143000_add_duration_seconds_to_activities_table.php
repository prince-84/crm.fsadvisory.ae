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
        if (Schema::hasTable('activities') && !Schema::hasColumn('activities', 'duration_seconds')) {
            Schema::table('activities', function (Blueprint $table) {
                $table->unsignedInteger('duration_seconds')->nullable()->after('call_outcome');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('activities') && Schema::hasColumn('activities', 'duration_seconds')) {
            Schema::table('activities', function (Blueprint $table) {
                $table->dropColumn('duration_seconds');
            });
        }
    }
};
