import { describe, expect, it } from 'vitest';
import {
  acetate,
  acidBase,
  aromaticPyrrole,
  aromaticToluene,
  benzene,
  cyclohexanone,
  ethanol,
  ethylRadical,
  oddities,
} from '../scene/__fixtures__/ketFixtures';
import { ketToScene } from '../scene/ketToScene';
import {
  arcBezier,
  atomDisplays,
  buildAdjacency,
  doubleBondSide,
  fishhookKeys,
  implicitHydrogens,
  kekulize,
  ringCenter,
} from './structure';

const hCounts = (doc: object) => {
  const scene = ketToScene(doc);
  const adj = buildAdjacency(scene);
  return scene.atoms.map((_, i) => implicitHydrogens(scene, adj, i));
};

describe('implicit hydrogens', () => {
  it('follows standard valences, charges and radicals', () => {
    expect(hCounts(ethanol)).toEqual([3, 2, 1]);
    expect(hCounts(acetate)).toEqual([3, 0, 0, 0]);
    expect(hCounts(ethylRadical)).toEqual([3, 2]);
    // CH3COOH, H2O, CH3COO-, H3O+
    expect(hCounts(acidBase)).toEqual([3, 0, 0, 1, 2, 3, 0, 0, 0, 3]);
    // 13C (2 bonds), C (triple), N (triple), C, NH, CH3 | NH4+ | carbene CH2 | CH3, alias
    expect(hCounts(oddities)).toEqual([2, 0, 0, 2, 1, 3, 4, 2, 3, 0]);
    expect(hCounts(benzene)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(hCounts(aromaticToluene)).toEqual([0, 1, 1, 1, 1, 1, 3]);
  });
});

describe('atom displays', () => {
  it('hides skeletal carbons and places H away from bonds', () => {
    const scene = ketToScene(ethanol);
    const d = atomDisplays(scene, buildAdjacency(scene));
    expect(d.map((x) => x.shown)).toEqual([false, false, true]);
    expect(d[2]).toMatchObject({ hCount: 1, hSide: 'right' });
  });

  it('writes H2O / H3O+ with H first and NH4+ with H last', () => {
    const scene = ketToScene(acidBase);
    const d = atomDisplays(scene, buildAdjacency(scene));
    expect(d[4]).toMatchObject({ symbol: 'O', hCount: 2, hSide: 'left' });
    expect(d[9]).toMatchObject({ symbol: 'O', hCount: 3, hSide: 'left', charge: 1 });
    const odd = ketToScene(oddities);
    const od = atomDisplays(odd, buildAdjacency(odd));
    expect(od[6]).toMatchObject({ symbol: 'N', hCount: 4, hSide: 'right' });
    // Secondary amine with both bonds pointing up: H below.
    expect(od[4]).toMatchObject({ symbol: 'N', hCount: 1, hSide: 'below' });
  });
});

describe('rings and double bonds', () => {
  it('puts ring double bonds toward the ring centre and C=O centred', () => {
    const scene = ketToScene(benzene);
    const adj = buildAdjacency(scene);
    const d = atomDisplays(scene, adj);
    scene.bonds.forEach((b, i) => {
      const c = ringCenter(scene, adj, i)!;
      expect(Math.hypot(c.x, c.y)).toBeLessThan(1e-9);
      const p = scene.atoms[b.begin];
      const q = scene.atoms[b.end];
      const cross = (q.x - p.x) * (c.y - p.y) - (q.y - p.y) * (c.x - p.x);
      expect(doubleBondSide(scene, adj, d, i)).toBe(cross > 0 ? 'left' : 'right');
    });
    const ketone = ketToScene(cyclohexanone);
    const kadj = buildAdjacency(ketone);
    expect(ringCenter(ketone, kadj, 6)).toBeNull();
    expect(doubleBondSide(ketone, kadj, atomDisplays(ketone, kadj), 6)).toBe('center');
  });
});

describe('kekulize', () => {
  const doublesPerAtom = (doc: object) => {
    const scene = ketToScene(doc);
    const kek = kekulize(scene, buildAdjacency(scene))!;
    expect(kek).not.toBeNull();
    const count = scene.atoms.map(() => 0);
    for (const [bi, order] of kek) {
      if (order === 2) {
        count[scene.bonds[bi].begin]++;
        count[scene.bonds[bi].end]++;
      }
    }
    return count;
  };

  it('gives every aromatic carbon exactly one double bond', () => {
    expect(doublesPerAtom(aromaticToluene)).toEqual([1, 1, 1, 1, 1, 1, 0]);
  });

  it('leaves the pyrrole N (implicit NH) out', () => {
    expect(doublesPerAtom(aromaticPyrrole)).toEqual([0, 1, 1, 1, 1]);
  });

  it('returns an empty map without aromatic bonds', () => {
    const scene = ketToScene(benzene);
    expect(kekulize(scene, buildAdjacency(scene))!.size).toBe(0);
  });
});

describe('curved arrow geometry', () => {
  const bezierAt = (p0: { x: number; y: number }, p1: typeof p0, p2: typeof p0, p3: typeof p0, t: number) => {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  };

  it('puts the apex `height` away from the chord, on the left for positive height', () => {
    const s = { x: 1, y: 1 };
    const e = { x: 3, y: 1 };
    const [c1, c2] = arcBezier(s, e, 0.6);
    expect(c1).toEqual({ x: 1, y: 1 + 0.8 });
    expect(c2).toEqual({ x: 3, y: 1 + 0.8 });
    const apex = bezierAt(s, c1, c2, e, 0.5);
    expect(apex.x).toBeCloseTo(2);
    expect(apex.y).toBeCloseTo(1.6);
    const [d1] = arcBezier(s, e, -0.6);
    expect(d1.y).toBeCloseTo(1 - 0.8);
  });

  it('keeps the fishhook barb on the outer side', () => {
    const s = { x: 0, y: 0 };
    const e = { x: 1, y: 0 };
    expect(fishhookKeys(s, e, { x: 0, y: 1 })).toBe('harpoon');
    expect(fishhookKeys(s, e, { x: 0, y: -1 })).toBe('harpoon,swap');
  });
});
