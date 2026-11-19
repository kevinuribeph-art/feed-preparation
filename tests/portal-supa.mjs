// node tests/portal-supa.mjs — prueba de `portal/supa.js` sin red: un `fetch` falso que contesta como Supabase al pedir un
// código de entrada (D-241, D-247). PS1: el minuto de un correo dice los segundos que faltan · PS2: el tope de la hora de
// todo el portal no dice «un minuto» · PS3: un correo sin acceso no se distingue de uno con acceso · PS4: un error del
// servidor se dice como tal · PS5: subir da por subido solo un 409, nunca otro error que diga «exist» · PS6: archivo() da los
// bytes tal cual (lote 4 del traspaso, D-259).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../portal/supa.js', import.meta.url), 'utf8');
let respuesta = null;
const almacen = new Map();
const ctx = { console, setTimeout, clearTimeout, AbortController, Date, JSON, Math, Promise, Object, String, Error, Array,
  localStorage: { getItem: k => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v), removeItem: k => almacen.delete(k) },
  fetch: async (u, o) => { pedidos.push({ u, o }); return { ok: respuesta.status < 400, status: respuesta.status, text: async () => JSON.stringify(respuesta.cuerpo), blob: async () => respuesta.blob } } };
const pedidos = [];
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
S._sesion({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u', email: 'k@ejemplo.test' } });
const subir = async (status, cuerpo) => { respuesta = { status, cuerpo }; try { return { ok: await S.subir('mesa', 'files/x.jpg', { size: 1, type: 'image/jpeg' }, 'image/jpeg') }; } catch (e) { return { e }; } };
const a = await subir(409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }), b = await subir(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
const c = await subir(400, { statusCode: '400', error: 'InvalidKey', message: 'Object with that key does not exist yet' }), d = await subir(403, { message: 'new row violates row-level security policy' });
const e2 = await subir(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists', code: 'KeyAlreadyExists' });   // lo que contesta el Storage de Supabase (comprobado en pruebas, 19/11/2026)
ok(a.ok === true && b.ok === true && e2.ok === true && c.e && c.e.status === 400 && d.e && d.e.status === 403, 'PS5 subir: solo un 409 (o su cuerpo «Duplicate» / statusCode 409) cuenta como subido', JSON.stringify([a, b, e2, c.e && c.e.message, d.e && d.e.message]));
respuesta = { status: 200, blob: { size: 3, type: 'image/jpeg', bytes: 'abc' } };
const f = await S.archivo('mesa', 'files/x.jpg'), u = pedidos[pedidos.length - 1];
ok(f && f.bytes === 'abc' && /\/storage\/v1\/object\/authenticated\/mesa\/files\/x\.jpg$/.test(u.u) && /Bearer t$/.test(u.o.headers.Authorization), 'PS6 archivo() pide la ruta con la sesión y da sus bytes', u && u.u);
console.log(fallos ? `${fallos} fallos` : 'todo bien (6)'); process.exit(fallos ? 1 : 0);
