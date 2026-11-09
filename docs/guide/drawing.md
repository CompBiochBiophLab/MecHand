# Drawing mechanisms

Turn on **✎ Freehand** and draw as you would on paper. Strokes stay as ink until you press
**✓ Recognize** (or Space).

![Hand-drawn SN2 reactants](/img/freehand-ink.png)

## What MecHand understands

| You draw | MecHand reads |
| --- | --- |
| A line | a single bond |
| A zig-zag or a closed polygon in one stroke | a chain or a ring (it splits the stroke at its corners) |
| Two or three close parallel lines | a double or triple bond |
| Letters at the end of a bond, or on their own | an atom label: C, H, N, O, S, P, F, Cl, Br, I, B, Si, Li, Na, K, Mg, Al, Fe, Cu, Zn, Pt, Pd… |
| `+` or `−` (also ⊕, ⊖, `2−`, `3+`) up and to the right of an atom | a formal charge |
| A single dot next to an atom | a radical |
| A `+` between molecules | a plus sign of the reaction |
| A curved stroke with a full head (a V or ⟩, drawn with the curve or separately) | an electron-pair arrow |
| A curved stroke with a single barb | a single-electron (fishhook) arrow |
| A long straight arrow | a reaction arrow |

Tips:

- Draw bonds a little longer than letters are tall (about 2–3 times): this is how MecHand tells them apart.
- Leave a small gap between a bond and an atom label, as in printed formulae.
- Start a curved arrow at the electrons (a lone pair or the middle of a bond) and end it at the atom or bond that receives them.
- Hydrogens and lone pairs that do not take part in the step can be left out; Ketcher adds implicit hydrogens.

## Is this what you meant?

**✓ Recognize** colours your ink by how it was read (blue bonds, green labels, red arrows, grey not understood) and shows the result:

![Recognition dialog](/img/recognize-dialog.png)

- **✓ Insert into Ketcher** adds the structure and arrows to the canvas, where you can edit them with Ketcher's tools.
- **✎ Keep drawing** closes the dialog and keeps the ink, so you can add or fix strokes (Undo ink removes the last one).
- **✗ Discard ink** deletes the strokes.

### Electron-flow check

Every curved arrow is anchored to the atom or bond nearest to each end, the way ChemAxon Marvin's
electron-flow arrows are. The dialog warns when:

- an electron-pair arrow starts at an atom with no lone pair (e.g. a neutral CH₃ carbon) — start it at a bond or a lone pair;
- an arrow starts or ends on nothing;
- an arrow would give C, N, O or F more than an octet while no bond to that atom breaks in the same step.

## Teach MecHand your handwriting

If a letter is often misread, open **✍ Teach**, choose the symbol, write it a few times and save each sample.
Samples are stored in your browser and used immediately. **Export samples** downloads them as JSON so they can
be added to the shared model (see [Handwriting recognition](./recognition#updating-the-model)).

![Teach panel](/img/teach-panel.png)

## Keyboard

| Keys | Action |
| --- | --- |
| Alt+F (⌥F on a Mac) | Freehand on/off |
| Space | Recognize (freehand mode) |
| Ctrl+Z / ⌘Z | Remove the last stroke (freehand mode; otherwise Ketcher's undo) |
| Esc | Close a dialog |

All of Ketcher's own shortcuts keep working when freehand mode is off.
