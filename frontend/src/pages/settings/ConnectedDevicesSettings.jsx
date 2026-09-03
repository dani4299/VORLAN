import React, { useEffect, useState } from 'react';
import { Smartphone, Laptop, Monitor, Pencil, Check, X } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { listDevices, renameDevice, isThisDevice } from '../../lib/devicesApi';
import { formatBytes, formatRelativeTime } from '../../lib/format';

const deviceIcon = (label) => {
  if (/iPhone|iPad|Android/.test(label)) return Smartphone;
  if (/Windows|Mac|Linux/.test(label)) return Laptop;
  return Monitor;
};

const DeviceRow = ({ device, onRenamed }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(device.label);
  const [saving, setSaving] = useState(false);
  const Icon = deviceIcon(device.label);
  const mine = isThisDevice(device.id);

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === device.label) { setEditing(false); setValue(device.label); return; }
    setSaving(true);
    renameDevice(device.id, trimmed)
      .then(() => onRenamed(device.id, trimmed))
      .finally(() => { setSaving(false); setEditing(false); });
  };

  const cancel = () => { setValue(device.label); setEditing(false); };

  return (
    <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 border-b border-[var(--surface-border)] last:border-b-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 chip">
        <Icon size={17} className="text-[var(--ink-muted)]" />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              className="min-w-0 flex-1 bg-[var(--overlay-1)] border border-[var(--surface-border)] rounded-lg px-2.5 py-1 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
            <button onClick={save} disabled={saving} className="text-[var(--accent)] hover:brightness-125 disabled:opacity-40 flex-shrink-0" title="Save">
              <Check size={16} />
            </button>
            <button onClick={cancel} disabled={saving} className="text-[var(--ink-muted)] hover:text-[var(--ink)] flex-shrink-0" title="Cancel">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--ink)] truncate">{device.label}</p>
            {mine && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}>
                This device
              </span>
            )}
            <button onClick={() => setEditing(true)} className="text-[var(--ink-faint)] hover:text-[var(--ink)] flex-shrink-0" title="Rename device">
              <Pencil size={12} />
            </button>
          </div>
        )}
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Active {formatRelativeTime(device.lastSeen)} · {device.ip || 'Unknown IP'}
        </p>
      </div>

      <p className="text-sm text-[var(--ink-muted)] flex-shrink-0">{formatBytes(device.bytes)}</p>
    </div>
  );
};

export const ConnectedDevicesSettings = () => {
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listDevices()
      .then(setDevices)
      .catch((err) => setError(err.response?.data?.error || "Couldn't load your devices."));
  }, []);

  const handleRenamed = (id, label) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, label } : d)));
  };

  if (error) {
    return <p className="text-sm text-center py-10" style={{ color: 'var(--hue-rose)' }}>{error}</p>;
  }

  if (!devices) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }

  return (
    <div className="glass rounded-[24px] p-6 md:p-7 max-w-lg">
      {devices.length === 0 ? (
        <EmptyState icon={Smartphone} title="No devices yet" hint="Devices that sign in to your account will show up here." />
      ) : (
        devices.map((device) => <DeviceRow key={device.id} device={device} onRenamed={handleRenamed} />)
      )}
    </div>
  );
};
