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
git clone https://github.com/YOUR_USER/Article_MecHand.git
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
pdflatex main.tex && bibtex main && pdflatex main.tex && pdflatex main.tex
```

---

## Citation (pre-print)

> Villa, J. et al. MecHand: Freehand Chemical Mechanism Drawing with
> Sketch Recognition and Direct Export to LaTeX. *J. Cheminformatics* (in preparation).
