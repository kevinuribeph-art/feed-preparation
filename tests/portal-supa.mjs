// node tests/portal-supa.mjs — prueba de `portal/supa.js` sin red: un `fetch` falso que contesta como Supabase al pedir un
// código de entrada (D-241, D-247). PS1: el minuto de un correo dice los segundos que faltan · PS2: el tope de la hora de
// todo el portal no dice «un minuto» · PS3: un correo sin acceso no se distingue de uno con acceso · PS4: un error del
// servidor se dice como tal · PS5: subir da por subido solo un 409, nunca otro error que diga «exist» · PS6: archivo() da los
// bytes tal cual (lote 4 del traspaso, D-259). La entrada de la Mesa (D-262): PS7 la sesión donde diga `almacen` · PS8 entrar
// con contraseña y su error · PS9 nivel() lee aal y la hora del código · PS10 altaApp quita lo que quedó sin verificar · PS11
// verificarApp pone la sesión aal2 y dice si el código no vale · PS12 ponerContrasena, salirOtros y salir('local').
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../portal/supa.js', import.meta.url), 'utf8');
let respuesta = null;
const almacen = new Map();
const cola = [];
const ctx = { console, atob, setTimeout, clearTimeout, AbortController, Date, JSON, Math, Promise, Object, String, Error, Array,
  localStorage: { getItem: k => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v), removeItem: k => almacen.delete(k) },
  fetch: async (u, o) => { pedidos.push({ u, o }); const respuesta_ = cola.length ? cola.shift() : respuesta; return { ok: respuesta_.status < 400, status: respuesta_.status, text: async () => JSON.stringify(respuesta_.cuerpo), blob: async () => respuesta_.blob } } };
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

