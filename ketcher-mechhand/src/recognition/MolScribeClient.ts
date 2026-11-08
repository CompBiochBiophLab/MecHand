/**
 * MolScribeClient.ts
 * HTTP client that sends a rasterized sketch (PNG blob) to the MecHand
 * Python backend and receives a structured molecular graph.
 *
 * The backend wraps the MolScribe model (Qian et al., J. Chem. Inf. Model.
 * 2023) and returns JSON with atom/bond lists plus 2-D coordinates that
 * can be fed directly to Ketcher's internal model.
 */

export interface AtomResult {
  symbol: string;
  x: number;
  y: number;
  charge?: number;
  isotope?: number;
}

export interface BondResult {
  beginAtom: number;
  endAtom: number;
  type: 'single' | 'double' | 'triple' | 'aromatic' | 'wedge' | 'dash';
}

export interface ArrowResult {
  /** SVG path string of the recognised curved arrow */
  path: string;
  fromAtom?: number;
  toAtom?: number;
}

export interface RecognitionResult {
  smiles: string;
  atoms: AtomResult[];
  bonds: BondResult[];
  arrows: ArrowResult[];
  confidence: number;
  /** URL of the annotated debug image (backend can optionally return this) */
  debugImageUrl?: string;
}

export interface MolScribeClientOptions {
  /** Base URL of the MecHand Python backend, e.g. http://localhost:8000 */
  backendUrl: string;
  timeoutMs?: number;
}

export class MolScribeClient {
  private backendUrl: string;
  private timeoutMs: number;

  constructor(opts: MolScribeClientOptions) {
    this.backendUrl = opts.backendUrl.replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  /**
   * Send a canvas/SVG snapshot to the backend for recognition.
   * @param imageBlob   PNG blob of the freehand strokes area
   * @param strokeTypes Optional hint: which portion is 'structure' vs 'arrow'
   */
  async recognize(imageBlob: Blob): Promise<RecognitionResult> {
    const form = new FormData();
    form.append('image', imageBlob, 'sketch.png');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch(`${this.backendUrl}/recognize`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Backend error ${resp.status}: ${text}`);
      }
      return (await resp.json()) as RecognitionResult;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Health check — returns true if the backend is reachable */
  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.backendUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
}

// ── Canvas helper ─────────────────────────────────────────────────────────────

/**
 * Rasterize an SVG element (or a bounding box within a canvas) to a PNG Blob.
 * This is what we send to MolScribeClient.recognize().
 */
export async function rasterizeStrokes(
  svgElement: SVGSVGElement,
  padding = 20
): Promise<Blob> {
  const bbox = svgElement.getBBox();
  const w = Math.ceil(bbox.width + 2 * padding);
  const h = Math.ceil(bbox.height + 2 * padding);

  const canvas = document.createElement('canvas');
  canvas.width = w * 2;   // 2× for HiDPI
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);

  // Clone SVG, offset viewBox to bbox
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('viewBox',
    `${bbox.x - padding} ${bbox.y - padding} ${w} ${h}`);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));

  const serialised = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(
    new Blob([serialised], { type: 'image/svg+xml' })
  );

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png'
    )
  );
}
