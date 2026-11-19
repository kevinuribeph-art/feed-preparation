// Zernio simulado, SOLO para el proyecto de pruebas (Supabase Edge Function, Deno, sin dependencias). Traspaso C, lote 6.
// Lo despliega `node tools/web.mjs zernio pruebas` (la orden nunca lo lleva al real) y la función `zernio` de pruebas lo llama
// por su secreto `ZERNIO_BASE`. Contesta como Zernio a lo que usa esa función (presign, crear, listar y actualizar posts) y deja
// ver lo que recibió: cada post lleva en `metadata.falso` el método, la ruta, la consulta, el cuerpo, si traía la clave inventada
// correcta y la clave de idempotencia; cada URL de subida, el nombre y el tipo que se pidieron.
// Solo funciona si la clave del proyecto es inventada (`falsa-…`): con otra no compara nada y contesta 500.
// Para probar que la función tapa la clave, un `content` con:
//   «repite-clave»  contesta un error 400 largo que la repite justo donde un recorte de 300 caracteres la partiría;
//   «eco-clave»     crea el post y lo devuelve con la cabecera recibida en `metadata.falso.auth`;
//   «duplicado»     contesta 409 con `existingPostId`, como Zernio con un post repetido;
//   «clave-escapada» contesta un error 400 con la clave escrita con escapes \uXXXX, donde el recorte de 500 la partiría;
//   «redirige»      contesta 302 a sí mismo (la función no sigue redirecciones).
// `GET /posts/<id>` da su estado por el principio del id (publicado…, fallido…, pronto… a 5 min, borrador…; si no, programado
// para mañana), y `GET /posts` con la cuenta «muchas», 999 páginas.
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
  // la clave escrita con escapes \uXXXX (el texto crudo no la deja ver; JSON.parse sí), justo donde el recorte de 500 la partiría
  if (contenido.includes('clave-escapada')) {
    const esc = [...auth].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
    return new Response(`{"error":"${'x'.repeat(460)} ${esc} ${'y'.repeat(100)}"}`, { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  // una redirección a esta misma dirección: si la función la siguiera, llegaría a GET /posts y contestaría bien
  if (contenido.includes('redirige')) return new Response(null, { status: 302, headers: { Location: '?redirigido=1' } });
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
  if (req.method === 'GET' && ruta === '/posts') {   // dos páginas, un post en cada una; la cuenta «muchas», 999 páginas
    const page = Math.max(1, +(u.searchParams.get('page') ?? 1) || 1);
    if (u.searchParams.get('accountId') === 'muchas') return json({ posts: [], pagination: { page, pages: 999, total: 99900 } });
    return json({ posts: page <= 2 ? [post('0'.repeat(23) + page, { content: 'falso ' + page })] : [], pagination: { page, pages: 2, total: 2 } });
  }
  const m = ruta.match(/^\/posts\/([^/]+)$/);
  // Un post por su id: el estado y la hora salen del principio del id (publicado…, fallido…, pronto… a 5 minutos, borrador…);
  // cualquier otro, programado para mañana.
  if (req.method === 'GET' && m) {
    const id = decodeURIComponent(m[1]);
    const [status, cuando] = id.startsWith('publicado') ? ['published', -60] : id.startsWith('fallido') ? ['failed', -60]
      : id.startsWith('pronto') ? ['scheduled', 5] : id.startsWith('borrador') ? ['draft', null] : ['scheduled', 24 * 60];
    return json({ post: { ...post(id, {}), status, scheduledFor: cuando === null ? null : new Date(Date.now() + cuando * 60000).toISOString() } });
  }
  if (req.method === 'PUT' && m) return json({ post: post(decodeURIComponent(m[1]), cuerpo) });
  return json({ error: 'Not found' }, 404);
});
