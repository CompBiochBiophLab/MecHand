#!/usr/bin/env python3
"""Generate MecHand's standard reaction-mechanism templates as Ketcher KET files.

Usage (run from this directory):

    python build_templates.py                  # write KET files + index.json, then validate them
    python build_templates.py --preview DIR    # ...and also render one PNG preview per template into DIR
    python build_templates.py --check          # only validate the files already on disk

Outputs (relative to this file):
    ../src/templates/mechanisms/<id>.ket
    ../src/templates/index.json

Requirements: RDKit (2D coordinates) and, for --preview only, matplotlib.
The output is deterministic for a given RDKit version (CoordGen depictions, coordinates rounded).

Conventions (see README.md):
  * KET coordinates are Ketcher units (bond length 1.0) with y pointing UP.
  * Curved arrows are Ketcher elliptical-arc arrows: a half-ellipse from pos[0] to pos[1] whose
    semi-axes are |pos[1]-pos[0]|/2 along the chord and |height| across it.  In this generator a
    positive *bulge* means "bulge to the LEFT of start->end in the y-up frame"; the value written to
    the file is KET_HEIGHT_SIGN * bulge, so the convention can be flipped globally in one place.
    (Reading ketcher-core 3.18's draw.js/rerxnarrow.js: height >= 0 -> SVG sweep-flag 1 in the
    y-down canvas, i.e. visually left of the travel direction; KET y is negated on load but height is
    not, so +height is also "left" in the y-up KET frame.  To be confirmed in a browser.)
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Union

# --------------------------------------------------------------------------------------------
# Global constants
# --------------------------------------------------------------------------------------------
KET_HEIGHT_SIGN = 1          # flip to -1 if Ketcher turns out to bulge the other way

SPECIES_GAP = 1.5            # bbox-to-bbox spacing between species of one stage (plus sits in the middle)
ARROW_GAP = 0.9              # space between a stage and the reaction arrow
ARROW_LEN = 2.0              # length of the straight reaction arrow
ATOM_OFFSET = 0.3            # curved-arrow endpoint offset from an atom centre
BOND_SRC_OFFSET = 0.06       # curved-arrow tail offset from a bond midpoint
BOND_DST_OFFSET = 0.15       # curved-arrow head offset from a bond midpoint
DECIMALS = 4

MODE_2E = "elliptical-arc-arrow-open-angle"
MODE_1E = "elliptical-arc-arrow-open-half-angle"
MODE_RXN = "open-angle"
CURVED_MODES = {MODE_2E, MODE_1E, "elliptical-arc-arrow-filled-bow", "elliptical-arc-arrow-filled-triangle"}

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / "src" / "templates"
MECH_DIR = OUT_DIR / "mechanisms"

# --------------------------------------------------------------------------------------------
# Small vector helpers (y-up frame)
# --------------------------------------------------------------------------------------------
def v_add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def v_sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def v_mul(a, k):
    return (a[0] * k, a[1] * k)


def v_len(a):
    return math.hypot(a[0], a[1])


def v_unit(a):
    n = v_len(a)
    return (a[0] / n, a[1] / n) if n > 1e-12 else (1.0, 0.0)


def v_left(u):
    """Left normal of a direction in the y-up frame (rotate +90 degrees)."""
    return (-u[1], u[0])


def v_dir(deg):
    return (math.cos(math.radians(deg)), math.sin(math.radians(deg)))


def pol(origin, deg, r=1.0):
    """Point at distance r from origin in direction deg (degrees, counter-clockwise, y-up)."""
    return v_add(origin, v_mul(v_dir(deg), r))


def seg_dist(p, a, b):
    ab = v_sub(b, a)
    t = 0.0
    den = ab[0] ** 2 + ab[1] ** 2
    if den > 1e-12:
        t = max(0.0, min(1.0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / den))
    return v_len(v_sub(p, v_add(a, v_mul(ab, t))))


# --------------------------------------------------------------------------------------------
# Ketcher's implicit-hydrogen rules (port of ketcher-core 3.18 Atom.calcValence, subset of elements)
# Used for validation (H balance, valence warnings) and preview labels.
# --------------------------------------------------------------------------------------------
_GROUP = {"H": 1, "Li": 1, "Na": 1, "K": 1, "Mg": 2, "Zn": 2, "B": 3, "Al": 3, "C": 4, "Si": 4,
          "N": 5, "P": 5, "O": 6, "S": 6, "F": 7, "Cl": 7, "Br": 7, "I": 7, "Fe": 8, "Pt": 8}


def radical_electrons(radical):
    return 1 if radical == 2 else (2 if radical in (1, 3) else 0)


def ketcher_implicit_h(label, charge, radical, conn):
    """Return (implicit H count, badConn) the way Ketcher computes them (conn = sum of bond orders)."""
    rad = radical_electrons(radical)
    c = charge or 0
    ac = abs(c)
    g = _GROUP.get(label)
    h = 0
    if g is None:
        return 0, False
    if g == 1:
        h = 1 - rad - conn - ac if label in ("H", "Li", "Na", "K") else 0
    elif g == 2:
        h = 0 if conn + rad + ac in (0, 2) else -1
    elif g == 3:
        h = (4 - rad - conn) if c == -1 else (3 - rad - conn - ac)
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
            h = (3 - rad - conn) if c >= 1 else (2 - rad - conn - ac)
        else:  # S: only the simple branches are needed here
            s = conn + rad + ac
            h = 2 - s if s <= 2 else (4 - s if s <= 4 else 6 - s)
    elif g == 7:
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
    elif g == 8:
        s = conn + rad + ac
        if label == "Pt":
            h = 2 - s if s <= 2 else (4 - s if s <= 4 else -1)
        else:
            h = 0 if s == 0 else -1
    if h < 0:
        return 0, True
    return h, False


# --------------------------------------------------------------------------------------------
# Data model
# --------------------------------------------------------------------------------------------
@dataclass
class Species:
    atoms: list                      # dicts: label, x, y, charge, radical
    bonds: list                      # dicts: a, b, order, stereo (0 | 1 wedge | 6 hash)
    dy: float = 0.0                  # vertical shift after centring on the stage baseline
    gap: Optional[float] = None      # spacing before this species (default SPECIES_GAP)
    yalign: Optional[tuple] = None   # (my_atom, other_species, other_atom[, dy]) -> align atom heights


@dataclass
class At:
    """Curved-arrow endpoint at an atom (lone pair / radical electron source, or bond-forming target)."""
    s: int
    i: int
    r: Optional[float] = None        # offset from the atom centre
    ang: Optional[float] = None      # absolute offset direction (deg); default: towards the bulge side


@dataclass
class Bd:
    """Curved-arrow endpoint at the midpoint of the i-j bond (or i...j pair) of species s."""
    s: int
    i: int
    j: int
    r: Optional[float] = None
    ang: Optional[float] = None


Endpoint = Union[At, Bd]


@dataclass
class Curved:
    src: Endpoint
    dst: Endpoint
    e: int = 2                       # 2 = full arrow, 1 = fishhook
    side: str = "auto"               # 'auto' | 'left' | 'right' (relative to src->dst, y-up)
    h: Optional[float] = None        # |bulge| override


@dataclass
class Stage:
    species: list
    arrows: list = field(default_factory=list)
    plus: bool = True                # draw plus nodes between the species of this stage


@dataclass
class Mechanism:
    id: str
    title: str
    category: str
    description: str
    electrons: str
    reference: str
    stages: list


# --------------------------------------------------------------------------------------------
# Species builders
# --------------------------------------------------------------------------------------------
STEREO_CODES = {"wedge": 1, "hash": 6}


def _finish(atoms, bonds, stereo, layout):
    if stereo:
        for (i, j), kind in stereo.items():
            for b in bonds:
                if {b["a"], b["b"]} == {i, j}:
                    b["a"], b["b"] = i, j          # narrow end of the wedge = first atom
                    b["stereo"] = STEREO_CODES[kind]
                    break
            else:
                raise ValueError(f"stereo bond {i}-{j} not found")
    return Species(atoms=atoms, bonds=bonds, **layout)


def mol(smiles, orient=None, flip=False, place=None, stereo=None, **layout):
    """Species from SMILES (written Kekulé form is preserved), laid out with RDKit/CoordGen.

    orient=(i, j, deg): rotate so that the vector atom i -> atom j points at deg.
    flip: mirror across that axis (or across the x axis if no orient).
    place={k: (anchor, deg[, r])}: move atom k to anchor + r*dir(deg) after orientation.
    stereo={(i, j): 'wedge'|'hash'}: wedge/hash bond with its narrow end at atom i.
    """
    from rdkit import Chem
    from rdkit.Chem import rdDepictor

    params = Chem.SmilesParserParams()
    params.removeHs = False
    params.sanitize = False
    m = Chem.MolFromSmiles(smiles, params)
    if m is None:
        raise ValueError(f"bad SMILES {smiles}")
    Chem.SanitizeMol(m, Chem.SanitizeFlags.SANITIZE_ALL ^ Chem.SanitizeFlags.SANITIZE_SETAROMATICITY)
    rdDepictor.SetPreferCoordGen(True)
    rdDepictor.Compute2DCoords(m)
    conf = m.GetConformer()
    pts = [(conf.GetAtomPosition(k).x, conf.GetAtomPosition(k).y) for k in range(m.GetNumAtoms())]
    if m.GetNumBonds():
        mean = sum(v_len(v_sub(pts[b.GetBeginAtomIdx()], pts[b.GetEndAtomIdx()])) for b in m.GetBonds()) / m.GetNumBonds()
        pts = [v_mul(p, 1.0 / mean) for p in pts]   # RDKit uses 1.5; normalise to Ketcher's 1.0
    if orient:
        i, j, deg = orient
        cur = math.atan2(pts[j][1] - pts[i][1], pts[j][0] - pts[i][0])
        rot = math.radians(deg) - cur
        c, s = math.cos(rot), math.sin(rot)
        o = pts[i]
        pts = [(o[0] + c * (p[0] - o[0]) - s * (p[1] - o[1]), o[1] + s * (p[0] - o[0]) + c * (p[1] - o[1])) for p in pts]
        if flip:
            u = v_dir(deg)
            out = []
            for p in pts:
                d = v_sub(p, o)
                along = d[0] * u[0] + d[1] * u[1]
                out.append(v_sub(v_mul(v_add(o, v_mul(u, along)), 2), p))
            pts = out
    elif flip:
        pts = [(p[0], -p[1]) for p in pts]
    for k, spec in (place or {}).items():
        anchor, deg = spec[0], spec[1]
        r = spec[2] if len(spec) > 2 else 1.0
        pts[k] = pol(pts[anchor], deg, r)

    atoms = []
    for a in m.GetAtoms():
        x, y = pts[a.GetIdx()]
        atoms.append({"label": a.GetSymbol(), "x": x, "y": y, "charge": a.GetFormalCharge(),
                      "radical": 2 if a.GetNumRadicalElectrons() == 1 else 0})
    order = {Chem.BondType.SINGLE: 1, Chem.BondType.DOUBLE: 2, Chem.BondType.TRIPLE: 3}
    bonds = [{"a": b.GetBeginAtomIdx(), "b": b.GetEndAtomIdx(), "order": order[b.GetBondType()], "stereo": 0}
             for b in m.GetBonds()]
    return _finish(atoms, bonds, stereo, layout)


def xmol(atoms, bonds, **layout):
    """Species with explicit coordinates (Ketcher units).

    atoms: [(label, (x, y)[, {"charge": c, "radical": 2}]), ...]
    bonds: [(i, j[, order[, 'wedge'|'hash']]), ...]   (wedge/hash narrow end at atom i)
    """
    at = []
    for spec in atoms:
        label, (x, y) = spec[0], spec[1]
        extra = spec[2] if len(spec) > 2 else {}
        at.append({"label": label, "x": x, "y": y, "charge": extra.get("charge", 0), "radical": extra.get("radical", 0)})
    bd = []
    for spec in bonds:
        i, j = spec[0], spec[1]
        order = spec[2] if len(spec) > 2 else 1
        st = STEREO_CODES[spec[3]] if len(spec) > 3 and spec[3] else 0
        bd.append({"a": i, "b": j, "order": order, "stereo": st})
    return Species(atoms=at, bonds=bd, **layout)


# --------------------------------------------------------------------------------------------
# Mechanism definitions
# --------------------------------------------------------------------------------------------
def umbrella(center, center_charge, lead, lead_charge, ligand, ligand_charge, lead_side, angs=(110, 225, 255)):
    """Tetrahedral X-Y3 'umbrella' with the three Y opening away from `lead`.

    lead_side='right': lead at 0 deg, ligands at angs = (plain, wedge, hash), default 110/225/255.
    lead_side='left' : mirror image (the inverted umbrella after Walden inversion)."""
    c = (0.0, 0.0)
    if lead_side == "right":
        lp = pol(c, 0)
    else:
        lp, angs = pol(c, 180), tuple((180 - a) % 360 for a in angs)
    atoms = [(center, c, {"charge": center_charge}), (lead, lp, {"charge": lead_charge})]
    atoms += [(ligand, pol(c, a), {"charge": ligand_charge}) for a in angs]
    bonds = [(0, 1), (0, 2), (0, 3, 1, "wedge"), (0, 4, 1, "hash")]
    return atoms, bonds


def sn2():
    ra, rb = umbrella("C", 0, "Br", 0, "H", 0, "right")
    pa, pb = umbrella("C", 0, "O", 0, "H", 0, "left")
    return Mechanism(
        id="sn2",
        title="SN2: hydroxide + bromomethane",
        category="organic",
        description="Concerted backside attack of hydroxide on bromomethane with loss of bromide; "
                    "the C–H 'umbrella' inverts (Walden inversion).",
        electrons="2e",
        reference="Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 15",
        stages=[
            Stage([mol("[OH-]"), xmol(ra, rb)],
                  [Curved(At(0, 0), At(1, 0, ang=150)),
                   Curved(Bd(1, 0, 1), At(1, 1))]),
            Stage([xmol(pa, pb), mol("[Br-]")]),
        ])


def e2():
    # 2-bromopropane with the beta-H (atom 2) anti-periplanar to Br (atom 3).
    sub = xmol([("C", (0, 0)), ("C", (1, 0)), ("H", (0, 1)), ("Br", (1, -1)), ("C", pol((1, 0), 30))],
               [(0, 1), (0, 2), (1, 3), (1, 4)])
    return Mechanism(
        id="e2",
        title="E2: ethoxide + 2-bromopropane",
        category="organic",
        description="Ethoxide removes the β-hydrogen anti-periplanar to bromine while the C=C π bond "
                    "forms and bromide leaves, all in one concerted step.",
        electrons="2e",
        reference="Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 17",
        stages=[
            Stage([mol("CC[O-]", orient=(1, 2, 0), yalign=(2, 1, 2)), sub],
                  [Curved(At(0, 2), At(1, 2)),
                   Curved(Bd(1, 0, 2), Bd(1, 0, 1), side="left"),
                   Curved(Bd(1, 1, 3), At(1, 3))]),
            Stage([mol("CCO"), mol("C=CC"), mol("[Br-]")]),
        ])


def carbonyl_addition():
    return Mechanism(
        id="carbonyl_addition",
        title="Nucleophilic addition: cyanide + acetaldehyde",
        category="organic",
        description="Cyanide attacks the electrophilic carbonyl carbon of acetaldehyde; the C=O π electrons "
                    "move onto oxygen to give a tetrahedral alkoxide (cyanohydrin anion).",
        electrons="2e",
        reference="Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 6",
        stages=[
            Stage([mol("[C-]#N", orient=(1, 0, 0), yalign=(0, 1, 1)), mol("CC=O", orient=(1, 2, 90))],
                  [Curved(At(0, 0), At(1, 1, ang=200)),
                   Curved(Bd(1, 1, 2), At(1, 2), side="right")]),
            Stage([mol("CC([O-])C#N", orient=(1, 2, 90))]),
        ])


def eas_nitration():
    return Mechanism(
        id="eas_nitration",
        title="Electrophilic aromatic substitution: nitration, step 1",
        category="organic",
        description="A benzene π bond attacks the nitronium ion to give the resonance-stabilised arenium "
                    "(Wheland) intermediate; loss of H⁺ in the next step restores aromaticity.",
        electrons="2e",
        reference="Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 21",
        stages=[
            Stage([mol("C1=CC=CC=C1", orient=(0, 1, 90), flip=True),
                   mol("O=[N+]=O", orient=(0, 2, 270), yalign=(1, 0, 1))],
                  [Curved(Bd(0, 0, 1), At(1, 1)),
                   Curved(Bd(1, 1, 2), At(1, 2))]),
            Stage([mol("[H]C1([N+](=O)[O-])[CH+]C=CC=C1", orient=(5, 1, 90), flip=True)]),
        ])


def diels_alder():
    hexa = [pol((0, 0), a) for a in (90, 150, 210, 270, 330, 30)]
    diene = xmol([("C", hexa[0]), ("C", hexa[1]), ("C", hexa[2]), ("C", hexa[3])],
                 [(0, 1, 2), (1, 2), (2, 3, 2)])
    dienophile = xmol([("C", hexa[5]), ("C", hexa[4])], [(0, 1, 2)], gap=1.3)
    product = xmol([("C", p) for p in hexa], [(0, 1), (1, 2, 2), (2, 3), (3, 4), (4, 5), (5, 0)])
    return Mechanism(
        id="diels_alder",
        title="Diels–Alder: buta-1,3-diene + ethene",
        category="organic",
        description="Concerted [4+2] cycloaddition: three π bonds are converted into two new σ bonds and "
                    "one new π bond in a single cyclic, six-electron transition state.",
        electrons="2e",
        reference="Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 34",
        stages=[
            Stage([diene, dienophile],
                  [Curved(Bd(0, 0, 1), At(1, 0), side="left"),      # diene C1=C2 pi -> new C1-C6 sigma
                   Curved(Bd(1, 0, 1), At(0, 3), side="right"),     # dienophile pi -> new C5-C4 sigma
                   Curved(Bd(0, 2, 3), Bd(0, 1, 2), side="left")],  # diene C3=C4 pi -> new C2=C3 pi
                  plus=False),
            Stage([product]),
        ])


def radical_homolysis():
    return Mechanism(
        id="radical_homolysis",
        title="Radical homolysis: Cl₂ under light",
        category="organic",
        description="Light (hν) cleaves the Cl–Cl bond homolytically; each chlorine atom keeps one electron "
                    "of the bond (two fishhook arrows), giving two chlorine radicals.",
        electrons="1e",
        reference="Clayden, Greeves & Warren, Organic Chemistry, 2nd ed., ch. 37",
        stages=[
            Stage([mol("ClCl", orient=(0, 1, 0))],
                  [Curved(Bd(0, 0, 1, r=0.1, ang=90), At(0, 0, r=0.35, ang=120), e=1, side="right", h=0.4),
                   Curved(Bd(0, 0, 1, r=0.1, ang=90), At(0, 1, r=0.35, ang=60), e=1, side="left", h=0.4)]),
            Stage([mol("[Cl]"), mol("[Cl]")]),
        ])


def lewis_adduct():
    bf3 = xmol([("B", (0, 0)), ("F", pol((0, 0), 270)), ("F", pol((0, 0), 30)), ("F", pol((0, 0), 150))],
               [(0, 1), (0, 2), (0, 3)])
    return Mechanism(
        id="lewis_adduct",
        title="Lewis acid–base adduct: NH₃ + BF₃",
        category="inorganic",
        description="The nitrogen lone pair of ammonia (Lewis base) is donated into the empty 2p orbital of "
                    "boron trifluoride (Lewis acid), giving the adduct H₃N⁺–B⁻F₃.",
        electrons="2e",
        reference="Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'Acids, bases and ions in aqueous solution' (Lewis acids and bases)",
        stages=[
            Stage([mol("N"), bf3],
                  [Curved(At(0, 0), At(1, 0))]),
            Stage([mol("[NH3+][B-](F)(F)F", orient=(0, 1, 0))]),
        ])


def pt_substitution():
    o = (0.0, 0.0)
    r = 1.15   # M-L bonds drawn a little longer than C-C for legibility
    pt4 = xmol([("Pt", o, {"charge": -2})] + [("Cl", pol(o, a, r)) for a in (315, 45, 135, 225)],
               [(0, 1), (0, 2), (0, 3), (0, 4)])
    # 5-coordinate (trigonal-bipyramidal) intermediate: equatorial N, Cl(leaving, wedge), Cl(trans, hash);
    # axial Cl up/down.  0 Pt, 1 N, 2 Cl_leaving, 3 Cl_trans, 4 Cl_ax, 5 Cl_ax
    tbp = xmol([("Pt", o, {"charge": -3}), ("N", pol(o, 180, r), {"charge": 1}), ("Cl", pol(o, 320, r)),
                ("Cl", pol(o, 40, r)), ("Cl", pol(o, 90, r)), ("Cl", pol(o, 270, r))],
               [(0, 1), (0, 2, 1, "wedge"), (0, 3, 1, "hash"), (0, 4), (0, 5)])
    prod = xmol([("Pt", o, {"charge": -2}), ("N", pol(o, 180, r), {"charge": 1}), ("Cl", pol(o, 0, r)),
                 ("Cl", pol(o, 90, r)), ("Cl", pol(o, 270, r))],
                [(0, 1), (0, 2), (0, 3), (0, 4)])
    return Mechanism(
        id="pt_substitution",
        title="Associative ligand substitution: [PtCl₄]²⁻ + NH₃",
        category="inorganic",
        description="NH₃ adds to square-planar Pt(II) to give a five-coordinate (trigonal-bipyramidal) "
                    "intermediate, which then loses Cl⁻ to give [PtCl₃(NH₃)]⁻. M–L bonds are drawn as single "
                    "bonds with formal charges (Pt 2−/3−, coordinated N⁺).",
        electrons="2e",
        reference="Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'd-Block metal complexes: reaction mechanisms' (substitution in square planar complexes)",
        stages=[
            Stage([mol("N"), pt4],
                  [Curved(At(0, 0), At(1, 0), side="left")]),
            Stage([tbp],
                  [Curved(Bd(0, 0, 2), At(0, 2))]),
            Stage([prod, mol("[Cl-]")]),
        ])


def sicl4_hydrolysis():
    ra, rb = umbrella("Si", 0, "Cl", 0, "Cl", 0, "right", angs=(115, 205, 260))   # wider: Cl labels
    pa, pb = umbrella("Si", 0, "O", 1, "Cl", 0, "left", angs=(115, 205, 260))
    return Mechanism(
        id="sicl4_hydrolysis",
        title="Hydrolysis of SiCl₄: attack of water at silicon",
        category="inorganic",
        description="A water lone pair attacks silicon and chloride is displaced (drawn as one concerted, "
                    "SN2-like step; the five-coordinate silicon species is not shown). Loss of H⁺ then gives "
                    "Cl₃SiOH, and repetition gives Si(OH)₄/SiO₂.",
        electrons="2e",
        reference="Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'The group 14 elements' (halides of Si)",
        stages=[
            Stage([mol("O"), xmol(ra, rb)],
                  [Curved(At(0, 0), At(1, 0, ang=150)),
                   Curved(Bd(1, 0, 1), At(1, 1))]),
            Stage([xmol(pa, pb), mol("[Cl-]")]),
        ])


def aqua_acidity():
    o = (0.0, 0.0)
    r = 1.45   # long M-L bonds so the six aqua labels do not collide

    def hexaaqua(deprotonated):
        # 0 Fe, 1 O (reacting, right), 2 O up, 3 O down, 4 O left, 5 O back (hash), 6 O front (wedge)
        atoms = [("Fe", o, {"charge": -3}),
                 ("O", pol(o, 0, r), {"charge": 0 if deprotonated else 1}),
                 ("O", pol(o, 90, r), {"charge": 1}), ("O", pol(o, 270, r), {"charge": 1}),
                 ("O", pol(o, 180, r), {"charge": 1}), ("O", pol(o, 45, r), {"charge": 1}),
                 ("O", pol(o, 225, r), {"charge": 1})]
        bonds = [(0, 1), (0, 2), (0, 3), (0, 4), (0, 5, 1, "hash"), (0, 6, 1, "wedge")]
        if not deprotonated:
            atoms.append(("H", pol(atoms[1][1], 0)))
            bonds.append((1, 7))
        return xmol(atoms, bonds)

    return Mechanism(
        id="aqua_acidity",
        title="Brønsted acidity of a metal aqua ion: [Fe(OH₂)₆]³⁺ + H₂O",
        category="inorganic",
        description="Polarisation by Fe(III) makes a coordinated water acidic: a solvent water removes a "
                    "proton to give [Fe(OH₂)₅(OH)]²⁺ and H₃O⁺. M–L bonds are single bonds with formal charges "
                    "(Fe 3−, aqua O⁺).",
        electrons="2e",
        reference="Housecroft & Sharpe, Inorganic Chemistry, 5th ed., ch. 'Acids, bases and ions in aqueous solution' (aqua acids)",
        stages=[
            Stage([hexaaqua(False), mol("O")],
                  [Curved(At(1, 0), At(0, 7), side="right"),
                   Curved(Bd(0, 1, 7), At(0, 1), side="left")]),
            Stage([hexaaqua(True), mol("[OH3+]")]),
        ])


def serine_protease():
    # Asp (acetate) ... His (4-methylimidazole) ... Ser (ethanol, explicit O-H) ... substrate (N-methylacetamide)
    asp = mol("CC(=O)[O-]", orient=(1, 3, 0))
    his = mol("CC1=CN=CN1", orient=(5, 3, 0), yalign=(5, 0, 3))          # N5 = N(delta1)-H, N3 = N(epsilon2)
    ser = mol("CCO[H]", orient=(3, 2, 0), flip=True, yalign=(3, 1, 3), gap=1.1)      # H on the left, O on the right
    sub = mol("CC(=O)NC", orient=(1, 2, 90), flip=True, yalign=(1, 2, 2), gap=1.2)
    tet = mol("CCOC(C)([O-])NC", orient=(2, 3, 0), place={1: (2, 240), 0: (1, 180)})
    hisH = mol("CC1=C[NH+]=CN1", orient=(5, 3, 0), yalign=(5, 0, 3))
    return Mechanism(
        id="serine_protease",
        title="Serine protease acylation: catalytic triad attack on a peptide bond",
        category="biochemistry",
        description="His57, held by Asp102, acts as a general base and takes the Ser195 hydroxyl proton as the "
                    "serine oxygen attacks the amide carbonyl, giving the tetrahedral oxyanion intermediate. "
                    "Side chains are truncated (acetate, 4-methylimidazole, ethanol, N-methylacetamide).",
        electrons="2e",
        reference="Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 9; Fersht, Structure and Mechanism in Protein Science (1999)",
        stages=[
            Stage([asp, his, ser, sub],
                  [Curved(At(1, 3), At(2, 3)),
                   Curved(Bd(2, 2, 3), At(3, 1, ang=150)),
                   Curved(Bd(3, 1, 2), At(3, 2))],
                  plus=False),
            Stage([mol("CC(=O)[O-]", orient=(1, 3, 0)), hisH, tet], plus=False),
        ])


def adh_hydride():
    eto = mol("[H]C(C)[O-]", orient=(1, 0, 0))
    nad = mol("C[N+]1=CC(C(N)=O)=CC=C1", orient=(7, 1, 0), yalign=(7, 0, 0))
    nadh = mol("CN1C=C(C(N)=O)C([H])C=C1", orient=(7, 1, 0))
    return Mechanism(
        id="adh_hydride",
        title="Alcohol dehydrogenase: hydride transfer to NAD⁺",
        category="biochemistry",
        description="The zinc-bound alkoxide of ethanol collapses to acetaldehyde while its C–H hydrogen is "
                    "delivered as hydride to C4 of the nicotinamide ring (NAD⁺ modelled as "
                    "1-methylnicotinamide), giving the 1,4-dihydropyridine (NADH). Zn²⁺ is omitted.",
        electrons="2e",
        reference="Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 16; Fersht, Structure and Mechanism in Protein Science (1999)",
        stages=[
            Stage([eto, nad],
                  [Curved(At(0, 3), Bd(0, 1, 3)),
                   Curved(Bd(0, 0, 1), At(1, 7)),
                   Curved(Bd(1, 3, 7), Bd(1, 2, 3)),
                   Curved(Bd(1, 1, 2), At(1, 1))]),
            Stage([mol("CC=O"), nadh]),
        ])


def kinase():
    asp = mol("CC(=O)[O-]", orient=(1, 3, 0))
    roh = mol("CCO[H]", orient=(3, 2, 0), flip=True, yalign=(3, 0, 3), gap=1.1)
    # methyl triphosphate; 9 = beta-gamma bridging O, 10 = P(gamma), 11-13 its terminal oxygens
    atp = mol("COP(=O)([O-])OP(=O)([O-])OP(=O)([O-])[O-]", orient=(10, 9, 0), yalign=(10, 1, 2), gap=1.3,
              place={11: (10, 100), 12: (10, 215), 13: (10, 260)}, stereo={(10, 12): "wedge", (10, 13): "hash"})
    return Mechanism(
        id="kinase",
        title="Kinase: in-line phosphoryl transfer from ATP",
        category="biochemistry",
        description="An active-site Asp acts as general base while the substrate hydroxyl attacks the "
                    "γ-phosphorus in line with the β,γ-bridging oxygen, which leaves as ADP. ATP is "
                    "modelled as methyl triphosphate, the substrate as ethanol; Mg²⁺ is omitted.",
        electrons="2e",
        reference="Berg, Tymoczko, Gatto & Stryer, Biochemistry, 9th ed., ch. 9 (nucleoside monophosphate kinases); Fersht, Structure and Mechanism in Protein Science (1999)",
        stages=[
            Stage([asp, roh, atp],
                  [Curved(At(0, 3), At(1, 3)),
                   Curved(Bd(1, 2, 3), At(2, 10, ang=165)),
                   Curved(Bd(2, 10, 9), At(2, 9))],
                  plus=False),
            Stage([mol("CC(=O)O"), mol("CCOP(=O)([O-])[O-]", orient=(2, 3, 0)),
                   mol("COP(=O)([O-])OP(=O)([O-])[O-]", orient=(2, 6, 0))]),
        ])


MECHANISMS = [sn2, e2, carbonyl_addition, eas_nitration, diels_alder, radical_homolysis,
              lewis_adduct, pt_substitution, sicl4_hydrolysis, aqua_acidity,
              serine_protease, adh_hydride, kinase]


# --------------------------------------------------------------------------------------------
# Layout
# --------------------------------------------------------------------------------------------
def label_visible(atom, degree):
    return atom["label"] != "C" or atom["charge"] or atom["radical"] or degree == 0


def species_bbox(sp, pts):
    deg = [0] * len(sp.atoms)
    for b in sp.bonds:
        deg[b["a"]] += 1
        deg[b["b"]] += 1
    xs0, xs1, ys0, ys1 = [], [], [], []
    for a, p, d in zip(sp.atoms, pts, deg):
        pad = 0.35 if label_visible(a, d) else 0.1
        xs0.append(p[0] - pad)
        xs1.append(p[0] + pad)
        ys0.append(p[1] - pad)
        ys1.append(p[1] + pad)
    return min(xs0), max(xs1), min(ys0), max(ys1)


@dataclass
class PlacedStage:
    species: list          # list of (Species, [global points])
    pluses: list           # [(x, y)]
    arrows: list           # resolved curved arrows: (mode, p0, p1, bulge)


def layout(mech):
    """Return (stages, reaction_arrows) with global coordinates."""
    x = 0.0
    placed, rxn = [], []
    for k, stage in enumerate(mech.stages):
        local = [[(a["x"], a["y"]) for a in sp.atoms] for sp in stage.species]
        boxes = [species_bbox(sp, pts) for sp, pts in zip(stage.species, local)]
        # vertical: centre each bbox on y = 0, then dy, then explicit atom alignments
        ty = [-(b[2] + b[3]) / 2 + sp.dy for sp, b in zip(stage.species, boxes)]
        for _ in range(len(stage.species)):
            for n, sp in enumerate(stage.species):
                if sp.yalign:
                    mine, other, oatom = sp.yalign[:3]
                    extra = sp.yalign[3] if len(sp.yalign) > 3 else 0.0
                    ty[n] = local[other][oatom][1] + ty[other] + extra - local[n][mine][1]
        # horizontal
        tx = []
        for n, (sp, b) in enumerate(zip(stage.species, boxes)):
            if n:
                x += sp.gap if sp.gap is not None else SPECIES_GAP
            tx.append(x - b[0])
            x += b[1] - b[0]
        glob = [[(p[0] + tx[n], p[1] + ty[n]) for p in local[n]] for n in range(len(local))]
        pluses = []
        if stage.plus:
            for n in range(1, len(stage.species)):
                left_edge = boxes[n - 1][1] + tx[n - 1]
                right_edge = boxes[n][0] + tx[n]
                yc = ((boxes[n - 1][2] + boxes[n - 1][3]) / 2 + ty[n - 1] + (boxes[n][2] + boxes[n][3]) / 2 + ty[n]) / 2
                pluses.append(((left_edge + right_edge) / 2, yc))
        ps = PlacedStage(list(zip(stage.species, glob)), pluses, [])
        ps.arrows = resolve_curved(stage, ps)
        placed.append(ps)
        if k < len(mech.stages) - 1:
            x0 = x + ARROW_GAP
            rxn.append(((x0, 0.0), (x0 + ARROW_LEN, 0.0)))
            x = x0 + ARROW_LEN + ARROW_GAP
    return placed, rxn


# --------------------------------------------------------------------------------------------
# Curved arrows
# --------------------------------------------------------------------------------------------
def arc_points(p0, p1, bulge, n=48):
    """Exact Ketcher arc: half-ellipse from p0 to p1, bulge > 0 = to the left of p0->p1 (y-up)."""
    d = v_sub(p1, p0)
    L = v_len(d)
    u = v_unit(d)
    nrm = v_left(u)
    m = v_mul(v_add(p0, p1), 0.5)
    out = []
    for k in range(n + 1):
        phi = math.pi * k / n
        out.append(v_add(v_add(m, v_mul(u, -L / 2 * math.cos(phi))), v_mul(nrm, bulge * math.sin(phi))))
    return out


def _base_point(ep, ps):
    pts = ps.species[ep.s][1]
    if isinstance(ep, At):
        return pts[ep.i]
    return v_mul(v_add(pts[ep.i], pts[ep.j]), 0.5)


def _offset(ep, is_src, bulge_dir, ang_override=None):
    if isinstance(ep, At):
        r = ATOM_OFFSET if ep.r is None else ep.r
    else:
        r = (BOND_SRC_OFFSET if is_src else BOND_DST_OFFSET) if ep.r is None else ep.r
    ang = ang_override if ang_override is not None else ep.ang
    direction = v_dir(ang) if ang is not None else bulge_dir
    return v_mul(direction, r)


def default_height(L):
    return max(0.35, min(0.8, 0.25 * L + 0.2))


def _geometry(arrow, ps, sign, over=None):
    over = over or {}
    b0, b1 = _base_point(arrow.src, ps), _base_point(arrow.dst, ps)
    p0, p1 = b0, b1
    for _ in range(8):
        bulge_dir = v_mul(v_left(v_unit(v_sub(p1, p0))), sign)
        p0 = v_add(b0, _offset(arrow.src, True, bulge_dir, over.get("src")))
        p1 = v_add(b1, _offset(arrow.dst, False, bulge_dir, over.get("dst")))
    L = v_len(v_sub(p1, p0))
    h = arrow.h if arrow.h is not None else default_height(L)
    return p0, p1, sign * h


def _endpoint_atoms(ep):
    return {(ep.s, ep.i)} if isinstance(ep, At) else {(ep.s, ep.i), (ep.s, ep.j)}


def _crowding(arrow, p0, p1, bulge, ps, others, reach=0.5):
    """Sum of squared intrusions of nearby objects into a `reach`-wide corridor around the arc.

    The arrow's own endpoint atoms and the bond between them are ignored (the arc necessarily starts or
    ends there); everything else in the stage counts: atoms (labels are larger), bonds, plus signs and
    the curved arrows already placed.  Lower is better."""
    pts = arc_points(p0, p1, bulge, 40)[4:-4]
    mine = _endpoint_atoms(arrow.src) | _endpoint_atoms(arrow.dst)
    obst_pts, segs = [], []
    for s, (sp, gp) in enumerate(ps.species):
        deg = [0] * len(sp.atoms)
        for b in sp.bonds:
            deg[b["a"]] += 1
            deg[b["b"]] += 1
            if not ((s, b["a"]) in mine and (s, b["b"]) in mine):
                segs.append((gp[b["a"]], gp[b["b"]]))
        for k, (a, p, d) in enumerate(zip(sp.atoms, gp, deg)):
            if (s, k) not in mine:
                obst_pts.append((p, 0.3 if label_visible(a, d) else 0.1))
    obst_pts += [(p, 0.25) for p in ps.pluses]
    for q in others:
        obst_pts += [(p, 0.1) for p in q[4:-4]]
    cost = 0.0
    for p in pts:
        for c, rad in obst_pts:
            cost += max(0.0, reach - (v_len(v_sub(p, c)) - rad)) ** 2
        for a, b in segs:
            cost += max(0.0, reach - seg_dist(p, a, b)) ** 2
    return cost


def _outwardness(arrow, p0, p1, bulge, ps):
    """> 0 when the bulge points away from the centroid of the species the arrow touches."""
    species = {arrow.src.s, arrow.dst.s}
    pts = [p for s in species for p in ps.species[s][1]]
    cen = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    mid = v_mul(v_add(p0, p1), 0.5)
    bdir = v_mul(v_left(v_unit(v_sub(p1, p0))), 1 if bulge > 0 else -1)
    return bdir[0] * (mid[0] - cen[0]) + bdir[1] * (mid[1] - cen[1])


def _stage_graph(ps):
    atoms_xy, bonds_ij, base, key = [], [], {}, {}
    for s, (sp, gp) in enumerate(ps.species):
        base[s] = len(atoms_xy)
        for b in sp.bonds:
            key[(s, frozenset((b["a"], b["b"])))] = len(bonds_ij)
            bonds_ij.append((len(atoms_xy) + b["a"], len(atoms_xy) + b["b"]))
        atoms_xy += gp
    return atoms_xy, bonds_ij, base, key


def _anchored(arrow, ps, sign, graph):
    """Geometry whose atom endpoints are recognised as their own atom (see anchor_for).

    If the default offset of an At endpoint falls into the capture band of a neighbouring bond, the
    offset direction is rotated in 10-degree steps (alternating sides) until the endpoint anchors to
    the intended atom."""
    atoms_xy, bonds_ij, base, _ = graph
    over = {}
    p0, p1, bulge = _geometry(arrow, ps, sign)
    for end, ep in (("src", arrow.src), ("dst", arrow.dst)):
        if not isinstance(ep, At):
            continue
        want = ("atom", base[ep.s] + ep.i)
        p = p0 if end == "src" else p1
        if anchor_for(p, atoms_xy, bonds_ij) == want:
            continue
        atom = ps.species[ep.s][1][ep.i]
        start = math.degrees(math.atan2(p[1] - atom[1], p[0] - atom[0]))
        for k in range(1, 10):
            for sgn in (1, -1):
                trial = dict(over, **{end: start + sgn * 10 * k})
                g = _geometry(arrow, ps, sign, trial)
                if anchor_for(g[0] if end == "src" else g[1], atoms_xy, bonds_ij) == want:
                    over = trial
                    break
            else:
                continue
            break
        p0, p1, bulge = _geometry(arrow, ps, sign, over)
    return p0, p1, bulge


def resolve_curved(stage, ps):
    """Fix endpoints, bulge side and height of every curved arrow of a placed stage."""
    out, samples = [], []
    graph = _stage_graph(ps)
    for arrow in stage.arrows:
        if arrow.side == "left":
            sign = 1
        elif arrow.side == "right":
            sign = -1
        else:
            cand = []
            for s in (1, -1):
                p0, p1, bulge = _anchored(arrow, ps, s, graph)
                cand.append((_crowding(arrow, p0, p1, bulge, ps, samples), _outwardness(arrow, p0, p1, bulge, ps), s))
            (c1, o1, s1), (c2, o2, s2) = cand
            if abs(c1 - c2) > 0.02:
                sign = s1 if c1 < c2 else s2
            else:
                sign = s1 if o1 >= o2 else s2
        p0, p1, bulge = _anchored(arrow, ps, sign, graph)
        samples.append(arc_points(p0, p1, bulge, 40))
        out.append((MODE_1E if arrow.e == 1 else MODE_2E, p0, p1, bulge, arrow))
    return out


# --------------------------------------------------------------------------------------------
# Anchor check: every curved-arrow endpoint must resolve to the atom/bond it was declared for,
# using the same rule as MecHand's recognizer (src/recognition/sketch.ts anchorFor): nearest atom
# within 1.0, overridden by a bond whose projection parameter t is in (0.2, 0.8) and whose
# perpendicular distance is < 0.9 x the best distance so far.
# --------------------------------------------------------------------------------------------
def _point_segment(p, a, b):
    v = v_sub(b, a)
    l2 = v[0] ** 2 + v[1] ** 2
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / l2))
    return v_len(v_sub(p, v_add(a, v_mul(v, t)))), t


def anchor_for(p, atoms_xy, bonds_ij):
    best, best_d = None, 1.0
    for k, a in enumerate(atoms_xy):
        d = v_len(v_sub(a, p))
        if d < best_d:
            best, best_d = ("atom", k), d
    for k, (i, j) in enumerate(bonds_ij):
        d, t = _point_segment(p, atoms_xy[i], atoms_xy[j])
        if 0.2 < t < 0.8 and d < best_d * 0.9:
            best, best_d = ("bond", k), d
    return best


def check_anchors(placed):
    """Return a list of mismatches between declared and recognised curved-arrow anchors."""
    atoms_xy, bonds_ij, atom_base, bond_key = [], [], {}, {}
    for st, ps in enumerate(placed):
        for s, (sp, gp) in enumerate(ps.species):
            atom_base[(st, s)] = len(atoms_xy)
            for b in sp.bonds:
                bond_key[(st, s, frozenset((b["a"], b["b"])))] = len(bonds_ij)
                bonds_ij.append((len(atoms_xy) + b["a"], len(atoms_xy) + b["b"]))
            atoms_xy += gp
    problems = []
    for st, ps in enumerate(placed):
        for n, (_, p0, p1, _, arrow) in enumerate(ps.arrows):
            for end, ep, p in (("tail", arrow.src, p0), ("head", arrow.dst, p1)):
                if isinstance(ep, At):
                    want = ("atom", atom_base[(st, ep.s)] + ep.i)
                else:
                    k = bond_key.get((st, ep.s, frozenset((ep.i, ep.j))))
                    if k is None:
                        continue          # midpoint of a non-bonded pair: nothing to compare against
                    want = ("bond", k)
                got = anchor_for(p, atoms_xy, bonds_ij)
                if got != want:
                    problems.append(f"stage {st} arrow {n} {end}: declared {ep}, recognised as {got}")
    return problems


# --------------------------------------------------------------------------------------------
# KET serialisation
# --------------------------------------------------------------------------------------------
def _r(v):
    v = round(v, DECIMALS)
    return 0.0 if v == 0 else v


def to_ket(mech, placed=None, rxn=None):
    if placed is None:
        placed, rxn = layout(mech)
    root, doc = [], {}
    n = 0
    for ps in placed:
        for sp, gp in ps.species:
            atoms = []
            for a, p in zip(sp.atoms, gp):
                ka = {"label": a["label"], "location": [_r(p[0]), _r(p[1]), 0.0]}
                if a["charge"]:
                    ka["charge"] = a["charge"]
                if a["radical"]:
                    ka["radical"] = a["radical"]
                atoms.append(ka)
            bonds = []
            for b in sp.bonds:
                kb = {"type": b["order"], "atoms": [b["a"], b["b"]]}
                if b["stereo"]:
                    kb["stereo"] = b["stereo"]
                bonds.append(kb)
            name = f"mol{n}"
            n += 1
            root.append({"$ref": name})
            doc[name] = {"type": "molecule", "atoms": atoms, "bonds": bonds}
    for ps in placed:
        for p in ps.pluses:
            root.append({"type": "plus", "location": [_r(p[0]), _r(p[1]), 0.0]})
    for p0, p1 in rxn:
        root.append({"type": "arrow", "data": {"mode": MODE_RXN, "pos": [
            {"x": _r(p0[0]), "y": _r(p0[1]), "z": 0.0}, {"x": _r(p1[0]), "y": _r(p1[1]), "z": 0.0}]}})
    for ps in placed:
        for mode, p0, p1, bulge, _ in ps.arrows:
            root.append({"type": "arrow", "data": {"mode": mode, "pos": [
                {"x": _r(p0[0]), "y": _r(p0[1]), "z": 0.0}, {"x": _r(p1[0]), "y": _r(p1[1]), "z": 0.0}],
                "height": _r(KET_HEIGHT_SIGN * bulge)}})
    return {"root": {"nodes": root}, **doc}


def dumps(obj, indent=2, width=110, _level=0):
    """JSON with small containers kept on one line (diff-friendly, still valid JSON)."""
    flat = json.dumps(obj, ensure_ascii=False)
    if len(flat) + indent * _level <= width or not isinstance(obj, (dict, list)) or not obj:
        return flat
    pad = " " * (indent * (_level + 1))
    end = " " * (indent * _level)
    if isinstance(obj, dict):
        items = [f"{pad}{json.dumps(k)}: {dumps(v, indent, width, _level + 1)}" for k, v in obj.items()]
        return "{\n" + ",\n".join(items) + "\n" + end + "}"
    items = [pad + dumps(v, indent, width, _level + 1) for v in obj]
    return "[\n" + ",\n".join(items) + "\n" + end + "]"


# --------------------------------------------------------------------------------------------
# Validation (works on the KET files alone)
# --------------------------------------------------------------------------------------------
def _molecules(ket):
    return [(n["$ref"], ket[n["$ref"]]) for n in ket["root"]["nodes"] if "$ref" in n]


def _conn(mol_):
    conn = [0] * len(mol_["atoms"])
    for b in mol_["bonds"]:
        o = b["type"] if b["type"] in (1, 2, 3) else 0
        for i in b["atoms"]:
            conn[i] += o
    return conn


def validate_ket(path):
    """Return (errors, warnings) for one KET file."""
    errors, warnings = [], []
    try:
        ket = json.loads(Path(path).read_text())
    except Exception as exc:  # noqa: BLE001
        return [f"JSON parse error: {exc}"], []
    nodes = ket.get("root", {}).get("nodes")
    if not isinstance(nodes, list):
        return ["root.nodes missing"], []
    rxn, curved = [], []
    for n in nodes:
        if "$ref" in n:
            ref = n["$ref"]
            if ref not in ket or ket[ref].get("type") != "molecule":
                errors.append(f"dangling ref {ref}")
                continue
            m = ket[ref]
            na = len(m.get("atoms", []))
            for a in m["atoms"]:
                if not isinstance(a.get("label"), str) or len(a.get("location", [])) != 3:
                    errors.append(f"{ref}: bad atom {a}")
            for b in m.get("bonds", []):
                ij = b.get("atoms", [])
                if len(ij) != 2 or ij[0] == ij[1] or not all(isinstance(i, int) and 0 <= i < na for i in ij):
                    errors.append(f"{ref}: bond {b} references missing atoms")
                if b.get("type") not in (1, 2, 3, 4, 9, 10):
                    errors.append(f"{ref}: bond type {b.get('type')}")
        elif n.get("type") == "arrow":
            d = n.get("data", {})
            pos = d.get("pos", [])
            if len(pos) != 2 or not all("x" in p and "y" in p for p in pos):
                errors.append(f"arrow without 2 points: {n}")
                continue
            if d.get("mode") in CURVED_MODES:
                if not isinstance(d.get("height"), (int, float)) or d["height"] == 0:
                    errors.append(f"curved arrow without height: {n}")
                curved.append(d)
            else:
                rxn.append(d)
        elif n.get("type") == "plus":
            if len(n.get("location", [])) != 3:
                errors.append(f"bad plus {n}")
        else:
            errors.append(f"unexpected node type {n.get('type')}")
    if not rxn:
        errors.append("no reaction arrow")
        return errors, warnings
    mols = _molecules(ket)
    if errors:
        return errors, warnings
    # split molecules into stages by the x of the reaction arrows
    cuts = sorted((d["pos"][0]["x"] + d["pos"][1]["x"]) / 2 for d in rxn)
    nst = len(cuts) + 1
    charge, elems, hyd = [0] * nst, [{} for _ in range(nst)], [0] * nst
    stage_atoms = [[] for _ in range(nst)]
    for ref, m in mols:
        cx = sum(a["location"][0] for a in m["atoms"]) / len(m["atoms"])
        st = sum(cx > c for c in cuts)
        conn = _conn(m)
        for a, c in zip(m["atoms"], conn):
            charge[st] += a.get("charge", 0)
            h, bad = ketcher_implicit_h(a["label"], a.get("charge", 0), a.get("radical", 0), c)
            if bad:
                warnings.append(f"{ref}: Ketcher valence warning (badConn) on {a['label']} "
                                f"(charge {a.get('charge', 0)}, bond order sum {c})")
            hyd[st] += h + (1 if a["label"] == "H" else 0)
            if a["label"] != "H":
                elems[st][a["label"]] = elems[st].get(a["label"], 0) + 1
            stage_atoms[st].append((a["location"][0], a["location"][1]))
    for k in range(1, nst):
        if charge[k] != charge[0]:
            errors.append(f"charge not conserved: stage charges {charge}")
            break
    for k in range(1, nst):
        if elems[k] != elems[0]:
            errors.append(f"heavy atoms not conserved: {elems}")
            break
    for k in range(1, nst):
        if hyd[k] != hyd[0]:
            errors.append(f"hydrogens (explicit + Ketcher implicit) not conserved: {hyd}")
            break
    # curved arrows: never on the final (product) stage, endpoints close to an atom or bond midpoint
    anchors = []
    for ref, m in mols:
        locs = [(a["location"][0], a["location"][1]) for a in m["atoms"]]
        anchors += locs
        anchors += [v_mul(v_add(locs[b["atoms"][0]], locs[b["atoms"][1]]), 0.5) for b in m["bonds"]]
    for d in curved:
        mid_x = (d["pos"][0]["x"] + d["pos"][1]["x"]) / 2
        if mid_x > cuts[-1]:
            errors.append("curved arrow on the product side")
        for p in d["pos"]:
            dist = min(v_len(v_sub((p["x"], p["y"]), q)) for q in anchors)
            if dist > 0.45:
                errors.append(f"curved-arrow endpoint ({p['x']}, {p['y']}) is {dist:.2f} from any atom/bond")
    return errors, warnings


# --------------------------------------------------------------------------------------------
# Preview rendering (matplotlib; reads the KET file)
# --------------------------------------------------------------------------------------------
def _charge_text(c):
    if not c:
        return ""
    s = "+" if c > 0 else "−"
    return s if abs(c) == 1 else f"{abs(c)}{s}"


def render_preview(ket_path, png_path, title=""):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.path import Path as MPath
    from matplotlib.patches import PathPatch, Polygon

    ket = json.loads(Path(ket_path).read_text())
    mols = _molecules(ket)
    allp = [tuple(a["location"][:2]) for _, m in mols for a in m["atoms"]]
    for n in ket["root"]["nodes"]:
        if n.get("type") == "arrow":
            allp += [(p["x"], p["y"]) for p in n["data"]["pos"]]
    x0, x1 = min(p[0] for p in allp) - 1.0, max(p[0] for p in allp) + 1.0
    y0, y1 = min(p[1] for p in allp) - 1.2, max(p[1] for p in allp) + 1.2
    scale = 0.42  # inches per Ketcher unit
    fig = plt.figure(figsize=((x1 - x0) * scale, (y1 - y0) * scale + 0.4), dpi=110)
    ax = fig.add_axes([0, 0, 1, (y1 - y0) * scale / ((y1 - y0) * scale + 0.4)])
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect("equal")
    ax.axis("off")
    if title:
        fig.text(0.01, 0.99, title, va="top", ha="left", fontsize=10, family="DejaVu Sans")
    fs = 72 * scale * 0.40
    lw = 1.3

    for _, m in mols:
        locs = [tuple(a["location"][:2]) for a in m["atoms"]]
        nb = [[] for _ in locs]
        for b in m["bonds"]:
            i, j = b["atoms"]
            nb[i].append(j)
            nb[j].append(i)
        conn = _conn(m)
        vis = [label_visible({"label": a["label"], "charge": a.get("charge", 0), "radical": a.get("radical", 0)}, len(nb[k]))
               for k, a in enumerate(m["atoms"])]

        def in_ring(i, j):
            seen, stack = {i}, [i]
            while stack:
                k = stack.pop()
                for q in nb[k]:
                    if (k, q) in ((i, j), (j, i)):
                        continue
                    if q == j:
                        return True
                    if q not in seen:
                        seen.add(q)
                        stack.append(q)
            return False

        for b in m["bonds"]:
            i, j = b["atoms"]
            a, c = locs[i], locs[j]
            u = v_unit(v_sub(c, a))
            nrm = v_left(u)
            sa = 0.24 if vis[i] else 0.0
            sc = 0.24 if vis[j] else 0.0
            pa, pc = v_add(a, v_mul(u, sa)), v_sub(c, v_mul(u, sc))
            st = b.get("stereo", 0)
            if st == 1:
                w = v_mul(nrm, 0.11)
                ax.add_patch(Polygon([pa, v_add(pc, w), v_sub(pc, w)], closed=True, color="black", lw=0))
                continue
            if st == 6:
                for k in range(1, 8):
                    t = k / 7
                    p = v_add(pa, v_mul(v_sub(pc, pa), t))
                    w = v_mul(nrm, 0.11 * t)
                    ax.plot([p[0] - w[0], p[0] + w[0]], [p[1] - w[1], p[1] + w[1]], color="black", lw=0.9)
                continue
            order = b["type"]
            if order == 1:
                ax.plot([pa[0], pc[0]], [pa[1], pc[1]], color="black", lw=lw)
            elif order == 2:
                side = 0.0
                if in_ring(i, j) or not (vis[i] or vis[j]):
                    acc = 0.0
                    for k, other in ((i, j), (j, i)):
                        for q in nb[k]:
                            if q != other:
                                acc += (locs[q][0] - locs[k][0]) * nrm[0] + (locs[q][1] - locs[k][1]) * nrm[1]
                    side = 1.0 if acc > 1e-6 else (-1.0 if acc < -1e-6 else 0.0)
                if side:
                    ax.plot([pa[0], pc[0]], [pa[1], pc[1]], color="black", lw=lw)
                    off = v_mul(nrm, 0.16 * side)
                    q0 = v_add(v_add(pa, off), v_mul(u, 0.0 if vis[i] else 0.14))
                    q1 = v_sub(v_add(pc, off), v_mul(u, 0.0 if vis[j] else 0.14))
                    ax.plot([q0[0], q1[0]], [q0[1], q1[1]], color="black", lw=lw)
                else:
                    for s in (-1, 1):
                        off = v_mul(nrm, 0.075 * s)
                        ax.plot([pa[0] + off[0], pc[0] + off[0]], [pa[1] + off[1], pc[1] + off[1]], color="black", lw=lw)
            elif order == 3:
                for s in (-1, 0, 1):
                    off = v_mul(nrm, 0.11 * s)
                    ax.plot([pa[0] + off[0], pc[0] + off[0]], [pa[1] + off[1], pc[1] + off[1]], color="black", lw=lw)

        for k, a in enumerate(m["atoms"]):
            if not vis[k]:
                continue
            h, bad = ketcher_implicit_h(a["label"], a.get("charge", 0), a.get("radical", 0), conn[k])
            hs = "" if h == 0 else ("H" if h == 1 else f"H$_{h}$")
            mean_dx = sum(locs[q][0] - locs[k][0] for q in nb[k])
            text = (hs + a["label"]) if (hs and mean_dx > 0.1) else (a["label"] + hs)
            ch = _charge_text(a.get("charge", 0))
            color = "#b00000" if bad else {"O": "#c00000", "N": "#1f3fbf", "Cl": "#127a12", "F": "#127a12",
                                           "Br": "#8a3b12", "P": "#c06000", "B": "#a05050", "Si": "#6a5a3a",
                                           "Pt": "#4a4a7a", "Fe": "#a04a00", "H": "#333333"}.get(a["label"], "black")
            p = locs[k]
            ax.text(p[0], p[1], text, ha="center", va="center", fontsize=fs, color=color,
                    bbox=dict(boxstyle="square,pad=0.05", fc="white", ec="none"), zorder=3)
            if ch:
                w = 0.13 * len(text.replace("$_", "").replace("$", "")) + 0.05
                ax.text(p[0] + w, p[1] + 0.22, ch, ha="left", va="center", fontsize=fs * 0.75, color=color, zorder=4)
            if a.get("radical"):
                ax.text(p[0], p[1] + 0.3, "•", ha="center", va="center", fontsize=fs, color=color, zorder=4)

    for n in ket["root"]["nodes"]:
        if n.get("type") == "plus":
            ax.text(n["location"][0], n["location"][1], "+", ha="center", va="center", fontsize=fs * 1.3)
        if n.get("type") != "arrow":
            continue
        d = n["data"]
        p0 = (d["pos"][0]["x"], d["pos"][0]["y"])
        p1 = (d["pos"][1]["x"], d["pos"][1]["y"])
        if d["mode"] in CURVED_MODES:
            bulge = d["height"] * KET_HEIGHT_SIGN          # +: left of p0->p1 in the y-up frame
            nrm = v_left(v_unit(v_sub(p1, p0)))
            c = v_mul(nrm, 4.0 / 3.0 * bulge)                 # one cubic ~ half-ellipse (peak = bulge)
            c1, c2 = v_add(p0, c), v_add(p1, c)
            col = "#d0006f"
            path = MPath([p0, c1, c2, p1], [MPath.MOVETO, MPath.CURVE4, MPath.CURVE4, MPath.CURVE4])
            ax.add_patch(PathPatch(path, fc="none", ec=col, lw=1.4, zorder=5))
            t = v_unit(v_sub(p1, c2))                          # travel direction at the head
            side = v_left(t)
            hl, hw = 0.2, 0.1
            back = v_sub(p1, v_mul(t, hl))
            barb_a = v_add(back, v_mul(side, hw))
            barb_b = v_sub(back, v_mul(side, hw))
            if d["mode"] == MODE_1E:
                # single barb on the outer side (away from the chord)
                outer = barb_a if (barb_a[0] - p0[0]) * nrm[0] + (barb_a[1] - p0[1]) * nrm[1] > \
                    (barb_b[0] - p0[0]) * nrm[0] + (barb_b[1] - p0[1]) * nrm[1] else barb_b
                if bulge < 0:
                    outer = barb_b if outer is barb_a else barb_a
                ax.plot([p1[0], outer[0]], [p1[1], outer[1]], color=col, lw=1.4, zorder=5)
            else:
                ax.plot([barb_a[0], p1[0], barb_b[0]], [barb_a[1], p1[1], barb_b[1]], color=col, lw=1.4, zorder=5)
        else:
            ax.annotate("", xy=p1, xytext=p0, arrowprops=dict(arrowstyle="->", lw=1.4, color="black"))
    fig.savefig(png_path)
    plt.close(fig)


# --------------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------------
def build():
    MECH_DIR.mkdir(parents=True, exist_ok=True)
    index, problems = [], []
    for make in MECHANISMS:
        mech = make()
        placed, rxn = layout(mech)
        problems += [f"{mech.id}: {msg}" for msg in check_anchors(placed)]
        ket = to_ket(mech, placed, rxn)
        (MECH_DIR / f"{mech.id}.ket").write_text(dumps(ket) + "\n")
        index.append({"id": mech.id, "file": f"mechanisms/{mech.id}.ket", "title": mech.title,
                      "category": mech.category, "description": mech.description,
                      "electrons": mech.electrons, "reference": mech.reference})
    (OUT_DIR / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    for msg in problems:
        print(f"[ERR] anchor {msg}")
    return index, not problems


def check(index):
    ok = True
    for entry in index:
        errors, warnings = validate_ket(OUT_DIR / entry["file"])
        status = "OK " if not errors else "ERR"
        print(f"[{status}] {entry['id']}")
        for e in errors:
            print(f"      error: {e}")
        for w in warnings:
            print(f"      note:  {w}")
        ok = ok and not errors
    return ok


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--preview", metavar="DIR", help="also render PNG previews into DIR")
    ap.add_argument("--check", action="store_true", help="only validate existing files")
    args = ap.parse_args(argv)
    anchors_ok = True
    if args.check:
        index = json.loads((OUT_DIR / "index.json").read_text())
    else:
        index, anchors_ok = build()
    ok = check(index) and anchors_ok
    if args.preview:
        out = Path(args.preview)
        out.mkdir(parents=True, exist_ok=True)
        for entry in index:
            render_preview(OUT_DIR / entry["file"], out / f"{entry['id']}.png", entry["title"])
        print(f"previews written to {out}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
