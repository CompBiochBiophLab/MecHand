# Mechanism templates

Standard, textbook-level reaction-mechanism templates for MecHand. They are Ketcher-native KET files that
users open from the MecHand toolbar, and the test suite uses them as fixtures.

| Output | Contents |
| --- | --- |
| `../src/templates/mechanisms/<id>.ket` | One template per mechanism: species, `plus` nodes, straight reaction arrow(s), curved electron-pushing arrows |
| `../src/templates/index.json` | `[{id, file, title, category, description, electrons, reference}]`, where `category` is `organic`, `inorganic` or `biochemistry` and `electrons` is `2e` or `1e` |

There are currently 13 templates:

- organic: `sn2`, `e2`, `carbonyl_addition`, `eas_nitration`, `diels_alder`, `radical_homolysis`
- inorganic: `lewis_adduct`, `pt_substitution`, `sicl4_hydrolysis`, `aqua_acidity`
- biochemistry: `serine_protease`, `adh_hydride`, `kinase`

## Regenerating

The KET files are generated. Don't edit them by hand: change `build_templates.py` and rerun it.

```sh
cd ketcher-mechhand/templates
python build_templates.py                 # write KET files + index.json, then validate them
python build_templates.py --preview DIR   # also render one PNG per template into DIR (needs matplotlib)
python build_templates.py --check         # validate the committed files only
```

You need RDKit (2D coordinates; CoordGen is preferred). The output is deterministic for a given RDKit
version, and coordinates are rounded to 4 decimals. Keep preview PNGs out of the repo.

Validation runs on the KET files alone and checks the following:

- the JSON parses and every `$ref` resolves to a molecule
- every bond references existing atoms
- every arrow has two points, and every curved arrow has a non-zero `height`
- for each stage between reaction arrows, the total formal charge, heavy-atom counts and hydrogens are conserved (hydrogens are counted as explicit H plus implicit H, computed with a port of Ketcher's own valence rules)
- curved arrows sit only on the reactant or intermediate side
- every curved-arrow endpoint lies within 0.45 of an atom or a bond midpoint

Atoms that Ketcher will flag with a valence warning (`badConn`) are reported as notes.

While building, the generator also checks that every curved-arrow endpoint resolves to the atom or bond
it was declared for. It uses the same rule as MecHand's recognizer (`src/recognition/sketch.ts`
`anchorFor`):

- the nearest atom within 1.0 wins by default;
- a bond overrides it when the endpoint's projection parameter `t` is in (0.2, 0.8) and its distance to the bond is less than 0.9 × the best distance so far.

If an atom endpoint's default offset would be captured by a neighbouring bond, the generator rotates the
offset direction in 10° steps until the endpoint anchors to the intended atom.

## Adding a template

Write a function that returns a `Mechanism` and add it to `MECHANISMS`.

- A `Mechanism` is a list of `Stage`s: reactants, optionally an intermediate, then products.
- Each stage lists its species and the curved arrows drawn on it.
- Build species with `mol(smiles, orient=(i, j, deg), flip=..., place=..., stereo=..., yalign=..., gap=...)`. This uses RDKit layout and keeps the Kekulé form exactly as written in the SMILES.
- Use `xmol(atoms, bonds)` instead when you need explicit coordinates, for example for metal complexes, umbrellas or s-cis dienes.
- Arrow endpoints are `At(species, atom)` (a lone pair or radical source, or the atom where a bond forms) and `Bd(species, i, j)` (a bond midpoint: a π/σ source or a new π bond). Both refer to atom indices within the stage.
- `side` is `auto`, `left` or `right`. `auto` picks the less crowded side, then the side facing outward from the molecule.

## Conventions

- **Coordinates.** Ketcher units with a standard bond length of 1.0, and **y pointing up**. Ketcher negates y on load. RDKit coordinates are rescaled to bond length 1.0.
- **Layout.** Left → right: reactants, `+`, `open-angle` reaction arrow, products. Two-step templates have an intermediate between two reaction arrows. Species are about 1.5 units apart.
  - Active-site assemblies (`serine_protease`, the `kinase` reactants) and the TS-like `diels_alder` arrangement have no `+` between fragments.
