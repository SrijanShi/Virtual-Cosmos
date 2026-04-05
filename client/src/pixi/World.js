import * as PIXI from 'pixi.js';

const WORLD_W = 2400;
const WORLD_H = 1800;
const TILE_SIZE = 48;

const ROOMS = [
  { x: 100,  y: 100,  w: 320, h: 240, label: 'MERN STACK',        color: 0xf5e6c8 },
  { x: 460,  y: 100,  w: 260, h: 240, label: 'UI/UX',             color: 0xd6eaf8 },
  { x: 760,  y: 100,  w: 280, h: 240, label: 'ETHICAL HACKING',   color: 0xfde8e8 },
  { x: 100,  y: 380,  w: 200, h: 220, label: 'DSA',               color: 0xe8f5e9 },
  { x: 340,  y: 380,  w: 240, h: 220, label: 'Flutter',           color: 0xfff3cd },
  { x: 620,  y: 380,  w: 240, h: 220, label: 'Financial Modeling', color: 0xf0e6ff },
  { x: 900,  y: 380,  w: 240, h: 220, label: 'Data Analytics',    color: 0xe0f7fa },
  { x: 1180, y: 380,  w: 200, h: 220, label: 'Python',            color: 0xfff9e6 },
  { x: 100,  y: 640,  w: 300, h: 220, label: 'Dev Club',          color: 0xfce4ec },
  { x: 440,  y: 640,  w: 260, h: 220, label: 'Graphic AI Club',   color: 0xe8eaf6 },
];

export function buildWorld(container) {
  // Draw floor tiles
  const floor = new PIXI.Graphics();
  for (let tx = 0; tx < WORLD_W; tx += TILE_SIZE) {
    for (let ty = 0; ty < WORLD_H; ty += TILE_SIZE) {
      const even = ((tx / TILE_SIZE) + (ty / TILE_SIZE)) % 2 === 0;
      floor.rect(tx, ty, TILE_SIZE, TILE_SIZE).fill({ color: even ? 0xe8dcc8 : 0xddd0b8 });
    }
  }
  container.addChild(floor);

  // Draw border
  const border = new PIXI.Graphics();
  border.rect(0, 0, WORLD_W, WORLD_H).stroke({ color: 0x5a4a30, width: 4 });

  // Draw trees / shrubs border decoration (simple green dots)
  for (let tx = 0; tx < WORLD_W; tx += 48) {
    drawTree(border, tx, 0);
    drawTree(border, tx, WORLD_H - 32);
  }
  for (let ty = 48; ty < WORLD_H - 48; ty += 48) {
    drawTree(border, 0, ty);
    drawTree(border, WORLD_W - 32, ty);
  }
  container.addChild(border);

  // Draw rooms
  for (const room of ROOMS) {
    drawRoom(container, room);
  }
}

function drawTree(g, x, y) {
  g.circle(x + 16, y + 16, 14).fill({ color: 0x4a7c4a });
  g.circle(x + 16, y + 16, 10).fill({ color: 0x5a9a5a });
}

function drawRoom(container, { x, y, w, h, label, color }) {
  const g = new PIXI.Graphics();
  g.rect(x, y, w, h).fill({ color, alpha: 0.85 });
  g.rect(x, y, w, h).stroke({ color: 0xa09070, width: 2 });
  container.addChild(g);

  // Label
  const text = new PIXI.Text({
    text: label,
    style: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 13,
      fontWeight: '600',
      fill: 0x4a3a20,
      align: 'center',
    },
  });
  text.x = x + w / 2 - text.width / 2;
  text.y = y + 10;
  container.addChild(text);

  // Desks inside room
  drawDesks(container, x, y, w, h);
}

function drawDesks(container, rx, ry, rw, rh) {
  const cols = Math.floor((rw - 40) / 55);
  const rows = Math.floor((rh - 50) / 55);
  const startX = rx + 20;
  const startY = ry + 38;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = startX + c * 55;
      const dy = startY + r * 55;
      const desk = new PIXI.Graphics();
      // Desk surface
      desk.rect(dx, dy, 38, 28).fill({ color: 0xc8a87a });
      desk.rect(dx, dy, 38, 28).stroke({ color: 0x8a6a40, width: 1 });
      // Monitor
      desk.rect(dx + 8, dy - 12, 22, 14).fill({ color: 0x2a2a3a });
      desk.rect(dx + 17, dy - 1, 4, 3).fill({ color: 0x2a2a3a });
      // Chair
      desk.circle(dx + 19, dy + 38, 10).fill({ color: 0x6a7a8a });
      container.addChild(desk);
    }
  }
}

export { ROOMS, WORLD_W, WORLD_H };
