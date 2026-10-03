# DJ POOL WORLD - GitHub Pages Site

## Proyecto
Plataforma de descargas de DJ pools con sistema de usuarios y enlaces MEGA. Alojada en GitHub Pages.

## URLs
- **Publicada en:** https://failsgamergt-arch.github.io
- **Pagina principal:** https://failsgamergt-arch.github.io/pools.html
- **Admin panel:** https://failsgamergt-arch.github.io/admin.html
- **Repo:** https://github.com/failsgamergt-arch/failsgamergt-arch.github.io
- **Usuario GitHub:** failsgamergt-arch

## Webs enlazadas (navbar + footer)
1. **Blog** → https://djpoolworld.blogspot.com/ (EDM, pools, packs, latin remix)
2. **Wild Sounds** → https://soundcloud.com/wildsoundsmusic (Sets, tracks, latin beats)
3. **Shark Murcia** → https://sharkmurcia-suscripciones.blogspot.com/p/suscripciones.html (Hardstyle, remixes)

## Stack
- HTML: `pools.html` (web publica), `admin.html` (panel admin: subir/gestionar pools + usuarios), `index.html` (redirect a pools)
- Tailwind CSS v3 via CDN con config custom (brand colors, Montserrat font)
- Fuente: Montserrat (400-900)
- Vanilla JS: IntersectionObserver (scroll reveal), localStorage/sessionStorage (auth)
- Datos: `dpw-data/pools.json` (repo aparte dpw-data, UNICA fuente de las publicaciones: artistas + dias → artista → enlaces MEGA), `pools-tracks.js` (17,131 tracks por fecha+artista, solo para "VER CONTENIDO" y buscador)
- Modulos JS: `js/dpw-data.js` (modelo de datos + validacion, compartido web/admin/Node), `js/dpw-github.js` (publicar desde el admin via API de GitHub), `js/dpw-mega.js` (leer nombre de archivo de un enlace MEGA)
- Herramientas: `tools/pools-cli.js` (editar pools por codigo), `tools/test-dpw.js` (tests)
- Logo: `logo-dpw.png` (LOGO FINAL: circulo con globo terraqueo real azul/verde, auriculares, notas musicales; PNG 512x512 con esquinas transparentes, generado desde `OneDrive\Desktop\LOGO FINAL.jpeg`). Usado en header (junto a WORLD) y hero (grande a la derecha)
- Logos antiguos sin uso: `logo-dpw.jpg`, `logodpw.png`

## Estetica (pools.html)
- Tema oscuro espacial (fondo `#050510` con gradiente azul/violeta)
- Fondo imagen: `fondo.jpg` 1672x941 (Tierra azul con anillo luminoso y luces de ciudades, aportada por el socio: `OneDriveDesktop
uevo fondo.jpg`). En `body::before` fijo (`center/cover`, URL `fondo.jpg?v=3` para saltar cache al cambiarlo; subir el numero si se vuelve a cambiar) + velo oscuro degradado en `body::after` (`rgba(3,3,18,.35)` → `.7`). Estrellas y blobs JS por encima
- Paleta adaptada al fondo: azul `#2563eb` principal + fucsia/rosa (`fuchsia-400/500/600`, `pink-600`) como secundario (sustituye a los verdes emerald): subtitulo hero, icono ARCHIVO, filtro de pool, beneficio "años anteriores", boton SUSCRIBIRSE (degradado fucsia→rosa). Contenedores de fechas semi-transparentes (`bg-[#0c0c14]/85 backdrop-blur-sm`) con glow azul+rosa. Las cards de cada pool (`POOL_CARDS`) mantienen sus colores de marca
- Fondo estrellado: 200 estrellas pequenas (blancas, cyan, violeta, verde palido) + 15 estrellas brillantes con glow, animacion `twinkle`
- 40 particulas flotantes generadas por JS (5 colores: azul, cornflower, violeta, cyan, blanco) con 3 trayectorias (`floatA/B/C`)
- 7 blobs de nebulosa: elipses grandes (400-800px) con `blur(80px)`, animaciones lentas (22-40s), colores cyan/verde/violeta/azul
- Neon sweep en separadores: linea de brillo azul recorre los `.neon-line` de izquierda a derecha
- Header: barras ecualizador animadas (eqBounce) + DJ POOL + nota musical + WORLD + logo `logo-dpw.png` 56-64px (hover scale)
- Navbar: POOLS (lista de pools del mes con filtro) | ARCHIVO (meses) | BLOG | WILD SOUNDS | SHARK MURCIA
- Hero: logo `logo-dpw.png` grande a la derecha con glow azul, barras ecualizador + "DJ POOL WORLD" + "El mejor catálogo para tus sesiones de Deejay" (verde)
- Boton "SUSCRIBIRSE" en header (degradado fucsia→rosa, solo visible sin sesion activa, abre modal de suscripcion)
- Cards de pool con colores unicos por pool (28 disenos en `POOL_CARDS`)
- Animaciones: fadeUp, fadeScale, slideDown, pulseNeon, shimmer, eqBounce, twinkle
- Card flip 3D al cambiar tabs (perspective + rotateY, 150ms transicion)
- Hover effects: cards suben 4px + glow azul, botones con shimmer overlay
- Scroll reveal staggered con IntersectionObserver (threshold 0.08, delay por indice)
- Header sticky con shadow on scroll
- Boton scroll-to-top con fade in/out (aparece a 400px scroll)
- Dropdowns hover en navbar: POOLS (pools del mes, 2 columnas, filtro), ARCHIVO (meses), MI CUENTA
- Modals con backdrop blur para login, suscripcion, descarga y editar cuenta
- Flechas de navegacion en tabs de pools (aparecen/desaparecen segun scroll position)
- Buscador de canciones con highlight de resultados (`search-highlight` class)
- Tracklist accordion en modal de descarga (expandible, max 600px, scroll horizontal para nombres largos)
- Frase hero (literal, pedida asi): "Descarga Las Mejores Record DJ Pools Del Mundo"

