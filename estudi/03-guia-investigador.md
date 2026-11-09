---
title: "Guia per a la persona investigadora"
subtitle: "Estudi «Avaluació de MecHand» — preparació i desenvolupament de les sessions"
lang: ca
---

# 0. Qui fa què

- **Persona de contacte** ([nom]): no avalua cap estudiant participant aquest curs. Fa el
  reclutament, porta les sessions amb estudiants, recull i custodia els consentiments, i gestiona
  l'adreça de l'estudi i les retirades.
- **Investigador principal**: prepara el material i la versió de l'aplicació, porta (si cal) les
  sessions amb professorat i fa l'anàlisi amb els fitxers pseudonimitzats. No és present a les
  sessions amb estudiants i no accedeix als consentiments fins que s'han tancat les qualificacions.
- **Dues persones avaluadores** de les fletxes (§8), que no participen en les sessions.

# 1. Abans de les sessions

- [ ] Dictamen favorable del CER i, si cal, vistiplau del DPD (documents 06 i 07).
- [ ] Fulls d'informació i consentiment impresos (document 05), **dues còpies** per persona, fulls per
  a la persona participant (amb l'espai per al codi) i fulls de revocació.
- [ ] Pla d'anàlisi preregistrat (OSF) abans de la primera sessió: document 01, §7, i
  `analisi/analitza_sessions.py` en la versió etiquetada.
- [ ] **Versió fixada de l'aplicació**, servida des d'un portàtil a la xarxa local de l'aula (no des
  de la web pública, que es pot actualitzar). Feu servir un *commit* que hagi passat la CI (pestanya
  *Actions* del repositori, totes les proves en verd) i etiqueteu-lo:

  ```bash
  git clone https://github.com/CompBiochBiophLab/MecHand.git && cd MecHand
  git checkout <commit-que-ha-passat-la-CI> && git tag estudi-v1
  make install
  cd ketcher-mechhand && npm run build && npx vite preview --host --port 4173
  ```

  Doneu l'adreça que mostra (p. ex. `http://<ip-del-portàtil>:4173/?study=1&group=A1`) als
  dispositius de la mateixa xarxa. El panell *About* de l'aplicació mostra el *commit*, i cada fitxer
  de sessió el registra (`appVersion`, p. ex. `0.1.0+44cdba2`): comproveu que és el que heu etiquetat.
  Només si no és possible, feu servir la web pública
  (`https://compbiochbiophlab.github.io/MecHand/app/?study=1`), que només publica versions que han
  passat la CI, i anoteu el *commit* que mostra *About*.
- [ ] **Prova pilot** amb 2–3 persones (amb el seu consentiment; els fitxers no s'analitzen i
  s'esborren després): temps, comprensió de les instruccions, funcionament en **tauletes** (iPad amb
  Apple Pencil, Android amb llapis), en ordinadors de l'aula i amb trackpad; comprovació que
  `analitza_sessions.py --check` llegeix els fitxers i que les tasques d'aldol amb CH₃ es puntuen bé.
- [ ] **Memòria USB-C xifrada per maquinari** (amb teclat o PIN), que es pugui fer servir des de
  tauletes, per recollir els fitxers.
