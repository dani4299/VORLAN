// A small, curated list of well-known self-hosted apps. Each entry has everything needed to install
// it with sensible defaults - an admin can still change the port, and env vars they add on top of an
// entry's own defaults win. Installing any other Docker image (not from this list) is also supported;
// that path is separate (see apps.service.js's `image` field) and has no catalog entry.
const CATALOG = [
  {
    key: 'nextcloud',
    name: 'Nextcloud',
    description: 'Your own cloud storage, file sync and sharing.',
    image: 'nextcloud:latest',
    ports: [{ container: 80, protocol: 'tcp', primary: true }],
    volumes: [{ containerPath: '/var/www/html', label: 'data' }],
    env: {},
  },
  {
    key: 'pihole',
    name: 'Pi-hole',
    description: 'Blocks ads and trackers for every device on your network.',
    image: 'pihole/pihole:latest',
    ports: [
      { container: 80, protocol: 'tcp', primary: true },
      { container: 53, protocol: 'tcp' },
      { container: 53, protocol: 'udp' },
    ],
    volumes: [
      { containerPath: '/etc/pihole', label: 'config' },
      { containerPath: '/etc/dnsmasq.d', label: 'dnsmasq' },
    ],
    env: { TZ: 'UTC' },
  },
  {
    key: 'minecraft',
    name: 'Minecraft server',
    description: 'A private Minecraft Java Edition server for you and your friends.',
    image: 'itzg/minecraft-server:latest',
    ports: [{ container: 25565, protocol: 'tcp', primary: true }],
    volumes: [{ containerPath: '/data', label: 'world' }],
    env: { EULA: 'TRUE' },
  },
  {
    key: 'jellyfin',
    name: 'Jellyfin',
    description: 'Stream your own movies, shows and music to any device.',
    image: 'jellyfin/jellyfin:latest',
    ports: [{ container: 8096, protocol: 'tcp', primary: true }],
    volumes: [
      { containerPath: '/config', label: 'config' },
      { containerPath: '/media', label: 'media' },
    ],
    env: {},
  },
];

const BY_KEY = Object.fromEntries(CATALOG.map((entry) => [entry.key, entry]));

module.exports = { CATALOG, BY_KEY };
