'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  QrCode, 
  Smartphone, 
  BatteryCharging, 
  Wifi, 
  WifiOff, 
  Search, 
  Send, 
  Paperclip, 
  Smile, 
  Check, 
  CheckCheck, 
  Phone, 
  ExternalLink, 
  Plus, 
  RefreshCw, 
  Briefcase, 
  User, 
  Calendar, 
  MoreVertical, 
  SlidersHorizontal, 
  Sparkles, 
  ChevronRight, 
  X,
  FileText,
  Clock,
  Building,
  ShieldCheck,
  Zap,
  Edit3,
  Mic,
  Trash2,
  Play,
  Pause,
  Volume2,
  AlertTriangle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Swal from 'sweetalert2';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { hasPermission } from '@/lib/permissions';
import AccessDenied from '@/components/AccessDenied';
import { API_BASE_URL } from '@/lib/api';

const GATEWAY_URL = (process.env.NEXT_PUBLIC_WHATSAPP_GATEWAY_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '');

// Emoji dataset for WhatsApp Real Estate & Chat
const emojiCategories = {
  smileys: {
    label: '😃 Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🥹','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🫣','🤭','🫡','🤫','🤥','😶','😐','😑','😬','🫨','🤤','😪','😴','😷','🤒','🤕','🤢','🤮','🤧','😵','🤠','🥳']
  },
  gestures: {
    label: '👍 Gestures',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','👂','👃','👀','👁️','👅','👄','🫦','🧠','👤','👥','🫂']
  },
  realestate: {
    label: '🏢 Properties & Deals',
    emojis: ['🏢','🏠','🏡','🏘️','🏙️','🏗️','🏛️','🏬','🏨','🏦','🏪','🏫','🏩','💒','🏰','🏯','💰','💵','💸','💳','🪙','💹','📈','📉','📊','📑','📋','📁','📂','📄','📜','📝','📞','📱','📲','📧','✉️','📩','📨','💼','🗂️','📅','📆','🗓️','🏷️','🔑','🗝️','🔒','🔓','📍','🗺️','🧭','🚗','🏎️','🚙','✈️','🛫','🛬','🚢','🛥️','💎','💍','🏆','🥇','⭐','🌟','✨']
  },
  symbols: {
    label: '✨ Badges & Hearts',
    emojis: ['✅','❌','⭕','🛑','⛔','⚠️','🚨','⚡','💡','🔔','🔕','🎯','📌','📍','🚩','🏁','💯','🔥','💥','💢','💦','💤','💬','💭','📢','📣','🟢','🔴','🟡','🔵','🟣','🟠','⚪','⚫','🟩','🟥','🟨','🟦','🟪','🟧','⬜','⬛','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝']
  }
};

