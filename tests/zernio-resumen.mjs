// node tests/zernio-resumen.mjs — prueba de «tools/zernio.mjs resumen» (D-239) sin red ni clave de verdad: un `fetch` falso
// con publicaciones inventadas y una clave falsa en el entorno (el .env nunca se lee: la del entorno va primero).
// IF-Z1 forma y sumas · IF-Z2 días de Madrid · IF-Z3 historias, repetidas y páginas · IF-Z4 solo /v1/analytics ·
// IF-Z5 la clave nunca sale · IF-Z6 errores de uso.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CLAVE = 'clave-falsa-de-prueba-1234567890';
const CUENTA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
// the fake Zernio: the posts of a made-up account; it remembers every request in a file the test reads
const FALSO = `
const fs = await import('node:fs');
const POSTS = ${JSON.stringify([
  // October in Madrid: 30 Sep 22:30Z is 1 Oct 00:30; 31 Oct 23:30Z is 1 Nov 00:30 (out)
  { _id: 'p1', publishedAt: '2026-09-30T22:30:00.000Z', status: 'published', mediaType: 'carousel', mediaProductType: 'FEED', mediaItems: [{}, {}, {}], platformPostUrl: 'https://www.instagram.com/p/AAA1/', platforms: [{ accountId: CUENTA, platformPostId: '1', analytics: { reach: 1000, likes: 50, comments: 5, shares: 3, saves: 2 } }] },
  { _id: 'p2', publishedAt: '2026-10-10T11:30:00.000Z', status: 'published', mediaType: 'video', mediaProductType: 'REELS', mediaItems: [{}], platformPostUrl: 'https://www.instagram.com/reel/AAA2/', platforms: [{ accountId: CUENTA, platformPostId: '2', analytics: { reach: 2500, likes: 100, comments: 10, shares: 20, saves: 15 } }] },
  { _id: 'p2b', publishedAt: '2026-10-10T11:30:00.000Z', status: 'published', mediaType: 'video', mediaProductType: 'REELS', mediaItems: [{}], platformPostUrl: 'https://www.instagram.com/reel/AAA2/', platforms: [{ accountId: CUENTA, platformPostId: '2', analytics: { reach: 2500, likes: 100, comments: 10, shares: 20, saves: 15 } }] },
  { _id: 'p3', publishedAt: '2026-10-12T17:00:00.000Z', status: 'published', mediaType: 'image', mediaProductType: 'STORY', mediaItems: [{}], platformPostUrl: 'https://www.instagram.com/stories/x/1/', platforms: [{ accountId: CUENTA, platformPostId: '3', analytics: { reach: 300 } }] },
  { _id: 'p4', publishedAt: '2026-10-20T08:00:00.000Z', status: 'published', mediaType: 'carousel', mediaProductType: 'FEED', mediaItems: [{}], platformPostUrl: 'https://www.instagram.com/p/AAA4/', platforms: [{ accountId: CUENTA, platformPostId: '4', analytics: { reach: 700, likes: 30, comments: null, shares: 0, saves: 1 } }] },
  { _id: 'p5', publishedAt: '2026-10-31T23:30:00.000Z', status: 'published', mediaType: 'carousel', mediaProductType: 'FEED', mediaItems: [{}, {}], platformPostUrl: 'https://www.instagram.com/p/AAA5/', platforms: [{ accountId: CUENTA, platformPostId: '5', analytics: { reach: 999, likes: 9 } }] },
  // September (the month before)
  { _id: 'q1', publishedAt: '2026-09-05T10:00:00.000Z', status: 'published', mediaType: 'carousel', mediaProductType: 'FEED', mediaItems: [{}, {}], platformPostUrl: 'https://www.instagram.com/p/BBB1/', platforms: [{ accountId: CUENTA, platformPostId: '11', analytics: { reach: 800, likes: 40, comments: 2, shares: 1, saves: 3 } }] },
  { _id: 'q2', publishedAt: '2026-09-15T10:00:00.000Z', status: 'failed', mediaType: 'carousel', mediaProductType: 'FEED', mediaItems: [{}], platformPostUrl: '', platforms: [{ accountId: CUENTA, platformPostId: '12', analytics: { reach: 5 } }] }
])};
globalThis.fetch = async (url, o) => {
  const u = new URL(url), q = Object.fromEntries(u.searchParams);
  fs.appendFileSync(process.env.LOG_FALSO, JSON.stringify({ path: u.pathname, q, auth: (o.headers || {}).authorization }) + '\\n');
  const json = (st, b) => ({ ok: st < 400, status: st, text: async () => JSON.stringify(b) });
  if (u.pathname !== '/api/v1/analytics') return json(404, { error: 'no' });
  if (process.env.ERROR_FALSO) return json(401, { error: 'clave no válida: ' + (o.headers || {}).authorization });
  const desde = Date.parse(q.fromDate + 'T00:00:00Z'), hasta = Date.parse(q.toDate + 'T23:59:59Z');
  const l = POSTS.filter(p => { const t = Date.parse(p.publishedAt); return t >= desde && t <= hasta; });
  const page = +q.page || 1, por = 2, pages = Math.max(1, Math.ceil(l.length / por));   // two per page: the command must go through them all
  return json(200, { posts: l.slice((page - 1) * por, page * por), pagination: { page, limit: por, total: l.length, pages }, accounts: [{ _id: '${CUENTA}', platform: 'instagram', username: 'cuenta_de_prueba' }, { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', platform: 'instagram', username: 'otra' }] });
};
`;
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'zernio-'));
let fallos = 0, pasan = 0;
const ok = (c, m) => { if (c) pasan++; else { fallos++; console.log(' ✗ ' + m); } };
function correr(args, extra = {}) {
  const log = join(dir, 'log-' + Math.random().toString(36).slice(2));
  const r = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(FALSO), join(RAIZ, 'tools/zernio.mjs'), ...args], { env: { ...process.env, ZERNIO_API_KEY: CLAVE, LOG_FALSO: log, ...extra }, encoding: 'utf8' });
  let pet = []; try { pet = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { /* none */ }
  let js = null; try { js = JSON.parse(r.stdout); } catch (e) { /* */ }
  return { code: r.status, out: r.stdout + r.stderr, js, pet };
}

