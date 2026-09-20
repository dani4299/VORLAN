import React from 'react';

/**
 * WAI-ARIA tabs: one tab stop for the whole list (roving tabindex), arrow keys move between tabs,
 * Home/End jump to the ends. Pair with <TabPanel> using the same `idPrefix`.
 * tabs: [{ id, label, icon? }]
 *
 * Horizontal tabs sit on a bottom rule with an underline on the selected one. Vertical tabs (a
 * settings-style section list) mark the selected one with a left border. No pill backgrounds.
 */
export const Tabs = ({ tabs, value, onChange, label, idPrefix, orientation = 'horizontal', className = '' }) => {
  const vertical = orientation === 'vertical';

  const onKeyDown = (e) => {
    const current = tabs.findIndex((t) => t.id === value);
    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    let next = null;
    if (e.key === nextKey) next = (current + 1) % tabs.length;
    else if (e.key === prevKey) next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(`${idPrefix}-tab-${tabs[next].id}`)?.focus();
  };

  const listClass = vertical ? 'flex flex-col gap-0.5' : 'flex gap-5 border-b border-[var(--surface-border)]';
  const tabClass = (selected) => {
    const base = 'inline-flex items-center gap-2 text-sm transition-colors duration-150 ';
    if (vertical) {
      return `${base}px-3 py-1.5 text-left border-l-2 ${selected ? 'border-[var(--accent)] text-[var(--ink)] font-medium bg-[var(--overlay-1)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-1)]'}`;
    }
    return `${base}justify-center min-w-6 pb-2.5 -mb-px border-b-2 ${selected ? 'border-[var(--accent)] text-[var(--ink)] font-medium' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'}`;
  };

  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} onKeyDown={onKeyDown} className={`${listClass} ${className}`}>
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            id={`${idPrefix}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={tabClass(selected)}
          >
            {t.icon && <t.icon size={16} aria-hidden="true" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

/** Inactive panels stay in the DOM as empty hidden placeholders so each tab's aria-controls always points at a real element, but their content isn't mounted. */
export const TabPanel = ({ idPrefix, id, value, children, className = '' }) => {
  const active = id === value;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      hidden={!active}
      tabIndex={active ? 0 : undefined}
      className={`outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-md)] ${className}`}
    >
      {active ? children : null}
    </div>
  );
};
