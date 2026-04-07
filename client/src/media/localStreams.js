// Singleton registry for local mic, camera, and screen streams.
// Shared between Toolbar (acquires streams) and peerManager (uses them in WebRTC).

const streams = { mic: null, cam: null, screen: null };
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn({ ...streams }));
}

export function setMicStream(stream)    { streams.mic    = stream; notify(); }
export function setCamStream(stream)    { streams.cam    = stream; notify(); }
export function setScreenStream(stream) { streams.screen = stream; notify(); }

export function getMicStream()    { return streams.mic; }
export function getCamStream()    { return streams.cam; }
export function getScreenStream() { return streams.screen; }

/** Subscribe to stream changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
