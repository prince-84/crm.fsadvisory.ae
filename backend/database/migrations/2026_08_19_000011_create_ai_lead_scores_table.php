<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_lead_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained('opportunities')->onDelete('cascade');
            $table->string('intent_rating')->default('high'); // high, medium, low
            $table->integer('purchase_probability_pct')->default(85);
            $table->text('ai_recommendation')->nullable();
            $table->text('key_signals')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_lead_scores');
    }
};