## Sistema de usuarios
- **Login compartido:** `js/dpw-auth.js` (`DPWAuth.login`) en pools.html y admin.html.
- **Administradores (reales, en cualquier dispositivo):** cuentas en `dpw-data/access.json` (ver "Cuentas de admin y llave de publicacion"). Las contraseñas de admin NO estan en el codigo (antes `admin/admin2026` y `sharkmusic/shark-music_2026` eran visibles para cualquiera: eliminadas). Solo se es admin abriendo tu hueco cifrado con tu contraseña.
- **Usuarios normales (descargas):** localStorage (`dpw_users`, `dpw_deleted`) + sessionStorage (`dpw_session`), solo de ese navegador. Defaults: `prueba1` / `prueba_1`, `demo` / `demo123`. Nunca pueden ser admin (entradas antiguas con rol admin en localStorage se descartan).
- **Sync de defaults:** `DPWAuth.getUsers()` inyecta defaults que no esten en `dpw_deleted`
- **Reset:** Anadir `?reset` a la URL limpia localStorage y recarga
- **Dropdown de cuenta:**
  - Sin sesion: "No has iniciado sesion" + boton login
  - Usuario: nombre + "EDITAR MI CUENTA" + "CERRAR SESION"
  - Admin: nombre + "PANEL ADMIN" + "CAMBIAR MI CONTRASEÑA" (→ `admin.html#admins`) + "CERRAR SESION"
- **Editar cuenta (usuarios normales):** Modal para cambiar nombre y password (con confirmacion)
- **Suscripcion:** Modal con precio **100€/año** (NO al mes), enlace PayPal directo (`paypal.com/paypalme/djpoolworld/100`), enviar comprobante a `djpoolworld@gmail.com` para que se cree el usuario. Beneficios: todas las pools, actualizaciones mensuales, **acceso a descargas de años anteriores**, usuario personalizado. Boton visible solo sin sesion activa.

## Pagina de Pools (pools.html)
- **Carga de datos:** `fetch('dpw-data/pools.json?t=<timestamp>', {cache:'no-store'})` (repo aparte `dpw-data`, servido por GitHub Pages en `/dpw-data/`) al abrir la pagina (sin cache → lo que publica el admin se ve en cuanto GitHub Pages despliega, ~1 min). Si el JSON trae errores se valida con `DPW.validate` y se pinta solo lo valido (`DPW.sanitize`); si no carga, mensaje "NO SE PUDIERON CARGAR LAS POOLS" + REINTENTAR (la web nunca queda en blanco)
- **Por meses:** se muestra UN mes, del dia mas reciente al dia 1 (`DPW.monthDays`). Mes por defecto = el mas reciente con publicaciones. Cambio de mes desde ARCHIVO (header), bloque ARCHIVO al final de la pagina (`#archive-bottom`: chips de meses + MES ANTERIOR / MES SIGUIENTE) o menu movil. El mes va en la URL: `pools.html#mes=2026-08`
- **Botones dinamicos sin JS inline:** todo lo que lleva datos usa `data-action` (`month`, `pool`, `tab`, `download`, `search-hit`, `reload`) + un listener delegado; textos siempre escapados con `DPW.esc`
- **Artistas sin diseno en `POOL_CARDS`:** `cardFor()` genera una card con degradado automatico y el nombre (un artista nuevo nunca rompe la seccion)
- **Filtro por pool:** menu POOLS lista las pools del mes en 2 columnas (+ "TODAS LAS POOLS"); `filterPool(name)` re-renderiza solo las fechas de esa pool con una unica tab, muestra barra `#pool-filter-bar` ("MOSTRANDO X · N FECHAS" + boton "VER TODAS LAS POOLS") y el titulo pasa a "AGOSTO 2026 | X". `filterPool(null)` quita el filtro. Estado en `currentMonth` / `currentPool`, render en `refreshView()`
- **Contenido actual:** agosto 2026 → 26 fechas, 25 artistas, 365 enlaces, 17,131 tracks (`LATINREMIXES.COM` ya fusionado en `LATIN REMIXES` durante la migracion; `POOL_ALIASES` eliminado)
- **Tabs por fecha:** click cambia card visual + boton descarga con flip 3D
- **Flechas de tabs:** `scrollTabs(idx, dir)` desplaza 250px, `updateTabArrows(idx)` muestra/oculta flechas segun scroll position (gradiente fade con bg del card container)
- **28 pool cards visuales:** definidos en `POOL_CARDS` con bg/html unicos por pool
- **Descarga:** modal con tracklist accordion + enlaces MEGA (requiere login) o prompt de login
- **Tracklist en modal:** boton "VER CONTENIDO (N tracks)" despliega lista con nombre de cada track (accordion con `max-height` transition)
- **Stats en hero:** archivos, pools, fechas y tracks DEL MES mostrado (de `dpw-data/pools.json` + `TRACK_LIST`)
- **Buscador de canciones:**
  - Input en hero section con debounce 250ms
  - Busca en `TRACK_LIST` (17,131 tracks, todos los meses, mas recientes primero; solo tracks de publicaciones que existen) por nombre de cancion, artista o remix
  - Max 50 resultados, con highlight del texto buscado
  - Click en resultado abre el modal de descarga del pool/fecha correspondiente
  - Dropdown `z-50` dentro del hero `z-20` para aparecer encima de las secciones de abajo
