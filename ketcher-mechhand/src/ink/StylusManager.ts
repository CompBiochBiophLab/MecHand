/**
 * StylusManager.ts
 * Unified pointer input for mouse, trackpad, touch and stylus (Pointer Events).
 *
 * Cross-browser notes (see README, "Browser support"):
 *  - getCoalescedEvents() gives sub-frame samples for smooth pen input; it is
 *    feature-detected, so browsers without it simply get one sample per event.
 *  - Pressure: pens report 0..1; mouse/trackpad report 0.5 while pressed.
 *  - Palm rejection depends on the input mode (pen.ts): in "auto", once a pen
 *    has been used (pressed or merely hovering), touch input is ignored for
 *    drawing (iPad + Apple Pencil, Windows pen tablets); "pen" always ignores
 *    touch; "touch" always accepts it. Large contacts are always ignored, and
 *    only one finger draws at a time.
 *  - The pen's eraser end (Pointer Events button 5 / buttons bit 32, e.g. Surface
 *    Pen, Wacom) is reported as an eraser stroke.
 *  - "trackpad" mode: a mouse-type pointer draws by click – move – click, so a
 *    trackpad needs no click-and-drag; an ordinary drag still draws.
 *  - The element needs `touch-action: none` so touch/pen strokes do not scroll
 *    or zoom the page (set by FreehandLayer).
 */

import type { InputMode } from './pen';

export interface InkPoint {
  x: number;
  y: number;
  t: number;
  pressure: number;
}

export interface StrokeInfo {
  pointerType: string;
  /** Drawn with the pen's eraser end. */
  eraser: boolean;
}

export interface StylusCallbacks {
  onStart?: (id: number, p: InkPoint, info: StrokeInfo) => void;
  onMove?: (id: number, points: InkPoint[]) => void;
  onEnd: (id: number, points: InkPoint[], info: StrokeInfo) => void;
  /** A stroke abandoned before it ended (Escape in trackpad mode). */
  onCancel?: (id: number) => void;
  /** Every pointer that touched the surface, and whether it was accepted for drawing. */
  onInput?: (pointerType: string, accepted: boolean) => void;
}

export interface StylusOptions {
  /** Contact size (CSS px) above which a touch is treated as a palm. */
  palmThreshold?: number;
  mode?: InputMode;
}

/** Movement (CSS px) that turns a press into a drag in trackpad mode. */
const DRAG_SLOP = 6;

export class StylusManager {
  /** Strokes in progress; the element's position is read once per stroke (no layout work per sample). */
  private active = new Map<number, { pts: InkPoint[]; info: StrokeInfo; rect: DOMRect }>();
  private penSeen = false;
  private readonly palmThreshold: number;
  private mode: InputMode;
  /** Trackpad mode: the open click – move – click stroke. */
  private open: { id: number; start: InkPoint; pressed: boolean; dragged: boolean } | null = null;
  private swallowUp = false;
  /** Contacts ignored (palm rejection), since the last reset. */
  rejectedCount = 0;

  constructor(
    private readonly el: HTMLElement | SVGElement,
    private readonly cb: StylusCallbacks,
    opts: StylusOptions = {},
  ) {
    this.palmThreshold = opts.palmThreshold ?? 40;
    this.mode = opts.mode ?? 'auto';
  }

  get inputMode(): InputMode {
    return this.mode;
  }

  setMode(mode: InputMode): void {
    if (mode !== 'trackpad') this.cancel();
    this.mode = mode;
    this.penSeen = false;
  }

  /** A trackpad stroke is waiting for its closing click. */
  get hasOpenStroke(): boolean {
    return this.open !== null;
  }

  attach(): void {
    this.el.addEventListener('pointerdown', this.onDown as EventListener);
    this.el.addEventListener('pointermove', this.onMove as EventListener);
    this.el.addEventListener('pointerup', this.onUp as EventListener);
    this.el.addEventListener('pointercancel', this.onUp as EventListener);
  }

