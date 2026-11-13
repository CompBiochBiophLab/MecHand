/**
 * FreehandLayer: a transparent SVG ink layer over Ketcher's drawing area.
 * When enabled it captures the pen/mouse and keeps the strokes; when disabled
 * pointer events pass through to Ketcher, so both can be used alternately.
 *
 * Tools: the pen (colour, kind of line and width from pen.ts) and a stroke
 * eraser (also the pen's eraser end). Adding, erasing and clearing ink can be
 * undone and redone; inserting the recognized structure resets the history.
 */

import type { InkStroke, StrokeRole } from '../recognition/sketch';
import { DEFAULT_PEN, type InkTool, type InputMode, type PenSettings, drawnWidth, eraserTouches, renderInk } from './pen';
import { type InkPoint, type StrokeInfo, StylusManager } from './StylusManager';

const ROLE_COLOURS: Record<StrokeRole, string> = {
  bond: '#2563eb',
  arrow: '#dc2626',
  arrowhead: '#dc2626',
  text: '#059669',
  dot: '#059669',
  ignored: '#9ca3af',
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.6)" stroke="#374151" stroke-width="1.5"/></svg>',
)}") 12 12, cell`;

interface InkItem {
  stroke: InkStroke;
  /** When the stroke started and ended (performance.now(), ms). */
  time: { start: number; end: number };
  el: SVGGElement;
  pen: PenSettings;
}

export type InkOpKind = 'add' | 'erase' | 'clear' | 'import';
type InkOp =
  | { kind: 'add'; item: InkItem; index: number }
  | { kind: 'import'; items: InkItem[] }
  | { kind: 'erase'; removed: { item: InkItem; index: number }[] }
  | { kind: 'clear'; removed: InkItem[] };

export type EraseSource = 'tool' | 'pen-eraser';

export interface InkEvents {
  /** Strokes removed by one eraser gesture. */
  onErase?: (count: number, source: EraseSource) => void;
  /** Each pointer that touched the ink layer, and whether it could draw. */
  onInput?: (pointerType: string, accepted: boolean) => void;
  /** A trackpad-mode stroke opened (waits for its closing click) or closed. */
  onOpenStroke?: (open: boolean) => void;
}

export class FreehandLayer {
  readonly svg: SVGSVGElement;
  private items: InkItem[] = [];
  private undoStack: InkOp[] = [];
  private redoStack: InkOp[] = [];
  private live = new Map<number, { g: SVGGElement; start: number }>();
  private erasing = new Map<number, { seen: number; radius: number; hit: Set<InkItem>; source: EraseSource }>();
  private readonly eraserMark: SVGCircleElement;
  private stylus: StylusManager;
  private enabled = false;
  private pen: PenSettings = { ...DEFAULT_PEN };
  private tool: InkTool = 'pen';

