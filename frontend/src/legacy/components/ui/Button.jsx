import React from 'react';

// Filled variants pair a --*-solid fill with its --on-* text so contrast is >= 4.5:1 in every
// theme and accent scheme. Hover darkens a filled button (never lightens it: lighter fill under
// white text would fall back under AA). Every variant carries a 1px border so all four are the same height.
const VARIANTS = {
  primary: 'text-[var(--on-accent)] bg-[var(--accent-solid)] border-transparent hover:brightness-95',
  secondary: 'text-[var(--ink)] bg-transparent border-[var(--surface-border-strong)] hover:bg-[var(--overlay-2)]',
  ghost: 'text-[var(--ink-muted)] bg-transparent border-transparent hover:text-[var(--ink)] hover:bg-[var(--overlay-2)]',
  danger: 'text-[var(--on-danger)] bg-[var(--danger-solid)] border-transparent hover:brightness-95',
};

const SIZES = {
  sm: 'px-3 py-1 text-xs gap-1.5 min-h-[28px]',
  md: 'px-4 py-2 text-sm gap-2 min-h-[36px]',
  lg: 'px-5 py-2.5 text-sm gap-2 min-h-[40px]',
};

/** `loading` disables the button and marks it aria-busy, so a double-click can't fire twice and assistive tech knows it's working. */
export const Button = ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }) => (
  <button
    className={`inline-flex items-center justify-center rounded-[var(--radius-md)] border font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && (
      <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
    )}
    {children}
  </button>
);

/**
 * An icon-only button has no visible text, so it MUST have an accessible name. `label` becomes both
 * the aria-label and the hover tooltip; `title`/`aria-label` are accepted as fallbacks so older
 * call sites keep working, and a dev-time warning fires if none is given.
 *
 * `overlay`: for buttons floating on top of a photo/gradient wallpaper (not the flat theme
 * canvas) - a translucent chip whose tone follows the wallpaper's own brightness rather than
 * the light/dark theme (a bright wallpaper needs a dark icon regardless of theme, same as the
 * clock text). Pass `overlayTone="dark"` when the active wallpaper is light enough to need it
 * (see `getWallpaperTextTone`). Default (`overlay` false) is theme-reactive, for buttons on the
 * normal flat surface.
 */
export const IconButton = React.forwardRef(({ label, title, className = '', overlay = false, overlayTone = 'light', children, ...props }, ref) => {
  const name = label || props['aria-label'] || title;
  if (import.meta.env.DEV && !name) {
    console.warn('IconButton has no accessible name - pass a `label` prop.');
  }
  const overlayClass = overlayTone === 'dark' ? 'icon-btn-overlay-dark text-[#14161a]' : 'icon-btn-overlay text-white';
  return (
    <button
      ref={ref}
      type="button"
      aria-label={name}
      title={name}
      className={`inline-flex items-center justify-center rounded-[var(--radius-md)] w-9 h-9 transition-colors duration-150 ${overlay ? overlayClass : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-3)]'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
