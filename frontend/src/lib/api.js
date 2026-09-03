import axios from 'axios';

const currentIP = window.location.hostname;
export const API_BASE = `http://${currentIP}:5000/api`;
export const MEDIA_BASE = `http://${currentIP}:5000/media`;

export const getToken = () => localStorage.getItem('vorlan_token');
export const getUsername = () => localStorage.getItem('vorlan_username') || 'Administrator';

export const isAuthenticated = () => !!getToken();

/** A random id generated once per browser and persisted, so the backend can tell "this device" apart from others for the Connected Devices settings page. */
export const getDeviceId = () => {
  let id = localStorage.getItem('vorlan_device_id');
  if (!id) {
    id = crypto.randomUUID();
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

const api = axios.create({ baseURL: API_BASE });

export default api;
