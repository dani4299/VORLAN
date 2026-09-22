import React from 'react';
import {
  Activity, Folder, HardDrive, Image as ImageIcon, LifeBuoy, ListChecks, Lock, MessageSquare, Music, Network,
  Package, ScrollText, Server, Settings, SlidersHorizontal, StickyNote, Video,
} from 'lucide-react';

// The desktop's app registry: what can be launched, who can launch it, and how big its window
// starts. Adding an app to the desktop is adding one entry here. `load` keeps each app out of the
// main bundle until it is first opened.
const named = (loader, exportName) => React.lazy(() => loader().then((m) => ({ default: m[exportName] })));

const DEFAULT_SIZE = { w: 900, h: 620 };
const DEFAULT_MIN = { w: 420, h: 320 };

const define = (app) => ({ size: DEFAULT_SIZE, minSize: DEFAULT_MIN, adminOnly: false, ...app });

const APP_DEFINITIONS = [
  define({
    id: 'control-panel', title: 'Control Panel', icon: SlidersHorizontal, adminOnly: true, size: { w: 940, h: 600 },
    Component: named(() => import('../apps/control-panel/ControlPanel'), 'ControlPanel'),
  }),
  define({
    id: 'resource-monitor', title: 'Resource Monitor', icon: Activity, adminOnly: true, size: { w: 980, h: 660 },
    Component: named(() => import('../apps/resource-monitor/ResourceMonitor'), 'ResourceMonitor'),
  }),
  define({
    id: 'storage-manager', title: 'Storage Manager', icon: HardDrive, adminOnly: true, size: { w: 940, h: 640 },
    Component: named(() => import('../apps/storage-manager/StorageManager'), 'StorageManager'),
  }),
  define({
    id: 'task-manager', title: 'Task Manager', icon: ListChecks, adminOnly: true, size: { w: 860, h: 520 },
    Component: named(() => import('../apps/task-manager/TaskManager'), 'TaskManager'),
  }),
  define({
    id: 'log-center', title: 'Log Center', icon: ScrollText, adminOnly: true, size: { w: 980, h: 620 },
    Component: named(() => import('../apps/log-center/LogCenter'), 'LogCenter'),
  }),
  define({
    id: 'services', title: 'Services', icon: Server, adminOnly: true, size: { w: 760, h: 640 },
    Component: named(() => import('../apps/services/Services'), 'Services'),
  }),
  define({
    id: 'network', title: 'Network', icon: Network, adminOnly: true, size: { w: 980, h: 620 },
    Component: named(() => import('../apps/network/Network'), 'Network'),
  }),
  define({
    id: 'support', title: 'Support', icon: LifeBuoy, adminOnly: true, size: { w: 760, h: 620 },
    Component: named(() => import('../apps/support/Support'), 'Support'),
  }),
  define({
    id: 'app-store', title: 'App Store', icon: Package, adminOnly: true, size: { w: 980, h: 660 },
    Component: named(() => import('../apps/app-store/AppStore'), 'AppStore'),
  }),
  define({
    id: 'files', title: 'Files', icon: Folder, size: { w: 980, h: 640 },
    Component: named(() => import('../pages/files/FilesPage'), 'FilesPage'),
  }),
  define({
    id: 'assistant', title: 'Assistant', icon: MessageSquare,
    Component: named(() => import('../pages/assistant/AssistantPage'), 'AssistantPage'),
  }),
  define({
    id: 'gallery', title: 'Pictures', icon: ImageIcon,
    Component: named(() => import('../pages/files/GalleryPage'), 'GalleryPage'),
  }),
  define({
    id: 'music', title: 'Music', icon: Music,
    Component: named(() => import('../pages/files/MusicPage'), 'MusicPage'),
  }),
  define({
    id: 'notes', title: 'Notes', icon: StickyNote,
    Component: named(() => import('../pages/files/NotesRoutePage'), 'NotesRoutePage'),
  }),
  define({
    id: 'personal', title: 'Personal Vault', icon: Lock,
    Component: named(() => import('../pages/personal/PersonalVaultPage'), 'PersonalVaultPage'),
  }),
  define({
    id: 'cameras', title: 'Cameras', icon: Video, adminOnly: true,
    Component: named(() => import('../pages/cameras/CamerasPage'), 'CamerasPage'),
  }),
  define({
    id: 'settings', title: 'Settings', icon: Settings,
    Component: named(() => import('../pages/settings/SettingsPage'), 'SettingsPage'),
  }),
];

// Where a person who isn't an administrator reaches each app as an ordinary page (an administrator
// opens the same apps as desktop windows). Admin-only tools have no page.
const PAGE_ROUTES = {
  assistant: 'ai', files: 'files', gallery: 'gallery', music: 'music', notes: 'notes', personal: 'personal', settings: 'settings',
};

export const APPS = APP_DEFINITIONS.map((app) => ({ ...app, route: PAGE_ROUTES[app.id] ?? null }));

export const appsForRole = (isAdmin) => APPS.filter((a) => isAdmin || !a.adminOnly);

export const appById = (apps) => Object.fromEntries(apps.map((a) => [a.id, a]));
