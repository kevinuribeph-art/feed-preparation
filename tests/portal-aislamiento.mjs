#!/usr/bin/env node
// Prueba de aislamiento del portal de clientes (lecciones 81 y 136). Node 18+, sin dependencias.
// Contra el proyecto de PRUEBAS de Supabase y con dos clientes inventados. Contra el real solo antes de dar de alta a ningún
// cliente (se niega si ya hay alguno), para comprobar el proyecto recién montado (lote 5).
//   node tests/portal-aislamiento.mjs [real]
// Necesita en .env: SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA, SUPABASE_PRUEBAS_SECRETA; el esquema y la función
// aplicados (`node tools/web.mjs esquema pruebas`, `node tools/web.mjs funciones pruebas`). Crea y borra sus propios
// clientes, usuarios y archivos (también la fila de dueño de su Kevin inventado).
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { proyecto, rest, cab, pedir, gestion, tapar, usuarioPorCorreo, Fallo } from '../tools/web.mjs';
import { conCodigo } from './codigo-app.mjs';   // Kevin entra con el código de su app (D-262)

const P = proyecto(process.argv[2] === 'real' ? 'real' : 'pruebas');
if (!P.publica || !P.secreta) { console.error(`faltan las claves pública y secreta del proyecto ${P.cual} en .env`); process.exit(1); }
if (P.cual === 'real') {
  const r = await rest(P, 'clientes?select=id&limit=1', { apikey: P.secreta });
  if (!r.ok || (r.json || []).length) { console.error(r.ok ? 'el proyecto real ya tiene clientes: esta prueba solo se pasa antes de dar de alta a nadie' : 'no se pudo leer el proyecto real: ' + r.status); process.exit(1); }
  // Ni si ya hay una Mesa en el servidor (lote 2 del traspaso C): no se crea un dueño temporal donde ya hay datos de Kevin.
  const q = async query => { const g = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query } }); if (!g.ok || !Array.isArray(g.json)) { console.error('no se pudo mirar si hay una Mesa en el real: ' + g.status); process.exit(1); } return g.json[0]; };
  if ((await q(`select to_regclass('mesa.registros') is not null as hay`)).hay && (await q('select exists (select 1 from mesa.registros) as hay')).hay) {
    console.error('el proyecto real ya tiene una Mesa (mesa.registros con filas): esta prueba no corre ahí'); process.exit(1);
  }
}
const S = P.secreta;
const sha = t => createHash('sha256').update(t).digest('hex');
const A = { id: 'prueba-norte', nombre: 'Cliente Prueba Norte', handle: 'prueba.norte' };
const B = { id: 'prueba-sur', nombre: 'Cliente Prueba Sur', handle: 'prueba.sur' };
const BORRADO = 'prueba-borrada', NUEVO = 'prueba-nueva';
const E = { id: 'prueba-esporadica', nombre: 'Esporadico Prueba Este', servicio: 'sesiones' };   // un esporádico (D-378)   // NUEVO: un cliente que llega después (D-266)
const pid = t => sha(t).slice(0, 16);
const PA1 = pid('a1'), PA2 = pid('a2'), PA3 = pid('a3'), PAH = pid('a-oculta'), PB1 = pid('b1'), PNADA = pid('no-existe');
const VA1 = sha('va1'), VA1b = sha('va1-b'), VA2 = sha('va2'), VA3 = sha('va3'), VAH = sha('vah'), VB1 = sha('vb1');
const CORREO = { a: 'ana@portal-pruebas.test', b: 'bea@portal-pruebas.test', k: 'kevin@portal-pruebas.test', o: 'mira@portal-pruebas.test', o2: 'mira-nueva@portal-pruebas.test',
  al: 'alta@portal-pruebas.test', al2: 'alta-sin-crear@portal-pruebas.test', e: 'eva@portal-pruebas.test' };   // e: la del esporádico (D-378)   // o: solo mira (D-266); al: alta con bienvenida (D-273)
const CLAVE = 'Pr-' + randomBytes(16).toString('hex'); // solo para estos usuarios inventados; no se imprime
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const FE = `prueba-esporadica/s-${sha('foto-e')}.jpg`, FA = `prueba-norte/${sha('foto-a')}.jpg`, FAH = `prueba-norte/${sha('foto-oculta')}.jpg`, FB = `prueba-sur/${sha('foto-b')}.jpg`, PDFB = 'prueba-sur/f-b1.pdf';
// Columnas que un usuario puede leer (las demás no tienen permiso: `return=representation` las pide todas si no se dicen).
const C_PUB = 'cliente_id,pid,mes,orden,tipo,nombre,fecha,sin_hora,caption,imagenes,estado,version,visible,enviada';
const C_APR = 'id,cliente_id,pid,version,decision,motivo,diapositiva,autor_nombre,hora';
const C_COM = 'id,cliente_id,pid,version,diapositiva,texto,autor_nombre,de_kevin,hora,resuelto';
// Lo que ve el cliente del acuerdo, de un cliente de solo contenido y de la reunión (D-294, D-297). Inventado.
const A_ACUERDO = { servicio: 'contenido', metricas: 'https://metricas.ejemplo.test/norte', pago: 'semestral', pago_cent: 270000, cubre_de: '2026-05', cubre_hasta: '2026-10',
  acuerdo_de: '2026-05', acuerdo_hasta: null, acuerdo_renueva: true, paquete: 'Paquete de ejemplo', incluye: ['12 fotos al mes', '4 reels'],   // el acuerdo de cuándo a cuándo y su paquete (D-308)
  plan_mes_cent: 45000, iva: 21, no_incluye: ['Gestión de anuncios'], condiciones: ['Permanencia mínima de 6 meses', 'Se renueva solo'] };   // «Tu plan» (D-376)
const B_ACUERDO = { metricas: 'https://metricas.ejemplo.test/sur-b', pago: 'trimestral', pago_cent: 99900 };
const C_ACU = 'id,servicio,metricas,pago,pago_cent,cubre_de,cubre_hasta,acuerdo_de,acuerdo_hasta,acuerdo_renueva,paquete,incluye,plan_mes_cent,iva,no_incluye,condiciones';
const C_ENT = 'cliente_id,id,fecha,que,cuanto,enlace,entregada';
const ent = (c, id, o) => ({ cliente_id: c, id, fecha: o.fecha || '2026-12-15', que: o.que, cuanto: o.cuanto || null, enlace: o.enlace || null, entregada: o.entregada || null });

