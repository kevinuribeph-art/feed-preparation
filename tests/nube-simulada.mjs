#!/usr/bin/env node
// node tests/nube-simulada.mjs — prueba del núcleo de `nube.js` (traspaso C, lote 3: `window.NubeNucleo`) sin red ni
// dependencias, a partir de la costura escrita en `.claude/rediseno/traspaso/contrato.md` («Nube (lote 3)»). Tres dobles:
// un servidor simulado en memoria que contesta como las funciones `mesa_*` (rechazos con HTTP 200 en el cuerpo, versiones,
// choques, páginas, época, topes medidos como jsonb), un almacén simulado con la interfaz del contrato sobre `Map`s y un
// reloj falso que solo avanza cuando la prueba lo mueve. Dos ordenadores inventados (A y B) comparten un servidor, cada uno
// con su almacén. NS0 la costura · NS1 turno en dos fases · NS2 latido y forzar · NS3 versiones y páginas · NS4 bajar al
// abrir · NS5 sin red y cola · NS6 reescanear · NS7 reconciliar · NS8 topes y rechazos · NS9 serializar · NS10 avisos.
// Para probar un borrador en otra ruta: NUBE_JS=/ruta/a/nube.js node tests/nube-simulada.mjs
//
// Supuestos (donde el contrato calla; se prueba de la forma más laxa que siga atrapando el fallo):
// - Todo lo del núcleo se espera con `await` (puede devolver Promise o valor); `estado()` puede ser síncrona.
// - `tic()` se llama cada segundo aunque el anterior no haya acabado (como la Mesa): el núcleo se protege solo. Las pruebas
//   mueven el reloj de segundo en segundo y llaman `tic()` de los núcleos vivos.
// - `usarAqui`, `forzar`, `subirEncima`, `descartar` y `parar` acaban solos con el reloj avanzando (con `tic` o sin él).
// - `forzar(visto)`: `visto` es el número de turno que el servidor tiene en ese momento (el que B vio al pedir); `{espera}`
//   no lo trae, así que la prueba lo lee del servidor simulado.
// - Date: el núcleo puede usar `Date.parse` (horas del servidor); NS0.5 solo cuenta `new Date()` y `Date.now()`.
// - `efectos.recargar()` se simula creando otro núcleo con el mismo almacén; el viejo queda congelado (sus esperas no vencen
//   y sus llamadas no salen). «Cerrarse de golpe» y «dormirse» son lo mismo: congelado (y, si vuelve, descongelado).
// - Sin red, cada llamada se rechaza al momento (`{status: 0, codigo: 'red'}`); «sin respuesta» cuelga la llamada.
// - La cesión se mide desde el primer `pedir` de B hasta `pausar` de A: ≤ `TIEMPOS.latido` + 1 s (el tic va por segundos).
// - Sin red, los reintentos pueden ir hasta el último de `TIEMPOS.reintento`: tras volver la red se esperan 90 s.
// - `subirEncima`: no se exige que la quite de «quedó sin subir» (el contrato solo lo dice de `descartar`).
// - Ante un `ok: false` con un código que el contrato no nombra solo se exige que no se dé por guardado: sigue en el diario
//   o en «quedó sin subir», sin versión conocida. El `motivo` de lo apartado por `forma` con `indice` y por un 400 no se mira.
// - `app`/`permiso` en una escritura: lo pendiente no se pierde (diario o «quedó sin subir»); no se exige cuál.
// - Abierta en `local` y de vuelta la red con la Mesa `libre`: basta con que `estado().fase` sea (o haya sido) `recargar`.
// - Reescanear sin haber bajado entero: vale no reescanear, o reescanear solo después de una bajada que acabe en `mas` falso.
// - `avisos()` del núcleo da filas con `id` (o los ids). El núcleo guarda `meta.turno` al tener el turno (lo usa NS5).
// - El almacén simulado guarda copias (`structuredClone`), como IndexedDB; `apartar` de una marca `{a, k: null}` la quita
//   del diario y la deja en la lista con `k: null` (no se exige). Dos almacenes se comparan sin mirar el orden de las claves
//   y dando por iguales un Blob y una referencia con el mismo tamaño y tipo (como `igual`).
// - El servidor simulado mide los topes como jsonb aproximado (bytes UTF-8 de JSON.stringify + un byte por cada `:` y `,`
//   de estructura) y corta las páginas de `mesa_bajar` por `limite` y ~4 MB. Sus horas son las del reloj falso.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const RUTA = process.env.NUBE_JS ? pathToFileURL(process.env.NUBE_JS) : new URL('../nube.js', import.meta.url);
if (!existsSync(RUTA)) { console.log('falta nube.js (lote 3): esta prueba carga ../nube.js y todavía no existe'); process.exit(1); }

// ── nube.js como en el navegador, sin MESA. Date, setTimeout y setInterval están, pero se cuentan: el núcleo no los usa ──
let usoDate = 0, usoTemporizador = 0, contarDate = true;
class DateEspia extends Date {
  constructor(...a) { super(...a); if (contarDate) usoDate++; }
  static now() { if (contarDate) usoDate++; return Date.now(); }
}
const ctx = { console, Promise, JSON, Math, Object, Array, String, Number, Boolean, Symbol, Error, TypeError, RangeError,
  Map, Set, WeakMap, WeakSet, RegExp, TextEncoder, TextDecoder, Blob, File, ArrayBuffer, Uint8Array, DataView,
  crypto: globalThis.crypto, structuredClone, queueMicrotask, isFinite, isNaN, parseInt, parseFloat, Date: DateEspia,
  setTimeout: (...a) => { usoTemporizador++; return setTimeout(...a); }, setInterval: (...a) => { usoTemporizador++; return setInterval(...a); },
  clearTimeout, clearInterval };
ctx.window = ctx;
vm.createContext(ctx);
try { vm.runInContext(readFileSync(RUTA, 'utf8'), ctx, { filename: 'nube.js' }); }
catch (e) { console.log('nube.js no carga en Node sin MESA: ' + ((e && e.stack) || e)); process.exit(1); }
const N = ctx.NubeNucleo;
if (!N || typeof N.crear !== 'function') { console.log('nube.js no deja window.NubeNucleo.crear'); process.exit(1); }

let fallos = 0, n = 0, terminado = false;
const corto = x => { let s; try { s = typeof x === 'string' ? x : JSON.stringify(x, (k, v) => esBlobN(v) ? `<Blob ${v.size} ${v.type}>` : v); } catch { s = String(x); } return String(s).slice(0, 500); };
const ok = (c, t, extra) => { n++; if (c) console.log('  ok    ' + t); else { fallos++; console.log('  FALLO ' + t + (extra === undefined ? '' : ' · ' + corto(extra))); } return !!c; };
async function grupo(nombre, fn) { console.log(nombre); try { await fn(); } catch (e) { ok(false, nombre + ': se cortó con una excepción', (e && (e.stack || e.message)) || e); } }
process.on('beforeExit', () => { if (!terminado) { console.log(`  FALLO la prueba se quedó esperando una promesa que no acaba (${fallos} fallos de ${n} hasta aquí)`); process.exitCode = 1; } });
setTimeout(() => { console.log(`  FALLO la prueba tardó más de 3 minutos (${fallos} fallos de ${n} hasta aquí)`); process.exit(1); }, 180000).unref();

