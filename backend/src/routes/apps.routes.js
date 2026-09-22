const express = require('express');
const verifyToken = require('../middleware/auth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const auditLog = require('../services/auditLog.service');
const apps = require('../services/apps.service');

const router = express.Router();

// The App Store installs and runs arbitrary software (Docker containers) on this computer -
// administrators only, same as every other admin surface.
router.use(verifyToken, requireAdmin);

const sendError = (res, err, fallback) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(fallback, err);
  return res.status(500).json({ error: fallback });
};

router.get('/status', async (req, res) => {
  res.json(await apps.isDockerAvailable());
});

router.get('/catalog', (req, res) => {
  res.json({ catalog: apps.listCatalog() });
});

router.get('/', async (req, res) => {
  try {
    res.json({ apps: await apps.listApps() });
  } catch (err) {
    sendError(res, err, 'Failed to load installed apps.');
  }
});

router.post('/', async (req, res) => {
  try {
    const { catalogKey, image, name, port, env, containerPort, volumePath } = req.body || {};
    const app = await apps.install({ catalogKey, image, name, port, env, containerPort, volumePath, createdBy: req.user.username });
    auditLog.log(req.user.username, 'admin.app_install_started', `${app.name} (${app.image})`);
    res.status(202).json({ message: 'Installing.', app });
  } catch (err) {
    sendError(res, err, 'Failed to start installing that app.');
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const app = await apps.startApp(req.params.id);
    auditLog.log(req.user.username, 'admin.app_started', app.name);
    res.json({ message: 'Started.', app });
  } catch (err) {
    sendError(res, err, 'Failed to start that app.');
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const app = await apps.stopApp(req.params.id);
    auditLog.log(req.user.username, 'admin.app_stopped', app.name);
    res.json({ message: 'Stopped.', app });
  } catch (err) {
    sendError(res, err, 'Failed to stop that app.');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const removeData = req.query.removeData === 'true';
    const app = await apps.uninstall(req.params.id, { removeData });
    auditLog.log(req.user.username, 'admin.app_uninstalled', `${app.name}${removeData ? ' (files deleted)' : ' (files kept)'}`);
    res.json({ message: 'Uninstalled.' });
  } catch (err) {
    sendError(res, err, 'Failed to uninstall that app.');
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const tail = Math.min(2000, Math.max(1, parseInt(req.query.tail, 10) || 200));
    res.json({ logs: await apps.getLogs(req.params.id, { tail }) });
  } catch (err) {
    sendError(res, err, 'Failed to load logs.');
  }
});

module.exports = router;
