---
title: "Protecció de dades i seguretat"
subtitle: "Estudi «Avaluació de MecHand» — inventari de dades, mesures i anàlisi de riscos"
author: "Jordi Villà-Freixa, UVic-UCC"
lang: ca
---

Aquest document descriu, per al Comitè d'Ètica de la Recerca (CER) i el delegat de protecció de dades
(DPD) de la UVic-UCC, quines dades es tracten, on, com es protegeixen i quins riscos hi ha. La
informació per als participants és al document 05.

# 1. Principi de disseny

**Privadesa des del disseny i per defecte** (art. 25 RGPD). L'aplicació no té cap servidor que rebi
dades: tot el processament es fa al navegador del participant, i el participant lliura personalment el
fitxer de resultats. L'equip investigador no rep mai dades identificatives junt amb les dades de
recerca.

# 2. Inventari de dades

| Conjunt | Contingut | Identificació | Suport | Accés | Conservació |
| --- | --- | --- | --- | --- | --- |
| Fulls de consentiment | Nom, signatura, data, opcions marcades | Identificatiu | Paper, armari tancat del grup de recerca | IP | 5 anys després de la publicació |
| Fitxers de sessió (`mechand-estudi-MH-XXXXX.json`) | Codi aleatori, grup, data, respostes, entorn tècnic, traços, reconeixements, decisions, dibuix final, SUS, comentaris | Pseudonimitzat sense clau (vegeu §4) | Emmagatzematge institucional xifrat | Equip investigador | 5 anys després de la publicació |
| Mostres *Teach* compartides | Símbol o element, escala, coordenades *x*, *y* | Sense identificador | Dins del fitxer de sessió | Equip investigador | Com els fitxers de sessió |
| Mostres *Teach* publicades (doble consentiment) | Símbol o element, escala, *x*, *y* | Sense identificador ni metadades | Repositori públic de MecHand (MIT) | Públic | Indefinida |
| Resultats agregats | Taules i figures; països agrupats si n < 5 | Anònim (k ≥ 5) | Article i material suplementari | Públic | Indefinida |

**No es recull:** nom ni cap identificador personal a l'aplicació, adreça IP, ubicació, identificadors
de dispositiu, cadena *user-agent*, galetes, pressió ni inclinació del llapis, imatges de càmera.

## 2.1 Contingut exacte del fitxer de sessió

Esquema `mechand-study-session/2` (codi: `ketcher-mechhand/src/study/recorder.ts`):

- `code` (aleatori, `crypto.getRandomValues`), `group`, `date` (AAAA-MM-DD), `appVersion`, `modelVersion`;
- `participant`: `role`, `course`, `device`, `literacyCountry` (codi ISO 3166-1 alfa-2 o buit),
  `handedness` (o nul), `experience`;
- `environment`: `browser` (nom i versió principal), `os` (nom i versió principal si es coneix),
  `architecture` i `architectureSource` (*client hints* del navegador, inferida del sistema o
  desconeguda), `mobile`, `screen` (amplada, alçada en píxels CSS, densitat), `maxTouchPoints`,
  `pointerTypes` (`pen`, `touch`, `mouse`);
- `tasks` (ordre i condició), `progress`;
- `events`: per a cada esdeveniment, temps en ms des de l'inici de la sessió, tipus i tasca;
  els reconeixements inclouen els traços (punts *x*, *y* arrodonits a 0,1 píxels, i inici i final de
  cada traç en ms de sessió) i el resultat; el final de cada tasca inclou el dibuix final (format KET);
- `sus`, `comments`, `shareTeachSamples` i, si s'ha acceptat, `teachSamples`.

# 3. Flux de les dades

