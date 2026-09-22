import React, { useState } from 'react';
import { Power, RotateCw } from 'lucide-react';
import { Section, WindowLayout } from '../../components/layout/WindowLayout';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DescriptionList } from '../../components/ui/DescriptionList';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { errorMessage, getServices, restartVorlan, stopVorlan } from '../../lib/adminApi';
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
  const showToast = useToast();
  const { data, error, reload } = usePolling(getServices, 5000);
  const [pending, setPending] = useState(null); // 'restart' | 'stop'
  const [acting, setActing] = useState(false);

  const confirmAction = async () => {
    setActing(true);
    try {
      if (pending === 'restart') {
        await restartVorlan();
        showToast("Restarting VORLAN. This window will reconnect on its own in a few seconds.", 'success');
      } else {
        await stopVorlan();
        showToast("VORLAN has been stopped. Start it again from this computer with \"systemctl --user start vorlan\", or the desktop shortcut.", 'success');
      }
    } catch (err) {
      showToast(errorMessage(err, `Couldn't ${pending} VORLAN.`), 'error');
    } finally {
      setActing(false);
      setPending(null);
    }
  };

  let body;
  if (error && !data) body = <ErrorState message={error} onRetry={reload} />;
  else if (!data) body = <div className="flex justify-center py-16"><Spinner label="Checking services" /></div>;
  else {
    body = (
      <>
        <p className="text-sm text-[var(--ink-muted)] mb-5" aria-live="polite">Checked {formatRelativeTime(data.checkedAt).toLowerCase()} on {data.host}. Updates every 5 seconds.</p>
        <div className="divide-y divide-[var(--surface-border)]">
          {data.services.map((service) => (
            <Section
              key={service.id}
              title={service.name}
              description={service.summary}
              actions={(
                <div className="flex items-center gap-3">
                  {service.controllable && (
                    <div className="flex items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setPending('restart')}><RotateCw size={13} aria-hidden="true" />Restart</Button>
                      <Button variant="danger" size="sm" onClick={() => setPending('stop')}><Power size={13} aria-hidden="true" />Stop</Button>
                    </div>
                  )}
                  <StatusText status={service.status} />
                </div>
              )}
            >
              <DescriptionList items={service.details.map((d) => ({ label: d.label, value: show(d) }))} />
            </Section>
          ))}
        </div>
      </>
    );
  }

  return (
    <WindowLayout>
      {body}
      {pending === 'restart' && (
        <ConfirmDialog
          title="Restart VORLAN?"
          message="Every signed-in device is disconnected for a few seconds while it comes back up. This window reconnects on its own once it's ready."
          confirmLabel="Restart"
          loading={acting}
          onConfirm={confirmAction}
          onCancel={() => setPending(null)}
        />
      )}
      {pending === 'stop' && (
        <ConfirmDialog
          title="Stop VORLAN?"
          message="Nothing runs until it's started again - either the next time this computer restarts (it stays set to start automatically), or sooner with systemctl --user start vorlan or the desktop shortcut."
          confirmLabel="Stop VORLAN"
          tone="danger"
          loading={acting}
          onConfirm={confirmAction}
          onCancel={() => setPending(null)}
        />
      )}
    </WindowLayout>
  );
};
