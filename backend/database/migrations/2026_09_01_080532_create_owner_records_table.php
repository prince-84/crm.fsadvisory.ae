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
        Schema::create('owner_records', function (Blueprint $table) {
            $table->id();
            
            // 1. Property Name
            $table->string('property_name')->nullable()->index();
            
            // 2. Area
            $table->string('area')->nullable()->index();
            
            // 3. Property Number
            $table->string('property_number')->nullable()->index();
            
            // 4. Building Name
            $table->string('building_name')->nullable()->index();
            
            // 5. No. of Bedrooms
            $table->string('bedrooms')->nullable()->index();
            
            // 6. Property Types
            $table->string('property_type')->nullable()->index();
            
            // 7. Owner Name
            $table->string('owner_name')->index();
            
            // 8. Phone Number
            $table->string('phone_number')->nullable()->index();
            
            // 9. Mobile Number
            $table->string('mobile_number')->nullable()->index();
            
            // 10. Email
            $table->string('email')->nullable()->index();
            
            // Additional CRM metadata
            $table->string('status')->default('active')->index(); // 'active', 'contacted', 'unresponsive', 'deal_closed'
            $table->text('notes')->nullable();
            $table->string('assigned_to')->nullable()->index();
            
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('owner_records');
    }
};
