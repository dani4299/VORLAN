import { useMemo } from 'react';
import { getMetricsHistory, getMetricsLive } from './adminApi';
import { usePolling } from './usePolling';

export const RANGES = [
  { id: 'live', label: 'Live (15 minutes)', seconds: 900 },
  { id: '1h', label: 'Last hour', seconds: 3600 },
  { id: '6h', label: 'Last 6 hours', seconds: 6 * 3600 },
  { id: '24h', label: 'Last 24 hours', seconds: 24 * 3600 },
  { id: '7d', label: 'Last 7 days', seconds: 7 * 86400 },
  { id: '30d', label: 'Last 30 days', seconds: 30 * 86400 },
];

/**
 * Chart-ready system metrics for a range. "live" polls the in-memory samples every few seconds;
 * longer ranges read the saved per-minute history and refresh once a minute.
 * Returns { points, domain, loading, error }; memPct (memory used, in percent) is derived here.
 */
export const useMetrics = (range) => {
  const live = range === 'live';
  const { data, error } = usePolling(
    () => (live ? getMetricsLive(900) : getMetricsHistory(range)),
    live ? 5000 : 60000,
    [range],
  );

  return useMemo(() => {
    if (!data) return { points: [], domain: null, loading: !error, error };
    const points = data.points.map((p) => ({ ...p, memPct: p.memTotal ? (p.memUsed / p.memTotal) * 100 : null }));
    let domain;
    if (live) {
      const now = Math.floor(Date.now() / 1000);
      const to = Math.max(now, points.length ? points[points.length - 1].t : now);
      domain = { from: to - 900, to };
    } else {
      domain = { from: data.from, to: data.to };
    }
    return { points, domain, loading: false, error };
  }, [data, error, live]);
};
