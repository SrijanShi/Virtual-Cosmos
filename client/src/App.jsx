import { useState } from 'react';
import { useSocket, joinSession } from './hooks/useSocket';
import useStore from './store/useStore';
import LandingPage from './components/LandingPage';
import Game from './components/Game';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import Toolbar from './components/Toolbar';

export default function App() {
  const [entered, setEntered] = useState(false);
  useSocket();

  const myId = useStore((s) => s.myId);
  const setUsername = useStore((s) => s.setUsername);
  const setSession  = useStore((s) => s.setSession);

  const handleEnter = ({ username, sessionCode, sessionName, rooms, isHost }) => {
    setUsername(username);
    setSession({ sessionCode, sessionName, sessionRooms: rooms, isHost });
    joinSession(username, sessionCode);
    setEntered(true);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#030712' }}>
      {!entered && <LandingPage onEnter={handleEnter} />}

      {entered && (
        <>
          <Sidebar />
          <div style={{ marginLeft: 224, height: '100%', paddingBottom: 56, position: 'relative', boxSizing: 'border-box' }}>
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
