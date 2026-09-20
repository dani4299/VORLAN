import {
  HardDrive, MemoryStick, BatteryCharging, Cpu, Wifi, Timer,
  MessageSquare, Folder, Image as ImageIcon, Music, StickyNote, Lock, Video, Settings,
} from 'lucide-react';

// Widgets are opt-in: none is on the home page until someone adds it from "Add a tile".
export const STAT_TILES = [
  { id: 'storage', kind: 'stat', label: 'Storage', icon: HardDrive, defaultSize: 'M', defaultVisible: false },
  { id: 'memory', kind: 'stat', label: 'Memory', icon: MemoryStick, defaultSize: 'M', defaultVisible: false },
  { id: 'power', kind: 'stat', label: 'Power', icon: BatteryCharging, defaultSize: 'S', defaultVisible: false },
  { id: 'cpu', kind: 'stat', label: 'CPU', icon: Cpu, defaultSize: 'S', defaultVisible: false },
  { id: 'network', kind: 'stat', label: 'Network', icon: Wifi, defaultSize: 'S', defaultVisible: false },
  { id: 'uptime', kind: 'stat', label: 'Uptime', icon: Timer, defaultSize: 'S', defaultVisible: false },
];

/** `core: true` tiles are VORLAN's primary functions: pinned to the top row and can't be removed or dragged out of place - only resized. */
export const NAV_TILES = [
  { id: 'ai', kind: 'nav', label: 'Assistant', icon: MessageSquare, path: '/dashboard/ai', defaultSize: 'S', core: true },
  { id: 'files', kind: 'nav', label: 'Files', icon: Folder, path: '/dashboard/files', defaultSize: 'S', core: true },
  { id: 'gallery', kind: 'nav', label: 'Pictures', icon: ImageIcon, path: '/dashboard/gallery', defaultSize: 'S', core: true },
  { id: 'personal', kind: 'nav', label: 'Personal Vault', icon: Lock, path: '/dashboard/personal', defaultSize: 'S', core: true },
  { id: 'cameras', kind: 'nav', label: 'Cameras', icon: Video, path: '/dashboard/cameras', defaultSize: 'S', core: true, adminOnly: true },
  { id: 'music', kind: 'nav', label: 'Music', icon: Music, path: '/dashboard/music', defaultSize: 'S' },
  { id: 'notes', kind: 'nav', label: 'Notes', icon: StickyNote, path: '/dashboard/notes', defaultSize: 'S' },
  { id: 'settings', kind: 'nav', label: 'Settings', icon: Settings, path: '/dashboard/settings', defaultSize: 'S', defaultVisible: false },
];

export const ALL_TILES = [...STAT_TILES, ...NAV_TILES];
export const ALL_TILE_IDS = ALL_TILES.map((t) => t.id);
export const TILES_BY_ID = Object.fromEntries(ALL_TILES.map((t) => [t.id, t]));

/**
 * Layout shape: { order, sizes, dismissed }.
 * - `order`: visible tile ids, in display order.
 * - `dismissed`: ids the user has explicitly removed - kept so a default-visible tile doesn't
 *   silently reappear next load, while still being offered again in the "add tile" tray.
 * A tile not in `order` (whether dismissed or simply never added, e.g. an opt-in widget) is
 * "available" and shown in the add-tile tray.
 */
export const mergeDashboardLayout = (saved, isAdmin = false) => {
  const base = saved || {};
  // adminOnly tiles (Cameras) don't exist at all for a non-admin viewer - not
  // shown, not offered in the add-tile tray, and dropped from a saved layout that had them from
  // back when this account was an admin.
  const visibleTiles = ALL_TILES.filter((t) => isAdmin || !t.adminOnly);
  const visibleIds = visibleTiles.map((t) => t.id);

  // Core tiles can never be dismissed, even if an older saved layout has one in its dismissed list.
  const dismissed = new Set((base.dismissed || base.hidden || []).filter((id) => visibleIds.includes(id) && !TILES_BY_ID[id]?.core));
  let order = (base.order || []).filter((id) => visibleIds.includes(id) && !dismissed.has(id));
  for (const tile of visibleTiles) {
    if (!order.includes(tile.id) && !dismissed.has(tile.id) && (tile.core || tile.defaultVisible !== false)) {
      order.push(tile.id);
    }
  }
  // Core tiles pin to the top row, in their catalog order, ahead of everything else the user arranged.
  const coreIds = visibleTiles.filter((t) => t.core).map((t) => t.id);
  order = [...coreIds, ...order.filter((id) => !coreIds.includes(id))];

  // Core tiles have no resize handle in the UI, so they always render at their catalog size -
  // a saved override (e.g. from before core tiles were locked to a fixed size) is ignored.
  const sizes = {
    ...Object.fromEntries(visibleTiles.map((t) => [t.id, t.defaultSize])),
    ...Object.fromEntries(Object.entries(base.sizes || {}).filter(([id]) => !TILES_BY_ID[id]?.core)),
  };
  const available = visibleIds.filter((id) => !order.includes(id));
  return { order, sizes, dismissed: [...dismissed], available };
};
