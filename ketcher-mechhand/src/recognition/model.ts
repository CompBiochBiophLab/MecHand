/**
 * The handwritten-symbol model: glyph skeletons (symbols-model.json), contributed
 * real handwriting (model/contrib/*.json) and the user's own samples (Teach mode,
 * stored in the browser), all fed to the $P recognizer.
 *
 * Updating the model = editing JSON in this folder and bumping "version".
 */

import { PointCloudRecognizer, type SymbolSample } from './dollarP';
import { type ElementSample, type InkStyle, cleanElementSamples, headSamples, inkStyle } from './elements';
import { type Pt, prng } from './geometry';
import baseModel from './model/symbols-model.json';

type Primitive = { line: number[][] } | { arc: number[] };
type GlyphVariant = Primitive[][];

interface ModelFile {
  name: string;
  version: string;
  augmentations: number;
  glyphs: Record<string, GlyphVariant[]>;
  /** Arrowhead skeletons in the shaft frame: "full" (2 barbs) and "half" (1 barb). */
  arrowheads: Record<'full' | 'half', GlyphVariant[]>;
}

interface ContribFile {
  samples?: SymbolSample[];
  /** Arrows, bonds and electrons drawn in Teach mode (see elements.ts). */
  elements?: ElementSample[];
}

const MODEL = baseModel as unknown as ModelFile;

const contribModules = import.meta.glob<ContribFile>('./model/contrib/*.json', {
  eager: true,
  import: 'default',
});

export const MODEL_NAME = MODEL.name;
export const MODEL_VERSION = MODEL.version;

/** Expand a glyph variant into strokes in a unit box (y down). */
export function expandGlyph(variant: GlyphVariant): Pt[][] {
  return variant.map((stroke) => {
    const pts: Pt[] = [];
    for (const prim of stroke) {
      if ('line' in prim) {
        for (const [x, y] of prim.line) pts.push({ x, y });
      } else {
        const [cx, cy, rx, ry, t0, t1] = prim.arc;
        const steps = Math.max(4, Math.ceil(Math.abs(t1 - t0) / 10));
        for (let k = 0; k <= steps; k++) {
          const t = ((t0 + ((t1 - t0) * k) / steps) * Math.PI) / 180;
          pts.push({ x: cx + rx * Math.cos(t), y: cy - ry * Math.sin(t) });
        }
      }
    }
    return densify(pts, 0.04);
  });
}

/** Insert points so consecutive points are at most `step` apart. */
function densify(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Random slant, aspect, rotation and jitter, as people's handwriting varies. */
export function augment(strokes: Pt[][], rand: () => number, amount = 1): Pt[][] {
  const shear = (rand() - 0.5) * 0.5 * amount;
  const sx = 1 + (rand() - 0.5) * 0.5 * amount;
  const rot = ((rand() - 0.5) * 16 * amount * Math.PI) / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  return strokes.map((s) => {
    const ox = (rand() - 0.5) * 0.06 * amount, oy = (rand() - 0.5) * 0.06 * amount;
    return s.map((p) => {
      const x0 = (p.x - 0.5) * sx + shear * (0.5 - p.y) + ox;
      const y0 = p.y - 0.5 + oy;
      return {
        x: 0.5 + x0 * cos - y0 * sin + (rand() - 0.5) * 0.03 * amount,
        y: 0.5 + x0 * sin + y0 * cos + (rand() - 0.5) * 0.03 * amount,
      };
    });
  });
}

/** Symbols the model knows, e.g. ["+", "-", "B", "C", ...]. */
export const MODEL_SYMBOLS = Object.keys(MODEL.glyphs).sort();

/** Glyph strokes for a symbol (unit box, y down); used for synthetic sketches. */
export function glyphStrokes(symbol: string, variant = 0): Pt[][] {
  const variants = MODEL.glyphs[symbol];
  if (!variants) throw new Error(`Unknown glyph: ${symbol}`);
  return expandGlyph(variants[variant % variants.length]);
}

export function glyphVariantCount(symbol: string): number {
  return MODEL.glyphs[symbol]?.length ?? 0;
}

export function contributedSamples(): SymbolSample[] {
  return Object.values(contribModules).flatMap((m) => cleanSymbolSamples(m.samples));
}

export function contributedElements(): ElementSample[] {
  return Object.values(contribModules).flatMap((m) => cleanElementSamples(m.elements));
}

/** Keeps only the symbol and the x, y points (drops anything else a file may carry). */
export function cleanSymbolSamples(raw: unknown): SymbolSample[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    if (!s || typeof s.symbol !== 'string' || !Array.isArray(s.strokes)) return [];
    const strokes = (s.strokes as unknown[]).filter(Array.isArray).map((st) =>
      (st as { x: unknown; y: unknown }[]).map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    return [{ symbol: s.symbol as string, strokes }];
  });
}

