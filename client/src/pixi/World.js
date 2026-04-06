import * as PIXI from 'pixi.js';

export const WORLD_W = 2400;
export const WORLD_H = 1800;
const TILE_SIZE = 48;

// Color palette per room name
const ROOM_COLORS = {
  'MERN Stack':        0xf5e6c8,
  'UI/UX':             0xd6eaf8,
  'Ethical Hacking':   0xfde8e8,
  'DSA':               0xe8f5e9,
  'Flutter':           0xfff3cd,
  'Financial Modeling':0xf0e6ff,
  'Data Analytics':    0xe0f7fa,
  'Python':            0xfff9e6,
  'Dev Club':          0xfce4ec,
  'Graphic AI Club':   0xe8eaf6,
};
const FALLBACK_COLORS = [0xf5e6c8, 0xd6eaf8, 0xfde8e8, 0xe8f5e9, 0xfff3cd, 0xf0e6ff, 0xe0f7fa, 0xfff9e6];

// Layout rooms in a grid automatically based on count
function layoutRooms(roomNames) {
  const COLS = 3;
  const COL_W = 280;
  const ROW_H = 240;
  const GAP_X = 40;
  const GAP_Y = 40;
  const START_X = 100;
  const START_Y = 100;

  return roomNames.map((label, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      x: START_X + col * (COL_W + GAP_X),
      y: START_Y + row * (ROW_H + GAP_Y),
      w: COL_W,
      h: ROW_H,
      label,
      color: ROOM_COLORS[label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    };
  });
}

export function buildWorld(container, roomNames) {
  const rooms = layoutRooms(roomNames && roomNames.length ? roomNames : Object.keys(ROOM_COLORS));

  // Floor tiles
  const floor = new PIXI.Graphics();
  for (let tx = 0; tx < WORLD_W; tx += TILE_SIZE) {
    for (let ty = 0; ty < WORLD_H; ty += TILE_SIZE) {
      const even = ((tx / TILE_SIZE) + (ty / TILE_SIZE)) % 2 === 0;
      floor.rect(tx, ty, TILE_SIZE, TILE_SIZE).fill({ color: even ? 0xe8dcc8 : 0xddd0b8 });
    }
  }
  container.addChild(floor);

  // Border + trees
  const border = new PIXI.Graphics();
  border.rect(0, 0, WORLD_W, WORLD_H).stroke({ color: 0x5a4a30, width: 4 });
  for (let tx = 0; tx < WORLD_W; tx += 48) {
    drawTree(border, tx, 0);
    drawTree(border, tx, WORLD_H - 32);
  }
  for (let ty = 48; ty < WORLD_H - 48; ty += 48) {
    drawTree(border, 0, ty);
    drawTree(border, WORLD_W - 32, ty);
  }
  container.addChild(border);

  // Rooms
  for (const room of rooms) {
    drawRoom(container, room);
  }

  return rooms;
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

  const text = new PIXI.Text({
    text: label,
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: '600', fill: 0x4a3a20 },
  });
  text.x = x + w / 2 - text.width / 2;
  text.y = y + 10;
  container.addChild(text);

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
      desk.rect(dx, dy, 38, 28).fill({ color: 0xc8a87a });
      desk.rect(dx, dy, 38, 28).stroke({ color: 0x8a6a40, width: 1 });
      desk.rect(dx + 8, dy - 12, 22, 14).fill({ color: 0x2a2a3a });
      desk.rect(dx + 17, dy - 1, 4, 3).fill({ color: 0x2a2a3a });
      desk.circle(dx + 19, dy + 38, 10).fill({ color: 0x6a7a8a });
      container.addChild(desk);
    }
  }
}
