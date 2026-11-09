"""
Anàlisi dels fitxers de sessió de l'estudi «Avaluació de MecHand» (estudi/01-disseny-experimental.md).

Entrada : una carpeta amb fitxers mechand-estudi-MH-XXXXX.json (esquema mechand-study-session/2).
Sortida : taules CSV i un resum (--out), una taula publicable amb k-anonimat (--public),
          les mostres Teach publicables (--export-teach) i la validació creuada del model
          compartit (--cross-validate, requereix Node.js i el repositori).

Requisits: Python ≥ 3.10, rdkit, pandas; opcionals: scipy, statsmodels (contrastos i models).

Ús:
  python analitza_sessions.py <carpeta> --check
  python analitza_sessions.py <carpeta> --out resultats [--public] [--cross-validate]
  python analitza_sessions.py <carpeta> --export-teach teach
"""

from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pandas as pd
from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")

SCHEMA = "mechand-study-session/2"
HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
STIMULI = {s["id"]: s for s in json.loads((REPO / "estudi" / "estimuls" / "estimuls.json").read_text())}

# Regions used to generalise the country of literacy in published tables (k-anonymity).
REGION = {
    **{c: "Europa occidental i meridional" for c in "AD ES PT FR IT MC SM VA BE NL LU DE AT CH LI GB IE MT GR CY".split()},
    **{c: "Europa central i oriental" for c in "PL CZ SK HU SI HR BA RS ME MK AL RO BG MD UA BY RU LT LV EE XK".split()},
    **{c: "Europa del nord" for c in "DK SE NO FI IS FO".split()},
    **{c: "Magrib i Orient Mitjà" for c in "MA DZ TN LY EG EH MR SD SY LB JO IQ PS IL SA YE OM AE QA BH KW IR TR".split()},
    **{c: "Àfrica subsahariana" for c in ("SN GM GW GN SL LR CI GH TG BJ NG NE ML BF CV CM GQ GA CG CD CF TD AO NA ZA BW "
                                         "ZW ZM MW MZ TZ KE UG RW BI ET ER DJ SO SS MG MU SC KM LS SZ ST").split()},
    **{c: "Amèrica Llatina i Carib" for c in ("MX GT BZ SV HN NI CR PA CU DO HT PR JM TT BB BS CO VE EC PE BO CL AR UY PY BR "
                                             "GY SR GF").split()},
    **{c: "Amèrica del Nord" for c in "US CA".split()},
    **{c: "Àsia oriental" for c in "CN JP KR KP TW HK MO MN".split()},
    **{c: "Àsia meridional i sud-oriental" for c in "IN PK BD LK NP BT MV AF VN TH LA KH MM MY SG ID PH TL BN".split()},
    **{c: "Àsia central i Caucas" for c in "KZ UZ TM KG TJ AZ AM GE".split()},
    **{c: "Oceania" for c in "AU NZ FJ PG WS TO VU SB KI".split()},
}
DEVICE_GROUP = {
    "tauleta-llapis": "llapis", "ordinador-llapis": "llapis", "tauleta-dit": "dit", "ordinador-tactil": "dit",
    "ordinador-ratoli": "ratolí o trackpad", "ordinador-trackpad": "ratolí o trackpad", "altre": "altre",
}


# ── Chemistry ────────────────────────────────────────────────────────────────

def normalised(mol: Chem.Mol) -> str | None:
    """As in manuscript/analysis/compare_decimer.py: no explicit H, no radicals, implicit H recomputed, no stereo."""
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


def smiles_species(smiles: str) -> list[str]:
    out = []
    for part in smiles.split("."):
        m = Chem.MolFromSmiles(part)
        if m is None:
            m = Chem.MolFromSmiles(part, sanitize=False)
            if m is None:
                continue
            m.UpdatePropertyCache(strict=False)
        s = normalised(m)
        if s:
            out.append(s)
    return out


BOND = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE, 4: Chem.BondType.AROMATIC}


