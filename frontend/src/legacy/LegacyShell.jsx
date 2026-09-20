import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './legacy.css';
import { AmbientBackground } from './components/ui/AmbientBackground';
import { Spinner } from '../components/ui/Spinner';
import { ProfileProvider } from '../context/ProfileContext';
import { ThemeProvider } from '../context/ThemeContext';
import { HomePage } from './pages/dashboard/HomePage';

/**
 * The original user dashboard (wallpaper, big clock, coloured tiles, a page per app), kept for
 * phones and tablets. It is a snapshot of how the user pages looked before the flat redesign, so it
 * lives in its own folder and shares only the data layer (api, contexts, toasts, modal) with the
 * current UI. Administrators never see it.
 */
const lazyPage = (loader, exportName) => React.lazy(() => loader().then((m) => ({ default: m[exportName] })));

const PAGES = {
  ai: lazyPage(() => import('./pages/assistant/AssistantPage'), 'AssistantPage'),
  files: lazyPage(() => import('./pages/files/FilesPage'), 'FilesPage'),
  gallery: lazyPage(() => import('./pages/files/GalleryPage'), 'GalleryPage'),
  music: lazyPage(() => import('./pages/files/MusicPage'), 'MusicPage'),
  notes: lazyPage(() => import('./pages/files/NotesRoutePage'), 'NotesRoutePage'),
  personal: lazyPage(() => import('./pages/personal/PersonalVaultPage'), 'PersonalVaultPage'),
  settings: lazyPage(() => import('./pages/settings/SettingsPage'), 'SettingsPage'),
};

export const LegacyShell = () => {
  const location = useLocation();
  const isHome = location.pathname === '/dashboard';

  return (
    <ProfileProvider>
      <ThemeProvider>
        <div className="relative flex h-[100dvh] overflow-hidden selection:bg-[var(--accent)]/30">
          <AmbientBackground />

          <div className={`relative z-10 flex-1 overflow-x-hidden ${isHome ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <Suspense fallback={<div className="h-full flex items-center justify-center"><Spinner label="Loading" /></div>}>
              <Routes>
                <Route path="" element={<HomePage />} />
                {Object.entries(PAGES).map(([path, Page]) => <Route key={path} path={path} element={<Page />} />)}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </ThemeProvider>
    </ProfileProvider>
  );
};
