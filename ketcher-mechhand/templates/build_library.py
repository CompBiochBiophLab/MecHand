#!/usr/bin/env python3
"""Generate MecHand's structure library (rings, functional groups, biomolecules, reagents).

Usage (run from this directory):

    python build_library.py                  # write ../src/templates/library.json, then validate it
    python build_library.py --check          # validate the committed file only (no writing)
    python build_library.py --preview DIR    # also render a PNG contact sheet per category into DIR

Every structure is declared below as a SMILES string. The script

  * parses and sanitizes it with RDKit and stores the canonical (isomeric) SMILES;
  * lays it out in 2D (CoordGen), rescales it to Ketcher's bond length 1.0 (y up) and orients it;
  * computes wedge/hash bonds for stereocentres from the final coordinates;
  * writes Kekulé bond orders (1, 2, 3), formal charges, radicals and, for labelled atoms, the
    hydrogen count to show in thumbnails;
  * validates the result: the drawing is read back as a molfile and must give the same canonical
    SMILES (constitution, charges, stereo), Ketcher's own implicit-hydrogen rules must give the same
    hydrogens as RDKit for every atom, ids are unique, stereo labels match the declared ones.

R groups are written as dummy atoms. A fragment with a single R (`*`) gets the label "R", which the
app turns into a Ketcher pseudo-atom (shown as an italic R, exported as `*` / R# by Ketcher).  With
several R groups, `[1*]`, `[2*]`, `[3*]` (a plain `*` counts as 1) get the labels "R1", "R2", "R3",
which the app turns into Ketcher R-group labels (exported as standard R# atoms, `[*:n]` in SMILES).

Coordinates are rounded to 2 decimals; the output is deterministic for a given RDKit version.
Requirements: RDKit; matplotlib is not needed (previews use RDKit's own drawer).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from rdkit import Chem, RDLogger
from rdkit.Chem import rdCIPLabeler, rdDepictor, rdMolDescriptors

RDLogger.DisableLog("rdApp.*")

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "src" / "templates" / "library.json"
DECIMALS = 2



# --------------------------------------------------------------------------------------------
# Declarations
# --------------------------------------------------------------------------------------------
@dataclass
class E:
    id: str
    name: str
    smiles: str
    kw: tuple = ()                 # English synonyms, abbreviations, condensed formulas
    ca: tuple = ()                 # Catalan names
    rot: float = 0.0               # extra rotation (degrees, counter-clockwise) after orientation
    flip: bool = False             # mirror top <-> bottom after orientation
    align: Optional[tuple] = None  # (SMARTS, i, j): rotate so that matched atom i -> atom j points along +x
    up: Optional[str] = None       # SMARTS: after aligning, mirror so that this match lies above the axis
    coords: Optional[list] = None  # explicit (x, y) per atom, in SMILES atom order
    fd: Optional[str] = None       # conventional formula to show (e.g. NaBH4); the Hill formula is kept too
    cip: Optional[str] = None      # expected CIP labels, sorted and joined (e.g. "RSSSR" -> "RRRSS")
    inchikey: Optional[str] = None # expected InChIKey (cross-check for stereo-rich entries)
    cat: str = ""
    group: str = ""


def section(cat, group, entries):
    for e in entries:
        e.cat, e.group = cat, group
    return entries


# Chair cyclohexane, drawn the textbook way: three pairs of parallel bonds (C1-C2 || C4-C5 at +20 deg,
# C2-C3 || C5-C6 at -20 deg, C3-C4 || C6-C1 at +60 deg), left tip C1 low, right tip C4 high.
def _chair():
    steps = ((20.0, 0.85), (-20.0, 1.15), (60.0, 1.0), (200.0, 0.85), (160.0, 1.15))
    p = [(0.0, 0.0)]
    for deg, ln in steps:
        p.append((p[-1][0] + ln * math.cos(math.radians(deg)), p[-1][1] + ln * math.sin(math.radians(deg))))
    return p


RINGS = (
    section("ring", "Carbocycles", [
        E("cyclopropane", "Cyclopropane", "C1CC1", ca=("ciclopropà",), rot=-90),
        E("cyclobutane", "Cyclobutane", "C1CCC1", ca=("ciclobutà",)),
        E("cyclopentane", "Cyclopentane", "C1CCCC1", ca=("ciclopentà",)),
        E("cyclohexane", "Cyclohexane", "C1CCCCC1", ca=("ciclohexà",), rot=30),
        E("cyclohexane-chair", "Cyclohexane (chair)", "C1CCCCC1", kw=("chair conformation", "conformer"),
          ca=("ciclohexà cadira", "conformació de cadira"), coords=_chair()),
        E("cycloheptane", "Cycloheptane", "C1CCCCCC1", ca=("cicloheptà",)),
        E("cyclooctane", "Cyclooctane", "C1CCCCCCC1", ca=("ciclooctà",)),
        E("cyclohexene", "Cyclohexene", "C1=CCCCC1", ca=("ciclohexè",)),
        E("cyclopentadiene", "Cyclopentadiene", "C1=CCC=C1", kw=("cyclopenta-1,3-diene", "diene"), ca=("ciclopentadiè",)),
        E("gonane", "Steroid nucleus (gonane)", "C1CCC2C(C1)CCC1C2CCC2CCCC12", kw=("steroid", "sterane", "cyclopentanoperhydrophenanthrene"),
          ca=("esteroide", "nucli esteroide", "gonà")),
    ])
    + section("ring", "Aromatic hydrocarbons", [
        E("benzene", "Benzene", "c1ccccc1", kw=("arene", "aromatic ring", "phenyl ring"), ca=("benzè",), rot=30),
        E("naphthalene", "Naphthalene", "c1ccc2ccccc2c1", ca=("naftalè",)),
        E("anthracene", "Anthracene", "c1ccc2cc3ccccc3cc2c1", ca=("antracè",)),
        E("phenanthrene", "Phenanthrene", "c1ccc2c(c1)ccc1ccccc12", ca=("fenantrè",)),
    ])
    + section("ring", "Aromatic heterocycles", [
        E("pyridine", "Pyridine", "c1ccncc1", kw=("azine", "Py"), ca=("piridina",), rot=30),
        E("pyrrole", "Pyrrole", "c1cc[nH]c1", kw=("1H-pyrrole",), ca=("pirrole",)),
        E("furan", "Furan", "c1ccoc1", ca=("furà",)),
        E("thiophene", "Thiophene", "c1ccsc1", ca=("tiofè",)),
        E("imidazole", "Imidazole", "c1c[nH]cn1", kw=("1H-imidazole",), ca=("imidazole",)),
        E("pyrimidine", "Pyrimidine", "c1cncnc1", kw=("1,3-diazine",), ca=("pirimidina",), rot=30),
        E("purine", "Purine", "c1ncc2[nH]cnc2n1", kw=("9H-purine",), ca=("purina",)),
        E("indole", "Indole", "c1ccc2[nH]ccc2c1", kw=("1H-indole", "benzopyrrole"), ca=("indole",)),
        E("benzimidazole", "Benzimidazole", "c1ccc2[nH]cnc2c1", ca=("benzimidazole",)),
        E("quinoline", "Quinoline", "c1ccc2ncccc2c1", kw=("1-azanaphthalene",), ca=("quinoleïna",)),
        E("isoquinoline", "Isoquinoline", "c1ccc2cnccc2c1", ca=("isoquinoleïna",)),
    ])
    + section("ring", "Saturated heterocycles", [
        E("oxirane", "Oxirane (epoxide)", "C1CO1", kw=("epoxide", "ethylene oxide"), ca=("oxirà", "epòxid", "òxid d'etilè")),
        E("pyrrolidine", "Pyrrolidine", "C1CCNC1", kw=("azolidine",), ca=("pirrolidina",)),
        E("tetrahydrofuran", "Tetrahydrofuran", "C1CCOC1", kw=("THF", "oxolane", "solvent"), ca=("tetrahidrofurà", "dissolvent")),
        E("piperidine", "Piperidine", "C1CCNCC1", kw=("azinane",), ca=("piperidina",)),
        E("morpholine", "Morpholine", "C1COCCN1", ca=("morfolina",)),
        E("tetrahydropyran", "Tetrahydropyran", "C1CCOCC1", kw=("THP", "oxane"), ca=("tetrahidropirà", "oxà")),
        E("dioxane", "1,4-Dioxane", "C1COCCO1", kw=("dioxane", "solvent"), ca=("1,4-dioxà", "dioxà", "dissolvent")),
        E("butyrolactone", "γ-Butyrolactone", "O=C1CCCO1", kw=("gamma-butyrolactone", "GBL", "lactone"), ca=("γ-butirolactona", "lactona")),
        E("beta-lactam", "β-Lactam (azetidin-2-one)", "O=C1CCN1", kw=("beta-lactam", "azetidinone", "lactam"), ca=("β-lactama", "lactama")),
    ])
)

FUNCTIONAL = (
    section("group", "Hydrocarbon & halide", [
        E("alkene", "Alkene (vinyl)", "*C=C", kw=("olefin", "C=C", "vinyl group", "RCH=CH2"), ca=("alquè", "olefina", "vinil")),
        E("alkyne", "Alkyne (terminal)", "*C#C", kw=("acetylene", "C≡C", "RC≡CH"), ca=("alquí",)),
        E("alkyl-halide", "Alkyl halide", "*Br", kw=("haloalkane", "halide", "bromoalkane", "R-X", "RBr", "leaving group"),
          ca=("halur d'alquil", "haloalcà", "grup sortint")),
    ])
    + section("group", "Oxygen groups", [
        E("alcohol", "Alcohol", "*O", kw=("hydroxyl", "hydroxy", "ROH", "R-OH"), ca=("alcohol", "hidroxil")),
        E("alkoxide", "Alkoxide", "*[O-]", kw=("RO-", "alcoholate"), ca=("alcòxid", "alcoholat")),
        E("phenol", "Phenol", "Oc1ccccc1", kw=("hydroxybenzene", "ArOH", "PhOH"), ca=("fenol",)),
        E("ether", "Ether", "[1*]O[2*]", kw=("ROR'", "R-O-R'"), ca=("èter",)),
        E("enol", "Enol", "*C(O)=C", kw=("tautomer",), ca=("enol", "tautòmer")),
        E("enolate", "Enolate", "*C([O-])=C", kw=("enolate ion",), ca=("enolat", "ió enolat")),
        E("hemiacetal", "Hemiacetal", "[1*]C(O)O[2*]", kw=("hemiketal", "lactol"), ca=("hemiacetal", "hemicetal")),
        E("acetal", "Acetal", "[1*]C(O[2*])O[2*]", kw=("ketal",), ca=("acetal", "cetal")),
    ])
    + section("group", "Carbonyl groups", [
        E("aldehyde", "Aldehyde", "*C=O", kw=("formyl", "RCHO", "carbonyl"), ca=("aldehid", "carbonil")),
        E("ketone", "Ketone", "[1*]C([2*])=O", kw=("RCOR'", "carbonyl", "oxo"), ca=("cetona", "carbonil")),
        E("carboxylic-acid", "Carboxylic acid", "*C(=O)O", kw=("carboxyl", "RCOOH", "COOH", "acid"), ca=("àcid carboxílic", "carboxil")),
        E("carboxylate", "Carboxylate", "*C(=O)[O-]", kw=("RCOO-", "carboxylate anion", "conjugate base"), ca=("carboxilat", "anió carboxilat")),
        E("ester", "Ester", "[1*]C(=O)O[2*]", kw=("RCOOR'", "carboxylic ester"), ca=("èster",)),
        E("thioester", "Thioester", "[1*]C(=O)S[2*]", kw=("RCOSR'", "acyl-CoA"), ca=("tioèster",)),
        E("amide", "Amide (primary)", "*C(N)=O", kw=("RCONH2", "carboxamide"), ca=("amida", "amida primària")),
        E("amide-n", "Amide (N-substituted)", "[1*]C(=O)N[2*]", kw=("secondary amide", "RCONHR'", "peptide bond", "lactam"),
          ca=("amida secundària", "enllaç peptídic")),
        E("acyl-chloride", "Acyl chloride", "*C(=O)Cl", kw=("acid chloride", "RCOCl", "acyl halide"), ca=("clorur d'acil", "halur d'acil")),
        E("anhydride", "Anhydride", "[1*]C(=O)OC(=O)[2*]", kw=("acid anhydride", "carboxylic anhydride"), ca=("anhídrid", "anhídrid d'àcid")),
        E("protonated-carbonyl", "Protonated carbonyl", "[1*]C([2*])=[OH+]", kw=("oxocarbenium", "activated carbonyl", "acid catalysis"),
          ca=("carbonil protonat", "oxocarboni")),
        E("acylium", "Acylium ion", "*C#[O+]", kw=("RCO+", "Friedel-Crafts acylation"), ca=("ió acili", "acili")),
    ])
    + section("group", "Nitrogen groups", [
        E("amine-primary", "Amine (primary)", "*N", kw=("1° amine", "RNH2", "amino"), ca=("amina primària", "amina")),
        E("amine-secondary", "Amine (secondary)", "[1*]N[2*]", kw=("2° amine", "R2NH"), ca=("amina secundària",)),
        E("amine-tertiary", "Amine (tertiary)", "[1*]N([2*])[3*]", kw=("3° amine", "R3N"), ca=("amina terciària",)),
        E("ammonium-ion", "Ammonium (protonated amine)", "*[NH3+]", kw=("alkylammonium", "RNH3+", "conjugate acid"),
          ca=("ió amoni", "amina protonada")),
        E("imine", "Imine", "[1*]C([2*])=N[3*]", kw=("Schiff base", "R2C=NR"), ca=("imina", "base de Schiff")),
        E("iminium", "Iminium ion", "[1*]C([2*])=[NH+][3*]", kw=("protonated imine",), ca=("ió iminí", "imina protonada")),
        E("enamine", "Enamine", "*C(=C)N([2*])[2*]", kw=("R2N-C=C",), ca=("enamina",)),
        E("nitrile", "Nitrile", "*C#N", kw=("cyano", "RCN", "C≡N"), ca=("nitril", "ciano")),
        E("nitro", "Nitro group", "*[N+](=O)[O-]", kw=("nitro", "RNO2", "nitroalkane"), ca=("nitro", "grup nitro", "nitrocompost")),
        E("diazonium", "Diazonium ion", "*[N+]#N", kw=("RN2+", "arenediazonium"), ca=("ió diazoni", "diazoni")),
    ])
    + section("group", "Sulfur, phosphorus & boron", [
        E("thiol", "Thiol", "*S", kw=("mercaptan", "sulfhydryl", "RSH", "SH"), ca=("tiol", "mercaptà", "sulfhidril")),
        E("sulfide", "Sulfide (thioether)", "[1*]S[2*]", kw=("thioether", "RSR'"), ca=("sulfur", "tioèter")),
        E("disulfide", "Disulfide", "[1*]SS[2*]", kw=("RSSR'", "disulfide bridge", "cystine"), ca=("disulfur", "pont disulfur")),
        E("sulfonic-acid", "Sulfonic acid", "*S(=O)(=O)O", kw=("RSO3H",), ca=("àcid sulfònic",)),
        E("tosylate", "Tosylate (OTs)", "*OS(=O)(=O)c1ccc(C)cc1", kw=("OTs", "p-toluenesulfonate", "sulfonate ester", "leaving group"),
          ca=("tosilat", "grup sortint")),
        E("phosphate-ester", "Phosphate monoester", "*OP(=O)(O)O", kw=("phosphate", "phosphoryl", "ROPO3H2"), ca=("fosfat", "èster fosfat")),
        E("phosphodiester", "Phosphodiester", "[1*]OP(=O)(O)O[2*]", kw=("phosphate diester", "DNA backbone"), ca=("fosfodièster",)),
    ])
    + section("group", "Reactive intermediates", [
        E("tert-butyl-cation", "tert-Butyl cation", "C[C+](C)C", kw=("carbocation", "tertiary carbocation", "carbenium"),
          ca=("carbocatió", "catió terc-butil", "carbocatió terciari")),
        E("benzyl-cation", "Benzyl cation", "[CH2+]c1ccccc1", kw=("carbocation", "benzylic cation"), ca=("carbocatió", "catió benzílic")),
        E("methyl-anion", "Methyl anion", "[CH3-]", kw=("carbanion", "CH3-"), ca=("carbanió", "anió metil")),
        E("acetylide", "Acetylide", "*C#[C-]", kw=("carbanion", "alkynide", "RC≡C-"), ca=("acetilur", "carbanió")),
        E("tert-butyl-radical", "tert-Butyl radical", "C[C](C)C", kw=("radical", "free radical", "tertiary radical"),
          ca=("radical", "radical terc-butil")),
    ])
    + section("group", "Substituents & protecting groups", [
        E("phenyl", "Phenyl (Ph)", "*c1ccccc1", kw=("Ph", "aryl", "C6H5"), ca=("fenil", "aril")),
        E("benzyl", "Benzyl (Bn)", "*Cc1ccccc1", kw=("Bn", "PhCH2"), ca=("benzil",)),
        E("tert-butyl", "tert-Butyl (tBu)", "*C(C)(C)C", kw=("tBu", "t-Bu", "tert-butyl group"), ca=("terc-butil",)),
        E("acetyl", "Acetyl (Ac)", "*C(C)=O", kw=("Ac", "ethanoyl", "MeCO"), ca=("acetil",)),
        E("boc", "Boc", "*C(=O)OC(C)(C)C", kw=("tert-butoxycarbonyl", "protecting group"), ca=("terc-butoxicarbonil", "grup protector")),
    ])
)

_AA = ("[NX3][CX4H1,CX4H2][CX3](=O)[OX2H1]", 0, 2)   # backbone N -> carboxyl C along +x (N left, COOH right)
_SIDE = "[NX3][CX4H1]([!#1;!$([CX3](=O)[OX2H1])])"


def aa(id_, name, three, one, smiles, ca, cip, inchikey=None, kw=()):
    return E(id_, name, smiles, kw=(three, f"L-{name.lower()}", f"{three} ({one})", *kw), ca=ca,
             align=_AA, up=_SIDE, cip=cip, inchikey=inchikey)


BIO = (
    section("bio", "Amino acids", [
        aa("glycine", "Glycine", "Gly", "G", "NCC(=O)O", ("glicina",), ""),
        aa("alanine", "Alanine", "Ala", "A", "C[C@H](N)C(=O)O", ("alanina",), "S", "QNAYBMKLOCPYGJ-REOHCLBHSA-N"),
        aa("valine", "Valine", "Val", "V", "CC(C)[C@H](N)C(=O)O", ("valina",), "S"),
        aa("leucine", "Leucine", "Leu", "L", "CC(C)C[C@H](N)C(=O)O", ("leucina",), "S"),
        aa("isoleucine", "Isoleucine", "Ile", "I", "CC[C@H](C)[C@H](N)C(=O)O", ("isoleucina",), "SS", "AGPKZVBTJJNPAG-WHFBIAKZSA-N"),
        aa("proline", "Proline", "Pro", "P", "OC(=O)[C@@H]1CCCN1", ("prolina",), "S", "ONIBWKKTOPOVIA-BYPYZUCNSA-N"),
        aa("phenylalanine", "Phenylalanine", "Phe", "F", "N[C@@H](Cc1ccccc1)C(=O)O", ("fenilalanina",), "S"),
        aa("tryptophan", "Tryptophan", "Trp", "W", "N[C@@H](Cc1c[nH]c2ccccc12)C(=O)O", ("triptòfan",), "S", "QIVBCDIJIAJPQS-VIFPVBQESA-N"),
        aa("methionine", "Methionine", "Met", "M", "CSCC[C@H](N)C(=O)O", ("metionina",), "S"),
        aa("serine", "Serine", "Ser", "S", "N[C@@H](CO)C(=O)O", ("serina",), "S"),
        aa("threonine", "Threonine", "Thr", "T", "C[C@@H](O)[C@H](N)C(=O)O", ("treonina",), "RS", "AYFVYJQAPQTCCC-GBXIJSLDSA-N"),
        aa("cysteine", "Cysteine", "Cys", "C", "N[C@@H](CS)C(=O)O", ("cisteïna",), "R", "XUJNEKJLAYXESH-REOHCLBHSA-N"),
        aa("tyrosine", "Tyrosine", "Tyr", "Y", "N[C@@H](Cc1ccc(O)cc1)C(=O)O", ("tirosina",), "S"),
        aa("asparagine", "Asparagine", "Asn", "N", "NC(=O)C[C@H](N)C(=O)O", ("asparagina",), "S"),
        aa("glutamine", "Glutamine", "Gln", "Q", "NC(=O)CC[C@H](N)C(=O)O", ("glutamina",), "S"),
        aa("aspartic-acid", "Aspartic acid", "Asp", "D", "N[C@@H](CC(=O)O)C(=O)O", ("àcid aspàrtic", "aspartat"), "S", kw=("aspartate",)),
        aa("glutamic-acid", "Glutamic acid", "Glu", "E", "N[C@@H](CCC(=O)O)C(=O)O", ("àcid glutàmic", "glutamat"), "S", kw=("glutamate",)),
        aa("lysine", "Lysine", "Lys", "K", "NCCCC[C@H](N)C(=O)O", ("lisina",), "S"),
        aa("arginine", "Arginine", "Arg", "R", "N=C(N)NCCC[C@H](N)C(=O)O", ("arginina",), "S"),
        aa("histidine", "Histidine", "His", "H", "N[C@@H](Cc1c[nH]cn1)C(=O)O", ("histidina",), "S"),
    ])
    + section("bio", "Nucleobases & nucleotides", [
        E("adenine", "Adenine", "Nc1ncnc2[nH]cnc12", kw=("A", "purine base", "nucleobase"), ca=("adenina", "base nitrogenada")),
        E("guanine", "Guanine", "Nc1nc2[nH]cnc2c(=O)[nH]1", kw=("G", "purine base", "nucleobase"), ca=("guanina", "base nitrogenada")),
        E("cytosine", "Cytosine", "Nc1cc[nH]c(=O)n1", kw=("C", "pyrimidine base", "nucleobase"), ca=("citosina", "base nitrogenada")),
        E("thymine", "Thymine", "Cc1c[nH]c(=O)[nH]c1=O", kw=("T", "pyrimidine base", "nucleobase", "DNA"), ca=("timina", "base nitrogenada")),
        E("uracil", "Uracil", "O=c1cc[nH]c(=O)[nH]1", kw=("U", "pyrimidine base", "nucleobase", "RNA"), ca=("uracil", "base nitrogenada")),
        E("adenosine", "Adenosine", "Nc1ncnc2c1ncn2[C@@H]1O[C@H](CO)[C@@H](O)[C@H]1O", kw=("nucleoside",),
          ca=("adenosina", "nucleòsid"), cip="RRRS", inchikey="OIRDTQYFTABQOQ-KQYNXXCUSA-N"),
        E("atp", "ATP", "Nc1ncnc2c1ncn2[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)OP(=O)(O)O)[C@@H](O)[C@H]1O",
          kw=("adenosine triphosphate", "adenosine 5'-triphosphate", "nucleotide", "energy currency"),
          ca=("adenosina trifosfat", "trifosfat d'adenosina", "nucleòtid"), cip="RRRS", inchikey="ZKHQWZAMYRWXGA-KQYNXXCUSA-N"),
    ])
    + section("bio", "Sugars", [
        E("beta-d-glucose", "β-D-Glucopyranose", "OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O",
          kw=("glucose", "beta-D-glucose", "D-glucose", "hexose", "monosaccharide", "sugar", "C6H12O6"),
          ca=("glucosa", "β-D-glucopiranosa", "sucre", "monosacàrid"), cip="RRRSS", inchikey="WQZGKKKJIJFFOK-VFUOTHLCSA-N"),
        E("alpha-d-glucose", "α-D-Glucopyranose", "OC[C@H]1O[C@H](O)[C@H](O)[C@@H](O)[C@@H]1O",
          kw=("glucose", "alpha-D-glucose", "anomer", "hexose", "sugar"), ca=("glucosa", "α-D-glucopiranosa", "anòmer", "sucre"),
          cip="RRSSS", inchikey="WQZGKKKJIJFFOK-DVKNGEFBSA-N"),
        E("d-glucose-open", "D-Glucose (open chain)", "O=C[C@H](O)[C@@H](O)[C@H](O)[C@H](O)CO",
          kw=("glucose", "aldehydo-D-glucose", "aldohexose", "Fischer", "sugar"), ca=("glucosa", "glucosa oberta", "aldohexosa", "sucre"),
          cip="RRRS", inchikey="GZCGUPFRVQAUEE-SLPGGIOYSA-N"),
        E("beta-d-fructose", "β-D-Fructofuranose", "OC[C@@]1(O)O[C@H](CO)[C@@H](O)[C@@H]1O",
          kw=("fructose", "ketohexose", "sugar"), ca=("fructosa", "cetohexosa", "sucre"), cip="RRSS"),
        E("beta-d-ribose", "β-D-Ribofuranose", "OC[C@H]1O[C@@H](O)[C@H](O)[C@@H]1O",
          kw=("ribose", "D-ribose", "pentose", "RNA sugar"), ca=("ribosa", "pentosa", "sucre"), cip="RRRS"),
        E("deoxyribose", "2-Deoxy-β-D-ribofuranose", "OC[C@H]1O[C@@H](O)C[C@@H]1O",
          kw=("deoxyribose", "2-deoxyribose", "DNA sugar", "pentose"), ca=("desoxiribosa", "2-desoxiribosa", "sucre"), cip="RRS"),
        E("d-glyceraldehyde", "D-Glyceraldehyde", "O=C[C@H](O)CO", kw=("glyceraldehyde", "triose", "aldotriose"),
          ca=("D-gliceraldehid", "gliceraldehid", "triosa"), cip="R", inchikey="MNQZXJOMYWMBOU-VKHMYHEASA-N"),
    ])
    + section("bio", "Cofactors & metabolites", [
        E("nad-model", "NAD⁺ (nicotinamide ring)", "C[n+]1cccc(C(N)=O)c1",
          kw=("NAD+", "nicotinamide adenine dinucleotide", "1-methylnicotinamide", "oxidized", "hydride acceptor"),
          ca=("NAD+", "nicotinamida", "forma oxidada")),
        E("nadh-model", "NADH (dihydronicotinamide ring)", "CN1C=CCC(C(N)=O)=C1",
          kw=("NADH", "1,4-dihydronicotinamide", "reduced", "hydride donor"), ca=("NADH", "dihidronicotinamida", "forma reduïda")),
        E("plp", "Pyridoxal phosphate (PLP)", "Cc1ncc(COP(=O)(O)O)c(C=O)c1O",
          kw=("PLP", "pyridoxal 5'-phosphate", "vitamin B6", "coenzyme"), ca=("fosfat de piridoxal", "vitamina B6", "coenzim")),
        E("pyruvic-acid", "Pyruvic acid", "CC(=O)C(=O)O", kw=("pyruvate", "2-oxopropanoic acid", "glycolysis"),
          ca=("àcid pirúvic", "piruvat")),
        E("l-lactic-acid", "L-Lactic acid", "C[C@H](O)C(=O)O", kw=("lactate", "lactic acid", "(S)-lactic acid"),
          ca=("àcid làctic", "lactat"), cip="S", inchikey="JVTAAEKCZFNVCJ-REOHCLBHSA-N"),
        E("pep", "Phosphoenolpyruvic acid (PEP)", "C=C(OP(=O)(O)O)C(=O)O", kw=("PEP", "phosphoenolpyruvate", "glycolysis"),
          ca=("fosfoenolpiruvat",)),
        E("acetylcholine", "Acetylcholine", "CC(=O)OCC[N+](C)(C)C", kw=("ACh", "neurotransmitter", "acetylcholinesterase"),
          ca=("acetilcolina", "neurotransmissor")),
    ])
    + section("bio", "Lipids", [
        E("glycerol", "Glycerol", "OCC(O)CO", kw=("glycerin", "propane-1,2,3-triol"), ca=("glicerol", "glicerina")),
        E("palmitic-acid", "Palmitic acid", "CCCCCCCCCCCCCCCC(=O)O", kw=("hexadecanoic acid", "C16:0", "fatty acid", "palmitate"),
          ca=("àcid palmític", "àcid gras")),
        E("oleic-acid", "Oleic acid", "CCCCCCCC/C=C\\CCCCCCCC(=O)O", kw=("cis-9-octadecenoic acid", "C18:1", "fatty acid", "oleate"),
          ca=("àcid oleic", "àcid gras insaturat"), inchikey="ZQPPMHVWECSIRJ-KTKRTIGZSA-N"),
        E("cholesterol", "Cholesterol", "CC(C)CCC[C@@H](C)[C@H]1CC[C@H]2[C@@H]3CC=C4C[C@@H](O)CC[C@]4(C)[C@H]3CC[C@]12C",
          kw=("sterol", "steroid"), ca=("colesterol", "esterol"), inchikey="HVYWMOMLDIMFJA-DPAQBDIFSA-N"),
    ])
)

REAGENTS = (
    section("reagent", "Water & ions", [
        E("water", "Water", "O", kw=("H2O", "solvent"), ca=("aigua",)),
        E("hydroxide", "Hydroxide", "[OH-]", kw=("OH-", "base"), ca=("hidròxid", "ió hidròxid")),
        E("hydronium", "Hydronium", "[OH3+]", kw=("H3O+", "oxonium", "acid"), ca=("hidroni", "ió hidroni", "oxoni")),
        E("proton", "Proton", "[H+]", kw=("H+", "hydron", "acid"), ca=("protó",)),
        E("hydride", "Hydride", "[H-]", kw=("H-", "hydride ion"), ca=("hidrur", "ió hidrur")),
        E("ammonia", "Ammonia", "N", kw=("NH3",), ca=("amoníac",)),
        E("ammonium", "Ammonium", "[NH4+]", kw=("NH4+",), ca=("amoni", "ió amoni")),
        E("chloride", "Chloride", "[Cl-]", kw=("Cl-", "leaving group"), ca=("clorur", "ió clorur")),
        E("bromide", "Bromide", "[Br-]", kw=("Br-", "leaving group"), ca=("bromur", "ió bromur")),
        E("cyanide", "Cyanide", "[C-]#N", kw=("CN-", "nucleophile", "NaCN", "KCN"), ca=("cianur", "ió cianur")),
    ])
    + section("reagent", "Acids", [
        E("hcl", "Hydrogen chloride", "Cl", kw=("HCl", "hydrochloric acid"), ca=("àcid clorhídric", "clorur d'hidrogen")),
        E("sulfuric-acid", "Sulfuric acid", "O=S(=O)(O)O", kw=("H2SO4",), ca=("àcid sulfúric",)),
        E("nitric-acid", "Nitric acid", "O=[N+]([O-])O", kw=("HNO3",), ca=("àcid nítric",)),
        E("acetic-acid", "Acetic acid", "CC(=O)O", kw=("AcOH", "ethanoic acid", "CH3COOH", "vinegar"), ca=("àcid acètic",)),
        E("tfa", "Trifluoroacetic acid (TFA)", "O=C(O)C(F)(F)F", kw=("TFA", "CF3COOH"), ca=("àcid trifluoroacètic",)),
    ])
    + section("reagent", "Bases", [
        E("naoh", "Sodium hydroxide", "[Na+].[OH-]", kw=("NaOH", "caustic soda"), ca=("hidròxid de sodi", "sosa càustica"), fd="NaOH"),
        E("lda", "Lithium diisopropylamide (LDA)", "[Li+].CC(C)[N-]C(C)C", kw=("LDA", "strong base", "non-nucleophilic base"),
          ca=("diisopropilamidur de liti",)),
        E("kotbu", "Potassium tert-butoxide", "[K+].CC(C)(C)[O-]", kw=("KOtBu", "t-BuOK", "tBuOK", "bulky base"),
          ca=("terc-butòxid de potassi",), fd="KOtBu"),
        E("naoet", "Sodium ethoxide", "[Na+].CC[O-]", kw=("NaOEt", "EtONa", "alkoxide"), ca=("etòxid de sodi",), fd="NaOEt"),
        E("triethylamine", "Triethylamine", "CCN(CC)CC", kw=("Et3N", "TEA", "NEt3"), ca=("trietilamina",)),
        E("n-buli", "n-Butyllithium", "CCCC[Li]", kw=("n-BuLi", "BuLi", "nBuLi", "organolithium"), ca=("n-butil-liti", "butil-liti")),
    ])
    + section("reagent", "Reducing agents", [
        E("nabh4", "Sodium borohydride", "[Na+].[BH4-]", kw=("NaBH4", "borohydride", "hydride donor"), ca=("borohidrur de sodi",), fd="NaBH4"),
        E("lialh4", "Lithium aluminium hydride", "[Li+].[AlH4-]", kw=("LiAlH4", "LAH", "lithium aluminum hydride", "hydride donor"),
          ca=("hidrur de liti i alumini", "tetrahidruroaluminat de liti"), fd="LiAlH4"),
        E("dibal", "DIBAL-H", "CC(C)C[AlH]CC(C)C", kw=("DIBAL", "diisobutylaluminium hydride", "DIBAH"),
          ca=("hidrur de diisobutilalumini",)),
        E("hydrogen", "Hydrogen", "[H][H]", kw=("H2", "dihydrogen", "hydrogenation"), ca=("hidrogen", "dihidrogen")),
    ])
    + section("reagent", "Oxidizing agents", [
        E("mcpba", "mCPBA", "O=C(OO)c1cccc(Cl)c1", kw=("meta-chloroperoxybenzoic acid", "peracid", "epoxidation"),
          ca=("àcid m-cloroperoxibenzoic", "peràcid")),
        E("kmno4", "Potassium permanganate", "[K+].[O-][Mn](=O)(=O)=O", kw=("KMnO4", "permanganate"), ca=("permanganat de potassi",), fd="KMnO4"),
        E("pcc", "Pyridinium chlorochromate (PCC)", "[O-][Cr](=O)(=O)Cl.c1cc[nH+]cc1", kw=("PCC",), ca=("clorocromat de piridini",)),
        E("ozone", "Ozone", "[O-][O+]=O", kw=("O3", "ozonolysis"), ca=("ozó", "ozonòlisi")),
    ])
    + section("reagent", "Halogenating & activating agents", [
        E("bromine", "Bromine", "BrBr", kw=("Br2",), ca=("brom",)),
        E("nbs", "N-Bromosuccinimide (NBS)", "O=C1CCC(=O)N1Br", kw=("NBS", "allylic bromination"), ca=("N-bromosuccinimida",)),
        E("socl2", "Thionyl chloride", "O=S(Cl)Cl", kw=("SOCl2",), ca=("clorur de tionil",), fd="SOCl2"),
        E("pbr3", "Phosphorus tribromide", "BrP(Br)Br", kw=("PBr3",), ca=("tribromur de fòsfor",), fd="PBr3"),
        E("alcl3", "Aluminium chloride", "Cl[Al](Cl)Cl", kw=("AlCl3", "Lewis acid", "aluminum chloride", "Friedel-Crafts"),
          ca=("clorur d'alumini", "àcid de Lewis"), fd="AlCl3"),
        E("bf3", "Boron trifluoride", "FB(F)F", kw=("BF3", "Lewis acid"), ca=("trifluorur de bor", "àcid de Lewis"), fd="BF3"),
        E("oxalyl-chloride", "Oxalyl chloride", "O=C(Cl)C(=O)Cl", kw=("(COCl)2", "Swern oxidation"), ca=("clorur d'oxalil",)),
    ])
    + section("reagent", "Carbon nucleophiles", [
        E("mgbr-methyl", "Methylmagnesium bromide", "C[Mg]Br", kw=("MeMgBr", "CH3MgBr", "Grignard reagent", "organomagnesium"),
          ca=("bromur de metilmagnesi", "reactiu de Grignard"), fd="CH3MgBr"),
        E("wittig-ylide", "Phosphonium ylide (Wittig)", "[CH2-][P+](c1ccccc1)(c1ccccc1)c1ccccc1",
          kw=("Wittig reagent", "Ph3P=CH2", "methylenetriphenylphosphorane", "ylide"), ca=("ilur de fosfoni", "reactiu de Wittig")),
        E("diethyl-malonate", "Diethyl malonate", "CCOC(=O)CC(=O)OCC", kw=("malonic ester", "malonate"), ca=("malonat de dietil",)),
    ])
    + section("reagent", "Solvents", [
        E("dmso", "Dimethyl sulfoxide (DMSO)", "CS(C)=O", kw=("DMSO", "solvent"), ca=("dimetilsulfòxid", "dissolvent")),
        E("dmf", "Dimethylformamide (DMF)", "CN(C)C=O", kw=("DMF", "N,N-dimethylformamide", "solvent"), ca=("dimetilformamida", "dissolvent")),
        E("acetone", "Acetone", "CC(C)=O", kw=("propanone", "propan-2-one", "solvent"), ca=("acetona", "propanona", "dissolvent")),
        E("acetonitrile", "Acetonitrile", "CC#N", kw=("MeCN", "CH3CN", "solvent"), ca=("acetonitril", "dissolvent")),
        E("methanol", "Methanol", "CO", kw=("MeOH", "CH3OH", "solvent"), ca=("metanol", "dissolvent")),
        E("ethanol", "Ethanol", "CCO", kw=("EtOH", "solvent"), ca=("etanol", "dissolvent")),
        E("dichloromethane", "Dichloromethane (DCM)", "ClCCl", kw=("DCM", "CH2Cl2", "methylene chloride", "solvent"),
          ca=("diclorometà", "dissolvent")),
        E("diethyl-ether", "Diethyl ether", "CCOCC", kw=("Et2O", "ether", "solvent"), ca=("èter dietílic", "dissolvent")),
        E("ethyl-acetate", "Ethyl acetate", "CCOC(C)=O", kw=("EtOAc", "AcOEt", "solvent"), ca=("acetat d'etil", "dissolvent")),
        E("toluene", "Toluene", "Cc1ccccc1", kw=("methylbenzene", "PhMe", "solvent"), ca=("toluè", "metilbenzè", "dissolvent")),
    ])
    + section("reagent", "Small molecules & gases", [
        E("co2", "Carbon dioxide", "O=C=O", kw=("CO2",), ca=("diòxid de carboni",)),
        E("ethene", "Ethene", "C=C", kw=("ethylene", "alkene"), ca=("etè", "etilè")),
        E("formaldehyde", "Formaldehyde", "C=O", kw=("methanal", "HCHO"), ca=("formaldehid", "metanal")),
        E("acetaldehyde", "Acetaldehyde", "CC=O", kw=("ethanal", "CH3CHO"), ca=("acetaldehid", "etanal")),
        E("nitronium", "Nitronium ion", "O=[N+]=O", kw=("NO2+", "nitration", "electrophile"), ca=("ió nitroni", "nitroni")),
    ])
)

ENTRIES: list[E] = RINGS + FUNCTIONAL + BIO + REAGENTS
EXPLICIT = {e.id for e in ENTRIES if e.coords}   # hand-made drawings may have uneven bond lengths

CATEGORIES = ("ring", "group", "bio", "reagent")


# --------------------------------------------------------------------------------------------
# Ketcher's implicit-hydrogen rules (port of ketcher-core 3.18 Atom.calcValence, main-group
# elements). Returns None for elements we do not check (metals: Ketcher shows no hydrogens).
# --------------------------------------------------------------------------------------------
_GROUP = {"H": 1, "Li": 1, "Na": 1, "K": 1, "Mg": 2, "B": 3, "Al": 3, "C": 4, "Si": 4, "N": 5, "P": 5,
          "O": 6, "S": 6, "F": 7, "Cl": 7, "Br": 7, "I": 7}


def ketcher_h(label, charge, radical, conn):
    g = _GROUP.get(label)
    if g is None:
        return None
    rad = 1 if radical == 2 else (2 if radical in (1, 3) else 0)
    c, ac = charge, abs(charge)
    if g == 1:
        h = 1 - rad - conn - ac
    elif g == 2:
        h = 0 if conn + rad + ac in (0, 2) else -1
    elif g == 3:
        h = 4 - rad - conn if c == -1 else 3 - rad - conn - ac
    elif g == 4:
        h = 4 - rad - conn - ac
    elif g == 5:
        if c == 1:
            h = 4 - rad - conn
        elif c == 2:
            h = 3 - rad - conn
        elif rad + conn + ac <= 3:
            h = 3 - rad - conn - ac
        else:
            h = 5 - rad - conn - ac
    elif g == 6:
        if label == "O":
            h = 3 - rad - conn if c >= 1 else 2 - rad - conn - ac
        elif c == 1:
            h = 3 - rad - conn if conn <= 3 else 5 - rad - conn
        elif conn + rad + ac <= 2:
            h = 2 - rad - conn - ac
        elif conn + rad + ac <= 4:
            h = 4 - rad - conn - ac
        else:
            h = 6 - rad - conn - ac
    else:  # group 7
        if label == "F":
            h = 1 - rad - conn - ac
        elif c == 1:
            h = 2 - rad - conn if conn <= 2 else -1
        elif c == 0:
            if conn <= 1:
                h = 1 - rad - conn
            elif conn in (2, 4, 6):
                h = 0 if rad == 1 else -1
            elif conn > 7:
                h = -1
            else:
                h = 0
        else:
            h = 0
    return h  # negative -> Ketcher flags a valence error


# --------------------------------------------------------------------------------------------
# Geometry
# --------------------------------------------------------------------------------------------
def _rotate(pts, deg, origin=(0.0, 0.0)):
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    ox, oy = origin
    return [(ox + c * (x - ox) - s * (y - oy), oy + s * (x - ox) + c * (y - oy)) for x, y in pts]


def _match(m, smarts):
    q = Chem.MolFromSmarts(smarts)
    if q is None:
        raise ValueError(f"bad SMARTS {smarts}")
    hits = m.GetSubstructMatches(q)
    return hits[0] if hits else None


def _coords(m):
    """CoordGen coordinates of one connected molecule, rescaled to bond length 1.0."""
    n = m.GetNumAtoms()
    if n == 1:
        return [(0.0, 0.0)]
    rdDepictor.SetPreferCoordGen(True)
    pts = None
    for canon in (True, False):          # canonOrient fails (NaN) on H-only species such as H2
        rdDepictor.Compute2DCoords(m, canonOrient=canon)
        conf = m.GetConformer()
        pts = [(conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y) for i in range(n)]
        if not any(math.isnan(v) for p in pts for v in p):
            break
    if any(math.isnan(v) for p in pts for v in p):
        pts = [(float(i), 0.0) for i in range(n)]
    if m.GetNumBonds():
        mean = sum(math.dist(pts[b.GetBeginAtomIdx()], pts[b.GetEndAtomIdx()]) for b in m.GetBonds()) / m.GetNumBonds()
        pts = [(x / mean, y / mean) for x, y in pts]
    return pts


def _salt_coords(m):
    """Lay out the fragments of a salt separately, left to right: largest first, counter-ions after."""
    frag_atoms = Chem.GetMolFrags(m, asMols=False, sanitizeFrags=False)
    frag_mols = Chem.GetMolFrags(m, asMols=True, sanitizeFrags=False)
    order = sorted(range(len(frag_atoms)), key=lambda k: (-frag_mols[k].GetNumHeavyAtoms(), k))
    pts = [None] * m.GetNumAtoms()
    x = 0.0
    for k in order:
        sub = _coords(Chem.Mol(frag_mols[k]))
        xs, ys = [p[0] for p in sub], [p[1] for p in sub]
        cy = (min(ys) + max(ys)) / 2
        dx = x - min(xs)
        for idx, (px, py) in zip(frag_atoms[k], sub):
            pts[idx] = (px + dx, py - cy)
        x = max(xs) + dx + 1.6            # room for the ion labels
    return pts


def layout(e: E, m):
    """2D coordinates (bond length 1.0, y up, centred) for the atoms of m, oriented as declared."""
    n = m.GetNumAtoms()
    if e.coords:
        if len(e.coords) != n:
            raise ValueError(f"{e.id}: {len(e.coords)} coordinates for {n} atoms")
        pts = [tuple(map(float, p)) for p in e.coords]
    elif len(Chem.GetMolFrags(m)) > 1:
        pts = _salt_coords(m)
    else:
        pts = _coords(m)

    def point_axis(a, b, deg=0.0):
        """Rotate about atom a so that a -> b points at deg."""
        nonlocal pts
        ang = math.degrees(math.atan2(pts[b][1] - pts[a][1], pts[b][0] - pts[a][0]))
        pts = _rotate(pts, deg - ang, pts[a])

    dummies = sorted((a for a in m.GetAtoms() if a.GetAtomicNum() == 0), key=lambda a: (a.GetIsotope(), a.GetIdx()))
    if e.align:
        smarts, i, j = e.align
        hit = _match(m, smarts)
        if hit is None:
            raise ValueError(f"{e.id}: align SMARTS does not match")
        point_axis(hit[i], hit[j])
    elif dummies and dummies[0].GetDegree() == 1:
        r = dummies[0]
        x_atom = r.GetNeighbors()[0]
        xi = x_atom.GetIdx()
        # Trigonal centre with a C=O / C=N / S=O-type double bond (carbonyls, imines...): the double
        # bond points straight up, R goes down-left (the textbook "Y" drawing of R-C(=O)-X).
        hetero = [b.GetOtherAtom(x_atom) for b in x_atom.GetBonds()
                  if b.GetBondType() == Chem.BondType.DOUBLE and b.GetOtherAtom(x_atom).GetSymbol() in ("O", "N", "S")]
        if x_atom.GetDegree() == 3 and x_atom.GetFormalCharge() == 0 and hetero:
            point_axis(xi, hetero[0].GetIdx(), 90.0)
            if pts[r.GetIdx()][0] > pts[xi][0]:
                pts = [(2 * pts[xi][0] - px, py) for px, py in pts]
        else:
            point_axis(xi, r.GetIdx(), 180.0)   # R on the left, bond horizontal
            doubles = [b for b in m.GetBonds() if b.GetBondType() == Chem.BondType.DOUBLE]
            if doubles:
                mean_all = sum(p[1] for p in pts) / n
                mean_dbl = sum((pts[b.GetBeginAtomIdx()][1] + pts[b.GetEndAtomIdx()][1]) / 2 for b in doubles) / len(doubles)
                if mean_dbl < mean_all - 1e-6:   # double bonds up, single-bonded groups down
                    pts = [(px, 2 * pts[xi][1] - py) for px, py in pts]
    if e.up:
        hit = _match(m, e.up)
        if hit is not None:
            # Mirror if the side-chain atom lies below the line through the backbone atom.
            if pts[hit[2]][1] < pts[hit[1]][1] - 1e-6:
                pts = [(x, -y) for x, y in pts]
    if e.rot:
        pts = _rotate(pts, e.rot)
    if e.flip:
        pts = [(x, -y) for x, y in pts]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    return [(round(x - cx, DECIMALS) + 0.0, round(y - cy, DECIMALS) + 0.0) for x, y in pts]


# --------------------------------------------------------------------------------------------
# Building one entry
# --------------------------------------------------------------------------------------------
BOND_ORDER = {Chem.BondType.SINGLE: 1, Chem.BondType.DOUBLE: 2, Chem.BondType.TRIPLE: 3}
RADICAL_CODE = {0: 0, 1: 2, 2: 1}   # RDKit radical electrons -> KET radical (2 doublet, 1 singlet)


def label_of(atom):
    if atom.GetAtomicNum() == 0:
        n_r = sum(a.GetAtomicNum() == 0 for a in atom.GetOwningMol().GetAtoms())
        return "R" if n_r == 1 else f"R{atom.GetIsotope() or 1}"
    return atom.GetSymbol()


def hill_formula(m):
    """Hill formula of the non-dummy atoms with RDKit's charge suffix (e.g. C2H3O2-, BH4Na)."""
    mm = Chem.RWMol(m)
    for a in sorted((a.GetIdx() for a in mm.GetAtoms() if a.GetAtomicNum() == 0), reverse=True):
        mm.RemoveAtom(a)
    return rdMolDescriptors.CalcMolFormula(mm.GetMol())


