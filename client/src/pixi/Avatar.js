import * as PIXI from 'pixi.js';

const AVATAR_COLORS = [
  0x4f86f7, 0xf76b4f, 0x4fbb74, 0xf7c44f,
  0xb04ff7, 0xf74fb0, 0x4ff7e8, 0xf7874f,
];

function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export class Avatar {
  constructor(socketId, username, x, y, isLocal = false) {
    this.socketId = socketId;
    this.username = username;
    this.isLocal = isLocal;
    this.targetX = x;
    this.targetY = y;

    this.container = new PIXI.Container();
    this.container.x = x;
    this.container.y = y;

    const color = colorForId(socketId);

    // Proximity ring (only for local)
    if (isLocal) {
      this.ring = new PIXI.Graphics();
      this.ring.circle(0, 0, 150).stroke({ color: color, width: 1.5, alpha: 0.25 });
      this.ring.circle(0, 0, 150).fill({ color: color, alpha: 0.05 });
      this.container.addChild(this.ring);
    }

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.ellipse(0, 14, 16, 6).fill({ color: 0x000000, alpha: 0.2 });
    this.container.addChild(shadow);

    // Body circle
    this.body = new PIXI.Graphics();
    this.body.circle(0, 0, 18).fill({ color });
    this.body.circle(0, 0, 18).stroke({ color: 0xffffff, width: 2 });
    this.container.addChild(this.body);

    // Initials text
    const initials = username.slice(0, 2).toUpperCase();
    this.initialsText = new PIXI.Text({
      text: initials,
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        fontWeight: '700',
        fill: 0xffffff,
      },
    });
    this.initialsText.anchor.set(0.5);
    this.initialsText.y = 0;
    this.container.addChild(this.initialsText);

    // Username label
    const bg = new PIXI.Graphics();
    this.nameBg = bg;
    this.container.addChild(bg);

    this.nameLabel = new PIXI.Text({
      text: username,
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        fill: 0xffffff,
        dropShadow: { color: 0x000000, blur: 3, distance: 1 },
      },
    });
    this.nameLabel.anchor.set(0.5);
    this.nameLabel.y = -32;
    this._drawNameBg();
    this.container.addChild(this.nameLabel);

    // Local indicator
    if (isLocal) {
      const dot = new PIXI.Graphics();
      dot.circle(12, -12, 5).fill({ color: 0x44dd88 });
      dot.circle(12, -12, 5).stroke({ color: 0xffffff, width: 1.5 });
      this.container.addChild(dot);
    }
  }

  _drawNameBg() {
    const w = this.nameLabel.width + 10;
    this.nameBg.clear();
    this.nameBg.roundRect(-w / 2, -42, w, 18, 4).fill({ color: 0x000000, alpha: 0.5 });
  }

  // Smooth lerp toward target position
  tick() {
    const speed = this.isLocal ? 1 : 0.15;
    this.container.x += (this.targetX - this.container.x) * speed;
    this.container.y += (this.targetY - this.container.y) * speed;
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  setPosition(x, y) {
    this.targetX = x;
    this.targetY = y;
    this.container.x = x;
    this.container.y = y;
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
