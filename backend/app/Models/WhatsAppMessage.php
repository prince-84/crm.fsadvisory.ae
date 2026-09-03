<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsAppMessage extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_messages';

    protected $fillable = [
        'chat_id',
        'message_id',
        'from_me',
        'sender_name',
        'text',
        'media_url',
        'media_type',
        'status',
        'timestamp',
    ];

    protected $casts = [
        'from_me' => 'boolean',
        'timestamp' => 'datetime',
    ];

    public function chat()
    {
        return $this->belongsTo(WhatsAppChat::class, 'chat_id');
    }
}
