/**
 * StylusManager.ts
 * Unified pointer input for mouse, trackpad, touch and stylus (Pointer Events).
 *
 * Cross-browser notes (see README, "Browser support"):
 *  - getCoalescedEvents() gives sub-frame samples for smooth pen input; it is
 *    feature-detected, so browsers without it simply get one sample per event.
 *  - Pressure: pens report 0..1; mouse/trackpad report 0.5 while pressed.
 *  - Palm rejection: once a pen has been used, touch input is ignored for
 *    drawing (iPad + Apple Pencil, Windows pen tablets); large contacts are
 *    always ignored.
 *  - The element needs `touch-action: none` so touch/pen strokes do not scroll
 *    or zoom the page (set by FreehandLayer).
 */

export interface InkPoint {
  x: number;
  y: number;
  t: number;
  pressure: number;
}

export interface StylusCallbacks {
  onStart?: (id: number, p: InkPoint) => void;
  onMove?: (id: number, points: InkPoint[]) => void;
  onEnd: (id: number, points: InkPoint[]) => void;
}

export interface StylusOptions {
  /** Contact size (CSS px) above which a touch is treated as a palm. */
  palmThreshold?: number;
}

export class StylusManager {
  private active = new Map<number, InkPoint[]>();
  private penSeen = false;
  private readonly palmThreshold: number;

  constructor(
    private readonly el: HTMLElement | SVGElement,
    private readonly cb: StylusCallbacks,
    opts: StylusOptions = {},
  ) {
    this.palmThreshold = opts.palmThreshold ?? 40;
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
  }

  private rejected(e: PointerEvent): boolean {
    if (e.pointerType === 'mouse' && e.button !== 0) return true;
    if (e.pointerType === 'pen') this.penSeen = true;
    if (e.pointerType === 'touch') {
      if (this.penSeen) return true;
      if (e.width > this.palmThreshold || e.height > this.palmThreshold) return true;
    }
    return false;
  }

  private toPoint(e: PointerEvent): InkPoint {
    const r = this.el.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      t: e.timeStamp,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  private onDown = (e: PointerEvent) => {
    if (this.rejected(e)) return;
    e.preventDefault();
    try {
      (this.el as Element).setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort (old WebKit throws for synthetic events) */
    }
    const p = this.toPoint(e);
    this.active.set(e.pointerId, [p]);
    this.cb.onStart?.(e.pointerId, p);
  };

  private onMove = (e: PointerEvent) => {
    const pts = this.active.get(e.pointerId);
    if (!pts) return;
    const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ce of samples.length ? samples : [e]) pts.push(this.toPoint(ce));
    this.cb.onMove?.(e.pointerId, pts);
  };

  private onUp = (e: PointerEvent) => {
    const pts = this.active.get(e.pointerId);
    if (!pts) return;
    this.active.delete(e.pointerId);
    if (e.type === 'pointerup') pts.push(this.toPoint(e));
    this.cb.onEnd(e.pointerId, pts);
  };
}
