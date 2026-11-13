/**
 * Checks of the level configuration (src/config/levels.json) and of the texts that go with it:
 * template names in every shipped language, Ketcher's tooltips, the chemistry explanations.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_IDS, templateAllowed } from './levels';
import { LIBRARY } from '../templates/library';
import { TEMPLATE_NAMES } from '../i18n/templateNames';
import { KETCHER_TITLES, translateKetcherTitle } from '../i18n/ketcherTitles';
import { LOCALES, translate } from '../i18n/i18n';
import { LEARN_TOPICS } from '../ui/HelpCenter';
import { PERIODIC, usualBonds, usualLonePairs, valenceElectrons } from '../learn/periodic';
import { explainArrows } from '../learn/explain';
import type { Scene } from '../scene/types';

const SHIPPED = ['ca', 'es'];
const ids = new Set(LIBRARY.map((e) => e.id));

describe('levels.json', () => {
  it('only names templates that exist', () => {
    expect(LEVELS.basicTemplates.filter((id) => !ids.has(id))).toEqual([]);
  });
  it('gives level A fewer templates than B and C', () => {
    const count = (l: 'A' | 'B' | 'C') => LIBRARY.filter((e) => templateAllowed(l, e.id)).length;
    expect(count('A')).toBeGreaterThan(20);
    expect(count('A')).toBeLessThan(count('B'));
    expect(count('C')).toBe(LIBRARY.length);
  });
  it('lets the researcher use everything', () => {
    const c = LEVELS.levels.C;
    expect([c.templates, c.periodicTable, c.onlineLookup, c.teach, c.recognitionServer, c.imageImport]).toEqual(['all', true, true, true, true, true]);
    expect(c.learnHelp).not.toBe('off');
    expect(c.export).toHaveLength(6);
  });
  it('has a name and a description of every level in every language', () => {
    for (const l of LOCALES.filter((x) => ['en', ...SHIPPED].includes(x.code))) {
      for (const id of LEVEL_IDS) for (const k of ['name', 'short', 'who', 'what']) expect(l.messages[`level.${id}.${k}`], `${l.code} level.${id}.${k}`).toBeTruthy();
    }
  });
});

describe('template names', () => {
  for (const lang of SHIPPED) {
    it(`has every template in ${lang}`, () => {
      const names = TEMPLATE_NAMES[lang] ?? {};
      expect(LIBRARY.filter((e) => !names[e.id]?.name).map((e) => e.id)).toEqual([]);
      expect(LIBRARY.filter((e) => e.description && !names[e.id]?.description).map((e) => e.id)).toEqual([]);
      expect(Object.keys(names).filter((id) => !ids.has(id))).toEqual([]);
    });
  }
});

describe("Ketcher's tooltips", () => {
  it('translates the same texts in every shipped language', () => {
    const keys = (l: string) => Object.keys(KETCHER_TITLES[l] ?? {}).sort();
    for (const l of SHIPPED) expect(keys(l)).toEqual(keys('ca'));
  });
  it('keeps the shortcut and translates elements and rings', () => {
    expect(translateKetcherTitle('Single Bond (1)', 'ca')).toBe('Enllaç simple (1)');
    expect(translateKetcherTitle('Carbon (C)', 'es')).toBe('Carbono (C)');
    expect(translateKetcherTitle('Benzene (T)', 'ca')).toBe('Benzè (T)');
    expect(translateKetcherTitle('Single Bond (1)', 'en')).toBe('Single Bond (1)');
    expect(translateKetcherTitle('Something new', 'ca')).toBeNull();
  });
});

describe('chemistry explanations', () => {
  it('has every topic and element in every language', () => {
    for (const lang of ['en', ...SHIPPED]) {
      for (const k of LEARN_TOPICS) expect(translate(lang, `learn.topic.${k}.body`)).not.toContain('learn.topic');
      for (const e of PERIODIC) expect(translate(lang, `learn.element.${e.symbol}`)).not.toBe(`learn.element.${e.symbol}`);
    }
  });
  it('knows the usual bonds and lone pairs', () => {
    const by = (s: string) => PERIODIC.find((e) => e.symbol === s)!;
    expect([valenceElectrons(by('C')), usualBonds(by('C')), usualLonePairs(by('C'))]).toEqual([4, 4, 0]);
    expect([valenceElectrons(by('N')), usualBonds(by('N')), usualLonePairs(by('N'))]).toEqual([5, 3, 1]);
    expect([valenceElectrons(by('O')), usualBonds(by('O')), usualLonePairs(by('O'))]).toEqual([6, 2, 2]);
    expect([valenceElectrons(by('Cl')), usualBonds(by('Cl')), usualLonePairs(by('Cl'))]).toEqual([7, 1, 3]);
    expect(valenceElectrons(by('Fe'))).toBeUndefined();
  });
  it('explains an SN2 step', () => {
    // HO⁻ attacks C, C–Br breaks onto Br.
    const scene: Scene = {
      atoms: [
        { symbol: 'O', x: 0, y: 0, charge: -1 },
        { symbol: 'C', x: 2, y: 0, charge: 0 },
        { symbol: 'Br', x: 3, y: 0, charge: 0 },
      ],
      bonds: [{ begin: 1, end: 2, order: 1 }],
      arrows: [],
      pluses: [],
    } as unknown as Scene;
    const pair = { kind: 'electron-pair', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, mode: '' } as const;
    const ex = explainArrows(scene, [
      { arrow: pair, from: { type: 'atom', atom: 0 }, to: { type: 'atom', atom: 1 } },
      { arrow: pair, from: { type: 'bond', bond: 0 }, to: { type: 'atom', atom: 2 } },
    ]);
    expect(ex.map((e) => e.key)).toEqual(['learn.explain.pairAtomAtom', 'learn.explain.pairBondAtomOwn']);
    expect(translate('ca', ex[0].key, ex[0].params)).toContain('O1');
  });
});
