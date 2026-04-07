import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import { getSocket } from '../hooks/useSocket';
import * as localStreams from '../media/localStreams';
import * as peerManager from '../webrtc/peerManager';

// ── helpers ──────────────────────────────────────────────────────────────────
function emitStatus(status) {
  const socket = getSocket();
  if (socket) socket.emit('user:status', { status });
  useStore.getState().setUserStatus(useStore.getState().myId, status);
}

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '72px', left: '50%', transform: 'translateX(-50%)',
    background: '#1f2937', color: '#f3f4f6', padding: '8px 18px',
    borderRadius: '8px', fontSize: '13px', zIndex: '9999',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)', pointerEvents: 'none',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

const REACTIONS = ['👍','👏','❤️','😂','🎉','🔥','😮','👋'];

// ── main component ────────────────────────────────────────────────────────────
export default function Toolbar() {
  const username    = useStore((s) => s.username);
  const nearbyUsers = useStore((s) => s.nearbyUsers);
  const nearbyCount = Object.keys(nearbyUsers).length;
  const isHost      = useStore((s) => s.isHost);
  const currentZone = useStore((s) => s.currentZone);

  // ── mic ──
  const [muted, setMuted]     = useState(true);
  const micStreamRef          = useRef(null);

  const toggleMic = async () => {
    try {
      if (!micStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        localStreams.setMicStream(stream);
        emitStatus({ muted: false });
        setMuted(false);
        showToast('Microphone on');
        return;
      }
      const nextMuted = !muted;
      micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
      setMuted(nextMuted);
      emitStatus({ muted: nextMuted });
      showToast(nextMuted ? 'Microphone muted' : 'Microphone unmuted');
    } catch {
      showToast('Microphone permission denied');
    }
  };

  // ── camera ──
  const [camOn, setCamOn] = useState(false);
  const camStreamRef      = useRef(null);
  const videoRef          = useRef(null);

  const toggleCamera = async () => {
    if (camOn) {
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      localStreams.setCamStream(null);
      setCamOn(false);
      emitStatus({ camOn: false });
      showToast('Camera off');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        camStreamRef.current = stream;
        localStreams.setCamStream(stream);
        setCamOn(true);
        emitStatus({ camOn: true });
        showToast('Camera on');
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        }, 50);
      } catch {
        showToast('Camera permission denied');
      }
    }
  };

  // ── screen share ──
  const [sharing, setSharing] = useState(false);
  const screenStreamRef       = useRef(null);

  const toggleScreenShare = async () => {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      localStreams.setScreenStream(null);
      peerManager.stopAllSharing();
      getSocket()?.emit('screenshare:stop');
      setSharing(false);
      showToast('Screen share stopped');
    } else {
      if (!currentZone) { showToast('Enter a room to share your screen'); return; }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        localStreams.setScreenStream(stream);
        setSharing(true);
        showToast(`Sharing screen in ${currentZone}`);
        getSocket()?.emit('screenshare:start', { roomZone: currentZone });
        stream.getVideoTracks()[0].onended = () => {
          localStreams.setScreenStream(null);
          peerManager.stopAllSharing();
          getSocket()?.emit('screenshare:stop');
          setSharing(false);
        };
      } catch {
        showToast('Screen share cancelled');
      }
    }
  };

  // ── share / invite ──
  const handleShare  = () => navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied!'));
  const handleInvite = () => navigator.clipboard.writeText(`Join me in Virtual Cosmos: ${window.location.href}`).then(() => showToast('Invite link copied!'));

  // ── record ──
  const [recording, setRecording] = useState(false);
  const recorderRef               = useRef(null);
  const recChunksRef              = useRef([]);

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      showToast('Recording saved');
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        recChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(recChunksRef.current, { type: 'video/webm' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `virtual-cosmos-${Date.now()}.webm`;
          a.click();
          stream.getTracks().forEach(t => t.stop());
        };
        recorder.start();
        recorderRef.current = recorder;
        setRecording(true);
        showToast('Recording started…');
        stream.getVideoTracks()[0].onended = () => { recorder.stop(); setRecording(false); };
      } catch {
        showToast('Screen share cancelled');
      }
    }
  };

  // ── hand raise ──
  const [handRaised, setHandRaised] = useState(false);
  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    emitStatus({ handRaised: next });
    showToast(next ? '✋ Hand raised' : 'Hand lowered');
  };

  // ── reactions ──
  const [showReactions, setShowReactions] = useState(false);
  const sendReaction = (emoji) => {
    setShowReactions(false);
    emitStatus({ reaction: emoji });
    showToast(`You reacted ${emoji}`);
    spawnFloatingEmoji(emoji);
  };

  // ── action menu ──
  const [showAction, setShowAction] = useState(false);
  const leaveRoom = () => {
    showToast('Left the cosmos');
    setTimeout(() => window.location.reload(), 1000);
  };

  const closeSession = () => {
    setShowAction(false);
    if (!confirm('Close this session for everyone?')) return;
    getSocket()?.emit('session:close');
  };

  // close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setShowReactions(false); setShowAction(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // cleanup on unmount
  useEffect(() => () => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    recorderRef.current?.stop();
  }, []);

  const actionMenuItems = [
    { label: '📋 Copy user ID',  fn: () => { navigator.clipboard.writeText(useStore.getState().myId || ''); showToast('User ID copied'); setShowAction(false); } },
    { label: '🔗 Share room',    fn: () => { handleShare(); setShowAction(false); } },
    { label: '🔄 Reload cosmos', fn: () => window.location.reload() },
    { label: '🚪 Leave',         fn: leaveRoom, red: true },
    ...(isHost ? [{ label: '🔴 Close Session', fn: closeSession, red: true }] : []),
  ];

  return (
    <>
      {/* Camera PiP */}
      {camOn && (
        <div style={{
          position: 'fixed', bottom: 68, left: 232, zIndex: 50,
          width: 160, height: 120, borderRadius: 10, overflow: 'hidden',
          border: '2px solid #374151', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          background: '#000',
        }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <button onClick={toggleCamera} style={{
            position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)',
            border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer',
            color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
      )}

      {/* Reaction picker */}
      {showReactions && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'fixed', bottom: 68, left: '50%', transform: 'translateX(-50%)',
          background: '#1f2937', border: '1px solid #374151', borderRadius: 12,
          padding: '8px 10px', display: 'flex', gap: 6, zIndex: 50,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}>
          {REACTIONS.map(e => (
            <button key={e} onClick={() => sendReaction(e)} style={{
              background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
              padding: '2px 4px', borderRadius: 6, transition: 'transform 0.1s',
            }}
              onMouseEnter={el => el.currentTarget.style.transform = 'scale(1.3)'}
              onMouseLeave={el => el.currentTarget.style.transform = 'scale(1)'}
            >{e}</button>
          ))}
        </div>
      )}

      {/* Action menu */}
      {showAction && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'fixed', bottom: 68, right: 16,
          background: '#1f2937', border: '1px solid #374151', borderRadius: 10,
          overflow: 'hidden', zIndex: 50, minWidth: 180,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}>
          {actionMenuItems.map(({ label, fn, red }) => (
            <button key={label} onClick={fn} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 14px', background: 'none', border: 'none',
              color: red ? '#f87171' : '#e5e7eb', fontSize: 13, cursor: 'pointer',
              borderBottom: '1px solid #374151',
            }}
              onMouseEnter={el => el.currentTarget.style.background = '#374151'}
              onMouseLeave={el => el.currentTarget.style.background = 'none'}
            >{label}</button>
          ))}
        </div>
      )}

      {/* Main toolbar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 224, right: 0, height: 56,
        background: '#111827', borderTop: '1px solid #1f2937',
        zIndex: 30, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
      }}>
        {/* Left: identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            {username.slice(0, 2).toUpperCase()}
          </div>
          <span style={{ color: '#f3f4f6', fontSize: 13, fontWeight: 500 }}>{username}</span>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399' }} />
        </div>

        {/* Center: buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToolBtn label={muted ? 'Unmute' : 'Mute'} active={muted} activeColor="#ef4444" onClick={toggleMic}
            icon={muted ? <MicOffIcon /> : <MicIcon />} />
          <ToolBtn label={camOn ? 'Camera' : 'Camera'} active={camOn} activeColor="#3b82f6" onClick={toggleCamera}
            icon={camOn ? <CamOnIcon /> : <CamIcon />} />
          <ToolBtn label={sharing ? 'Stop Share' : 'Share Screen'} active={sharing} activeColor="#8b5cf6" onClick={toggleScreenShare}
            icon={<ScreenShareIcon active={sharing} />} />
          <Divider />
          <ToolBtn label="Share" onClick={handleShare} icon={<ShareIcon />} />
          <Divider />
          <ToolBtn label="Invite" onClick={handleInvite} icon={<InviteIcon />} />
          <ToolBtn label={recording ? 'Stop' : 'Record'} active={recording} activeColor="#ef4444" onClick={toggleRecord}
            icon={<RecordIcon active={recording} />} />
          <ToolBtn label="Move" icon={<MoveIcon />} />
          <ToolBtn label="Hand" active={handRaised} activeColor="#f59e0b" onClick={toggleHand}
            icon={<span style={{ fontSize: 16 }}>✋</span>} />
          <ToolBtn label="React" active={showReactions} activeColor="#8b5cf6"
            onClick={(e) => { e.stopPropagation(); setShowReactions(v => !v); }}
            icon={<span style={{ fontSize: 16 }}>👍</span>} />
          <ToolBtn label="More" active={showAction} activeColor="#6b7280"
            onClick={(e) => { e.stopPropagation(); setShowAction(v => !v); }}
            icon={<ActionIcon />} />
        </div>

        {/* Right: proximity */}
        <div style={{ minWidth: 160, display: 'flex', justifyContent: 'flex-end' }}>
          {nearbyCount > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(6,78,59,0.5)', border: '1px solid rgba(52,211,153,0.4)',
              borderRadius: 999, padding: '4px 12px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
              <span style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 500 }}>
                {nearbyCount} {nearbyCount === 1 ? 'person' : 'people'} nearby
              </span>
            </div>
          ) : (
            <span style={{ color: '#4b5563', fontSize: 12 }}>WASD / ↑↓←→ to move</span>
          )}
        </div>
      </div>
    </>
  );
}

