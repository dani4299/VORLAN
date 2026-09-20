import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { getConnectQr } from '../../lib/systemApi';

/** A QR code that opens VORLAN on a phone that's on the same network. */
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
    <Modal title="Connect a phone" description="Scan this with the phone's camera while it's on the same network as VORLAN." onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner label="Loading the QR code" /></div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <p role="alert" className="text-sm text-center text-[var(--danger)]">{error}</p>
          <Button variant="secondary" onClick={load}>Try again</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* A QR code needs a light background around it to scan, whatever the theme. */}
          <img src={data.qr} alt="QR code that opens VORLAN" className="w-56 h-56 rounded-[var(--radius-md)] border border-[var(--surface-border-strong)] bg-white p-2" />
          <p className="text-sm text-[var(--ink-muted)] text-center break-all">Or type <span className="font-medium text-[var(--ink)] select-all">{data.url}</span></p>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
};
