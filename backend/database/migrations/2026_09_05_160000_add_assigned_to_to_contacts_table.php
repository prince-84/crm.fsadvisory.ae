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
        Schema::table('contacts', function (Blueprint $table) {
            if (!Schema::hasColumn('contacts', 'assigned_to')) {
                $table->string('assigned_to')->nullable()->index()->after('source');
            }
            if (!Schema::hasColumn('contacts', 'assigned_at')) {
                $table->timestamp('assigned_at')->nullable()->after('assigned_to');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            if (Schema::hasColumn('contacts', 'assigned_at')) {
                $table->dropColumn('assigned_at');
            }
            if (Schema::hasColumn('contacts', 'assigned_to')) {
                $table->dropColumn('assigned_to');
            }
        });
    }
};
