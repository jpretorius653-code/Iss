# Promnatic Scales — package

Everything to ship a licensed, Promnatic-branded copy.

## What's here

- `promnatic.issbrand` — the signed brand pack (green #00A551, red #E81F27,
  Promnatic logo, "Why Wait. Please Weigh It"). Import in the app under
  **Site Setup → Branding**.
- `index.html` — the current build. The brand-pack mechanism now themes the
  whole app (all six colour vars), so green reaches the header gradient, the
  rail and the trim — no leftover ISS gold.
- `licensing/` — the machine-bound licence (this is what stops unpaid
  installs) plus the optional call-home ping.

## The install flow you asked for

This is the offline challenge-response — "random code → keygen → activation
code" — which is the one that actually protects the software:

1. Promnatic installs. On first run the app shows an **Install ID** like
   `ISS-4F2A-9C11-8E30` — this is your "random code", derived from that PC's
   hardware.
2. They send you that code (Copy request → WhatsApp, or Save to file).
3. You run the keygen:
   ```
   node licensing/tools/iss-keygen.js --req <code> --company "Promnatic Scales" --site <site>
   ```
4. You send back the `.isslic` file. They click **Load licence file** and
   it activates. It works on that PC only — copied to another machine, the
   Install ID differs and it's rejected.

No internet needed at any point, which suits colliery sites.

**Before your first real licence:** run `node licensing/tools/iss-genkeys.js`
once, paste the public key into `license.js`, set `FP_SALT`, and back up the
private key. See `licensing/LICENSING-README.md`.

## The "hidden ping" you asked about

Built as `licensing/callhome.js` — an optional second layer. When the PC has
internet it reports the Install ID, version and licence state to your
Supabase, so you get an early-warning list of live installs. It is a
*notification*, not a lock: on its own it doesn't stop a copy running, which
is why it sits on top of the licence rather than replacing it. It ships inert
until you configure an endpoint. See `licensing/CALLHOME-README.md`.

## Rebranding the next customer

The generator is reusable — the next scale company is one command:

```
node licensing/tools/make-brand.js --company "Their Name" --primary "#RRGGBB" --logo their-logo.png
```

It derives the dark/mid/accent/trim shades from the primary, so a single
colour themes the whole app. Add `--red "#RRGGBB"` for a distinct
overload/error colour, or `--accent` / `--dark` to override a derived shade.

## Tests

- `node licensing/test-license.js` — 22 checks: copied licences, forged
  signatures, clock rollback, hardware drift.
- `node licensing/tools/test-brand.js` — 10 checks: the Promnatic pack
  validates against the app's real code, tampering is rejected, and green
  lands on all six theme vars.
- `node tdz-check.js` — guards against the launch-time declaration-order bug
  that `node --check` can't see.
