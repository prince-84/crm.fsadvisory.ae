<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->onDelete('set null');
            $table->foreignId('opportunity_id')->nullable()->constrained('opportunities')->onDelete('set null');
            $table->string('title');
            $table->string('category')->default('viewing'); // viewing, meeting, spa, valuation
            $table->date('appointment_date');
            $table->string('start_time')->default('10:00 AM');
            $table->string('end_time')->nullable();
            $table->string('client_name');
            $table->string('client_phone');
            $table->string('client_email')->nullable();
            $table->string('agent_name')->default('Faraz Shafi');
            $table->string('location')->nullable();
            $table->string('status')->default('scheduled'); // scheduled, completed, cancelled
            $table->string('priority')->default('normal'); // high, medium, normal
            $table->text('notes')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamps();

            // Indexes for fast date and agent range queries
            $table->index(['appointment_date', 'status']);
            $table->index('agent_name');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
