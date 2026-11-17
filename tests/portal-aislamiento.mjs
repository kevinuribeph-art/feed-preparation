#!/usr/bin/env node
// Prueba de aislamiento del portal de clientes (lecciones 81 y 136). Node 18+, sin dependencias.
// Solo contra el proyecto de PRUEBAS de Supabase y con dos clientes inventados: nunca contra el real ni con datos reales.
//   node tests/portal-aislamiento.mjs
// Necesita en .env: SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA, SUPABASE_PRUEBAS_SECRETA, y el esquema aplicado
// (`node tools/web.mjs esquema pruebas`). Crea y borra sus propios clientes, usuarios y archivos.
import { createHash, randomBytes } from 'node:crypto';
import { proyecto, rest, cab, pedir, tapar, usuarioPorCorreo, Fallo } from '../tools/web.mjs';

const P = proyecto('pruebas');
if (!P.publica || !P.secreta) { console.error('faltan SUPABASE_PRUEBAS_PUBLICA o SUPABASE_PRUEBAS_SECRETA en .env'); process.exit(1); }
const S = P.secreta;
const sha = t => createHash('sha256').update(t).digest('hex');
const A = { id: 'prueba-norte', nombre: 'Cliente Prueba Norte', handle: 'prueba.norte' };
const B = { id: 'prueba-sur', nombre: 'Cliente Prueba Sur', handle: 'prueba.sur' };
const pid = t => sha(t).slice(0, 16);
const PA1 = pid('a1'), PA2 = pid('a2'), PB1 = pid('b1');
const VA1 = sha('va1'), VA1b = sha('va1-b'), VA2 = sha('va2'), VB1 = sha('vb1');
const CORREO = { a: 'ana@portal-pruebas.test', b: 'bea@portal-pruebas.test', k: 'kevin@portal-pruebas.test' };
const CLAVE = 'Pr-' + randomBytes(16).toString('hex'); // solo para estos usuarios inventados; no se imprime
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const FA = `prueba-norte/${sha('foto-a')}.jpg`, FB = `prueba-sur/${sha('foto-b')}.jpg`, PDFB = 'prueba-sur/f-b1.pdf';

let fallos = 0, n = 0;
const TK = {};
const ok = (c, txt, extra) => { n++; if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + tapar(extra).slice(0, 200) : '')); } };
const vistoComoA = []; // todo lo que recibe Ana, para buscar rastros de otro cliente

