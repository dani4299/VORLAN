import api, { API_BASE, authHeaders } from './api';

export const listDir = (relPath) => api.get('/explorer/list', { params: { path: relPath }, headers: authHeaders() }).then((r) => r.data.entries);
export const getRecent = () => api.get('/explorer/recent', { headers: authHeaders() }).then((r) => r.data.files);
export const search = (q) => api.get('/explorer/search', { params: { q }, headers: authHeaders() }).then((r) => r.data.results);
export const createFolder = (relPath, name) => api.post('/explorer/folder', { path: relPath, name }, { headers: authHeaders() });
export const deleteItem = (relPath) => api.delete('/explorer/item', { params: { path: relPath }, headers: authHeaders() });
export const renameItem = (relPath, newName) => api.patch('/explorer/item', { path: relPath, newName }, { headers: authHeaders() });
export const copyItem = (from, to) => api.post('/explorer/copy', { from, to }, { headers: authHeaders() });
export const moveItem = (from, to) => api.post('/explorer/move', { from, to }, { headers: authHeaders() });
export const downloadUrl = (relPath) => `${API_BASE}/explorer/download?path=${encodeURIComponent(relPath)}`;

export const uploadFile = (relPath, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/explorer/upload', formData, {
    params: { path: relPath },
    headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
  });
};

export const joinPath = (...parts) => parts.filter(Boolean).join('/');
