/**
 * Synthetic handwriting: render a Scene as pen strokes with human-like noise.
 * Used by the recognizer tests and the template benchmark (recognize(synth(scene))
 * should give back the scene).
 */

import type { Point, Scene } from '../scene/types';
import { type Pt, prng } from './geometry';
import { augment, glyphStrokes, glyphVariantCount } from './model';
import type { InkStroke } from './sketch';

export interface SynthOptions {
  bondPx?: number;
  seed?: number;
  /** 0 = perfect lines, 1 = typical hand jitter. */
  noise?: number;
  /** Draw arrowheads in the same stroke as the shaft instead of a separate "V". */
  inStrokeHeads?: boolean;
  /**
   * Shape of separate full heads: an open "V" (default), a closed triangle, or
   * two barbs drawn as two strokes (styles the geometric rules alone miss).
   */
  headStyle?: 'v' | 'triangle' | 'two-barbs';
}

/**
 * Drawing conventions of the synthetic hand (documented in the README benchmark):
 * capital letters are LETTER_SIZE bond lengths tall, and bonds stop LABEL_GAP
 * bond lengths before a labelled atom.
 */
export const LETTER_SIZE = 0.32;
export const LABEL_GAP = 0.2;

export function synthesizeSketch(scene: Scene, opts: SynthOptions = {}): InkStroke[] {
  const L = opts.bondPx ?? 60;
  const rand = prng(opts.seed ?? 7);
  const noise = opts.noise ?? 1;
  const toPx = (p: Point): Pt => ({ x: 400 + p.x * L, y: 300 - p.y * L });
  const jitter = (p: Pt, amp = 1.5): Pt => ({ x: p.x + (rand() - 0.5) * 2 * amp * noise, y: p.y + (rand() - 0.5) * 2 * amp * noise });
  const strokes: InkStroke[] = [];

  const line = (a: Pt, b: Pt): InkStroke => {
    const n = 12;
    const bow = (rand() - 0.5) * 0.03 * noise; // slight bow of a hand-drawn line
    const nx = -(b.y - a.y), ny = b.x - a.x;
    return {
      points: Array.from({ length: n + 1 }, (_, k) => {
        const t = k / n;
        const s = Math.sin(Math.PI * t) * bow;
        return jitter({ x: a.x + t * (b.x - a.x) + s * nx, y: a.y + t * (b.y - a.y) + s * ny }, 0.8);
      }),
    };
  };

  const labelled = (i: number) => scene.atoms[i].symbol !== 'C' || scene.atoms[i].charge !== 0;

  // Bonds (shortened at labelled atoms so labels have room).
  for (const b of scene.bonds) {
    let a = toPx(scene.atoms[b.begin]), c = toPx(scene.atoms[b.end]);
    const len = Math.hypot(c.x - a.x, c.y - a.y);
    const ux = (c.x - a.x) / len, uy = (c.y - a.y) / len;
    if (labelled(b.begin)) a = { x: a.x + ux * LABEL_GAP * L, y: a.y + uy * LABEL_GAP * L };
    if (labelled(b.end)) c = { x: c.x - ux * LABEL_GAP * L, y: c.y - uy * LABEL_GAP * L };
    strokes.push(line(a, c));
    const offsets = b.order === 2 || b.order === 4 ? [0.17] : b.order === 3 ? [0.15, -0.15] : [];
    for (const o of offsets) {
      const nx = -uy * o * L, ny = ux * o * L;
      const shrink = 0.12 * len;
      strokes.push(line(
        { x: a.x + nx + ux * shrink, y: a.y + ny + uy * shrink },
        { x: c.x + nx - ux * shrink, y: c.y + ny - uy * shrink },
      ));
    }
  }

  // Atom labels and charges.
  const glyph = (symbol: string, center: Pt, size: number, plain = false) => {
    const v = plain ? 0 : Math.floor(rand() * glyphVariantCount(symbol));
    const g = augment(glyphStrokes(symbol, v), rand, noise * 0.7);
    for (const s of g) strokes.push({ points: s.map((p) => jitter({ x: center.x + (p.x - 0.5) * size * 0.8, y: center.y + (p.y - 0.5) * size }, 0.4)) });
  };
  scene.atoms.forEach((a, i) => {
    const c = toPx(a);
    if (a.symbol !== 'C') {
      const letters = a.symbol.split('');
      const w = 0.26 * L;
      letters.forEach((ch, k) => {
        // Lowercase letters shaped like their capitals use the capital's glyph.
        const glyphName = ch === 'l' ? 'I' : glyphVariantCount(ch) ? ch : ch.toUpperCase();
        const size = ch === ch.toLowerCase() && ch !== 'l' ? 0.24 * L : LETTER_SIZE * L;
        const dy = ch === ch.toLowerCase() && ch !== 'l' ? 0.04 * L : 0;
        // A lowercase l is a single stroke (not the serif capital I).
        glyph(glyphName, { x: c.x + (k - (letters.length - 1) / 2) * w, y: c.y + dy }, size, ch === 'l');
      });
    }
    if (a.charge !== 0) {
      const off = a.symbol === 'C' && !labelled(i) ? 0.25 : 0.3 + 0.12 * (a.symbol.length - 1);
      // Charges are written as superscripts: "+", "−", "2−", "3+"…
      if (Math.abs(a.charge) > 1) glyph(String(Math.abs(a.charge)), { x: c.x + off * L, y: c.y - 0.3 * L }, 0.2 * L);
      glyph(a.charge > 0 ? '+' : '-', { x: c.x + (off + (Math.abs(a.charge) > 1 ? 0.17 : 0)) * L, y: c.y - 0.3 * L }, 0.2 * L);
    }
  });

  // Pluses between species.
  scene.pluses.forEach((p) => glyph('+', toPx(p), 0.35 * L));

  // Arrows.
  for (const a of scene.arrows) {
    if (a.kind === 'equilibrium') {
      // Two harpoons: the upper one forward, the lower one back (left of each direction).
      const s0 = toPx(a.start), e0 = toPx(a.end);
      const len = Math.hypot(e0.x - s0.x, e0.y - s0.y) || 1;
      const off = 0.09 * L;
      for (const [from, to] of [[s0, e0], [e0, s0]]) {
        // Left of the direction from→to in screen coordinates (y down).
        const dx = (to.x - from.x) / len, dy = (to.y - from.y) / len;
        const nx = dy * off, ny = -dx * off;
        const p = { x: from.x + nx, y: from.y + ny }, q = { x: to.x + nx, y: to.y + ny };
        strokes.push(line(p, q));
        const ang = (28 * Math.PI) / 180;
        // Barb on the outer side (away from the other harpoon).
        const bx = -dx * Math.cos(ang) + (nx / off) * Math.sin(ang), by = -dy * Math.cos(ang) + (ny / off) * Math.sin(ang);
        strokes.push({ points: interp(q, { x: q.x + bx * 0.22 * L, y: q.y + by * 0.22 * L }, 6) });
      }
      continue;
    }
    const s = toPx(a.start), e = toPx(a.end);
    let shaft: Pt[];
    if (a.height !== undefined && a.kind !== 'reaction') {
      // Cubic Bézier approximating a half-ellipse; height is y-up, flip for px.
      const dx = e.x - s.x, dy = e.y - s.y, len = Math.hypot(dx, dy) || 1;
      // Left normal in the y-up frame is (-dy_up, dx_up); in px (y down) that is (dy, dx) scaled.
      const nx = dy / len, ny = -dx / len;
      const h = a.height * L * (4 / 3);
      const c1 = { x: s.x + nx * h, y: s.y + ny * h };
      const c2 = { x: e.x + nx * h, y: e.y + ny * h };
      shaft = Array.from({ length: 31 }, (_, k) => {
        const t = k / 30, u = 1 - t;
        return jitter({
          x: u * u * u * s.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * e.x,
          y: u * u * u * s.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * e.y,
        }, 0.6);
      });
    } else {
      shaft = line(s, e).points;
    }
    // Head direction = last tangent.
    const p1 = shaft[shaft.length - 4], p2 = shaft[shaft.length - 1];
    const tl = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const bx = -(p2.x - p1.x) / tl, by = -(p2.y - p1.y) / tl;
    const barb = (sign: number): Pt => {
      const ang = (sign * 28 * Math.PI) / 180;
      return {
        x: p2.x + (bx * Math.cos(ang) - by * Math.sin(ang)) * 0.22 * L,
        y: p2.y + (bx * Math.sin(ang) + by * Math.cos(ang)) * 0.22 * L,
      };
    };
    const single = a.kind === 'single-electron';
    if (opts.inStrokeHeads) {
      const tail = single ? [barb(1)] : [barb(1), p2, barb(-1)];
      strokes.push({ points: [...shaft, ...tail.flatMap((q, k) => interp(k === 0 ? p2 : tail[k - 1], q, 4))] });
    } else {
      strokes.push({ points: shaft });
      if (single) strokes.push({ points: interp(p2, barb(1), 6) });
      else if (opts.headStyle === 'triangle') {
        strokes.push({ points: [...interp(barb(1), p2, 5), ...interp(p2, barb(-1), 5).slice(1), ...interp(barb(-1), barb(1), 4).slice(1)] });
      } else if (opts.headStyle === 'two-barbs') {
        strokes.push({ points: interp(p2, barb(1), 6) });
        strokes.push({ points: interp(p2, barb(-1), 6) });
      } else {
        strokes.push({ points: [...interp(barb(1), p2, 5), ...interp(p2, barb(-1), 5).slice(1)] });
      }
    }
  }
  return strokes;
}

function interp(a: Pt, b: Pt, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }));
}
