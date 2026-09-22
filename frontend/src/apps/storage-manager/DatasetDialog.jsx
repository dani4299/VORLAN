import React, { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { SelectField, Switch, TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import {
  deleteSnapshot, errorMessage, getSharing, listSnapshots, restoreSnapshot, setDatasetSharing, takeSnapshot, updateDataset,
} from '../../lib/adminApi';
import { formatBytes, formatDateTime, formatNumber } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

const FREQUENCY_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const KIND_LABEL = { manual: 'Manual', scheduled: 'Scheduled', 'pre-restore': 'Before a restore' };

const bytesToGb = (bytes) => (bytes == null ? '' : String(Math.round((bytes / 1024 ** 3) * 1000) / 1000));

/** Quota and snapshot schedule for one dataset, plus its snapshot history. */
export const DatasetDialog = ({ location, onClose, onSaved }) => {
  const showToast = useToast();
  const { data: snapshotList, error, reload } = usePolling(() => listSnapshots(location.datasetKey), 15000);

  const [quotaGb, setQuotaGb] = useState(bytesToGb(location.quotaBytes));
  const [frequency, setFrequency] = useState(location.snapshotsEnabled ? location.snapshotFrequency : 'off');
  const [retain, setRetain] = useState(String(location.snapshotRetain || 7));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [takingSnapshot, setTakingSnapshot] = useState(false);
  const [pending, setPending] = useState(null); // { type: 'delete' | 'restore', snapshot }
  const [acting, setActing] = useState(false);

  const [sharing, setSharing] = useState(null); // { available, reason, host, hostname, share: { path, smbEnabled, nfsEnabled } }
  const [sharingBusy, setSharingBusy] = useState(null); // 'smb' | 'nfs' | null

  useEffect(() => {
    if (!location.shareable) return;
    getSharing()
      .then((res) => setSharing({ ...res, share: res.shares.find((s) => s.key === location.datasetKey) }))
      .catch(() => setSharing({ available: false, reason: "Couldn't load sharing status." }));
  }, [location.shareable, location.datasetKey]);

  const toggleShare = async (protocol, on) => {
    setSharingBusy(protocol);
    try {
      const share = await setDatasetSharing(location.datasetKey, protocol === 'smb' ? { smbEnabled: on } : { nfsEnabled: on });
      setSharing((prev) => ({ ...prev, share }));
      showToast(`${protocol === 'smb' ? 'SMB (Windows/Mac)' : 'NFS'} sharing turned ${on ? 'on' : 'off'} for ${location.label}.`, 'success');
    } catch (err) {
      showToast(errorMessage(err, "Couldn't change sharing for this dataset."), 'error');
    } finally {
      setSharingBusy(null);
    }
  };

  const retainProblem = retain !== '' && (!Number.isInteger(Number(retain)) || Number(retain) < 1 || Number(retain) > 60)
    ? 'Keep between 1 and 60.' : null;
  const quotaProblem = quotaGb !== '' && (Number.isNaN(Number(quotaGb)) || Number(quotaGb) < 0)
    ? 'Enter a positive number, or leave it blank.' : null;

  const save = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      const dataset = await updateDataset(location.datasetKey, {
        quotaGb: quotaGb === '' ? null : Number(quotaGb),
        snapshotsEnabled: frequency !== 'off',
        snapshotFrequency: frequency === 'off' ? 'daily' : frequency,
        snapshotRetain: Number(retain),
      });
      showToast('Saved.', 'success');
      onSaved?.(dataset);
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save those settings."));
    } finally {
      setSaving(false);
    }
  };

  const snapshotNow = async () => {
    setTakingSnapshot(true);
    try {
      await takeSnapshot(location.datasetKey);
      showToast(`Snapshot of ${location.label} taken.`, 'success');
      reload();
    } catch (err) {
      showToast(errorMessage(err, "Couldn't take a snapshot."), 'error');
    } finally {
      setTakingSnapshot(false);
    }
  };

  const confirmAction = async () => {
    setActing(true);
    try {
      if (pending.type === 'delete') {
        await deleteSnapshot(pending.snapshot.id);
        showToast('Snapshot deleted.', 'success');
      } else {
        await restoreSnapshot(pending.snapshot.id);
        showToast(`Restored ${location.label} to ${formatDateTime(pending.snapshot.takenAt)}. A safety copy of what was there was saved first.`, 'success');
      }
      reload();
    } catch (err) {
      showToast(errorMessage(err, pending.type === 'delete' ? "Couldn't delete that snapshot." : "Couldn't restore that snapshot."), 'error');
    } finally {
      setActing(false);
      setPending(null);
    }
  };

  const columns = useMemo(() => [
    { key: 'takenAt', header: 'Taken', sortValue: (s) => s.takenAt, render: (s) => formatDateTime(s.takenAt, { seconds: true }), className: 'whitespace-nowrap' },
    {
      key: 'kind', header: 'Kind', sortValue: (s) => s.kind,
      render: (s) => <Badge tone={s.kind === 'pre-restore' ? 'warning' : 'neutral'}>{KIND_LABEL[s.kind] || s.kind}</Badge>,
    },
    {
      key: 'status', header: 'Status', sortValue: (s) => s.status,
      render: (s) => (s.status === 'ok' ? <Badge tone="success">Ok</Badge> : <Badge tone="danger">Failed</Badge>),
    },
    { key: 'bytes', header: 'Size', align: 'right', sortValue: (s) => s.bytes ?? -1, render: (s) => (s.bytes == null ? '—' : formatBytes(s.bytes)), className: 'tabular-nums' },
    { key: 'files', header: 'Files', align: 'right', sortValue: (s) => s.files ?? -1, render: (s) => (s.files == null ? '—' : formatNumber(s.files)), className: 'tabular-nums' },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-0.5">
          {s.status === 'ok' && (
            <IconButton label={`Restore ${location.label} to ${formatDateTime(s.takenAt)}`} onClick={() => setPending({ type: 'restore', snapshot: s })}>
              <RotateCcw size={15} aria-hidden="true" />
            </IconButton>
          )}
          <IconButton label={`Delete this snapshot of ${location.label}`} onClick={() => setPending({ type: 'delete', snapshot: s })}>
            <Trash2 size={15} aria-hidden="true" />
          </IconButton>
        </div>
      ),
    },
  ], [location.label]);

  return (
    <>
      <Modal title={location.label} description="Quota, automatic snapshots and snapshot history for this dataset." onClose={onClose} size="lg">
        <form onSubmit={save} className="space-y-4 mb-6 pb-6 border-b border-[var(--surface-border)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextField
              label="Quota (GB)" type="number" min="0" step="any" value={quotaGb} onChange={(e) => setQuotaGb(e.target.value)}
              error={quotaProblem} hint="Leave blank for no limit."
            />
            <SelectField label="Automatic snapshots" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
            <TextField
              label="Keep" type="number" min="1" max="60" value={retain} onChange={(e) => setRetain(e.target.value)}
              error={retainProblem} hint="Most recent snapshots to keep."
            />
          </div>
          {location.overQuota && (
            <p role="status" className="text-sm text-[var(--danger)]">
              {location.label} is over its quota: {formatBytes(location.bytes)} used of {formatBytes(location.quotaBytes)}.
            </p>
          )}
          {saveError && <p role="alert" className="text-sm text-[var(--danger)]">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
            <Button type="submit" loading={saving} disabled={!!quotaProblem || !!retainProblem}>Save settings</Button>
          </div>
        </form>

        <div className="space-y-3 mb-6 pb-6 border-b border-[var(--surface-border)]">
          <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-1.5"><Share2 size={15} aria-hidden="true" />Network sharing</h2>
          {!location.shareable ? (
            <p className="text-sm text-[var(--ink-muted)]">
              Personal vaults stay private. Each one is protected by its owner&rsquo;s own PIN, which a network share has no way to enforce, so this dataset is never shared.
            </p>
          ) : !sharing ? (
            <div className="flex justify-center py-4"><Spinner label="Loading sharing status" /></div>
          ) : !sharing.available ? (
            <p className="text-sm text-[var(--ink-muted)]">{sharing.reason || 'Sharing is not available on this install.'}</p>
          ) : (
            <>
              <Switch
                label="Share over SMB (Windows, Mac)"
                description={sharing.share?.smbEnabled ? `Connect to \\\\${sharing.host}\\${location.label} using any VORLAN account.` : 'Anyone with a VORLAN account can connect once this is on.'}
                checked={!!sharing.share?.smbEnabled}
                disabled={sharingBusy === 'smb'}
                onChange={(on) => toggleShare('smb', on)}
              />
              <Switch
                label="Share over NFS (Linux, other NAS clients)"
                description={sharing.share?.nfsEnabled ? `Mount ${sharing.host}:${sharing.share.path}` : 'Open to any device on the local network - NFS has no sign-in of its own.'}
                checked={!!sharing.share?.nfsEnabled}
                disabled={sharingBusy === 'nfs'}
                onChange={(on) => toggleShare('nfs', on)}
              />
            </>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-1.5"><History size={15} aria-hidden="true" />Snapshots</h2>
          <Button variant="secondary" size="sm" onClick={snapshotNow} loading={takingSnapshot}>Take snapshot now</Button>
        </div>

        {error && !snapshotList ? (
          <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>
        ) : !snapshotList ? (
          <div className="flex justify-center py-8"><Spinner label="Loading snapshots" /></div>
        ) : (
          <DataTable
            caption={`Snapshots of ${location.label}`}
            columns={columns}
            rows={snapshotList}
            getRowId={(s) => s.id}
            initialSort={{ key: 'takenAt', dir: 'desc' }}
            empty="No snapshots yet. Take one, or turn on automatic snapshots above."
          />
        )}
      </Modal>

      {pending?.type === 'delete' && (
        <ConfirmDialog
          title="Delete this snapshot?"
          message={`The files copied on ${formatDateTime(pending.snapshot.takenAt)} are removed for good. This can't be undone.`}
          confirmLabel="Delete snapshot"
          loading={acting}
          onConfirm={confirmAction}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.type === 'restore' && (
        <ConfirmDialog
          title={`Restore ${location.label}?`}
          message={`Every file currently in ${location.label} is replaced with what it looked like on ${formatDateTime(pending.snapshot.takenAt)}. Whatever is there right now is saved as a snapshot first, so this can be undone.`}
          confirmLabel="Restore"
          tone="danger"
          loading={acting}
          onConfirm={confirmAction}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
};