1. El participant obre `https://compbiochbiophlab.github.io/MecHand/app/?study=1` (o una còpia
   servida des d'un ordinador de la facultat a la xarxa local). El servidor web lliura fitxers
   estàtics; com qualsevol servidor, registra la petició HTTP (IP, *user-agent*). GitHub n'és el
   responsable; l'equip investigador no hi té accés. Per evitar-ho del tot, es pot servir l'aplicació
   des d'un portàtil de l'equip (`make dev` o `npm run preview`) a la xarxa de l'aula.
2. Tot el processament es fa al navegador. Les dades es desen a la memòria de la pàgina i, com a
   còpia de seguretat, a `localStorage` (clau `mechand.study.session.v2`) del dispositiu.
3. El participant descarrega el fitxer JSON i el copia en un llapis USB de l'equip, davant de la
   persona investigadora. Alternativa: pujada a una carpeta institucional de la UVic-UCC amb enllaç
   de només càrrega. **No s'accepten fitxers per correu electrònic ni per serveis de núvol personals.**
4. El participant prem «Esborra les dades d'aquest navegador», que elimina la sessió i les mostres
   *Teach* del `localStorage`. En dispositius de la facultat, la persona investigadora ho comprova.
5. L'equip copia els fitxers del llapis USB a l'emmagatzematge institucional xifrat i els esborra del
   llapis el mateix dia.

# 4. Pseudonimització i reidentificació

- El codi `MH-XXXXX` es genera a l'atzar (32⁵ ≈ 33,5 milions de combinacions) al dispositiu del
  participant. **No hi ha cap taula de correspondència**: el codi no consta al full de consentiment i
  l'equip no el registra. Només el participant el coneix, i només serveix per exercir els drets.
- **Quasi-identificadors.** La combinació de país d'alfabetització, curs, rol, dispositiu, navegador
  i data podria singularitzar una persona en un grup petit. Per això les dades es consideren
  personals (pseudonimitzades) mentre existeixin els fitxers de sessió, i: (a) els fitxers no es
  publiquen mai en brut; (b) als resultats, els països amb menys de 5 participants s'agrupen per regió
  o sistema d'escriptura; (c) qualsevol taula a nivell de tasca que es publiqui compleix
  *k*-anonimat amb *k* ≥ 5 sobre els quasi-identificadors (rol, curs, dispositiu agrupat, regió),
  i no inclou la data, el codi ni el navegador.
- **Escriptura.** Els traços de símbols químics, amb els temps d'inici i final de cada traç, són un
  tret de comportament. No es tracten amb la finalitat d'identificar persones (per tant no són dades
  biomètriques en el sentit de l'art. 4.14 i 9 RGPD), no es comparen amb cap altra mostra i no es
  recullen signatures ni text lliure manuscrit. Les mostres que es publiquen (doble consentiment) no
  porten temps ni cap metadada.

# 5. Base jurídica i drets

- **Responsable:** Fundació Universitària Balmes (UVic-UCC), c. Perot Rocaguinarda, 17, 08500 Vic.
  **DPD:** dpd@uvic.cat.
- **Base jurídica:** consentiment explícit (art. 6.1.a RGPD), finalitat de recerca científica amb les
  garanties de l'art. 89 RGPD i de la Llei orgànica 3/2018 (LOPDGDD).
- **Minimització:** cada camp té una finalitat d'anàlisi (document 01, §6). El país d'alfabetització
  i la mà dominant admeten «prefereixo no respondre».
- **Drets:** s'exerceixen amb el codi (document 05). La retirada esborra el fitxer i les mostres no
  publicades. No es poden retirar les dades ja incorporades a resultats agregats publicats ni les
  mostres ja publicades (s'informa abans de consentir).
- **Transferències internacionals:** cap. Els fitxers no surten de l'emmagatzematge institucional.
  La pàgina es pot descarregar de GitHub Pages (EUA), però no s'hi envien dades de recerca.
- **Supervisió:** Autoritat Catalana de Protecció de Dades (www.apd.cat).

# 6. Mesures de seguretat

| Risc | Mesura |
| --- | --- |
| Enviament de dades a tercers | Aplicació sense backend; prova automàtica (`e2e/privacy.spec.ts`, `e2e/study.spec.ts`) a cada canvi del codi, en Chromium, Firefox i WebKit: cap enviament de dades, cap origen extern, cap galeta |
| Dades identificatives al fitxer | Prova automàtica que el fitxer no conté la cadena *user-agent*; camps tancats al qüestionari; avís de no escriure dades personals a les respostes obertes |
| Dades que queden en un dispositiu compartit | Botó d'esborrat al final; comprovació per la persona investigadora; avís a l'inici si hi ha mostres *Teach* d'una altra persona |
| Pèrdua del llapis USB | Llapis xifrat (p. ex. BitLocker To Go o APFS xifrat); còpia i esborrat el mateix dia |
| Accés no autoritzat | Emmagatzematge institucional amb autenticació i accés limitat a l'equip |
| Vinculació nom–dades | Consentiments en paper, separats, sense codi |
| Integritat del codi | Codi obert i versionat (Git); la versió de l'aplicació i del model consta a cada fitxer |

# 7. Anàlisi de riscos (resum)

| Risc per a les persones | Probabilitat | Impacte | Risc residual |
| --- | --- | --- | --- |
| Reidentificació a partir de quasi-identificadors | Baixa (accés restringit, sense publicació en brut) | Baix (no hi ha dades sensibles) | Baix |
| Ús de l'escriptura per identificar | Molt baixa (no hi ha mostres de referència vinculades a la identitat) | Baix | Molt baix |
| Coacció per relació docent–estudiant | Baixa (vegeu document 06, §5) | Mitjà | Baix |
| Filtració d'un fitxer de sessió | Baixa | Baix (sense identificadors directes) | Baix |

No es tracten categories especials de dades (art. 9 RGPD) ni dades de menors. Segons els criteris de
l'art. 35 RGPD, no es considera necessària una avaluació d'impacte completa; aquest document se'n
lliura al DPD perquè ho confirmi.

# 8. Codi obert

MecHand és programari lliure (llicència MIT): <https://github.com/CompBiochBiophLab/MecHand>. El
codi del mode estudi (`ketcher-mechhand/src/study/`), les proves de privadesa (`ketcher-mechhand/e2e/`)
i aquests documents (`estudi/`) són públics, de manera que el CER, el DPD i els participants poden
verificar què es registra i què no.
