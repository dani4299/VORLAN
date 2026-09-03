import React from 'react';

export const Spinner = ({ className = 'w-8 h-8' }) => (
  <div className={`${className} border-[3px] border-[var(--surface-border)] border-t-[var(--accent)] rounded-full animate-spin`} />
);