def ket_species(ket: str | None) -> tuple[list[str], int, int]:
    """Species (normalised SMILES of each fragment), curved arrows and other arrows of a KET drawing."""
    if not ket:
        return [], 0, 0
    try:
        doc = json.loads(ket)
    except json.JSONDecodeError:
        return [], 0, 0
    species: list[str] = []
    curved = other = 0
    for node in doc.get("root", {}).get("nodes", []):
        if node.get("type") == "arrow":
            mode = str(node.get("data", {}).get("mode", ""))
            if mode.startswith("elliptical-arc"):
                curved += 1
            else:
                other += 1
            continue
        ref = node.get("$ref")
        mol = doc.get(ref) if ref else None
        if not mol or mol.get("type") != "molecule":
            continue
        rw = Chem.RWMol()
        for a in mol.get("atoms", []):
            label = a.get("label", "C")
            try:
                atom = Chem.Atom(label)
            except Exception:
                atom = Chem.Atom(0)  # R groups and other pseudo-atoms → "*"
            atom.SetFormalCharge(int(a.get("charge", 0) or 0))
            rw.AddAtom(atom)
        for b in mol.get("bonds", []):
            i, j = b["atoms"]
            rw.AddBond(int(i), int(j), BOND.get(int(b.get("type", 1)), Chem.BondType.SINGLE))
        m = rw.GetMol()
        m.UpdatePropertyCache(strict=False)
        for frag in Chem.GetMolFrags(m, asMols=True, sanitizeFrags=False):
            s = normalised(frag)
            if s:
                species.append(s)
    return species, curved, other


# ── Sessions ─────────────────────────────────────────────────────────────────

def load(folder: Path) -> list[dict]:
    sessions = []
    for f in sorted(folder.glob("*.json")):
        try:
            s = json.loads(f.read_text())
        except json.JSONDecodeError:
            print(f"! {f.name}: no és JSON", file=sys.stderr)
            continue
        if s.get("schema") != SCHEMA:
            print(f"! {f.name}: esquema {s.get('schema')!r} (s'esperava {SCHEMA})", file=sys.stderr)
            continue
        sessions.append(s)
    codes = Counter(s["code"] for s in sessions)
    for c, n in codes.items():
        if n > 1:
            print(f"! codi {c} repetit {n} vegades", file=sys.stderr)
    return sessions


def sus_score(answers: list[int]) -> float:
    return 2.5 * sum((a - 1) if i % 2 == 0 else (5 - a) for i, a in enumerate(answers))


def task_rows(s: dict) -> list[dict]:
    p, e = s["participant"], s["environment"]
    rows = []
    for t in s["tasks"]:
        ev = [x for x in s["events"] if x.get("task") == t["id"]]
        end = next((x for x in reversed(ev) if x["type"] in ("task-end", "task-skip")), None)
        st = STIMULI[t["stimulus"]]
        ref = [x for smi in st["reference"]["smiles"] for x in smiles_species(smi)]
        got, curved, other = ket_species(end["data"].get("ket") if end else None)
        found = sum(1 for r in set(ref) if r in got)
        decisions = Counter(x["type"] for x in ev)
        rows.append({
            "code": s["code"], "group": s["group"], "date": s["date"], "role": p["role"], "course": p["course"],
            "device": p["device"], "device_group": DEVICE_GROUP.get(p["device"], "altre"),
            "country": p["literacyCountry"] or None, "region": REGION.get(p["literacyCountry"], "altres o sense resposta"),
            "handedness": p["handedness"], "experience": p["experience"],
            "browser": e["browser"]["name"], "os": e["os"]["name"], "pointer_types": ",".join(e["pointerTypes"]),
            "task": t["id"], "block": t["block"], "practice": t["practice"], "condition": t["condition"],
            "stimulus": t["stimulus"], "set": st["set"], "kind": st["kind"],
            "done": end is not None, "skipped": bool(end and end["type"] == "task-skip"),
            "seconds": end["data"]["seconds"] if end else None,
            "species_ref": len(set(ref)), "species_found": found, "species_extra": len(set(got) - set(ref)),
            "curved_ref": st["reference"]["curvedArrows"], "curved_drawn": curved, "other_arrows": other,
            "structure_ok": found == len(set(ref)) and len(set(ref)) > 0,
            "arrows_ok": curved == st["reference"]["curvedArrows"],
            "recognitions": decisions["recognize"], "inserts": decisions["insert"],
            "keep_drawing": decisions["keep-drawing"], "discards": decisions["discard"],
            "undo_strokes": decisions["undo-stroke"], "clear_ink": decisions["clear-ink"],
        })
    for r in rows:
        r["correct"] = bool(r["done"] and not r["skipped"] and r["structure_ok"] and r["arrows_ok"])
    return rows


