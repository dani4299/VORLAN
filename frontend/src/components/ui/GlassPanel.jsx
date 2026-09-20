import React from 'react';

/** A flat bordered container. `strong` uses the firmer border, for dialogs and chrome. (The name is historical; there is no glass or blur.) */
export const GlassPanel = ({ as: Tag = 'div', strong = false, className = '', children, ...props }) => (
  <Tag className={`${strong ? 'surface-strong' : 'surface'} rounded-[var(--radius-lg)] ${className}`} {...props}>
    {children}
  </Tag>
);

/** The same container for dense grids (file tiles, note cards), with no shadow and a border that only strengthens on hover. */
export const SolidCard = ({ as: Tag = 'div', className = '', children, ...props }) => (
  <Tag
    className={`bg-[var(--canvas-elevated)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] ${className}`}
    {...props}
  >
    {children}
  </Tag>
);
