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
        // 1. WhatsApp Channels (Connected / Paired Devices)
        Schema::create('whatsapp_channels', function (Blueprint $table) {
            $table->id();
            $table->string('session_name'); // e.g. "Agency Owner Main", "Mako Ext 1030"
            $table->string('agent_name')->nullable();
            $table->string('agent_extension')->nullable();
            $table->string('phone_number')->nullable();
            $table->text('qr_code')->nullable(); // QR pairing payload
            $table->enum('status', ['qr_ready', 'connecting', 'connected', 'disconnected'])->default('qr_ready');
            $table->string('platform')->nullable()->default('WhatsApp Multi-Device'); // e.g. "iOS", "Android", "Web"
            $table->integer('battery_level')->nullable()->default(95);
            $table->timestamp('connected_at')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamps();
        });

        // 2. WhatsApp Chats (Conversations linked to Contacts/Leads)
        Schema::create('whatsapp_chats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained('whatsapp_channels')->onDelete('cascade');
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->onDelete('set null');
            $table->string('remote_jid'); // e.g. "971501234567@s.whatsapp.net"
            $table->string('phone');
            $table->string('contact_name')->nullable();
            $table->text('last_message')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->integer('unread_count')->default(0);
            $table->boolean('is_pinned')->default(false);
            $table->timestamps();
        });

        // 3. WhatsApp Messages (Full message history)
        Schema::create('whatsapp_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chat_id')->constrained('whatsapp_chats')->onDelete('cascade');
            $table->string('message_id')->nullable(); // WhatsApp UUID
            $table->boolean('from_me')->default(false); // true if sent by agent, false if received from client
            $table->string('sender_name')->nullable();
            $table->text('text')->nullable();
            $table->string('media_url')->nullable();
            $table->enum('media_type', ['text', 'image', 'document', 'audio', 'video', 'location'])->default('text');
            $table->enum('status', ['pending', 'sent', 'delivered', 'read'])->default('sent');
            $table->timestamp('timestamp')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whatsapp_messages');
        Schema::dropIfExists('whatsapp_chats');
        Schema::dropIfExists('whatsapp_channels');
    }
};
