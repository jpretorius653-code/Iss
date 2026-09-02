// ============================================================
//  ISS Weighbridge — brand pack generator
//
//  Builds a signed .issbrand file that restyles and rebadges the app for a
//  white-label customer. Import it in the app under Site Setup → Branding.
//
//  Usage:
//    node make-brand.js promnatic          # a named preset below
//    node make-brand.js --company "X" --primary "#00A551" --logo path.png
//
//  WHAT THE SIGNATURE DOES — AND DOES NOT DO
//  The pack is signed with a keyed hash so the app rejects a hand-edited
//  pack (someone bumping their own licence tier by editing JSON). It is a
//  tamper check, NOT a licence: the secret ships inside index.html, so a
//  determined person can read it and forge a pack. Stopping unpaid INSTALLS
//  is the machine-bound licence's job (license.js / iss-keygen.js), not this.
//  Brand packs and licences are separate layers.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

// Must match index.html exactly.
const BRAND_SECRET = 'ISS-BRAND-7731';
const US = '\u241f';   // unit separator used in the canonical string

function brandHash(str, secret) {
  const s = (secret || BRAND_SECRET) + US + (str || '');
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0; h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + c) >>> 0; h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return ((h1 ^ ((h2 << 13) | (h2 >>> 19))) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
function brandCanon(b) {
  const c = b.colors || {};
  return [b.v || 1, b.company, b.tagline, b.address, b.phone, b.email, b.reg, b.ticketFooter,
    c.primary, c.accent, c.dark, c.mid, c.trim, c.red, b.licensedTo, b.logo]
    .map(x => x == null ? '' : String(x)).join(US);
}

// Shade a hex toward black (<1) or white (>1) — mirrors the app so a preset
// that only sets `primary` themes identically whether signed here or derived
// at runtime.
function shade(hex, f) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return hex;
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const mix = x => f <= 1 ? Math.round(x * f) : Math.round(x + (255 - x) * (f - 1));
  return '#' + [mix(r), mix(g), mix(b)].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
}

function loadLogo(p) {
  if (!p) return '';
  if (p.startsWith('data:')) return p;
  const buf = fs.readFileSync(p);
  const ext = path.extname(p).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,` + buf.toString('base64');
}

// ── Named presets ──────────────────────────────────────────────────────
const PRESETS = {
  promnatic: {
    company: 'Promnatic Scales',
    tagline: 'Why Wait. Please Weigh It',
    licensedTo: 'Promnatic Scales',
    colors: {
      primary: '#00A551',   // Promnatic green
      red:     '#E81F27',   // Promnatic red — overload / error
      // dark / mid / accent / trim derive from the green below unless set
    },
    logoFile: path.join(__dirname, 'promnatic_logo.png'),
  },
};

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function build() {
  const presetName = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  const preset = presetName ? PRESETS[presetName] : null;
  if (presetName && !preset) {
    console.error('\n  Unknown preset "' + presetName + '". Known: ' + Object.keys(PRESETS).join(', ') + '\n');
    process.exit(1);
  }

  const company = arg('company', preset && preset.company);
  if (!company) { console.error('\n  Need a company:  --company "Name"  (or a preset)\n'); process.exit(1); }

  const c = Object.assign({}, preset && preset.colors);
  if (arg('primary')) c.primary = arg('primary');
  if (arg('red'))     c.red = arg('red');
  if (arg('accent'))  c.accent = arg('accent');
  if (arg('dark'))    c.dark = arg('dark');
  if (!c.primary) { console.error('\n  Need a primary colour:  --primary "#RRGGBB"\n'); process.exit(1); }

  // Bake the derived shades into the pack so the file is self-describing and
  // does not depend on the app's shade() matching in future versions.
  c.dark   = c.dark   || shade(c.primary, 0.35);
  c.mid    = c.mid    || shade(c.primary, 0.62);
  c.accent = c.accent || shade(c.primary, 1.55);
  c.trim   = c.trim   || c.accent;

  const logoPath = arg('logo', preset && preset.logoFile);
  const b = {
    v: 1,
    company,
    tagline:     arg('tagline', preset && preset.tagline) || '',
    address:     arg('address', '') || '',
    phone:       arg('phone', '') || '',
    email:       arg('email', '') || '',
    reg:         arg('reg', '') || '',
    ticketFooter: arg('footer', '') || '',
    licensedTo:  arg('licensedTo', (preset && preset.licensedTo) || company),
    colors: c,
    logo: loadLogo(logoPath),
  };
  b.sig = brandHash(brandCanon(b));

  const out = arg('out', (presetName || company.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()) + '.issbrand');
  fs.writeFileSync(out, JSON.stringify(b, null, 2));

  console.log('\n  Brand pack built');
  console.log('  ─────────────────────────────────────────');
  console.log('  Company    : ' + b.company);
  console.log('  Primary    : ' + c.primary + '   dark ' + c.dark + '  mid ' + c.mid);
  console.log('  Accent     : ' + c.accent + '   trim ' + c.trim + (c.red ? '  red ' + c.red : ''));
  console.log('  Logo       : ' + (b.logo ? Math.round(b.logo.length / 1024) + ' KB embedded' : 'none'));
  console.log('  Signature  : ' + b.sig);
  console.log('  Written to : ' + out);
  console.log('\n  Import in the app under Site Setup → Branding.\n');
}

build();
