import React, { useEffect, useRef, useState } from 'react';
import { Check, ImageIcon, LayoutGrid } from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/Button';
import { WallpaperLayer } from '../../components/dashboard/WallpaperLayer';
import { getWallpaperTextTone } from '../../components/dashboard/wallpapers';
import { WallpaperSheet } from '../../components/dashboard/WallpaperSheet';
import { DigitalClock } from '../../components/dashboard/DigitalClock';
import { TileGrid } from '../../components/dashboard/TileGrid';
import { pickGreeting } from '../../lib/greetings';

// Sits on the wallpaper, so it needs its own opaque background to stay readable on any of them.
const ON_WALLPAPER = 'bg-[var(--canvas-elevated)]';

/** A person's home: the time, a greeting, and their tiles (apps first; widgets if they've added any) over a wallpaper of their choosing. */
export const HomePage = () => {
  const { username, fullName } = useProfile();
  const { wallpaper } = useTheme();
  const displayName = fullName || username;
  const [greeting, setGreeting] = useState(() => pickGreeting(displayName));
  useEffect(() => {
    setGreeting(pickGreeting(fullName || username));
  }, [fullName, username]);

  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const wallpaperButtonRef = useRef(null);

  return (
    <div data-wallpaper-tone={getWallpaperTextTone(wallpaper)} className="relative h-full overflow-y-auto">
      <WallpaperLayer wallpaper={wallpaper} />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10 flex flex-col gap-8">
        <h1 className="sr-only">Home</h1>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <DigitalClock />
            <p className="mt-1 text-base text-[var(--wp-ink)]">{greeting}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              ref={wallpaperButtonRef}
              variant="secondary"
              className={ON_WALLPAPER}
              aria-haspopup="dialog"
              aria-expanded={wallpaperOpen}
              onClick={() => setWallpaperOpen((open) => !open)}
            >
              <ImageIcon size={16} aria-hidden="true" />Wallpaper
            </Button>
            <Button variant="secondary" className={ON_WALLPAPER} aria-pressed={editMode} onClick={() => setEditMode((on) => !on)}>
              {editMode ? <Check size={16} aria-hidden="true" /> : <LayoutGrid size={16} aria-hidden="true" />}
              {editMode ? 'Done' : 'Edit tiles'}
            </Button>
          </div>
        </div>

        <TileGrid editMode={editMode} />
      </div>

      {wallpaperOpen && <WallpaperSheet anchorRef={wallpaperButtonRef} onClose={() => setWallpaperOpen(false)} />}
    </div>
  );
};
