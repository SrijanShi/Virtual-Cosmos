import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store/useStore';

let socketInstance = null;

export function getSocket() { return socketInstance; }

export function joinSession(username, sessionCode) {
  const socket = socketInstance;
  if (socket) socket.emit('user:join', { username, sessionCode });
}

export function useSocket() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = io('http://localhost:3001');
    socketInstance = socket;

    socket.on('init', ({ myId, users }) => {
      const s = useStore.getState();
      s.setMyId(myId);
      s.setUsers(users);
    });

    socket.on('user:joined', (user) => useStore.getState().addUser(user));
    socket.on('user:left', ({ socketId }) => useStore.getState().removeUser(socketId));
    socket.on('user:moved', ({ socketId, x, y }) => useStore.getState().updateUserPosition(socketId, x, y));

    socket.on('proximity:connect', ({ userId, username, roomId }) => {
      useStore.getState().addProximityConnect(userId, username, roomId);
    });
    socket.on('proximity:disconnect', ({ userId }) => {
      useStore.getState().removeProximityConnect(userId);
    });

    socket.on('chat:message', ({ roomId, from, username, text, timestamp }) => {
      useStore.getState().addMessage(roomId, { from, username, text, timestamp });
    });

    // Status updates (mute, hand raise)
    socket.on('user:status', ({ socketId, status }) => {
      useStore.getState().setUserStatus(socketId, status);
    });

    return () => {
      socket.disconnect();
      socketInstance = null;
      initialized.current = false;
    };
  }, []);
}
