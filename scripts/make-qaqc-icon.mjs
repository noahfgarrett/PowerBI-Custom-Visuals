#!/usr/bin/env node
// Usage: node scripts/make-qaqc-icon.mjs <outputPng> <shape>
// Writes a 20x20 QAQC icon (accent color #2E5AAC) for the named shape.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZE = 20;
const SAMPLES = 4;
const COLOR = [0x2e, 0x5a, 0xac];

function regularPolygon(cx, cy, radius, sides, rotation) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

// The top half of an ellipse standing on the line y = cy, from the left (or minX) round to the right edge.
function shoulders(cx, cy, rx, ry, minX = -Infinity) {
  const points = [];
  for (let i = 0; i <= 32; i++) {
    const angle = Math.PI + (i * Math.PI) / 32;
    const x = cx + rx * Math.cos(angle);
    if (x >= minX) points.push([x, cy + ry * Math.sin(angle)]);
  }
  if (minX > cx - rx) points.unshift([minX, cy]);
  return points;
}

// A rectangle from (x0, y0) to (x1, y1) with its corners rounded to `radius`.
function roundedRect(x0, y0, x1, y1, radius) {
  const corners = [
    [x1 - radius, y0 + radius, -Math.PI / 2],
    [x1 - radius, y1 - radius, 0],
    [x0 + radius, y1 - radius, Math.PI / 2],
    [x0 + radius, y0 + radius, Math.PI],
  ];
  return corners.flatMap(([cx, cy, start]) =>
    Array.from({ length: 9 }, (_, i) => {
      const angle = start + (i * Math.PI) / 16;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    }),
  );
}

// Polygon lists on the 24x24 grid. A point is filled when it is inside an odd number of polygons
// (even-odd fill), which lets a later polygon cut a hole in an earlier one.
const SHAPES = {
  zap: [[[13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10]]],
  flame: [[[12, 2], [16.5, 7.5], [19, 12], [19, 16], [16, 21], [12, 22], [8, 21], [5, 16], [5, 12], [8, 9], [9.5, 12], [12, 7]]],
  'hex-nut': [regularPolygon(12, 12, 10.5, 6, Math.PI / 6), regularPolygon(12, 12, 4.2, 20, 0)],
  // A disc with an exclamation mark (a tapered bar over a dot) cut out.
  alert: [
    regularPolygon(12, 12, 10.5, 48, 0),
    [[10.4, 5.2], [13.6, 5.2], [13, 13.4], [11, 13.4]],
    regularPolygon(12, 17, 1.7, 20, 0),
  ],
  // Two heads and shoulders, one in front of the other. The back person stops short of the front one, so the
  // even-odd fill never cuts the overlap out.
  people: [
    regularPolygon(9, 7.6, 3.9, 40, 0),
    shoulders(9, 21, 6.6, 8),
    regularPolygon(17.2, 6.9, 2.9, 40, 0),
    shoulders(17.6, 20, 4.9, 7, 17.4),
  ],
  // A rounded square split into four panels, like lucide LayoutDashboard: a tall and a short panel on the left,
  // a short and a tall one on the right.
  dashboard: [
    roundedRect(2, 2, 10.6, 13.2, 1.8),
    roundedRect(2, 15.4, 10.6, 22, 1.8),
    roundedRect(13.4, 2, 22, 8.6, 1.8),
    roundedRect(13.4, 10.8, 22, 22, 1.8),
  ],
};

const [outputArg, shapeName] = process.argv.slice(2);
if (!outputArg || !shapeName || !Object.hasOwn(SHAPES, shapeName)) {
  console.error(`[icon] usage: node scripts/make-qaqc-icon.mjs <outputPng> <${Object.keys(SHAPES).join('|')}>`);
  process.exit(1);
}
const POLYGONS = SHAPES[shapeName];

function insidePolygon(polygon, x, y) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function inside(x, y) {
  return POLYGONS.reduce((hit, polygon) => hit !== insidePolygon(polygon, x, y), false);
}

const scale = 24 / SIZE;
const stride = SIZE * 4 + 1;
const raw = Buffer.alloc(SIZE * stride);
for (let py = 0; py < SIZE; py++) {
  raw[py * stride] = 0;
  for (let px = 0; px < SIZE; px++) {
    let covered = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        if (inside((px + (sx + 0.5) / SAMPLES) * scale, (py + (sy + 0.5) / SAMPLES) * scale)) covered++;
      }
    }
    const offset = py * stride + 1 + px * 4;
    raw[offset] = COLOR[0];
    raw[offset + 1] = COLOR[1];
    raw[offset + 2] = COLOR[2];
    raw[offset + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
  }
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = path.resolve(process.cwd(), outputArg);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, png);
console.log(`[icon] wrote ${path.relative(process.cwd(), target)}`);
