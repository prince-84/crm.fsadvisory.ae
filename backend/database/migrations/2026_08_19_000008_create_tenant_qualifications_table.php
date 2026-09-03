<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('opportunity_id')->constrained('opportunities')->onDelete('cascade');
            $table->date('move_in_date')->nullable();
            $table->unsignedBigInteger('annual_budget')->nullable();
            $table->integer('max_cheques')->default(4);
            $table->string('preferred_communities')->nullable();
            $table->string('family_or_single')->default('family');
            $table->string('company_or_personal')->default('personal');
            $table->text('tenant_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_qualifications');
    }
};
