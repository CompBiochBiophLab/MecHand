/**
 * From a one-pixel skeleton to polylines: endpoints and junctions become nodes,
 * the pixel chains between them become edges (pure loops, such as an "O", become
 * closed edges), short spurs left by thinning are pruned, and edges that meet at a
 * node of degree two are joined again.
 */

import type { Pt } from '../recognition/geometry';

export interface SkelEdge {
  /** Pixel centres from one node to the other (first = last for a closed loop). */
  points: Pt[];
  /** Node ids at the two ends (-1 for a chain without nodes). */
  a: number;
  b: number;
  /** A closed loop (first point repeated at the end). */
  closed?: boolean;
}

export interface SkelGraph {
  nodes: Pt[];
  edges: SkelEdge[];
  /** Isolated skeleton pixels (dots). */
  dots: Pt[];
}

const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/** Number of 0→1 transitions around a pixel (1 = end, 2 = path, ≥3 = junction). */
function crossings(sk: Uint8Array, w: number, h: number, x: number, y: number): number {
  let c = 0;
  for (let k = 0; k < 8; k++) {
    const a = at(sk, w, h, x + DX[k], y + DY[k]);
    const b = at(sk, w, h, x + DX[(k + 1) % 8], y + DY[(k + 1) % 8]);
    if (!a && b) c++;
  }
  return c;
}

function at(sk: Uint8Array, w: number, h: number, x: number, y: number): number {
  return x < 0 || y < 0 || x >= w || y >= h ? 0 : sk[y * w + x];
}

function neighbours(sk: Uint8Array, w: number, h: number, p: number): number[] {
  const x = p % w, y = (p - x) / w;
  const out: number[] = [];
  for (let k = 0; k < 8; k++) {
    const nx = x + DX[k], ny = y + DY[k];
    if (at(sk, w, h, nx, ny)) out.push(ny * w + nx);
  }
  return out;
}

const centre = (p: number, w: number): Pt => ({ x: (p % w) + 0.5, y: Math.floor(p / w) + 0.5 });

export function traceSkeleton(sk: Uint8Array, w: number, h: number): SkelGraph {
  // Node pixels: ends and junctions; adjacent junction pixels form one node.
  const nodeOf = new Int32Array(w * h).fill(-1);
  const nodes: Pt[] = [];
  const dots: Pt[] = [];
  const isNodePx = new Uint8Array(w * h);
  for (let p = 0; p < sk.length; p++) {
    if (!sk[p]) continue;
    const x = p % w, y = (p - x) / w;
    const n = neighbours(sk, w, h, p).length;
    if (n === 0) { dots.push(centre(p, w)); continue; }
    const c = crossings(sk, w, h, x, y);
    if (n === 1 || c === 1 || c >= 3) isNodePx[p] = 1;
  }
  for (let p = 0; p < sk.length; p++) {
    if (!isNodePx[p] || nodeOf[p] >= 0) continue;
    const id = nodes.length;
    const stack = [p];
    nodeOf[p] = id;
    let sx = 0, sy = 0, cnt = 0;
    while (stack.length) {
      const q = stack.pop()!;
      const c = centre(q, w);
      sx += c.x; sy += c.y; cnt++;
      for (const r of neighbours(sk, w, h, q)) {
        if (isNodePx[r] && nodeOf[r] < 0) { nodeOf[r] = id; stack.push(r); }
      }
    }
    nodes.push({ x: sx / cnt, y: sy / cnt });
  }

  const visited = new Uint8Array(w * h);
  const edges: SkelEdge[] = [];
  // Edges leaving each node.
  for (let p = 0; p < sk.length; p++) {
    if (nodeOf[p] < 0) continue;
    const from = nodeOf[p];
    for (const start of neighbours(sk, w, h, p)) {
      if (nodeOf[start] === from) continue;
      if (nodeOf[start] >= 0) {
        // Two nodes touching directly: a one-pixel edge (keep one copy).
        if (from < nodeOf[start]) edges.push({ points: [nodes[from], nodes[nodeOf[start]]], a: from, b: nodeOf[start] });
        continue;
      }
      if (visited[start]) continue;
      const path: Pt[] = [nodes[from]];
      let prev = p, cur = start, to = -1;
      for (;;) {
        visited[cur] = 1;
        path.push(centre(cur, w));
        const next = neighbours(sk, w, h, cur).filter((q) => q !== prev && !(nodeOf[q] === from && path.length < 3));
        const toNode = next.find((q) => nodeOf[q] >= 0);
        if (toNode !== undefined) { to = nodeOf[toNode]; break; }
        const cont = next.find((q) => !visited[q]);
        if (cont === undefined) break;
        prev = cur;
        cur = cont;
      }
      if (to >= 0) path.push(nodes[to]);
      edges.push({ points: path, a: from, b: to });
    }
  }
  // Chains with no node: closed loops (an "O", a ring drawn as a circle), and open
  // chains whose ends thinned into tiny forks (no pixel reads as an end).
  const walk = (start: number, first: number): number[] => {
    const out: number[] = [];
    let prev = start, cur = first;
    for (;;) {
      visited[cur] = 1;
      out.push(cur);
      const next = neighbours(sk, w, h, cur).filter((q) => q !== prev && !visited[q]);
      if (!next.length) return out;
      prev = cur;
      cur = next[0];
    }
  };
  for (let p = 0; p < sk.length; p++) {
    if (!sk[p] || visited[p] || nodeOf[p] >= 0 || !neighbours(sk, w, h, p).length) continue;
    visited[p] = 1;
    const dirs = neighbours(sk, w, h, p).filter((q) => !visited[q]);
    const one = dirs.length ? walk(p, dirs[0]) : [];
    const rest = neighbours(sk, w, h, p).filter((q) => !visited[q]);
    const two = rest.length ? walk(p, rest[0]) : [];
    const chain = [...two.reverse(), p, ...one].map((q) => centre(q, w));
    const a = chain[0], b = chain[chain.length - 1];
    const closed = chain.length > 3 && Math.hypot(a.x - b.x, a.y - b.y) < 1.6;
    if (closed) chain.push(a);
    edges.push({ points: chain, a: -1, b: -1, closed });
  }
  return { nodes, edges, dots };
}

