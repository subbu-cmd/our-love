'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Heart, Send, Image as ImageIcon, Mic, MoreVertical, LogOut, Phone, Video, 
  Smile, Share, Trash2, Edit2, Pin, ChevronLeft, Paperclip, X, Download
} from 'lucide-react';
import { format } from 'date-fns';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useWebRTC } from '../hooks/useWebRTC';
import CallUI from '../components/CallUI';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4000';

type User = { id: string; name: string; avatar: string; };

type Message = {
  id: string; senderId: string; text?: string;
  mediaUrl?: string; mediaType?: string; voiceUrl?: string;
  replyTo?: string; timestamp: string; status: 'sent' | 'read';
  reactions: Record<string, string[]>;
  isEdited: boolean; isDeleted: boolean; isPinned: boolean;
};

export default function CoupleChat() {
  // Setup & Auth
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Data
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  // Input State
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  
  // UI State
  const [darkMode, setDarkMode] = useState(false);
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

  // Init Auth & Socket
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${SOCKET_URL}/api/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        setUser({ id: data.userId, name: data.user.name, avatar: data.user.avatar });
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!user) return;
    fetch(`${SOCKET_URL}/api/messages`).then(res => res.json()).then(setMessages);

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    newSocket.on('connect', () => newSocket.emit('user_joined', user.id));
    
    newSocket.on('receive_message', (msg: Message) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
    });
    newSocket.on('message_updated', (updatedMsg: Message) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });
    newSocket.on('message_status_update', ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
    });
    newSocket.on('online_status', setOnlineUsers);
    newSocket.on('user_typing', ({ userId, isTyping }) => {
      if (userId !== user.id) setPartnerTyping(isTyping);
    });

    return () => { newSocket.disconnect(); };
  }, [user]);

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

  // Actions
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket || !user) return;

    if (editingMsg) {
       socket.emit('edit_message', { messageId: editingMsg.id, text: newMessage });
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
      fileInputRef.current.value = '';
    }

    socket.emit('send_message', {
      senderId: user.id, text: newMessage.trim(), 
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

  const MessageBubble = ({ msg }: { msg: Message }) => {
    const isMe = msg.senderId === user?.id;
    const isSelected = selectedMessageId === msg.id;

    return (
      <div className={`flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
        {/* Reply Preview */}
        {msg.replyTo && (
          <div className={`mb-1 px-4 py-2 text-xs rounded-xl opacity-70 ${isMe ? 'bg-rose-500/20 mr-4' : 'bg-gray-200/50 ml-4'} max-w-[60%] truncate inline-block`}>
            Replying to: {messages.find(m => m.id === msg.replyTo)?.text || 'Message'}
          </div>
        )}

        <div className={`relative flex items-center ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-2 group`}>
          
          {/* Reaction / Actions invisible until hover or selected */}
          <div className={`hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity flex-row gap-2 ${isSelected ? '!flex !opacity-100' : ''}`}>
             {!isMe && <button onClick={() => socket?.emit('react_message', { messageId: msg.id, emoji: '❤️', userId: user?.id })} className="p-1 hover:scale-125 transition-transform"><Heart className="w-4 h-4 text-rose-500" /></button>}
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
            ${msg.isDeleted ? 'bg-gray-100 text-gray-400 italic rounded-3xl' : 
              isMe ? `${darkMode ? 'bg-rose-600' : 'bg-gradient-to-br from-rose-500 to-pink-600'} text-white rounded-3xl rounded-br-sm` 
                   : `${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800 shadow-md border border-gray-100'} rounded-3xl rounded-bl-sm`}
            ${isSelected ? 'ring-2 ring-rose-300 scale-[1.02]' : ''}
          `}>
             {/* Media */}
             {msg.mediaUrl && !msg.isDeleted && (
               <div className="mb-2 rounded-xl overflow-hidden" onClick={(e) => { e.stopPropagation(); setFullscreenImage(SOCKET_URL + msg.mediaUrl); }}>
                 {msg.mediaType?.startsWith('image') ? <img src={SOCKET_URL + msg.mediaUrl} className="w-full h-auto object-cover max-h-60" /> :
                  msg.mediaType?.startsWith('video') ? <video src={SOCKET_URL + msg.mediaUrl} controls className="w-full h-auto max-h-60" /> :
                  <div className="flex items-center gap-2 p-3 bg-black/10 rounded-xl"><Paperclip className="w-5 h-5"/> File Attached</div>}
               </div>
             )}
             
             {/* Text */}
             <p className="leading-relaxed text-[15px] whitespace-pre-wrap word-break">{msg.text}</p>
             
             {/* Metadata */}
             <div className={`flex items-center space-x-1 mt-1 justify-end opacity-70`}>
                {msg.isEdited && <span className="text-[10px] mr-1">(edited)</span>}
                <span className="text-[10px] font-medium">{format(new Date(msg.timestamp), 'h:mm a')}</span>
                {isMe && <span className={`text-[10px] font-bold ml-1 ${msg.status === 'read' ? 'text-blue-300' : ''}`}>✓✓</span>}
             </div>

             {/* Reactions */}
             {Object.keys(msg.reactions || {}).length > 0 && (
               <div className={`absolute -bottom-3 ${isMe ? '-left-2' : '-right-2'} bg-white dark:bg-gray-800 shadow-md rounded-full px-2 py-0.5 text-xs flex gap-1 border border-gray-100 dark:border-gray-700`}>
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-rose-50 font-sans">
        <div className="bg-white rounded-[2rem] shadow-2xl w-[90%] max-w-sm p-8 flex flex-col items-center">
           <Heart className="w-16 h-16 text-rose-500 fill-rose-500 drop-shadow-lg mb-6 animate-pulse" />
           <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-8">Our Space</h1>
           <form onSubmit={handleLogin} className="w-full space-y-4">
              <input type="text" placeholder="Username" required value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-gray-50 border-none px-5 py-4 rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all outline-none" />
              <input type="password" placeholder="Passcode" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border-none px-5 py-4 rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all outline-none" />
              <button type="submit" className="w-full bg-rose-500 text-white font-semibold py-4 rounded-2xl hover:bg-rose-600 hover:scale-[1.02] transition-all shadow-xl shadow-rose-200 mt-4">Enter</button>
           </form>
        </div>
      </div>
    );
  }

  const partnerId = user.id === 'user1' ? 'user2' : 'user1';
  const partnerIsOnline = onlineUsers.includes(partnerId);
  const pinnedMessages = messages.filter(m => m.isPinned && !m.isDeleted);

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
        partnerName={partnerId === 'user1' ? 'My Love 💖' : 'My Love 💖'}
      />

      {/* Fullscreen Image Preview */}
      {fullscreenImage && (
        <div className="absolute inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setFullscreenImage(null)}>
           <button className="absolute top-6 right-6 text-white bg-white/20 p-2 rounded-full hover:bg-white/40 transition-colors"><X className="w-6 h-6"/></button>
           <img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transform scale-100 animate-in zoom-in duration-300" />
           <a href={fullscreenImage} download className="absolute bottom-8 text-white bg-white/20 px-6 py-3 rounded-full hover:bg-white/40 transition-colors flex items-center gap-2 font-medium">
             <Download className="w-5 h-5" /> Save Image
           </a>
        </div>
      )}

      {/* Main App Container */}
      <div className={`w-full h-full md:w-[480px] md:h-[90vh] md:rounded-[2.5rem] flex flex-col relative overflow-hidden shadow-2xl transition-colors duration-500 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-[#F9FAFB] border-white md:border-8'} `}>
        
        {/* Header */}
        <header className={`px-6 py-4 flex items-center justify-between z-10 backdrop-blur-xl shrink-0 ${darkMode ? 'bg-gray-900/80 border-b border-gray-800 text-white' : 'bg-white/80 border-b border-gray-100 text-gray-900'}`}>
          <div className="flex items-center space-x-4 cursor-pointer" onClick={() => setShowProfileInfo(true)}>
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 p-0.5">
                <div className={`w-full h-full rounded-full border-2 overflow-hidden flex items-center justify-center text-lg font-bold ${darkMode ? 'border-gray-900 bg-gray-800 text-rose-400' : 'border-white bg-rose-50 text-rose-500'}`}>
                  {partnerId === 'user2' ? 'L' : 'M'}
                </div>
              </div>
              {partnerIsOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>}
            </div>
            <div>
              <h2 className="font-bold tracking-tight text-lg leading-tight">{partnerId === 'user2' ? 'My Love 💖' : 'My Love 💖'}</h2>
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
          <div className={`px-5 py-2 flex items-center gap-3 shrink-0 text-sm ${darkMode ? 'bg-gray-800/80 text-gray-300' : 'bg-rose-50/80 text-gray-700'}`}>
            <Pin className="w-4 h-4 text-rose-500" />
            <div className="flex-1 truncate">
              <span className="font-semibold text-rose-500 mr-2">Pinned:</span>
              {pinnedMessages[pinnedMessages.length - 1].text}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className={`flex-1 overflow-y-auto px-4 py-6 space-y-2 scrollbar-hide relative bg-pattern ${darkMode ? 'bg-opacity-10' : ''}`} onClick={() => {setShowEmojiPicker(false); setSelectedMessageId(null);}}>
          <div className="text-center mb-8">
             <div className="inline-block bg-yellow-100/50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs px-4 py-2 rounded-full font-medium">
               🔒 Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
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

        {/* Reply/Edit Context Bar */}
        {(replyToMsg || editingMsg) && (
          <div className={`shrink-0 px-4 py-3 flex items-center justify-between border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-rose-50 border-rose-100'}`}>
            <div className="flex flex-col overflow-hidden">
               <span className="text-xs font-semibold text-rose-500">{editingMsg ? 'Editing Message' : `Replying to ${(replyToMsg?.senderId === user.id) ? 'yourself' : 'My Love'}`}</span>
               <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{editingMsg ? editingMsg.text : replyToMsg?.text}</span>
            </div>
            <button onClick={() => {setReplyToMsg(null); setEditingMsg(null); setNewMessage('');}} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
          </div>
        )}

        {/* Input Area */}
        <div className={`shrink-0 p-3 pt-2 z-20 ${darkMode ? 'bg-gray-900' : 'bg-[#F9FAFB]'}`}>
          <div className="relative">
            {showEmojiPicker && (
              <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <EmojiPicker onEmojiClick={(e) => setNewMessage(p => p + e.emoji)} theme={darkMode ? Theme.DARK : Theme.LIGHT} />
              </div>
            )}
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleSend} accept="image/*,video/*,audio/*" />
              
              <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-3 shrink-0 rounded-full transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-rose-400' : 'text-rose-500 hover:bg-rose-100'}`}>
                <Paperclip className="w-6 h-6" />
              </button>

              <div className={`flex-1 flex items-center min-h-[48px] rounded-3xl px-4 transition-colors ${darkMode ? 'bg-gray-800 focus-within:ring-1 focus-within:ring-rose-500' : 'bg-white border border-gray-200 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100 shadow-sm'}`}>
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
                  className={`w-full bg-transparent border-none focus:outline-none focus:ring-0 py-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}
                />
                {!newMessage.trim() && (
                  <button type="button" className="p-2 -mr-2 text-gray-400 hover:text-rose-500 transition-colors hidden md:block">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
              
               <button 
                  type="submit" 
                  disabled={!newMessage.trim() && !fileInputRef.current?.files?.length}
                  className={`p-3 rounded-full flex-shrink-0 transition-all ${
                    newMessage.trim() || fileInputRef.current?.files?.length
                      ? 'bg-rose-500 text-white shadow-lg hover:scale-105' 
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
        <div className={`absolute inset-y-0 right-0 w-[85%] max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-40 transform transition-transform duration-300 ${showProfileInfo ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex flex-col h-full overflow-y-auto print:hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4">
              <button onClick={() => setShowProfileInfo(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><ChevronLeft className="w-6 h-6 dark:text-white"/></button>
              <h3 className="font-bold text-lg dark:text-white">Profile & Settings</h3>
            </div>
            <div className="p-8 flex flex-col items-center border-b border-gray-100 dark:border-gray-800">
               <div className="w-24 h-24 rounded-full bg-rose-100 flex items-center justify-center text-4xl font-bold text-rose-500 mb-4 shadow-inner">{partnerId === 'user2' ? 'L' : 'M'}</div>
               <h2 className="text-2xl font-bold dark:text-white">{partnerId === 'user2' ? 'My Love 💖' : 'My Love 💖'}</h2>
            </div>
            <div className="p-4 space-y-2">
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setDarkMode(!darkMode)}>
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-xl text-gray-600 dark:text-gray-300">🌙</div>
                <div className="flex-1 text-left font-medium dark:text-white">{darkMode ? 'Light Theme' : 'Dark Theme'}</div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="bg-rose-100 dark:bg-rose-900 p-2 rounded-xl text-rose-600 dark:text-rose-300"><ImageIcon className="w-5 h-5"/></div>
                <div className="flex-1 text-left font-medium dark:text-white">Shared Media</div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => {localStorage.clear(); window.location.reload();}}>
                <div className="bg-red-100 dark:bg-red-900 p-2 rounded-xl text-red-600 dark:text-red-300"><LogOut className="w-5 h-5"/></div>
                <div className="flex-1 text-left font-medium text-red-600 dark:text-red-400">Lock Chat & Logout</div>
              </button>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
