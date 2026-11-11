/* Publishing through the GitHub REST API (browser only).
 * Data lives in the separate repo "dpw-data", published by GitHub Pages at /dpw-data/:
 *   pools.json  public catalogue (days, artists, file names) - NO download links
 *   pools.enc   full data with the MEGA links, encrypted (js/dpw-keys.js)
 *   keys.json   who can decrypt pools.enc (admins, subscribers, owner's PC)
 *   access.json admin accounts + encrypted publishing key (js/dpw-vault.js)
 * pools.json and pools.enc are always written together in ONE commit (Git Data API), on top of the commit
 * they were read from, so a concurrent change by another admin is detected (422) and retried on fresh data.
 * The publishing key and the decrypted content key live in sessionStorage for the current tab only. */
(function (root) {
  'use strict';
  var DPW = root.DPW;
  var CFG = { owner: 'failsgamergt-arch', repo: 'dpw-data', branch: 'main', pools: 'pools.json', enc: 'pools.enc', keys: 'keys.json', access: 'access.json' };
  var SESSION_KEY = 'dpw_pub';
  var CK_KEY = 'dpw_ck';
  var API = 'https://api.github.com';

  // ---------------------------------------------------------------- session (decrypted keys)
  function readSession(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function session() { return readSession(SESSION_KEY); }
  function setSession(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: s.user, token: s.token, mk: s.mk })); }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(CK_KEY); } catch (e) { /* ignore */ }
  }
  function getToken() { var s = session(); return (s && s.token) || ''; }
  function hasToken() { return !!getToken(); }

  // Content key that opens pools.enc (admins and subscribers).
  function getCk() { return readSession(CK_KEY); }
  function setCk(ck, kid) { sessionStorage.setItem(CK_KEY, JSON.stringify({ ck: ck, kid: kid })); }
  function clearCk() { try { sessionStorage.removeItem(CK_KEY); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- utils
  function b64encodeUtf8(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decodeUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function apiError(res, body) {
    var msg = (body && body.message) || ('HTTP ' + res.status);
    var e;
    if (res.status === 401) e = new Error('La llave de publicacion ya no funciona (caducada o borrada en GitHub). El dueño de la cuenta debe renovarla en ADMINS → LLAVE DE PUBLICACION.');
    else if (res.status === 403 && /rate limit/i.test(msg)) e = new Error('GitHub ha limitado las peticiones. Espera unos minutos y vuelve a intentarlo.');
    else if (res.status === 403) e = new Error('La llave de publicacion no tiene permiso de escritura en ' + CFG.repo + ' (' + msg + ').');
    else e = new Error('GitHub: ' + msg);
    e.status = res.status;
    return e;
  }

  // token: undefined = session key, null = anonymous, string = explicit key
  function request(method, url, body, opts) {
    opts = opts || {};
    var token = opts.token === undefined ? getToken() : opts.token;
    if (opts.token === undefined && !token) return Promise.reject(new Error('Sesion de admin caducada: vuelve a iniciar sesion.'));
    var headers = { 'Accept': opts.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(API + url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .then(function (res) {
        if (opts.allow404 && res.status === 404) return null;
        if (opts.accept && opts.accept.indexOf('raw') !== -1 && res.ok) return res.text();
        return res.text().then(function (t) {
          var json = null;
          try { json = t ? JSON.parse(t) : null; } catch (e) { json = null; }
          if (!res.ok) throw apiError(res, json);
          return json;
        });
      });
  }

  function repoPath(suffix) { return '/repos/' + CFG.owner + '/' + CFG.repo + suffix; }
  function contentsUrl(path, ref) { return repoPath('/contents/' + path + '?ref=' + encodeURIComponent(ref || CFG.branch)); }

  // -> { sha, text } or null (404 with opts.allow404)
  function readFile(path, ref, opts) {
    opts = opts || {};
    return request('GET', contentsUrl(path, ref), null, { token: opts.token, allow404: opts.allow404 }).then(function (meta) {
      if (!meta) return null;
      if (meta.content && meta.encoding === 'base64') return { sha: meta.sha, text: b64decodeUtf8(meta.content) };
      return request('GET', contentsUrl(path, ref), null, { token: opts.token, accept: 'application/vnd.github.raw+json' })
        .then(function (text) { return { sha: meta.sha, text: text }; });
    });
  }

  function putFile(path, text, sha, message, token) {
    var body = { message: message, content: b64encodeUtf8(text), branch: CFG.branch };
    if (sha) body.sha = sha;
    return request('PUT', repoPath('/contents/' + path), body, { token: token });
  }

  function headSha() {
    return request('GET', repoPath('/git/ref/heads/' + CFG.branch)).then(function (r) { return r.object.sha; });
  }

  // Several files in ONE commit on top of `parent`. files: { path: text }. 422 if the branch moved meanwhile.
  function writeFiles(parent, files, message) {
    return request('GET', repoPath('/git/commits/' + parent)).then(function (c) {
      var tree = Object.keys(files).map(function (p) { return { path: p, mode: '100644', type: 'blob', content: files[p] }; });
      return request('POST', repoPath('/git/trees'), { base_tree: c.tree.sha, tree: tree });
    }).then(function (t) {
      return request('POST', repoPath('/git/commits'), { message: message, tree: t.sha, parents: [parent] });
    }).then(function (c) {
      return request('PATCH', repoPath('/git/refs/heads/' + CFG.branch), { sha: c.sha, force: false }).then(function () { return c; });
    });
  }

  function parseKeys(text) {
    var k;
    try { k = JSON.parse(text); } catch (e) { throw new Error('keys.json no es JSON valido'); }
    return root.DPWKeys.assertKeys(k);
  }

  // Everything at one commit (the head when ref is omitted).
  function snapshot(ref) {
    return (ref ? Promise.resolve(ref) : headSha()).then(function (head) {
      return Promise.all([
        readFile(CFG.keys, head, { allow404: true }),
        readFile(CFG.enc, head, { allow404: true }),
        readFile(CFG.pools, head, { allow404: true })
      ]).then(function (r) {
        return { head: head, keys: r[0] ? parseKeys(r[0].text) : null, encText: r[1] ? r[1].text : null, poolsText: r[2] ? r[2].text : null };
      });
    });
  }

  function lockedError() {
    var e = new Error('Tu acceso a los enlaces todavia no esta activado. Avisa a Claude (o al dueño) para que lo active con "node tools/pools-cli.js keys-sync" y vuelve a entrar.');
    e.code = 'LOCKED';
    return e;
  }

  // Content key matching `keys`. Admins re-derive it when another admin rotated the key meanwhile.
  function contentKey(keys) {
    var c = getCk();
    if (c && c.kid === keys.kid) return Promise.resolve(c.ck);
    var s = session();
    if (!s || !s.mk) return Promise.reject(lockedError());
    return root.DPWKeys.unlockAdmin(keys, s.mk).then(function (r) {
      if (r.status !== 'ok') throw lockedError();
      setCk(r.ck, keys.kid);
      return r.ck;
    });
  }

  function decodeData(text) {
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { return { data: DPW.emptyData(), broken: true, repaired: false, errors: ['JSON mal formado'] }; }
    var check = DPW.validate(parsed);
    return { data: check.ok ? parsed : DPW.sanitize(parsed), broken: false, repaired: !check.ok, errors: check.errors };
  }

  // ---------------------------------------------------------------- pools (full data, decrypted)
  // Lenient: a hand-edited file with errors loads its valid part (the next save repairs it);
  // an unparseable one loads as broken=true so only a restore can overwrite it.
  // legacy=true: links not protected yet (no keys.json / pools.enc): read-only until migrated.
  function load() {
    return snapshot().then(function (s) {
      if (!s.keys || !s.encText) {
        if (!s.poolsText) throw new Error('No se encontraron los datos de las pools en GitHub.');
        return Object.assign({ head: s.head, keys: null, legacy: true }, decodeData(s.poolsText));
      }
      return contentKey(s.keys).then(function (ck) {
        return root.DPWKeys.decryptPools(s.keys, ck, JSON.parse(s.encText));
      }).then(function (text) {
        return Object.assign({ head: s.head, keys: s.keys, legacy: false }, decodeData(text));
      });
    });
  }

  function encodeFiles(keys, ck, data) {
    var full = DPW.serialize(data);
    var pub = DPW.publicView(data);
    DPW.assertValid(pub, { public: true });
    return root.DPWKeys.encryptPools(keys, ck, full).then(function (box) {
      var files = {};
      files[CFG.enc] = JSON.stringify(box) + '\n';
      files[CFG.pools] = DPW.serialize(pub);
      return files;
    });
  }

  function retryable(err) { return err.status === 409 || err.status === 422; }

  // mutate(freshData) -> newData (may throw a user-facing Error). Returns { data, commit, unchanged }.
  function commit(mutate, message, opts, attempt) {
    opts = opts || {};
    attempt = attempt || 1;
    return load().then(function (current) {
      if (current.legacy) throw new Error('Los enlaces todavia no estan protegidos (migracion pendiente): no se puede publicar hasta terminarla.');
      if (current.broken && !opts.allowBroken) {
        throw new Error('El archivo de pools en GitHub esta dañado (no es JSON valido). Ve a HISTORIAL y restaura la ultima version buena.');
      }
      var next = DPW.touch(mutate(DPW.clone(current.data)));
      DPW.assertValid(next);
      if (!current.broken && !current.repaired && DPW.serialize(next) === DPW.serialize(DPW.touch(current.data, next.updated))) {
        return { data: current.data, commit: null, unchanged: true };
      }
      return contentKey(current.keys).then(function (ck) { return encodeFiles(current.keys, ck, next); })
        .then(function (files) { return writeFiles(current.head, files, message); })
        .then(function (c) { return { data: JSON.parse(DPW.serialize(next)), commit: c, unchanged: false }; });
    }).catch(function (err) {
      if (retryable(err) && attempt < 4) return commit(mutate, message, opts, attempt + 1);
      throw err;
    });
  }

  function history(limit) {
    return request('GET', repoPath('/commits?path=' + encodeURIComponent(CFG.enc) + '&sha=' + CFG.branch + '&per_page=' + (limit || 25)))
      .then(function (list) {
        return (list || []).map(function (c) {
          return {
            sha: c.sha,
            short: c.sha.slice(0, 7),
            message: (c.commit && c.commit.message || '').split('\n')[0],
            date: c.commit && c.commit.author ? c.commit.author.date : '',
            author: (c.author && c.author.login) || (c.commit && c.commit.author && c.commit.author.name) || '',
            url: c.html_url
          };
        });
      });
  }

  // Old pools.enc versions are opened with the CURRENT keys (older content keys are kept in keys.history).
  function restore(sha, message) {
    return Promise.all([snapshot(), readFile(CFG.enc, sha)]).then(function (r) {
      var cur = r[0];
      if (!cur.keys) throw new Error('Los enlaces todavia no estan protegidos (migracion pendiente).');
      return contentKey(cur.keys).then(function (ck) { return root.DPWKeys.decryptPools(cur.keys, ck, JSON.parse(r[1].text)); });
    }).then(function (text) {
      var old = decodeData(text);
      if (old.broken) throw new Error('Esa version tampoco es JSON valido; elige otra.');
      return commit(function () { return old.data; }, message || ('admin: restaurar version ' + sha.slice(0, 7)), { allowBroken: true });
    });
  }

  // ---------------------------------------------------------------- keys.json (who can open the links)
  function loadKeys() { return snapshot(); }

  // mutate(keys, currentCk|null) -> Promise<{ keys, ck? }>. Returning ck (a rotation) re-encrypts pools.enc
  // in the same commit. currentCk is null while this admin's access to the links is still pending.
  function commitKeys(mutate, message, attempt) {
    attempt = attempt || 1;
    var rotated = null;
    return snapshot().then(function (s) {
      if (!s.keys) throw new Error('Los enlaces todavia no estan protegidos (migracion pendiente).');
      return contentKey(s.keys).then(null, function (err) { if (err.code === 'LOCKED') return null; throw err; }).then(function (ck) {
        return mutate(JSON.parse(JSON.stringify(s.keys)), ck);
      }).then(function (r) {
        root.DPWKeys.assertKeys(r.keys);
        var files = {};
        files[CFG.keys] = JSON.stringify(r.keys, null, 2) + '\n';
        if (!r.ck) return writeFiles(s.head, files, message).then(function () { return r; });
        rotated = r;
        return contentKey(s.keys).then(function (oldCk) { return root.DPWKeys.decryptPools(s.keys, oldCk, JSON.parse(s.encText)); })
          .then(function (text) { return root.DPWKeys.encryptPools(r.keys, r.ck, text); })
          .then(function (box) { files[CFG.enc] = JSON.stringify(box) + '\n'; return writeFiles(s.head, files, message); })
          .then(function () { setCk(r.ck, r.keys.kid); return r; });
      });
    }).catch(function (err) {
      if (retryable(err) && attempt < 4) return commitKeys(mutate, message, attempt + 1);
      throw err;
    }).then(function (r) { return r.keys; }, function (err) { if (rotated) clearCk(); throw err; });
  }

  // ---------------------------------------------------------------- public reads (no key needed)
  // GitHub API first (always fresh); if it is unavailable or rate limited (60/h per IP), the Pages copy.
  // Resolves null ONLY when the file does not exist.
  function fetchPublic(path, label) {
    var apiFailure = null;
    return request('GET', contentsUrl(path), null, { token: null, allow404: true, accept: 'application/vnd.github.raw+json' })
      .then(null, function (err) {
        apiFailure = err;
        return fetch('dpw-data/' + path + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error('No se pudo comprobar ' + label + ': ' + (apiFailure.message || 'sin conexion con GitHub.'));
          return r.text();
        }, function () {
          throw new Error('No se pudo comprobar ' + label + ' (sin conexion). Intentalo de nuevo.');
        });
      });
  }

  function fetchKeysPublic() {
    return fetchPublic(CFG.keys, 'el acceso').then(function (text) { return text == null ? null : parseKeys(text); });
  }

  // pools.enc is large: the Pages copy first (no API quota), the API if Pages does not have it yet.
  function fetchEncPublic() {
    return fetch('dpw-data/' + CFG.enc + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(null, function () {
      return fetchPublic(CFG.enc, 'los enlaces').then(function (text) {
        if (text == null) throw new Error('No se encontraron los enlaces.');
        return JSON.parse(text);
      });
    });
  }

  // ---------------------------------------------------------------- access.json (admins + encrypted key)
  function parseAccess(text) {
    var a;
    try { a = JSON.parse(text); } catch (e) { throw new Error('access.json no es JSON valido'); }
    return root.DPWVault.assertAccess(a);
  }

  // Resolves null ONLY when GitHub says the file does not exist (publishing never activated);
  // any other problem rejects, so the setup screen is never shown by mistake.
  function fetchAccessPublic() {
    return fetchPublic(CFG.access, 'el acceso de administrador').then(function (text) { return text == null ? null : parseAccess(text); });
  }

  function loadAccess() {
    return readFile(CFG.access).then(function (r) { return { sha: r.sha, access: parseAccess(r.text) }; });
  }

  // mutate(access) -> Promise<newAccess>
  function commitAccess(mutate, message, attempt) {
    attempt = attempt || 1;
    return loadAccess().then(function (cur) {
      return Promise.resolve(mutate(JSON.parse(JSON.stringify(cur.access)))).then(function (next) {
        root.DPWVault.assertAccess(next);
        return putFile(CFG.access, JSON.stringify(next, null, 2) + '\n', cur.sha, message).then(function () { return next; });
      });
    }).catch(function (err) {
      if (retryable(err) && attempt < 4) return commitAccess(mutate, message, attempt + 1);
      throw err;
    });
  }

  // Replacing the key: written with the NEW key, which proves it works before anything is saved.
  function commitAccessWithToken(next, token, message) {
    root.DPWVault.assertAccess(next);
    return readFile(CFG.access, null, { token: token }).then(function (cur) {
      return putFile(CFG.access, JSON.stringify(next, null, 2) + '\n', cur.sha, message, token);
    });
  }

  // First-time setup: the key is checked against the data repo and access.json must not exist yet.
  function checkKey(token) {
    return request('GET', repoPath(''), null, { token: token }).then(function (repo) {
      if (!repo.permissions || !(repo.permissions.push || repo.permissions.admin)) {
        throw new Error('Esa llave no tiene permiso de escritura en ' + CFG.owner + '/' + CFG.repo + '. Revisa que elegiste el repo "' + CFG.repo + '" y "Contents: Read and write".');
      }
      return true;
    }, function (err) {
      if (err.status === 404) throw new Error('Esa llave no tiene acceso al repo ' + CFG.owner + '/' + CFG.repo + '. Al crearla elige "Only select repositories" → ' + CFG.repo + '.');
      if (err.status === 401) throw new Error('GitHub no reconoce esa llave. Copiala de nuevo (empieza por github_pat_).');
      throw err;
    });
  }

  function createAccess(access, token) {
    return readFile(CFG.access, null, { token: token, allow404: true }).then(function (existing) {
      if (existing) throw new Error('La publicacion ya esta activada. Inicia sesion con tu usuario de admin.');
      return putFile(CFG.access, JSON.stringify(access, null, 2) + '\n', null, 'setup: activar publicacion desde el panel admin', token);
    });
  }

  root.DPWGitHub = {
    CFG: CFG, session: session, setSession: setSession, clearSession: clearSession, getToken: getToken, hasToken: hasToken,
    getCk: getCk, setCk: setCk, clearCk: clearCk,
    load: load, commit: commit, history: history, restore: restore,
    loadKeys: loadKeys, commitKeys: commitKeys, fetchKeysPublic: fetchKeysPublic, fetchEncPublic: fetchEncPublic,
    fetchAccessPublic: fetchAccessPublic, loadAccess: loadAccess, commitAccess: commitAccess, commitAccessWithToken: commitAccessWithToken,
    checkKey: checkKey, createAccess: createAccess,
    _b64encodeUtf8: b64encodeUtf8, _b64decodeUtf8: b64decodeUtf8
  };
})(typeof self !== 'undefined' ? self : this);
