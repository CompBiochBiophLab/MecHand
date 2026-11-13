/**
 * Data of the simple periodic table (level A): the first five periods, with what a first-year
 * student needs to draw structures and mechanisms. Names and explanations are translated in
 * src/i18n/locales/learn/<code>.json (learn.element.<symbol>, learn.family.<family>).
 */

export type Family =
  | 'alkali' | 'alkaline-earth' | 'transition' | 'post-transition' | 'metalloid' | 'nonmetal' | 'halogen' | 'noble';

export interface ElementInfo {
  z: number;
  symbol: string;
  /** English name (Ketcher's tooltips use it). */
  name: string;
  period: number;
  group: number;
  family: Family;
  /** Pauling electronegativity (undefined for He, Ne, Ar). */
  en?: number;
}

const ROWS: [number, string, string, number, number, Family, number?][] = [
  [1, 'H', 'Hydrogen', 1, 1, 'nonmetal', 2.2],
  [2, 'He', 'Helium', 1, 18, 'noble'],
  [3, 'Li', 'Lithium', 2, 1, 'alkali', 0.98],
  [4, 'Be', 'Beryllium', 2, 2, 'alkaline-earth', 1.57],
  [5, 'B', 'Boron', 2, 13, 'metalloid', 2.04],
  [6, 'C', 'Carbon', 2, 14, 'nonmetal', 2.55],
  [7, 'N', 'Nitrogen', 2, 15, 'nonmetal', 3.04],
  [8, 'O', 'Oxygen', 2, 16, 'nonmetal', 3.44],
  [9, 'F', 'Fluorine', 2, 17, 'halogen', 3.98],
  [10, 'Ne', 'Neon', 2, 18, 'noble'],
  [11, 'Na', 'Sodium', 3, 1, 'alkali', 0.93],
  [12, 'Mg', 'Magnesium', 3, 2, 'alkaline-earth', 1.31],
  [13, 'Al', 'Aluminium', 3, 13, 'post-transition', 1.61],
  [14, 'Si', 'Silicon', 3, 14, 'metalloid', 1.9],
  [15, 'P', 'Phosphorus', 3, 15, 'nonmetal', 2.19],
  [16, 'S', 'Sulfur', 3, 16, 'nonmetal', 2.58],
  [17, 'Cl', 'Chlorine', 3, 17, 'halogen', 3.16],
  [18, 'Ar', 'Argon', 3, 18, 'noble'],
  [19, 'K', 'Potassium', 4, 1, 'alkali', 0.82],
  [20, 'Ca', 'Calcium', 4, 2, 'alkaline-earth', 1.0],
  [21, 'Sc', 'Scandium', 4, 3, 'transition', 1.36],
  [22, 'Ti', 'Titanium', 4, 4, 'transition', 1.54],
  [23, 'V', 'Vanadium', 4, 5, 'transition', 1.63],
  [24, 'Cr', 'Chromium', 4, 6, 'transition', 1.66],
  [25, 'Mn', 'Manganese', 4, 7, 'transition', 1.55],
  [26, 'Fe', 'Iron', 4, 8, 'transition', 1.83],
  [27, 'Co', 'Cobalt', 4, 9, 'transition', 1.88],
  [28, 'Ni', 'Nickel', 4, 10, 'transition', 1.91],
  [29, 'Cu', 'Copper', 4, 11, 'transition', 1.9],
  [30, 'Zn', 'Zinc', 4, 12, 'transition', 1.65],
  [31, 'Ga', 'Gallium', 4, 13, 'post-transition', 1.81],
  [32, 'Ge', 'Germanium', 4, 14, 'metalloid', 2.01],
  [33, 'As', 'Arsenic', 4, 15, 'metalloid', 2.18],
  [34, 'Se', 'Selenium', 4, 16, 'nonmetal', 2.55],
  [35, 'Br', 'Bromine', 4, 17, 'halogen', 2.96],
  [36, 'Kr', 'Krypton', 4, 18, 'noble', 3.0],
  [37, 'Rb', 'Rubidium', 5, 1, 'alkali', 0.82],
  [38, 'Sr', 'Strontium', 5, 2, 'alkaline-earth', 0.95],
  [39, 'Y', 'Yttrium', 5, 3, 'transition', 1.22],
  [40, 'Zr', 'Zirconium', 5, 4, 'transition', 1.33],
  [41, 'Nb', 'Niobium', 5, 5, 'transition', 1.6],
  [42, 'Mo', 'Molybdenum', 5, 6, 'transition', 2.16],
  [43, 'Tc', 'Technetium', 5, 7, 'transition', 1.9],
  [44, 'Ru', 'Ruthenium', 5, 8, 'transition', 2.2],
  [45, 'Rh', 'Rhodium', 5, 9, 'transition', 2.28],
  [46, 'Pd', 'Palladium', 5, 10, 'transition', 2.2],
  [47, 'Ag', 'Silver', 5, 11, 'transition', 1.93],
  [48, 'Cd', 'Cadmium', 5, 12, 'transition', 1.69],
  [49, 'In', 'Indium', 5, 13, 'post-transition', 1.78],
  [50, 'Sn', 'Tin', 5, 14, 'post-transition', 1.96],
  [51, 'Sb', 'Antimony', 5, 15, 'metalloid', 2.05],
  [52, 'Te', 'Tellurium', 5, 16, 'metalloid', 2.1],
  [53, 'I', 'Iodine', 5, 17, 'halogen', 2.66],
  [54, 'Xe', 'Xenon', 5, 18, 'noble', 2.6],
];

export const PERIODIC: ElementInfo[] = ROWS.map(([z, symbol, name, period, group, family, en]) => ({ z, symbol, name, period, group, family, en }));
export const FAMILIES: Family[] = ['alkali', 'alkaline-earth', 'transition', 'post-transition', 'metalloid', 'nonmetal', 'halogen', 'noble'];

/** Valence electrons of a main-group element (undefined for transition metals). */
export function valenceElectrons(e: ElementInfo): number | undefined {
  if (e.symbol === 'He') return 2;
  if (e.group <= 2) return e.group;
  if (e.group >= 13) return e.group - 10;
  return undefined;
}

/** Usual number of bonds of a neutral atom in organic and simple inorganic molecules. */
export function usualBonds(e: ElementInfo): number | undefined {
  const v = valenceElectrons(e);
  if (v === undefined || e.family === 'noble') return undefined;
  if (e.symbol === 'H') return 1;
  if (v <= 4) return v;
  return 8 - v;
}

/** Lone pairs of a neutral atom with its usual number of bonds (C 0, N 1, O 2, halogens 3). */
export function usualLonePairs(e: ElementInfo): number | undefined {
  const v = valenceElectrons(e);
  const b = usualBonds(e);
  if (v === undefined || b === undefined || v < 4) return undefined;
  return (v - b) / 2;
}

export const elementBySymbol = new Map(PERIODIC.map((e) => [e.symbol, e]));
export const elementByEnglishName = new Map(PERIODIC.map((e) => [e.name, e]));
