import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store/useStore';
import * as peerManager from '../webrtc/peerManager';
import { getScreenStream } from '../media/localStreams';

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

    const socket = io(import.meta.env.VITE_SERVER_URL ?? window.location.origin);
    socketInstance = socket;

    socket.on('init', ({ myId, users }) => {
      const s = useStore.getState();
      s.setMyId(myId);
      s.setUsers(users);
      peerManager.init(socket, myId);
    });

    socket.on('user:joined', (user) => useStore.getState().addUser(user));
    socket.on('user:left',   ({ socketId }) => {
      useStore.getState().removeUser(socketId);
      peerManager.onProximityDisconnect(socketId);
    });
    socket.on('user:moved', ({ socketId, x, y }) => useStore.getState().updateUserPosition(socketId, x, y));

    // ── Proximity ──
    socket.on('proximity:connect', ({ userId, username, roomId }) => {
      useStore.getState().addProximityConnect(userId, username, roomId);
      peerManager.onProximityConnect(userId).catch(() => {});
    });
    socket.on('proximity:disconnect', ({ userId }) => {
      useStore.getState().removeProximityConnect(userId);
      peerManager.onProximityDisconnect(userId);
    });

    // ── Group room sync ──
    socket.on('room:update', ({ roomId }) => {
      useStore.getState().updateGroupRoom(roomId);
    });

    // ── Chat ──
    socket.on('chat:message', ({ roomId, from, username, text, timestamp }) => {
      useStore.getState().addMessage(roomId, { from, username, text, timestamp });
    });
    socket.on('history:load', ({ history }) => {
      useStore.getState().loadHistory(history);
    });

    // ── Status ──
    socket.on('user:status', ({ socketId, status }) => {
      useStore.getState().setUserStatus(socketId, status);
    });

    // ── Proximity WebRTC ──
    socket.on('webrtc:signal', ({ from, data }) => {
      peerManager.handleProxSignal(from, data).catch(() => {});
    });

    // ── Screen share ──
    socket.on('webrtc:screen-signal', ({ from, data }) => {
      if (data.type === 'offer') {
        // We are the viewer — receiving an offer from the sharer
        peerManager.handleScreenSignal(from, data).catch(() => {});
      } else if (data.type === 'answer') {
        // We are the sharer — receiving an answer from a viewer
        peerManager.handleShareAnswerFromViewer(from, data).catch(() => {});
      } else if (data.type === 'ice-candidate') {
        // ICE can go both ways; route by whether we know this person as the sharer
        if (peerManager.getScreenSharerId() === from) {
          peerManager.handleScreenSignal(from, data).catch(() => {});
        } else {
          peerManager.handleShareAnswerFromViewer(from, data).catch(() => {});
        }
      }
    });

    socket.on('screenshare:available', ({ sharerId, sharerName }) => {
      useStore.getState().setScreenShareActive({ sharerId, sharerName });
    });

    socket.on('screenshare:viewer-joined', ({ viewerId }) => {
      const screenStream = getScreenStream();
      if (screenStream) {
        peerManager.startShareToViewer(screenStream, viewerId).catch(() => {});
      }
    });

    socket.on('screenshare:ended', () => {
      peerManager.closeScreenView();
      useStore.getState().setScreenShareActive(null);
    });

    // ── Session closed ──
    socket.on('session:closed', () => {
      peerManager.destroyAll();
      // Show brief message then reload to landing
      const el = document.createElement('div');
      el.textContent = 'The host has closed this session.';
      Object.assign(el.style, {
        position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#f3f4f6', fontSize: '18px', fontWeight: '600', zIndex: '99999',
      });
      document.body.appendChild(el);
      setTimeout(() => window.location.replace(window.location.pathname), 2500);
    });

    return () => {
      peerManager.destroyAll();
      socket.disconnect();
      socketInstance = null;
      initialized.current = false;
    };
  }, []);
}
