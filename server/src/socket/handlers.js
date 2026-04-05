const PROXIMITY_RADIUS = 150;

// In-memory store for fast access during game loop
const users = new Map(); // socketId -> { username, x, y, connectedTo: Set }

function getDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getRoomId(id1, id2) {
  return [id1, id2].sort().join('--');
}

function registerHandlers(io, socket) {
  // User joins the cosmos
  socket.on('user:join', ({ username }) => {
    const startX = 400 + Math.random() * 200;
    const startY = 300 + Math.random() * 200;

    users.set(socket.id, {
      username,
      x: startX,
      y: startY,
      connectedTo: new Set(),
    });

    // Send the new user their own id + all existing users
    socket.emit('init', {
      myId: socket.id,
      users: serializeUsers(),
    });

    // Tell everyone else about the new user
    socket.broadcast.emit('user:joined', {
      socketId: socket.id,
      username,
      x: startX,
      y: startY,
    });
  });

  // User moves
  socket.on('user:move', ({ x, y }) => {
    const me = users.get(socket.id);
    if (!me) return;

    me.x = x;
    me.y = y;

    // Broadcast position to all other users
    socket.broadcast.emit('user:moved', { socketId: socket.id, x, y });

    // Check proximity with every other user
    for (const [otherId, other] of users.entries()) {
      if (otherId === socket.id) continue;

      const dist = getDistance(me, other);
      const roomId = getRoomId(socket.id, otherId);
      const wasConnected = me.connectedTo.has(otherId);

      if (dist < PROXIMITY_RADIUS && !wasConnected) {
        // Connect
        me.connectedTo.add(otherId);
        other.connectedTo.add(socket.id);

        socket.join(roomId);
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket) otherSocket.join(roomId);

        socket.emit('proximity:connect', { userId: otherId, username: other.username, roomId });
        io.to(otherId).emit('proximity:connect', { userId: socket.id, username: me.username, roomId });
      } else if (dist >= PROXIMITY_RADIUS && wasConnected) {
        // Disconnect
        me.connectedTo.delete(otherId);
        other.connectedTo.delete(socket.id);

        socket.leave(roomId);
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket) otherSocket.leave(roomId);

        socket.emit('proximity:disconnect', { userId: otherId, roomId });
        io.to(otherId).emit('proximity:disconnect', { userId: socket.id, roomId });
      }
    }
  });

  // Chat message in a proximity room
  socket.on('chat:message', ({ roomId, text }) => {
    const me = users.get(socket.id);
    if (!me) return;

    io.to(roomId).emit('chat:message', {
      roomId,
      from: socket.id,
      username: me.username,
      text,
      timestamp: Date.now(),
    });
  });

  // Disconnect / leave
  socket.on('disconnect', () => {
    const me = users.get(socket.id);
    if (!me) return;

    // Notify all users this person was connected to
    for (const otherId of me.connectedTo) {
      const other = users.get(otherId);
      if (other) {
        other.connectedTo.delete(socket.id);
        const roomId = getRoomId(socket.id, otherId);
        io.to(otherId).emit('proximity:disconnect', { userId: socket.id, roomId });
      }
    }

    users.delete(socket.id);
    io.emit('user:left', { socketId: socket.id });
  });
}

function serializeUsers() {
  const result = [];
  for (const [socketId, u] of users.entries()) {
    result.push({ socketId, username: u.username, x: u.x, y: u.y });
  }
  return result;
}

module.exports = { registerHandlers };
