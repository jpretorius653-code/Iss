# ISS Weighbridge

Electron desktop app by **Industrial Scale Solutions** (Reg. 2025/316125/07), eMalahleni.
Weighbridge control, ticketing, reporting, shared database, fleet list.

## Repo layout
```
package.json                   build config + scripts
build/                         icon.ico, icon.png
electron/                      main.js, preload.js, serial.js, tcp.js, storage.js, installer.nsh
renderer/                      index.html   (the whole app UI)
.github/workflows/build.yml    cloud build
```

## Build in the cloud (no tools needed)
1. Push this repo to GitHub.
2. Open the **Actions** tab → wait ~5 min for "Build Windows EXE" to finish (green tick).
3. Open the run → **Artifacts** → download **ISS-Weighbridge-Setup-\<version\>** → unzip → run the Setup .exe.

Manual trigger: Actions tab → "Build Windows EXE" → **Run workflow**.

## Build locally (needs Node 22 LTS + Git + VS Build Tools "Desktop development with C++")
```bash
npm install
npm run dist
```
Output: `dist/ISS-Weighbridge-Setup-<version>.exe`

## Install activation code
The installer asks for a code before installing: **ISS2025**
(Edit `electron/installer.nsh` to change it. To remove the prompt, delete the
`"include": "electron/installer.nsh"` line from package.json → build → nsis.)

## First run
Activation code **ISS2025**, then log in as Master (default PIN **1234**).
Change the Master PIN before handing a site over.

## Upgrading an existing site (Hillside etc.)
The rename changes Windows' per-app data folder. On first launch the app
automatically copies the previous install's config and state across —
activation, users, database, orders and paired COM ports all survive.
The old folder is left untouched as a fallback. **Take a backup before upgrading**
(app menu → Open Backup Folder) as a matter of routine.

## Branding
All company details live in one object, `ISS_CO`, at the top of the config block
in `renderer/index.html`. Per-client white-labelling is done with a signed brand
pack (`iss-brand.json`) — packs signed with the old key still validate.

## Version
Bump `"version"` in package.json before each push so builds are easy to tell apart.
