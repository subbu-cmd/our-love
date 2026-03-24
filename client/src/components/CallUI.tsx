import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, AlertCircle } from 'lucide-react';
import type { CallState } from '../hooks/useWebRTC';

interface CallUIProps {
  callState: CallState;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  isAudioMuted: boolean;
  isRemoteVideoEnabled: boolean;
  weakNetwork: boolean;
  onEndCall: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onAnswerCall?: (video: boolean) => void;
  partnerName: string;
}

export default function CallUI({
  callState,
  localVideoRef,
  remoteVideoRef,
  isVideoEnabled,
  isAudioMuted,
  isRemoteVideoEnabled,
  weakNetwork,
  onEndCall,
  onToggleVideo,
  onToggleAudio,
  onAnswerCall,
  partnerName
}: CallUIProps) {
  const [callDuration, setCallDuration] = useState(0);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected') {
      interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (callState === 'idle') return null;

  return (
    <div className="absolute inset-0 z-50 bg-gray-900 overflow-hidden flex flex-col font-sans transition-all duration-300">
      
      {/* Background / Remote Video */}
      <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
        {(callState === 'calling' || callState === 'receiving') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 z-10 bg-gray-900/90 backdrop-blur-sm">
             <div className="relative">
               <div className="w-24 h-24 rounded-full bg-rose-500 animate-pulse flex items-center justify-center text-4xl text-white font-bold shadow-2xl">
                 {partnerName[0]}
               </div>
               {callState === 'calling' && (
                 <div className="absolute inset-0 rounded-full border-4 border-rose-400 animate-ping opacity-75"></div>
               )}
             </div>
             <h2 className="text-white text-3xl font-semibold tracking-tight">{partnerName}</h2>
             <p className="text-rose-200 text-lg">{callState === 'calling' ? 'Calling...' : 'Incoming Call...'}</p>

             {/* Receiving Actions */}
             {callState === 'receiving' && onAnswerCall && (
               <div className="flex space-x-8 mt-12">
                 <button 
                  onClick={() => onEndCall()}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                 >
                   <PhoneOff className="w-8 h-8 text-white" />
                 </button>
                 <button 
                  onClick={() => onAnswerCall(false)}
                  className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                 >
                   <Phone className="w-8 h-8 text-white" />
                 </button>
                 <button 
                  onClick={() => onAnswerCall(true)}
                  className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                 >
                   <Video className="w-8 h-8 text-white" />
                 </button>
               </div>
             )}

             {/* Calling Actions */}
             {callState === 'calling' && (
               <div className="mt-12">
                 <button 
                  onClick={() => onEndCall()}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                 >
                   <PhoneOff className="w-8 h-8 text-white" />
                 </button>
               </div>
             )}
          </div>
        )}

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${(callState === 'connected' && isRemoteVideoEnabled) ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
        />

        {/* Remote Video Disabled Fallback UI */}
        {callState === 'connected' && !isRemoteVideoEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
             <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-3xl text-gray-300">
               {partnerName[0]}
             </div>
             <p className="mt-4 text-gray-400">Video Paused</p>
          </div>
        )}
      </div>

      {/* Local Video PIP */}
      {(callState === 'connected' || callState === 'reconnecting') && (
        <div className="absolute top-6 right-6 w-28 h-40 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 z-20 transition-all">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isVideoEnabled ? 'opacity-100' : 'opacity-0'}`}
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
      )}

      {/* Top Banner overlay (Network status / Timer) */}
      {(callState === 'connected' || callState === 'reconnecting') && (
        <div className="absolute top-6 left-6 z-20 flex flex-col space-y-2">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white font-medium shadow-lg flex items-center space-x-2">
            {callState === 'reconnecting' ? (
              <span className="flex items-center space-x-2 text-yellow-400">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
                <span>Reconnecting...</span>
              </span>
            ) : (
              <span>{formatTime(callDuration)}</span>
            )}
          </div>
          {weakNetwork && (
            <div className="bg-orange-500/80 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-lg flex items-center space-x-1 animate-pulse">
              <AlertCircle className="w-4 h-4" />
              <span>Weak Connection. Prioritizing Audio.</span>
            </div>
          )}
        </div>
      )}

      {/* Controls Bar */}
      {(callState === 'connected' || callState === 'reconnecting') && (
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center">
          <div className="bg-black/60 backdrop-blur-xl px-8 py-4 rounded-3xl flex space-x-6 items-center shadow-2xl border border-white/10">
            <button 
              onClick={onToggleAudio}
              className={`p-4 rounded-full transition-all ${isAudioMuted ? 'bg-white text-gray-900' : 'bg-gray-700/50 text-white hover:bg-gray-600'}`}
            >
              {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button 
              onClick={onToggleVideo}
              className={`p-4 rounded-full transition-all ${!isVideoEnabled ? 'bg-white text-gray-900' : 'bg-gray-700/50 text-white hover:bg-gray-600'}`}
            >
              {!isVideoEnabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => onEndCall()}
              className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 hover:scale-105 transition-all shadow-lg shadow-red-500/30 ml-4"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
