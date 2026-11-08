/**
 * MolScribeClient.ts
 * Client for the OPTIONAL MolScribe server (backend/). MecHand's default
 * recognizer runs in the browser; this engine sends a PNG of the ink to a
 * self-hosted MolScribe service (Qian et al., J. Chem. Inf. Model. 2023) and
 * receives SMILES/molfile plus atoms and bonds.
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
  molfile?: string;
  atoms: AtomResult[];
  bonds: BondResult[];
  arrows: ArrowResult[];
  confidence: number;
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

  /** Send a PNG of the ink to the backend for recognition. */
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
      // AbortController + setTimeout instead of AbortSignal.timeout() for older Safari.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const resp = await fetch(`${this.backendUrl}/health`, { signal: controller.signal });
        return resp.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }
}
