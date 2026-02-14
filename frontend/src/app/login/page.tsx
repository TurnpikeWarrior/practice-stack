'use client';

import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-blue-100 text-black">
      {/* Public Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center font-black text-white text-xl shadow-inner" aria-hidden="true">
            C
          </div>
          <span className="text-lg font-extrabold tracking-tight text-black uppercase tracking-wider">
            COSINT
          </span>
        </div>
        <div>
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">Secure Access Required</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 pt-32 pb-12 relative overflow-hidden">
        {/* Abstract Background depth */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.03]" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-black tracking-tighter text-blue-900 select-none">
            INTEL
          </div>
        </div>

        <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-12">
          {/* Headline from User Image */}
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <span className="text-xl font-black text-black uppercase tracking-[0.2em]">Civic Open Source Intelligence</span>
              <h2 className="text-6xl md:text-8xl font-black text-black tracking-tighter leading-none">
                Stay <span className="text-blue-700">Informed.</span>
              </h2>
            </div>
            <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto font-bold leading-relaxed tracking-tight">
              A high-precision terminal for real-time Congressional oversight, voting records, and localized intelligence.
            </p>
          </div>

          {/* Login Card */}
          <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-200 transition-all hover:shadow-[0_30px_120px_rgba(0,0,0,0.15)]">
            <div className="p-10 space-y-8">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-black tracking-tight uppercase">Authentication</h3>
                <p className="text-sm text-gray-700 font-bold">Please verify your credentials to enter the terminal.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-black rounded-xl text-center uppercase tracking-widest" role="alert">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <button
                  onClick={() => handleOAuthLogin('google')}
                  className="w-full flex items-center justify-center gap-4 px-6 py-4 bg-white border-2 border-gray-200 rounded-2xl text-black font-black uppercase tracking-widest text-xs hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm active:scale-95"
                  aria-label="Continue with Google authentication"
                >
                  <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5" aria-hidden="true" />
                  Continue with Google
                </button>

                <button
                  onClick={() => handleOAuthLogin('github')}
                  className="w-full flex items-center justify-center gap-4 px-6 py-4 bg-[#171717] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-xl active:scale-95"
                  aria-label="Continue with GitHub authentication"
                >
                  <img src="https://github.com/favicon.ico" alt="" className="w-5 h-5 invert" aria-hidden="true" />
                  Continue with GitHub
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center">
        <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.4em]">
          Cosint Terminal &bull; Secure Encrypted Session
        </p>
      </footer>
    </div>
  );
}
