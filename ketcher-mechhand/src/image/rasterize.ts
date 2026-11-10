/**
 * Draws strokes into an RGBA image (black on white, round caps), and filled
 * polygons. Used to test image recognition on synthetic handwriting and to make
 * synthetic printed structures (wedges, filled heads) without a canvas.
 */

import type { Pt } from '../recognition/geometry';

export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function blank(width: number, height: number): RGBAImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
}

function ink(img: RGBAImage, x: number, y: number, rgb: [number, number, number], alpha: number) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const p = (y * img.width + x) * 4;
  for (let k = 0; k < 3; k++) img.data[p + k] = Math.round(img.data[p + k] * (1 - alpha) + rgb[k] * alpha);
}

/** A thick polyline with round joins and caps (simple coverage anti-aliasing). */
export function drawPolyline(img: RGBAImage, pts: Pt[], width: number, rgb: [number, number, number] = [0, 0, 0]): void {
  const r = width / 2;
  const segs = pts.length === 1 ? [[pts[0], pts[0]]] : pts.slice(1).map((b, i) => [pts[i], b]);
  for (const [a, b] of segs) {
    const x0 = Math.floor(Math.min(a.x, b.x) - r - 1), x1 = Math.ceil(Math.max(a.x, b.x) + r + 1);
    const y0 = Math.floor(Math.min(a.y, b.y) - r - 1), y1 = Math.ceil(Math.max(a.y, b.y) + r + 1);
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = L2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / L2)) : 0;
      const d = Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
      const cover = Math.max(0, Math.min(1, r + 0.5 - d));
      if (cover > 0) {
        const p = (y * img.width + x) * 4;
        if (x >= 0 && y >= 0 && x < img.width && y < img.height && img.data[p] > 255 * (1 - cover)) ink(img, x, y, rgb, cover);
      }
    }
  }
}

/** A filled polygon (even–odd rule). */
export function fillPolygon(img: RGBAImage, poly: Pt[], rgb: [number, number, number] = [0, 0, 0]): void {
  const ys = poly.map((p) => p.y);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(img.height - 1, Math.ceil(Math.max(...ys))); y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) xs.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(img.width - 1, Math.floor(xs[k + 1] - 0.5)); x++) ink(img, x, y, rgb, 1);
    }
  }
}

/** Strokes (any coordinates) drawn into a fresh image with a margin. */
export function rasterizeStrokes(strokes: Pt[][], opts: { width?: number; margin?: number; scale?: number } = {}): RGBAImage {
  const all = strokes.flat();
  const margin = opts.margin ?? 20, s = opts.scale ?? 1;
  const minX = Math.min(...all.map((p) => p.x)), minY = Math.min(...all.map((p) => p.y));
  const maxX = Math.max(...all.map((p) => p.x)), maxY = Math.max(...all.map((p) => p.y));
  const img = blank(Math.ceil((maxX - minX) * s + 2 * margin), Math.ceil((maxY - minY) * s + 2 * margin));
  for (const st of strokes) drawPolyline(img, st.map((p) => ({ x: (p.x - minX) * s + margin, y: (p.y - minY) * s + margin })), opts.width ?? 3);
  return img;
}
