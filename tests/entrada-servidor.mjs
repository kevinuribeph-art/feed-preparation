#!/usr/bin/env node
// Prueba de la entrada de la Mesa en el servidor (D-262). Node 18+, sin dependencias. Solo contra el proyecto de PRUEBAS, con
// usuarios inventados: un Kevin (dueño) y una clienta del portal. Llamadas directas al servidor, nunca desde la página:
//   · Con el interruptor `exigir_codigo` encendido, Kevin sin el código de su app (solo contraseña, `aal1`) no recibe nada de las
//     `mesa_*` (rechazo `verificacion`, sin quedar como «ajeno»), del almacén `mesa`, de `zernio` ni de lo suyo del portal; con
//     el código, sí. Un código de hace 29 días vale y uno de hace 31 no (reloj simulado: las claims de su sesión con la hora del
//     código movida, en una transacción que se deshace).
//   · El portal de la clienta no cambia (entra sin código). La clave pública sola no recibe nada.
//   · «¿Olvidaste tu contraseña?»: con solo el código del correo no se cambia; con el del correo y el de la app, sí, y la sesión
//     de otro ordenador se cierra. `web.mjs rescate` quita los factores y cierra todas sus sesiones. Apagar el interruptor (la
//     vuelta atrás) devuelve lo de antes.
// Al final, también si algo falla, deja el interruptor como estaba y borra sus usuarios, su cliente, su fila de dueño y su archivo.
//   node tests/entrada-servidor.mjs
// Necesita en .env: SUPABASE_ACCESS_TOKEN, SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA y SUPABASE_PRUEBAS_SECRETA, y aplicados
// en pruebas `esquema`, `mesa`, `entrada` y `zernio` de tools/web.mjs.
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { proyecto, rest, cab, pedir, gestion, tapar, clave, usuarioPorCorreo, Fallo } from '../tools/web.mjs';
import { conCodigo, verificar, claims, auth, admin } from './codigo-app.mjs';

if (process.argv.slice(2).length) { console.error('esta prueba solo corre contra el proyecto de pruebas, sin parámetros'); process.exit(1); }
const P = proyecto('pruebas');
if (!P.publica || !P.secreta) { console.error('faltan las claves pública y secreta del proyecto de pruebas en .env'); process.exit(1); }
if (clave('SUPABASE_REF') === P.ref) { console.error('el proyecto de pruebas es el real: esta prueba no corre ahí'); process.exit(1); }

const S = P.secreta, WEB = fileURLToPath(new URL('../tools/web.mjs', import.meta.url));
const RUN = randomBytes(4).toString('hex');
const CORREO = { k: 'kevin@entrada-pruebas.test', a: 'ana@entrada-pruebas.test' };
const CLAVE = 'Pr-' + randomBytes(16).toString('hex'), CLAVE2 = 'Pr-' + randomBytes(16).toString('hex');   // inventadas; no se imprimen
const CLI = { id: 'prueba-entrada-' + RUN, nombre: 'Cliente Prueba Entrada' };
const DISP = 'prueba-entrada-' + RUN;
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const RUTA = `pruebas/${createHash('sha256').update(JPG).update(RUN).digest('hex')}.jpg`;

