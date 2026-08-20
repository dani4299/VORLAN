import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, Lock, MessageSquare, Image as ImageIcon, 
  Video, StickyNote, LogOut, Search, Plus, 
  Menu, X, Send, User, Bot, AlertCircle, Clock, Trash2,
  Folder, FileText, Music, File, Download, ChevronLeft, PlayCircle,
  FileSpreadsheet, Presentation 
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';




const currentIP = window.location.hostname;
const API_BASE = `http://${currentIP}:5000/api`;
const MEDIA_BASE = `http://${currentIP}:5000/media`;

const isAuthenticated = () => !!localStorage.getItem('vorlan_token');

const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
};

const AuthView = ({ isLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin ? { username, password } : { username, password, role: 'admin' };
      
      const response = await axios.post(`${API_BASE}${endpoint}`, payload);
      
      if (isLogin) {
        const token = response.data.token || response.data.accessToken;
        if (token) {
          localStorage.setItem('vorlan_token', token);
          localStorage.setItem('vorlan_role', response.data.role || 'user');
          // 🟢 FIXED: The matrix now actually remembers who you are!
          localStorage.setItem('vorlan_username', username); 
          window.location.href = '/dashboard/ai';
        } else {
          setError('Authentication token missing from server response.');
        }
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-md bg-[#18181b] border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-500/10 blur-[100px] pointer-events-none"></div>
        
        <div className="flex justify-center mb-8 relative z-10">
          <div className="bg-zinc-800 p-4 rounded-2xl shadow-inner border border-zinc-700/50">
            {isLogin ? <Lock className="w-8 h-8 text-blue-400" /> : <Shield className="w-8 h-8 text-purple-400" />}
          </div>
        </div>
        
        <h1 className="text-3xl font-semibold text-center mb-2 tracking-tight">
          {isLogin ? 'Sign in' : 'Create Account'}
        </h1>
        <p className="text-sm text-zinc-400 text-center mb-8">
          {isLogin ? 'Access the VORLAN workspace.' : 'Register a new administrative account.'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2 ml-1 uppercase tracking-wider">Username</label>
            <input 
              type="text" 
              className="w-full bg-[#0a0a0b] border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
              placeholder="Enter your username"
              value={username} onChange={(e) => setUsername(e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2 ml-1 uppercase tracking-wider">Password</label>
            <input 
              type="password" 
              className="w-full bg-[#0a0a0b] border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
              placeholder="Enter your password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-4 rounded-2xl text-sm transition-colors mt-4 disabled:opacity-50 shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Processing...' : (isLogin ? 'Continue' : 'Register')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-zinc-500 relative z-10">
          {isLogin ? (
            <p>New user? <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Create an account</Link></p>
          ) : (
            <p>Already have an account? <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign In</Link></p>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatInterface = () => {
  const defaultSession = { 
    id: Date.now(), 
    title: 'New Conversation', 
    messages: [{ role: 'system', content: 'Hello. I am the VORLAN AI assistant. How can I help you today?' }] 
  };
  
  const [sessions, setSessions] = useState([defaultSession]);
  const [currentSessionId, setCurrentSessionId] = useState(defaultSession.id);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/history`);
        if (res.data.sessions && res.data.sessions.length > 0) {
          setSessions(res.data.sessions);
          setCurrentSessionId(res.data.sessions[0].id);
        }
      } catch (err) {
        console.warn("Matrix sync offline, relying on local node.", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    if (!loadingHistory && sessions.length > 0) {
      axios.post(`${API_BASE}/history`, { sessions })
        .catch(err => console.warn("Failed to push to matrix", err));
    }
  }, [sessions, loadingHistory]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleNewChat = () => {
    const newSession = {
      id: Date.now(),
      title: 'New Conversation',
      messages: [{ role: 'system', content: 'Hello. I am the VORLAN AI assistant. How can I help you today?' }]
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setShowSidebar(false);
  };

  const handleDeleteChat = (id, e) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const newSession = { id: Date.now(), title: 'New Conversation', messages: [{ role: 'system', content: 'Hello. I am the VORLAN AI assistant. How can I help you today?' }] };
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    } else {
      setSessions(updated);
      if (currentSessionId === id) setCurrentSessionId(updated[0].id);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput('');
    setIsTyping(true);

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        let newTitle = s.title;
        if (s.messages.length === 1 && s.title === 'New Conversation') {
          newTitle = userMessage.length > 20 ? userMessage.substring(0, 20) + '...' : userMessage;
        }
        return { ...s, title: newTitle, messages: [...s.messages, { role: 'user', content: userMessage }] };
      }
      return s;
    }));

    try {
      const res = await axios.post(`${API_BASE}/ai/ask`, { prompt: userMessage }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('vorlan_token')}` }
      });
      
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, messages: [...s.messages, { role: 'system', content: res.data.reply }] } : s
      ));
    } catch (err) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, messages: [...s.messages, { role: 'system', content: 'Connection to language model failed. Please check network status.' }] } : s
      ));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen w-full relative bg-[#0a0a0b] overflow-hidden flex-row">
      
      <div className="flex-1 flex flex-col relative h-full w-full bg-[#0a0a0b]">
        
        <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-zinc-800/50 bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Assistant</h1>
            <p className="text-xs text-zinc-400">Powered by Local LLM</p>
          </div>
          
          <button 
            onClick={() => setShowSidebar(true)} 
            className="text-zinc-400 hover:text-white p-2.5 bg-[#18181b] border border-zinc-800 rounded-xl shadow-sm flex items-center gap-2 text-xs font-medium transition-colors"
          >
            <MessageSquare size={16} className="text-blue-400" /> History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-6 pb-32">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'system' && (
                  <div className="w-8 h-8 rounded-full bg-white border border-zinc-700 flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden shadow-[0_0_10px_rgba(220,38,38,0.2)]">
                    {/* 🟢 LITERAL EXTENSION: .jpeg */}
                    <img src="/logo.jpeg" alt="AI" className="w-full h-full object-contain p-[3px]" />
                  </div>
                )}
                <div className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-6 py-4 text-sm md:text-base shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[#18181b] border border-zinc-800/50 text-zinc-200 rounded-tl-sm'
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-[0_0_10px_rgba(220,38,38,0.2)]">
                  {/* 🟢 LITERAL EXTENSION: .jpeg */}
                  <img src="/logo.jpeg" alt="AI" className="w-full h-full object-contain p-[3px]" />
                </div>
                <div className="flex items-center gap-1 h-8 px-4 bg-[#18181b] rounded-3xl rounded-tl-sm border border-zinc-800/50 w-24 justify-center">
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b] text-center pt-10">
          <div className="max-w-3xl mx-auto relative flex gap-2">
            <input
              type="text"
              className="flex-1 bg-[#18181b] border border-zinc-700/50 text-zinc-100 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-zinc-500 focus:ring-4 focus:ring-zinc-800/50 transition-all shadow-lg"
              placeholder="Message Assistant..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-2 bottom-2 w-10 h-10 bg-zinc-100 text-zinc-900 rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors"
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
          <p className="text-[10px] md:text-xs text-zinc-500 mt-3 font-medium">Assistant can make mistakes. Verify critical information.</p>
        </div>
      </div>

      <div className={`absolute right-0 top-0 z-40 h-full w-64 bg-[#0c0c0e] border-l border-zinc-800/50 flex flex-col transition-transform duration-300 shadow-2xl ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/20 overflow-hidden bg-white">
               {/* 🟢 LITERAL EXTENSION: .jpeg */}
               <img src="/logo.jpeg" alt="VORLAN AI" className="w-full h-full object-contain p-0.5" />
             </div>
             <span className="font-bold tracking-tight text-white">AI Node</span>
           </div>
          <button onClick={() => setShowSidebar(false)} className="text-zinc-400 p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-zinc-800/50">
          <button onClick={handleNewChat} className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl w-full justify-center transition-colors shadow-lg shadow-blue-900/20">
            <Plus size={16} /> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-2">Recent Matrix logs</p>
          {sessions.map(s => (
            <div 
              key={s.id} 
              onClick={() => { setCurrentSessionId(s.id); setShowSidebar(false); }} 
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentSessionId === s.id ? 'bg-zinc-800/80 text-white border border-zinc-700/50 shadow-sm' : 'hover:bg-zinc-800/40 text-zinc-400 border border-transparent'}`}
            >
              <div className="flex items-center gap-3 truncate">
                <MessageSquare size={16} className={`flex-shrink-0 ${currentSessionId === s.id ? 'text-blue-400' : 'text-zinc-500'}`} />
                <span className="text-sm truncate font-medium">{s.title}</span>
              </div>
              <button onClick={(e) => handleDeleteChat(s.id, e)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity p-1 hover:bg-red-500/10 rounded-md">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showSidebar && (
        <div className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm transition-opacity" onClick={() => setShowSidebar(false)}></div>
      )}

    </div>
  );
};

