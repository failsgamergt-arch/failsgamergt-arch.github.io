#!/usr/bin/env node
/* End-to-end test of pools.html + admin.html in headless Chrome against a SIMULATED GitHub (nothing real is
 * touched). Checks that links never appear in public files, that admins publish, that subscribers log in and see
 * links, that removed / expired subscribers cannot, and history restore.
 *   node tools/e2e-dpw.js            (needs Chrome + Python; serves the repo on http://localhost:8766) */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const DPW = require('../js/dpw-data.js');
const V = require('../js/dpw-vault.js');
const K = require('../js/dpw-keys.js');

const ROOT = path.join(__dirname, '..');
const PORT = 8766, DEBUG_PORT = 9334;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:' + PORT + '/';
const ADMIN = 'jefe', ADMIN_PASS = 'Mesa-Mezclas-2026x';
const URL1 = 'https://mega.nz/file/HuR3hQZK#bHlBxUmn8iAJNWTdkejmQPRFTBQljxyGfGbQecgF7XY';
const URL2 = 'https://mega.nz/file/W6wnBJrL#FrcnZwJWnIEHasM2hM8Bc8uzu20A1yefyaYeQ5t6k4g';
const URL3 = 'https://mega.nz/file/Zz9yXwVu#AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg';

let passed = 0;
function ok(cond, msg) { assert(cond, msg); passed++; console.log('  ok  ' + msg); }

// ---------------------------------------------------------------- fixture repo
async function fixture({ adminActive }) {
  let d = DPW.emptyData();
  d = DPW.addArtist(d, 'BPM SUPREME');
  d = DPW.addArtist(d, 'CLUB KILLERS');
  d = DPW.addEntries(d, [
    { date: '2026-09-02', artist: 'BPM SUPREME', url: URL1 },
    { date: '2026-09-01', artist: 'CLUB KILLERS', url: URL2 }
  ]).data;
  const vault = await V.create('github_pat_' + 'x'.repeat(40), [{ user: ADMIN, password: ADMIN_PASS }]);
  const cli = await K.newCli('cli-e2e');
  let { keys, ck } = await K.create([cli.principal]);
  if (adminActive) keys = await K.syncWraps(await K.registerAdmin(keys, vault.mk), ck, ['admins']);
  const box = await K.encryptPools(keys, ck, DPW.serialize(d));
  return {
    ck, kid: keys.kid,
    files: {
      'access.json': JSON.stringify(vault.access, null, 2) + '\n',
      'keys.json': JSON.stringify(keys, null, 2) + '\n',
      'pools.enc': JSON.stringify(box) + '\n',
      'pools.json': DPW.serialize(DPW.publicView(d))
    }
  };
}

