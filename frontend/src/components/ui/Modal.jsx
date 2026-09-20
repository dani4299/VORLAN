import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-5xl' };

/**
 * An accessible modal dialog, rendered via portal so an ancestor's layout can never push it around.
 * - announced as a dialog (`role`, aria-modal) and named by its title (and description, if given)
 * - keyboard focus moves in on open, is trapped while open, and returns to whatever opened it
 * - Escape or a click on the backdrop closes it; the page behind can't scroll
 * Initial focus goes to the first `data-autofocus` element, else the first control that isn't the
 * close button, else the dialog itself. `size` is md (default), lg or xl.
 */
export const Modal = ({ title, description, onClose, children, className = '', role = 'dialog', size = 'md' }) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)];

    const initial = dialog.querySelector('[data-autofocus]')
      || focusables().find((el) => !el.hasAttribute('data-modal-close'))
      || dialog;
    initial.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`surface-strong elevated rounded-[var(--radius-xl)] w-full ${SIZES[size]} p-6 animate-sheet-in max-h-[90dvh] overflow-y-auto outline-none ${className}`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--ink)]">{title}</h2>
            {description && <p id={descId} className="text-sm text-[var(--ink-muted)] mt-1">{description}</p>}
          </div>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label="Close dialog"
            className="flex-shrink-0 -mt-1 -mr-1 w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};
