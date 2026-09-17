<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppChannel;
use App\Models\WhatsAppChat;
use App\Models\WhatsAppMessage;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\Activity;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Str;

class WhatsAppController extends Controller
{
    // The exact 5 3CX Advisors + Agency Owner
    public const DEFAULT_AGENTS = [
        ['name' => 'Agency Owner (Main Account)', 'ext' => 'OWNER', 'phone' => '+971 50 123 4567'],
        ['name' => 'Mako Real Estate', 'ext' => '1030', 'phone' => '+971 52 987 6543'],
        ['name' => 'Shafi Core', 'ext' => '1031', 'phone' => '+971 55 597 7700'],
        ['name' => 'Hiba Alam', 'ext' => '1033', 'phone' => '+971 58 441 2233'],
        ['name' => 'Rayyan', 'ext' => '1034', 'phone' => '+971 56 946 8277'],
        ['name' => 'FA Advisory 3', 'ext' => '1035', 'phone' => '+971 54 330 1035'],
    ];

    /**
     * List all WhatsApp channels / connected devices
     */
    public function channels(Request $request)
    {
        $channels = WhatsAppChannel::withCount('chats')->get();

        if ($channels->isEmpty()) {
            $this->seedInitialChannels();
            $channels = WhatsAppChannel::withCount('chats')->get();
        }

        return response()->json([
            'channels' => $channels,
            'total_connected' => $channels->where('status', 'connected')->count(),
            'total_channels' => $channels->count(),
        ]);
    }

    /**
     * Generate / refresh QR code for mobile device pairing
     */
    public function generateQr(Request $request)
    {
        $channelId = $request->input('channel_id');
        $channel = WhatsAppChannel::find($channelId);

        if (!$channel) {
            $channel = WhatsAppChannel::firstOrCreate(
                ['session_name' => $request->input('session_name', 'Agency Owner Main')],
                [
                    'agent_name' => $request->input('agent_name', 'Agency Owner'),
                    'agent_extension' => $request->input('agent_extension', 'OWNER'),
                    'status' => 'qr_ready',
                ]
            );
        }

        // Attempt to fetch real cryptographic pairing QR from WhatsApp Gateway
        $realQrCode = null;
        $realQrImage = null;
        try {
            $gwRes = \Illuminate\Support\Facades\Http::timeout(3)->get($this->gatewayUrl() . '/api/qr');
            if ($gwRes->successful()) {
                $gwData = $gwRes->json();
                if (!empty($gwData['qr_code'])) {
                    $realQrCode = $gwData['qr_code'];
                }
                if (!empty($gwData['qr_image'])) {
                    $realQrImage = $gwData['qr_image'];
                }
            }
        } catch (\Exception $e) {
            // Gateway not running or connecting
        }

        // Use authentic WhatsApp pairing code if gateway is running, else fallback to dynamic string
        $qrPayload = $realQrCode ?? ('2@' . Str::random(44) . ',' . Str::random(32) . ',' . time() . ',1');

        $channel->update([
            'qr_code' => $qrPayload,
            'status' => 'qr_ready',
            'last_sync_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'channel' => $channel,
            'qr_code' => $qrPayload,
            'qr_image' => $realQrImage,
            'is_real' => !empty($realQrCode) || !empty($realQrImage),
            'expires_in' => 45, // seconds
            'instructions' => [
                '1. Open WhatsApp on your mobile phone',
                '2. Tap Menu or Settings and select Linked Devices',
                '3. Tap "Link a Device"',
                '4. Point your phone camera at this QR code to mirror your chats'
            ]
        ]);
    }

    /**
     * Confirm / Simulate QR scan & Device Pairing
     */
    public function pairConfirm(Request $request, $id)
    {
        $channel = WhatsAppChannel::findOrFail($id);

        $phone = $request->input('phone_number') ?? $channel->phone_number ?? ('+971 50 ' . rand(100, 999) . ' ' . rand(1000, 9999));
        $platform = $request->input('platform', rand(0, 1) ? 'iOS (iPhone 16 Pro)' : 'Android (Galaxy S24 Ultra)');

        $channel->update([
            'status' => 'connected',
            'phone_number' => $phone,
            'platform' => $platform,
            'battery_level' => rand(82, 98),
            'qr_code' => null,
            'connected_at' => now(),
            'last_sync_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "WhatsApp device successfully paired and mirrored for {$channel->agent_name}!",
            'channel' => $channel->fresh(['chats']),
        ]);
    }

