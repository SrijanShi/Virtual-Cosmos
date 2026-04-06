import * as PIXI from 'pixi.js';
import { buildWorld, WORLD_W, WORLD_H } from './World';
import { Avatar } from './Avatar';

const SPEED = 3;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.15;
const ZOOM_LERP = 0.12;

export class PixiApp {
  constructor(canvas, myId, initialUsers, onMove, sessionRooms = []) {
    this.myId   = myId;
    this.onMove = onMove;

    this.keys    = {};
    this.avatars = new Map();

    this._zoom       = 1.0;
    this._targetZoom = 1.0;
    this._onZoomChange = null;

    // Drag state
    this._dragging   = false;
    this._dragStart  = { x: 0, y: 0 };
    this._worldStart = null;
    this._didDrag    = false;  // true only during active drag gesture
    this._isPanned   = false;  // stays true until user moves with keys

    this._keyDown = (e) => {
      this.keys[e.key] = true;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); this._stepZoom(1); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); this._stepZoom(-1); }
    };
    this._keyUp = (e) => { this.keys[e.key] = false; };

    // Left-click drag
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this._dragging   = true;
      this._didDrag    = false;
      this._dragStart  = { x: e.clientX, y: e.clientY };
      this._worldStart = null; // captured lazily when threshold is crossed
    };
    this._onMouseMove = (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      if (!this._didDrag && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        this._worldStart = { x: this.world.x, y: this.world.y };
        this._dragStart  = { x: e.clientX, y: e.clientY };
        this._didDrag  = true;
        this._isPanned = true;
      }
      if (this._didDrag) {
        const ddx = e.clientX - this._dragStart.x;
        const ddy = e.clientY - this._dragStart.y;
        this.world.x = this._worldStart.x + ddx;
        this.world.y = this._worldStart.y + ddy;
      }
    };
    this._onMouseUp = () => { this._dragging = false; };

    // Touch drag
    this._onTouchStart = (e) => {
      if (e.touches.length === 1) {
        this._dragging   = true;
        this._didDrag    = false;
        this._dragStart  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this._worldStart = null;
      }
    };
    this._onTouchMove = (e) => {
      if (!this._dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const tx = e.touches[0].clientX;
      const ty = e.touches[0].clientY;
      const dx = tx - this._dragStart.x;
      const dy = ty - this._dragStart.y;
      if (!this._didDrag && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        this._worldStart = { x: this.world.x, y: this.world.y };
        this._dragStart  = { x: tx, y: ty };
        this._didDrag  = true;
        this._isPanned = true;
      }
      if (this._didDrag) {
        this.world.x = this._worldStart.x + (tx - this._dragStart.x);
        this.world.y = this._worldStart.y + (ty - this._dragStart.y);
      }
    };
    this._onTouchEnd = () => { this._dragging = false; };

    this._sessionRooms = sessionRooms;
    this.app = new PIXI.Application();
    this._initAsync(canvas, initialUsers).catch(console.error);
  }

  async _initAsync(canvas, initialUsers) {
    await this.app.init({
      canvas,
      resizeTo: window,
      backgroundColor: 0x2a2a3a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.world = new PIXI.Container();
    this.app.stage.addChild(this.world);
    buildWorld(this.world, this._sessionRooms);

    for (const u of initialUsers) {
      this.addAvatar(u.socketId, u.username, u.x, u.y, u.socketId === this.myId);
    }

    const c = this.app.canvas;
    window.addEventListener('keydown',   this._keyDown);
    window.addEventListener('keyup',     this._keyUp);
    c.addEventListener('mousedown',      this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup',   this._onMouseUp);
    c.addEventListener('touchstart',     this._onTouchStart, { passive: true });
    c.addEventListener('touchmove',      this._onTouchMove,  { passive: false });
    c.addEventListener('touchend',       this._onTouchEnd);

    this.app.ticker.add(() => this._update());
  }

  // ── zoom (buttons / keyboard only) ────────────────────────────────────────
  get zoom() { return this._zoom; }

  _stepZoom(dir) {
    this._targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
      parseFloat((this._targetZoom + dir * ZOOM_STEP).toFixed(2))
    ));
  }

  zoomIn()  { this._stepZoom(1); }
  zoomOut() { this._stepZoom(-1); }
  setZoom(value) {
    this._targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  }

  // ── game loop ─────────────────────────────────────────────────────────────
  _update() {
    const me = this.avatars.get(this.myId);

    // Smooth zoom lerp
    if (Math.abs(this._targetZoom - this._zoom) > 0.001) {
      this._zoom += (this._targetZoom - this._zoom) * ZOOM_LERP;
      this.world.scale.set(this._zoom);
      if (this._onZoomChange) this._onZoomChange(this._zoom);
    }

    if (!me) return;

    // Keyboard movement
    let dx = 0, dy = 0;
    if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp'])    dy -= SPEED;
    if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown'])  dy += SPEED;
    if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft'])  dx -= SPEED;
    if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) dx += SPEED;

    if (dx !== 0 || dy !== 0) {
      const newX = Math.max(20, Math.min(WORLD_W - 20, me.targetX + dx));
      const newY = Math.max(20, Math.min(WORLD_H - 20, me.targetY + dy));
      me.setTarget(newX, newY);
      this.onMove(newX, newY);
      // Resume camera follow only when user actively moves with keys
      this._isPanned = false;
      this._didDrag  = false;
    }

    for (const avatar of this.avatars.values()) avatar.tick();

    // Camera follows local avatar — disabled while user has panned away
    if (!this._isPanned) {
      const screenW = this.app.screen.width;
      const screenH = this.app.screen.height;
      const targetCamX = screenW / 2 - me.container.x * this._zoom;
      const targetCamY = screenH / 2 - me.container.y * this._zoom;
      this.world.x += (targetCamX - this.world.x) * 0.1;
      this.world.y += (targetCamY - this.world.y) * 0.1;
    }
  }

  // ── avatar management ─────────────────────────────────────────────────────
  addAvatar(socketId, username, x, y, isLocal = false) {
    if (this.avatars.has(socketId)) return;
    const avatar = new Avatar(socketId, username, x, y, isLocal);
    this.world.addChild(avatar.container);
    this.avatars.set(socketId, avatar);
  }

  updateAvatar(socketId, x, y) {
    const avatar = this.avatars.get(socketId);
    if (avatar) avatar.setTarget(x, y);
  }

  removeAvatar(socketId) {
    const avatar = this.avatars.get(socketId);
    if (avatar) { avatar.destroy(); this.avatars.delete(socketId); }
  }

  onZoomChange(cb) { this._onZoomChange = cb; }

  destroy() {
    const c = this.app?.canvas;
    window.removeEventListener('keydown',   this._keyDown);
    window.removeEventListener('keyup',     this._keyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup',   this._onMouseUp);
    c?.removeEventListener('mousedown',   this._onMouseDown);
    c?.removeEventListener('touchstart',  this._onTouchStart);
    c?.removeEventListener('touchmove',   this._onTouchMove);
    c?.removeEventListener('touchend',    this._onTouchEnd);
    if (this.app) this.app.destroy(false, { children: true });
  }
}
