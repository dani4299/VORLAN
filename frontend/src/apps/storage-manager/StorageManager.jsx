import React, { useMemo, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Section, WindowLayout } from '../../components/layout/WindowLayout';
import { Badge } from '../../components/ui/Badge';
import { Button, IconButton } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { Meter } from '../../components/ui/Meter';
import { Spinner } from '../../components/ui/Spinner';
import { getStorage } from '../../lib/adminApi';
import { DatasetDialog } from './DatasetDialog';
import { formatBytes, formatNumber, formatRelativeTime } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

// A disk filling up is worth a warning colour; a folder's share of the data is just a proportion, so it stays neutral.
const PercentCell = ({ used, size, label, capacity = false }) => (
  <div className="flex items-center gap-2 min-w-[8rem]">
    <Meter value={used} max={size} label={label} valueText={`${formatBytes(used)} of ${formatBytes(size)}`} tone={capacity ? undefined : 'accent'} className="flex-1" />
    <span className="tabular-nums text-[var(--ink-muted)] w-10 text-right">{Math.round(pct(used, size))}%</span>
  </div>
);

/** Disk volumes and, inside them, how much space VORLAN's own data takes. */
export const StorageManager = () => {
  const { data, error, reload } = usePolling(getStorage, 30000);
  const [refreshing, setRefreshing] = useState(false);
  const [managing, setManaging] = useState(null); // the location row whose dataset dialog is open


  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const volumeColumns = useMemo(() => [
    {
      key: 'mount', header: 'Volume', sortValue: (d) => d.mount,
      render: (d) => (
        <span>
          <span className="font-medium">{d.mount}</span>
          {d.mount === data?.dataVolume && <span className="ml-2 text-xs text-[var(--ink-muted)]">holds VORLAN data</span>}
        </span>
      ),
    },
    { key: 'type', header: 'Type', sortValue: (d) => d.type },
    { key: 'used', header: 'Used', align: 'right', sortValue: (d) => d.usedBytes, render: (d) => formatBytes(d.usedBytes), className: 'tabular-nums' },
    { key: 'free', header: 'Free', align: 'right', sortValue: (d) => d.availableBytes, render: (d) => formatBytes(d.availableBytes), className: 'tabular-nums' },
    { key: 'size', header: 'Size', align: 'right', sortValue: (d) => d.sizeBytes, render: (d) => formatBytes(d.sizeBytes), className: 'tabular-nums' },
    { key: 'usage', header: 'Usage', sortValue: (d) => pct(d.usedBytes, d.sizeBytes), render: (d) => <PercentCell used={d.usedBytes} size={d.sizeBytes} label={`${d.mount} usage`} capacity /> },
  ], [data?.dataVolume]);

  const locationColumns = useMemo(() => [
    { key: 'label', header: 'Location', sortValue: (l) => l.label.toLowerCase(), render: (l) => <span className="font-medium">{l.label}</span> },
    { key: 'group', header: 'Kind', sortValue: (l) => l.group },
    { key: 'files', header: 'Files', align: 'right', sortValue: (l) => l.files, render: (l) => formatNumber(l.files), className: 'tabular-nums' },
    { key: 'bytes', header: 'Size', align: 'right', sortValue: (l) => l.bytes, render: (l) => formatBytes(l.bytes), className: 'tabular-nums' },
    {
      key: 'share', header: 'Share of VORLAN data', sortValue: (l) => l.bytes,
      render: (l) => <PercentCell used={l.bytes} size={data.totalBytes} label={`${l.label} share`} />,
    },
    {
      key: 'quota', header: 'Quota', sortValue: (l) => l.quotaBytes ?? -1,
      render: (l) => {
        if (!l.datasetKey) return <span className="text-[var(--ink-muted)]">—</span>;
        if (l.quotaBytes == null) return <span className="text-[var(--ink-muted)]">No limit</span>;
        return <PercentCell used={l.bytes} size={l.quotaBytes} label={`${l.label} quota`} />;
      },
    },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (l) => (l.datasetKey ? (
        <IconButton label={`Quota and snapshots for ${l.label}`} onClick={() => setManaging(l)}><History size={15} aria-hidden="true" /></IconButton>
      ) : null),
    },
  ], [data?.totalBytes]);

  const toolbar = (
    <>
      <p className="text-sm text-[var(--ink-muted)]">{data ? `Folder sizes scanned ${formatRelativeTime(data.scannedAt).toLowerCase()}; they refresh every 30 seconds.` : ' '}</p>
      <Button variant="secondary" onClick={refresh} loading={refreshing}><RefreshCw size={16} aria-hidden="true" />Refresh</Button>
    </>
  );

  let body;
  if (error && !data) body = <ErrorState message={error} onRetry={reload} />;
  else if (!data) body = <div className="flex justify-center py-16"><Spinner label="Reading storage" /></div>;
  else {
    body = (
      <>
        <Section title="Volumes" description="The disks this computer can see.">
          <DataTable caption="Storage volumes" columns={volumeColumns} rows={data.volumes} getRowId={(d) => d.mount} empty="No volumes were reported." />
        </Section>
        {data.pools?.length > 0 && (
          <Section title="Pools" description="Where VORLAN's own data is kept. Formed automatically - no setup needed.">
            {data.pools.map((pool) => (
              <div key={pool.id} className="mb-3 last:mb-0">
                <p className="text-sm font-medium text-[var(--ink)] mb-1">{pool.name}</p>
                <DataTable
                  caption={`${pool.name} member disks`}
                  columns={[
                    { key: 'mount', header: 'Disk', sortValue: (m) => m.mount, render: (m) => (<span>{m.mount}{!m.online && <Badge tone="warning" className="ml-2">Not detected</Badge>}</span>) },
                    { key: 'used', header: 'Used', align: 'right', sortValue: (m) => m.usedBytes ?? -1, render: (m) => (m.usedBytes == null ? '—' : formatBytes(m.usedBytes)), className: 'tabular-nums' },
                    { key: 'free', header: 'Free', align: 'right', sortValue: (m) => m.availableBytes ?? -1, render: (m) => (m.availableBytes == null ? '—' : formatBytes(m.availableBytes)), className: 'tabular-nums' },
                    { key: 'size', header: 'Size', align: 'right', sortValue: (m) => m.sizeBytes ?? -1, render: (m) => (m.sizeBytes == null ? '—' : formatBytes(m.sizeBytes)), className: 'tabular-nums' },
                  ]}
                  rows={pool.members}
                  getRowId={(m) => m.mount}
                  empty="This pool has no disks."
                />
              </div>
            ))}
            {data.availableDisks?.length > 0 && (
              <p className="text-sm text-[var(--ink-muted)] mt-2">
                {data.availableDisks.length === 1 ? 'Another disk is' : `${data.availableDisks.length} other disks are`} attached ({data.availableDisks.map((d) => d.mount).join(', ')}) but not yet part of a pool. Adding a second disk to a pool isn't supported yet.
              </p>
            )}
          </Section>
        )}

        <Section
          title="VORLAN data"
          description={`${formatBytes(data.totalBytes)} in ${formatNumber(data.totalFiles)} files${data.dataVolume ? `, on ${data.dataVolume}` : ''}.`}
        >
          {data.truncated && (
            <p role="status" className="text-sm text-[var(--warning)] mb-3">
              There are too many files to count them all, so these sizes are lower than the real ones.
            </p>
          )}
          <DataTable caption="VORLAN data by location" columns={locationColumns} rows={data.locations} getRowId={(l) => l.id} initialSort={{ key: 'bytes', dir: 'desc' }} empty="VORLAN hasn't stored anything yet." />
        </Section>
      </>
    );
  }

  return (
    <WindowLayout toolbar={toolbar}>
      {body}
      {managing && (
        <DatasetDialog
          location={managing}
          onClose={() => setManaging(null)}
          onSaved={() => reload()}
        />
      )}
    </WindowLayout>
  );
};
