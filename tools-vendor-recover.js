#!/usr/bin/env node
/* ============================================================
   VENDOR RECOVERY CODE GENERATOR  (sirf IT owner ke liye)
   ------------------------------------------------------------
   Client ke PC par "Vendor Recovery Code" ki zaroorat pare to:

     node vendor-recover.js admin 2026-12-15

   1) Client se un ka DEVICE TAG maangein:
        POS login screen → Forgot Password → Vendor Recovery Code
        (neeche chhota text: "Device tag: XXXXXXXXXX")
   2) Phir yeh command chalayein:
        node vendor-recover.js admin 2026-12-15 XXXXXXXXXX
   3) Jo code print ho, wohi client ko WhatsApp par bhej dein.

   Private key: VENDOR-RECOVERY-private.pem (isi folder me, kabhi share na karein)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY = path.join(__dirname, 'VENDOR-RECOVERY-private.pem');

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const [, , user, expiry, deviceTag] = process.argv;

if (!user || !expiry) {
  console.log(`
Istemaal:
  node vendor-recover.js <username> <expiry YYYY-MM-DD> [deviceTag]

Misaal:
  node vendor-recover.js admin 2026-12-15 A1b2C3d4E5

deviceTag khali chhorein to code HAR PC par chalega (sirf emergency ke liye).
`);
  process.exit(0);
}

const payload = { u: user, exp: expiry };
if (deviceTag) payload.d = deviceTag;

const payloadBuf = Buffer.from(JSON.stringify(payload));
const priv = crypto.createPrivateKey(fs.readFileSync(KEY));
const sig = crypto.sign('sha256', payloadBuf, { key: priv, dsaEncoding: 'ieee-p1363' });

const code = 'MDC1.' + b64u(payloadBuf) + '.' + b64u(sig);
console.log('\n  Username    : ' + user);
console.log('  Expiry      : ' + expiry);
console.log('  Device tag  : ' + (deviceTag || '(koi nahi — HAR PC par chalega)'));
console.log('\n  RECOVERY CODE:\n');
console.log('  ' + code + '\n');
console.log('  (Client ko poora code copy-paste kar ke bhejein)\n');
