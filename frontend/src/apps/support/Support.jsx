import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Section, WindowLayout } from '../../components/layout/WindowLayout';
import { Button } from '../../components/ui/Button';
import { DescriptionList } from '../../components/ui/DescriptionList';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { downloadDiagnostics, errorMessage, getAbout } from '../../lib/adminApi';
import { formatDateTime } from '../../lib/format';
import { usePolling } from '../../lib/usePolling';

/** What this install is (version, where it keeps things) and a diagnostics file to send when something needs help. */
export const Support = () => {
  const showToast = useToast();
  const { data, error, reload } = usePolling(getAbout, 60000);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const name = await downloadDiagnostics();
      showToast(`Saved ${name}.`, 'success');
    } catch (err) {
      showToast(errorMessage(err, "Couldn't build the diagnostics file."), 'error');
    } finally {
      setDownloading(false);
    }
  };

  let body;
  if (error && !data) body = <ErrorState message={error} onRetry={reload} />;
  else if (!data) body = <div className="flex justify-center py-16"><Spinner label="Loading details" /></div>;
  else {
    body = (
      <div className="divide-y divide-[var(--surface-border)]">
        <Section title="About this VORLAN">
          <DescriptionList
            items={[
              { label: 'Product', value: data.product },
              { label: 'Version', value: data.version },
              { label: 'Running as', value: data.mode },
              { label: 'Started', value: formatDateTime(data.startedAt, { seconds: true }) },
              { label: 'Process ID', value: data.processId },
              { label: 'Port', value: data.port },
              { label: 'Node.js', value: data.nodeVersion },
              { label: 'Operating system', value: data.platform },
            ]}
          />
        </Section>

        <Section title="Where things are kept">
          <DescriptionList
            items={[
              { label: 'Installation folder', value: data.paths.install },
              { label: 'Database file', value: data.paths.database },
              { label: 'Stored files', value: data.paths.storage },
            ]}
          />
        </Section>

        <Section
          title="Diagnostics"
          description="A JSON file with this computer's specs, the state of every service, storage and network details, running tasks and the latest 200 log events. It has no passwords or keys, but it does include account names, so share it only with people you trust."
        >
          <Button onClick={download} loading={downloading}><Download size={16} aria-hidden="true" />Download diagnostics</Button>
        </Section>
      </div>
    );
  }

  return <WindowLayout>{body}</WindowLayout>;
};
