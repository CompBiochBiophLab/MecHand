/**
 * Image recognition benchmark: synthetic handwriting of every mechanism template is
 * drawn into an image (pen-like strokes), read back with recognizeImage and compared
 * with the template, as the stroke benchmark does for live ink. It takes minutes, so it is
 * skipped unless asked for:
 *   MECHAND_IMAGE_BENCH=out.json npx vitest run src/image/image.benchmark.test.ts   → writes the table
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareScenes } from '../recognition/compare';
import { buildModel } from '../recognition/model';
import { recognizeSketch } from '../recognition/sketch';
import { synthesizeSketch } from '../recognition/synth';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { recognizeImage } from './recognizeImage';
import { rasterizeStrokes } from './rasterize';

const model = buildModel();
const STYLES = [{ seed: 11, inStrokeHeads: false }, { seed: 37, inStrokeHeads: false }, { seed: 63, headStyle: 'two-barbs' as const }];

describe.skipIf(!process.env.MECHAND_IMAGE_BENCH)('image recognition of synthetic handwriting', () => {
  it('reads the templates drawn as images', { timeout: 600_000 }, () => {
    const rows: { id: string; ink: number; image: number; atoms: number; bonds: number; arrows: number; exact: number }[] = [];
    for (const t of TEMPLATES) {
      const ref = ketToScene(t.ket);
      let ink = 0, image = 0, atoms = 0, bonds = 0, arrows = 0, exact = 0;
      for (const style of STYLES) {
        const strokes = synthesizeSketch(ref, style);
        const live = compareScenes(ref, recognizeSketch(strokes, model.recognizer, { heads: model.heads, style: model.style }).scene);
        const img = rasterizeStrokes(strokes.map((s) => s.points), { width: 3 });
        const r = recognizeImage(img.data, img.width, img.height, model.recognizer, { heads: model.heads, style: model.style });
        const sc = compareScenes(ref, r.result.scene);
        ink += live.exact ? 1 : 0;
        image += sc.exact ? 1 : 0;
        atoms += sc.atoms; bonds += sc.bonds; arrows += sc.arrows; exact += sc.exact ? 1 : 0;
      }
      const n = STYLES.length;
      rows.push({ id: t.id, ink: ink / n, image: image / n, atoms: atoms / n, bonds: bonds / n, arrows: arrows / n, exact: exact / n });
    }
    const mean = (k: 'atoms' | 'bonds' | 'arrows' | 'exact' | 'ink') => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    if (process.env.MECHAND_IMAGE_BENCH) {
      writeFileSync(process.env.MECHAND_IMAGE_BENCH, JSON.stringify({ rows, mean: { atoms: mean('atoms'), bonds: mean('bonds'), arrows: mean('arrows'), exact: mean('exact'), inkExact: mean('ink') } }, null, 1));
    }
    expect(mean('atoms')).toBeGreaterThan(0);
  });
});
