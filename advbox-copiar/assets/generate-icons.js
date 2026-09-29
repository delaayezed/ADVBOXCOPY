// Generates the raster variants from the same simple clipboard/check concept.
// Run with: node assets/generate-icons.js (from the extension folder)
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const crc32 = (data) => { let c = -1; for (const b of data) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 0); return Buffer.concat([head, data, tail]); };
function icon(size) {
  const scale = size / 128, px = new Uint8Array(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => { if (x >= 0 && y >= 0 && x < size && y < size) { const i = (y * size + x) * 4; px.set([r, g, b, a], i); } };
  const rect = (x, y, w, h, color, radius = 0) => { for (let iy = Math.floor(y * scale); iy < Math.ceil((y + h) * scale); iy++) for (let ix = Math.floor(x * scale); ix < Math.ceil((x + w) * scale); ix++) { const X = ix / scale, Y = iy / scale; const dx = Math.max(x - X, 0, X - (x + w)); const dy = Math.max(y - Y, 0, Y - (y + h)); if (dx * dx + dy * dy <= radius * radius) set(ix, iy, ...color); } };
  const circle = (cx, cy, r, color) => { for (let y = Math.floor((cy - r) * scale); y <= Math.ceil((cy + r) * scale); y++) for (let x = Math.floor((cx - r) * scale); x <= Math.ceil((cx + r) * scale); x++) { const dx = x / scale - cx, dy = y / scale - cy; if (dx * dx + dy * dy <= r * r) set(x, y, ...color); } };
  const line = (x1, y1, x2, y2, width, color) => { const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const X = x / scale, Y = y / scale; const t = Math.max(0, Math.min(1, ((X - x1) * dx + (Y - y1) * dy) / (len * len))); if (Math.hypot(X - (x1 + t * dx), Y - (y1 + t * dy)) <= width / 2) set(x, y, ...color); } };
  rect(0, 0, 128, 128, [18, 61, 114, 255], 28); rect(30, 30, 63, 71, [255, 255, 255, 255], 8); rect(48, 26, 27, 15, [220, 236, 255, 255], 3); line(45, 57, 78, 57, 6, [92, 117, 149, 255]); line(45, 73, 70, 73, 6, [92, 117, 149, 255]); circle(91, 91, 23, [39, 166, 91, 255]); line(80, 91, 87, 98, 6, [255, 255, 255, 255]); line(87, 98, 102, 81, 6, [255, 255, 255, 255]);
  const raw = Buffer.alloc((size * 4 + 1) * size); for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1); }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'binary'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const directory = path.dirname(fileURLToPath(import.meta.url));
for (const size of [16, 32, 48, 128]) fs.writeFileSync(path.join(directory, `icon-${size}.png`), icon(size));
