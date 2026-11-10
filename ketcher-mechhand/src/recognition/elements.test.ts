import { describe, expect, it } from 'vitest';
import type { Scene } from '../scene/types';
import { type ElementSample, TEACH_BOND_PX, checkElement, cleanElementSamples, headSamples, inkStyle } from './elements';
import { type Pt, prng } from './geometry';
import { buildModel, glyphStrokes } from './model';
import { recognizeSketch } from './sketch';
import { synthesizeSketch } from './synth';

const L = TEACH_BOND_PX;

/**
 * A curved arrow with a separate head: an open "V" of the given half-angle
 * (degrees), or a "filled" head scribbled in one stroke (outline, then back and
 * forth inside it).
 */
function curvedArrow(seed: number, halfAngle: number, head: 'v' | 'filled' = 'v', origin: Pt = { x: 40, y: 200 }): Pt[][] {
  const rand = prng(seed);
  const j = () => (rand() - 0.5) * 1.6;
  const shaft = Array.from({ length: 30 }, (_, k) => {
    const t = (k / 29) * Math.PI * 0.6;
    return { x: origin.x + 1.3 * L * (1 - Math.cos(t)) + j(), y: origin.y - 1.1 * L * Math.sin(t) + j() };
  });
  const tip = shaft[shaft.length - 1], prev = shaft[shaft.length - 4];
  const len = Math.hypot(tip.x - prev.x, tip.y - prev.y);
  const bx = (prev.x - tip.x) / len, by = (prev.y - tip.y) / len;
  const barb = (sign: number, frac = 1) => {
    const a = (sign * halfAngle * frac * Math.PI) / 180;
    return { x: tip.x + (bx * Math.cos(a) - by * Math.sin(a)) * 0.25 * L, y: tip.y + (bx * Math.sin(a) + by * Math.cos(a)) * 0.25 * L };
  };
  const line = (a: Pt, b: Pt) => Array.from({ length: 7 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / 6 + j() * 0.3, y: a.y + ((b.y - a.y) * k) / 6 + j() * 0.3 }));
  const path = (ps: Pt[]) => ps.slice(1).flatMap((p, k) => line(ps[k], p).slice(k ? 1 : 0));
  if (head === 'filled') {
    return [shaft, path([barb(1), tip, barb(-1), barb(1), tip, barb(-0.5), barb(0.5), tip])];
  }
  return [shaft, path([barb(1), tip, barb(-1)])];
}

const kinds = (strokes: Pt[][], model = buildModel()) =>
  recognizeSketch(strokes.map((points) => ({ points })), model.recognizer, { bondPx: L, heads: model.heads, style: model.style })
    .scene.arrows.map((a) => a.kind);

