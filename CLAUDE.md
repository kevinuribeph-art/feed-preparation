# Mesa de trabajo (feed-preparation)

App web estática para preparar el feed mensual de Instagram: tablero de publicaciones,
diseñador de carruseles y editor libre de diapositivas.
Publicada con GitHub Pages: https://kevinuribeph-art.github.io/feed-preparation/

**Este repo es público.** Nada de datos de clientes, credenciales ni flujos internos en archivos
rastreados. Las notas privadas van en `CLAUDE.local.md` (ignorado por git).

## Decisiones
Antes de cambiar cualquier cosa de la Mesa, lee DECISIONES.md. Si la petición contradice una decisión vigente, para antes
de tocar código: cita la decisión vigente y la nueva, y pregunta cuál gana. Cuando Kevin conteste, registra la ganadora
como decisión nueva y marca la otra como sustituida. Toda petición que cambie el comportamiento de la Mesa se registra en
DECISIONES.md en el mismo PR, choque o no con algo.

## Stack
- HTML + JavaScript sin framework, sin build y sin dependencias: se edita el archivo y se publica tal cual.
- `index.html` lleva la CSP de la Mesa en un `<meta>` (D-252: ningún script en línea ni manejador `on…=`; todo script es un
  archivo) y carga, sin async, `tema.js` (el tema oscuro antes de pintar), `mesa.js` (núcleo, expone `window.MESA`),
  `portal/supa.js` (la sesión de Supabase: una sola instancia para toda la Mesa, `MESA._in.supa`), `nube.js` (la nube: sube
  por detrás cada cambio del diario y, al abrir, baja lo último antes de dibujar; una Mesa a la vez entre ordenadores; apagada
  salvo que se active en un navegador, D-253 a D-257), `arranque.js` (abre la Mesa) y `vigia.js` (marca los módulos que no
  cargan y avisa de lo que bloquea la CSP); y, en async, `kits/motor.js` (motor de
  diseño), `diseno.js` (diseñador), `libre.js` (editor de diapositivas), `calendario.js` (calendario), `revisar.js` (revisión antes de subir o programar), `historias.js` (historias de Instagram), `carpetas.js` (subir y crear carpetas en la bandeja), `descargar.js` (descargar fotos de las publicaciones elegidas con ⌘+clic), `controles.js` (desplegables, fecha y hora propios de la Mesa: el `<select>` o el `<input>` nativo sigue oculto como fuente de verdad) y `personal.js` (la página personal que abre el logo: avisos, clientes, tareas y notas) `escritura.js` (escritura rápida de la página personal: marcas y menú «/») y `sesiones.js` (sesiones y clientes esporádicos de la página personal; sus fotos, en el almacén `tfotos`) y `cobros.js` (la pestaña «Cobros» de «Editar cliente», la tabla de facturas y «Tus pagos» de la «Vista cliente»; los datos, en `mesa.js`: almacenes `cobros` y `cfacturas`) e `informe.js` (en la «Vista cliente», el porqué del mes y cómo fue el anterior; los datos, en `mesa.js`: almacén `meses` y `MESA.informe`) y `web.js` («Web del cliente»: envía al servidor del portal lo que ve el cliente, D-241; habla con él con `portal/supa.js`, que comparte con el portal) y `copia.js` («Exportar todo»: la copia completa, un `.tar` por cliente y uno general a tamaño original, y su importación por partes, D-249). La mesa nunca espera a los async; `portal/supa.js` y `nube.js` van sin async porque la nube baja antes de dibujar (D-253).
- `kits/<marca>.json` + `kits/fonts/`: kits de marca para el diseñador y el editor.
- Los datos de la Mesa viven en IndexedDB del navegador donde se abre (aislados por origen). El único servidor (Supabase,
  Fráncfort) guarda lo que ve cada cliente en su portal (D-241): esquema en `servidor/esquema.sql`. En el mismo proyecto, con su
  propio esquema `mesa` y sus permisos, el servidor guarda también la Mesa (traspaso C, D-251): `servidor/mesa.sql`; el contrato,
  en `.claude/rediseno/traspaso/contrato.md`. Cada escritura en IndexedDB se apunta en el almacén `diario` (D-250). Con `nube.js`
  encendida (D-253), la Mesa de Kevin sube allí cada cambio y baja lo último al abrir; lo que sabe del servidor, en el almacén
  `nube` (IndexedDB 23).
- `tools/zernio.mjs`: script Node 18+ sin dependencias para la API de Zernio. Solo en local, nunca en el navegador.
- `tools/web.mjs`: script Node 18+ sin dependencias para el servidor del portal (esquema, entrada, altas) y el de la Mesa (`mesa`,
  `mesa-version`, `mesa-epoca`, `actividad`). Solo en local.
- `mesa.js` pesa unos 300 KB: busca con grep en vez de leerlo entero. Una función nueva grande va
  en su propio archivo, como `libre.js`.

