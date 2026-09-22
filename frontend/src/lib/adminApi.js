import api, { authHeaders } from './api';

const get = (url, params) => api.get(url, { params, headers: authHeaders() }).then((r) => r.data);

export const getOverview = () => get('/admin/overview');

export const listUsers = () => get('/admin/users').then((d) => d.users);
export const createUser = (user) => api.post('/admin/users', user, { headers: authHeaders() }).then((r) => r.data.user);
export const changeUserRole = (id, role) => api.patch(`/admin/users/${id}/role`, { role }, { headers: authHeaders() });
export const resetUserPassword = (id, password) => api.post(`/admin/users/${id}/password`, { password }, { headers: authHeaders() });
export const deleteUser = (id) => api.delete(`/admin/users/${id}`, { headers: authHeaders() });

export const listAllDevices = () => get('/admin/devices').then((d) => d.devices);
export const removeDevice = (userId, deviceId) => api.delete(`/admin/devices/${userId}/${deviceId}`, { headers: authHeaders() });

/** Every live sign-in across all accounts. */
export const listSessions = () => get('/admin/sessions').then((d) => d.sessions);
export const signUserOut = (id) => api.delete(`/admin/users/${id}/sessions`, { headers: authHeaders() }).then((r) => r.data.ended);
export const signDeviceOut = (userId, deviceId) => api.delete(`/admin/devices/${userId}/${deviceId}/sessions`, { headers: authHeaders() }).then((r) => r.data.ended);

export const listTasks = () => get('/admin/tasks').then((d) => d.tasks);

/** { entries, hasMore }. `beforeId` continues from the last entry you have. */
export const listAuditLog = ({ category, q, beforeId, limit = 100 } = {}) => get('/admin/audit-log', { category, q, beforeId, limit });

export const getMetricsLive = (seconds = 900) => get('/admin/metrics/live', { seconds });
export const getMetricsHistory = (range) => get('/admin/metrics/history', { range });
export const getSystemInfo = () => get('/admin/system/info');
export const getProcesses = (limit = 15) => get('/admin/system/processes', { limit });

export const getStorage = () => get('/admin/storage');
/** `quotaGb` is null to clear the quota, or a number of gigabytes; snapshot fields are optional. */
export const updateDataset = (key, changes) => api.patch(`/admin/storage/datasets/${key}`, changes, { headers: authHeaders() }).then((r) => r.data.dataset);
export const listSnapshots = (key) => get(`/admin/storage/datasets/${key}/snapshots`).then((d) => d.snapshots);
export const takeSnapshot = (key) => api.post(`/admin/storage/datasets/${key}/snapshots`, {}, { headers: authHeaders() }).then((r) => r.data.snapshot);
export const deleteSnapshot = (id) => api.delete(`/admin/storage/snapshots/${id}`, { headers: authHeaders() });
export const restoreSnapshot = (id) => api.post(`/admin/storage/snapshots/${id}/restore`, {}, { headers: authHeaders() }).then((r) => r.data);
export const getServices = () => get('/admin/system/services');
export const getNetwork = () => get('/admin/system/network');
export const getSecurity = () => get('/admin/system/security');
export const getAbout = () => get('/admin/system/about');

/** The diagnostics bundle as a downloadable file. Needs the auth header, so it can't be a plain link. */
export const downloadDiagnostics = async () => {
  const res = await api.get('/admin/system/diagnostics', { headers: authHeaders(), responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || 'vorlan-diagnostics.json';
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return name;
};

// ---- App Store ----

export const getAppsStatus = () => get('/admin/apps/status');
export const listAppCatalog = () => get('/admin/apps/catalog').then((d) => d.catalog);
export const listApps = () => get('/admin/apps').then((d) => d.apps);
export const installApp = (body) => api.post('/admin/apps', body, { headers: authHeaders() }).then((r) => r.data.app);
export const startApp = (id) => api.post(`/admin/apps/${id}/start`, {}, { headers: authHeaders() }).then((r) => r.data.app);
export const stopApp = (id) => api.post(`/admin/apps/${id}/stop`, {}, { headers: authHeaders() }).then((r) => r.data.app);
export const uninstallApp = (id, removeData) => api.delete(`/admin/apps/${id}`, { params: { removeData }, headers: authHeaders() });
export const getAppLogs = (id) => get(`/admin/apps/${id}/logs`).then((d) => d.logs);

/** The message to show for a failed admin request: the server's own words when it sent any. */
export const errorMessage = (err, fallback) => err?.response?.data?.error || fallback;
