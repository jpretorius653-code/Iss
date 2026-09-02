# ISS Weighbridge — machine-bound licensing

Replaces the shared `ISS2025` activation code with a licence that only
works on the PC it was issued for.

## Files

| File | Goes where | Ships to customers? |
|---|---|---|
| `license.js` | next to `main.js` | yes |
| `license-ui.js` | next to `main.js` | yes |
| `main.js` | replaces yours | yes |
| `preload.js` | replaces yours | yes |
| `tools/iss-genkeys.js` | your PC only | **no** |
| `tools/iss-keygen.js` | your PC only | **no** |
| `tools/iss-private.pem` | your PC only | **never** |

## One-time setup

```
node tools/iss-genkeys.js
```

Writes `tools/iss-private.pem` and prints your public key. Paste that
public key into `PUBLIC_KEY_PEM` at the top of `license.js`, replacing
`REPLACE_WITH_YOUR_PUBLIC_KEY`.

Also set `FP_SALT` to something of your own **before your first real
install**. Changing it later invalidates every licence already issued.

Until the public key is filled in, the app runs in unsigned mode: it
fingerprints normally and shows the Install ID, but rejects every
licence. That is deliberate, so a build can never ship with no key by
accident.

### Back up the private key

If it leaks, anyone can issue licences for any machine and the whole
scheme is finished. If you lose it, you cannot issue or reissue
anything — you would have to ship a new public key in a new build and
re-license every site. Two backups, offline, not in git, not in the
installer.

## Issuing a licence

1. Customer installs. App shows an Install ID like `ISS-4F2A-9C11-8E30`
   and a request blob.
2. They send you the blob (Copy request → WhatsApp, or Save to file).
3. You run:

```
node tools/iss-keygen.js --req <blob-or-file> --company "Acme Scales" --site rietcoal
```

Add `--expires 2027-12-31` to sell it annually. Leave it off for
perpetual.

4. Send back the `.isslic` file. They click **Load licence file**.

## What happens on an unlicensed PC

| Situation | Behaviour |
|---|---|
| Fresh install | 14 days fully working |
| Trial ended, never licensed | Licence screen, app does not open |
| Licensed, hardware drifted | Keeps weighing, 7 days to sort out |
| Licence copied from another PC | Rejected — 0 of 5 components match |
| Licence file edited | Signature fails |
| Licence folder deleted | ProgramData + registry copies survive |
| Clock wound back | Flagged permanently |

Weighing is never stopped on a machine that has a valid licence. That
rule matters more than the licensing does — a bridge that stops
mid-shift gets ripped out.

## Two things to know

**The renderer override is now gated.** `main.js` only honours
`%APPDATA%\ISS Weighbridge\renderer\index.html` and
`renderer-override\index.html` on a licensed machine. Before this
change, anyone could drop in a patched `index.html` and delete every
check in the software. Enforcement lives in the main process for the
same reason.

**This does not stop a determined cracker.** Someone can unpack
`app.asar`, delete the check and repack. Nothing shipped as JavaScript
can prevent that. What this stops is copy-paste installation and casual
sharing between companies, which is the actual risk.

If you want to raise the cost further, the strongest step is making the
licence *load-bearing* rather than a gate: derive the brand-pack
decryption key from the licence signature, so a cracked copy runs but
loses its branding and ticket layout. That is worth doing before you
sell to a competitor, and it is a separate job.

## Testing

```
node test-license.js
```

22 checks, including copied licences, forged signatures, edited
payloads, deleted folders, clock rollback and hardware drift. Run it
after you paste your public key in — the signature tests need a real key
to pass.