// ---------------------------------------------------------------- simulated GitHub (runs inside the page)
function mockSource(initial) {
  return '(' + function (INITIAL) {
    const KEY = '__mockgh';
    if (!localStorage.getItem(KEY) || localStorage.getItem('__mockstamp') !== INITIAL.stamp) {
      localStorage.setItem(KEY, JSON.stringify({ head: 'c1', n: 1, commits: { c1: { tree: INITIAL.files, parents: [], message: 'init', date: new Date().toISOString() } } }));
      localStorage.setItem('__mockstamp', INITIAL.stamp);
    }
    const load = () => JSON.parse(localStorage.getItem(KEY));
    const save = s => localStorage.setItem(KEY, JSON.stringify(s));
    const b64 = t => { const b = new TextEncoder().encode(t); let s = ''; b.forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
    const unb64 = t => { const s = atob(t); return new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0))); };
    const hash = t => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return 'b' + h.toString(16) + t.length; };
    const json = (status, body) => new Response(body == null ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const realFetch = window.fetch.bind(window);
    window.__mockState = load;
    window.fetch = async function (input, init) {
      init = init || {};
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const s = load();
      if (url.pathname.indexOf('/dpw-data/') !== -1 && url.host === location.host) {
        const f = url.pathname.split('/dpw-data/')[1];
        const t = s.commits[s.head].tree[f];
        return t == null ? new Response('Not found', { status: 404 }) : new Response(t, { status: 200 });
      }
      if (url.host !== 'api.github.com') return realFetch(input, init);
      const method = (init.method || 'GET').toUpperCase();
      const headers = init.headers || {};
      const auth = !!headers.Authorization;
      const raw = String(headers.Accept || '').indexOf('raw') !== -1;
      const body = init.body ? JSON.parse(init.body) : null;
      const m = url.pathname.match(/^\/repos\/failsgamergt-arch\/dpw-data(\/.*)?$/);
      if (!m) return json(404, { message: 'Not Found' });
      const p = m[1] || '';
      const commit = (tree, message, parent) => {
        s.n++;
        const sha = 'c' + s.n;
        s.commits[sha] = { tree, parents: [parent], message, date: new Date(Date.now() + s.n * 1000).toISOString() };
        return sha;
      };
      if (method !== 'GET' && !auth) return json(401, { message: 'Requires authentication' });
      if (p === '' && method === 'GET') return json(200, { permissions: { push: auth } });
      if (p === '/git/ref/heads/main') return json(200, { object: { sha: s.head } });
      let r;
      if ((r = p.match(/^\/git\/commits\/(\w+)$/))) return s.commits[r[1]] ? json(200, { sha: r[1], tree: { sha: 't-' + r[1] } }) : json(404, { message: 'Not Found' });
      if (p === '/git/trees' && method === 'POST') {
        const baseTree = s.commits[body.base_tree.slice(2)].tree;
        const tree = Object.assign({}, baseTree);
        body.tree.forEach(e => { tree[e.path] = e.content; });
        s.trees = s.trees || {};
        const tid = 'n' + Object.keys(s.trees).length + '-' + Date.now();
        s.trees[tid] = tree;
        save(s);
        return json(201, { sha: tid });
      }
      if (p === '/git/commits' && method === 'POST') {
        const sha = commit(s.trees[body.tree], body.message, body.parents[0]);
        delete s.trees[body.tree];
        save(s);
        return json(201, { sha });
      }
      if (p === '/git/refs/heads/main' && method === 'PATCH') {
        if (s.commits[body.sha].parents[0] !== s.head) return json(422, { message: 'Update is not a fast forward' });
        s.head = body.sha;
        save(s);
        return json(200, { object: { sha: body.sha } });
      }
      if (p === '/commits') {
        const file = url.searchParams.get('path');
        const out = [];
        for (let c = s.head; c && s.commits[c]; c = s.commits[c].parents[0]) {
          const parent = s.commits[c].parents[0];
          if (!parent || s.commits[parent].tree[file] !== s.commits[c].tree[file]) {
            out.push({ sha: c, commit: { message: s.commits[c].message, author: { date: s.commits[c].date, name: 'mock' } }, html_url: '#' + c });
          }
        }
        return json(200, out);
      }
      if ((r = p.match(/^\/contents\/(.+)$/))) {
        const file = decodeURIComponent(r[1]);
        if (method === 'GET') {
          const ref = url.searchParams.get('ref') || 'main';
          const c = s.commits[ref === 'main' ? s.head : ref];
          if (!c || c.tree[file] == null) return json(404, { message: 'Not Found' });
          return raw ? new Response(c.tree[file], { status: 200 }) : json(200, { sha: hash(c.tree[file]), content: b64(c.tree[file]), encoding: 'base64' });
        }
        if (method === 'PUT') {
          const cur = s.commits[s.head].tree[file];
          if (cur != null && body.sha !== hash(cur)) return json(409, { message: 'sha mismatch' });
          const tree = Object.assign({}, s.commits[s.head].tree, { [file]: unb64(body.content) });
          s.head = commit(tree, body.message, s.head);
          save(s);
          return json(200, { commit: { sha: s.head } });
        }
      }
      return json(404, { message: 'mock: no implementado ' + method + ' ' + p });
    };
  } + ')(' + JSON.stringify(initial) + ');';
}

// ---------------------------------------------------------------- Chrome DevTools protocol
async function startChrome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpw-e2e-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DEBUG_PORT, '--user-data-dir=' + dir, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 50; i++) {
    try { list = await (await fetch('http://127.0.0.1:' + DEBUG_PORT + '/json/list')).json(); if (list.length) break; } catch (e) { /* starting */ }
    await new Promise(r => setTimeout(r, 200));
  }
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = {};
  const errors = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting[msg.id]) { waiting[msg.id](msg); delete waiting[msg.id]; }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception ? msg.params.exceptionDetails.exception.description : msg.params.exceptionDetails.text);
  };
  const send = (method, params) => new Promise(res => { const i = ++id; waiting[i] = res; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Page.enable');
  await send('Runtime.enable');
  return {
    errors,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error('evaluate: ' + (r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text) + '\n  en: ' + expr.slice(0, 120));
      return r.result.result.value;
    },
    async waitFor(expr, label, ms) {
      const end = Date.now() + (ms || 20000);
      for (;;) {
        let v;
        try { v = await this.eval(expr); } catch (e) { v = false; }
        if (v) return v;
        if (Date.now() > end) throw new Error('timeout esperando: ' + label);
        await new Promise(r => setTimeout(r, 150));
      }
    },
    async go(url) {
      await send('Page.navigate', { url });
      await this.waitFor('document.readyState === "complete" && !!window.DPW', 'cargar ' + url);
    },
    async inject(src) {
      if (this.injected) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.injected });
      this.injected = (await send('Page.addScriptToEvaluateOnNewDocument', { source: src })).result.identifier;
    },
    close() { try { ws.close(); } catch (e) { /* */ } proc.kill(); }
  };
}

