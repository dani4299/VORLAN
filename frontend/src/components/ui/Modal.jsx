import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** A centered, backdrop modal rendered via portal so it can never be pushed around by an ancestor's layout. */
export const Modal = ({ title, onClose, children, className = '' }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 scrim" onClick={onClose}>
      <div
        className={`glass-strong rounded-[28px] w-full max-w-md p-6 animate-sheet-in ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};
