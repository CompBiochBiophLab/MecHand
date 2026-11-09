# Browser support

MecHand is a web application, so it runs on Windows, macOS, Linux, ChromeOS, iPadOS and Android.
It uses standard APIs only: Pointer Events (mouse, trackpad, pen and touch with one code path),
WebAssembly (Ketcher's chemistry engine, Indigo), Web Workers and SVG.

**Tested automatically** on every change with the three browser engines (Playwright): Chromium
(Chrome, Edge, Opera, Brave), Firefox, and WebKit (Safari). The tests open a template, draw a
molecule with the pointer, recognize it, insert it into Ketcher and export it.

| Browser | Status | Notes |
| --- | --- | --- |
| Chrome / Edge (desktop) | ✅ Supported | Reference platform. |
| Firefox (desktop) | ✅ Supported | |
| Safari 18.2+ (macOS) | ✅ Supported | |
| Safari 16.4–18.1 (macOS) | ⚠️ Works | No `getCoalescedEvents()`: fewer points per stroke when you move fast, so ink looks more angular. Recognition still works. |
| Safari on iPad (iPadOS 18.2+) with Apple Pencil | ✅ Supported | Pencil pressure is used; palm rejection ignores the hand once the Pencil has been used. |
| Safari on iPad, iPadOS < 18.2 | ⚠️ Works | As Safari < 18.2 above. |
| Chrome on Android with a stylus (S Pen…) | ✅ Supported | |
| Firefox on Android | ⚠️ Works | `getCoalescedEvents()` is only partly implemented; slightly coarser ink. |
| Internet Explorer, old Edge (EdgeHTML) | ❌ Not supported | No WebAssembly/modern JavaScript. |

Feature data from MDN's browser-compat-data (version 8.1.8, November 2026).

## Known issues and how to avoid them

- **Pan and zoom while drawing.** With freehand mode on, touch and pen gestures on the canvas draw
  instead of scrolling or zooming (`touch-action: none`). Turn freehand off (Alt/⌥+F) to pan and zoom
  with Ketcher, then turn it on again.
- **First load.** The app is about 9 MB compressed (most of it is Ketcher's WebAssembly engine).
  It is cached afterwards; on a slow connection the first visit takes a few seconds.
- **Copy to clipboard** needs a secure page (https or localhost). On the public site it works;
  otherwise use **Download** in the Export dialog.
- **Private/incognito windows** (especially Safari) may not keep **Teach** samples between visits,
  because browser storage is wiped. Use *Export samples* to keep them.
- **Optional DECIMER server from the public site.** The https site calling a server on
  `http://localhost:8000` is a "local network" request:
  - Chrome and Edge ask for permission the first time; allow it. (The server answers the
    browser's Private Network Access check.)
  - Firefox allows it.
  - Safari may block it as mixed content. Run MecHand locally instead (`npm run dev`, plain http),
    or put the server behind https.
- **Keyboard shortcuts on non-US layouts.** Alt/⌥+F uses the physical F key, so it works with any
  layout; on macOS ⌥F would otherwise type “ƒ”.
