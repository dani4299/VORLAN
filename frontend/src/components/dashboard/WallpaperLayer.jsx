import React from 'react';
import { backgroundStyleFor } from './wallpapers';

/** The page background. A colour is drawn as it is; an uploaded photo gets one flat dark overlay so the text on it stays readable. */
export const WallpaperLayer = ({ wallpaper }) => {
  const isPhoto = wallpaper?.type === 'custom' && !!wallpaper.value;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={backgroundStyleFor(wallpaper)} />
      {isPhoto && <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.45)' }} />}
    </div>
  );
};
