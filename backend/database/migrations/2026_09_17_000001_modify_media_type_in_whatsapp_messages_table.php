<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            DB::statement("ALTER TABLE whatsapp_messages MODIFY media_type VARCHAR(50) DEFAULT 'text'");
        } catch (\Exception $e) {
            // Fallback for non-MySQL or already modified
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        try {
            DB::statement("ALTER TABLE whatsapp_messages MODIFY media_type ENUM('text', 'image', 'document', 'audio', 'video', 'location') DEFAULT 'text'");
        } catch (\Exception $e) {}
    }
};
