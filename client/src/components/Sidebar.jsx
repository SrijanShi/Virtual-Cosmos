import useStore from '../store/useStore';

export default function Sidebar() {
  const users = useStore((s) => s.users);
  const myId = useStore((s) => s.myId);
  const nearbyUsers = useStore((s) => s.nearbyUsers);

  const userList = Object.values(users);

  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, height: '100%', width: 224,
      background: 'rgba(3,7,18,0.92)', borderRight: '1px solid #1f2937',
      zIndex: 30, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1f2937' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌌</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Virtual Cosmos</span>
        </div>
        <p style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>{userList.length} online</p>
      </div>

      {/* Users */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <p style={{ color: '#4b5563', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>Team</p>
        {userList.map((user) => {
          const isMe = user.socketId === myId;
          const isNearby = !!nearbyUsers[user.socketId];
          return (
            <div key={user.socketId} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
              borderRadius: 8, marginBottom: 2,
              background: isMe ? 'rgba(37,99,235,0.2)' : 'transparent',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: getColor(user.socketId),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.username} {isMe && <span style={{ color: '#6b7280', fontSize: 11 }}>(you)</span>}
                </p>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isNearby ? '#34d399' : '#3b82f6' }} />
            </div>
          );
        })}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #1f2937' }}>
        <p style={{ color: '#4b5563', fontSize: 11, textAlign: 'center', margin: 0 }}>WASD / Arrow Keys to move</p>
      </div>
    </div>
  );
}

const PALETTE = ['#4f86f7','#f76b4f','#4fbb74','#f7c44f','#b04ff7','#f74fb0','#4ff7e8','#f7874f'];
function getColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
