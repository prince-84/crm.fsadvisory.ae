<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsAppChat extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_chats';

    protected $fillable = [
        'channel_id',
        'contact_id',
        'remote_jid',
        'phone',
        'contact_name',
        'last_message',
        'last_message_at',
        'unread_count',
        'is_pinned',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'unread_count' => 'integer',
        'is_pinned' => 'boolean',
    ];

    public function channel()
    {
        return $this->belongsTo(WhatsAppChannel::class, 'channel_id');
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class, 'contact_id');
    }

    public function messages()
    {
        return $this->hasMany(WhatsAppMessage::class, 'chat_id')->orderBy('timestamp', 'asc');
    }
}
