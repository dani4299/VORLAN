import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Video, Music, File, FileText, Trash2, FileSpreadsheet, Presentation } from 'lucide-react';
import api, { MEDIA_BASE, authHeaders } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { BackButton } from '../../components/ui/BackButton';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { TabPanel, Tabs } from '../../components/ui/Tabs';

const GALLERY_TABS = [{ id: 'all', label: 'All' }, { id: 'photos', label: 'Photos' }, { id: 'videos', label: 'Videos' }];
const TITLES = { documents: 'Documents', music: 'Music', gallery: 'Pictures' };
const ACCEPT = { documents: '*/*', music: 'audio/*', gallery: 'image/*,video/*' };

const iconFor = (name) => {
  const n = name.toLowerCase();
  if (/\.(xlsx?|csv)$/.test(n)) return FileSpreadsheet;
  if (/\.(pptx?)$/.test(n)) return Presentation;
  if (/\.(docx?|pdf|txt|md)$/.test(n)) return FileText;
  return File;
};

/** A photo or video as a large button that opens it in the viewer, with a delete control that appears on hover or keyboard focus. */
const GalleryTile = ({ file, onOpen, onDelete }) => (
  <li className="relative group">
    <button
      type="button"
      onClick={() => onOpen(file)}
      aria-label={`${file.isImage ? 'View photo' : 'Play video'} ${file.name}`}
      className="block w-full aspect-square overflow-hidden rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--overlay-2)] hover:border-[var(--ink-faint)] transition-colors"
    >
      {file.isImage
        ? <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
        : <video src={`${file.url}#t=0.001`} className="w-full h-full object-cover" muted playsInline preload="metadata" />}
    </button>
    {!file.isImage && (
      <span className="absolute bottom-1.5 left-1.5 w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--canvas-elevated)] border border-[var(--surface-border)] flex items-center justify-center pointer-events-none">
        <Video size={13} aria-hidden="true" className="text-[var(--ink)]" />
      </span>
    )}
    <IconButton
      label={`Delete ${file.name}`}
      onClick={() => onDelete(file)}
      className="absolute top-1.5 right-1.5 w-7! h-7! bg-[var(--canvas-elevated)] border border-[var(--surface-border-strong)] opacity-0 group-hover:opacity-100 focus:opacity-100"
    >
      <Trash2 size={14} aria-hidden="true" />
    </IconButton>
  </li>
);

