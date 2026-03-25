'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Heart, Send, Image as ImageIcon, Mic, MoreVertical, LogOut, Phone, Video, 
  Smile, Share, Trash2, Edit2, Pin, ChevronLeft, Paperclip, X, Download, Settings
} from 'lucide-react';
import { format } from 'date-fns';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { useWebRTC } from '../../hooks/useWebRTC';
import CallUI from '../../components/CallUI';
import { useAppContext } from '../../components/Providers';
import { deriveSymmetricKey, encryptAES, decryptAES } from '../../lib/crypto';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4000';

type Message = {
  id: string; senderId: string; text?: string;
  mediaUrl?: string; mediaType?: string; voiceUrl?: string;
  replyTo?: string; timestamp: string; status: 'sent' | 'read';
  reactions: Record<string, string[]>;
  isEdited: boolean; isDeleted: boolean; isPinned: boolean;
};

export default function CoupleChat() {
  const router = useRouter();
  const { user, pairId, partner, socket, theme, setTheme } = useAppContext();
  
  // Encryption Key
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);
  
  // Data State
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [hasFile, setHasFile] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  // Input State
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  
  // UI State
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  // WebRTC Hook
  const rtc = useWebRTC({ socket, userId: user?.id || '' });

  // Initial redirect if not auth'd
  useEffect(() => {
    if (!user) router.push('/auth');
    else if (!pairId) router.push('/pair');
  }, [user, pairId, router]);

  // Fetch messages
  useEffect(() => {
    if (user && pairId && partner) {
      // Derive shared symmetric key (AES-256)
      const salt = [user.id, partner.id].sort().join('-');
      deriveSymmetricKey(pairId, salt).then(key => {
        setAesKey(key);
        // Then fetch messages
        fetch(`${SOCKET_URL}/api/messages?pairId=${pairId}`)
          .then(res => res.json())
          .then(async data => {
            if (!data) return;
            // Decrypt payloads
            const decryptedMessages = await Promise.all(data.map(async (m: Message) => {
              if (m.text && m.text !== 'This message was deleted') {
                m.text = await decryptAES(key, m.text);
              }
              return m;
            }));
            setMessages(decryptedMessages);
          })
          .catch(err => console.error('Error fetching messages:', err));
      });
    }
  }, [user, pairId, partner]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !user || !aesKey) return;

    const onReceiveMessage = async (msg: Message) => {
      if (msg.text && msg.text !== 'This message was deleted') {
         msg.text = await decryptAES(aesKey, msg.text);
      }
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
    };
    
    const onMessageUpdated = async (updatedMsg: Message) => {
      if (updatedMsg.text && updatedMsg.text !== 'This message was deleted') {
         updatedMsg.text = await decryptAES(aesKey, updatedMsg.text);
      }
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    };
    const onMessageStatusUpdate = ({ messageId, status }: any) => setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
    const onOnlineStatus = (users: string[]) => setOnlineUsers(users);
    const onUserTyping = ({ userId, isTyping }: any) => { if (userId !== user.id) setPartnerTyping(isTyping); };

    socket.on('receive_message', onReceiveMessage);
    socket.on('message_updated', onMessageUpdated);
    socket.on('message_status_update', onMessageStatusUpdate);
    socket.on('online_status', onOnlineStatus);
    socket.on('user_typing', onUserTyping);

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('message_updated', onMessageUpdated);
      socket.off('message_status_update', onMessageStatusUpdate);
      socket.off('online_status', onOnlineStatus);
      socket.off('user_typing', onUserTyping);
    };
  }, [socket, user, aesKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  useEffect(() => {
    // Read receipts
    if (socket && user && messages.length > 0) {
      const unreadIds = messages.filter(m => m.senderId !== user.id && m.status !== 'read').map(m => m.id);
      unreadIds.forEach(id => socket.emit('mark_read', { messageId: id, userId: user.id }));
    }
  }, [messages, socket, user]);

  // Action handlers
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket || !user || !pairId || !aesKey) return;

    if (editingMsg) {
       const cipherText = await encryptAES(aesKey, newMessage);
       socket.emit('edit_message', { messageId: editingMsg.id, text: cipherText });
       setEditingMsg(null);
       setNewMessage('');
       return;
    }

    if (!newMessage.trim() && !fileInputRef.current?.files?.length) return;

    let mediaUrl = null, mediaType = null;
    if (fileInputRef.current?.files?.[0]) {
      setUploading(true);
      const file = fileInputRef.current.files[0];
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${SOCKET_URL}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        mediaUrl = data.url;
        mediaType = data.type;
      } catch (err) {}
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        setHasFile(false);
      }
    }

    const payloadText = newMessage.trim();
    const cipherText = payloadText ? await encryptAES(aesKey, payloadText) : null;

    socket.emit('send_message', {
      senderId: user.id, text: cipherText, 
      replyTo: replyToMsg?.id, mediaUrl, mediaType
    });
    
    socket.emit('typing', { userId: user.id, isTyping: false });
    setIsTyping(false); setNewMessage(''); setReplyToMsg(null); setShowEmojiPicker(false);
  };

  const handleMessageInteraction = (msg: Message, type: 'single' | 'double' | 'long') => {
    if (type === 'double' && !msg.isDeleted) {
      socket?.emit('react_message', { messageId: msg.id, emoji: '❤️', userId: user?.id });
    } else if (type === 'long') {
      setSelectedMessageId(msg.id === selectedMessageId ? null : msg.id);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/auth');
  };

  if (!user || !pairId || !partner) return null; // Avoid render errors before redirect

  const partnerIsOnline = onlineUsers.includes(partner.id);
  const pinnedMessages = messages.filter(m => m.isPinned && !m.isDeleted);
  const darkMode = theme === 'dark';

  const MessageBubble = ({ msg }: { msg: Message }) => {
    const isMe = msg.senderId === user.id;
    const isSelected = selectedMessageId === msg.id;

    return (
      <div className={`flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
        {/* Reply Preview */}
        {msg.replyTo && (
          <div className={`mb-1 px-4 py-2 text-xs rounded-xl opacity-70 ${isMe ? 'bg-rose-500/20 mr-4' : 'bg-gray-200/50 flex-row-reverse ml-4'} max-w-[60%] truncate inline-block`}>
            Replying to: {messages.find(m => m.id === msg.replyTo)?.text || 'Message'}
          </div>
        )}

        <div className={`relative flex items-center ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-2 group`}>
          {/* Reaction / Actions invisible until hover or selected */}
          <div className={`hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity flex-row gap-2 ${isSelected ? '!flex !opacity-100' : ''}`}>
             {!isMe && <button onClick={() => socket?.emit('react_message', { messageId: msg.id, emoji: '❤️', userId: user.id })} className="p-1 hover:scale-125 transition-transform"><Heart className="w-4 h-4 text-rose-500" /></button>}
             <button onClick={() => setReplyToMsg(msg)} className="p-1 hover:scale-125 transition-transform"><Share className="w-4 h-4 text-gray-500" /></button>
          </div>

          <div 
            onClick={() => {
              if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; handleMessageInteraction(msg, 'double'); } 
              else { clickTimer.current = setTimeout(() => { clickTimer.current = null; handleMessageInteraction(msg, 'single'); }, 250); }
            }}
            onContextMenu={(e) => { e.preventDefault(); handleMessageInteraction(msg, 'long'); }}
            className={`
            cursor-pointer max-w-[70vw] md:max-w-[400px] relative px-5 py-3 shadow-sm select-none transition-all
            ${msg.isDeleted ? 'bg-gray-100 text-gray-400 italic rounded-3xl dark:bg-gray-800/50' : 
              isMe ? `${darkMode ? 'bg-rose-600' : 'bg-gradient-to-br from-rose-500 to-pink-600'} text-white rounded-3xl rounded-br-sm border border-rose-400/20 shadow-rose-200` 
                   : `${darkMode ? 'bg-gray-800 text-gray-100 border border-gray-700' : 'bg-white text-gray-800 shadow-md border border-gray-100'} rounded-3xl rounded-bl-sm`}
            ${isSelected ? 'ring-2 ring-rose-300 scale-[1.02]' : ''}
          `}>
             {/* Media */}
             {msg.mediaUrl && !msg.isDeleted && (
               <div className="mb-2 rounded-xl overflow-hidden cursor-pointer backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setFullscreenImage(SOCKET_URL + msg.mediaUrl); }}>
                 {msg.mediaType?.startsWith('image') ? <img src={SOCKET_URL + msg.mediaUrl} className="w-full h-auto object-cover max-h-60" alt="media" /> :
                  msg.mediaType?.startsWith('video') ? <video src={SOCKET_URL + msg.mediaUrl} controls className="w-full h-auto max-h-60" /> :
                  <div className="flex items-center gap-2 p-3 bg-black/10 rounded-xl"><Paperclip className="w-5 h-5"/> File Attached</div>}
               </div>
             )}
             
             {/* Text */}
             {msg.text && <p className="leading-relaxed text-[15px] whitespace-pre-wrap break-words">{msg.text}</p>}
             
             {/* Metadata */}
             <div className={`flex items-center space-x-1 mt-1 justify-end opacity-70`}>
                {msg.isEdited && <span className="text-[10px] mr-1">(edited)</span>}
                <span className="text-[10px] font-medium">{format(new Date(msg.timestamp), 'h:mm a')}</span>
                {isMe && <span className={`text-[10px] font-bold ml-1 ${msg.status === 'read' ? 'text-blue-300 dark:text-blue-400' : ''}`}>✓✓</span>}
             </div>

             {/* Reactions */}
             {Object.keys(msg.reactions || {}).length > 0 && (
               <div className={`absolute -bottom-3 ${isMe ? '-left-2' : '-right-2'} bg-white dark:bg-gray-800 shadow-md rounded-full px-2 py-0.5 text-xs flex gap-1 border border-gray-100 dark:border-gray-700 backdrop-blur-xl`}>
                 {Object.entries(msg.reactions).map(([emoji, users]) => (
                   <span key={emoji} className="flex items-center">{emoji} {users.length > 1 && <span className="text-[10px] ml-1">{users.length}</span>}</span>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Action Menu (Mobile/Long Press) */}
        {isSelected && !msg.isDeleted && (
          <div className={`flex gap-3 mt-4 ${isMe ? 'mr-4' : 'ml-4'} bg-white dark:bg-gray-800 shadow-xl rounded-full px-4 py-2 border border-gray-100 dark:border-gray-700 animate-in zoom-in duration-200`}>
            {isMe && <button onClick={() => { setEditingMsg(msg); setNewMessage(msg.text || ''); setSelectedMessageId(null); }} className="text-gray-500 hover:text-blue-500"><Edit2 className="w-4 h-4" /></button>}
            <button onClick={() => { socket?.emit('pin_message', { messageId: msg.id, isPinned: !msg.isPinned }); setSelectedMessageId(null); }} className="text-gray-500 hover:text-yellow-500"><Pin className="w-4 h-4" /></button>
            <button onClick={() => { setReplyToMsg(msg); setSelectedMessageId(null); }} className="text-gray-500 hover:text-green-500"><Share className="w-4 h-4" /></button>
            {isMe && <button onClick={() => { socket?.emit('delete_message_everyone', { messageId: msg.id }); setSelectedMessageId(null); }} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gray-100'} justify-center items-center`}>
      
      {/* WebRTC Call UI Overlay */}
      <CallUI 
        callState={rtc.callState}
        localVideoRef={rtc.localVideoRef}
        remoteVideoRef={rtc.remoteVideoRef}
        isVideoEnabled={rtc.isVideoEnabled}
        isAudioMuted={rtc.isAudioMuted}
        isRemoteVideoEnabled={rtc.isRemoteVideoEnabled}
        weakNetwork={rtc.weakNetwork}
        onEndCall={rtc.endCall}
        onToggleVideo={rtc.toggleVideo}
        onToggleAudio={rtc.toggleAudio}
        onAnswerCall={rtc.answerCall}
        partnerName={partner.username}
      />

      {/* Fullscreen Image */}
      {fullscreenImage && (
        <div className="absolute inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setFullscreenImage(null)}>
           <button className="absolute top-6 right-6 text-white bg-white/20 p-2 rounded-full hover:bg-white/40 transition-colors"><X className="w-6 h-6"/></button>
           <img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transform scale-100" alt="fullscreen content" />
           <a href={fullscreenImage} download className="absolute bottom-8 text-white bg-white/20 px-6 py-3 rounded-full hover:bg-white/40 transition-colors flex items-center gap-2 font-medium">
             <Download className="w-5 h-5" /> Save Image
           </a>
        </div>
      )}

      {/* Main App Container */}
      <div className={`w-full h-full md:w-[480px] md:h-[90vh] md:rounded-[2.5rem] flex flex-col relative overflow-hidden shadow-2xl transition-all duration-500 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-[#FAFAFA] md:border-8 md:border-white'} `}>
        
        {/* Header */}
        <header className={`px-6 py-4 flex items-center justify-between z-10 backdrop-blur-xl shrink-0 ${darkMode ? 'bg-gray-900/80 border-b border-gray-800 text-white' : 'bg-white/80 border-b border-gray-100 text-gray-900'}`}>
          <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => setShowProfileInfo(true)}>
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 p-0.5 group-hover:scale-105 transition-transform">
                <img src={partner.avatar} alt="partner" className="w-full h-full rounded-full border-2 border-white dark:border-gray-900 object-cover bg-rose-50" />
              </div>
              {partnerIsOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>}
            </div>
            <div>
              <h2 className="font-bold tracking-tight text-lg leading-tight">{partner.username}</h2>
              <p className={`text-xs font-medium tracking-wide ${partnerIsOnline ? 'text-green-500' : 'text-gray-400'}`}>
                {partnerIsOnline ? (partnerTyping ? 'Typing...' : 'Active now') : 'Offline'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-5 text-rose-500">
            <button onClick={() => rtc.startCall(false)} className="hover:scale-110 transition-transform"><Phone className="w-6 h-6 fill-current" /></button>
            <button onClick={() => rtc.startCall(true)} className="hover:scale-110 transition-transform"><Video className="w-6 h-6 fill-current" /></button>
          </div>
        </header>

        {/* Pinned Messages Banner */}
        {pinnedMessages.length > 0 && (
          <div className={`px-5 py-2 flex items-center gap-3 shrink-0 text-sm ${darkMode ? 'bg-gray-800/80 text-gray-300' : 'bg-rose-50/80 text-gray-700'} backdrop-blur-md border-b border-rose-100 dark:border-gray-800`}>
            <Pin className="w-4 h-4 text-rose-500" />
            <div className="flex-1 truncate">
              <span className="font-semibold text-rose-500 mr-2">Pinned:</span>
              {pinnedMessages[pinnedMessages.length - 1].text}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className={`flex-1 overflow-y-auto px-4 py-6 space-y-2 scrollbar-hide relative ${darkMode ? 'bg-gray-900/50' : ''}`} onClick={() => {setShowEmojiPicker(false); setSelectedMessageId(null);}}>
          <div className="text-center mb-8">
             <div className="inline-block bg-yellow-100/50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs px-4 py-2 rounded-full font-medium backdrop-blur-sm border border-yellow-200/50 dark:border-yellow-700/50">
               🔒 Messages and calls are end-to-end encrypted.
             </div>
          </div>

          {messages.map((msg, i) => {
            const showDivider = i > 0 && new Date(messages[i].timestamp).toDateString() !== new Date(messages[i-1].timestamp).toDateString();
            return (
              <React.Fragment key={msg.id}>
                {showDivider && (
                  <div className="flex justify-center my-6">
                    <span className="text-[11px] font-medium text-gray-500 bg-black/5 dark:bg-white/10 px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                      {format(new Date(msg.timestamp), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                <MessageBubble msg={msg} />
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} className="h-6" />
        </div>

        {/* Reply/Edit Bar */}
        {(replyToMsg || editingMsg) && (
          <div className={`shrink-0 px-4 py-3 flex items-center justify-between border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-rose-50/80 border-rose-100 backdrop-blur-md'}`}>
            <div className="flex flex-col overflow-hidden">
               <span className="text-xs font-semibold text-rose-500">{editingMsg ? 'Editing Message' : `Replying to ${(replyToMsg?.senderId === user.id) ? 'yourself' : partner.username}`}</span>
               <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{editingMsg ? editingMsg.text : replyToMsg?.text}</span>
            </div>
            <button onClick={() => {setReplyToMsg(null); setEditingMsg(null); setNewMessage('');}} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5"/></button>
          </div>
        )}

        {/* Input Area */}
        <div className={`shrink-0 p-3 pt-2 z-20 ${darkMode ? 'bg-gray-900' : 'bg-[#FAFAFA]'}`}>
          <div className="relative">
            {showEmojiPicker && (
              <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <EmojiPicker onEmojiClick={(e) => setNewMessage(p => p + e.emoji)} theme={darkMode ? EmojiTheme.DARK : EmojiTheme.LIGHT} />
              </div>
            )}
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*,video/*,audio/*"
                 onChange={(e) => setHasFile(!!e.target.files?.length)}
              />
              
              <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-3 shrink-0 rounded-full transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-rose-400' : 'text-rose-500 hover:bg-rose-100'}`}>
                <Paperclip className="w-6 h-6" />
              </button>

              <div className={`flex-1 flex items-center min-h-[48px] rounded-3xl px-4 transition-colors ${darkMode ? 'bg-gray-800 focus-within:ring-1 focus-within:ring-rose-500/50' : 'bg-white border border-gray-200 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100 shadow-sm'}`}>
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 -ml-2 text-gray-400 hover:text-rose-500 transition-colors">
                  <Smile className="w-6 h-6" />
                </button>
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (!isTyping) { setIsTyping(true); socket?.emit('typing', { userId: user.id, isTyping: true }); }
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); socket?.emit('typing', { userId: user.id, isTyping: false }); }, 1500);
                  }}
                  placeholder="Message..."
                  className={`w-full bg-transparent border-none focus:outline-none focus:ring-0 py-3 ${darkMode ? 'text-white hover:border-transparent' : 'text-gray-900 hover:border-transparent'}`}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={!newMessage.trim() && !hasFile}
                className={`p-3 rounded-full flex-shrink-0 transition-all ${
                  newMessage.trim() || hasFile
                    ? 'bg-rose-500 text-white shadow-lg hover:scale-105 shadow-rose-500/30' 
                    : darkMode ? 'bg-gray-800 text-gray-600' : 'bg-rose-50 text-rose-300'
                }`}
              >
                {uploading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :
                  newMessage.trim() ? <Send className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
            </form>
          </div>
        </div>

        {/* Profile Sidebar/Drawer */}
        <div className={`absolute inset-y-0 right-0 w-[85%] max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-40 transform transition-transform duration-300 ease-out border-l border-gray-100 dark:border-gray-800 ${showProfileInfo ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
              <button onClick={() => setShowProfileInfo(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><ChevronLeft className="w-6 h-6 dark:text-white"/></button>
              <h3 className="font-bold text-lg dark:text-white">Profile & Settings</h3>
            </div>
            
            <div className="p-8 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 mt-4">
               <img src={partner.avatar} alt="partner" className="w-24 h-24 rounded-full border-4 border-rose-100 dark:border-rose-900 mb-4 shadow-lg" />
               <h2 className="text-2xl font-bold dark:text-white">{partner.username}</h2>
            </div>
            
            <div className="p-4 space-y-3 mt-4">
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => router.push('/settings')}>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl text-gray-600 dark:text-gray-300"><Settings className="w-5 h-5"/></div>
                <div className="flex-1 text-left font-medium dark:text-white">App Settings & Themes</div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => router.push('/gallery')}>
                <div className="bg-rose-100 dark:bg-rose-900/50 p-3 rounded-xl text-rose-600 dark:text-rose-400"><ImageIcon className="w-5 h-5"/></div>
                <div className="flex-1 text-left font-medium dark:text-white">Shared Media Gallery</div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors mt-8" onClick={handleLogout}>
                <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-xl text-red-600 dark:text-red-400"><LogOut className="w-5 h-5"/></div>
                <div className="flex-1 text-left font-semibold text-red-600 dark:text-red-400">Lock Chat & Logout</div>
              </button>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
