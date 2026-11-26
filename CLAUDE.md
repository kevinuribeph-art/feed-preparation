# Mesa de trabajo (feed-preparation)

App web estática para preparar el feed mensual de Instagram: tablero de publicaciones,
diseñador de carruseles y editor libre de diapositivas.
Publicada en https://mesa.uribevisuals.studio (Cloudflare Pages: la carpeta `mesa/` tal cual, D-276). GitHub Pages (`github.io`)
está apagado (20/11/2026, D-277): el repo ya no se publica allí.

**Este repo es público.** Nada de datos de clientes, credenciales ni flujos internos en archivos
rastreados. Las notas privadas van en `CLAUDE.local.md` (ignorado por git).

## Decisiones
Antes de cambiar cualquier cosa de la Mesa, lee DECISIONES.md. Si la petición contradice una decisión vigente, para antes
de tocar código: cita la decisión vigente y la nueva, y pregunta cuál gana. Cuando Kevin conteste, registra la ganadora
como decisión nueva y marca la otra como sustituida. Toda petición que cambie el comportamiento de la Mesa se registra en
DECISIONES.md en el mismo PR, choque o no con algo.

## Stack
- HTML + JavaScript sin framework, sin build y sin dependencias: se edita el archivo y se publica tal cual. **Todo lo de la Mesa
  vive en `mesa/`** (D-276), como el portal en `portal/`: los nombres de archivo de esta sección y de «Publicar» son desde ahí.
  Lleva sus cabeceras en `mesa/_headers` y una copia de lo que comparte con el portal en `mesa/portal/` (`supa.js` y, de `marca/`,
  `logo-ink.svg`, `logo-paper.svg`, `monograma.svg`, `icono-32.png` e `icono-180.png`), en las mismas rutas públicas: `portal/`
  manda. Cloudflare Pages publica `mesa/` tal cual (proyecto `uribevisuals-mesa`: orden `exit 0`, salida `mesa`).
- `index.html` lleva la CSP de la Mesa en un `<meta>` (D-252: ningún script en línea ni manejador `on…=`; todo script es un
  archivo) y carga, sin async, `tema.js` (el tema oscuro antes de pintar), `mesa.js` (núcleo, expone `window.MESA`),
  `portal/supa.js` (la sesión de Supabase: una sola instancia para toda la Mesa, `MESA._in.supa`), `entrada.js` (la entrada, D-262:
  contraseña en cada ventana nueva, el código de la app a los 30 días, el alta, «¿Olvidaste?» y la pantalla de carga; guarda la
  sesión cifrada con la contraseña; va antes que la nube, que crea la sesión al cargar), `nube.js` (la nube: sube
  por detrás cada cambio del diario y, al abrir, baja lo último antes de dibujar; una Mesa a la vez entre ordenadores; apagada
  salvo que se active en un navegador, D-253 a D-257; con ella, las fotos suben y bajan con su worker `nube-fotos.js`, D-259), `arranque.js` (abre la Mesa) y `vigia.js` (marca los módulos que no
  cargan y avisa de lo que bloquea la CSP); y, en async, `kits/motor.js` (motor de
  diseño), `diseno.js` (diseñador), `libre.js` (editor de diapositivas), `calendario.js` (calendario), `revisar.js` (revisión antes de subir o programar), `historias.js` (historias de Instagram), `carpetas.js` (subir y crear carpetas en la bandeja), `descargar.js` (descargar fotos de las publicaciones o de la bandeja elegidas con ⌘+clic), `controles.js` (desplegables, fecha y hora propios de la Mesa: el `<select>` o el `<input>` nativo sigue oculto como fuente de verdad) y `personal.js` (la página personal que abre el logo: avisos, clientes, tareas y notas) `escritura.js` (escritura rápida de la página personal: marcas y menú «/») y `sesiones.js` (sesiones y clientes esporádicos de la página personal; sus fotos, en el almacén `tfotos`) y `cobros.js` (la pestaña «Cobros» de «Editar cliente»: los acuerdos de cada cliente con sus facturas y el catálogo de paquetes; y «Tus pagos» de la «Vista cliente»; los datos, en `mesa.js`: almacenes `cobros`, `cfacturas`, `acuerdos` y `paquetes`) y `estilo.js` (la pestaña «Estilo» de «Editar cliente»: el estilo de cada cliente, lo que tenía su página «Skill» de Notion, solo para Kevin y Claude; los datos y `MESA.estilo`, en `mesa.js`: almacén `estilos`; D-356) y `entregas.js` (la página de un cliente de solo contenido, sin meses, D-312: sus entregas, sus sesiones y su acuerdo; los datos, en `mesa.js`: almacén `entregas`) e `informe.js` (en la «Vista cliente», el porqué del mes y cómo fue el anterior; los datos, en `mesa.js`: almacén `meses` y `MESA.informe`) y `web.js` («Web del cliente»: envía al servidor del portal lo que ve el cliente, D-241; «Web al día» / «Web: N cambios» con su lista, y lo enviado de cada publicación, campo a campo, en el almacén `enviados`, D-355; habla con él con `portal/supa.js`, que comparte con el portal) y `copia.js` («Exportar todo»: la copia completa, un `.tar` por cliente y uno general a tamaño original, y su importación por partes, D-249). La mesa nunca espera a los async; `portal/supa.js` y `nube.js` van sin async porque la nube baja antes de dibujar (D-253).