// ── Utilidades ──
const DA = 'prueba-a-0001', DB = 'prueba-b-0002', DC = 'prueba-c-0003';   // ordenadores inventados
const APP = '4.32';
const TIEMPOS = N.TIEMPOS || {};
const LATIDO = TIEMPOS.latido ?? 5000, ESPERA = TIEMPOS.espera ?? 20000, PRIMERA = TIEMPOS.primera ?? 4000, ACTIVIDAD = TIEMPOS.actividad ?? 60000;
const TOPES = N.TOPES || { cambios: 500, valor: 1950000, lote: 3600000 };
const iso = t => (t == null ? null : new Date(t).toISOString());
const mismaHora = (x, t) => x === iso(t) || x === t || (typeof x === 'string' && Date.parse(x) === t);
const esBlobN = x => x != null && typeof x === 'object' && typeof x.size === 'number' && typeof x.type === 'string' && typeof x.arrayBuffer === 'function';
const sha = b => createHash('sha256').update(b).digest('hex');
let enVuelo = 0;
const huella = async b => { enVuelo++; try { if (b.type === 'image/x-ilegible') throw Object.assign(new Error('no se puede leer'), { name: 'NotReadableError' }); return sha(Buffer.from(await b.arrayBuffer())); } finally { enVuelo--; } };   // un Blob que IndexedDB ya no puede leer (NS11)
const refDe = (texto, tipo = 'image/jpeg') => ({ __blob: 'pendiente', sha256: sha(Buffer.from(texto)), tam: Buffer.byteLength(texto), tipo });
// texto canónico sin orden de claves; Blob y referencia, iguales con el mismo tamaño y tipo (para comparar almacenes)
const canon = v => {
  if (esBlobN(v)) return `"blob:${v.size}:${v.type}"`;
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.__blob === 'string') return `"blob:${v.tam}:${v.tipo}"`;
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return v === undefined ? 'undefined' : JSON.stringify(v);
};
const mismo = (a, b) => canon(a) === canon(b);
// el igual de jsonb (el del servidor): sin orden de claves y sin trato especial de las referencias
const canonS = v => Array.isArray(v) ? '[' + v.map(canonS).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonS(v[k])).join(',') + '}' : JSON.stringify(v);
const clon = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function estructura(v) {   // los `:` y `,` de estructura de JSON.stringify(v)
  if (Array.isArray(v)) return Math.max(v.length - 1, 0) + v.reduce((s, x) => s + estructura(x), 0);
  if (v && typeof v === 'object') { const ks = Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function'); return ks.length + Math.max(ks.length - 1, 0) + ks.reduce((s, k) => s + estructura(v[k]), 0); }
  return 0;
}
const bytesJson = v => Buffer.byteLength(JSON.stringify(v), 'utf8');
const jsonbDe = v => bytesJson(v) + estructura(v);
const ent = x => Number.isInteger(x);
const DISP_RE = /^[A-Za-z0-9_-]{8,64}$/, APP_RE = /^\d{1,4}\.\d{1,4}$/, ALMACEN_RE = /^[a-z][a-z0-9_]{0,39}$/;
const masVieja = (a, b) => { const [a1, a2] = a.split('.').map(Number), [b1, b2] = b.split('.').map(Number); return a1 < b1 || (a1 === b1 && a2 < b2); };
const tick = () => new Promise(r => setImmediate(r));
async function vaciar() { let quietos = 0; for (let i = 0; i < 4000 && quietos < 6; i++) { await tick(); quietos = enVuelo > 0 ? 0 : quietos + 1; } }
function textoMalo(v, vistos = new Set()) {   // lo que jsonb no admite: \u0000 (22P05) y un sustituto UTF-16 suelto (22P02)
  if (typeof v === 'string') return v.includes('\u0000') ? '22P05' : !v.isWellFormed() ? '22P02' : null;
  if (v && typeof v === 'object' && !vistos.has(v)) {
    vistos.add(v);
    for (const k of Object.keys(v)) { const m = textoMalo(k) || textoMalo(v[k], vistos); if (m) return m; }
  }
  return null;
}
const hayBlob = (v, vistos = new Set()) => esBlobN(v) || (v && typeof v === 'object' && !vistos.has(v) && (vistos.add(v), Object.values(v).some(x => hayBlob(x, vistos))));

// ── Reloj falso: `esperar(ms)` solo vence cuando la prueba avanza el reloj; las de un núcleo congelado no vencen ──
function relojFalso(t0 = Date.UTC(2026, 10, 18, 9, 0, 0)) {
  const esperas = [], congelados = new Set(); let sec = 0;
  const R = {
    t: t0, desbordes: 0,
    esperar: (ms, dueno) => new Promise(res => esperas.push({ at: R.t + Math.max(0, Number(ms) || 0), res, n: sec++, dueno })),
    congelar: d => congelados.add(d), descongelar: d => congelados.delete(d),
    async avanzar(ms) {
      const fin = R.t + ms;
      for (let vueltas = 0; ; vueltas++) {
        await vaciar();
        let e = null;
        for (const x of esperas) if (x.at <= fin && !congelados.has(x.dueno) && (!e || x.at < e.at || (x.at === e.at && x.n < e.n))) e = x;
        if (!e) break;
        if (vueltas > 3000) { R.desbordes++; break; }   // un núcleo que espera 0 ms en bucle
        esperas.splice(esperas.indexOf(e), 1);
        if (e.at > R.t) R.t = e.at;
        e.res();
      }
      R.t = fin; await vaciar();
    },
  };
  return R;
}

// ── Servidor simulado: un `mesa` en memoria que contesta como las funciones del contrato ──
function servidorSimulado(reloj) {
  const S = {
    registros: new Map(), historial: [], actividad: [], dispositivos: new Set(),
    turno: { numero: 0, dispositivo: null, desde: null, latido: null, cola: 0, cola_desde: null, pide: null, pide_desde: null, pide_ultima: null, orden: 0 },
    version_minima: '0.0', epoca: 'epoca-' + Math.random().toString(16).slice(2, 10),
    topes: { cambios: 500, valor: 2097152, lote: 4194304 }, paginaBytes: 4194304, filasPorPagina: null,
    malas: new Set(),     // «almacén|clave» que hacen que el lote entero dé HTTP 400 22P05 (antes de llegar a la función)
    formaSi: null,        // c => true: ese cambio sale como `forma` con su `indice`
    escribirRaro: 0,      // n respuestas `ok: false` con un código que el contrato no nombra
  };
  const ahora = () => reloj.t;
  const hace = t => (t == null ? null : Math.max(0, Math.floor((ahora() - t) / 1000)));
  const K = (a, k) => a + '|' + k;
  let actId = 0;
  const anotar = (tipo, d, detalle) => S.actividad.push({ id: ++actId, hora: iso(ahora()), tipo, usuario: 'u-prueba', sesion: 's-prueba', dispositivo: DISP_RE.test(d || '') ? d : null, detalle });
  const rech = (fn, d, codigo, http, mensaje, mas = {}) => { anotar('rechazo', d, { funcion: fn, codigo, http }); return { ok: false, error: { codigo, http, mensaje, ...mas }, epoca: S.epoca }; };
  const forma = (fn, d, m, mas) => rech(fn, d, 'forma', 400, m || 'forma', mas);
  const vieja = (fn, d, app) => masVieja(app, S.version_minima) ? rech(fn, d, 'app', 426, 'la Mesa es más vieja que la mínima', { version_minima: S.version_minima }) : null;
  function respTurno(d) {
    const T = S.turno;
    return { ok: true, turno: T.numero, tuyo: T.dispositivo != null && T.dispositivo === d, libre: T.dispositivo == null,
      tiene: T.dispositivo == null ? null : { dispositivo: T.dispositivo, desde: iso(T.desde), latido: iso(T.latido), latido_hace: hace(T.latido), cola: T.cola, cola_desde: iso(T.cola_desde), cola_hace: hace(T.cola_desde) },
      pide: T.pide == null ? null : { dispositivo: T.pide, desde: iso(T.pide_desde), hace: hace(T.pide_desde), ultima: iso(T.pide_ultima), ultima_hace: hace(T.pide_ultima), tuyo: T.pide === d },
      orden: T.orden, version_minima: S.version_minima, epoca: S.epoca, hora: iso(ahora()) };
  }
  const F = {
    mesa_turno_ver({ dispositivo: d }) { return DISP_RE.test(d || '') ? respTurno(d) : forma('mesa_turno_ver', d); },
    mesa_turno_pedir({ dispositivo: d, app }) {
      const fn = 'mesa_turno_pedir', T = S.turno;
      if (!DISP_RE.test(d || '') || !APP_RE.test(app || '')) return forma(fn, d);
      const v = vieja(fn, d, app); if (v) return v;
      if (T.dispositivo === d) return respTurno(d);
      if (T.pide !== d) { T.pide = d; T.pide_desde = ahora(); }
      T.pide_ultima = ahora();
      return respTurno(d);
    },
    mesa_turno_latido({ dispositivo: d, turno, app, cola }) {
      const fn = 'mesa_turno_latido', T = S.turno;
      if (!DISP_RE.test(d || '') || !APP_RE.test(app || '') || !ent(turno) || !ent(cola) || cola < 0) return forma(fn, d);
      const v = vieja(fn, d, app); if (v) return v;
      if (T.dispositivo !== d || T.numero !== turno) return rech(fn, d, 'turno', 423, `la Mesa la tiene otro ordenador (turno ${T.numero})`, { turno: T.numero });
      T.latido = ahora(); T.cola = cola;
      if (cola > 0) { if (T.cola_desde == null) T.cola_desde = ahora(); } else T.cola_desde = null;
      return respTurno(d);
    },
    mesa_turno_reclamar({ dispositivo: d, visto, app, forzar = false }) {
      const fn = 'mesa_turno_reclamar', T = S.turno;
      if (!DISP_RE.test(d || '') || !APP_RE.test(app || '') || !ent(visto) || visto < 0 || typeof forzar !== 'boolean') return forma(fn, d);
      const v = vieja(fn, d, app); if (v) return v;
      if (T.dispositivo === d) return respTurno(d);
      if (!forzar && T.dispositivo != null) return rech(fn, d, 'turno', 423, 'la Mesa la tiene otro ordenador', { turno: T.numero, dispositivo: T.dispositivo });
      if (forzar && visto !== T.numero) return rech(fn, d, 'turno_cambiado', 409, 'el turno cambió', { turno: T.numero });
      const antes = { d: T.dispositivo, n: T.numero, latido: T.latido, cola: T.cola, cola_desde: T.cola_desde };
      T.numero++; T.dispositivo = d; T.desde = T.latido = ahora(); T.cola = 0; T.cola_desde = null;
      if (T.pide === d) T.pide = T.pide_desde = T.pide_ultima = null;
      anotar('turno_reclamado', d, { turno: T.numero, antes: antes.d, forzado: !!(forzar && antes.d), app });
      if (forzar && antes.d) anotar('turno_forzado', d, { turno: T.numero, antes: antes.d, turno_antes: antes.n, latido: iso(antes.latido), latido_hace: hace(antes.latido), cola: antes.cola, cola_desde: iso(antes.cola_desde) });
      if (!S.dispositivos.has(d)) { S.dispositivos.add(d); anotar('dispositivo_nuevo', d, { turno: T.numero, antes: antes.d }); }
      return respTurno(d);
    },
    mesa_turno_soltar({ dispositivo: d, turno }) {
      const fn = 'mesa_turno_soltar', T = S.turno;
      if (!DISP_RE.test(d || '') || !ent(turno)) return forma(fn, d);
      if (T.dispositivo !== d || T.numero !== turno) return rech(fn, d, 'turno', 423, 'no es tu turno', { turno: T.numero });
      T.dispositivo = T.desde = T.latido = T.cola_desde = null; T.cola = 0;
      return respTurno(d);
    },
    mesa_escribir(a) {
      const fn = 'mesa_escribir', d = a.dispositivo, T = S.turno;
      if (S.escribirRaro > 0) { S.escribirRaro--; return { ok: false, error: { codigo: 'raro', http: 500, mensaje: 'un rechazo que el contrato no nombra (simulado)' }, epoca: S.epoca }; }
      if (!DISP_RE.test(d || '') || !APP_RE.test(a.app || '') || !ent(a.turno) || (a.reescanear != null && typeof a.reescanear !== 'boolean')) return forma(fn, d);
      const cambios = a.cambios;
      if (!Array.isArray(cambios) || !cambios.length) return forma(fn, d, 'cambios: una lista no vacía');
      const v = vieja(fn, d, a.app); if (v) return v;
      if (cambios.length > S.topes.cambios) return rech(fn, d, 'tope', 413, 'demasiados cambios', { tope: 'cambios', maximo: S.topes.cambios, tiene: cambios.length });
      const tl = jsonbDe(cambios);
      if (tl > S.topes.lote) return rech(fn, d, 'tope', 413, 'lote demasiado grande', { tope: 'lote', maximo: S.topes.lote, tiene: tl });
      for (let i = 0; i < cambios.length; i++) {
        const c = cambios[i];
        const bien = c && typeof c === 'object' && !Array.isArray(c) && typeof c.almacen === 'string' && ALMACEN_RE.test(c.almacen)
          && typeof c.clave === 'string' && c.clave.length >= 1 && c.clave.length <= 512 && (c.base == null || (ent(c.base) && c.base >= 0))
          && Object.prototype.hasOwnProperty.call(c, 'valor') && !(S.formaSi && S.formaSi(c));
        if (!bien) return forma(fn, d, 'cambio mal formado', { indice: i + 1 });
        if (c.valor !== null) { const tv = jsonbDe(c.valor); if (tv > S.topes.valor) return rech(fn, d, 'tope', 413, 'valor demasiado grande', { tope: 'valor', maximo: S.topes.valor, tiene: tv, almacen: c.almacen, clave: c.clave }); }
      }
      const vistos = new Set();
      for (let i = 0; i < cambios.length; i++) { const k = K(cambios[i].almacen, cambios[i].clave); if (vistos.has(k)) return forma(fn, d, 'registro repetido', { indice: i + 1 }); vistos.add(k); }
      if (T.dispositivo !== d || T.numero !== a.turno) return rech(fn, d, 'turno', 423, `la Mesa la tiene otro ordenador (turno ${T.numero})`, { turno: T.numero });
      const t = ahora(), resultados = []; let borrados = 0; const almacenes = {}, claves = [];
      for (const c of cambios) {
        const key = K(c.almacen, c.clave), r = S.registros.get(key), base = c.base == null ? 0 : c.base, val = c.valor;
        const id = { almacen: c.almacen, clave: c.clave };
        const choque = x => { const res = { ...id, estado: 'choque', ultima: x ? x.version : 0, borrado: x ? x.valor === null : false, orden: x ? x.orden : null, dispositivo: x ? x.dispositivo : null, turno: x ? x.turno : null }; anotar('choque', d, { ...id, base, ultima: res.ultima, de: res.dispositivo, turno_de: res.turno, app: a.app }); return res; };
        if (!r) {
          if (val === null) resultados.push({ ...id, estado: 'igual', version: 0 });
          else if (base === 0) { const nuevo = { ...id, valor: val, version: 1, orden: ++T.orden, app: a.app, dispositivo: d, turno: a.turno, hora: t, borrado: null }; S.registros.set(key, nuevo); resultados.push({ ...id, estado: 'ok', version: 1, orden: nuevo.orden }); }
          else resultados.push(choque(null));
          continue;
        }
        const vivo = r.valor !== null;
        if ((val === null && !vivo) || (val !== null && vivo && canonS(val) === canonS(r.valor))) { resultados.push({ ...id, estado: 'igual', version: r.version }); continue; }
        if ((vivo && base === r.version) || (!vivo && (base === r.version || base === 0))) {
          if (vivo) {
            const ultimo = S.historial.filter(h => h.almacen === r.almacen && h.clave === r.clave).pop();
            if (r.dispositivo !== d || r.turno !== a.turno || val === null || !ultimo || t - ultimo.guardada >= 300000) S.historial.push({ ...r, guardada: t });
            if (val === null) { borrados++; almacenes[c.almacen] = (almacenes[c.almacen] || 0) + 1; claves.push(c.almacen + '/' + c.clave); }
          }
          Object.assign(r, { valor: val, version: r.version + 1, orden: ++T.orden, app: a.app, dispositivo: d, turno: a.turno, hora: t, borrado: val === null ? t : null });
          resultados.push({ ...id, estado: 'ok', version: r.version, orden: r.orden });
        } else resultados.push(choque(r));
      }
      T.latido = t;
      if (borrados > 20 || (a.reescanear && borrados > 0)) anotar('borrado_masivo', d, { cuantos: borrados, reescanear: !!a.reescanear, almacenes, claves: claves.slice(0, 10), app: a.app });
      return { ok: true, turno: T.numero, orden: T.orden, hora: iso(t), epoca: S.epoca, resultados };
    },
    mesa_bajar(a) {
      const fn = 'mesa_bajar', T = S.turno, desde = a.desde;
      if (!ent(desde) || desde < 0) return forma(fn, a.dispositivo);
      if (desde > T.orden) return rech(fn, a.dispositivo, 'cursor', 409, 'cursor de otra época', { orden: T.orden });
      const lim = Math.min(Math.max(a.limite === undefined ? 500 : ent(a.limite) ? a.limite : 500, 1), 500);
      const leido = T.orden, maxFilas = S.filasPorPagina ? Math.min(lim, S.filasPorPagina) : lim;
      const filas = [...S.registros.values()].filter(r => r.orden > desde && r.orden <= leido).sort((x, y) => x.orden - y.orden);
      const pag = []; let bytes = 0;
      for (const r of filas) { if (pag.length >= maxFilas) break; const b = r.valor === null ? 4 : jsonbDe(r.valor); if (pag.length && bytes + b > S.paginaBytes) break; pag.push(r); bytes += b; }
      const mas = pag.length < filas.length;
      let hasta = pag.length ? pag[pag.length - 1].orden : desde;
      if (!mas) hasta = Math.max(hasta, leido);
      return { ok: true, filas: pag.map(r => ({ almacen: r.almacen, clave: r.clave, valor: clon(r.valor), version: r.version, orden: r.orden, borrado: r.valor === null, hora: iso(r.hora), app: r.app, dispositivo: r.dispositivo, turno: r.turno })),
        hasta, mas, orden: leido, epoca: S.epoca, hora: iso(ahora()) };
    },
    mesa_actividad(a) {
      const desde = 'desde' in a ? a.desde : 0, lim = Math.min(Math.max(a.limite === undefined ? 200 : ent(a.limite) ? a.limite : 200, 1), 500);
      if (!ent(desde) || desde < 0) return forma('mesa_actividad', a.dispositivo);
      const todas = S.actividad.filter(x => x.id > desde), filas = todas.slice(0, lim);
      return { ok: true, filas: clon(filas), hasta: filas.length ? filas[filas.length - 1].id : desde, mas: todas.length > filas.length, epoca: S.epoca, hora: iso(ahora()) };
    },
  };
  return {
    S, anotar, K,
    reg: (a, k) => S.registros.get(K(a, k)) || null,
    valor: (a, k) => { const r = S.registros.get(K(a, k)); return r ? r.valor : undefined; },
    vivo: (a, k) => { const r = S.registros.get(K(a, k)); return !!r && r.valor !== null; },
    borrado: (a, k) => { const r = S.registros.get(K(a, k)); return !!r && r.valor === null; },
    // un registro escrito «por otro» directamente en el servidor (lo que la prueba necesita que ya esté arriba)
    sembrar(almacen, clave, valor, { dispositivo = DC, turno = 0, version } = {}) {
      const t = ahora(), key = K(almacen, clave), r = S.registros.get(key);
      if (r && r.valor !== null) S.historial.push({ ...r, guardada: t });
      const nuevo = { almacen, clave, valor: valor === null ? null : clon(valor), version: version ?? (r ? r.version + 1 : 1), orden: ++S.turno.orden, app: APP, dispositivo, turno, hora: t, borrado: valor === null ? t : null };
      S.registros.set(key, nuevo);
      return { version: nuevo.version, orden: nuevo.orden };
    },
    cliente(nombre) {   // la red de un ordenador: fallos, registro de llamadas y congelado
      const c = {
        nombre, red: false, colgar: false, permiso: false, sinSesion: false, fallos: [], llamadas: [], blobs: 0, congelado: false, deshielo: [],
        descongelar() { c.congelado = false; c.deshielo.splice(0).forEach(f => f()); },
        async rpc(fn, args) {
          if (c.congelado) await new Promise(r => c.deshielo.push(r));
          const reg = { fn, t: reloj.t, args: null, texto: null, resp: undefined, error: null };
          c.llamadas.push(reg);
          const lanzar = (status, codigo, message) => { const e = Object.assign(new Error(message), { status, codigo }); reg.error = e; throw e; };
          try { reg.texto = JSON.stringify(args ?? {}); reg.args = JSON.parse(reg.texto); } catch (e) { lanzar(0, 'red', 'no se pudo enviar: ' + e.message); }
          if (hayBlob(args)) c.blobs++;
          if (c.red) lanzar(0, 'red', 'sin conexión (simulado)');
          if (c.colgar) { reg.colgada = true; return new Promise(() => {}); }
          if (c.sinSesion) lanzar(401, '42501', 'sin sesión (simulado)');
          let fallo = null; const i = c.fallos.findIndex(f => f.fn === fn);
          if (i >= 0) { if (c.fallos[i].saltar > 0) c.fallos[i].saltar--; else fallo = c.fallos.splice(i, 1)[0]; }
          if (fallo && fallo.modo === 'red') lanzar(0, 'red', 'sin conexión (simulado)');
          if (fallo && fallo.modo === '5xx') lanzar(503, '57014', 'fallo del servidor (simulado)');
          const malo = textoMalo(args);
          if (malo) lanzar(400, malo, 'texto que jsonb no admite (simulado)');
          if (fn === 'mesa_escribir' && Array.isArray(reg.args.cambios) && reg.args.cambios.some(x => x && S.malas.has(K(x.almacen, x.clave)))) lanzar(400, '22P05', 'unsupported Unicode escape sequence (simulado)');
          let r;
          if (c.permiso) { anotar('ajeno', reg.args.dispositivo, { funcion: fn }); r = { ok: false, error: { codigo: 'permiso', http: 403, mensaje: 'sin permiso' } }; }
          else if (!F[fn]) lanzar(404, 'PGRST202', 'función desconocida: ' + fn);
          else r = F[fn](reg.args);
          reg.resp = r;
          if (fallo && fallo.modo === 'perder') lanzar(0, 'red', 'respuesta perdida (simulado)');
          return clon(r);
        },
      };
      return c;
    },
  };
}

// ── Almacén simulado: la interfaz del contrato sobre Maps, con ayudas de prueba ──
function cmpClave(x, y) { for (let i = 0; i < Math.min(x.length, y.length); i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return x.length - y.length; }
function almacenSimulado(reloj) {
  const regs = new Map(), vers = new Map(), diario = new Map(), sinSubir = new Map();
  let meta = { epoca: null, cursor: 0, turno: null, actividad: null }, avisos = [], ficha = 0;
  const KD = (a, k) => JSON.stringify(k == null ? [a] : [a, k]);
  const de = a => { if (!regs.has(a)) regs.set(a, new Map()); return regs.get(a); };
  const copia = v => (v === undefined ? undefined : structuredClone(v));
  const nota = (a, k) => diario.set(KD(a, k), { a, k: k ?? null, t: reloj.t, v: 'v' + ++ficha });
  // `o` sin definir (la respuesta «igual» no trae orden): se conserva el que tenía
  const ponerVer = e => { if (e && e.v != null) { const ya = vers.get(KD(e.a, e.k)); vers.set(KD(e.a, e.k), { v: e.v, o: e.o !== undefined ? e.o : ya ? ya.o : null, b: !!e.b }); } };
  const avisar = () => { try { const p = A.nucleo && A.nucleo.cambio(); if (p && p.catch) p.catch(() => {}); } catch { /* el núcleo decide */ } };
  const A = {
    nucleo: null, espia: { cursores: [], aplicar: 0, confirmar: 0, apartar: 0 },
    async meta() { return { ...meta }; },
    async ponerMeta(p) { if (p && 'cursor' in p) A.espia.cursores.push(p.cursor); meta = { ...meta, ...p }; },
    async diario({ despues = null, n: cuantas } = {}) {
      return [...diario.values()].map(e => ({ e, c: e.k == null ? [e.a] : [e.a, e.k] })).sort((x, y) => cmpClave(x.c, y.c))
        .filter(x => despues == null || cmpClave(x.c, despues) > 0).slice(0, cuantas ?? Infinity).map(x => ({ ...x.e }));
    },
    async contarDiario() { return diario.size; },
    async leerVarios(claves) {
      return claves.map(([a, k]) => { const d = diario.get(KD(a, k)), c = k == null ? null : vers.get(KD(a, k)); return { valor: k == null ? undefined : copia(de(a).get(k)), pendiente: d ? { ...d } : null, conocida: c ? { ...c } : null }; });
    },
    async claves(a) { return [...de(a).keys()]; },
    async conocidas(a) { const o = {}; for (const [kk, x] of vers) { const [aa, k] = JSON.parse(kk); if (aa === a) o[k] = { ...x }; } return o; },
    async aplicar({ escribir = [], saltar = [], aparte = [], cursor, epoca } = {}) {
      A.espia.aplicar++;
      for (const e of aparte) {
        const { ficha: f, ...resto } = e;
        sinSubir.set(KD(e.a, e.k), { ...resto, valor: copia(e.valor), t: reloj.t });
        const d = diario.get(KD(e.a, e.k)); if (d && d.v === f) diario.delete(KD(e.a, e.k));
      }
      for (const e of escribir) { if (e.valor == null) de(e.a).delete(e.k); else de(e.a).set(e.k, copia(e.valor)); ponerVer(e); }
      for (const e of saltar) ponerVer(e);
      if (cursor !== undefined) { meta.cursor = cursor; A.espia.cursores.push(cursor); }
      if (epoca !== undefined) meta.epoca = epoca;
    },
    async confirmar({ versiones = [], quitar = [] } = {}) {
      A.espia.confirmar++;
      for (const e of versiones) ponerVer(e);
      for (const e of quitar) { const d = diario.get(KD(e.a, e.k)); if (d && d.v === e.v) diario.delete(KD(e.a, e.k)); }
    },
    async apartar(lista = []) {
      A.espia.apartar++;
      for (const e of lista) {
        const { v, ...resto } = e, cur = e.k == null ? undefined : de(e.a).get(e.k);
        sinSubir.set(KD(e.a, e.k), { ...resto, valor: copia(cur), borrado: e.k != null && cur === undefined, t: reloj.t });
        const d = diario.get(KD(e.a, e.k)); if (d && (v === undefined || d.v === v)) diario.delete(KD(e.a, e.k));
      }
    },
    async sinSubir() { return [...sinSubir.values()].map(x => ({ ...x, valor: copia(x.valor) })); },
    async quitarSinSubir(claves = []) { for (const [a, k] of claves) sinSubir.delete(KD(a, k)); },
    async reponer(a, k, valor) { if (valor === undefined) de(a).delete(k); else de(a).set(k, copia(valor)); nota(a, k); queueMicrotask(avisar); },
    async olvidar() { meta = { ...meta, cursor: 0 }; vers.clear(); },
    async apuntarSinVersion() { for (const [a, m] of regs) for (const k of m.keys()) if (!vers.has(KD(a, k)) && !diario.has(KD(a, k))) nota(a, k); },
    async avisos() { return avisos.map(x => ({ ...x })); },
    async ponerAvisos(filas = []) { for (const f of filas) { const i = avisos.findIndex(x => x.id === f.id); if (i >= 0) avisos[i] = { ...f }; else avisos.push({ ...f }); } },
    async quitarAviso(id) { avisos = avisos.filter(x => x.id !== id); },
    // ayudas de prueba (como la Mesa: escribe, apunta en el diario con una ficha nueva y avisa al núcleo)
    escribirLocal(a, k, valor) { de(a).set(k, copia(valor)); nota(a, k); avisar(); },
    borrarLocal(a, k) { de(a).delete(k); nota(a, k); avisar(); },
    vaciarLocal(a) { de(a).clear(); nota(a, null); avisar(); },
    sembrar({ registros = [], versiones = [], notas = [], meta: m } = {}) {
      for (const [a, k, v] of registros) de(a).set(k, copia(v));
      for (const [a, k, x] of versiones) ponerVer({ a, k, ...x });
      for (const [a, k] of notas) nota(a, k);
      if (m) meta = { ...meta, ...m };
    },
    ver: (a, k) => de(a).get(k), tiene: (a, k) => de(a).has(k), versionDe: (a, k) => vers.get(KD(a, k)) || null,
    enDiario: (a, k) => diario.has(KD(a, k)), metaYa: () => ({ ...meta }), avisosYa: () => avisos.map(x => x.id),
    todo() { const m = new Map(); for (const [a, mm] of regs) for (const [k, v] of mm) m.set(a + '|' + k, v); return m; },
  };
  return A;
}

function efectosEspia(reloj, hooks) {
  const e = { pausas: [], recargas: 0, estados: [],
    async pausar(info) { e.pausas.push({ ...(info || {}), t: reloj.t }); if (hooks.pausar) await hooks.pausar(info || {}); },
    recargar() { e.recargas++; },
    estado(x) { e.estados.push(x && typeof x === 'object' ? { ...x } : x); } };
  return e;
}

let semilla = 0;
function mundo() {
  const reloj = relojFalso(), srv = servidorSimulado(reloj);
  const W = { reloj, srv, S: srv.S };
  W.nodo = (disp, { alm = almacenSimulado(reloj), hooks = {} } = {}) => {
    const dueno = 'nodo' + ++semilla, cli = srv.cliente(dueno), efectos = efectosEspia(reloj, hooks);
    const nucleo = N.crear({ servidor: { rpc: (fn, args) => cli.rpc(fn, args) }, almacen: alm, reloj: { ahora: () => reloj.t, esperar: ms => reloj.esperar(ms, dueno) },
      dispositivo: disp, app: APP, huella, efectos });
    alm.nucleo = nucleo;
    const x = { disp, alm, cli, efectos, n: nucleo, dueno, errores: [], congelado: false };
    x.congelar = () => { x.congelado = true; reloj.congelar(dueno); cli.congelado = true; };
    x.descongelar = () => { x.congelado = false; reloj.descongelar(dueno); cli.descongelar(); };
    x.matar = () => x.congelar();   // la página se cerró o se recargó: este núcleo ya no hace nada
    return x;
  };
  W.tic = x => { if (!x.congelado) Promise.resolve().then(() => x.n.tic()).catch(e => x.errores.push(e)); };
  W.vivir = async (seg, ...xs) => { for (let i = 0; i < seg; i++) { for (const x of xs) W.tic(x); await reloj.avanzar(1000); } };
  W.correr = async (f, { tics = [], paso = 1000, max = 120 } = {}) => {
    let hecho = false, valor, error; const t0 = reloj.t;
    (async () => f())().then(v => { hecho = true; valor = v; }, e => { hecho = true; error = e; });
    for (let i = 0; ; i++) {
      await vaciar();
      if (hecho) return { valor, error, ms: reloj.t - t0 };
      if (i >= max) return { colgado: true, ms: reloj.t - t0 };
      for (const x of tics) W.tic(x);
      await reloj.avanzar(paso);
    }
  };
  W.abrir = async x => { const r = await W.correr(() => x.n.abrir(), { paso: 500, max: 40 }); return r.colgado ? { colgado: true } : r.error ? { error: String(r.error && r.error.stack || r.error) } : r.valor; };
  W.hasta = async (cond, { tics = [], max = 120 } = {}) => { for (let i = 0; i <= max; i++) { await vaciar(); if (await cond()) return true; for (const x of tics) W.tic(x); await reloj.avanzar(1000); } return false; };
  return W;
}
const resumen = x => x.cli.llamadas.slice(-24).map(l => l.fn.replace('mesa_', '') + (l.error ? '!' + l.error.codigo : l.resp && l.resp.ok === false ? '×' + l.resp.error.codigo : '')).join(' ');
const escrituras = x => x.cli.llamadas.filter(l => l.fn === 'mesa_escribir' && l.args && Array.isArray(l.args.cambios));
const conClave = (x, a, k) => escrituras(x).filter(l => l.args.cambios.some(c => c && c.almacen === a && c.clave === k));
const okResp = l => l.resp && l.resp.ok === true && !l.error;
async function noPerdido(alm, a, k) { const d = await alm.diario({ despues: null }), s = await alm.sinSubir(); return (d.some(e => e.a === a && e.k === k) || s.some(e => e.a === a && e.k === k)) && !alm.versionDe(a, k); }
function difAlmacenes(x, y) { const a = x.todo(), b = y.todo(), out = []; for (const k of new Set([...a.keys(), ...b.keys()])) if (!a.has(k) || !b.has(k) || !mismo(a.get(k), b.get(k))) out.push(k + (!a.has(k) ? ' (falta en A)' : !b.has(k) ? ' (falta en B)' : ' (distinto)')); return out.slice(0, 8); }
async function conTurno(prep) { const W = mundo(); if (prep) prep(W); const A = W.nodo(DA); const r = await W.abrir(A); if (!r || r.modo !== 'turno') throw new Error('A no abrió con turno: ' + corto(r) + ' · ' + resumen(A)); return { W, A, sv: W.srv, S: W.S }; }
const fase = async x => { const e = await x.n.estado(); return e && e.fase; };
const huboFase = async (x, f) => (await fase(x)) === f || x.efectos.estados.some(e => e && e.fase === f);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
await grupo('NS0 la costura de NubeNucleo', async () => {
  const faltan = ['crear', 'serializar', 'unir', 'igual', 'esRef', 'esBlob', 'esAviso'].filter(f => typeof N[f] !== 'function');
  ok(typeof N.version === 'string' && !faltan.length, 'NS0.1 NubeNucleo trae version, crear, serializar, unir, igual, esRef, esBlob y esAviso', { version: N.version, faltan });
  ok(N.TOPES && N.TOPES.cambios === 500 && N.TOPES.valor === 1950000 && N.TOPES.lote === 3600000, 'NS0.2 TOPES = {cambios: 500, valor: 1950000, lote: 3600000}', N.TOPES);
  const T = N.TIEMPOS || {}, num = ['latido', 'calma', 'pideViva', 'espera', 'primera', 'actividad', 'pedirCada'].filter(k => typeof T[k] !== 'number');
  ok(!num.length && Array.isArray(T.reintento) && T.reintento.length > 0, 'NS0.3 TIEMPOS trae latido, calma, pideViva, espera, primera, actividad, pedirCada y reintento', { faltan: num, TIEMPOS: T });
  const x = mundo().nodo(DA);
  const metodos = ['abrir', 'tic', 'cambio', 'subir', 'usarAqui', 'forzar', 'subirEncima', 'descartar', 'avisos', 'marcarVisto', 'estado', 'parar'].filter(m => typeof x.n[m] !== 'function');
  ok(!metodos.length, 'NS0.4 el núcleo trae abrir, tic, cambio, subir, usarAqui, forzar, subirEncima, descartar, avisos, marcarVisto, estado y parar', metodos);
});

await grupo('NS1 turno en dos fases', async () => {
  const W = mundo(), S = W.S, sv = W.srv;
  const A = W.nodo(DA, { hooks: { pausar: info => { if (info.motivo === 'cede') A.alm.escribirLocal('boards', 'volcado', { de: 'mesa-pending', n: 1 }); } } });
  const B = W.nodo(DB);
  let r = await W.abrir(A);
  ok(r && r.modo === 'turno' && S.turno.dispositivo === DA, 'NS1.1 A abre con la Mesa libre: la reclama y queda con el turno', { r, turno: S.turno });
  const ll = A.cli.llamadas, iRec = ll.findIndex(l => l.fn === 'mesa_turno_reclamar' && okResp(l));
  ok(iRec >= 0 && !ll[iRec].args.forzar && ll.slice(iRec + 1).some(l => l.fn === 'mesa_bajar' && okResp(l) && l.resp.mas === false), 'NS1.2 … reclama sin forzar y después baja hasta «mas» falso', resumen(A));
  for (let i = 1; i <= 3; i++) A.alm.escribirLocal('boards', 'tablero-' + i, { nombre: 'Tablero ' + i, casillas: [{ id: 'c' + i, texto: 'hola ' + i }] });
  A.alm.escribirLocal('clients', 'cliente-x', { nombre: 'Cliente X', color: '#123456' });
  await W.vivir(10, A);
  ok([1, 2, 3].every(i => sv.vivo('boards', 'tablero-' + i)) && sv.vivo('clients', 'cliente-x') && (await A.alm.contarDiario()) === 0, 'NS1.3 lo que A escribe sube tras la calma y sale del diario', resumen(A));
  r = await W.abrir(B);
  ok(r && r.modo === 'pausada' && r.tiene && r.tiene.dispositivo === DA && mismaHora(r.tiene.desde, S.turno.desde) && typeof r.tiene.latido_hace === 'number' && 'cola' in r.tiene, 'NS1.4 B abre y ve «pausada» con quién la tiene y desde cuándo', r);
  ok(!B.cli.llamadas.some(l => l.fn === 'mesa_turno_pedir' || l.fn === 'mesa_turno_reclamar') && S.turno.pide == null, 'NS1.5 … sin pedirla', resumen(B));
  A.alm.escribirLocal('boards', 'tablero-4', { nombre: 'Tablero 4' });
  A.alm.escribirLocal('boards', 'tablero-1', { nombre: 'Tablero 1 bis' });
  A.alm.borrarLocal('boards', 'tablero-2');
  const u = await W.correr(() => B.n.usarAqui(), { tics: [A, B], max: 60 });
  const pedido = B.cli.llamadas.find(l => l.fn === 'mesa_turno_pedir'), cede = A.efectos.pausas.find(p => p.motivo === 'cede');
  ok(cede && cede.dispositivo === DB && pedido && cede.t - pedido.t <= LATIDO + 1000, `NS1.6 B pide la Mesa y A se pausa con «cede» en su siguiente latido (≤ ${LATIDO / 1000} s)`, { pausas: A.efectos.pausas, pedido: pedido && pedido.t, A: resumen(A) });
  ok(sv.valor('boards', 'tablero-4')?.nombre === 'Tablero 4' && sv.valor('boards', 'tablero-1')?.nombre === 'Tablero 1 bis' && sv.borrado('boards', 'tablero-2') && sv.vivo('boards', 'volcado') && (await A.alm.contarDiario()) === 0,
    'NS1.7 A sube su cola, también lo que vuelca al pausarse (mesa-pending), y la confirma', resumen(A));
  ok(u.valor && u.valor.hecho === true && B.efectos.recargas >= 1 && S.turno.dispositivo === DB && !B.cli.llamadas.some(l => l.fn === 'mesa_turno_reclamar' && l.args.forzar), 'NS1.8 B la reclama sin forzar cuando A la suelta, y recarga', { u, turno: S.turno, B: resumen(B) });
  B.matar();
  const B2 = W.nodo(DB, { alm: B.alm });
  r = await W.abrir(B2);
  await W.vivir(10, A, B2);
  const iSol = A.cli.llamadas.findIndex(l => l.fn === 'mesa_turno_soltar' && okResp(l));
  ok(iSol >= 0 && A.cli.llamadas.every((l, i) => l.fn !== 'mesa_escribir' || i < iSol), 'NS1.9 A suelta después de subir y ya no escribe', resumen(A));
  const dif = difAlmacenes(A.alm, B2.alm);
  ok(r && r.modo === 'turno' && !dif.length && B2.alm.todo().size === A.alm.todo().size && A.alm.todo().size >= 5, 'NS1.10 B reabre con el turno, baja lo de A y los dos almacenes tienen lo mismo, registro a registro', { r, dif });
});

await grupo('NS2 latido y forzar', async () => {
  const W = mundo(), S = W.S, sv = W.srv, A = W.nodo(DA), B = W.nodo(DB);
  await W.abrir(A);
  A.alm.escribirLocal('boards', 'comun', { de: 'A0' }); await W.vivir(6, A);
  A.alm.escribirLocal('boards', 'solo-a', { de: 'A1' }); A.alm.escribirLocal('boards', 'comun', { de: 'A1' });
  await W.vivir(2, A);   // un latido con la cola nueva, antes de la calma
  ok(S.turno.cola === 2 && S.turno.cola_desde != null && !sv.reg('boards', 'solo-a'), 'NS2.1 A dice su cola en el latido en cuanto cambia (antes de subirla)', S.turno);
  A.congelar();   // se cierra de golpe: ni late ni sube
  let r = await W.abrir(B);
  const tB = W.reloj.t, u = await W.correr(() => B.n.usarAqui(), { tics: [B], max: 60 });
  const esp = u.valor && u.valor.espera;
  ok(esp && esp.dispositivo === DA && esp.cola === S.turno.cola && mismaHora(esp.latido, S.turno.latido) && typeof esp.latido_hace === 'number' && u.ms >= ESPERA - 1000 && u.ms <= ESPERA + 5000,
    `NS2.2 A no contesta: usarAqui() devuelve {espera} a los ${ESPERA / 1000} s con el latido y la cola que A dijo por última vez`, { u, turno: S.turno, abrir: r });
  const visto = S.turno.numero, tForzado = W.reloj.t;
  const f = await W.correr(() => B.n.forzar(visto), { tics: [B], max: 20 });
  const fz = S.actividad.find(x => x.tipo === 'turno_forzado');
  ok(!f.colgado && S.turno.dispositivo === DB && S.turno.numero === visto + 1 && B.efectos.recargas >= 1 && B.cli.llamadas.some(l => l.fn === 'mesa_turno_reclamar' && l.args.forzar === true && l.args.visto === visto) && fz && fz.detalle.cola === 2,
    'NS2.3 forzar(visto) reclama con forzar: true, recarga y queda «turno_forzado» con la cola de A', { f, turno: S.turno, B: resumen(B), tB });
  B.matar();
  const B2 = W.nodo(DB, { alm: B.alm }); await W.abrir(B2);
  B2.alm.escribirLocal('boards', 'comun', { de: 'B' }); await W.vivir(6, B2);
  A.descongelar();
  await W.vivir(15, A, B2);
  const perd = A.efectos.pausas.find(p => p.motivo === 'perdido');
  ok(perd && A.cli.llamadas.some(l => l.resp && l.resp.ok === false && l.resp.error.codigo === 'turno'), 'NS2.4 A, al volver, recibe «turno» (423) y se pausa como «perdido»', { pausas: A.efectos.pausas, A: resumen(A) });
  const ss = await A.alm.sinSubir();
  ok(['comun', 'solo-a'].every(k => ss.some(e => e.a === 'boards' && e.k === k && e.motivo === 'turno')) && (await A.alm.contarDiario()) === 0, 'NS2.5 todo su diario pasa a «quedó sin subir» con motivo «turno»', ss);
  ok(sv.valor('boards', 'comun')?.de === 'B' && !sv.reg('boards', 'solo-a') && !escrituras(A).some(l => l.t >= tForzado && okResp(l)), 'NS2.6 A no sube nada encima de B', { comun: sv.valor('boards', 'comun'), A: resumen(A) });
  const antes = escrituras(A).length; await W.vivir(20, A, B2);
  ok(escrituras(A).length === antes, 'NS2.7 después, nada de A sube solo', resumen(A));
  const g = await W.correr(() => A.n.forzar(visto), { max: 10 });
  ok(g.valor && g.valor.otraVez === true && S.turno.dispositivo === DB && S.turno.numero === visto + 1, 'NS2.8 forzar con un visto viejo devuelve {otraVez: true} y no quita la Mesa', { g, turno: S.turno });
});

await grupo('NS3 versiones y páginas', async () => {
  const sembrar = W => { for (let i = 1; i <= 1234; i++) W.srv.sembrar('files', 'f' + String(i).padStart(4, '0'), { n: i, nombre: 'foto-' + i + '.jpg' }, { turno: 1 }); W.S.turno.numero = 1; };
  let W = mundo(); sembrar(W);
  let A = W.nodo(DA), r = await W.abrir(A);
  const bajadas = A.cli.llamadas.filter(l => l.fn === 'mesa_bajar' && okResp(l));
  const local = A.alm.todo(), malos = [];
  for (const x of W.S.registros.values()) { const v = local.get('files|' + x.clave), c = A.alm.versionDe('files', x.clave); if (!v || v.n !== x.valor.n || !c || c.v !== x.version || c.o !== x.orden) malos.push(x.clave); }
  ok(r && r.modo === 'turno' && bajadas.length >= 3 && local.size === 1234 && !malos.length, 'NS3.1 1.234 registros bajan en varias páginas, con su versión y su número de orden, sin saltarse ninguno', { r, paginas: bajadas.length, local: local.size, malos: malos.slice(0, 5) });
  const hastas = bajadas.map(l => l.resp.hasta); let j = 0;
  for (const c of A.alm.espia.cursores) if (c === hastas[j]) j++;
  ok(j === hastas.length, 'NS3.2 el cursor se guarda por página (cada «hasta», en orden)', { hastas, cursores: A.alm.espia.cursores });
  W = mundo(); sembrar(W);
  A = W.nodo(DA); A.cli.fallos.push({ fn: 'mesa_bajar', modo: 'red', saltar: 1 });
  r = await W.abrir(A);
  const p1 = A.cli.llamadas.find(l => l.fn === 'mesa_bajar' && okResp(l));
  ok(r && r.modo === 'local' && r.motivo === 'sin_conexion', 'NS3.3 una página que falla abre en «local» (sin conexión)', r);
  ok(p1 && A.alm.metaYa().cursor === p1.resp.hasta && A.alm.todo().size === p1.resp.filas.length, 'NS3.4 … con el cursor de la última página aplicada, que se volverá a bajar', { cursor: A.alm.metaYa().cursor, p1: p1 && p1.resp.hasta, local: A.alm.todo().size });

  ({ W, A } = await conTurno());
  const sv = W.srv, S = W.S;
  A.alm.escribirLocal('boards', 'r1', { de: 'A' }); A.alm.escribirLocal('boards', 'r2', { de: 'A' }); await W.vivir(6, A);
  A.cli.fallos.push({ fn: 'mesa_escribir', modo: 'perder' });
  A.alm.escribirLocal('boards', 'p1', { v: 1 }); A.alm.escribirLocal('boards', 'p2', { v: 1 });
  await W.hasta(() => A.cli.llamadas.some(l => l.fn === 'mesa_escribir' && l.error), { tics: [A], max: 15 });
  A.alm.escribirLocal('boards', 'p2', { v: 2 });   // cambia mientras el lote espera respuesta
  await W.vivir(90, A);
  const esc = escrituras(A), iP = esc.findIndex(l => l.error && l.error.codigo === 'red'), sig = esc[iP + 1];
  ok(iP >= 0 && sig && sig.texto === esc[iP].texto, 'NS3.5 si se pierde la respuesta de una escritura, la siguiente es el mismo lote, los mismos bytes', { perdida: iP >= 0 && esc[iP].texto, siguiente: sig && sig.texto });
  ok(sig && okResp(sig) && sig.resp.resultados.every(x => x.estado === 'igual'), 'NS3.6 … y sale «igual»: no choca consigo misma', sig && sig.resp);
  ok(sv.reg('boards', 'p1')?.version === 1 && sv.reg('boards', 'p2')?.version === 2 && sv.valor('boards', 'p2')?.v === 2 && !(await A.alm.sinSubir()).length && (await A.alm.contarDiario()) === 0
    && !S.actividad.some(x => x.tipo === 'choque' && /^p/.test(x.detalle.clave)), 'NS3.7 lo cambiado mientras esperaba sube después, sin choques ni nada en «quedó sin subir»', { p1: sv.reg('boards', 'p1'), p2: sv.reg('boards', 'p2'), A: resumen(A) });
  sv.sembrar('boards', 'r1', { de: 'otro' }, { dispositivo: DB, turno: S.turno.numero - 1 });   // versión 2, de otro
  A.alm.escribirLocal('boards', 'r1', { de: 'A bis' }); await W.vivir(10, A);
  const s1 = (await A.alm.sinSubir()).find(e => e.a === 'boards' && e.k === 'r1');
  ok(s1 && s1.motivo === 'choque' && s1.ultima === 2 && s1.de === DB && s1.turnoDe === S.turno.numero - 1 && sv.valor('boards', 'r1')?.de === 'otro' && !A.alm.enDiario('boards', 'r1'),
    'NS3.8 una escritura de otro con base vieja da «choque» y va a «quedó sin subir» (ultima, de, turnoDe)', s1);
  sv.sembrar('boards', 'r2', { de: 'A, respuesta perdida' }, { dispositivo: DA, turno: S.turno.numero });   // versión 2, de este dispositivo y turno
  A.alm.escribirLocal('boards', 'r2', { de: 'A nuevo' }); await W.vivir(20, A);
  ok(!(await A.alm.sinSubir()).some(e => e.k === 'r2') && sv.valor('boards', 'r2')?.de === 'A nuevo' && sv.reg('boards', 'r2')?.version === 3, 'NS3.9 un choque del mismo dispositivo y turno no va a la lista: toma la versión de arriba y sube', { r2: sv.reg('boards', 'r2'), A: resumen(A) });
});

await grupo('NS4 bajar al abrir', async () => {
  const W = mundo(), sv = W.srv, S = W.S;
  const fotoA = new Blob(['foto principal de aquí'], { type: 'image/jpeg' }), f1 = new Blob(['foto uno'], { type: 'image/jpeg' }), f2 = new Blob(['foto dos!'], { type: 'image/jpeg' });
  const o = {};
  o.b1 = sv.sembrar('boards', 'b1', { x: 'viejo' }); sv.sembrar('boards', 'b1', { x: 'de B' });
  sv.sembrar('boards', 'b2', { x: 'uno' }); const b2 = sv.sembrar('boards', 'b2', { x: 'arriba' });
  o.b3 = sv.sembrar('boards', 'b3', { x: 0 }); sv.sembrar('boards', 'b3', { nombre: 'igual', lista: [1, 2], z: { a: 1, b: 2 } });
  o.t1 = sv.sembrar('tareas', 't1', { nombre: 'antes' });
  sv.sembrar('tareas', 't1', { nombre: 'arriba', foto: refDe('foto principal de aquí'), fotos: [{ id: 'f2', blob: refDe('foto dos!') }, { id: 'f1', blob: refDe('foto uno') }, { id: 'f3', blob: refDe('foto tres') }] });
  sv.sembrar('tareas', 't2', { nombre: 'solo referencia', foto: refDe('foto cuatro') });
  o.b4 = sv.sembrar('boards', 'b4', { x: 'cuatro' }); sv.sembrar('boards', 'b4', null);
  const b5 = sv.sembrar('boards', 'b5', { x: 'cinco' }, { version: 3 });
  const A = W.nodo(DA);
  A.alm.sembrar({
    registros: [['boards', 'b1', { x: 'de A' }], ['boards', 'b2', { x: 'de A2' }], ['boards', 'b3', { z: { b: 2, a: 1 }, lista: [1, 2], nombre: 'igual' }],
      ['tareas', 't1', { nombre: 'aquí', foto: fotoA, fotos: [{ id: 'f1', blob: f1 }, { id: 'f2', blob: f2 }] }], ['boards', 'b4', { x: 'cuatro' }], ['boards', 'b5', { x: 'cinco aquí' }]],
    versiones: [['boards', 'b1', { v: 1, o: o.b1.orden }], ['boards', 'b2', { v: 2, o: b2.orden }], ['boards', 'b3', { v: 1, o: o.b3.orden }], ['tareas', 't1', { v: 1, o: o.t1.orden }], ['boards', 'b4', { v: 1, o: o.b4.orden }], ['boards', 'b5', { v: 3, o: b5.orden }]],
    notas: [['boards', 'b1'], ['boards', 'b2'], ['boards', 'b3']], meta: { epoca: S.epoca, cursor: 0 },
  });
  const r = await W.abrir(A);
  if (!ok(r && r.modo === 'turno', 'NS4.0 A abre con la Mesa libre y baja todo', { r, A: resumen(A) })) return;
  const ss = await A.alm.sinSubir(), s1 = ss.find(e => e.a === 'boards' && e.k === 'b1');
  ok(s1 && s1.motivo === 'bajada' && mismo(s1.valor, { x: 'de A' }) && mismo(A.alm.ver('boards', 'b1'), { x: 'de B' }) && !A.alm.enDiario('boards', 'b1') && A.alm.versionDe('boards', 'b1')?.v === 2,
    'NS4.1 lo bajado gana: lo de aquí, pendiente y con una versión más nueva arriba, pasa a «quedó sin subir» y se escribe lo de arriba', { s1, local: A.alm.ver('boards', 'b1') });
  ok(mismo(A.alm.ver('boards', 'b2'), { x: 'de A2' }) && A.alm.enDiario('boards', 'b2') && !ss.some(e => e.k === 'b2'), 'NS4.2 con la misma versión conocida se queda lo de aquí (y su entrada del diario)', A.alm.ver('boards', 'b2'));
  ok(mismo(A.alm.ver('boards', 'b3'), { nombre: 'igual', lista: [1, 2], z: { a: 1, b: 2 } }) && !ss.some(e => e.k === 'b3') && A.alm.versionDe('boards', 'b3')?.v === 2, 'NS4.3 pendiente pero igual a lo de arriba (otro orden de claves): no va a la lista', ss);
  const t1 = A.alm.ver('tareas', 't1');
  ok(t1 && t1.nombre === 'arriba' && esBlobN(t1.foto) && (await t1.foto.text()) === 'foto principal de aquí', 'NS4.4 unir conserva el Blob de aquí donde lo bajado trae una referencia __blob', t1);
  ok(t1 && Array.isArray(t1.fotos) && t1.fotos.map(x => x.id).join() === 'f2,f1,f3' && esBlobN(t1.fotos[0].blob) && (await t1.fotos[0].blob.text()) === 'foto dos!' && esBlobN(t1.fotos[1].blob) && (await t1.fotos[1].blob.text()) === 'foto uno' && N.esRef(t1.fotos[2].blob),
    'NS4.5 … también en una lista de fotos con id (empareja por id; la nueva se queda con su referencia)', t1);
  ok(A.alm.ver('tareas', 't2') && N.esRef(A.alm.ver('tareas', 't2').foto), 'NS4.6 un registro que solo trae referencia se guarda con la referencia', A.alm.ver('tareas', 't2'));
  ok(!A.alm.tiene('boards', 'b4') && mismo(A.alm.ver('boards', 'b5'), { x: 'cinco aquí' }), 'NS4.7 una lápida borra aquí; una fila ya conocida (misma versión) se salta', { b4: A.alm.ver('boards', 'b4'), b5: A.alm.ver('boards', 'b5') });

  const W2 = mundo(); for (let i = 1; i <= 12; i++) W2.srv.sembrar('boards', 'e' + i, { n: i });
  const A2 = W2.nodo(DA);
  A2.alm.sembrar({ registros: [['boards', 'x-viejo', { n: 'v' }], ['boards', 'x-nuevo', { n: 'n' }], ['boards', 'e1', { n: 1 }]], versiones: [['boards', 'x-viejo', { v: 1, o: 3 }], ['boards', 'e1', { v: 1, o: 1 }]], meta: { epoca: 'epoca-vieja-0000', cursor: 7 } });
  const r2 = await W2.abrir(A2);
  const todos = [...Array(12)].every((_, i) => A2.alm.ver('boards', 'e' + (i + 1))?.n === i + 1);
  ok(r2 && r2.modo === 'turno' && A2.cli.llamadas.some(l => l.fn === 'mesa_bajar' && l.args.desde === 0) && todos && A2.alm.metaYa().epoca === W2.S.epoca, 'NS4.8 otra época: olvida cursor y versiones y baja todo desde 0', { r2, A: resumen(A2), meta: A2.alm.metaYa() });
  ok(A2.alm.enDiario('boards', 'x-viejo') && A2.alm.enDiario('boards', 'x-nuevo') && !A2.alm.enDiario('boards', 'e1'), 'NS4.9 … y al acabar apunta en el diario lo de aquí sin versión (para subirlo como nuevo)', await A2.alm.diario({}));
  const W3 = mundo(); for (let i = 1; i <= 5; i++) W3.srv.sembrar('boards', 'c' + i, { n: i });
  const A3 = W3.nodo(DA); A3.alm.sembrar({ meta: { epoca: W3.S.epoca, cursor: 999 } });
  const r3 = await W3.abrir(A3);
  ok(r3 && r3.modo === 'turno' && A3.cli.llamadas.some(l => l.fn === 'mesa_bajar' && l.resp && l.resp.ok === false && l.resp.error.codigo === 'cursor') && A3.cli.llamadas.some(l => l.fn === 'mesa_bajar' && l.args.desde === 0 && okResp(l)) && [1, 2, 3, 4, 5].every(i => A3.alm.tiene('boards', 'c' + i)),
    'NS4.10 un rechazo «cursor» olvida el cursor y baja desde 0', { r3, A: resumen(A3) });

  // unir e igual, puros
  const ref = refDe('x'), refA = refDe('foto a'), refB = refDe('foto b!'), refC = refDe('foto c');
  const bL = new Blob(['x'], { type: 'image/jpeg' }), bA = new Blob(['foto a'], { type: 'image/jpeg' }), bB = new Blob(['foto b!'], { type: 'image/jpeg' });
  const local = { n: 1, foto: bL, lista: [{ id: 'a', blob: bA }, { id: 'b', blob: bB }], pos: [bL, 'x'], solo: 'aquí' };
  const bajado = { n: 2, foto: ref, lista: [{ id: 'b', blob: refB }, { id: 'a', blob: refA }, { id: 'c', blob: refC }], pos: [ref, 'y'], nuevo: true };
  const copiaBajado = JSON.stringify(bajado);
  const u = await N.unir(local, bajado);
  ok(u && u.n === 2 && u.foto === bL && u.lista[0].blob === bB && u.lista[1].blob === bA && N.esRef(u.lista[2].blob) && u.pos[0] === bL && u.pos[1] === 'y' && u.nuevo === true && !('solo' in u),
    'NS4.11 unir: devuelve lo bajado con el Blob de aquí en cada sitio con referencia (objetos por clave, listas con id por id, otras por posición)', u);
  ok(local.foto === bL && local.lista[0].blob === bA && local.lista.length === 2 && JSON.stringify(bajado) === copiaBajado && u !== bajado, 'NS4.12 unir no cambia sus argumentos', { local, bajado });
  const u2 = await N.unir({ a: bL, b: bA, c: bB }, { a: { ...ref, tam: 99 }, b: { ...refA, tipo: 'image/png' }, c: refB });
  ok(u2 && N.esRef(u2.a) && N.esRef(u2.b) && u2.c === bB, 'NS4.12b unir deja la referencia si el Blob de aquí no coincide en tam o tipo', u2);
  const ig = [
    [{ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 }, true], [{ a: 1 }, { a: 2 }, false], [{ a: 1 }, { a: 1, b: 2 }, false], [[1, 2], [2, 1], false],
    [{ f: bA }, { f: refA }, true], [{ f: bA }, { f: refDe('otra cosa más larga') }, false], [{ f: bA }, { f: { ...refA, tipo: 'image/png' } }, false], [null, null, true], ['1', 1, false],
  ];
  const mal = []; for (const [x, y, e] of ig) if (!!(await N.igual(x, y)) !== e) mal.push(corto(x) + ' ~ ' + corto(y) + ' → ' + !e);
  ok(!mal.length, 'NS4.13 igual: sin mirar el orden de las claves; un Blob y una referencia, iguales si coinciden tamaño y tipo', mal);
});

await grupo('NS5 sin red y cola', async () => {
  {
    const { W, A, sv } = await conTurno();
    A.cli.red = true;
    for (let i = 1; i <= 3; i++) A.alm.escribirLocal('boards', 's' + i, { n: i });
    await W.vivir(12, A);
    const e = await A.n.estado();
    ok(e && e.fase === 'sin_conexion' && e.cola === 3 && (await A.alm.contarDiario()) === 3, 'NS5.1 sin red: los cambios esperan en el diario y el estado es «sin_conexion» con la cuenta', e);
    A.cli.red = false; await W.vivir(90, A);
    ok([1, 2, 3].every(i => sv.valor('boards', 's' + i)?.n === i) && (await A.alm.contarDiario()) === 0 && (await fase(A)) !== 'sin_conexion', 'NS5.2 vuelve la red y sigue siendo suyo: sube', { A: resumen(A), fase: await fase(A) });
  }
  {
    const W = mundo(), sv = W.srv, S = W.S, A = W.nodo(DA), B = W.nodo(DB);
    await W.abrir(A);
    A.alm.escribirLocal('boards', 'comun', { de: 'A0' }); await W.vivir(6, A);
    A.cli.red = true; const tCorte = W.reloj.t;
    A.alm.escribirLocal('boards', 'comun', { de: 'A1' }); A.alm.escribirLocal('boards', 'solo-a', { de: 'A1' });
    await W.vivir(5, A);
    await W.abrir(B);
    const u = await W.correr(() => B.n.usarAqui(), { tics: [A, B], max: 60 });
    await W.correr(() => B.n.forzar(S.turno.numero), { tics: [A, B], max: 20 });
    B.matar(); const B2 = W.nodo(DB, { alm: B.alm }); await W.abrir(B2);
    B2.alm.escribirLocal('boards', 'comun', { de: 'B' }); await W.vivir(6, A, B2);
    A.cli.red = false; await W.vivir(90, A, B2);
    ok(u.valor && u.valor.espera && S.turno.dispositivo === DB && sv.valor('boards', 'comun')?.de === 'B' && !sv.reg('boards', 'solo-a') && !escrituras(A).some(l => l.t >= tCorte && okResp(l)),
      'NS5.3 B la reclamó mientras A estaba sin red: A, al volver, no pisa nada de B', { u, comun: sv.valor('boards', 'comun'), A: resumen(A) });
    const ss = await A.alm.sinSubir();
    ok(['comun', 'solo-a'].every(k => ss.some(e => e.k === k && e.motivo === 'turno')) && A.efectos.pausas.some(p => p.motivo === 'perdido'), 'NS5.4 … y enseña lo suyo en «quedó sin subir»', { ss, pausas: A.efectos.pausas });
  }
  {
    const { W, A, sv, S } = await conTurno(), numero = S.turno.numero;
    A.matar();   // la página se cierra; se vuelve a abrir sin red
    const A2 = W.nodo(DA, { alm: A.alm }); A2.cli.red = true;
    const r = await W.abrir(A2);
    ok(r && r.modo === 'local' && r.motivo === 'sin_conexion' && !A2.cli.llamadas.some(l => l.fn === 'mesa_turno_reclamar'), 'NS5.5 abrir sin red abre en «local» y no reclama', { r, A: resumen(A2) });
    A2.alm.escribirLocal('boards', 'l1', { n: 1 }); A2.alm.escribirLocal('boards', 'l2', { n: 2 });
    await W.vivir(5, A2);
    // abierta sin red, la cola se cuenta igual (revisión del lote 3: decía «0 cambios en cola» toda la sesión)
    ok(A2.n.estado().cola === 2 && A2.n.estado().fase === 'sin_conexion', 'NS5.5b sin turno ni red, el estado dice los cambios en cola', A2.n.estado());
    A2.cli.red = false; await W.vivir(90, A2);
    ok(sv.valor('boards', 'l1')?.n === 1 && sv.valor('boards', 'l2')?.n === 2 && (await A2.alm.contarDiario()) === 0 && S.turno.numero === numero && S.turno.dispositivo === DA && !(await huboFase(A2, 'recargar')),
      'NS5.6 al volver la red, «tuyo» con el mismo número: sigue con el turno y sube', { A: resumen(A2), turno: S.turno });
  }
  {
    const { W, A, sv, S } = await conTurno();
    await W.correr(() => A.n.parar(), { max: 30 });
    ok(S.turno.dispositivo == null, 'NS5.7a parar() suelta el turno', S.turno);
    A.matar();
    const A2 = W.nodo(DA, { alm: A.alm }); A2.cli.red = true;
    const r = await W.abrir(A2);
    A2.alm.escribirLocal('boards', 'm1', { n: 1 }); A2.alm.escribirLocal('boards', 'm2', { n: 2 });
    await W.vivir(5, A2); A2.cli.red = false; await W.vivir(60, A2);
    ok(r && r.modo === 'local' && (await huboFase(A2, 'recargar')) && S.turno.dispositivo == null && !A2.cli.llamadas.some(l => l.fn === 'mesa_turno_reclamar') && !sv.reg('boards', 'm1') && (await A2.alm.contarDiario()) === 2,
      'NS5.7 al volver la red, «libre»: estado «recargar», sin reclamar ni subir a mitad', { r, fase: await fase(A2), A: resumen(A2), turno: S.turno });
  }
  {
    const W = mundo(), A = W.nodo(DA); A.cli.colgar = true;
    const r = await W.correr(() => A.n.abrir(), { paso: 500, max: 40 });
    ok(r.valor && r.valor.modo === 'local' && r.valor.motivo === 'sin_conexion' && r.ms <= PRIMERA + 1000, `NS5.8 sin respuesta en ${PRIMERA / 1000} s, abre en «local»`, r);
  }
});

await grupo('NS6 reescanear', async () => {
  {
    const { W, A, sv, S } = await conTurno(W => { for (const k of ['f1', 'f2', 'f3']) W.srv.sembrar('files', k, { nombre: k + '.jpg' }); });
    sv.sembrar('files', 'f9', { nombre: 'de otro' }, { dispositivo: DB });   // arriba, sin bajar: este navegador no la conoce
    A.alm.vaciarLocal('files'); A.alm.escribirLocal('files', 'f1', { nombre: 'f1 otra vez' });
    await W.vivir(15, A);
    const esc = escrituras(A).filter(l => l.args.cambios.some(c => c.almacen === 'files'));
    ok(sv.borrado('files', 'f2') && sv.borrado('files', 'f3') && sv.valor('files', 'f1')?.nombre === 'f1 otra vez', 'NS6.1 tras vaciar un almacén: lápida por cada clave conocida que ya no está, y lo de aquí sube con su valor', { A: resumen(A) });
    ok(esc.length && esc.filter(l => l.args.cambios.some(c => c.almacen === 'files' && c.valor === null)).every(l => l.args.reescanear === true) && S.actividad.some(x => x.tipo === 'borrado_masivo' && x.detalle.reescanear),
      'NS6.2 esos lotes llevan reescanear: true', esc.map(l => ({ re: l.args.reescanear, c: l.args.cambios.map(c => c.clave + (c.valor === null ? '×' : '')) })));
    ok(sv.vivo('files', 'f9') && !conClave(A, 'files', 'f9').length, 'NS6.3 nunca una lápida para una clave que no conoce', sv.reg('files', 'f9'));
    ok(!(await A.alm.diario({})).some(e => e.a === 'files' && e.k == null), 'NS6.4 al confirmarse, la marca se quita', await A.alm.diario({}));
  }
  {
    const { W, A, sv } = await conTurno(W => { for (const k of ['f1', 'f2', 'f3']) W.srv.sembrar('files', k, { nombre: k + '.jpg' }); });
    for (let i = 1; i <= 5; i++) sv.sembrar('boards', 'b' + i, { n: i }, { dispositivo: DB });   // más que bajar, en varias páginas
    W.S.filasPorPagina = 2;
    A.alm.vaciarLocal('files');
    A.matar();   // la página se recarga antes de subir
    const A2 = W.nodo(DA, { alm: A.alm }); A2.cli.fallos.push({ fn: 'mesa_bajar', modo: 'red', saltar: 1 });
    const r = await W.abrir(A2);
    await W.vivir(60, A2);
    const ll = A2.cli.llamadas, iF = ll.findIndex(l => l.fn === 'mesa_bajar' && l.error), iRe = ll.findIndex(l => l.fn === 'mesa_escribir' && l.args && l.args.reescanear);
    const entera = iRe < 0 || ll.slice(iF + 1, iRe).some(l => l.fn === 'mesa_bajar' && okResp(l) && l.resp.mas === false);
    ok(r && r.modo === 'local' && iF >= 0 && entera && (iRe >= 0 || ['f1', 'f2', 'f3'].every(k => sv.vivo('files', k))), 'NS6.5 sin haber bajado entero en esta sesión no reescanea (nunca borra arriba con una bajada a medias)', { r, A: resumen(A2) });
  }
});

await grupo('NS7 reconciliar', async () => {
  const W = mundo(), sv = W.srv, S = W.S, A = W.nodo(DA), B = W.nodo(DB);
  await W.abrir(A);
  A.alm.escribirLocal('boards', 'r1', { de: 'A0' }); A.alm.escribirLocal('boards', 'r2', { de: 'A0' }); await W.vivir(6, A);
  A.alm.escribirLocal('boards', 'r1', { de: 'A1' }); A.alm.escribirLocal('boards', 'r2', { de: 'A1' });
  A.congelar();
  await W.abrir(B);
  await W.correr(() => B.n.usarAqui(), { tics: [B], max: 60 });
  await W.correr(() => B.n.forzar(S.turno.numero), { tics: [B], max: 20 });
  B.matar(); const B2 = W.nodo(DB, { alm: B.alm }); await W.abrir(B2);
  B2.alm.escribirLocal('boards', 'r1', { de: 'B' }); await W.vivir(6, B2);
  A.descongelar(); await W.vivir(10, A, B2);
  await W.correr(() => B2.n.parar(), { max: 30 });
  A.matar();
  const A2 = W.nodo(DA, { alm: A.alm }), r = await W.abrir(A2);
  const ss = await A2.alm.sinSubir();
  if (!ok(r && r.modo === 'turno' && sv.reg('boards', 'r1')?.version === 2 && ['r1', 'r2'].every(k => ss.some(e => e.k === k)), 'NS7.0 A perdió el turno con r1 y r2 sin subir; B escribió r1; A vuelve a tener la Mesa', { r, ss, turno: S.turno })) return;
  const sub = await W.correr(() => A2.n.subirEncima([['boards', 'r1']]), { tics: [A2], max: 30 });
  ok(!sub.colgado && A2.efectos.recargas >= 1 && mismo(A2.alm.ver('boards', 'r1'), { de: 'A1' }), 'NS7.1 subirEncima vuelve a poner aquí lo suyo y recarga (puede subirlo ya o en el siguiente subir)', { sub, local: A2.alm.ver('boards', 'r1') });
  A2.matar(); const A3 = W.nodo(DA, { alm: A.alm }); await W.abrir(A3); await W.vivir(15, A3);
  ok(sv.valor('boards', 'r1')?.de === 'A1' && sv.reg('boards', 'r1')?.version === 3 && !(await A3.alm.sinSubir()).some(e => e.k === 'r1' && e.motivo === 'choque'), 'NS7.2 … y sube con la base de la última versión: lo de aquí queda arriba', { r1: sv.reg('boards', 'r1'), A: resumen(A3) });
  ok(S.historial.some(h => h.almacen === 'boards' && h.clave === 'r1' && h.dispositivo === DB && mismo(h.valor, { de: 'B' })), 'NS7.3 lo pisado (lo de B) queda en el historial del servidor', S.historial.filter(h => h.clave === 'r1'));
  const c2 = A3.alm.versionDe('boards', 'r2');
  const des = await W.correr(() => A3.n.descartar([['boards', 'r2']]), { tics: [A3], max: 30 });
  ok(!des.colgado && mismo(A3.alm.ver('boards', 'r2'), { de: 'A0' }) && !(await A3.alm.sinSubir()).some(e => e.k === 'r2') && A3.efectos.recargas >= 1, 'NS7.4 descartar trae el valor del servidor, lo quita de la lista y recarga', { des, local: A3.alm.ver('boards', 'r2') });
  ok(c2 && A3.cli.llamadas.some(l => l.fn === 'mesa_bajar' && l.args.limite === 1 && l.args.desde === c2.o - 1), 'NS7.5 … leyéndolo con mesa_bajar({desde: o − 1, limite: 1})', { c2, A: resumen(A3) });
  await W.vivir(10, A3);
  ok(sv.reg('boards', 'r2')?.version === 1, 'NS7.6 lo descartado no sube', sv.reg('boards', 'r2'));
});

await grupo('NS8 topes y rechazos en el cuerpo', async () => {
  {
    const { W, A, sv } = await conTurno();
    for (let i = 1; i <= 1200; i++) A.alm.escribirLocal('boards', 'm' + String(i).padStart(4, '0'), { n: i });
    await W.vivir(30, A);
    const esc = escrituras(A);
    ok(esc.length >= 3 && esc.every(l => l.args.cambios.length <= 500) && W.S.registros.size === 1200 && (await A.alm.contarDiario()) === 0, 'NS8.1 1.200 cambios salen en lotes de 500 como mucho y entran todos', { lotes: esc.map(l => l.args.cambios.length), servidor: W.S.registros.size });
  }
  {
    const { W, A, sv } = await conTurno();
    for (let i = 1; i <= 5; i++) A.alm.escribirLocal('boards', 'g' + i, { texto: String(i).repeat(1500000) });
    await W.vivir(30, A);
    const esc = escrituras(A).filter(l => l.args.cambios.length), suma = l => l.args.cambios.reduce((s, c) => s + (c.valor === null ? 0 : jsonbDe(c.valor)), 0);
    ok(esc.length >= 3 && esc.every(l => suma(l) <= TOPES.lote && jsonbDe(l.args.cambios) <= 4194304) && [1, 2, 3, 4, 5].every(i => sv.vivo('boards', 'g' + i)), 'NS8.2 valores grandes se parten en lotes de TOPES.lote como mucho', esc.map(l => suma(l)));
  }
  {
    const { W, A, sv } = await conTurno();
    A.alm.escribirLocal('boards', 'enorme', { texto: 'y'.repeat(1960000) }); A.alm.escribirLocal('boards', 'chico', { n: 1 });
    await W.vivir(15, A);
    const s = (await A.alm.sinSubir()).find(e => e.k === 'enorme');
    ok(s && s.motivo === 'tope' && sv.vivo('boards', 'chico') && !conClave(A, 'boards', 'enorme').length, 'NS8.3 un valor de más de TOPES.valor va a «quedó sin subir» con motivo «tope» y no se manda', { s: s && { ...s, valor: '…' }, A: resumen(A) });
    await W.vivir(30, A);
    ok(!conClave(A, 'boards', 'enorme').length, 'NS8.4 … ni se reintenta', resumen(A));
  }
  {
    const { W, A, sv, S } = await conTurno(); S.topes.lote = 1000000;
    for (let i = 1; i <= 3; i++) A.alm.escribirLocal('boards', 'z' + i, { texto: String(i).repeat(600000) });
    await W.vivir(30, A);
    ok([1, 2, 3].every(i => sv.vivo('boards', 'z' + i)) && !(await A.alm.sinSubir()).length && escrituras(A).some(l => l.resp && l.resp.ok === false && l.resp.error.tope === 'lote'), 'NS8.5 el servidor dice «tope» de lote (200, ok: false): parte el lote y entra todo', resumen(A));
  }
  {
    const { W, A, sv, S } = await conTurno(); S.topes.valor = 500000;
    A.alm.escribirLocal('boards', 'grande', { texto: 'q'.repeat(700000) }); A.alm.escribirLocal('boards', 'p1', { n: 1 }); A.alm.escribirLocal('boards', 'p2', { n: 2 });
    await W.vivir(30, A);
    const s = (await A.alm.sinSubir()).find(e => e.k === 'grande'), iR = escrituras(A).findIndex(l => l.resp && l.resp.ok === false && l.resp.error.tope === 'valor');
    ok(s && s.motivo === 'tope' && sv.vivo('boards', 'p1') && sv.vivo('boards', 'p2') && !sv.reg('boards', 'grande') && iR >= 0 && !escrituras(A).slice(iR + 1).some(l => l.args.cambios.some(c => c.clave === 'grande')),
      'NS8.6 el servidor dice «tope» de un valor: ese a «quedó sin subir» y el resto otra vez', { A: resumen(A) });
  }
  {
    const { W, A, sv, S } = await conTurno(); S.formaSi = c => c.clave === 'mal';
    for (const k of ['q1', 'mal', 'q2', 'q3']) A.alm.escribirLocal('boards', k, { k });
    await W.vivir(30, A);
    ok(['q1', 'q2', 'q3'].every(k => sv.vivo('boards', k)) && !sv.reg('boards', 'mal') && (await A.alm.sinSubir()).some(e => e.k === 'mal'), 'NS8.7 «forma» con indice aparta solo ese cambio', { ss: await A.alm.sinSubir(), A: resumen(A) });
  }
  {
    const { W, A, sv, S } = await conTurno(); S.malas.add('boards|malo');
    for (const k of ['w1', 'w2', 'w3', 'malo', 'w4', 'w5', 'w6', 'w7']) A.alm.escribirLocal('boards', k, { k });
    await W.vivir(40, A);
    ok([1, 2, 3, 4, 5, 6, 7].every(i => sv.vivo('boards', 'w' + i)) && !sv.reg('boards', 'malo') && (await A.alm.sinSubir()).some(e => e.k === 'malo') && conClave(A, 'boards', 'malo').length <= 8,
      'NS8.8 un HTTP 400 (22P05) se aísla por mitades: el malo a «quedó sin subir», el resto entra', { intentos: conClave(A, 'boards', 'malo').length, A: resumen(A) });
  }
  {
    const { W, A, sv, S } = await conTurno(); S.escribirRaro = 1e9;
    A.alm.escribirLocal('boards', 'h1', { n: 1 }); A.alm.escribirLocal('boards', 'h2', { n: 2 });
    await W.vivir(20, A);
    ok(escrituras(A).length > 0 && !sv.reg('boards', 'h1') && (await noPerdido(A.alm, 'boards', 'h1')) && (await noPerdido(A.alm, 'boards', 'h2')), 'NS8.9 un 200 con ok: false nunca se da por guardado (sigue en el diario o en la lista, sin versión)', { diario: await A.alm.diario({}), A: resumen(A) });
  }
  {
    const { W, A, sv, S } = await conTurno();
    A.alm.escribirLocal('boards', 'v1', { n: 1 }); S.version_minima = '4.100';   // 4.100 > 4.32 como números
    await W.vivir(15, A);
    ok((await fase(A)) === 'vieja' && A.efectos.pausas.some(p => p.motivo === 'vieja') && !sv.reg('boards', 'v1') && (await noPerdido(A.alm, 'boards', 'v1')), 'NS8.10 «app» (426) → estado «vieja» y pausar, sin perder lo pendiente', { fase: await fase(A), pausas: A.efectos.pausas, A: resumen(A) });
  }
  {
    const { W, A, sv } = await conTurno();
    A.cli.permiso = true; A.alm.escribirLocal('boards', 'k1', { n: 1 });
    await W.vivir(15, A);
    ok((await fase(A)) === 'otra_cuenta' && !sv.reg('boards', 'k1') && (await noPerdido(A.alm, 'boards', 'k1')), 'NS8.11 «permiso» → estado «otra_cuenta», sin perder lo pendiente', { fase: await fase(A), A: resumen(A) });
  }
  {
    const { W, A, sv } = await conTurno();
    A.cli.fallos.push({ fn: 'mesa_escribir', modo: '5xx' });
    A.alm.escribirLocal('boards', 'x1', { n: 1 });
    await W.vivir(90, A);
    const esc = escrituras(A);
    ok(sv.valor('boards', 'x1')?.n === 1 && esc.length >= 2 && esc[0].error && esc[1].texto === esc[0].texto && !(await A.alm.sinSubir()).length, 'NS8.12 un 5xx: el mismo lote más tarde, y entra', resumen(A));
  }
  {
    const r = [];
    let W = mundo(); W.S.version_minima = '4.100'; r.push(['vieja', await W.abrir(W.nodo(DA))]);
    W = mundo(); let x = W.nodo(DA); x.cli.permiso = true; r.push(['otra_cuenta', await W.abrir(x)]);
    W = mundo(); x = W.nodo(DA); x.cli.sinSesion = true; r.push(['sin_sesion', await W.abrir(x)]);
    W = mundo(); W.S.turno.numero = 4; W.S.turno.dispositivo = DB; W.S.turno.desde = W.S.turno.latido = W.reloj.t; W.S.version_minima = '4.100';
    r.push(['vieja', await W.abrir(W.nodo(DA))]);   // la mínima de `mesa_turno_ver` también cuenta con la Mesa ocupada
    const mal = r.filter(([m, v]) => !v || v.modo !== m);
    ok(!mal.length, 'NS8.13 al abrir: mínima mayor (4.100 > 4.32) → «vieja», «permiso» → «otra_cuenta», 401 → «sin_sesion»', mal);
  }
});

await grupo('NS9 serializar', async () => {
  const bytes = Buffer.from('foto de prueba'), blob = new Blob([bytes], { type: 'image/jpeg' });
  const file = new File([Buffer.from('pdf de prueba')], 'factura-1.pdf', { type: 'application/pdf', lastModified: 1700000000000 });
  const entrada = { nombre: 'a\u0000b', ['cl\u0000ave']: 1, lista: [1, undefined, 'x\ud83dy', '😀', 'z\udc00'], nada: undefined, foto: blob, doc: file, anidado: { fotos: [{ id: 'p1', blob }] } };
  const s = await N.serializar(entrada, huella), v = s && s.valor;
  const r = v && v.foto;
  ok(r && N.esRef(r) && r.__blob === 'pendiente' && r.sha256 === sha(bytes) && r.tam === bytes.length && r.tipo === 'image/jpeg' && N.esRef(v.anidado.fotos[0].blob) && v.anidado.fotos[0].blob.sha256 === sha(bytes),
    'NS9.1 un Blob pasa a {__blob: «pendiente», sha256, tam, tipo} (también dentro de una lista)', v);
  const d = v && v.doc;
  ok(d && N.esRef(d) && d.nombre === 'factura-1.pdf' && 'fecha' in d && d.tipo === 'application/pdf' && d.sha256 === sha(Buffer.from('pdf de prueba')), 'NS9.2 un File lleva además nombre y fecha', d);
  ok(v && v.nombre === 'ab' && v.clave === 1 && !Object.keys(v).some(k => k.includes('\u0000')), 'NS9.3 \\u0000 fuera de cada texto, también de las claves', v && Object.keys(v));
  ok(v && v.lista[2] === 'x�y' && v.lista[3] === '😀' && v.lista[4] === 'z�', 'NS9.4 un sustituto UTF-16 suelto pasa a �; un par entero se queda', v && v.lista);
  ok(v && !('nada' in v) && v.lista.length === 5 && v.lista[1] === null, 'NS9.5 undefined desaparece en objetos y es null en listas', v);
  ok(s && s.bytes === bytesJson(v) && s.jsonb === s.bytes + estructura(v) && s.jsonb >= s.bytes, 'NS9.6 bytes = UTF-8 de JSON.stringify; jsonb = bytes + un byte por cada «:» y «,» de estructura', { bytes: s && s.bytes, jsonb: s && s.jsonb, esperado: v && [bytesJson(v), bytesJson(v) + estructura(v)] });
  ok(entrada.nombre === 'a\u0000b' && 'nada' in entrada && entrada.foto === blob && entrada.lista[1] === undefined && entrada.anidado.fotos[0].blob === blob, 'NS9.7 serializar no cambia lo que recibe', entrada);
  class Cosa { constructor() { this.a = 1; } }
  contarDate = false; const fecha = new ctx.Date(0); contarDate = true;
  const malos = { Map: new Map([[1, 2]]), Set: new Set([1]), Date: fecha, ArrayBuffer: new ArrayBuffer(4), Uint8Array: new Uint8Array(4), funcion: () => 1, NaN: NaN, Infinity: Infinity, clase: new Cosa() };
  const noLanza = [];
  for (const [nombre, x] of Object.entries(malos)) { try { await N.serializar({ dentro: [{ x }] }, huella); noLanza.push(nombre + ' (no lanzó)'); } catch (e) { if (!e || e.codigo !== 'forma') noLanza.push(nombre + ' (codigo ' + (e && e.codigo) + ')'); } }
  ok(!noLanza.length, 'NS9.8 Map, Set, Date, ArrayBuffer, Uint8Array, una función, NaN, Infinity y una clase lanzan con codigo «forma»', noLanza.join(', '));
  const ref = refDe('x');
  ok(N.esBlob(blob) && N.esBlob(file) && !N.esBlob({}) && !N.esBlob(null) && !N.esBlob(ref) && N.esRef(ref) && !N.esRef({}) && !N.esRef(null) && !N.esRef(blob), 'NS9.9 esBlob y esRef por su forma');
  const { W, A, sv } = await conTurno();
  A.alm.escribirLocal('files', 'foto-1', { nombre: 'foto-1.jpg', blob, thumb: new Blob(['mini'], { type: 'image/jpeg' }) });
  A.alm.escribirLocal('tareas', 't-1', { texto: 'a\u0000b\ud83d', fotos: [{ id: 'p1', blob }] });
  await W.vivir(15, A);
  const fv = sv.valor('files', 'foto-1'), tv = sv.valor('tareas', 't-1');
  ok(fv && fv.blob && fv.blob.__blob && fv.blob.sha256 === sha(bytes) && fv.thumb && fv.thumb.__blob && tv && tv.texto === 'ab�' && tv.fotos[0].blob.__blob && A.cli.blobs === 0,
    'NS9.10 al subir, los Blob van como referencia (nunca {}) y los textos limpios', { fv, tv, blobsEnviados: A.cli.blobs, A: resumen(A) });
});

await grupo('NS10 avisos', async () => {
  const filas = [
    [{ tipo: 'ajeno', detalle: { funcion: 'mesa_bajar' } }, true], [{ tipo: 'ajeno_tope', detalle: { funcion: 'mesa_bajar', en_un_minuto: 60 } }, true],
    [{ tipo: 'dispositivo_nuevo', detalle: { turno: 3, antes: null } }, true], [{ tipo: 'borrado_masivo', detalle: { cuantos: 24 } }, true],
    [{ tipo: 'rechazo', detalle: { funcion: 'mesa_escribir', codigo: 'tope', http: 413 } }, true], [{ tipo: 'rechazo', detalle: { funcion: 'mesa_turno_latido', codigo: 'turno', http: 423 } }, false],
    [{ tipo: 'choque', detalle: { almacen: 'boards', clave: 'x' } }, false], [{ tipo: 'turno_reclamado', detalle: { turno: 3 } }, false], [{ tipo: 'turno_forzado', detalle: { turno: 3 } }, false],
  ];
  const mal = []; for (const [f, e] of filas) if (!!N.esAviso({ id: 1, hora: iso(0), dispositivo: DA, ...f }) !== e) mal.push(f.tipo + (f.detalle.funcion ? '/' + f.detalle.funcion : '') + ' → ' + !e);
  ok(!mal.length, 'NS10.1 esAviso: ajeno, ajeno_tope, dispositivo_nuevo, borrado_masivo y rechazo de mesa_escribir; nada más', mal);
  const { W, A, sv, S } = await conTurno();
  const id = {};
  for (const [nombre, tipo, detalle] of [['ajeno', 'ajeno', { funcion: 'mesa_bajar' }], ['masivo', 'borrado_masivo', { cuantos: 24, reescanear: false }], ['rechEsc', 'rechazo', { funcion: 'mesa_escribir', codigo: 'tope', http: 413 }],
    ['rechLat', 'rechazo', { funcion: 'mesa_turno_latido', codigo: 'turno', http: 423 }], ['choque', 'choque', { almacen: 'boards', clave: 'x' }], ['reclamado', 'turno_reclamado', { turno: 9 }]]) { sv.anotar(tipo, DB, detalle); id[nombre] = S.actividad[S.actividad.length - 1].id; }
  const t0 = W.reloj.t; await W.vivir(185, A);
  const lec = A.cli.llamadas.filter(l => l.fn === 'mesa_actividad'), ts = lec.map(l => l.t);
  ok(lec.length >= 1 && lec.length <= Math.ceil(185000 / ACTIVIDAD) + 1 && ts.every((t, i) => i === 0 || t - ts[i - 1] >= ACTIVIDAD), `NS10.2 mesa_actividad como mucho una vez por minuto (${lec.length} en 185 s)`, ts.map(t => (t - t0) / 1000));
  const ids = l => (Array.isArray(l) ? l : []).map(x => (x && typeof x === 'object' ? x.id : x));
  let av = ids((await W.correr(() => A.n.avisos(), { max: 5 })).valor);
  ok(['ajeno', 'masivo', 'rechEsc'].every(k => av.includes(id[k])) && !['rechLat', 'choque', 'reclamado'].some(k => av.includes(id[k])), 'NS10.3 los avisos son las filas de esAviso', { av, id });
  await W.correr(() => A.n.marcarVisto(id.ajeno), { max: 5 });
  av = ids((await W.correr(() => A.n.avisos(), { max: 5 })).valor);
  ok(!av.includes(id.ajeno) && av.includes(id.masivo) && !A.alm.avisosYa().includes(id.ajeno), 'NS10.4 marcarVisto quita ese aviso (y solo ese)', { av, almacen: A.alm.avisosYa() });
  const ult = lec.filter(okResp).pop();
  ok(ult && A.alm.metaYa().actividad === ult.resp.hasta, 'NS10.5 se guarda el último «hasta» leído', { meta: A.alm.metaYa(), hasta: ult && ult.resp.hasta });
});

await grupo('NS11 segunda ronda de revisión', async () => {
  {
    const { W, A } = await conTurno();
    await W.vivir(6, A);
    A.alm.escribirLocal('boards', 'c1', { n: 1 });
    await W.vivir(1, A);
    ok(A.n.estado().cola === 1, 'NS11.1 con turno, un cambio sale en el estado antes de la calma (nunca «al día» con cambios esperando)', A.n.estado());
  }
  {
    const { W, A, sv } = await conTurno();
    const roto = new Blob(['xxxxxxxxxx'], { type: 'image/x-ilegible' });
    A.alm.escribirLocal('files', 'roto', { nombre: 'roto.jpg', blob: roto });
    A.alm.escribirLocal('boards', 'sigue', { n: 2 });
    await W.vivir(40, A);
    const ss = await A.alm.sinSubir();
    ok(sv.valor('boards', 'sigue')?.n === 2, 'NS11.2 una foto que no se puede leer no atasca lo demás', sv.reg('boards', 'sigue'));
    ok(ss.some(e => e.k === 'roto' && e.motivo === 'ilegible') && !sv.reg('files', 'roto'), 'NS11.3 … y tras varios intentos queda aparte («ilegible»), sin subir', ss);
  }
  {
    const { W, A, sv } = await conTurno(W => { for (let i = 0; i < 10; i++) W.srv.sembrar('boards', 'v' + i, { n: i }); });
    A.alm.vaciarLocal('boards');
    await W.vivir(15, A);
    const ss = await A.alm.sinSubir();
    ok([...Array(10).keys()].every(i => sv.vivo('boards', 'v' + i)) && ss.filter(e => e.motivo === 'masivo').length === 10, 'NS11.4 vaciar un almacén pequeño entero no borra arriba: cada lápida espera a Kevin («masivo»)', { ss: ss.length });
  }
});

console.log('NS0 al final');
ok(usoDate === 0 && usoTemporizador === 0, 'NS0.5 el núcleo no usa Date, setTimeout ni setInterval (todo con el reloj que recibe)', { usoDate, usoTemporizador });
terminado = true;
console.log(fallos ? `${fallos} fallos de ${n}` : `todo bien (${n})`);
process.exit(fallos ? 1 : 0);
