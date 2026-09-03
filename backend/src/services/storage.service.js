const fs = require('fs');
const path = require('path');
const { GLOBAL_MEDIA_DIR, PERSONAL_VAULT_DIR } = require('../config/paths');

const IMAGE = /\.(jpeg|jpg|gif|png|webp)$/i;
const VIDEO = /\.(mp4|webm|mkv)$/i;
const AUDIO = /\.(mp3|wav|ogg|m4a|opus)$/i;

/** Mirrors the frontend's own file-type classification, so the numbers line up with what each folder shows. */
const classify = (filename) => {
  if (IMAGE.test(filename) || VIDEO.test(filename)) return 'gallery';
  if (AUDIO.test(filename)) return 'music';
  return 'documents';
};

const sumDirByCategory = (dir, filter = () => true) => {
  const totals = { documents: 0, music: 0, gallery: 0 };
  if (!fs.existsSync(dir)) return totals;

  for (const name of fs.readdirSync(dir)) {
    if (!filter(name)) continue;
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;
    totals[classify(name)] += stat.size;
  }
  return totals;
};

/** Real physical disk usage for the volume the vault lives on. */
const getDiskUsage = async () => {
  const stats = await fs.promises.statfs(GLOBAL_MEDIA_DIR);
  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bfree * stats.bsize;
  return { totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
};

const getSummary = async ({ scope, username }) => {
  if (scope === 'personal' && username) {
    return { categories: sumDirByCategory(PERSONAL_VAULT_DIR, (name) => name.startsWith(`${username}_`)) };
  }

  const categories = sumDirByCategory(GLOBAL_MEDIA_DIR);
  let disk = null;
  try {
    disk = await getDiskUsage();
  } catch (err) {
    console.warn("Couldn't read disk usage:", err.message);
  }
  return { categories, disk };
};

module.exports = { getSummary, getDiskUsage };
