# Development

## Repository layout

```
MecHand/
├── ketcher-mechhand/        the web app (Vite + React + TypeScript)
│   ├── src/
│   │   ├── App.tsx          Ketcher editor + MecHand bar
│   │   ├── ink/             pen input (Pointer Events) and the ink layer
│   │   ├── recognition/     handwriting recognizer, $P model, electron-flow check
│   │   ├── scene/           KET ⇄ Scene conversion
│   │   ├── export/          TikZ and chemfig exporters
│   │   ├── templates/       mechanism templates (KET) and their index
│   │   └── ui/              dialogs and toolbar
│   ├── templates/           build_templates.py (RDKit generator of the templates)
│   ├── e2e/                 Playwright tests (Chromium, Firefox, WebKit)
│   └── package.json         Ketcher 3.18.0 and every other dependency, pinned
├── backend/                 optional DECIMER recognition server (FastAPI)
├── docs/                    this website (VitePress)
├── tutorial/                user tutorial (LaTeX → PDF, with a Makefile)
└── manuscript/              Journal of Cheminformatics manuscript (LaTeX, with a Makefile)
```

## Ketcher as a dependency

Ketcher is used as published npm packages (`ketcher-core`, `ketcher-react`, `ketcher-standalone`),
pinned to an exact version in `package.json`. There is no copy or fork of Ketcher's code in this
repository. To update it:

```sh
cd ketcher-mechhand
npm install --save-exact ketcher-core@<v> ketcher-react@<v> ketcher-standalone@<v>
npm test && npm run e2e
```

## Tests

| Command | What it checks |
| --- | --- |
| `npm test` | Recognizer unit tests, recognition benchmark on the templates, KET parsing, exporters |
| `npm run test:latex` | Compiles every template's TikZ and chemfig export with pdflatex |
| `npm run typecheck` | TypeScript |
| `npm run e2e` | Playwright in Chromium, Firefox and WebKit (`npx playwright install` first) |
| `cd backend && pytest` | Server API with a fake model (`pip install -r requirements-dev.txt`) |

GitHub Actions runs them on every push (`.github/workflows/ci.yml`) and deploys the website and the
app to GitHub Pages from `main` (`.github/workflows/pages.yml`).

::: tip WebKit tests on a Mac
Playwright's WebKit on macOS does not receive mouse events while the display is asleep. Keep it awake
(`caffeinate -u -t 600 &`) when running `npm run e2e` locally.
:::

## The website

```sh
cd docs
npm ci
npm run dev       # → http://localhost:5173/MecHand/
```

Screenshots in `docs/public/img/` are taken from the running app with Playwright.
