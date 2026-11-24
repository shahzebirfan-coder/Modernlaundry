/* ============================================================
   OFFLINE VENDOR RECOVERY CODE  (one-time login)
   ------------------------------------------------------------
   Masla: client ka admin password bhool jana / ghalti se badal jana.
   Pehle sirf "Master Recovery Code" tha jo mojood nahi ho to rasta band.

   Hal: vendor (IT owner) apne PRIVATE key se ek chhota code banata hai.
   Code ke andar hota hai:
       u   = username (jaise "admin")
       d   = device tag (os PC ka short hash — code sirf usi PC par chalta hai)
       exp = expiry (yyyy-mm-dd)
   App ke andar sirf PUBLIC key hai → code CHECK ho sakta hai, banaya nahi.
   Signature galat / expire / doosra PC → code reject.

   Format:  MDC1.<base64url(payload)>.<base64url(signature)>

   Recovery ke baad app user ko MAJBOOR karta hai ke woh naya password
   set kare (temp password se login → foran change screen).
   ============================================================ */
(function () {
  'use strict';

  /* Public key — private key kabhi app me nahi jaati. */
  var PUB = {
    kty: 'EC', crv: 'P-256',
    x: 'p2AZzzBOtaC_YpIDPpujx3IaoqHvaon5ORd0sVvjBjw',
    y: 'AFBmYmv0fPHLeTgOrlYcxxiAobzUuV9a-kKKl17spk0'
  };

  var PREFIX = 'MDC1';
  var LS_USED = 'mdcRecoveryUsed';   // { code_hash: timestamp } — replay rokne ke liye

  /* ---------- base64url ---------- */
  function b64uToBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function bufToB64u(buf) {
    var b = new Uint8Array(buf), out = '';
    for (var i = 0; i < b.length; i++) out += String.fromCharCode(b[i]);
    return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* ---------- device tag (os PC ka short hash) ----------
     Browser fingerprint jaisa kuch nahi — sirf OS + timezone + screen + UA
     ka stable hash. Code sirf usi PC par chalta hai. */
  async function deviceTag() {
    var raw = [
      navigator.platform || '', navigator.userAgent || '',
      (screen.width || 0) + 'x' + (screen.height || 0),
      (new Date().getTimezoneOffset()) + '',
      (navigator.language || '')
    ].join('|');
    try {
      if (window.crypto && crypto.subtle) {
        var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return bufToB64u(d).slice(0, 10);
      }
    } catch (e) {}
    /* fallback: djb2 */
    var h = 5381;
    for (var i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
    return ('0000000000' + h.toString(36)).slice(-10);
  }

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  /* ---------- verify ---------- */
  async function verifyCode(code, expectedUser) {
    var out = { ok: false, reason: '' };
    try {
      var parts = String(code || '').trim().split('.');
      if (parts.length !== 3 || parts[0] !== PREFIX) { out.reason = 'Code ka format ghalat hai'; return out; }

      var payloadBytes = b64uToBytes(parts[1]);
      var payload = JSON.parse(new TextDecoder().decode(payloadBytes));

      if (expectedUser && String(payload.u).toLowerCase() !== String(expectedUser).toLowerCase()) {
        out.reason = 'Yeh code "' + payload.u + '" ke liye hai'; return out;
      }
      if (payload.exp && payload.exp < todayStr()) { out.reason = 'Code expire ho chuka hai (' + payload.exp + ')'; return out; }

      var tag = await deviceTag();
      if (payload.d && payload.d !== tag) {
        out.reason = 'Code kisi doosre computer ke liye bana hai'; return out;
      }

      if (!(window.crypto && crypto.subtle)) { out.reason = 'Is browser me verify support nahi'; return out; }
      var key = await crypto.subtle.importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      var sigBytes = b64uToBytes(parts[2]);
      var good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sigBytes, payloadBytes);
      if (!good) { out.reason = 'Signature ghalat hai — code tampered hai'; return out; }

      /* replay: ek hi code dobara istemal na ho */
      var used = {};
      try { used = JSON.parse(localStorage.getItem(LS_USED) || '{}'); } catch (e) {}
      if (used[parts[2]]) { out.reason = 'Yeh code pehle istemal ho chuka hai'; return out; }

      out.ok = true;
      out.user = payload.u;
      out.sig = parts[2];
      return out;
    } catch (e) {
      out.reason = 'Code parh nahi saka: ' + (e && e.message ? e.message : e);
      return out;
    }
  }

  function markUsed(sig) {
    try {
      var used = {};
      try { used = JSON.parse(localStorage.getItem(LS_USED) || '{}'); } catch (e) {}
      used[sig] = Date.now();
      localStorage.setItem(LS_USED, JSON.stringify(used));
    } catch (e) {}
  }

  /* random temporary password — user ko dikhaya jata hai, phir badalna zaroori */
  function tempPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var a = new Uint8Array(8);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
    var out = '';
    for (var j = 0; j < 8; j++) out += chars[a[j] % chars.length];
    return 'RC-' + out;
  }

  window.MDC_RECOVERY = {
    PUB: PUB,
    deviceTag: deviceTag,
    verifyCode: verifyCode,
    markUsed: markUsed,
    tempPassword: tempPassword
  };
})();
