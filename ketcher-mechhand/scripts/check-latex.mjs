#!/usr/bin/env node
/**
 * npm run test:latex
 *
 * Compiles the TikZ + chemfig exports of every test fixture and of every
 * src/templates/mechanisms/*.ket with pdflatex (see
 * src/export/latex.compile.test.ts). Exits 0 with a message when pdflatex is
 * not installed. Set MECHAND_LATEX_OUT=<dir> to keep the generated .tex/.pdf.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findPdflatex, projectRoot } from './latex-harness.mjs';

const pdflatex = findPdflatex();
if (!pdflatex) {
  console.log('[test:latex] pdflatex not found (PATH, /Library/TeX/texbin, /usr/local/texlive): skipping the LaTeX compile check.');
  process.exit(0);
}

const vitest = path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
if (!fs.existsSync(vitest)) {
  console.error('[test:latex] vitest is not installed; run npm install first.');
  process.exit(1);
}

console.log(`[test:latex] using ${pdflatex}`);
const env = {
  ...process.env,
  MECHAND_LATEX: '1',
  PATH: [path.dirname(pdflatex), process.env.PATH ?? ''].join(path.delimiter),
};
const result = spawnSync(
  process.execPath,
  [vitest, 'run', 'src/export/latex.compile.test.ts', ...process.argv.slice(2)],
  { cwd: projectRoot, env, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
