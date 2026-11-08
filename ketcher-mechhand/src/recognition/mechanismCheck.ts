/**
 * Electron-flow checks for curved arrows (inspired by the electron-flow arrows of
 * ChemAxon Marvin, where arrows are attached to electron sources and sinks).
 *
 * Simple rules a student (or reviewer) expects:
 *  - An electron-pair arrow starts at a bond or at an atom that has a lone pair
 *    (heteroatom, or a negatively charged / carbanion centre).
 *  - It ends at an atom or a bond.
 *  - Second-row atoms (C, N, O, F) must not exceed an octet after the step
 *    unless another arrow removes electrons from them (e.g. the C–Br bond in SN2).
 */

import type { Scene } from '../scene/types';
import type { ArrowAnchor, RecognizedArrow } from './sketch';

export interface MechanismIssue {
  arrow: number;
  severity: 'warning' | 'info';
  message: string;
}

const VALENCE_ELECTRONS: Record<string, number> = {
  H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, Si: 4, P: 5, S: 6, Cl: 7, Br: 7, I: 7,
};
const OCTET_LIMITED = new Set(['C', 'N', 'O', 'F']);

/** Bond-order sum around an atom (aromatic counted as 1.5). */
function bondOrderSum(scene: Scene, atom: number): number {
  return scene.bonds.reduce((s, b) => (b.begin === atom || b.end === atom ? s + (b.order === 4 ? 1.5 : b.order) : s), 0);
}

/** Non-bonding electrons, assuming implicit hydrogens fill the usual valence. */
export function lonePairs(scene: Scene, atom: number): number {
  const a = scene.atoms[atom];
  const ve = VALENCE_ELECTRONS[a.symbol];
  if (ve === undefined) return 0;
  const typical = a.symbol === 'C' || a.symbol === 'Si' ? 4 : a.symbol === 'B' ? 3 : 8 - ve;
  const bonds = Math.max(bondOrderSum(scene, atom), typical + (a.symbol === 'C' ? 0 : a.charge));
  const nonBonding = ve - a.charge - bonds - (a.radical === 2 ? 1 : 0);
  return Math.max(0, Math.floor(nonBonding / 2));
}

function describe(anchor: ArrowAnchor, scene: Scene): string {
  if (anchor.type === 'atom') return `${scene.atoms[anchor.atom].symbol}${anchor.atom + 1}`;
  if (anchor.type === 'bond') {
    const b = scene.bonds[anchor.bond];
    return `bond ${scene.atoms[b.begin].symbol}${b.begin + 1}–${scene.atoms[b.end].symbol}${b.end + 1}`;
  }
  return 'nothing';
}

export function checkMechanism(scene: Scene, arrows: RecognizedArrow[]): MechanismIssue[] {
  const issues: MechanismIssue[] = [];
  const losing = new Set<number>(); // atoms that lose a bond pair through an arrow
  arrows.forEach(({ from }) => {
    if (from.type === 'bond') {
      const b = scene.bonds[from.bond];
      losing.add(b.begin).add(b.end);
    }
  });

  arrows.forEach(({ arrow, from, to }, i) => {
    if (arrow.kind !== 'electron-pair' && arrow.kind !== 'single-electron') return;
    if (from.type === 'none') {
      issues.push({ arrow: i, severity: 'warning', message: `Arrow ${i + 1} does not start at an atom or a bond.` });
    } else if (from.type === 'atom' && arrow.kind === 'electron-pair') {
      const a = scene.atoms[from.atom];
      if (lonePairs(scene, from.atom) === 0 && a.charge >= 0) {
        issues.push({
          arrow: i, severity: 'warning',
          message: `Arrow ${i + 1} starts at ${describe(from, scene)}, which has no lone pair. Start it at a lone pair or a bond.`,
        });
      }
    }
    if (to.type === 'none') {
      issues.push({ arrow: i, severity: 'warning', message: `Arrow ${i + 1} does not point to an atom or a bond.` });
    } else if (to.type === 'atom' && arrow.kind === 'electron-pair') {
      const a = scene.atoms[to.atom];
      if (OCTET_LIMITED.has(a.symbol) && a.charge <= 0 && !losing.has(to.atom)) {
        const ve = VALENCE_ELECTRONS[a.symbol];
        const electrons = 2 * bondOrderSum(scene, to.atom) + 2 * lonePairs(scene, to.atom);
        const implicitH = a.symbol === 'C' ? Math.max(0, 4 - bondOrderSum(scene, to.atom)) : 0;
        if (electrons + 2 * implicitH + 2 > 8 && ve !== undefined) {
          issues.push({
            arrow: i, severity: 'warning',
            message: `Arrow ${i + 1} gives ${describe(to, scene)} more than an octet. Is a bond to it breaking at the same time?`,
          });
        }
      }
    }
  });
  return issues;
}
