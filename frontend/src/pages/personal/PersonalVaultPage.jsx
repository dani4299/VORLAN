import React, { useState, useEffect } from 'react';
import api, { getUsername, VAULT_LOCKED_EVENT } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { TextField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { FileManager } from '../files/FileManager';

const PIN_LENGTH = 6;

/** Sets up, then unlocks, a person's private space. Their PIN is never shown or stored here; it is sent to the server to check. */
export const PersonalVaultPage = () => {
  const activeUser = getUsername();
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [setupStep, setSetupStep] = useState(0); // 0 intro, 1 choose a PIN, 2 confirm it
  const [firstPin, setFirstPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);

  const checkPin = () => {
    setLoading(true);
    setLoadError(null);
    api.get(`/personal/has-pin/${activeUser}`)
      .then((res) => setHasPin(res.data.hasPin))
      .catch((err) => setLoadError(err.response?.data?.error || "Couldn't check your private space."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { checkPin(); }, [activeUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // The server relocks the vault after a quiet spell: show the PIN screen again instead of a page of failed requests.
  useEffect(() => {
    const relock = () => { setIsUnlocked(false); setPin(''); setError('Your private space locked itself. Enter your PIN to open it again.'); };
    window.addEventListener(VAULT_LOCKED_EVENT, relock);
    return () => window.removeEventListener(VAULT_LOCKED_EVENT, relock);
  }, []);

  const onPinChange = (e) => {
    setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) { setError(`Enter all ${PIN_LENGTH} digits.`); return; }

    if (!hasPin) {
      if (setupStep === 1) { setFirstPin(pin); setPin(''); setSetupStep(2); return; }
      if (pin !== firstPin) {
        setError("Those PINs don't match. Choose a PIN again.");
        setPin('');
        setFirstPin('');
        setSetupStep(1);
        return;
      }
    }

    setBusy(true);
    try {
      const res = await api.post('/personal/pin', { username: activeUser, pin });
      if (res.data.success) setIsUnlocked(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect PIN.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Spinner label="Checking your private space" /></div>;
  if (loadError) return <div className="p-6"><ErrorState message={loadError} onRetry={checkPin} /></div>;

  if (isUnlocked) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto h-full overflow-y-auto">
        <FileManager isPersonal />
      </div>
    );
  }

  if (!hasPin && setupStep === 0) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-6">
        <div className="surface-strong rounded-[var(--radius-xl)] p-6 w-full max-w-md">
          <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">Set up your private space</h1>
          <p className="text-sm text-[var(--ink-muted)] mb-4">Files and notes you keep here are private to you. Protect them with a {PIN_LENGTH}-digit PIN.</p>
          <p className="text-sm text-[var(--ink)] mb-5 pl-3 border-l-2 border-[var(--warning)]">
            <strong className="font-semibold">Remember your PIN.</strong> Not even an administrator can unlock your private space without it, and if you forget it these files can't be recovered.
          </p>
          <Button size="lg" className="w-full" onClick={() => setSetupStep(1)}>Continue</Button>
        </div>
      </div>
    );
  }

  const title = hasPin ? 'Unlock your private space' : setupStep === 1 ? 'Choose a PIN' : 'Confirm your PIN';
  const hint = hasPin ? undefined : setupStep === 1 ? `Use ${PIN_LENGTH} digits.` : 'Enter the same PIN again.';

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center p-6">
      <form onSubmit={submit} className="surface-strong rounded-[var(--radius-xl)] p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-[var(--ink)]">{title}</h1>
        <TextField
          label={`${PIN_LENGTH}-digit PIN`}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={onPinChange}
          error={error}
          hint={hint}
          autoFocus
          required
        />
        <Button type="submit" size="lg" className="w-full" loading={busy}>{hasPin ? 'Unlock' : setupStep === 1 ? 'Continue' : 'Set PIN'}</Button>
      </form>
    </div>
  );
};
