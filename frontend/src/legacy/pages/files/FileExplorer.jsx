import React, { useEffect, useRef, useState } from 'react';
import {
  Folder, FolderPlus, Upload as UploadIcon, Search, X, ChevronLeft, Clock,
  File, FileText, FileSpreadsheet, Presentation, Image as ImageIcon, Video, Music,
  MoreVertical, Copy, Scissors, Pencil, Trash2, ClipboardPaste,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Button, IconButton } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatBytes } from '../../../lib/format';
import * as explorerApi from '../../../lib/explorerApi';

const ROOT_FOLDERS = [
  { name: 'Documents', icon: FileText, color: 'var(--accent)' },
  { name: 'Uploads', icon: UploadIcon, color: 'var(--hue-violet)' },
  { name: 'Pictures', icon: ImageIcon, color: 'var(--hue-emerald)' },
  { name: 'Music', icon: Music, color: 'var(--hue-rose)' },
];

const fileIconFor = (name) => {
  const n = name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|svg)$/.test(n)) return { Icon: ImageIcon, color: 'var(--hue-emerald)' };
  if (/\.(mp4|webm|mkv|mov)$/.test(n)) return { Icon: Video, color: 'var(--hue-rose)' };
  if (/\.(mp3|wav|ogg|m4a|opus)$/.test(n)) return { Icon: Music, color: 'var(--hue-violet)' };
  if (/\.(xlsx?|csv)$/.test(n)) return { Icon: FileSpreadsheet, color: 'var(--hue-emerald)' };
  if (/\.(pptx?)$/.test(n)) return { Icon: Presentation, color: 'var(--hue-amber)' };
  if (/\.(docx?|txt|md)$/.test(n)) return { Icon: FileText, color: 'var(--accent)' };
  return { Icon: File, color: 'var(--ink-muted)' };
};

const timeAgo = (ms) => {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
};

