/**
 * Checks of the translation files (src/i18n/locales/*.json): every key exists in English (no typos),
 * placeholders match English, plural variants are well formed, and the languages shipped complete
 * stay complete. Partial contributed translations are allowed: missing texts fall back to English.
 */
import { describe, expect, it } from 'vitest';
import { LOCALES, SOURCE_LANGUAGE, flatten, pickLanguage, placeholders, translate } from './i18n';
import { HELP_SHORTCUTS } from '../ui/HelpSystem';
import { HELP_TOPICS } from '../ui/HelpCenter';
import { TOUR_STEPS } from '../ui/Tour';
import { ELEMENTS } from '../recognition/elements';

/** Languages that must translate every text (others may be partial). */
const COMPLETE = ['en', 'ca', 'es'];
const en = LOCALES.find((l) => l.code === SOURCE_LANGUAGE)!.messages;
const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (k: string) => k.replace(PLURAL, '');
const enBases = new Set(Object.keys(en).map(base));

describe('translations', () => {
  it('has the shipped languages with a name', () => {
    for (const code of COMPLETE) expect(LOCALES.find((l) => l.code === code)?.name).toBeTruthy();
    expect(LOCALES[0].code).toBe('en');
  });

  for (const locale of LOCALES) {
    describe(locale.code, () => {
      it('uses only keys that exist in English', () => {
        const unknown = Object.keys(locale.messages).filter((k) => !enBases.has(base(k)));
        expect(unknown).toEqual([]);
      });
      it('keeps the placeholders of the English texts', () => {
        const wrong = Object.entries(locale.messages).filter(([k, v]) => {
          const ref = en[k] ?? en[`${base(k)}_other`] ?? en[base(k)];
          if (ref === undefined) return false;
          const allowed = new Set([...placeholders(ref), 'count']);
          return placeholders(v).some((p) => !allowed.has(p)) || placeholders(ref).filter((p) => p !== 'count').some((p) => !placeholders(v).includes(p));
        }).map(([k]) => k);
        expect(wrong).toEqual([]);
      });
      if (COMPLETE.includes(locale.code)) {
        it('translates every text', () => {
          const missing = Object.keys(en).filter((k) => {
            if (locale.messages[k] !== undefined) return false;
            // Plural variants may differ between languages: one variant of the same key is enough.
            return !PLURAL.test(k) || !Object.keys(locale.messages).some((m) => base(m) === base(k));
          });
          expect(missing).toEqual([]);
        });
      }
    });
  }

  it('has a text for every key the code builds', () => {
    const keys = [
      ...Object.keys(HELP_SHORTCUTS).flatMap((id) => [`help.${id}.brief`, `help.${id}.student`]),
      ...HELP_TOPICS.flatMap((k) => [`helpCenter.topic.${k}.title`, `helpCenter.topic.${k}.body`]),
      ...TOUR_STEPS.map((s) => `helpCenter.tourSteps.${s.id}`),
      ...ELEMENTS.flatMap((e) => [`teach.element.${e.id}.label`, `teach.element.${e.id}.prompt`]),
    ];
    expect(keys.filter((k) => en[k] === undefined)).toEqual([]);
  });

  it('falls back to English, fills placeholders and picks plural forms', () => {
    expect(translate('ca', 'consolidate.atoms', { count: 1 })).toBe('1 àtom');
    expect(translate('ca', 'consolidate.atoms', { count: 3 })).toBe('3 àtoms');
    expect(translate('xx', 'toolbar.export')).toBe(en['toolbar.export']);
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
    expect(pickLanguage(['ca-ES', 'en'])).toBe('ca');
    expect(pickLanguage(['de-DE'])).toBe('en');
    expect(flatten({ a: { b: 'x', c: ['y', 'z'] } })).toEqual({ 'a.b': 'x', 'a.c': 'y\nz' });
  });
});
