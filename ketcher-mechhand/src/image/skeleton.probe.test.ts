import { describe, it } from 'vitest';
import { binarize, inkFromRGBA, thin } from './bitmap';
import { blank, drawPolyline } from './rasterize';
import { joinContinuations, pruneAndJoin, traceSkeleton } from './skeletonGraph';
describe('probe', () => {
  it('hexagon with inner double bond', () => {
    const hex = Array.from({ length: 7 }, (_, k) => ({ x: 60 + 40 * Math.cos((k / 6) * 2 * Math.PI + Math.PI / 6), y: 60 + 40 * Math.sin((k / 6) * 2 * Math.PI + Math.PI / 6) }));
    const img = blank(120, 120);
    drawPolyline(img, hex, 3);
    drawPolyline(img, [{ x: hex[0].x - 6, y: hex[0].y - 3 }, { x: hex[1].x - 3, y: hex[1].y - 6 }], 3);
    const mask = binarize(inkFromRGBA(img.data, 120, 120));
    const sk = thin(mask, 120, 120);
    const g = traceSkeleton(sk, 120, 120);
    console.log('nodes', g.nodes.map((n) => `${n.x.toFixed(0)},${n.y.toFixed(0)}`).join(' '));
    console.log('edges', g.edges.map((e) => `${e.a}-${e.b}:${e.points.length}[${e.points[0].x.toFixed(0)},${e.points[0].y.toFixed(0)}→${e.points[e.points.length - 1].x.toFixed(0)},${e.points[e.points.length - 1].y.toFixed(0)}]`).join(' '));
    const p = joinContinuations(pruneAndJoin(g, 8), 40);
    console.log('final', p.edges.map((e) => `${e.a}-${e.b}:${e.points.length}`).join(' '));
    let maxJump = 0;
    for (const e of p.edges) for (let i = 1; i < e.points.length; i++) maxJump = Math.max(maxJump, Math.hypot(e.points[i].x - e.points[i - 1].x, e.points[i].y - e.points[i - 1].y));
    console.log('max jump', maxJump.toFixed(1));
  });
});
