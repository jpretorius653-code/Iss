// ============================================================
//  ISS Weighbridge — one-time key generation
//
//  Run this ONCE, on your own PC:      node tools/iss-genkeys.js
//
//  It writes iss-private.pem (KEEP THIS) and prints the public key to
//  paste into license.js.
//
//  The private key is the whole business. If it leaks, anyone can issue
//  licences for any machine and the scheme is finished. It must never be
//  committed to git, never go in the installer, and never sit on a site
//  PC. Back it up somewhere you would back up a bank card.
//
//  If you ever lose it, you cannot issue new licences and cannot reissue
//  for existing customers — you would have to ship a new public key in a
//  new build and re-license every site. Back it up twice.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, 'iss-private.pem');
if (fs.existsSync(OUT)) {
  console.error('\n  ' + OUT + ' already exists.');
  console.error('  Refusing to overwrite it — every licence you have ever issued');
  console.error('  depends on that file. Move it aside first if you really mean to.\n');
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
const pub = publicKey.export({ type: 'spki', format: 'pem' });

fs.writeFileSync(OUT, priv, { mode: 0o600 });

console.log('\n  Private key written to: ' + OUT);
console.log('  Keep it. Back it up. Never ship it.\n');
console.log('  Now paste this into PUBLIC_KEY_PEM in license.js:\n');
console.log(String(pub).trim().split('\n').map(l => '  ' + l).join('\n'));
console.log('');