async function usuario(correo) {
  let u = await usuarioPorCorreo(P, correo);
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
async function firmar(tk, bucket, ruta) {
  const r = await pedir(`${P.url}/storage/v1/object/sign/${bucket}/${ruta}`, { method: 'POST', headers: { ...cab(P.publica, tk), 'Content-Type': 'application/json' }, body: { expiresIn: 60 } });
  if (tk === TK.a && ruta.startsWith(A.id + '/')) vistoComoA.push(r.text); // lo que Ana pide de Sur lo escribe ella: no cuenta
  return r;
}
async function limpiar() {
  await servicio(`clientes?id=in.(${A.id},${B.id})`, { method: 'DELETE' });
  for (const [b, rutas] of [['fotos', [FA, FB]], ['facturas', [PDFB]]])
    await pedir(`${P.url}/storage/v1/object/${b}`, { method: 'DELETE', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { prefixes: rutas } });
}

async function main() {
  console.log(`Prueba de aislamiento · proyecto de pruebas ${P.ref}`);
  await limpiar();
  const ua = await usuario(CORREO.a), ub = await usuario(CORREO.b), uk = await usuario(CORREO.k);
  const pub = (c, p, o) => ({ cliente_id: c, pid: p, mes: '2026-12', orden: o.orden, tipo: o.tipo || 'foto', nombre: o.nombre, fecha: '2026-12-10T12:00:00Z', caption: o.caption || '', imagenes: o.imagenes || [], estado: o.estado, version: o.version });
  const semillas = [
    ['clientes', [A, B]],
    ['miembros', [{ user_id: ua, cliente_id: A.id, nombre: 'Ana Norte' }, { user_id: ub, cliente_id: B.id, nombre: 'Bea Sur' }]],
    ['duenos?on_conflict=user_id', [{ user_id: uk }]],
    ['publicaciones', [pub(A.id, PA1, { orden: 0, nombre: 'Foto 1.1', estado: 'por_aprobar', version: VA1, imagenes: [{ ruta: FA }] }),
      pub(A.id, PA2, { orden: 1, nombre: 'Reel 1.2', tipo: 'reel', estado: 'programada', version: VA2 }),
      pub(B.id, PB1, { orden: 0, nombre: 'Foto Sur 1.1', estado: 'por_aprobar', version: VB1, caption: 'Texto de Prueba Sur', imagenes: [{ ruta: FB }] })]],
    ['pagos', [{ cliente_id: A.id, id: 'co-a1', periodo: '2026-11', importe_cent: 45000, pdf: null }, { cliente_id: B.id, id: 'co-b1', periodo: '2026-11', importe_cent: 99900, pdf: PDFB }]],
    ['meses', [{ cliente_id: A.id, mes: '2026-12', porque: { partes: [{ t: 'Horario', x: 'Norte' }] } }, { cliente_id: B.id, mes: '2026-12', porque: { partes: [{ t: 'Horario', x: 'Sur' }] } }]],
    ['sesiones', [{ cliente_id: B.id, id: 'ses-b1', mes: '2026-12', nombre: 'Rodaje Sur', inicio: '2026-12-12T09:00:00Z' }]],
  ];
  for (const [t, filas] of semillas) {
    const r = await servicio(t, { method: 'POST', body: filas, prefer: 'resolution=merge-duplicates' });
    if (!r.ok) throw new Fallo(`no se pudo sembrar ${t}: ${r.status} ${r.text}`);
  }
  await subir('fotos', FA, JPG, 'image/jpeg'); await subir('fotos', FB, JPG, 'image/jpeg'); await subir('facturas', PDFB, PDF, 'application/pdf');
  const kb = await entrar(CORREO.b);
  const rb = await rest(P, 'comentarios', { method: 'POST', token: kb, body: { cliente_id: B.id, pid: PB1, version: VB1, texto: 'Comentario de Prueba Sur' }, prefer: 'return=representation' });
  if (!rb.ok) throw new Fallo('no se pudo sembrar el comentario de Sur: ' + rb.text);

  const ka = await entrar(CORREO.a), kk = await entrar(CORREO.k);
  TK.a = ka;
  const a = como(ka, true), k = como(kk), b = como(kb);

  console.log('Leer');
  let r = await a('publicaciones?select=*');
  ok(r.ok && r.json.length === 2 && r.json.every(x => x.cliente_id === A.id), 'Ana ve solo sus 2 publicaciones', r.text);
  r = await a(`publicaciones?cliente_id=eq.${B.id}`); ok(r.ok && r.json.length === 0, 'pidiendo las de Sur por id, nada', r.text);
  for (const t of ['clientes', 'pagos', 'meses', 'sesiones', 'comentarios', 'aprobaciones']) {
    r = await a(`${t}?select=*`); ok(r.ok && r.json.every(x => (x.cliente_id || x.id) === A.id), `${t}: solo de su cliente`, r.text);
  }
  r = await a('miembros?select=*'); ok(r.ok && r.json.length === 1 && r.json[0].user_id === ua, 'miembros: solo su fila', r.text);
  r = await a('duenos?select=*'); ok(r.ok && r.json.length === 0, 'duenos: nada', r.text);
  r = await rest(P, 'publicaciones?select=*'); ok(!r.ok || (Array.isArray(r.json) && r.json.length === 0), 'sin entrar: nada', r.text);

  console.log('Archivos');
  r = await firmar(ka, 'fotos', FA); ok(r.ok && r.json && r.json.signedURL, 'Ana firma su foto', r.text);
  if (r.ok && r.json && r.json.signedURL) { const d = await fetch(P.url + '/storage/v1' + r.json.signedURL); ok(d.ok, 'la URL firmada abre su foto'); }
  r = await firmar(ka, 'fotos', FB); ok(!r.ok, 'Ana no firma la foto de Sur', r.text);
  r = await firmar(ka, 'facturas', PDFB); ok(!r.ok, 'Ana no firma la factura de Sur', r.text);
  r = await pedir(`${P.url}/storage/v1/object/authenticated/facturas/${PDFB}`, { headers: cab(P.publica, ka) }); ok(!r.ok, 'Ana no descarga la factura de Sur');
  r = await pedir(`${P.url}/storage/v1/object/fotos/${A.id}/intruso.jpg`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Type': 'image/jpeg' }, body: new Uint8Array(JPG) });
  ok(!r.ok, 'Ana no sube archivos', r.text);

  console.log('Escribir');
  const apr = (body, tk = ka) => rest(P, 'aprobaciones', { method: 'POST', token: tk, body, prefer: 'return=representation' });
  r = await apr({ cliente_id: B.id, pid: PB1, version: VB1, decision: 'aprobada' }); ok(!r.ok, 'Ana no aprueba una de Sur', r.text);
  r = await rest(P, 'comentarios', { method: 'POST', token: ka, body: { cliente_id: B.id, pid: PB1, version: VB1, texto: 'hola' } }); ok(!r.ok, 'Ana no comenta en una de Sur', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'aprobada', autor: ub, hora: '2020-01-01T00:00:00Z' }); ok(!r.ok, 'no se puede poner otro autor ni otra hora', r.text);
  r = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, texto: 'x', de_kevin: true } }); ok(!r.ok, 'no se puede firmar como Kevin', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1b, decision: 'aprobada' }); ok(!r.ok, 'una versión que no es la vigente no se aprueba', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'cambios' }); ok(!r.ok, '«Pedir cambios» sin motivo no entra', r.text);
  r = await apr({ cliente_id: A.id, pid: PA2, version: VA2, decision: 'aprobada' }); ok(!r.ok, 'una programada no se aprueba', r.text);
  const t0 = Date.now();
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'aprobada' });
  const fila = r.ok && r.json && r.json[0];
  ok(fila && fila.autor === ua && fila.autor_nombre === 'Ana Norte' && Math.abs(Date.parse(fila.hora) - t0) < 120000, 'Ana aprueba la suya, firmada con su nombre y la hora del servidor', r.text);
  r = await a(`publicaciones?pid=eq.${PA1}&select=estado`); ok(r.ok && r.json[0] && r.json[0].estado === 'aprobada', 'la publicación pasa a aprobada al momento', r.text);
  r = await k(`publicaciones?cliente_id=eq.${A.id}&pid=eq.${PA1}`, { method: 'PATCH', body: { estado: 'por_aprobar', version: VA1 }, prefer: 'return=representation' });
  ok(r.ok && r.json[0] && r.json[0].estado === 'aprobada', 'un envío de Kevin sin haberla leído no borra la aprobación', r.text);
  await a(`publicaciones?pid=eq.${PA1}`, { method: 'PATCH', body: { estado: 'publicada' } });
  r = await servicio(`publicaciones?pid=eq.${PA1}&select=estado`); ok(r.ok && r.json[0].estado === 'aprobada', 'Ana no cambia una publicación', r.text);
  r = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, diapositiva: 2, texto: '¿Podemos cambiar la foto?' }, prefer: 'return=representation' });
  const cm = r.ok && r.json && r.json[0];
  ok(cm && cm.autor_nombre === 'Ana Norte' && cm.de_kevin === false, 'Ana comenta en la suya', r.text);
  if (cm) {
    await a(`comentarios?id=eq.${cm.id}`, { method: 'PATCH', body: { resuelto: new Date().toISOString() } });
    await a(`comentarios?id=eq.${cm.id}`, { method: 'DELETE' });
    r = await servicio(`comentarios?id=eq.${cm.id}&select=resuelto`); ok(r.ok && r.json.length === 1 && r.json[0].resuelto === null, 'Ana no borra ni marca resuelto un comentario', r.text);
  }
  r = await b('comentarios?select=*'); ok(r.ok && r.json.every(x => x.cliente_id === B.id), 'Bea no ve los comentarios de Norte', r.text);

  console.log('Kevin');
  r = await k('publicaciones?select=cliente_id'); ok(r.ok && new Set(r.json.map(x => x.cliente_id)).size >= 2, 'Kevin ve los dos clientes', r.text);
  r = await k('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA1, version: VA1, texto: 'Hecho, mira la 2.' }, prefer: 'return=representation' });
  ok(r.ok && r.json[0].de_kevin === true && r.json[0].autor_nombre === 'Kevin · Uribe Visuals', 'Kevin contesta y sale como Kevin', r.text);
  if (cm) { r = await k(`comentarios?id=eq.${cm.id}`, { method: 'PATCH', body: { resuelto: new Date().toISOString() }, prefer: 'return=representation' }); ok(r.ok && r.json[0] && r.json[0].resuelto, 'Kevin marca resuelto', r.text); }
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'aprobada' }, kk); ok(!r.ok, 'Kevin no aprueba en nombre del cliente', r.text);

  console.log('Rastros de otro cliente en lo que recibe Ana');
  const todo = vistoComoA.join('\n');
  for (const s of [B.id, B.nombre, B.handle, PB1, VB1, 'Bea Sur', 'Rodaje Sur', 'Texto de Prueba Sur', 'co-b1'])
    ok(!todo.includes(s), `nada de «${s}»`);
}

main().catch(e => { fallos++; console.error(tapar(e instanceof Fallo ? e.message : (e.stack || e))); })
  .finally(async () => {
    try { await limpiar(); } catch (e) { console.error('limpieza: ' + tapar(e.message)); }
    console.log(fallos ? `\n${fallos} FALLO(S) de ${n}` : `\nTodo en orden: ${n} de ${n}`);
    process.exit(fallos ? 1 : 0);
  });
