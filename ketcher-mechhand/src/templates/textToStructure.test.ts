import { describe, expect, it, vi } from 'vitest';
import { searchLibrary } from './library';
import { isPlainStructure, isValidCas, lookupOnline, lookupWorthy, queryKind, structureFromNotation } from './textToStructure';

const ket = (labels: string[], extra: Record<string, unknown> = {}) => JSON.stringify({
  root: { nodes: [{ $ref: 'mol0' }] },
  mol0: { type: 'molecule', atoms: labels.map((label, i) => ({ label, location: [i, 0, 0], ...extra })), bonds: [] },
});

describe('structure from text', () => {
  it('validates CAS numbers by their check digit', () => {
    expect(isValidCas('64-17-5')).toBe(true); // ethanol
    expect(isValidCas('7732-18-5')).toBe(true); // water
    expect(isValidCas('64-17-6')).toBe(false);
    expect(isValidCas('6417-5')).toBe(false);
  });

  it('tells notations, CAS numbers and names apart', () => {
    expect(queryKind('CCO')).toBe('smiles');
    expect(queryKind('c1ccccc1C(=O)[O-]')).toBe('smiles');
    expect(queryKind('InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3')).toBe('inchi');
    expect(queryKind('64-17-5')).toBe('cas');
    expect(queryKind('acetic acid')).toBe('text');
    expect(lookupWorthy('aspirin')).toBe(true);
    expect(lookupWorthy('64-17-5')).toBe(true);
    expect(lookupWorthy('C')).toBe(false);
  });

  it('accepts only ordinary structures (no query atoms from names read as SMARTS)', () => {
    expect(isPlainStructure(ket(['C', 'C', 'O']))).toBe(true);
    expect(isPlainStructure(ket(['*', 'S', 'P']))).toBe(false);
    expect(isPlainStructure(ket(['A']))).toBe(false);
    expect(isPlainStructure(ket([]))).toBe(false);
    expect(isPlainStructure(ket(['*', 'C']), true)).toBe(true);
    expect(isPlainStructure('not json')).toBe(false);
  });

  it('reads SMILES with the converter and rejects garbage', async () => {
    const convert = vi.fn(async (s: string) => (s === 'CCO' ? ket(['C', 'C', 'O']) : ket(['*', 'S'])));
    expect((await structureFromNotation(convert, 'CCO'))?.entry.group).toBe('SMILES');
    expect(await structureFromNotation(convert, 'aspirin')).toBeNull();
    expect(await structureFromNotation(convert, 'acetic acid')).toBeNull(); // not even tried
    expect(convert).toHaveBeenCalledTimes(2);
  });

  it('looks names up on PubChem, then OPSIN; CAS numbers only on PubChem', async () => {
    const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
    const pubchem = vi.fn(async (url: string) => (url.includes('pubchem')
      ? json({ PropertyTable: { Properties: [{ CID: 2244, SMILES: 'CC(=O)OC1=CC=CC=C1C(=O)O', Title: 'Aspirin' }] } })
      : json({}, false)));
    expect(await lookupOnline('aspirin', pubchem as unknown as typeof fetch)).toMatchObject({ name: 'Aspirin', source: 'PubChem', cid: 2244 });
    const opsin = vi.fn(async (url: string) => (url.includes('opsin') ? json({ status: 'SUCCESS', smiles: 'CC(C)(C)O' }) : json({}, false)));
    expect(await lookupOnline('2-methylpropan-2-ol', opsin as unknown as typeof fetch)).toMatchObject({ source: 'OPSIN', smiles: 'CC(C)(C)O' });
    const none = vi.fn(async () => json({}, false));
    expect(await lookupOnline('50-00-0', none as unknown as typeof fetch)).toBeNull();
    expect(none).toHaveBeenCalledTimes(1); // no OPSIN for a CAS number
  });

  it('finds library structures by CAS number offline', () => {
    expect(searchLibrary('64-17-5')[0]?.id).toBe('ethanol');
    expect(searchLibrary('71-43-2')[0]?.id).toBe('benzene');
  });
});
