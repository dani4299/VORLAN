import React, { useMemo, useState } from 'react';
import { AreaChart } from '../../components/charts/AreaChart';
import { DataTable } from '../../components/ui/DataTable';
import { DescriptionList } from '../../components/ui/DescriptionList';
import { ErrorState } from '../../components/ui/ErrorState';
import { SelectField } from '../../components/ui/Field';
import { Meter } from '../../components/ui/Meter';
import { Spinner } from '../../components/ui/Spinner';
import { TabPanel, Tabs } from '../../components/ui/Tabs';
import { getProcesses, getSystemInfo } from '../../lib/adminApi';
import { formatBytes, formatRate, formatUptime } from '../../lib/format';
import { RANGES, useMetrics } from '../../lib/useMetrics';
import { usePolling } from '../../lib/usePolling';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'processes', label: 'Processes' },
  { id: 'storage', label: 'Storage' },
  { id: 'system', label: 'System' },
];

const percent = (v) => `${Math.round(v)}%`;
const lastValue = (points, key) => {
  for (let i = points.length - 1; i >= 0; i--) if (typeof points[i][key] === 'number') return points[i][key];
  return null;
};

const Loading = ({ label }) => <div className="flex justify-center py-16"><Spinner label={label} /></div>;

/** One metric: its name and current reading on one line, the chart underneath. */
const Metric = ({ id, title, reading, children }) => (
  <section aria-labelledby={id} className="py-4 border-b border-[var(--surface-border)]">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 mb-2">
      <h3 id={id} className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
      <p className="text-sm tabular-nums text-[var(--ink-muted)]">{reading}</p>
    </div>
    {children}
  </section>
);

const Overview = ({ info }) => {
  const [range, setRange] = useState('live');
  const { points, domain, loading, error } = useMetrics(range);
  const rangeLabel = RANGES.find((r) => r.id === range).label.toLowerCase();

  const cpu = lastValue(points, 'cpu');
  const memUsed = lastValue(points, 'memUsed');
  const memTotal = lastValue(points, 'memTotal');
  const rx = lastValue(points, 'netRx');
  const tx = lastValue(points, 'netTx');
  const diskRead = lastValue(points, 'diskRead');
  const diskWrite = lastValue(points, 'diskWrite');

  const cpuSeries = useMemo(() => [{ key: 'cpu', label: 'CPU', color: 'var(--accent)', fill: true }], []);
  const memSeries = useMemo(() => [{ key: 'memPct', label: 'Memory', color: 'var(--accent)', fill: true }], []);
  const netSeries = useMemo(() => [
    { key: 'netRx', label: 'Download', color: 'var(--accent)' },
    { key: 'netTx', label: 'Upload', color: 'var(--ink-muted)', dashed: true },
  ], []);
  const diskSeries = useMemo(() => [
    { key: 'diskRead', label: 'Read', color: 'var(--accent)' },
    { key: 'diskWrite', label: 'Write', color: 'var(--ink-muted)', dashed: true },
  ], []);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <p className="text-sm text-[var(--ink-muted)]">
          {info ? `${info.host.hostname} · ${info.host.distro || info.host.platform} · up ${formatUptime(info.host.uptimeSeconds)}` : ''}
        </p>
        <div className="w-48">
          <SelectField label="Time range" value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </SelectField>
        </div>
      </div>

      {error && !points.length ? (
        <div className="mt-4"><ErrorState message={error} /></div>
      ) : loading ? (
        <Loading label="Loading metrics" />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] gap-x-8">
          <Metric id="rm-cpu" title="Processor" reading={cpu === null ? 'Waiting for data' : `${cpu.toFixed(1)}%${info ? ` of ${info.cpu.cores} threads` : ''}`}>
            <AreaChart label={`Processor usage, ${rangeLabel}`} series={cpuSeries} points={points} domain={domain} yMax={100} format={percent} emptyMessage="No processor data for this period." />
          </Metric>
          <Metric id="rm-mem" title="Memory" reading={memUsed === null ? 'Waiting for data' : `${formatBytes(memUsed)} of ${formatBytes(memTotal)} (${percent((memUsed / memTotal) * 100)})`}>
            <AreaChart label={`Memory usage, ${rangeLabel}`} series={memSeries} points={points} domain={domain} yMax={100} format={percent} emptyMessage="No memory data for this period." />
          </Metric>
          <Metric id="rm-net" title="Network" reading={rx === null && tx === null ? 'Waiting for data' : `Download ${formatRate(rx)} · Upload ${formatRate(tx)}`}>
            <AreaChart label={`Network throughput, ${rangeLabel}`} series={netSeries} points={points} domain={domain} scale="bytes" format={formatRate} emptyMessage="No network data for this period." />
          </Metric>
          <Metric id="rm-disk" title="Disk throughput" reading={diskRead === null && diskWrite === null ? 'Not reported' : `Read ${formatRate(diskRead)} · Write ${formatRate(diskWrite)}`}>
            <AreaChart label={`Disk throughput, ${rangeLabel}`} series={diskSeries} points={points} domain={domain} scale="bytes" format={formatRate} emptyMessage="Disk throughput isn't reported on this system." />
          </Metric>
        </div>
      )}
    </div>
  );
};

