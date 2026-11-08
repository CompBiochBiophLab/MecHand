/** Types for latex-harness.mjs (Node-side helpers of the LaTeX compile check). */

export declare const projectRoot: string;
export declare function latexCheckEnabled(): boolean;
export declare function findPdflatex(): string | null;
export declare function makeOutDir(): { dir: string; keep: boolean };
export declare function removeDir(dir: string): void;
export declare function compileTex(
  pdflatex: string,
  dir: string,
  name: string,
  source: string,
  runs?: number,
): { ok: boolean; pdf: string | null; log: string };
export declare function listTemplateKets(root?: string): Array<{ name: string; file: string; text: string }>;
