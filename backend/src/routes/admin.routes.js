const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/auth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const devices = require('../services/devices.service');
const auditLog = require('../services/auditLog.service');
const jobQueue = require('../services/jobQueue.service');
const metrics = require('../services/metrics.service');
const systemInfo = require('../services/systemInfo.service');
const { getDiskUsage } = require('../services/storage.service');
const usersService = require('../services/users.service');
const adminSystem = require('../services/adminSystem.service');
const sessions = require('../services/sessions.service');

const router = express.Router();

// Every route below requires a signed-in admin.
router.use(verifyToken, requireAdmin);

// Errors that carry a `status` were written to be shown; anything else is logged and answered generically.
const sendError = (res, err, fallback) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(fallback, err);
  return res.status(500).json({ error: fallback });
};

const idParam = (req) => parseInt(req.params.id, 10);

router.get('/users', (req, res) => {
  db.all('SELECT id, username, email, full_name, role, created_at FROM users ORDER BY id ASC', (err, rows) => {
    if (err) {
      console.error('Failed to load users:', err);
      return res.status(500).json({ error: 'Failed to load users.' });
    }
    res.json({
      users: rows.map((r) => ({
        id: r.id, username: r.username, email: r.email, fullName: r.full_name, role: r.role, createdAt: r.created_at,
      })),
    });
  });
});

router.patch('/users/:id/role', async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { role } = req.body;
  const VALID_ROLES = ['admin', 'employee', 'guest'];

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, employee, or guest.' });
  }

  db.get('SELECT id, username, role FROM users WHERE id = ?', [targetId], async (err, target) => {
    if (err || !target) return res.status(404).json({ error: 'That account no longer exists.' });

    // Refuse to demote the last remaining admin — there has to always be someone who can get
    // back into this page. (An admin demoting a *different* admin is fine.)
    if (target.role === 'admin' && role !== 'admin') {
      const adminCount = await new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", (countErr, row) => (countErr ? reject(countErr) : resolve(row.count)));
      }).catch(() => null);

      if (adminCount === 1) {
        return res.status(409).json({ error: "You're the only administrator — promote someone else to admin first." });
      }
    }

    db.run('UPDATE users SET role = ? WHERE id = ?', [role, targetId], (updateErr) => {
      if (updateErr) {
        console.error('Failed to update role:', updateErr);
        return res.status(500).json({ error: 'Failed to update role.' });
      }
      auditLog.log(req.user.username, 'admin.role_changed', `${target.username}: ${target.role} -> ${role}`);
      res.json({ message: 'Role updated.', username: target.username, role });
    });
  });
});

router.post('/users', async (req, res) => {
  try {
    const user = await usersService.createUser(req.body || {});
    auditLog.log(req.user.username, 'admin.user_created', `${user.username} (${user.role})`);
    res.status(201).json({ message: 'Account created.', user });
  } catch (err) {
    sendError(res, err, 'Failed to create the account.');
  }
});

router.post('/users/:id/password', async (req, res) => {
  try {
    const target = await usersService.resetPassword(idParam(req), req.body?.password);
    auditLog.log(req.user.username, 'admin.password_reset', `${target.username}: ${target.signedOut} sign-in${target.signedOut === 1 ? '' : 's'} ended`);
    res.json({ message: 'Password changed.', signedOut: target.signedOut });
  } catch (err) {
    sendError(res, err, 'Failed to change the password.');
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const target = await usersService.deleteUser(idParam(req), req.user.id);
    auditLog.log(req.user.username, 'admin.user_deleted', `${target.username} (${target.role})`);
    res.json({ message: 'Account deleted.' });
  } catch (err) {
    sendError(res, err, 'Failed to delete the account.');
  }
});

// ---- sign-ins: every live one, and ending them

router.get('/sessions', async (req, res) => {
  try {
    res.json({ sessions: (await sessions.listAll()).map((s) => ({ ...s, current: s.id === req.user.sid })) });
  } catch (err) {
    sendError(res, err, 'Failed to load sign-ins.');
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const target = await sessions.find(req.params.id);
    if (!target || !(await sessions.revoke(target.id, 'ended by an administrator'))) return res.status(404).json({ error: 'That sign-in has already ended.' });
    auditLog.log(req.user.username, 'admin.session_revoked', `${target.username}${target.device_id ? `, device ${target.device_id}` : ''}`);
    res.json({ message: 'Signed out.' });
  } catch (err) {
    sendError(res, err, 'Failed to end that sign-in.');
  }
});

// Ends every sign-in one account has (the caller's own current one is spared, so this can't lock you out of the window you're using).
router.delete('/users/:id/sessions', async (req, res) => {
  try {
    const target = await new Promise((resolve, reject) => db.get('SELECT id, username FROM users WHERE id = ?', [idParam(req)], (err, row) => (err ? reject(err) : resolve(row))));
    if (!target) return res.status(404).json({ error: 'That account no longer exists.' });
    const ended = await sessions.revokeForUser(target.id, { exceptSessionId: target.id === req.user.id ? req.user.sid : null, reason: 'ended by an administrator' });
    auditLog.log(req.user.username, 'admin.user_signed_out', `${target.username}: ${ended} sign-in${ended === 1 ? '' : 's'} ended`);
    res.json({ message: 'Signed out.', ended });
  } catch (err) {
    sendError(res, err, 'Failed to sign that account out.');
  }
});