- La Mesa en el iPhone (D-267 a D-270): `movil.html` (`<html data-movil>`, la misma CSP que `index.html`) carga, sin async, `tema.js`,
  `vigia.js`, `mesa.js`, `portal/supa.js`, `entrada.js`, `nube.js`, `personal.js`, `web.js`, `escritura.js`, `sesiones.js` y su cara,
  `movil.js` (Hoy, Clientes, Tareas, el mes, la publicación, captions, historias y sesiones, y la página de un cliente de solo contenido; cambiar fecha y hora, estado, captions,
  tareas y sesiones y contestar al cliente). El
  mismo núcleo, sin escritorio: `MESA._in.movil` mira sin escribir y aplica cada cambio como una operación; la nube del iPhone mira en
  pausa y coge la Mesa solo para cada cambio. `movil.webmanifest` es el icono de la pantalla de inicio; en un iPhone, `tema.js` lleva la
  dirección de siempre a `movil.html`. Ninguna regla de la Mesa en `movil.js`: todo sale del núcleo.
- `kits/<marca>.json` + `kits/fonts/`: kits de marca para el diseñador y el editor.
- Los datos de la Mesa viven en IndexedDB del navegador donde se abre (aislados por origen). El único servidor (Supabase,
  Fráncfort) guarda lo que ve cada cliente en su portal (D-241): esquema en `servidor/esquema.sql`. En el mismo proyecto, con su
  propio esquema `mesa` y sus permisos, el servidor guarda también la Mesa (traspaso C, D-251): `servidor/mesa.sql`; el contrato,
  en `.claude/rediseno/traspaso/contrato.md`. Cada escritura en IndexedDB se apunta en el almacén `diario` (D-250). Con `nube.js`
  encendida (D-253), la Mesa de Kevin sube allí cada cambio y baja lo último al abrir; lo que sabe del servidor, en el almacén
  `nube` (IndexedDB 23). Desde el esquema 5 (D-278), dos disparadores en `auth.sessions` y `auth.one_time_tokens` apuntan en la
  actividad las entradas y los códigos del portal, que la Mesa enseña en «Avisos»; nunca paran una entrada. Desde el esquema 6
  (D-298, D-299), «Es mío» / «No lo reconozco» de un aparato nuevo (el segundo cierra todas las sesiones) y el «Visto» de los
  avisos se guardan en el servidor; `es_dueno()` pide además que la sesión siga abierta en `auth.sessions` (`sesion_viva()`).
- `tools/zernio.mjs`: script Node 18+ sin dependencias para la API de Zernio. Solo en local, nunca en el navegador.
- `tools/web.mjs`: script Node 18+ sin dependencias para el servidor del portal (esquema, entrada, altas) y el de la Mesa (`mesa`,
  `mesa-version`, `mesa-epoca`, `actividad`), las cuentas del portal (`cuentas`, solo lee, D-363), la función `zernio` del servidor (`zernio`, D-261) y la entrada de Kevin (`codigo`:
  el interruptor del código de su app; `rescate`: quitar su código y sus sesiones si pierde el iPhone y el Mac; D-262) y las claves
  heredadas de Supabase (`heredada`, D-280: apagadas y su secreto revocado en los dos proyectos). Solo en local.
  `entrada real` pone también los límites de los códigos (D-278: uno cada 3 min por correo, 60 por hora, 10 por IP cada 5 min) y
  rechaza las contraseñas filtradas. `alta` da de alta una cuenta de cliente y le manda la bienvenida (D-273) con `tools/correo.mjs` (el correo, su logo `tools/correo-logo.png` y un SMTP mínimo, sin
  dependencias), desde el buzón de los códigos (`SMTP_*`); en pruebas nunca envía.
- `servidor/funciones/zernio.ts`: función de Supabase que hace lo de `presign`, `schedule`, `posts` y `update` de
  `tools/zernio.mjs` con la clave como secreto del proyecto, solo para la sesión de Kevin (D-261). `zernio-falso.ts`, su Zernio
  simulado, solo en el proyecto de pruebas.