// WhatsApp Push-to-Talk Voice Note Player Component
function WhatsAppAudioPlayer({ audioUrl, isFromMe, durationText }: { audioUrl?: string; isFromMe: boolean; durationText?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatSecs = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 py-1.5 min-w-[240px] sm:min-w-[270px]">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 shrink-0 shadow-xs cursor-pointer ${
          isFromMe ? 'bg-[#25D366] text-[#081428]' : 'bg-[#081428] text-[#25D366]'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Scrubber & Duration */}
      <div className="flex-1 flex flex-col justify-center space-y-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-[#25D366]"
        />
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>{formatSecs(currentTime)}</span>
          <span>{duration > 0 ? formatSecs(duration) : (durationText?.replace('🎤 ', '') || 'Voice Note')}</span>
        </div>
      </div>

      {/* Speed & Mic Badge */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={toggleSpeed}
          className="px-1.5 py-0.5 rounded bg-black/10 hover:bg-black/20 text-[10px] font-bold font-mono text-[#081428] transition-colors"
          title="Playback Speed"
        >
          {playbackRate}x
        </button>
        <span className="text-[11px]" title="WhatsApp Voice Note">🎙️</span>
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  const [canViewWhatsApp, setCanViewWhatsApp] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPerms = () => {
      setCanViewWhatsApp(hasPermission('whatsapp.view'));
    };
    checkPerms();
    window.addEventListener('crm_user_updated', checkPerms);
    window.addEventListener('storage', checkPerms);
    return () => {
      window.removeEventListener('crm_user_updated', checkPerms);
      window.removeEventListener('storage', checkPerms);
    };
  }, []);
  // State
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // QR Pairing Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrChannelId, setQrChannelId] = useState<number | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [qrImageData, setQrImageData] = useState<string>(''); // base64 PNG from gateway
  const [qrTimer, setQrTimer] = useState<number>(45);
  const [pairingLoading, setPairingLoading] = useState<boolean>(false);

  // Template Replies & Emojis
  const [showTemplates, setShowTemplates] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<string>('smileys');
  const [emojiSearch, setEmojiSearch] = useState<string>('');

  // Gateway & Connection State
  const [gatewayStatus, setGatewayStatus] = useState<'connected' | 'disconnected' | 'qr_ready'>('disconnected');

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const quickTemplates = [
    { label: '🏢 Dubai Hills Floor Plan', text: 'Hello! I have attached the latest floor plans and master layout brochure for the 3BR Townhouse in Dubai Hills Estate.' },
    { label: '💰 80/20 Payment Plan', text: 'Here is the payment plan: 20% on booking, 60% during construction, and 20% on handover in Q4 2026 with 100% DLD fee waiver.' },
    { label: '📍 Site Viewing Location', text: 'We have reserved your VIP private viewing slot. Here is the Google Maps location pin for the show villa entrance: https://maps.google.com/?q=Dubai+Hills+Sales+Pavilion' },
    { label: '✍️ Form F SPA Contract', text: 'Please review the attached Form F sales contract agreement draft and reply with your passport copy confirmation.' },
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatIdRef = useRef<number | null>(null);

  // Load Channels on mount
  useEffect(() => {
    loadChannels(true);
    loadChats(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const phone = params.get('phone');
      const name = params.get('name');
      if (phone) {
        setSearchQuery(phone.replace(/[^0-9]/g, ''));
      } else if (name) {
        setSearchQuery(name);
      }
    }
  }, []);

  // Poll chats & active messages in background without resetting UI
  useEffect(() => {
    const interval = setInterval(() => {
      loadChats(false);
      // Poll gateway status to immediately catch mobile sign-out
      fetch(`${GATEWAY_URL}/api/status`)
        .then((r) => r.json())
        .then((st) => {
          setGatewayStatus(st.status);
          if (st.status === 'disconnected' || st.status === 'qr_ready') {
            loadChannels(false);
          }
        })
        .catch(() => {
          setGatewayStatus('disconnected');
        });

      // Also fetch new messages for current active chat silently
      if (selectedChatIdRef.current) {
        fetch(`${API_BASE_URL}/whatsapp/chats/${selectedChatIdRef.current}/messages`)
          .then((r) => r.json())
          .then((data) => {
            if (data.messages && data.chat?.id === selectedChatIdRef.current) {
              setMessages(data.messages);
            }
          })
          .catch(() => {});
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedChannelId, unreadOnly]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // QR Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if (isQrModalOpen && qrTimer > 0) {
      timer = setInterval(() => {
        setQrTimer((prev) => prev - 1);
      }, 1000);
    } else if (qrTimer === 0 && isQrModalOpen) {
      handleRefreshQr();
    }
    return () => clearInterval(timer);
  }, [isQrModalOpen, qrTimer]);

  const loadChannels = async (checkAutoQr = false) => {
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp/channels`);
      const data = await res.json();
      const chList = data.channels || [];
      setChannels(chList);

      // Check Gateway connection state
      try {
        const gwRes = await fetch(`${GATEWAY_URL}/api/status`);
        const gwData = await gwRes.json();
        setGatewayStatus(gwData.status);
        if (checkAutoQr && gwData.status !== 'connected') {
          handleOpenQrModal();
        }
      } catch (_) {
        setGatewayStatus(data.total_connected > 0 ? 'connected' : 'disconnected');
      }
    } catch (e) {
      console.error('Failed to load channels', e);
    }
  };

  const loadChats = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      let url = `${API_BASE_URL}/whatsapp/chats?channel_id=${selectedChannelId}`;
      if (unreadOnly) url += '&unread_only=true';

      const res = await fetch(url);
      const data = await res.json();
      const chatList = data.chats || [];
      setChats(chatList);

      // Select matching chat from URL params or first chat on initial load
      if (!selectedChatIdRef.current && chatList.length > 0) {
        let selected = false;
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const searchPhone = params.get('phone')?.replace(/[^0-9]/g, '');
          const searchName = params.get('name')?.toLowerCase();
          if (searchPhone || searchName) {
            const matched = chatList.find((c: any) => {
              const cPhone = c.phone?.replace(/[^0-9]/g, '') || '';
              const cName = (c.contact_name || c.contact?.name || '').toLowerCase();
              return (searchPhone && (cPhone.includes(searchPhone) || searchPhone.includes(cPhone))) ||
                     (searchName && cName.includes(searchName));
            });
            if (matched) {
              handleSelectChat(matched);
              selected = true;
            }
          }
        }
        if (!selected) {
          handleSelectChat(chatList[0]);
        }
      } else if (selectedChatIdRef.current) {
        const current = chatList.find((c: any) => c.id === selectedChatIdRef.current);
        if (current) {
          setSelectedChat(current);
        }
      }
    } catch (e) {
      console.error('Failed to load chats', e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Instant 100% Frontend In-Memory Filter
  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      if (unreadOnly && c.unread_count === 0) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (c.contact_name || '').toLowerCase().includes(q);
      const phoneMatch = (c.phone || '').toLowerCase().includes(q);
      const msgMatch = (c.last_message || '').toLowerCase().includes(q);
      const crmNameMatch = (c.contact?.name || '').toLowerCase().includes(q);
      const crmPhoneMatch = (c.contact?.phone || '').toLowerCase().includes(q);

      return nameMatch || phoneMatch || msgMatch || crmNameMatch || crmPhoneMatch;
    });
  }, [chats, searchQuery, unreadOnly]);

  const handleSelectChat = async (chat: any) => {
    selectedChatIdRef.current = chat.id;
    setSelectedChat(chat);
    setLoadingMessages(true);
      try {
        const res = await fetch(`${API_BASE_URL}/whatsapp/chats/${chat.id}/messages`);
        const data = await res.json();
        setMessages(data.messages || []);
        
        // If the backend fetched a new avatar, update it locally
        if (data.chat?.avatar_url) {
          setSelectedChat((prev: any) => ({ ...prev, avatar_url: data.chat.avatar_url }));
        }

        // Update unread count and avatar in local state
        setChats((prev) =>
          prev.map((c) => (c.id === chat.id ? { 
            ...c, 
            unread_count: 0,
            avatar_url: data.chat?.avatar_url || c.avatar_url 
          } : c))
        );
      } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !selectedChat || sending) return;

    const outgoingText = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp/chats/${selectedChat.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: outgoingText }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setChats((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id
              ? { ...c, last_message: outgoingText, last_message_at: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (e) {
      console.error('Failed to send message', e);
    } finally {
      setSending(false);
    }
  };

  // Voice Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Microphone Permission Needed',
        text: 'Please allow microphone access in your browser to record and send WhatsApp voice notes.',
        confirmButtonColor: '#081428',
      });
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording || !selectedChat || sending) return;

    setIsRecording(false);
    setSending(true);

    const recorder = mediaRecorderRef.current;
    const duration = recordingSeconds;

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
      audioChunksRef.current = [];

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        setSending(true);
        try {
          const res = await fetch(`${API_BASE_URL}/whatsapp/chats/${selectedChat.id}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🎤 Voice Note (${duration}s)`,
              media_type: 'audio',
              media_base64: base64Audio,
              media_url: base64Audio,
            }),
          });
          const data = await res.json();
          if (data.success && data.message) {
            setMessages((prev) => [...prev, data.message]);
            setChats((prev) =>
              prev.map((c) =>
                c.id === selectedChat.id
                  ? { ...c, last_message: `🎤 Voice Note (${duration}s)`, last_message_at: new Date().toISOString() }
                  : c
              )
            );
          }
        } catch (e) {
          console.error('Failed to send voice note', e);
        } finally {
          setSending(false);
        }
      };
    };

    recorder.stop();
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatRecordingTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const [editingPhone, setEditingPhone] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>('');

  const handleSavePhone = async () => {
    if (!selectedChat || !phoneInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp/chats/${selectedChat.id}/update-contact-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput.trim() }),
      });
      const data = await res.json();
      if (data.success && data.chat) {
        setSelectedChat(data.chat);
        setChats((prev) =>
          prev.map((c) => (c.id === selectedChat.id ? { ...c, phone: phoneInput.trim() } : c))
        );
        setEditingPhone(false);
        Swal.fire({
          icon: 'success',
          title: 'Phone Number Saved!',
          text: `Contact number updated to ${phoneInput.trim()}`,
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (e) {
      console.error('Failed to update phone', e);
    }
  };

  // Live Gateway Status Polling when QR modal is open
  useEffect(() => {
    let interval: any = null;
    if (isQrModalOpen) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${GATEWAY_URL}/api/status`);
          const data = await res.json();
          if (data.status === 'connected') {
            setIsQrModalOpen(false);
            Swal.fire({
              icon: 'success',
              title: 'WhatsApp Mobile Linked!',
              text: `Official WhatsApp session connected for ${data.user?.phone || 'Mobile Device'}!`,
              confirmButtonColor: '#081428',
            });
            loadChannels();
            loadChats();
          }
        } catch (e) {
          // Gateway connecting
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isQrModalOpen]);

  // QR Modal Handlers
  const handleOpenQrModal = async (channelId?: number) => {
    const targetId = channelId || (channels.length > 0 ? channels[0].id : 1);
    setQrChannelId(targetId);
    setQrTimer(30);
    setQrImageData('');
    setQrCodeData('');
    setIsQrModalOpen(true);

    try {
      // Fetch Real QR image from Live Baileys Gateway
      const res = await fetch(`${GATEWAY_URL}/api/qr`);
      const data = await res.json();
      if (data.qr_image) {
        setQrImageData(data.qr_image); // use pre-rendered base64 PNG
        setQrCodeData(data.qr_code || '');
        return;
      }
    } catch (e) {
      console.log('Baileys gateway starting...');
    }
  };

  const handleRefreshQr = async () => {
    setQrTimer(30);
    setQrImageData('');
    try {
      const res = await fetch(`${GATEWAY_URL}/api/qr`);
      const data = await res.json();
      if (data.qr_image) {
        setQrImageData(data.qr_image);
        setQrCodeData(data.qr_code || '');
        return;
      }
    } catch (e) {
      // gateway offline
    }
  };

  const handleConfirmPairing = async () => {
    if (!qrChannelId) return;
    setPairingLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp/channels/${qrChannelId}/pair-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: '+971 50 ' + Math.floor(100 + Math.random() * 900) + ' ' + Math.floor(1000 + Math.random() * 9000),
          platform: 'iOS (iPhone 16 Pro Max)'
        }),
      });
      const data = await res.json();
      setPairingLoading(false);
      setIsQrModalOpen(false);

      Swal.fire({
        icon: 'success',
        title: 'WhatsApp Mirrored Successfully!',
        text: 'Your mobile WhatsApp is now connected and synced with FS Advisory CRM.',
        confirmButtonColor: '#081428',
      });

      loadChannels();
      loadChats();
    } catch (e) {
      setPairingLoading(false);
      Swal.fire('Pairing Failed', 'Could not complete pairing. Please try again.', 'error');
    }
  };

  const handleDisconnectChannel = async (channelId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: 'Disconnect WhatsApp Session?',
      text: 'This will log out the linked mobile device from CRM mirroring.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#081428',
      confirmButtonText: 'Yes, Disconnect',
    });

    if (result.isConfirmed) {
      try {
        await fetch(`${API_BASE_URL}/whatsapp/channels/${channelId}/disconnect`, {
          method: 'POST',
        });
        Swal.fire('Disconnected', 'WhatsApp device has been unlinked.', 'success');
        loadChannels();
        loadChats();
      } catch (e) {
        Swal.fire('Error', 'Failed to disconnect channel.', 'error');
      }
    }
  };

  const formatPhoneOrId = (phoneStr?: string) => {
    if (!phoneStr) return '';
    if (phoneStr.includes('@lid')) {
      return 'WhatsApp Contact';
    }
    if (phoneStr.includes('@broadcast')) {
      return 'Broadcast Group';
    }
    return phoneStr;
  };

  const formatMessageTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatChatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const currentChannel = channels.find((c) => String(c.id) === String(selectedChannelId));
  const activeContact = selectedChat?.contact;
  const activeOpportunity = activeContact?.opportunity;

  if (canViewWhatsApp === false) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 pl-56 flex flex-col h-screen overflow-hidden min-w-0">
          <Navbar />
          <AccessDenied moduleName="WhatsApp Web Gateway" requiredPermission="whatsapp.view" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Main Page Area with Fixed Navbar and WhatsApp Frame */}
      <div className="flex-1 pl-56 flex flex-col h-screen overflow-hidden min-w-0">
        <Navbar />

        {/* 3. WhatsApp Command Frame */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FA]">
          {/* TOP HEADER - 100% INLINE */}
          <header className="bg-[#081428] text-white border-b border-[#152744] px-5 py-2.5 shrink-0 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
            {/* Left Brand Title */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-md bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366] shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <h1 className="font-heading font-bold text-sm text-white tracking-wide">
                    WhatsApp Web Mirroring
                  </h1>
                  {gatewayStatus === 'connected' ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse"></span>
                      WhatsApp Online
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Device Disconnected
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#B0C0D8]">
                  Direct sync for Advisors & Agency Owner
                </p>
              </div>
            </div>

            {/* Right: Account Dropdown & Action Buttons (Strictly Inline) */}
            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              {/* Channel Selector */}
              <div className="flex items-center gap-1.5 bg-[#0D1E38] border border-[#1E3A66] px-2.5 py-1.5 rounded-md">
                <Smartphone className="w-3.5 h-3.5 text-[#C8A147] shrink-0" />
                <span className="text-[11px] font-semibold text-[#B0C0D8]">Account:</span>
                <select
                  value={selectedChannelId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedChannelId(val);
                    if (val !== 'all') {
                      const targetCh = channels.find((c) => String(c.id) === String(val));
                      if (targetCh && targetCh.status !== 'connected') {
                        handleOpenQrModal(targetCh.id);
                      }
                    }
                    setTimeout(() => loadChats(), 50);
                  }}
                  className="bg-transparent text-white text-[11px] font-bold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-[#081428]">All 6 Active Accounts (Admin View)</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id} className="bg-[#081428]">
                      {ch.agent_name} ({ch.status === 'connected' ? `🟢 ${ch.phone_number || 'Online'}` : '⚪ Disconnected - Click to Scan'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Link Device Button */}
              <button
                onClick={() => handleOpenQrModal()}
                className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-[#081428] font-bold text-xs rounded-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Link WhatsApp Device</span>
              </button>

              {/* Refresh Chats Button */}
              <button
                onClick={async () => {
                  try {
                    await fetch(`${GATEWAY_URL}/api/sync`, { method: 'POST' });
                  } catch (_) {}
                  await loadChannels();
                  await loadChats();
                  Swal.fire({
                    icon: 'success',
                    title: 'WhatsApp Chats Synced!',
                    text: 'Synced latest chats from your connected phone into CRM.',
                    timer: 1500,
                    showConfirmButton: false,
                  });
                }}
                className="px-2.5 py-1.5 bg-[#0D1E38] border border-[#1E3A66] hover:bg-[#152B4D] text-[#B0C0D8] text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                title="Refresh WhatsApp Messages"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden xl:inline">Refresh Chats</span>
              </button>
            </div>
          </header>

      {/* 2. MAIN WAZZUP 3-COLUMN LIVE INBOX */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* COLUMN 1: CHATS LIST */}
        <aside className="w-80 sm:w-96 bg-white border-r border-[#E8E4DC] flex flex-col shrink-0">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-[#E8E4DC] space-y-2 bg-[#FAF8F5]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search chats, phone or CRM contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-[#E8E4DC] rounded-md focus:outline-none focus:border-[#C8A147] text-[#081428]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setUnreadOnly(false)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                    !unreadOnly ? 'bg-[#081428] text-white' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({chats.length})
                </button>
                <button
                  onClick={() => setUnreadOnly(true)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                    unreadOnly ? 'bg-[#25D366] text-[#081428]' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Unread
                </button>
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                {chats.filter((c) => c.unread_count > 0).length} unread
              </span>
            </div>
          </div>

          {/* Chats Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F0ECE1]">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#C8A147]" />
                <span>Loading WhatsApp Conversations...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">
                  {searchQuery ? `No chats matching "${searchQuery}"` : 'No WhatsApp Chats Found'}
                </p>
                <p className="text-[11px] mt-1">
                  {searchQuery ? 'Try searching with another name or phone number.' : 'Link a WhatsApp device to mirror incoming client conversations.'}
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isSelected = selectedChat?.id === chat.id;
                const contact = chat.contact;
                const opp = contact?.opportunity;

                return (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors relative ${
                      isSelected
                        ? 'bg-[#F2ECE1]/70 border-l-4 border-[#081428]'
                        : 'hover:bg-[#FAF8F5]'
                    }`}
                  >
                    {/* Avatar with Channel Badge */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#081428] to-[#1E3A66] text-white flex items-center justify-center font-bold text-xs shadow-xs border border-[#C8A147]/30 overflow-hidden">
                        {chat.avatar_url && chat.avatar_url !== 'none' ? (
                          <img src={chat.avatar_url} alt={chat.contact_name} className="w-full h-full object-cover" />
                        ) : (
                          chat.contact_name ? chat.contact_name.substring(0, 2).toUpperCase() : 'WA'
                        )}
                      </div>
                      <div className="w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-white absolute -bottom-0.5 -right-0.5 flex items-center justify-center text-[7px] text-white">
                        ✓
                      </div>
                    </div>

                    {/* Chat Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className="font-bold text-xs text-[#081428] truncate">
                          {chat.contact_name || chat.phone}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {formatChatDate(chat.last_message_at)}
                        </span>
                      </div>

                      {/* Phone & Channel Tag */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                        <span className="font-mono">{formatPhoneOrId(chat.phone)}</span>
                        {opp && (
                          <span className="px-1 rounded bg-amber-100 text-amber-800 font-semibold text-[9px]">
                            Deal #{opp.id}
                          </span>
                        )}
                      </div>

                      {/* Last Message Snippet */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-600 truncate leading-tight">
                          {chat.last_message || 'Start conversation...'}
                        </p>
                        {chat.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#25D366] text-[#081428] font-bold text-[10px] shrink-0">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* COLUMN 2: ACTIVE CONVERSATION THREAD */}
        <main className="flex-1 flex flex-col bg-[#EFEAE2] relative overflow-hidden">
          {selectedChat ? (
            <>
              {/* Chat Thread Header */}
              <div className="bg-[#FAF8F5] border-b border-[#E8E4DC] px-5 py-3 shrink-0 flex items-center justify-between gap-4 shadow-2xs z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#081428] text-[#C8A147] flex items-center justify-center font-bold text-sm border border-[#C8A147]/40 shadow-xs shrink-0 overflow-hidden">
                    {selectedChat.avatar_url && selectedChat.avatar_url !== 'none' ? (
                      <img src={selectedChat.avatar_url} alt={selectedChat.contact_name} className="w-full h-full object-cover" />
                    ) : (
                      selectedChat.contact_name ? selectedChat.contact_name.substring(0, 2).toUpperCase() : 'WA'
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-sm text-[#081428] truncate">
                        {selectedChat.contact_name || formatPhoneOrId(selectedChat.phone)}
                      </h2>
                      {gatewayStatus === 'connected' ? (
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#25D366]/20 text-emerald-800 border border-[#25D366]/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]"></span>
                          WhatsApp Connected
                        </span>
                      ) : (
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Device Disconnected
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-medium">{formatPhoneOrId(selectedChat.phone)}</span>
                      <span>•</span>
                      <span>Channel: <strong className="text-[#081428]">{selectedChat.channel?.agent_name || 'Advisor'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                  {activeContact?.id && (
                    <Link
                      href={`/contacts/${activeContact.id}`}
                      className="px-2.5 py-1 bg-[#081428] hover:bg-[#122444] text-[#C8A147] text-xs font-bold rounded shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">CRM Profile</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Disconnected Device Alert Banner */}
              {gatewayStatus !== 'connected' && (
                <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between text-xs text-amber-900 shrink-0 z-10 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>WhatsApp Device Signed Out:</strong> Mobile phone was unlinked from WhatsApp Linked Devices. Scan QR code to reconnect and send live messages.
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenQrModal()}
                    className="px-3 py-1 bg-[#25D366] hover:bg-[#1EBE5D] text-[#081428] font-bold rounded-md text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Scan QR Code</span>
                  </button>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div 
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3"
                style={{
                  backgroundImage: 'radial-gradient(#D5CEBE 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#C8A147]" />
                  </div>
                ) : (
                  <>
                    {/* Timestamp Badge */}
                    <div className="flex justify-center my-2">
                      <span className="px-3 py-1 bg-white/80 backdrop-blur-xs rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider shadow-2xs border border-slate-200">
                        Today • Encrypted WhatsApp Session
                      </span>
                    </div>

                    {messages.map((msg, idx) => {
                      const isFromMe = msg.from_me;
                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-md sm:max-w-lg rounded-2xl px-4 py-2.5 shadow-xs relative ${
                              isFromMe
                                ? 'bg-[#E7FFDB] text-[#081428] rounded-tr-xs border border-[#C8E6C9]'
                                : 'bg-white text-[#081428] rounded-tl-xs border border-[#E0DBCF]'
                            }`}
                          >
                            {/* Sender name for group/incoming */}
                            {!isFromMe && (
                              <div className="text-[10px] font-bold text-[#C8A147] mb-0.5">
                                {msg.sender_name || selectedChat.contact_name}
                              </div>
                            )}

                            {/* Message Content: Voice Audio Player OR Text */}
                            {msg.media_type === 'audio' || (msg.media_url && msg.media_url.startsWith('data:audio')) || (msg.text && msg.text.startsWith('🎤 Voice')) ? (
                              <WhatsAppAudioPlayer
                                audioUrl={msg.media_url}
                                isFromMe={isFromMe}
                                durationText={msg.text}
                              />
                            ) : (
                              <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">
                                {msg.text}
                              </p>
                            )}

                            {/* Time & Delivery Status */}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                              <span className="font-mono">{formatMessageTime(msg.timestamp || msg.created_at)}</span>
                              {isFromMe && (
                                <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Composer & Quick Templates */}
              <div className="bg-[#FAF8F5] border-t border-[#E8E4DC] p-3 shrink-0">
                {/* Quick Templates Toggle Bar */}
                {showTemplates && (
                  <div className="mb-2 p-2 bg-white rounded-lg border border-[#E8E4DC] shadow-sm space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="text-[11px] font-bold text-[#081428] px-1 flex items-center justify-between">
                      <span>⚡ Quick Real Estate Templates:</span>
                      <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {quickTemplates.map((tpl, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setMessageText(tpl.text);
                            setShowTemplates(false);
                          }}
                          className="text-left p-2 rounded bg-slate-50 hover:bg-[#F2ECE1] border border-slate-200 transition-colors text-xs font-semibold text-[#081428] flex items-center justify-between"
                        >
                          <span className="truncate">{tpl.label}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div className="mb-2 p-3 bg-white rounded-xl border border-[#E8E4DC] shadow-lg space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150 flex flex-col">
                    {/* Emoji Header & Category Tabs */}
                    <div className="flex items-center justify-between border-b border-[#F0ECE1] pb-2">
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                        {Object.entries(emojiCategories).map(([key, cat]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEmojiCategory(key)}
                            className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                              emojiCategory === key
                                ? 'bg-[#081428] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(false)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Search Emojis */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Search emojis..."
                        value={emojiSearch}
                        onChange={(e) => setEmojiSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 text-xs bg-[#FAF8F5] border border-[#E8E4DC] rounded-md focus:outline-none focus:border-[#25D366]"
                      />
                    </div>

                    {/* Emoji Grid */}
                    <div className="overflow-y-auto grid grid-cols-8 sm:grid-cols-10 gap-1 p-1 max-h-40 text-lg">
                      {(emojiCategories[emojiCategory as keyof typeof emojiCategories]?.emojis || [])
                        .filter((em) => !emojiSearch || em.includes(emojiSearch))
                        .map((emoji, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setMessageText((prev) => prev + emoji);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#FAF8F5] hover:scale-125 transition-transform cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Composer Form Input or Voice Recording Bar */}
                {isRecording ? (
                  <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 p-2 rounded-lg">
                    {/* Blinking Red Dot & Timer */}
                    <div className="flex items-center gap-2 pl-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-xs font-mono font-bold text-rose-600">
                        Recording {formatRecordingTime(recordingSeconds)}
                      </span>
                    </div>

                    {/* Sound Waves Animation */}
                    <div className="flex-1 flex items-center justify-center gap-1 h-6">
                      <span className="w-1 h-3 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1 h-5 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1 h-6 bg-rose-600 rounded-full animate-bounce" />
                      <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.2s]" />
                      <span className="w-1 h-5 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.35s]" />
                      <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.1s]" />
                    </div>

                    {/* Discard / Cancel Button */}
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-2 bg-white hover:bg-rose-100 text-rose-500 rounded-md border border-rose-200 transition-colors cursor-pointer"
                      title="Discard Voice Note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Send Voice Note */}
                    <button
                      type="button"
                      onClick={stopAndSendRecording}
                      disabled={sending}
                      className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-[#081428] font-bold text-xs rounded-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Send Voice Note via WhatsApp"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Voice Note</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    {/* Quick Templates Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplates(!showTemplates);
                        setShowEmojiPicker(false);
                      }}
                      className="p-2 bg-white border border-[#E8E4DC] hover:bg-slate-100 text-[#C8A147] rounded-md transition-colors cursor-pointer shrink-0"
                      title="Real Estate Quick Templates"
                    >
                      <Zap className="w-4 h-4" />
                    </button>

                    {/* Emoji Picker Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(!showEmojiPicker);
                        setShowTemplates(false);
                      }}
                      className={`p-2 bg-white border rounded-md transition-colors cursor-pointer shrink-0 ${
                        showEmojiPicker ? 'border-[#25D366] text-[#25D366] bg-emerald-50' : 'border-[#E8E4DC] text-slate-500 hover:bg-slate-100'
                      }`}
                      title="Insert Emojis"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {/* Text Composer Input */}
                    <input
                      type="text"
                      placeholder="Type a message to client via mirrored WhatsApp..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="flex-1 px-4 py-2 text-xs sm:text-[13px] bg-white border border-[#E8E4DC] rounded-md focus:outline-none focus:border-[#25D366] text-[#081428]"
                    />

                    {/* Dynamic Action: Send button OR Record Voice button */}
                    {messageText.trim().length > 0 ? (
                      <button
                        type="submit"
                        disabled={sending}
                        className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-[#081428] font-bold text-xs rounded-md shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        <span>Send</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="p-2 bg-[#081428] hover:bg-[#152B4D] text-[#25D366] rounded-md shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                        title="Record & Send WhatsApp Voice Note"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    )}
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-white border border-[#E8E4DC] flex items-center justify-center text-[#25D366] mb-3 shadow-xs">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#081428]">
                FS Advisory WhatsApp Command Center
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Select a conversation from the left to read and send mirrored WhatsApp messages directly linked to CRM client profiles.
              </p>
            </div>
          )}
        </main>

        {/* COLUMN 3: CRM CONTEXT & OPPORTUNITY SIDEBAR */}
        {selectedChat && (
          <aside className="hidden lg:flex w-72 bg-white border-l border-[#E8E4DC] flex-col shrink-0 overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-[#E8E4DC] bg-[#FAF8F5]">
              <h3 className="font-bold text-xs text-[#081428] uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#C8A147]" />
                <span>CRM Client Context</span>
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Contact Card */}
              <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-[#081428]">
                    {activeContact?.name || selectedChat.contact_name}
                  </div>
                  <button
                    onClick={() => {
                      setPhoneInput(selectedChat.phone?.includes('@lid') ? '+92 ' : (selectedChat.phone || '+92 '));
                      setEditingPhone(!editingPhone);
                    }}
                    className="text-[11px] text-[#C8A147] hover:text-[#081428] font-semibold cursor-pointer underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{editingPhone ? 'Cancel' : 'Edit Number'}</span>
                  </button>
                </div>

                {editingPhone ? (
                  <div className="space-y-1.5 p-2 bg-white border border-[#C8A147]/50 rounded shadow-xs">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Enter Mobile Number:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:border-[#C8A147]"
                      />
                      <button
                        onClick={handleSavePhone}
                        className="px-2.5 py-1 bg-[#25D366] hover:bg-[#1EBE5D] text-[#081428] font-bold text-xs rounded cursor-pointer shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3 h-3 text-[#25D366]" />
                      <span className="font-bold text-[#081428]">{formatPhoneOrId(selectedChat.phone)}</span>
                    </div>
                    {activeContact?.nationality && (
                      <div className="text-[11px] text-slate-500">
                        Nationality: <strong className="text-[#081428]">{activeContact.nationality}</strong>
                      </div>
                    )}
                    {activeContact?.source && (
                      <div className="text-[11px] text-slate-500">
                        Lead Source: <span className="font-semibold text-emerald-700">{activeContact.source}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linked Deal Card */}
              {activeOpportunity ? (
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-amber-700" />
                      Deal #{activeOpportunity.id}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-200 text-amber-900">
                      {activeOpportunity.temperature || 'HOT'}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-[#081428] capitalize">
                      Stage: {activeOpportunity.stage?.replace(/_/g, ' ')}
                    </div>
                    {activeOpportunity.budget_min && (
                      <div className="text-[11px] text-slate-600 font-mono">
                        Budget: AED {Number(activeOpportunity.budget_min).toLocaleString()} - {Number(activeOpportunity.budget_max).toLocaleString()}
                      </div>
                    )}
                    {activeOpportunity.key_requirement && (
                      <p className="text-[11px] text-slate-700 italic mt-1 bg-white p-2 rounded border border-amber-100">
                        "{activeOpportunity.key_requirement}"
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  <p>No active Opportunity linked.</p>
                  <button className="mt-2 px-3 py-1 bg-[#081428] text-[#C8A147] font-bold text-[11px] rounded shadow-2xs cursor-pointer">
                    + Create Deal
                  </button>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Actions
                </div>
                
                {activeContact?.id && (
                  <Link
                    href={`/contacts/${activeContact.id}`}
                    className="w-full p-2 bg-white border border-[#E8E4DC] hover:bg-slate-50 text-[#081428] text-xs font-semibold rounded flex items-center justify-between transition-colors"
                  >
                    <span>View Complete CRM File</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                )}

                <Link
                  href={`/call-activity`}
                  className="w-full p-2 bg-white border border-[#E8E4DC] hover:bg-slate-50 text-[#081428] text-xs font-semibold rounded flex items-center justify-between transition-colors"
                >
                  <span>Log 3CX Call Note</span>
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href={`/calendar`}
                  className="w-full p-2 bg-white border border-[#E8E4DC] hover:bg-slate-50 text-[#081428] text-xs font-semibold rounded flex items-center justify-between transition-colors"
                >
                  <span>Book Viewing Calendar</span>
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>
        </div>
      </div>

      {/* 4. MODAL: QR CODE PAIRING (WHATSAPP WEB STYLE) */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E8E4DC] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366]">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-[#081428]">
                    Link WhatsApp Device
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mirror your mobile phone WhatsApp into FS Advisory CRM
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Channel Selector */}
            <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg space-y-1">
              <label className="text-xs font-bold text-[#081428] block">Select Account / Advisor Profile:</label>
              <select
                value={qrChannelId || ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setQrChannelId(id);
                  handleOpenQrModal(id);
                }}
                className="w-full p-2 bg-white border border-[#E8E4DC] rounded text-xs font-semibold text-[#081428] focus:outline-none focus:border-[#C8A147]"
              >
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.agent_name} ({ch.status === 'connected' ? '🟢 Currently Connected' : '⚪ Disconnected'})
                  </option>
                ))}
              </select>
            </div>

            {/* QR Code Canvas & Instructions Box */}
            <div className="flex flex-col sm:flex-row items-center gap-6 bg-[#081428] p-6 rounded-xl text-white">
              
              {/* QR Container */}
              <div className="relative p-3 bg-white rounded-lg shadow-md shrink-0 flex flex-col items-center">
                {qrImageData ? (
                  <img
                    src={qrImageData}
                    alt="WhatsApp QR Code"
                    width={160}
                    height={160}
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#081428]" />
                  </div>
                )}

                {/* Refresh Overlay / Timer */}
                <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-slate-600">
                  <Clock className="w-3 h-3 text-[#25D366]" />
                  <span>Expires in: <strong>{qrTimer}s</strong></span>
                </div>
              </div>

              {/* Instructions List */}
              <div className="space-y-3 text-xs text-[#B0C0D8]">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] text-[#C8A147]">
                  How to link on your phone:
                </h4>
                <ol className="space-y-2 text-[11px] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1E3A66] text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                    <span>Open <strong>WhatsApp</strong> on your mobile phone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1E3A66] text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                    <span>Tap <strong>Settings</strong> &gt; <strong>Linked Devices</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1E3A66] text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                    <span>Tap <strong>"Link a Device"</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1E3A66] text-white flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
                    <span>Point phone camera at this QR code</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Test Simulation & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmPairing}
                disabled={pairingLoading}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-[#081428] font-bold text-xs rounded-md shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>{pairingLoading ? 'Pairing Mobile Device...' : 'Simulate Mobile Scan & Pair (1-Click Test)'}</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshQr}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
