import { useState } from 'react';
import { useSocket } from './hooks/useSocket';
import useStore from './store/useStore';
import LoginModal from './components/LoginModal';
import Game from './components/Game';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import Toolbar from './components/Toolbar';

export default function App() {
  const [joined, setJoined] = useState(false);
  useSocket();

  const myId = useStore((s) => s.myId);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#030712' }}>
      {!joined && <LoginModal onJoin={() => setJoined(true)} />}

      {joined && (
        <>
          <Sidebar />
          <div style={{ marginLeft: 224, height: '100%', paddingBottom: 48, position: 'relative', boxSizing: 'border-box' }}>
            <Game />
            {!myId && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(3,7,18,0.8)',
              }}>
                <span style={{ color: '#fff', fontSize: 14 }}>Connecting to cosmos...</span>
              </div>
            )}
          </div>
          <ChatPanel />
          <Toolbar />
        </>
      )}
    </div>
  );
}
