---
title: "Qüestionaris"
subtitle: "Estudi «Avaluació de MecHand» — preguntes de l'aplicació (versió de referència) i còpia en paper"
lang: ca
---

Les preguntes es responen a l'aplicació (mode estudi) i queden al fitxer de sessió. Aquesta còpia
serveix per al CER i com a reserva en paper si un dispositiu falla (en aquest cas, el full en paper
porta només el codi de participant, mai el nom).

# 1. Qüestionari inicial

| Pregunta | Opcions | Camp del fitxer |
| --- | --- | --- |
| Grup (el dona la persona responsable) | A1, A2, B1, B2 | `group` |
| Participes com a | Estudiant del grau en Biotecnologia · Professorat de química | `participant.role` |
| Curs (només estudiants) | 1r · 2n · 3r · 4t | `participant.course` |
| Amb què dibuixaràs | Tauleta amb llapis · Tauleta amb el dit · Ordinador amb llapis o tauleta gràfica · Ordinador amb pantalla tàctil (dit) · Ordinador amb trackpad · Ordinador amb ratolí · Altre | `participant.device` |
| País on vas aprendre a llegir i escriure | Llista de països (codi ISO 3166-1) · Prefereixo no respondre | `participant.literacyCountry` |
| Mà amb què escrius (opcional) | Dreta · Esquerra · Totes dues · Prefereixo no respondre | `participant.handedness` |
| Experiència amb programes de dibuix químic (ChemDraw, Ketcher, Marvin…) | Cap · Poca (alguna vegada) · Molta (sovint) | `participant.experience` |
| Accepto que les mostres de ✍ Teach s'incloguin al fitxer (opcional) | Sí / No | `shareTeachSamples` |
| Accepto que aquestes mostres es publiquin, només amb el símbol i les coordenades (opcional) | Sí / No | `publishTeachSamples` |
| He llegit el full d'informació i he signat el consentiment | Obligatori | — |

L'aplicació afegeix automàticament l'entorn tècnic (navegador i versió principal, sistema,
arquitectura, mida de pantalla, punts tàctils, tipus de punter usats): vegeu el document 05.

# 2. System Usability Scale (SUS)

Després de cada bloc: «Pensa en com has treballat en aquest bloc: [condició]. 1 = totalment en
desacord, 5 = totalment d'acord.» Traducció al català de l'escala de Brooke (1996), d'ús lliure.

| # | Ítem | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Crec que m'agradaria utilitzar aquesta eina sovint. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | He trobat l'eina innecessàriament complexa. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | He trobat que l'eina era fàcil d'utilitzar. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | Crec que necessitaria l'ajuda d'una persona amb coneixements tècnics per poder utilitzar l'eina. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | He trobat que les diverses funcions de l'eina estaven ben integrades. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | He trobat que hi havia massa incoherències en l'eina. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | M'imagino que la majoria de la gent aprendria a utilitzar l'eina molt ràpidament. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | He trobat l'eina molt feixuga d'utilitzar. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | M'he sentit molt segur/a utilitzant l'eina. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | Hauria d'aprendre moltes coses abans de poder començar a utilitzar l'eina. | ☐ | ☐ | ☐ | ☐ | ☐ |

**Puntuació:** ítems senars, resposta − 1; ítems parells, 5 − resposta; la suma es multiplica per 2,5
(0–100). Referència: 68 = mitjana (Bangor et al., 2009). Camp del fitxer: `sus.freehand`,
`sus.ketcher` (respostes 1–5 per ordre d'ítem).

# 3. Preguntes obertes (opcionals)

«No hi escriguis cap dada personal (noms, correus…).»

1. Què és el que més t'ha agradat del dibuix a mà alçada? (`comments.liked`)
2. Què milloraries? Què no ha reconegut bé? (`comments.disliked`)
3. Altres comentaris. (`comments.other`)
