/**
 * peerManager – manages all WebRTC peer connections.
 *
 * Uses the "perfect negotiation" pattern so both peers can renegotiate
 * at any time (e.g. when camera is turned on mid-session).
 * The "polite" peer is the one with the higher socket ID — it rolls
 * back its own offer when there is a collision.
 */

import { getMicStream, getCamStream, subscribe as subscribeStreams } from '../media/localStreams';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const proxPeers   = new Map(); // socketId → RTCPeerConnection
const proxStreams  = new Map(); // socketId → MediaStream (remote)

const screenSharePeers = new Map(); // viewerId → RTCPeerConnection (sharer side)
let screenViewPc     = null;        // RTCPeerConnection              (viewer side)
let screenViewStream = null;        // MediaStream                    (viewer side)
let screenSharerId   = null;        // socketId of the active sharer

let _socket = null;
let _myId   = null;

const listeners = new Set();
function notify() { listeners.forEach(fn => fn()); }

// ── Init ────────────────────────────────────────────────────────────────────

export function init(socket, myId) {
  _socket = socket;
  _myId   = myId;

  // When local tracks change, sync them into every existing proximity PC.
  // onnegotiationneeded fires automatically after addTrack/removeTrack.
  subscribeStreams(() => {
    for (const [peerId, pc] of proxPeers.entries()) {
      syncLocalTracks(pc, peerId).catch(() => {});
    }
  });
}

export function subscribe(fn)         { listeners.add(fn); return () => listeners.delete(fn); }
export function getProxStreams()       { return proxStreams; }
export function getScreenViewStream() { return screenViewStream; }
export function getScreenSharerId()   { return screenSharerId; }

// ── Proximity ────────────────────────────────────────────────────────────────

function createProxPC(remoteId) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  // Polite peer backs off when there is a signalling collision.
  // Use higher socket ID as the polite peer.
  const polite = _myId > remoteId;
  pc._polite   = polite;
  pc._makingOffer = false;

  // Perfect negotiation: both sides send offers; glare is resolved by politeness.
  pc.onnegotiationneeded = async () => {
    if (pc.signalingState !== 'stable') return;
    try {
      pc._makingOffer = true;
      await pc.setLocalDescription(await pc.createOffer());
      _socket.emit('webrtc:signal', { to: remoteId, data: { type: 'offer', sdp: pc.localDescription } });
    } catch {}
    finally { pc._makingOffer = false; }
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate)
      _socket.emit('webrtc:signal', { to: remoteId, data: { type: 'ice-candidate', candidate } });
  };

  pc.ontrack = ({ track }) => {
    if (!proxStreams.has(remoteId)) proxStreams.set(remoteId, new MediaStream());
    proxStreams.get(remoteId).addTrack(track);
    notify();
  };

  // Seed with any currently active local tracks
  const mic = getMicStream();
  const cam = getCamStream();
  if (mic) mic.getAudioTracks().forEach(t => pc.addTrack(t, mic));
  if (cam) cam.getVideoTracks().forEach(t => pc.addTrack(t, cam));

  return pc;
}

async function syncLocalTracks(pc, _remoteId) {
  const mic = getMicStream();
  const cam = getCamStream();
  const senders = pc.getSenders();

  // Audio
  const audioSender = senders.find(s => s.track?.kind === 'audio');
  const audioTrack  = mic?.getAudioTracks()[0] ?? null;
  if (audioTrack && !audioSender)
    pc.addTrack(audioTrack, mic);
  else if (!audioTrack && audioSender)
    pc.removeTrack(audioSender);
  else if (audioTrack && audioSender && audioSender.track !== audioTrack)
    await audioSender.replaceTrack(audioTrack);

  // Video
  const videoSender = senders.find(s => s.track?.kind === 'video');
  const videoTrack  = cam?.getVideoTracks()[0] ?? null;
  if (videoTrack && !videoSender)
    pc.addTrack(videoTrack, cam);
  else if (!videoTrack && videoSender)
    pc.removeTrack(videoSender);
  else if (videoTrack && videoSender && videoSender.track !== videoTrack)
    await videoSender.replaceTrack(videoTrack);
}

