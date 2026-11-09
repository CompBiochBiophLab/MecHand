---
title: "Full d'informació i consentiment informat"
subtitle: "Estudi «Avaluació de MecHand: dibuix a mà alçada de mecanismes de reacció»"
lang: ca
---

# Full d'informació per a la persona participant

Et convidem a participar en un estudi de la Universitat de Vic – Universitat Central de Catalunya
(UVic-UCC). Llegeix aquest full amb calma i pregunta tot el que vulguis abans de decidir-te.

## Qui fa l'estudi

- **Investigador principal:** Jordi Villà-Freixa, Departament de Biociències, Facultat de Ciències,
  Tecnologia i Enginyeries (FCTE), UVic-UCC. Correu: jordi.villa@uvic.cat
- **Equip:** [noms de les altres persones de l'equip, si n'hi ha]
- **Dictamen del Comitè d'Ètica de la Recerca de la UVic-UCC:** [codi i data]

## De què tracta

MecHand és una aplicació web, feta a la UVic-UCC, que permet dibuixar a mà alçada molècules i
mecanismes de reacció (amb fletxes corbes) i els converteix en estructures químiques editables.
Volem saber si dibuixar a mà alçada amb MecHand és més ràpid i còmode que fer-ho amb les eines
habituals d'un editor químic, i com de bé reconeix MecHand la lletra de persones diferents, que van
aprendre a escriure en països diferents i que dibuixen amb dispositius diferents.

## Què hauràs de fer

Una sessió d'uns **60 minuts**, en una aula de la FCTE:

1. Respondre unes preguntes breus a l'aplicació (vegeu «Quines dades es recullen»).
2. **Entrenar** MecHand amb la teva lletra (uns 10 minuts): dibuixar unes quantes vegades lletres,
   signes, fletxes i parells d'electrons.
3. **Reproduir 10 imatges** de molècules i mecanismes (2 de pràctica), la meitat amb dibuix a mà
   alçada i la meitat amb les eines de l'editor, i valorar cada manera de treballar amb 10 preguntes.
4. Respondre, si vols, tres preguntes obertes.
5. **Descarregar el fitxer de la sessió i lliurar-lo** a la persona responsable (en mà, en un llapis
   USB).

No és cap examen: no s'avalua el que saps de química, sinó l'eina. Pots fer servir el teu dispositiu
(tauleta, portàtil) o un de la facultat.

## Participació voluntària

Participar és **voluntari**. Decidir no participar, o deixar-ho a mitja sessió, no té cap
conseqüència, i **no afecta de cap manera les teves qualificacions** ni la relació amb el professorat.
No hi ha cap compensació econòmica.

## Riscos i beneficis

Els riscos són mínims: una mica de cansament o la sensació de ser observat/da. Pots fer pauses. No
hi ha beneficis directes per a tu més enllà de conèixer una eina nova; les teves dades ajudaran a
millorar una eina oberta per a l'ensenyament de la química.

## Quines dades es recullen

L'aplicació (en «mode estudi») genera un **codi aleatori** (per exemple, `MH-7K3Q9`) i registra
**només** això:

| Dada | Exemple | Per què |
| --- | --- | --- |
| Codi aleatori i grup de l'estudi | `MH-7K3Q9`, `A1` | Ordenar les dades sense saber qui ets |
| Versió de l'aplicació i del model | 0.1.0, 1.3.0 | Saber amb quina versió s'ha fet la sessió |
| Data (sense hora) | 2026-12-03 | Organitzar les sessions |
| Rol i curs | estudiant, 2n curs | Comparar grups |
| Dispositiu amb què dibuixes | tauleta amb llapis | La precisió depèn del dispositiu |
| **País on vas aprendre a llegir i escriure** (pots no respondre) | Marroc | Cada sistema escolar ensenya una cal·ligrafia; volem saber si MecHand reconeix bé totes les cal·ligrafies |
| Mà amb què escrius (opcional) | esquerra | Canvia la direcció dels traços |
| Experiència amb programes de dibuix químic | poca | Comparar grups |
| **Navegador i sistema** (només el nom i la versió principal) | Safari 19, iPadOS 26 | Comprovar que funciona a tots els navegadors |
| **Arquitectura del processador** (si el navegador la proporciona) | arm 64 | Comprovar el funcionament en diferents equips |
| Mida de la pantalla i densitat de píxels | 1180 × 820, ×2 | Relacionar la mida del dibuix amb la pantalla |
| Si la pantalla és tàctil (nombre de punts tàctils) i quin tipus de punter fas servir | llapis, dit | La precisió depèn del punter |
| Per a cada tasca: temps, **els traços que dibuixes** (punts *x*, *y* i el moment en què comença i acaba cada traç), què ha reconegut MecHand, què decideixes (acceptar, corregir, descartar) i el dibuix final | — | Mesurar rapidesa, correcció i precisió del reconeixement |
| Valoracions (10 preguntes per condició) i respostes obertes | — | Usabilitat |
| Mostres d'entrenament (*Teach*) — **només si hi dones permís** a sota | — | Millorar el model de reconeixement |

