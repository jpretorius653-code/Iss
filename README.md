# Promnatic Weighbridge

Weighbridge control, ticketing and reporting. This repository builds a
Windows installer that opens already branded for **Promnatic Scales** and is
licensed per machine.

Built on the ISS Weighbridge platform by Industrial Scale Solutions. The same
codebase rebrands for any reseller by swapping one file (see *Rebranding*
below), so you maintain one product line, not a fork per customer.

---

## What's in here

```
electron/            The app (Electron main process + native bridges)
  main.js            Window, menus, licence enforcement, serial reopen
  preload.js         The IPC bridge exposed to the UI
  license.js         Machine-bound licensing (paste your public key here)
  license-ui.js      The licence screen (drawn by the main process)
  callhome.js        Optional install ping (inert until configured)
  serial.js          Serial / indicator handling
  storage.js         Local storage + backups
  tcp.js             WeighBox / TCP indicator support
renderer/
  index.html         The whole UI
  brand.js           Promnatic default brand, auto-applied on first run
build/
  icon.ico/.png      App icon (Promnatic)
  installer.nsh      Legacy NSIS include (see note in docs/BUILD-GUIDE.md)
.github/workflows/
  build.yml          Builds the .exe on GitHub (see docs/BUILD-GITHUB.md)
package.json         electron-builder config; version lives here
licensing-tools/     YOUR tools — NOT shipped in the app
  setup-keys.bat     One-time: create your signing key
  issue-licence.bat  Per customer: issue a .isslic
  iss-genkeys.js     (what setup-keys.bat runs)
  iss-keygen.js      (what issue-licence.bat runs)
  make-brand.js      Generate a brand pack for the next reseller
  test-*.js          Test suites (32 checks)
docs/                All the how-to guides + the Promnatic brand pack
```

---

## First-time setup (do once)

1. **Make your signing key.** In `licensing-tools`, double-click
   `setup-keys.bat`. Paste the printed public key into `electron/license.js`,
   set `FP_SALT`, and back up `iss-private.pem` offline. Full detail in
   `docs/LICENSING-README.md`.
   - `iss-private.pem` must NEVER be committed. `.gitignore` blocks it.
2. **Push to a PRIVATE GitHub repo.** You're selling to competitors — the
   source stays private. See `docs/BUILD-GITHUB.md`.
3. **Add your public key as the GitHub secret** `ISS_PUBLIC_KEY` so the cloud
   build can embed it. Same guide.

## Build the installer

- **On GitHub:** publish a Release (or run the workflow by hand). The
  `.exe` is attached to the release. See `docs/BUILD-GITHUB.md`.
- **On your PC:** `npm install` then `npm run dist` → `dist/*.exe`. See
  `docs/BUILD-GUIDE.md`.

## Licence a customer

1. They install and run; the app shows an **Install ID**.
2. They send it to you.
3. Double-click `licensing-tools/issue-licence.bat`, paste the ID, enter the
   company → you get a `.isslic` file.
4. Send it back; they load it. It works on that PC only.

New installs get a 14-day grace period, so they can work while you issue the
licence.

---

## Rebranding for the next reseller

This build is Promnatic because of two things: `renderer/brand.js` and
`build/icon.*`. For the next company:

```
cd licensing-tools
node make-brand.js --company "Their Name" --primary "#RRGGBB" --logo logo.png
```

Replace `renderer/brand.js`'s brand object with the new pack (or drop the new
`.issbrand` in and regenerate brand.js), swap `build/icon.*`, and rebuild.
Everything else stays the same.

To ship a **plain ISS** build with no bundled brand, delete `renderer/brand.js`
and the `<script src="brand.js">` line in `index.html`; the app falls back to
the ISS default and rebrands only when a pack is imported by hand.

---

## Two honest limits

- **This is Electron, so it can be unpacked.** The licence stops copy-paste
  installation and casual sharing — the real threat from another scale
  company. It does not stop a determined cracker who unpacks `app.asar`.
  `docs/LICENSING-README.md` covers how to raise that cost.
- **The installer is unsigned.** Windows SmartScreen warns on first run until
  you buy a code-signing certificate. Not required to ship; worth knowing.

## Tests

```
cd licensing-tools
node test-license.js   # 22 checks — copied licences, forgery, clock, drift
node test-brand.js     # 10 checks — pack validates, tamper rejected, theming
```
