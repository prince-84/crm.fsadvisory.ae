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

// ── Resilient Laravel Backend URL Resolver ─────────────────────────────────
const CANDIDATE_LARAVEL_URLS = [
  process.env.LARAVEL_API_URL,
  process.env.LARAVEL_URL,
  'https://api.fsadvisory.ae',
  'http://127.0.0.1:8000',
  'http://localhost:8000',
  'http://127.0.0.1',
  'http://localhost',
].filter(Boolean);

let activeLaravelBase = null;

async function postToLaravel(apiPath, body) {
  const cleanPath = apiPath.startsWith('/') ? apiPath : '/' + apiPath;
  const bases = activeLaravelBase 
    ? [activeLaravelBase, ...CANDIDATE_LARAVEL_URLS.filter(b => b !== activeLaravelBase)]
    : CANDIDATE_LARAVEL_URLS;

  for (const base of bases) {
    try {
      const trimmed = base.replace(/\/+$/, '');
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(`${trimmed}${cleanPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (res.ok) {
        if (activeLaravelBase !== trimmed) {
          activeLaravelBase = trimmed;
          console.log(`📡 Linked WhatsApp gateway to active Laravel backend at: ${activeLaravelBase}`);
        }
        return res;
      }
    } catch (_) {}
  }
  return null;
}

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
let isAuthenticating = false;
let connectionStatus = 'disconnected';
let currentQrImage   = null;
let currentQrRaw     = null;
let currentQrTimestamp = null;
let connectedUser    = null;
let syncDone         = false;

async function resolveLid(jid) {
  if (!jid) return { phone: '', name: '' };

  // 1. Standard phone JID (@c.us or @s.whatsapp.net)
  if (jid.includes('@c.us') || jid.includes('@s.whatsapp.net')) {
    const digits = jid.split('@')[0].replace(/[^0-9]/g, '');
    if (digits && digits.length >= 7 && digits.length <= 13) {
      return { phone: `+${digits}`, name: '' };
    }
  }

  // 2. LID JID (@lid)
  if (jid.includes('@lid')) {
    // Check cached phoneToNameMap first
    if (phoneToNameMap[jid] && phoneToNameMap[jid].startsWith('+')) {
      const cached = phoneToNameMap[jid].replace(/[^0-9]/g, '');
      const myClean = connectedUser?.phone ? connectedUser.phone.replace(/[^0-9]/g, '') : '';
      if (cached.length >= 7 && cached.length <= 13 && cached !== myClean) {
        return { phone: `+${cached}`, name: '' };
      }
    }

    if (!client) return { phone: '', name: '' };

    // Strategy 1: Official client.getContactLidAndPhone
    try {
      if (typeof client.getContactLidAndPhone === 'function') {
        const res = await client.getContactLidAndPhone(jid);
        if (Array.isArray(res) && res.length > 0 && res[0].pn) {
          const pnClean = res[0].pn.replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
          if (pnClean && pnClean.length >= 7 && pnClean.length <= 13) {
            const phone = `+${pnClean}`;
            phoneToNameMap[jid] = phone;
            saveContacts();
            return { phone, name: '' };
          }
        }
      }
    } catch (e1) {
      console.warn(`[LID Resolution] getContactLidAndPhone error for ${jid}:`, e1.message);
    }

    // Strategy 2: Deep evaluation inside WhatsApp Web page
    try {
      if (client.pupPage) {
        const evalRes = await client.pupPage.evaluate(async (lidJid) => {
          try {
            const wid = window.require('WAWebWidFactory').createWid(lidJid);
            const apiContact = window.require('WAWebApiContact');
            let pnWid = null;
            if (apiContact) {
              if (typeof apiContact.getPhoneNumber === 'function') pnWid = apiContact.getPhoneNumber(wid);
              if (!pnWid && typeof apiContact.getAlternateUserWid === 'function') pnWid = apiContact.getAlternateUserWid(wid);
            }
            if (!pnWid) {
              const queryJob = window.require('WAWebQueryExistsJob');
              if (queryJob && typeof queryJob.queryWidExists === 'function') {
                const qRes = await queryJob.queryWidExists(wid);
                if (qRes?.wid && apiContact) {
                  pnWid = apiContact.getPhoneNumber(wid) || apiContact.getAlternateUserWid(wid);
                }
              }
            }

            let cName = '';
            try {
              const contactColl = window.require('WAWebCollections').Contact;
              const contactObj = contactColl.get(wid) || (await contactColl.find(wid));
              if (contactObj) {
                const getters = window.require('WAWebContactGetters');
                cName = (getters && getters.getName(contactObj)) || contactObj.name || contactObj.pushname || '';
              }
            } catch (_) {}

            return {
              pn: pnWid?._serialized || (typeof pnWid === 'string' ? pnWid : (pnWid?.user || '')),
              name: cName
            };
          } catch (err) {
            return { error: err.message };
          }
        }, jid);

        if (evalRes && evalRes.pn) {
          const pnClean = String(evalRes.pn).replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
          if (pnClean && pnClean.length >= 7 && pnClean.length <= 13) {
            const phone = `+${pnClean}`;
            phoneToNameMap[jid] = phone;
            saveContacts();
            return { phone, name: evalRes.name || '' };
          }
        }
      }
    } catch (e2) {
      console.warn(`[LID Resolution] evaluate error for ${jid}:`, e2.message);
    }
  }

  return { phone: '', name: '' };
}

async function triggerPageQrReload() {
  if (!client || !client.pupPage || (typeof client.pupPage.isClosed === 'function' && client.pupPage.isClosed())) return false;
  try {
    const clicked = await client.pupPage.evaluate(() => {
      const reloadBtn = document.querySelector('button[aria-label*="Reload"], span[data-icon="refresh"], div[data-ref] [role="button"]');
      if (reloadBtn) {
        reloadBtn.click();
        return true;
      }
      return false;
    }).catch(() => false);
    if (clicked) {
      console.log('🔄 Clicked reload QR button on WhatsApp Web page');
      return true;
    }
    console.log('🔄 Reloading Puppeteer page for fresh QR code...');
    await client.pupPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    return true;
  } catch (e) {
    console.warn('Could not reload QR:', e.message);
  }
  return false;
}

async function refreshQrSession() {
  if (connectionStatus === 'connected' || connectionStatus === 'connecting' || isAuthenticating) return;
  console.log('🔄 Refreshing WhatsApp Web session for fresh cryptographic QR code...');
  // Note: preserve currentQrImage and currentQrRaw so UI doesn't flicker while reloading
  connectionStatus = 'connecting';
  if (client && client.pupPage) {
    try {
      const clicked = await triggerPageQrReload();
      if (clicked) return;
      console.log('🔄 Reloading Puppeteer page for fresh QR code...');
      await client.pupPage.reload({ waitUntil: 'domcontentloaded' });
      return;
    } catch (_) {}
  }
  initClient();
}

// ── Init ────────────────────────────────────────────────────────────────────
async function initClient() {
  if (isInitializing) return;
  isInitializing   = true;
  isAuthenticating = false;
  connectionStatus = 'connecting';
  currentQrImage   = null;
  currentQrRaw     = null;
  currentQrTimestamp = null;
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
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1044062641-alpha.html',
    },
    qrMaxRetries: 0,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    puppeteer: {
      headless: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--no-default-browser-check',
        '--disable-extensions',
        '--autoplay-policy=no-user-gesture-required',
        '--enable-features=NetworkService,AudioServiceOutOfProcess',
        '--use-fake-ui-for-media-stream',
      ],
    },
  });

  // QR
  client.on('qr', async (qr) => {
    connectionStatus = 'qr_ready';
    isAuthenticating = false;
    currentQrRaw     = qr;
    currentQrTimestamp = Date.now();
    try {
      currentQrImage = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'H', width: 320 });
      console.log('📲 Fresh authentic QR ready — scan with WhatsApp on your phone!');

      // Instantly synchronize live QR to Laravel backend
      postToLaravel('/api/whatsapp/sync-qr', {
        qr_code: qr,
        qr_image: currentQrImage,
        status: 'qr_ready',
        expires_in: 60,
      }).catch(() => {});
    } catch (e) { console.error('QR error:', e.message); }
  });

  // Authenticated (Phone scanned QR code)
  client.on('authenticated', () => {
    console.log('🔑 WhatsApp Authenticated! Phone scanned QR successfully. Finalizing handshake...');
    isAuthenticating = true;
    connectionStatus = 'connecting';
    currentQrImage   = null;
    currentQrRaw     = null;
    postToLaravel('/api/whatsapp/sync-qr', {
      qr_code: null,
      qr_image: null,
      status: 'connecting',
    }).catch(() => {});
  });

  // Loading Screen (Device linking & message decrypting)
  client.on('loading_screen', (percent, message) => {
    console.log(`⏳ WhatsApp Loading Screen: ${percent}% — ${message}`);
    isAuthenticating = true;
    connectionStatus = 'connecting';
  });

  // Ready
  client.on('ready', async () => {
    isInitializing   = false;
    isAuthenticating = false;
    connectionStatus = 'connected';
    currentQrImage   = null;
    currentQrRaw     = null;

    const info  = client.info;
    const phone = `+${info?.wid?.user || ''}`;
    connectedUser = { phone, name: info?.pushname || 'Advisor' };
    console.log(`🎉 WhatsApp CONNECTED — ${phone}`);

    // Notify Laravel with connected phone number
    try {
      await postToLaravel('/api/whatsapp/sync-qr', {
        status: 'connected',
        phone_number: phone,
        connected_user: connectedUser,
        qr_code: null,
        qr_image: null,
      });
      await postToLaravel('/api/whatsapp/channels/active/pair-confirm', {
        phone_number: phone,
        platform: 'whatsapp-web.js (Puppeteer)',
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
    isAuthenticating = false;
    connectedUser    = null;
    currentQrImage   = null;
    currentQrRaw     = null;

    // Wipe session folder so it cannot restore logged-out tokens
    try {
      fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
    } catch (_) {}

    // Notify Laravel to mark channel as disconnected
    try {
      await postToLaravel('/api/whatsapp/sync-qr', {
        status: 'disconnected',
        qr_code: null,
        qr_image: null,
      });
      await postToLaravel('/api/whatsapp/channels/active/disconnect', {});
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
    isAuthenticating = false;
    connectedUser = null;
    currentQrImage = null;
    currentQrRaw = null;
    try {
      fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
    } catch (_) {}
    try {
      await postToLaravel('/api/whatsapp/channels/active/disconnect', {});
    } catch (_) {}
    await sleep(2000);
    initClient();
  });

  // Incoming message (received from client or group)
  client.on('message', async (msg) => {
    if (msg.isStatus || (msg.from && (msg.from.includes('status@broadcast') || msg.from.includes('@newsletter')))) return;
    try {
      const rawJid = msg.from || '';
      const isGroup = !!msg.isGroupMsg || rawJid.includes('@g.us');
      let phone = '';
      let name = '';
      let senderName = '';

      const chat = await msg.getChat().catch(() => null);
      const contact = await msg.getContact().catch(() => null);

      if (isGroup) {
        // WhatsApp Group: Exact group subject title matching mobile phone
        name = chat?.formattedTitle || chat?.name || 'WhatsApp Group';
        phone = 'Group Chat';
        senderName = contact?.name || contact?.pushname || contact?.formattedName || 'Participant';
      } else {
        // 1-on-1 Contact: Address book name from mobile phone takes top priority
        if (contact && contact.name && contact.name.trim()) {
          name = contact.name.trim();
        } else if (chat && chat.formattedTitle && chat.formattedTitle.trim()) {
          name = chat.formattedTitle.trim();
        } else if (contact && contact.formattedName && contact.formattedName.trim()) {
          name = contact.formattedName.trim();
        } else if (contact && contact.pushname && contact.pushname.trim()) {
          name = contact.pushname.trim();
        } else if (chat && chat.name && chat.name.trim()) {
          name = chat.name.trim();
        }

        // Resolve phone & LID
        const resLid = await resolveLid(rawJid);
        if (resLid.phone) phone = resLid.phone;
        if (!name && resLid.name) name = resLid.name;

        if (!phone && !rawJid.includes('@lid')) {
          const num = contact?.number || contact?.id?.user;
          const clean = num ? String(num).replace(/[^0-9]/g, '') : rawJid.split('@')[0].replace(/[^0-9]/g, '');
          if (clean.length >= 7 && clean.length <= 13) {
            phone = `+${clean}`;
          }
        }

        // Strict protection: Never assign mirrored advisor's own phone or name to client
        const myPhoneClean = connectedUser?.phone ? connectedUser.phone.replace(/[^0-9]/g, '') : '';
        if (myPhoneClean) {
          if (phone && phone.replace(/[^0-9]/g, '').includes(myPhoneClean.slice(-7))) phone = '';
          if (name && (name.replace(/[^0-9]/g, '').includes(myPhoneClean.slice(-7)) || name === connectedUser?.name || name === 'You')) name = '';
        }

        if (phone && phone.replace(/[^0-9]/g, '').length >= 14) phone = '';

        if (rawJid && !phone && phoneToNameMap[rawJid] && phoneToNameMap[rawJid] !== connectedUser?.phone) {
          const cached = phoneToNameMap[rawJid].replace(/[^0-9]/g, '');
          if (cached.length <= 13) phone = phoneToNameMap[rawJid];
        }
        if (rawJid && phone && phone !== connectedUser?.phone) {
          phoneToNameMap[rawJid] = phone;
          saveContacts();
        }
      }

      // Download incoming media with 3 retry attempts (allows Puppeteer to decrypt WhatsApp CDN blob)
      let mediaBase64 = null;
      let mediaFilename = '';
      if (msg.hasMedia) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const downloaded = await msg.downloadMedia();
            if (downloaded && downloaded.data) {
              mediaBase64 = `data:${downloaded.mimetype};base64,${downloaded.data}`;
              mediaFilename = downloaded.filename || '';
              break;
            }
          } catch (mediaErr) {
            console.warn(`Media download attempt ${attempt + 1} retry:`, mediaErr.message);
            await sleep(600);
          }
        }
      }

      console.log(`📨 IN: [${rawJid}] ${phone || name}: "${(msg.body || `[${msg.type}]`).substring(0, 60)}" (media: ${!!mediaBase64})`);
      await postWebhook({
        remote_jid: rawJid,
        phone,
        name,
        sender_name: senderName,
        is_group: isGroup,
        id: msg.id._serialized,
        text: msg.body,
        type: msg.type,
        media_base64: mediaBase64,
        filename: mediaFilename,
        fromMe: false
      });
    } catch (e) { console.error('Incoming error:', e.message); }
  });

  // Outgoing message (sent from mobile phone or CRM)
  client.on('message_create', async (msg) => {
    if (!msg.fromMe || msg.isStatus || (msg.to && (msg.to.includes('status@broadcast') || msg.to.includes('@newsletter')))) return;
    try {
      const rawJid = msg.to || msg.id?.remote || '';
      const isGroup = !!msg.isGroupMsg || rawJid.includes('@g.us');
      let phone = '';
      let name = '';

      const chat = await msg.getChat().catch(() => null);

      if (isGroup) {
        name = chat?.formattedTitle || chat?.name || 'WhatsApp Group';
        phone = 'Group Chat';
      } else {
        const contact = await client.getContactById(rawJid).catch(() => null);
        if (contact && contact.name && contact.name.trim()) {
          name = contact.name.trim();
        } else if (chat && chat.formattedTitle && chat.formattedTitle.trim()) {
          name = chat.formattedTitle.trim();
        } else if (contact && contact.formattedName && contact.formattedName.trim()) {
          name = contact.formattedName.trim();
        } else if (contact && contact.pushname && contact.pushname.trim()) {
          name = contact.pushname.trim();
        } else if (chat && chat.name && chat.name.trim()) {
          name = chat.name.trim();
        }

        const resLid = await resolveLid(rawJid);
        if (resLid.phone) phone = resLid.phone;
        if (!name && resLid.name) name = resLid.name;

        if (!phone && !rawJid.includes('@lid')) {
          const clean = rawJid.split('@')[0].replace(/[^0-9]/g, '');
          if (clean.length >= 7 && clean.length <= 13) {
            phone = `+${clean}`;
          }
        }

        const myPhoneClean = connectedUser?.phone ? connectedUser.phone.replace(/[^0-9]/g, '') : '';
        if (myPhoneClean) {
          if (phone && phone.replace(/[^0-9]/g, '').includes(myPhoneClean.slice(-7))) phone = '';
          if (name && (name.replace(/[^0-9]/g, '').includes(myPhoneClean.slice(-7)) || name === connectedUser?.name || name === 'You')) name = '';
        }

        if (phone && phone.replace(/[^0-9]/g, '').length >= 14) phone = '';

        if (rawJid && !phone && phoneToNameMap[rawJid] && phoneToNameMap[rawJid] !== connectedUser?.phone) {
          const cached = phoneToNameMap[rawJid].replace(/[^0-9]/g, '');
          if (cached.length <= 13) phone = phoneToNameMap[rawJid];
        }
        if (rawJid && phone && phone !== connectedUser?.phone) {
          phoneToNameMap[rawJid] = phone;
          saveContacts();
        }
      }

      let mediaBase64 = null;
      let mediaFilename = '';
      if (msg.hasMedia) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const downloaded = await msg.downloadMedia();
            if (downloaded && downloaded.data) {
              mediaBase64 = `data:${downloaded.mimetype};base64,${downloaded.data}`;
              mediaFilename = downloaded.filename || '';
              break;
            }
          } catch (_) {
            await sleep(600);
          }
        }
      }

      console.log(`📤 OUT (Mobile): [${rawJid}] ${phone || name}: "${(msg.body || `[${msg.type}]`).substring(0, 60)}" (media: ${!!mediaBase64})`);
      await postWebhook({
        remote_jid: rawJid,
        phone,
        name,
        is_group: isGroup,
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
    await postToLaravel('/api/whatsapp/webhook', {
      event: 'message_ack',
      type: 'ack',
      channel_id: 'active',
      id: data.id,
      ack: data.ack,
      status: data.status,
    });
  } catch (_) {}
}

async function postWebhook(data) {
  try {
    await postToLaravel('/api/whatsapp/webhook', {
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
            // Only skip status broadcast and newsletter channels
            if (rawId.includes('@newsletter') || rawId.includes('status@broadcast')) {
              continue;
            }

            const isGroup = !!c.isGroup || rawId.includes('@g.us');
            let isLid = rawId.includes('@lid');
            let cleanPhone = '';
            let name = '';

            if (isGroup) {
              name = c.name || c.formattedTitle || 'WhatsApp Group';
              cleanPhone = 'Group Chat';
            } else {
              // 1-on-1 Contact: Fetch contact to retrieve address book name saved on mobile phone
              let contact = null;
              try {
                contact = await c.getContact();
              } catch (_) {}

              // Strict name resolution priority:
              // 1. Phone Address Book Name (contact.name - e.g. "Babar Bhai 360i")
              // 2. Chat UI title (c.formattedTitle - e.g. "Babar Bhai 360i")
              // 3. Contact formattedName
              // 4. Contact pushname (public username)
              // 5. Chat name
              if (contact && contact.name && contact.name.trim()) {
                name = contact.name.trim();
              } else if (c.formattedTitle && c.formattedTitle.trim()) {
                name = c.formattedTitle.trim();
              } else if (contact && contact.formattedName && contact.formattedName.trim()) {
                name = contact.formattedName.trim();
              } else if (contact && contact.pushname && contact.pushname.trim()) {
                name = contact.pushname.trim();
              } else if (c.name && c.name.trim()) {
                name = c.name.trim();
              }

              // Sanitize name: if it's a 14+ digit string (raw LID), don't treat as name
              if (name && name.replace(/[^0-9]/g, '').length >= 14) {
                name = '';
              }

              if (!isLid && (rawId.includes('@c.us') || rawId.includes('@s.whatsapp.net'))) {
                const digits = rawId.split('@')[0].replace(/[^0-9]/g, '');
                if (digits.length >= 7 && digits.length <= 13) {
                  cleanPhone = digits;
                }
              } else if (isLid) {
                const resLid = await resolveLid(rawId);
                if (resLid.phone) {
                  cleanPhone = resLid.phone.replace(/[^0-9]/g, '');
                }
                if (!name && resLid.name) {
                  name = resLid.name;
                }
              }

              if (!name && cleanPhone) {
                name = `+${cleanPhone}`;
              } else if (!name) {
                name = 'WhatsApp Contact';
              }
            }

            let lastMsg = 'Active chat';
            let recentMsgs = [];

            if (c.lastMessage) {
              const lm = c.lastMessage;
              let mediaBase64 = null;
              if (lm.hasMedia && typeof lm.downloadMedia === 'function') {
                for (let a = 0; a < 2; a++) {
                  try {
                    const dl = await lm.downloadMedia();
                    if (dl && dl.data) {
                      mediaBase64 = `data:${dl.mimetype};base64,${dl.data}`;
                      break;
                    }
                  } catch (_) {
                    await sleep(300);
                  }
                }
              }

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
                media_base64: mediaBase64,
                ack: lm.ack ?? 1,
                status: status,
              });
            }

            const ts = c.timestamp || Math.floor(Date.now() / 1000);

            chatsList.push({
              id: rawId,
              phone: isGroup ? 'Group Chat' : (cleanPhone ? `+${cleanPhone}` : ''),
              formattedTitle: c.formattedTitle || c.name || name,
              name: name,
              is_group: isGroup,
              last_message: lastMsg,
              timestamp: ts,
              unread_count: c.unreadCount || 0,
              messages: recentMsgs.filter(m => (m.text && m.text.trim().length > 0) || m.media_base64),
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
            if (rawId.includes('@newsletter') || rawId.includes('status@broadcast')) return;
            const isGroup = !!c.isGroup || rawId.includes('@g.us');
            const cleanPhone = isGroup ? 'Group Chat' : rawId.replace('@c.us', '').replace(/[^0-9]/g, '');
            const name = c.name || c.formattedTitle || (isGroup ? 'WhatsApp Group' : (cleanPhone ? `+${cleanPhone}` : 'WhatsApp Contact'));
            chatsList.push({
              id: rawId,
              phone: isGroup ? 'Group Chat' : (cleanPhone ? `+${cleanPhone}` : ''),
              formattedTitle: c.formattedTitle || name,
              name: name,
              is_group: isGroup,
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
      console.warn('⚠️ No chats found to sync.');
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
    const res = await postToLaravel('/api/whatsapp/sync-phone-data', {
      channel_id: 'active',
      phone_number: connectedUser?.phone || null,
      chats, 
      contacts: [] 
    });
    if (res && res.ok) {
      console.log(`  ✔ Synced batch of ${chats.length} chats to Laravel`);
    } else {
      console.warn(`  ✗ Batch sync failed for ${chats.length} chats`);
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
app.get('/api/status', (_, res) => {
  const now = Date.now();
  const ageMs = currentQrTimestamp ? (now - currentQrTimestamp) : null;
  const isExpired = ageMs !== null && ageMs > 25000;
  res.json({
    status: connectionStatus,
    user: connectedUser,
    has_qr: !!currentQrImage && !isExpired,
    is_expired: isExpired,
    qr_age_sec: currentQrTimestamp ? Math.floor(ageMs / 1000) : null
  });
});

app.get('/api/qr', async (req, res) => {
  const now = Date.now();
  const ageMs = currentQrTimestamp ? (now - currentQrTimestamp) : null;
  const force = req.query.force === '1' || req.query.reload === '1';
  const isCurrentlyFresh = !force && (ageMs !== null && ageMs < 25000 && !!currentQrRaw && !!currentQrImage);

  if (connectionStatus === 'connected') {
    return res.json({
      status: 'connected',
      user: connectedUser,
      qr_image: null,
      qr_code: null,
      is_expired: false,
      expires_in: 0
    });
  }

  // If we don't have a fresh active QR code (< 25s old) or forced reload requested, trigger reload
  if (!isCurrentlyFresh && !isAuthenticating) {
    const prevTimestamp = currentQrTimestamp;
    triggerPageQrReload().catch(() => {});

    // Wait up to 4s for a brand-new QR code to be emitted by WhatsApp Web
    const waitStart = Date.now();
    while (Date.now() - waitStart < 4000) {
      if (currentQrTimestamp && currentQrTimestamp !== prevTimestamp && currentQrRaw && currentQrImage) {
        break;
      }
      await sleep(150);
    }
  }

  const finalAgeMs = currentQrTimestamp ? (Date.now() - currentQrTimestamp) : null;
  const expiresIn = finalAgeMs !== null
    ? Math.max(1, Math.floor((25000 - finalAgeMs) / 1000))
    : 25;

  res.json({
    status: connectionStatus === 'connected' ? 'connected' : (currentQrRaw ? 'qr_ready' : connectionStatus),
    qr_image: currentQrImage,
    qr_code: currentQrRaw,
    is_expired: false,
    expires_in: expiresIn,
    qr_age_sec: finalAgeMs ? Math.floor(finalAgeMs / 1000) : 0,
    user: connectedUser
  });
});

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

app.all(['/api/logout', '/api/reset', '/api/unlink'], async (_, res) => {
  res.json({ success: true, message: 'Unlinking and generating fresh QR...' });
  console.log('🔄 Full reset triggered. Purging saved session & generating fresh QR code...');
  try { if (client) await client.logout(); } catch (_) {}
  try { if (client) await client.destroy(); } catch (_) {}
  client = null;
  try {
    fs.rmSync(path.join(__dirname, 'auth_sessions'), { recursive: true, force: true });
  } catch (_) {}
  connectionStatus = 'connecting';
  currentQrImage   = null;
  currentQrRaw     = null;
  currentQrTimestamp = null;
  connectedUser    = null;
  isInitializing   = false;
  await sleep(1500);
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

// ── Periodic Heartbeat Sync with Laravel ────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const age = currentQrTimestamp ? (now - currentQrTimestamp) : null;

  if (connectionStatus === 'qr_ready') {
    // If QR code hasn't updated for over 35 seconds and we are not in the middle of scanning, reload it once
    if ((age === null || age > 35000) && !isAuthenticating) {
      triggerPageQrReload().catch(() => {});
    }

    if (currentQrRaw && currentQrImage && age !== null && age <= 25000) {
      postToLaravel('/api/whatsapp/sync-qr', {
        qr_code: currentQrRaw,
        qr_image: currentQrImage,
        status: 'qr_ready',
        expires_in: Math.max(1, Math.floor((25000 - age) / 1000)),
      }).catch(() => {});
    }
  } else if (connectionStatus === 'connected' && connectedUser) {
    postToLaravel('/api/whatsapp/sync-qr', {
      qr_code: null,
      qr_image: null,
      status: 'connected',
      phone_number: connectedUser.phone,
      connected_user: connectedUser,
    }).catch(() => {});
  }
}, 10000);

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 WhatsApp Gateway on http://127.0.0.1:${PORT}`);
  initClient();
});

process.on('unhandledRejection', (r) => console.log('UnhandledRejection:', r?.message || r));
process.on('uncaughtException',  (e) => console.log('UncaughtException:',  e?.message || e));
