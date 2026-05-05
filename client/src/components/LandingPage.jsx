import { useState, useEffect } from 'react';

const ALL_ROOMS = [
  'MERN Stack', 'UI/UX', 'Ethical Hacking', 'DSA', 'Flutter',
  'Financial Modeling', 'Data Analytics', 'Python', 'Dev Club', 'Graphic AI Club',
];

export default function LandingPage({ onEnter }) {
  const [view, setView]           = useState('home'); // 'home' | 'create' | 'join'
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Create form
  const [hostName, setHostName]       = useState('');
  const [spaceName, setSpaceName]     = useState('');
  const [isPrivate, setIsPrivate]     = useState(false);
  const [selectedRooms, setSelectedRooms] = useState(['DSA', 'Flutter', 'Python', 'Dev Club']);

  // Create form – password (private)
  const [createPassword, setCreatePassword] = useState('');

  // Join form
  const [joinName, setJoinName]   = useState('');
  const [joinCode, setJoinCode]   = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinNeedsPassword, setJoinNeedsPassword] = useState(false);

  // Auto-fill code from URL ?session=XXXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('session');
    if (code) { setJoinCode(code.toUpperCase()); setView('join'); }
  }, []);

  const toggleRoom = (room) => {
    setSelectedRooms(prev =>
      prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!hostName.trim() || !spaceName.trim() || selectedRooms.length === 0) {
      setError('Please fill all fields and select at least one room.'); return;
    }
    if (isPrivate && !createPassword.trim()) {
      setError('Please set a password for the private space.'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: spaceName.trim(), hostName: hostName.trim(), isPrivate, password: createPassword.trim(), rooms: selectedRooms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      // Update URL with session code
      window.history.replaceState({}, '', `?session=${data.code}`);
      onEnter({ username: hostName.trim(), sessionCode: data.code, sessionName: data.name, rooms: data.rooms, isHost: true });
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinName.trim() || !joinCode.trim()) { setError('Enter your name and session code.'); return; }
    setLoading(true); setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`/session/${code}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Session not found');

      if (data.isPrivate && !joinNeedsPassword) {
        // Show password prompt
        setJoinNeedsPassword(true);
        setLoading(false);
        return;
      }

      if (data.isPrivate && joinNeedsPassword) {
        // Verify password
        const vRes = await fetch(`/session/${code}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: joinPassword }),
        });
        const vData = await vRes.json();
        if (!vRes.ok) throw new Error(vData.error || 'Incorrect password');
        window.history.replaceState({}, '', `?session=${vData.code}`);
        onEnter({ username: joinName.trim(), sessionCode: vData.code, sessionName: vData.name, rooms: vData.rooms, isHost: false });
        return;
      }

      window.history.replaceState({}, '', `?session=${data.code}`);
      onEnter({ username: joinName.trim(), sessionCode: data.code, sessionName: data.name, rooms: data.rooms, isHost: false });
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#030712',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Background subtle grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, padding: '0 24px' }}>

        {/* Home */}
        {view === 'home' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🌌</div>
            <h1 style={{ color: '#f9fafb', fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Virtual Cosmos</h1>
            <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 40px' }}>
              A 2D virtual space where proximity connects people
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => { setView('create'); setError(''); }} style={btnStyle('#2563eb')}>
                ✦ Create a Space
              </button>
              <button onClick={() => { setView('join'); setError(''); }} style={btnStyle('#1f2937', '#374151')}>
                → Join a Space
              </button>
            </div>
          </div>
        )}

        {/* Create */}
        {view === 'create' && (
          <div>
            <button onClick={() => { setView('home'); setError(''); }} style={backBtn}>← Back</button>
            <h2 style={{ color: '#f9fafb', fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>Create a Space</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Your Name">
                <input value={hostName} onChange={e => setHostName(e.target.value)}
                  placeholder="e.g. Srijan" maxLength={20} style={inputStyle} />
              </Field>
              <Field label="Space Name">
                <input value={spaceName} onChange={e => setSpaceName(e.target.value)}
                  placeholder="e.g. Upskill Mafia" maxLength={40} style={inputStyle} />
              </Field>
              <Field label="Visibility">
                <div style={{ display: 'flex', gap: 8 }}>
                  {[false, true].map(val => (
                    <button key={String(val)} type="button" onClick={() => setIsPrivate(val)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      background: isPrivate === val ? '#2563eb' : '#1f2937',
                      color: isPrivate === val ? '#fff' : '#9ca3af',
                    }}>
                      {val ? '🔒 Private' : '🌐 Public'}
                    </button>
                  ))}
                </div>
              </Field>
              {isPrivate && (
                <Field label="Password">
                  <input value={createPassword} onChange={e => setCreatePassword(e.target.value)}
                    type="password" placeholder="Set a password for this space" maxLength={50} style={inputStyle} />
                </Field>
              )}
              <Field label={`Rooms (${selectedRooms.length} selected)`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ALL_ROOMS.map(room => (
                    <button key={room} type="button" onClick={() => toggleRoom(room)} style={{
                      padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500,
                      background: selectedRooms.includes(room) ? '#1d4ed8' : '#1f2937',
                      color: selectedRooms.includes(room) ? '#bfdbfe' : '#6b7280',
                      outline: selectedRooms.includes(room) ? '1px solid #3b82f6' : '1px solid #374151',
                    }}>{room}</button>
                  ))}
                </div>
              </Field>
              {error && <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle('#2563eb')}>
                {loading ? 'Creating…' : 'Create Space'}
              </button>
            </form>
          </div>
        )}

        {/* Join */}
        {view === 'join' && (
          <div>
            <button onClick={() => { setView('home'); setError(''); setJoinNeedsPassword(false); setJoinPassword(''); }} style={backBtn}>← Back</button>
            <h2 style={{ color: '#f9fafb', fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>
              {joinNeedsPassword ? '🔒 Private Space' : 'Join a Space'}
            </h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!joinNeedsPassword ? (
                <>
                  <Field label="Your Name">
                    <input value={joinName} onChange={e => setJoinName(e.target.value)}
                      placeholder="e.g. Srijan" maxLength={20} style={inputStyle} autoFocus />
                  </Field>
                  <Field label="Session Code">
                    <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AB3K7Z" maxLength={6} style={{ ...inputStyle, letterSpacing: 6, fontWeight: 700, fontSize: 18, textAlign: 'center' }} />
                  </Field>
                </>
              ) : (
                <>
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 4px' }}>
                    This space is private. Enter the password to join.
                  </p>
                  <Field label="Password">
                    <input value={joinPassword} onChange={e => setJoinPassword(e.target.value)}
                      type="password" placeholder="Enter space password" style={inputStyle} autoFocus />
                  </Field>
                </>
              )}
              {error && <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle('#2563eb')}>
                {loading ? (joinNeedsPassword ? 'Verifying…' : 'Joining…') : (joinNeedsPassword ? 'Enter Space' : 'Join Space')}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', background: '#111827', border: '1px solid #374151',
  borderRadius: 8, padding: '10px 12px', color: '#f9fafb', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};

function btnStyle(bg, border) {
  return {
    width: '100%', background: bg, border: border ? `1px solid ${border}` : 'none',
    borderRadius: 10, padding: '12px 0', color: '#fff', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  };
}

const backBtn = {
  background: 'none', border: 'none', color: '#6b7280', fontSize: 13,
  cursor: 'pointer', padding: '0 0 16px', display: 'block',
};
