import React, { useState, useEffect } from 'react';
import { ChevronLeft, Plus, StickyNote, Trash2 } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './quill-theme.css';
import api, { authHeaders } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { BackButton } from '../../components/ui/BackButton';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { TextField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';

const EDITOR_MODULES = { toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] };

/**
 * A note's body as plain text for the card preview. The body is HTML, and shared notes are written by
 * other people, so it is parsed into an inert document and only its text is read: nothing in it is
 * ever inserted into the page as markup.
 */
const plainText = (html) => {
  const body = new DOMParser().parseFromString(html || '', 'text/html').body;
  body.querySelectorAll('script, style').forEach((el) => el.remove()); // their text is code, not something to read
  return body.textContent.trim();
};

export const NotesPage = ({ isPersonal, activeUser, onBack }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorText, setEditorText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const showToast = useToast();

  const getHeaders = () => {
    const headers = authHeaders();
    if (isPersonal) { headers['x-personal'] = 'true'; headers['x-username'] = activeUser; }
    return headers;
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notes', { headers: getHeaders() });
      setNotes(res.data.notes || []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.response?.data?.error || "Couldn't load your notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, [isPersonal]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setEditingNoteId(null); setEditorTitle(''); setEditorText(''); setEditing(true); };
  const openExisting = (note) => { setEditingNoteId(note.id); setEditorTitle(note.title || ''); setEditorText(note.text); setEditing(true); };
  const isEmpty = !plainText(editorText) && !editorTitle.trim();

  const handleSave = async () => {
    if (isEmpty) return;
    const payload = { title: editorTitle, text: editorText };
    setSaving(true);
    try {
      if (editingNoteId) {
        try {
          const res = await api.put(`/notes/${editingNoteId}`, payload, { headers: getHeaders() });
          setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? (res.data.note || { ...n, ...payload }) : n)));
        } catch {
          await api.delete(`/notes/${editingNoteId}`, { headers: getHeaders() });
          const res = await api.post('/notes', payload, { headers: getHeaders() });
          setNotes((prev) => [res.data.note, ...prev.filter((n) => n.id !== editingNoteId)]);
        }
      } else {
        const res = await api.post('/notes', payload, { headers: getHeaders() });
        setNotes((prev) => [res.data.note, ...prev]);
      }
      setEditing(false);
    } catch {
      showToast("Couldn't save your note. Please try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const note = pendingDelete;
    setDeleting(true);
    try {
      await api.delete(`/notes/${note.id}`, { headers: getHeaders() });
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      showToast('Note deleted.', 'success');
    } catch {
      showToast("Couldn't delete that note. Please try again.", 'error');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  if (editing) {
    return (
      <div className="w-full h-full flex flex-col max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Button variant="ghost" onClick={() => setEditing(false)}><ChevronLeft size={16} aria-hidden="true" />All notes</Button>
          <Button onClick={handleSave} loading={saving} disabled={isEmpty}>Save</Button>
        </div>
        <TextField label="Title" value={editorTitle} onChange={(e) => setEditorTitle(e.target.value)} />
        <div className="note-editor flex-1 min-h-[16rem] flex flex-col mt-4">
          <ReactQuill theme="snow" value={editorText} onChange={setEditorText} placeholder="Write your note" modules={EDITOR_MODULES} />
        </div>
      </div>
    );
  }

  let content;
  if (loading) content = <div className="flex justify-center py-16"><Spinner label="Loading notes" /></div>;
  else if (loadError) content = <ErrorState message={loadError} onRetry={fetchNotes} />;
  else if (notes.length === 0) content = <EmptyState icon={StickyNote} title="No notes yet" hint="Create one with New note." />;
  else {
    content = (
      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <li key={note.id} className="relative surface rounded-[var(--radius-lg)] hover:border-[var(--ink-faint)] transition-colors">
            <button type="button" onClick={() => openExisting(note)} className="block w-full text-left p-4 pr-12 min-h-[7rem]">
              <span className="block text-base font-semibold text-[var(--ink)] truncate">{note.title || 'Untitled note'}</span>
              <span className="block mt-1.5 text-sm text-[var(--ink-muted)] line-clamp-3 break-words">{plainText(note.text) || 'No text'}</span>
              <span className="block mt-3 text-xs text-[var(--ink-muted)]">{new Date(note.timestamp).toLocaleDateString()}</span>
            </button>
            <IconButton label={`Delete ${note.title || 'untitled note'}`} onClick={() => setPendingDelete(note)} className="absolute top-2 right-2">
              <Trash2 size={16} aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BackButton onBack={onBack} />
          <div>
            <h1 className="text-lg font-semibold text-[var(--ink)]">Notes</h1>
            <p className="text-sm text-[var(--ink-muted)]">{isPersonal ? 'Private: only you can see this.' : 'Shared with everyone on your network.'}</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus size={16} aria-hidden="true" />New note</Button>
      </div>

      {content}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.title || 'this note'}?`}
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
