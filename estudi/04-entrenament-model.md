---
title: "Entrenament del model de reconeixement"
subtitle: "Estudi «Avaluació de MecHand» — protocol a la sessió i incorporació de les mostres al model compartit"
lang: ca
---

# 1. Què vol dir «entrenar» MecHand

El reconeixedor de MecHand no és una xarxa neuronal: combina regles geomètriques (escala, enllaços,
fletxes) amb dos classificadors per exemples del tipus $P (*point cloud*), un per a les lletres i els
signes, i un altre per a les puntes de fletxa. «Entrenar» vol dir **afegir exemples**, cosa que té
efecte immediatament, al navegador i sense cap servidor:

| Pestanya de ✍ Teach | Què es dibuixa | Què canvia |
| --- | --- | --- |
| *Letters & signs* | Lletres d'elements, xifres 2–4, + i −, ⊕ i ⊖ | Cada mostra és un exemple més per al classificador de lletres |
| *Arrows* | Fletxes corbes (2 e⁻ i 1 e⁻), de reacció i d'equilibri | La punta de cada fletxa dibuixada amb un traç separat s'afegeix al model de puntes: un estil personal (triangle, punta plena…) es reconeix a partir d'aleshores |
| *Bonds* | Enllaços simples, dobles, triples i un anell de benzè | Es reconeixen per geometria: serveix per comprovar que l'estil es llegeix bé |
| *Electrons* | Parells solitaris i radicals, al costat d'una O grisa | La mida dels punts fixa fins a quina mida una marca compta com a punt |

Per a cada mostra, el requadre mostra al moment què llegeix MecHand («Currently read as», amb ✓ si és
el que es demanava). Les mostres es guarden només al navegador (`localStorage`): les lletres a
`mechand.symbols.user.v1` i la resta a `mechand.elements.user.v1`, amb el símbol o l'element i les
coordenades *x*, *y* dels traços.

# 2. Protocol a la sessió (≈ 10 minuts)

1. El participant prem **Obre ✍ Teach** al panell de l'estudi.
2. Pestanya **Letters & signs**: 3 mostres de cadascun d'aquests símbols, els que apareixen als
   estímuls: **C, O, N, H, F, l** (la ela de Cl), **r** (de Br), **a** (de Na), **+** i **−**. Si el
   requadre ja els llegeix bé a la primera (✓), n'hi ha prou amb una mostra.
3. Pestanya **Arrows**: 3 fletxes corbes de 2 electrons, 1 fletxa de reacció i 1 equilibri (⇌),
   dibuixades com ho fa habitualment el participant, a l'escala de la línia grisa (un enllaç).
4. Pestanya **Electrons**: 2 parells solitaris.
5. Tancar (Esc) i prémer **He acabat l'entrenament**.

**Indicacions per a la persona investigadora.** No corregiu la manera d'escriure: l'objectiu és
recollir la cal·ligrafia natural. Si un símbol no es reconeix després de 3 mostres, anoteu-ho com a
incidència i continueu. No allargueu l'entrenament més de 12 minuts.

El fitxer de sessió registra quantes mostres de cada tipus s'han desat (`teach-end`). Les mostres
mateixes s'hi inclouen **només** si el participant ho ha acceptat (casella del panell inicial i del
consentiment).

# 3. Com s'incorporen les mostres al model compartit

Només per a les mostres dels participants que han marcat **les dues** caselles opcionals del
consentiment (inclusió i publicació):

1. Extreure `teachSamples` dels fitxers de sessió **sense cap altra dada**:

   ```bash
   python estudi/analisi/analitza_sessions.py <carpeta> --export-teach estudi/analisi/teach
   ```

   L'script només exporta les mostres de les sessions amb `publishTeachSamples = true` (el participant
   ha marcat a l'aplicació que n'accepta la publicació, a més de la inclusió) i escriu un fitxer per
   participant amb un nom neutre (`estudi-2026-001.json`, …), sense el codi, el país ni el dispositiu.
   Com a control, el nombre de sessions exportades no pot superar el nombre de fulls de consentiment
   amb la casella de publicació marcada; si el supera, no publiqueu res i consulteu el CER.
2. Copiar els fitxers a `ketcher-mechhand/src/recognition/model/contrib/`. El format
   (`{"samples": [...], "elements": [...]}`) és el que llegeix l'aplicació; vegeu el `README.md` de la
   carpeta.
3. Augmentar la versió a `ketcher-mechhand/src/recognition/model/symbols-model.json` (p. ex.
   1.3.0 → 1.4.0).
4. Executar les proves (`make test`): el banc de proves amb escriptura sintètica no ha d'empitjorar.
5. Avaluar l'efecte amb les dades de l'estudi (validació creuada per participant): per a cada
   participant, reconèixer els seus dibuixos amb el model que inclou les mostres de **tots els altres**
   participants i comparar-ho amb el model original. Així es mesura si el model compartit generalitza a
   cal·ligrafies noves. L'script ho fa amb `--cross-validate` (requereix Node.js, perquè fa servir el
   mateix reconeixedor que l'aplicació).
6. Obrir una *pull request* al repositori amb els fitxers, la versió nova i el resultat de l'avaluació.

# 4. Què no es fa

- No es fa servir l'escriptura per identificar ningú, ni es compara amb altres mostres de la mateixa
  persona fora de l'estudi.
- No es publiquen els temps dels traços, ni el país, el dispositiu o el codi de les mostres.
- No s'entrena cap model en un servidor extern: el model és un fitxer JSON del repositori, i cada
  versió es pot auditar i revertir.
