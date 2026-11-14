# User study mode

MecHand is being evaluated in a user study with Biotechnology students and chemistry teachers at the
Universitat de Vic – Universitat Central de Catalunya. The study materials — design, participant
instructions, researcher guide, information sheet and consent form, ethics-committee application,
data-protection analysis, questionnaires and analysis scripts — will be published as supplementary
material of the article; until then they are available from the author on request. The code of study
mode and its automated privacy tests are public in this repository. This page summarises what the app
does in study mode, so that participants and reviewers can check it.

## What a session looks like

Open the app with `?study=1&group=A1` (or `A2`, `B1`, `B2`). A panel on the right takes the
participant through:

1. a short questionnaire (role, year, device, the country where they learned to read and write,
   handedness, experience with chemical drawing software) and the consent check;
2. **Teach** training of the recognizer with their own handwriting;
3. two blocks of tasks — reproducing molecules and mechanisms from openly licensed images — one with
   freehand drawing and one with Ketcher's tools only, in counterbalanced order, each starting with a
   practice task; the order of the tasks within a block is drawn at random;
4. the System Usability Scale after each block, and a few final questions;
5. the download of the session file, which the participant copies to the study's USB stick, and the
   deletion of the data from the browser.

## What is recorded, and what is not

The session file (schema `mechand-study-session/3`, see
[`recorder.ts`](https://github.com/CompBiochBiophLab/MecHand/blob/main/ketcher-mechhand/src/study/recorder.ts))
holds a random code such as `MH-7K3Q9`, the group, the year, the app version and commit, the
interface language (Catalan by default in the study), the answers, a coarse description of the browser and device (browser and OS names and major versions,
architecture, screen size, touch points, pointer types), and for each task the time, the ink (x, y
points rounded to 0.1 px and when each stroke started and ended), what MecHand recognized, the
participant's decisions, the use of the pen controls, and the final drawing. Teach samples are
included only if the participant agrees.

It never holds a name, an e-mail address, an IP address, the date, a device identifier, the
user-agent string, cookies, or pen pressure and tilt.

## Why nothing leaves the browser

- All recognition runs in the browser; in study mode the optional recognition server is disabled
  and cannot be enabled, even with URL parameters.
- The session is kept in memory and in the browser's local storage until the participant downloads
  it; nothing is uploaded.
- Automated tests ([`e2e/study.spec.ts`](https://github.com/CompBiochBiophLab/MecHand/blob/main/ketcher-mechhand/e2e/study.spec.ts),
  [`e2e/privacy.spec.ts`](https://github.com/CompBiochBiophLab/MecHand/blob/main/ketcher-mechhand/e2e/privacy.spec.ts))
  run a complete session in Chromium, Firefox and WebKit on every change, and fail if the app sends
  anything, contacts another origin, sets a cookie, lets the server be enabled, or writes the
  user-agent string or the date into the file. The public site is only published after these tests
  pass; in the sessions, a pinned build is served from a laptop on the local network.

See also [Privacy](./privacy).