router.delete('/devices/:userId/:deviceId/sessions', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const ended = await sessions.revokeForDevice(userId, req.params.deviceId);
    if (!ended) return res.status(404).json({ error: 'That device has no active sign-in.' });
    auditLog.log(req.user.username, 'admin.device_signed_out', `user #${userId}, device ${req.params.deviceId}`);
    res.json({ message: 'Signed out.', ended });
  } catch (err) {
    sendError(res, err, 'Failed to sign that device out.');
  }
});

router.get('/devices', async (req, res) => {
  try {
    res.json({ devices: await devices.listAll() });
  } catch (err) {
    console.error('Failed to load devices:', err);
    res.status(500).json({ error: 'Failed to load devices.' });
  }
});

router.delete('/devices/:userId/:deviceId', async (req, res) => {
  try {
    const ok = await devices.remove(parseInt(req.params.userId, 10), req.params.deviceId);
    if (!ok) return res.status(404).json({ error: 'Device not found.' });
    auditLog.log(req.user.username, 'admin.device_removed', `user #${req.params.userId}, device ${req.params.deviceId}`);
    res.json({ message: 'Device record removed.' });
  } catch (err) {
    console.error('Failed to remove device:', err);
    res.status(500).json({ error: 'Failed to remove device.' });
  }
});

router.get('/audit-log', async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const beforeId = parseInt(req.query.beforeId, 10);
  try {
    res.json(await auditLog.list({
      limit,
      category: req.query.category,
      search: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : undefined,
      beforeId: Number.isInteger(beforeId) ? beforeId : undefined,
    }));
  } catch (err) {
    sendError(res, err, 'Failed to load audit log.');
  }
});

router.get('/tasks', (req, res) => {
  res.json({ tasks: jobQueue.list() });
});

// Live readings come from memory (last hour); ranges come from the saved per-minute rollups.
router.get('/metrics/live', (req, res) => {
  const seconds = Math.min(3600, Math.max(30, parseInt(req.query.seconds, 10) || 900));
  res.json(metrics.getLive(seconds));
});

router.get('/metrics/history', async (req, res) => {
  const range = req.query.range || '24h';
  if (!metrics.RANGES[range]) {
    return res.status(400).json({ error: `Range must be one of: ${Object.keys(metrics.RANGES).join(', ')}.` });
  }
  try {
    res.json(await metrics.getHistory(range));
  } catch (err) {
    console.error('Failed to load metrics history:', err);
    res.status(500).json({ error: 'Failed to load metrics history.' });
  }
});

router.get('/system/info', async (req, res) => {
  try {
    res.json(await systemInfo.getInfo());
  } catch (err) {
    console.error('Failed to load system info:', err);
    res.status(500).json({ error: 'Failed to load system information.' });
  }
});

router.get('/system/processes', async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  try {
    res.json(await systemInfo.getProcesses(limit));
  } catch (err) {
    console.error('Failed to load processes:', err);
    res.status(500).json({ error: 'Failed to load processes.' });
  }
});

router.get('/storage', async (req, res) => {
  try {
    res.json(await adminSystem.getStorage());
  } catch (err) {
    sendError(res, err, 'Failed to load storage information.');
  }
});

router.get('/system/services', async (req, res) => {
  try {
    res.json(await adminSystem.getServices());
  } catch (err) {
    sendError(res, err, 'Failed to load services.');
  }
});

router.get('/system/network', async (req, res) => {
  try {
    res.json(await adminSystem.getNetwork());
  } catch (err) {
    sendError(res, err, 'Failed to load network information.');
  }
});

router.get('/system/security', async (req, res) => {
  try {
    res.json(await adminSystem.getSecurity());
  } catch (err) {
    sendError(res, err, 'Failed to load security information.');
  }
});

router.get('/system/about', (req, res) => {
  res.json(adminSystem.getAbout());
});

router.get('/system/diagnostics', async (req, res) => {
  try {
    const bundle = await adminSystem.getDiagnostics();
    auditLog.log(req.user.username, 'admin.diagnostics_downloaded');
    res.setHeader('Content-Disposition', `attachment; filename="vorlan-diagnostics-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(bundle);
  } catch (err) {
    sendError(res, err, 'Failed to build the diagnostics bundle.');
  }
});

router.get('/overview', async (req, res) => {
  try {
    const [userCount, deviceCount, disk] = await Promise.all([
      new Promise((resolve, reject) => db.get('SELECT COUNT(*) AS count FROM users', (err, row) => (err ? reject(err) : resolve(row.count)))),
      new Promise((resolve, reject) => db.get('SELECT COUNT(*) AS count FROM devices', (err, row) => (err ? reject(err) : resolve(row.count)))),
      getDiskUsage().catch(() => null),
    ]);
    res.json({ userCount, deviceCount, disk });
  } catch (err) {
    console.error('Failed to load admin overview:', err);
    res.status(500).json({ error: 'Failed to load overview.' });
  }
});

module.exports = router;
