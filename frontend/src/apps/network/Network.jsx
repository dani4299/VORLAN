import React, { useMemo } from 'react';
import { Copy } from 'lucide-react';
import { Section, WindowLayout } from '../../components/layout/WindowLayout';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { DescriptionList } from '../../components/ui/DescriptionList';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { getNetwork } from '../../lib/adminApi';
import { formatBytes, formatRate } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

/** Network interfaces with live traffic, plus the addresses other devices use to reach VORLAN. */
export const Network = () => {
  const showToast = useToast();
  const { data, error, reload } = usePolling(getNetwork, 3000);

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Address copied.', 'success');
    } catch {
      // The clipboard API only exists on secure pages (https or localhost), so over plain http on the LAN it isn't there.
      showToast("Couldn't copy here. Select the address and copy it instead.", 'warning');
    }
  };

  const columns = useMemo(() => [
    {
      key: 'name', header: 'Interface', sortValue: (n) => n.name.toLowerCase(),
      render: (n) => (
        <div className="min-w-[10rem]">
          <p className="font-medium">{n.name}</p>
          {n.label && <p className="text-xs text-[var(--ink-muted)]">{n.label}</p>}
        </div>
      ),
    },
    {
      key: 'up', header: 'Status', sortValue: (n) => (n.up ? 0 : 1),
      render: (n) => <span style={{ color: n.up ? 'var(--success)' : 'var(--ink-muted)' }} className="font-medium">{n.up ? 'Connected' : 'Disconnected'}</span>,
    },
    { key: 'ip4', header: 'IPv4 address', sortValue: (n) => n.ip4 || '', render: (n) => n.ip4 || 'None', className: 'tabular-nums' },
    { key: 'mac', header: 'MAC address', render: (n) => n.mac || 'Unknown', className: 'tabular-nums whitespace-nowrap' },
    { key: 'speed', header: 'Link speed', align: 'right', sortValue: (n) => n.speedMbps, render: (n) => (n.speedMbps ? `${n.speedMbps} Mbps` : 'Unknown'), className: 'tabular-nums whitespace-nowrap' },
    { key: 'rx', header: 'Download', align: 'right', sortValue: (n) => n.rxPerSec, render: (n) => formatRate(n.rxPerSec), className: 'tabular-nums whitespace-nowrap' },
    { key: 'tx', header: 'Upload', align: 'right', sortValue: (n) => n.txPerSec, render: (n) => formatRate(n.txPerSec), className: 'tabular-nums whitespace-nowrap' },
    { key: 'rxTotal', header: 'Received', align: 'right', sortValue: (n) => n.rxBytes, render: (n) => (n.rxBytes == null ? '—' : formatBytes(n.rxBytes)), className: 'tabular-nums whitespace-nowrap' },
    { key: 'txTotal', header: 'Sent', align: 'right', sortValue: (n) => n.txBytes, render: (n) => (n.txBytes == null ? '—' : formatBytes(n.txBytes)), className: 'tabular-nums whitespace-nowrap' },
  ], []);

  let body;
  if (error && !data) body = <ErrorState message={error} onRetry={reload} />;
  else if (!data) body = <div className="flex justify-center py-16"><Spinner label="Reading network" /></div>;
  else {
    body = (
      <div className="divide-y divide-[var(--surface-border)]">
        <Section title="Open VORLAN from another device" description={data.urls.some((u) => u.secure) ? 'Type one of these addresses into a browser on the same network. The first visit shows a certificate warning: check it against the fingerprint in Support before continuing.' : 'Type one of these addresses into a browser on the same network.'}>
          {data.urls.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">This computer isn't connected to a network, so there's no address to share.</p>
          ) : (
            <ul className="space-y-2">
              {data.urls.map((u) => (
                <li key={u.url} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] select-all break-all">{u.url}</p>
                    <p className="text-xs text-[var(--ink-muted)]">On {u.interface}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => copy(u.url)} aria-label={`Copy ${u.url}`}><Copy size={14} aria-hidden="true" />Copy</Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Interfaces" description="Traffic updates every 3 seconds.">
          <DataTable caption="Network interfaces" columns={columns} rows={data.interfaces} getRowId={(n) => n.name} initialSort={{ key: 'up', dir: 'asc' }} empty="No network interfaces were found." />
        </Section>

        <Section title="Settings">
          <DescriptionList
            items={[
              { label: 'Computer name', value: data.hostname },
              { label: 'Main interface', value: data.defaultInterface },
              { label: 'Gateway', value: data.gateway },
              { label: 'DNS servers', value: data.dnsServers.length ? data.dnsServers.join(', ') : null },
              { label: 'VORLAN port', value: data.port },
              ...(data.httpsPort ? [{ label: 'Secure (HTTPS) port', value: data.httpsPort }] : []),
            ]}
          />
        </Section>
      </div>
    );
  }

  return <WindowLayout>{body}</WindowLayout>;
};
