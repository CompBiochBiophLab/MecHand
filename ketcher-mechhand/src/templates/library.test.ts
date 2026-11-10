import { afterEach, describe, expect, it, vi } from 'vitest';
import { ketToScene } from '../scene/ketToScene';
import { implicitHydrogens, thumbData } from '../ui/MoleculeThumb';
import { TEMPLATES } from './catalog';
import {
  ADD_GAP, FAVOURITES_KEY, LIBRARY, LIBRARY_CATEGORIES, RECENT_KEY, RECENT_MAX, editDistance, entryBounds, entryKet,
  insertTemplate, libraryEntry, loadIds, normalizeText, placementOffset, saveIds, searchLibrary, toggledFavourite, withRecent,
} from './library';

const structures = LIBRARY.filter((e) => e.mol);
const top = (q: string) => searchLibrary(q)[0]?.id;

describe('library data', () => {
  it('has 120-200 structures plus every mechanism template', () => {
    expect(structures.length).toBeGreaterThanOrEqual(120);
    expect(structures.length).toBeLessThanOrEqual(200);
    expect(LIBRARY.filter((e) => e.category === 'mechanism').map((e) => e.id))
      .toEqual(TEMPLATES.map((t) => `mech-${t.id}`));
  });

  it('has unique, well-formed ids', () => {
    const ids = LIBRARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_-]+$/);
  });

  it('has no empty category', () => {
    for (const c of LIBRARY_CATEGORIES) expect(LIBRARY.filter((e) => e.category === c.id).length, c.id).toBeGreaterThan(0);
  });

  it('turns every entry into KET that parses back to the same structure', () => {
    for (const e of LIBRARY) {
      const ket = entryKet(e);
      const doc = JSON.parse(ket);
      expect(Array.isArray(doc.root.nodes), e.id).toBe(true);
      const scene = ketToScene(ket);
      if (e.mol) {
        expect(scene.atoms.length, e.id).toBe(e.mol.atoms.length);
        expect(scene.bonds.length, e.id).toBe(e.mol.bonds.length);
        expect(scene.arrows.length, e.id).toBe(0);
        // Labels and charges survive (atoms are regrouped per connected component).
        const sig = (xs: string[]) => [...xs].sort().join(',');
        expect(sig(scene.atoms.map((a) => `${a.symbol}${a.charge}`)), e.id).toBe(sig(e.mol.atoms.map(([l, , , , c]) => `${l}${c ?? 0}`)));
      } else {
        expect(scene.atoms.length, e.id).toBeGreaterThan(0);
        expect(scene.arrows.length, e.id).toBeGreaterThan(0);
      }
    }
  });

  it('stores structures with bond length 1.0, centred, with valid bonds', () => {
    for (const e of structures) {
      const { atoms, bonds } = e.mol!;
      for (const [a, b, order, stereo] of bonds) {
        expect(a, e.id).toBeLessThan(atoms.length);
        expect(b, e.id).toBeLessThan(atoms.length);
        expect([1, 2, 3], e.id).toContain(order);
        if (stereo !== undefined) expect([1, 6], e.id).toContain(stereo);
        const len = Math.hypot(atoms[a][1] - atoms[b][1], atoms[a][2] - atoms[b][2]);
        expect(len, `${e.id} ${a}-${b}`).toBeGreaterThan(e.id === 'cyclohexane-chair' ? 0.7 : 0.9);
        expect(len, `${e.id} ${a}-${b}`).toBeLessThan(e.id === 'cyclohexane-chair' ? 1.3 : 1.1);
      }
      const b = entryBounds(e)!;
      expect(Math.abs(b.minX + b.maxX), e.id).toBeLessThan(0.02);
      expect(Math.abs(b.minY + b.maxY), e.id).toBeLessThan(0.02);
    }
  });

  it('has SMILES for structures, formulas for complete molecules and R groups as pseudo-atoms', () => {
    for (const e of structures) {
      expect(e.smiles, e.id).toBeTruthy();
      const hasR = e.mol!.atoms.some(([l]) => l.startsWith('R'));
      expect(hasR, e.id).toBe(e.smiles!.includes('*'));
      if (!hasR) expect(e.formula, e.id).toMatch(/^[A-Z][A-Za-z0-9]*([+-]\d*)?$/);
    }
    // One R group: a pseudo-atom "R". Several: Ketcher R-group labels R1, R2...
    expect(JSON.parse(entryKet(libraryEntry('carboxylic-acid')!)).mol0.atoms[0]).toMatchObject({ label: 'R' });
    expect(libraryEntry('ester')!.mol!.atoms.map(([l]) => l).filter((l) => l.startsWith('R')).sort()).toEqual(['R1', 'R2']);
    const esterKet = JSON.parse(entryKet(libraryEntry('ester')!));
    const rgs = esterKet.mol0.atoms.filter((a: { type?: string }) => a.type === 'rg-label');
    expect(rgs.map((a: { $refs: string[] }) => a.$refs[0]).sort()).toEqual(['rg-1', 'rg-2']);
    expect(ketToScene(entryKet(libraryEntry('ester')!)).atoms.map((a) => a.symbol).filter((x) => x.startsWith('R')).sort()).toEqual(['R1', 'R2']);
  });

  it('draws the L-amino acids with wedges at their stereocentres', () => {
    const aa = structures.filter((e) => e.group === 'Amino acids');
    expect(aa).toHaveLength(20);
    for (const e of aa) {
      const wedges = e.mol!.bonds.filter((b) => b[3]).length;
      const expected = e.id === 'glycine' ? 0 : e.id === 'threonine' || e.id === 'isoleucine' ? 2 : 1;
      expect(wedges, e.id).toBe(expected);
    }
  });

  it('keeps hydrogen counts consistent with Ketcher valence rules for labelled atoms', () => {
    for (const e of structures) {
      const { atoms, bonds } = e.mol!;
      const conn = atoms.map(() => 0);
      for (const [a, b, o] of bonds) {
        conn[a] += o;
        conn[b] += o;
      }
      atoms.forEach(([label, , , h, charge, radical], i) => {
        if (!['O', 'N', 'S', 'F', 'Cl', 'Br', 'B'].includes(label)) return;
        expect(h ?? 0, `${e.id} atom ${i} ${label}`).toBe(implicitHydrogens(label, charge ?? 0, radical ?? 0, conn[i]));
      });
    }
  });

  it('has drawable thumbnails for every entry', () => {
    for (const e of LIBRARY) {
      const d = thumbData(e);
      expect(d.atoms.length, e.id).toBeGreaterThan(0);
      for (const a of d.atoms) expect(Number.isFinite(a.x) && Number.isFinite(a.y), e.id).toBe(true);
    }
    // Mechanisms: hydrogens are worked out from the valence rules.
    const water = thumbData(libraryEntry('mech-sicl4_hydrolysis')!).atoms.find((a) => a.symbol === 'O' && a.charge === 0);
    expect(water?.h).toBe(2);
  });
});

