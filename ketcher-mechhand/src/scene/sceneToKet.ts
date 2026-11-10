/**
 * Scene → KET (Ketcher's native JSON), so recognized sketches can be loaded with
 * ketcher.setMolecule() / ketcher.addFragment(). Inverse of ketToScene().
 */

import type { Scene, SceneArrow } from './types';

const BOND_TYPE: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };

/**
 * Ketcher's sign for the elliptical-arc `height`, relative to the Scene
 * convention (positive = bulge to the left of start→end, y up). Verified in the
 * browser against Ketcher 3.18 rendering (see README, "Curved arrows").
 */
export const KET_HEIGHT_SIGN = 1;

export function sceneToKet(scene: Scene): string {
  const nodes: unknown[] = [];
  const doc: Record<string, unknown> = { root: { nodes } };

  // One KET molecule per connected component.
  const byMolecule = new Map<number, number[]>();
  scene.atoms.forEach((a, i) => byMolecule.set(a.molecule, [...(byMolecule.get(a.molecule) ?? []), i]));
  [...byMolecule.entries()].sort((a, b) => a[0] - b[0]).forEach(([, atomIdx], m) => {
    const local = new Map(atomIdx.map((g, l) => [g, l]));
    const atoms = atomIdx.map((g) => {
      const a = scene.atoms[g];
      const atom: Record<string, unknown> = { label: a.symbol, location: [round(a.x), round(a.y), 0] };
      if (a.charge) atom.charge = a.charge;
      if (a.radical) atom.radical = a.radical;
      if (a.isotope) atom.isotope = a.isotope;
      return atom;
    });
    const bonds = scene.bonds
      .filter((b) => local.has(b.begin) && local.has(b.end))
      .map((b) => {
        const bond: Record<string, unknown> = { type: b.partial ? 10 : BOND_TYPE[b.order] ?? 1, atoms: [local.get(b.begin), local.get(b.end)] };
        if (b.stereo === 'up') bond.stereo = 1;
        if (b.stereo === 'down') bond.stereo = 6;
        if (b.stereo === 'either') bond.stereo = 4;
        return bond;
      });
    const key = `mol${m}`;
    doc[key] = { type: 'molecule', atoms, bonds };
    nodes.push({ $ref: key });
  });

  scene.pluses.forEach((p) => nodes.push({ type: 'plus', location: [round(p.x), round(p.y), 0] }));
  scene.arrows.forEach((a) => nodes.push(arrowNode(a)));
  return JSON.stringify(doc);
}

function arrowNode(a: SceneArrow): unknown {
  const data: Record<string, unknown> = {
    mode: a.mode,
    pos: [
      { x: round(a.start.x), y: round(a.start.y), z: 0 },
      { x: round(a.end.x), y: round(a.end.y), z: 0 },
    ],
  };
  if (a.mode.startsWith('elliptical-arc') && a.height !== undefined) data.height = round(a.height * KET_HEIGHT_SIGN);
  return { type: 'arrow', data };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
