/**
 * Reading a drawing from an image: pixels → strokes the handwriting recognizer
 * understands, plus notes for the conventions a stroke cannot carry (IUPAC 2006
 * and 2008 graphical representation recommendations):
 *
 *   solid wedge (filled triangle, narrow end at the stereocentre)  → note 'wedge'
 *   hashed wedge (short parallel lines growing along the bond)       → note 'hash'
 *   wavy bond (unknown configuration)                                → note 'wavy'
 *   dashed bond (partial or hydrogen bond)                           → note 'dashed'
 *   filled arrowhead                                                 → redrawn as an open "V"
 *   filled dot (lone pair electron, radical)                         → a dot stroke
 *
 * Steps: ink channel (colour counts as ink) → adaptive binarization → specks and
 * pinholes removed → distance transform (stroke width) → thinning → skeleton graph
 * (nodes, edges, loops; spurs pruned) → the special shapes above → polylines.
 */

import type { Pt } from '../recognition/geometry';
import type { InkStroke } from '../recognition/sketch';
import { binarize, components, distanceTransform, fillSmallHoles, inkFromRGBA, removeSpecks, thin } from './bitmap';
import { type SkelEdge, joinContinuations, pruneAndJoin, simplify, traceSkeleton } from './skeletonGraph';

export type NoteKind = 'wedge' | 'hash' | 'wavy' | 'dashed';

export interface StrokeNote {
  stroke: number;
  kind: NoteKind;
  /** Wedges: the narrow end (the stereocentre) is the first point of the stroke. */
  narrowAtStart?: boolean;
}

export interface ImageStrokes {
  strokes: InkStroke[];
  notes: StrokeNote[];
  /** Stroke width of the drawing in processed pixels. */
  strokeWidth: number;
  /** Rough bond length in processed pixels (from the straight lines). */
  bondPx: number;
  /** Size of the processed image and its scale relative to the original. */
  width: number;
  height: number;
  scale: number;
  /** Counts for the user: filled heads redrawn, dots, wedges… */
  found: Record<string, number>;
  /** The ink component each stroke belongs to (0: none); a printed character is one component. */
  glyphs: number[];
  /** Strokes of a component the size of a character (a letter, digit or sign of a label). */
  charLike: boolean[];
}

export interface VectorizeOptions {
  /** Longest side after downscaling (default 1400 px). */
  maxSide?: number;
  /** Bond length (px) the image is rescaled to before reading (default 64, like pen input). */
  targetBondPx?: number;
}

const plen = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
const chord = (pts: Pt[]) => Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const norm = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Bilinear upscale of RGBA by a factor k > 1. */
function upscale(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, k: number) {
  const W = Math.round(w * k), H = Math.round(h * k);
  const out = new Uint8ClampedArray(W * H * 4);
  for (let Y = 0; Y < H; Y++) {
    const fy = Math.min(h - 1, Math.max(0, (Y + 0.5) / k - 0.5)), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let X = 0; X < W; X++) {
      const fx = Math.min(w - 1, Math.max(0, (X + 0.5) / k - 0.5)), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const a = rgba[(y0 * w + x0) * 4 + c], b = rgba[(y0 * w + x1) * 4 + c];
        const d = rgba[(y1 * w + x0) * 4 + c], e = rgba[(y1 * w + x1) * 4 + c];
        out[(Y * W + X) * 4 + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
      }
    }
  }
  return { rgba: out, w: W, h: H, scale: W / w };
}

/** Area-average downscale of RGBA so that the longest side is at most maxSide. */
function downscale(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, maxSide: number) {
  const f = Math.max(w, h) / maxSide;
  if (f <= 1) return { rgba, w, h, scale: 1 };
  const W = Math.round(w / f), H = Math.round(h / f);
  const out = new Uint8ClampedArray(W * H * 4);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x0 = Math.floor(X * f), x1 = Math.min(w, Math.floor((X + 1) * f)), y0 = Math.floor(Y * f), y1 = Math.min(h, Math.floor((Y + 1) * f));
    const acc = [0, 0, 0, 0];
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const p = (y * w + x) * 4;
      acc[0] += rgba[p]; acc[1] += rgba[p + 1]; acc[2] += rgba[p + 2]; acc[3] += rgba[p + 3];
      n++;
    }
    const q = (Y * W + X) * 4;
    for (let k = 0; k < 4; k++) out[q + k] = acc[k] / Math.max(n, 1);
  }
  return { rgba: out, w: W, h: H, scale: W / w };
}

