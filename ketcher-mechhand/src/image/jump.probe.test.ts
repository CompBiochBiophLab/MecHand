import { describe, it } from 'vitest';
import { synthesizeSketch } from '../recognition/synth';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { binarize, inkFromRGBA, thin, removeSpecks, fillSmallHoles } from './bitmap';
import { rasterizeStrokes } from './rasterize';
import { traceSkeleton, pruneAndJoin, joinContinuations } from './skeletonGraph';
import { vectorize } from './vectorize';
const jumps = (pts: { x: number; y: number }[]) => Math.max(0, ...pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)));
describe('jump probe', () => {
  it('finds jumps', () => {
    const t = TEMPLATES.find((x) => x.id === 'diels_alder')!;
    const img = rasterizeStrokes(synthesizeSketch(ketToScene(t.ket), { seed: 11 }).map((s) => s.points), { width: 3 });
    let mask = binarize(inkFromRGBA(img.data, img.width, img.height));
    mask = fillSmallHoles(removeSpecks(mask, img.width, img.height, 4), img.width, img.height, 6);
    const g = traceSkeleton(thin(mask, img.width, img.height), img.width, img.height);
    console.log('raw edges with jumps', g.edges.filter((e) => jumps(e.points) > 4).map((e) => `${e.a}-${e.b} n=${e.points.length} jump=${jumps(e.points).toFixed(1)}`).join(' | '));
    const p = pruneAndJoin(g, 8);
    console.log('pruned jumps', p.edges.filter((e) => jumps(e.points) > 4).map((e) => `${e.a}-${e.b} n=${e.points.length} jump=${jumps(e.points).toFixed(1)}`).join(' | '));
    const j = joinContinuations(p, 36);
    console.log('joined jumps', j.edges.filter((e) => jumps(e.points) > 4).map((e) => `${e.a}-${e.b} n=${e.points.length} jump=${jumps(e.points).toFixed(1)}`).join(' | '));
    const v = vectorize(img.data, img.width, img.height);
    console.log('vector jumps (after RDP, expected large)', v.strokes.length);
  });
});
