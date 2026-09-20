import React, { useEffect, useState } from 'react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The time and date, in the text colours the wallpaper container provides (--wp-ink). Updates every 10 seconds; it only shows minutes. */
export const DigitalClock = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours();
  const displayHours = ((hours + 11) % 12) + 1;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';

  return (
    <div className="select-none">
      <p className="flex items-baseline gap-2 leading-none text-[var(--wp-ink)]">
        <span className="text-5xl md:text-6xl font-semibold tabular-nums">{displayHours}:{minutes}</span>
        <span className="text-xl font-medium text-[var(--wp-ink-muted)]">{period}</span>
      </p>
      <p className="mt-2 text-base text-[var(--wp-ink-muted)]">{WEEKDAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()}</p>
    </div>
  );
};