let fallos = 0, n = 0, buenos = 0;
const ok = (c, txt, extra) => { n++; if (c) { buenos++; } if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + tapar(extra).slice(0, 240) : '')); } };
const bien = r => r.ok && r.json && r.json.ok === true;
const rech = (r, codigo) => r.ok && r.json && r.json.ok === false && r.json.error && r.json.error.codigo === codigo;
const servicio = (ruta, o = {}) => rest(P, ruta, { ...o, apikey: S });
const rpc = (tk, fn, args) => rest(P, 'rpc/' + fn, { method: 'POST', token: tk || undefined, body: args || {} });
const lista = tk => pedir(`${P.url}/storage/v1/object/list/mesa`, { method: 'POST', headers: { ...cab(P.publica, tk), 'Content-Type': 'application/json' }, body: { prefix: 'pruebas', limit: 1000, offset: 0 } });
const subir = (tk, ruta) => pedir(`${P.url}/storage/v1/object/mesa/${ruta}`, { method: 'POST', headers: { ...cab(P.publica, tk), 'Content-Type': 'image/jpeg' }, body: new Uint8Array(JPG) });
const zernio = (tk, cuerpo) => pedir(`${P.url}/functions/v1/zernio`, { method: 'POST', headers: { ...cab(P.publica, tk), 'Content-Type': 'application/json' }, body: cuerpo });
async function sql(q) {
  const r = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query: q } });
  if (!r.ok) throw new Fallo(`SQL de la prueba (${r.status}): ${r.text}`);
  return r.json || [];
}
const interruptor = async si => (await sql(`update public.ajustes_entrada set exigir_codigo = ${!!si} where id returning exigir_codigo;`))[0].exigir_codigo;
async function usuario(correo, pw) {
  const u = await usuarioPorCorreo(P, correo);
  if (u) { await admin(P, `users/${u.id}`, { method: 'DELETE' }); }
  const r = await admin(P, 'users', { method: 'POST', body: { email: correo, password: pw, email_confirm: true } });
  if (!r.ok) throw new Fallo('no se pudo crear ' + correo + ': ' + r.text);
  return r.json.id;
}
async function entrar(correo, pw) {
  const r = await auth(P, 'token?grant_type=password', { body: { email: correo, password: pw } });
  if (!r.ok) throw new Fallo('no se pudo entrar como ' + correo + ': ' + r.text);
  return r.json;
}
// La sesión del código por correo (lo que hace `pedirCodigo` + `verificarCodigo`), sin mandar correo: generate_link da el código.
async function porCorreo(correo) {
  const g = await admin(P, 'generate_link', { method: 'POST', body: { type: 'magiclink', email: correo } });
  const otp = g.json && (g.json.email_otp || (g.json.properties && g.json.properties.email_otp));
  if (!otp) throw new Fallo('generate_link sin código: ' + g.text);
  const v = await auth(P, 'verify', { body: { type: 'email', email: correo, token: otp } });
  if (!v.ok) throw new Fallo('verify del correo: ' + v.text);
  return v.json;
}
// Las mismas llamadas con las claims de una sesión real y la hora del código movida `dias` atrás (transacción que se deshace).
async function conReloj(base, dias) {
  const ahora = Math.floor(Date.now() / 1000);
  const c = { ...base, amr: base.amr.map(e => e.method === 'totp' ? { ...e, timestamp: ahora - Math.round(dias * 86400) } : e) };
  const q = `begin; select set_config('request.jwt.claims', $j$${JSON.stringify(c)}$j$, true); set local role authenticated;
    select public.es_dueno() as dueno, (public.mesa_yo() ->> 'valido')::boolean as valido,
      public.mesa_turno_ver('${DISP}') #>> '{error,codigo}' as rechazo,
      (select count(*) from storage.objects o where o.bucket_id = 'mesa' and o.name = '${RUTA}')::int as archivos,
      (select count(*) from public.clientes where id = '${CLI.id}')::int as clientes; rollback;`;
  const f = await sql(q);
  return f[f.length - 1] || f[0] || {};
}

let antes = null, uk = null, ua = null;
async function limpiar() {
  try { if (antes !== null) await interruptor(antes); } catch (e) { console.log('  (no se pudo devolver el interruptor: ' + tapar(e.message) + ')'); }
  await pedir(`${P.url}/storage/v1/object/mesa`, { method: 'DELETE', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { prefixes: [RUTA] } }).catch(() => {});
  await servicio(`clientes?id=eq.${CLI.id}`, { method: 'DELETE' }).catch(() => {});
  await servicio(`clientes_borrados?id=eq.${CLI.id}`, { method: 'DELETE' }).catch(() => {});
  for (const c of Object.values(CORREO)) {
    const u = await usuarioPorCorreo(P, c).catch(() => null);
    if (u) { await servicio(`duenos?user_id=eq.${u.id}`, { method: 'DELETE' }); await admin(P, `users/${u.id}`, { method: 'DELETE' }); }
  }
}

