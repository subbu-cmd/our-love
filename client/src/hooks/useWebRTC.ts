import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export type CallState = 'idle' | 'calling' | 'receiving' | 'connected' | 'reconnecting' | 'failed';

interface UseWebRTCProps {
  socket: Socket | null;
  userId: string;
}

// Free open TURN server for fallback + Google STUN
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // In a real production app you'd use a paid service like Twilio or Metered.
  // We use openrelay here as a fallback concept.
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

// Production audio constraints
const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export function useWebRTC({ socket, userId }: UseWebRTCProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCallData, setIncomingCallData] = useState<any>(null);
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(true);
  const [weakNetwork, setWeakNetwork] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  // Initialize peer connection
  const initPeerConnection = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice_candidate', {
          candidate: event.candidate,
          to: incomingCallData?.from || 'partner' // Broadcast since 2 users
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        
        // Listen to remote track mute/unmute to detect video downgrade
        event.track.onmute = () => {
          if (event.track.kind === 'video') setIsRemoteVideoEnabled(false);
        };
        event.track.onunmute = () => {
          if (event.track.kind === 'video') setIsRemoteVideoEnabled(true);
        };
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setCallState('reconnecting');
        setWeakNetwork(true);
        
        // Adaptive Bitrate: Auto-disable our video to save bandwidth if failing
        disableLocalVideoToSaveBandwidth();
        
        // Trigger ICE restart if supported
        if (pc.iceConnectionState === 'failed') {
          // pc.restartIce() logic would go here in a full signaling handshake
        }
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState('connected');
        setWeakNetwork(false);
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [socket, incomingCallData]);

  const disableLocalVideoToSaveBandwidth = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      setIsVideoEnabled(false);
    }
  };

  const getMediaStream = async (video: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false,
        audio: AUDIO_CONSTRAINTS
      });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Failed to get media devices', err);
      // Fallback to audio only if video fails (e.g. no camera)
      if (video) {
        return await navigator.mediaDevices.getUserMedia({ video: false, audio: AUDIO_CONSTRAINTS });
      }
      return null;
    }
  };

  // Setup Socket Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('incoming_call', (data) => {
      if (callState === 'idle') {
        setIncomingCallData(data);
        setCallState('receiving');
      }
    });

    socket.on('call_answered', async (data) => {
      const pc = peerConnection.current;
      if (pc && pc.signalingState !== 'closed') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallState('connected');
        } catch (e) {
           console.error('Error setting remote desc on answer', e);
        }
      }
    });

    socket.on('ice_candidate', async (data) => {
      const pc = peerConnection.current;
      if (pc && pc.remoteDescription && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    });

    socket.on('call_ended', () => {
      endCall(false);
    });

    socket.on('peer_disconnected', () => {
      if (callState !== 'idle') {
        setCallState('reconnecting');
        setWeakNetwork(true);
      }
    });

    return () => {
      socket.off('incoming_call');
      socket.off('call_answered');
      socket.off('ice_candidate');
      socket.off('call_ended');
      socket.off('peer_disconnected');
    };
  }, [socket, callState]);

  // Actions
  const startCall = async (video: boolean) => {
    setCallState('calling');
    setIsVideoEnabled(video);
    
    const stream = await getMediaStream(video);
    const pc = initPeerConnection();

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);

    socket?.emit('call_user', {
      from: userId,
      offer,
      isVideo: video
    });
  };

  const answerCall = async (video: boolean) => {
    setCallState('connected');
    setIsVideoEnabled(video);

    const stream = await getMediaStream(video);
    const pc = initPeerConnection();

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    if (incomingCallData?.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket?.emit('answer_call', {
        to: incomingCallData.from,
        answer
      });
    }
  };

  const endCall = (emit = true) => {
    if (emit && socket) {
      socket.emit('end_call');
    }
    
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }

    setCallState('idle');
    setIncomingCallData(null);
    setWeakNetwork(false);
  };

  const toggleVideo = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  return {
    callState,
    localVideoRef,
    remoteVideoRef,
    isVideoEnabled,
    isAudioMuted,
    isRemoteVideoEnabled,
    weakNetwork,
    incomingCallData,
    startCall,
    answerCall,
    endCall,
    toggleVideo,
    toggleAudio
  };
}
