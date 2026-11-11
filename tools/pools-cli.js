#!/usr/bin/env node
/* Code-level editing of the pools (same rules as the admin panel). By default it works directly on the
 * live data repo failsgamergt-arch/dpw-data through the GitHub CLI ("gh", already logged in on the owner's
 * PC), so it never conflicts with what admins publish from the panel. Links are encrypted (pools.enc): this PC
 * opens them with its key in ~/.dpw/cli-key.json (tools/dpw-store.js). --file <path> works on a plain local copy.
 *   node tools/pools-cli.js validate
 *   node tools/pools-cli.js months
 *   node tools/pools-cli.js list [--month 2026-08] [--date 2026-08-31]
 *   node tools/pools-cli.js add --date 2026-09-01 --artist "BPM SUPREME" --url <mega> [--name "..."] [--new-artist]
 *   node tools/pools-cli.js edit --date D --artist A [--index 1] [--to-date D2] [--to-artist A2] [--url U] [--name N]
 *   node tools/pools-cli.js remove --date D [--artist A [--index 1]]
 *   node tools/pools-cli.js artists | artist-add NAME | artist-rename OLD NEW | artist-remove NAME
 *   node tools/pools-cli.js admins                      (admin accounts of access.json)
 *   node tools/pools-cli.js keys                        (who can open the links; subscribers, pending accesses)
 *   node tools/pools-cli.js keys-sync --ids admins      (approves pending accesses BY NAME, e.g. the admins after the migration)
 *   node tools/pools-cli.js migrate                     (one time: encrypt links that are still public)
 * Options: --dry-run (preview, saves nothing) · --file dpw-data/pools.json (local plain file instead of GitHub) */
'use strict';
const fs = require('fs');
const path = require('path');
const DPW = require('../js/dpw-data.js');
const store = require('./dpw-store.js');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

// ---------------------------------------------------------------- storage (remote encrypted repo or local file)
function makeStore(args) {
  if (args.file) {
    const file = path.resolve(String(args.file));
    return {
      where: file,
      async open() {
        const data = DPW.parse(fs.readFileSync(file, 'utf8'));
        return { data, save: async next => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, DPW.serialize(next)); fs.renameSync(tmp, file); } };
      }
    };
  }
  return { where: store.REPO + ' (GitHub, enlaces cifrados)', open: () => store.open() };
}

let STORE = null;
let OPENED = null;

async function load() {
  OPENED = await STORE.open();
  return OPENED.data;
}

async function save(data, args, summary) {
  const next = DPW.touch(data);
  DPW.assertValid(next);
  if (args['dry-run']) { console.log('[dry-run] ' + summary + ' (no se ha guardado)'); return; }
  await OPENED.save(next, 'cli: ' + summary);
  console.log('OK: ' + summary + '  →  ' + STORE.where + (args.file ? '' : '  (visible en la web en ~1 min)'));
}

function need(args, key) {
  if (!args[key] || args[key] === true) throw new Error('Falta --' + key);
  return String(args[key]);
}

function positional(args, i, label) {
  if (!args._[i]) throw new Error('Falta ' + label);
  return String(args._[i]);
}

function index(args) {
  const i = args.index === undefined ? 1 : parseInt(args.index, 10);
  if (!(i >= 1)) throw new Error('--index empieza en 1');
  return i - 1;
}

function countFiles(d) {
  return Object.values(d.days).reduce((n, day) => n + Object.values(day).reduce((m, f) => m + f.length, 0), 0);
}

