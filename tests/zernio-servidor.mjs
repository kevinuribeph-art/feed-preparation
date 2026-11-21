#!/usr/bin/env node
// Prueba de Zernio desde el servidor (traspaso C, lote 6: servidor/funciones/zernio.ts, su simulado zernio-falso.ts y la orden
// `zernio` de tools/web.mjs; lecciones 94, 121 y 136). Node 18+, sin dependencias.
// Solo contra el proyecto de PRUEBAS (se niega con el real), con una clave de Zernio inventada (`falsa-…`, nueva en cada pasada) y
// el Zernio simulado: nunca la clave real ni Zernio de verdad. Con usuarios inventados: un Kevin (dueño), una clienta del portal y
// alguien con sesión que no es miembro de nada; y sin sesión.
//   1. La orden, sin red: con `fetch` falso y proyectos, tokens y claves inventados en el entorno, que en pruebas pone una clave
//      inventada (nunca ZERNIO_API_KEY) y el simulado, en el real la de ZERNIO_API_KEY y la dirección real (solo con --si) y nunca
//      el simulado, y que no enseña la clave ni en un error.
//   2. La orden de verdad contra pruebas (despliega las dos funciones y pone los secretos) y que el simulado tiene la inventada.
//   3. La función: Kevin puede presign, schedule (con margen), posts y update, y Zernio recibe lo mismo que mandó, con la clave y
//      sin `publishNow`; se rechaza una fecha sin margen, `publishNow` y cualquier campo que publique ya; los errores de Zernio
//      llegan con su código; ninguna respuesta lleva la clave; los demás reciben un rechazo sin datos; CORS.
// Al final, también si algo falla o con Ctrl-C, borra sus usuarios, su clienta y su fila de dueño, y quita las funciones y los
// secretos de Zernio que no estaban antes de empezar (si estaban, quedan con esta pasada: una clave inventada y el simulado).
//   node tests/zernio-servidor.mjs
// Necesita en .env: SUPABASE_ACCESS_TOKEN, SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA y SUPABASE_PRUEBAS_SECRETA, y el esquema
// del portal aplicado en pruebas (`node tools/web.mjs esquema pruebas`). No usa ZERNIO_API_KEY (solo `tapar()` la conoce, para taparla).
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { proyecto, rest, cab, pedir, gestion, tapar, clave, usuarioPorCorreo, Fallo } from '../tools/web.mjs';
import { conCodigo } from './codigo-app.mjs';   // Kevin entra con el código de su app (D-262)

if (process.argv.slice(2).some(a => a !== 'pruebas')) { console.error('esta prueba solo corre contra el proyecto de pruebas'); process.exit(1); }
const P = proyecto('pruebas');
if (!P.publica || !P.secreta) { console.error('faltan las claves pública y secreta del proyecto de pruebas en .env'); process.exit(1); }
if (clave('SUPABASE_REF') === P.ref) { console.error('el proyecto de pruebas es el real: esta prueba no corre ahí'); process.exit(1); }

const S = P.secreta;
const WEB = fileURLToPath(new URL('../tools/web.mjs', import.meta.url));
const FN = `${P.url}/functions/v1/zernio`, FALSO = `${P.url}/functions/v1/zernio-falso`;
const sha = t => createHash('sha256').update(t).digest('hex');
const RUN = randomBytes(4).toString('hex');
const CZ = 'falsa-' + randomBytes(16).toString('hex');            // la clave de Zernio inventada de esta pasada
const TROZOS = [CZ.slice(6, 18), CZ.slice(18, 30), CZ.slice(26)];  // una clave cortada a mitad también sería una fuga
const CLI = { id: 'prueba-zernio', nombre: 'Cliente Prueba Zernio' };
const CORREO = { k: 'kevin@zernio-pruebas.test', a: 'ana@zernio-pruebas.test', n: 'nadie@zernio-pruebas.test' };
const CLAVE = 'Pr-' + randomBytes(16).toString('hex');            // solo para estos usuarios inventados; no se imprime
const CUENTA = 'a'.repeat(24), OTRO = 'b'.repeat(24);             // ids de Zernio inventados
const SLUGS = ['zernio', 'zernio-falso'], SECRETOS = ['ZERNIO_API_KEY', 'ZERNIO_BASE', 'ZERNIO_CORS_LOCAL'];

let fallos = 0, n = 0;
const ver = t => tapar(String(t)).split(CZ).join('[clave]');
const ok = (c, txt, extra) => { n++; if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + ver(extra).slice(0, 300) : '')); } };
const espera = ms => new Promise(f => setTimeout(f, ms));
const fugaDe = t => [CZ, ...TROZOS].some(x => String(t).includes(x));
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const igual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const PUBLICA_YA = /^(publish|post|send)[_-]?(now|immediately|immediate)$/i;
const llevaPublicarYa = v => Array.isArray(v) ? v.some(llevaPublicarYa) : v && typeof v === 'object' ? Object.entries(v).some(([k, x]) => PUBLICA_YA.test(k) || llevaPublicarYa(x)) : false;
const enMin = m => new Date(Date.now() + m * 60000).toISOString();
const todas = [], ajeno = [];   // todo lo recibido de la función (para buscar la clave) y lo que reciben los demás (para buscar datos)

// ---- 0. Solo las claves nuevas (D-280): la función no lee las heredadas (anon, service_role), apagadas y revocadas ---------------
{
  const f = readFileSync(new URL('../servidor/funciones/zernio.ts', import.meta.url), 'utf8');
  ok(!/SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|eyJ/.test(f) && /nuevas\('SUPABASE_PUBLISHABLE_KEYS'\)/.test(f), 'zernio.ts lee solo la clave publicable nueva, nunca las heredadas');
}

