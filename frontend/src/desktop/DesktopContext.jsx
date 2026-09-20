import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getUsername, isAdmin } from '../lib/api';
import { useMediaQuery } from '../lib/useMediaQuery';
import { appById, appsForRole } from './apps';
import { focusedAppId, restoreWindows, windowsReducer } from './windowsReducer';

const DesktopContext = createContext(null);
export const useDesktop = () => useContext(DesktopContext);

const storageKey = () => `vorlan_desktop_v1:${getUsername()}`;
const DEFAULT_OPEN = ['resource-monitor'];

const loadSaved = () => {
  try { return JSON.parse(localStorage.getItem(storageKey())); } catch { return null; }
};

/**
 * Owns the desktop: which windows are open and where, the measured size of the desktop area, and
 * the actions that change them. Open windows and their positions are remembered per user in this
 * browser; the first time (or after clearing) an admin lands with the Resource Monitor open.
 * Below 768px there is no room for floating windows, so each one fills the screen instead.
 */
export const DesktopProvider = ({ children }) => {
  const apps = useMemo(() => appsForRole(isAdmin()), []);
  const byId = useMemo(() => appById(apps), [apps]);
  const desktopRef = useRef(null);
  const wide = useMediaQuery('(min-width: 768px)');
  const mobile = !wide;

  const [bounds, setBounds] = useState(() => ({ w: window.innerWidth, h: Math.max(320, window.innerHeight - 48) }));

  const [state, dispatch] = useReducer(windowsReducer, undefined, () => {
    const initialBounds = { w: window.innerWidth, h: Math.max(320, window.innerHeight - 48) };
    const restored = restoreWindows(loadSaved(), byId, initialBounds);
    if (restored) return restored;
    let seeded = { windows: [] };
    for (const appId of DEFAULT_OPEN.filter((id) => byId[id])) {
      const app = byId[appId];
      seeded = windowsReducer(seeded, { type: 'open', appId, size: app.size, minSize: app.minSize, bounds: initialBounds });
    }
    return seeded;
  });

  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: Math.floor(r.width), h: Math.floor(r.height) };
      setBounds((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    dispatch({ type: 'clampAll', bounds });
  }, [bounds]);

  useEffect(() => {
    try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch { /* storage full or blocked: the layout just isn't remembered */ }
  }, [state]);

  const open = useCallback((appId) => {
    const app = byId[appId];
    if (!app) return;
    dispatch({ type: 'open', appId, size: app.size, minSize: app.minSize, bounds });
  }, [byId, bounds]);

  const close = useCallback((appId) => {
    dispatch({ type: 'close', appId });
    // With nothing left to focus, return keyboard focus to the launcher instead of dropping it on the page.
    setTimeout(() => {
      if (!document.querySelector('[data-desktop-window]:not([hidden])')) document.getElementById('desktop-launcher')?.focus();
    }, 0);
  }, []);

  const value = useMemo(() => ({
    apps,
    byId,
    windows: state.windows,
    focusedId: focusedAppId(state.windows),
    bounds,
    mobile,
    desktopRef,
    open,
    close,
    focus: (appId) => dispatch({ type: 'focus', appId }),
    minimize: (appId) => dispatch({ type: 'minimize', appId }),
    toggleMaximize: (appId) => dispatch({ type: 'toggleMaximize', appId }),
    setGeometry: (appId, geometry) => dispatch({ type: 'setGeometry', appId, geometry, bounds }),
  }), [apps, byId, state.windows, bounds, mobile, open, close]);

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
};
