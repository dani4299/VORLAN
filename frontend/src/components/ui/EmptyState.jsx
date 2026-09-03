import React from 'react';

export const EmptyState = ({ icon: Icon, title, hint, className = '' }) => (
  <div className={`flex-1 flex flex-col items-center justify-center text-center py-16 px-6 rounded-[28px] border border-dashed border-[var(--surface-border)] bg-[var(--overlay-1)] ${className}`}>
    {Icon && <Icon size={40} className="mb-3 text-[var(--ink-faint)]" />}
    <p className="font-semibold text-[var(--ink-muted)]">{title}</p>
    {hint && <p className="text-xs text-[var(--ink-faint)] mt-1 max-w-xs">{hint}</p>}
  </div>
);
