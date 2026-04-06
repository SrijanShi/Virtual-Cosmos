const Message = require('../models/Message');

const PROXIMITY_RADIUS = 150;

// sessions: Map<sessionCode, Map<socketId, { username, x, y, connectedTo: Set }>>
const sessions = new Map();

function getOrCreateSession(code) {
  if (!sessions.has(code)) sessions.set(code, new Map());
  return sessions.get(code);
}

function getDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getRoomId(sessionCode, id1, id2) {
  return `${sessionCode}::${[id1, id2].sort().join('--')}`;
}

function serializeUsers(sessionUsers) {
  return Array.from(sessionUsers.entries()).map(([socketId, u]) => ({
    socketId, username: u.username, x: u.x, y: u.y,
  }));
}

function registerHandlers(io, socket) {

  // ── Join session ─────────────────────────────────────────────────────────
  socket.on('user:join', async ({ username, sessionCode }) => {
    const code  = sessionCode.toUpperCase();
    const users = getOrCreateSession(code);

    const startX = 400 + Math.random() * 300;
    const startY = 300 + Math.random() * 200;

    users.set(socket.id, { username, x: startX, y: startY, connectedTo: new Set(), sessionCode: code });

    // Put socket in a Socket.IO room keyed by session
    socket.join(code);

    // Send init to joining user
    socket.emit('init', { myId: socket.id, users: serializeUsers(users) });

    // Notify everyone else in the session
    socket.to(code).emit('user:joined', { socketId: socket.id, username, x: startX, y: startY });

    // Send message history for this username in this session
    try {
      const userRooms = await Message.distinct('roomId', { sessionCode: code, username });
      if (userRooms.length) {
        const messages = await Message.find({ sessionCode: code, roomId: { $in: userRooms } })
          .sort({ timestamp: 1 }).limit(500).lean();
        const history = {};
        for (const msg of messages) {
          if (!history[msg.roomId]) history[msg.roomId] = [];
          history[msg.roomId].push({ from: msg.username, username: msg.username, text: msg.text, timestamp: new Date(msg.timestamp).getTime() });
        }
        socket.emit('history:load', { history });
      }
    } catch (err) {
      console.error('Failed to load history:', err.message);
    }
  });

  // ── Move ─────────────────────────────────────────────────────────────────
  socket.on('user:move', ({ x, y }) => {
    const me = _getUser(socket.id);
    if (!me) return;

    me.x = x;
    me.y = y;

    const { sessionCode, users } = me;
    socket.to(sessionCode).emit('user:moved', { socketId: socket.id, x, y });

    // Proximity detection within the same session
    for (const [otherId, other] of users.entries()) {
      if (otherId === socket.id) continue;

      const dist       = getDistance(me, other);
      const roomId     = getRoomId(sessionCode, socket.id, otherId);
      const wasConnected = me.connectedTo.has(otherId);

      if (dist < PROXIMITY_RADIUS && !wasConnected) {
        me.connectedTo.add(otherId);
        other.connectedTo.add(socket.id);
        socket.join(roomId);
        io.sockets.sockets.get(otherId)?.join(roomId);
        socket.emit('proximity:connect', { userId: otherId, username: other.username, roomId });
        io.to(otherId).emit('proximity:connect', { userId: socket.id, username: me.username, roomId });

      } else if (dist >= PROXIMITY_RADIUS && wasConnected) {
        me.connectedTo.delete(otherId);
        other.connectedTo.delete(socket.id);
        socket.leave(roomId);
        io.sockets.sockets.get(otherId)?.leave(roomId);
        socket.emit('proximity:disconnect', { userId: otherId, roomId });
        io.to(otherId).emit('proximity:disconnect', { userId: socket.id, roomId });
      }
    }
  });

  // ── Chat message (saved to MongoDB) ──────────────────────────────────────
  socket.on('chat:message', async ({ roomId, text }) => {
    const me = _getUser(socket.id);
    if (!me) return;

    const payload = {
      roomId,
      from:      socket.id,
      username:  me.username,
      text,
      timestamp: Date.now(),
    };

    io.to(roomId).emit('chat:message', payload);

    // Persist to MongoDB
    try {
      await Message.create({ sessionCode: me.sessionCode, roomId, username: me.username, text });
    } catch (err) {
      console.error('Failed to save message:', err.message);
    }
  });

  // ── Status (mute, hand, reaction) ────────────────────────────────────────
  socket.on('user:status', ({ status }) => {
    const me = _getUser(socket.id);
    if (!me) return;
    socket.to(me.sessionCode).emit('user:status', { socketId: socket.id, status });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const me = _getUser(socket.id);
    if (!me) return;

    const { sessionCode, connectedTo, users } = me;

    for (const otherId of connectedTo) {
      const other = users.get(otherId);
      if (other) {
        other.connectedTo.delete(socket.id);
        const roomId = getRoomId(sessionCode, socket.id, otherId);
        io.to(otherId).emit('proximity:disconnect', { userId: socket.id, roomId });
      }
    }

    users.delete(socket.id);
    if (users.size === 0) sessions.delete(sessionCode); // clean up empty sessions

    io.to(sessionCode).emit('user:left', { socketId: socket.id });
  });
}

// Helper: find which session a socket belongs to
function _getUser(socketId) {
  for (const [sessionCode, users] of sessions.entries()) {
    if (users.has(socketId)) {
      const u = users.get(socketId);
      return { ...u, sessionCode, users };
    }
  }
  return null;
}

module.exports = { registerHandlers };
