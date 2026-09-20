import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Folder, FolderPlus, Upload as UploadIcon, ChevronLeft, Clock,
  File, FileText, FileSpreadsheet, Presentation, Image as ImageIcon, Video, Music,
  MoreVertical, Copy, Scissors, Pencil, Trash2, ClipboardPaste,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { TextField } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { formatBytes, formatDateTime, formatRelativeTime } from '../../lib/format';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { useElementWidth } from '../../lib/useElementWidth';
import * as explorerApi from '../../lib/explorerApi';

const ROOT_FOLDERS = [
  { name: 'Documents', icon: FileText },
  { name: 'Uploads', icon: UploadIcon },
  { name: 'Pictures', icon: ImageIcon },
  { name: 'Music', icon: Music },
];

const WIDE_FROM = 700; // px of page (or window) width at which the folder list becomes a side column

const fileIconFor = (name) => {
  const n = name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|svg)$/.test(n)) return ImageIcon;
  if (/\.(mp4|webm|mkv|mov)$/.test(n)) return Video;
  if (/\.(mp3|wav|ogg|m4a|opus)$/.test(n)) return Music;
  if (/\.(xlsx?|csv)$/.test(n)) return FileSpreadsheet;
  if (/\.(pptx?)$/.test(n)) return Presentation;
  if (/\.(docx?|txt|md)$/.test(n)) return FileText;
  return File;
};

const errorText = (err, fallback) => err.response?.data?.error || fallback;

/** A one-field dialog: used to name a new folder and to rename an item. The error stays in the dialog so the typing isn't lost. */
const NameDialog = ({ title, label, initial = '', submitLabel, onSubmit, onClose }) => {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(value.trim());
    } catch (err) {
      setError(errorText(err, 'That name was refused.'));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextField label={label} value={value} onChange={(e) => setValue(e.target.value)} required data-autofocus />
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!value.trim()}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
};

/** The name of a file or folder as a button, so it can be opened from the keyboard. */
const OpenButton = ({ icon: Icon, name, hint, onOpen }) => (
  <button type="button" onClick={onOpen} className="inline-flex items-center gap-2.5 min-w-0 text-left font-medium text-[var(--ink)] hover:underline">
    <Icon size={16} aria-hidden="true" className="flex-shrink-0 text-[var(--ink-muted)]" />
    <span className="truncate">{name}</span>
    {hint && <span className="text-xs font-normal text-[var(--ink-muted)] flex-shrink-0">{hint}</span>}
  </button>
);

const modified = (ms) => <time dateTime={new Date(ms).toISOString()} title={formatDateTime(ms)}>{formatRelativeTime(ms)}</time>;

