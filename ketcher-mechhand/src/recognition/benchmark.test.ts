/**
 * Recognition benchmark: every mechanism template is rendered as synthetic
 * handwriting (several hand styles), recognized, and compared with the original.
 *
 *   npm test                                   → asserts minimum accuracies
 *   MECHAND_BENCH_OUT=bench.json npm test      → also writes the per-template table
 */

import { describe, expect, it } from 'vitest';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { type Score, compareScenes } from './compare';
import { buildModel } from './model';
import { recognizeSketch } from './sketch';
import { synthesizeSketch } from './synth';

const model = buildModel();
const STYLES = [
  { seed: 11, inStrokeHeads: false },
  { seed: 23, inStrokeHeads: true },
  { seed: 37, inStrokeHeads: false },
  // Heads the geometric rules alone miss (read by the arrowhead model).
  { seed: 51, headStyle: 'triangle' as const },
  { seed: 63, headStyle: 'two-barbs' as const },
];

describe('recognition benchmark on the mechanism templates', () => {
  it('has templates to test', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it('recognizes synthetic handwriting of every template', { timeout: 300_000 }, async () => {
    const rows: { id: string; atoms: number; bonds: number; arrows: number; exact: number }[] = [];
    for (const t of TEMPLATES) {
      const ref = ketToScene(t.ket);
      const scores = STYLES.map((style) => compareScenes(ref, recognizeSketch(synthesizeSketch(ref, style), model.recognizer, { heads: model.heads, style: model.style }).scene));
      const avg = (k: keyof Omit<Score, 'exact'>) => scores.reduce((a, s) => a + s[k], 0) / scores.length;
      rows.push({ id: t.id, atoms: avg('atoms'), bonds: avg('bonds'), arrows: avg('arrows'), exact: scores.filter((s) => s.exact).length / scores.length });
    }
    const mean = (k: 'atoms' | 'bonds' | 'arrows' | 'exact') => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    const summary = { atoms: mean('atoms'), bonds: mean('bonds'), arrows: mean('arrows'), exact: mean('exact') };
    const out = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.MECHAND_BENCH_OUT;
    if (out) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(out, JSON.stringify({ styles: STYLES.length, summary, rows }, null, 2));
    }
    // Regression thresholds, just below the current results (2026-11-09, five hand
    // styles including triangle and two-stroke heads: atoms 0.86, bonds 0.84,
    // arrows 1.00, exact 0.29). Raise them as the recognizer improves.
    expect(summary.atoms).toBeGreaterThan(0.85);
    expect(summary.bonds).toBeGreaterThan(0.83);
    expect(summary.arrows).toBeGreaterThan(0.97);
    expect(summary.exact).toBeGreaterThan(0.25);
  });
});
