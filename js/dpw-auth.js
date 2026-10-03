/* Login shared by pools.html and admin.html.
 * - Admins: verified against access.json (dpw-vault.js). Correct password = the publishing key is
 *   decrypted into this tab's session; admin passwords are not stored anywhere in plain text.
 * - Regular users: local list in localStorage (unchanged behaviour). They can never be admins. */
(function (root) {
  'use strict';

  var DEFAULT_USERS = [
    { user: 'prueba1', pass: 'prueba_1', role: 'user', active: true, created: '2026-09-15' },
    { user: 'demo', pass: 'demo123', role: 'user', active: true, created: '2026-09-01' }
  ];

  function readJson(storage, key, fallback) {
    try { var v = storage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }

  function getDeletedUsers() { return readJson(localStorage, 'dpw_deleted', []); }

  function addDeletedUser(username) {
    var deleted = getDeletedUsers();
    if (deleted.indexOf(username) === -1) {
      deleted.push(username);
      localStorage.setItem('dpw_deleted', JSON.stringify(deleted));
    }
  }

  // Old builds stored admin accounts (with plain passwords) here: they are dropped, admins live in access.json now.
  function getUsers() {
    var stored = readJson(localStorage, 'dpw_users', null);
    var users = (Array.isArray(stored) ? stored : []).filter(function (u) { return u && u.role !== 'admin'; });
    var deleted = getDeletedUsers();
    DEFAULT_USERS.forEach(function (def) {
      if (deleted.indexOf(def.user) === -1 && !users.some(function (u) { return u.user === def.user; })) users.push(Object.assign({}, def));
    });
    if (!Array.isArray(stored) || stored.length !== users.length) localStorage.setItem('dpw_users', JSON.stringify(users));
    return users;
  }

  function saveUsers(users) {
    localStorage.setItem('dpw_users', JSON.stringify(users.map(function (u) { return Object.assign({}, u, { role: 'user' }); })));
  }

  function getCurrentUser() {
    var s = readJson(sessionStorage, 'dpw_session', null);
    if (!s || !s.user) return null;
    // An admin session without its decrypted key is not an admin session (e.g. stale tab).
    if (s.role === 'admin' && !(root.DPWGitHub && root.DPWGitHub.hasToken())) return { user: s.user, role: 'user', stale: true };
    return s;
  }

  function setCurrentUser(user, role) {
    sessionStorage.setItem('dpw_session', JSON.stringify({ user: user, role: role }));
  }

  function logout() {
    sessionStorage.removeItem('dpw_session');
    if (root.DPWGitHub) root.DPWGitHub.clearSession();
  }

  var accessCache = null;
  function getAccess(force) {
    if (!accessCache || force) {
      accessCache = root.DPWGitHub.fetchAccessPublic().catch(function (err) { accessCache = null; throw err; });
    }
    return accessCache;
  }

  // -> Promise<{ ok, role?, user?, error? }>
  function login(username, password) {
    var name = String(username == null ? '' : username).trim();
    var pass = String(password == null ? '' : password);
    if (!name || !pass) return Promise.resolve({ ok: false, error: 'Escribe usuario y password' });
    return getAccess().then(function (access) { return { access: access }; }, function (err) { return { access: null, accessError: err }; })
      .then(function (r) {
        if (r.access && root.DPWVault.hasAdmin(r.access, name)) {
          return root.DPWVault.unlock(r.access, name, pass).then(function (k) {
            if (!k) return { ok: false, error: 'Usuario o password incorrectos' };
            root.DPWGitHub.setSession({ user: k.user, token: k.token, mk: k.mk });
            setCurrentUser(k.user, 'admin');
            return { ok: true, role: 'admin', user: k.user };
          });
        }
        var found = getUsers().filter(function (u) { return u.user === name && u.pass === pass && u.active; })[0];
        if (found) {
          if (root.DPWGitHub) root.DPWGitHub.clearSession();
          setCurrentUser(found.user, 'user');
          return { ok: true, role: 'user', user: found.user };
        }
        if (r.accessError) return { ok: false, error: 'No se pudo comprobar el usuario (sin conexion). Intentalo de nuevo.' };
        return { ok: false, error: 'Usuario o password incorrectos' };
      });
  }

  root.DPWAuth = {
    getUsers: getUsers, saveUsers: saveUsers, getDeletedUsers: getDeletedUsers, addDeletedUser: addDeletedUser,
    getCurrentUser: getCurrentUser, setCurrentUser: setCurrentUser, logout: logout, login: login, getAccess: getAccess
  };
})(typeof self !== 'undefined' ? self : this);
