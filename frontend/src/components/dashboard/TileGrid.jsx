import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BatteryCharging, BatteryFull, BatteryMedium, BatteryLow, Plug, Wifi, WifiOff,
  X, Maximize2, Plus, GripVertical,
} from 'lucide-react';
import { TILES_BY_ID, mergeDashboardLayout } from '../../lib/dashboardTiles';
import { useProfile } from '../../context/ProfileContext';
import { useSystemStats } from '../../lib/useSystemStats';
import { formatBytes, formatUptime } from '../../lib/format';
import { isAdmin as checkIsAdmin } from '../../lib/api';
import { Button } from '../ui/Button';
import { Meter } from '../ui/Meter';
import { Modal } from '../ui/Modal';

const SIZE_SPAN = {
  S: 'col-span-1 row-span-1',
  M: 'col-span-2 row-span-1',
  L: 'col-span-2 row-span-2',
};
const SPAN_COUNT = { S: { cols: 1, rows: 1 }, M: { cols: 2, rows: 1 }, L: { cols: 2, rows: 2 } };
const SIZE_LABEL = { S: 'small', M: 'wide', L: 'large' };
const NEXT_SIZE = { S: 'M', M: 'L', L: 'S' };
const ROW_PX = 96;

const spanToSize = ({ cols, rows }) => (cols === 1 ? 'S' : rows === 2 ? 'L' : 'M');

const batteryVisual = (battery) => {
  if (!battery || !battery.hasBattery) return { icon: Plug, text: 'Plugged in' };
  if (battery.isCharging) return { icon: BatteryCharging, text: `${battery.percent}% · Charging` };
  if (battery.percent <= 20) return { icon: BatteryLow, text: `${battery.percent}% · On battery` };
  if (battery.percent <= 70) return { icon: BatteryMedium, text: `${battery.percent}% · On battery` };
  return { icon: BatteryFull, text: `${battery.percent}% · On battery` };
};

const WidgetHeader = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
    <Icon size={16} aria-hidden="true" className="text-[var(--ink-muted)]" />
    {label}
  </div>
);

const Unavailable = () => <p className="text-xs text-[var(--ink-muted)]">Not available</p>;

/** What a widget shows. Usage bars go warm as a resource fills up; battery and load are plain readings. */
const WidgetContent = ({ tile, stats }) => {
  if (tile.id === 'power') {
    const battery = stats?.battery;
    const visual = battery ? batteryVisual(battery) : null;
    return (
      <>
        <WidgetHeader icon={visual?.icon || tile.icon} label="Power" />
        {visual ? <p className="text-xs text-[var(--ink-muted)]">{visual.text}</p> : <Unavailable />}
        {battery?.hasBattery && <Meter value={battery.percent} label="Battery" valueText={`${battery.percent}%`} tone="accent" />}
      </>
    );
  }

  if (tile.id === 'cpu') {
    const cpu = stats?.cpu;
    return (
      <>
        <WidgetHeader icon={tile.icon} label="CPU" />
        {cpu ? (
          <>
            <p className="text-xs text-[var(--ink-muted)]">{cpu.percent}% load</p>
            <Meter value={cpu.percent} label="CPU load" valueText={`${cpu.percent}%`} />
          </>
        ) : <Unavailable />}
      </>
    );
  }

  if (tile.id === 'network') {
    const net = stats?.network;
    return (
      <>
        <WidgetHeader icon={net?.connected ? Wifi : WifiOff} label="Network" />
        {net ? <p className="text-xs text-[var(--ink-muted)]">{net.connected ? (net.ip || 'Connected') : 'Disconnected'}</p> : <Unavailable />}
      </>
    );
  }

  if (tile.id === 'uptime') {
    const seconds = stats?.uptimeSeconds;
    return (
      <>
        <WidgetHeader icon={tile.icon} label="Uptime" />
        {seconds != null ? <p className="text-xs text-[var(--ink-muted)]">{formatUptime(seconds)} since boot</p> : <Unavailable />}
      </>
    );
  }

  const data = stats?.[tile.id === 'storage' ? 'disk' : 'ram'];
  const text = data ? `${formatBytes(data.usedBytes)} of ${formatBytes(data.totalBytes)}` : null;
  return (
    <>
      <WidgetHeader icon={tile.icon} label={tile.label} />
      {data ? (
        <>
          <p className="text-xs text-[var(--ink-muted)]">{text}</p>
          <Meter value={data.usedBytes} max={data.totalBytes} label={`${tile.label} in use`} valueText={text} />
        </>
      ) : <Unavailable />}
    </>
  );
};

