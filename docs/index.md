---
layout: default
title: MecHand — Freehand Mechanism Drawing
---

# MecHand

**Draw reaction mechanisms by hand. MecHand cleans up and exports to LaTeX.**

MecHand is an open-source extension of [Ketcher](https://github.com/epam/ketcher)
that lets chemists and students sketch reaction mechanisms freely —
with a stylus, trackpad or mouse — and exports the result directly
to **chemfig**, **TikZ** or SVG.

---

## Key features

- **Freehand drawing** via the PointerEvents API (stylus, trackpad, mouse)
- **Sketch recognition** powered by [MolScribe](https://github.com/thomas0809/MolScribe)
- **Consolidating UX** — the tool proposes an interpretation; you confirm or correct
- **Contextual help** — toggleable tooltips designed for both experts and students
- **Export** to chemfig, TikZ, SVG, PNG

---

## Quick start (local)

```bash
# 1. Clone
git clone https://github.com/YOUR_USER/Article_MecHand.git
cd Article_MecHand

# 2. Run the Ketcher dev server
cd ketcher-mechhand
yarn install && yarn start          # → http://localhost:3000

# 3. (Optional) Run the recognition backend
cd ../backend
pip install -r requirements.txt
uvicorn main:app --reload           # → http://localhost:8000
```

---

## Export example

A mechanism sketched in MecHand and exported to chemfig:

```latex
\usepackage{chemfig}

\chemfig{O(-[2]H)-[0]C(=[2]O)-[0]@{c1}C(-[6]H)(-[2]H)-[0]Br}
\chemmove{\draw[->] (c1) .. controls +(0,1) .. (c1);}
```

---

## Cite

> Villa, J. et al. MecHand: Freehand Chemical Mechanism Drawing with
> Sketch Recognition and LaTeX Export. *J. Cheminformatics* (in preparation).

---

[Demo &rarr;](./demo/) &nbsp;&middot;&nbsp; [GitHub](https://github.com/YOUR_USER/Article_MecHand)