  detach(): void {
    this.el.removeEventListener('pointerdown', this.onDown as EventListener);
    this.el.removeEventListener('pointermove', this.onMove as EventListener);
    this.el.removeEventListener('pointerup', this.onUp as EventListener);
    this.el.removeEventListener('pointercancel', this.onUp as EventListener);
    this.active.clear();
    this.open = null;
  }

  /** Drop the stroke in progress, if any (e.g. Escape). */
  cancel(): void {
    for (const id of this.active.keys()) this.cb.onCancel?.(id);
    this.active.clear();
    this.open = null;
    this.swallowUp = false;
  }

  private isEraser(e: PointerEvent): boolean {
    return e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0);
  }

  private rejected(e: PointerEvent): boolean {
    if (e.pointerType === 'mouse') return e.button !== 0;
    if (e.pointerType === 'pen') {
      this.penSeen = true;
      return e.button !== 0 && !this.isEraser(e);
    }
    if (e.pointerType === 'touch') {
      if (this.mode === 'pen') return true;
      if (this.mode !== 'touch' && this.penSeen) return true;
      if (e.width > this.palmThreshold || e.height > this.palmThreshold) return true;
      // Only one finger draws at a time (a second contact is a palm or a gesture).
      for (const s of this.active.values()) if (s.info.pointerType === 'touch') return true;
    }
    return false;
  }

  private toPoint(e: PointerEvent, r: DOMRect = this.el.getBoundingClientRect()): InkPoint {
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      t: e.timeStamp,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  private end(id: number) {
    const s = this.active.get(id);
    if (!s) return;
    this.active.delete(id);
    this.cb.onEnd(id, s.pts, s.info);
  }

  private onDown = (e: PointerEvent) => {
    // Trackpad mode: a click while a stroke is open ends it.
    if (this.open && e.pointerType === 'mouse') {
      e.preventDefault();
      const s = this.active.get(this.open.id);
      if (s) s.pts.push(this.toPoint(e, s.rect));
      const id = this.open.id;
      this.open = null;
      this.swallowUp = true;
      this.end(id);
      return;
    }
    const rejected = this.rejected(e);
    this.cb.onInput?.(e.pointerType, !rejected);
    if (rejected) {
      this.rejectedCount++;
      return;
    }
    e.preventDefault();
    try {
      (this.el as Element).setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort (old WebKit throws for synthetic events) */
    }
    const rect = this.el.getBoundingClientRect();
    const p = this.toPoint(e, rect);
    const info: StrokeInfo = { pointerType: e.pointerType, eraser: this.isEraser(e) };
    this.active.set(e.pointerId, { pts: [p], info, rect });
    if (this.mode === 'trackpad' && e.pointerType === 'mouse') this.open = { id: e.pointerId, start: p, pressed: true, dragged: false };
    this.cb.onStart?.(e.pointerId, p, info);
  };

  private onMove = (e: PointerEvent) => {
    const s = this.active.get(e.pointerId);
    if (!s) {
      // A hovering pen (Apple Pencil hover, Wacom, Surface) announces itself
      // before it touches: palm contacts that land first are then ignored.
      if (e.pointerType === 'pen') this.penSeen = true;
      return;
    }
    const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ce of samples.length ? samples : [e]) s.pts.push(this.toPoint(ce, s.rect));
    if (this.open?.pressed && !this.open.dragged) {
      const last = s.pts[s.pts.length - 1];
      if (Math.hypot(last.x - this.open.start.x, last.y - this.open.start.y) > DRAG_SLOP) this.open.dragged = true;
    }
    this.cb.onMove?.(e.pointerId, s.pts);
  };

  private onUp = (e: PointerEvent) => {
    if (this.swallowUp && e.pointerType === 'mouse') {
      this.swallowUp = false;
      return;
    }
    const s = this.active.get(e.pointerId);
    if (!s) return;
    if (this.open && this.open.id === e.pointerId) {
      if (e.type === 'pointerup' && !this.open.dragged) {
        // A click: the stroke stays open and follows the pointer until the next click.
        this.open.pressed = false;
        return;
      }
      this.open = null;
    }
    if (e.type === 'pointerup') s.pts.push(this.toPoint(e, s.rect));
    this.end(e.pointerId);
  };
}
