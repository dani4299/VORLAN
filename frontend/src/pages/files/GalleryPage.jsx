import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsername } from '../../lib/api';
import { FileBrowser } from './FileBrowser';

export const GalleryPage = () => {
  const navigate = useNavigate();
  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto h-full overflow-y-auto">
      <FileBrowser folderType="gallery" isPersonal={false} activeUser={getUsername()} onBack={() => navigate('/dashboard')} />
    </div>
  );
};
