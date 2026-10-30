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
        // 1. Add category column to owner_records table
        Schema::table('owner_records', function (Blueprint $table) {
            if (!Schema::hasColumn('owner_records', 'category')) {
                $table->string('category')->nullable()->default('Business Executives')->index()->after('owner_name');
            }
        });

        // 2. Create owner_categories table for dynamic & future category expansion
        if (!Schema::hasTable('owner_categories')) {
            Schema::create('owner_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->string('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->timestamps();
            });

            // Seed default category: Business Executives
            DB::table('owner_categories')->insertOrIgnore([
                'name' => 'Business Executives',
                'description' => 'Business executives and corporate property owners',
                'is_active' => true,
                'sort_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('owner_records', function (Blueprint $table) {
            if (Schema::hasColumn('owner_records', 'category')) {
                $table->dropColumn('category');
            }
        });

        Schema::dropIfExists('owner_categories');
    }
};
