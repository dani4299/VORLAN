import React, { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import api, { authHeaders, getUsername } from '../../../lib/api';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { formatBytes } from '../../../lib/format';

const CATEGORY_META = [
  { key: 'documents', label: 'Documents', color: 'var(--accent)' },
  { key: 'music', label: 'Music', color: 'var(--hue-violet)' },
  { key: 'gallery', label: 'Gallery', color: 'var(--hue-emerald)' },
];

export const StorageSummary = ({ isPersonal }) => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const scope = isPersonal ? `?scope=personal&username=${encodeURIComponent(getUsername())}` : '';
    api.get(`/storage/summary${scope}`, { headers: authHeaders() })
      .then(res => setSummary(res.data))
      .catch(err => console.warn("Couldn't load storage usage", err));
  }, [isPersonal]);

  if (!summary) return null;

  const usedByCategories = CATEGORY_META.reduce((sum, c) => sum + (summary.categories[c.key] || 0), 0);
  const diskPercent = summary.disk ? Math.min(100, Math.round((summary.disk.usedBytes / summary.disk.totalBytes) * 100)) : null;

  return (
    <GlassPanel className="p-6 mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(76,141,255,0.15)' }}>
          <HardDrive size={16} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">Storage</p>
          <p className="text-xs text-[var(--ink-muted)]">
            {isPersonal ? `${formatBytes(usedByCategories)} used in your private space` : diskPercent !== null ? `${formatBytes(summary.disk.usedBytes)} of ${formatBytes(summary.disk.totalBytes)} used` : `${formatBytes(usedByCategories)} used`}
          </p>
        </div>
      </div>

      {!isPersonal && diskPercent !== null && (
        <div className="h-2 rounded-full bg-[var(--overlay-3)] overflow-hidden mb-5">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${diskPercent}%`, background: 'var(--accent)' }} />
        </div>
      )}

      <div className="flex gap-4">
        {CATEGORY_META.map(c => {
          const bytes = summary.categories[c.key] || 0;
          const pct = usedByCategories > 0 ? Math.max(4, Math.round((bytes / usedByCategories) * 100)) : 0;
          return (
            <div key={c.key} className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[var(--ink-muted)]">{c.label}</span>
                <span className="text-xs text-[var(--ink-faint)]">{formatBytes(bytes)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--overlay-3)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${bytes > 0 ? pct : 0}%`, background: c.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
};