- **Overflow controlado:** `overflow-x-hidden` en body y main, `overflow-hidden` en card container (evita scroll horizontal por `min-w-max` en tabs)
- **CSS stacking:** Hero section `z-20` para que el dropdown de busqueda aparezca encima de las secciones de fechas

## Admin Panel (admin.html)
- **Entrada:** pantalla propia de login (usuario + contraseña de admin). Si la publicacion nunca se activo (GitHub dice que no existe `access.json`) muestra "ACTIVAR PUBLICACION" (una sola vez). Si GitHub no responde, muestra el login con el error (nunca la activacion por error).
- **Pestañas:** SUBIR POOLS | GESTIONAR | ARTISTAS | HISTORIAL | ADMINS | USUARIOS (la ultima abierta se recuerda en `sessionStorage.dpw_admin_tab`; `admin.html#admins` abre ADMINS)
- **Ver secciones "Subida y edicion de pools (CMS)" y "Cuentas de admin y llave de publicacion".** USUARIOS = cuentas de descarga de ese navegador (stats total/activos/inactivos, busqueda, crear/editar/activar/borrar; sin rol admin).
- **Renombrar usuarios:** marca nombre antiguo en `dpw_deleted` para evitar re-add de defaults

## Subida y edicion de pools (CMS)
La web es estatica (GitHub Pages, sin servidor). Para que lo que sube un admin lo vean todos, el panel **escribe `pools.json` en el repo aparte `failsgamergt-arch/dpw-data`** con la API de GitHub; GitHub Pages lo publica en `https://failsgamergt-arch.github.io/dpw-data/pools.json` (~1 min). El admin solo usa usuario y contraseña.

- **Por que un repo aparte:** la llave de publicacion solo tiene acceso a `dpw-data` (datos). Aunque alguien la consiguiera, no podria tocar el codigo de la web, y todo dato se valida y escapa al pintarse.
- **En local:** `dpw-data/` es una carpeta (en `.gitignore` del repo principal) con `pools.json`, `access.json` (cuando exista), `.nojekyll` y `README.md`; es el clon del repo de datos, asi `python -m http.server` sirve la web igual que en produccion.

### Formato de `dpw-data/pools.json`
```json
{ "version": 1, "updated": "ISO", "artists": ["AREYOUKIDY", "BPM SUPREME", ...],
  "days": { "2026-08-31": { "BPM SUPREME": [ { "name": "Bpm Supreme 31 08 2026 - Dj Pool World [DPW]", "url": "https://mega.nz/file/XXXX#KEY" } ] } } }
```
- Una **seccion** de la web = un dia; cada **artista** del dia = una pestana; cada enlace = una descarga del modal (puede haber varias por artista/dia).
- Reglas (en `DPW.validate`, se aplican SIEMPRE antes de guardar): fecha real `YYYY-MM-DD`; artista en MAYUSCULAS registrado en `artists` (`^[A-Z0-9ÁÉÍÓÚÑÜÇ][A-Z0-9ÁÉÍÓÚÑÜÇ .&+\-!]{0,39}$`); enlace solo `https://mega.nz/file|folder/...#clave` (formatos antiguos `#!` se convierten); nombre 1-200 caracteres sin `< >`; sin enlaces repetidos en el mismo artista/dia.
- Se guarda canonico (`DPW.serialize`): dias de mas nuevo a mas viejo, artistas y pools en orden alfabetico, 2 espacios. Todas las operaciones son puras (no mutan).
- Nombre por defecto si no se da: `Titulo Artista DD MM AAAA - Dj Pool World [DPW]` (`DPW.defaultFileName`).

### Flujo del admin (admin.html)
- **SUBIR POOLS** (3 pasos, borrador guardado en `localStorage.dpw_upload_draft` hasta publicar):
  1. Periodo: 1 DIA / 2 DIAS / 1 SEMANA / MES COMPLETO / PERSONALIZADO (max 62 dias) + fecha (`DPW.periodDays`).
  2. Por cada dia: pulsar los chips de artistas → aparece una fila (dia, artista, enlace, nombre) → pegar enlace MEGA. Al pegar, `DPWMega.resolve` lee el nombre real del archivo en MEGA y rellena el nombre (y avisa en amarillo si el archivo parece de otro dia/artista). El enlace solo se guarda al **pegarlo** o al salir del campo/Enter (borrar o teclear no guarda un enlace a medias); enlaces MEGA exactos (clave 43/22 caracteres). Cada fila tiene selector de DIA para moverla. **PEGADO RAPIDO**: pegar muchos enlaces de golpe → detecta dia y artista por el nombre del archivo (`DPW.parseReleaseName` + `DPW.matchArtistInfo`, que aprende de los nombres ya publicados: "TheMashUp - Latin" → THEMASHUP, "Digital Music Pool" → DIGITAL MUSIC) y los coloca solos; lo dudoso (artista por parecido, nombre sin fecha completa, MEGA ilegible) queda con aviso amarillo para revisar. **+ NUEVO ARTISTA** solo se guarda si se usa al publicar (los no usados se quitan con ✕).
  3. Revisar (listos / con problemas / avisos / fechas futuras) → PUBLICAR. Solo se suben las filas validas; si el artista ya tenia publicacion ese dia, el enlace se anade como descarga extra (nunca se borra nada al subir).
