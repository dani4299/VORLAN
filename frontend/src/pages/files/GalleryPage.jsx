import React from 'react';
import { getUsername } from '../../lib/api';
import { FileBrowser } from './FileBrowser';

export const GalleryPage = () => (
  <div className="p-4 md:p-8 max-w-6xl mx-auto h-full overflow-y-auto">
    <FileBrowser folderType="gallery" isPersonal={false} activeUser={getUsername()} />
  </div>
);
