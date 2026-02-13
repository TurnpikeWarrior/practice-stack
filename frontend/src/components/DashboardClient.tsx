'use client';

import { useState, useEffect } from 'react';
import Chat from '@/components/Chat';
import Header from '@/components/Header';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function DashboardClient({ user }: { user: User }) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [trackedBills, setTrackedBills] = useState<any[]>([]);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchTrackedBills();
  }, []);

  const fetchTrackedBills = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('http://localhost:8000/tracked-bills', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTrackedBills(data);
      }
    } catch (err) {
      console.error('Error fetching tracked bills:', err);
    }
  };

  const handleUntrack = async (billId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`http://localhost:8000/tracked-bills/${billId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        setTrackedBills(prev => prev.filter(b => b.bill_id !== billId));
      }
    } catch (err) {
      console.error('Error untracking bill:', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="h-screen bg-white flex flex-col font-sans selection:bg-blue-100 overflow-hidden text-black">
      <Header user={user} onSignOut={handleSignOut} />
      
      {/* Spacer for fixed header */}
      <div className="h-16 shrink-0" />

      <main className="flex-1 flex items-center justify-center p-6 relative bg-gray-50/30">
        {/* Background Visuals */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.02]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-black tracking-tighter text-blue-900 select-none">
            COSINT
          </div>
        </div>

        <div className="z-10 w-full max-w-2xl flex flex-col items-center justify-center">
          {/* Subtle Welcome Tag */}
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-[0.2em]">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
            Secure Intel Node Active
          </div>

          {/* Centered Chat - perfectly positioned */}
          <div className="w-full transition-all duration-700 hover:scale-[1.01] flex justify-center">
            <Chat 
              mode="centered"
              conversationId={currentConversationId} 
              onIdGenerated={setCurrentConversationId}
              user={user}
            />
          </div>

          {/* Tracked Bills Monitoring Section */}
          {trackedBills.length > 0 && (
            <div className="w-full max-w-4xl mt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                Legislation Monitoring
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trackedBills.map((bill) => (
                  <div key={bill.bill_id} className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 hover:border-blue-200 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
                        {bill.bill_type.toUpperCase()}{bill.bill_number}
                      </span>
                      <button 
                        onClick={() => handleUntrack(bill.bill_id)}
                        className="text-[9px] font-black text-gray-300 hover:text-red-600 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Stop Tracking
                      </button>
                    </div>
                    <p className="text-sm font-bold text-black leading-tight mb-2">{bill.title}</p>
                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Congress: {bill.congress}</span>
                      <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                      <a 
                        href={`https://www.congress.gov/bill/${bill.congress}/${bill.bill_type.toLowerCase()}-bill/${bill.bill_number}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[9px] font-black text-blue-600 hover:underline uppercase tracking-widest"
                      >
                        Official Source →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Minimal Status Indicators below chat */}
          <div className="mt-6 flex justify-center gap-8 w-full">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">Source</span>
              <span className="text-[10px] font-bold text-black border-b border-blue-600 pb-0.5">Congress API v3</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">Engine</span>
              <span className="text-[10px] font-bold text-black border-b border-blue-600 pb-0.5">Neural Core 4.0</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center bg-white border-t border-gray-50">
        <p className="text-[8px] text-gray-300 font-black uppercase tracking-[0.4em]">
          Strategic Terminal &bull; Protocol v1.0.42 &bull; Secure Session
        </p>
      </footer>
    </div>
  );
}
