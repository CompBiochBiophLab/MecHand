---
title: "Sol·licitud de dictamen al Comitè d'Ètica de la Recerca (CER) de la UVic-UCC"
subtitle: "Memòria del projecte «Avaluació de MecHand: dibuix a mà alçada de mecanismes de reacció»"
author: "Jordi Villà-Freixa, Departament de Biociències, FCTE, UVic-UCC"
lang: ca
---

> **Com presentar-la.** Aquesta memòria acompanya el formulari oficial de sol·licitud de dictamen del
> CER de la UVic-UCC (versió de 2020:
> <https://www.uvic.cat/sites/default/files/solicitud_dictamen_def_es_2020_10_19_edit_1.pdf>), que
> s'envia signat a la secretaria del CER (cer@uvic-ucc.cat) segons el Reglament del CER aprovat pel
> Consell de Govern l'1 de desembre de 2015. Abans d'enviar-la, **confirmeu amb la secretaria que el
> formulari i l'adreça són vigents**. S'hi adjunten els documents 01 (disseny), 02 (instruccions),
> 05 (full d'informació i consentiment), 07 (protecció de dades) i 08 (qüestionaris).

# 1. Dades del projecte

| | |
| --- | --- |
| Títol | Avaluació de MecHand: dibuix a mà alçada de mecanismes de reacció per estudiants i professorat |
| Investigador principal | Dr. Jordi Villà-Freixa (ORCID 0000-0002-6359-3929), Departament de Biociències, FCTE; IRIS-CC; grup BI-SQUARE. jordi.villa@uvic.cat |
| Equip | [noms, rols] |
| Tipus | Estudi d'usabilitat amb persones adultes, sense intervenció sobre la salut |
| Durada | [data d'inici] – [data de finalització]; sessions de 60 minuts |
| Finançament | [sense finançament específic / projecte] |
| Lloc | FCTE, campus de Vic (aula d'informàtica o aula docent) |

# 2. Resum

MecHand és una aplicació web de codi obert, desenvolupada pel sol·licitant, que afegeix el dibuix a
mà alçada de mecanismes de reacció a l'editor químic Ketcher, amb un reconeixedor d'escriptura que
s'executa íntegrament al navegador. Es proposa un estudi encreuat en què 32–36 estudiants del grau
en Biotecnologia i 8–12 docents de química de la FCTE reprodueixen imatges de molècules i
mecanismes amb MecHand i amb les eines convencionals de Ketcher. Es mesuren el temps, la correcció,
la precisió del reconeixement i la usabilitat percebuda (SUS), i es recullen dades tècniques
genèriques (navegador, sistema, arquitectura, pantalla, tipus de punter) i el país on el participant
va aprendre a llegir i escriure, com a indicador de l'estil de cal·ligrafia. Les dades no surten del
dispositiu del participant fins que ell mateix lliura el fitxer de resultats.

# 3. Objectius i justificació

Vegeu el document 01, §1–2. L'avaluació amb usuaris reals és necessària per publicar l'eina
(*Journal of Cheminformatics*) i per millorar el reconeixement amb cal·ligrafies diverses. Recollir
el país d'alfabetització està justificat perquè les formes de les lletres i dels traços s'ensenyen de
manera diferent a cada sistema escolar, i un reconeixedor que només funcioni bé amb una cal·ligrafia
seria discriminatori per als estudiants internacionals.

# 4. Metodologia

Disseny intrasubjecte encreuat 2 × 2 amb contrabalanceig (document 01, §4–7). Procediment d'una
sessió: consentiment, qüestionari breu a l'aplicació, entrenament del model (*Teach*), dos blocs de
4 tasques (més una de pràctica) en condicions diferents, escala SUS després de cada bloc, preguntes
obertes, descàrrega i lliurament del fitxer. Estímuls: imatges de domini públic o CC BY 4.0 de
Wikimedia Commons (`estimuls/ATRIBUCIONS.md`).

# 5. Participants, reclutament i voluntarietat

- **Inclusió:** estudiants majors d'edat del grau en Biotecnologia que hagin cursat química orgànica
  o bioquímica; personal docent de química de la FCTE. **Exclusió:** menors; persones que no puguin
  consentir; persones que hagin participat en el desenvolupament de l'eina.
- **Reclutament:** anunci a l'aula i al campus virtual. Les sessions es fan fora de l'horari lectiu.
- **Relació de poder.** L'investigador principal és professor de la FCTE i pot ser docent d'alguns
  participants. Mesures: (a) l'anunci i la recollida dels consentiments els fa una persona de
  l'equip que no avalua aquells estudiants en aquell moment [nom]; (b) la participació no té cap
  efecte en les qualificacions, i així s'indica per escrit; (c) l'investigador no pot vincular cap
  fitxer de dades amb cap persona (codi aleatori sense taula de correspondència); (d) es pot deixar
  la sessió en qualsevol moment, i no lliurar el fitxer equival a no participar; (e) les sessions amb
  estudiants d'una assignatura que imparteix l'investigador principal es programen després de la
  publicació de les qualificacions d'aquella assignatura, quan sigui possible.
- **Idioma.** El full d'informació i el consentiment estan en català; es preparen versions en
  castellà i anglès per als participants que ho necessitin [pendent], perquè la comprensió és condició
  del consentiment, i més en un estudi que busca diversitat de procedències.
- **Compensació:** cap.

# 6. Riscos i beneficis

Riscos mínims: cansament lleu (sessions de 60 minuts amb pauses) i sensació d'avaluació (s'explica que
s'avalua l'eina, no el participant). No hi ha procediments invasius ni preguntes sobre salut, opinions,
creences o altres categories especials de dades. Beneficis: coneixement d'una eina oberta per a
l'aprenentatge de la química; contribució a un recurs públic.

# 7. Consentiment informat

Document 05: full d'informació, consentiment amb tres opcions (participació; inclusió de les mostres
d'entrenament; publicació d'aquestes mostres sense metadades) i full per al participant on anota el
seu codi. El consentiment es dona per escrit abans de començar; l'aplicació demana confirmar-ho abans
de registrar res.

# 8. Confidencialitat i protecció de dades

Document 07. En resum:

1. **Sense servidor:** l'aplicació processa tot al navegador; cap dada de recerca s'envia per xarxa.
   Ho verifiquen proves automàtiques en tres motors de navegador a cada canvi del codi.
2. **Sense identificadors:** ni nom, ni correu, ni IP, ni identificadors del dispositiu o del
   navegador; de l'entorn tècnic només es desen dades genèriques.
3. **Pseudonimització sense clau:** codi aleatori que només coneix el participant.
4. **Lliurament en mà** del fitxer, conservació en emmagatzematge institucional xifrat, 5 anys després
   de la publicació.
5. **Publicació** només de resultats agregats (*k* ≥ 5) i, amb doble consentiment, de mostres
   d'entrenament sense metadades.

Responsable del tractament: Fundació Universitària Balmes (UVic-UCC). DPD: dpd@uvic.cat. Es demana
al CER que, si ho considera convenient, traslladi el document 07 al DPD.

# 9. Codi obert i transparència

Tot el programari de l'estudi és lliure (MIT) i públic a
<https://github.com/CompBiochBiophLab/MecHand>, inclosos el mode estudi, les proves automàtiques de
privadesa i aquests documents. La versió exacta usada a cada sessió queda registrada al fitxer de
sessió. Això permet al CER, al DPD i als participants verificar què es registra.

# 10. Conflicte d'interessos

L'investigador principal és l'autor de MecHand. No hi ha interès econòmic: l'eina és gratuïta i de
codi obert. Per limitar el biaix: els criteris de correcció són automàtics i predefinits (SMILES de
referència, `estimuls/estimuls.json`), el pla d'anàlisi es fixa abans de les sessions (document 01,
§7) i es publicaran també els resultats desfavorables.

# 11. Declaració

L'investigador principal declara que el projecte s'ajusta al Codi d'ètica de la UVic-UCC i al
document de bones pràctiques en recerca de la institució, i es compromet a comunicar al CER qualsevol
modificació substancial del protocol.

Vic, [data]

Signatura: ......................................

\newpage

# Annex: correu de presentació (esborrany)

> **A:** cer@uvic-ucc.cat
> **Assumpte:** Sol·licitud de dictamen — «Avaluació de MecHand: dibuix a mà alçada de mecanismes de
> reacció»
>
> Benvolguts/des,
>
> Us adjunto la sol·licitud de dictamen del projecte «Avaluació de MecHand», un estudi d'usabilitat
> amb estudiants del grau en Biotecnologia i professorat de química de la FCTE, amb la memòria, el full
> d'informació i el consentiment informat, el document de protecció de dades i els qüestionaris. Les
> dades es processen exclusivament al dispositiu dels participants i no inclouen cap identificador
> personal. Resto a la vostra disposició per a qualsevol aclariment.
>
> Cordialment,
> Jordi Villà-Freixa
> Departament de Biociències, FCTE, UVic-UCC
