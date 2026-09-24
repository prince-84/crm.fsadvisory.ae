/**
 * FS Advisory CRM — WhatsApp Gateway v2.0
 * Powered by whatsapp-web.js (Puppeteer)
 * Port: 5003
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const cors    = require('cors');
const QRCode  = require('qrcode');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 5003;
const LARAVEL_URL = (process.env.LARAVEL_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Contacts cache ──────────────────────────────────────────────────────────
const CONTACTS_FILE = path.join(__dirname, 'contacts_map.json');
const phoneToNameMap = {};
if (fs.existsSync(CONTACTS_FILE)) {
  try { Object.assign(phoneToNameMap, JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8'))); } catch (e) {}
}
function saveContacts() {
  try { fs.writeFileSync(CONTACTS_FILE, JSON.stringify(phoneToNameMap, null, 2)); } catch (e) {}
}

// ── State ───────────────────────────────────────────────────────────────────
let client         = null;
let isInitializing = false;
let connectionStatus = 'disconnected';
let currentQrImage   = null;
let currentQrRaw     = null;
let connectedUser    = null;
let syncDone         = false;

// ── Init ────────────────────────────────────────────────────────────────────
async function initClient() {
  if (isInitializing) return;
  isInitializing   = true;
  connectionStatus = 'connecting';
  currentQrImage   = null;
  currentQrRaw     = null;
  connectedUser    = null;
  syncDone         = false;

  // Destroy any existing client
  if (client) {
    try { await client.destroy(); } catch (_) {}
    client = null;
    await sleep(2000);
  }

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, 'auth_sessions'),
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--autoplay-policy=no-user-gesture-required',
        '--enable-features=NetworkService,AudioServiceOutOfProcess',
        '--use-fake-ui-for-media-stream',
      ],
    },
  });

  // QR
  client.on('qr', async (qr) => {
    connectionStatus = 'qr_ready';
    currentQrRaw     = qr;
    try {
      currentQrImage = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'H', width: 300 });
      console.log('📲 QR ready — scan with WhatsApp on your phone!');
    } catch (e) { console.error('QR error:', e.message); }
  });

  // Ready
  client.on('ready', async () => {
    isInitializing   = false;
    connectionStatus = 'connected';
    currentQrImage   = null;
    currentQrRaw     = null;

    const info  = client.info;
    const phone = `+${info?.wid?.user || ''}`;
    connectedUser = { phone, name: info?.pushname || 'Advisor' };
    console.log(`🎉 WhatsApp CONNECTED — ${phone}`);

    // Notify Laravel with connected phone number
    try {
      await fetch(`${LARAVEL_URL}/api/whatsapp/channels/active/pair-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, platform: 'whatsapp-web.js (Puppeteer)' }),
      });
    } catch (_) {}

    // Give WhatsApp Web a moment to fully settle before fetching chats
    await sleep(4000);
    await syncHistoryToLaravel();
  });

  // Disconnected (e.g. Logged out from Mobile Phone WhatsApp Linked Devices)
  client.on('disconnected', async (reason) => {
    console.log('⚠️  WhatsApp Disconnected / Logged Out from Mobile:', reason);
    connectionStatus = 'disconnected';
    isInitializing   = false;
    connectedUser    = null;
    currentQrImage   = null;
    currentQrRaw     = null;

    // Wipe session folder so it cannot restore logged-out tokens
    try {
      fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
    } catch (_) {}

    // Notify Laravel to mark channel as disconnected
    try {
      await fetch(`${LARAVEL_URL}/api/whatsapp/channels/active/disconnect`, { method: 'POST' });
    } catch (_) {}

    // Reinitialize to display fresh QR code for next scan
    await sleep(2000);
    initClient();
  });

  // Auth Failure
  client.on('auth_failure', async (msg) => {
    console.log('⚠️ Auth Failure:', msg);
    connectionStatus = 'disconnected';
    isInitializing = false;
    connectedUser = null;
    currentQrImage = null;
    currentQrRaw = null;
    try {
      fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
    } catch (_) {}
    try {
      await fetch(`${LARAVEL_URL}/api/whatsapp/channels/active/disconnect`, { method: 'POST' });
    } catch (_) {}
    await sleep(2000);
    initClient();
  });

  // Incoming message (received from client)
  client.on('message', async (msg) => {
    if (msg.isStatus || msg.isGroupMsg) return;
    try {
      const rawJid = msg.from || '';
      let phone = '';
      if (rawJid.includes('@c.us') || rawJid.includes('@s.whatsapp.net')) {
        phone = `+${rawJid.split('@')[0].replace(/[^0-9]/g, '')}`;
      }
      let name = '';
      try {
        const chat = await msg.getChat();
        name = chat?.name || chat?.formattedTitle || '';
      } catch (_) {}

      let mediaBase64 = null;
      let mediaFilename = '';
      if (msg.hasMedia) {
        try {
          const downloaded = await msg.downloadMedia();
          if (downloaded) {
            mediaBase64 = `data:${downloaded.mimetype};base64,${downloaded.data}`;
            mediaFilename = downloaded.filename || '';
          }
        } catch (mediaErr) {
          console.warn('Could not download incoming media:', mediaErr.message);
        }
      }

      console.log(`📨 IN: [${rawJid}] ${phone || name}: "${(msg.body || `[${msg.type}]`).substring(0, 60)}"`);
      await postWebhook({
        remote_jid: rawJid,
        phone,
        name,
        id: msg.id._serialized,
        text: msg.body,
        type: msg.type,
        media_base64: mediaBase64,
        filename: mediaFilename,
        fromMe: false
      });
    } catch (e) { console.error('Incoming error:', e.message); }
  });

  // Outgoing message (sent from mobile phone)
  client.on('message_create', async (msg) => {
    if (!msg.fromMe || msg.isStatus || msg.isGroupMsg) return;
    try {
      const rawJid = msg.to || msg.id?.remote || '';
      let phone = '';
      if (rawJid.includes('@c.us') || rawJid.includes('@s.whatsapp.net')) {
        phone = `+${rawJid.split('@')[0].replace(/[^0-9]/g, '')}`;
      }
      let name = '';
      try {
        const chat = await msg.getChat();
        name = chat?.name || chat?.formattedTitle || '';
      } catch (_) {}

      let mediaBase64 = null;
      let mediaFilename = '';
      if (msg.hasMedia) {
        try {
          const downloaded = await msg.downloadMedia();
          if (downloaded) {
            mediaBase64 = `data:${downloaded.mimetype};base64,${downloaded.data}`;
            mediaFilename = downloaded.filename || '';
          }
        } catch (_) {}
      }

      console.log(`📤 OUT (Mobile): [${rawJid}] ${phone || name}: "${(msg.body || `[${msg.type}]`).substring(0, 60)}"`);
      await postWebhook({
        remote_jid: rawJid,
        phone,
        name,
        id: msg.id._serialized,
        text: msg.body,
        type: msg.type,
        media_base64: mediaBase64,
        filename: mediaFilename,
        fromMe: true
      });
    } catch (_) {}
  });

  // Real-time WhatsApp Message Read Receipts / Delivery Acks
  client.on('message_ack', async (msg, ack) => {
    try {
      // ack: -1 Error, 0 Pending, 1 Sent (Server), 2 Delivered (Device), 3 Read, 4 Played
      let status = 'sent';
      if (ack === 2) status = 'delivered';
      else if (ack >= 3) status = 'read';
      else if (ack === 1) status = 'sent';
      else if (ack === 0) status = 'pending';

      const msgId = msg.id?._serialized || msg.id?.id;
      if (msgId) {
        console.log(`👁️ ACK: [${msgId}] ack=${ack} -> status=${status}`);
        await postAckWebhook({
          id: msgId,
          ack,
          status,
        });
      }
    } catch (e) {
      console.error('Ack event error:', e.message);
    }
  });

  client.initialize().catch(async (err) => {
    console.error('Init error:', err.message);
    isInitializing   = false;
    connectionStatus = 'disconnected';
    await sleep(8000);
    initClient();
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postAckWebhook(data) {
  try {
    await fetch(`${LARAVEL_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'message_ack',
        type: 'ack',
        channel_id: 'active',
        id: data.id,
        ack: data.ack,
        status: data.status,
      }),
    });
  } catch (_) {}
}

async function postWebhook(data) {
  try {
    await fetch(`${LARAVEL_URL}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 'active',
        id:         data.id,
        remote_jid: data.remote_jid || data.phone,
        from:       data.remote_jid || data.phone,
        phone:      data.phone || '',
        push_name:  data.name || '',
        text:       data.text,
        media_type: data.type === 'chat' ? 'text' : (data.type || 'text'),
        media_base64: data.media_base64 || null,
        filename:   data.filename || '',
        from_me:    data.fromMe,
      }),
    });
  } catch (e) { console.error('Webhook POST error:', e.message); }
}

async function syncHistoryToLaravel() {
  if (!client) return;
  try {
    console.log('📥 Extracting chats & contacts from WhatsApp Web...');

    let chatsList = [];
    let extractionMethod = 'client.getChats';

    // Strategy 1: Official whatsapp-web.js API (Client.getChats())
    try {
      if (typeof client.getChats === 'function') {
        const rawChats = await client.getChats();
        console.log(`📥 client.getChats() retrieved ${rawChats?.length || 0} chats`);

        if (Array.isArray(rawChats) && rawChats.length > 0) {
          for (const c of rawChats) {
            const rawId = c.id?._serialized || '';
            // Skip groups, status broadcast, newsletter channels
            if (c.isGroup || rawId.includes('@g.us') || rawId.includes('@newsletter') || rawId.includes('status@broadcast')) {
              continue;
            }

            let cleanPhone = rawId.replace('@c.us', '').replace(/[^0-9]/g, '');
            if (!cleanPhone && c.id?.user) {
              cleanPhone = String(c.id.user).replace(/[^0-9]/g, '');
            }

            let name = c.name || c.formattedTitle || '';
            if (!name && cleanPhone) {
              name = `+${cleanPhone}`;
            } else if (!name) {
              name = 'WhatsApp Contact';
            }

            let lastMsg = 'Active chat';
            let recentMsgs = [];

            if (c.lastMessage) {
              const lm = c.lastMessage;
              lastMsg = lm.body || lm.caption || (lm.type !== 'chat' ? `[${lm.type || 'Media'}]` : 'Active chat');
              let status = 'sent';
              if (lm.ack === 2) status = 'delivered';
              else if (lm.ack >= 3) status = 'read';
              else if (lm.ack === 1) status = 'sent';
              else if (lm.ack === 0) status = 'pending';
              else if (!lm.fromMe) status = 'read';

              recentMsgs.push({
                id: lm.id?._serialized || ('WA-' + Math.random().toString(36).substr(2, 9)),
                text: lm.body || lm.caption || (lm.type !== 'chat' ? `[${lm.type || 'Media'}]` : ''),
                from_me: !!lm.fromMe,
                timestamp: lm.timestamp || c.timestamp || Math.floor(Date.now() / 1000),
                media_type: lm.type === 'chat' ? 'text' : (lm.type || 'text'),
                ack: lm.ack ?? 1,
                status: status,
              });
            }

            const ts = c.timestamp || Math.floor(Date.now() / 1000);

            chatsList.push({
              id: rawId,
              phone: cleanPhone ? `+${cleanPhone}` : '',
              formattedTitle: c.name || '',
              name: name,
              last_message: lastMsg,
              timestamp: ts,
              unread_count: c.unreadCount || 0,
              messages: recentMsgs.filter(m => m.text && m.text.trim().length > 0),
            });
          }
        }
      }
    } catch (e1) {
      console.warn('Strategy 1 (client.getChats) warning:', e1.message);
    }

    // Strategy 2: Fallback via pupPage evaluate if Strategy 1 returned 0 chats
    if (chatsList.length === 0 && client.pupPage) {
      try {
        const evalResult = await client.pupPage.evaluate(async () => {
          try {
            let chats = [];
            if (window.WWebJS && typeof window.WWebJS.getChats === 'function') {
              chats = await window.WWebJS.getChats();
            } else if (window.Store && window.Store.Chat) {
              chats = window.Store.Chat.getModelsArray ? window.Store.Chat.getModelsArray() : [];
            }
            if (!Array.isArray(chats) || chats.length === 0) return [];
            return chats.map(c => ({
              id: c.id?._serialized || '',
              name: c.name || c.formattedTitle || '',
              formattedTitle: c.formattedTitle || '',
              isGroup: !!c.isGroup,
              unreadCount: c.unreadCount || 0,
              timestamp: c.t || c.timestamp || Math.floor(Date.now() / 1000),
              lastMsgBody: c.lastMessage?.body || (c.msgs?.last ? c.msgs.last()?.body : '') || '',
            }));
          } catch (_) {
            return [];
          }
        });

        if (Array.isArray(evalResult) && evalResult.length > 0) {
          extractionMethod = 'pupPage Store/WWebJS fallback';
          evalResult.forEach(c => {
            const rawId = c.id || '';
            if (c.isGroup || rawId.includes('@g.us') || rawId.includes('@newsletter') || rawId.includes('status@broadcast')) return;
            const cleanPhone = rawId.replace('@c.us', '').replace(/[^0-9]/g, '');
            const name = c.name || c.formattedTitle || (cleanPhone ? `+${cleanPhone}` : 'WhatsApp Contact');
            chatsList.push({
              id: rawId,
              phone: cleanPhone ? `+${cleanPhone}` : '',
              formattedTitle: c.formattedTitle || '',
              name: name,
              last_message: c.lastMsgBody || 'Active chat',
              timestamp: c.timestamp,
              unread_count: c.unreadCount || 0,
              messages: c.lastMsgBody ? [{
                id: 'WA-' + Math.random().toString(36).substr(2, 9),
                text: c.lastMsgBody,
                from_me: false,
                timestamp: c.timestamp,
                media_type: 'text',
                ack: 1,
                status: 'read',
              }] : [],
            });
          });
        }
      } catch (e2) {
        console.warn('Strategy 2 (pupPage eval) error:', e2.message);
      }
    }

    if (chatsList.length === 0) {
      console.warn('⚠️ No 1-on-1 chats found to sync.');
      return;
    }

    console.log(`📥 Extracted ${chatsList.length} chats (via ${extractionMethod})! Syncing to CRM database...`);

    // Send in chunks of 50
    for (let i = 0; i < chatsList.length; i += 50) {
      const batch = chatsList.slice(i, i + 50);
      await sendBatch(batch);
      await sleep(150);
    }

    syncDone = true;
    console.log(`🎉 Successfully synced all ${chatsList.length} chats to Laravel!`);
  } catch (e) {
    console.error('History sync error:', e.message);
  }
}

async function sendBatch(chats) {
  try {
    const res = await fetch(`${LARAVEL_URL}/api/whatsapp/sync-phone-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        channel_id: 'active',
        phone_number: connectedUser?.phone || null,
        chats, 
        contacts: [] 
      }),
    });
    if (res.ok) {
      console.log(`  ✔ Synced batch of ${chats.length} chats`);
    } else {
      const txt = await res.text().catch(() => '');
      console.log(`  ✗ Batch sync failed: ${res.status} - ${txt.slice(0, 100)}`);
    }
  } catch (e) { console.error('Batch error:', e.message); }
}

app.get('/api/test-chats', async (req, res) => {
  if (!client || !client.pupPage) return res.json({ error: 'no page' });
  try {
    const data = await client.pupPage.evaluate(() => {
      const out = {};
      try {
        const Collections = window.require('WAWebCollections');
        out.hasCollections = !!Collections;
        out.collectionsKeys = Object.keys(Collections || {});
        if (Collections && Collections.Chat) {
          const arr = Collections.Chat.getModelsArray();
          out.chatsCount = arr.length;
          if (arr.length > 0) {
            out.sampleChats = arr.slice(0, 5).map(c => ({
              id: c.id?._serialized,
              name: c.name,
              formattedTitle: c.formattedTitle,
              t: c.t,
              unreadCount: c.unreadCount,
              contactName: c.contact?.name,
              contactPushname: c.contact?.pushname,
              contactPhone: c.contact?.phoneNumber?._serialized || c.contact?.id?._serialized,
              lastMsgBody: c.msgs?.last ? c.msgs.last()?.body : (c.lastReceivedKey?._serialized || ''),
            }));
          }
        }
      } catch (err) {
        out.error = err.message || String(err);
      }
      return out;
    });
    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.all(['/api/sync', '/api/sync-now'], async (req, res) => {
  try {
    console.log('🔄 Manual Sync Triggered via API');
    await syncHistoryToLaravel();
    res.json({ success: true, syncDone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Voice Transcoder ────────────────────────────────────────────────────────
const ffmpegPath = require('ffmpeg-static');
const { execSync } = require('child_process');

function transcodeToWhatsAppOpus(base64Data) {
  const tmpIn = path.join(__dirname, `tmp_in_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.webm`);
  const tmpOut = path.join(__dirname, `tmp_out_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.ogg`);
  try {
    fs.writeFileSync(tmpIn, Buffer.from(base64Data, 'base64'));
    execSync(`"${ffmpegPath}" -y -i "${tmpIn}" -c:a libopus -b:a 32k -vbr on -application voip -page_duration 20000 "${tmpOut}"`, { stdio: 'ignore' });
    const opusBuffer = fs.readFileSync(tmpOut);
    return opusBuffer.toString('base64');
  } catch (err) {
    console.error('Audio transcode warning:', err.message);
    return base64Data;
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
  }
}

// ── REST API ────────────────────────────────────────────────────────────────
app.get('/api/status', (_, res) =>
  res.json({ status: connectionStatus, user: connectedUser, has_qr: !!currentQrImage }));

app.get('/api/qr', (_, res) =>
  res.json({
    status: connectionStatus,
    qr_image: currentQrImage,
    qr_code: currentQrRaw,
    expires_in: 60
  }));

app.post('/api/send', async (req, res) => {
  if (connectionStatus !== 'connected' || !client)
    return res.status(400).json({ error: 'WhatsApp not connected' });

  const { phone, text, jid, media_base64, media_type, is_voice, filename } = req.body;
  try {
    console.log(`🚀 Processing outbound WhatsApp message -> phone: ${phone}, jid: ${jid}, is_voice: ${!!is_voice}, media_type: ${media_type || 'text'}`);

    // Media Transmission (Voice Note OR Image / Document / PDF)
    if (media_base64) {
      let base64Clean = media_base64;
      if (media_base64.includes(';base64,')) {
        base64Clean = media_base64.split(';base64,')[1];
      }

      let target = jid;
      if (!target && phone) {
        target = `${phone.replace(/[^0-9]/g, '')}@c.us`;
      }

      // 1. Voice Note (PTT)
      if (is_voice || media_type === 'audio') {
        base64Clean = transcodeToWhatsAppOpus(base64Clean);

        const mediaPayload = {
          mimetype: 'audio/ogg; codecs=opus',
          data: base64Clean,
          filename: 'voice_note.ogg'
        };

        try {
          const sendResult = await client.pupPage.evaluate(async (targetJid, targetPhone, mediaInfo, isVoice) => {
            try {
              const widFactory = window.require('WAWebWidFactory');
              const collections = window.require('WAWebCollections');

              let wid = null;
              if (targetJid) {
                wid = widFactory.createWid(targetJid);
              } else if (targetPhone) {
                const clean = targetPhone.replace(/[^0-9]/g, '');
                wid = widFactory.createWid(`${clean}@c.us`);
              }

              if (!wid) throw new Error('Could not create WID for voice note');

              let chat = collections.Chat.get(wid);
              if (!chat) {
                try {
                  const findChat = window.require('WAWebFindChat');
                  const found = await findChat.findChat(wid);
                  chat = found?.chat || found;
                } catch (_) {}
              }

              if (!chat) {
                chat = collections.Chat.getModelsArray().find((c) => {
                  const idStr = c.id?._serialized || '';
                  return (targetJid && idStr === targetJid) || (targetPhone && idStr.includes(targetPhone.replace(/[^0-9]/g, '')));
                });
              }

              if (!chat) throw new Error('Chat model not found');

              const options = {
                media: mediaInfo,
                sendAudioAsVoice: isVoice,
              };

              const msg = await window.WWebJS.sendMessage(chat, '', options);
              return {
                success: true,
                messageId: msg?.id?._serialized || msg?.id?.id || 'sent',
              };
            } catch (evalErr) {
              return { success: false, error: evalErr.message || evalErr.name || String(evalErr) };
            }
          }, target, phone, mediaPayload, !!is_voice);

          if (sendResult && sendResult.success) {
            console.log(`🎤 Official Push-To-Talk Voice Note delivered to ${target}! ID: ${sendResult.messageId}`);
            return res.json({ success: true, result: sendResult });
          } else {
            console.log('Voice send failed:', sendResult?.error);
            return res.status(500).json({ error: sendResult?.error || 'Failed to send voice note' });
          }
        } catch (voiceOuterErr) {
          console.log('Voice outer error:', voiceOuterErr.message);
          return res.status(500).json({ error: voiceOuterErr.message });
        }
      }

      // 2. Image, PDF, Brochure, Contract or Document Attachment
      try {
        let mime = 'application/octet-stream';
        if (media_base64.includes(';base64,')) {
          mime = media_base64.split(';base64,')[0].replace('data:', '');
        } else if (media_type === 'image') {
          mime = 'image/jpeg';
        } else if (media_type === 'document' || media_type === 'pdf') {
          mime = 'application/pdf';
        }

        const safeFilename = filename || (media_type === 'image' ? 'photo.jpg' : 'document.pdf');
        const mediaAttachment = new MessageMedia(mime, base64Clean, safeFilename);

        const sent = await client.sendMessage(target, mediaAttachment, { caption: text || '' });
        console.log(`📎 Attachment [${mime} - ${safeFilename}] delivered to ${target}! ID: ${sent?.id?._serialized}`);
        return res.json({ success: true, messageId: sent?.id?._serialized, status: 'sent', ack: 1 });
      } catch (attachErr) {
        console.error('Attachment transmission error:', attachErr.message);
        return res.status(500).json({ error: attachErr.message });
      }
    }

    // Direct client.sendMessage for text (reliable ack and id tracking)
    let target = jid;
    if (!target && phone) {
      target = `${phone.replace(/[^0-9]/g, '')}@c.us`;
    }
    const result = await client.sendMessage(target, text);
    console.log(`✅ Message sent via client.sendMessage to ${target}, ID: ${result?.id?._serialized}`);
    return res.json({ success: true, messageId: result?.id?._serialized, status: 'sent', ack: 1, result });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/avatar/:phone', async (req, res) => {
  if (connectionStatus !== 'connected')
    return res.status(503).json({ success: false });
  try {
    const jid = `${req.params.phone.replace(/[^0-9]/g, '')}@c.us`;
    const url  = await client.getProfilePicUrl(jid);
    return url ? res.json({ success: true, url }) : res.status(404).json({ success: false });
  } catch (e) {
    return res.status(404).json({ success: false });
  }
});

app.post('/api/logout', async (_, res) => {
  res.json({ success: true, message: 'Logging out...' });
  try { if (client) await client.logout(); } catch (_) {}
  try {
    fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
  } catch (_) {}
  connectionStatus = 'disconnected';
  await sleep(3000);
  initClient();
});

app.post('/api/restart', async (_, res) => {
  res.json({ success: true, message: 'Restarting...' });
  isInitializing = false;
  await sleep(1000);
  initClient();
});

// Manually trigger chat sync
app.post('/api/test-audio-send', async (req, res) => {
  try {
    const { targetJid, base64Audio } = req.body;
    const result = await client.pupPage.evaluate(async (target, b64) => {
      const results = {};
      const paramsToTest = [
        { name: 'voice_ptt', options: { isPtt: true } },
        { name: 'audio_normal', options: { isPtt: false } },
        { name: 'doc_audio', options: { asDocument: true } }
      ];

      const WidFactory = window.require('WAWebWidFactory');
      const Collections = window.require('WAWebCollections');
      const wid = WidFactory.createWid(target);
      let chat = Collections.Chat.get(wid);
      if (!chat) {
        const findChat = window.require('WAWebFindChat');
        chat = await findChat.findChat(wid);
        chat = chat?.chat || chat;
      }

      const binaryData = window.atob(b64);
      const buffer = new ArrayBuffer(binaryData.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binaryData.length; i++) view[i] = binaryData.charCodeAt(i);
      const blob = new Blob([buffer], { type: 'audio/ogg' });
      const file = new File([blob], 'voice.ogg', { type: 'audio/ogg', lastModified: Date.now() });

      const OpaqueData = window.require('WAWebMediaOpaqueData');
      const opaqueData = await OpaqueData.createFromData(file, 'audio/ogg');

      for (const p of paramsToTest) {
        try {
          const mediaPrep = window.require('WAWebPrepRawMedia').prepRawMedia(opaqueData, p.options);
          const mediaData = await mediaPrep.waitForPrep();
          results[p.name] = { success: true, type: mediaData.type, duration: mediaData.duration };
        } catch (e) {
          results[p.name] = { error: e.message || e.name || String(e) };
        }
      }
      return results;
    }, targetJid, base64Audio);
    return res.json(result);
  } catch (err) {
    return res.json({ error: err.message });
  }
});

app.get('/api/inspect-media', async (req, res) => {
  try {
    const inspection = await client.pupPage.evaluate(() => {
      const results = {};
      const modules = [
        'WAWebPrepRawMedia',
        'WAWebMediaOpaqueData',
        'WAWebUploadManager',
        'WAWebSendMsgChatAction',
        'WAWebSendMediaMsgAction',
        'WAWebMediaStorage',
        'WAWebMediaDataUtils',
        'WAWebMmsMediaTypes',
        'WAWebCollections'
      ];
      for (const m of modules) {
        try {
          const mod = window.require(m);
          results[m] = mod ? Object.keys(mod) : null;
        } catch (e) {
          results[m] = 'ERROR: ' + e.message;
        }
      }
      return results;
    });
    return res.json(inspection);
  } catch (err) {
    return res.json({ error: err.message });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 WhatsApp Gateway on http://127.0.0.1:${PORT}`);
  initClient();
});

process.on('unhandledRejection', (r) => console.log('UnhandledRejection:', r?.message || r));
process.on('uncaughtException',  (e) => console.log('UncaughtException:',  e?.message || e));
