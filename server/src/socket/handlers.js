const Message = require('../models/Message');
const Session = require('../models/Session');

const PROXIMITY_RADIUS = 150;

// sessions: Map<sessionCode, Map<socketId, userObj>>
const sessions = new Map();

// screenShares: Map<sessionCode, Map<roomZone, { socketId, username }>>
const screenShares = new Map();

// zoneOccupants: Map<sessionCode, Map<socketId, roomZone|null>>
const zoneOccupants = new Map();

function getOrCreateSession(code) {
  if (!sessions.has(code)) sessions.set(code, new Map());
  return sessions.get(code);
}

function getDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function serializeUsers(sessionUsers) {
  return Array.from(sessionUsers.entries()).map(([socketId, u]) => ({
    socketId, username: u.username, x: u.x, y: u.y,
  }));
}

function getCluster(startId, users) {
  const cluster = new Set();
  const queue = [startId];
  while (queue.length) {
    const curr = queue.shift();
    if (cluster.has(curr)) continue;
    cluster.add(curr);
    const u = users.get(curr);
    if (u) for (const n of u.connectedTo) if (users.has(n)) queue.push(n);
  }
  return cluster;
}

function clusterRoomId(sessionCode, cluster) {
  if (cluster.size < 2) return null;
  return `${sessionCode}::${[...cluster].sort().join('--')}`;
}

function syncCluster(io, users, startId) {
  const cluster = getCluster(startId, users);
  const me = users.get(startId);
  if (!me) return;
  const { sessionCode } = me;
  const newRoomId = clusterRoomId(sessionCode, cluster);

  for (const id of cluster) {
    const user = users.get(id);
    if (!user) continue;
    if (user.currentRoomId === newRoomId) continue;
    const sock = io.sockets.sockets.get(id);
    if (sock) {
      if (user.currentRoomId) sock.leave(user.currentRoomId);
      if (newRoomId) sock.join(newRoomId);
    }
    user.currentRoomId = newRoomId;
    io.to(id).emit('room:update', { roomId: newRoomId });
  }
}

// Notify zone occupants that a screen share ended, then remove the share record
function endScreenShare(io, socketId, sessionCode) {
  const sessionShrs = screenShares.get(sessionCode);
  if (!sessionShrs) return;
  for (const [zone, share] of sessionShrs.entries()) {
    if (share.socketId !== socketId) continue;
    sessionShrs.delete(zone);
    const zones = zoneOccupants.get(sessionCode);
    if (zones) {
      for (const [occupantId, occupantZone] of zones.entries()) {
        if (occupantZone === zone && occupantId !== socketId) {
          io.to(occupantId).emit('screenshare:ended');
        }
      }
    }
    break;
  }
}

