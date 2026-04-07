/**
 * Renders small video tiles for remote peers who have camera on.
 * Reads from peerManager.getProxStreams() and re-renders on changes.
 */
import { useState, useEffect, useRef } from 'react';
import { subscribe as subscribePeers, getProxStreams } from '../webrtc/peerManager';
import useStore from '../store/useStore';

export default function ProximityMedia() {
  const [proxStreams, setProxStreams] = useState(() => new Map(getProxStreams()));
  const nearbyUsers = useStore((s) => s.nearbyUsers);

  useEffect(() => {
    const unsub = subscribePeers(() => {
      setProxStreams(new Map(getProxStreams()));
    });
    return unsub;
  }, []);

  const entries = [...proxStreams.entries()].filter(([, stream]) =>
    stream.getVideoTracks().length > 0
  );

  if (entries.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 45,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {entries.map(([peerId, stream]) => {
        const username = nearbyUsers[peerId]?.username ?? 'Unknown';
        return <PeerVideo key={peerId} stream={stream} username={username} />;
      })}
    </div>
  );
}

function PeerVideo({ stream, username }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div style={{
      width: 160, borderRadius: 10, overflow: 'hidden',
      border: '2px solid #374151', background: '#000',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)', position: 'relative',
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.55)', padding: '3px 8px',
        color: '#e5e7eb', fontSize: 11, fontWeight: 500,
      }}>
        {username}
      </div>
    </div>
  );
}
