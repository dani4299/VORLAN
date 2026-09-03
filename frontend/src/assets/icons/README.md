# Icon pack

Drop a custom icon set here (SVG preferred, one file per icon) to replace or extend the
lucide-react icons currently used across the app (sidebar nav, dashboard tiles, buttons).

When a pack is added, icons get swapped in per-component — point the `icon` field on
`NAV_ITEMS` (`frontend/src/components/layout/Sidebar.jsx`) or the relevant `lucide-react`
import at the new SVG instead.
