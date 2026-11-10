import { describe, it } from 'vitest';
import { buildModel } from '../recognition/model';
import { pathLength, straightness } from '../recognition/geometry';
import { recognizeSketch } from '../recognition/sketch';
import { synthesizeSketch } from '../recognition/synth';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { rasterizeStrokes } from './rasterize';
import { vectorize } from './vectorize';
const model = buildModel();
describe('stroke probe', () => {
  it('prints', () => {
    const t = TEMPLATES.find((x) => x.id === 'diels_alder')!;
    const syn = synthesizeSketch(ketToScene(t.ket), { seed: 11 });
    const live = recognizeSketch(syn, model.recognizer, { heads: model.heads, style: model.style });
    console.log('pen: strokes', syn.length, 'L', live.scalePx.toFixed(1), 'pts/stroke', (syn.reduce((a, s) => a + s.points.length, 0) / syn.length).toFixed(1));
    const img = rasterizeStrokes(syn.map((s) => s.points), { width: 3 });
    const v = vectorize(img.data, img.width, img.height);
    const r = recognizeSketch(v.strokes, model.recognizer, { heads: model.heads, style: model.style, defaultBondPx: v.bondPx });
    console.log('img: strokes', v.strokes.length, 'L', r.scalePx.toFixed(1), 'L0', v.bondPx.toFixed(1));
    v.strokes.forEach((s, i) => {
      const p = s.points;
      if (p.length < 2 || pathLength(p) < 15) return;
      console.log(i, r.roles[i], 'n', p.length, 'len', pathLength(p).toFixed(0), 'straight', straightness(p).toFixed(2), 'gap', Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y).toFixed(0));
    });
  });
});
