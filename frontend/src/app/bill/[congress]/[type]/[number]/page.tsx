'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Chat from '@/components/Chat';
import Sidebar from '@/components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

type BillData = {
  details: any;
  actions: any[];
  cosponsors: any[];
  text: any[];
};

export default function BillDashboard({ params }: { params: Promise<{ congress: string, type: string, number: string }> }) {
  const resolvedParams = use(params);
  const { congress, type, number } = resolvedParams;
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<BillData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);
      
      try {
        const sanitizedType = type.replace(/[^a-zA-Z]/g, '').toLowerCase();
        const response = await fetch(`http://localhost:8000/bill/${congress}/${sanitizedType}/${number}`);
        if (!response.ok) throw new Error('Failed to fetch bill intelligence');
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [congress, type, number]);

  const handleSelectConversation = (id: string, bioguideId?: string) => {
    if (bioguideId) {
      router.push(`/member/${bioguideId}`);
    } else {
      router.push(`/?session=${id}`);
    }
  };

  const handleNewChat = () => {
    router.push('/');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const mainContent = () => {
    if (isLoading || !user) return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );

    if (error || !data) return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border border-gray-200">
          <h2 className="text-2xl font-black text-red-700 mb-4 uppercase tracking-tighter">System Error</h2>
          <p className="text-gray-800 mb-6 font-medium">{error || "Could not retrieve bill intelligence."}</p>
          <Link href="/" className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-md active:scale-95">
            Return to Terminal
          </Link>
        </div>
      </div>
    );

    const { details, actions, cosponsors } = data;

    return (
      <main className="flex-1 overflow-y-auto bg-white py-12">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* Bill Hero Section */}
          <div className="pb-8 border-b border-gray-200 bg-white">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded bg-blue-700 text-white text-xs font-black uppercase tracking-wider">
                  {type.toUpperCase()} {number}
                </span>
                <span className="px-3 py-1 rounded bg-gray-100 border border-gray-200 text-xs font-black uppercase tracking-wider text-gray-700">
                  {congress}th Congress
                </span>
                <span className="px-3 py-1 rounded bg-green-100 border border-green-200 text-xs font-black uppercase tracking-wider text-green-800">
                  Status: {details.latestAction?.text.split('.')[0] || 'In Progress'}
                </span>
              </div>
              
              <h1 className="text-4xl font-black tracking-tight leading-tight text-black max-w-4xl">
                {details.title}
              </h1>

              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex flex-wrap gap-6 items-center text-sm font-semibold text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-gray-400">Sponsor</span>
                    <Link href={`/member/${details.sponsors?.[0]?.bioguideId}`} className="text-blue-700 hover:text-blue-900 font-bold underline decoration-2 underline-offset-4">
                      {details.sponsors?.[0]?.fullName} ({details.sponsors?.[0]?.party}-{details.sponsors?.[0]?.state})
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-gray-400">Introduced</span>
                    <span className="text-black">{details.introducedDate}</span>
                  </div>
                </div>

                <a 
                  href={`https://www.congress.gov/bill/${congress}th-congress/${type.toLowerCase()}/${number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 transition-all shadow-sm active:scale-95"
                >
                  Link to Official Page
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 pb-24">
            {/* Left Column: AI Digest & Action Timeline */}
            <div className="lg:col-span-8 space-y-12">
              <section>
                <h2 className="text-xs font-black text-blue-700 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-700 rounded-full"></span>
                  AI Legislative Digest
                </h2>
                <div className="bg-blue-50/50 rounded-3xl p-8 border border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-700"></div>
                  <div className="prose prose-sm max-w-none text-gray-800 font-medium leading-relaxed">
                    <p className="text-lg font-bold text-black mb-4">Summary provided by COSINT Intelligence Engine:</p>
                    {details.summary?.text ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{details.summary.text}</ReactMarkdown>
                    ) : (
                      <p className="italic opacity-70">Official summary is currently being indexed. Ask the AI terminal for a live analysis of the bill text.</p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xs font-black text-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-black rounded-full"></span>
                  Action Timeline
                </h2>
                <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {actions.slice(0, 15).map((action, i) => (
                    <div key={i} className="relative group">
                      <div className="absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-4 border-white bg-blue-600 shadow-sm z-10"></div>
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group-hover:border-blue-200">
                        <time className="text-[10px] font-black text-blue-700 uppercase tracking-widest block mb-1">
                          {action.actionDate}
                        </time>
                        <p className="text-sm font-bold text-black leading-snug">
                          {action.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column: Sponsorship & Committees */}
            <div className="lg:col-span-4 space-y-12">
              <section className="sticky top-24">
                <h2 className="text-xs font-black text-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-black rounded-full"></span>
                  Sponsorship Ledger
                </h2>
                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                  <div className="p-6 bg-gray-50 border-b border-gray-200">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">Primary Sponsor</span>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                        {details.sponsors?.[0]?.lastName?.[0]}
                      </div>
                      <div>
                        <Link href={`/member/${details.sponsors?.[0]?.bioguideId}`} className="text-base font-black text-black hover:text-blue-700 block transition-colors">
                          {details.sponsors?.[0]?.fullName}
                        </Link>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          {details.sponsors?.[0]?.party} &bull; {details.sponsors?.[0]?.state}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cosponsors</span>
                      <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] font-black">{cosponsors.length}</span>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                      {cosponsors.map((c, i) => (
                        <div key={i} className="flex items-center justify-between group">
                          <Link href={`/member/${c.bioguideId}`} className="text-xs font-bold text-gray-700 hover:text-blue-700 truncate max-w-[180px] transition-colors">
                            {c.fullName}
                          </Link>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${c.party === 'R' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                            {c.party}-{c.state}
                          </span>
                        </div>
                      ))}
                      {cosponsors.length === 0 && (
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center py-4">No cosponsors detected.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-black text-white rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-blue-400">Intelligence Protocol</h3>
                    <p className="text-sm font-medium leading-relaxed opacity-90">
                      Use the AI terminal to analyze specific amendments, floor speeches, or committee reports related to this bill.
                    </p>
                  </div>
                  <div className="absolute -bottom-6 -right-6 text-6xl font-black text-white/5 select-none">
                    INTEL
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    );
  };

  return (
    <div className="h-screen bg-white flex flex-col font-sans selection:bg-blue-100 overflow-hidden text-black">
      <Header user={user || { email: '' } as any} onSignOut={handleSignOut} />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          currentId={null} 
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
        />

        {mainContent()}
      </div>

      {data && user && (
        <Chat 
          mode="floating"
          conversationId={convId}
          onIdGenerated={setConvId}
          user={user}
          initialContext={`The user is currently researching ${type.toUpperCase()} ${number} (${congress}th Congress). Use this bill context for tools. Official Title: ${data.details.title}`}
        />
      )}
    </div>
  );
}
