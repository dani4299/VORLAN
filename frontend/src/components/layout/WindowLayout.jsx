import React from 'react';

/**
 * The standard body of an admin window: an optional toolbar (filters on the left, actions on the
 * right) pinned above a scrolling content area. Every admin app uses this so they read as one family.
 */
export const WindowLayout = ({ toolbar, children, padded = true }) => (
  <div className="h-full flex flex-col">
    {toolbar && (
      <div role="toolbar" aria-label="Actions" className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-4 py-3 border-b border-[var(--surface-border)] flex-shrink-0">
        {toolbar}
      </div>
    )}
    <div className={`flex-1 min-h-0 overflow-auto ${padded ? 'p-4' : ''}`}>{children}</div>
  </div>
);

/** A titled block inside a window: a heading, an optional line of help text, then the content. */
export const Section = ({ title, description, actions, children, className = '' }) => (
  <section aria-label={title} className={`py-4 first:pt-0 ${className}`}>
    <div className="flex items-start justify-between gap-4 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
        {description && <p className="text-xs text-[var(--ink-muted)] mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </section>
);
