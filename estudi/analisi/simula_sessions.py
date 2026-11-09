"""
Sessions SINTÈTIQUES de l'estudi, per provar analitza_sessions.py abans de tenir dades reals (i per
fer simulacions de potència). No representen cap persona. Segueixen l'esquema que escriu l'aplicació
(mechand-study-session/3) amb el contingut mínim que llegeix l'anàlisi.

Ús:
  python simula_sessions.py <carpeta> [--n 36] [--efecte 0.75] [--llavor 1]

--efecte és el quocient de temps MecHand/Ketcher als mecanismes (0,75 = un 25 % més ràpid).
"""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

from rdkit import Chem

HERE = Path(__file__).resolve().parent
STIMULI = json.loads((HERE.parent / "estimuls" / "estimuls.json").read_text())
PLAN = {
    "A1": [("A", "freehand"), ("B", "ketcher")],
    "A2": [("B", "ketcher"), ("A", "freehand")],
    "B1": [("B", "freehand"), ("A", "ketcher")],
    "B2": [("A", "ketcher"), ("B", "freehand")],
}
DEVICES = ["tauleta-llapis", "tauleta-llapis", "ordinador-trackpad", "ordinador-ratoli", "tauleta-dit"]
COUNTRIES = ["ES", "ES", "ES", "ES", "MA", "CO", "RO", "CN", "FR", ""]


def ket_of(smiles: list[str], curved: int) -> str:
    """A minimal KET document with the given species and curved arrows (no coordinates needed by the analysis)."""
    doc: dict = {"root": {"nodes": []}}
    for i, smi in enumerate(smiles):
        m = Chem.MolFromSmiles(smi)
        Chem.Kekulize(m, clearAromaticFlags=True)
        doc[f"mol{i}"] = {
            "type": "molecule",
            "atoms": [{"label": a.GetSymbol(), "location": [0, 0, 0], **({"charge": a.GetFormalCharge()} if a.GetFormalCharge() else {})}
                      for a in m.GetAtoms()],
            "bonds": [{"type": int(b.GetBondTypeAsDouble()), "atoms": [b.GetBeginAtomIdx(), b.GetEndAtomIdx()]} for b in m.GetBonds()],
        }
        doc["root"]["nodes"].append({"$ref": f"mol{i}"})
    for _ in range(curved):
        doc["root"]["nodes"].append({"type": "arrow", "data": {"mode": "elliptical-arc-arrow-open-angle", "pos": [{}, {}]}})
    return json.dumps(doc)


def session(k: int, rng: random.Random, effect: float) -> dict:
    group = list(PLAN)[k % 4]
    code = "MH-" + "".join(rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(5))
    role = "professorat" if k % 9 == 8 else "estudiant"
    skill = rng.gauss(0, 0.25)  # participant's speed (log scale)
    tasks, events, t = [], [], 0
    practice = next(s for s in STIMULI if s["set"] == "practica")
    for b, (set_, cond) in enumerate(PLAN[group], start=1):
        items = [s for s in STIMULI if s["set"] == set_]
        rng.shuffle(items)
        for j, st in enumerate([practice, *items]):
            tid = f"B{b}T{j}"
            tasks.append({"id": tid, "stimulus": st["id"], "condition": cond, "block": b, "practice": j == 0})
            base = {"molecula": 90, "mecanisme": 150}[st["kind"]]
            factor = effect if (cond == "freehand" and st["kind"] == "mecanisme") else 1.0
            secs = round(base * factor * math.exp(skill + rng.gauss(0, 0.3)) * (0.92 if b == 2 else 1))
            events.append({"t": t, "type": "task-start", "task": tid})
            if cond == "freehand":
                for r in range(rng.choice([1, 1, 2])):
                    events.append({"t": t + 20 + r, "type": "recognize", "task": tid, "data": {
                        "ink": [{"t0": t, "t1": t + 1, "points": [[0, 0], [10, 10]]}],
                        "result": {"scene": {"atoms": [], "bonds": [], "arrows": [], "pluses": []}, "roles": ["bond"],
                                   "labels": [], "arrows": [], "confidence": 0.8}}})
                    accepted = rng.random() < (0.85 if DEVICES[k % 5].endswith("llapis") else 0.7)
                    events.append({"t": t + 21 + r, "type": "insert" if accepted else "keep-drawing", "task": tid,
                                   "data": {"engine": "browser", "ket": ket_of(st["reference"]["smiles"], 0)} if accepted else None})
            skipped = rng.random() < 0.03
            ok = rng.random() < 0.85
            species = st["reference"]["smiles"] if ok else st["reference"]["smiles"][1:]
            ket = ket_of(species, st["reference"]["curvedArrows"] if rng.random() < 0.9 else 0)
            t += secs * 1000
            events.append({"t": t, "type": "task-skip" if skipped else "task-end", "task": tid,
                           "data": {"seconds": secs, "ket": ket, "pendingInkStrokes": 0, "ignoredContacts": 0}})
    sus = {c: [min(5, max(1, round(rng.gauss(4 if i % 2 == 0 else 2, 0.8) + (0.3 if c == "freehand" else 0) * (1 if i % 2 == 0 else -1))))
               for i in range(10)] for c in ("freehand", "ketcher")}
    events.insert(0, {"t": 0, "type": "teach-end", "data": {"letters": rng.randint(0, 40), "elements": rng.randint(0, 12)}})
    return {
        "schema": "mechand-study-session/3", "appVersion": "0.1.0", "modelVersion": "sintètic", "code": code, "group": group,
        "year": 2026,
        "participant": {"role": role, "course": None if role == "professorat" else rng.randint(1, 4), "device": DEVICES[k % 5],
                        "literacyCountry": rng.choice(COUNTRIES), "handedness": None, "experience": rng.choice(["cap", "poca", "molta"])},
        "environment": {"browser": {"name": "Chrome", "major": 150}, "os": {"name": "iPadOS", "major": None}, "architecture": None,
                        "architectureSource": "unknown", "mobile": False, "screen": {"width": 1200, "height": 800},
                        "maxTouchPoints": 5, "pointerTypes": ["pen"]},
        "tasks": tasks, "progress": {"phase": "done", "task": 10}, "events": events, "sus": sus,
        "comments": {"freehand": "", "ketcher": "", "preference": rng.choice(["mechand", "ketcher", "igual", ""]), "other": ""},
        "shareTeachSamples": False, "publishTeachSamples": False,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path)
    ap.add_argument("--n", type=int, default=36)
    ap.add_argument("--efecte", type=float, default=0.75)
    ap.add_argument("--llavor", type=int, default=1)
    args = ap.parse_args()
    rng = random.Random(args.llavor)
    args.folder.mkdir(parents=True, exist_ok=True)
    for k in range(args.n):
        s = session(k, rng, args.efecte)
        (args.folder / f"mechand-estudi-{s['code']}.json").write_text(json.dumps(s))
    print(f"{args.n} sessions sintètiques a {args.folder}")


if __name__ == "__main__":
    main()
