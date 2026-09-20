import React, { useMemo, useState } from 'react';
import { WindowLayout } from '../../components/layout/WindowLayout';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { SelectField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { listTasks } from '../../lib/adminApi';
import { formatDateTime, formatDuration, formatRelativeTime } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

const STATUS = {
  queued: { label: 'Waiting', color: 'var(--ink-muted)', rank: 1 },
  running: { label: 'Running', color: 'var(--accent)', rank: 0 },
  succeeded: { label: 'Finished', color: 'var(--success)', rank: 2 },
  failed: { label: 'Failed', color: 'var(--danger)', rank: 3 },
};

const FILTERS = [
  { id: 'all', label: 'All tasks', test: () => true },
  { id: 'active', label: 'Running or waiting', test: (t) => t.status === 'running' || t.status === 'queued' },
  { id: 'finished', label: 'Finished', test: (t) => t.status === 'succeeded' },
  { id: 'failed', label: 'Failed', test: (t) => t.status === 'failed' },
];

const durationOf = (task) => {
  if (task.status === 'queued') return null;
  return (task.finishedAt ?? Date.now()) - task.startedAt;
};

const columns = [
  {
    key: 'label', header: 'Task', sortValue: (t) => t.label.toLowerCase(),
    render: (t) => (
      <div className="min-w-0">
        <p className="font-medium">{t.label}</p>
        {t.error && <p className="text-xs text-[var(--danger)] mt-0.5 break-words">{t.error}</p>}
      </div>
    ),
  },
  { key: 'startedBy', header: 'Started by', sortValue: (t) => (t.startedBy || 'System').toLowerCase(), render: (t) => t.startedBy || 'System' },
  {
    key: 'status', header: 'Status', sortValue: (t) => STATUS[t.status].rank,
    render: (t) => <span style={{ color: STATUS[t.status].color }} className="font-medium">{STATUS[t.status].label}</span>,
  },
  {
    key: 'startedAt', header: 'Started', sortValue: (t) => t.startedAt ?? t.createdAt,
    render: (t) => (t.startedAt ? <time dateTime={new Date(t.startedAt).toISOString()} title={formatDateTime(t.startedAt)}>{formatRelativeTime(t.startedAt)}</time> : 'Not yet'),
    className: 'whitespace-nowrap',
  },
  { key: 'duration', header: 'Duration', align: 'right', sortValue: (t) => durationOf(t), render: (t) => formatDuration(durationOf(t)), className: 'tabular-nums whitespace-nowrap' },
];

/** Background work VORLAN is doing or has finished: what it is, who started it, how it went. */
export const TaskManager = () => {
  const { data: tasks, error, reload } = usePolling(listTasks, 3000);
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => (tasks ? tasks.filter(FILTERS.find((f) => f.id === filter).test) : []), [tasks, filter]);

  const toolbar = (
    <div className="w-56">
      <SelectField label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
        {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </SelectField>
    </div>
  );

  let body;
  if (error && !tasks) body = <ErrorState message={error} onRetry={reload} />;
  else if (!tasks) body = <div className="flex justify-center py-16"><Spinner label="Loading tasks" /></div>;
  else {
    const active = tasks.filter(FILTERS[1].test).length;
    const failed = tasks.filter(FILTERS[3].test).length;
    body = (
      <>
        <p className="text-sm text-[var(--ink-muted)] mb-3 max-w-2xl">
          {active} running or waiting, {failed} failed. Tasks are kept in memory, so this list starts empty after VORLAN restarts. The latest 100 finished tasks are kept.
        </p>
        <DataTable
          caption="Tasks"
          columns={columns}
          rows={rows}
          getRowId={(t) => t.id}
          initialSort={{ key: 'startedAt', dir: 'desc' }}
          empty={tasks.length === 0 ? 'No tasks yet. Long-running work, like copying a large folder, appears here while it runs.' : 'No tasks match this filter.'}
        />
      </>
    );
  }

  return <WindowLayout toolbar={toolbar}>{body}</WindowLayout>;
};
