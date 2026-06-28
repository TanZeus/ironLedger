# DOPAMOVE WEB — Neo-Brutalist Gym Tracker

A local-first gym tracker. Open on a **cover page**, browse a 161-lift exercise
database (parsed from your encyclopedia), log sessions, **auto-generate your next
workout**, track lifetime tonnage, and read a safety/form guide. Push reminders
are wired through the **OneSignal Web SDK (v16)**.

Everything is static (HTML/CSS/vanilla JS, no build step), so it deploys as-is to
**GitHub Pages** — keep all files at the repo root so `OneSignalSDKWorker.js`
stays reachable at the site root.

## Workout engine (Generate tab)
A layered, click-through builder — pick a source, tune it, then get a workout you
can load straight into the logger:
- **From your history** — *repeat your last session*, your *most-frequent lifts*,
  or *progressive overload* (+2.5% on each lift's last load).
- **By intensity** — auto-generate from the full database, dialled to a training
  intensity (**Deload / Hypertrophy / Strength / Conditioning**) and a muscle
  focus. Weights are scaled from your logged bests when you've trained the lift,
  or sensible equipment baselines otherwise.

## Files
```
index.html            Main page — OneSignal SDK is initialised in <head>
styles.css            Neo-Brutalist styles
data.js               Exercise DB (161 lifts) + safety/form content
app.js                Browser, logger, history, safety, OneSignal hooks
OneSignalSDKWorker.js  Service worker — MUST sit at the site root
manifest.json         Web app manifest (needed for iOS 16.4+ web push)
```
Your data is saved in the browser via `localStorage` — nothing leaves the device
except the OneSignal subscription.

### Saving & backups
- **Saved sessions** persist under the `ironledger.v1` key. If the browser
  blocks storage (private mode) or the quota is full, the save is reported as
  failed instead of silently lost.
- **In-progress drafts** auto-save under `ironledger.draft.v1`, so a refresh or
  crash mid-workout won't lose the lifts you've entered.
- **Export / Import** (History tab) downloads your whole ledger as a JSON file
  and restores it — useful for backups, clearing-cache survival, or moving the
  data to another browser or device. Imports are *merged* (de-duped by id), not
  overwritten.

## Run locally
Service workers need a server (not `file://`). From this folder:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```
`allowLocalhostAsSecureOrigin: true` is already set in `index.html` so localhost works.
In the OneSignal dashboard create a **separate app** for localhost and set its
Site URL to `http://localhost:8000`.

## Deploy (push needs HTTPS)
Web push only works over **HTTPS** on a single origin. Any static host works
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3+CloudFront, your own server).

1. Upload all files so `OneSignalSDKWorker.js` is reachable at
   `https://yourdomain.com/OneSignalSDKWorker.js` (served as
   `Content-Type: application/javascript`, not via a CDN redirect).
2. In the OneSignal dashboard → **Settings → Push & In-App → Web**:
   - Activate the **Web** platform, integration type **Custom Code**.
   - Set **Site URL** to your exact origin (e.g. `https://yourdomain.com`,
     no `www.` unless that's your real host).
   - Upload a 256×256 PNG as the default notification icon.
3. The App ID is already in `index.html`:
   `aadfb631-db03-4f50-83d0-f4054f63d307`.

## How the integration is wired
- **Init** — `index.html` `<head>` loads `OneSignalSDK.page.js` and calls
  `OneSignal.init({ appId })` via the `OneSignalDeferred` queue (the pattern
  from OneSignal's setup guide).
- **Opt-in** — the *Enable reminders* button in the Log tab calls
  `OneSignal.Slidedown.promptPush()`.
- **Tags** — saving a session sets `sessions_logged` and `last_workout` tags
  (and an `app=ironledger` tag on opt-in) so you can build segments like
  "hasn't logged in 3 days" and target streak reminders.

## iOS note
On iPhone/iPad, web push needs the user to **Add to Home Screen** first
(iOS 16.4+). `manifest.json` is already linked for that. Add real
`icon-192.png` / `icon-512.png` files referenced in the manifest.
