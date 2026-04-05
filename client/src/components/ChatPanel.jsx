import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { getSocket } from '../hooks/useSocket';

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const myId = useStore((s) => s.myId);
  const nearbyUsers = useStore((s) => s.nearbyUsers);
  const activeRooms = useStore((s) => s.activeRooms);
  const openRoomId = useStore((s) => s.openRoomId);

  const messages = openRoomId ? (activeRooms[openRoomId] || []) : [];
  const nearbyList = Object.values(nearbyUsers);
  const isOpen = nearbyList.length > 0 && openRoomId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !openRoomId) return;
    const socket = getSocket();
    if (socket) socket.emit('chat:message', { roomId: openRoomId, text });
    setInput('');
  };

  const panelStyle = {
    position: 'fixed', bottom: 56, right: 16, zIndex: 40,
    width: 300, background: 'rgba(3,7,18,0.95)',
    border: '1px solid #374151', borderRadius: 16,
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };

  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', bottom: 56, right: 16, zIndex: 40 }}>
        <div style={{
          background: 'rgba(17,24,39,0.85)', border: '1px solid #374151',
          borderRadius: 12, padding: '8px 14px', color: '#6b7280', fontSize: 12,
        }}>
          Move close to someone to chat
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1f2937', background: 'rgba(17,24,39,0.5)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>Nearby Chat</p>
          <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>{nearbyList.map(u => u.username).join(', ')}</p>
        </div>
        <span style={{ color: '#34d399', fontSize: 11, fontWeight: 600 }}>Connected</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, maxHeight: 220, minHeight: 100 }}>
        {messages.length === 0 ? (
          <p style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 16 }}>Say hello! 👋</p>
        ) : messages.map((msg, i) => {
          const isMe = msg.from === myId;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
              {!isMe && <span style={{ color: '#6b7280', fontSize: 11, marginBottom: 2, paddingLeft: 4 }}>{msg.username}</span>}
              <div style={{
                maxWidth: '85%', padding: '6px 12px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: isMe ? '#2563eb' : '#1f2937', color: '#f3f4f6', fontSize: 13,
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #1f2937' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1, background: '#1f2937', border: '1px solid #374151',
            borderRadius: 8, padding: '7px 10px', color: '#fff',
            fontSize: 13, outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            background: input.trim() ? '#2563eb' : '#374151',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '7px 12px', cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: 14,
          }}
        >↑</button>
      </form>
    </div>
  );
}
