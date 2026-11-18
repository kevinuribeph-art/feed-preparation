// node tests/portal-supa.mjs — prueba de `portal/supa.js` sin red: un `fetch` falso que contesta como Supabase al pedir un
// código de entrada (D-241, D-247). PS1: el minuto de un correo dice los segundos que faltan · PS2: el tope de la hora de
// todo el portal no dice «un minuto» · PS3: un correo sin acceso no se distingue de uno con acceso · PS4: un error del
// servidor se dice como tal.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../portal/supa.js', import.meta.url), 'utf8');
let respuesta = null;
const almacen = new Map();
const ctx = { console, setTimeout, clearTimeout, AbortController, Date, JSON, Math, Promise, Object, String, Error, Array,
  localStorage: { getItem: k => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v), removeItem: k => almacen.delete(k) },
  fetch: async () => ({ ok: respuesta.status < 400, status: respuesta.status, text: async () => JSON.stringify(respuesta.cuerpo) }) };
ctx.window = ctx;
vm.createContext(ctx); vm.runInContext(codigo, ctx);
const S = ctx.Supa.crear({ url: 'https://abcdefghij.supabase.co', publica: 'p', clave: 'prueba' });
let fallos = 0;
const ok = (c, t, x) => { console.log((c ? '  ok    ' : '  FALLO ') + t + (c || x == null ? '' : ' · ' + x)); if (!c) fallos++; };
async function pedir(status, cuerpo) { respuesta = { status, cuerpo }; try { return { ok: await S.pedirCodigo('ana@ejemplo.test') }; } catch (e) { return { e }; } }

let r = await pedir(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 42 seconds.' });
ok(r.e && r.e.status === 429 && /espera 42 segundos/.test(r.e.message) && !/minuto/.test(r.e.message), 'PS1 el minuto de un correo dice cuánto falta', r.e && r.e.message);
r = await pedir(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' });
ok(r.e && r.e.status === 429 && /muchos códigos/.test(r.e.message) && !/minuto/.test(r.e.message), 'PS2 el tope de la hora no dice «un minuto»', r.e && r.e.message);
r = await pedir(400, { code: 400, msg: 'Signups not allowed for otp' });
ok(r.ok === true, 'PS3 un correo sin acceso se da por enviado', JSON.stringify(r));
r = await pedir(502, { msg: 'Bad gateway' });
ok(r.e && r.e.codigo === 'servidor', 'PS4 un error del servidor se dice como tal', r.e && r.e.message);
console.log(fallos ? `${fallos} fallos` : 'todo bien (4)'); process.exit(fallos ? 1 : 0);
