/**
 * Small SVG drawings of library entries (structures and mechanism schemes), rendered at runtime
 * from the stored coordinates: no images, no network.
 */

import { type ReactNode, memo } from 'react';
import { ketToScene } from '../scene/ketToScene';
import type { Point, SceneArrow } from '../scene/types';
import type { LibraryEntry } from '../templates/library';

export interface ThumbAtom {
  symbol: string;
  x: number;
  y: number;
  /** Hydrogens written next to the label. */
  h: number;
  charge: number;
  /** KET radical code: 1 singlet, 2 doublet, 3 triplet. */
  radical: number;
  /** R groups and other non-element labels (drawn in italics). */
  pseudo: boolean;
}

export interface ThumbBond {
  a: number;
  b: number;
  order: number;
  /** 1 wedge, 6 hash (narrow end at `a`). */
  stereo: number;
}

export interface ThumbData {
  atoms: ThumbAtom[];
  bonds: ThumbBond[];
  arrows: SceneArrow[];
  pluses: Point[];
}

const ELEMENT = /^(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Ga|Ge|As|Se|Br|Kr|Rb|Sr|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|I|Xe|Cs|Ba|Os|Ir|Pt|Au|Hg|Tl|Pb|Bi)$/;

/** Hydrogens Ketcher would show on a labelled atom (subset of ketcher-core's valence rules). */
export function implicitHydrogens(symbol: string, charge: number, radical: number, conn: number): number {
  const rad = radical === 2 ? 1 : radical === 1 || radical === 3 ? 2 : 0;
  const ac = Math.abs(charge);
  let h = 0;
  switch (symbol) {
    case 'H': case 'Li': case 'Na': case 'K': h = 1 - rad - conn - ac; break;
    case 'B': case 'Al': h = charge === -1 ? 4 - rad - conn : 3 - rad - conn - ac; break;
    case 'C': case 'Si': h = 4 - rad - conn - ac; break;
    case 'N': case 'P':
      if (charge === 1) h = 4 - rad - conn;
      else if (charge === 2) h = 3 - rad - conn;
      else h = rad + conn + ac <= 3 ? 3 - rad - conn - ac : 5 - rad - conn - ac;
      break;
    case 'O': h = charge >= 1 ? 3 - rad - conn : 2 - rad - conn - ac; break;
    case 'S': case 'Se':
      if (charge === 1) h = conn <= 3 ? 3 - rad - conn : 5 - rad - conn;
      else h = conn + rad + ac <= 2 ? 2 - rad - conn - ac : conn + rad + ac <= 4 ? 4 - rad - conn - ac : 6 - rad - conn - ac;
      break;
    case 'F': h = 1 - rad - conn - ac; break;
    case 'Cl': case 'Br': case 'I':
      h = charge === 1 ? (conn <= 2 ? 2 - rad - conn : 0) : charge === 0 && conn <= 1 ? 1 - rad - conn : 0;
      break;
    default: h = 0;
  }
  return Math.max(0, h);
}

const cache = new Map<string, ThumbData>();

/** Drawing data of an entry (cached per id). */
export function thumbData(entry: LibraryEntry): ThumbData {
  const hit = cache.get(entry.id);
  if (hit) return hit;
  let data: ThumbData;
  if (entry.mol) {
    data = {
      atoms: entry.mol.atoms.map(([symbol, x, y, h, charge, radical]) => ({
        symbol, x, y, h: h ?? 0, charge: charge ?? 0, radical: radical ?? 0, pseudo: !ELEMENT.test(symbol),
      })),
      bonds: entry.mol.bonds.map(([a, b, order, stereo]) => ({ a, b, order, stereo: stereo ?? 0 })),
      arrows: [],
      pluses: [],
    };
  } else {
    const scene = ketToScene(entry.ket ?? '');
    const conn = scene.atoms.map(() => 0);
    for (const b of scene.bonds) {
      const o = b.order === 4 ? 1.5 : b.order;
      conn[b.begin] += o;
      conn[b.end] += o;
    }
    data = {
      atoms: scene.atoms.map((a, i) => ({
        symbol: a.symbol, x: a.x, y: a.y, charge: a.charge, radical: a.radical ?? 0, pseudo: !ELEMENT.test(a.symbol),
        h: implicitHydrogens(a.symbol, a.charge, a.radical ?? 0, Math.round(conn[i])),
      })),
      bonds: scene.bonds.map((b) => ({ a: b.begin, b: b.end, order: b.order, stereo: b.stereo === 'up' ? 1 : b.stereo === 'down' ? 6 : 0 })),
      arrows: scene.arrows,
      pluses: scene.pluses,
    };
  }
  cache.set(entry.id, data);
  return data;
}

