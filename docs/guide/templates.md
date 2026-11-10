# Templates

MecHand has a **template library** (the **Library** button, or Ctrl/⌘+K): about 180 ready-made
structures (rings, functional groups, biomolecules, reagents) and the mechanism templates below, all
in one searchable panel. Use it to put a building block on the canvas in a couple of keystrokes
instead of drawing it, then edit it or draw the electron-flow arrows by hand. The same search box
also draws any molecule from its **SMILES, InChI, CAS number or name** (see
[Structures from text](#structures-from-text)).

![The template library](/img/library.png)

## Template library

### Categories

| Tab | What is in it |
| --- | --- |
| **Rings** | Cycloalkanes (C3 to C8, plus a cyclohexane chair), benzene and fused aromatics, aromatic heterocycles (pyridine, pyrrole, furan, thiophene, imidazole, pyrimidine, purine, indole, quinoline…), saturated heterocycles (oxirane, THF, piperidine, morpholine, dioxane…), lactones and lactams, the steroid nucleus |
| **Functional groups** | Alcohol, ether, enol and enolate, (hemi)acetal, carbonyl groups (aldehyde to anhydride, protonated carbonyl, acylium), amines, imine and iminium, nitrile, nitro, thiol to sulfonic acid, tosylate, phosphate esters, carbocations, carbanions, a radical, and common substituents and protecting groups (Ph, Bn, tBu, Ac, Boc) |
| **Biomolecules** | The 20 amino acids (L, neutral form), the five nucleobases, adenosine and ATP, glucose (β- and α-pyranose and the open chain), fructose, ribose and deoxyribose, NAD⁺/NADH (nicotinamide ring), PLP, pyruvate, lactate, PEP, acetylcholine, fatty acids, glycerol, cholesterol |
| **Reagents** | Water and ions (H⁺, H⁻, HO⁻, H₃O⁺, halides, cyanide…), acids, bases (LDA, KOtBu, n-BuLi…), reducing agents (NaBH₄, LiAlH₄, DIBAL-H), oxidizing agents (mCPBA, KMnO₄, PCC, ozone), halogenating and activating agents (Br₂, NBS, SOCl₂, PBr₃, AlCl₃, BF₃…), carbon nucleophiles (Grignard reagent, Wittig ylide, malonate), common solvents (DMSO, DMF, acetone, MeCN, DCM…) and small molecules |
| **Mechanisms** | The mechanism templates listed below |

**All** shows everything, grouped by category; **Recent** lists what you inserted last and
**Favourites** the templates you starred.

Functional groups carry their substituents as **R groups**: a single one is drawn as an italic *R*
(a pseudo-atom), several as Ketcher R-group labels **R1**, **R2**, **R3**. Edit them like any other
atom, or leave them as generic substituents: they export to SMILES, MOL and LaTeX as R groups.

### Searching

The search box has the focus as soon as the panel opens: just type. The search

- ignores accents and case (`benze`, `benzè` and `Benzene` all find benzene);
- understands English and Catalan names, synonyms, abbreviations and formulas: `àcid carboxílic`,
  `carboxylic acid`, `Trp`, `THF`, `NaBH4`, `H2O`, `beta-lactam` and `β-lactama` all work;
- matches the beginning of words (`morph` finds morpholine) and forgives small typos (`tryptofan`);
- requires every word you type (`acid amino` finds the amino acids), searching inside the selected tab.

### Inserting

A click, or **Enter** on the highlighted tile, inserts the template:

- **structures are added** to the canvas, to the right of what is already there;
- **mechanisms replace** the canvas (they are complete schemes).

**Shift**+click or **Shift**+**Enter** does the opposite: replace the canvas with a structure, or add
a mechanism next to your drawing. On a tablet, use the small button in the top-left corner of a tile
for the other mode.

### Keyboard

| Key | Action |
| --- | --- |
| *type* | Search |
| ↑ ↓ ← → | Move between tiles (while you are typing, ← → move the text cursor until you press ↓) |
| Enter | Insert the highlighted template |
| Shift+Enter | Insert it the other way (replace / add) |
| Ctrl+D (⌘D on a Mac) | Add the highlighted template to Favourites, or remove it |
| Esc | Close the library |

Favourites and recently used templates are remembered in this browser only (in `localStorage`,
as template names; nothing else is stored and nothing is sent anywhere).

## Structures from text

Type into the library's search box:

| You type | What happens |
| --- | --- |
| A **SMILES** string (`CC(=O)Oc1ccccc1C(=O)O`) or an **InChI** (`InChI=1S/…`) | It is read at once, offline, by Ketcher's chemistry engine in your browser; the first tile shows it. Enter adds it to the canvas. Text that is not valid SMILES (for instance a name) is never misread as a structure. |
| A **CAS number** (`64-17-5`) or a **name** of a library structure, in English or Catalan | The library finds it offline (CAS numbers of the library's structures come from PubChem). |
| Any other **name** or **CAS number** (`aspirin`, `2-methylpropan-2-ol`, `50-00-0`) | A button offers to look it up online: **PubChem** (NIH; common names, synonyms and CAS numbers) and then **OPSIN** (EMBL-EBI; systematic IUPAC names). Alt+Enter does the same. |

The online look-up is the only feature of MecHand that uses the network after the page has loaded,
and only when you press the button: the text you typed is sent to PubChem (and, if PubChem does
not know it, to OPSIN), and nothing else. It is not available in the user-study mode.

### Where the structures come from

Every structure is generated from a SMILES string by
[`ketcher-mechhand/templates/build_library.py`](https://github.com/CompBiochBiophLab/MecHand/blob/main/ketcher-mechhand/templates/build_library.py)
with RDKit: 2D coordinates at Ketcher's bond length, wedges from the declared stereochemistry, and
search keywords. The script checks each drawing against its SMILES (constitution, charges and
stereocentres), checks that Ketcher will show the same hydrogens as RDKit, and verifies known
stereo labels and InChIKeys. To add a structure, declare it in that script and run it:

```sh
cd ketcher-mechhand/templates
python build_library.py            # writes src/templates/library.json and validates it
python build_library.py --check    # validates the committed file
```

## Mechanism templates

Open them from the **Mechanisms** tab of the library. They load into Ketcher as ordinary structures
with curved electron-flow arrows, so you can study them, redraw them by hand to practise, or export
them to LaTeX. They are also the test set of the recognizer and of the LaTeX export.

The templates are generated reproducibly with RDKit by
[`ketcher-mechhand/templates/build_templates.py`](https://github.com/CompBiochBiophLab/MecHand/blob/main/ketcher-mechhand/templates/build_templates.py),
which also checks that charges and atoms balance across each reaction arrow. To add one, declare it
in that script (SMILES, arrows, metadata) and run it.

### Organic

| Template | What it shows | Reference |
| --- | --- | --- |
| **SN2: hydroxide + bromomethane** | Concerted backside attack of hydroxide on bromomethane with loss of bromide; the C–H 'umbrella' inverts (Walden inversion). | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 15 |
| **E2: ethoxide + 2-bromopropane** | Ethoxide removes the β-hydrogen anti-periplanar to bromine while the C=C π bond forms and bromide leaves, all in one concerted step. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 17 |
| **Nucleophilic addition: cyanide + acetaldehyde** | Cyanide attacks the electrophilic carbonyl carbon of acetaldehyde; the C=O π electrons move onto oxygen to give a tetrahedral alkoxide (cyanohydrin anion). | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 6 |
| **Electrophilic aromatic substitution: nitration, step 1** | A benzene π bond attacks the nitronium ion to give the resonance-stabilised arenium (Wheland) intermediate; loss of H⁺ in the next step restores aromaticity. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 21 |
| **Diels–Alder: buta-1,3-diene + ethene** | Concerted [4+2] cycloaddition: three π bonds are converted into two new σ bonds and one new π bond in a single cyclic, six-electron transition state. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 34 |
| **Radical homolysis: Cl₂ under light** (single-electron arrows) | Light (hν) cleaves the Cl–Cl bond homolytically; each chlorine atom keeps one electron of the bond (two fishhook arrows), giving two chlorine radicals. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 37 |

### Inorganic

| Template | What it shows | Reference |
| --- | --- | --- |
| **Lewis acid–base adduct: NH₃ + BF₃** | The nitrogen lone pair of ammonia (Lewis base) is donated into the empty 2p orbital of boron trifluoride (Lewis acid), giving the adduct H₃N⁺–B⁻F₃. | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'Acids, bases and ions in aqueous solution' (Lewis acids and bases) |
| **Associative ligand substitution: [PtCl₄]²⁻ + NH₃** | NH₃ adds to square-planar Pt(II) to give a five-coordinate (trigonal-bipyramidal) intermediate, which then loses Cl⁻ to give [PtCl₃(NH₃)]⁻. M–L bonds are drawn as single bonds with formal charges (Pt 2−/3−, coordinated N⁺). | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'd-Block metal complexes: reaction mechanisms' (substitution in square planar complexes) |
| **Hydrolysis of SiCl₄: attack of water at silicon** | A water lone pair attacks silicon and chloride is displaced (drawn as one concerted, SN2-like step; the five-coordinate silicon species is not shown). Loss of H⁺ then gives Cl₃SiOH, and repetition gives Si(OH)₄/SiO₂. | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'The group 14 elements' (halides of Si) |
| **Brønsted acidity of a metal aqua ion: [Fe(OH₂)₆]³⁺ + H₂O** | Polarisation by Fe(III) makes a coordinated water acidic: a solvent water removes a proton to give [Fe(OH₂)₅(OH)]²⁺ and H₃O⁺. M–L bonds are single bonds with formal charges (Fe 3−, aqua O⁺). | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'Acids, bases and ions in aqueous solution' (aqua acids) |

### Biochemistry

| Template | What it shows | Reference |
| --- | --- | --- |
| **Serine protease acylation: catalytic triad attack on a peptide bond** | His57, held by Asp102, acts as a general base and takes the Ser195 hydroxyl proton as the serine oxygen attacks the amide carbonyl, giving the tetrahedral oxyanion intermediate. Side chains are truncated (acetate, 4-methylimidazole, ethanol, N-methylacetamide). | Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 9; Fersht, Structure and Mechanism in Protein Science (1999) |
| **Alcohol dehydrogenase: hydride transfer to NAD⁺** | The zinc-bound alkoxide of ethanol collapses to acetaldehyde while its C–H hydrogen is delivered as hydride to C4 of the nicotinamide ring (NAD⁺ modelled as 1-methylnicotinamide), giving the 1,4-dihydropyridine (NADH). Zn²⁺ is omitted. | Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 16; Fersht, Structure and Mechanism in Protein Science (1999) |
| **Kinase: in-line phosphoryl transfer from ATP** | An active-site Asp acts as general base while the substrate hydroxyl attacks the γ-phosphorus in line with the β,γ-bridging oxygen, which leaves as ADP. ATP is modelled as methyl triphosphate, the substrate as ethanol; Mg²⁺ is omitted. | Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 9 (nucleoside monophosphate kinases); Fersht, Structure and Mechanism in Protein Science (1999) |
