import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);

const KINDS = {
  success: { icon: CheckCircle2, color: 'var(--success)', urgent: false, duration: 3500 },
  info: { icon: Info, color: 'var(--info)', urgent: false, duration: 5000 },
  warning: { icon: AlertTriangle, color: 'var(--warning)', urgent: true, duration: 8000 },
  error: { icon: XCircle, color: 'var(--danger)', urgent: true, duration: 8000 },
};

const MAX_VISIBLE = 4;

/**
 * showToast(message, type) - type is 'success' | 'info' | 'warning' | 'error' (default 'error').
 * Errors and warnings are announced immediately (role="alert") and stay longer; success and info
 * are announced politely (role="status"). A toast pauses its timer while hovered or focused, and
 * can always be dismissed by hand, so nobody is racing a disappearing message.
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const arm = useCallback((id, type) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => dismiss(id), (KINDS[type] || KINDS.error).duration));
  }, [dismiss]);

  const pause = useCallback((id) => {
    clearTimeout(timers.current.get(id));
  }, []);

  const showToast = useCallback((message, type = 'error') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, type }]);
    arm(id, type);
  }, [arm]);

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed top-4 right-4 left-4 md:left-auto md:top-6 md:right-6 z-[100] flex flex-col gap-2 items-stretch md:items-end pointer-events-none"
      >
        {toasts.map((t) => {
          const kind = KINDS[t.type] || KINDS.error;
          const Icon = kind.icon;
          return (
            <div
              key={t.id}
              role={kind.urgent ? 'alert' : 'status'}
              onMouseEnter={() => pause(t.id)}
              onMouseLeave={() => arm(t.id, t.type)}
              onFocus={() => pause(t.id)}
              onBlur={() => arm(t.id, t.type)}
              className="surface elevated animate-toast-in pointer-events-auto flex items-start gap-3 pl-3 pr-2 py-2.5 rounded-[var(--radius-lg)] text-sm text-[var(--ink)] max-w-sm md:w-96"
            >
              <Icon size={16} aria-hidden="true" className="flex-shrink-0 mt-0.5" style={{ color: kind.color }} />
              <span className="leading-snug flex-1 py-0.5">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="flex-shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
