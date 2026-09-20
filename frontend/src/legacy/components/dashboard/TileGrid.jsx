import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  BatteryCharging, BatteryFull, BatteryMedium, BatteryLow, Plug, Wifi, WifiOff,
  X, Maximize2, Plus, GripVertical,
} from 'lucide-react';
import { TILES_BY_ID, mergeDashboardLayout } from '../../lib/dashboardTiles';
import { useProfile } from '../../../context/ProfileContext';
import { useSystemStats } from '../../../lib/useSystemStats';
import { formatBytes } from '../../../lib/format';
import { isAdmin as checkIsAdmin } from '../../../lib/api';

const SIZE_SPAN = {
  S: 'col-span-1 row-span-1',
  M: 'col-span-2 row-span-1',
  L: 'col-span-2 row-span-2',
};
const SPAN_COUNT = { S: { cols: 1, rows: 1 }, M: { cols: 2, rows: 1 }, L: { cols: 2, rows: 2 } };
const ROW_PX = 108;

const spanToSize = ({ cols, rows }) => (cols === 1 ? 'S' : rows === 2 ? 'L' : 'M');

const formatUptime = (seconds) => {
  if (seconds == null) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const batteryVisual = (battery) => {
  if (!battery || !battery.hasBattery) return { icon: Plug, text: 'Plugged in' };
  if (battery.isCharging) return { icon: BatteryCharging, text: `${battery.percent}% · Charging` };
  if (battery.percent <= 20) return { icon: BatteryLow, text: `${battery.percent}% · On battery` };
  if (battery.percent <= 70) return { icon: BatteryMedium, text: `${battery.percent}% · On battery` };
  return { icon: BatteryFull, text: `${battery.percent}% · On battery` };
};

const StatHeader = ({ icon: Icon, label, color }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 chip">
      <Icon size={15} style={{ color }} />
    </div>
    <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
  </div>
);

const UsageBar = ({ percent, color, caption }) => (
  <>
    <p className="text-xs text-[var(--ink-muted)]">{caption}</p>
    <div className="h-1.5 rounded-full bg-[var(--overlay-4)] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percent}%`, background: color }} />
    </div>
  </>
);

const StatTileContent = ({ tile, stats }) => {
  if (tile.id === 'power') {
    const battery = stats?.battery;
    const visual = battery ? batteryVisual(battery) : { icon: BatteryCharging, text: null };
    return (
      <>
        <StatHeader icon={visual.icon} label="Power" color={tile.color} />
        {visual.text ? <p className="text-xs text-[var(--ink-muted)]">{visual.text}</p> : <p className="text-xs text-[var(--ink-faint)]">Unavailable</p>}
        {battery?.hasBattery && <UsageBar percent={battery.percent} color={tile.color} caption="" />}
      </>
    );
  }

  if (tile.id === 'cpu') {
    const cpu = stats?.cpu;
    return (
      <>
        <StatHeader icon={tile.icon} label="CPU" color={tile.color} />
        {cpu ? <UsageBar percent={cpu.percent} color={tile.color} caption={`${cpu.percent}% load`} /> : <p className="text-xs text-[var(--ink-faint)]">Unavailable</p>}
      </>
    );
  }

  if (tile.id === 'network') {
    const net = stats?.network;
    const Icon = net?.connected ? Wifi : WifiOff;
    return (
      <>
        <StatHeader icon={Icon} label="Network" color={tile.color} />
        {net ? (
          <p className="text-xs text-[var(--ink-muted)]">{net.connected ? (net.ip || 'Connected') : 'Disconnected'}</p>
        ) : (
          <p className="text-xs text-[var(--ink-faint)]">Unavailable</p>
        )}
      </>
    );
  }

  if (tile.id === 'uptime') {
    const uptime = formatUptime(stats?.uptimeSeconds);
    return (
      <>
        <StatHeader icon={tile.icon} label="Uptime" color={tile.color} />
        {uptime ? <p className="text-xs text-[var(--ink-muted)]">{uptime} since boot</p> : <p className="text-xs text-[var(--ink-faint)]">Unavailable</p>}
      </>
    );
  }

  const data = stats?.[tile.id === 'storage' ? 'disk' : 'ram'];
  const percent = data ? Math.min(100, Math.round((data.usedBytes / data.totalBytes) * 100)) : null;
  return (
    <>
      <StatHeader icon={tile.icon} label={tile.label} color={tile.color} />
      {data ? <UsageBar percent={percent} color={tile.color} caption={`${formatBytes(data.usedBytes)} of ${formatBytes(data.totalBytes)}`} /> : <p className="text-xs text-[var(--ink-faint)]">Unavailable</p>}
    </>
  );
};

const Tile = ({
  tile, size, editMode, dragging, onDragStart, onDragOver, onDrop, onDragEnd,
  onRemove, onResizePreview, onResizeCommit, gridRef, stats, navigate,
}) => {
  const resizeState = useRef(null);

  const handleClick = () => {
    if (editMode) return;
    if (tile.kind === 'nav') navigate(tile.path);
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const gridEl = gridRef.current;
    if (!gridEl) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const gridRect = gridEl.getBoundingClientRect();
    const gridStyles = getComputedStyle(gridEl);
    const colGap = parseFloat(gridStyles.columnGap) || 0;
    const columns = gridStyles.gridTemplateColumns.split(' ').length;
    const colWidth = (gridRect.width - colGap * (columns - 1)) / columns;

    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startSpan: SPAN_COUNT[size],
      colWidth,
      colGap,
      lastSize: size,
    };
  };

  const moveResize = (e) => {
    const rs = resizeState.current;
    if (!rs) return;
    const dx = e.clientX - rs.startX;
    const dy = e.clientY - rs.startY;
    let cols = Math.round(rs.startSpan.cols + dx / (rs.colWidth + rs.colGap));
    let rows = Math.round(rs.startSpan.rows + dy / (ROW_PX + rs.colGap));
    cols = Math.max(1, Math.min(2, cols));
    rows = Math.max(1, Math.min(2, rows));
    if (cols === 1) rows = 1;
    const nextSize = spanToSize({ cols, rows });
    if (nextSize !== rs.lastSize) {
      rs.lastSize = nextSize;
      onResizePreview(tile.id, nextSize);
    }
  };

  const endResize = () => {
    if (!resizeState.current) return;
    onResizeCommit(tile.id, resizeState.current.lastSize);
    resizeState.current = null;
  };

  const coreCardStyle = tile.core ? {
    background: `color-mix(in srgb, ${tile.color} 16%, var(--canvas-elevated))`,
    borderColor: `color-mix(in srgb, ${tile.color} 32%, transparent)`,
  } : undefined;
  const coreBadgeStyle = tile.core ? { background: `color-mix(in srgb, ${tile.color} 28%, transparent)` } : undefined;

  return (
    <div
      draggable={editMode && !tile.core}
      onDragStart={() => onDragStart(tile.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(tile.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(tile.id); }}
      onDragEnd={onDragEnd}
      className={`relative ${SIZE_SPAN[size]} ${editMode && !tile.core ? 'animate-tile-wiggle' : ''} ${dragging ? 'opacity-40' : ''}`}
    >
      {tile.kind === 'nav' ? (
        <button
          onClick={handleClick}
          style={coreCardStyle}
          className={`${tile.core ? 'border' : 'surface'} w-full h-full rounded-[28px] flex flex-col items-center justify-center gap-3 transition-all duration-150 ${editMode ? '' : 'hover:brightness-110 active:scale-[0.96]'}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tile.core ? '' : 'chip'}`} style={coreBadgeStyle}>
            <tile.icon size={22} strokeWidth={2.25} style={{ color: tile.color }} />
          </div>
          <span className="text-sm font-medium text-[var(--ink)]">{tile.label}</span>
        </button>
      ) : (
        <div className="surface w-full h-full rounded-[28px] p-4 flex flex-col gap-2 justify-center overflow-hidden">
          <StatTileContent tile={tile} stats={stats} />
        </div>
      )}

      {editMode && (
        <>
          {/*
            Badges sit INSIDE each tile's own box (not offset outside it) so they can never be
            clipped by an ancestor's overflow-hidden - the grid's height varies with tile count,
            so there's no guaranteed headroom for anything poking past the tile's own bounds.
          */}
          {!tile.core && (
            <>
              <button
                onClick={() => onRemove(tile.id)}
                title="Remove tile"
                draggable={false}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--hue-rose)] text-white flex items-center justify-center shadow-lg z-10"
              >
                <X size={13} strokeWidth={3} />
              </button>
              <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[var(--canvas-elevated)] border border-[var(--surface-border-strong)] text-[var(--ink-muted)] flex items-center justify-center shadow-lg cursor-grab z-10">
                <GripVertical size={13} />
              </div>
              <button
                title="Resize tile"
                draggable={false}
                onPointerDown={startResize}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--canvas-elevated)] border border-[var(--surface-border-strong)] text-[var(--ink)] flex items-center justify-center shadow-lg z-10 cursor-nwse-resize touch-none"
              >
                <Maximize2 size={11} />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

/** iOS-style widget gallery: slides up from the bottom, lists every tile not currently on the dashboard. */
const AddTileSheet = ({ available, onAdd, onClose }) => createPortal(
  <div className="fixed inset-0 z-[200]">
    <div className="absolute inset-0 scrim animate-toast-in" onClick={onClose} />
    <div className="surface-strong absolute bottom-0 left-0 right-0 rounded-t-[32px] p-6 pb-8 max-h-[70vh] overflow-y-auto animate-sheet-up">
      <div className="w-10 h-1.5 rounded-full bg-[var(--overlay-5)] mx-auto mb-5" />
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Add a tile</h3>
        <button onClick={onClose} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          <X size={18} />
        </button>
      </div>
      {available.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)] text-center py-10">Every tile is already on your dashboard.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {available.map((id) => {
            const tile = TILES_BY_ID[id];
            return (
              <button
                key={id}
                onClick={() => onAdd(id)}
                className="surface rounded-2xl p-4 flex flex-col items-center gap-2 hover:brightness-125 active:scale-95 transition-all duration-150"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center chip">
                  <tile.icon size={18} style={{ color: tile.color }} />
                </div>
                <span className="text-xs font-medium text-[var(--ink)] text-center">{tile.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  </div>,
  document.body,
);

export const TileGrid = ({ editMode, onRowsChange }) => {
  const navigate = useNavigate();
  const stats = useSystemStats();
  const { dashboardLayout, setDashboardLayout } = useProfile();
  const [draggedId, setDraggedId] = useState(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [dragPreview, setDragPreview] = useState(null); // { id, size }
  const gridRef = useRef(null);

  const layout = useMemo(() => mergeDashboardLayout(dashboardLayout, checkIsAdmin()), [dashboardLayout]);

  // Measure actual rendered row count (via scrollHeight, which reflects the grid's own content
  // height even when an ancestor clips it) so the page can shrink other elements to make room
  // rather than losing rows off the bottom.
  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl || !onRowsChange) return;
    const gap = parseFloat(getComputedStyle(gridEl).rowGap) || 0;
    const measure = () => {
      const rows = Math.max(1, Math.round((gridEl.scrollHeight + gap) / (ROW_PX + gap)));
      onRowsChange(rows);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [layout.order, layout.sizes, onRowsChange]);

  const removeTile = (id) => {
    setDashboardLayout((prev) => ({
      ...prev,
      order: prev.order.filter((tid) => tid !== id),
      dismissed: [...(prev.dismissed || []), id],
    }));
  };

  const restoreTile = (id) => {
    setDashboardLayout((prev) => ({
      ...prev,
      order: [...prev.order, id],
      dismissed: (prev.dismissed || []).filter((tid) => tid !== id),
    }));
    setAddSheetOpen(false);
  };

  const commitResize = (id, size) => {
    setDragPreview(null);
    setDashboardLayout((prev) => ({ ...prev, sizes: { ...prev.sizes, [id]: size } }));
  };

  const handleDrop = (targetId) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
    const movedId = draggedId;
    setDashboardLayout((prev) => {
      const order = [...prev.order];
      const from = order.indexOf(movedId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to, 0, movedId);
      return { ...prev, order };
    });
    setDraggedId(null);
  };

  return (
    <div className="w-full max-w-3xl">
      {editMode && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setAddSheetOpen(true)}
            className="surface px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:brightness-125 active:scale-[0.97] transition-all duration-150"
          >
            <Plus size={16} /> Add tile
          </button>
        </div>
      )}

      <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-5 gap-3 md:gap-4" style={{ gridAutoFlow: 'dense', gridAutoRows: `${ROW_PX}px` }}>
        {layout.order.map((id) => (
          <Tile
            key={id}
            tile={TILES_BY_ID[id]}
            size={dragPreview?.id === id ? dragPreview.size : (layout.sizes[id] || 'S')}
            editMode={editMode}
            dragging={draggedId === id}
            onDragStart={setDraggedId}
            onDragOver={() => {}}
            onDrop={handleDrop}
            onDragEnd={() => setDraggedId(null)}
            onRemove={removeTile}
            onResizePreview={(tid, size) => setDragPreview({ id: tid, size })}
            onResizeCommit={commitResize}
            gridRef={gridRef}
            stats={stats}
            navigate={navigate}
          />
        ))}
      </div>

      {addSheetOpen && (
        <AddTileSheet available={layout.available} onAdd={restoreTile} onClose={() => setAddSheetOpen(false)} />
      )}
    </div>
  );
};
