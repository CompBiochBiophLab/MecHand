import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { endDirection, toShaftFrame } from './geometry';
import { recognizeSketch } from './sketch';
import { buildModel } from './model';
import { synthesizeSketch } from './synth';
const log = (...a: unknown[]) => appendFileSync('/private/tmp/claude-501/-Users-jordivilla-GitHub-RESEARCH-Article-MecHand/ff338a87-1803-4e72-9de5-bb24579bf51e/scratchpad/dbg.txt', a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
const model = buildModel();
it('dbg', { timeout: 60_000 }, () => {
  const ref = ketToScene(TEMPLATES.find((t) => t.id === 'sn2')!.ket);
  for (const headStyle of ['v', 'triangle', 'two-barbs'] as const) {
    const ink = synthesizeSketch(ref, { seed: 11, headStyle });
    const nh = headStyle === 'two-barbs' ? 2 : 1;
    const shaft = ink[ink.length - 1 - nh].points;
    const head = ink.slice(ink.length - nh).map((s) => s.points);
    const local = toShaftFrame(head, shaft[shaft.length - 1], endDirection(shaft, false, 0.3 * 60));
    const d0 = endDirection(shaft, false, 0.3 * 60);
    const rots = [-15, -10, -5, 0, 5, 10, 15].map((deg) => { const a = deg * Math.PI / 180; const d = { x: d0.x * Math.cos(a) - d0.y * Math.sin(a), y: d0.x * Math.sin(a) + d0.y * Math.cos(a) }; return Math.round(100 * (model.heads.classify(toShaftFrame(head, shaft[shaft.length - 1], d), 1)[0]?.score ?? 0)); });
    log(headStyle, 'rot scores', rots, model.heads.classify(local, 2), 'cx', local.flat().reduce((a, p) => a + p.x, 0) / local.flat().length);
    const t0 = performance.now();
    const r = recognizeSketch(ink, model.recognizer, { heads: model.heads });
    log(' recognized', r.scene.arrows.map((a) => a.kind), Math.round(performance.now() - t0), 'ms');
  }
});
