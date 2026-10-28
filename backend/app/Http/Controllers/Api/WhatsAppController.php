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
                // Sync phone_number from CRM User if not currently connected
                if ($userChan->status !== 'connected' && !empty($crmUser->phone)) {
                    $updates['phone_number'] = $crmUser->phone;
                }
                $userChan->update($updates);
            } else {
                WhatsAppChannel::create([
                    'user_id' => $hasUserIdCol ? $crmUser->id : null,
                    'session_name' => $crmUser->name,
                    'agent_name' => $crmUser->name,
                    'agent_extension' => substr($crmUser->phone ?? '', -4) ?: '1000',
                    'phone_number' => $crmUser->phone ?: null,
                    'status' => 'disconnected',
                    'platform' => 'WhatsApp Multi-Device',
                    'battery_level' => 100,
                ]);
            }
        }

        // Self-Healing: Disassociate Shafi Uddin's phone (+971505559646) from Faraz Shafi
        WhatsAppChannel::where('agent_name', 'like', '%Faraz%')
            ->where(function($q) {
                $q->where('phone_number', 'like', '%5559646%')
                  ->orWhere('phone_number', 'like', '%505559646%');
            })
            ->update([
                'phone_number' => null,
                'status' => 'disconnected',
                'qr_code' => null,
            ]);
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

        // Self-Healing: Clean Faraz Shafi from any stolen phone number (+971505559646)
        $shafiChan = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')
            ->where('agent_name', 'not like', '%Faraz%')
            ->first();

        $farazChan = WhatsAppChannel::where('agent_name', 'like', '%Faraz%')->first();

        if ($farazChan && (!empty($farazChan->phone_number) && str_contains($farazChan->phone_number, '5559646'))) {
            $farazUser = User::find(1);
            $farazPhone = ($farazUser && !str_contains($farazUser->phone ?? '', '5559646')) ? $farazUser->phone : null;
            $farazChan->update([
                'phone_number' => $farazPhone,
                'status' => 'disconnected',
                'qr_code' => null
            ]);
        }

        // Live Gateway Status Reconciliation: Ensure database channel status matches real gateway state
        try {
            $gwRes = \Illuminate\Support\Facades\Http::timeout(2)->get($this->gatewayUrl() . '/api/status');
            if ($gwRes->successful()) {
                $gwData = $gwRes->json();
                $gwStatus = $gwData['status'] ?? 'disconnected';
                $gwPhone = $gwData['user']['phone'] ?? null;

                if ($gwStatus === 'connected' && !empty($gwPhone)) {
                    $clean = preg_replace('/[^0-9]/', '', $gwPhone);
                    $last7 = substr($clean, -7);

                    if ($last7 === '5559646' && $shafiChan) {
                        $shafiChan->update([
                            'phone_number' => '+971505559646',
                            'status' => 'connected',
                            'last_sync_at' => now(),
                        ]);

                        // Ensure any chats incorrectly stamped with Faraz Shafi are transferred to Shafi Uddin
                        if ($farazChan) {
                            $moved = WhatsAppChat::where('channel_id', $farazChan->id)->update(['channel_id' => $shafiChan->id]);
                            if ($moved > 0) {
                                \Log::info("Transferred {$moved} WhatsApp chats from Faraz Shafi to Shafi Uddin");
                            }
                        }
                    } elseif ($last7) {
                        WhatsAppChannel::where('phone_number', 'like', "%{$last7}%")
                            ->update(['status' => 'connected']);
                    }
                }
            }
        } catch (\Exception $e) {}

        // Reload fresh channels after reconciliation
        if ($isSuper) {
            $channels = WhatsAppChannel::withCount('chats')->orderBy('id', 'asc')->get();
            $currentUserChannel = $channels->firstWhere('user_id', $user?->id) ?? $channels->first();
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
                ['session_name' => $request->input('session_name', $user ? $user->name : 'Shafi Uddin')],
                [
                    'user_id' => ($hasUserIdCol && $user) ? $user->id : null,
                    'agent_name' => $request->input('agent_name', $user ? $user->name : 'Shafi Uddin'),
                    'agent_extension' => $request->input('agent_extension', '1000'),
                    'status' => 'qr_ready',
                ]
            );
        }

        \Illuminate\Support\Facades\Cache::put('whatsapp_active_pairing_channel_id', $channel->id, now()->addMinutes(15));

        // Only logout if client explicitly requested logout_first
        if ($request->boolean('logout_first', false)) {
            try {
                \Illuminate\Support\Facades\Http::timeout(6)->post($this->gatewayUrl() . '/api/logout');
                sleep(2);
            } catch (\Exception $e) {}
        }

        // Attempt to fetch real cryptographic pairing QR from WhatsApp Gateway
        $realQrCode = null;
        $realQrImage = null;
        $gatewayStatus = 'disconnected';
        $force = $request->boolean('force_refresh', false);
        $gwEndpoint = $force ? '/api/qr?force=1' : '/api/qr';
        try {
            $gwRes = \Illuminate\Support\Facades\Http::timeout(4)->get($this->gatewayUrl() . $gwEndpoint);
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

        // If direct gateway HTTP request didn't return a QR, check pushed state in cache (strictly enforce freshness <= 22s)
        if (!$realQrCode && !$realQrImage) {
            $cached = \Illuminate\Support\Facades\Cache::get('whatsapp_gateway_state');
            $age = $cached && !empty($cached['updated_at']) ? (now()->timestamp - $cached['updated_at']) : 999;
            if ($cached && $age <= 22) {
                $gatewayStatus = $cached['status'] ?? $gatewayStatus;
                $connectedUser = $cached['connected_user'] ?? $connectedUser;
                if (!empty($cached['qr_code'])) $realQrCode = $cached['qr_code'];
                if (!empty($cached['qr_image'])) $realQrImage = $cached['qr_image'];
            }
        }

        // Determine if this is an authentic gateway QR
        $isReal = !empty($realQrCode) || !empty($realQrImage);
        $qrPayload = $realQrCode ?: null;

        // Only mark this channel connected if its own phone matches the connected gateway session
        $isThisChannelConnected = false;
        if ($gatewayStatus === 'connected' && $connectedUser && !empty($connectedUser['phone'])) {
            $gwPhone = preg_replace('/[^0-9]/', '', $connectedUser['phone']);
            $chanPhone = preg_replace('/[^0-9]/', '', $channel->phone_number ?? '');
            if (empty($chanPhone) || str_contains($chanPhone, substr($gwPhone, -7)) || str_contains($gwPhone, substr($chanPhone, -7))) {
                $isThisChannelConnected = true;
                if (empty($channel->phone_number)) {
                    $channel->phone_number = $connectedUser['phone'];
                }
            }
        }

        $channel->update([
            'phone_number' => $channel->phone_number,
            'qr_code' => $isThisChannelConnected ? null : $qrPayload,
            'status' => $isThisChannelConnected ? 'connected' : ($isReal && $gatewayStatus === 'qr_ready' ? 'qr_ready' : 'disconnected'),
            'last_sync_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'channel' => $channel,
            'qr_code' => $isThisChannelConnected ? null : $qrPayload,
            'qr_image' => $isThisChannelConnected ? null : $realQrImage,
            'is_real' => $isReal && !$isThisChannelConnected,
            'gateway_status' => $gatewayStatus,
            'connected_user' => $connectedUser,
            'expires_in' => 25, // seconds
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
        $channel = null;
        if ($id && $id !== 'active') {
            $channel = WhatsAppChannel::find($id);
        }
        $phone = $request->input('phone_number');
        if (!$channel && $phone) {
            $clean = preg_replace('/[^0-9]/', '', $phone);
            $last7 = substr($clean, -7);
            if ($last7) {
                $channel = WhatsAppChannel::where('phone_number', 'like', "%{$last7}%")->first();
            }
        }
        if (!$channel) {
            $user = $request->user();
            if ($user) {
                $channel = WhatsAppChannel::where('user_id', $user->id)
                    ->orWhere('agent_name', $user->name)
                    ->first();
            }
        }
        if (!$channel) {
            $channel = WhatsAppChannel::where('status', 'qr_ready')->first()
                ?? WhatsAppChannel::orderBy('id', 'asc')->first();
        }

        if (!$channel) {
            return response()->json(['success' => false, 'error' => 'No channel available to pair.'], 404);
        }

        $phone = $phone ?? $channel->phone_number ?? ('+971 50 ' . rand(100, 999) . ' ' . rand(1000, 9999));
        $platform = $request->input('platform', 'WhatsApp Multi-Device');

        $channel->update([
            'status' => 'connected',
            'phone_number' => $phone,
            'platform' => $platform,
            'battery_level' => rand(85, 98),
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
        $channel = null;
        if ($id && $id !== 'active') {
            $channel = WhatsAppChannel::find($id);
        }
        if (!$channel) {
            $channel = WhatsAppChannel::where('status', 'connected')->first();
        }

        try {
            \Illuminate\Support\Facades\Http::timeout(6)->post($this->gatewayUrl() . '/api/logout');
        } catch (\Exception $e) {}

        if ($channel) {
            $channel->update([
                'status' => 'disconnected',
                'qr_code' => null,
                'connected_at' => null,
                'last_sync_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "WhatsApp device disconnected.",
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
            $res = \Illuminate\Support\Facades\Http::timeout(2)->get($this->gatewayUrl() . '/api/status');
            if ($res->successful()) {
                return response()->json($res->json(), 200);
            }
        } catch (\Exception $e) {}

        $cached = \Illuminate\Support\Facades\Cache::get('whatsapp_gateway_state');
        if ($cached && !empty($cached['status'])) {
            return response()->json([
                'status' => $cached['status'],
                'user' => $cached['connected_user'] ?? null,
                'has_qr' => !empty($cached['qr_image']) || !empty($cached['qr_code']),
            ], 200);
        }

        return response()->json(['status' => 'disconnected', 'user' => null, 'has_qr' => false], 200);
    }

    /**
     * Proxy WhatsApp Gateway QR image for secure HTTPS clients (Vercel)
     */
    public function gatewayQr(Request $request)
    {
        $force = $request->boolean('force_refresh', false) || $request->input('force') == '1';
        $gwEndpoint = $force ? '/api/qr?force=1' : '/api/qr';
        try {
            $res = \Illuminate\Support\Facades\Http::timeout(5)->get($this->gatewayUrl() . $gwEndpoint);
            if ($res->successful()) {
                $data = $res->json();
                if (!empty($data['qr_image']) || !empty($data['qr_code'])) {
                    return response()->json($data, 200);
                }
            }
        } catch (\Exception $e) {}

        // Fallback to state pushed by gateway daemon (strictly <= 25 seconds old)
        $cached = \Illuminate\Support\Facades\Cache::get('whatsapp_gateway_state');
        if ($cached && (!empty($cached['qr_image']) || !empty($cached['qr_code']))) {
            $age = now()->timestamp - ($cached['updated_at'] ?? 0);
            if ($age <= 25) {
                $ttl = max(3, 25 - $age);
                return response()->json([
                    'status' => $cached['status'] ?? 'qr_ready',
                    'qr_image' => $cached['qr_image'] ?? null,
                    'qr_code' => $cached['qr_code'] ?? null,
                    'expires_in' => $ttl,
                    'qr_age_sec' => $age,
                    'user' => $cached['connected_user'] ?? null,
                ], 200);
            }
        }

        return response()->json([
            'status' => 'disconnected',
            'qr_image' => null,
            'qr_code' => null,
            'expires_in' => 0
        ], 200);
    }

    /**
     * Ingest live authentic QR code & session state pushed from WhatsApp Gateway daemon
     */
    public function syncQr(Request $request)
    {
        $status = $request->input('status', 'disconnected');
        $qrCode = $request->input('qr_code');
        $qrImage = $request->input('qr_image');
        $expiresIn = (int) $request->input('expires_in', 60);
        $connectedUser = $request->input('connected_user');
        $phoneNumber = $request->input('phone_number');

        $state = [
            'status' => $status,
            'qr_code' => $qrCode,
            'qr_image' => $qrImage,
            'connected_user' => $connectedUser,
            'phone_number' => $phoneNumber,
            'updated_at' => now()->timestamp,
            'expires_at' => now()->addSeconds($expiresIn)->timestamp,
        ];

        \Illuminate\Support\Facades\Cache::put('whatsapp_gateway_state', $state, now()->addMinutes(5));

        if ($status === 'connected') {
            $rawPhone = $phoneNumber ?: ($connectedUser['phone'] ?? null);
            $cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone ?? '');
            $last7 = strlen($cleanPhone) >= 7 ? substr($cleanPhone, -7) : null;

            $channel = null;

            // 1. If 5559646, it explicitly belongs to Shafi Uddin!
            if ($last7 === '5559646' || ($cleanPhone && str_contains($cleanPhone, '505559646'))) {
                $channel = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')
                    ->where('agent_name', 'not like', '%Faraz%')
                    ->first();
            }

            // 2. Active pairing channel from QR cache
            if (!$channel) {
                $qrChannelId = \Illuminate\Support\Facades\Cache::get('whatsapp_active_pairing_channel_id');
                if ($qrChannelId) {
                    $channel = WhatsAppChannel::find($qrChannelId);
                }
            }

            // 3. User match by phone
            if (!$channel && $last7) {
                $uMatch = User::where('phone', 'like', "%{$last7}%")->first();
                if ($uMatch) {
                    $channel = WhatsAppChannel::where('user_id', $uMatch->id)
                        ->orWhere('agent_name', $uMatch->name)
                        ->first();
                }
            }

            // 4. Channel currently in qr_ready
            if (!$channel) {
                $channel = WhatsAppChannel::where('status', 'qr_ready')->first();
            }

            // 5. Fallback: match connected or Shafi
            if (!$channel) {
                $channel = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')
                    ->where('agent_name', 'not like', '%Faraz%')
                    ->first()
                    ?? WhatsAppChannel::where('status', 'connected')->first();
            }

            if ($channel) {
                $formattedPhone = $cleanPhone ? ('+' . $cleanPhone) : $rawPhone;
                $channel->update([
                    'status' => 'connected',
                    'qr_code' => null,
                    'phone_number' => $formattedPhone ?: $channel->phone_number,
                    'connected_at' => now(),
                    'last_sync_at' => now(),
                ]);
            }

            // Disassociate Faraz Shafi from any false 5559646 association
            $farazChan = WhatsAppChannel::where('agent_name', 'like', '%Faraz%')->first();
            if ($farazChan && (!empty($farazChan->phone_number) && str_contains($farazChan->phone_number, '5559646'))) {
                $farazUser = User::find(1);
                $farazPhone = ($farazUser && !str_contains($farazUser->phone ?? '', '5559646')) ? $farazUser->phone : null;
                $farazChan->update([
                    'phone_number' => $farazPhone,
                    'status' => 'disconnected',
                    'qr_code' => null
                ]);
            }

            // Reassign any chats under Faraz Shafi to Shafi Uddin
            $shafiChan = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')->where('agent_name', 'not like', '%Faraz%')->first();
            if ($shafiChan && $farazChan) {
                WhatsAppChat::where('channel_id', $farazChan->id)->update(['channel_id' => $shafiChan->id]);
            }
        } elseif ($status === 'qr_ready' && $qrCode) {
            WhatsAppChannel::where('status', '!=', 'connected')->update([
                'qr_code' => $qrCode,
                'status' => 'qr_ready',
            ]);
        } elseif ($status === 'disconnected') {
            WhatsAppChannel::where('status', 'qr_ready')->update([
                'qr_code' => null,
                'status' => 'disconnected',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'WhatsApp gateway QR state synced successfully',
            'status' => $status,
            'has_qr' => !empty($qrCode) || !empty($qrImage),
        ]);
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
        $channelId = $request->input('channel_id');
        $channel = null;
        if ($channelId && $channelId !== 'active') {
            $channel = WhatsAppChannel::find($channelId);
        }
        $phoneParam = $request->input('phone_number');
        if (!$channel && !empty($phoneParam)) {
            $clean = preg_replace('/[^0-9]/', '', $phoneParam);
            $last7 = substr($clean, -7);
            if ($last7 === '5559646' || ($clean && str_contains($clean, '505559646'))) {
                $channel = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')
                    ->where('agent_name', 'not like', '%Faraz%')
                    ->first();
            }
            if (!$channel && $last7) {
                $uMatch = User::where('phone', 'like', "%{$last7}%")->first();
                if ($uMatch) {
                    $channel = WhatsAppChannel::where('user_id', $uMatch->id)
                        ->orWhere('agent_name', $uMatch->name)
                        ->first();
                }
            }
            if (!$channel && $last7) {
                $channel = WhatsAppChannel::where('phone_number', 'like', "%{$last7}%")
                    ->where('agent_name', 'not like', '%Faraz%')
                    ->first();
            }
        }

        if (!$channel) {
            $qrChannelId = \Illuminate\Support\Facades\Cache::get('whatsapp_active_pairing_channel_id');
            if ($qrChannelId) {
                $channel = WhatsAppChannel::find($qrChannelId);
            }
        }

        if (!$channel) {
            $channel = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')
                ->where('agent_name', 'not like', '%Faraz%')
                ->first()
                ?? WhatsAppChannel::where('status', 'connected')->first()
                ?? WhatsAppChannel::orderBy('id', 'asc')->first();
        }

        if ($channel) {
            $channelId = $channel->id;
            $channel->update([
                'status' => 'connected',
                'phone_number' => $phoneParam ?: $channel->phone_number,
                'last_sync_at' => now(),
            ]);
        } else {
            $channelId = 17;
        }

        $chats = $request->input('chats', []);
        $contacts = $request->input('contacts', []);

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
            // Skip broadcast, status channels, newsletters (groups are now supported!)
            if (str_contains($rawJid, 'status@broadcast') || str_contains($rawJid, 'newsletter')) {
                continue;
            }

            $isGroup = !empty($chatData['is_group']) || str_contains($rawJid, '@g.us') || ($chatData['phone'] ?? '') === 'Group Chat';

            $resolvedPhone = null;
            if ($isGroup) {
                $phoneToStore = 'Group Chat';
                $savedName = $chatData['name'] ?? ($chatData['formattedTitle'] ?? 'WhatsApp Group');
            } else {
                if (!empty($chatData['phone']) && !str_contains($chatData['phone'], '@lid') && strlen(preg_replace('/[^0-9]/', '', $chatData['phone'])) <= 13) {
                    $resolvedPhone = preg_replace('/[^0-9]/', '', $chatData['phone']);
                } elseif (str_contains($rawJid, '@c.us') || str_contains($rawJid, '@s.whatsapp.net')) {
                    $digits = preg_replace('/[^0-9]/', '', explode('@', $rawJid)[0] ?? '');
                    if (strlen($digits) >= 7 && strlen($digits) <= 13) {
                        $resolvedPhone = $digits;
                    }
                } elseif (str_contains($rawJid, '@lid')) {
                    $cleanLid = str_replace('@lid', '', $rawJid);
                    $fromMap = $lidPhoneMap[$rawJid] ?? $lidPhoneMap[$cleanLid] ?? null;
                    if ($fromMap && !str_contains($fromMap, '@lid')) {
                        $cleanFromMap = preg_replace('/[^0-9]/', '', $fromMap);
                        if (strlen($cleanFromMap) >= 7 && strlen($cleanFromMap) <= 13) {
                            $resolvedPhone = $cleanFromMap;
                        }
                    }
                }

                // Fallback: Check if formattedTitle or name has real phone digits (between 7 and 13 digits)
                if (empty($resolvedPhone) && !str_contains($rawJid, '@lid')) {
                    $titleCandidate = $chatData['formattedTitle'] ?? ($chatData['name'] ?? '');
                    $extracted = preg_replace('/[^0-9]/', '', $titleCandidate);
                    if (strlen($extracted) >= 9 && strlen($extracted) <= 13) {
                        $resolvedPhone = $extracted;
                    }
                }

                $phoneToStore = $resolvedPhone ? ('+' . $resolvedPhone) : $rawJid;

                // Resolve display name: Prioritize phone address book name from chatData['name']
                $savedName = $chatData['name'] 
                    ?? ($chatData['formattedTitle'] ?? null)
                    ?? ($contactNames[$rawJid] ?? null)
                    ?? ($lidNameMap[$rawJid] ?? null)
                    ?? ($lidNameMap[str_replace('@lid', '', $rawJid)] ?? null);

                // Sanitize name: If it's a 14+ digit number or matches an LID, discard it
                if ($savedName) {
                    $nameClean = preg_replace('/[^0-9]/', '', $savedName);
                    if (strlen($nameClean) >= 14 || str_contains($savedName, '@lid')) {
                        $savedName = null;
                    }
                }

                if (empty($savedName) || $savedName === $rawJid) {
                    $savedName = $resolvedPhone ? ('+' . $resolvedPhone) : 'WhatsApp Contact';
                }
            }

            $last7 = $resolvedPhone ? substr($resolvedPhone, -7) : null;
            $crmContact = null;
            if ($last7 && !$isGroup) {
                $crmContact = Contact::where('phone', 'like', "%{$last7}%")
                    ->orWhere('secondary_phone', 'like', "%{$last7}%")
                    ->first();
            }

            $lastMsg = $chatData['last_message'] ?? ($chatData['conversation'] ?? 'Active chat');
            $timestamp = isset($chatData['timestamp']) && $chatData['timestamp'] > 0
                ? Carbon::createFromTimestamp($chatData['timestamp'])
                : now();

            $chat = WhatsAppChat::where('remote_jid', $rawJid)->first();
            if (!$chat && !$isGroup && $resolvedPhone) {
                $chat = WhatsAppChat::where('phone', '+' . $resolvedPhone)->first();
            }

            $finalName = $crmContact ? $crmContact->name : ($savedName ?: ($chat ? $chat->contact_name : ($isGroup ? 'WhatsApp Group' : 'WhatsApp Contact')));

            if ($chat) {
                $chat->update([
                    'channel_id' => $channelId,
                    'phone' => $isGroup ? 'Group Chat' : ($resolvedPhone ? ('+' . $resolvedPhone) : $chat->phone),
                    'contact_id' => $crmContact ? $crmContact->id : $chat->contact_id,
                    'contact_name' => $finalName,
                    'last_message' => $lastMsg,
                    'last_message_at' => $timestamp,
                ]);
            } else {
                $chat = WhatsAppChat::create([
                    'channel_id' => $channelId,
                    'phone' => $phoneToStore,
                    'remote_jid' => $rawJid,
                    'contact_id' => $crmContact ? $crmContact->id : null,
                    'contact_name' => $finalName,
                    'last_message' => $lastMsg,
                    'last_message_at' => $timestamp,
                    'unread_count' => intval($chatData['unread_count'] ?? 0),
                ]);
            }

            // Ingest recent messages array if provided from browser session
            if (!empty($chatData['messages']) && is_array($chatData['messages'])) {
                foreach ($chatData['messages'] as $m) {
                    $mId = $m['id'] ?? ('WA-HIST-' . Str::random(12));
                    $mText = $m['text'] ?? '';
                    $mMediaType = $m['media_type'] ?? 'text';
                    $mMediaBase64 = $m['media_base64'] ?? null;
                    $mMediaUrl = $m['media_url'] ?? null;

                    // Save incoming base64 media if provided from session
                    if ($mMediaBase64 && str_contains($mMediaBase64, ';base64,')) {
                        try {
                            $publicDir = public_path('storage/whatsapp_media');
                            $storageDir = storage_path('app/public/whatsapp_media');
                            if (!file_exists($publicDir)) @mkdir($publicDir, 0777, true);
                            if (!file_exists($storageDir)) @mkdir($storageDir, 0777, true);

                            $parts = explode(';base64,', $mMediaBase64);
                            $mime = str_replace('data:', '', $parts[0]);
                            $rawBin = base64_decode($parts[1]);
                            $ext = 'bin';
                            if (str_contains($mime, 'pdf')) $ext = 'pdf';
                            elseif (str_contains($mime, 'jpeg') || str_contains($mime, 'jpg')) $ext = 'jpg';
                            elseif (str_contains($mime, 'png')) $ext = 'png';
                            elseif (str_contains($mime, 'webp')) $ext = 'webp';
                            elseif (str_contains($mime, 'word') || str_contains($mime, 'doc') || str_contains($mime, 'officedocument')) $ext = 'docx';
                            elseif (str_contains($mime, 'sheet') || str_contains($mime, 'excel') || str_contains($mime, 'spreadsheet') || str_contains($mime, 'xls')) $ext = 'xlsx';

                            $mOrigName = !empty($m['filename']) 
                                ? $m['filename'] 
                                : (!empty($mText) && preg_match('/\.[a-zA-Z0-9]{2,5}$/', trim($mText)) 
                                    ? trim($mText) 
                                    : ('sync_' . time() . '_' . Str::random(6) . '.' . $ext));
                            if (!str_contains($mOrigName, '.')) {
                                $mOrigName .= '.' . $ext;
                            }
                            $fname = time() . '_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $mOrigName);
                            @file_put_contents($publicDir . '/' . $fname, $rawBin);
                            @file_put_contents($storageDir . '/' . $fname, $rawBin);
                            $mMediaUrl = '/whatsapp/media/' . $fname;
                        } catch (\Exception $e) {}
                    }

                    if (empty($mText) && empty($mMediaUrl)) continue;

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
                            'media_type' => $mMediaType,
                            'media_url' => $mMediaUrl,
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
                $reqChanId = $request->channel_id;

                // Auto-healing: If Shafi Uddin's channel is selected, ensure any chats on Faraz Shafi are transferred to Shafi Uddin
                $shafiChan = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')
                    ->where('agent_name', 'not like', '%Faraz%')
                    ->first();
                $farazChan = WhatsAppChannel::where('agent_name', 'like', '%Faraz%')->first();

                if ($shafiChan && (string)$reqChanId === (string)$shafiChan->id) {
                    if ($farazChan) {
                        WhatsAppChat::where('channel_id', $farazChan->id)->update(['channel_id' => $shafiChan->id]);
                    }
                    if (WhatsAppChat::where('channel_id', $shafiChan->id)->count() === 0) {
                        WhatsAppChat::where('channel_id', '!=', $shafiChan->id)->update(['channel_id' => $shafiChan->id]);
                    }
                }

                $query->where('channel_id', $reqChanId);
            }
        } else {
            // Individual user (Property Consultant / Advisor / Telesales):
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

            if ($userChan && stripos($userChan->agent_name, 'Shafi') !== false && stripos($userChan->agent_name, 'Faraz') === false) {
                $farazChan = WhatsAppChannel::where('agent_name', 'like', '%Faraz%')->first();
                if ($farazChan) {
                    WhatsAppChat::where('channel_id', $farazChan->id)->update(['channel_id' => $userChan->id]);
                }
                if (WhatsAppChat::where('channel_id', $userChan->id)->count() === 0) {
                    WhatsAppChat::where('channel_id', '!=', $userChan->id)->update(['channel_id' => $userChan->id]);
                }
            }

            // Check if there are chats explicitly assigned to this advisor's channel
            $userHasChats = $userChan ? WhatsAppChat::where('channel_id', $userChan->id)->exists() : false;

            if ($userHasChats) {
                $query->where(function ($q) use ($userChan, $user) {
                    $q->where('channel_id', $userChan->id);
                    if ($user) {
                        $q->orWhereHas('contact', function ($cq) use ($user) {
                            $cq->where('assigned_to', $user->name);
                        });
                    }
                });
            } else {
                // Shared agency gateway: If advisor's channel has no separate chats,
                // do NOT leave them with an empty inbox (0 chats). Display the agency's connected WhatsApp chats!
                $connectedChannelIds = WhatsAppChannel::where('status', 'connected')->pluck('id')->toArray();
                if (!empty($connectedChannelIds)) {
                    $query->whereIn('channel_id', $connectedChannelIds);
                } else {
                    // Fallback: If status hasn't synced in DB yet, show the latest synced chats so advisors can respond immediately
                    $latestChanWithChats = WhatsAppChat::distinct('channel_id')->pluck('channel_id')->toArray();
                    if (!empty($latestChanWithChats)) {
                        $query->whereIn('channel_id', $latestChanWithChats);
                    }
                }
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

        // Auto-heal existing chats in database:
        // 1. Advisor self-phone or agent name wrongly stamped on chat
        // 2. Fake 14+ digit LID string wrongly stored as phone or contact name
        foreach ($chats as $c) {
            $chan = $c->channel;
            $chanPhone = $chan ? preg_replace('/[^0-9]/', '', $chan->phone_number ?? '') : '';
            $chanName = $chan ? strtolower(trim($chan->agent_name ?? '')) : '';
            $contactClean = preg_replace('/[^0-9]/', '', $c->contact_name ?? '');

            $isSelfPhone = (!empty($chanPhone) && !empty($contactClean) && strlen($contactClean) >= 7 && str_contains($contactClean, substr($chanPhone, -7)));
            $isSelfName = (!empty($chanName) && strtolower(trim($c->contact_name ?? '')) === $chanName);

            $isLid = str_contains($c->remote_jid ?? '', '@lid') || str_contains($c->phone ?? '', '@lid');
            $lidDigits = $isLid ? preg_replace('/[^0-9]/', '', explode('@', $c->remote_jid ?? '')[0] ?? '') : '';
            $phoneClean = preg_replace('/[^0-9]/', '', $c->phone ?? '');

            $isFakeLidPhone = $isLid && !empty($lidDigits) && ($phoneClean === $lidDigits || strlen($phoneClean) >= 14);
            $isFakeLidName = !empty($contactClean) && strlen($contactClean) >= 14 && (!empty($lidDigits) && ($contactClean === $lidDigits || str_contains($contactClean, $lidDigits)));

            $updates = [];

            if ($isFakeLidPhone) {
                $realPhone = $c->contact?->phone ?: ($c->remote_jid ?: 'WhatsApp Contact');
                $updates['phone'] = $realPhone;
                $c->phone = $realPhone;
            }

            if ($isSelfPhone || $isSelfName || $c->contact_name === 'You' || $isFakeLidName || empty($c->contact_name)) {
                $phoneValid = !empty($c->phone) && !str_contains($c->phone, '@lid') && strlen(preg_replace('/[^0-9]/', '', $c->phone)) <= 13;
                $healedName = $c->contact?->name ?: ($phoneValid ? $c->phone : 'WhatsApp Contact');
                $updates['contact_name'] = $healedName;
                $c->contact_name = $healedName;
            }

            if (!empty($updates)) {
                $c->update($updates);
            }
        }

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

        // Clean up any stray @lid sender_name on messages
        WhatsAppMessage::where('chat_id', $chat->id)
            ->where('sender_name', 'like', '%@lid%')
            ->update(['sender_name' => null]);

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

        // Auto-heal missing media_url for documents, images, voice notes
        foreach ($messages as $m) {
            if (empty($m->media_url) && ($m->media_type !== 'text' || preg_match('/\.(docx?|pdf|xlsx?|jpg|jpeg|png|webp|mp3|ogg|zip)$/i', $m->text ?? ''))) {
                $targetFile = $m->text ? trim($m->text) : '';
                if ($targetFile) {
                    $cleanTarget = preg_replace('/[^a-zA-Z0-9\.]/', '', strtolower($targetFile));
                    $publicDir = public_path('storage/whatsapp_media');
                    if (is_dir($publicDir)) {
                        $files = scandir($publicDir);
                        foreach ($files as $f) {
                            if ($f === '.' || $f === '..') continue;
                            $cleanF = preg_replace('/[^a-zA-Z0-9\.]/', '', strtolower($f));
                            if (str_ends_with($cleanF, $cleanTarget) || str_contains($cleanF, $cleanTarget)) {
                                $m->media_url = '/whatsapp/media/' . $f;
                                $m->update(['media_url' => $m->media_url]);
                                break;
                            }
                        }
                    }
                }
                if (empty($m->media_url)) {
                    $m->media_url = '/whatsapp/messages/' . $m->id . '/media';
                }
            }
        }

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

                    $mediaUrl = '/storage/whatsapp_media/' . basename($savedPath);
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
        $channelId = $payload['channel_id'] ?? null;
        $resolvedChannel = null;
        if ($channelId && is_numeric($channelId)) {
            $resolvedChannel = WhatsAppChannel::find($channelId);
        }
        if (!$resolvedChannel) {
            $resolvedChannel = WhatsAppChannel::where('agent_name', 'like', '%Shafi%')
                ->where('agent_name', 'not like', '%Faraz%')
                ->where('status', 'connected')
                ->first()
                ?? WhatsAppChannel::where('status', 'connected')->first()
                ?? WhatsAppChannel::orderBy('id', 'desc')->first();
        }
        $channelId = $resolvedChannel ? $resolvedChannel->id : 1;

        $rawMediaType = $payload['media_type'] ?? ($payload['type'] ?? 'text');
        $mediaType = in_array($rawMediaType, ['image', 'document', 'audio', 'video', 'location']) ? $rawMediaType : ($rawMediaType === 'ptt' ? 'audio' : 'text');
        $mediaBase64 = $payload['media_base64'] ?? null;
        $mediaUrl = $payload['media_url'] ?? null;

        if ($mediaType === 'text') {
            if (preg_match('/\.(jpg|jpeg|png|webp|gif)$/i', $messageText)) {
                $mediaType = 'image';
            } elseif (preg_match('/\.(pdf|docx?|xlsx?|txt|zip|csv)$/i', $messageText)) {
                $mediaType = 'document';
            }
        }

        if (empty($messageText)) {
            if ($mediaType === 'image') $messageText = '📷 Photo';
            elseif ($mediaType === 'document') $messageText = '📄 Document';
            elseif ($mediaType === 'audio') $messageText = '🎤 Voice Note';
            elseif ($mediaType === 'video') $messageText = '🎥 Video';
            elseif (!empty($mediaBase64)) $messageText = 'Attachment';
            else return response()->json(['status' => 'SKIPPED_EMPTY'], 200);
        }

        $chatTitle = $payload['name'] ?? ($payload['group_title'] ?? null);
        $isGroup = !empty($payload['is_group']) 
            || str_contains($remoteJid ?? '', '@g.us') 
            || ($payload['phone'] ?? '') === 'Group Chat';

        // Save incoming media base64 if present
        if ($mediaBase64 && str_contains($mediaBase64, ';base64,')) {
            try {
                $publicDir = public_path('storage/whatsapp_media');
                $storageDir = storage_path('app/public/whatsapp_media');
                if (!file_exists($publicDir)) @mkdir($publicDir, 0777, true);
                if (!file_exists($storageDir)) @mkdir($storageDir, 0777, true);

                $parts = explode(';base64,', $mediaBase64);
                $mime = str_replace('data:', '', $parts[0]);
                $rawBinary = base64_decode($parts[1]);

                $ext = 'bin';
                if (str_contains($mime, 'pdf')) $ext = 'pdf';
                elseif (str_contains($mime, 'jpeg') || str_contains($mime, 'jpg')) $ext = 'jpg';
                elseif (str_contains($mime, 'png')) $ext = 'png';
                elseif (str_contains($mime, 'webp')) $ext = 'webp';
                elseif (str_contains($mime, 'word') || str_contains($mime, 'doc') || str_contains($mime, 'officedocument')) $ext = 'docx';
                elseif (str_contains($mime, 'sheet') || str_contains($mime, 'excel') || str_contains($mime, 'spreadsheet') || str_contains($mime, 'xls')) $ext = 'xlsx';
                elseif (str_contains($mime, 'webm')) $ext = 'webm';
                elseif (str_contains($mime, 'mp3') || str_contains($mime, 'audio/mpeg')) $ext = 'mp3';
                elseif (str_contains($mime, 'ogg')) $ext = 'ogg';

                $origName = '';
                if (!empty($payload['filename'])) {
                    $origName = $payload['filename'];
                } elseif (!empty($messageText) && preg_match('/\.[a-zA-Z0-9]{2,5}$/', trim($messageText))) {
                    $origName = trim($messageText);
                } else {
                    $origName = 'in_' . time() . '_' . Str::random(6) . '.' . $ext;
                }

                if (!str_contains($origName, '.')) {
                    $origName .= '.' . $ext;
                }

                $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $origName);
                @file_put_contents($publicDir . '/' . $safeName, $rawBinary);
                @file_put_contents($storageDir . '/' . $safeName, $rawBinary);
                $mediaUrl = '/whatsapp/media/' . $safeName;
            } catch (\Exception $e) {
                \Log::warning('Inbound media save warning: ' . $e->getMessage());
            }
        }

        $isFromMe = !empty($payload['from_me']);
        $channelCleanPhone = $resolvedChannel ? preg_replace('/[^0-9]/', '', $resolvedChannel->phone_number ?? '') : '';
        $channelName = $resolvedChannel ? strtolower(trim($resolvedChannel->agent_name ?? '')) : '';

        if ($isGroup) {
            $groupName = $payload['group_title'] ?: ($payload['name'] ?: 'WhatsApp Group');
            $chat = null;
            if ($remoteJid) {
                $chat = WhatsAppChat::where('remote_jid', $remoteJid)->first();
            }
            if ($chat) {
                $chat->update([
                    'channel_id' => $channelId ?: $chat->channel_id,
                    'phone' => 'Group Chat',
                    'contact_name' => $groupName,
                    'last_message' => $messageText,
                    'last_message_at' => now(),
                ]);
            } else {
                $chat = WhatsAppChat::create([
                    'channel_id' => $channelId,
                    'phone' => 'Group Chat',
                    'remote_jid' => $remoteJid,
                    'contact_id' => null,
                    'contact_name' => $groupName,
                    'last_message' => $messageText,
                    'last_message_at' => now(),
                    'unread_count' => 0,
                ]);
            }
        } else {
            $cleanPhone = $remotePhone ? preg_replace('/[^0-9]/', '', $remotePhone) : '';
            if (!$cleanPhone && $remoteJid && !str_contains($remoteJid, '@lid')) {
                $cleanPhone = preg_replace('/[^0-9]/', '', explode('@', $remoteJid)[0] ?? '');
            }

            // Never treat a 14+ digit LID as a phone number
            if ($cleanPhone && (strlen($cleanPhone) >= 14 || str_contains($remoteJid ?? '', '@lid'))) {
                $lidDigits = preg_replace('/[^0-9]/', '', explode('@', $remoteJid)[0] ?? '');
                if ($cleanPhone === $lidDigits || strlen($cleanPhone) >= 14) {
                    $cleanPhone = '';
                }
            }

            // Discard pushName / chatTitle if it matches the mirrored advisor's own credentials
            if (!empty($pushName)) {
                $pushClean = preg_replace('/[^0-9]/', '', $pushName);
                if (($channelCleanPhone && strlen($pushClean) >= 7 && str_contains($channelCleanPhone, substr($pushClean, -7))) ||
                    ($channelName && strtolower(trim($pushName)) === $channelName) ||
                    strtolower(trim($pushName)) === 'you' ||
                    str_contains($pushName, '@lid') ||
                    strlen($pushClean) >= 14) {
                    $pushName = null;
                }
            }

            if (!empty($chatTitle)) {
                $titleClean = preg_replace('/[^0-9]/', '', $chatTitle);
                if (($channelCleanPhone && strlen($titleClean) >= 7 && str_contains($channelCleanPhone, substr($titleClean, -7))) ||
                    ($channelName && strtolower(trim($chatTitle)) === $channelName) ||
                    strtolower(trim($chatTitle)) === 'you' ||
                    str_contains($chatTitle, '@lid') ||
                    strlen($titleClean) >= 14) {
                    $chatTitle = null;
                }
            }

            // On outbound messages from advisor, never use pushName to rename the client
            if ($isFromMe) {
                $pushName = null;
            }

            // Discard cleanPhone if it matches the advisor's own phone
            if ($channelCleanPhone && $cleanPhone && strlen($cleanPhone) >= 7 && str_contains($channelCleanPhone, substr($cleanPhone, -7))) {
                $cleanPhone = '';
            }

            // Find existing chat by remote_jid OR phone number (GLOBALLY across channels)
            $chat = null;
            if ($remoteJid) {
                $chat = WhatsAppChat::where('remote_jid', $remoteJid)->first();
            }

            if (!$chat && $cleanPhone && strlen($cleanPhone) >= 7) {
                $last7 = substr($cleanPhone, -7);
                $chat = WhatsAppChat::where(function ($q) use ($last7, $cleanPhone) {
                    $q->where('phone', 'like', "%{$last7}%")
                      ->orWhere('phone', "+{$cleanPhone}")
                      ->orWhere('phone', $cleanPhone);
                })->first();
            }

            if (!$chat && $pushName && strlen($pushName) >= 3 && !str_contains($pushName, '@lid')) {
                $chat = WhatsAppChat::where('contact_name', $pushName)->first();
            }

            $resolvedName = $chatTitle ?: $pushName;

            // If existing chat was found, preserve its existing channel_id!
            if ($chat) {
                $channelId = $chat->channel_id;
                $updates = [];
                if ($remoteJid && empty($chat->remote_jid)) {
                    $updates['remote_jid'] = $remoteJid;
                }
                if ($cleanPhone && (empty($chat->phone) || str_contains($chat->phone, '@lid') || $chat->phone === 'Group Chat')) {
                    $updates['phone'] = "+{$cleanPhone}";
                }
                // If phone address book contact name (e.g. Babar Bhai 360i) was provided from gateway, update contact_name!
                if ($resolvedName && !str_contains($resolvedName, '@lid') && !str_starts_with($resolvedName, '+') && $resolvedName !== 'You') {
                    $updates['contact_name'] = $resolvedName;
                } elseif ($pushName && (empty($chat->contact_name) || str_contains($chat->contact_name, '@lid') || str_starts_with($chat->contact_name, '+'))) {
                    $updates['contact_name'] = $pushName;
                }
                if (!empty($updates)) {
                    $chat->update($updates);
                }
            } else {
                // Create new chat
                $displayName = $resolvedName ?: ($cleanPhone ? "+{$cleanPhone}" : ($remoteJid ?: 'WhatsApp Contact'));
                $contact = null;
                $last7 = $cleanPhone ? substr($cleanPhone, -7) : null;
                if ($last7 && !str_contains($remoteJid, '@lid')) {
                    $contact = Contact::where('phone', 'like', "%{$last7}%")
                        ->orWhere('secondary_phone', 'like', "%{$last7}%")
                        ->first();
                }
                if ($contact && empty($resolvedName)) {
                    $displayName = $contact->name;
                }

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

            // Self-name correction: If chat->contact_name currently matches channel phone/name or 'You', heal it!
            $contactClean = preg_replace('/[^0-9]/', '', $chat->contact_name ?? '');
            $isSelfPhone = (!empty($channelCleanPhone) && !empty($contactClean) && strlen($contactClean) >= 7 && str_contains($contactClean, substr($channelCleanPhone, -7)));
            $isSelfName = (!empty($channelName) && strtolower(trim($chat->contact_name ?? '')) === $channelName);

            if ($isSelfPhone || $isSelfName || $chat->contact_name === 'You') {
                $healedName = $chat->contact?->name ?: ($chat->phone && !str_contains($chat->phone, '@lid') && $chat->phone !== 'Group Chat' ? $chat->phone : 'WhatsApp Contact');
                $chat->update(['contact_name' => $healedName]);
                $chat->contact_name = $healedName;
            }
        }

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

        $senderName = $isFromMe ? 'You' : ($pushName ?: $chat->contact_name);
        if ($senderName && str_contains($senderName, '@lid')) {
            $senderName = $chat->contact ? $chat->contact->name : ($chat->contact_name && !str_contains($chat->contact_name, '@lid') ? $chat->contact_name : null);
        }

        // Prevent duplicate messages by ID
        $existingMsg = WhatsAppMessage::where('message_id', $msgId)->first();
        if (!$existingMsg) {
            WhatsAppMessage::create([
                'chat_id' => $chat->id,
                'message_id' => $msgId,
                'from_me' => $isFromMe,
                'sender_name' => $senderName,
                'text' => $messageText,
                'media_url' => $mediaUrl,
                'media_type' => $mediaType,
                'status' => $isFromMe ? 'sent' : 'read',
                'timestamp' => now(),
            ]);
        } else {
            $msgUpdates = [];
            if ($mediaUrl && empty($existingMsg->media_url)) {
                $msgUpdates['media_url'] = $mediaUrl;
            }
            if ($mediaType !== 'text' && ($existingMsg->media_type === 'text' || empty($existingMsg->media_type))) {
                $msgUpdates['media_type'] = $mediaType;
            }
            if (!empty($msgUpdates)) {
                $existingMsg->update($msgUpdates);
            }
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

        // 2. Try finding by matching phone numbers (minimum 7 valid digits)
        if (!$chat && !empty($phones)) {
            $chat = WhatsAppChat::where(function ($q) use ($phones) {
                foreach ($phones as $p) {
                    $cleanP = preg_replace('/[^0-9]/', '', $p);
                    if (strlen($cleanP) >= 7) {
                        $last7 = substr($cleanP, -7);
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

    /**
     * Helper to store raw Base64 media data into public & storage WhatsApp media directories
     */
    public function saveBase64Media($mediaBase64, $origName = null)
    {
        if (empty($mediaBase64) || !str_contains($mediaBase64, ';base64,')) {
            return null;
        }

        try {
            $publicDir = public_path('storage/whatsapp_media');
            $storageDir = storage_path('app/public/whatsapp_media');
            if (!file_exists($publicDir)) @mkdir($publicDir, 0777, true);
            if (!file_exists($storageDir)) @mkdir($storageDir, 0777, true);

            $parts = explode(';base64,', $mediaBase64);
            $mime = str_replace('data:', '', $parts[0]);
            $rawBinary = base64_decode($parts[1]);

            $ext = 'bin';
            if (str_contains($mime, 'pdf')) $ext = 'pdf';
            elseif (str_contains($mime, 'jpeg') || str_contains($mime, 'jpg')) $ext = 'jpg';
            elseif (str_contains($mime, 'png')) $ext = 'png';
            elseif (str_contains($mime, 'webp')) $ext = 'webp';
            elseif (str_contains($mime, 'word') || str_contains($mime, 'doc') || str_contains($mime, 'officedocument')) $ext = 'docx';
            elseif (str_contains($mime, 'sheet') || str_contains($mime, 'excel') || str_contains($mime, 'spreadsheet') || str_contains($mime, 'xls')) $ext = 'xlsx';
            elseif (str_contains($mime, 'webm')) $ext = 'webm';
            elseif (str_contains($mime, 'mp3') || str_contains($mime, 'audio/mpeg')) $ext = 'mp3';
            elseif (str_contains($mime, 'ogg')) $ext = 'ogg';

            $safeOrig = !empty($origName) ? trim($origName) : '';
            if (!empty($safeOrig) && !str_contains($safeOrig, '.')) {
                $safeOrig .= '.' . $ext;
            }
            if (empty($safeOrig)) {
                $safeOrig = 'wa_' . time() . '_' . Str::random(6) . '.' . $ext;
            }

            $cleanName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $safeOrig);
            $safeName = time() . '_' . $cleanName;

            @file_put_contents($publicDir . '/' . $safeName, $rawBinary);
            @file_put_contents($storageDir . '/' . $safeName, $rawBinary);

            return [
                'path' => $publicDir . '/' . $safeName,
                'filename' => $safeName,
                'media_url' => '/whatsapp/media/' . $safeName,
                'mime' => $mime,
            ];
        } catch (\Exception $e) {
            \Log::warning('saveBase64Media error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Direct streaming of WhatsApp media attachments with CORS headers
     */
    public function serveMedia(Request $request, $filename)
    {
        $safeName = basename($filename);
        $candidates = [
            public_path('storage/whatsapp_media/' . $safeName),
            storage_path('app/public/whatsapp_media/' . $safeName),
            storage_path('app/whatsapp_media/' . $safeName),
            public_path('whatsapp_media/' . $safeName),
        ];

        $found = null;
        foreach ($candidates as $candidate) {
            if (file_exists($candidate)) {
                $found = $candidate;
                break;
            }
        }

        // Partial match / suffix match if exact name with timestamp not found
        if (!$found) {
            $dirs = [
                public_path('storage/whatsapp_media'),
                storage_path('app/public/whatsapp_media'),
                storage_path('app/whatsapp_media'),
            ];
            $cleanQuery = preg_replace('/[^a-zA-Z0-9\.]/', '', strtolower($safeName));
            $cleanBase = preg_replace('/^\d+_/', '', $cleanQuery);

            foreach ($dirs as $dir) {
                if (!is_dir($dir)) continue;
                $allFiles = scandir($dir);
                foreach ($allFiles as $f) {
                    if ($f === '.' || $f === '..') continue;
                    $cleanF = preg_replace('/[^a-zA-Z0-9\.]/', '', strtolower($f));
                    if ($cleanF === $cleanQuery || (!empty($cleanBase) && str_ends_with($cleanF, $cleanBase)) || (!empty($cleanBase) && str_contains($cleanF, $cleanBase))) {
                        $found = $dir . '/' . $f;
                        $safeName = $f;
                        break 2;
                    }
                }
            }
        }

        if (!$found) {
            return response()->json(['error' => 'Media file not found'], 404);
        }

        $ext = strtolower(pathinfo($found, PATHINFO_EXTENSION));
        $mimeTypes = [
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc'  => 'application/msword',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls'  => 'application/vnd.ms-excel',
            'pdf'  => 'application/pdf',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
            'mp3'  => 'audio/mpeg',
            'ogg'  => 'audio/ogg',
            'wav'  => 'audio/wav',
            'zip'  => 'application/zip',
            'txt'  => 'text/plain',
            'csv'  => 'text/csv',
        ];
        $mime = $mimeTypes[$ext] ?? (mime_content_type($found) ?: 'application/octet-stream');

        $isDoc = in_array($ext, ['docx', 'doc', 'xlsx', 'xls', 'zip', 'csv', 'pdf']);
        $disposition = ($isDoc || $request->has('download')) ? 'attachment' : 'inline';

        return response()->file($found, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition . '; filename="' . $safeName . '"',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers' => '*',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Stream WhatsApp media by message ID (fetches on-demand from Gateway if not yet cached on disk)
     */
    public function streamMessageMedia(Request $request, $id)
    {
        $msg = WhatsAppMessage::findOrFail($id);

        $found = null;
        $safeName = null;

        // 1. If media_url is present, try resolving file from disk
        if (!empty($msg->media_url) && !str_starts_with($msg->media_url, '/whatsapp/messages/')) {
            $filename = basename(explode('?', $msg->media_url)[0]);
            $candidates = [
                public_path('storage/whatsapp_media/' . $filename),
                storage_path('app/public/whatsapp_media/' . $filename),
                storage_path('app/whatsapp_media/' . $filename),
                public_path('whatsapp_media/' . $filename),
            ];
            foreach ($candidates as $c) {
                if (file_exists($c)) {
                    $found = $c;
                    $safeName = $filename;
                    break;
                }
            }
        }

        // 2. If not found on disk, try finding by text filename on disk
        if (!$found && !empty($msg->text)) {
            $cleanTarget = preg_replace('/[^a-zA-Z0-9\.]/', '', strtolower(trim($msg->text)));
            $dirs = [
                public_path('storage/whatsapp_media'),
                storage_path('app/public/whatsapp_media'),
            ];
            foreach ($dirs as $dir) {
                if (!is_dir($dir)) continue;
                $files = scandir($dir);
                foreach ($files as $f) {
                    if ($f === '.' || $f === '..') continue;
                    $cleanF = preg_replace('/[^a-zA-Z0-9\.]/', '', strtolower($f));
                    if (str_ends_with($cleanF, $cleanTarget) || str_contains($cleanF, $cleanTarget)) {
                        $found = $dir . '/' . $f;
                        $safeName = $f;
                        $msg->update(['media_url' => '/whatsapp/media/' . $f]);
                        break 2;
                    }
                }
            }
        }

        // 3. If still not found, request on-demand download from active WhatsApp gateway
        if (!$found && !empty($msg->message_id)) {
            try {
                $gwUrl = $this->gatewayUrl();
                $gwRes = \Illuminate\Support\Facades\Http::timeout(15)->get($gwUrl . '/api/media/' . urlencode($msg->message_id));
                if ($gwRes->successful()) {
                    $gwData = $gwRes->json();
                    if (!empty($gwData['media_base64'])) {
                        $saved = $this->saveBase64Media($gwData['media_base64'], $gwData['filename'] ?: $msg->text);
                        if ($saved) {
                            $found = $saved['path'];
                            $safeName = $saved['filename'];
                            $msg->update([
                                'media_url' => $saved['media_url'],
                                'media_type' => $gwData['media_type'] ?? $msg->media_type,
                            ]);
                        }
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('On-demand media fetch from gateway failed: ' . $e->getMessage());
            }
        }

        if (!$found || !file_exists($found)) {
            return response()->json([
                'error' => 'Media file not found on server or WhatsApp device',
                'message_id' => $msg->message_id,
            ], 404);
        }

        $ext = strtolower(pathinfo($found, PATHINFO_EXTENSION));
        $mimeTypes = [
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc'  => 'application/msword',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls'  => 'application/vnd.ms-excel',
            'pdf'  => 'application/pdf',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
            'mp3'  => 'audio/mpeg',
            'ogg'  => 'audio/ogg',
            'wav'  => 'audio/wav',
            'zip'  => 'application/zip',
            'txt'  => 'text/plain',
            'csv'  => 'text/csv',
        ];
        $mime = $mimeTypes[$ext] ?? (mime_content_type($found) ?: 'application/octet-stream');

        $isDoc = in_array($ext, ['docx', 'doc', 'xlsx', 'xls', 'zip', 'csv', 'pdf']);
        $disposition = ($isDoc || $request->has('download')) ? 'attachment' : 'inline';
        $downloadName = $msg->text && preg_match('/\.[a-zA-Z0-9]{2,5}$/', trim($msg->text)) ? trim($msg->text) : $safeName;

        return response()->file($found, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition . '; filename="' . $downloadName . '"',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers' => '*',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Cache/fetch media for a specific message on-demand and return json response
     */
    public function fetchMessageMedia($id)
    {
        $msg = WhatsAppMessage::findOrFail($id);

        if (!empty($msg->media_url) && !str_starts_with($msg->media_url, '/whatsapp/messages/')) {
            $fname = basename(explode('?', $msg->media_url)[0]);
            if (file_exists(public_path('storage/whatsapp_media/' . $fname))) {
                return response()->json([
                    'success' => true,
                    'media_url' => $msg->media_url,
                    'media_type' => $msg->media_type,
                ]);
            }
        }

        // Request from WhatsApp Gateway
        if (!empty($msg->message_id)) {
            try {
                $gwUrl = $this->gatewayUrl();
                $gwRes = \Illuminate\Support\Facades\Http::timeout(15)->get($gwUrl . '/api/media/' . urlencode($msg->message_id));
                if ($gwRes->successful()) {
                    $gwData = $gwRes->json();
                    if (!empty($gwData['media_base64'])) {
                        $saved = $this->saveBase64Media($gwData['media_base64'], $gwData['filename'] ?: $msg->text);
                        if ($saved) {
                            $msg->update([
                                'media_url' => $saved['media_url'],
                                'media_type' => $gwData['media_type'] ?? $msg->media_type,
                            ]);
                            return response()->json([
                                'success' => true,
                                'media_url' => $saved['media_url'],
                                'media_type' => $msg->media_type,
                            ]);
                        }
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('fetchMessageMedia error: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => false,
            'error' => 'Could not retrieve media from WhatsApp gateway',
        ], 404);
    }
}

