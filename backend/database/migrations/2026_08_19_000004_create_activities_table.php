<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_id')->constrained('contacts')->onDelete('cascade');
            $table->foreignId('opportunity_id')->nullable()->constrained('opportunities')->onDelete('cascade');
            $table->string('user_name')->default('Mako');
            $table->string('type')->default('call'); // call, whatsapp, email, note, task, stage_change, handover
            $table->string('call_outcome')->nullable();
            $table->text('description');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
