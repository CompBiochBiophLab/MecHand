---
layout: default
title: MecHand — Demo
---

# Try MecHand

> **Local demo** — the live hosted demo is coming once the repository goes public.
> Until then, run it in 60 seconds with the commands below.

---

## Quick local run

```bash
git clone https://github.com/JordiVillaFreixa/Article_MecHand.git
cd Article_MecHand/ketcher-mechhand
yarn install && yarn start
# → open http://localhost:3000
```

The drawing canvas loads immediately — recognition is **optional**.
To enable it start the backend in a second terminal:

```bash
cd ../backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt    # ~500 MB on first run (MolScribe weights)
uvicorn main:app --reload
# → http://localhost:8000
```

---

## Workflow walkthrough

| Step | What you do | What MecHand does |
|------|-------------|-------------------|
| 1 | Sketch atoms and bonds freely with trackpad or stylus | Stroke classifier separates atom sites, bonds, and arrows in real time |
| 2 | Sketch a curved arrow for electron flow | Arrow detector finds the arrowhead and curvature |
| 3 | Press **Consolidate** (or wait 1.5 s) | "Is this what you meant?" overlay appears with the interpreted structure |
| 4 | ✓ Confirm · ✎ Edit · ✗ Discard | Confirmed structure is committed to the Ketcher canvas |
| 5 | Click **Export → chemfig** | LaTeX snippet ready to paste into your manuscript |

---

## Export example

A simple SN2 mechanism sketched and exported:

```latex
\usepackage{chemfig}
\usepackage{tikz}
\usetikzlibrary{arrows.meta, bending}

% chemfig output
\chemfig{Nu^{-} -[,1.5,,,->] @{c}C(-[2]LG)(-[6]H)(-[0]H)}
\chemmove{\draw[->] (Nu) .. controls +(0,0.5) and +(0,0.5) .. (c);}
```

---

[← Home](./index.html)
