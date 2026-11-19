// El código de la app (TOTP, D-262) para los usuarios inventados de las pruebas contra el proyecto de pruebas. Node 18+, sin
// dependencias. Calcula los códigos como Contraseñas de Apple (RFC 6238: SHA-1, 6 cifras, 30 s). Nunca imprime el secreto.
//   conCodigo(P, token) → la misma sesión con el código escrito (`aal2`): quita antes los factores que tuviera esa cuenta (con la
//   clave secreta), da de alta uno nuevo y lo verifica. Devuelve {access_token, refresh_token, factor, secreto}.
//   codigoDe(secreto, ms) → las 6 cifras de ese momento.
import { createHmac } from 'node:crypto';
import { pedir, cab, Fallo } from '../tools/web.mjs';

const DEJAR = ['access_token', 'refresh_token', 'secret'];
const J = { 'Content-Type': 'application/json' };

function base32(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; const o = [];
  for (const ch of String(s).replace(/=+$/, '').toUpperCase()) { const i = A.indexOf(ch); if (i < 0) throw new Fallo('secreto TOTP raro'); bits += i.toString(2).padStart(5, '0'); }
  for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(o);
}
export function codigoDe(secreto, ms = Date.now()) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(ms / 30000)));
  const h = createHmac('sha1', base32(secreto)).update(c).digest(), o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
export const claims = tk => JSON.parse(Buffer.from(String(tk).split('.')[1], 'base64url').toString());

export const auth = (P, ruta, o = {}) => pedir(`${P.url}/auth/v1/${ruta}`, { method: o.method || 'POST', headers: { ...cab(P.publica, o.token), ...J }, body: o.body, dejar: DEJAR });
export const admin = (P, ruta, o = {}) => pedir(`${P.url}/auth/v1/admin/${ruta}`, { method: o.method || 'GET', headers: { ...cab(P.secreta), ...J }, body: o.body, dejar: DEJAR });

// Verifica un código sobre una sesión. Si Supabase no acepta repetir el código de la misma ventana de 30 s, espera a la siguiente.
export async function verificar(P, token, factor, secreto) {
  for (let i = 0; i < 2; i++) {
    const ch = await auth(P, `factors/${factor}/challenge`, { token, body: {} });
    if (!ch.ok) throw new Fallo('challenge: ' + ch.text);
    const v = await auth(P, `factors/${factor}/verify`, { token, body: { challenge_id: ch.json.id, code: codigoDe(secreto) } });
    if (v.ok) return v.json;
    if (i === 0) await new Promise(r => setTimeout(r, 30000 - (Date.now() % 30000) + 1200));
    else throw new Fallo('verify: ' + v.text);
  }
}

export async function conCodigo(P, token) {
  const uid = claims(token).sub;
  if (!/^[0-9a-f-]{36}$/.test(uid || '')) throw new Fallo('token sin usuario');
  const u = await admin(P, `users/${uid}`);
  for (const f of (u.json && u.json.factors) || []) await admin(P, `users/${uid}/factors/${f.id}`, { method: 'DELETE' });
  const en = await auth(P, 'factors', { token, body: { factor_type: 'totp', friendly_name: 'Prueba', issuer: 'Mesa Uribe Visuals' } });
  if (!en.ok) throw new Fallo('alta del factor: ' + en.text);
  const s = await verificar(P, token, en.json.id, en.json.totp.secret);
  return { access_token: s.access_token, refresh_token: s.refresh_token, factor: en.json.id, secreto: en.json.totp.secret };
}