const EntryMenu = ({ onCopy, onCut, onRename, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg transition-opacity hover:bg-[var(--overlay-3)] text-[var(--ink-muted)]"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="surface-strong absolute right-0 top-full mt-1 z-20 w-40 rounded-xl p-1 animate-sheet-in">
          {[
            { label: 'Copy', icon: Copy, action: onCopy },
            { label: 'Cut', icon: Scissors, action: onCut },
            { label: 'Rename', icon: Pencil, action: onRename },
            { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.action(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-[var(--overlay-3)]"
              style={{ color: item.danger ? 'var(--hue-rose)' : 'var(--ink)' }}
            >
              <item.icon size={14} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Row = ({ icon: Icon, color, name, meta, onClick, right, selected, renameNode }) => (
  <div
    onClick={onClick}
    className="group row grid items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-[var(--overlay-2)]"
    style={{ gridTemplateColumns: '20px 1fr 140px 40px', background: selected ? 'var(--accent-wash)' : undefined }}
  >
    <Icon size={17} style={{ color }} className="flex-shrink-0" />
    {renameNode || <p className="text-sm font-medium text-[var(--ink)] truncate">{name}</p>}
    <p className="text-xs text-[var(--ink-muted)] truncate">{meta}</p>
    <div className="flex justify-end">{right}</div>
  </div>
);

export const FileExplorer = () => {
  const showToast = useToast();
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [clipboard, setClipboard] = useState(null); // { path, name, op: 'copy' | 'cut' }
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renaming, setRenaming] = useState(null); // { name, draft }
  const fileInputRef = useRef(null);

  const loadFolder = async (relPath) => {
    setLoading(true);
    try {
      const [dirEntries, recentFiles] = await Promise.all([
        explorerApi.listDir(relPath),
        relPath === '' ? explorerApi.getRecent() : Promise.resolve(null),
      ]);
      setEntries(dirEntries);
      if (recentFiles) setRecent(recentFiles);
    } catch (err) {
      showToast(err.response?.data?.error || "Couldn't load that folder.", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFolder(currentPath); }, [currentPath]);

  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); return; }
    const id = setTimeout(async () => {
      try {
        setSearchResults(await explorerApi.search(query.trim()));
      } catch (err) {
        showToast("Search couldn't complete.", 'error');
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const refresh = () => loadFolder(currentPath);
  const openFolder = (name) => setCurrentPath(explorerApi.joinPath(currentPath, name));
  const goUp = () => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'));
  const crumbs = currentPath ? currentPath.split('/') : [];
  const rootName = crumbs[0];

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await explorerApi.createFolder(currentPath, newFolderName.trim());
      setNewFolderName('');
      setNewFolderOpen(false);
      refresh();
    } catch (err) {
      showToast(err.response?.data?.error || "Couldn't create that folder.", 'error');
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) {
      try {
        await explorerApi.uploadFile(currentPath, file);
      } catch (err) {
        showToast(err.response?.data?.error || `Couldn't upload ${file.name}.`, 'error');
      }
    }
    refresh();
  };

  const handleDelete = async (entry) => {
    try {
      await explorerApi.deleteItem(explorerApi.joinPath(currentPath, entry.name));
      showToast(`${entry.name} deleted.`, 'success');
      refresh();
    } catch (err) {
      showToast(err.response?.data?.error || "Couldn't delete that item.", 'error');
    }
  };

  const handleRenameSubmit = async () => {
    if (!renaming || !renaming.draft.trim()) { setRenaming(null); return; }
    try {
      await explorerApi.renameItem(explorerApi.joinPath(currentPath, renaming.name), renaming.draft.trim());
      setRenaming(null);
      refresh();
    } catch (err) {
      showToast(err.response?.data?.error || "Couldn't rename that item.", 'error');
      setRenaming(null);
    }
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    try {
      if (clipboard.op === 'copy') await explorerApi.copyItem(clipboard.path, currentPath);
      else await explorerApi.moveItem(clipboard.path, currentPath);
      if (clipboard.op === 'cut') setClipboard(null);
      refresh();
    } catch (err) {
      showToast(err.response?.data?.error || "Couldn't paste here.", 'error');
    }
  };

  const openFile = (entry) => window.open(explorerApi.downloadUrl(explorerApi.joinPath(currentPath, entry.name)), '_blank');
  const isSearching = searchResults !== null;

  const rowMenu = (entry) => {
    const relPath = explorerApi.joinPath(currentPath, entry.name);
    return (
      <EntryMenu
        onCopy={() => setClipboard({ path: relPath, name: entry.name, op: 'copy' })}
        onCut={() => setClipboard({ path: relPath, name: entry.name, op: 'cut' })}
        onRename={() => setRenaming({ name: entry.name, draft: entry.name })}
        onDelete={() => handleDelete(entry)}
      />
    );
  };

  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:flex w-56 flex-shrink-0 flex-col gap-0.5 p-3 border-r border-[var(--surface-border)]">
        <div className="flex items-center gap-2 px-2 pb-3 pt-1">
          <BackButton />
          <span className="text-sm font-semibold text-[var(--ink)]">Files</span>
        </div>
        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase text-[var(--ink-faint)]">Quick access</p>
        <button
          onClick={() => { setQuery(''); setCurrentPath(''); }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          style={currentPath === '' ? { background: 'var(--accent-wash)', color: 'var(--ink)' } : { color: 'var(--ink-muted)' }}
        >
          <Clock size={16} /> Recent
        </button>
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase text-[var(--ink-faint)]">Folders</p>
        {ROOT_FOLDERS.map((f) => (
          <button
            key={f.name}
            onClick={() => { setQuery(''); setCurrentPath(f.name); }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={rootName === f.name ? { background: 'var(--accent-wash)', color: 'var(--ink)' } : { color: 'var(--ink-muted)' }}
          >
            <f.icon size={16} style={{ color: f.color }} /> {f.name}
          </button>
        ))}
      </div>

      {/* Main pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 md:px-6 border-b border-[var(--surface-border)] flex-shrink-0 flex-wrap">
          <div className="md:hidden"><BackButton /></div>
          {currentPath !== '' && (
            <IconButton onClick={goUp} title="Back">
              <ChevronLeft size={17} />
            </IconButton>
          )}
          {!isSearching && currentPath !== '' && (
            <div className="hidden sm:flex items-center gap-1.5 text-sm">
              <button onClick={() => setCurrentPath('')} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors font-medium">Files</button>
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  <span className="text-[var(--ink-faint)]">/</span>
                  <button
                    onClick={() => setCurrentPath(crumbs.slice(0, i + 1).join('/'))}
                    className={i === crumbs.length - 1 ? 'text-[var(--ink)] font-semibold' : 'text-[var(--ink-muted)] hover:text-[var(--ink)] font-medium transition-colors'}
                  >
                    {c}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          <div className="flex-1 min-w-[160px] relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all files…"
              className="w-full bg-[var(--overlay-1)] border border-[var(--surface-border)] rounded-full pl-9 pr-8 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/60 transition-all placeholder:text-[var(--ink-faint)]"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink)]">
                <X size={14} />
              </button>
            )}
          </div>

          {!isSearching && currentPath !== '' && (
            <>
              {clipboard && (
                <Button variant="secondary" size="sm" onClick={handlePaste}>
                  <ClipboardPaste size={14} /> Paste
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setNewFolderOpen(true)}>
                <FolderPlus size={14} /> New folder
              </Button>
              <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon size={14} /> Upload
              </Button>
              <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleUpload} />
            </>
          )}
        </div>

        {newFolderOpen && (
          <div className="surface rounded-2xl p-4 m-4 mb-0 flex items-center gap-3 flex-shrink-0">
            <FolderPlus size={16} style={{ color: 'var(--accent)' }} />
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderOpen(false); }}
              placeholder="Folder name"
              className="flex-1 bg-transparent text-sm text-[var(--ink)] focus:outline-none placeholder:text-[var(--ink-faint)]"
            />
            <Button variant="ghost" size="sm" onClick={() => { setNewFolderOpen(false); setNewFolderName(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCreateFolder}>Create</Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner /></div>
          ) : isSearching ? (
            searchResults.length === 0 ? (
              <EmptyState icon={Search} title="No matches" hint={`Nothing found for "${query}"`} />
            ) : (
              <div>
                {searchResults.map((r) => {
                  const { Icon, color } = r.type === 'folder' ? { Icon: Folder, color: 'var(--hue-violet)' } : fileIconFor(r.name);
                  return (
                    <Row
                      key={r.path}
                      icon={Icon} color={color} name={r.name} meta={r.path}
                      onClick={() => { if (r.type === 'folder') { setQuery(''); setCurrentPath(r.path); } else window.open(explorerApi.downloadUrl(r.path), '_blank'); }}
                    />
                  );
                })}
              </div>
            )
          ) : currentPath === '' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {ROOT_FOLDERS.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => openFolder(f.name)}
                    className="surface rounded-2xl p-4 text-left hover:brightness-125 active:scale-[0.98] transition-all flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--overlay-2)' }}>
                      <f.icon size={17} style={{ color: f.color }} />
                    </div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{f.name}</p>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-2 px-3">
                <Clock size={13} className="text-[var(--ink-muted)]" />
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Recent files</p>
              </div>
              {recent.length === 0 ? (
                <p className="text-sm text-[var(--ink-faint)] px-3">Files you add will show up here.</p>
              ) : (
                <div>
                  {recent.map((f) => {
                    const { Icon, color } = fileIconFor(f.name);
                    return (
                      <Row
                        key={f.path}
                        icon={Icon} color={color} name={f.name} meta={f.path}
                        onClick={() => window.open(explorerApi.downloadUrl(f.path), '_blank')}
                        right={<span className="text-xs text-[var(--ink-faint)]">{timeAgo(f.modifiedAt)}</span>}
                      />
                    );
                  })}
                </div>
              )}
            </>
          ) : entries.length === 0 ? (
            <EmptyState icon={Folder} title="This folder is empty" hint="Upload a file or create a subfolder to get started." />
          ) : (
            <div>
              <div className="grid items-center gap-3 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]" style={{ gridTemplateColumns: '20px 1fr 140px 40px' }}>
                <div></div><div>Name</div><div>Modified</div><div></div>
              </div>
              {entries.map((entry) => {
                const relPath = explorerApi.joinPath(currentPath, entry.name);
                const isRenaming = renaming?.name === entry.name;
                const { Icon, color } = entry.type === 'folder' ? { Icon: Folder, color: 'var(--hue-violet)' } : fileIconFor(entry.name);
                return (
                  <Row
                    key={entry.name}
                    icon={Icon} color={color} name={entry.name}
                    meta={entry.type === 'folder' ? 'Folder' : formatBytes(entry.size)}
                    selected={clipboard?.path === relPath}
                    onClick={() => !isRenaming && (entry.type === 'folder' ? openFolder(entry.name) : openFile(entry))}
                    right={rowMenu(entry)}
                    renameNode={isRenaming ? (
                      <input
                        autoFocus
                        value={renaming.draft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenaming({ ...renaming, draft: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenaming(null); }}
                        onBlur={handleRenameSubmit}
                        className="bg-[var(--overlay-2)] border border-[var(--surface-border)] rounded-lg px-2 py-1 text-sm text-[var(--ink)] focus:outline-none w-full"
                      />
                    ) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
