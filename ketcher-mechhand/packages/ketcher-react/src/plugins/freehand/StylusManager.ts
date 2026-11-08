/**
 * StylusManager.ts
 * Unified pointer input handler for mouse, trackpad and stylus.
 * Wraps the PointerEvents API and feeds classified strokes to MecHand.
 *
 * Key design decisions
 * ─────────────────────
 * • We use `pointer-events: none` on child SVG elements so ALL events
 *   land on the top-level canvas overlay.
 * • Palm rejection: touches with contactSize > PALM_THRESHOLD are ignored.
 * • Pressure is normalised to [0,1]; mouse/trackpad always returns 0.5.
 * • A "consolidate trigger" fires after IDLE_MS ms of inactivity IF the
 *   accumulated stroke group is non-trivial.
 */

import { classifyStroke, ClassifiedStroke, Point, Stroke } from './StrokeClassifier';

export interface StylusManagerOptions {
  canvas: SVGSVGElement | HTMLElement;
  onStroke: (classified: ClassifiedStroke) => void;
  onConsolidate: (strokes: ClassifiedStroke[]) => void;
  idleMs?: number;         // ms of inactivity before auto-consolidate (default 1500)
  palmThreshold?: number;  // contactSize px to reject as palm (default 40)
}

export class StylusManager {
  private canvas: Element;
  private onStroke: (s: ClassifiedStroke) => void;
  private onConsolidate: (ss: ClassifiedStroke[]) => void;
  private idleMs: number;
  private palmThreshold: number;

  private activePointers = new Map<number, Point[]>();
  private finishedStrokes: ClassifiedStroke[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private strokeCounter = 0;

  constructor(opts: StylusManagerOptions) {
    this.canvas = opts.canvas;
    this.onStroke = opts.onStroke;
    this.onConsolidate = opts.onConsolidate;
    this.idleMs = opts.idleMs ?? 1500;
    this.palmThreshold = opts.palmThreshold ?? 40;
    this.attach();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  private attach() {
    this.canvas.addEventListener('pointerdown', this.onDown as EventListener);
    this.canvas.addEventListener('pointermove', this.onMove as EventListener);
    this.canvas.addEventListener('pointerup', this.onUp as EventListener);
    this.canvas.addEventListener('pointercancel', this.onUp as EventListener);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onDown as EventListener);
    this.canvas.removeEventListener('pointermove', this.onMove as EventListener);
    this.canvas.removeEventListener('pointerup', this.onUp as EventListener);
    this.canvas.removeEventListener('pointercancel', this.onUp as EventListener);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  private onDown = (e: PointerEvent) => {
    if (this.isPalm(e)) return;
    (this.canvas as HTMLElement).setPointerCapture?.(e.pointerId);
    this.resetIdleTimer();
    this.activePointers.set(e.pointerId, [this.toPoint(e)]);
  };

  private onMove = (e: PointerEvent) => {
    const pts = this.activePointers.get(e.pointerId);
    if (!pts) return;
    // getCoalescedEvents gives sub-frame samples on stylus
    const coalesced = e.getCoalescedEvents?.() ?? [e];
    for (const ce of coalesced) pts.push(this.toPoint(ce));
  };

  private onUp = (e: PointerEvent) => {
    const pts = this.activePointers.get(e.pointerId);
    if (!pts) return;
    this.activePointers.delete(e.pointerId);

    if (pts.length === 0) return;

    const stroke: Stroke = {
      id: `s${++this.strokeCounter}`,
      points: pts,
    };
    const classified = classifyStroke(stroke);
    this.finishedStrokes.push(classified);
    this.onStroke(classified);
    this.resetIdleTimer();
  };

  // ── Idle consolidate ────────────────────────────────────────────────────────

  private resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.finishedStrokes.length > 0) {
        this.onConsolidate([...this.finishedStrokes]);
        this.finishedStrokes = [];
      }
    }, this.idleMs);
  }

  /** Force consolidation immediately (called by the Consolidate button). */
  consolidateNow() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.finishedStrokes.length > 0) {
      this.onConsolidate([...this.finishedStrokes]);
      this.finishedStrokes = [];
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private toPoint(e: PointerEvent): Point {
    const rect = (this.canvas as HTMLElement).getBoundingClientRect?.() ??
      { left: 0, top: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: e.timeStamp,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  private isPalm(e: PointerEvent): boolean {
    // PointerEvent.width/height is contact size on touch screens
    return (e.pointerType === 'touch') &&
      (e.width > this.palmThreshold || e.height > this.palmThreshold);
  }
}