- `mesa.js` pesa unos 300 KB: busca con grep en vez de leerlo entero. Una función nueva grande va
  en su propio archivo, como `libre.js`.

## Publicar
- Cloudflare Pages publica desde `main` la carpeta `mesa/` en `mesa.uribevisuals.studio` y `portal/` en `clientes.uribevisuals.studio`.
  Cada cambio va en una rama y entra por PR.
- Un archivo nuevo de la Mesa va dentro de `mesa/`. `tests/mesa-carpeta.mjs` falla si una de las dos páginas, el manifiesto o
  `nube.js` piden algo que no está en `mesa/`, si entra algo ajeno o si la CSP de `movil.html` no es la de `index.html`.
- **Lo compartido con el portal:** `portal/` manda. Si cambias `portal/supa.js` o uno de esos cinco archivos de `portal/marca/`, cópialo
  igual a `mesa/portal/…` en el mismo PR y sube su `?v=` en `mesa/index.html`, `mesa/movil.html` y las páginas del portal que lo
  cargan. `mesa-carpeta` (MC5) falla si las dos copias no son iguales byte a byte.
- **Las cabeceras de la Mesa,** en `mesa/_headers` (D-277): su CSP es la del `<meta>` de `mesa/index.html` (y de `mesa/movil.html`)
  con el servidor del proyecto real, `https://ipqeywhhuncpnqkvfxpn.supabase.co` (el de `portal/config.js`), en vez de
  `https://*.supabase.co`, más `frame-ancestors 'none'`; y la misma `Permissions-Policy` que `portal/_headers`. El `<meta>` sigue con
  el comodín: las copias de prueba en 127.0.0.1 no tienen cabeceras y hablan con el proyecto de pruebas (con las dos políticas, el
  navegador aplica las dos). Si cambias la CSP, cámbiala en los tres sitios; `portal/_headers` tampoco lleva el comodín (MC4 lo
  comprueba). Si el proyecto real cambiara de dirección, cambia las dos `_headers`.
- En cada publicación sube la versión: `M.version` en `mesa.js` y el `?v=` de `mesa.js` en
  `index.html` y en `movil.html`, los tres iguales. Si cambias `nube-fotos.js` (el worker de las fotos), sube `FOTOS_V` en `nube.js` y el `?v=` de
  `nube.js`. Si cambias `tema.js`, `arranque.js`, `vigia.js`, `entrada.js`, `nube.js`, `diseno.js`, `libre.js`, `calendario.js`, `revisar.js`, `historias.js`, `carpetas.js`, `descargar.js`, `controles.js`, `personal.js`, `escritura.js`, `sesiones.js`, `cobros.js`, `estilo.js`, `entregas.js`, `informe.js`, `web.js`, `copia.js`, `portal/supa.js` o `kits/motor.js`, sube también
  su `?v=` en `index.html` (y en `movil.html` si la carga; `movil.js`, solo allí). Sin esto el navegador sigue sirviendo la versión en caché.
- Si un tablero empieza a guardar algo que el código anterior no conoce, sube también la versión de IndexedDB en `db()`: si no, una pestaña antigua lo pisa (D-060).
- Si subes la versión de IndexedDB, tras comprobar con curl que Pages sirve la nueva, sube la mínima del servidor a esa versión
  de la Mesa (`node tools/web.mjs mesa-version real <x.yy>`): una Mesa más vieja deja de bajar y subir y pide recargar (D-060
  entre ordenadores, D-257).
- Tras publicar, comprueba con `curl` que `mesa.uribevisuals.studio` sirve los archivos nuevos, sus cabeceras (`curl -sI`) y que no
  sirve `tools/`, `tests/`, `servidor/` ni los `.md`.

## Probar
- Nunca abras la URL publicada (`mesa.uribevisuals.studio`) en el navegador integrado de Claude para probar:
  ahí están los datos reales de Kevin.
  Ábrela solo para lo que Kevin pida hacer en su mesa.
- Prueba siempre en localhost sobre una copia: copia `mesa/`, `portal/` y `tests/` a una carpeta temporal (las pruebas abren
  `../mesa/` y la IC1 y `portal-supa` leen `portal/`) y sírvela en 127.0.0.1, en un puerto nuevo (cada puerto es un almacenamiento
  aparte). La Mesa queda en `/mesa/` y la batería en `/tests/regresion.html`. Vuelve a copiar tras cada cambio.
- Batería de regresión: `tests/regresion.html` en esa copia, en un puerto sin otros datos (si los hay, se niega)
  («Pasar la batería», o `?auto`; `?solo=M3,E2` pasa solo esas). Antes de cada PR se pasa entera y tiene que pasar entera; la comprobación manual de la misma página también.