describe('search', () => {
  it('normalizes accents, case, Greek letters and punctuation', () => {
    expect(normalizeText('Àcid  Carboxílic')).toBe('acid carboxilic');
    expect(normalizeText('β-Lactam')).toBe('beta lactam');
    expect(normalizeText('al·lil')).toBe('allil');
    expect(normalizeText('NAD⁺')).toBe('nad+');
  });

  it('finds structures by English and Catalan names, abbreviations and formulas', () => {
    expect(top('benzè')).toBe('benzene');
    expect(top('benzene')).toBe('benzene');
    expect(top('Benzè')).toBe('benzene');
    expect(top('acid carboxílic')).toBe('carboxylic-acid');
    expect(top('àcid carboxílic')).toBe('carboxylic-acid');
    expect(top('carboxylic acid')).toBe('carboxylic-acid');
    expect(top('Trp')).toBe('tryptophan');
    expect(top('tryptophan')).toBe('tryptophan');
    expect(top('triptòfan')).toBe('tryptophan');
    expect(top('THF')).toBe('tetrahydrofuran');
    expect(top('NaBH4')).toBe('nabh4');
    expect(top('H2O')).toBe('water');
    expect(top('aigua')).toBe('water');
    expect(top('àcid acètic')).toBe('acetic-acid');
    expect(top('beta lactam')).toBe('beta-lactam');
    expect(top('β-lactama')).toBe('beta-lactam');
    expect(top('LiAlH4')).toBe('lialh4');
    expect(top('mcpba')).toBe('mcpba');
    expect(top('Grignard')).toBe('mgbr-methyl');
    expect(top('SN2')).toBe('mech-sn2');
    expect(top('Diels')).toBe('mech-diels_alder');
    expect(top('glucosa')).toMatch(/glucose/);
  });

  it('tolerates typos and partial words', () => {
    expect(top('tryptofan')).toBe('tryptophan');
    expect(top('piridin')).toBe('pyridine');
    expect(top('morfolin')).toBe('morpholine');
    expect(top('carboxilic acid')).toBe('carboxylic-acid');
    expect(top('morph')).toBe('morpholine');
  });

  it('searches the sub-categories too', () => {
    const aa = searchLibrary('acid amino').slice(0, 20);
    expect(aa.every((e) => e.group === 'Amino acids')).toBe(true);
    expect(searchLibrary('anells').length).toBe(LIBRARY.filter((e) => e.category === 'ring').length);
  });

  it('requires every word to match and ranks exact names first', () => {
    expect(searchLibrary('xyzzy')).toEqual([]);
    expect(searchLibrary('amine').slice(0, 3).map((e) => e.id).sort()).toEqual(['amine-primary', 'amine-secondary', 'amine-tertiary']);
    expect(searchLibrary('')).toBe(LIBRARY);
    const rings = LIBRARY.filter((e) => e.category === 'ring');
    expect(searchLibrary('pyr', rings).every((e) => e.category === 'ring')).toBe(true);
  });

  it('computes edit distances with a cut-off', () => {
    expect(editDistance('tryptofan', 'tryptophan', 2)).toBe(2);
    expect(editDistance('abcd', 'abdc', 1)).toBe(1);
    expect(editDistance('abc', 'xyzxyz', 1)).toBe(2);
  });
});

