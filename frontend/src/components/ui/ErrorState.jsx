import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

/** What to show when a load fails: say what happened and offer a way forward, instead of a blank panel. */
export const ErrorState = ({ title = "Couldn't load this", message, onRetry, className = '' }) => (
  <div role="alert" className={`flex flex-col items-center justify-center text-center py-10 px-6 rounded-[var(--radius-lg)] border border-[var(--danger)] ${className}`}>
    <AlertTriangle size={20} aria-hidden="true" className="mb-3" style={{ color: 'var(--danger)' }} />
    <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
    {message && <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-sm">{message}</p>}
    {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
  </div>
);