// ---- 1. La orden, sin red ------------------------------------------------------------------------------------------------
// Un hijo con `fetch` falso (apunta lo que se pide y contesta como la API) y, por si el falso no entrara, proyectos y tokens
// inventados en el entorno: nada sale de este Mac. Devuelve la salida, el código y lo apuntado.
const FREF = { real: 'prueba' + '0'.repeat(10) + 'real', pruebas: 'prueba' + '0'.repeat(11) + 'pru' };
function ordenSinRed(args, env, falla = null) {
  const stub = `
    import { writeSync } from 'node:fs';
    const reg = [], FALLA = ${JSON.stringify(falla)};
    globalThis.fetch = async (url, o = {}) => {
      url = String(url);
      if (!/^https:\\/\\/(api\\.supabase\\.com\\/v1\\/projects\\/(${FREF.real}|${FREF.pruebas})\\/|(${FREF.real}|${FREF.pruebas})\\.supabase\\.co\\/)/.test(url)) {
        reg.push({ fuera: url.slice(0, 60) }); throw new Error('fuera de lo inventado');
      }
      const e = { url, metodo: o.method || 'GET' };
      if (o.body instanceof FormData) e.meta = JSON.parse(o.body.get('metadata'));
      else if (typeof o.body === 'string') { try { e.cuerpo = JSON.parse(o.body); } catch { e.cuerpo = o.body; } }
      reg.push(e);
      if (/\\/secrets$/.test(url) && FALLA) return new Response(JSON.stringify({ message: FALLA }), { status: 400 });
      if (/\\/functions\\/v1\\/zernio$/.test(url)) return new Response('{"ok":false,"error":{"codigo":"sesion","http":401,"mensaje":"sin sesión"}}', { status: 200 });
      return new Response('{}', { status: 201 });
    };
    process.on('exit', () => writeSync(1, '\\n@@REG@@' + JSON.stringify(reg) + '\\n'));`;
  const entorno = { ...process.env, SUPABASE_REF: FREF.real, SUPABASE_PRUEBAS_REF: FREF.pruebas, SUPABASE_ACCESS_TOKEN: 'token-inventado-' + RUN,
    SUPABASE_REAL_TOKEN: 'token-inventado-' + RUN, SUPABASE_PUBLICA: 'sb_publishable_inventada', SUPABASE_PRUEBAS_PUBLICA: 'sb_publishable_inventada',
    ZERNIO_PRUEBAS_CLAVE: '', ...env };
  let out = '', codigo = 0;
  try { out = execFileSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(stub), WEB, 'zernio', ...args], { encoding: 'utf8', env: entorno, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); codigo = e.status || 1; }
  const m = out.match(/@@REG@@(.*)/);   // en un fallo, la salida de error va detrás
  return { out: out.replace(/\n?@@REG@@.*\n?/, '\n'), codigo, reg: m ? JSON.parse(m[1]) : null };
}

