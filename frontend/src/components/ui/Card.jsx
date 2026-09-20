import React, { useId } from 'react';

/** A bordered container with an optional header. The heading level is explicit so pages keep a correct h1 > h2 > h3 outline. */
export const Card = ({ title, actions, headingLevel = 2, padded = true, className = '', children }) => {
  const titleId = useId();
  const Heading = `h${headingLevel}`;
  return (
    <section aria-labelledby={title ? titleId : undefined} className={`surface rounded-[var(--radius-lg)] ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--surface-border)]">
          {title && <Heading id={titleId} className="text-sm font-semibold text-[var(--ink)]">{title}</Heading>}
          {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
};
