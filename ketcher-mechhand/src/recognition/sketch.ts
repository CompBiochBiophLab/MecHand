/**
 * Online recognition of hand-drawn mechanisms: strokes → Scene.
 *
 * Pipeline (all in the browser, no server):
 *  1. Scale: estimate the drawn bond length L from straight segments.
 *  2. Arrowheads: in-stroke hooks or small separate "V" / barb strokes at the
 *     end of a long stroke. Curved shaft → electron-flow arrow (full head = 2 e⁻,
 *     single barb = 1 e⁻, fishhook); straight long shaft → reaction arrow; two
 *     antiparallel straight shafts with half heads → equilibrium arrows. Heads
 *     the rules miss (triangles, two separate barbs, personal styles) are
 *     classified by the arrowhead model, which learns from Teach samples.
 *  3. Text: small strokes are clustered, split into characters and classified
 *     with the $P recognizer (atom labels, + and − charges).
 *  4. Bonds: remaining strokes are split at corners (ShortStraw), so zig-zag
 *     chains and rings can be drawn in one stroke. Near-parallel close segments
 *     merge into double/triple bonds; endpoints cluster into atoms.
 *  5. Labels and charges attach to the nearest atom; isolated labels become
 *     atoms of their own ("Cl⁻"); isolated "+" between species become pluses.
 *  6. Electron-flow arrows are anchored to the nearest atom or bond (Marvin-style
 *     semantics), which the mechanism checker uses.
 */

import type { Scene, SceneArrow, SceneAtom, SceneBond } from '../scene/types';
import type { Match, PointCloudRecognizer } from './dollarP';
import type { InkStyle } from './elements';
import {
  type BBox, type Pt, type Segment,
  angleBetween, bbox, bboxCenter, bboxDiag, bboxGap, dist, endDirection, pathLength,
  pointSegment, resampleBySpacing, robustStraightness, segLength, shortStraw, straightness, toShaftFrame, vec,
} from './geometry';

export interface InkStroke {
  points: Pt[];
}

export type StrokeRole = 'bond' | 'arrow' | 'arrowhead' | 'text' | 'dot' | 'ignored';

export interface RecognizedLabel {
  text: string;
  score: number;
  center: Pt;
  /** Index of the atom it was attached to (or created), -1 for pluses. */
  atom: number;
}

/** Where an electron-flow arrow starts or ends, in Scene indices. */
export type ArrowAnchor =
  | { type: 'atom'; atom: number }
  | { type: 'bond'; bond: number }
  | { type: 'none' };

export interface RecognizedArrow {
  arrow: SceneArrow;
  from: ArrowAnchor;
  to: ArrowAnchor;
}

export interface SketchResult {
  scene: Scene;
  roles: StrokeRole[];
  labels: RecognizedLabel[];
  arrows: RecognizedArrow[];
  /** Drawn bond length in pixels (1 Ketcher unit). */
  bondLengthPx: number;
  /** Stroke scale used for classification (px), for diagnostics. */
  scalePx: number;
  /** 0..1 rough overall confidence. */
  confidence: number;
}

export interface SketchOptions {
  /** Fallback bond length in px when no straight bond is drawn. */
  defaultBondPx?: number;
  /** Minimum $P score to accept a character. */
  minSymbolScore?: number;
  /** Known bond length in px (skips the scale estimate; used by the Teach box). */
  bondPx?: number;
  /** Arrowhead model (shaft frame, "full" / "half"): see SymbolModel.heads. */
  heads?: PointCloudRecognizer;
  /** Drawing style learned in Teach mode. */
  style?: InkStyle;
  /** Minimum arrowhead-model score (tuning). */
  headMinScore?: number;
  /** Diagnostics callback (development only). */
  debug?: (what: string, data: unknown) => void;
}

// Element symbols the label decoder accepts (case-sensitive).
const ELEMENTS = new Set([
  'H', 'B', 'C', 'N', 'O', 'F', 'P', 'S', 'K', 'I', 'Cl', 'Br', 'Si', 'Li', 'Na', 'Al', 'Pt', 'Pd', 'Ni',
  'Fe', 'Co', 'Cu', 'Zn', 'Mg', 'Ca', 'Sn', 'Se', 'Rh', 'Ru', 'Ir', 'Ti', 'Mn', 'Cr', 'Ag', 'Au', 'Hg', 'R',
]);

// Shapes that look alike map to several letters; the decoder picks the valid one.
const SHAPE_LETTERS: Record<string, string[]> = {
  I: ['I', 'l'], O: ['O', 'o'], C: ['C', 'c'], S: ['S', 's'], P: ['P', 'p'], K: ['K', 'k'],
  r: ['r'], i: ['i'], t: ['t'], a: ['a'], H: ['H'], N: ['N'], F: ['F'], B: ['B'], L: ['L'],
  e: ['e'], n: ['n'], u: ['u'], g: ['g'], d: ['d'], h: ['h'], M: ['M'], Z: ['Z'], A: ['A'],
  '2': ['2'], '3': ['3'], '4': ['4'],
};

