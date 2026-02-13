'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

type Message = {
  role: 'human' | 'assistant';
  content: string;
};

type ChatProps = {
  conversationId: string | null;
  onIdGenerated: (id: string) => void;
  user: User;
  mode?: 'centered' | 'floating';
  initialContext?: string;
};

export default function Chat({ conversationId, onIdGenerated, user, mode = 'centered', initialContext }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(mode === 'centered');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Slash and Escape key activation for floating mode
  useEffect(() => {
    if (mode === 'floating') {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Toggle with /
        if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsOpen(prev => {
            const newState = !prev;
            if (newState) {
              setTimeout(() => inputRef.current?.focus(), 100);
            }
            return newState;
          });
        }
        // Close with Escape
        if (e.key === 'Escape' && isOpen) {
          setIsOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [mode, isOpen]);

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadMessages = async (id: string) => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const response = await fetch(`http://localhost:8000/conversations/${id}/messages`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'human', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await createClient().auth.getSession();
      
      if (!session) throw new Error('No active session found. Please sign in again.');

      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: input,
          conversation_id: conversationId,
          initial_context: initialContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const generatedId = response.headers.get('X-Conversation-Id');
      if (generatedId && generatedId !== conversationId) {
        onIdGenerated(generatedId);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let assistantContent = '';
      
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: assistantContent,
          };
          return newMessages;
        });
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, I encountered an error: ${error.message}.` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'floating' && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110 group z-[60]"
        title="Activate AI (Press /)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-1.9a10.5 10.5 0 1 1 3.8 3.8Z"/></svg>
        <span className="absolute -top-2 -right-2 bg-black text-[10px] font-black px-1.5 py-0.5 rounded border border-white">/</span>
      </button>
    );
  }

  const containerClasses = mode === 'centered'
    ? "flex flex-col h-[500px] w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-500 animate-in fade-in zoom-in slide-in-from-bottom-4"
    : "fixed bottom-8 right-8 flex flex-col h-[600px] w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[60] transition-all duration-300 animate-in fade-in slide-in-from-bottom-8";

  return (
    <div className={containerClasses}>
      <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="font-black uppercase tracking-widest text-xs">Intelligence Link</span>
        </div>
        {mode === 'floating' && (
          <button onClick={() => setIsOpen(false)} className="text-white hover:opacity-70 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-200">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40">
            <div className="text-4xl font-black text-blue-600">?</div>
            <p className="text-xs font-bold text-black uppercase tracking-tighter">Secure Terminal Ready</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'human' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl ${
              m.role === 'human' ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' : 'bg-white border border-gray-200 text-black rounded-tl-none shadow-sm'
            }`}>
              <div className={`text-sm prose prose-sm max-w-none break-words ${m.role === 'human' ? 'prose-invert text-white' : 'text-black prose-headings:text-black prose-strong:text-black'}`}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, ...props }) => {
                      const isInternal = props.href?.startsWith('/');
                      const classes = m.role === 'human' ? 'text-blue-100 underline' : 'text-blue-600 underline font-medium hover:text-blue-800';
                      if (isInternal) return <Link href={props.href || '#'} className={classes} onClick={() => mode === 'floating' && setIsOpen(false)}>{props.children}</Link>;
                      return <a {...props} target="_blank" rel="noopener noreferrer" className={classes}/>;
                    },
                    p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0 leading-snug" />,
                    img: ({ node, ...props }) => <img {...props} className="max-w-full h-auto rounded-lg my-2 shadow-md border" />,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t bg-white flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Lookup representative or address..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
        </button>
      </form>
    </div>
  );
}
