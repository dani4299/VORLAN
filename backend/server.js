const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { PORT, HTTPS_PORT, TLS_ENABLED } = require('./src/config/constants');
const { GLOBAL_MEDIA_DIR, FRONTEND_DIST_DIR, FRONTEND_INDEX_HTML } = require('./src/config/paths');
const secrets = require('./src/config/secrets');
const { getLocalIp } = require('./src/utils/localIp');
const { httpsRedirectTarget } = require('./src/utils/transport');

// Fail at start-up, not on the first sign-in, if the signing key can't be had.
const jwtSecret = secrets.describeJwtSecret();

const authRoutes = require('./src/routes/auth.routes');
const vaultRoutes = require('./src/routes/vault.routes');
const personalRoutes = require('./src/routes/personal.routes');
const notesRoutes = require('./src/routes/notes.routes');
const historyRoutes = require('./src/routes/history.routes');
const profileRoutes = require('./src/routes/profile.routes');
const aiRoutes = require('./src/routes/ai.routes');
const storageRoutes = require('./src/routes/storage.routes');
const systemRoutes = require('./src/routes/system.routes');
const explorerRoutes = require('./src/routes/explorer.routes');
const devicesRoutes = require('./src/routes/devices.routes');
const adminRoutes = require('./src/routes/admin.routes');
const mediaRoutes = require('./src/routes/media.routes');
const requestEvents = require('./src/middleware/requestEvents.middleware');
const securityHeaders = require('./src/middleware/securityHeaders.middleware');
const listeners = require('./src/listeners');
const metrics = require('./src/services/metrics.service');
const sessions = require('./src/services/sessions.service');
const tls = require('./src/services/tls.service');
const storagePools = require('./src/services/storagePools.service');
const snapshots = require('./src/services/snapshots.service');

listeners.register();

const app = express();
app.disable('x-powered-by');

app.use(securityHeaders);
// The app and its API are one origin (the built site is served from here; the dev server proxies /api),
// so no other site needs to be let in. Origins can be allowed explicitly for a custom setup.
if (process.env.VORLAN_CORS_ORIGINS) {
  app.use(cors({ origin: process.env.VORLAN_CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) }));
}
// Raised to fit base64-encoded profile pictures sent as JSON.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Shared and personal files: signed-in people only (see media.routes.js).
if (!fs.existsSync(GLOBAL_MEDIA_DIR)) fs.mkdirSync(GLOBAL_MEDIA_DIR, { recursive: true });
app.use('/media', mediaRoutes);

// API routes
app.use('/api', requestEvents);
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/personal', personalRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/explorer', explorerRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/admin', adminRoutes);

// Serves the frontend's production build when one exists (an installed copy of VORLAN) - a plain
// dev checkout with no build present skips this entirely, so `npm start`'s Vite dev server
// workflow is completely unaffected. BrowserRouter is used on the frontend, so any non-API,
// non-media route needs to fall back to index.html for client-side routing to work - otherwise a
// phone opening a deep link like /dashboard/ai directly would get a 404 instead of the app shell.
if (fs.existsSync(FRONTEND_INDEX_HTML)) {
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get(/^(?!\/api|\/media).*/, (req, res) => {
    res.sendFile(FRONTEND_INDEX_HTML);
  });
}

/** Resolves once the server is listening, or exits the process with a clear message if it can't. */
const listen = (server, port, label) => new Promise((resolve) => {
  server.once('error', (err) => {
    // A failed bind (e.g. EADDRINUSE) must not look like a successful start.
    console.error(`Failed to start VORLAN ${label} server on port ${port}: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.error(`Something else is already listening on port ${port}. Stop it, or set ${label === 'HTTPS' ? 'VORLAN_HTTPS_PORT' : 'PORT'} to a different value, then try again.`);
    }
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', resolve);
});

const start = async () => {
  let httpsReady = false;

  // Before anything can be requested: the storage pool and its datasets need to exist so the very
  // first admin request for them doesn't race their creation.
  await storagePools.ensureDefaults();

  if (TLS_ENABLED) {
    const certificate = await tls.ensureCertificate();
    const httpsServer = https.createServer({ key: certificate.key, cert: certificate.cert, minVersion: 'TLSv1.2' }, app);
    await listen(httpsServer, HTTPS_PORT, 'HTTPS');
    httpsReady = true;
  }

  // Plain HTTP stays up for this computer itself (http://localhost:5000 needs no certificate). A request
  // from any other device is sent on to HTTPS, so nothing sensitive crosses the network in the clear.
  const httpServer = http.createServer((req, res) => {
    const target = httpsRedirectTarget(
      { remoteAddress: req.socket.remoteAddress, hostHeader: req.headers.host, url: req.url },
      { tlsEnabled: httpsReady, httpsPort: HTTPS_PORT }
    );
    if (target) {
      res.writeHead(308, { Location: target, 'Cache-Control': 'no-store' });
      return res.end();
    }
    return app(req, res);
  });
  await listen(httpServer, PORT, 'HTTP');

  const localIp = getLocalIp();
  const details = tls.getTlsInfo();

  console.log('===================================================');
  console.log('VORLAN server online');
  if (httpsReady) {
    console.log(`Secure address (other devices): https://${localIp}:${HTTPS_PORT}`);
    console.log(`This computer: http://localhost:${PORT}`);
    console.log(`Certificate: self-signed, expires ${details.validTo?.slice(0, 10)}, SHA-256 ${details.fingerprint256}`);
    if (details.generated) console.log('A new certificate was just created. Browsers warn about it once: check the fingerprint above, then accept it.');
  } else {
    console.log(`Port: ${PORT}`);
    console.log(`Connect from another device: http://${localIp}:${PORT}  (HTTPS is turned off)`);
  }
  if (jwtSecret.source === 'generated') console.log(`Created a new sign-in key at ${jwtSecret.location} (everyone signs in again once).`);
  console.log(`AI assistant: offline-first, via Ollama on port 11434`);
  console.log(`Storage: ${path.relative(process.cwd(), GLOBAL_MEDIA_DIR)}`);
  console.log('===================================================');

  sessions.purge().catch((e) => console.error('Failed to tidy old sign-ins:', e.message));
  setInterval(() => sessions.purge().catch(() => {}), 6 * 60 * 60 * 1000).unref();
  metrics.start().catch((e) => console.error('Metrics collection failed to start:', e.message));
  snapshots.start();
};

start().catch((err) => {
  console.error('VORLAN failed to start:', err.message);
  process.exit(1);
});