/** Radius (half stroke width) along a polyline. */
function radii(pts: Pt[], dt: Float32Array, w: number, h: number): number[] {
  return pts.map((p) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(p.x))), y = Math.min(h - 1, Math.max(0, Math.floor(p.y)));
    return dt[y * w + x];
  });
}

/** Correlation of the radius with the position along the edge (a wedge grows steadily). */
function growth(r: number[]): number {
  const n = r.length;
  if (n < 4) return 0;
  const mx = (n - 1) / 2, my = r.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  r.forEach((v, i) => {
    sxy += (i - mx) * (v - my);
    sxx += (i - mx) ** 2;
    syy += (v - my) ** 2;
  });
  return syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Signed distances of the points from the chord (for wavy lines). */
function deviations(pts: Pt[]): number[] {
  const a = pts[0], b = pts[pts.length - 1];
  const d = norm(sub(b, a));
  return pts.map((p) => (p.x - a.x) * -d.y + (p.y - a.y) * d.x);
}

function signChanges(xs: number[], tol: number): number {
  let last = 0, n = 0;
  for (const x of xs) {
    const s = x > tol ? 1 : x < -tol ? -1 : 0;
    if (s && last && s !== last) n++;
    if (s) last = s;
  }
  return n;
}

/**
 * Reads an image in two passes: the first measures the bond length; if it is far from
 * the size the recognizer is tuned for (pen input, ~64 px per bond), the image is
 * rescaled and read again. Coordinates of the result are in the processed image.
 */
export function vectorize(rgbaIn: Uint8ClampedArray | Uint8Array, wIn: number, hIn: number, opts: VectorizeOptions = {}): ImageStrokes {
  const target = opts.targetBondPx ?? 64;
  const first = vectorizeOnce(rgbaIn, wIn, hIn, opts.maxSide ?? 1400);
  const k = target / first.bondPx;
  if (k > 0.8 && k < 1.25) return first;
  // Bond length in original pixels → target; keep the work bounded (at most ~2400 px).
  const kOrig = Math.min(k * first.scale, 2400 / Math.max(wIn, hIn));
  if (Math.abs(kOrig - first.scale) / first.scale < 0.15) return first;
  const re = kOrig > 1 ? upscale(rgbaIn, wIn, hIn, kOrig) : downscale(rgbaIn, wIn, hIn, Math.max(wIn, hIn) * kOrig);
  const second = vectorizeOnce(re.rgba, re.w, re.h, Infinity);
  return { ...second, scale: re.scale };
}

function vectorizeOnce(rgbaIn: Uint8ClampedArray | Uint8Array, wIn: number, hIn: number, maxSide: number): ImageStrokes {
  const { rgba, w, h, scale } = downscale(rgbaIn, wIn, hIn, maxSide);
  const found: Record<string, number> = {};
  const count = (k: string) => { found[k] = (found[k] ?? 0) + 1; };

  let mask = binarize(inkFromRGBA(rgba, w, h));
  mask = removeSpecks(mask, w, h, 4);
  mask = fillSmallHoles(mask, w, h, 6);
  const dt = distanceTransform(mask, w, h);
  let skeleton = thin(mask, w, h);
  const skelRadii: number[] = [];
  for (let i = 0; i < skeleton.length; i++) if (skeleton[i]) skelRadii.push(dt[i]);
  const r0 = Math.max(0.75, median(skelRadii));
  const sw = 2 * r0;

  const strokes: InkStroke[] = [];
  const notes: StrokeNote[] = [];

  // Filled dots: small, round, solid components.
  const { labels, list } = components(mask, w, h);
  const dotLabels = new Set<number>();
  for (const c of list) {
    const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
    const fill = c.area / (bw * bh);
    if (Math.max(bw, bh) <= Math.max(3.2 * sw, 5) && fill > 0.45 && bw < 2 * bh && bh < 2 * bw) {
      dotLabels.add(c.label);
      const p = { x: c.minX + bw / 2, y: c.minY + bh / 2 };
      strokes.push({ points: [p, { x: p.x + 0.5, y: p.y }] });
      count('dots');
    }
  }
  if (dotLabels.size) {
    skeleton = skeleton.slice();
    for (let i = 0; i < skeleton.length; i++) if (skeleton[i] && dotLabels.has(labels[i])) skeleton[i] = 0;
  }

  let graph = traceSkeleton(skeleton, w, h);
  graph = pruneAndJoin(graph, Math.max(2.5 * sw, 3));
  for (const d of graph.dots) strokes.push({ points: [d, { x: d.x + 0.5, y: d.y }] });

  // Leftovers of thinning next to junctions: tiny loops and one-pixel edges are not ink marks.
  let edges: SkelEdge[] = graph.edges.filter((e) => {
    if (e.points.length < 2) return false;
    const closed = e.closed || (e.a === e.b && e.a >= 0);
    return closed ? plen(e.points) > 3 * sw : plen(e.points) > 0.75;
  });
  // Rough bond length: the straight lines.
  // Bond length: the straight pieces between corners of every line (a zig-zag chain or
  // a ring is one skeleton line), upper part of the distribution (bonds split by an
  // arrow tail, inner lines of double bonds and letter strokes are shorter).
  const bondEstimate = (es: SkelEdge[], fallback: number) => {
    const ls: number[] = [];
    for (const e of es) {
      const v = simplify(e.points, Math.max(2, 1.5 * sw));
      for (let k = 1; k < v.length; k++) {
        const i0 = e.points.indexOf(v[k - 1]), i1 = e.points.indexOf(v[k]);
        const piece = i0 >= 0 && i1 > i0 ? e.points.slice(i0, i1 + 1) : [v[k - 1], v[k]];
        const l = plen(piece);
        if (l > 6 * sw && chord(piece) / l > 0.95) ls.push(l);
      }
    }
    if (!ls.length) return fallback;
    const sorted = ls.sort((a, b) => a - b);
    return sorted[Math.floor(0.7 * (sorted.length - 1))];
  };
  // Join strokes split where they touch or cross, then estimate the bond length again
  // (bonds split by an arrow tail look half as long).
  let L0 = bondEstimate(edges, 20 * sw);
  edges = joinContinuations({ nodes: graph.nodes, edges, dots: [] }, L0).edges;
  L0 = bondEstimate(edges, L0);
  edges = joinContinuations({ nodes: graph.nodes, edges, dots: [] }, L0).edges;

  type Out = { points: Pt[]; note?: StrokeNote['kind']; narrowAtStart?: boolean };
  const out: Out[] = [];
  const used = new Set<SkelEdge>();

  // Solid wedges and filled arrowheads, from the stroke width along each edge.
  for (const e of edges) {
    const r = radii(e.points, dt, w, h);
    const L = plen(e.points);
    const rMax = Math.max(...r);
    if (rMax < 2.1 * r0 || L < 3 * sw) continue;
    const g = growth(r);
    const startThin = r[0] <= 1.5 * r0, endThin = r[r.length - 1] <= 1.5 * r0;
    if (Math.abs(g) > 0.75 && L > 0.35 * L0 && (startThin || endThin)) {
      // Wedge: the skeleton stops short of the wide end; extend it by the radius there.
      const narrowAtStart = g > 0;
      const pts = narrowAtStart ? e.points.slice() : e.points.slice().reverse();
      const end = pts[pts.length - 1], dir = norm(sub(end, pts[Math.max(0, pts.length - 4)]));
      const rw = narrowAtStart ? r[r.length - 1] : r[0];
      pts.push({ x: end.x + dir.x * rw, y: end.y + dir.y * rw });
      out.push({ points: [pts[0], pts[pts.length - 1]], note: 'wedge', narrowAtStart: true });
      used.add(e);
      count('wedges');
      continue;
    }
    // Filled head at one end of a long line: the thick part is short and at an end.
    for (const atEnd of [true, false]) {
      const rr = atEnd ? r : r.slice().reverse();
      const pts = atEnd ? e.points : e.points.slice().reverse();
      let k = rr.length - 1;
      while (k > 0 && rr[k - 1] > 1.6 * r0) k--;
      const thickLen = plen(pts.slice(k));
      if (k < 3 || rr.slice(k).every((v) => v < 2 * r0) || thickLen > 0.45 * L0 || plen(pts.slice(0, k + 1)) < 0.6 * L0) continue;
      const shaft = pts.slice(0, k + 1);
      const base = pts[k];
      const dir = norm(sub(pts[pts.length - 1], pts[Math.max(0, k - 3)]));
      const tip = { x: pts[pts.length - 1].x + dir.x * rr[rr.length - 1] * 1.6, y: pts[pts.length - 1].y + dir.y * rr[rr.length - 1] * 1.6 };
      const back = Math.max(Math.hypot(tip.x - base.x, tip.y - base.y), 3 * sw);
      const ang = (28 * Math.PI) / 180;
      const barb = (s: number): Pt => ({
        x: tip.x - back * (dir.x * Math.cos(ang) - s * dir.y * Math.sin(ang)),
        y: tip.y - back * (dir.y * Math.cos(ang) + s * dir.x * Math.sin(ang)),
      });
      out.push({ points: [...shaft, tip] });
      out.push({ points: [barb(1), tip, barb(-1)] });
      used.add(e);
      count('filledHeads');
      break;
    }
  }
  edges = edges.filter((e) => !used.has(e));

  // Two short barbs meeting a long line at its end: one "V" head stroke.
  const deg = new Map<number, SkelEdge[]>();
  for (const e of edges) for (const n of [e.a, e.b]) if (n >= 0) deg.set(n, [...(deg.get(n) ?? []), e]);
  for (const [node, es] of deg) {
    if (es.length !== 3) continue;
    const away = (e: SkelEdge) => (e.a === node ? e.points : e.points.slice().reverse());
    const sorted = es.slice().sort((p, q) => plen(q.points) - plen(p.points));
    const [shaftE, b1, b2] = sorted;
    if (used.has(shaftE) || used.has(b1) || used.has(b2)) continue;
    if (plen(b1.points) > 0.5 * L0 || plen(b2.points) > 0.5 * L0 || plen(shaftE.points) < 1.5 * plen(b1.points)) continue;
    const tip = graph.nodes[node];
    const s = away(shaftE);
    const back = norm(sub(s[Math.min(s.length - 1, 4)], tip));
    const dA = norm(sub(away(b1)[away(b1).length - 1], tip)), dB = norm(sub(away(b2)[away(b2).length - 1], tip));
    const cosA = dA.x * back.x + dA.y * back.y, cosB = dB.x * back.x + dB.y * back.y;
    // Both barbs lean backwards along the shaft, one on each side.
    const side = (d: Pt) => back.x * d.y - back.y * d.x;
    if (cosA < 0.25 || cosB < 0.25 || side(dA) * side(dB) >= 0) continue;
    out.push({ points: away(shaftE).slice().reverse() });
    out.push({ points: [...away(b1).slice().reverse(), ...away(b2).slice(1)] });
    used.add(shaftE).add(b1).add(b2);
    count('openHeads');
  }
  edges = edges.filter((e) => !used.has(e));

  // Short straight pieces: hashed wedges (parallel, growing, side by side along an
  // axis) and dashed bonds (in line, along their own direction).
  const shortStraight = edges.filter((e) => {
    const l = plen(e.points);
    return l < 0.5 * L0 && l > 1.5 * sw && chord(e.points) / l > 0.9;
  });
  const info = shortStraight.map((e) => {
    const a = e.points[0], b = e.points[e.points.length - 1];
    return { e, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dir: norm(sub(b, a)), len: chord(e.points) };
  });
  const taken = new Set<number>();
  const parallel = (u: Pt, v: Pt, tol: number) => Math.abs(u.x * v.x + u.y * v.y) > Math.cos(tol);
  for (let i = 0; i < info.length; i++) {
    if (taken.has(i)) continue;
    // Hash group: neighbours parallel to i whose midpoints line up across their direction.
    const group = [i];
    for (let grow = true; grow;) {
      grow = false;
      for (let j = 0; j < info.length; j++) {
        if (group.includes(j) || taken.has(j)) continue;
        const near = group.some((k) => {
          const d = Math.hypot(info[j].mid.x - info[k].mid.x, info[j].mid.y - info[k].mid.y);
          const across = Math.abs(sub(info[j].mid, info[k].mid).x * info[k].dir.x + sub(info[j].mid, info[k].mid).y * info[k].dir.y);
          return parallel(info[j].dir, info[k].dir, 0.35) && d < 0.3 * L0 && d > 0.8 * sw && across < 0.25 * d + sw;
        });
        if (near) { group.push(j); grow = true; }
      }
    }
    if (group.length >= 3) {
      // Order along the axis; the shortest end is the narrow end (the stereocentre).
      const axis = norm(sub(info[group[group.length - 1]].mid, info[group[0]].mid));
      const sorted = group.slice().sort((p, q) => (info[p].mid.x * axis.x + info[p].mid.y * axis.y) - (info[q].mid.x * axis.x + info[q].mid.y * axis.y));
      const first = info[sorted[0]], last = info[sorted[sorted.length - 1]];
      const step = Math.hypot(last.mid.x - first.mid.x, last.mid.y - first.mid.y) / (sorted.length - 1);
      const ax = norm(sub(last.mid, first.mid));
      const narrowAtStart = first.len <= last.len;
      const a = { x: first.mid.x - ax.x * step * 0.8, y: first.mid.y - ax.y * step * 0.8 };
      const b = { x: last.mid.x + ax.x * step * 0.8, y: last.mid.y + ax.y * step * 0.8 };
      out.push({ points: [a, b], note: 'hash', narrowAtStart });
      group.forEach((k) => { taken.add(k); used.add(info[k].e); });
      count('hashedWedges');
    }
  }
  for (let i = 0; i < info.length; i++) {
    if (taken.has(i)) continue;
    // Dashes in line with each other.
    const group = [i];
    for (let grow = true; grow;) {
      grow = false;
      for (let j = 0; j < info.length; j++) {
        if (group.includes(j) || taken.has(j)) continue;
        const near = group.some((k) => {
          const v = sub(info[j].mid, info[k].mid);
          const d = Math.hypot(v.x, v.y);
          return parallel(info[j].dir, info[k].dir, 0.3) && parallel(norm(v), info[k].dir, 0.3) && d < 2.6 * Math.max(info[j].len, info[k].len);
        });
        if (near) { group.push(j); grow = true; }
      }
    }
    // IUPAC 2008 GR-1.3: dashed and dotted bonds have at least three dashes or dots.
    if (group.length >= 3) {
      const ends = group.flatMap((k) => [info[k].e.points[0], info[k].e.points[info[k].e.points.length - 1]]);
      let best: [Pt, Pt] = [ends[0], ends[1]], bestD = 0;
      for (const p of ends) for (const q of ends) {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d > bestD) { bestD = d; best = [p, q]; }
      }
      if (bestD > 0.45 * L0 && bestD < 1.8 * L0) {
        out.push({ points: best, note: 'dashed' });
        group.forEach((k) => { taken.add(k); used.add(info[k].e); });
        count('dashedBonds');
      }
    }
  }
  edges = edges.filter((e) => !used.has(e));

  // Wavy bonds: a bond-long line that swings from side to side with a small amplitude.
  for (const e of edges) {
    const l = plen(e.points), c = chord(e.points);
    if (c < 0.5 * L0 || c > 1.8 * L0 || c / l > 0.92 || c / l < 0.4) continue;
    const dev = deviations(e.points);
    const amp = Math.max(...dev.map(Math.abs));
    if (amp < 0.25 * c && signChanges(dev, Math.max(0.5 * sw, 0.03 * c)) >= 3) {
      out.push({ points: [e.points[0], e.points[e.points.length - 1]], note: 'wavy' });
      used.add(e);
      count('wavyBonds');
    }
  }
  edges = edges.filter((e) => !used.has(e));
  // Polygonal chains (ring halves, zig-zags) become one stroke per bond when every
  // piece between sharp corners is straight and bond-long: in an image they are
  // pieces of a skeleton, not pen strokes, and must not look like curved arrows.
  // Curved arrows (no sharp corner) and letters (short pieces) stay whole.
  for (const e of edges) {
    const corners = simplify(e.points, Math.max(2, 0.1 * L0));
    const cuts: number[] = [];
    for (let k = 1; k < corners.length - 1; k++) {
      const u = norm(sub(corners[k], corners[k - 1])), v = norm(sub(corners[k + 1], corners[k]));
      if (Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) > (35 * Math.PI) / 180) cuts.push(k);
    }
    const pieces: Pt[][] = [];
    let from = 0;
    for (const k of [...cuts, corners.length - 1]) {
      pieces.push(corners.slice(from, k + 1));
      from = k;
    }
    const bondPieces = pieces.length > 1 && pieces.every((pc) => {
      // A piece between corners: straight in the full-resolution chain too.
      const a = pc[0], b = pc[pc.length - 1];
      const i0 = e.points.findIndex((q) => q === a), i1 = e.points.findIndex((q) => q === b);
      const full = i0 >= 0 && i1 > i0 ? e.points.slice(i0, i1 + 1) : pc;
      return plen(full) > 0.45 * L0 && chord(full) / plen(full) > 0.9;
    });
    if (bondPieces) {
      for (const pc of pieces) out.push({ points: [pc[0], pc[pc.length - 1]] });
      count('splitChains');
    } else {
      out.push({ points: e.points });
    }
  }

  for (const o of out) {
    const pts = simplify(o.points, Math.max(0.5, 0.25 * sw));
    const k = strokes.length;
    strokes.push({ points: pts.length >= 2 ? pts : [o.points[0], o.points[o.points.length - 1]] });
    if (o.note) notes.push({ stroke: k, kind: o.note, narrowAtStart: o.narrowAtStart });
  }
  // The ink component of each stroke (redrawn heads and wedges may leave the ink a little).
  const labelAt = (p: Pt, r: number) => {
    const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
    for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x]) return labels[y * w + x];
    }
    return 0;
  };
  const glyphs = strokes.map((s) => {
    for (const p of s.points) {
      const l = labelAt(p, 0);
      if (l) return l;
    }
    return labelAt(s.points[0], Math.ceil(2 * sw));
  });
  // Characters: components the size of a letter, digit or sign. Not dots, not the marks of
  // a hashed wedge or a dashed bond, not a lone straight line as long as a short bond (a
  // bond between two labels), and not a component as large as a bond.
  const comp = new Map(list.map((c) => [c.label, c]));
  const strokesOf = new Map<number, number[]>();
  glyphs.forEach((g, i) => strokesOf.set(g, [...(strokesOf.get(g) ?? []), i]));
  const noted = new Set(notes.map((nt) => nt.stroke));
  const charLike = glyphs.map((g) => {
    const c = comp.get(g);
    if (!c || dotLabels.has(g)) return false;
    const side = Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1);
    if (side > 0.7 * L0 || side < 2 * sw) return false;
    const own = strokesOf.get(g)!;
    if (own.some((k) => noted.has(k))) return false;
    if (own.length === 1) {
      const p = strokes[own[0]].points;
      if (side > 0.45 * L0 && chord(p) / Math.max(plen(p), 1e-9) > 0.93) return false;
    }
    return true;
  });
  return { strokes, notes, strokeWidth: sw, bondPx: L0, width: w, height: h, scale, found, glyphs, charLike };
}
