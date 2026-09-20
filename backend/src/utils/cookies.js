// Just enough cookie handling for two cookies, so no extra dependency is needed.

const parseCookies = (header) => {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // a value that isn't valid encoding is simply not one of ours
    }
  }
  return cookies;
};

/**
 * HttpOnly (page scripts can't read it), SameSite=Lax (not sent along with requests started by other
 * sites), and Secure whenever the request itself arrived over HTTPS.
 */
const setCookie = (req, res, name, value, maxAgeSeconds) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`];
  if (req.secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
};

const clearCookie = (req, res, name) => setCookie(req, res, name, '', 0);

module.exports = { parseCookies, setCookie, clearCookie };
