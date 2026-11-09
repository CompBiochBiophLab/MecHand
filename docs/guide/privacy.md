# Privacy

**MecHand processes everything in your browser. Your drawings and your handwriting samples are
never sent anywhere.**

This is not only a design intention: an automated test
([`e2e/privacy.spec.ts`](https://github.com/CompBiochBiophLab/MecHand/blob/main/ketcher-mechhand/e2e/privacy.spec.ts))
runs on every change in Chromium, Firefox and WebKit. It uses every feature — templates, freehand
drawing, recognition, insertion, Teach, export — and fails if MecHand makes any network request
after the page has loaded, contacts any server other than the one that served the page, sends any
data, or sets a cookie.

| What | Where it goes |
| --- | --- |
| Your ink and recognized structures | Stay in the page (memory). Nothing is uploaded. |
| Teach samples | Your browser's local storage only (`mechand.symbols.user.v1` for letters, `mechand.elements.user.v1` for arrows, bonds and electrons). Each sample holds the symbol or element (plus, for elements, the scale of the Teach box) and the *x, y* points of its strokes — no timestamps, pressure, device or identity. Imported files are reduced to the same fields. Delete them with **Teach → Delete all**, or by clearing the site's data. |
| Ketcher settings | Your browser's local storage (Ketcher's own keys). |
| Cookies, analytics, trackers | None. |
| Exported files | Only where you save or paste them. |

## What can leave your computer

Only what you choose to send:

- **Contributing samples.** *Export samples* downloads a JSON file. If you add it to the repository
  through a pull request, it becomes public under the project's licence, and your GitHub account is
  visible on the pull request. Name the file without personal information, and contribute only
  your own handwriting.
- **The optional DECIMER server.** If you select it (About → Structure engine), a PNG image of your
  ink is sent to the server address you entered — by default `http://localhost:8000`, i.e. your own
  computer.

## Hosting

The public site is served by GitHub Pages. Like any web server, GitHub sees the request for the page
and its files (your IP address and browser), as described in the
[GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
After that, MecHand works offline. To avoid even that, run it locally (`make dev` or `make site`).
