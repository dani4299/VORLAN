import React, { useState, useEffect, useRef } from 'react';
import {
  Lock, Plus, Folder, Video, Music, File, FileText, Download,
  ChevronLeft, Trash2, X, FileSpreadsheet, Presentation,
} from 'lucide-react';
import api, { MEDIA_BASE, authHeaders } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import { IconButton, Button } from '../../components/ui/Button';
import { SolidCard } from '../../components/ui/GlassPanel';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';

const FILE_ICON = (name) => {
  const n = name.toLowerCase();
  if (n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return { Icon: FileSpreadsheet, color: 'var(--hue-emerald)' };
  if (n.endsWith('.ppt') || n.endsWith('.pptx')) return { Icon: Presentation, color: 'var(--hue-amber)' };
  if (n.endsWith('.doc') || n.endsWith('.docx')) return { Icon: FileText, color: 'var(--accent)' };
  if (n.endsWith('.pdf')) return { Icon: File, color: 'var(--hue-rose)' };
  return { Icon: File, color: 'var(--ink-muted)' };
};

export const FileBrowser = ({ folderType, isPersonal, activeUser, onBack }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
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
          url: isPersonal ? `${MEDIA_BASE.replace('/media', '')}/media/personal/${f}` : `${MEDIA_BASE}/${f}`,
          isImage, isVideo, isAudio, type,
        };
      }).filter(f => f.type === folderType);

      setFiles(mappedFiles);
    } catch (err) {
      console.error("Couldn't load files", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, [folderType, isPersonal]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('mediaFile', file);

    const headers = authHeaders({ 'Content-Type': 'multipart/form-data' });
    if (isPersonal) headers['x-username'] = activeUser;

    const endpoint = isPersonal ? '/personal/upload' : '/vault/upload';

    try {
      await api.post(endpoint, formData, { headers });
      fetchFiles();
      showToast(`"${file.name}" uploaded successfully.`, 'success');
    } catch (err) {
      showToast('Upload failed. Please try again.', 'error');
    }
  };

  const handleDelete = async (fileObj, e) => {
    e.stopPropagation();
    try {
      const endpoint = isPersonal ? `/personal/delete/${encodeURIComponent(fileObj.name)}` : `/vault/delete/${encodeURIComponent(fileObj.name)}`;
      await api.delete(endpoint, { headers: authHeaders() });
      setFiles(files.filter(f => f.id !== fileObj.id));
      if (selectedMedia?.id === fileObj.id) setSelectedMedia(null);
      showToast('File deleted.', 'success');
    } catch (err) {
      showToast("Couldn't delete that file. Please try again.", 'error');
    }
  };

  let acceptTypes = '*/*';
  let titleStr = 'Documents';
  if (folderType === 'music') { acceptTypes = 'audio/*'; titleStr = 'Music'; }
  if (folderType === 'gallery') { acceptTypes = 'image/*,video/*'; titleStr = 'Gallery'; }

  const filteredFiles = files.filter(f => {
    if (folderType !== 'gallery') return true;
    if (activeTab === 'videos') return f.isVideo;
    if (activeTab === 'photos') return f.isImage;
    return true;
  });

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <IconButton label="Go back" onClick={onBack}><ChevronLeft size={18} /></IconButton>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--ink)] flex items-center gap-2">
              {titleStr} {isPersonal && <Lock size={14} style={{ color: 'var(--hue-amber)' }} />}
            </h1>
            <p className="text-xs text-[var(--ink-muted)]">{isPersonal ? 'Private — only you can see this' : 'Shared with everyone on your network'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {folderType === 'gallery' && (
            <div className="surface flex p-1 rounded-full">
              {['all', 'photos', 'videos'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
                  style={{ background: activeTab === tab ? 'rgba(255,255,255,0.12)' : 'transparent', color: activeTab === tab ? 'var(--ink)' : 'var(--ink-muted)' }}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept={acceptTypes} />
          <Button variant="primary" size="md" onClick={() => fileInputRef.current.click()}>
            <Plus size={15} /> Upload
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState icon={Folder} title="This folder is empty" hint="Upload something to get started" className="flex-1" />
      ) : (
        <div className={`grid gap-4 ${folderType === 'gallery' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {filteredFiles.map((file) => (
            <SolidCard key={file.id} className="group relative overflow-hidden hover:border-white/20 transition-all">
              {folderType === 'gallery' && (
                <div className="aspect-square cursor-pointer" onClick={() => setSelectedMedia(file)}>
                  {file.isImage ? (
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <video src={`${file.url}#t=0.001`} className="w-full h-full object-cover transition-transform group-hover:scale-105" muted playsInline />
                  )}
                  {!file.isImage && <div className="absolute top-2 left-2 bg-black/60 p-1.5 rounded-lg backdrop-blur-md"><Video size={13} className="text-white" /></div>}
                </div>
              )}

              {folderType !== 'gallery' && (
                <div className="p-4 flex items-center gap-4">
                  {(() => {
                    if (folderType === 'music') {
                      return <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(156,107,255,0.15)' }}><Music size={19} style={{ color: 'var(--hue-violet)' }} /></div>;
                    }
                    const { Icon, color } = FILE_ICON(file.name);
                    return <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}><Icon size={19} style={{ color }} /></div>;
                  })()}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate" title={file.name}>
                      {isPersonal ? file.name.replace(/^[^_]+_/, '') : file.name}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {folderType === 'music' ? (
                        <audio controls src={file.url} className="h-8 w-full max-w-[200px]" />
                      ) : (
                        <button onClick={() => window.open(file.url, '_blank')} className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ink-muted)' }}>
                          <Download size={12} /> Open
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button onClick={(e) => handleDelete(file, e)} className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-[var(--hue-rose)] text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md">
                <Trash2 size={13} />
              </button>
            </SolidCard>
          ))}
        </div>
      )}

      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg p-4 cursor-zoom-out" onClick={() => setSelectedMedia(null)}>
          <IconButton label="Close preview" className="absolute top-6 right-6" onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}><X size={20} /></IconButton>
          <div className="relative max-w-full max-h-full flex flex-col items-center">
            {selectedMedia.isImage ? (
              <img src={selectedMedia.url} alt={selectedMedia.name} className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
            ) : (
              <video src={`${selectedMedia.url}#t=0.001`} controls playsInline autoPlay className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
