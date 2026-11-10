/**
 * Translation of MecHand's interface.
 *
 * Every language is one JSON file in ./locales (nested keys, plus a "_meta" block with the
 * language's name and the translators). en.json is the source: a key missing from another file
 * falls back to English, so a partial translation already works. To add a language, copy en.json
 * to <code>.json (e.g. fr.json), translate the values, and it appears in the language menu — see
 * docs/guide/translating.md. Ketcher's own toolbars are not translated by MecHand.
 *
 * Values may contain {placeholders} (filled from the params of t()), plural variants
 * ("key_one", "key_other", … chosen with Intl.PluralRules from params.count), and **bold**,
 * *italic* and `code` marks, rendered by <Rich>.
 */

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Tree = { [key: string]: string | string[] | Tree };
export type Params = Record<string, string | number>;

export interface Locale {
  code: string;
  /** The language's own name (Català, Español…). */
  name: string;
  dir: 'ltr' | 'rtl';
  authors: string[];
  messages: Record<string, string>;
}

/** Nested keys → "a.b.c" (the "_meta" block is skipped). */
export function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(tree)) {
    if (!prefix && k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (Array.isArray(v)) out[key] = v.join('\n');
    else flatten(v, key, out);
  }
  return out;
}

const files = import.meta.glob<Tree>('./locales/*.json', { eager: true, import: 'default' });

export const LOCALES: Locale[] = Object.entries(files)
  .map(([path, tree]) => {
    const meta = (tree._meta ?? {}) as Record<string, unknown>;
    const code = path.replace(/^.*\/(.+)\.json$/, '$1');
    return {
      code,
      name: typeof meta.name === 'string' ? meta.name : code,
      dir: meta.dir === 'rtl' ? 'rtl' : 'ltr',
      authors: Array.isArray(meta.authors) ? (meta.authors as string[]) : [],
      messages: flatten(tree),
    } as Locale;
  })
  .sort((a, b) => (a.code === 'en' ? -1 : b.code === 'en' ? 1 : a.name.localeCompare(b.name)));

export const SOURCE_LANGUAGE = 'en';
const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));
const STORAGE_KEY = 'mechand.lang.v1';

/** The best available language for a list of BCP 47 tags (exact, then base language), or English. */
export function pickLanguage(candidates: readonly (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const tag = c.toLowerCase();
    if (BY_CODE.has(tag)) return tag;
    const base = tag.split('-')[0];
    if (BY_CODE.has(base)) return base;
  }
  return SOURCE_LANGUAGE;
}

/**
 * ?lang=xx, then the language chosen before in this browser, then `fallback`, then the browser's
 * languages. With `fixed`, the fallback wins over a saved choice (study sessions on shared devices).
 */
export function initialLanguage(fallback?: string, fixed = false): string {
  const url = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');
  let saved: string | null = null;
  try {
    saved = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    saved = null;
  }
  const browser = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language];
  return pickLanguage(fixed ? [url, fallback] : [url, saved, fallback, ...browser]);
}

export function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (params[name] === undefined ? m : String(params[name])));
}

/** The text of `key` in `lang` (English if missing; the key itself if missing everywhere). */
export function translate(lang: string, key: string, params?: Params): string {
  const own = BY_CODE.get(lang)?.messages;
  const en = BY_CODE.get(SOURCE_LANGUAGE)?.messages ?? {};
  const look = (k: string) => own?.[k] ?? en[k];
  let text: string | undefined;
  if (params && typeof params.count === 'number') {
    let category = 'other';
    try {
      category = new Intl.PluralRules(lang).select(params.count);
    } catch {
      /* unknown locale: "other" */
    }
    text = look(`${key}_${category}`) ?? look(`${key}_other`);
  }
  text ??= look(key);
  return interpolate(text ?? key, params);
}

export type T = (key: string, params?: Params) => string;

/** Current language for code outside React components (kept in step with the provider). */
export const current = { lang: SOURCE_LANGUAGE };
export const t: T = (key, params) => translate(current.lang, key, params);

interface I18nCtx {
  lang: string;
  setLang: (code: string) => void;
  t: T;
}

const Ctx = createContext<I18nCtx>({ lang: SOURCE_LANGUAGE, setLang: () => {}, t });

export function I18nProvider({ initial, fixed = false, children }: { initial?: string; fixed?: boolean; children: ReactNode }) {
  const [lang, setLangState] = useState(() => initialLanguage(initial, fixed));
  current.lang = lang;
  useEffect(() => {
    const l = BY_CODE.get(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = l?.dir ?? 'ltr';
  }, [lang]);
  const setLang = useCallback((code: string) => {
    const c = pickLanguage([code]);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, c);
    } catch {
      /* not remembered */
    }
    current.lang = c;
    setLangState(c);
  }, []);
  const value = useMemo<I18nCtx>(() => ({ lang, setLang, t: (key, params) => translate(lang, key, params) }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The translation function of the current language (re-renders when the language changes). */
export const useT = () => useContext(Ctx);

/** Renders **bold**, *italic* and `code` marks of a translated text. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <b key={i}>{p.slice(2, -2)}</b>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <i key={i}>{p.slice(1, -1)}</i>;
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>;
        return p;
      })}
    </>
  );
}

/** Placeholders ({name}) used in a text, sorted (for checks of translations). */
export const placeholders = (s: string): string[] => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