    /**
     * Disconnect / Logout WhatsApp device
     */
    public function disconnect(Request $request, $id)
    {
        $channel = WhatsAppChannel::findOrFail($id);
        $channel->update([
            'status' => 'disconnected',
            'qr_code' => null,
            'connected_at' => null,
            'last_sync_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "WhatsApp device disconnected for {$channel->agent_name}.",
            'channel' => $channel,
        ]);
    }

    private function gatewayUrl(): string
    {
        return rtrim(env('WHATSAPP_GATEWAY_URL', 'http://127.0.0.1:5003'), '/');
    }

    /**
     * Proxy WhatsApp Gateway status for secure HTTPS clients (Vercel)
     */
    public function gatewayStatus()
    {
        try {
            $res = \Illuminate\Support\Facades\Http::timeout(3)->get($this->gatewayUrl() . '/api/status');
            return response()->json($res->json(), $res->status());
        } catch (\Exception $e) {
            return response()->json(['status' => 'disconnected', 'user' => null, 'has_qr' => false], 200);
        }
    }

    /**
     * Proxy WhatsApp Gateway QR image for secure HTTPS clients (Vercel)
     */
    public function gatewayQr()
    {
        try {
            $res = \Illuminate\Support\Facades\Http::timeout(5)->get($this->gatewayUrl() . '/api/qr');
            return response()->json($res->json(), $res->status());
        } catch (\Exception $e) {
            return response()->json(['status' => 'disconnected', 'qr_image' => null], 200);
        }
    }

