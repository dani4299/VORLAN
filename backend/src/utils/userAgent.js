const OS_PATTERNS = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'Mac'],
  [/Linux/, 'Linux'],
];

const BROWSER_PATTERNS = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/CriOS\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/FxiOS\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

/** A short human label like "Chrome on Windows" from a raw User-Agent string, falling back to "Unknown device" when it can't tell. */
const describeUserAgent = (userAgent) => {
  if (!userAgent) return 'Unknown device';
  const os = OS_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
};

module.exports = { describeUserAgent };
