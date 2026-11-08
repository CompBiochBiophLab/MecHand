# MecHand

> Freehand chemical mechanism drawing — Ketcher extension with sketch recognition and LaTeX export.

**Status:** early development (pre-publication)
**License:** MIT (MecHand additions) · Apache 2.0 (Ketcher upstream)

---

## Repository layout

```
Article_MecHand/
├── ketcher-mechhand/        Ketcher fork (Ketcher added as upstream remote)
│   └── packages/
│       └── ketcher-react/src/plugins/
│           ├── freehand/    Stroke capture + classification
│           ├── recognition/ MolScribe HTTP client + arrow detector
│           ├── consolidate/ "Is this what you meant?" overlay
│           ├── export/      chemfig + TikZ exporters
│           └── help/        Context-sensitive help system
├── backend/                 Python FastAPI + MolScribe wrapper
├── docs/                    Jekyll site (GitHub Pages)
└── manuscript/              J. Cheminformatics LaTeX manuscript
```

---

## Setup

### 1 — Clone Ketcher as upstream and place our files

```bash
# Create the repo on GitHub (private), then:
git clone https://github.com/JordiVillaFreixa/Article_MecHand.git
cd Article_MecHand

# Add Ketcher as upstream
git remote add upstream https://github.com/epam/ketcher.git
git fetch upstream
git checkout -b main upstream/master

# Copy MecHand plugin files into place
cp -r ketcher-mechhand/packages/ketcher-react/src/plugins \
      node_modules/../packages/ketcher-react/src/   # adjust path after clone
```

> **Alternatively**, open in VS Code and run the `Tasks: Setup MecHand` task
> (defined in `.vscode/tasks.json`, coming in a future commit).

### 2 — Run the frontend (Vite dev server)

```bash
cd ketcher-mechhand
yarn install
yarn start
# → http://localhost:3000
# Test with your Mac trackpad directly in the browser.
```

### 3 — Run the recognition backend (optional for drawing/export)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # downloads MolScribe weights on first run
uvicorn main:app --reload
# → http://localhost:8000
```

### 4 — Build the Jekyll documentation site

```bash
cd docs
bundle install
bundle exec jekyll serve
# → http://localhost:4000/Article_MecHand/
```

---

## Keeping in sync with upstream Ketcher

```bash
git fetch upstream
git merge upstream/master --no-edit
# resolve conflicts in our plugin files if needed
```

---

## Manuscript

The manuscript for submission to *Journal of Cheminformatics* is in `manuscript/`.

```bash
cd manuscript
make            # → main.pdf (latexmk runs pdflatex + bibtex as many times as needed)
make view       # build and open the PDF
make watch      # rebuild on every save
make clean      # remove auxiliary files (make distclean also removes the PDF)
```

The manuscript uses the [Springer Nature LaTeX template](https://www.springernature.com/gp/authors/campaigns/latex-author-support)
(`sn-jnl`), which also covers BMC journals such as *J. Cheminformatics*. The class and
bibliography style (`sn-jnl.cls`, `sn-vancouver-num.bst`) are not part of TeX Live:
`make` downloads them into `manuscript/` the first time (or run `make template`).
Requires `latexmk`, `curl` and `unzip`.

---

## Citation (pre-print)

> J. Villà-Freixa. MecHand: Freehand Chemical Mechanism Drawing with
> Sketch Recognition and Direct Export to LaTeX. *J. Cheminformatics* (in preparation).

## Author

**Jordi Villà-Freixa** · ORCID [0000-0002-6359-3929](https://orcid.org/0000-0002-6359-3929) · [jordi.villa@uvic.cat](mailto:jordi.villa@uvic.cat)

1. Department of Biosciences, University of Vic - Central University of Catalonia (UVic-UCC), Vic, Spain
2. IRIS-CC (Institut de Recerca i Innovació en Ciències de la Vida i de la Salut a la Catalunya Central), Vic, Spain
3. Computational Biochemistry and Biophysics Lab, Research Group on Bioinformatics and Bioimaging (BI-SQUARE), Universitat de Vic - Universitat Central de Catalunya (UVic-UCC), Vic, Spain
