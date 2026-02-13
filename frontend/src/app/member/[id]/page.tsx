'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Chat from '@/components/Chat';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

type MemberData = {
  details: any;
  bills: any[];
  votes: any[];
};

export default function MemberDashboard({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const bioguideId = resolvedParams.id;
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<MemberData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);
      
      try {
        const response = await fetch(`http://localhost:8000/member/${bioguideId}`);
        if (!response.ok) throw new Error('Failed to fetch representative details');
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [bioguideId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading || !user) return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <Header user={user} onSignOut={handleSignOut} />
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border">
        <h2 className="text-2xl font-black text-red-600 mb-4 uppercase tracking-tighter">System Error</h2>
        <p className="text-gray-600 mb-6 font-medium">{error || "Could not retrieve representative intelligence."}</p>
        <Link href="/" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95">
          Return to Terminal
        </Link>
      </div>
    </div>
  );

  const { details, bills, votes } = data;

  return (
    <div className="min-h-screen bg-white pb-24 font-sans selection:bg-blue-100 text-black">
      <Header user={user} onSignOut={handleSignOut} />

      {/* Hero Section */}
      <div className="bg-blue-600 pt-32 pb-16 text-white overflow-hidden relative shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <div className="text-9xl font-black tracking-tighter">COSINT</div>
        </div>
        <div className="container mx-auto px-6 max-w-6xl flex flex-col md:flex-row items-center gap-10 relative z-10">
          <div className="relative group">
            <div className="absolute inset-0 bg-white rounded-3xl rotate-3 scale-105 opacity-20 group-hover:rotate-6 transition-transform duration-500"></div>
            {details.depiction?.imageUrl ? (
              <img 
                src={details.depiction.imageUrl} 
                alt={details.directOrderName}
                className="w-48 h-48 rounded-2xl border-4 border-white shadow-2xl relative z-10 bg-gray-100 object-cover"
              />
            ) : (
              <div className="w-48 h-48 rounded-2xl border-4 border-white shadow-2xl relative z-10 bg-blue-800 flex items-center justify-center text-6xl font-black">
                {details.lastName?.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-center md:text-left flex-1 space-y-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${
                details.partyHistory?.[0]?.partyName === 'Republican' ? 'bg-red-500' : 'bg-blue-500'
              } border border-white/20`}>
                {details.partyHistory?.[0]?.partyName}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-[0.2em]">
                {details.state} {details.terms?.[0]?.district ? `District ${details.terms[0].district}` : 'Senator'}
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">{details.directOrderName}</h1>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-4">
              <a href={details.officialWebsiteUrl} target="_blank" rel="noreferrer" className="bg-white text-blue-600 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg active:scale-95">
                Official Web
              </a>
              <Link href="/" className="bg-blue-700 text-white border border-white/30 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-800 transition-all active:scale-95">
                New Inquiry
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-6 max-w-6xl -mt-10 grid grid-cols-1 lg:grid-cols-4 gap-10 relative z-20">
        {/* Info Sidebar */}
        <section className="lg:col-span-1 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100">
            <h2 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-8 border-b border-gray-100 pb-2">Intelligence Profile</h2>
            <dl className="space-y-8">
              <div className="group">
                <dt className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Birth Date</dt>
                <dd className="text-black text-xl font-bold group-hover:text-blue-600 transition-colors">{details.birthYear || 'Unknown'}</dd>
              </div>
              <div className="group">
                <dt className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Congress</dt>
                <dd className="text-black text-xl font-bold group-hover:text-blue-600 transition-colors">{details.terms?.[details.terms.length - 1]?.congress}th</dd>
              </div>
              <div className="group">
                <dt className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">HQ Location</dt>
                <dd className="text-black text-sm font-bold leading-tight group-hover:text-blue-600 transition-colors">{details.addressInformation?.officeAddress || 'Information Withheld'}</dd>
              </div>
              <div className="group">
                <dt className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Secure Line</dt>
                <dd className="text-black text-xl font-bold group-hover:text-blue-600 transition-colors">{details.addressInformation?.phoneNumber || 'N/A'}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Intelligence Data */}
        <div className="lg:col-span-3 space-y-12">
          {/* Voting Ledger */}
          <section className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 bg-gray-50 border-b flex justify-between items-center">
              <h2 className="text-sm font-black text-black uppercase tracking-[0.2em]">Voting Ledger</h2>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Real-time Data</span>
            </div>
            <div className="divide-y border-gray-50">
              {votes.length > 0 ? votes.map((v, i) => (
                <div key={i} className="p-8 hover:bg-gray-50/50 transition-all group">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase tracking-widest">
                      Doc: {v.legislation}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">
                      {new Date(v.date).toISOString().split('T')[0]}
                    </span>
                  </div>
                  <p className="text-black text-base font-bold mb-6 leading-tight group-hover:translate-x-1 transition-transform">{v.question}</p>
                  <div className="flex gap-12">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase font-black text-gray-400 tracking-tighter">Vote Cast</span>
                      <span className={`text-xl font-black ${v.vote === 'Yea' ? 'text-green-600' : v.vote === 'Nay' ? 'text-red-600' : 'text-gray-400'}`}>
                        {v.vote.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 border-l border-gray-100 pl-12">
                      <span className="text-[9px] uppercase font-black text-gray-400 tracking-tighter">Legislation Status</span>
                      <span className="text-xl font-black text-black uppercase">{v.result}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="p-12 text-gray-400 text-sm font-bold uppercase tracking-widest text-center italic">No ledger entries detected.</p>
              )}
            </div>
          </section>

          {/* Legislative Sponsorships */}
          <section className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 bg-gray-50 border-b flex justify-between items-center">
              <h2 className="text-sm font-black text-black uppercase tracking-[0.2em]">Sponsorship Registry</h2>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">10 Entry Log</span>
            </div>
            <div className="divide-y border-gray-50">
              {bills.length > 0 ? bills.map((bill, i) => (
                <div key={i} className="p-8 hover:bg-gray-50/50 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      {bill.type}{bill.number}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Inbound: {bill.introducedDate}
                    </span>
                  </div>
                  <p className="text-black text-base font-bold mb-6 leading-tight">{bill.title}</p>
                  {bill.latestAction && (
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                      <span className="text-[9px] uppercase font-black text-blue-600 block mb-1 tracking-widest">Latest Transmission</span>
                      <p className="text-xs text-black font-medium leading-relaxed">{bill.latestAction.text}</p>
                    </div>
                  )}
                </div>
              )) : (
                <p className="p-12 text-gray-400 text-sm font-bold uppercase tracking-widest text-center italic">No active registries found.</p>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Floating AI Terminal */}
      <Chat 
        mode="floating"
        conversationId={convId}
        onIdGenerated={setConvId}
        user={user}
        initialContext={`The user is currently viewing the profile of ${details.directOrderName}.`}
      />
    </div>
  );
}
