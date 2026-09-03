import React, { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

export const CamerasPage = () => {
  const [time, setTime] = useState(new Date());
  const [camUrl, setCamUrl] = useState(localStorage.getItem('vorlan_cam') || '');
  const [inputUrl, setInputUrl] = useState('');
  const [isEditing, setIsEditing] = useState(!localStorage.getItem('vorlan_cam'));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveCamera = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setCamUrl(inputUrl);
    localStorage.setItem('vorlan_cam', inputUrl);
    setIsEditing(false);
  };

  const handleReset = () => {
    setIsEditing(true);
    setInputUrl(camUrl);
  };

  return (
    <div className="p-4 md:p-10 h-full flex flex-col max-w-6xl mx-auto w-full">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Security Camera</h1>
            <p className="text-sm text-[var(--ink-muted)] mt-0.5">Live view from your connected camera</p>
          </div>
        </div>

        {!isEditing && camUrl ? (
          <button
            onClick={handleReset}
            className="glass px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 w-max hover:brightness-125 transition-all"
            style={{ color: '#ffb3c0' }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--hue-rose)', boxShadow: '0 0 8px var(--hue-rose)' }} />
            Camera connected — tap to change
          </button>
        ) : (
          <div className="glass px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 w-max" style={{ color: '#ffd9a3' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--hue-amber)' }} />
            No camera connected
          </div>
        )}
      </div>

      <div className="flex-1 w-full bg-black rounded-[32px] overflow-hidden relative border border-white/10 shadow-2xl flex items-center justify-center min-h-[480px]">
        {isEditing ? (
          <GlassPanel strong className="z-30 p-8 max-w-md w-full mx-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(145deg, #ff9bad, var(--hue-rose))' }}>
              <Camera size={20} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[var(--ink)]">Connect your camera</h3>
            <p className="text-xs text-[var(--ink-muted)] mb-6">Open your camera app, copy its network address, and paste it below.</p>
            <form onSubmit={handleSaveCamera} className="flex gap-2">
              <input
                type="text"
                placeholder="http://192.168.1.20:4747/video"
                className="flex-1 bg-black/30 border border-white/10 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/30 text-[var(--ink)] transition-all"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
              />
              <Button type="submit" variant="primary" size="md">Connect</Button>
            </form>
          </GlassPanel>
        ) : (
          <>
            <div className="absolute top-6 left-6 z-10 flex items-center gap-2 font-semibold text-xs md:text-sm text-white/90 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--hue-rose)' }} />
              LIVE
            </div>
            <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-1 font-mono text-xs md:text-sm text-white/90 drop-shadow-lg font-bold">
              <span>{time.toLocaleDateString().toUpperCase()}</span>
              <span>{time.toLocaleTimeString()}</span>
            </div>

            <img
              src={camUrl}
              alt="Live camera feed"
              className="w-full h-full object-cover filter contrast-125 saturate-50 brightness-90"
            />

            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] z-20 mix-blend-overlay" />
          </>
        )}
      </div>
    </div>
  );
};
