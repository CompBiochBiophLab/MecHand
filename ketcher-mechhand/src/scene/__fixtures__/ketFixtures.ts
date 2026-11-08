/**
 * Hand-built KET documents shaped like ketcher.getKet() output, used by the
 * scene and exporter tests and by the LaTeX compile check.
 * Coordinates: Ketcher units, y up, bond length 1.
 */

interface FxAtom {
  label: string;
  x: number;
  y: number;
  charge?: number;
  radical?: number;
  isotope?: number;
  alias?: string;
}

/** [begin, end, type, stereo?] */
type FxBond = [number, number, number, number?];

export function molecule(atoms: FxAtom[], bonds: FxBond[]) {
  return {
    type: 'molecule',
    atoms: atoms.map((a) => {
      const out: Record<string, unknown> = { label: a.label, location: [a.x, a.y, 0] };
      if (a.charge) out.charge = a.charge;
      if (a.radical) out.radical = a.radical;
      if (a.isotope) out.isotope = a.isotope;
      if (a.alias) out.alias = a.alias;
      return out;
    }),
    bonds: bonds.map(([i, j, type, stereo]) => {
      const out: Record<string, unknown> = { type, atoms: [i, j] };
      if (stereo) out.stereo = stereo;
      return out;
    }),
  };
}

export const plus = (x: number, y: number) => ({ type: 'plus', location: [x, y, 0] });

export const arrow = (mode: string, x1: number, y1: number, x2: number, y2: number, height?: number) => ({
  type: 'arrow',
  data: {
    mode,
    pos: [
      { x: x1, y: y1, z: 0 },
      { x: x2, y: y2, z: 0 },
    ],
    ...(height === undefined ? {} : { height }),
  },
});

export function ket(molecules: object[], others: object[] = []) {
  const doc: Record<string, unknown> = {
    root: { nodes: [...molecules.map((_, i) => ({ $ref: `mol${i}` })), ...others] },
  };
  molecules.forEach((m, i) => (doc[`mol${i}`] = m));
  return doc;
}

const r3 = Math.sqrt(3) / 2;

/** Regular hexagon (bond length 1) centred at (cx, cy), vertex k at angle 90 + 60k degrees. */
function hexagon(cx: number, cy: number, label = 'C'): FxAtom[] {
  return Array.from({ length: 6 }, (_, k) => {
    const t = ((90 + 60 * k) * Math.PI) / 180;
    return { label, x: cx + Math.cos(t), y: cy + Math.sin(t) };
  });
}

export const ethanol = ket([
  molecule(
    [
      { label: 'C', x: 0, y: 0 },
      { label: 'C', x: r3, y: 0.5 },
      { label: 'O', x: 2 * r3, y: 0 },
    ],
    [
      [0, 1, 1],
      [1, 2, 1],
    ],
  ),
]);

/** Kekulé benzene (alternating KET bond types 1/2). */
export const benzene = ket([
  molecule(hexagon(0, 0), [
    [0, 1, 2],
    [1, 2, 1],
    [2, 3, 2],
    [3, 4, 1],
    [4, 5, 2],
    [5, 0, 1],
  ]),
]);

/** Toluene drawn with aromatic (type 4) ring bonds. */
export const aromaticToluene = ket([
  molecule(
    [...hexagon(0, 0), { label: 'C', x: 0, y: 2 }],
    [
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 4, 4],
      [4, 5, 4],
      [5, 0, 4],
      [0, 6, 1],
    ],
  ),
]);

/** Pyrrole with aromatic bonds and the N-H implicit (needs the N to be left out of the matching). */
export const aromaticPyrrole = ket([
  molecule(
    Array.from({ length: 5 }, (_, k) => {
      const t = ((270 + 72 * k) * Math.PI) / 180;
      const r = 1 / (2 * Math.sin(Math.PI / 5));
      return { label: k === 0 ? 'N' : 'C', x: r * Math.cos(t), y: r * Math.sin(t) };
    }),
    [
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 4, 4],
      [4, 0, 4],
    ],
  ),
]);

/** Ring + exocyclic C=O at the top vertex (atom 0). */
export const cyclohexanone = ket([
  molecule(
    [...hexagon(0, 0), { label: 'O', x: 0, y: 2 }],
    [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
      [3, 4, 1],
      [4, 5, 1],
      [5, 0, 1],
      [0, 6, 2],
    ],
  ),
]);

/** Acetate anion: CH3-C(=O)-O(-). */
export const acetate = ket([
  molecule(
    [
      { label: 'C', x: 0, y: 0 },
      { label: 'C', x: r3, y: 0.5 },
      { label: 'O', x: r3, y: 1.5 },
      { label: 'O', x: 2 * r3, y: 0, charge: -1 },
    ],
    [
      [0, 1, 1],
      [1, 2, 2],
      [1, 3, 1],
    ],
  ),
]);

/** Ethyl radical CH3-CH2(.) */
export const ethylRadical = ket([
  molecule(
    [
      { label: 'C', x: 0, y: 0 },
      { label: 'C', x: r3, y: 0.5, radical: 2 },
    ],
    [[0, 1, 1]],
  ),
]);

/**
 * SN2: HO(-) + CH3Br -> HOCH3 + Br(-), with one electron-pair arrow from the
 * hydroxide to the carbon (bulging up), a plus and a reaction arrow. The
 * substrate carries a wedge and a hash.
 */