export const FileExplorer = () => {
  const showToast = useToast();
  const [root, setRoot] = useState(null);
  const wide = useElementWidth(root) >= WIDE_FROM;

  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const [searchResults, setSearchResults] = useState(null);
  const [clipboard, setClipboard] = useState(null); // { path, name, op: 'copy' | 'cut' }
  const [dialog, setDialog] = useState(null); // { type: 'new-folder' } | { type: 'rename', entry } | { type: 'delete', entry }
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      showToast(errorText(err, "Couldn't load that folder."), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFolder(currentPath); }, [currentPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!debouncedQuery) { setSearchResults(null); return undefined; }
    let cancelled = false;
    explorerApi.search(debouncedQuery)
      .then((results) => { if (!cancelled) setSearchResults(results); })
      .catch(() => { if (!cancelled) showToast("Search couldn't complete.", 'error'); });
    return () => { cancelled = true; };
  }, [debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => loadFolder(currentPath);
  const pathOf = (name) => explorerApi.joinPath(currentPath, name);
  const openFolder = (name) => setCurrentPath(pathOf(name));
  const openFile = (relPath) => window.open(explorerApi.downloadUrl(relPath), '_blank', 'noopener');
  const goUp = () => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'));
  const goTo = (relPath) => { setQuery(''); setCurrentPath(relPath); };
  const crumbs = currentPath ? currentPath.split('/') : [];
  const isSearching = query.trim() !== '' && searchResults !== null;

  const handleCreateFolder = async (name) => {
    await explorerApi.createFolder(currentPath, name);
    setDialog(null);
    refresh();
  };

  const handleRename = async (name) => {
    await explorerApi.renameItem(pathOf(dialog.entry.name), name);
    setDialog(null);
    refresh();
  };

  const handleDelete = async () => {
    const { entry } = dialog;
    setDeleting(true);
    try {
      await explorerApi.deleteItem(pathOf(entry.name));
      showToast(`Deleted ${entry.name}.`, 'success');
      refresh();
    } catch (err) {
      showToast(errorText(err, "Couldn't delete that item."), 'error');
    } finally {
      setDeleting(false);
      setDialog(null);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    let done = 0;
    for (const file of files) {
      try {
        await explorerApi.uploadFile(currentPath, file);
        done += 1;
      } catch (err) {
        showToast(errorText(err, `Couldn't upload ${file.name}.`), 'error');
      }
    }
    setUploading(false);
    if (done) showToast(`Uploaded ${done} ${done === 1 ? 'file' : 'files'}.`, 'success');
    refresh();
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    try {
      if (clipboard.op === 'copy') await explorerApi.copyItem(clipboard.path, currentPath);
      else await explorerApi.moveItem(clipboard.path, currentPath);
      if (clipboard.op === 'cut') setClipboard(null);
      refresh();
    } catch (err) {
      showToast(errorText(err, "Couldn't paste here."), 'error');
    }
  };

  const entryColumns = useMemo(() => [
    {
      key: 'name', header: 'Name', sortValue: (e) => `${e.type === 'folder' ? 0 : 1}${e.name.toLowerCase()}`,
      render: (e) => {
        const relPath = pathOf(e.name);
        const hint = clipboard?.path === relPath ? (clipboard.op === 'cut' ? 'Cut' : 'Copied') : null;
        return (
          <OpenButton
            icon={e.type === 'folder' ? Folder : fileIconFor(e.name)}
            name={e.name}
            hint={hint}
            onOpen={() => (e.type === 'folder' ? openFolder(e.name) : openFile(relPath))}
          />
        );
      },
    },
    { key: 'modified', header: 'Modified', sortValue: (e) => e.modifiedAt, render: (e) => modified(e.modifiedAt), className: 'whitespace-nowrap text-[var(--ink-muted)]' },
    { key: 'size', header: 'Size', align: 'right', sortValue: (e) => (e.type === 'folder' ? -1 : e.size), render: (e) => (e.type === 'folder' ? '—' : formatBytes(e.size)), className: 'tabular-nums whitespace-nowrap text-[var(--ink-muted)]' },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (e) => (
        <Menu
          label={`Actions for ${e.name}`}
          align="right"
          buttonLabel={`Actions for ${e.name}`}
          buttonClassName="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors"
          buttonContent={<MoreVertical size={16} aria-hidden="true" />}
          items={[
            { id: 'copy', label: 'Copy', icon: Copy, onSelect: () => setClipboard({ path: pathOf(e.name), name: e.name, op: 'copy' }) },
            { id: 'cut', label: 'Cut', icon: Scissors, onSelect: () => setClipboard({ path: pathOf(e.name), name: e.name, op: 'cut' }) },
            { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setDialog({ type: 'rename', entry: e }) },
            { separator: true },
            { id: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onSelect: () => setDialog({ type: 'delete', entry: e }) },
          ]}
        />
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [currentPath, clipboard]);

  const fileListColumns = (nameKey) => [
    {
      key: 'name', header: 'Name', sortValue: (r) => r.name.toLowerCase(),
      render: (r) => (
        <OpenButton
          icon={r.type === 'folder' ? Folder : fileIconFor(r.name)}
          name={r.name}
          onOpen={() => (r.type === 'folder' ? goTo(r.path) : openFile(r.path))}
        />
      ),
    },
    { key: 'path', header: nameKey, sortValue: (r) => r.path, render: (r) => r.path.split('/').slice(0, -1).join(' / ') || 'Files', className: 'text-[var(--ink-muted)]' },
    ...(nameKey === 'Location' && searchResults === null
      ? [{ key: 'modified', header: 'Modified', sortValue: (r) => r.modifiedAt, render: (r) => modified(r.modifiedAt), className: 'whitespace-nowrap text-[var(--ink-muted)]' }]
      : []),
  ];

  const locationButton = (icon, label, active, onClick) => {
    const Icon = icon;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`w-full inline-flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm whitespace-nowrap transition-colors ${active ? 'bg-[var(--overlay-3)] text-[var(--ink)] font-medium' : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-2)]'}`}
      >
        <Icon size={16} aria-hidden="true" />{label}
      </button>
    );
  };

  const locations = (
    <ul className={wide ? 'space-y-0.5' : 'flex gap-1'}>
      <li>{locationButton(Clock, 'Recent', currentPath === '' && !isSearching, () => goTo(''))}</li>
      {ROOT_FOLDERS.map((f) => <li key={f.name}>{locationButton(f.icon, f.name, crumbs[0] === f.name && !isSearching, () => goTo(f.name))}</li>)}
    </ul>
  );

  let content;
  if (isSearching) {
    content = searchResults.length === 0
      ? <p className="text-sm text-[var(--ink-muted)] py-10 text-center">Nothing found for &ldquo;{query.trim()}&rdquo;.</p>
      : <DataTable caption={`Search results for ${query.trim()}`} columns={fileListColumns('Location')} rows={searchResults} getRowId={(r) => r.path} />;
  } else if (loading) {
    content = <div className="flex justify-center py-16"><Spinner label="Loading files" /></div>;
  } else if (currentPath === '') {
    content = (
      <>
        <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Recent files</h2>
        {recent.length === 0
          ? <p className="text-sm text-[var(--ink-muted)]">Files you add will show up here.</p>
          : <DataTable caption="Recent files" columns={fileListColumns('Location')} rows={recent.map((f) => ({ ...f, type: 'file' }))} getRowId={(r) => r.path} initialSort={{ key: 'modified', dir: 'desc' }} />}
      </>
    );
  } else {
    content = (
      <DataTable
        caption={`Contents of ${crumbs[crumbs.length - 1]}`}
        columns={entryColumns}
        rows={entries}
        getRowId={(e) => e.name}
        initialSort={{ key: 'name', dir: 'asc' }}
        empty="This folder is empty. Upload a file or create a folder to get started."
      />
    );
  }

  return (
    <div ref={setRoot} className={`h-full flex overflow-hidden ${wide ? 'flex-row' : 'flex-col'}`}>
      <h1 className="sr-only">Files</h1>
      {wide
        ? <nav aria-label="Locations" className="w-52 flex-shrink-0 p-3 border-r border-[var(--surface-border)] overflow-y-auto">{locations}</nav>
        : <nav aria-label="Locations" className="flex-shrink-0 px-3 py-2 border-b border-[var(--surface-border)] overflow-x-auto">{locations}</nav>}

      <div className="flex-1 min-w-0 flex flex-col">
        <div role="toolbar" aria-label="File actions" className="flex flex-wrap items-end gap-x-3 gap-y-2 px-4 py-3 border-b border-[var(--surface-border)] flex-shrink-0">
          {currentPath !== '' && !isSearching && (
            <IconButton label="Up one folder" onClick={goUp} className="self-end"><ChevronLeft size={18} aria-hidden="true" /></IconButton>
          )}
          <div className="flex-1 min-w-[180px] max-w-sm">
            <TextField label="Search all files" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name of a file or folder" />
          </div>
          {currentPath !== '' && !isSearching && (
            <div className="flex items-center gap-2 ml-auto">
              {clipboard && <Button variant="secondary" onClick={handlePaste}><ClipboardPaste size={16} aria-hidden="true" />Paste {clipboard.name}</Button>}
              <Button variant="secondary" onClick={() => setDialog({ type: 'new-folder' })}><FolderPlus size={16} aria-hidden="true" />New folder</Button>
              <Button onClick={() => fileInputRef.current?.click()} loading={uploading}><UploadIcon size={16} aria-hidden="true" />Upload</Button>
              <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleUpload} aria-label="Choose files to upload" />
            </div>
          )}
        </div>

        {currentPath !== '' && !isSearching && (
          <nav aria-label="Breadcrumb" className="px-4 pt-3 text-sm flex flex-wrap items-center gap-1 text-[var(--ink-muted)]">
            <button type="button" onClick={() => goTo('')} className="hover:text-[var(--ink)] hover:underline">Files</button>
            {crumbs.map((c, i) => (
              <React.Fragment key={crumbs.slice(0, i + 1).join('/')}>
                <span aria-hidden="true">/</span>
                {i === crumbs.length - 1
                  ? <span aria-current="page" className="text-[var(--ink)] font-medium">{c}</span>
                  : <button type="button" onClick={() => goTo(crumbs.slice(0, i + 1).join('/'))} className="hover:text-[var(--ink)] hover:underline">{c}</button>}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-4">{content}</div>
      </div>

      {dialog?.type === 'new-folder' && <NameDialog title="New folder" label="Folder name" submitLabel="Create" onSubmit={handleCreateFolder} onClose={() => setDialog(null)} />}
      {dialog?.type === 'rename' && <NameDialog title={`Rename ${dialog.entry.name}`} label="New name" initial={dialog.entry.name} submitLabel="Rename" onSubmit={handleRename} onClose={() => setDialog(null)} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.entry.name}?`}
          message={dialog.entry.type === 'folder' ? 'The folder and everything inside it will be deleted. This can’t be undone.' : 'This can’t be undone.'}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
};
