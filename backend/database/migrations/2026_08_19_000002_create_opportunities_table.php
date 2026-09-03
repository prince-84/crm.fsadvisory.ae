<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_id')->constrained('contacts')->onDelete('cascade');
            $table->string('opportunity_type')->default('buyer'); // buyer, seller, landlord, tenant
            $table->string('stage')->default('new'); // new, qualification, handover_pending, sales_in_progress, closed_won, closed_lost
            $table->string('temperature')->default('unqualified'); // hot, warm, cold, unqualified
            $table->string('current_owner_name')->default('Mako');
            $table->string('originating_agent_name')->default('Mako');
            $table->string('department')->default('telesales'); // telesales, sales
            $table->unsignedBigInteger('budget_min')->nullable();
            $table->unsignedBigInteger('budget_max')->nullable();
            $table->string('next_action')->nullable();
            $table->dateTime('next_action_due_at')->nullable();
            $table->string('sla_status')->default('on_track'); // on_track, due_soon, overdue
            $table->boolean('is_orphaned')->default(false);
            $table->text('key_requirement')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('opportunities');
    }
};