function registerHandlers(io, socket) {

  // ── Join session ─────────────────────────────────────────────────────────
  socket.on('user:join', async ({ username, sessionCode }) => {
    const code  = sessionCode.toUpperCase();
    const users = getOrCreateSession(code);

    const startX = 400 + Math.random() * 300;
    const startY = 300 + Math.random() * 200;

    const userObj = {
      username, x: startX, y: startY,
      connectedTo: new Set(), sessionCode: code, currentRoomId: null,
    };
    users.set(socket.id, userObj);
    userObj._users = users;

    socket.join(code);
    socket.emit('init', { myId: socket.id, users: serializeUsers(users) });
    socket.to(code).emit('user:joined', { socketId: socket.id, username, x: startX, y: startY });

    // Send message history for returning users
    try {
      const userRooms = await Message.distinct('roomId', { sessionCode: code, username });
      if (userRooms.length) {
        const messages = await Message.find({ sessionCode: code, roomId: { $in: userRooms } })
          .sort({ timestamp: 1 }).limit(500).lean();
        const history = {};
        for (const msg of messages) {
          if (!history[msg.roomId]) history[msg.roomId] = [];
          history[msg.roomId].push({
            from: msg.username, username: msg.username,
            text: msg.text, timestamp: new Date(msg.timestamp).getTime(),
          });
        }
        socket.emit('history:load', { history });
      }
    } catch (err) {
      console.error('Failed to load history:', err.message);
    }
  });

  // ── Move ─────────────────────────────────────────────────────────────────
  socket.on('user:move', ({ x, y }) => {
    const me = users_get(socket.id);
    if (!me) return;

    me.x = x;
    me.y = y;

    const { sessionCode, _users: users } = me;
    socket.to(sessionCode).emit('user:moved', { socketId: socket.id, x, y });

    for (const [otherId, other] of users.entries()) {
      if (otherId === socket.id) continue;

      const dist         = getDistance(me, other);
      const wasConnected = me.connectedTo.has(otherId);

      if (dist < PROXIMITY_RADIUS && !wasConnected) {
        me.connectedTo.add(otherId);
        other.connectedTo.add(socket.id);
        syncCluster(io, users, socket.id);
        const roomId = me.currentRoomId;
        socket.emit('proximity:connect', { userId: otherId, username: other.username, roomId });
        io.to(otherId).emit('proximity:connect', { userId: socket.id, username: me.username, roomId });

      } else if (dist >= PROXIMITY_RADIUS && wasConnected) {
        me.connectedTo.delete(otherId);
        other.connectedTo.delete(socket.id);
        socket.emit('proximity:disconnect', { userId: otherId });
        io.to(otherId).emit('proximity:disconnect', { userId: socket.id });
        syncCluster(io, users, socket.id);
        if (users.has(otherId)) syncCluster(io, users, otherId);
      }
    }
  });

  // ── Chat message ──────────────────────────────────────────────────────────
  socket.on('chat:message', async ({ roomId, text }) => {
    const me = users_get(socket.id);
    if (!me) return;

    const payload = { roomId, from: socket.id, username: me.username, text, timestamp: Date.now() };
    io.to(roomId).emit('chat:message', payload);

    try {
      await Message.create({ sessionCode: me.sessionCode, roomId, username: me.username, text });
    } catch (err) {
      console.error('Failed to save message:', err.message);
    }
  });

  // ── Status ────────────────────────────────────────────────────────────────
  socket.on('user:status', ({ status }) => {
    const me = users_get(socket.id);
    if (!me) return;
    socket.to(me.sessionCode).emit('user:status', { socketId: socket.id, status });
  });

  // ── Close session (host) ──────────────────────────────────────────────────
  socket.on('session:close', async () => {
    const me = users_get(socket.id);
    if (!me) return;
    const { sessionCode } = me;
    try {
      await Session.findOneAndUpdate({ code: sessionCode }, { isActive: false });
    } catch (err) {
      console.error('Failed to close session in DB:', err.message);
    }
    io.to(sessionCode).emit('session:closed', { sessionCode });
  });

  // ── WebRTC signal relay ───────────────────────────────────────────────────
  socket.on('webrtc:signal', ({ to, data }) => {
    io.to(to).emit('webrtc:signal', { from: socket.id, data });
  });

  socket.on('webrtc:screen-signal', ({ to, data }) => {
    io.to(to).emit('webrtc:screen-signal', { from: socket.id, data });
  });

  // ── Zone tracking ─────────────────────────────────────────────────────────
  socket.on('zone:change', ({ roomZone }) => {
    const me = users_get(socket.id);
    if (!me) return;
    const { sessionCode } = me;

    if (!zoneOccupants.has(sessionCode)) zoneOccupants.set(sessionCode, new Map());
    zoneOccupants.get(sessionCode).set(socket.id, roomZone || null);

    if (roomZone) {
      const share = screenShares.get(sessionCode)?.get(roomZone);
      if (share && share.socketId !== socket.id) {
        socket.emit('screenshare:available', { sharerId: share.socketId, sharerName: share.username });
        io.to(share.socketId).emit('screenshare:viewer-joined', { viewerId: socket.id });
      }
    }
  });

  // ── Screen sharing ────────────────────────────────────────────────────────
  socket.on('screenshare:start', ({ roomZone }) => {
    const me = users_get(socket.id);
    if (!me || !roomZone) return;
    const { sessionCode } = me;

    if (!screenShares.has(sessionCode)) screenShares.set(sessionCode, new Map());
    screenShares.get(sessionCode).set(roomZone, { socketId: socket.id, username: me.username });

    const zones = zoneOccupants.get(sessionCode);
    if (zones) {
      for (const [occupantId, zone] of zones.entries()) {
        if (zone === roomZone && occupantId !== socket.id) {
          io.to(occupantId).emit('screenshare:available', { sharerId: socket.id, sharerName: me.username });
          socket.emit('screenshare:viewer-joined', { viewerId: occupantId });
        }
      }
    }
  });

  socket.on('screenshare:stop', () => {
    const me = users_get(socket.id);
    if (!me) return;
    endScreenShare(io, socket.id, me.sessionCode);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const me = users_get(socket.id);
    if (!me) return;

    const { sessionCode, connectedTo, _users: users } = me;

    const peers = [...connectedTo];
    for (const otherId of peers) {
      const other = users.get(otherId);
      if (other) {
        other.connectedTo.delete(socket.id);
        io.to(otherId).emit('proximity:disconnect', { userId: socket.id });
      }
    }

    users.delete(socket.id);

    for (const otherId of peers) {
      if (users.has(otherId)) syncCluster(io, users, otherId);
    }

    if (users.size === 0) sessions.delete(sessionCode);
    io.to(sessionCode).emit('user:left', { socketId: socket.id });

    // Cleanup screen share and zone
    endScreenShare(io, socket.id, sessionCode);
    zoneOccupants.get(sessionCode)?.delete(socket.id);
  });
}

function users_get(socketId) {
  for (const users of sessions.values()) {
    if (users.has(socketId)) return users.get(socketId);
  }
  return null;
}

module.exports = { registerHandlers };
