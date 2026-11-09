---
title: "Avaluació de MecHand amb estudiants i professorat — disseny experimental"
subtitle: "Estudi d'usabilitat i de reconeixement d'escriptura de mecanismes de reacció"
author: "Jordi Villà-Freixa (investigador principal), Departament de Biociències, FCTE, UVic-UCC"
lang: ca
---

# 1. Context i objectius

MecHand és una aplicació web de codi obert (llicència MIT) que afegeix el dibuix a mà alçada de
mecanismes de reacció a l'editor químic Ketcher. Un reconeixedor que s'executa íntegrament al
navegador llegeix els traços (enllaços, etiquetes d'àtoms, càrregues, parells d'electrons i fletxes
corbes) i els converteix en estructures editables, que es poden exportar a LaTeX (TikZ, `chemfig`),
ChemDraw (CDXML) i formats MDL. Fins ara s'ha avaluat només amb escriptura sintètica. Aquest estudi
n'avalua l'ús real.

**Objectiu general.** Avaluar si el dibuix a mà alçada amb MecHand permet representar molècules i
mecanismes de reacció de manera més ràpida, igualment correcta i més satisfactòria que les eines
convencionals de Ketcher, i mesurar la precisió del reconeixement amb escriptura real de persones
que van aprendre a escriure en països diferents i que dibuixen amb dispositius diferents.

**Objectius específics.**

1. Comparar el temps necessari per reproduir molècules i mecanismes amb dibuix a mà alçada
   (MecHand) i amb les eines de Ketcher.
