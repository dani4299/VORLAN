import axios from 'axios';

// The app and its API are one origin: in an installed copy the backend serves the site itself, and the
// dev server proxies these two prefixes (see vite.config.js). Relative paths mean the page's own scheme
// and host are used - so HTTPS on a LAN address just works, with no address written into the code.
export const API_BASE = '/api';
export const MEDIA_BASE = '/media';

const TOKEN_KEY = 'vorlan_token';
const REFRESH_KEY = 'vorlan_refresh';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
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

/**
 * Headers for a call. Requests made through `api` have the newest token put on them again just before
 * they leave (see below), so a call retried after a silent renewal never goes out with a stale one.
 */
export const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${getToken()}`,
  'X-Device-Id': getDeviceId(),
  ...extra,
});

/** Stores a fresh sign-in: a short-lived access token plus the longer-lived token that renews it. */
export const login = (token, role, username, refreshToken) => {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
  localStorage.setItem('vorlan_role', role || 'user');
  localStorage.setItem('vorlan_username', username);
};

/** Applies renewed tokens/username after an in-session update, without a full re-login. */
export const updateSession = ({ token, refreshToken, username }) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (username) localStorage.setItem('vorlan_username', username);
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('vorlan_role');
  localStorage.removeItem('vorlan_username');
};

/**
 * Signs out here and on the server (so the sign-in can't be used again from anywhere). The local
 * copy is cleared at once - the request is only a courtesy that must survive the page navigating away.
 */
export const logout = () => {
  const token = getToken();
  const refreshToken = getRefreshToken();
  clearSession();
  if (!token && !refreshToken) return;
  fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {});
};

/** Keeps the stored role in step after an admin changes it, so the UI matches what the server will allow. */
export const setRole = (role) => localStorage.setItem('vorlan_role', role);

let leaving = false;
/** The server ended this sign-in (signed out elsewhere, account removed, password changed): back to the sign-in screen. */
const endSession = () => {
  clearSession();
  if (leaving || window.location.pathname === '/login') return;
  leaving = true;
  window.location.assign('/login');
};

/** Fired when the server says the Personal Vault has relocked (no activity for a while). */
export const VAULT_LOCKED_EVENT = 'vorlan:vault-locked';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One renewal at a time: a page firing ten requests as the token lapses must trade the refresh token once,
// not ten times (each trade replaces it). Other tabs doing the same are handled by the conflict path below.
let renewal = null;

const renew = async () => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw Object.assign(new Error('Signed out'), { ended: true });
    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken }, { headers: { 'X-Device-Id': getDeviceId() } });
      updateSession({ token: data.token, refreshToken: data.refreshToken });
      return data.token;
    } catch (err) {
      if (err.response?.status === 409) {
        // Another tab renewed at the same moment. Give it a beat to save the new pair, then use that.
        await sleep(200 * (attempt + 1));
        if (getRefreshToken() !== refreshToken) return getToken();
        continue;
      }
      if (err.response?.status === 401) throw Object.assign(err, { ended: true });
      throw err;
    }
  }
  throw new Error('Could not renew the sign-in.');
};

const renewOnce = () => {
  if (!renewal) renewal = renew().finally(() => { renewal = null; });
  return renewal;
};

const api = axios.create({ baseURL: API_BASE });

// Always send the newest token, whatever the caller built the headers from. The device id goes on every call
// (sign-in included), so the server can tell which of your devices each sign-in belongs to.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  config.headers.set('X-Device-Id', getDeviceId());
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const code = response?.status === 401 ? response.data?.code : null;

    if (code === 'token_expired' && config && !config._renewed && getRefreshToken()) {
      config._renewed = true;
      const sent = String(config.headers?.Authorization || config.headers?.get?.('Authorization') || '').replace('Bearer ', '');
      try {
        // Another request may already have renewed while this one was in flight.
        if (!sent || sent === getToken()) await renewOnce();
        return api.request(config);
      } catch (renewError) {
        if (renewError.ended) endSession();
        return Promise.reject(renewError.ended ? error : renewError);
      }
    }

    // The Personal Vault relocks itself after a quiet spell; the page showing it needs to go back to its PIN screen.
    if (response?.status === 403 && response.data?.code === 'vault_locked') window.dispatchEvent(new Event(VAULT_LOCKED_EVENT));

    if (code === 'session_ended' || (code === 'token_expired' && !getRefreshToken())) {
      if (getToken()) endSession();
    }
    return Promise.reject(error);
  }
);

/**
 * fetch() with the sign-in handled the same way as `api` - used where the response is a stream that axios
 * can't deliver (the assistant's answer arrives word by word). Path is relative to the API.
 */
export const authedFetch = async (path, init = {}) => {
  const send = () => fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, ...authHeaders() },
  });
  let res = await send();
  if (res.status !== 401) return res;

  const body = await res.clone().json().catch(() => null);
  if (body?.code === 'token_expired' && getRefreshToken()) {
    try {
      await renewOnce();
      res = await send();
    } catch (err) {
      if (err.ended) endSession();
      throw err;
    }
  } else if (body?.code === 'session_ended') {
    endSession();
  }
  return res;
};

export default api;
