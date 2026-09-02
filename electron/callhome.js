// ============================================================
//  ISS Weighbridge — install call-home ("phone home")
//
//  WHAT THIS IS
//  A best-effort ping that reports, once the PC has internet, that a copy
//  of the software is running on a given machine fingerprint. It gives YOU
//  an early-warning list of where installs are live — useful for spotting
//  a copy that showed up on a machine you never licensed.
//
//  WHAT THIS IS NOT
//  It is not a lock. On its own it does not stop anything running. A copy
//  with no internet, or one where this file has been deleted, simply never
//  pings — and still runs. Machine-bound licensing (license.js) is what
//  actually gates the software. Treat this as a notification layer on top,
//  not a replacement for the licence.
//
//  PRIVACY / TRUST
//  It sends only: the Install ID (already a salted hash, never raw
//  hardware serials), the app version, licence state, and the machine's
//  hostname. No weighbridge data, no tickets, no customer records. Be
//  straight with buyers that the software checks in — a hidden phone-home
//  that a customer discovers themselves does more damage to the
//  relationship than the feature is worth.
//
//  SETUP
//  Fill in ENDPOINT and ANON_KEY below with a Supabase REST endpoint you
//  control (a table 'installs' with RLS allowing anon insert, or an edge
//  function). While they are blank this module is inert — it no-ops, so a
//  build without call-home configured behaves exactly as before.
// ============================================================
'use strict';
const https = require('https');
const { fingerprint } = require('./license');

// ── Your Supabase endpoint ─────────────────────────────────────────────
// e.g. https://YOURPROJECT.supabase.co/rest/v1/installs
const ENDPOINT = '';
const ANON_KEY = '';

const READY = !!(ENDPOINT && ANON_KEY);
// Don't ping more than once a day per launch-cycle; the record is upserted
// server-side on install_id so repeated pings just refresh last_seen.
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

function postJSON(url, key, body) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch (_) { return resolve(false); }
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      timeout: 6000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        // upsert on the unique install_id column so we don't pile up rows
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on('error', () => resolve(false));   // offline / DNS / blocked — silent
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(data);
    req.end();
  });
}

/* Call once after the licence has been resolved at startup. Never throws,
   never blocks the UI — fire and forget. `lic` is the object from
   License.status(). `store` is a tiny getter/setter for the last-ping
   timestamp (reuse the licence record so it survives a userData wipe). */
async function pingInstall(lic, opts) {
  if (!READY) return;                        // not configured → do nothing
  opts = opts || {};
  const last = (opts.getLastPing && opts.getLastPing()) || 0;
  if (Date.now() - last < MIN_INTERVAL_MS) return;

  const fp = fingerprint();
  const payload = {
    install_id: fp.id,
    host: fp.host,
    app_version: opts.version || '',
    lic_state: (lic && lic.state) || 'unknown',
    lic_company: (lic && lic.lic && lic.lic.company) || '',
    seen_at: new Date().toISOString(),
  };
  const ok = await postJSON(ENDPOINT, ANON_KEY, payload);
  if (ok && opts.setLastPing) opts.setLastPing(Date.now());
}

module.exports = { pingInstall, callHomeReady: READY };
