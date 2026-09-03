import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AmbientBackground } from '../ui/AmbientBackground';
import { ProfileProvider } from '../../context/ProfileContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { HomePage } from '../../pages/dashboard/HomePage';
import { AssistantPage } from '../../pages/assistant/AssistantPage';
import { FilesPage } from '../../pages/files/FilesPage';
import { GalleryPage } from '../../pages/files/GalleryPage';
import { MusicPage } from '../../pages/files/MusicPage';
import { NotesRoutePage } from '../../pages/files/NotesRoutePage';
import { PersonalVaultPage } from '../../pages/personal/PersonalVaultPage';
import { CamerasPage } from '../../pages/cameras/CamerasPage';
import { SettingsPage } from '../../pages/settings/SettingsPage';

export const DashboardShell = () => {
  const location = useLocation();
  const isHome = location.pathname === '/dashboard';

  return (
    <ProfileProvider>
      <ThemeProvider>
        <div className="relative flex h-[100dvh] overflow-hidden selection:bg-[var(--accent)]/30">
          <AmbientBackground />

          <div className={`relative z-10 flex-1 overflow-x-hidden ${isHome ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <Routes>
              <Route path="" element={<HomePage />} />
              <Route path="ai" element={<AssistantPage />} />
              <Route path="files" element={<FilesPage />} />
              <Route path="gallery" element={<GalleryPage />} />
              <Route path="music" element={<MusicPage />} />
              <Route path="notes" element={<NotesRoutePage />} />
              <Route path="personal" element={<PersonalVaultPage />} />
              <Route path="cameras" element={<CamerasPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="" replace />} />
            </Routes>
          </div>
        </div>
      </ThemeProvider>
    </ProfileProvider>
  );
};
