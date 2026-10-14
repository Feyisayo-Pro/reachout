# LinkedIn DOM tools

Paste-into-DevTools diagnostics for when `extension/content.js` stops extracting
a field. Both are read-only: they change nothing on the page and send nothing.

Turn off device emulation (the phone/tablet icon in DevTools) first, so you see
the same layout the extension does. Chrome asks you to type `allow pasting` the
first time you paste into the console.

| File | Use it to |
|---|---|
| `probe-stable-sources.js` | See what LinkedIn still exposes without CSS classes: `document.title`, meta tags, JSON-LD, the About section |
| `find-selectors.js` | Locate the element holding text you can see on screen. Edit `TARGETS` at the top to match the profile you are on |

LinkedIn ships build-hashed class names, so never fix extraction by adding a
class selector. See "LinkedIn extraction" in `CLAUDE.md`.
