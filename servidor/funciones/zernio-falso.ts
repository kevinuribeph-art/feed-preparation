// Zernio simulado, SOLO para el proyecto de pruebas (Supabase Edge Function, Deno, sin dependencias). Traspaso C, lote 6.
// Lo despliega `node tools/web.mjs zernio pruebas` (la orden nunca lo lleva al real) y la función `zernio` de pruebas lo llama
// por su secreto `ZERNIO_BASE`. Contesta como Zernio a lo que usa esa función (presign, crear, listar y actualizar posts) y deja
// ver lo que recibió: cada post lleva en `metadata.falso` el método, la ruta, la consulta, el cuerpo, si traía la clave inventada
// correcta y la clave de idempotencia; cada URL de subida, el nombre y el tipo que se pidieron.
// Solo funciona si la clave del proyecto es inventada (`falsa-…`): con otra no compara nada y contesta 500.
// Para probar que la función tapa la clave, un `content` con:
//   «repite-clave»  contesta un error 400 largo que la repite justo donde un recorte de 300 caracteres la partiría;
//   «eco-clave»     crea el post y lo devuelve con la cabecera recibida en `metadata.falso.auth`;
//   «duplicado»     contesta 409 con `existingPostId`, como Zernio con un post repetido.
// Una clave equivocada recibe 401, como en Zernio.

const CLAVE = (Deno.env.get('ZERNIO_API_KEY') ?? '').trim();
const INVENTADA = /^falsa-[A-Za-z0-9_-]{16,}$/.test(CLAVE);
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });
const id24 = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  if (!INVENTADA) return json({ error: 'este Zernio simulado solo funciona con una clave inventada' }, 500);
  const u = new URL(req.url);
  const ruta = u.pathname.replace(/^.*?\/zernio-falso(?=\/|$)/, '') || '/';
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== 'Bearer ' + CLAVE) return json({ error: 'Unauthorized' }, 401);
  // deno-lint-ignore no-explicit-any
  let cuerpo: any = null;
  const t = await req.text();
  if (t) { try { cuerpo = JSON.parse(t); } catch { return json({ error: 'Invalid JSON' }, 400); } }
  const recibido: Record<string, unknown> = { metodo: req.method, ruta, consulta: Object.fromEntries(u.searchParams), cuerpo, clave: true,
    idempotencia: req.headers.get('idempotency-key') };
  const contenido = cuerpo && typeof cuerpo.content === 'string' ? cuerpo.content : '';
  if (contenido.includes('repite-clave')) return json({ error: 'x'.repeat(290) + ' ' + auth + ' ' + 'y'.repeat(200) }, 400);
  if (contenido.includes('duplicado')) return json({ error: 'A post with this content already exists', existingPostId: 'f'.repeat(24) }, 409);
  if (contenido.includes('eco-clave')) recibido.auth = auth;

  // deno-lint-ignore no-explicit-any
  const post = (id: string, b: any) => ({
    _id: id, status: 'scheduled', scheduledFor: b?.scheduledFor ?? null, timezone: b?.timezone ?? 'UTC', content: b?.content ?? '',
    mediaItems: b?.mediaItems ?? [],
    // deno-lint-ignore no-explicit-any
    platforms: (Array.isArray(b?.platforms) ? b.platforms : []).map((p: any) => ({ ...p, status: 'pending' })),
    metadata: { falso: recibido },
  });
  if (req.method === 'POST' && ruta === '/media/presign') {
    const nombre = encodeURIComponent(String(cuerpo?.filename ?? ''));
    return json({ uploadUrl: `https://falso.invalid/subir/${nombre}?tipo=${encodeURIComponent(String(cuerpo?.contentType ?? ''))}`,
      publicUrl: `https://falso.invalid/media/${nombre}`, expiresIn: 3600 });
  }
  if (req.method === 'POST' && ruta === '/posts') return json({ post: post(id24(), cuerpo) }, 201);
  if (req.method === 'GET' && ruta === '/posts') {   // dos páginas, un post en cada una
    const page = Math.max(1, +(u.searchParams.get('page') ?? 1) || 1);
    return json({ posts: page <= 2 ? [post('0'.repeat(23) + page, { content: 'falso ' + page })] : [], pagination: { page, pages: 2, total: 2 } });
  }
  const m = ruta.match(/^\/posts\/([^/]+)$/);
  if (req.method === 'PUT' && m) return json({ post: post(decodeURIComponent(m[1]), cuerpo) });
  return json({ error: 'Not found' }, 404);
});
