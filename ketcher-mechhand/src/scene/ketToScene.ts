/**
 * ketToScene: Ketcher's native KET JSON (ketcher.getKet()) -> MecHand Scene.
 *
 * KET layout (only what we read):
 *   { "root": { "nodes": [ {"$ref": "mol0"}, {"type": "plus", "location": [x, y, z]},
 *                          {"type": "arrow", "data": {"mode", "pos": [{x,y,z}, {x,y,z}], "height"}} ] },
 *     "mol0": { "type": "molecule", "atoms": [...], "bonds": [...] } }
 *
 * Coordinates are copied as-is: KET and Scene both use Ketcher units with y up.
 * Everything else (texts, images, multi-tail arrows, monomers, unknown keys) is
 * ignored. Malformed pieces are skipped rather than reported, so that a partly
 * broken canvas still exports what can be exported; only a string that is not
 * JSON at all throws.
 */

import { emptyScene } from './types';
import type { ArrowKind, Point, Scene, SceneArrow, SceneAtom, SceneBond } from './types';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Straight one-way arrows (RxnArrowMode in ketcher-core). */
const REACTION_MODES = new Set([
  'open-angle',
  'filled-triangle',
  'filled-bow',
  'dashed-open-angle',
  'failed',
  'retrosynthetic',
  'both-ends-filled-triangle',
]);

/** Maps a KET arrow mode to the Scene arrow kind. */
export function arrowKindForMode(mode: string): ArrowKind {
  if (mode === 'elliptical-arc-arrow-open-half-angle') return 'single-electron';
  if (mode.startsWith('elliptical-arc-arrow-')) return 'electron-pair';
  if (mode.startsWith('equilibrium-') || mode.startsWith('unbalanced-equilibrium-')) return 'equilibrium';
  if (REACTION_MODES.has(mode)) return 'reaction';
  return 'other';
}

function parsePoint(v: unknown): Point | null {
  if (isObj(v)) {
    if (typeof v.x !== 'number' || typeof v.y !== 'number') return null;
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
    return { x: v.x, y: v.y };
  }
  if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number') {
    if (!Number.isFinite(v[0]) || !Number.isFinite(v[1])) return null;
    return { x: v[0], y: v[1] };
  }
  return null;
}

/** Display symbol of a KET atom: alias (what Ketcher shows) > label > generic labels. */
function atomSymbol(a: Json): string {
  if (typeof a.alias === 'string' && a.alias.trim() !== '') return a.alias.trim();
  if (a.type === 'rg-label') {
    const refs = Array.isArray(a.$refs) ? a.$refs : [];
    const nums = refs
      .map((r) => (typeof r === 'string' ? r.replace(/^rg-?/, '') : ''))
      .filter((s) => s !== '');
    return nums.length ? `R${nums.join(',')}` : 'R';
  }
  if (a.type === 'atom-list') {
    const els = Array.isArray(a.elements) ? a.elements.filter((e) => typeof e === 'string') : [];
    return els.length ? `[${els.join(',')}]` : 'L';
  }
  if (typeof a.label === 'string' && a.label.trim() !== '') return a.label.trim();
  return 'C';
}

function parseAtom(a: unknown): SceneAtom {
  const atom: Json = isObj(a) ? a : {};
  const loc = Array.isArray(atom.location) ? atom.location : [];
  const out: SceneAtom = {
    symbol: atomSymbol(atom),
    x: finite(loc[0]),
    y: finite(loc[1]),
    charge: Math.round(finite(atom.charge)),
    molecule: -1,
  };
  const radical = Math.round(finite(atom.radical));
  if (radical > 0) out.radical = radical;
  const isotope = Math.round(finite(atom.isotope));
  if (isotope > 0) out.isotope = isotope;
  return out;
}

function parseBond(b: unknown, offset: number, count: number): SceneBond | null {
  if (!isObj(b) || !Array.isArray(b.atoms)) return null;
  const [i, j] = b.atoms;
  if (!Number.isInteger(i) || !Number.isInteger(j)) return null;
  const bi = i as number;
  const bj = j as number;
  if (bi < 0 || bj < 0 || bi >= count || bj >= count || bi === bj) return null;
  const t = b.type;
  const order: SceneBond['order'] = t === 2 || t === 3 || t === 4 ? t : 1;
  const bond: SceneBond = { begin: offset + bi, end: offset + bj, order };
  // KET/molfile stereo: 1 = up (wedge), 6 = down (hash); narrow end at atoms[0].
  if (order === 1 && b.stereo === 1) bond.stereo = 'up';
  if (order === 1 && b.stereo === 6) bond.stereo = 'down';
  return bond;
}

function parseArrow(node: Json): SceneArrow | null {
  const data = isObj(node.data) ? node.data : null;
  if (!data || !Array.isArray(data.pos)) return null;
  const start = parsePoint(data.pos[0]);
  const end = parsePoint(data.pos[1]);
  if (!start || !end) return null;
  const mode = typeof data.mode === 'string' ? data.mode : 'open-angle';
  const kind = arrowKindForMode(mode);
  const arrow: SceneArrow = { kind, start, end, mode };
  if (kind === 'electron-pair' || kind === 'single-electron') arrow.height = finite(data.height);
  return arrow;
}

/** Assigns SceneAtom.molecule = index of the connected component (numbered by first atom). */
function assignComponents(scene: Scene): void {
  const parent = scene.atoms.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (const b of scene.bonds) {
    const ra = find(b.begin);
    const rb = find(b.end);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  const ids = new Map<number, number>();
  scene.atoms.forEach((atom, i) => {
    const r = find(i);
    if (!ids.has(r)) ids.set(r, ids.size);
    atom.molecule = ids.get(r)!;
  });
}

/**
 * Converts KET (a JSON string or an already parsed object) into a Scene.
 * Throws only if `ket` is a non-empty string that is not valid JSON.
 */
export function ketToScene(ket: string | object): Scene {
  let doc: unknown = ket;
  if (typeof ket === 'string') {
    if (ket.trim() === '') return emptyScene();
    try {
      doc = JSON.parse(ket);
    } catch (e) {
      throw new Error(`ketToScene: input is not valid KET JSON (${(e as Error).message})`);
    }
  }
  const scene = emptyScene();
  if (!isObj(doc) || !isObj(doc.root) || !Array.isArray(doc.root.nodes)) return scene;

  const seenRefs = new Set<string>();
  for (const node of doc.root.nodes) {
    if (!isObj(node)) continue;
    if (typeof node.$ref === 'string') {
      if (seenRefs.has(node.$ref)) continue;
      seenRefs.add(node.$ref);
      const mol = doc[node.$ref];
      // Molecules and R-group fragments both carry atoms/bonds; anything else
      // (monomers, missing keys) is ignored.
      if (!isObj(mol) || !Array.isArray(mol.atoms)) continue;
      const offset = scene.atoms.length;
      for (const a of mol.atoms) scene.atoms.push(parseAtom(a));
      const bonds = Array.isArray(mol.bonds) ? mol.bonds : [];
      for (const b of bonds) {
        const bond = parseBond(b, offset, mol.atoms.length);
        if (bond) scene.bonds.push(bond);
      }
    } else if (node.type === 'plus') {
      const p = parsePoint(node.location);
      if (p) scene.pluses.push(p);
    } else if (node.type === 'arrow') {
      const arrow = parseArrow(node);
      if (arrow) scene.arrows.push(arrow);
    }
  }
  assignComponents(scene);
  return scene;
}
