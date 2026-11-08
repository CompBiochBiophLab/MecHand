# Contributed handwriting samples

Real handwriting samples that improve the symbol model for everyone.

1. In MecHand, open **Teach** in the toolbar, pick a symbol and draw it a few times.
2. Click **Export samples** to download `mechand-samples.json`.
3. Rename it (e.g. `2026-11-jvf.json`), put it in this folder and open a pull request.

Every `*.json` file here has the shape `{"samples": [{"symbol": "O", "strokes": [[{"x": 0, "y": 0}, ...], ...]}]}`
and is loaded automatically at build time. When the set changes, bump `version` in
`../symbols-model.json` so users can see which model they run (shown in the About panel).