- **No text nodes.** Ketcher's text format changes between versions, so titles live in `index.json`.
- **Bonds.** Types are Kekulé 1, 2 or 3. `stereo` is 1 (wedge) or 6 (hash), with the narrow end at `atoms[0]`.
- **Charges and radicals.** Atoms carry formal charges. `radical: 2` is a doublet.
- **Hydrogens.** Implicit hydrogens are left to Ketcher. Explicit H atoms appear only where they take part in the mechanism: the anti-periplanar β-H in E2, the transferred protons and hydrides, the Wheland sp³ C–H, and the SN2 umbrella.
- **Metal–ligand bonds.** These are single bonds with formal charges that sum to the ion charge. For example, [PtCl₄]²⁻ has Pt 2− and neutral Cl; coordinated NH₃ is N⁺; [Fe(OH₂)₆]³⁺ has Fe 3− and six O⁺.
  - Ketcher's valence model shows a valence warning on these metal atoms. To hide it, set the render option `showValenceWarnings: false`.
- **Curved arrows.**
  - Arrow modes:
    - `elliptical-arc-arrow-open-angle` for 2 electrons.
    - `elliptical-arc-arrow-open-half-angle` for a fishhook (1 electron).
  - Ketcher draws a half-ellipse from `pos[0]` to `pos[1]`. Its semi-axes are half the chord along the chord and `|height|` across it, so the head arrives perpendicular to the chord.
  - In the generator a **positive bulge means "to the left of start→end in the y-up frame"**. The file stores `KET_HEIGHT_SIGN * bulge`, which lets you flip the convention globally by changing that one constant.
  - Reading ketcher-core 3.18 suggests that `+height` already means left in the KET frame: `draw.js` uses SVG sweep-flag 1 for `height >= 0` on the y-down canvas, and `height` is not negated on load. This has not been checked in a browser yet.
  - Endpoints:
    - An atom endpoint is offset 0.3 from the atom centre towards the bulge side, so it doesn't sit on the label.
    - A bond-source endpoint is offset 0.06 from the bond midpoint.
    - A bond-target endpoint is offset 0.15 from the bond midpoint.
    - `|height|` is clamp(0.25·chord + 0.2, 0.35, 0.8).

# Structure library

`build_library.py` generates the structures of the template library (rings, functional groups,
biomolecules, reagents) into `../src/templates/library.json`. The app shows them in the library
panel together with the mechanism templates above.

```sh
python build_library.py                 # write library.json, then validate it
python build_library.py --check         # validate the committed file (fails if it is out of date)
python build_library.py --preview DIR   # also write one PNG contact sheet per category into DIR
```

Each entry is a SMILES string plus a display name, English synonyms and Catalan names. The
script lays it out with RDKit (CoordGen, bond length 1.0, y up, centred), orients it (R groups on the
left, C=O up, amino acids N → COOH with the side chain up), adds wedges from the declared
stereochemistry and stores Kekulé bonds, charges, radicals and the H counts thumbnails show.

Validation:

- the drawing, read back as a molfile, gives the same canonical SMILES (constitution, charges,
  stereocentres and double-bond geometry);
- Ketcher's implicit-hydrogen rules give the same hydrogens as RDKit on every atom (no valence
  warnings, no missing H);
- declared CIP labels and InChIKeys match (amino acids, sugars, nucleotides, lipids);
- ids are unique, every category is non-empty, bond lengths are 1.0 ± 0.1 and no atoms overlap.

R groups are dummy atoms: one `*` becomes the pseudo-atom "R"; several (`[1*]`, `[2*]`, `[3*]`)
become R-group labels R1, R2, R3. Salts are laid out ion by ion. Thumbnails are drawn at runtime from
the stored coordinates, so the file holds no images.