interface CharGuess {
  options: { ch: string; score: number }[];
  box: BBox;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function recognizeSketch(
  strokes: InkStroke[],
  symbols: PointCloudRecognizer,
  opts: SketchOptions = {},
): SketchResult {
  const minScore = opts.minSymbolScore ?? 0.6;
  const n = strokes.length;
  const roles: StrokeRole[] = new Array(n).fill('ignored');
  const pts = strokes.map((s) => s.points.filter((p, i, a) => i === 0 || dist(p, a[i - 1]) > 0.01));
  const boxes = pts.map(bbox);
  const lengths = pts.map(pathLength);

  // 1. Scale and shape ----------------------------------------------------------
  const straws = pts.map((p) => (p.length >= 2 ? shortStraw(p) : { points: p, corners: [0] }));
  const pieces = straws.map(({ points: rp, corners }) => {
    const out: { seg: Segment; st: number; len: number }[] = [];
    for (let k = 1; k < corners.length; k++) {
      const piece = rp.slice(corners[k - 1], corners[k] + 1);
      if (piece.length < 2) continue;
      out.push({ seg: { a: piece[0], b: piece[piece.length - 1] }, st: robustStraightness(piece), len: pathLength(piece) });
    }
    return out;
  });
  let L = opts.bondPx ?? estimateScale(pts, straws, lengths, boxes, opts.defaultBondPx ?? 60);

  // Bond-like = every piece straight and long; a zig-zag chain or a polygon ring
  // qualifies, letters (short or curved pieces) do not.
  const straightLong = (i: number, scale: number) =>
    pieces[i].length > 0 && pieces[i].every((p) => p.st > 0.93 && p.len > 0.4 * scale);
  const compact = (i: number, scale: number) => bboxDiag(boxes[i]) < 0.9 * scale && lengths[i] < 2.2 * scale;

  // A short straight stroke that overlaps a letter-like stroke is part of that
  // letter (the stem of a "B", the bar of an "H"), not a bond.
  const partOfLetter = new Set<number>();
  const markLetterParts = (scale: number) => {
    partOfLetter.clear();
    const letterish = [...Array(n).keys()].filter((i) => !straightLong(i, scale) && compact(i, scale));
    for (let i = 0; i < n; i++) {
      if (!straightLong(i, scale) || lengths[i] > 0.85 * scale) continue;
      // Both ends inside the letter's box (a bond only touches it with one end).
      const first = pts[i][0], last = pts[i][pts[i].length - 1];
      const touches = letterish.some((j) => {
        const b = boxes[j], m = 0.12 * scale;
        const inside = (p: Pt) => p.x > b.x - m && p.x < b.x + b.w + m && p.y > b.y - m && p.y < b.y + b.h + m;
        return inside(first) && inside(last);
      });
      if (touches) partOfLetter.add(i);
    }
    // A short upright stroke beside a letter, as tall as the letter and level
    // with it, is the next letter (the l of "Cl", the I of "Il"), not a bond.
    for (const i of [...Array(n).keys()]) {
      if (!straightLong(i, scale) || lengths[i] > 0.85 * scale) continue;
      const bi = boxes[i];
      if (bi.w > 0.4 * bi.h) continue;
      const besideLetter = letterish.some((j) => {
        const bj = boxes[j];
        const gapX = Math.max(bj.x - (bi.x + bi.w), bi.x - (bj.x + bj.w));
        const overlapY = Math.min(bi.y + bi.h, bj.y + bj.h) - Math.max(bi.y, bj.y);
        return gapX < 0.3 * scale && overlapY > 0.7 * bi.h && bi.h < 1.4 * bj.h;
      });
      if (besideLetter) partOfLetter.add(i);
    }
    // Strokes meeting end to end at an acute angle are a letter (N, M, Z, V):
    // bonds never meet at less than 60° (cyclopropane), letters often do.
    const shortish = [...Array(n).keys()].filter((i) => pieces[i].length === 1 && pieces[i][0].st > 0.93 && lengths[i] < 0.55 * scale);
    for (const i of shortish) for (const j of shortish) {
      if (i >= j) continue;
      for (const p of [pts[i][0], pts[i][pts[i].length - 1]]) for (const q of [pts[j][0], pts[j][pts[j].length - 1]]) {
        if (dist(p, q) > 0.12 * scale) continue;
        const pi = p === pts[i][0] ? pts[i][pts[i].length - 1] : pts[i][0];
        const qj = q === pts[j][0] ? pts[j][pts[j].length - 1] : pts[j][0];
        if (angleBetween(vec(p, pi), vec(q, qj)) < (50 * Math.PI) / 180) { partOfLetter.add(i); partOfLetter.add(j); }
      }
    }
    // Short straight strokes that cross each other or meet in a T are letters
    // (+, H, F, t, K…); bonds meet only end to end. Then strokes touching a
    // letter part with an end are letter parts too (the top bar of an F).
    // Letter-sized straight strokes only (≤ ~0.5 L): a bond that stops next to a
    // letter stem would otherwise look like the bar of a T.
    const short = [...Array(n).keys()].filter((i) => pieces[i].length > 0 && pieces[i].every((p) => p.st > 0.93) && lengths[i] < 0.55 * scale);
    const ends = (i: number) => [pts[i][0], pts[i][pts[i].length - 1]];
    const tJunction = (i: number, j: number) =>
      ends(i).some((p) => {
        const { d, t } = pointSegment(p, pts[j][0], pts[j][pts[j].length - 1]);
        return d < 0.1 * scale && t > 0.2 && t < 0.8;
      });
    for (const i of short) for (const j of short) {
      if (i !== j && (tJunction(i, j) || crosses(pts[i], pts[j]))) { partOfLetter.add(i); partOfLetter.add(j); }
    }
    for (let changed = true; changed;) {
      changed = false;
      for (const i of short) {
        if (partOfLetter.has(i)) continue;
        const touchesPart = [...partOfLetter].some((j) =>
          ends(i).some((p) => ends(j).some((q) => dist(p, q) < 0.1 * scale)) || tJunction(i, j));
        if (touchesPart) { partOfLetter.add(i); changed = true; }
      }
    }
  };
  const bondLike = (i: number, scale: number) => straightLong(i, scale) && !partOfLetter.has(i);

  // 2. Arrows ---------------------------------------------------------------
  // Detected twice: first with the rough scale, so that long reaction arrows can
  // be excluded from the bond-length estimate, then again with the refined scale.
  type Found = { shaft: Pt[]; barbs: number; kindHint: 'curved' | 'straight' | 'equilibrium' };
  const detectArrows = (scale: number): Found[] => {
    for (let i = 0; i < n; i++) if (roles[i] === 'arrow' || roles[i] === 'arrowhead') roles[i] = 'ignored';
    markLetterParts(scale);
    const small = (i: number) => !bondLike(i, scale) && compact(i, scale);
    const found: Found[] = [];
    const headUsed = new Set<number>();
    // Straight shafts with a half head: half of an equilibrium pair, if a partner exists.
    const harpoons: { i: number; shaft: Pt[]; head: number[] }[] = [];
    // Longest strokes first, so an arrow claims its head before a nearby letter can.
    const order = [...Array(n).keys()].sort((a, b) => lengths[b] - lengths[a]);
    for (const i of order) {
      if (roles[i] !== 'ignored' || pts[i].length < 2 || partOfLetter.has(i)) continue;
      // Electron-flow arrows span at least most of a bond; shorter strokes are letters.
      if (lengths[i] < 0.75 * scale) continue;
      const inStroke = splitInStrokeHead(pts[i], scale);
      // A closed loop is a letter (O), not a shaft; judged on the shaft, because
      // a head drawn in the same stroke brings the end back towards the tip.
      if (straightness(inStroke ? inStroke.shaft : pts[i]) < 0.3) continue;
      let shaft = inStroke ? inStroke.shaft : pts[i];
      let barbs = inStroke ? inStroke.barbs : 0;
      let head: SeparateHead | null = null;
      // Cheap rejections first (most strokes here are bonds): a straight stroke
      // shorter than a reaction arrow, or one with a sharp corner, is no shaft.
      if (!inStroke && ((straightness(shaft) > 0.93 && pathLength(shaft) < 1.2 * scale) || !smooth(shaft, scale, false))) continue;
      if (!inStroke) {
        // Separate head stroke(s) near either end of this stroke?
        head = findSeparateHead(i, pts, boxes, roles, headUsed, small, scale, opts.heads, opts.headMinScore ?? HEAD_MIN_SCORE, opts.debug);
        if (head) {
          barbs = head.barbs;
          if (head.atStart) shaft = shaft.slice().reverse();
        }
      }
      if (barbs === 0 || !smooth(shaft, scale, Boolean(inStroke))) continue;
      // Judge straightness without the tip region (an in-stroke head can bend it).
      const body = inStroke ? trimEnd(shaft, 0.2 * scale) : shaft;
      const kindHint = straightness(body) > 0.93 ? 'straight' : 'curved';
      // Reaction arrows are long and have a full head; a long bond with a charge
      // sign near its end is not one.
      if (kindHint === 'straight' && pathLength(shaft) < 1.2 * scale) continue;
      if (kindHint === 'straight' && barbs < 2) {
        harpoons.push({ i, shaft, head: head?.strokes ?? [] });
        continue;
      }
      if (head) {
        head.strokes.forEach((h) => { headUsed.add(h); roles[h] = 'arrowhead'; });
      }
      roles[i] = 'arrow';
      opts.debug?.('arrow', { stroke: i, barbs, kindHint, head: head?.strokes ?? 'in-stroke' });
      found.push({ shaft, barbs, kindHint });
    }
    // Equilibrium (⇌): two antiparallel, side-by-side straight shafts with half heads.
    const paired = new Set<number>();
    for (let a = 0; a < harpoons.length; a++) for (let b = a + 1; b < harpoons.length; b++) {
      const A = harpoons[a], B = harpoons[b];
      if (paired.has(a) || paired.has(b) || [...A.head, ...B.head].some((h) => headUsed.has(h) || roles[h] !== 'ignored')) continue;
      const pair = equilibriumPair(A.shaft, B.shaft, scale);
      if (!pair) continue;
      paired.add(a);
      paired.add(b);
      for (const h of [...A.head, ...B.head]) { headUsed.add(h); roles[h] = 'arrowhead'; }
      roles[A.i] = roles[B.i] = 'arrow';
      found.push({ shaft: pair, barbs: 1, kindHint: 'equilibrium' });
    }
    return found;
  };
  detectArrows(L);

  // Refine the scale without the arrows found so far.
  const notArrow = (i: number) => roles[i] === 'ignored';
  L = opts.bondPx ?? estimateScale(pts, straws, lengths, boxes, L, notArrow);
  const recognizedArrows = detectArrows(L);
  opts.debug?.('letterParts', { scale: L, parts: [...partOfLetter] });

  // Dots: tiny strokes (lone pairs, radical dots, the dot of an "i"). Someone who
  // draws larger dots (Teach mode) gets a larger limit, up to a bound that keeps a
  // small "−" a charge; such larger dots must also be roundish, not a dash.
  const dotDiag = Math.min(0.16, Math.max(0.1, 1.25 * (opts.style?.dotDiag ?? 0))) * L;
  const dotLen = Math.min(0.45, Math.max(0.2, 1.25 * (opts.style?.dotLength ?? 0))) * L;
  for (let i = 0; i < n; i++) {
    if (roles[i] !== 'ignored') continue;
    const b = boxes[i], d = bboxDiag(b);
    if (d < 0.1 * L && lengths[i] < 0.2 * L) roles[i] = 'dot';
    else if (d < dotDiag && lengths[i] < dotLen && Math.min(b.w, b.h) > 0.4 * Math.max(b.w, b.h)) roles[i] = 'dot';
  }

  // Text candidates: compact strokes that are not straight bond lines.
  const isSmall = (i: number) => roles[i] !== 'dot' && !bondLike(i, L) && compact(i, L);

  // 3. Text clusters -----------------------------------------------------------
  const textIdx = [...Array(n).keys()].filter((i) => roles[i] === 'ignored' && isSmall(i));
  const dotIdx = [...Array(n).keys()].filter((i) => roles[i] === 'dot');
  const clusters = clusterBoxes(textIdx, boxes, 0.22 * L);
  const labelGuesses = clusters.map((cluster) => {
    cluster.forEach((i) => (roles[i] = 'text'));
    // Attach to this cluster the tiny marks in its upper half that belong to the
    // text: the dot of an "i" (above a narrow stem) and a dash-like "−" written
    // very small. A round dot beside a letter is a radical or a lone pair.
    const cb = unionBox(cluster.map((i) => boxes[i]));
    const stems = cluster.map((i) => boxes[i]).filter((b) => b.w < 0.45 * b.h);
    const dots = dotIdx.filter((d) => {
      const b = boxes[d], c = bboxCenter(b);
      if (bboxGap(b, cb) >= 0.15 * L || b.y + b.h > cb.y + cb.h * 0.5) return false;
      return b.w > 2.5 * b.h || stems.some((s) => c.x > s.x - 0.1 * L && c.x < s.x + s.w + 0.1 * L);
    });
    dots.forEach((d) => (roles[d] = 'text'));
    return readLabel([...cluster, ...dots], pts, boxes, L, symbols, minScore);
  });

  // 4. Bonds ----------------------------------------------------------------
  const segments: (Segment & { stroke: number })[] = [];
  for (let i = 0; i < n; i++) {
    if (roles[i] !== 'ignored' || pts[i].length < 2) continue;
    // Keep the straight pieces; a round closed stroke (aromatic circle) or a
    // scribble contributes none and stays 'ignored'.
    const straight = pieces[i].filter((p) => p.st > 0.9 && p.len > 0.35 * L);
    if (straight.length === 0 || straight.length < pieces[i].length / 2) continue;
    roles[i] = 'bond';
    segments.push(...straight.map((p) => ({ ...p.seg, stroke: i })));
  }
  const bondSegs = mergeMultipleBonds(segments, L);
  const { atoms: nodePts, bonds: rawBonds } = buildGraph(bondSegs, L);

  // 5. Scene assembly -----------------------------------------------------------
  // Atoms are placed in pixels first: at bond vertices, moved to the centre of
  // their label when one is attached (the label marks where the atom is).
  const pos: Pt[] = nodePts.slice();
  const atoms: SceneAtom[] = nodePts.map(() => ({ symbol: 'C', x: 0, y: 0, charge: 0, molecule: 0 }));
  const bonds: SceneBond[] = rawBonds.map((b) => ({ begin: b.begin, end: b.end, order: b.order }));
  const plusPx: Pt[] = [];
  const labels: RecognizedLabel[] = [];

  const removed = new Set<number>();
  labelGuesses.forEach((g, ci) => {
    if (!g) return;
    const center = bboxCenter(unionBox(clusters[ci].map((i) => boxes[i])));
    const nearest = nearestNode(center, pos.map((p, k) => (removed.has(k) ? { x: Infinity, y: Infinity } : p)));
    if (!g.element && g.charge !== 0) {
      // A charge is written as a superscript at the upper right of its atom:
      // among atoms within reach, prefer those the sign sits up and to the right of.
      let target = -1, bestCost = Infinity;
      pos.forEach((p, k) => {
        if (removed.has(k)) return;
        const d = dist(p, center);
        if (d > 0.85 * L) return;
        const cost = d / L + (center.x < p.x - 0.05 * L ? 0.4 : 0) + (center.y > p.y + 0.1 * L ? 0.2 : 0);
        if (cost < bestCost) { bestCost = cost; target = k; }
      });
      if (target >= 0) {
        atoms[target].charge += g.charge;
        labels.push({ text: g.text, score: g.score, center, atom: target });
      } else if (g.charge > 0) {
        plusPx.push(center);
        labels.push({ text: '+', score: g.score, center, atom: -1 });
      }
      return;
    }
    if (!g.element) return;
    // Labels sit on a bond end (vertex) or stand alone (ions, metals, H₂O…).
    const vertex = nearest && nearest.index < nodePts.length && nearest.d < 0.6 * L ? nearest.index : -1;
    if (vertex >= 0 && atoms[vertex].symbol === 'C') {
      atoms[vertex].symbol = g.element;
      atoms[vertex].charge += g.charge;
      pos[vertex] = center;
      labels.push({ text: g.text, score: g.score, center, atom: vertex });
      // Bonds stop short of a label, so the ends of several bonds to the same
      // labelled atom (B in BF3, a metal centre) need not meet: all bare bond
      // ends close to the label belong to that atom.
      for (let k = 0; k < nodePts.length; k++) {
        if (k === vertex || removed.has(k) || atoms[k].symbol !== 'C' || atoms[k].charge !== 0) continue;
        if (dist(nodePts[k], center) < 0.5 * L) {
          bonds.forEach((b) => {
            if (b.begin === k) b.begin = vertex;
            if (b.end === k) b.end = vertex;
          });
          removed.add(k);
        }
      }
    } else {
      atoms.push({ symbol: g.element, x: 0, y: 0, charge: g.charge, molecule: 0 });
      pos.push(center);
      labels.push({ text: g.text, score: g.score, center, atom: atoms.length - 1 });
    }
  });

  // Radical dots: a single dot next to an atom (pairs are lone pairs, ignored).
  for (const d of dotIdx) {
    if (roles[d] !== 'dot') continue;
    const c = bboxCenter(boxes[d]);
    const near = nearestNode(c, pos);
    const otherDots = dotIdx.filter((e) => e !== d && roles[e] === 'dot' && dist(bboxCenter(boxes[e]), c) < 0.2 * L);
    if (near && near.d < 0.5 * L && otherDots.length === 0) atoms[near.index].radical = 2;
  }

  // Drop merged vertices; drop bonds that became loops or duplicates.
  if (removed.size) {
    const keep = atoms.map((_, i) => i).filter((i) => !removed.has(i));
    const newIndex = new Map(keep.map((old, i) => [old, i]));
    const kept = keep.map((i) => atoms[i]);
    const keptPos = keep.map((i) => pos[i]);
    const seenBonds = new Set<string>();
    const keptBonds = bonds
      .map((b) => ({ ...b, begin: newIndex.get(b.begin)!, end: newIndex.get(b.end)! }))
      .filter((b) => {
        const key = [Math.min(b.begin, b.end), Math.max(b.begin, b.end)].join('-');
        if (b.begin === b.end || seenBonds.has(key)) return false;
        seenBonds.add(key);
        return true;
      });
    labels.forEach((l) => { if (l.atom >= 0) l.atom = newIndex.get(l.atom) ?? -1; });
    atoms.splice(0, atoms.length, ...kept);
    pos.splice(0, pos.length, ...keptPos);
    bonds.splice(0, bonds.length, ...keptBonds);
  }

  // Final scale: median distance between bonded atom centres (= 1 Ketcher unit).
  const centreDists = bonds.map((b) => dist(pos[b.begin], pos[b.end])).sort((p, q) => p - q);
  const unit = centreDists.length ? centreDists[Math.floor(centreDists.length / 2)] : L;
  const origin = sceneOrigin(pts.flat());
  const toUnit = (p: Pt) => ({ x: (p.x - origin.x) / unit, y: -(p.y - origin.y) / unit });
  atoms.forEach((a, i) => Object.assign(a, toUnit(pos[i])));
  const pluses = plusPx.map(toUnit);
  assignMolecules(atoms, bonds);

  // Arrows → Scene arrows anchored to atoms/bonds.
  const arrows: RecognizedArrow[] = recognizedArrows.map(({ shaft, barbs, kindHint }) => {
    const startPx = shaft[0];
    const endPx = shaft[shaft.length - 1];
    const start = toUnit(startPx), end = toUnit(endPx);
    let arrow: SceneArrow;
    if (kindHint === 'equilibrium') {
      arrow = { kind: 'equilibrium', start, end, mode: 'equilibrium-open-half-angle' };
    } else if (kindHint === 'straight') {
      arrow = { kind: 'reaction', start, end, mode: 'open-angle' };
    } else {
      const height = signedBulge(shaft.map(toUnit), start, end);
      const single = barbs === 1;
      arrow = {
        kind: single ? 'single-electron' : 'electron-pair',
        start, end, height,
        mode: single ? 'elliptical-arc-arrow-open-half-angle' : 'elliptical-arc-arrow-open-angle',
      };
    }
    return {
      arrow,
      from: kindHint === 'curved' ? anchorFor(start, atoms, bonds) : { type: 'none' },
      to: kindHint === 'curved' ? anchorFor(end, atoms, bonds) : { type: 'none' },
    };
  });

  const scene: Scene = { atoms, bonds, arrows: arrows.map((a) => a.arrow), pluses };
  const interpreted = roles.filter((r) => r !== 'ignored').length;
  const labelScore = labels.length ? labels.reduce((a, l) => a + l.score, 0) / labels.length : 1;
  const confidence = n === 0 ? 0 : (interpreted / n) * 0.6 + labelScore * 0.4;

  return { scene, roles, labels, arrows, bondLengthPx: unit, scalePx: L, confidence };
}

// ── Scale ────────────────────────────────────────────────────────────────────

function estimateBondLength(
  pts: Pt[][], straws: { points: Pt[]; corners: number[] }[], lengths: number[], fallback: number,
  include: (i: number) => boolean = () => true,
): number {
  const candidates: number[] = [];
  pts.forEach((p, i) => {
    if (p.length < 2 || lengths[i] < 12 || !include(i)) return;
    const { points: rp, corners } = straws[i];
    for (let k = 1; k < corners.length; k++) {
      const piece = rp.slice(corners[k - 1], corners[k] + 1);
      if (piece.length >= 2 && straightness(piece) > 0.95) candidates.push(dist(piece[0], piece[piece.length - 1]));
    }
  });
  if (candidates.length === 0) return fallback;
  candidates.sort((a, b) => a - b);
  // Upper median: letters produce many short segments, bonds are the long ones.
  const longOnes = candidates.filter((c) => c >= candidates[candidates.length - 1] * 0.45);
  return longOnes[Math.floor(longOnes.length / 2)];
}

/** Typical capital-letter height as a fraction of the bond length. */
const LETTER_TO_BOND = 0.38;

/**
 * Bond length from two cues: straight bond pieces, and the height of clearly
 * letter-like strokes (curly and compact: C, O, S, B, r…). With few bonds the
 * straight-piece estimate is easily fooled by the straight parts of letters
 * (l, H, +), so the letter height decides unless both cues agree.
 */
function estimateScale(
  pts: Pt[][], straws: { points: Pt[]; corners: number[] }[], lengths: number[], boxes: BBox[],
  fallback: number, include: (i: number) => boolean = () => true,
): number {
  const fromBonds = estimateBondLength(pts, straws, lengths, fallback, include);
  const letterHeights = pts
    .map((p, i) => ({ i, h: boxes[i].h, curly: lengths[i] / Math.max(1, bboxDiag(boxes[i])) }))
    .filter(({ i, curly }) => include(i) && pts[i].length > 3 && lengths[i] > 6 && curly > 1.45 && straightness(pts[i]) < 0.85)
    .map(({ h }) => h)
    .sort((a, b) => a - b);
  if (letterHeights.length < 2) return fromBonds;
  // Capitals are the tallest letters: take the upper quartile, after dropping
  // outliers far above the median (rings drawn in one go).
  const median = letterHeights[Math.floor(letterHeights.length / 2)];
  const kept = letterHeights.filter((h) => h <= 2.5 * median);
  const fromLetters = kept[Math.min(kept.length - 1, Math.floor(0.75 * kept.length))] / LETTER_TO_BOND;
  const ratio = fromBonds / fromLetters;
  return ratio > 0.75 && ratio < 1.5 ? fromBonds : fromLetters;
}

// ── Arrowheads ───────────────────────────────────────────────────────────────

/**
 * Arrowhead drawn without lifting the pen: the stroke ends with one or two
 * short segments that turn back sharply. Returns the shaft and the barb count.
 */
export function splitInStrokeHead(raw: Pt[], L: number): { shaft: Pt[]; barbs: number } | null {
  if (pathLength(raw) < 0.75 * L) return null;
  // Examine the last ~L of the stroke at a fine resolution (heads are small).
  let acc = 0, from = raw.length - 1;
  while (from > 0 && acc < L) {
    acc += dist(raw[from], raw[from - 1]);
    from--;
  }
  const tail = resampleBySpacing(raw.slice(from), Math.max(1, L / 30));
  const remain: number[] = new Array(tail.length).fill(0);
  for (let i = tail.length - 2; i >= 0; i--) remain[i] = remain[i + 1] + dist(tail[i], tail[i + 1]);

  const W = 3;
  const sharp = (i: number) =>
    angleBetween(vec(tail[Math.max(0, i - W)], tail[i]), vec(tail[i], tail[Math.min(tail.length - 1, i + W)])) >
    (105 * Math.PI) / 180;
  // Tip: the first sharp reversal after which only a short barb section remains.
  let tip = -1;
  for (let i = W; i < tail.length - 2; i++) {
    if (remain[i] < 0.75 * L && remain[i] > 0.1 * L && sharp(i)) {
      // Take the sharpest point of this turning region.
      let j = i;
      while (j + 1 < tail.length - 1 && sharp(j + 1) && dist(tail[j + 1], tail[i]) < 0.08 * L) j++;
      tip = Math.round((i + j) / 2);
      break;
    }
  }
  if (tip < 0) return null;
  // More sharp turns after the tip (barb end, back through the tip) = full head.
  let turns = 0;
  for (let i = tip + 2 * W; i < tail.length - 2; i++) {
    if (sharp(i)) {
      turns++;
      i += 2 * W;
    }
  }
  const shaft = [...raw.slice(0, from + 1), ...tail.slice(1, tip + 1)];
  if (pathLength(shaft) < 0.6 * L) return null;
  return { shaft, barbs: turns >= 1 ? 2 : 1 };
}

type SeparateHead = { strokes: number[]; barbs: number; atStart: boolean };

/** Minimum arrowhead-model score to accept a head the geometric rules missed. */
const HEAD_MIN_SCORE = 0.78;

/**
 * A small "V" (2 barbs) or a single short stroke (1 barb) at an end of stroke i.
 * When these rules find no head, or only one barb, the strokes touching the end
 * are classified together, in the shaft frame, by the arrowhead model.
 */
function findSeparateHead(
  i: number, pts: Pt[][], boxes: BBox[], roles: StrokeRole[], used: Set<number>,
  isSmall: (j: number) => boolean, L: number, heads: PointCloudRecognizer | undefined, minScore: number,
  debug?: SketchOptions['debug'],
): SeparateHead | null {
  const shaft = pts[i];
  const ends = [
    { p: shaft[shaft.length - 1], atStart: false, dir: vec(shaft[Math.max(0, shaft.length - 6)], shaft[shaft.length - 1]) },
    { p: shaft[0], atStart: true, dir: vec(shaft[Math.min(shaft.length - 1, 5)], shaft[0]) },
  ];
  let best: { stroke: number; barbs: number; atStart: boolean; d: number } | null = null;
  for (let j = 0; j < pts.length; j++) {
    if (j === i || used.has(j) || roles[j] !== 'ignored' || !isSmall(j) || pts[j].length < 2) continue;
    if (bboxDiag(boxes[j]) > 0.55 * L) continue;
    const { points: hp, corners } = shortStraw(pts[j]);
    for (const end of ends) {
      if (corners.length === 3) {
        // "V": the vertex should be at the shaft end, legs pointing backwards.
        const vtx = hp[corners[1]];
        const d = dist(vtx, end.p);
        const legA = vec(vtx, hp[0]), legB = vec(vtx, hp[hp.length - 1]);
        const opening = angleBetween(legA, legB);
        const back = (angleBetween(legA, end.dir) + angleBetween(legB, end.dir)) / 2;
        if (d < 0.3 * L && opening > 0.35 && opening < 2.3 && back > 1.9) {
          if (!best || d < best.d) best = { stroke: j, barbs: 2, atStart: end.atStart, d };
        }
      } else if (corners.length === 2 && straightness(hp) > 0.9) {
        // Single barb: one end touches the shaft end, pointing backwards at an angle.
        const [a, b] = [hp[0], hp[hp.length - 1]];
        const near = dist(a, end.p) < dist(b, end.p) ? a : b;
        const far = near === a ? b : a;
        const d = dist(near, end.p);
        const ang = angleBetween(vec(near, far), end.dir);
        if (d < 0.25 * L && ang > 1.9 && ang < 2.95) {
          if (!best || d < best.d) best = { stroke: j, barbs: 1, atStart: end.atStart, d };
        }
      }
    }
  }
  let result: SeparateHead | null = best ? { strokes: [best.stroke], barbs: best.barbs, atStart: best.atStart } : null;
  if (heads && heads.size > 0 && (!result || result.barbs === 1)) {
    // Both ends: a single "barb" found by the rules can be a stray mark at the
    // tail while the real (full) head sits at the other end.
    for (const end of ends) {
      const dir = endDirection(shaft, end.atStart, 0.3 * L);
      const near: { j: number; d: number }[] = [];
      for (let j = 0; j < pts.length; j++) {
        if (j === i || used.has(j) || roles[j] !== 'ignored' || !isSmall(j) || pts[j].length < 2) continue;
        if (bboxDiag(boxes[j]) > 0.55 * L) continue;
        const ds = pts[j].map((p) => dist(p, end.p));
        const d = Math.min(...ds);
        if (d > 0.2 * L || Math.max(...ds) > 0.6 * L) continue;
        // A head lies behind its tip; a letter the arrow points at lies ahead.
        const local = toShaftFrame([pts[j]], end.p, dir)[0];
        if (local.reduce((a, p) => a + p.x, 0) / local.length < -0.02 * L) near.push({ j, d });
      }
      if (near.length === 0) continue;
      // The head is some of these strokes (a charge or a letter can be close by
      // too): try every group of up to three of the four closest, prefer a full head.
      const cands = near.sort((p, q) => p.d - q.d).slice(0, 4).map((c) => c.j);
      let full: { group: number[]; score: number } | null = null;
      let half: { group: number[]; score: number } | null = null;
      for (let mask = 1; mask < 1 << cands.length; mask++) {
        const group = cands.filter((_, k) => mask & (1 << k));
        if (group.length > 3) continue;
        const m = classifyHead(heads, group.map((j) => pts[j]), end.p, dir);
        debug?.('arrowhead', { shaft: i, group, match: m });
        if (!m || m.score < minScore) continue;
        if (m.symbol === 'full' && (!full || m.score > full.score)) full = { group, score: m.score };
        if (m.symbol === 'half' && (!half || m.score > half.score)) half = { group, score: m.score };
      }
      const pick = full ?? half;
      if (!pick) continue;
      const barbs = full ? 2 : 1;
      // A single barb found by the rules is replaced only by a head read as full.
      if (result && barbs < 2) continue;
      result = { strokes: pick.group, barbs, atStart: end.atStart };
      if (barbs === 2) break;
    }
  }
  return result;
}

/**
 * Arrowhead class of strokes at a tip. The shaft direction right at a hand-drawn
 * tip is uncertain (and heads are seldom drawn symmetric), so the frame is turned
 * by up to ±30° and the best match kept.
 */
function classifyHead(heads: PointCloudRecognizer, strokes: Pt[][], tip: Pt, dir: Pt): Match | undefined {
  const at = (deg: number): { deg: number; m?: Match } => {
    const a = (deg * Math.PI) / 180;
    const d = { x: dir.x * Math.cos(a) - dir.y * Math.sin(a), y: dir.x * Math.sin(a) + dir.y * Math.cos(a) };
    return { deg, m: heads.classify(toShaftFrame(strokes, tip, d), 1)[0] };
  };
  type Try = { deg: number; m?: Match };
  const better = (p: Try, q: Try): Try => ((q.m?.score ?? -1) > (p.m?.score ?? -1) ? q : p);
  // Coarse (10°), then refine around the best angle (±5°).
  let best = [-30, -20, -10, 0, 10, 20, 30].map(at).reduce(better);
  best = [best, at(best.deg - 5), at(best.deg + 5)].reduce(better);
  return best.m;
}

/**
 * Two straight shafts that form an equilibrium sign: antiparallel, side by side
 * and overlapping. Returns a shaft spanning both, in reading direction: ⇌ looks
 * the same turned by 180°, so "forward" is left to right (top to bottom when
 * vertical).
 */
function equilibriumPair(a: Pt[], b: Pt[], L: number): Pt[] | null {
  const ua = vec(a[0], a[a.length - 1]), ub = vec(b[0], b[b.length - 1]);
  const la = Math.hypot(ua.x, ua.y), lb = Math.hypot(ub.x, ub.y);
  if (la === 0 || lb === 0) return null;
  const da = { x: ua.x / la, y: ua.y / la };
  if ((da.x * ub.x + da.y * ub.y) / lb > -0.94) return null; // not antiparallel (±20°)
  const mid = (s: Pt[]) => ({ x: (s[0].x + s[s.length - 1].x) / 2, y: (s[0].y + s[s.length - 1].y) / 2 });
  const ma = mid(a), mb = mid(b);
  const off = vec(mb, ma);
  const side = da.x * off.y - da.y * off.x; // perpendicular offset of a from b
  if (Math.abs(side) > 0.6 * L || Math.abs(side) < 0.04 * L) return null;
  // Overlap of the two shafts along the common direction.
  const proj = (p: Pt) => (p.x - a[0].x) * da.x + (p.y - a[0].y) * da.y;
  const [b0, b1] = [proj(b[0]), proj(b[b.length - 1])].sort((p, q) => p - q);
  const overlap = Math.min(la, b1) - Math.max(0, b0);
  if (overlap < 0.5 * Math.min(la, lb)) return null;
  const aForward = Math.abs(da.x) > 0.3 ? da.x > 0 : da.y > 0;
  const [fwd, back] = aForward ? [a, b] : [b, a];
  const avg = (p: Pt, q: Pt) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  return [avg(fwd[0], back[back.length - 1]), avg(fwd[fwd.length - 1], back[0])];
}

/** The polyline without its last `len` of path length. */
function trimEnd(pts: Pt[], len: number): Pt[] {
  let acc = 0;
  for (let i = pts.length - 1; i > 0; i--) {
    acc += dist(pts[i], pts[i - 1]);
    if (acc >= len) return pts.slice(0, Math.max(2, i));
  }
  return pts;
}

/** Arrow shafts are smooth: no sharp corner (unlike an N, a Z or a zig-zag chain). */
export function smooth(shaft: Pt[], L: number, headInStroke: boolean): boolean {
  const spacing = Math.max(1, L / 12);
  const r = resampleBySpacing(shaft, spacing);
  const W = 2;
  // When the head is drawn without lifting the pen, the detected tip can lag a
  // little and keep the start of a barb: ignore the last ~0.25 L in that case.
  const end = r.length - W - (headInStroke ? Math.ceil((0.25 * L) / spacing) : 0);
  for (let i = W; i < end; i++) {
    if (angleBetween(vec(r[i - W], r[i]), vec(r[i], r[i + W])) > (65 * Math.PI) / 180) return false;
  }
  return true;
}

// ── Text ─────────────────────────────────────────────────────────────────────

function unionBox(bs: BBox[]): BBox {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  const x2 = Math.max(...bs.map((b) => b.x + b.w)), y2 = Math.max(...bs.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Single-linkage clustering of stroke boxes closer than `gap`. */
function clusterBoxes(idx: number[], boxes: BBox[], gap: number): number[][] {
  const parent = new Map(idx.map((i) => [i, i]));
  const find = (i: number): number => (parent.get(i) === i ? i : find(parent.get(i)!));
  for (let a = 0; a < idx.length; a++)
    for (let b = a + 1; b < idx.length; b++)
      if (bboxGap(boxes[idx[a]], boxes[idx[b]]) < gap) parent.set(find(idx[a]), find(idx[b]));
  const groups = new Map<number, number[]>();
  idx.forEach((i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()];
}

/** Split a text cluster into characters by horizontal overlap of strokes. */
function splitCharacters(
  cluster: number[], pts: Pt[][], boxes: BBox[], L: number, tolerance: number,
): { strokes: Pt[][]; box: BBox }[] {
  const sorted = cluster.slice().sort((a, b) => boxes[a].x - boxes[b].x);
  const chars: { ids: number[]; box: BBox }[] = [];
  for (const i of sorted) {
    const b = boxes[i];
    const last = chars[chars.length - 1];
    const overlap = last ? Math.min(last.box.x + last.box.w, b.x + b.w) - Math.max(last.box.x, b.x) : -1;
    // Strokes of one character overlap horizontally (or almost touch, e.g. the
    // bar and stems of an H); a new character starts after a gap.
    if (last && overlap > -tolerance * L) {
      last.ids.push(i);
      last.box = unionBox([last.box, b]);
    } else {
      chars.push({ ids: [i], box: b });
    }
  }
  return chars.map((c) => ({ strokes: c.ids.map((i) => pts[i]), box: c.box }));
}

/**
 * Letter spacing varies between writers, so the cluster is segmented with a few
 * gap tolerances and the best valid reading wins (e.g. "H" vs "I-I", "Cl" vs "d").
 */
function readLabel(
  cluster: number[], pts: Pt[][], boxes: BBox[], L: number, symbols: PointCloudRecognizer, minScore: number,
): DecodedLabel | null {
  let best: DecodedLabel | null = null;
  const seen = new Set<string>();
  for (const tol of [0, 0.04, 0.09]) {
    const chars = splitCharacters(cluster, pts, boxes, L, tol);
    const key = chars.map((c) => c.strokes.length).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const r = decodeLabel(chars, symbols, minScore);
    if (r && (!best || r.score > best.score)) best = r;
  }
  return best;
}

/** ⊕ / ⊖: if one closed stroke encloses all the others, classify the inside only. */
export function withoutEnclosingCircle(strokes: Pt[][]): Pt[][] {
  if (strokes.length < 2) return strokes;
  const k = strokes.findIndex((s) => s.length > 4 && straightness(s) < 0.25);
  if (k < 0) return strokes;
  const ring = bbox(strokes[k]);
  const inside = strokes.filter((_, i) => i !== k);
  const enclosed = inside.every((s) => {
    const b = bbox(s);
    return b.x >= ring.x - 2 && b.y >= ring.y - 2 && b.x + b.w <= ring.x + ring.w + 2 && b.y + b.h <= ring.y + ring.h + 2;
  });
  return enclosed ? inside : strokes;
}

/** Do two polylines cross (any pair of segments intersects)? */
export function crosses(a: Pt[], b: Pt[]): boolean {
  const ccw = (p: Pt, q: Pt, r: Pt) => (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x);
  const step = (s: Pt[]) => Math.max(1, Math.floor(s.length / 12));
  for (let i = step(a); i < a.length; i += step(a)) {
    const p1 = a[i - step(a)], p2 = a[i];
    for (let j = step(b); j < b.length; j += step(b)) {
      const q1 = b[j - step(b)], q2 = b[j];
      if (ccw(p1, p2, q1) * ccw(p1, p2, q2) < 0 && ccw(q1, q2, p1) * ccw(q1, q2, p2) < 0) return true;
    }
  }
  return false;
}

interface DecodedLabel {
  text: string;
  element: string | null;
  charge: number;
  score: number;
}

/** Choose the best valid reading of a sequence of characters. */
// The same group of strokes is classified once, whichever segmentation it appears in.
const strokeIds = new WeakMap<Pt[], number>();
let nextStrokeId = 0;
const classifyCache = new WeakMap<PointCloudRecognizer, Map<string, Match[]>>();
function classifyCached(symbols: PointCloudRecognizer, strokes: Pt[][]): Match[] {
  const key = strokes.map((s) => {
    if (!strokeIds.has(s)) strokeIds.set(s, nextStrokeId++);
    return strokeIds.get(s);
  }).join(',');
  let cache = classifyCache.get(symbols);
  if (!cache) classifyCache.set(symbols, (cache = new Map()));
  if (!cache.has(key)) cache.set(key, symbols.classify(withoutEnclosingCircle(strokes), 4));
  return cache.get(key)!;
}

function decodeLabel(
  chars: { strokes: Pt[][]; box: BBox }[], symbols: PointCloudRecognizer, minScore: number,
): DecodedLabel | null {
  const guesses: CharGuess[] = chars.map((c) => ({
    box: c.box,
    options: classifyCached(symbols, c.strokes).flatMap((m) =>
      m.symbol === '+' || m.symbol === '-'
        ? [{ ch: m.symbol, score: m.score }]
        : (SHAPE_LETTERS[m.symbol] ?? [m.symbol]).map((ch) => ({ ch, score: m.score })),
    ),
  }));
  if (guesses.length === 0 || guesses.some((g) => g.options.length === 0)) return null;

  // Enumerate combinations (labels are short: ≤ 4 characters).
  let best: DecodedLabel | null = null;
  const limit = guesses.slice(0, 4);
  const walk = (k: number, acc: { ch: string; score: number }[]) => {
    if (k === limit.length) {
      const reading = interpret(acc);
      if (reading && (!best || reading.score > best.score)) best = reading;
      return;
    }
    for (const o of limit[k].options.slice(0, 4)) walk(k + 1, [...acc, o]);
  };
  walk(0, []);
  if (!best) return null;
  const b = best as DecodedLabel;
  if (b.score >= minScore) return b;
  // A slightly weaker reading is still accepted when every character clearly
  // beats its runner-up (an unusual but unambiguous handwriting).
  const clearWinners = limit.every((g) => {
    // Margin between different shapes ("O" and "o" are the same shape).
    const scores = [...new Set(g.options.map((o) => o.score))].sort((p, q) => q - p);
    return scores.length < 2 || scores[0] - scores[1] >= 0.1;
  });
  return b.score >= minScore - 0.1 && clearWinners ? b : null;
}

/** "Cl", "O-", "N+", "OH", "Pt2-", "-", "+" … → element + charge, or null if invalid. */
function interpret(seq: { ch: string; score: number }[]): DecodedLabel | null {
  const text = seq.map((s) => s.ch).join('');
  const score = seq.reduce((a, s) => a + s.score, 0) / seq.length;
  // element, optional H count, optional charge magnitude (superscript digit), signs
  const m = /^([A-Z][a-z]?)?(H[2-3]?)?([2-4])?([+-]*)$/.exec(text);
  if (!m) return null;
  const element = m[1] ?? null;
  if (element && !ELEMENTS.has(element)) return null;
  if (!element && m[2]) return null;
  const signs = m[4] ?? '';
  if (m[3] && signs.length !== 1) return null; // a digit is only a charge with one sign: 2-, 3+
  if (signs.includes('+') && signs.includes('-')) return null;
  const magnitude = m[3] ? Number(m[3]) : signs.length;
  const charge = magnitude * (signs.startsWith('-') ? -1 : 1);
  if (!element && charge === 0) return null;
  // Prefer readings that use fewer lowercase substitutions of ambiguous shapes.
  const penalty = element && element.length === 2 && !['Cl', 'Br', 'Si', 'Li', 'Na', 'Pt'].includes(element) ? 0.05 : 0;
  return { text, element, charge, score: score - penalty };
}

// ── Bonds and atoms ──────────────────────────────────────────────────────────

/** Merge near-parallel, overlapping, close segments into multiple bonds. */
function mergeMultipleBonds(segs: Segment[], L: number): (Segment & { order: 1 | 2 | 3 })[] {
  const used = new Array(segs.length).fill(false);
  const out: (Segment & { order: 1 | 2 | 3 })[] = [];
  const order = segs.map((_, i) => i).sort((a, b) => segLength(segs[b]) - segLength(segs[a]));
  for (const i of order) {
    if (used[i]) continue;
    used[i] = true;
    const s = segs[i];
    let count = 1;
    for (const j of order) {
      if (used[j] || count >= 3) continue;
      const t = segs[j];
      const ang = angleBetween(vec(s.a, s.b), vec(t.a, t.b));
      const parallel = Math.min(ang, Math.PI - ang) < (15 * Math.PI) / 180;
      if (!parallel) continue;
      const da = pointSegment(t.a, s.a, s.b), db = pointSegment(t.b, s.a, s.b);
      const sep = (da.d + db.d) / 2;
      const overlap = Math.abs(db.t - da.t);
      if (sep < 0.4 * L && sep > 0.04 * L && overlap > 0.45) {
        used[j] = true;
        count++;
      }
    }
    out.push({ a: s.a, b: s.b, order: count as 1 | 2 | 3 });
  }
  return out;
}

/** Cluster segment endpoints into atoms and build bonds between them. */
function buildGraph(segs: (Segment & { order: 1 | 2 | 3 })[], L: number) {
  const atoms: Pt[] = [];
  const members: Pt[][] = [];
  const snap = (p: Pt): number => {
    let best = -1, bestD = 0.32 * L;
    atoms.forEach((a, k) => {
      const d = dist(a, p);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best >= 0) {
      members[best].push(p);
      const m = members[best];
      atoms[best] = { x: m.reduce((s, q) => s + q.x, 0) / m.length, y: m.reduce((s, q) => s + q.y, 0) / m.length };
      return best;
    }
    atoms.push({ ...p });
    members.push([p]);
    return atoms.length - 1;
  };
  const bonds: { begin: number; end: number; order: 1 | 2 | 3 }[] = [];
  for (const s of segs) {
    const a = snap(s.a), b = snap(s.b);
    if (a === b) continue;
    if (bonds.some((x) => (x.begin === a && x.end === b) || (x.begin === b && x.end === a))) continue;
    bonds.push({ begin: a, end: b, order: s.order });
  }
  return { atoms, bonds };
}

function nearestNode(p: Pt, nodes: Pt[]): { index: number; d: number } | null {
  let best: { index: number; d: number } | null = null;
  nodes.forEach((q, index) => {
    const d = dist(p, q);
    if (!best || d < best.d) best = { index, d };
  });
  return best;
}

function assignMolecules(atoms: SceneAtom[], bonds: SceneBond[]): void {
  const parent = atoms.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  bonds.forEach((b) => (parent[find(b.begin)] = find(b.end)));
  const ids = new Map<number, number>();
  atoms.forEach((a, i) => {
    const r = find(i);
    if (!ids.has(r)) ids.set(r, ids.size);
    a.molecule = ids.get(r)!;
  });
}

// ── Arrow geometry and anchoring ─────────────────────────────────────────────

/** Signed maximum deviation from the chord; positive = left of start→end (y up). */
export function signedBulge(shaft: Pt[], start: Pt, end: Pt): number {
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  let best = 0;
  for (const p of shaft) {
    const cross = (dx * (p.y - start.y) - dy * (p.x - start.x)) / len; // > 0 → left
    if (Math.abs(cross) > Math.abs(best)) best = cross;
  }
  return best;
}

/** Electron source/sink: the nearest atom, or the bond whose midpoint is closer. */
export function anchorFor(p: Pt, atoms: SceneAtom[], bonds: SceneBond[]): ArrowAnchor {
  let best: ArrowAnchor = { type: 'none' };
  let bestD = 1.0;
  atoms.forEach((a, atom) => {
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < bestD) { bestD = d; best = { type: 'atom', atom }; }
  });
  bonds.forEach((b, bond) => {
    const a1 = atoms[b.begin], a2 = atoms[b.end];
    const { d, t } = pointSegment(p, a1, a2);
    if (t > 0.2 && t < 0.8 && d < bestD * 0.9) { bestD = d; best = { type: 'bond', bond }; }
  });
  return best;
}

function sceneOrigin(all: Pt[]): Pt {
  if (all.length === 0) return { x: 0, y: 0 };
  const b = bbox(all);
  return bboxCenter(b);
}
