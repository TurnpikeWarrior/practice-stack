'use client';

import { useState } from 'react';
import Chat from '@/components/Chat';
import Header from '@/components/Header';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function DashboardClient({ user }: { user: User }) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-blue-100">
      <Header user={user} onSignOut={handleSignOut} />

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative pt-24 pb-12">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
        </div>

        <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-16">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
              Secure Intel Node Active
            </div>
            <h2 className="text-6xl md:text-7xl font-black text-black tracking-tighter leading-none">
              Strategic <span className="text-blue-600">Intel.</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-xl mx-auto font-medium leading-relaxed tracking-tight">
              A high-precision terminal for real-time Congressional oversight, voting records, and localized intelligence.
            </p>
          </div>

          <div className="w-full max-w-2xl transform transition-all duration-700 hover:scale-[1.01]">
            <Chat 
              mode="centered"
              conversationId={currentConversationId} 
              onIdGenerated={setCurrentConversationId}
              user={user}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-12 w-full max-w-3xl mt-8">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Data Feed</span>
              <span className="text-sm font-bold text-black border-b-2 border-blue-600 pb-1">Congress API v3</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Analysis</span>
              <span className="text-sm font-bold text-black border-b-2 border-blue-600 pb-1">Neural Core 4.0</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Security</span>
              <span className="text-sm font-bold text-black border-b-2 border-blue-600 pb-1">Supabase PKCE</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center bg-white">
        <p className="text-[9px] text-gray-300 font-black uppercase tracking-[0.4em]">
          Cosint Strategic Platform &bull; Protocol v1.0.42 &bull; All Systems Operational
        </p>
      </footer>
    </div>
  );
}
