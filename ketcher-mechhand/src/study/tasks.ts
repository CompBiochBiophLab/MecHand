/**
 * Tasks of the user study (see estudi/ in the repository).
 *
 * The stimuli are openly licensed images (Wikimedia Commons, see stimuli.json and
 * estudi/estimuls/ATRIBUCIONS.md) that participants reproduce in MecHand. Two
 * matched sets (A, B), each with two molecules (one simple, one with fused rings)
 * and two mechanisms (an SN2 step with two curved arrows and the first line of an
 * aldol mechanism), are drawn once with MecHand's freehand mode and once with
 * Ketcher's own tools. The four groups counterbalance which set goes with which
 * condition and which condition comes first (crossover design); within a block the
 * four tasks come in a random order, drawn for each participant. Each block starts
 * with the same practice item (an acid–base step with two curved arrows), which is
 * not analysed.
 */

import stimuli from './stimuli.json';

export type Condition = 'freehand' | 'ketcher';
export type Group = 'A1' | 'A2' | 'B1' | 'B2';

export interface Stimulus {
  id: string;
  set: 'practica' | 'A' | 'B';
  kind: 'molecula' | 'mecanisme';
  /** Image file in public/study/. */
  file: string;
  /** What to draw (Catalan). */
  task: string;
  reference: { smiles: string[]; curvedArrows: number };
  source: { title: string; url: string; author: string; license: string; licenseUrl: string | null };
}

export const STIMULI = stimuli as Stimulus[];

export interface StudyTask {
  /** B{block}T{k}; T0 is the practice item. */
  id: string;
  stimulus: string;
  condition: Condition;
  block: 1 | 2;
  practice: boolean;
}

const SET = {
  A: STIMULI.filter((s) => s.set === 'A').map((s) => s.id),
  B: STIMULI.filter((s) => s.set === 'B').map((s) => s.id),
};
const PRACTICE = STIMULI.find((s) => s.set === 'practica')!.id;

/** Group → [first block, second block]. */
const PLAN: Record<Group, [{ set: 'A' | 'B'; condition: Condition }, { set: 'A' | 'B'; condition: Condition }]> = {
  A1: [{ set: 'A', condition: 'freehand' }, { set: 'B', condition: 'ketcher' }],
  A2: [{ set: 'B', condition: 'ketcher' }, { set: 'A', condition: 'freehand' }],
  B1: [{ set: 'B', condition: 'freehand' }, { set: 'A', condition: 'ketcher' }],
  B2: [{ set: 'A', condition: 'ketcher' }, { set: 'B', condition: 'freehand' }],
};

export const GROUPS = Object.keys(PLAN) as Group[];

/** Fisher–Yates shuffle with the given source of random numbers in [0, 1). */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A uniform random number from the browser's cryptographic generator. */
export function cryptoRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/** The ten tasks of a participant: per block, the practice item and the set's four tasks in random order. */
export function tasksFor(group: Group, random: () => number = cryptoRandom): StudyTask[] {
  return PLAN[group].flatMap((block, b) => {
    const n = (b + 1) as 1 | 2;
    return [
      { id: `B${n}T0`, stimulus: PRACTICE, condition: block.condition, block: n, practice: true },
      ...shuffled(SET[block.set], random).map((stimulus, k) => ({ id: `B${n}T${k + 1}`, stimulus, condition: block.condition, block: n, practice: false })),
    ];
  });
}

export const stimulus = (id: string): Stimulus => STIMULI.find((s) => s.id === id)!;

export const CONDITION_LABEL: Record<Condition, string> = {
  freehand: 'MecHand: dibuix a mà alçada (pots corregir amb les eines de Ketcher)',
  ketcher: 'Només eines de Ketcher (sense dibuix a mà alçada)',
};
