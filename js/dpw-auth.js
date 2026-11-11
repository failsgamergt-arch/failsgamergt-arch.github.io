/* Login shared by pools.html and admin.html. Nothing is checked against data stored in the browser:
 * - Admins: their slot in access.json (dpw-vault.js). The right password decrypts the publishing key and the
 *   content key of the links into this tab's session.
 * - Subscribers: their slot in keys.json (dpw-keys.js), created by an admin. Works on any device; the right
 *   password decrypts the content key, which is what opens the download links (pools.enc).
 * Plain passwords are never stored anywhere. */
(function (root) {
  'use strict';

  var SESSION = 'dpw_session';

  // Old builds kept download users with plain passwords in localStorage: wipe them.
  try { localStorage.removeItem('dpw_users'); localStorage.removeItem('dpw_deleted'); } catch (e) { /* ignore */ }

  function readSession() {
    try { var v = sessionStorage.getItem(SESSION); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  function getCurrentUser() {
    var s = readSession();
    if (!s || !s.user) return null;
    // A session without its decrypted keys is not a session (e.g. a tab restored by the browser).
    if (s.role === 'admin' && !root.DPWGitHub.hasToken()) return null;
    if (s.role === 'user' && !root.DPWGitHub.getCk()) return null;
    return s;
  }

  function setCurrentUser(user, role, extra) {
    sessionStorage.setItem(SESSION, JSON.stringify(Object.assign({ user: user, role: role }, extra || {})));
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
    root.DPWGitHub.clearSession();
  }

  var accessCache = null;
  function getAccess(force) {
    if (!accessCache || force) {
      accessCache = root.DPWGitHub.fetchAccessPublic().catch(function (err) { accessCache = null; throw err; });
    }
    return accessCache;
  }

  function today() { return root.DPW.todayISO(); }

  function loginAdmin(access, name, pass) {
    return root.DPWVault.unlock(access, name, pass).then(function (k) {
      if (!k) return { ok: false, error: 'Usuario o contraseña incorrectos' };
      root.DPWGitHub.clearSession();
      root.DPWGitHub.setSession({ user: k.user, token: k.token, mk: k.mk });
      setCurrentUser(k.user, 'admin');
      // Content key for the links: best effort (the admin panel finishes the setup when it is pending).
      return root.DPWGitHub.fetchKeysPublic().then(function (keys) {
        if (!keys) return;
        return root.DPWKeys.unlockAdmin(keys, k.mk).then(function (r) { if (r.status === 'ok') root.DPWGitHub.setCk(r.ck, keys.kid); });
      }).catch(function () { /* the panel retries */ }).then(function () {
        return { ok: true, role: 'admin', user: k.user };
      });
    });
  }

  function loginMember(name, pass) {
    return root.DPWGitHub.fetchKeysPublic().then(function (keys) {
      if (!keys) return { ok: false, error: 'Usuario o contraseña incorrectos' };
      return root.DPWKeys.unlockMember(keys, name, pass, today()).then(function (r) {
        if (r.status === 'wrong') return { ok: false, error: 'Usuario o contraseña incorrectos' };
        if (r.status === 'expired') return { ok: false, error: 'Tu suscripcion caduco el ' + root.DPW.formatDate(r.exp) + '. Renuevala para seguir descargando (djpoolworld@gmail.com).' };
        if (r.status === 'pending') return { ok: false, error: 'Tu cuenta se esta activando. Prueba de nuevo en unos minutos.' };
        root.DPWGitHub.clearSession();
        root.DPWGitHub.setCk(r.ck, keys.kid);
        var user = root.DPWKeys.normUser(name);
        setCurrentUser(user, 'user', { exp: r.exp });
        return { ok: true, role: 'user', user: user, exp: r.exp };
      });
    });
  }

  // -> Promise<{ ok, role?, user?, error? }>
  function login(username, password) {
    var name = String(username == null ? '' : username).trim();
    var pass = String(password == null ? '' : password);
    if (!name || !pass) return Promise.resolve({ ok: false, error: 'Escribe usuario y contraseña' });
    return getAccess().then(function (access) { return { access: access }; }, function (err) { return { access: null, accessError: err }; })
      .then(function (r) {
        if (r.access && root.DPWVault.hasAdmin(r.access, name)) return loginAdmin(r.access, name, pass);
        return loginMember(name, pass).catch(function (err) {
          return { ok: false, error: r.accessError ? 'No se pudo comprobar el usuario (sin conexion). Intentalo de nuevo.' : err.message };
        });
      });
  }

  root.DPWAuth = {
    getCurrentUser: getCurrentUser, setCurrentUser: setCurrentUser, logout: logout, login: login, getAccess: getAccess
  };
})(typeof self !== 'undefined' ? self : this);
