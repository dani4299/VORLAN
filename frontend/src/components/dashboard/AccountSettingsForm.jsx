import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';

/** The profile-editing form shared by the account dialog and the Settings page. */
export const AccountSettingsForm = ({ onSaved }) => {
  const { username, fullName, email, profilePic, triggerPfpUpload, removeProfilePic, updateAccount } = useProfile();
  const showToast = useToast();
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

  return (
    <div>
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full bg-[var(--overlay-2)] border border-[var(--surface-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
          {profilePic ? (
            <img src={profilePic} alt="Your profile photo" className="w-full h-full object-cover" />
          ) : (
            <User size={26} aria-hidden="true" className="text-[var(--ink-muted)]" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={triggerPfpUpload}>
            {profilePic ? 'Change photo' : 'Upload photo'}
          </Button>
          {profilePic && <Button type="button" variant="ghost" size="sm" onClick={removeProfilePic}>Remove photo</Button>}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <TextField label="Username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} required autoComplete="username" />
        <TextField label="Full name" value={fullNameInput} onChange={(e) => setFullNameInput(e.target.value)} autoComplete="name" />
        <TextField label="Email" value={email} disabled hint="The email can't be changed here." />
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" loading={saving} className="w-full">Save changes</Button>
      </form>
    </div>
  );
};
