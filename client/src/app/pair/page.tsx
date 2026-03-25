'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../components/Providers';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4000';

export default function PairPage() {
  const router = useRouter();
  const { user, setPairId, setPartner } = useAppContext();
  
  const [inviteCode, setInviteCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
    }
  }, [user, router]);

  const generateInvite = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SOCKET_URL}/api/generate-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInviteCode(data.code);
      } else {
        setError(data.error || 'Failed to generate invite code.');
      }
    } catch (err) {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const joinPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SOCKET_URL}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, code: inputCode.trim().toUpperCase() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const storageData = JSON.parse(localStorage.getItem('userData') || '{}');
        storageData.pairId = data.pairId;
        storageData.partner = data.partner;
        localStorage.setItem('userData', JSON.stringify(storageData));
        
        setPairId(data.pairId);
        setPartner(data.partner);
        router.push('/chat');
      } else {
        setError(data.error || 'Failed to link partner.');
      }
    } catch (err) {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-rose-50 dark:bg-gray-950 font-sans p-4">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 flex flex-col items-center border border-rose-100 dark:border-gray-800 transition-colors duration-500">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/50 rounded-full flex items-center justify-center mb-6">
           <Link2 className="w-8 h-8 text-rose-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2 text-center">
          Find Your Partner
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 text-center">
          Share your code or enter your partner's code to create your private universe.
        </p>

        {error && (
          <div className="w-full bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 p-3 rounded-xl text-sm mb-6 text-center border border-red-100 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="w-full space-y-6">
          {/* Generate Code Section */}
          <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
             <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Invite Code</p>
             {inviteCode ? (
               <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-xl border border-rose-200 dark:border-rose-900/30">
                 <span className="text-2xl tracking-[0.2em] font-mono font-bold text-rose-500 mx-auto">{inviteCode}</span>
                 <button onClick={copyToClipboard} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors text-gray-400">
                   {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 hover:text-rose-500" />}
                 </button>
               </div>
             ) : (
               <button onClick={generateInvite} disabled={loading} className="w-full py-3 bg-white dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:border-rose-300 dark:hover:border-rose-500 transition-colors text-sm">
                  Generate Code
               </button>
             )}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium uppercase">or</span>
            <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
          </div>

          {/* Join Code Section */}
          <form onSubmit={joinPartner} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
             <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Enter Partner&apos;s Code</p>
             <div className="flex gap-2">
               <input 
                  type="text" 
                  placeholder="e.g. A1B2C3" 
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 bg-white dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-mono text-center tracking-widest uppercase font-bold text-lg" 
               />
               <button type="submit" disabled={!inputCode || loading} className="px-4 bg-rose-500 text-white rounded-xl hover:bg-rose-600 disabled:opacity-50 transition-colors flex items-center justify-center">
                  <ArrowRight className="w-5 h-5" />
               </button>
             </div>
          </form>
        </div>
      </div>
    </div>
  );
}
