import React from 'react';

const TONES = {
  neutral: 'text-[var(--ink-muted)] bg-[var(--overlay-3)]',
  accent: 'text-[var(--accent)] bg-[var(--accent-wash)]',
  success: 'text-[var(--success)] bg-[var(--success-wash)]',
  warning: 'text-[var(--warning)] bg-[var(--warning-wash)]',
  danger: 'text-[var(--danger)] bg-[var(--danger-wash)]',
  info: 'text-[var(--info)] bg-[var(--info-wash)]',
};

/** A small label for a state that matters. The text always says what it is; colour only reinforces it. Use sparingly - most status is better as plain text. */
export const Badge = ({ tone = 'neutral', className = '', children }) => (
  <span className={`inline-block rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]} ${className}`}>
    {children}
  </span>
);