// ── floating emoji ─────────────────────────────────────────────────────────────
function spawnFloatingEmoji(emoji) {
  const el = document.createElement('div');
  el.textContent = emoji;
  Object.assign(el.style, {
    position: 'fixed', bottom: '72px', left: `${40 + Math.random() * 20}%`,
    fontSize: '32px', zIndex: '9998', pointerEvents: 'none',
    transition: 'transform 1.8s ease-out, opacity 1.8s ease-out',
    transform: 'translateY(0)', opacity: '1',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translateY(-120px)'; el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 1900);
}

// ── sub-components ─────────────────────────────────────────────────────────────
function ToolBtn({ label, icon, active = false, activeColor = '#3b82f6', onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: active ? `${activeColor}22` : hovered ? '#1f2937' : 'transparent',
        minWidth: 52, transition: 'background 0.15s',
      }}>
      <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? activeColor : hovered ? '#e5e7eb' : '#9ca3af' }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, color: active ? activeColor : hovered ? '#e5e7eb' : '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 32, background: '#1f2937', margin: '0 4px', flexShrink: 0 }} />;
}

// ── icons ──────────────────────────────────────────────────────────────────────
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/>
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 10v-1m14 0v1a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/>
    </svg>
  );
}
function CamIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
}
function CamOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" fill="currentColor"/>
      <rect x="1" y="5" width="15" height="14" rx="2" fill="currentColor" opacity="0.3"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
}
function ScreenShareIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" fill={active ? 'currentColor' : 'none'} opacity={active ? 0.2 : 1}/>
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="21"/>
      {active && <path d="M9 10l3-3 3 3M12 7v6" strokeWidth="2"/>}
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}
function InviteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
    </svg>
  );
}
function RecordIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill={active ? '#ef444422' : 'none'} stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill={active ? '#ef4444' : 'currentColor'}/>
    </svg>
  );
}
function MoveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>
      <polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
      <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
    </svg>
  );
}
function ActionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" fill="currentColor"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  );
}
