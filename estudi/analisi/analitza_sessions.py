"""
Anàlisi dels fitxers de sessió de l'estudi «Avaluació de MecHand» (estudi/01-disseny-experimental.md).

Entrada : una carpeta amb fitxers mechand-estudi-MH-XXXXX.json (esquema mechand-study-session/3).
Sortida : taules CSV i un resum (--out), una taula publicable amb k-anonimat (--public),
          les mostres Teach publicables (--export-teach), els dibuixos per a la valoració cega
          de les fletxes (--export-rating, --agreement, --ratings) i la validació creuada del
          model compartit (--cross-validate, requereix Node.js i el repositori).

Requisits: Python ≥ 3.10, rdkit, pandas, numpy; opcionals: scipy, statsmodels (contrastos i models).

Ús:
  python analitza_sessions.py <carpeta> --check
  python analitza_sessions.py <carpeta> --export-rating valoracio      # per als avaluadors (cec)
  python analitza_sessions.py <carpeta> --agreement aval1.csv aval2.csv  # kappa i discrepàncies
  python analitza_sessions.py <carpeta> --out resultats --ratings consens.csv [--public] [--cross-validate]
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

import numpy as np
import pandas as pd
from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")

SCHEMA = "mechand-study-session/3"
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
    """As in analysis/compare_decimer.py: no explicit H, no radicals, implicit H recomputed, no stereo."""
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
    """
    Species (normalised SMILES of each fragment), curved arrows and other arrows of a KET drawing.
    An R group (Ketcher R-group label or pseudo-atom) counts as CH3, as the task text asks to draw
    R as CH3; MecHand cannot write R, so both conditions are scored with the same rule.
    """
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
            label = a.get("label", "C") if a.get("type", "atom") == "atom" else "C"  # rg-label → CH3
            try:
                atom = Chem.Atom(label)
            except Exception:
                atom = Chem.Atom(6)  # pseudo-atoms such as "R" → CH3
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
        inserts = [x for x in ev if x["type"] == "insert"]
        after_insert = ket_species(inserts[-1]["data"].get("ket")) if inserts and inserts[-1].get("data") else None
        recog = [x for x in ev if x["type"] == "recognize"]
        first_decision = None
        if recog:
            i = ev.index(recog[0])
            nxt = next((x for x in ev[i + 1:] if x["type"] in ("insert", "keep-drawing", "discard")), None)
            first_decision = nxt["type"] if nxt else "none"
        rows.append({
            "code": s["code"], "group": s["group"], "year": s.get("year"), "role": p["role"], "course": p["course"],
            "device": p["device"], "device_group": DEVICE_GROUP.get(p["device"], "altre"),
            "country": p["literacyCountry"] or None, "region": REGION.get(p["literacyCountry"], "altres o sense resposta"),
            "handedness": p["handedness"], "experience": p["experience"],
            "browser": e["browser"]["name"], "os": e["os"]["name"], "pointer_types": ",".join(e["pointerTypes"]),
            "task": t["id"], "block": t["block"], "position": int(t["id"].split("T")[1]), "practice": t["practice"],
            "condition": t["condition"],
            "stimulus": t["stimulus"], "set": st["set"], "kind": st["kind"],
            "done": end is not None, "skipped": bool(end and end["type"] == "task-skip"),
            "seconds": end["data"]["seconds"] if end else None,
            "species_ref": len(set(ref)), "species_found": found, "species_extra": len(set(got) - set(ref)),
            "curved_ref": st["reference"]["curvedArrows"], "curved_drawn": curved, "other_arrows": other,
            "structure_ok": found == len(set(ref)) and len(set(ref)) > 0,
            "arrows_ok": curved == st["reference"]["curvedArrows"],
            "recognitions": decisions["recognize"], "inserts": decisions["insert"],
            # MecHand: was the first reading accepted as it was? Were there Ketcher edits after the last insert?
            "first_recognition": first_decision,
            "edited_after_insert": (sorted(after_insert[0]) != sorted(got)) if after_insert is not None and end else None,
            "keep_drawing": decisions["keep-drawing"], "discards": decisions["discard"],
            "undo_ink": decisions["undo-ink"], "redo_ink": decisions["redo-ink"], "clear_ink": decisions["clear-ink"],
            "erasures": decisions["erase"],
            "erased_strokes": sum(x["data"]["strokes"] for x in ev if x["type"] == "erase"),
            "pen_eraser_used": any(x["type"] == "erase" and x["data"].get("source") == "pen-eraser" for x in ev),
            "pen_changes": max(decisions["pen"] - 1, 0), "input_mode_changes": decisions["input-mode"],
            "ignored_contacts": (end["data"].get("ignoredContacts") if end else None),
            # Started more than once (a reload during the task): the time counts from the last start.
            "restarted": decisions["task-start"] > 1,
        })
    for r in rows:
        # Automatic correctness: every reference species present and the right number of curved arrows.
        # With --ratings, mechanisms also need the blinded raters' "arrows correct" (start and end).
        r["correct_auto"] = bool(r["done"] and not r["skipped"] and r["structure_ok"] and r["arrows_ok"])
        r["correct"] = r["correct_auto"]
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
        rows[-1]["accepted"] = rows[-1]["decision"] == "insert"
    return rows


def participant_rows(sessions: list[dict], tasks: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for s in sessions:
        p = s["participant"]
        teach = next((x["data"] for x in reversed(s["events"]) if x["type"] == "teach-end"), {}) or {}
        row = {"code": s["code"], "group": s["group"], "role": p["role"], "course": p["course"], "device": p["device"],
               "country": p["literacyCountry"] or None, "experience": p["experience"],
               "teach_letters": teach.get("letters"), "teach_elements": teach.get("elements"),
               "share_teach": s.get("shareTeachSamples"), "publish_teach": s.get("publishTeachSamples"),
               "preference": (s.get("comments") or {}).get("preference") or None}
        for cond, ans in s.get("sus", {}).items():
            row[f"sus_{cond}"] = sus_score(ans)
        t = tasks[(tasks.code == s["code"]) & (~tasks.practice)]
        for cond in ("freehand", "ketcher"):
            tc = t[t.condition == cond]
            row[f"median_s_{cond}"] = tc[tc.done & ~tc.skipped].seconds.median()
            row[f"correct_{cond}"] = tc.correct.mean()
        rows.append(row)
    return pd.DataFrame(rows)


# ── Statistics ───────────────────────────────────────────────────────────────

def bootstrap_ci(values: np.ndarray, n: int = 5000, seed: int = 1) -> tuple[float, float]:
    """95 % percentile bootstrap interval of the mean (resampling participants)."""
    rng = np.random.default_rng(seed)
    means = rng.choice(values, size=(n, len(values)), replace=True).mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def with_imputed_skips(tasks: pd.DataFrame) -> pd.DataFrame:
    """Sensitivity analysis: a skipped task takes the longest time observed for that stimulus."""
    t = tasks[~tasks.practice & tasks.done].copy()
    worst = t[~t.skipped].groupby("stimulus").seconds.max()
    t.loc[t.skipped, "seconds"] = t.loc[t.skipped, "stimulus"].map(worst)
    return t


def time_model(d: pd.DataFrame, formula: str):
    """
    Linear mixed model of log(time) with a random intercept per participant. The stimulus is a
    fixed effect (it absorbs set and kind): with eight stimuli a stimulus variance is poorly estimated.
    """
    import warnings
    import statsmodels.formula.api as smf
    d = d.dropna(subset=["seconds"]).copy()
    d["log_s"] = np.log(d.seconds.clip(lower=1))
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        fit = smf.mixedlm(formula, d, groups="code").fit(reml=True)
    fit.convergence_notes = sorted({str(w.message).split(".")[0] for w in caught if "Convergence" in type(w.message).__name__})
    return fit


def model_text(fit) -> str:
    notes = getattr(fit, "convergence_notes", [])
    return str(fit.summary()) + ("\n  avisos d'ajust: " + "; ".join(notes) if notes else "")


def statistics(tasks: pd.DataFrame, people: pd.DataFrame, recog: pd.DataFrame) -> list[str]:
    """The analyses of estudi/01-disseny-experimental.md, section 7 (pre-registered plan)."""
    out = []
    real = tasks[~tasks.practice & tasks.done]
    done = real[~real.skipped]
    out.append(f"Participants: {len(people)} ({(people.role == 'estudiant').sum()} estudiants, {(people.role == 'professorat').sum()} professorat)")
    out.append(f"Tasques analitzades: {len(real)} (omeses: {int(real.skipped.sum())}; reiniciades per una recàrrega: {int(real.restarted.sum())})")
    rated = "amb valoració cega de les fletxes" if "arrows_rated" in tasks and tasks.arrows_rated.notna().any() else "automàtica (sense valoració cega)"
    out.append(f"Correcció: {rated}")
    out.append("\nDescriptius per condició i tipus (tasques acabades):")
    out.append(done.groupby(["condition", "kind"]).agg(n=("seconds", "size"), mediana_s=("seconds", "median"),
                                                         correctes=("correct", "mean")).round(3).to_string())
    try:
        from scipy import stats
    except ImportError:
        stats = None
        out.append("(scipy no instal·lat: sense contrastos)")

    # H1 (primary): mechanisms, MecHand faster than Ketcher.
    mech = done[done.kind == "mecanisme"].groupby(["code", "condition"]).seconds.median().unstack()
    if stats is not None and {"freehand", "ketcher"} <= set(mech.columns):
        mech = mech.dropna()
        if len(mech) >= 6:
            w = stats.wilcoxon(mech.freehand, mech.ketcher, alternative="less")
            ratio = float(np.exp(np.median(np.log(mech.freehand / mech.ketcher))))
            out.append(f"\nH1 (mecanismes; Wilcoxon aparellada unilateral, mediana per participant): W={w.statistic:.1f}, "
                       f"p={w.pvalue:.4f}, n={len(mech)}; quocient de temps MecHand/Ketcher (mediana) {ratio:.2f}")
    try:
        if done.code.nunique() >= 8:
            h1 = "log_s ~ C(condition) * C(block) + C(stimulus) + C(role) + position"
            m = time_model(done[done.kind == "mecanisme"], h1)
            out.append("\nH1, model lineal mixt log(temps), només mecanismes (arrossegament: condició × bloc):\n" + model_text(m))
            both = done.assign(ketcher_molecula=((done.condition == "ketcher") & (done.kind == "molecula")).astype(int))
            m2 = time_model(both, "log_s ~ C(condition) * C(block) + ketcher_molecula + C(stimulus) + C(role) + position")
            out.append("\nModel secundari, totes les tasques (condició × tipus):\n" + model_text(m2))
            imp = with_imputed_skips(tasks)
            m3 = time_model(imp[imp.kind == "mecanisme"], h1)
            out.append("\nSensibilitat: tasques omeses amb el temps màxim de l'estímul:\n" + str(m3.summary().tables[1]))
    except ImportError:
        out.append("(statsmodels no instal·lat: sense models)")
    except Exception as exc:  # small or degenerate data
        out.append(f"(model de temps no ajustat: {exc})")

    # H2: non-inferiority of correctness (margin 10 percentage points), skipped tasks count as incorrect.
    acc = real.groupby(["code", "condition"]).correct.mean().unstack()
    if {"freehand", "ketcher"} <= set(acc.columns):
        diff = (acc.freehand - acc.ketcher).dropna().to_numpy()
        if len(diff) >= 6:
            lo, hi = bootstrap_ci(diff)
            verdict = "no inferior" if lo > -0.10 else "no es pot afirmar la no-inferioritat"
            out.append(f"\nH2 (correcció MecHand − Ketcher, per participant): {diff.mean():+.3f}, IC 95 % bootstrap "
                       f"[{lo:+.3f}, {hi:+.3f}], n={len(diff)}; marge −0,10 → {verdict}")
    try:
        import statsmodels.api as sm
        import statsmodels.formula.api as smf
        if real.code.nunique() >= 8:
            d = real.copy()
            d["correct_i"] = d.correct.astype(int)
            g = smf.gee("correct_i ~ C(condition) + C(kind) + C(block) + C(role)", "code", d,
                        family=sm.families.Binomial(), cov_struct=sm.cov_struct.Exchangeable()).fit()
            out.append("\nH2, GEE logística (correlació intercanviable dins de cada participant):\n" + str(g.summary().tables[1]))
    except ImportError:
        pass
    except Exception as exc:
        out.append(f"(GEE de la correcció no ajustada: {exc})")

    # H3: SUS of MecHand ≥ 68, and not inferior to Ketcher (margin 5 points).
    for cond in ("freehand", "ketcher"):
        col = f"sus_{cond}"
        if col in people and people[col].notna().sum() >= 2:
            x = people[col].dropna()
            out.append(f"SUS {cond}: mitjana {x.mean():.1f} (DE {x.std():.1f}, n={len(x)})")
    if stats is not None and "sus_freehand" in people and people.sus_freehand.notna().sum() >= 6:
        x = people.sus_freehand.dropna()
        t = stats.ttest_1samp(x, 68, alternative="greater")
        ci = stats.t.interval(0.95, len(x) - 1, loc=x.mean(), scale=stats.sem(x))
        out.append(f"\nH3a (SUS MecHand > 68): mitjana {x.mean():.1f}, IC 95 % [{ci[0]:.1f}, {ci[1]:.1f}], "
                   f"t={t.statistic:.2f}, p unilateral={t.pvalue:.4f}")
        pair = people.dropna(subset=["sus_freehand", "sus_ketcher"])
        if len(pair) >= 6:
            d = (pair.sus_freehand - pair.sus_ketcher).to_numpy()
            lo, hi = bootstrap_ci(d)
            w = stats.wilcoxon(pair.sus_freehand, pair.sus_ketcher)
            out.append(f"H3b (SUS MecHand − Ketcher): {d.mean():+.1f}, IC 95 % [{lo:+.1f}, {hi:+.1f}]; marge −5 → "
                       f"{'no inferior' if lo > -5 else 'no es pot afirmar la no-inferioritat'}; Wilcoxon W={w.statistic:.1f}, p={w.pvalue:.4f}")

    # H4 (exploratory): first reading accepted, by device, region of literacy and Teach samples.
    if len(recog):
        out.append("\nH4: lectures acceptades a la primera, per dispositiu i regió (proporció, n):")
        first = tasks[(tasks.condition == "freehand") & ~tasks.practice & tasks.first_recognition.notna()].copy()
        first["accepted"] = first.first_recognition == "insert"
        out.append(first.groupby("device_group").accepted.agg(["mean", "size"]).round(2).to_string())
        out.append(first.groupby("region").accepted.agg(["mean", "size"]).round(2).to_string())
        if "edited_after_insert" in first:
            e = first.edited_after_insert.dropna()
            if len(e):
                out.append(f"Tasques amb correccions amb Ketcher després d'inserir: {e.mean():.2f} (n={len(e)})")
        try:
            import statsmodels.api as sm
            import statsmodels.formula.api as smf
            f2 = first.merge(people[["code", "teach_letters", "teach_elements"]], on="code", how="left")
            f2["teach"] = f2.teach_letters.fillna(0) + f2.teach_elements.fillna(0)
            f2["accepted_i"] = f2.accepted.astype(int)
            keep = f2.region.map(f2.drop_duplicates("code").region.value_counts()) >= 5
            f2.loc[~keep, "region"] = "altres"
            if f2.code.nunique() >= 8:
                g = smf.gee("accepted_i ~ C(device_group) + C(region) + teach", "code", f2,
                            family=sm.families.Binomial(), cov_struct=sm.cov_struct.Exchangeable()).fit()
                out.append("GEE logística (lectura acceptada a la primera):\n" + str(g.summary().tables[1]))
        except ImportError:
            pass
        except Exception as exc:
            out.append(f"(GEE de H4 no ajustada: {exc})")
    if "preference" in people and people.preference.notna().any():
        out.append("\nPreferència per dibuixar mecanismes:\n" + people.preference.value_counts().to_string())
    return out


# ── Blinded rating of the curved arrows ──────────────────────────────────────

def export_rating(tasks: pd.DataFrame, sessions: list[dict], out: Path) -> int:
    """
    One KET file per analysed mechanism (random name, no code, no condition) for two raters who open
    them in Ketcher/MecHand and judge whether each curved arrow starts and ends where it should.
    The key (file → code, task) goes to clau.csv, which the raters must not see.
    """
    out.mkdir(parents=True, exist_ok=True)
    kets = {}
    for s in sessions:
        for e in s["events"]:
            if e["type"] in ("task-end", "task-skip") and e.get("data", {}).get("ket"):
                kets[(s["code"], e["task"])] = e["data"]["ket"]
    rows = tasks[~tasks.practice & tasks.done & ~tasks.skipped & (tasks.kind == "mecanisme")]
    rng = random.Random()
    ids = rng.sample(range(10000, 99999), len(rows))
    key, sheet = [], []
    for rid, (_, r) in zip(ids, rows.iterrows()):
        ket = kets.get((r.code, r.task))
        if not ket:
            continue
        name = f"D{rid}"
        (out / f"{name}.ket").write_text(ket)
        key.append({"id": name, "code": r.code, "task": r.task, "stimulus": r.stimulus, "condition": r.condition})
        sheet.append({"id": name, "stimulus": r.stimulus, "arrows_ok": "", "comment": ""})
    sheet.sort(key=lambda x: x["id"])
    pd.DataFrame(key).to_csv(out / "clau.csv", index=False)
    pd.DataFrame(sheet).to_csv(out / "full_valoracio.csv", index=False)
    return len(sheet)


def agreement(a: Path, b: Path) -> list[str]:
    r1, r2 = pd.read_csv(a), pd.read_csv(b)
    m = r1.merge(r2, on="id", suffixes=("_1", "_2")).dropna(subset=["arrows_ok_1", "arrows_ok_2"])
    x, y = m.arrows_ok_1.astype(int), m.arrows_ok_2.astype(int)
    po = float((x == y).mean())
    pe = float(x.mean() * y.mean() + (1 - x.mean()) * (1 - y.mean()))
    kappa = (po - pe) / (1 - pe) if pe < 1 else 1.0
    out = [f"Acord entre avaluadors: {po:.3f} (n={len(m)}), kappa de Cohen {kappa:.3f}"]
    diff = m[x != y].id.tolist()
    if diff:
        out.append("Discrepàncies a resoldre per consens: " + ", ".join(diff))
    return out


def apply_ratings(tasks: pd.DataFrame, ratings: Path, key: Path) -> pd.DataFrame:
    r = pd.read_csv(ratings)[["id", "arrows_ok"]].merge(pd.read_csv(key), on="id")
    r = r.rename(columns={"arrows_ok": "arrows_rated"})[["code", "task", "arrows_rated"]]
    t = tasks.merge(r, on=["code", "task"], how="left")
    mech = t.kind == "mecanisme"
    t.loc[mech, "correct"] = t.loc[mech, "correct_auto"] & (t.loc[mech, "arrows_rated"].fillna(0).astype(int) == 1)
    return t


def k_anonymous(tasks: pd.DataFrame, k: int = 5) -> pd.DataFrame:
    """
    Task table without code, year, browser, OS, country, handedness or group; the quasi-identifiers
    (role, course, device, region of literacy, experience) are generalised until every combination
    has ≥ k people, and people in smaller combinations are left out.
    """
    t = tasks[~tasks.practice].copy()
    t["course"] = t.course.astype("Int64").astype(str).replace("<NA>", "-")
    qi = ["role", "course", "device_group", "region", "experience"]
    person = t.drop_duplicates("code")[["code", *qi]].set_index("code")
    for col, fallback in (("experience", "*"), ("region", "altres"), ("device_group", "altres"), ("course", "*")):
        sizes = person.groupby(qi).size()
        small = sizes[sizes < k].index
        mask = person.set_index(qi, append=True).index.droplevel(0).isin(small)
        person.loc[mask, col] = fallback
    sizes = person.groupby(qi).size()
    keep = person[person.set_index(qi, append=True).index.droplevel(0).isin(sizes[sizes >= k].index)]
    pid = {c: f"P{i + 1:03d}" for i, c in enumerate(random.Random(0).sample(sorted(keep.index), len(keep)))}
    t = t[t.code.isin(keep.index)].drop(columns=[*qi, "year", "browser", "os", "country", "device", "pointer_types", "group",
                                                 "handedness", "task"], errors="ignore")
    t = t.join(keep, on="code")
    t["participant"] = t.code.map(pid)
    return t.drop(columns=["code"])


# ── Teach samples ────────────────────────────────────────────────────────────

def export_teach(sessions: list[dict], out: Path) -> int:
    """Teach samples of the sessions whose participants agreed to publication, without any metadata."""
    out.mkdir(parents=True, exist_ok=True)
    chosen = [s for s in sessions if s.get("publishTeachSamples") and s.get("teachSamples")]
    random.Random().shuffle(chosen)  # file order must not follow session order
    year = str(sessions[0].get("year", "0000")) if sessions else "0000"
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
    ap.add_argument("--export-rating", type=Path, help="carpeta on escriure els dibuixos per a la valoració cega")
    ap.add_argument("--agreement", type=Path, nargs=2, metavar=("AVAL1", "AVAL2"), help="acord entre dos avaluadors")
    ap.add_argument("--ratings", type=Path, help="valoració final (consens) de les fletxes; requereix clau.csv al costat")
    args = ap.parse_args()

    sessions = load(args.folder)
    print(f"{len(sessions)} sessions vàlides a {args.folder}")
    if args.check:
        for s in sessions:
            ends = sum(1 for e in s["events"] if e["type"] in ("task-end", "task-skip"))
            print(f"  {s['code']}  grup {s['group']}  {s['participant']['role']:11}  tasques {ends}/{len(s['tasks'])}  "
                  f"SUS {sorted(s.get('sus', {}))}  fase {s['progress']['phase']}")
        return
    if args.agreement:
        print("\n".join(agreement(*args.agreement)))
        return
    if args.export_rating:
        tasks = pd.DataFrame([r for s in sessions for r in task_rows(s)])
        n = export_rating(tasks, sessions, args.export_rating)
        print(f"{n} dibuixos a {args.export_rating}; full_valoracio.csv per als avaluadors, clau.csv per a la persona que no avalua")
        return
    if args.export_teach:
        n = export_teach(sessions, args.export_teach)
        print(f"{n} fitxers de mostres publicables a {args.export_teach}")
        return

    args.out.mkdir(parents=True, exist_ok=True)
    tasks = pd.DataFrame([r for s in sessions for r in task_rows(s)])
    if args.ratings:
        tasks = apply_ratings(tasks, args.ratings, args.ratings.parent / "clau.csv")
    recog = pd.DataFrame([r for s in sessions for r in recognition_rows(s)])
    people = participant_rows(sessions, tasks)
    tasks.to_csv(args.out / "tasques.csv", index=False)
    recog.to_csv(args.out / "reconeixements.csv", index=False)
    people.to_csv(args.out / "participants.csv", index=False)
    summary = statistics(tasks, people, recog)
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