**No es recull:** el teu nom, el correu, el número d'estudiant, l'adreça IP, la ubicació, cap
identificador del dispositiu ni del navegador (no es desa la cadena *user-agent* completa), cap
galeta (*cookie*), ni la pressió o la inclinació del llapis. A les respostes obertes no hi escriguis
cap dada personal.

## Per què la teva escriptura no surt del teu dispositiu: explicació tècnica

1. **Tot el càlcul es fa al teu navegador.** MecHand és una pàgina web estàtica: un cop carregada,
   el reconeixement de l'escriptura (un programa en JavaScript i un model en format JSON que es
   descarreguen amb la pàgina) s'executa al teu dispositiu. **No hi ha cap servidor que rebi els
   teus dibuixos**: l'aplicació no fa cap petició de xarxa amb dades teves.
2. **Les dades es desen només al teu navegador.** Durant la sessió, les dades es guarden a la
   memòria de la pàgina i, perquè no es perdin si es recarrega, a l'emmagatzematge local del
   navegador (*localStorage*) del teu dispositiu. No s'usen galetes ni cap servei d'analítica.
3. **Tu decideixes si les lliures.** Al final, l'aplicació crea un fitxer de text (JSON) que
   **descarregues tu** i lliures **en mà** a la persona responsable. Si no el lliures, l'equip
   investigador no té cap dada teva. Pots obrir el fitxer i llegir-ne el contingut abans de lliurar-lo.
   Després, el botó «Esborra les dades d'aquest navegador» n'esborra la còpia local.
4. **Ho comprova una prova automàtica.** Cada vegada que es canvia el codi de MecHand, unes proves
   automàtiques executen l'aplicació en els tres motors de navegador principals (Chromium, Firefox i
   WebKit/Safari) i fallen si l'aplicació envia dades a qualsevol lloc, contacta un servidor diferent
   del que ha servit la pàgina o desa una galeta. Un cop carregada, l'única cosa que la pàgina
   descarrega en mode estudi són les imatges de les tasques. Una d'aquestes proves fa una sessió
   d'estudi completa i comprova que el fitxer de sessió no conté la cadena *user-agent* ni cap altra
   dada identificativa.
5. **Les dades del navegador són genèriques.** Del navegador només es desa el nom i la versió
   principal (p. ex. «Firefox 149»), el sistema (p. ex. «Windows»), l'arquitectura (p. ex. «x86 64»,
   només si el navegador la proporciona) i la mida de la pantalla: dades que comparteixen milions de
   dispositius. No es desa cap identificador únic.
