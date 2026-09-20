import React, { useRef } from 'react';
import { Check, Upload } from 'lucide-react';
import { PRESET_WALLPAPERS, SOLID_COLORS } from './wallpapers';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';

/** The colours that suit a mode: a dark wallpaper takes light text, so the Dark tab lists the dark ones. */
const swatchesFor = (mode) => {
  const tone = mode === 'dark' ? 'light' : 'dark';
  return [
    ...SOLID_COLORS.filter((c) => c.textOn === tone).map((c) => ({ key: `solid-${c.value}`, type: 'solid', value: c.value, label: c.label, color: c.value })),
    ...PRESET_WALLPAPERS.filter((p) => p.mode === mode).map((p) => ({ key: `preset-${p.id}`, type: 'preset', value: p.id, label: p.label, color: p.value })),
  ];
};

/** Wallpaper choices for one mode (dark or light): a grid of colour swatches and an upload button. */
export const WallpaperSwatches = ({ mode, onUploaded }) => {
  const { appearance, setWallpaperForMode } = useTheme();
  const fileInputRef = useRef(null);
  const wallpaper = appearance.wallpapers[mode];
  const tone = mode === 'dark' ? 'light' : 'dark';

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setWallpaperForMode(mode, { type: 'custom', value: reader.result });
      onUploaded?.();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      <div data-wallpaper-tone={tone} role="group" aria-label={`${mode === 'dark' ? 'Dark' : 'Light'} mode wallpaper colours`} className="flex flex-wrap gap-2 mb-3">
        {swatchesFor(mode).map((s) => {
          const selected = wallpaper?.type === s.type && wallpaper?.value === s.value;
          return (
            <button
              key={s.key}
              type="button"
              aria-label={s.label}
              aria-pressed={selected}
              title={s.label}
              onClick={() => setWallpaperForMode(mode, { type: s.type, value: s.value })}
              className={`w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center border ${selected ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--surface-border-strong)]'}`}
              style={{ background: s.color }}
            >
              {selected && <Check size={14} aria-hidden="true" className="text-[var(--wp-ink)]" />}
            </button>
          );
        })}
      </div>

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUpload} className="hidden" aria-label={`Upload a ${mode} mode wallpaper image`} />
      <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
        <Upload size={14} aria-hidden="true" />{wallpaper?.type === 'custom' ? 'Replace image' : 'Upload image'}
      </Button>
    </div>
  );
};
