---
title: "Guia per a la persona investigadora"
subtitle: "Estudi «Avaluació de MecHand» — preparació i desenvolupament de les sessions"
lang: ca
---

# 1. Abans de les sessions

- [ ] Dictamen favorable del CER i, si cal, vistiplau del DPD (documents 06 i 07).
- [ ] Fulls d'informació i consentiment impresos (document 05), en català i, si cal, en castellà o
  anglès; fulls per al participant (amb l'espai per al codi).
- [ ] **Versió fixada de l'aplicació.** Anoteu la versió (*commit*) que es farà servir i no
  actualitzeu la web durant el període de sessions; la versió de l'aplicació i del model queda
  registrada a cada fitxer. Per fixar-la del tot, serviu-la des d'un portàtil:

  ```bash
  git clone https://github.com/CompBiochBiophLab/MecHand.git && cd MecHand
  git checkout <commit>
  make install
  cd ketcher-mechhand && npm run build && npx vite preview --host --port 4173
  ```

  i doneu l'adreça que mostra (p. ex. `http://<ip-del-portàtil>:4173/?study=1`) als dispositius de
  la mateixa xarxa (`make dev` només és accessible des del mateix portàtil). Si es fa servir la web
  pública: `https://compbiochbiophlab.github.io/MecHand/app/?study=1`.
- [ ] **Prova pilot** amb 2–3 persones (no s'analitzen): temps, comprensió de les instruccions,
  funcionament en tauletes i ordinadors de l'aula.
- [ ] Llapis USB **xifrat** per recollir els fitxers.
- [ ] Dispositius de la facultat: navegador actualitzat; prova que el llapis dibuixa a ✎ Freehand.
- [ ] Taula d'assignació de grups (§3).

# 2. Material per sessió

Fulls de consentiment, fulls per al participant, bolígrafs, llapis USB, dispositius de reserva (tauleta
amb llapis i portàtil amb ratolí), carregadors, aquesta guia i les instruccions (document 02).

# 3. Assignació de grups

Rotativa per ordre d'arribada, **separada per a estudiants i professorat**: A1, A2, B1, B2, A1, A2…
Doneu a cada persona l'adreça amb el seu grup (`…?study=1&group=A2`) o digueu-li quin ha de triar.
Anoteu a la taula **només** el número d'ordre, el rol i el grup (mai el nom ni el codi):

| Núm. | Rol | Grup | Data | Dispositiu propi / facultat | Incidències |
| --- | --- | --- | --- | --- | --- |
| 1 | estudiant | A1 | | | |

# 4. Guió de la sessió (60 min)

1. **Benvinguda (2 min).** «Avaluem una eina, no a vosaltres. Podeu deixar-ho quan vulgueu, sense cap
   conseqüència.»
2. **Consentiment (5–8 min).** Lliureu el full d'informació, resoleu dubtes, recolliu els consentiments
   signats i guardeu-los en un sobre. Recordeu que el codi s'anota **només** al full que es queda el
   participant.
3. **Inici a l'aplicació (3 min).** Qüestionari i **Comença**. Comproveu que el panell mostra el grup
   correcte.
4. **Entrenament (10 min).** Seguiu el document 04. No corregiu la manera d'escriure dels participants:
   ens interessa la seva cal·ligrafia natural.
5. **Blocs 1 i 2 (2 × 15–20 min).** No ajudeu a dibuixar ni a interpretar la química. Podeu resoldre
   problemes tècnics (dispositiu, navegador) i recordar on són els botons. Anoteu les incidències a la
   taula (p. ex. «recàrrega de la pàgina a la tasca B2T3»).
6. **Final (5 min).** Comproveu que cada participant descarrega el fitxer, copieu-lo al llapis USB
   davant seu i comproveu que s'obre (és text JSON). Demaneu que premi **Esborra les dades d'aquest
   navegador**. En els dispositius de la facultat, comproveu-ho vosaltres (el panell torna al formulari
   inicial).

# 5. Situacions especials

- **Retirada durant la sessió:** no es copia el fitxer i s'esborra el navegador. El consentiment
  signat es guarda igualment (consta que va participar) o es destrueix si la persona ho demana.
- **Retirada posterior:** quan arribi un codi, cerqueu `mechand-estudi-<codi>.json`, esborreu-lo de
  l'emmagatzematge i de les còpies, i responeu confirmant-ho sense guardar el missatge més temps del
  necessari.
- **Recàrrega o tancament accidental:** la sessió es recupera de l'emmagatzematge local en tornar a
  obrir la mateixa adreça al mateix navegador. Si s'ha perdut, comenceu una sessió nova i anoteu-ho.
- **Navegació privada:** l'emmagatzematge local pot no persistir; demaneu una finestra normal.
- **Problemes de reconeixement:** és part del que mesurem; no intervingueu més enllà de recordar els
  consells de dibuix del document 02.

# 6. Després de cada sessió

1. Copieu els fitxers del llapis USB a la carpeta institucional xifrada de l'estudi
   (`[ruta de la carpeta]`) i esborreu-los del llapis.
2. Comproveu que es llegeixen: `python estudi/analisi/analitza_sessions.py <carpeta> --check`.
3. Guardeu els consentiments a l'armari tancat del grup de recerca, separats de qualsevol altre
   material de l'estudi.

# 7. Anàlisi

```bash
python -m venv .venv && . .venv/bin/activate
pip install rdkit pandas statsmodels scipy
python estudi/analisi/analitza_sessions.py <carpeta-amb-els-json> --out estudi/analisi/resultats
```

L'script genera taules per tasca, per participant i per condició, les puntuacions SUS, la precisió del
reconeixement i els models del document 01, §7.
