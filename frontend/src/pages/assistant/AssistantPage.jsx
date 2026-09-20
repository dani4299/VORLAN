import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import api, { authedFetch, authHeaders } from '../../lib/api';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SelectField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { useElementWidth } from '../../lib/useElementWidth';

const welcomeMessage = "Hi, I'm your VORLAN assistant. How can I help you today?";
const WIDE_FROM = 720; // px of page (or window) width at which the conversation list becomes a side column

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

const Avatar = () => (
  <span className="w-7 h-7 rounded-full bg-white border border-[var(--surface-border)] flex items-center justify-center flex-shrink-0 overflow-hidden">
    <img src="/logo.jpeg" alt="" className="w-full h-full object-contain p-[3px]" />
  </span>
);

export const AssistantPage = () => {
  const [sessions, setSessions] = useState([makeSession()]);
  const [currentSessionId, setCurrentSessionId] = useState(sessions[0].id);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [root, setRoot] = useState(null);
  const scrollRef = useRef(null);
  const wide = useElementWidth(root) >= WIDE_FROM;

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

  // Keep the newest message in view as the conversation grows or the reply streams in.
  const messageCount = messages.length;
  const lastLength = messages[messageCount - 1]?.content?.length ?? 0;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messageCount, lastLength, isTyping]);

  const handleNewChat = () => {
    const newSession = makeSession();
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const handleDeleteChat = (id) => {
    const updated = sessions.filter((s) => s.id !== id);
    if (updated.length === 0) {
      const newSession = makeSession();
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    } else {
      setSessions(updated);
      if (currentSessionId === id) setCurrentSessionId(updated[0].id);
    }
    setPendingDelete(null);
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
    } catch {
      // Non-critical - the placeholder title stays if this fails.
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
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
      const res = await authedFetch('/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch {
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

  const waitingForFirstWord = isTyping && messages[messages.length - 1]?.content === '';

  const conversations = wide ? (
    <nav aria-label="Conversations" className="w-64 flex-shrink-0 flex flex-col border-r border-[var(--surface-border)] bg-[var(--canvas-elevated)]">
      <div className="p-3">
        <Button variant="secondary" onClick={handleNewChat} className="w-full"><Plus size={16} aria-hidden="true" />New chat</Button>
      </div>
      <ul className="flex-1 overflow-y-auto p-3 pt-0 space-y-0.5">
        {sessions.map((s) => {
          const active = currentSessionId === s.id;
          return (
            <li key={s.id} className={`group flex items-center rounded-[var(--radius-md)] ${active ? 'bg-[var(--overlay-3)]' : 'hover:bg-[var(--overlay-2)]'}`}>
              <button
                type="button"
                onClick={() => setCurrentSessionId(s.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 text-left text-sm ${active ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-muted)]'}`}
              >
                <MessageSquare size={15} aria-hidden="true" className="flex-shrink-0" />
                <span className="truncate">{s.title}</span>
              </button>
              <IconButton label={`Delete conversation ${s.title}`} onClick={() => setPendingDelete(s)} className="w-8! h-8! mr-1 opacity-0 group-hover:opacity-100 focus:opacity-100">
                <Trash2 size={14} aria-hidden="true" />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </nav>
  ) : (
    <div className="flex items-end gap-2 px-4 py-3 border-b border-[var(--surface-border)] flex-shrink-0">
      <div className="flex-1 min-w-0">
        <SelectField label="Conversation" value={currentSessionId} onChange={(e) => setCurrentSessionId(Number(e.target.value))}>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </SelectField>
      </div>
      <Button variant="secondary" onClick={handleNewChat}><Plus size={16} aria-hidden="true" />New chat</Button>
    </div>
  );

  return (
    <div ref={setRoot} className={`flex h-full w-full overflow-hidden ${wide ? 'flex-row' : 'flex-col'}`}>
      {conversations}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <h1 className="px-4 md:px-8 py-3 text-sm font-medium text-[var(--ink-muted)] border-b border-[var(--surface-border)] flex-shrink-0 truncate">{currentSession?.title}</h1>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6" ref={scrollRef}>
          <div role="log" aria-live="polite" aria-label="Conversation" className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg, i) => {
              // Pending placeholder for a not-yet-started reply - rendering it here too would
              // double up with the "thinking" indicator below, which represents this exact state.
              if (msg.streaming && msg.content === '' && i === messages.length - 1) return null;
              return msg.role === 'user' ? (
                <div key={i} className="animate-message-in flex justify-end">
                  <div className="max-w-[85%] md:max-w-[70%] rounded-[var(--radius-lg)] px-4 py-2.5 text-sm md:text-base bg-[var(--accent-solid)] text-[var(--on-accent)]">
                    <span className="sr-only">You: </span>
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="animate-message-in flex gap-3">
                  <Avatar />
                  <div className="max-w-[85%] md:max-w-[70%] pt-0.5 text-sm md:text-base text-[var(--ink)]">
                    <span className="sr-only">Assistant: </span>
                    <p className="leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                      {msg.streaming && <span aria-hidden="true" className="animate-cursor-blink inline-block w-[2px] h-[1em] ml-0.5 align-middle bg-[var(--accent)]" />}
                    </p>
                  </div>
                </div>
              );
            })}
            {waitingForFirstWord && (
              <div className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
                <Avatar />
                <Spinner className="w-4 h-4" label="The assistant is thinking" />
                Thinking
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSend} className="flex-shrink-0 border-t border-[var(--surface-border)] bg-[var(--canvas)] px-4 md:px-8 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <label htmlFor="assistant-message" className="sr-only">Message the assistant</label>
              <input
                id="assistant-message"
                type="text"
                autoComplete="off"
                className="flex-1 min-w-0 bg-transparent border border-[var(--surface-border-strong)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="Ask your assistant anything"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button type="submit" disabled={!input.trim() || isTyping}><Send size={16} aria-hidden="true" />Send</Button>
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-2">The assistant can make mistakes, so check anything important.</p>
          </div>
        </form>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.title}?`}
          message="The whole conversation will be deleted. This can't be undone."
          confirmLabel="Delete"
          onConfirm={() => handleDeleteChat(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};
