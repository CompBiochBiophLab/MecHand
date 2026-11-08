/**
 * Structure analysis shared by the LaTeX exporters (TikZ and chemfig):
 * adjacency, implicit hydrogens, label layout (which side the H goes, where a
 * radical dot fits), ring perception for double-bond placement, kekulization
 * of aromatic bonds and the curved-arrow geometry.
 *
 * Everything works in Scene coordinates (Ketcher units, y up).
 */

import type { Point, Scene, SceneArrow } from '../scene/types';

// ── Small numeric helpers ────────────────────────────────────────────────────

/** Formats a number for LaTeX: at most `digits` decimals, no trailing zeros, no "-0". */
export function fmt(n: number, digits = 3): string {
  const s = n.toFixed(digits).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
}

/** Angle of the vector (dx, dy) in degrees, in (-180, 180]. */
export function angleDeg(dx: number, dy: number): number {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  return a <= -180 ? a + 360 : a;
}

/** Absolute angular distance between two angles in degrees, in [0, 180]. */
export function angularDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

// ── Adjacency ────────────────────────────────────────────────────────────────

export interface Neighbor {
  atom: number;
  bond: number;
}

export function buildAdjacency(scene: Scene): Neighbor[][] {
  const adj: Neighbor[][] = scene.atoms.map(() => []);
  scene.bonds.forEach((b, i) => {
    if (!adj[b.begin] || !adj[b.end]) return;
    adj[b.begin].push({ atom: b.end, bond: i });
    adj[b.end].push({ atom: b.begin, bond: i });
  });
  return adj;
}

/** Median bond length of the scene (1 for a scene without usable bonds). */
export function referenceBondLength(scene: Scene): number {
  const lengths = scene.bonds
    .map((b) => {
      const p = scene.atoms[b.begin];
      const q = scene.atoms[b.end];
      return Math.hypot(q.x - p.x, q.y - p.y);
    })
    .filter((l) => l > 1e-6)
    .sort((a, b) => a - b);
  if (!lengths.length) return 1;
  return lengths[Math.floor(lengths.length / 2)];
}

// ── Elements and implicit hydrogens ──────────────────────────────────────────

const ELEMENTS = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm ' +
    'Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No ' +
    'Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og D T'
  ).split(' '),
);

export const isElementSymbol = (s: string): boolean => ELEMENTS.has(s);

/** Allowed valences (ascending) and main group of elements that get implicit H. */
const VALENCE: Record<string, { group: number; v: number[] }> = {
  B: { group: 13, v: [3] },
  C: { group: 14, v: [4] },
  Si: { group: 14, v: [4] },
  Ge: { group: 14, v: [4] },
  N: { group: 15, v: [3, 5] },
  P: { group: 15, v: [3, 5] },
  As: { group: 15, v: [3, 5] },
  O: { group: 16, v: [2] },
  S: { group: 16, v: [2, 4, 6] },
  Se: { group: 16, v: [2, 4, 6] },
  Te: { group: 16, v: [2, 4, 6] },
  F: { group: 17, v: [1] },
  Cl: { group: 17, v: [1, 3, 5, 7] },
  Br: { group: 17, v: [1, 3, 5, 7] },
  I: { group: 17, v: [1, 3, 5, 7] },
};

/**
 * Number of implicit hydrogens Ketcher would display on atom `i` (standard
 * valence minus bond orders, corrected for charge and radicals). Aromatic bonds
 * count 1.5. Aliases, R-groups, metals and H itself get 0.
 */
export function implicitHydrogens(scene: Scene, adj: Neighbor[][], i: number): number {
  const atom = scene.atoms[i];
  const info = VALENCE[atom.symbol];
  if (!info) return 0;
  let sum = 0;
  for (const n of adj[i]) {
    const order = scene.bonds[n.bond].order;
    sum += order === 4 ? 1.5 : order;
  }
  sum = Math.ceil(sum - 1e-6);
  const q = atom.charge;
  // Group 13: B(-) is tetravalent; group 14: any charge removes a bond (C+, C-);
  // groups 15-17: a positive charge adds one (N+, O+), a negative one removes one.
  const delta = info.group === 13 ? -q : info.group === 14 ? -Math.abs(q) : q;
  const r = atom.radical ?? 0;
  const rad = r === 2 ? 1 : r === 1 || r === 3 ? 2 : 0;
  for (const v of info.v) {
    const eff = v + delta - rad;
    if (eff >= sum) return eff - sum;
  }
  return 0;
}

