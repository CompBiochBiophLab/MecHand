/**
 * Smoke test of image import: one template drawn as synthetic handwriting is rasterised and
 * read back. The full accuracy benchmark is image.benchmark.test.ts (run on demand).
 */
import { describe, expect, it } from 'vitest';
import { buildModel } from '../recognition/model';
import { synthesizeSketch } from '../recognition/synth';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { rasterizeStrokes } from './rasterize';
import { recognizeImage } from './recognizeImage';

describe('image import', () => {
  it('reads atoms and bonds back from a drawn template', { timeout: 60_000 }, () => {
    const model = buildModel();
    const smallest = [...TEMPLATES].sort((a, b) => ketToScene(a.ket).atoms.length - ketToScene(b.ket).atoms.length)[0];
    const ref = ketToScene(smallest.ket);
    const strokes = synthesizeSketch(ref, { seed: 11, inStrokeHeads: false });
    const img = rasterizeStrokes(strokes.map((s) => s.points), { width: 3 });
    const r = recognizeImage(img.data, img.width, img.height, model.recognizer, { heads: model.heads, style: model.style });
    expect(r.vector.strokes.length).toBeGreaterThan(0);
    expect(r.result.scene.atoms.length).toBeGreaterThan(0);
    expect(r.result.scene.bonds.length).toBeGreaterThan(0);
  });
});
