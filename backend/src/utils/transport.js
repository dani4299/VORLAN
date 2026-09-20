// Decides whether a plain-HTTP request should be sent on to HTTPS.
//
// The rule: a request from this computer itself (loopback) is served as it is, so http://localhost:5000,
// the desktop launcher and the dev server's proxy keep working with no certificate involved. Anything
// arriving from another device is sent to HTTPS, so credentials never cross the network in the clear.

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const isLoopbackAddress = (address) => typeof address === 'string' && LOOPBACK.has(address);

/** The host part of a Host header, without the port: "192.168.1.14:5000" -> "192.168.1.14", "[::1]:5000" -> "[::1]". */
const hostnameOf = (hostHeader) => {
  const host = String(hostHeader || '').trim();
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  const colon = host.lastIndexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
};

/** Where to send a request that shouldn't stay on plain HTTP, or null if it should be served. */
const httpsRedirectTarget = ({ remoteAddress, hostHeader, url }, { tlsEnabled, httpsPort }) => {
  if (!tlsEnabled || isLoopbackAddress(remoteAddress)) return null;
  const hostname = hostnameOf(hostHeader);
  if (!hostname) return null;
  return `https://${hostname}:${httpsPort}${url}`;
};

module.exports = { isLoopbackAddress, hostnameOf, httpsRedirectTarget };