// ==========================================
// THE OS FILE SYSTEM COMPONENTS
// ==========================================

const UniversalDrive = ({ folderType, isPersonal, activeUser, onBack }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); 
  const fileInputRef = useRef(null);

  const fetchFiles = async () => {
    try {
      const endpoint = isPersonal ? `${API_BASE}/personal/gallery/${activeUser}` : `${API_BASE}/vault/gallery`;
      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${localStorage.getItem('vorlan_token')}` }
      });
      
      const mappedFiles = (res.data.files || []).map((f, i) => {
        const ext = f.toLowerCase();
        const isImage = ext.match(/\.(jpeg|jpg|gif|png|webp)$/i);
        const isVideo = ext.match(/\.(mp4|webm|mkv)$/i);
        const isAudio = ext.match(/\.(mp3|wav|ogg|m4a|opus)$/i);
        const isDoc = !isImage && !isVideo && !isAudio;

        let type = 'documents';
        if (isImage || isVideo) type = 'gallery';
        if (isAudio) type = 'music';

        return {
           id: `${isPersonal ? 'personal' : 'global'}-${i}`,
           name: f,
           url: isPersonal ? `${MEDIA_BASE.replace('/media', '')}/media/personal/${f}` : `${MEDIA_BASE}/${f}`,
           isImage, isVideo, isAudio, isDoc, type
        };
      }).filter(f => f.type === folderType);
      
      setFiles(mappedFiles);
    } catch (err) {
      console.error("Sync failed", err);
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

    const headers = { Authorization: `Bearer ${localStorage.getItem('vorlan_token')}`, 'Content-Type': 'multipart/form-data' };
    if (isPersonal) headers['x-username'] = activeUser;

    const endpoint = isPersonal ? `${API_BASE}/personal/upload` : `${API_BASE}/vault/upload`;

    try {
      await axios.post(endpoint, formData, { headers });
      fetchFiles();
    } catch (err) { alert("Upload failed."); }
  };

  const handleDelete = async (fileObj, e) => {
    e.stopPropagation(); 
    try {
      const endpoint = isPersonal ? `${API_BASE}/personal/delete/${encodeURIComponent(fileObj.name)}` : `${API_BASE}/vault/delete/${encodeURIComponent(fileObj.name)}`;
      await axios.delete(endpoint, { headers: { Authorization: `Bearer ${localStorage.getItem('vorlan_token')}` } });
      setFiles(files.filter(f => f.id !== fileObj.id));
      if(selectedMedia?.id === fileObj.id) setSelectedMedia(null);
    } catch (err) { alert("Failed to delete."); }
  };

  // Determine accepted file types based on the folder
  let acceptTypes = "*/*";
  let titleStr = "Documents";
  if (folderType === 'music') { acceptTypes = "audio/*"; titleStr = "Music"; }
  if (folderType === 'gallery') { acceptTypes = "image/*,video/*"; titleStr = "Gallery"; }

  const filteredFiles = files.filter(f => {
    if (folderType !== 'gallery') return true;
    if (activeTab === 'videos') return f.isVideo;
    if (activeTab === 'photos') return f.isImage;
    return true;
  });

  return (
    <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {titleStr} {isPersonal && <Lock size={16} className="text-blue-500" />}
            </h1>
            <p className="text-xs text-zinc-500">{isPersonal ? 'Encrypted Local Partition' : 'Global Network Drive'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {folderType === 'gallery' && (
            <div className="flex bg-[#18181b] p-1 rounded-xl border border-zinc-800/80 shadow-inner">
              <button onClick={() => setActiveTab('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>All</button>
              <button onClick={() => setActiveTab('photos')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'photos' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Photos</button>
              <button onClick={() => setActiveTab('videos')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'videos' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Videos</button>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept={acceptTypes} />
          <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-zinc-100 text-zinc-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-white transition-colors">
            <Plus size={16} /> Upload
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-zinc-800 border-t-zinc-400 rounded-full animate-spin"></div></div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 bg-[#18181b] border border-zinc-800 rounded-3xl border-dashed min-h-[300px]">
          <Folder size={48} className="mb-3 opacity-30" />
          <p className="font-medium">Folder is Empty</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${folderType === 'gallery' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {filteredFiles.map((file) => (
            <div key={file.id} className="group relative bg-[#18181b] rounded-2xl overflow-hidden border border-zinc-800/80 hover:border-zinc-600 transition-all shadow-sm">
              
              {/* GALLERY VIEW */}
              {folderType === 'gallery' && (
                <div className="aspect-square cursor-pointer" onClick={() => setSelectedMedia(file)}>
                  {file.isImage ? (
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <video src={`${file.url}#t=0.001`} className="w-full h-full object-cover transition-transform group-hover:scale-105" muted playsInline />
                  )}
                  {!file.isImage && <div className="absolute top-2 left-2 bg-black/60 p-1.5 rounded-lg backdrop-blur-md"><Video size={14} className="text-white" /></div>}
                </div>
              )}

             {/* DOCUMENTS & MUSIC VIEW */}
              {folderType !== 'gallery' && (
                <div className="p-4 flex items-center gap-4">
                  {/* 🟢 THE DYNAMIC ICON ENGINE */}
                  {(() => {
                    const name = file.name.toLowerCase();
                    if (folderType === 'music') {
                      return <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 bg-purple-500/10 text-purple-400"><Music size={24} /></div>;
                    } else if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) {
                      return <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><FileSpreadsheet size={24} /></div>;
                    } else if (name.endsWith('.ppt') || name.endsWith('.pptx')) {
                      return <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 bg-orange-500/10 text-orange-500 border border-orange-500/20"><Presentation size={24} /></div>;
                    } else if (name.endsWith('.doc') || name.endsWith('.docx')) {
                      return <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 bg-blue-500/10 text-blue-500 border border-blue-500/20"><FileText size={24} /></div>;
                    } else if (name.endsWith('.pdf')) {
                      return <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 bg-red-500/10 text-red-500 border border-red-500/20"><File size={24} /></div>;
                    } else {
                      return <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"><File size={24} /></div>;
                    }
                  })()}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-200 truncate" title={file.name}>
                      {/* Strip the username prefix out of the UI for personal files so it looks clean! */}
                      {isPersonal ? file.name.replace(/^[^_]+_/, '') : file.name}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {folderType === 'music' ? (
                        <audio controls src={file.url} className="h-8 w-full max-w-[200px]" />
                      ) : (
                        <button onClick={() => window.open(file.url, '_blank')} className="text-xs font-semibold bg-zinc-800 text-zinc-300 px-3 py-1 rounded-lg hover:text-white hover:bg-zinc-700 transition-colors flex items-center gap-1">
                          <Download size={12} /> Open
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* UNIVERSAL DELETE BUTTON */}
              <button onClick={(e) => handleDelete(file, e)} className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GALLERY LIGHTBOX */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 cursor-zoom-out animate-in fade-in" onClick={() => setSelectedMedia(null)}>
          <button className="absolute top-6 right-6 text-zinc-400 hover:text-white bg-zinc-900/50 p-2 rounded-full" onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}><X size={24} /></button>
          <div className="relative max-w-full max-h-full flex flex-col items-center">
            {selectedMedia.isImage ? (
              <img src={selectedMedia.url} alt={selectedMedia.name} className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
            ) : (
              <video src={`${selectedMedia.url}#t=0.001`} controls playsInline autoPlay className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const NotesApp = ({ isPersonal, activeUser, onBack }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorText, setEditorText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);

  const getHeaders = () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('vorlan_token')}` };
    if (isPersonal) { headers['x-personal'] = 'true'; headers['x-username'] = activeUser; }
    return headers;
  };

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await axios.get(`${API_BASE}/notes`, { headers: getHeaders() });
        setNotes(res.data.notes || []);
      } catch (err) { console.error("Notes failed", err); } finally { setLoading(false); }
    };
    fetchNotes();
  }, [isPersonal]);

  const handleOpenNewNote = () => { setEditingNoteId(null); setEditorTitle(''); setEditorText(''); setIsEditorOpen(true); };
  const handleOpenEditNote = (note) => { setEditingNoteId(note.id); setEditorTitle(note.title || ''); setEditorText(note.text); setIsEditorOpen(true); };

  const handleSaveNote = async () => {
    if (!editorText.replace(/(<([^>]+)>)/gi, "").trim() && !editorTitle.trim()) return;
    const payload = { title: editorTitle, text: editorText };
    try {
      if (editingNoteId) {
        try {
          const res = await axios.put(`${API_BASE}/notes/${editingNoteId}`, payload, { headers: getHeaders() });
          setNotes(notes.map(n => n.id === editingNoteId ? (res.data.note || { ...n, ...payload }) : n));
        } catch (putErr) {
          await axios.delete(`${API_BASE}/notes/${editingNoteId}`, { headers: getHeaders() });
          const res = await axios.post(`${API_BASE}/notes`, payload, { headers: getHeaders() });
          setNotes([res.data.note, ...notes.filter(n => n.id !== editingNoteId)]);
        }
      } else {
        const res = await axios.post(`${API_BASE}/notes`, payload, { headers: getHeaders() });
        setNotes([res.data.note, ...notes]);
      }
      setIsEditorOpen(false); setEditorTitle(''); setEditorText('');
    } catch (err) { console.error("Failed to save note", err); }
  };

  const handleDeleteNote = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_BASE}/notes/${id}`, { headers: getHeaders() });
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) { console.error("Failed to delete", err); }
  };

  return (
    <div className="w-full h-full animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all">
             <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">Notes {isPersonal && <Lock size={16} className="text-blue-500" />}</h1>
            <p className="text-xs text-zinc-500">{isPersonal ? 'Encrypted Mind Palace' : 'Global Work Notes'}</p>
          </div>
        </div>
        <button onClick={handleOpenNewNote} className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-colors">
          <Plus size={16} /> New Note
        </button>
      </div>

      {loading ? (
         <div className="flex justify-center mt-20"><div className="w-8 h-8 border-4 border-zinc-800 border-t-zinc-400 rounded-full animate-spin"></div></div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-600 bg-[#18181b] border border-zinc-800 rounded-3xl border-dashed">
          <StickyNote size={36} className="mb-3 opacity-30" />
          <p className="font-medium">No notes found.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
          {notes.map((note) => (
            <div key={note.id} onClick={() => handleOpenEditNote(note)} className="bg-[#18181b] border border-zinc-800/80 p-5 rounded-2xl break-inside-avoid hover:border-zinc-600 transition-all group cursor-pointer shadow-sm min-h-[120px] flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-100 mb-2 truncate">{note.title || 'Untitled Document'}</h3>
                <div className="text-zinc-400 text-sm leading-relaxed line-clamp-4 prose-invert [&>p]:mb-2 [&>ul]:list-disc [&>ul]:ml-4" dangerouslySetInnerHTML={{ __html: note.text }} />
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/30 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{new Date(note.timestamp).toLocaleDateString()}</span>
                <button onClick={(e) => handleDeleteNote(note.id, e)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0b] text-zinc-100 flex flex-col animate-in zoom-in-95 duration-200">
           <style>{`.quill { display: flex; flex-direction: column; flex: 1; height: 100%; } .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #27272a !important; padding: 16px 0 !important; font-family: inherit !important; } .ql-container.ql-snow { border: none !important; font-family: inherit !important; font-size: 1.125rem !important; flex: 1; overflow-y: auto; } .ql-editor { padding: 24px 0 !important; } .ql-editor.ql-blank::before { color: #52525b !important; font-style: normal !important; left: 0 !important; } .ql-snow .ql-stroke { stroke: #a1a1aa !important; } .ql-snow .ql-fill, .ql-snow .ql-stroke.ql-fill { fill: #a1a1aa !important; } .ql-snow .ql-picker { color: #a1a1aa !important; } .ql-snow .ql-picker-options { background-color: #18181b !important; border-color: #27272a !important; } .ql-snow .ql-picker-item:hover { color: #fff !important; } button:hover .ql-stroke { stroke: #fff !important; } button:hover .ql-fill { fill: #fff !important; } .ql-editor p { margin-bottom: 0.75rem; color: #e4e4e7; } .ql-editor ul, .ql-editor ol { margin-bottom: 0.75rem; color: #e4e4e7; }`}</style>
          <div className="flex items-center justify-between px-6 py-4 md:px-12 border-b border-zinc-800/80 bg-[#121214]/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsEditorOpen(false)} className="text-zinc-400 hover:text-white p-2 hover:bg-zinc-800/50 rounded-xl transition-all"><X size={20} /></button>
              <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">{editingNoteId ? 'Modify Document' : 'New Document'} {isPersonal && '(SECURE)'}</span>
            </div>
            <button onClick={handleSaveNote} disabled={!editorText.replace(/(<([^>]+)>)/gi, "").trim() && !editorTitle.trim()} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors shadow-lg disabled:opacity-40">Save Matrix</button>
          </div>
          <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-4 md:py-8 flex flex-col h-full">
            <input type="text" placeholder="Title" value={editorTitle} onChange={(e) => setEditorTitle(e.target.value)} className="w-full bg-transparent text-3xl md:text-4xl font-bold text-white placeholder:text-zinc-700 focus:outline-none mb-2 px-4" />
            <ReactQuill theme="snow" value={editorText} onChange={setEditorText} placeholder="Start writing..." modules={{ toolbar: [[{ 'header': [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['clean']] }} />
          </div>
        </div>
      )}
    </div>
  );
};

// 🟢 THE WINDOWS EXPLORER WRAPPER
const FileManager = ({ isPersonal }) => {
  const activeUser = localStorage.getItem('vorlan_username') || 'Administrator';
  const [currentFolder, setCurrentFolder] = useState(null); 

  if (currentFolder === 'notes') return <NotesApp isPersonal={isPersonal} activeUser={activeUser} onBack={() => setCurrentFolder(null)} />;
  if (currentFolder) return <UniversalDrive folderType={currentFolder} isPersonal={isPersonal} activeUser={activeUser} onBack={() => setCurrentFolder(null)} />;

  return (
    <div className="w-full h-full animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2 flex items-center gap-3">
          {isPersonal ? 'Personal Vault' : 'Quick Access'} {isPersonal && <Lock size={20} className="text-blue-500" />}
        </h1>
        <p className="text-sm text-zinc-400">{isPersonal ? `Encrypted sectors for ${activeUser}` : 'Global network partitions'}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div onClick={() => setCurrentFolder('documents')} className="bg-[#18181b] border border-zinc-800/80 hover:border-zinc-500 p-6 rounded-3xl cursor-pointer transition-all hover:shadow-xl group">
          <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Folder size={28} className="text-blue-500" fill="currentColor" fillOpacity={0.2} />
          </div>
          <h3 className="font-bold text-white text-lg">Documents</h3>
          <p className="text-xs text-zinc-500 mt-1 font-medium">PDF, Word, Excel</p>
        </div>

        <div onClick={() => setCurrentFolder('music')} className="bg-[#18181b] border border-zinc-800/80 hover:border-zinc-500 p-6 rounded-3xl cursor-pointer transition-all hover:shadow-xl group">
          <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Music size={28} className="text-purple-500" fill="currentColor" fillOpacity={0.2} />
          </div>
          <h3 className="font-bold text-white text-lg">Music</h3>
          <p className="text-xs text-zinc-500 mt-1 font-medium">MP3, WAV Audio</p>
        </div>

        <div onClick={() => setCurrentFolder('gallery')} className="bg-[#18181b] border border-zinc-800/80 hover:border-zinc-500 p-6 rounded-3xl cursor-pointer transition-all hover:shadow-xl group">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ImageIcon size={28} className="text-emerald-500" fill="currentColor" fillOpacity={0.2} />
          </div>
          <h3 className="font-bold text-white text-lg">Gallery</h3>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Photos & Videos</p>
        </div>

        <div onClick={() => setCurrentFolder('notes')} className="bg-[#18181b] border border-zinc-800/80 hover:border-zinc-500 p-6 rounded-3xl cursor-pointer transition-all hover:shadow-xl group">
          <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <StickyNote size={28} className="text-yellow-500" fill="currentColor" fillOpacity={0.2} />
          </div>
          <h3 className="font-bold text-white text-lg">Notes</h3>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Text Documents</p>
        </div>
      </div>
    </div>
  );
};

const GlobalFilesView = () => (
  <div className="p-6 md:p-10 text-zinc-100 max-w-7xl mx-auto h-full overflow-y-auto">
    <FileManager isPersonal={false} />
  </div>
);

// 🟢 THE UPDATED PERSONAL VAULT WRAPPER
const PersonalVaultView = () => {
  const activeUser = localStorage.getItem('vorlan_username') || 'Administrator';
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [setupStep, setSetupStep] = useState(0); 
  const [firstPin, setFirstPin] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/personal/has-pin/${activeUser}`)
      .then(res => setHasPin(res.data.hasPin))
      .catch(err => console.error("Vault check offline", err))
      .finally(() => setLoading(false));
  }, [activeUser]);

  const handlePinPress = (num) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      if (newPin.length === 6) {
        if (!hasPin) {
          if (setupStep === 1) {
            setFirstPin(newPin); setTimeout(() => { setPin(''); setSetupStep(2); }, 300);
          } else if (setupStep === 2) {
            if (newPin === firstPin) { verifyOrSetPin(newPin); } else {
              setError('PASSCODES DO NOT MATCH');
              setTimeout(() => { setPin(''); setFirstPin(''); setSetupStep(1); }, 1500);
            }
          }
        } else { verifyOrSetPin(newPin); }
      }
    }
  };

  const verifyOrSetPin = async (completedPin) => {
    try {
      const res = await axios.post(`${API_BASE}/personal/pin`, { username: activeUser, pin: completedPin });
      if (res.data.success) setIsUnlocked(true);
    } catch (err) { setError('INCORRECT PASSCODE'); setTimeout(() => setPin(''), 1000); }
  };

  if (loading) return <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0b] z-10"><div className="w-10 h-10 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div></div>;

  if (!isUnlocked && !hasPin && setupStep === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#0a0a0b] z-10 overflow-y-auto animate-in fade-in">
        <div className="flex flex-col items-center max-w-lg w-full py-10 text-center border border-zinc-800/80 bg-[#18181b]/50 p-8 md:p-12 rounded-3xl shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20"><Lock size={32} className="text-blue-500" /></div>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">Vault Initialization</h2>
          <p className="text-sm md:text-base text-zinc-400 mb-8 leading-relaxed">Welcome to your encrypted sector. Data stored within this partition is cryptographically isolated from the VORLAN global network.</p>
          <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl mb-8 w-full text-left">
            <h3 className="text-red-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2 mb-2"><AlertCircle size={16} /> Security Advisory</h3>
            <p className="text-xs md:text-sm text-red-200/80 leading-relaxed font-medium">You are required to establish a 6-digit Master PIN. VORLAN Administrators <span className="underline decoration-red-500">cannot</span> bypass this passcode. Memorization is mandatory.</p>
          </div>
          <button onClick={() => setSetupStep(1)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.2)]">Acknowledge & Set Passcode</button>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    let padTitle = 'Enter Passcode'; let padSubtitle = 'Enter your 6-digit PIN to access your encrypted personal vault.';
    if (!hasPin) { padTitle = setupStep === 1 ? 'Create Passcode' : 'Confirm Passcode'; padSubtitle = setupStep === 1 ? 'Enter a new 6-digit PIN.' : 'Re-enter your 6-digit PIN to verify.'; }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#0a0a0b] z-10 overflow-y-auto animate-in fade-in">
        <div className="flex flex-col items-center max-w-sm w-full py-10">
          <Lock size={48} className="text-blue-500 mb-6" />
          <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">{padTitle}</h2>
          <p className="text-sm text-zinc-400 mb-10 text-center px-4">{padSubtitle}</p>
          <div className="flex gap-4 mb-12">
            {[...Array(6)].map((_, i) => <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${pin.length > i ? 'bg-white border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-zinc-700 bg-transparent'}`} />)}
          </div>
          <div className="h-6 mb-6 flex items-center justify-center">{error && <p className="text-red-500 text-sm font-bold tracking-widest animate-pulse uppercase">{error}</p>}</div>
          <div className="grid grid-cols-3 gap-x-8 gap-y-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => <button key={num} onClick={() => handlePinPress(num.toString())} className="w-16 h-16 rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-3xl font-medium text-white">{num}</button>)}
            <div />
            <button onClick={() => handlePinPress('0')} className="w-16 h-16 rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-3xl font-medium text-white">0</button>
            <button onClick={() => setPin(pin.slice(0, -1))} className="w-16 h-16 rounded-full flex items-center justify-center text-zinc-500 hover:text-white"><X size={28} /></button>
          </div>
        </div>
      </div>
    );
  }

  // 🟢 IF UNLOCKED, BOOT UP THE OS FILE EXPLORER IN PERSONAL MODE!
  return (
    <div className="absolute inset-0 p-6 md:p-10 text-zinc-100 bg-[#0a0a0b] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="max-w-7xl mx-auto h-full">
        <FileManager isPersonal={true} />
      </div>
    </div>
  );
};



const CameraFeed = () => {
  const [time, setTime] = useState(new Date());
  
  // 🟢 The Brains: Loads saved camera URL from local storage
  const [camUrl, setCamUrl] = useState(localStorage.getItem('vorlan_cam') || '');
  const [inputUrl, setInputUrl] = useState('');
  const [isEditing, setIsEditing] = useState(!localStorage.getItem('vorlan_cam'));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveCamera = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setCamUrl(inputUrl);
    localStorage.setItem('vorlan_cam', inputUrl); // Locks it in for Tuesday
    setIsEditing(false);
  };

  const handleReset = () => {
    setIsEditing(true);
    setInputUrl(camUrl);
  };

  return (
    <div className="p-4 md:p-10 text-zinc-100 h-full flex flex-col max-w-7xl mx-auto w-full">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-semibold tracking-tight">Active Surveillance</h1>
           <p className="text-sm text-zinc-400 mt-1">Security Camera Node Link</p>
        </div>
        
        {/* Dynamic Status Badge */}
        {!isEditing && camUrl ? (
          <div 
            className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-xs font-bold tracking-wider flex items-center gap-2 w-max cursor-pointer hover:bg-red-500/20 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
            onClick={handleReset}
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
            SYSTEM LIVE (TAP TO RECONFIG)
          </div>
        ) : (
          <div className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-bold tracking-wider flex items-center gap-2 w-max">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            AWAITING CAM UPLINK
          </div>
        )}
      </div>

      <div className="flex-1 w-full bg-black rounded-3xl overflow-hidden relative border border-zinc-800 shadow-2xl flex items-center justify-center min-h-[500px]">
        
        {isEditing ? (
          // 🟢 THE CONFIGURATION UI
          <div className="z-30 bg-[#18181b] p-8 rounded-2xl border border-zinc-800 shadow-2xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Configure DroidCam Optics</h3>
            <p className="text-xs text-zinc-400 mb-6">Enter the IP address from the Cam app and append /video.</p>
            <form onSubmit={handleSaveCamera} className="flex gap-2">
              <input 
                type="text" 
                placeholder="http://192.168.137.69:4747/video"
                className="flex-1 bg-[#0a0a0b] border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                Connect
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* 🟢 THE REAL LIVE FEED */}
            <div className="absolute top-6 left-6 z-10 font-mono text-xs md:text-sm text-white/90 drop-shadow-lg tracking-widest font-bold">
              CAM 01 // MOBILE NODE // REC
            </div>
            
            <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-1 font-mono text-xs md:text-sm text-white/90 drop-shadow-lg font-bold">
              <span>{time.toLocaleDateString().toUpperCase()}</span>
              <span>{time.toLocaleTimeString()}</span>
            </div>

            <img 
              src={camUrl} 
              alt="Live Surveillance"
              className="w-full h-full object-cover filter contrast-125 saturate-50 brightness-90"
            />
            
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] z-20 mix-blend-overlay"></div>
          </>
        )}
      </div>
    </div>
  );
};



