import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Settings, User, Pencil, Check, Moon, Sun } from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';
import { IconButton } from '../../components/ui/Button';
import { WallpaperLayer, getWallpaperTextTone } from '../../components/dashboard/WallpaperLayer';
import { WallpaperSheet } from '../../components/dashboard/WallpaperSheet';
import { AccountSettingsModal } from '../../components/dashboard/AccountSettingsModal';
import { ConnectDeviceButton } from '../../components/dashboard/ConnectDeviceButton';
import { ConnectDeviceModal } from '../../components/dashboard/ConnectDeviceModal';
import { DigitalClock } from '../../components/dashboard/DigitalClock';
import { TileGrid } from '../../components/dashboard/TileGrid';
import { pickGreeting } from '../../lib/greetings';

export const HomePage = () => {
  const navigate = useNavigate();
  const { profilePic, username, fullName } = useProfile();
  const { effectiveMode, toggleTheme, wallpaper } = useTheme();
  const textTone = getWallpaperTextTone(wallpaper);
  const displayName = fullName || username;
  const [greeting, setGreeting] = useState(() => pickGreeting(displayName));
  useEffect(() => {
    if (fullName) setGreeting(pickGreeting(fullName));
  }, [fullName]);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tileRows, setTileRows] = useState(1);
  const compact = tileRows > 2;
  const wallpaperTriggerRef = useRef(null);

  const chipTextClass = textTone === 'dark' ? 'text-[#14161a]' : 'text-white';
  const chipShadow = textTone === 'dark' ? '0 1px 6px rgba(255,255,255,0.5)' : '0 1px 8px rgba(0,0,0,0.4)';

  return (
    <div className="relative h-full overflow-hidden">
      <WallpaperLayer wallpaper={wallpaper} />

      <div className="relative z-10 h-full flex flex-col p-6 md:p-10">
        <header className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <IconButton
              ref={wallpaperTriggerRef}
              onClick={() => setWallpaperOpen((o) => !o)}
              overlay
              overlayTone={textTone}
              title="Customize wallpaper"
            >
              <Palette size={18} />
            </IconButton>
            <IconButton overlay overlayTone={textTone} onClick={toggleTheme} title={effectiveMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {effectiveMode === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </IconButton>
            <IconButton overlay overlayTone={textTone} onClick={() => navigate('/dashboard/settings')} title="Settings">
              <Settings size={18} />
            </IconButton>
          </div>

          <button
            onClick={() => setAccountOpen(true)}
            className={`flex items-center gap-3 rounded-full pl-1 pr-3 py-1 transition-colors ${textTone === 'dark' ? 'icon-btn-overlay-hover-dark' : 'icon-btn-overlay-hover'}`}
          >
            <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border ${textTone === 'dark' ? 'bg-black/[0.05] border-black/10' : 'bg-white/10 border-white/15'}`}>
              {profilePic ? (
                <img src={profilePic} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <User size={16} className={textTone === 'dark' ? 'text-[#14161a]/70' : 'text-white/70'} />
              )}
            </div>
            <span className={`text-sm font-semibold ${chipTextClass}`} style={{ textShadow: chipShadow }}>
              {displayName}
            </span>
          </button>
        </header>

        {wallpaperOpen && (
          <WallpaperSheet anchorRef={wallpaperTriggerRef} onClose={() => setWallpaperOpen(false)} />
        )}
        {accountOpen && <AccountSettingsModal onClose={() => setAccountOpen(false)} />}
        {connectOpen && <ConnectDeviceModal onClose={() => setConnectOpen(false)} />}

        {/*
          Top-aligned, not centered: content height varies with tile count/edit-mode controls.
          Centering would clip symmetrically top+bottom once content overflows, silently
          hiding/disabling whatever sits at the top (the edit-mode controls did exactly this).
          Top-aligning means any overflow only ever pushes into scrollable space below, never the
          controls above it. Compact mode (reduced gaps/padding) shrinks content first when there
          are many tiles; overflow-y-auto is the fallback for phone-sized viewports where even
          compact mode still doesn't leave enough room to show every tile.
        */}
        <div className={`flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto transition-all duration-300 ${compact ? 'gap-2 py-2' : 'gap-6 py-4'}`}>
          <div className={`flex flex-col items-center flex-shrink-0 transition-all duration-300 ${compact ? 'gap-1' : 'gap-3'}`}>
            <DigitalClock compact={compact} tone={textTone} />
            <p
              className={`font-medium transition-all duration-300 ${textTone === 'dark' ? 'text-[#14161a]/85' : 'text-white/85'} ${compact ? 'text-xs md:text-sm' : 'text-base md:text-lg'}`}
              style={{ textShadow: chipShadow }}
            >
              {greeting}
            </p>
          </div>

          <TileGrid editMode={editMode} onRowsChange={setTileRows} />
        </div>

        <div className="flex-shrink-0 flex justify-between">
          <ConnectDeviceButton onClick={() => setConnectOpen(true)} overlayTone={textTone} />
          <IconButton
            onClick={() => setEditMode((o) => !o)}
            overlay={!editMode}
            overlayTone={textTone}
            style={editMode ? { background: 'var(--accent)', color: '#fff' } : undefined}
            title={editMode ? 'Done editing' : 'Edit tiles'}
          >
            {editMode ? <Check size={18} /> : <Pencil size={18} />}
          </IconButton>
        </div>
      </div>
    </div>
  );
};
