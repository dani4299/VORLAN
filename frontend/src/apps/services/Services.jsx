import React from 'react';
import { Section, WindowLayout } from '../../components/layout/WindowLayout';
import { DescriptionList } from '../../components/ui/DescriptionList';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { getServices } from '../../lib/adminApi';
import { formatBytes, formatDateTime, formatDuration, formatNumber, formatRelativeTime } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

const FORMATTERS = {
  bytes: formatBytes,
  number: formatNumber,
  ms: formatDuration,
  time: (iso) => (iso ? formatDateTime(iso, { seconds: true }) : null),
};

const show = (detail) => {
  if (detail.value === null || detail.value === undefined) return null;
  const format = FORMATTERS[detail.kind];
  return format ? format(detail.value) : detail.value;
};

const StatusText = ({ status }) => (
  <span className="text-sm font-medium" style={{ color: status === 'running' ? 'var(--success)' : 'var(--danger)' }}>
    {status === 'running' ? 'Running' : 'Stopped'}
  </span>
);

/** Health of each part VORLAN is made of: the API, the database, the metrics sampler, the task queue and the AI engine. */
export const Services = () => {
  const { data, error, reload } = usePolling(getServices, 5000);

  let body;
  if (error && !data) body = <ErrorState message={error} onRetry={reload} />;
  else if (!data) body = <div className="flex justify-center py-16"><Spinner label="Checking services" /></div>;
  else {
    body = (
      <>
        <p className="text-sm text-[var(--ink-muted)] mb-5" aria-live="polite">Checked {formatRelativeTime(data.checkedAt).toLowerCase()} on {data.host}. Updates every 5 seconds.</p>
        <div className="divide-y divide-[var(--surface-border)]">
          {data.services.map((service) => (
            <Section key={service.id} title={service.name} description={service.summary} actions={<StatusText status={service.status} />}>
              <DescriptionList items={service.details.map((d) => ({ label: d.label, value: show(d) }))} />
            </Section>
          ))}
        </div>
      </>
    );
  }

  return <WindowLayout>{body}</WindowLayout>;
};
