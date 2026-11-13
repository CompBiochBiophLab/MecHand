/**
 * User levels: what each kind of user sees and can use.
 *
 *   A  Student — secondary school and first years of a degree: basic templates, chemistry
 *      explanations on from the start, the simple periodic table.
 *   B  Advanced student — end of a degree, master's, start of a PhD: the whole library.
 *   C  Researcher — everything, including the chemistry explanations of level A if wanted.
 *
 * What each level includes is NOT in this file: it is in src/config/levels.json (checked against
 * levels.schema.json as you type in VS Code, and by `npm run check:content`). The level is chosen
 * on first use and in the toolbar; `?level=A|B|C` in the address fixes it (handy for a class link).
 * The user study (?study=1) always runs as level C with the explanations off, as before.
 */

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import config from '../config/levels.json';

export type LevelId = 'A' | 'B' | 'C';
export const LEVEL_IDS: LevelId[] = ['A', 'B', 'C'];
export type ExportFormat = 'tikz' | 'chemfig' | 'cdxml' | 'mol' | 'ket' | 'smiles';

export interface LevelFeatures {
  templates: 'basic' | 'all';
  learnHelp: 'on' | 'available' | 'off';
  periodicTable: boolean;
  onlineLookup: boolean;
  teach: boolean;
  recognitionServer: boolean;
  imageImport: boolean;
  helpDetail: 'student' | 'brief';
  export: ExportFormat[];
}

interface LevelsConfig {
  default: LevelId;
  levels: Record<LevelId, LevelFeatures>;
  basicTemplates: string[];
}

export const LEVELS = config as unknown as LevelsConfig;
const BASIC = new Set(LEVELS.basicTemplates);

/** Whether a template (library entry id) is offered at a level. */
export const templateAllowed = (level: LevelId, id: string): boolean =>
  LEVELS.levels[level].templates === 'all' || BASIC.has(id);

const LEVEL_KEY = 'mechand.level.v1';
const LEARN_KEY = 'mechand.learn.v1';

const isLevel = (s: unknown): s is LevelId => s === 'A' || s === 'B' || s === 'C';

function stored(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function store(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* not remembered */
  }
}

/** Level fixed by the address (?level=A), if any. */
export function urlLevel(): LevelId | null {
  if (typeof location === 'undefined') return null;
  const l = new URLSearchParams(location.search).get('level')?.toUpperCase();
  return isLevel(l) ? l : null;
}

/** True when the user has never chosen a level (and the address does not fix one). */
export const levelUnchosen = (): boolean => !urlLevel() && !isLevel(stored(LEVEL_KEY));

interface LevelCtx {
  level: LevelId;
  features: LevelFeatures;
  setLevel: (l: LevelId) => void;
  /** Chemistry explanations shown now (level "on", or "available" and turned on by the user). */
  learn: boolean;
  /** The user may turn the explanations on or off (level "available"). */
  learnSwitchable: boolean;
  setLearn: (on: boolean) => void;
  /** Level fixed (?level= or study mode): no level menu. */
  fixed: boolean;
}

const Ctx = createContext<LevelCtx>({
  level: 'C', features: LEVELS.levels.C, setLevel: () => {}, learn: false, learnSwitchable: false, setLearn: () => {}, fixed: true,
});

export function LevelProvider({ study = false, children }: { study?: boolean; children: ReactNode }) {
  const forced = study ? 'C' : urlLevel();
  const [chosen, setChosen] = useState<LevelId>(() => {
    const s = stored(LEVEL_KEY);
    return isLevel(s) ? s : LEVELS.default;
  });
  const level = forced ?? chosen;
  const [learnPref, setLearnPref] = useState(() => stored(LEARN_KEY) === 'on');
  const setLevel = useCallback((l: LevelId) => {
    store(LEVEL_KEY, l);
    setChosen(l);
  }, []);
  const setLearn = useCallback((on: boolean) => {
    store(LEARN_KEY, on ? 'on' : 'off');
    setLearnPref(on);
  }, []);
  const value = useMemo<LevelCtx>(() => {
    const features = LEVELS.levels[level];
    const mode = study ? 'off' : features.learnHelp;
    return {
      level, features, setLevel, setLearn, fixed: Boolean(forced),
      learn: mode === 'on' || (mode === 'available' && learnPref),
      learnSwitchable: mode === 'available',
    };
  }, [level, study, learnPref, setLevel, setLearn, forced]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLevel = () => useContext(Ctx);
