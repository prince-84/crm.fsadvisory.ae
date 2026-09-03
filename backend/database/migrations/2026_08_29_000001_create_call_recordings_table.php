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
        Schema::create('call_recordings', function (Blueprint $table) {
            $table->id();
            $table->string('pbx_call_id')->unique(); // e.g. 3CX-REC-20260829-001
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->foreignId('opportunity_id')->nullable()->constrained('opportunities')->nullOnDelete();
            $table->string('agent_name')->default('Faraz Shafi');
            $table->string('agent_extension')->default('101');
            $table->string('caller_number')->nullable();
            $table->string('destination_number')->nullable();
            $table->enum('direction', ['inbound', 'outbound', 'missed'])->default('outbound');
            $table->enum('call_status', ['answered', 'busy', 'no_answer', 'voicemail'])->default('answered');
            $table->integer('duration_seconds')->default(0); // e.g. 185s (3m 05s)
            $table->string('audio_url')->nullable();
            $table->string('audio_format')->default('wav');
            $table->string('call_outcome')->nullable();
            $table->text('notes')->nullable();
            $table->text('ai_summary')->nullable();
            $table->enum('sentiment', ['positive', 'neutral', 'negative'])->default('positive');
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('call_recordings');
    }
};
