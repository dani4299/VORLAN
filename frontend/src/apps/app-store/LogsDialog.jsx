import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { getAppLogs } from '../../lib/adminApi';
import { usePolling } from '../../lib/usePolling';

/** The recent output of an app's container, refreshed every few seconds while open. */
export const LogsDialog = ({ app, onClose }) => {
  const { data: logs, error, reload } = usePolling(() => getAppLogs(app.id), 4000);

  return (
    <Modal title={`${app.name} - logs`} description="The most recent output from this app's container." onClose={onClose} size="lg">
      <div className="flex justify-end mb-2">
        <Button variant="secondary" size="sm" onClick={reload}><RefreshCw size={14} aria-hidden="true" />Refresh</Button>
      </div>
      {error && logs == null ? (
        <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>
      ) : logs == null ? (
        <div className="flex justify-center py-10"><Spinner label="Loading logs" /></div>
      ) : (
        <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-[var(--canvas)] border border-[var(--surface-border)] rounded-[var(--radius-md)] p-3 max-h-[50vh] overflow-y-auto">
          {logs || 'No output yet.'}
        </pre>
      )}
    </Modal>
  );
};
