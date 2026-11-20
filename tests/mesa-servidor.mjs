#!/usr/bin/env node
// Prueba del servidor de la Mesa (traspaso C, lote 2: servidor/mesa.sql; lecciones 89, 94, 120, 121, 136). Node 18+, sin
// dependencias. Solo contra el proyecto de PRUEBAS (se niega a correr contra el real, y también si la Mesa de pruebas la tiene
// un dispositivo que no es de prueba con un latido de hace menos de 2 minutos), con usuarios inventados: un Kevin (dueño), una
// clienta del portal y alguien con sesión que no es miembro de nada. Comprueba que `pedir` de tools/web.mjs tapa (sin red), el
// turno en dos fases (pedir, latido, soltar, reclamar y forzar, también a la vez), versiones y choques, la versión mínima, los
// topes, el borrado blando, el historial y su poda, las páginas y la época, el orden con lotes a la vez, el registro de
// actividad, que aplicar mesa.sql y esquema.sql otra vez no pierde nada (y que uno más viejo no entra), el catálogo, y que
// nadie más que Kevin usa las funciones, el esquema `mesa` ni el almacén `mesa`. Al final, también si algo falla o con Ctrl-C,
// borra sus filas, archivos, usuarios y su fila de dueño, y deja el turno (sin bajar nunca su número), la mínima y la época
// como estaban.
//   node tests/mesa-servidor.mjs
// Necesita en .env: SUPABASE_ACCESS_TOKEN, SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA y SUPABASE_PRUEBAS_SECRETA, y el
// esquema del portal aplicado (`node tools/web.mjs esquema pruebas`). Aplica él mismo `node tools/web.mjs mesa pruebas`.
// Un rechazo de una función `mesa_*` llega con HTTP 200 y `{ok: false, error: {codigo, http, mensaje}}` (así su fila de
// actividad no se deshace); solo la clave pública sin sesión recibe un error HTTP (401), sin fila.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { proyecto, rest, cab, pedir, gestion, tapar, clave, usuarioPorCorreo, Fallo } from '../tools/web.mjs';
import { conCodigo } from './codigo-app.mjs';   // Kevin entra con el código de su app (D-262)

if (process.argv.slice(2).some(a => a !== 'pruebas')) { console.error('esta prueba solo corre contra el proyecto de pruebas'); process.exit(1); }
const P = proyecto('pruebas');
if (!P.publica || !P.secreta) { console.error('faltan las claves pública y secreta del proyecto de pruebas en .env'); process.exit(1); }
if (clave('SUPABASE_REF') === P.ref) { console.error('el proyecto de pruebas es el real: esta prueba no corre ahí'); process.exit(1); }

const S = P.secreta;
const WEB = fileURLToPath(new URL('../tools/web.mjs', import.meta.url));
const SQLMESA = fileURLToPath(new URL('../servidor/mesa.sql', import.meta.url));
const sha = t => createHash('sha256').update(t).digest('hex');
const RUN = randomBytes(4).toString('hex');
const PRE = `prueba-${RUN}-`;                         // las claves de esta pasada (todas las de prueba empiezan por «prueba-»)
const DA = 'prueba-a-' + RUN, DB = 'prueba-b-' + RUN;  // dos ordenadores inventados
const ALM = 'pruebas';                                 // un almacén inventado
const APP = '4.10';
const TOPE = { cambios: 500, valor: 2097152, lote: 4194304 };   // los de mesa_escribir
const CLI = { id: 'prueba-mesa', nombre: 'Cliente Prueba Mesa' };
const CORREO = { k: 'kevin@mesa-pruebas.test', a: 'ana@mesa-pruebas.test', n: 'nadie@mesa-pruebas.test' };
const CLAVE = 'Pr-' + randomBytes(16).toString('hex'); // solo para estos usuarios inventados; no se imprime
const JPG = Buffer.concat([Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'), Buffer.from(RUN)]);
const RUTA = `${ALM}/${sha(JPG)}.jpg`;                 // por huella, como la Mesa
const NOHAY = `${ALM}/${sha('no-hay' + RUN)}.jpg`;     // una ruta que no existe
const SECRETO = 'secreto-' + RUN;                      // un valor de Kevin que nadie más debe ver

let fallos = 0, n = 0;
const ok = (c, txt, extra) => { n++; if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + tapar(extra).slice(0, 240) : '')); } };
const es = (r, ...codigos) => codigos.includes(r.status);
const bien = r => r.ok && r.json && r.json.ok === true;
const rech = (r, codigo, http) => r.ok && r.json && r.json.ok === false && r.json.error && r.json.error.codigo === codigo && r.json.error.http === http;
const espera = ms => new Promise(f => setTimeout(f, ms));
const mediana = l => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
const ajeno = [];   // todo lo que reciben la clienta, quien no es nadie y la clave pública, para buscar rastros de Kevin

async function sql(q) {
  const r = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query: q } });
  if (!r.ok) throw new Fallo(`SQL de la prueba (${r.status}): ${r.text}`);
  return r.json || [];
}
const sqlIntento = async q => { const r = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query: q } }); return { ok: r.ok, text: r.text }; };
function web(...a) {   // una orden de tools/web.mjs, siempre contra pruebas; su salida no se imprime
  try { return { ok: true, out: execFileSync(process.execPath, [WEB, a[0], 'pruebas', ...a.slice(1)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: tapar(String(e.stderr || e.message)) }; }
}
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
async function entrarCon(correo, ua) {   // entrar con otro navegador (su cabecera User-Agent)
  const r = await pedir(`${P.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { ...cab(P.publica), 'Content-Type': 'application/json', 'User-Agent': ua }, body: { email: correo, password: CLAVE }, dejar: ['access_token'] });
  return r;
}
const pedirCodigo = correo => pedir(`${P.url}/auth/v1/admin/generate_link`, { method: 'POST', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { type: 'magiclink', email: correo } });
const servicio = (ruta, o = {}) => rest(P, ruta, { ...o, apikey: S });
const rpcDe = (tk, guardar) => async (fn, args) => { const r = await rest(P, 'rpc/' + fn, { method: 'POST', token: tk || undefined, body: args || {} }); if (guardar) ajeno.push(r.text); return r; };
const almacen = (tk, guardar) => async (metodo, ruta, o = {}) => {
  const h = { ...cab(P.publica, tk || undefined), ...(o.h || {}) };
  if (o.tipo) h['Content-Type'] = o.tipo;
  if (o.upsert) h['x-upsert'] = 'true';
  const r = await pedir(`${P.url}/storage/v1/${ruta}`, { method: metodo, headers: h, body: o.body });
  if (guardar) ajeno.push(r.text);
  return r;
};
const contador = async () => +(await sql('select orden from mesa.turno where id'))[0].orden;
const fila = async c => (await sql(`select version, orden, valor, borrado, dispositivo, turno from mesa.registros where almacen = '${ALM}' and clave = '${PRE}${c}'`))[0] || null;
const porClave = r => Object.fromEntries(((r.json && r.json.resultados) || []).map(x => [x.clave.slice(PRE.length), x]));
const cambio = (c, base, valor) => ({ almacen: ALM, clave: PRE + c, base, valor });
let A0 = 0;   // la actividad de antes de esta pasada no cuenta
const act = cond => sql(`select id, tipo, usuario, sesion, dispositivo, detalle from mesa.actividad where id > ${A0} and ${cond} order by id`);
const ultimaAct = async cond => (await act(cond)).pop() || null;
const cuantasAct = async cond => (await act(cond)).length;

// Lo inventado de cualquier pasada (también de una que se cortó): filas, historial, actividad, ordenadores, archivos,
// clienta, usuarios y su dueño. La actividad solo se borra con la misma llave que su poda (`mesa.poda`); los archivos, con la
// clave secreta (en el almacén `mesa` no hay política de borrar).
const borrarAct = cond => sql(`select set_config('mesa.poda', '1', true); delete from mesa.actividad a where ${cond};`);
async function limpiarDatos() {
  await sql(`delete from mesa.registros where clave like 'prueba-%'; delete from mesa.historial where clave like 'prueba-%';
    delete from mesa.dispositivos where dispositivo like 'prueba-%';`);
  await borrarAct(`a.dispositivo like 'prueba-%' or a.detalle ->> 'clave' like 'prueba-%'`);
  for (;;) {
    const l = await pedir(`${P.url}/storage/v1/object/list/mesa`, { method: 'POST', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { prefix: ALM, limit: 1000, offset: 0 } });
    const rutas = ((l.ok && l.json) || []).filter(x => x && x.name && x.id).map(x => `${ALM}/${x.name}`);
    if (!rutas.length) break;
    const d = await pedir(`${P.url}/storage/v1/object/mesa`, { method: 'DELETE', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { prefixes: rutas } });
    if (!d.ok) throw new Fallo('no se pudieron borrar los archivos de prueba: ' + d.text);
  }
  await servicio(`clientes?id=eq.${CLI.id}`, { method: 'DELETE' });
  await servicio(`clientes_borrados?id=eq.${CLI.id}`, { method: 'DELETE' });   // la reserva del id inventado
  for (const c of Object.values(CORREO)) {
    const u = await usuarioPorCorreo(P, c).catch(() => null);
    if (u) {
      await borrarAct(`a.usuario = '${u.id}'`);
      await servicio(`duenos?user_id=eq.${u.id}`, { method: 'DELETE' }); await pedir(`${P.url}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: cab(S) });
    }
  }
  await borrarAct(`a.usuario is not null and not exists (select 1 from auth.users u where u.id = a.usuario)`);   // de usuarios ya borrados
  await sql(`delete from mesa.portal_aparatos a where not exists (select 1 from auth.users u where u.id = a.usuario);
    delete from mesa.portal_codigos c where not exists (select 1 from auth.users u where u.id = c.usuario);`);   // el registro del portal (D-278)
}
// El turno, la mínima y la época como estaban. El número de turno nunca baja (un dispositivo con el número viejo ya no
// escribe); el contador de orden tampoco.
let FOTO = null;
async function restaurar() {
  if (!FOTO) return;
  const t = { ...FOTO.t };
  if (/^prueba-/.test(t.dispositivo || '')) Object.assign(t, { dispositivo: null, desde: null, latido: null, cola: null, cola_desde: null });
  if (/^prueba-/.test(t.pide || '')) Object.assign(t, { pide: null, pide_desde: null, pide_ultima: null });
  await sql(`update mesa.turno x set (numero, dispositivo, desde, latido, cola, cola_desde, pide, pide_desde, pide_ultima) =
    (select greatest(s.numero, x.numero), s.dispositivo, s.desde, s.latido, s.cola, s.cola_desde, s.pide, s.pide_desde, s.pide_ultima
       from jsonb_populate_record(null::mesa.turno, '${JSON.stringify(t).replace(/'/g, "''")}'::jsonb) s) where x.id`);
  if (/^[0-9]{1,4}\.[0-9]{1,4}$/.test(FOTO.v)) await sql(`update mesa.ajustes set version_minima = '${FOTO.v}' where id`);
  if (/^[0-9a-f-]{36}$/.test(FOTO.epoca || '')) await sql(`update mesa.ajustes set epoca = '${FOTO.epoca}' where id`);
}
let cerrando = null;
const cerrar = () => cerrando || (cerrando = (async () => {
  try { await limpiarDatos(); } catch (e) { fallos++; console.error('limpieza: ' + tapar(e.message)); }
  try { await restaurar(); } catch (e) { fallos++; console.error('restaurar el turno, la mínima y la época: ' + tapar(e.message)); }
})());
process.on('SIGINT', () => { console.log('\nCortado: limpiando el proyecto de pruebas…'); fallos++; cerrar().finally(() => process.exit(130)); });

