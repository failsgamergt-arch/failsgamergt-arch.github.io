/* Admin accounts + encrypted publishing key (access.json in the dpw-data repo).
 * The GitHub key is encrypted with a random 256-bit master key (AES-GCM). Each admin has a "slot":
 * the master key encrypted with a key derived from that admin's password (PBKDF2-SHA256, 600k).
 * Logging in = opening your slot. Nobody but a logged-in admin can ever read the GitHub key, and
 * plaintext passwords are never stored anywhere. Works in browsers and Node >= 19 (WebCrypto). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DPWVault = api;
})(typeof self !== 'undefined' ? self : globalThis, function (root) {
  'use strict';

  var VERSION = 1;
  var ITERATIONS = 600000;
  var MIN_ITERATIONS = 100000;
  var USER_RE = /^[a-z0-9._-]{3,30}$/;
  var B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
  var COMMON = ['admin2026', 'shark-music_2026', 'password', 'contrasena', 'contraseña', '123456789', 'qwerty', 'djpoolworld', 'dj pool world'];
  var cryptoApi = root.crypto || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function subtle() {
    if (!cryptoApi || !cryptoApi.subtle) throw new Error('Este navegador no permite cifrado seguro (usa Chrome, Edge, Firefox o Safari actualizados, con https).');
    return cryptoApi.subtle;
  }

  function b64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function rand(n) { var a = new Uint8Array(n); cryptoApi.getRandomValues(a); return a; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function normUser(u) { return String(u == null ? '' : u).trim().toLowerCase(); }

  function deriveKek(password, salt, iterations) {
    return subtle().importKey('raw', enc.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function aesKey(raw) { return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }

  function seal(key, bytes, aad) {
    var iv = rand(12);
    return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: enc.encode(aad) }, key, bytes).then(function (ct) {
      return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
    });
  }

  function open(key, box, aad) {
    return subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: enc.encode(aad) }, key, unb64(box.ct)).then(function (pt) {
      return new Uint8Array(pt);
    });
  }

  function slotAad(user) { return 'dpw-admin-v1:' + user; }
  var TOKEN_AAD = 'dpw-token-v1';

  // ---------------------------------------------------------------- rules
  function userProblem(user) {
    var u = normUser(user);
    if (!USER_RE.test(u)) return 'Usuario: 3-30 caracteres (letras, numeros, punto, guion o guion bajo).';
    return '';
  }

  function passwordProblem(pw, user) {
    var p = String(pw == null ? '' : pw);
    if (p.length < 12) return 'La contraseña debe tener al menos 12 caracteres.';
    if (p.length > 200) return 'La contraseña es demasiado larga.';
    if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p) || !/[0-9]/.test(p)) return 'La contraseña debe tener letras y numeros.';
    var low = p.toLowerCase();
    if (user && normUser(user).length >= 3 && low.indexOf(normUser(user)) !== -1) return 'La contraseña no puede contener el nombre de usuario.';
    if (COMMON.some(function (c) { return low.indexOf(c) !== -1; })) return 'Esa contraseña es demasiado facil de adivinar.';
    if (new Set(low.split('')).size < 6) return 'Esa contraseña es demasiado facil de adivinar (usa mas caracteres distintos).';
    return '';
  }

  function generatePassword() {
    var alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    for (;;) {
      var bytes = rand(16), out = '';
      for (var i = 0; i < 16; i++) {
        if (i && i % 4 === 0) out += '-';
        out += alphabet[bytes[i] % alphabet.length];
      }
      if (!passwordProblem(out)) return out;
    }
  }

  function validateAccess(a) {
    var errors = [];
    if (!a || typeof a !== 'object') return ['access.json no es un objeto'];
    if (a.version !== VERSION) errors.push('version no soportada');
    if (!a.kdf || a.kdf.name !== 'PBKDF2' || a.kdf.hash !== 'SHA-256' || !(a.kdf.iterations >= MIN_ITERATIONS && a.kdf.iterations <= 10000000)) errors.push('kdf no valido');
    if (!a.token || !B64_RE.test(a.token.iv || '') || !B64_RE.test(a.token.ct || '')) errors.push('clave cifrada no valida');
    if (!Array.isArray(a.admins) || !a.admins.length) errors.push('no hay administradores');
    var seen = {};
    (a.admins || []).forEach(function (s, i) {
      if (!s || !USER_RE.test(s.user || '')) errors.push('admin #' + (i + 1) + ': usuario no valido');
      else if (seen[s.user]) errors.push('admin repetido: ' + s.user);
      else seen[s.user] = true;
      if (!s || !B64_RE.test(s.salt || '') || !B64_RE.test(s.iv || '') || !B64_RE.test(s.ct || '')) errors.push('admin #' + (i + 1) + ': datos cifrados no validos');
    });
    return errors;
  }

  function assertAccess(a) {
    var errors = validateAccess(a);
    if (errors.length) throw new Error('access.json no valido: ' + errors.join('; '));
    return a;
  }

  function findSlot(access, user) {
    var u = normUser(user);
    return (access && Array.isArray(access.admins) ? access.admins : []).filter(function (s) { return s.user === u; })[0] || null;
  }

  function hasAdmin(access, user) { return !!findSlot(access, user); }
  function listAdmins(access) { return (access && access.admins || []).map(function (s) { return s.user; }); }

  // ---------------------------------------------------------------- operations
  function makeSlot(mkRaw, user, password, iterations) {
    var u = normUser(user), salt = rand(16);
    return deriveKek(password, salt, iterations).then(function (kek) { return seal(kek, mkRaw, slotAad(u)); })
      .then(function (box) { return { user: u, salt: b64(salt), iv: box.iv, ct: box.ct }; });
  }

  function checkNew(user, password) {
    var e = userProblem(user) || passwordProblem(password, user);
    if (e) throw new Error(e);
  }

  // -> Promise<{ access, mk }> ; admins: [{user, password}]
  function create(token, admins) {
    return Promise.resolve().then(function () {
      if (!token || typeof token !== 'string' || token.trim().length < 20) throw new Error('La llave de GitHub no parece valida.');
      if (!admins || !admins.length) throw new Error('Hace falta al menos un administrador.');
      admins.forEach(function (a) { checkNew(a.user, a.password); });
      var mkRaw = rand(32);
      return aesKey(mkRaw).then(function (mk) { return seal(mk, enc.encode(token.trim()), TOKEN_AAD); }).then(function (tokenBox) {
        return admins.reduce(function (p, a) {
          return p.then(function (slots) {
            if (slots.some(function (s) { return s.user === normUser(a.user); })) throw new Error('Usuario repetido: ' + normUser(a.user));
            return makeSlot(mkRaw, a.user, a.password, ITERATIONS).then(function (s) { return slots.concat([s]); });
          });
        }, Promise.resolve([])).then(function (slots) {
          var access = { version: VERSION, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS }, token: tokenBox, admins: slots, updated: new Date().toISOString() };
          return { access: assertAccess(access), mk: b64(mkRaw) };
        });
      });
    });
  }

  // -> Promise<{ user, mk, token }> or null when user unknown / password wrong.
  function unlock(access, user, password) {
    var slot = findSlot(access, user);
    if (!slot || validateAccess(access).length) return Promise.resolve(null);
    var mkRaw;
    return deriveKek(String(password == null ? '' : password), unb64(slot.salt), access.kdf.iterations)
      .then(function (kek) { return open(kek, slot, slotAad(slot.user)); })
      .then(function (raw) { mkRaw = raw; return aesKey(raw); }, function () { return null; })
      .then(function (mk) {
        if (!mk) return null;
        return open(mk, access.token, TOKEN_AAD).then(function (t) {
          return { user: slot.user, mk: b64(mkRaw), token: dec.decode(t) };
        });
      });
  }

  function addAdmin(access, mkB64, user, password) {
    return Promise.resolve().then(function () {
      checkNew(user, password);
      if (findSlot(access, user)) throw new Error('Ya existe el admin ' + normUser(user) + '.');
      return makeSlot(unb64(mkB64), user, password, access.kdf.iterations).then(function (slot) {
        var out = clone(access);
        out.admins.push(slot);
        out.updated = new Date().toISOString();
        return assertAccess(out);
      });
    });
  }

  function removeAdmin(access, user) {
    var u = normUser(user);
    if (!findSlot(access, u)) throw new Error('No existe el admin ' + u + '.');
    if (access.admins.length <= 1) throw new Error('No se puede borrar el ultimo administrador.');
    var out = clone(access);
    out.admins = out.admins.filter(function (s) { return s.user !== u; });
    out.updated = new Date().toISOString();
    return assertAccess(out);
  }

  function changePassword(access, mkB64, user, newPassword) {
    return Promise.resolve().then(function () {
      var u = normUser(user);
      if (!findSlot(access, u)) throw new Error('No existe el admin ' + u + '.');
      var e = passwordProblem(newPassword, u);
      if (e) throw new Error(e);
      return makeSlot(unb64(mkB64), u, newPassword, access.kdf.iterations).then(function (slot) {
        var out = clone(access);
        out.admins = out.admins.map(function (s) { return s.user === u ? slot : s; });
        out.updated = new Date().toISOString();
        return assertAccess(out);
      });
    });
  }

  function replaceToken(access, mkB64, token) {
    return Promise.resolve().then(function () {
      if (!token || typeof token !== 'string' || token.trim().length < 20) throw new Error('La llave de GitHub no parece valida.');
      return aesKey(unb64(mkB64)).then(function (mk) { return seal(mk, enc.encode(token.trim()), TOKEN_AAD); }).then(function (box) {
        var out = clone(access);
        out.token = box;
        out.updated = new Date().toISOString();
        return assertAccess(out);
      });
    });
  }

  return {
    VERSION: VERSION, ITERATIONS: ITERATIONS,
    normUser: normUser, userProblem: userProblem, passwordProblem: passwordProblem, generatePassword: generatePassword,
    validateAccess: validateAccess, assertAccess: assertAccess, hasAdmin: hasAdmin, listAdmins: listAdmins,
    create: create, unlock: unlock, addAdmin: addAdmin, removeAdmin: removeAdmin, changePassword: changePassword, replaceToken: replaceToken
  };
});
