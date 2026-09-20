import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

const compare = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

/**
 * A semantic, sortable table.
 * columns: [{ key, header, render?(row), sortValue?(row), align?, className?, sortable? }]
 *   - a column is sortable when it has a `sortValue`, or when `sortable` is set (sorts on row[key])
 * The scroll wrapper is a labelled, keyboard-focusable region so wide tables never trap keyboard users.
 * `caption` names the table for screen readers (visually hidden - the page heading already shows it).
 */
export const DataTable = ({ caption, columns, rows, getRowId, initialSort = null, empty = 'Nothing to show.', dense = false, className = '' }) => {
  const [sort, setSort] = useState(initialSort); // { key, dir: 'asc' | 'desc' }

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const valueOf = col.sortValue || ((row) => row[col.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => dir * compare(valueOf(a), valueOf(b)));
  }, [rows, columns, sort]);

  const toggleSort = (key) => {
    setSort((prev) => (prev?.key === key && prev.dir === 'asc' ? { key, dir: 'desc' } : { key, dir: 'asc' }));
  };

  const cellPad = dense ? 'px-3 py-1.5' : 'px-4 py-2.5';

  return (
    <div role="region" aria-label={caption} tabIndex={0} className={`overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--surface-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${className}`}>
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-[var(--overlay-1)]">
            {columns.map((col) => {
              const sortable = !!(col.sortValue || col.sortable);
              const active = sort?.key === col.key;
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined;
              const SortIcon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`${cellPad} ${ALIGN[col.align || 'left']} text-xs font-medium text-[var(--ink-muted)] whitespace-nowrap border-b border-[var(--surface-border)]`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 font-medium hover:text-[var(--ink)] transition-colors rounded-[var(--radius-sm)]"
                    >
                      {col.header}
                      <SortIcon size={13} aria-hidden="true" className={active ? 'text-[var(--accent)]' : 'opacity-60'} />
                    </button>
                  ) : col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-[var(--ink-muted)]">{empty}</td>
            </tr>
          ) : sorted.map((row) => (
            <tr key={getRowId(row)} className="border-b border-[var(--surface-border)] last:border-b-0 hover:bg-[var(--overlay-1)] transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`${cellPad} ${ALIGN[col.align || 'left']} text-[var(--ink)] align-middle ${col.className || ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
