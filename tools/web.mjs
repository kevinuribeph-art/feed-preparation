#!/usr/bin/env node
// Servidor del portal de clientes (Supabase) desde este Mac. Node 18+, sin dependencias.
// Las claves se leen del entorno o del `.env` del repo (sube carpetas hasta encontrarlo) y nunca se imprimen:
//   SUPABASE_ACCESS_TOKEN   token personal de la cuenta (aplicar el esquema y la configuración de la entrada)
//   SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA, SUPABASE_PRUEBAS_SECRETA   proyecto de pruebas
//   SUPABASE_REF, SUPABASE_PUBLICA, SUPABASE_SECRETA                           proyecto real
//   SUPABASE_REAL_TOKEN     token limitado al proyecto real (si falta, SUPABASE_ACCESS_TOKEN)
//   SMTP_USUARIO, SMTP_CLAVE   el buzón de Hostinger que envía los códigos (solo el proyecto real; smtp.hostinger.com:465)
// Órdenes:
//   node tools/web.mjs estado <pruebas|real>          comprueba que las claves llegan (sin enseñarlas)
//   node tools/web.mjs esquema <pruebas|real>         aplica servidor/esquema.sql
//   node tools/web.mjs entrada <pruebas|real>         solo por invitación, código de 6 cifras que vale 10 min
//   node tools/web.mjs dueno <pruebas|real> <correo>  marca ese usuario como Kevin (lo ve todo)
//   node tools/web.mjs funciones <pruebas|real>       despliega servidor/funciones/firmar.ts (URL firmadas de lo que se puede ver)
//   node tools/web.mjs borrar-cliente <pruebas|real> <id>   borra sus archivos y todo lo suyo; el id no se vuelve a usar
//   node tools/web.mjs mesa <pruebas|real> [--si]     aplica servidor/mesa.sql (la Mesa en el servidor; después de `esquema`).
//                                                     En el real, solo con --si. Nunca uno más viejo que el aplicado, ni si la
//                                                     API expone el esquema mesa
//   node tools/web.mjs mesa-version <pruebas|real> <x.yy>   la versión mínima de la Mesa que puede escribir (4.9 < 4.10)
//   node tools/web.mjs mesa-epoca <pruebas|real> [--si]     época nueva, tras restaurar una copia de la base: las Mesas vuelven a
//                                                     bajar todo desde 0 (en el real, solo con --si)
//   node tools/web.mjs actividad <pruebas|real> [días]   la actividad de la Mesa en el servidor (7 días si no se dice; hasta 90)
//   node tools/web.mjs zernio <pruebas|real> [--si]   despliega servidor/funciones/zernio.ts (Zernio desde el servidor, solo Kevin) y
//                                                     pone sus secretos ZERNIO_API_KEY y ZERNIO_BASE. En el real, solo con --si: la
//                                                     clave de .env (ZERNIO_API_KEY, nunca se enseña) y la dirección real de Zernio.
//                                                     En pruebas NUNCA la clave real: una inventada (ZERNIO_PRUEBAS_CLAVE, que empieza
//                                                     por «falsa-», o una nueva) y el Zernio simulado servidor/funciones/zernio-falso.ts,
//                                                     que solo se despliega ahí
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

export class Fallo extends Error {}

let ENV = null;
function leerEnv() {
  if (ENV) return ENV;
  ENV = {};
  let d = join(AQUI, '..');
  for (let i = 0; i < 5; i++) {
    const f = join(d, '.env');
    if (existsSync(f)) {
      for (const l of readFileSync(f, 'utf8').split('\n')) {
        const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\s]+)["']?\s*$/);
        if (m) ENV[m[1]] = m[2];
      }
      break;
    }
    d = join(d, '..');
  }
  return ENV;
}
export const clave = n => (process.env[n] || leerEnv()[n] || '').trim();

const SECRETOS = () => ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_REAL_TOKEN', 'SUPABASE_PRUEBAS_SECRETA', 'SUPABASE_SECRETA', 'SMTP_CLAVE', 'ZERNIO_API_KEY', 'ZERNIO_PRUEBAS_CLAVE'].map(clave).filter(Boolean);
// El token de gestión de cada proyecto: el real puede tener el suyo (cada token, limitado a un proyecto).
const tokenDe = ref => (ref && ref === clave('SUPABASE_REF') && clave('SUPABASE_REAL_TOKEN')) || clave('SUPABASE_ACCESS_TOKEN');
// Toda salida pasa por aquí antes de recortarse (lección 121).
export const tapar = t => SECRETOS().reduce((s, k) => s.split(k).join('[clave]'), String(t));