// ---------------------------------------------------------------- helpers in the page
const MOCK = path => `window.__mockState().commits[window.__mockState().head].tree[${JSON.stringify(path)}]`;
async function adminLogin(c, user, pass) {
  await c.go(BASE + 'admin.html');
  await c.waitFor(`!document.getElementById('login-screen').classList.contains('hidden') || !document.getElementById('admin-panel').classList.contains('hidden')`, 'pantalla de login');
  if (await c.eval(`!document.getElementById('admin-panel').classList.contains('hidden')`)) { await c.eval('logout()'); await c.waitFor(`!document.getElementById('login-screen').classList.contains('hidden')`, 'login tras salir'); }
  await c.eval(`document.getElementById('l-user').value=${JSON.stringify(user)};document.getElementById('l-pass').value=${JSON.stringify(pass)};document.getElementById('login-screen').requestSubmit();true`);
  await c.waitFor(`!document.getElementById('admin-panel').classList.contains('hidden') && KEYSTATE.status !== 'unknown' && STATE.loaded`, 'entrar al panel', 40000);
}
async function confirmNext(c) { await c.waitFor(`!document.getElementById('confirm-modal').classList.contains('hidden')`, 'confirmacion'); await c.eval(`document.getElementById('confirm-ok').click();true`); }
async function busyDone(c) { await c.waitFor(`document.getElementById('busy').classList.contains('hidden')`, 'terminar guardado', 60000); }
async function createMember(c, user, exp) {
  await c.eval(`showTab('users');true`);
  await c.waitFor('MEMBERS.loaded', 'lista de suscriptores');
  await c.eval(`openMemberModal(null);document.getElementById('mm-user').value=${JSON.stringify(user)};document.getElementById('mm-email').value='${user}@example.com';${exp ? `document.getElementById('mm-exp').value='${exp}';` : ''}saveMember();true`);
  await c.waitFor(`!document.getElementById('cred-modal').classList.contains('hidden') || document.querySelector('#toasts')?.textContent.length > 0`, 'crear suscriptor', 60000);
  const text = await c.eval(`document.getElementById('cred-text').value`);
  await c.eval(`closeModalEl('cred-modal');true`);
  const pass = (text.match(/Contraseña: (.+)/) || [])[1];
  assert(pass, 'credenciales de ' + user + ': ' + text + ' / ' + await c.eval(`document.querySelector('#toasts').textContent`));
  return pass;
}
async function webLogin(c, user, pass) {
  await c.go(BASE + 'pools.html');
  await c.waitFor('MONTHS.length > 0', 'catalogo publico');
  await c.eval(`logout();showLoginModal();document.getElementById('login-user').value=${JSON.stringify(user)};document.getElementById('login-pass').value=${JSON.stringify(pass)};handleLogin({preventDefault(){}});true`);
  await c.waitFor(`!loginBusy`, 'login web', 40000);
  return c.eval(`document.getElementById('login-modal').classList.contains('hidden') ? 'OK' : document.getElementById('login-error').textContent`);
}
async function modalLinks(c, pool, date) {
  await c.eval(`showDownloadModal(${JSON.stringify(pool)}, ${JSON.stringify(date)});true`);
  await c.waitFor(`document.querySelectorAll('#dl-modal-links a[href^="https://mega.nz"]').length > 0 || /No hay enlaces|caducado|disponibles|Error/.test(document.getElementById('dl-modal-links').textContent)`, 'enlaces en el modal', 30000);
  return c.eval(`[...document.querySelectorAll('#dl-modal-links a[href^="https://mega.nz"]')].map(a => a.href)`);
}

