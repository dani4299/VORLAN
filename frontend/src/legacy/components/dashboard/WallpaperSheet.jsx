import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Upload, X, Moon, Sun } from 'lucide-react';
import { PRESET_WALLPAPERS, SOLID_COLORS } from './WallpaperLayer';
import { useTheme } from '../../../context/ThemeContext';

/**
 * A floating popover rendered via portal directly under <body> and positioned with
 * `fixed` coordinates computed from the trigger button — it can never push the
 * page's own layout around, unlike an absolutely-positioned in-flow sibling.
 *
 * Edits whichever mode's wallpaper the Dark/Light tab has selected (defaulting to
 * whichever mode is currently active), independent of the picker's own trigger.
 */
export const WallpaperSheet = ({ anchorRef, onClose }) => {
  const { effectiveMode, appearance, setWallpaperForMode } = useTheme();
  const [tab, setTab] = useState(effectiveMode);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  const wallpaper = appearance.wallpapers[tab];

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, left: rect.left });
  }, [anchorRef]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setWallpaperForMode(tab, { type: 'custom', value: reader.result });
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const isSelected = (type, value) => wallpaper?.type === type && wallpaper?.value === value;
  const presetsForTab = PRESET_WALLPAPERS.filter((p) => p.mode === tab);

  if (!position) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="surface-strong animate-sheet-in fixed z-[100] w-72 rounded-[24px] p-5"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-[var(--ink)]">Wallpaper</span>
        <button onClick={onClose} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex p-1 rounded-full chip mb-4">
        {[{ id: 'dark', label: 'Dark', icon: Moon }, { id: 'light', label: 'Light', icon: Sun }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${tab === t.id ? 'bg-[var(--accent-solid)] text-[var(--on-accent)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-[var(--ink-muted)] mb-2">Solid colors</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {SOLID_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => setWallpaperForMode(tab, { type: 'solid', value: color.value })}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-white/15 flex-shrink-0"
            style={{ background: color.value }}
            title={color.value}
          >
            {isSelected('solid', color.value) && <Check size={14} className={color.textOn === 'dark' ? 'text-black/70' : 'text-white'} />}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-[var(--ink-muted)] mb-2">Preloaded</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {presetsForTab.map((preset) => (
          <button
            key={preset.id}
            onClick={() => setWallpaperForMode(tab, { type: 'preset', value: preset.id })}
            className="relative h-14 rounded-xl overflow-hidden border border-white/10"
            style={{ background: preset.css }}
            title={preset.label}
          >
            {isSelected('preset', preset.id) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <Check size={16} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUpload} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold surface text-[var(--ink)] hover:brightness-125 active:scale-[0.97] transition-all duration-150"
      >
        <Upload size={14} /> Upload image
      </button>
    </div>,
    document.body
  );
};
