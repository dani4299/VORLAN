import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { errorMessage, installApp } from '../../lib/adminApi';

/**
 * One dialog for both install paths: pass `catalogEntry` to install a curated app (just a name and
 * an optional port), or nothing to install any Docker image by name (which also needs the container
 * port and data path, since there's no catalog entry to default those from).
 */
export const InstallDialog = ({ catalogEntry, onClose, onInstalled }) => {
  const [name, setName] = useState(catalogEntry?.name || '');
  const [image, setImage] = useState('');
  const [port, setPort] = useState('');
  const [containerPort, setContainerPort] = useState('');
  const [volumePath, setVolumePath] = useState('/data');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const portProblem = port !== '' && (!Number.isInteger(Number(port)) || Number(port) < 1024 || Number(port) > 65535)
    ? 'Enter a number between 1024 and 65535, or leave it blank to pick one automatically.' : null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const app = await installApp({
        catalogKey: catalogEntry?.key,
        image: catalogEntry ? undefined : image.trim(),
        name: name.trim() || undefined,
        port: port === '' ? undefined : Number(port),
        containerPort: catalogEntry || containerPort === '' ? undefined : Number(containerPort),
        volumePath: catalogEntry ? undefined : volumePath.trim(),
      });
      onInstalled(app);
    } catch (err) {
      setError(errorMessage(err, "Couldn't install that app."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={catalogEntry ? `Install ${catalogEntry.name}` : 'Install a Docker image'}
      description={catalogEntry ? catalogEntry.description : 'Runs a container from wherever this image lives. Only install images you trust.'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder={catalogEntry ? catalogEntry.name : 'My app'} data-autofocus={catalogEntry ? true : undefined} />
        {!catalogEntry && (
          <>
            <TextField
              label="Docker image" value={image} onChange={(e) => setImage(e.target.value)} required data-autofocus
              placeholder="e.g. lscr.io/linuxserver/plex:latest" hint="From Docker Hub or any registry you can reach."
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Container port" type="number" min="1" max="65535" value={containerPort} onChange={(e) => setContainerPort(e.target.value)}
                placeholder="80" hint="The port the app listens on inside its container."
              />
              <TextField
                label="Data path" value={volumePath} onChange={(e) => setVolumePath(e.target.value)}
                placeholder="/data" hint="Where inside the container its files are kept."
              />
            </div>
          </>
        )}
        <TextField
          label="Port on this computer" type="number" min="1024" max="65535" value={port} onChange={(e) => setPort(e.target.value)}
          error={portProblem} placeholder="Chosen automatically" hint="Leave blank to have VORLAN pick a free one."
        />
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!!portProblem || (!catalogEntry && !image.trim())}>Install</Button>
        </div>
      </form>
    </Modal>
  );
};
