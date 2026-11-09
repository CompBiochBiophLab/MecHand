# Atribucions dels estímuls

Les imatges de les tasques analitzades provenen de Wikimedia Commons i són de domini públic o tenen
llicència Creative Commons Reconeixement 4.0 (CC BY 4.0). S'han descarregat com a PNG (1920 px
d'amplada) a partir de l'SVG original, sense cap altra modificació. Les instruccions de les tasques
demanen dibuixar només una part d'algunes imatges; la imatge es mostra sencera.

La imatge de la tasca de pràctica és d'elaboració pròpia ([`font/practica-acid-base.svg`](font/practica-acid-base.svg),
convertida a PNG) i es publica amb llicència CC0 1.0 (domini públic).

| Fitxer | Imatge original | Autor/a | Llicència |
| --- | --- | --- | --- |
| `practica-acid-base.png` | [font/practica-acid-base.svg](font/practica-acid-base.svg) | Projecte MecHand | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `A1-paracetamol.png` | [Paracetamol-skeletal.svg](https://commons.wikimedia.org/wiki/File:Paracetamol-skeletal.svg) | Benjah-bmm27 | Public domain |
| `A2-cafeina.png` | [Caffeine-2D-skeletal.svg](https://commons.wikimedia.org/wiki/File:Caffeine-2D-skeletal.svg) | Benjah-bmm27 | Public domain |
| `A3-sn2-walden.png` | [SN2 Walden inversion example.svg](https://commons.wikimedia.org/wiki/File:SN2_Walden_inversion_example.svg) | Pillsmarch | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| `A4-aldol-basic.png` | [Base-catalysed aldol condensation.svg](https://commons.wikimedia.org/wiki/File:Base-catalysed_aldol_condensation.svg) | Pillsmarch | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| `B1-dopamina.png` | [Dopamine.svg](https://commons.wikimedia.org/wiki/File:Dopamine.svg) | Sunridin (attribution assumed by Wikimedia Commons) | Public domain |
| `B2-serotonina.png` | [Serotonin-2D-skeletal.svg](https://commons.wikimedia.org/wiki/File:Serotonin-2D-skeletal.svg) | CYL | Public domain |
| `B3-sn2-cianur.png` | [Mechanism of sn2 reaction between (1-chloroethyl)benzene and sodium cyanide.svg](https://commons.wikimedia.org/wiki/File:Mechanism_of_sn2_reaction_between_(1-chloroethyl)benzene_and_sodium_cyanide.svg) | Unknown author | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| `B4-aldol-acid.png` | [Acid-catalysed aldol condensation.svg](https://commons.wikimedia.org/wiki/File:Acid-catalysed_aldol_condensation.svg) | Pillsmarch | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |

Referències que es fan servir per avaluar els dibuixos (SMILES de les espècies que cal dibuixar i
nombre de fletxes corbes). En els mecanismes aldòlics, el grup R es dibuixa com a CH₃ (ho diu
l'enunciat), perquè MecHand no reconeix la lletra R i perquè les dues condicions es puntuïn igual. En
les SN2 no es puntuen els contraions (Na⁺) ni la sal final, que l'enunciat diu que no cal dibuixar.

| Estímul | Conjunt | Tipus | SMILES de referència | Fletxes corbes |
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

La llista completa, amb el text de cada tasca, és a [`estimuls.json`](estimuls.json) (còpia idèntica a
`ketcher-mechhand/src/study/stimuli.json`, la que fa servir l'aplicació).
