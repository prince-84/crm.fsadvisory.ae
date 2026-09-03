<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('initials')->nullable();
            $table->string('nationality')->default('Emirati');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->string('source')->default('Database');
            $table->string('state')->default('available'); // available, active, reactivation, do_not_contact, duplicate
            $table->timestamp('last_activity_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
