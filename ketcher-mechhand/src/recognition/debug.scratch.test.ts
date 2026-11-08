import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import type { Scene } from '../scene/types';
import { buildModel } from './model';
import { recognizeSketch } from './sketch';
import { synthesizeSketch } from './synth';
const model = buildModel();
interface Score { atoms: number; bonds: number; arrows: number; exact: boolean }
/** Compare a recognized scene with the reference (positions aligned by centroid). */
function compareScenes(ref: Scene, got: Scene): Score {
  // Best translation: try every same-element atom pair as an anchor and keep the
  // offset that brings most atoms within 0.4 units (robust to extra/missing atoms).
  let best = { dx: 0, dy: 0, hits: -1 };
  for (const a of ref.atoms) for (const b of got.atoms) {
    if (a.symbol !== b.symbol) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const hits = ref.atoms.filter((r) => got.atoms.some((g) => Math.hypot(g.x - r.x - dx, g.y - r.y - dy) < 0.4)).length;
    if (hits > best.hits) best = { dx, dy, hits };
  }
  const match = new Map<number, number>();
  const used = new Set<number>();
  const pairs = ref.atoms.flatMap((a, i) =>
    got.atoms.map((b, j) => ({ i, j, d: Math.hypot(b.x - a.x - best.dx, b.y - a.y - best.dy) })),
  ).sort((p, q) => p.d - q.d);
  for (const { i, j, d } of pairs) {
    if (d > 0.5 || match.has(i) || used.has(j)) continue;
    match.set(i, j);
    used.add(j);
  }
  const atomOk = ref.atoms.filter((a, i) => {
    const j = match.get(i);
    return j !== undefined && got.atoms[j].symbol === a.symbol && got.atoms[j].charge === a.charge;
  }).length;
  const bondOk = ref.bonds.filter((b) => {
    const x = match.get(b.begin), y = match.get(b.end);
    return x !== undefined && y !== undefined &&
      got.bonds.some((g) => ((g.begin === x && g.end === y) || (g.begin === y && g.end === x)) && g.order === b.order);
  }).length;
  const kinds = (s: Scene) => s.arrows.map((a) => a.kind).sort().join(',');
  const arrowsOk = kinds(ref) === kinds(got);
  const exact = atomOk === ref.atoms.length && bondOk === ref.bonds.length && arrowsOk &&
    got.atoms.length === ref.atoms.length && got.bonds.length === ref.bonds.length;
  return {
    atoms: ref.atoms.length ? atomOk / ref.atoms.length : 1,
    bonds: ref.bonds.length ? bondOk / ref.bonds.length : 1,
    arrows: arrowsOk ? 1 : 0,
    exact,
  };
}


const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env;
const STYLES = [{ seed: 11, inStrokeHeads: false }, { seed: 23, inStrokeHeads: true }, { seed: 37, inStrokeHeads: false }];
it('dump', () => {
  const out: unknown[] = [];
  const ids = (env.IDS ?? 'sn2').split(',');
  const styles = (env.STY ?? '0').split(',').map(Number);
  for (const id of ids) for (const si of styles) {
    const ref = ketToScene(TEMPLATES.find(x => x.id === id)!.ket);
    const strokes = synthesizeSketch(ref, STYLES[si]);
    const r = recognizeSketch(strokes, model.recognizer);
    const sc = compareScenes(ref, r.scene);
    // align got atoms to ref px frame
    let best = { dx: 0, dy: 0, hits: -1 };
    for (const a of ref.atoms) for (const b of r.scene.atoms) {
      if (a.symbol !== b.symbol) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const hits = ref.atoms.filter((q) => r.scene.atoms.some((g) => Math.hypot(g.x - q.x - dx, g.y - q.y - dy) < 0.4)).length;
      if (hits > best.hits) best = { dx, dy, hits };
    }
    const px = (p: { x: number; y: number }) => ({ x: 400 + p.x * 60, y: 300 - p.y * 60 });
    out.push({ id: `${id} s${si} a=${sc.atoms.toFixed(2)} b=${sc.bonds.toFixed(2)} ar=${sc.arrows} ex=${sc.exact} ref=${ref.arrows.map(a=>a.kind[0]).join('')} got=${r.scene.arrows.map(a=>a.kind[0]).join('')}`,
      strokes: strokes.map(s => s.points), roles: r.roles, L: r.bondLengthPx,
      atoms: r.scene.atoms, bonds: r.scene.bonds, labels: r.labels.map(l => ({ text: l.text, c: l.center })),
      refAtoms: ref.atoms.map(a => ({ ...px(a), s: a.symbol + (a.charge ? (a.charge > 0 ? '+' : '-').repeat(Math.abs(a.charge)) : '') })),
      gotAtoms: r.scene.atoms.map(a => ({ ...px({ x: a.x - best.dx, y: a.y - best.dy }), s: a.symbol + (a.charge ? (a.charge > 0 ? '+' : '-').repeat(Math.abs(a.charge)) : '') })),
      gotBonds: r.scene.bonds.map(b => [b.begin, b.end, b.order]),
    });
    console.log(out.length, (out[out.length-1] as {id:string}).id);
  }
  writeFileSync(env.OUT ?? '/private/tmp/claude-501/-Users-jordivilla-GitHub-RESEARCH-Article-MecHand/ff338a87-1803-4e72-9de5-bb24579bf51e/scratchpad/dump.json', JSON.stringify(out));
});
