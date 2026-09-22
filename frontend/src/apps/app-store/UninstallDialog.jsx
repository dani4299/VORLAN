import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { errorMessage, uninstallApp } from '../../lib/adminApi';

export const UninstallDialog = ({ app, onClose, onUninstalled }) => {
  const [removeData, setRemoveData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await uninstallApp(app.id, removeData);
      onUninstalled();
    } catch (err) {
      setError(errorMessage(err, "Couldn't uninstall that app."));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Uninstall ${app.name}?`} description="Its container is stopped and removed." onClose={onClose} role="alertdialog">
      <form onSubmit={submit} className="space-y-4">
        <Checkbox label="Also delete its files" checked={removeData} onChange={setRemoveData} />
        <p className="text-xs text-[var(--ink-muted)]">
          {removeData ? "Everything this app stored is deleted for good. This can't be undone." : "Its files stay on disk, so reinstalling later can pick up where it left off."}
        </p>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy} data-autofocus>Cancel</Button>
          <Button type="submit" variant="danger" loading={busy}>Uninstall</Button>
        </div>
      </form>
    </Modal>
  );
};
