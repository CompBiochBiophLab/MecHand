/**
 * Writes synthetic handwriting of the SN2 reactants (with both curved arrows) as
 * e2e/fixtures/sn2-ink.json, which e2e/screenshots.spec.ts draws with the mouse
 * for the website and tutorial screenshots. Skipped unless MECHAND_INK_OUT is set:
 *   MECHAND_INK_OUT=e2e/fixtures npx vitest run src/recognition/ink.export.test.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { ketToScene } from '../scene/ketToScene';
import type { Scene } from '../scene/types';
import { TEMPLATES } from '../templates/catalog';
import { synthesizeSketch } from './synth';

const OUT = process.env.MECHAND_INK_OUT;

/** The part of a scene before its first reaction arrow (reactants and their curved arrows). */
const curved = (k: string) => k === 'electron-pair' || k === 'single-electron';

function reactants(scene: Scene): Scene {
  const reaction = scene.arrows.find((a) => !curved(a.kind));
  const limit = reaction ? Math.min(reaction.start.x, reaction.end.x) : Infinity;
  const keep = scene.atoms.map((a) => a.x < limit);
  const index = new Map<number, number>();
  scene.atoms.forEach((_, i) => keep[i] && index.set(i, index.size));
  return {
    ...scene,
    atoms: scene.atoms.filter((_, i) => keep[i]),
    bonds: scene.bonds.filter((b) => keep[b.begin] && keep[b.end]).map((b) => ({ ...b, begin: index.get(b.begin)!, end: index.get(b.end)! })),
    arrows: scene.arrows.filter((a) => curved(a.kind) && Math.max(a.start.x, a.end.x) < limit),
    pluses: scene.pluses.filter((p) => p.x < limit),
  };
}

describe.skipIf(!OUT)('ink fixtures', () => {
  it('writes the SN2 reactants as synthetic handwriting', () => {
    const t = TEMPLATES.find((x) => x.id === 'sn2')!;
    const scene = reactants(ketToScene(t.ket));
    const strokes = synthesizeSketch(scene, { seed: 11, bondPx: 62 });
    mkdirSync(OUT!, { recursive: true });
    const round = (v: number) => Math.round(v * 10) / 10;
    writeFileSync(join(OUT!, 'sn2-ink.json'), JSON.stringify({
      note: 'Synthetic handwriting of the SN2 reactants (src/recognition/ink.export.test.ts). Do not edit.',
      strokes: strokes.map((s) => s.points.map((p) => [round(p.x), round(p.y)])),
    }) + '\n');
  });
});
