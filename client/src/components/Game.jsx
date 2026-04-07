import { useEffect, useRef, useState } from 'react';
import { PixiApp } from '../pixi/PixiApp';
import useStore from '../store/useStore';
import { getSocket } from '../hooks/useSocket';
import { subscribe as subscribePeers, getScreenViewStream } from '../webrtc/peerManager';

export default function Game() {
  const canvasRef    = useRef(null);
  const pixiRef      = useRef(null);
  const screenVideoRef = useRef(null);

  const myId              = useStore((s) => s.myId);
  const sessionRooms      = useStore((s) => s.sessionRooms);
  const screenShareActive = useStore((s) => s.screenShareActive);
  const [zoom, setZoom]   = useState(1.0);
  const [screenStream, setScreenStream] = useState(null);

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
      sessionRooms,
    );

    pixi.onZoomChange((z) => setZoom(z));
    pixi.onZoneChange((zone) => {
      useStore.getState().setCurrentZone(zone);
      getSocket()?.emit('zone:change', { roomZone: zone });
    });

    pixiRef.current = pixi;

    return () => {
      pixi.destroy();
      pixiRef.current = null;
    };
  }, [myId]);

  // Avatar sync
  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      const pixi = pixiRef.current;
      if (!pixi) return;
      const prevIds = new Set(Object.keys(prev.users));
      const nextIds = new Set(Object.keys(state.users));
      for (const [socketId, u] of Object.entries(state.users)) {
        if (!prevIds.has(socketId))
          pixi.addAvatar(socketId, u.username, u.x, u.y, socketId === state.myId);
      }
      for (const socketId of prevIds) {
        if (!nextIds.has(socketId)) pixi.removeAvatar(socketId);
      }
      for (const [id, u] of Object.entries(state.users)) {
        if (id === state.myId) continue;
        const pu = prev.users[id];
        if (pu && (pu.x !== u.x || pu.y !== u.y)) pixi.updateAvatar(id, u.x, u.y);
      }
    });
    return unsub;
  }, []);

  // Subscribe to peerManager for screen share stream changes
  useEffect(() => {
    const unsub = subscribePeers(() => {
      const stream = getScreenViewStream();
      setScreenStream(stream);
      if (stream && screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
    });
    return unsub;
  }, []);

  // Attach stream to video element when it changes
  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const handleZoomIn  = () => pixiRef.current?.zoomIn();
  const handleZoomOut = () => pixiRef.current?.zoomOut();
  const handleReset   = () => { pixiRef.current?.setZoom(1.0); setZoom(1.0); };

  const zoomPct = Math.round(zoom * 100);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Screen share viewer overlay */}
      {screenStream && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 25, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(17,24,39,0.9)', border: '1px solid #374151',
            borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
            <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}>
              {screenShareActive?.sharerName
                ? `${screenShareActive.sharerName} is sharing their screen`
                : 'Screen share active'}
            </span>
            <button
              onClick={() => {
                useStore.getState().setScreenShareActive(null);
                setScreenStream(null);
              }}
              style={{
                background: 'none', border: 'none', color: '#9ca3af',
                cursor: 'pointer', fontSize: 16, lineHeight: 1, marginLeft: 4,
              }}
            >✕</button>
          </div>
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            style={{
              maxWidth: '90%', maxHeight: '80vh',
              borderRadius: 10, border: '2px solid #374151',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      )}

      {/* Proximity audio players (hidden) */}
      <ProximityAudio />

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: 20, borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)', border: '1px solid #374151',
      }}>
        <ZoomBtn onClick={handleZoomIn} title="Zoom in (+)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </ZoomBtn>
        <button onClick={handleReset} title="Reset zoom" style={{
          width: 40, height: 28, background: '#1f2937',
          border: 'none', borderTop: '1px solid #374151', borderBottom: '1px solid #374151',
          color: '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
        >{zoomPct}%</button>
        <ZoomBtn onClick={handleZoomOut} title="Zoom out (-)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </ZoomBtn>
      </div>

      {/* Drag hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(17,24,39,0.7)', border: '1px solid #374151',
        borderRadius: 8, padding: '4px 10px', color: '#4b5563', fontSize: 11,
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        Click + drag to pan · +/- keys to zoom
      </div>
    </div>
  );
}

// Renders hidden <audio> elements for each nearby peer's remote stream
function ProximityAudio() {
  const [proxStreams, setProxStreams] = useState({});

  useEffect(() => {
    const unsub = subscribePeers(() => {
      const map = {};
      for (const [id, stream] of peerManager_getProxStreams()) {
        map[id] = stream;
      }
      setProxStreams({ ...map });
    });
    return unsub;
  }, []);

  return (
    <>
      {Object.entries(proxStreams).map(([id, stream]) => (
        <AudioPlayer key={id} stream={stream} />
      ))}
    </>
  );
}

function AudioPlayer({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} />;
}

// Lazy import to avoid circular — peerManager is already imported above via subscribePeers
import { getProxStreams as peerManager_getProxStreams } from '../webrtc/peerManager';

function ZoomBtn({ onClick, title, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: 40, height: 32, background: hovered ? '#374151' : '#1f2937',
        border: 'none', color: hovered ? '#f3f4f6' : '#9ca3af', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s',
      }}
    >{children}</button>
  );
}
