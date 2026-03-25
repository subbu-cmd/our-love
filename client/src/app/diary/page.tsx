/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CalendarHeart, Plus, Heart, MapPin, Edit3 } from 'lucide-react';
import { useAppContext } from '../../components/Providers';

type Event = {
  id: string;
  title: string;
  date: string;
  description: string;
  icon: string;
};

export default function DiaryPage() {
  const router = useRouter();
  const { user, partner, theme } = useAppContext();
  
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!user) { router.push('/auth'); return; }
    
    // Load events from LocalStorage or use some romantic defaults
    const saved = localStorage.getItem(`diary_${user.id}`);
    if (saved) {
      setEvents(JSON.parse(saved));
    } else {
      const defaultEvents = [
        { id: '1', title: 'The Day We Met', date: '2023-05-14', description: 'It was magical from the first hello.', icon: '✨' },
        { id: '2', title: 'First Date', date: '2023-05-20', description: 'Coffee and endless conversations.', icon: '☕' },
        { id: '3', title: 'Made it Official', date: '2023-06-12', description: 'The start of our private universe.', icon: '💖' },
      ];
      setEvents(defaultEvents);
      localStorage.setItem(`diary_${user.id}`, JSON.stringify(defaultEvents));
    }
  }, [user, router]);

  const addEvent = () => {
    const newEvent = {
       id: Date.now().toString(),
       title: 'New Memory',
       date: new Date().toISOString().split('T')[0],
       description: 'A special moment together.',
       icon: '🌟'
    };
    const updated = [newEvent, ...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEvents(updated);
    if(user) localStorage.setItem(`diary_${user.id}`, JSON.stringify(updated));
  };

  if (!user) return null;

  return (
    <div className={`flex flex-col min-h-screen font-sans ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-500`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-20 px-6 py-4 flex items-center justify-between backdrop-blur-xl shrink-0 ${theme === 'dark' ? 'bg-gray-900/80 border-b border-gray-800' : 'bg-white/80 border-b border-gray-100'}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/chat')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Our Timeline</h1>
        </div>
        <button onClick={addEvent} className="flex bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-full transition-colors shadow-lg shadow-rose-500/30">
           <Plus className="w-5 h-5"/>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-6 py-12 relative">
        
        {/* Timeline Center Line */}
        <div className="absolute left-1/2 top-12 bottom-12 w-1 bg-gradient-to-b from-rose-300 via-pink-400 to-rose-200 dark:from-rose-900/50 dark:via-purple-900/50 dark:to-transparent -translate-x-1/2 rounded-full hidden md:block opacity-50"></div>
        
        {/* Mobile Left Line */}
        <div className="absolute left-10 top-12 bottom-12 w-1 bg-gradient-to-b from-rose-300 via-pink-400 to-transparent dark:from-rose-900/50 dark:to-transparent rounded-full md:hidden opacity-50"></div>

        <div className="space-y-12">
          {events.map((ev, index) => {
            const isLeft = index % 2 === 0;
            return (
              <div key={ev.id} className={`relative flex items-center ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} flex-row group animate-in slide-in-from-bottom-4 duration-700`}>
                
                {/* Timeline Node */}
                <div className="absolute left-[13px] md:left-1/2 md:-translate-x-1/2 w-12 h-12 rounded-full bg-white dark:bg-gray-900 border-4 border-rose-100 dark:border-gray-800 shadow-xl flex items-center justify-center text-xl z-10 group-hover:scale-125 transition-transform duration-300 group-hover:border-rose-300 dark:group-hover:border-rose-900">
                   {ev.icon}
                </div>

                {/* Content Box */}
                <div className={`ml-20 md:ml-0 md:w-1/2 flex flex-col ${isLeft ? 'md:pr-16 md:items-end md:text-right' : 'md:pl-16 items-start text-left'}`}>
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-shadow relative overflow-hidden group-hover:border-rose-200 dark:group-hover:border-gray-700">
                    
                    {/* Decorative glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                    <div className={`flex items-center gap-2 text-rose-500 mb-2 font-medium text-sm ${isLeft ? 'md:justify-end' : ''}`}>
                      <CalendarHeart className="w-4 h-4" />
                      {new Date(ev.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <h3 className="text-xl font-bold tracking-tight mb-2 dark:text-white">{ev.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{ev.description}</p>
                    
                    <div className={`mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 text-gray-400 ${isLeft ? 'md:justify-end' : ''}`}>
                       <button className="hover:text-rose-500 transition-colors"><MapPin className="w-4 h-4" /></button>
                       <button className="hover:text-blue-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
        
        {/* End of timeline graphic */}
        <div className="flex justify-center mt-12 md:mt-24">
           <Heart className="w-8 h-8 text-rose-300 dark:text-gray-800 fill-current animate-pulse" />
        </div>

      </div>
    </div>
  );
}
