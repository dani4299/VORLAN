import React from 'react';

/** Flat, fixed, full-viewport canvas fill behind the app's flat surfaces. */
export const AmbientBackground = () => (
  <div className="fixed inset-0 pointer-events-none" style={{ background: 'var(--canvas)' }} aria-hidden="true" />
);
