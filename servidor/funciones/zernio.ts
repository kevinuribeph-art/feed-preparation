// Función `zernio` de la Mesa (Supabase Edge Function, Deno, sin dependencias). Traspaso C, lote 6.
// Lo de `presign`, `schedule`, `posts` y `update` de tools/zernio.mjs desde el servidor, para cuando la Mesa no está en el Mac que
// guarda la clave. La clave vive solo como secreto del proyecto (`ZERNIO_API_KEY`) y nunca sale: ni en una respuesta, ni en un
// error, ni en un registro (se tapa todo lo que llega de Zernio antes de recortarlo, lección 121, y otra vez al responder).
// Solo Kevin: la sesión del que llama (la pasarela comprueba el JWT) y `public.es_dueno()`, preguntado con esa misma sesión.
// Las mismas guardas que el script, algo más estrictas: una fecha programada con menos de 10 minutos de margen se rechaza, y
// nada que publique ya (`publishNow` en cualquier sitio y a cualquier valor, ni otro campo «publicar ahora»); un post o un cambio
// solo con los campos que mandan las skills (lista blanca); y un `update` solo sobre un post programado o en borrador cuya hora,
// si el cambio no trae otra, tiene margen.
// La dirección de Zernio, del secreto `ZERNIO_BASE` (por omisión, la real); en el proyecto de pruebas apunta a `zernio-falso`.
// La aplica `node tools/web.mjs zernio <pruebas|real> [--si]`.
//   POST /functions/v1/zernio  { orden: 'presign', n }          → { ok: true, urls: [{ uploadUrl, publicUrl, expiresIn }] }
//                              { orden: 'schedule', post }      → { ok: true, post }
//                              { orden: 'posts', filtros? }     → { ok: true, posts }      filtros: account, status, platform, from, to
//                              { orden: 'update', id, patch }   → { ok: true, post }
// Un rechazo llega con HTTP 200 y { ok: false, error: { codigo, http, mensaje, … } }, como las funciones `mesa_*`: hay que mirar
// `ok` siempre. Solo lo que no llega a la función (sin sesión: lo para la pasarela) es un error HTTP.

const URL_P = Deno.env.get('SUPABASE_URL') ?? '';
const nuevas = (n: string) => { try { return JSON.parse(Deno.env.get(n) ?? '{}').default ?? ''; } catch { return ''; } };
const PUBLICA = Deno.env.get('SUPABASE_ANON_KEY') || nuevas('SUPABASE_PUBLISHABLE_KEYS');
const CLAVE = (Deno.env.get('ZERNIO_API_KEY') ?? '').trim();
const BASE = ((Deno.env.get('ZERNIO_BASE') ?? '').trim() || 'https://zernio.com/api/v1').replace(/\/+$/, '');
const MARGEN_MS = 10 * 60 * 1000;   // un scheduledFor pasado lo publica Zernio en el acto: se deja margen (como tools/zernio.mjs)
const MAX_CUERPO = 200_000;         // caracteres del pedido: un carrusel de 20 fotos con su caption cabe de sobra
const MAX_PAGINAS = 50;             // `posts`: 5.000 como mucho; más, que se estrechen los filtros
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;  // sin puntos ni barras: nunca otra ruta de Zernio

// La clave (y su forma dentro de un JSON) no sale nunca. Con menos de 16 caracteres la función no arranca (`config`).
const tapar = (t: string) => {
  if (CLAVE.length < 16) return t;
  const enJson = JSON.stringify(CLAVE).slice(1, -1);
  return t.split(CLAVE).join('[clave]').split(enJson).join('[clave]');
};

// La Mesa la llama desde su origen; una copia en este Mac, solo en el proyecto de pruebas (`ZERNIO_CORS_LOCAL`, que pone
// tools/web.mjs). Ni el portal de clientes (no la usa) ni `github.io`: ese origen lo comparte cualquier web de Pages de la cuenta.
const LOCAL = (Deno.env.get('ZERNIO_CORS_LOCAL') ?? '').trim() === '1';
const PERMITIDO = (o: string | null) => !!o && (o === 'https://mesa.uribevisuals.studio'
  || (LOCAL && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(o)));
