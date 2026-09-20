/**
 * Headers that shut off whole classes of browser trickery, on every response:
 *  - nosniff: a file is only ever treated as the type the server says it is (an uploaded ".txt" can't run as a script)
 *  - X-Frame-Options / frame-ancestors: no other site can put VORLAN in a frame to trick clicks
 *  - no-referrer: addresses inside VORLAN aren't handed to other sites
 * API answers also carry no-store, so a token or a private list is never kept in a browser or proxy cache.
 */
module.exports = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
};
