// ============================================================
//  ISS Weighbridge — machine-bound licensing
//
//  WHY THIS EXISTS
//  The old scheme used one activation code (ISS2025) that was identical on
//  every PC. Anyone holding the code could install unlimited copies. This
//  module replaces that with a licence that only works on the machine it
//  was issued for.
//
//  HOW IT WORKS
//    1. We read five hardware identifiers and hash each one.
//    2. Those hashes fold into an Install ID, e.g. ISS-4F2A-9C11-8E30.
//    3. The customer sends you a REQUEST blob (Install ID + the five
//       hashes + machine name).
//    4. You run tools/iss-keygen.js and send back a .isslic file.
//    5. This module verifies that file with an Ed25519 PUBLIC key.
//
//  WHY ASYMMETRIC AND NOT A SHARED SECRET
//  The whole app ships as readable JavaScript. If verification used HMAC
//  or a shared password, anyone who opened this file could mint their own
//  licences forever. With a signature they can read every line here and
//  still not produce a valid key for a second machine. The private key
//  never leaves your PC.
//
//  WHAT THIS DOES NOT DO
//  It does not stop someone unpacking app.asar, deleting the check and
//  repacking. Nothing shipped as JS can. It stops copy-paste installation
//  and casual sharing, which is the actual threat from another scale
//  company. Raising the cost further is a separate job (see README).
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// ── YOUR PUBLIC KEY ────────────────────────────────────────────────────
// Generate with:  node tools/iss-genkeys.js
// Paste the printed PUBLIC key here. Keep the private key OFF every site PC.
// While this is left at the placeholder the module runs in UNSIGNED mode:
// it still fingerprints and still shows the Install ID, but every licence
// is rejected, so builds cannot accidentally ship with no real key.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAc+VNJrcmR0Q0ObziGhEy5nRtHr8yWywnk8+CWL+4zS0=
-----END PUBLIC KEY-----`;

const KEY_READY = PUBLIC_KEY_PEM.indexOf(MCowBQYDK2VwAyEAc+VNJrcmR0Q0ObziGhEy5nRtHr8yWywnk8+CWL+4zS0=) === -1;

// Salt for the component hashes. Changing it invalidates every issued
// licence, so set it once before your first real install and leave it.
const FP_SALT = 'ISS';

// How long a brand-new, never-licensed install stays fully usable.
const GRACE_DAYS = 14;
// How long a PREVIOUSLY LICENSED machine keeps working after its hardware
// fingerprint drifts (disk swap, NIC change, motherboard replacement).
// This is the difference between annoying a paying customer and bricking
// a weighbridge at 2am.
const DRIFT_GRACE_DAYS = 7;
// Of the five hardware components, how many must still match.
// This is a CEILING, not a fixed rule — see requiredMatches(). Plenty of
// industrial PCs leave the board and disk serials as "To be filled by
// O.E.M.", which we discard as junk. On a machine that only yields two
// real identifiers, demanding three matches would reject the licence on
// the very PC it was issued for.
const MIN_MATCH = 3;

// ── Hardware fingerprint ───────────────────────────────────────────────
// Five independent identifiers so that replacing one part does not
// invalidate the licence. Each is hashed before it is stored or sent, so
// a licence file never carries a customer's raw hardware serials.

function ps(script) {
  // PowerShell/CIM is the primary path — wmic is being removed from
  // current Windows builds and cannot be relied on.
  try {
    return String(execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch (_) { return ''; }
}
function wmic(args) {
  try {
    const out = String(execFileSync('wmic', args,
      { timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }));
    // wmic prints a header line then the value
    const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return lines.length > 1 ? lines[1] : '';
  } catch (_) { return ''; }
}
function regQuery(key, value) {
  try {
    const out = String(execFileSync('reg', ['query', key, '/v', value],
      { timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }));
    const m = out.match(/REG_SZ\s+(\S+)/);
    return m ? m[1] : '';
  } catch (_) { return ''; }
}

// Values that mean "the OEM did not fill this field in" and must never be
// treated as identifying — otherwise every cheap PC of the same model
// would share a fingerprint component.
const JUNK = /^(to be filled by o\.?e\.?m\.?|default string|none|n\/?a|system serial number|0+|-+|\.+)$/i;
function clean(v) {
  const s = String(v || '').trim();
  if (!s || JUNK.test(s)) return '';
  return s;
}

function rawComponents() {
  if (process.platform !== 'win32') {
    // Non-Windows dev machines: enough to work with, not shipped to sites.
    return {
      machineGuid: os.hostname(),
      board: '', disk: '', cpu: os.cpus()[0] && os.cpus()[0].model || '', uuid: '',
    };
  }
  const machineGuid = clean(regQuery('HKLM\\SOFTWARE\\Microsoft\\Cryptography', 'MachineGuid'));
  let board = clean(ps('(Get-CimInstance Win32_BaseBoard).SerialNumber'));
  if (!board) board = clean(wmic(['baseboard', 'get', 'serialnumber']));
  let disk = clean(ps('(Get-CimInstance Win32_DiskDrive | Sort-Object Index | Select-Object -First 1).SerialNumber'));
  if (!disk) disk = clean(wmic(['diskdrive', 'get', 'serialnumber']));
  let cpu = clean(ps('(Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId'));
  if (!cpu) cpu = clean(wmic(['cpu', 'get', 'processorid']));
  let uuid = clean(ps('(Get-CimInstance Win32_ComputerSystemProduct).UUID'));
  if (!uuid) uuid = clean(wmic(['csproduct', 'get', 'uuid']));
  return { machineGuid, board, disk, cpu, uuid };
}

function h(label, value) {
  if (!value) return '';                       // absent component never "matches"
  return crypto.createHash('sha256')
    .update(FP_SALT + '|' + label + '|' + value).digest('hex').slice(0, 24);
}

let _fp = null;
/* Fingerprint the machine. The CIM/wmic calls take a second or two, so the
   result is computed once per launch and cached. */
function fingerprint() {
  if (_fp) return _fp;
  const raw = rawComponents();
  const parts = {
    machineGuid: h('machineGuid', raw.machineGuid),
    board: h('board', raw.board),
    disk: h('disk', raw.disk),
    cpu: h('cpu', raw.cpu),
    uuid: h('uuid', raw.uuid),
  };
  const present = Object.keys(parts).filter(k => parts[k]).sort();
  const digest = crypto.createHash('sha256')
    .update(present.map(k => k + '=' + parts[k]).join('&')).digest('hex').toUpperCase();
  const id = 'ISS-' + digest.slice(0, 4) + '-' + digest.slice(4, 8) + '-' + digest.slice(8, 12);
  _fp = { id, parts, present: present.length, host: os.hostname() };
  return _fp;
}

/* How many of the licensed components still match this machine. */
function matchCount(licParts) {
  const fp = fingerprint();
  let n = 0;
  Object.keys(fp.parts).forEach(k => {
    if (fp.parts[k] && licParts && licParts[k] && fp.parts[k] === licParts[k]) n++;
  });
  return n;
}

/* How many matches this particular licence should demand.
   Scaled to the number of identifiers the machine actually produced when
   the licence was issued, so that:
     5 present -> need 3  (two parts may be replaced)
     4 present -> need 3
     3 present -> need 2  (one part may be replaced)
     2 present -> need 2  (nothing to spare — but MachineGuid survives
                           hardware changes, so this is still workable)
     1 present -> need 1
   A copied install matches 0 in every one of these cases, which is the
   case that matters. */
function requiredMatches(licParts) {
  const present = Object.keys(licParts || {}).filter(k => licParts[k]).length;
  if (present <= 2) return Math.max(1, present);
  return Math.min(MIN_MATCH, present - 1);
}

// ── Licence file format ────────────────────────────────────────────────
//   <base64url(payload JSON)>.<base64url(ed25519 signature)>
function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }

function verifyToken(token) {
  if (!KEY_READY) return { ok: false, reason: 'This build has no licence key compiled in.' };
  const t = String(token || '').trim().replace(/\s+/g, '');
  const dot = t.indexOf('.');
  if (dot < 1) return { ok: false, reason: 'Not a licence key.' };
  let payload, sig;
  try {
    payload = unb64u(t.slice(0, dot));
    sig = unb64u(t.slice(dot + 1));
  } catch (_) { return { ok: false, reason: 'Licence key is damaged.' }; }
  let ok = false;
  try {
    ok = crypto.verify(null, payload, crypto.createPublicKey(PUBLIC_KEY_PEM), sig);
  } catch (_) { ok = false; }
  if (!ok) return { ok: false, reason: 'Signature invalid — this licence was not issued by ISS.' };
  let lic;
  try { lic = JSON.parse(payload.toString('utf8')); } catch (_) { return { ok: false, reason: 'Licence contents unreadable.' }; }
  return { ok: true, lic };
}

// ── Where the licence record lives ─────────────────────────────────────
// Three places. Deleting one does not reset the install; we take the
// most restrictive view of whatever we find. `firstRun` is what the grace
// period counts from, so it matters that it survives a folder wipe.
function stores(userDataDir) {
  const out = [path.join(userDataDir, 'iss-license.json')];
  const pd = process.env.ProgramData;
  if (pd) out.push(path.join(pd, 'ISS', 'Weighbridge', 'license.json'));
  return out;
}
function regRead() {
  if (process.platform !== 'win32') return null;
  try {
    const out = String(execFileSync('reg', ['query', 'HKCU\\Software\\ISS\\Weighbridge', '/v', 'rec'],
      { timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }));
    const m = out.match(/rec\s+REG_SZ\s+(\S+)/);
    return m ? JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) : null;
  } catch (_) { return null; }
}
function regWrite(rec) {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('reg', ['add', 'HKCU\\Software\\ISS\\Weighbridge', '/v', 'rec', '/t', 'REG_SZ',
      '/d', Buffer.from(JSON.stringify(rec), 'utf8').toString('base64'), '/f'],
      { timeout: 5000, windowsHide: true, stdio: 'ignore' });
  } catch (_) {}
}

class License {
  constructor(userDataDir) {
    this.dir = userDataDir;
    this.rec = this._load();
    this._seen();          // stamp lastSeen and catch clock rollback
  }

  _load() {
    const found = [];
    stores(this.dir).forEach(p => {
      try { if (fs.existsSync(p)) found.push(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (_) {}
    });
    const r = regRead(); if (r) found.push(r);
    if (!found.length) {
      const rec = { firstRun: new Date().toISOString(), lastSeen: new Date().toISOString(), token: '' };
      this.rec = rec; this._save(rec);
      return rec;
    }
    // Oldest firstRun wins — you cannot reset the grace period by deleting
    // the newest copy. Any token found is kept.
    const rec = {
      firstRun: found.map(f => f && f.firstRun).filter(Boolean).sort()[0] || new Date().toISOString(),
      lastSeen: found.map(f => f && f.lastSeen).filter(Boolean).sort().pop() || new Date().toISOString(),
      token: (found.find(f => f && f.token) || {}).token || '',
      tamper: found.some(f => f && f.tamper) || false,
    };
    return rec;
  }

  _save(rec) {
    const json = JSON.stringify(rec || this.rec, null, 2);
    stores(this.dir).forEach(p => {
      try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, json); } catch (_) {}
    });
    regWrite(rec || this.rec);
  }

  /* Clock rollback check. Turning the PC clock back is the obvious way to
     stretch a grace period, so we refuse to let lastSeen go backwards and
     flag it permanently when it happens. */
  _seen() {
    const now = Date.now();
    const last = Date.parse(this.rec.lastSeen || 0) || 0;
    if (last && now < last - 36e5) this.rec.tamper = true;   // 1h slack for DST/NTP
    this.rec.lastSeen = new Date(Math.max(now, last)).toISOString();
    this._save();
  }

  installId() { return fingerprint().id; }

  /* The blob the customer sends you to get a licence. */
  request(extra) {
    const fp = fingerprint();
    const req = {
      v: 1, installId: fp.id, parts: fp.parts, host: fp.host,
      app: (extra && extra.version) || '', at: new Date().toISOString(),
    };
    return b64u(Buffer.from(JSON.stringify(req), 'utf8'));
  }

  /* Try a licence key/file contents. Returns {ok, reason}. */
  activate(token) {
    const v = verifyToken(token);
    if (!v.ok) return v;
    const lic = v.lic;
    if (lic.installId !== fingerprint().id && matchCount(lic.parts) < requiredMatches(lic.parts)) {
      return { ok: false, reason: 'This licence was issued for a different computer.' };
    }
    if (lic.expires && Date.parse(lic.expires) < Date.now()) {
      return { ok: false, reason: 'This licence expired on ' + lic.expires + '.' };
    }
    this.rec.token = String(token).trim();
    this.rec.tamper = false;         // a fresh valid licence clears a past flag
    this._save();
    return { ok: true, lic };
  }

  /* The single call the rest of the app asks. Never throws.
     state:
       'licensed'   — valid, bound to this machine
       'drift'      — was licensed, hardware changed; still running, on notice
       'grace'      — never licensed, still inside the free period
       'expired'    — grace ran out, or drift grace ran out
       'invalid'    — a licence is present but does not verify */
  status() {
    const fp = fingerprint();
    const base = { installId: fp.id, host: fp.host, keyReady: KEY_READY, tamper: !!this.rec.tamper };

    if (this.rec.token) {
      const v = verifyToken(this.rec.token);
      if (!v.ok) return Object.assign(base, { state: 'invalid', reason: v.reason });
      const lic = v.lic;
      if (lic.expires && Date.parse(lic.expires) < Date.now()) {
        return Object.assign(base, { state: 'expired', reason: 'Licence expired ' + lic.expires, lic });
      }
      const m = matchCount(lic.parts);
      if (m >= requiredMatches(lic.parts) || lic.installId === fp.id) {
        return Object.assign(base, { state: 'licensed', lic, match: m });
      }
      // Hardware changed. Give a window rather than stopping the bridge.
      const since = Date.parse(this.rec.driftSince || '') || Date.now();
      if (!this.rec.driftSince) { this.rec.driftSince = new Date().toISOString(); this._save(); }
      const daysLeft = DRIFT_GRACE_DAYS - Math.floor((Date.now() - since) / 864e5);
      if (daysLeft > 0) return Object.assign(base, { state: 'drift', lic, match: m, daysLeft });
      return Object.assign(base, { state: 'expired', lic, match: m, reason: 'Hardware no longer matches this licence.' });
    }

    if (this.rec.tamper) return Object.assign(base, { state: 'expired', reason: 'System clock was set backwards.' });
    const t0 = Date.parse(this.rec.firstRun) || Date.now();
    const daysLeft = GRACE_DAYS - Math.floor((Date.now() - t0) / 864e5);
    if (daysLeft > 0) return Object.assign(base, { state: 'grace', daysLeft });
    return Object.assign(base, { state: 'expired', reason: 'Trial period has ended.' });
  }

  /* Weighing is allowed unless this install was never licensed and its
     grace ran out. A paying site whose hardware drifted keeps weighing. */
  allowsWeighing() {
    const s = this.status();
    return s.state === 'licensed' || s.state === 'grace' || s.state === 'drift';
  }
}

module.exports = { License, fingerprint, verifyToken, matchCount, requiredMatches,
                   GRACE_DAYS, DRIFT_GRACE_DAYS, MIN_MATCH };