// ── User samples (Teach mode) ──────────────────────────────────────────────

const USER_KEY = 'mechand.symbols.user.v1';

export function loadUserSamples(): SymbolSample[] {
  try {
    const raw = globalThis.localStorage?.getItem(USER_KEY);
    return raw ? cleanSymbolSamples((JSON.parse(raw) as ContribFile).samples) : [];
  } catch {
    return [];
  }
}

export function saveUserSamples(samples: SymbolSample[]): void {
  try {
    globalThis.localStorage?.setItem(USER_KEY, JSON.stringify({ samples }));
  } catch {
    /* storage unavailable (private mode); samples stay in memory only */
  }
}

export interface SymbolModel {
  name: string;
  version: string;
  recognizer: PointCloudRecognizer;
  /** Arrowheads in the shaft frame ("full" / "half"), see sketch.ts. */
  heads: PointCloudRecognizer;
  /** Drawing style learned from the element samples (dot size). */
  style: InkStyle;
  templateCount: number;
  contributedCount: number;
  userCount: number;
  /** Element samples (arrows, bonds, electrons): contributed and the user's own. */
  contributedElementCount: number;
  userElementCount: number;
}

export function buildModel(opts: {
  userSamples?: SymbolSample[];
  userElements?: ElementSample[];
  augmentations?: number;
} = {}): SymbolModel {
  const recognizer = new PointCloudRecognizer();
  const n = opts.augmentations ?? MODEL.augmentations;
  let seed = 1;
  for (const [symbol, variants] of Object.entries(MODEL.glyphs)) {
    for (const v of variants) {
      const strokes = expandGlyph(v);
      recognizer.add({ symbol, strokes });
      const rand = prng(seed++);
      for (let k = 0; k < n; k++) recognizer.add({ symbol, strokes: augment(strokes, rand) });
    }
  }
  const contributed = contributedSamples();
  contributed.forEach((s) => recognizer.add(s));
  const user = opts.userSamples ?? [];
  user.forEach((s) => recognizer.add(s));

  // Arrowheads: skeletons (slightly varied) plus the heads cut out of the arrow samples.
  const heads = new PointCloudRecognizer();
  for (const [kind, variants] of Object.entries(MODEL.arrowheads ?? {})) {
    for (const v of variants) {
      const strokes = expandGlyph(v);
      heads.add({ symbol: kind, strokes });
      const rand = prng(seed++);
      for (let k = 0; k < 6; k++) heads.add({ symbol: kind, strokes: augment(strokes, rand, 0.6) });
    }
  }
  const elements = [...contributedElements(), ...(opts.userElements ?? [])];
  elements.flatMap(headSamples).forEach((h) => heads.add(h));
  return {
    name: MODEL.name,
    version: MODEL.version,
    recognizer,
    heads,
    style: inkStyle(elements),
    templateCount: recognizer.size,
    contributedCount: contributed.length,
    userCount: user.length,
    contributedElementCount: elements.length - (opts.userElements?.length ?? 0),
    userElementCount: opts.userElements?.length ?? 0,
  };
}
