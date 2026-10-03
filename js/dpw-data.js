/* DJ POOL WORLD - data model shared by pools.html, admin.html and tools/pools-cli.js.
 * Canonical store: data/pools.json -> { version, updated, artists: [..], days: { "YYYY-MM-DD": { "ARTIST": [{name, url}] } } }
 * Every mutation is pure (returns a new object) and every write must pass validate(). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DPW = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  // Public URL of the data (a separate repo "dpw-data" published by GitHub Pages under this same domain).
  var DATA_PATH = 'dpw-data/pools.json';
  var MONTH_NAMES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  var RELEASE_SUFFIX = 'Dj Pool World [DPW]';

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var MONTH_RE = /^(\d{4})-(\d{2})$/;
  var ARTIST_RE = /^[A-Z0-9ÁÉÍÓÚÑÜÇ][A-Z0-9ÁÉÍÓÚÑÜÇ .&+\-!]{0,39}$/;
  // Exact MEGA formats (file key 43 chars, folder key 22) so a link cut short while editing never validates.
  var MEGA_URL_RE = /^https:\/\/mega\.nz\/(file\/[A-Za-z0-9_-]{8}#[A-Za-z0-9_-]{43}|folder\/[A-Za-z0-9_-]{8}#[A-Za-z0-9_-]{22}(\/(file|folder)\/[A-Za-z0-9_-]{8})?)$/;
  var MAX_NAME = 200;
  var MAX_PERIOD_DAYS = 62;

  // ---------------------------------------------------------------- helpers
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function isValidDate(s) {
    var m = DATE_RE.exec(String(s));
    if (!m) return false;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
    return d <= daysInMonth(y, mo);
  }

  function daysInMonth(y, mo) { return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function addDays(date, n) {
    var m = DATE_RE.exec(date);
    var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
    return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate());
  }

  function monthOf(date) { return String(date).slice(0, 7); }

  function monthLabel(monthId) {
    var m = MONTH_RE.exec(monthId);
    return m ? MONTH_NAMES[+m[2] - 1] + ' ' + m[1] : monthId;
  }

  function formatDate(date) {
    var m = DATE_RE.exec(date);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : date;
  }

  function normalizeArtistName(s) {
    return String(s == null ? '' : s).replace(/[\s ]+/g, ' ').trim().toUpperCase();
  }

  function artistKey(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  }

  function titleCase(s) {
    return String(s).toLowerCase().replace(/(^|[\s\-])([a-z0-9áéíóúñü])/g, function (_, a, b) { return a + b.toUpperCase(); });
  }

  function defaultFileName(artist, date) {
    var m = DATE_RE.exec(date);
    return titleCase(artist) + ' ' + m[3] + ' ' + m[2] + ' ' + m[1] + ' - ' + RELEASE_SUFFIX;
  }

  // Accepts current and legacy MEGA formats; returns canonical https://mega.nz/... or null.
  function normalizeMegaUrl(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) return null;
    s = s.replace(/^http:\/\//i, 'https://').replace(/^https:\/\/(www\.)?mega\.(co\.)?nz/i, 'https://mega.nz');
    var legacy = /^https:\/\/mega\.nz\/#(F?)!([A-Za-z0-9_-]+)!([A-Za-z0-9_-]+)$/.exec(s);
    if (legacy) s = 'https://mega.nz/' + (legacy[1] ? 'folder' : 'file') + '/' + legacy[2] + '#' + legacy[3];
    return MEGA_URL_RE.test(s) ? s : null;
  }

  function isValidFileName(n) {
    return typeof n === 'string' && n.trim().length > 0 && n.length <= MAX_NAME && !/[<>]/.test(n);
  }

  // ---------------------------------------------------------------- shape
  function emptyData() { return { version: SCHEMA_VERSION, updated: null, artists: [], days: {} }; }

  function canonicalize(data) {
    var out = { version: SCHEMA_VERSION, updated: data.updated || null, artists: [], days: {} };
    out.artists = (data.artists || []).slice().sort(function (a, b) { return a.localeCompare(b); });
    Object.keys(data.days || {}).sort().reverse().forEach(function (date) {
      var day = data.days[date], nd = {};
      Object.keys(day).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (artist) {
        nd[artist] = day[artist].map(function (f) { return { name: f.name, url: f.url }; });
      });
      if (Object.keys(nd).length) out.days[date] = nd;
    });
    return out;
  }

  function serialize(data) { return JSON.stringify(canonicalize(data), null, 2) + '\n'; }

  function validate(data) {
    var errors = [], warnings = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['El archivo no es un objeto JSON'], warnings: warnings };
    if (data.version !== SCHEMA_VERSION) errors.push('version debe ser ' + SCHEMA_VERSION);
    if (!Array.isArray(data.artists)) errors.push('artists debe ser una lista');
    if (!data.days || typeof data.days !== 'object' || Array.isArray(data.days)) errors.push('days debe ser un objeto');
    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    var seenArtists = {};
    data.artists.forEach(function (a) {
      if (typeof a !== 'string' || !ARTIST_RE.test(a)) errors.push('Artista con nombre no valido: "' + a + '"');
      else if (seenArtists[a]) errors.push('Artista duplicado: ' + a);
      seenArtists[a] = true;
    });

    var urlSeen = {};
    Object.keys(data.days).forEach(function (date) {
      if (!isValidDate(date)) { errors.push('Fecha no valida: ' + date); return; }
      var day = data.days[date];
      if (!day || typeof day !== 'object' || Array.isArray(day)) { errors.push(date + ': debe ser un objeto'); return; }
      if (!Object.keys(day).length) errors.push(date + ': dia vacio (borralo o anade un artista)');
      Object.keys(day).forEach(function (artist) {
        var where = date + ' / ' + artist;
        if (!seenArtists[artist]) errors.push(where + ': artista no registrado en la lista de artistas');
        var files = day[artist];
        if (!Array.isArray(files) || !files.length) { errors.push(where + ': sin enlaces'); return; }
        var local = {};
        files.forEach(function (f, i) {
          if (!f || typeof f !== 'object') { errors.push(where + ' #' + (i + 1) + ': entrada no valida'); return; }
          if (!isValidFileName(f.name)) errors.push(where + ' #' + (i + 1) + ': nombre no valido');
          if (typeof f.url !== 'string' || !MEGA_URL_RE.test(f.url)) errors.push(where + ' #' + (i + 1) + ': enlace MEGA no valido');
          if (local[f.url]) errors.push(where + ': enlace repetido');
          local[f.url] = true;
          if (urlSeen[f.url]) warnings.push('Enlace usado en dos sitios: ' + urlSeen[f.url] + ' y ' + where);
          else urlSeen[f.url] = where;
        });
      });
    });
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function assertValid(data) {
    var r = validate(data);
    if (!r.ok) {
      var e = new Error('Datos no validos:\n- ' + r.errors.slice(0, 15).join('\n- ') + (r.errors.length > 15 ? '\n- ... (' + (r.errors.length - 15) + ' mas)' : ''));
      e.validation = r;
      throw e;
    }
    return data;
  }

  function parse(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('JSON mal formado: ' + e.message); }
    return assertValid(data);
  }

  // Keeps only valid parts so the public site can still render if the file was hand-edited badly.
  function sanitize(data) {
    if (!data || typeof data !== 'object') return emptyData();
    var out = emptyData();
    out.updated = data.updated || null;
    var artists = {};
    (Array.isArray(data.artists) ? data.artists : []).forEach(function (a) {
      if (typeof a === 'string' && ARTIST_RE.test(a) && !artists[a]) { artists[a] = true; out.artists.push(a); }
    });
    var days = data.days && typeof data.days === 'object' ? data.days : {};
    Object.keys(days).forEach(function (date) {
      if (!isValidDate(date) || !days[date] || typeof days[date] !== 'object') return;
      var nd = {};
      Object.keys(days[date]).forEach(function (artist) {
        if (typeof artist !== 'string' || !ARTIST_RE.test(artist)) return;
        var files = (Array.isArray(days[date][artist]) ? days[date][artist] : []).filter(function (f) {
          return f && isValidFileName(f.name) && typeof f.url === 'string' && MEGA_URL_RE.test(f.url);
        }).map(function (f) { return { name: f.name, url: f.url }; });
        if (files.length) {
          nd[artist] = files;
          if (!artists[artist]) { artists[artist] = true; out.artists.push(artist); }
        }
      });
      if (Object.keys(nd).length) out.days[date] = nd;
    });
    return out;
  }

  // ---------------------------------------------------------------- queries
  function listMonths(data) {
    var map = {};
    Object.keys(data.days).forEach(function (date) {
      var id = monthOf(date);
      if (!map[id]) map[id] = { id: id, label: monthLabel(id), name: MONTH_NAMES[+id.slice(5, 7) - 1], year: id.slice(0, 4), days: 0, files: 0, pools: {} };
      map[id].days++;
      Object.keys(data.days[date]).forEach(function (a) {
        map[id].pools[a] = true;
        map[id].files += data.days[date][a].length;
      });
    });
    return Object.keys(map).sort().reverse().map(function (id) {
      var m = map[id];
      m.poolCount = Object.keys(m.pools).length;
      delete m.pools;
      return m;
    });
  }

  function monthDays(data, monthId) {
    return Object.keys(data.days).filter(function (d) {
      return monthOf(d) === monthId && data.days[d] && Object.keys(data.days[d]).length > 0;
    }).sort().reverse().map(function (date) {
      return {
        date: date,
        day: date.slice(8, 10),
        monthName: MONTH_NAMES[+date.slice(5, 7) - 1],
        year: date.slice(0, 4),
        pools: Object.keys(data.days[date]).sort(function (a, b) { return a.localeCompare(b); })
      };
    });
  }

  function getFiles(data, date, artist) {
    var day = data.days[date];
    return day && day[artist] ? day[artist] : [];
  }

  function artistUsage(data) {
    var usage = {};
    data.artists.forEach(function (a) { usage[a] = 0; });
    Object.keys(data.days).forEach(function (date) {
      Object.keys(data.days[date]).forEach(function (a) { usage[a] = (usage[a] || 0) + 1; });
    });
    return usage;
  }

  function findUrl(data, url) {
    var hits = [];
    Object.keys(data.days).forEach(function (date) {
      Object.keys(data.days[date]).forEach(function (a) {
        data.days[date][a].forEach(function (f, i) { if (f.url === url) hits.push({ date: date, artist: a, index: i }); });
      });
    });
    return hits;
  }

  // ---------------------------------------------------------------- mutations (pure)
  function requireArtist(data, artist) {
    if (data.artists.indexOf(artist) === -1) throw new Error('El artista "' + artist + '" no existe. Crealo primero.');
  }

  function addArtist(data, name) {
    var n = normalizeArtistName(name);
    if (!ARTIST_RE.test(n)) throw new Error('Nombre de artista no valido (solo letras, numeros, espacios y . & + - !, maximo 40).');
    if (data.artists.indexOf(n) !== -1) throw new Error('El artista ' + n + ' ya existe.');
    var out = clone(data);
    out.artists.push(n);
    return out;
  }

  function renameArtist(data, from, to) {
    var n = normalizeArtistName(to);
    requireArtist(data, from);
    if (!ARTIST_RE.test(n)) throw new Error('Nombre de artista no valido.');
    if (n === from) return clone(data);
    if (data.artists.indexOf(n) !== -1) throw new Error('Ya existe un artista llamado ' + n + '.');
    var out = clone(data);
    out.artists = out.artists.map(function (a) { return a === from ? n : a; });
    Object.keys(out.days).forEach(function (date) {
      var day = out.days[date];
      if (day[from]) { day[n] = day[from]; delete day[from]; }
    });
    return out;
  }

  function removeArtist(data, name) {
    requireArtist(data, name);
    var used = artistUsage(data)[name] || 0;
    if (used > 0) throw new Error('No se puede borrar ' + name + ': tiene ' + used + ' publicacion(es). Borralas o renombra el artista.');
    var out = clone(data);
    out.artists = out.artists.filter(function (a) { return a !== name; });
    return out;
  }

  // rows: [{date, artist, url, name?}] -> { data, added: [...], skipped: [{row, reason}] }
  function addEntries(data, rows, opts) {
    opts = opts || {};
    var out = clone(data), added = [], skipped = [];
    (opts.newArtists || []).forEach(function (a) {
      var n = normalizeArtistName(a);
      if (n && ARTIST_RE.test(n) && out.artists.indexOf(n) === -1) out.artists.push(n);
    });
    rows.forEach(function (row) {
      var date = String(row.date || '').trim();
      var artist = normalizeArtistName(row.artist);
      var url = normalizeMegaUrl(row.url);
      var name = row.name && String(row.name).trim() ? String(row.name).trim() : (isValidDate(date) && artist ? defaultFileName(artist, date) : '');
      if (!isValidDate(date)) return skipped.push({ row: row, reason: 'Fecha no valida' });
      if (out.artists.indexOf(artist) === -1) return skipped.push({ row: row, reason: 'Artista no registrado: ' + artist });
      if (!url) return skipped.push({ row: row, reason: 'Enlace MEGA no valido' });
      if (!isValidFileName(name)) return skipped.push({ row: row, reason: 'Nombre no valido' });
      var day = out.days[date] || (out.days[date] = {});
      var files = day[artist] || (day[artist] = []);
      if (files.some(function (f) { return f.url === url; })) return skipped.push({ row: row, reason: 'Ya estaba publicado en ese dia' });
      files.push({ name: name, url: url });
      added.push({ date: date, artist: artist, name: name, url: url });
    });
    return { data: out, added: added, skipped: skipped };
  }

  function locate(data, ref) {
    var files = getFiles(data, ref.date, ref.artist);
    if (!files[ref.index]) throw new Error('La publicacion ya no existe (puede que otro admin la haya cambiado). Recarga.');
    return files[ref.index];
  }

  function dropFile(out, ref) {
    var day = out.days[ref.date];
    day[ref.artist].splice(ref.index, 1);
    if (!day[ref.artist].length) delete day[ref.artist];
    if (!Object.keys(day).length) delete out.days[ref.date];
  }

  // ref: {date, artist, index}; changes: {date?, artist?, name?, url?}
  function updateFile(data, ref, changes) {
    var current = locate(data, ref);
    var date = changes.date != null ? String(changes.date).trim() : ref.date;
    var artist = changes.artist != null ? normalizeArtistName(changes.artist) : ref.artist;
    var url = changes.url != null ? normalizeMegaUrl(changes.url) : current.url;
    var name = changes.name != null ? String(changes.name).trim() : current.name;
    if (!isValidDate(date)) throw new Error('Fecha no valida.');
    requireArtist(data, artist);
    if (!url) throw new Error('Enlace MEGA no valido.');
    if (!isValidFileName(name)) throw new Error('Nombre no valido (no puede estar vacio ni contener < >).');
    var out = clone(data);
    var moving = date !== ref.date || artist !== ref.artist;
    if (!moving) {
      var siblings = out.days[date][artist];
      if (siblings.some(function (f, i) { return i !== ref.index && f.url === url; })) throw new Error('Ese enlace ya esta en este dia y artista.');
      siblings[ref.index] = { name: name, url: url };
      return out;
    }
    var target = (out.days[date] && out.days[date][artist]) || [];
    if (target.some(function (f) { return f.url === url; })) throw new Error('Ese enlace ya esta publicado en el destino.');
    dropFile(out, ref);
    var day = out.days[date] || (out.days[date] = {});
    (day[artist] || (day[artist] = [])).push({ name: name, url: url });
    return out;
  }

  function removeFile(data, ref) {
    locate(data, ref);
    var out = clone(data);
    dropFile(out, ref);
    return out;
  }

  function removeEntry(data, date, artist) {
    if (!data.days[date] || !data.days[date][artist]) throw new Error('No existe ' + artist + ' el ' + formatDate(date) + '.');
    var out = clone(data);
    delete out.days[date][artist];
    if (!Object.keys(out.days[date]).length) delete out.days[date];
    return out;
  }

  function removeDay(data, date) {
    if (!data.days[date]) throw new Error('No hay publicaciones el ' + formatDate(date) + '.');
    var out = clone(data);
    delete out.days[date];
    return out;
  }

  function touch(data, iso) {
    var out = clone(data);
    out.updated = iso || new Date().toISOString();
    return out;
  }

  // ---------------------------------------------------------------- upload helpers
  // kind: 'day' | '2days' | 'week' | 'month' | 'custom'
  function periodDays(start, kind, end) {
    if (!isValidDate(start)) return [];
    var list = [];
    if (kind === 'month') {
      var first = start.slice(0, 8) + '01';
      var n = daysInMonth(+start.slice(0, 4), +start.slice(5, 7));
      for (var i = 0; i < n; i++) list.push(addDays(first, i));
      return list;
    }
    var count = kind === '2days' ? 2 : kind === 'week' ? 7 : 1;
    if (kind === 'custom') {
      if (!isValidDate(end) || end < start) return [start];
      count = 1;
      while (addDays(start, count) <= end && count < MAX_PERIOD_DAYS) count++;
    }
    for (var j = 0; j < count; j++) list.push(addDays(start, j));
    return list;
  }

  // "AreYouKidy 03 08 2026 - Dj Pool World [DPW].zip" -> {prefix:"AreYouKidy", date:"2026-08-03"}
  function parseReleaseName(name, fallbackYear) {
    var s = String(name || '').replace(/ /g, ' ').replace(/\.(zip|rar|7z)$/i, '').trim();
    var m = /^(.*?)[\s_\-]+(\d{1,2})[\s._\-]+(\d{1,2})[\s._\-]+(\d{4})\b/.exec(s);
    var date = null, prefix = s, yearGuessed = false;
    if (m) {
      prefix = m[1];
      date = m[4] + '-' + pad2(+m[3]) + '-' + pad2(+m[2]);
    } else {
      m = /^(.*?)[\s_\-]+(\d{2})(\d{2})\b/.exec(s);
      if (m && fallbackYear) { prefix = m[1]; date = fallbackYear + '-' + m[3] + '-' + m[2]; yearGuessed = true; }
    }
    if (date && !isValidDate(date)) { date = null; yearGuessed = false; }
    return { prefix: prefix.replace(/[\s\-_]+$/, '').trim(), date: date, yearGuessed: yearGuessed };
  }

  function matchArtist(prefix, artists) {
    var k = artistKey(prefix);
    if (!k) return null;
    var best = null, bestLen = 0;
    artists.forEach(function (a) {
      var ak = artistKey(a);
      if (!ak) return;
      if (ak === k) { best = a; bestLen = Infinity; return; }
      if (bestLen === Infinity) return;
      var hit = k.indexOf(ak) === 0 || (ak.length >= 5 && k.indexOf(ak) !== -1) || (k.length >= 5 && ak.indexOf(k) === 0);
      if (hit && ak.length > bestLen) { best = a; bestLen = ak.length; }
    });
    return best;
  }

  // File-name prefixes already published teach which artist they belong to ("TheMashUp - Latin" -> THEMASHUP).
  function learnArtistPrefixes(data) {
    var learned = {};
    Object.keys(data.days || {}).forEach(function (date) {
      Object.keys(data.days[date]).forEach(function (artist) {
        data.days[date][artist].forEach(function (f) {
          var p = parseReleaseName(f.name);
          if (p.date && p.prefix) learned[artistKey(p.prefix)] = artist;
        });
      });
    });
    return learned;
  }

  var NAME_SUFFIXES = ['recordpool', 'records', 'pool', 'com', 'net'];

  // -> { artist, exact } ; exact=false means "guessed by similarity" and must be reviewed by a human.
  function matchArtistInfo(prefix, artists, learned) {
    var k = artistKey(prefix);
    if (!k) return { artist: null, exact: false };
    if (learned && learned[k] && artists.indexOf(learned[k]) !== -1) return { artist: learned[k], exact: true };
    var byKey = {};
    artists.forEach(function (a) { byKey[artistKey(a)] = a; });
    if (byKey[k]) return { artist: byKey[k], exact: true };
    var variants = [k.replace(/^the/, '')];
    NAME_SUFFIXES.forEach(function (s) {
      if (k.length > s.length + 2 && k.slice(-s.length) === s) variants.push(k.slice(0, -s.length), k.slice(0, -s.length).replace(/^the/, ''));
    });
    for (var i = 0; i < variants.length; i++) if (byKey[variants[i]]) return { artist: byKey[variants[i]], exact: true };
    return { artist: matchArtist(prefix, artists), exact: false };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION, DATA_PATH: DATA_PATH, MONTH_NAMES: MONTH_NAMES, MEGA_URL_RE: MEGA_URL_RE, ARTIST_RE: ARTIST_RE,
    esc: esc, clone: clone, isValidDate: isValidDate, todayISO: todayISO, addDays: addDays, monthOf: monthOf, monthLabel: monthLabel,
    formatDate: formatDate, normalizeArtistName: normalizeArtistName, artistKey: artistKey, defaultFileName: defaultFileName,
    normalizeMegaUrl: normalizeMegaUrl, isValidFileName: isValidFileName,
    emptyData: emptyData, canonicalize: canonicalize, serialize: serialize, validate: validate, assertValid: assertValid, parse: parse, sanitize: sanitize,
    listMonths: listMonths, monthDays: monthDays, getFiles: getFiles, artistUsage: artistUsage, findUrl: findUrl,
    addArtist: addArtist, renameArtist: renameArtist, removeArtist: removeArtist, addEntries: addEntries,
    updateFile: updateFile, removeFile: removeFile, removeEntry: removeEntry, removeDay: removeDay, touch: touch,
    periodDays: periodDays, parseReleaseName: parseReleaseName, matchArtist: matchArtist,
    matchArtistInfo: matchArtistInfo, learnArtistPrefixes: learnArtistPrefixes
  };
});
