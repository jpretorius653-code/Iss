// ============================================================
//  ISS Weighbridge — issue a licence
//
//  Usage:
//    node tools/iss-keygen.js --req <blob|file> --company "Acme Scales"
//                             [--site rietcoal] [--tier full]
//                             [--expires 2027-12-31] [--out acme.isslic]
//
//  --req      the blob the customer sent you (paste it, or give the path
//             to the .issreq file they saved)
//  --expires  leave it off for a perpetual licence. Setting a date is how
//             you sell an annual subscription — the app stops the office
//             side when it lapses, weighing carries on.
//
//  Send the resulting .isslic file back. The customer opens the app and
//  imports it. It will not work on any other machine.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function die(msg) { console.error('\n  ' + msg + '\n'); process.exit(1); }

const KEYFILE = arg('key', path.join(__dirname, 'iss-private.pem'));
if (!fs.existsSync(KEYFILE)) die('Private key not found at ' + KEYFILE + '\n  Run:  node tools/iss-genkeys.js');

let reqRaw = arg('req', '');
if (!reqRaw) die('Give me the request blob:  --req <blob or file>');
if (fs.existsSync(reqRaw)) reqRaw = fs.readFileSync(reqRaw, 'utf8');
reqRaw = reqRaw.trim().replace(/\s+/g, '');

let req;
try {
  req = JSON.parse(Buffer.from(reqRaw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
} catch (_) { die('That request blob is not readable. Ask them to copy it again in full.'); }
if (!req || !req.installId || !req.parts) die('That blob is missing the machine fingerprint.');

const company = arg('company', '');
if (!company) die('Who is it for?  --company "Acme Scales"');

const payload = {
  v: 1,
  installId: req.installId,
  parts: req.parts,
  company: company,
  site: arg('site', ''),
  tier: arg('tier', 'full'),
  issued: new Date().toISOString().slice(0, 10),
  expires: arg('expires', ''),
};

const buf = Buffer.from(JSON.stringify(payload), 'utf8');
const priv = crypto.createPrivateKey(fs.readFileSync(KEYFILE));
const sig = crypto.sign(null, buf, priv);
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = b64u(buf) + '.' + b64u(sig);

const out = arg('out', company.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() + '-' + req.installId + '.isslic');
fs.writeFileSync(out, token);

console.log('\n  Licence issued');
console.log('  ─────────────────────────────────────────');
console.log('  Company    : ' + payload.company);
console.log('  Site       : ' + (payload.site || '—'));
console.log('  Machine    : ' + payload.installId + '  (' + (req.host || 'unknown host') + ')');
console.log('  Expires    : ' + (payload.expires || 'never'));
console.log('  Written to : ' + out);
console.log('\n  Send that file to the customer. It works on that PC only.\n');
