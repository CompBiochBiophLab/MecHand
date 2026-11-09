# Export to LaTeX and other editors

**Export** converts what is on the Ketcher canvas — your recognized sketches, templates, and
anything drawn with Ketcher's tools, including curved arrows — into:

| Format | Use |
| --- | --- |
| **TikZ** | Structures and curved arrows with absolute coordinates, easy to fine-tune by hand. Electron-pair arrows are cubic Bézier curves with a full head; fishhooks use a half head (`harpoon`). |
| **chemfig** | One `\chemfig` per molecule inside a `\schemestart … \schemestop` scheme; curved arrows become `\chemmove` between named atoms. |
| **ChemDraw (CDXML)** | Opens in ChemDraw (and in Marvin, which reads CDXML). |
| **MOL / RXN** | MDL formats for Marvin, ChemDraw, RDKit, Open Babel… (RXN when the canvas holds a reaction). |
| **KET** | Ketcher's native JSON; keeps everything, including arrows. |
| **SMILES** | Structures only. |

![Export dialog](/img/export-dialog.png)

Copy the code or download a file. The LaTeX formats start with the preamble lines they need:

```latex
% TikZ
\usepackage{tikz}
\usetikzlibrary{arrows.meta,bending}

% chemfig
\usepackage{chemfig}
\usetikzlibrary{arrows.meta,bending,calc}
```

chemfig draws `\chemmove` arrows from positions recorded during the first run, so compile twice.
Every template's TikZ and chemfig output is compiled with `pdflatex` in the test suite
(`npm run test:latex`), so the code you get compiles.

## From ChemDraw or Marvin to MecHand

Ketcher opens MOL, RXN, SDF, CDXML, CDX, SMILES and KET files (Ketcher → Open). A mechanism drawn in
ChemDraw can therefore be continued in MecHand and exported to LaTeX. ChemDraw's and Marvin's
curved-arrow objects are not part of the MDL formats, so only CDXML/KET keep them.
