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
- HTML: `pools.html` (principal, ~936 lineas), `admin.html` (gestion usuarios), `index.html` (redirect a pools)
- Tailwind CSS v3 via CDN con config custom (brand colors, Montserrat font)
- Fuente: Montserrat (400-900)
- Vanilla JS: IntersectionObserver (scroll reveal), localStorage/sessionStorage (auth)
- Datos: `pools-links.js` (365 enlaces MEGA mapeados por pool+fecha), `pools-tracks.js` (16,342 tracklists mapeados por pool+fecha)
- Logo: `logo-dpw.jpg` (usado en header, hero section, y fondo decorativo)

## Estetica (pools.html)
- Tema oscuro (fondo `#0b0b0e`)
- Color neon amarillo (`#dfff00`) como acento principal
- Fondo animado: gradiente CSS `gradientShift` (25s infinite, 7 colores oscuros con tonos azul/violeta/teal)
- 45 particulas flotantes generadas por JS (5 colores: neon, azul, violeta, cyan, rosa) con 3 trayectorias (`floatA/B/C`), tamaños y velocidades aleatorias
- 5 blobs de aurora/nebula: circulos grandes (350-600px) con `blur(80px)`, animaciones lentas (22-35s), colores neon/azul/violeta/cyan
- Neon sweep en separadores: linea de brillo recorre los `.neon-line` de izquierda a derecha (`neonSweep` 4s infinite)
- Logo `logo-dpw.jpg` en: header (circular, borde azul, glow hover), hero (junto al titulo + decorativo grande a la derecha con borde y glow azul)
- Cards de pool con colores unicos por pool (28 disenos en `POOL_CARDS`)
- Animaciones: fadeUp, fadeScale, slideDown, pulseNeon, shimmer
- Card flip 3D al cambiar tabs (perspective + rotateY, 150ms transicion)
- Hover effects: cards suben 4px + glow neon, botones con shimmer overlay
- Scroll reveal staggered con IntersectionObserver (threshold 0.08, delay por indice)
- Header sticky con shadow on scroll (`shadow-[0_4px_20px_rgba(0,0,0,.5)]`)
- Boton scroll-to-top con fade in/out (aparece a 400px scroll)
- Dropdown hover en navbar (POOLS con meses dinamicos, MI CUENTA)
- Modals con backdrop blur para login, descarga y editar cuenta
- Flechas de navegacion en tabs de pools (aparecen/desaparecen segun scroll position)
- Buscador de canciones con highlight de resultados (`search-highlight` class)
- Tracklist accordion en modal de descarga (expandible, max 600px)

## Sistema de usuarios
- **Almacenamiento:** localStorage (`dpw_users`, `dpw_deleted`) + sessionStorage (`dpw_session`)
- **Usuarios por defecto:**
  - `admin` / `admin2026` (admin)
  - `sharkmusic` / `shark-music_2026` (admin)
  - `prueba1` / `prueba_1` (user)
  - `demo` / `demo123` (user)
- **Sync de defaults:** `getUsers()` inyecta defaults que no esten en `dpw_deleted`
- **Reset:** Anadir `?reset` a la URL limpia localStorage y recarga
- **Dropdown de cuenta:**
  - Sin sesion: "No has iniciado sesion" + boton login
  - Con sesion: nombre + rol + "EDITAR MI CUENTA" + (admin: "PANEL ADMIN") + "CERRAR SESION"
- **Editar cuenta:** Modal para cambiar nombre y password (con confirmacion)
- **Restricciones admin:** Un admin NO puede eliminar ni desactivar a otro admin

## Pagina de Pools (pools.html)
- **Meses auto-generados** desde MEGA_LINKS (siempre sincronizado con pools-links.js)
- **26 fechas, 26 pools, 365 archivos, 16,342 tracks** (agosto 2026)
- **Alias de pools:** `LATINREMIXES.COM` → `LATIN REMIXES` (transparente en UI via `POOL_ALIASES`)
- **Tabs por fecha:** click cambia card visual + boton descarga con flip 3D
- **Flechas de tabs:** `scrollTabs(idx, dir)` desplaza 250px, `updateTabArrows(idx)` muestra/oculta flechas segun scroll position (gradiente fade con bg del card container)
- **28 pool cards visuales:** definidos en `POOL_CARDS` con bg/html unicos por pool
- **Descarga:** modal con tracklist accordion + enlaces MEGA (requiere login) o prompt de login
- **Tracklist en modal:** boton "VER CONTENIDO (N tracks)" despliega lista con nombre de cada track (accordion con `max-height` transition)
- **Stats en hero:** archivos, pools, fechas y tracks calculados dinamicamente de MEGA_LINKS y TRACK_LIST
- **Buscador de canciones:**
  - Input en hero section con debounce 250ms
  - Busca en `TRACK_LIST` (16,342 tracks) por nombre de cancion, artista o remix
  - Max 50 resultados, con highlight del texto buscado
  - Click en resultado abre el modal de descarga del pool/fecha correspondiente
  - Dropdown `z-50` dentro del hero `z-20` para aparecer encima de las secciones de abajo
