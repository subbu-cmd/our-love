/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4000';

type User = { id: string; username: string; email: string; avatar: string; };

interface AppContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  pairId: string | null;
  setPairId: React.Dispatch<React.SetStateAction<string | null>>;
  partner: User | null;
  setPartner: React.Dispatch<React.SetStateAction<User | null>>;
  socket: Socket | null;
  theme: string;
  setTheme: (theme: string) => void;
  appLocked: boolean;
  setAppLocked: React.Dispatch<React.SetStateAction<boolean>>;
  isHydrating: boolean;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [partner, setPartner] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [theme, setTheme] = useState('light');
  const [appLocked, setAppLocked] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    const checkStatus = async (userId: string) => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/user-status/${userId}`);
        const data = await res.json();
        if (res.ok && data.success && data.pairId) {
          setPairId(data.pairId);
          setPartner(data.partner);
        }
      } catch (err) {
        console.error("Status check failed", err);
      } finally {
        setIsHydrating(false);
      }
    };

    const storedUser = localStorage.getItem('userData');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.user) {
          setUser(parsed.user);
          const pId = parsed.pairId || null;
          setPairId(pId);
          setPartner(parsed.partner || null);
          
          // Verification check: if user is found but pairId is missing locally, 
          // or just to be 100% sure, check the server.
          // Note: we ONLY set isHydrating to false inside checkStatus if we find a user,
          // OR if we skip it.
          if (parsed.user.id) {
            checkStatus(parsed.user.id);
            return; // Exit early, checkStatus will finish hydration
          }
        }
      } catch (err) {
        console.error("Failed to parse stored userData", err);
      }
    }

    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) setTheme(storedTheme);
    
    // Check if App Lock is enabled
    const pin = localStorage.getItem('appPin');
    if (pin) setAppLocked(true);
    
    setIsHydrating(false);
  }, []);

  // Auto-sync state to localStorage whenever it changes
  useEffect(() => {
    if (isHydrating) return; // Wait until initial hydration is done
    
    if (user) {
      const storageData = { user, pairId, partner };
      localStorage.setItem('userData', JSON.stringify(storageData));
    } else {
      localStorage.removeItem('userData');
    }
  }, [user, pairId, partner, isHydrating]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle Socket Connection globally when user is signed in
  useEffect(() => {
    if (user) {
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);
      
      newSocket.on('connect', () => {
        newSocket.emit('user_joined', { userId: user.id, pairId });
      });

      // Listen for real-time pairing updates
      newSocket.on('paired', (data: { pairId: string, partner: User }) => {
        setPairId(data.pairId);
        setPartner(data.partner);
      });

      return () => {
         newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [user]); // Only depend on user, as pairId might change later

  const logout = () => {
    setUser(null);
    setPairId(null);
    setPartner(null);
    localStorage.removeItem('userData');
    // We don't remove theme or appPin on logout usually, but we can clear pair-specific data if any
    window.location.href = '/auth';
  };

  return (
    <AppContext.Provider value={{ 
      user, setUser, 
      pairId, setPairId, 
      partner, setPartner, 
      socket, 
      theme, setTheme, 
      appLocked, setAppLocked,
      isHydrating,
      logout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within Providers');
  return context;
}
