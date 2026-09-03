<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsAppChannel extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_channels';

    protected $fillable = [
        'session_name',
        'agent_name',
        'agent_extension',
        'phone_number',
        'qr_code',
        'status',
        'platform',
        'battery_level',
        'connected_at',
        'last_sync_at',
    ];

    protected $casts = [
        'connected_at' => 'datetime',
        'last_sync_at' => 'datetime',
        'battery_level' => 'integer',
    ];

    public function chats()
    {
        return $this->hasMany(WhatsAppChat::class, 'channel_id');
    }
}