async function main() {
  console.log(`Entrada de la Mesa contra el proyecto de pruebas (${P.ref}), pasada ${RUN}`);
  const ex = await rpc(null, 'mesa_yo');
  if (ex.status === 404) throw new Fallo('falta public.mesa_yo: aplica antes `node tools/web.mjs esquema pruebas` y `mesa pruebas`');
  antes = (await sql('select exigir_codigo from public.ajustes_entrada where id;'))[0].exigir_codigo;
  const cfg = await fetch(`https://api.supabase.com/v1/projects/${P.ref}/config/auth`, { headers: { Authorization: 'Bearer ' + clave('SUPABASE_ACCESS_TOKEN') } }).then(r => r.json());
  ok(cfg.mfa_totp_enroll_enabled === true && cfg.mfa_totp_verify_enabled === true, 'configuración: el código de app (TOTP) activado para dar de alta y verificar');
  ok(cfg.password_min_length === 20, 'configuración: contraseñas de 20 como mínimo', String(cfg.password_min_length));

  uk = await usuario(CORREO.k, CLAVE); ua = await usuario(CORREO.a, CLAVE);
  let r = await servicio('duenos', { method: 'POST', body: { user_id: uk } }); if (!r.ok) throw new Fallo('dueño: ' + r.text);
  r = await servicio('clientes', { method: 'POST', body: CLI }); if (!r.ok) throw new Fallo('cliente: ' + r.text);
  r = await servicio('miembros', { method: 'POST', body: { user_id: ua, cliente_id: CLI.id, nombre: 'Ana Prueba' } }); if (!r.ok) throw new Fallo('miembro: ' + r.text);

  console.log('— interruptor apagado (lo de antes)');
  await interruptor(false);
  const k1 = await entrar(CORREO.k, CLAVE);
  ok(claims(k1.access_token).aal === 'aal1', 'Kevin con contraseña: sesión aal1');
  r = await rpc(k1.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(bien(r) && typeof r.json.total === 'number', 'apagado: Kevin sin código ve el turno, con `total`', r.text);
  r = await rpc(k1.access_token, 'mesa_yo'); ok(r.ok && r.json.dueno === true && r.json.valido === true && r.json.exige === false && r.json.codigo === false, 'apagado: mesa_yo dice dueño, válido, sin exigir y sin código', r.text);

  console.log('— interruptor encendido, Kevin sin código');
  ok(await interruptor(true) === true, 'interruptor encendido');
  r = await rpc(k1.access_token, 'mesa_yo'); ok(r.ok && r.json.dueno === true && r.json.valido === false && r.json.exige === true, 'mesa_yo: dueño, no válido, se exige', r.text);
  for (const [fn, args] of [['mesa_turno_ver', { dispositivo: DISP }], ['mesa_turno_pedir', { dispositivo: DISP, app: '4.34' }], ['mesa_bajar', { desde: 0, limite: 1 }],
    ['mesa_escribir', { dispositivo: DISP, turno: 1, app: '4.34', cambios: [] }], ['mesa_actividad', { desde: 0, limite: 1 }],
    ['mesa_visto', { dispositivo: DISP, avisos: [1] }], ['mesa_aparato', { dispositivo: DISP, aparato: DISP, es_mio: false }]]) {   // las dos del esquema 6 (D-298, D-299)
    r = await rpc(k1.access_token, fn, args); ok(rech(r, 'verificacion') && r.json.error.http === 401, `${fn} sin código: rechazo «verificacion»`, r.text);
  }
  r = await lista(k1.access_token); ok(r.ok && Array.isArray(r.json) && r.json.length === 0, 'almacén mesa sin código: no lista nada', r.text);
  r = await subir(k1.access_token, RUTA); ok(!r.ok, 'almacén mesa sin código: no sube', r.text);
  r = await rest(P, `clientes?id=eq.${CLI.id}&select=id`, { token: k1.access_token }); ok(r.ok && Array.isArray(r.json) && r.json.length === 0, 'portal sin código: Kevin no ve los clientes', r.text);
  r = await zernio(k1.access_token, { orden: 'posts' }); ok(r.ok && r.json && r.json.ok === false && r.json.error && r.json.error.codigo === 'verificacion', 'zernio sin código: «verificacion»', r.text);
  const act = await sql(`select tipo, detalle ->> 'codigo' as codigo from mesa.actividad where usuario = '${uk}' order by id;`);
  ok(act.some(a => a.tipo === 'rechazo' && a.codigo === 'verificacion') && !act.some(a => a.tipo === 'ajeno'), 'actividad: rechazo «verificacion», nunca «ajeno»', JSON.stringify(act));

  console.log('— con el código de la app');
  const k2 = await conCodigo(P, k1.access_token), c2 = claims(k2.access_token);
  ok(c2.aal === 'aal2' && c2.amr.some(e => e.method === 'totp'), 'Kevin con código: sesión aal2 con totp');
  r = await rpc(k2.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(bien(r), 'mesa_turno_ver con código', r.text);
  r = await rpc(k2.access_token, 'mesa_yo'); const hasta = r.ok && Date.parse(r.json.codigo_hasta);
  ok(r.ok && r.json.sesion === true, 'mesa_yo: la sesión sigue viva (D-298)', r.text);
  ok(r.ok && r.json.valido === true && r.json.codigo === true && Math.abs(hasta - Date.now() - 30 * 86400e3) < 600e3, 'mesa_yo: válido, código hasta dentro de 30 días', r.text);
  r = await subir(k2.access_token, RUTA); ok(r.ok, 'almacén mesa con código: sube', r.text);
  r = await lista(k2.access_token); ok(r.ok && (r.json || []).some(o => RUTA.endsWith(o.name)), 'almacén mesa con código: lista', r.text);
  r = await rest(P, `clientes?id=eq.${CLI.id}&select=id`, { token: k2.access_token }); ok(r.ok && r.json.length === 1, 'portal con código: Kevin ve el cliente', r.text);
  r = await zernio(k2.access_token, { orden: 'posts' }); ok(r.ok && !(r.json && r.json.error && ['verificacion', 'permiso', 'sesion'].includes(r.json.error.codigo)), 'zernio con código: pasa la puerta', r.text);

  console.log('— reloj simulado');
  for (const [d, vale] of [[0, true], [29, true], [29.9, true], [30.1, false], [31, false]]) {
    const f = await conReloj(c2, d);
    const bienR = vale ? f.dueno === true && f.valido === true && f.rechazo === null && f.archivos === 1 && f.clientes === 1
                       : f.dueno === false && f.valido === false && f.rechazo === 'verificacion' && f.archivos === 0 && f.clientes === 0;
    ok(bienR, `código de hace ${d} días: ${vale ? 'da' : 'no da'} (mesa_*, almacén, portal)`, JSON.stringify(f));
  }
  const sinTotp = await sql(`begin; select set_config('request.jwt.claims', $j$${JSON.stringify({ ...c2, amr: c2.amr.filter(e => e.method !== 'totp') })}$j$, true); set local role authenticated; select public.es_dueno() as dueno; rollback;`);
  ok((sinTotp[sinTotp.length - 1] || {}).dueno === false, 'aal2 sin totp en el token: no da');

  console.log('— la clienta del portal y la clave pública');
  const a1 = await entrar(CORREO.a, CLAVE);
  r = await rest(P, `clientes?id=eq.${CLI.id}&select=id`, { token: a1.access_token }); ok(r.ok && r.json.length === 1, 'la clienta ve su cliente sin código (el portal no cambia)', r.text);
  r = await rpc(a1.access_token, 'mesa_yo'); ok(r.ok && r.json.dueno === false && !('codigo_hasta' in r.json), 'mesa_yo de la clienta: no dueña, sin más datos', r.text);
  r = await rpc(a1.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(rech(r, 'permiso'), 'la clienta en las mesa_*: «permiso»', r.text);
  r = await rpc(null, 'mesa_yo'); ok(!r.ok && [401, 403].includes(r.status), 'clave pública sola: mesa_yo rechazada', `${r.status} ${r.text}`);

  console.log('— ¿Olvidaste tu contraseña?');
  const otro = await conCodigo(P, (await entrar(CORREO.k, CLAVE)).access_token);   // «otro ordenador», con su código
  const kc = await porCorreo(CORREO.k);
  ok(claims(kc.access_token).aal === 'aal1', 'código por correo: aal1');
  r = await auth(P, 'user', { method: 'PUT', token: kc.access_token, body: { password: CLAVE2 } }); ok(r.status === 401, 'solo con el correo no se cambia la contraseña', r.text);
  r = await rpc(kc.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(rech(r, 'verificacion'), 'solo con el correo: «verificacion»', r.text);
  const kca = await verificar(P, kc.access_token, otro.factor, otro.secreto);
  r = await auth(P, 'user', { method: 'PUT', token: kca.access_token, body: { password: CLAVE2 } }); ok(r.ok, 'con el correo y la app, contraseña nueva', r.text);
  r = await rpc(kca.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(bien(r), 'y esa sesión (correo + app) entra en la Mesa', r.text);
  r = await auth(P, 'token?grant_type=refresh_token', { body: { refresh_token: otro.refresh_token } }); ok(!r.ok, 'la sesión del otro ordenador queda cerrada', `${r.status}`);
  r = await auth(P, 'token?grant_type=password', { body: { email: CORREO.k, password: CLAVE } }); ok(!r.ok, 'la contraseña vieja ya no entra', `${r.status}`);
  r = await auth(P, 'token?grant_type=password', { body: { email: CORREO.k, password: CLAVE2 } }); ok(r.ok, 'la nueva sí', r.text);

  console.log('— rescate y vuelta atrás');
  const salida = execFileSync(process.execPath, [WEB, 'rescate', 'pruebas', CORREO.k], { encoding: 'utf8' });
  ok(/"factores_quedan": 0/.test(salida) && /"sesiones_abiertas": 0/.test(salida), 'rescate: sin factores y sin sesiones', salida);
  r = await auth(P, 'token?grant_type=refresh_token', { body: { refresh_token: kca.refresh_token } }); ok(!r.ok, 'rescate: la sesión con código ya no se renueva', `${r.status}`);
  // D-298: su pase aún no ha caducado (vale hasta una hora), pero su sesión ya no está en auth.sessions: se corta al momento
  r = await rpc(kca.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(rech(r, 'sesion') && r.json.error.http === 401, 'rescate: el pase sin caducar de una sesión cerrada ya no entra en las mesa_* («sesion»)', r.text);
  r = await rpc(kca.access_token, 'mesa_yo'); ok(r.ok && r.json.dueno === true && r.json.valido === false && r.json.sesion === false, 'rescate: mesa_yo dice sesión cerrada', r.text);
  r = await lista(kca.access_token); ok(r.ok && Array.isArray(r.json) && r.json.length === 0, 'rescate: ni el almacén mesa', r.text);
  r = await rest(P, `clientes?id=eq.${CLI.id}&select=id`, { token: kca.access_token }); ok(r.ok && Array.isArray(r.json) && r.json.length === 0, 'rescate: ni lo suyo del portal', r.text);
  r = await zernio(kca.access_token, { orden: 'posts' }); ok(r.ok && r.json && r.json.ok === false && r.json.error && ['verificacion', 'permiso', 'sesion'].includes(r.json.error.codigo), 'rescate: ni zernio', r.text);
  const act2 = await sql(`select tipo from mesa.actividad where usuario = '${uk}' and tipo = 'ajeno';`);
  ok(!act2.length, 'una sesión cerrada de Kevin nunca queda como «ajeno»', JSON.stringify(act2));
  r = await rest(P, `clientes?id=eq.${CLI.id}&select=id`, { token: a1.access_token }); ok(r.ok && r.json.length === 1, 'y la clienta sigue entrando en su portal', r.text);
  r = await auth(P, 'token?grant_type=password', { body: { email: CORREO.k, password: CLAVE2 } }); ok(!r.ok, 'rescate: la contraseña de antes ya no entra', `${r.status}`);
  const kr = await porCorreo(CORREO.k);
  r = await auth(P, 'factors', { token: kr.access_token, body: { factor_type: 'totp', friendly_name: 'Nuevo' } }); ok(r.ok, 'rescate: con un código por correo se puede dar de alta otra vez', r.text);
  await interruptor(false);
  r = await rpc(kr.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(bien(r), 'interruptor apagado (vuelta atrás): Kevin entra sin código', r.text);
  r = await rpc(kca.access_token, 'mesa_turno_ver', { dispositivo: DISP }); ok(rech(r, 'sesion'), 'pero una sesión cerrada sigue fuera también con el interruptor apagado', r.text);
  r = await lista(kr.access_token); ok(r.ok && (r.json || []).length >= 1, 'y el almacén vuelve a responder', r.text);
}

process.on('SIGINT', () => { limpiar().finally(() => process.exit(130)); });
main().catch(e => { fallos++; console.log('  FALLO ' + tapar(e instanceof Fallo ? e.message : (e.stack || String(e))).slice(0, 400)); })
  .finally(async () => { await limpiar(); console.log(`\n${buenos}/${n} bien${fallos ? ` · ${fallos} FALLOS` : ''}`); process.exit(fallos ? 1 : 0); });
