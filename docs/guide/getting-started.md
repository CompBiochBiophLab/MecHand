# Getting started

## Use it online

Open **<https://compbiochbiophlab.github.io/MecHand/app/>** in Chrome, Edge, Firefox or Safari
(desktop, iPad or Android tablet). There is nothing to install: the editor, the chemistry
engine and the handwriting recognizer all run in your browser. The first visit downloads
about 9 MB; after that the browser keeps it in its cache.

![MecHand with a mechanism template open](/img/app-template.png)

The MecHand bar sits above the Ketcher editor:

| Button | What it does |
| --- | --- |
| **Freehand** (pen icon; Alt/⌥+F) | Turns the pen layer on and off. When it is off, Ketcher's own tools work as usual. When it is on, the [pen bar](./drawing#the-pen-bar) appears below: pen or eraser, ink colour, kind of line, width and input mode. |
| **Recognize** (Space) | Reads your ink and shows what MecHand understood. |
| **Undo / Redo ink** (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z in freehand mode) | Undoes or redoes the last change to the ink: a stroke, an erasure or a clear. |
| **Clear ink** (bin icon) | Removes all strokes that have not been inserted yet (Undo brings them back). |
| **Library** (Ctrl/⌘+K) | Template library: rings, functional groups, biomolecules, reagents and complete mechanisms; also draws a molecule from its SMILES, InChI, CAS number or name. |
| **Export** | TikZ, chemfig, ChemDraw (CDXML), MOL/RXN, KET, SMILES. |
| **Teach** | Teaches MecHand your handwriting. |
| **About** | Version, recognition model, structure engine and browser notes. |
| **?** | Shows short help labels on every button (Expert or Student level). |

Continue with [Drawing mechanisms](./drawing), or follow the [tutorial (PDF)](/tutorial.pdf).

## Run it on your own computer

You need [Node.js](https://nodejs.org) 20.19 or newer (LTS recommended).

::: code-group

```sh [macOS (Homebrew)]
brew install node
```

```sh [Windows (winget)]
winget install OpenJS.NodeJS.LTS
```

```sh [Linux (Debian/Ubuntu)]
sudo apt install nodejs npm   # or use the installers at nodejs.org
```

:::

Then:

```sh
git clone https://github.com/CompBiochBiophLab/MecHand.git
cd MecHand/ketcher-mechhand
npm ci          # installs the exact versions in package-lock.json (Ketcher 3.18.0, React 19, Vite 8)
npm run dev     # → http://localhost:5173
```

npm comes with Node.js; yarn is not needed (Ketcher itself moved from yarn to npm).

`npm run build` writes a static site to `dist/` that any web server can host.
