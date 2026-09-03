# Wallpapers

Drop wallpaper images here (JPG/PNG/WebP, ~1920x1080 or larger, ideally under 2MB each).

To make one selectable in the dashboard's wallpaper picker, import it and add an entry to
`PRESET_WALLPAPERS` in `frontend/src/components/dashboard/WallpaperLayer.jsx`:

```js
import sunrise from '../../assets/wallpapers/sunrise.jpg';

export const PRESET_WALLPAPERS = [
  // ...existing presets
  { id: 'sunrise', label: 'Sunrise', css: `url(${sunrise}) center / cover no-repeat` },
];
```

Until real wallpapers are added here, the picker's "Preloaded" row uses generated gradient
wallpapers built from VORLAN's own accent colors as placeholders.