- [ ] Dispositius de la facultat: navegador actualitzat; comproveu que el llapis dibuixa amb
  **Freehand** i que l'indicador de dispositiu de la barra de tinta diu «Pen» quan es dibuixa amb el
  llapis (alguns llapis d'Android es declaren com a «Finger»: en aquest cas, mode **Pen and finger**).
- [ ] Taula d'assignació de grups (§3).

# 2. Material per sessió

Fulls de consentiment (dues còpies), fulls per a la persona participant i de revocació, bolígrafs, la memòria
USB xifrada, dispositius de reserva (tauleta amb llapis i portàtil amb ratolí), carregadors, el
portàtil que serveix l'aplicació, aquesta guia i les instruccions (document 02).

# 3. Assignació de grups

Rotativa per ordre d'arribada, **separada per a estudiants i professorat**: A1, A2, B1, B2, A1, A2…
Doneu a cada persona l'adreça amb el seu grup (`…?study=1&group=A2`) o digueu-li quin ha de triar.
L'ordre de les quatre tasques dins de cada bloc el sorteja l'aplicació. Anoteu a la taula **només**
el número d'ordre, el rol i el grup (mai el nom, el codi ni la data):

| Núm. | Rol | Grup | Dispositiu propi / facultat | Incidències |
| --- | --- | --- | --- | --- |
| 1 | estudiant | A1 | | |

# 4. Guió de la sessió (60 min)

1. **Benvinguda (2 min).** «Avaluem una eina, no a vosaltres. Podeu deixar-ho quan vulgueu, sense cap
   conseqüència. El vostre professorat no sabrà qui ha participat.»
2. **Consentiment (5–8 min).** Lliureu el full d'informació, resoleu dubtes, recolliu una còpia signada
   de cada consentiment i guardeu-les en un sobre. Recordeu que el codi s'anota **només** al full que es
   queda la persona participant, a la pantalla final.
3. **Demostració (3 min), igual per a tothom.** Amb el projector: (a) a Ketcher, dibuixar un enllaç,
   canviar un àtom, posar una càrrega (A+/A−) i una fletxa corba (eina de fletxes → «Arrow Elliptical
   Arc Open Angle»); (b) a MecHand, activar **Freehand**, dibuixar un enllaç i una O, **Recognize** i
   **Insert**, la goma i el mode **Trackpad**. No feu servir cap estímul de l'estudi.
4. **Inici a l'aplicació (3 min).** Qüestionari i **Comença**. Comproveu que el panell mostra el grup
   correcte.
5. **Entrenament (10 min).** Seguiu el document 04. No corregiu la manera d'escriure de les persones participants:
   ens interessa la cal·ligrafia natural de cada persona.
6. **Blocs 1 i 2 (2 × 15–20 min), amb una pausa opcional de 2–3 minuts entre blocs.** No ajudeu a
   dibuixar ni a interpretar la química. Podeu resoldre problemes tècnics (dispositiu, navegador, mode
   d'entrada) i recordar on són els botons. Anoteu les incidències a la taula (p. ex. «recàrrega de la
   pàgina a la tasca B2T3»).
7. **Final (5 min).** Cada persona participant descarrega el fitxer i **el copia pel seu compte a la memòria USB**;
   no mireu el nom del fitxer (porta el codi). Comproveu, sense mirar el codi, que a la memòria hi ha
   un fitxer nou que s'obre (és text JSON). Demaneu que premi **Esborra les dades d'aquest navegador**
   i que esborri el fitxer de la carpeta de baixades. En els dispositius de la facultat, feu-ho
   vosaltres i esborreu també l'historial de baixades del navegador.

# 5. Situacions especials

- **Retirada durant la sessió:** no es copia el fitxer i s'esborra el navegador. El consentiment
  signat es destrueix si la persona ho demana.
- **Retirada posterior:** quan arribi un codi (bústia o adreça de l'estudi), la persona de contacte
  cerca `mechand-estudi-<codi>.json`, l'esborra de l'emmagatzematge i de les còpies, ho anota al
  registre de retirades (només el codi i la data) i, si ha arribat per correu, respon confirmant-ho i
  esborra el missatge.
- **Exercici de drets (accés, portabilitat):** amb el codi; la còpia es lliura en mà en una memòria
  USB, mai per correu.
- **Recàrrega o tancament accidental:** la sessió es recupera de l'emmagatzematge local en tornar a
  obrir la mateixa adreça al mateix navegador; el dibuix de la tasca en curs es perd i la tasca es
  torna a començar (queda registrat i l'anàlisi ho marca). Si s'ha perdut tota la sessió, comenceu-ne
  una de nova i anoteu-ho.
- **Navegació privada:** l'emmagatzematge local pot no persistir; demaneu una finestra normal.
- **No es pot dibuixar:** comproveu **Freehand**, el mode d'entrada i l'indicador de dispositiu (document
  02, «Si alguna cosa no va»). Amb trackpad, mode **Trackpad**.
- **Problemes de reconeixement:** és part del que mesurem; no intervingueu més enllà de recordar els
  consells de dibuix del document 02.

# 6. Després de cada sessió

1. Copieu els fitxers de la memòria USB a la carpeta institucional xifrada de l'estudi
   (`[ruta de la carpeta]`) i esborreu-los de la memòria.
2. Comproveu que es llegeixen (vegeu §7 per instal·lar l'entorn):
   `python estudi/analisi/analitza_sessions.py <carpeta> --check`.
3. La persona de contacte guarda els consentiments a l'armari tancat, separats de qualsevol altre
   material de l'estudi.

# 7. Anàlisi

```bash
python -m venv .venv && . .venv/bin/activate
pip install rdkit pandas numpy scipy statsmodels
python estudi/analisi/analitza_sessions.py <carpeta-amb-els-json> --check
```

Per provar el circuit abans de tenir dades, `simula_sessions.py` genera sessions sintètiques:

```bash
python estudi/analisi/simula_sessions.py /tmp/sim --n 36
python estudi/analisi/analitza_sessions.py /tmp/sim --out /tmp/sim-resultats
```

# 8. Valoració cega de les fletxes

1. La persona de contacte genera els dibuixos per valorar:
   `python estudi/analisi/analitza_sessions.py <carpeta> --export-rating valoracio`. Es creen un fitxer
   `D#####.ket` per mecanisme (nom aleatori, sense codi ni condició), `full_valoracio.csv` i `clau.csv`.
   **La clau no es dona a les persones avaluadores.**
2. Cada persona avaluadora obre els `.ket` a MecHand o Ketcher (*Open*) i, per a cada un, posa a
   `full_valoracio.csv` `arrows_ok = 1` si totes les fletxes corbes que demana l'enunciat comencen i
   acaben on toca (parell d'electrons o enllaç d'origen, àtom o enllaç de destinació) i no n'hi ha de
   sobrants; `0` en cas contrari. L'estructura (àtoms i enllaços) no es valora aquí: la puntua
   l'script automàticament.
3. Acord: `--agreement aval1.csv aval2.csv` (kappa de Cohen i llista de discrepàncies), que es
   resolen per consens en un tercer fitxer, `consens.csv`, desat a la mateixa carpeta que `clau.csv`.
4. Anàlisi final:

   ```bash
   python estudi/analisi/analitza_sessions.py <carpeta> --out resultats --ratings valoracio/consens.csv --public
   ```

L'script genera taules per tasca, per participant i per condició, les puntuacions SUS, la precisió
del reconeixement, els contrastos i models del document 01, §7, i la taula publicable
(`tasques_publiques.csv`, k ≥ 5).