// ---------------------------------------------------------------- run
async function main() {
  const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const c = await startChrome();
  try {
    // ===== scenario 1: first admin login after the migration (access pending until the CLI syncs)
    console.log('Escenario 1: admin pendiente');
    let fx = await fixture({ adminActive: false });
    await c.inject(mockSource({ files: fx.files, stamp: 's1' }));
    await adminLogin(c, ADMIN, ADMIN_PASS);
    ok(await c.eval(`KEYSTATE.status`) === 'pending', 'admin sin acceso queda PENDIENTE');
    ok(/pendiente de activar/.test(await c.eval(`document.getElementById('gh-banner').textContent`)), 'aviso de acceso pendiente en el panel');
    ok(await c.eval(`!!JSON.parse(${MOCK('keys.json')}).principals.find(p => p.id === 'admins' && !p.wrap)`), 'el admin queda registrado en keys.json (sin acceso aun)');
    ok(await c.eval(`!canWrite()`), 'sin acceso no puede publicar');
    // "keys-sync" from the owner's PC: done here with the content key of the fixture
    await c.eval(`(async () => { const s = window.__mockState(); const keys = JSON.parse(s.commits[s.head].tree['keys.json']); const next = await DPWKeys.syncWraps(keys, ${JSON.stringify(fx.ck)}, ['admins']); s.commits[s.head].tree['keys.json'] = JSON.stringify(next); localStorage.setItem('__mockgh', JSON.stringify(s)); return true; })()`);
    await adminLogin(c, ADMIN, ADMIN_PASS);
    ok(await c.eval(`KEYSTATE.status`) === 'ok' && await c.eval(`canWrite()`), 'tras keys-sync el admin entra con acceso y puede publicar');

    // ===== scenario 2: full flow
    console.log('Escenario 2: flujo completo');
    fx = await fixture({ adminActive: true });
    await c.inject(mockSource({ files: fx.files, stamp: 's2' }));
    await c.go(BASE + 'pools.html');
    await c.waitFor('MONTHS.length > 0', 'catalogo publico');
    ok(!(await c.eval(`JSON.stringify(DATA)`)).includes('mega.nz'), 'web publica: el catalogo cargado no tiene enlaces');
    ok(await c.eval(`document.querySelectorAll('[data-action=tab]').length`) >= 2, 'web publica: se pintan las pools');
    await c.eval(`logout();showDownloadModal('BPM SUPREME','2026-09-02');true`);
    ok(await c.eval(`!document.getElementById('dl-modal-noauth').classList.contains('hidden') && !document.querySelector('#dl-modal-links a[href^="https://mega"]')`), 'sin sesion: pide iniciar sesion y no hay enlaces');
    ok((await webLogin(c, 'demo', 'demo123')) !== 'OK', 'los usuarios de prueba antiguos (demo/demo123) ya no entran');

    await adminLogin(c, ADMIN, ADMIN_PASS);
    ok(await c.eval(`KEYSTATE.status`) === 'ok', 'admin con acceso a los enlaces');
    ok((await c.eval(`JSON.stringify(STATE.data)`)).includes(URL1), 'el panel ve los enlaces (descifrados)');
    const passA = await createMember(c, 'djprueba');
    ok(passA.length >= 12, 'suscriptor creado; contraseña generada mostrada una vez');
    const passB = await createMember(c, 'djdos');
    await createMember(c, 'djviejo', '2020-01-01');
    ok(await c.eval(`MEMBERS.list.length`) === 3, 'lista de suscriptores con 3');
    ok(/1/.test(await c.eval(`document.getElementById('stat-inactive').textContent`)), 'cuenta 1 caducado');
    const keysText = await c.eval(MOCK('keys.json'));
    ok(!/djprueba|example\.com/.test(keysText), 'keys.json no muestra nombres ni emails de suscriptores');

    await c.eval(`publish(fresh => DPW.addEntries(DPW.addArtist(fresh, 'LATIN BOX'), [{ date: '2026-09-03', artist: 'LATIN BOX', url: '${URL3}' }]).data, 'e2e subir', 'PUBLICANDO...');true`);
    await busyDone(c);
    const pub = await c.eval(MOCK('pools.json'));
    ok(pub.includes('Latin Box 03 09 2026') && !pub.includes('mega.nz'), 'al publicar: pools.json lleva el nombre nuevo y NINGUN enlace');
    ok(!(await c.eval(MOCK('pools.enc'))).includes('mega.nz'), 'pools.enc esta cifrado');
    ok(await c.eval(`(() => { const s = window.__mockState(); const c = s.commits[s.head], p = s.commits[c.parents[0]]; return c.tree['pools.json'] !== p.tree['pools.json'] && c.tree['pools.enc'] !== p.tree['pools.enc']; })()`), 'pools.json y pools.enc se guardan en el mismo commit');

    ok((await webLogin(c, 'djprueba', passA)) === 'OK', 'suscriptor entra en la web');
    ok(/ACTIVA HASTA/.test(await c.eval(`document.getElementById('user-dropdown').textContent`)), 'menu de cuenta muestra hasta cuando esta activa');
    let links = await modalLinks(c, 'LATIN BOX', '2026-09-03');
    ok(links.includes(URL3), 'suscriptor ve el enlace recien publicado');
    links = await modalLinks(c, 'BPM SUPREME', '2026-09-02');
    ok(links.includes(URL1), 'suscriptor ve enlaces antiguos');
    ok((await webLogin(c, 'djprueba', 'mala-clave-123')) !== 'OK', 'contraseña incorrecta no entra');
    const expired = await webLogin(c, 'djviejo', 'x');
    ok(expired !== 'OK', 'caducado con contraseña incorrecta no entra');

    // remove djprueba: key rotation
    await adminLogin(c, ADMIN, ADMIN_PASS);
    await c.eval(`showTab('users');true`);
    await c.waitFor('MEMBERS.loaded && MEMBERS.list.length === 3', 'lista');
    const kidBefore = JSON.parse(await c.eval(MOCK('keys.json'))).kid;
    await c.eval(`removeMembersFlow([MEMBERS.list.find(m => m.user === 'djprueba').id], 'QUITAR');true`);
    await confirmNext(c);
    await busyDone(c);
    const keysAfter = JSON.parse(await c.eval(MOCK('keys.json')));
    ok(keysAfter.kid !== kidBefore, 'al quitar un suscriptor cambia la clave de los enlaces');
    ok(JSON.parse(await c.eval(MOCK('pools.enc'))).kid === keysAfter.kid, 'pools.enc re-cifrado con la clave nueva en el mismo cambio');
    ok(await c.eval(`MEMBERS.list.length`) === 2 && await c.eval(`!MEMBERS.list.some(m => m.user === 'djprueba')`), 'djprueba ya no esta en la lista');
    await c.eval(`removeMembersFlow(MEMBERS.list.filter(m => m.exp < DPW.todayISO()).map(m => m.id), 'QUITAR CADUCADOS');true`);
    await confirmNext(c);
    await busyDone(c);
    ok(await c.eval(`MEMBERS.list.map(m => m.user).join()`) === 'djdos', 'QUITAR CADUCADOS deja solo a los activos');
    ok(await c.eval(`canWrite()`) && (await c.eval(`JSON.stringify(STATE.data)`)).includes(URL1), 'el admin sigue publicando tras el cambio de clave');

    ok((await webLogin(c, 'djprueba', passA)) !== 'OK', 'el suscriptor quitado ya no puede entrar');
    ok((await webLogin(c, 'djdos', passB)) === 'OK', 'el resto de suscriptores sigue entrando');
    links = await modalLinks(c, 'LATIN BOX', '2026-09-03');
    ok(links.includes(URL3), 'y ve los enlaces con la clave nueva');

    // history restore (version before "e2e subir")
    await adminLogin(c, ADMIN, ADMIN_PASS);
    const hist = await c.eval(`DPWGitHub.history(30)`);
    ok(hist.length >= 2, 'historial con varias versiones');
    const before = hist.find(h => h.message === 'init');
    await c.eval(`restoreVersion(${JSON.stringify(before.sha)}, 'init');true`);
    await confirmNext(c);
    await busyDone(c);
    ok(!(await c.eval(`JSON.stringify(STATE.data)`)).includes(URL3) && (await c.eval(`JSON.stringify(STATE.data)`)).includes(URL1), 'restaurar una version antigua (cifrada con la clave anterior) funciona');
    ok(!(await c.eval(MOCK('pools.json'))).includes('mega.nz'), 'tras restaurar, pools.json sigue sin enlaces');

    // admin on the public site
    ok((await webLogin(c, ADMIN, ADMIN_PASS)) === 'OK', 'el admin entra tambien en la web');
    links = await modalLinks(c, 'BPM SUPREME', '2026-09-02');
    ok(links.includes(URL1), 'y ve los enlaces');

    const errs = c.errors.filter(e => !/tailwind|favicon/i.test(e));
    ok(errs.length === 0, 'sin errores JavaScript en las paginas' + (errs.length ? ': ' + errs.join(' | ') : ''));
    console.log('\n' + passed + ' comprobaciones OK');
  } finally {
    c.close();
    server.kill();
  }
}

main().catch(e => { console.error('\nFALLO: ' + e.message); process.exitCode = 1; process.exit(1); });