def recognition_rows(s: dict) -> list[dict]:
    rows = []
    ev = s["events"]
    for i, e in enumerate(ev):
        if e["type"] != "recognize":
            continue
        nxt = next((x for x in ev[i + 1:] if x.get("task") == e.get("task") and x["type"] in ("insert", "keep-drawing", "discard", "recognize")), None)
        res = e["data"]["result"]
        rows.append({
            "code": s["code"], "task": e.get("task"), "device": s["participant"]["device"],
            "region": REGION.get(s["participant"]["literacyCountry"], "altres o sense resposta"),
            "strokes": len(e["data"]["ink"]), "atoms": len(res["scene"]["atoms"]), "bonds": len(res["scene"]["bonds"]),
            "arrows": len(res["scene"]["arrows"]), "confidence": res["confidence"],
            "unread_strokes": sum(1 for r in res["roles"] if r == "ignored"),
            "decision": nxt["type"] if nxt and nxt["type"] != "recognize" else "none",
        })
    return rows


def participant_rows(sessions: list[dict], tasks: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for s in sessions:
        p = s["participant"]
        teach = next((x["data"] for x in s["events"] if x["type"] == "teach-end"), {}) or {}
        row = {"code": s["code"], "group": s["group"], "role": p["role"], "course": p["course"], "device": p["device"],
               "country": p["literacyCountry"] or None, "experience": p["experience"],
               "teach_letters": teach.get("letters"), "teach_elements": teach.get("elements"),
               "share_teach": s.get("shareTeachSamples"), "publish_teach": s.get("publishTeachSamples")}
        for cond, ans in s.get("sus", {}).items():
            row[f"sus_{cond}"] = sus_score(ans)
        t = tasks[(tasks.code == s["code"]) & (~tasks.practice)]
        for cond in ("freehand", "ketcher"):
            tc = t[t.condition == cond]
            row[f"median_s_{cond}"] = tc.seconds.median()
            row[f"correct_{cond}"] = tc.correct.mean()
        rows.append(row)
    return pd.DataFrame(rows)


# ── Statistics ───────────────────────────────────────────────────────────────

def statistics(tasks: pd.DataFrame, people: pd.DataFrame) -> list[str]:
    out = []
    real = tasks[~tasks.practice & tasks.done]
    out.append(f"Participants: {len(people)} ({(people.role == 'estudiant').sum()} estudiants, {(people.role == 'professorat').sum()} professorat)")
    out.append(f"Tasques analitzades: {len(real)} (omeses: {int(real.skipped.sum())})")
    out.append("\nMitjanes per condició i tipus:")
    out.append(real.groupby(["condition", "kind"]).agg(n=("seconds", "size"), mediana_s=("seconds", "median"),
                                                         correctes=("correct", "mean")).round(3).to_string())
    for cond in ("freehand", "ketcher"):
        col = f"sus_{cond}"
        if col in people and people[col].notna().any():
            out.append(f"SUS {cond}: mitjana {people[col].mean():.1f} (DE {people[col].std():.1f}, n={people[col].notna().sum()})")
    try:
        from scipy.stats import wilcoxon
        pairs = people.dropna(subset=["median_s_freehand", "median_s_ketcher"])
        if len(pairs) >= 6:
            w = wilcoxon(pairs.median_s_freehand, pairs.median_s_ketcher)
            out.append(f"\nH1 (Wilcoxon, mediana de temps per participant): W={w.statistic:.1f}, p={w.pvalue:.4f}, n={len(pairs)}")
        mech = real[real.kind == "mecanisme"].groupby(["code", "condition"]).seconds.median().unstack().dropna()
        if len(mech) >= 6:
            w = wilcoxon(mech.freehand, mech.ketcher)
            out.append(f"H1 només mecanismes: W={w.statistic:.1f}, p={w.pvalue:.4f}, n={len(mech)}")
        sus = people.dropna(subset=["sus_freehand", "sus_ketcher"])
        if len(sus) >= 6:
            w = wilcoxon(sus.sus_freehand, sus.sus_ketcher)
            out.append(f"H3 (SUS, Wilcoxon): W={w.statistic:.1f}, p={w.pvalue:.4f}, n={len(sus)}")
    except ImportError:
        out.append("(scipy no instal·lat: sense contrastos)")
    try:
        import numpy as np
        import statsmodels.formula.api as smf
        import statsmodels.api as sm
        d = real.dropna(subset=["seconds"]).copy()
        if d.code.nunique() >= 8:
            d["log_s"] = np.log(d.seconds.clip(lower=1))
            m = smf.mixedlm("log_s ~ C(condition) * C(kind) + C(block) + C(stimulus) + C(role)", d, groups=d["code"]).fit()
            out.append("\nModel lineal mixt log(temps):\n" + str(m.summary()))
            d["correct_i"] = d.correct.astype(int)
            g = smf.gee("correct_i ~ C(condition) * C(kind) + C(block) + C(role)", "code", d,
                        family=sm.families.Binomial(), cov_struct=sm.cov_struct.Exchangeable()).fit()
            out.append("\nGEE logística de la correcció:\n" + str(g.summary()))
    except ImportError:
        out.append("(statsmodels no instal·lat: sense models)")
    except Exception as exc:  # small or degenerate data
        out.append(f"(models no ajustats: {exc})")
    return out


def k_anonymous(tasks: pd.DataFrame, k: int = 5) -> pd.DataFrame:
    """Task table without code, date, browser or country; quasi-identifiers generalised until every combination has ≥ k people."""
    t = tasks[~tasks.practice].copy()
    t["course"] = t.course.astype("Int64").astype(str).replace("<NA>", "-")
    qi = ["role", "course", "device_group", "region"]
    person = t.drop_duplicates("code")[["code", *qi]].set_index("code")
    for col, fallback in (("region", "altres"), ("device_group", "altres"), ("course", "*")):
        sizes = person.groupby(qi).size()
        small = sizes[sizes < k].index
        mask = person.set_index(qi, append=True).index.droplevel(0).isin(small)
        person.loc[mask, col] = fallback
    sizes = person.groupby(qi).size()
    keep = person[person.set_index(qi, append=True).index.droplevel(0).isin(sizes[sizes >= k].index)]
    pid = {c: f"P{i + 1:03d}" for i, c in enumerate(random.Random(0).sample(sorted(keep.index), len(keep)))}
    t = t[t.code.isin(keep.index)].drop(columns=[*qi, "date", "browser", "os", "country", "device", "pointer_types", "group"])
    t = t.join(keep, on="code")
    t["participant"] = t.code.map(pid)
    return t.drop(columns=["code"])


# ── Teach samples ────────────────────────────────────────────────────────────

def export_teach(sessions: list[dict], out: Path) -> int:
    """Teach samples of the sessions whose participants agreed to publication, without any metadata."""
    out.mkdir(parents=True, exist_ok=True)
    chosen = [s for s in sessions if s.get("publishTeachSamples") and s.get("teachSamples")]
    random.Random().shuffle(chosen)  # file order must not follow session order
    year = sessions[0]["date"][:4] if sessions else "0000"
    for i, s in enumerate(chosen, 1):
        t = s["teachSamples"]
        clean = {
            "samples": [{"symbol": x["symbol"], "strokes": [[{"x": p["x"], "y": p["y"]} for p in st] for st in x["strokes"]]}
                        for x in t.get("samples", [])],
            "elements": [{"element": x["element"], "bondPx": x["bondPx"],
                          "strokes": [[{"x": p["x"], "y": p["y"]} for p in st] for st in x["strokes"]]}
                         for x in t.get("elements", [])],
        }
        (out / f"estudi-{year}-{i:03d}.json").write_text(json.dumps(clean, separators=(",", ":")))
    return len(chosen)


def cross_validate(folder: Path, out: Path) -> pd.DataFrame:
    app = REPO / "ketcher-mechhand"
    target = out / "crossval.json"
    env = {**os.environ, "MECHAND_CV_DIR": str(folder.resolve()), "MECHAND_CV_OUT": str(target.resolve())}
    subprocess.run(["npx", "vitest", "run", "src/study/crossval.export.test.ts"], cwd=app, env=env, check=True)
    rows = pd.DataFrame(json.loads(target.read_text())["rows"])
    return rows.groupby("model")[["atoms", "bonds", "arrows", "exact"]].mean().round(3) if len(rows) else rows


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path)
    ap.add_argument("--check", action="store_true", help="només comprova i resumeix els fitxers")
    ap.add_argument("--out", type=Path, default=HERE / "resultats")
    ap.add_argument("--public", action="store_true", help="escriu també tasques_publiques.csv (k ≥ 5)")
    ap.add_argument("--export-teach", type=Path, help="carpeta on escriure les mostres Teach publicables")
    ap.add_argument("--cross-validate", action="store_true", help="validació creuada del model compartit (Node.js)")
    args = ap.parse_args()

    sessions = load(args.folder)
    print(f"{len(sessions)} sessions vàlides a {args.folder}")
    if args.check:
        for s in sessions:
            ends = sum(1 for e in s["events"] if e["type"] in ("task-end", "task-skip"))
            print(f"  {s['code']}  grup {s['group']}  {s['participant']['role']:11}  tasques {ends}/{len(s['tasks'])}  "
                  f"SUS {sorted(s.get('sus', {}))}  fase {s['progress']['phase']}")
        return
    if args.export_teach:
        n = export_teach(sessions, args.export_teach)
        print(f"{n} fitxers de mostres publicables a {args.export_teach}")
        return

    args.out.mkdir(parents=True, exist_ok=True)
    tasks = pd.DataFrame([r for s in sessions for r in task_rows(s)])
    recog = pd.DataFrame([r for s in sessions for r in recognition_rows(s)])
    people = participant_rows(sessions, tasks)
    tasks.to_csv(args.out / "tasques.csv", index=False)
    recog.to_csv(args.out / "reconeixements.csv", index=False)
    people.to_csv(args.out / "participants.csv", index=False)
    summary = statistics(tasks, people)
    if len(recog):
        summary.append("\nReconeixements: decisió per dispositiu (proporció)")
        summary.append(pd.crosstab(recog.device, recog.decision, normalize="index").round(2).to_string())
        summary.append("\nReconeixements: decisió per regió d'alfabetització (proporció)")
        summary.append(pd.crosstab(recog.region, recog.decision, normalize="index").round(2).to_string())
    if args.public:
        pub = k_anonymous(tasks)
        pub.to_csv(args.out / "tasques_publiques.csv", index=False)
        summary.append(f"\nTaula publicable: {pub.participant.nunique()} participants (k ≥ 5); "
                       f"{tasks.code.nunique() - pub.participant.nunique()} exclosos per mida de grup")
    if args.cross_validate:
        cv = cross_validate(args.folder, args.out)
        summary.append("\nValidació creuada (coincidència amb la lectura acceptada):\n" + cv.to_string())
    (args.out / "resum.txt").write_text("\n".join(summary) + "\n")
    print("\n".join(summary))
    print(f"\nResultats a {args.out}")


if __name__ == "__main__":
    main()