const Processes = () => {
  const { data, error, reload } = usePolling(() => getProcesses(20), 3000);
  const columns = useMemo(() => [
    { key: 'name', header: 'Process', sortValue: (p) => p.name.toLowerCase(), render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'pid', header: 'PID', align: 'right', sortValue: (p) => p.pid, className: 'tabular-nums' },
    { key: 'cpu', header: 'CPU', align: 'right', sortValue: (p) => p.cpu, render: (p) => `${p.cpu.toFixed(1)}%`, className: 'tabular-nums' },
    { key: 'mem', header: 'Memory', align: 'right', sortValue: (p) => p.memBytes, render: (p) => formatBytes(p.memBytes), className: 'tabular-nums' },
  ], []);

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading processes" />;
  return (
    <div>
      <p className="text-sm text-[var(--ink-muted)] mb-3">{data.total} processes running, busiest shown first.</p>
      <DataTable caption="Running processes" columns={columns} rows={data.list} getRowId={(p) => p.pid} initialSort={{ key: 'cpu', dir: 'desc' }} dense />
    </div>
  );
};

const Storage = ({ info, error, reload }) => {
  const columns = useMemo(() => [
    { key: 'mount', header: 'Volume', sortValue: (d) => d.mount, render: (d) => <span className="font-medium">{d.mount}</span> },
    { key: 'type', header: 'Type', sortValue: (d) => d.type },
    { key: 'used', header: 'Used', align: 'right', sortValue: (d) => d.usedBytes, render: (d) => formatBytes(d.usedBytes), className: 'tabular-nums' },
    { key: 'free', header: 'Free', align: 'right', sortValue: (d) => d.availableBytes, render: (d) => formatBytes(d.availableBytes), className: 'tabular-nums' },
    { key: 'size', header: 'Size', align: 'right', sortValue: (d) => d.sizeBytes, render: (d) => formatBytes(d.sizeBytes), className: 'tabular-nums' },
    {
      key: 'usage', header: 'Usage', sortValue: (d) => d.usedBytes / d.sizeBytes,
      render: (d) => {
        const pct = (d.usedBytes / d.sizeBytes) * 100;
        return (
          <div className="flex items-center gap-2 min-w-[8rem]">
            <Meter value={d.usedBytes} max={d.sizeBytes} label={`${d.mount} usage`} valueText={`${formatBytes(d.usedBytes)} of ${formatBytes(d.sizeBytes)}`} className="flex-1" />
            <span className="tabular-nums text-[var(--ink-muted)] w-10 text-right">{Math.round(pct)}%</span>
          </div>
        );
      },
    },
  ], []);

  if (error && !info) return <ErrorState message={error} onRetry={reload} />;
  if (!info) return <Loading label="Loading volumes" />;
  return <DataTable caption="Storage volumes" columns={columns} rows={info.disks} getRowId={(d) => d.mount} empty="No volumes were reported." />;
};

const System = ({ info, error, reload }) => {
  const serviceColumns = useMemo(() => [
    { key: 'name', header: 'Service', sortValue: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'status', header: 'Status', sortValue: (s) => s.status, render: (s) => <span style={{ color: s.status === 'running' ? 'var(--success)' : 'var(--danger)' }}>{s.status === 'running' ? 'Running' : 'Stopped'}</span> },
    { key: 'detail', header: 'Details', render: (s) => <span className="text-[var(--ink-muted)]">{s.detail}</span> },
  ], []);

  if (error && !info) return <ErrorState message={error} onRetry={reload} />;
  if (!info) return <Loading label="Loading system information" />;
  const { host, cpu, memory } = info;
  return (
    <div className="space-y-6">
      <DescriptionList
        className="max-w-2xl"
        items={[
          { label: 'Hostname', value: host.hostname },
          { label: 'Operating system', value: [host.distro || host.platform, host.release].filter(Boolean).join(' ') },
          { label: 'Architecture', value: host.arch },
          { label: 'Processor', value: cpu.model || 'Unknown' },
          { label: 'Cores', value: `${cpu.cores} logical${cpu.physicalCores ? `, ${cpu.physicalCores} physical` : ''}` },
          ...(cpu.temperatureC !== null ? [{ label: 'Processor temperature', value: `${cpu.temperatureC.toFixed(0)} °C` }] : []),
          { label: 'Memory', value: formatBytes(memory.totalBytes) },
          { label: 'Uptime', value: formatUptime(host.uptimeSeconds) },
          { label: 'VORLAN', value: `Version ${host.vorlanVersion}, Node.js ${host.nodeVersion}` },
        ]}
      />
      <div>
        <h3 className="text-sm font-semibold text-[var(--ink)] mb-2">Services</h3>
        <DataTable caption="Services" columns={serviceColumns} rows={info.services} getRowId={(s) => s.id} />
      </div>
    </div>
  );
};

export const ResourceMonitor = () => {
  const [tab, setTab] = useState('overview');
  const { data: info, error: infoError, reload: reloadInfo } = usePolling(getSystemInfo, 30000);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 flex-shrink-0">
        <Tabs idPrefix="rm" label="Resource Monitor sections" tabs={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <TabPanel idPrefix="rm" id="overview" value={tab}><Overview info={info} /></TabPanel>
        <TabPanel idPrefix="rm" id="processes" value={tab}><Processes /></TabPanel>
        <TabPanel idPrefix="rm" id="storage" value={tab}><Storage info={info} error={infoError} reload={reloadInfo} /></TabPanel>
        <TabPanel idPrefix="rm" id="system" value={tab}><System info={info} error={infoError} reload={reloadInfo} /></TabPanel>
      </div>
    </div>
  );
};
