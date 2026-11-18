#!/usr/bin/env node
// Prueba de aislamiento del portal de clientes (lecciones 81 y 136). Node 18+, sin dependencias.
// Contra el proyecto de PRUEBAS de Supabase y con dos clientes inventados. Contra el real solo antes de dar de alta a ningún
// cliente (se niega si ya hay alguno), para comprobar el proyecto recién montado (lote 5).
//   node tests/portal-aislamiento.mjs [real]
// Necesita en .env: SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA, SUPABASE_PRUEBAS_SECRETA; el esquema y la función
// aplicados (`node tools/web.mjs esquema pruebas`, `node tools/web.mjs funciones pruebas`). Crea y borra sus propios
// clientes, usuarios y archivos (también la fila de dueño de su Kevin inventado).
import { createHash, randomBytes } from 'node:crypto';
import { proyecto, rest, cab, pedir, tapar, usuarioPorCorreo, Fallo } from '../tools/web.mjs';

const P = proyecto(process.argv[2] === 'real' ? 'real' : 'pruebas');
if (!P.publica || !P.secreta) { console.error(`faltan las claves pública y secreta del proyecto ${P.cual} en .env`); process.exit(1); }
if (P.cual === 'real') {
  const r = await rest(P, 'clientes?select=id&limit=1', { apikey: P.secreta });
  if (!r.ok || (r.json || []).length) { console.error(r.ok ? 'el proyecto real ya tiene clientes: esta prueba solo se pasa antes de dar de alta a nadie' : 'no se pudo leer el proyecto real: ' + r.status); process.exit(1); }
}
const S = P.secreta;
const sha = t => createHash('sha256').update(t).digest('hex');
const A = { id: 'prueba-norte', nombre: 'Cliente Prueba Norte', handle: 'prueba.norte' };
const B = { id: 'prueba-sur', nombre: 'Cliente Prueba Sur', handle: 'prueba.sur' };
const BORRADO = 'prueba-borrada';
const pid = t => sha(t).slice(0, 16);
const PA1 = pid('a1'), PA2 = pid('a2'), PA3 = pid('a3'), PAH = pid('a-oculta'), PB1 = pid('b1'), PNADA = pid('no-existe');
const VA1 = sha('va1'), VA1b = sha('va1-b'), VA2 = sha('va2'), VA3 = sha('va3'), VAH = sha('vah'), VB1 = sha('vb1');
const CORREO = { a: 'ana@portal-pruebas.test', b: 'bea@portal-pruebas.test', k: 'kevin@portal-pruebas.test' };
const CLAVE = 'Pr-' + randomBytes(16).toString('hex'); // solo para estos usuarios inventados; no se imprime
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const FA = `prueba-norte/${sha('foto-a')}.jpg`, FAH = `prueba-norte/${sha('foto-oculta')}.jpg`, FB = `prueba-sur/${sha('foto-b')}.jpg`, PDFB = 'prueba-sur/f-b1.pdf';
// Columnas que un usuario puede leer (las demás no tienen permiso: `return=representation` las pide todas si no se dicen).
const C_PUB = 'cliente_id,pid,mes,orden,tipo,nombre,fecha,sin_hora,caption,imagenes,estado,version,visible,enviada';
const C_APR = 'id,cliente_id,pid,version,decision,motivo,diapositiva,autor_nombre,hora';
const C_COM = 'id,cliente_id,pid,version,diapositiva,texto,autor_nombre,de_kevin,hora,resuelto';

let fallos = 0, n = 0;
const ok = (c, txt, extra) => { n++; if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + tapar(extra).slice(0, 200) : '')); } };
const es = (r, ...codigos) => codigos.includes(r.status);
const vistoComoA = []; // todo lo que recibe Ana de lo que pide de lo suyo, para buscar rastros de otro cliente

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
const como = (tk, guardar) => async (ruta, o = {}) => { const r = await rest(P, ruta, { ...o, token: tk }); if (guardar) vistoComoA.push(r.text); return r; };
const servicio = (ruta, o = {}) => rest(P, ruta, { ...o, apikey: S });
async function subir(bucket, ruta, bytes, tipo) {
  const r = await pedir(`${P.url}/storage/v1/object/${bucket}/${ruta}`, { method: 'POST', headers: { ...cab(S), 'Content-Type': tipo, 'x-upsert': 'true' }, body: new Uint8Array(bytes) });
  if (!r.ok) throw new Fallo(`no se pudo subir ${bucket}/${ruta}: ${r.text}`);
}
const firmarFn = (tk, bucket, rutas) => pedir(`${P.url}/functions/v1/firmar`, { method: 'POST', headers: { ...cab(P.publica, tk || undefined), 'Content-Type': 'application/json' }, body: { bucket, rutas } });
async function limpiar() {
  await servicio(`clientes?id=in.(${A.id},${B.id},${BORRADO})`, { method: 'DELETE' });
  await servicio(`clientes_borrados?id=in.(${A.id},${B.id},${BORRADO})`, { method: 'DELETE' });   // la reserva de los inventados
  for (const [b, rutas] of [['fotos', [FA, FAH, FB]], ['facturas', [PDFB]]])
    await pedir(`${P.url}/storage/v1/object/${b}`, { method: 'DELETE', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { prefixes: rutas } });
  for (const c of Object.values(CORREO)) {
    const u = await usuarioPorCorreo(P, c).catch(() => null);
    if (u) { await servicio(`duenos?user_id=eq.${u.id}`, { method: 'DELETE' }); await pedir(`${P.url}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: cab(S) }); }
  }
}

async function main() {
  console.log(`Prueba de aislamiento · proyecto de pruebas ${P.ref}`);
  await limpiar();
  const ua = await usuario(CORREO.a), ub = await usuario(CORREO.b), uk = await usuario(CORREO.k);
  const pub = (c, p, o) => ({ cliente_id: c, pid: p, mes: '2026-12', orden: o.orden, tipo: o.tipo || 'foto', nombre: o.nombre, fecha: '2026-12-10T12:00:00Z', caption: o.caption || '', imagenes: o.imagenes || [], estado: o.estado, version: o.version, visible: o.visible !== false });
  const semillas = [
    ['clientes', [A, B]],
    ['miembros', [{ user_id: ua, cliente_id: A.id, nombre: 'Ana Norte' }, { user_id: ub, cliente_id: B.id, nombre: 'Bea Sur' }]],
    ['duenos?on_conflict=user_id', [{ user_id: uk }]],
    ['publicaciones', [pub(A.id, PA1, { orden: 0, nombre: 'Foto 1.1', estado: 'por_aprobar', version: VA1, imagenes: [{ ruta: FA }] }),
      pub(A.id, PA2, { orden: 1, nombre: 'Reel 1.2', tipo: 'reel', estado: 'programada', version: VA2 }),
      pub(A.id, PA3, { orden: 2, nombre: 'Foto 1.3', estado: 'preparando', version: VA3 }),
      pub(A.id, PAH, { orden: 999, nombre: 'Foto oculta', estado: 'por_aprobar', version: VAH, imagenes: [{ ruta: FAH }] }),
      pub(B.id, PB1, { orden: 0, nombre: 'Foto Sur 1.1', estado: 'por_aprobar', version: VB1, caption: 'Texto de Prueba Sur', imagenes: [{ ruta: FB }] })]],
    ['pagos', [{ cliente_id: A.id, id: 'co-a1', periodo: '2026-11', importe_cent: 45000, pdf: null }, { cliente_id: B.id, id: 'co-b1', periodo: '2026-11', importe_cent: 99900, pdf: PDFB }]],
    ['meses', [{ cliente_id: A.id, mes: '2026-12', porque: { partes: [{ t: 'Horario', x: 'Norte' }] } }, { cliente_id: B.id, mes: '2026-12', porque: { partes: [{ t: 'Horario', x: 'Sur' }] } }]],
    ['sesiones', [{ cliente_id: B.id, id: 'ses-b1', mes: '2026-12', nombre: 'Rodaje Sur', inicio: '2026-12-12T09:00:00Z' }]],
  ];
  for (const [t, filas] of semillas) {
    const r = await servicio(t, { method: 'POST', body: filas, prefer: 'resolution=merge-duplicates' });
    if (!r.ok) throw new Fallo(`no se pudo sembrar ${t}: ${r.status} ${r.text}`);
  }
  for (const [b, ruta, bytes, tipo] of [['fotos', FA, JPG, 'image/jpeg'], ['fotos', FAH, JPG, 'image/jpeg'], ['fotos', FB, JPG, 'image/jpeg'], ['facturas', PDFB, PDF, 'application/pdf']]) await subir(b, ruta, bytes, tipo);
  const kb = await entrar(CORREO.b), ka = await entrar(CORREO.a), kk = await entrar(CORREO.k);
  const sem = async (tk, body) => { const r = await rest(P, 'comentarios', { method: 'POST', token: tk, body }); if (!r.ok) throw new Fallo('no se pudo sembrar un comentario: ' + r.text); };
  await sem(kb, { cliente_id: B.id, pid: PB1, version: VB1, texto: 'Comentario de Prueba Sur' });
  await sem(ka, { cliente_id: A.id, pid: PAH, version: VAH, texto: 'Comentario en la oculta' });
  await servicio('publicaciones?pid=eq.' + PAH, { method: 'PATCH', body: { visible: false } });   // después, deja de verse
  const a = como(ka, true), k = como(kk), b = como(kb);

  console.log('Leer');
  let r = await a(`publicaciones?select=${C_PUB}`);
  ok(r.ok && r.json.length === 3 && r.json.every(x => x.cliente_id === A.id), 'Ana ve solo sus 3 publicaciones visibles', r.text);
  r = await a(`publicaciones?select=${C_PUB}&cliente_id=eq.${B.id}`); ok(r.ok && r.json.length === 0, 'pidiendo las de Sur por id, nada', r.text);
  r = await a(`publicaciones?select=${C_PUB}&pid=eq.${PAH}`); ok(r.ok && r.json.length === 0, 'una oculta no se ve', r.text);
  r = await a('publicaciones?select=vistas_hasta'); ok(es(r, 400, 401, 403), 'la marca de lo leído de Kevin no está en la publicación', r.text);
  r = await a('comentarios?select=autor'); ok(es(r, 401, 403), 'el uuid del autor no se lee', r.text);
  for (const t of ['clientes', 'pagos', 'meses', 'sesiones']) {
    r = await a(`${t}?select=*`); ok(r.ok && r.json.every(x => (x.cliente_id || x.id) === A.id), `${t}: solo de su cliente`, r.text);
  }
  r = await a(`comentarios?select=${C_COM}`); ok(r.ok && r.json.every(x => x.cliente_id === A.id && x.pid !== PAH), 'comentarios: solo de lo que ve (ni de Sur ni de la oculta)', r.text);
  r = await a(`aprobaciones?select=${C_APR}`); ok(r.ok && r.json.every(x => x.cliente_id === A.id), 'aprobaciones: solo de su cliente', r.text);
  r = await a('miembros?select=*'); ok(r.ok && r.json.length === 1 && r.json[0].user_id === ua, 'miembros: solo su fila', r.text);
  r = await a('duenos?select=*'); ok(r.ok && r.json.length === 0, 'duenos: nada', r.text);
  r = await a('lecturas', { method: 'POST', body: { cliente_id: A.id, visto_hasta: new Date().toISOString() } }); ok(es(r, 401, 403), 'Ana no escribe «leído» (es de Kevin)', r.text);
  r = await rest(P, `publicaciones?select=${C_PUB}`); ok(es(r, 401, 403) || (r.ok && r.json.length === 0), 'sin entrar: nada', r.text);

  console.log('Archivos');
  r = await firmarFn(ka, 'fotos', [FA, FB, FAH]);
  const urls = (r.ok && r.json && r.json.urls) || {};
  ok(r.ok && urls[FA] && !urls[FB] && !urls[FAH], 'la función firma su foto y no la de Sur ni la de una oculta', r.text);
  if (urls[FA]) {
    const d = await fetch(urls[FA]); ok(d.ok, 'la URL firmada abre su foto');
    let exp = 0; try { exp = JSON.parse(Buffer.from(urls[FA].split('token=')[1].split('.')[1], 'base64url')).exp; } catch (e) { /* formato desconocido */ }
    ok(exp && exp - Date.now() / 1000 <= 610, 'y caduca en 10 minutos como mucho', String(exp));
  }
  r = await firmarFn(ka, 'facturas', [PDFB]); ok(r.ok && !Object.keys((r.json && r.json.urls) || {}).length, 'la función no firma la factura de Sur', r.text);
  r = await firmarFn('', 'fotos', [FA]); ok(es(r, 401), 'la función sin sesión: 401', r.text);
  r = await pedir(`${P.url}/storage/v1/object/sign/fotos/${FA}`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Type': 'application/json' }, body: { expiresIn: 315360000 } });
  ok(!r.ok, 'Ana no firma directamente en el almacén (ni la suya, ni a 10 años)', r.text);
  r = await pedir(`${P.url}/storage/v1/object/list/fotos`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Type': 'application/json' }, body: { prefix: A.id, limit: 100 } });
  ok(!r.ok || (Array.isArray(r.json) && r.json.length === 0), 'Ana no lista su carpeta', r.text);
  r = await pedir(`${P.url}/storage/v1/object/authenticated/facturas/${PDFB}`, { headers: cab(P.publica, ka) }); ok(!r.ok, 'Ana no descarga la factura de Sur');
  r = await pedir(`${P.url}/storage/v1/object/fotos/${A.id}/intruso.jpg`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Type': 'image/jpeg' }, body: new Uint8Array(JPG) });
  ok(!r.ok, 'Ana no sube archivos', r.text);

  console.log('Escribir');
  const apr = (body, tk = ka) => rest(P, `aprobaciones?select=${C_APR}`, { method: 'POST', token: tk, body, prefer: 'return=representation' });
  const t0 = Date.now();
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1b, decision: 'aprobada' });
  ok(es(r, 409) && Date.now() - t0 < 5000, 'una versión que no es la vigente: 409 al momento (no se cuelga)', `${r.status} en ${Date.now() - t0} ms · ${r.text}`);
  r = await apr({ cliente_id: B.id, pid: PB1, version: VB1, decision: 'aprobada' }); ok(es(r, 403), 'Ana no aprueba una de Sur: 403', r.text);
  r = await apr({ cliente_id: B.id, pid: PNADA, version: VB1, decision: 'aprobada' }); ok(es(r, 403), 'ni una que no existe en Sur: el mismo 403', r.text);
  r = await apr({ cliente_id: A.id, pid: PNADA, version: VA1, decision: 'aprobada' }); ok(es(r, 404), 'una suya que no existe: 404', r.text);
  r = await rest(P, 'comentarios', { method: 'POST', token: ka, body: { cliente_id: B.id, pid: PB1, version: VB1, texto: 'hola' } }); ok(es(r, 403), 'Ana no comenta en una de Sur: 403', r.text);
  r = await rest(P, 'comentarios', { method: 'POST', token: ka, body: { cliente_id: A.id, pid: PAH, version: VAH, texto: 'hola' } }); ok(es(r, 403, 404), 'ni en una oculta suya', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'aprobada', autor: ub, hora: '2020-01-01T00:00:00Z' }); ok(es(r, 401, 403), 'no se puede poner otro autor ni otra hora', r.text);
  r = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, texto: 'x', de_kevin: true } }); ok(es(r, 401, 403), 'no se puede firmar como Kevin', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'cambios' }); ok(es(r, 400), '«Pedir cambios» sin motivo no entra', r.text);
  r = await apr({ cliente_id: A.id, pid: PA2, version: VA2, decision: 'aprobada' }); ok(es(r, 409), 'una programada no se aprueba: 409', r.text);
  r = await apr({ cliente_id: A.id, pid: PA3, version: VA3, decision: 'retirada' }); ok(es(r, 409), '«retirar» no abre una que no espera decisión', r.text);
  r = await apr({ cliente_id: A.id, pid: PA3, version: VA3, decision: 'aprobada' }); ok(es(r, 409), 'una en preparación no se aprueba', r.text);
  const t1 = Date.now();
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'aprobada' });
  const fila = r.ok && r.json && r.json[0];
  ok(fila && fila.autor_nombre === 'Ana Norte' && Math.abs(Date.parse(fila.hora) - t1) < 120000, 'Ana aprueba la suya, firmada con su nombre y la hora del servidor', r.text);
  r = await a(`publicaciones?pid=eq.${PA1}&select=estado`); ok(r.ok && r.json[0] && r.json[0].estado === 'aprobada', 'la publicación pasa a aprobada al momento', r.text);
  r = await k(`publicaciones?cliente_id=eq.${A.id}&pid=eq.${PA1}&select=estado`, { method: 'PATCH', body: { estado: 'por_aprobar', version: VA1 }, prefer: 'return=representation' });
  ok(r.ok && r.json[0] && r.json[0].estado === 'aprobada', 'un envío de Kevin sin haberla leído no borra la aprobación', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'retirada' }); ok(r.ok, 'Ana retira su decisión', r.text);
  r = await a(`publicaciones?pid=eq.${PA1}&select=estado`); ok(r.ok && r.json[0].estado === 'por_aprobar', 'y vuelve a esperar su decisión', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'cambios', motivo: 'Cambia la foto, por favor', diapositiva: 1 }); ok(r.ok && r.json[0].motivo, 'Ana pide cambios con motivo', r.text);
  await a(`publicaciones?pid=eq.${PA1}`, { method: 'PATCH', body: { estado: 'publicada' } });
  r = await servicio(`publicaciones?pid=eq.${PA1}&select=estado`); ok(r.ok && r.json[0].estado === 'cambios', 'Ana no cambia una publicación', r.text);
  r = await a(`comentarios?select=${C_COM}`, { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, diapositiva: 2, texto: '¿Podemos cambiar la foto?' }, prefer: 'return=representation' });
  const cm = r.ok && r.json && r.json[0];
  ok(cm && cm.autor_nombre === 'Ana Norte' && cm.de_kevin === false, 'Ana comenta en la suya', r.text);
  if (cm) {
    await a(`comentarios?id=eq.${cm.id}`, { method: 'PATCH', body: { resuelto: new Date().toISOString() } });
    await a(`comentarios?id=eq.${cm.id}`, { method: 'DELETE' });
    r = await servicio(`comentarios?id=eq.${cm.id}&select=resuelto`); ok(r.ok && r.json.length === 1 && r.json[0].resuelto === null, 'Ana no borra ni marca resuelto un comentario', r.text);
  }
  r = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, texto: 'x'.repeat(2001) } }); ok(es(r, 400), 'un comentario de más de 2.000 caracteres no entra', r.text);
  r = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, texto: ' '.repeat(300000) + 'x' } }); ok(!r.ok, 'ni uno de 300.000 espacios y una letra', String(r.status));
  let tope = null;
  for (let i = 0; i < 22 && !tope; i++) { const q = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, texto: 'seguido ' + i } }); if (!q.ok) tope = q; }
  ok(tope && es(tope, 429), 'más de 20 comentarios en un minuto: 429', tope && tope.text);
  r = await b(`comentarios?select=${C_COM}`); ok(r.ok && r.json.every(x => x.cliente_id === B.id), 'Bea no ve los comentarios de Norte', r.text);

  console.log('Kevin');
  r = await k('publicaciones?select=cliente_id'); ok(r.ok && new Set(r.json.map(x => x.cliente_id)).size >= 2, 'Kevin ve los dos clientes', r.text);
  r = await k(`comentarios?select=${C_COM}`, { method: 'POST', body: { cliente_id: B.id, pid: PB1, version: VB1, texto: 'Hecho, mira la 2.' }, prefer: 'return=representation' });
  ok(r.ok && r.json[0].de_kevin === true && r.json[0].autor_nombre === 'Kevin · Uribe Visuals', 'Kevin contesta y sale como Kevin', r.text);
  const cid = r.ok && r.json[0] && r.json[0].id;
  if (cid) { r = await k(`comentarios?id=eq.${cid}&select=id,resuelto`, { method: 'PATCH', body: { resuelto: new Date().toISOString() }, prefer: 'return=representation' }); ok(r.ok && r.json[0] && r.json[0].resuelto, 'Kevin marca resuelto', r.text); }
  r = await apr({ cliente_id: B.id, pid: PB1, version: VB1, decision: 'aprobada' }, kk); ok(es(r, 403), 'Kevin no aprueba en nombre del cliente', r.text);
  r = await k(`publicaciones?cliente_id=eq.${A.id}&pid=eq.${PA1}`, { method: 'DELETE' }); ok(!r.ok, 'borrar una publicación con decisiones no se lleva su historial', r.text);
  await servicio('clientes', { method: 'POST', body: { id: BORRADO, nombre: 'Cliente Prueba Borrado' } });
  r = await k(`clientes?id=eq.${BORRADO}`, { method: 'DELETE' }); ok(!r.ok, 'Kevin no borra un cliente desde la página (se borra con tools/web.mjs)', r.text);
  r = await k(`clientes?id=eq.${BORRADO}`, { method: 'PATCH', body: { id: 'prueba-otro-id' } }); ok(es(r, 409), 'el id de un cliente no se cambia', r.text);
  await servicio(`clientes?id=eq.${BORRADO}`, { method: 'DELETE' });
  r = await servicio('clientes', { method: 'POST', body: { id: BORRADO, nombre: 'Otro con el mismo id' } }); ok(es(r, 409), 'un id de cliente borrado (por cualquier vía) no se vuelve a usar', r.text);
  r = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA3, version: sha('nunca'), texto: 'versión inventada' } }); ok(es(r, 409), 'un comentario sobre una versión que no es la vigente: 409', r.text);
  r = await firmarFn(ka, '__proto__', [FA]); ok(es(r, 400), 'la función no acepta un bucket raro', r.text);
  r = await firmarFn(ka, 'fotos', Array.from({ length: 101 }, () => FA)); ok(es(r, 413), 'ni más de 100 rutas', r.text);
  r = await pedir(`${P.url}/functions/v1/firmar`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Type': 'application/json' }, body: 'null' }); ok(es(r, 400), 'ni un cuerpo vacío', r.text);
  const prev = await fetch(`${P.url}/functions/v1/firmar`, { method: 'OPTIONS', headers: { Origin: 'https://malo.example', 'Access-Control-Request-Method': 'POST' } });
  ok(!prev.headers.get('access-control-allow-origin'), 'la función no abre CORS a otro origen', prev.headers.get('access-control-allow-origin'));
  const prev2 = await fetch(`${P.url}/functions/v1/firmar`, { method: 'OPTIONS', headers: { Origin: 'https://clientes.uribevisuals.studio', 'Access-Control-Request-Method': 'POST' } });
  ok(prev2.headers.get('access-control-allow-origin') === 'https://clientes.uribevisuals.studio', 'y sí al portal', prev2.headers.get('access-control-allow-origin'));

  console.log('Rastros de otro cliente en lo que recibe Ana');
  const todo = vistoComoA.join('\n');
  for (const s of [B.id, B.nombre, B.handle, PB1, VB1, 'Bea Sur', 'Rodaje Sur', 'Texto de Prueba Sur', 'co-b1', 'Comentario en la oculta', ub, uk])
    ok(!todo.includes(s), `nada de «${s.length > 20 ? s.slice(0, 8) + '…' : s}»`);
}

main().catch(e => { fallos++; console.error(tapar(e instanceof Fallo ? e.message : (e.stack || e))); })
  .finally(async () => {
    try { await limpiar(); } catch (e) { console.error('limpieza: ' + tapar(e.message)); }
    console.log(fallos ? `\n${fallos} FALLO(S) de ${n}` : `\nTodo en orden: ${n} de ${n}`);
    process.exit(fallos ? 1 : 0);
  });
