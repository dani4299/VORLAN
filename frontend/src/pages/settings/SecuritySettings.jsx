import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { useToast } from '../../context/ToastContext';
import { changePassword } from '../../lib/sessionsApi';

const MIN_PASSWORD_LENGTH = 8;

/** Change your own password. Every other device is signed out when it changes; this one stays. */
export const SecuritySettings = () => {
  const showToast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Wait until the confirmation is as long as the password, so it doesn't complain while still being typed.
  const mismatch = confirm.length >= next.length && confirm.length > 0 && next !== confirm ? "The passwords don't match." : null;
  const ready = current && next.length >= MIN_PASSWORD_LENGTH && next === confirm;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { ended } = await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      showToast(ended ? `Password changed. ${ended} other ${ended === 1 ? 'device was' : 'devices were'} signed out.` : 'Password changed.', 'success');
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't change the password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <p className="text-sm text-[var(--ink-muted)] mb-4">Changing it signs out every other device signed in as you. This one stays signed in.</p>
      <form onSubmit={save} className="space-y-4">
        <TextField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        <TextField
          label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" error={mismatch} />
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" loading={saving} disabled={!ready} className="w-full">Change password</Button>
      </form>
    </div>
  );
};
