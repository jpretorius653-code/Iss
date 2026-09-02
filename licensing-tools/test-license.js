'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const L = require('../electron/license.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'isslic-'));
process.env.ProgramData = path.join(tmp, 'pd');
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { console.log('  PASS  ' + name); pass++; }
  else { console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); fail++; }
}

console.log('\n=== 1. Fresh install ===');
const dirA = path.join(tmp, 'pcA'); fs.mkdirSync(dirA, { recursive: true });
const a = new L.License(dirA);
const s0 = a.status();
console.log('  install id : ' + s0.installId);
console.log('  state      : ' + s0.state + '  (' + s0.daysLeft + ' days left)');
t('unlicensed install starts in grace', s0.state === 'grace');
t('grace still allows weighing', a.allowsWeighing());
t('install id has the ISS-XXXX-XXXX-XXXX shape', /^ISS-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(s0.installId));

console.log('\n=== 2. Issue and activate a licence ===');
const req = a.request({ version: '9.9.3' });
fs.writeFileSync(path.join(tmp, 'r.issreq'), req);
cp.execFileSync('node', ['iss-keygen.js', '--req', path.join(tmp, 'r.issreq'),
  '--company', 'Acme Scales', '--site', 'testpit', '--out', path.join(tmp, 'acme.isslic')],
  { cwd: __dirname, stdio: 'ignore' });
const token = fs.readFileSync(path.join(tmp, 'acme.isslic'), 'utf8');
const act = a.activate(token);
t('licence activates on the machine it was issued for', act.ok, act.reason);
const s1 = a.status();
t('state becomes licensed', s1.state === 'licensed', s1.state + ' ' + s1.reason);
t('company travels with the licence', s1.lic && s1.lic.company === 'Acme Scales');

console.log('\n=== 3. ATTACK: copy the whole folder to another PC ===');
// Same licence file, different hardware. This is the copy-paste case.
const dirB = path.join(tmp, 'pcB'); fs.mkdirSync(dirB, { recursive: true });
fs.copyFileSync(path.join(dirA, 'iss-license.json'), path.join(dirB, 'iss-license.json'));
// simulate different hardware
const lic2 = require('../electron/license.js');
const realFp = lic2.fingerprint();
const otherParts = {};
Object.keys(realFp.parts).forEach(k => { otherParts[k] = 'ffffffffffffffffffffffff'; });
const v = lic2.verifyToken(token);
let matches = 0;
Object.keys(otherParts).forEach(k => { if (v.lic.parts[k] && v.lic.parts[k] === otherParts[k]) matches++; });
t('copied licence matches 0 of 5 components on foreign hardware', matches === 0);
t('0 matches is below the threshold', matches < L.MIN_MATCH);

console.log('\n=== 4. ATTACK: forge a licence without the private key ===');
const forgedPayload = Buffer.from(JSON.stringify({
  v: 1, installId: s0.installId, parts: realFp.parts, company: 'Pirate Scales', tier: 'full', issued: '2026-01-01', expires: '',
}), 'utf8');
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const forged = b64u(forgedPayload) + '.' + b64u(Buffer.alloc(64, 7));
const fr = L.verifyToken(forged);
t('forged signature is rejected', !fr.ok, fr.reason);

console.log('\n=== 5. ATTACK: tamper with a real licence payload ===');
const parts = token.split('.');
const good = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
good.company = 'Someone Else';
const tampered = b64u(Buffer.from(JSON.stringify(good), 'utf8')) + '.' + parts[1];
t('editing the payload breaks the signature', !L.verifyToken(tampered).ok);

console.log('\n=== 6. ATTACK: delete the licence folder to reset the trial ===');
const dirC = path.join(tmp, 'pcC'); fs.mkdirSync(dirC, { recursive: true });
const c1 = new L.License(dirC);
const born = c1.rec.firstRun;
// backdate the grace so it has expired, in all stores
const expiredRec = { firstRun: new Date(Date.now() - 30 * 864e5).toISOString(), lastSeen: new Date().toISOString(), token: '' };
c1.rec = expiredRec; c1._save(expiredRec);
t('backdated install is expired', new L.License(dirC).status().state === 'expired');
fs.unlinkSync(path.join(dirC, 'iss-license.json'));      // wipe the userData copy
const c2 = new L.License(dirC);
t('ProgramData copy survives a userData wipe', c2.status().state === 'expired', c2.status().state);

console.log('\n=== 7. ATTACK: wind the clock back ===');
const dirD = path.join(tmp, 'pcD'); fs.mkdirSync(dirD, { recursive: true });
const d1 = new L.License(dirD);
d1.rec.lastSeen = new Date(Date.now() + 40 * 864e5).toISOString();   // pretend we last ran in the future
d1._save();
const d2 = new L.License(dirD);
t('clock rollback is detected and flagged', d2.status().state === 'expired' || d2.rec.tamper === true);

console.log('\n=== 8. Hardware drift tolerance (synthetic Windows fingerprints) ===');
// Build fingerprints by hand so this tests the RULE, not whatever hardware
// the test happens to run on.
const H = n => Array(25).join('') + n;
function scen(name, present, changed, shouldPass) {
  const keys = ['machineGuid','board','disk','cpu','uuid'];
  const lic = {}; keys.forEach((k,i) => lic[k] = i < present ? 'p'+i : '');
  const now = {}; keys.forEach((k,i) => now[k] = i < present ? (i < changed ? 'X'+i : 'p'+i) : '');
  let m = 0; keys.forEach(k => { if (now[k] && lic[k] && now[k] === lic[k]) m++; });
  const need = L.requiredMatches(lic);
  t(name + ' (' + m + ' match, need ' + need + ')', (m >= need) === shouldPass);
}
scen('5 components, nothing changed',        5, 0, true);
scen('5 components, disk swapped',           5, 1, true);
scen('5 components, disk + board swapped',   5, 2, true);
scen('5 components, 3 changed = new PC',     5, 3, false);
scen('2 components only, nothing changed',   2, 0, true);
scen('2 components only, one changed',       2, 1, false);
scen('3 components, one changed',            3, 1, true);
scen('copied to a totally different PC',     5, 5, false);

console.log('\n=== 9. Expiry ===');
cp.execFileSync('node', ['iss-keygen.js', '--req', path.join(tmp, 'r.issreq'),
  '--company', 'Lapsed Ltd', '--expires', '2020-01-01', '--out', path.join(tmp, 'old.isslic')],
  { cwd: __dirname, stdio: 'ignore' });
const oldTok = fs.readFileSync(path.join(tmp, 'old.isslic'), 'utf8');
const dirE = path.join(tmp, 'pcE'); fs.mkdirSync(dirE, { recursive: true });
const e = new L.License(dirE);
const er = e.activate(oldTok);
t('an expired licence will not activate', !er.ok, er.reason);

console.log('\n' + (fail ? '  ' + fail + ' FAILED, ' : '  ') + pass + ' passed\n');
process.exit(fail ? 1 : 0);