const COLOR: Record<string, string> = {
  O: '#dc2626', N: '#2563eb', S: '#a16207', P: '#c2410c', F: '#15803d', Cl: '#15803d', Br: '#9a3412', I: '#7e22ce',
  B: '#b45309', Se: '#a16207',
};
const INK = '#1f2937';
const ARROW = '#dc2626';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const textWidth = (s: string, fs: number) => [...s].reduce((w, c) => w + fs * (/[A-Z]/.test(c) ? 0.68 : /[0-9]/.test(c) ? 0.42 : 0.5), 0);
const chargeText = (c: number) => (c === 0 ? '' : `${Math.abs(c) > 1 ? Math.abs(c) : ''}${c > 0 ? '+' : '−'}`);

type HSide = 'right' | 'left' | 'up' | 'down';

/**
 * Where to write the hydrogens of a label: on the side least blocked by its bonds (H2O, HO−, HCl on
 * the left; NH3, CH4 on the right; a ring NH between two bonds pointing right and down-left goes up).
 */
function hSide(a: ThumbAtom, bonds: { dx: number; dy: number }[]): HSide {
  if (bonds.length === 0) return ['O', 'S', 'F', 'Cl', 'Br', 'I'].includes(a.symbol) ? 'left' : 'right';
  const block = (ux: number, uy: number) => Math.max(...bonds.map(({ dx, dy }) => (dx * ux + dy * uy) / (Math.hypot(dx, dy) || 1)));
  // Beside the symbol when no bond comes within 60 degrees of that side (OH, NH2, HO), else above/below.
  if (block(1, 0) < 0.5) return 'right';
  if (block(-1, 0) < 0.5) return 'left';
  const sides: [HSide, number][] = [['up', block(0, 1)], ['down', block(0, -1)], ['right', block(1, 0)], ['left', block(-1, 0)]];
  return sides.reduce((a, b) => (b[1] < a[1] - 1e-6 ? b : a))[0];
}

/**
 * The drawing itself. Width/height are in px; `maxScale` caps the px per bond length so that small
 * molecules (water) are not blown up.
 */
