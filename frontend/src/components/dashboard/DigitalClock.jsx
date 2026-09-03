import React, { useEffect, useState } from 'react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `tone`: which text color reads legibly on the active wallpaper - 'light' (white, dark shadow) or 'dark' (near-black, light shadow). */
export const DigitalClock = ({ compact = false, tone = 'light' }) => {
  const [now, setNow] = useState(new Date());
  const isLight = tone === 'light';
  const textShadow = isLight ? '0 2px 20px rgba(0,0,0,0.45)' : '0 1px 10px rgba(255,255,255,0.55)';
  const mainColor = isLight ? 'text-white' : 'text-[#14161a]';
  const periodColor = isLight ? 'text-white/70' : 'text-[#14161a]/65';
  const dateColor = isLight ? 'text-white/80' : 'text-[#14161a]/75';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours();
  const displayHours = ((hours + 11) % 12) + 1;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';

  return (
    <div className="flex flex-col items-center text-center select-none transition-all duration-300">
      <div className="flex items-baseline gap-2 leading-none" style={{ textShadow }}>
        <span
          className={`${mainColor} font-semibold tracking-tight transition-all duration-300`}
          style={{ fontSize: compact ? 'clamp(36px, 6vw, 56px)' : 'clamp(64px, 11vw, 104px)' }}
        >
          {displayHours}:{minutes}
        </span>
        <span className={`font-semibold ${periodColor} ${compact ? 'text-base md:text-lg' : 'text-xl md:text-2xl'}`}>{period}</span>
      </div>
      <p
        className={`font-medium ${dateColor} transition-all duration-300 ${compact ? 'mt-0.5 text-xs md:text-sm' : 'mt-2 text-base md:text-lg'}`}
        style={{ textShadow }}
      >
        {WEEKDAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()}
      </p>
    </div>
  );
};
