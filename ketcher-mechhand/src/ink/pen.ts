/**
 * How the ink looks (colour, kind of stroke, thickness) and how input is taken
 * (input mode). Appearance never changes recognition, which only uses the shape
 * of each stroke. Also the stroke-eraser geometry. Pure functions, except the
 * SVG rendering and the per-browser storage of the settings.
 */

import type { InkPoint } from './StylusManager';

export type PenStyle = 'ballpoint' | 'fountain' | 'marker' | 'dashed';
/**
 *  auto      pen, finger and mouse draw; once a pen is used, fingers are ignored
 *  pen       only pen and mouse draw (palm rejection on tablets)
 *  touch     pen, finger and mouse always draw
 *  trackpad  as auto, but the mouse/trackpad draws by click – move – click
 */
export type InputMode = 'auto' | 'pen' | 'touch' | 'trackpad';
export type InkTool = 'pen' | 'eraser';

export interface PenSettings {
  colour: string;
  style: PenStyle;
  /** Base line width in CSS px. */
  width: number;
  input: InputMode;
}

export const PEN_COLOURS: { value: string; name: string }[] = [
  { value: '#111827', name: 'Black' },
  { value: '#1d4ed8', name: 'Blue' },
  { value: '#dc2626', name: 'Red' },
  { value: '#15803d', name: 'Green' },
  { value: '#7c3aed', name: 'Purple' },
  { value: '#ea580c', name: 'Orange' },
];

export const PEN_STYLES: { value: PenStyle; name: string; hint: string }[] = [
  { value: 'ballpoint', name: 'Ballpoint', hint: 'Even line' },
  { value: 'fountain', name: 'Fountain pen', hint: 'Line width follows pen pressure (or speed with a mouse)' },
  { value: 'marker', name: 'Marker', hint: 'Broad, translucent line' },
  { value: 'dashed', name: 'Dashed', hint: 'Dashed line (only the look: it is recognized like any other stroke)' },
];

export const PEN_WIDTHS: { value: number; name: string }[] = [
  { value: 1.5, name: 'Fine' },
  { value: 2.5, name: 'Medium' },
  { value: 4, name: 'Bold' },
  { value: 6, name: 'Extra bold' },
];

export const INPUT_MODES: { value: InputMode; name: string; hint: string }[] = [
  { value: 'auto', name: 'Auto', hint: 'Pen, finger and mouse draw; once a pen is used, fingers are ignored (palm rejection).' },
  { value: 'pen', name: 'Pen only', hint: 'Only the pen (and a mouse) draws; fingers and palms are ignored.' },
  { value: 'touch', name: 'Pen and finger', hint: 'Pen, finger and mouse always draw (large contacts such as a palm are still ignored).' },
  { value: 'trackpad', name: 'Trackpad', hint: 'Click to start a stroke, move without pressing, click again to end it. Dragging also works.' },
];

export const DEFAULT_PEN: PenSettings = { colour: PEN_COLOURS[0].value, style: 'ballpoint', width: 2.5, input: 'auto' };

const STORAGE_KEY = 'mechand.pen.v1';

/** The pen settings stored in this browser (a convenience only; never sent anywhere). */
export function loadPenSettings(): PenSettings {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null') as Partial<PenSettings> | null;
    return cleanPenSettings(raw);
  } catch {
    return { ...DEFAULT_PEN };
  }
}

export function savePenSettings(p: PenSettings): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(cleanPenSettings(p)));
  } catch {
    /* private mode: settings last for this page only */
  }
}

export function cleanPenSettings(raw: Partial<PenSettings> | null | undefined): PenSettings {
  const r = raw ?? {};
  return {
    colour: PEN_COLOURS.some((c) => c.value === r.colour) ? r.colour! : DEFAULT_PEN.colour,
    style: PEN_STYLES.some((s) => s.value === r.style) ? r.style! : DEFAULT_PEN.style,
    width: PEN_WIDTHS.some((w) => w.value === r.width) ? r.width! : DEFAULT_PEN.width,
    input: INPUT_MODES.some((m) => m.value === r.input) ? r.input! : DEFAULT_PEN.input,
  };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/** Width factor of each segment of a fountain-pen stroke (quantized to 0.1). */
export function fountainFactors(pts: InkPoint[]): number[] {
  const n = pts.length - 1;
  if (n < 1) return [];
  const pressured = pts.some((p) => Math.abs(p.pressure - 0.5) > 1e-3);
  const out: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1];
    let f: number;
    if (pressured) {
      f = 0.35 + 1.3 * ((a.pressure + b.pressure) / 2);
    } else {
      // Mouse, trackpad and most fingers report no pressure: thinner when faster.
      const dt = Math.max(b.t - a.t, 1);
      const speed = Math.hypot(b.x - a.x, b.y - a.y) / dt; // px per ms
      v = i === 0 ? speed : 0.7 * v + 0.3 * speed;
      f = 1.35 - 0.45 * v;
    }
    out.push(Math.round(Math.min(1.6, Math.max(0.45, f)) * 10) / 10);
  }
  return out;
}