- **GESTIONAR:** por mes y filtro de artista; EDITAR (dia, artista, nombre, enlace — mover de dia/artista incluido; si falla, el modal se queda abierto con el error), BORRAR enlace, + ANADIR a un dia, BORRAR DIA (solo borra lo que se mostro; lo que otro admin añadiera mientras tanto se queda). Las referencias se buscan por URL en la version mas reciente.
- **ARTISTAS:** anadir, renombrar (cambia todas sus publicaciones; las tracklists antiguas de `pools-tracks.js` quedan con el nombre viejo), borrar solo si tiene 0 publicaciones.
- **HISTORIAL:** ultimos 30 cambios de `pools.json` (commits del repo dpw-data) con RESTAURAR (deja los datos como en esa version, como cambio nuevo → tambien se puede deshacer). Funciona aunque el archivo actual este dañado.
- **ADMINS:** cambiar mi contraseña, añadir/quitar admins (nunca el ultimo), renovar la llave de publicacion.
- **Seguridad de escritura (`DPWGitHub.commit`):** cada cambio relee la ultima version de GitHub, aplica la operacion, valida y hace PUT con el `sha`; si otro admin guardo a la vez (409/422) reintenta hasta 3 veces sobre los datos frescos. Si el archivo tiene errores (editado a mano) se trabaja sobre su parte valida y el siguiente guardado lo repara; si no es JSON valido, solo se puede RESTAURAR. Commits con mensaje `admin(<usuario>): <accion>`.

### Cuentas de admin y llave de publicacion (sin tokens para los admins)
- **Para el admin:** entra con usuario y contraseña (en `admin.html` o en el login de la web) y publica. Desde cualquier ordenador o movil. Nada mas.
- **Como funciona (`js/dpw-vault.js`):** `dpw-data/access.json` (publico) guarda la llave de GitHub cifrada (AES-256-GCM) con una clave maestra aleatoria; cada admin tiene un "hueco" con esa clave maestra cifrada con su contraseña (PBKDF2-SHA256 600.000 iteraciones). Al entrar se descifra en el navegador y la llave queda solo en `sessionStorage.dpw_pub` de esa pestaña (se borra al cerrar sesion o cerrar la pestaña). Ninguna contraseña ni la llave se guardan en claro en ningun sitio.
- **Contraseñas de admin:** minimo 12 caracteres, letras y numeros, al menos 6 caracteres distintos, sin el nombre de usuario ni contraseñas obvias (`DPWVault.passwordProblem`). Boton GENERAR crea una segura tipo `4yGs-q5Fh-NtXt-UJv9`. Es la UNICA proteccion de la llave publica: no usar contraseñas faciles.
- **Activacion (una sola vez, la hace el dueño de la cuenta failsgamergt-arch):** abrir `admin.html` → "ACTIVAR PUBLICACION" → boton "ABRIR GITHUB" (enlace prerrellenado: nombre, `expires_in=none`, `contents=write`) → elegir *Only select repositories* → **dpw-data** → Generate token → pegar la llave + crear su usuario/contraseña de admin → ACTIVAR. Despues añade al socio desde ADMINS.
- **Renovar llave (solo si GitHub deja de aceptarla, p.ej. si se borro):** ADMINS → LLAVE DE PUBLICACION → crear una nueva con el mismo boton y pegarla. Ningun admin cambia su contraseña.
- **Olvido de contraseña:** otro admin le crea una nueva (quitar + añadir). Si se pierde la ultima contraseña de admin: el dueño borra `access.json` del repo `dpw-data` en github.com (o `gh api -X DELETE repos/failsgamergt-arch/dpw-data/contents/access.json -f message=reset -f sha=<sha>`) y vuelve a ACTIVAR con una llave nueva (y revoca la vieja en GitHub → Settings → Developer settings → Fine-grained tokens).
- `node tools/pools-cli.js admins` lista los admins actuales.

### Edicion por codigo (CLI, sin abrir el panel)
Desde la carpeta del repo (o pidiendoselo a Claude). Trabaja **directamente sobre el repo `dpw-data` en GitHub** con el `gh` ya autenticado de este PC (sin clonar, sin conflictos con lo que publican los admins; visible en la web en ~1 min). `--file dpw-data/pools.json` para trabajar sobre la copia local:
```
node tools/pools-cli.js validate                      # comprueba pools.json
node tools/pools-cli.js months                        # meses con dias/enlaces
node tools/pools-cli.js list --month 2026-08          # o --date 2026-08-31
node tools/pools-cli.js add --date 2026-09-01 --artist "BPM SUPREME" --url "https://mega.nz/file/..#.." [--name ".."] [--new-artist]
node tools/pools-cli.js edit --date 2026-09-01 --artist "BPM SUPREME" [--index 1] [--to-date ..] [--to-artist ..] [--url ..] [--name ..]
node tools/pools-cli.js remove --date 2026-09-01 [--artist "BPM SUPREME" [--index 1]]
node tools/pools-cli.js artists | artist-add "NOMBRE" | artist-rename "VIEJO" "NUEVO" | artist-remove "NOMBRE"
node tools/pools-cli.js admins                        # lista admins de access.json
```
- `--dry-run` en cualquier comando de escritura para previsualizar. Usa las mismas reglas que el panel; nunca guarda datos invalidos. En remoto hace commit `cli: <accion>` con el sha (si otro admin guardo justo a la vez, falla y se repite).
- `gh` se busca en `DPW_GH`, `C:/Program Files/GitHub CLI/gh.exe` o el PATH.

