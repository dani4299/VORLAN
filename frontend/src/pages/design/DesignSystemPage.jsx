import React, { useEffect, useState } from 'react';
import { Inbox, Settings, Trash2, LayoutGrid, Folder, Activity } from 'lucide-react';
import { AreaChart } from '../../components/charts/AreaChart';
import { Menu } from '../../components/ui/Menu';
import { useToast } from '../../context/ToastContext';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Checkbox, SelectField, Switch, TextField } from '../../components/ui/Field';
import { Meter } from '../../components/ui/Meter';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { Spinner } from '../../components/ui/Spinner';
import { TabPanel, Tabs } from '../../components/ui/Tabs';

const SCHEMES = ['blue', 'grey', 'violet', 'emerald', 'rose', 'amber'];

const SWATCHES = [
  ['--canvas', 'canvas'], ['--canvas-elevated', 'elevated'], ['--ink', 'ink'], ['--ink-muted', 'ink-muted'], ['--ink-faint', 'ink-faint'],
  ['--accent', 'accent'], ['--accent-solid', 'accent-solid'], ['--success', 'success'], ['--warning', 'warning'], ['--danger', 'danger'], ['--info', 'info'],
];

// Synthetic series for the chart demo: a smooth CPU-like curve, with a deliberate hole in the timeline and one null reading.
const NOW = Math.floor(Date.now() / 1000);
const CHART_POINTS = Array.from({ length: 90 }, (_, i) => {
  const t = NOW - (90 - i) * 10;
  if (i >= 40 && i < 52) return null;
  return { t, cpu: i === 20 ? null : 35 + 25 * Math.sin(i / 9) + (i % 7), rx: 8000 + 6000 * Math.abs(Math.sin(i / 6)), tx: 2000 + 1500 * Math.abs(Math.cos(i / 5)) };
}).filter(Boolean);
const CHART_DOMAIN = { from: NOW - 900, to: NOW };
const percentFmt = (v) => `${Math.round(v)}%`;
const rateFmt = (v) => (v >= 1024 ? `${(v / 1024).toFixed(1)} KB/s` : `${Math.round(v)} B/s`);

const SAMPLE_ROWS = [
  { id: 1, name: 'alice', role: 'Administrator', devices: 3, used: 128, status: 'Active' },
  { id: 2, name: 'bob', role: 'Employee', devices: 1, used: 42, status: 'Active' },
  { id: 3, name: 'carol', role: 'Guest', devices: 0, used: 7, status: 'Disabled' },
];

const Section = ({ id, title, children }) => (
  <section aria-labelledby={id} className="mb-10">
    <h2 id={id} className="text-base font-semibold text-[var(--ink)] mb-3 pb-2 border-b border-[var(--surface-border)]">{title}</h2>
    {children}
  </section>
);

const Row = ({ children }) => <div className="flex flex-wrap items-center gap-2 mb-3">{children}</div>;

