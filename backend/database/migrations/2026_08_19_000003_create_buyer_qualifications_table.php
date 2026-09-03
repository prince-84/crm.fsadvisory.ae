<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('buyer_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained('opportunities')->onDelete('cascade');
            $table->string('client_intent')->default('end_user'); // investor, end_user
            $table->string('purchase_timeline')->default('1-3 months');
            $table->boolean('is_first_time_buyer')->default(false);
            $table->string('cash_or_finance')->default('finance'); // cash, finance, payment_plan
            $table->string('payment_plan_pref')->nullable();
            $table->string('community')->nullable();
            $table->string('project')->nullable();
            $table->string('developer')->nullable();
            $table->string('property_type')->nullable();
            $table->string('bedrooms')->nullable();
            $table->integer('lead_score')->default(50);
            $table->text('qualification_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('buyer_qualifications');
    }
};