## Publicar
- Pages publica desde `main`. Cada cambio va en una rama y entra por PR.
- En cada publicación sube la versión: `M.version` en `mesa.js` y el `?v=` de `mesa.js` en
  `index.html`, los dos iguales. Si cambias `tema.js`, `arranque.js`, `vigia.js`, `nube.js`, `diseno.js`, `libre.js`, `calendario.js`, `revisar.js`, `historias.js`, `carpetas.js`, `descargar.js`, `controles.js`, `personal.js`, `escritura.js`, `sesiones.js`, `cobros.js`, `informe.js`, `web.js`, `copia.js`, `portal/supa.js` o `kits/motor.js`, sube también
  su `?v=` en `index.html`. Sin esto el navegador sigue sirviendo la versión en caché.
- Si un tablero empieza a guardar algo que el código anterior no conoce, sube también la versión de IndexedDB en `db()`: si no, una pestaña antigua lo pisa (D-060).
- Si subes la versión de IndexedDB, tras comprobar con curl que Pages sirve la nueva, sube la mínima del servidor a esa versión
  de la Mesa (`node tools/web.mjs mesa-version real <x.yy>`): una Mesa más vieja deja de bajar y subir y pide recargar (D-060
  entre ordenadores, D-257).
- Tras publicar, comprueba con `curl` que Pages sirve los archivos nuevos.

## Probar
- Nunca abras la URL publicada en el navegador integrado de Claude para probar: ahí están los datos reales de Kevin.
  Ábrela solo para lo que Kevin pida hacer en su mesa.
- Prueba siempre en localhost sobre una copia: copia `index.html`, `tema.js`, `arranque.js`, `vigia.js`, `nube.js`, `mesa.js`, `diseno.js`,
  `libre.js`, `calendario.js`, `revisar.js`, `historias.js`, `carpetas.js`, `descargar.js`, `controles.js`, `personal.js`, `escritura.js`, `sesiones.js`, `cobros.js`, `informe.js`, `web.js`, `copia.js`, `portal/`, `kits/` y `tests/` a una carpeta temporal y sírvela en 127.0.0.1, en un puerto nuevo
  (cada puerto es un almacenamiento aparte). Vuelve a copiar tras cada cambio.
- Batería de regresión: `tests/regresion.html` en esa copia, en un puerto sin otros datos (si los hay, se niega)
  («Pasar la batería», o `?auto`; `?solo=M3,E2` pasa solo esas). Antes de cada PR se pasa entera y tiene que pasar entera; la comprobación manual de la misma página también.
- Cada fallo corregido suma su prueba en `tests/regresion.js`.
- `tools/zernio.mjs resumen` tiene su prueba aparte, sin red ni clave de verdad: `node tests/zernio-resumen.mjs`.
- El núcleo de la nube (`nube.js`: turno, versiones, páginas, cola, reescanear y reconciliar), sin red, con un servidor, un
  almacén y un reloj simulados: `node tests/nube-simulada.mjs`. Antes de cada PR que toque `nube.js`, entera en verde.
- El aviso de los códigos de entrada de `portal/supa.js`, también sin red: `node tests/portal-supa.mjs`.
- El aislamiento del portal tiene su prueba contra el proyecto de pruebas de Supabase, nunca el real:
  `node tests/portal-aislamiento.mjs`. Antes de cada PR que toque el servidor, el portal o lo que la Mesa envía, entera en verde.
- El servidor de la Mesa (esquema `mesa`, D-251), igual, contra el proyecto de pruebas y nunca el real: `node tests/mesa-servidor.mjs`
  (necesita `node tools/web.mjs mesa pruebas` aplicado). Antes de cada PR que toque `servidor/mesa.sql`, entera en verde.
- No sirvas la carpeta del repo: expondría `.env`, y el servidor de preview no puede leer carpetas
  protegidas de macOS (Escritorio, Documentos).
- Datos de prueba: una exportación de la mesa (⇅ → Exportar) o un tablero de prueba nuevo.

## Zernio y `.env`
- `ZERNIO_API_KEY` vive solo en `.env` (fuera de git, permisos 600). `tools/zernio.mjs` la lee del
  entorno o del `.env` junto al repo; ver los comandos en su cabecera.
- La clave nunca va a `mesa.js`, a Notion, a un commit ni al chat. No muestres ni copies `.env`.
- La mesa nunca ve la clave: pide URLs firmadas a `tools/zernio.mjs` y sube las fotos con `MESA.startZernio`.
- Las de Supabase (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_REAL_TOKEN`, `SUPABASE_PRUEBAS_*`, `SUPABASE_*`) y las del buzón de los códigos (`SMTP_*`) viven igual, solo en `.env`; las lee
  `tools/web.mjs`. Solo la clave «publishable» puede ir en una página (está hecha para eso, con los permisos por fila).

## Qué no se toca
- Los nombres de la API `window.MESA` y `tools/zernio.mjs` (nombre, ruta y comandos): una skill
  externa depende de ellos.
- `.env`, y la línea `.env` de `.gitignore`.
- `.claude/`: excluido de git en `.git/info/exclude`; `.claude/skill/` es otro repo.
