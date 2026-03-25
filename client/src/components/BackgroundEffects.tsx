'use client';

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useAppContext } from './Providers';

export default function BackgroundEffects() {
  const { theme } = useAppContext();
  const [elements, setElements] = useState<{ id: number, left: string, size: string, duration: string, delay: string }[]>([]);

  useEffect(() => {
    // Generate a set of random floating elements
    const newElements = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 20 + 10}px`,
      duration: `${Math.random() * 10 + 15}s`,
      delay: `${Math.random() * 10}s`,
    }));
    setElements(newElements);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Dynamic Glow Orbs - Removed blur for clarity */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-500/5 dark:bg-rose-900/5 animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-pink-500/5 dark:bg-purple-900/5 animate-pulse-glow" style={{ animationDelay: '-4s' }} />

      {/* Floating Hearts */}
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute bottom-[-50px] animate-float text-rose-400/30 dark:text-rose-600/20"
          style={{
            left: el.left,
            fontSize: el.size,
            animationDuration: el.duration,
            animationDelay: el.delay,
          }}
        >
          <Heart fill="currentColor" stroke="none" />
        </div>
      ))}
      
      {/* Overlay - Removed backdrop-blur */}
      <div className="absolute inset-0 bg-white/5 dark:bg-black/5" />
    </div>
  );
}
