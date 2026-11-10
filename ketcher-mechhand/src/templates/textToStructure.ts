/**
 * A structure from text typed in the library search box:
 *
 *   - SMILES and InChI are read offline by Ketcher's chemistry engine (Indigo, in the browser);
 *   - CAS numbers and names of the library's structures are found offline by the library search
 *     (CAS numbers from PubChem, src/templates/library-cas.json);
 *   - any other name or CAS number can be looked up online, but only when the user asks for it:
 *     PubChem (names, synonyms, CAS numbers) and then OPSIN (systematic IUPAC names). The typed text
 *     is then sent to those services; nothing else is.
 */

import type { InsertMode, LibraryEntry } from './library';

export type QueryKind = 'cas' | 'inchi' | 'smiles' | 'text';

const CAS_RE = /^(\d{2,7})-(\d{2})-(\d)$/;

/** A CAS Registry Number with a correct check digit. */
export function isValidCas(s: string): boolean {
  const m = CAS_RE.exec(s.trim());
  if (!m) return false;
  const digits = (m[1] + m[2]).split('').reverse();
  return digits.reduce((sum, d, i) => sum + (i + 1) * Number(d), 0) % 10 === Number(m[3]);
}

const SMILES_CHARS = /^[A-Za-z0-9@+\-[\]()\\/=#$%.:~*]+$/;

export function queryKind(query: string): QueryKind {
  const q = query.trim();
  if (/^InChI=1S?\//.test(q)) return 'inchi';
  if (isValidCas(q)) return 'cas';
  if (q && SMILES_CHARS.test(q)) return 'smiles';
  return 'text';
}

/** Something that might be a name worth looking up (letters, at least three characters). */
export const lookupWorthy = (query: string): boolean => {
  const q = query.trim();
  return q.length >= 3 && (/\p{L}{2}/u.test(q) || isValidCas(q)) && !/^InChI=/.test(q);
};

const ELEMENTS = new Set((
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo ' +
  'Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb ' +
  'Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og D T'
).split(' '));

type Json = Record<string, unknown>;

/**
 * A KET document that is an ordinary structure: at least one atom, and every atom a real element
 * (Ketcher also accepts query atoms such as "A" or "*", which is how a name like "aspirin" would
 * otherwise be read as SMARTS). `allowStar` keeps "*" attachment points the user typed.
 */
export function isPlainStructure(ket: string, allowStar = false): boolean {
  let doc: Json;
  try {
    doc = JSON.parse(ket) as Json;
  } catch {
    return false;
  }
  let atoms = 0;
  for (const node of ((doc.root as Json | undefined)?.nodes as Json[] | undefined) ?? []) {
    const mol = typeof node.$ref === 'string' ? (doc[node.$ref] as Json | undefined) : undefined;
    if (!mol || mol.type !== 'molecule') continue;
    for (const a of (mol.atoms as Json[] | undefined) ?? []) {
      atoms++;
      const type = (a.type as string | undefined) ?? 'atom';
      const label = a.label as string | undefined;
      if (type !== 'atom' || !label) return false;
      if (!ELEMENTS.has(label) && !(allowStar && label === '*')) return false;
      if (a.queryProperties) return false;
    }
  }
  return atoms > 0;
}

/** Converts SMILES/InChI to KET with 2D coordinates (Ketcher's `indigo.convert`). */
export type Converter = (notation: string) => Promise<string>;

export interface TextStructure {
  entry: LibraryEntry;
  /** What the text was read as. */
  kind: 'smiles' | 'inchi' | 'pubchem' | 'opsin';
}

function textEntry(id: string, name: string, group: string, ket: string, smiles: string, keywords: string[] = [], cas?: string[]): LibraryEntry {
  return {
    id, name, group, ket, smiles, keywords, cas,
    category: 'reagent',
    defaultMode: 'add' as InsertMode,
  };
}

/** SMILES or InChI read offline; null if the text is not a valid structure notation. */
export async function structureFromNotation(convert: Converter, query: string): Promise<TextStructure | null> {
  const q = query.trim();
  const kind = queryKind(q);
  if (kind !== 'smiles' && kind !== 'inchi') return null;
  let ket: string;
  try {
    ket = await convert(q);
  } catch {
    return null;
  }
  if (!isPlainStructure(ket, q.includes('*'))) return null;
  const group = kind === 'inchi' ? 'InChI' : 'SMILES';
  return { kind, entry: textEntry(`${kind}:${q}`, q, group, ket, kind === 'smiles' ? q : '') };
}

export interface OnlineHit {
  name: string;
  smiles: string;
  source: 'PubChem' | 'OPSIN';
  /** PubChem compound id. */
  cid?: number;
}

/**
 * Looks a name or CAS number up online: PubChem first, then OPSIN for systematic names. Only call
 * this when the user has asked for it (it sends the text to those services).
 */
export async function lookupOnline(query: string, fetchFn: typeof fetch = fetch): Promise<OnlineHit | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/property/SMILES,Title/JSON`;
    const r = await fetchFn(url);
    if (r.ok) {
      const p = ((await r.json()) as { PropertyTable?: { Properties?: { CID: number; SMILES?: string; Title?: string }[] } })
        .PropertyTable?.Properties?.[0];
      if (p?.SMILES) return { name: p.Title || q, smiles: p.SMILES, source: 'PubChem', cid: p.CID };
    }
  } catch {
    /* offline or blocked: try OPSIN */
  }
  if (isValidCas(q)) return null;
  try {
    const r = await fetchFn(`https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(q)}.json`);
    if (r.ok) {
      const j = (await r.json()) as { status?: string; smiles?: string };
      if (j.status === 'SUCCESS' && j.smiles) return { name: q, smiles: j.smiles, source: 'OPSIN' };
    }
  } catch {
    /* nothing found */
  }
  return null;
}

/** The library entry for an online hit (converted offline to a drawable structure). */
export async function entryFromHit(convert: Converter, hit: OnlineHit, query: string): Promise<TextStructure | null> {
  let ket: string;
  try {
    ket = await convert(hit.smiles);
  } catch {
    return null;
  }
  if (!isPlainStructure(ket)) return null;
  const q = query.trim();
  const keywords = q.toLowerCase() === hit.name.toLowerCase() ? [] : [q];
  return {
    kind: hit.source === 'PubChem' ? 'pubchem' : 'opsin',
    entry: textEntry(`${hit.source.toLowerCase()}:${hit.cid ?? hit.smiles}`, hit.name, hit.source, ket, hit.smiles, keywords,
      isValidCas(q) ? [q] : undefined),
  };
}
