/* Tests for js/dpw-data.js, js/dpw-vault.js and the real dpw-data/pools.json.  Run: node tools/test-dpw.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DPW = require('../js/dpw-data.js');

const URL1 = 'https://mega.nz/file/HuR3hQZK#bHlBxUmn8iAJNWTdkejmQPRFTBQljxyGfGbQecgF7XY';
const URL2 = 'https://mega.nz/file/W6wnBJrL#FrcnZwJWnIEHasM2hM8Bc8uzu20A1yefyaYeQ5t6k4g';
const URL3 = 'https://mega.nz/folder/AbCdEfGh#1234567890abcdefghij12';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

function base() {
  let d = DPW.emptyData();
  d = DPW.addArtist(d, 'bpm supreme');
  d = DPW.addArtist(d, 'Club Killers');
  return DPW.addEntries(d, [
    { date: '2026-09-01', artist: 'BPM SUPREME', url: URL1 },
    { date: '2026-09-02', artist: 'CLUB KILLERS', url: URL2, name: 'Club Killers 02 09 2026 - Dj Pool World [DPW]' }
  ]).data;
}

test('real data/pools.json is valid', () => {
  const r = DPW.validate(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dpw-data', 'pools.json'), 'utf8')));
  assert.deepStrictEqual(r.errors, []);
});

test('real data round-trips through serialize unchanged', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'dpw-data', 'pools.json'), 'utf8');
  assert.strictEqual(DPW.serialize(JSON.parse(text)), text);
});

test('dates', () => {
  assert(DPW.isValidDate('2026-02-28'));
  assert(!DPW.isValidDate('2026-02-30'));
  assert(DPW.isValidDate('2028-02-29'));
  assert(!DPW.isValidDate('2026-13-01'));
  assert(!DPW.isValidDate('31_08'));
  assert.strictEqual(DPW.addDays('2026-08-31', 1), '2026-09-01');
  assert.strictEqual(DPW.monthLabel('2026-08'), 'AGOSTO 2026');
  assert.strictEqual(DPW.formatDate('2026-08-03'), '03/08/2026');
});

test('mega url normalisation', () => {
  assert.strictEqual(DPW.normalizeMegaUrl('  ' + URL1 + ' '), URL1);
  assert.strictEqual(DPW.normalizeMegaUrl('https://mega.nz/#!HuR3hQZK!bHlBxUmn8iAJNWTdkejmQPRFTBQljxyGfGbQecgF7XY'), URL1);
  assert.strictEqual(DPW.normalizeMegaUrl('https://mega.co.nz/file/HuR3hQZK#bHlBxUmn8iAJNWTdkejmQPRFTBQljxyGfGbQecgF7XY'), URL1);
  assert.strictEqual(DPW.normalizeMegaUrl(URL3), URL3);
  assert.strictEqual(DPW.normalizeMegaUrl('javascript:alert(1)'), null);
  assert.strictEqual(DPW.normalizeMegaUrl('https://evil.com/file/HuR3hQZK#bHlBxUmn8iAJNWTdkejmQPRFTBQljxyGfGbQecgF7XY'), null);
  assert.strictEqual(DPW.normalizeMegaUrl('https://mega.nz/file/HuR3hQZK'), null);
  assert.strictEqual(DPW.normalizeMegaUrl(''), null);
  assert.strictEqual(DPW.normalizeMegaUrl(URL1.slice(0, -1)), null, 'key cut by one char (half-edited link) is rejected');
  assert.strictEqual(DPW.normalizeMegaUrl(URL1 + 'x'), null, 'key too long is rejected');
  assert.strictEqual(DPW.normalizeMegaUrl(URL3.slice(0, -1)), null, 'folder key cut is rejected');
  assert.strictEqual(DPW.normalizeMegaUrl(URL3 + '/file/AbCdEfGh'), URL3 + '/file/AbCdEfGh');
});

test('matchArtistInfo: learned names, normalised variants, fuzzy flagged', () => {
  const artists = ['THEMASHUP', 'DIGITAL MUSIC', 'LATIN REMIXES', 'BEATFREAKZ', 'CLUB KILLERS', 'DJ CITY', 'DJ CITY LATINO'];
  const data = { version: 1, artists, days: { '2026-08-08': { THEMASHUP: [{ name: 'TheMashUp - Toilet Break 08 08 2026 - Dj Pool World [DPW]', url: URL1 }] } } };
  const learned = DPW.learnArtistPrefixes(data);
  assert.deepStrictEqual(DPW.matchArtistInfo('TheMashUp - Toilet Break', artists, learned), { artist: 'THEMASHUP', exact: true });
  assert.deepStrictEqual(DPW.matchArtistInfo('Digital Music Pool', artists), { artist: 'DIGITAL MUSIC', exact: true });
  assert.deepStrictEqual(DPW.matchArtistInfo('LatinRemixes.com', artists), { artist: 'LATIN REMIXES', exact: true });
  assert.deepStrictEqual(DPW.matchArtistInfo('TheBeatfreakz', artists), { artist: 'BEATFREAKZ', exact: true });
  assert.deepStrictEqual(DPW.matchArtistInfo('Dj City Latino', artists), { artist: 'DJ CITY LATINO', exact: true });
  assert.deepStrictEqual(DPW.matchArtistInfo('Club Killers Latin', artists), { artist: 'CLUB KILLERS', exact: false }, 'sub-brand only guessed');
  assert.deepStrictEqual(DPW.matchArtistInfo('Totally New Pool', artists), { artist: null, exact: false });
});

test('artists: add / duplicate / invalid / rename / remove', () => {
  let d = base();
  assert.deepStrictEqual(d.artists, ['BPM SUPREME', 'CLUB KILLERS']);
  assert.throws(() => DPW.addArtist(d, 'bpm  supreme'), /ya existe/);
  assert.throws(() => DPW.addArtist(d, '<script>'), /no valido/);
  assert.throws(() => DPW.addArtist(d, ''), /no valido/);
  assert.throws(() => DPW.removeArtist(d, 'BPM SUPREME'), /publicacion/);
  const r = DPW.renameArtist(d, 'BPM SUPREME', 'bpm supreme latino');
  assert(r.days['2026-09-01']['BPM SUPREME LATINO']);
  assert(!r.days['2026-09-01']['BPM SUPREME']);
  assert.throws(() => DPW.renameArtist(d, 'BPM SUPREME', 'club killers'), /Ya existe/);
  d = DPW.addArtist(d, 'Da Zone');
  assert.deepStrictEqual(DPW.removeArtist(d, 'DA ZONE').artists, ['BPM SUPREME', 'CLUB KILLERS']);
  assert(DPW.validate(r).ok);
});

test('addEntries: defaults, skips, new artists, immutability', () => {
  const d = base();
  const before = JSON.stringify(d);
  const r = DPW.addEntries(d, [
    { date: '2026-09-01', artist: 'BPM SUPREME', url: URL1 },
    { date: '2026-09-31', artist: 'BPM SUPREME', url: URL2 },
    { date: '2026-09-03', artist: 'NOPE', url: URL2 },
    { date: '2026-09-03', artist: 'BPM SUPREME', url: 'x' },
    { date: '2026-09-03', artist: 'da zone', url: URL3 }
  ], { newArtists: ['Da Zone'] });
  assert.strictEqual(JSON.stringify(d), before, 'input must not be mutated');
  assert.strictEqual(r.added.length, 1);
  assert.strictEqual(r.added[0].name, 'Da Zone 03 09 2026 - Dj Pool World [DPW]');
  assert.deepStrictEqual(r.skipped.map(s => s.reason), ['Ya estaba publicado en ese dia', 'Fecha no valida', 'Artista no registrado: NOPE', 'Enlace MEGA no valido']);
  assert(r.data.artists.includes('DA ZONE'));
  assert(DPW.validate(r.data).ok);
  assert.strictEqual(DPW.getFiles(base(), '2026-09-01', 'BPM SUPREME')[0].name, 'Bpm Supreme 01 09 2026 - Dj Pool World [DPW]');
});

test('second link for same day+artist is appended', () => {
  const r = DPW.addEntries(base(), [{ date: '2026-09-01', artist: 'BPM SUPREME', url: URL3, name: 'Parte 2' }]);
  assert.strictEqual(r.data.days['2026-09-01']['BPM SUPREME'].length, 2);
});

test('updateFile: edit in place, move, conflicts', () => {
  const d = base();
  const e = DPW.updateFile(d, { date: '2026-09-01', artist: 'BPM SUPREME', index: 0 }, { name: 'Nuevo nombre' });
  assert.strictEqual(e.days['2026-09-01']['BPM SUPREME'][0].name, 'Nuevo nombre');
  const m = DPW.updateFile(d, { date: '2026-09-01', artist: 'BPM SUPREME', index: 0 }, { date: '2026-09-02', artist: 'CLUB KILLERS' });
  assert(!m.days['2026-09-01'], 'empty day removed');
  assert.strictEqual(m.days['2026-09-02']['CLUB KILLERS'].length, 2);
  assert.throws(() => DPW.updateFile(d, { date: '2026-09-01', artist: 'BPM SUPREME', index: 0 }, { url: 'bad' }), /no valido/);
  assert.throws(() => DPW.updateFile(d, { date: '2026-09-01', artist: 'BPM SUPREME', index: 5 }, {}), /ya no existe/);
  assert.throws(() => DPW.updateFile(d, { date: '2026-09-01', artist: 'BPM SUPREME', index: 0 }, { artist: 'X' }), /no existe/);
  assert.throws(() => DPW.updateFile(d, { date: '2026-09-01', artist: 'BPM SUPREME', index: 0 }, { date: '2026-09-02', artist: 'CLUB KILLERS', url: URL2 }), /destino/);
  assert.throws(() => DPW.updateFile(d, { date: '2026-09-01', artist: 'BPM SUPREME', index: 0 }, { name: '<b>' }), /Nombre/);
  [e, m].forEach(x => assert(DPW.validate(x).ok));
});

test('remove file / entry / day', () => {
  const d = DPW.addEntries(base(), [{ date: '2026-09-01', artist: 'CLUB KILLERS', url: URL3 }]).data;
  const a = DPW.removeFile(d, { date: '2026-09-01', artist: 'CLUB KILLERS', index: 0 });
  assert(!a.days['2026-09-01']['CLUB KILLERS']);
  const b = DPW.removeEntry(d, '2026-09-01', 'BPM SUPREME');
  assert.deepStrictEqual(Object.keys(b.days['2026-09-01']), ['CLUB KILLERS']);
  const c = DPW.removeDay(d, '2026-09-01');
  assert(!c.days['2026-09-01']);
  assert.throws(() => DPW.removeDay(d, '2026-01-01'), /No hay/);
  assert.throws(() => DPW.removeEntry(d, '2026-09-01', 'DA ZONE'), /No existe/);
  [a, b, c].forEach(x => assert(DPW.validate(x).ok));
});

test('validate rejects broken data', () => {
  const bad = [
    null, [], { version: 2, artists: [], days: {} }, { version: 1, artists: 'x', days: {} },
    { version: 1, artists: ['A'], days: { '2026-02-30': { A: [{ name: 'n', url: URL1 }] } } },
    { version: 1, artists: ['A'], days: { '2026-02-01': { B: [{ name: 'n', url: URL1 }] } } },
    { version: 1, artists: ['A'], days: { '2026-02-01': { A: [] } } },
    { version: 1, artists: ['A'], days: { '2026-02-01': { A: [{ name: 'n', url: 'javascript:x' }] } } },
    { version: 1, artists: ['A'], days: { '2026-02-01': { A: [{ name: '<img onerror=x>', url: URL1 }] } } },
    { version: 1, artists: ['A', 'A'], days: {} },
    { version: 1, artists: ['A'], days: { '2026-02-01': { A: [{ name: 'n', url: URL1 }, { name: 'm', url: URL1 }] } } },
    { version: 1, artists: ['A'], days: { '2026-02-01': {} } }
  ];
  bad.forEach((b, i) => assert(!DPW.validate(b).ok, 'case ' + i + ' should fail'));
  assert.throws(() => DPW.parse('{bad json'), /JSON mal formado/);
});

test('sanitize keeps only valid parts', () => {
  const s = DPW.sanitize({ version: 1, artists: ['A', '<x>'], days: {
    '2026-02-01': { A: [{ name: 'ok', url: URL1 }, { name: 'bad', url: 'http://x' }], '<x>': [{ name: 'n', url: URL2 }] },
    'nope': { A: [] },
    '2026-02-02': { B: [{ name: 'auto', url: URL2 }] }
  } });
  assert(DPW.validate(s).ok);
  assert.deepStrictEqual(s.days['2026-02-01'], { A: [{ name: 'ok', url: URL1 }] });
  assert(s.artists.includes('B'));
  assert.deepStrictEqual(DPW.sanitize(null), DPW.emptyData());
});

test('queries: months, monthDays, usage, findUrl', () => {
  const d = DPW.addEntries(base(), [{ date: '2026-08-31', artist: 'BPM SUPREME', url: URL3 }]).data;
  const months = DPW.listMonths(d);
  assert.deepStrictEqual(months.map(m => m.id), ['2026-09', '2026-08']);
  assert.strictEqual(months[0].files, 2);
  assert.deepStrictEqual(DPW.monthDays(d, '2026-09').map(x => x.date), ['2026-09-02', '2026-09-01']);
  assert.deepStrictEqual(DPW.artistUsage(d), { 'BPM SUPREME': 2, 'CLUB KILLERS': 1 });
  assert.deepStrictEqual(DPW.findUrl(d, URL3), [{ date: '2026-08-31', artist: 'BPM SUPREME', index: 0 }]);
  const withEmpty = DPW.clone(d);
  withEmpty.days['2026-09-05'] = {};
  assert.deepStrictEqual(DPW.monthDays(withEmpty, '2026-09').map(x => x.date), ['2026-09-02', '2026-09-01'], 'empty day never rendered');
});

test('periodDays', () => {
  assert.deepStrictEqual(DPW.periodDays('2026-09-30', 'day'), ['2026-09-30']);
  assert.deepStrictEqual(DPW.periodDays('2026-09-30', '2days'), ['2026-09-30', '2026-10-01']);
  assert.strictEqual(DPW.periodDays('2026-09-10', 'week').length, 7);
  const feb = DPW.periodDays('2026-02-15', 'month');
  assert.strictEqual(feb.length, 28);
  assert.strictEqual(feb[0], '2026-02-01');
  assert.deepStrictEqual(DPW.periodDays('2026-09-01', 'custom', '2026-09-03'), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.deepStrictEqual(DPW.periodDays('2026-09-05', 'custom', '2026-09-01'), ['2026-09-05']);
  assert.strictEqual(DPW.periodDays('2026-01-01', 'custom', '2027-01-01').length, 62);
  assert.deepStrictEqual(DPW.periodDays('bad', 'day'), []);
});

test('parseReleaseName + matchArtist', () => {
  const artists = ['AREYOUKIDY', 'DIGITAL MUSIC', 'DJ CITY', 'DJ CITY LATINO', 'LATIN REMIXES', 'THEMASHUP', 'BEATFREAKZ', 'BPM SUPREME'];
  const cases = [
    ['AreYouKidy 03 08 2026 - Dj Pool World [DPW].zip', 'AREYOUKIDY', '2026-08-03'],
    ['Digital Music Pool 01 08 2026 - Dj Pool World [DPW].rar', 'DIGITAL MUSIC', '2026-08-01'],
    ['Dj City Latino 10 08 2026 - Dj Pool World [DPW]', 'DJ CITY LATINO', '2026-08-10'],
    ['Dj City 10 08 2026 - Dj Pool World [DPW]', 'DJ CITY', '2026-08-10'],
    ['LatinRemixes.com 07 08 2026 - Dj Pool World [DPW].zip', 'LATIN REMIXES', '2026-08-07'],
    ['TheMashUp - Latin 05 08 2026 - Dj Pool World [DPW].zip', 'THEMASHUP', '2026-08-05'],
    ['TheBeatfreakz 12 08 2026.rar', 'BEATFREAKZ', '2026-08-12'],
    ['Bpm Supreme 31 08 2026.zip', 'BPM SUPREME', '2026-08-31']
  ];
  cases.forEach(([name, artist, date]) => {
    const p = DPW.parseReleaseName(name);
    assert.strictEqual(p.date, date, name);
    assert.strictEqual(DPW.matchArtist(p.prefix, artists), artist, name);
  });
  assert.strictEqual(DPW.parseReleaseName('AreYouKidy 0107', '2026').date, '2026-07-01');
  assert.strictEqual(DPW.parseReleaseName('Something 31 02 2026').date, null);
  assert.strictEqual(DPW.matchArtist('Unknown Pool', artists), null);
});

test('esc', () => {
  assert.strictEqual(DPW.esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test('pools-tracks.js keys use YYYY-MM-DD and match data', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pools-tracks.js'), 'utf8');
  const tracks = JSON.parse(src.slice(src.indexOf('= ') + 2, src.lastIndexOf(';')));
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dpw-data', 'pools.json'), 'utf8'));
  Object.keys(tracks).forEach(k => {
    assert(DPW.isValidDate(k), 'bad key ' + k);
    Object.keys(tracks[k]).forEach(a => assert(d.days[k] && d.days[k][a], 'tracks without publication: ' + k + ' ' + a));
  });
});

// ---------------------------------------------------------------- vault (async)
const V = require('../js/dpw-vault.js');
const TOKEN = 'github_pat_' + 'A1b2C3d4'.repeat(8);

async function vaultTests() {
  const owner = 'Shark-Music-Pass-2026x'.replace('Shark', 'Disco'), partner = 'Mezclas-Del-Mundo-88';
  const { access, mk } = await V.create(TOKEN, [{ user: 'SharkMusic', password: owner }]);
  const ok = await V.unlock(access, ' SHARKMUSIC ', owner);
  assert(ok && ok.token === TOKEN && ok.user === 'sharkmusic' && ok.mk === mk, 'unlock with right password');
  assert.strictEqual(await V.unlock(access, 'sharkmusic', owner + 'x'), null, 'wrong password');
  assert.strictEqual(await V.unlock(access, 'nadie', owner), null, 'unknown user');
  assert(!JSON.stringify(access).includes(owner) && !JSON.stringify(access).includes(TOKEN), 'no plaintext secrets stored');
  assert.deepStrictEqual(V.validateAccess(access), []);

  const a2 = await V.addAdmin(access, mk, 'socio', partner);
  assert((await V.unlock(a2, 'socio', partner)).token === TOKEN, 'new admin can unlock');
  await assert.rejects(V.addAdmin(a2, mk, 'Socio', 'Otra-Clave-12345'), /Ya existe/);
  await assert.rejects(V.addAdmin(a2, mk, 'x', partner), /Usuario/);
  await assert.rejects(V.addAdmin(a2, mk, 'tercero', 'admin2026'), /12 caracteres/);

  const a3 = await V.changePassword(a2, mk, 'socio', 'Nueva-Clave-777abc');
  assert.strictEqual(await V.unlock(a3, 'socio', partner), null, 'old password stops working');
  assert(await V.unlock(a3, 'socio', 'Nueva-Clave-777abc'), 'new password works');
  assert(await V.unlock(a3, 'sharkmusic', owner), 'other admins unaffected');

  const NEW_TOKEN = 'github_pat_' + 'Z9y8X7w6'.repeat(8);
  const a4 = await V.replaceToken(a3, mk, NEW_TOKEN);
  assert.strictEqual((await V.unlock(a4, 'socio', 'Nueva-Clave-777abc')).token, NEW_TOKEN, 'renewed key reaches every admin');

  const a5 = V.removeAdmin(a4, 'socio');
  assert.strictEqual(await V.unlock(a5, 'socio', 'Nueva-Clave-777abc'), null, 'removed admin cannot log in');
  assert.throws(() => V.removeAdmin(a5, 'sharkmusic'), /ultimo/);

  const swapped = JSON.parse(JSON.stringify(a4));
  swapped.admins[1].user = 'impostor';
  assert.strictEqual(await V.unlock(swapped, 'impostor', 'Nueva-Clave-777abc'), null, 'renamed slot is rejected (bound to user)');
  const flipped = JSON.parse(JSON.stringify(a4));
  flipped.token.ct = flipped.token.ct.replace(/^./, c => (c === 'A' ? 'B' : 'A'));
  await assert.rejects(V.unlock(flipped, 'sharkmusic', owner), 'tampered key is detected');
  assert(V.validateAccess({ version: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 10 }, token: a4.token, admins: a4.admins }).length, 'weak kdf rejected');

  ['admin2026', 'aaaaaaaaaaaa1', 'sinNumerosNunca', 'corto1A'].forEach(p => assert(V.passwordProblem(p), p + ' must be rejected'));
  assert.strictEqual(V.passwordProblem('Mezclas-Del-Mundo-88', 'sharkmusic'), '');
  assert(V.passwordProblem('sharkmusic-2026-xyz', 'sharkmusic'), 'password containing user rejected');
  for (let i = 0; i < 20; i++) assert.strictEqual(V.passwordProblem(V.generatePassword()), '', 'generated passwords are always valid');
  await assert.rejects(V.create('short', [{ user: 'abc', password: owner }]), /llave|clave/i);
  passed += 1;
}

vaultTests().then(() => {
  console.log(passed + ' tests OK' + (process.exitCode ? ' (con fallos)' : ''));
}, e => {
  console.error('FAIL vault\n  ' + (e && e.stack || e));
  process.exitCode = 1;
  console.log(passed + ' tests OK (con fallos)');
});
