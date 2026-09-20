import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppBar } from './AppBar';
import { ShellProvider } from './ShellContext';
import { Spinner } from '../ui/Spinner';
import { ProfileProvider } from '../../context/ProfileContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { isAdmin } from '../../lib/api';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { AdminDesktop } from '../../desktop/AdminDesktop';
import { APPS } from '../../desktop/apps';
import { HomePage } from '../../pages/dashboard/HomePage';

// The original dashboard, loaded only when it's actually shown.
const LegacyShell = React.lazy(() => import('../../legacy/LegacyShell').then((m) => ({ default: m.LegacyShell })));

// Phones and tablets: a touch screen as the main input, or anything narrower than a landscape tablet.
const TOUCH_LAYOUT = '(pointer: coarse), (max-width: 1023px)';

/** Administrators live on the desktop: a deep link like /dashboard/files lands there with that app open. */
const OpenInDesktop = ({ appId }) => <Navigate to="/dashboard" replace state={{ open: appId }} />;

/** A non-admin's page for an app, from the same registry the desktop uses, loaded on first visit. */
const AppPage = ({ appId }) => {
  const { Component } = APPS.find((a) => a.id === appId);
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><Spinner label="Loading" /></div>}>
      <Component />
    </Suspense>
  );
};

export const DashboardShell = () => {
  const admin = isAdmin();
  const touchLayout = useMediaQuery(TOUCH_LAYOUT);

  // People who aren't administrators get the original dashboard on a phone or tablet.
  if (!admin && touchLayout) {
    return (
      <Suspense fallback={<div className="h-[100dvh] flex items-center justify-center bg-[var(--canvas)]"><Spinner label="Loading" /></div>}>
        <LegacyShell />
      </Suspense>
    );
  }

  // For an admin every app is a desktop window; everyone else keeps a page per app.
  const page = (appId) => (admin ? <OpenInDesktop appId={appId} /> : <AppPage appId={appId} />);
  const adminOnly = (appId) => (admin ? <OpenInDesktop appId={appId} /> : <Navigate to="/dashboard" replace />);

  return (
    <ProfileProvider>
      <ThemeProvider>
        <ShellProvider value={!admin}>
          <div className="h-[100dvh] flex flex-col bg-[var(--canvas)] selection:bg-[var(--accent)]/30">
            {!admin && <AppBar />}
            <main className="flex-1 min-h-0 overflow-hidden">
              <Routes>
                <Route path="" element={admin ? <AdminDesktop /> : <HomePage />} />
                <Route path="ai" element={page('assistant')} />
                <Route path="files" element={page('files')} />
                <Route path="gallery" element={page('gallery')} />
                <Route path="music" element={page('music')} />
                <Route path="notes" element={page('notes')} />
                <Route path="personal" element={page('personal')} />
                <Route path="cameras" element={adminOnly('cameras')} />
                <Route path="settings" element={page('settings')} />
                <Route path="system" element={adminOnly('control-panel')} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </ShellProvider>
      </ThemeProvider>
    </ProfileProvider>
  );
};
