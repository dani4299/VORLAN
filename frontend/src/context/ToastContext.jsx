import React, { createContext, useContext, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 left-4 md:left-auto md:top-6 md:right-6 z-[100] flex flex-col gap-2 items-stretch md:items-end pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="glass animate-toast-in pointer-events-auto flex items-center gap-3 pl-4 pr-4 py-3.5 rounded-[20px] text-sm font-medium text-[var(--ink)] max-w-sm md:w-96"
          >
            {t.type === 'success'
              ? <CheckCircle2 size={18} className="flex-shrink-0" style={{ color: 'var(--hue-emerald)' }} />
              : <XCircle size={18} className="flex-shrink-0" style={{ color: 'var(--hue-rose)' }} />}
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
