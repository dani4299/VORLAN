import React, { useState } from 'react';
import { Folder, Music, Image as ImageIcon, StickyNote } from 'lucide-react';
import { getUsername } from '../../lib/api';
import { StorageSummary } from './StorageSummary';
import { FileBrowser } from './FileBrowser';
import { NotesPage } from './NotesPage';

const FOLDERS = [
  { key: 'documents', label: 'Documents', hint: 'PDF, Word, Excel', icon: Folder },
  { key: 'music', label: 'Music', hint: 'MP3, WAV audio', icon: Music },
  { key: 'gallery', label: 'Pictures', hint: 'Photos and videos', icon: ImageIcon },
  { key: 'notes', label: 'Notes', hint: 'Text notes', icon: StickyNote },
];

/** The four kinds of things kept in a personal space, as a list to open. Used for the Personal Vault. */
export const FileManager = ({ isPersonal }) => {
  const activeUser = getUsername();
  const [currentFolder, setCurrentFolder] = useState(null);

  if (currentFolder === 'notes') return <NotesPage isPersonal={isPersonal} activeUser={activeUser} onBack={() => setCurrentFolder(null)} />;
  if (currentFolder) return <FileBrowser folderType={currentFolder} isPersonal={isPersonal} activeUser={activeUser} onBack={() => setCurrentFolder(null)} />;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-[var(--ink)]">{isPersonal ? 'Personal Vault' : 'Shared Files'}</h1>
        <p className="text-sm text-[var(--ink-muted)]">{isPersonal ? `Private files only you can see, ${activeUser}.` : 'Files shared with everyone on your network.'}</p>
      </div>

      <StorageSummary isPersonal={isPersonal} />

      <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FOLDERS.map((folder) => (
          <li key={folder.key}>
            <button
              type="button"
              onClick={() => setCurrentFolder(folder.key)}
              className="surface w-full rounded-[var(--radius-lg)] p-4 text-left hover:border-[var(--ink-faint)] transition-colors"
            >
              <folder.icon size={20} aria-hidden="true" className="text-[var(--ink-muted)] mb-3" />
              <span className="block text-sm font-semibold text-[var(--ink)]">{folder.label}</span>
              <span className="block text-sm text-[var(--ink-muted)] mt-0.5">{folder.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
