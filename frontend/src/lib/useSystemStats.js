import { useEffect, useState } from 'react';
import api, { authHeaders } from './api';

/** Polls backend system stats (disk/ram/battery) so widgets stay current, e.g. as charge state changes. */
export const useSystemStats = (intervalMs = 30000) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.get('/system/stats', { headers: authHeaders() })
        .then((res) => { if (!cancelled) setStats(res.data); })
        .catch((err) => console.warn("Couldn't load system stats", err));
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return stats;
};
