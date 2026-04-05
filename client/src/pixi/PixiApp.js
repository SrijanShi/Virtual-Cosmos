import * as PIXI from 'pixi.js';
import { buildWorld, WORLD_W, WORLD_H } from './World';
import { Avatar } from './Avatar';

const SPEED = 3;

export class PixiApp {
  constructor(canvas, myId, initialUsers, onMove) {
    this.myId = myId;
    this.onMove = onMove;

    this.keys = {};
    this.avatars = new Map(); // socketId -> Avatar
    this._keyDown = (e) => { this.keys[e.key] = true; };
    this._keyUp = (e) => { this.keys[e.key] = false; };

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

    // World container (camera target)
    this.world = new PIXI.Container();
    this.app.stage.addChild(this.world);

    // Build tilemap + rooms
    buildWorld(this.world);

    // Add all existing users
    for (const u of initialUsers) {
      this.addAvatar(u.socketId, u.username, u.x, u.y, u.socketId === this.myId);
    }

    // Keyboard listeners
    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup', this._keyUp);

    // Game loop
    this.app.ticker.add(() => this._update());
  }

  _update() {
    const me = this.avatars.get(this.myId);
    if (!me) return;

    // Movement
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
    }

    // Tick all avatars (lerp toward target)
    for (const avatar of this.avatars.values()) {
      avatar.tick();
    }

    // Camera follows local avatar
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const targetCamX = screenW / 2 - me.container.x;
    const targetCamY = screenH / 2 - me.container.y;
    this.world.x += (targetCamX - this.world.x) * 0.1;
    this.world.y += (targetCamY - this.world.y) * 0.1;
  }

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
    if (avatar) {
      avatar.destroy();
      this.avatars.delete(socketId);
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
    if (this.app) this.app.destroy(false, { children: true });
  }
}
