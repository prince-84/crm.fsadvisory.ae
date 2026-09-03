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
        // 1. Settings Table
        if (!Schema::hasTable('lead_distribution_settings')) {
            Schema::create('lead_distribution_settings', function (Blueprint $table) {
                $table->id();
                $table->boolean('is_enabled')->default(true);
                $table->string('distribution_mode')->default('round_robin'); // 'round_robin', 'load_balanced', 'weighted'
                $table->boolean('apply_to_lead_pool')->default(true);
                $table->boolean('apply_to_owner_data')->default(true);
                $table->unsignedBigInteger('last_assigned_user_id')->nullable();
                $table->string('fallback_user_name')->default('Faraz Shafi');
                $table->integer('max_daily_leads_per_agent')->default(20);
                $table->timestamps();
            });
        }

        // 2. Add Distribution columns to users table
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'in_distribution_pool')) {
                $table->boolean('in_distribution_pool')->default(true)->after('is_active');
            }
            if (!Schema::hasColumn('users', 'distribution_weight')) {
                $table->integer('distribution_weight')->default(1)->after('in_distribution_pool');
            }
            if (!Schema::hasColumn('users', 'daily_lead_cap')) {
                $table->integer('daily_lead_cap')->default(20)->after('distribution_weight');
            }
            if (!Schema::hasColumn('users', 'today_assigned_count')) {
                $table->integer('today_assigned_count')->default(0)->after('daily_lead_cap');
            }
            if (!Schema::hasColumn('users', 'last_assigned_at')) {
                $table->timestamp('last_assigned_at')->nullable()->after('today_assigned_count');
            }
        });

        // 3. Distribution Logs Table
        if (!Schema::hasTable('lead_distribution_logs')) {
            Schema::create('lead_distribution_logs', function (Blueprint $table) {
                $table->id();
                $table->string('lead_type')->default('lead_pool'); // 'lead_pool', 'owner_data'
                $table->unsignedBigInteger('record_id')->nullable();
                $table->string('record_name')->nullable();
                $table->unsignedBigInteger('assigned_to_user_id')->nullable();
                $table->string('assigned_to_user_name');
                $table->string('strategy_used')->default('round_robin');
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lead_distribution_logs');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'in_distribution_pool',
                'distribution_weight',
                'daily_lead_cap',
                'today_assigned_count',
                'last_assigned_at',
            ]);
        });

        Schema::dropIfExists('lead_distribution_settings');
    }
};
