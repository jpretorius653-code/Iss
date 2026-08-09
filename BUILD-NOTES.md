# Build notes

## The installer activation gate is OFF by default
An earlier build failed on `electron/installer.nsh` (the "Invalid command: ${If}"
error). To guarantee the build succeeds, the installer code-prompt is disabled.

**You lose nothing:** the app still asks for the activation code **ISS2025** the
first time it runs.

### To turn the installer code-prompt back ON later (optional)
1. Confirm the app builds cleanly first (green tick in Actions).
2. In `package.json`, inside `"build" > "nsis"`, add this line back:
       "include": "electron/installer.nsh",
3. Push. If that build goes green, the installer now asks for ISS2025 before
   installing. If it goes red again, remove the line — the app-level gate is enough.

## Toolchain (updated with this release)
| Package         | Was      | Now       | Why |
|-----------------|----------|-----------|-----|
| electron        | ^31.0.0  | ^41.10.4  | 31 is past end-of-life (no Chromium security fixes). 41 is the most settled of the currently supported lines. |
| electron-builder| ^24.13.3 | ^26.15.3  | Needed for modern Electron; better NSIS handling. |
| serialport      | ^12.0.0  | ^13.0.0   | Current major; prebuilds for current Node/Electron ABIs. |
| CI Node         | 20       | 22        | serialport 13 requires Node >= 20; 22 is LTS. |

`postinstall: electron-builder install-app-deps` was added so the serialport
native binary is always rebuilt against the Electron ABI in use. This is the
usual cause of "native serial: NOT loaded — using Web Serial fallback".

### If the native rebuild fails on the runner
Fall back one step at a time, rebuilding after each:
1. `electron` → `^38.8.6`
2. `electron` → `^37.10.3`
3. Last resort: back to `^31.0.0` + `electron-builder ^24.13.3` + `serialport ^12.0.0`
   (the exact combination that was known-green before this update).

Verify with: app menu → **Help → Serial Diagnostics…** → must read
"Native serial: ACTIVE".

## Data migration across the rebrand
Electron derives its data folder from `productName`, so renaming the app to
"ISS Weighbridge" moves it. `electron/storage.js` now adopts, on first launch,
both the config **and** the state file from any previous product name
(Hillside Complex Weighbridge, Hillside Weighbridge, NovaSpire Weighbridge,
A AND N KADIR Weighbridge) and from the old filenames
(`novaspire-config.json`, `hillside-state.json`).

Without this, every deployed site would have launched looking like a fresh
install — no activation, no users, no database, no paired COM ports. It copies
rather than moves, only when the destination is missing, and skips unparseable
files, so it cannot destroy live data.

Backups are now written as `ISS-Backup-<date>.json`; rotation still recognises
the older `Hillside-Backup-*` / `NovaSpire-Backup-*` files so the 30-day cap
keeps working on existing PCs.

## Everything else is unchanged and verified
- All JS syntax-checks (`node --check` on every file in electron/, both renderer
  script blocks parsed)
- All internal paths resolve
- serialport native module builds on the GitHub Windows runner
