import { describe, expect, it } from 'vitest';
import { arrow, benzene, ethanol, ket, molecule, plus, sn2 } from './__fixtures__/ketFixtures';
import { arrowKindForMode, ketToScene } from './ketToScene';

describe('ketToScene', () => {
  it('reads atoms, bonds and coordinates as-is (y up)', () => {
    const scene = ketToScene(ethanol);
    expect(scene.atoms.map((a) => a.symbol)).toEqual(['C', 'C', 'O']);
    expect(scene.atoms[1].x).toBeCloseTo(Math.sqrt(3) / 2);
    expect(scene.atoms[1].y).toBeCloseTo(0.5);
    expect(scene.atoms.every((a) => a.charge === 0 && a.molecule === 0)).toBe(true);
    expect(scene.bonds).toEqual([
      { begin: 0, end: 1, order: 1 },
      { begin: 1, end: 2, order: 1 },
    ]);
    expect(scene.arrows).toEqual([]);
    expect(scene.pluses).toEqual([]);
  });

  it('accepts a JSON string and an object alike', () => {
    expect(ketToScene(JSON.stringify(benzene))).toEqual(ketToScene(benzene));
  });

  it('keeps bond orders and stereo (1 = wedge, 6 = hash, narrow end at atoms[0])', () => {
    expect(ketToScene(benzene).bonds.map((b) => b.order)).toEqual([2, 1, 2, 1, 2, 1]);
    const scene = ketToScene(sn2);
    const stereo = scene.bonds.filter((b) => b.stereo);
    expect(stereo.map((b) => b.stereo)).toEqual(['up', 'down']);
    for (const b of stereo) expect(scene.atoms[b.begin].symbol).toBe('C');
  });

  it('numbers connected components across the whole scene', () => {
    const scene = ketToScene(sn2);
    expect(scene.atoms.map((a) => a.molecule)).toEqual([0, 1, 1, 1, 1, 1, 2, 2, 3]);
    expect(scene.atoms[0]).toMatchObject({ symbol: 'O', charge: -1 });
    expect(scene.atoms[8]).toMatchObject({ symbol: 'Br', charge: -1 });
  });

  it('splits one KET molecule holding several fragments into components', () => {
    const doc = ket([
      molecule(
        [
          { label: 'Na', x: 0, y: 0, charge: 1 },
          { label: 'C', x: 2, y: 0 },
          { label: 'O', x: 3, y: 0, charge: -1 },
        ],
        [[1, 2, 1]],
      ),
    ]);
    expect(ketToScene(doc).atoms.map((a) => a.molecule)).toEqual([0, 1, 1]);
  });

  it('reads pluses and arrows; curved arrows keep their height', () => {
    const scene = ketToScene(sn2);
    expect(scene.pluses).toEqual([
      { x: 1.25, y: 0 },
      { x: 10.2, y: 0 },
    ]);
    expect(scene.arrows).toHaveLength(2);
    expect(scene.arrows[0]).toEqual({
      kind: 'electron-pair',
      mode: 'elliptical-arc-arrow-filled-bow',
      start: { x: 0.25, y: 0.25 },
      end: { x: 2.85, y: 0.15 },
      height: 0.8,
    });
    expect(scene.arrows[1]).toMatchObject({ kind: 'reaction', mode: 'open-angle' });
    expect(scene.arrows[1].height).toBeUndefined();
  });

  it('maps every Ketcher arrow mode to a kind', () => {
    const table: Record<string, string> = {
      'open-angle': 'reaction',
      'filled-triangle': 'reaction',
      'filled-bow': 'reaction',
      'dashed-open-angle': 'reaction',
      failed: 'reaction',
      retrosynthetic: 'reaction',
      'both-ends-filled-triangle': 'reaction',
      'equilibrium-filled-triangle': 'equilibrium',
      'equilibrium-filled-half-bow': 'equilibrium',
      'equilibrium-open-angle': 'equilibrium',
      'unbalanced-equilibrium-filled-half-bow': 'equilibrium',
      'unbalanced-equilibrium-open-half-angle': 'equilibrium',
      'unbalanced-equilibrium-large-filled-half-bow': 'equilibrium',
      'unbalanced-equilibrium-filled-half-triangle': 'equilibrium',
      'elliptical-arc-arrow-filled-bow': 'electron-pair',
      'elliptical-arc-arrow-filled-triangle': 'electron-pair',
      'elliptical-arc-arrow-open-angle': 'electron-pair',
      'elliptical-arc-arrow-open-half-angle': 'single-electron',
      'something-new': 'other',
    };
    for (const [mode, kind] of Object.entries(table)) expect(arrowKindForMode(mode)).toBe(kind);
  });

  it('defaults a missing curved-arrow height to 0', () => {
    const scene = ketToScene(ket([], [arrow('elliptical-arc-arrow-open-angle', 0, 0, 1, 0)]));
    expect(scene.arrows[0].height).toBe(0);
  });

  it('reads charge, radical, isotope, alias and R-group labels', () => {
    const doc = {
      root: { nodes: [{ $ref: 'mol0' }] },
      mol0: {
        type: 'molecule',
        atoms: [
          { label: 'C', location: [0, 0, 0], charge: 1, radical: 2, isotope: 13 },
          { label: 'C', location: [1, 0, 0], alias: 'OMe' },
          { type: 'rg-label', location: [2, 0, 0], $refs: ['rg-1'] },
          { type: 'atom-list', location: [3, 0, 0], elements: ['N', 'O'] },
        ],
        bonds: [],
      },
    };
    const atoms = ketToScene(doc).atoms;
    expect(atoms[0]).toMatchObject({ symbol: 'C', charge: 1, radical: 2, isotope: 13 });
    expect(atoms[1].symbol).toBe('OMe');
    expect(atoms[2].symbol).toBe('R1');
    expect(atoms[3].symbol).toBe('[N,O]');
  });

  it('is robust to missing fields, dangling refs and foreign nodes', () => {
    const doc = {
      root: {
        nodes: [
          { $ref: 'mol0' },
          { $ref: 'missing' },
          { $ref: 'mol0' }, // duplicated reference: read once
          { type: 'text', data: { content: '{}', position: { x: 0, y: 0 } } },
          { type: 'image', center: { x: 0, y: 0 } },
          { type: 'multi-tail-arrow', data: {} },
          { type: 'arrow', data: { mode: 'open-angle' } }, // no positions
          { type: 'plus' }, // no location
          null,
          42,
        ],
      },
      mol0: {
        type: 'molecule',
        atoms: [{ label: 'C', location: [0, 0, 0] }, { label: 'N', location: [1, 0] }, {}],
        bonds: [
          { type: 2, atoms: [0, 1] },
          { type: 9, atoms: [1, 2] }, // coordination bond -> single
          { type: 1, atoms: [0, 7] }, // out of range
          { type: 1, atoms: [0, 0] }, // self loop
          { type: 1 }, // no atoms
        ],
      },
    };
    const scene = ketToScene(doc);
    expect(scene.atoms).toHaveLength(3);
    expect(scene.atoms[2]).toMatchObject({ symbol: 'C', x: 0, y: 0, charge: 0 });
    expect(scene.atoms[2].radical).toBeUndefined();
    expect(scene.bonds).toEqual([
      { begin: 0, end: 1, order: 2 },
      { begin: 1, end: 2, order: 1 },
    ]);
    expect(scene.arrows).toEqual([]);
    expect(scene.pluses).toEqual([]);
  });

  it('returns an empty scene for an empty canvas', () => {
    const empty = { atoms: [], bonds: [], arrows: [], pluses: [] };
    expect(ketToScene('')).toEqual(empty);
    expect(ketToScene({})).toEqual(empty);
    expect(ketToScene({ root: { nodes: [] } })).toEqual(empty);
    expect(ketToScene(ket([], [plus(0, 0)])).pluses).toHaveLength(1);
  });

  it('throws a clear error on a string that is not JSON', () => {
    expect(() => ketToScene('{not json')).toThrow(/not valid KET JSON/);
  });
});
