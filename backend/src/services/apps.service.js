const fs = require('fs');
const path = require('path');
const db = require('../db');
const { APPS_DIR } = require('../config/paths');
const { getLocalIp } = require('../utils/localIp');
const docker = require('./docker.service');
const catalog = require('./appCatalog');
const jobQueue = require('./jobQueue.service');

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onDone(err) { return err ? reject(err) : resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const notFound = (message) => Object.assign(new Error(message), { status: 404 });
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const conflict = (message) => Object.assign(new Error(message), { status: 409 });

const PORT_RANGE = { from: 20000, to: 20999 };
const IMAGE_PATTERN = /^[a-z0-9]+((\.[a-z0-9]+)|(_{1,2}[a-z0-9]+)|(-+[a-z0-9]+))*(\/[a-z0-9]+((\.[a-z0-9]+)|(_{1,2}[a-z0-9]+)|(-+[a-z0-9]+))*)*(:[\w][\w.-]{0,127})?$/;

const slugify = (name) => (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'app';

/** Appends -2, -3, ... until the slug (and so the container name vorlan-app-<slug>) is free. */
const uniqueSlug = async (base) => {
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await get('SELECT 1 FROM apps WHERE slug = ?', [candidate])) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
};

const containerName = (slug) => `vorlan-app-${slug}`;

const publicRow = (r) => {
  const ports = JSON.parse(r.ports);
  const primary = ports.find((p) => p.primary) || ports[0];
  return {
    id: r.id, slug: r.slug, name: r.name, catalogKey: r.catalog_key, image: r.image,
    ports, volumes: JSON.parse(r.volumes), env: JSON.parse(r.env || '{}'),
    status: r.status, errorMessage: r.error_message, createdBy: r.created_by,
    createdAt: r.created_at, updatedAt: r.updated_at,
    url: primary && r.status === 'running' ? `http://${getLocalIp()}:${primary.host}` : null,
  };
};

/** Ports already claimed by any app, so a new one is never handed out twice. */
const takenPorts = async () => {
  const rows = await all('SELECT ports FROM apps');
  const taken = new Set();
  for (const row of rows) for (const p of JSON.parse(row.ports)) taken.add(p.host);
  return taken;
};

const allocatePort = async (used) => {
  const taken = used || await takenPorts();
  for (let port = PORT_RANGE.from; port <= PORT_RANGE.to; port += 1) if (!taken.has(port)) return port;
  throw conflict('No free port is left in the range VORLAN hands these out from.');
};

const validateImage = (image) => {
  if (typeof image !== 'string' || !IMAGE_PATTERN.test(image.trim())) {
    throw badRequest('That doesn\'t look like a valid Docker image reference (e.g. "nextcloud:latest" or "ghcr.io/owner/name:tag").');
  }
};

const isDockerAvailable = () => docker.ping();

/** Everything installed, with live status refreshed from Docker for anything with a container. A
 * container that Docker no longer knows about (removed outside VORLAN) is reported as an error
 * rather than silently kept as whatever it last was. */
const listApps = async () => {
  const rows = await all('SELECT * FROM apps ORDER BY created_at DESC');
  return Promise.all(rows.map(async (row) => {
    if (!row.container_id || !['running', 'stopped', 'error'].includes(row.status)) return publicRow(row);
    try {
      const info = await docker.inspectContainer(row.container_id);
      const liveStatus = info.State.Running ? 'running' : 'stopped';
      if (liveStatus !== row.status) {
        await run('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?', [liveStatus, new Date().toISOString(), row.id]);
        row = { ...row, status: liveStatus };
      }
    } catch (err) {
      // Any failure to check (the container is gone, or Docker itself is unreachable right now) is
      // reported on that one row rather than left to break the whole list - a Docker hiccup should
      // never stop every other app's status from showing.
      const message = err.status === 404 ? "Its container is gone - it may have been removed outside VORLAN." : `Couldn't check its status: ${err.message}`;
      if (row.status !== 'error' || row.error_message !== message) {
        await run('UPDATE apps SET status = ?, error_message = ?, updated_at = ? WHERE id = ?', ['error', message, new Date().toISOString(), row.id]).catch(() => {});
        row = { ...row, status: 'error', error_message: message };
      }
    }
    return publicRow(row);
  }));
};

const getApp = async (id) => {
  const row = await get('SELECT * FROM apps WHERE id = ?', [id]);
  if (!row) throw notFound('That app no longer exists.');
  return row;
};

/**
 * Registers the app and returns right away with it in `installing` state; the pull/create/start
 * sequence runs on the job queue in the background, since pulling an image can take minutes. Poll
 * listApps() to see it become `running` (or `error`, with why).
 */
const install = async ({
  catalogKey, image: customImage, name, port: portOverride, env: envOverride = {}, createdBy,
  containerPort, volumePath,
}) => {
  let base;
  if (catalogKey) {
    base = catalog.BY_KEY[catalogKey];
    if (!base) throw notFound('No such app in the catalog.');
  } else {
    validateImage(customImage);
    // Nothing in the catalog to default from, so the admin says what the image actually needs -
    // most images don't listen on 80 (Jellyfin uses 8096, Minecraft 25565, ...), and assuming
    // otherwise would silently install something unreachable.
    const cPort = containerPort === undefined || containerPort === null || containerPort === '' ? 80 : Number(containerPort);
    if (!Number.isInteger(cPort) || cPort < 1 || cPort > 65535) throw badRequest('The container port must be a number between 1 and 65535.');
    const cPath = (volumePath && String(volumePath).trim()) || '/data';
    if (!cPath.startsWith('/')) throw badRequest('The container path must be absolute (start with "/").');
    base = { image: customImage.trim(), ports: [{ container: cPort, protocol: 'tcp', primary: true }], volumes: [{ containerPath: cPath, label: 'data' }], env: {} };
  }

  if (portOverride !== undefined && portOverride !== null) {
    const n = Number(portOverride);
    if (!Number.isInteger(n) || n < 1024 || n > 65535) throw badRequest('The port must be a number between 1024 and 65535.');
  }

  const displayName = (name || base.name || base.image.split(':')[0].split('/').pop()).trim().slice(0, 60);
  if (!displayName) throw badRequest('Give the app a name.');
  const slug = await uniqueSlug(slugify(displayName));

  // Sequential, not Promise.all: each port needs to see the ones already picked earlier in this
  // same install (an app with more than one port, e.g. Pi-hole, would otherwise have every port's
  // allocation race the same "what's free" snapshot and could hand out the same host port twice).
  const used = await takenPorts();
  if (portOverride !== undefined && portOverride !== null && used.has(Number(portOverride))) throw conflict('Another app is already using that port.');
  const ports = [];
  for (let i = 0; i < base.ports.length; i += 1) {
    const p = base.ports[i];
    // eslint-disable-next-line no-await-in-loop
    const host = i === 0 && portOverride ? Number(portOverride) : await allocatePort(used);
    used.add(host);
    ports.push({ container: p.container, protocol: p.protocol || 'tcp', primary: !!p.primary, host });
  }

  const volumes = base.volumes.map((v) => {
    const hostPath = path.join(APPS_DIR, slug, v.label || slugify(v.containerPath));
    fs.mkdirSync(hostPath, { recursive: true });
    return { hostPath, containerPath: v.containerPath, label: v.label || null };
  });

  const env = { ...base.env, ...envOverride };
  const now = new Date().toISOString();
  const result = await run(
    'INSERT INTO apps (slug, name, catalog_key, image, ports, volumes, env, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [slug, displayName, catalogKey || null, base.image, JSON.stringify(ports), JSON.stringify(volumes), JSON.stringify(env), 'installing', createdBy || null, now, now]
  );
  const id = result.lastID;

  jobQueue.enqueue('app.install', async () => {
    try {
      await docker.pullImage(base.image);
      const created = await docker.createContainer(containerName(slug), { image: base.image, env, ports, volumes });
      await docker.startContainer(created.Id);
      await run('UPDATE apps SET container_id = ?, status = ?, updated_at = ? WHERE id = ?', [created.Id, 'running', new Date().toISOString(), id]);
    } catch (err) {
      await run('UPDATE apps SET status = ?, error_message = ?, updated_at = ? WHERE id = ?', ['error', err.message, new Date().toISOString(), id]);
      throw err;
    }
  }, { label: `Install ${displayName}`, startedBy: createdBy });

  return getApp(id).then(publicRow);
};

const startApp = async (id) => {
  const row = await getApp(id);
  if (!row.container_id) throw badRequest('Still installing - wait for that to finish first.');
  await docker.startContainer(row.container_id);
  await run('UPDATE apps SET status = ?, error_message = NULL, updated_at = ? WHERE id = ?', ['running', new Date().toISOString(), id]);
  return getApp(id).then(publicRow);
};

const stopApp = async (id) => {
  const row = await getApp(id);
  if (!row.container_id) throw badRequest('Still installing - wait for that to finish first.');
  await docker.stopContainer(row.container_id);
  await run('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?', ['stopped', new Date().toISOString(), id]);
  return getApp(id).then(publicRow);
};

const uninstall = async (id, { removeData = false } = {}) => {
  const row = await getApp(id);
  await run('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?', ['uninstalling', new Date().toISOString(), id]);
  if (row.container_id) {
    await docker.stopContainer(row.container_id).catch(() => {});
    await docker.removeContainer(row.container_id).catch(() => {});
  }
  if (removeData) await fs.promises.rm(path.join(APPS_DIR, row.slug), { recursive: true, force: true }).catch(() => {});
  await run('DELETE FROM apps WHERE id = ?', [id]);
  return publicRow(row);
};

const getLogs = async (id, { tail = 200 } = {}) => {
  const row = await getApp(id);
  if (!row.container_id) return '';
  return docker.getLogs(row.container_id, { tail });
};

module.exports = {
  isDockerAvailable, listCatalog: () => catalog.CATALOG, listApps, install, startApp, stopApp, uninstall, getLogs,
};