const EDIT_BUTTON = 'absolute w-7 h-7 rounded-[var(--radius-md)] flex items-center justify-center bg-[var(--canvas-elevated)] border border-[var(--surface-border-strong)] text-[var(--ink)] hover:bg-[var(--overlay-3)] z-10';

const Tile = ({
  tile, size, editMode, dragging, onDragStart, onDrop, onDragEnd, onMove,
  onRemove, onResizePreview, onResizeCommit, gridRef, stats, navigate,
}) => {
  const resizeState = useRef(null);
  const dragged = useRef(false);

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const gridEl = gridRef.current;
    if (!gridEl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragged.current = false;

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
      dragged.current = true;
      onResizePreview(tile.id, nextSize);
    }
  };

  const endResize = () => {
    if (!resizeState.current) return;
    onResizeCommit(tile.id, resizeState.current.lastSize);
    resizeState.current = null;
  };

  // A plain click (or Enter/Space) steps through the sizes, so resizing doesn't need a mouse drag.
  const cycleSize = () => {
    if (dragged.current) { dragged.current = false; return; }
    onResizeCommit(tile.id, NEXT_SIZE[size]);
  };

  const onGripKeyDown = (e) => {
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    onMove(tile.id, delta);
  };

  return (
    <div
      draggable={editMode && !tile.core}
      onDragStart={() => onDragStart(tile.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(tile.id); }}
      onDragEnd={onDragEnd}
      className={`relative ${SIZE_SPAN[size]} ${dragging ? 'opacity-40' : ''}`}
    >
      {tile.kind === 'nav' ? (
        <button
          type="button"
          onClick={() => { if (!editMode) navigate(tile.path); }}
          className="surface w-full h-full rounded-[var(--radius-lg)] flex flex-col items-center justify-center gap-2 text-[var(--ink)] transition-colors hover:border-[var(--ink-faint)]"
        >
          <tile.icon size={22} aria-hidden="true" className="text-[var(--ink-muted)]" />
          <span className="text-sm font-medium">{tile.label}</span>
        </button>
      ) : (
        // While arranging, the move and resize handles sit in the corners, so a widget's content is kept clear of them.
        <div className={`surface w-full h-full rounded-[var(--radius-lg)] p-4 flex flex-col gap-2 justify-center overflow-hidden ${editMode && !tile.core ? 'px-10' : ''}`}>
          <WidgetContent tile={tile} stats={stats} />
        </div>
      )}

      {/* The controls sit inside the tile's own box so no ancestor's overflow can clip them. */}
      {editMode && !tile.core && (
        <>
          <button type="button" onClick={() => onRemove(tile.id)} aria-label={`Remove ${tile.label}`} title={`Remove ${tile.label}`} draggable={false} className={`${EDIT_BUTTON} top-1.5 right-1.5`}>
            <X size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${tile.label}. Use the arrow keys, or drag.`}
            title="Move"
            draggable={false}
            onKeyDown={onGripKeyDown}
            className={`${EDIT_BUTTON} top-1.5 left-1.5 cursor-grab`}
          >
            <GripVertical size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Resize ${tile.label}, currently ${SIZE_LABEL[size]}. Press to change, or drag.`}
            title="Resize"
            draggable={false}
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onClick={cycleSize}
            className={`${EDIT_BUTTON} bottom-1.5 right-1.5 cursor-nwse-resize touch-none`}
          >
            <Maximize2 size={12} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
};

/** Lists every tile not currently on the home page, so the ones that are off by default (the widgets) can be added. */
const AddTileDialog = ({ available, onAdd, onClose }) => (
  <Modal title="Add a tile" description={available.length ? 'Choose a widget or app to add to your home page.' : undefined} onClose={onClose}>
    {available.length === 0 ? (
      <p className="text-sm text-[var(--ink-muted)]">Every tile is already on your home page.</p>
    ) : (
      <ul className="grid grid-cols-2 gap-2">
        {available.map((id) => {
          const tile = TILES_BY_ID[id];
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onAdd(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--surface-border-strong)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--overlay-2)] transition-colors"
              >
                <tile.icon size={18} aria-hidden="true" className="text-[var(--ink-muted)]" />
                {tile.label}
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </Modal>
);

export const TileGrid = ({ editMode }) => {
  const navigate = useNavigate();
  const stats = useSystemStats();
  const { dashboardLayout, setDashboardLayout } = useProfile();
  const [draggedId, setDraggedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [resizePreview, setResizePreview] = useState(null); // { id, size }
  const gridRef = useRef(null);

  const layout = useMemo(() => mergeDashboardLayout(dashboardLayout, checkIsAdmin()), [dashboardLayout]);

  const removeTile = (id) => {
    setDashboardLayout((prev) => ({
      ...prev,
      order: prev.order.filter((tid) => tid !== id),
      dismissed: [...(prev.dismissed || []), id],
    }));
  };

  const addTile = (id) => {
    setDashboardLayout((prev) => ({
      ...prev,
      order: [...prev.order, id],
      dismissed: (prev.dismissed || []).filter((tid) => tid !== id),
    }));
    setAddOpen(false);
  };

  const commitResize = (id, size) => {
    setResizePreview(null);
    setDashboardLayout((prev) => ({ ...prev, sizes: { ...prev.sizes, [id]: size } }));
  };

  const moveTo = (movedId, targetId) => {
    setDashboardLayout((prev) => {
      const order = [...prev.order];
      const from = order.indexOf(movedId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to, 0, movedId);
      return { ...prev, order };
    });
  };

  const handleDrop = (targetId) => {
    if (draggedId && draggedId !== targetId) moveTo(draggedId, targetId);
    setDraggedId(null);
  };

  // Keyboard reorder: swap with the neighbour, but never into the pinned core tiles at the front.
  const moveBy = (id, delta) => {
    const index = layout.order.indexOf(id);
    const target = layout.order[index + delta];
    if (target && !TILES_BY_ID[target].core) moveTo(id, target);
  };

  return (
    <div className="w-full">
      {editMode && (
        <div className="flex justify-end mb-3">
          <Button variant="secondary" onClick={() => setAddOpen(true)} className="bg-[var(--canvas-elevated)]">
            <Plus size={16} aria-hidden="true" />Add a tile
          </Button>
        </div>
      )}

      <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3" style={{ gridAutoFlow: 'dense', gridAutoRows: `${ROW_PX}px` }}>
        {layout.order.map((id) => (
          <Tile
            key={id}
            tile={TILES_BY_ID[id]}
            size={resizePreview?.id === id ? resizePreview.size : (layout.sizes[id] || 'S')}
            editMode={editMode}
            dragging={draggedId === id}
            onDragStart={setDraggedId}
            onDrop={handleDrop}
            onDragEnd={() => setDraggedId(null)}
            onMove={moveBy}
            onRemove={removeTile}
            onResizePreview={(tid, size) => setResizePreview({ id: tid, size })}
            onResizeCommit={commitResize}
            gridRef={gridRef}
            stats={stats}
            navigate={navigate}
          />
        ))}
      </div>

      {addOpen && <AddTileDialog available={layout.available} onAdd={addTile} onClose={() => setAddOpen(false)} />}
    </div>
  );
};
