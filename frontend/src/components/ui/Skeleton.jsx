import React from 'react';

/** A placeholder shaped like the content that's loading. Decorative, so it's hidden from assistive tech - pair the region with aria-busy. */
export const Skeleton = ({ className = 'h-4 w-full' }) => (
  <div aria-hidden="true" className={`skeleton rounded-[var(--radius-sm)] ${className}`} />
);