## Estructura
```
index.html          -- Redirect a pools.html (meta refresh + JS)
pools.html          -- Web publica (lee dpw-data/pools.json)
admin.html          -- Panel admin: login/activacion, subir/gestionar pools, artistas, historial, admins, usuarios
dpw-data/           -- (gitignored) clon del repo failsgamergt-arch/dpw-data: pools.json, access.json, .nojekyll, README.md
js/dpw-data.js      -- Modelo + validacion + operaciones (web, admin y Node)
js/dpw-vault.js     -- Cuentas de admin + llave de publicacion cifrada (access.json)
js/dpw-auth.js      -- Login compartido (admins via access.json, usuarios via localStorage)
js/dpw-github.js    -- Publicar en el repo dpw-data via API de GitHub (solo admins con sesion)
js/dpw-mega.js      -- Lee nombre/tamano de un enlace MEGA (autorrelleno en admin)
tools/pools-cli.js  -- CLI para editar pools por codigo (remoto via gh, o --file local)
tools/test-dpw.js   -- Tests del modelo, del cifrado y de los datos reales (node tools/test-dpw.js)
.gitignore          -- ignora dpw-data/
pools-tracks.js     -- 17,131 tracks (const TRACK_LIST, claves "YYYY-MM-DD" -> artista -> [tracks])
logo-dpw.png        -- LOGO FINAL circular con fondo transparente (header + hero)
logo-dpw.jpg        -- Logo antiguo (altavoces + mesa, no usado)
logodpw.png         -- Logo antiguo recortado (no usado)
fondo.jpg           -- Fondo web (Tierra azul con anillo, 1672x941)
nebula-bg.jpg       -- Fondo hero antiguo (no usado en pools)
image 1-3.jpeg      -- Capturas de referencia (yourlatinmusic.es), sin commitear
favicon.jpg         -- Tiburon neon azul (favicon)
CLAUDE.md           -- Este archivo
```

## Dominio
- Accesible via `failsgamergt-arch.github.io`
- Dominio `websysoluciones.es` disponible para subdominios gratis (CNAME a GitHub Pages)

## Deploy
- Push a `main` → GitHub Pages despliega automaticamente
- Forzar rebuild: `gh api repos/failsgamergt-arch/failsgamergt-arch.github.io/pages/builds -X POST`
- GitHub CLI en `C:\Program Files\GitHub CLI`
- Autenticado (token expuesto, pendiente de renovar)

## Carteles de referencia
- `H:\CARTELES DJPOOLWORLD` - logos/carteles de DJ pools

## Script DJ Pool World Processor
- **Ubicacion:** `C:\Users\Javier\OneDrive\Desktop\prueba\djpool_processor.py`
- **Dependencia Python:** `mutagen` (pip install mutagen)
- **MEGAcmd:** `C:\Users\Javier\AppData\Local\MEGAcmd` (mega-put.bat)
- **Que hace:**
  1. Busca .zip/.rar en la carpeta de trabajo (`OneDrive\Desktop\prueba`)
  2. Extrae los ZIPs
  3. Renombra: `AreYouKidy 0107` → `AreYouKidy 01 07 2026 - Dj Pool World [DPW]`
  4. Edita tags MP3: Album = `https://djpoolworld.blogspot.com/`, cover art = `cover_dpw2026.jpg`
  5. Re-comprime en ZIP y sube a MEGA (carpeta `/DjPoolWorld/`)
- **Configuracion actual:**
  - `WORK_DIR`: `C:\Users\Javier\OneDrive\Desktop\prueba`
  - `COVER_PATH`: `cover_dpw2026.jpg` (logo DJ Pool World 2026 - globo con auriculares, en WORK_DIR)
  - `ALBUM_NAME`: `https://djpoolworld.blogspot.com/`
  - `YEAR`: `2026`
  - `SUFFIX`: `Dj Pool World [DPW]`
  - `MEGA_DEST`: `DjPoolWorld`
- **Limitaciones:** RAR no soportado aun (solo ZIP)
- **Ejecucion:** `python djpool_processor.py` desde cualquier sitio

## Script DJTools.vip Downloader
- **Ubicacion:** `C:\Users\Javier\OneDrive\Desktop\prueba\djtools_downloader.py`
- **Dependencias Python:** `requests`, `beautifulsoup4` (pip install requests beautifulsoup4)
- **Que hace:**
  1. Login automatico en djtools.vip
  2. Lista pools disponibles (por fecha/categoria)
  3. Menu interactivo para seleccionar pools
  4. Descarga .rar/.zip en paralelo (4 hilos, configurable)
  5. Guarda en `OneDrive\Desktop\prueba\downloads\`
- **Config:** USERNAME/PASSWORD al inicio del script (o se piden por consola)
- **Estado:** Estructura base - los selectores CSS pueden necesitar ajuste tras primer login real
- **Si falla el parseo:** Guarda HTML debug en `_debug_page.html` para analizar

## Script DJPoolRecords.com Downloader
- **Ubicacion:** `C:\Users\Javier\OneDrive\Desktop\prueba\djpoolrecords_downloader.py`
- **Dependencias Python:** `selenium`, `beautifulsoup4` (pip install selenium beautifulsoup4)
- **Requiere:** Chrome instalado (usa ChromeDriver automatico)
- **Login:** `https://djpoolrecords.com/djpoolrecords-user-login/` (sin captcha, auto-login)
- **Que hace:**
  1. Abre Chrome, login automatico en djpoolrecords.com
  2. Navega a categoria elegida, lista posts
  3. Filtra por fecha con `--date`
  4. Hace click en el primer .zip de cada post (contiene todas las canciones)
  5. Chrome descarga directamente en la carpeta destino
