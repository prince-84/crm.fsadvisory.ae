<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portal_integrations', function (Blueprint $table) {
            $table->id();
            $table->string('portal_name'); // property_finder, bayut, dubizzle, google_ads, meta_ads
            $table->string('display_name');
            $table->string('api_key')->nullable();
            $table->string('webhook_secret')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_synced_at')->nullable();
            $table->integer('synced_count')->default(0);
            $table->string('status')->default('active'); // active, paused, error
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_integrations');
    }
};
