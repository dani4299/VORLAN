import React from 'react';
import { LayoutGrid, Moon, Sun } from 'lucide-react';
import { AccountMenu } from '../components/layout/AccountMenu';
import { IconButton } from '../components/ui/Button';
import { Menu } from '../components/ui/Menu';
import { useTheme } from '../context/ThemeContext';
import { useDesktop } from './DesktopContext';

const TRIGGER = 'inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors';

export const TopBar = () => {
  const { apps, windows, focusedId, byId, open, focus, minimize, mobile } = useDesktop();
  const { effectiveMode, toggleTheme } = useTheme();

  // Admin-only tools first, then everyday apps, separated by a rule.
  const adminApps = apps.filter((a) => a.adminOnly && a.id !== 'cameras');
  const otherApps = apps.filter((a) => !adminApps.includes(a));
  const launcherItems = [
    ...adminApps.map((a) => ({ id: a.id, label: a.title, icon: a.icon, onSelect: () => open(a.id) })),
    ...(adminApps.length && otherApps.length ? [{ separator: true }] : []),
    ...otherApps.map((a) => ({ id: a.id, label: a.title, icon: a.icon, onSelect: () => open(a.id) })),
  ];

  const onWindowButton = (appId, isFocused, isMinimized) => {
    if (isMinimized || !isFocused) focus(appId);
    else minimize(appId);
  };

  return (
    <header className="h-12 flex items-center gap-2 px-3 flex-shrink-0 border-b border-[var(--surface-border)] bg-[var(--canvas-elevated)]">
      <Menu
        buttonId="desktop-launcher"
        label="Applications"
        buttonContent={<><LayoutGrid size={16} aria-hidden="true" />Apps</>}
        buttonClassName={TRIGGER}
        items={launcherItems}
      />

      <nav aria-label="Open windows" className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
        {[...windows].sort((a, b) => a.opened - b.opened).map((w) => {
          const app = byId[w.appId];
          const isFocused = focusedId === w.appId;
          return (
            <button
              key={w.appId}
              type="button"
              aria-pressed={isFocused}
              aria-label={`${app.title}${w.minimized ? ' (minimized)' : ''}`}
              onClick={() => onWindowButton(w.appId, isFocused, w.minimized)}
              className={`inline-flex items-center gap-2 h-9 px-2.5 flex-shrink-0 text-sm border-b-2 transition-colors ${isFocused ? 'border-[var(--accent)] text-[var(--ink)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}
            >
              <app.icon size={16} aria-hidden="true" />
              {!mobile && <span className={w.minimized ? 'opacity-70' : ''}>{app.title}</span>}
            </button>
          );
        })}
      </nav>

      <IconButton label={effectiveMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
        {effectiveMode === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      </IconButton>

      <AccountMenu onOpenSettings={() => open('settings')} showName={!mobile} />
    </header>
  );
};
