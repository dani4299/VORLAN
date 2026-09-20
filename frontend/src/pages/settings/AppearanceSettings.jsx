import React from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { useTheme, COLOR_SCHEMES } from '../../context/ThemeContext';
import { Section } from '../../components/layout/WindowLayout';
import { WallpaperSwatches } from '../../components/dashboard/WallpaperSwatches';
import { TextField, Switch } from '../../components/ui/Field';

const MODES = [{ id: 'dark', label: 'Dark', icon: Moon }, { id: 'light', label: 'Light', icon: Sun }];

export const AppearanceSettings = () => {
  const { appearance, setAppearance, effectiveMode, setColorScheme } = useTheme();

  const setMode = (mode) => setAppearance((prev) => ({ ...prev, scheduleEnabled: false, mode }));
  const setScheduleEnabled = (scheduleEnabled) => setAppearance((prev) => ({ ...prev, scheduleEnabled }));
  const setScheduleStart = (scheduleStart) => setAppearance((prev) => ({ ...prev, scheduleStart }));
  const setScheduleEnd = (scheduleEnd) => setAppearance((prev) => ({ ...prev, scheduleEnd }));

  return (
    <div className="divide-y divide-[var(--surface-border)]">
      <Section title="Theme">
        <div role="radiogroup" aria-label="Theme" className="flex gap-2 max-w-xs">
          {MODES.map((opt) => {
            const selected = !appearance.scheduleEnabled && effectiveMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(opt.id)}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-[var(--radius-md)] text-sm font-medium border transition-colors ${
                  selected
                    ? 'border-[var(--accent)] ring-1 ring-[var(--accent)] text-[var(--ink)]'
                    : 'border-[var(--surface-border-strong)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-2)]'
                }`}
              >
                <opt.icon size={16} aria-hidden="true" />{opt.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Accent colour" description="Used for buttons, links and highlights everywhere.">
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-3">
          {COLOR_SCHEMES.map((s) => {
            const selected = appearance.colorScheme === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setColorScheme(s.id)}
                className="flex flex-col items-center gap-1.5 text-xs text-[var(--ink-muted)]"
              >
                <span
                  className={`w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center border ${selected ? 'border-[var(--ink)] ring-1 ring-[var(--ink)]' : 'border-[var(--surface-border-strong)]'}`}
                  style={{ background: s.accent }}
                >
                  {selected && <Check size={16} aria-hidden="true" className="text-[var(--on-accent)]" />}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Automatic schedule" description="Switch to dark automatically during set hours.">
        <Switch label="Follow a schedule" checked={appearance.scheduleEnabled} onChange={setScheduleEnabled} />
        {appearance.scheduleEnabled && (
          <div className="flex gap-3 mt-4 max-w-sm">
            <div className="flex-1"><TextField label="Dark starts" type="time" value={appearance.scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} /></div>
            <div className="flex-1"><TextField label="Dark ends" type="time" value={appearance.scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} /></div>
          </div>
        )}
      </Section>

      <Section title="Wallpaper" description="Each mode has its own wallpaper. It shows behind your home page.">
        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-medium text-[var(--ink)] mb-2">Dark mode</h4>
            <WallpaperSwatches mode="dark" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[var(--ink)] mb-2">Light mode</h4>
            <WallpaperSwatches mode="light" />
          </div>
        </div>
      </Section>
    </div>
  );
};
