import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { buildModel } from '../recognition/model';
import { decodePNG } from './png.node';
import { recognizeImage } from './recognizeImage';
const model = buildModel();
describe('printed probe', () => {
  it('reads stimuli', () => {
    for (const f of ['A1-paracetamol', 'A2-cafeina', 'B1-dopamina', 'B2-serotonina', 'practica-acid-base', 'A3-sn2-walden', 'B3-sn2-cianur']) {
      const png = decodePNG(readFileSync(`public/study/${f}.png`));
      const t0 = Date.now();
      const r = recognizeImage(png.data, png.width, png.height, model.recognizer, { heads: model.heads, style: model.style });
      const sc = r.result.scene;
      const el: Record<string, number> = {};
      sc.atoms.forEach((a) => { { const k = a.symbol + (a.charge ? (a.charge > 0 ? '+' : '-') : ''); el[k] = (el[k] ?? 0) + 1; } });
      const bo: Record<number, number> = {};
      sc.bonds.forEach((b) => { bo[b.order] = (bo[b.order] ?? 0) + 1; });
      console.log(f, `${png.width}x${png.height}`, `${Date.now() - t0}ms`, 'sw', r.vector.strokeWidth.toFixed(1), 'L0', r.vector.bondPx.toFixed(0), JSON.stringify(el), 'bonds', JSON.stringify(bo),
        'labels', sc.atoms.filter((a) => a.symbol !== 'C' || a.charge).map((a) => a.symbol + (a.charge || '')).join(' '), 'arrows', sc.arrows.map((a) => a.kind).join(','), 'found', JSON.stringify(r.vector.found), 'applied', JSON.stringify(r.applied));
    }
  });
});
