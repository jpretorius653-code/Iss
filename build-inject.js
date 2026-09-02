// ============================================================
//  Build-time key/secret injection  (run by the GitHub workflow)
//
//  Why a Node script instead of inline PowerShell: the value being inserted
//  is a PEM block, and the target line in license.js is a backtick template
//  literal. Assembling that inside PowerShell means escaping backticks in
//  the one language where the backtick IS the escape character — which is
//  exactly what broke the earlier workflow. Node treats the file as plain
//  text and inserts the key with no shell escaping at all.
//
//  Reads from environment:
//    ISS_PUBLIC_KEY          (required) — your Ed25519 public key PEM
//    ISS_CALLHOME_ENDPOINT   (optional) — Supabase REST endpoint
//    ISS_CALLHOME_KEY        (optional) — Supabase anon key
//
//  Never prints secret values. Exits non-zero with a clear message if the
//  public key is missing or the placeholder can't be found.
// ============================================================
'use strict';
const fs = require('fs');

function fail(msg) { console.error('ERROR: ' + msg); process.exit(1); }

// ── Public key (required) ──────────────────────────────────────────────
const pub = (process.env.ISS_PUBLIC_KEY || '').trim();
if (!pub) {
  fail('Secret ISS_PUBLIC_KEY is not set.\n' +
       '       Add it under Settings -> Secrets and variables -> Actions,\n' +
       '       with the full -----BEGIN/END PUBLIC KEY----- block as the value.');
}
if (pub.indexOf('BEGIN PUBLIC KEY') === -1) {
  fail('ISS_PUBLIC_KEY does not look like a PEM public key ' +
       '(missing the BEGIN PUBLIC KEY header).');
}

const licPath = 'electron/license.js';
let lic = fs.readFileSync(licPath, 'utf8');

// Replace the whole  const PUBLIC_KEY_PEM = `...`;  assignment. The [\s\S]
// class spans newlines; *? keeps it to the first closing backtick+semicolon.
const KEY_RE = /const PUBLIC_KEY_PEM = `[\s\S]*?`;/;
if (!KEY_RE.test(lic)) {
  fail('Could not find the PUBLIC_KEY_PEM placeholder in ' + licPath + '.');
}
lic = lic.replace(KEY_RE, 'const PUBLIC_KEY_PEM = `' + pub + '`;');

// Sanity: the placeholder word must be gone from the key block (the
// KEY_READY guard line legitimately still mentions it, so check the block).
const block = lic.match(/const PUBLIC_KEY_PEM = `([\s\S]*?)`;/)[1];
if (block.indexOf('REPLACE_WITH_YOUR_PUBLIC_KEY') !== -1) {
  fail('Injection did not take — placeholder still present in the key block.');
}
fs.writeFileSync(licPath, lic);
console.log('Public key injected into ' + licPath + '.');

// ── Call-home (optional) ───────────────────────────────────────────────
const ep = (process.env.ISS_CALLHOME_ENDPOINT || '').trim();
const anon = (process.env.ISS_CALLHOME_KEY || '').trim();
if (ep && anon) {
  const chPath = 'electron/callhome.js';
  let ch = fs.readFileSync(chPath, 'utf8');
  const before = ch;
  ch = ch.replace("const ENDPOINT = '';", "const ENDPOINT = '" + ep + "';");
  ch = ch.replace("const ANON_KEY = '';", "const ANON_KEY = '" + anon + "';");
  if (ch === before) {
    console.log('Call-home placeholders not found — leaving callhome.js as-is.');
  } else {
    fs.writeFileSync(chPath, ch);
    console.log('Call-home configured.');
  }
} else {
  console.log('Call-home secrets not set — shipping with call-home off.');
}
