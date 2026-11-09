# Contributed handwriting samples

Real handwriting samples that improve the symbol model for everyone.

1. In MecHand, open **Teach** in the toolbar, pick a symbol and draw it a few times.
2. Click **Export samples** to download `mechand-samples.json`.
3. Rename it without personal information (e.g. `2026-11-sample-01.json`), put it in this folder
   and open a pull request. Only contribute your own handwriting, and only if you agree that it
   becomes public under the project's MIT licence (see the privacy notes in the main README).

Each sample holds only the symbol and the x, y points of its strokes (no timestamps, pressure,
device or identity). Every `*.json` file here has the shape `{"samples": [{"symbol": "O", "strokes": [[{"x": 0, "y": 0}, ...], ...]}]}`
and is loaded automatically at build time. When the set changes, bump `version` in
`../symbols-model.json` so users can see which model they run (shown in the About panel).
