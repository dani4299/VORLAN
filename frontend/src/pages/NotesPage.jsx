import { useState, useEffect } from 'react'
import { FileText, Plus, TerminalSquare } from 'lucide-react'
import axios from 'axios'

function NotesPage() {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotes()
  }, [])

  const fetchNotes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/notes')
      setNotes(res.data.notes)
    } catch (err) {
      console.error("Matrix error fetching notes", err)
    } finally {
      // 🟢 THIS LINE FIXES THE INFINITE LOADING TRAP
      setLoading(false) 
    }
  }

  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!newNote.trim()) return

    try {
      const res = await axios.post('http://localhost:5000/api/notes', { text: newNote })
      setNotes([res.data.note, ...notes])
      setNewNote('')
    } catch (err) {
      console.error("Failed to secure note", err)
    }
  }

  return (
    <div className="p-8 text-white max-w-4xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FileText className="text-yellow-400" /> Secure Edge Notes
      </h1>

      <form onSubmit={handleAddNote} className="mb-8 flex gap-2">
        <input
          type="text"
          placeholder="Log a new system event..."
          className="flex-1 p-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-yellow-500"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <button type="submit" className="bg-yellow-600 hover:bg-yellow-700 p-3 rounded-lg text-white font-bold flex items-center gap-2 transition-colors">
          <Plus size={20} /> Log
        </button>
      </form>

      {loading ? (
        <p className="text-gray-400 animate-pulse">Decrypting notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-gray-500 italic">No edge notes found in the matrix.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md text-left">
              <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-mono">
                <TerminalSquare size={14} />
                {new Date(note.timestamp).toLocaleString()}
              </div>
              <p className="text-gray-100">{note.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotesPage