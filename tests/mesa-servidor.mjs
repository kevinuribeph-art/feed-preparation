#!/usr/bin/env node
// Prueba del servidor de la Mesa (traspaso C, lote 2: servidor/mesa.sql; lecciones 89, 94, 120, 121, 136). Node 18+, sin
// dependencias. Solo contra el proyecto de PRUEBAS (se niega a correr contra el real), con usuarios inventados: un Kevin
// (dueño) y una clienta del portal. Comprueba el turno en dos fases, versiones y choques, la versión mínima, los topes del
// lote, el borrado blando, el historial y su poda, las páginas, el orden con lotes a la vez, el registro de actividad (lo que
// se rechaza deja su fila, solo se añaden filas, su poda de 90 días), que aplicar mesa.sql y esquema.sql otra vez no pierde
// nada y que nadie más que Kevin usa las funciones, el esquema `mesa` ni el almacén `mesa`. Al final, también si algo falla,
// borra sus filas, archivos, usuarios y su fila de dueño, y deja el turno y la versión mínima como estaban.
//   node tests/mesa-servidor.mjs
// Necesita en .env: SUPABASE_ACCESS_TOKEN, SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA y SUPABASE_PRUEBAS_SECRETA, y el
// esquema del portal aplicado (`node tools/web.mjs esquema pruebas`). Aplica él mismo `node tools/web.mjs mesa pruebas`.
// Un rechazo de una función `mesa_*` llega con HTTP 200 y `{ok: false, error: {codigo, http, mensaje}}` (así su fila de
// actividad no se deshace); solo la clave pública sin sesión recibe un error HTTP (401), sin fila.
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { proyecto, rest, cab, pedir, gestion, tapar, clave, usuarioPorCorreo, Fallo } from '../tools/web.mjs';

if (process.argv.slice(2).some(a => a !== 'pruebas')) { console.error('esta prueba solo corre contra el proyecto de pruebas'); process.exit(1); }
const P = proyecto('pruebas');
if (!P.publica || !P.secreta) { console.error('faltan las claves pública y secreta del proyecto de pruebas en .env'); process.exit(1); }
if (clave('SUPABASE_REF') === P.ref) { console.error('el proyecto de pruebas es el real: esta prueba no corre ahí'); process.exit(1); }

const S = P.secreta;
const WEB = fileURLToPath(new URL('../tools/web.mjs', import.meta.url));
const sha = t => createHash('sha256').update(t).digest('hex');
const RUN = randomBytes(4).toString('hex');
const PRE = `prueba-${RUN}-`;                         // las claves de esta pasada (todas las de prueba empiezan por «prueba-»)
const DA = 'prueba-a-' + RUN, DB = 'prueba-b-' + RUN;  // dos ordenadores inventados
const ALM = 'pruebas';                                 // un almacén inventado
const APP = '4.10';
const TOPE = { cambios: 500, valor: 2097152, lote: 4194304 };   // los de mesa_escribir
const CLI = { id: 'prueba-mesa', nombre: 'Cliente Prueba Mesa' };
const CORREO = { k: 'kevin@mesa-pruebas.test', a: 'ana@mesa-pruebas.test' };
const CLAVE = 'Pr-' + randomBytes(16).toString('hex'); // solo para estos usuarios inventados; no se imprime
const JPG = Buffer.concat([Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'), Buffer.from(RUN)]);
const RUTA = `${ALM}/${sha(JPG)}.jpg`;                 // por huella, como la Mesa
const SECRETO = 'secreto-' + RUN;                      // un valor de Kevin que nadie más debe ver

let fallos = 0, n = 0;
const ok = (c, txt, extra) => { n++; if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + tapar(extra).slice(0, 240) : '')); } };
const es = (r, ...codigos) => codigos.includes(r.status);
const bien = r => r.ok && r.json && r.json.ok === true;
const rech = (r, codigo, http) => r.ok && r.json && r.json.ok === false && r.json.error && r.json.error.codigo === codigo && r.json.error.http === http;
const espera = ms => new Promise(f => setTimeout(f, ms));
const ajeno = [];   // todo lo que reciben la clienta y la clave pública, para buscar rastros de Kevin

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
  const r = await pedir(`${P.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { ...cab(P.publica), 'Content-Type': 'application/json' }, body: { email: correo, password: CLAVE } });
  if (!r.ok) throw new Fallo('no se pudo entrar como ' + correo + ': ' + r.text);
  return r.json.access_token;
}
const servicio = (ruta, o = {}) => rest(P, ruta, { ...o, apikey: S });
const rpcDe = (tk, guardar) => async (fn, args) => { const r = await rest(P, 'rpc/' + fn, { method: 'POST', token: tk || undefined, body: args || {} }); if (guardar) ajeno.push(r.text); return r; };
const almacen = (tk, guardar) => async (metodo, ruta, o = {}) => {
  const h = { ...cab(P.publica, tk || undefined) };
  if (o.tipo) h['Content-Type'] = o.tipo;
  if (o.upsert) h['x-upsert'] = 'true';
  const r = await pedir(`${P.url}/storage/v1/${ruta}`, { method: metodo, headers: h, body: o.body });
  if (guardar) ajeno.push(r.text);
  return r;
};
const contador = async () => +(await sql('select orden from mesa.turno where id'))[0].orden;
const fila = async c => (await sql(`select version, orden, valor, borrado from mesa.registros where almacen = '${ALM}' and clave = '${PRE}${c}'`))[0] || null;
const porClave = r => Object.fromEntries(((r.json && r.json.resultados) || []).map(x => [x.clave.slice(PRE.length), x]));
const cambio = (c, base, valor) => ({ almacen: ALM, clave: PRE + c, base, valor });
let A0 = 0;   // la actividad de antes de esta pasada no cuenta
const act = cond => sql(`select id, tipo, usuario, dispositivo, detalle from mesa.actividad where id > ${A0} and ${cond} order by id`);
const ultimaAct = async cond => (await act(cond)).pop() || null;

// Lo inventado de cualquier pasada (también de una que se cortó): filas, historial, actividad, ordenadores, archivos,
// clienta, usuarios y su dueño. La actividad solo se borra con la misma llave que su poda (`mesa.poda`).
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
}
// El turno y la versión mínima como estaban (el contador de orden no vuelve atrás: nunca se repite un número).
let FOTO = null;
async function restaurar() {
  if (!FOTO) return;
  const t = { ...FOTO.t };
  if (/^prueba-/.test(t.dispositivo || '')) Object.assign(t, { dispositivo: null, desde: null, latido: null, cola: null, cola_desde: null });
  if (/^prueba-/.test(t.pide || '')) Object.assign(t, { pide: null, pide_desde: null, pide_ultima: null });
  await sql(`update mesa.turno x set (numero, dispositivo, desde, latido, cola, cola_desde, pide, pide_desde, pide_ultima) =
    (select s.numero, s.dispositivo, s.desde, s.latido, s.cola, s.cola_desde, s.pide, s.pide_desde, s.pide_ultima
       from jsonb_populate_record(null::mesa.turno, '${JSON.stringify(t).replace(/'/g, "''")}'::jsonb) s) where x.id`);
  if (/^[0-9]{1,4}\.[0-9]{1,4}$/.test(FOTO.v)) await sql(`update mesa.ajustes set version_minima = '${FOTO.v}' where id`);
}

async function main() {
  console.log(`Servidor de la Mesa · proyecto de pruebas ${P.ref}`);
  let w = web('mesa');
  ok(w.ok, 'tools/web.mjs mesa pruebas aplica servidor/mesa.sql', w.out);
  if (!w.ok) throw new Fallo('sin mesa.sql no hay nada que probar');
  FOTO = (await sql(`select to_jsonb(t) - 'orden' as t, (select version_minima from mesa.ajustes where id) as v from mesa.turno t where id`))[0];
  await limpiarDatos();
  A0 = +(await sql('select coalesce(max(id), 0) as m from mesa.actividad'))[0].m;
  const uk = await usuario(CORREO.k), ua = await usuario(CORREO.a);
  for (const [t, filas] of [['clientes', [CLI]], ['miembros', [{ user_id: ua, cliente_id: CLI.id, nombre: 'Ana Prueba' }]], ['duenos?on_conflict=user_id', [{ user_id: uk }]]]) {
    const r = await servicio(t, { method: 'POST', body: filas, prefer: 'resolution=merge-duplicates' });
    if (!r.ok) throw new Fallo(`no se pudo sembrar ${t}: ${r.status} ${r.text}`);
  }
  const kk = await entrar(CORREO.k), ka = await entrar(CORREO.a);
  const K = rpcDe(kk), A = rpcDe(ka, true), N = rpcDe(null, true);
  const esc = (d, t, cambios, app = APP, reescanear) => K('mesa_escribir', { dispositivo: d, turno: t, app, cambios, ...(reescanear === undefined ? {} : { reescanear }) });
  w = web('mesa-version', APP); ok(w.ok && /"ahora": "4\.10"/.test(w.out), 'tools/web.mjs mesa-version pone la mínima', w.out);

  console.log('Turno en dos fases');
  let r = await K('mesa_turno_pedir', { dispositivo: DA, app: APP });
  const t0 = r.json && r.json.turno;
  ok(bien(r) && Number.isInteger(t0) && Math.abs(Date.parse(r.json.hora) - Date.now()) < 120000, 'pedir dice el turno y la hora del servidor', r.text);
  r = await K('mesa_turno_reclamar', { dispositivo: DA, visto: t0, app: APP });
  const n1 = r.json && r.json.turno;
  ok(bien(r) && r.json.tuyo && n1 === t0 + 1, 'A la reclama con el número que vio y el número sube', r.text);
  r = await esc(DA, n1, [cambio('k1', null, { t: 'uno' }), cambio('k2', null, { t: 'dos' }), cambio('k3', null, { t: 'tres', s: SECRETO })]);
  ok(bien(r) && Object.values(porClave(r)).every(x => x.estado === 'ok' && x.version === 1), 'A escribe tres registros nuevos (versión 1)', r.text);
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
  ok(bien(r) && r.json.tuyo && r.json.pide && r.json.pide.dispositivo === DB && r.json.tiene.cola === 3 && r.json.tiene.cola_desde && r.json.tiene.latido_hace <= 5,
    'el latido de A ve la petición de B y apunta su cola con la hora del servidor', r.text);
  const colaDesde = r.json && r.json.tiene && r.json.tiene.cola_desde;
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: n1, app: APP, cola: 1 });
  ok(bien(r) && r.json.tiene.cola === 1 && r.json.tiene.cola_desde === colaDesde, 'con cola sin vaciar, «desde» sigue siendo el del primer latido con cola', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: n1, app: APP, cola: 0 });
  ok(bien(r) && r.json.tiene.cola === 0 && r.json.tiene.cola_desde === null, 'con la cola vacía, sin «desde»', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DB, turno: n1, app: APP, cola: 0 }); ok(rech(r, 'turno', 423), 'B no late con un turno que no tiene: rechazo «turno» (423)', r.text);
  r = await K('mesa_turno_soltar', { dispositivo: DB, turno: n1 }); ok(rech(r, 'turno', 423), 'B no suelta lo que no tiene', r.text);
  r = await esc(DB, n1, [cambio('k9', null, 1)]); ok(rech(r, 'turno', 423) && r.json.error.turno === n1 && !(await fila('k9')), 'B no escribe sin tenerla: rechazo «turno» y nada escrito', r.text);
  let a1 = await ultimaAct(`tipo = 'rechazo' and dispositivo = '${DB}' and detalle ->> 'funcion' = 'mesa_escribir'`);
  ok(a1 && a1.detalle.codigo === 'turno' && a1.detalle.http === 423 && a1.usuario === uk, 'y ese lote rechazado deja su fila en actividad (código, quién, qué ordenador)', JSON.stringify(a1));
  r = await K('mesa_turno_soltar', { dispositivo: DA, turno: n1 }); ok(bien(r) && r.json.libre && r.json.turno === n1, 'A la suelta: queda libre con el mismo número', r.text);
  r = await esc(DA, n1, [cambio('k4', null, 1)]); ok(rech(r, 'turno', 423) && !(await fila('k4')), 'después de soltarla, A ya no escribe', r.text);
  r = await K('mesa_turno_reclamar', { dispositivo: DB, visto: n1 - 1, app: APP }); ok(rech(r, 'turno_cambiado', 409) && r.json.error.turno === n1, 'reclamarla con un número viejo: «turno_cambiado» (409)', r.text);
  r = await K('mesa_turno_reclamar', { dispositivo: DB, visto: n1, app: APP });
  const n2 = r.json && r.json.turno;
  ok(bien(r) && r.json.tuyo && n2 === n1 + 1 && r.json.pide === null && r.json.orden >= 3, 'B la reclama: el número sube, su petición se borra y dice hasta dónde bajar', r.text);
  r = await esc(DA, n1, [cambio('k4', null, 1)]); ok(rech(r, 'turno', 423) && !(await fila('k4')), 'la escritura del turno viejo se rechaza entera', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: n1, app: APP, cola: 2 }); ok(rech(r, 'turno', 423), 'y su latido también: así sabe que la ha perdido', r.text);
  r = await K('mesa_turno_pedir', { dispositivo: DA, app: APP });
  r = await K('mesa_turno_reclamar', { dispositivo: DA, visto: r.json.turno, app: APP });
  const T = r.json && r.json.turno;
  ok(bien(r) && T === n2 + 1, 'si B no contesta, A puede reclamarla igual', r.text);
  r = await esc(DB, n2, [cambio('k5', null, 1)]); ok(rech(r, 'turno', 423) && !(await fila('k5')), 'y desde ese momento B ya no escribe', r.text);
  r = await K('mesa_turno_reclamar', { dispositivo: DA, visto: T, app: APP }); ok(bien(r) && r.json.turno === T && r.json.tuyo, 'reclamar la que ya se tiene no cambia el número', r.text);
  const nuevos = await act(`tipo = 'dispositivo_nuevo' and dispositivo in ('${DA}', '${DB}')`);
  ok(nuevos.length === 2 && nuevos[0].dispositivo === DA && nuevos[1].dispositivo === DB && nuevos[1].detalle.antes === null,
    'cada ordenador que la reclama por primera vez deja una fila «dispositivo_nuevo»; volver a reclamarla, no', JSON.stringify(nuevos.map(x => x.dispositivo)));
  s = (await sql(`select count(*) as n from mesa.dispositivos where dispositivo in ('${DA}', '${DB}')`))[0];
  ok(+s.n === 2, 'y quedan en mesa.dispositivos (no dependen del historial ni de ninguna poda)');

  console.log('Versiones y choques');
  r = await esc(DA, T, [cambio('k1', 1, { t: 'uno-b' }), cambio('k2', 0, { t: 'dos-b' }), cambio('k3', 1, { t: 'tres-b', s: SECRETO })]);
  let x = porClave(r);
  ok(bien(r) && x.k1.estado === 'ok' && x.k1.version === 2 && x.k3.estado === 'ok' && x.k3.version === 2, 'los cambios sobre la última versión entran (versión 2)', r.text);
  ok(x.k2 && x.k2.estado === 'choque' && x.k2.ultima === 1 && x.k2.borrado === false, 'uno con base vieja choca solo y dice cuál es la última', r.text);
  ok(((await fila('k2')) || {}).valor?.t === 'dos', 'y no se escribe');
  a1 = await ultimaAct(`tipo = 'choque' and detalle ->> 'clave' = '${PRE}k2'`);
  ok(a1 && a1.dispositivo === DA && +a1.detalle.base === 0 && +a1.detalle.ultima === 1 && a1.detalle.almacen === ALM && !JSON.stringify(a1.detalle).includes('dos-b'),
    'el choque deja su fila (almacén, clave, base, última; nunca el valor)', JSON.stringify(a1));
  r = await esc(DA, T, [cambio('k1', null, { t: 'otro' })]); x = porClave(r);
  ok(bien(r) && x.k1.estado === 'choque' && x.k1.ultima === 2, 'un registro «nuevo» choca si ya hay uno vivo', r.text);
  r = await esc(DA, T, [cambio('k6', 7, { t: 'seis' })]); x = porClave(r);
  ok(bien(r) && x.k6.estado === 'choque' && x.k6.ultima === 0 && !(await fila('k6')), 'una base sobre un registro que no existe choca (última 0)', r.text);
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
  r = await K('mesa_turno_reclamar', { dispositivo: DB, visto: T, app: '4.9' }); ok(rech(r, 'app', 426) && (await sql('select dispositivo from mesa.turno where id'))[0].dispositivo === DA, 'ni la reclama', r.text);
  r = await K('mesa_turno_latido', { dispositivo: DA, turno: T, app: '4.9', cola: 0 }); ok(rech(r, 'app', 426), 'ni late (así sabe que tiene que recargar)', r.text);
  r = await esc(DA, T, [cambio('k7', 1, 2)], '4.x'); ok(rech(r, 'forma', 400), 'una versión de app mal escrita: rechazo «forma» (400)', r.text);
  w = web('mesa-version', '4,11'); ok(!w.ok, 'mesa-version no acepta «4,11»');

  console.log('Lotes mal formados (fuera enteros)');
  r = await esc(DA, T, [cambio('k8', null, 1), { almacen: ALM, clave: PRE + 'k8b', base: null }]); ok(rech(r, 'forma', 400) && r.json.error.indice === 2 && !(await fila('k8')), 'un cambio sin «valor» no se toma por borrado: «forma», dice cuál, y nada escrito', r.text);
  r = await esc(DA, T, [cambio('k8', null, 1), cambio('k8', null, 2)]); ok(rech(r, 'forma', 400) && !(await fila('k8')), 'un registro repetido en el lote', r.text);
  r = await esc(DA, T, [cambio('k8', null, 1), { almacen: 'Mal!', clave: PRE + 'x', base: null, valor: 1 }]); ok(rech(r, 'forma', 400) && !(await fila('k8')), 'un almacén mal escrito', r.text);
  r = await esc(DA, T, [cambio('k8', -1, 1)]); ok(rech(r, 'forma', 400), 'una base negativa', r.text);
  r = await esc(DA, T, []); ok(rech(r, 'forma', 400), 'un lote vacío', r.text);
  s = await act(`tipo = 'rechazo' and detalle ->> 'codigo' = 'forma' and detalle ->> 'funcion' = 'mesa_escribir'`);
  ok(s.length >= 6, 'cada lote mal formado deja su fila', String(s.length));

  console.log(`Topes del lote: ${TOPE.cambios} cambios, 2 MB por valor, 4 MB el lote`);
  r = await esc(DA, T, Array.from({ length: TOPE.cambios + 1 }, (_, i) => cambio('m' + i, null, i)));
  ok(rech(r, 'tope', 413) && r.json.error.tope === 'cambios' && r.json.error.maximo === TOPE.cambios && r.json.error.tiene === TOPE.cambios + 1 && !(await fila('m0')),
    `${TOPE.cambios + 1} cambios: rechazo «tope» (413) que dice cuál, el máximo y lo que trae`, r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'tope' = 'cambios'`); ok(a1 && +a1.detalle.tiene === TOPE.cambios + 1, 'y su fila', JSON.stringify(a1));
  r = await esc(DA, T, [cambio('v1', null, 'x'.repeat(TOPE.valor))]);
  ok(rech(r, 'tope', 413) && r.json.error.tope === 'valor' && r.json.error.clave === PRE + 'v1' && !(await fila('v1')), 'un valor de más de 2 MB: «tope» con su almacén y su clave', r.text);
  a1 = await ultimaAct(`tipo = 'rechazo' and detalle ->> 'tope' = 'valor'`);
  ok(a1 && a1.detalle.clave === PRE + 'v1' && octet_length(a1.detalle) < 2048, 'y su fila, corta y sin el valor', JSON.stringify(a1).slice(0, 200));
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
  ok(bien(r) && r.json.resultados.every(y => y.estado === 'ok' && y.version === 2) && msMax2 < 8000,
    `y pisándolos todos, con su historial (${msMax2} ms)`, r.text);

  console.log('Borrado blando');
  r = await esc(DA, T, [cambio('k3', 2, null)]); x = porClave(r);
  ok(bien(r) && x.k3.estado === 'ok' && x.k3.version === 3, 'borrar es escribir un valor nulo: versión nueva', r.text);
  r = await K('mesa_bajar', { desde: x.k3.orden - 1, limite: 1 });
  const b3 = bien(r) && r.json.filas[0];
  ok(b3 && b3.clave === PRE + 'k3' && b3.borrado === true && b3.valor === null && b3.version === 3, 'baja como borrado (valor nulo)', r.text);
  const h3 = await sql(`select valor from mesa.historial where almacen = '${ALM}' and clave = '${PRE}k3' order by id desc limit 1`);
  ok(h3[0] && h3[0].valor.t === 'tres-b', 'y su último valor queda en el historial');
  r = await esc(DA, T, [cambio('k3', 3, null)]); ok(bien(r) && porClave(r).k3.estado === 'igual', 'borrar lo ya borrado: «igual»', r.text);
  r = await esc(DA, T, [cambio('k9', null, null)]); ok(bien(r) && porClave(r).k9.estado === 'igual' && !(await fila('k9')), 'borrar lo que nunca existió: «igual», sin lápida', r.text);
  r = await esc(DA, T, [cambio('k3', null, { t: 'tres-c' })]); ok(bien(r) && porClave(r).k3.version === 4, 'sobre una lápida se vuelve a crear (base nula o la suya)', r.text);

  console.log('Borrados masivos');
  const masivos = async () => (await act(`tipo = 'borrado_masivo' and dispositivo = '${DA}'`)).length;
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
  ok(hs.length === 1 && hs[0].valor.v === 1, 'cuatro escrituras seguidas: una sola versión anterior (la primera)', JSON.stringify(hs));
  await sql(`update mesa.historial set guardada = guardada - interval '6 minutes' where clave = '${PRE}${H}'`);
  r = await esc(DA, T, [cambio(H, 4, { v: 5 })]);
  hs = await sql(`select valor from mesa.historial where clave = '${PRE}${H}' order by id`);
  ok(hs.length === 2 && hs[1].valor.v === 4, 'pasados 5 minutos, la siguiente guarda otra', JSON.stringify(hs));
  await sql(`insert into mesa.historial (almacen, clave, valor, version, orden, app, dispositivo, hora, guardada) values
    ('${ALM}', '${PRE}viejo', '{}', 1, 1, '4.10', '${DA}', now() - interval '31 days', now() - interval '31 days'),
    ('${ALM}', '${PRE}reciente', '{}', 1, 1, '4.10', '${DA}', now() - interval '29 days', now() - interval '29 days');
    insert into mesa.actividad (hora, tipo, dispositivo, detalle) values
    (now() - interval '91 days', 'prueba_vieja', '${DA}', '{}'), (now() - interval '89 days', 'prueba_reciente', '${DA}', '{}');`);
  r = await esc(DA, T, [cambio(H, 5, { v: 6 })]);
  hs = await sql(`select clave from mesa.historial where clave in ('${PRE}viejo', '${PRE}reciente')`);
  ok(bien(r) && hs.length === 1 && hs[0].clave === PRE + 'reciente', 'la escritura poda el historial de más de 30 días y deja el de 29', JSON.stringify(hs));
  hs = await sql(`select tipo from mesa.actividad where dispositivo = '${DA}' and tipo like 'prueba_%'`);
  ok(hs.length === 1 && hs[0].tipo === 'prueba_reciente', 'y la actividad de más de 90 días, dejando la de 89', JSON.stringify(hs));

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
    if (r.json.filas.length && r.json.hasta !== prev) mal++;
    if (!r.json.mas) break;
    desde = r.json.hasta;
  }
  const pv = [...vistas].filter(([k]) => k.startsWith(PRE + 'p'));
  ok(!mal && paginas >= 3 && maxPag <= 500 && pv.length === NP && pv.every(([, v]) => v === 1), `1.150 registros en ${paginas} páginas de 500 como mucho: ninguno saltado ni repetido`, `mal ${mal}, vistas ${pv.length}`);
  r = await K('mesa_bajar', { desde: c0, limite: 2000 }); ok(bien(r) && r.json.filas.length === 500 && r.json.mas, 'pedir 2.000 de golpe da 500 y dice que hay más', bien(r) ? String(r.json.filas.length) : r.text);
  r = await K('mesa_bajar', { desde: await contador() }); ok(bien(r) && r.json.filas.length === 0 && r.json.mas === false && r.json.hasta === r.json.orden, 'desde el último: nada, sin más', r.text);
  r = await K('mesa_bajar', { desde: -1 }); ok(rech(r, 'forma', 400), 'desde negativo: rechazo «forma»', r.text);
  const grande = i => ({ g: i, x: String(i).repeat(1500000) });
  const cg = await contador();
  for (const i of [1, 2, 3]) { r = await esc(DA, T, [cambio('g' + i, null, grande(i))]); if (!bien(r)) break; }
  ok(bien(r), 'tres valores de 1,5 MB, uno por lote', r.text);
  r = await K('mesa_bajar', { desde: cg });
  const g1 = bien(r) && r.json.filas;
  ok(g1 && g1.length === 2 && r.json.mas && g1.every(f => f.valor.x.length === 1500000), 'una página lleva unos 4 MB como mucho: dos y «hay más»', bien(r) ? String(g1.length) : r.text);
  r = bien(r) ? await K('mesa_bajar', { desde: r.json.hasta }) : r;
  ok(bien(r) && r.json.filas.length === 1 && r.json.filas[0].valor.g === 3 && !r.json.mas, 'y la siguiente, la tercera', r.text);

  console.log('Lotes a la vez');
  const c1 = await contador();
  const lotes = Array.from({ length: 8 }, (_, j) => Array.from({ length: 40 }, (_, i) => cambio(`c${j}-${i}`, null, { j, i })));
  let fin = false, cursor = c1, desorden = 0, paginasC = 0, errorLector = null; const vc = new Map();
  const lector = (async () => {
    for (;;) {
      const ultima = fin;
      const q = await K('mesa_bajar', { desde: cursor, limite: 25 });
      if (!bien(q)) { errorLector = q.text; return; }
      paginasC++;
      for (const f of q.json.filas) { if (f.orden <= cursor) desorden++; cursor = f.orden; vc.set(f.clave, (vc.get(f.clave) || 0) + 1); }
      if (ultima && !q.json.mas) return;
    }
  })();
  const res = await Promise.all(lotes.map(l => esc(DA, T, l)));
  fin = true; await lector;
  const rangos = res.map(q => (q.json && q.json.resultados || []).map(y => y.orden)).map(o => [Math.min(...o), Math.max(...o), o.length]).sort((a, b) => a[0] - b[0]);
  ok(res.every(q => bien(q) && q.json.resultados.every(y => y.estado === 'ok')), '8 lotes de 40 lanzados a la vez entran todos', res.map(q => q.status).join(','));
  ok(rangos.every((g, i) => g[1] - g[0] === g[2] - 1 && (!i || g[0] > rangos[i - 1][1])), 'cada lote con sus números seguidos y sin mezclarse con otro');
  const cv = [...vc].filter(([k]) => k.startsWith(PRE + 'c'));
  ok(!errorLector && !desorden && cv.length === 320 && cv.every(([, v]) => v === 1), `quien baja mientras tanto (${paginasC} páginas) nunca ve un número menor después de uno mayor ni se salta ninguno`, errorLector || `desorden ${desorden}, vistos ${cv.length}`);

  console.log('Aplicar otra vez, con datos dentro');
  const huella = async () => JSON.stringify(await sql(`select (select count(*) from mesa.registros where clave like '${PRE}%') as n,
    (select sum(version) from mesa.registros where clave like '${PRE}%') as v, (select max(orden) from mesa.registros where clave like '${PRE}%') as o,
    (select md5(string_agg(clave || ':' || version || ':' || coalesce(valor::text, '-'), ',' order by clave)) from mesa.registros where clave like '${PRE}%') as m,
    (select count(*) from mesa.historial where clave like '${PRE}%') as h, (select numero || ':' || dispositivo from mesa.turno where id) as t,
    (select version_minima from mesa.ajustes where id) as vm, (select count(*) || ':' || max(id) from mesa.actividad where id > ${A0}) as a,
    (select count(*) from mesa.dispositivos where dispositivo like 'prueba-%') as d`));
  const antes = await huella();
  const w1 = web('mesa'), w2 = web('esquema'), w3 = web('mesa');
  ok(w1.ok && w2.ok && w3.ok, 'mesa.sql, esquema.sql y mesa.sql otra vez: entran', [w1, w2, w3].filter(v => !v.ok).map(v => v.out).join(' | '));
  ok((await huella()) === antes, 'registros, versiones, historial, turno, mínima, actividad y ordenadores siguen igual', antes);
  r = await esc(DA, T, [cambio('k2', 1, { t: 'dos-c' })]); ok(bien(r) && porClave(r).k2.version === 2, 'y las funciones siguen escribiendo', r.text);

  console.log('Nadie más que Kevin: funciones');
  const llamadas = [
    ['mesa_turno_pedir', { dispositivo: DB, app: APP }],
    ['mesa_turno_latido', { dispositivo: DA, turno: T, app: APP, cola: 0 }],
    ['mesa_turno_reclamar', { dispositivo: DB, visto: T, app: APP }],
    ['mesa_turno_soltar', { dispositivo: DA, turno: T }],
    ['mesa_escribir', { dispositivo: DA, turno: T, app: APP, cambios: [cambio('intruso', null, 1), cambio('k1', 3, { t: 'pisado' })] }],
    ['mesa_bajar', { desde: 0 }],
    ['mesa_actividad', { desde: 0 }],
  ];
  const ajenoDeAna = async () => (await act(`tipo = 'ajeno' and usuario = '${ua}'`)).length;
  for (const [fn, args] of llamadas) {
    r = await A(fn, args);
    ok(rech(r, 'permiso', 403) && Object.keys(r.json).length === 2 && Object.keys(r.json.error).length === 3, `la clienta: ${fn} da «permiso» (403) y nada más`, `${r.status} ${r.text}`);
  }
  s = await act(`tipo = 'ajeno' and usuario = '${ua}'`);
  ok(s.length === llamadas.length && llamadas.every(([fn]) => s.some(y => y.detalle.funcion === fn)), 'y cada una de sus llamadas queda apuntada («ajeno», con la función)', JSON.stringify(s.map(y => y.detalle.funcion)));
  for (let i = 0; i < 6; i++) await A('mesa_bajar', { desde: 0 });
  ok((await ajenoDeAna()) === 10, 'pero como mucho 10 filas por minuto y usuario: no puede llenar la tabla');
  for (const [fn, args] of llamadas) { r = await N(fn, args); ok(!r.ok && es(r, 401), `la clave pública: ${fn} no llega (401)`, `${r.status} ${r.text}`); }
  ok(!(await act(`tipo = 'ajeno' and usuario is null`)).length, 'sin sesión no llega a la función y no deja fila');
  s = (await sql('select dispositivo, numero, pide from mesa.turno where id'))[0];
  ok(s.dispositivo === DA && +s.numero === T && !(await fila('intruso')) && (await fila('k1')).valor.t === 'uno-c', 'el turno y los registros siguen como estaban');

  console.log('La actividad: Kevin la lee, nadie la cambia');
  const todas = await act('true');
  let leidas = [], dA = A0, pags = 0;
  for (;;) { r = await K('mesa_actividad', { desde: dA, limite: 10 }); if (!bien(r)) break; pags++; leidas.push(...r.json.filas); if (!r.json.mas) break; dA = r.json.hasta; }
  ok(bien(r) && pags >= 2 && leidas.length >= todas.length && todas.every(y => leidas.some(z => +z.id === +y.id)) && leidas.every((z, i) => !i || +z.id > +leidas[i - 1].id),
    `Kevin la lee por páginas (${pags}), en orden y sin saltarse ninguna`, r.text);
  r = await K('mesa_actividad', { desde: A0, limite: 5000 }); ok(bien(r) && r.json.filas.length <= 500, 'como mucho 500 de golpe', bien(r) ? String(r.json.filas.length) : r.text);
  r = await K('mesa_actividad', { desde: -1 }); ok(rech(r, 'forma', 400), 'desde negativo: rechazo «forma»', r.text);
  ok(leidas.every(z => !JSON.stringify(z.detalle).includes(SECRETO) && !JSON.stringify(z.detalle).includes('uno-c')), 'ninguna fila lleva valores de registros');
  for (const [q, txt] of [[`update mesa.actividad set tipo = 'cambiada' where id > ${A0}`, 'cambiarla'], [`delete from mesa.actividad where id > ${A0}`, 'borrarla'],
    ['begin; truncate mesa.actividad; rollback;', 'vaciarla']]) { const y = await sqlIntento(q); ok(!y.ok && /solo se añaden/.test(y.text), `ni el dueño de la base puede ${txt} (solo se añaden filas)`, y.text); }

  console.log('Nadie más que Kevin: esquema por REST');
  const g = await gestion(`projects/${P.ref}/postgrest`);   // su respuesta lleva secretos: solo se mira db_schema
  ok(g.ok && g.json && typeof g.json.db_schema === 'string' && !g.json.db_schema.split(',').map(v => v.trim()).includes('mesa'), 'el esquema mesa no está entre los de la API', g.ok ? '' : String(g.status));
  for (const [quien, h, guardar] of [['la clienta', cab(P.publica, ka), true], ['la clave pública', cab(P.publica), true], ['la clave secreta', cab(S), false]])
    for (const t of ['registros', 'historial', 'turno', 'ajustes', 'actividad', 'dispositivos']) {
      r = await pedir(`${P.url}/rest/v1/${t}?select=*`, { headers: { ...h, 'Accept-Profile': 'mesa' } }); if (guardar) ajeno.push(r.text);
      ok(!r.ok, `${quien}: ${t} con Accept-Profile: mesa, no`, `${r.status} ${r.text}`);
      r = await pedir(`${P.url}/rest/v1/${t}?select=*`, { headers: h }); if (guardar) ajeno.push(r.text);
      ok(!r.ok, `${quien}: ${t} sin perfil, no`, `${r.status} ${r.text}`);
    }
  r = await pedir(`${P.url}/rest/v1/actividad`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Profile': 'mesa', 'Content-Type': 'application/json' }, body: { tipo: 'intruso' } });
  ajeno.push(r.text); ok(!r.ok && !(await act(`tipo = 'intruso'`)).length, 'la clienta no escribe en actividad', `${r.status} ${r.text}`);

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
  for (const [quien, f, tk] of [['la clienta', SA, ka], ['la clave pública', SN, null]]) {
    r = await f('GET', `object/authenticated/mesa/${RUTA}`); ok(!r.ok, `${quien}: no la lee`, String(r.status));
    r = await f('GET', `object/public/mesa/${RUTA}`); ok(!r.ok, `${quien}: ni por la URL pública`, String(r.status));
    r = await f('POST', `object/sign/mesa/${RUTA}`, { tipo: 'application/json', body: { expiresIn: 60 } }); ok(!r.ok, `${quien}: ni la firma`, `${r.status} ${r.text}`);
    r = await f('POST', 'object/list/mesa', { tipo: 'application/json', body: { prefix: ALM, limit: 100 } }); ok(!r.ok || (Array.isArray(r.json) && r.json.length === 0), `${quien}: al listar no ve nada`, r.text);
    r = await f('GET', 'bucket/mesa'); ok(!r.ok, `${quien}: ni el almacén`, `${r.status} ${r.text}`);
    r = await f('GET', 'bucket'); ok(!r.ok || !(r.json || []).some(b => b && b.id === 'mesa'), `${quien}: ni en la lista de almacenes`, r.text);
    r = await f('POST', `object/mesa/${ALM}/${sha('intruso' + RUN + quien)}.jpg`, { tipo: 'image/jpeg', body: new Uint8Array(JPG) }); ok(!r.ok, `${quien}: no sube`, `${r.status} ${r.text}`);
    r = await f('DELETE', 'object/mesa', { tipo: 'application/json', body: { prefixes: [RUTA] } });
    ok(((await listaK()) || []).includes(RUTA), `${quien}: no borra`, `${r.status} ${r.text}`);
    if (tk) { r = await pedir(`${P.url}/storage/v1/object/mesa/${RUTA}`, { method: 'PUT', headers: { ...cab(P.publica, tk), 'Content-Type': 'image/jpeg' }, body: new Uint8Array(JPG) }); ajeno.push(r.text); ok(!r.ok, `${quien}: no la cambia`, `${r.status} ${r.text}`); }
  }
  r = await SK('DELETE', 'object/mesa', { tipo: 'application/json', body: { prefixes: [RUTA] } });
  ok(r.ok && !((await listaK()) || [RUTA]).includes(RUTA), 'Kevin la borra', r.text);

  console.log('La orden de la terminal');
  w = web('actividad', '1'); let wj = null; try { wj = JSON.parse(w.out); } catch (e) { /* */ }
  ok(w.ok && wj && wj.filas > 0 && wj.actividad.some(l => l.includes(' · ajeno · ana@mesa-pruebas.test')) && wj.actividad.some(l => l.includes(' · rechazo · Kevin')),
    'tools/web.mjs actividad pruebas 1 enseña las filas con la hora de Madrid y quién', w.out.slice(0, 200));
  ok(!w.out.includes(SECRETO), 'sin valores de registros');
  w = web('actividad', '91'); ok(!w.ok, 'y no acepta más de 90 días');

  console.log('Rastros de Kevin en lo que reciben la clienta y la clave pública');
  const todo = ajeno.join('\n');
  for (const v of [PRE, SECRETO, 'uno-c', DA, DB]) ok(!todo.includes(v), `nada de «${v.length > 20 ? v.slice(0, 12) + '…' : v}»`);
}
const octet_length = o => Buffer.byteLength(JSON.stringify(o));

main().catch(e => { fallos++; console.error(tapar(e instanceof Fallo ? e.message : (e.stack || e))); })
  .finally(async () => {
    try { await limpiarDatos(); } catch (e) { fallos++; console.error('limpieza: ' + tapar(e.message)); }
    try { await restaurar(); } catch (e) { fallos++; console.error('restaurar el turno y la mínima: ' + tapar(e.message)); }
    console.log(fallos ? `\n${fallos} FALLO(S) de ${n}` : `\nTodo en orden: ${n} de ${n}`);
    process.exit(fallos ? 1 : 0);
  });
