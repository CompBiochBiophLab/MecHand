import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { buildModel } from './model';
import { recognizeSketch } from './sketch';
import { synthesizeSketch } from './synth';
const log = (...a: unknown[]) => appendFileSync('/private/tmp/claude-501/-Users-jordivilla-GitHub-RESEARCH-Article-MecHand/ff338a87-1803-4e72-9de5-bb24579bf51e/scratchpad/tlog.txt', a.map(String).join(' ') + '\n');

const model = buildModel();
const kinds = (arr: { kind: string }[]) => arr.map((a) => a.kind).sort().join(',');
it('head styles', { timeout: 900_000 }, () => {
  for (const headStyle of ['v', 'triangle', 'two-barbs'] as const) {
    for (const useHeads of [false, true]) {
      let ok = 0, k = 0;
      const bad: string[] = [];
      for (const t of TEMPLATES) for (const seed of [11, 37]) {
        const ref = ketToScene(t.ket);
        const r = recognizeSketch(synthesizeSketch(ref, { seed, headStyle }), model.recognizer, useHeads ? { heads: model.heads, style: model.style } : {});
        k++;
        log('  ', headStyle, useHeads, t.id, seed, kinds(r.scene.arrows));
        if (kinds(ref.arrows) === kinds(r.scene.arrows)) ok++; else bad.push(`${t.id}/${seed}: ${kinds(r.scene.arrows)}`);
      }
      log(headStyle, useHeads ? 'heads' : 'rules', 'arrows ok', ok, '/', k, bad.slice(0, 4).join(' | '));
    }
  }
});