2. Comparar la correcció dels dibuixos resultants en les dues condicions.
3. Mesurar la usabilitat percebuda de cada condició amb l'escala SUS (*System Usability Scale*).
4. Mesurar la precisió del reconeixement (àtoms, enllaços, càrregues, fletxes) amb escriptura real, i
   com varia segons el dispositiu (llapis, dit, ratolí, trackpad) i el país on el participant va
   aprendre a llegir i escriure (com a indicador de l'estil de cal·ligrafia).
5. Avaluar l'efecte de l'entrenament personal del model (mode *Teach*) sobre la precisió.
6. Obtenir, amb consentiment explícit, mostres d'escriptura per millorar el model obert de MecHand.

# 2. Hipòtesis

- **H1** (principal). Per als mecanismes, el temps per tasca és menor amb MecHand que amb Ketcher.
- **H2**. La proporció de dibuixos correctes amb MecHand no és inferior a la de Ketcher (marge de
  no-inferioritat: 10 punts percentuals).
- **H3**. La puntuació SUS de MecHand és ≥ 68 (usabilitat per sobre de la mitjana de referència) i no
  és inferior a la de Ketcher.
- **H4** (exploratòria). La precisió del reconeixement és més alta amb llapis que amb ratolí o
  trackpad, i varia segons el país d'alfabetització; l'entrenament amb *Teach* redueix aquestes
  diferències.

# 3. Participants

| Grup | Criteris d'inclusió | Mida prevista |
| --- | --- | --- |
| Estudiants | Matriculats al grau en Biotecnologia de la UVic-UCC, 18 anys o més, que han cursat almenys una assignatura de química orgànica o bioquímica | 32–36 |
| Professorat | Personal docent i investigador de la FCTE que imparteix o ha impartit química | 8–12 |

**Exclusió.** Persones menors d'edat; persones que no puguin donar el consentiment; persones que
hagin participat en el desenvolupament de MecHand.

**Mida de la mostra.** El contrast principal (H1) és intrasubjecte. Per detectar un efecte mitjà
(*d* = 0,5) amb una prova aparellada bilateral, α = 0,05 i potència 0,80, calen 34 participants
(amb *d* = 0,6, 24). Es preveuen 32–36 estudiants (8–9 per grup de contrabalanceig). El professorat
s'analitza de forma descriptiva i com a factor en els models; no es fa un contrast de potència
específic per a aquest grup.

**Reclutament.** Anunci a les aules i al campus virtual, fet per una persona que no avalua els
estudiants en aquell moment (vegeu el document 06, apartat de relació de poder). Participació
voluntària, fora de l'horari lectiu, sense cap efecte en les qualificacions. No hi ha compensació
econòmica.

# 4. Disseny

Disseny intrasubjecte, encreuat (*crossover*) 2 × 2, amb contrabalanceig de l'ordre de les
condicions i de l'assignació dels conjunts d'estímuls:

| Grup | Bloc 1 | Bloc 2 |
| --- | --- | --- |
| A1 | Conjunt A · MecHand | Conjunt B · Ketcher |
| A2 | Conjunt B · Ketcher | Conjunt A · MecHand |
| B1 | Conjunt B · MecHand | Conjunt A · Ketcher |
| B2 | Conjunt A · Ketcher | Conjunt B · MecHand |

Els participants s'assignen als grups per ordre d'arribada, de forma rotatòria (A1, A2, B1, B2, A1…),
separadament per a estudiants i professorat, perquè els grups quedin equilibrats.

**Condicions.**

- **MecHand**: dibuix a mà alçada amb reconeixement; es poden fer correccions amb les eines de Ketcher.
- **Ketcher**: només les eines de Ketcher (enllaços, àtoms, fletxes); el dibuix a mà alçada està
  desactivat.

En els dos casos les plantilles de mecanismes estan desactivades.

**Estímuls.** Imatges de domini públic o amb llicència CC BY 4.0 de Wikimedia Commons (vegeu
`estimuls/ATRIBUCIONS.md`). Cada conjunt té quatre tasques, aparellades per tipus i dificultat:

| Tipus | Conjunt A | Conjunt B |
| --- | --- | --- |
| Molècula senzilla (1 anell) | Paracetamol | Dopamina |
| Molècula amb anells fusionats | Cafeïna | Serotonina |
| Mecanisme SN2 (2 fletxes corbes, ions) | OH⁻ + CH₃CHFBr | CN⁻ + (1-cloroetil)benzè |
| Pas d'un mecanisme aldòlic (3 fletxes corbes, equilibri) | Desprotonació per OH⁻ → enolat | Desprotonació de l'aldehid protonat per l'aigua → enol |

Cada bloc comença amb una tasca de pràctica (àcid acetilsalicílic) que no s'analitza.

# 5. Procediment (≈ 60 min per sessió)

1. **Benvinguda i consentiment** (5–10 min). Full d'informació, preguntes, signatura del
   consentiment. La persona investigadora no anota cap codi al full signat.
2. **Qüestionari inicial** a l'aplicació (2 min): rol, curs, dispositiu, país on va aprendre a llegir
   i escriure, mà dominant (opcional), experiència prèvia amb programes de dibuix químic.
3. **Entrenament** (10 min): mode *Teach*, unes 3 mostres de cada lletra, signe, fletxa i parell
   d'electrons (document 04).
4. **Bloc 1** (15–20 min): pràctica + 4 tasques en la condició assignada; SUS de la condició.
5. **Bloc 2** (15–20 min): pràctica + 4 tasques en l'altra condició; SUS.
6. **Preguntes obertes** (3 min) i **descàrrega del fitxer de sessió**, que es lliura en mà.
7. **Esborrat** de les dades del navegador si el dispositiu és compartit.

Les sessions es fan en una aula de la FCTE, individualment o en grups petits (màxim 8 persones,
cadascuna amb el seu dispositiu), amb la persona investigadora present per resoldre dubtes tècnics
però sense ajudar a dibuixar.

**Dispositius.** Els participants poden fer servir el seu propi dispositiu (tauleta amb llapis,
ordinador portàtil) o un de la facultat. Es buscarà diversitat de dispositius: es recomana que almenys
un terç dels participants dibuixin amb llapis.

# 6. Variables i mesures

Totes les mesures les registra l'aplicació en mode estudi (`?study=1`) al fitxer de sessió.

| Variable | Definició | Font |
| --- | --- | --- |
| Temps per tasca | Segons entre «Comença la tasca» i «He acabat» | Esdeveniments `task-start`, `task-end` |
| Correcció estructural | Proporció d'espècies de referència presents al dibuix final (SMILES canònic, RDKit); tasca correcta si hi són totes | KET final vs. SMILES de referència |
| Correcció de les fletxes | Nombre de fletxes corbes = referència | KET final |
| Precisió del reconeixement | Per a cada reconeixement: àtoms, enllaços i fletxes reconeguts que es conserven a l'estructura inserida; nombre de correccions | Esdeveniments `recognize`, `insert`, `keep-drawing`, `discard` |
| Esforç | Nombre de reconeixements, traços desfets i descartats per tasca | Esdeveniments |
| Usabilitat | SUS (0–100) per condició | Qüestionari a l'aplicació |
| Opinió | Respostes obertes | Qüestionari final |
| Covariables | Rol, curs, dispositiu, tipus de punter, país d'alfabetització, mà dominant, experiència, navegador i sistema, mostres *Teach* | Qüestionari inicial i entorn |

# 7. Anàlisi

Script: `analisi/analitza_sessions.py` (Python, RDKit, pandas, statsmodels).

- **H1.** Model lineal mixt: log(temps) ~ condició × tipus (molècula/mecanisme) + bloc + conjunt +
  rol + (1 | participant) + (1 | estímul). Es comprova l'efecte d'arrossegament (condició × bloc). Com
  a anàlisi de sensibilitat, prova de Wilcoxon aparellada sobre la mediana de temps per participant.
- **H2.** Model logístic mixt de la correcció amb els mateixos factors; diferència de proporcions
  aparellada amb IC del 95 % per a la no-inferioritat.
- **H3.** Puntuació SUS (Brooke, 1996) per condició; IC del 95 % de la mitjana; Wilcoxon aparellada.
- **H4.** Model logístic mixt de la precisió del reconeixement per element (àtom, enllaç, fletxa) amb
  dispositiu, país d'alfabetització (agrupat per sistema d'escriptura o regió si hi ha menys de 5
  persones per país) i nombre de mostres *Teach* com a factors; anàlisi descriptiva dels errors.