// `pedir` de tools/web.mjs, sin red: un hijo con una clave inventada en el entorno y un `fetch` falso.
function taparSinRed() {
  const codigo = `
    import { pedir } from ${JSON.stringify(pathToFileURL(WEB).href)};
    let cuerpo = '';
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => cuerpo });
    const s = '4242424242', out = {};
    cuerpo = JSON.stringify({ jwt_secret: 'jwt-de-prueba', db_schema: 'public', anidado: { api_key: 'k-de-prueba', l: [{ password: 'p-de-prueba' }] }, access_token: 't-de-prueba', texto: 'la clave ' + s + ' aquí' });
    let r = await pedir('https://x.test');
    out.campos = r.json.jwt_secret === '[clave]' && r.json.anidado.api_key === '[clave]' && r.json.anidado.l[0].password === '[clave]' && r.json.access_token === '[clave]';
    out.resto = r.json.db_schema === 'public' && r.json.texto === 'la clave [clave] aquí';
    out.texto = !/de-prueba|4242424242/.test(r.text);
    r = await pedir('https://x.test', { dejar: ['access_token'] });
    out.dejar = r.json.access_token === 't-de-prueba' && r.json.jwt_secret === '[clave]';
    cuerpo = '{"n": ' + s + ', "m": 7}';   // tapar el texto lo deja sin ser JSON: antes se devolvía el JSON sin tapar
    r = await pedir('https://x.test');
    out.numero = r.json && r.json.n === '[clave]' && r.json.m === 7 && !r.text.includes(s);
    cuerpo = 'no es JSON ' + s;
    r = await pedir('https://x.test');
    out.noJson = r.json === null && !r.text.includes(s);
    console.log(JSON.stringify(out));`;
  try { return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { encoding: 'utf8', env: { ...process.env, SMTP_CLAVE: '4242424242' }, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (e) { return { error: tapar(String(e.stderr || e.message)).slice(0, 200) }; }
}

async function main() {
  console.log(`Servidor de la Mesa · proyecto de pruebas ${P.ref}`);
  if ((await sql(`select to_regclass('mesa.turno') is not null as hay`))[0].hay) {
    const t = (await sql(`select dispositivo, extract(epoch from now() - latido) as hace from mesa.turno where id`))[0];
    if (t && t.dispositivo && !/^prueba-/.test(t.dispositivo) && t.hace !== null && +t.hace < 120) {
      console.error('la Mesa de pruebas la está usando un dispositivo que no es de prueba (latido de hace menos de 2 minutos): no se toca');
      process.exit(1);
    }
  }

  console.log('tools/web.mjs: pedir tapa sin red');
  const tp = taparSinRed();
  ok(tp.campos, 'el valor de un campo sensible por su nombre (jwt_secret, api_key, password, access_token) sale tapado, también anidado', JSON.stringify(tp));
  ok(tp.resto && tp.texto, 'lo demás sale igual, el texto tapado y el texto de la respuesta sin nada sensible');
  ok(tp.dejar, 'solo lo que pide quien llama (`dejar`) sale tal cual');
  ok(tp.numero, 'si tapar deja el texto sin ser JSON, el JSON sale tapado igual (antes salía sin tapar)');
  ok(tp.noJson, 'y una respuesta que no es JSON, tapada');

  let w = web('mesa');
  ok(w.ok && /"ahora": \d+/.test(w.out), 'tools/web.mjs mesa pruebas aplica servidor/mesa.sql y dice su versión de esquema', w.out);
  if (!w.ok) throw new Fallo('sin mesa.sql no hay nada que probar');
  w = web('mesa'); ok(w.ok, 'y otra vez');
  FOTO = (await sql(`select to_jsonb(t) - 'orden' as t, (select version_minima from mesa.ajustes where id) as v,
    (select epoca from mesa.ajustes where id) as epoca from mesa.turno t where id`))[0];
  await limpiarDatos();
  A0 = +(await sql('select coalesce(max(id), 0) as m from mesa.actividad'))[0].m;
  const uk = await usuario(CORREO.k), ua = await usuario(CORREO.a), un = await usuario(CORREO.n);
  for (const [t, filas] of [['clientes', [CLI]], ['miembros', [{ user_id: ua, cliente_id: CLI.id, nombre: 'Ana Prueba' }]], ['duenos?on_conflict=user_id', [{ user_id: uk }]]]) {
    const r = await servicio(t, { method: 'POST', body: filas, prefer: 'resolution=merge-duplicates' });
    if (!r.ok) throw new Fallo(`no se pudo sembrar ${t}: ${r.status} ${r.text}`);
  }
  const kk = (await conCodigo(P, await entrar(CORREO.k))).access_token, ka = await entrar(CORREO.a), kn = await entrar(CORREO.n);
  const K = rpcDe(kk), A = rpcDe(ka, true), NAD = rpcDe(kn, true), N = rpcDe(null, true);
  const esc = (d, t, cambios, app = APP, reescanear) => K('mesa_escribir', { dispositivo: d, turno: t, app, cambios, ...(reescanear === undefined ? {} : { reescanear }) });
  const reclamar = (d, visto, forzar) => K('mesa_turno_reclamar', { dispositivo: d, visto, app: APP, ...(forzar === undefined ? {} : { forzar }) });
  const EPOCA = FOTO.epoca;
  w = web('mesa-version', APP); ok(w.ok && /"ahora": "4\.10"/.test(w.out), 'tools/web.mjs mesa-version pone la mínima', w.out);

  console.log('Turno en dos fases');
  // ver (esquema 3, lote 3): la misma respuesta que pedir y sin apuntar nada (quien abre la Mesa pregunta antes de pedirla)
  const turnoAntes = (await sql('select numero, dispositivo, pide, pide_ultima from mesa.turno where id'))[0];
  let r = await K('mesa_turno_ver', { dispositivo: DB });
  ok(bien(r) && Number.isInteger(r.json.turno) && 'libre' in r.json && 'tiene' in r.json && 'pide' in r.json && r.json.epoca === EPOCA && r.json.version_minima, 'ver dice el turno, quién lo tiene, quién lo pide y la época', r.text);
  ok(JSON.stringify((await sql('select numero, dispositivo, pide, pide_ultima from mesa.turno where id'))[0]) === JSON.stringify(turnoAntes), 'ver no apunta nada en el turno');
  r = await K('mesa_turno_ver', { dispositivo: 'x' }); ok(rech(r, 'forma', 400), 'ver con un dispositivo mal escrito: rechazo «forma»', r.text);
  r = await K('mesa_turno_pedir', { dispositivo: DA, app: APP });
  const t0 = r.json && r.json.turno;
  ok(bien(r) && Number.isInteger(t0) && Math.abs(Date.parse(r.json.hora) - Date.now()) < 120000 && r.json.epoca === EPOCA, 'pedir dice el turno, la hora del servidor y la época', r.text);
  r = await reclamar(DA, t0, !r.json.libre);
  const n1 = r.json && r.json.turno;
  ok(bien(r) && r.json.tuyo && n1 === t0 + 1, 'A la reclama y el número sube', r.text);
  r = await esc(DA, n1, [cambio('k1', null, { t: 'uno' }), cambio('k2', null, { t: 'dos' }), cambio('k3', null, { t: 'tres', s: SECRETO })]);
  ok(bien(r) && Object.values(porClave(r)).every(x => x.estado === 'ok' && x.version === 1) && r.json.epoca === EPOCA, 'A escribe tres registros nuevos (versión 1)', r.text);
  ok(((await fila('k1')) || {}).turno == n1, 'cada registro guarda el turno con que se escribió');
  r = await K('mesa_turno_pedir', { dispositivo: DB, app: APP });
  ok(bien(r) && !r.json.tuyo && r.json.turno === n1 && r.json.tiene && r.json.tiene.dispositivo === DA && r.json.pide && r.json.pide.dispositivo === DB,
    'B la pide: le dice quién la tiene y queda apuntado que la pide', r.text);
  const pideDesde = r.json && r.json.pide && r.json.pide.desde;
  let s = (await sql('select dispositivo, numero from mesa.turno where id'))[0];
  ok(s.dispositivo === DA && +s.numero === n1, 'pedirla no cambia quién la tiene');
  await espera(1100);
  r = await K('mesa_turno_pedir', { dispositivo: DB, app: APP });
  ok(bien(r) && r.json.pide.desde === pideDesde && r.json.pide.hace >= 1, 'pedirla otra vez no cambia desde cuándo; la edad la cuenta el servidor', r.text);
  ok(bien(r) && r.json.pide.ultima !== pideDesde && r.json.pide.ultima_hace === 0, 'pero sí cuándo la pidió por última vez (sigue esperando)', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: n1, app: APP, cola: 3 });
  ok(bien(r) && r.json.tuyo && r.json.pide && r.json.pide.dispositivo === DB && r.json.tiene.cola === 3 && r.json.tiene.cola_desde && r.json.tiene.latido_hace === 0,
    'el latido de A ve la petición de B y apunta su cola con la hora del servidor (edades nunca negativas)', r.text);
  const colaDesde = r.json && r.json.tiene && r.json.tiene.cola_desde;
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: n1, app: APP, cola: 1 });
  ok(bien(r) && r.json.tiene.cola === 1 && r.json.tiene.cola_desde === colaDesde, 'con cola sin vaciar, «desde» sigue siendo el del primer latido con cola', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: n1, app: APP, cola: 0 });
  ok(bien(r) && r.json.tiene.cola === 0 && r.json.tiene.cola_desde === null, 'con la cola vacía, sin «desde»', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DB, turno: n1, app: APP, cola: 0 }); ok(rech(r, 'turno', 423) && r.json.epoca === EPOCA, 'B no late con un turno que no tiene: rechazo «turno» (423), con la época', r.text);
  r = await K('mesa_turno_soltar', { dispositivo: DB, turno: n1 }); ok(rech(r, 'turno', 423), 'B no suelta lo que no tiene', r.text);
  r = await esc(DB, n1, [cambio('k9', null, 1)]); ok(rech(r, 'turno', 423) && r.json.error.turno === n1 && !(await fila('k9')), 'B no escribe sin tenerla: rechazo «turno» y nada escrito', r.text);
  let a1 = await ultimaAct(`tipo = 'rechazo' and dispositivo = '${DB}' and detalle ->> 'funcion' = 'mesa_escribir'`);
  ok(a1 && a1.detalle.codigo === 'turno' && a1.detalle.http === 423 && a1.usuario === uk && a1.sesion, 'y ese lote rechazado deja su fila (código, quién, su sesión, qué ordenador)', JSON.stringify(a1));
  r = await reclamar(DB, n1); ok(rech(r, 'turno', 423) && r.json.error.dispositivo === DA, 'sin forzar, B no se la quita a A: rechazo «turno» que dice quién la tiene', r.text);
  r = await K('mesa_turno_soltar', { dispositivo: DA, turno: n1 }); ok(bien(r) && r.json.libre && r.json.turno === n1, 'A la suelta: queda libre con el mismo número', r.text);
  r = await esc(DA, n1, [cambio('k4', null, 1)]); ok(rech(r, 'turno', 423) && !(await fila('k4')), 'después de soltarla, A ya no escribe', r.text);
  r = await reclamar(DB, n1 - 1);
  const n2 = r.json && r.json.turno;
  ok(bien(r) && r.json.tuyo && n2 === n1 + 1 && r.json.pide === null && r.json.orden >= 3, 'libre, B la reclama (sin forzar, `visto` no importa): el número sube, su petición se borra y dice hasta dónde bajar', r.text);
  r = await esc(DA, n1, [cambio('k4', null, 1)]); ok(rech(r, 'turno', 423) && !(await fila('k4')), 'la escritura del turno viejo se rechaza entera', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: n1, app: APP, cola: 2 }); ok(rech(r, 'turno', 423), 'y su latido también: así sabe que la ha perdido', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DB, turno: n2, app: APP, cola: 4 });
  r = await reclamar(DA, n2 - 1, true); ok(rech(r, 'turno_cambiado', 409) && r.json.error.turno === n2, 'forzar con un número viejo: «turno_cambiado» (409)', r.text);
  r = await reclamar(DA, n2, true);
  let T = r.json && r.json.turno;
  ok(bien(r) && T === n2 + 1 && r.json.tuyo, 'si B no contesta, Kevin decide: A la fuerza con el número que vio', r.text);
  a1 = await ultimaAct(`tipo = 'turno_forzado'`);
  ok(a1 && a1.dispositivo === DA && a1.detalle.antes === DB && +a1.detalle.turno_antes === n2 && +a1.detalle.cola === 4 && +a1.detalle.latido_hace >= 0,
    'y queda una fila «turno_forzado» con quién la tenía, la edad de su latido y su cola', JSON.stringify(a1));
  r = await esc(DB, n2, [cambio('k5', null, 1)]); ok(rech(r, 'turno', 423) && !(await fila('k5')), 'y desde ese momento B ya no escribe', r.text);
  r = await reclamar(DA, 0); ok(bien(r) && r.json.turno === T && r.json.tuyo, 'reclamar la que ya se tiene, con un número viejo y sin forzar: su turno, sin cambiar', r.text);
  const recl = await act(`tipo = 'turno_reclamado' and dispositivo in ('${DA}', '${DB}')`);
  ok(recl.length === 3 && recl.map(x => x.dispositivo).join() === [DA, DB, DA].join() && recl[2].detalle.forzado === true && recl[1].detalle.forzado === false,
    'cada cambio de dueño deja una fila «turno_reclamado» (y dice si fue forzado)', JSON.stringify(recl.map(x => [x.dispositivo, x.detalle.forzado])));
  const nuevos = await act(`tipo = 'dispositivo_nuevo' and dispositivo in ('${DA}', '${DB}')`);
  ok(nuevos.length === 2 && nuevos[0].dispositivo === DA && nuevos[1].dispositivo === DB, 'el primer reclamo de cada ordenador, además, una «dispositivo_nuevo»', JSON.stringify(nuevos.map(x => x.dispositivo)));
  s = (await sql(`select count(*) as n from mesa.dispositivos where dispositivo in ('${DA}', '${DB}')`))[0];
  ok(+s.n === 2, 'y quedan en mesa.dispositivos (no dependen del historial ni de ninguna poda)');

  console.log('Turno a la vez');
  r = await K('mesa_turno_soltar', { dispositivo: DA, turno: T });
  const dos = await Promise.all([DA, DB].map(d => reclamar(d, T)));
  const gana = dos.filter(bien), pierde = dos.filter(y => rech(y, 'turno', 423));
  ok(gana.length === 1 && pierde.length === 1 && gana[0].json.turno === T + 1, 'dos reclamos a la vez del mismo turno libre: uno gana, el otro «turno»', dos.map(y => y.text).join(' | '));
  T = T + 1;
  if (!bien(dos[0])) { r = await reclamar(DA, T, true); T = r.json.turno; }
  let vueltas = 0, consistentes = 0, entraron = 0, fuera = 0;
  for (let v = 0; v < 4; v++) {
    const lote = Array.from({ length: 60 }, (_, i) => cambio(`w${v}-${i}`, null, { v, i }));
    const [we, rc] = await Promise.all([esc(DA, T, lote), reclamar(DB, T, true)]);
    vueltas++;
    const escritos = +(await sql(`select count(*) as n from mesa.registros where clave like '${PRE}w${v}-%'`))[0].n;
    if (bien(we) && bien(rc)) { entraron++; if (escritos === 60 && rc.json.orden >= Math.max(...we.json.resultados.map(y => y.orden))) consistentes++; }
    else if (rech(we, 'turno', 423) && bien(rc)) { fuera++; if (escritos === 0) consistentes++; }
    r = await reclamar(DA, rc.json.turno, true); T = r.json.turno;
  }
  ok(consistentes === vueltas, `escribir mientras otro la fuerza (${vueltas} vueltas: ${entraron} entraron antes, ${fuera} rechazadas): nunca a medias`, `${consistentes}/${vueltas}`);

  console.log('Versiones y choques');
  r = await esc(DA, T, [cambio('k1', 1, { t: 'uno-b' }), cambio('k2', 0, { t: 'dos-b' }), cambio('k3', 1, { t: 'tres-b', s: SECRETO })]);
  let x = porClave(r);
  ok(bien(r) && x.k1.estado === 'ok' && x.k1.version === 2 && x.k3.estado === 'ok' && x.k3.version === 2, 'los cambios sobre la última versión entran (versión 2)', r.text);
  ok(x.k2 && x.k2.estado === 'choque' && x.k2.ultima === 1 && x.k2.borrado === false && x.k2.dispositivo === DA && x.k2.turno === n1,
    'uno con base vieja choca solo y dice cuál es la última, qué dispositivo y qué turno la escribieron', r.text);
  ok(((await fila('k2')) || {}).valor?.t === 'dos', 'y no se escribe');
  r = await K('mesa_bajar', { desde: x.k2.orden - 1, limite: 1 });
  ok(bien(r) && r.json.filas[0] && r.json.filas[0].clave === PRE + 'k2' && r.json.filas[0].version === 1 && r.json.filas[0].valor.t === 'dos',
    'la versión vigente tras un choque se lee con bajar(orden − 1, límite 1)', r.text);
  a1 = await ultimaAct(`tipo = 'choque' and detalle ->> 'clave' = '${PRE}k2'`);
  ok(a1 && a1.dispositivo === DA && +a1.detalle.base === 0 && +a1.detalle.ultima === 1 && a1.detalle.de === DA && !JSON.stringify(a1.detalle).includes('dos-b'),
    'el choque deja su fila (almacén, clave, base, última, de quién; nunca el valor)', JSON.stringify(a1));
  r = await esc(DA, T, [cambio('k1', null, { t: 'otro' })]); x = porClave(r);
  ok(bien(r) && x.k1.estado === 'choque' && x.k1.ultima === 2, 'un registro «nuevo» choca si ya hay uno vivo', r.text);
  r = await esc(DA, T, [cambio('k6', 7, { t: 'seis' })]); x = porClave(r);
  ok(bien(r) && x.k6.estado === 'choque' && x.k6.ultima === 0 && !(await fila('k6')), 'una base sobre un registro que no existe choca (última 0)', r.text);
  r = await esc(DA, T, [cambio('k1', 1, null)]); x = porClave(r);
  ok(bien(r) && x.k1.estado === 'choque' && x.k1.ultima === 2 && !((await fila('k1')).borrado), 'un borrado con base vieja choca y no borra', r.text);
  let c = await contador();
  r = await esc(DA, T, [cambio('k1', 2, { t: 'uno-b' })]); x = porClave(r);
  ok(bien(r) && x.k1.estado === 'igual' && x.k1.version === 2 && (await contador()) === c, 'el mismo valor: «igual», sin versión ni número nuevo', r.text);
  const repetido = [cambio('k1', 2, { t: 'uno-c' }), cambio('k6', null, { t: 'seis' })];
  r = await esc(DA, T, repetido); x = porClave(r);
  ok(bien(r) && x.k1.estado === 'ok' && x.k1.version === 3 && x.k6.estado === 'ok', 'un lote que entra…', r.text);
  c = await contador();
  r = await esc(DA, T, repetido); x = porClave(r);
  ok(bien(r) && x.k1.estado === 'igual' && x.k1.version === 3 && x.k6.estado === 'igual' && x.k6.version === 1 && (await contador()) === c,
    '…repetido porque su respuesta se perdió: «igual», no choca consigo mismo', r.text);

  console.log('Versión mínima');
  w = web('mesa-version', '4.9'); ok(w.ok, 'mínima 4.9', w.out);
  r = await esc(DA, T, [cambio('k7', null, 1)], '4.10'); ok(bien(r) && porClave(r).k7.estado === 'ok', 'con mínima 4.9, una Mesa 4.10 escribe (números, no texto)', r.text);
  w = web('mesa-version', '4.10'); ok(w.ok && /"antes": "4\.9"/.test(w.out), 'mínima 4.10 (dice la de antes)', w.out);
  r = await esc(DA, T, [cambio('k7', 1, 2)], '4.9');
  ok(rech(r, 'app', 426) && r.json.error.version_minima === '4.10' && (await fila('k7')).version === 1, 'una Mesa 4.9 no escribe: rechazo «app» (426) y el lote entero fuera', r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'codigo' = 'app' and detalle ->> 'funcion' = 'mesa_escribir'`);
  ok(a1 && a1.detalle.app === '4.9' && a1.dispositivo === DA, 'y deja su fila con la versión de la app', JSON.stringify(a1));
  r = await K('mesa_turno_pedir', { dispositivo: DA, app: '4.9' }); ok(rech(r, 'app', 426), 'ni pide la Mesa', r.text);
  r = await K('mesa_turno_reclamar', { dispositivo: DB, visto: T, app: '4.9', forzar: true });
  ok(rech(r, 'app', 426) && (await sql('select dispositivo from mesa.turno where id'))[0].dispositivo === DA, 'ni la reclama, tampoco forzando', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: T, app: '4.9', cola: 0 }); ok(rech(r, 'app', 426), 'ni late (así sabe que tiene que recargar)', r.text);
  r = await esc(DA, T, [cambio('k7', 1, 2)], '4.x<script>'); ok(rech(r, 'forma', 400), 'una versión de app mal escrita: rechazo «forma» (400)', r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'codigo' = 'forma' and detalle ->> 'funcion' = 'mesa_escribir'`);
  ok(a1 && !('app' in a1.detalle), 'y su fila no guarda esa app (solo una bien escrita)', JSON.stringify(a1));
  w = web('mesa-version', '4,11'); ok(!w.ok, 'mesa-version no acepta «4,11»');

  console.log('Lotes mal formados (fuera enteros)');
  const formaDA = () => cuantasAct(`tipo = 'rechazo' and dispositivo = '${DA}' and detalle ->> 'codigo' = 'forma' and detalle ->> 'funcion' = 'mesa_escribir'`);
  const f0 = await formaDA();
  r = await esc(DA, T, [cambio('k8', null, 1), { almacen: ALM, clave: PRE + 'k8b', base: null }]); ok(rech(r, 'forma', 400) && r.json.error.indice === 2 && !(await fila('k8')), 'un cambio sin «valor» no se toma por borrado: «forma», dice cuál, y nada escrito', r.text);
  r = await esc(DA, T, [cambio('k8', null, 1), cambio('k8', null, 2)]); ok(rech(r, 'forma', 400) && !(await fila('k8')), 'un registro repetido en el lote', r.text);
  r = await esc(DA, T, [cambio('k8', null, 1), { almacen: 'Mal!', clave: PRE + 'x', base: null, valor: 1 }]); ok(rech(r, 'forma', 400) && !(await fila('k8')), 'un almacén mal escrito', r.text);
  r = await esc(DA, T, [cambio('k8', -1, 1)]); ok(rech(r, 'forma', 400), 'una base negativa', r.text);
  r = await esc(DA, T, []); ok(rech(r, 'forma', 400), 'un lote vacío', r.text);
  ok((await formaDA()) === f0, 'el mismo rechazo del mismo ordenador en menos de un minuto no repite fila', `${f0} → ${await formaDA()}`);

  console.log(`Topes del lote: ${TOPE.cambios} cambios, 2 MB por valor, 4 MB el lote`);
  r = await esc(DA, T, Array.from({ length: TOPE.cambios + 1 }, (_, i) => cambio('m' + i, null, i)));
  ok(rech(r, 'tope', 413) && r.json.error.tope === 'cambios' && r.json.error.maximo === TOPE.cambios && r.json.error.tiene === TOPE.cambios + 1 && !(await fila('m0')),
    `${TOPE.cambios + 1} cambios: rechazo «tope» (413) que dice cuál, el máximo y lo que trae`, r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'tope' = 'cambios'`); ok(a1 && +a1.detalle.tiene === TOPE.cambios + 1, 'y su fila', JSON.stringify(a1));
  r = await esc(DA, T, [cambio('v1', null, 'x'.repeat(TOPE.valor))]);
  ok(rech(r, 'tope', 413) && r.json.error.tope === 'valor' && r.json.error.clave === PRE + 'v1' && !(await fila('v1')), 'un valor de más de 2 MB: «tope» con su almacén y su clave', r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'tope' = 'valor'`);
  ok(a1 && a1.detalle.clave === PRE + 'v1' && Buffer.byteLength(JSON.stringify(a1.detalle)) < 2048, 'y su fila, corta y sin el valor', JSON.stringify(a1).slice(0, 200));
  r = await esc(DA, T, [1, 2, 3].map(i => cambio('l' + i, null, 'y'.repeat(1500000))));
  ok(rech(r, 'tope', 413) && r.json.error.tope === 'lote' && !(await fila('l1')), 'tres valores de 1,5 MB en un lote (4,5 MB): «tope» del lote', r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'tope' = 'lote'`); ok(a1 && +a1.detalle.tiene > TOPE.lote, 'y su fila', JSON.stringify(a1));
  const maximo = [cambio('x1', null, { x: 'a'.repeat(1950000) }), cambio('x2', null, { x: 'b'.repeat(1950000) }),
    ...Array.from({ length: TOPE.cambios - 2 }, (_, i) => cambio('xs' + i, null, { i, n: 'archivo-' + i, w: 2560, h: 1707 }))];
  let t1 = Date.now();
  r = await esc(DA, T, maximo);
  const msMax = Date.now() - t1;
  ok(bien(r) && r.json.resultados.length === TOPE.cambios && r.json.resultados.every(y => y.estado === 'ok') && msMax < 8000,
    `un lote en los topes (500 cambios, dos valores de 1,9 MB, 3,9 MB) entra en ${msMax} ms, ida y vuelta: dentro de los 8 s del rol`, r.text);
  t1 = Date.now();
  r = await esc(DA, T, maximo.map((y, i) => ({ ...y, base: 1, valor: i < 2 ? { x: (i ? 'd' : 'c').repeat(1950000) } : { ...y.valor, otra: 1 } })));
  const msMax2 = Date.now() - t1;
  ok(bien(r) && r.json.resultados.every(y => y.estado === 'ok' && y.version === 2) && msMax2 < 8000, `y pisándolos todos, con su historial (${msMax2} ms)`, r.text);

  console.log('Borrado blando');
  r = await esc(DA, T, [cambio('k3', 2, null)]); x = porClave(r);
  ok(bien(r) && x.k3.estado === 'ok' && x.k3.version === 3, 'borrar es escribir un valor nulo: versión nueva', r.text);
  r = await K('mesa_bajar', { desde: x.k3.orden - 1, limite: 1 });
  const b3 = bien(r) && r.json.filas[0];
  ok(b3 && b3.clave === PRE + 'k3' && b3.borrado === true && b3.valor === null && b3.version === 3 && b3.turno === T, 'baja como borrado (valor nulo), con su turno', r.text);
  const h3 = await sql(`select valor from mesa.historial where almacen = '${ALM}' and clave = '${PRE}k3' order by id desc limit 1`);
  ok(h3[0] && h3[0].valor.t === 'tres-b', 'y su último valor queda en el historial');
  r = await esc(DA, T, [cambio('k3', 3, null)]); ok(bien(r) && porClave(r).k3.estado === 'igual', 'borrar lo ya borrado: «igual»', r.text);
  r = await esc(DA, T, [cambio('k3', 2, { t: 'tres-x' })]); x = porClave(r);
  ok(bien(r) && x.k3.estado === 'choque' && x.k3.ultima === 3 && x.k3.borrado === true && (await fila('k3')).borrado, 'una base vieja sobre una lápida choca (y dice que está borrado)', r.text);
  r = await esc(DA, T, [cambio('k9', null, null)]); ok(bien(r) && porClave(r).k9.estado === 'igual' && !(await fila('k9')), 'borrar lo que nunca existió: «igual», sin lápida', r.text);
  r = await esc(DA, T, [cambio('k3', null, { t: 'tres-c' })]); ok(bien(r) && porClave(r).k3.version === 4, 'sobre una lápida se vuelve a crear (base nula o la suya)', r.text);

  console.log('Borrados masivos');
  const masivos = () => cuantasAct(`tipo = 'borrado_masivo' and dispositivo = '${DA}'`);
  r = await esc(DA, T, Array.from({ length: 41 }, (_, i) => cambio('d' + i, null, { i })));
  let m0 = await masivos();
  r = await esc(DA, T, Array.from({ length: 20 }, (_, i) => cambio('d' + i, 1, null)));
  ok(bien(r) && r.json.resultados.every(y => y.estado === 'ok') && (await masivos()) === m0, 'un lote que borra 20: sin fila', r.text);
  r = await esc(DA, T, Array.from({ length: 21 }, (_, i) => cambio('d' + (20 + i), 1, null)));
  a1 = await ultimaAct(`tipo = 'borrado_masivo' and dispositivo = '${DA}'`);
  ok(bien(r) && (await masivos()) === m0 + 1 && +a1.detalle.cuantos === 21 && +a1.detalle.almacenes[ALM] === 21 && a1.detalle.reescanear === false
    && a1.detalle.claves.length === 10 && a1.detalle.claves[0] === `${ALM}/${PRE}d20`, 'uno que borra 21: fila «borrado_masivo» con cuántos, de qué almacén y las 10 primeras claves', JSON.stringify(a1));
  r = await esc(DA, T, [cambio('r1', null, 1), cambio('r2', null, 2)]);
  m0 = await masivos();
  r = await esc(DA, T, [cambio('r2', 1, 3)], APP, true); ok(bien(r) && (await masivos()) === m0, 'un lote «reescanear» sin borrados: sin fila', r.text);
  r = await esc(DA, T, [cambio('r1', 1, null), cambio('r2', 2, 4)], APP, true);
  a1 = await ultimaAct(`tipo = 'borrado_masivo' and dispositivo = '${DA}'`);
  ok(bien(r) && (await masivos()) === m0 + 1 && +a1.detalle.cuantos === 1 && a1.detalle.reescanear === true, 'un lote «reescanear» que borra uno: fila «borrado_masivo»', JSON.stringify(a1));

  console.log('Historial');
  const H = 'h';
  for (let v = 1; v <= 4; v++) { r = await esc(DA, T, [cambio(H, v === 1 ? null : v - 1, { v })]); if (!bien(r)) break; }
  let hs = await sql(`select valor from mesa.historial where clave = '${PRE}${H}' order by id`);
  ok(hs.length === 1 && hs[0].valor.v === 1, 'mismo ordenador y turno, cuatro escrituras seguidas: una sola versión anterior (la primera)', JSON.stringify(hs));
  await sql(`update mesa.historial set guardada = guardada - interval '6 minutes' where clave = '${PRE}${H}'`);
  r = await esc(DA, T, [cambio(H, 4, { v: 5 })]);
  hs = await sql(`select valor from mesa.historial where clave = '${PRE}${H}' order by id`);
  ok(hs.length === 2 && hs[1].valor.v === 4, 'pasados 5 minutos, la siguiente guarda otra', JSON.stringify(hs));
  const H2 = 'h2';
  r = await esc(DA, T, [cambio(H2, null, { v: 1 })]); r = await esc(DA, T, [cambio(H2, 1, { v: 2 })]);
  r = await reclamar(DB, T, true); const TB = r.json.turno;
  r = await esc(DB, TB, [cambio(H2, 2, { v: 3 })]); ok(bien(r), 'B escribe el mismo registro un momento después', r.text);
  r = await reclamar(DA, TB, true); T = r.json.turno;
  r = await esc(DA, T, [cambio(H2, 3, { v: 4 })]); r = await esc(DA, T, [cambio(H2, 4, { v: 5 })]);
  hs = await sql(`select valor, dispositivo, turno from mesa.historial where clave = '${PRE}${H2}' order by id`);
  ok(hs.map(y => y.valor.v).join() === '1,2,3' && hs[1].dispositivo === DA && hs[2].dispositivo === DB && +hs[2].turno === TB,
    'dos ordenadores en menos de 5 minutos: el historial guarda lo de cada uno (lo pisado por otro, siempre); lo del mismo, una vez', JSON.stringify(hs.map(y => [y.valor.v, y.dispositivo])));
  const base = [];
  for (let i = 0; i < 3; i++) { t1 = Date.now(); r = await esc(DA, T, [cambio(H, 5 + i, { v: 6 + i })]); base.push(Date.now() - t1); }
  await sql(`insert into mesa.historial (almacen, clave, valor, version, orden, app, dispositivo, hora, guardada)
    select '${ALM}', '${PRE}viejo-' || g, jsonb_build_object('x', repeat('h', 400000)), 1, 1, '4.10', '${DA}', now() - interval '31 days', now() - interval '31 days'
      from generate_series(1, 60) g;
    insert into mesa.historial (almacen, clave, valor, version, orden, app, dispositivo, hora, guardada) values
    ('${ALM}', '${PRE}reciente', '{}', 1, 1, '4.10', '${DA}', now() - interval '29 days', now() - interval '29 days');
    insert into mesa.actividad (hora, tipo, dispositivo, detalle)
    select now() - interval '91 days', 'prueba_vieja', '${DA}', '{}' from generate_series(1, 310);
    insert into mesa.actividad (hora, tipo, dispositivo, detalle) values (now() - interval '89 days', 'prueba_reciente', '${DA}', '{}');`);
  t1 = Date.now();
  r = await esc(DA, T, [cambio(H, 8, { v: 9 })]);
  const msPoda = Date.now() - t1;
  hs = (await sql(`select (select count(*) from mesa.historial where clave like '${PRE}viejo-%') as viejos, (select count(*) from mesa.historial where clave = '${PRE}reciente') as reciente,
    (select count(*) from mesa.actividad where dispositivo = '${DA}' and tipo = 'prueba_vieja') as av, (select count(*) from mesa.actividad where dispositivo = '${DA}' and tipo = 'prueba_reciente') as ar`))[0];
  ok(bien(r) && +hs.viejos === 10 && +hs.reciente === 1, `una escritura poda 50 filas del historial de más de 30 días (60 → 10) y deja la de 29: ${msPoda} ms con 50 valores de 400 KB, ${mediana(base)} ms sin poda`, JSON.stringify(hs));
  ok(+hs.av === 10 && +hs.ar === 1 && msPoda < 8000, 'y 300 de la actividad de más de 90 días (310 → 10), dejando la de 89', JSON.stringify(hs));
  r = await esc(DA, T, [cambio(H, 9, { v: 10 })]);
  hs = (await sql(`select (select count(*) from mesa.historial where clave like '${PRE}viejo-%') as viejos`))[0];
  ok(+hs.viejos === 0, 'la siguiente escritura poda lo que quedaba');

  console.log('Bajar por páginas');
  const c0 = await contador();
  const NP = 1150;
  for (let i = 0; i < NP; i += 500) {
    r = await esc(DA, T, Array.from({ length: Math.min(500, NP - i) }, (_, j) => cambio('p' + (i + j), null, { n: i + j })));
    if (!bien(r)) { ok(false, 'escribir 1.150 registros en lotes de 500', r.text); break; }
  }
  let paginas = 0, desde = c0, mal = 0, maxPag = 0; const vistas = new Map();
  for (;;) {
    r = await K('mesa_bajar', { desde }); if (!bien(r)) { mal++; break; }
    paginas++; maxPag = Math.max(maxPag, r.json.filas.length);
    let prev = desde;
    for (const f of r.json.filas) { if (f.orden <= prev) mal++; prev = f.orden; vistas.set(f.clave, (vistas.get(f.clave) || 0) + 1); }
    if (r.json.mas && r.json.hasta !== prev) mal++;
    if (!r.json.mas) break;
    desde = r.json.hasta;
  }
  const pv = [...vistas].filter(([k]) => k.startsWith(PRE + 'p'));
  ok(!mal && paginas >= 3 && maxPag <= 500 && pv.length === NP && pv.every(([, v]) => v === 1), `1.150 registros en ${paginas} páginas de 500 como mucho: ninguno saltado ni repetido`, `mal ${mal}, vistas ${pv.length}`);
  r = await K('mesa_bajar', { desde: c0, limite: 2000 }); ok(bien(r) && r.json.filas.length === 500 && r.json.mas, 'pedir 2.000 de golpe da 500 y dice que hay más', bien(r) ? String(r.json.filas.length) : r.text);
  r = await K('mesa_bajar', { desde: await contador() }); ok(bien(r) && r.json.filas.length === 0 && r.json.mas === false && r.json.hasta === r.json.orden, 'desde el último: nada, sin más', r.text);
  r = await esc(DA, T, [cambio('z', null, 1)]);
  const z = porClave(r).z.orden;
  await sql(`delete from mesa.registros where clave = '${PRE}z'`);   // una fila que falta (borrada a mano)
  r = await K('mesa_bajar', { desde: z - 1 });
  ok(bien(r) && r.json.filas.length === 0 && !r.json.mas && r.json.hasta >= r.json.orden && r.json.orden >= z,
    'si falta una fila (borrada a mano), «hasta» llega igual al contador: un bucle «hasta llegar a orden» termina', r.text);
  r = await K('mesa_bajar', { desde: -1 }); ok(rech(r, 'forma', 400), 'desde negativo: rechazo «forma»', r.text);
  c = await contador();
  r = await K('mesa_bajar', { desde: c + 1000 });
  ok(rech(r, 'cursor', 409) && r.json.error.orden === c, 'un cursor más allá del contador (de otra época): rechazo «cursor» (409)', r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'codigo' = 'cursor'`); ok(a1 && +a1.detalle.desde === c + 1000, 'y su fila', JSON.stringify(a1));
  const grande = i => ({ g: i, x: String(i).repeat(1500000) });
  const cg = await contador();
  for (const i of [1, 2, 3]) { r = await esc(DA, T, [cambio('g' + i, null, grande(i))]); if (!bien(r)) break; }
  ok(bien(r), 'tres valores de 1,5 MB, uno por lote', r.text);
  r = await K('mesa_bajar', { desde: cg });
  const g1 = bien(r) && r.json.filas;
  ok(g1 && g1.length === 2 && r.json.mas && g1.every(f => f.valor.x.length === 1500000), 'una página lleva unos 4 MB como mucho: dos y «hay más»', bien(r) ? String(g1.length) : r.text);
  r = bien(r) ? await K('mesa_bajar', { desde: r.json.hasta }) : r;
  ok(bien(r) && r.json.filas.length === 1 && r.json.filas[0].valor.g === 3 && !r.json.mas, 'y la siguiente, la tercera', r.text);

  console.log('Época');
  r = await K('mesa_bajar', { desde: await contador() }); ok(bien(r) && r.json.epoca === EPOCA, 'cada respuesta trae la época');
  w = web('mesa-epoca'); let we2 = null; try { we2 = JSON.parse(w.out).epoca; } catch (e) { /* */ }
  ok(w.ok && we2 && we2.antes === EPOCA && we2.ahora !== EPOCA, 'tools/web.mjs mesa-epoca pone una nueva (tras restaurar una copia)', w.out);
  r = await K('mesa_bajar', { desde: await contador() }); ok(bien(r) && we2 && r.json.epoca === we2.ahora, 'y las respuestas la traen: las Mesas bajan todo desde 0', r.text);

  console.log('Lotes a la vez');
  const c1 = await contador();
  const lotes = Array.from({ length: 8 }, (_, j) => Array.from({ length: 40 }, (_, i) => cambio(`c${j}-${i}`, null, { j, i })));
  let fin = false, cursor = c1, errorLector = null; const vistos = new Set(), pags = [];
  const lector = (async () => {
    for (;;) {
      const ultima = fin;
      const q = await K('mesa_bajar', { desde: cursor, limite: 25 });
      if (!bien(q)) { errorLector = q.text; return; }
      for (const f of q.json.filas) vistos.add(f.clave);
      cursor = q.json.hasta; pags.push({ hasta: cursor, vistos: new Set(vistos) });
      if (ultima && !q.json.mas) return;
    }
  })();
  const res = await Promise.all(lotes.map(l => esc(DA, T, l)));
  fin = true; await lector;
  const rangos = res.map(q => (q.json && q.json.resultados || []).map(y => y.orden)).map(o => [Math.min(...o), Math.max(...o), o.length]).sort((a, b) => a[0] - b[0]);
  ok(res.every(q => bien(q) && q.json.resultados.every(y => y.estado === 'ok')), '8 lotes de 40 lanzados a la vez entran todos', res.map(q => q.status).join(','));
  ok(rangos.every((g, i) => g[1] - g[0] === g[2] - 1 && (!i || g[0] > rangos[i - 1][1])), 'cada lote con sus números seguidos y sin mezclarse con otro');
  // Saltarse algo sería que, tras leer hasta H, faltara un registro con número ≤ H (con una secuencia, uno confirmado tarde).
  const finales = await sql(`select clave, orden from mesa.registros where clave like '${PRE}c%'`);
  const saltos = pags.reduce((m, p) => m + finales.filter(f => +f.orden <= p.hasta && !p.vistos.has(f.clave)).length, 0);
  ok(!errorLector && finales.length === 320 && !saltos && finales.every(f => vistos.has(f.clave)),
    `quien baja mientras tanto (${pags.length} páginas): tras cada página tiene todo lo que lleva un número hasta su «hasta», y al final los 320`, errorLector || `saltos ${saltos}`);

  console.log('Aplicar otra vez, con datos dentro');
  const huella = async () => JSON.stringify(await sql(`select (select count(*) from mesa.registros where clave like '${PRE}%') as n,
    (select sum(version) from mesa.registros where clave like '${PRE}%') as v, (select max(orden) from mesa.registros where clave like '${PRE}%') as o,
    (select md5(string_agg(clave || ':' || version || ':' || coalesce(valor::text, '-'), ',' order by clave)) from mesa.registros where clave like '${PRE}%') as m,
    (select count(*) from mesa.historial where clave like '${PRE}%') as h, (select numero || ':' || dispositivo from mesa.turno where id) as t,
    (select version_minima || ':' || epoca || ':' || esquema from mesa.ajustes where id) as aj, (select count(*) || ':' || max(id) from mesa.actividad where id > ${A0}) as a,
    (select count(*) from mesa.dispositivos where dispositivo like 'prueba-%') as d`));
  const antes = await huella();
  const w1 = web('mesa'), w2 = web('esquema'), w3 = web('mesa');
  ok(w1.ok && w2.ok && w3.ok, 'mesa.sql, esquema.sql y mesa.sql otra vez: entran', [w1, w2, w3].filter(v => !v.ok).map(v => v.out).join(' | '));
  ok((await huella()) === antes, 'registros, versiones, historial, turno, mínima, época, actividad y ordenadores siguen igual', antes);
  const viejo = readFileSync(SQLMESA, 'utf8').replace(/v_archivo constant integer := \d+;/, 'v_archivo constant integer := 1;');
  const yv = await sqlIntento(viejo);
  ok(!yv.ok && /más viejo que el aplicado/.test(yv.text) && (await huella()) === antes, 'un mesa.sql más viejo que el aplicado no entra (ni pegado a mano)', yv.text);
  r = await esc(DA, T, [cambio('k2', 1, { t: 'dos-c' })]); ok(bien(r) && porClave(r).k2.version === 2, 'y las funciones siguen escribiendo', r.text);

  console.log('Nadie más que Kevin: funciones');
  const llamadas = [
    ['mesa_turno_ver', { dispositivo: DB }],
    ['mesa_turno_pedir', { dispositivo: DB, app: APP }],
    ['mesa_turno_latido', { dispositivo: DA, turno: T, app: APP, cola: 0 }],
    ['mesa_turno_reclamar', { dispositivo: DB, visto: T, app: APP, forzar: true }],
    ['mesa_turno_soltar', { dispositivo: DA, turno: T }],
    ['mesa_escribir', { dispositivo: DA, turno: T, app: APP, cambios: [cambio('intruso', null, 1), cambio('k1', 3, { t: 'pisado' })] }],
    ['mesa_bajar', { desde: 0 }],
    ['mesa_actividad', { desde: 0 }],
  ];
  for (const [fn, args] of llamadas) {
    r = await A(fn, args);
    ok(rech(r, 'permiso', 403) && Object.keys(r.json).length === 2 && Object.keys(r.json.error).length === 3, `la clienta: ${fn} da «permiso» (403) y nada más`, `${r.status} ${r.text}`);
  }
  s = await act(`tipo = 'ajeno' and usuario = '${ua}'`);
  ok(s.length === llamadas.length && llamadas.every(([fn]) => s.some(y => y.detalle.funcion === fn)) && s.every(y => y.sesion), 'y cada una de sus llamadas queda apuntada («ajeno», con la función y su sesión)', JSON.stringify(s.map(y => y.detalle.funcion)));
  for (let i = 0; i < 6; i++) await A('mesa_bajar', { desde: 0 });
  ok((await cuantasAct(`tipo = 'ajeno' and usuario = '${ua}'`)) === 10, 'pero como mucho 10 filas por minuto y usuario');
  const enMin = +(await sql(`select count(*) as n from mesa.actividad where tipo = 'ajeno' and hora > now() - interval '1 minute'`))[0].n;
  await sql(`insert into mesa.actividad (tipo, usuario, dispositivo, detalle) select 'ajeno', gen_random_uuid(), 'prueba-falso-${RUN}', '{"funcion":"falsa"}'
    from generate_series(1, ${Math.max(0, 60 - enMin)})`);
  r = await NAD('mesa_bajar', { desde: 0 }); r = await NAD('mesa_bajar', { desde: 0 });
  ok(rech(r, 'permiso', 403) && (await cuantasAct(`tipo = 'ajeno' and usuario = '${un}'`)) === 0 && (await cuantasAct(`tipo = 'ajeno_tope'`)) === 1,
    'con 60 en el último minuto entre todos, ya no se apuntan más: una sola fila «ajeno_tope»', `${await cuantasAct(`tipo = 'ajeno_tope'`)}`);
  await borrarAct(`a.dispositivo = 'prueba-falso-${RUN}' or (a.tipo = 'ajeno_tope' and a.id > ${A0})`);
  r = await NAD('mesa_escribir', llamadas.find(x => x[0] === 'mesa_escribir')[1]);
  ok(rech(r, 'permiso', 403) && (await cuantasAct(`tipo = 'ajeno' and usuario = '${un}'`)) === 1, 'alguien con sesión que no es miembro de nada: «permiso» y su fila');
  const quince = await Promise.all(Array.from({ length: 15 }, () => NAD('mesa_bajar', { desde: 0 })));
  ok(quince.every(y => rech(y, 'permiso', 403)) && (await cuantasAct(`tipo = 'ajeno' and usuario = '${un}'`)) === 10, '15 llamadas a la vez: el tope de 10 por minuto se cumple igual');
  const antesN = +(await sql('select coalesce(max(id), 0) as m from mesa.actividad'))[0].m;
  for (const [fn, args] of llamadas) { r = await N(fn, args); ok(!r.ok && es(r, 401), `la clave pública: ${fn} no llega (401)`, `${r.status} ${r.text}`); }
  ok(+(await sql('select coalesce(max(id), 0) as m from mesa.actividad'))[0].m === antesN, 'sin sesión no llega a la función y no deja fila');
  s = (await sql('select dispositivo, numero from mesa.turno where id'))[0];
  ok(s.dispositivo === DA && +s.numero === T && !(await fila('intruso')) && (await fila('k1')).valor.t === 'uno-c', 'el turno y los registros siguen como estaban');
  for (const [quien, tk] of [['Kevin', kk], ['la clienta', ka], ['la clave pública', null]]) {
    r = await pedir(`${P.url}/rest/v1/rpc/apuntar`, { method: 'POST', headers: { ...cab(P.publica, tk || undefined), 'Content-Type': 'application/json', 'Content-Profile': 'mesa' }, body: { p_tipo: 'intruso', p_disp: null, p_det: {} } });
    if (tk !== kk) ajeno.push(r.text);
    const r2 = await pedir(`${P.url}/rest/v1/rpc/apuntar`, { method: 'POST', headers: { ...cab(P.publica, tk || undefined), 'Content-Type': 'application/json' }, body: { p_tipo: 'intruso', p_disp: null, p_det: {} } });
    ok(!r.ok && !r2.ok && !(await cuantasAct(`tipo = 'intruso'`)), `${quien}: las funciones internas del esquema mesa no se llaman por REST (ni con Content-Profile: mesa)`, `${r.status} ${r2.status}`);
  }
  for (const [quien, tk] of [['Kevin', kk], ['la clienta', ka]]) {
    r = await pedir(`${P.url}/graphql/v1`, { method: 'POST', headers: { ...cab(P.publica, tk), 'Content-Type': 'application/json' }, body: { query: '{ __schema { types { name } } }' } });
    ok(!/registros|historial|actividad|dispositivos|ajustes/i.test(JSON.stringify(r.json || r.text)), `${quien}: /graphql/v1 no enseña tablas de mesa`, `${r.status} ${r.text.slice(0, 120)}`);
  }

  console.log('La actividad: Kevin la lee, nadie la cambia');
  const todas = await act('true');
  let leidas = [], dA = A0, pgs = 0;
  for (;;) { r = await K('mesa_actividad', { desde: dA, limite: 10 }); if (!bien(r)) break; pgs++; leidas.push(...r.json.filas); if (!r.json.mas) break; dA = r.json.hasta; }
  ok(bien(r) && pgs >= 2 && todas.every(y => leidas.some(z => +z.id === +y.id)) && leidas.every((z, i) => !i || +z.id > +leidas[i - 1].id) && r.json.epoca,
    `Kevin la lee por páginas (${pgs}), en orden y sin saltarse ninguna`, r.text);
  r = await K('mesa_actividad', { desde: A0, limite: 5000 }); ok(bien(r) && r.json.filas.length <= 500, 'como mucho 500 de golpe', bien(r) ? String(r.json.filas.length) : r.text);
  r = await K('mesa_actividad', { desde: -1 }); ok(rech(r, 'forma', 400), 'desde negativo: rechazo «forma»', r.text);
  ok(leidas.every(z => !JSON.stringify(z.detalle).includes(SECRETO) && !JSON.stringify(z.detalle).includes('uno-c')), 'ninguna fila lleva valores de registros');
  await sql(`select mesa.apuntar('prueba_recorte', '${DA}', jsonb_build_object('funcion', 'mesa_escribir', 'cuantos', 30, 'almacenes', jsonb_build_object('${ALM}', 30),
    'claves', (select jsonb_agg('${ALM}/' || repeat('k', 300) || g) from generate_series(1, 10) g)))`);
  a1 = await ultimaAct(`tipo = 'prueba_recorte'`);
  ok(a1 && a1.detalle.recortado === true && a1.detalle.claves.length === 5 && +a1.detalle.almacenes[ALM] === 30 && +a1.detalle.cuantos === 30,
    'un detalle de más de 2 KB guarda menos claves de muestra, sin perder almacenes ni cuántos', JSON.stringify(a1 && { n: a1.detalle.claves && a1.detalle.claves.length, alm: a1.detalle.almacenes }));
  for (const [q, txt] of [[`update mesa.actividad set tipo = 'cambiada' where id > ${A0}`, 'cambiarla'], [`delete from mesa.actividad where id > ${A0}`, 'borrarla'],
    ['begin; truncate mesa.actividad; rollback;', 'vaciarla']]) { const y = await sqlIntento(q); ok(!y.ok && /solo se añaden/.test(y.text), `ni el dueño de la base puede ${txt} (solo se añaden filas)`, y.text); }

  console.log('El portal en «Avisos» (D-278)');
  {
    const IPH = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const FFL = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
    const sinRastro = f => !/@/.test(JSON.stringify(f.detalle)) && !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(JSON.stringify(f.detalle));
    let l = await act(`tipo = 'portal_aparato_nuevo' and usuario = '${ua}'`);
    ok(l.length === 1 && l[0].detalle.primera === true && l[0].detalle.nombre === 'Ana Prueba' && (l[0].detalle.clientes || []).includes(CLI.nombre)
      && typeof l[0].detalle.aparato === 'string' && l[0].sesion && sinRastro(l[0]), 'la primera entrada de una clienta: su nombre, sus clientes y el aparato, sin correo ni IP', JSON.stringify(l));
    l = await act(`tipo = 'portal_no_miembro' and usuario = '${un}'`);
    ok(l.length >= 1 && l.every(x => x.detalle.aparato && sinRastro(x)), 'la entrada de una cuenta que no es de ningún cliente (una fila por entrada)', JSON.stringify(l));
    ok(await cuantasAct(`tipo like 'portal\_%' and usuario = '${uk}' and tipo <> 'portal_codigos'`) === 0, 'las entradas de Kevin no avisan aquí');
    await entrar(CORREO.a);
    ok(await cuantasAct(`tipo = 'portal_aparato_nuevo' and usuario = '${ua}'`) === 1, 'otra entrada con el mismo navegador no avisa');
    let e = await entrarCon(CORREO.a, IPH);
    l = await act(`tipo = 'portal_aparato_nuevo' and usuario = '${ua}'`);
    ok(e.ok && l.length === 2 && l[1].detalle.aparato === 'Safari · iPhone' && l[1].detalle.primera === false, 'desde un iPhone: «Safari · iPhone», aparato nuevo', JSON.stringify(l.map(x => x.detalle)));
    for (let i = 0; i < 5; i++) { const g = await pedirCodigo(CORREO.a); if (!g.ok) throw new Fallo('generate_link: ' + g.text); }
    l = await act(`tipo = 'portal_codigos' and usuario = '${ua}'`);
    ok(l.length === 1 && +l[0].detalle.n === 5 && l[0].detalle.nombre === 'Ana Prueba' && l[0].detalle.dueno === false && sinRastro(l[0]), '5 códigos pedidos en una hora para una clienta: un aviso', JSON.stringify(l.map(x => x.detalle)));
    for (let i = 0; i < 4; i++) await pedirCodigo(CORREO.a);
    ok(await cuantasAct(`tipo = 'portal_codigos' and usuario = '${ua}'`) === 1, 'y no otro hasta el décimo');
    await pedirCodigo(CORREO.a);
    l = await act(`tipo = 'portal_codigos' and usuario = '${ua}'`);
    ok(l.length === 2 && +l[1].detalle.n === 10, 'al décimo, otro', JSON.stringify(l.map(x => x.detalle)));
    for (let i = 0; i < 5; i++) await pedirCodigo(CORREO.k);
    l = await act(`tipo = 'portal_codigos' and usuario = '${uk}'`);
    ok(l.length === 1 && l[0].detalle.dueno === true, 'también avisa de los códigos pedidos para la cuenta de Kevin', JSON.stringify(l.map(x => x.detalle)));
    // un fallo dentro del disparador nunca para la entrada: queda apuntado
    await sql('alter table mesa.portal_aparatos rename to portal_aparatos_roto');
    try {
      e = await entrarCon(CORREO.a, FFL);
      ok(e.ok && e.json && e.json.access_token, 'con el registro roto, la clienta entra igual', e.text);
      l = await act(`tipo = 'portal_fallo' and usuario = '${ua}'`);
      ok(l.length === 1 && l[0].detalle.donde === 'entrada', 'y el fallo queda apuntado', JSON.stringify(l));
    } finally { await sql('alter table mesa.portal_aparatos_roto rename to portal_aparatos'); }
    const t = await sql(`select count(*)::int as n from pg_trigger where tgname in ('mesa_portal_sesion', 'mesa_portal_codigo') and not tgisinternal`);
    ok(+t[0].n === 2, 'los dos disparadores están puestos', JSON.stringify(t));
  }

  console.log('Nadie más que Kevin: esquema por REST');
  const g = await gestion(`projects/${P.ref}/postgrest`);   // su respuesta lleva secretos: solo se mira db_schema
  ok(g.ok && g.json && typeof g.json.db_schema === 'string' && !g.json.db_schema.split(',').map(v => v.trim()).includes('mesa') && g.json.jwt_secret === '[clave]',
    'el esquema mesa no está entre los de la API (y pedir tapa el jwt_secret de esa respuesta)', g.ok ? '' : String(g.status));
  for (const [quien, h, guardar] of [['la clienta', cab(P.publica, ka), true], ['la clave pública', cab(P.publica), true], ['la clave secreta', cab(S), false]])
    for (const t of ['registros', 'historial', 'turno', 'ajustes', 'actividad', 'dispositivos']) {
      r = await pedir(`${P.url}/rest/v1/${t}?select=*`, { headers: { ...h, 'Accept-Profile': 'mesa' } }); if (guardar) ajeno.push(r.text);
      ok(!r.ok, `${quien}: ${t} con Accept-Profile: mesa, no`, `${r.status} ${r.text}`);
      r = await pedir(`${P.url}/rest/v1/${t}?select=*`, { headers: h }); if (guardar) ajeno.push(r.text);
      ok(!r.ok, `${quien}: ${t} sin perfil, no`, `${r.status} ${r.text}`);
    }
  r = await pedir(`${P.url}/rest/v1/actividad`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Profile': 'mesa', 'Content-Type': 'application/json' }, body: { tipo: 'intruso' } });
  ajeno.push(r.text); ok(!r.ok && !(await cuantasAct(`tipo = 'intruso'`)), 'la clienta no escribe en actividad', `${r.status} ${r.text}`);

  console.log('Catálogo (solo lectura)');
  const fns = await sql(`select p.proname, p.prosecdef, coalesce(p.proconfig::text, '') as conf, coalesce(p.proacl::text, '') as acl, count(*) over (partition by p.proname) as firmas
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname like 'mesa\\_%'`);
  const siete = ['mesa_turno_ver', 'mesa_turno_pedir', 'mesa_turno_latido', 'mesa_turno_reclamar', 'mesa_turno_soltar', 'mesa_escribir', 'mesa_bajar', 'mesa_actividad'];   // ocho desde el esquema 3 (ver, lote 3)
  // y `mesa_yo`, de esquema.sql (D-262): quién eres para la Mesa y hasta cuándo vale tu código
  ok(fns.length === 9 && [...siete, 'mesa_yo'].every(f => fns.some(y => y.proname === f)) && fns.every(y => +y.firmas === 1), 'las 8 funciones mesa_* y mesa_yo, una sola firma cada una', JSON.stringify(fns.map(y => y.proname)));
  ok(fns.every(y => y.prosecdef && y.conf === '{"search_path=\\"\\""}'), "todas security definer con search_path=''", JSON.stringify(fns.map(y => y.conf)));
  ok(fns.every(y => !/(^|[{,])(anon)?=X/.test(y.acl) && /authenticated=X/.test(y.acl)), 'ninguna ejecutable por anon ni por PUBLIC; sí por authenticated', JSON.stringify(fns.map(y => y.acl)));
  const usos = await sql(`with roles(rol) as (values ('anon'), ('authenticated'), ('service_role'), ('authenticator')),
      t as (select c.oid, c.relname, c.relkind from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'mesa' and c.relkind in ('r', 'p', 'S'))
    select r.rol || ' usa el esquema' as x from roles r where has_schema_privilege(r.rol, 'mesa', 'usage')
    union all select r.rol || ' ' || t.relname || ' ' || p.p from roles r cross join t
      cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p(p)
      where t.relkind <> 'S' and has_table_privilege(r.rol, t.oid, p.p)
    union all select r.rol || ' ' || t.relname || ' ' || p.p from roles r cross join t cross join unnest(array['USAGE', 'SELECT', 'UPDATE']) p(p)
      where t.relkind = 'S' and has_sequence_privilege(r.rol, t.oid, p.p)`);
  ok(!usos.length, 'ningún rol de la API usa el esquema mesa ni tiene permisos en sus tablas', JSON.stringify(usos));
  const pols = await sql(`select policyname, permissive from pg_policies where schemaname = 'storage'`);
  ok(pols.every(y => /^(archivos|mesa)_/.test(y.policyname)) && !pols.some(y => y.policyname === 'mesa_borrar')
    && pols.some(y => y.policyname === 'mesa_solo_dueno' && y.permissive === 'RESTRICTIVE'), 'en storage solo políticas archivos_* y mesa_*, sin borrar en mesa y con la restrictiva', JSON.stringify(pols));
  ok(!(await sql(`select 1 from pg_publication_tables where schemaname = 'mesa'`)).length, 'nada de mesa en las publicaciones de Realtime');

  console.log('Almacén mesa');
  const SK = almacen(kk), SA = almacen(ka, true), SN = almacen(null, true);
  r = await SK('POST', `object/mesa/${RUTA}`, { tipo: 'image/jpeg', body: new Uint8Array(JPG) }); ok(r.ok, 'Kevin sube una foto por su huella', r.text);
  r = await SK('POST', `object/mesa/${RUTA}`, { tipo: 'image/jpeg', body: new Uint8Array(JPG) });
  ok(!r.ok && (es(r, 409) || /exist|duplicate/i.test(r.text)), 'subirla otra vez da «ya existe» (supa.subir lo cuenta como subida)', `${r.status} ${r.text}`);
  r = await SK('POST', `object/mesa/${RUTA}`, { tipo: 'image/jpeg', body: new Uint8Array(Buffer.from('otra cosa')), upsert: true }); ok(!r.ok, 'una ruta no se sobrescribe ni con x-upsert', `${r.status} ${r.text}`);
  r = await SK('POST', `object/mesa/${ALM}/foto-${RUN}.jpg`, { tipo: 'image/jpeg', body: new Uint8Array(JPG) }); ok(!r.ok, 'una ruta que no es una huella no entra', `${r.status} ${r.text}`);
  r = await SK('POST', `object/mesa/${sha('suelta' + RUN)}.jpg`, { tipo: 'image/jpeg', body: new Uint8Array(JPG) }); ok(!r.ok, 'ni una sin carpeta de almacén', `${r.status} ${r.text}`);
  r = await SK('POST', `object/mesa/${ALM}/${sha('texto' + RUN)}.pdf`, { tipo: 'text/plain', body: new Uint8Array(Buffer.from('hola')) }); ok(!r.ok, 'ni un tipo que no es foto ni PDF', `${r.status} ${r.text}`);
  r = await SK('GET', `object/authenticated/mesa/${RUTA}`); ok(r.ok, 'Kevin la lee', String(r.status));
  const listaK = async () => { const q = await SK('POST', 'object/list/mesa', { tipo: 'application/json', body: { prefix: ALM, limit: 100 } }); return q.ok && Array.isArray(q.json) ? q.json.map(y => `${ALM}/${y.name}`) : null; };
  ok(((await listaK()) || []).includes(RUTA), 'Kevin la ve al listar');
  r = await SK('DELETE', 'object/mesa', { tipo: 'application/json', body: { prefixes: [RUTA] } });
  ok(((await listaK()) || []).includes(RUTA), 'ni Kevin borra desde la Mesa (sin política de borrar: si hace falta, con la clave secreta)', `${r.status} ${r.text}`);
  const destino = `${ALM}/${sha('copia' + RUN)}.jpg`;
  for (const [quien, f, tk] of [['la clienta', SA, ka], ['la clave pública', SN, null]]) {
    const a = await f('GET', `object/authenticated/mesa/${RUTA}`), b = await f('GET', `object/authenticated/mesa/${NOHAY}`);
    ok(!a.ok && a.status === b.status && a.text === b.text, `${quien}: no la lee, y una ruta que existe y una que no dan la misma respuesta`, `${a.status} ${b.status}`);
    r = await f('GET', `object/public/mesa/${RUTA}`); ok(!r.ok, `${quien}: ni por la URL pública`, String(r.status));
    r = await f('POST', `object/sign/mesa/${RUTA}`, { tipo: 'application/json', body: { expiresIn: 60 } }); ok(!r.ok, `${quien}: ni la firma`, `${r.status} ${r.text}`);
    r = await f('POST', 'object/list/mesa', { tipo: 'application/json', body: { prefix: ALM, limit: 100 } }); ok(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `${quien}: al listar no ve nada`, r.text);
    r = await f('GET', 'bucket/mesa'); ok(!r.ok, `${quien}: ni el almacén`, `${r.status} ${r.text}`);
    r = await f('GET', 'bucket'); ok(!r.ok || !(r.json || []).some(y => y && y.id === 'mesa'), `${quien}: ni en la lista de almacenes`, r.text);
    r = await f('POST', `object/mesa/${ALM}/${sha('intruso' + RUN + quien)}.jpg`, { tipo: 'image/jpeg', body: new Uint8Array(JPG) }); ok(!r.ok, `${quien}: no sube`, `${r.status} ${r.text}`);
    r = await f('DELETE', 'object/mesa', { tipo: 'application/json', body: { prefixes: [RUTA] } });
    ok(((await listaK()) || []).includes(RUTA), `${quien}: no borra`, `${r.status} ${r.text}`);
    if (tk) { r = await pedir(`${P.url}/storage/v1/object/mesa/${RUTA}`, { method: 'PUT', headers: { ...cab(P.publica, tk), 'Content-Type': 'image/jpeg' }, body: new Uint8Array(JPG) }); ajeno.push(r.text); ok(!r.ok, `${quien}: no la cambia`, `${r.status} ${r.text}`); }
    for (const [nombre, metodo, ruta, cuerpo] of [
      ['copiarla', 'POST', 'object/copy', { bucketId: 'mesa', sourceKey: RUTA, destinationKey: destino }],
      ['copiarla a otro almacén', 'POST', 'object/copy', { bucketId: 'mesa', sourceKey: RUTA, destinationBucket: 'fotos', destinationKey: `${CLI.id}/${sha('fuera' + RUN)}.jpg` }],
      ['moverla', 'POST', 'object/move', { bucketId: 'mesa', sourceKey: RUTA, destinationKey: destino }],
      ['pedir una URL para subir', 'POST', `object/upload/sign/mesa/${destino}`, {}]]) {
      r = await f(metodo, ruta, { tipo: 'application/json', body: cuerpo }); ok(!r.ok, `${quien}: no puede ${nombre}`, `${r.status} ${r.text}`);
    }
    for (const ruta of [`object/info/mesa/${RUTA}`, `object/info/authenticated/mesa/${RUTA}`, `render/image/authenticated/mesa/${RUTA}`]) {
      r = await f('GET', ruta); ok(!r.ok, `${quien}: ${ruta.split('/mesa/')[0]}, no`, `${r.status} ${r.text}`);
    }
    const tus = await f('POST', 'upload/resumable', { h: { 'Tus-Resumable': '1.0.0', 'Upload-Length': String(JPG.length),
      'Upload-Metadata': `bucketName ${Buffer.from('mesa').toString('base64')},objectName ${Buffer.from(destino).toString('base64')},contentType ${Buffer.from('image/jpeg').toString('base64')}` } });
    let tusOk = tus.ok;
    if (tus.ok && tus.status === 201) {   // si deja empezar, que no deje terminar
      const loc = (await fetch(`${P.url}/storage/v1/upload/resumable`, { method: 'POST', headers: { ...cab(P.publica, tk || undefined), 'Tus-Resumable': '1.0.0', 'Upload-Length': String(JPG.length),
        'Upload-Metadata': `bucketName ${Buffer.from('mesa').toString('base64')},objectName ${Buffer.from(destino).toString('base64')}` } })).headers.get('location');
      const pt = loc ? await fetch(loc, { method: 'PATCH', headers: { ...cab(P.publica, tk || undefined), 'Tus-Resumable': '1.0.0', 'Upload-Offset': '0', 'Content-Type': 'application/offset+octet-stream' }, body: new Uint8Array(JPG) }) : { ok: false };
      tusOk = pt.ok;
    }
    ok(!tusOk && !((await listaK()) || []).includes(destino), `${quien}: tampoco sube por TUS (subida por partes)`, `${tus.status} ${tus.text}`);
  }
  ok(((await listaK()) || []).length === 1, 'y en el almacén sigue solo la de Kevin');

  console.log('La orden de la terminal');
  await servicio('miembros', { method: 'POST', body: { user_id: uk, cliente_id: CLI.id, nombre: 'Kevin Prueba' } });
  w = web('actividad', '1'); let wj = null; try { wj = JSON.parse(w.out); } catch (e) { /* */ }
  await servicio(`miembros?user_id=eq.${uk}`, { method: 'DELETE' });
  ok(w.ok && wj && wj.filas > 0 && wj.actividad.some(l => l.includes(' · ajeno · ana@mesa-pruebas.test')) && wj.actividad.some(l => l.includes(' · rechazo · kevin@mesa-pruebas.test (dueño)')),
    'tools/web.mjs actividad pruebas 1 enseña las filas con la hora de Madrid y quién (también el correo del dueño)', w.out.slice(0, 200));
  ok(wj && (wj.avisos || []).some(l => l.includes('además miembro') && l.includes('kevin@mesa-pruebas.test → ' + CLI.id)), 'y avisa si un dueño es además miembro de un cliente', JSON.stringify(wj && wj.avisos));
  ok(!w.out.includes(SECRETO), 'sin valores de registros');
  w = web('actividad', '91'); ok(!w.ok, 'y no acepta más de 90 días');
  let wr = null; try { execFileSync(process.execPath, [WEB, 'mesa', 'real'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { wr = String(e.stderr || ''); }
  ok(wr && /--si/.test(wr), 'tools/web.mjs mesa real no aplica nada sin --si');
  wr = null; try { execFileSync(process.execPath, [WEB, 'mesa-epoca', 'real'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { wr = String(e.stderr || ''); }
  ok(wr && /--si/.test(wr), 'ni mesa-epoca real');

  console.log('Rastros de Kevin en lo que reciben la clienta, quien no es nadie y la clave pública');
  const todo = ajeno.join('\n');
  for (const v of [PRE, SECRETO, 'uno-c', DA, DB, EPOCA]) ok(!todo.includes(v), `nada de «${v.length > 20 ? v.slice(0, 12) + '…' : v}»`);
}

main().catch(e => { fallos++; console.error(tapar(e instanceof Fallo ? e.message : (e.stack || e))); })
  .finally(async () => {
    await cerrar();
    console.log(fallos ? `\n${fallos} FALLO(S) de ${n}` : `\nTodo en orden: ${n} de ${n}`);
    process.exit(fallos ? 1 : 0);
  });