describe('favourites and recent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores ids only and ignores unknown or malformed data', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    saveIds(FAVOURITES_KEY, ['benzene', 'water']);
    expect(store.get('mechand.library.favourites')).toBe('["benzene","water"]');
    expect(loadIds(FAVOURITES_KEY)).toEqual(['benzene', 'water']);
    store.set(RECENT_KEY, '["nope", 3, "ester", "ester"]');
    expect(loadIds(RECENT_KEY)).toEqual(['ester']);
    store.set(RECENT_KEY, '{not json');
    expect(loadIds(RECENT_KEY)).toEqual([]);
  });

  it('survives a storage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
    });
    expect(loadIds(FAVOURITES_KEY)).toEqual([]);
    expect(() => saveIds(FAVOURITES_KEY, ['benzene'])).not.toThrow();
  });

  it('keeps recent ids most-recent-first, unique and bounded', () => {
    let r: string[] = [];
    for (let i = 0; i < 30; i++) r = withRecent(r, `id${i % 20}`);
    expect(r).toHaveLength(RECENT_MAX);
    expect(r[0]).toBe('id9');
    expect(withRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(toggledFavourite(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggledFavourite(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('insertTemplate', () => {
  const fakeKetcher = (canvasKet: string) => {
    const calls: { fn: string; arg: string }[] = [];
    return {
      calls,
      getKet: async () => canvasKet,
      setMolecule: async (s: string) => void calls.push({ fn: 'setMolecule', arg: s }),
      addFragment: async (s: string) => void calls.push({ fn: 'addFragment', arg: s }),
    };
  };

  it('replaces the canvas with setMolecule', async () => {
    const k = fakeKetcher('');
    const sn2 = libraryEntry('mech-sn2')!;
    await insertTemplate(k, sn2);
    expect(k.calls).toEqual([{ fn: 'setMolecule', arg: sn2.ket }]);
    await insertTemplate(k, libraryEntry('benzene')!, 'replace');
    expect(k.calls[1].fn).toBe('setMolecule');
  });

  it('adds structures to the right of the drawing', async () => {
    const existing = entryKet(libraryEntry('benzene')!);
    const k = fakeKetcher(existing);
    await insertTemplate(k, libraryEntry('water')!);
    expect(k.calls).toHaveLength(1);
    expect(k.calls[0].fn).toBe('addFragment');
    const doc = JSON.parse(k.calls[0].arg);
    const o = doc.mol0.atoms[0];
    expect(o.label).toBe('O');
    const benzeneRight = Math.max(...ketToScene(existing).atoms.map((a) => a.x));
    expect(o.location[0]).toBeCloseTo(benzeneRight + ADD_GAP, 3);
    expect(o.location[1]).toBeCloseTo(0, 3);
  });

  it('adds at the origin on an empty canvas and splits salts into one molecule per ion', async () => {
    const k = fakeKetcher(JSON.stringify({ root: { nodes: [] } }));
    await insertTemplate(k, libraryEntry('nabh4')!, 'add');
    const doc = JSON.parse(k.calls[0].arg);
    expect(doc.root.nodes).toHaveLength(2);
    expect([doc.mol0.atoms[0].label, doc.mol1.atoms[0].label].sort()).toEqual(['B', 'Na']);
  });

  it('can add a mechanism instead of replacing, moving arrows and pluses too', async () => {
    const k = fakeKetcher(entryKet(libraryEntry('benzene')!));
    const e2 = libraryEntry('mech-e2')!;
    await insertTemplate(k, e2, 'add');
    const moved = ketToScene(k.calls[0].arg);
    const orig = ketToScene(e2.ket!);
    const dx = moved.atoms[0].x - orig.atoms[0].x;
    expect(dx).toBeGreaterThan(0);
    expect(moved.arrows[0].start.x - orig.arrows[0].start.x).toBeCloseTo(dx, 3);
    expect(moved.pluses[0].x - orig.pluses[0].x).toBeCloseTo(dx, 3);
    expect(moved.arrows.map((a) => a.height)).toEqual(orig.arrows.map((a) => a.height));
  });

  it('still inserts when the canvas cannot be read', async () => {
    const k = { ...fakeKetcher(''), getKet: async () => { throw new Error('busy'); } };
    await insertTemplate(k, libraryEntry('ammonia')!);
    expect(k.calls[0].fn).toBe('addFragment');
    expect(placementOffset(null, entryBounds(libraryEntry('ammonia')!))).toEqual({ dx: 0, dy: 0 });
  });
});