describe('Teach mode for arrows, bonds and electrons', () => {
  it('cuts the head out of an arrow sample, in the shaft frame (behind the tip)', { timeout: 60_000 }, () => {
    const [h] = headSamples({ element: 'arrow-pair', bondPx: L, strokes: curvedArrow(1, 30) });
    expect(h.symbol).toBe('full');
    const xs = h.strokes.flat().map((p) => p.x);
    expect(Math.max(...xs)).toBeLessThan(0.05 * L);
    expect(Math.min(...xs)).toBeLessThan(-0.15 * L);
  });

  it('learns an arrowhead style that the built-in rules and templates miss', { timeout: 60_000 }, () => {
    // Filled heads, scribbled in one stroke.
    const before = buildModel();
    const test = [101, 102, 103].map((seed) => curvedArrow(seed, 30, 'filled'));
    const okBefore = test.filter((s) => kinds(s, before).join() === 'electron-pair').length;
    const taught: ElementSample[] = [1, 2, 3].map((seed) => ({ element: 'arrow-pair', bondPx: L, strokes: curvedArrow(seed, 30, 'filled') }));
    const after = buildModel({ userElements: taught });
    const okAfter = test.filter((s) => kinds(s, after).join() === 'electron-pair').length;
    expect(okBefore).toBeLessThan(test.length);
    expect(okAfter).toBe(test.length);
  });

  it('still reads ordinary heads after learning', { timeout: 60_000 }, () => {
    const taught: ElementSample[] = [1, 2, 3].map((seed) => ({ element: 'arrow-pair', bondPx: L, strokes: curvedArrow(seed, 30, 'filled') }));
    const model = buildModel({ userElements: taught });
    expect(kinds(curvedArrow(7, 28), model)).toEqual(['electron-pair']);
  });

  it('recognizes equilibrium arrows (two antiparallel harpoons)', { timeout: 60_000 }, () => {
    const ethanol = (dx: number) => [
      { symbol: 'C', x: dx - 1.3, y: -0.25, charge: 0, molecule: 0 },
      { symbol: 'C', x: dx - 0.43, y: 0.25, charge: 0, molecule: 0 },
      { symbol: 'O', x: dx + 0.43, y: -0.25, charge: 0, molecule: 0 },
    ];
    const scene: Scene = {
      atoms: [...ethanol(-2), ...ethanol(4)],
      bonds: [{ begin: 0, end: 1, order: 1 }, { begin: 1, end: 2, order: 1 }, { begin: 3, end: 4, order: 1 }, { begin: 4, end: 5, order: 1 }],
      arrows: [{ kind: 'equilibrium', start: { x: -1, y: 0 }, end: { x: 1.6, y: 0 }, mode: 'equilibrium-open-half-angle' }],
      pluses: [],
    };
    const model = buildModel();
    for (const seed of [3, 5, 9]) {
      const r = recognizeSketch(synthesizeSketch(scene, { seed }), model.recognizer, { heads: model.heads });
      expect(r.scene.arrows.map((a) => a.kind)).toEqual(['equilibrium']);
      expect(r.scene.arrows[0].start.x).toBeLessThan(r.scene.arrows[0].end.x); // upper arrow points right
      expect(r.scene.atoms.length).toBe(6);
    }
  });

  it('learns larger dots (lone pairs, radicals) without turning a small minus into a dot', { timeout: 60_000 }, () => {
    const circle = (c: Pt, r: number): Pt[] => Array.from({ length: 13 }, (_, k) => ({
      x: c.x + r * Math.cos((k / 12) * 2 * Math.PI), y: c.y + r * Math.sin((k / 12) * 2 * Math.PI),
    }));
    const O = glyphStrokes('O').map((s) => s.map((p) => ({ x: 100 + (p.x - 0.5) * 0.3 * L, y: 100 + (p.y - 0.5) * 0.38 * L })));
    const dot = circle({ x: 100 + 0.3 * L, y: 100 - 0.2 * L }, 0.05 * L); // radical drawn as a small ring
    const model = buildModel();
    const run = (strokes: Pt[][], style = model.style) =>
      recognizeSketch(strokes.map((points) => ({ points })), model.recognizer, { bondPx: L, style });
    expect(run([...O, dot]).scene.atoms.some((a) => a.radical === 2)).toBe(false);
    const style = inkStyle([{ element: 'radical', bondPx: L, strokes: [circle({ x: 0, y: 0 }, 0.05 * L)] }]);
    const r = run([...O, dot], style);
    expect(r.scene.atoms.map((a) => [a.symbol, a.radical])).toEqual([['O', 2]]);
    // A short minus at the same size stays a charge.
    const minus = [{ x: 100 + 0.25 * L, y: 100 - 0.2 * L }, { x: 100 + 0.37 * L, y: 100 - 0.2 * L }];
    expect(run([...O, minus], style).scene.atoms.map((a) => [a.symbol, a.charge])).toEqual([['O', -1]]);
  });

  it('checks what was read for each element', { timeout: 60_000 }, () => {
    const model = buildModel();
    const bond = [[{ x: 50, y: 100 }, { x: 50 + L, y: 100 }], [{ x: 55, y: 110 }, { x: 45 + L, y: 110 }]];
    const r = recognizeSketch(bond.map((points) => ({ points })), model.recognizer, { bondPx: L });
    expect(checkElement('bond-double', r)).toMatchObject({ ok: true, read: 'double bond', parts: [{ key: 'bond-2', count: 1 }] });
    expect(checkElement('bond-single', r).ok).toBe(false);
  });

  it('keeps only the element, the scale and x, y points of imported samples', () => {
    const dirty = [{ element: 'radical', bondPx: 70, device: 'iPad', name: 'Jo', strokes: [[{ x: 1, y: 2, t: 5, pressure: 0.4 }]] }, { element: 'nope', strokes: [] }];
    expect(cleanElementSamples(dirty)).toEqual([{ element: 'radical', bondPx: 70, strokes: [[{ x: 1, y: 2 }]] }]);
  });
});