- Cada fallo corregido suma su prueba en `tests/regresion.js`.
- `tools/zernio.mjs resumen` tiene su prueba aparte, sin red ni clave de verdad: `node tests/zernio-resumen.mjs`.
- El núcleo de la nube (`nube.js`: turno, versiones, páginas, cola, reescanear y reconciliar; las fotos, `subirTodo`, `comprobar`
  y «traer»), sin red, con un servidor, un almacén y un reloj simulados: `node tests/nube-simulada.mjs`. Antes de cada PR que toque `nube.js`, entera en verde.
- El aviso de los códigos de entrada de `portal/supa.js` y sus archivos (subir solo con el 409, bajar), también sin red: `node tests/portal-supa.mjs`.
- El correo de bienvenida y su envío (`tools/correo.mjs`), sin red (SMTP simulado en 127.0.0.1): `node tests/correo.mjs`; la orden
  `alta`, en `tests/portal-aislamiento.mjs` contra pruebas. Antes de cada PR que toque `tools/correo.mjs` o `alta`, las dos en verde.
- La carpeta que publica el dominio (`mesa/`: lo que lleva, lo que no, sus cabeceras y las del portal, y las copias del portal), sin red:
  `node tests/mesa-carpeta.mjs`. Antes de cada PR que toque `mesa/`, la CSP, `portal/supa.js` o `portal/marca/`.
- El aislamiento del portal tiene su prueba contra el proyecto de pruebas de Supabase, nunca el real:
  `node tests/portal-aislamiento.mjs`. Antes de cada PR que toque el servidor, el portal o lo que la Mesa envía, entera en verde.
- El servidor de la Mesa (esquema `mesa`, D-251), igual, contra el proyecto de pruebas y nunca el real: `node tests/mesa-servidor.mjs`
  (necesita `node tools/web.mjs mesa pruebas` aplicado). Antes de cada PR que toque `servidor/mesa.sql`, entera en verde.
- La entrada de la Mesa en el servidor (D-262: el código de la app, el interruptor `exigir_codigo`, «¿Olvidaste?» y el rescate),
  contra el proyecto de pruebas y nunca el real: `node tests/entrada-servidor.mjs` (deja el interruptor como estaba). Los Kevin
  inventados de las pruebas del servidor entran con el código de su app (`tests/codigo-app.mjs`). Antes de cada PR que toque
  `servidor/esquema.sql`, `servidor/mesa.sql`, la entrada o `tools/web.mjs`, entera en verde.
- La función `zernio` (D-261), contra el proyecto de pruebas y un Zernio simulado, nunca el real ni la clave real:
  `node tests/zernio-servidor.mjs` (la despliega en pruebas y deja sus secretos como estaban). Antes de cada PR que toque
  `servidor/funciones/zernio*.ts` o la orden `zernio` de `tools/web.mjs`, entera en verde, con `mesa-servidor` y `portal-aislamiento`.
- No sirvas la carpeta del repo: expondría `.env`, y el servidor de preview no puede leer carpetas
  protegidas de macOS (Escritorio, Documentos).
- Datos de prueba: una exportación de la mesa (⇅ → Exportar) o un tablero de prueba nuevo.

## Zernio y `.env`
- `ZERNIO_API_KEY` vive solo en `.env` (fuera de git, permisos 600). `tools/zernio.mjs` la lee del
  entorno o del `.env` junto al repo; ver los comandos en su cabecera. Con D-261 vive también como secreto de la función
  `zernio` del proyecto real (la pone `node tools/web.mjs zernio real --si`, con el OK de Kevin); al proyecto de pruebas nunca va
  la real.
- La clave nunca va a `mesa.js`, a Notion, a un commit ni al chat. No muestres ni copies `.env`.
- La mesa nunca ve la clave: pide URLs firmadas a `tools/zernio.mjs` y sube las fotos con `MESA.startZernio`.
- Las de Supabase (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_REAL_TOKEN`, `SUPABASE_PRUEBAS_*`, `SUPABASE_*`) y las del buzón de los códigos (`SMTP_*`) viven igual, solo en `.env`; las lee
  `tools/web.mjs`. Solo la clave «publishable» puede ir en una página (está hecha para eso, con los permisos por fila). Solo claves
  nuevas (`sb_publishable_…`, `sb_secret_…`): las heredadas (anon, service_role) están apagadas y revocadas (D-280); `tools/web.mjs` no
  acepta una JWT y las funciones del servidor leen solo las nuevas de su entorno.

## Qué no se toca
- Los nombres de la API `window.MESA` y `tools/zernio.mjs` (nombre, ruta y comandos): una skill
  externa depende de ellos.
- `.env`, y la línea `.env` de `.gitignore`.
- `.claude/`: excluido de git en `.git/info/exclude`; `.claude/skill/` es otro repo.
