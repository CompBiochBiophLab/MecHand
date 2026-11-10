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
4. Mesurar la precisió del reconeixement amb escriptura real, i com varia segons el dispositiu
   (llapis, dit, ratolí, ratolí tàctil o *trackpad*) i el país on cada persona va aprendre a llegir i escriure (com a
   indicador de l'estil de cal·ligrafia).
5. Explorar la relació entre l'entrenament personal del model (*Ensenya*, en anglès *Teach*) i la precisió.
6. Obtenir, amb consentiment explícit, mostres d'escriptura per millorar el model obert de MecHand.

# 2. Hipòtesis

- **H1** (principal). Per als mecanismes, el temps per tasca és menor amb MecHand que amb Ketcher.
- **H2**. La proporció de dibuixos correctes amb MecHand no és inferior a la de Ketcher (marge de
  no-inferioritat: 10 punts percentuals).
- **H3**. La puntuació SUS de MecHand és superior a 68 (la mitjana de referència) i no és inferior a
  la de Ketcher (marge: 5 punts SUS).
- **H4** (exploratòria). La proporció de lectures acceptades a la primera és més alta amb llapis que
  amb ratolí o trackpad, varia segons la regió d'alfabetització i augmenta amb el nombre de mostres
  *Teach*.

El pla d'anàlisi (§7) i l'script es preregistren (OSF) abans de la primera sessió.

# 3. Participants

| Grup | Criteris d'inclusió | Mida prevista |
| --- | --- | --- |
| Estudiants | Persones matriculades al grau en Biotecnologia de la UVic-UCC, de 18 anys o més, que han cursat almenys una assignatura de química orgànica o bioquímica i que entenen el català escrit | objectiu 36, mínim 34 |
| Professorat | Personal docent i investigador de la FCTE que imparteix o ha impartit química | 8–12 |

**Exclusió.** Persones menors d'edat; persones que no puguin donar el consentiment; persones que
hagin participat en el desenvolupament de MecHand.

**Mida de la mostra.** El contrast principal (H1) és intrasubjecte. Per detectar un efecte mitjà
(*d* = 0,5) amb una prova aparellada bilateral, α = 0,05 i potència 0,80, calen 34 participants
(amb *d* = 0,6, 24). L'objectiu és 36 estudiants (9 per grup de contrabalançament), amb un mínim de
34. H2 és secundària: amb aquesta mida, l'interval de la diferència de proporcions té una amplada
d'uns ±10 punts, de manera que la no-inferioritat només es podrà afirmar si les dues condicions
tenen una correcció molt semblant; es reportarà l'interval sigui quin sigui el resultat. El
professorat s'analitza de forma descriptiva i com a factor en els models.

**Reclutament.** Anunci a les aules (fora de l'horari de classe) i al campus virtual, fet per la
persona de contacte de l'estudi, que no avalua cap estudiant participant aquest curs (vegeu el
document 06, relació de poder). Participació voluntària, fora de l'horari lectiu, sense cap efecte en
les qualificacions. No hi ha compensació econòmica.

# 4. Disseny

Disseny intrasubjecte, encreuat (*crossover*) 2 × 2, amb contrabalançament de l'ordre de les
condicions i de l'assignació dels conjunts d'estímuls:

| Grup | Bloc 1 | Bloc 2 |
| --- | --- | --- |
| A1 | Conjunt A · MecHand | Conjunt B · Ketcher |
| A2 | Conjunt B · Ketcher | Conjunt A · MecHand |
| B1 | Conjunt B · MecHand | Conjunt A · Ketcher |
| B2 | Conjunt A · Ketcher | Conjunt B · MecHand |

Les persones participants s'assignen als grups per ordre d'arribada, de forma rotatòria (A1, A2, B1,
B2, A1…), separadament per a estudiants i professorat, perquè els grups quedin equilibrats. Dins de
cada bloc, l'aplicació sorteja l'ordre de les quatre tasques per a cada persona (generador aleatori
criptogràfic del navegador); l'ordre queda registrat.

**Condicions.**

- **MecHand**: dibuix a mà alçada amb reconeixement; es poden fer correccions amb les eines de Ketcher.
- **Ketcher**: només les eines de Ketcher (enllaços, àtoms, fletxes); el dibuix a mà alçada està
  desactivat.

En els dos casos la biblioteca de plantilles està desactivada.

**Estímuls.** Imatges de domini públic o amb llicència CC BY 4.0 de Wikimedia Commons (vegeu
`estimuls/ATRIBUCIONS.md`). Cada conjunt té quatre tasques, aparellades per tipus i dificultat:

| Tipus | Conjunt A | Conjunt B |
| --- | --- | --- |
| Molècula senzilla (1 anell) | Paracetamol | Dopamina |
| Molècula amb anells fusionats | Cafeïna | Serotonina |
| Mecanisme SN2 (2 fletxes corbes, ions) | OH⁻ + CH₃CHFBr | CN⁻ + (1-cloroetil)benzè |
| Pas d'un mecanisme aldòlic (3 fletxes corbes, equilibri) | Desprotonació per OH⁻ → enolat | Desprotonació de l'aldehid protonat per l'aigua → enol |

Els enunciats eviten ambigüitats que afectarien diferent les dues condicions: a les SN2 no cal
dibuixar els contraions (Na⁺), la sal final ni l'estereoquímica (falques), i no es puntuen; als
mecanismes aldòlics, on la imatge té un grup R, es demana dibuixar CH₃ (MecHand no reconeix la lletra
R, i en la puntuació un R dibuixat amb Ketcher també compta com a CH₃).

Cada bloc comença amb la mateixa tasca de pràctica, que no s'analitza: una reacció àcid-base (àcid
acètic + hidròxid → acetat + aigua) amb dues fletxes corbes, d'elaboració pròpia (CC0), perquè les dues
condicions practiquin les fletxes corbes i les càrregues abans de les tasques cronometrades.

