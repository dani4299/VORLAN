// Pure chart math, kept out of the component so it can be tested without a browser.

/** Rounds up to a "nice" axis maximum: 1, 2, 2.5, 5 or 10 times a power of ten. */
export const niceCeil = (value) => {
  if (!(value > 0)) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const f = value / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
};

/** Like niceCeil, but rounds within the display unit (B, KB, MB...) so a byte-rate axis tops out at e.g. 200 KB/s, not 177 KB/s. */
export const niceCeilBytes = (value) => {
  if (!(value > 0)) return 1024;
  const k = Math.min(Math.max(Math.floor(Math.log(value) / Math.log(1024)), 0), 4);
  const unit = 1024 ** k;
  return niceCeil(value / unit) * unit;
};

export const median = (nums) => {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Splits a series into drawable runs. A run breaks at a missing (null) value and at a hole in the
 * timeline (a gap wider than 2.5x the usual spacing), so a gap in the data shows as a gap in the
 * line instead of a misleading straight segment across it.
 * points: [{ t, v }]  ->  [[{ t, v }, ...], ...]
 */
export const buildRuns = (points) => {
  const step = median(points.slice(1).map((p, i) => p.t - points[i].t).filter((d) => d > 0));
  const maxGap = step > 0 ? step * 2.5 : Infinity;
  const runs = [];
  let run = [];
  let prev = null;
  for (const p of points) {
    const missing = typeof p.v !== 'number' || !Number.isFinite(p.v);
    if (missing || (prev && p.t - prev.t > maxGap)) {
      if (run.length) runs.push(run);
      run = [];
    }
    if (!missing) run.push(p);
    prev = p;
  }
  if (run.length) runs.push(run);
  return runs;
};

/** Index of the point closest in time to `t` (points sorted ascending by t), or -1 if empty. */
export const nearestIndex = (points, t) => {
  if (points.length === 0) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].t - t) <= Math.abs(points[lo].t - t)) return lo - 1;
  return lo;
};

export const summarize = (values) => {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return {
    latest: nums[nums.length - 1],
    average: nums.reduce((a, b) => a + b, 0) / nums.length,
    peak: Math.max(...nums),
  };
};

const two = (n) => String(n).padStart(2, '0');

/** Evenly spaced time ticks. Labels are clock times for spans up to two days, dates beyond that. */
export const timeTicks = (from, to, count = 4) => {
  const span = to - from;
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    const t = from + (span * i) / count;
    const d = new Date(t * 1000);
    const label = span <= 2 * 86400
      ? `${two(d.getHours())}:${two(d.getMinutes())}`
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    ticks.push({ t, label });
  }
  return ticks;
};

export const linePath = (run, xOf, yOf) => run.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');

export const areaPath = (run, xOf, yOf, baseY) => {
  if (run.length === 0) return '';
  const top = run.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
  return `${top} L${xOf(run[run.length - 1].t).toFixed(1)},${baseY} L${xOf(run[0].t).toFixed(1)},${baseY} Z`;
};
