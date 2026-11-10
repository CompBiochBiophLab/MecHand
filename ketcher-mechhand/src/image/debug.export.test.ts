/** Debug picture of the vectorization (skipped unless MECHAND_IMAGE_DEBUG=<folder>). */
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { buildModel } from '../recognition/model';
import { synthesizeSketch } from '../recognition/synth';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { recognizeImage } from './recognizeImage';
import { rasterizeStrokes } from './rasterize';

const OUT = process.env.MECHAND_IMAGE_DEBUG;
const model = buildModel();
const COLOURS = { bond: '#2563eb', arrow: '#dc2626', arrowhead: '#f97316', text: '#059669', dot: '#7c3aed', ignored: '#9ca3af' };

describe.skipIf(!OUT)('image debug', () => {
  it('writes SVGs', () => {
    for (const id of (process.env.MECHAND_IMAGE_IDS ?? 'sn2').split(',')) {
      const t = TEMPLATES.find((x) => x.id === id)!;
      const strokes = synthesizeSketch(ketToScene(t.ket), { seed: 11 });
      const img = rasterizeStrokes(strokes.map((s) => s.points), { width: 3 });
      const r = recognizeImage(img.data, img.width, img.height, model.recognizer, { heads: model.heads, style: model.style });
      const minX = Math.min(...strokes.flatMap((s) => s.points.map((p) => p.x))), minY = Math.min(...strokes.flatMap((s) => s.points.map((p) => p.y)));
      const orig = strokes.map((s) => `<polyline points="${s.points.map((p) => `${p.x - minX + 20},${p.y - minY + 20}`).join(' ')}" stroke="#ddd" stroke-width="6" fill="none"/>`).join('');
      const vec = r.vector.strokes.map((s, i) => `<polyline points="${s.points.map((p) => `${p.x},${p.y}`).join(' ')}" stroke="${COLOURS[r.result.roles[i]]}" stroke-width="1.5" fill="none"/><text x="${s.points[0].x}" y="${s.points[0].y}" font-size="7">${i}</text>`).join('');
      writeFileSync(`${OUT}/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width * 2}" height="${img.height * 2}" viewBox="0 0 ${img.width} ${img.height}"><rect width="100%" height="100%" fill="white"/>${orig}${vec}</svg>`);
      writeFileSync(`${OUT}/${id}.json`, JSON.stringify({ found: r.vector.found, sw: r.vector.strokeWidth, L0: r.vector.bondPx, strokes: r.vector.strokes.length, roles: r.result.roles, scene: { atoms: r.result.scene.atoms.length, bonds: r.result.scene.bonds.length, arrows: r.result.scene.arrows.length } }));
    }
  });
});