let fallos = 0, n = 0;
const ok = (c, txt, extra) => { n++; if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + tapar(extra).slice(0, 200) : '')); } };
const es = (r, ...codigos) => codigos.includes(r.status);
// Una restricción (CHECK) que no se cumple: PostgREST responde 400 con el código de Postgres 23514.
const rechazada = r => !r.ok && es(r, 400, 409) && /"code":"23514"/.test(r.text || '');
{ // Solo las claves nuevas (D-280): `firmar` no lee las heredadas (anon, service_role), apagadas y revocadas
  const f = readFileSync(new URL('../servidor/funciones/firmar.ts', import.meta.url), 'utf8');
  ok(!/SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|eyJ/.test(f) && /nuevas\('SUPABASE_PUBLISHABLE_KEYS'\)/.test(f) && /nuevas\('SUPABASE_SECRET_KEYS'\)/.test(f),
    'firmar.ts lee solo las claves nuevas, nunca las heredadas');
}
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
  const r = await pedir(`${P.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { ...cab(P.publica), 'Content-Type': 'application/json' }, body: { email: correo, password: CLAVE }, dejar: ['access_token'] });
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
  await servicio(`clientes?id=in.(${A.id},${B.id},${BORRADO},${NUEVO},${E.id})`, { method: 'DELETE' });
  await servicio(`clientes_borrados?id=in.(${A.id},${B.id},${BORRADO},${NUEVO},${E.id})`, { method: 'DELETE' });   // la reserva de los inventados
  for (const [b, rutas] of [['fotos', [FA, FAH, FB, FE]], ['facturas', [PDFB]]])
    await pedir(`${P.url}/storage/v1/object/${b}`, { method: 'DELETE', headers: { ...cab(S), 'Content-Type': 'application/json' }, body: { prefixes: rutas } });
  for (const c of Object.values(CORREO)) {
    const u = await usuarioPorCorreo(P, c).catch(() => null);
    if (u) { await servicio(`duenos?user_id=eq.${u.id}`, { method: 'DELETE' }); await pedir(`${P.url}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: cab(S) }); }
  }
}