- **Respostes obertes:** anàlisi temàtica breu.

Les tasques de pràctica s'exclouen. Les tasques omeses compten com a incorrectes i amb temps
censurat (anàlisi de sensibilitat amb i sense). Es reportaran estudiants i professorat per separat i
conjuntament. Les dades i l'script d'anàlisi (sense dades identificatives) s'inclouran al material
suplementari de l'article.

# 8. Aspectes ètics i protecció de dades

Vegeu els documents 05 (full d'informació i consentiment), 06 (sol·licitud al Comitè d'Ètica de la
Recerca de la UVic-UCC) i 07 (protecció de dades i seguretat). En resum: no es recull cap dada
identificativa a l'aplicació; tot es processa i es desa al navegador del participant; el fitxer de
sessió el descarrega i el lliura el mateix participant; el codi de participant és aleatori i només el
coneix el participant.

# 9. Calendari

| Fase | Data prevista |
| --- | --- |
| Sol·licitud al CER | [data] |
| Prova pilot (2–3 persones, no analitzades) | [data] |
| Sessions amb estudiants i professorat | [període] |
| Anàlisi i redacció | [període] |

# 10. Referències

- Brooke J. SUS: a "quick and dirty" usability scale. A: Jordan PW et al. (eds.) *Usability
  Evaluation in Industry*. Taylor & Francis; 1996. p. 189–194.
- Bangor A, Kortum P, Miller J. Determining what individual SUS scores mean: adding an adjective
  rating scale. *J Usability Stud.* 2009;4(3):114–123.
- Vatavu R-D, Anthony L, Wobbrock JO. Gestures as point clouds: a $P recognizer for user interface
  prototypes. *Proc. ICMI*; 2012. p. 273–280.
