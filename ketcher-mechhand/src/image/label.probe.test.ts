import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { buildModel } from '../recognition/model';
import { decodePNG } from './png.node';
import { recognizeImage } from './recognizeImage';
const model = buildModel();
describe('label probe', () => {
  it('labels', () => {
    for (const f of (process.env.F ?? 'A1-paracetamol').split(',')) {
      const png = decodePNG(readFileSync(`public/study/${f}.png`));
      const r = recognizeImage(png.data, png.width, png.height, model.recognizer, { heads: model.heads, style: model.style,
        debug: (k: string, d: unknown) => { if (k === 'label') console.log(f, JSON.stringify(d)); } });
      console.log(f, r.result.scene.atoms.filter((a) => a.symbol !== 'C' || a.charge).map((a) => a.symbol + (a.charge || '')).join(' '));
    }
  });
});
