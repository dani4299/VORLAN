import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_MIN_WIDTH = 224; // 14rem
const GAP = 4;

/**
 * A dropdown menu button following the WAI-ARIA menu pattern.
 *   items: [{ id, label, icon?, onSelect, disabled?, tone?: 'danger' }  |  { separator: true }]
 * Focus moves into the menu when it opens. Arrow keys, Home/End and typing a letter move between
 * items; Enter/Space chooses one; Escape closes and returns focus to the button; Tab, scrolling or a
 * click outside just closes it.
 *
 * The menu is drawn under <body> at fixed coordinates next to its button, so it is never clipped by
 * a scrolling table or window it happens to sit in. It opens downward, or upward when there is no room.
 */
export const Menu = ({ label, buttonContent, buttonLabel, buttonClassName = '', items, align = 'left', buttonId }) => {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null); // { top?, bottom?, left?, right? }
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const enabledItems = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? [])];

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const roomBelow = window.innerHeight - rect.bottom;
    const vertical = menuHeight > roomBelow - GAP && rect.top > roomBelow
      ? { bottom: window.innerHeight - rect.top + GAP }
      : { top: rect.bottom + GAP };
    const horizontal = align === 'right'
      ? { right: Math.max(8, window.innerWidth - rect.right) }
      : { left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_MIN_WIDTH - 8)) };
    setPosition({ ...vertical, ...horizontal });
  }, [open, align, items.length]);

  useEffect(() => {
    if (open && position) enabledItems()[0]?.focus();
    // Focus once, when the menu first appears in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position === null]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      close();
    };
    // A scroll anywhere else moves the button out from under the menu, so it closes; scrolling the menu's own list doesn't.
    const onScroll = (e) => {
      if (!menuRef.current?.contains(e.target)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const onMenuKeyDown = (e) => {
    const list = enabledItems();
    const index = list.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = list[(index + 1) % list.length];
    else if (e.key === 'ArrowUp') next = list[(index - 1 + list.length) % list.length];
    else if (e.key === 'Home') next = list[0];
    else if (e.key === 'End') next = list[list.length - 1];
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); buttonRef.current.focus(); return; }
    else if (e.key === 'Tab') { setOpen(false); return; }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      const ordered = [...list.slice(index + 1), ...list.slice(0, index + 1)];
      next = ordered.find((el) => el.textContent.trim().toLowerCase().startsWith(ch));
    }
    if (next) { e.preventDefault(); next.focus(); }
  };

  const onButtonKeyDown = (e) => {
    if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); }
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={buttonLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className={buttonClassName}
      >
        {buttonContent}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
          className="surface-strong elevated animate-toast-in fixed z-[90] min-w-[14rem] max-h-[70vh] overflow-y-auto py-1 rounded-[var(--radius-lg)]"
        >
          {items.map((item, i) => (item.separator ? (
            <div key={`sep-${i}`} role="separator" className="my-1 border-t border-[var(--surface-border)]" />
          ) : (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => { setOpen(false); buttonRef.current?.focus(); item.onSelect(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-[var(--overlay-3)] focus:bg-[var(--overlay-3)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${item.tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--ink)]'}`}
            >
              {item.icon && <item.icon size={16} aria-hidden="true" className={`flex-shrink-0 ${item.tone === 'danger' ? '' : 'text-[var(--ink-muted)]'}`} />}
              {item.label}
            </button>
          )))}
        </div>,
        document.body
      )}
    </>
  );
};