def build(e: E):
    m = Chem.MolFromSmiles(e.smiles)
    if m is None:
        raise ValueError(f"{e.id}: SMILES does not parse/sanitize: {e.smiles}")
    canonical = Chem.MolToSmiles(m)
    has_r = any(a.GetAtomicNum() == 0 for a in m.GetAtoms())

    # Stereo expectations (from the SMILES itself).
    rdCIPLabeler.AssignCIPLabels(m)
    cip = "".join(sorted(a.GetProp("_CIPCode") for a in m.GetAtoms() if a.HasProp("_CIPCode")))
    if e.cip is not None and cip != "".join(sorted(e.cip)):
        raise ValueError(f"{e.id}: CIP labels {cip!r}, expected {''.join(sorted(e.cip))!r}")
    if e.inchikey:
        key = Chem.MolToInchiKey(m)
        if key != e.inchikey:
            raise ValueError(f"{e.id}: InChIKey {key}, expected {e.inchikey}")

    pts = layout(e, m)
    conf = Chem.Conformer(m.GetNumAtoms())
    for i, (x, y) in enumerate(pts):
        conf.SetAtomPosition(i, (x, y, 0.0))
    m.RemoveAllConformers()
    cid = m.AddConformer(conf, assignId=True)
    Chem.WedgeMolBonds(m, m.GetConformer(cid))
    mk = Chem.Mol(m)
    Chem.Kekulize(mk, clearAromaticFlags=True)

    atoms, conn = [], [0] * mk.GetNumAtoms()
    bonds = []
    for b in mk.GetBonds():
        i, j = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        order = BOND_ORDER[b.GetBondType()]
        conn[i] += order
        conn[j] += order
        d = b.GetBondDir()
        stereo = 1 if d == Chem.BondDir.BEGINWEDGE else 6 if d == Chem.BondDir.BEGINDASH else 0
        bonds.append([i, j, order, stereo] if stereo else [i, j, order])
    for a in mk.GetAtoms():
        i = a.GetIdx()
        label = label_of(a)
        charge = a.GetFormalCharge()
        radical = RADICAL_CODE[a.GetNumRadicalElectrons()]
        h = a.GetTotalNumHs()
        if a.GetAtomicNum() != 0:
            kh = ketcher_h(label, charge, radical, conn[i])
            if kh is not None and kh != h:
                raise ValueError(f"{e.id}: atom {i} {label}: Ketcher would give {kh} H, RDKit has {h}")
        # Atoms the thumbnails label (and therefore need an H count for): heteroatoms, isolated
        # carbons, and terminal charged or radical carbons (cyanide, the CH2- of an ylide).
        shown = label != "C" or a.GetDegree() == 0 or (a.GetDegree() == 1 and (charge or radical))
        rec = [label, pts[i][0], pts[i][1]]
        extra = [h if shown else 0, charge, radical]
        while extra and extra[-1] == 0:
            extra.pop()
        atoms.append(rec + extra)

    out = {"id": e.id, "name": e.name, "cat": e.cat, "group": e.group}
    kws = []
    for k in (*e.kw, *e.ca):
        if k not in kws and k != e.name:
            kws.append(k)
    out["kw"] = kws
    if not has_r:
        out["formula"] = hill_formula(m)
    if e.fd:
        out["fd"] = e.fd
    out["smiles"] = canonical
    out["atoms"] = atoms
    out["bonds"] = bonds
    return out


