import { useState } from 'react';
import useStore from '../store/useStore';
import { getSocket } from '../hooks/useSocket';

export default function LoginModal({ onJoin }) {
  const [name, setName] = useState('');
  const setUsername = useStore((s) => s.setUsername);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setUsername(trimmed);
    const socket = getSocket();
    if (socket) socket.emit('user:join', { username: trimmed });
    onJoin(trimmed);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
    }}>
      <div style={{
        background: '#111827', border: '1px solid #374151',
        borderRadius: 16, padding: 32, width: 360, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌌</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Virtual Cosmos</h1>
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Enter your name to join the space</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name..."
            maxLength={20}
            style={{
              width: '100%', background: '#1f2937', border: '1px solid #4b5563',
              borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14,
              outline: 'none', marginBottom: 12, boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              width: '100%', background: name.trim() ? '#2563eb' : '#374151',
              color: name.trim() ? '#fff' : '#6b7280', border: 'none',
              borderRadius: 8, padding: '10px 0', fontSize: 14,
              fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Enter Cosmos
          </button>
        </form>

        <p style={{ color: '#4b5563', fontSize: 11, textAlign: 'center', marginTop: 14 }}>
          Use WASD or Arrow Keys to move • Walk close to others to chat
        </p>
      </div>
    </div>
  );
}
