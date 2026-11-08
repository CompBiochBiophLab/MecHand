/**
 * TikzExporter.ts
 * Exports a MecHand scene (atoms, bonds, mechanism arrows) as a
 * self-contained tikz/chemfig fragment ready to paste into LaTeX.
 *
 * Unlike the chemfig exporter (which uses angle-relative notation),
 * TikZ uses absolute coordinates — much simpler to generate, easier
 * to edit by hand, and better suited to complex mechanism diagrams
 * with many curved arrows.
 *
 * Output is a tikzpicture environment that requires:
 *   \usepackage{tikz}
 *   \usepackage{chemmacros}   % for \charge, \delp, \delm etc.
 */

import { AtomResult, BondResult, ArrowResult } from '../../recognition/MolScribeClient';

// ── Coordinate normalisation ──────────────────────────────────────────────────

/** Scale factor: Ketcher internal units → Å-like tikz cm */
const SCALE = 0.035;

function tx(x: number): string { return (x * SCALE).toFixed(3); }
function ty(y: number): string { return (-y * SCALE).toFixed(3); } // flip y

// ── Bond style map ────────────────────────────────────────────────────────────

const BOND_STYLE: Record<BondResult['type'], string> = {
  single:   '',
  double:   'double distance=1.5pt',
  triple:   'double distance=3pt',  // approximation
  aromatic: 'dashed',
  wedge:    'line width=3pt, line cap=round',
  dash:     'dashed, line width=1pt',
};

// ── Atom label ────────────────────────────────────────────────────────────────

function atomLabel(a: AtomResult): string {
  if (a.symbol === 'C') return ''; // implicit carbon
  let label = `\\text{${a.symbol}}`;
  if (a.charge) {
    const ch = a.charge > 0 ? `$^{+${a.charge === 1 ? '' : a.charge}}$`
                             : `$^{${a.charge}}$`;
    label += ch;
  }
  if (a.isotope) label = `$^{${a.isotope}}$${label}`;
  return label;
}

// ── Main exporter ─────────────────────────────────────────────────────────────

export interface TikzExportOptions {
  /** Add \begin{tikzpicture}...\end{tikzpicture} wrapper (default true) */
  wrapEnvironment?: boolean;
  /** Scale multiplier on top of SCALE (default 1) */
  extraScale?: number;
  /** Include a small axis for debugging (default false) */
  debugAxes?: boolean;
}

export function toTikz(
  atoms: AtomResult[],
  bonds: BondResult[],
  arrows: ArrowResult[],
  opts: TikzExportOptions = {}
): string {
  const wrap = opts.wrapEnvironment ?? true;
  const lines: string[] = [];

  if (wrap) lines.push('\\begin{tikzpicture}[>=stealth, semithick]');

  if (opts.debugAxes) {
    lines.push('  \\draw[gray!30, ->] (0,0) -- (3,0) node[right]{x};');
    lines.push('  \\draw[gray!30, ->] (0,0) -- (0,3) node[above]{y};');
  }

  // ── Bonds first (drawn beneath atoms) ────────────────────────────────────
  for (const bond of bonds) {
    const a = atoms[bond.beginAtom];
    const b = atoms[bond.endAtom];
    if (!a || !b) continue;
    const style = BOND_STYLE[bond.type] || '';
    lines.push(
      `  \\draw[${style}] (${tx(a.x)},${ty(a.y)}) -- (${tx(b.x)},${ty(b.y)});`
    );
  }

  // ── Atoms ─────────────────────────────────────────────────────────────────
  for (const atom of atoms) {
    const label = atomLabel(atom);
    if (!label) continue; // skip implicit carbons
    lines.push(
      `  \\node at (${tx(atom.x)},${ty(atom.y)}) {${label}};`
    );
  }

  // ── Mechanism arrows (curved) ──────────────────────────────────────────────
  for (const arrow of arrows) {
    // The backend returns an SVG path; we convert the first M/C segments
    // to a TikZ curve. For now we emit a placeholder comment if path
    // parsing is not yet implemented.
    if (arrow.path) {
      lines.push(`  % Mechanism arrow: ${arrow.path.substring(0, 60)}...`);
      lines.push(`  % TODO: convert SVG path to \\draw[->] .. controls ..;`);
    } else if (arrow.fromAtom !== undefined && arrow.toAtom !== undefined) {
      const a = atoms[arrow.fromAtom];
      const b = atoms[arrow.toAtom];
      lines.push(
        `  \\draw[->, bend left=40] (${tx(a.x)},${ty(a.y)}) to (${tx(b.x)},${ty(b.y)});`
      );
    }
  }

  if (wrap) lines.push('\\end{tikzpicture}');

  return lines.join('\n');
}

// ── LaTeX preamble helper ─────────────────────────────────────────────────────

export function tikzPreamble(): string {
  return [
    '% MecHand TikZ export — add to your LaTeX preamble:',
    '\\usepackage{tikz}',
    '\\usetikzlibrary{arrows.meta, bending, decorations.pathmorphing}',
    '\\usepackage{chemmacros}',
    '\\usepackage{chemfig}',
  ].join('\n');
}
