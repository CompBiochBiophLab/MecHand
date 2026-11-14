# Stimulus attributions

The images of the analysed tasks come from Wikimedia Commons and are in the public domain or licensed
under Creative Commons Attribution 4.0 (CC BY 4.0). They were downloaded as PNG (1920 px wide) from
the original SVG, with no other modification. For some images, the task instructions ask for only
part of the image to be drawn; the image is always shown in full.

The image of the practice task was created by the MecHand project ([`source/practica-acid-base.svg`](source/practica-acid-base.svg),
converted to PNG) and is released under CC0 1.0 (public domain).

| File | Original image | Author | Licence |
| --- | --- | --- | --- |
| `practica-acid-base.png` | [source/practica-acid-base.svg](source/practica-acid-base.svg) | MecHand project | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `A1-paracetamol.png` | [Paracetamol-skeletal.svg](https://commons.wikimedia.org/wiki/File:Paracetamol-skeletal.svg) | Benjah-bmm27 | Public domain |
| `A2-cafeina.png` | [Caffeine-2D-skeletal.svg](https://commons.wikimedia.org/wiki/File:Caffeine-2D-skeletal.svg) | Benjah-bmm27 | Public domain |
| `A3-sn2-walden.png` | [SN2 Walden inversion example.svg](https://commons.wikimedia.org/wiki/File:SN2_Walden_inversion_example.svg) | Pillsmarch | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| `A4-aldol-basic.png` | [Base-catalysed aldol condensation.svg](https://commons.wikimedia.org/wiki/File:Base-catalysed_aldol_condensation.svg) | Pillsmarch | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| `B1-dopamina.png` | [Dopamine.svg](https://commons.wikimedia.org/wiki/File:Dopamine.svg) | Sunridin (attribution assumed by Wikimedia Commons) | Public domain |
| `B2-serotonina.png` | [Serotonin-2D-skeletal.svg](https://commons.wikimedia.org/wiki/File:Serotonin-2D-skeletal.svg) | CYL | Public domain |
| `B3-sn2-cianur.png` | [Mechanism of sn2 reaction between (1-chloroethyl)benzene and sodium cyanide.svg](https://commons.wikimedia.org/wiki/File:Mechanism_of_sn2_reaction_between_(1-chloroethyl)benzene_and_sodium_cyanide.svg) | Unknown author | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| `B4-aldol-acid.png` | [Acid-catalysed aldol condensation.svg](https://commons.wikimedia.org/wiki/File:Acid-catalysed_aldol_condensation.svg) | Pillsmarch | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |

References used to score the drawings (SMILES of the species to be drawn and number of curved
arrows). In the aldol mechanisms, the R group is drawn as CH₃ (the task text says so), because
MecHand does not recognise the letter R and so that both conditions are scored in the same way. In
the SN2 reactions, the counter-ions (Na⁺) and the final salt, which the task text says need not be
drawn, are not scored. Set and kind are given as the values of the `set` and `kind` fields of
`stimuli.json` (`practica`: practice; `molecula`: molecule; `mecanisme`: mechanism).

| Stimulus | Set | Kind | Reference SMILES | Curved arrows |
| --- | --- | --- | --- | --- |
| practica-acid-base | practica | mecanisme | `CC(=O)O · [OH-] · CC(=O)[O-] · O` | 2 |
| A1-paracetamol | A | molecula | `CC(=O)Nc1ccc(O)cc1` | 0 |
| A2-cafeina | A | molecula | `Cn1c(=O)c2c(ncn2C)n(C)c1=O` | 0 |
| A3-sn2-walden | A | mecanisme | `[OH-] · CC(F)Br · CC(O)F` | 2 |
| A4-aldol-basic | A | mecanisme | `CCC=O · [OH-] · CC=C[O-]` | 3 |
| B1-dopamina | B | molecula | `NCCc1ccc(O)c(O)c1` | 0 |
| B2-serotonina | B | molecula | `NCCc1c[nH]c2ccc(O)cc12` | 0 |
| B3-sn2-cianur | B | mecanisme | `CC(Cl)c1ccccc1 · [C-]#N · CC(C#N)c1ccccc1` | 2 |
| B4-aldol-acid | B | mecanisme | `CCC=[OH+] · O · CC=CO` | 3 |

The complete list, with the text of each task, is in
[`ketcher-mechhand/src/study/stimuli.json`](../../src/study/stimuli.json), the file used by the app.