export async function onProximityConnect(userId) {
  if (proxPeers.has(userId)) return;
  const pc = createProxPC(userId);
  proxPeers.set(userId, pc);
  // onnegotiationneeded fires automatically after tracks are seeded in createProxPC.
}

export async function handleProxSignal(fromId, data) {
  if (data.type === 'offer') {
    let pc = proxPeers.get(fromId);
    if (!pc) { pc = createProxPC(fromId); proxPeers.set(fromId, pc); }

    const offerCollision = pc._makingOffer || pc.signalingState !== 'stable';

    if (offerCollision) {
      if (!pc._polite) return; // impolite peer ignores colliding offer
      // Polite peer rolls back its own offer
      try {
        await pc.setLocalDescription({ type: 'rollback' });
      } catch {}
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      await pc.setLocalDescription(await pc.createAnswer());
      _socket.emit('webrtc:signal', { to: fromId, data: { type: 'answer', sdp: pc.localDescription } });
    } catch {}

  } else if (data.type === 'answer') {
    const pc = proxPeers.get(fromId);
    if (pc && pc.signalingState !== 'stable')
      try { await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)); } catch {}

  } else if (data.type === 'ice-candidate') {
    const pc = proxPeers.get(fromId);
    if (pc && data.candidate)
      try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
  }
}

export function onProximityDisconnect(userId) {
  const pc = proxPeers.get(userId);
  if (pc) { pc.close(); proxPeers.delete(userId); }
  proxStreams.delete(userId);
  notify();
}

// ── Screen share – viewer side ───────────────────────────────────────────────

export async function handleScreenSignal(fromId, data) {
  if (data.type === 'offer') {
    if (screenViewPc) { screenViewPc.close(); }

    screenViewPc   = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    screenSharerId = fromId;

    screenViewPc.onicecandidate = ({ candidate }) => {
      if (candidate)
        _socket.emit('webrtc:screen-signal', { to: fromId, data: { type: 'ice-candidate', candidate } });
    };

    screenViewPc.ontrack = ({ track, streams }) => {
      screenViewStream = streams[0] ?? new MediaStream([track]);
      notify();
    };

    try {
      await screenViewPc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      await screenViewPc.setLocalDescription(await screenViewPc.createAnswer());
      _socket.emit('webrtc:screen-signal', { to: fromId, data: { type: 'answer', sdp: screenViewPc.localDescription } });
    } catch {}

  } else if (data.type === 'ice-candidate') {
    if (screenViewPc && data.candidate)
      try { await screenViewPc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
  }
}

export function closeScreenView() {
  if (screenViewPc) { screenViewPc.close(); screenViewPc = null; }
  screenViewStream = null;
  screenSharerId   = null;
  notify();
}

// ── Screen share – sharer side ───────────────────────────────────────────────

export async function startShareToViewer(screenStream, viewerId) {
  if (screenSharePeers.has(viewerId)) return;

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  screenSharePeers.set(viewerId, pc);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate)
      _socket.emit('webrtc:screen-signal', { to: viewerId, data: { type: 'ice-candidate', candidate } });
  };

  screenStream.getTracks().forEach(t => pc.addTrack(t, screenStream));

  try {
    await pc.setLocalDescription(await pc.createOffer());
    _socket.emit('webrtc:screen-signal', { to: viewerId, data: { type: 'offer', sdp: pc.localDescription } });
  } catch {}
}

export async function handleShareAnswerFromViewer(viewerId, data) {
  const pc = screenSharePeers.get(viewerId);
  if (!pc) return;

  if (data.type === 'answer') {
    try { await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)); } catch {}
  } else if (data.type === 'ice-candidate' && data.candidate) {
    try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
  }
}

export function stopAllSharing() {
  for (const pc of screenSharePeers.values()) pc.close();
  screenSharePeers.clear();
}

export function destroyAll() {
  for (const pc of proxPeers.values()) pc.close();
  proxPeers.clear();
  proxStreams.clear();
  stopAllSharing();
  closeScreenView();
}
