'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Image as ImageIcon, Video, Calendar, Download, X } from 'lucide-react';
import { useAppContext } from '../../components/Providers';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4000';

type MediaItem = {
  id: string;
  url: string;
  type: string;
  timestamp: string;
  sender: string;
};

export default function GalleryPage() {
  const router = useRouter();
  const { user, pairId, partner, theme } = useAppContext();
  
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.push('/auth'); return; }
    
    // Fetch all messages for the pair and extract media
    fetch(`${SOCKET_URL}/api/messages?pairId=${pairId}`)
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        const mediaItems: MediaItem[] = [];
        data.forEach((m: any) => {
          if (m.mediaUrl && !m.isDeleted) {
            mediaItems.push({
              id: m.id,
              url: SOCKET_URL + m.mediaUrl,
              type: m.mediaType,
              timestamp: m.timestamp,
              sender: m.senderId === user.id ? 'You' : (partner?.username || 'Partner')
            });
          }
        });
        // Sort newest first
        setMedia(mediaItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching gallery', err);
        setLoading(false);
      });
  }, [user, pairId, partner, router]);

  if (!user) return null;

  return (
    <div className={`flex flex-col min-h-screen font-sans ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-500`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-20 px-6 py-4 flex items-center justify-between backdrop-blur-xl shrink-0 ${theme === 'dark' ? 'bg-gray-900/80 border-b border-gray-800' : 'bg-white/80 border-b border-gray-100'}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/chat')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Our Memories</h1>
        </div>
        <div className="flex bg-rose-50 dark:bg-rose-900/20 text-rose-500 px-3 py-1 rounded-full text-sm font-semibold gap-1 items-center border border-rose-100 dark:border-rose-900/50">
           <ImageIcon className="w-4 h-4"/> {media.length}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-5xl mx-auto space-y-6">
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
          </div>
        ) : media.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
             <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 opacity-50" />
             </div>
             <p className="font-medium">No memories shared yet</p>
             <p className="text-sm mt-1">Photos and videos you send in chat will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 auto-rows-[150px] md:auto-rows-[200px]">
            {media.map((item) => (
               <div 
                 key={item.id} 
                 className="relative group rounded-2xl md:rounded-3xl overflow-hidden bg-gray-200 dark:bg-gray-800 cursor-pointer shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                 onClick={() => setFullscreenImage(item.url)}
               >
                 {item.type?.startsWith('image') ? (
                   <img src={item.url} alt="Memory" className="w-full h-full object-cover" loading="lazy" />
                 ) : item.type?.startsWith('video') ? (
                   <>
                     <video src={item.url} className="w-full h-full object-cover" />
                     <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white"><Video className="w-4 h-4" /></div>
                   </>
                 ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                     <ImageIcon className="w-8 h-8 mb-2" /> File
                   </div>
                 )}
                 
                 {/* Hover Overlay */}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-white text-xs font-semibold">{item.sender}</p>
                    <p className="text-gray-300 text-[10px] flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(item.timestamp).toLocaleDateString()}</p>
                 </div>
               </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Image */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md transition-opacity duration-300">
           <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
             <button onClick={() => setFullscreenImage(null)} className="text-white hover:bg-white/20 p-2 rounded-full transition-colors flex items-center gap-2">
               <ChevronLeft className="w-6 h-6"/> Back
             </button>
             <a href={fullscreenImage} download className="text-white bg-rose-500 hover:bg-rose-600 px-5 py-2.5 rounded-full transition-colors flex items-center gap-2 font-semibold shadow-lg shadow-rose-500/30">
               <Download className="w-5 h-5" /> Save
             </a>
           </div>
           
           <img src={fullscreenImage} className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300" alt="fullscreen content" />
        </div>
      )}

    </div>
  );
}