# --------------------------------------------------------------------------------------------
# Validation of the written data (works on the JSON alone + RDKit)
# --------------------------------------------------------------------------------------------
def molblock(rec):
    lines = ["", "  build_library", "", f"{len(rec['atoms']):3d}{len(rec['bonds']):3d}  0  0  0  0  0  0  0  0999 V2000"]
    charges, radicals = [], []
    for k, a in enumerate(rec["atoms"]):
        label = a[0]
        sym = "*" if label.startswith("R") else label
        lines.append(f"{a[1]:10.4f}{a[2]:10.4f}{0:10.4f} {sym:<3} 0  0  0  0  0  0  0  0  0  0  0  0")
        if len(a) > 4 and a[4]:
            charges.append((k + 1, a[4]))
        if len(a) > 5 and a[5]:
            radicals.append((k + 1, a[5]))
    for b in rec["bonds"]:
        st = b[3] if len(b) > 3 else 0
        lines.append(f"{b[0] + 1:3d}{b[1] + 1:3d}{b[2]:3d}{st:3d}")
    for tag, items in (("CHG", charges), ("RAD", radicals)):
        for k in range(0, len(items), 8):
            chunk = items[k:k + 8]
            lines.append(f"M  {tag}{len(chunk):3d}" + "".join(f" {i:3d} {v:3d}" for i, v in chunk))
    lines.append("M  END")
    return "\n".join(lines)


