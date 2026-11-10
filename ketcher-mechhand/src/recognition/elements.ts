/**
 * Teach mode for the non-letter elements of a mechanism: arrows, bonds and
 * electrons.
 *
 * Letters are classified by the $P recognizer from examples, so a Teach sample of
 * a letter is simply one more example. Arrows, bonds and dots are found by
 * geometric rules (sketch.ts), so their samples teach the recognizer differently:
 *
 *  - Arrows: the head of every sample drawn with a separate head stroke is cut
 *    out, turned into the shaft frame (tip at the right) and added to the
 *    arrowhead model, which backs up the geometric arrowhead rules. A triangle
 *    head, a head drawn as two separate barbs, or any other personal style is
 *    recognized from then on.
 *  - Lone pairs and radicals: the size of the dots sets how large a stroke may
 *    be and still count as a dot (within limits, so that a small "−" stays a
 *    charge).
 *  - Bonds: recognized by geometry only; the samples show whether your style is
 *    read correctly and, when shared, are data to improve the rules.
 *
 * Each sample stores only the element, the scale of the Teach box and the x, y
 * points of its strokes (no time, pressure, device or identity).
 */

import type { SymbolSample } from './dollarP';
import { type Pt, bbox, bboxDiag, dist, endDirection, pathLength, toShaftFrame } from './geometry';
import type { SketchResult } from './sketch';

export type ElementId =
  | 'arrow-pair' | 'arrow-single' | 'arrow-reaction' | 'arrow-equilibrium'
  | 'bond-single' | 'bond-double' | 'bond-triple' | 'ring-benzene'
  | 'lone-pair' | 'radical';

export type ElementGroup = 'arrows' | 'bonds' | 'electrons';

export interface ElementInfo {
  id: ElementId;
  group: ElementGroup;
  label: string;
  /** What to draw in the Teach box. */
  prompt: string;
  /** Faint guide drawn in the Teach box to give the scale: a bond or a letter. */
  guide: 'bond' | 'letter';
  /** What the samples change: the arrowhead model, the dot size, or nothing (check only). */
  learns: 'arrowheads' | 'dots' | 'check';
}

export const ELEMENTS: ElementInfo[] = [
  { id: 'arrow-pair', group: 'arrows', label: 'Curved arrow, 2 e⁻ (full head)', guide: 'bond', learns: 'arrowheads',
    prompt: 'Draw a curved arrow one or two bonds long (the grey line is one bond), with the head you normally use.' },
  { id: 'arrow-single', group: 'arrows', label: 'Fishhook arrow, 1 e⁻ (half head)', guide: 'bond', learns: 'arrowheads',
    prompt: 'Draw a curved arrow with a half head (one barb), as for the movement of one electron.' },
  { id: 'arrow-reaction', group: 'arrows', label: 'Reaction arrow →', guide: 'bond', learns: 'arrowheads',
    prompt: 'Draw a straight reaction arrow, two or three bonds long.' },
  { id: 'arrow-equilibrium', group: 'arrows', label: 'Equilibrium arrows ⇌', guide: 'bond', learns: 'arrowheads',
    prompt: 'Draw two parallel straight arrows with half heads pointing in opposite directions.' },
  { id: 'bond-single', group: 'bonds', label: 'Single bond', guide: 'bond', learns: 'check',
    prompt: 'Draw a single bond about as long as the grey line.' },
  { id: 'bond-double', group: 'bonds', label: 'Double bond', guide: 'bond', learns: 'check',
    prompt: 'Draw a double bond about as long as the grey line.' },
  { id: 'bond-triple', group: 'bonds', label: 'Triple bond', guide: 'bond', learns: 'check',
    prompt: 'Draw a triple bond about as long as the grey line.' },
  { id: 'ring-benzene', group: 'bonds', label: 'Benzene ring', guide: 'bond', learns: 'check',
    prompt: 'Draw a benzene ring as a hexagon with three double bonds, sides about as long as the grey line.' },
  { id: 'lone-pair', group: 'electrons', label: 'Lone pair (two dots)', guide: 'letter', learns: 'dots',
    prompt: 'Draw the two dots of a lone pair beside the grey O, at the size you use.' },
  { id: 'radical', group: 'electrons', label: 'Radical (one dot)', guide: 'letter', learns: 'dots',
    prompt: 'Draw a single radical dot beside the grey O, at the size you use.' },
];