const len = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

/**
 * Removes spurs (edges from a junction to a free end shorter than `maxLen`, the
 * frayed ends thinning leaves on thick strokes) and joins edges through nodes that
 * are left with two edges. Repeats until nothing changes.
 */
export function pruneAndJoin(g: SkelGraph, maxLen: number): SkelGraph {
  let edges = g.edges.map((e) => ({ ...e, points: e.points.slice() }));
  const degree = () => {
    const d = new Map<number, number>();
    for (const e of edges) for (const n of [e.a, e.b]) if (n >= 0) d.set(n, (d.get(n) ?? 0) + 1);
    return d;
  };
  for (let changed = true; changed;) {
    changed = false;
    const d = degree();
    const keep = edges.filter((e) => {
      const free = (n: number) => n >= 0 && d.get(n) === 1;
      const junction = (n: number) => n >= 0 && (d.get(n) ?? 0) >= 3;
      const spur = (free(e.a) && junction(e.b)) || (free(e.b) && junction(e.a));
      return !(spur && len(e.points) < maxLen);
    });
    if (keep.length !== edges.length) { edges = keep; changed = true; continue; }
    // Join two edges through a node of degree two.
    for (const [n, k] of d) {
      if (k !== 2) continue;
      const pair = edges.filter((e) => e.a === n || e.b === n);
      if (pair.length !== 2 || pair[0] === pair[1]) continue;
      const [e1, e2] = pair;
      const p1 = e1.b === n ? e1.points : e1.points.slice().reverse();
      const p2 = e2.a === n ? e2.points : e2.points.slice().reverse();
      const a = e1.b === n ? e1.a : e1.b;
      const b = e2.a === n ? e2.b : e2.a;
      const joined: SkelEdge = { points: [...p1, ...p2.slice(1)], a, b };
      if (a === b && a >= 0) joined.a = joined.b = a;
      edges = edges.filter((e) => e !== e1 && e !== e2);
      edges.push(joined);
      changed = true;
      break;
    }
  }
  return { nodes: g.nodes, edges, dots: g.dots };
}

