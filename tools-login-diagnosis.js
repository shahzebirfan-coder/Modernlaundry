/* Kyun admin/Admin@123 fail hota hai, aur Reset Pass se theek kaise hota hai */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const ROOT = '/home/user/Modernlaundry/';
let fails = 0;
const ok = (c, m, x) => c ? console.log('  ✓ ' + m) : (fails++, console.log('  ✗ ' + m + (x !== undefined ? '  → ' + x : '')));

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>',
  { url: 'https://local.test/index.html', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.crypto = w.crypto || {};
/* jsdom has no SubtleCrypto PBKDF2 → vault falls back to pure-JS (slower iterations) */
const sc = w.document.createElement('script');
sc.textContent = fs.readFileSync(ROOT + 'assets/js/vault.js', 'utf8');
w.document.head.appendChild(sc);

(async () => {
  const V = w.MDC_VAULT || w.MDC_CODE_VAULT;
  const vault = w.MDC_VAULT;

  console.log('1. seed (pehli dafa) — Admin@123 chalna chahiye');
  let r = await vault.verify('admin', 'Admin@123');
  ok(r.ok === true, 'seed login accepted (legacy)', JSON.stringify(r));

  console.log('\n2. ek dafa password badla → seed khatam (Ab yahi wajah hai)');
  await vault.set('admin', 'MyNewPass99');
  r = await vault.verify('admin', 'MyNewPass99');
  ok(r.ok === true, 'naya password chalta hai');
  r = await vault.verify('admin', 'Admin@123');
  ok(r.ok === false, 'Admin@123 ab REJECT hota hai (seed retire)', JSON.stringify(r));

  console.log('\n3. Admin "Reset Pass" kya karta hai (Users → 🔑 Reset Pass)');
  await vault.set('admin', 'Admin@123');
  r = await vault.verify('admin', 'Admin@123');
  ok(r.ok === true, 'reset ke baad Admin@123 dobara chal jata hai');

  console.log('\n4. chhoti ghalti: password ke aage/peeche space');
  r = await vault.verify('admin', 'Admin@123 ');
  ok(r.ok === false, 'extra space se login FAIL hota hai (trim karein)');

  console.log('\n5. doosra user (aibot) apne password se chalta hai');
  await vault.set('aibot', 'aibot123');
  r = await vault.verify('aibot', 'aibot123');
  ok(r.ok === true, 'aibot login theek');

  console.log('\n' + (fails ? fails + ' FAILURES ❌' : 'LOGIN DIAGNOSIS PASSED ✅'));
  process.exit(fails ? 1 : 0);
})();
