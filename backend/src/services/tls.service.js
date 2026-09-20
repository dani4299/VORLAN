const os = require('os');
const crypto = require('crypto');
const selfsigned = require('selfsigned');
const secrets = require('../config/secrets');
const { TLS_ENABLED, HTTPS_PORT } = require('../config/constants');

// A certificate VORLAN makes for itself. Nobody signs it, so a browser shows a warning the first time
// it sees it; accepting it once is what "trusting this VORLAN" means. It lasts 825 days (the longest
// phones will let you install as trusted) and is remade before it runs out, or when the computer's
// addresses change, so it always names every address people actually type.
const VALID_DAYS = 825;
const RENEW_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;

let current = null; // last certificate details, for the admin windows

/** Every name and address this computer answers to. */
const collectNames = () => {
  const ips = new Set(['127.0.0.1', '::1']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (!net.internal && net.family === 'IPv4') ips.add(net.address);
    }
  }
  const dns = new Set(['localhost']);
  if (os.hostname()) dns.add(os.hostname());
  return { dns: [...dns].sort(), ips: [...ips].sort() };
};

const describe = (cert, names, generated) => {
  const x509 = new crypto.X509Certificate(cert);
  return {
    names,
    fingerprint256: x509.fingerprint256,
    validFrom: new Date(x509.validFrom).toISOString(),
    validTo: new Date(x509.validTo).toISOString(),
    generated,
  };
};

/** Loads the certificate, making (or remaking) it when it's missing, expiring, or no longer covers this computer's addresses. */
const ensureCertificate = async () => {
  const names = collectNames();
  const signature = JSON.stringify(names);

  const key = secrets.read('tls.key');
  const cert = secrets.read('tls.crt');
  let meta = null;
  try { meta = JSON.parse(secrets.read('tls.meta.json') || 'null'); } catch { meta = null; }

  if (key && cert && meta?.signature === signature) {
    try {
      const details = describe(cert, names, false);
      if (new Date(details.validTo).getTime() - Date.now() > RENEW_WITHIN_MS) {
        current = { ...details, key, cert };
        return current;
      }
    } catch {
      // unreadable certificate: make a new one below
    }
  }

  const generated = await selfsigned.generate([{ name: 'commonName', value: 'VORLAN' }], {
    days: VALID_DAYS,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          ...names.dns.map((value) => ({ type: 2, value })),
          ...names.ips.map((ip) => ({ type: 7, ip })),
        ],
      },
    ],
  });

  secrets.writePrivate('tls.key', generated.private);
  secrets.writePrivate('tls.crt', generated.cert);
  secrets.writePrivate('tls.meta.json', JSON.stringify({ signature, createdAt: new Date().toISOString() }));
  current = { ...describe(generated.cert, names, true), key: generated.private, cert: generated.cert };
  return current;
};

/** What the admin windows show. Never includes the key. */
const getTlsInfo = () => ({
  enabled: TLS_ENABLED,
  httpsPort: HTTPS_PORT,
  ...(current ? { names: current.names, fingerprint256: current.fingerprint256, validFrom: current.validFrom, validTo: current.validTo, generated: current.generated } : {}),
});

module.exports = { ensureCertificate, getTlsInfo, collectNames };