/** Ramer–Douglas–Peucker simplification. */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  // A closed loop (an "O"): simplify each half, or the whole collapses to its end points.
  const first = pts[0], last = pts[pts.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6 && pts.length > 4) {
    const mid = Math.floor(pts.length / 2);
    return [...simplify(pts.slice(0, mid + 1), eps), ...simplify(pts.slice(mid), eps).slice(1)];
  }
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const a = pts[i], b = pts[j];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    let best = -1, bestD = eps;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((pts[k].x - a.x) * dy - (pts[k].y - a.y) * dx) / L;
      if (d > bestD) { bestD = d; best = k; }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([i, best], [best, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

/** Direction in which an edge leaves node `n` (from points up to `reach` px away). */
function leaving(e: SkelEdge, n: number, reach: number): Pt {
  const pts = e.a === n ? e.points : e.points.slice().reverse();
  const p0 = pts[0];
  let q = pts[pts.length - 1];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc >= reach) { q = pts[i]; break; }
  }
  const dx = q.x - p0.x, dy = q.y - p0.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/**
 * Strokes that cross or touch in the image meet at skeleton junctions, while a pen
 * draws them separately. Two branches that continue each other in a straight line
 * ("good continuation", deviation below `maxDev`) are joined into one stroke when
 * what meets them there is not a bond:
 *   - at a T, when the third branch is curved (the tail of a curved arrow starting on
 *     a bond) or short (part of a letter); a straight bond-long third branch means an
 *     atom with two collinear bonds, which stay separate;
 *   - at a crossing, unless all four branches are straight lines (a quaternary carbon
 *     drawn as a cross keeps its four bonds).
 */
export function joinContinuations(g: SkelGraph, bondPx: number, maxDev = (32 * Math.PI) / 180): SkelGraph {
  let edges = g.edges.slice();
  const reach = Math.max(4, 0.15 * bondPx);
  const shape = (e: SkelEdge) => {
    const l = len(e.points);
    const c = Math.hypot(e.points[e.points.length - 1].x - e.points[0].x, e.points[e.points.length - 1].y - e.points[0].y);
    return { long: l > 0.35 * bondPx, straight: c / Math.max(l, 1e-9) > 0.93 };
  };
  const bondLike = (e: SkelEdge) => {
    const s = shape(e);
    return s.long && s.straight;
  };
  for (let changed = true; changed;) {
    changed = false;
    const at = new Map<number, SkelEdge[]>();
    for (const e of edges) {
      if (e.a === e.b) continue;
      for (const n of [e.a, e.b]) if (n >= 0) at.set(n, [...(at.get(n) ?? []), e]);
    }
    for (const [n, es] of at) {
      if (es.length < 3) continue;
      let best: { i: number; j: number; dev: number } | null = null;
      for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
        const others = es.filter((_, k) => k !== i && k !== j);
        // Only when something other than bonds meets the pair here, or when one of the
        // pair is a stub too short to be a bond that continues a bond (the inner line of
        // a double bond touching the next bond splits it into a stub and the rest). Two
        // short halves (the stems of an H at its bar) stay apart.
        const stub = (!shape(es[i]).long && bondLike(es[j])) || (!shape(es[j]).long && bondLike(es[i]));
        if (!stub && others.every(bondLike) && (es.length === 3 || (bondLike(es[i]) && bondLike(es[j])))) continue;
        const u = leaving(es[i], n, reach), v = leaving(es[j], n, reach);
        const dev = Math.PI - Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y)));
        if (dev < maxDev && (!best || dev < best.dev)) best = { i, j, dev };
      }
      if (!best) continue;
      const e1 = es[best.i], e2 = es[best.j];
      const p1 = e1.b === n ? e1.points : e1.points.slice().reverse();
      const p2 = e2.a === n ? e2.points : e2.points.slice().reverse();
      const joined: SkelEdge = { points: [...p1, ...p2.slice(1)], a: e1.b === n ? e1.a : e1.b, b: e2.a === n ? e2.b : e2.a };
      // The joined stroke passes through n; it no longer ends there.
      edges = edges.filter((e) => e !== e1 && e !== e2);
      edges.push(joined);
      changed = true;
      break;
    }
  }
  return { nodes: g.nodes, edges, dots: g.dots };
}
