import React, { useState, useEffect } from 'react';
import { Lock, Plus, ChevronLeft, StickyNote, X, Trash2 } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api, { authHeaders } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import { IconButton, Button } from '../../components/ui/Button';
import { SolidCard } from '../../components/ui/GlassPanel';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';

const QUILL_THEME_OVERRIDES = `
  .quill { display: flex; flex-direction: column; flex: 1; height: 100%; }
  .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; padding: 16px 0 !important; font-family: inherit !important; }
  .ql-container.ql-snow { border: none !important; font-family: inherit !important; font-size: 1.125rem !important; flex: 1; overflow-y: auto; }
  .ql-editor { padding: 24px 0 !important; }
  .ql-editor.ql-blank::before { color: var(--ink-faint) !important; font-style: normal !important; left: 0 !important; }
  .ql-snow .ql-stroke { stroke: var(--ink-muted) !important; }
  .ql-snow .ql-fill, .ql-snow .ql-stroke.ql-fill { fill: var(--ink-muted) !important; }
  .ql-snow .ql-picker { color: var(--ink-muted) !important; }
  .ql-snow .ql-picker-options { background-color: var(--canvas-elevated) !important; border-color: rgba(255,255,255,0.1) !important; border-radius: 12px !important; }
  .ql-snow .ql-picker-item:hover { color: #fff !important; }
  button:hover .ql-stroke { stroke: var(--accent) !important; }
  button:hover .ql-fill { fill: var(--accent) !important; }
  .ql-editor p, .ql-editor ul, .ql-editor ol { margin-bottom: 0.75rem; color: var(--ink); }
`;

/** A note's body as plain text: parsed into an inert document and only its text read, so nothing in a note is ever run. */
const plainText = (html) => {
  const body = new DOMParser().parseFromString(html || '', 'text/html').body;
  body.querySelectorAll('script, style').forEach((el) => el.remove());
  return body.textContent.trim();
};

export const NotesPage = ({ isPersonal, activeUser, onBack }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorText, setEditorText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const showToast = useToast();

  const getHeaders = () => {
    const headers = authHeaders();
    if (isPersonal) { headers['x-personal'] = 'true'; headers['x-username'] = activeUser; }
    return headers;
  };

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await api.get('/notes', { headers: getHeaders() });
        setNotes(res.data.notes || []);
      } catch (err) { console.error("Couldn't load notes", err); } finally { setLoading(false); }
    };
    fetchNotes();
  }, [isPersonal]);

  const handleOpenNewNote = () => { setEditingNoteId(null); setEditorTitle(''); setEditorText(''); setIsEditorOpen(true); };
  const handleOpenEditNote = (note) => { setEditingNoteId(note.id); setEditorTitle(note.title || ''); setEditorText(note.text); setIsEditorOpen(true); };

  const handleSaveNote = async () => {
    if (!editorText.replace(/(<([^>]+)>)/gi, '').trim() && !editorTitle.trim()) return;
    const payload = { title: editorTitle, text: editorText };
    try {
      if (editingNoteId) {
        try {
          const res = await api.put(`/notes/${editingNoteId}`, payload, { headers: getHeaders() });
          setNotes(notes.map(n => n.id === editingNoteId ? (res.data.note || { ...n, ...payload }) : n));
        } catch (putErr) {
          await api.delete(`/notes/${editingNoteId}`, { headers: getHeaders() });
          const res = await api.post('/notes', payload, { headers: getHeaders() });
          setNotes([res.data.note, ...notes.filter(n => n.id !== editingNoteId)]);
        }
      } else {
        const res = await api.post('/notes', payload, { headers: getHeaders() });
        setNotes([res.data.note, ...notes]);
      }
      setIsEditorOpen(false); setEditorTitle(''); setEditorText('');
    } catch (err) {
      console.error('Failed to save note', err);
      showToast("Couldn't save your note. Please try again.", 'error');
    }
  };

  const handleDeleteNote = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/notes/${id}`, { headers: getHeaders() });
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete', err);
      showToast("Couldn't delete that note. Please try again.", 'error');
    }
  };

  return (
    <div className="w-full h-full">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <IconButton label="Go back" onClick={onBack}><ChevronLeft size={18} /></IconButton>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--ink)] flex items-center gap-2">Notes {isPersonal && <Lock size={14} style={{ color: 'var(--hue-amber)' }} />}</h1>
            <p className="text-xs text-[var(--ink-muted)]">{isPersonal ? 'Private — only you can see this' : 'Shared with everyone on your network'}</p>
          </div>
        </div>
        <Button variant="primary" size="md" onClick={handleOpenNewNote}>
          <Plus size={15} /> New Note
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20"><Spinner /></div>
      ) : notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="You don't have any notes yet" />
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
          {notes.map((note) => (
            <SolidCard key={note.id} onClick={() => handleOpenEditNote(note)} className="p-5 break-inside-avoid hover:border-white/20 transition-all group cursor-pointer min-h-[120px] flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--ink)] mb-2 truncate">{note.title || 'Untitled Note'}</h3>
                <div className="text-[var(--ink-muted)] text-sm leading-relaxed line-clamp-4 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:ml-4" >{plainText(note.text)}</div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[11px] text-[var(--ink-faint)] font-medium">{new Date(note.timestamp).toLocaleDateString()}</span>
                <button onClick={(e) => handleDeleteNote(note.id, e)} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: 'var(--hue-rose)' }}><Trash2 size={13} /></button>
              </div>
            </SolidCard>
          ))}
        </div>
      )}

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex flex-col animate-sheet-in" style={{ background: 'var(--canvas)', color: 'var(--ink)' }}>
          <style>{QUILL_THEME_OVERRIDES}</style>
          <div className="flex items-center justify-between px-6 py-4 md:px-12 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <IconButton label="Close editor" onClick={() => setIsEditorOpen(false)}><X size={18} /></IconButton>
              <span className="text-sm font-medium text-[var(--ink-muted)] flex items-center gap-2">
                {editingNoteId ? 'Edit Note' : 'New Note'} {isPersonal && <Lock size={12} style={{ color: 'var(--hue-amber)' }} />}
              </span>
            </div>
            <Button variant="primary" size="md" onClick={handleSaveNote} disabled={!editorText.replace(/(<([^>]+)>)/gi, '').trim() && !editorTitle.trim()}>
              Save
            </Button>
          </div>
          <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-4 md:py-8 flex flex-col h-full">
            <input type="text" placeholder="Title" value={editorTitle} onChange={(e) => setEditorTitle(e.target.value)} className="w-full bg-transparent text-3xl md:text-4xl font-semibold text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none mb-2 px-4" />
            <ReactQuill theme="snow" value={editorText} onChange={setEditorText} placeholder="Start writing..." modules={{ toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] }} />
          </div>
        </div>
      )}
    </div>
  );
};