def strip_dummy_isotopes(smiles):
    m = Chem.MolFromSmiles(smiles)
    for a in m.GetAtoms():
        if a.GetAtomicNum() == 0:
            a.SetIsotope(0)
    return Chem.MolToSmiles(m)


def validate(data):
    problems = []
    ids = [r["id"] for r in data]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        problems.append(f"duplicate ids: {sorted(dup)}")
    for c in CATEGORIES:
        if not any(r["cat"] == c for r in data):
            problems.append(f"empty category {c}")
    for r in data:
        rid = r["id"]
        if not rid.replace("-", "").isalnum() or rid != rid.lower():
            problems.append(f"{rid}: id must be lower-case letters, digits and '-'")
        m = Chem.MolFromSmiles(r["smiles"])
        if m is None or Chem.MolToSmiles(m) != r["smiles"]:
            problems.append(f"{rid}: stored SMILES is not canonical")
            continue
        n = len(r["atoms"])
        for b in r["bonds"]:
            if not (0 <= b[0] < n and 0 <= b[1] < n) or b[0] == b[1] or b[2] not in (1, 2, 3):
                problems.append(f"{rid}: bad bond {b}")
        for b in r["bonds"]:
            ln = math.dist(r["atoms"][b[0]][1:3], r["atoms"][b[1]][1:3])
            if not (0.9 < ln < 1.1 or (r["id"] in EXPLICIT and 0.7 < ln < 1.3)):
                problems.append(f"{rid}: bond {b[:2]} has length {ln:.2f}")
        for i in range(n):
            for j in range(i + 1, n):
                if math.dist(r["atoms"][i][1:3], r["atoms"][j][1:3]) < 0.45:
                    problems.append(f"{rid}: atoms {i} and {j} overlap")
        back = Chem.MolFromMolBlock(molblock(r), removeHs=False)
        if back is None:
            problems.append(f"{rid}: drawing does not read back as a molfile")
            continue
        got = Chem.MolToSmiles(back)
        want = strip_dummy_isotopes(r["smiles"])
        if got != want:
            problems.append(f"{rid}: drawing reads back as {got}, expected {want}")
        if "formula" in r and r["formula"] != hill_formula(m):
            problems.append(f"{rid}: formula {r['formula']} != {hill_formula(m)}")
    return problems


