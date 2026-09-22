<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            if (!Schema::hasColumn('contacts', 'lead_type')) {
                $table->string('lead_type', 50)->nullable()->default('Organic')->after('source');
            }
        });

        // Auto-heal existing contacts: mark Meta/Facebook/Google Ads/Paid leads as 'Paid'
        try {
            DB::table('contacts')
                ->where(function ($q) {
                    $q->where('source', 'like', '%Meta%')
                      ->orWhere('source', 'like', '%Facebook%')
                      ->orWhere('source', 'like', '%Google Ads%')
                      ->orWhere('source', 'like', '%TikTok%')
                      ->orWhere('source', 'like', '%Paid%')
                      ->orWhere('utm_medium', 'like', '%cpc%')
                      ->orWhere('utm_medium', 'like', '%paid%')
                      ->orWhere('utm_source', 'like', '%fb%')
                      ->orWhere('utm_source', 'like', '%meta%')
                      ->orWhere('utm_source', 'like', '%ad%');
                })
                ->update(['lead_type' => 'Paid']);
        } catch (\Throwable $e) {
            // Silently continue if table is empty or error occurs
        }
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            if (Schema::hasColumn('contacts', 'lead_type')) {
                $table->dropColumn('lead_type');
            }
        });
    }
};
