import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { binarize, components, fillSmallHoles, inkFromRGBA, removeSpecks } from './bitmap';
import { decodePNG, encodePNG } from './png.node';
describe('mask probe', () => {
  it('mask', () => {
    const png = decodePNG(readFileSync(`public/study/${process.env.F ?? 'A1-paracetamol'}.png`));
    const w = png.width, h = png.height;
    let mask = binarize(inkFromRGBA(png.data, w, h));
    mask = removeSpecks(mask, w, h, 4);
    mask = fillSmallHoles(mask, w, h, 6);
    const { labels, list } = components(mask, w, h);
    const out = new Uint8Array(w * h * 4);
    const pal = [[230, 25, 75], [60, 180, 75], [0, 130, 200], [245, 130, 48], [145, 30, 180], [70, 240, 240], [240, 50, 230], [128, 128, 0]];
    for (let i = 0; i < w * h; i++) {
      const c = labels[i] ? pal[labels[i] % pal.length] : [255, 255, 255];
      out.set([...c, 255], i * 4);
    }
    writeFileSync(process.env.OUT!, encodePNG(w, h, out, 4));
    for (const c of list) console.log(c.label, c.minX, c.minY, c.maxX - c.minX + 1, c.maxY - c.minY + 1, c.area);
  });
});
