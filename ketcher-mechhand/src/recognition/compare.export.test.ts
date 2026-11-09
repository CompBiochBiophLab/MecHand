/**
 * Dataset for the comparison with an image-based recognizer (DECIMER): every
 * molecule (connected component with ≥ 2 atoms) of every template, drawn as
 * synthetic handwriting in three styles, with MecHand's own recognition of it.
 * Skipped unless MECHAND_COMPARE_OUT is set; analysed by
 * scripts/compare_decimer.py.
 */
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { ketToScene } from '../scene/ketToScene';
import type { Scene } from '../scene/types';
import { TEMPLATES } from '../templates/catalog';
import { buildModel } from './model';
import { recognizeSketch } from './sketch';
import { synthesizeSketch } from './synth';

const OUT = process.env.MECHAND_COMPARE_OUT;
const FIGURE_OUT = process.env.MECHAND_FIGURE_OUT;
const STYLES = [{ seed: 11 }, { seed: 23 }, { seed: 37 }];

function component(scene: Scene, m: number): Scene {
  const idx = scene.atoms.map((a, i) => (a.molecule === m ? i : -1)).filter((i) => i >= 0);
  const map = new Map(idx.map((old, i) => [old, i]));
  return {
    atoms: idx.map((i) => ({ ...scene.atoms[i], molecule: 0 })),
    bonds: scene.bonds.filter((b) => map.has(b.begin) && map.has(b.end)).map((b) => ({ ...b, begin: map.get(b.begin)!, end: map.get(b.end)! })),
    arrows: [],
    pluses: [],
  };
}

describe.skipIf(!OUT)('comparison dataset', () => {
  it('writes molecules, strokes and MecHand results', { timeout: 600_000 }, () => {
    const model = buildModel();
    const items: unknown[] = [];
    for (const t of TEMPLATES) {
      const scene = ketToScene(t.ket);
      const molecules = [...new Set(scene.atoms.map((a) => a.molecule))];
      for (const m of molecules) {
        const ref = component(scene, m);
        if (ref.atoms.length < 2) continue;
        STYLES.forEach((style) => {
          const strokes = synthesizeSketch(ref, style);
          const t0 = performance.now();
          const got = recognizeSketch(strokes, model.recognizer).scene;
          const ms = performance.now() - t0;
          items.push({ template: t.id, category: t.category, molecule: m, seed: style.seed, ref, got, ms, strokes: strokes.map((s) => s.points) });
        });
      }
    }
    writeFileSync(OUT!, JSON.stringify(items));
  });
});

/** Strokes, stroke roles and the recognized scene of one template (manuscript figure). */
describe.skipIf(!FIGURE_OUT)('figure dataset', () => {
  it('writes the E2 template drawn by hand and its interpretation', () => {
    const t = TEMPLATES.find((x) => x.id === 'e2')!;
    const ref = ketToScene(t.ket);
    const strokes = synthesizeSketch(ref, { seed: 11 });
    const r = recognizeSketch(strokes, buildModel().recognizer);
    writeFileSync(FIGURE_OUT!, JSON.stringify({ strokes: strokes.map((s) => s.points), roles: r.roles, scene: r.scene, labels: r.labels }));
  });
});
