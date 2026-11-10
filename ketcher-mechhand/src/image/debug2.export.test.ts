import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { synthesizeSketch } from '../recognition/synth';
import { ketToScene } from '../scene/ketToScene';
import { TEMPLATES } from '../templates/catalog';
import { binarize, inkFromRGBA, thin } from './bitmap';
import { encodePNG } from './png.node';
import { rasterizeStrokes } from './rasterize';
const OUT = process.env.MECHAND_IMAGE_DEBUG;
describe.skipIf(!OUT)('raster debug', () => {
  it('writes mask and skeleton', () => {
    const t = TEMPLATES.find((x) => x.id === 'sn2')!;
    const img = rasterizeStrokes(synthesizeSketch(ketToScene(t.ket), { seed: 11 }).map((s) => s.points), { width: 3 });
    writeFileSync(`${OUT}/raster.png`, encodePNG(img.width, img.height, img.data, 4));
    const mask = binarize(inkFromRGBA(img.data, img.width, img.height));
    writeFileSync(`${OUT}/mask.png`, encodePNG(img.width, img.height, mask.map((v) => (v ? 0 : 255)), 1));
    const sk = thin(mask, img.width, img.height);
    writeFileSync(`${OUT}/skel.png`, encodePNG(img.width, img.height, sk.map((v) => (v ? 0 : 255)), 1));
  });
});
