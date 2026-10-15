#!/usr/bin/env node
// Writes assets/icon.png: a 20x20 lucide Zap mark in the QAQC accent color (#2E5AAC).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SIZE = 20;
const SAMPLES = 4;
const COLOR = [0x2e, 0x5a, 0xac];
// lucide "zap" polygon on its 24x24 grid
const POLYGON = [[13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10]];

function inside(x, y) {
  let hit = false;
  for (let i = 0, j = POLYGON.length - 1; i < POLYGON.length; j = i++) {
    const [xi, yi] = POLYGON[i];
    const [xj, yj] = POLYGON[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
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

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, png);
console.log(`[icon] wrote ${path.relative(process.cwd(), target)}`);
