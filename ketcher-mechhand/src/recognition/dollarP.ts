/**
 * $P point-cloud gesture recognizer.
 *
 * Implementation of: R.-D. Vatavu, L. Anthony, J. O. Wobbrock. "Gestures as
 * Point Clouds: A $P Recognizer for User Interface Prototypes". ICMI 2012.
 * Written from the paper's pseudocode.
 *
 * $P ignores stroke order, direction and count, which suits handwriting: an
 * "H" drawn with three strokes in any order matches the same template. It is
 * NOT rotation invariant, which we want ("N" ≠ "Z", "+" ≠ "×").
 */

import { type Pt, resampleCount } from './geometry';

export const CLOUD_SIZE = 32;

export interface CloudPoint extends Pt {
  stroke: number;
}

export interface SymbolSample {
  symbol: string;
  /** Raw strokes in any coordinate system (normalized here). */
  strokes: Pt[][];
}

export interface Template {
  symbol: string;
  cloud: CloudPoint[];
}

export interface Match {
  symbol: string;
  /** 0..1, higher is better. */
  score: number;
}

/** Resample all strokes together to CLOUD_SIZE points, scale and centre. */
export function normalizeCloud(strokes: Pt[][]): CloudPoint[] {
  const nonEmpty = strokes.filter((s) => s.length > 0);
  if (nonEmpty.length === 0) return [];

  // Total path length across strokes (dots count as a tiny length).
  const lengths = nonEmpty.map((s) => {
    let l = 0;
    for (let i = 1; i < s.length; i++) l += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    return Math.max(l, 1e-6);
  });
  const total = lengths.reduce((a, b) => a + b, 0);

  // Allocate points per stroke proportionally to length, but give every stroke a
  // minimum share so short strokes that define a symbol (the bar inside ⊖ vs ⊕,
  // the dot of an "i") are not drowned out by long ones. (Deviation from the
  // original $P, which allocates strictly by length.)
  const minShare = Math.max(1, Math.floor(CLOUD_SIZE / (2 * nonEmpty.length)));
  const counts = lengths.map((l) => Math.max(minShare, Math.round((l / total) * CLOUD_SIZE)));
  let diff = CLOUD_SIZE - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < 1000; i++) {
    const k = i % counts.length;
    if (diff > 0) { counts[k]++; diff--; }
    else if (counts[k] > 1) { counts[k]--; diff++; }
  }

  let cloud: CloudPoint[] = [];
  nonEmpty.forEach((s, si) => {
    const pts = counts[si] === 1 ? [s[0]] : resampleCount(s.length > 1 ? s : [s[0], s[0]], counts[si]);
    cloud.push(...pts.map((p) => ({ x: p.x, y: p.y, stroke: si })));
  });

  // Scale uniformly (preserving aspect ratio) and translate to the centroid.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of cloud) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  cloud = cloud.map((p) => ({ ...p, x: (p.x - minX) / size, y: (p.y - minY) / size }));
  const cx = cloud.reduce((a, p) => a + p.x, 0) / cloud.length;
  const cy = cloud.reduce((a, p) => a + p.y, 0) / cloud.length;
  return cloud.map((p) => ({ ...p, x: p.x - cx, y: p.y - cy }));
}

function cloudDistance(pts: CloudPoint[], tmpl: CloudPoint[], start: number): number {
  const n = pts.length;
  const matched = new Array<boolean>(n).fill(false);
  let sum = 0;
  let i = start;
  do {
    let min = Infinity, index = -1;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(pts[i].x - tmpl[j].x, pts[i].y - tmpl[j].y);
      if (d < min) { min = d; index = j; }
    }
    matched[index] = true;
    const weight = 1 - ((i - start + n) % n) / n;
    sum += weight * min;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}

function greedyCloudMatch(pts: CloudPoint[], tmpl: CloudPoint[]): number {
  const n = pts.length;
  const step = Math.floor(Math.pow(n, 1 - 0.5));
  let min = Infinity;
  for (let i = 0; i < n; i += step) {
    min = Math.min(min, cloudDistance(pts, tmpl, i), cloudDistance(tmpl, pts, i));
  }
  return min;
}

export class PointCloudRecognizer {
  private templates: Template[] = [];

  constructor(samples: SymbolSample[] = []) {
    samples.forEach((s) => this.add(s));
  }

  add(sample: SymbolSample): void {
    const cloud = normalizeCloud(sample.strokes);
    if (cloud.length === CLOUD_SIZE) this.templates.push({ symbol: sample.symbol, cloud });
  }

  get size(): number {
    return this.templates.length;
  }

  get symbols(): string[] {
    return [...new Set(this.templates.map((t) => t.symbol))].sort();
  }

  /** Best score per symbol, sorted best first. */
  classify(strokes: Pt[][], topK = 3): Match[] {
    const cloud = normalizeCloud(strokes);
    if (cloud.length !== CLOUD_SIZE || this.templates.length === 0) return [];
    const best = new Map<string, number>();
    for (const t of this.templates) {
      const d = greedyCloudMatch(cloud, t.cloud);
      const prev = best.get(t.symbol);
      if (prev === undefined || d < prev) best.set(t.symbol, d);
    }
    return [...best.entries()]
      .map(([symbol, d]) => ({ symbol, score: Math.max((2.0 - d) / 2.0, 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
