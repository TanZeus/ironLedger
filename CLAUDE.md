# Dopamove Web

Local-first, dependency-free static PWA gym tracker (HTML/CSS/vanilla JS, no build step).
Deploys as-is to a static host; keep all files at the repo root so `OneSignalSDKWorker.js`
stays reachable at the site root.

## Files
- `index.html` — markup; OneSignal SDK initialised in `<head>`
- `styles.css` — Neo-Brutalist styles
- `data.js` — exercise database + safety/form content
- `app.js` — database browser, logger, history, generator, OneSignal hooks

## Conventions
- No-comment coding style. Do not add comments to any file (JS, CSS, HTML, YAML).
  Write self-explanatory code instead.
- Derive user-facing counts from the data (e.g. `EXERCISES.length`, `MUSCLES.length`);
  never hardcode them in markup.
- All dynamic HTML is built with `innerHTML`; escape any user-influenced string with
  `esc()` before interpolating it.
- localStorage keys are `ironledger.v1` (sessions) and `ironledger.draft.v1` (draft).
  Do not rename them — existing user data is keyed on these.
