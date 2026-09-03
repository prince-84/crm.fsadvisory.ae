<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landlord_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained('opportunities')->onDelete('cascade');
            $table->string('community')->nullable();
            $table->unsignedBigInteger('expected_annual_rent')->nullable();
            $table->string('payment_cheques_pref')->default('4_cheques'); // 1_cheque, 2_cheques, 4_cheques
            $table->string('furnishing_status')->default('unfurnished'); // furnished, unfurnished, semi_furnished
            $table->string('management_type')->default('exclusive'); // exclusive, non_exclusive
            $table->text('landlord_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landlord_qualifications');
    }
};