// ── Label layout ─────────────────────────────────────────────────────────────

export type Side = 'right' | 'left' | 'below' | 'above';

const SIDE_ANGLE: Record<Side, number> = { right: 0, left: 180, below: 270, above: 90 };

/** Elements whose lone-atom hydride is written with H first (H2O, HCl, H2S...). */
const H_FIRST = new Set(['O', 'S', 'Se', 'Te', 'F', 'Cl', 'Br', 'I', 'At']);

export interface AtomDisplay {
  /** False for implicit (skeletal) carbons. */
  shown: boolean;
  symbol: string;
  /** True when the symbol is a chemical element (otherwise an alias/label, written verbatim). */
  isElement: boolean;
  hCount: number;
  hSide: Side;
  charge: number;
  /** 0 none, 1 singlet (2 dots), 2 doublet (1 dot), 3 triplet (2 dots). */
  radical: number;
  isotope?: number;
  /** Direction (degrees, y up) of the free space where radical dots go. */
  radicalAngle: number;
  /** Directions (degrees) of the bonds leaving this atom. */
  bondAngles: number[];
}

function pickSide(bondAngles: number[], symbol: string): Side {
  if (!bondAngles.length) return H_FIRST.has(symbol) ? 'left' : 'right';
  const order: Side[] = ['right', 'left', 'below', 'above'];
  const clearance = (s: Side) => Math.min(...bondAngles.map((a) => angularDistance(a, SIDE_ANGLE[s])));
  for (const s of order) if (clearance(s) >= 75) return s;
  let best: Side = 'right';
  for (const s of order) if (clearance(s) > clearance(best) + 1e-9) best = s;
  return best;
}

