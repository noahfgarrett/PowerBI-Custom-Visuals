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
