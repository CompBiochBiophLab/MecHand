# Estudi amb usuaris: avaluació de MecHand

Materials de l'estudi d'usabilitat i de reconeixement d'escriptura de MecHand amb estudiants del grau
en Biotecnologia i professorat de química de la Facultat de Ciències, Tecnologia i Enginyeries (FCTE)
de la UVic-UCC. Investigador principal: Jordi Villà-Freixa (jordi.villa@uvic.cat).

| Document | Per a qui | Contingut |
| --- | --- | --- |
| [01-disseny-experimental.md](01-disseny-experimental.md) | Equip, CER | Objectius, hipòtesis, participants, disseny encreuat, mesures, anàlisi |
| [02-instruccions-participants.md](02-instruccions-participants.md) | Participants | Què cal fer a la sessió, pas a pas |
| [03-guia-investigador.md](03-guia-investigador.md) | Equip | Preparació, guió de la sessió, incidències, recollida de fitxers |
| [04-entrenament-model.md](04-entrenament-model.md) | Equip, participants | Com s'entrena el model (*Teach*) i com s'incorporen les mostres al model compartit |
| [05-consentiment-informat.md](05-consentiment-informat.md) | Participants, CER | Full d'informació (amb l'explicació tècnica de privadesa), consentiment i full del codi |
| [06-sollicitud-comite-etica.md](06-sollicitud-comite-etica.md) | CER | Memòria per a la sol·licitud de dictamen al Comitè d'Ètica de la Recerca de la UVic-UCC |
| [07-proteccio-dades-i-seguretat.md](07-proteccio-dades-i-seguretat.md) | CER, DPD | Inventari de dades, flux, pseudonimització, mesures, anàlisi de riscos |
| [08-questionaris.md](08-questionaris.md) | CER, equip | Qüestionari inicial, SUS en català i preguntes obertes |
| [estimuls/](estimuls/) | Tothom | Imatges de les tasques i [atribucions](estimuls/ATRIBUCIONS.md) |
| [analisi/analitza_sessions.py](analisi/analitza_sessions.py) | Equip | Anàlisi dels fitxers de sessió |

## L'aplicació en mode estudi

<https://compbiochbiophlab.github.io/MecHand/app/?study=1> (afegiu `&group=A1`, `A2`, `B1` o `B2`).
Codi: [`ketcher-mechhand/src/study/`](../ketcher-mechhand/src/study/). Tot es processa al navegador;
el participant descarrega el fitxer de sessió i el lliura en mà. Les proves
[`e2e/study.spec.ts`](../ketcher-mechhand/e2e/study.spec.ts) i
[`e2e/privacy.spec.ts`](../ketcher-mechhand/e2e/privacy.spec.ts) comproven, en Chromium, Firefox i
WebKit, que no s'envia cap dada i què conté (i què no) el fitxer.

## PDF

```bash
make -C estudi          # tots els documents → estudi/pdf/*.pdf (pandoc + XeLaTeX)
make -C estudi clean
```

## Programari lliure

MecHand és programari lliure (llicència MIT, [LICENSE](../LICENSE)); aquests documents també formen
part del repositori públic, de manera que qualsevol persona (participants, CER, DPD) pot verificar
què fa l'aplicació. Les imatges dels estímuls conserven les seves llicències (domini públic o
CC BY 4.0).

## Pendent abans de començar

- Noms de l'equip i persona que recull els consentiments (documents 05, 06).
- Dictamen del CER (codi i data al document 05).
- Versions del full d'informació en castellà i anglès.
- Ruta de la carpeta institucional xifrada (document 03).
- Prova pilot.
