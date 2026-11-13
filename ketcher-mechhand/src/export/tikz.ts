/**
 * Scene -> TikZ (absolute coordinates).
 *
 * Output layout:
 *   - every atom gets a name aN (N = Scene atom index): labelled atoms are
 *     \node's, implicit carbons are \coordinate's, so bonds drawn between names
 *     stop at the label border;
 *   - double/triple/aromatic bonds are parallel copies of the bond shifted with
 *     `transform canvas` (so they also stop at labels); ring double bonds put the
 *     short inner line toward the ring centre;
 *   - wedges are filled triangles, hashes a series of strokes (narrow end at
 *     SceneBond.begin);
 *   - charges/isotopes/implicit H are typeset around the element symbol with
 *     zero-width boxes so the symbol stays centred on the atom position;
 *   - curved arrows are one cubic Bézier per Ketcher elliptical arc.
 *
 * Needs TIKZ_PREAMBLE in the document preamble.
 */

import type { Point, Scene, SceneArrow } from '../scene/types';
import {
  arcBezier,
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
import type { AtomDisplay } from './structure';

export const TIKZ_PREAMBLE = ['\\usepackage{tikz}', '\\usetikzlibrary{arrows.meta,bending}'].join('\n');

export interface TikzOptions {
  /** Centimetres per Ketcher unit (a standard bond is ~1 unit). Default 0.8. */
  unitCm?: number;
  /** Wrap the output in a tikzpicture environment. Default true. */
  wrap?: boolean;
}

// ── Text helpers ─────────────────────────────────────────────────────────────

const TEXT_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  '%': '\\%',
  _: '\\_',
  '^': '\\textasciicircum{}',
  '~': '\\textasciitilde{}',
};

/** Escapes an alias for text mode and writes its digits as subscripts (CO2Me -> CO$_{2}$Me). */
function aliasText(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/[0-9]/.test(c) && i > 0 && /[A-Za-z)\]]/.test(s[i - 1])) {
      let digits = '';
      while (i < s.length && /[0-9]/.test(s[i])) digits += s[i++];
      i--;
      out += `$_{${digits}}$`;
    } else out += TEXT_ESCAPES[c] ?? c;
  }
  return out;
}

const hText = (n: number) => (n > 1 ? `H$_{${n}}$` : 'H');

/** Node content: symbol centred, H/charge/isotope in zero-size boxes around it. */
function labelText(d: AtomDisplay): string {
  const sym = d.isElement ? d.symbol : aliasText(d.symbol);
  const h = d.hCount > 0 ? hText(d.hCount) : '';
  const left = (d.hSide === 'left' ? h : '') + (d.isotope ? `$^{${d.isotope}}$` : '');
  const charge = chargeText(d.charge);
  const right = (d.hSide === 'right' ? h : '') + (charge ? `$^{${charge}}$` : '');
  return (left ? `\\smash{\\llap{${left}}}` : '') + sym + (right ? `\\smash{\\rlap{${right}}}` : '');
}

/** Rough half width/height (cm) of a label node's text, used to trim wedges. */
function labelHalfExtent(d: AtomDisplay): [number, number] {
  let w = 0;
  for (const c of d.symbol) w += /[A-Z]/.test(c) ? 0.26 : /[0-9]/.test(c) ? 0.12 : 0.17;
  return [w / 2 + 0.06, 0.18];
}

function arrowTip(mode: string): string {
  if (mode.includes('open')) return 'Straight Barb';
  if (mode.includes('triangle')) return 'Triangle';
  return 'Stealth';
}

// ── Exporter ─────────────────────────────────────────────────────────────────

