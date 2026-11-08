/**
 * Compiles the TikZ and chemfig exports of every fixture and of every
 * src/templates/mechanisms/*.ket with pdflatex.
 *
 * Skipped unless MECHAND_LATEX=1 (run it with `npm run test:latex`), and
 * skipped with a message when pdflatex cannot be found.
 * Set MECHAND_LATEX_OUT=<dir> to keep the .tex/.pdf files.
 */
import { afterAll, describe, expect, it } from 'vitest';
import {
  compileTex,
  findPdflatex,
  latexCheckEnabled,
  listTemplateKets,
  makeOutDir,
  removeDir,
} from '../../scripts/latex-harness.mjs';
import { ALL_FIXTURES } from '../scene/__fixtures__/ketFixtures';
import { ketToScene } from '../scene/ketToScene';
import { CHEMFIG_PREAMBLE, toChemfig } from './chemfig';
import { TIKZ_PREAMBLE, toTikz } from './tikz';

const enabled = latexCheckEnabled();
const pdflatex = enabled ? findPdflatex() : null;
if (enabled && !pdflatex) {
  console.warn('[test:latex] pdflatex not found on PATH or in the usual TeX locations: skipping the LaTeX compile check.');
}

function standaloneDocument(tikz: string, chemfig: string): string {
  return [
    '\\documentclass[border=20pt,varwidth=60cm]{standalone}',
    TIKZ_PREAMBLE,
    CHEMFIG_PREAMBLE,
    '\\begin{document}',
    '\\noindent\\textbf{TikZ}\\par\\medskip',
    tikz,
    '\\par\\bigskip',
    '\\noindent\\textbf{chemfig}\\par\\bigskip',
    chemfig,
    '\\end{document}',
    '',
  ].join('\n');
}

describe.skipIf(!enabled || !pdflatex)('LaTeX compile check (pdflatex)', () => {
  const out = enabled && pdflatex ? makeOutDir() : { dir: '', keep: true };
  let failures = 0;
  const cases = [
    ...Object.entries(ALL_FIXTURES).map(([name, ket]) => ({ name: `fixture-${name}`, ket: ket as string | object })),
    ...listTemplateKets().map((t) => ({ name: `template-${t.name}`, ket: t.text as string | object })),
  ].map((c) => ({ ...c, name: c.name.replace(/[^A-Za-z0-9_-]/g, '_') }));

  afterAll(() => {
    if (out.keep) console.info(`[test:latex] .tex/.pdf files kept in ${out.dir}`);
    else if (failures) console.info(`[test:latex] failing .tex files kept in ${out.dir}`);
    else removeDir(out.dir);
  });

  it.each(cases)('$name compiles', ({ name, ket }) => {
    const scene = ketToScene(ket);
    const source = standaloneDocument(toTikz(scene), toChemfig(scene));
    const result = compileTex(pdflatex!, out.dir, name, source);
    if (!result.ok) failures++;
    expect(result.ok, `pdflatex failed for ${name} (${out.dir}/${name}.tex):\n${result.log}`).toBe(true);
  }, 120_000);
});
