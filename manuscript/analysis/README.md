# Analyses for the manuscript

## MecHand vs DECIMER on the same synthetic handwriting

`compare_decimer.py` compares MecHand's stroke-based recognizer with DECIMER's hand-drawn image
model (decimer 2.8.1) on every molecule of the 13 mechanism templates, each drawn as synthetic
handwriting in three hand styles (126 drawings). Structures are compared as canonical SMILES
(RDKit) after the same normalisation on every side: explicit hydrogens removed, radicals cleared and
implicit hydrogens recomputed (so an atom label written without its hydrogens is not counted as an
error), stereochemistry ignored.

Reproduce (Node.js for step 1, Python 3.10–3.13 with `decimer` and `rdkit` for step 2):

```sh
cd ketcher-mechhand
MECHAND_COMPARE_OUT=../manuscript/analysis/results/comparison_dataset.json \
  npx vitest run src/recognition/compare.export.test.ts
cd ../manuscript/analysis
python compare_decimer.py results/comparison_dataset.json --out results/decimer_comparison --scale 8 --width 18
```

DECIMER's accuracy depends on the size of the rendered drawing; it was run at several scales
(drawing scale / ink width in px → exact-match rate: 1/3 → 21 %, 2.5/7 → 32 %, 4/10 → 39 %,
6/14 → 36 %, 8/18 → 40 %), and the manuscript reports its best setting (8/18).

Outputs: `results/decimer_comparison.json` (per drawing: reference, MecHand and DECIMER SMILES,
times) and `results/decimer_comparison.tex` (table included by the manuscript).

Caveat: the drawings come from MecHand's own synthetic-handwriting generator, which was also used
while developing the recognizer, so the comparison is likely optimistic for MecHand. DECIMER reads
images only, whereas MecHand also uses the order and shape of the pen strokes.