    /**
     * Proxy WhatsApp Gateway chat sync trigger
     */
    public function gatewaySync()
    {
        try {
            $res = \Illuminate\Support\Facades\Http::timeout(15)->post($this->gatewayUrl() . '/api/sync');
            return response()->json($res->json(), $res->status());
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 200);
        }
    }

    /**
     * Ingest batch of contacts & chats directly from user's connected mobile phone
     */
    public function syncPhoneData(Request $request)
    {
        $channelId = $request->input('channel_id', 1);
        $chats = $request->input('chats', []);
        $contacts = $request->input('contacts', []);

        \Log::info("WhatsApp syncing " . count($chats) . " chats from mobile gateway");

        // When real mobile chats arrive, immediately purge initial demo seed chats
        $this->purgeSeedChats();

        // Ensure the channel is marked connected
        $channel = WhatsAppChannel::find($channelId);
        if ($channel) {
            $channel->update([
                'status' => 'connected',
                'last_sync_at' => now(),
            ]);
        }

        // Load persistent LID→Phone map from gateway if present
        $contactsMapPath = 'D:\\FSadvisory-crm\\whatsapp-gateway\\contacts_map.json';
        $lidPhoneMap = [];
        $lidNameMap = [];
        if (file_exists($contactsMapPath)) {
            try {
                $mapData = json_decode(file_get_contents($contactsMapPath), true);
                $lidPhoneMap = $mapData['phoneMap'] ?? [];
                $lidNameMap = $mapData['nameMap'] ?? [];
            } catch (\Exception $e) {}
        }

        // Build name map from the contacts in this batch
        $contactNames = [];
        foreach ($contacts as $c) {
            $jid = $c['id'] ?? '';
            $name = $c['name'] ?? $c['notify'] ?? $c['verifiedName'] ?? '';
            if ($jid && $name) {
                $contactNames[$jid] = $name;
            }
        }

        $imported = 0;
        foreach ($chats as $chatData) {
            $rawJid = $chatData['id'] ?? '';
            // Skip broadcast, status channels, newsletters and group chats
            if (str_contains($rawJid, 'status@broadcast') || str_contains($rawJid, 'newsletter') || str_contains($rawJid, '@g.us')) {
                continue;
            }

            // Resolve phone number
            $resolvedPhone = null;

            if (!empty($chatData['phone'])) {
                $resolvedPhone = preg_replace('/[^0-9]/', '', $chatData['phone']);
            } elseif (str_contains($rawJid, '@c.us') || str_contains($rawJid, '@s.whatsapp.net')) {
                $resolvedPhone = preg_replace('/[^0-9]/', '', explode('@', $rawJid)[0] ?? '');
            } elseif (str_contains($rawJid, '@lid')) {
                $cleanLid = str_replace('@lid', '', $rawJid);
                $resolvedPhone = $lidPhoneMap[$rawJid] ?? $lidPhoneMap[$cleanLid] ?? null;
            }

            // Fallback: Check if formattedTitle or name has phone digits
            if (empty($resolvedPhone)) {
                $titleCandidate = $chatData['formattedTitle'] ?? ($chatData['name'] ?? '');
                $extracted = preg_replace('/[^0-9]/', '', $titleCandidate);
                if (strlen($extracted) >= 9) {
                    $resolvedPhone = $extracted;
                }
            }

            // Fallback: Use numeric user portion of rawJid
            if (empty($resolvedPhone)) {
                $userPart = explode('@', $rawJid)[0] ?? '';
                $extracted = preg_replace('/[^0-9]/', '', $userPart);
                if (!empty($extracted)) {
                    $resolvedPhone = $extracted;
                }
            }

            if (empty($resolvedPhone)) continue;

            // Resolve display name
            $savedName = $chatData['name'] 
                ?? ($chatData['formattedTitle'] ?? null)
                ?? ($contactNames[$rawJid] ?? null)
                ?? ($lidNameMap[$rawJid] ?? null)
                ?? ($lidNameMap[str_replace('@lid', '', $rawJid)] ?? null);

            if (empty($savedName) || $savedName === $rawJid) {
                $savedName = '+' . $resolvedPhone;
            }

            $last7 = substr($resolvedPhone, -7);
            $crmContact = null;
            if ($last7) {
                $crmContact = Contact::where('phone', 'like', "%{$last7}%")
                    ->orWhere('secondary_phone', 'like', "%{$last7}%")
                    ->first();
            }

            $lastMsg = $chatData['last_message'] ?? ($chatData['conversation'] ?? 'Active chat');
            $timestamp = isset($chatData['timestamp']) && $chatData['timestamp'] > 0
                ? Carbon::createFromTimestamp($chatData['timestamp'])
                : now();

            $chat = WhatsAppChat::updateOrCreate(
                [
                    'channel_id' => $channelId,
                    'phone' => '+' . $resolvedPhone,
                ],
                [
                    'contact_id' => $crmContact ? $crmContact->id : null,
                    'remote_jid' => $rawJid,
                    'contact_name' => $crmContact ? $crmContact->name : $savedName,
                    'last_message' => $lastMsg,
                    'last_message_at' => $timestamp,
                    'unread_count' => intval($chatData['unread_count'] ?? 0),
                ]
            );

            // Ingest recent messages array if provided from browser session
            if (!empty($chatData['messages']) && is_array($chatData['messages'])) {
                foreach ($chatData['messages'] as $m) {
                    $mId = $m['id'] ?? ('WA-HIST-' . Str::random(12));
                    $mText = $m['text'] ?? '';
                    if (empty($mText)) continue;

                    $mTs = isset($m['timestamp']) && $m['timestamp'] > 0
                        ? Carbon::createFromTimestamp($m['timestamp'])
                        : $timestamp;

                    WhatsAppMessage::updateOrCreate(
                        ['message_id' => $mId],
                        [
                            'chat_id' => $chat->id,
                            'from_me' => !empty($m['from_me']),
                            'sender_name' => !empty($m['from_me']) ? 'You' : $chat->contact_name,
                            'text' => $mText,
                            'media_type' => $m['media_type'] ?? 'text',
                            'status' => $m['status'] ?? (!empty($m['from_me']) ? 'sent' : 'read'),
                            'timestamp' => $mTs,
                        ]
                    );
                }
            } elseif ($chat->messages()->count() === 0) {
                // Add initial message if none exists
                WhatsAppMessage::create([
                    'chat_id' => $chat->id,
                    'message_id' => 'WA-SYNC-' . Str::random(10),
                    'from_me' => false,
                    'sender_name' => $chat->contact_name,
                    'text' => $lastMsg,
                    'status' => 'read',
                    'timestamp' => $timestamp,
                ]);
            }

            $imported++;
        }

        return response()->json([
            'success' => true,
            'imported_chats' => $imported,
            'message' => "Successfully synced {$imported} real mobile chats into CRM!",
        ]);
    }

    /**
     * Purge dummy initial seed chats
     */
    public function purgeSeedChats()
    {
        $dummyPhones = [
            '+971585686896', '971585686896',
            '+971566511814', '971566511814',
            '+971506672802', '971506672802',
            '+971585951314', '971585951314',
            '+971501612912', '971501612912',
            '+971 52 987 6543', '+971 55 597 7700', '+971 58 441 2233', '+971 56 946 8277'
        ];

        $deleted = WhatsAppChat::whereIn('phone', $dummyPhones)
            ->orWhere('contact_name', 'like', '%Property Finder%')
            ->orWhere('contact_name', 'Nitin devnani')
            ->orWhere('contact_name', 'Sarah Jenkins')
            ->orWhere('contact_name', 'Fahad Al Otaibi')
            ->orWhere('contact_name', 'Jean-Pierre Dupont')
            ->orWhere('contact_name', 'Elena Rostova')
            ->delete();

        return response()->json([
            'success' => true,
            'deleted' => $deleted,
            'message' => "Purged {$deleted} dummy demo chats.",
        ]);
    }

    /**
     * List all mirrored chats with search & filtering
     */
    public function chats(Request $request)
    {
        $query = WhatsAppChat::with([
            'channel',
            'contact.opportunity.buyerQualification',
            'messages' => function ($q) {
                $q->latest('timestamp')->limit(1);
            }
        ]);

        if ($request->has('channel_id') && $request->channel_id !== 'all') {
            $query->where('channel_id', $request->channel_id);
        }

        if ($request->has('unread_only') && $request->unread_only == 'true') {
            $query->where('unread_count', '>', 0);
        }

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('contact_name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('last_message', 'like', "%{$search}%")
                  ->orWhereHas('contact', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%");
                  });
            });
        }

        $chats = $query->orderBy('is_pinned', 'desc')
                      ->orderBy('last_message_at', 'desc')
                      ->take(250)
                      ->get();

        $totalUnread = WhatsAppChat::sum('unread_count');

        return response()->json([
            'chats' => $chats,
            'total_unread' => $totalUnread,
            'total_chats' => $chats->count(),
        ]);
    }

    /**
     * Get message history for a specific chat
     */
    public function getChatMessages(Request $request, $id)
    {
        $chat = WhatsAppChat::with(['channel', 'contact.opportunity'])->findOrFail($id);

        if (empty($chat->avatar_url)) {
            $chat->update(['avatar_url' => 'none']);
        }

        // Mark unread messages as read
        if ($chat->unread_count > 0) {
            $chat->update(['unread_count' => 0]);
            WhatsAppMessage::where('chat_id', $chat->id)
                ->where('from_me', false)
                ->where('status', '!=', 'read')
                ->update(['status' => 'read']);
        }

        $messages = WhatsAppMessage::where('chat_id', $chat->id)
            ->orderBy('timestamp', 'asc')
            ->get();

        return response()->json([
            'chat' => $chat,
            'messages' => $messages,
        ]);
    }

    /**
     * Send message to a client through the mirrored WhatsApp session
     */
    public function sendMessage(Request $request, $id)
    {
        try {
            $request->validate([
                'text' => 'nullable|string',
                'media_url' => 'nullable|string',
                'media_type' => 'nullable|string',
                'media_base64' => 'nullable|string',
            ]);

            $chat = WhatsAppChat::with('channel', 'contact')->findOrFail($id);
            $channel = $chat->channel;

            $mediaBase64 = $request->input('media_base64') ?: ($request->input('media_type') === 'audio' ? $request->input('media_url') : null);
            $mediaUrl = $request->input('media_url');
            $mediaType = $request->input('media_type', 'text');
            $originalFilename = $request->input('filename');
            $caption = $request->input('text');
            $msgText = $caption ?: ($mediaType === 'image' ? '📷 Photo' : ($mediaType === 'audio' ? '🎤 Voice Message' : ($originalFilename ? "📄 {$originalFilename}" : 'Attachment')));

            // Process and store media attachments (images, PDFs, documents, audio)
            if ($mediaBase64 && str_contains($mediaBase64, ';base64,')) {
                try {
                    $dir = public_path('storage/whatsapp_media');
                    if (!file_exists($dir)) {
                        mkdir($dir, 0777, true);
                    }
                    $parts = explode(';base64,', $mediaBase64);
                    $mime = str_replace('data:', '', $parts[0]);
                    $rawBinary = base64_decode($parts[1]);

                    $ext = 'bin';
                    if (str_contains($mime, 'pdf')) $ext = 'pdf';
                    elseif (str_contains($mime, 'jpeg') || str_contains($mime, 'jpg')) $ext = 'jpg';
                    elseif (str_contains($mime, 'png')) $ext = 'png';
                    elseif (str_contains($mime, 'webp')) $ext = 'webp';
                    elseif (str_contains($mime, 'word') || str_contains($mime, 'doc')) $ext = 'docx';
                    elseif (str_contains($mime, 'sheet') || str_contains($mime, 'xls')) $ext = 'xlsx';
                    elseif (str_contains($mime, 'webm')) $ext = 'webm';
                    elseif (str_contains($mime, 'mp3')) $ext = 'mp3';
                    elseif (str_contains($mime, 'ogg')) $ext = 'ogg';

                    $safeName = $originalFilename ? preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $originalFilename) : ('media_' . time() . '_' . Str::random(6) . '.' . $ext);
                    $savedPath = $dir . '/' . time() . '_' . $safeName;
                    file_put_contents($savedPath, $rawBinary);

                    $mediaUrl = url('storage/whatsapp_media/' . basename($savedPath));
                } catch (\Exception $e) {
                    \Log::warning('Media file save warning: ' . $e->getMessage());
                    $mediaUrl = $mediaBase64;
                }
            }

            $message = WhatsAppMessage::create([
                'chat_id' => $chat->id,
                'message_id' => 'WA-' . strtoupper(Str::random(12)),
                'from_me' => true,
                'sender_name' => $channel->agent_name ?? 'Advisor',
                'text' => $msgText,
                'media_url' => $mediaUrl,
                'media_type' => $mediaType,
                'status' => 'sent',
                'timestamp' => now(),
            ]);

            $chat->update([
                'last_message' => $msgText,
                'last_message_at' => now(),
            ]);

            // Transmit out over real WhatsApp Gateway
            try {
                $gwRes = \Illuminate\Support\Facades\Http::timeout(15)->post($this->gatewayUrl() . '/api/send', [
                    'phone' => $chat->phone,
                    'jid' => $chat->remote_jid,
                    'text' => $caption ?: '',
                    'media_base64' => $mediaBase64,
                    'media_type' => $mediaType,
                    'filename' => $originalFilename ?: 'attachment',
                    'is_voice' => ($mediaType === 'audio'),
                ]);
                if ($gwRes->successful()) {
                    $gwData = $gwRes->json();
                    $updates = [];
                    if (!empty($gwData['messageId'])) {
                        $updates['message_id'] = $gwData['messageId'];
                    }
                    if (!empty($gwData['status'])) {
                        $updates['status'] = $gwData['status'];
                    }
                    if (!empty($updates)) {
                        $message->update($updates);
                    }
                }
            } catch (\Exception $e) {
                \Log::error('WhatsApp gateway send error: ' . $e->getMessage());
            }

            // Link with CRM Activity timeline if contact is linked
            if ($chat->contact) {
                Activity::create([
                    'contact_id' => $chat->contact->id,
                    'opportunity_id' => $chat->contact->opportunity?->id ?? null,
                    'user_name' => $channel->agent_name ?? 'Advisor',
                    'type' => 'whatsapp',
                    'call_outcome' => 'WhatsApp Outbound',
                    'description' => "WhatsApp Message Sent: {$msgText}",
                ]);
                $chat->contact->update(['last_activity_at' => now()]);
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'chat' => $chat->fresh(),
            ]);
        } catch (\Exception $e) {
            \Log::error('SendMessage exception: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update chat contact info / phone number / link with CRM contact
     */
    public function updateContactInfo(Request $request, $id)
    {
        $chat = WhatsAppChat::findOrFail($id);

        $updates = [];
        if ($request->has('contact_name') && !empty($request->contact_name)) {
            $updates['contact_name'] = $request->contact_name;
        }

        if ($request->has('phone') && !empty($request->phone)) {
            $updates['phone'] = $request->phone;
        }

        if ($request->has('contact_id')) {
            $updates['contact_id'] = $request->contact_id ?: null;
        }

        $chat->update($updates);

        return response()->json([
            'success' => true,
            'message' => 'Contact details updated successfully!',
            'chat' => $chat->fresh(['channel', 'contact.opportunity']),
        ]);
    }

    /**
     * Simulate incoming client message (for live demo / testing)
     */
    public function simulateIncoming(Request $request, $id)
    {
        $chat = WhatsAppChat::with('contact')->findOrFail($id);

        $sampleReplies = [
            "Hi, thanks for the brochure! Can we arrange a site viewing for the 3BR Villa in Damac Lagoons this Saturday at 11 AM?",
            "Yes, my budget is AED 4.5M cash. What is the expected handover date?",
            "Please send me the Form F SPA contract details over WhatsApp.",
            "Can you share the payment plan breakdown and DLD waiver offer?",
            "I am available for a quick call now, please call my number.",
        ];

        $text = $request->input('text', $sampleReplies[array_rand($sampleReplies)]);

        $msg = WhatsAppMessage::create([
            'chat_id' => $chat->id,
            'message_id' => 'WA-IN-' . strtoupper(Str::random(10)),
            'from_me' => false,
            'sender_name' => $chat->contact_name,
            'text' => $text,
            'media_type' => 'text',
            'status' => 'delivered',
            'timestamp' => now(),
        ]);

        $chat->update([
            'last_message' => $text,
            'last_message_at' => now(),
            'unread_count' => $chat->unread_count + 1,
        ]);

        if ($chat->contact) {
            Activity::create([
                'contact_id' => $chat->contact->id,
                'opportunity_id' => $chat->contact->opportunity?->id ?? null,
                'user_name' => $chat->contact_name,
                'type' => 'whatsapp',
                'call_outcome' => 'WhatsApp Inbound',
                'description' => "WhatsApp Message Received: {$text}",
            ]);
            $chat->contact->update(['last_activity_at' => now()]);
        }

        return response()->json([
            'success' => true,
            'message' => $msg,
            'chat' => $chat->fresh(),
        ]);
    }

    /**
     * Ingest live WhatsApp events / messages from external webhook (Wazzup / Baileys Gateway)
     */
    public function webhook(Request $request)
    {
        $payload = $request->all();
        \Log::info('WhatsApp Webhook Received:', $payload);

        // Handle delivery acks & read receipts from WhatsApp Gateway
        if (($payload['type'] ?? '') === 'ack' || ($payload['event'] ?? '') === 'message_ack' || isset($payload['ack'])) {
            $msgId = $payload['id'] ?? $payload['message_id'] ?? null;
            $newStatus = $payload['status'] ?? 'delivered';
            if ($msgId) {
                $affected = WhatsAppMessage::where('message_id', $msgId)
                    ->orWhere('message_id', 'like', "%{$msgId}%")
                    ->update(['status' => $newStatus]);
                \Log::info("WhatsApp ACK: {$msgId} -> {$newStatus} (affected: {$affected})");
            }
            return response()->json(['success' => true, 'status' => 'ACK_PROCESSED']);
        }

        $remoteJid = $payload['remote_jid'] ?? $payload['from'] ?? null;
        $remotePhone = $payload['phone'] ?? null;
        $messageText = $payload['text'] ?? $payload['body'] ?? $payload['message'] ?? '';
        $pushName = $payload['push_name'] ?? null;
        $channelId = $payload['channel_id'] ?? 1;

        $rawMediaType = $payload['media_type'] ?? 'text';
        $mediaType = in_array($rawMediaType, ['image', 'document', 'audio', 'video', 'location']) ? $rawMediaType : ($rawMediaType === 'ptt' ? 'audio' : 'text');
        $mediaBase64 = $payload['media_base64'] ?? null;
        $mediaUrl = $payload['media_url'] ?? null;

        if (empty($messageText)) {
            if ($mediaType === 'image') $messageText = '📷 Photo';
            elseif ($mediaType === 'document') $messageText = '📄 Document';
            elseif ($mediaType === 'audio') $messageText = '🎤 Voice Note';
            elseif ($mediaType === 'video') $messageText = '🎥 Video';
            elseif (!empty($mediaBase64)) $messageText = 'Attachment';
            else return response()->json(['status' => 'SKIPPED_EMPTY'], 200);
        }

        // Save incoming media base64 if present
        if ($mediaBase64 && str_contains($mediaBase64, ';base64,')) {
            try {
                $dir = public_path('storage/whatsapp_media');
                if (!file_exists($dir)) {
                    mkdir($dir, 0777, true);
                }
                $parts = explode(';base64,', $mediaBase64);
                $mime = str_replace('data:', '', $parts[0]);
                $rawBinary = base64_decode($parts[1]);

                $ext = 'bin';
                if (str_contains($mime, 'pdf')) $ext = 'pdf';
                elseif (str_contains($mime, 'jpeg') || str_contains($mime, 'jpg')) $ext = 'jpg';
                elseif (str_contains($mime, 'png')) $ext = 'png';
                elseif (str_contains($mime, 'webp')) $ext = 'webp';
                elseif (str_contains($mime, 'word') || str_contains($mime, 'doc')) $ext = 'docx';
                elseif (str_contains($mime, 'sheet') || str_contains($mime, 'xls')) $ext = 'xlsx';
                elseif (str_contains($mime, 'webm')) $ext = 'webm';
                elseif (str_contains($mime, 'mp3')) $ext = 'mp3';
                elseif (str_contains($mime, 'ogg')) $ext = 'ogg';

                $origName = $payload['filename'] ?? ('in_' . time() . '_' . Str::random(6) . '.' . $ext);
                $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $origName);
                file_put_contents($dir . '/' . $safeName, $rawBinary);
                $mediaUrl = url('storage/whatsapp_media/' . $safeName);
            } catch (\Exception $e) {
                \Log::warning('Inbound media save warning: ' . $e->getMessage());
            }
        }

        $cleanPhone = $remotePhone ? preg_replace('/[^0-9]/', '', $remotePhone) : '';
        if (!$cleanPhone && $remoteJid && !str_contains($remoteJid, '@lid')) {
            $cleanPhone = preg_replace('/[^0-9]/', '', explode('@', $remoteJid)[0] ?? '');
        }

        // 1. Find existing chat by remote_jid OR phone number
        $chat = null;
        if ($remoteJid) {
            $chat = WhatsAppChat::where('channel_id', $channelId)
                ->where(function ($q) use ($remoteJid, $cleanPhone, $remotePhone) {
                    $q->where('remote_jid', $remoteJid);
                    if ($cleanPhone) {
                        $q->orWhere('phone', "+{$cleanPhone}")
                          ->orWhere('phone', $cleanPhone);
                    }
                    if ($remotePhone) {
                        $q->orWhere('phone', $remotePhone);
                    }
                })->first();
        }

        if (!$chat && $cleanPhone) {
            $chat = WhatsAppChat::where('channel_id', $channelId)
                ->where(function ($q) use ($cleanPhone) {
                    $q->where('phone', "+{$cleanPhone}")
                      ->orWhere('phone', $cleanPhone);
                })->first();
        }

        if (!$chat) {
            $contact = null;
            $last7 = $cleanPhone ? substr($cleanPhone, -7) : null;
            if ($last7 && !str_contains($remoteJid, '@lid')) {
                $contact = Contact::where('phone', 'like', "%{$last7}%")
                    ->orWhere('secondary_phone', 'like', "%{$last7}%")
                    ->first();
            }

            $displayName = $contact ? $contact->name : ($pushName ?: ($cleanPhone ? "+{$cleanPhone}" : ($remoteJid ?: 'WhatsApp Contact')));

            $chat = WhatsAppChat::create([
                'channel_id' => $channelId,
                'phone' => $cleanPhone ? "+{$cleanPhone}" : ($remoteJid ?: '+000000000'),
                'remote_jid' => $remoteJid,
                'contact_id' => $contact ? $contact->id : null,
                'contact_name' => $displayName,
                'last_message' => $messageText,
                'last_message_at' => now(),
                'unread_count' => 0,
            ]);
        }

        if ($pushName && (str_contains($chat->contact_name, 'WhatsApp Client') || str_contains($chat->contact_name, '@lid') || str_contains($chat->contact_name, '+218098'))) {
            $chat->update(['contact_name' => $pushName]);
        }

        $isFromMe = !empty($payload['from_me']);
        $msgId = $payload['id'] ?? ('WA-' . Str::random(12));
        
        // Prevent duplicate outgoing messages sent from CRM UI
        if ($isFromMe) {
            $pendingRecent = WhatsAppMessage::where('chat_id', $chat->id)
                ->where('from_me', true)
                ->where('created_at', '>=', now()->subSeconds(20))
                ->where(function($q) use ($messageText) {
                    $q->where('text', $messageText)
                      ->orWhere('text', 'like', '🎤 Voice%');
                })
                ->latest()
                ->first();

            if ($pendingRecent) {
                $pendingRecent->update([
                    'message_id' => $msgId,
                    'status' => 'delivered',
                ]);
                return response()->json(['status' => 'UPDATED_PENDING_OUTGOING'], 200);
            }
        }

        // Prevent duplicate messages by ID
        $existingMsg = WhatsAppMessage::where('message_id', $msgId)->first();
        if (!$existingMsg) {
            WhatsAppMessage::create([
                'chat_id' => $chat->id,
                'message_id' => $msgId,
                'from_me' => $isFromMe,
                'sender_name' => $isFromMe ? 'You' : ($pushName ?: $chat->contact_name),
                'text' => $messageText,
                'media_url' => $mediaUrl,
                'media_type' => $mediaType,
                'status' => $isFromMe ? 'sent' : 'read',
                'timestamp' => now(),
            ]);
        }

        $chat->update([
            'last_message' => $messageText,
            'last_message_at' => now(),
            'unread_count' => $isFromMe ? 0 : ($chat->unread_count + 1),
        ]);

        return response()->json([
            'success' => true,
            'status' => 'MESSAGE_INGESTED',
            'chat_id' => $chat->id,
        ], 200);
    }

    /**
     * Initial Seed data for channels
     */
    private function seedInitialChannels()
    {
        foreach (self::DEFAULT_AGENTS as $idx => $agent) {
            $isOwner = $agent['ext'] === 'OWNER';
            WhatsAppChannel::create([
                'session_name' => $agent['name'],
                'agent_name' => $agent['name'],
                'agent_extension' => $agent['ext'],
                'phone_number' => $agent['phone'],
                'status' => $isOwner ? 'connected' : ($idx === 1 ? 'connected' : 'qr_ready'),
                'platform' => $isOwner ? 'iOS (iPhone 16 Pro Max)' : 'Android (Samsung Galaxy S24)',
                'battery_level' => rand(78, 98),
                'connected_at' => $isOwner ? now()->subDays(3) : ($idx === 1 ? now()->subDay() : null),
                'last_sync_at' => now(),
            ]);
        }
    }

    /**
     * Seed initial realistic client conversations linked to CRM contacts
     */
    private function seedInitialChats()
    {
        if (WhatsAppChannel::where('status', 'connected')->exists()) {
            return;
        }

        $channel = WhatsAppChannel::first();
        if (!$channel) {
            $this->seedInitialChannels();
            $channel = WhatsAppChannel::first();
        }

        $contacts = Contact::with('opportunity')->take(6)->get();

        $sampleConversations = [
            [
                'phone' => '+971 50 123 4567',
                'name' => 'Alexander Volkov',
                'unread' => 2,
                'mins_ago' => 8,
                'messages' => [
                    ['text' => 'Hello! I saw the listing for the 3BR apartment in Downtown Dubai. Is it still available?', 'from_me' => false, 'mins' => 45],
                    ['text' => 'Good afternoon Mr. Alexander! Yes, the 3BR unit with direct Burj Khalifa views is available. Would you like me to send the official payment plan brochure?', 'from_me' => true, 'mins' => 30],
                    ['text' => 'Yes please, send the brochure and let me know if 80/20 payment plan is applicable.', 'from_me' => false, 'mins' => 8],
                ]
            ],
            [
                'phone' => '+971 52 987 6543',
                'name' => 'Sarah Jenkins',
                'unread' => 0,
                'mins_ago' => 25,
                'messages' => [
                    ['text' => 'Hi, could you arrange a private viewing for the Palm Jumeirah Villa this Saturday?', 'from_me' => false, 'mins' => 90],
                    ['text' => 'Certainly, Sarah! I have booked a VIP viewing slot for Saturday at 4:00 PM. Our luxury concierge will meet you at the main gate.', 'from_me' => true, 'mins' => 25],
                ]
            ],
            [
                'phone' => '+971 55 597 7700',
                'name' => 'Fahad Al Otaibi',
                'unread' => 1,
                'mins_ago' => 50,
                'messages' => [
                    ['text' => 'Assalam o Alaikum, what is the expected gross rental yield for the 1BR off-plan in JVC?', 'from_me' => false, 'mins' => 50],
                ]
            ],
            [
                'phone' => '+971 58 441 2233',
                'name' => 'Jean-Pierre Dupont',
                'unread' => 0,
                'mins_ago' => 120,
                'messages' => [
                    ['text' => 'Bonjour! Please send me the SPA Form F draft for review with my legal team.', 'from_me' => false, 'mins' => 180],
                    ['text' => 'Bonjour Mr. Dupont, Form F has been sent to your registered email along with the payment schedule breakdown.', 'from_me' => true, 'mins' => 120],
                ]
            ],
            [
                'phone' => '+971 56 946 8277',
                'name' => 'Elena Rostova',
                'unread' => 3,
                'mins_ago' => 15,
                'messages' => [
                    ['text' => 'Hi, we are looking for a ready penthouse in Dubai Marina with private pool. Budget around AED 25M.', 'from_me' => false, 'mins' => 15],
                ]
            ],
        ];

        foreach ($sampleConversations as $idx => $conv) {
            $contact = $contacts->get($idx % max(1, $contacts->count()));
            $chatName = $contact ? $contact->name : $conv['name'];
            $chatPhone = $contact && $contact->phone ? $contact->phone : $conv['phone'];
            $lastMsg = end($conv['messages']);

            $chat = WhatsAppChat::create([
                'channel_id' => $channel->id,
                'phone' => $chatPhone,
                'remote_jid' => preg_replace('/[^0-9]/', '', $chatPhone) . '@s.whatsapp.net',
                'contact_id' => $contact ? $contact->id : null,
                'contact_name' => $chatName,
                'last_message' => $lastMsg['text'],
                'last_message_at' => now()->subMinutes($conv['mins_ago']),
                'unread_count' => $conv['unread'],
                'avatar_url' => 'none',
            ]);

            foreach ($conv['messages'] as $mIdx => $m) {
                WhatsAppMessage::create([
                    'chat_id' => $chat->id,
                    'message_id' => 'WA-SEED-' . $chat->id . '-' . $mIdx,
                    'from_me' => $m['from_me'],
                    'sender_name' => $m['from_me'] ? 'You' : $chatName,
                    'text' => $m['text'],
                    'status' => $m['from_me'] ? 'delivered' : 'read',
                    'timestamp' => now()->subMinutes($m['mins']),
                ]);
            }
        }
    }
}
