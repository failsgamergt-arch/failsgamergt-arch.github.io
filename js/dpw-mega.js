/* Reads the public file name/size of a MEGA file link (to pre-fill artist + day in the admin upload).
 * Only file links; folder links return null. Never required: failures fall back to manual input. */
(function (root) {
  'use strict';

  function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // AES-128-CBC, zero IV, no padding (MEGA attribute format) on top of WebCrypto, which
  // only accepts PKCS#7: append one forged block that decrypts to a full padding block.
  function decryptNoPad(rawKey, data) {
    var subtle = root.crypto.subtle, zero = new Uint8Array(16);
    return subtle.importKey('raw', rawKey, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']).then(function (key) {
      var last = data.subarray(data.length - 16), block = new Uint8Array(16);
      for (var i = 0; i < 16; i++) block[i] = last[i] ^ 16;
      return subtle.encrypt({ name: 'AES-CBC', iv: zero }, key, block).then(function (enc) {
        var full = new Uint8Array(data.length + 16);
        full.set(data, 0);
        full.set(new Uint8Array(enc).subarray(0, 16), data.length);
        return subtle.decrypt({ name: 'AES-CBC', iv: zero }, key, full);
      });
    }).then(function (buf) { return new Uint8Array(buf); });
  }

  function resolve(url) {
    var m = /^https:\/\/mega\.nz\/file\/([A-Za-z0-9_-]+)#([A-Za-z0-9_-]{43})$/.exec(String(url || '').trim());
    if (!m || !root.crypto || !root.crypto.subtle) return Promise.resolve(null);
    var full = b64urlToBytes(m[2]);
    if (full.length !== 32) return Promise.resolve(null);
    var key = new Uint8Array(16);
    for (var i = 0; i < 16; i++) key[i] = full[i] ^ full[i + 16];
    return fetch('https://g.api.mega.co.nz/cs?id=' + Math.floor(Math.random() * 1e9), {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify([{ a: 'g', p: m[1] }])
    }).then(function (r) { return r.json(); }).then(function (res) {
      var info = Array.isArray(res) ? res[0] : null;
      if (!info || typeof info !== 'object' || !info.at) return null;
      var at = b64urlToBytes(info.at);
      if (!at.length || at.length % 16) return null;
      return decryptNoPad(key, at).then(function (plain) {
        var text = new TextDecoder('utf-8').decode(plain).replace(/\0+$/, '');
        if (text.indexOf('MEGA{') !== 0) return null;
        var attrs = JSON.parse(text.slice(4));
        return { name: typeof attrs.n === 'string' ? attrs.n : '', size: +info.s || 0 };
      });
    }).catch(function () { return null; });
  }

  root.DPWMega = { resolve: resolve };
})(typeof self !== 'undefined' ? self : this);
