import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Moon, Sun } from 'lucide-react';
import { AccountMenu } from './AccountMenu';
import { IconButton } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { useTheme } from '../../context/ThemeContext';
import { appsForRole } from '../../desktop/apps';

const TRIGGER = 'inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors';

/**
 * The bar across the top of every page for someone who isn't an administrator (an administrator has
 * the desktop's own bar). Wordmark home, an Apps menu, where you are, then theme and account.
 */
export const AppBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveMode, toggleTheme } = useTheme();

  const apps = appsForRole(false).filter((a) => a.route);
  const current = apps.find((a) => location.pathname === `/dashboard/${a.route}`);

  const items = apps.map((a) => ({ id: a.id, label: a.title, icon: a.icon, onSelect: () => navigate(`/dashboard/${a.route}`) }));

  return (
    <header className="h-12 flex items-center gap-1 px-3 flex-shrink-0 border-b border-[var(--surface-border)] bg-[var(--canvas-elevated)]">
      <Link
        to="/dashboard"
        className="inline-flex items-center h-9 px-2 rounded-[var(--radius-md)] text-sm font-semibold text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors"
      >
        VORLAN
      </Link>

      <Menu
        label="Applications"
        buttonContent={<><LayoutGrid size={16} aria-hidden="true" />Apps</>}
        buttonClassName={TRIGGER}
        items={items}
      />

      {current && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 text-sm text-[var(--ink-muted)]">
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page" className="truncate text-[var(--ink)]">{current.title}</span>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        <IconButton label={effectiveMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
          {effectiveMode === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </IconButton>
        <AccountMenu onOpenSettings={() => navigate('/dashboard/settings')} />
      </div>
    </header>
  );
};