# --------------------------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------------------------
def dumps(data):
    """One entry per line: small diffs, still valid JSON."""
    return "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in data) + "\n]\n"


def preview(data, out_dir):
    from rdkit.Chem import Draw

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for c in CATEGORIES:
        mols, legends = [], []
        for r in data:
            if r["cat"] != c:
                continue
            mols.append(Chem.MolFromMolBlock(molblock(r), removeHs=False))
            legends.append(r["id"])
        img = Draw.MolsToGridImage(mols, molsPerRow=8, subImgSize=(220, 180), legends=legends, useSVG=False)
        img.save(out_dir / f"library-{c}.png")
    print(f"previews written to {out_dir}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="validate the committed library.json only")
    ap.add_argument("--preview", metavar="DIR", help="also write PNG contact sheets to DIR")
    args = ap.parse_args()

    if args.check:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        fresh = [build(e) for e in ENTRIES]
        if fresh != data:
            print("library.json is out of date: run build_library.py", file=sys.stderr)
            sys.exit(1)
    else:
        data = [build(e) for e in ENTRIES]
        OUT.write_text(dumps(data), encoding="utf-8")
    problems = validate(data)
    for p in problems:
        print("ERROR", p, file=sys.stderr)
    counts = {c: sum(r["cat"] == c for r in data) for c in CATEGORIES}
    print(f"{len(data)} structures {counts}; {OUT.stat().st_size} bytes" + ("" if problems else "; all checks passed"))
    if args.preview:
        preview(data, args.preview)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
