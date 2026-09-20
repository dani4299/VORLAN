import React, { Suspense, useEffect, useId, useRef } from 'react';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { AppErrorBoundary } from './AppErrorBoundary';
import { WindowProvider } from './WindowContext';
import { clampGeometry } from './windowsReducer';

const KEY_STEP = 16;

// Each handle is an invisible strip on an edge or a square on a corner. They straddle the window
// border (half outside) so the rounded corners never clip them.
const HANDLES = [
  { dir: 'n', cls: '-top-1 left-3 right-3 h-2 cursor-ns-resize' },
  { dir: 's', cls: '-bottom-1 left-3 right-3 h-2 cursor-ns-resize' },
  { dir: 'e', cls: '-right-1 top-3 bottom-3 w-2 cursor-ew-resize' },
  { dir: 'w', cls: '-left-1 top-3 bottom-3 w-2 cursor-ew-resize' },
  { dir: 'ne', cls: '-top-1 -right-1 w-4 h-4 cursor-nesw-resize' },
  { dir: 'nw', cls: '-top-1 -left-1 w-4 h-4 cursor-nwse-resize' },
  { dir: 'se', cls: '-bottom-1 -right-1 w-4 h-4 cursor-nwse-resize' },
  { dir: 'sw', cls: '-bottom-1 -left-1 w-4 h-4 cursor-nesw-resize' },
];

const WindowButton = ({ label, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors"
  >
    {children}
  </button>
);

/**
 * One desktop window. While dragging or resizing, the frame's position is written straight to the
 * DOM and committed to state once on release, so an app with live charts isn't re-rendered on every
 * pointer move.
 */
export const Window = ({ app, win, stackIndex, focused, bounds, mobile, onFocus, onMinimize, onToggleMaximize, onClose, onGeometry }) => {
  const frameRef = useRef(null);
  const titleRef = useRef(null);
  const hintId = useId();
  const locked = mobile || win.maximized; // no dragging/resizing when it fills the desktop

  // When a window becomes the focused one (opened, restored from the top bar, brought forward),
  // move keyboard focus into it - unless focus is already inside, e.g. the user just clicked a field.
  useEffect(() => {
    if (focused && !win.minimized && frameRef.current && !frameRef.current.contains(document.activeElement)) {
      (frameRef.current.querySelector('[data-autofocus]') || frameRef.current).focus({ preventScroll: true });
    }
  }, [focused, win.minimized]);

  const track = (onMove, onEnd) => {
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    const move = (ev) => onMove(ev);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.style.userSelect = prevSelect;
      onEnd();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const beginDrag = (e) => {
    if (e.button !== 0 || locked || e.target.closest('button')) return;
    const el = frameRef.current;
    const start = { px: e.clientX, py: e.clientY, x: win.x, y: win.y };
    let last = { x: win.x, y: win.y };
    track((ev) => {
      const g = clampGeometry({ ...win, x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py }, bounds);
      last = { x: g.x, y: g.y };
      el.style.left = `${g.x}px`;
      el.style.top = `${g.y}px`;
    }, () => onGeometry(last));
  };

  const beginResize = (dir) => (e) => {
    if (e.button !== 0 || locked) return;
    e.stopPropagation();
    e.preventDefault();
    const el = frameRef.current;
    const start = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h };
    let last = { x: win.x, y: win.y, w: win.w, h: win.h };
    track((ev) => {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      let { x, y, w, h } = start;
      if (dir.includes('e')) w = start.w + dx;
      if (dir.includes('s')) h = start.h + dy;
      if (dir.includes('w')) { w = start.w - dx; x = start.x + dx; }
      if (dir.includes('n')) { h = start.h - dy; y = start.y + dy; }
      if (w < app.minSize.w) { if (dir.includes('w')) x = start.x + start.w - app.minSize.w; w = app.minSize.w; }
      if (h < app.minSize.h) { if (dir.includes('n')) y = start.y + start.h - app.minSize.h; h = app.minSize.h; }
      if (y < 0) { h += y; y = 0; }
      last = { x, y, w, h };
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }, () => onGeometry(last));
  };

  const onTitleKeyDown = (e) => {
    if (e.target !== e.currentTarget || locked) return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const dir = arrows[e.key];
    if (!dir) return;
    e.preventDefault();
    if (e.shiftKey) {
      onGeometry({ w: Math.max(app.minSize.w, win.w + dir[0] * KEY_STEP), h: Math.max(app.minSize.h, win.h + dir[1] * KEY_STEP) });
    } else {
      onGeometry({ x: win.x + dir[0] * KEY_STEP, y: win.y + dir[1] * KEY_STEP });
    }
  };

  const style = locked
    ? { inset: 0, zIndex: stackIndex + 1 }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: stackIndex + 1 };
  if (win.minimized) style.display = 'none';

  return (
    <div
      ref={frameRef}
      data-desktop-window={app.id}
      role="dialog"
      aria-label={app.title}
      hidden={win.minimized}
      tabIndex={-1}
      onPointerDownCapture={() => { if (!focused) onFocus(); }}
      className={`absolute outline-none surface-strong ${focused ? 'elevated' : ''} ${locked ? '' : 'rounded-[var(--radius-xl)]'}`}
      style={{ ...style, borderColor: focused ? 'var(--ink-faint)' : undefined }}
    >
      <div className={`h-full flex flex-col overflow-hidden ${locked ? '' : 'rounded-[var(--radius-xl)]'}`}>
        <div
          ref={titleRef}
          role="group"
          tabIndex={0}
          aria-label={`${app.title} window controls`}
          aria-describedby={locked ? undefined : hintId}
          onPointerDown={beginDrag}
          onDoubleClick={mobile ? undefined : onToggleMaximize}
          onKeyDown={onTitleKeyDown}
          className="flex items-center gap-2 h-9 pl-3 pr-1.5 flex-shrink-0 select-none border-b border-[var(--surface-border)] bg-[var(--canvas-elevated)] focus-visible:outline-offset-[-2px]"
        >
          <app.icon size={16} aria-hidden="true" className={focused ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'} />
          <span className={`text-sm font-medium truncate ${focused ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}>{app.title}</span>
          {!locked && <span id={hintId} className="sr-only">Use the arrow keys to move this window, and shift plus the arrow keys to resize it.</span>}
          <div className="ml-auto flex items-center gap-0.5">
            <WindowButton label={`Minimize ${app.title}`} onClick={onMinimize}><Minus size={16} aria-hidden="true" /></WindowButton>
            {!mobile && (
              <WindowButton label={`${win.maximized ? 'Restore' : 'Maximize'} ${app.title}`} onClick={onToggleMaximize}>
                {win.maximized ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
              </WindowButton>
            )}
            <WindowButton label={`Close ${app.title}`} onClick={onClose}><X size={16} aria-hidden="true" /></WindowButton>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-[var(--canvas)]">
          <div className="h-full">
            <AppErrorBoundary title={app.title}>
              <WindowProvider value={{ appId: app.id, close: onClose }}>
                <Suspense fallback={<div className="h-full flex items-center justify-center"><Spinner label={`Loading ${app.title}`} /></div>}>
                  <app.Component />
                </Suspense>
              </WindowProvider>
            </AppErrorBoundary>
          </div>
        </div>
      </div>

      {!locked && HANDLES.map((h) => (
        <div key={h.dir} aria-hidden="true" onPointerDown={beginResize(h.dir)} className={`absolute ${h.cls}`} />
      ))}
    </div>
  );
};
