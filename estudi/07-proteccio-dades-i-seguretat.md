---
title: "Protecció de dades i seguretat"
subtitle: "Estudi «Avaluació de MecHand» — inventari de dades, mesures i anàlisi de riscos"
author: "Jordi Villà-Freixa, UVic-UCC"
lang: ca
---

Aquest document descriu, per al Comitè d'Ètica de la Recerca (CER) i el delegat de protecció de dades
(DPD) de la UVic-UCC, quines dades es tracten, on, com es protegeixen i quins riscos hi ha. La
informació per a les persones participants és al document 05.

# 1. Principi de disseny

**Privadesa des del disseny i per defecte** (art. 25 RGPD). L'aplicació no té cap servidor que rebi
dades: tot el processament es fa al navegador de la persona participant, que lliura personalment el
fitxer de resultats. L'equip investigador no rep mai dades identificatives junt amb les dades de
recerca.

# 2. Inventari de dades

| Conjunt | Contingut | Identificació | Suport | Accés | Conservació |
| --- | --- | --- | --- | --- | --- |
| Fulls de consentiment i de revocació | Nom, signatura, data, opcions marcades (els de revocació, només el codi) | Identificatiu | Paper, armari tancat, custodiat per la persona de contacte | Persona de contacte; investigador principal només després del tancament de les qualificacions | Com els fitxers de sessió; després es destrueixen |
| Fitxers de sessió (`mechand-estudi-MH-XXXXX.json`) | Vegeu §2.1 | Pseudonimitzat sense clau (vegeu §4) | Emmagatzematge institucional xifrat | Equip investigador | Fins a 5 anys després de la publicació i, en tot cas, no més enllà del [data] |
| Registre de retirades | Codi i data | Pseudonimitzat | Emmagatzematge institucional | Persona de contacte | Com els fitxers de sessió |
| Mostres *Teach* compartides | Símbol o element, escala, coordenades *x*, *y* (0,1 px) | Sense identificador | Dins del fitxer de sessió | Equip investigador | Com els fitxers de sessió |
| Mostres *Teach* publicades (doble consentiment) | Símbol o element, escala, *x*, *y* | Sense identificador ni metadades | Repositori públic de MecHand (MIT) | Públic | Indefinida |
| Dibuixos per a la valoració cega | KET final dels mecanismes, amb nom aleatori; la clau, a part | Sense identificador | Emmagatzematge institucional | Persones avaluadores (sense la clau) | Fins al final de l'anàlisi |
| Resultats i taula anonimitzada | Taules i figures; una fila per tasca sense codi, any, navegador, sistema, país ni mà dominant | Anònim (*k* ≥ 5 sobre rol, curs, dispositiu, regió i experiència) | Article, material suplementari, repositori | Públic | Indefinida |

**No es recull:** nom ni cap identificador personal a l'aplicació, adreça IP, ubicació, data exacta,
identificadors de dispositiu, cadena *user-agent*, galetes, pressió ni inclinació del llapis, imatges
de càmera.

## 2.1 Contingut exacte del fitxer de sessió

Esquema `mechand-study-session/3` (codi: `ketcher-mechhand/src/study/recorder.ts`):

