/**
 * Node-side helpers for the LaTeX compile check (src/export/latex.compile.test.ts).
 * Kept in plain JS so the TypeScript app does not need Node type definitions;
 * see latex-harness.d.mts for the types.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** True when the compile check was requested (npm run test:latex sets MECHAND_LATEX=1). */
export const latexCheckEnabled = () => process.env.MECHAND_LATEX === '1';

/** Directories where TeX distributions usually put pdflatex, tried after $PATH. */
function extraTexDirs() {
  const dirs = ['/Library/TeX/texbin', '/usr/texbin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  const texlive = '/usr/local/texlive';
  if (fs.existsSync(texlive)) {
    for (const year of fs.readdirSync(texlive).sort().reverse()) {
      const bin = path.join(texlive, year, 'bin');
      if (!fs.existsSync(bin)) continue;
      for (const arch of fs.readdirSync(bin)) dirs.push(path.join(bin, arch));
    }
  }
  return dirs;
}

/** Absolute path of pdflatex, or null if it cannot be found. */
export function findPdflatex() {
  const exe = process.platform === 'win32' ? 'pdflatex.exe' : 'pdflatex';
  const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of [...pathDirs, ...extraTexDirs()]) {
    const candidate = path.join(dir, exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Output directory: $MECHAND_LATEX_OUT (kept) or a fresh temp dir (removed on success). */
export function makeOutDir() {
  const keep = process.env.MECHAND_LATEX_OUT;
  if (keep) {
    fs.mkdirSync(keep, { recursive: true });
    return { dir: path.resolve(keep), keep: true };
  }
  return { dir: fs.mkdtempSync(path.join(os.tmpdir(), 'mechand-latex-')), keep: false };
}

export function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** The part of a TeX log around the first error line ("! ..."), or its tail. */
function logExcerpt(log) {
  const lines = log.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith('!'));
  if (i < 0) return lines.slice(-40).join('\n');
  return lines.slice(Math.max(0, i - 3), i + 20).join('\n');
}

/**
 * Writes <dir>/<name>.tex and runs pdflatex `runs` times (twice by default so
 * that remember-picture overlays such as \chemmove are placed).
 * Returns { ok, pdf, log } where log is an excerpt on failure.
 */
export function compileTex(pdflatex, dir, name, source, runs = 2) {
  fs.writeFileSync(path.join(dir, `${name}.tex`), source);
  for (let i = 0; i < runs; i++) {
    const r = spawnSync(pdflatex, ['-interaction=nonstopmode', '-halt-on-error', `${name}.tex`], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 120000,
    });
    if (r.status !== 0) {
      const logFile = path.join(dir, `${name}.log`);
      const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : `${r.stdout ?? ''}${r.stderr ?? ''}`;
      return { ok: false, pdf: null, log: logExcerpt(log || String(r.error ?? 'pdflatex failed')) };
    }
  }
  return { ok: true, pdf: path.join(dir, `${name}.pdf`), log: '' };
}

/** Every src/templates/mechanisms/*.ket that exists right now. */
export function listTemplateKets(root = projectRoot) {
  const dir = path.join(root, 'src', 'templates', 'mechanisms');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ket'))
    .sort()
    .map((f) => ({
      name: f.replace(/\.ket$/, ''),
      file: path.join(dir, f),
      text: fs.readFileSync(path.join(dir, f), 'utf8'),
    }));
}
