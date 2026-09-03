import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, Send, Menu, X, Trash2 } from 'lucide-react';
import api, { API_BASE, authHeaders } from '../../lib/api';
import { IconButton, Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

const welcomeMessage = "Hi, I'm your VORLAN assistant. How can I help you today?";

const makeSession = () => ({
  id: Date.now(),
  title: 'New Conversation',
  messages: [{ role: 'system', content: welcomeMessage }],
});

/** Replaces the message at `index` in the session identified by `sessionId`, leaving every other session untouched. */
const updateMessageAt = (sessions, sessionId, index, patch) => sessions.map((s) => {
  if (s.id !== sessionId) return s;
  return { ...s, messages: s.messages.map((m, i) => (i === index ? { ...m, ...patch } : m)) };
});

export const AssistantPage = () => {
  const [sessions, setSessions] = useState([makeSession()]);
  const [currentSessionId, setCurrentSessionId] = useState(sessions[0].id);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/history', { headers: authHeaders() });
        if (res.data.sessions && res.data.sessions.length > 0) {
          setSessions(res.data.sessions);
          setCurrentSessionId(res.data.sessions[0].id);
        }
      } catch (err) {
        console.warn("Couldn't load conversation history, starting fresh.", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []);

  // Skipped while streaming a response in: it updates state on every token chunk, and saving on
  // every single one of those would flood the backend with requests mid-generation.
  useEffect(() => {
    if (!loadingHistory && !isTyping && sessions.length > 0) {
      api.post('/history', { sessions }, { headers: authHeaders() }).catch((err) => console.warn('Failed to save conversation history', err));
    }
  }, [sessions, loadingHistory, isTyping]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleNewChat = () => {
    const newSession = makeSession();
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (id, e) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    if (updated.length === 0) {
      const newSession = makeSession();
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    } else {
      setSessions(updated);
      if (currentSessionId === id) setCurrentSessionId(updated[0].id);
    }
  };

  /** Asks the model to summarize the exchange into a short title, once there's enough to summarize. */
  const generateTitle = async (sessionId, priorMessages, userMessage, assistantReply) => {
    if (!assistantReply.trim()) return;
    try {
      const res = await api.post('/ai/title', {
        messages: [...priorMessages.filter((m) => m.role !== 'system' || m.content !== welcomeMessage), { role: 'user', content: userMessage }, { role: 'assistant', content: assistantReply }],
      }, { headers: authHeaders() });
      if (res.data.title) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: res.data.title } : s)));
      }
    } catch (err) {
      // Non-critical - the placeholder title stays if this fails.
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMessage = input;
    const sessionId = currentSessionId;
    const priorMessages = currentSession.messages;
    const isFirstExchange = priorMessages.length === 1 && currentSession.title === 'New Conversation';
    setInput('');
    setIsTyping(true);

    let assistantIndex;
    setSessions((prev) => prev.map((s) => {
      if (s.id !== sessionId) return s;
      const nextMessages = [...s.messages, { role: 'user', content: userMessage }, { role: 'system', content: '', streaming: true }];
      assistantIndex = nextMessages.length - 1;
      return { ...s, messages: nextMessages };
    }));

    let fullReply = '';
    try {
      const res = await fetch(`${API_BASE}/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ prompt: userMessage }),
      });
      if (!res.ok || !res.body) throw new Error('The assistant stream failed to start.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        fullReply += decoder.decode(value, { stream: true });
        setSessions((prev) => updateMessageAt(prev, sessionId, assistantIndex, { content: fullReply }));
      }
      setSessions((prev) => updateMessageAt(prev, sessionId, assistantIndex, { streaming: false }));
    } catch (err) {
      fullReply = '';
      setSessions((prev) => updateMessageAt(prev, sessionId, assistantIndex, {
        content: "I couldn't reach the assistant. Please check your connection and try again.",
        streaming: false,
      }));
    } finally {
      setIsTyping(false);
    }

    // Titled from what was actually said, once the reply is in - not just a truncation of the first message.
    if (isFirstExchange) generateTitle(sessionId, priorMessages, userMessage, fullReply);
  };

  return (
    <div className="flex h-full w-full relative overflow-hidden">
      {/* Sidebar: persistent on desktop, an overlay drawer on mobile - conversation history lives here, Claude/ChatGPT-style. */}
      <div className={`fixed md:relative inset-y-0 left-0 z-40 w-72 flex-shrink-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="glass-strong md:glass flex flex-col h-full md:!rounded-none md:!border-0 md:!border-r md:!border-[var(--surface-border)] md:!shadow-none">
          <div className="p-4 flex items-center gap-2 border-b border-[var(--surface-border)]">
            <BackButton />
            <span className="font-semibold text-[var(--ink)] flex-1">Assistant</span>
            <IconButton onClick={() => setSidebarOpen(false)} className="md:hidden w-8 h-8"><X size={16} /></IconButton>
          </div>

          <div className="p-3">
            <Button variant="secondary" size="md" onClick={handleNewChat} className="w-full">
              <Plus size={15} /> New chat
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => { setCurrentSessionId(s.id); setSidebarOpen(false); }}
                className="group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all"
                style={{ background: currentSessionId === s.id ? 'var(--overlay-3)' : 'transparent' }}
              >
                <div className="flex items-center gap-3 truncate">
                  <MessageSquare size={15} className="flex-shrink-0" style={{ color: currentSessionId === s.id ? 'var(--accent)' : 'var(--ink-faint)' }} />
                  <span className="text-sm truncate font-medium" style={{ color: currentSessionId === s.id ? 'var(--ink)' : 'var(--ink-muted)' }}>{s.title}</span>
                </div>
                <button onClick={(e) => handleDeleteChat(s.id, e)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity hover:bg-[var(--overlay-3)]" style={{ color: 'var(--hue-rose)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 scrim z-30" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col relative h-full min-w-0">
        <div className="flex items-center justify-between px-4 md:px-10 py-4 md:py-6 flex-shrink-0">
          <IconButton onClick={() => setSidebarOpen(true)} className="md:hidden">
            <Menu size={18} />
          </IconButton>
          <h1 className="text-sm font-medium text-[var(--ink-muted)] hidden md:block">{currentSession?.title}</h1>
          <div className="w-10 md:hidden" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-10" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-6 pb-40">
            {messages.map((msg, i) => (
              <div key={i} className={`animate-message-in flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'system' && (
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden shadow-md">
                    <img src="/logo.jpeg" alt="Assistant" className="w-full h-full object-contain p-[3px]" />
                  </div>
                )}
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] md:max-w-[70%] rounded-[24px] rounded-tr-lg px-5 py-3.5 text-sm md:text-base text-white shadow-lg" style={{ background: 'var(--accent)' }}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <div className="max-w-[85%] md:max-w-[70%] pt-1 text-sm md:text-base text-[var(--ink)]">
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                      {msg.streaming && <span className="animate-cursor-blink inline-block w-[3px] h-[1em] ml-0.5 align-middle rounded-full" style={{ background: 'var(--accent)' }} />}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {isTyping && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
                  <img src="/logo.jpeg" alt="Assistant" className="w-full h-full object-contain p-[3px]" />
                </div>
                <div className="flex items-center gap-1 h-9 px-1 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--ink-faint)', animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--ink-faint)', animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--ink-faint)', animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 pt-16 bg-gradient-to-t from-[var(--canvas)] via-[var(--canvas)]/90 to-transparent">
          <div className="max-w-3xl mx-auto">
            <div className="glass-strong rounded-full flex items-center gap-2 p-2 pl-6">
              <input
                type="text"
                className="flex-1 bg-transparent text-[var(--ink)] focus:outline-none placeholder:text-[var(--ink-faint)] text-sm md:text-base"
                placeholder="Ask your assistant anything…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-all flex-shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                <Send size={17} className="ml-0.5" />
              </button>
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-3 text-center">The assistant can make mistakes — double check anything important.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
