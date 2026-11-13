# Instruccions per a Claude — MecHand

## Idiomes: tot el que veu l'usuari, en anglès, català i castellà

Tota la informació adreçada a l'usuari ha d'estar disponible en **tres idiomes: anglès (en), català
(ca) i castellà (es)**. L'anglès és la font; català i castellà han d'estar complets i al dia, no
"pendents de traduir". Quan afegeixis o canviïs text visible per a l'usuari, actualitza els tres
idiomes en el mateix canvi.

Abast:

- **Aplicació** (`ketcher-mechhand/`): textos a `src/i18n/locales/{en,ca,es}.json`. Cap text visible
  escrit directament al codi. Passa `npx vitest run src/i18n` (completesa en/ca/es) i els tests e2e
  d'idiomes.
- **Web i documentació** (`docs/`, VitePress): ara només és en anglès i **s'ha de traduir**. Fes
  servir els `locales` de VitePress: anglès a l'arrel, català a `docs/ca/`, castellà a `docs/es/`,
  amb el mateix arbre de pàgines; tradueix també `nav`, `sidebar`, `footer`, `editLink`, textos de la
  cerca local, etc. al `config.mts`, i afegeix el selector d'idioma. Cada pàgina nova o modificada
  s'ha de crear/actualitzar en els tres idiomes.
- **Tutorial** (`tutorial/`): versions en, ca i es del PDF, enllaçades des de la web de cada idioma.
- **README.md**: pot ser en anglès (és per a GitHub), però ha d'enllaçar la web en català i castellà.
- **Missatges del backend** que arribin a l'usuari: traduïbles o mostrats via les claus i18n de l'app.
- **Captures de pantalla** de la documentació: idealment amb la interfície en l'idioma de la pàgina.

Fora d'abast (no cal triplicar): el manuscrit (`manuscript/`, en anglès per a la revista), els
comentaris de codi i la documentació interna de l'equip o del comitè d'ètica a `estudi/`.

Terminologia: fes servir els mateixos noms d'elements de la interfície que hi ha als fitxers de
locales (p. ex. a la documentació catalana, els noms catalans dels botons). Català normatiu (IEC),
castellà neutre.

## On viu cada text i cada configuració (perquè l'usuari ho pugui controlar des del VS Code)

- Nivells A (estudiant: ESO, batxillerat, primers cursos), B (final de grau, màster, inici de
  doctorat) i C (recerca, ho té tot): `ketcher-mechhand/src/config/levels.json` (esquema
  `levels.schema.json`). Qualsevol funció nova que depengui del nivell s'hi ha d'afegir com a camp
  (i a l'esquema i a `src/levels/levels.tsx`), no codificar-la al codi.
- Textos d'interfície: `src/i18n/locales/{en,ca,es}.json`; per temes, `src/i18n/locales/<tema>/{en,ca,es}.json`
  (`learn/` explicacions de química del nivell A, `levels/` noms dels nivells).
- Noms de plantilles: anglès a `src/templates/`, ca/es a `src/i18n/templates/{ca,es}.json`.
- Textos d'ajuda de les eines de Ketcher: `src/i18n/ketcher/{ca,es}.json` (clau = text anglès sense la drecera).
- Comprovació: `npm run check:content` (tasques del VS Code «MecHand: check texts and levels» i
  «… watch …», errors al panell Problemes). Ha de donar 0 errors abans de donar una feina per acabada.
- Node 22 està instal·lat amb snap (`/snap/bin/node`). Si `node` no dona sortida dins de Claude Code, posa `/snap/node/current/bin` al davant del PATH.
