import { useEffect, useState } from 'react';

/** `value`, but only after it has stopped changing for `delayMs` - so typing in a search box doesn't fire a request per keystroke. */
export const useDebouncedValue = (value, delayMs = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
};
