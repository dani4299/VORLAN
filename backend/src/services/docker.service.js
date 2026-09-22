const { spawn } = require('child_process');

// Talks to Docker the same way a person at a terminal would: by running the `docker` command. No
// direct socket/Engine-API client, no extra dependency - just the CLI, which is what "installing
// Docker" actually gives you.

/** A Docker error: `status` is a best-guess HTTP-style code from the CLI's own wording (Docker's
 * exit codes don't distinguish "not found" from "already exists" from anything else), `message`
 * is its stderr, verbatim. `reason` is set only for the two states the App Store shows calmly
 * instead of as an error - "not_installed" and "not_running" - so the frontend can branch on a
 * stable value instead of pattern-matching Docker's own wording a second time. */
const dockerError = (status, message, reason) => Object.assign(new Error(message || 'The docker command failed.'), { status, docker: true, reason });

/** Docker's own text is the only signal a CLI call gives back, so a few common phrasings are
 * mapped to a status the rest of the app can branch on; anything else is just shown as-is. */
const classify = (stderr) => {
  const message = stderr.trim() || 'The docker command failed.';
  if (/already in use/i.test(stderr)) return dockerError(409, message);
  if (/no such (container|image|object|network)/i.test(stderr)
    || /manifest unknown|manifest for .* not found/i.test(stderr)
    || /repository does not exist|pull access denied/i.test(stderr)) return dockerError(404, message);
  // The CLI is installed and ran fine, but couldn't reach the daemon - Docker Desktop (or the
  // docker/dockerd service on Linux) isn't running. This is the single most common "App Store
  // doesn't work yet" state on a machine that genuinely has Docker installed, so it gets its own
  // calm message instead of surfacing the raw socket/named-pipe error text.
  if (/cannot connect to the docker daemon|failed to connect to the docker api|daemon is not running|error during connect/i.test(stderr)) {
    return dockerError(503, "Docker isn't running.", 'not_running');
  }
  return dockerError(undefined, message);
};

/** Runs one `docker <args>` and waits for it to finish. Resolves with everything it printed;
 * rejects with a classified dockerError on a non-zero exit or if `docker` itself can't be run. */
const run = (args, { input } = {}) => new Promise((resolve, reject) => {
  const proc = spawn('docker', args, { windowsHide: true });
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => { stdout += d; });
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.on('error', (err) => reject(err.code === 'ENOENT'
    ? dockerError(503, "Docker isn't installed.", 'not_installed')
    : dockerError(0, err.message)));
  proc.on('close', (code) => (code === 0 ? resolve({ stdout, stderr }) : reject(classify(stderr))));
  if (input !== undefined) proc.stdin.end(input);
});

/** Never throws - used to decide whether to show the App Store as available at all, and which of
 * three calm states to show if not: `reason` is "not_installed", "not_running", or (for anything
 * else Docker might say) undefined, in which case `message` is Docker's own text, shown as-is. */
const ping = async () => {
  try {
    await run(['info', '--format', '{{.ServerVersion}}']);
    return { available: true };
  } catch (err) {
    return { available: false, reason: err.reason, message: err.message };
  }
};

/** Pulls an image. `onProgress(text)` gets Docker's own progress output a line/chunk at a time
 * (a per-layer download bar, same as watching `docker pull` in a terminal) - nothing structured
 * to parse here, since the CLI's progress output is meant for a terminal, not a machine. */
const pullImage = (image, { onProgress } = {}) => new Promise((resolve, reject) => {
  const proc = spawn('docker', ['pull', image], { windowsHide: true });
  let stderr = '';
  proc.stdout.on('data', (d) => onProgress?.(d.toString()));
  proc.stderr.on('data', (d) => { stderr += d; onProgress?.(d.toString()); });
  proc.on('error', (err) => reject(dockerError(0, err.code === 'ENOENT'
    ? "Docker isn't installed (the `docker` command was not found)." : err.message)));
  proc.on('close', (code) => (code === 0 ? resolve() : reject(classify(stderr))));
});

const createContainer = async (name, { image, env = {}, ports = [], volumes = [] }) => {
  const args = ['create', '--name', name, '--restart', 'unless-stopped'];
  for (const p of ports) args.push('-p', `${p.host}:${p.container}/${p.protocol || 'tcp'}`);
  for (const v of volumes) args.push('-v', `${v.hostPath}:${v.containerPath}`);
  for (const [key, value] of Object.entries(env)) args.push('-e', `${key}=${value}`);
  args.push(image);
  // `docker create` pulls the image itself if it isn't present locally yet (the same as `docker
  // run` would) - a genuinely nonexistent image still ends up classified as 404, just by way of
  // the pull Docker attempts internally rather than a check VORLAN makes beforehand.
  const { stdout } = await run(args);
  return { Id: stdout.trim() };
};

// Starting an already-running container, or stopping an already-stopped one, is a normal
// idempotent success as far as Docker itself is concerned - no special-casing needed here.
const startContainer = (id) => run(['start', id]);
const stopContainer = (id) => run(['stop', '-t', '10', id]);

const removeContainer = (id) => run(['rm', '-f', id]).catch((err) => {
  if (err.status === 404) return {}; // already gone
  throw err;
});

const inspectContainer = async (id) => {
  const { stdout } = await run(['inspect', id]);
  const [info] = JSON.parse(stdout);
  return info;
};

/** Recent output from the container. `docker logs` already separates and delivers stdout/stderr
 * as plain text on two real pipes - no frame format to unwrap here, unlike talking to the Engine
 * API directly. The two streams are simply concatenated, so interleaving between them isn't
 * exactly preserved; fine for "what has this app been saying lately", not a terminal replacement. */
const getLogs = async (id, { tail = 200 } = {}) => {
  const { stdout, stderr } = await run(['logs', '--tail', String(tail), id]);
  return stdout + stderr;
};

module.exports = { ping, pullImage, createContainer, startContainer, stopContainer, removeContainer, inspectContainer, getLogs };
