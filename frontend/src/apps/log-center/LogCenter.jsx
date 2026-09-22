import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { WindowLayout } from '../../components/layout/WindowLayout';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { SelectField, TextField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { errorMessage, listAuditLog } from '../../lib/adminApi';
import { formatDateTime } from '../../lib/format';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

const PAGE_SIZE = 100;
const AUTO_REFRESH_MS = 10000;

const CATEGORIES = [
  { id: 'all', label: 'All events' },
  { id: 'auth', label: 'Sign-ins' },
  { id: 'account', label: 'Accounts' },
  { id: 'admin', label: 'Administrator actions' },
  { id: 'task', label: 'Tasks' },
];

// `problem` events are drawn in the danger colour so a failed sign-in stands out in a long list.
const EVENTS = {
  'auth.login_success': { label: 'Signed in' },
  'auth.login_failed': { label: 'Sign-in failed', problem: true },
  'auth.login_blocked': { label: 'Sign-in blocked after too many attempts', problem: true },
  'auth.logout': { label: 'Signed out' },
  'auth.logout_all': { label: 'Signed out of other devices' },
  'auth.session_revoked': { label: 'Device signed out by its owner' },
  'auth.session_reuse_detected': { label: 'Sign-in ended: used from two places', problem: true },
  'auth.vault_pin_failed': { label: 'Wrong Personal Vault PIN', problem: true },
  'auth.vault_blocked': { label: 'Personal Vault locked after too many attempts', problem: true },
  'account.password_changed': { label: 'Password changed' },
  'account.created': { label: 'Account created' },
  'account.renamed': { label: 'Account renamed' },
  'admin.role_changed': { label: 'Role changed' },
  'admin.user_created': { label: 'Account created by an administrator' },
  'admin.password_reset': { label: 'Password reset' },
  'admin.user_deleted': { label: 'Account deleted' },
  'admin.device_removed': { label: 'Device record removed' },
  'admin.device_signed_out': { label: 'Device signed out by an administrator' },
  'admin.session_revoked': { label: 'Sign-in ended by an administrator' },
  'admin.user_signed_out': { label: 'Account signed out everywhere' },
  'admin.diagnostics_downloaded': { label: 'Diagnostics downloaded' },
  'admin.dataset_settings_changed': { label: 'Dataset settings changed' },
  'admin.dataset_sharing_changed': { label: 'Dataset sharing changed' },
  'admin.snapshot_taken': { label: 'Snapshot taken' },
  'admin.snapshot_deleted': { label: 'Snapshot deleted' },
  'admin.snapshot_restored': { label: 'Snapshot restored' },
  'admin.vorlan_restarted': { label: 'VORLAN restarted' },
  'admin.vorlan_stopped': { label: 'VORLAN stopped', problem: true },
  'task.failed': { label: 'Task failed', problem: true },
};

const eventOf = (action) => EVENTS[action] || { label: action.replace(/[._]/g, ' ') };

// Excel only reads a CSV as UTF-8 (so accented names survive) when the file starts with this mark.
const BYTE_ORDER_MARK = String.fromCharCode(0xFEFF);

/** A spreadsheet treats a cell starting with = + - or @ as a formula, so those get a leading apostrophe. */
const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const exportCsv = (entries) => {
  const lines = [['Time', 'Event', 'Account', 'Details'].map(csvCell).join(',')];
  for (const e of entries) lines.push([e.timestamp, eventOf(e.action).label, e.actor, e.detail].map(csvCell).join(','));
  const url = URL.createObjectURL(new Blob([`${BYTE_ORDER_MARK}${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `vorlan-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const columns = [
  {
    key: 'timestamp', header: 'Time', sortValue: (e) => e.id,
    render: (e) => <time dateTime={e.timestamp}>{formatDateTime(e.timestamp, { seconds: true })}</time>,
    className: 'whitespace-nowrap tabular-nums',
  },
  {
    key: 'action', header: 'Event', sortValue: (e) => eventOf(e.action).label,
    render: (e) => {
      const ev = eventOf(e.action);
      return <span className={ev.problem ? 'font-medium text-[var(--danger)]' : ''}>{ev.label}</span>;
    },
  },
  { key: 'actor', header: 'Account', sortValue: (e) => (e.actor || '').toLowerCase(), render: (e) => e.actor || 'Unknown' },
  { key: 'detail', header: 'Details', render: (e) => <span className="text-[var(--ink-muted)] break-words">{e.detail}</span> },
];

/** Everything that happened on this VORLAN: sign-ins, account changes, administrator actions, failed tasks. */
export const LogCenter = () => {
  const showToast = useToast();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const [entries, setEntries] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const latest = useRef(0); // guards against a slow answer for an old filter landing after a newer one

  const query = useMemo(() => ({ category: category === 'all' ? undefined : category, q: debouncedSearch || undefined }), [category, debouncedSearch]);

  const loadFirst = useCallback(async () => {
    const ticket = ++latest.current;
    setRefreshing(true);
    try {
      const page = await listAuditLog({ ...query, limit: PAGE_SIZE });
      if (ticket !== latest.current) return;
      setEntries(page.entries);
      setHasMore(page.hasMore);
      setError(null);
    } catch (err) {
      if (ticket === latest.current) setError(errorMessage(err, "Couldn't load the log."));
    } finally {
      if (ticket === latest.current) setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    setEntries(null);
    loadFirst();
  }, [loadFirst]);

  // New events show up on their own, unless the person has paged further back: replacing the list
  // then would throw away the older entries they loaded.
  const paged = entries !== null && entries.length > PAGE_SIZE;
  useEffect(() => {
    if (paged) return undefined;
    const id = setInterval(loadFirst, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [paged, loadFirst]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await listAuditLog({ ...query, limit: PAGE_SIZE, beforeId: entries[entries.length - 1].id });
      setEntries((prev) => [...prev, ...page.entries]);
      setHasMore(page.hasMore);
    } catch (err) {
      showToast(errorMessage(err, "Couldn't load older events."), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const toolbar = (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64"><TextField label="Search the log" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Account, event or detail" /></div>
        <div className="w-52">
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </SelectField>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={loadFirst} loading={refreshing && entries !== null}><RefreshCw size={16} aria-hidden="true" />Refresh</Button>
        <Button variant="secondary" onClick={() => exportCsv(entries)} disabled={!entries?.length}><Download size={16} aria-hidden="true" />Export CSV</Button>
      </div>
    </>
  );

  let body;
  if (error && !entries) body = <ErrorState message={error} onRetry={loadFirst} />;
  else if (!entries) body = <div className="flex justify-center py-16"><Spinner label="Loading the log" /></div>;
  else {
    body = (
      <>
        <p className="text-sm text-[var(--ink-muted)] mb-3" aria-live="polite">
          Showing {entries.length} {entries.length === 1 ? 'event' : 'events'}, newest first{hasMore ? '' : ' (that is all of them)'}. Updates every 10 seconds.
        </p>
        <DataTable
          caption="Event log"
          columns={columns}
          rows={entries}
          getRowId={(e) => e.id}
          initialSort={{ key: 'timestamp', dir: 'desc' }}
          dense
          empty={debouncedSearch || category !== 'all' ? 'No events match these filters.' : 'Nothing has been logged yet.'}
        />
        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button variant="secondary" onClick={loadMore} loading={loadingMore}>Load older events</Button>
          </div>
        )}
      </>
    );
  }

  return <WindowLayout toolbar={toolbar}>{body}</WindowLayout>;
};
