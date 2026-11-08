/**
 * Scene -> chemfig.
 *
 * One \chemfig{...} per connected component, written from a DFS spanning tree:
 *   - bonds use absolute angles `-[:θ]` computed from the coordinates (plus a
 *     length coefficient when a bond is >10 % off the median bond length);
 *   - extra branches go in parentheses, the largest subtree continues the chain;
 *   - every non-tree (ring) bond is recorded once and closed with chemfig hooks:
 *     `?[rK]` on the atom written first, `?[rK,{<bond>}]` on the second. chemfig
 *     draws a hook bond from the first atom to the second;
 *   - aromatic bonds are kekulized (chemfig has no aromatic bond);
 *   - implicit H are written like Ketcher shows them (OH / HO / NH below...),
 *     with explicit departure/arrival atom numbers when chemfig's default
 *     choice would attach the bond to the H.
 *
 * Several components, pluses and straight arrows become a
 * \schemestart ... \schemestop ordered by x. Curved arrows become \chemmove
 * Bézier curves between named atoms (or bond midpoints), which needs two LaTeX
 * runs (remember picture).
 *
 * Verified against chemfig 1.66 (TeX Live 2025): `>`/`>:` are wide at the
 * departure atom and narrow at the arrival atom (`<`/`<:` the opposite); `=^`
 * puts the second line on the left of the bond direction, `=_` on the right;
 * hook bond codes must be braced, and hook bonds ignore `^`/`_`.
 */

import type { Point, Scene, SceneArrow } from '../scene/types';
import {
  angleDeg,
  arcOffset,
  atomDisplays,
  buildAdjacency,
  chargeText,
  doubleBondSide,
  fishhookKeys,
  fmt,
  isCurved,
  kekulize,
  referenceBondLength,
  withKekuleOrders,
} from './structure';
import type { AtomDisplay, Neighbor } from './structure';

export const CHEMFIG_PREAMBLE = ['\\usepackage{chemfig}', '\\usetikzlibrary{arrows.meta,bending,calc}'].join('\n');

/** chemfig's default interatomic distance ("atom sep") is 3em for one standard bond. */
const EM_PER_BOND = 3;

const MATH_ESCAPES: Record<string, string> = {
  '\\': '\\backslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  '%': '\\%',
  _: '\\_',
  '^': '\\hat{}',
  '~': '\\sim{}',
  // chemfig scans atom groups for these characters (hooks, names): hide them.
  '?': '\\mbox{\\char63}',
  '@': '\\mbox{\\char64}',
  ' ': '\\ ',
};

/** Alias -> chemfig math-mode text inside braces (one atom), digits as subscripts. */
function aliasMath(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/[0-9]/.test(c) && i > 0 && /[A-Za-z)\]]/.test(s[i - 1])) {
      let digits = '';
      while (i < s.length && /[0-9]/.test(s[i])) digits += s[i++];
      i--;
      out += `_{${digits}}`;
    } else out += MATH_ESCAPES[c] ?? c;
  }
  return `{${out}}`;
}

interface LabelParts {
  /** chemfig "atoms" of the group (chemfig splits groups at capital letters and @). */
  parts: string[];
  /** Index in `parts` of the heavy atom (the one bonds attach to). */
  heavy: number;
}

function labelParts(d: AtomDisplay, name: string): LabelParts {
  if (!d.shown) return { parts: [name], heavy: 0 };
  let core = d.isElement ? d.symbol : aliasMath(d.symbol);
  if (d.isotope && d.isElement) core = `{^{${d.isotope}}${d.symbol}}`;
  if (d.radical > 0) core = `\\charge{${d.radicalAngle}=${d.radical === 2 ? '\\.' : '\\:'}}{${core}}`;
  const h = d.hCount > 0 ? (d.hCount > 1 ? `H_{${d.hCount}}` : 'H') : '';
  const c = chargeText(d.charge);
  const sup = c ? `^{${c}}` : '';
  if (h && d.hSide === 'below') core = `\\chembelow{${core}}{${h}}`;
  if (h && d.hSide === 'above') core = `\\chemabove{${core}}{${h}}`;
  if (h && d.hSide === 'right') return { parts: [name + core, h + sup], heavy: 0 };
  if (h && d.hSide === 'left') {
    // chemfig starts a new atom at a capital letter or "@"; a core starting with
    // "{" or "\" needs the "@{name}" to be split from the H.
    return { parts: [h, name + core + sup], heavy: 1 };
  }
  return { parts: [name + core + sup], heavy: 0 };
}

