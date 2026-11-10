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

## Check a translation

With the app checked out (see [Development](./development)):

```sh
cd ketcher-mechhand
npx vitest run src/i18n        # unknown keys, changed placeholders, completeness of en/ca/es
npm run dev                    # then open http://localhost:5173/?lang=xx
```

The test fails if a key does not exist in English (a typo) or if a placeholder was changed;
partial translations of new languages pass.

## Notes for the user study

The study panel (`?study=1`) runs in Catalan unless `&lang=` is given. Its questionnaire includes the
System Usability Scale: the English texts are Brooke's original items; the Catalan and Spanish ones
are the project's own translations, not validated versions of the scale.
