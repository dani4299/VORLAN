import React, { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, IconButton } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { listDevices, renameDevice, isThisDevice } from '../../lib/devicesApi';
import { formatBytes, formatDateTime, formatRelativeTime } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

const RenameDialog = ({ device, onClose, onRenamed }) => {
  const [value, setValue] = useState(device.label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    const label = value.trim();
    if (!label) return;
    setSaving(true);
    setError('');
    try {
      await renameDevice(device.id, label);
      onRenamed(label);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't rename this device.");
      setSaving(false);
    }
  };

  return (
    <Modal title="Rename device" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <TextField label="Device name" value={value} onChange={(e) => setValue(e.target.value)} required data-autofocus />
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!value.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
  );
};

/** Every browser and phone signed in to this account, and how much data each has used. */
export const ConnectedDevicesSettings = () => {
  const showToast = useToast();
  const { data: devices, error, reload } = usePolling(listDevices, 15000);
  const [renaming, setRenaming] = useState(null);

  const columns = useMemo(() => [
    {
      key: 'label', header: 'Device', sortValue: (d) => d.label.toLowerCase(),
      render: (d) => <span className="font-medium">{d.label}{isThisDevice(d.id) && <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">(this device)</span>}</span>,
    },
    {
      key: 'lastSeen', header: 'Last active', sortValue: (d) => d.lastSeen,
      render: (d) => <time dateTime={new Date(d.lastSeen).toISOString()} title={formatDateTime(d.lastSeen)}>{formatRelativeTime(d.lastSeen)}</time>,
      className: 'whitespace-nowrap',
    },
    { key: 'ip', header: 'Address', sortValue: (d) => d.ip || '', render: (d) => d.ip || 'Unknown', className: 'tabular-nums' },
    { key: 'bytes', header: 'Data used', align: 'right', sortValue: (d) => d.bytes, render: (d) => formatBytes(d.bytes), className: 'tabular-nums whitespace-nowrap' },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (d) => <IconButton label={`Rename ${d.label}`} onClick={() => setRenaming(d)}><Pencil size={15} aria-hidden="true" /></IconButton>,
    },
  ], []);

  if (error && !devices) return <ErrorState message={error} onRetry={reload} />;
  if (!devices) return <div className="flex justify-center py-10"><Spinner label="Loading your devices" /></div>;

  return (
    <>
      <DataTable
        caption="Your connected devices"
        columns={columns}
        rows={devices}
        getRowId={(d) => d.id}
        initialSort={{ key: 'lastSeen', dir: 'desc' }}
        empty="No devices yet. Devices that sign in to your account will show up here."
      />
      {renaming && (
        <RenameDialog
          device={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={(label) => { setRenaming(null); showToast(`Renamed to ${label}.`, 'success'); reload(); }}
        />
      )}
    </>
  );
};