function pruebaOrdenSinRed() {
  console.log('La orden de tools/web.mjs, sin red');
  const CEN = 'zk-centinela-' + randomBytes(16).toString('hex');   // hace de ZERNIO_API_KEY de .env
  let o = ordenSinRed(['pruebas'], { ZERNIO_API_KEY: CEN });
  let sec = (o.reg || []).find(e => /\/secrets$/.test(e.url));
  let dep = (o.reg || []).filter(e => /functions\/deploy/.test(e.url)).map(e => `${e.meta.name}:${e.meta.verify_jwt}`);
  const vk = sec && Array.isArray(sec.cuerpo) && (sec.cuerpo.find(x => x.name === 'ZERNIO_API_KEY') || {}).value;
  const vb = sec && Array.isArray(sec.cuerpo) && (sec.cuerpo.find(x => x.name === 'ZERNIO_BASE') || {}).value;
  ok(o.codigo === 0 && sec && vk !== CEN && /^falsa-[0-9a-f]{32}$/.test(vk || ''), 'pruebas: pone una clave inventada nueva, nunca ZERNIO_API_KEY', o.out);
  ok(vb === `https://${FREF.pruebas}.supabase.co/functions/v1/zernio-falso`, 'pruebas: ZERNIO_BASE apunta al Zernio simulado de ese proyecto', vb);
  const vl = sec && Array.isArray(sec.cuerpo) && (sec.cuerpo.find(x => x.name === 'ZERNIO_CORS_LOCAL') || {}).value;
  ok(vl === '1', 'pruebas: ZERNIO_CORS_LOCAL 1 (una copia en 127.0.0.1 o localhost puede llamarla)', vl);
  ok(dep.join() === 'zernio-falso:false,zernio:true', 'pruebas: despliega el simulado (sin JWT) y la función (con JWT), después de los secretos', dep.join());
  ok(!o.out.includes(vk || '@@') && !o.out.includes(CEN) && /"ZERNIO_BASE"/.test(o.out), 'y no enseña la clave');
  o = ordenSinRed(['pruebas'], { ZERNIO_PRUEBAS_CLAVE: CZ });
  sec = (o.reg || []).find(e => /\/secrets$/.test(e.url));
  ok(o.codigo === 0 && sec && sec.cuerpo.find(x => x.name === 'ZERNIO_API_KEY').value === CZ && !o.out.includes(CZ), 'pruebas: con ZERNIO_PRUEBAS_CLAVE inventada, pone esa (sin enseñarla)', o.out);
  const parece = 'sk_live_' + randomBytes(16).toString('hex');
  o = ordenSinRed(['pruebas'], { ZERNIO_PRUEBAS_CLAVE: parece });
  ok(o.codigo !== 0 && /inventada/.test(o.out) && o.reg && o.reg.length === 0 && !o.out.includes(parece), 'pruebas: una ZERNIO_PRUEBAS_CLAVE que no es «falsa-…» se rechaza sin pedir nada', o.out);
  o = ordenSinRed(['pruebas'], { SUPABASE_PRUEBAS_REF: FREF.real });
  ok(o.codigo !== 0 && /real/.test(o.out) && o.reg && o.reg.length === 0, 'pruebas: si el proyecto de pruebas es el real, no despliega el simulado ni pide nada', o.out);
  o = ordenSinRed(['real'], { ZERNIO_API_KEY: CEN });
  ok(o.codigo !== 0 && /--si/.test(o.out) && o.reg && o.reg.length === 0, 'real sin --si: no hace nada', o.out);
  o = ordenSinRed(['real', '--si'], { ZERNIO_API_KEY: CEN });
  sec = (o.reg || []).find(e => /\/secrets$/.test(e.url));
  dep = (o.reg || []).filter(e => /functions\/deploy/.test(e.url)).map(e => `${e.meta.name}:${e.meta.verify_jwt}`);
  ok(o.codigo === 0 && sec && igual(sec.cuerpo, [{ name: 'ZERNIO_API_KEY', value: CEN }, { name: 'ZERNIO_BASE', value: 'https://zernio.com/api/v1' }, { name: 'ZERNIO_CORS_LOCAL', value: '0' }]) && sec.url.includes(FREF.real),
    'real con --si: la clave de ZERNIO_API_KEY, la dirección real de Zernio y sin CORS para 127.0.0.1 ni localhost', o.out);
  ok(dep.join() === 'zernio:true', 'real: solo la función, nunca el simulado', dep.join());
  ok(!o.out.includes(CEN), 'real: no enseña la clave');
  o = ordenSinRed(['real', '--si'], { ZERNIO_API_KEY: 'falsa-' + randomBytes(16).toString('hex') });
  ok(o.codigo !== 0 && /inventada/.test(o.out) && o.reg && o.reg.length === 0, 'real: una clave inventada de pruebas no va al real', o.out);
  o = ordenSinRed(['real', '--si'], { ZERNIO_API_KEY: CEN, SUPABASE_REF: FREF.pruebas });
  ok(o.codigo !== 0 && /pruebas/.test(o.out) && o.reg && o.reg.length === 0 && !o.out.includes(CEN), 'real: si el proyecto real es el de pruebas, la clave no va ahí y no pide nada', o.out);
  o = ordenSinRed(['real'], {});
  ok(o.codigo !== 0 && o.reg && o.reg.length === 0, 'real sin --si, sin clave: tampoco');
  o = ordenSinRed(['real', '--si'], { ZERNIO_API_KEY: CEN }, 'la API repite la clave ' + CEN + ' en su error');
  ok(o.codigo !== 0 && /secretos no entraron/.test(o.out) && !o.out.includes(CEN) && o.out.includes('[clave]'), 'si la API falla repitiendo la clave, el error sale tapado', o.out);
  o = ordenSinRed(['pruebas'], { ZERNIO_PRUEBAS_CLAVE: CZ }, 'la API repite la clave ' + CZ + ' en su error');
  ok(o.codigo !== 0 && !o.out.includes(CZ) && o.out.includes('[clave]'), 'también la inventada', o.out);
}

