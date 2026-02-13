'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

type SidebarProps = {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  user: User;
  onSignOut: () => void;
};

export default function Sidebar({ currentId, onSelect, onNewChat, user, onSignOut }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, [currentId, user.id]);

  const fetchConversations = async () => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch('http://localhost:8000/conversations', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col border-r border-gray-800">
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
          {user.email?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 truncate">
          <p className="text-xs font-bold truncate">{user.email}</p>
          <button 
            onClick={onSignOut}
            className="text-[10px] text-gray-400 hover:text-red-400 transition-colors uppercase font-black"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2 transition-colors font-medium text-sm"
        >
          <span className="text-lg">+</span> New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <h3 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">
          Past Briefings
        </h3>
        <div className="space-y-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500 italic">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500 italic">No past briefings</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full text-left px-4 py-2 text-sm rounded-md truncate transition-colors ${
                  currentId === conv.id
                    ? 'bg-gray-800 text-white font-medium border-l-2 border-blue-500'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {conv.title}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 text-[10px] text-gray-600 text-center font-mono tracking-widest uppercase">
        COSINT TERMINAL v1.0
      </div>
    </div>
  );
}
