---
layout: home

hero:
  name: MecHand
  text: Draw reaction mechanisms by hand
  tagline: Sketch structures and curved arrows with a pen, trackpad or mouse. MecHand recognizes them in your browser, checks the electron flow, and exports to LaTeX, ChemDraw and Marvin.
  image:
    src: /img/recognize-dialog.png
    alt: MecHand recognizing a hand-drawn SN2 mechanism
  actions:
    - theme: brand
      text: Open MecHand
      link: https://jordivillafreixa.github.io/MecHand/app/
      target: _self
    - theme: alt
      text: Getting started
      link: /guide/getting-started
    - theme: alt
      text: Tutorial (PDF)
      link: /tutorial.pdf
      target: _blank

features:
  - title: Handwriting recognition in the browser
    details: Bonds, rings, atom labels, charges and curved arrows are read from your strokes as you draw them. Nothing to install and nothing leaves your computer.
  - title: Electron-flow checks
    details: Each curved arrow is anchored to an atom or a bond. MecHand warns when an arrow starts without electrons or overfills an octet, as Marvin's electron-flow arrows do.
  - title: Built on Ketcher
    details: Recognized structures land in Ketcher (EPAM), a full chemical editor, so you can clean them up, add stereochemistry, or keep drawing with its tools.
  - title: Direct export to LaTeX
    details: TikZ with curved arrows as Bézier curves, chemfig schemes, plus CDXML (ChemDraw), MOL/RXN (Marvin, RDKit), KET and SMILES.
  - title: Standard mechanisms included
    details: 13 templates from organic, inorganic and biological chemistry (SN2, E2, Diels–Alder, Pt(II) substitution, serine proteases, kinases…).
  - title: An updatable, open model
    details: The symbol model is a versioned JSON file in the repository. Teach MecHand your handwriting in the app and contribute your samples back.
---