const normDeg = (a: number) => ((a % 360) + 360) % 360;

export function toChemfig(input: Scene): string {
  if (!input.atoms.length && !input.arrows.length && !input.pluses.length) {
    return '% MecHand chemfig export: empty scene';
  }
  const adj = buildAdjacency(input);
  // chemfig has no aromatic bond: work on a Kekulé structure.
  const kek = kekulize(input, adj);
  const scene = kek ? withKekuleOrders(input, kek) : input;
  const displays = atomDisplays(scene, adj);
  const lref = referenceBondLength(scene);
  const notes: string[] = [];
  if (!kek) notes.push('% note: aromatic bonds could not be kekulized; drawn as single bonds');
  const orderOf = (bi: number): number => {
    const o = scene.bonds[bi].order;
    return o === 4 ? 1 : o;
  };

  // ── Curved arrows: snap endpoints to atoms or bond midpoints ──────────────
  const named = new Set<number>();
  interface Snap {
    ref: string;
    pos: Point;
    atoms: number[];
  }
  const snapRadius = 0.7 * lref;
  const snap = (p: Point): Snap | null => {
    let best: Snap | null = null;
    let bestD = snapRadius;
    scene.atoms.forEach((a, i) => {
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d <= bestD) {
        bestD = d;
        best = { ref: `(a${i})`, pos: { x: a.x, y: a.y }, atoms: [i] };
      }
    });
    scene.bonds.forEach((b) => {
      const s = scene.atoms[b.begin];
      const e = scene.atoms[b.end];
      const m = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { ref: `($(a${b.begin})!0.5!(a${b.end})$)`, pos: m, atoms: [b.begin, b.end] };
      }
    });
    return best;
  };
  const moves: string[] = [];
  scene.arrows.forEach((a, k) => {
    if (!isCurved(a)) return;
    const from = snap(a.start);
    const to = snap(a.end);
    if (!from || !to) {
      notes.push(
        `% note: curved arrow #${k + 1} dropped: its ${!from ? 'start' : 'end'} is not within ${fmt(snapRadius, 2)} units of an atom or bond`,
      );
      return;
    }
    [...from.atoms, ...to.atoms].forEach((i) => named.add(i));
    moves.push(curvedArrow(a, from, to));
  });

  function curvedArrow(a: SceneArrow, from: Snap, to: Snap): string {
    // Keep the drawn arc's bulge vector (direction and size) between the
    // snapped end points, so the curve stays on the side it was drawn on.
    const v = arcOffset(a.start, a.end, a.height ?? 0);
    const em = EM_PER_BOND / lref;
    const rel = `+(${fmt(v.x * em, 2)}em,${fmt(v.y * em, 2)}em)`;
    const tip = a.mode.includes('open') ? 'Straight Barb' : a.mode.includes('triangle') ? 'Triangle' : 'Stealth';
    const head = a.kind === 'single-electron' ? `${tip}[${fishhookKeys(from.pos, to.pos, v)}]` : tip;
    return `\\draw[-{${head}}, shorten <=2pt, shorten >=2pt] ${from.ref} .. controls ${rel} and ${rel} .. ${to.ref};`;
  }

  // ── Molecules ─────────────────────────────────────────────────────────────
  const components = new Map<number, number[]>();
  scene.atoms.forEach((a, i) => {
    if (!components.has(a.molecule)) components.set(a.molecule, []);
    components.get(a.molecule)!.push(i);
  });

  const nameOf = (i: number) => (named.has(i) ? `@{a${i}}` : '');
  const labels = displays.map((d) => labelParts(d, ''));
  // Groups split as [H, core] need the name to force chemfig to split them.
  displays.forEach((d, i) => {
    const lp = labels[i];
    if (lp.parts.length > 1 && lp.heavy === 1 && !/^[A-Z]/.test(lp.parts[1])) named.add(i);
  });
  displays.forEach((d, i) => (labels[i] = labelParts(d, nameOf(i))));

  function bondCode(bi: number, from: number): string {
    const b = scene.bonds[bi];
    const o = orderOf(bi);
    if (o === 3) return '~';
    if (o === 2) {
      let side = doubleBondSide(scene, adj, displays, bi);
      if (from !== b.begin) side = side === 'left' ? 'right' : side === 'right' ? 'left' : side;
      return side === 'left' ? '=^' : side === 'right' ? '=_' : '=';
    }
    if (b.stereo) {
      // Narrow end at b.begin; chemfig "<" is narrow at the departure atom.
      const base = b.begin === from ? '<' : '>';
      return b.stereo === 'up' ? base : `${base}:`;
    }
    return '-';
  }

  function moleculeCode(atomIds: number[]): string {
    // Root: chemfig puts the first atom on the text baseline, and \+ keeps
    // neighbouring molecules on that baseline, so start near the vertical
    // middle of the molecule (leftmost such atom, then topmost).
    const ys = atomIds.map((i) => scene.atoms[i].y);
    const ymid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const dmin = Math.min(...ys.map((y) => Math.abs(y - ymid)));
    let root = -1;
    for (const i of atomIds) {
      const a = scene.atoms[i];
      if (Math.abs(a.y - ymid) > dmin + 0.3 * lref) continue;
      const r = root < 0 ? null : scene.atoms[root];
      if (!r || a.x < r.x - 1e-6 || (Math.abs(a.x - r.x) <= 1e-6 && a.y > r.y)) root = i;
    }
    const visited = new Set<number>();
    const children = new Map<number, Neighbor[]>();
    const hooks = new Map<number, string[]>();
    const closed = new Set<number>();
    let hookCount = 0;
    const sortedNeighbors = (u: number) =>
      // Walk multiple bonds first so that ring closures (hooks, which cannot
      // place the second line of a double bond inside the ring) are single bonds.
      [...adj[u]].sort((p, q) => orderOf(q.bond) - orderOf(p.bond) || p.bond - q.bond);
    const addHook = (i: number, text: string) => {
      if (!hooks.has(i)) hooks.set(i, []);
      hooks.get(i)!.push(text);
    };

    const dfs = (u: number, parentBond: number) => {
      visited.add(u);
      children.set(u, []);
      for (const n of sortedNeighbors(u)) {
        if (n.bond === parentBond) continue;
        if (!visited.has(n.atom)) {
          children.get(u)!.push(n);
          dfs(n.atom, n.bond);
        } else if (!closed.has(n.bond)) {
          // Back edge to an ancestor (written earlier): close the ring once.
          closed.add(n.bond);
          const id = `r${++hookCount}`;
          addHook(n.atom, `?[${id}]`);
          let code = bondCode(n.bond, n.atom);
          if (code.startsWith('=')) code = '=';
          addHook(u, code === '-' ? `?[${id}]` : `?[${id},{${code}}]`);
        }
      }
    };
    dfs(root, -1);

    const size = new Map<number, number>();
    const subtreeSize = (u: number): number => {
      let s = 1;
      for (const c of children.get(u)!) s += subtreeSize(c.atom);
      size.set(u, s);
      return s;
    };
    subtreeSize(root);

    const atomText = (u: number): string => {
      const lp = labels[u];
      const parts = [...lp.parts];
      const hk = hooks.get(u)?.join('') ?? '';
      parts[lp.heavy] += hk;
      return parts.join('');
    };

    const bondText = (from: number, n: Neighbor): string => {
      const p = scene.atoms[from];
      const q = scene.atoms[n.atom];
      const theta = Math.round(angleDeg(q.x - p.x, q.y - p.y));
      const len = Math.hypot(q.x - p.x, q.y - p.y) / lref;
      const coeff = Math.abs(len - 1) > 0.1 ? fmt(len, 2) : '';
      // chemfig's default: angle in (-90, 90) -> last atom of the departure
      // group and first atom of the arrival group; otherwise first/last.
      const forward = normDeg(theta) < 90 || normDeg(theta) > 270;
      const src = labels[from];
      const dst = labels[n.atom];
      const wantDep = src.heavy + 1;
      const wantArr = dst.heavy + 1;
      const defDep = forward ? src.parts.length : 1;
      const defArr = forward ? 1 : dst.parts.length;
      const dep = src.parts.length > 1 && wantDep !== defDep ? String(wantDep) : '';
      const arr = dst.parts.length > 1 && wantArr !== defArr ? String(wantArr) : '';
      const args = [`:${theta}`, coeff, dep, arr];
      while (args.length > 1 && args[args.length - 1] === '') args.pop();
      return `${bondCode(n.bond, from)}[${args.join(',')}]`;
    };

    const emit = (u: number): string => {
      const kids = [...children.get(u)!];
      let main: Neighbor | null = null;
      for (const k of kids) if (!main || size.get(k.atom)! > size.get(main.atom)!) main = k;
      let s = atomText(u);
      for (const k of kids) if (k !== main) s += `(${bondText(u, k)}${emit(k.atom)})`;
      if (main) s += bondText(u, main) + emit(main.atom);
      return s;
    };
    return `\\chemfig{${emit(root)}}`;
  }

  // ── Scheme layout ─────────────────────────────────────────────────────────
  interface Item {
    x: number;
    kind: 'mol' | 'sep';
    text: string;
  }
  const items: Item[] = [];
  for (const ids of components.values()) {
    const xs = ids.map((i) => scene.atoms[i].x);
    items.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, kind: 'mol', text: moleculeCode(ids) });
  }
  for (const p of scene.pluses) items.push({ x: p.x, kind: 'sep', text: '\\+' });
  for (const a of scene.arrows) {
    if (isCurved(a)) continue;
    items.push({ x: (a.start.x + a.end.x) / 2, kind: 'sep', text: schemeArrow(a) });
  }
  items.sort((p, q) => p.x - q.x);

  function schemeArrow(a: SceneArrow): string {
    const leftward = a.end.x < a.start.x;
    if (a.kind === 'equilibrium') {
      if (a.mode.startsWith('unbalanced')) return leftward ? '\\arrow{<<->}' : '\\arrow{<->>}';
      return '\\arrow{<=>}';
    }
    switch (a.mode) {
      case 'failed':
        if (leftward) notes.push('% note: chemfig has no left-pointing "-/>" arrow; drawn left to right');
        return '\\arrow{-/>}';
      case 'both-ends-filled-triangle':
        return '\\arrow{<->}';
      case 'retrosynthetic':
        // chemfig draws "<-" from the right compound to the left one, so the
        // replaced tip always goes at the end of the drawn path.
        return `\\arrow{${leftward ? '<-' : '->'}}[,,double,-{Implies}]`;
      case 'dashed-open-angle':
        return `\\arrow{${leftward ? '<-' : '->'}}[,,dashed]`;
      default:
        return leftward ? '\\arrow{<-}' : '\\arrow{->}';
    }
  }

  const out: string[] = [];
  out.push(
    `% MecHand chemfig export; needs \\usepackage{chemfig} and \\usetikzlibrary{arrows.meta,bending,calc}${
      moves.length ? '; compile twice for the \\chemmove arrows' : ''
    }`,
  );
  out.push(...notes);
  if (items.length === 1 && items[0].kind === 'mol') {
    out.push(items[0].text);
  } else {
    out.push('\\schemestart');
    let prev: Item['kind'] | null = null;
    for (const item of items) {
      if (item.kind === 'mol' && prev === 'mol') out.push('  \\arrow{0}[,0.25]');
      if (item.kind === 'sep' && prev !== 'mol') out.push('  {}');
      out.push(`  ${item.text}`);
      prev = item.kind;
    }
    out.push('\\schemestop');
  }
  if (moves.length) {
    out.push('\\chemmove{');
    out.push(...moves.map((m) => `  ${m}`));
    out.push('}');
  }
  return out.join('\n');
}