// ---- Proyecto de pruebas ---------------------------------------------------------------------------------------------------
async function usuario(correo) {
  const u = await usuarioPorCorreo(P, correo);
  if (u) {
    const r = await pedir(`${P.url}/auth/v1/admin/users/${u.id}`, { method: 'PUT', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { password: CLAVE } });
    if (!r.ok) throw new Fallo('no se pudo preparar ' + correo + ': ' + r.text);
    return u.id;
  }
  const r = await pedir(`${P.url}/auth/v1/admin/users`, { method: 'POST', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { email: correo, password: CLAVE, email_confirm: true } });
  if (!r.ok) throw new Fallo('no se pudo crear ' + correo + ': ' + r.text);
  return r.json.id;
}
async function entrar(correo) {
  const r = await pedir(`${P.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { ...cab(P.publica), 'Content-Type': 'application/json' }, body: { email: correo, password: CLAVE }, dejar: ['access_token'] });
  if (!r.ok) throw new Fallo('no se pudo entrar como ' + correo + ': ' + r.text);
  return r.json.access_token;
}
const servicio = (ruta, o = {}) => rest(P, ruta, { ...o, apikey: S });

// Lo que había antes (solo nombres: nunca valores de secretos) y la limpieza.
let ANTES = null;
async function nombres() {
  const f = await gestion(`projects/${P.ref}/functions`), s = await gestion(`projects/${P.ref}/secrets`);
  if (!f.ok || !Array.isArray(f.json) || !s.ok || !Array.isArray(s.json)) throw new Fallo(`no se pudo leer funciones y secretos de pruebas (${f.status}, ${s.status})`);
  return { funciones: f.json.map(x => x.slug).filter(x => SLUGS.includes(x)), secretos: s.json.map(x => x.name).filter(x => SECRETOS.includes(x)) };
}
async function limpiarUsuarios() {
  await servicio(`clientes?id=eq.${CLI.id}`, { method: 'DELETE' });
  await servicio(`clientes_borrados?id=eq.${CLI.id}`, { method: 'DELETE' });   // la reserva del id inventado
  for (const c of Object.values(CORREO)) {
    const u = await usuarioPorCorreo(P, c).catch(() => null);
    if (u) { await servicio(`duenos?user_id=eq.${u.id}`, { method: 'DELETE' }); await pedir(`${P.url}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: cab(S) }); }
  }
}
async function quitarLoNuevo() {
  if (!ANTES) return;
  const ahora = await nombres();   // solo los que hay: borrar un secreto que no existe hace fallar el borrado entero
  const sobra = SECRETOS.filter(x => !ANTES.secretos.includes(x) && ahora.secretos.includes(x));
  if (sobra.length) { const r = await gestion(`projects/${P.ref}/secrets`, { method: 'DELETE', body: sobra }); if (!r.ok) throw new Fallo(`no se pudieron quitar los secretos (${r.status}): ${r.text}`); }
  for (const slug of SLUGS.filter(x => !ANTES.funciones.includes(x))) {
    const r = await gestion(`projects/${P.ref}/functions/${slug}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) throw new Fallo(`no se pudo quitar la función ${slug} (${r.status}): ${r.text}`);
  }
}
let cerrando = null;
const cerrar = () => cerrando || (cerrando = (async () => {
  try { await limpiarUsuarios(); } catch (e) { fallos++; console.error('limpieza: ' + ver(e.message)); }
  try { await quitarLoNuevo(); } catch (e) { fallos++; console.error('funciones y secretos: ' + ver(e.message)); }
  if (ANTES) {
    try {
      const d = await nombres();
      ok(igual(d.funciones.sort(), [...ANTES.funciones].sort()) && igual(d.secretos.sort(), [...ANTES.secretos].sort()), 'al terminar, las funciones y los secretos de Zernio de pruebas, como estaban', JSON.stringify(d));
    } catch (e) { fallos++; console.error(ver(e.message)); }
  }
})());
process.on('SIGINT', () => { console.log('\nCortado: limpiando el proyecto de pruebas…'); fallos++; cerrar().finally(() => process.exit(130)); });

// Una llamada a la función: el texto tal cual (para buscar la clave, sin pasar por ningún tapado) y su JSON.
async function llamar(tk, cuerpo, o = {}) {
  const h = { ...(o.sinApikey ? {} : { apikey: P.publica }), ...(tk ? { Authorization: 'Bearer ' + tk } : {}), 'Content-Type': 'application/json', ...(o.origen ? { Origin: o.origen } : {}) };
  let r;
  try { r = await fetch(FN, { method: o.metodo || 'POST', headers: h, body: (o.metodo || 'POST') === 'POST' ? (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) : undefined, signal: AbortSignal.timeout(90000) }); }
  catch (e) { return { status: 0, text: 'sin conexión o 90 s sin respuesta: ' + e.message, json: null, acao: null }; }
  const text = await r.text().catch(e => 'respuesta cortada: ' + e.message);
  let json = null; try { json = JSON.parse(text); } catch (e) { /* no es JSON */ }
  todas.push(text); if (o.ajeno) ajeno.push(text);
  return { status: r.status, text, json, acao: r.headers.get('access-control-allow-origin') };
}
const bien = r => r.status === 200 && r.json && r.json.ok === true;
const rech = (r, codigo, http) => r.status === 200 && r.json && r.json.ok === false && r.json.error && r.json.error.codigo === codigo && (http === undefined || r.json.error.http === http);
const falso = r => (r.json && r.json.post && r.json.post.metadata && r.json.post.metadata.falso) || {};

function web(args, env = {}) {   // la orden de verdad, contra pruebas; su salida no se imprime sin tapar
  try { return { ok: true, out: execFileSync(process.execPath, [WEB, 'zernio', ...args], { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: String(e.stdout || '') + String(e.stderr || e.message) }; }
}

async function main() {
  pruebaOrdenSinRed();

  console.log(`\nLa orden contra el proyecto de pruebas ${P.ref}`);
  ANTES = await nombres();
  await limpiarUsuarios();
  const w = web(['pruebas'], { ZERNIO_PRUEBAS_CLAVE: CZ });
  todas.push(w.out);
  ok(w.ok && /zernio desplegada/.test(w.out) && /zernio-falso desplegada/.test(w.out) && /"sin_sesion": "rechazada"/.test(w.out), 'tools/web.mjs zernio pruebas despliega la función y el simulado, y la función rechaza sin sesión', w.out);
  ok(!fugaDe(w.out), 'y no enseña la clave inventada');
  if (!w.ok) throw new Fallo('sin la función no hay nada que probar');
  // El simulado con la clave inventada de esta pasada (no otra): así se sabe que el secreto de pruebas es esa y que ya está puesto.
  let r = null;
  for (let i = 0; i < 45; i++) {
    if (i) await espera(2000);
    r = await fetch(`${FALSO}/posts?page=1`, { headers: { Authorization: 'Bearer ' + CZ } }).catch(() => null);
    if (r && r.status === 200) break;
  }
  ok(r && r.status === 200, 'el simulado acepta la clave inventada de esta pasada: es el secreto de pruebas', r && String(r.status));
  const mala = await fetch(`${FALSO}/posts?page=1`, { headers: { Authorization: 'Bearer falsa-' + 'f'.repeat(32) } });
  ok(mala.status === 401, 'y rechaza otra (401, como Zernio)', String(mala.status));

  const uk = await usuario(CORREO.k), ua = await usuario(CORREO.a); await usuario(CORREO.n);
  for (const [t, filas] of [['clientes', [CLI]], ['miembros', [{ user_id: ua, cliente_id: CLI.id, nombre: 'Ana Prueba' }]], ['duenos?on_conflict=user_id', [{ user_id: uk }]]]) {
    const s = await servicio(t, { method: 'POST', body: filas, prefer: 'resolution=merge-duplicates' });
    if (!s.ok) throw new Fallo(`no se pudo sembrar ${t}: ${s.status} ${s.text}`);
  }
  const kk = (await conCodigo(P, await entrar(CORREO.k))).access_token, ka = await entrar(CORREO.a), kn = await entrar(CORREO.n);
  const K = (c, o) => llamar(kk, c, o);
  // La función recién desplegada puede tardar en leer los secretos nuevos: se espera a que Kevin pida una URL.
  for (let i = 0; i < 30; i++) { r = await K({ orden: 'presign' }); if (bien(r)) break; await espera(2000); }

  console.log('Kevin: presign');
  ok(bien(r) && r.json.urls.length === 1, 'presign sin n: una URL', r.text);
  r = await K({ orden: 'presign', n: 2 });
  const us = (r.json && r.json.urls) || [];
  ok(bien(r) && us.length === 2 && us.every(u => typeof u.uploadUrl === 'string' && typeof u.publicUrl === 'string' && u.expiresIn === 3600), 'presign 2: dos URL de subida, cada una con su URL pública y caducidad', r.text);
  ok(/\/subir\/mesa-\d+-1\.jpg\?tipo=image%2Fjpeg$/.test(us[0] && us[0].uploadUrl) && /mesa-\d+-2\.jpg/.test(us[1] && us[1].uploadUrl), 'Zernio recibió un nombre mesa-<hora>-<n>.jpg y el tipo image/jpeg, como tools/zernio.mjs', us[0] && us[0].uploadUrl);
  for (const v of [0, 21, 1.5, '2', -1]) { r = await K({ orden: 'presign', n: v }); ok(rech(r, 'forma', 400), `presign ${JSON.stringify(v)}: rechazo «forma» (de 1 a 20)`, r.text); }

  console.log('Kevin: schedule');
  const post = { content: 'Prueba del lote 6 ' + RUN, scheduledFor: enMin(60), timezone: 'Europe/Madrid',
    mediaItems: [{ url: 'https://falso.invalid/media/a.jpg', type: 'image' }],
    platforms: [{ platform: 'instagram', accountId: CUENTA, platformSpecificData: { locationId: '123456', userTags: [{ username: 'prueba.uno', x: 0.5, y: 0.5 }], collaborators: ['prueba.dos'] } }] };
  r = await K({ orden: 'schedule', post });
  let f = falso(r);
  ok(bien(r) && /^[0-9a-f]{24}$/.test(r.json.post.id) && r.json.post.status === 'scheduled' && r.json.post.scheduledFor === post.scheduledFor, 'schedule con margen: crea el post y devuelve su id, estado y hora', r.text);
  const pl = bien(r) && r.json.post.platforms[0];
  ok(pl && pl.accountId === CUENTA && pl.locationId === '123456' && igual(pl.userTags, ['prueba.uno']) && igual(pl.collaborators, ['prueba.dos']) && igual(r.json.post.media, ['https://falso.invalid/media/a.jpg']),
    'lo devuelve resumido como tools/zernio.mjs (cuenta, ubicación, etiquetas, colaboradores, fotos)', r.text);
  ok(f.metodo === 'POST' && f.ruta === '/posts' && f.clave === true, 'Zernio recibió POST /posts con la clave inventada', JSON.stringify(f));
  ok(igual(f.cuerpo, post) && !llevaPublicarYa(f.cuerpo), 'y el post tal cual, sin publishNow ni nada que publique ya', JSON.stringify(f.cuerpo));
  ok(f.idempotencia === sha(JSON.stringify(post)), 'con la clave de idempotencia de tools/zernio.mjs (sha256 del post)', String(f.idempotencia));
  const conHora = { ...post, scheduledFor: new Date(Date.now() + 90 * 60000 + 3600000).toISOString().replace('Z', '+01:00'), platforms: [{ ...post.platforms[0], scheduledFor: enMin(120) }] };
  r = await K({ orden: 'schedule', post: conHora });
  ok(bien(r) && igual(falso(r).cuerpo, conHora), 'con la diferencia horaria (+01:00) y una hora por plataforma, también', r.text);
  r = await K({ orden: 'schedule', post: { content: 'borrador ' + RUN, isDraft: true, platforms: post.platforms } });
  ok(bien(r) && falso(r).cuerpo.isDraft === true && !('scheduledFor' in falso(r).cuerpo), 'un borrador (isDraft: true) sin fecha, como tools/zernio.mjs', r.text);

  console.log('Kevin: lo que se rechaza al programar (y no llega a Zernio)');
  const casos = [
    ['margen', 'a 5 minutos', { scheduledFor: enMin(5) }],
    ['margen', 'en el pasado', { scheduledFor: enMin(-60) }],
    ['margen', 'una plataforma a 5 minutos', { platforms: [{ ...post.platforms[0], scheduledFor: enMin(5) }] }],
    ['margen', 'un borrador con una fecha pasada', { isDraft: true, scheduledFor: enMin(-5) }],
    ['forma', 'sin Z ni diferencia horaria', { scheduledFor: '2026-12-01T10:00:00' }],
    ['forma', 'un texto que JavaScript lee como fecha', { scheduledFor: 'mañana a las 10Z' }],
    ['forma', 'un 30 de febrero', { scheduledFor: (new Date().getUTCFullYear() + 1) + '-02-30T10:00:00Z' }],
    ['forma', 'las 24:00', { scheduledFor: (new Date().getUTCFullYear() + 1) + '-01-10T24:00:00Z' }],
    ['forma', 'una fecha sin la T', { scheduledFor: (new Date().getUTCFullYear() + 1) + '-01-10 10:00:00Z' }],
    ['forma', 'scheduledFor null', { scheduledFor: null }],
    ['forma', 'sin scheduledFor (ni isDraft)', { scheduledFor: undefined }],
    ['forma', 'sin platforms', { platforms: [] }],
    ['forma', 'platforms que no es una lista', { platforms: { platform: 'instagram' } }],
    ['forma', 'isDraft como texto', { isDraft: 'false' }],
    ['publicar_ya', 'publishNow: true', { publishNow: true }],
    ['publicar_ya', 'publishNow: false (no se admite en ningún caso)', { publishNow: false }],
    ['publicar_ya', 'publishNow en una plataforma', { platforms: [{ ...post.platforms[0], publishNow: true }] }],
    ['publicar_ya', 'publish_now dentro de platformSpecificData', { platforms: [{ ...post.platforms[0], platformSpecificData: { publish_now: 1 } }] }],
    ['publicar_ya', 'postNow', { postNow: true }],
    ['publicar_ya', 'sendImmediately', { sendImmediately: true }],
    ['publicar_ya', 'publishNow con una fecha con margen', { publishNow: true, scheduledFor: enMin(120) }],
    ['forma', 'un campo que no está en la lista blanca (status)', { status: 'published' }],
    ['forma', 'una hora con otro nombre dentro de platformSpecificData', { platforms: [{ ...post.platforms[0], platformSpecificData: { scheduledAt: enMin(120) } }] }],
    ['forma', 'un campo desconocido en una plataforma', { platforms: [{ ...post.platforms[0], queue: true }] }],
    ['forma', 'otro tipo de contenido que historia', { platforms: [{ ...post.platforms[0], platformSpecificData: { contentType: 'reels' } }] }],
    ['forma', 'metadata con otra clave', { metadata: { cola: 'x' } }],
    ['forma', 'metadata con un objeto dentro', { metadata: { mesaSlot: { a: 1 } } }],
    ['forma', 'una foto por http', { mediaItems: [{ type: 'image', url: 'http://falso.invalid/a.jpg' }] }],
    ['forma', 'una foto con un campo de más', { mediaItems: [{ type: 'image', url: 'https://falso.invalid/a.jpg', publish: 'now' }] }],
    ['forma', 'una etiqueta fuera de la foto', { platforms: [{ ...post.platforms[0], platformSpecificData: { userTags: [{ username: 'prueba.uno', x: 2, y: 0.5 }] } }] }],
  ];
  for (const [codigo, txt, cambio] of casos) {
    const b = { ...post, content: 'rechazo ' + RUN, ...cambio };
    for (const k of Object.keys(cambio)) if (cambio[k] === undefined) delete b[k];
    r = await K({ orden: 'schedule', post: b });
    ok(rech(r, codigo, 400) && !r.json.post && typeof r.json.error.mensaje === 'string', `${txt}: rechazo «${codigo}»`, r.text);
  }
  r = await K({ orden: 'schedule', post, publishNow: true });
  ok(rech(r, 'publicar_ya', 400), 'publishNow fuera del post (en el pedido): rechazo «publicar_ya»', r.text);
  const historia = { mediaItems: [{ type: 'image', url: 'https://falso.invalid/media/h.jpg' }], scheduledFor: enMin(90), timezone: 'Europe/Madrid',
    platforms: [{ platform: 'instagram', accountId: CUENTA, platformSpecificData: { contentType: 'story' } }], metadata: { mesaStory: 'h-' + RUN, mesaClient: CLI.id } };
  r = await K({ orden: 'schedule', post: historia });
  ok(bien(r) && igual(falso(r).cuerpo, historia), 'una historia como la manda diseno-historias (contentType story, sin content, con metadata): pasa tal cual', r.text);
  const conMarca = { ...post, metadata: { mesaSlot: 's-' + RUN, mesaClient: CLI.id } };
  r = await K({ orden: 'schedule', post: conMarca });
  ok(bien(r) && igual(falso(r).cuerpo, conMarca), 'un post con metadata.mesaSlot, como lo manda feed-preparation: pasa tal cual', r.text);
  r = await K({ orden: 'schedule', post: [post] });
  ok(rech(r, 'forma', 400), 'un post que no es un objeto: rechazo «forma»', r.text);

  console.log('Kevin: posts');
  r = await K({ orden: 'posts', filtros: { account: CUENTA, status: 'scheduled', platform: 'instagram', from: '2026-11-01', to: '2026-12-31' } });
  f = bien(r) && r.json.posts[0] && r.json.posts[0].metadata && r.json.posts[0].metadata.falso || {};
  ok(bien(r) && r.json.posts.length === 2 && r.json.posts.map(p => p.id.slice(-1)).join() === '1,2', 'posts junta todas las páginas (dos en el simulado)', r.text);
  ok(f.metodo === 'GET' && f.ruta === '/posts' && f.clave === true && igual(f.consulta, { page: '1', limit: '100', accountId: CUENTA, status: 'scheduled', platform: 'instagram', dateFrom: '2026-11-01', dateTo: '2026-12-31' }),
    'Zernio recibió GET /posts con los filtros con los nombres de tools/zernio.mjs, de 100 en 100', JSON.stringify(f));
  r = await K({ orden: 'posts' });
  ok(bien(r) && r.json.posts.length === 2, 'posts sin filtros, también', r.text);
  for (const [txt, filtros] of [['una fecha mal escrita', { from: 'ayer' }], ['un filtro desconocido', { desconocido: 'x' }], ['un nombre del prototipo', { constructor: 'x' }],
    ['una cuenta con barras', { account: '../x' }], ['filtros que no son un objeto', ['x']]]) {
    r = await K({ orden: 'posts', filtros }); ok(rech(r, 'forma', 400), `posts con ${txt}: rechazo «forma»`, r.text);
  }

  console.log('Kevin: update');
  const patch = { scheduledFor: enMin(150), content: 'cambio ' + RUN };
  r = await K({ orden: 'update', id: OTRO, patch });
  f = falso(r);
  ok(bien(r) && r.json.post.id === OTRO && r.json.post.scheduledFor === patch.scheduledFor, 'update con margen: devuelve el post cambiado', r.text);
  ok(f.metodo === 'PUT' && f.ruta === '/posts/' + OTRO && f.clave === true && igual(f.cuerpo, patch) && !llevaPublicarYa(f.cuerpo), 'Zernio recibió PUT /posts/<id> con el cambio tal cual y la clave', JSON.stringify(f));
  r = await K({ orden: 'update', id: OTRO, patch: { content: 'solo el texto ' + RUN } });
  ok(bien(r) && igual(falso(r).cuerpo, { content: 'solo el texto ' + RUN }), 'update sin fecha (solo el texto), como tools/zernio.mjs', r.text);
  for (const [codigo, txt, pedido] of [
    ['margen', 'una fecha a 5 minutos', { id: OTRO, patch: { scheduledFor: enMin(5) } }],
    ['margen', 'una plataforma en el pasado', { id: OTRO, patch: { platforms: [{ platform: 'instagram', accountId: CUENTA, scheduledFor: enMin(-1) }] } }],
    ['publicar_ya', 'publishNow', { id: OTRO, patch: { publishNow: true } }],
    ['publicar_ya', 'publishNow: false', { id: OTRO, patch: { publishNow: false, content: 'x' } }],
    ['forma', 'quitar el borrador sin fecha (isDraft: false)', { id: OTRO, patch: { isDraft: false } }],
    ['forma', 'un id con «..»', { id: '..', patch: { content: 'x' } }],
    ['forma', 'un id con barras', { id: OTRO + '/retry', patch: { content: 'x' } }],
    ['forma', 'sin id', { patch: { content: 'x' } }],
    ['forma', 'sin patch', { id: OTRO }],
    ['forma', 'un campo que no está en la lista blanca (status)', { id: OTRO, patch: { status: 'scheduled' } }],
  ]) { r = await K({ orden: 'update', ...pedido }); ok(rech(r, codigo, 400), `update con ${txt}: rechazo «${codigo}»`, r.text); }
  // Antes de cambiar, el post: solo uno programado o en borrador, y con margen si se queda con su hora.
  for (const id of ['publicado1', 'fallido1']) {
    r = await K({ orden: 'update', id, patch: { content: 'x ' + RUN } });
    ok(rech(r, 'estado', 409) && !r.json.post, `update de un post ${id.replace(/1$/, '')} (no programado ni borrador): rechazo «estado»`, r.text);
  }
  r = await K({ orden: 'update', id: 'pronto1', patch: { content: 'x ' + RUN } });
  ok(rech(r, 'margen', 400), 'update sin fecha de un post que sale en 5 minutos: rechazo «margen»', r.text);
  r = await K({ orden: 'update', id: 'pronto1', patch: { content: 'x ' + RUN, scheduledFor: enMin(60) } });
  ok(bien(r) && falso(r).metodo === 'PUT', 'el mismo con una hora nueva con margen: pasa', r.text);
  r = await K({ orden: 'update', id: 'pronto1', patch: { isDraft: true } });
  ok(bien(r) && igual(falso(r).cuerpo, { isDraft: true }), 'o pasándolo a borrador: pasa', r.text);
  r = await K({ orden: 'update', id: 'borrador1', patch: { content: 'x ' + RUN } });
  ok(bien(r) && falso(r).metodo === 'PUT', 'update del texto de un borrador sin hora: pasa (sigue en borrador)', r.text);

  console.log('Kevin: errores de Zernio y la clave');
  r = await K({ orden: 'schedule', post: { ...post, content: 'duplicado ' + RUN } });
  ok(rech(r, 'zernio', 502) && r.json.error.zernio === 409 && r.json.error.existingPostId === 'f'.repeat(24) && /^Zernio 409: /.test(r.json.error.mensaje),
    'un error de Zernio llega como «zernio» con su código y existingPostId', r.text);
  r = await K({ orden: 'schedule', post: { ...post, content: 'repite-clave ' + RUN } });
  ok(rech(r, 'zernio', 502) && r.json.error.zernio === 400 && r.json.error.mensaje.includes('[clave]'), 'un error de Zernio que repite la clave llega tapado', r.text);
  ok(!fugaDe(r.text), 'tapada antes de recortar: ni entera ni cortada a mitad (lección 121)');
  r = await K({ orden: 'schedule', post: { ...post, content: 'eco-clave ' + RUN } });
  ok(bien(r) && falso(r).auth === 'Bearer [clave]' && !fugaDe(r.text), 'una respuesta de Zernio que trae la clave (aquí, su eco) llega tapada', r.text);
  r = await K({ orden: 'schedule', post: { ...post, content: 'clave-escapada ' + RUN } });
  ok(rech(r, 'zernio', 502) && r.json.error.mensaje.includes('[clave]') && !fugaDe(r.text), 'un error con la clave escrita con escapes (\\uXXXX), donde el recorte la partiría: tapada, ni a trozos', r.text);
  r = await K({ orden: 'schedule', post: { ...post, content: 'redirige ' + RUN } });
  ok(rech(r, 'zernio', 502) && !r.json.post, 'una redirección de Zernio no se sigue (la clave no va a otra dirección): rechazo «zernio»', r.text);
  r = await K({ orden: 'posts', filtros: { account: 'muchas' } });
  ok(rech(r, 'tope', 413), 'posts con más de 50 páginas: rechazo «tope»', r.text);

  console.log('Kevin: pedidos mal hechos');
  for (const [codigo, txt, cuerpo] of [['cuerpo', 'un cuerpo que no es JSON', 'hola'], ['cuerpo', 'una lista', '[1]'], ['orden', 'sin orden', {}], ['orden', 'una orden desconocida', { orden: 'delete', id: OTRO }],
    ['orden', '«__proto__»', { orden: '__proto__' }], ['orden', '«accounts» (no está)', { orden: 'accounts' }], ['forma', 'un campo de más', { orden: 'presign', n: 1, extra: 1 }],
    ['cuerpo', 'más de 200 KB', { orden: 'schedule', post: { ...post, content: 'x'.repeat(210000) } }]]) {
    r = await K(cuerpo); ok(rech(r, codigo), `${txt}: rechazo «${codigo}»`, r.text);
  }
  r = await K(null, { metodo: 'GET' });
  ok(rech(r, 'metodo', 405), 'GET: rechazo «metodo»', r.text);

  console.log('CORS');
  const pre = async o => (await fetch(FN, { method: 'OPTIONS', headers: { Origin: o, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, apikey, content-type' } })).headers.get('access-control-allow-origin');
  for (const o of ['https://mesa.uribevisuals.studio', 'http://127.0.0.1:9999', 'http://localhost:8080'])
    ok((await pre(o)) === o, `deja llamarla desde ${o}${/^http:/.test(o) ? ' (en pruebas)' : ''}`);
  for (const o of ['https://kevinuribeph-art.github.io', 'https://clientes.uribevisuals.studio', 'https://malo.example', 'http://127.0.0.1.malo.example:80', 'https://mesa.uribevisuals.studio.malo.example'])
    ok((await pre(o)) === null, `no desde ${o}`);
  r = await K({ orden: 'presign' }, { origen: 'https://mesa.uribevisuals.studio' });
  ok(bien(r) && r.acao === 'https://mesa.uribevisuals.studio', 'y la respuesta de verdad lleva su permiso', String(r.acao));

  console.log('Los demás: un rechazo sin datos');
  const SIN_PERMISO = { ok: false, error: { codigo: 'permiso', http: 403, mensaje: 'sin permiso' } };
  const SIN_SESION = { ok: false, error: { codigo: 'sesion', http: 401, mensaje: 'sin sesión' } };
  const pedidos = [{ orden: 'presign', n: 2 }, { orden: 'schedule', post }, { orden: 'posts' }, { orden: 'update', id: OTRO, patch },
    { orden: 'schedule', post: { ...post, publishNow: true } }, { orden: 'nada' }, 'no es JSON'];
  for (const [quien, tk, espera] of [['la clienta del portal', ka, SIN_PERMISO], ['alguien sin cliente', kn, SIN_PERMISO], ['la clave pública sin sesión', null, SIN_SESION]]) {
    const rs = [];
    for (const p of pedidos) rs.push(await llamar(tk, p, { ajeno: true }));
    ok(rs.every(x => x.status === 200 && igual(x.json, espera)), `${quien}: ${espera.error.codigo} en las cuatro órdenes, con publishNow, una orden mala o sin JSON, y nada más`, rs.filter(x => !(x.status === 200 && igual(x.json, espera))).map(x => x.status + ' ' + x.text.slice(0, 120)).join(' | '));
  }
  r = await llamar(null, { orden: 'presign' }, { sinApikey: true, ajeno: true });
  ok(r.status === 401 && !(r.json && r.json.ok), 'sin nada: la pasarela la para (401)', r.text);
  // Un token que no vale lo para la pasarela (401) o, si pasara, la función (`sesion`): nunca llega a Zernio.
  const parado = x => (x.status === 401 && !(x.json && x.json.ok)) || (x.status === 200 && igual(x.json, SIN_SESION));
  r = await llamar('no-es-un-token', { orden: 'presign' }, { ajeno: true });
  ok(parado(r), 'con un token que no lo es: sin sesión', r.text);
  r = await llamar(kk.slice(0, -4) + (kk.endsWith('AAAA') ? 'BBBB' : 'AAAA'), { orden: 'presign' }, { ajeno: true });
  ok(parado(r), 'con el token de Kevin alterado: sin sesión', r.text);
  const juntos = ajeno.join('\n');
  for (const v of ['falso.invalid', 'mesa-', CUENTA, OTRO, 'metadata', '[clave]', RUN, 'Zernio'])
    ok(!juntos.includes(v), `en lo que reciben los demás, nada de «${v.length > 20 ? v.slice(0, 8) + '…' : v}»`);

  console.log('La clave');
  ok(todas.length > 70 && !todas.some(fugaDe), `ninguna de las ${todas.length} respuestas lleva la clave inventada, ni entera ni a trozos`);
}

main().catch(e => { fallos++; console.error(ver(e instanceof Fallo ? e.message : (e.stack || e))); })
  .finally(async () => {
    await cerrar();
    console.log(fallos ? `\n${fallos} FALLO(S) de ${n}` : `\nTodo en orden: ${n} de ${n}`);
    process.exit(fallos ? 1 : 0);
  });
