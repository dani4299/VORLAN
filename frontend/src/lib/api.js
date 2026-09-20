import axios from 'axios';

const currentIP = window.location.hostname;
export const API_BASE = `http://${currentIP}:5000/api`;
export const MEDIA_BASE = `http://${currentIP}:5000/media`;

export const getToken = () => localStorage.getItem('vorlan_token');
export const getUsername = () => localStorage.getItem('vorlan_username') || 'Administrator';
export const getRole = () => localStorage.getItem('vorlan_role') || 'guest';
export const isAdmin = () => getRole() === 'admin';

export const isAuthenticated = () => !!getToken();

/**
 * A random-looking id, without crypto.randomUUID() - that method is restricted to secure
 * contexts (HTTPS or localhost) and doesn't exist at all when VORLAN is opened over plain HTTP
 * at a LAN/hotspot address, which is how it's normally reached from a phone. getRandomValues()
 * has no such restriction.
 */
const generateId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** A random id generated once per browser and persisted, so the backend can tell "this device" apart from others for the Connected Devices settings page. */
export const getDeviceId = () => {
  let id = localStorage.getItem('vorlan_device_id');
  if (!id) {
    id = generateId();
    localStorage.setItem('vorlan_device_id', id);
  }
  return id;
};

export const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${getToken()}`,
  'X-Device-Id': getDeviceId(),
  ...extra,
});

export const login = (token, role, username) => {
  localStorage.setItem('vorlan_token', token);
  localStorage.setItem('vorlan_role', role || 'user');
  localStorage.setItem('vorlan_username', username);
};

/** Applies a renewed token/username after an in-session account update, without a full re-login. */
export const updateSession = ({ token, username }) => {
  if (token) localStorage.setItem('vorlan_token', token);
  if (username) localStorage.setItem('vorlan_username', username);
};

export const logout = () => {
  localStorage.removeItem('vorlan_token');
  localStorage.removeItem('vorlan_role');
  localStorage.removeItem('vorlan_username');
};

/** Keeps the stored role in step after an admin changes it, so the UI matches what the server will allow. */
export const setRole = (role) => localStorage.setItem('vorlan_role', role);

const api = axios.create({ baseURL: API_BASE });

// The server ends a session when the token has expired or the account was deleted. Whatever page
// the person is on, the useful thing is the sign-in screen, not a page full of failed requests.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response.data?.code === 'session_ended' && getToken()) {
      logout();
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
