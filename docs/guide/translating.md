# Translating MecHand

MecHand's interface — buttons, dialogs, the pen bar, the template library, the help centre, the
guided tour and the study panel — can be shown in any language. Each language is **one plain JSON
file** in
[`ketcher-mechhand/src/i18n/locales/`](https://github.com/CompBiochBiophLab/MecHand/tree/main/ketcher-mechhand/src/i18n/locales):

| File | Language | Status |
| --- | --- | --- |
| `en.json` | English | Source |
| `ca.json` | Català | Complete |
| `es.json` | Español | Complete |

Choose the language with the menu next to **Help** (the globe), or with `?lang=xx` in the address.
The choice is remembered in your browser. Ketcher's own toolbars are part of Ketcher and are not
translated by MecHand.

## Add or improve a language

1. Copy `en.json` to a new file named with the language code (`fr.json`, `de.json`, `pt-BR.json`…).
2. Change the `_meta` block: the language's own name (`"name": "Français"`) and your name in
   `"authors"`.
3. Translate the **values** (right of the colon). Do not change the **keys** (left of the colon).
4. Keep the `{placeholders}` exactly as they are — they are filled in by the program — and the
   `**bold**`, `*italic*` and `` `code` `` marks if you can.
5. Words that vary with a number come in variants: `"atoms_one": "{count} atom"`,
   `"atoms_other": "{count} atoms"`. Use the categories of your language (`_one`, `_two`, `_few`,
   `_many`, `_other`, as in [Unicode plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html));
   `_other` is always used when a category is missing.
6. Save the file as UTF-8 and send it: a pull request on GitHub, or by e-mail to the project.

You do not have to translate everything at once: any text that is missing is shown in English.

## Other texts

Besides the interface file of each language, a few subjects have their own folder, with one file per
language named by its code like the main file:

| Folder | What it holds |
| --- | --- |
| `src/i18n/locales/learn/` | The chemistry explanations of level A: topics of the help centre, what each arrow means, the simple periodic table and the names of the elements |
| `src/i18n/locales/levels/` | Names and descriptions of the user levels (A student, B advanced student, C researcher) |
| `src/i18n/templates/` | Names of the template library, and descriptions of the mechanisms (English is in `src/templates/`) |
| `src/i18n/ketcher/` | The tooltips of Ketcher's own toolbars, keyed by Ketcher's English text without the shortcut |

A text that is the same as in English on purpose (a name, an abbreviation) can be listed in the
file's `"_meta": { "sameAsEnglish": [...] }` so that the check below does not warn about it.

What each level offers (templates, periodic table, chemistry explanations, export formats…) is set in
`src/config/levels.json`; VS Code checks it against `levels.schema.json` as you type.

## Check a translation

With the app checked out (see [Development](./development)):

```sh
cd ketcher-mechhand
npm run check:content          # every text in en/ca/es, template names, Ketcher tooltips, levels.json
npx vitest run src/i18n src/levels   # the same checks as tests
npm run dev                    # then open http://localhost:5173/?lang=xx
```

Both fail if a key does not exist in English (a typo), if a placeholder was changed, or if Catalan or
Spanish miss a text; partial translations of new languages pass. In VS Code, the tasks **MecHand:
check texts and levels** and **MecHand: watch texts and levels** (re-checks on every save) list the
problems in the Problems panel, with a link to the line.

## Notes for the user study

The study panel (`?study=1`) runs in Catalan unless `&lang=` is given. Its questionnaire includes the
System Usability Scale: the English texts are Brooke's original items; the Catalan and Spanish ones
are the project's own translations, not validated versions of the scale.
