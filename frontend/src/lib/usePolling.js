import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Calls `fetcher` now and then every `intervalMs`, keeping the last good result.
 * A failed refresh keeps showing the previous data and reports `error`; `data` is only null
 * until the first success. A slow response never stacks another request on top of itself.
 * `fetcher` may change identity every render - the latest one is always used.
 */
export const usePolling = (fetcher, intervalMs, deps = []) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  const inFlight = useRef(false);

  useEffect(() => { fetcherRef.current = fetcher; });

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Request failed.');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, load, ...deps]);

  return { data, error, reload: load };
};
