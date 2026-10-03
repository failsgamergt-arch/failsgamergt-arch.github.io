#!/usr/bin/env node
/* Code-level editing of the pools (same rules as the admin panel). By default it works directly on the
 * live data repo failsgamergt-arch/dpw-data through the GitHub CLI ("gh", already logged in on the owner's
 * PC), so it never conflicts with what admins publish from the panel. --file <path> works on a local copy.
 *   node tools/pools-cli.js validate
 *   node tools/pools-cli.js months
 *   node tools/pools-cli.js list [--month 2026-08] [--date 2026-08-31]
 *   node tools/pools-cli.js add --date 2026-09-01 --artist "BPM SUPREME" --url <mega> [--name "..."] [--new-artist]
 *   node tools/pools-cli.js edit --date D --artist A [--index 1] [--to-date D2] [--to-artist A2] [--url U] [--name N]
 *   node tools/pools-cli.js remove --date D [--artist A [--index 1]]
 *   node tools/pools-cli.js artists | artist-add NAME | artist-rename OLD NEW | artist-remove NAME
 *   node tools/pools-cli.js admins                      (lists admin accounts of access.json)
 * Options: --dry-run (preview, saves nothing) · --file dpw-data/pools.json (local file instead of GitHub) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const DPW = require('../js/dpw-data.js');

const REPO = 'failsgamergt-arch/dpw-data';
const GH_CANDIDATES = [process.env.DPW_GH, 'C:/Program Files/GitHub CLI/gh.exe', 'gh'].filter(Boolean);

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

function gh(args, input) {
  let lastErr;
  for (const bin of GH_CANDIDATES) {
    if (bin.includes('/') && !fs.existsSync(bin)) continue;
    try {
      return execFileSync(bin, args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      if (e.code === 'ENOENT') { lastErr = e; continue; }
      const msg = String(e.stderr || e.message).trim();
      throw new Error('GitHub: ' + msg.split('\n').slice(-3).join(' '));
    }
  }
  throw new Error('No encuentro el GitHub CLI (gh). Instalalo y haz "gh auth login", o usa --file. ' + (lastErr ? lastErr.message : ''));
}

// ---------------------------------------------------------------- storage (remote repo or local file)
function makeStore(args) {
  if (args.file) {
    const file = path.resolve(String(args.file));
    return {
      where: file,
      read() { return { text: fs.readFileSync(file, 'utf8'), sha: null }; },
      write(text) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); },
      readAccess() { const f = path.join(path.dirname(file), 'access.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
    };
  }
  return {
    where: REPO + '/pools.json (GitHub)',
    read() {
      const meta = JSON.parse(gh(['api', 'repos/' + REPO + '/contents/pools.json', '-H', 'Accept: application/vnd.github.object']));
      const text = meta.content && meta.encoding === 'base64'
        ? Buffer.from(meta.content, 'base64').toString('utf8')
        : gh(['api', 'repos/' + REPO + '/contents/pools.json', '-H', 'Accept: application/vnd.github.raw']);
      return { text, sha: meta.sha };
    },
    write(text, sha, message) {
      const body = JSON.stringify({ message, content: Buffer.from(text, 'utf8').toString('base64'), sha, branch: 'main' });
      gh(['api', '-X', 'PUT', 'repos/' + REPO + '/contents/pools.json', '--input', '-'], body);
    },
    readAccess() {
      try { return JSON.parse(gh(['api', 'repos/' + REPO + '/contents/access.json', '-H', 'Accept: application/vnd.github.raw'])); }
      catch (e) { if (/404|Not Found/i.test(e.message)) return null; throw e; }
    }
  };
}

let STORE = null;
let LOADED = null;

function load() {
  const r = STORE.read();
  LOADED = r;
  return DPW.parse(r.text);
}

function save(data, args, summary) {
  const next = DPW.touch(data);
  DPW.assertValid(next);
  if (args['dry-run']) { console.log('[dry-run] ' + summary + ' (no se ha guardado)'); return; }
  STORE.write(DPW.serialize(next), LOADED && LOADED.sha, 'cli: ' + summary);
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

const commands = {
  validate() {
    const r = DPW.validate(JSON.parse(STORE.read().text));
    r.warnings.forEach(w => console.log('AVISO: ' + w));
    if (!r.ok) { r.errors.forEach(e => console.error('ERROR: ' + e)); process.exitCode = 1; return; }
    const d = load();
    const files = Object.values(d.days).reduce((n, day) => n + Object.values(day).reduce((m, f) => m + f.length, 0), 0);
    console.log(`Valido (${STORE.where}): ${Object.keys(d.days).length} dias, ${d.artists.length} artistas, ${files} enlaces`);
  },
  months() {
    DPW.listMonths(load()).forEach(m => console.log(`${m.id}  ${m.label.padEnd(16)} ${String(m.days).padStart(2)} dias  ${String(m.files).padStart(4)} enlaces  ${m.poolCount} pools`));
  },
  list(args) {
    const d = load();
    let dates = Object.keys(d.days).sort().reverse();
    if (args.month) dates = dates.filter(x => x.startsWith(String(args.month)));
    if (args.date) dates = dates.filter(x => x === String(args.date));
    dates.forEach(date => {
      console.log(date);
      Object.keys(d.days[date]).sort().forEach(a => d.days[date][a].forEach((f, i) => console.log(`  ${a} #${i + 1}  ${f.name}  ${f.url}`)));
    });
  },
  add(args) {
    let d = load();
    const artist = DPW.normalizeArtistName(need(args, 'artist'));
    if (args['new-artist'] && !d.artists.includes(artist)) d = DPW.addArtist(d, artist);
    const r = DPW.addEntries(d, [{ date: need(args, 'date'), artist, url: need(args, 'url'), name: args.name === true ? '' : args.name }]);
    if (r.skipped.length) throw new Error(r.skipped[0].reason);
    save(r.data, args, `anadir ${artist} ${args.date}`);
  },
  edit(args) {
    const ref = { date: need(args, 'date'), artist: DPW.normalizeArtistName(need(args, 'artist')), index: index(args) };
    const changes = {};
    if (args['to-date']) changes.date = String(args['to-date']);
    if (args['to-artist']) changes.artist = String(args['to-artist']);
    if (args.url) changes.url = String(args.url);
    if (args.name) changes.name = String(args.name);
    save(DPW.updateFile(load(), ref, changes), args, `editar ${ref.artist} ${ref.date} #${ref.index + 1}`);
  },
  remove(args) {
    const date = need(args, 'date');
    const d = load();
    if (!args.artist) return save(DPW.removeDay(d, date), args, `borrar dia ${date}`);
    const artist = DPW.normalizeArtistName(args.artist);
    if (args.index === undefined) return save(DPW.removeEntry(d, date, artist), args, `borrar ${artist} ${date}`);
    save(DPW.removeFile(d, { date, artist, index: index(args) }), args, `borrar ${artist} ${date} #${args.index}`);
  },
  artists() {
    const d = load(), u = DPW.artistUsage(d);
    d.artists.forEach(a => console.log(`${a.padEnd(22)} ${u[a]} publicaciones`));
  },
  'artist-add'(args) { save(DPW.addArtist(load(), positional(args, 1, 'NOMBRE')), args, 'anadir artista ' + DPW.normalizeArtistName(args._[1])); },
  'artist-rename'(args) {
    if (!args._[1] || !args._[2]) throw new Error('Uso: artist-rename VIEJO NUEVO');
    save(DPW.renameArtist(load(), DPW.normalizeArtistName(args._[1]), args._[2]), args, 'renombrar artista ' + args._[1] + ' -> ' + args._[2]);
  },
  'artist-remove'(args) { save(DPW.removeArtist(load(), DPW.normalizeArtistName(positional(args, 1, 'NOMBRE'))), args, 'borrar artista ' + args._[1]); },
  admins() {
    const a = STORE.readAccess();
    if (!a) { console.log('Publicacion sin activar (no hay access.json): abre admin.html y sigue "ACTIVAR PUBLICACION".'); return; }
    console.log('Admins: ' + (a.admins || []).map(s => s.user).join(', '));
  }
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = commands[args._[0]];
  if (!cmd) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 15).join('\n'));
    process.exitCode = args._[0] ? 1 : 0;
    return;
  }
  try {
    STORE = makeStore(args);
    cmd(args);
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exitCode = 1;
  }
}

main();
