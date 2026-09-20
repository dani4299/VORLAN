import React from 'react';

/**
 * A list of label/value facts (host name, version, port...). Semantic <dl>: assistive tech reads each
 * value with its label. Rows are separated by a rule, not boxed. Labels stack above values on a
 * narrow container and sit side by side on a wide one.
 */
export const DescriptionList = ({ items, className = '' }) => (
  <dl className={`@container ${className}`}>
    {items.map((item) => (
      <div key={item.label} className="flex flex-col gap-0.5 py-2 border-b border-[var(--surface-border)] text-sm last:border-b-0 @md:flex-row @md:gap-4">
        <dt className="@md:w-52 flex-shrink-0 text-[var(--ink-muted)]">{item.label}</dt>
        <dd className="min-w-0 break-words text-[var(--ink)] tabular-nums">{item.value ?? <span className="text-[var(--ink-muted)]">Not available</span>}</dd>
      </div>
    ))}
  </dl>
);
