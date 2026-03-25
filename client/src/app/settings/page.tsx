/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Lock, Image as ImageIcon, Palette, Trash2, CheckCircle2, LogOut, User as UserIcon } from 'lucide-react';
import { useAppContext } from '../../components/Providers';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4000';

const predefinedThemes = [
  // Basic Romance
  { name: 'Classic Rose', primary: '#f43f5e', secondary: '#ffe4e6', isDark: false },
  { name: 'Dark Valentine', primary: '#e11d48', secondary: '#1f2937', isDark: true },
  { name: 'Soft Peach', primary: '#fb923c', secondary: '#ffedd5', isDark: false },
  { name: 'Deep Crimson', primary: '#9f1239', secondary: '#111827', isDark: true },
  
  // Luxury & Premium
  { name: 'Rose Gold', primary: '#b76e79', secondary: '#fdfbfb', isDark: false },
  { name: 'Midnight Onyx', primary: '#fcd34d', secondary: '#09090b', isDark: true },
  { name: 'Champagne Blush', primary: '#f3e5ab', secondary: '#ffffff', isDark: false },
  { name: 'Velvet Indigo', primary: '#4f46e5', secondary: '#1e1b4b', isDark: true },
  { name: 'Emerald Promise', primary: '#10b981', secondary: '#022c22', isDark: true },
  { name: 'Sapphire Love', primary: '#2563eb', secondary: '#eff6ff', isDark: false },
  
  // Neon & Futuristic
  { name: 'Neon Cyber Pink', primary: '#d946ef', secondary: '#2e1065', isDark: true },
  { name: 'Electric Violet', primary: '#8b5cf6', secondary: '#1c1917', isDark: true },
  { name: 'Aqua Glow', primary: '#06b6d4', secondary: '#083344', isDark: true },
  { name: 'Laser Lime', primary: '#a3e635', secondary: '#14532d', isDark: true },
  { name: 'Plasma Ruby', primary: '#ef4444', secondary: '#450a0a', isDark: true },
  { name: 'Neon Twilight', primary: '#c084fc', secondary: '#0f172a', isDark: true },
  
  // Pastel & Dreamy
  { name: 'Cotton Candy', primary: '#f472b6', secondary: '#fdf2f8', isDark: false },
  { name: 'Baby Blue', primary: '#60a5fa', secondary: '#f0f9ff', isDark: false },
  { name: 'Lavender Mist', primary: '#a78bfa', secondary: '#f5f3ff', isDark: false },
  { name: 'Mint Breeze', primary: '#34d399', secondary: '#ecfdf5', isDark: false },
  { name: 'Lemon Chiffon', primary: '#facc15', secondary: '#fefce8', isDark: false },
  { name: 'Peachy Keen', primary: '#fb7185', secondary: '#fff1f2', isDark: false },
  { name: 'Lilac Dream', primary: '#c084fc', secondary: '#faf5ff', isDark: false },
  
  // Cosmic & Galaxy
  { name: 'Galaxy Love', primary: '#818cf8', secondary: '#172554', isDark: true },
  { name: 'Stardust', primary: '#94a3b8', secondary: '#0f172a', isDark: true },
  { name: 'Nebula Purple', primary: '#d8b4fe', secondary: '#3b0764', isDark: true },
  { name: 'Lunar Silver', primary: '#e2e8f0', secondary: '#020617', isDark: true },
  { name: 'Solar Flare', primary: '#f97316', secondary: '#431407', isDark: true },
  
  // Nature & Earth
  { name: 'Forest Heart', primary: '#22c55e', secondary: '#f0fdf4', isDark: false },
  { name: 'Autumn Ember', primary: '#ea580c', secondary: '#fff7ed', isDark: false },
  { name: 'Ocean Depth', primary: '#0891b2', secondary: '#164e63', isDark: true },
  { name: 'Desert Sand', primary: '#d97706', secondary: '#fef3c7', isDark: false },
  { name: 'Woodland', primary: '#65a30d', secondary: '#1a2e05', isDark: true },
  { name: 'Sunset Bloom', primary: '#f43f5e', secondary: '#ffedd5', isDark: false },
  
  // Modern & Minimal
  { name: 'Monochrome', primary: '#111827', secondary: '#f9fafb', isDark: false },
  { name: 'Charcoal Minimal', primary: '#f9fafb', secondary: '#1f2937', isDark: true },
  { name: 'Slate Gray', primary: '#64748b', secondary: '#f8fafc', isDark: false },
  { name: 'Carbon Black', primary: '#d1d5db', secondary: '#030712', isDark: true },
  { name: 'Ceramic White', primary: '#374151', secondary: '#ffffff', isDark: false },
  { name: 'Titanium', primary: '#a1a1aa', secondary: '#18181b', isDark: true },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, theme, setTheme, logout } = useAppContext();
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) router.push('/auth');
    const savedBg = localStorage.getItem('chatBackground');
    if (savedBg) setBgImage(savedBg);
  }, [user, router]);

  const handleApplyTheme = (t: any) => {
    // We update the root CSS variables for dynamic coloring
    document.documentElement.style.setProperty('--color-primary', t.primary);
    document.documentElement.style.setProperty('--color-secondary', t.secondary);
    
    const themeStr = t.isDark ? 'dark' : 'light';
    setTheme(themeStr);
    localStorage.setItem('theme', themeStr);
    localStorage.setItem('customThemeColors', JSON.stringify({ primary: t.primary, secondary: t.secondary }));
  };

  const savePin = () => {
    if (pin.length === 4 && pin === confirmPin) {
      localStorage.setItem('appPin', pin);
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 3000);
      setPin(''); setConfirmPin('');
    }
  };

  const removePin = () => {
    localStorage.removeItem('appPin');
    setPin(''); setConfirmPin('');
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${SOCKET_URL}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          const fullUrl = SOCKET_URL + data.url;
          setBgImage(fullUrl);
          localStorage.setItem('chatBackground', fullUrl);
        }
      } catch (err) {
        console.error('Failed to upload background');
      }
    }
  };

  const removeBg = () => {
    localStorage.removeItem('chatBackground');
    setBgImage(null);
  };

  if (!user) return null;

  return (
    <div className={`flex flex-col min-h-screen font-sans ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-500`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-20 px-6 py-4 flex items-center gap-4 backdrop-blur-xl shrink-0 ${theme === 'dark' ? 'bg-gray-900/80 border-b border-gray-800' : 'bg-white/80 border-b border-gray-100'}`}>
        <button onClick={() => router.push('/chat')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Personalization & Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-8">
        
        {/* Theming Section */}
        <section className={`p-6 rounded-3xl shadow-sm border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-rose-500" />
            <h2 className="text-lg font-bold">Theme & Romance Palette ({predefinedThemes.length})</h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {predefinedThemes.map((t) => (
               <button 
                 key={t.name}
                 onClick={() => handleApplyTheme(t)}
                 className={`flex flex-col flex-1 items-center p-3 rounded-2xl border-2 transition-transform hover:scale-105 ${theme === 'dark' ? 'border-gray-800 bg-gray-800 hover:border-gray-600' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}`}
               >
                 <div className="w-12 h-12 rounded-full mb-3 shadow-inner border border-black/10 flex overflow-hidden">
                   <div className="w-1/2 h-full" style={{ backgroundColor: t.primary }}></div>
                   <div className="w-1/2 h-full" style={{ backgroundColor: t.secondary }}></div>
                 </div>
                 <span className="text-xs font-semibold text-center leading-tight truncate w-full">{t.name}</span>
               </button>
            ))}
          </div>
        </section>

        {/* Custom Background Section */}
        <section className={`p-6 rounded-3xl shadow-sm border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-4">
            <ImageIcon className="w-6 h-6 text-rose-500" />
            <h2 className="text-lg font-bold">Chat Background</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Upload a photo to use as your private chat background.</p>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {bgImage ? (
              <div className="relative w-40 h-64 rounded-2xl overflow-hidden shadow-md">
                <img src={bgImage} className="w-full h-full object-cover" />
                <button onClick={removeBg} className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white hover:bg-red-500/80 transition-colors backdrop-blur-sm">
                   <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-40 h-64 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                 <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                 <span className="text-xs font-medium">None</span>
              </div>
            )}
            
            <div className="flex flex-col gap-3">
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
               <button onClick={() => fileInputRef.current?.click()} className="px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                 Choose Photo
               </button>
            </div>
          </div>
        </section>

        {/* Security / App Lock Section */}
        <section className={`p-6 rounded-3xl shadow-sm border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-rose-500" />
            <h2 className="text-lg font-bold">App Lock PIN</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Require a 4-digit PIN every time the app is opened to keep your chats private.</p>
          
          <div className="max-w-sm space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">New PIN</label>
              <input 
                type="password" 
                maxLength={4} 
                value={pin} onChange={e => setPin(e.target.value)}
                placeholder="****"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-mono tracking-widest text-lg" 
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">Confirm PIN</label>
              <input 
                type="password" 
                maxLength={4} 
                value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
                placeholder="****"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-mono tracking-widest text-lg" 
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={savePin} 
                disabled={pin.length !== 4 || pin !== confirmPin}
                className="flex-1 bg-rose-500 text-white rounded-xl py-3 font-semibold hover:bg-rose-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {pinSaved ? <><CheckCircle2 className="w-5 h-5"/> Saved</> : <><Save className="w-5 h-5"/> Save PIN</>}
              </button>
              {localStorage.getItem('appPin') && (
                <button onClick={removePin} className="px-4 bg-gray-100 dark:bg-gray-800 text-red-500 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors tooltip" title="Remove PIN">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Account & Logout Section */}
        <section className={`p-6 rounded-3xl shadow-sm border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-6">
            <UserIcon className="w-6 h-6 text-rose-500" />
            <h2 className="text-lg font-bold">Account Space</h2>
          </div>
          
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 mb-6">
            <img src={user.avatar} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-rose-200 dark:border-rose-900/50" />
            <div>
              <p className="font-bold text-lg">{user.username}</p>
              <p className="text-sm text-gray-500">{user.email || 'No email set'}</p>
            </div>
          </div>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/30"
          >
            <LogOut className="w-5 h-5" />
            Logout from Our Space
          </button>
        </section>

      </div>
    </div>
  );
}