const commands = {
  async validate(args) {
    if (!args.file) {
      const s = store.snapshot();
      if (s.poolsText && /mega\.nz/i.test(s.poolsText)) { console.error('ERROR: pools.json publico contiene enlaces. Arreglo: node tools/pools-cli.js repair-public'); process.exitCode = 1; }
    }
    const d = await load();
    const r = DPW.validate(d);
    r.warnings.forEach(w => console.log('AVISO: ' + w));
    console.log(`Valido (${STORE.where}): ${Object.keys(d.days).length} dias, ${d.artists.length} artistas, ${countFiles(d)} enlaces`);
  },
  async months() {
    DPW.listMonths(await load()).forEach(m => console.log(`${m.id}  ${m.label.padEnd(16)} ${String(m.days).padStart(2)} dias  ${String(m.files).padStart(4)} enlaces  ${m.poolCount} pools`));
  },
  async list(args) {
    const d = await load();
    let dates = Object.keys(d.days).sort().reverse();
    if (args.month) dates = dates.filter(x => x.startsWith(String(args.month)));
    if (args.date) dates = dates.filter(x => x === String(args.date));
    dates.forEach(date => {
      console.log(date);
      Object.keys(d.days[date]).sort().forEach(a => d.days[date][a].forEach((f, i) => console.log(`  ${a} #${i + 1}  ${f.name}  ${f.url}`)));
    });
  },
  async add(args) {
    let d = await load();
    const artist = DPW.normalizeArtistName(need(args, 'artist'));
    if (args['new-artist'] && !d.artists.includes(artist)) d = DPW.addArtist(d, artist);
    const r = DPW.addEntries(d, [{ date: need(args, 'date'), artist, url: need(args, 'url'), name: args.name === true ? '' : args.name }]);
    if (r.skipped.length) throw new Error(r.skipped[0].reason);
    await save(r.data, args, `anadir ${artist} ${args.date}`);
  },
  async edit(args) {
    const ref = { date: need(args, 'date'), artist: DPW.normalizeArtistName(need(args, 'artist')), index: index(args) };
    const changes = {};
    if (args['to-date']) changes.date = String(args['to-date']);
    if (args['to-artist']) changes.artist = String(args['to-artist']);
    if (args.url) changes.url = String(args.url);
    if (args.name) changes.name = String(args.name);
    await save(DPW.updateFile(await load(), ref, changes), args, `editar ${ref.artist} ${ref.date} #${ref.index + 1}`);
  },
  async remove(args) {
    const date = need(args, 'date');
    const d = await load();
    if (!args.artist) return save(DPW.removeDay(d, date), args, `borrar dia ${date}`);
    const artist = DPW.normalizeArtistName(args.artist);
    if (args.index === undefined) return save(DPW.removeEntry(d, date, artist), args, `borrar ${artist} ${date}`);
    await save(DPW.removeFile(d, { date, artist, index: index(args) }), args, `borrar ${artist} ${date} #${args.index}`);
  },
  async artists() {
    const d = await load(), u = DPW.artistUsage(d);
    d.artists.forEach(a => console.log(`${a.padEnd(22)} ${u[a]} publicaciones`));
  },
  async 'artist-add'(args) { await save(DPW.addArtist(await load(), positional(args, 1, 'NOMBRE')), args, 'anadir artista ' + DPW.normalizeArtistName(args._[1])); },
  async 'artist-rename'(args) {
    if (!args._[1] || !args._[2]) throw new Error('Uso: artist-rename VIEJO NUEVO');
    await save(DPW.renameArtist(await load(), DPW.normalizeArtistName(args._[1]), args._[2]), args, 'renombrar artista ' + args._[1] + ' -> ' + args._[2]);
  },
  async 'artist-remove'(args) { await save(DPW.removeArtist(await load(), DPW.normalizeArtistName(positional(args, 1, 'NOMBRE'))), args, 'borrar artista ' + args._[1]); },
  async admins() {
    const a = store.readAccess();
    if (!a) { console.log('Publicacion sin activar (no hay access.json): abre admin.html y sigue "ACTIVAR PUBLICACION".'); return; }
    console.log('Admins: ' + (a.admins || []).map(s => s.user).join(', '));
  },
  async keys() {
    const snap = store.snapshot();
    if (!snap.keys) { console.log('Los enlaces todavia NO estan cifrados (falta "migrate").'); return; }
    const today = DPW.todayISO();
    const mine = store.readCliKey();
    snap.keys.principals.forEach(p => {
      const state = p.wrap && p.wrap.kid === snap.keys.kid ? 'con acceso' : 'PENDIENTE (keys-sync)';
      const extra = p.kind === 'member' ? (p.exp < today ? '  caducada ' : '  hasta ') + DPW.formatDate(p.exp) : '';
      console.log(`${p.kind.padEnd(7)} ${p.id.padEnd(36)} ${state}${extra}${mine && mine.id === p.id ? '  (este PC)' : ''}`);
    });
    console.log('Suscriptores: ' + snap.keys.principals.filter(p => p.kind === 'member').length + ' (sus nombres solo se ven en el panel admin)');
  },
  async 'keys-sync'(args) {
    const ids = args.ids && args.ids !== true ? String(args.ids).split(',').map(x => x.trim()).filter(Boolean) : [];
    if (args['dry-run'] || !ids.length) {
      const s = store.snapshot();
      const waiting = s.keys ? require('../js/dpw-keys.js').pending(s.keys).map(p => p.kind + ' ' + p.id) : [];
      console.log('Pendientes: ' + (waiting.join(', ') || 'ninguno') + (ids.length ? '' : '\nPara activarlos: keys-sync --ids <id>[,<id>] (solo los que reconozcas: "admins" aparece cuando un admin entra la primera vez).'));
      return;
    }
    const r = await store.syncKeys(ids);
    console.log(r.granted.length ? 'OK: acceso activado para ' + r.granted.join(', ') + ' (que vuelvan a entrar)' : 'Nada que activar.');
  },
  async 'repair-public'(args) {
    if (args['dry-run']) { console.log('[dry-run] se reescribiria pools.json a partir de pools.enc'); return; }
    await store.repairPublic();
    console.log('OK: pools.json rehecho sin enlaces');
  },
  async migrate(args) {
    const r = await store.migrate(!!args['dry-run']);
    console.log((r.written ? 'OK: enlaces cifrados (' : '[dry-run] se cifrarian (') + countFiles(r.data) + ' enlaces). pools.json queda solo con el catalogo.');
    if (r.written) console.log('Llave de este PC: ' + store.KEY_FILE + ' (no la subas a ningun sitio). Ahora un admin debe entrar en admin.html y despues: node tools/pools-cli.js keys-sync');
  }
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = commands[args._[0]];
  if (!cmd) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 19).join('\n'));
    process.exitCode = args._[0] ? 1 : 0;
    return;
  }
  if (args.file && ['admins', 'keys', 'keys-sync', 'migrate', 'repair-public'].includes(args._[0])) throw new Error(args._[0] + ' solo funciona contra GitHub (sin --file).');
  STORE = makeStore(args);
  await cmd(args);
}

main().catch(e => {
  console.error('ERROR: ' + e.message);
  process.exitCode = 1;
});