export const DesignSystemPage = () => {
  const showToast = useToast();
  const [theme, setTheme] = useState('dark');
  const [scheme, setScheme] = useState('blue');
  const [tab, setTab] = useState('one');
  const [vTab, setVTab] = useState('general');
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notify, setNotify] = useState(true);
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (scheme === 'blue') root.removeAttribute('data-scheme');
    else root.setAttribute('data-scheme', scheme);
    return () => { root.removeAttribute('data-theme'); root.removeAttribute('data-scheme'); };
  }, [theme, scheme]);

  const columns = [
    { key: 'name', header: 'User', sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'role', header: 'Role', sortValue: (r) => r.role },
    { key: 'devices', header: 'Devices', align: 'right', sortValue: (r) => r.devices },
    { key: 'used', header: 'Used (GB)', align: 'right', sortValue: (r) => r.used, className: 'tabular-nums' },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => (r.status === 'Disabled' ? <Badge tone="warning">Disabled</Badge> : r.status) },
  ];

  const runConfirm = () => {
    setConfirming(true);
    setTimeout(() => { setConfirming(false); setConfirm(false); showToast('Device record removed.', 'success'); }, 900);
  };

  return (
    <div className="min-h-full bg-[var(--canvas)] text-[var(--ink)]">
      <header className="sticky top-0 z-10 bg-[var(--canvas)] border-b border-[var(--surface-border)]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-end gap-4">
          <h1 className="text-base font-semibold mr-auto pb-2">VORLAN design system</h1>
          <SelectField label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </SelectField>
          <SelectField label="Accent" value={scheme} onChange={(e) => setScheme(e.target.value)}>
            {SCHEMES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </SelectField>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Section id="ds-colors" title="Colors">
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {SWATCHES.map(([token, label]) => (
              <li key={token} className="surface rounded-[var(--radius-lg)] p-3 flex items-center gap-3">
                <span aria-hidden="true" className="w-8 h-8 rounded-[var(--radius-md)] border border-[var(--surface-border-strong)] flex-shrink-0" style={{ background: `var(${token})` }} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <code className="block text-xs text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{token}</code>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="ds-type" title="Typography">
          <p className="text-2xl font-semibold mb-1">Heading 2xl</p>
          <p className="text-xl font-semibold mb-1">Heading xl</p>
          <p className="text-base font-semibold mb-1">Heading base</p>
          <p className="text-sm mb-1">Body sm - the quick brown fox jumps over the lazy dog.</p>
          <p className="text-sm text-[var(--ink-muted)] mb-1">Secondary sm muted</p>
          <p className="text-xs text-[var(--ink-faint)] mb-1">Hint xs faint</p>
          <p className="text-sm tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>Mono tabular: 1,234.56 GB  0987654321</p>
        </Section>

        <Section id="ds-buttons" title="Buttons">
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <Button loading={busy} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1500); }}>{busy ? 'Saving' : 'Save changes'}</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <IconButton label="Settings"><Settings size={18} aria-hidden="true" /></IconButton>
            <IconButton label="Delete"><Trash2 size={18} aria-hidden="true" /></IconButton>
          </Row>
        </Section>

        <Section id="ds-forms" title="Form controls">
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
            <TextField label="Username" value={name} onChange={(e) => setName(e.target.value)} hint="3-24 characters." required placeholder="alice" />
            <TextField label="Email" type="email" defaultValue="not-an-email" error="Enter a valid email address." />
            <SelectField label="Role" defaultValue="guest">
              <option value="admin">Administrator</option>
              <option value="employee">Employee</option>
              <option value="guest">Guest</option>
            </SelectField>
            <TextField label="Disabled" disabled defaultValue="Read only" />
          </div>
          <div className="mt-5 space-y-3 max-w-md">
            <Switch label="Email notifications" description="Get an email when a disk needs attention." checked={notify} onChange={setNotify} />
            <Checkbox label="I understand this affects every user" checked={agree} onChange={setAgree} />
          </div>
        </Section>

        <Section id="ds-status" title="Badges and meters">
          <Row>
            <Badge>Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Healthy</Badge>
            <Badge tone="warning">Degraded</Badge>
            <Badge tone="danger">Failed</Badge>
            <Badge tone="info">Scanning</Badge>
          </Row>
          <div className="max-w-md space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1"><span>Pool usage</span><span className="tabular-nums text-[var(--ink-muted)]">63 GB of 237 GB</span></div>
              <Meter value={63} max={237} label="Pool usage" valueText="63 GB of 237 GB" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span>Memory</span><span className="tabular-nums text-[var(--ink-muted)]">85%</span></div>
              <Meter value={85} label="Memory" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span>Disk</span><span className="tabular-nums text-[var(--ink-muted)]">96%</span></div>
              <Meter value={96} label="Disk" />
            </div>
          </div>
        </Section>

        <Section id="ds-cards" title="Cards and tabs">
          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Storage pool" actions={<Badge tone="success">Online</Badge>}>
              <p className="text-sm text-[var(--ink-muted)]">vorlan-pool, 237 GB</p>
            </Card>
            <Card title="Tabs">
              <Tabs
                idPrefix="ds"
                label="Example tabs"
                value={tab}
                onChange={setTab}
                tabs={[{ id: 'one', label: 'Overview' }, { id: 'two', label: 'Users' }, { id: 'three', label: 'Logs' }]}
                className="mb-3"
              />
              <TabPanel idPrefix="ds" id="one" value={tab}><p className="text-sm">Overview panel</p></TabPanel>
              <TabPanel idPrefix="ds" id="two" value={tab}><p className="text-sm">Users panel</p></TabPanel>
              <TabPanel idPrefix="ds" id="three" value={tab}><p className="text-sm">Logs panel</p></TabPanel>
            </Card>
            <Card title="Vertical tabs">
              <div className="grid grid-cols-[10rem_1fr] gap-4">
                <Tabs
                  idPrefix="dsv"
                  label="Settings sections"
                  orientation="vertical"
                  value={vTab}
                  onChange={setVTab}
                  tabs={[{ id: 'general', label: 'General' }, { id: 'network', label: 'Network' }, { id: 'security', label: 'Security' }]}
                />
                <div>
                  <TabPanel idPrefix="dsv" id="general" value={vTab}><p className="text-sm">General settings</p></TabPanel>
                  <TabPanel idPrefix="dsv" id="network" value={vTab}><p className="text-sm">Network settings</p></TabPanel>
                  <TabPanel idPrefix="dsv" id="security" value={vTab}><p className="text-sm">Security settings</p></TabPanel>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        <Section id="ds-menu" title="Menu">
          <Menu
            label="Applications"
            buttonContent={<><LayoutGrid size={16} aria-hidden="true" />Apps</>}
            buttonClassName="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm font-medium border border-[var(--surface-border-strong)] hover:bg-[var(--overlay-3)]"
            items={[
              { id: 'mon', label: 'Resource Monitor', icon: Activity, onSelect: () => showToast('Opened Resource Monitor.', 'info') },
              { id: 'files', label: 'Files', icon: Folder, onSelect: () => showToast('Opened Files.', 'info') },
              { separator: true },
              { id: 'off', label: 'Unavailable', icon: Settings, disabled: true, onSelect: () => {} },
            ]}
          />
        </Section>

        <Section id="ds-chart" title="Charts">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">CPU (one series, gap in the timeline)</h3>
              <AreaChart label="CPU usage" series={[{ key: 'cpu', label: 'CPU', color: 'var(--accent)', fill: true }]} points={CHART_POINTS} domain={CHART_DOMAIN} yMax={100} format={percentFmt} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Network (two series, auto scale)</h3>
              <AreaChart label="Network throughput" series={[{ key: 'rx', label: 'Download', color: 'var(--accent)' }, { key: 'tx', label: 'Upload', color: 'var(--ink-muted)', dashed: true }]} points={CHART_POINTS} domain={CHART_DOMAIN} format={rateFmt} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Not reported</h3>
              <AreaChart label="Disk throughput" series={[{ key: 'disk', label: 'Read', color: 'var(--accent)' }]} points={CHART_POINTS} domain={CHART_DOMAIN} format={rateFmt} emptyMessage="Disk throughput isn't reported on this system." />
            </div>
          </div>
        </Section>

        <Section id="ds-table" title="Data table">
          <DataTable caption="Sample users" columns={columns} rows={SAMPLE_ROWS} getRowId={(r) => r.id} initialSort={{ key: 'name', dir: 'asc' }} />
        </Section>

        <Section id="ds-overlays" title="Dialogs and notifications">
          <Row>
            <Button variant="secondary" onClick={() => setModal(true)}>Open dialog</Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>Confirm dialog</Button>
            <Button variant="secondary" onClick={() => showToast('Settings saved.', 'success')}>Success toast</Button>
            <Button variant="secondary" onClick={() => showToast('Disk usage is at 91%.', 'warning')}>Warning toast</Button>
            <Button variant="secondary" onClick={() => showToast('Could not reach the server.', 'error')}>Error toast</Button>
            <Button variant="secondary" onClick={() => showToast('A scan started in the background.', 'info')}>Info toast</Button>
          </Row>
          {modal && (
            <Modal title="Rename share" description="Pick a name people will recognise on the network." onClose={() => setModal(false)}>
              <TextField label="Share name" defaultValue="Family photos" />
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
                <Button onClick={() => { setModal(false); showToast('Share renamed.', 'success'); }}>Save</Button>
              </div>
            </Modal>
          )}
          {confirm && (
            <ConfirmDialog
              title="Remove this device record?"
              message="It will disappear from the list. A signed-in browser will show up again on its next request."
              confirmLabel="Remove"
              loading={confirming}
              onConfirm={runConfirm}
              onCancel={() => setConfirm(false)}
            />
          )}
        </Section>

        <Section id="ds-states" title="Loading, empty and error states">
          <div className="grid md:grid-cols-3 gap-4">
            <Card title="Loading">
              <div aria-busy="true" className="space-y-3">
                <Spinner label="Loading users" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
            <EmptyState icon={Inbox} title="No tasks yet" hint="Long-running work shows up here while it runs." action={<Button size="sm" variant="secondary">Start a task</Button>} />
            <ErrorState message="The server didn't respond. Check that VORLAN is running." onRetry={() => showToast('Retrying...', 'info')} />
          </div>
        </Section>
      </main>
    </div>
  );
};

export default DesignSystemPage;
