import React from 'react';

const VARIANTS = {
  primary: 'text-white bg-[var(--accent)] hover:bg-[var(--accent-strong)] active:scale-[0.97] shadow-[0_8px_24px_-8px_rgba(76,141,255,0.6)]',
  secondary: 'glass text-[var(--ink)] hover:brightness-125 active:scale-[0.97]',
  ghost: 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-2)] active:scale-[0.97]',
  danger: 'text-white bg-[var(--hue-rose)] hover:brightness-110 active:scale-[0.97] shadow-[0_8px_24px_-8px_rgba(255,100,130,0.5)]',
};

const SIZES = {
  sm: 'px-4 py-2 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3.5 text-sm gap-2',
};

export const Button = ({ variant = 'primary', size = 'md', className = '', children, ...props }) => (
  <button
    className={`inline-flex items-center justify-center rounded-full font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

/**
 * `overlay`: for buttons floating on top of a photo/gradient wallpaper (not the flat theme
 * canvas) - a translucent chip whose tone follows the wallpaper's own brightness rather than
 * the light/dark theme (a bright wallpaper needs a dark icon regardless of theme, same as the
 * clock text). Pass `overlayTone="dark"` when the active wallpaper is light enough to need it
 * (see `getWallpaperTextTone`). Default (`overlay` false) is theme-reactive, for buttons on the
 * normal flat surface.
 */
export const IconButton = React.forwardRef(({ className = '', overlay = false, overlayTone = 'light', children, ...props }, ref) => {
  const overlayClass = overlayTone === 'dark' ? 'icon-btn-overlay-dark text-[#14161a]' : 'icon-btn-overlay text-white';
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-full w-10 h-10 active:scale-90 transition-all duration-150 ${overlay ? overlayClass : 'text-[var(--ink-muted)] hover:text-[var(--ink)] bg-[var(--overlay-1)] hover:bg-[var(--overlay-4)]'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
