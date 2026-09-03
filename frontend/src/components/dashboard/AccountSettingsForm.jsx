import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, X } from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { useToast } from '../../context/ToastContext';
import { logout as clearSession } from '../../lib/api';
import { Button } from '../ui/Button';

const FIELD_CLASS = 'w-full bg-[var(--overlay-1)] border border-[var(--surface-border)] rounded-2xl px-4 py-3 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/60 transition-all placeholder:text-[var(--ink-faint)]';

/** The profile-editing form shared by the quick account modal and the full Settings page. */
export const AccountSettingsForm = ({ onSaved }) => {
  const { username, fullName, email, profilePic, triggerPfpUpload, removeProfilePic, updateAccount } = useProfile();
  const showToast = useToast();
  const navigate = useNavigate();
  const [usernameInput, setUsernameInput] = useState(username);
  const [fullNameInput, setFullNameInput] = useState(fullName);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const result = await updateAccount({ username: usernameInput.trim(), fullName: fullNameInput });
    setSaving(false);
    if (result.ok) {
      showToast('Account updated.', 'success');
      onSaved?.();
    } else {
      setError(result.error);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-[var(--overlay-2)] border border-[var(--surface-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
          {profilePic ? (
            <img src={profilePic} alt={username} className="w-full h-full object-cover" />
          ) : (
            <User size={26} className="text-[var(--ink-muted)]" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={triggerPfpUpload}>
            {profilePic ? 'Change photo' : 'Upload photo'}
          </Button>
          {profilePic && (
            <button
              type="button"
              onClick={removeProfilePic}
              className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--hue-rose)] transition-colors text-left"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-2xl flex items-center gap-2 text-xs" style={{ background: 'rgba(255,100,130,0.1)', border: '1px solid rgba(255,100,130,0.25)', color: '#ff9bad' }}>
          <X size={14} className="flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--ink-muted)] mb-2 ml-1">Username</label>
          <input className={FIELD_CLASS} value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--ink-muted)] mb-2 ml-1">Full name</label>
          <input className={FIELD_CLASS} value={fullNameInput} onChange={(e) => setFullNameInput(e.target.value)} placeholder="Add your full name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--ink-muted)] mb-2 ml-1">Email</label>
          <input className={`${FIELD_CLASS} opacity-50 cursor-not-allowed`} value={email} disabled />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="primary" size="md" disabled={saving} className="w-full">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>

      <div className="mt-5 pt-5 border-t border-[var(--surface-border)]">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--hue-rose)] transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
};