export function strokeLength(pts: { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const f1 = (v: number) => v.toFixed(1);

/**
 * SVG path through the points, smoothed with quadratic Bézier curves between the midpoints of
 * successive segments (the sampled points are control points). Only the drawing is smoothed:
 * recognition uses the raw points.
 */
export function pathOf(pts: { x: number; y: number }[]): string {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`).join(' ');
  let d = `M${f1(pts[0].x)} ${f1(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    d += ` Q${f1(p.x)} ${f1(p.y)} ${f1((p.x + q.x) / 2)} ${f1((p.y + q.y) / 2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${f1(last.x)} ${f1(last.y)}`;
}

/** Line width of the whole stroke as drawn (the marker is broader). */
export function drawnWidth(pen: PenSettings): number {
  return pen.style === 'marker' ? pen.width * 3 : pen.width;
}

/** Draw a stroke into an SVG group (replacing what it held). */
export function renderInk(g: SVGGElement, pts: InkPoint[], pen: PenSettings): void {
  while (g.firstChild) g.firstChild.remove();
  const w = drawnWidth(pen);
  const attrs: Record<string, string> = {
    fill: 'none', stroke: pen.colour, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-colour': pen.colour,
  };
  for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, v);
  if (pen.style === 'marker') g.setAttribute('opacity', '0.4');
  else g.removeAttribute('opacity');

  const add = (d: string, width: number, dash?: string) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke-width', width.toFixed(2));
    if (dash) path.setAttribute('stroke-dasharray', dash);
    g.appendChild(path);
  };

  // A tap is a dot (lone pair, radical): make it visible whatever the width.
  if (strokeLength(pts) < 2) {
    add(pathOf([pts[0], { x: pts[0].x + 0.5, y: pts[0].y }]), Math.max(w * 1.6, 3.5));
    return;
  }
  if (pen.style === 'fountain' && pts.length > 2) {
    const f = fountainFactors(pts);
    let start = 0;
    for (let i = 1; i <= f.length; i++) {
      if (i === f.length || f[i] !== f[start]) {
        add(pathOf(pts.slice(start, i + 1)), w * f[start]);
        start = i;
      }
    }
    return;
  }
  add(pathOf(pts), w, pen.style === 'dashed' ? `${(w * 2.4).toFixed(1)} ${(w * 2.2 + 3).toFixed(1)}` : undefined);
}

/** A sample stroke (a gentle wave) used to preview a pen in the toolbar. */
export function previewStroke(width = 34, height = 14): InkPoint[] {
  return Array.from({ length: 24 }, (_, i) => {
    const s = i / 23;
    return {
      x: 3 + s * (width - 6),
      y: height / 2 - Math.sin(s * Math.PI * 2) * (height / 2 - 4),
      t: i * 16,
      pressure: 0.25 + 0.6 * Math.sin(s * Math.PI),
    };
  });
}

// ── Stroke eraser ─────────────────────────────────────────────────────────────

type P = { x: number; y: number };

function pointSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function cross(o: P, a: P, b: P): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Distance between segments ab and cd (0 when they cross). */
export function segmentDistance(a: P, b: P, c: P, d: P): number {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}

/**
 * Does the eraser, moving from `a` to `b` with the given radius, touch the
 * stroke? (`margin` adds half the drawn line width.)
 */
export function eraserTouches(a: P, b: P, radius: number, stroke: P[], margin = 0): boolean {
  const r = radius + margin;
  const minX = Math.min(a.x, b.x) - r, maxX = Math.max(a.x, b.x) + r;
  const minY = Math.min(a.y, b.y) - r, maxY = Math.max(a.y, b.y) + r;
  if (stroke.length === 1) return pointSegment(stroke[0], a, b) <= r;
  for (let i = 1; i < stroke.length; i++) {
    const c = stroke[i - 1], d = stroke[i];
    if (Math.max(c.x, d.x) < minX || Math.min(c.x, d.x) > maxX || Math.max(c.y, d.y) < minY || Math.min(c.y, d.y) > maxY) continue;
    if (segmentDistance(a, b, c, d) <= r) return true;
  }
  return false;
}
