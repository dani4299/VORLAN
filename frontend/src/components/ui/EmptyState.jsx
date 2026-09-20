import React from 'react';

/** `action` (optional) is the obvious next step - an empty screen should say what to do about it. */
export const EmptyState = ({ icon: Icon, title, hint, action, className = '' }) => (
  <div className={`flex-1 flex flex-col items-center justify-center text-center py-12 px-6 rounded-[var(--radius-lg)] border border-[var(--surface-border)] ${className}`}>
    {Icon && <Icon size={20} aria-hidden="true" className="mb-3 text-[var(--ink-muted)]" />}
    <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
    {hint && <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-sm">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
