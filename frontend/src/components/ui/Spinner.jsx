import React from 'react';

/** role="status" so a screen reader announces the wait, not just sighted users seeing a ring. */
export const Spinner = ({ className = 'w-8 h-8', label = 'Loading' }) => (
  <div
    role="status"
    aria-label={label}
    className={`${className} border-[3px] border-[var(--surface-border-strong)] border-t-[var(--accent)] rounded-full animate-spin`}
  />
);
