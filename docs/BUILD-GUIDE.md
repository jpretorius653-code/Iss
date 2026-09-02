# Building the ISS Weighbridge .exe (licensed, reseller-ready)

One installer, called ISS Weighbridge, that any reseller's brand pack
rebadges inside the app. Promnatic get the same .exe as everyone else plus
their `.issbrand` pack and a licence for their PC. You never build a
separate Promnatic .exe.

Do this on your Windows dev PC — the one where `npm run dist` already works.

---

## 0. One-time: prerequisites

You already have these if you've built the .exe before. If not:
- Node.js LTS from nodejs.org
- Your existing project folder (the one with `electron/`, `renderer/`,
  `build/`, `package.json`)

## 1. One-time: generate your signing keys

In the `licensing/tools` folder, in a terminal:

```
node iss-genkeys.js
```

- It writes `iss-private.pem` and prints a public key.
- Open `license.js`, replace `REPLACE_WITH_YOUR_PUBLIC_KEY` with the printed
  key.
- Open `license.js`, change `FP_SALT` to something of your own **now** —
  changing it later invalidates every licence you've issued.
- **Back up `iss-private.pem` twice, offline.** Lose it and you can't issue
  or reissue any licence. See `LICENSING-README.md`.

Do this once, ever. Not per build.

## 2. Drop the new files into your project

Into your project's **`electron/`** folder (next to the existing `main.js`):
- replace `main.js` with `licensing/main.js`
- replace `preload.js` with `licensing/preload.js`
- add `license.js`, `license-ui.js`, `callhome.js` (from `licensing/`)

Into your project's **`renderer/`** folder:
- replace `index.html` with the new `index.html`

Replace **`package.json`** in the project root with `build/package.json`
(this one bumps the version to 9.9.4 and bundles everything). If you've
customised your package.json since, just copy the `"version"` change across
instead of overwriting the whole file.

## 3. Build

In the project root:

```
npm run dist
```

electron-builder produces `dist\ISS-Weighbridge-Setup-9.9.4.exe`.

That's your master installer. Every reseller gets this same file.

## 4. What Promnatic receive

1. `ISS-Weighbridge-Setup-9.9.4.exe` — they install it.
2. `promnatic.issbrand` — they import it under **Site Setup → Branding**
   (code 4895). The app turns green, shows their logo, rebrands tickets.
3. A licence for their PC (step 5).

## 5. Licensing a customer PC

1. They install and run. First launch shows an **Install ID** like
   `ISS-4F2A-9C11-8E30`.
2. They send it to you (Copy request → WhatsApp, or Save to file).
3. You run:
   ```
   node iss-keygen.js --req <their-install-id> --company "Promnatic Scales"
   ```
4. Send back the `.isslic`. They click **Load licence file**. Done — works
   on that PC only.

New installs get a 14-day grace period, so they can work while you issue
the licence.

---

## If the branding doesn't change after import

The app SAVES the active brand in its own storage and re-applies it every
launch. An old brand (e.g. Commodities Variation from testing) overrides the
fresh default. Fix: **Site Setup → Branding → Reset to default**, then
import the new pack. Or in the app press F12 → Console →
`localStorage.removeItem('iss8_brand'); location.reload();`

## Testing without a full rebuild (your machine only)

Your `main.js` checks two override folders before the packed renderer, so
you can preview a new `index.html` without rebuilding:
drop it in `<folder with the .exe>\renderer-override\index.html` and
restart. This is for YOUR testing only — the override loads only on a
licensed machine, and it's not how you deliver to a customer.

## Optional: turn on the install ping

`callhome.js` is inert until you add a Supabase endpoint. See
`CALLHOME-README.md`. Ships safely off; switch on when ready.

## Version bumps

Keep these two in step each release:
- `package.json` → `"version"`
- `renderer/index.html` → `const RENDERER_BUILD='...'`

Both are 9.9.4 in this package.
