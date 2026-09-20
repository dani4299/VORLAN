const { randomUUID } = require('crypto');
const eventBus = require('./eventBus.service');

// Jobs live in memory only: a restart clears the history, and a job that was mid-flight when the
// process died is simply gone rather than resumed.
const MAX_CONCURRENT = 2;
const MAX_FINISHED_KEPT = 100;

const jobs = new Map(); // insertion order == creation order
const pending = [];
let running = 0;

const snapshot = (job) => ({
  id: job.id,
  name: job.name,
  label: job.label,
  startedBy: job.startedBy,
  status: job.status,
  error: job.error,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
});

const trimFinished = () => {
  const finished = [...jobs.values()].filter((j) => j.status === 'succeeded' || j.status === 'failed');
  for (const job of finished.slice(0, Math.max(0, finished.length - MAX_FINISHED_KEPT))) {
    jobs.delete(job.id);
  }
};

const execute = async (job) => {
  job.status = 'running';
  job.startedAt = Date.now();
  eventBus.emit('job.started', snapshot(job));
  try {
    const result = await job.run();
    job.status = 'succeeded';
    job.finishedAt = Date.now();
    job.resolve(result);
    eventBus.emit('job.succeeded', snapshot(job));
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Unknown error';
    job.finishedAt = Date.now();
    job.reject(err);
    eventBus.emit('job.failed', snapshot(job));
  } finally {
    running--;
    trimFinished();
    drain();
  }
};

const drain = () => {
  while (running < MAX_CONCURRENT && pending.length > 0) {
    running++;
    execute(pending.shift());
  }
};

/**
 * Queues `run` (sync or async) and returns immediately with { id, done }. `done` settles with the
 * job's result or error, so a caller that needs the outcome can `await` it while a caller that
 * doesn't can ignore it - a rejected `done` nobody awaits is not an unhandled rejection.
 */
const enqueue = (name, run, { label, startedBy } = {}) => {
  let resolve;
  let reject;
  const done = new Promise((res, rej) => { resolve = res; reject = rej; });
  done.catch(() => {});

  const job = {
    id: randomUUID(),
    name,
    label: label || name,
    startedBy: startedBy || null,
    status: 'queued',
    error: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    run,
    resolve,
    reject,
  };
  jobs.set(job.id, job);
  pending.push(job);
  drain();
  return { id: job.id, done };
};

/** Newest first. */
const list = () => [...jobs.values()].map(snapshot).reverse();

module.exports = { enqueue, list };