- `code` (aleatori, `crypto.getRandomValues`), `group`, `year` (només l'any), `appVersion` (versió i
  *commit*, p. ex. `0.1.0+44cdba2`), `modelVersion`, `uiLanguage` (idioma de la interfície: `ca` per
  defecte a l'estudi);
- `participant`: `role`, `course`, `device`, `literacyCountry` (codi ISO 3166-1 alfa-2 o buit),
  `handedness` (o nul), `experience`;
- `environment`: `browser` (nom i versió principal), `os` (nom i versió principal si es coneix),
  `architecture` i `architectureSource` (`client-hints` si la dona el navegador, `inferred` si es
  dedueix del sistema, `unknown` si no es coneix), `mobile` (si el navegador es declara mòbil),
  `screen` (amplada i alçada en píxels CSS, densitat), `maxTouchPoints`, `pointerTypes` (`pen`,
  `touch`, `mouse`);
- `tasks` (l'ordre sortejat, la condició i el bloc de cada tasca), `progress` (fase i tasca, per
  reprendre la sessió després d'una recàrrega);
- `events`: per a cada esdeveniment, temps en ms des de l'inici de la sessió, tipus, tasca i dades:
  - `session-start`, `session-restore` (recàrrega de la pàgina), `session-end`;
  - `teach-open`, `teach-end` (nombre de mostres desades, no les mostres);
  - `task-start`, `task-end` o `task-skip` (segons, dibuix final en format KET, traços pendents,
    nombre de contactes ignorats pel rebuig de palmell);
  - `freehand` (activat o no), `pen` (color, tipus de línia i gruix de la tinta; a l'inici de cada
    tasca, també el mode d'entrada i l'eina), `tool` (llapis o goma), `input-mode`;
  - `recognize`: els traços (punts *x*, *y* arrodonits a 0,1 píxels, i inici i final de cada traç en
    ms de sessió) i el resultat del reconeixement (escena, rol de cada traç, etiquetes, fletxes,
    confiança);
  - `insert` (motor i dibuix de Ketcher després d'inserir, en KET), `keep-drawing`, `discard`;
  - `erase` (nombre de traços esborrats i si amb la goma o amb la punta d'esborrar del llapis),
    `undo-ink`, `redo-ink` (quina operació), `clear-ink`;
  - `sus` (condició i respostes);
- `sus` (respostes 1–5 per condició), `comments` (què ha agradat i què no de cada condició,
  preferència, altres comentaris), `shareTeachSamples`, `publishTeachSamples` i, si s'ha acceptat,
  `teachSamples` (només símbol o element, escala i *x*, *y* arrodonits a 0,1 px).

# 3. Flux de les dades

1. La persona participant obre l'aplicació en mode estudi, servida des d'un portàtil de la facultat a
   la xarxa local de l'aula (`npx vite preview --host`, document 03, §1), en una versió fixada que ha
   superat totes les proves automàtiques. El portàtil lliura fitxers estàtics i no en desa registres.
   Només si no és possible, s'usa `https://compbiochbiophlab.github.io/MecHand/app/?study=1`; en aquest
   cas GitHub (EUA) registra la petició HTTP (IP, *user-agent*) com qualsevol servidor web, però no
   rep cap dada de recerca i l'equip no té accés a aquests registres.
2. Tot el processament es fa al navegador. Les dades es desen a la memòria de la pàgina i, com a
   còpia de seguretat, a `localStorage` (clau `mechand.study.session.v3`) del dispositiu. En començar
   la sessió s'esborren les mostres *Teach* que hi hagués al navegador.
3. La persona participant descarrega el fitxer JSON i el copia ella mateixa a la memòria USB de
   l'estudi (USB-C, xifrada per maquinari, utilitzable des de tauletes); la persona de contacte no
   mira el nom del fitxer, que conté el codi. **No s'accepten fitxers per correu electrònic ni per
   serveis de núvol personals.**
4. La persona participant prem «Esborra les dades d'aquest navegador», que elimina la sessió i les
   mostres *Teach* del `localStorage`, i esborra el fitxer de la carpeta de baixades. En dispositius
   de la facultat, la persona de contacte ho fa i esborra també l'historial de baixades.
5. L'equip copia els fitxers de la memòria USB a l'emmagatzematge institucional xifrat i els esborra
   de la memòria el mateix dia.

# 4. Pseudonimització i reidentificació

- El codi `MH-XXXXX` es genera a l'atzar (32⁵ ≈ 33,5 milions de combinacions) al dispositiu de la
  persona participant i només es mostra a la pantalla final. **No hi ha cap taula de
  correspondència**: el codi no consta al full de consentiment, l'equip no l'anota i es compromet a no
  intentar establir la relació entre noms i codis. El fitxer el copia la persona participant mateixa.
  El codi serveix per exercir els drets (art. 11.2 RGPD).
- **Quasi-identificadors.** La combinació de país d'alfabetització, curs, rol, dispositiu,
  experiència i navegador podria singularitzar una persona en un grup petit. Per això: (a) les dades
  es consideren personals (pseudonimitzades) mentre existeixin els fitxers de sessió; (b) no es desa
  la data exacta de la sessió, i la taula d'assignació de grups (document 03) no té data; (c) els
  fitxers no es publiquen mai en brut; (d) als resultats, el país s'agrupa en regions del món; (e) la
  taula a nivell de tasca que es publica (`analitza_sessions.py --public`) compleix *k*-anonimat amb
  *k* ≥ 5 sobre rol, curs, dispositiu agrupat, regió i experiència, i no inclou codi, any, navegador,
  sistema, país, mà dominant ni grup.
- **Escriptura.** Els traços de símbols químics, amb els temps d'inici i final de cada traç, són un
  tret de comportament. No es tracten amb la finalitat d'identificar persones (per tant no són dades
  biomètriques en el sentit dels arts. 4.14 i 9 RGPD), no es comparen amb cap altra mostra, no se'n
  fan perfils ni decisions automatitzades (art. 22 RGPD) i no es recullen signatures ni text lliure
  manuscrit. Les mostres que es publiquen (doble consentiment) no porten temps ni cap metadada.
- **País d'alfabetització.** És opcional, té una finalitat tècnica (estil de cal·ligrafia) i no es fa
  servir com a indicador d'origen ètnic o nacional; es publica només agrupat en regions.

# 5. Base jurídica i drets

- **Responsable:** Fundació Universitària Balmes (UVic-UCC), c. Perot Rocaguinarda, 17, 08500 Vic.
  **DPD:** dpd@uvic.cat.
- **Base jurídica:** consentiment explícit (art. 6.1.a RGPD), finalitat de recerca científica amb les
  garanties de l'art. 89 RGPD i de la Llei orgànica 3/2018 (LOPDGDD).
- **Minimització:** cada camp té una finalitat d'anàlisi (document 01, §6). El país d'alfabetització
  i la mà dominant admeten «prefereixo no respondre».
- **Drets:** s'exerceixen amb el codi (art. 11.2 RGPD; document 05). La retirada esborra el fitxer i
  les mostres no publicades. Les còpies (accés, portabilitat) es lliuren en mà, mai per correu. No es
  poden retirar les dades ja incorporades a resultats agregats publicats ni les mostres ja publicades
  (s'informa abans de consentir).
- **Destinataris i transferències internacionals:** cap cessió a tercers; cap transferència. Els
  fitxers no surten de l'emmagatzematge institucional.
- **Supervisió:** Autoritat Catalana de Protecció de Dades (www.apd.cat).

# 6. Mesures de seguretat

| Risc | Mesura |
| --- | --- |
| Enviament de dades a tercers | Aplicació sense backend; en mode estudi, el servidor de reconeixement opcional està desactivat i els paràmetres d'URL que l'activarien s'ignoren; prova automàtica (`e2e/privacy.spec.ts`, `e2e/study.spec.ts`) a cada canvi del codi, en Chromium, Firefox i WebKit: cap enviament de dades, cap origen extern, cap galeta, servidor no activable |
| Versió no provada | La web pública només es publica després que la CI hagi passat (`.github/workflows/pages.yml`); a les sessions, versió fixada (etiqueta Git) servida en local; el *commit* consta a *About* i a cada fitxer |
| Dades identificatives al fitxer | Prova automàtica que el fitxer no conté la cadena *user-agent* ni la data; camps tancats al qüestionari; avís de no escriure dades personals a les respostes obertes |
| Dades que queden en un dispositiu compartit | Esborrat automàtic de les mostres *Teach* en començar; botó d'esborrat al final; esborrat de baixades i historial en dispositius de la facultat |
| Pèrdua de la memòria USB | Memòria xifrada per maquinari (PIN); còpia i esborrat el mateix dia |
| Accés no autoritzat | Emmagatzematge institucional amb autenticació i accés limitat a l'equip |
| Vinculació nom–dades | Consentiments en paper, separats, sense codi, custodiats per la persona de contacte; el codi només es mostra al final; la persona participant copia el fitxer |
| Integritat del codi | Codi obert i versionat (Git), proves automàtiques; la versió de l'aplicació (amb el *commit*) i del model consta a cada fitxer |

# 7. Anàlisi de riscos (resum)

| Risc per a les persones | Probabilitat | Impacte | Risc residual |
| --- | --- | --- | --- |
| Reidentificació a partir de quasi-identificadors | Baixa (accés restringit, sense data, sense publicació en brut, *k* ≥ 5) | Baix (no hi ha dades sensibles) | Baix |
| Ús de l'escriptura per identificar | Molt baixa (no hi ha mostres de referència vinculades a la identitat) | Baix | Molt baix |
| Coacció per relació docent–estudiant | Baixa (vegeu document 06, §5) | Mitjà | Baix |
| Filtració d'un fitxer de sessió | Baixa | Baix (sense identificadors directes) | Baix |

No es tracten categories especials de dades (art. 9 RGPD) ni dades de menors. Segons els criteris de
l'art. 35 RGPD, no es considera necessària una avaluació d'impacte completa; aquest document es lliura
al DPD perquè ho confirmi.

# 8. Codi obert

MecHand és programari lliure (llicència MIT): <https://github.com/CompBiochBiophLab/MecHand>. El
codi del mode estudi (`ketcher-mechhand/src/study/`), les proves de privadesa (`ketcher-mechhand/e2e/`)
i aquests documents (`estudi/`) són públics, de manera que el CER, el DPD i les persones participants
poden verificar què es registra i què no.
