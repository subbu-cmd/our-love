'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useAppContext } from '../components/Providers';

export default function SplashScreen() {
  const router = useRouter();
  const { user, pairId } = useAppContext();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Artificial delay for splash screen animation
    const timer = setTimeout(() => {
      setShowSplash(false);
      // Let existing session hydrate first
      setTimeout(() => {
        if (!user) router.push('/auth');
        else if (!pairId) router.push('/pair');
        else router.push('/chat');
      }, 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, pairId, router]);

  return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center bg-gray-950 z-[100] transition-opacity duration-1000 ${showSplash ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
         <div className="absolute w-[500px] h-[500px] bg-rose-600/20 rounded-full blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
         <div className="absolute w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[80px] top-1/4 left-1/4 animate-ping" style={{ animationDuration: '4s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* 3D-ish Heart Animation using CSS transforms and drop-shadows */}
        <div className="relative w-32 h-32 flex items-center justify-center animate-bounce" style={{ animationDuration: '2s' }}>
           <Heart className="w-24 h-24 text-rose-500 fill-rose-500 absolute drop-shadow-[0_0_30px_rgba(244,63,94,0.8)]" />
           <Heart className="w-24 h-24 text-rose-400 fill-transparent absolute animate-ping opacity-75" />
        </div>
        
        <h1 className="mt-8 text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-600 tracking-tight animate-pulse">
           Our Space
        </h1>
        <p className="mt-4 text-gray-400 text-sm font-medium tracking-widest uppercase animate-pulse" style={{ animationDelay: '0.5s' }}>
           A Private Universe
        </p>
      </div>
    </div>
  );
}