export const MoleculeThumb = memo(function MoleculeThumb({ data, width, height, maxScale = 24 }: {
  data: ThumbData; width: number; height: number; maxScale?: number;
}) {
  const pts: Point[] = [...data.atoms, ...data.pluses, ...data.arrows.flatMap((a) => [a.start, a.end])];
  if (!pts.length) return <svg width={width} height={height} aria-hidden="true" />;
  const n = data.atoms.length;
  const nbrs: number[][] = Array.from({ length: n }, () => []);
  for (const b of data.bonds) {
    nbrs[b.a].push(b.b);
    nbrs[b.b].push(b.a);
  }
  const labelled = data.atoms.map((a, i) =>
    a.pseudo || a.symbol !== 'C' || nbrs[i].length === 0 || (nbrs[i].length === 1 && (a.charge !== 0 || a.radical !== 0)));
  const sides = data.atoms.map((a, i) =>
    (a.h > 0 ? hSide(a, nbrs[i].map((m) => ({ dx: data.atoms[m].x - a.x, dy: data.atoms[m].y - a.y }))) : 'right') as HSide);
  const pad = 4;
  const fit = (extra: (fs: number, sc: number) => { l: number; r: number; t: number; b: number }[]) => {
    let s0 = maxScale;
    for (let pass = 0; pass < 3; pass++) {
      const fs0 = clamp(0.62 * s0, 7, 13);
      const ext = extra(fs0, s0);
      const xs = pts.map((p, i) => [p.x - (ext[i]?.l ?? 0), p.x + (ext[i]?.r ?? 0)]).flat();
      const ys = pts.map((p, i) => [p.y - (ext[i]?.b ?? 0), p.y + (ext[i]?.t ?? 0)]).flat();
      const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
      s0 = Math.min((width - 2 * pad) / Math.max(box.maxX - box.minX, 1e-3), (height - 2 * pad) / Math.max(box.maxY - box.minY, 1e-3), maxScale);
      if (pass === 2) return { s: s0, ...box };
    }
    throw new Error('unreachable');
  };
  // Label extents in drawing units (atoms only; pluses and arrow ends get a small margin).
  const { s, minX, maxX, minY, maxY } = fit((fs0, sc) => pts.map((_, i) => {
    if (i >= n) return { l: 0.3, r: 0.3, t: 0.3, b: 0.3 };
    const a = data.atoms[i];
    const half = (labelled[i] ? textWidth(a.symbol, fs0) / 2 + 2 : 3) / sc;
    const hw = a.h > 0 && labelled[i] ? textWidth(a.h > 1 ? `H${a.h}` : 'H', fs0) / sc : 0;
    const vh = (labelled[i] ? fs0 * 0.6 : 3) / sc;
    const side = sides[i];
    const ch = a.charge ? (fs0 * 0.6) / sc : 0;
    return {
      l: half + (side === 'left' ? hw : 0),
      r: half + (side === 'right' ? hw : 0) + ch,
      t: vh + (side === 'up' ? (fs0 * 0.95) / sc : 0) + (a.radical || a.charge ? (fs0 * 0.4) / sc : 0),
      b: vh + (side === 'down' ? (fs0 * 0.95) / sc : 0),
    };
  }));
  const ox = (width - (maxX - minX) * s) / 2, oy = (height - (maxY - minY) * s) / 2;
  const X = (x: number) => ox + (x - minX) * s;
  const Y = (y: number) => oy + (maxY - y) * s; // y up -> screen
  const fs = clamp(0.62 * s, 7, 13);
  const lw = clamp(0.065 * s, 0.9, 1.5);

  const sx = data.atoms.map((a) => X(a.x));
  const sy = data.atoms.map((a) => Y(a.y));
  const halfW = data.atoms.map((a, i) => (labelled[i] ? textWidth(a.symbol, fs) / 2 + 1 : 0));

  const out: ReactNode[] = [];

  // Bonds
  data.bonds.forEach((b, k) => {
    let x1 = sx[b.a], y1 = sy[b.a], x2 = sx[b.b], y2 = sy[b.b];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const nx = -uy, ny = ux;
    const trim = (i: number) => (labelled[i] ? Math.min(halfW[i] / Math.max(Math.abs(ux), 1e-3), (fs * 0.55) / Math.max(Math.abs(uy), 1e-3)) + 1 : 0);
    const t1 = trim(b.a), t2 = trim(b.b);
    x1 += ux * t1; y1 += uy * t1; x2 -= ux * t2; y2 -= uy * t2;
    const key = `b${k}`;
    if (b.stereo === 1 && b.order === 1) {
      const w = clamp(0.13 * s, 2, 3.8);
      out.push(<polygon key={key} points={`${x1},${y1} ${x2 + nx * w},${y2 + ny * w} ${x2 - nx * w},${y2 - ny * w}`} fill={INK} />);
      return;
    }
    if (b.stereo === 6 && b.order === 1) {
      const w = clamp(0.13 * s, 2, 3.8);
      const steps = Math.max(3, Math.round((len - t1 - t2) / 3));
      const segs: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, hw = 0.4 + t * (w - 0.4);
        const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
        segs.push(`M${px + nx * hw},${py + ny * hw}L${px - nx * hw},${py - ny * hw}`);
      }
      out.push(<path key={key} d={segs.join('')} stroke={INK} strokeWidth={Math.max(0.8, lw * 0.8)} />);
      return;
    }
    const line = (k2: string, ax: number, ay: number, bx: number, by: number, dash?: string) => (
      <line key={k2} x1={ax} y1={ay} x2={bx} y2={by} stroke={INK} strokeWidth={lw} strokeLinecap="round" strokeDasharray={dash} />
    );
    const d = clamp(0.2 * s, 2.2, 4);
    if (b.order === 1) {
      out.push(line(key, x1, y1, x2, y2));
    } else if (b.order === 3) {
      out.push(line(key, x1, y1, x2, y2), line(`${key}p`, x1 + nx * d, y1 + ny * d, x2 + nx * d, y2 + ny * d),
        line(`${key}m`, x1 - nx * d, y1 - ny * d, x2 - nx * d, y2 - ny * d));
    } else {
      // Double (or aromatic) bond: centred when an end is terminal, otherwise a second, shorter
      // line on the side of the neighbours (inside rings).
      let side = 0;
      if (nbrs[b.a].length > 1 && nbrs[b.b].length > 1) {
        for (const [p, q] of [[b.a, b.b], [b.b, b.a]]) {
          for (const m of nbrs[p]) {
            if (m === q) continue;
            side += Math.sign((sx[m] - sx[p]) * nx + (sy[m] - sy[p]) * ny) || 0;
          }
        }
      }
      const dash = b.order === 4 ? '2 2' : undefined;
      if (side === 0) {
        const h = d / 2;
        out.push(line(key, x1 + nx * h, y1 + ny * h, x2 + nx * h, y2 + ny * h),
          line(`${key}2`, x1 - nx * h, y1 - ny * h, x2 - nx * h, y2 - ny * h, dash));
      } else {
        const sg = side > 0 ? 1 : -1;
        const sh = 0.16 * (len - t1 - t2);
        const a1 = labelled[b.a] ? 0 : sh, a2 = labelled[b.b] ? 0 : sh;
        out.push(line(key, x1, y1, x2, y2),
          line(`${key}2`, x1 + ux * a1 + nx * d * sg * 1.35, y1 + uy * a1 + ny * d * sg * 1.35,
            x2 - ux * a2 + nx * d * sg * 1.35, y2 - uy * a2 + ny * d * sg * 1.35, dash));
      }
    }
  });

  // Labels, charges, radicals
  data.atoms.forEach((a, i) => {
    const x = sx[i], y = sy[i];
    const color = a.pseudo ? INK : COLOR[a.symbol] ?? INK;
    const ch = chargeText(a.charge);
    if (labelled[i]) {
      const side = sides[i];
      const hW = a.h > 0 ? textWidth(a.h > 1 ? `H${a.h}` : 'H', fs) : 0;
      const rg = /^([A-Za-z]+)(\d+)$/.exec(a.symbol);
      out.push(
        <text key={`l${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fill={color}
          fontStyle={a.pseudo ? 'italic' : undefined} fontFamily="system-ui, sans-serif">
          {rg && a.pseudo ? <>{rg[1]}<tspan fontSize={fs * 0.7} dy={fs * 0.25} fontStyle="normal">{rg[2]}</tspan></> : a.symbol}
        </text>,
      );
      if (a.h > 0) {
        const hx = side === 'left' ? x - halfW[i] + 1 : side === 'right' ? x + halfW[i] - 1 : x;
        const hy = side === 'up' ? y - fs * 0.95 : side === 'down' ? y + fs * 0.95 : y;
        out.push(
          <text key={`h${i}`} x={hx} y={hy} textAnchor={side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle'}
            dominantBaseline="central" fontSize={fs} fill={color} fontFamily="system-ui, sans-serif">
            H{a.h > 1 && <tspan fontSize={fs * 0.72} dy={fs * 0.28}>{a.h}</tspan>}
          </text>,
        );
      }
      if (ch) {
        const right = x + halfW[i] - 1 + (side === 'right' ? hW : 0);
        out.push(<text key={`c${i}`} x={right} y={y - fs * 0.48} fontSize={fs * 0.72} fill={color} dominantBaseline="central"
          fontFamily="system-ui, sans-serif">{ch}</text>);
      }
    } else if (ch) {
      out.push(<text key={`c${i}`} x={x + fs * 0.25} y={y - fs * 0.55} fontSize={fs * 0.8} fill={INK} dominantBaseline="central"
        fontFamily="system-ui, sans-serif">{ch}</text>);
    }
    if (a.radical) {
      const ry = y - (labelled[i] ? fs * 0.75 : fs * 0.45);
      const dots = a.radical === 2 ? [0] : [-2, 2];
      dots.forEach((dx, k) => out.push(<circle key={`r${i}-${k}`} cx={x + dx} cy={ry} r={Math.max(1.1, lw)} fill={INK} />));
    }
  });

  // Pluses and arrows (mechanisms)
  data.pluses.forEach((p, i) => out.push(
    <text key={`p${i}`} x={X(p.x)} y={Y(p.y)} textAnchor="middle" dominantBaseline="central" fontSize={fs * 1.1} fill={INK}>+</text>,
  ));
  data.arrows.forEach((ar, i) => {
    const sx0 = X(ar.start.x), sy0 = Y(ar.start.y), ex = X(ar.end.x), ey = Y(ar.end.y);
    let path: string, tx: number, ty: number;
    if (ar.height === undefined) {
      path = `M${sx0},${sy0}L${ex},${ey}`;
      tx = ex - sx0; ty = ey - sy0;
    } else {
      const dx = ar.end.x - ar.start.x, dy = ar.end.y - ar.start.y, L = Math.hypot(dx, dy) || 1;
      const lx = -dy / L, ly = dx / L; // left normal, y up
      const h = ar.height * (4 / 3);
      const c1x = X(ar.start.x + lx * h), c1y = Y(ar.start.y + ly * h);
      const c2x = X(ar.end.x + lx * h), c2y = Y(ar.end.y + ly * h);
      path = `M${sx0},${sy0}C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`;
      tx = ex - c2x; ty = ey - c2y;
    }
    const tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl;
    const hl = clamp(0.3 * s, 3.5, 6);
    const wing = (sgn: number) => {
      const c = Math.cos(0.45), sn = Math.sin(0.45) * sgn;
      return `M${ex},${ey}L${ex - hl * (ux * c - uy * sn)},${ey - hl * (uy * c + ux * sn)}`;
    };
    const head = ar.kind === 'single-electron' ? wing(1) : wing(1) + wing(-1);
    out.push(<path key={`a${i}`} d={`${path}${head}`} fill="none" stroke={ARROW} strokeWidth={Math.max(1, lw)} strokeLinecap="round" />);
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      {out}
    </svg>
  );
});
