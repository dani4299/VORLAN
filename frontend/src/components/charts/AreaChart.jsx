import React, { useEffect, useMemo, useRef, useState } from 'react';
import { areaPath, buildRuns, linePath, nearestIndex, niceCeil, niceCeilBytes, summarize, timeTicks } from './chartUtils';

const MARGIN = { top: 8, right: 8, bottom: 20 };

/**
 * A time-series line chart, one or more series on a shared scale.
 *   series: [{ key, label, color: 'var(--accent)', dashed?, fill? }]   (dashes, not just colour, tell series apart)
 *   points: [{ t, [key]: number | null }]   t is unix seconds; null = not reported (drawn as a gap)
 *   domain: { from, to }   the visible time window, unix seconds
 *   yMax:   fixed top of the scale (e.g. 100 for percent); omit to size it to the data
 *   scale:  'decimal' (default) or 'bytes' - how an auto-sized top is rounded (bytes rounds within B/KB/MB/GB)
 *   format: (value) => string   used for axis labels, the readout and the screen-reader summary
 * Hover or arrow keys (Left/Right/Home/End) read exact values; the summary is announced on focus.
 */
export const AreaChart = ({ series, points, domain, yMax, scale = 'decimal', format, height = 132, label, emptyMessage = 'No data for this period.' }) => {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null); // index into `valid`
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const valid = useMemo(() => points.filter((p) => series.some((s) => typeof p[s.key] === 'number')), [points, series]);

  const top = useMemo(() => {
    if (yMax) return yMax;
    const peak = Math.max(0, ...valid.flatMap((p) => series.map((s) => (typeof p[s.key] === 'number' ? p[s.key] : 0))));
    return (scale === 'bytes' ? niceCeilBytes : niceCeil)(peak * 1.15);
  }, [yMax, scale, valid, series]);

  // The left margin fits the widest axis label, so "1.5 MB/s" is never clipped.
  const marginLeft = Math.max(36, Math.ceil(Math.max(...[0, top / 2, top].map((v) => format(v).length)) * 6.6) + 12);

  const innerW = Math.max(0, width - marginLeft - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const span = Math.max(1, domain.to - domain.from);
  const xOf = (t) => marginLeft + ((t - domain.from) / span) * innerW;
  const yOf = (v) => MARGIN.top + innerH - (Math.min(v, top) / top) * innerH;
  const baseY = MARGIN.top + innerH;

  const summary = useMemo(() => series.map((s) => {
    const sum = summarize(points.map((p) => p[s.key]));
    return sum ? `${s.label}: now ${format(sum.latest)}, average ${format(sum.average)}, peak ${format(sum.peak)}` : `${s.label}: no data`;
  }).join('. '), [series, points, format]);

  if (valid.length === 0) {
    return (
      <div
        role="group"
        aria-label={`${label}. ${emptyMessage}`}
        className="flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--surface-border)] text-sm text-[var(--ink-muted)]"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const hoverPoint = hover !== null ? valid[hover] : null;

  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = domain.from + ((e.clientX - rect.left - marginLeft) / innerW) * span;
    setKeyboard(false);
    setHover(nearestIndex(valid, t));
  };

  const onKeyDown = (e) => {
    const last = valid.length - 1;
    const current = hover === null ? last : hover;
    let next = null;
    if (e.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (e.key === 'ArrowRight') next = Math.min(last, current + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') { setHover(null); return; }
    if (next === null) return;
    e.preventDefault();
    setKeyboard(true);
    setHover(next);
  };

  const readout = hoverPoint
    ? `${new Date(hoverPoint.t * 1000).toLocaleString()}: ${series.map((s) => `${s.label} ${typeof hoverPoint[s.key] === 'number' ? format(hoverPoint[s.key]) : 'not reported'}`).join(', ')}`
    : '';

  const yTicks = [0, top / 2, top];
  const xTicks = timeTicks(domain.from, domain.to, width < 420 ? 2 : 4);

  return (
    <div
      ref={wrapRef}
      role="group"
      tabIndex={0}
      aria-label={`${label}. ${summary}. Use the left and right arrow keys to read individual values.`}
      onKeyDown={onKeyDown}
      onFocus={() => { if (hover === null) { setKeyboard(true); setHover(valid.length - 1); } }}
      onBlur={() => { setHover(null); setKeyboard(false); }}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-md)]"
      style={{ height }}
    >
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onPointerMove} onPointerLeave={() => { if (!keyboard) setHover(null); }} aria-hidden="true">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={marginLeft} x2={width - MARGIN.right} y1={yOf(v)} y2={yOf(v)} style={{ stroke: 'var(--surface-border)' }} strokeWidth="1" />
              <text x={marginLeft - 6} y={yOf(v) + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--ink-muted)', fontVariantNumeric: 'tabular-nums' }}>{format(v)}</text>
            </g>
          ))}
          {xTicks.map((tick, i) => (
            <text
              key={tick.t}
              x={xOf(tick.t)}
              y={height - 5}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              style={{ fill: 'var(--ink-muted)', fontVariantNumeric: 'tabular-nums' }}
            >
              {tick.label}
            </text>
          ))}

          {series.map((s) => {
            const runs = buildRuns(points.map((p) => ({ t: p.t, v: p[s.key] })));
            return (
              <g key={s.key}>
                {s.fill && runs.map((run, i) => (
                  <path key={`a${i}`} d={areaPath(run, xOf, yOf, baseY)} style={{ fill: s.color }} fillOpacity="0.12" />
                ))}
                {runs.map((run, i) => (
                  run.length === 1
                    ? <circle key={`p${i}`} cx={xOf(run[0].t)} cy={yOf(run[0].v)} r="1.5" style={{ fill: s.color }} />
                    : <path key={`l${i}`} d={linePath(run, xOf, yOf)} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray={s.dashed ? '4 3' : undefined} style={{ stroke: s.color }} />
                ))}
              </g>
            );
          })}

          {hoverPoint && (
            <g>
              <line x1={xOf(hoverPoint.t)} x2={xOf(hoverPoint.t)} y1={MARGIN.top} y2={baseY} style={{ stroke: 'var(--ink-muted)' }} strokeWidth="1" />
              {series.map((s) => typeof hoverPoint[s.key] === 'number' && (
                <circle key={s.key} cx={xOf(hoverPoint.t)} cy={yOf(hoverPoint[s.key])} r="3" strokeWidth="1.5" style={{ fill: s.color, stroke: 'var(--canvas-elevated)' }} />
              ))}
            </g>
          )}
        </svg>
      )}

      {hoverPoint && width > 0 && (
        <div
          aria-hidden="true"
          className="surface-strong elevated rounded-[var(--radius-md)] px-2 py-1.5 text-xs pointer-events-none absolute z-10 whitespace-nowrap"
          style={xOf(hoverPoint.t) > width / 2 ? { top: 0, right: width - xOf(hoverPoint.t) + 10 } : { top: 0, left: xOf(hoverPoint.t) + 10 }}
        >
          <div className="text-[var(--ink-muted)] mb-0.5">{new Date(hoverPoint.t * 1000).toLocaleString()}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[var(--ink)]">
              <svg width="14" height="8" aria-hidden="true">
                <line x1="0" x2="14" y1="4" y2="4" strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} style={{ stroke: s.color }} />
              </svg>
              <span>{s.label}</span>
              <span className="tabular-nums ml-auto pl-3">{typeof hoverPoint[s.key] === 'number' ? format(hoverPoint[s.key]) : 'n/a'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="sr-only" aria-live="polite">{keyboard ? readout : ''}</div>
    </div>
  );
};