export function proyecto(cual) {
  if (cual !== 'pruebas' && cual !== 'real') throw new Fallo('di «pruebas» o «real»');
  const p = cual === 'pruebas' ? 'SUPABASE_PRUEBAS_' : 'SUPABASE_';
  const ref = clave(p + 'REF'), publica = clave(p + 'PUBLICA'), secreta = clave(p + 'SECRETA');
  if (!ref) throw new Fallo(`falta ${p}REF en .env`);
  if (!/^[a-z0-9]{10,40}$/.test(ref)) throw new Fallo(`${p}REF no parece un id de proyecto`);
  return { cual, ref, url: `https://${ref}.supabase.co`, publica, secreta };
}

// Lo que se tapa en una respuesta JSON, además de los valores de .env: el valor de cualquier campo con uno de estos nombres
// (p. ej. el `jwt_secret` que devuelve la API de gestión, que .env no conoce).
const SENSIBLE = /secret|pass|token|key|jwt/i;
export function taparJson(v, dejar = []) {
  if (Array.isArray(v)) return v.map(x => taparJson(x, dejar));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) =>
    [k, SENSIBLE.test(k) && !dejar.includes(k) && x !== null && x !== '' ? '[clave]' : taparJson(x, dejar)]));
  if (typeof v === 'string') return tapar(v);
  if (typeof v === 'number' && tapar(String(v)) !== String(v)) return '[clave]';   // una clave solo de cifras, como número
  return v;
}

