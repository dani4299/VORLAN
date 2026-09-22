const { execFile } = require('child_process');
const os = require('os');

// Lets the admin desktop see and control VORLAN's own systemd user service (installed by the Linux
// installer - see installer/systemd/vorlan.service.template). Everything here is a no-op that reports
// "not available" outside that setup (a dev checkout, Windows, or any install that isn't running as
// a systemd unit), so the Services window can safely ask without knowing whether it applies.
const UNIT = 'vorlan.service';

const run = (args) => new Promise((resolve, reject) => {
  execFile('systemctl', args, { timeout: 5000 }, (err, stdout, stderr) => {
    if (err) return reject(Object.assign(new Error(stderr?.trim() || err.message), { code: err.code }));
    resolve(stdout);
  });
});

const parseShow = (output) => Object.fromEntries(
  output.split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

/**
 * Whether this process is (probably) itself running as vorlan.service, and if so its live state.
 * `available: false` covers every reason it might not apply - not Linux, systemd missing, the unit
 * not installed - without needing the caller to tell those apart.
 */
const getStatus = async () => {
  if (os.platform() !== 'linux') return { available: false };
  try {
    const out = await run(['--user', 'show', UNIT, '--no-page',
      '--property=ActiveState,SubState,ActiveEnterTimestamp,NRestarts,MainPID,LoadState']);
    const info = parseShow(out);
    if (info.LoadState !== 'loaded') return { available: false };
    // systemd's own timestamp format ("Tue 2026-09-23 14:32:10 UTC") isn't something a browser's
    // Date parser can be trusted to read the same way everywhere - converted to a real ISO string
    // here (where it can only ever be Node/V8 parsing it) so the frontend never has to know the difference.
    const sinceDate = info.ActiveEnterTimestamp ? new Date(info.ActiveEnterTimestamp) : null;
    return {
      available: true,
      active: info.ActiveState === 'active',
      state: info.SubState || info.ActiveState,
      since: sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate.toISOString() : null,
      restarts: Number(info.NRestarts) || 0,
      pid: Number(info.MainPID) || null,
    };
  } catch {
    return { available: false };
  }
};

/** Fire-and-forget on purpose: the caller (the route) has already answered the request before this
 * runs, since a successful restart/stop kills the very process handling that request. */
const restartSelf = () => run(['--user', 'restart', UNIT]);
const stopSelf = () => run(['--user', 'stop', UNIT]);

module.exports = { getStatus, restartSelf, stopSelf };