export const FileBrowser = ({ folderType, isPersonal, activeUser, onBack }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const fileInputRef = useRef(null);
  const showToast = useToast();

  const fetchFiles = async () => {
    try {
      const endpoint = isPersonal ? `/personal/gallery/${activeUser}` : '/vault/gallery';
      const res = await api.get(endpoint, { headers: authHeaders() });

      const mappedFiles = (res.data.files || []).map((f, i) => {
        const ext = f.toLowerCase();
        const isImage = ext.match(/\.(jpeg|jpg|gif|png|webp)$/i);
        const isVideo = ext.match(/\.(mp4|webm|mkv)$/i);
        const isAudio = ext.match(/\.(mp3|wav|ogg|m4a|opus)$/i);

        let type = 'documents';
        if (isImage || isVideo) type = 'gallery';
        if (isAudio) type = 'music';

        return {
          id: `${isPersonal ? 'personal' : 'global'}-${i}`,
          name: f,
          shownName: isPersonal ? f.replace(/^[^_]+_/, '') : f,
          url: isPersonal ? `${MEDIA_BASE.replace('/media', '')}/media/personal/${f}` : `${MEDIA_BASE}/${f}`,
          isImage: !!isImage, isVideo: !!isVideo, isAudio: !!isAudio, type,
        };
      }).filter((f) => f.type === folderType);

      setFiles(mappedFiles);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't load your files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, [folderType, isPersonal]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('mediaFile', file);

    const headers = authHeaders({ 'Content-Type': 'multipart/form-data' });
    if (isPersonal) headers['x-username'] = activeUser;

    setUploading(true);
    try {
      await api.post(isPersonal ? '/personal/upload' : '/vault/upload', formData, { headers });
      await fetchFiles();
      showToast(`Uploaded ${file.name}.`, 'success');
    } catch {
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    const file = pendingDelete;
    setDeleting(true);
    try {
      const endpoint = isPersonal ? `/personal/delete/${encodeURIComponent(file.name)}` : `/vault/delete/${encodeURIComponent(file.name)}`;
      await api.delete(endpoint, { headers: authHeaders() });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (viewing?.id === file.id) setViewing(null);
      showToast(`Deleted ${file.shownName}.`, 'success');
    } catch {
      showToast("Couldn't delete that file. Please try again.", 'error');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const title = TITLES[folderType] || 'Files';
  const visibleFiles = files.filter((f) => {
    if (folderType !== 'gallery') return true;
    if (activeTab === 'videos') return f.isVideo;
    if (activeTab === 'photos') return f.isImage;
    return true;
  });

  const listColumns = useMemo(() => [
    {
      key: 'name', header: 'Name', sortValue: (f) => f.shownName.toLowerCase(),
      render: (f) => {
        const Icon = folderType === 'music' ? Music : iconFor(f.name);
        return <span className="inline-flex items-center gap-2.5 min-w-0 font-medium"><Icon size={16} aria-hidden="true" className="flex-shrink-0 text-[var(--ink-muted)]" /><span className="truncate" title={f.shownName}>{f.shownName}</span></span>;
      },
    },
    {
      key: 'open', header: folderType === 'music' ? 'Player' : 'Open',
      render: (f) => (folderType === 'music'
        ? <audio controls preload="none" src={f.url} aria-label={`Play ${f.shownName}`} className="h-8 w-full min-w-[12rem] max-w-xs" />
        : <Button variant="secondary" size="sm" onClick={() => window.open(f.url, '_blank', 'noopener')} aria-label={`Open ${f.shownName}`}>Open</Button>),
    },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (f) => <IconButton label={`Delete ${f.shownName}`} onClick={() => setPendingDelete(f)}><Trash2 size={16} aria-hidden="true" /></IconButton>,
    },
  ], [folderType]);

  let content;
  if (loading) content = <div className="flex justify-center py-16"><Spinner label="Loading files" /></div>;
  else if (error) content = <ErrorState message={error} onRetry={fetchFiles} />;
  else if (visibleFiles.length === 0) content = <EmptyState icon={folderType === 'music' ? Music : File} title="Nothing here yet" hint="Upload a file to get started." />;
  else if (folderType === 'gallery') {
    content = (
      <ul className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {visibleFiles.map((file) => <GalleryTile key={file.id} file={file} onOpen={setViewing} onDelete={setPendingDelete} />)}
      </ul>
    );
  } else {
    content = <DataTable caption={title} columns={listColumns} rows={visibleFiles} getRowId={(f) => f.id} initialSort={{ key: 'name', dir: 'asc' }} />;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BackButton onBack={onBack} />
          <div>
            <h1 className="text-lg font-semibold text-[var(--ink)]">{title}</h1>
            <p className="text-sm text-[var(--ink-muted)]">{isPersonal ? 'Private: only you can see this.' : 'Shared with everyone on your network.'}</p>
          </div>
        </div>
        <div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept={ACCEPT[folderType]} aria-label={`Choose a file to upload to ${title}`} />
          <Button onClick={() => fileInputRef.current.click()} loading={uploading}><Plus size={16} aria-hidden="true" />Upload</Button>
        </div>
      </div>

      {folderType === 'gallery' ? (
        <>
          <Tabs idPrefix="gallery" label="Show" tabs={GALLERY_TABS} value={activeTab} onChange={setActiveTab} className="mb-4" />
          {GALLERY_TABS.map((t) => <TabPanel key={t.id} idPrefix="gallery" id={t.id} value={activeTab}>{content}</TabPanel>)}
        </>
      ) : content}

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)} size="xl">
          {viewing.isImage
            ? <img src={viewing.url} alt={viewing.name} className="max-w-full max-h-[70dvh] mx-auto object-contain rounded-[var(--radius-md)]" />
            : <video src={`${viewing.url}#t=0.001`} controls playsInline autoPlay className="max-w-full max-h-[70dvh] mx-auto rounded-[var(--radius-md)]" />}
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.shownName}?`}
          message="This can't be undone."
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};
