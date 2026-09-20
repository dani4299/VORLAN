import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { WallpaperSwatches } from './WallpaperSwatches';
import { useTheme } from '../../context/ThemeContext';
import { TabPanel, Tabs } from '../ui/Tabs';
import { IconButton } from '../ui/Button';

const MODE_TABS = [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }];

/**
 * A popover under the button that opened it, so the wallpaper behind is still visible while you
 * choose. Rendered under <body> at fixed coordinates so it can't push the page's layout around.
 * Edits whichever mode's wallpaper the Dark/Light tab has selected (defaulting to the active mode).
 * Escape or a click outside closes it, and focus returns to the button that opened it.
 */
export const WallpaperSheet = ({ anchorRef, onClose }) => {
  const { effectiveMode } = useTheme();
  const [tab, setTab] = useState(effectiveMode);
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)) });
  }, [anchorRef]);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Once the panel is placed, focus goes into it; it comes back to the opening button when the panel goes away.
  const placed = position !== null;
  useEffect(() => {
    if (!placed) return undefined;
    const anchor = anchorRef.current;
    panelRef.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onCloseRef.current();
    };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      anchor?.focus();
    };
  }, [anchorRef, placed]);

  if (!position) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Wallpaper"
      className="surface-strong elevated animate-sheet-in fixed z-[100] w-72 rounded-[var(--radius-lg)] p-4"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Wallpaper</h2>
        <IconButton label="Close wallpaper picker" onClick={onClose} className="-mr-2 -mt-1"><X size={16} aria-hidden="true" /></IconButton>
      </div>

      <Tabs idPrefix="wp" label="Wallpaper for" tabs={MODE_TABS} value={tab} onChange={setTab} className="mb-4" />

      {MODE_TABS.map((t) => (
        <TabPanel key={t.id} idPrefix="wp" id={t.id} value={tab}>
          <WallpaperSwatches mode={t.id} onUploaded={onClose} />
        </TabPanel>
      ))}
    </div>,
    document.body
  );
};
