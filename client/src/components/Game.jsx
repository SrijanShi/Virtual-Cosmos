import { useEffect, useRef } from 'react';
import { PixiApp } from '../pixi/PixiApp';
import useStore from '../store/useStore';
import { getSocket } from '../hooks/useSocket';

export default function Game() {
  const canvasRef = useRef(null);
  const pixiRef = useRef(null);

  const myId = useStore((s) => s.myId);

  // Init PixiJS once myId is available (server acknowledged join)
  useEffect(() => {
    if (!myId || !canvasRef.current) return;
    if (pixiRef.current) return;

    const initialUsers = Object.values(useStore.getState().users);

    const pixi = new PixiApp(
      canvasRef.current,
      myId,
      initialUsers,
      (x, y) => {
        useStore.getState().updateMyPosition(x, y);
        const socket = getSocket();
        if (socket) socket.emit('user:move', { x, y });
      },
    );
    pixiRef.current = pixi;

    return () => {
      pixi.destroy();
      pixiRef.current = null;
    };
  }, [myId]);

  // Sync new/removed users to pixi
  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      const pixi = pixiRef.current;
      if (!pixi) return;

      const prevIds = new Set(Object.keys(prev.users));
      const nextIds = new Set(Object.keys(state.users));

      // Added
      for (const [socketId, u] of Object.entries(state.users)) {
        if (!prevIds.has(socketId)) {
          pixi.addAvatar(socketId, u.username, u.x, u.y, socketId === state.myId);
        }
      }

      // Removed
      for (const socketId of prevIds) {
        if (!nextIds.has(socketId)) {
          pixi.removeAvatar(socketId);
        }
      }

      // Position updates (others only — local is driven by PixiApp itself)
      for (const [id, u] of Object.entries(state.users)) {
        if (id === state.myId) continue;
        const prev_u = prev.users[id];
        if (prev_u && (prev_u.x !== u.x || prev_u.y !== u.y)) {
          pixi.updateAvatar(id, u.x, u.y);
        }
      }
    });
    return unsub;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