- **Guarda en:** `OneDrive\Desktop\prueba\downloads_djpoolrecords\`
- **Credenciales:** Hardcodeadas en el script (email + password)
- **Uso CLI (modo automatico, cierra Chrome al terminar):**
  - `python djpoolrecords_downloader.py 2 A --date "01/09/2026"` (Latin Records, todos, fecha)
  - `python djpoolrecords_downloader.py 3 1,2,3` (Latin Box, posts 1-3)
  - `python djpoolrecords_downloader.py --list` (ver categorias)
- **Uso interactivo:** `python djpoolrecords_downloader.py` (menus en consola)
- **Categorias:** 1=Home, 2=Latin Records, 3=Latin Box, 4=Bpm Latino, 5=Latin Remixes, 6=Unlimited Latin, 7=Dale Mas Bajo, 8=Just Play Remix, 9=Collections, 10=Videos, 11=TheBeatfreakz, 12=Funkymix, 13=Crack 4 DJs, 14=Club Killers, 15=Digital Music Pool, 16=Direct Music Service
- **Sistema de descarga:** Usa plugin Lets-Box (Google Drive) via admin-ajax.php
- **Si falla el parseo:** Guarda HTML debug en `_debug_*.html`

## Pendrive KINGSTON (H:) - Agosto 2026
- **352 archivos** .zip/.rar (154.9 GB) con pools de DJ
- **Renombrados** con `rename_pendrive.py` al formato: `NombrePool DD MM 2026 - Dj Pool World [DPW].ext`
- **Tracklist:** `H:\TRACKLIST djpoolworld AGOSTO 2026.txt` (23 pools, 352 entries)
- **Typos corregidos:** `LatinRemxies.com` → `LatinRemixes.com`, `TheMashUp - Latn` → `TheMashUp - Latin`
- **Copia SSD:** `C:\Users\Javier\Desktop\PENDRIVE_DPW` (copia completa para procesado rapido)

## Tags MP3 - Pendrive Agosto 2026
- **Scripts:** `tag_pendrive_mp3s.py`, `tag_pendrive_fast.py` (paralelo 6 threads), `tag_retry.py`, `tag_last3.py`
- **Ubicacion scripts:** `C:\Users\Javier\OneDrive\Desktop\prueba\`
- **Que hacen:** Extraen cada zip/rar, aplican tags a los MP3 y recomprimen
  - Cover art: `cover_dpw2026.jpg` (APIC tag)
  - Album: `https://djpoolworld.blogspot.com/` (TALB tag)
- **Resultado:** 349/352 tageados OK. 3 archivos corruptos (no se pueden procesar):
  - `Crooklyn Clan 12 08 2026` (RAR cabecera danada)
  - `Crooklyn Clan 14 08 2026` (RAR cabecera danada)
  - `MP3 Mixes Pool 04 08 2026` (ZIP corrupto)
