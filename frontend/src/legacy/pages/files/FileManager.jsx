import React, { useState } from 'react';
import { Lock, Folder, Music, Image as ImageIcon, StickyNote } from 'lucide-react';
import { getUsername } from '../../../lib/api';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { StorageSummary } from './StorageSummary';
import { FileBrowser } from './FileBrowser';
import { NotesPage } from './NotesPage';

const FOLDER_TILES = [
  { key: 'documents', label: 'Documents', hint: 'PDF, Word, Excel', icon: Folder, color: 'var(--accent)', wash: 'rgba(76,141,255,0.16)' },
  { key: 'music', label: 'Music', hint: 'MP3, WAV audio', icon: Music, color: 'var(--hue-violet)', wash: 'rgba(156,107,255,0.16)' },
  { key: 'gallery', label: 'Gallery', hint: 'Photos & videos', icon: ImageIcon, color: 'var(--hue-emerald)', wash: 'rgba(52,211,153,0.16)' },
  { key: 'notes', label: 'Notes', hint: 'Text documents', icon: StickyNote, color: 'var(--hue-amber)', wash: 'rgba(255,180,84,0.16)' },
];

export const FileManager = ({ isPersonal }) => {
  const activeUser = getUsername();
  const [currentFolder, setCurrentFolder] = useState(null);

  if (currentFolder === 'notes') return <NotesPage isPersonal={isPersonal} activeUser={activeUser} onBack={() => setCurrentFolder(null)} />;
  if (currentFolder) return <FileBrowser folderType={currentFolder} isPersonal={isPersonal} activeUser={activeUser} onBack={() => setCurrentFolder(null)} />;

  return (
    <div className="w-full h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] mb-1.5 flex items-center gap-2">
          {isPersonal ? 'Personal Vault' : 'Shared Files'} {isPersonal && <Lock size={16} style={{ color: 'var(--hue-amber)' }} />}
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">{isPersonal ? `Private files only you can see, ${activeUser}` : 'Files shared with everyone on your network'}</p>
      </div>

      <StorageSummary isPersonal={isPersonal} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {FOLDER_TILES.map(tile => (
          <GlassPanel key={tile.key} as="button" onClick={() => setCurrentFolder(tile.key)} className="p-6 text-left hover:brightness-125 active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: tile.wash }}>
              <tile.icon size={22} style={{ color: tile.color }} />
            </div>
            <h3 className="font-semibold text-[var(--ink)]">{tile.label}</h3>
            <p className="text-xs text-[var(--ink-muted)] mt-1">{tile.hint}</p>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
};
