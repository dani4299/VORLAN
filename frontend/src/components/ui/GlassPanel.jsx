import React from 'react';

/**
 * A floating glass surface. `strong` raises material intensity for chrome
 * (sidebar, modals) versus regular content cards.
 */
export const GlassPanel = ({ as: Tag = 'div', strong = false, className = '', children, ...props }) => (
  <Tag className={`${strong ? 'glass-strong' : 'glass'} rounded-[28px] ${className}`} {...props}>
    {children}
  </Tag>
);

/**
 * A quieter content surface — used for dense grids (file tiles, note cards)
 * where a full glass treatment on every tile would be too busy. Tinted and
 * bordered rather than blurred.
 */
export const SolidCard = ({ as: Tag = 'div', className = '', children, ...props }) => (
  <Tag
    className={`bg-[var(--canvas-elevated)] border border-[var(--surface-border)] rounded-[24px] ${className}`}
    {...props}
  >
    {children}
  </Tag>
);
