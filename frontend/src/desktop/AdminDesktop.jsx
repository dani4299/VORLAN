import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DesktopProvider, useDesktop } from './DesktopContext';
import { TopBar } from './TopBar';
import { Window } from './Window';

const Desktop = () => {
  const { apps, windows, byId, focusedId, bounds, mobile, desktopRef, open, close, focus, minimize, toggleMaximize, setGeometry } = useDesktop();
  const location = useLocation();
  const navigate = useNavigate();

  // Old deep links (/dashboard/files, ...) redirect here with { open: appId }; open it, then clear the state.
  useEffect(() => {
    const appId = location.state?.open;
    if (appId) {
      open(appId);
      navigate('.', { replace: true, state: null });
    }
  }, [location.state, open, navigate]);

  return (
    <main ref={desktopRef} aria-label="Desktop" className="relative flex-1 min-h-0 overflow-hidden">
      <ul
        aria-label="Application shortcuts"
        className="absolute left-3 right-3 top-3 bottom-3 overflow-y-auto content-start grid grid-cols-3 gap-1 md:right-auto md:overflow-visible md:flex md:flex-col md:flex-wrap md:content-start"
      >
        {apps.map((app) => (
          <li key={app.id} className="md:w-24">
            <button
              type="button"
              onClick={() => open(app.id)}
              className="w-full flex flex-col items-center gap-1.5 px-1 py-2 rounded-[var(--radius-md)] text-xs text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors"
            >
              <app.icon size={20} aria-hidden="true" className="text-[var(--ink-muted)]" />
              <span className="text-center leading-tight">{app.title}</span>
            </button>
          </li>
        ))}
      </ul>

      {windows.map((win, index) => (
        <Window
          key={win.appId}
          app={byId[win.appId]}
          win={win}
          stackIndex={index}
          focused={focusedId === win.appId}
          bounds={bounds}
          mobile={mobile}
          onFocus={() => focus(win.appId)}
          onMinimize={() => minimize(win.appId)}
          onToggleMaximize={() => toggleMaximize(win.appId)}
          onClose={() => close(win.appId)}
          onGeometry={(geometry) => setGeometry(win.appId, geometry)}
        />
      ))}
    </main>
  );
};

/** The administrator's home: a plain desktop of windows. No clock, no widgets, no wallpaper. */
export const AdminDesktop = () => (
  <DesktopProvider>
    <div className="h-full flex flex-col bg-[var(--canvas)]">
      <TopBar />
      <Desktop />
    </div>
  </DesktopProvider>
);