export const sn2 = ket(
  [
    molecule([{ label: 'O', x: 0, y: 0, charge: -1 }], []),
    molecule(
      [
        { label: 'C', x: 3, y: 0 },
        { label: 'Br', x: 4, y: 0 },
        { label: 'H', x: 3, y: 1 },
        { label: 'H', x: 3 - r3, y: -0.5 },
        { label: 'H', x: 3 - 0.5, y: -r3 },
      ],
      [
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1, 1],
        [0, 4, 1, 6],
      ],
    ),
    molecule(
      [
        { label: 'O', x: 8, y: 0 },
        { label: 'C', x: 9, y: 0 },
      ],
      [[0, 1, 1]],
    ),
    molecule([{ label: 'Br', x: 11, y: 0, charge: -1 }], []),
  ],
  [
    plus(1.25, 0),
    arrow('elliptical-arc-arrow-filled-bow', 0.25, 0.25, 2.85, 0.15, 0.8),
    arrow('open-angle', 5, 0, 7, 0),
    plus(10.2, 0),
  ],
);

/** Br-Br homolysis: two fishhook arrows from the bond middle to each Br, reaction arrow, 2 Br radicals. */
export const brominHomolysis = ket(
  [
    molecule(
      [
        { label: 'Br', x: 0, y: 0 },
        { label: 'Br', x: 1, y: 0 },
      ],
      [[0, 1, 1]],
    ),
    molecule([{ label: 'Br', x: 4.5, y: 0, radical: 2 }], []),
    molecule([{ label: 'Br', x: 6, y: 0, radical: 2 }], []),
  ],
  [
    // Both arcs bulge upward, away from the bond, as a chemist draws them.
    arrow('elliptical-arc-arrow-open-half-angle', 0.5, 0.1, 0.05, 0.35, -0.3),
    arrow('elliptical-arc-arrow-open-half-angle', 0.5, 0.1, 0.95, 0.35, 0.3),
    arrow('open-angle', 2, 0, 3.5, 0),
    plus(5.25, 0),
  ],
);

/** Acid-base equilibrium with an oxonium: CH3COOH + H2O <=> CH3COO(-) + H3O(+). */
export const acidBase = ket(
  [
    molecule(
      [
        { label: 'C', x: 0, y: 0 },
        { label: 'C', x: r3, y: 0.5 },
        { label: 'O', x: r3, y: 1.5 },
        { label: 'O', x: 2 * r3, y: 0 },
      ],
      [
        [0, 1, 1],
        [1, 2, 2],
        [1, 3, 1],
      ],
    ),
    molecule([{ label: 'O', x: 3.6, y: 0.3 }], []),
    molecule(
      [
        { label: 'C', x: 6.4, y: 0 },
        { label: 'C', x: 6.4 + r3, y: 0.5 },
        { label: 'O', x: 6.4 + r3, y: 1.5 },
        { label: 'O', x: 6.4 + 2 * r3, y: 0, charge: -1 },
      ],
      [
        [0, 1, 1],
        [1, 2, 2],
        [1, 3, 1],
      ],
    ),
    molecule([{ label: 'O', x: 10.4, y: 0.3, charge: 1 }], []),
  ],
  [plus(2.65, 0.3), arrow('equilibrium-filled-half-bow', 4.4, 0.3, 5.9, 0.3), plus(9.3, 0.3)],
);

/**
 * Odd cases: isotope, ammonium, triple bond, secondary amine (H below), a
 * carbene, an alias with TeX special characters, and unbalanced/failed/
 * retrosynthetic/dashed arrows.
 */
export const oddities = ket(
  [
    molecule(
      [
        { label: 'C', x: 0, y: 0, isotope: 13 },
        { label: 'C', x: 1, y: 0 },
        { label: 'N', x: 2, y: 0 },
        { label: 'C', x: -r3, y: 0.5 },
        { label: 'N', x: -2 * r3, y: 0 },
        { label: 'C', x: -3 * r3, y: 0.5 },
      ],
      [
        [0, 1, 1],
        [1, 2, 3],
        [0, 3, 1],
        [3, 4, 1],
        [4, 5, 1],
      ],
    ),
    molecule([{ label: 'N', x: 4, y: 0, charge: 1 }], []),
    molecule([{ label: 'C', x: 5.5, y: 0, radical: 1 }], []),
    molecule(
      [
        { label: 'C', x: 7, y: 0 },
        { label: 'C', x: 9.5, y: 0, alias: 'CO2Me_{x}%#&$^~\\?@' },
      ],
      [[0, 1, 1]],
    ),
  ],
  [
    arrow('unbalanced-equilibrium-filled-half-bow', 12, 0, 13.5, 0),
    arrow('failed', 14, 0, 15.5, 0),
    arrow('retrosynthetic', 16, 0, 17.5, 0),
    arrow('dashed-open-angle', 18, 0, 19.5, 0),
    arrow('both-ends-filled-triangle', 20, 0, 21.5, 0),
  ],
);

/** A curved arrow far from every atom: chemfig must drop it with a note. */
export const strayArrow = ket(
  [molecule([...hexagon(0, 0)], [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 0, 1]])],
  [arrow('elliptical-arc-arrow-filled-triangle', 5, 5, 7, 5, 1)],
);

export const ALL_FIXTURES: Record<string, object> = {
  ethanol,
  benzene,
  aromaticToluene,
  aromaticPyrrole,
  cyclohexanone,
  acetate,
  ethylRadical,
  sn2,
  brominHomolysis,
  acidBase,
  oddities,
  strayArrow,
};
