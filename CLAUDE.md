# Mesa de trabajo (feed-preparation)

App web estática para preparar el feed mensual de Instagram: tablero de publicaciones,
diseñador de carruseles y editor libre de diapositivas.
Publicada con GitHub Pages: https://kevinuribeph-art.github.io/feed-preparation/

**Este repo es público.** Nada de datos de clientes, credenciales ni flujos internos en archivos
rastreados. Las notas privadas van en `CLAUDE.local.md` (ignorado por git).

## Stack
- HTML + JavaScript sin framework, sin build y sin dependencias: se edita el archivo y se publica tal cual.
- `index.html` carga `mesa.js` (núcleo, expone `window.MESA`) y, en async, `kits/motor.js` (motor de
  diseño), `diseno.js` (diseñador), `libre.js` (editor de diapositivas) y `calendario.js` (calendario). La mesa nunca espera a los async.
- `kits/<marca>.json` + `kits/fonts/`: kits de marca para el diseñador y el editor.
- Sin backend: los datos viven en IndexedDB del navegador donde se abre la mesa (aislados por origen).
- `tools/zernio.mjs`: script Node 18+ sin dependencias para la API de Zernio. Solo en local, nunca en el navegador.
- `mesa.js` pesa unos 300 KB: busca con grep en vez de leerlo entero. Una función nueva grande va
  en su propio archivo, como `libre.js`.

## Publicar
- Pages publica desde `main`. Cada cambio va en una rama y entra por PR.
- En cada publicación sube la versión: `M.version` en `mesa.js` y el `?v=` de `mesa.js` en
  `index.html`, los dos iguales. Si cambias `diseno.js`, `libre.js`, `calendario.js` o `kits/motor.js`, sube también
  su `?v=` en `index.html`. Sin esto el navegador sigue sirviendo la versión en caché.
- Tras publicar, comprueba con `curl` que Pages sirve los archivos nuevos.

## Probar
- Nunca abras la URL publicada en el navegador integrado de Claude: es otro origen y está vacía.
  En el navegador del usuario correría sobre sus datos reales.
- Prueba siempre en localhost sobre una copia: copia `index.html`, `mesa.js`, `diseno.js`,
  `libre.js`, `calendario.js` y `kits/` a una carpeta temporal y sírvela en 127.0.0.1, en un puerto nuevo
  (cada puerto es un almacenamiento aparte). Vuelve a copiar tras cada cambio.
- No sirvas la carpeta del repo: expondría `.env`, y el servidor de preview no puede leer carpetas
  protegidas de macOS (Escritorio, Documentos).
- Datos de prueba: una exportación de la mesa (⇅ → Exportar) o un tablero de prueba nuevo.

## Zernio y `.env`
- `ZERNIO_API_KEY` vive solo en `.env` (fuera de git, permisos 600). `tools/zernio.mjs` la lee del
  entorno o del `.env` junto al repo; ver los comandos en su cabecera.
- La clave nunca va a `mesa.js`, a Notion, a un commit ni al chat. No muestres ni copies `.env`.
- La mesa nunca ve la clave: pide URLs firmadas a `tools/zernio.mjs` y sube las fotos con `MESA.startZernio`.

## Qué no se toca
- Los nombres de la API `window.MESA` y `tools/zernio.mjs` (nombre, ruta y comandos): una skill
  externa depende de ellos.
- `.env`, y la línea `.env` de `.gitignore`.
- `.claude/`: excluido de git en `.git/info/exclude`; `.claude/skill/` es otro repo.
