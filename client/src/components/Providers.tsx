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
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [partner, setPartner] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [theme, setTheme] = useState('light');
  const [appLocked, setAppLocked] = useState(false); // Can be initially true if a PIN is set

  useEffect(() => {
    // Rehydrate user from local storage
    const storedUser = localStorage.getItem('userData');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed.user);
      setPairId(parsed.pairId);
      setPartner(parsed.partner);
    }

    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) setTheme(storedTheme);
    
    // Check if App Lock is enabled
    const pin = localStorage.getItem('appPin');
    if (pin) setAppLocked(true);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Handle Socket Connection globally when user is signed in
  useEffect(() => {
    if (user && pairId) {
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);
      
      newSocket.on('connect', () => {
        newSocket.emit('user_joined', { userId: user.id, pairId });
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
  }, [user, pairId]);

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