const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 🟢 Grabs the dynamic user data
  const activeUser = localStorage.getItem('vorlan_username') || 'Administrator';
  
  // 🟢 CLOUD PFP MATRIX
  const [profilePic, setProfilePic] = useState(null);
  const pfpInputRef = useRef(null);

  // 1. Fetch the synced profile picture from the backend on load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_BASE}/profile/${activeUser}`);
        if (res.data.pfp) {
          setProfilePic(res.data.pfp);
        }
      } catch (err) {
        console.warn("Profile sync offline", err);
      }
    };
    fetchProfile();
  }, [activeUser]);

  // 2. Upload and sync to the entire network
  const handlePfpUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        setProfilePic(base64String); // Updates the UI instantly
        
        try {
          // Blasts it to the Node.js server so all devices see it
          await axios.post(`${API_BASE}/profile/${activeUser}`, { pfp: base64String });
        } catch (err) {
          console.error("Failed to sync profile to cloud", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vorlan_token');
    localStorage.removeItem('vorlan_role');
    localStorage.removeItem('vorlan_username'); 
    navigate('/login');
  };


const navItems = [
    { id: 'ai', label: 'Assistant', icon: MessageSquare, path: '/dashboard/ai' },
    { id: 'files', label: 'Files', icon: Folder, path: '/dashboard/files' },
    { id: 'personal', label: 'Personal Vault', icon: Lock, path: '/dashboard/personal' },
    { id: 'cameras', label: 'Cameras', icon: Video, path: '/dashboard/cameras' }
  ];
 

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0a0a0b] md:bg-[#121214] border-r border-zinc-800 w-72 text-zinc-300 transition-all">
      <div className="p-8 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/20 overflow-hidden bg-white">
            <img src="/logo.jpeg" alt="VORLAN" className="w-full h-full object-contain p-0.5" />
          </div>
          VORLAN
        </h2>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-1">
        <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Workspace</p>
        {navItems.map((item) => {
          const isActive = location.pathname.includes(item.path);
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' 
                  : 'hover:bg-zinc-800/30 hover:text-zinc-100 text-zinc-400'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-blue-400' : 'text-zinc-500'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-zinc-800/50">
        <div className="flex items-center gap-4 px-2 mb-6">
           
           <input 
             type="file" 
             accept="image/*" 
             className="hidden" 
             ref={pfpInputRef} 
             onChange={handlePfpUpload} 
           />
           
           <div 
             onClick={() => pfpInputRef.current.click()}
             className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 cursor-pointer overflow-hidden relative group hover:border-blue-500 transition-all flex-shrink-0 shadow-sm"
             title="Change Profile Picture"
           >
             {profilePic ? (
               <img src={profilePic} alt={activeUser} className="w-full h-full object-cover" />
             ) : (
               <User size={18} className="text-zinc-400 group-hover:text-blue-400 transition-colors" />
             )}
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <Plus size={16} className="text-white" />
             </div>
           </div>

           <div className="truncate">
             <p className="text-sm font-semibold text-zinc-100 truncate">{activeUser}</p>
           </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all border border-zinc-800 hover:border-zinc-700"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0b] overflow-hidden selection:bg-blue-500/30">
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-zinc-800 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 font-bold text-white tracking-tight">
           <div className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden bg-white">
             <img src="/logo.jpeg" alt="VORLAN" className="w-full h-full object-contain p-[2px]" />
           </div>
           VORLAN
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-zinc-300 p-2 rounded-lg hover:bg-zinc-800 transition-colors">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="hidden md:block">
        <SidebarContent />
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute top-16 bottom-0 left-0 w-72 shadow-2xl" onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

    <div className="flex-1 relative mt-16 md:mt-0 overflow-y-auto overflow-x-hidden bg-[#0a0a0b]">
        <Routes>
          <Route path="ai" element={<ChatInterface />} />
          
          {/* 🟢 THE NEW ROUTES */}
          <Route path="files" element={<GlobalFilesView />} />
          <Route path="personal" element={<PersonalVaultView />} />
          
          <Route path="cameras" element={<CameraFeed />} />
          <Route path="" element={<Navigate to="ai" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/ai" replace />} />
      <Route path="/login" element={<AuthView isLogin={true} />} />
      <Route path="/signup" element={<AuthView isLogin={false} />} />
      <Route path="/dashboard/*" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      } />
    </Routes>
  );
}