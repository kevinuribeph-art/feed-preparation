#!/usr/bin/env node
// Servidor del portal de clientes (Supabase) desde este Mac. Node 18+, sin dependencias.
// Las claves se leen del entorno o del `.env` del repo (sube carpetas hasta encontrarlo) y nunca se imprimen:
//   SUPABASE_ACCESS_TOKEN   token personal de la cuenta (aplicar el esquema y la configuración de la entrada)
//   SUPABASE_PRUEBAS_REF, SUPABASE_PRUEBAS_PUBLICA, SUPABASE_PRUEBAS_SECRETA   proyecto de pruebas
//   SUPABASE_REF, SUPABASE_PUBLICA, SUPABASE_SECRETA                           proyecto real
// Órdenes:
//   node tools/web.mjs estado <pruebas|real>          comprueba que las claves llegan (sin enseñarlas)
//   node tools/web.mjs esquema <pruebas|real>         aplica servidor/esquema.sql
//   node tools/web.mjs entrada <pruebas|real>         solo por invitación, código de 6 cifras que vale 10 min
//   node tools/web.mjs dueno <pruebas|real> <correo>  marca ese usuario como Kevin (lo ve todo)
//   node tools/web.mjs funciones <pruebas|real>       despliega servidor/funciones/firmar.ts (URL firmadas de lo que se puede ver)
//   node tools/web.mjs borrar-cliente <pruebas|real> <id>   borra sus archivos y todo lo suyo; el id no se vuelve a usar
import { readFileSync, existsSync } from 'node:fs';
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

const SECRETOS = () => ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PRUEBAS_SECRETA', 'SUPABASE_SECRETA'].map(clave).filter(Boolean);
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

export async function pedir(url, { method = 'GET', headers = {}, body } = {}) {
  let r;
  try {
    r = await fetch(url, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' || body instanceof Uint8Array || body instanceof FormData ? body : JSON.stringify(body)) });
  } catch (e) { throw new Fallo('sin conexión: ' + tapar(e.message)); }
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* no es JSON */ }
  // El JSON también sale tapado: una orden futura que lo imprima no puede sacar una clave (revisión del lote 1).
  let jt = j; try { jt = t ? JSON.parse(tapar(t)) : null; } catch (e) { jt = j; }
  return { ok: r.ok, status: r.status, json: jt, text: tapar(t).slice(0, 400) };
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
  const t = clave('SUPABASE_ACCESS_TOKEN');
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
    const codigo = readFileSync(join(AQUI, '..', 'servidor', 'funciones', 'firmar.ts'));
    const fd = new FormData();
    fd.append('metadata', JSON.stringify({ name: 'firmar', entrypoint_path: 'firmar.ts', verify_jwt: true }));
    fd.append('file', new Blob([codigo], { type: 'application/typescript' }), 'firmar.ts');
    const t = clave('SUPABASE_ACCESS_TOKEN'); if (!t) throw new Fallo('falta SUPABASE_ACCESS_TOKEN en .env');
    const r = await pedir(`https://api.supabase.com/v1/projects/${P.ref}/functions/deploy?slug=firmar`, { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd });
    if (!r.ok) throw new Fallo(`la función no se desplegó (${r.status}): ${r.text}`);
    return { proyecto: P.ref, funcion: 'firmar desplegada' };
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
