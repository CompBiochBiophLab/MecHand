/** Debug overlay of a real image (skipped unless MECHAND_IMAGE_DEBUG and MECHAND_IMAGE_FILES are set). */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, it } from 'vitest';
import { buildModel } from '../recognition/model';
import { decodePNG, encodePNG } from './png.node';
import { recognizeImage } from './recognizeImage';
const OUT = process.env.MECHAND_IMAGE_DEBUG, FILES = process.env.MECHAND_IMAGE_FILES;
const model = buildModel();
const C = { bond: '#2563eb', arrow: '#dc2626', arrowhead: '#f97316', text: '#059669', dot: '#7c3aed', ignored: '#9ca3af' };
describe.skipIf(!OUT || !FILES)('image overlay', () => {
  it('writes overlays', () => {
    for (const f of FILES!.split(',')) {
      const png = decodePNG(readFileSync(f));
      const r = recognizeImage(png.data, png.width, png.height, model.recognizer, { heads: model.heads, style: model.style });
      const k = r.vector.scale;
      const img = `data:image/png;base64,${encodePNG(png.width, png.height, png.data, 4).toString('base64')}`;
      const lines = r.vector.strokes.map((s, i) => `<polyline points="${s.points.map((p) => `${p.x / k},${p.y / k}`).join(' ')}" stroke="${C[r.result.roles[i]]}" stroke-width="${3 / k}" fill="none" opacity="0.9"/><text x="${s.points[0].x / k}" y="${s.points[0].y / k}" font-size="${10 / k}" fill="#000">${i}${r.result.roles[i][0]}</text>`).join('');
      writeFileSync(`${OUT}/${basename(f, '.png')}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${png.width}" height="${png.height}"><image href="${img}" width="${png.width}" height="${png.height}" opacity="0.3"/>${lines}</svg>`);
    }
  });
});
