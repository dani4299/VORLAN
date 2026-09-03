const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./src/config/constants');
const { GLOBAL_MEDIA_DIR, PERSONAL_VAULT_DIR } = require('./src/config/paths');
const { getLocalIp } = require('./src/utils/localIp');

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

const app = express();

app.use(cors());
// Raised to fit base64-encoded profile pictures sent as JSON.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static media
app.use('/media', express.static(GLOBAL_MEDIA_DIR));
app.use('/media/personal', express.static(PERSONAL_VAULT_DIR));

// API routes
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

app.listen(PORT, '0.0.0.0', (err) => {
  // Express 5 invokes this same callback on a failed bind (e.g. EADDRINUSE), passing the
  // error as the first argument, instead of emitting an unhandled 'error' event - without this
  // check a port conflict prints the banner below as if the server started, then the process
  // exits silently seconds later with no other indication anything went wrong.
  if (err) {
    console.error(`Failed to start VORLAN server on port ${PORT}: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.error(`Something else is already listening on port ${PORT}. Stop it, or set PORT to a different value, then try again.`);
    }
    process.exit(1);
  }

  const localIp = getLocalIp();

  console.log('===================================================');
  console.log('VORLAN server online');
  console.log(`Port: ${PORT}`);
  console.log(`Connect from another device: http://${localIp}:${PORT}`);
  console.log(`AI assistant: offline-first, via Ollama on port 11434`);
  console.log(`Storage: ${path.relative(process.cwd(), GLOBAL_MEDIA_DIR)}`);
  console.log('===================================================');
});
