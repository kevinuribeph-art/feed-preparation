// Función `firmar` del portal de clientes (Supabase Edge Function, Deno, sin dependencias). Revisión del lote 1.
// Un cliente no lee el almacén de archivos: pide aquí las URL de lo que necesita. Solo se firman las rutas que usa algo que
// esa persona puede ver (lo decide la base con sus permisos por fila, preguntando con su propia sesión), y con caducidad
// fija: 10 minutos las fotos y 60 s las facturas. La aplica `node tools/web.mjs funciones <pruebas|real>`.
//   POST /functions/v1/firmar  { bucket: 'fotos' | 'facturas', rutas: string[] }  →  { urls: { ruta: url } }

const URL_P = Deno.env.get('SUPABASE_URL') ?? '';
const nuevas = (n: string) => { try { return JSON.parse(Deno.env.get(n) ?? '{}').default ?? ''; } catch { return ''; } };
const PUBLICA = Deno.env.get('SUPABASE_ANON_KEY') || nuevas('SUPABASE_PUBLISHABLE_KEYS');
const SECRETA = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || nuevas('SUPABASE_SECRET_KEYS');
const TTL: Record<string, number> = { fotos: 600, facturas: 60 };
const RUTA = /^[a-z0-9-]+\/[a-z0-9._-]+$/;

// Solo el portal (y una copia de pruebas en este Mac) la llama desde un navegador; sin cabecera, el navegador no deja leerla.
// La versión de prueba de Cloudflare (rama `subdominio`), solo mientras Kevin prueba antes de fusionar: se quita al fusionar.
const PRUEBA = 'https://subdominio.uribevisuals-clientes.pages.dev';
const PERMITIDO = (o: string | null) => !!o && (o === 'https://clientes.uribevisuals.studio' || o === PRUEBA || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(o));
const cors = (origen: string | null) => ({
  ...(PERMITIDO(origen) ? { 'Access-Control-Allow-Origin': origen as string } : {}),
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const responder = (cuerpo: unknown, estado: number, origen: string | null) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cors(origen), 'Content-Type': 'application/json' } });
const cab = (clave: string, token?: string) => {
  const h: Record<string, string> = { apikey: clave };
  if (token) h.Authorization = token; else if (clave.startsWith('eyJ')) h.Authorization = 'Bearer ' + clave;
  return h;
};

Deno.serve(async (req) => {
  const origen = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origen) });
  if (req.method !== 'POST') return responder({ error: 'método' }, 405, origen);
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/.test(auth)) return responder({ error: 'sin sesión' }, 401, origen);
  let pedido: { bucket?: unknown; rutas?: unknown };
  try { pedido = await req.json(); } catch { return responder({ error: 'cuerpo' }, 400, origen); }
  if (!pedido || typeof pedido !== 'object' || Array.isArray(pedido)) return responder({ error: 'cuerpo' }, 400, origen);
  const bucket = String(pedido.bucket ?? '');
  if (!Object.hasOwn(TTL, bucket) || !Array.isArray(pedido.rutas)) return responder({ error: 'pedido' }, 400, origen);
  if (pedido.rutas.length > 100) return responder({ error: 'como mucho 100 rutas por petición' }, 413, origen);
  const rutas = pedido.rutas.filter((r): r is string => typeof r === 'string' && RUTA.test(r));
  if (!rutas.length) return responder({ error: 'pedido' }, 400, origen);

  // Lo que esta persona puede ver, preguntado con su sesión: los permisos por fila deciden. Por páginas de 1000 filas.
  const todas = async (ruta: string): Promise<Record<string, unknown>[] | number> => {
    const out: Record<string, unknown>[] = [];
    for (let desde = 0; ; desde += 1000) {
      const r = await fetch(`${URL_P}/rest/v1/${ruta}&limit=1000&offset=${desde}`, { headers: cab(PUBLICA, auth) });
      if (!r.ok) return r.status === 401 ? 401 : 403;
      const l = await r.json(); out.push(...l); if (l.length < 1000) return out;
    }
  };
  const puede = new Set<string>();
  try {
    if (bucket === 'fotos') {
      const [p, c] = await Promise.all([todas('publicaciones?select=imagenes&visible=is.true'), todas('clientes?select=foto')]);
      if (typeof p === 'number' || typeof c === 'number') return responder({ error: 'sin permiso' }, p === 401 || c === 401 ? 401 : 403, origen);
      for (const fila of p) for (const im of (fila.imagenes as { ruta?: string; mini?: string }[]) ?? []) { if (im?.ruta) puede.add(im.ruta); if (im?.mini) puede.add(im.mini); }
      for (const fila of c) if (fila.foto) puede.add(String(fila.foto));
    } else {
      const p = await todas('pagos?select=pdf');
      if (typeof p === 'number') return responder({ error: 'sin permiso' }, p === 401 ? 401 : 403, origen);
      for (const fila of p) if (fila.pdf) puede.add(String(fila.pdf));
    }
  } catch { return responder({ error: 'no se pudo comprobar' }, 502, origen); }

  const firmables = rutas.filter((r) => puede.has(r));
  if (!firmables.length) return responder({ urls: {} }, 200, origen);
  const r = await fetch(`${URL_P}/storage/v1/object/sign/${bucket}`, {
    method: 'POST', headers: { ...cab(SECRETA), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: TTL[bucket], paths: firmables }),
  });
  if (!r.ok) return responder({ error: 'no se pudo firmar' }, 502, origen);
  const urls: Record<string, string> = {};
  for (const x of await r.json()) if (x?.signedURL && !x.error) urls[x.path] = `${URL_P}/storage/v1${x.signedURL}`;
  return responder({ urls }, 200, origen);
});
