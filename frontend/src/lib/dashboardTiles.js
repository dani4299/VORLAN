import {
  HardDrive, MemoryStick, BatteryCharging, Cpu, Wifi, Timer,
  MessageSquare, Folder, Image as ImageIcon, Music, StickyNote, Lock, Video, Settings,
} from 'lucide-react';

export const STAT_TILES = [
  { id: 'storage', kind: 'stat', label: 'Storage', icon: HardDrive, color: 'var(--accent)', defaultSize: 'M' },
  { id: 'memory', kind: 'stat', label: 'Memory', icon: MemoryStick, color: 'var(--hue-emerald)', defaultSize: 'M' },
  { id: 'power', kind: 'stat', label: 'Power', icon: BatteryCharging, color: 'var(--hue-amber)', defaultSize: 'S' },
  { id: 'cpu', kind: 'stat', label: 'CPU', icon: Cpu, color: 'var(--hue-violet)', defaultSize: 'S', defaultVisible: false },
  { id: 'network', kind: 'stat', label: 'Network', icon: Wifi, color: 'var(--accent)', defaultSize: 'S', defaultVisible: false },
  { id: 'uptime', kind: 'stat', label: 'Uptime', icon: Timer, color: 'var(--hue-emerald)', defaultSize: 'S', defaultVisible: false },
];

/** `core: true` tiles are VORLAN's primary functions: pinned to the top row, colored (not the neutral flat surface every other tile uses), and can't be removed or dragged out of place - only resized. */
export const NAV_TILES = [
  { id: 'ai', kind: 'nav', label: 'Assistant', icon: MessageSquare, path: '/dashboard/ai', color: 'var(--accent)', defaultSize: 'S', core: true },
  { id: 'files', kind: 'nav', label: 'Files', icon: Folder, path: '/dashboard/files', color: 'var(--hue-violet)', defaultSize: 'S', core: true },
  { id: 'gallery', kind: 'nav', label: 'Pictures', icon: ImageIcon, path: '/dashboard/gallery', color: 'var(--hue-emerald)', defaultSize: 'S', core: true },
  { id: 'personal', kind: 'nav', label: 'Personal Vault', icon: Lock, path: '/dashboard/personal', color: 'var(--hue-amber)', defaultSize: 'S', core: true },
  { id: 'cameras', kind: 'nav', label: 'Cameras', icon: Video, path: '/dashboard/cameras', color: 'var(--hue-rose)', defaultSize: 'S', core: true },
  { id: 'music', kind: 'nav', label: 'Music', icon: Music, path: '/dashboard/music', color: 'var(--hue-rose)', defaultSize: 'S' },
  { id: 'notes', kind: 'nav', label: 'Notes', icon: StickyNote, path: '/dashboard/notes', color: 'var(--hue-amber)', defaultSize: 'S' },
  { id: 'settings', kind: 'nav', label: 'Settings', icon: Settings, path: '/dashboard/settings', color: 'var(--ink-muted)', defaultSize: 'S', defaultVisible: false },
];

export const ALL_TILES = [...STAT_TILES, ...NAV_TILES];
export const ALL_TILE_IDS = ALL_TILES.map((t) => t.id);
export const TILES_BY_ID = Object.fromEntries(ALL_TILES.map((t) => [t.id, t]));

/**
 * Layout shape: { order, sizes, dismissed }.
 * - `order`: visible tile ids, in display order.
 * - `dismissed`: ids the user has explicitly removed - kept so a default-visible tile doesn't
 *   silently reappear next load, while still being offered again in the "add tile" tray.
 * A tile not in `order` (whether dismissed or simply never added, e.g. an opt-in stat tile) is
 * "available" and shown in the add-tile tray.
 */
export const mergeDashboardLayout = (saved) => {
  const base = saved || {};
  // Core tiles can never be dismissed, even if an older saved layout has one in its dismissed list.
  const dismissed = new Set((base.dismissed || base.hidden || []).filter((id) => ALL_TILE_IDS.includes(id) && !TILES_BY_ID[id]?.core));
  let order = (base.order || []).filter((id) => ALL_TILE_IDS.includes(id) && !dismissed.has(id));
  for (const tile of ALL_TILES) {
    if (!order.includes(tile.id) && !dismissed.has(tile.id) && (tile.core || tile.defaultVisible !== false)) {
      order.push(tile.id);
    }
  }
  // Core tiles pin to the top row, in their catalog order, ahead of everything else the user arranged.
  const coreIds = ALL_TILES.filter((t) => t.core).map((t) => t.id);
  order = [...coreIds, ...order.filter((id) => !coreIds.includes(id))];

  const sizes = { ...Object.fromEntries(ALL_TILES.map((t) => [t.id, t.defaultSize])), ...base.sizes };
  const available = ALL_TILE_IDS.filter((id) => !order.includes(id));
  return { order, sizes, dismissed: [...dismissed], available };
};
