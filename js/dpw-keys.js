/* Protected download links (keys.json + pools.enc in the dpw-data repo).
 * - The full pools data (with MEGA links) is encrypted with a random 256-bit content key (AES-GCM) -> pools.enc.
 *   pools.json only keeps the public catalogue (days, artists, file names) without links.
 * - Every "principal" has an ECDH P-256 key pair and receives the content key wrapped for its public key:
 *     admin  : one shared key pair; its private key is sealed with the admin vault master key (dpw-vault.js)
 *     member : one per subscriber; private key sealed with PBKDF2(password). Login works on any device.
 *     cli    : the owner's PC (tools/pools-cli.js); private key stays in a local file, never uploaded.
 * - Removing a member = rotate(): new content key, wrapped only for the remaining principals, so the removed
 *   member cannot read anything published afterwards. Old keys stay in `history` (sealed with the current key)
 *   so old versions of pools.enc can still be restored.
 * - Subscriber names / e-mails are personal data: kept in `meta`, sealed with the admin master key.
 * Works in browsers and Node >= 19 (WebCrypto). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DPWKeys = api;
})(typeof self !== 'undefined' ? self : globalThis, function (root) {
  'use strict';

  var VERSION = 1;
  var ITERATIONS = 600000;
  var MIN_ITERATIONS = 100000;
  var ADMIN_ID = 'admins';
  var USER_RE = /^[a-z0-9._-]{3,30}$/;
  var ID_RE = /^[a-z0-9._-]{3,64}$/;
  var B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
  var B64URL_RE = /^[A-Za-z0-9_-]+$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var EC = { name: 'ECDH', namedCurve: 'P-256' };
  var cryptoApi = root.crypto || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function subtle() {
    if (!cryptoApi || !cryptoApi.subtle) throw new Error('Este navegador no permite cifrado seguro (usa Chrome, Edge, Firefox o Safari actualizados, con https).');
    return cryptoApi.subtle;
  }

  // ---------------------------------------------------------------- encoding
  function b64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hex(bytes) { return Array.prototype.map.call(bytes, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
  function rand(n) { var a = new Uint8Array(n); cryptoApi.getRandomValues(a); return a; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function now() { return new Date().toISOString(); }
  function normUser(u) { return String(u == null ? '' : u).trim().toLowerCase(); }

  // ---------------------------------------------------------------- primitives
  function aesKey(raw) { return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }

  function seal(key, bytes, aad) {
    var iv = rand(12);
    return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: enc.encode(aad) }, key, bytes)
      .then(function (ct) { return { iv: b64(iv), ct: b64(new Uint8Array(ct)) }; });
  }

  function open(key, box, aad) {
    return subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: enc.encode(aad) }, key, unb64(box.ct))
      .then(function (pt) { return new Uint8Array(pt); });
  }

  function passwordKey(password, salt, iterations) {
    return subtle().importKey('raw', enc.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function newKeyPair() {
    return subtle().generateKey(EC, true, ['deriveBits']).then(function (kp) {
      return Promise.all([subtle().exportKey('jwk', kp.publicKey), subtle().exportKey('pkcs8', kp.privateKey)]).then(function (r) {
        return { pub: { x: r[0].x, y: r[0].y }, priv: new Uint8Array(r[1]) };
      });
    });
  }

  function importPub(pub) {
    return subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, ext: true }, EC, true, []);
  }
  function importPriv(pkcs8) { return subtle().importKey('pkcs8', pkcs8, EC, false, ['deriveBits']); }

  function wrapAad(id, kid) { return 'dpw-wrap-v1:' + id + ':' + kid; }

  function sharedKey(privKey, pubKey, id, kid) {
    return subtle().deriveBits({ name: 'ECDH', public: pubKey }, privKey, 256).then(function (bits) {
      return subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    }).then(function (base) {
      return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(wrapAad(id, kid)) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  // Content key (raw bytes) -> wrap readable only by the owner of `pub`.
  function wrapFor(principal, ckRaw, kid) {
    return subtle().generateKey(EC, true, ['deriveBits']).then(function (eph) {
      return importPub(principal.pub).then(function (pub) { return sharedKey(eph.privateKey, pub, principal.id, kid); })
        .then(function (k) { return seal(k, ckRaw, wrapAad(principal.id, kid)); })
        .then(function (box) {
          return subtle().exportKey('jwk', eph.publicKey).then(function (j) { return { kid: kid, eph: { x: j.x, y: j.y }, iv: box.iv, ct: box.ct }; });
        });
    });
  }

  function unwrap(principal, privPkcs8) {
    var w = principal.wrap;
    return Promise.all([importPriv(privPkcs8), importPub(w.eph)])
      .then(function (r) { return sharedKey(r[0], r[1], principal.id, w.kid); })
      .then(function (k) { return open(k, w, wrapAad(principal.id, w.kid)); });
  }

  // ---------------------------------------------------------------- keys.json shape
  function validateKeys(k) {
    var errors = [];
    if (!k || typeof k !== 'object') return ['keys.json no es un objeto'];
    if (k.version !== VERSION) errors.push('version no soportada');
    if (!k.kdf || k.kdf.name !== 'PBKDF2' || k.kdf.hash !== 'SHA-256' || !(k.kdf.iterations >= MIN_ITERATIONS && k.kdf.iterations <= 10000000)) errors.push('kdf no valido');
    if (!/^[0-9a-f]{16}$/.test(k.kid || '')) errors.push('kid no valido');
    if (!Array.isArray(k.principals)) errors.push('principals debe ser una lista');
    var seen = {};
    (k.principals || []).forEach(function (p, i) {
      var where = 'principal #' + (i + 1);
      if (!p || !ID_RE.test(p.id || '')) { errors.push(where + ': id no valido'); return; }
      if (seen[p.id]) errors.push('principal repetido: ' + p.id);
      seen[p.id] = true;
      if (['admin', 'member', 'cli'].indexOf(p.kind) === -1) errors.push(where + ': tipo no valido');
      if (!p.pub || !B64URL_RE.test(p.pub.x || '') || !B64URL_RE.test(p.pub.y || '')) errors.push(where + ': clave publica no valida');
      if (p.wrap && (!B64URL_RE.test((p.wrap.eph || {}).x || '') || !B64_RE.test(p.wrap.iv || '') || !B64_RE.test(p.wrap.ct || ''))) errors.push(where + ': acceso cifrado no valido');
      if (p.auth && !B64_RE.test(p.auth)) errors.push(where + ': firma no valida');
      if (p.kind !== 'cli' && (!p.key || !B64_RE.test(p.key.iv || '') || !B64_RE.test(p.key.ct || ''))) errors.push(where + ': clave privada cifrada no valida');
      if (p.kind === 'member' && (!B64_RE.test((p.key || {}).salt || '') || !DATE_RE.test(p.exp || ''))) errors.push(where + ': datos de suscriptor no validos');
    });
    if (k.history && typeof k.history !== 'object') errors.push('history no valido');
    return errors;
  }

  function assertKeys(k) {
    var errors = validateKeys(k);
    if (errors.length) throw new Error('keys.json no valido: ' + errors.join('; '));
    return k;
  }

  function newKid() { return hex(rand(8)); }
  function find(keys, id) { return (keys && keys.principals || []).filter(function (p) { return p.id === id; })[0] || null; }
  function isCurrent(keys, p) { return !!(p && p.wrap && p.wrap.kid === keys.kid); }
  function pending(keys) { return keys.principals.filter(function (p) { return !isCurrent(keys, p); }); }

  // Every authorised principal carries an HMAC (keyed with the content key) over its id, kind and public key.
  // Write access to the repo is not enough to forge it, so a principal slipped into keys.json by someone who only
  // has the publishing token never receives the key: not on rotation, not on sync.
  function authMsg(p, kid) { return enc.encode(['dpw-auth-v1', kid, p.id, p.kind, p.pub.x, p.pub.y].join('|')); }
  function hmacKey(ckRaw, usage) { return subtle().importKey('raw', ckRaw, { name: 'HMAC', hash: 'SHA-256' }, false, [usage]); }
  function authTag(ckRaw, p, kid) {
    return hmacKey(ckRaw, 'sign').then(function (k) { return subtle().sign('HMAC', k, authMsg(p, kid)); }).then(function (sig) { return b64(new Uint8Array(sig)); });
  }
  function authOk(ckRaw, p, kid) {
    if (!p.auth || !B64_RE.test(p.auth)) return Promise.resolve(false);
    return hmacKey(ckRaw, 'verify').then(function (k) { return subtle().verify('HMAC', k, unb64(p.auth), authMsg(p, kid)); }).catch(function () { return false; });
  }

  // Gives the current content key to the authorised principals that lack it, plus the ones named in allowIds
  // (a new subscriber, or a pending access the owner has explicitly approved). Everyone else stays pending.
  function syncWraps(keys, ckB64, allowIds) {
    var ckRaw = unb64(ckB64), out = clone(keys), allow = allowIds || [];
    return Promise.all(out.principals.map(function (p) {
      return authOk(ckRaw, p, out.kid).then(function (ok) {
        if (ok && isCurrent(out, p)) return;
        if (!ok && allow.indexOf(p.id) === -1) return;
        return Promise.all([wrapFor(p, ckRaw, out.kid), authTag(ckRaw, p, out.kid)]).then(function (r) { p.wrap = r[0]; p.auth = r[1]; });
      });
    })).then(function () { out.updated = now(); return assertKeys(out); });
  }

  // Ids of the principals currently authorised (valid HMAC under ckB64).
  function authorised(keys, ckB64) {
    var ckRaw = unb64(ckB64);
    return Promise.all(keys.principals.map(function (p) { return authOk(ckRaw, p, keys.kid).then(function (ok) { return ok ? p.id : null; }); }))
      .then(function (ids) { return ids.filter(Boolean); });
  }

  // Brand-new keys.json with the given public principals. -> { keys, ck }
  function create(principals) {
    var ckRaw = rand(32);
    var keys = { version: VERSION, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS }, kid: newKid(), principals: clone(principals), history: {}, meta: null, updated: now() };
    keys.principals.forEach(function (p) { p.wrap = null; p.auth = null; });
    return syncWraps(keys, b64(ckRaw), keys.principals.map(function (p) { return p.id; })).then(function (k) { return { keys: k, ck: b64(ckRaw) }; });
  }

  // New content key; old keys move to `history` (sealed with the new key). Caller must re-encrypt pools.enc.
  // Only principals authorised under the old key are carried over.
  function rotate(keys, ckB64) {
    var oldRaw = unb64(ckB64), newRaw = rand(32), out = clone(keys), oldKid = keys.kid, keep = [];
    out.kid = newKid();
    out.principals.forEach(function (p) { p.wrap = null; p.auth = null; });
    return authorised(keys, ckB64).then(function (ids) { keep = ids; return Promise.all([aesKey(oldRaw), aesKey(newRaw)]); }).then(function (k) {
      var oldKey = k[0], newKey = k[1], hist = {};
      var jobs = Object.keys(keys.history || {}).map(function (kid) {
        return open(oldKey, keys.history[kid], histAad(kid, oldKid))
          .then(function (raw) { return seal(newKey, raw, histAad(kid, out.kid)); })
          .then(function (box) { hist[kid] = box; });
      });
      jobs.push(seal(newKey, oldRaw, histAad(oldKid, out.kid)).then(function (box) { hist[oldKid] = box; }));
      return Promise.all(jobs).then(function () { out.history = hist; return syncWraps(out, b64(newRaw), keep); });
    }).then(function (k) { return { keys: k, ck: b64(newRaw) }; });
  }

  function histAad(kid, currentKid) { return 'dpw-hist-v1:' + kid + ':' + currentKid; }

  // ---------------------------------------------------------------- pools.enc
  function poolsAad(kid) { return 'dpw-pools-v1:' + kid; }

  function encryptPools(keys, ckB64, text) {
    return aesKey(unb64(ckB64)).then(function (k) { return seal(k, enc.encode(text), poolsAad(keys.kid)); })
      .then(function (box) { return { version: VERSION, kid: keys.kid, iv: box.iv, ct: box.ct }; });
  }

  // Works for the current key and for any older key kept in history (old versions of pools.enc).
  function decryptPools(keys, ckB64, box) {
    if (!box || box.version !== VERSION || !B64_RE.test(box.iv || '') || !B64_RE.test(box.ct || '')) return Promise.reject(new Error('pools.enc no valido'));
    return aesKey(unb64(ckB64)).then(function (current) {
      if (box.kid === keys.kid) return current;
      var h = (keys.history || {})[box.kid];
      if (!h) throw new Error('Esa version de los enlaces usa una clave que ya no existe.');
      return open(current, h, histAad(box.kid, keys.kid)).then(aesKey);
    }).then(function (k) { return open(k, box, poolsAad(box.kid)); }).then(function (pt) { return dec.decode(pt); });
  }

  // ---------------------------------------------------------------- admin principal (shared by all admins)
  var ADMIN_AAD = 'dpw-adminkey-v1';

  function hasAdmin(keys) { return !!find(keys, ADMIN_ID); }

  // Adds (or replaces, if it was sealed with another master key) the admin principal. Its access stays
  // pending until someone holding the content key syncs (the CLI or a member of staff already inside).
  function registerAdmin(keys, mkB64) {
    return Promise.all([newKeyPair(), aesKey(unb64(mkB64))]).then(function (r) {
      return seal(r[1], r[0].priv, ADMIN_AAD).then(function (box) {
        var out = clone(keys);
        out.principals = out.principals.filter(function (p) { return p.id !== ADMIN_ID; });
        out.principals.unshift({ id: ADMIN_ID, kind: 'admin', pub: r[0].pub, key: box, wrap: null });
        out.updated = now();
        return assertKeys(out);
      });
    });
  }

  // -> Promise<{ status: 'ok', ck } | { status: 'missing' | 'pending' | 'foreign' }>
  function unlockAdmin(keys, mkB64) {
    var p = find(keys, ADMIN_ID);
    if (!p) return Promise.resolve({ status: 'missing' });
    return aesKey(unb64(mkB64)).then(function (mk) { return open(mk, p.key, ADMIN_AAD); }).then(function (priv) {
      if (!isCurrent(keys, p)) return { status: 'pending' };
      return unwrap(p, priv).then(function (raw) { return { status: 'ok', ck: b64(raw) }; });
    }, function () { return { status: 'foreign' }; });
  }

  // ---------------------------------------------------------------- members (subscribers)
  function memberAad(id) { return 'dpw-member-v1:' + id; }

  function memberId(user) {
    return subtle().digest('SHA-256', enc.encode('dpw-member:' + normUser(user))).then(function (h) { return 'm-' + hex(new Uint8Array(h)).slice(0, 32); });
  }

  function userProblem(user) {
    return USER_RE.test(normUser(user)) ? '' : 'Usuario: 3-30 caracteres (letras, numeros, punto, guion o guion bajo).';
  }

  function makeMember(keys, user, password, exp) {
    return memberId(user).then(function (id) {
      var salt = rand(16);
      return Promise.all([newKeyPair(), passwordKey(password, salt, keys.kdf.iterations)]).then(function (r) {
        return seal(r[1], r[0].priv, memberAad(id)).then(function (box) {
          return { id: id, kind: 'member', pub: r[0].pub, key: { salt: b64(salt), iv: box.iv, ct: box.ct }, exp: exp, wrap: null };
        });
      });
    });
  }

  // Adds a subscriber, or replaces its slot (= new password, and a new content key) when `replace` is true.
  // -> Promise<{ keys, ck }> (ck changes when replacing: the caller must re-encrypt pools.enc)
  function putMember(keys, ckB64, user, password, exp, replace) {
    return Promise.resolve().then(function () {
      var problem = userProblem(user);
      if (problem) throw new Error(problem);
      if (!DATE_RE.test(exp || '')) throw new Error('Fecha de caducidad no valida.');
      return makeMember(keys, user, password, exp);
    }).then(function (p) {
      var exists = !!find(keys, p.id);
      if (exists && !replace) throw new Error('Ya existe el usuario ' + normUser(user) + '.');
      if (!exists && replace) throw new Error('No existe el usuario ' + normUser(user) + '.');
      var out = clone(keys);
      out.principals = out.principals.filter(function (x) { return x.id !== p.id; }).concat([p]);
      // A new password replaces the slot; the old one stays readable in the repo history, so the key changes too.
      return syncWraps(out, ckB64, [p.id]).then(function (k) { return replace ? rotate(k, ckB64) : { keys: k, ck: ckB64 }; });
    });
  }

  function setMemberExp(keys, id, exp) {
    if (!DATE_RE.test(exp || '')) throw new Error('Fecha de caducidad no valida.');
    var out = clone(keys), p = find(out, id);
    if (!p || p.kind !== 'member') throw new Error('Ese suscriptor ya no existe.');
    p.exp = exp;
    out.updated = now();
    return assertKeys(out);
  }

  // Removes subscribers and rotates the content key. -> Promise<{ keys, ck }> (caller re-encrypts pools.enc)
  function removeMembers(keys, ckB64, ids) {
    var out = clone(keys);
    out.principals = out.principals.filter(function (p) { return !(p.kind === 'member' && ids.indexOf(p.id) !== -1); });
    return rotate(out, ckB64);
  }

  // -> Promise<{ status: 'ok', ck, exp } | { status: 'expired', exp } | { status: 'wrong' } | { status: 'pending' }>
  function unlockMember(keys, user, password, today) {
    return memberId(user).then(function (id) {
      var p = find(keys, id);
      // Unknown users cost the same PBKDF2 time, so the response time does not tell which users exist.
      if (!p || p.kind !== 'member' || validateKeys(keys).length) {
        return passwordKey(String(password == null ? '' : password), rand(16), keys.kdf.iterations).then(function () { return { status: 'wrong' }; });
      }
      return passwordKey(String(password == null ? '' : password), unb64(p.key.salt), keys.kdf.iterations)
        .then(function (k) { return open(k, p.key, memberAad(id)); })
        .then(function (priv) {
          if (p.exp < today) return { status: 'expired', exp: p.exp };
          if (!isCurrent(keys, p)) return { status: 'pending' };
          return unwrap(p, priv).then(function (raw) { return { status: 'ok', ck: b64(raw), exp: p.exp }; });
        }, function () { return { status: 'wrong' }; });
    });
  }

  function members(keys) {
    return keys.principals.filter(function (p) { return p.kind === 'member'; }).map(function (p) { return { id: p.id, exp: p.exp }; });
  }

  // ---------------------------------------------------------------- member details (admins only)
  var META_AAD = 'dpw-meta-v1';

  // -> Promise<{ [id]: { user, email, note, created } }>
  function readMeta(keys, mkB64) {
    if (!keys.meta) return Promise.resolve({});
    return aesKey(unb64(mkB64)).then(function (mk) { return open(mk, keys.meta, META_AAD); }).then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }

  function writeMeta(keys, mkB64, meta) {
    var live = {};
    members(keys).forEach(function (m) { if (meta[m.id]) live[m.id] = meta[m.id]; });
    return aesKey(unb64(mkB64)).then(function (mk) { return seal(mk, enc.encode(JSON.stringify(live)), META_AAD); }).then(function (box) {
      var out = clone(keys);
      out.meta = box;
      out.updated = now();
      return assertKeys(out);
    });
  }

  // ---------------------------------------------------------------- cli principal (owner's PC)
  function newCli(id) {
    return newKeyPair().then(function (kp) {
      return { principal: { id: id, kind: 'cli', pub: kp.pub, key: null, wrap: null }, priv: b64(kp.priv) };
    });
  }

  // -> Promise<ckB64 | null (pending)>
  function unlockCli(keys, id, privB64) {
    var p = find(keys, id);
    if (!p) return Promise.reject(new Error('Este PC no tiene acceso a los enlaces (' + id + ' no esta en keys.json).'));
    if (!isCurrent(keys, p)) return Promise.resolve(null);
    return unwrap(p, unb64(privB64)).then(b64);
  }

  function addPrincipal(keys, principal) {
    var out = clone(keys);
    out.principals = out.principals.filter(function (p) { return p.id !== principal.id; }).concat([clone(principal)]);
    out.updated = now();
    return assertKeys(out);
  }

  return {
    VERSION: VERSION, ADMIN_ID: ADMIN_ID,
    normUser: normUser, userProblem: userProblem, memberId: memberId,
    validateKeys: validateKeys, assertKeys: assertKeys, find: find, pending: pending, syncWraps: syncWraps, authorised: authorised, create: create, rotate: rotate,
    encryptPools: encryptPools, decryptPools: decryptPools,
    hasAdmin: hasAdmin, registerAdmin: registerAdmin, unlockAdmin: unlockAdmin,
    putMember: putMember, setMemberExp: setMemberExp, removeMembers: removeMembers, unlockMember: unlockMember, members: members,
    readMeta: readMeta, writeMeta: writeMeta,
    newCli: newCli, unlockCli: unlockCli, addPrincipal: addPrincipal
  };
});
