// nube.js · 1.0 · la Mesa con servidor, lote 3 del traspaso C (D-253 a D-257). Mesa ≥ 4.32.
// La Mesa sigue trabajando sobre IndexedDB; esto sube por detrás cada cambio del diario (D-250) al servidor (servidor/mesa.sql,
// D-251) y, al abrir, baja lo último antes de dibujar. Una sola Mesa a la vez entre ordenadores (el turno, en dos fases) y,
// sin red, los cambios esperan; si el turno ya no es de este navegador, nada sube solo: va a «quedó sin subir».
// Dos partes. El núcleo (`window.NubeNucleo`) decide todo sin DOM ni IndexedDB y sin la hora del aparato: recibe `servidor`,
// `almacen` y `reloj` (contrato: .claude/rediseno/traspaso/contrato.md, «Nube (lote 3)»), y se prueba en Node sin red
// (tests/nube-simulada.mjs). El pegamento (solo con `window.MESA`) los hace con la sesión de «Web del cliente» y con
// `MESA._in.nubeAlmacen` (en mesa.js: solo mesa.js abre IndexedDB), pinta el estado y los avisos y da `window.MESA.nube`.
// Apagada (lo normal hasta la mudanza, lote 5) no hace nada: ni red ni temporizadores.
(function (G) {
  'use strict';
  const VERSION = '1.0';

  // ================= el núcleo =================
  const TOPES = Object.freeze({ cambios: 500, valor: 1950000, lote: 3600000, masivo: 20 });   // como jsonb; los del servidor: 500 / 2 MB / 4 MB
  const TIEMPOS = Object.freeze({ latido: 5000, calma: 3000, pideViva: 60, espera: 20000, primera: 4000, primeraSuya: 15000, actividad: 60000, pedirCada: 3000,
    reintento: Object.freeze([5000, 10000, 20000, 40000, 60000]) });
  const AVISA = ['ajeno', 'ajeno_tope', 'dispositivo_nuevo', 'borrado_masivo'];
  const esAviso = f => !!f && (AVISA.includes(f.tipo) || (f.tipo === 'rechazo' && !!f.detalle && f.detalle.funcion === 'mesa_escribir'));

  const esBlob = x => !!x && typeof x === 'object' && typeof x.size === 'number' && typeof x.type === 'string' && typeof x.arrayBuffer === 'function';
  const esRef = x => !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.__blob === 'string' && /^[0-9a-f]{64}$/.test(String(x.sha256 || ''));
  const plano = x => { const p = Object.getPrototypeOf(x); return p === null || Object.getPrototypeOf(p) === null; };   // {} de cualquier contexto
  const deQue = x => { const t = Object.prototype.toString.call(x).slice(8, -1); return t === 'Object' ? ((x.constructor && x.constructor.name) || 'un objeto') : t; };
  const enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  const bytesDe = t => (enc ? enc.encode(t).length : unescape(encodeURIComponent(t)).length);
  // lo que jsonb no admite: \u0000 fuera; un sustituto UTF-16 suelto (un emoji cortado), por U+FFFD
  function sanear(t) {
    if (!/[\u0000\uD800-\uDFFF]/.test(t)) return t;
    let o = '';
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i);
      if (c === 0) continue;
      if (c >= 0xD800 && c <= 0xDBFF) { const d = t.charCodeAt(i + 1); if (d >= 0xDC00 && d <= 0xDFFF) { o += t[i] + t[i + 1]; i++; } else o += '�'; continue; }
      o += c >= 0xDC00 && c <= 0xDFFF ? '�' : t[i];
    }
    return o;
  }
  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const huellaPorOmision = async b => hex(await G.crypto.subtle.digest('SHA-256', await b.arrayBuffer()));
  const forma = m => { const e = new Error(m); e.codigo = 'forma'; return e; };

  // El valor tal como sube: cada Blob es una referencia «pendiente» (el lote 4 la llenará); lo que JSON cambiaría en silencio
  // (Map, Set, Date, ArrayBuffer…) es un error a la vista, nunca otra cosa subida.
  async function serializar(valor, huella) {
    const h = huella || huellaPorOmision, blobs = [];   // el recorrido es síncrono (no cede el hilo por cada nodo); las huellas, después
    let sep = 0;
    function ir(x, ruta) {
      if (x === null) return null;
      const t = typeof x;
      if (t === 'string') return sanear(x);
      if (t === 'boolean') return x;
      if (t === 'number') { if (!Number.isFinite(x)) throw forma(`un número que no es finito en ${ruta}`); return x; }
      if (t === 'undefined') return undefined;
      if (t !== 'object') throw forma(`${t} en ${ruta}`);
      if (esBlob(x)) {
        const r = { __blob: 'pendiente', sha256: '', tam: x.size, tipo: sanear(x.type || '') };
        if (typeof x.name === 'string' && typeof x.lastModified === 'number') { r.nombre = sanear(x.name); r.fecha = x.lastModified; }
        sep += r.nombre != null ? 11 : 7;
        blobs.push([r, x, ruta]);
        return r;
      }
      if (Array.isArray(x)) {
        const o = new Array(x.length);
        for (let i = 0; i < x.length; i++) { const v = ir(x[i], ruta + '[' + i + ']'); o[i] = v === undefined ? null : v; }
        if (o.length > 1) sep += o.length - 1;
        return o;
      }
      if (!plano(x)) throw forma(`${deQue(x)} en ${ruta}`);
      const o = {}; let n = 0;
      for (const k of Object.keys(x)) { const v = ir(x[k], ruta + '.' + k); if (v === undefined) continue; o[sanear(k)] = v; n++; }
      if (n) sep += n + n - 1;   // un «:» por clave y una «,» entre ellas
      return o;
    }
    let v = ir(valor, 'el valor'); if (v === undefined) v = null;
    for (const [r, b, ruta] of blobs) r.sha256 = await h(b, ruta);
    const bytes = bytesDe(JSON.stringify(v));
    return { valor: v, bytes, jsonb: bytes + sep };
  }

  // Lo bajado, salvo cada Blob de aquí donde lo bajado trae su referencia (mismo tamaño y tipo): las fotos solo están aquí.
  function unir(local, bajado) {
    if (esRef(bajado)) return esBlob(local) && local.size === bajado.tam && (local.type || '') === (bajado.tipo || '') ? local : { ...bajado };
    if (Array.isArray(bajado)) {
      const L = Array.isArray(local) ? local : [];
      const conId = e => !!e && typeof e === 'object' && !Array.isArray(e) && e.id != null;
      const porId = bajado.some(conId) ? new Map(L.filter(conId).map(e => [String(e.id), e])) : null;
      return bajado.map((e, i) => unir(porId && conId(e) ? porId.get(String(e.id)) : L[i], e));
    }
    if (bajado && typeof bajado === 'object') {
      const L = local && typeof local === 'object' && !Array.isArray(local) && !esBlob(local) ? local : {};
      const o = {}; for (const k of Object.keys(bajado)) o[k] = unir(L[k], bajado[k]); return o;
    }
    return bajado;
  }
  // El mismo valor sin mirar el orden de las claves (jsonb las ordena); un Blob y su referencia, por tamaño y tipo.
  function igual(a, b) {
    if (a === b) return true;
    if (esBlob(a) || esRef(a) || esBlob(b) || esRef(b)) {
      const t = x => esBlob(x) ? [x.size, x.type || ''] : esRef(x) ? [x.tam, x.tipo || ''] : null, p = t(a), q = t(b);
      return !!p && !!q && p[0] === q[0] && p[1] === q[1];
    }
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
      if (typeof a === 'string' && typeof b === 'string') return sanear(a) === sanear(b);
      return false;
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => igual(x === undefined ? null : x, b[i] === undefined ? null : b[i]));
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && igual(a[k], b[k]));
  }
  const conBlob = x => { if (esBlob(x)) return true; if (!x || typeof x !== 'object') return false; return Array.isArray(x) ? x.some(conBlob) : Object.keys(x).some(k => conBlob(x[k])); };
  const vNum = s => String(s || '0.0').split('.').map(n => parseInt(n, 10) || 0);
  const masNueva = (min, app) => { const [a1, a2] = vNum(min), [b1, b2] = vNum(app); return a1 > b1 || (a1 === b1 && a2 > b2); };
  const esRed = e => !!e && (!e.status || e.codigo === 'red' || e.status >= 500 || e.status === 408 || e.status === 429);
  const sinSesionE = e => !!e && (e.status === 401 || e.codigo === 'sesion');

  function crear(o) {
    const S = o.servidor, A = o.almacen, R = o.reloj, D = o.dispositivo, APP = o.app, E = o.efectos || {};
    const H0 = o.huella || huellaPorOmision, HC = new Map();   // huellas de esta sesión: a|k|ruta|tamaño|tipo
    const huellaDe = (a, k) => (b, ruta) => { const c = a + '\u0001' + k + '\u0001' + ruta + '\u0001' + b.size + '\u0001' + b.type + '\u0001' + (b.lastModified || ''); if (!HC.has(c)) HC.set(c, H0(b).catch(e => { HC.delete(c); throw e; })); return HC.get(c); };
    const ILEGIBLE = new Map();   // a|k → intentos fallidos de leer sus fotos (un Blob que IndexedDB ya no puede leer)
    const st = { fase: 'apagada', turno: null, cursor: 0, epoca: null, cola: 0, sinSubir: 0, tiene: null, error: '', alDia: false };
    let conTurno = false, modoLocal = false, parado = false, ocupado = false, cediendo = false, subiendo = null, bajado = false;
    let ultCambio = -Infinity, ultLatido = -Infinity, colaLatida = -1, ultActividad = -Infinity, proximo = 0, reint = 0, enVuelo = null, AV = [];
    const avisar = () => { try { if (E.estado) E.estado(estado()); } catch (e) { /* un oyente roto no para la nube */ } };
    const fase = f => { if (st.fase !== f) { st.fase = f; } avisar(); };
    const otroIntento = () => { const l = TIEMPOS.reintento; proximo = R.ahora() + l[Math.min(reint++, l.length - 1)]; };
    async function llamar(fn, args) {
      try { return await S.rpc(fn, args); }
      catch (e) { throw { status: (e && e.status) || 0, codigo: (e && e.codigo) || '', message: String((e && e.message) || e), red: esRed(e) }; }
    }
    function conTope(p, ms) {
      p.catch(() => { /* lo dice quien gana */ });
      return Promise.race([p, R.esperar(Math.max(0, ms)).then(() => { throw { status: 0, codigo: 'red', message: 'el servidor no contesta a tiempo', red: true, tope: true }; })]);
    }
    async function contarSinSubir() { try { st.sinSubir = A.cuantosSinSubir ? await A.cuantosSinSubir() : (await A.sinSubir()).length; } catch (e) { /* */ } }
    async function contarCola() { try { st.cola = await A.contarDiario(); } catch (e) { /* */ } }

    // ---------- estados de los que no se sale solo ----------
    async function pausar(info, f = 'pausada') {
      conTurno = false; modoLocal = false;
      fase(f);
      try { if (E.pausar) await E.pausar(info); } catch (e) { /* la pausa de la Mesa no para la nube */ }
    }
    const vieja = () => pausar({ motivo: 'vieja' }, 'vieja');
    async function perdido(info) {
      if (st.fase === 'pausada' && !conTurno) return;
      conTurno = false; modoLocal = false;
      st.tiene = info && info.dispositivo ? { dispositivo: info.dispositivo } : st.tiene;
      fase('pausada');
      try { if (E.pausar) await E.pausar({ motivo: 'perdido', dispositivo: info && info.dispositivo }); } catch (e) { /* */ }
      await apartarDiario('turno');   // nada sube encima de quien la tiene ahora: Kevin decide en «quedó sin subir»
      avisar();
    }
    async function trasRechazo(r) {
      const er = (r && r.error) || {}, c = er.codigo;
      if (c === 'turno') return perdido({ dispositivo: er.dispositivo || null });
      if (c === 'app') return vieja();
      if (c === 'permiso') { conTurno = false; modoLocal = false; return fase('otra_cuenta'); }
      st.error = er.mensaje || (r ? 'respuesta sin «ok»' : 'sin respuesta'); otroIntento(); avisar();
    }
    function sinRed(e) {
      if (sinSesionE(e)) { conTurno = false; modoLocal = false; fase('sin_sesion'); return false; }
      st.error = e && e.message || 'sin conexión'; otroIntento(); fase('sin_conexion'); return false;
    }
    async function apartarDiario(motivo) {
      let despues = null;
      for (;;) {
        const pag = await A.diario({ despues, n: 500 }); if (!pag.length) break;
        const u = pag[pag.length - 1]; despues = u.k == null ? [u.a] : [u.a, u.k];
        const l = pag.filter(e => e.k != null).map(e => ({ a: e.a, k: e.k, v: e.v, motivo }));
        if (l.length) await A.apartar(l);
      }
      await contarSinSubir();
    }

    // ---------- abrir: primero bajar ----------
    async function abrir() {
      parado = false; conTurno = false; modoLocal = false; bajado = false; st.alDia = false; st.error = '';
      fase('abriendo');
      const t0 = R.ahora(), m = await A.meta();
      st.cursor = m.cursor || 0; st.epoca = m.epoca || null; await contarSinSubir(); await contarCola();
      let r;
      try { r = await conTope(llamar('mesa_turno_ver', { dispositivo: D }), TIEMPOS.primera); }
      catch (e) { return abrirLocal(e); }
      if (!r || r.ok !== true) return abrirRechazo(r);
      if (masNueva(r.version_minima, APP)) { await vieja(); return { modo: 'vieja' }; }
      let otraEpoca = false;
      if (st.epoca && r.epoca && r.epoca !== st.epoca) { await olvidar(); otraEpoca = true; }   // se restauró una copia del servidor
      let orden = 0;
      if (r.tuyo) { st.turno = r.turno; }
      else if (r.libre) {
        let c;
        try { c = await conTope(llamar('mesa_turno_reclamar', { dispositivo: D, visto: r.turno, app: APP, forzar: false }), TIEMPOS.primera - (R.ahora() - t0)); }
        catch (e) { return abrirLocal(e); }
        if (!c || c.ok !== true) {
          if (c && c.error && c.error.codigo === 'turno') return abrirPausada({ dispositivo: c.error.dispositivo || null });
          return abrirRechazo(c);
        }
        st.turno = c.turno; orden = c.orden || 0;
      } else return abrirPausada(r.tiene);
      try { await bajarTodo(orden, t0, otraEpoca, r.tuyo ? TIEMPOS.primeraSuya : TIEMPOS.primera); }   // ya suya (tras «Recarga»): la red contesta; un tope más largo
      catch (e) {
        if (e && e.vieja) { if (!r.tuyo) { try { await llamar('mesa_turno_soltar', { dispositivo: D, turno: st.turno }); } catch (x) { /* */ } } await vieja(); return { modo: 'vieja' }; }   // la tomó al abrir: la suelta, que no espere quien tiene la nueva
        return e && e.rechazo ? abrirRechazo(e.rechazo) : abrirLocal(e);
      }
      conTurno = true; st.alDia = true; st.tiene = null;
      await A.ponerMeta({ turno: st.turno });
      fase('guardado');
      return { modo: 'turno' };
    }
    async function abrirLocal(e) {
      await contarCola();
      if (sinSesionE(e)) { fase('sin_sesion'); return { modo: 'sin_sesion' }; }
      modoLocal = true; st.error = (e && e.message) || 'sin conexión'; otroIntento(); fase('sin_conexion');
      return { modo: 'local', motivo: 'sin_conexion' };
    }
    async function abrirRechazo(r) {
      const c = r && r.error && r.error.codigo;
      if (c === 'app') { await vieja(); return { modo: 'vieja' }; }
      if (c === 'permiso') { fase('otra_cuenta'); return { modo: 'otra_cuenta' }; }
      return abrirLocal({ message: (r && r.error && r.error.mensaje) || 'respuesta sin «ok»' });
    }
    async function abrirPausada(t) {
      st.tiene = t || null; fase('pausada');
      return { modo: 'pausada', tiene: st.tiene };
    }
    async function olvidar() { await A.olvidar(); st.cursor = 0; st.epoca = null; }
    async function bajarTodo(ordenMin, t0, yaOlvidada, tope = TIEMPOS.primera) {
      fase('bajando');
      let desde = st.cursor, primera = true, otraEpoca = !!yaOlvidada, nuevos = 0, sig = null;
      const pedirPag = (d, lim) => { const q = llamar('mesa_bajar', { desde: d, limite: lim }); q.catch(() => { /* se mira al esperarla */ }); return q; };
      for (;;) {
        // la primera, entera si la red ya contestó deprisa; si no, pequeña, para que llegue antes del tope
        const p = sig || pedirPag(desde, primera && t0 != null && R.ahora() - t0 > 1000 ? 100 : 500);
        sig = null;
        const r = t0 != null && primera ? await conTope(p, tope - (R.ahora() - t0)) : await p;
        if (!r || r.ok !== true) {
          if (r && r.error && r.error.codigo === 'cursor' && !otraEpoca) { await olvidar(); desde = 0; otraEpoca = true; continue; }
          throw { rechazo: r };
        }
        if (st.epoca && r.epoca && r.epoca !== st.epoca && !otraEpoca) { await olvidar(); desde = 0; otraEpoca = true; continue; }
        const fin = !r.mas && (r.hasta >= (ordenMin || 0) || !(r.filas || []).length);
        if (!fin) sig = pedirPag(r.hasta, 500);   // la siguiente se pide mientras esta se escribe (el cursor solo avanza al escribirla)
        nuevos += await aplicarPagina(r.filas || [], r.hasta, r.epoca);
        st.cursor = r.hasta; st.epoca = r.epoca || st.epoca; desde = r.hasta; primera = false;
        if (fin) break;
      }
      if (otraEpoca) await A.apuntarSinVersion();   // lo de aquí que no está arriba, para subirlo como nuevo
      bajado = true;
      await contarSinSubir();
      return nuevos;
    }
    // Lo bajado gana siempre; lo de aquí que no estaba arriba (con su nota en el diario y otra versión arriba) queda aparte.
    async function aplicarPagina(filas, hasta, epoca) {
      if (A.conoce && filas.some(f => !A.conoce(f.almacen))) throw { vieja: true };   // un almacén que esta Mesa no conoce: la escribió una más nueva
      const L = filas.length ? await A.leerVarios(filas.map(f => [f.almacen, f.clave])) : [];
      const escribir = [], saltar = [], aparte = [];
      filas.forEach((f, i) => {
        const { valor: local, pendiente, conocida } = L[i] || {}, ver = { a: f.almacen, k: f.clave, v: f.version, o: f.orden, b: !!f.borrado };
        if (conocida && f.version <= conocida.v) return;   // ya lo tiene (su propia escritura, o una página repetida)
        const mismo = f.borrado ? local === undefined : igual(local, f.valor);
        if (mismo) { saltar.push(ver); return; }
        // lo escribió este mismo navegador y su respuesta se perdió (una versión justo sobre la que sabía): lo de aquí es lo último
        if (pendiente && conocida && f.dispositivo === D && f.version === conocida.v + 1) { saltar.push(ver); return; }
        // una lápida sobre fotos que solo están aquí (hasta el lote 4, arriba no hay bytes): no se borran, se apartan para Kevin
        if (f.borrado && conBlob(local)) { aparte.push({ a: f.almacen, k: f.clave, valor: local, borrado: false, motivo: 'borrado_arriba', ficha: pendiente ? pendiente.v : null, ultima: f.version, de: f.dispositivo, turnoDe: f.turno }); saltar.push(ver); return; }
        if (pendiente) aparte.push({ a: f.almacen, k: f.clave, valor: local, borrado: local === undefined, motivo: 'bajada', ficha: pendiente.v, ultima: f.version, de: f.dispositivo, turnoDe: f.turno });
        escribir.push({ ...ver, valor: f.borrado ? null : unir(local, f.valor) });
      });
      await A.aplicar({ escribir, saltar, aparte, cursor: hasta, epoca });
      return escribir.length + aparte.length;
    }

    // ---------- el pulso: latido, subir, actividad ----------
    async function tic() {
      if (parado || ocupado) return;
      ocupado = true;
      try {
        if (modoLocal || st.fase === 'sin_sesion' || st.fase === 'recargar' || st.fase === 'pausada') {   // sin turno: la cola a la vista, también
          const c0 = st.cola; await contarCola(); if (st.cola !== c0) avisar();
          if (modoLocal && R.ahora() >= proximo) await reconectar();
          return;
        }
        if (!conTurno || cediendo) return;
        const cola = await A.contarDiario(); if (cola !== st.cola) { st.cola = cola; avisar(); }   // el estado nunca dice «al día» con cambios esperando
        if (R.ahora() - ultLatido >= TIEMPOS.latido || cola !== colaLatida) {
          if (R.ahora() < proximo && st.fase === 'sin_conexion') return;
          if (!(await latir(cola))) return;
        }
        if ((cola > 0 || enVuelo) && R.ahora() - ultCambio >= TIEMPOS.calma && R.ahora() >= proximo) await subir();
        if (conTurno && R.ahora() - ultActividad >= TIEMPOS.actividad) await leerActividad();
        if (conTurno && !subiendo && st.fase !== 'sin_conexion' && st.fase !== 'guardado') fase('guardado');
      } catch (e) { st.error = String((e && e.message) || e); avisar(); }
      finally { ocupado = false; }
    }
    async function latir(cola) {
      let r;
      try { r = await llamar('mesa_turno_latido', { dispositivo: D, turno: st.turno, app: APP, cola }); }
      catch (e) { ultLatido = R.ahora(); return sinRed(e); }
      ultLatido = R.ahora();
      if (!r || r.ok !== true) { await trasRechazo(r); return false; }
      colaLatida = cola; reint = 0; proximo = 0; st.error = '';
      if (st.fase === 'sin_conexion') fase('guardado');
      if (masNueva(r.version_minima, APP)) { await vieja(); return false; }
      const p = r.pide;
      if (p && !p.tuyo && p.dispositivo !== D && (p.ultima_hace == null ? p.hace : p.ultima_hace) <= TIEMPOS.pideViva) { await ceder(p); return false; }
      return true;
    }
    async function reconectar() {
      let r;
      try { r = await llamar('mesa_turno_ver', { dispositivo: D }); } catch (e) { return sinRed(e); }
      if (!r || r.ok !== true) return trasRechazo(r);
      if (masNueva(r.version_minima, APP)) return vieja();
      const m = await A.meta();
      if (r.tuyo && r.turno === m.turno && (!m.epoca || !r.epoca || r.epoca === m.epoca)) {
        // la tenía y nadie la reclamó entretanto: nadie más escribió. Si la bajada de esta sesión no acabó, se acaba ahora (lo que
        // falte solo puede ser de este navegador); si trajera algo nuevo, la Mesa en memoria ya no vale: recargar
        st.turno = r.turno;
        if (!bajado) {
          let n;
          try { n = await bajarTodo(0, null); } catch (e) { if (e && e.vieja) return vieja(); return e && e.rechazo ? trasRechazo(e.rechazo) : sinRed(e); }
          if (n) { modoLocal = false; fase('recargar'); return; }
        }
        modoLocal = false; conTurno = true; st.alDia = true; reint = 0; proximo = 0; st.error = ''; fase('guardado'); return;
      }
      modoLocal = false;
      if (r.tuyo || r.libre) { fase('recargar'); return; }   // no se reclama a mitad: primero bajar, al recargar
      await perdido({ dispositivo: r.tiene && r.tiene.dispositivo });
    }
    // Otro la pide: se pausa la Mesa (vuelca mesa-pending al diario), sube todo sin esperar calma y la suelta.
    async function ceder(pide) {
      if (cediendo) return;
      cediendo = true;
      try {
        await pausar({ motivo: 'cede', dispositivo: pide.dispositivo }, 'subiendo'); conTurno = true;
        let antes = -1;
        for (let vuelta = 0; !parado; vuelta++) {
          const r = await subir({ todo: true });
          if (r.parar && !r.sinRed) return;   // la perdió entretanto (la forzaron) o la app es vieja
          if (r.sinRed) { await R.esperar(TIEMPOS.reintento[Math.min(vuelta, TIEMPOS.reintento.length - 1)]); continue; }
          const n = await A.contarDiario();
          if (!n) break;
          if (n === antes) { await apartarDiario('cede'); break; }   // lo que ya no sube (una marca sin poder reescanear)
          antes = n;
        }
        for (let vuelta = 0; !parado; vuelta++) {
          let r;
          try { r = await llamar('mesa_turno_soltar', { dispositivo: D, turno: st.turno }); }
          catch (e) { if (sinSesionE(e)) break; await R.esperar(TIEMPOS.reintento[Math.min(vuelta, TIEMPOS.reintento.length - 1)]); continue; }
          if ((r && r.ok) || (r && r.error && r.error.codigo === 'turno')) break;
          await R.esperar(TIEMPOS.reintento[Math.min(vuelta, TIEMPOS.reintento.length - 1)]);
        }
        conTurno = false; st.tiene = { dispositivo: pide.dispositivo }; fase('pausada');
      } finally { cediendo = false; }
    }

    // ---------- subir ----------
    function subir(op = {}) {
      if (!conTurno) return Promise.resolve({ subidos: 0, aparte: 0, parar: true });
      if (subiendo) return subiendo;
      subiendo = subirYa(op).finally(() => { subiendo = null; });
      return subiendo;
    }
    async function subirYa() {
      fase('subiendo');
      const tot = { subidos: 0, aparte: 0 };
      const suma = r => { tot.subidos += r.subidos || 0; tot.aparte += r.aparte || 0; return r; };
      if (enVuelo) { const r = suma(await mandar(enVuelo.lote, enVuelo.resc, enVuelo.args)); if (r.parar) return { ...tot, ...r }; }
      let despues = null; const marcas = [];
      for (;;) {
        const pag = await A.diario({ despues, n: TOPES.cambios }); if (!pag.length) break;
        const u = pag[pag.length - 1]; despues = u.k == null ? [u.a] : [u.a, u.k];
        marcas.push(...pag.filter(e => e.k == null));
        const ents = pag.filter(e => e.k != null); if (!ents.length) continue;
        const L = await A.leerVarios(ents.map(e => [e.a, e.k])), lista = [], fuera = [];
        for (let i = 0; i < ents.length; i++) {
          const e = ents[i], { valor, conocida } = L[i] || {};
          const x = await cambioDe(e.a, e.k, valor, conocida, e.v, fuera); if (x) lista.push(x);
        }
        if (fuera.length) { await A.apartar(fuera); tot.aparte += fuera.length; }
        for (const lote of partir(lista)) { const r = suma(await mandar(lote, false)); if (r.parar) return { ...tot, ...r }; }
      }
      if (st.alDia) for (const m of marcas) { const r = suma(await reescanear(m)); if (r.parar) return { ...tot, ...r }; }
      await contarSinSubir();
      st.cola = await A.contarDiario(); fase('guardado');
      return tot;
    }
    async function cambioDe(a, k, valor, conocida, ficha, fuera) {
      let v = null, med = { jsonb: 4 };
      if (valor !== undefined) {
        try { const s = await serializar(valor, huellaDe(a, k)); v = s.valor; med = s; }
        catch (x) {
          if (x && x.codigo === 'forma') { fuera.push({ a, k, v: ficha, motivo: 'forma', mensaje: String(x.message || x) }); return null; }
          // no se pudo leer (una foto que IndexedDB ya no tiene): este se queda en el diario y los demás siguen; al tercer intento, aparte
          const n = (ILEGIBLE.get(a + '|' + k) || 0) + 1; ILEGIBLE.set(a + '|' + k, n);
          if (n >= 3) { ILEGIBLE.delete(a + '|' + k); fuera.push({ a, k, v: ficha, motivo: 'ilegible', mensaje: String((x && x.message) || x) }); }
          return null;
        }
      }
      if (med.jsonb > TOPES.valor) { fuera.push({ a, k, v: ficha, motivo: 'tope', mensaje: `pesa ${Math.round(med.jsonb / 1e5) / 10} MB; el tope de un registro es 2 MB` }); return null; }
      return { c: { almacen: a, clave: k, base: conocida ? conocida.v : 0, valor: v }, ficha, tam: med.jsonb + bytesDe(a) + bytesDe(String(k)) + 64 };
    }
    function partir(lista) {
      const out = []; let cur = [], tam = 0;
      for (const x of lista) {
        if (cur.length && (cur.length >= TOPES.cambios || tam + x.tam > TOPES.lote)) { out.push(cur); cur = []; tam = 0; }
        cur.push(x); tam += x.tam;
      }
      if (cur.length) out.push(cur);
      return out;
    }
    async function porMitades(lote, resc, motivo, mensaje) {
      if (lote.length === 1) { const x = lote[0]; if (x.ficha !== null) await A.apartar([{ a: x.c.almacen, k: x.c.clave, v: x.ficha, motivo, mensaje }]); return { subidos: 0, aparte: 1 }; }
      const m = Math.ceil(lote.length / 2), out = { subidos: 0, aparte: 0 };
      for (const parte of [lote.slice(0, m), lote.slice(m)]) { const r = await mandar(parte, resc); out.subidos += r.subidos || 0; out.aparte += r.aparte || 0; if (r.parar) return { ...out, parar: true, sinRed: r.sinRed }; }
      return out;
    }
    // Un lote en vuelo: si no hay respuesta, el mismo objeto de argumentos se manda otra vez (lo ya escrito vuelve «igual»).
    async function mandar(lote, resc, args0) {
      const args = args0 || { dispositivo: D, turno: st.turno, app: APP, cambios: lote.map(x => x.c), ...(resc ? { reescanear: true } : {}) };
      let r;
      try { r = await llamar('mesa_escribir', args); }
      catch (e) {
        if (e.status === 400 && (e.codigo === '22P05' || e.codigo === '22P02')) { enVuelo = null; return porMitades(lote, resc, 'texto', 'un texto que el servidor no admite'); }
        if (sinSesionE(e)) { enVuelo = null; sinRed(e); return { parar: true }; }
        enVuelo = { lote, resc, args }; sinRed(e); st.cola = await A.contarDiario().catch(() => st.cola); avisar();
        return { parar: true, sinRed: true };
      }
      enVuelo = null; reint = 0; proximo = 0; st.error = '';
      if (!r || r.ok !== true) {
        const er = (r && r.error) || {}, c = er.codigo;
        if (c === 'tope' && er.tope === 'valor') {
          const i = lote.findIndex(x => x.c.almacen === er.almacen && String(x.c.clave) === String(er.clave));
          if (i < 0) return porMitades(lote, resc, 'tope', er.mensaje);
          const [x] = lote.splice(i, 1);
          if (x.ficha !== null) await A.apartar([{ a: x.c.almacen, k: x.c.clave, v: x.ficha, motivo: 'tope', mensaje: er.mensaje || 'pasa del tope de un registro' }]);
          if (!lote.length) return { subidos: 0, aparte: 1 };
          const r2 = await mandar(lote, resc); return { ...r2, aparte: (r2.aparte || 0) + 1 };
        }
        if (c === 'tope') return lote.length > 1 ? porMitades(lote, resc, 'tope', er.mensaje) : porMitades(lote, resc, 'tope', er.mensaje);
        if (c === 'forma' && er.indice >= 1 && er.indice <= lote.length) {
          const [x] = lote.splice(er.indice - 1, 1);
          if (x.ficha !== null) await A.apartar([{ a: x.c.almacen, k: x.c.clave, v: x.ficha, motivo: 'forma', mensaje: er.mensaje || 'el servidor no lo admite' }]);
          if (!lote.length) return { subidos: 0, aparte: 1 };
          const r2 = await mandar(lote, resc); return { ...r2, aparte: (r2.aparte || 0) + 1 };
        }
        if (c === 'forma') return porMitades(lote, resc, 'forma', er.mensaje);
        await trasRechazo(r); return { parar: true };
      }
      if (r.epoca && st.epoca && r.epoca !== st.epoca) { conTurno = false; fase('recargar'); return { parar: true }; }   // se restauró una copia del servidor
      const versiones = [], quitar = [], aparte = [];
      (r.resultados || []).forEach((x, i) => {
        const it = lote[i]; if (!it || !x) return;
        const a = it.c.almacen, k = it.c.clave;
        if (x.estado === 'ok' || x.estado === 'igual') {
          versiones.push({ a, k, v: x.version, o: x.orden, b: it.c.valor === null });
          if (it.ficha !== null) quitar.push({ a, k, v: it.ficha });
        } else if (x.estado === 'choque') {
          if (x.dispositivo === D && x.turno === st.turno && it.c.base > 0) versiones.push({ a, k, v: x.ultima, o: x.orden, b: !!x.borrado });   // la suya, sin respuesta: otra vez con esta base
          else if (it.ficha !== null) aparte.push({ a, k, v: it.ficha, motivo: 'choque', ultima: x.ultima, de: x.dispositivo, turnoDe: x.turno });
        }
      });
      await A.confirmar({ versiones, quitar });
      if (aparte.length) await A.apartar(aparte);
      return { subidos: quitar.length, aparte: aparte.length };
    }
    // Un vaciado (la marca {a, k: null}): cada clave de aquí sube; cada una que este navegador conoce viva y ya no está, como
    // lápida; nunca una que no conoce. Solo después de haber bajado entero en esta sesión.
    async function reescanear(m) {
      const a = m.a, locales = await A.claves(a), con = (await A.conocidas(a)) || {}, aqui = new Set(locales.map(String));
      const L = locales.length ? await A.leerVarios(locales.map(k => [a, k])) : [], lista = [], fuera = [];
      for (let i = 0; i < locales.length; i++) {
        const k = locales[i], x = L[i] || {};
        const c = await cambioDe(a, k, x.valor, x.conocida || con[k] || null, x.pendiente ? x.pendiente.v : null, fuera); if (c) lista.push(c);
      }
      const vivas = Object.entries(con).filter(([, c]) => c && !c.b), lap = vivas.filter(([k]) => !aqui.has(String(k)));
      // un vaciado que borraría muchos arriba (más de 20, o más de 2 que sean más de una décima parte de lo que se conoce) no sube solo: cada lápida
      // espera en «quedó sin subir» a que Kevin la confirme con «Subir encima»
      if (lap.length > TOPES.masivo || (lap.length > 2 && lap.length * 10 > vivas.length)) fuera.push(...lap.map(([k]) => ({ a, k, v: null, motivo: 'masivo', mensaje: `un vaciado de ${a} borraría ${lap.length} registros arriba` })));
      else for (const [k, c] of lap) lista.push({ c: { almacen: a, clave: k, base: c.v, valor: null }, ficha: null, tam: 120 });
      if (fuera.length) await A.apartar(fuera);
      const tot = { subidos: 0, aparte: fuera.length };
      for (const lote of partir(lista)) { const r = await mandar(lote, true); tot.subidos += r.subidos || 0; tot.aparte += r.aparte || 0; if (r.parar) return { ...tot, ...r }; }
      await A.confirmar({ versiones: [], quitar: [{ a, k: null, v: m.v }] });
      return tot;
    }

    // ---------- pasar el turno ----------
    async function usarAqui() {
      fase('esperando');
      const t0 = R.ahora();
      for (;;) {
        let r;
        try { r = await llamar('mesa_turno_pedir', { dispositivo: D, app: APP }); }
        catch (e) { if (sinSesionE(e)) { fase('sin_sesion'); return { error: 'sin_sesion' }; } fase('pausada'); return { error: 'sin_conexion' }; }
        if (!r || r.ok !== true) { await trasRechazo(r); return { error: (r && r.error && r.error.codigo) || 'sin respuesta' }; }
        if (masNueva(r.version_minima, APP)) { await vieja(); return { error: 'app' }; }
        if (r.tuyo) { if (E.recargar) E.recargar(); return { hecho: true }; }
        if (r.libre) {
          let c;
          try { c = await llamar('mesa_turno_reclamar', { dispositivo: D, visto: r.turno, app: APP, forzar: false }); }
          catch (e) { fase('pausada'); return { error: 'sin_conexion' }; }
          if (c && c.ok) { if (E.recargar) E.recargar(); return { hecho: true }; }
          if (c && c.error && c.error.codigo === 'turno') continue;   // otro llegó antes: sigue pidiendo
          await trasRechazo(c); return { error: (c && c.error && c.error.codigo) || 'sin respuesta' };
        }
        st.tiene = r.tiene || null; avisar();
        if (R.ahora() - t0 >= TIEMPOS.espera) {
          const t = r.tiene || {};
          return { espera: { dispositivo: t.dispositivo || null, desde: t.desde || null, latido: t.latido || null, latido_hace: t.latido_hace == null ? null : t.latido_hace, cola: t.cola || 0, turno: r.turno } };
        }
        await R.esperar(TIEMPOS.pedirCada);
        if (parado) return { error: 'parada' };
      }
    }
    async function forzar(visto) {
      let c;
      try { c = await llamar('mesa_turno_reclamar', { dispositivo: D, visto, app: APP, forzar: true }); }
      catch (e) { return { error: sinSesionE(e) ? 'sin_sesion' : 'sin_conexion' }; }
      if (c && c.ok) { if (E.recargar) E.recargar(); return { hecho: true }; }
      if (c && c.error && c.error.codigo === 'turno_cambiado') return { otraVez: true };
      await trasRechazo(c); return { error: (c && c.error && c.error.codigo) || 'sin respuesta' };
    }

    // ---------- «quedó sin subir» ----------
    const esta = (claves, x) => claves.some(c => c[0] === x.a && String(c[1]) === String(x.k));
    async function subirEncima(claves) {
      if (!conTurno || !st.alDia) return { error: 'sin turno: usa la Mesa aquí antes' };
      const lista = (await A.sinSubir()).filter(x => esta(claves, x));
      if (E.congelar) await E.congelar();   // lo que hay en memoria ya no se guarda encima: se escribe y se recarga
      try {
        for (const x of lista) {
          const [L] = await A.leerVarios([[x.a, x.k]]), con = L && L.conocida;
          await A.reponer(x.a, x.k, x.borrado ? undefined : x.valor);
          const base = Math.max(con ? con.v : 0, x.ultima || 0);   // la última del servidor que se sabe: la siguiente subida la pisa
          await A.confirmar({ versiones: [{ a: x.a, k: x.k, v: base, o: con ? con.o : undefined, b: !!(con && con.b) }], quitar: [] });
        }
        await A.quitarSinSubir(lista.map(x => [x.a, x.k]));
        ultCambio = -Infinity; await subir({ todo: true });
        await contarSinSubir();
        return { hecho: lista.length };
      } finally { if (E.recargar) E.recargar(); }   // también si algo falla: la Mesa no se queda congelada
    }
    async function descartar(claves) {
      if (!conTurno || !st.alDia) return { error: 'sin turno: usa la Mesa aquí antes' };
      const lista = (await A.sinSubir()).filter(x => esta(claves, x)), escribir = [], quedan = [];
      if (E.congelar) await E.congelar();
      for (const x of lista) {
        const [L] = await A.leerVarios([[x.a, x.k]]);
        if (!L || !L.conocida) { quedan.push(x); continue; }   // nunca subió: arriba no hay nada que dejar; se queda en la lista
        if (L.pendiente) continue;   // cambiado otra vez aquí: lo de aquí se queda y sube
        const aquiLoApartado = x.borrado ? L.valor === undefined : igual(L.valor, x.valor);
        if (!aquiLoApartado) continue;                   // aquí ya está lo del servidor (lo trajo una bajada)
        let r;
        try { r = await llamar('mesa_bajar', { desde: Math.max(0, (L.conocida.o || 1) - 1), limite: 1 }); }
        catch (e) { quedan.push(x); continue; }
        const f = r && r.ok && (r.filas || [])[0];
        if (!f || f.almacen !== x.a || String(f.clave) !== String(x.k)) { quedan.push(x); continue; }   // cambió arriba: se baja al recargar
        escribir.push({ a: f.almacen, k: f.clave, v: f.version, o: f.orden, b: !!f.borrado, valor: f.borrado ? null : unir(L.valor, f.valor) });
      }
      try {
        if (escribir.length) await A.aplicar({ escribir, saltar: [], aparte: [], cursor: st.cursor, epoca: st.epoca });
        await A.quitarSinSubir(lista.filter(x => !quedan.includes(x)).map(x => [x.a, x.k]));
        await contarSinSubir();
        return { hecho: lista.length - quedan.length, quedan: quedan.length };
      } finally { if (E.recargar) E.recargar(); }
    }

    // ---------- avisos de actividad (lote 2): como mucho uno cada minuto ----------
    async function leerActividad() {
      ultActividad = R.ahora();
      const m = await A.meta(), primera = m.actividad == null;
      let desde = primera ? 0 : m.actividad, hora = null; const nuevos = [];
      for (let i = 0; i < 3; i++) {
        let r;
        try { r = await llamar('mesa_actividad', { desde, limite: 200 }); } catch (e) { return; }
        if (!r || r.ok !== true) return;
        hora = r.hora || hora; nuevos.push(...(r.filas || []).filter(esAviso)); desde = r.hasta;
        if (!r.mas) break;
      }
      let l = nuevos;
      if (primera && hora) { const lim = Date.parse(hora) - 7 * 864e5; l = l.filter(f => Date.parse(f.hora) >= lim); }   // la primera vez, solo la última semana (horas del servidor)
      if (l.length) await A.ponerAvisos(l);
      await A.ponerMeta({ actividad: desde });
      AV = await A.avisos(); avisar();
    }

    function estado() { return { fase: st.fase, turno: st.turno, cursor: st.cursor, epoca: st.epoca, cola: st.cola, sinSubir: st.sinSubir, tiene: st.tiene, error: st.error, alDia: st.alDia, avisos: AV.length }; }
    return {
      abrir, tic, subir, usarAqui, forzar, subirEncima, descartar, estado,
      cambio: () => { ultCambio = R.ahora(); },
      avisos: async () => { AV = await A.avisos(); return AV; },
      marcarVisto: async id => { await A.quitarAviso(id); AV = await A.avisos(); avisar(); },
      sinSubir: () => A.sinSubir(),
      leerActividad,
      conTurno: () => conTurno,
      // la sesión volvió (Kevin entró otra vez): como al volver la red, sin reclamar a mitad
      reintentar: () => { if (!conTurno && (st.fase === 'sin_sesion' || st.fase === 'sin_conexion')) { modoLocal = true; proximo = 0; reint = 0; } },
      parar: async () => {
        if (conTurno) { try { await subir({ todo: true }); } catch (e) { /* */ } try { await llamar('mesa_turno_soltar', { dispositivo: D, turno: st.turno }); } catch (e) { /* */ } }
        parado = true; conTurno = false; modoLocal = false; fase('apagada');
      }
    };
  }

  G.NubeNucleo = { version: VERSION, crear, serializar, unir, igual, esRef, esBlob, esAviso, TOPES, TIEMPOS };
  if (!G.MESA || !G.document) return;
  // ================= el pegamento (la Mesa) =================
  const M = G.MESA, X = () => M._in, D = G.document;
  if (M.nube && M.nube._off) { try { M.nube._off(); } catch (e) { /* una versión anterior ya no está */ } }
  const lsG = k => { try { return G.localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsS = (k, v) => { try { if (v == null) G.localStorage.removeItem(k); else G.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ACTIVA = 'mesa-nube', DISP_K = 'mesa-nube-dispositivo';
  const OFF = [], on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };

  // ---------- este navegador: un dispositivo ----------
  // Un id por perfil de navegador (localStorage, por origen), legible: «mac-claude-9f86d0818…» → «Mac · app Claude (9f86)».
  const SO = { mac: 'Mac', win: 'Windows', ios: 'iPhone o iPad', android: 'Android', linux: 'Linux', eq: 'Ordenador' };
  const NAV = { claude: 'app Claude', chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge', nav: 'navegador' };
  function dispositivo() {
    let d = lsG(DISP_K);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(d)) {
      const ua = (G.navigator && G.navigator.userAgent) || '';
      const so = /iPhone|iPad/.test(ua) ? 'ios' : /Mac/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'win' : /Android/.test(ua) ? 'android' : /Linux/.test(ua) ? 'linux' : 'eq';
      const nav = /Claude\//.test(ua) ? 'claude' : /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'nav';
      d = `${so}-${nav}-${hex(G.crypto.getRandomValues(new Uint8Array(8)))}`; lsS(DISP_K, d);
    }
    return d;
  }
  let DISP_ = null; const DISP0 = () => DISP_ || (DISP_ = dispositivo());
  function nombreDe(id) {
    if (!id) return 'otro ordenador';
    const yo = lsG(DISP_K) || DISP_;
    const m = /^([a-z]+)-([a-z]+)-([0-9a-f]{4})/.exec(String(id));
    if (id === yo) return m && m[1] === 'mac' ? `Este Mac · ${NAV[m[2]] || m[2]}` : `Este ordenador${m ? ' · ' + (NAV[m[2]] || m[2]) : ''}`;
    return m ? `${SO[m[1]] || 'Ordenador'} · ${NAV[m[2]] || m[2]} (${m[3]})` : `otro ordenador (${String(id).slice(0, 8)})`;
  }
  const cuando = iso => { try { const d = X().localDay(iso), h = X().localTime(iso); return (d === X().hoy() ? '' : X().fmtDate(d) + ' ') + (h || ''); } catch (e) { return ''; } };
  const cuandoCorto = iso => { try { const d = X().localDay(iso), h = X().localTime(iso); return d === X().hoy() ? esc(h) : `${esc(X().fmtDate(d, true))}<br>${esc(h)}`; } catch (e) { return ''; } };
  // «desde las 10:02» hoy; «desde el mié, 18 nov a las 23:17» otro día (hora de Madrid)
  const desde = iso => { try { const d = X().localDay(iso), h = X().localTime(iso); return d === X().hoy() ? `desde las ${h}` : `desde el ${X().fmtDate(d)}${h ? ' a las ' + h : ''}`; } catch (e) { return ''; } };

  // ---------- encendida o apagada ----------
  // Apagada salvo que Claude la active en este navegador (MESA.nube.activar, con el OK de Kevin): en la Mesa publicada contra el
  // proyecto real; en una copia de este Mac (127.0.0.1), contra el de `mesa-web-proyecto`, nunca el real (como web.js).
  const sb = () => (X().supa ? X().supa() : null);
  const encendida = () => lsG(ACTIVA) === '1' && !!sb();
  X().NUBE.activa = encendida();
  let N = null, ESTADO = { fase: 'apagada' }, pulso = 0, AVS = [];
  function nucleo() {
    if (N) return N;
    const c = sb();
    N = G.NubeNucleo.crear({
      servidor: { rpc: (fn, args) => c.rpc(fn, args) },
      almacen: X().nubeAlmacen,
      reloj: { ahora: () => Date.now(), esperar: ms => new Promise(r => setTimeout(r, ms)) },
      dispositivo: DISP0(), app: M.version,
      efectos: { pausar, congelar: () => X().pausaNube(null), recargar: () => { try { G.location.reload(); } catch (e) { /* */ } }, estado: e => { ESTADO = e; pintar(); } }
    });
    X().NUBE.alApuntar = () => N.cambio();
    return N;
  }
  function arrancarPulso() {
    clearInterval(pulso);
    pulso = setInterval(() => { if (N && !X().locked) N.tic().catch(() => { /* lo dice su estado */ }); }, 1000);
  }
  // M.boot lo llama antes de leer nada (mesa.js, nubeAbrir): primero bajar, después dibujar
  async function abrir() {
    const r = await nucleo().abrir();
    if (r.modo === 'pausada') pintarPausa();          // mesa.js lo pinta con el armazón, desde el primer momento
    else if (r.modo === 'vieja') pausar({ motivo: 'vieja' });
    arrancarPulso();
    AVS = await nucleo().avisos().catch(() => []);   // el núcleo y la página cuentan los mismos
    return r;
  }
  function trasArmazon(f) { const t0 = Date.now(), t = setInterval(() => { if (X().shellReady() || Date.now() - t0 > 30000) { clearInterval(t); try { f(); } catch (e) { /* */ } } }, 100); }

  // ---------- la pausa: otro ordenador tiene la Mesa ----------
  const capa = (h, p, botones) => `<div class="card dlg nubedlg"><h3>${h}</h3>${p}<div class="form"><div class="row">${botones}</div></div></div>`;
  function pausar(info) {
    X().NUBE.modo = info && info.motivo === 'vieja' ? 'vieja' : 'pausada';
    const quien = esc(nombreDe(info && info.dispositivo)), ed = X().xfer && X().xfer.edPendiente && X().xfer.edPendiente() ? ' El editor tenía cambios sin aplicar: se han perdido.' : '';
    if (info && info.motivo === 'vieja') return X().pausaNube(capa('Hay una versión nueva de la Mesa', `<p>Otro ordenador usa una versión más nueva: esta se ha pausado para no pisar sus datos. Recárgala para seguir: lo guardado no se pierde.</p>`, '<button type="button" class="btn" data-nube="recargar">Recargar</button>'));
    if (info && info.motivo === 'cede') return X().pausaNube(capa(`La Mesa pasa a ${quien}`, `<p class="nubeesp">Subiendo lo último que hiciste aquí…${ed}</p>`, ''));
    return X().pausaNube(capa(`La Mesa está abierta en ${quien}`, `<p>Para no pisar sus cambios, esta se ha pausado.${ed} Lo que no se llegó a subir queda en «Quedó sin subir».</p>`, '<button type="button" class="btn2" data-nube="panel">Ver lo que quedó sin subir</button><button type="button" class="btn" data-nube="usar">Usar aquí</button>'));
  }
  function pintarPausa(extra) {
    const t = ESTADO.tiene || {}, quien = esc(nombreDe(t.dispositivo)), dd = t.desde ? ' ' + esc(desde(t.desde)) : '';
    const p = extra || `<p>Solo se puede usar en un ordenador a la vez. Si la usas aquí, ${quien} sube lo que tenga y se pausa.</p>`;
    X().pausaNube(capa(`La Mesa está abierta en ${quien}${dd}`, p, (ESTADO.sinSubir ? `<button type="button" class="btn2" data-nube="panel">Quedó sin subir (${ESTADO.sinSubir})</button>` : '') + '<button type="button" class="btn" data-nube="usar">Usar aquí</button>'));
  }
  async function usarAqui() {
    const t = ESTADO.tiene || {}, quien = esc(nombreDe(t.dispositivo));
    X().pausaNube(capa(`Pidiendo la Mesa a ${quien}`, `<p class="nubeesp">Esperando a que suba sus cambios y la suelte…</p>`, ''));
    const r = await nucleo().usarAqui();
    if (r.hecho) return;
    if (r.espera) {
      const e = r.espera, n = +e.cola || 0, h = e.latido ? desde(e.latido) : '';
      return X().pausaNube(capa(`${esc(nombreDe(e.dispositivo))} no contesta`, `<p>No contesta${h ? ' ' + esc(h) : ''}; tenía ${n} ${n === 1 ? 'cambio' : 'cambios'} sin subir. Si la usas aquí, esos cambios se quedan en ese ordenador, en «Quedó sin subir».</p>`,
        `<button type="button" class="btn2" data-nube="usar">Esperar más</button><button type="button" class="btn" data-nube="forzar" data-visto="${esc(e.turno)}">Usarla aquí</button>`));
    }
    pintarPausa(`<p>${r.error === 'sin_conexion' ? 'Sin conexión: no se ha podido pedir. Vuelve a intentarlo.' : 'No se ha podido pedir (' + esc(r.error) + '). Vuelve a intentarlo.'}</p>`);
  }
  async function forzar(visto) {
    const r = await nucleo().forzar(+visto);
    if (r.otraVez) return usarAqui();
    if (!r.hecho) pintarPausa(`<p>No se ha podido (${esc(r.error || 'sin respuesta')}). Vuelve a intentarlo.</p>`);
  }

  // ---------- el estado, a la vista y discreto, en la cabecera ----------
  function chipTexto(e) {
    const q = e.sinSubir ? ` · ${e.sinSubir} sin subir` : '';
    switch (e.fase) {
      case 'guardado': return [e.cola ? 'sube' : 'ok', e.cola ? `${e.cola} ${e.cola === 1 ? 'cambio' : 'cambios'} por subir` : 'En la nube', q];   // nunca «guardado» sin estarlo (y no dos «Guardado» en la cabecera)
      case 'subiendo': return ['sube', 'Subiendo…', q];
      case 'bajando': case 'abriendo': return ['sube', 'Bajando…', ''];
      case 'sin_conexion': return ['off', `Sin conexión · ${e.cola} ${e.cola === 1 ? 'cambio' : 'cambios'} en cola`, q];
      case 'pausada': return ['pausa', `Pausada: abierta en ${nombreDe(e.tiene && e.tiene.dispositivo)}`, q];
      case 'esperando': return ['sube', `Esperando a ${nombreDe(e.tiene && e.tiene.dispositivo)}…`, ''];
      case 'recargar': return ['aviso', 'Recarga para bajar lo último', q];
      case 'vieja': return ['aviso', 'Versión vieja: recarga', ''];
      case 'sin_sesion': return ['off', 'Nube: entra con tu correo', q];
      case 'otra_cuenta': return ['aviso', 'Nube: esta cuenta no es la tuya', ''];
      default: return null;
    }
  }
  let PINTADO = '', PANEL = '', PINTADO_EL = null;
  function pintar() {
    const r = X().root && X().root(); if (!r) return;
    if (X().NUBE.activa) estilar();
    const b = r.querySelector('.appbar .nubest');
    if (b) {
      const t = X().NUBE.activa ? chipTexto(ESTADO) : null, k = t ? (ESTADO.sinSubir ? 'aviso' : t[0]) : '', txt = t ? t[1] + t[2] : '';
      const firma = k + '|' + txt;
      if (firma !== PINTADO || b !== PINTADO_EL || b.hidden !== !t) {   // solo si cambia: el pulso de cada segundo no toca el DOM
        PINTADO = firma; PINTADO_EL = b; b.hidden = !t;
        if (t) {
          b.dataset.k = k;
          b.innerHTML = `<span class="nubest-t">${esc(t[1])}</span>${t[2] ? `<span class="nubest-q">${esc(t[2])}</span>` : ''}`;
          b.title = `${txt}. Este navegador: ${nombreDe(DISP0())}. Pulsa para ver el estado${ESTADO.sinSubir ? ' y lo que quedó sin subir' : ''}.`;
          b.setAttribute('aria-label', 'Nube: ' + txt);
        }
      }
    }
    // el panel abierto, solo si cambia lo que enseña (y sin perder dónde estaba la lista)
    const dl = r.querySelector('.detail[data-dlg="nube"]:not([hidden])'), pf = [ESTADO.fase, ESTADO.cola, ESTADO.sinSubir, ESTADO.error, ESTADO.alDia].join('|');
    if (dl && pf !== PANEL && !dl.contains(D.activeElement)) panel(true);
    // la Mesa ya pasó a otro (tras subir lo último): su aviso, con «Usar aquí»
    const lk = r.querySelector('.nubelock');
    if (X().NUBE.activa && ESTADO.fase === 'pausada' && lk && !lk.querySelector('[data-nube="usar"]') && !lk.querySelector('[data-nube="forzar"]')) pintarPausa();
    // un aviso de actividad nuevo, en la página personal en esta misma sesión
    if (X().NUBE.activa && (ESTADO.avisos || 0) !== AVS.length && !releyendo) { releyendo = true; X().nubeAlmacen.avisos().then(l => { AVS = l; releyendo = false; if (M.personal && M.personal.abierta && M.personal.abierta()) M.personal.render(); }, () => { releyendo = false; }); }
  }
  let releyendo = false;

  // ---------- el panel: estado y «quedó sin subir» ----------
  const ALM = { boards: 'Tablero', clients: 'Cliente', bandejas: 'Bandeja', files: 'Foto', tareas: 'Tarea o nota', tfotos: 'Foto de una sesión', cobros: 'Factura', cfacturas: 'PDF de una factura', meses: 'Por qué y cómo fue', ubicaciones: 'Ubicación' };
  const MOTIVO = { ilegible: 'sus fotos no se pueden leer en este navegador', masivo: 'un vaciado lo borraría arriba: «Subir encima» confirma el borrado', borrado_arriba: 'otro ordenador lo borró, pero sus fotos solo están aquí', pendiente: 'la copia de una recarga, de antes de lo que llegó', turno: 'la Mesa pasó a otro ordenador antes de subirlo', choque: 'otro ordenador lo cambió antes', bajada: 'al abrir llegó otra versión del servidor', tope: 'pasa del tope de un registro', forma: 'no se puede subir', texto: 'tiene un texto que el servidor no admite', cede: 'no se pudo subir antes de pasar la Mesa' };
  function etiqueta(x) {
    const v = x.valor || {}, cl = id => ((X().CL || []).find(c => c.id === id) || {}).name || id;
    let t = '';
    if (x.a === 'boards') { const m = /^(.+)-(\d{4}-\d{2})$/.exec(String(x.k)); t = m ? `${cl(m[1])} · ${X().monthLabel ? X().monthLabel(m[2]) : m[2]}` : x.k; }
    else if (x.a === 'clients') t = v.name || x.k;
    else if (x.a === 'bandejas') t = cl(x.k);
    else if (x.a === 'files') t = v.name || x.k;
    else if (x.a === 'tareas') t = v.txt ? String(v.txt).slice(0, 60) : x.k;
    else if (x.a === 'cobros') t = v.factura || v.periodo || x.k;
    else if (x.a === 'meses') t = String(x.k).replace('|', ' · ');
    else if (x.a === 'ubicaciones') t = v.nombre || x.k;
    else t = x.k;
    return `${ALM[x.a] || x.a} «${t}»`;
  }
  async function panel(repintar) {
    const n = N && N.conTurno && N.conTurno(), l = await X().nubeAlmacen.sinSubir().catch(() => []);
    const e = ESTADO, t = chipTexto(e) || ['', 'Apagada', ''];
    const filas = l.map(x => `<li class="nubefila"><div><b>${esc(etiqueta(x))}</b><span>${esc(MOTIVO[x.motivo] || x.motivo)}${x.mensaje ? ': ' + esc(x.mensaje) : ''}${x.de ? ' · ' + esc(nombreDe(x.de)) : ''}${x.t ? ' · ' + esc(cuando(new Date(x.t).toISOString())) : ''}</span></div>`
      + (n && e.alDia ? `<span class="nubeacc"><button type="button" class="lnk" data-nube="descartar" data-a="${esc(x.a)}" data-k="${esc(x.k)}">Descartar</button><button type="button" class="lnk" data-nube="encima" data-a="${esc(x.a)}" data-k="${esc(x.k)}">Subir encima</button></span>` : '') + '</li>').join('');
    PANEL = [e.fase, e.cola, e.sinSubir, e.error, e.alDia].join('|');
    const falta = e.fase === 'sin_conexion' ? ' Para subirlo o descartarlo, espera a tener conexión.' : e.fase === 'recargar' || e.fase === 'vieja' ? ' Para subirlo o descartarlo, recarga antes.' : ' Para subirlo o descartarlo, usa antes la Mesa aquí.';
    const html = `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Nube</h3>
      <p class="nubep"><b>${esc(t[1])}</b>${e.cola && e.fase !== 'sin_conexion' ? ` · ${e.cola} ${e.cola === 1 ? 'cambio' : 'cambios'} en cola` : ''}. Este navegador: ${esc(nombreDe(DISP0()))}.${e.error ? ' Último error: ' + esc(e.error) + '.' : ''}</p>
      ${l.length ? `<h4 class="nubeh">Quedó sin subir <span>${l.length}</span></h4><p class="nubep">Lo hiciste aquí y no llegó al servidor. «Subir encima» lo sube sobre lo que hay allí (lo de allí queda en su historial); «Descartar» deja lo del servidor.${n && e.alDia ? '' : falta}</p><ul class="nubel">${filas}</ul>` : ''}
      <div class="form"><div class="row">${l.length > 1 && n && e.alDia ? '<button type="button" class="btn2" data-nube="descartar-todo">Descartar todo</button><button type="button" class="btn2" data-nube="encima-todo">Subir todo encima</button>' : ''}${e.fase === 'sin_sesion' ? '<button type="button" class="btn" data-nube="entrar">Entrar</button>' : e.fase === 'recargar' || e.fase === 'vieja' ? '<button type="button" class="btn" data-nube="recargar">Recargar</button>' : '<button type="button" class="btn" data-act="close">Cerrar</button>'}</div></div>`;
    if (repintar) { const d = X().root().querySelector('.detail[data-dlg="nube"] .card'); if (d) { const ul = d.querySelector('.nubel'), y = ul ? ul.scrollTop : 0; d.innerHTML = html; const u2 = d.querySelector('.nubel'); if (u2) u2.scrollTop = y; } return; }
    X().showDialog('nube', html);
  }
  async function reconciliar(que, todo, b) {
    const l = await X().nubeAlmacen.sinSubir(), claves = todo ? l.map(x => [x.a, x.k]) : [[b.dataset.a, b.dataset.k]];
    const solos = ['bajada', 'masivo', 'borrado_arriba', 'pendiente'], c2 = todo ? l.filter(x => !solos.includes(x.motivo)).map(x => [x.a, x.k]) : claves;   // esos, de uno en uno
    if (todo) claves.splice(0, claves.length, ...c2);
    if (!claves.length) { X().toast('Lo que queda se sube de uno en uno: míralo antes en la lista.'); return; }
    let r;
    try { r = que === 'encima' ? await nucleo().subirEncima(claves) : await nucleo().descartar(claves); }
    catch (e) { r = { error: String((e && e.message) || e) }; }
    if (r && r.error) X().toast('No se ha podido: ' + r.error + '. Recarga la Mesa.', { error: true });
  }

  // ---------- los avisos de actividad, en «Avisos» de la página personal (D-257) ----------
  const FN = { mesa_bajar: 'leer la Mesa', mesa_escribir: 'escribir en la Mesa', mesa_actividad: 'leer la actividad', mesa_turno_ver: 'mirar el turno', mesa_turno_pedir: 'pedir la Mesa', mesa_turno_reclamar: 'tomar la Mesa', mesa_turno_latido: 'mantener la Mesa', mesa_turno_soltar: 'soltar la Mesa' };
  function avisoTexto(f) {
    const d = f.detalle || {}, quien = f.dispositivo ? nombreDe(f.dispositivo) : '';
    if (f.tipo === 'ajeno') return ['Una cuenta que no es la tuya intentó entrar en la Mesa', `quiso ${FN[d.funcion] || d.funcion || 'algo'}; el servidor lo rechazó`];
    if (f.tipo === 'ajeno_tope') return ['Muchas llamadas de cuentas que no son la tuya', `${d.en_un_minuto || 'más de 60'} en un minuto; todas rechazadas`];
    if (f.tipo === 'dispositivo_nuevo') return ['La Mesa se abrió en un ordenador nuevo', quien];
    const PL = { files: ['foto', 'fotos'], boards: ['tablero', 'tableros'], clients: ['cliente', 'clientes'], bandejas: ['bandeja', 'bandejas'], tareas: ['tarea o nota', 'tareas o notas'], tfotos: ['foto de sesión', 'fotos de sesiones'], cobros: ['factura', 'facturas'], cfacturas: ['PDF', 'PDF'], meses: ['mes', 'meses'], ubicaciones: ['ubicación', 'ubicaciones'] };
    if (f.tipo === 'borrado_masivo') return [`Se borraron ${+d.cuantos || 'muchos'} registros de una vez`, [Object.entries(d.almacenes || {}).map(([a, n]) => `${+n || 0} ${PL[a] ? PL[a][+n === 1 ? 0 : 1] : a}`).join(', '), quien].filter(Boolean).join(' · ')];
    const POR = { tope: 'era demasiado grande', forma: 'venía mal formado', turno: 'llegó sin el turno', turno_cambiado: 'el turno había cambiado', app: 'venía de una versión vieja de la Mesa', permiso: 'sin permiso', cursor: 'de otra copia del servidor' };
    return ['El servidor rechazó un lote', [POR[d.codigo] || (d.codigo ? 'código ' + d.codigo : ''), quien].filter(Boolean).join(' · ')];
  }
  function avisosHTML() {
    if (!X().NUBE.activa || !AVS.length) return '';
    const mas = AVS.length > 8 ? `<p class="pp-sub nubemas">y ${AVS.length - 8} más: «Visto» en estos para ver los siguientes</p>` : '';
    const l = AVS.slice(-8).reverse().map(f => { const [t, x] = avisoTexto(f);
      return `<div class="pp-av nubeav" data-av="${esc(f.id)}" title="${esc(t + (x ? ' · ' + x : ''))}"><span class="pp-avs"></span><span class="pp-cu">${cuandoCorto(f.hora)}</span><span class="pp-afoto vacia nubeico" aria-hidden="true"></span><span class="pp-nm"><b>${esc(t)}</b></span><span class="pp-est">${esc(x)}</span><button type="button" class="lnk nubevisto" data-nube="visto" data-id="${esc(f.id)}" aria-label="Marcar como visto: ${esc(t)}">Visto</button></div>`; }).join('');
    return `<section class="pp-grupo" data-cat="nube"><h3 class="pp-gt">Nube <span>${AVS.length}</span></h3><div class="pp-lista">${l}${mas}</div></section>`;
  }
  async function visto(id) {
    await nucleo().marcarVisto(isNaN(+id) ? id : +id);
    AVS = await X().nubeAlmacen.avisos().catch(() => AVS);
    if (M.personal && M.personal.abierta && M.personal.abierta()) M.personal.render();
  }

  // ---------- clics ----------
  function alClic(e) {
    const b = e.target.closest && e.target.closest('[data-nube]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.nube;
    if (a === 'panel') panel();
    else if (a === 'usar') usarAqui();
    else if (a === 'forzar') forzar(b.dataset.visto);
    else if (a === 'recargar') G.location.reload();
    else if (a === 'entrar') { if (M.web && M.web.entrar) M.web.entrar(); }
    else if (a === 'visto') visto(b.dataset.id);
    else if (a === 'encima' || a === 'descartar') reconciliar(a, false, b);
    else if (a === 'encima-todo') reconciliar('encima', true, b);
    else if (a === 'descartar-todo') reconciliar('descartar', true, b);
  }
  on(D, 'click', alClic, true);

  // ---------- window.MESA.nube (para Claude) ----------
  M.nube = {
    version: VERSION,
    // Enciende la nube en este navegador y recarga: al abrir, primero baja (con el OK de Kevin en la Mesa real).
    activar: async () => {
      if (!sb()) return { error: 'sin proyecto: en una copia de este Mac, pon mesa-web-proyecto (el de pruebas)' };
      if (!sb().usuario()) return { error: 'sin sesión: entra antes con «Web del cliente»' };
      lsS(ACTIVA, '1'); try { if (M.flush) await M.flush(); } catch (e) { /* */ }
      setTimeout(() => G.location.reload(), 50);
      return { ok: true, recargando: true, dispositivo: DISP0() };
    },
    // La apaga: sube lo que pueda, suelta el turno y deja de hacer nada; el diario sigue apuntando (D-250).
    desactivar: async () => {
      clearInterval(pulso); if (N) await N.parar();
      lsS(ACTIVA, null); X().NUBE.activa = false; X().NUBE.alApuntar = null; ESTADO = { fase: 'apagada' }; pintar();
      return { ok: true };
    },
    estado: async () => {
      const e = N ? N.estado() : { fase: 'apagada' };
      return { activa: X().NUBE.activa, dispositivo: X().NUBE.activa ? DISP0() : lsG(DISP_K) || null, nombre: X().NUBE.activa ? nombreDe(DISP0()) : null, modo: X().NUBE.modo, ...e,
        sinSubirLista: (await X().nubeAlmacen.sinSubir().catch(() => [])).map(x => ({ almacen: x.a, clave: x.k, motivo: x.motivo, mensaje: x.mensaje, borrado: x.borrado })), avisos: AVS.length };
    },
    avisosHTML, avisos: () => AVS.slice(), avisosN: () => (X().NUBE.activa ? AVS.length : 0), nombreDe,
    _abrir: abrir, _nucleo: () => N, _panel: panel,
    // solo para la batería: el estado pintado, los avisos releídos y un núcleo con un servidor de mentira (nunca la red)
    _estado: e => { ESTADO = { cola: 0, sinSubir: 0, ...e }; estilar(); pintar(); },
    _releerAvisos: async () => { AVS = await X().nubeAlmacen.avisos().catch(() => []); estilar(); return AVS.length; },
    _con: servidor => { N = null; const c = { rpc: servidor.rpc }; N = G.NubeNucleo.crear({ servidor: c, almacen: X().nubeAlmacen, reloj: { ahora: () => Date.now(), esperar: ms => new Promise(r => setTimeout(r, ms)) }, dispositivo: DISP0(), app: M.version, efectos: { pausar, recargar: () => { N._recargas = (N._recargas || 0) + 1; }, estado: e => { ESTADO = e; pintar(); } } }); X().NUBE.alApuntar = () => N.cambio(); return N; },
    _soltar: () => { clearInterval(pulso); N = null; X().NUBE.alApuntar = null; ESTADO = { fase: 'apagada' }; pintar(); },
    _off: () => { OFF.splice(0).forEach(f => f()); clearInterval(pulso); }
  };
  if (X().NUBE.activa) { sb().alCambiar(u => { if (u && N && ESTADO.fase === 'sin_sesion') N.reintentar(); }); trasArmazon(() => pintar()); }
  function estilar() { if (!D.getElementById('mesa-nube-css')) X().estilo('mesa-nube-css', ESTILO); }
  (G.MESA_CARGA = G.MESA_CARGA || {}).nube = 'ok';
  const ICO = d => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.33' stroke-linecap='round' stroke-linejoin='round'%3E${d.replace(/<path d='/g, "%3Cpath vector-effect='non-scaling-stroke' d='").replace(/'\/>/g, "'/%3E").replace(/<circle /g, "%3Ccircle vector-effect='non-scaling-stroke' ").replace(/<line /g, "%3Cline vector-effect='non-scaling-stroke' ")}%3C/svg%3E")`;
  const I_OK = ICO("<path d='m17 15-5.5 5.5L9 18'/><path d='M5 17.743A7 7 0 1 1 15.71 10h1.79a4.5 4.5 0 0 1 1.5 8.742'/>");
  const I_SUBE = ICO("<path d='M12 13v8'/><path d='M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242'/><path d='m8 17 4-4 4 4'/>");
  const I_OFF = ICO("<path d='m2 2 20 20'/><path d='M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193'/><path d='M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07'/>");
  const I_PAUSA = ICO("<circle cx='12' cy='12' r='10'/><line x1='10' x2='10' y1='15' y2='9'/><line x1='14' x2='14' y1='15' y2='9'/>");
  const I_ALERTA = ICO("<path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/>");
  const I_ESCUDO = ICO("<path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'/><path d='M12 8v4'/><path d='M12 16h.01'/>");
  const ESTILO = `#mesa .nubest{flex:none;align-self:center;display:inline-flex;align-items:center;gap:6px;height:28px;max-width:340px;margin:0 2px 0 4px;padding:0 10px 0 8px;border:0;border-radius:var(--r-pill);background:none;color:var(--mute);font:inherit;font-size:12px;white-space:nowrap;cursor:pointer;transition:background var(--d1) ease-out,color var(--d1) ease-out}
#mesa .nubest[hidden]{display:none}
#mesa .nubest:hover{background:var(--bg-2);color:var(--ink)}#mesa .nubest:active{transform:scale(.97)}
#mesa .nubest::before{content:'';flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:${I_OK} center/contain no-repeat;mask:${I_OK} center/contain no-repeat}
#mesa .nubest[data-k="sube"]::before{-webkit-mask-image:${I_SUBE};mask-image:${I_SUBE}}
#mesa .nubest[data-k="off"]::before{-webkit-mask-image:${I_OFF};mask-image:${I_OFF}}
#mesa .nubest[data-k="pausa"]::before{-webkit-mask-image:${I_PAUSA};mask-image:${I_PAUSA}}
#mesa .nubest:is([data-k="off"],[data-k="pausa"],[data-k="aviso"]){color:var(--ink-2)}
#mesa .nubest[data-k="aviso"]::before{background:var(--chg);-webkit-mask-image:${I_ALERTA};mask-image:${I_ALERTA}}
#mesa .detail[data-dlg="nube"]{z-index:21}
#mesa .nubest .nubest-t{overflow:hidden;text-overflow:ellipsis}#mesa .nubest .nubest-q{color:var(--red);font-weight:600}
@media (max-width:1100px){#mesa .nubest{max-width:200px}#mesa .nubest[data-k="ok"] .nubest-t{display:none}#mesa .nubest[data-k="ok"]{padding:0 8px}}
@media (max-width:760px){#mesa .nubest .nubest-t{display:none}#mesa .nubest{padding:0 8px}}
@media (prefers-reduced-motion:reduce){#mesa .nubest:active{transform:none}}
#mesa .nubedlg .nubeesp{color:var(--mute)}
#mesa .dlg .nubep{margin:0 0 12px;color:var(--mute);font-size:13px;line-height:1.5}#mesa .dlg .nubep b{color:var(--ink);font-weight:600}
#mesa .dlg .nubeh{margin:4px 0 6px;font-size:13px;font-weight:600;display:flex;gap:8px;align-items:center}#mesa .dlg .nubeh span{color:var(--red)}
#mesa .dlg .nubel{list-style:none;margin:0 0 12px;padding:0;max-height:300px;overflow:auto;display:flex;flex-direction:column;border-top:1px solid var(--line)}
#mesa .nubefila{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px}
#mesa .nubefila div{display:flex;flex-direction:column;gap:2px;min-width:0}#mesa .nubefila b{font-weight:600;color:var(--ink);overflow-wrap:anywhere}#mesa .nubefila span{color:var(--mute);font-size:12px}
#mesa .nubeacc{display:flex;gap:12px;flex:none}#mesa .nubeacc .lnk{font-size:12px;min-height:32px}
#mesa .pp-av.nubeav{grid-template-columns:28px 42px 32px minmax(0,1fr) auto;background:var(--chg-soft);cursor:default}
#mesa .pp-av.nubeav .pp-cu{line-height:1.25}#mesa .nubemas{margin:6px 10px 0}
#mesa .pp-av.nubeav .nubevisto{grid-column:5;grid-row:1 / span 2;font-size:12px;min-height:32px;padding:4px 6px}
#mesa .pp-av.nubeav .pp-cu{color:var(--chg);font-weight:600}
#mesa .nubeico::before{content:'';width:16px;height:16px;background:var(--chg);-webkit-mask:${I_ESCUDO} center/contain no-repeat;mask:${I_ESCUDO} center/contain no-repeat}`;
})(typeof window !== 'undefined' ? window : globalThis);
