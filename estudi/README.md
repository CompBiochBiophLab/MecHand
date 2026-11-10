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
| [05-consentiment-informat.md](05-consentiment-informat.md) | Participants, CER | Full d'informació (amb l'explicació tècnica de privadesa), consentiment, full del codi i full de revocació |
| [06-sollicitud-comite-etica.md](06-sollicitud-comite-etica.md) | CER | Memòria per a la sol·licitud de dictamen al Comitè d'Ètica de la Recerca de la UVic-UCC |
| [07-proteccio-dades-i-seguretat.md](07-proteccio-dades-i-seguretat.md) | CER, DPD | Inventari de dades, flux, pseudonimització, mesures, anàlisi de riscos |
| [08-questionaris.md](08-questionaris.md) | CER, equip | Qüestionari inicial, SUS en català i preguntes finals |
| [09-anunci-reclutament.md](09-anunci-reclutament.md) | Persones destinatàries, CER | Text de l'anunci per a l'aula i el campus virtual |
| [estimuls/](estimuls/) | Tothom | Imatges de les tasques i [atribucions](estimuls/ATRIBUCIONS.md) |
| [analisi/analitza_sessions.py](analisi/analitza_sessions.py) | Equip | Anàlisi dels fitxers de sessió, valoració cega de les fletxes, taula publicable |
| [analisi/simula_sessions.py](analisi/simula_sessions.py) | Equip | Sessions sintètiques per provar l'anàlisi |

## L'aplicació en mode estudi

`?study=1` (afegiu `&group=A1`, `A2`, `B1` o `B2`). A les sessions, l'aplicació se serveix en una
versió fixada des d'un portàtil a la xarxa local (document 03, §1); la web pública
(<https://compbiochbiophlab.github.io/MecHand/app/?study=1>) només publica versions que han passat
totes les proves. Codi: [`ketcher-mechhand/src/study/`](../ketcher-mechhand/src/study/). Tot es
processa al navegador; la persona participant descarrega el fitxer de sessió i el copia ella mateixa a
la memòria USB de l'estudi. Les proves
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

- Persona de contacte (que no avaluï cap estudiant participant aquest curs), adreça electrònica de
  l'estudi i noms de l'equip (documents 03, 05, 06, 09).
- Data límit de conservació (documents 05 i 07).
- Confirmar amb la secretaria del CER que el formulari de 2020 i l'adreça són vigents; dictamen (codi
  i data als documents 05 i 09).
- Decidir si s'inclouen persones que no entenen el català o si es manté com a criteri d'inclusió. El
  panell de l'aplicació ja existeix en castellà i anglès (`&lang=es`, `&lang=en`); caldria traduir el
  full d'informació i el consentiment, i triar una SUS validada en castellà.
- Preregistre del pla d'anàlisi (OSF).
- Ruta de la carpeta institucional xifrada i memòria USB-C xifrada per maquinari (document 03).
- Dues persones avaluadores per a la valoració cega de les fletxes.
- Prova pilot, també amb tauletes i trackpad.
