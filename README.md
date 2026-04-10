# Virtual Cosmos

A 2D virtual office where users move around as avatars and proximity automatically connects them — for chat, audio, and video. Inspired by [cosmos.video](https://cosmos.video).

---

## Demo

Open two browser windows side by side at `http://localhost:5173`, create a session in one and join in the other. Move your avatars close together to see proximity chat, audio, and video connect in real time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), PixiJS, Zustand |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB (Mongoose) |
| Real-time A/V | WebRTC (perfect negotiation) |

---

## Features

### Core
- **2D canvas** rendered with PixiJS — tiled floor, room zones, desk furniture
- **Avatar movement** via WASD or Arrow keys
- **Real-time multiplayer** — all users visible and synced via Socket.IO
- **Proximity detection** — 150px radius ring around each avatar
  - Walk within radius → chat panel opens automatically
  - Walk away → chat panel closes automatically
- **Chat system** — messages routed through shared Socket.IO rooms, persisted to MongoDB
- **Group chat** — when 3 or more users are in proximity, all are merged into one shared chat room automatically

### Sessions
- **Create a session** — name your space, pick rooms, set visibility
- **Join via code** — 6-character session code, shareable link via URL (`?session=CODE`)
- **Private sessions** — password-protected; joining requires entering the correct password
- **Message history** — returning users see their previous chat messages restored on rejoin
- **Host can close session** — ends the session for all participants

### Audio / Video (WebRTC)
- **Proximity microphone** — unmute to send audio to nearby users; heard via hidden `<audio>` elements
- **Proximity camera** — turn camera on to show a video tile to nearby users; remote tiles appear top-right
- **Room screen sharing** — walk into a room and click Share Screen; anyone who enters that room sees the shared screen in a full-screen overlay

### UI / UX
- **Sidebar** — shows all online users with color-coded avatars and proximity indicators
- **Toolbar** — mic, camera, screen share, share link, invite, record session, hand raise, emoji reactions, action menu
- **Zoom controls** — zoom in/out buttons (bottom-left), keyboard `+`/`-` shortcuts, smooth lerp animation
- **Canvas drag/pan** — click and drag to pan the world; camera follows avatar on WASD
- **Camera PiP** — local camera preview shown bottom-left when camera is on
- **Emoji reactions** — float upward on screen when sent

---

## Project Structure

```
Virtual Cosmos/
├── client/                        # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── LandingPage.jsx    # Create / Join session UI
│       │   ├── Game.jsx           # PixiJS canvas + zoom controls
│       │   ├── ChatPanel.jsx      # Proximity chat UI
│       │   ├── Sidebar.jsx        # Online users list
│       │   ├── Toolbar.jsx        # Bottom action bar
│       │   └── ProximityMedia.jsx # Remote video tiles
│       ├── hooks/
│       │   └── useSocket.js       # Socket.IO + WebRTC event wiring
│       ├── media/
│       │   └── localStreams.js    # Singleton mic/cam/screen stream registry
│       ├── pixi/
│       │   ├── PixiApp.js         # Game loop, movement, zone detection
│       │   ├── Avatar.js          # Avatar sprite + lerp
│       │   └── World.js           # Room layout + floor tiles
│       ├── store/
│       │   └── useStore.js        # Zustand global state
│       └── webrtc/
│           └── peerManager.js     # WebRTC peer connections (proximity + screen share)
│
└── server/
    └── src/
        ├── index.js               # Express + Socket.IO entry point
        ├── routes/
        │   └── session.js         # REST: create, join, verify, history
        ├── socket/
        │   └── handlers.js        # All socket event handlers
        └── models/
            ├── Session.js         # Mongoose session schema
            └── Message.js         # Mongoose message schema
```

---

## Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB running locally (or set `MONGO_URI` in `server/.env`)

### 1. Start the server

```bash
cd server
npm install
npm start
# Runs on http://localhost:3001
```

### 2. Start the client

```bash
cd client
npm install
npm run dev
# Runs on http://localhost:5173
```

### 3. Open the app

Go to `http://localhost:5173` in your browser. Create a session in one tab and join with the shared code in another.

### Environment (optional)

Create `server/.env` to override defaults:

```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/virtual-cosmos
```

---

## Controls

| Action | Key / Input |
|---|---|
| Move avatar | WASD or Arrow keys |
| Zoom in | `+` or zoom button |
| Zoom out | `-` or zoom button |
| Pan canvas | Click + drag |
| Copy session code | Click the code in the sidebar |

---

## Socket Events

| Event | Direction | Description |
|---|---|---|
| `user:join` | client → server | Enter a session |
| `user:move` | client → server | Broadcast position |
| `chat:message` | client → server | Send a chat message |
| `user:status` | client → server | Mic/camera/hand status |
| `zone:change` | client → server | Entered/left a room zone |
| `screenshare:start` | client → server | Started sharing screen in a zone |
| `screenshare:stop` | client → server | Stopped sharing |
| `session:close` | client → server | Host closes session |
| `webrtc:signal` | relay | Proximity WebRTC offer/answer/ICE |
| `webrtc:screen-signal` | relay | Screen share WebRTC signalling |
| `init` | server → client | Full user list on join |
| `proximity:connect` | server → client | Entered another user's radius |
| `proximity:disconnect` | server → client | Left another user's radius |
| `room:update` | server → client | Cluster room ID changed |
| `history:load` | server → client | Past messages on rejoin |
| `screenshare:available` | server → client | Screen share active in current zone |
| `session:closed` | server → client | Host ended the session |

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/session/create` | Create a new session |
| GET | `/session/:code` | Get session metadata |
| POST | `/session/:code/verify` | Verify password for private session |
| GET | `/session/:code/history` | Get message history for a username |