// ---- La entrada de la Mesa (D-262) ----
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = c => 'x.' + b64(c) + '.y';
const ahora = Math.floor(Date.now() / 1000);
const t1 = jwt({ sub: 'u', aal: 'aal1', amr: [{ method: 'password', timestamp: ahora }], session_id: 's1' });
const t2 = jwt({ sub: 'u', aal: 'aal2', amr: [{ method: 'totp', timestamp: ahora - 5 }, { method: 'password', timestamp: ahora - 9 }], session_id: 's1' });
const guardadas = []; let oyente = null;
const M = ctx.Supa.crear({ url: 'https://abcdefghij.supabase.co', publica: 'p', clave: 'mesa', almacen: { leer: () => null, guardar: s => guardadas.push(s), oir: f => { oyente = f; } } });
const enLocal = [...almacen.keys()].filter(k => k === 'mesa');
respuesta = { status: 200, cuerpo: { access_token: t1, refresh_token: 'r1', expires_in: 3600, user: { id: 'u', email: 'k@ejemplo.test' } } };
const u1 = await M.entrarConContrasena('k@ejemplo.test', 'una-contraseña-de-veinte');
ok(u1 && u1.id === 'u' && guardadas.length === 1 && guardadas[0].refresh_token === 'r1' && !almacen.has('mesa') && !enLocal.length, 'PS7 con `almacen`, la sesión va allí y nunca a localStorage');
oyente({ access_token: t2, refresh_token: 'r9', expires_at: ahora + 3600, user: { id: 'u', email: 'k@ejemplo.test' } });
ok(M.nivel().aal === 'aal2', 'PS7 y lo que oye de otra pestaña la pone al día');
oyente({ access_token: t1, refresh_token: 'r1', expires_at: ahora + 3600, user: { id: 'u', email: 'k@ejemplo.test' } });
const ped = pedidos[pedidos.length - 1];
let e8; respuesta = { status: 400, cuerpo: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
try { await M.entrarConContrasena('k@ejemplo.test', 'mal'); } catch (e) { e8 = e; }
ok(/grant_type=password$/.test(ped.u) && JSON.parse(ped.o.body).password === 'una-contraseña-de-veinte' && e8 && e8.codigo === 'credenciales' && /correo o la contraseña/.test(e8.message), 'PS8 entrar con contraseña y «el correo o la contraseña no son correctos»', e8 && e8.message);
const n1 = M.nivel();
ok(n1 && n1.aal === 'aal1' && n1.totp === null && n1.sesion === 's1', 'PS9 nivel(): aal1 sin código', JSON.stringify(n1));
pedidos.length = 0;
cola.push({ status: 200, cuerpo: { id: 'u', factors: [{ id: 'f-viejo', factor_type: 'totp', status: 'unverified', friendly_name: 'Contraseñas' }] } }, { status: 200, cuerpo: {} },
  { status: 200, cuerpo: { id: 'f-nuevo', type: 'totp', totp: { qr_code: '<svg/>', secret: 'ABCDEFGH', uri: 'otpauth://totp/x' } } });
const al = await M.altaApp();
ok(al.id === 'f-nuevo' && al.qr === '<svg/>' && al.clave === 'ABCDEFGH' && pedidos[1].o.method === 'DELETE' && /factors\/f-viejo$/.test(pedidos[1].u)
  && JSON.parse(pedidos[2].o.body).issuer === 'Mesa Uribe Visuals', 'PS10 altaApp quita el alta a medias y da QR y clave', JSON.stringify(al));
cola.push({ status: 200, cuerpo: { id: 'ch1' } }, { status: 200, cuerpo: { access_token: t2, refresh_token: 'r2', expires_in: 3600 } });
const n2 = await M.verificarApp('f-nuevo', '123 456');
const vb = JSON.parse(pedidos[pedidos.length - 1].o.body);
ok(n2.aal === 'aal2' && n2.totp === ahora - 5 && vb.code === '123456' && vb.challenge_id === 'ch1' && guardadas[guardadas.length - 1].refresh_token === 'r2' && M.usuario().email === 'k@ejemplo.test', 'PS11 verificarApp: sesión aal2 con la hora del código, guardada, sin perder el usuario', JSON.stringify(n2));
let e11; cola.push({ status: 200, cuerpo: { id: 'ch2' } }, { status: 422, cuerpo: { code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' } });
try { await M.verificarApp('f-nuevo', '000000'); } catch (e) { e11 = e; }
ok(e11 && e11.codigo === 'codigo' && M.nivel().aal === 'aal2', 'PS11 un código que no vale lo dice y no toca la sesión', e11 && e11.message);
let e12; respuesta = { status: 422, cuerpo: { code: 422, error_code: 'weak_password', msg: 'Password should be at least 20 characters.' } };
try { await M.ponerContrasena('corta'); } catch (e) { e12 = e; }
respuesta = { status: 200, cuerpo: { id: 'u' } };
const pc = await M.ponerContrasena('otra-contraseña-de-veinte'), pp = pedidos[pedidos.length - 1];
await M.salirOtros(); const so = pedidos[pedidos.length - 1];
await M.salir('local'); const sl = pedidos[pedidos.length - 1];
ok(e12 && e12.codigo === 'debil' && pc === true && pp.o.method === 'PUT' && /\/auth\/v1\/user$/.test(pp.u) && /logout\?scope=others$/.test(so.u) && /logout\?scope=local$/.test(sl.u) && M.usuario() === null,
  'PS12 contraseña corta lo dice; nueva, salir de los demás y salir solo de aquí', e12 && e12.message);
// PS13 (revisión): antes de renovar, la sesión más nueva del almacén (otra pestaña ya la renovó): nunca un refresh token viejo
let enAlm = null;
const M2 = ctx.Supa.crear({ url: 'https://abcdefghij.supabase.co', publica: 'p', clave: 'm2', almacen: { leer: () => enAlm, guardar: s => { enAlm = s; }, oir: () => {} } });
M2._sesion({ access_token: t1, refresh_token: 'viejo', expires_at: ahora + 30, user: { id: 'u', email: 'k@ejemplo.test' } });
enAlm = { access_token: t2, refresh_token: 'nuevo', expires_at: ahora + 3600, user: { id: 'u', email: 'k@ejemplo.test' } };
pedidos.length = 0; respuesta = { status: 200, cuerpo: [] };
await M2.leer('clientes');
ok(!pedidos.some(x => /grant_type=refresh_token/.test(x.u)) && /Bearer x\./.test(pedidos[0].o.headers.Authorization) && pedidos[0].o.headers.Authorization.endsWith(t2.slice(-10)), 'PS13 toma la renovada por otra pestaña en vez de renovar con la vieja');
console.log(fallos ? `${fallos} fallos` : 'todo bien (15)'); process.exit(fallos ? 1 : 0);
