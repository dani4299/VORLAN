import React, { forwardRef, useId } from 'react';

// Solid 1px border, 6px radius; focus only changes the border colour and adds a 1px ring in the
// same colour - no glow, no animated underline.
const CONTROL =
  'w-full bg-transparent border rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] '
  + 'transition-colors focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] '
  + 'disabled:opacity-50 disabled:cursor-not-allowed';

const controlBorder = (error) => (error ? 'border-[var(--danger)]' : 'border-[var(--surface-border-strong)]');

/** Label above the control, hint or error below it, all wired to the control by id so assistive tech reads them together. */
const FieldShell = ({ id, label, hint, error, required, children }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-[var(--ink)] mb-1.5">
      {label}
      {required && <span aria-hidden="true" className="text-[var(--danger)] ml-0.5">*</span>}
    </label>
    {children}
    {error ? (
      <p id={`${id}-error`} role="alert" className="text-xs text-[var(--danger)] mt-1.5">{error}</p>
    ) : hint ? (
      <p id={`${id}-hint`} className="text-xs text-[var(--ink-muted)] mt-1.5">{hint}</p>
    ) : null}
  </div>
);

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export const TextField = forwardRef(({ label, hint, error, required, className = '', ...input }, ref) => {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${CONTROL} ${controlBorder(error)} ${className}`}
        {...input}
      />
    </FieldShell>
  );
});

export const SelectField = forwardRef(({ label, hint, error, required, className = '', children, ...select }, ref) => {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${CONTROL} ${controlBorder(error)} ${className}`}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  );
});

/** A labelled on/off setting. Exposed as role="switch" so it reads "on"/"off", not "checked". */
export const Switch = ({ label, description, checked, onChange, disabled = false }) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-[var(--ink)]">{label}</label>
        {description && <p id={`${id}-desc`} className="text-xs text-[var(--ink-muted)] mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-9 h-5 rounded-full border transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-[var(--accent-solid)] border-transparent' : 'bg-[var(--overlay-4)] border-[var(--surface-border-strong)]'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[1px] w-4 h-4 rounded-full transition-[left] duration-150 ${checked ? 'left-[17px] bg-[var(--on-accent)]' : 'left-[1px] bg-[var(--ink-muted)]'}`}
        />
      </button>
    </div>
  );
};

export const Checkbox = ({ label, checked, onChange, disabled = false }) => {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[var(--accent-solid)] disabled:opacity-50"
      />
      <label htmlFor={id} className="text-sm text-[var(--ink)]">{label}</label>
    </div>
  );
};
