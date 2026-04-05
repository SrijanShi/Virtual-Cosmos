import useStore from '../store/useStore';

export default function Toolbar() {
  const username = useStore((s) => s.username);
  const nearbyUsers = useStore((s) => s.nearbyUsers);

  const nearbyCount = Object.keys(nearbyUsers).length;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 224, right: 0, height: 48,
      background: 'rgba(3,7,18,0.95)', borderTop: '1px solid #1f2937',
      zIndex: 30, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px',
    }}>
      {/* Left: user info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 11, fontWeight: 700,
        }}>
          {username.slice(0, 2).toUpperCase()}
        </div>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{username}</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
      </div>

      {/* Center: proximity indicator */}
      <div>
        {nearbyCount > 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(52,211,153,0.4)',
            borderRadius: 999, padding: '4px 12px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
            <span style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 500 }}>
              {nearbyCount} {nearbyCount === 1 ? 'person' : 'people'} nearby
            </span>
          </div>
        ) : (
          <span style={{ color: '#4b5563', fontSize: 12 }}>No one nearby</span>
        )}
      </div>

      {/* Right */}
      <span style={{ color: '#4b5563', fontSize: 12 }}>WASD / ↑↓←→ to move</span>
    </div>
  );
}
