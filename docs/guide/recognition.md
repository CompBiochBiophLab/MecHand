# Handwriting recognition

MecHand reads **strokes**, not pictures. Because the pen positions, the order of the strokes and
where each one starts and ends are known, a light-weight, transparent recognizer can run entirely
in the browser — no server, no GPU, nothing sent over the network. (Image-based recognizers such as
MolScribe or DECIMER work from pixels; on hand-drawn structures they are much less accurate, and
they need Python and large models. DECIMER can still be used as an optional engine, see
[Optional DECIMER server](./server).)

The source is in [`ketcher-mechhand/src/recognition/`](https://github.com/JordiVillaFreixa/MecHand/tree/main/ketcher-mechhand/src/recognition).

## Pipeline

1. **Scale.** The drawn bond length *L* is estimated from straight strokes and from the height of
   letters (capitals are about 0.38 *L* tall). Every later decision is relative to *L*, so it does
   not matter how big you draw.
2. **Arrows.** A stroke with an arrowhead — a sharp turn back at its end, or a small V or barb drawn
   separately — is an arrow. Curved shafts become electron-flow arrows (full head: 2 e⁻; single
   barb: 1 e⁻); long straight ones become reaction arrows.
3. **Letters versus bonds.** Short strokes that cross (+, H, t), meet in a T (H, F), meet at an
   acute angle (N, M, Z — bonds never meet at less than 60°), or stand beside another letter (the
   l of Cl) are letters; long straight strokes, zig-zags and polygons are bonds. Corners are found
   with ShortStraw (Wolin, Eoff & Hammond, 2008).
4. **Labels.** Letter strokes are grouped into labels, split into characters, and each character
   is classified with the **$P point-cloud recognizer** (Vatavu, Anthony & Wobbrock, ICMI 2012),
   which ignores stroke order and direction. A small decoder picks the best *chemically valid*
   reading ("Cl" not "CI", "Pt2−", "O−").
5. **Graph.** Near-parallel lines merge into double/triple bonds; bond ends are clustered into
   atoms; labels and charges attach to the nearest atom (a charge prefers the upper-right position).
6. **Electron flow.** Each curved arrow is anchored to the nearest atom or bond and checked
   (lone pair at the start, octet at the end).

The result goes to Ketcher as KET (Ketcher's native JSON), including the curved arrows as Ketcher
elliptical-arc arrows.

## The model

The "model" of the $P recognizer is data, versioned with the code:

| File | Content |
| --- | --- |
| [`model/symbols-model.json`](https://github.com/JordiVillaFreixa/MecHand/blob/main/ketcher-mechhand/src/recognition/model/symbols-model.json) | Glyph skeletons for each symbol (letters, digits, + and −), with a `version`. At start-up each skeleton is expanded into slanted, scaled, rotated and jittered copies. |
| [`model/contrib/*.json`](https://github.com/JordiVillaFreixa/MecHand/tree/main/ketcher-mechhand/src/recognition/model/contrib) | Real handwriting samples contributed by users. |
| Your browser | The samples you record with **✍ Teach**. |

The model in use, its version and the number of templates are shown in **About**.

![About panel](/img/about-panel.png)

### Updating the model

- **For yourself:** use ✍ Teach. Samples are applied immediately and kept in this browser.
- **For everyone:** export your samples (Teach → Export samples), save the file as
  `ketcher-mechhand/src/recognition/model/contrib/<name>.json`, bump `version` in
  `symbols-model.json`, and open a pull request. The next deployment uses them.
- **New symbols:** add a skeleton (lines and arcs in a unit box) to `symbols-model.json`; the format
  is described in the file itself.

The recognizer is plain TypeScript with no runtime dependencies, so it is updated like the rest of
the app: change, run the tests, deploy.

## Accuracy

Every mechanism template is rendered as synthetic handwriting in three hand styles (different
slant, jitter, letter shapes, and arrowheads drawn either in the same stroke as the shaft or
separately), recognized, and compared with the original. Capital letters are drawn 0.32 bond
lengths tall and bonds stop 0.2 bond lengths short of a label.

| Measure (13 templates × 3 styles, 9 November 2026) | Result |
| --- | --- |
| Atoms (element and charge) correct | **87 %** |
| Bonds (connectivity and order) correct | **85 %** |
| Arrows (number and kind) correct | **100 %** |
| Whole mechanism exactly right | 31 % |

These numbers are a regression test (`npm test` fails if they drop), not a user study: real
handwriting varies more than the synthetic hand, which is why the confirmation dialog and Teach mode
exist. The weakest cases are crowded metal complexes ([PtCl₄]²⁻, [Fe(OH₂)₆]³⁺) and labels with many
explicit hydrogens.
