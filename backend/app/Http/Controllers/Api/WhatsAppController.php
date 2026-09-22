<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppChannel;
use App\Models\WhatsAppChat;
use App\Models\WhatsAppMessage;
use App\Models\Contact;
use App\Models\Opportunity;
use App\Models\Activity;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Str;

class WhatsAppController extends Controller
{
    /**
     * Synchronize WhatsApp channels with authentic CRM users in database
     */
    protected function syncChannelsFromUsers(): void
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('whatsapp_channels')) {
            return;
        }

        $hasUserIdCol = \Illuminate\Support\Facades\Schema::hasColumn('whatsapp_channels', 'user_id');

        // 1. Purge legacy dummy channels (Agency Owner, Mako Real Estate, Shafi Core, FA Advisory 3, or unlinked channels)
        WhatsAppChannel::where(function ($q) {
            $q->whereNull('user_id')
              ->orWhere('agent_name', 'like', '%Agency Owner%')
              ->orWhere('session_name', 'like', '%Agency Owner%')
              ->orWhere('agent_name', 'like', '%Mako Real Estate%')
              ->orWhere('agent_name', 'like', '%Shafi Core%')
              ->orWhere('agent_name', 'like', '%FA Advisory 3%');
        })->delete();

        // 2. Link or create dedicated channel for each real CRM user
        $users = User::all();
        foreach ($users as $crmUser) {
            $userChan = null;
            if ($hasUserIdCol) {
                $userChan = WhatsAppChannel::where('user_id', $crmUser->id)->first();
            }

            if (!$userChan) {
                $userChan = WhatsAppChannel::where('agent_name', $crmUser->name)
                    ->orWhere('session_name', $crmUser->name)
                    ->first();
            }

            if ($userChan) {
                $updates = [
                    'agent_name' => $crmUser->name,
                    'session_name' => $crmUser->name,
                ];
                if ($hasUserIdCol && !$userChan->user_id) {
                    $updates['user_id'] = $crmUser->id;
                }
                $userChan->update($updates);
            } else {
                WhatsAppChannel::create([
                    'user_id' => $hasUserIdCol ? $crmUser->id : null,
                    'session_name' => $crmUser->name,
                    'agent_name' => $crmUser->name,
                    'agent_extension' => substr($crmUser->phone ?? '', -4) ?: '1000',
                    'phone_number' => null,
                    'status' => 'disconnected',
                    'platform' => 'WhatsApp Multi-Device',
                    'battery_level' => 100,
                ]);
            }
        }
    }

    /**
     * List all WhatsApp channels / connected devices
     */
    public function channels(Request $request)
    {
        $this->syncChannelsFromUsers();

        $user = $request->user();
        $isSuper = false;
        if ($user) {
            $role = strtolower($user->role ?? '');
            $isSuper = in_array($role, ['super admin', 'agency owner', 'owner', 'ceo', 'admin']) 
                || in_array('*', $user->effective_permissions ?? []);
        }

        $hasUserIdCol = \Illuminate\Support\Facades\Schema::hasColumn('whatsapp_channels', 'user_id');

        if ($isSuper) {
            // Super Admin can view all accounts/channels in the database
            $channels = WhatsAppChannel::withCount('chats')->orderBy('id', 'asc')->get();
            $currentUserChannel = $channels->firstWhere('user_id', $user?->id) ?? $channels->first();
        } else {
            // Individual user: ONLY return their own account/channel
            $query = WhatsAppChannel::withCount('chats');
            if ($user) {
                $query->where(function ($q) use ($user, $hasUserIdCol) {
                    if ($hasUserIdCol) {
                        $q->where('user_id', $user->id);
                    }
                    $q->orWhere('agent_name', $user->name)
                      ->orWhere('session_name', $user->name);
                    if (!empty($user->phone)) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $user->phone);
                        if (strlen($cleanPhone) >= 7) {
                            $last7 = substr($cleanPhone, -7);
                            $q->orWhere('phone_number', 'like', "%{$last7}%");
                        }
                    }
                });
            }
            $channels = $query->get();

            // Auto-create if not present
            if ($channels->isEmpty() && $user) {
                $newChan = WhatsAppChannel::create([
                    'user_id' => $hasUserIdCol ? $user->id : null,
                    'session_name' => $user->name,
                    'agent_name' => $user->name,
                    'phone_number' => $user->phone,
                    'status' => 'disconnected',
                    'platform' => 'WhatsApp Multi-Device',
                    'battery_level' => 100,
                ]);
                $channels = collect([$newChan]);
            }
            $currentUserChannel = $channels->first();
        }

        return response()->json([
            'channels' => $channels,
            'is_super_admin' => $isSuper,
            'current_user_channel' => $currentUserChannel,
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
        $user = $request->user();
        $isSuper = false;
        if ($user) {
            $role = strtolower($user->role ?? '');
            $isSuper = in_array($role, ['super admin', 'agency owner', 'owner', 'ceo', 'admin']) 
                || in_array('*', $user->effective_permissions ?? []);
        }

        // Non-super-admin is locked to their personal channel
        if (!$isSuper && $user) {
            $hasUserIdCol = \Illuminate\Support\Facades\Schema::hasColumn('whatsapp_channels', 'user_id');
            $chanQ = WhatsAppChannel::query();
            if ($hasUserIdCol) {
                $chanQ->where('user_id', $user->id);
            }
            $userChan = $chanQ->orWhere('agent_name', $user->name)
                ->orWhere('session_name', $user->name)
                ->first();
            if ($userChan) {
                $channelId = $userChan->id;
            }
        }

        $channel = WhatsAppChannel::find($channelId);

        if (!$channel) {
            $hasUserIdCol = \Illuminate\Support\Facades\Schema::hasColumn('whatsapp_channels', 'user_id');
            $channel = WhatsAppChannel::firstOrCreate(
                ['session_name' => $request->input('session_name', $user ? $user->name : 'Faraz Shafi')],
                [
                    'user_id' => ($hasUserIdCol && $user) ? $user->id : null,
                    'agent_name' => $request->input('agent_name', $user ? $user->name : 'Faraz Shafi'),
                    'agent_extension' => $request->input('agent_extension', '1000'),
                    'status' => 'qr_ready',
                ]
            );
        }

        // If client requested a fresh QR or logout of previous session, reset gateway
        if ($request->boolean('force_refresh', false) || $request->boolean('logout_first', false)) {
            try {
                \Illuminate\Support\Facades\Http::timeout(6)->post($this->gatewayUrl() . '/api/logout');
                sleep(2);
            } catch (\Exception $e) {}
        }

        // Attempt to fetch real cryptographic pairing QR from WhatsApp Gateway
        $realQrCode = null;
        $realQrImage = null;
        $gatewayStatus = 'disconnected';
        $connectedUser = null;
        try {
            $gwRes = \Illuminate\Support\Facades\Http::timeout(4)->get($this->gatewayUrl() . '/api/qr');
            if ($gwRes->successful()) {
                $gwData = $gwRes->json();
                $gatewayStatus = $gwData['status'] ?? 'disconnected';
                if (!empty($gwData['qr_code'])) {
                    $realQrCode = $gwData['qr_code'];
                }
                if (!empty($gwData['qr_image'])) {
                    $realQrImage = $gwData['qr_image'];
                }
            }

            // Also check status if QR wasn't returned
            if (!$realQrCode && !$realQrImage) {
                $stRes = \Illuminate\Support\Facades\Http::timeout(3)->get($this->gatewayUrl() . '/api/status');
                if ($stRes->successful()) {
                    $stData = $stRes->json();
                    $gatewayStatus = $stData['status'] ?? $gatewayStatus;
                    $connectedUser = $stData['user'] ?? null;
                }
            }
        } catch (\Exception $e) {
            // Gateway not running or connecting
        }

        // Determine if this is an authentic gateway QR
        $isReal = !empty($realQrCode) || !empty($realQrImage);
        $qrPayload = $realQrCode ?? ($isReal ? '' : ('2@' . Str::random(44) . ',' . Str::random(32) . ',' . time() . ',1'));

        // Only mark this channel connected if its own phone matches the connected gateway session
        $isThisChannelConnected = false;
        if ($gatewayStatus === 'connected' && $connectedUser && !empty($connectedUser['phone'])) {
            $gwPhone = preg_replace('/[^0-9]/', '', $connectedUser['phone']);
            $chanPhone = preg_replace('/[^0-9]/', '', $channel->phone_number ?? '');
            if ($gwPhone && $chanPhone && (str_contains($chanPhone, substr($gwPhone, -7)) || str_contains($gwPhone, substr($chanPhone, -7)))) {
                $isThisChannelConnected = true;
            }
        }

        $channel->update([
            'qr_code' => $qrPayload,
            'status' => $isThisChannelConnected ? 'connected' : ($isReal && $gatewayStatus === 'qr_ready' ? 'qr_ready' : 'disconnected'),
            'last_sync_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'channel' => $channel,
            'qr_code' => $qrPayload,
            'qr_image' => $realQrImage,
            'is_real' => $isReal,
            'gateway_status' => $gatewayStatus,
            'connected_user' => $connectedUser,
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

        try {
            \Illuminate\Support\Facades\Http::timeout(6)->post($this->gatewayUrl() . '/api/logout');
        } catch (\Exception $e) {}

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
     * Proxy WhatsApp Gateway logout (clears session and triggers fresh QR generation)
     */
    public function gatewayLogout()
    {
        try {
            $res = \Illuminate\Support\Facades\Http::timeout(10)->post($this->gatewayUrl() . '/api/logout');
            WhatsAppChannel::query()->update([
                'status' => 'disconnected',
                'qr_code' => null,
                'connected_at' => null,
            ]);
            return response()->json($res->json() ?? ['success' => true, 'message' => 'Logged out'], 200);
        } catch (\Exception $e) {
            WhatsAppChannel::query()->update([
                'status' => 'disconnected',
                'qr_code' => null,
                'connected_at' => null,
            ]);
            return response()->json(['success' => true, 'message' => 'Logged out locally'], 200);
        }
    }

    /**
     * Proxy WhatsApp Gateway restart
     */
    public function gatewayRestart()
    {
        try {
            $res = \Illuminate\Support\Facades\Http::timeout(10)->post($this->gatewayUrl() . '/api/restart');
            return response()->json($res->json() ?? ['success' => true, 'message' => 'Restarted'], 200);
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

        $user = $request->user();
        $isSuper = false;
        if ($user) {
            $role = strtolower($user->role ?? '');
            $isSuper = in_array($role, ['super admin', 'agency owner', 'owner', 'ceo', 'admin']) 
                || in_array('*', $user->effective_permissions ?? []);
        }

        if ($isSuper) {
            if ($request->has('channel_id') && $request->channel_id !== 'all') {
                $query->where('channel_id', $request->channel_id);
            }
        } else {
            // Individual user: strictly scoped to their own channel
            $userChan = null;
            $hasUserIdCol = \Illuminate\Support\Facades\Schema::hasColumn('whatsapp_channels', 'user_id');
            if ($hasUserIdCol && $user) {
                $userChan = WhatsAppChannel::where('user_id', $user->id)->first();
            }
            if (!$userChan && $user) {
                $userChan = WhatsAppChannel::where('agent_name', $user->name)
                    ->orWhere('session_name', $user->name)
                    ->first();
            }
            if ($userChan) {
                $query->where('channel_id', $userChan->id);
            } else {
                $query->whereRaw('1 = 0');
            }
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
     * Start / Create a new WhatsApp chat with a contact or phone number
     */
    public function startChat(Request $request)
    {
        $rawPhone = $request->input('phone');
        if (empty($rawPhone)) {
            return response()->json(['success' => false, 'message' => 'Phone number is required.'], 422);
        }

        // Clean digits
        $digits = preg_replace('/[^0-9]/', '', $rawPhone);
        if (strlen($digits) < 7) {
            return response()->json(['success' => false, 'message' => 'Invalid phone number format.'], 422);
        }

        $formattedPhone = '+' . $digits;
        $nameInput = trim($request->input('name', ''));
        $channelId = $request->input('channel_id');
        if (!$channelId || $channelId === 'all') {
            $firstChan = WhatsAppChannel::first();
            $channelId = $firstChan ? $firstChan->id : 1;
        }

        // Find matching CRM Contact by last 7 digits
        $last7 = substr($digits, -7);
        $contact = Contact::where('phone', 'like', "%{$last7}%")
            ->orWhere('secondary_phone', 'like', "%{$last7}%")
            ->first();

        $displayName = $nameInput;
        if (empty($displayName) && $contact) {
            $displayName = $contact->name;
        }
        if (empty($displayName)) {
            $displayName = $formattedPhone;
        }

        $remoteJid = $digits . '@c.us';

        // Check if chat already exists for this channel and phone
        $chat = WhatsAppChat::where('channel_id', $channelId)
            ->where(function ($q) use ($digits, $formattedPhone, $last7) {
                $q->where('phone', $formattedPhone)
                  ->orWhere('phone', 'like', "%{$last7}%")
                  ->orWhere('remote_jid', 'like', "%{$digits}%");
            })
            ->first();

        if (!$chat) {
            $chat = WhatsAppChat::create([
                'channel_id' => $channelId,
                'contact_id' => $contact ? $contact->id : null,
                'remote_jid' => $remoteJid,
                'phone' => $formattedPhone,
                'contact_name' => $displayName,
                'last_message' => 'Conversation started',
                'last_message_at' => now(),
                'unread_count' => 0,
                'is_pinned' => false,
            ]);
        } else {
            // Update contact_id or contact_name if better info available
            $updates = [];
            if (!$chat->contact_id && $contact) {
                $updates['contact_id'] = $contact->id;
            }
            if (!empty($nameInput) && ($chat->contact_name === $chat->phone || empty($chat->contact_name))) {
                $updates['contact_name'] = $nameInput;
            }
            if (!empty($updates)) {
                $chat->update($updates);
            }
        }

        // Send initial message if provided
        $initialMsg = trim($request->input('initial_message', ''));
        if (!empty($initialMsg)) {
            $msgId = 'WA-OUT-' . Str::random(12);
            WhatsAppMessage::create([
                'chat_id' => $chat->id,
                'message_id' => $msgId,
                'from_me' => true,
                'sender_name' => 'You',
                'text' => $initialMsg,
                'media_type' => 'text',
                'status' => 'pending',
                'timestamp' => now(),
            ]);

            $chat->update([
                'last_message' => $initialMsg,
                'last_message_at' => now(),
            ]);

            // Attempt to deliver via WhatsApp Gateway if running
            try {
                \Illuminate\Support\Facades\Http::timeout(3)->post($this->gatewayUrl() . '/api/send', [
                    'phone' => $formattedPhone,
                    'jid' => $remoteJid,
                    'text' => $initialMsg,
                ]);
            } catch (\Exception $e) {}
        }

        return response()->json([
            'success' => true,
            'chat' => $chat->fresh(['channel', 'contact.opportunity.buyerQualification', 'messages']),
            'message' => "Chat ready for {$displayName}",
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
    private function seedInitialChannels()
    {
        $this->syncChannelsFromUsers();
    }

    /**
     * Seed initial realistic client conversations linked to CRM contacts (Disabled - Authentic mirroring only)
     */
    private function seedInitialChats()
    {
        return;
    }

    /**
     * Get WhatsApp conversation history and messages for a specific Contact or Opportunity
     */
    public function contactHistory(Request $request)
    {
        $contact = null;
        $phones = [];

        if ($request->filled('contact_id')) {
            $contact = Contact::find($request->contact_id);
        } elseif ($request->filled('opportunity_id')) {
            $opp = Opportunity::with('contact')->find($request->opportunity_id);
            if ($opp && $opp->contact) {
                $contact = $opp->contact;
            }
        }

        if ($contact) {
            if (!empty($contact->phone)) $phones[] = $contact->phone;
            if (!empty($contact->secondary_phone)) $phones[] = $contact->secondary_phone;
        }

        if ($request->filled('phone')) {
            $phones[] = $request->phone;
        }

        $chat = null;

        // 1. Try finding by contact_id
        if ($contact) {
            $chat = WhatsAppChat::where('contact_id', $contact->id)->latest('last_message_at')->first();
        }

        // 2. Try finding by matching phone numbers (last 7 digits)
        if (!$chat && !empty($phones)) {
            $chat = WhatsAppChat::where(function ($q) use ($phones) {
                foreach ($phones as $p) {
                    $cleanP = preg_replace('/[^0-9]/', '', $p);
                    $last7 = strlen($cleanP) >= 7 ? substr($cleanP, -7) : $cleanP;
                    if (!empty($last7)) {
                        $q->orWhere('phone', 'like', "%{$last7}%")
                          ->orWhere('remote_jid', 'like', "%{$last7}%");
                    }
                }
            })->latest('last_message_at')->first();
        }

        if (!$chat) {
            return response()->json([
                'success' => true,
                'has_chat' => false,
                'chat' => null,
                'messages' => [],
                'contact' => $contact,
            ]);
        }

        // Link contact_id if missing
        if ($contact && !$chat->contact_id) {
            $chat->update(['contact_id' => $contact->id]);
        }

        $messages = WhatsAppMessage::where('chat_id', $chat->id)
            ->orderBy('timestamp', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'has_chat' => true,
            'chat' => $chat->load('channel'),
            'messages' => $messages,
            'contact' => $contact,
        ]);
    }
}

