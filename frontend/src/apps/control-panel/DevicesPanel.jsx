import React, { useMemo, useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import { WindowLayout } from '../../components/layout/WindowLayout';
import { Badge } from '../../components/ui/Badge';
import { IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { TextField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { errorMessage, listAllDevices, listSessions, removeDevice, signDeviceOut } from '../../lib/adminApi';
import { formatBytes, formatDateTime, formatRelativeTime } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

const loadDevices = async () => {
  const [devices, sessions] = await Promise.all([listAllDevices(), listSessions()]);
  return { devices, sessions };
};

export const DevicesPanel = () => {
  const showToast = useToast();
  const { data, error, reload } = usePolling(loadDevices, 10000);
  const devices = data?.devices;
  const signedIn = useMemo(() => new Set((data?.sessions || []).map((s) => `${s.userId}-${s.deviceId}`)), [data]);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(null); // the device awaiting confirmation
  const [removing, setRemoving] = useState(false);
  const [signOut, setSignOut] = useState(null); // the device to sign out
  const [signingOut, setSigningOut] = useState(false);

  const rows = useMemo(() => {
    if (!devices) return [];
    const q = search.trim().toLowerCase();
    return q ? devices.filter((d) => `${d.label} ${d.username} ${d.ip || ''}`.toLowerCase().includes(q)) : devices;
  }, [devices, search]);

  const confirmRemove = async () => {
    setRemoving(true);
    try {
      await removeDevice(pending.userId, pending.id);
      showToast(`Removed the record for ${pending.label}.`, 'success');
      reload();
    } catch (err) {
      showToast(errorMessage(err, "Couldn't remove that device."), 'error');
    } finally {
      setRemoving(false);
      setPending(null);
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signDeviceOut(signOut.userId, signOut.id);
      showToast(`Signed ${signOut.label} out.`, 'success');
      reload();
    } catch (err) {
      showToast(errorMessage(err, "Couldn't sign that device out."), 'error');
    } finally {
      setSigningOut(false);
      setSignOut(null);
    }
  };

  const columns = useMemo(() => [
    { key: 'label', header: 'Device', sortValue: (d) => d.label.toLowerCase(), render: (d) => <span className="font-medium">{d.label}</span> },
    { key: 'username', header: 'Account', sortValue: (d) => d.username.toLowerCase() },
    {
      key: 'lastSeen', header: 'Last active', sortValue: (d) => d.lastSeen,
      render: (d) => <time dateTime={new Date(d.lastSeen).toISOString()} title={formatDateTime(d.lastSeen)}>{formatRelativeTime(d.lastSeen)}</time>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'signedIn', header: 'Sign-in', sortValue: (d) => (signedIn.has(`${d.userId}-${d.id}`) ? 0 : 1),
      render: (d) => (signedIn.has(`${d.userId}-${d.id}`) ? <Badge tone="success">Signed in</Badge> : <span className="text-[var(--ink-muted)]">Signed out</span>),
      className: 'whitespace-nowrap',
    },
    { key: 'ip', header: 'Address', sortValue: (d) => d.ip || '', render: (d) => d.ip || 'Unknown', className: 'tabular-nums' },
    { key: 'bytes', header: 'Data used', align: 'right', sortValue: (d) => d.bytes, render: (d) => formatBytes(d.bytes), className: 'tabular-nums' },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-0.5">
          {signedIn.has(`${d.userId}-${d.id}`) && (
            <IconButton label={`Sign out ${d.label} (${d.username})`} onClick={() => setSignOut(d)}><LogOut size={16} aria-hidden="true" /></IconButton>
          )}
          <IconButton label={`Remove the record for ${d.label} (${d.username})`} onClick={() => setPending(d)}><Trash2 size={16} aria-hidden="true" /></IconButton>
        </div>
      ),
    },
  ], [signedIn]);

  const toolbar = (
    <div className="w-64"><TextField label="Search devices" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Device, account or address" /></div>
  );

  let body;
  if (error && !devices) body = <ErrorState message={error} onRetry={reload} />;
  else if (!devices) body = <div className="flex justify-center py-16"><Spinner label="Loading devices" /></div>;
  else {
    body = (
      <>
        <p className="text-sm text-[var(--ink-muted)] mb-3 max-w-2xl">
          Every browser that has signed in, across all accounts. Signing a device out ends its access straight away. Removing a record only clears this list: it doesn't sign the device out, and it reappears the next time that browser talks to VORLAN.
        </p>
        <DataTable caption="Signed-in devices" columns={columns} rows={rows} getRowId={(d) => `${d.userId}-${d.id}`} initialSort={{ key: 'lastSeen', dir: 'desc' }} empty={search ? 'No devices match your search.' : 'No devices have signed in yet.'} />
      </>
    );
  }

  return (
    <WindowLayout toolbar={toolbar}>
      {body}
      {signOut && (
        <ConfirmDialog
          title={`Sign out ${signOut.label}?`}
          message={`${signOut.username} is signed out on this device straight away and will need their password to get back in.`}
          confirmLabel="Sign out"
          loading={signingOut}
          onConfirm={confirmSignOut}
          onCancel={() => setSignOut(null)}
        />
      )}
      {pending && (
        <ConfirmDialog
          title={`Remove the record for ${pending.label}?`}
          message={`This clears ${pending.username}'s activity history for this device. It can't be undone.`}
          confirmLabel="Remove record"
          loading={removing}
          onConfirm={confirmRemove}
          onCancel={() => setPending(null)}
        />
      )}
    </WindowLayout>
  );
};
