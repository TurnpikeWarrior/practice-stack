'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

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
  onIntelligenceCaptured?: (intel: {title: string, content: string}) => void;
};

export default function Chat({ 
  conversationId, 
  onIdGenerated, 
  user, 
  mode = 'centered', 
  initialContext,
  onIntelligenceCaptured 
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(mode === 'centered');
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [actionTrigger, setActionTrigger] = useState<{type: 'member' | 'bill', name: string, id: string, congress?: string, billType?: string, billNumber?: string} | null>(null);
  const isStreamingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Tooltip logic
  useEffect(() => {
    if (mode === 'floating' && !isOpen) {
      const acknowledged = localStorage.getItem('chatbot_acknowledged');
      if (!acknowledged) {
        setShowTooltip(true);
      }
    }
  }, [mode, isOpen]);

  const dismissTooltip = () => {
    setShowTooltip(false);
    localStorage.setItem('chatbot_acknowledged', 'true');
  };

  const openChat = () => {
    setIsOpen(true);
    dismissTooltip();
  };

  // Periodic health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:8000/health');
        setIsDisconnected(!response.ok);
      } catch (err) {
        setIsDisconnected(true);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

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
        // If input is focused, only toggle if it's empty (so user can still type / if they meant to)
        const isInputFocused = document.activeElement === inputRef.current;
        const isInputEmpty = inputRef.current?.value === '';

        if (e.key === '/') {
          if (!isInputFocused || (isInputFocused && isInputEmpty)) {
            e.preventDefault();
            setIsOpen(prev => {
              const newState = !prev;
              if (newState) {
                setTimeout(() => inputRef.current?.focus(), 100);
              }
              return newState;
            });
          }
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

  // Load messages when conversationId changes, but NOT while streaming
  useEffect(() => {
    if (conversationId && !isStreamingRef.current) {
      loadMessages(conversationId);
    } else if (!conversationId && !isStreamingRef.current) {
      setMessages([]);
    }
  }, [conversationId]);

  const handleActionResponse = async (accept: boolean) => {
    if (!actionTrigger) return;
    
    if (accept) {
      if (actionTrigger.type === 'member') {
        // Create or get the member conversation
        try {
          const { data: { session } } = await createClient().auth.getSession();
          const response = await fetch(`http://localhost:8000/conversations/member/${actionTrigger.id}?name=${encodeURIComponent(actionTrigger.name)}`, {
            headers: { 'Authorization': `Bearer ${session?.access_token}` }
          });
          if (response.ok) {
            router.push(`/member/${actionTrigger.id}`);
          }
        } catch (err) {
          console.error("Failed to navigate:", err);
        }
      } else if (actionTrigger.type === 'bill') {
        router.push(`/bill/${actionTrigger.congress}/${actionTrigger.billType}/${actionTrigger.billNumber}`);
      }
    }
    
    setActionTrigger(null);
  };

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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      isStreamingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'human', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    isStreamingRef.current = true;
    abortControllerRef.current = new AbortController();

    try {
      const { data: { session } } = await createClient().auth.getSession();
      
      if (!session) throw new Error('No active session found. Please sign in again.');

      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        signal: abortControllerRef.current.signal,
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

      // Get the conversation ID from headers if it was newly generated
      const generatedId = response.headers.get('X-Conversation-Id');
      if (generatedId && generatedId !== conversationId) {
        onIdGenerated(generatedId);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let assistantContent = '';
      
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      const processedPackets = new Set<string>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        // CHECK FOR INTEL PACKETS: Format: [INTEL_PACKET: Title | Content |END_PACKET]
        // We use a unique terminator to allow brackets (links) inside the content
        const allMatches = Array.from(assistantContent.matchAll(/\[INTEL_PACKET:\s*([^|]+)\|\s*([\s\S]*?)\|END_PACKET\]/g));
        
        for (const match of allMatches) {
          const fullTag = match[0];
          if (!processedPackets.has(fullTag) && onIntelligenceCaptured) {
            processedPackets.add(fullTag);
            onIntelligenceCaptured({
              title: match[1].trim(),
              content: match[2].trim()
            });
          }
        }

        // CHECK FOR ACTION TRIGGERS: Format: [CREATE_PAGE_ACTION: Name | ID]
        const memberMatch = assistantContent.match(/\[CREATE_PAGE_ACTION:\s*([^|]+)\|\s*([^\]]+)\]/);
        if (memberMatch) {
          setActionTrigger({
            type: 'member',
            name: memberMatch[1].trim(),
            id: memberMatch[2].trim()
          });
        }

        // CHECK FOR BILL ACTION TRIGGERS: Format: [RESEARCH_BILL: Congress | Type | Number]
        const billMatch = assistantContent.match(/\[RESEARCH_BILL:\s*(\d+)\s*\|\s*([^|]+)\|\s*([^\]]+)\]/);
        if (billMatch) {
          const bType = billMatch[2].trim().toLowerCase();
          const bNum = billMatch[3].trim();
          setActionTrigger({
            type: 'bill',
            name: `${bType.toUpperCase()} ${bNum}`,
            id: `${billMatch[1]}-${bType}-${bNum}`,
            congress: billMatch[1].trim(),
            billType: bType,
            billNumber: bNum
          });
        }

        // Hide any intel tags and action tags from the UI chat bubble
        const cleanedContent = assistantContent
          .replace(/\[INTEL_PACKET:[\s\S]*?\|END_PACKET\]/g, '')
          .replace(/\[CREATE_PAGE_ACTION:[^\]]+\]/g, '')
          .replace(/\[RESEARCH_BILL:[^\]]+\]/g, '')
          .trim();
        
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: cleanedContent,
          };
          return newMessages;
        });
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: `Sorry, I encountered an error: ${error.message}.` 
        },
      ]);
    } finally {
      setIsLoading(false);
      isStreamingRef.current = false;
    }
  };

  if (mode === 'floating' && !isOpen) {
    return (
      <div className="fixed bottom-8 right-8 z-[60] flex flex-col items-end gap-4">
        {showTooltip && (
          <div className="bg-white border-2 border-blue-600 p-5 rounded-2xl shadow-2xl max-w-[240px] animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
            <button 
              onClick={dismissTooltip}
              className="absolute -top-2 -right-2 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-[10px] font-black hover:bg-gray-800 cursor-pointer shadow-md"
              aria-label="Dismiss tip"
            >
              ✕
            </button>
            <p className="text-sm font-bold text-black leading-relaxed">
              Hello! Need help researching? I'm here to help you stay informed!
            </p>
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r-2 border-b-2 border-blue-600 rotate-45"></div>
          </div>
        )}
        <button
          onClick={openChat}
          className="w-16 h-16 bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-800 transition-all hover:scale-110 group focus:ring-4 focus:ring-blue-300 outline-none cursor-pointer overflow-hidden animate-gentle-float"
          title="Activate AI Terminal (Press /)"
          aria-label="Open AI Intelligence Terminal"
        >
          <img 
            src="/assets/chatbot-icon.png" 
            alt="COSINT Chatbot" 
            className="w-full h-full object-cover"
          />
        </button>
      </div>
    );
  }

  const containerClasses = mode === 'centered'
    ? "flex flex-col h-[450px] w-full max-w-lg bg-white rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.15)] border-2 border-gray-100 overflow-hidden transition-all duration-500 animate-in fade-in zoom-in slide-in-from-bottom-4"
    : "fixed bottom-8 right-8 flex flex-col h-[550px] w-[350px] bg-white rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.2)] border-2 border-gray-100 overflow-hidden z-[60] transition-all duration-300 animate-in fade-in slide-in-from-bottom-8";

  return (
    <div className={containerClasses} role="region" aria-label="AI Intelligence Terminal">
      <div className="bg-blue-700 py-3.5 px-5 text-white flex justify-between items-center shadow-lg relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-md ${
            isDisconnected 
              ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
              : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]'
          }`}></div>
          <span className="font-black uppercase tracking-[0.2em] text-[12px]">COSINT Query Link</span>
        </div>
        {mode === 'floating' && (
          <button 
            onClick={() => setIsOpen(false)} 
            className="text-white/80 hover:text-white hover:rotate-90 transition-all duration-300 outline-none p-1 cursor-pointer"
            aria-label="Minimize terminal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white scrollbar-thin scrollbar-thumb-gray-200">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
            <div className="text-5xl font-black text-blue-700">?</div>
            <p className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Encrypted Terminal Ready</p>
          </div>
        )}
        {/* Only display the last 2 interactions (last 4 messages total) */}
        {messages.slice(-4).map((m, i) => (
          <div key={i} className={`flex ${m.role === 'human' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[90%] p-4 rounded-3xl ${
              m.role === 'human' 
                ? 'bg-blue-700 text-white rounded-tr-none shadow-xl border border-blue-600' 
                : 'bg-gray-50 border border-gray-200 text-black rounded-tl-none shadow-sm'
            }`}>
              <div className={`text-sm prose prose-sm max-w-none break-words ${
                m.role === 'human' 
                  ? 'prose-invert text-white selection:bg-blue-400 font-medium' 
                  : 'text-gray-900 prose-headings:text-black prose-strong:text-black font-semibold'
              }`}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, ...props }) => {
                      const isInternal = props.href?.startsWith('/');
                      const classes = m.role === 'human' 
                        ? 'text-blue-100 underline decoration-2 underline-offset-4 font-bold' 
                        : 'text-blue-700 underline decoration-2 underline-offset-4 font-black hover:text-blue-900 cursor-pointer';
                      
                      if (isInternal) return <Link href={props.href || '#'} className={classes} onClick={() => mode === 'floating' && setIsOpen(false)}>{props.children}</Link>;
                      return <a {...props} target="_blank" rel="noopener noreferrer" className={classes}/>;
                    },
                    p: ({ node, ...props }) => <p {...props} className="mb-3 last:mb-0 leading-relaxed" />,
                    img: ({ node, ...props }) => <img {...props} className="max-w-full h-auto rounded-2xl my-4 shadow-2xl border-2 border-white" />,
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
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-3xl rounded-tl-none shadow-sm flex items-center gap-3">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest">Processing Data</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        
        {/* Action Trigger UI */}
        {actionTrigger && !isLoading && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-[90%] bg-blue-50 border border-blue-100 rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <p className="text-sm font-black text-black uppercase tracking-widest leading-none">
                {actionTrigger.type === 'member' ? 'MEMBER' : 'BILL'} PROTOCOL REQUIRED
              </p>
            </div>
            <p className="text-sm text-gray-700 font-medium leading-relaxed">
              Would you like to {actionTrigger.type === 'member' ? 'initialize a new' : 'open the'} <span className="font-black text-blue-700 underline">COSINT Intelligence Page</span> for <span className="font-black text-black underline decoration-blue-600 underline-offset-4">{actionTrigger.name}</span>?
            </p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => handleActionResponse(false)}
                className="px-4 py-2 text-[10px] font-black uppercase text-gray-500 hover:text-black transition-colors outline-none cursor-pointer"
              >
                Negative
              </button>
              <button 
                onClick={() => handleActionResponse(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-blue-700 active:scale-95 transition-all outline-none cursor-pointer"
              >
                Execute Analysis
              </button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-5 border-t border-gray-100 bg-white flex gap-3 relative z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "AI is processing..." : "How can I help you research today?"}
          className="flex-1 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm text-black placeholder:text-gray-500 focus:outline-none focus:border-blue-600 focus:ring-0 transition-all font-medium"
          disabled={isLoading}
          aria-label="Intelligence query input"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={handleStop}
            className="bg-red-50 text-red-600 border border-red-100 w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-red-100 transition-all shadow-sm active:scale-90 outline-none"
            aria-label="Stop AI generation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-blue-700 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-blue-800 disabled:opacity-50 transition-all shadow-xl active:scale-90 outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Submit query"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
          </button>
        )}
      </form>
    </div>
  );
}
