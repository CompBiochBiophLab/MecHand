#!/usr/bin/env node
/**
 * Checks the editable content of MecHand and prints each problem as
 *   path:line:column: error|warning: message
 * so that VS Code shows it in the Problems panel (task "MecHand: check texts and levels").
 *
 *   - Interface texts: src/i18n/locales/<code>.json and src/i18n/locales/<subject>/<code>.json.
 *     Catalan and Spanish must have every English key, no unknown keys, the same {placeholders};
 *     a text identical to English is a warning (forgotten translation?) unless listed in the file's
 *     "_meta": { "sameAsEnglish": [...] }.
 *   - Template names: src/i18n/templates/<code>.json must name every template of
 *     src/templates/library.json and index.json.
 *   - Ketcher's tooltips: src/i18n/ketcher/<code>.json must translate the same texts in every language.
 *   - Levels: src/config/levels.json must only name templates that exist.
 *
 * Usage: node scripts/check-content.mjs [--watch]
 */

import { existsSync, readFileSync, readdirSync, watch } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const SHIPPED = ['ca', 'es'];
const SOURCE = 'en';
/** Texts that may stay as in English (proper names, codes, words that are the same). */
const SAME_OK = /^(\s*|[A-Z0-9 ·+\-–()./%:{}]+|v\{\w+\}|.{0,4})$/;

let problems = [];
const report = (file, line, severity, message) =>
  problems.push(`${relative(process.cwd(), file)}:${line}:1: ${severity}: ${message}`);

/** Line of every key path ("a.b.c") in a pretty-printed JSON file (2-space indentation). */
function keyLines(text) {
  const lines = new Map();
  const stack = [];
  text.split('\n').forEach((line, i) => {
    const m = /^(\s*)"([^"]+)"\s*:/.exec(line);
    if (!m) return;
    const depth = Math.max(0, m[1].length / 2 - 1);
    stack.length = depth;
    stack[depth] = m[2];
    lines.set(stack.join('.'), i + 1);
  });
  return lines;
}

function load(file) {
  const text = readFileSync(file, 'utf8');
  try {
    return { data: JSON.parse(text), lines: keyLines(text) };
  } catch (e) {
    const pos = /position (\d+)/.exec(String(e))?.[1];
    const line = pos ? text.slice(0, Number(pos)).split('\n').length : 1;
    report(file, line, 'error', `invalid JSON: ${e.message}`);
    return null;
  }
}