# 5. Procediment (≈ 60 min per sessió)

1. **Benvinguda i consentiment** (5–10 min). Full d'informació, preguntes, signatura del
   consentiment (dues còpies). Ningú no anota cap codi al full signat.
2. **Demostració** (3 min), igual per a tothom, de les dues maneres de dibuixar (document 03, §4).
3. **Qüestionari inicial** a l'aplicació (2 min): rol, curs, dispositiu, país on va aprendre a llegir
   i escriure, mà dominant (opcional), experiència prèvia amb programes de dibuix químic.
4. **Entrenament** (10 min): *Ensenya*, unes 3 mostres de cada lletra, signe, fletxa i parell
   d'electrons, menys si MecHand ja les llegeix bé (document 04).
5. **Bloc 1** (15–20 min): pràctica + 4 tasques en la condició assignada; SUS de la condició.
6. Pausa opcional (2–3 min).
7. **Bloc 2** (15–20 min): pràctica + 4 tasques en l'altra condició; SUS.
8. **Preguntes finals** (3 min): què ha agradat i què no de cada manera de treballar, quina es
   prefereix per dibuixar mecanismes, i comentaris.
9. **Descàrrega del fitxer de sessió**, que la mateixa persona participant copia a la memòria USB de
   l'estudi, i **esborrat** de les dades del navegador i de la carpeta de baixades.

Les sessions es fan en una aula de la FCTE, individualment o en grups petits (màxim 8 persones,
cadascuna amb el seu dispositiu). Les sessions amb estudiants les porta la persona de contacte; la
persona de contacte resol dubtes tècnics però no ajuda a dibuixar. L'aplicació es serveix des d'un
portàtil de la facultat a la xarxa local, en una versió fixada que ha superat totes les proves
automàtiques (document 03, §1).

**Dispositius.** Les persones participants poden fer servir el seu propi dispositiu (tauleta amb
llapis, ordinador portàtil) o un de la facultat. Es buscarà diversitat de dispositius: es recomana que
almenys un terç dibuixin amb llapis. A la barra de tinta es pot triar el mode d'entrada (rebuig de
palmell, dit, trackpad) i l'aspecte de la tinta; tot queda registrat.

# 6. Variables i mesures

Totes les mesures les registra l'aplicació en mode estudi (`?study=1`) al fitxer de sessió.

| Variable | Definició | Font |
| --- | --- | --- |
| Temps per tasca | Segons entre «Comença la tasca» i «He acabat» (si la pàgina es recarrega, des de l'últim inici; la tasca queda marcada) | Esdeveniments `task-start`, `task-end`, `session-restore` |
| Correcció estructural | Totes les espècies de referència presents al dibuix final (SMILES canònic sense estereoquímica, RDKit); les espècies sobrants es compten però no penalitzen | KET final vs. SMILES de referència |
| Correcció de les fletxes | Automàtica: nombre de fletxes corbes = referència. Valoració cega: dues persones avaluadores, sense saber la condició, decideixen si cada fletxa comença i acaba on toca (kappa de Cohen; discrepàncies per consens) | KET final |
| Dibuix correcte | Correcció estructural i de les fletxes (amb la valoració cega quan està disponible); les tasques omeses compten com a incorrectes | — |
| Precisió del reconeixement | Lectura acceptada a la primera (el primer reconeixement de la tasca acaba en «Insert»); proporció de reconeixements acceptats; correccions amb Ketcher després d'inserir (espècies després de l'última inserció ≠ espècies finals) | Esdeveniments `recognize`, `insert` (amb el KET), `keep-drawing`, `discard` |
| Esforç | Nombre de reconeixements, operacions de desfer/refer, esborrats amb la goma, tinta esborrada i descartada per tasca | Esdeveniments |
| Ús de l'entrada | Mode d'entrada, canvis de llapis/goma i d'aspecte, contactes ignorats pel rebuig de palmell | Esdeveniments `pen`, `tool`, `input-mode`, `erase`; `ignoredContacts` |
| Usabilitat | SUS (0–100) per condició | Qüestionari a l'aplicació |
| Preferència i opinió | Manera preferida per dibuixar mecanismes; respostes obertes | Qüestionari final |
| Covariables | Rol, curs, dispositiu, tipus de punter, país d'alfabetització (agrupat en regions), mà dominant, experiència, navegador i sistema, posició de la tasca dins del bloc, nombre de mostres *Teach* | Qüestionari inicial, entorn i esdeveniments |

