/**
 * Flat, muted background colours. The ids are the ones saved in people's profiles from when these
 * were gradients, so an existing choice keeps its tone. `mode` groups them into the picker's
 * Dark/Light tabs; `textOn` says which text tone reads on top of it ('light' -> light text).
 */
export const PRESET_WALLPAPERS = [
  { id: 'aurora-blue', label: 'Slate blue', mode: 'dark', textOn: 'light', value: '#1b2333' },
  { id: 'sunset', label: 'Umber', mode: 'dark', textOn: 'light', value: '#2e211c' },
  { id: 'emerald-dusk', label: 'Pine', mode: 'dark', textOn: 'light', value: '#152922' },
  { id: 'violet-noir', label: 'Plum', mode: 'dark', textOn: 'light', value: '#231d2e' },
  { id: 'neon-tide', label: 'Teal', mode: 'dark', textOn: 'light', value: '#12292b' },
  { id: 'ember', label: 'Wine', mode: 'dark', textOn: 'light', value: '#2c1a1d' },
  { id: 'daybreak', label: 'Mist blue', mode: 'light', textOn: 'dark', value: '#dfe6f0' },
  { id: 'blossom', label: 'Rose grey', mode: 'light', textOn: 'dark', value: '#efe4e8' },
  { id: 'meadow', label: 'Sage', mode: 'light', textOn: 'dark', value: '#dfeae3' },
  { id: 'linen', label: 'Linen', mode: 'light', textOn: 'dark', value: '#ece6da' },
];

export const SOLID_COLORS = [
  { value: '#08090b', label: 'Black', textOn: 'light' },
  { value: '#101114', label: 'Charcoal', textOn: 'light' },
  { value: '#1c2333', label: 'Navy', textOn: 'light' },
  { value: '#241a2e', label: 'Aubergine', textOn: 'light' },
  { value: '#2a1418', label: 'Maroon', textOn: 'light' },
  { value: '#132621', label: 'Forest', textOn: 'light' },
  { value: '#ffffff', label: 'White', textOn: 'dark' },
  { value: '#eef0f3', label: 'Cloud', textOn: 'dark' },
  { value: '#e4e7ec', label: 'Silver', textOn: 'dark' },
  { value: '#f5efe4', label: 'Sand', textOn: 'dark' },
];

const DEFAULT_WALLPAPER = { type: 'solid', value: '#101114' };

export const backgroundStyleFor = (wallpaper) => {
  const w = wallpaper || DEFAULT_WALLPAPER;

  if (w.type === 'preset') {
    const preset = PRESET_WALLPAPERS.find((p) => p.id === w.value) || PRESET_WALLPAPERS[0];
    return { background: preset.value };
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
  // An uploaded photo: its brightness isn't known, so it gets a flat dark overlay and light text.
  return 'light';
};
