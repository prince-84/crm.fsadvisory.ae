<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('opportunities')
            ->whereIn('stage', ['contacted', 'new', 'new_inquiry'])
            ->update(['stage' => 'qualified']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Preserved as qualified
    }
};