const cors = (origen: string | null) => ({
  ...(PERMITIDO(origen) ? { 'Access-Control-Allow-Origin': origen as string } : {}),
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const responder = (cuerpo: unknown, origen: string | null, estado = 200) =>
  new Response(tapar(JSON.stringify(cuerpo)), { status: estado, headers: { ...cors(origen), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const cab = (clave: string, token?: string) => {
  const h: Record<string, string> = { apikey: clave };
  if (token) h.Authorization = token; else if (clave.startsWith('eyJ')) h.Authorization = 'Bearer ' + clave;
  return h;
};

class Rechazo extends Error {
  codigo: string; http: number; extra: Record<string, unknown>;
  constructor(codigo: string, http: number, mensaje: string, extra: Record<string, unknown> = {}) {
    super(mensaje); this.codigo = codigo; this.http = http; this.extra = extra;
  }
}
const forma = (m: string) => new Rechazo('forma', 400, m);
// deno-lint-ignore no-explicit-any
const objeto = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const corto = (v: unknown) => String(v).slice(0, 40);

// Solo Kevin: `mesa_yo()` con la sesión de quien llama (D-262): la cuenta dueña y, con el interruptor encendido, un código de su
// app de los últimos 30 días (`valido`, lo mismo que `es_dueno()`). Kevin sin código: `verificacion`. Un cliente del portal,
// alguien sin cliente o sin sesión: `permiso` o `sesion`, sin datos.
async function soloKevin(auth: string) {
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) throw new Rechazo('sesion', 401, 'sin sesión');
  let r: Response;
  try {
    r = await fetch(`${URL_P}/rest/v1/rpc/mesa_yo`, { method: 'POST', headers: { ...cab(PUBLICA, auth), 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
  } catch { throw new Rechazo('servidor', 502, 'no se pudo comprobar la sesión'); }
  if (r.status === 401) throw new Rechazo('sesion', 401, 'sin sesión');
  if (r.status === 403) throw new Rechazo('permiso', 403, 'sin permiso');
  if (!r.ok) throw new Rechazo('servidor', 502, 'no se pudo comprobar la sesión');
  const yo = await r.json().catch(() => null);
  if (!objeto(yo) || yo.dueno !== true) throw new Rechazo('permiso', 403, 'sin permiso');
  if (yo.valido !== true) throw new Rechazo('verificacion', 401, 'falta el código de tu app: escríbelo para seguir');
}

// Una llamada a Zernio. Lo que contesta se tapa antes de leerlo o recortarlo.
// deno-lint-ignore no-explicit-any
async function zernio(metodo: string, ruta: string, o: { cuerpo?: unknown; consulta?: Record<string, unknown>; cabeceras?: Record<string, string> } = {}): Promise<any> {
  const qs = o.consulta ? '?' + new URLSearchParams(Object.entries(o.consulta).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])) : '';
  let r: Response;
  try {
    r = await fetch(BASE + ruta + qs, {
      method: metodo,
      headers: { authorization: 'Bearer ' + CLAVE, ...(o.cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(o.cabeceras ?? {}) },
      body: o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined,
      signal: AbortSignal.timeout(60000),
      redirect: 'manual',   // la clave no sigue a otra dirección
    });
  } catch { throw new Rechazo('red', 504, 'Zernio no contestó'); }
  const texto = tapar(await r.text());
  // deno-lint-ignore no-explicit-any
  let js: any = null; try { js = texto ? JSON.parse(texto) : {}; } catch { /* no es JSON */ }
  if (!r.ok) {
    // Lo leído del JSON se tapa otra vez antes de recortarlo: Zernio podría escribir la clave con escapes (\uXXXX), que el texto
    // crudo no deja ver y JSON.parse sí deshace.
    const dice = tapar(js && typeof (js.error || js.message) === 'string' ? js.error || js.message : texto.slice(0, 300));
    const det = js && js.details !== undefined ? tapar(JSON.stringify(js.details)) : '';
    const detalles = det && det.length <= 2000 ? { details: JSON.parse(det) } : {};
    throw new Rechazo('zernio', 502, `Zernio ${r.status}: ${dice}`.slice(0, 500), { zernio: r.status, ...detalles,
      ...(js && typeof js.existingPostId === 'string' ? { existingPostId: tapar(js.existingPostId).slice(0, 64) } : {}) });
  }
  if (!objeto(js)) throw new Rechazo('zernio', 502, 'Zernio contestó algo que no se entiende');
  return js;
}

// Lo que publicaría ya: `publishNow` (a cualquier valor, también false) u otro campo «publicar/postear/enviar ahora», en cualquier
// sitio del JSON.
const PUBLICA_YA = /^(publish|post|send)[_-]?(now|immediately|immediate)$/i;
function publicaYa(v: unknown, prof = 0): string | null {
  if (prof > 32) throw forma('el JSON anida demasiado');
  if (Array.isArray(v)) { for (const x of v) { const k = publicaYa(x, prof + 1); if (k) return k; } return null; }
  if (objeto(v)) for (const [k, x] of Object.entries(v)) { if (PUBLICA_YA.test(k)) return k; const d = publicaYa(x, prof + 1); if (d) return d; }
  return null;
}

// El instante de una fecha ISO 8601 con Z o diferencia horaria, o NaN. Estricta: el lector de fechas de JavaScript acepta textos
// raros («mañana a las 10Z») y días que no existen (30 de febrero), y Zernio podría leerlos de otra forma.
function instante(t: string): number {
  const m = ISO.exec(t);
  if (!m) return NaN;
  const [a, me, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number);
  if (me < 1 || me > 12 || d < 1 || d > new Date(Date.UTC(a, me, 0)).getUTCDate() || h > 23 || mi > 59 || s > 59) return NaN;
  if (m[7] !== 'Z' && (+m[8] > 14 || +m[9] > 59)) return NaN;
  return Date.parse(t);
}

// Lista blanca: un post o un cambio solo lleva los campos que mandan las skills (feed-preparation y diseno-historias) y con su
// forma; cualquier otro (un `status`, una hora con otro nombre, un campo de cola…) se rechaza antes de llegar a Zernio, así nada
// que Zernio entienda como «publicar ya» pasa por un nombre que la función no conoce. Las horas y el borrador los mira
// comprobarTiempos.
type Regla = (v: unknown, donde: string) => void;
const libre: Regla = () => {};
const texto = (max: number, re?: RegExp): Regla => (v, d) => {
  if (typeof v !== 'string' || v.length > max || (re && !re.test(v))) throw forma(`${d} está mal escrito`);
};
const fraccion: Regla = (v, d) => { if (typeof v !== 'number' || !(v >= 0 && v <= 1)) throw forma(`${d}: un número de 0 a 1`); };
const indice: Regla = (v, d) => { if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 19) throw forma(`${d}: la diapositiva, de 0 a 19`); };
const lista = (r: Regla, max: number): Regla => (v, d) => {
  if (!Array.isArray(v) || v.length > max) throw forma(`${d}: una lista (como mucho ${max})`);
  v.forEach((x, i) => r(x, `${d}[${i}]`));
};
const campos = (c: Record<string, Regla>): Regla => (v, d) => {
  if (!objeto(v)) throw forma(`${d}: un objeto`);
  for (const [k, x] of Object.entries(v)) {
    if (!Object.hasOwn(c, k)) throw forma(`«${corto(k)}» no va en ${d} (${Object.keys(c).join(', ')})`);
    c[k](x, `${d}.${k}`);
  }
};
const USUARIO = /^[A-Za-z0-9._]+$/;
const metadatos: Regla = (v, d) => {   // las marcas de la Mesa (mesaSlot, mesaStory, mesaClient), solo texto
  if (!objeto(v)) throw forma(`${d}: un objeto`);
  for (const [k, x] of Object.entries(v)) {
    if (!/^mesa[A-Za-z]{1,30}$/.test(k)) throw forma(`«${corto(k)}» no va en ${d} (mesaSlot, mesaStory, mesaClient)`);
    texto(200)(x, `${d}.${k}`);
  }
};
const POST = campos({
  content: texto(10000),
  mediaItems: lista(campos({ type: texto(10, /^(image|video)$/), url: texto(2000, /^https:\/\/[^\s]+$/) }), 20),
  platforms: lista(campos({
    platform: texto(30, /^[a-z_]+$/), accountId: texto(64, /^[A-Za-z0-9]+$/), scheduledFor: libre,
    platformSpecificData: campos({
      contentType: texto(10, /^story$/), locationId: texto(40, /^\d+$/),
      userTags: lista(campos({ username: texto(64, USUARIO), x: fraccion, y: fraccion, mediaIndex: indice }), 20),
      collaborators: lista(texto(64, USUARIO), 10),
    }),
  }), 5),
  scheduledFor: libre, timezone: texto(64, /^[A-Za-z0-9_+\-/]+$/), isDraft: libre, metadata: metadatos,
});

// La guarda que importa: nada sale ya por accidente (tools/zernio.mjs `checkTiming`, más estricta: también con isDraft se mira cada
// fecha que venga, un scheduledFor null o vacío no vale, la fecha es ISO estricta y un borrador solo deja de serlo con su fecha).
function comprobarTiempos(b: Record<string, unknown>, nuevo: boolean) {
  const campo = publicaYa(b);
  if (campo) throw new Rechazo('publicar_ya', 400, `${corto(campo)} no está permitido: esta función solo programa`);
  if (b.isDraft !== undefined && typeof b.isDraft !== 'boolean') throw forma('isDraft tiene que ser true o false');
  if (b.platforms !== undefined && !Array.isArray(b.platforms)) throw forma('platforms tiene que ser una lista: [{platform, accountId}]');
  const plataformas = (b.platforms as unknown[] | undefined) ?? [];
  if (plataformas.some((p) => !objeto(p))) throw forma('cada plataforma es un objeto: {platform, accountId}');
  if (nuevo && !b.isDraft && !b.scheduledFor) throw forma('falta scheduledFor (sin él Zernio lo guarda como borrador; para eso, isDraft: true)');
  if (!nuevo && b.isDraft === false && !b.scheduledFor) throw forma('para que deje de ser borrador hace falta scheduledFor, con margen');
  const horas = [b.scheduledFor, ...plataformas.map((p) => (p as Record<string, unknown>).scheduledFor)].filter((t) => t !== undefined);
  for (const t of horas) {
    if (typeof t !== 'string' || !ISO.test(t)) throw forma(`scheduledFor «${corto(t)}» tiene que ser una fecha ISO con Z o la diferencia horaria (p. ej. 2026-11-03T17:00:00Z)`);
    const ms = instante(t);
    if (!Number.isFinite(ms)) throw forma(`scheduledFor «${corto(t)}» no es una fecha que exista`);
    if (ms < Date.now() + MARGEN_MS) throw new Rechazo('margen', 400, `scheduledFor «${corto(t)}» es pasado o falta menos de ${MARGEN_MS / 60000} min: Zernio lo publicaría ya`);
  }
  if (nuevo && !b.isDraft && !plataformas.length) throw forma('falta platforms: [{platform, accountId}]');
}

// Lo mismo que enseña tools/zernio.mjs de cada post.
// deno-lint-ignore no-explicit-any
const slim = (p: any) => p && ({
  id: p._id, status: p.status, scheduledFor: p.scheduledFor, timezone: p.timezone,
  // deno-lint-ignore no-explicit-any
  content: p.content, media: (p.mediaItems || []).map((m: any) => m && m.url),
  // deno-lint-ignore no-explicit-any
  platforms: (p.platforms || []).map((x: any) => {
    const d = (x && x.platformSpecificData) || {};
    return {
      platform: x.platform, accountId: x.accountId && (x.accountId._id || x.accountId), status: x.status,
      ...(d.locationId ? { locationId: d.locationId } : {}),
      // deno-lint-ignore no-explicit-any
      ...(Array.isArray(d.userTags) && d.userTags.length ? { userTags: d.userTags.map((t: any) => (t && typeof t === 'object' ? `${t.username}${t.mediaIndex ? ' #' + t.mediaIndex : ''}` : String(t))) } : {}),
      ...(Array.isArray(d.collaborators) && d.collaborators.length ? { collaborators: d.collaborators } : {}),
      ...(x.platformPostUrl ? { url: x.platformPostUrl } : {}), ...(x.errorMessage ? { error: x.errorMessage } : {}),
    };
  }),
  ...(p.metadata && typeof p.metadata === 'object' && Object.keys(p.metadata).length ? { metadata: p.metadata } : {}),
});

const sha256 = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))),
  (b) => b.toString(16).padStart(2, '0')).join('');

const FILTROS: Record<string, [RegExp, string]> = {
  account: [/^[A-Za-z0-9]{1,64}$/, 'accountId'], status: [/^[a-z_]{1,30}$/, 'status'], platform: [/^[a-z_]{1,30}$/, 'platform'],
  from: [DIA, 'dateFrom'], to: [DIA, 'dateTo'],
};

const ORDENES: Record<string, { campos: string[]; hacer: (p: Record<string, unknown>) => Promise<Record<string, unknown>> }> = {
  presign: { campos: ['n'], async hacer(p) {
    const k = p.n === undefined ? 1 : p.n;
    if (typeof k !== 'number' || !Number.isInteger(k) || k < 1 || k > 20) throw forma('n: entre 1 y 20 (un carrusel de Instagram admite hasta 20)');
    const urls = [];
    for (let i = 0; i < k; i++) {
      const r = await zernio('POST', '/media/presign', { cuerpo: { filename: `mesa-${Date.now()}-${i + 1}.jpg`, contentType: 'image/jpeg' } });
      if (typeof r.uploadUrl !== 'string' || typeof r.publicUrl !== 'string') throw new Rechazo('zernio', 502, 'Zernio no dio las URL de subida');
      urls.push({ uploadUrl: r.uploadUrl, publicUrl: r.publicUrl, expiresIn: r.expiresIn });
    }
    return { urls };
  } },
  schedule: { campos: ['post'], async hacer(p) {
    const b = p.post;
    if (!objeto(b)) throw forma('post: el JSON del post, como el de tools/zernio.mjs schedule');
    POST(b, 'post');
    comprobarTiempos(b, true);
    // el mismo cuerpo, la misma clave: un reintento tras un corte devuelve el post ya creado en vez de uno segundo
    const r = await zernio('POST', '/posts', { cuerpo: b, cabeceras: { 'idempotency-key': await sha256(JSON.stringify(b)) } });
    return { post: slim(r.post || r) };
  } },
  posts: { campos: ['filtros'], async hacer(p) {
    const f = p.filtros === undefined ? {} : p.filtros;
    if (!objeto(f)) throw forma('filtros: {account, status, platform, from, to}');
    const consulta: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) {
      if (!Object.hasOwn(FILTROS, k)) throw forma(`filtro desconocido «${corto(k)}»: account, status, platform, from o to`);
      if (v === undefined || v === null || v === '') continue;
      if (typeof v !== 'string' || !FILTROS[k][0].test(v)) throw forma(`el filtro ${k} está mal escrito`);
      consulta[FILTROS[k][1]] = v;
    }
    const todos: unknown[] = [];
    for (let page = 1; ; page++) {
      const r = await zernio('GET', '/posts', { consulta: { page, limit: 100, ...consulta } });
      todos.push(...(Array.isArray(r.posts) ? r.posts : []));
      const paginas = r.pagination ? (+r.pagination.pages || 1) : 1;
      // en cuanto Zernio dice que hay más de 50 páginas, sin pedirlas: estrechar los filtros
      if (paginas > MAX_PAGINAS) throw new Rechazo('tope', 413, `más de ${MAX_PAGINAS * 100} posts: estrecha los filtros (account, status, from, to)`);
      if (page >= paginas) break;
    }
    return { posts: todos.map(slim) };
  } },
  update: { campos: ['id', 'patch'], async hacer(p) {
    if (typeof p.id !== 'string' || !ID.test(p.id)) throw forma('id: el id del post en Zernio');
    const b = p.patch;
    if (!objeto(b)) throw forma('patch: lo que cambia del post');
    POST(b, 'patch');
    comprobarTiempos(b, false);
    // Solo un post programado o en borrador; y uno que se queda con su hora (el cambio no trae otra ni lo deja en borrador),
    // solo si esa hora tiene margen: editar uno fallido, a punto de salir o ya pasado podría publicarlo en el acto.
    const actual = await zernio('GET', '/posts/' + encodeURIComponent(p.id));
    const ya = objeto(actual.post) ? actual.post : actual;
    const estado = typeof ya.status === 'string' ? ya.status : '';
    if (estado !== 'scheduled' && estado !== 'draft') throw new Rechazo('estado', 409, `el post está «${corto(estado || '?')}»: solo se cambia uno programado o en borrador`);
    const borrador = b.isDraft === true || (estado === 'draft' && b.isDraft === undefined);
    if (!b.scheduledFor && !borrador) {
      const ms = typeof ya.scheduledFor === 'string' ? Date.parse(ya.scheduledFor) : NaN;   // la de Zernio: su formato
      if (!(ms >= Date.now() + MARGEN_MS)) throw new Rechazo('margen', 400, `el post sale «${corto(ya.scheduledFor)}»: falta menos de ${MARGEN_MS / 60000} min o ya pasó; manda también un scheduledFor con margen`);
    }
    const r = await zernio('PUT', '/posts/' + encodeURIComponent(p.id), { cuerpo: b });
    return { post: slim(r.post || r) };
  } },
};

