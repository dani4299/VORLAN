const fs = require('fs');
const path = require('path');
const { EXPLORER_DIR } = require('../config/paths');

const ROOT_FOLDERS = ['Documents', 'Uploads', 'Pictures', 'Music'];

for (const name of ROOT_FOLDERS) {
  fs.mkdirSync(path.join(EXPLORER_DIR, name), { recursive: true });
}

/** Resolves a client-supplied relative path against EXPLORER_DIR, rejecting anything that would escape it. */
const safeResolve = (relPath = '') => {
  const resolved = path.resolve(EXPLORER_DIR, `.${path.sep}${relPath}`);
  if (resolved !== EXPLORER_DIR && !resolved.startsWith(EXPLORER_DIR + path.sep)) {
    const err = new Error('Invalid path.');
    err.status = 400;
    throw err;
  }
  return resolved;
};

const toEntry = (dir, name) => {
  const full = path.join(dir, name);
  const stat = fs.statSync(full);
  return {
    name,
    type: stat.isDirectory() ? 'folder' : 'file',
    size: stat.isDirectory() ? null : stat.size,
    modifiedAt: stat.mtimeMs,
  };
};

const listDir = (relPath) => {
  const dir = safeResolve(relPath);
  if (!fs.existsSync(dir)) {
    const err = new Error('That folder no longer exists.');
    err.status = 404;
    throw err;
  }
  const names = fs.readdirSync(dir);
  const entries = names.map((name) => toEntry(dir, name));
  entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
  return entries;
};

const createFolder = (relPath, name) => {
  const dir = safeResolve(relPath);
  const target = path.join(dir, name);
  if (fs.existsSync(target)) {
    const err = new Error('An item with that name already exists here.');
    err.status = 409;
    throw err;
  }
  fs.mkdirSync(target);
};

const deleteEntry = (relPath) => {
  const full = safeResolve(relPath);
  if (full === EXPLORER_DIR) {
    const err = new Error("Can't delete the root folder.");
    err.status = 400;
    throw err;
  }
  fs.rmSync(full, { recursive: true, force: true });
};

const renameEntry = (relPath, newName) => {
  const full = safeResolve(relPath);
  const target = path.join(path.dirname(full), newName);
  if (fs.existsSync(target)) {
    const err = new Error('An item with that name already exists here.');
    err.status = 409;
    throw err;
  }
  fs.renameSync(full, target);
};

/** Validates a copy request and works out where the copy will land. Synchronous and cheap on purpose, so a bad request is rejected up front (400/404) instead of becoming a failed background task. */
const planCopy = (fromRelPath, toRelDir) => {
  const from = safeResolve(fromRelPath);
  const toDir = safeResolve(toRelDir);
  if (!fs.existsSync(from)) {
    const err = new Error('That item no longer exists.');
    err.status = 404;
    throw err;
  }
  if (toDir === from || toDir.startsWith(from + path.sep)) {
    const err = new Error("Can't copy a folder into itself.");
    err.status = 400;
    throw err;
  }
  let target = path.join(toDir, path.basename(from));
  if (target === from) {
    const ext = path.extname(target);
    const base = path.basename(target, ext);
    target = path.join(toDir, `${base} (copy)${ext}`);
  }
  return { from, target };
};

/** The slow part of a copy. Unlike the fs.cpSync it replaced, fs.promises.cp yields to the event loop while it works, so a large copy no longer freezes every other request. Handles files and directories alike. */
const executeCopy = ({ from, target }) => fs.promises.cp(from, target, { recursive: true, errorOnExist: false, force: true });

const moveEntry = (fromRelPath, toRelDir) => {
  const from = safeResolve(fromRelPath);
  const toDir = safeResolve(toRelDir);
  const target = path.join(toDir, path.basename(from));
  if (target === from) return;
  fs.renameSync(from, target);
};

const walk = (dir, relPrefix, visit) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = relPrefix ? `${relPrefix}/${name}` : name;
    const stat = fs.statSync(full);
    visit(rel, name, stat);
    if (stat.isDirectory()) walk(full, rel, visit);
  }
};

const search = (query) => {
  const q = query.toLowerCase();
  const results = [];
  walk(EXPLORER_DIR, '', (rel, name, stat) => {
    if (name.toLowerCase().includes(q)) {
      results.push({ path: rel, name, type: stat.isDirectory() ? 'folder' : 'file', size: stat.isDirectory() ? null : stat.size, modifiedAt: stat.mtimeMs });
    }
  });
  return results;
};

const recentFiles = (limit = 20) => {
  const files = [];
  walk(EXPLORER_DIR, '', (rel, name, stat) => {
    if (!stat.isDirectory()) files.push({ path: rel, name, size: stat.size, modifiedAt: stat.mtimeMs });
  });
  files.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return files.slice(0, limit);
};

module.exports = { EXPLORER_DIR, ROOT_FOLDERS, safeResolve, listDir, createFolder, deleteEntry, renameEntry, planCopy, executeCopy, moveEntry, search, recentFiles };
