'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Delete, Fingerprint } from 'lucide-react';
import { useAppContext } from './Providers';

export function AppLock({ children }: { children: React.ReactNode }) {
  const { appLocked, setAppLocked } = useAppContext();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);

  useEffect(() => {
    // Only access localStorage on client mount
    setSavedPin(localStorage.getItem('appPin'));
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === savedPin) {
        setAppLocked(false);
        setPin(''); // Reset for next time
      } else {
        setError(true);
        setTimeout(() => { setError(false); setPin(''); }, 600);
      }
    }
  }, [pin, savedPin, setAppLocked]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) setPin(p => p + num);
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  // If no PIN is set, or it's unlocked, render app
  if (!appLocked || !savedPin) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gray-950/95 backdrop-blur-3xl font-sans text-white transition-all duration-500">
      
      <div className="flex flex-col items-center max-w-sm w-full px-8 animate-in zoom-in-95 duration-500">
         <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-8 border border-rose-500/30 glow-effect">
            <Lock className="w-10 h-10 text-rose-500" />
         </div>
         
         <h2 className="text-2xl font-bold tracking-tight mb-2">App Locked</h2>
         <p className="text-gray-400 text-sm mb-12 text-center">Enter your passcode or use biometric ID to enter Our Space.</p>

         {/* PIN Dots */}
         <div className={`flex gap-6 mb-16 ${error ? 'animate-shake' : ''}`}>
           {[0, 1, 2, 3].map(i => (
             <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${pin.length > i ? 'bg-rose-500 scale-125 shadow-[0_0_15px_rgba(244,63,94,0.6)]' : 'bg-gray-700'}`} />
           ))}
         </div>

         {/* Numpad */}
         <div className="grid grid-cols-3 gap-x-6 gap-y-6 mb-8">
           {['1','2','3','4','5','6','7','8','9','','0'].map((num, i) => (
             num === '' ? <div key={i} /> :
             <button key={num} onClick={() => handleKeyPress(num)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium hover:bg-white/10 active:bg-white/20 transition-colors">
               {num}
             </button>
           ))}
           <button onClick={handleDelete} className="w-16 h-16 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors text-gray-400 hover:text-white">
             <Delete className="w-6 h-6" />
           </button>
         </div>

         <button className="flex items-center gap-2 text-rose-400 font-medium hover:text-rose-300 transition-colors py-4">
           <Fingerprint className="w-5 h-5" /> Use Biometrics
         </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .glow-effect { box-shadow: 0 0 40px rgba(244, 63, 94, 0.3); }
      `}} />
    </div>
  );
}
