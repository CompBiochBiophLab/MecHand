/**
 * Translates the tooltips (title attributes) of Ketcher's own toolbars, which Ketcher only has in
 * English. Texts: src/i18n/ketcher/<code>.json, keyed by Ketcher's English text without the
 * shortcut in brackets ("Single Bond (1)" → "Single Bond"); the shortcut is kept. Element and ring
 * names come from the periodic-table and template translations.
 *
 * A MutationObserver re-translates whatever Ketcher renders or re-renders. The English original is
 * kept in data-mechand-title, so switching language works both ways. Texts without a translation
 * stay in English and are listed by window.mechandKetcherUntranslated() (to add them to the files).
 */

import { LIBRARY } from '../templates/library';
import { elementByEnglishName } from '../learn/periodic';
import { templateName } from './templateNames';
import { translate } from './i18n';

type Dict = Record<string, string>;
const files = import.meta.glob<Dict>('./ketcher/*.json', { eager: true, import: 'default' });
export const KETCHER_TITLES: Record<string, Dict> = Object.fromEntries(
  Object.entries(files).map(([path, d]) => {
    const { _meta, ...rest } = d as Dict & { _meta?: unknown };
    void _meta;
    return [path.replace(/^.*\/(.+)\.json$/, '$1'), rest];
  }),
);

const TEMPLATE_BY_NAME = new Map(LIBRARY.map((e) => [e.name, e]));
const ORIGINAL = 'data-mechand-title';
/** The title MecHand last wrote (to tell it from a new one set by Ketcher). */
const WRITTEN = 'data-mechand-title-set';
const untranslated = new Set<string>();

/** "Single Bond (1)" → ["Single Bond", " (1)"]. */
function split(title: string): [string, string] {
  const m = /^(.*?)(\s*\([^()]*\))?$/.exec(title);
  return [m?.[1] ?? title, m?.[2] ?? ''];
}

/** The translation of one Ketcher title, or null if there is none. */
export function translateKetcherTitle(title: string, lang: string): string | null {
  if (lang === 'en') return title;
  const [base, shortcut] = split(title);
  const own = KETCHER_TITLES[lang]?.[base] ?? KETCHER_TITLES[lang]?.[title];
  if (own) return KETCHER_TITLES[lang]?.[base] ? own + shortcut : own;
  const element = elementByEnglishName.get(base);
  if (element) {
    const name = translate(lang, `learn.element.${element.symbol}`);
    if (name !== `learn.element.${element.symbol}`) return name + shortcut;
  }
  const template = TEMPLATE_BY_NAME.get(base);
  if (template) {
    const name = templateName(template, lang);
    if (name !== template.name) return name + shortcut;
  }
  return null;
}

function apply(el: Element, lang: string): void {
  const now = el.getAttribute('title');
  if (now === null) return;
  let original = el.getAttribute(ORIGINAL);
  // A title we did not write ourselves is a new (English) one from Ketcher.
  if (original === null || now !== el.getAttribute(WRITTEN)) {
    original = now;
    el.setAttribute(ORIGINAL, original);
  }
  const translated = translateKetcherTitle(original, lang);
  if (translated === null && lang !== 'en') untranslated.add(split(original)[0]);
  const value = translated ?? original;
  el.setAttribute(WRITTEN, value);
  if (now !== value) el.setAttribute('title', value);
}

/**
 * Keeps the tooltips inside `root` (Ketcher's container) in the current language.
 * Returns a function that updates the language, and one that stops.
 */
export function translateKetcher(root: Element, initialLang: string): { setLang: (l: string) => void; stop: () => void } {
  let lang = initialLang;
  const all = () => root.querySelectorAll('[title]').forEach((el) => apply(el, lang));
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes' && r.target instanceof Element) apply(r.target, lang);
      else r.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.hasAttribute('title')) apply(n, lang);
        n.querySelectorAll('[title]').forEach((el) => apply(el, lang));
      });
    }
  });
  obs.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
  all();
  // Not window.mechand: tests wait for that one as the sign that the ink layer is ready.
  (globalThis as unknown as { mechandKetcherUntranslated: () => string[] }).mechandKetcherUntranslated = () => [...untranslated].sort();
  return {
    setLang: (l: string) => {
      lang = l;
      all();
    },
    stop: () => obs.disconnect(),
  };
}
