# Building through GitHub

Two things GitHub does for you:
1. **Builds the .exe automatically** on a Windows runner — no more depending
   on your dev PC.
2. **Stores the code privately** and versioned, so you can roll back.

The setup below keeps your signing key OFF GitHub entirely. GitHub only ever
sees your PUBLIC key; the private key stays on your PC for issuing licences.

---

## Before you start: two hard rules

1. **The repo must be PRIVATE.** You are selling this software to
   competitors. A public repo hands them your entire source — the licence
   logic, the brand secret, everything. Private, always.

2. **The private key never goes in git.** `iss-private.pem` is the whole
   security model. The included `.gitignore` blocks it, but the rule matters
   more than the file: if it ever reaches the repo, anyone with repo access
   can mint licences for any machine. GitHub does not need it — see below.

---

## One-time setup

### 1. Generate your keys locally (if you haven't)

```
node licensing/tools/iss-genkeys.js
```

This prints a PUBLIC key and writes `iss-private.pem`. Keep the private key
on your PC. Back it up offline.

### 2. Create a PRIVATE repo and push your project

Your project folder (with `electron/`, `renderer/`, `build/`,
`package.json`). Add the included `.gitignore` to the root FIRST, then:

```
git init
git add .
git commit -m "ISS Weighbridge 9.9.4"
git branch -M main
git remote add origin https://github.com/<you>/iss-weighbridge.git
git push -u origin main
```

Before pushing, confirm the key isn't tracked:

```
git status --ignored
```

`iss-private.pem` should appear under "Ignored files", not staged. If it
shows as staged, stop and fix `.gitignore` — do not push.

### 3. Add your PUBLIC key as a GitHub Secret

In the repo: **Settings → Secrets and variables → Actions → New repository
secret**

- Name: `ISS_PUBLIC_KEY`
- Value: the full public key block, including the
  `-----BEGIN/END PUBLIC KEY-----` lines.

That's the only secret the build needs. The workflow injects it into
`license.js` at build time, so the placeholder stays in your committed code
and the real key lives only in the encrypted secret.

### 4. Put the workflow in place

Copy `.github/workflows/build.yml` (included) into your repo at that exact
path. Commit and push it.

---

## Building a release

**Option A — a proper release (recommended):**
In the repo: **Releases → Draft a new release**, tag it `v9.9.4`, publish.
The workflow runs, builds the .exe, and attaches it to that release. You and
customers download it from the Releases page.

**Option B — a one-off build:**
**Actions tab → Build Windows installer → Run workflow.** The .exe appears as
a downloadable artifact on that run (kept ~90 days).

Either way, the build takes a few minutes. Watch it under the Actions tab.

---

## Where licences fit

Building through GitHub does NOT change how you licence customers. That's
still you, on your PC, with the private key:

```
node licensing/tools/iss-keygen.js --req <install-id> --company "Promnatic Scales"
```

GitHub builds the app; you issue the licences. The two never mix, which is
exactly why the private key can stay off GitHub.

---

## Optional: call-home through GitHub

If you turn on the install ping, don't hard-code the Supabase key in
`callhome.js` before committing — add two more secrets instead:

- `ISS_CALLHOME_ENDPOINT`
- `ISS_CALLHOME_KEY`

The workflow injects them at build time only if both are set. Otherwise the
build skips it and call-home ships inert, as designed.

---

## A note on lockfiles

If your project has a `package-lock.json`, commit it — it pins exact
dependency versions so a build next year matches one today. The workflow
uses it automatically. If you don't have one, the workflow falls back to
`npm install` and still works.
