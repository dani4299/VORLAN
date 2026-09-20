import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';

/** A live camera feed from an address the administrator pastes in. The address is kept in this browser only. */
export const CamerasPage = () => {
  const [time, setTime] = useState(new Date());
  const [camUrl, setCamUrl] = useState(localStorage.getItem('vorlan_cam') || '');
  const [inputUrl, setInputUrl] = useState('');
  const [isEditing, setIsEditing] = useState(!localStorage.getItem('vorlan_cam'));
  const [feedFailed, setFeedFailed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveCamera = (e) => {
    e.preventDefault();
    const url = inputUrl.trim();
    if (!url) return;
    setCamUrl(url);
    localStorage.setItem('vorlan_cam', url);
    setFeedFailed(false);
    setIsEditing(false);
  };

  const handleChange = () => {
    setIsEditing(true);
    setInputUrl(camUrl);
  };

  const connected = !isEditing && !!camUrl;

  return (
    <div className="p-4 md:p-8 h-full flex flex-col max-w-6xl mx-auto w-full overflow-y-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--ink)]">Camera</h1>
          <p className="text-sm text-[var(--ink-muted)]">{connected ? 'Live view from the connected camera.' : 'No camera is connected.'}</p>
        </div>
        {connected && <Button variant="secondary" onClick={handleChange}>Change camera</Button>}
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveCamera} className="surface rounded-[var(--radius-lg)] p-5 max-w-lg space-y-4">
          <TextField
            label="Camera address"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="http://192.168.1.20:4747/video"
            hint="Open your camera app, copy its network address, and paste it here."
            autoFocus
            required
          />
          <div className="flex gap-2">
            <Button type="submit">Connect</Button>
            {camUrl && <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>}
          </div>
        </form>
      ) : (
        <div data-wallpaper-tone="light" className="relative w-full min-h-[320px] flex-1 rounded-[var(--radius-lg)] overflow-hidden border border-[var(--surface-border-strong)] bg-black flex items-center justify-center">
          {feedFailed ? (
            <div className="p-6 text-center">
              <p role="alert" className="text-sm text-[var(--wp-ink)]">Can't reach the camera at this address.</p>
              <Button variant="secondary" className="mt-4 bg-[var(--canvas-elevated)]" onClick={handleChange}>Change camera</Button>
            </div>
          ) : (
            <>
              <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-[var(--radius-sm)] bg-black/70 text-xs text-[var(--wp-ink)] tabular-nums">
                {time.toLocaleDateString()} {time.toLocaleTimeString()}
              </div>
              <img src={camUrl} alt="Live camera feed" onError={() => setFeedFailed(true)} className="w-full h-full object-contain" />
            </>
          )}
        </div>
      )}
    </div>
  );
};