export const ELEMENT_GROUPS: { id: ElementGroup; label: string }[] = [
  { id: 'arrows', label: 'Arrows' },
  { id: 'bonds', label: 'Bonds' },
  { id: 'electrons', label: 'Electrons' },
];

export interface ElementSample {
  element: ElementId;
  /** Length in px of one bond in the Teach box (the grey guide) when it was drawn. */
  bondPx: number;
  strokes: Pt[][];
}

/** Bond length (px) of the grey guide in the Teach box. */
export const TEACH_BOND_PX = 70;

/** Per-user drawing style learned from the samples, in bond lengths. */
export interface InkStyle {
  /** Largest dot (bounding-box diagonal) drawn for lone pairs and radicals. */
  dotDiag?: number;
  /** Largest dot path length. */
  dotLength?: number;
}

const HEAD_OF: Partial<Record<ElementId, 'full' | 'half'>> = {
  'arrow-pair': 'full', 'arrow-reaction': 'full', 'arrow-single': 'half', 'arrow-equilibrium': 'half',
};

/**
 * Arrowhead samples (shaft frame) cut out of an arrow sample. Shafts are the large
 * strokes; every other stroke belongs to the head at the nearest shaft end. A
 * head drawn without lifting the pen gives nothing to cut out (and the geometric
 * rules handle that case).
 */
