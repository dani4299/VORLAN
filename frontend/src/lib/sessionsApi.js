import api, { authHeaders } from './api';

/** Every live sign-in on this account, newest activity first; the one making the request has `current: true`. */
export const listMySessions = () => api.get('/auth/sessions', { headers: authHeaders() }).then((r) => r.data.sessions);
export const endMySession = (id) => api.delete(`/auth/sessions/${id}`, { headers: authHeaders() });
/** Ends the account's sign-ins on other devices, leaving this one signed in. Resolves how many ended. */
export const signOutOtherDevices = () => api.post('/auth/logout-all', { keepCurrent: true }, { headers: authHeaders() }).then((r) => r.data.ended);
export const changePassword = (currentPassword, newPassword) => api.post('/auth/password', { currentPassword, newPassword }, { headers: authHeaders() }).then((r) => r.data);
