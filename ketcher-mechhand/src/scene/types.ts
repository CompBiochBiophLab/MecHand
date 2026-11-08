/**
 * Scene: MecHand's format-neutral description of a drawing (structures + arrows).
 *
 * It is produced from Ketcher's native KET JSON (ketcher.getKet()) and from the
 * handwriting recognizer, and consumed by the LaTeX exporters.
 *
 * Coordinate convention — identical to KET:
 *   - Units are Ketcher units: a standard bond is ~1.0 long.
 *   - y points UP (KET stores y up; Ketcher inverts it internally).
 */

export interface Point {
  x: number;
  y: number;
}

export interface SceneAtom {
  /** Element symbol or label ("C", "O", "Cl", "Pt", "R", "OMe"...). */
  symbol: string;
  x: number;
  y: number;
  /** Formal charge (0 if neutral). */
  charge: number;
  /** 0 = none, 1 = singlet, 2 = doublet (radical dot), 3 = triplet (as in KET). */
  radical?: number;
  isotope?: number;
  /** Index of the connected component (molecule) this atom belongs to. */
  molecule: number;
}

/** order: 1 single, 2 double, 3 triple, 4 aromatic. */
export interface SceneBond {
  begin: number;
  end: number;
  order: 1 | 2 | 3 | 4;
  /** Stereo wedge, pointing from `begin` (narrow) to `end` (wide). */
  stereo?: 'up' | 'down';
}

export type ArrowKind =
  | 'electron-pair'     // curved, full head: movement of 2 electrons
  | 'single-electron'   // curved, half head (fishhook): 1 electron
  | 'reaction'          // straight, reactants → products
  | 'equilibrium'       // straight, double harpoon
  | 'other';

export interface SceneArrow {
  kind: ArrowKind;
  start: Point;
  end: Point;
  /**
   * Curved arrows only: signed bulge of the arc, in Ketcher units, measured
   * perpendicular to start→end. Positive = bulge to the LEFT of the direction
   * start→end (counter-clockwise side) in the y-up frame.
   */
  height?: number;
  /** Raw KET arrow mode, kept for round-tripping. */
  mode: string;
}

export interface Scene {
  atoms: SceneAtom[];
  bonds: SceneBond[];
  arrows: SceneArrow[];
  pluses: Point[];
}

export const emptyScene = (): Scene => ({ atoms: [], bonds: [], arrows: [], pluses: [] });
