import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { getConnectQr } from '../../lib/systemApi';

export const ConnectDeviceModal = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    getConnectQr()
      .then((res) => setData(res))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load the QR code. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Modal title="Connect a device" onClose={onClose}>
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-10">
          <Spinner />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-center" style={{ color: 'var(--hue-rose)' }}>{error}</p>
          <Button variant="secondary" size="md" onClick={load}>Try again</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <img src={data.qr} alt="VORLAN connect QR code" className="w-56 h-56 rounded-2xl" />
          <p className="text-sm text-[var(--ink-muted)] text-center break-all">
            Scan to open <span className="font-semibold text-[var(--ink)]">{data.url}</span>
          </p>
          <p className="text-xs text-[var(--ink-faint)] text-center">
            Make sure you're connected to the VORLAN network.
          </p>
          <Button variant="primary" size="md" className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
};
