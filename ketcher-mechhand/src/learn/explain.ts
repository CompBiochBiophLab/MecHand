/**
 * Plain-language explanation of each recognized arrow (level A's "What your arrows mean"):
 * which electrons move, from where to where, and what that does to bonds and charges.
 * Texts: learn.explain.* in src/i18n/locales/learn/<code>.json.
 */

import type { Scene } from '../scene/types';
import type { RecognizedArrow } from '../recognition/sketch';
import { describe } from '../recognition/mechanismCheck';

export interface Explanation {
  arrow: number;
  key: string;
  params: Record<string, string | number>;
}

export function explainArrows(scene: Scene, arrows: RecognizedArrow[]): Explanation[] {
  return arrows.map(({ arrow, from, to }, i): Explanation | null => {
    const n = i + 1;
    const params = { n, from: describe(from, scene), to: describe(to, scene) };
    const out = (key: string): Explanation => ({ arrow: i, key: `learn.explain.${key}`, params });
    switch (arrow.kind) {
      case 'reaction':
        return out('reaction');
      case 'equilibrium':
        return out('equilibrium');
      case 'single-electron':
        return from.type === 'none' || to.type === 'none' ? out('singleLoose') : out('single');
      case 'electron-pair': {
        if (from.type === 'none' || to.type === 'none') return out('pairLoose');
        if (from.type === 'atom') return to.type === 'atom' ? out('pairAtomAtom') : out('pairAtomBond');
        if (to.type === 'bond') return out('pairBondBond');
        const b = scene.bonds[from.bond];
        return b && (b.begin === to.atom || b.end === to.atom) ? out('pairBondAtomOwn') : out('pairBondAtom');
      }
      default:
        return null;
    }
  }).filter((e): e is Explanation => e !== null);
}
