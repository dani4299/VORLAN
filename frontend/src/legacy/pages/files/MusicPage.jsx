import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWindow } from '../../../desktop/WindowContext';
import { getUsername } from '../../../lib/api';
import { FileBrowser } from './FileBrowser';

export const MusicPage = () => {
  const navigate = useNavigate();
  const inWindow = useWindow();
  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto h-full overflow-y-auto">
      <FileBrowser folderType="music" isPersonal={false} activeUser={getUsername()} onBack={() => (inWindow ? inWindow.close() : navigate('/dashboard'))} />
    </div>
  );
};
