import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { authHeaders, getUsername } from '../lib/api';

const ThemeContext = createContext(null);

export const useTheme = () => useContext(ThemeContext);

export const COLOR_SCHEMES = [
  { id: 'blue', label: 'Blue', accent: '#4c8dff' },
  { id: 'grey', label: 'Grey', accent: '#8b8f98' },
  { id: 'violet', label: 'Violet', accent: '#9c6bff' },
  { id: 'emerald', label: 'Emerald', accent: '#34d399' },
  { id: 'rose', label: 'Rose', accent: '#ff6482' },
  { id: 'amber', label: 'Amber', accent: '#ffb454' },
];

const DEFAULT_APPEARANCE = {
  mode: 'dark', // 'light' | 'dark' - the manual choice, used whenever scheduleEnabled is false
  scheduleEnabled: false,
  scheduleStart: '20:00', // dark begins
  scheduleEnd: '07:00', // dark ends, light resumes
  colorScheme: 'blue', // matches index.css's bare :root default - no [data-scheme] attr needed for it
  wallpapers: {
    dark: { type: 'solid', value: '#101114' },
    light: { type: 'solid', value: '#e4e7ec' },
  },
};

const nowHM = (date = new Date()) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** Is `now` (HH:MM) within [start, end)? Handles the overnight case where start > end (e.g. 20:00-07:00). */
const isWithinRange = (start, end, now) => {
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
};

const mergeAppearance = (saved) => ({
  ...DEFAULT_APPEARANCE,
  ...saved,
  wallpapers: { ...DEFAULT_APPEARANCE.wallpapers, ...saved?.wallpapers },
});

/** Drives light/dark mode (manual or scheduled), per-mode wallpaper, and applies data-theme to <html>. */
export const ThemeProvider = ({ children }) => {
  const username = getUsername();
  const [appearance, setAppearanceState] = useState(DEFAULT_APPEARANCE);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    api.get(`/profile/${username}`, { headers: authHeaders() })
      .then((res) => {
        const merged = mergeAppearance(res.data.appearance);
        // Migrate a pre-theming single `wallpaper` field into the dark slot, so nobody's existing pick is lost.
        if (!res.data.appearance && res.data.wallpaper) merged.wallpapers.dark = res.data.wallpaper;
        setAppearanceState(merged);
      })
      .catch((err) => console.warn("Couldn't load appearance settings", err));
  }, [username]);

  // Re-evaluate the schedule once a minute so dark mode actually flips at the scheduled time.
  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const effectiveMode = appearance.scheduleEnabled
    ? (isWithinRange(appearance.scheduleStart, appearance.scheduleEnd, nowHM()) ? 'dark' : 'light')
    : appearance.mode;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveMode);
  }, [effectiveMode]);

  useEffect(() => {
    if (appearance.colorScheme && appearance.colorScheme !== 'blue') {
      document.documentElement.setAttribute('data-scheme', appearance.colorScheme);
    } else {
      document.documentElement.removeAttribute('data-scheme');
    }
  }, [appearance.colorScheme]);

  const setAppearance = (updater) => {
    setAppearanceState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      api.post(`/profile/${username}`, { appearance: next }, { headers: authHeaders() })
        .catch((err) => console.error('Failed to sync appearance settings', err));
      return next;
    });
  };

  /** Flips the active mode and drops out of schedule mode - a manual toggle is an explicit override. */
  const toggleTheme = () => {
    setAppearance((prev) => ({ ...prev, scheduleEnabled: false, mode: effectiveMode === 'dark' ? 'light' : 'dark' }));
  };

  const wallpaper = appearance.wallpapers[effectiveMode];
  const setWallpaper = (next) => {
    setAppearance((prev) => ({ ...prev, wallpapers: { ...prev.wallpapers, [effectiveMode]: next } }));
  };
  const setWallpaperForMode = (mode, next) => {
    setAppearance((prev) => ({ ...prev, wallpapers: { ...prev.wallpapers, [mode]: next } }));
  };
  const setColorScheme = (colorScheme) => setAppearance((prev) => ({ ...prev, colorScheme }));

  return (
    <ThemeContext.Provider value={{
      appearance, setAppearance, effectiveMode, toggleTheme,
      wallpaper, setWallpaper, setWallpaperForMode, setColorScheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
