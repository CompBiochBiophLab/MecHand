/**
 * Tasks of the user study (see estudi/ in the repository).
 *
 * Two matched sets of three mechanisms, drawn once with MecHand's freehand mode and
 * once with Ketcher's own tools. Each pair has the same kind of chemistry and the
 * same number of curved arrows. The four groups counterbalance which set goes with
 * which condition and which condition comes first (crossover design).
 */

export type Condition = 'freehand' | 'ketcher';
export type Group = 'A1' | 'A2' | 'B1' | 'B2';

export interface StudyTask {
  id: string;
  /** Template shown as the target (src/templates/index.json id). */
  template: string;
  condition: Condition;
}

/** Matched pairs: [set A, set B]. */
const PAIRS: [string, string][] = [
  ['sn2', 'sicl4_hydrolysis'], // substitution, 2 arrows
  ['carbonyl_addition', 'lewis_adduct'], // addition to an electron acceptor
  ['diels_alder', 'e2'], // concerted, 3 arrows
];

const SET = { A: PAIRS.map((p) => p[0]), B: PAIRS.map((p) => p[1]) };

/** Group → [first block, second block]. */
const PLAN: Record<Group, [{ set: 'A' | 'B'; condition: Condition }, { set: 'A' | 'B'; condition: Condition }]> = {
  A1: [{ set: 'A', condition: 'freehand' }, { set: 'B', condition: 'ketcher' }],
  A2: [{ set: 'B', condition: 'ketcher' }, { set: 'A', condition: 'freehand' }],
  B1: [{ set: 'B', condition: 'freehand' }, { set: 'A', condition: 'ketcher' }],
  B2: [{ set: 'A', condition: 'ketcher' }, { set: 'B', condition: 'freehand' }],
};

export const GROUPS = Object.keys(PLAN) as Group[];

export function tasksFor(group: Group): StudyTask[] {
  return PLAN[group].flatMap((block, b) =>
    SET[block.set].map((template, k) => ({ id: `B${b + 1}T${k + 1}`, template, condition: block.condition })),
  );
}

export const CONDITION_LABEL: Record<Condition, string> = {
  freehand: 'MecHand: dibuix a mà alçada',
  ketcher: 'Només eines de Ketcher (sense dibuix a mà alçada)',
};
