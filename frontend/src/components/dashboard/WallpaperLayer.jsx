import React from 'react';

/**
 * Generated gradients built from VORLAN's own accent/hue tokens. `mode` groups them into the
 * wallpaper picker's Dark/Light tabs; `textOn` says which text tone reads legibly on top of it
 * (`'light'` -> white text, `'dark'` -> near-black text) - independent of `mode`, since it's the
 * gradient's actual brightness that matters for legibility, not which tab it's filed under.
 */
export const PRESET_WALLPAPERS = [
  {
    id: 'aurora-blue',
    label: 'Aurora Blue',
    mode: 'dark',
    textOn: 'light',
    css: 'radial-gradient(120% 90% at 15% 0%, rgba(76,141,255,0.7), transparent 48%), radial-gradient(100% 80% at 100% 20%, rgba(156,107,255,0.55), transparent 45%), #08090b',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    mode: 'dark',
    textOn: 'light',
    css: 'radial-gradient(120% 90% at 20% 0%, rgba(255,180,84,0.65), transparent 48%), radial-gradient(100% 80% at 100% 100%, rgba(255,100,130,0.55), transparent 45%), #08090b',
  },
  {
    id: 'emerald-dusk',
    label: 'Emerald Dusk',
    mode: 'dark',
    textOn: 'light',
    css: 'radial-gradient(120% 90% at 80% 0%, rgba(52,211,153,0.6), transparent 48%), radial-gradient(100% 80% at 0% 100%, rgba(76,141,255,0.5), transparent 45%), #08090b',
  },
  {
    id: 'violet-noir',
    label: 'Violet Noir',
    mode: 'dark',
    textOn: 'light',
    css: 'radial-gradient(120% 90% at 50% -10%, rgba(156,107,255,0.7), transparent 42%), radial-gradient(90% 70% at 100% 100%, rgba(255,100,130,0.4), transparent 48%), #08090b',
  },
  {
    id: 'neon-tide',
    label: 'Neon Tide',
    mode: 'dark',
    textOn: 'light',
    css: 'radial-gradient(110% 85% at 10% 100%, rgba(52,211,153,0.75), transparent 45%), radial-gradient(100% 85% at 100% 0%, rgba(76,141,255,0.75), transparent 45%), #050608',
  },
  {
    id: 'ember',
    label: 'Ember',
    mode: 'dark',
    textOn: 'light',
    css: 'radial-gradient(120% 90% at 85% 100%, rgba(255,100,130,0.75), transparent 45%), radial-gradient(90% 75% at 0% 0%, rgba(255,180,84,0.55), transparent 48%), #0a0709',
  },
  {
    id: 'daybreak',
    label: 'Daybreak',
    mode: 'light',
    textOn: 'dark',
    css: 'radial-gradient(120% 90% at 15% 0%, rgba(76,141,255,0.35), transparent 55%), radial-gradient(100% 80% at 100% 100%, rgba(255,180,84,0.35), transparent 55%), #f3f5f8',
  },
  {
    id: 'blossom',
    label: 'Blossom',
    mode: 'light',
    textOn: 'dark',
    css: 'radial-gradient(120% 90% at 85% 0%, rgba(255,100,130,0.32), transparent 55%), radial-gradient(100% 80% at 0% 100%, rgba(156,107,255,0.3), transparent 55%), #f5f4f7',
  },
  {
    id: 'meadow',
    label: 'Meadow',
    mode: 'light',
    textOn: 'dark',
    css: 'radial-gradient(120% 90% at 20% 100%, rgba(52,211,153,0.35), transparent 55%), radial-gradient(100% 80% at 100% 0%, rgba(76,141,255,0.25), transparent 55%), #f2f6f4',
  },
  {
    id: 'linen',
    label: 'Linen',
    mode: 'light',
    textOn: 'dark',
    css: 'radial-gradient(120% 90% at 50% -10%, rgba(255,180,84,0.3), transparent 55%), radial-gradient(90% 70% at 100% 100%, rgba(255,100,130,0.22), transparent 58%), #f6f4f0',
  },
];

export const SOLID_COLORS = [
  { value: '#08090b', textOn: 'light' },
  { value: '#101114', textOn: 'light' },
  { value: '#1c2333', textOn: 'light' },
  { value: '#241a2e', textOn: 'light' },
  { value: '#2a1418', textOn: 'light' },
  { value: '#132621', textOn: 'light' },
  { value: '#ffffff', textOn: 'dark' },
  { value: '#eef0f3', textOn: 'dark' },
  { value: '#e4e7ec', textOn: 'dark' },
  { value: '#f5efe4', textOn: 'dark' },
];

const DEFAULT_WALLPAPER = { type: 'solid', value: '#101114' };

const backgroundStyleFor = (wallpaper) => {
  const w = wallpaper || DEFAULT_WALLPAPER;

  if (w.type === 'preset') {
    const preset = PRESET_WALLPAPERS.find((p) => p.id === w.value) || PRESET_WALLPAPERS[0];
    return { background: preset.css };
  }
  if (w.type === 'custom' && w.value) {
    return { backgroundImage: `url(${w.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: w.value || DEFAULT_WALLPAPER.value };
};

const relativeLuminance = (hex) => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** Which text tone reads legibly on top of this wallpaper - independent of the app's light/dark theme. */
export const getWallpaperTextTone = (wallpaper) => {
  const w = wallpaper || DEFAULT_WALLPAPER;
  if (w.type === 'preset') {
    const preset = PRESET_WALLPAPERS.find((p) => p.id === w.value);
    return preset?.textOn || 'light';
  }
  if (w.type === 'solid') {
    const known = SOLID_COLORS.find((c) => c.value === w.value);
    if (known) return known.textOn;
    if (/^#[0-9a-f]{6}$/i.test(w.value)) return relativeLuminance(w.value) > 0.45 ? 'dark' : 'light';
  }
  // Custom uploads: can't know the image's brightness cheaply, so default to the scrim-backed light-text look.
  return 'light';
};

/** Full-bleed dashboard background with a scrim tuned to the wallpaper's own brightness, so the clock/greeting stay legible regardless of theme or wallpaper choice. */
export const WallpaperLayer = ({ wallpaper }) => {
  const textOn = getWallpaperTextTone(wallpaper);
  const scrim = textOn === 'dark'
    ? 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.6) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.05) 32%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.5) 100%)';

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={backgroundStyleFor(wallpaper)} />
      <div className="absolute inset-0" style={{ background: scrim }} />
    </div>
  );
};