export function headSamples(sample: ElementSample): SymbolSample[] {
  const kind = HEAD_OF[sample.element];
  if (!kind) return [];
  const L = sample.bondPx;
  const strokes = sample.strokes.filter((s) => s.length > 1);
  if (strokes.length < 2) return [];
  // By extent, not path length: a scribbled head can have a long path.
  const sizes = strokes.map((s) => bboxDiag(bbox(s)));
  const largest = Math.max(...sizes);
  const shafts = strokes.map((_, i) => i).filter((i) => sizes[i] >= 0.5 * largest && sizes[i] > 0.6 * L);
  const heads = strokes.map((_, i) => i).filter((i) => !shafts.includes(i));
  const ends = shafts.flatMap((i) => [true, false].map((atStart) => ({
    i, atStart, p: atStart ? strokes[i][0] : strokes[i][strokes[i].length - 1],
  })));
  const groups = new Map<number, number[]>();
  for (const h of heads) {
    let best = -1, bestD = Infinity;
    ends.forEach((e, k) => {
      const d = Math.min(...strokes[h].map((p) => dist(p, e.p)));
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best >= 0 && bestD < 0.4 * L) groups.set(best, [...(groups.get(best) ?? []), h]);
  }
  return [...groups.entries()].map(([k, hs]) => {
    const e = ends[k];
    const dir = endDirection(strokes[e.i], e.atStart, 0.3 * L);
    return { symbol: kind, strokes: toShaftFrame(hs.map((h) => strokes[h]), e.p, dir) };
  });
}

/** Dot size learned from the lone-pair and radical samples (strokes that can be dots only). */
export function inkStyle(samples: ElementSample[]): InkStyle {
  let dotDiag = 0, dotLength = 0;
  for (const s of samples) {
    if (s.element !== 'lone-pair' && s.element !== 'radical') continue;
    for (const st of s.strokes) {
      const d = bboxDiag(bbox(st)) / s.bondPx, l = pathLength(st) / s.bondPx;
      if (d > 0.3) continue; // not a dot (a letter written by mistake)
      dotDiag = Math.max(dotDiag, d);
      dotLength = Math.max(dotLength, l);
    }
  }
  return dotDiag > 0 ? { dotDiag, dotLength } : {};
}

const ARROW_NAME: Record<string, string> = {
  'electron-pair': 'curved arrow (2 e⁻)',
  'single-electron': 'fishhook arrow (1 e⁻)',
  reaction: 'reaction arrow',
  equilibrium: 'equilibrium arrows',
  other: 'arrow',
};
const BOND_NAME = { 1: 'single bond', 2: 'double bond', 3: 'triple bond', 4: 'aromatic bond' } as const;

/** What the recognizer read in an element sample, and whether it is what was asked for. */
/** One item of what was read: a key of teach.read.* in the locale files, with a count or a text. */
export interface ReadPart {
  key: string;
  count?: number;
  text?: string;
}

export function checkElement(id: ElementId, r: SketchResult): { ok: boolean; read: string; parts: ReadPart[] } {
  const { arrows, bonds, atoms } = r.scene;
  const dots = r.roles.filter((x) => x === 'dot').length;
  const parts: string[] = [];
  const count = (items: string[]) => {
    const m = new Map<string, number>();
    items.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
    return [...m].map(([k, n]) => (n > 1 ? `${n} × ${k}` : k));
  };
  parts.push(...count(arrows.map((a) => ARROW_NAME[a.kind])));
  parts.push(...count(bonds.map((b) => BOND_NAME[b.order])));
  if (dots) parts.push(dots === 1 ? '1 dot' : `${dots} dots`);
  if (r.labels.length) parts.push(`text “${r.labels.map((l) => l.text).join(' ')}”`);
  const unread = r.roles.filter((x) => x === 'ignored').length;
  if (unread) parts.push(`${unread} stroke${unread > 1 ? 's' : ''} not understood`);
  const read = parts.length ? parts.join(', ') : 'nothing';
  const tally = (keys: string[]) => {
    const m = new Map<string, number>();
    keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
    return [...m].map(([key, count]) => ({ key, count }));
  };
  const readParts: ReadPart[] = [
    ...tally(arrows.map((a) => `arrow-${a.kind}`)),
    ...tally(bonds.map((b) => `bond-${b.order}`)),
    ...(dots ? [{ key: 'dots', count: dots }] : []),
    ...(r.labels.length ? [{ key: 'text', text: r.labels.map((l) => l.text).join(' ') }] : []),
    ...(unread ? [{ key: 'unread', count: unread }] : []),
  ];

  const onlyArrow = (kind: string) => arrows.length === 1 && arrows[0].kind === kind && bonds.length === 0 && !unread;
  const onlyBond = (order: number) => arrows.length === 0 && bonds.length === 1 && bonds[0].order === order && !unread && !r.labels.length;
  const ok: Record<ElementId, boolean> = {
    'arrow-pair': onlyArrow('electron-pair'),
    'arrow-single': onlyArrow('single-electron'),
    'arrow-reaction': onlyArrow('reaction'),
    'arrow-equilibrium': onlyArrow('equilibrium'),
    'bond-single': onlyBond(1),
    'bond-double': onlyBond(2),
    'bond-triple': onlyBond(3),
    'ring-benzene': atoms.length === 6 && bonds.length === 6 && bonds.filter((b) => b.order === 2).length === 3 && !unread,
    'lone-pair': dots === 2 && dots === r.roles.length,
    radical: dots === 1 && dots === r.roles.length,
  };
  return { ok: ok[id], read, parts: readParts };
}

// ── Storage (this browser only) ─────────────────────────────────────────────

const ELEMENTS_KEY = 'mechand.elements.user.v1';
const IDS = new Set<string>(ELEMENTS.map((e) => e.id));

/** Keeps only the element, the scale and the x, y points (drops anything else a file may carry). */
export function cleanElementSamples(raw: unknown): ElementSample[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    if (!s || !IDS.has(s.element) || !Array.isArray(s.strokes)) return [];
    const bondPx = Number(s.bondPx) > 0 ? Number(s.bondPx) : TEACH_BOND_PX;
    const strokes = (s.strokes as unknown[]).filter(Array.isArray).map((st) =>
      (st as { x: unknown; y: unknown }[]).map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    return [{ element: s.element as ElementId, bondPx, strokes }];
  });
}

export function loadElementSamples(): ElementSample[] {
  try {
    const raw = globalThis.localStorage?.getItem(ELEMENTS_KEY);
    return raw ? cleanElementSamples(JSON.parse(raw)?.samples) : [];
  } catch {
    return [];
  }
}

export function saveElementSamples(samples: ElementSample[]): void {
  try {
    globalThis.localStorage?.setItem(ELEMENTS_KEY, JSON.stringify({ samples }));
  } catch {
    /* storage unavailable (private mode); samples stay in memory only */
  }
}