# 7. Anàlisi

Script: `analisi/analitza_sessions.py` (Python, RDKit, pandas, NumPy, SciPy, statsmodels). Es pot
provar amb dades sintètiques (`analisi/simula_sessions.py`). Les tasques de pràctica s'exclouen.

- **H1 (principal).** Només mecanismes. Model lineal mixt: log(temps) ~ condició × bloc + estímul +
  rol + posició dins del bloc + (1 | participant). L'estímul és un efecte fix (absorbeix el conjunt):
  amb vuit estímuls, una variància d'estímul no s'estima bé. El terme condició × bloc avalua
  l'efecte d'arrossegament. Anàlisi primària sobre les tasques acabades; anàlisi de sensibilitat amb
  les tasques omeses imputades amb el temps màxim observat per a aquell estímul. Com a contrast no
  paramètric de suport, prova de Wilcoxon aparellada unilateral sobre la mediana de temps de
  mecanisme per participant. Secundàriament, el mateix model amb totes les tasques i la interacció
  condició × tipus.
- **H2.** Diferència de proporció de dibuixos correctes (MecHand − Ketcher) per participant, amb IC
  del 95 % per *bootstrap* de participants (5 000 rèpliques); no-inferioritat si el límit inferior és
  > −0,10. Model de suport: regressió logística amb equacions d'estimació generalitzades (GEE,
  correlació intercanviable dins de cada participant) amb condició, tipus, bloc i rol.
- **H3.** SUS (Brooke, 1996) per condició. H3a: prova *t* unilateral de la SUS de MecHand contra 68,
  amb IC del 95 %. H3b: diferència aparellada (MecHand − Ketcher) amb IC del 95 % per *bootstrap*;
  no-inferioritat si el límit inferior és > −5 punts; prova de Wilcoxon aparellada com a suport.
- **H4 (exploratòria).** Lectura acceptada a la primera (tasques de MecHand): descriptius per grup de
  dispositiu i regió d'alfabetització, i regressió logística GEE amb grup de dispositiu, regió
  (agrupada en «altres» si té menys de 5 persones) i nombre de mostres *Teach*. Descriptius de les
  correccions amb Ketcher després d'inserir i dels errors de reconeixement.
- **Preferència i respostes obertes:** freqüències i anàlisi temàtica breu.

Es reportaran estudiants i professorat per separat i conjuntament, i les tasques reiniciades per una
recàrrega de la pàgina. Les dades i l'script d'anàlisi (sense dades identificatives, taula amb
k ≥ 5) s'inclouran al material suplementari de l'article.

**Limitacions previstes.** La valoració de les fletxes és cega respecte a la condició només en part
(un dibuix inserit des de MecHand pot tenir una disposició reconeixible). Les persones participants
coneixen la condició i l'investigador principal és l'autor de l'eina: per això l'anàlisi es
preregistra, la correcció és automàtica o cega i es publiquen tots els resultats.

# 8. Aspectes ètics i protecció de dades

Vegeu els documents 05 (full d'informació i consentiment), 06 (sol·licitud al Comitè d'Ètica de la
Recerca de la UVic-UCC) i 07 (protecció de dades i seguretat). En resum: no es recull cap dada
identificativa a l'aplicació; tot es processa i es desa al navegador de la persona participant, que
descarrega el fitxer de sessió i el copia ella mateixa a la memòria USB de l'estudi; el codi de
participant és aleatori, només es mostra a la pantalla final, i l'equip no anota enlloc la relació
entre noms i codis.

# 9. Calendari

| Fase | Data prevista |
| --- | --- |
| Sol·licitud al CER | [data] |
| Preregistre del pla d'anàlisi (OSF) | [data] |
| Prova pilot (2–3 persones, amb consentiment; no s'analitzen i els fitxers s'esborren) | [data] |
| Sessions amb estudiants i professorat | [període] |
| Valoració cega de les fletxes | [període] |
| Anàlisi i redacció | [període] |

# 10. Referències

- Brooke J. SUS: a "quick and dirty" usability scale. A: Jordan PW et al. (eds.) *Usability
  Evaluation in Industry*. Taylor & Francis; 1996. p. 189–194.
- Bangor A, Kortum P, Miller J. Determining what individual SUS scores mean: adding an adjective
  rating scale. *J Usability Stud.* 2009;4(3):114–123.
- Vatavu R-D, Anthony L, Wobbrock JO. Gestures as point clouds: a $P recognizer for user interface
  prototypes. *Proc. ICMI*; 2012. p. 273–280.
