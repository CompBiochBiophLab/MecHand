/**
 * Recognition of a mechanism drawn on paper or printed in an article or book:
 * image → strokes (vectorize.ts) → the handwriting recognizer → the stereo and
 * dashed-bond notes applied to the bonds they belong to. Runs in the browser.
 */

import type { Pt } from '../recognition/geometry';
import { type SketchOptions, type SketchResult, recognizeSketch } from '../recognition/sketch';
import type { PointCloudRecognizer } from '../recognition/dollarP';
import type { SceneBond } from '../scene/types';
import { type ImageStrokes, type StrokeNote, type VectorizeOptions, vectorize } from './vectorize';

export interface ImageRecognition {
  vector: ImageStrokes;
  result: SketchResult;
  /** Bonds that received a stereo or dashed style from the image, by kind. */
  applied: Record<string, number>;
  /** Dashed bonds (partial or hydrogen bonds), as bond indices of the scene. */
  dashed: number[];
}

/** Scene-unit point → processed-image pixel. */
export function toPx(r: SketchResult, p: Pt): Pt {
  return { x: r.originPx.x + p.x * r.bondLengthPx, y: r.originPx.y - p.y * r.bondLengthPx };
}

/** The bond a note's stroke stands for: both ends near the bond's atoms. */
function bondFor(r: SketchResult, a: Pt, b: Pt): { bond: number; reversed: boolean } | null {
  let best: { bond: number; reversed: boolean; cost: number } | null = null;
  r.scene.bonds.forEach((bd, k) => {
    const p = toPx(r, r.scene.atoms[bd.begin]), q = toPx(r, r.scene.atoms[bd.end]);
    const d1 = Math.hypot(p.x - a.x, p.y - a.y) + Math.hypot(q.x - b.x, q.y - b.y);
    const d2 = Math.hypot(p.x - b.x, p.y - b.y) + Math.hypot(q.x - a.x, q.y - a.y);
    const cost = Math.min(d1, d2);
    if (cost < 1.1 * r.bondLengthPx && (!best || cost < best.cost)) best = { bond: k, reversed: d2 < d1, cost };
  });
  return best;
}

export function applyNotes(r: SketchResult, v: ImageStrokes, notes: StrokeNote[]): { applied: Record<string, number>; dashed: number[] } {
  const applied: Record<string, number> = {};
  const dashed: number[] = [];
  for (const n of notes) {
    const s = v.strokes[n.stroke].points;
    const a = s[0], b = s[s.length - 1];
    const hit = bondFor(r, a, b);
    if (!hit) continue;
    const bond: SceneBond = r.scene.bonds[hit.bond];
    if (n.kind === 'dashed') {
      // IUPAC 2008 GR-1.8: a dotted (or dashed) line is a partial or hydrogen bond.
      bond.partial = true;
      bond.order = 1;
      dashed.push(hit.bond);
    } else {
      if (bond.order !== 1) continue;
      bond.stereo = n.kind === 'wedge' ? 'up' : n.kind === 'hash' ? 'down' : 'either';
      // The narrow end (stereocentre) must be the bond's first atom.
      const narrowIsA = n.narrowAtStart !== false;
      const beginAtA = !hit.reversed;
      if (n.kind !== 'wavy' && narrowIsA !== beginAtA) [bond.begin, bond.end] = [bond.end, bond.begin];
    }
    applied[n.kind] = (applied[n.kind] ?? 0) + 1;
  }
  return { applied, dashed };
}

export function recognizeImage(
  rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, symbols: PointCloudRecognizer,
  opts: SketchOptions & VectorizeOptions = {},
): ImageRecognition {
  const vector = vectorize(rgba, width, height, opts);
  const result = recognizeSketch(vector.strokes, symbols, { ...opts, defaultBondPx: vector.bondPx, glyphs: vector.glyphs, charLike: vector.charLike });
  const { applied, dashed } = applyNotes(result, vector, vector.notes);
  return { vector, result, applied, dashed };
}