function pickRadicalAngle(occupied: number[]): number {
  const candidates = [90, 270, 135, 225, 45, 315, 180, 0];
  if (!occupied.length) return 90;
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const score = Math.min(...occupied.map((a) => angularDistance(a, c)));
    if (score > bestScore + 1e-9) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/** Computes how every atom should be labelled. */
export function atomDisplays(scene: Scene, adj: Neighbor[][]): AtomDisplay[] {
  return scene.atoms.map((atom, i) => {
    const bondAngles = adj[i].map((n) => {
      const o = scene.atoms[n.atom];
      return angleDeg(o.x - atom.x, o.y - atom.y);
    });
    const isElement = isElementSymbol(atom.symbol);
    const radical = atom.radical ?? 0;
    const shown =
      atom.symbol !== 'C' || adj[i].length === 0 || atom.charge !== 0 || radical > 0 || !!atom.isotope;
    const hCount = shown ? implicitHydrogens(scene, adj, i) : 0;
    const hSide = pickSide(bondAngles, atom.symbol);
    const occupied = [...bondAngles];
    if (hCount > 0) occupied.push(SIDE_ANGLE[hSide]);
    if (atom.charge !== 0) occupied.push(hCount > 0 && hSide === 'right' ? 15 : 35);
    const d: AtomDisplay = {
      shown,
      symbol: atom.symbol,
      isElement,
      hCount,
      hSide,
      charge: atom.charge,
      radical,
      radicalAngle: pickRadicalAngle(occupied),
      bondAngles,
    };
    if (atom.isotope) d.isotope = atom.isotope;
    return d;
  });
}

/** "+", "-", "2+", "3-"... (empty for 0). */
export function chargeText(charge: number): string {
  if (!charge) return '';
  const sign = charge > 0 ? '+' : '-';
  const n = Math.abs(charge);
  return n === 1 ? sign : `${n}${sign}`;
}

// ── Rings and double-bond placement ──────────────────────────────────────────

/**
 * Centroid of the smallest ring containing bond `b` (BFS from one end to the
 * other without using `b`), or null if the bond is not in a ring of <= maxSize atoms.
 */
export function ringCenter(scene: Scene, adj: Neighbor[][], b: number, maxSize = 12): Point | null {
  const { begin, end } = scene.bonds[b];
  const prev = new Map<number, number>([[begin, -1]]);
  const depth = new Map<number, number>([[begin, 0]]);
  const queue = [begin];
  while (queue.length) {
    const u = queue.shift()!;
    if (u === end) break;
    if (depth.get(u)! >= maxSize - 1) continue;
    for (const n of adj[u]) {
      if (n.bond === b || prev.has(n.atom)) continue;
      prev.set(n.atom, u);
      depth.set(n.atom, depth.get(u)! + 1);
      queue.push(n.atom);
    }
  }
  if (!prev.has(end)) return null;
  let x = 0;
  let y = 0;
  let count = 0;
  for (let u = end; u !== -1; u = prev.get(u)!) {
    x += scene.atoms[u].x;
    y += scene.atoms[u].y;
    count++;
  }
  return { x: x / count, y: y / count };
}

/**
 * Where the second line of a double (or aromatic) bond goes, relative to the
 * direction begin -> end (y up): 'left', 'right' or 'center' (symmetric).
 * Ring bonds: toward the ring centre. Otherwise: centred for C=O-like bonds to a
 * terminal labelled atom, else toward the side with more substituents.
 */
export function doubleBondSide(
  scene: Scene,
  adj: Neighbor[][],
  displays: AtomDisplay[],
  b: number,
): 'left' | 'right' | 'center' {
  const bond = scene.bonds[b];
  const p = scene.atoms[bond.begin];
  const q = scene.atoms[bond.end];
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const side = (x: number, y: number) => Math.sign(dx * y - dy * x);
  const center = ringCenter(scene, adj, b);
  if (center) {
    const s = side(center.x - (p.x + q.x) / 2, center.y - (p.y + q.y) / 2);
    if (s !== 0) return s > 0 ? 'left' : 'right';
  }
  const terminalLabel = (i: number) => displays[i].shown && adj[i].length === 1;
  if (terminalLabel(bond.begin) || terminalLabel(bond.end)) return 'center';
  let left = 0;
  let right = 0;
  for (const [atom, other] of [
    [bond.begin, bond.end],
    [bond.end, bond.begin],
  ]) {
    const a = scene.atoms[atom];
    for (const n of adj[atom]) {
      if (n.atom === other) continue;
      const o = scene.atoms[n.atom];
      const s = side(o.x - a.x, o.y - a.y);
      if (s > 0) left++;
      else if (s < 0) right++;
    }
  }
  if (left > right) return 'left';
  if (right > left) return 'right';
  return 'center';
}

// ── Kekulization ─────────────────────────────────────────────────────────────

/**
 * Assigns alternating single/double bonds to aromatic (order 4) bonds.
 * Returns bond index -> 1 | 2 for every aromatic bond, or null when no valid
 * Kekulé structure is found.
 */
export function kekulize(scene: Scene, adj: Neighbor[][]): Map<number, 1 | 2> | null {
  const aromatic = scene.bonds.map((b) => b.order === 4);
  const result = new Map<number, 1 | 2>();
  if (!aromatic.some(Boolean)) return result;

  const aromaticAtoms = new Set<number>();
  scene.bonds.forEach((b, i) => {
    if (aromatic[i]) aromaticAtoms.add(b.begin).add(b.end);
  });

  // Which aromatic atoms must receive exactly one double bond.
  const needs = new Set<number>();
  const optional: number[] = []; // pyrrole-like N/P drawn without H: try with and without
  for (const i of aromaticAtoms) {
    const atom = scene.atoms[i];
    const hasExoMultiple = adj[i].some((n) => !aromatic[n.bond] && scene.bonds[n.bond].order >= 2);
    if (hasExoMultiple) continue;
    const degree = adj[i].length;
    const s = atom.symbol;
    const q = atom.charge;
    if ((s === 'C' || s === 'Si') && q === 0 && !atom.radical) needs.add(i);
    else if ((s === 'N' || s === 'P' || s === 'As') && q === 0) {
      if (degree === 2) {
        needs.add(i);
        optional.push(i);
      }
    } else if ((s === 'N' || s === 'P') && q === 1) needs.add(i);
    else if ((s === 'O' || s === 'S' || s === 'Se') && q === 1 && degree === 2) needs.add(i);
    else if (s === 'B' && q === -1) needs.add(i);
  }

  const tryMatch = (need: Set<number>): Map<number, 1 | 2> | null => {
    const matched = new Map<number, number>(); // atom -> bond
    let steps = 0;
    const order = [...need];
    const solve = (): boolean => {
      if (++steps > 200000) return false;
      // Most constrained unmatched atom first.
      let pick = -1;
      let pickOptions: Neighbor[] = [];
      for (const a of order) {
        if (matched.has(a)) continue;
        const options = adj[a].filter((n) => aromatic[n.bond] && need.has(n.atom) && !matched.has(n.atom));
        if (pick === -1 || options.length < pickOptions.length) {
          pick = a;
          pickOptions = options;
          if (!options.length) break;
        }
      }
      if (pick === -1) return true;
      for (const n of pickOptions) {
        matched.set(pick, n.bond).set(n.atom, n.bond);
        if (solve()) return true;
        matched.delete(pick);
        matched.delete(n.atom);
      }
      return false;
    };
    if (!solve()) return null;
    const doubles = new Set(matched.values());
    const out = new Map<number, 1 | 2>();
    aromatic.forEach((isArom, i) => {
      if (isArom) out.set(i, doubles.has(i) ? 2 : 1);
    });
    return out;
  };

  const first = tryMatch(needs);
  if (first) return first;
  // Pyrrole/imidazole-type rings: one (or two) "N" in the list actually bears an H.
  for (const n of optional) {
    const reduced = new Set(needs);
    reduced.delete(n);
    const r = tryMatch(reduced);
    if (r) return r;
  }
  for (let i = 0; i < optional.length; i++) {
    for (let j = i + 1; j < optional.length; j++) {
      const reduced = new Set(needs);
      reduced.delete(optional[i]);
      reduced.delete(optional[j]);
      const r = tryMatch(reduced);
      if (r) return r;
    }
  }
  return null;
}

// ── Curved arrows ────────────────────────────────────────────────────────────

/** True for the elliptical-arc (electron-pushing) arrows. */
export const isCurved = (a: SceneArrow): boolean => a.kind === 'electron-pair' || a.kind === 'single-electron';

/**
 * Control-point offset of the cubic Bézier approximating Ketcher's elliptical
 * arc arrow: the arc is the half ellipse from `start` to `end` whose bulge is
 * `height` along the left normal of start->end (positive = left /
 * counter-clockwise side, y up; this matches Ketcher's SVG arc, drawn with
 * sweep-flag 1 for height >= 0 in its y-down canvas). With both control points
 * at start/end + normal * height * 4/3 the curve's apex lies exactly `height`
 * away from the chord.
 */
export function arcOffset(start: Point, end: Point, height: number): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 0, y: 0 };
  const k = (height * 4) / 3;
  return { x: (-dy / len) * k, y: (dx / len) * k };
}

