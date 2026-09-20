// Window manager state, as a pure reducer so it can be tested without a browser.
//
// state.windows is ordered bottom -> top, so an array position IS the stacking order and "raise a
// window" is just "move it to the end". One window per app: opening an app that is already open
// brings it forward instead of creating a second copy.

export const TITLE_BAR_HEIGHT = 36;
export const MIN_VISIBLE = 120; // how much of a window must stay on screen so it can always be grabbed
const CASCADE_STEP = 28;
const CASCADE_STEPS = 8;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Keeps a window reachable: its title bar can't be dragged fully off any edge. */
export const clampGeometry = (g, bounds) => ({
  ...g,
  x: clamp(g.x, MIN_VISIBLE - g.w, Math.max(MIN_VISIBLE - g.w, bounds.w - MIN_VISIBLE)),
  y: clamp(g.y, 0, Math.max(0, bounds.h - TITLE_BAR_HEIGHT)),
});

const withoutWindow = (windows, appId) => windows.filter((w) => w.appId !== appId);
const raise = (windows, appId) => {
  const win = windows.find((w) => w.appId === appId);
  return win ? [...withoutWindow(windows, appId), win] : windows;
};

/** The window that has keyboard focus: the topmost one that isn't minimized. */
export const focusedAppId = (windows) => {
  for (let i = windows.length - 1; i >= 0; i--) if (!windows[i].minimized) return windows[i].appId;
  return null;
};

const initialGeometry = (count, size, minSize, bounds) => {
  const w = clamp(size.w, minSize.w, Math.max(minSize.w, bounds.w - 32));
  const h = clamp(size.h, minSize.h, Math.max(minSize.h, bounds.h - 32));
  const step = (count % CASCADE_STEPS) * CASCADE_STEP;
  // A new window opens fully on the desktop whenever it fits: the cascade only moves it as far as
  // there is room, so its bottom edge and scrollbar are never hidden below the screen.
  const x = Math.min(24 + step, Math.max(0, bounds.w - w));
  const y = Math.min(16 + step, Math.max(0, bounds.h - h));
  return clampGeometry({ x, y, w, h }, bounds);
};

export const windowsReducer = (state, action) => {
  switch (action.type) {
    case 'open': {
      const existing = state.windows.find((w) => w.appId === action.appId);
      if (existing) {
        return { windows: raise(state.windows.map((w) => (w.appId === action.appId ? { ...w, minimized: false } : w)), action.appId) };
      }
      const geometry = initialGeometry(state.windows.length, action.size, action.minSize, action.bounds);
      // `opened` never changes, so the top bar can list windows in a steady order while the array
      // order (which is the stacking order) shuffles as windows are raised.
      const opened = state.windows.reduce((max, w) => Math.max(max, w.opened), -1) + 1;
      return { windows: [...state.windows, { appId: action.appId, ...geometry, minimized: false, maximized: false, opened }] };
    }
    case 'close':
      return { windows: withoutWindow(state.windows, action.appId) };
    case 'focus': {
      if (!state.windows.some((w) => w.appId === action.appId)) return state;
      return { windows: raise(state.windows.map((w) => (w.appId === action.appId ? { ...w, minimized: false } : w)), action.appId) };
    }
    case 'minimize':
      return { windows: state.windows.map((w) => (w.appId === action.appId ? { ...w, minimized: true } : w)) };
    case 'toggleMaximize':
      return { windows: raise(state.windows.map((w) => (w.appId === action.appId ? { ...w, maximized: !w.maximized, minimized: false } : w)), action.appId) };
    case 'setGeometry':
      return { windows: state.windows.map((w) => (w.appId === action.appId ? { ...w, ...clampGeometry({ ...w, ...action.geometry }, action.bounds) } : w)) };
    case 'clampAll':
      return { windows: state.windows.map((w) => ({ ...w, ...clampGeometry(w, action.bounds) })) };
    default:
      return state;
  }
};

// ---- persistence ----------------------------------------------------------------------------

const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);

/** Rebuilds saved windows, dropping apps that no longer exist (or that this role can't open) and repairing bad numbers. */
export const restoreWindows = (saved, appById, bounds) => {
  if (!saved || !Array.isArray(saved.windows)) return null;
  const windows = [];
  for (const w of saved.windows) {
    const app = appById[w?.appId];
    if (!app || windows.some((x) => x.appId === w.appId)) continue;
    const geometry = clampGeometry({
      x: finite(w.x, 24), y: finite(w.y, 16),
      w: Math.max(app.minSize.w, finite(w.w, app.size.w)), h: Math.max(app.minSize.h, finite(w.h, app.size.h)),
    }, bounds);
    windows.push({ appId: w.appId, ...geometry, minimized: !!w.minimized, maximized: !!w.maximized, opened: finite(w.opened, windows.length) });
  }
  return { windows };
};
