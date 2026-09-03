# VORLAN

**An offline-first smart home and network management system.**

VORLAN runs entirely on your own machine — authentication, file storage, and even the AI assistant (via a local [Ollama](https://ollama.com) model) all work without an internet connection. It's built for a home network: sign in once on your PC, then reach the same dashboard from your phone or any other device on the network.

---

## Screenshots

<!--
  Add screenshots here — a few from the dashboard, the AI assistant, the file
  manager, and settings would give newcomers the clearest picture.

  <p align="center">
    <img src="docs/screenshots/dashboard.png" width="800" alt="VORLAN dashboard">
  </p>
  <p align="center">
    <img src="docs/screenshots/ai-assistant.png" width="400" alt="AI assistant">
    <img src="docs/screenshots/file-manager.png" width="400" alt="File manager">
  </p>
-->

*(Screenshots coming soon.)*

---

## What's New

VORLAN started as a sidebar-and-four-pages app. It's since been rebuilt around a real home dashboard, with every core area redone.

### Dashboard
- A proper home screen: customizable wallpaper (solid colors, gradient presets, or your own upload), a live clock with the date, and a rotating time-of-day greeting
- A tile grid for every core feature — drag to resize tiles, rearrange them, remove ones you don't use, and add them back later from an "Add tile" tray
- Live system tiles for storage, memory, power, CPU, network, and uptime
- Light and dark themes, with a scheduled auto-switch and a choice of accent colors

### Account & Profile
- A profile settings panel: editable username and full name (email stays fixed), with photo upload/remove
- Renaming your username now follows you everywhere — your files, notes, and vault PIN move with you, nothing gets orphaned

### AI Assistant
- Rebuilt around a familiar chat layout: a history sidebar, a "New chat" button, and multiple saved conversations
- Responses now stream in token-by-token instead of arriving all at once, and each conversation gets an auto-generated title
- Still fully local — no data leaves your machine

### File Manager
- A real file manager in place of the old flat gallery view: Documents, Uploads, Pictures, and Music root folders, plus a Recent files list
- Folder navigation with breadcrumbs, copy/cut/paste, rename, and search across everything at once

### Navigation
- The old sidebar is gone from the main dashboard; every other page uses a simple back button instead

### In Progress
- **QR-based device onboarding** — a "Connect device" button that shows a QR code to join VORLAN's network and another to open the app, so getting a new phone connected won't mean typing an IP address by hand. Design and planning work is underway in [`docs/superpowers/`](docs/superpowers); the networking side (getting a hotspot to run alongside your regular WiFi rather than replacing it) is still being worked out.

---

## Features

| Area | What it does |
|---|---|
| **AI Assistant** | Offline chat backed by a local Ollama model, with chat history and streaming responses |
| **Global Files** | Shared media storage for photos, videos, and documents visible to everyone on the network |
| **Personal Vault** | A private, PIN-locked space for your own files and notes |
| **File Manager** | Folder-based file browsing with search, copy/paste, and rename |
| **Cameras** | Point VORLAN at any IP camera's stream URL for a live view |
| **Dashboard** | Custom wallpaper, live system stats, and a rearrangeable tile layout |
| **Accounts** | Username/password auth with editable profile details |

### Previous Version

The original VORLAN (still the foundation this is built on) shipped as a single sidebar layout with four pages — AI chat, global files, a personal vault, and a camera feed — landing directly on the AI chat page after login. It had no dashboard, no theming, and a single-shot (non-streaming) AI response with no conversation history. Everything above builds on that same Express + SQLite backend and offline-first philosophy.

---

## Tech Stack

- **Frontend:** React 19, Vite, React Router, Tailwind CSS, `lucide-react`
- **Backend:** Express 5, SQLite3, JWT auth
- **AI:** [Ollama](https://ollama.com) running the `phi3` model, entirely local
- **Networking:** `nmcli` / NetworkManager for the in-progress device-onboarding feature (Linux only, for now)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Ollama](https://ollama.com) installed and running locally, with the `phi3` model pulled:
  ```bash
  ollama pull phi3
  ```

### Install & Run

```bash
git clone https://github.com/dani4299/VORLAN.git
cd VORLAN
npm install --prefix backend
npm install --prefix frontend
npm start
```

`npm start` runs the Express backend and the Vite dev server together. By default the backend listens on port `5000` and the frontend on port `5173` — once both are up, open `http://localhost:5173`.

To reach VORLAN from another device on the same network, use your PC's LAN IP instead of `localhost` (e.g. `http://192.168.1.11:5173`) — the server prints this address on startup.

## Project Structure

```
backend/
  src/
    routes/       API endpoints (auth, ai, explorer, personal, vault, ...)
    services/     Business logic behind each route
    middleware/    Auth verification
    config/        Paths and constants
    db/            SQLite connection and schema
frontend/
  src/
    pages/         Top-level views (dashboard, assistant, files, settings, ...)
    components/     Reusable UI, organized by area (dashboard, layout, ui)
    context/        App-wide React state (theme, profile, toasts)
    lib/            API clients and small utilities
docs/
  superpowers/      Design specs and implementation plans for in-progress work
```

## License

No license has been chosen for this project yet.
