/**
 * StrokeClassifier.ts
 * Classifies freehand SVG strokes into chemical primitives:
 *   - ATOM:   small closed/circular stroke or tap → atom label site
 *   - BOND:   roughly straight stroke            → bond
 *   - ARROW:  curved stroke with detectable tip  → mechanism arrow
 *   - TEXT:   complex multi-stroke               → annotation
 *
 * Uses purely geometric heuristics; no network call.
 * Called by StylusManager on each stroke-end event.
 */

export type StrokeClass = 'ATOM' | 'BOND' | 'ARROW' | 'TEXT' | 'UNKNOWN';

export interface Point {
  x: number;
  y: number;
  t: number;        // timestamp ms
  pressure: number; // 0–1 from PointerEvent
}

export interface Stroke {
  points: Point[];
  id: string;
}

export interface ClassifiedStroke {
  stroke: Stroke;
  type: StrokeClass;
  confidence: number; // 0–1
  bbox: { x: number; y: number; w: number; h: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function bbox(pts: Point[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function arcLength(pts: Point[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/** Chord / arc ratio: 1 = perfectly straight, <0.7 = very curved */
function straightness(pts: Point[]): number {
  if (pts.length < 2) return 1;
  const chord = Math.sqrt(
    Math.pow(pts[pts.length - 1].x - pts[0].x, 2) +
      Math.pow(pts[pts.length - 1].y - pts[0].y, 2)
  );
  const arc = arcLength(pts);
  return arc > 0 ? chord / arc : 1;
}

/** How closed is the stroke? (end-to-start distance / arc length) */
function closure(pts: Point[]): number {
  if (pts.length < 2) return 0;
  const d = Math.sqrt(
    Math.pow(pts[pts.length - 1].x - pts[0].x, 2) +
      Math.pow(pts[pts.length - 1].y - pts[0].y, 2)
  );
  const arc = arcLength(pts);
  return arc > 0 ? 1 - d / arc : 0;
}

/** Detect arrowhead: does the last segment diverge sharply from the main direction? */
function hasArrowTip(pts: Point[]): boolean {
  if (pts.length < 10) return false;
  const n = pts.length;
  const mainDx = pts[n - 1].x - pts[0].x;
  const mainDy = pts[n - 1].y - pts[0].y;
  const mainAngle = Math.atan2(mainDy, mainDx);

  // Check the last 15% of the stroke for a sharp direction change
  const tail = pts.slice(Math.floor(n * 0.85));
  const tailDx = tail[tail.length - 1].x - tail[0].x;
  const tailDy = tail[tail.length - 1].y - tail[0].y;
  const tailAngle = Math.atan2(tailDy, tailDx);

  const diff = Math.abs(mainAngle - tailAngle);
  return diff > 0.4 && diff < 2.5; // ~23–143°
}

// ── Main classifier ───────────────────────────────────────────────────────────

export function classifyStroke(stroke: Stroke): ClassifiedStroke {
  const pts = stroke.points;
  const box = bbox(pts);
  const arc = arcLength(pts);
  const size = Math.max(box.w, box.h);

  // Very short tap → atom site
  if (arc < 15 || size < 10) {
    return { stroke, type: 'ATOM', confidence: 0.85, bbox: box };
  }

  const st = straightness(pts);
  const cl = closure(pts);

  // Nearly closed loop → atom ring marker or cycle
  if (cl > 0.75 && size < 60) {
    return { stroke, type: 'ATOM', confidence: 0.75, bbox: box };
  }

  // Very straight → bond
  if (st > 0.90) {
    return { stroke, type: 'BOND', confidence: 0.9, bbox: box };
  }

  // Curved with arrowhead → mechanism arrow
  if (st < 0.80 && hasArrowTip(pts)) {
    return { stroke, type: 'ARROW', confidence: 0.8, bbox: box };
  }

  // Curved without clear arrowhead → could be ring or annotation
  if (st < 0.70) {
    return { stroke, type: 'TEXT', confidence: 0.5, bbox: box };
  }

  return { stroke, type: 'UNKNOWN', confidence: 0.3, bbox: box };
}
