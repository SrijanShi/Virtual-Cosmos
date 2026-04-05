# Virtual Cosmos

A 2D virtual office space where users can walk around and proximity-based chat auto-connects/disconnects.

## Tech Stack
- **Frontend**: React (Vite) + PixiJS + Tailwind CSS + Zustand
- **Backend**: Node.js + Express + Socket.IO + MongoDB

## Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB running locally (optional — app works without it)

### 1. Start the Server
```bash
cd server
npm install
npm run dev
# Runs on http://localhost:3001
```

### 2. Start the Client
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:5173
```

### 3. Open Multiple Tabs
Open `http://localhost:5173` in two browser tabs, enter different names, and move your avatars close together to trigger chat.

## Controls
- **WASD** or **Arrow Keys** — move avatar
- Walk within **150px** of another user → chat panel appears
- Walk away → chat panel disappears

## Features
- Real-time multiplayer with Socket.IO
- Proximity-based auto chat connect/disconnect
- Room zones (DSA, Flutter, Python, etc.)
- Avatar colors per user
- Online users sidebar
- Smooth avatar interpolation
