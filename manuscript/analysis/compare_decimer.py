"""
Direct comparison of MecHand's stroke-based recognizer with DECIMER's hand-drawn
image model on the same synthetic handwriting.

Input : the dataset written by
          MECHAND_COMPARE_OUT=compare.json npx vitest run src/recognition/compare.export.test.ts
        (in ketcher-mechhand/): every molecule of every mechanism template, drawn in
        three hand styles, with the strokes and MecHand's recognition.
Output: results JSON and a LaTeX table (written next to the --out prefix).

Each drawing is rasterised (black ink on white, as MecHand sends it to the server)
and read by DECIMER with hand_drawn=True. Reference, MecHand and DECIMER structures
are compared as canonical SMILES (RDKit), with explicit hydrogens removed and
stereochemistry ignored.

Requires: Python 3.10–3.13, decimer>=2.8, rdkit, pillow.
Usage   : python compare_decimer.py compare.json --out results/decimer
"""

from __future__ import annotations

import argparse
import json
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")

ORDER = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE, 4: Chem.BondType.AROMATIC}


def scene_to_smiles(scene: dict) -> str | None:
    """MecHand Scene (atoms/bonds) → canonical SMILES without explicit H or stereo."""
    rw = Chem.RWMol()
    try:
        for a in scene["atoms"]:
            atom = Chem.Atom(a["symbol"])
            atom.SetFormalCharge(int(a.get("charge", 0)))
            if a.get("radical") == 2:
                atom.SetNumRadicalElectrons(1)
            rw.AddAtom(atom)
        for b in scene["bonds"]:
            rw.AddBond(int(b["begin"]), int(b["end"]), ORDER.get(int(b["order"]), Chem.BondType.SINGLE))
        mol = rw.GetMol()
        mol.UpdatePropertyCache(strict=False)
        Chem.SanitizeMol(mol, Chem.SanitizeFlags.SANITIZE_ALL ^ Chem.SanitizeFlags.SANITIZE_PROPERTIES, catchErrors=True)
        return normalised(mol)
    except Exception:
        return None


def normalised(mol: Chem.Mol) -> str | None:
    """Same normalisation for every side: no explicit H, no radicals (an unlabelled
    hydrogen count is not a recognition error), implicit H recomputed, no stereo."""
    try:
        mol = Chem.RWMol(Chem.RemoveHs(mol, sanitize=False))
        for a in mol.GetAtoms():
            a.SetNumRadicalElectrons(0)
            a.SetNoImplicit(False)
            a.SetNumExplicitHs(0)
        m = mol.GetMol()
        m.UpdatePropertyCache(strict=False)
        Chem.SanitizeMol(m, catchErrors=True)
        return Chem.MolToSmiles(m, isomericSmiles=False)
    except Exception:
        return None


def canonical(smiles: str) -> str | None:
    mol = Chem.MolFromSmiles(smiles) if smiles else None
    if mol is None:
        mol = Chem.MolFromSmiles(smiles, sanitize=False) if smiles else None
        if mol is None:
            return None
        mol.UpdatePropertyCache(strict=False)
    return normalised(mol)


def rasterise(strokes: list[list[dict]], scale: float = 1.0, width: float = 3.0, pad: int = 30) -> np.ndarray:
    strokes = [[{"x": p["x"] * scale, "y": p["y"] * scale} for p in s] for s in strokes]
    xs = [p["x"] for s in strokes for p in s]
    ys = [p["y"] for s in strokes for p in s]
    x0, y0 = min(xs) - pad, min(ys) - pad
    w, h = int(max(xs) - x0 + pad), int(max(ys) - y0 + pad)
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    for s in strokes:
        pts = [(p["x"] - x0, p["y"] - y0) for p in s]
        if len(pts) > 1:
            d.line(pts, fill="black", width=int(width), joint="curve")
        else:
            d.ellipse((pts[0][0] - 1.5, pts[0][1] - 1.5, pts[0][0] + 1.5, pts[0][1] + 1.5), fill="black")
    return np.array(img)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset")
    ap.add_argument("--out", default="decimer_comparison")
    ap.add_argument("--images", help="optional folder to save the rasterised drawings")
    ap.add_argument("--scale", type=float, default=1.0, help="drawing scale (1 = 60 px per bond, as drawn)")
    ap.add_argument("--width", type=float, default=3.0, help="ink width in px")
    args = ap.parse_args()

    import DECIMER  # imported late: heavy

    DECIMER.load_models(printed=False, hand_drawn=True)
    items = json.loads(Path(args.dataset).read_text())
    rows = []
    for k, it in enumerate(items):
        ref = scene_to_smiles(it["ref"])
        mech = scene_to_smiles(it["got"])
        img = rasterise(it["strokes"], scale=args.scale, width=args.width)
        if args.images:
            Path(args.images).mkdir(parents=True, exist_ok=True)
            Image.fromarray(img).save(Path(args.images) / f"{it['template']}-m{it['molecule']}-s{it['seed']}.png")
        t0 = time.perf_counter()
        dec_raw = DECIMER.predict_SMILES(img, hand_drawn=True)
        dec_ms = (time.perf_counter() - t0) * 1000
        dec = canonical(dec_raw)
        rows.append({
            "template": it["template"], "category": it["category"], "molecule": it["molecule"], "seed": it["seed"],
            "atoms": len(it["ref"]["atoms"]), "ref": ref, "mechand": mech, "decimer": dec, "decimer_raw": dec_raw,
            "mechand_ok": ref is not None and mech == ref, "decimer_ok": ref is not None and dec == ref,
            "mechand_ms": it["ms"], "decimer_ms": dec_ms,
        })
        print(f"{k + 1:3}/{len(items)} {it['template']:18} m{it['molecule']} s{it['seed']}  "
              f"MecHand {'✓' if rows[-1]['mechand_ok'] else '✗'}  DECIMER {'✓' if rows[-1]['decimer_ok'] else '✗'}  ({ref})")

    by_cat: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_cat[r["category"]].append(r)
    summary = {
        cat: {
            "drawings": len(rs),
            "mechand": sum(r["mechand_ok"] for r in rs) / len(rs),
            "decimer": sum(r["decimer_ok"] for r in rs) / len(rs),
        }
        for cat, rs in sorted(by_cat.items())
    }
    summary["all"] = {
        "drawings": len(rows),
        "mechand": sum(r["mechand_ok"] for r in rows) / len(rows),
        "decimer": sum(r["decimer_ok"] for r in rows) / len(rows),
        "mechand_ms_median": float(np.median([r["mechand_ms"] for r in rows])),
        "scale": args.scale, "width": args.width,
        "decimer_ms_median": float(np.median([r["decimer_ms"] for r in rows])),
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.with_suffix(".json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=1))

    names = {"organic": "Organic", "inorganic": "Inorganic", "biochemistry": "Biochemistry", "all": "All"}
    lines = [
        "% Generated by manuscript/analysis/compare_decimer.py — do not edit by hand.",
        "\\begin{tabular}{lrrr}",
        "\\toprule",
        "Templates & Drawings & MecHand & DECIMER \\\\",
        "\\midrule",
    ]
    for cat in ["organic", "inorganic", "biochemistry", "all"]:
        s = summary[cat]
        if cat == "all":
            lines.append("\\midrule")
        lines.append(f"{names[cat]} & {s['drawings']} & {100 * s['mechand']:.0f}\\,\\% & {100 * s['decimer']:.0f}\\,\\% \\\\")
    lines += ["\\bottomrule", "\\end{tabular}"]
    out.with_suffix(".tex").write_text("\n".join(lines) + "\n")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
