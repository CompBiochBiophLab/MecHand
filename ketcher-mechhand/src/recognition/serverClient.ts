/**
 * Client for the OPTIONAL recognition server (../backend), which runs DECIMER
 * (Rajan, Brinkhaus et al.) on a PNG of the ink and returns a SMILES string.
 * MecHand's default recognizer runs in the browser and needs no server.
 */

export interface ServerResult {
  smiles: string;
  molfile: string;
  confidence: number;
  valid: boolean;
  engine: string;
}

export interface ServerHealth {
  ok: boolean;
  engine?: string;
}

/** fetch with a timeout (AbortController + setTimeout works in every browser). */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class RecognitionServer {
  readonly url: string;

  constructor(url: string, private readonly timeoutMs = 60_000) {
    this.url = url.replace(/\/$/, '');
  }

  async health(): Promise<ServerHealth> {
    try {
      const resp = await fetchWithTimeout(`${this.url}/health`, {}, 3000);
      if (!resp.ok) return { ok: false };
      const body = (await resp.json()) as { engine?: string };
      return { ok: true, engine: body.engine };
    } catch {
      return { ok: false };
    }
  }

  async recognize(png: Blob): Promise<ServerResult> {
    const form = new FormData();
    form.append('image', png, 'sketch.png');
    const resp = await fetchWithTimeout(`${this.url}/recognize`, { method: 'POST', body: form }, this.timeoutMs);
    if (!resp.ok) throw new Error(`Server error ${resp.status}: ${await resp.text()}`);
    return (await resp.json()) as ServerResult;
  }
}