- **Overflow controlado:** `overflow-x-hidden` en body y main, `overflow-hidden` en card container (evita scroll horizontal por `min-w-max` en tabs)
- **CSS stacking:** Hero section `z-20` para que el dropdown de busqueda aparezca encima de las secciones de fechas

## Admin Panel (admin.html)
- **Acceso:** solo usuarios con rol `admin`
- **Dashboard:** stats (total, activos, inactivos, admins)
- **Tabla de usuarios:** busqueda, avatar inicial, nombre, password visible, rol badge, estado, fecha
- **CRUD completo:** crear, editar (nombre+pass+rol+estado), eliminar
- **Renombrar usuarios:** marca nombre antiguo en `dpw_deleted` para evitar re-add de defaults
- **Proteccion admin:** botones eliminar/desactivar ocultos en filas admin

## Estructura
```
index.html          -- Redirect a pools.html (meta refresh + JS)
pools.html          -- Pagina principal (plataforma descargas, ~936 lineas)
pools-links.js      -- 365 enlaces MEGA (auto-generado, const MEGA_LINKS)
pools-tracks.js     -- 16,342 tracklists (auto-generado, const TRACK_LIST)
admin.html          -- Panel admin gestion usuarios
logo-dpw.jpg        -- Logo DJ Pool World (circular, usado en header y hero)
nebula-bg.jpg       -- Fondo hero antiguo (no usado en pools)
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

## pools-links.js (generacion)
- **Generado desde:** `_mega_links.json` (365 entries)
- **Formato:** `const MEGA_LINKS = { "DD_MM": { "POOL NAME": [{name, url}] } }`
- **26 fechas** (agosto 2026), **26 pools unicos**, **365 archivos**
- **Alias:** `LATINREMIXES.COM` aparece en dias 07 y 22 (mapeado a `LATIN REMIXES` en UI)
- **Pool names en MEGA_LINKS:** AREYOUKIDY, BEATFREAKZ, BEEZO BEEHIVE, BPM LATINO, BPM SUPREME, CLUB KILLERS, CRACK 4 DJS, CROOKLYN CLAN, DA ZONE, DIGITAL MUSIC, DIRTY SOUNDS, DJ CITY, DJ CITY LATINO, ELITE REMIX, EUROPA REMIX, HEADLINER, LATIN BOX, LATIN REMIXES, LATINREMIXES.COM, MP3 MIXES POOL, PRO LATIN, REMIX PLANET, ROMPE DISCOTECA, THEMASHUP, UNLIMITED LATIN, URBAN ZONE

## pools-tracks.js (generacion)
- **Generado desde:** extraccion de nombres de archivo dentro de los ZIP/RAR de cada pool
- **Formato:** `const TRACK_LIST = { "DD_MM": { "POOL NAME": ["track1.mp3", "track2.mp3", ...] } }`
- **16,342 tracks** distribuidos en 26 fechas y 26 pools
- **Usado por:** buscador de canciones (`handleSongSearch`), tracklist accordion en modal de descarga (`getTrackList`)
- **Bug conocido:** Algunos nombres de tracks tienen caracteres Unicode rotos (ej: "Difícil" se muestra garbled). Causa: extraccion con WinRAR `UnRAR.exe` en consola Windows (cp1252) no maneja correctamente UTF-8. Pendiente re-generar con encoding correcto.

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
11. **Web DJ Pool World** → `pools.html` + `pools-links.js` + `pools-tracks.js` + `admin.html` (plataforma completa con auth, busqueda, tracklists)

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
- **Unicode roto en pools-tracks.js:** Nombres de tracks con acentos (í, é, ñ, ü) se muestran garbled. La extraccion con WinRAR `UnRAR.exe` en Windows produce output en cp1252, no UTF-8. Afecta al buscador de canciones y al tracklist del modal de descarga. Necesita re-generar `pools-tracks.js` con encoding UTF-8 correcto.

## Funcionalidades pendientes
- **Audio preview 30s:** Vista previa de 30 segundos de los tracks (requiere ffmpeg + hosting externo)
- **Contador de descargas por pool:** Tracking de descargas por pool/fecha
- **Publicar blogpost en Blogger:** Copiar HTML de `blogpost_agosto_2026_links.html` al blog
- **Estrategia de almacenamiento:** Plan para 1-2 anos de contenido (recomendacion discutida, sin accion)
