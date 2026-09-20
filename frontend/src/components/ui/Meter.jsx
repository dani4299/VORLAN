import React from 'react';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * A usage bar exposed as role="progressbar" with a real value, so its state isn't only a colour.
 * The fill turns warning/danger past `warnAt`/`dangerAt` (percent) unless a `tone` is forced -
 * pair it with visible text (e.g. "63 GB of 237 GB") for anyone who can't see the colour change.
 * Flat fill, no gradient.
 */
export const Meter = ({ value, max = 100, label, valueText, tone, warnAt = 80, dangerAt = 90, className = '' }) => {
  const percent = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  const resolved = tone || (percent >= dangerAt ? 'danger' : percent >= warnAt ? 'warning' : 'accent');
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={valueText}
      className={`h-1.5 rounded-[var(--radius-sm)] bg-[var(--overlay-3)] overflow-hidden ${className}`}
    >
      <div
        className="h-full transition-[width] duration-200"
        style={{ width: `${percent}%`, background: `var(--${resolved})` }}
      />
    </div>
  );
};
