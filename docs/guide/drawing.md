# Drawing mechanisms

Turn on **Freehand** (the pen button, or Alt/⌥+F) and draw as you would on paper, with a pen, a
finger, a trackpad or a mouse. Strokes stay as ink until you press **Recognize** (or Space).

![Hand-drawn SN2 reactants](/img/freehand-ink.png)

## The pen bar

In freehand mode a second toolbar sits under the MecHand bar:

| Control | What it does |
| --- | --- |
| **Pen** / **Eraser** (P / E) | Draw, or erase whole strokes: drag the eraser over the strokes you want to remove (they fade) and lift. The eraser end of a pen (Surface Pen, Wacom and others) erases whatever tool is selected. |
| **Colours** | Black, blue, red, green, purple, orange — for instance arrows in red. |
| **Kind of line** | *Ballpoint* (even line), *fountain pen* (width follows pen pressure, or speed with a mouse or trackpad), *marker* (broad and translucent), *dashed*. |
| **Width** | Fine, medium, bold, extra bold. |
| **Input mode** | *Auto*: pen, finger and mouse draw; once a pen is used, fingers and palms are ignored. *Pen only*: fingers never draw (rest your hand on the screen). *Pen and finger*: both always draw. *Trackpad*: click to start a stroke, move without pressing, click again to end it. |
| **Device chip** | Which device the browser saw for the last contact (pen, finger, mouse/trackpad) and whether palm rejection ignored it. |

Colour, kind of line and width only change how the ink looks: recognition uses the shape of each
stroke, so a red marker arrow is read exactly like a black ballpoint one. The settings are remembered
in this browser.

### Drawing with a trackpad

Drawing on a laptop trackpad normally means pressing the pad and moving another finger at the same
time. Two easier ways:

- choose the **Trackpad** input mode: a click (or tap) starts a stroke, the stroke follows the pointer
  without pressing, and the next click ends it (Esc drops it); or
- on a Mac, turn on *three-finger drag* (System Settings → Accessibility → Pointer Control → Trackpad
  Options → Use trackpad for dragging → Three-finger drag) and draw with three fingers.

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

**Recognize** colours your ink by how it was read (blue bonds, green labels, red arrows, grey not understood) and shows the result:

![Recognition dialog](/img/recognize-dialog.png)

- **Insert into Ketcher** (Enter) adds the structure and arrows to the canvas, where you can edit them with Ketcher's tools.
- **Keep drawing** (Esc) closes the dialog and keeps the ink, so you can add or fix strokes (the eraser removes a stroke; Undo ink undoes the last change).
- **Discard ink** deletes the strokes (Undo ink brings them back).

### Electron-flow check

Every curved arrow is anchored to the atom or bond nearest to each end, the way ChemAxon Marvin's
electron-flow arrows are. The dialog warns when:

- an electron-pair arrow starts at an atom with no lone pair (e.g. a neutral CH₃ carbon) — start it at a bond or a lone pair;
- an arrow starts or ends on nothing;
- an arrow would give C, N, O or F more than an octet while no bond to that atom breaks in the same step.

## Teach MecHand your handwriting

Open **Teach** when something you draw is often misread. The panel has four tabs:

| Tab | What you draw | What it changes |
| --- | --- | --- |
| **Letters & signs** | Element letters, the digits 2–4, + and −, ⊕ and ⊖ | Each sample is one more example for the letter classifier. |
| **Arrows** | Curved arrows (2 e⁻ and 1 e⁻), reaction arrows, equilibrium arrows ⇌ | The head of every arrow drawn with a separate head stroke is added to the arrowhead model: a triangle, filled or otherwise personal head is recognized from then on. |
| **Bonds** | Single, double and triple bonds, a benzene ring | Bonds are recognized by geometry; this checks that your style is read correctly. |
| **Electrons** | Lone pairs (two dots) and radicals (one dot), beside a grey O | The size of your dots sets how large a mark may be and still count as a dot. |

In the Arrows, Bonds and Electrons tabs a grey line shows the length of one bond: draw at that scale.
Under the box, **Currently read as** shows at once what MecHand reads (✓ when it is what was asked for).
Samples are stored in your browser and used immediately. **Export samples** downloads them as JSON so they can
be added to the shared model (see [Handwriting recognition](./recognition#updating-the-model)).

![Teach panel](/img/teach-panel.png)

## Keyboard

| Keys | Action |
| --- | --- |
| Alt+F (⌥F on a Mac) | Freehand on/off |
| Space | Recognize (freehand mode) |
| P / E | Pen / eraser (freehand mode) |
| Ctrl+Z / ⌘Z | Undo the last change to the ink (freehand mode; otherwise Ketcher's undo) |
| Ctrl+Shift+Z / ⌘⇧Z (or Ctrl+Y) | Redo ink (freehand mode) |
| Esc | Drop an open trackpad stroke; close a dialog |

All of Ketcher's own shortcuts keep working when freehand mode is off.
