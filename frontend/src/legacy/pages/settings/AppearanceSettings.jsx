import React from 'react';
import { Sun, Moon, Check } from 'lucide-react';
import { useTheme, COLOR_SCHEMES } from '../../../context/ThemeContext';
import { PRESET_WALLPAPERS, SOLID_COLORS } from '../../components/dashboard/WallpaperLayer';

const Switch = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
    style={{ background: checked ? 'var(--accent)' : 'var(--overlay-4)' }}
  >
    <span
      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
      style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
    />
  </button>
);

const WallpaperPicker = ({ mode, label }) => {
  const { appearance, setWallpaperForMode } = useTheme();
  const wallpaper = appearance.wallpapers[mode];
  const isSelected = (type, value) => wallpaper?.type === type && wallpaper?.value === value;
  const presets = PRESET_WALLPAPERS.filter((p) => p.mode === mode);

  return (
    <div>
      <p className="text-xs font-medium text-[var(--ink-muted)] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {SOLID_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => setWallpaperForMode(mode, { type: 'solid', value: color.value })}
            className="w-7 h-7 rounded-full flex items-center justify-center border border-[var(--surface-border-strong)] flex-shrink-0"
            style={{ background: color.value }}
            title={color.value}
          >
            {isSelected('solid', color.value) && <Check size={12} className={color.textOn === 'dark' ? 'text-black/70' : 'text-white'} />}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => setWallpaperForMode(mode, { type: 'preset', value: preset.id })}
            className="relative h-11 rounded-lg overflow-hidden border border-[var(--surface-border)]"
            style={{ background: preset.css }}
            title={preset.label}
          >
            {isSelected('preset', preset.id) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <Check size={14} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const AppearanceSettings = () => {
  const { appearance, setAppearance, effectiveMode, setColorScheme } = useTheme();

  const setMode = (mode) => setAppearance((prev) => ({ ...prev, scheduleEnabled: false, mode }));
  const setScheduleEnabled = (scheduleEnabled) => setAppearance((prev) => ({ ...prev, scheduleEnabled }));
  const setScheduleStart = (scheduleStart) => setAppearance((prev) => ({ ...prev, scheduleStart }));
  const setScheduleEnd = (scheduleEnd) => setAppearance((prev) => ({ ...prev, scheduleEnd }));

  return (
    <div className="space-y-5">
      <div className="surface rounded-[24px] p-6 md:p-7">
        <p className="text-sm font-semibold text-[var(--ink)] mb-3">Theme</p>
        <div className="flex gap-2">
          {[{ id: 'dark', label: 'Dark', icon: Moon }, { id: 'light', label: 'Light', icon: Sun }].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium border transition-all duration-150 ${
                !appearance.scheduleEnabled && effectiveMode === opt.id
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-wash)]'
                  : 'border-[var(--surface-border)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <opt.icon size={16} /> {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="surface rounded-[24px] p-6 md:p-7">
        <p className="text-sm font-semibold text-[var(--ink)] mb-1">Accent color</p>
        <p className="text-xs text-[var(--ink-muted)] mb-3">Applies to buttons, links, and highlights everywhere.</p>
        <div className="flex flex-wrap gap-4">
          {COLOR_SCHEMES.map((s) => (
            <button key={s.id} onClick={() => setColorScheme(s.id)} className="flex flex-col items-center gap-2">
              <span
                className="w-9 h-9 rounded-full transition-transform duration-150 hover:scale-110"
                style={{
                  background: s.accent,
                  boxShadow: appearance.colorScheme === s.id ? `0 0 0 2px var(--canvas), 0 0 0 4px ${s.accent}` : 'none',
                }}
              />
              <span className="text-[11px] font-medium text-[var(--ink-muted)]">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="surface rounded-[24px] p-6 md:p-7">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-[var(--ink)]">Automatic schedule</p>
          <Switch checked={appearance.scheduleEnabled} onChange={setScheduleEnabled} />
        </div>
        <p className="text-xs text-[var(--ink-muted)] mb-3">Switch to dark automatically during set hours.</p>
        {appearance.scheduleEnabled && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">Dark starts</label>
              <input
                type="time"
                value={appearance.scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
                className="w-full bg-[var(--overlay-1)] border border-[var(--surface-border)] rounded-xl px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">Dark ends</label>
              <input
                type="time"
                value={appearance.scheduleEnd}
                onChange={(e) => setScheduleEnd(e.target.value)}
                className="w-full bg-[var(--overlay-1)] border border-[var(--surface-border)] rounded-xl px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </div>
          </div>
        )}
      </div>

      <div className="surface rounded-[24px] p-6 md:p-7 space-y-5">
        <p className="text-sm font-semibold text-[var(--ink)]">Wallpaper</p>
        <WallpaperPicker mode="dark" label="Dark mode wallpaper" />
        <WallpaperPicker mode="light" label="Light mode wallpaper" />
      </div>
    </div>
  );
};
