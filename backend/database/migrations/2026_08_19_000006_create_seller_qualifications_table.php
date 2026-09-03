<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained('opportunities')->onDelete('cascade');
            $table->string('community')->nullable();
            $table->string('building_name')->nullable();
            $table->string('unit_number')->nullable();
            $table->unsignedInteger('built_up_area_sqft')->nullable();
            $table->unsignedBigInteger('listing_price')->nullable();
            $table->unsignedBigInteger('cma_estimated_value')->nullable();
            $table->string('mortgage_status')->default('clear'); // clear, mortgaged
            $table->string('occupancy_status')->default('vacant'); // vacant, tenanted
            $table->date('tenancy_expiry_date')->nullable();
            $table->boolean('documents_verified')->default(false);
            $table->text('seller_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_qualifications');
    }
};
