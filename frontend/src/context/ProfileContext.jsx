import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import api, { authHeaders, getUsername, updateSession } from '../lib/api';
import { mergeDashboardLayout } from '../lib/dashboardTiles';

const ProfileContext = createContext(null);

export const useProfile = () => useContext(ProfileContext);

/** Holds the signed-in user's profile picture, account details, and dashboard layout, synced to the backend and shared across the app. */
export const ProfileProvider = ({ children }) => {
  const [username, setUsernameState] = useState(getUsername());
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePic, setProfilePicState] = useState(null);
  const [dashboardLayout, setDashboardLayoutState] = useState(null);
  const pfpInputRef = useRef(null);

  useEffect(() => {
    api.get(`/profile/${username}`, { headers: authHeaders() })
      .then((res) => {
        setProfilePicState(res.data.pfp || null);
        if (res.data.dashboardLayout) {
          setDashboardLayoutState(res.data.dashboardLayout);
        }
      })
      .catch((err) => console.warn("Couldn't load profile", err));

    api.get('/auth/account', { headers: authHeaders() })
      .then((res) => {
        setFullName(res.data.fullName || '');
        setEmail(res.data.email || '');
      })
      .catch((err) => console.warn("Couldn't load account details", err));
  }, [username]);

  const setProfilePic = async (base64String) => {
    setProfilePicState(base64String);
    try {
      await api.post(`/profile/${username}`, { pfp: base64String }, { headers: authHeaders() });
    } catch (err) {
      console.error('Failed to sync profile picture', err);
    }
  };

  const removeProfilePic = () => setProfilePic(null);

  /**
   * Accepts either a next layout or an updater `(prevMergedLayout) => nextLayout`. The updater form
   * always applies on top of the latest state via React's functional setState, so rapid successive
   * edits (e.g. removing two tiles in quick succession) can't silently clobber each other with a
   * stale snapshot.
   */
  const setDashboardLayout = (updater) => {
    setDashboardLayoutState((prevRaw) => {
      const next = typeof updater === 'function' ? updater(mergeDashboardLayout(prevRaw)) : updater;
      api.post(`/profile/${username}`, { dashboardLayout: next }, { headers: authHeaders() })
        .catch((err) => console.error('Failed to sync dashboard layout', err));
      return next;
    });
  };

  const triggerPfpUpload = () => pfpInputRef.current?.click();

  const handlePfpFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfilePic(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /** Updates username and/or full name. Username changes cascade server-side and are reflected here on success. Returns { ok, error }. */
  const updateAccount = async ({ username: nextUsername, fullName: nextFullName }) => {
    try {
      const res = await api.patch('/auth/account', { username: nextUsername, fullName: nextFullName }, { headers: authHeaders() });
      updateSession({ token: res.data.token, username: res.data.username });
      setUsernameState(res.data.username);
      setFullName(res.data.fullName || '');
      setEmail(res.data.email || '');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || 'Failed to update account.' };
    }
  };

  return (
    <ProfileContext.Provider value={{
      username, fullName, email, profilePic, dashboardLayout,
      setDashboardLayout, triggerPfpUpload, removeProfilePic, updateAccount,
    }}>
      <input type="file" accept="image/*" className="hidden" ref={pfpInputRef} onChange={handlePfpFileChange} />
      {children}
    </ProfileContext.Provider>
  );
};
