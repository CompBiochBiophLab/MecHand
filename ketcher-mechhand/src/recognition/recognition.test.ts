import { describe, expect, it } from 'vitest';
import type { Scene } from '../scene/types';
import { prng } from './geometry';
import { checkMechanism } from './mechanismCheck';
import { MODEL_SYMBOLS, augment, buildModel, glyphStrokes, glyphVariantCount } from './model';
import { recognizeSketch } from './sketch';
import { synthesizeSketch } from './synth';

const model = buildModel();

describe('$P symbol model', () => {
  it('recognizes unseen variations of every glyph', () => {
    const rand = prng(12345);
    let ok = 0, total = 0;
    const errors: string[] = [];
    for (const symbol of MODEL_SYMBOLS) {
      for (let v = 0; v < glyphVariantCount(symbol); v++) {
        for (let k = 0; k < 4; k++) {
          const strokes = augment(glyphStrokes(symbol, v), rand, 0.8);
          const best = model.recognizer.classify(strokes, 1)[0];
          total++;
          if (best?.symbol === symbol) ok++;
          else errors.push(`${symbol}→${best?.symbol}`);
        }
      }
    }
    expect(ok / total, errors.join(' ')).toBeGreaterThan(0.9);
  });
});

const ethanol: Scene = {
  atoms: [
    { symbol: 'C', x: -1.3, y: -0.25, charge: 0, molecule: 0 },
    { symbol: 'C', x: -0.43, y: 0.25, charge: 0, molecule: 0 },
    { symbol: 'O', x: 0.43, y: -0.25, charge: 0, molecule: 0 },
  ],
  bonds: [{ begin: 0, end: 1, order: 1 }, { begin: 1, end: 2, order: 1 }],
  arrows: [],
  pluses: [],
};

const acetone: Scene = {
  atoms: [
    { symbol: 'C', x: -0.87, y: -0.5, charge: 0, molecule: 0 },
    { symbol: 'C', x: 0, y: 0, charge: 0, molecule: 0 },
    { symbol: 'C', x: 0.87, y: -0.5, charge: 0, molecule: 0 },
    { symbol: 'O', x: 0, y: 1, charge: 0, molecule: 0 },
  ],
  bonds: [
    { begin: 0, end: 1, order: 1 }, { begin: 1, end: 2, order: 1 }, { begin: 1, end: 3, order: 2 },
  ],
  arrows: [],
  pluses: [],
};

// HO⁻ + CH3–Br → (SN2), with two curved arrows: O lone pair → C, C–Br bond → Br.
const sn2: Scene = {
  atoms: [
    { symbol: 'O', x: -2.4, y: 0, charge: -1, molecule: 0 },
    { symbol: 'C', x: 0, y: 0, charge: 0, molecule: 1 },
    { symbol: 'Br', x: 1, y: 0, charge: 0, molecule: 1 },
  ],
  bonds: [{ begin: 1, end: 2, order: 1 }],
  arrows: [
    { kind: 'electron-pair', start: { x: -2.15, y: 0.15 }, end: { x: -0.3, y: 0.15 }, height: 0.6, mode: 'elliptical-arc-arrow-open-angle' },
    { kind: 'electron-pair', start: { x: 0.5, y: -0.15 }, end: { x: 1.15, y: -0.35 }, height: -0.35, mode: 'elliptical-arc-arrow-open-angle' },
  ],
  pluses: [],
};

function summary(s: Scene) {
  return {
    atoms: s.atoms.map((a) => `${a.symbol}${a.charge > 0 ? '+' : a.charge < 0 ? '-' : ''}`).sort(),
    orders: s.bonds.map((b) => b.order).sort(),
    arrows: s.arrows.map((a) => a.kind).sort(),
  };
}

describe('recognizeSketch on synthetic handwriting', () => {
  it.each([1, 2, 3])('ethanol (seed %i)', (seed) => {
    const r = recognizeSketch(synthesizeSketch(ethanol, { seed }), model.recognizer);
    expect(summary(r.scene)).toEqual(summary(ethanol));
    expect(r.bondLengthPx).toBeGreaterThan(40);
  });

  it.each([1, 2, 3])('acetone with a double bond (seed %i)', (seed) => {
    const r = recognizeSketch(synthesizeSketch(acetone, { seed }), model.recognizer);
    expect(summary(r.scene)).toEqual(summary(acetone));
  });

  it.each([
    [1, false], [2, false], [3, true], [4, true],
  ])('SN2 with curved arrows (seed %i, in-stroke heads %s)', (seed, inStrokeHeads) => {
    const r = recognizeSketch(synthesizeSketch(sn2, { seed, inStrokeHeads }), model.recognizer);
    expect(summary(r.scene)).toEqual(summary(sn2));
    // First arrow: from O to C; second: from the C–Br bond to Br.
    const [a1, a2] = r.arrows.slice().sort((p, q) => p.arrow.start.x - q.arrow.start.x);
    expect(a1.from.type).toBe('atom');
    expect(a1.to.type).toBe('atom');
    expect(a2.from.type).toBe('bond');
    expect(Math.sign(a1.arrow.height ?? 0)).toBe(1);
    expect(checkMechanism(r.scene, r.arrows)).toEqual([]);
  });
});

describe('checkMechanism', () => {
  it('flags an arrow that starts at a carbon without lone pairs', () => {
    const scene: Scene = {
      ...sn2,
      arrows: [{ ...sn2.arrows[0], start: { x: 0.1, y: 0.1 }, end: { x: -2.3, y: 0.1 } }],
    };
    const issues = checkMechanism(scene, [
      { arrow: scene.arrows[0], from: { type: 'atom', atom: 1 }, to: { type: 'atom', atom: 0 } },
    ]);
    expect(issues.map((i) => i.message).join()).toMatch(/no lone pair/);
  });
});
