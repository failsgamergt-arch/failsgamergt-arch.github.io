/* Publishing through the GitHub REST API (browser only).
 * Data lives in the separate repo "dpw-data" (pools.json + access.json), published by GitHub Pages at
 * /dpw-data/. The publishing key only has access to that repo, so it can never touch the site's code.
 * The key is never typed by admins: it is decrypted at login from access.json (see dpw-vault.js) and
 * kept in sessionStorage for the current tab only. */
(function (root) {
  'use strict';
  var DPW = root.DPW;
  var CFG = { owner: 'failsgamergt-arch', repo: 'dpw-data', branch: 'main', pools: 'pools.json', access: 'access.json' };
  var SESSION_KEY = 'dpw_pub';
  var API = 'https://api.github.com';

  // ---------------------------------------------------------------- session (decrypted key)
  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function setSession(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: s.user, token: s.token, mk: s.mk })); }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }
  function getToken() { var s = session(); return (s && s.token) || ''; }
  function hasToken() { return !!getToken(); }

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
  function contentsUrl(path, ref) { return repoPath('/contents/' + path + (ref ? '?ref=' + encodeURIComponent(ref) : '?ref=' + CFG.branch)); }

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

  // ---------------------------------------------------------------- pools.json
  // Lenient: a hand-edited file with errors loads its valid part (the next save repairs it);
  // an unparseable file loads as broken=true so only a restore can overwrite it.
  function load(ref) {
    return readFile(CFG.pools, ref).then(function (r) {
      var parsed = null, broken = false;
      try { parsed = JSON.parse(r.text); } catch (e) { broken = true; }
      if (broken) return { sha: r.sha, text: r.text, data: DPW.emptyData(), broken: true, repaired: false, errors: ['JSON mal formado'] };
      var check = DPW.validate(parsed);
      return { sha: r.sha, text: r.text, data: check.ok ? parsed : DPW.sanitize(parsed), broken: false, repaired: !check.ok, errors: check.errors };
    });
  }

  // mutate(freshData) -> newData (may throw a user-facing Error). Returns { data, commit, unchanged }.
  function commit(mutate, message, opts, attempt) {
    opts = opts || {};
    attempt = attempt || 1;
    return load().then(function (current) {
      if (current.broken && !opts.allowBroken) {
        throw new Error('El archivo de pools en GitHub esta dañado (no es JSON valido). Ve a HISTORIAL y restaura la ultima version buena.');
      }
      var next = DPW.touch(mutate(DPW.clone(current.data)));
      DPW.assertValid(next);
      var text = DPW.serialize(next);
      if (!current.broken && !current.repaired && text === DPW.serialize(DPW.touch(current.data, next.updated))) {
        return { data: current.data, commit: null, unchanged: true };
      }
      return putFile(CFG.pools, text, current.sha, message).then(function (res) {
        return { data: JSON.parse(text), commit: res && res.commit ? res.commit : null, unchanged: false };
      });
    }).catch(function (err) {
      if ((err.status === 409 || err.status === 422) && attempt < 4) return commit(mutate, message, opts, attempt + 1);
      throw err;
    });
  }

  function history(limit) {
    return request('GET', repoPath('/commits?path=' + encodeURIComponent(CFG.pools) + '&sha=' + CFG.branch + '&per_page=' + (limit || 25)))
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

  function restore(sha, message) {
    return load(sha).then(function (old) {
      if (old.broken) throw new Error('Esa version tampoco es JSON valido; elige otra.');
      return commit(function () { return old.data; }, message || ('admin: restaurar version ' + sha.slice(0, 7)), { allowBroken: true });
    });
  }

  // ---------------------------------------------------------------- access.json (admins + encrypted key)
  function parseAccess(text) {
    var a;
    try { a = JSON.parse(text); } catch (e) { throw new Error('access.json no es JSON valido'); }
    return root.DPWVault.assertAccess(a);
  }

  // Public read used at login (no key yet). Resolves null ONLY when GitHub says the file does not exist
  // (publishing never activated); any other problem rejects, so the setup screen is never shown by mistake.
  function fetchAccessPublic() {
    var apiFailure = null;
    return request('GET', contentsUrl(CFG.access), null, { token: null, allow404: true, accept: 'application/vnd.github.raw+json' })
      .then(function (text) { return text == null ? null : parseAccess(text); }, function (err) {
        apiFailure = err;
        // API unavailable or rate limited (60/h per IP): use the Pages copy (may lag ~1 min behind).
        return fetch('dpw-data/' + CFG.access + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
          if (!r.ok) throw new Error('No se pudo comprobar el acceso de administrador: ' + (apiFailure.message || 'sin conexion con GitHub.'));
          return r.text().then(parseAccess);
        }, function () {
          throw new Error('No se pudo comprobar el acceso de administrador (sin conexion). Intentalo de nuevo.');
        });
      });
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
      if ((err.status === 409 || err.status === 422) && attempt < 4) return commitAccess(mutate, message, attempt + 1);
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
    load: load, commit: commit, history: history, restore: restore,
    fetchAccessPublic: fetchAccessPublic, loadAccess: loadAccess, commitAccess: commitAccess, commitAccessWithToken: commitAccessWithToken,
    checkKey: checkKey, createAccess: createAccess,
    _b64encodeUtf8: b64encodeUtf8, _b64decodeUtf8: b64decodeUtf8
  };
})(typeof self !== 'undefined' ? self : this);
