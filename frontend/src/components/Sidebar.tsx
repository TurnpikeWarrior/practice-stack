'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  bioguide_id?: string;
  type: 'conversation';
};

type TrackedBill = {
  bill_id: string;
  bill_type: string;
  bill_number: string;
  congress: number;
  title: string;
  created_at: string;
  type: 'bill';
};

type SidebarProps = {
  currentId: string | null;
  onSelect: (id: string, bioguideId?: string) => void;
  onNewChat: () => void;
};

export default function Sidebar({ currentId, onSelect, onNewChat }: SidebarProps) {
  const router = useRouter();
  const [registryItems, setRegistryItems] = useState<(Conversation | TrackedBill)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editTitle, setEditFormTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRegistry();
  }, [currentId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const fetchRegistry = async () => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const [convRes, billsRes] = await Promise.all([
        fetch('http://localhost:8000/conversations', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch('http://localhost:8000/tracked-bills', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      const convs = convRes.ok ? await convRes.json() : [];
      const bills = billsRes.ok ? await billsRes.json() : [];

      const combined = [
        ...convs.map((c: any) => ({ ...c, type: 'conversation' })),
        ...bills.map((b: any) => ({ ...b, type: 'bill', id: b.bill_id }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRegistryItems(combined);
    } catch (error) {
      console.error('Failed to fetch registry:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async (item: Conversation | TrackedBill) => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const url = item.type === 'conversation' 
        ? `http://localhost:8000/conversations/${item.id}`
        : `http://localhost:8000/tracked-bills/${(item as TrackedBill).bill_id}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (response.ok) {
        setRegistryItems(prev => prev.filter(i => {
          if (item.type === 'conversation') return (i as Conversation).id !== item.id;
          return (i as TrackedBill).bill_id !== (item as TrackedBill).bill_id;
        }));
        if (item.type === 'conversation' && (item as Conversation).id === currentId) {
          onNewChat();
        }
        setConfirmDeleteId(null);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(`http://localhost:8000/conversations/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: editTitle })
      });
      if (response.ok) {
        setRegistryItems(prev => prev.map(i => 
          i.type === 'conversation' && i.id === id ? { ...i, title: editTitle } : i
        ));
        setEditingId(null);
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const startEditing = (e: React.MouseEvent, item: Conversation) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditFormTitle(item.title);
  };

  return (
    <nav className="w-64 h-full bg-gray-900 text-white flex flex-col border-r border-gray-800 shadow-2xl" aria-label="Strategic Registry">
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 text-white rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 outline-none"
        >
          <span className="text-lg" aria-hidden="true">+</span> New Inquiry
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-gray-800">
        <h3 className="px-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 mt-2">
          Notebook Registry
        </h3>
        <div className="space-y-1">
          {isLoading ? (
            <div className="px-4 py-2 text-xs text-gray-500 font-bold uppercase animate-pulse">Syncing archives...</div>
          ) : registryItems.length === 0 ? (
            <div className="px-4 py-2 text-xs text-gray-500 font-bold uppercase italic">No active briefings</div>
          ) : (
            registryItems.map((item) => (
              <div key={item.type === 'conversation' ? item.id : (item as TrackedBill).bill_id} className="group relative">
                {editingId === (item as any).id ? (
                  <div className="px-2 py-1">
                    <input
                      ref={editInputRef}
                      value={editTitle}
                      onChange={(e) => setEditFormTitle(e.target.value)}
                      onBlur={() => handleRename((item as any).id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename((item as any).id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full bg-gray-800 text-white text-xs px-2 py-2 rounded-lg outline-none border border-blue-500"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (item.type === 'conversation') {
                          onSelect(item.id, item.bioguide_id);
                        } else {
                          router.push(`/bill/${item.congress}/${item.bill_type.toLowerCase()}/${item.bill_number}`);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 text-xs rounded-xl truncate transition-all outline-none pr-16 ${
                        (item.type === 'conversation' && currentId === item.id)
                          ? 'bg-blue-600 text-white font-black shadow-md border-l-4 border-blue-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white font-bold'
                      }`}
                    >
                      {item.type === 'bill' && (
                        <span className="text-blue-500 font-black mr-2">{item.bill_type.toUpperCase()} {item.bill_number}</span>
                      )}
                      {item.title}
                    </button>
                    
                    {/* Hover Actions */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.type === 'conversation' && (
                        <button
                          onClick={(e) => startEditing(e, item as Conversation)}
                          className="p-1 text-gray-500 hover:text-white"
                          title="Rename briefing"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.type === 'conversation' ? item.id : (item as TrackedBill).bill_id); }}
                        className="p-1 text-gray-500 hover:text-red-500"
                        title={item.type === 'conversation' ? "Delete briefing" : "Untrack bill"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>

                    {/* Integrated Delete Confirmation Overlay */}
                    {confirmDeleteId === (item.type === 'conversation' ? item.id : (item as TrackedBill).bill_id) && (
                      <div className="absolute inset-0 bg-gray-900/95 z-10 rounded-xl flex items-center justify-between px-3 animate-in fade-in slide-in-from-right-2 duration-200">
                        <span className="text-[9px] font-black text-white uppercase tracking-tighter leading-tight max-w-[100px]">
                          {item.type === 'conversation' ? "Delete Entry?" : "Untrack Bill?"}
                        </span>
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="px-2 py-1 text-[8px] font-black uppercase text-gray-400 hover:text-white"
                          >
                            NO
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); executeDelete(item); }}
                            className="px-2 py-1 text-[8px] font-black uppercase bg-red-600 text-white rounded-md shadow-lg"
                          >
                            YES
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 text-[9px] text-gray-600 text-center font-black tracking-[0.4em] uppercase">
        COSINT STRATEGIC v1.0
      </div>
    </nav>
  );
}