async function leerPedido(req: Request) {
  const t = await req.text();
  if (t.length > MAX_CUERPO) throw new Rechazo('cuerpo', 413, `el pedido pasa de ${MAX_CUERPO / 1000} KB`);
  let p: unknown;
  try { p = JSON.parse(t); } catch { throw new Rechazo('cuerpo', 400, 'el pedido no es JSON'); }
  if (!objeto(p)) throw new Rechazo('cuerpo', 400, 'el pedido es un objeto: {orden, …}');
  if (typeof p.orden !== 'string' || !Object.hasOwn(ORDENES, p.orden)) throw new Rechazo('orden', 400, 'orden: presign, schedule, posts o update');
  const campo = publicaYa(p);   // en cualquier sitio del pedido, también fuera del post
  if (campo) throw new Rechazo('publicar_ya', 400, `${corto(campo)} no está permitido: esta función solo programa`);
  const sobra = Object.keys(p).find((k) => k !== 'orden' && !ORDENES[p.orden].campos.includes(k));
  if (sobra) throw forma(`«${corto(sobra)}» no va en ${p.orden} (${ORDENES[p.orden].campos.join(', ')})`);
  return p;
}

Deno.serve(async (req) => {
  const origen = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origen) });
  try {
    if (req.method !== 'POST') throw new Rechazo('metodo', 405, 'solo POST');
    await soloKevin(req.headers.get('authorization') ?? '');
    if (CLAVE.length < 16 || !/^https:\/\/[^/]+/.test(BASE)) throw new Rechazo('config', 500, 'falta la clave o la dirección de Zernio en el servidor (node tools/web.mjs zernio …)');
    const p = await leerPedido(req);
    return responder({ ok: true, ...(await ORDENES[p.orden as string].hacer(p)) }, origen);
  } catch (e) {
    // Nunca el mensaje de un fallo inesperado: podría llevar cualquier cosa.
    const r = e instanceof Rechazo ? e : new Rechazo('servidor', 500, 'fallo inesperado');
    return responder({ ok: false, error: { codigo: r.codigo, http: r.http, mensaje: r.message, ...r.extra } }, origen);
  }
});
