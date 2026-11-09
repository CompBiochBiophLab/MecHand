# Contributed handwriting samples

Real handwriting samples that improve the symbol model for everyone.

1. In MecHand, open **Teach** in the toolbar, pick a symbol (or, in the Arrows, Bonds and Electrons
   tabs, an element) and draw it a few times.
2. Click **Export samples** to download `mechand-samples.json`.
3. Rename it without personal information (e.g. `2026-11-sample-01.json`), put it in this folder
   and open a pull request. Only contribute your own handwriting, and only if you agree that it
   becomes public under the project's MIT licence (see the privacy notes in the main README).

Each sample holds only the symbol or element and the x, y points of its strokes (no timestamps,
pressure, device or identity). Every `*.json` file here has the shape

```json
{
  "samples":  [{"symbol": "O", "strokes": [[{"x": 0, "y": 0}, ...], ...]}],
  "elements": [{"element": "arrow-pair", "bondPx": 70, "strokes": [[{"x": 0, "y": 0}, ...], ...]}]
}
```

(either key may be missing) and is loaded automatically at build time. `bondPx` is the length of one
bond in the Teach box when the element was drawn; the element ids are listed in `../elements.ts`. When the set changes, bump `version` in
`../symbols-model.json` so users can see which model they run (shown in the About panel).