export function toTikz(scene: Scene, opts: TikzOptions = {}): string {
  const unit = opts.unitCm && opts.unitCm > 0 ? opts.unitCm : 0.8;
  const wrap = opts.wrap ?? true;
  const adj = buildAdjacency(scene);
  // Aromatic bonds are drawn as such, but implicit H are counted on a Kekulé
  // structure (so that a pyrrole N still shows its H).
  const kek = kekulize(scene, adj);
  const displays = atomDisplays(kek ? withKekuleOrders(scene, kek) : scene, adj);
  const lref = referenceBondLength(scene);

  // Translate so that the drawing starts near (0,0).
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (p: Point) => {
    xs.push(p.x);
    ys.push(p.y);
  };
  scene.atoms.forEach(add);
  scene.pluses.forEach(add);
  scene.arrows.forEach((a) => {
    add(a.start);
    add(a.end);
  });
  const ox = xs.length ? Math.min(...xs) : 0;
  const oy = ys.length ? Math.min(...ys) : 0;
  /** Scene point -> cm. */
  const cm = (p: Point): Point => ({ x: (p.x - ox) * unit, y: (p.y - oy) * unit });
  const xy = (p: Point) => `(${fmt(p.x)},${fmt(p.y)})`;
  const at = (p: Point) => xy(cm(p));
  const dim = (v: number) => `${fmt(v)}cm`;

  const body: string[] = [];
  const name = (i: number) => `a${i}`;

  // Atoms.
  if (scene.atoms.length) body.push('% atoms');
  scene.atoms.forEach((atom, i) => {
    const d = displays[i];
    if (!d.shown) {
      body.push(`\\coordinate (${name(i)}) at ${at(atom)};`);
      return;
    }
    body.push(`\\node[inner sep=1pt] (${name(i)}) at ${at(atom)} {${labelText(d)}};`);
    if (d.hCount > 0 && (d.hSide === 'above' || d.hSide === 'below')) {
      const [anchor, from] = d.hSide === 'below' ? ['north', 'south'] : ['south', 'north'];
      body.push(`\\node[inner sep=0pt, anchor=${anchor}] at (${name(i)}.${from}) {${hText(d.hCount)}};`);
    }
    if (d.radical > 0) {
      const t = d.radicalAngle;
      const dots = d.radical === 2 ? [0] : [1.5, -1.5];
      for (const off of dots) {
        const shift = off ? ` ++(${t + 90}:${fmt(off)}pt)` : '';
        body.push(`\\fill (${name(i)}.${t}) ++(${t}:1.8pt)${shift} circle[radius=0.9pt];`);
      }
    }
  });

  // Bonds.
  if (scene.bonds.length) body.push('% bonds');
  const sp = 0.15 * lref * unit; // distance between the lines of a multiple bond (cm)
  scene.bonds.forEach((b, bi) => {
    const p = scene.atoms[b.begin];
    const q = scene.atoms[b.end];
    const line = `(${name(b.begin)}) -- (${name(b.end)})`;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return;
    // Left unit normal of begin -> end (y up).
    const nx = -dy / len;
    const ny = dx / len;
    const shifted = (k: number, extra = '') =>
      `\\draw[transform canvas={xshift=${dim(nx * k)},yshift=${dim(ny * k)}}${extra}] ${line};`;

    if (b.order === 1 && b.stereo) {
      body.push(stereoBond(b.stereo, b.begin, b.end));
      return;
    }
    if (b.order === 1) {
      body.push(`\\draw ${line};`);
      return;
    }
    if (b.order === 3) {
      body.push(`\\draw ${line};`, shifted(sp), shifted(-sp));
      return;
    }
    // Double or aromatic.
    const side = doubleBondSide(scene, adj, displays, bi);
    const dash = b.partial ? ', dash pattern=on 0.6pt off 1.6pt' : b.order === 4 ? ', dash pattern=on 2pt off 1.5pt' : '';
    if (side === 'center' && b.order === 2) {
      body.push(shifted(sp / 2), shifted(-sp / 2));
      return;
    }
    const k = side === 'right' ? -sp : sp;
    const lenCm = len * unit;
    const trim = (i: number) => (displays[i].shown ? 0.03 : 0.12 * lenCm);
    body.push(
      `\\draw ${line};`,
      shifted(k, `, shorten <=${dim(trim(b.begin))}, shorten >=${dim(trim(b.end))}${dash}`),
    );
  });

  function stereoBond(stereo: 'up' | 'down' | 'either', from: number, to: number): string {
    // Work in cm; trim the ends that carry a label.
    const p = cm(scene.atoms[from]);
    const q = cm(scene.atoms[to]);
    const lenCm = Math.hypot(q.x - p.x, q.y - p.y);
    const ux = (q.x - p.x) / lenCm;
    const uy = (q.y - p.y) / lenCm;
    const trimFor = (i: number) => {
      if (!displays[i].shown) return 0;
      const [w, h] = labelHalfExtent(displays[i]);
      return Math.min(Math.abs(ux) > 1e-6 ? w / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? h / Math.abs(uy) : Infinity);
    };
    const t0 = Math.min(trimFor(from), lenCm * 0.4);
    const t1 = Math.min(trimFor(to), lenCm * 0.4);
    const a = { x: p.x + ux * t0, y: p.y + uy * t0 };
    const bEnd = { x: q.x - ux * t1, y: q.y - uy * t1 };
    const hw = 0.1 * lref * unit; // half width of the wide end
    const nx = -uy;
    const ny = ux;
    if (stereo === 'either') {
      // Wavy bond (IUPAC: configuration unknown): a smooth sine line, no extra TikZ library.
      const usable = Math.hypot(bEnd.x - a.x, bEnd.y - a.y);
      const waves = Math.max(2, Math.round(usable / 0.18));
      const pts: string[] = [];
      for (let s = 0; s <= waves * 8; s++) {
        const t = s / (waves * 8);
        const off = Math.sin(t * waves * 2 * Math.PI) * hw * 0.6;
        pts.push(xy({ x: a.x + (bEnd.x - a.x) * t + nx * off, y: a.y + (bEnd.y - a.y) * t + ny * off }));
      }
      return `\\draw plot[smooth] coordinates {${pts.join(' ')}};`;
    }
    if (stereo === 'up') {
      return `\\fill ${xy(a)} -- ${xy({ x: bEnd.x + nx * hw, y: bEnd.y + ny * hw })} -- ${xy({
        x: bEnd.x - nx * hw,
        y: bEnd.y - ny * hw,
      })} -- cycle;`;
    }
    const usable = Math.hypot(bEnd.x - a.x, bEnd.y - a.y);
    const n = Math.max(4, Math.round(usable / 0.1));
    const segs: string[] = [];
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      const c = { x: a.x + (bEnd.x - a.x) * t, y: a.y + (bEnd.y - a.y) * t };
      const w = Math.max(hw * t, 0.012);
      segs.push(`${xy({ x: c.x + nx * w, y: c.y + ny * w })} -- ${xy({ x: c.x - nx * w, y: c.y - ny * w })}`);
    }
    return `\\draw ${segs.join(' ')};`;
  }

  // Pluses.
  if (scene.pluses.length) body.push('% pluses');
  for (const p of scene.pluses) body.push(`\\node at ${at(p)} {$+$};`);

  // Arrows.
  if (scene.arrows.length) body.push('% arrows');
  for (const a of scene.arrows) body.push(...arrowLines(a));

  function arrowLines(a: SceneArrow): string[] {
    const s = cm(a.start);
    const e = cm(a.end);
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    if (isCurved(a)) {
      const [c1, c2] = arcBezier(a.start, a.end, a.height ?? 0);
      const tip =
        a.kind === 'single-electron'
          ? `${arrowTip(a.mode)}[${fishhookKeys(a.start, a.end, { x: c1.x - a.start.x, y: c1.y - a.start.y })}]`
          : arrowTip(a.mode);
      return [`\\draw[-{${tip}}] ${xy(s)} .. controls ${at(c1)} and ${at(c2)} .. ${xy(e)};`];
    }
    if (len < 1e-9) return [];
    const ux = (e.x - s.x) / len;
    const uy = (e.y - s.y) / len;
    if (a.kind === 'equilibrium') {
      const o = 0.07; // half gap between the two harpoons (cm)
      const off = (p: Point, k: number, t = 0): Point => ({
        x: p.x - uy * k + ux * t,
        y: p.y + ux * k + uy * t,
      });
      const shrink = a.mode.startsWith('unbalanced') ? len * 0.25 : 0;
      const tip = `${arrowTip(a.mode)}[harpoon]`;
      return [
        `\\draw[-{${tip}}] ${xy(off(s, o))} -- ${xy(off(e, o))};`,
        `\\draw[-{${tip}}] ${xy(off(e, -o, -shrink))} -- ${xy(off(s, -o, shrink))};`,
      ];
    }
    switch (a.mode) {
      case 'dashed-open-angle':
        return [`\\draw[dashed, -{Straight Barb}] ${xy(s)} -- ${xy(e)};`];
      case 'retrosynthetic':
        return [`\\draw[double, double distance=2pt, -{Implies}] ${xy(s)} -- ${xy(e)};`];
      case 'both-ends-filled-triangle':
        return [`\\draw[{Triangle}-{Triangle}] ${xy(s)} -- ${xy(e)};`];
      case 'failed': {
        const m = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
        const r = 0.12;
        const c = Math.SQRT1_2;
        // Two strokes at +-45 degrees to the arrow.
        const d1 = { x: (ux - uy) * c * r, y: (uy + ux) * c * r };
        const d2 = { x: (ux + uy) * c * r, y: (uy - ux) * c * r };
        return [
          `\\draw[-{Straight Barb}] ${xy(s)} -- ${xy(e)};`,
          `\\draw ${xy({ x: m.x + d1.x, y: m.y + d1.y })} -- ${xy({ x: m.x - d1.x, y: m.y - d1.y })} ${xy({
            x: m.x + d2.x,
            y: m.y + d2.y,
          })} -- ${xy({ x: m.x - d2.x, y: m.y - d2.y })};`,
        ];
      }
      default:
        return [`\\draw[-{${a.kind === 'reaction' ? arrowTip(a.mode) : 'Stealth'}}] ${xy(s)} -- ${xy(e)};`];
    }
  }

  const header = `% MecHand TikZ export: 1 Ketcher unit = ${fmt(unit)} cm; needs \\usetikzlibrary{arrows.meta,bending}`;
  if (!wrap) return [header, ...body].join('\n');
  return [
    header,
    '\\begin{tikzpicture}[line cap=round, line join=round]',
    ...body.map((l) => `  ${l}`),
    '\\end{tikzpicture}',
  ].join('\n');
}
