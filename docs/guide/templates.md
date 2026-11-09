# Mechanism templates

Open them from **Templates…** in the MecHand bar. They load into Ketcher as ordinary structures
with curved electron-flow arrows, so you can study them, redraw them by hand to practise, or export
them to LaTeX. They are also the test set of the recognizer and of the LaTeX export.

The templates are generated reproducibly with RDKit by
[`ketcher-mechhand/templates/build_templates.py`](https://github.com/JordiVillaFreixa/MecHand/blob/main/ketcher-mechhand/templates/build_templates.py),
which also checks that charges and atoms balance across each reaction arrow. To add one, declare it
in that script (SMILES, arrows, metadata) and run it.

## Organic

| Template | What it shows | Reference |
| --- | --- | --- |
| **SN2: hydroxide + bromomethane** | Concerted backside attack of hydroxide on bromomethane with loss of bromide; the C–H 'umbrella' inverts (Walden inversion). | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 15 |
| **E2: ethoxide + 2-bromopropane** | Ethoxide removes the β-hydrogen anti-periplanar to bromine while the C=C π bond forms and bromide leaves, all in one concerted step. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 17 |
| **Nucleophilic addition: cyanide + acetaldehyde** | Cyanide attacks the electrophilic carbonyl carbon of acetaldehyde; the C=O π electrons move onto oxygen to give a tetrahedral alkoxide (cyanohydrin anion). | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 6 |
| **Electrophilic aromatic substitution: nitration, step 1** | A benzene π bond attacks the nitronium ion to give the resonance-stabilised arenium (Wheland) intermediate; loss of H⁺ in the next step restores aromaticity. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 21 |
| **Diels–Alder: buta-1,3-diene + ethene** | Concerted [4+2] cycloaddition: three π bonds are converted into two new σ bonds and one new π bond in a single cyclic, six-electron transition state. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 34 |
| **Radical homolysis: Cl₂ under light** (single-electron arrows) | Light (hν) cleaves the Cl–Cl bond homolytically; each chlorine atom keeps one electron of the bond (two fishhook arrows), giving two chlorine radicals. | Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 37 |

## Inorganic

| Template | What it shows | Reference |
| --- | --- | --- |
| **Lewis acid–base adduct: NH₃ + BF₃** | The nitrogen lone pair of ammonia (Lewis base) is donated into the empty 2p orbital of boron trifluoride (Lewis acid), giving the adduct H₃N⁺–B⁻F₃. | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'Acids, bases and ions in aqueous solution' (Lewis acids and bases) |
| **Associative ligand substitution: [PtCl₄]²⁻ + NH₃** | NH₃ adds to square-planar Pt(II) to give a five-coordinate (trigonal-bipyramidal) intermediate, which then loses Cl⁻ to give [PtCl₃(NH₃)]⁻. M–L bonds are drawn as single bonds with formal charges (Pt 2−/3−, coordinated N⁺). | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'd-Block metal complexes: reaction mechanisms' (substitution in square planar complexes) |
| **Hydrolysis of SiCl₄: attack of water at silicon** | A water lone pair attacks silicon and chloride is displaced (drawn as one concerted, SN2-like step; the five-coordinate silicon species is not shown). Loss of H⁺ then gives Cl₃SiOH, and repetition gives Si(OH)₄/SiO₂. | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'The group 14 elements' (halides of Si) |
| **Brønsted acidity of a metal aqua ion: [Fe(OH₂)₆]³⁺ + H₂O** | Polarisation by Fe(III) makes a coordinated water acidic: a solvent water removes a proton to give [Fe(OH₂)₅(OH)]²⁺ and H₃O⁺. M–L bonds are single bonds with formal charges (Fe 3−, aqua O⁺). | Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'Acids, bases and ions in aqueous solution' (aqua acids) |

## Biochemistry

| Template | What it shows | Reference |
| --- | --- | --- |
| **Serine protease acylation: catalytic triad attack on a peptide bond** | His57, held by Asp102, acts as a general base and takes the Ser195 hydroxyl proton as the serine oxygen attacks the amide carbonyl, giving the tetrahedral oxyanion intermediate. Side chains are truncated (acetate, 4-methylimidazole, ethanol, N-methylacetamide). | Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 9; Fersht, Structure and Mechanism in Protein Science (1999) |
| **Alcohol dehydrogenase: hydride transfer to NAD⁺** | The zinc-bound alkoxide of ethanol collapses to acetaldehyde while its C–H hydrogen is delivered as hydride to C4 of the nicotinamide ring (NAD⁺ modelled as 1-methylnicotinamide), giving the 1,4-dihydropyridine (NADH). Zn²⁺ is omitted. | Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 16; Fersht, Structure and Mechanism in Protein Science (1999) |
| **Kinase: in-line phosphoryl transfer from ATP** | An active-site Asp acts as general base while the substrate hydroxyl attacks the γ-phosphorus in line with the β,γ-bridging oxygen, which leaves as ADP. ATP is modelled as methyl triphosphate, the substrate as ethanol; Mg²⁺ is omitted. | Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 9 (nucleoside monophosphate kinases); Fersht, Structure and Mechanism in Protein Science (1999) |