6. **El servidor web.** La pàgina es descarrega de GitHub Pages (o d'un ordinador de la facultat).
   Com qualsevol servidor web, el que serveix la pàgina rep la petició de descàrrega (amb l'adreça IP),
   però no rep res del que fas a la pàgina, i l'equip investigador no té accés a aquests registres.
7. **El codi és obert i verificable.** El codi de MecHand és **programari lliure** (llicència MIT) i
   és públic a <https://github.com/CompBiochBiophLab/MecHand>; la web és
   <https://compbiochbiophlab.github.io/MecHand/>. Qualsevol persona pot comprovar què fa
   l'aplicació, inclòs el mode estudi (carpeta `ketcher-mechhand/src/study/`). Dins l'aplicació, el
   desplegable «Què es registra» mostra en tot moment què s'està registrant al teu dispositiu.

### L'escriptura a mà, és una dada personal?

Els traços de la teva escriptura poden reflectir trets personals (la manera d'escriure és un tret de
comportament). Per això:

- només es recullen traços de **símbols químics** (lletres d'elements, signes, enllaços i fletxes),
  mai una signatura ni text lliure manuscrit;
- **no es fa servir l'escriptura per identificar ningú** ni es compara amb cap altra mostra de la teva
  lletra;
- no es recull la pressió ni la inclinació del llapis, i les posicions s'arrodoneixen a 0,1 píxels;
- les mostres d'entrenament només es publiquen si hi dones permís, i **sense temps ni cap altra dada**
  (ni codi, ni país, ni dispositiu): només el símbol i les coordenades *x*, *y* dels traços.

### Dades que, combinades, podrien identificar-te

El país d'alfabetització, el curs, el dispositiu i el navegador, combinats, podrien fer reconeixible
algú en un grup petit. Per evitar-ho: (a) només l'equip investigador té accés als fitxers de
sessió; (b) **els fitxers de sessió no es publicaran mai en brut**; (c) als resultats publicats, els
països amb menys de 5 participants s'agrupen per regions o sistemes d'escriptura, i qualsevol taula
de dades que es publiqui tindrà almenys 5 persones per a cada combinació de característiques.

## Com es guarden i durant quant de temps

- Els fitxers de sessió es guarden xifrats en l'emmagatzematge institucional de la UVic-UCC, amb
  accés restringit a l'equip investigador, fins a **5 anys després de la publicació dels resultats**;
  després s'esborren.
- Aquest full de consentiment signat (l'únic document amb el teu nom) es guarda en paper, tancat
  amb clau, **separat** dels fitxers de sessió i **sense el teu codi**: no hi ha cap manera de
  relacionar el teu nom amb les teves dades.
- Les mostres d'entrenament que autoritzis a publicar s'incorporen al repositori obert de MecHand
  sota la llicència MIT del projecte i, un cop publicades, no es poden retirar.

## Els teus drets

Pots retirar-te en qualsevol moment, sense donar explicacions:

- **durant la sessió**, simplement no lliurant el fitxer (i esborrant-lo del navegador);
- **després**, enviant el teu **codi** a jordi.villa@uvic.cat (o deixant-lo en paper a la bústia del
  Departament de Biociències): s'esborraran el teu fitxer i les teves mostres no publicades. Com que
  l'equip no sap quin codi és el teu, guarda'l bé: **sense el codi no podem trobar les teves dades**.
  Les dades ja incorporades en resultats agregats publicats no es poden retirar.

També tens dret d'accés, rectificació, supressió, limitació, oposició i portabilitat, que pots
exercir de la mateixa manera (amb el teu codi). **Responsable del tractament:** Fundació Universitària
Balmes (UVic-UCC), c. Perot Rocaguinarda, 17, 08500 Vic. **Delegat de protecció de dades:**
dpd@uvic.cat. **Base jurídica:** el teu consentiment (art. 6.1.a del Reglament general de protecció
de dades, RGPD) per a una finalitat de recerca científica (art. 89 RGPD i Llei orgànica 3/2018, de
protecció de dades personals i garantia dels drets digitals). Si consideres que no s'han respectat
els teus drets, pots presentar una reclamació a l'Autoritat Catalana de Protecció de Dades
(<https://www.apd.cat>).

## Resultats

Els resultats es publicaran en revistes científiques i a la web de MecHand, sempre de forma agregada.
Si vols rebre'n un resum, demana-ho a l'investigador principal.

\newpage

# Consentiment informat

Estudi «Avaluació de MecHand: dibuix a mà alçada de mecanismes de reacció».
Investigador principal: Jordi Villà-Freixa (UVic-UCC).

Declaro que:

- He llegit el full d'informació, n'he rebut una còpia i he pogut fer preguntes.
- Soc major d'edat.
- Entenc que la participació és voluntària, que no afecta les meves qualificacions i que puc
  retirar-me en qualsevol moment sense donar explicacions.
- Entenc quines dades es recullen (inclosos el meu navegador i sistema, l'arquitectura del
  processador, la mida de la pantalla, el tipus de punter i el país on vaig aprendre a llegir i
  escriure) i que es processen al meu dispositiu i no s'envien a cap servidor.
- Entenc que MecHand és programari lliure i que el seu codi es pot consultar públicament.

Marca amb una creu (☒) el que acceptes:

☐ **Accepto participar** en l'estudi i lliurar el fitxer de la sessió, amb les dades descrites.
*(Necessari per participar.)*

☐ Accepto que les meves **mostres d'entrenament** (*Teach*) s'incloguin al fitxer de la sessió i
s'utilitzin per millorar el model de reconeixement dins de l'estudi. *(Opcional.)*

☐ Accepto que aquestes mostres **es publiquin** al repositori obert de MecHand (llicència MIT), només
amb el símbol i les coordenades *x*, *y*, sense cap altra dada. Entenc que un cop publicades no es
poden retirar. *(Opcional; només si has acceptat l'anterior.)*

Nom i cognoms: ................................................................

Signatura: ...................................... Data: ......../......../............

Persona investigadora: ........................................ Signatura: ......................

*Aquest full no ha de contenir el teu codi de participant.*

\newpage

# Còpia per a la persona participant: el teu codi

Anota aquí el codi que et mostra l'aplicació (a dalt a la dreta). **No l'escriguis al full signat.**
El necessitaràs si vols retirar les teves dades.

**El meu codi:** `MH-` ☐☐☐☐☐

Per retirar-te: envia el codi a jordi.villa@uvic.cat (des de qualsevol adreça) o deixa'l en paper a
la bústia del Departament de Biociències (FCTE, UVic-UCC).
