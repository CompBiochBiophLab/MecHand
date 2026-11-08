/**
 * FreehandLayer: a transparent SVG ink layer over Ketcher's drawing area.
 * When enabled it captures the pen/mouse and keeps the strokes; when disabled
 * pointer events pass through to Ketcher, so both can be used alternately.
 */

import type { InkStroke, StrokeRole } from '../recognition/sketch';
import { type InkPoint, StylusManager } from './StylusManager';

const ROLE_COLOURS: Record<StrokeRole, string> = {
  bond: '#2563eb',
  arrow: '#dc2626',
  arrowhead: '#dc2626',
  text: '#059669',
  dot: '#059669',
  ignored: '#9ca3af',
};

export class FreehandLayer {
  readonly svg: SVGSVGElement;
  strokes: InkStroke[] = [];
  private paths: SVGPathElement[] = [];
  private live = new Map<number, SVGPathElement>();
  private stylus: StylusManager;
  private enabled = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly onChange: (layer: FreehandLayer) => void,
  ) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('data-testid', 'mechand-ink');
    Object.assign(this.svg.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      zIndex: '50', pointerEvents: 'none', touchAction: 'none', cursor: 'crosshair',
      userSelect: 'none', webkitUserSelect: 'none',
    });
    // iPadOS: no callout/magnifier on long press with a finger or the Pencil.
    this.svg.style.setProperty('-webkit-touch-callout', 'none');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(this.svg);

    this.stylus = new StylusManager(this.svg, {
      onStart: (id) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        Object.entries({ fill: 'none', stroke: '#111827', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
          .forEach(([k, v]) => path.setAttribute(k, v));
        this.svg.appendChild(path);
        this.live.set(id, path);
      },
      onMove: (id, pts) => this.live.get(id)?.setAttribute('d', toPath(pts)),
      onEnd: (id, pts) => {
        const path = this.live.get(id);
        this.live.delete(id);
        if (!path) return;
        if (pts.length < 2) {
          // A tap is a dot (lone pair / radical): draw it as a short mark.
          pts = [pts[0], { ...pts[0], x: pts[0].x + 0.5 }];
        }
        path.setAttribute('d', toPath(pts));
        this.paths.push(path);
        this.strokes.push({ points: pts.map(({ x, y }) => ({ x, y })) });
        this.onChange(this);
      },
    });
    this.stylus.attach();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.svg.style.pointerEvents = on ? 'auto' : 'none';
    this.svg.style.background = on ? 'rgba(59,130,246,0.04)' : 'transparent';
  }

  undo(): void {
    this.strokes.pop();
    this.paths.pop()?.remove();
    this.onChange(this);
  }

  clear(): void {
    this.strokes = [];
    this.paths.forEach((p) => p.remove());
    this.paths = [];
    this.onChange(this);
  }

  /** Colour strokes by how the recognizer interpreted them. */
  showRoles(roles: StrokeRole[]): void {
    this.paths.forEach((p, i) => p.setAttribute('stroke', ROLE_COLOURS[roles[i] ?? 'ignored']));
  }

  resetColours(): void {
    this.paths.forEach((p) => p.setAttribute('stroke', '#111827'));
  }

  /** PNG of the ink (white background), for the optional MolScribe engine. */
  async toPng(padding = 20): Promise<Blob> {
    const box = this.svg.getBBox();
    const w = Math.ceil(box.width + 2 * padding), h = Math.ceil(box.height + 2 * padding);
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('viewBox', `${box.x - padding} ${box.y - padding} ${w} ${h}`);
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.removeAttribute('style');
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

function toPath(pts: InkPoint[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}