- **Nota:** Los archivos `MP3 Mixes Pool` tienen non-breaking spaces (`\xa0`) en el nombre
- **WinRAR:** `C:\Program Files\WinRAR\` (UnRAR.exe y Rar.exe)
- **Temp corto:** Usar `C:\_tt` o `C:\_t` para evitar errores de ruta larga con WinRAR

## Renombrado de archivos pendrive
- **Script:** `C:\Users\Javier\OneDrive\Desktop\prueba\rename_pendrive.py`
- **3 formatos de nombre detectados** y parseados automaticamente
- **Solo renombra los .zip/.rar**, NO las carpetas internas

## Blogpost Agosto 2026
- **Archivo base:** `C:\Users\Javier\OneDrive\Desktop\prueba\blogpost_agosto_2026.html` (sin links, con 28 pools)
- **Archivo final:** `C:\Users\Javier\OneDrive\Desktop\prueba\blogpost_agosto_2026_links.html` (con 365 links MEGA)
- **Basado en:** template de julio 2026 de djpoolworld.blogspot.com
- **28 pools** con sus entries listadas (23 originales + 5 nuevos)
- **365 entries con link MEGA** insertados via `inject_links.py` (352 originales + 13 nuevos)
- **Formato:** `<span style="font-size: medium;"><a href="MEGA_LINK" target="_blank">Entry Name</a></span>`
- **Imagenes de pools** incluidas (Blogger URLs):
  - Bpm Latino, Bpm Supreme, MP3 Mixes Pool, Remix Planet (anadidas manualmente)
  - Club Killers, Latin Remixes, etc. (extraidas del template julio)
  - Dirty Sounds, Elite Remix, Latin Box, Unlimited Latin, Urban Zone (extraidas del template julio via `add_new_pools.py`)
- **Header:** imagen de julio (pendiente cambiar a agosto)

## Subida MEGA - Agosto 2026
- **Estado: COMPLETADA** - 365/365 archivos subidos, 365/365 links generados
- **Scripts:**
  - `mega_upload.py` - v1 con export individual por archivo (lento)
  - `mega_upload2.py` - v2 con bulk export al final (usado para subida original 352)
  - `mega_export_links.py` - Genera links individuales para todos los archivos (352 OK)
  - `inject_links.py` - Inyecta links MEGA en el blogpost HTML (365 links)
  - `upload_new.py` - Subida de 13 nuevos pools (standalone, Python subprocess)
  - `add_new_pools.py` - Inserta secciones de 5 nuevos pools en el blogpost HTML
  - `process_new_pools.py` - Pipeline completo nuevos pools (copy, clean, tag, zip, upload)
- **Guarda progreso:** `_upload_progress.json` (archivo → cuenta email)
- **Links:** `_mega_links.json` (365 archivos → link MEGA)
- **Archivos de control en:** `C:\Users\Javier\Desktop\PENDRIVE_DPW\`
- **Nota:** El bulk export (`mega-export -a -f /DjPoolWorld`) solo devuelve 1 link por cuenta; hay que exportar archivo por archivo
- **Cuentas MEGA (8 cuentas, 20 GB gratis cada una):**

| # | Cuenta | Password | Archivos | GB |
|---|--------|----------|----------|----|
| 1 | djpoolworldmega@outlook.es | Ossas_1234 | 77 | ~19.5 |
| 2 | djpoolworldmega2@outlook.es | Ossas_1234 | 25 | 19.4 |
| 3 | djpoolworldmega3@outlook.es | Ossas_1234 | 57 | ~19.0 |
| 4 | djpoolworldmega4@outlook.es | Ossas_1234 | 10 | 19.1 |
| 5 | djpoolworld54@outlook.com | premiumshark1988 | 18 | 18.8 |
| 6 | djpoolworld52@outlook.com | premiumshark1988 | 71 | 19.2 |
| 7 | djpoolworld53@outlook.com | premiumshark1988 | 75 | 18.7 |
| 8 | djpoolworld51@outlook.com | premiumshark1988 | 32 | ~18.8 |

- **Distribucion por cuenta (originales):**
  1. AreYouKidy → Bpm Supreme 06
  2. Bpm Supreme 07 → Club Killers 12
  3. Club Killers 13 → Da Zone 06
  4. Da Zone 07 → Da Zone 20
  5. Da Zone 21 → Digital Music Pool 15
  6. Digital Music Pool 18 → Dj City Latino 08
  7. Dj City Latino 10 → Remix Planet 20
  8. Remix Planet 21 → TheMashUp 31

- **Distribucion nuevos pools (13 archivos):**
  - Cuenta 8 (djpoolworld51): 6x Latin Box + 1x Dirty Sounds (7 archivos)
  - Cuenta 1 (djpoolworldmega): 2x Elite Remix + 2x Urban Zone (4 archivos)
  - Cuenta 3 (djpoolworldmega3): 2x Unlimited Latin (2 archivos)

- **Cuenta MEGA principal:** failsgamergt@gmail.com (20 GB, vaciada, no usada para agosto)

## pools-links.js (ELIMINADO oct 2026 → migrado a dpw-data/pools.json)
- Se migro con fechas completas (año 2026), fusionando `LATINREMIXES.COM` en `LATIN REMIXES`. Datos historicos de como se genero:
- **Generado desde:** `_mega_links.json` (365 entries)
- **Formato:** `const MEGA_LINKS = { "DD_MM": { "POOL NAME": [{name, url}] } }`
- **26 fechas** (agosto 2026), **26 pools unicos**, **365 archivos**
- **Alias:** `LATINREMIXES.COM` aparece en dias 07 y 22 (mapeado a `LATIN REMIXES` en UI)
- **Pool names en MEGA_LINKS:** AREYOUKIDY, BEATFREAKZ, BEEZO BEEHIVE, BPM LATINO, BPM SUPREME, CLUB KILLERS, CRACK 4 DJS, CROOKLYN CLAN, DA ZONE, DIGITAL MUSIC, DIRTY SOUNDS, DJ CITY, DJ CITY LATINO, ELITE REMIX, EUROPA REMIX, HEADLINER, LATIN BOX, LATIN REMIXES, LATINREMIXES.COM, MP3 MIXES POOL, PRO LATIN, REMIX PLANET, ROMPE DISCOTECA, THEMASHUP, UNLIMITED LATIN, URBAN ZONE

## pools-tracks.js (generacion)
- **Generado desde:** extraccion de nombres de archivo dentro de los ZIP/RAR de cada pool
- **Formato (desde oct 2026):** `const TRACK_LIST = { "YYYY-MM-DD": { "ARTISTA": ["track1.mp3", ...] } }` — mismas claves de fecha y artista que `dpw-data/pools.json` (solo se muestran tracks de publicaciones que existen). Las tracklists NO se suben desde el admin (opcionales; las subidas nuevas no las necesitan)
- **Toilet Break:** la clave aparte `THEMASHUP - TOILET BREAK` (23 tracks en 6 fechas) se fusiono en `THEMASHUP`, porque su enlace es parte de esa publicacion
- **17,131 tracks** distribuidos en 26 fechas y 25 artistas (oct 2026: +789 tracks de 19 entradas que faltaban: Latin Box x6, Elite Remix x2, Urban Zone x2, Unlimited Latin x2, Dirty Sounds, Beatfreakz x3, Beezo BeeHive 13/08, Da Zone 22/08 y 24/08, extraidos de los ZIP/RAR de `PENDRIVE_DPW` y `PENDRIVE_DPW\NUEVOS`)
- **Sin tracklist:** solo `MP3 Mixes Pool 04 08` (ZIP corrupto)
- **Usado por:** buscador de canciones (`handleSongSearch`), tracklist accordion en modal de descarga (`getTrackList`)
- **Encoding fix aplicado (sep 2026):** 180 caracteres Unicode corruptos reparados. Tres patrones de corrupcion de WinRAR UnRAR.exe corregidos: cp437→Latin-1 (¡→í, ¤→ñ, Æ→ã), NFD combining via cp437 (╠ü→acute, ╠â→tilde), cp1252→cp437 (‚→é, †→å, ‰→ë, ‹→ï, "→ö, ™→Ö). Tambien: NBSP→espacio, ├ÿ→Ø, NFC normalization.

## Otros scripts en prueba
- `rename_zip_folders.py` - Renombra carpetas internas de ZIPs (NO USAR, no era necesario)
- `rename_rar_folders.py` - Renombra carpetas internas de RARs (NO USAR, no era necesario)

## Pipeline completo Agosto 2026 (COMPLETADO)
1. Descarga pools → pendrive KINGSTON (H:)
2. Copia a SSD → `C:\Users\Javier\Desktop\PENDRIVE_DPW\`
3. Renombrado → `rename_pendrive.py` (352 archivos)
4. Tags MP3 → `tag_pendrive_fast.py` + `tag_retry.py` + `tag_last3.py` (349/352 OK, 3 corruptos)
5. Subida MEGA → `mega_upload2.py` (352/352 OK, 8 cuentas)
6. Export links → `mega_export_links.py` (352/352 links)
7. Blogpost HTML → `inject_links.py` (352 links insertados en `blogpost_agosto_2026_links.html`)
8. **Nuevos pools** → `process_new_pools.py` + `upload_new.py` (13 carpetas: copy, clean, tag 380 MP3s, zip, upload)
9. **Actualizar blogpost** → `add_new_pools.py` (5 nuevas secciones con imagenes) + `inject_links.py` (365 links total)
10. Publicar en Blogger → pendiente (copiar HTML de `blogpost_agosto_2026_links.html`)
11. **Web DJ Pool World** → `pools.html` + `dpw-data/pools.json` (antes `pools-links.js`) + `pools-tracks.js` + `admin.html` (plataforma completa con auth, busqueda, tracklists)
12. **Meses siguientes:** subir los enlaces MEGA desde admin → SUBIR POOLS (PEGADO RAPIDO detecta dia y artista solos) o con `tools/pools-cli.js add`

## Nuevos Pools Agosto 2026 (5 pools, 13 carpetas)
- **Carpetas SSD:** `C:\Users\Javier\Desktop\PENDRIVE_DPW\NUEVOS\`
- **Pools y entries:**
  - Dirty Sounds: 1 entry (15 08)
  - Elite Remix: 2 entries (10 08, 24 08)
  - Latin Box: 6 entries (01 08, 08 08, 15 08, 24 08, 29 08, 31 08)
  - Unlimited Latin: 2 entries (10 08, 24 08)
  - Urban Zone: 2 entries (10 08, 24 08)
- **Procesado:** 380 MP3s tageados, 13 ZIPs (3.15 GB total)
- **Subido:** 13/13 OK, 13/13 links generados

## Bugs conocidos
- (Ninguno actualmente)

## Fixes aplicados
- **Rediseño visual (sep 2026):** Cambio de color principal de neon amarillo (#dfff00) a azul intenso (#2563eb). Fondo espacial con estrellas titilantes + nebulosas. Hero rediseñado: logo decorativo, barras ecualizador, frase actualizada, fondo semi-transparente azul. Boton suscribirse en header. Tracklist con scroll horizontal. Barras ecualizador animadas en header.
- **Rediseño v2 (oct 2026, feedback del socio):** LOGO FINAL circular (`logo-dpw.png`) en header junto a WORLD y en hero; frases hero nuevas; suscripcion 100€/año + `djpoolworld@gmail.com` + acceso a años anteriores; menu POOLS con filtro por pool y menu ARCHIVO con meses; +789 tracks en 19 entradas sin tracklist.
- **Fondo HD (oct 2026):** el `fondo.avif` aportado era 626x357 (se veia borroso); sustituido por Nebulosa del Velo de Hubble a 3200x1800 retocada a azul/rosa/violeta. Paleta secundaria verde → fucsia para encajar con el fondo.
- **CMS de pools (oct 2026):** subida/edicion/borrado de pools desde admin.html (escribe `dpw-data/pools.json` via API de GitHub; admins solo con usuario y contraseña, llave cifrada en access.json), artistas persistentes, historial con restaurar, CLI `tools/pools-cli.js`. Web publica dividida por meses (mas reciente primero) con ARCHIVO arriba y al final. Renders sin JS inline y con escape (antes los nombres iban dentro de `onclick`). Verificado con tests unitarios (`tools/test-dpw.js`) y pruebas end-to-end en Chrome headless (web 20/20, admin 36/36 contra un GitHub simulado) + revision multi-agente (datos, seguridad, web publica, API GitHub, flujos admin) con fallos confirmados corregidos.
- **Fondo nuevo (oct 2026):** la Tierra azul de `nuevo fondo.jpg` sustituye a la nebulosa de Hubble; quitado el credito ESA/Hubble del footer (ya no se usa esa imagen).
- **Cache GitHub Pages:** si no se ven cambios tras push, forzar rebuild (`gh api .../pages/builds -X POST`) y abrir con `?v=<commit>` en incognito.
- **Unicode pools-tracks.js (sep 2026):** 180 caracteres corruptos reparados con script Node.js. Tres cadenas de corrupcion de WinRAR corregidas:
  1. **cp437→Latin-1** (26 fixes): bytes A0-A5 interpretados como Latin-1 en vez de cp437 (¡→í, ¢→ó, £→ú, ¤→ñ, ¥→Ñ, Æ→ã)
  2. **NFD combining via cp437** (73 fixes): bytes CC+XX (combining marks UTF-8) leidos como cp437 (╠ü→acute, ╠â→tilde)
  3. **cp1252 en vez de cp437** (54 fixes): bytes 80-9F leidos como cp1252 (‚→é, †→å, ‰→ë, ‹→ï, "→ö, ™→Ö, ›→ö)
  4. **Otros** (27 fixes): ΓÇô→–, ├ÿ→Ø, NBSP→espacio, ´→apostrofo, Jaÿ-Z→Jay-Z, NFC normalization

## Funcionalidades pendientes
- **Usuarios compartidos entre dispositivos:** los usuarios viven en el `localStorage` de cada navegador (los defaults estan en el codigo). Un usuario creado en el admin NO existe en el movil del suscriptor → hace falta un sistema real (p.ej. Firebase Auth/Supabase) para que las suscripciones funcionen de verdad.
- **Audio preview 30s:** Vista previa de 30 segundos via Deezer API (gratis, CORS, sin auth). Prerequisito Unicode ya completado. Implementacion revertida anteriormente por encoding roto, lista para reimplementar.
- **Contador de descargas por pool:** Tracking de descargas por pool/fecha
- **Publicar blogpost en Blogger:** Copiar HTML de `blogpost_agosto_2026_links.html` al blog
- **Estrategia de almacenamiento largo plazo:** Cloudflare R2 evaluado (10GB gratis permanente, egress gratis, ~$2.70/mes para 180GB a 2 anos). Alternativa: Deezer API para previews sin hosting propio.