// Una petición. Su JSON y su texto salen siempre tapados (revisiones de los lotes 1 y 2): cada texto pasa por tapar() y el valor
// de un campo sensible por su nombre se sustituye, salvo los que pida quien llama con `dejar` (p. ej. el `access_token` de un
// usuario inventado de las pruebas). Nunca se devuelve el JSON sin tapar.
export async function pedir(url, { method = 'GET', headers = {}, body, dejar = [] } = {}) {
  let r;
  try {
    r = await fetch(url, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' || body instanceof Uint8Array || body instanceof FormData ? body : JSON.stringify(body)) });
  } catch (e) { throw new Fallo('sin conexión: ' + tapar(e.message)); }
  const t = await r.text();
  let j, esJson = false; try { j = t ? JSON.parse(t) : null; esJson = !!t; } catch (e) { j = null; }
  const jt = esJson ? taparJson(j, dejar) : null;
  return { ok: r.ok, status: r.status, json: jt, text: (esJson ? JSON.stringify(jt) : tapar(t)).slice(0, 400) };
}

// Cabeceras de una clave: la nueva («sb_…») va solo en apikey; la antigua (JWT) también como Bearer.
export function cab(apikey, token) {
  const h = { apikey };
  if (token) h.Authorization = 'Bearer ' + token;
  else if (/^eyJ/.test(apikey)) h.Authorization = 'Bearer ' + apikey;
  return h;
}

export async function rest(P, ruta, { method = 'GET', apikey, token, body, prefer } = {}) {
  const h = { ...cab(apikey || P.publica, token), 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  return pedir(`${P.url}/rest/v1/${ruta}`, { method, headers: h, body });
}

export async function gestion(ruta, { method = 'GET', body } = {}) {
  const t = tokenDe((String(ruta).match(/^projects\/([a-z0-9]+)\//) || [])[1]);
  if (!t) throw new Fallo('falta SUPABASE_ACCESS_TOKEN en .env');
  return pedir(`https://api.supabase.com/v1/${ruta}`, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body });
}

export async function usuarioPorCorreo(P, correo) {
  for (let page = 1; page < 20; page++) {
    const r = await pedir(`${P.url}/auth/v1/admin/users?page=${page}&per_page=100`, { headers: cab(P.secreta) });
    if (!r.ok) throw new Fallo('no se pudo leer usuarios: ' + r.status + ' ' + r.text);
    const us = (r.json && r.json.users) || [];
    const u = us.find(x => (x.email || '').toLowerCase() === correo.toLowerCase());
    if (u) return u;
    if (us.length < 100) return null;
  }
  return null;
}

// Despliega servidor/funciones/<slug>.ts con la API de gestión. `verify_jwt`: la pasarela rechaza lo que no trae un JWT del proyecto.
async function desplegar(P, slug, verifyJwt) {
  const archivo = slug + '.ts';
  const codigo = readFileSync(join(AQUI, '..', 'servidor', 'funciones', archivo));
  const fd = new FormData();
  fd.append('metadata', JSON.stringify({ name: slug, entrypoint_path: archivo, verify_jwt: verifyJwt }));
  fd.append('file', new Blob([codigo], { type: 'application/typescript' }), archivo);
  const t = tokenDe(P.ref); if (!t) throw new Fallo('falta SUPABASE_ACCESS_TOKEN en .env');
  const r = await pedir(`https://api.supabase.com/v1/projects/${P.ref}/functions/deploy?slug=${slug}`, { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd });
  if (!r.ok) throw new Fallo(`la función ${slug} no se desplegó (${r.status}): ${r.text}`);
}

// Zernio desde el servidor (traspaso C, lote 6).
const ZERNIO_REAL = 'https://zernio.com/api/v1';           // la de tools/zernio.mjs
const CLAVE_FALSA = /^falsa-[A-Za-z0-9_-]{16,}$/;          // la única forma de clave que va al proyecto de pruebas

async function sqlDe(P, query) {
  const r = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query } });
  if (!r.ok || !Array.isArray(r.json)) throw new Fallo(`la consulta no entró (${r.status}): ${r.text}`);
  return r.json;
}

const ORDENES = {
  async estado(cual) {
    const P = proyecto(cual);
    const faltan = ['PUBLICA', 'SECRETA'].filter(k => !P[k.toLowerCase()]);
    const r = await pedir(`${P.url}/auth/v1/settings`, { headers: cab(P.publica || '') });
    return { proyecto: P.ref, claves: faltan.length ? `faltan ${faltan.join(', ')}` : 'pública y secreta', token: clave('SUPABASE_ACCESS_TOKEN') ? 'sí' : 'no', entrada: r.ok ? { altas_cerradas: !!(r.json && r.json.disable_signup) } : `no responde (${r.status})` };
  },
  async esquema(cual) {
    const P = proyecto(cual);
    const sql = readFileSync(join(AQUI, '..', 'servidor', 'esquema.sql'), 'utf8');
    const r = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query: sql } });
    if (!r.ok) throw new Fallo(`el esquema no entró (${r.status}): ${r.text}`);
    return { proyecto: P.ref, esquema: 'aplicado' };
  },
  async entrada(cual) {
    const P = proyecto(cual);
    const plantilla = '<p>Tu código para entrar en tu calendario de Uribe Visuals:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p><p>Vale 10 minutos. Si no lo has pedido tú, ignora este correo.</p>';
    // Una contraseña puesta por un cliente sería una puerta más débil que el código: larga y con nueva verificación por correo.
    const base = { disable_signup: true, external_email_enabled: true, mailer_otp_exp: 600, mailer_otp_length: 6,
      password_min_length: 24, security_update_password_require_reauthentication: true };
    // El proyecto real: su dirección, y el correo de los códigos desde el buzón de Hostinger del dominio.
    if (cual === 'real') {
      Object.assign(base, { site_url: 'https://clientes.uribevisuals.studio', uri_allow_list: 'https://clientes.uribevisuals.studio/**' });
      const u = clave('SMTP_USUARIO'), k = clave('SMTP_CLAVE');
      if (u && k) Object.assign(base, { smtp_host: 'smtp.hostinger.com', smtp_port: '465', smtp_user: u, smtp_pass: k, smtp_admin_email: u, smtp_sender_name: 'Uribe Visuals', smtp_max_frequency: 60, rate_limit_email_sent: 30 });   // 30 códigos por hora en todo el portal (D-247; por defecto, 2)
    }
    const r = await gestion(`projects/${P.ref}/config/auth`, { method: 'PATCH', body: base });
    if (!r.ok) throw new Fallo(`la configuración no entró (${r.status}): ${r.text}`);
    // La plantilla del correo solo se puede cambiar con un SMTP propio (en el proyecto real, el buzón de Hostinger).
    const t = await gestion(`projects/${P.ref}/config/auth`, { method: 'PATCH',
      body: { mailer_subjects_magic_link: 'Tu código para entrar', mailer_templates_magic_link_content: plantilla } });
    const correo = t.ok ? 'plantilla con el código puesta'
      : (t.json && t.json.error && t.json.error.code === 'entitlement_required') ? 'plantilla pendiente: necesita el SMTP propio' : `plantilla no entró (${t.status})`;
    return { proyecto: P.ref, entrada: 'solo por invitación, código de 6 cifras, 10 minutos', correo };
  },
  async funciones(cual) {
    const P = proyecto(cual);
    await desplegar(P, 'firmar', true);
    return { proyecto: P.ref, funcion: 'firmar desplegada' };
  },
  // Zernio desde el servidor (lote 6). Los secretos van antes que la función, para que la desplegada ya los lea. La clave no se
  // imprime nunca: ni aquí ni en un error (tapar() la conoce, y la inventada se quita a mano de lo que conteste la API).
  async zernio(cual, ...op) {
    const P = proyecto(cual);
    if (cual === 'real' && !op.includes('--si')) throw new Fallo('en el proyecto real solo con --si (y con el OK de Kevin)');
    let k, base;
    if (cual === 'real') {
      k = clave('ZERNIO_API_KEY');
      if (!k) throw new Fallo('falta ZERNIO_API_KEY en .env');
      if (CLAVE_FALSA.test(k)) throw new Fallo('ZERNIO_API_KEY es una clave inventada de pruebas: no va al real');
      base = ZERNIO_REAL;
    } else {
      if (P.ref === clave('SUPABASE_REF')) throw new Fallo('el proyecto de pruebas es el real: no se despliega ahí el Zernio simulado');
      // Nunca la clave real: una inventada.
      const dada = clave('ZERNIO_PRUEBAS_CLAVE');
      if (dada && !CLAVE_FALSA.test(dada)) throw new Fallo('ZERNIO_PRUEBAS_CLAVE tiene que ser inventada: «falsa-» y al menos 16 letras o cifras');
      k = dada || 'falsa-' + randomBytes(16).toString('hex');
      base = `${P.url}/functions/v1/zernio-falso`;
    }
    const sin = t => tapar(t).split(k).join('[clave]');
    const s = await gestion(`projects/${P.ref}/secrets`, { method: 'POST', body: [{ name: 'ZERNIO_API_KEY', value: k }, { name: 'ZERNIO_BASE', value: base }] });
    if (!s.ok) throw new Fallo(sin(`los secretos no entraron (${s.status}): ${s.text}`));
    if (cual === 'pruebas') await desplegar(P, 'zernio-falso', false);   // el simulado, solo aquí: lo llama la función por su secreto
    await desplegar(P, 'zernio', true);
    // Comprobación con la clave pública y sin sesión: la pasarela la deja pasar (la clave pública vale como JWT anónimo) y la
    // función contesta `sesion`. Recién desplegada puede tardar unos segundos en contestar.
    let r = null;
    for (let i = 0; i < 15; i++) {
      if (i) await new Promise(f => setTimeout(f, 2000));
      r = await pedir(`${P.url}/functions/v1/zernio`, { method: 'POST', headers: { ...cab(P.publica || ''), 'Content-Type': 'application/json' }, body: { orden: 'posts' } });
      if (r.status === 401 || (r.json && r.json.ok === false && r.json.error && r.json.error.codigo === 'sesion')) break;
    }
    const rechazada = r && (r.status === 401 || (r.json && r.json.error && r.json.error.codigo === 'sesion'));
    return { proyecto: P.ref, funcion: 'zernio desplegada', ...(cual === 'pruebas' ? { simulado: 'zernio-falso desplegada' } : {}),
      secretos: { ZERNIO_API_KEY: cual === 'real' ? 'la de .env (no se enseña)' : 'inventada (no se enseña)', ZERNIO_BASE: base },
      sin_sesion: rechazada ? 'rechazada' : `contestó ${r && r.status}: mírala` };
  },
  async 'borrar-cliente'(cual, id) {
    const P = proyecto(cual);
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id || '')) throw new Fallo('falta el id del cliente');
    if (!P.secreta) throw new Fallo('falta la clave secreta de ese proyecto en .env');
    let n = 0;
    for (const b of ['fotos', 'facturas']) {
      for (;;) {
        const l = await pedir(`${P.url}/storage/v1/object/list/${b}`, { method: 'POST', headers: { ...cab(P.secreta), 'Content-Type': 'application/json' }, body: { prefix: id, limit: 1000, offset: 0 } });
        if (!l.ok) throw new Fallo(`no se pudo listar ${b} (${l.status}): ${l.text}`);
        const rutas = (l.json || []).filter(x => x && x.name && x.id).map(x => `${id}/${x.name}`);
        if (!rutas.length) break;
        const d = await pedir(`${P.url}/storage/v1/object/${b}`, { method: 'DELETE', headers: { ...cab(P.secreta), 'Content-Type': 'application/json' }, body: { prefixes: rutas } });
        if (!d.ok) throw new Fallo(`no se pudieron borrar archivos de ${b} (${d.status}): ${d.text}`);
        n += rutas.length;
      }
    }
    const lap = await rest(P, 'clientes_borrados?on_conflict=id', { method: 'POST', apikey: P.secreta, body: { id }, prefer: 'resolution=ignore-duplicates' });
    if (!lap.ok) throw new Fallo(`no se pudo apuntar el id (${lap.status}): ${lap.text}`);
    const r = await rest(P, `clientes?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', apikey: P.secreta });
    if (!r.ok) throw new Fallo(`no se pudo borrar el cliente (${r.status}): ${r.text}`);
    return { proyecto: P.ref, cliente: id, archivos_borrados: n, id_reservado: true };
  },
  // La Mesa en el servidor (traspaso C, lote 2). Antes de aplicar, que el límite por archivo del almacén `mesa` quepa en el
  // global del proyecto (el global no se cambia desde aquí).
  async mesa(cual, ...op) {
    const P = proyecto(cual);
    if (cual === 'real' && !op.includes('--si')) throw new Fallo('en el proyecto real solo con --si (y con el OK de Kevin)');
    const sql = readFileSync(join(AQUI, '..', 'servidor', 'mesa.sql'), 'utf8');
    const ver = +((sql.match(/v_archivo constant integer := (\d+);/) || [])[1] || 0);
    if (!ver) throw new Fallo('no encuentro la versión del esquema (v_archivo) en servidor/mesa.sql');
    const lim = +((sql.match(/\('mesa', 'mesa', false, (\d+),/) || [])[1] || 0);
    if (!lim) throw new Fallo('no encuentro el límite del almacén mesa en servidor/mesa.sql');
    // La API no puede exponer el esquema mesa. Su configuración lleva secretos: solo se mira db_schema y no se imprime.
    const pg = await gestion(`projects/${P.ref}/postgrest`);
    const expuestos = pg.ok && pg.json && typeof pg.json.db_schema === 'string' ? pg.json.db_schema.split(',').map(x => x.trim()) : null;
    if (!expuestos) throw new Fallo(`no se pudo leer qué esquemas expone la API (${pg.status})`);
    if (expuestos.includes('mesa')) throw new Fallo('la API expone el esquema mesa: quítalo de «Exposed schemas» antes de aplicar');
    // Nunca un mesa.sql más viejo que el aplicado (el propio archivo también se niega).
    let aplicada = 0;
    if ((await sqlDe(P, `select to_regclass('mesa.ajustes') is not null as hay`))[0].hay)
      aplicada = +(await sqlDe(P, `select coalesce((to_jsonb(a) ->> 'esquema')::integer, 0) as v from mesa.ajustes a where a.id`))[0].v || 0;
    if (aplicada > ver) throw new Fallo(`este mesa.sql (esquema ${ver}) es más viejo que el aplicado (${aplicada}): no se aplica`);
    const g = await gestion(`projects/${P.ref}/config/storage`);
    const global = g.ok && g.json && +g.json.fileSizeLimit;
    if (!global) throw new Fallo(`no se pudo leer el límite global de archivos del proyecto (${g.status})`);
    const mb = n => Math.round(n / 1048576) + ' MB';
    if (lim > global) throw new Fallo(`el almacén mesa pide ${mb(lim)} por archivo y el proyecto permite ${mb(global)}: baja el de mesa.sql o sube el global en el panel`);
    const r = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query: sql } });
    if (!r.ok) throw new Fallo(`mesa.sql no entró (${r.status}): ${r.text}`);
    return { proyecto: P.ref, mesa: 'aplicado', esquema: { antes: aplicada, ahora: ver }, archivo_maximo: mb(lim), global: mb(global) };
  },
  // Tras restaurar una copia de la base (Supabase), los cursores y las versiones que guarda cada Mesa ya no valen: una época
  // nueva hace que bajen todo desde 0.
  async 'mesa-epoca'(cual, ...op) {
    const P = proyecto(cual);
    if (cual === 'real' && !op.includes('--si')) throw new Fallo('en el proyecto real solo con --si (tras restaurar una copia)');
    const f = (await sqlDe(P, `with a as (select epoca from mesa.ajustes where id)
      update mesa.ajustes set epoca = gen_random_uuid() where id returning (select epoca from a) as antes, epoca as ahora`))[0];
    if (!f) throw new Fallo('no hay mesa.ajustes: aplica antes mesa.sql');
    return { proyecto: P.ref, epoca: { antes: f.antes, ahora: f.ahora } };
  },
  async 'mesa-version'(cual, v) {
    const P = proyecto(cual);
    if (!/^[0-9]{1,4}\.[0-9]{1,4}$/.test(v || '')) throw new Fallo('la versión mínima, como «4.31»');
    const q = `with a as (select version_minima from mesa.ajustes where id)
      update mesa.ajustes set version_minima = '${v}', cambiada = now() where id
      returning (select version_minima from a) as antes, version_minima as ahora`;
    const r = await gestion(`projects/${P.ref}/database/query`, { method: 'POST', body: { query: q } });
    const f = r.ok && Array.isArray(r.json) && r.json[0];
    if (!f) throw new Fallo(`no se pudo poner (${r.status}): ${r.text}`);
    return { proyecto: P.ref, version_minima: { antes: f.antes, ahora: f.ahora } };
  },
  // Lo que apunta `mesa.actividad`: llamadas de quien no es Kevin, rechazos, choques, ordenadores nuevos y borrados masivos.
  // Las 500 más recientes de esos días, con la hora de Madrid y quién (Kevin, el correo de un cliente o nadie). Nunca valores.
  async actividad(cual, dias = '7') {
    const P = proyecto(cual);
    if (!/^[0-9]{1,2}$/.test(String(dias)) || +dias < 1 || +dias > 90) throw new Fallo('los días, de 1 a 90');
    const q = `select a.id, to_char(a.hora at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI:SS') as hora, a.tipo,
        case when a.usuario is null then ''
             else coalesce((select u.email from auth.users u where u.id = a.usuario), 'usuario ' || left(a.usuario::text, 8))
               || case when exists (select 1 from public.duenos d where d.user_id = a.usuario) then ' (dueño)' else '' end end as quien,
        coalesce(a.dispositivo, '') as dispositivo, a.detalle::text as detalle
      from mesa.actividad a where a.hora > now() - interval '${+dias} days' order by a.id desc limit 500`;
    const filas = await sqlDe(P, q);
    // Quién puede usar la Mesa: más de un dueño, o un dueño que además es miembro de un cliente, se avisa.
    const d = (await sqlDe(P, `select (select count(*) from public.duenos) as n,
        (select string_agg(coalesce(u.email, d.user_id::text), ', ' order by u.email) from public.duenos d left join auth.users u on u.id = d.user_id) as quienes,
        (select string_agg(distinct coalesce(u.email, d.user_id::text) || ' → ' || m.cliente_id, ', ') from public.duenos d
           join public.miembros m on m.user_id = d.user_id left join auth.users u on u.id = d.user_id) as mixtos`))[0];
    const avisos = [];
    if (+d.n > 1) avisos.push(`hay ${d.n} dueños (pueden usar la Mesa): ${d.quienes}`);
    if (d.mixtos) avisos.push(`un dueño es además miembro de un cliente: ${d.mixtos}`);
    return { proyecto: P.ref, dias: +dias, filas: filas.length, ...(avisos.length ? { avisos } : {}),
      actividad: filas.map(f => [f.hora, f.tipo, f.quien || '—', f.dispositivo, f.detalle].filter(Boolean).join(' · ')) };
  },
  async dueno(cual, correo) {
    const P = proyecto(cual);
    if (!correo) throw new Fallo('falta el correo');
    if (!P.secreta) throw new Fallo('falta la clave secreta de ese proyecto en .env');
    const u = await usuarioPorCorreo(P, correo);
    if (!u) throw new Fallo('ese correo no tiene usuario en el proyecto');
    const r = await rest(P, 'duenos?on_conflict=user_id', { method: 'POST', apikey: P.secreta, body: { user_id: u.id }, prefer: 'resolution=ignore-duplicates' });
    if (!r.ok) throw new Fallo(`no se pudo (${r.status}): ${r.text}`);
    return { proyecto: P.ref, dueno: 'hecho' };
  },
};

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [orden, ...args] = process.argv.slice(2);
  const f = ORDENES[orden];
  if (!f) { console.log('Órdenes: ' + Object.keys(ORDENES).join(', ') + ' (ver la cabecera de tools/web.mjs)'); process.exit(orden ? 1 : 0); }
  f(...args).then(r => console.log(tapar(JSON.stringify(r, null, 2))))
    .catch(e => { console.error(tapar(e instanceof Fallo ? e.message : (e.stack || e))); process.exit(1); });
}
