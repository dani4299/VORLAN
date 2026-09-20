import React, { useMemo, useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { WindowLayout } from '../../components/layout/WindowLayout';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { TextField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { changeUserRole, errorMessage, listUsers } from '../../lib/adminApi';
import { getUsername, setRole } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';
import { CreateUserDialog, DeleteUserDialog, ResetPasswordDialog } from './UserDialogs';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator' },
  { value: 'employee', label: 'Employee' },
  { value: 'guest', label: 'Guest' },
];

export const UsersPanel = () => {
  const showToast = useToast();
  const { data: users, error, reload } = usePolling(listUsers, 20000);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'create' | 'reset' | 'delete' | 'demote-self', user?, role? }
  const [savingRole, setSavingRole] = useState(false);
  const me = getUsername();

  const rows = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return q ? users.filter((u) => `${u.username} ${u.fullName || ''} ${u.email || ''}`.toLowerCase().includes(q)) : users;
  }, [users, search]);

  const applyRole = async (user, role) => {
    setSavingRole(true);
    try {
      await changeUserRole(user.id, role);
      if (user.username === me) {
        // Your own access just changed; reload into the view that matches it.
        setRole(role);
        window.location.assign('/dashboard');
        return;
      }
      showToast(`${user.username} is now ${ROLE_OPTIONS.find((r) => r.value === role).label.toLowerCase()}.`, 'success');
      reload();
    } catch (err) {
      showToast(errorMessage(err, "Couldn't change the role."), 'error');
    } finally {
      setSavingRole(false);
      setDialog(null);
    }
  };

  const onRolePicked = (user, role) => {
    if (user.username === me && role !== 'admin') setDialog({ type: 'demote-self', user, role });
    else applyRole(user, role);
  };

  const columns = [
    {
      key: 'username', header: 'Account', sortValue: (u) => u.username.toLowerCase(),
      render: (u) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{u.username}{u.username === me && <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">(you)</span>}</p>
          <p className="text-xs text-[var(--ink-muted)] truncate">{[u.fullName, u.email].filter(Boolean).join(' · ')}</p>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role', sortValue: (u) => u.role,
      render: (u) => (
        <select
          aria-label={`Role for ${u.username}`}
          value={u.role}
          disabled={savingRole}
          onChange={(e) => onRolePicked(u, e.target.value)}
          className="bg-transparent border border-[var(--surface-border-strong)] rounded-[var(--radius-md)] px-2 py-1 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      ),
    },
    { key: 'createdAt', header: 'Created', sortValue: (u) => (u.createdAt ? new Date(u.createdAt).getTime() : null), render: (u) => formatDateTime(u.createdAt), className: 'whitespace-nowrap text-[var(--ink-muted)]' },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-0.5">
          <IconButton label={`Reset password for ${u.username}`} onClick={() => setDialog({ type: 'reset', user: u })}><KeyRound size={16} aria-hidden="true" /></IconButton>
          <IconButton label={`Delete ${u.username}`} disabled={u.username === me} onClick={() => setDialog({ type: 'delete', user: u })} className="disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={16} aria-hidden="true" /></IconButton>
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <div className="w-64"><TextField label="Search accounts" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, username or email" /></div>
      <Button onClick={() => setDialog({ type: 'create' })}><Plus size={16} aria-hidden="true" />Create account</Button>
    </>
  );

  let body;
  if (error && !users) body = <ErrorState message={error} onRetry={reload} />;
  else if (!users) body = <div className="flex justify-center py-16"><Spinner label="Loading accounts" /></div>;
  else {
    body = (
      <>
        <p className="text-sm text-[var(--ink-muted)] mb-3">{users.length} {users.length === 1 ? 'account' : 'accounts'}. Only an administrator can change roles, and new sign-ups start as guests.</p>
        <DataTable caption="Accounts" columns={columns} rows={rows} getRowId={(u) => u.id} initialSort={{ key: 'username', dir: 'asc' }} empty={search ? 'No accounts match your search.' : 'No accounts.'} />
      </>
    );
  }

  return (
    <WindowLayout toolbar={toolbar}>
      {body}
      {dialog?.type === 'create' && (
        <CreateUserDialog onClose={() => setDialog(null)} onDone={(name) => { setDialog(null); showToast(`Created the account ${name}.`, 'success'); reload(); }} />
      )}
      {dialog?.type === 'reset' && (
        <ResetPasswordDialog user={dialog.user} onClose={() => setDialog(null)} onDone={(name) => { setDialog(null); showToast(`Changed the password for ${name}.`, 'success'); }} />
      )}
      {dialog?.type === 'delete' && (
        <DeleteUserDialog user={dialog.user} onClose={() => setDialog(null)} onDone={(name) => { setDialog(null); showToast(`Deleted the account ${name}.`, 'success'); reload(); }} />
      )}
      {dialog?.type === 'demote-self' && (
        <ConfirmDialog
          title="Remove your own administrator access?"
          message={`You'll become ${dialog.role === 'guest' ? 'a guest' : 'an employee'} and lose this desktop straight away. Another administrator would have to restore it.`}
          confirmLabel="Change my role"
          loading={savingRole}
          onConfirm={() => applyRole(dialog.user, dialog.role)}
          onCancel={() => setDialog(null)}
        />
      )}
    </WindowLayout>
  );
};
