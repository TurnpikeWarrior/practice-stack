'use client';

import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <div className="bg-blue-600 p-8 text-center text-white">
          <h1 className="text-3xl font-black tracking-tighter">COSINT</h1>
          <p className="mt-2 text-blue-100 text-sm font-medium uppercase tracking-widest">
            Intelligence Access Terminal
          </p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-black">Sign In</h2>
            <p className="text-sm text-gray-500">Access your private briefings and intelligence reports.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-xl text-black font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#24292e] text-white rounded-xl font-bold hover:bg-[#1b1f23] transition-all shadow-md"
            >
              <img src="https://github.com/favicon.ico" alt="GitHub" className="w-5 h-5 invert" />
              Continue with GitHub
            </button>
          </div>

          <p className="text-[10px] text-gray-400 text-center uppercase tracking-tighter pt-4">
            By accessing this system, you agree to our Terms of Intelligence & Data Usage.
          </p>
        </div>
      </div>
    </div>
  );
}