function flatten(tree, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(tree)) {
    if (!prefix && k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (Array.isArray(v)) out[key] = v.join('\n');
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (k) => k.replace(PLURAL, '');
const placeholders = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
/** Line of a key, or of its nearest parent present in the file. */
function lineOf(lines, key) {
  for (let k = key; k; k = k.includes('.') ? k.slice(0, k.lastIndexOf('.')) : '') if (lines.has(k)) return lines.get(k);
  return 1;
}

function checkLocaleSet(dir, label) {
  const en = join(dir, `${SOURCE}.json`);
  if (!existsSync(en)) return;
  const src = load(en);
  if (!src) return;
  const enFlat = flatten(src.data);
  const enBases = new Set(Object.keys(enFlat).map(base));
  for (const code of SHIPPED) {
    const file = join(dir, `${code}.json`);
    if (!existsSync(file)) {
      report(en, 1, 'error', `${label}: there is no ${code}.json next to this file (copy en.json and translate it)`);
      continue;
    }
    const tr = load(file);
    if (!tr) continue;
    const flat = flatten(tr.data);
    // Keys checked by a person and the same as in English on purpose: "_meta": { "sameAsEnglish": [...] }.
    const same = new Set(tr.data._meta?.sameAsEnglish ?? []);
    for (const [k, v] of Object.entries(enFlat)) {
      const has = flat[k] !== undefined || (PLURAL.test(k) && Object.keys(flat).some((m) => base(m) === base(k)));
      if (!has) {
        report(file, lineOf(tr.lines, k), 'error', `missing translation of "${k}" (English: ${JSON.stringify(v).slice(0, 90)})`);
        continue;
      }
      if (flat[k] === undefined) continue;
      const want = placeholders(v).filter((p) => p !== 'count');
      const got = placeholders(flat[k]);
      const lost = want.filter((p) => !got.includes(p));
      const extra = got.filter((p) => p !== 'count' && !placeholders(v).includes(p));
      if (lost.length || extra.length) {
        report(file, lineOf(tr.lines, k), 'error', `"${k}": placeholders must match English (${placeholders(v).map((p) => `{${p}}`).join(' ') || 'none'})`);
      }
      if (flat[k] === v && !SAME_OK.test(v) && !same.has(k)) {
        report(file, lineOf(tr.lines, k), 'warning', `"${k}" is the same as in English: not translated yet? (if it is right, add it to _meta.sameAsEnglish)`);
      }
    }
    for (const k of Object.keys(flat)) {
      if (!enBases.has(base(k))) report(file, lineOf(tr.lines, k), 'error', `"${k}" does not exist in English (typo, or add it to ${relative(process.cwd(), en)})`);
    }
  }
}

function checkTemplates() {
  const lib = JSON.parse(readFileSync(join(SRC, 'templates/library.json'), 'utf8'));
  const mech = JSON.parse(readFileSync(join(SRC, 'templates/index.json'), 'utf8'));
  const entries = [...lib.map((e) => ({ id: e.id, name: e.name })), ...mech.map((m) => ({ id: `mech-${m.id}`, name: m.title, mechanism: true }))];
  const ids = new Set(entries.map((e) => e.id));
  for (const code of SHIPPED) {
    const file = join(SRC, `i18n/templates/${code}.json`);
    if (!existsSync(file)) {
      report(join(SRC, 'templates/library.json'), 1, 'error', `template names: there is no src/i18n/templates/${code}.json`);
      continue;
    }
    const tr = load(file);
    if (!tr) continue;
    for (const e of entries) {
      const t = tr.data[e.id];
      if (!t?.name) report(file, 1, 'error', `template "${e.id}" has no name in ${code} (English: "${e.name}"); add  "${e.id}": { "name": "…" }`);
      if (e.mechanism && t && !t.description) report(file, lineOf(tr.lines, e.id), 'error', `mechanism "${e.id}" has no description in ${code}`);
    }
    for (const id of Object.keys(tr.data)) {
      if (id !== '_meta' && !ids.has(id)) report(file, lineOf(tr.lines, id), 'error', `"${id}" is not a template id (src/templates/library.json, or mech-<id> of index.json)`);
    }
  }
  return ids;
}

function checkKetcher() {
  const dicts = {};
  for (const code of SHIPPED) {
    const file = join(SRC, `i18n/ketcher/${code}.json`);
    if (existsSync(file)) dicts[code] = { file, ...load(file) };
  }
  const all = new Set(Object.values(dicts).flatMap((d) => Object.keys(d.data ?? {}).filter((k) => k !== '_meta')));
  for (const [code, d] of Object.entries(dicts)) {
    for (const k of all) if (!d.data?.[k]) report(d.file, 1, 'error', `Ketcher text "${k}" is translated in another language but not in ${code}`);
  }
}

function checkLevels(ids) {
  const file = join(SRC, 'config/levels.json');
  const cfg = load(file);
  if (!cfg) return;
  const text = readFileSync(file, 'utf8').split('\n');
  for (const id of cfg.data.basicTemplates ?? []) {
    if (!ids.has(id)) {
      const line = text.findIndex((l) => l.includes(`"${id}"`)) + 1;
      report(file, line || 1, 'error', `"${id}" is not a template id (see src/templates/library.json; mechanisms are "mech-<id>")`);
    }
  }
  for (const l of ['A', 'B', 'C']) if (!cfg.data.levels?.[l]) report(file, 1, 'error', `level ${l} is missing`);
}

function run() {
  problems = [];
  const localeDir = join(SRC, 'i18n/locales');
  checkLocaleSet(localeDir, 'interface texts');
  for (const sub of readdirSync(localeDir, { withFileTypes: true })) {
    if (sub.isDirectory()) checkLocaleSet(join(localeDir, sub.name), `texts of ${sub.name}/`);
  }
  const ids = checkTemplates();
  checkKetcher();
  checkLevels(ids);
  const errors = problems.filter((p) => p.includes(': error: ')).length;
  for (const p of problems) console.log(p);
  console.log(`check-content: ${errors} error(s), ${problems.length - errors} warning(s).`);
  return errors;
}

if (process.argv.includes('--watch')) {
  const again = () => {
    console.log('check-content: start');
    run();
    console.log('check-content: done');
  };
  again();
  let timer;
  for (const dir of ['i18n', 'config', 'templates']) {
    watch(join(SRC, dir), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(again, 300);
    });
  }
} else {
  process.exit(run() ? 1 : 0);
}
