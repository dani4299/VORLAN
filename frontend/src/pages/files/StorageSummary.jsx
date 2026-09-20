import React, { useEffect, useState } from 'react';
import api, { authHeaders, getUsername } from '../../lib/api';
import { Meter } from '../../components/ui/Meter';
import { formatBytes } from '../../lib/format';

const CATEGORIES = [
  { key: 'documents', label: 'Documents' },
  { key: 'music', label: 'Music' },
  { key: 'gallery', label: 'Pictures' },
];

/** How much space the files use: the whole disk for shared files, or just this person's private space. Renders nothing until it has numbers. */
export const StorageSummary = ({ isPersonal }) => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const scope = isPersonal ? `?scope=personal&username=${encodeURIComponent(getUsername())}` : '';
    api.get(`/storage/summary${scope}`, { headers: authHeaders() })
      .then((res) => setSummary(res.data))
      .catch((err) => console.warn("Couldn't load storage usage", err));
  }, [isPersonal]);

  if (!summary) return null;

  const usedByCategories = CATEGORIES.reduce((sum, c) => sum + (summary.categories[c.key] || 0), 0);
  const disk = !isPersonal ? summary.disk : null;
  const headline = isPersonal
    ? `${formatBytes(usedByCategories)} used in your private space`
    : disk ? `${formatBytes(disk.usedBytes)} of ${formatBytes(disk.totalBytes)} used` : `${formatBytes(usedByCategories)} used`;

  return (
    <section aria-label="Storage" className="mb-6">
      <h2 className="text-sm font-semibold text-[var(--ink)]">Storage</h2>
      <p className="text-sm text-[var(--ink-muted)] mt-0.5 mb-3">{headline}</p>
      {disk && <Meter value={disk.usedBytes} max={disk.totalBytes} label="Disk in use" valueText={headline} className="mb-4" />}

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
        {CATEGORIES.map((c) => {
          const bytes = summary.categories[c.key] || 0;
          return (
            <li key={c.key}>
              <div className="flex items-baseline justify-between mb-1.5 text-sm">
                <span className="text-[var(--ink)]">{c.label}</span>
                <span className="text-[var(--ink-muted)] tabular-nums">{formatBytes(bytes)}</span>
              </div>
              <Meter value={bytes} max={usedByCategories || 1} label={`${c.label} share of used space`} valueText={formatBytes(bytes)} tone="accent" />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
