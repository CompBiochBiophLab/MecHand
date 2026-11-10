/**
 * Raster basics for reading drawings from images (all in the browser, no server):
 * an "ink" channel from RGBA, adaptive binarization, connected components, the
 * distance transform and Zhang–Suen thinning. Plain typed arrays, so everything
 * runs in tests without a canvas.
 */

/** One byte per pixel, row-major. */
export interface Gray {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Ink darkness from colour: 255 − the smallest channel. Black, red, blue or green
 * strokes on white or cream paper all count as ink (textbook mechanisms often draw
 * arrows in red and atoms in colour); transparent pixels count as paper.
 */
export function inkFromRGBA(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    const a = rgba[p + 3] / 255;
    const m = Math.min(rgba[p], rgba[p + 1], rgba[p + 2]);
    data[i] = Math.round((255 - m) * a);
  }
  return { width, height, data };
}

/** Otsu's threshold of a byte image. */
export function otsu(g: Gray): number {
  const hist = new Float64Array(256);
  for (const v of g.data) hist[v]++;
  const total = g.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}

/**
 * Ink mask (1 = ink). A pixel is ink when it is darker than its neighbourhood (local
 * mean over a window of about 1/24 of the image, Bradley–Roth) by a margin, and
 * darker than a global floor from Otsu's threshold: this copes with the uneven
 * lighting of a photographed page and with clean scans alike.
 */
export function binarize(g: Gray): Uint8Array {
  const { width: w, height: h, data } = g;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const t = otsu(g);
  const floor = Math.max(40, 0.5 * t);
  const r = Math.max(6, Math.round(Math.max(w, h) / 48));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const area = (x1 - x0) * (y1 - y0);
      const s = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const v = data[y * w + x];
      out[y * w + x] = v > floor && v > (s / area) * 1.1 + 12 ? 1 : 0;
    }
  }
  return out;
}

export interface Component {
  label: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 8-connected components of a mask; `labels` holds 1-based labels (0 = background). */
export function components(mask: Uint8Array, w: number, h: number): { labels: Int32Array; list: Component[] } {
  const labels = new Int32Array(w * h);
  const list: Component[] = [];
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i]) continue;
    const c: Component = { label: list.length + 1, area: 0, minX: w, minY: h, maxX: 0, maxY: 0 };
    labels[i] = c.label;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      c.area++;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) {
          const q = ny * w + nx;
          if (mask[q] && !labels[q]) { labels[q] = c.label; stack.push(q); }
        }
      }
    }
    list.push(c);
  }
  return { labels, list };
}

/** Removes components smaller than `minArea` pixels (specks, paper texture). */
export function removeSpecks(mask: Uint8Array, w: number, h: number, minArea: number): Uint8Array {
  const { labels, list } = components(mask, w, h);
  const keep = new Uint8Array(list.length + 1);
  for (const c of list) keep[c.label] = c.area >= minArea ? 1 : 0;
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = labels[i] ? keep[labels[i]] : 0;
  return out;
}

/** Fills holes smaller than `maxArea` pixels inside the ink (pinholes of a scanned stroke). */
export function fillSmallHoles(mask: Uint8Array, w: number, h: number, maxArea: number): Uint8Array {
  const inv = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inv[i] = mask[i] ? 0 : 1;
  const { labels, list } = components(inv, w, h);
  const fill = new Uint8Array(list.length + 1);
  for (const c of list) {
    const touchesBorder = c.minX === 0 || c.minY === 0 || c.maxX === w - 1 || c.maxY === h - 1;
    fill[c.label] = !touchesBorder && c.area <= maxArea ? 1 : 0;
  }
  const out = mask.slice();
  for (let i = 0; i < mask.length; i++) if (labels[i] && fill[labels[i]]) out[i] = 1;
  return out;
}

/**
 * Euclidean distance from each ink pixel to the nearest paper pixel (Felzenszwalb–
 * Huttenlocher, exact). Twice the value on the skeleton is the local stroke width.
 */
export function distanceTransform(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e12;
  const f = new Float64Array(Math.max(w, h));
  const d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float64Array(Math.max(w, h) + 1);
  const tmp = new Float64Array(w * h);
  const edt1 = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) ** 2 + f[v[k]];
    }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? INF : 0;
    edt1(h);
    for (let y = 0; y < h; y++) tmp[y * w + x] = d[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = tmp[y * w + x];
    edt1(w);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

/** Zhang–Suen thinning: a one-pixel-wide skeleton of the ink (in place on a copy). */
export function thin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const img = mask.slice();
  const del: number[] = [];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]);
  for (let changed = true; changed;) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!img[y * w + x]) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
        const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let a = 0;
        for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) a++;
        if (a !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(y * w + x);
      }
      if (del.length) changed = true;
      for (const i of del) img[i] = 0;
    }
  }
  return img;
}
