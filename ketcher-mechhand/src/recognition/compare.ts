/**
 * Scoring of a recognized Scene against a reference (used by the benchmark and
 * the experiments in the tests).
 */

import type { Scene } from '../scene/types';

export interface Score {
  atoms: number;
  bonds: number;
  arrows: number;
  exact: boolean;
}

/** Compare a recognized scene with the reference (positions aligned by centroid). */
export function compareScenes(ref: Scene, got: Scene): Score {
  // eslint-disable-next-line no-param-reassign
  // Scale: the recognizer sets the median bond to 1 unit, while templates draw
  // some bonds longer (metal–ligand), so normalise by the median bond length.
  const medianBond = (s: Scene) => {
    const l = s.bonds.map((b) => Math.hypot(s.atoms[b.begin].x - s.atoms[b.end].x, s.atoms[b.begin].y - s.atoms[b.end].y)).sort((p, q) => p - q);
    return l.length ? l[Math.floor(l.length / 2)] : 1;
  };
  const k = medianBond(ref) / medianBond(got);
  got = { ...got, atoms: got.atoms.map((a) => ({ ...a, x: a.x * k, y: a.y * k })) };
  // Best translation: try every same-element atom pair as an anchor and keep the
  // offset that brings most atoms within 0.4 units (robust to extra/missing atoms).
  let best = { dx: 0, dy: 0, hits: -1 };
  for (const a of ref.atoms) for (const b of got.atoms) {
    if (a.symbol !== b.symbol) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const hits = ref.atoms.filter((r) => got.atoms.some((g) => Math.hypot(g.x - r.x - dx, g.y - r.y - dy) < 0.4)).length;
    if (hits > best.hits) best = { dx, dy, hits };
  }
  const match = new Map<number, number>();
  const used = new Set<number>();
  const pairs = ref.atoms.flatMap((a, i) =>
    got.atoms.map((b, j) => ({ i, j, d: Math.hypot(b.x - a.x - best.dx, b.y - a.y - best.dy) })),
  ).sort((p, q) => p.d - q.d);
  for (const { i, j, d } of pairs) {
    if (d > 0.5 || match.has(i) || used.has(j)) continue;
    match.set(i, j);
    used.add(j);
  }
  const atomOk = ref.atoms.filter((a, i) => {
    const j = match.get(i);
    return j !== undefined && got.atoms[j].symbol === a.symbol && got.atoms[j].charge === a.charge;
  }).length;
  const bondOk = ref.bonds.filter((b) => {
    const x = match.get(b.begin), y = match.get(b.end);
    return x !== undefined && y !== undefined &&
      got.bonds.some((g) => ((g.begin === x && g.end === y) || (g.begin === y && g.end === x)) && g.order === b.order);
  }).length;
  const kinds = (s: Scene) => s.arrows.map((a) => a.kind).sort().join(',');
  const arrowsOk = kinds(ref) === kinds(got);
  const exact = atomOk === ref.atoms.length && bondOk === ref.bonds.length && arrowsOk &&
    got.atoms.length === ref.atoms.length && got.bonds.length === ref.bonds.length;
  return {
    atoms: ref.atoms.length ? atomOk / ref.atoms.length : 1,
    bonds: ref.bonds.length ? bondOk / ref.bonds.length : 1,
    arrows: arrowsOk ? 1 : 0,
    exact,
  };
}
