'use strict';
const fs = require('fs');

// Pull the real functions out of the app so we test against shipping code,
// not a copy.
const html = fs.readFileSync('../renderer/index.html', 'utf8');
const m = /<script[^>]*>([\s\S]*?)<\/script>/g;
let last = ''; let x; while ((x = m.exec(html))) last = x[1];
function grab(sig) {
  const i = last.indexOf(sig);
  if (i < 0) throw new Error('not found: ' + sig);
  // brace-match from the first { after the signature
  let j = last.indexOf('{', i), depth = 0, k = j;
  for (; k < last.length; k++) { if (last[k] === '{') depth++; else if (last[k] === '}') { depth--; if (!depth) break; } }
  return last.slice(i, k + 1);
}

const BRAND_SECRET = (last.match(/const BRAND_SECRET='([^']+)'/) || [])[1];
const src = [
  'const BRAND_SECRET=' + JSON.stringify(BRAND_SECRET) + ';',
  'const LEGACY_BRAND_SECRETS=[];',
  grab('function brandHash'),
  grab('function brandCanon'),
  grab('function brandValid'),
  grab('function shade'),
  grab('function applyBrandColors'),
].join('\n');

// Fake just enough DOM for applyBrandColors.
const vars = {};
const rs = { setProperty: (k, v) => { vars[k] = v; } };
global.document = {
  documentElement: { style: rs },
};
global.getComputedStyle = () => ({ getPropertyValue: () => '#000000' });

const sandbox = { module: {}, exports: {} };
const fn = new Function('document', 'getComputedStyle', src + `
  ;return { brandValid, applyBrandColors };`);
const app = fn(global.document, global.getComputedStyle);

let pass = 0, fail = 0;
const t = (n, c, extra) => c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log('  FAIL  ' + n + (extra ? ' -> ' + extra : '')));

console.log('\n=== Promnatic pack validates against the app ===');
const pack = JSON.parse(fs.readFileSync('../docs/promnatic.issbrand', 'utf8'));
t('brandValid accepts the generated pack', app.brandValid(pack), 'signature mismatch');

console.log('\n=== A hand-edited pack is rejected ===');
const tampered = JSON.parse(JSON.stringify(pack));
tampered.company = 'Someone Else';
t('editing company breaks the signature', !app.brandValid(tampered));
const tampered2 = JSON.parse(JSON.stringify(pack));
tampered2.colors.primary = '#FF0000';
t('editing a colour breaks the signature', !app.brandValid(tampered2));

console.log('\n=== Green lands on all six theme vars ===');
app.applyBrandColors(pack.colors, rs);
t('--blue  = green primary', vars['--blue'] === '#00A551', vars['--blue']);
t('--navy  = dark green (set)', /^#00/i.test(vars['--navy']), vars['--navy']);
t('--navy2 = mid green (set)', /^#00/i.test(vars['--navy2']), vars['--navy2']);
t('--light = pale green (set)', vars['--light'] === pack.colors.accent, vars['--light']);
t('--gold  = green trim, NOT ISS gold', vars['--gold'] === pack.colors.trim && !/D9B45B/i.test(vars['--gold']), vars['--gold']);
t('--red   = Promnatic red', vars['--red'] === '#E81F27', vars['--red']);

console.log('\n=== A two-colour pack still themes fully (derivation) ===');
const minimal = { colors: { primary: '#00A551' } };
Object.keys(vars).forEach(k => delete vars[k]);
app.applyBrandColors(minimal.colors, rs);
t('derives all six from primary alone',
  ['--blue', '--navy', '--navy2', '--light', '--gold'].every(k => vars[k]),
  JSON.stringify(vars));

console.log('\n' + (fail ? '  ' + fail + ' FAILED, ' : '  ') + pass + ' passed\n');
process.exit(fail ? 1 : 0);