try {
  // IF-Z1, IF-Z2, IF-Z3: October of the made-up account
  const r = correr(['resumen', CUENTA, '--from', '2026-10-01', '--to', '2026-10-31']);
  ok(r.code === 0 && r.js, 'IF-Z1: el comando falla: ' + r.out.slice(0, 300));
  const j = r.js || {};
  ok(JSON.stringify(j.cuenta) === JSON.stringify({ id: CUENTA, usuario: 'cuenta_de_prueba', plataforma: 'instagram' }), 'IF-Z1: la cuenta: ' + JSON.stringify(j.cuenta));
  ok(JSON.stringify(j.periodo) === JSON.stringify({ desde: '2026-10-01', hasta: '2026-10-31', zona: 'Europe/Madrid' }) && JSON.stringify(j.anterior) === JSON.stringify({ desde: '2026-09-01', hasta: '2026-09-30' }), 'IF-Z1: el periodo o el anterior');
  const fechas = (j.posts || []).map(p => p.fecha + ' ' + p.hora);
  ok(JSON.stringify(fechas) === JSON.stringify(['2026-10-01 00:30', '2026-10-10 13:30', '2026-10-20 10:00']), 'IF-Z2: días y horas de Madrid (dentro el 1 oct 00:30, fuera el 1 nov 00:30): ' + JSON.stringify(fechas));
  ok((j.posts || []).length === 3, 'IF-Z3: sin historias ni repetidas, por todas las páginas: ' + (j.posts || []).length);
  const p0 = (j.posts || [])[0] || {}, p1 = (j.posts || [])[1] || {}, p2 = (j.posts || [])[2] || {};
  ok(p0.tipo === 'carousel' && p0.fotos === 3 && p0.alcance === 1000 && p0.interacciones === 60 && p0.guardados === 2 && p0.enlace === 'https://www.instagram.com/p/AAA1/', 'IF-Z1: la primera publicación: ' + JSON.stringify(p0));
  ok(p1.tipo === 'reel' && p1.fotos === 0 && p1.interacciones === 145, 'IF-Z1: el reel: ' + JSON.stringify(p1));
  ok(p2.fotos === 1 && p2.interacciones === 31, 'IF-Z1: una foto suelta (un comentario null cuenta 0): ' + JSON.stringify(p2));
  const c = j.cifras || {};
  ok(JSON.stringify(c) === JSON.stringify({ alcance: { valor: 4200, anterior: 800 }, interacciones: { valor: 236, anterior: 46 }, guardados: { valor: 18, anterior: 3 }, publicaciones: { valor: 3, anterior: 1 } }), 'IF-Z1: las cifras (el fallido de septiembre no cuenta): ' + JSON.stringify(c));
  ok(Object.keys(j).join() === 'cuenta,periodo,anterior,cifras,posts,nota', 'IF-Z1: las claves de la salida: ' + Object.keys(j).join());
  // IF-Z4: only /v1/analytics, per-post, a day more on each side, Madrid days filtered here
  ok(r.pet.length >= 3 && r.pet.every(x => x.path === '/api/v1/analytics' && x.q.source === 'all' && x.q.accountId === CUENTA), 'IF-Z4: pide algo que no es /v1/analytics?source=all: ' + JSON.stringify(r.pet.map(x => x.path)));
  ok(r.pet.some(x => x.q.fromDate === '2026-09-30' && x.q.toDate === '2026-11-01') && r.pet.some(x => x.q.fromDate === '2026-08-31' && x.q.toDate === '2026-10-01'), 'IF-Z4: no pide un día más a cada lado: ' + JSON.stringify(r.pet.map(x => x.q.fromDate + '..' + x.q.toDate)));
  ok(r.pet.some(x => x.q.page === '2'), 'IF-Z3: no pasa a la página 2');
  // IF-Z5: the key never goes out, not even when Zernio repeats it in an error
  ok(!r.out.includes(CLAVE), 'IF-Z5: la clave sale en la salida');
  const e = correr(['resumen', CUENTA, '--from', '2026-10-01', '--to', '2026-10-31'], { ERROR_FALSO: '1' });
  ok(e.code === 1 && e.js && /Zernio 401/.test(e.js.error) && !e.out.includes(CLAVE) && e.out.includes('[clave]'), 'IF-Z5: un error de Zernio que repite la clave la enseña: ' + e.out.slice(0, 200).replaceAll(CLAVE, '***'));
  // IF-Z6: usage errors, before asking anything
  for (const [args, re] of [[['resumen'], /accountId/], [['resumen', CUENTA, '--from', '2026-10-01'], /--to/], [['resumen', CUENTA, '--from', '2026-02-30', '--to', '2026-03-01'], /no es un día que exista/], [['resumen', CUENTA, '--from', '2026-10-31', '--to', '2026-10-01'], /antes que --to/], [['resumen', CUENTA, '--from', '2026-01-01', '--to', '2026-06-30'], /93 días/], [['resumen', 'bbbbbbbbbbbbbbbbbbbbbbbc', '--from', '2026-10-01', '--to', '2026-10-31'], /no está conectada/]]) {
    const x = correr(args);
    ok(x.code === 1 && x.js && re.test(x.js.error), `IF-Z6: ${args.slice(1).join(' ')} no da ${re}: ${x.out.slice(0, 200)}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(`zernio resumen: ${pasan} pasan, ${fallos} fallan`);
process.exit(fallos ? 1 : 0);
