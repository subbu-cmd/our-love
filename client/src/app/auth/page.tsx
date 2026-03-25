'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Lock, User as UserIcon } from 'lucide-react';
import { useAppContext } from '../../components/Providers';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ;

export default function AuthPage() {
  const router = useRouter();
  const { setUser, setPairId, setPartner } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/login' : '/api/signup';
    
    // Client-side validation
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const payload = isLogin 
      ? { identifier: username, password } 
      : { username, email, password, confirmPassword };
    
    try {
      const res = await fetch(`${SOCKET_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setUser(data.user);
        
        // Save to localStorage for persistence
        const storageData: any = { user: data.user };
        
        if (data.pairId) {
          storageData.pairId = data.pairId;
          storageData.partner = data.partner;
          setPairId(data.pairId);
          setPartner(data.partner);
        }
        
        localStorage.setItem('userData', JSON.stringify(storageData));
        
        if (data.pairId) {
          router.push('/chat');
        } else {
          router.push('/pair');
        }
      } else {
        setError(data.error || data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-rose-50 dark:bg-gray-950 font-sans p-4">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-12 flex flex-col items-center border border-rose-100 dark:border-gray-800 transition-colors duration-500 relative overflow-hidden">
        
        {/* Decorative background blur */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-br from-rose-200 to-pink-300 dark:from-rose-900/30 dark:to-purple-900/30 opacity-40 blur-3xl z-0" />
        
        <div className="z-10 flex flex-col items-center w-full">
          <Heart className="w-16 h-16 text-rose-500 fill-rose-500 drop-shadow-lg mb-6 animate-bounce" />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Create Our Space'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 text-center max-w-[250px]">
             {isLogin ? 'Enter your credentials to return to your private universe.' : 'Sign up to start a secure, encrypted dimension for just you and your love.'}
          </p>

          {error && (
            <div className="w-full bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 p-3 rounded-xl text-sm mb-6 text-center border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="w-full bg-green-50 dark:bg-green-900/30 text-green-500 dark:text-green-400 p-3 rounded-xl text-sm mb-6 text-center border border-green-100 dark:border-green-800">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="text" 
                placeholder={isLogin ? "Email or Username" : "Username"} 
                required 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full bg-gray-50 dark:bg-gray-800 border-none pl-12 pr-5 py-4 rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all outline-none dark:text-white" 
              />
            </div>

            {!isLogin && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none pl-12 pr-5 py-4 rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all outline-none dark:text-white" 
                />
              </div>
            )}
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="password" 
                placeholder={isLogin ? "Passcode" : "Password"} 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full bg-gray-50 dark:bg-gray-800 border-none pl-12 pr-5 py-4 rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all outline-none dark:text-white" 
              />
            </div>

            {!isLogin && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" 
                  placeholder="Confirm Password" 
                  required 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none pl-12 pr-5 py-4 rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all outline-none dark:text-white" 
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-rose-500 text-white font-semibold py-4 rounded-2xl hover:bg-rose-600 hover:scale-[1.02] transition-all shadow-xl shadow-rose-200 dark:shadow-rose-900/20 mt-6 disabled:opacity-70 flex items-center justify-center h-[56px]"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                isLogin ? 'Enter' : 'Sign Up'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} 
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors"
            >
              {isLogin ? "Don&apos;t have an account? Sign up" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
