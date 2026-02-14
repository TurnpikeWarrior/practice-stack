'use client';

import { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Chat from '@/components/Chat';
import Sidebar from '@/components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { MemberData } from '@/types';
import { getApiUrl } from '@/utils/api';
import { Skeleton, MemberHeaderSkeleton, CardSkeleton, VoteCardSkeleton } from '@/components/Skeleton';

export const dynamic = 'force-dynamic';

export default function MemberDashboard({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const bioguideId = resolvedParams.id;
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<MemberData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [isTracked, setIsTracked] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [researchNotes, setResearchNotes] = useState<any[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '' });
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedNoteIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchNotes = async () => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(getApiUrl(`/member/${bioguideId}/notes`), {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        const notes = await response.json();
        setResearchNotes(notes);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  };

  const fetchMemberConversation = async () => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(getApiUrl(`/conversations/member/${bioguideId}`), {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConvId(data.id);
        setIsTracked(!!data.id);
      }
    } catch (err) {
      console.error('Failed to fetch member conversation:', err);
    }
  };

  const handleTrackMember = async () => {
    if (isTracked || isTracking) return;
    setIsTracking(true);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(getApiUrl(`/conversations/member/${bioguideId}?name=${encodeURIComponent(data?.details?.directOrderName || '')}`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setConvId(result.id);
        setIsTracked(true);
        // Trigger sidebar refresh
        window.dispatchEvent(new Event('refresh-registry'));
      }
    } catch (err) {
      console.error('Failed to track member:', err);
    } finally {
      setIsTracking(false);
    }
  };

  const captureIntel = async (intel: {title: string, content: string}) => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(getApiUrl(`/member/${bioguideId}/notes`), {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(intel)
      });
      if (response.ok) {
        const newNote = await response.json();
        setResearchNotes(prev => [newNote, ...prev]);
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(getApiUrl(`/notes/${noteId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        setResearchNotes(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(getApiUrl(`/notes/${noteId}`), {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });
      if (response.ok) {
        const updated = await response.json();
        setResearchNotes(prev => prev.map(n => n.id === noteId ? updated : n));
        setEditingNoteId(null);
      }
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const startEditing = (note: any) => {
    setEditingNoteId(note.id);
    setEditForm({ title: note.title, content: note.content });
  };

  const ResearchNoteCard = ({ note }: { note: any }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        setIsOverflowing(scrollHeight > clientHeight);
      }
    }, [note.content]);

    return (
      <div className="bg-white p-2 px-4 rounded-lg shadow-sm border border-gray-100 transition-all hover:border-blue-200 group focus-within:ring-1 focus-ring-blue-500 relative text-black">
        {editingNoteId === note.id ? (
          <div className="flex flex-col gap-2 w-full py-1">
            <input 
              value={editForm.title}
              onChange={(e) => setEditForm({...editForm, title: e.target.value})}
              className="text-xs font-black border-b border-blue-600 outline-none pb-0.5 uppercase tracking-widest bg-transparent w-full text-black"
            />
            <textarea 
              value={editForm.content}
              onChange={(e) => setEditForm({...editForm, content: e.target.value})}
              className="w-full text-sm font-medium border border-gray-100 p-2 rounded-lg outline-none min-h-[60px] bg-gray-50 text-black"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingNoteId(null)} className="px-2 py-1 text-[10px] font-black uppercase text-gray-400 hover:text-black focus:outline-none">Cancel</button>
              <button onClick={() => handleUpdateNote(note.id)} className="px-3 py-1 text-[10px] font-black uppercase bg-blue-600 text-white rounded-lg shadow-md focus:ring-2 focus:ring-blue-400 outline-none">Save</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-0.5">
              <h3 className="text-xs font-black text-blue-700 uppercase tracking-wider">
                {note.title}
              </h3>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => startEditing(note)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors outline-none focus:ring-1 focus:ring-blue-500"
                  title="Edit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                <button 
                  onClick={() => handleDeleteNote(note.id)}
                  className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors outline-none focus:ring-1 focus:ring-red-500"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>

            <div 
              ref={contentRef}
              className={`text-sm text-black font-medium leading-tight prose prose-sm max-w-none prose-p:my-0 prose-headings:text-black prose-strong:text-black transition-all duration-300 ${!isExpanded ? 'line-clamp-4' : ''}`}
            >
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <a 
                      {...props} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-700 underline decoration-2 underline-offset-4 font-black hover:text-blue-900 transition-colors"
                    />
                  ),
                }}
              >
                {note.content}
              </ReactMarkdown>
            </div>

            {isOverflowing && (
              <div className="flex justify-end mt-1">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="text-[10px] font-black text-blue-700 uppercase tracking-widest hover:text-blue-900 transition-colors focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? "Collapse -" : "Expand +"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);
      
      try {
        const response = await fetch(getApiUrl(`/member/${bioguideId}`));
        if (!response.ok) throw new Error('Failed to fetch representative details');
        const result = await response.json();
        setData(result);
        
        // Fetch data and notes after user is verified
        await Promise.all([
          fetchNotes(),
          fetchMemberConversation()
        ]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    init();

    // Sync status if deleted from sidebar
    window.addEventListener('refresh-registry', fetchMemberConversation);
    return () => window.removeEventListener('refresh-registry', fetchMemberConversation);
  }, [bioguideId]);

  const handleSelectConversation = (id: string, bId?: string) => {
    if (bId) {
      if (bId === bioguideId) {
        setConvId(id);
      } else {
        router.push(`/member/${bId}`);
      }
    } else {
      router.push(`/?session=${id}`);
    }
  };

  const handleNewChat = () => {
    router.push('/');
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  const mainContent = () => {
    if (isLoading || !user) return (
      <main className="flex-1 overflow-y-auto bg-white py-12 animate-in fade-in duration-500">
        <div className="container mx-auto px-6 max-w-7xl">
          <MemberHeaderSkeleton />
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 pb-24">
            <div className="lg:col-span-8 space-y-12">
              <section>
                <Skeleton className="w-48 h-8 mb-6 rounded-xl" />
                <div className="space-y-4">
                  <Skeleton className="w-full h-24 rounded-2xl" />
                  <Skeleton className="w-full h-24 rounded-2xl" />
                </div>
              </section>
              <section>
                <Skeleton className="w-48 h-8 mb-6 rounded-xl" />
                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                  {[1, 2, 3].map((i) => <VoteCardSkeleton key={i} />)}
                </div>
              </section>
            </div>
            <div className="lg:col-span-4 space-y-12">
              <section>
                <Skeleton className="w-48 h-8 mb-6 rounded-xl" />
                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                  {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    );

    if (error || !data) return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border border-gray-200">
          <h2 className="text-2xl font-black text-red-700 mb-4 uppercase tracking-tighter">System Error</h2>
          <p className="text-gray-800 mb-6 font-medium">{error || "Could not retrieve representative intelligence."}</p>
          <Link href="/" className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-md active:scale-95 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            Return to Terminal
          </Link>
        </div>
      </div>
    );

    const { details, bills, votes } = data;

    return (
      <main className="flex-1 overflow-y-auto bg-white py-12">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* Optimized Horizontal Hero Section - WCAG Compliant */}
          <div className="pb-8 border-b border-gray-200 bg-white">
            <div className="flex flex-col md:flex-row items-center gap-10">
              {/* Profile Image */}
              <div className="relative shrink-0">
                {details.depiction?.imageUrl ? (
                  <img 
                    src={details.depiction.imageUrl} 
                    alt={`Official portrait of ${details.directOrderName}`}
                    className="w-36 h-36 rounded-2xl border border-gray-300 shadow-md object-cover bg-gray-50"
                  />
                ) : (
                  <div className="w-36 h-36 rounded-2xl border border-gray-300 shadow-md bg-blue-50 flex items-center justify-center text-5xl font-black text-blue-700" aria-hidden="true">
                    {details.lastName?.charAt(0)}
                  </div>
                )}
              </div>

              {/* Core Info */}
              <div className="flex-1 space-y-4 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <span className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider ${
                    details.partyHistory?.[0]?.partyAbbreviation === 'R' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {details.partyHistory?.[0]?.partyName || 'Unknown Party'}
                  </span>
                  <span className="px-3 py-1 rounded bg-gray-100 border border-gray-200 text-xs font-black uppercase tracking-wider text-gray-700">
                    {details.state} {details.terms?.[0]?.district ? `District ${details.terms[0].district}` : 'Senator'}
                  </span>
                  <span className="px-3 py-1 rounded bg-green-100 border border-green-200 text-xs font-black uppercase tracking-wider text-green-800">
                    {details.terms?.[details.terms.length - 1]?.congress}th Congress
                  </span>
                </div>
                
                <h1 className="text-5xl font-black tracking-tight leading-none text-black">
                  {details.directOrderName}
                </h1>

                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start items-center text-sm font-semibold">
                    <a href={details.officialWebsiteUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:text-blue-900 underline focus:ring-2 focus:ring-blue-500 rounded px-1">
                      Official Website
                    </a>
                    <span className="text-gray-400" aria-hidden="true">|</span>
                    <span className="text-gray-700">
                      HQ: {details.addressInformation?.officeAddress || 'N/A'}
                    </span>
                    <span className="text-gray-400" aria-hidden="true">|</span>
                    <span className="text-gray-700">
                      PH: {details.addressInformation?.phoneNumber || 'N/A'}
                    </span>
                  </div>

                  <button 
                    onClick={handleTrackMember}
                    disabled={isTracked || isTracking}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 border-2 ${
                      isTracked 
                        ? 'bg-green-50 border-green-600 text-green-700 cursor-default' 
                        : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    }`}
                  >
                    {isTracking ? 'Processing...' : isTracked ? 'Added to Notebook' : 'Add to Notebook'}
                    {!isTracked && !isTracking && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>}
                    {isTracked && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 pb-24">
            {/* Left Column: Research Notebook & Voting Ledger */}
            <div className="lg:col-span-8 space-y-12">
              <section aria-labelledby="notebook-title">
                <div className="mb-6">
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 w-full">
                    <span className="w-2 h-2 bg-blue-700 rounded-full"></span>
                    <h2 id="notebook-title" className="text-xs font-black text-blue-700 uppercase tracking-[0.3em]">
                      Research Notebook
                    </h2>
                  </div>
                </div>
                {researchNotes.length > 0 ? (
                  <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-4 duration-500">
                    {researchNotes.map((note) => (
                      <ResearchNoteCard key={note.id} note={note} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-3xl p-16 text-center">
                    <p className="text-base font-bold text-gray-500 uppercase tracking-widest">Awaiting Chat Intelligence to Populate Notebook</p>
                    <p className="text-sm text-gray-500 mt-2">Ask questions in the terminal to pin modular data here</p>
                  </div>
                )}
              </section>

              <section aria-labelledby="voting-title">
                <div className="flex justify-between items-center mb-6 bg-gray-100 border border-gray-200 px-4 py-2 w-full">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-black rounded-full"></span>
                    <h2 id="voting-title" className="text-xs font-black text-black uppercase tracking-[0.3em]">
                      Voting Record
                    </h2>
                  </div>
                  <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">Official Roll Call</span>
                </div>
                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {votes.length > 0 ? votes.map((v, i) => (
                      <div key={i} className="p-8 hover:bg-gray-50/50 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">Legislation Record</span>
                            {v.type && v.number ? (
                              <Link 
                                href={`/bill/${v.congress}/${v.type?.toLowerCase()}/${v.number}`}
                                className="text-xl font-black text-blue-700 hover:text-blue-900 underline underline-offset-4 decoration-2 focus:ring-2 focus:ring-blue-500 rounded px-1"
                              >
                                {v.legislation}
                              </Link>
                            ) : v.legislationUrl ? (
                              <a href={v.legislationUrl} target="_blank" rel="noreferrer" className="text-xl font-black text-blue-700 hover:text-blue-900 underline underline-offset-4 focus:ring-2 focus:ring-blue-500 rounded px-1">
                                {v.legislation}
                              </a>
                            ) : (
                              <span className="text-xl font-black text-black">{v.legislation}</span>
                            )}
                          </div>
                          <time className="text-xs font-bold text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                            {new Date(v.date).toISOString().split('T')[0]}
                          </time>
                        </div>
                        <div className="mb-4">
                          <p className="text-sm font-black text-gray-500 uppercase tracking-tighter mb-1">Bill Title</p>
                          <p className="text-base font-bold text-black leading-tight italic">{v.legislationTitle}</p>
                        </div>
                        <p className="text-lg font-bold text-black leading-tight mb-6 group-hover:translate-x-1 transition-transform">{v.question}</p>
                        <div className="grid grid-cols-2 gap-10">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Representative Vote</span>
                            <span className={`text-2xl font-black ${v.vote === 'Yea' ? 'text-green-700' : v.vote === 'Nay' ? 'text-red-700' : 'text-gray-600'}`}>
                              {v.vote.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 border-l border-gray-200 pl-10">
                            <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Final Outcome</span>
                            <span className="text-2xl font-black text-black uppercase">{v.result}</span>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="p-16 text-gray-500 text-sm font-bold uppercase tracking-widest text-center italic">No ledger entries detected.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <section aria-labelledby="registry-title">
                <div className="mb-6">
                  <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 px-4 py-2 w-full">
                    <span className="w-2 h-2 bg-black rounded-full"></span>
                    <h2 id="registry-title" className="text-xs font-black text-black uppercase tracking-[0.3em]">
                      Sponsor Record
                    </h2>
                  </div>
                </div>
                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {bills.length > 0 ? bills.map((bill, i) => {
                      const statusText = bill.latestAction?.text || '';
                      const isPassed = /passed|became law|presented to president|signed|agreed to/i.test(statusText);
                      const isFailed = /failed|rejected|vetoed|withdrawn/i.test(statusText);
                      
                      return (
                        <div key={i} className="p-6 hover:bg-gray-50/50 transition-all group">
                          <div className="flex justify-between items-center mb-3">
                            <Link 
                              href={bill.type && bill.number ? `/bill/${bill.congress || details.terms?.[details.terms.length - 1]?.congress}/${bill.type.toLowerCase()}/${bill.number}` : '#'}
                              className="text-xs font-black text-blue-700 uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
                            >
                              {bill.type || 'N/A'}{bill.number || ''}
                            </Link>
                            <time className="text-xs font-bold text-gray-700 uppercase">
                              Introduced: {bill.introducedDate}
                            </time>
                          </div>
                          <Link 
                            href={bill.type && bill.number ? `/bill/${bill.congress || details.terms?.[details.terms.length - 1]?.congress}/${bill.type.toLowerCase()}/${bill.number}` : '#'}
                            className="text-base font-bold text-black leading-snug mb-4 block group-hover:text-blue-900 transition-colors"
                          >
                            {bill.title}
                          </Link>
                          {bill.latestAction && (
                            <div className={`p-4 rounded-xl border relative overflow-hidden ${
                              isPassed ? 'bg-green-50 border-green-100' : 
                              isFailed ? 'bg-red-50 border-red-100' : 
                              'bg-blue-50 border-blue-100'
                            }`}>
                              <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                isPassed ? 'bg-green-600' : 
                                isFailed ? 'bg-red-600' : 
                                'bg-blue-700'
                              }`}></div>
                              <span className={`text-[10px] font-black block mb-1 tracking-widest uppercase ${
                                isPassed ? 'text-green-800' : 
                                isFailed ? 'text-red-800' : 
                                'text-blue-800'
                              }`}>Status Update</span>
                              <p className={`text-sm font-bold leading-relaxed ${
                                isPassed ? 'text-green-900' : 
                                isFailed ? 'text-red-900' : 
                                'text-gray-900'
                              }`}>{bill.latestAction.text}</p>
                            </div>
                          )}
                        </div>
                      );
                    }) : (
                      <p className="p-12 text-gray-500 text-sm font-bold uppercase tracking-widest text-center italic">No active records found.</p>
                    )}
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
        {/* Left Sidebar for Research Tabs */}
        <Sidebar 
          currentId={convId} 
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
        />

        {mainContent()}
      </div>

      {/* Floating AI Terminal */}
      {data && user && (
        <Chat 
          mode="floating"
          conversationId={convId}
          onIdGenerated={setConvId}
          user={user}
          initialContext={`The user is currently viewing the profile of ${data.details.directOrderName} (Bioguide ID: ${bioguideId}). Use this Bioguide ID directly for tools if needed.`}
          onIntelligenceCaptured={captureIntel}
        />
      )}
    </div>
  );
}
