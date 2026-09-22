import React, { useMemo, useState } from 'react';
import { ExternalLink, Play, ScrollText, Square, Trash2 } from 'lucide-react';
import { Section, WindowLayout } from '../../components/layout/WindowLayout';
import { Badge } from '../../components/ui/Badge';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../context/ToastContext';
import {
  errorMessage, getAppsStatus, listAppCatalog, listApps, startApp, stopApp,
} from '../../lib/adminApi';
import { usePolling } from '../../lib/usePolling';
import { InstallDialog } from './InstallDialog';
import { LogsDialog } from './LogsDialog';
import { UninstallDialog } from './UninstallDialog';

const STATUS_TONE = { running: 'success', stopped: 'neutral', installing: 'info', error: 'danger', uninstalling: 'warning' };
const STATUS_LABEL = { running: 'Running', stopped: 'Stopped', installing: 'Installing…', error: 'Error', uninstalling: 'Removing…' };

const TABS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'installed', label: 'Installed' },
];

export const AppStore = () => {
  const showToast = useToast();
  const [tab, setTab] = useState('catalog');
  const { data: dockerStatus } = usePolling(getAppsStatus, 15000);
  const { data: catalog } = usePolling(listAppCatalog, 60000);
  const { data: installed, error: installedError, reload } = usePolling(listApps, 3000);

  const [installing, setInstalling] = useState(null); // catalog entry, or {} for a custom image
  const [logsFor, setLogsFor] = useState(null);
  const [uninstalling, setUninstalling] = useState(null);
  const [working, setWorking] = useState(null); // id of the app a start/stop is in flight for

  const toggle = async (app) => {
    setWorking(app.id);
    try {
      if (app.status === 'running') { await stopApp(app.id); showToast(`Stopped ${app.name}.`, 'success'); }
      else { await startApp(app.id); showToast(`Started ${app.name}.`, 'success'); }
      reload();
    } catch (err) {
      showToast(errorMessage(err, "Couldn't do that."), 'error');
    } finally {
      setWorking(null);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'name', header: 'App', sortValue: (a) => a.name.toLowerCase(),
      render: (a) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{a.name}</p>
          <p className="text-xs text-[var(--ink-muted)] truncate">{a.image}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', sortValue: (a) => a.status,
      render: (a) => (
        <div>
          <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status] || a.status}</Badge>
          {a.status === 'error' && a.errorMessage && <p className="text-xs text-[var(--danger)] mt-1 max-w-xs">{a.errorMessage}</p>}
        </div>
      ),
    },
    {
      key: 'open', header: 'Address', render: (a) => (a.url ? (
        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline">
          {a.url}<ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : <span className="text-[var(--ink-muted)]">—</span>),
    },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (a) => (
        <div className="flex justify-end gap-0.5">
          {(a.status === 'running' || a.status === 'stopped') && (
            <IconButton
              label={a.status === 'running' ? `Stop ${a.name}` : `Start ${a.name}`}
              onClick={() => toggle(a)} disabled={working === a.id}
            >
              {a.status === 'running' ? <Square size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            </IconButton>
          )}
          <IconButton label={`View logs for ${a.name}`} onClick={() => setLogsFor(a)} disabled={a.status === 'installing'}>
            <ScrollText size={15} aria-hidden="true" />
          </IconButton>
          <IconButton label={`Uninstall ${a.name}`} onClick={() => setUninstalling(a)}>
            <Trash2 size={15} aria-hidden="true" />
          </IconButton>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [working]);

  if (dockerStatus && !dockerStatus.available) {
    return (
      <WindowLayout>
        <ErrorState
          message={`Docker isn't available (${dockerStatus.error || 'not reachable'}). Apps run as Docker containers, so the App Store needs it installed and running. See the installer's README for how Docker gets set up.`}
        />
      </WindowLayout>
    );
  }

  const toolbar = (
    <Tabs idPrefix="app-store" label="App Store sections" tabs={TABS} value={tab} onChange={setTab} />
  );

  return (
    <WindowLayout toolbar={toolbar}>
      {tab === 'catalog' && (
        <Section title="Catalog" description="A small list of known apps, ready to install with sensible defaults." actions={<Button variant="secondary" size="sm" onClick={() => setInstalling({})}>Install a Docker image</Button>}>
          {!catalog ? (
            <div className="flex justify-center py-10"><Spinner label="Loading the catalog" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalog.map((entry) => (
                <Card key={entry.key} title={entry.name} actions={<Button size="sm" onClick={() => setInstalling(entry)}>Install</Button>}>
                  <p className="text-sm text-[var(--ink-muted)]">{entry.description}</p>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === 'installed' && (
        <Section title="Installed">
          {installedError && !installed ? (
            <ErrorState message={installedError} onRetry={reload} />
          ) : !installed ? (
            <div className="flex justify-center py-10"><Spinner label="Loading installed apps" /></div>
          ) : installed.length === 0 ? (
            <EmptyState title="Nothing installed yet" hint="Pick something from the Catalog tab to get started." action={<Button size="sm" onClick={() => setTab('catalog')}>Browse the catalog</Button>} />
          ) : (
            <DataTable caption="Installed apps" columns={columns} rows={installed} getRowId={(a) => a.id} initialSort={{ key: 'name', dir: 'asc' }} empty="Nothing installed yet." />
          )}
        </Section>
      )}

      {installing && (
        <InstallDialog
          catalogEntry={installing.key ? installing : null}
          onClose={() => setInstalling(null)}
          onInstalled={(app) => { setInstalling(null); setTab('installed'); showToast(`Installing ${app.name}…`, 'success'); reload(); }}
        />
      )}
      {logsFor && <LogsDialog app={logsFor} onClose={() => setLogsFor(null)} />}
      {uninstalling && (
        <UninstallDialog
          app={uninstalling}
          onClose={() => setUninstalling(null)}
          onUninstalled={() => { showToast(`Uninstalled ${uninstalling.name}.`, 'success'); setUninstalling(null); reload(); }}
        />
      )}
    </WindowLayout>
  );
};
