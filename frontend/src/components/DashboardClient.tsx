'use client';

import { useState, useEffect } from 'react';
import Chat from '@/components/Chat';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session');
  
  // Use state but sync it with sessionParam when it changes
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Derived or combined ID
  const currentConversationId = sessionParam || selectedId;

  const handleSelectConversation = (id: string, bioguideId?: string) => {
    if (bioguideId) {
      router.push(`/member/${bioguideId}`);
    } else {
      setSelectedId(id);
      router.push(`/?session=${id}`);
    }
  };

  const handleNewChat = () => {
    setSelectedId(null);
    router.push('/');
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  return (
    <div className="h-screen bg-white flex flex-col font-sans selection:bg-blue-100 overflow-hidden text-black">
      <Header user={user} onSignOut={handleSignOut} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar for Research Tabs */}
        <Sidebar 
          currentId={currentConversationId} 
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
        />

        <main className="flex-1 flex flex-col items-center justify-center p-8 relative bg-gray-50/30 overflow-y-auto">
          {/* Background Visuals */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.02]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-black tracking-tighter text-blue-900 select-none">
              COSINT
            </div>
          </div>

          <div className="z-10 w-full max-w-2xl flex flex-col items-center justify-center">
            {/* Subtle Welcome Tag */}
            <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-[0.2em]">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
              Secure Intel Node Active
            </div>

            {/* Centered Chat - perfectly positioned */}
            <div className="w-full transition-all duration-700 hover:scale-[1.01] flex justify-center">
              <Chat 
                mode="centered"
                conversationId={currentConversationId} 
                onIdGenerated={setSelectedId}
                user={user}
              />
            </div>

            {/* Minimal Status Indicators below chat */}
            <div className="mt-10 flex flex-wrap justify-center gap-x-12 gap-y-6 w-full">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Legislative Source</span>
                <span className="text-xs font-bold text-black border-b-2 border-blue-600 pb-0.5">Congress API v3</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Location Source</span>
                <span className="text-xs font-bold text-black border-b-2 border-blue-600 pb-0.5">Google Civic Data</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Web Intel Source</span>
                <span className="text-xs font-bold text-black border-b-2 border-blue-600 pb-0.5">Brave Search API</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Analysis Engine</span>
                <span className="text-xs font-bold text-black border-b-2 border-blue-600 pb-0.5">GPT-4o-mini</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="py-4 text-center bg-white border-t border-gray-100 z-10 shrink-0">
        <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.4em]">
          Powered by COSINT ENGINE
        </p>
      </footer>
    </div>
  );
}
