/**
 * Geometry helpers for online (stroke-based) sketch recognition.
 * All coordinates are screen pixels with y pointing DOWN unless stated otherwise.
 */

export interface Pt {
  x: number;
  y: number;
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bbox(pts: Pt[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const bboxDiag = (b: BBox): number => Math.hypot(b.w, b.h);
export const bboxCenter = (b: BBox): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export function bboxGap(a: BBox, b: BBox): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

/** chord / arc length: 1 for a straight line, → 0 for closed loops. */
export function straightness(pts: Pt[]): number {
  const arc = pathLength(pts);
  return arc > 0 ? dist(pts[0], pts[pts.length - 1]) / arc : 1;
}

/** Resample a polyline to points spaced `spacing` apart along the path. */
export function resampleBySpacing(pts: Pt[], spacing: number): Pt[] {
  if (pts.length < 2 || spacing <= 0) return pts.slice();
  const out: Pt[] = [{ ...pts[0] }];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i];
    let d = dist(prev, cur);
    while (acc + d >= spacing && d > 0) {
      const t = (spacing - acc) / d;
      const q = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
      out.push(q);
      prev = q;
      d = dist(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = cur;
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > spacing * 0.3) out.push({ ...last });
  return out;
}

/** Resample to exactly n points, evenly spaced along the path. */
export function resampleCount(pts: Pt[], n: number): Pt[] {
  const len = pathLength(pts);
  if (len === 0 || pts.length < 2) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out = resampleBySpacing(pts, len / (n - 1));
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

/** Distance from p to segment ab, and the projection parameter t ∈ [0,1]. */
export function pointSegment(p: Pt, a: Pt, b: Pt): { d: number; t: number } {
  const vx = b.x - a.x, vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return { d: Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy)), t };
}

/** Unsigned angle (radians, 0..π) between direction vectors u and v. */
export function angleBetween(u: Pt, v: Pt): number {
  const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
  if (nu === 0 || nv === 0) return 0;
  const c = (u.x * v.x + u.y * v.y) / (nu * nv);
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

export const vec = (a: Pt, b: Pt): Pt => ({ x: b.x - a.x, y: b.y - a.y });

/**
 * Corner detection with the ShortStraw algorithm (Wolin, Eoff & Hammond, 2008):
 * resample, compute "straws" (chord over a ±W window); corners are local minima
 * of the straw length well below the median. Returns indices into the
 * RESAMPLED point list, including both endpoints.
 */
export function shortStraw(raw: Pt[]): { points: Pt[]; corners: number[] } {
  const b = bbox(raw);
  const spacing = Math.max(1, bboxDiag(b) / 40);
  const pts = resampleBySpacing(raw, spacing);
  const n = pts.length;
  const W = 3;
  if (n <= 2 * W + 1) return { points: pts, corners: [0, n - 1] };

  const straws: number[] = new Array(n).fill(Infinity);
  for (let i = W; i < n - W; i++) straws[i] = dist(pts[i - W], pts[i + W]);
  const finite = straws.filter(Number.isFinite).sort((a, c) => a - c);
  const median = finite[Math.floor(finite.length / 2)];
  const threshold = median * 0.95;

  const corners = [0];
  for (let i = W; i < n - W; i++) {
    if (straws[i] < threshold) {
      let localMin = Infinity, localIdx = i;
      while (i < n - W && straws[i] < threshold) {
        if (straws[i] < localMin) {
          localMin = straws[i];
          localIdx = i;
        }
        i++;
      }
      corners.push(localIdx);
    }
  }
  corners.push(n - 1);

  // Post-process: drop corners whose neighbouring segments are collinear.
  const isLine = (a: number, c: number) => {
    const chord = dist(pts[a], pts[c]);
    const arc = pathLength(pts.slice(a, c + 1));
    return arc === 0 || chord / arc > 0.95;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let k = 1; k < corners.length - 1; k++) {
      if (isLine(corners[k - 1], corners[k + 1])) {
        corners.splice(k, 1);
        changed = true;
        break;
      }
    }
  }
  return { points: pts, corners };
}

/** Least-squares fit is not needed for bonds: chord endpoints are robust enough. */
export interface Segment {
  a: Pt;
  b: Pt;
}

export const segLength = (s: Segment): number => dist(s.a, s.b);
export const segMid = (s: Segment): Pt => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 });

/** Mulberry32: tiny deterministic PRNG (used by synthetic data generation). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
