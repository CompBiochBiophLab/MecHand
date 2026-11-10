import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { decodePNG } from './png.node';
import { vectorize } from './vectorize';
describe('glyph probe', () => {
  it('glyphs', () => {
    const png = decodePNG(readFileSync(`public/study/${process.env.F ?? 'A1-paracetamol'}.png`));
    const v = vectorize(png.data, png.width, png.height);
    const by = new Map<number, number[]>();
    v.glyphs.forEach((g, i) => by.set(g, [...(by.get(g) ?? []), i]));
    console.log('L0', v.bondPx.toFixed(1), 'sw', v.strokeWidth.toFixed(1), 'scale', v.scale.toFixed(3), v.width, v.height);
    for (const [g, ids] of by) {
      const xs = ids.flatMap((i) => v.strokes[i].points.map((p) => p.x)), ys = ids.flatMap((i) => v.strokes[i].points.map((p) => p.y));
      const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (g === 1 || g === 2) for (const i of ids) console.log('  s', i, JSON.stringify(v.strokes[i].points.map((p) => [Math.round(p.x), Math.round(p.y)])));
      console.log('g', g, 'n', ids.length, 'side/L0', (side / v.bondPx).toFixed(2), 'at', Math.min(...xs).toFixed(0), Math.min(...ys).toFixed(0), 'char', v.charLike[ids[0]]);
    }
  });
});