  constructor(
    private readonly host: HTMLElement,
    private readonly onChange: (layer: FreehandLayer) => void,
    private readonly events: InkEvents = {},
  ) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('data-testid', 'mechand-ink');
    Object.assign(this.svg.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      zIndex: '50', pointerEvents: 'none', touchAction: 'none', cursor: 'crosshair',
      userSelect: 'none', webkitUserSelect: 'none',
    });
    // iPadOS: no callout/magnifier on long press with a finger or the Pencil.
    this.svg.style.setProperty('-webkit-touch-callout', 'none');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.eraserMark = document.createElementNS(SVG_NS, 'circle');
    Object.entries({ fill: 'rgba(255,255,255,0.5)', stroke: '#6b7280', 'stroke-width': '1.2', 'stroke-dasharray': '3 2', 'pointer-events': 'none', display: 'none' })
      .forEach(([k, v]) => this.eraserMark.setAttribute(k, v));
    this.svg.appendChild(this.eraserMark);
    host.appendChild(this.svg);

    this.stylus = new StylusManager(this.svg, {
      onStart: (id, p, info) => this.startStroke(id, p, info),
      onMove: (id, pts) => this.moveStroke(id, pts),
      onEnd: (id, pts) => this.endStroke(id, pts),
      onCancel: (id) => this.cancelStroke(id),
      onInput: (type, accepted) => this.events.onInput?.(type, accepted),
    }, { mode: this.pen.input });
    this.stylus.attach();
  }

  // ── State ───────────────────────────────────────────────────────────────────

  get strokes(): InkStroke[] {
    return this.items.map((i) => i.stroke);
  }

  /** When each stroke started and ended (performance.now(), ms), parallel to strokes. */
  get strokeTimes(): { start: number; end: number }[] {
    return this.items.map((i) => i.time);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** A trackpad-mode stroke is waiting for its closing click. */
  get hasOpenStroke(): boolean {
    return this.stylus.hasOpenStroke;
  }

  setEnabled(on: boolean): void {
    if (!on) this.stylus.cancel();
    this.enabled = on;
    this.svg.style.pointerEvents = on ? 'auto' : 'none';
    this.svg.style.background = on ? 'rgba(59,130,246,0.04)' : 'transparent';
  }

  /** Pen for the next strokes (existing ink keeps its look). */
  setPen(pen: PenSettings): void {
    this.pen = { ...pen };
    if (this.stylus.inputMode !== pen.input) this.stylus.setMode(pen.input);
  }

  setInputMode(mode: InputMode): void {
    this.setPen({ ...this.pen, input: mode });
  }

  setTool(tool: InkTool): void {
    this.tool = tool;
    this.svg.style.cursor = tool === 'eraser' ? ERASER_CURSOR : 'crosshair';
  }

  /** Abandon the stroke in progress (e.g. an open trackpad stroke). */
  cancelInput(): void {
    this.stylus.cancel();
  }

  /** Contacts ignored by palm rejection since the last call. */
  takeRejectedCount(): number {
    const n = this.stylus.rejectedCount;
    this.stylus.rejectedCount = 0;
    return n;
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  private startStroke(id: number, p: InkPoint, info: StrokeInfo) {
    if (this.stylus.hasOpenStroke) this.events.onOpenStroke?.(true);
    if (info.eraser || this.tool === 'eraser') {
      const radius = info.pointerType === 'touch' ? 14 : info.eraser ? 12 : 9;
      this.erasing.set(id, { seen: 0, radius, hit: new Set(), source: info.eraser ? 'pen-eraser' : 'tool' });
      this.eraseAlong(id, [p]);
      return;
    }
    const g = document.createElementNS(SVG_NS, 'g');
    this.svg.insertBefore(g, this.eraserMark);
    renderInk(g, [p], this.pen);
    this.live.set(id, { g, start: performance.now() });
  }

  private moveStroke(id: number, pts: InkPoint[]) {
    if (this.erasing.has(id)) {
      this.eraseAlong(id, pts);
      return;
    }
    const live = this.live.get(id);
    if (live) renderInk(live.g, pts, this.pen);
  }

  private endStroke(id: number, pts: InkPoint[]) {
    this.events.onOpenStroke?.(false);
    const er = this.erasing.get(id);
    if (er) {
      this.eraseAlong(id, pts);
      this.erasing.delete(id);
      this.eraserMark.setAttribute('display', 'none');
      if (er.hit.size) {
        const removed = this.items.map((item, index) => ({ item, index })).filter(({ item }) => er.hit.has(item));
        this.apply({ kind: 'erase', removed });
        this.events.onErase?.(removed.length, er.source);
      }
      return;
    }
    const live = this.live.get(id);
    this.live.delete(id);
    if (!live) return;
    if (pts.length < 2) {
      // A tap is a dot (lone pair / radical): keep it as a short mark.
      pts = [pts[0], { ...pts[0], x: pts[0].x + 0.5 }];
    }
    renderInk(live.g, pts, this.pen);
    const item: InkItem = {
      stroke: { points: pts.map(({ x, y }) => ({ x, y })) },
      time: { start: live.start, end: performance.now() },
      el: live.g,
      pen: { ...this.pen },
    };
    this.apply({ kind: 'add', item, index: this.items.length });
  }

  private cancelStroke(id: number) {
    this.events.onOpenStroke?.(false);
    this.live.get(id)?.g.remove();
    this.live.delete(id);
    const er = this.erasing.get(id);
    if (er) {
      er.hit.forEach((item) => item.el.style.removeProperty('opacity'));
      this.erasing.delete(id);
      this.eraserMark.setAttribute('display', 'none');
    }
  }

  /** Mark the strokes the eraser passes over (they are removed when it lifts). */
  private eraseAlong(id: number, pts: InkPoint[]) {
    const er = this.erasing.get(id);
    if (!er || !pts.length) return;
    // Only the eraser path not examined yet (from the last examined sample on).
    const path = pts.slice(Math.max(er.seen - 1, 0));
    const segments = path.length === 1 ? [[path[0], path[0]]] : path.slice(1).map((b, i) => [path[i], b]);
    for (const [a, b] of segments) {
      for (const item of this.items) {
        if (er.hit.has(item)) continue;
        if (eraserTouches(a, b, er.radius, item.stroke.points, drawnWidth(item.pen) / 2)) {
          er.hit.add(item);
          item.el.style.opacity = '0.18';
        }
      }
    }
    er.seen = pts.length;
    const last = pts[pts.length - 1];
    Object.entries({ cx: last.x.toFixed(1), cy: last.y.toFixed(1), r: String(er.radius), display: 'inline' })
      .forEach(([k, v]) => this.eraserMark.setAttribute(k, v));
  }

  // ── History ─────────────────────────────────────────────────────────────────

  private apply(op: InkOp, fromRedo = false) {
    this.do(op);
    this.undoStack.push(op);
    if (!fromRedo) this.redoStack = [];
    this.onChange(this);
  }

  private do(op: InkOp) {
    if (op.kind === 'add') {
      this.items.splice(op.index, 0, op.item);
      this.place(op.item);
    } else if (op.kind === 'import') {
      for (const item of op.items) {
        this.items.push(item);
        this.place(item);
      }
    } else if (op.kind === 'erase') {
      for (let i = op.removed.length - 1; i >= 0; i--) {
        const { item, index } = op.removed[i];
        this.items.splice(index, 1);
        item.el.remove();
      }
    } else {
      this.items = [];
      op.removed.forEach((item) => item.el.remove());
    }
  }

  private undoOp(op: InkOp) {
    if (op.kind === 'add') {
      this.items.splice(op.index, 1);
      op.item.el.remove();
    } else if (op.kind === 'import') {
      this.items = this.items.filter((i) => !op.items.includes(i));
      op.items.forEach((i) => i.el.remove());
    } else if (op.kind === 'erase') {
      for (const { item, index } of op.removed) {
        item.el.style.removeProperty('opacity');
        this.items.splice(index, 0, item);
        this.place(item);
      }
    } else {
      this.items = [...op.removed];
      op.removed.forEach((item) => this.place(item));
    }
  }

  /** Put a stroke's element back in drawing order. */
  private place(item: InkItem) {
    const next = this.items[this.items.indexOf(item) + 1];
    this.svg.insertBefore(item.el, next && next.el.parentNode === this.svg ? next.el : this.eraserMark);
  }

  /** Undo the last change to the ink; returns what was undone. */
  undo(): InkOpKind | null {
    const op = this.undoStack.pop();
    if (!op) return null;
    this.undoOp(op);
    this.redoStack.push(op);
    this.onChange(this);
    return op.kind;
  }

  redo(): InkOpKind | null {
    const op = this.redoStack.pop();
    if (!op) return null;
    this.apply(op, true);
    return op.kind;
  }

  /**
   * Adds strokes made elsewhere (an image read by MecHand) as ink, in layer pixels,
   * with the current pen; one undoable step. The user can then erase or redraw.
   */
  addStrokes(strokes: { x: number; y: number }[][]): void {
    const now = performance.now();
    const items: InkItem[] = strokes.filter((s) => s.length).map((s) => {
      const pts = (s.length === 1 ? [s[0], { x: s[0].x + 0.5, y: s[0].y }] : s).map((p) => ({ x: p.x, y: p.y, t: now, pressure: 0.5 }));
      const g = document.createElementNS(SVG_NS, 'g');
      renderInk(g, pts, this.pen);
      return { stroke: { points: pts.map(({ x, y }) => ({ x, y })) }, time: { start: now, end: now }, el: g, pen: { ...this.pen } };
    });
    if (items.length) this.apply({ kind: 'import', items });
  }

  /** Size of the drawing area (CSS px). */
  get size(): { width: number; height: number } {
    const r = this.svg.getBoundingClientRect();
    return { width: r.width, height: r.height };
  }

  /** Remove all ink (can be undone). */
  clearInk(): void {
    if (!this.items.length) return;
    this.apply({ kind: 'clear', removed: [...this.items] });
  }

  /** Remove all ink and forget the history (after inserting, between study tasks). */
  clear(): void {
    this.stylus.cancel();
    this.items.forEach((i) => i.el.remove());
    this.items = [];
    this.undoStack = [];
    this.redoStack = [];
    this.onChange(this);
  }

  // ── Display ─────────────────────────────────────────────────────────────────

  /** Colour strokes by how the recognizer interpreted them. */
  showRoles(roles: StrokeRole[]): void {
    this.items.forEach((item, i) => item.el.setAttribute('stroke', ROLE_COLOURS[roles[i] ?? 'ignored']));
  }

  resetColours(): void {
    this.items.forEach((item) => item.el.setAttribute('stroke', item.pen.colour));
  }

  /** PNG of the ink (black on white), for the optional DECIMER recognition server. */
  async toPng(padding = 20): Promise<Blob> {
    const box = this.svg.getBBox();
    const w = Math.ceil(box.width + 2 * padding), h = Math.ceil(box.height + 2 * padding);
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('viewBox', `${box.x - padding} ${box.y - padding} ${w} ${h}`);
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.removeAttribute('style');
    clone.querySelector('circle')?.remove();
    clone.querySelectorAll('g').forEach((g) => {
      g.setAttribute('stroke', '#000');
      g.removeAttribute('opacity');
      g.removeAttribute('style');
    });
    clone.querySelectorAll('path').forEach((p) => p.removeAttribute('stroke-dasharray'));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  destroy(): void {
    this.stylus.detach();
    this.svg.remove();
  }
}
