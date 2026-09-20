import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { createUser, deleteUser, errorMessage, resetUserPassword } from '../../lib/adminApi';

export const MIN_PASSWORD_LENGTH = 8;

/** A form-level error. The dialog scrolls on a short screen, so the message is brought into view when it appears. */
const FormError = ({ message }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [message]);
  return message ? <p ref={ref} role="alert" className="text-sm text-[var(--danger)]">{message}</p> : null;
};

const passwordProblem = (password) => (password.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : null);

const Actions = ({ onCancel, submitLabel, busy, tone = 'primary', disabled = false }) => (
  <div className="flex justify-end gap-2 pt-2">
    <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
    <Button type="submit" variant={tone} loading={busy} disabled={disabled}>{submitLabel}</Button>
  </div>
);

/** Runs `action`, then `onDone`; a failure stays in the dialog as an inline message so the form isn't lost. */
const useSubmit = (action, onDone, fallback) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(errorMessage(err, fallback));
      setBusy(false);
    }
  };
  return { busy, error, submit };
};

export const CreateUserDialog = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '', role: 'employee' });
  const [tried, setTried] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const { busy, error, submit } = useSubmit(() => createUser(form), () => onDone(form.username.trim()), "Couldn't create the account.");
  const passwordError = tried ? passwordProblem(form.password) : null;

  const onSubmit = (event) => {
    if (passwordProblem(form.password)) {
      event.preventDefault();
      setTried(true);
      event.currentTarget.querySelector('[type="password"]').focus();
      return;
    }
    submit(event);
  };

  return (
    <Modal title="Create account" description="The person can sign in right away with this password." onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField label="Username" value={form.username} onChange={set('username')} required autoComplete="off" />
        <TextField label="Full name" value={form.fullName} onChange={set('fullName')} autoComplete="off" />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} required autoComplete="off" />
        <TextField
          label="Password" type="password" value={form.password} onChange={set('password')} required autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} error={passwordError}
        />
        <SelectField label="Role" value={form.role} onChange={set('role')}>
          <option value="guest">Guest</option>
          <option value="employee">Employee</option>
          <option value="admin">Administrator</option>
        </SelectField>
        <FormError message={error} />
        <Actions onCancel={onClose} submitLabel="Create account" busy={busy} />
      </form>
    </Modal>
  );
};

export const ResetPasswordDialog = ({ user, onClose, onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Wait until the confirmation is as long as the password, so it doesn't complain while still being typed.
  const mismatch = confirm.length >= password.length && confirm.length > 0 && password !== confirm ? "The passwords don't match." : null;
  const { busy, error, submit } = useSubmit(() => resetUserPassword(user.id, password), () => onDone(user.username), "Couldn't change the password.");

  return (
    <Modal title={`Reset password for ${user.username}`} description="They will need the new password the next time they sign in." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" error={mismatch} />
        <FormError message={error} />
        <Actions onCancel={onClose} submitLabel="Change password" busy={busy} disabled={password.length < MIN_PASSWORD_LENGTH || password !== confirm} />
      </form>
    </Modal>
  );
};

export const DeleteUserDialog = ({ user, onClose, onDone }) => {
  const [typed, setTyped] = useState('');
  const { busy, error, submit } = useSubmit(() => deleteUser(user.id), () => onDone(user.username), "Couldn't delete the account.");

  return (
    <Modal
      title={`Delete ${user.username}?`}
      description="This removes the account and its profile, notes, Personal Vault PIN, AI history and device records. It can't be undone."
      onClose={onClose}
      role="alertdialog"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-[var(--ink-muted)]">Files they saved in shared folders, and their Personal Vault files on disk, are kept.</p>
        <TextField label={`Type ${user.username} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-autofocus />
        <FormError message={error} />
        <Actions onCancel={onClose} submitLabel="Delete account" tone="danger" busy={busy} disabled={typed !== user.username} />
      </form>
    </Modal>
  );
};