/** The two control points of the Bézier for an arc arrow (see arcOffset). */
export function arcBezier(start: Point, end: Point, height: number): [Point, Point] {
  const v = arcOffset(start, end, height);
  return [
    { x: start.x + v.x, y: start.y + v.y },
    { x: end.x + v.x, y: end.y + v.y },
  ];
}

/**
 * Half arrow head of a single-electron (fishhook) arrow from `from` to `to`
 * with control offset `offset`: Ketcher draws the barb on the outer side of the
 * arc. TikZ's `harpoon` keeps the LEFT half of the tip (relative to the travel
 * direction at the tip), which is the outer side when the curve bulges to the
 * left of from->to; otherwise the right half (`swap`).
 */
export function fishhookKeys(from: Point, to: Point, offset: Point): string {
  const cross = (to.x - from.x) * offset.y - (to.y - from.y) * offset.x;
  return cross >= 0 ? 'harpoon' : 'harpoon,swap';
}

/** Copy of `scene` whose aromatic bonds carry the Kekulé orders from `kekulize`. */
export function withKekuleOrders(scene: Scene, kek: Map<number, 1 | 2>): Scene {
  return {
    ...scene,
    bonds: scene.bonds.map((b, i) => (b.order === 4 && kek.has(i) ? { ...b, order: kek.get(i)! } : b)),
  };
}
