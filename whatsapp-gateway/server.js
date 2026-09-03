/**
 * FS Advisory CRM — WhatsApp Gateway v2.0
 * Powered by whatsapp-web.js (Puppeteer)
 * Port: 5001
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const cors    = require('cors');
const QRCode  = require('qrcode');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 5001;

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
let connectedUser    = null;
let syncDone         = false;

// ── Init ────────────────────────────────────────────────────────────────────
async function initClient() {
  if (isInitializing) return;
  isInitializing   = true;
  connectionStatus = 'connecting';
  currentQrImage   = null;
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

    const info  = client.info;
    const phone = `+${info?.wid?.user || ''}`;
    connectedUser = { phone, name: info?.pushname || 'Advisor' };
    console.log(`🎉 WhatsApp CONNECTED — ${phone}`);

    // Notify Laravel
    try {
      await fetch('http://127.0.0.1:8000/api/whatsapp/channels/1/pair-confirm', {
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

    // Wipe session folder so it cannot restore logged-out tokens
    try {
      fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
    } catch (_) {}

    // Notify Laravel to mark channel as disconnected
    try {
      await fetch('http://127.0.0.1:8000/api/whatsapp/channels/1/disconnect', { method: 'POST' });
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
    try {
      fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
    } catch (_) {}
    try {
      await fetch('http://127.0.0.1:8000/api/whatsapp/channels/1/disconnect', { method: 'POST' });
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

      console.log(`📨 IN: [${rawJid}] ${phone || name}: "${msg.body.substring(0, 60)}"`);
      await postWebhook({ remote_jid: rawJid, phone, name, id: msg.id._serialized, text: msg.body, type: msg.type, fromMe: false });
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

      console.log(`📤 OUT (Mobile): [${rawJid}] ${phone || name}: "${msg.body.substring(0, 60)}"`);
      await postWebhook({ remote_jid: rawJid, phone, name, id: msg.id._serialized, text: msg.body, type: msg.type, fromMe: true });
    } catch (_) {}
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

async function postWebhook(data) {
  try {
    await fetch('http://127.0.0.1:8000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 1,
        id:         data.id,
        remote_jid: data.remote_jid || data.phone,
        from:       data.remote_jid || data.phone,
        phone:      data.phone || '',
        push_name:  data.name || '',
        text:       data.text,
        media_type: data.type === 'chat' ? 'text' : (data.type || 'text'),
        from_me:    data.fromMe,
      }),
    });
  } catch (e) { console.error('Webhook POST error:', e.message); }
}

async function syncHistoryToLaravel() {
  if (!client || !client.pupPage) return;
  try {
    console.log('📥 Extracting chats & contacts from WhatsApp Web page...');

    const result = await client.pupPage.evaluate(() => {
      try {
        const Collections = window.require('WAWebCollections');
        if (!Collections) return { error: 'No Collections found' };

        // 1. Build LID -> Phone and Name mapping from Contacts
        const contactsArr = Collections.Contact ? Collections.Contact.getModelsArray() : [];
        const lidMap = {};
        const phoneMap = {};

        contactsArr.forEach(ct => {
          const rawId = ct.id?._serialized || '';
          const name = ct.name || ct.pushname || ct.formattedName || '';
          const phone = ct.phoneNumber?._serialized || ct.number || (rawId.includes('@c.us') ? rawId.replace('@c.us', '') : '');
          const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
          const lid = ct.lid?._serialized || (rawId.includes('@lid') ? rawId : '');

          if (cleanPhone) {
            phoneMap[cleanPhone] = name;
            if (rawId) lidMap[rawId] = cleanPhone;
            if (lid) lidMap[lid] = cleanPhone;
          }
        });

        // 2. Extract Chats
        const chatsArr = Collections.Chat ? Collections.Chat.getModelsArray() : [];
        const chatsList = [];

        chatsArr.forEach(c => {
          const rawId = c.id?._serialized || '';
          if (c.isGroup || rawId.includes('@g.us') || rawId.includes('@newsletter') || rawId.includes('status@broadcast')) return;

          let cleanPhone = '';
          if (rawId.includes('@c.us')) {
            cleanPhone = rawId.replace('@c.us', '').replace(/[^0-9]/g, '');
          } else if (rawId.includes('@lid')) {
            cleanPhone = lidMap[rawId] || lidMap[rawId.replace('@lid', '')] || (c.contact?.phoneNumber?._serialized ? c.contact.phoneNumber._serialized.replace(/[^0-9]/g, '') : '') || '';
          }

          if (!cleanPhone) {
            cleanPhone = rawId.split('@')[0].replace(/[^0-9]/g, '');
          }

          const name = c.name || c.formattedTitle || (c.contact?.name || c.contact?.pushname) || phoneMap[cleanPhone] || (cleanPhone ? `+${cleanPhone}` : 'WhatsApp Client');
          const lastMsg = c.lastReceivedKey?._serialized || (c.msgs?.last ? c.msgs.last()?.body : '') || 'Active chat';
          const ts = c.t || c.timestamp || Math.floor(Date.now() / 1000);

          chatsList.push({
            id: rawId,
            phone: cleanPhone ? `+${cleanPhone}` : '',
            name: name,
            last_message: lastMsg,
            timestamp: ts,
            unread_count: c.unreadCount || 0,
          });
        });

        return { success: true, chats: chatsList, contactsCount: contactsArr.length };
      } catch (err) {
        return { success: false, error: err.message || String(err) };
      }
    });

    if (!result || !result.success) {
      console.error('Extraction failed:', result?.error);
      return;
    }

    console.log(`📥 Extracted ${result.chats.length} chats! Syncing to CRM database...`);

    // Send in chunks of 100
    for (let i = 0; i < result.chats.length; i += 100) {
      const batch = result.chats.slice(i, i + 100);
      await sendBatch(batch);
      await sleep(200);
    }

    syncDone = true;
    console.log(`🎉 Successfully synced all ${result.chats.length} chats to Laravel!`);
  } catch (e) {
    console.error('History sync error:', e.message);
  }
}

async function sendBatch(chats) {
  try {
    const res = await fetch('http://127.0.0.1:8000/api/whatsapp/sync-phone-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: 1, chats, contacts: [] }),
    });
    if (res.ok) console.log(`  ✔ Synced batch of ${chats.length} chats`);
    else console.log(`  ✗ Batch sync failed: ${res.status}`);
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
            const c0 = arr[0];
            out.sampleChat = {
              id: c0.id?._serialized,
              name: c0.name,
              formattedTitle: c0.formattedTitle,
              t: c0.t,
              unreadCount: c0.unreadCount
            };
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
  res.json({ status: connectionStatus, qr_image: currentQrImage, expires_in: 60 }));

app.post('/api/send', async (req, res) => {
  if (connectionStatus !== 'connected' || !client)
    return res.status(400).json({ error: 'WhatsApp not connected' });

  const { phone, text, jid, media_base64, media_type, is_voice } = req.body;
  try {
    console.log(`🚀 Processing outbound WhatsApp message -> phone: ${phone}, jid: ${jid}, is_voice: ${!!is_voice}`);

    // Voice Note or Audio Media Transmission (PTT)
    if (media_base64) {
      let base64Clean = media_base64;
      if (media_base64.includes(';base64,')) {
        base64Clean = media_base64.split(';base64,')[1];
      }

      // Convert browser WebM audio to strict WhatsApp-compliant Opus OGG
      if (is_voice || media_type === 'audio') {
        base64Clean = transcodeToWhatsAppOpus(base64Clean);
      }

      let target = jid;
      if (!target && phone) {
        target = `${phone.replace(/[^0-9]/g, '')}@c.us`;
      }

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

            // Send Real Voice Note through WhatsApp Web Internal Engine
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

    // 1. Direct page action via WAWebCollections
    const sendResult = await client.pupPage.evaluate(async (targetJid, targetPhone, msgText) => {
      try {
        const Collections = window.require('WAWebCollections');
        const WidFactory = window.require('WAWebWidFactory');
        const SendTextMsg = window.require('WAWebSendTextMsgChatAction') || window.require('WAWebSendMsgChatAction');

        let chat = null;

        // Try find by targetJid (e.g. 145023882531066@lid or 923452963288@c.us)
        if (targetJid && Collections?.Chat && WidFactory) {
          const wid = WidFactory.createWid(targetJid);
          if (wid) chat = Collections.Chat.get(wid);
        }

        // Try find by phone number in Chat collection
        if (!chat && targetPhone && Collections?.Chat && WidFactory) {
          const clean = targetPhone.replace(/[^0-9]/g, '');
          const cWid = WidFactory.createWid(`${clean}@c.us`);
          if (cWid) chat = Collections.Chat.get(cWid);
        }

        if (chat && SendTextMsg && typeof SendTextMsg.sendTextMsgToChat === 'function') {
          await SendTextMsg.sendTextMsgToChat(chat, msgText);
          return { success: true, method: 'SendTextMsg' };
        }

        if (chat && window.WWebJS && typeof window.WWebJS.sendMessage === 'function') {
          await window.WWebJS.sendMessage(chat, msgText, {}, false);
          return { success: true, method: 'WWebJS' };
        }

        return { fallback: true };
      } catch (err) {
        return { fallback: true, error: err.message || String(err) };
      }
    }, jid, phone, text);

    if (sendResult && sendResult.success) {
      console.log(`✅ Message successfully delivered via WhatsApp Web: "${text}"`);
      return res.json({ success: true, result: sendResult });
    }

    // 2. Fallback to client.sendMessage
    let target = jid;
    if (!target && phone) {
      target = `${phone.replace(/[^0-9]/g, '')}@c.us`;
    }
    const result = await client.sendMessage(target, text);
    console.log(`✅ Message sent via client.sendMessage to ${target}`);
    return res.json({ success: true, result });
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