async function main() {
  console.log(`Prueba de aislamiento · proyecto de pruebas ${P.ref}`);
  await limpiar();
  const ua = await usuario(CORREO.a), ub = await usuario(CORREO.b), uk = await usuario(CORREO.k), uo = await usuario(CORREO.o);
  const pub = (c, p, o) => ({ cliente_id: c, pid: p, mes: '2026-12', orden: o.orden, tipo: o.tipo || 'foto', nombre: o.nombre, fecha: '2026-12-10T12:00:00Z', caption: o.caption || '', imagenes: o.imagenes || [], estado: o.estado, version: o.version, visible: o.visible !== false });
  const semillas = [
    ['clientes', [A, B]],
    ['miembros', [{ user_id: ua, cliente_id: A.id, nombre: 'Ana Norte' }, { user_id: ub, cliente_id: B.id, nombre: 'Bea Sur' }]],
    ['miembros', [{ user_id: uo, cliente_id: A.id, nombre: 'Mira Prueba', observa: true }, { user_id: uo, cliente_id: B.id, nombre: 'Mira Prueba', observa: true }]],   // D-266
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
  // Aparte (D-294, D-297): con un esquema que aún no lo tiene, sale en rojo y el resto de la prueba sigue.
  console.log('Sembrar el acuerdo, las entregas y las reuniones (D-294, D-297)');
  for (const [txt, ruta, o] of [
    ['el acuerdo de Norte (solo contenido, semestral, de mayo a octubre) y su enlace de métricas', `clientes?id=eq.${A.id}`, { method: 'PATCH', body: A_ACUERDO }],
    ['el de Sur (trimestral, sin tramo) y el suyo', `clientes?id=eq.${B.id}`, { method: 'PATCH', body: B_ACUERDO }],
    ['una factura de varios meses en cada uno', 'pagos', { method: 'POST', body: [{ cliente_id: A.id, id: 'co-a2', periodo: '2026-05', hasta: '2026-10', importe_cent: 270000 }, { cliente_id: B.id, id: 'co-b2', periodo: '2026-09', hasta: '2026-11', importe_cent: 99900 }] }],
    ['una reunión en cada uno', 'sesiones', { method: 'POST', body: [{ cliente_id: A.id, id: 'reu-a1', mes: '2026-12', nombre: 'Reunión Norte', inicio: '2026-12-03T10:00:00Z', clase: 'reunion' }, { cliente_id: B.id, id: 'reu-b1', mes: '2026-12', nombre: 'Reunión Sur', inicio: '2026-12-04T10:00:00Z', clase: 'reunion' }] }],
    ['las entregas (de Norte una pendiente y una entregada; de Sur una entregada)', 'entregas', { method: 'POST', body: [ent(A.id, 'ent-a1', { que: '20 fotos de producto', cuanto: '20 fotos' }),
      ent(A.id, 'ent-a2', { fecha: '2026-11-30', que: 'Vídeo de la carta', cuanto: '1 vídeo', enlace: 'https://entregas.ejemplo.test/norte', entregada: '2026-11-28' }),
      ent(B.id, 'ent-b1', { fecha: '2026-11-20', que: 'Entrega Sur', enlace: 'https://entregas.ejemplo.test/sur-b', entregada: '2026-11-19' })] }],
  ]) {
    const r = await servicio(ruta, { ...o, prefer: o.method === 'PATCH' ? 'return=representation' : 'resolution=merge-duplicates' });
    ok(r.ok && (o.method !== 'PATCH' || (r.json || []).length === 1), 'se siembra ' + txt, `${r.status} ${r.text}`);
  }
  for (const [b, ruta, bytes, tipo] of [['fotos', FA, JPG, 'image/jpeg'], ['fotos', FAH, JPG, 'image/jpeg'], ['fotos', FB, JPG, 'image/jpeg'], ['facturas', PDFB, PDF, 'application/pdf']]) await subir(b, ruta, bytes, tipo);
  const kb = await entrar(CORREO.b), ka = await entrar(CORREO.a), kk = (await conCodigo(P, await entrar(CORREO.k))).access_token;   // con el código de su app (D-262)
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
  for (const t of ['clientes', 'pagos', 'meses', 'sesiones', 'entregas']) {
    r = await a(`${t}?select=*`); ok(r.ok && r.json.every(x => (x.cliente_id || x.id) === A.id), `${t}: solo de su cliente`, r.text);
  }
  r = await a(`comentarios?select=${C_COM}`); ok(r.ok && r.json.every(x => x.cliente_id === A.id && x.pid !== PAH), 'comentarios: solo de lo que ve (ni de Sur ni de la oculta)', r.text);
  r = await a(`aprobaciones?select=${C_APR}`); ok(r.ok && r.json.every(x => x.cliente_id === A.id), 'aprobaciones: solo de su cliente', r.text);
  r = await a('miembros?select=*'); ok(r.ok && r.json.length === 1 && r.json[0].user_id === ua, 'miembros: solo su fila', r.text);
  r = await a('duenos?select=*'); ok(r.ok && r.json.length === 0, 'duenos: nada', r.text);
  r = await a('lecturas', { method: 'POST', body: { cliente_id: A.id, visto_hasta: new Date().toISOString() } }); ok(es(r, 401, 403), 'Ana no escribe «leído» (es de Kevin)', r.text);
  r = await rest(P, `publicaciones?select=${C_PUB}`); ok(es(r, 401, 403) || (r.ok && r.json.length === 0), 'sin entrar: nada', r.text);

  console.log('Acuerdo, entregas y reuniones (D-294, D-297)');
  const igual = (x, esperado) => !!x && Object.entries(esperado).every(([c, v]) => x[c] === v || JSON.stringify(x[c]) === JSON.stringify(v));   // lo que incluye un paquete es una lista (D-308)
  r = await a(`clientes?select=${C_ACU}`);
  ok(r.ok && r.json.length === 1 && igual(r.json[0], { id: A.id, ...A_ACUERDO }), 'Ana ve solo su acuerdo y su enlace de métricas, con sus valores', r.text);
  r = await a(`entregas?select=${C_ENT}&order=id`);
  ok(r.ok && r.json.length === 2 && r.json.every(x => x.cliente_id === A.id), 'Ana ve solo sus 2 entregas', r.text);
  ok(r.ok && Array.isArray(r.json) && igual(r.json.find(x => x.id === 'ent-a1'), { enlace: null, entregada: null, que: '20 fotos de producto' })
    && igual(r.json.find(x => x.id === 'ent-a2'), { enlace: 'https://entregas.ejemplo.test/norte', entregada: '2026-11-28', cuanto: '1 vídeo' }), 'la pendiente sin enlace y la entregada con el suyo', r.text);
  r = await a(`entregas?select=${C_ENT}&cliente_id=eq.${B.id}`); ok(r.ok && r.json.length === 0, 'pidiendo las de Sur por id, nada', r.text);
  r = await a('pagos?select=id,hasta&order=id');
  ok(r.ok && r.json.map(x => x.id).join() === 'co-a1,co-a2' && r.json[0].hasta === null && r.json[1].hasta === '2026-10', 'pagos: solo los suyos, la factura de varios meses con su «hasta»', r.text);
  r = await a('sesiones?select=id,clase');
  ok(r.ok && r.json.length === 1 && igual(r.json[0], { id: 'reu-a1', clase: 'reunion' }), 'sesiones: solo las suyas, con su reunión', r.text);
  r = await rest(P, `entregas?select=${C_ENT}`); ok(es(r, 401, 403) || (r.ok && r.json.length === 0), 'sin entrar: ninguna entrega', r.text);
  const intrusa = { cliente_id: A.id, id: 'ent-intrusa', fecha: '2026-12-20', que: 'Intrusa' };
  r = await a('entregas', { method: 'POST', body: intrusa }); ok(es(r, 401, 403), 'Ana no añade entregas a su cliente', r.text);
  r = await rest(P, 'entregas', { method: 'POST', token: ka, body: { ...intrusa, cliente_id: B.id } }); ok(es(r, 401, 403), 'ni a Sur', r.text);
  await a(`entregas?cliente_id=eq.${A.id}`, { method: 'PATCH', body: { que: 'Cambiada por Ana', enlace: null, entregada: null } });
  await rest(P, `entregas?cliente_id=eq.${B.id}`, { method: 'PATCH', token: ka, body: { que: 'Cambiada por Ana' } });
  await a(`entregas?cliente_id=eq.${A.id}`, { method: 'DELETE' });
  await rest(P, `entregas?cliente_id=eq.${B.id}`, { method: 'DELETE', token: ka });
  r = await servicio(`entregas?select=${C_ENT}&cliente_id=in.(${A.id},${B.id})`);
  ok(r.ok && r.json.length === 3 && !r.json.some(x => x.id === 'ent-intrusa' || x.que === 'Cambiada por Ana') && igual(r.json.find(x => x.id === 'ent-a2'), { enlace: 'https://entregas.ejemplo.test/norte' }),
    'Ana no añade, ni cambia, ni borra ninguna entrega (ni suya ni de Sur)', r.text);
  await a(`clientes?id=eq.${A.id}`, { method: 'PATCH', body: { metricas: 'https://otra.ejemplo.test/ana', servicio: 'redes' } });
  r = await servicio(`clientes?id=eq.${A.id}&select=servicio,metricas`);
  ok(r.ok && igual(r.json[0], { servicio: 'contenido', metricas: A_ACUERDO.metricas }), 'Ana no cambia el enlace de métricas ni el servicio de su cliente', r.text);

  console.log('Restricciones del acuerdo, las entregas y las reuniones (D-294, D-297)');
  const CA = `clientes?id=eq.${A.id}`, PA = `pagos?cliente_id=eq.${A.id}&id=eq.co-a2`, mala = o => ent(A.id, 'ent-mala', { que: 'Mala', ...o });
  for (const [txt, ruta, method, body] of [
    ['métricas por http', CA, 'PATCH', { metricas: 'http://metricas.ejemplo.test/norte' }],
    ['métricas con un espacio', CA, 'PATCH', { metricas: 'https://metricas.ejemplo.test/no rte' }],
    ['métricas de más de 500 caracteres', CA, 'PATCH', { metricas: 'https://metricas.ejemplo.test/' + 'x'.repeat(480) }],
    ['un servicio que no existe', CA, 'PATCH', { servicio: 'otro' }],
    ['un pago «semanal»', CA, 'PATCH', { pago: 'semanal' }],
    ['un importe de pago negativo', CA, 'PATCH', { pago_cent: -1 }],
    ['un tramo que acaba antes de empezar', CA, 'PATCH', { cubre_de: '2026-10', cubre_hasta: '2026-05' }],
    ['solo el principio del tramo', CA, 'PATCH', { cubre_hasta: null }],
    ['solo el final del tramo', CA, 'PATCH', { cubre_de: null }],
    ['un tramo con meses que no existen', CA, 'PATCH', { cubre_de: '2026-13', cubre_hasta: '2026-14' }],
    ['un acuerdo que acaba antes de empezar', CA, 'PATCH', { acuerdo_hasta: '2026-01' }],
    ['un acuerdo con final y sin principio', CA, 'PATCH', { acuerdo_de: null, acuerdo_hasta: '2026-10' }],
    ['un acuerdo con un mes que no existe', CA, 'PATCH', { acuerdo_de: '2026-13' }],
    ['un paquete sin nombre', CA, 'PATCH', { paquete: '' }],
    ['un paquete de más de 60 caracteres', CA, 'PATCH', { paquete: 'x'.repeat(61) }],
    ['más de 20 cosas en lo que incluye', CA, 'PATCH', { incluye: Array.from({ length: 21 }, (x, i) => 'cosa ' + i) }],
    ['lo que incluye con un hueco', CA, 'PATCH', { incluye: ['12 fotos', null] }],
    ['lo del mes sin su IVA', CA, 'PATCH', { iva: null }],   // D-376
    ['un IVA que no es 21 ni 0', CA, 'PATCH', { iva: 10 }],
    ['el IVA sin lo del mes', CA, 'PATCH', { plan_mes_cent: null }],
    ['lo del mes negativo', CA, 'PATCH', { plan_mes_cent: -1 }],
    ['más de 20 cosas en lo que no incluye', CA, 'PATCH', { no_incluye: Array.from({ length: 21 }, (x, i) => 'cosa ' + i) }],
    ['las condiciones con un hueco', CA, 'PATCH', { condiciones: ['Permanencia', null] }],
    ['una factura que acaba antes de su periodo', PA, 'PATCH', { hasta: '2026-04' }],
    ['una factura con «hasta» y sin periodo', PA, 'PATCH', { periodo: null }],
    ['una sesión de clase «otra»', `sesiones?cliente_id=eq.${A.id}&id=eq.reu-a1`, 'PATCH', { clase: 'otra' }],
    ['una entrega con enlace y sin entregar', 'entregas', 'POST', mala({ enlace: 'https://entregas.ejemplo.test/mala' })],
    ['una entrega con enlace por http', 'entregas', 'POST', mala({ enlace: 'http://entregas.ejemplo.test/mala', entregada: '2026-12-19' })],
    ['una entrega sin «qué» (solo espacios)', 'entregas', 'POST', mala({ que: '   ' })],
    ['una entrega con un id raro', 'entregas', 'POST', { ...mala({}), id: 'ent mala/1' }],
  ]) { r = await servicio(ruta, { method, body }); ok(rechazada(r), `${txt}: rechazada (23514)`, `${r.status} ${r.text}`); }
  r = await servicio(`clientes?id=eq.${A.id}&select=${C_ACU}`); ok(r.ok && igual(r.json[0], A_ACUERDO), 'el acuerdo de Norte sigue como estaba', r.text);
  r = await servicio(`entregas?select=id&cliente_id=eq.${A.id}`); ok(r.ok && r.json.length === 2, 'y no entró ninguna entrega mala', r.text);
  r = await servicio('clientes?select=renegociar'); ok(es(r, 400), 'no hay columna de renegociar: esa fecha nunca llega al servidor', r.text);
  const g = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query: `select table_name, column_name from information_schema.columns where table_schema = 'public' and column_name ilike '%renegoc%'` } });
  ok(g.ok && Array.isArray(g.json) && g.json.length === 0, 'ni ninguna otra con «renegoc…» en el esquema público', g.text);

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

  console.log('Solo mirar (D-266)');
  const ko = await entrar(CORREO.o), o = como(ko);
  r = await o('miembros?select=cliente_id,observa'); ok(r.ok && r.json.length >= 2 && r.json.every(x => x.observa === true) && [A.id, B.id].every(c => r.json.some(x => x.cliente_id === c)), 've sus filas, todas «solo mirar»', r.text);
  r = await o(`publicaciones?select=${C_PUB}&cliente_id=in.(${A.id},${B.id})`); ok(r.ok && r.json.length === 4 && !r.json.some(x => x.pid === PAH), 've las publicaciones visibles de los dos clientes (la oculta, no)', r.text);
  for (const t of ['pagos', 'meses', 'sesiones', 'entregas']) { r = await o(`${t}?select=cliente_id&cliente_id=in.(${A.id},${B.id})`); ok(r.ok && new Set(r.json.map(x => x.cliente_id)).size === 2, `${t}: los de los dos clientes, como cada uno`, r.text); }
  r = await o(`entregas?select=id&cliente_id=in.(${A.id},${B.id})`); ok(r.ok && r.json.length === 3, 've las 3 entregas de los dos clientes', r.text);
  r = await o('entregas', { method: 'POST', body: { cliente_id: B.id, id: 'ent-mira', fecha: '2026-12-20', que: 'Solo miro' } }); ok(es(r, 401, 403), 'no añade entregas', r.text);
  await o(`entregas?cliente_id=in.(${A.id},${B.id})`, { method: 'PATCH', body: { que: 'Cambiada al mirar' } });
  await o(`entregas?cliente_id=in.(${A.id},${B.id})`, { method: 'DELETE' });
  r = await servicio(`entregas?select=id,que&cliente_id=in.(${A.id},${B.id})`); ok(r.ok && r.json.length === 3 && !r.json.some(x => x.id === 'ent-mira' || x.que === 'Cambiada al mirar'), 'ni cambia ni borra ninguna', r.text);
  r = await o(`comentarios?select=${C_COM}&cliente_id=in.(${A.id},${B.id})`); ok(r.ok && r.json.length > 0 && !r.json.some(x => x.pid === PAH), 've los comentarios de lo que se ve, no los de una oculta', r.text);
  r = await firmarFn(ko, 'fotos', [FA, FB, FAH]); const uo1 = (r.ok && r.json && r.json.urls) || {};
  ok(r.ok && uo1[FA] && uo1[FB] && !uo1[FAH], 'la función le firma las fotos de lo que ve (no la de una oculta)', r.text);
  r = await apr({ cliente_id: B.id, pid: PB1, version: VB1, decision: 'aprobada' }, ko); ok(es(r, 403) && /solo mira/.test(r.text), 'no aprueba: 403 «esta cuenta solo mira»', r.text);
  r = await apr({ cliente_id: B.id, pid: PB1, version: VB1, decision: 'cambios', motivo: 'Otra foto' }, ko); ok(es(r, 403) && /solo mira/.test(r.text), 'no pide cambios', r.text);
  r = await apr({ cliente_id: A.id, pid: PA1, version: VA1, decision: 'retirada' }, ko); ok(es(r, 403) && /solo mira/.test(r.text), 'no deshace la decisión de Ana', r.text);
  r = await o('comentarios', { method: 'POST', body: { cliente_id: B.id, pid: PB1, version: VB1, texto: 'Solo miro' } }); ok(es(r, 403) && /solo mira/.test(r.text), 'no comenta', r.text);
  r = await servicio(`aprobaciones?select=id&cliente_id=in.(${A.id},${B.id})&autor_nombre=eq.Mira%20Prueba`); ok(r.ok && r.json.length === 0, 'y no quedó nada suyo escrito', r.text);
  r = await servicio(`comentarios?select=id&autor_nombre=eq.Mira%20Prueba`); ok(r.ok && r.json.length === 0, 'ni comentarios suyos', r.text);
  r = await o(`publicaciones?cliente_id=eq.${B.id}&pid=eq.${PB1}`, { method: 'PATCH', body: { estado: 'aprobada' } });
  r = await servicio(`publicaciones?pid=eq.${PB1}&select=estado`); ok(r.ok && r.json[0].estado === 'por_aprobar', 'no cambia una publicación', r.text);
  r = await o('miembros', { method: 'PATCH', body: { observa: false } }); ok(!r.ok || (await servicio(`miembros?user_id=eq.${uo}&observa=is.false`)).json.length === 0, 'no se quita a sí mismo el «solo mirar»', r.text);
  r = await o('lecturas', { method: 'POST', body: { cliente_id: A.id, visto_hasta: new Date().toISOString() } }); ok(es(r, 401, 403), 'no escribe «leído» (es de Kevin)', r.text);
  r = await rest(P, `aprobaciones?select=${C_APR}`, { method: 'POST', token: kb, body: { cliente_id: B.id, pid: PB1, version: VB1, decision: 'aprobada' }, prefer: 'return=representation' }); ok(r.ok && r.json[0].autor_nombre === 'Bea Sur', 'Bea, que decide, sigue aprobando', r.text);
  r = await servicio('clientes', { method: 'POST', body: { id: NUEVO, nombre: 'Cliente Prueba Nueva' } }); if (!r.ok) throw new Fallo('cliente nuevo: ' + r.text);
  r = await o(`clientes?select=id&id=eq.${NUEVO}`); ok(r.ok && r.json.length === 1, 'un cliente nuevo le llega solo', r.text);
  r = await servicio(`miembros?cliente_id=eq.${NUEVO}&select=user_id,observa,nombre`); ok(r.ok && r.json.length >= 1 && r.json.every(x => x.observa === true) && r.json.some(x => x.user_id === uo && x.nombre === 'Mira Prueba'), 'como «solo mirar», con su nombre (Ana y Bea, no)', r.text);
  if (P.cual === 'pruebas') {   // la orden `observador` (en el real se pasa a mano, con --si y el OK de Kevin)
    const web = (...a) => { try { return { ok: true, j: JSON.parse(execFileSync('node', [join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'web.mjs'), 'observador', 'pruebas', ...a], { stdio: 'pipe' }).toString()) }; } catch (e) { return { ok: false, t: String(e.stderr || e.message) }; } };
    let w = web(CORREO.o, 'quitar'); ok(w.ok && w.j.quitados >= 3, '`observador … quitar` le quita lo que mira', w.t || JSON.stringify(w.j));
    r = await o(`clientes?select=id&id=in.(${A.id},${B.id},${NUEVO})`); ok(r.ok && r.json.length === 0, 'y ya no ve nada', r.text);
    w = web(CORREO.o, '--nombre=Mira Prueba'); ok(w.ok && w.j.creada === 'ya existía' && w.j.mira === w.j.de && w.j.mira >= 3, '`observador` vuelve a darle todos los clientes', w.t || JSON.stringify(w.j));
    r = await o(`clientes?select=id&id=in.(${A.id},${B.id},${NUEVO})`); ok(r.ok && r.json.length === 3, 'y los ve otra vez', r.text);
    w = web(CORREO.o2); ok(w.ok && w.j.creada === 'sí, sin contraseña', '`observador` crea la cuenta si no existe (sin contraseña)', w.t || JSON.stringify(w.j));
    const u2 = await usuarioPorCorreo(P, CORREO.o2); r = await servicio(`miembros?user_id=eq.${u2 && u2.id}&select=observa`); ok(r.ok && r.json.length === w.j.mira && r.json.every(x => x.observa), 'con una fila «solo mirar» por cliente', r.text);
    w = web(CORREO.k); ok(!w.ok && /dueño/.test(w.t), '`observador` no convierte a Kevin', w.t);
    w = web(CORREO.o, '--si', 'x'); ok(!w.ok, 'ni acepta lo que no conoce', w.t);
  }

  if (P.cual === 'pruebas') {   // la orden `alta` y su bienvenida (D-273); en pruebas nunca se envía: el .eml va a un buzón temporal
    console.log('Alta de clientes y bienvenida');
    const buzon = mkdtempSync(join(tmpdir(), 'portal-buzon-'));
    const emls = () => readdirSync(buzon).filter(f => f.endsWith('.eml')).sort().map(f => readFileSync(join(buzon, f), 'utf8'));
    const leer = raw => {   // cabeceras, asunto, el texto plano y si lleva el logo dentro (multipart/related, D-273)
      const cab = raw.slice(0, raw.indexOf('\r\n\r\n'));
      const pl = raw.match(/Content-Type: text\/plain[^\r]*\r\n(?:[A-Za-z-]+: [^\r]*\r\n)*\r\n([A-Za-z0-9+\/=\r\n]+?)\r\n--/);
      const asunto = ((cab.match(/^Subject: ([\s\S]*?)\r\n(?=[A-Z])/m) || [])[1] || '').replace(/\r\n /g, '').replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
      return { cab, asunto, texto: pl ? Buffer.from(pl[1].replace(/\s+/g, ''), 'base64').toString('utf8') : '', logo: /\r\nContent-ID: <logo@uribevisuals\.studio>\r\n/.test(raw) };
    };
    const alta = (...a) => { try { return { ok: true, j: JSON.parse(execFileSync('node', [join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'web.mjs'), 'alta', ...a, '--buzon=' + buzon], { stdio: 'pipe' }).toString()) }; } catch (e) { return { ok: false, t: String(e.stderr || e.message) }; } };
    const dd = (await servicio('duenos?select=user_id')).json || [];
    const responde = dd.length === 1 && dd[0].user_id === uk ? CORREO.k : null;   // «Responder a»: el único dueño

    let w = alta('pruebas', `${A.id},prueba-no-existe`, CORREO.al, '--nombre=Alta Prueba');
    ok(!w.ok && /prueba-no-existe aún no está en el portal/.test(w.t) && /Web del cliente/.test(w.t), 'con un cliente que aún no está en el portal, para y lo dice', w.t || JSON.stringify(w.j));
    ok(!(await usuarioPorCorreo(P, CORREO.al)) && emls().length === 0, 'y no crea la cuenta ni manda nada');
    w = alta('pruebas', `${A.id},${B.id}`, 'Alta@Portal-Pruebas.test', '--nombre=Alta Prueba');
    ok(w.ok && w.j.cuenta === CORREO.al && w.j.creada === 'sí, sin contraseña' && Array.isArray(w.j.nuevos) && w.j.nuevos.length === 2 && /guardada en/.test(w.j.bienvenida), 'da de alta la cuenta (sin contraseña) en los dos clientes', w.t || JSON.stringify(w.j));
    const ual = await usuarioPorCorreo(P, CORREO.al);
    r = await servicio(`miembros?user_id=eq.${ual && ual.id}&select=cliente_id,nombre,observa&order=cliente_id`);
    ok(r.ok && r.json.length === 2 && r.json.every(x => x.observa === false && x.nombre === 'Alta Prueba') && r.json.map(x => x.cliente_id).join() === [A.id, B.id].sort().join(), 'miembro que decide de los dos, con su nombre', r.text);
    let e = emls();
    const m1 = e.length === 1 && leer(e[0]);
    ok(m1 && /^To: <alta@portal-pruebas\.test>$/m.test(m1.cab) && m1.asunto === `Ya puedes ver tu calendario de ${A.nombre} y ${B.nombre}`, 'una bienvenida, a su correo, con los dos clientes', e.length + ' ' + (m1 && m1.asunto));
    ok(m1 && (responde ? m1.cab.includes(`Reply-To: <${responde}>`) : !/Reply-To/.test(m1.cab)), '«Responder a» el correo de Kevin (el único dueño)', m1 && m1.cab);
    ok(m1 && m1.logo && m1.texto.includes('Hola, Alta Prueba.') && m1.texto.includes(`Escribe ${CORREO.al} y pulsa «Enviarme el código»`) && m1.texto.includes('clientes.uribevisuals.studio'), 'el saludo, su correo y cómo entrar', m1 && m1.texto);
    ok(m1 && !m1.texto.includes('Cliente Prueba Nueva') && !m1.cab.includes('Cliente Prueba Nueva'), 'sin otro cliente en el correo');
    await usuario(CORREO.al);   // una contraseña solo para mirar qué ve
    const kal = await entrar(CORREO.al);
    r = await rest(P, 'clientes?select=id&order=id', { token: kal });
    ok(r.ok && r.json.map(x => x.id).join() === [A.id, B.id].sort().join(), 'en el portal ve sus dos clientes y nada más', r.text);
    r = await rest(P, 'rpc/puede_decidir', { method: 'POST', token: kal, body: { c: A.id } });
    ok(r.ok && r.json === true, 'y decide (aprueba, pide cambios y comenta)', r.text);
    w = alta('pruebas', `${A.id},${B.id}`, CORREO.al, '--nombre=Alta Prueba');
    ok(w.ok && w.j.creada === 'ya existía' && w.j.nuevos === 'ninguno' && /^no: ya era miembro/.test(w.j.bienvenida) && emls().length === 1, 'otra vez: no repite la bienvenida', w.t || JSON.stringify(w.j));
    w = alta('pruebas', `${A.id},${B.id}`, CORREO.al, '--nombre=Alta Prueba', '--reenviar');
    ok(w.ok && /guardada en/.test(w.j.bienvenida) && emls().length === 2, 'con --reenviar, sí', w.t || JSON.stringify(w.j));
    w = alta('pruebas', A.id, CORREO.al2, '--nombre=Alta Prueba', '--prueba-a=' + CORREO.k);
    e = emls(); const mp = e.length === 3 && e.map(leer).find(x => /^To: <kevin@/m.test(x.cab));
    ok(w.ok && /ninguna/.test(w.j.alta) && mp && mp.asunto === `[Prueba] Ya puedes ver tu calendario de ${A.nombre}` && mp.texto.includes(`Escribe ${CORREO.al2} y pulsa`), '--prueba-a: el mismo correo a otra dirección', w.t || JSON.stringify(w.j));
    ok(!(await usuarioPorCorreo(P, CORREO.al2)), 'y sin crear la cuenta');
    w = alta('pruebas', A.id, CORREO.k, '--nombre=Kevin'); ok(!w.ok && /dueño/.test(w.t), 'no da de alta a Kevin (dueño)', w.t);
    w = alta('pruebas', A.id, CORREO.o, '--nombre=Mira'); ok(!w.ok && /solo mira/.test(w.t), 'no convierte una cuenta que solo mira', w.t);
    r = await servicio(`miembros?user_id=eq.${uo}&cliente_id=eq.${A.id}&select=observa`); ok(r.ok && r.json.length === 1 && r.json[0].observa === true, 'y la deja como estaba', r.text);
    w = alta('pruebas', A.id, CORREO.al); ok(!w.ok && /--nombre/.test(w.t), 'sin --nombre no hace nada', w.t);
    w = alta('pruebas', A.id, CORREO.al, '--nombre=X', '--otra'); ok(!w.ok, 'ni acepta lo que no conoce', w.t);
    w = alta('pruebas', `${A.id},${A.id}`, CORREO.al, '--nombre=X'); ok(!w.ok && /sin repetir/.test(w.t), 'ni un cliente repetido', w.t);
    w = alta('real', A.id, CORREO.al, '--nombre=X'); ok(!w.ok && /--si/.test(w.t), 'en el real, solo con --si (antes de tocar nada)', w.t);
    ok(emls().length === 3, 'y ninguno de estos manda nada');
    rmSync(buzon, { recursive: true, force: true });
  }

  console.log('Kevin');
  r = await k('publicaciones?select=cliente_id'); ok(r.ok && new Set(r.json.map(x => x.cliente_id)).size >= 2, 'Kevin ve los dos clientes', r.text);
  r = await k(`comentarios?select=${C_COM}`, { method: 'POST', body: { cliente_id: B.id, pid: PB1, version: VB1, texto: 'Hecho, mira la 2.' }, prefer: 'return=representation' });
  ok(r.ok && r.json[0].de_kevin === true && r.json[0].autor_nombre === 'Kevin · Uribe Visuals', 'Kevin contesta y sale como Kevin', r.text);
  const cid = r.ok && r.json[0] && r.json[0].id;
  if (cid) { r = await k(`comentarios?id=eq.${cid}&select=id,resuelto`, { method: 'PATCH', body: { resuelto: new Date().toISOString() }, prefer: 'return=representation' }); ok(r.ok && r.json[0] && r.json[0].resuelto, 'Kevin marca resuelto', r.text); }
  r = await apr({ cliente_id: B.id, pid: PB1, version: VB1, decision: 'aprobada' }, kk); ok(es(r, 403), 'Kevin no aprueba en nombre del cliente', r.text);
  r = await k(`entregas?select=cliente_id&cliente_id=in.(${A.id},${B.id})`); ok(r.ok && r.json.length === 3 && new Set(r.json.map(x => x.cliente_id)).size === 2, 'Kevin ve las entregas de los dos clientes', r.text);
  r = await k(`entregas?select=${C_ENT}`, { method: 'POST', body: ent(B.id, 'ent-k1', { fecha: '2026-12-22', que: 'Entrega de Kevin', cuanto: '10 fotos' }), prefer: 'return=representation' });
  ok(r.ok && igual(r.json[0], { id: 'ent-k1', que: 'Entrega de Kevin', enlace: null }), 'Kevin añade una entrega', r.text);
  r = await k(`entregas?cliente_id=eq.${B.id}&id=eq.ent-k1&select=${C_ENT}`, { method: 'PATCH', body: { entregada: '2026-12-21', enlace: 'https://entregas.ejemplo.test/k1' }, prefer: 'return=representation' });
  ok(r.ok && igual(r.json[0], { entregada: '2026-12-21', enlace: 'https://entregas.ejemplo.test/k1' }), 'la marca entregada, con su enlace', r.text);
  r = await k(`entregas?cliente_id=eq.${B.id}&id=eq.ent-k1`, { method: 'DELETE' });
  let q = await servicio('entregas?select=id&id=eq.ent-k1'); ok(r.ok && q.ok && q.json.length === 0, 'y la borra', r.text || q.text);
  r = await k(`clientes?id=eq.${B.id}&select=${C_ACU}`, { method: 'PATCH', body: { servicio: 'contenido', pago: 'anual', cubre_de: '2026-01', cubre_hasta: '2026-12' }, prefer: 'return=representation' });
  ok(r.ok && igual(r.json[0], { servicio: 'contenido', pago: 'anual', cubre_de: '2026-01', cubre_hasta: '2026-12' }), 'Kevin cambia el acuerdo de un cliente', r.text);
  r = await k(`publicaciones?cliente_id=eq.${A.id}&pid=eq.${PA1}`, { method: 'DELETE' }); ok(!r.ok, 'borrar una publicación con decisiones no se lleva su historial', r.text);
  await servicio('clientes', { method: 'POST', body: { id: BORRADO, nombre: 'Cliente Prueba Borrado' } });
  r = await servicio('entregas', { method: 'POST', body: ent(BORRADO, 'ent-borrada', { que: 'Del cliente que se borra' }) }); ok(r.ok, 'una entrega del cliente que se va a borrar', r.text);
  r = await k(`clientes?id=eq.${BORRADO}`, { method: 'DELETE' }); ok(!r.ok, 'Kevin no borra un cliente desde la página (se borra con tools/web.mjs)', r.text);
  r = await k(`clientes?id=eq.${BORRADO}`, { method: 'PATCH', body: { id: 'prueba-otro-id' } }); ok(es(r, 409), 'el id de un cliente no se cambia', r.text);
  await servicio(`clientes?id=eq.${BORRADO}`, { method: 'DELETE' });
  q = await servicio(`entregas?select=id&cliente_id=eq.${BORRADO}`); ok(q.ok && q.json.length === 0, 'borrar un cliente se lleva sus entregas', q.text);
  r = await servicio('clientes', { method: 'POST', body: { id: BORRADO, nombre: 'Otro con el mismo id' } }); ok(es(r, 409), 'un id de cliente borrado (por cualquier vía) no se vuelve a usar', r.text);
  r = await a('comentarios', { method: 'POST', body: { cliente_id: A.id, pid: PA3, version: sha('nunca'), texto: 'versión inventada' } }); ok(es(r, 409), 'un comentario sobre una versión que no es la vigente: 409', r.text);
  r = await firmarFn(ka, '__proto__', [FA]); ok(es(r, 400), 'la función no acepta un bucket raro', r.text);
  r = await firmarFn(ka, 'fotos', Array.from({ length: 101 }, () => FA)); ok(es(r, 413), 'ni más de 100 rutas', r.text);
  r = await pedir(`${P.url}/functions/v1/firmar`, { method: 'POST', headers: { ...cab(P.publica, ka), 'Content-Type': 'application/json' }, body: 'null' }); ok(es(r, 400), 'ni un cuerpo vacío', r.text);
  const prev = await fetch(`${P.url}/functions/v1/firmar`, { method: 'OPTIONS', headers: { Origin: 'https://malo.example', 'Access-Control-Request-Method': 'POST' } });
  ok(!prev.headers.get('access-control-allow-origin'), 'la función no abre CORS a otro origen', prev.headers.get('access-control-allow-origin'));
  const prev2 = await fetch(`${P.url}/functions/v1/firmar`, { method: 'OPTIONS', headers: { Origin: 'https://clientes.uribevisuals.studio', 'Access-Control-Request-Method': 'POST' } });
  ok(prev2.headers.get('access-control-allow-origin') === 'https://clientes.uribevisuals.studio', 'y sí al portal', prev2.headers.get('access-control-allow-origin'));

  console.log('Un esporádico en su web (D-378)');
  const ue = await usuario(CORREO.e);
  r = await servicio('clientes', { method: 'POST', body: { ...E, servicio: 'otro' } }); ok(rechazada(r), 'un servicio que no es redes, contenido ni sesiones no entra', r.text);
  r = await servicio('clientes', { method: 'POST', body: E }); ok(r.ok, 'se siembra el esporádico (servicio «sesiones»)', r.text);
  r = await servicio('miembros', { method: 'POST', body: [{ user_id: ue, cliente_id: E.id, nombre: 'Eva Este' }] }); ok(r.ok, 'y su cuenta', r.text);
  const CONT = [{ id: 'orden', nombre: 'Orden', tipo: 'texto', texto: 'Llegada y montaje' }, { id: 'mood', nombre: 'Mood board', tipo: 'mood', grupos: [{ nombre: 'Luz', fotos: [{ ruta: FE, mini: FE, an: 1, al: 1 }] }] }];
  r = await servicio('sesiones', { method: 'POST', body: [{ cliente_id: E.id, id: 'ses-e1', mes: '2026-12', nombre: 'Rodaje Esporadico Este', inicio: '2026-12-05T09:00:00Z', contenido: CONT, fotos: [FE] }] });
  ok(r.ok, 'una sesión con lo que ve (contenido) y su foto', r.text);
  r = await servicio('sesiones', { method: 'POST', body: [{ cliente_id: E.id, id: 'ses-e9', mes: '2026-12', nombre: 'Mal', inicio: '2026-12-05T09:00:00Z', contenido: { no: 'lista' } }] });
  ok(rechazada(r), 'un contenido que no es una lista no entra', r.text);
  r = await servicio('tareas_notas', { method: 'POST', body: [{ cliente_id: E.id, id: 'tk-e1', tipo: 'tarea', texto: 'Tarea visible de Este', fecha: '2026-12-01' }, { cliente_id: E.id, id: 'nt-e1', tipo: 'nota', texto: 'Nota visible de Este', fecha: null }, { cliente_id: A.id, id: 'tk-a9', tipo: 'tarea', texto: 'Tarea de Norte', fecha: null }] });
  ok(r.ok, 'sus tareas y notas visibles (y una de Norte)', r.text);
  r = await servicio('tareas_notas', { method: 'POST', body: [{ cliente_id: E.id, id: 'tk-e9', tipo: 'otra', texto: 'x' }] }); ok(rechazada(r), 'una que no es tarea ni nota no entra', r.text);
  await subir('fotos', FE, JPG, 'image/jpeg');
  const ke = await entrar(CORREO.e), ev = como(ke);
  r = await ev(`sesiones?select=id,contenido,fotos&cliente_id=eq.${E.id}`); ok(r.ok && r.json.length === 1 && r.json[0].contenido && r.json[0].contenido[0].texto === 'Llegada y montaje', 'Eva ve su sesión con lo que tiene visible', r.text);
  r = await ev('tareas_notas?select=id,tipo,texto'); ok(r.ok && r.json.length === 2 && r.json.every(x => x.id.endsWith('-e1')), 'Eva ve solo sus dos tareas y notas', r.text);
  r = await a(`sesiones?select=id&cliente_id=eq.${E.id}`); ok(r.ok && r.json.length === 0, 'Ana no ve las sesiones del esporádico', r.text);
  r = await a('tareas_notas?select=id,texto'); ok(r.ok && r.json.length === 1 && r.json[0].id === 'tk-a9', 'Ana ve solo la tarea de Norte', r.text);
  r = await firmarFn(ke, 'fotos', [FE]); ok(r.ok && r.json.urls && r.json.urls[FE], 'firmar da a Eva la foto de su sesión', r.text);
  r = await firmarFn(ka, 'fotos', [FE]); ok(r.ok && r.json.urls && !r.json.urls[FE], 'y a Ana no', r.text);
  const cs = (tk, body) => rest(P, 'comentarios_sesion?select=id,cliente_id,sesion,texto,autor_nombre,de_kevin,hora,resuelto', { method: 'POST', token: tk, body, prefer: 'return=representation' });
  r = await cs(ke, { cliente_id: E.id, sesion: 'ses-e1', texto: 'Comentario de Eva Este', autor_nombre: 'Otra', de_kevin: true });
  ok(es(r, 401, 403), 'no se firma como otro ni como Kevin', r.text);
  const t2 = Date.now();
  r = await cs(ke, { cliente_id: E.id, sesion: 'ses-e1', texto: 'Comentario de Eva Este' });
  const ce = r.ok && r.json && r.json[0];
  ok(ce && ce.autor_nombre === 'Eva Este' && !ce.de_kevin && Math.abs(Date.parse(ce.hora) - t2) < 120000, 'Eva comenta su sesión, con su nombre y la hora del servidor', r.text);
  r = await cs(ke, { cliente_id: E.id, sesion: 'no-existe', texto: 'hola' }); ok(es(r, 404), 'una sesión suya que no existe: 404', r.text);
  r = await cs(ke, { cliente_id: B.id, sesion: 'ses-b1', texto: 'hola' }); ok(es(r, 403), 'Eva no comenta una sesión de Sur: 403', r.text);
  r = await cs(ka, { cliente_id: E.id, sesion: 'ses-e1', texto: 'hola' }); ok(es(r, 403), 'ni Ana la del esporádico', r.text);
  r = await cs(ko, { cliente_id: E.id, sesion: 'ses-e1', texto: 'hola' }); ok(es(r, 403), 'la cuenta que solo mira no comenta (y ve el esporádico, que llegó después)', r.text);
  r = await rest(P, `sesiones?select=id&cliente_id=eq.${E.id}`, { token: ko }); ok(r.ok && r.json.length === 1, 'la que solo mira lo ve', r.text);
  r = await cs(kk, { cliente_id: E.id, sesion: 'ses-e1', texto: 'Respuesta de Kevin' }); const ck = r.ok && r.json && r.json[0];
  ok(ck && ck.de_kevin && /Kevin/.test(ck.autor_nombre), 'Kevin contesta, firmado como Kevin', r.text);
  r = await ev(`comentarios_sesion?select=id,texto&cliente_id=eq.${E.id}`); ok(r.ok && r.json.length === 2, 'Eva lee la conversación', r.text);
  r = await a('comentarios_sesion?select=id,texto'); ok(r.ok && r.json.length === 0, 'Ana no ve comentarios de sesión ajenos', r.text);
  r = await ev(`comentarios_sesion?id=eq.${ce.id}`, { method: 'PATCH', body: { resuelto: new Date().toISOString() }, prefer: 'return=representation' }); ok(!r.ok || (r.json || []).length === 0, 'Eva no marca nada como resuelto', r.text);
  r = await k(`comentarios_sesion?id=eq.${ce.id}&select=id,resuelto`, { method: 'PATCH', body: { resuelto: new Date().toISOString() }, prefer: 'return=representation' }); ok(r.ok && r.json[0] && r.json[0].resuelto, 'Kevin lo marca como resuelto', r.text);
  r = await ev('tareas_notas', { method: 'POST', body: { cliente_id: E.id, id: 'tk-e5', tipo: 'tarea', texto: 'mía' } }); ok(es(r, 401, 403), 'Eva no escribe tareas ni notas', r.text);
  r = await ev(`sesiones?cliente_id=eq.${E.id}&id=eq.ses-e1`, { method: 'PATCH', body: { nombre: 'cambiada' }, prefer: 'return=representation' }); ok(!r.ok || (r.json || []).length === 0, 'ni cambia su sesión', r.text);
  await servicio(`sesiones?cliente_id=eq.${E.id}&id=eq.ses-e1`, { method: 'DELETE' });   // Kevin la oculta: deja de enviarse
  r = await ev(`comentarios_sesion?select=id&cliente_id=eq.${E.id}`); ok(r.ok && r.json.length === 0, 'una sesión que deja de verse se lleva de su vista la conversación', r.text);
  r = await servicio(`comentarios_sesion?select=id&cliente_id=eq.${E.id}`); ok(r.ok && r.json.length === 2, 'pero no la borra', r.text);
  r = await cs(ke, { cliente_id: E.id, sesion: 'ses-e1', texto: 'otra' }); ok(es(r, 404), 'y ya no se comenta', r.text);
  r = await firmarFn(ke, 'fotos', [FE]); ok(r.ok && r.json.urls && !r.json.urls[FE], 'ni se firma su foto', r.text);

  console.log('Rastros de otro cliente en lo que recibe Ana');
  const todo = vistoComoA.join('\n');
  for (const s of [B.id, B.nombre, B.handle, PB1, VB1, 'Bea Sur', 'Rodaje Sur', 'Texto de Prueba Sur', 'co-b1', 'Comentario en la oculta', ub, uk,
    'Entrega Sur', 'metricas.ejemplo.test/sur-b', 'entregas.ejemplo.test/sur-b', 'Reunión Sur', 'trimestral', 'co-b2', 'reu-b1', 'ent-b1',
    E.id, E.nombre, 'Eva Este', 'Rodaje Esporadico', 'Tarea visible de Este', 'Nota visible de Este', 'Comentario de Eva', FE])
    ok(!todo.includes(s), `nada de «${s.length > 20 ? s.slice(0, 8) + '…' : s}»`);
}

main().catch(e => { fallos++; console.error(tapar(e instanceof Fallo ? e.message : (e.stack || e))); })
  .finally(async () => {
    try { await limpiar(); } catch (e) { console.error('limpieza: ' + tapar(e.message)); }
    try {   // las entregas se van con su cliente (D-297)
      const q = await servicio(`entregas?select=id&cliente_id=in.(${A.id},${B.id},${BORRADO},${NUEVO},${E.id})`);
      ok(q.ok && q.json.length === 0, 'limpieza: no queda ninguna entrega de los clientes inventados', q.text);
    } catch (e) { ok(false, 'limpieza: no se pudo mirar si quedan entregas', e.message); }
    console.log(fallos ? `\n${fallos} FALLO(S) de ${n}` : `\nTodo en orden: ${n} de ${n}`);
    process.exit(fallos ? 1 : 0);
  });
