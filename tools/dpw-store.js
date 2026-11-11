/* Node access to the live data repo (failsgamergt-arch/dpw-data) for the owner's PC, through the GitHub CLI.
 * The download links are encrypted (pools.enc, see js/dpw-keys.js). This PC opens them with its own private key,
 * kept OUTSIDE the repo in ~/.dpw/cli-key.json (or $DPW_CLI_KEY). Never commit or share that file.
 *   const store = require('./dpw-store');
 *   const { data, save } = await store.open();        // full data, with links
 *   await save(DPW.addEntries(data, rows).data, 'publicar octubre');  // writes pools.enc + pools.json in one commit
 * Used by tools/pools-cli.js and the monthly publish scripts. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const DPW = require('../js/dpw-data.js');
const DPWKeys = require('../js/dpw-keys.js');

const REPO = 'failsgamergt-arch/dpw-data';
const BRANCH = 'main';
const FILES = { pools: 'pools.json', enc: 'pools.enc', keys: 'keys.json', access: 'access.json' };
const GH_CANDIDATES = [process.env.DPW_GH, 'C:/Program Files/GitHub CLI/gh.exe', 'gh'].filter(Boolean);
const KEY_FILE = process.env.DPW_CLI_KEY || path.join(os.homedir(), '.dpw', 'cli-key.json');

function gh(args, input) {
  let lastErr;
  for (const bin of GH_CANDIDATES) {
    if (bin.includes('/') && !fs.existsSync(bin)) continue;
    try {
      return execFileSync(bin, args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      if (e.code === 'ENOENT') { lastErr = e; continue; }
      const msg = String(e.stderr || e.message).trim();
      const err = new Error('GitHub: ' + msg.split('\n').slice(-3).join(' '));
      err.status = (/HTTP (\d{3})/.exec(msg) || [])[1] | 0;
      throw err;
    }
  }
  throw new Error('No encuentro el GitHub CLI (gh). Instalalo y haz "gh auth login". ' + (lastErr ? lastErr.message : ''));
}

function api(method, url, body) {
  const args = ['api', '-X', method, 'repos/' + REPO + url];
  if (body) args.push('--input', '-');
  const out = gh(args, body ? JSON.stringify(body) : undefined);
  return out ? JSON.parse(out) : null;
}

function readAt(file, ref) {
  try { return gh(['api', 'repos/' + REPO + '/contents/' + file + '?ref=' + ref, '-H', 'Accept: application/vnd.github.raw']); }
  catch (e) { if (e.status === 404 || /Not Found/i.test(e.message)) return null; throw e; }
}

function headSha() { return api('GET', '/git/ref/heads/' + BRANCH).object.sha; }

// Several files in ONE commit on top of `parent` (fails if someone else published meanwhile).
function writeFiles(parent, files, message) {
  const base = api('GET', '/git/commits/' + parent).tree.sha;
  const tree = api('POST', '/git/trees', { base_tree: base, tree: Object.keys(files).map(p => ({ path: p, mode: '100644', type: 'blob', content: files[p] })) });
  const commit = api('POST', '/git/commits', { message, tree: tree.sha, parents: [parent] });
  try {
    api('PATCH', '/git/refs/heads/' + BRANCH, { sha: commit.sha, force: false });
  } catch (e) {
    if (e.status === 422 || /fast forward/i.test(e.message)) throw new Error('Otro admin publico a la vez: vuelve a ejecutar el comando.');
    throw e;
  }
  return commit.sha;
}

function snapshot() {
  const head = headSha();
  const keysText = readAt(FILES.keys, head);
  return {
    head,
    keys: keysText ? DPWKeys.assertKeys(JSON.parse(keysText)) : null,
    encText: readAt(FILES.enc, head),
    poolsText: readAt(FILES.pools, head)
  };
}

// ---------------------------------------------------------------- this PC's key
function readCliKey() {
  if (!fs.existsSync(KEY_FILE)) return null;
  const k = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  if (!k || !k.id || !k.priv) throw new Error('Archivo de llave dañado: ' + KEY_FILE);
  return k;
}

async function ensureCliKey() {
  const existing = readCliKey();
  if (existing) return existing;
  const id = 'cli-' + os.hostname().toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 40);
  const made = await DPWKeys.newCli(id);
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify({ id, priv: made.priv, principal: made.principal }, null, 2), { mode: 0o600 });
  return { id, priv: made.priv, principal: made.principal };
}

async function contentKey(keys) {
  const k = readCliKey();
  if (!k) throw new Error('Este PC no tiene llave para los enlaces (' + KEY_FILE + ').');
  const ck = await DPWKeys.unlockCli(keys, k.id, k.priv);
  if (!ck) throw new Error('El acceso de este PC esta pendiente: un admin debe entrar en el panel para activarlo.');
  return ck;
}

async function encode(keys, ck, data) {
  const pub = DPW.publicView(data);
  DPW.assertValid(pub, { public: true });
  const box = await DPWKeys.encryptPools(keys, ck, DPW.serialize(data));
  return { [FILES.enc]: JSON.stringify(box) + '\n', [FILES.pools]: DPW.serialize(pub) };
}

// -> { data, keys, save(nextData, message) } with the full (decrypted) data at the current head.
async function open() {
  const snap = snapshot();
  if (!snap.keys || !snap.encText) throw new Error('Los enlaces todavia no estan cifrados: ejecuta primero "node tools/pools-cli.js migrate".');
  const ck = await contentKey(snap.keys);
  if (snap.poolsText && /mega\.nz/i.test(snap.poolsText)) console.warn('AVISO: pools.json publico contiene enlaces (lo escribio una herramienta antigua). Se corrige al guardar el proximo cambio.');
  const data = DPW.parse(await DPWKeys.decryptPools(snap.keys, ck, JSON.parse(snap.encText)));
  async function save(next, message) {
    const touched = DPW.touch(next);
    DPW.assertValid(touched);
    return writeFiles(snap.head, await encode(snap.keys, ck, touched), message);
  }
  return { data, keys: snap.keys, head: snap.head, save };
}

// One-time: encrypt the links that are still public in pools.json.
async function migrate(dryRun) {
  const snap = snapshot();
  if (snap.keys) throw new Error('Los enlaces ya estan cifrados (keys.json existe).');
  if (!snap.poolsText) throw new Error('No hay pools.json en ' + REPO + '.');
  const data = DPW.parse(snap.poolsText);
  if (dryRun) return { data, written: false };
  const me = await ensureCliKey();
  const made = await DPWKeys.create([me.principal]);
  const files = await encode(made.keys, made.ck, data);
  files[FILES.keys] = JSON.stringify(made.keys, null, 2) + '\n';
  const sha = writeFiles(snap.head, files, 'cli: proteger enlaces (cifrados en pools.enc)');
  return { data, written: true, sha };
}

// Gives the current content key to the pending principals named in `ids` (approved by the owner, e.g. "admins"
// right after an admin logged in for the first time). Never grants anything that was not named.
async function syncKeys(ids) {
  const snap = snapshot();
  if (!snap.keys) throw new Error('Los enlaces todavia no estan cifrados.');
  const waiting = DPWKeys.pending(snap.keys).map(p => p.id);
  const grant = (ids || []).filter(id => waiting.includes(id));
  const unknown = (ids || []).filter(id => !waiting.includes(id));
  if (unknown.length) throw new Error('No estan pendientes: ' + unknown.join(', ') + '. Pendientes ahora: ' + (waiting.join(', ') || 'ninguno'));
  if (!grant.length) return { waiting, granted: [] };
  const next = await DPWKeys.syncWraps(snap.keys, await contentKey(snap.keys), grant);
  writeFiles(snap.head, { [FILES.keys]: JSON.stringify(next, null, 2) + '\n' }, 'cli: activar acceso a los enlaces (' + grant.join(', ') + ')');
  return { waiting, granted: grant };
}

function readAccess() {
  const text = readAt(FILES.access, BRANCH);
  return text ? JSON.parse(text) : null;
}

// Rewrites pools.json from pools.enc (repairs a public file that an old tool filled with links).
async function repairPublic() {
  const o = await open();
  return o.save(o.data, 'cli: rehacer pools.json sin enlaces');
}

module.exports = { REPO, KEY_FILE, gh, snapshot, open, migrate, syncKeys, repairPublic, readAccess, readCliKey };
