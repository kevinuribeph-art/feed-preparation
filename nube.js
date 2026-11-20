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
  const VERSION = '1.3';   // 1.3: el iPhone (D-268): mira sin coger la Mesa, la coge sin recargar para cada cambio y la suelta en cuanto sube; «no contesta» al momento; «aparato nuevo». 1.2: la entrada (D-262): «falta el código» (`verificacion`), el avance de la bajada para la pantalla de carga, sin «Entrar y traer tu Mesa»

  // ================= el núcleo =================
  const TOPES = Object.freeze({ cambios: 500, valor: 1950000, lote: 3600000, masivo: 20 });   // como jsonb; los del servidor: 500 / 2 MB / 4 MB
  const TIEMPOS = Object.freeze({ latido: 5000, calma: 3000, pideViva: 60, espera: 20000, primera: 4000, primeraSuya: 15000, actividad: 60000, pedirCada: 3000, fotos: 30000,
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
    // la huella sola (lote 3) o, con el lote 4, {sha256, ruta, trabajo?}: dónde están sus bytes en el almacén `mesa`; null = sus
    // bytes aún no han subido (el registro espera en el diario: «esperando»). Se piden todos (así todos se ponen en cola)
    let falta = false;
    for (const [r, b, ruta] of blobs) {
      const x = await h(b, ruta);
      if (typeof x === 'string') r.sha256 = x;
      else if (x && typeof x === 'object' && /^[0-9a-f]{64}$/.test(String(x.sha256 || ''))) {
        r.sha256 = x.sha256;
        if (x.ruta) r.ruta = sanear(String(x.ruta));
        if (x.trabajo) r.trabajo = { sha256: String(x.trabajo.sha256), tam: +x.trabajo.tam || 0, tipo: sanear(String(x.trabajo.tipo || '')), w: +x.trabajo.w || 0, h: +x.trabajo.h || 0 };
      } else falta = true;
      sep += estr(r);
    }
    if (falta) { const e = new Error('sus archivos aún no han subido'); e.codigo = 'esperando'; throw e; }
    const bytes = bytesDe(JSON.stringify(v));
    return { valor: v, bytes, jsonb: bytes + sep };
  }
  // los «:» y «,» de estructura de un objeto plano (lo que jsonb cuenta de más sobre JSON.stringify)
  function estr(v) {
    if (Array.isArray(v)) return Math.max(v.length - 1, 0) + v.reduce((s, x) => s + estr(x), 0);
    if (v && typeof v === 'object') { const ks = Object.keys(v).filter(k => v[k] !== undefined); return ks.length + Math.max(ks.length - 1, 0) + ks.reduce((s, k) => s + estr(v[k]), 0); }
    return 0;
  }
  // Las referencias con ruta de un valor bajado (para el registro de lo que ya está arriba: `almacen.aplicar({refs})`)
  function refsDe(v, out = [], donde = 'el valor') {
    if (esRef(v)) { if (v.ruta) out.push({ sha256: v.sha256, tam: v.tam, tipo: v.tipo, ruta: v.ruta, donde, ...(v.trabajo ? { trabajo: { ...v.trabajo } } : {}) }); return out; }
    if (Array.isArray(v)) { v.forEach((x, i) => refsDe(x, out, donde + '[' + i + ']')); return out; }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) refsDe(v[k], out, donde + '.' + k);
    return out;
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
    // the iPhone (D-268): it never takes the Mesa by opening it; it looks (downloads in the pause), takes it to write what Kevin
    // touched, uploads without the calm and lets it go; nothing reloads. Off (the Mac), everything as before.
    const MOVIL = !!o.movil, CALMA = MOVIL ? 0 : TIEMPOS.calma;
    let mirandoP = null, tomando = false, retenido = false, soltando = null, vistoA = null, irse = false, irseTras = false, entrando = false, forzando = false;
    // whoever has the Mesa has said nothing for 20 s: «no contesta» at once (Mac and phone); a holder with no beat known waits as before
    const callado = t => !!t && t.latido_hace != null && t.latido_hace >= TIEMPOS.espera / 1000;
    const H0 = o.huella || huellaPorOmision, HC = new Map();   // huellas de esta sesión: a|k|ruta|tamaño|tipo
    // Lote 4: con `o.archivo(a, k, ruta, blob, {esperar})` cada Blob da {sha256, ruta, trabajo?} (sus bytes ya están en el almacén
    // `mesa`) o null (aún no: el registro espera en el diario); con `esperar`, espera a que suban (ceder y subirTodo)
    const ARCH = typeof o.archivo === 'function' ? o.archivo : null;
    const soltarHilo = typeof o.ceder === 'function' ? o.ceder : () => Promise.resolve();   // soltar el hilo de vez en cuando en una pasada larga (la Mesa: setTimeout 0)
    const CON_ARCH = new Set(['files', 'tfotos', 'cfacturas', 'tareas']);
    const huellaDe = (a, k, esperar, valor) => (b, ruta) => {
      if (ARCH) return ARCH(a, k, ruta, b, { esperar: !!esperar, valor });
      const c = a + '\u0001' + k + '\u0001' + ruta + '\u0001' + b.size + '\u0001' + b.type + '\u0001' + (b.lastModified || ''); if (!HC.has(c)) HC.set(c, H0(b).catch(e => { HC.delete(c); throw e; })); return HC.get(c);
    };
    const ILEGIBLE = new Map();   // a|k → intentos fallidos de leer sus fotos (un Blob que IndexedDB ya no puede leer)
    const st = { fase: 'apagada', turno: null, cursor: 0, epoca: null, cola: 0, sinSubir: 0, tiene: null, error: '', alDia: false };
    let conTurno = false, modoLocal = false, parado = false, ocupado = false, cediendo = false, subiendo = null, bajado = false, todoEnMarcha = false;
    // the turn as the phone's Mesa sees it (D-268): every change goes through here, so mesa.js is unlocked exactly while the core holds
    // it (E.tomada) and locked again the moment it doesn't (E.soltada), whatever took it away (lost, no session, no code, another epoch)
    const ponerTurno = v => {
      if (conTurno === v) return; conTurno = v;
      if (!MOVIL) return;
      try { const p = v ? E.tomada && E.tomada() : E.soltada && E.soltada(); if (p && p.catch) p.catch(() => { /* */ }); } catch (e) { /* the face doesn't stop the cloud */ }
    };
    let ultSubida = -Infinity, proximoFotos = 0, esperandoN = 0, traerPend = false;   // fotos: un registro que espera sus archivos no se reintenta cada segundo
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
      ponerTurno(false); modoLocal = false;
      fase(f);
      try { if (E.pausar) await E.pausar(info); } catch (e) { /* la pausa de la Mesa no para la nube */ }
    }
    const vieja = () => pausar({ motivo: 'vieja' }, 'vieja');
    async function perdido(info) {
      if ((st.fase === 'pausada' || st.fase === 'mirando') && !conTurno) return;
      ponerTurno(false); modoLocal = false; retenido = false;
      st.tiene = info && info.dispositivo ? { dispositivo: info.dispositivo } : st.tiene;
      fase(MOVIL ? 'mirando' : 'pausada');
      try { if (E.pausar) await E.pausar({ motivo: 'perdido', dispositivo: info && info.dispositivo }); } catch (e) { /* */ }
      await apartarDiario('turno');   // nada sube encima de quien la tiene ahora: Kevin decide en «quedó sin subir»
      avisar();
    }
    async function trasRechazo(r) {
      const er = (r && r.error) || {}, c = er.codigo;
      if (c === 'turno') return perdido({ dispositivo: er.dispositivo || null });
      if (c === 'app') return vieja();
      if (c === 'permiso') { ponerTurno(false); modoLocal = false; return fase('otra_cuenta'); }
      if (c === 'verificacion') { ponerTurno(false); modoLocal = false; return fase('sin_codigo'); }   // pasaron los 30 días del código de la app (D-262): nada se aparta, espera
      st.error = er.mensaje || (r ? 'respuesta sin «ok»' : 'sin respuesta'); otroIntento(); avisar();
    }
    function sinRed(e) {
      if (sinSesionE(e)) { ponerTurno(false); modoLocal = false; fase('sin_sesion'); return false; }
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
    // op.traer (lote 4, «Entrar y traer tu Mesa»): un aparato que no es el primero. Lo que tenía antes no sube: lo que difiere de
    // arriba y lo que arriba no está se apartan («antes», fuera de la Mesa: no se borra), y se baja todo antes de dibujar. Un
    // Blob de aquí con el mismo tamaño y tipo que la referencia bajada se queda (la Mesa comprueba su huella después).
    async function abrir(op = {}) {
      parado = false; conTurno = false; modoLocal = false; bajado = false; st.alDia = false; st.error = '';
      const traer = !!op.traer; traerPend = traer;
      fase('abriendo');
      if (traer) { await A.olvidar(); await A.apuntarSinVersion(); }   // todo lo de aquí, con su nota: nada se pisa sin apartarlo
      const t0 = R.ahora(), m = await A.meta();
      st.cursor = m.cursor || 0; st.epoca = m.epoca || null; await contarSinSubir(); await contarCola();
      let r;
      try { r = await conTope(llamar('mesa_turno_ver', { dispositivo: D }), TIEMPOS.primera); }
      catch (e) { return abrirLocal(e); }
      if (!r || r.ok !== true) return abrirRechazo(r);
      if (masNueva(r.version_minima, APP)) { await vieja(); return { modo: 'vieja' }; }
      if (traer && !(r.orden > 0)) { fase('apagada'); return { modo: 'vacia' }; }
      st.total = +r.total || 0;
      if (MOVIL && !r.tuyo) return abrirMovil(r, t0, traer);   // the phone never takes it by opening (D-268)
      if (MOVIL) { retenido = false; const x = await entrar(r.turno, 0); return x.hecho ? { modo: 'turno' } : abrirLocal({ message: x.error || 'sin conexión' }); }   // still its own (closed with it): up, and let go   // los registros vivos de arriba (esquema 4): el «de N» de la pantalla de carga (D-262)   // arriba no hay Mesa: se sube desde el primer ordenador (la mudanza)
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
      } else {
        if (traer) {   // un ordenador nuevo (D-262): baja la Mesa aunque otro la tenga abierta; se queda en pausa, sin escribir arriba (D-254)
          try { await bajarTodo(0, t0, otraEpoca, TIEMPOS.primera, true); await trasTraer(); traerPend = false; }
          catch (e) { if (e && e.vieja) { await vieja(); return { modo: 'vieja' }; } return e && e.rechazo ? abrirRechazo(e.rechazo) : abrirLocal(e); }
          return { ...(await abrirPausada(r.tiene)), traido: true };
        }
        return abrirPausada(r.tiene);
      }
      try { await bajarTodo(orden, t0, otraEpoca, r.tuyo ? TIEMPOS.primeraSuya : TIEMPOS.primera, traer); if (traer) { await trasTraer(); traerPend = false; } }   // ya suya (tras «Recarga»): la red contesta; un tope más largo
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
      if (MOVIL) { st.error = (e && e.message) || 'sin conexión'; fase('sin_conexion'); return { modo: 'local', motivo: 'sin_conexion' }; }   // the phone tries again by looking, never reconnecting to take it
      modoLocal = true; st.error = (e && e.message) || 'sin conexión'; otroIntento(); fase('sin_conexion');
      return { modo: 'local', motivo: 'sin_conexion' };
    }
    async function abrirRechazo(r) {
      const c = r && r.error && r.error.codigo;
      if (c === 'app') { await vieja(); return { modo: 'vieja' }; }
      if (c === 'permiso') { fase('otra_cuenta'); return { modo: 'otra_cuenta' }; }
      if (c === 'verificacion') { fase('sin_codigo'); return { modo: 'sin_codigo' }; }   // D-262: abre con lo de aquí, sin escribir arriba
      return abrirLocal({ message: (r && r.error && r.error.mensaje) || 'respuesta sin «ok»' });
    }
    // The phone opens looking: a device that never came down (traer) comes down whole first, without taking it (D-262 without the
    // turn); otherwise the face draws what it has at once and looks behind (lesson 156: the first page's 4 s lie on slow 4G).
    async function abrirMovil(r, t0, traer) {
      st.tiene = r.tiene || null;
      if (traer) {
        try { await bajarTodo(0, t0, false, TIEMPOS.primera, true); await trasTraer(); traerPend = false; }
        catch (e) { if (e && e.vieja) { await vieja(); return { modo: 'vieja' }; } return e && e.rechazo ? abrirRechazo(e.rechazo) : abrirLocal(e); }
        vistoA = R.ahora(); fase('mirando');
        return { modo: 'mirando', tiene: st.tiene, traido: true };
      }
      fase('mirando');
      return { modo: 'mirando', tiene: st.tiene };
    }
    async function abrirPausada(t) {
      st.tiene = t || null; fase('pausada');
      return { modo: 'pausada', tiene: st.tiene };
    }
    async function olvidar() { await A.olvidar(); st.cursor = 0; st.epoca = null; }
    async function bajarTodo(ordenMin, t0, yaOlvidada, tope = TIEMPOS.primera, traer = false, quieto = false) {
      if (!quieto) fase('bajando');   // the phone's look every 45 s doesn't blink «Bajando…» (D-268)
      let desde = st.cursor, primera = true, otraEpoca = !!yaOlvidada, nuevos = 0, sig = null, hechos = 0;
      const avance = () => { try { if (E.avance) E.avance(hechos, st.total || 0); } catch (e) { /* la pantalla de carga no para la bajada */ } };
      avance();
      const pedirPag = (d, lim) => { const q = llamar('mesa_bajar', { desde: d, limite: lim }); q.catch(() => { /* se mira al esperarla */ }); return q; };
      for (;;) {
        // la primera, entera si la red ya contestó deprisa; si no, pequeña, para que llegue antes del tope
        const p = sig || pedirPag(desde, primera && t0 != null && R.ahora() - t0 > 1000 ? 100 : 500);
        sig = null;
        const r = t0 != null && primera && !traer ? await conTope(p, tope - (R.ahora() - t0)) : await p;   // traer: sin tope (no hay Mesa de aquí que abrir)
        if (!r || r.ok !== true) {
          if (r && r.error && r.error.codigo === 'cursor' && !otraEpoca) { await olvidar(); desde = 0; otraEpoca = true; continue; }
          throw { rechazo: r };
        }
        if (st.epoca && r.epoca && r.epoca !== st.epoca && !otraEpoca) { await olvidar(); desde = 0; otraEpoca = true; continue; }
        const fin = !r.mas && (r.hasta >= (ordenMin || 0) || !(r.filas || []).length);
        if (!fin) sig = pedirPag(r.hasta, 500);   // la siguiente se pide mientras esta se escribe (el cursor solo avanza al escribirla)
        nuevos += await aplicarPagina(r.filas || [], r.hasta, r.epoca, traer);
        hechos += (r.filas || []).length; avance();
        st.cursor = r.hasta; st.epoca = r.epoca || st.epoca; desde = r.hasta; primera = false;
        if (fin) break;
      }
      if (otraEpoca) await A.apuntarSinVersion();   // lo de aquí que no está arriba, para subirlo como nuevo
      bajado = true;
      await contarSinSubir();
      return nuevos;
    }
    // Lo bajado gana siempre; lo de aquí que no estaba arriba (con su nota en el diario y otra versión arriba) queda aparte.
    async function aplicarPagina(filas, hasta, epoca, traer) {
      if (A.conoce && filas.some(f => !A.conoce(f.almacen))) throw { vieja: true };   // un almacén que esta Mesa no conoce: la escribió una más nueva
      const L = filas.length ? await A.leerVarios(filas.map(f => [f.almacen, f.clave])) : [];
      const escribir = [], saltar = [], aparte = [], refs = [];
      for (const f of filas) if (!f.borrado) for (const r of refsDe(f.valor)) refs.push({ ...r, a: f.almacen, k: f.clave });   // lo que ya está arriba: no se vuelve a subir
      filas.forEach((f, i) => {
        const { valor: local, pendiente, conocida } = L[i] || {}, ver = { a: f.almacen, k: f.clave, v: f.version, o: f.orden, b: !!f.borrado };
        if (conocida && f.version <= conocida.v) return;   // ya lo tiene (su propia escritura, o una página repetida)
        const mismo = f.borrado ? local === undefined : igual(local, f.valor);
        if (mismo) { saltar.push(ver); return; }
        // lo escribió este mismo navegador y su respuesta se perdió (una versión justo sobre la que sabía): lo de aquí es lo último
        if (pendiente && conocida && f.dispositivo === D && f.version === conocida.v + 1) { saltar.push(ver); return; }
        // una lápida sobre fotos que solo están aquí (hasta el lote 4, arriba no hay bytes): no se borran, se apartan para Kevin
        if (f.borrado && conBlob(local) && !traer) { aparte.push({ a: f.almacen, k: f.clave, valor: local, borrado: false, motivo: 'borrado_arriba', ficha: pendiente ? pendiente.v : null, ultima: f.version, de: f.dispositivo, turnoDe: f.turno }); saltar.push(ver); return; }
        if (pendiente) aparte.push({ a: f.almacen, k: f.clave, valor: local, borrado: local === undefined, motivo: traer ? 'antes' : 'bajada', ficha: pendiente.v, ultima: f.version, de: f.dispositivo, turnoDe: f.turno });
        escribir.push({ ...ver, valor: f.borrado ? null : unir(local, f.valor) });
      });
      await A.aplicar({ escribir, saltar, aparte, cursor: hasta, epoca, refs });
      return escribir.length + aparte.length;
    }
    // Tras bajar todo en un aparato que no es el primero: lo que quedó en el diario es de antes. Lo que arriba está igual se
    // queda (ya está arriba: su nota sobra); lo que arriba no está, o está borrado, se aparta y sale de la Mesa (no se borra).
    async function trasTraer() {
      let despues = null; const fuera = [], quitar = [];
      for (;;) {
        const pag = await A.diario({ despues, n: TOPES.cambios }); if (!pag.length) break;
        const u = pag[pag.length - 1]; despues = u.k == null ? [u.a] : [u.a, u.k];
        for (const e of pag) if (e.k == null) quitar.push({ a: e.a, k: null, v: e.v });
        const ents = pag.filter(e => e.k != null), L = ents.length ? await A.leerVarios(ents.map(e => [e.a, e.k])) : [];
        ents.forEach((e, i) => {
          const x = L[i] || {};
          if (x.valor === undefined) quitar.push({ a: e.a, k: e.k, v: e.v });
          else if (x.conocida && !x.conocida.b) quitar.push({ a: e.a, k: e.k, v: e.v });
          else fuera.push({ a: e.a, k: e.k, v: e.v, motivo: 'antes', quitar: true });
        });
      }
      if (quitar.length) await A.confirmar({ versiones: [], quitar });
      for (let i = 0; i < fuera.length; i += 200) await A.apartar(fuera.slice(i, i + 200));
      await contarSinSubir(); await contarCola();
      return { apartados: fuera.length };
    }

    // ---------- el pulso: latido, subir, actividad ----------
    async function tic() {
      if (parado || ocupado) return;
      ocupado = true;
      try {
        if (modoLocal || st.fase === 'sin_sesion' || st.fase === 'sin_codigo' || st.fase === 'recargar' || st.fase === 'pausada' || st.fase === 'mirando') {   // sin turno: la cola a la vista, también
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
        if (!todoEnMarcha && (cola > 0 || enVuelo) && R.ahora() - ultCambio >= CALMA && R.ahora() >= proximo && (R.ahora() >= proximoFotos || ultCambio > ultSubida)) await subir();
        // the phone lets it go once all is up and it isn't applying anything (D-268); another device can take it at once
        if (MOVIL && conTurno && !retenido && !soltando && !subiendo && !enVuelo && !cediendo && !tomando && st.fase !== 'sin_conexion' && !(await A.contarDiario()) && !retenido) { await soltar({ auto: true }); return; }
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
      if (traerPend) { modoLocal = false; fase('recargar'); return; }   // traer la Mesa a medias: primero bajarla entera, al recargar
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
        if (E.antesDeSoltar) { try { await E.antesDeSoltar(); } catch (e) { /* its write is in the journal or not at all */ } }   // the phone's write in flight first (R7)
        await pausar({ motivo: 'cede', dispositivo: pide.dispositivo }, 'subiendo'); conTurno = true;
        // mientras sube (las fotos pueden tardar), sigue latiendo: quien la pide ve que contesta y cuánto le queda
        (async () => { while (cediendo && !parado) { await R.esperar(TIEMPOS.latido); if (!cediendo || parado) break; try { await llamar('mesa_turno_latido', { dispositivo: D, turno: st.turno, app: APP, cola: await A.contarDiario() }); } catch (e) { /* sin red: ya reintenta la subida */ } } })();
        let antes = -1, quietas = 0;
        for (let vuelta = 0; !parado; vuelta++) {
          const r = await subir({ todo: true });
          if (r.parar && !r.sinRed) return;   // la perdió entretanto (la forzaron) o la app es vieja
          const n = await A.contarDiario();
          if (!n) break;
          if (r.sinRed || r.esperando) {   // sin red, o fotos que no pudieron subir: otra vez; tras 8 vueltas sin avance, lo que queda va aparte
            quietas = r.esperando && !r.sinRed && n === antes ? quietas + 1 : 0; antes = n;   // sin red se espera siempre (como antes)
            if (quietas >= 8) { await apartarDiario('cede'); break; }
            await R.esperar(TIEMPOS.reintento[Math.min(vuelta, TIEMPOS.reintento.length - 1)]); continue;
          }
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
        ponerTurno(false); retenido = false; st.tiene = { dispositivo: pide.dispositivo }; fase(MOVIL ? 'mirando' : 'pausada');
      } finally { cediendo = false; }
    }

    // ---------- subir ----------
    function subir(op = {}) {
      if (!conTurno) return Promise.resolve({ subidos: 0, aparte: 0, parar: true });
      if (subiendo) return subiendo;
      subiendo = subirYa(op).finally(() => { subiendo = null; });
      return subiendo;
    }
    async function subirYa(op = {}) {
      fase('subiendo'); ultSubida = R.ahora(); esperandoN = 0;
      const esperar = !!op.todo, tot = { subidos: 0, aparte: 0 };
      const suma = r => { tot.subidos += r.subidos || 0; tot.aparte += r.aparte || 0; return r; };
      if (enVuelo) { const r = suma(await mandar(enVuelo.lote, enVuelo.resc, enVuelo.args)); if (r.parar) return { ...tot, ...r }; }
      let despues = null; const marcas = [];
      for (;;) {
        const pag = await A.diario({ despues, n: TOPES.cambios }); if (!pag.length) break;
        const u = pag[pag.length - 1]; despues = u.k == null ? [u.a] : [u.a, u.k];
        marcas.push(...pag.filter(e => e.k == null));
        const ents0 = pag.filter(e => e.k != null); if (!ents0.length) continue;
        // lo que no lleva archivos sube antes: un caption no espera a las huellas de las fotos de su misma página
        for (const ents of [ents0.filter(e => !CON_ARCH.has(e.a)), ents0.filter(e => CON_ARCH.has(e.a))]) {
          if (!ents.length) continue;
          const L = await A.leerVarios(ents.map(e => [e.a, e.k])), lista = [], fuera = [];
          for (let i = 0; i < ents.length; i++) {
            if (i && i % 50 === 0) await soltarHilo();
            const e = ents[i], { valor, conocida } = L[i] || {};
            const x = await cambioDe(e.a, e.k, valor, conocida, e.v, fuera, esperar); if (x) lista.push(x);
          }
          if (fuera.length) { await A.apartar(fuera); tot.aparte += fuera.length; }
          for (const lote of partir(lista)) { const r = suma(await mandar(lote, false)); if (r.parar) return { ...tot, ...r }; }
        }
      }
      if (st.alDia) for (const m of marcas) { const r = suma(await reescanear(m)); if (r.parar) return { ...tot, ...r }; }
      await contarSinSubir();
      if (esperandoN) proximoFotos = R.ahora() + TIEMPOS.fotos;   // lo que espera sus fotos, otra vez cuando suba una (archivosListos) o en 30 s
      st.cola = await A.contarDiario(); st.esperando = esperandoN; fase('guardado');
      return { ...tot, esperando: esperandoN };
    }
    async function cambioDe(a, k, valor, conocida, ficha, fuera, esperar) {
      let v = null, med = { jsonb: 4 };
      if (valor !== undefined) {
        try { const s = await serializar(valor, huellaDe(a, k, esperar, valor)); v = s.valor; med = s; }
        catch (x) {
          if (x && x.codigo === 'forma') { fuera.push({ a, k, v: ficha, motivo: 'forma', mensaje: String(x.message || x) }); return null; }
          if (x && (x.codigo === 'esperando' || x.codigo === 'red')) { esperandoN++; return null; }   // sus fotos aún suben (o sin red): se queda en el diario
          if (x && x.codigo === 'archivo') { fuera.push({ a, k, v: ficha, motivo: 'archivo', mensaje: String(x.message || x) }); return null; }   // un archivo que el almacén no admite
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
      if (r.epoca && st.epoca && r.epoca !== st.epoca) { ponerTurno(false); fase(MOVIL ? 'mirando' : 'recargar'); return { parar: true }; }   // the phone: the next look comes down again from the start   // se restauró una copia del servidor
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
      return { subidos: quitar.length, escritos: versiones.length, aparte: aparte.length };
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
    async function usarAqui(op = {}) {
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
        if (R.ahora() - t0 >= TIEMPOS.espera || (callado(r.tiene) && !op.esperar)) {   // «Esperar más» waits the 20 s
          const t = r.tiene || {};
          return { espera: { dispositivo: t.dispositivo || null, desde: t.desde || null, latido: t.latido || null, latido_hace: t.latido_hace == null ? null : t.latido_hace, cola: t.cola || 0, turno: r.turno } };
        }
        await R.esperar(TIEMPOS.pedirCada);
        if (parado) return { error: 'parada' };
      }
    }
    async function forzar(visto) {
      if (!MOVIL) return forzarYa(visto);
      if (forzando) return { error: 'ocupado' };
      forzando = true;   // a look that starts meanwhile waits: it never enters nor lets go (review 2, point 3)
      try { if (mirandoP) await mirandoP.catch(() => null); retenido = true; return await forzarYa(visto); }   // held for the face
      finally { forzando = false; }
    }
    async function forzarYa(visto) {
      let c;
      try { c = await llamar('mesa_turno_reclamar', { dispositivo: D, visto, app: APP, forzar: true }); }
      catch (e) { return { error: sinSesionE(e) ? 'sin_sesion' : 'sin_conexion' }; }
      if (c && c.ok) { if (MOVIL) { await A.ponerMeta({ turno: c.turno }); const x = await entrar(c.turno, c.orden || 0); if (!x.hecho) retenido = false; return x; } if (E.recargar) E.recargar(); return { hecho: true }; }
      if (MOVIL) retenido = false;
      if (c && c.error && c.error.codigo === 'turno_cambiado') return { otraVez: true };
      await trasRechazo(c); return { error: (c && c.error && c.error.codigo) || 'sin respuesta' };
    }

    // ---------- the phone (D-268): look, take, let go ----------
    // mirar(): without the Mesa, what changed comes down (never while it has it). The journal of a phone that wrote and lost the
    // Mesa before uploading goes to «quedó sin subir» (Kevin decides, D-255); if the Mesa is still its own, it goes up.
    function mirar() {
      if (!MOVIL || parado) return Promise.resolve({ nuevos: 0 });
      if (conTurno || tomando || cediendo || soltando || entrando || forzando) return Promise.resolve({ nuevos: 0, ocupado: true });
      if (mirandoP) return mirandoP;
      mirandoP = (async () => {
        let r;
        try { r = await llamar('mesa_turno_ver', { dispositivo: D }); }
        catch (e) { sinRed(e); return { error: sinSesionE(e) ? 'sin_sesion' : 'sin_conexion' }; }
        if (!r || r.ok !== true) { await abrirRechazo(r); return { error: (r && r.error && r.error.codigo) || 'sin respuesta' }; }
        if (masNueva(r.version_minima, APP)) { await vieja(); return { error: 'app' }; }
        if (conTurno || tomando || soltando || cediendo || entrando || forzando || parado) return { nuevos: 0, ocupado: true };   // the turn changed meanwhile: nothing of a look
        st.total = +r.total || st.total || 0; reint = 0; proximo = 0; st.error = '';
        if (r.tuyo) { retenido = false; return entrar(r.turno, 0).then(x => ({ nuevos: 0, ...x, tuyo: true })); }   // its own (closed or frozen with it): up, and let go
        if (traerPend) {   // a first coming down that stopped half way: whole, as at opening (nothing of here goes up)
          try { const n0 = await bajarTodo(0, null, false, undefined, true, true); await trasTraer(); traerPend = false; vistoA = R.ahora(); fase('mirando'); avisar(); if (E.releido) { try { await E.releido(n0); } catch (e) { /* */ } } return { nuevos: n0, traido: true }; }
          catch (e) { sinRed(e); return { error: 'sin_conexion' }; }
        }
        if (await A.contarDiario()) await apartarDiario('turno');
        st.tiene = r.tiene || null;
        let n = 0;
        try { n = await bajarTodo(0, null, false, undefined, false, true); }
        catch (e) { if (e && e.vieja) { await vieja(); return { error: 'app' }; } if (e && e.rechazo) { await abrirRechazo(e.rechazo); return { error: 'rechazo' }; } sinRed(e); return { error: 'sin_conexion' }; }
        if (conTurno) return { nuevos: n };
        vistoA = R.ahora(); fase('mirando'); avisar();
        if (n && E.releido) { try { await E.releido(n); } catch (e) { /* the face draws what there is */ } }
        return { nuevos: n, tiene: st.tiene };
      })().finally(() => { mirandoP = null; });
      return mirandoP;
    }
    // The Mesa is its own: what changed comes down first (so what Kevin saw is compared with the latest), nothing reloads.
    async function entrar(turno, orden) {
      entrando = true;
      try { return await entrarYa(turno, orden); } finally { entrando = false; }
    }
    async function entrarYa(turno, orden) {
      st.turno = turno; await A.ponerMeta({ turno });   // known at once: a phone closed now knows it is its own when it comes back
      let n = 0;
      try { n = await bajarTodo(orden, null, false, undefined, false, true); }
      catch (e) {
        try { await llamar('mesa_turno_soltar', { dispositivo: D, turno }); } catch (x) { /* the next look finds it its own and lets it go */ }
        if (e && e.vieja) { await vieja(); return { error: 'app' }; }
        fase('mirando'); return { error: e && e.rechazo ? (e.rechazo.error && e.rechazo.error.codigo) || 'rechazo' : 'sin_conexion' };
      }
      st.alDia = true; st.tiene = null; reint = 0; proximo = 0; st.error = ''; ultLatido = R.ahora(); colaLatida = -1; vistoA = R.ahora();
      ponerTurno(true);
      fase('guardado');
      if (n && E.releido) { try { await E.releido(n); } catch (e) { /* the face draws what there is */ } }   // what came down, on the screen
      return { hecho: true };
    }
    // tomar(): to write what Kevin touched. Free: at once. Someone else's: it asks every 3 s while the other uploads and lets go;
    // {espera} after 20 s, or at once if the other has said nothing for 20 s. retenido until the face says so (retener(false)).
    async function tomar(op = {}) {
      if (!MOVIL) return { error: 'solo en el móvil' };
      if (tomando) return { error: 'ocupado' };
      retenido = true;   // a release of the pulse in flight stops here (it would let go and take it again)
      if (soltando) await soltando.catch(() => null);   // letting it go: done first, then asked again (never «done» over a release)
      while ((cediendo || entrando || forzando) && !parado) await R.esperar(250);
      if (mirandoP) await mirandoP.catch(() => null);
      if (conTurno) { retenido = true; try { const p = E.tomada && E.tomada(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* */ } return { hecho: true }; }   // its own: the Mesa unlocked (after «Subir encima», for instance)
      if (tomando) return { error: 'ocupado' };
      tomando = true; retenido = true;
      try {
        const t0 = R.ahora();
        for (;;) {
          let r;
          try { r = await llamar('mesa_turno_pedir', { dispositivo: D, app: APP }); }
          catch (e) { retenido = false; return { error: sinSesionE(e) ? 'sin_sesion' : 'sin_conexion' }; }
          if (!r || r.ok !== true) { retenido = false; await abrirRechazo(r); return { error: (r && r.error && r.error.codigo) || 'sin respuesta' }; }
          if (masNueva(r.version_minima, APP)) { retenido = false; await vieja(); return { error: 'app' }; }
          const dentro = async (t, o) => { const x = await entrar(t, o); if (!x.hecho) retenido = false; return x; };
          if (r.tuyo) return await dentro(r.turno, 0);
          if (r.libre) {
            let c;
            try { c = await llamar('mesa_turno_reclamar', { dispositivo: D, visto: r.turno, app: APP, forzar: false }); }
            catch (e) { retenido = false; return { error: 'sin_conexion' }; }
            if (c && c.ok) { await A.ponerMeta({ turno: c.turno }); return await dentro(c.turno, c.orden || 0); }
            if (c && c.error && c.error.codigo === 'turno') continue;   // another came first: keep asking
            retenido = false; await abrirRechazo(c); return { error: (c && c.error && c.error.codigo) || 'sin respuesta' };
          }
          st.tiene = r.tiene || null; avisar();
          if (R.ahora() - t0 >= TIEMPOS.espera || (callado(r.tiene) && !op.esperar)) {
            const t = r.tiene || {}; retenido = false;
            return { espera: { dispositivo: t.dispositivo || null, desde: t.desde || null, latido: t.latido || null, latido_hace: t.latido_hace == null ? null : t.latido_hace, cola: t.cola || 0, turno: r.turno } };
          }
          await R.esperar(TIEMPOS.pedirCada);
          if (parado) { retenido = false; return { error: 'parada' }; }
        }
      } finally { tomando = false; if (irse) { irse = false; if (conTurno) { if (retenido) irseTras = true; else soltar().catch(() => {}); } } }   // gone to the background while taking it: once the face lets it go
    }
    // going to the background: with the Mesa, up and let go; while taking it, as soon as it is taken
    function pedirIrse() { if (conTurno) return soltar(); if (tomando) irse = true; return Promise.resolve({ hecho: true }); }
    // soltar(): what is in the journal goes up (no calm) and the Mesa is let go; the operation in flight writes first (R7).
    // Without network it waits with the Mesa (nothing aside, lesson 152): the pulse tries again.
    // op.auto (the pulse): it stops if the face takes it again meanwhile (retenido), and never clears that
    function soltar(op = {}) {
      const auto = !!op.auto;
      if (parado) return Promise.resolve({ error: 'parada' });   // a sleeping core never lets go a Mesa another tab took (review 2, point 7)
      if (!conTurno) { if (!auto) retenido = false; return Promise.resolve({ hecho: true }); }
      if (soltando) return soltando;
      soltando = (async () => {
        if (!auto) retenido = false;
        const otraVez = () => auto && retenido;
        if (E.antesDeSoltar) { try { await E.antesDeSoltar(); } catch (e) { /* */ } }
        if (otraVez()) return { cancelado: true };
        const subirCola = async corta => {   // the journal up; null once empty, or what to answer
          let antes = -1;
          for (let vuelta = 0; conTurno && !parado; vuelta++) {
            const r = await subir({ todo: true });
            if (r.parar && !r.sinRed) return { error: 'perdida' };
            const n = await A.contarDiario(); if (!n) return null;
            if (r.sinRed || r.esperando) return { error: r.sinRed ? 'sin_conexion' : 'esperando', cola: n };
            if (n === antes) { await apartarDiario('cede'); return null; }
            antes = n;
            if (!corta && otraVez()) return { cancelado: true };
          }
          return null;
        };
        let x = await subirCola(false); if (x) return x;
        if (!conTurno) return { hecho: true };
        if (otraVez()) return { cancelado: true };
        // the last step (review 2, point 2): the phone's Mesa locked first, the face's write in flight waited and the journal
        // counted again — a write that slipped in after the upload goes up before the turn is let go, never aside. From here it
        // isn't cancelled: the face that takes it again waits for this release (or unlocks it, if it stops before letting go)
        if (MOVIL && E.congelar) {
          try { await E.congelar(); } catch (e) { /* */ }
          if (E.antesDeSoltar) { try { await E.antesDeSoltar(); } catch (e) { /* */ } }
          if (await A.contarDiario()) { x = await subirCola(true); if (x) return x; }
          if (!conTurno) return { hecho: true };
        }
        let r;
        try { r = await llamar('mesa_turno_soltar', { dispositivo: D, turno: st.turno }); }
        catch (e) { return { error: 'sin_conexion' }; }
        if (!(r && (r.ok || (r.error && r.error.codigo === 'turno')))) return { error: (r && r.error && r.error.codigo) || 'sin respuesta' };
        ponerTurno(false); fase('mirando');
        return { hecho: true };
      })().finally(() => { soltando = null; });
      return soltando;
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

    // ---------- la mudanza (lote 5): subirlo todo y comprobarlo ----------
    const ALMS0 = ['files', 'boards', 'clients', 'bandejas', 'ubicaciones', 'tareas', 'tfotos', 'cobros', 'cfacturas', 'meses'];
    const almacenes = async () => (A.almacenes ? await A.almacenes() : ALMS0);
    // Recorre todos los almacenes (no solo el diario) y sube cada registro que el servidor no tiene con su versión: lo ya subido
    // con esa versión y sin cambiar se salta, así que se puede cortar, retomar y repetir sin duplicar. Las fotos esperan a subir
    // sus archivos (las copias de 2560 px se hacen al vuelo). Mientras corre, la subida del diario espera; lo que cubre sale del
    // diario (por su ficha: lo que cambió entretanto se queda).
    async function subirTodo(op = {}) {
      if (!conTurno || !st.alDia) return { error: 'sin turno: abre la Mesa con la nube antes (y que haya bajado entera)' };
      if (todoEnMarcha) return { error: 'ya está subiendo todo' };
      todoEnMarcha = true;
      try {
        while (subiendo) { try { await subiendo; } catch (e) { /* */ } }
        const p = subirTodoYa(op); subiendo = p;
        return await p;
      } finally { todoEnMarcha = false; subiendo = null; }
    }
    async function subirTodoYa(op) {
      fase('subiendo');
      const t0 = R.ahora(), TROZO = op.trozo || 40, tot = { total: 0, hechos: 0, subidos: 0, saltados: 0, aparte: 0, pendientes: 0 };
      const listas = [];
      for (const a of await almacenes()) { const ks = await A.claves(a); listas.push([a, ks]); tot.total += ks.length; }
      const avisa = () => { tot.segundos = Math.round((R.ahora() - t0) / 1000); try { if (op.progreso) op.progreso({ ...tot }); } catch (e) { /* */ } };
      avisa();
      const enviar = async lote => {   // lote null: el que quedó en vuelo
        for (let vuelta = 0; ; vuelta++) {
          const r = (vuelta || !lote) && enVuelo ? await mandar(enVuelo.lote, enVuelo.resc, enVuelo.args) : lote ? await mandar(lote, false) : { escritos: 0 };
          if (!r.parar) { tot.subidos += r.escritos || 0; tot.aparte += r.aparte || 0; return true; }
          if (!r.sinRed || vuelta >= 6 || parado) return false;
          await R.esperar(TIEMPOS.reintento[Math.min(vuelta, TIEMPOS.reintento.length - 1)]);
          if (!enVuelo) return true;   // la respuesta llegó en otra vuelta
        }
      };
      if (enVuelo && !(await enviar(null))) { avisa(); return { ...tot, cortado: true, sinRed: st.fase === 'sin_conexion' }; }   // el lote que quedó en vuelo de antes, primero
      for (const [a, ks] of listas) {
        for (let i = 0; i < ks.length; i += TROZO) {
          if (parado || !conTurno) return { ...tot, cortado: true };
          const trozo = ks.slice(i, i + TROZO), L = await A.leerVarios(trozo.map(k => [a, k])), cand = [], fuera = [];
          trozo.forEach((k, j) => {
            const x = L[j] || {};
            if (x.valor === undefined) { tot.hechos++; return; }   // ya no está (lo quitó una limpieza entretanto)
            if (x.conocida && !x.conocida.b && !x.pendiente) { tot.saltados++; tot.hechos++; return; }   // arriba con esta versión
            if (x.conocida && x.conocida.b && !x.pendiente) { tot.saltados++; tot.hechos++; return; }   // borrado arriba y aquí sin cambiar (apartado, «borrado_arriba»): no se resucita
            cand.push([k, x]);
          });
          const antes = esperandoN;
          const hechos = await Promise.all(cand.map(([k, x]) => cambioDe(a, k, x.valor, x.conocida, x.pendiente ? x.pendiente.v : '', fuera, true)));
          tot.pendientes += esperandoN - antes; esperandoN = antes;
          if (fuera.length) { await A.apartar(fuera); tot.aparte += fuera.length; }
          for (const lote of partir(hechos.filter(Boolean))) if (!(await enviar(lote))) { st.cola = await A.contarDiario(); fase(st.fase === 'sin_conexion' ? 'sin_conexion' : 'guardado'); avisa(); return { ...tot, cortado: true, sinRed: st.fase === 'sin_conexion' }; }
          tot.hechos += cand.length; avisa();
        }
      }
      await contarSinSubir(); st.cola = await A.contarDiario(); fase('guardado'); avisa();
      return { ...tot, cola: st.cola, sinSubir: st.sinSubir };
    }
    // Compara cada registro de aquí con el servidor (todo bajado por páginas, sin escribir nada aquí) y cada referencia con los
    // archivos del almacén (`op.rutas()` → Set de rutas). Solo un resumen: verde si cada registro de aquí está arriba con su
    // versión y su valor, y cada archivo con su ruta. Lo que arriba tiene de más se cuenta sin fallar (las limpiezas de aquí).
    async function comprobar(op = {}) {
      const t0 = R.ahora(), arriba = new Map(), K = (a, k) => a + '\u0001' + k;
      let desde = 0;
      for (;;) {
        let r;
        try { r = await llamar('mesa_bajar', { desde, limite: 500 }); } catch (e) { return { verde: false, error: (e && e.message) || 'sin conexión' }; }
        if (!r || r.ok !== true) return { verde: false, error: (r && r.error && (r.error.mensaje || r.error.codigo)) || 'respuesta sin «ok»' };
        for (const f of r.filas || []) arriba.set(K(f.almacen, f.clave), f);
        desde = r.hasta; if (!r.mas) break;
      }
      let rutas = null;
      if (op.rutas) { try { rutas = await op.rutas(); } catch (e) { return { verde: false, error: 'no se pudo listar el almacén: ' + ((e && e.message) || e) }; } }
      const out = { registros: { aqui: 0, arriba: 0, iguales: 0 }, faltan: 0, distintos: 0, archivos: { referencias: 0, faltan: 0 }, deMas: 0, muestra: { faltan: [], distintos: [], archivos: [], deMas: [] } };
      const muestra = (l, x) => { if (l.length < 10) l.push(x); };
      const vistos = new Set();
      for (const a of await almacenes()) {
        const ks = await A.claves(a);
        for (let i = 0; i < ks.length; i += 200) {
          const trozo = ks.slice(i, i + 200), L = await A.leerVarios(trozo.map(k => [a, k]));
          trozo.forEach((k, j) => {
            const x = L[j] || {}; if (x.valor === undefined) return;
            out.registros.aqui++;
            const f = arriba.get(K(a, k)); vistos.add(K(a, k));
            if (!f || f.borrado) { out.faltan++; muestra(out.muestra.faltan, a + '/' + k); return; }
            if (!igual(x.valor, f.valor)) { out.distintos++; muestra(out.muestra.distintos, a + '/' + k + ' (valor)'); }
            else if (!x.conocida || x.conocida.v !== f.version) { out.distintos++; muestra(out.muestra.distintos, a + '/' + k + ' (versión)'); }
            else out.registros.iguales++;
          });
        }
      }
      for (const [key, f] of arriba) {
        if (f.borrado) continue;
        out.registros.arriba++;
        if (!vistos.has(key)) { out.deMas++; muestra(out.muestra.deMas, f.almacen + '/' + f.clave); }
        for (const ref of refsDe(f.valor, []).concat(sinRuta(f.valor))) {
          out.archivos.referencias++;
          if (!ref.ruta) { out.archivos.faltan++; muestra(out.muestra.archivos, f.almacen + '/' + f.clave + ' (sin ruta)'); }
          else if (rutas && !rutas.has(ref.ruta)) { out.archivos.faltan++; muestra(out.muestra.archivos, ref.ruta); }
        }
      }
      out.cola = await A.contarDiario(); await contarSinSubir(); out.sinSubir = st.sinSubir;
      out.verde = !out.faltan && !out.distintos && !out.archivos.faltan;
      out.segundos = Math.round((R.ahora() - t0) / 1000);
      return out;
    }
    const sinRuta = (v, out = []) => { if (esRef(v)) { if (!v.ruta) out.push({ sha256: v.sha256 }); return out; } if (v && typeof v === 'object') for (const k of Object.keys(v)) sinRuta(v[k], out); return out; };
    // Un registro tal como está arriba (para una huella que no cuadra tras traer la Mesa): {valor, version, orden, borrado} o null
    async function traerFila(a, k) {
      const [L] = await A.leerVarios([[a, k]]), c = L && L.conocida; if (!c || !c.o) return null;
      let r; try { r = await llamar('mesa_bajar', { desde: Math.max(0, c.o - 1), limite: 1 }); } catch (e) { return null; }
      const f = r && r.ok && (r.filas || [])[0];
      return f && f.almacen === a && String(f.clave) === String(k) ? f : null;
    }

    function estado() { return { movil: MOVIL, vistoA, retenido, fase: st.fase, turno: st.turno, cursor: st.cursor, epoca: st.epoca, cola: st.cola, sinSubir: st.sinSubir, tiene: st.tiene, error: st.error, alDia: st.alDia, avisos: AV.length, esperando: st.esperando || 0, todo: todoEnMarcha }; }
    return {
      abrir, tic, subir, usarAqui, forzar, subirEncima, descartar, estado, subirTodo, comprobar, traerFila,
      mirar, tomar, soltar, pedirIrse, retener: v => { retenido = !!v; if (!v && irseTras) { irseTras = false; if (conTurno) soltar().catch(() => {}); } },   // the phone (D-268); gone to the background while taking it: let go once the face is done
      dormir: () => { parado = true; },   // another tab of this phone took over: nothing more from this one (never releases its Mesa)
      // una foto acabó de subir: lo que la esperaba, en la siguiente vuelta
      archivosListos: () => { proximoFotos = Math.min(proximoFotos, ultSubida + 5000); },   // como mucho una pasada adelantada cada 5 s
      cambio: () => { ultCambio = R.ahora(); },
      avisos: async () => { AV = await A.avisos(); return AV; },
      marcarVisto: async id => { await A.quitarAviso(id); AV = await A.avisos(); avisar(); },
      sinSubir: () => A.sinSubir(),
      leerActividad,
      conTurno: () => conTurno,
      // la sesión volvió (Kevin entró otra vez): como al volver la red, sin reclamar a mitad
      reintentar: () => { if (!conTurno && (st.fase === 'sin_sesion' || st.fase === 'sin_codigo' || st.fase === 'sin_conexion')) { proximo = 0; reint = 0; if (MOVIL) { fase('mirando'); return; } modoLocal = true; } },   // the phone tries again by looking (D-268)
      parar: async () => {
        if (conTurno) { try { await subir({ todo: true }); } catch (e) { /* */ } try { await llamar('mesa_turno_soltar', { dispositivo: D, turno: st.turno }); } catch (e) { /* */ } }
        parado = true; conTurno = false; modoLocal = false; fase('apagada');
      }
    };
  }

  G.NubeNucleo = { version: VERSION, crear, serializar, unir, igual, esRef, esBlob, esAviso, refsDe, TOPES, TIEMPOS };
  if (!G.MESA || !G.document) return;
  // ================= el pegamento (la Mesa) =================
  const M = G.MESA, X = () => M._in, D = G.document;
  // the Mesa on the iPhone (movil.html, <html data-movil>, D-268): it looks, takes the Mesa to write and lets it go; no shell
  const MOVIL_G = !!(D.documentElement && D.documentElement.hasAttribute('data-movil'));
  if (M.nube && M.nube._off) { try { M.nube._off(); } catch (e) { /* una versión anterior ya no está */ } }
  const lsG = k => { try { return G.localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsS = (k, v) => { try { if (v == null) G.localStorage.removeItem(k); else G.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ACTIVA = 'mesa-nube', DISP_K = 'mesa-nube-dispositivo', TRAER = 'mesa-nube-traer', VERIF = 'mesa-nube-verificar';
  const OFF = [], on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };

  // ---------- este navegador: un dispositivo ----------
  // Un id por perfil de navegador (localStorage, por origen), legible: «mac-claude-9f86d0818…» → «Mac · app Claude (9f86)».
  const SO = { mac: 'Mac', win: 'Windows', ios: 'iPhone o iPad', iphone: 'iPhone', android: 'Android', linux: 'Linux', eq: 'Ordenador' };
  const NAV = { claude: 'app Claude', chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge', nav: 'navegador', inicio: 'pantalla de inicio' };
  // the iPhone's own (D-268): «iPhone · pantalla de inicio» opened from its icon, «iPhone · Safari» in Safari (each keeps its own data)
  const deInicio = () => { try { return G.navigator.standalone === true || !!(G.matchMedia && G.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; } };
  function dispositivo() {
    let d = lsG(DISP_K);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(d)) {
      const ua = (G.navigator && G.navigator.userAgent) || '';
      const iph = /iPhone|iPod/.test(ua) || (MOVIL_G && !/iPad|Macintosh|Windows|Android|Linux/.test(ua));
      const so = iph ? 'iphone' : /iPad/.test(ua) ? 'ios' : /Mac/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'win' : /Android/.test(ua) ? 'android' : /Linux/.test(ua) ? 'linux' : 'eq';
      const nav = iph ? (deInicio() ? 'inicio' : 'safari') : /Claude\//.test(ua) ? 'claude' : /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'nav';
      d = `${so}-${nav}-${hex(G.crypto.getRandomValues(new Uint8Array(8)))}`; lsS(DISP_K, d);
    }
    return d;
  }
  let DISP_ = null; const DISP0 = () => DISP_ || (DISP_ = dispositivo());
  function nombreDe(id) {
    const otro = MOVIL_G ? 'otro aparato' : 'otro ordenador';   // the phone never says «ordenador» by hand (D-268)
    if (!id) return otro;
    const yo = lsG(DISP_K) || DISP_;
    const m = /^([a-z]+)-([a-z]+)-([0-9a-f]{4})/.exec(String(id));
    if (id === yo) return m && (m[1] === 'mac' || m[1] === 'iphone') ? `Este ${SO[m[1]]} · ${NAV[m[2]] || m[2]}` : `Este ${MOVIL_G ? 'aparato' : 'ordenador'}${m ? ' · ' + (NAV[m[2]] || m[2]) : ''}`;
    return m ? `${SO[m[1]] || (MOVIL_G ? 'Aparato' : 'Ordenador')} · ${NAV[m[2]] || m[2]} (${m[3]})` : `${otro} (${String(id).slice(0, 8)})`;
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
  // the phone's effects (D-268): its pause is its lock (M._in.movil.turno), nothing reloads (what came down is read again), and the
  // face hears each state; the write in flight goes first (the core's queue)
  const CARA = new Set();
  const aCara = (t, d) => { for (const f of CARA) { try { f(t, d); } catch (e) { /* a face that fails doesn't stop the cloud */ } } };
  const efectosMovil = base => ({ ...base,
    pausar: async info => { X().movil.turno(false); if (info && info.motivo === 'vieja') { const f = X().movil.alVersion; if (f) f(); } aCara('pausa', info || {}); },
    congelar: async () => { X().movil.turno(false); },
    recargar: () => { X().movil.releer().then(() => aCara('releido', {}), () => {}); },
    tomada: async () => { X().movil.turno(true); aCara('tomada', {}); },
    soltada: async () => { X().movil.turno(false); aCara('soltada', {}); },
    releido: async n => { await X().movil.releer(); aCara('releido', { n }); },
    antesDeSoltar: () => X().movil.esperar(),
    estado: e => { ESTADO = e; aCara('estado', e); if ((e.avisos || 0) !== AVS.length && N) N.avisos().then(l => { AVS = l; aCara('avisos', { n: l.length }); }, () => {}); } });   // no desk chip nor its code dialog: the face draws both
  function nucleo() {
    if (N) return N;
    const c = sb();
    N = G.NubeNucleo.crear({
      servidor: { rpc: (fn, args) => c.rpc(fn, args) },
      almacen: X().nubeAlmacen,
      reloj: { ahora: () => Date.now(), esperar: ms => new Promise(r => setTimeout(r, ms)) },
      dispositivo: DISP0(), app: M.version, archivo: archivoHook, ceder: () => new Promise(r => setTimeout(r, 0)), movil: MOVIL_G,
      efectos: (MOVIL_G ? efectosMovil : x => x)({ pausar, congelar: () => X().pausaNube(null), recargar: () => { try { G.location.reload(); } catch (e) { /* */ } }, estado: e => { const antes = ESTADO && ESTADO.fase; ESTADO = e; pintar(); if (e.fase === 'sin_codigo' && antes !== 'sin_codigo' && M.entrada) M.entrada.pedirCodigo(); },   // solo al pasar a «falta el código» («Más tarde» se respeta)
        avance: (h, t) => { if (M.entrada && M.entrada.avance) M.entrada.avance(h, t); } })
    });
    X().NUBE.alApuntar = () => N.cambio();
    return N;
  }
  function arrancarPulso() {
    clearInterval(pulso);
    pulso = setInterval(() => { if (N && (!X().locked || MOVIL_G)) N.tic().catch(() => { /* lo dice su estado */ }); }, 1000);   // the phone is «locked» while it looks: its pulse goes on (D-268)
  }
  // M.boot lo llama antes de leer nada (mesa.js, nubeAbrir): primero bajar, después dibujar
  // the phone (D-268): open looking; then look at once (the face already drew what it has), every 45 s with the screen in front,
  // on coming back and with the network back; going away with the Mesa, let it go. Never traerResto nor verificarOriginales: each
  // thing comes down when it is seen, and the phone never keeps an original to check.
  let mirarT = 0, DORMIDA = false, OYENDO = false;
  const mirarYa = () => { if (N && !DORMIDA && D.visibilityState === 'visible') N.mirar().then(r => { if (r && r.traido) lsS(TRAER, null); }, () => { /* its state says it */ }); };
  const soltarYa = () => { if (N && !DORMIDA) N.pedirIrse().catch(() => { /* the next time */ }); };
  async function abrirMovil(traer) {
    const r = await nucleo().abrir({ traer });
    if (r.modo === 'vacia') {
      lsS(ACTIVA, null); lsS(TRAER, null); X().NUBE.activa = false; X().NUBE.alApuntar = null; N = null; ESTADO = { fase: 'apagada' };
      X().toast('Tu Mesa aún no está en el servidor: se sube desde el escritorio.', { error: true });
      return { modo: 'local', motivo: 'vacia' };
    }
    if (traer && r.traido) lsS(TRAER, null);
    if (r.modo === 'vieja') { const f = X().movil.alVersion; if (f) f(); }
    arrancarPulso();
    clearInterval(mirarT); mirarT = setInterval(mirarYa, 45000);
    if (!OYENDO) { OYENDO = true; on(D, 'visibilitychange', () => { if (D.visibilityState === 'visible') mirarYa(); else soltarYa(); }); on(G, 'pageshow', mirarYa); on(G, 'online', mirarYa); on(G, 'pagehide', soltarYa); }
    if (!r.traido && r.modo === 'mirando') setTimeout(mirarYa, 0);
    AVS = await nucleo().avisos().catch(() => []);
    return r;
  }
  async function abrir() {
    const traer = lsG(TRAER) === '1';
    if (MOVIL_G) return abrirMovil(traer);
    const r = await nucleo().abrir({ traer });
    if (r.modo === 'vacia') {   // arriba no hay Mesa todavía: este navegador se queda como estaba, apagado (nada subió ni se apartó)
      lsS(ACTIVA, null); lsS(TRAER, null); X().NUBE.activa = false; X().NUBE.alApuntar = null; N = null; ESTADO = { fase: 'apagada' };
      trasArmazon(() => X().toast('Tu Mesa aún no está en el servidor: se sube desde el ordenador principal. Este navegador sigue como estaba.', { error: true }));
      return { modo: 'local', motivo: 'vacia' };
    }
    if (traer && (r.modo === 'turno' || r.traido)) { lsS(TRAER, null); lsS(VERIF, '1'); }   // traída (también en pausa: otro ordenador la tiene, D-262)
    if (traer && r.modo === 'local') {   // traer tu Mesa necesita conexión: no se deja escribir sobre una Mesa a medio traer
      X().pausaNube(capa('Tu Mesa aún no ha llegado', '<p>Para traerla hace falta conexión. Recarga cuando vuelva: lo de este navegador sigue apartado y sin tocar.</p>', '<button type="button" class="btn" data-nube="recargar">Recargar</button>'));
      arrancarPulso(); return r;
    }
    if (r.modo === 'pausada') pintarPausa();          // mesa.js lo pinta con el armazón, desde el primer momento
    else if (r.modo === 'vieja') pausar({ motivo: 'vieja' });
    arrancarPulso();
    AVS = await nucleo().avisos().catch(() => []);   // el núcleo y la página cuentan los mismos
    if (r.modo === 'turno') setTimeout(() => { traerResto().catch(() => {}); if (lsG(VERIF) === '1') verificarOriginales().catch(() => {}); }, 1500);
    return r;
  }
  function trasArmazon(f) { const t0 = Date.now(), t = setInterval(() => { if (X().shellReady() || Date.now() - t0 > 30000) { clearInterval(t); try { f(); } catch (e) { /* */ } } }, 100); }


  // ================= lote 4: las fotos (D-259) =================
  // Subir: un registro sube cuando sus archivos ya están en el almacén privado `mesa` (archivoHook, que el núcleo llama por
  // cada Blob al serializar). La foto de un registro de `files` de más de 2560 px sube como copia de trabajo (hecha en el worker,
  // nunca guardada aquí); lo demás, tal cual. La cola sale del diario: lo que no subió vuelve a pedirse en la siguiente vuelta.
  // Bajar (en otro aparato): la miniatura al verse, la foto al pedirla (getBlob), lo pequeño (sesiones, tareas, PDF) por detrás.
  const FOTOS_V = '1.1', LARGO = 2560, MAX_ARCHIVO = 25 * 1048576, PAR_SUBIR = 3, PAR_BAJAR = 4;
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf' };
  const errA = (m, codigo) => Object.assign(new Error(m), { codigo });
  let ALM_TEST = null; const AL = () => ALM_TEST || sb();   // el almacén de archivos (la batería pone uno de mentira: nunca la red)
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const mb = n => (Math.round(n / 1e5) / 10).toLocaleString('es-ES');
  // ---- el worker (si no se puede, lo mismo en el hilo principal) ----
  let WK = null, wkN = 0; const WKP = new Map();
  function wk() {
    if (WK !== null) return WK;
    try {
      WK = new Worker('nube-fotos.js?v=' + FOTOS_V);
      WK.onmessage = e => { const p = WKP.get(e.data && e.data.id); if (!p) return; WKP.delete(e.data.id); if (e.data.error) p.rej(new Error(e.data.error)); else p.res(e.data); };
      WK.onerror = () => { WKP.forEach(p => p.rej(new Error('el worker de las fotos falló'))); WKP.clear(); try { WK.terminate(); } catch (e) { /* */ } WK = false; };
    } catch (e) { WK = false; }
    return WK;
  }
  async function enHilo(m) {   // lo mismo que nube-fotos.js, sin worker
    const huella = async b => hex(await G.crypto.subtle.digest('SHA-256', await b.arrayBuffer()));
    if (m.op === 'huella') return { sha256: await huella(m.blob) };
    const bmp = await G.createImageBitmap(m.blob, { imageOrientation: 'from-image' });
    const cw = Math.max(1, Math.round(bmp.width * Math.min(1, LARGO / Math.max(bmp.width, bmp.height)))), ch = Math.max(1, Math.round(bmp.height * cw / bmp.width));
    const alfa = /^image\/(png|webp)$/.test(m.blob.type || ''), t = alfa ? 'image/webp' : 'image/jpeg';   // con transparencia, en WebP (o PNG): sin fondo blanco
    const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(cw, ch) : Object.assign(D.createElement('canvas'), { width: cw, height: ch }), x = c.getContext('2d');
    if (!alfa) { x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); } x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, cw, ch); bmp.close();
    const out = c.convertToBlob ? await c.convertToBlob({ type: t, quality: 0.9 }) : await new Promise(r => c.toBlob(r, t, 0.9));
    return { copia: out, w: cw, h: ch, sha256: await huella(out) };
  }
  // como mucho 2 a la vez en el worker (cada una lee entera una foto de hasta 30 MB): la mudanza pide 40 huellas de golpe
  let wkVan = 0; const WKQ = [];
  const wkTurno = prisa => (wkVan < 2 ? (wkVan++, Promise.resolve()) : new Promise(r => (prisa ? WKQ.unshift(r) : WKQ.push(r))));
  const wkSuelta = () => { const f = WKQ.shift(); if (f) f(); else wkVan--; };
  async function trabajo(m, prisa) {
    await wkTurno(prisa);
    try {
      const w = wk(); if (!w) return await enHilo(m);
      return await new Promise((res, rej) => { const id = ++wkN; WKP.set(id, { res, rej }); w.postMessage({ ...m, id }); }).catch(e => (WK === false ? enHilo(m) : Promise.reject(e)));
    } finally { wkSuelta(); }
  }
  // ---- el registro de lo que ya está arriba (almacén `nube`: 'h' huellas de aquí, 's' originales subidos) ----
  const HU = new Map(), SUBIDOS = new Map(), HP = new Map(), FALLOS = new Map(); let REG = null;
  const registro = () => REG || (REG = X().nubeAlmacen.registro().then(r => { r.h.forEach(([[a, k, ruta], x]) => HU.set(a + '\u0001' + k + '\u0001' + ruta, x)); r.s.forEach(([sha, x]) => SUBIDOS.set(sha, x)); }, e => { REG = null; throw e; }));
  async function huellaLocal(a, k, ruta, b) {
    const c = a + '\u0001' + k + '\u0001' + ruta, x = HU.get(c), fecha = typeof b.lastModified === 'number' ? b.lastModified : null;
    if (x && x.tam === b.size && x.tipo === (b.type || '') && x.fecha === fecha) return x.sha256;
    const ck = c + '\u0001' + b.size + '\u0001' + (b.type || '') + '\u0001' + fecha;
    if (!HP.has(ck)) HP.set(ck, (async () => {
      const { sha256 } = await trabajo({ op: 'huella', blob: b }), y = { tam: b.size, tipo: b.type || '', fecha, sha256 };
      HU.set(c, y); await X().nubeAlmacen.ponerHuella(a, k, ruta, y).catch(() => { /* la próxima vez se rehace */ });
      return sha256;
    })().finally(() => HP.delete(ck)));
    return HP.get(ck);
  }
  const necesitaCopia = (a, k, ruta, b, v) => a === 'files' && ruta === 'el valor.blob' && !!v && !v.design && !v.logo && !/^past:/.test(String(k))
    && /^image\//.test(b.type || '') && (Math.max(+v.w || 0, +v.h || 0) > LARGO || b.size > 24e6);
  // ---- la cola de subida ----
  const COLA = new Map(); let activos = 0;
  const FOTOS = { subidas: 0, bajadas: 0, error: '' };
  const fotosEnCola = () => { let n = 0; for (const j of COLA.values()) if (j.foto) n++; return n; };
  function encolar(sha, a, b, copia, v, foto) {
    const ck = sha + (copia ? '|c' : ''); let j = COLA.get(ck); if (j) return j;
    j = { sha, ck, a, blob: b, copia, foto, w: v && +v.w, h: v && +v.h }; j.promesa = new Promise((res, rej) => { j.res = res; j.rej = rej; }); j.promesa.catch(() => { /* lo mira quien espera */ });
    COLA.set(ck, j); correr(); pintar(); return j;
  }
  function correr() { for (const j of COLA.values()) { if (activos >= PAR_SUBIR) break; if (j.va) continue; j.va = true; activos++; subirUno(j).finally(() => { activos--; COLA.delete(j.ck); correr(); pintar(); }); } }
  async function subirArchivo(ruta, cuerpo, tipo) {
    for (let i = 0; ; i++) {
      try { await AL().subir('mesa', ruta, cuerpo, tipo); return; }
      catch (e) {
        const red = !e.status || e.status >= 500 || e.status === 408 || e.status === 429 || e.status === 401 || e.status === 403 || e.codigo === 'sesion' || e.codigo === 'red' || /jwt|unauthori|token|signature|row-level security/i.test(String(e.message || ''));   // la sesión o los permisos: se reintenta; nunca se aparta la foto por eso
        if (!red) throw errA(`el almacén no lo admite (${e.status}${e.message ? ': ' + String(e.message).slice(0, 120) : ''})`, 'archivo');
        if (i >= 4) throw errA(e.message || 'sin conexión', 'red');
        await dormir([2000, 5000, 10000, 20000][i]);
      }
    }
  }
  async function subirUno(j) {
    try {
      let cuerpo = j.blob, tipo = j.blob.type || '', sha = j.sha, trab = null;
      if (j.copia) {
        try { const r = await trabajo({ op: 'copia', blob: j.blob, w: j.w, h: j.h }); cuerpo = r.copia; tipo = r.copia.type || 'image/jpeg'; sha = r.sha256; trab = { sha256: sha, tam: cuerpo.size, tipo, w: r.w, h: r.h }; }
        catch (e) { if (!(EXT[tipo] && j.blob.size <= MAX_ARCHIVO)) throw errA('no se puede leer para hacer su copia de 2560 px', 'archivo'); }   // sin poder decodificarla (p. ej. HEIC), tal cual si cabe
      }
      if (!EXT[tipo]) throw errA(`un archivo ${tipo || 'sin tipo'} no se puede subir`, 'archivo');
      if (cuerpo.size > MAX_ARCHIVO) throw errA(`pesa ${mb(cuerpo.size)} MB; el tope de un archivo es 25 MB`, 'archivo');
      const ruta = `${j.a}/${sha}.${EXT[tipo]}`;
      await subirArchivo(ruta, cuerpo, tipo);
      const x = { ruta, ...(trab ? { trabajo: trab } : {}) };
      SUBIDOS.set(j.sha, x); await X().nubeAlmacen.ponerSubido(j.sha, x).catch(() => { /* se vuelve a ver al subir */ });
      FOTOS.subidas++; FOTOS.error = ''; j.res({ sha256: j.sha, ...x });
      if (N && N.archivosListos) N.archivosListos();
    } catch (e) {
      if (e.codigo === 'archivo') FALLOS.set(j.ck, e); else FOTOS.error = e.message || 'sin conexión';
      j.rej(e.codigo ? e : errA(e.message || String(e), 'red'));
    }
  }
  // El núcleo, por cada Blob de un registro que sube: {sha256, ruta, trabajo?} si sus bytes ya están arriba; si no, a la cola
  // y null (o, con esperar, cuando suban). Un archivo que el almacén no admite lanza «archivo» (el registro va aparte).
  async function archivoHook(a, k, ruta, b, { esperar, valor } = {}) {
    await registro();
    const sha = await huellaLocal(a, k, ruta, b);
    const s0 = SUBIDOS.get(sha); if (s0) return { sha256: sha, ...s0 };
    const cp = necesitaCopia(a, k, ruta, b, valor), ck = sha + (cp ? '|c' : '');
    if (FALLOS.has(ck)) throw FALLOS.get(ck);
    const j = encolar(sha, a, b, cp, valor, (a === 'files' && ruta === 'el valor.blob' && !(valor && (valor.design || valor.logo))) || (a === 'tfotos' && ruta === 'el valor.blob'));
    return esperar ? j.promesa : null;
  }
  // ---- bajar ----
  let bajando = 0; const ESPERAN = [], BAJ = new Map();
  const turnoBajar = prisa => (bajando < PAR_BAJAR ? (bajando++, Promise.resolve()) : new Promise(r => (prisa ? ESPERAN.unshift(r) : ESPERAN.push(r))));   // la foto que se abre pasa delante de las miniaturas
  const soltarBajar = () => { const f = ESPERAN.shift(); if (f) f(); else bajando--; };
  function bajarArchivo(ref, prisa) {
    if (!ref || !ref.ruta || !AL() || !X().NUBE.activa) return Promise.reject(new Error('esta foto aún no ha llegado a este ordenador'));
    if (BAJ.has(ref.ruta)) return BAJ.get(ref.ruta);
    const p = (async () => {
      await turnoBajar(prisa);
      try {
        let b = null;
        for (let i = 0; ; i++) {
          try { b = await AL().archivo('mesa', ref.ruta); break; }
          catch (e) { if (i >= 2 || (e.status && e.status < 500 && e.status !== 408 && e.status !== 429)) throw new Error(e.status === 0 || !e.status ? 'sin conexión: esta foto aún no ha llegado' : 'no se pudo bajar (' + e.status + ')'); await dormir(1500 * (i + 1)); }
        }
        const t = ref.trabajo ? ref.trabajo.tipo : ref.tipo, esperado = ref.trabajo ? ref.trabajo.sha256 : ref.sha256;
        const out = !ref.trabajo && ref.nombre ? new File([b], ref.nombre, { type: t, lastModified: +ref.fecha || 0 }) : b.type === t ? b : new Blob([b], { type: t });
        if ((await trabajo({ op: 'huella', blob: out }, prisa)).sha256 !== esperado) throw new Error('lo que llegó no coincide con su huella');
        FOTOS.bajadas++; return out;
      } finally { soltarBajar(); }
    })();
    BAJ.set(ref.ruta, p); p.then(() => BAJ.delete(ref.ruta), () => BAJ.delete(ref.ruta));
    return p;
  }
  const MINIS = new Map();
  function pedirMini(id) {
    if (!X().NUBE.activa || MINIS.has(id)) return;
    MINIS.set(id, (async () => {
      const rec = await X().idbGet('files', id); const ref = rec && rec.thumb;
      if (!X().esRefNube(ref) || !ref.ruta) return;
      const b = await bajarArchivo(ref), n = await X().nubeAlmacen.ponerArchivo('files', id, 'el valor.thumb', ref.sha256, b, null);
      if (n) X().fotoLlego(id, (await X().idbGet('files', id)) || n);   // releído: un Blob en disco, no el de la red en memoria
    })().catch(() => { /* se vuelve a pedir la próxima vez que se vea */ }).finally(() => MINIS.delete(id)));
  }
  // un Blob de aquí que es el original de esa huella (la misma foto bajo otro id, p. ej. llevada a otro post en el otro ordenador)
  async function originalAqui(sha, tam, tipo) {
    await registro();
    for (const [c, x] of HU) {
      if (x.sha256 !== sha || x.tam !== tam || (x.tipo || '') !== (tipo || '')) continue;
      const [a, k, ruta] = c.split('\u0001'); if (a !== 'files' || ruta !== 'el valor.blob') continue;
      const r = await X().idbGet('files', k).catch(() => null);
      if (r && r.blob instanceof Blob && !r.copia && r.blob.size === tam) return r.blob;
    }
    return null;
  }
  const FOTOS_EN = new Map();
  function traerFoto(id) {
    if (FOTOS_EN.has(id)) return FOTOS_EN.get(id);
    const p = (async () => {
      const rec = await X().idbGet('files', id), ref = rec && rec.blob;
      if (!X().esRefNube(ref)) return rec && rec.blob;
      const o = await originalAqui(ref.sha256, ref.tam, ref.tipo);
      if (o) { const n = await X().nubeAlmacen.ponerArchivo('files', id, 'el valor.blob', ref.sha256, o, null); const r2 = n ? (await X().idbGet('files', id)) || n : null; if (r2) { X().fotoLlego(id, r2); return r2.blob; } }
      const b = await bajarArchivo(ref, true), n = await X().nubeAlmacen.ponerArchivo('files', id, 'el valor.blob', ref.sha256, b, ref.trabajo ? { w: ref.trabajo.w, h: ref.trabajo.h } : null);
      const r2 = n ? (await X().idbGet('files', id)) || n : null;   // releído: un Blob en disco, no el de la red en memoria
      if (r2) X().fotoLlego(id, r2);
      return r2 ? r2.blob : b;
    })();
    FOTOS_EN.set(id, p); p.then(() => FOTOS_EN.delete(id), () => FOTOS_EN.delete(id));
    return p;
  }
  // lo pequeño (fotos de sesiones y de tareas, PDF de facturas), por detrás al abrir: hay pocos y sus módulos los leen enteros
  let RESTO = null;
  function traerResto() {
    if (RESTO) return RESTO;
    RESTO = (async () => {
      let n = 0;
      for (const a of ['tfotos', 'tareas', 'cfacturas', 'files']) {
        let l = await X().nubeAlmacen.refsPendientes(a, a === 'files' ? 'past:' : null).catch(() => []);   // de las fotos, solo las miniaturas del mes anterior
        if (a === 'files') l = l.filter(([k]) => /^past:/.test(String(k)));   // de las fotos, solo las miniaturas del mes anterior (las demás, al verse)
        await Promise.all(l.map(async ([k, ruta, ref]) => { try { const b = await bajarArchivo(ref); const r = await X().nubeAlmacen.ponerArchivo(a, k, ruta, ref.sha256, b, null); if (r) { n++; if (a === 'files' && X().pastLlego) X().pastLlego(String(k).slice(5), await X().idbGet('files', k)); } } catch (e) { /* la próxima vez */ } }));
      }
      if (n) { try { D.dispatchEvent(new CustomEvent('mesa-tareas')); D.dispatchEvent(new CustomEvent('mesa-nube-fotos')); const b = new BroadcastChannel('mesa-personal'); b.postMessage({ t: 'tareas' }); b.close(); } catch (e) { /* */ } }
      return n;
    })().finally(() => { RESTO = null; });
    return RESTO;
  }
  // Tras «Entrar y traer tu Mesa»: cada Blob de aquí que se quedó por tener el tamaño y el tipo de su referencia tiene que tener
  // también su huella; si no, lo de aquí se aparta («antes») y vuelve lo de arriba.
  // Cada Blob que se quedó aquí por tener el tamaño y el tipo de la referencia bajada (al traer la Mesa, o un original importado
  // sobre una copia) se compara con la huella de arriba en ese mismo sitio. Solo si no coincide: lo de aquí se aparta (una vez por
  // registro, sin pisar nada ya apartado) y vuelve lo de arriba. Lo que tiene cambios de aquí en el diario no se toca: sube.
  async function verificarOriginales() {
    let malos = 0, pendiente = false;
    const enRuta = (v, ruta) => { let x = v; for (const p of String(ruta).replace(/^el valor/, '').match(/[^.[\]]+/g) || []) { if (x == null || typeof x !== 'object') return undefined; x = x[/^\d+$/.test(p) && Array.isArray(x) ? +p : p]; } return x; };
    for (const a of ['files', 'tfotos', 'cfacturas', 'tareas']) {
      const arriba = await X().nubeAlmacen.refsArriba(a), porClave = new Map();
      for (const [k, ruta, b] of await X().nubeAlmacen.blobsDe(a)) { const s = arriba.get(k); if (s && s[ruta]) { if (!porClave.has(k)) porClave.set(k, []); porClave.get(k).push([ruta, b, s[ruta]]); } }
      for (const [k, l] of porClave) {
        const mal = [];
        for (const [ruta, b, sha] of l) { let h; try { h = await huellaLocal(a, k, ruta, b); } catch (e) { pendiente = true; continue; } if (h !== sha) mal.push(ruta); }
        if (!mal.length || (await X().nubeAlmacen.enDiario(a, k))) continue;   // con cambios de aquí por subir: no se toca
        const f = N && N.traerFila ? await N.traerFila(a, k) : null;
        if (!f) { pendiente = true; continue; }   // sin respuesta: se vuelve a comprobar al abrir
        if (f.borrado) continue;
        const [L] = await X().nubeAlmacen.leerVarios([[a, k]]);   // lo de aquí, como sube (sin la marca)
        let v = await X().idbGet(a, k); if (!v) continue;
        if (!(await X().nubeAlmacen.yaApartado(a, k))) await X().nubeAlmacen.apartar([{ a, k, v: null, motivo: 'huella' }]);   // lo de aquí, guardado aparte una vez
        for (const ruta of mal) { const r = enRuta(f.valor, ruta); if (r) v = X().nubeAlmacen.ponerEnRuta(v, ruta, { ...r }); }   // solo los sitios que no coinciden vuelven a la referencia de arriba
        await X().nubeAlmacen.aplicar({ escribir: [{ a, k, v: f.version, o: f.orden, b: false, valor: v }], saltar: [], aparte: [], refs: [] });
        if (a === 'files' && M.files[k]) {   // lo que la Mesa abierta sabe de esa foto: otra vez arriba (sin cambiar su miniatura a la vista)
          const r2 = await X().idbGet(a, k), o = M.files[k];
          if (r2 && X().esRefNube(r2.blob)) { o.pendiente = true; if (r2.blob.trabajo) o.copia = { w: r2.blob.trabajo.w, h: r2.blob.trabajo.h, falta: true }; delete M.blobs[k]; }
        }
        void L; malos++;
      }
    }
    if (malos) { try { D.dispatchEvent(new CustomEvent('mesa-tareas')); D.dispatchEvent(new CustomEvent('mesa-nube-fotos')); const b = new BroadcastChannel('mesa-personal'); b.postMessage({ t: 'tareas' }); b.close(); } catch (e) { /* */ } }
    if (!pendiente) lsS(VERIF, null);
    return malos;
  }
  X().NUBE.pedirMini = id => pedirMini(id);
  X().NUBE.repintar = () => pintar();
  X().NUBE.huellaDe = b => trabajo({ op: 'huella', blob: b }).then(r => r.sha256);
  X().NUBE.traerFoto = id => traerFoto(id);

  // ---------- la pausa: otro ordenador tiene la Mesa ----------
  const capa = (h, p, botones) => `<div class="card dlg nubedlg"><h3>${h}</h3>${p}<div class="form"><div class="row">${botones}</div></div></div>`;
  function pausar(info) {
    X().NUBE.modo = info && info.motivo === 'vieja' ? 'vieja' : 'pausada';
    const quien = esc(nombreDe(info && info.dispositivo)), ed = X().xfer && X().xfer.edPendiente && X().xfer.edPendiente() ? ' El editor tenía cambios sin aplicar: se han perdido.' : '';
    if (info && info.motivo === 'vieja') return X().pausaNube(capa('Hay una versión nueva de la Mesa', `<p>Otro ordenador usa una versión más nueva: esta se ha pausado para no pisar sus datos. Recárgala para seguir: lo guardado no se pierde.</p>`, '<button type="button" class="btn" data-nube="recargar">Recargar</button>'));
    if (info && info.motivo === 'cede') { const nf = fotosEnCola(); return X().pausaNube(capa(`La Mesa pasa a ${quien}`, `<p class="nubeesp" data-cede="1"><span>Subiendo lo último que hiciste aquí${nf ? ` (${nf} ${nf === 1 ? 'foto' : 'fotos'})` : ''}…</span>${ed}</p>`, '')); }
    return X().pausaNube(capa(`La Mesa está abierta en ${quien}`, `<p>Para no pisar sus cambios, esta se ha pausado.${ed} Lo que no se llegó a subir queda en «Quedó sin subir».</p>`, '<button type="button" class="btn2" data-nube="panel">Ver lo que quedó sin subir</button><button type="button" class="btn" data-nube="usar">Usar aquí</button>'));
  }
  function pintarPausa(extra) {
    const t = ESTADO.tiene || {}, quien = esc(nombreDe(t.dispositivo)), dd = t.desde ? ' ' + esc(desde(t.desde)) : '';
    const p = extra || `<p>Solo se puede usar en un ordenador a la vez. Si la usas aquí, ${quien} sube lo que tenga y se pausa.</p>`;
    X().pausaNube(capa(`La Mesa está abierta en ${quien}${dd}`, p, (ESTADO.sinSubir ? `<button type="button" class="btn2" data-nube="panel">Quedó sin subir (${ESTADO.sinSubir})</button>` : '') + '<button type="button" class="btn" data-nube="usar">Usar aquí</button>'));
  }
  async function usarAqui(op) {
    const t = ESTADO.tiene || {}, quien = esc(nombreDe(t.dispositivo));
    X().pausaNube(capa(`Pidiendo la Mesa a ${quien}`, `<p class="nubeesp">Esperando a que suba sus cambios y la suelte…</p>`, ''));
    const r = await nucleo().usarAqui(op || {});
    if (r.hecho) return;
    if (r.espera) {
      const e = r.espera, n = +e.cola || 0, h = e.latido ? desde(e.latido) : '';
      return X().pausaNube(capa(`${esc(nombreDe(e.dispositivo))} no contesta`, `<p>No contesta${h ? ' ' + esc(h) : ''}; tenía ${n} ${n === 1 ? 'cambio' : 'cambios'} sin subir. Si la usas aquí, esos cambios se quedan en ese ordenador, en «Quedó sin subir».</p>`,
        `<button type="button" class="btn2" data-nube="esperar">Esperar más</button><button type="button" class="btn" data-nube="forzar" data-visto="${esc(e.turno)}">Usarla aquí</button>`));
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
    const q = e.sinSubir ? ` · ${e.sinSubir} sin subir` : '', nf = fotosEnCola();
    if (TODO && (e.fase === 'subiendo' || e.fase === 'guardado')) return ['sube', `Subiendo todo · ${(TODO.hechos || 0).toLocaleString('es-ES')} de ${(TODO.total || 0).toLocaleString('es-ES')}`, q];
    switch (e.fase) {
      case 'guardado': return [e.cola || nf ? 'sube' : 'ok', nf ? `Subiendo ${nf} ${nf === 1 ? 'foto' : 'fotos'}` : e.cola ? `${e.cola} ${e.cola === 1 ? 'cambio' : 'cambios'} por subir` : 'En la nube', q];   // nunca «guardado» sin estarlo (y no dos «Guardado» en la cabecera)
      case 'subiendo': return ['sube', nf ? `Subiendo ${nf} ${nf === 1 ? 'foto' : 'fotos'}` : 'Subiendo…', q];   // el mismo texto en las dos fases: no parpadea
      case 'bajando': case 'abriendo': return ['sube', 'Bajando…', ''];
      case 'sin_conexion': return ['off', `Sin conexión · ${e.cola} ${e.cola === 1 ? 'cambio' : 'cambios'} en cola`, q];
      case 'pausada': return ['pausa', `Pausada: abierta en ${nombreDe(e.tiene && e.tiene.dispositivo)}`, q];
      case 'esperando': return ['sube', `Esperando a ${nombreDe(e.tiene && e.tiene.dispositivo)}…`, ''];
      case 'recargar': return ['aviso', 'Recarga para bajar lo último', q];
      case 'vieja': return ['aviso', 'Versión vieja: recarga', ''];
      case 'sin_sesion': return ['off', entradaActiva() ? 'Nube: entra otra vez' : 'Nube: entra con tu correo', q];
      case 'sin_codigo': return ['aviso', 'Nube: falta el código de tu app', q];
      case 'otra_cuenta': return ['aviso', 'Nube: esta cuenta no es la tuya', ''];
      default: return null;
    }
  }
  let PINTADO = '', PANEL = '', PINTADO_EL = null, TODO = null;
  // «Entrar y traer tu Mesa» (lote 4): en un navegador sin la nube, con proyecto (nunca en «Vista cliente»: lo oculta su CSS)
  const entradaActiva = () => !!(M.entrada && M.entrada.modo && M.entrada.modo !== 'sin_proyecto');
  const conTraer = () => !X().NUBE.activa && !!sb() && !lsG(TRAER) && !entradaActiva();   // con la entrada (D-262) no hay botón: se trae al entrar
  const conTraerCab = () => conTraer() && !((X().CL || []).length);   // en la cabecera solo en un navegador sin Mesa; con datos, en ⇅
  X().NUBE.traerHTML = () => (conTraer() ? '<div class="xtodo"><p><b>Tu Mesa del servidor.</b> Tráela a este navegador: lo que tenga aquí se aparta, no se sube ni se borra.</p><div class="form"><div class="row"><button type="button" class="btn2" data-nube="traer">Entrar y traer tu Mesa</button></div></div></div>' : '');
  function pintar() {
    const r = X().root && X().root(); if (!r) return;
    if (X().NUBE.activa || conTraerCab()) estilar();
    const b = r.querySelector('.appbar .nubest');
    if (b) {
      const t = X().NUBE.activa ? chipTexto(ESTADO) : conTraerCab() ? ['traer', 'Entrar y traer tu Mesa', ''] : null, k = t ? (ESTADO.sinSubir && X().NUBE.activa ? 'aviso' : t[0]) : '', txt = t ? t[1] + t[2] : '';
      const firma = k + '|' + txt;
      if (firma !== PINTADO || b !== PINTADO_EL || b.hidden !== !t) {   // solo si cambia: el pulso de cada segundo no toca el DOM
        PINTADO = firma; PINTADO_EL = b; b.hidden = !t;
        if (t) {
          b.dataset.k = k;
          b.innerHTML = `<span class="nubest-t">${esc(t[1])}</span>${t[2] ? `<span class="nubest-q">${esc(t[2])}</span>` : ''}`;
          b.title = k === 'traer' ? 'Entra con tu correo y trae aquí tu Mesa del servidor: lo que este navegador tenga se aparta, no se sube.' : `${txt}. Este navegador: ${nombreDe(DISP0())}. Pulsa para ver el estado${ESTADO.sinSubir ? ' y lo que quedó sin subir' : ''}.`;
          b.setAttribute('aria-label', k === 'traer' ? 'Entrar y traer tu Mesa' : 'Nube: ' + txt);
          if (k === 'traer') b.dataset.nube = 'traer'; else b.dataset.nube = 'panel';
        }
      }
    }
    // el panel abierto, solo si cambia lo que enseña (y sin perder dónde estaba la lista)
    const dl = r.querySelector('.detail[data-dlg="nube"]:not([hidden])'), pf = [ESTADO.fase, ESTADO.cola, ESTADO.sinSubir, ESTADO.error, ESTADO.alDia].join('|');
    if (dl && pf !== PANEL && !dl.contains(D.activeElement)) panel(true);
    // la Mesa ya pasó a otro (tras subir lo último): su aviso, con «Usar aquí»
    const lk = r.querySelector('.nubelock');
    const esp = lk && ESTADO.fase === 'subiendo' && lk.querySelector('.nubeesp[data-cede]');   // al ceder: cuántas fotos quedan, al día
    if (esp) { const nf = fotosEnCola(); esp.firstChild.textContent = `Subiendo lo último que hiciste aquí${nf ? ` (${nf} ${nf === 1 ? 'foto' : 'fotos'})` : ''}…`; }
    if (X().NUBE.activa && ESTADO.fase === 'pausada' && lk && !lk.querySelector('[data-nube="usar"]') && !lk.querySelector('[data-nube="esperar"]') && !lk.querySelector('[data-nube="forzar"]')) pintarPausa();
    // un aviso de actividad nuevo, en la página personal en esta misma sesión
    if (X().NUBE.activa && (ESTADO.avisos || 0) !== AVS.length && !releyendo) { releyendo = true; X().nubeAlmacen.avisos().then(l => { AVS = l; releyendo = false; if (M.personal && M.personal.abierta && M.personal.abierta()) M.personal.render(); }, () => { releyendo = false; }); }
  }
  let releyendo = false;

  // ---------- el panel: estado y «quedó sin subir» ----------
  const ALM = { boards: 'Tablero', clients: 'Cliente', bandejas: 'Bandeja', files: 'Foto', tareas: 'Tarea o nota', tfotos: 'Foto de una sesión', cobros: 'Factura', cfacturas: 'PDF de una factura', meses: 'Por qué y cómo fue', ubicaciones: 'Ubicación' };
  const MOTIVO = { ilegible: 'sus fotos no se pueden leer en este navegador', masivo: 'un vaciado lo borraría arriba: «Subir encima» confirma el borrado', borrado_arriba: 'otro ordenador lo borró, pero sus fotos solo están aquí', pendiente: 'la copia de una recarga, de antes de lo que llegó', turno: 'la Mesa pasó a otro ordenador antes de subirlo', choque: 'otro ordenador lo cambió antes', bajada: 'al abrir llegó otra versión del servidor', tope: 'pasa del tope de un registro', forma: 'no se puede subir', texto: 'tiene un texto que el servidor no admite', cede: 'no se pudo subir antes de pasar la Mesa', antes: 'lo tenía este navegador antes de traer tu Mesa; no se ha subido', huella: 'el mismo tamaño que arriba, pero no es la misma foto: vuelve la de arriba', archivo: 'un archivo que el servidor no admite' };
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
    const solos = ['bajada', 'masivo', 'borrado_arriba', 'pendiente', 'antes', 'huella'], c2 = todo ? l.filter(x => !solos.includes(x.motivo)).map(x => [x.a, x.k]) : claves;   // esos, de uno en uno
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
    if (f.tipo === 'dispositivo_nuevo') return ['La Mesa se abrió en un aparato nuevo', quien];   // an iPhone too (D-268)
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


  // ---------- «Entrar y traer tu Mesa» (lote 4, D-259): un ordenador que no es el primero se enciende sin Claude ----------
  // Entra con el correo (la misma sesión que «Web del cliente»), mira que arriba haya una Mesa, cuenta lo que este navegador ya
  // tiene y, con su sí, enciende la nube en modo «traer»: al recargar, lo de aquí se aparta (no sube ni se borra) y se baja todo.
  function dlgTraer(paso, correo, error) {
    const er = error ? `<p class="ferr" role="alert">${esc(error)}</p>` : '<p class="ferr" role="alert" hidden></p>';
    if (paso === 'codigo') return X().showDialog('nube', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Mira tu correo</h3>
      <form class="form" data-nubeform="codigo" autocomplete="off"><p class="nubep">Si ${esc(correo)} tiene acceso, te llega un código de 6 cifras. Vale 10 minutos.</p>
      <input type="hidden" name="correo" value="${esc(correo)}"><label for="nube-cod">Código</label><input id="nube-cod" name="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required>
      ${er}<div class="row"><button type="button" class="btn2" data-nube="traer">Usar otro correo</button><button type="submit" class="btn">Entrar</button></div></form>`);
    X().showDialog('nube', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Entrar y traer tu Mesa</h3>
      <form class="form" data-nubeform="correo" autocomplete="off"><p class="nubep">Trae a este navegador la Mesa que guardas en el servidor. Entra con tu correo.</p>
      <label for="nube-correo">Correo</label><input id="nube-correo" name="correo" type="text" inputmode="email" autocomplete="email" maxlength="120" required>
      ${er}<div class="row"><button type="submit" class="btn">Enviarme el código</button></div></form>`);
  }
  async function traerPaso2() {
    const c = sb(); if (!c) return;
    let r;
    try { r = await c.rpc('mesa_turno_ver', { dispositivo: DISP0() }); }
    catch (e) { return X().showDialog('nube', capaDlg('No se ha podido mirar el servidor', `<p class="nubep">${esc(e && e.status === 0 ? 'Sin conexión.' : (e && e.message) || 'Error')} Vuelve a intentarlo.</p>`, '<button type="button" class="btn" data-act="close">Cerrar</button>')); }
    if (!r || r.ok !== true) return X().showDialog('nube', capaDlg('Esta cuenta no es la de tu Mesa', '<p class="nubep">Has entrado, pero el servidor no la reconoce como la dueña de la Mesa.</p>', '<button type="button" class="btn" data-act="close">Cerrar</button>'));
    if (!(r.orden > 0)) return X().showDialog('nube', capaDlg('Tu Mesa aún no está en el servidor', '<p class="nubep">Se sube desde el ordenador principal (la mudanza). Este navegador sigue como estaba.</p>', '<button type="button" class="btn" data-act="close">Cerrar</button>'));
    const nC = (X().CL || []).length, nF = (await X().nubeAlmacen.claves('files').catch(() => [])).length, nT = (await X().nubeAlmacen.claves('tareas').catch(() => [])).length;
    const hay = nC + nF + nT > 0, que = [nC && `${nC} ${nC === 1 ? 'cliente' : 'clientes'}`, nF && `${nF.toLocaleString('es-ES')} ${nF === 1 ? 'foto' : 'fotos'}`, nT && `${nT} ${nT === 1 ? 'tarea o nota' : 'tareas y notas'}`].filter(Boolean).join(', ');
    const enOtro = r.tiene && r.tiene.dispositivo ? `<p class="nubep">Ahora está abierta en ${esc(nombreDe(r.tiene.dispositivo))}: al traerla, la pedirás aquí y ese ordenador subirá lo suyo y se pausará.</p>` : '';
    setTimeout(() => { const b = D.querySelector('.detail:not([hidden]) [data-nube="traer-si"]'); if (b) b.focus(); }, 0);
    X().showDialog('nube', capaDlg('Traer tu Mesa aquí', (hay ? `<p class="nubep">Este navegador ya tiene una Mesa (${esc(que)}). <b>Lo de aquí se aparta</b>: no se sube ni se borra, y queda en «Nube → Quedó sin subir» para mirarlo. Las fotos que sean las mismas que arriba se quedan como originales.</p>` : '<p class="nubep">Se baja tu Mesa entera; las fotos, cuando las veas.</p>') + enOtro,
      '<button type="button" class="btn2" data-act="close">Cancelar</button><button type="button" class="btn" data-nube="traer-si">Traer tu Mesa</button>'));
  }
  const capaDlg = (h, p, botones) => `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${h}</h3>${p}<div class="form"><div class="row">${botones}</div></div>`;
  async function alEnviarTraer(e) {
    const f = e.target.closest && e.target.closest('form[data-nubeform]'); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const c = sb(), err = f.querySelector('.ferr'), btn = f.querySelector('button[type=submit]');
    const mal = m => { m = String(m || 'No se pudo').trim(); m = m[0].toUpperCase() + m.slice(1); if (!/[.!?]$/.test(m)) m += '.'; err.textContent = m; err.hidden = false; btn.disabled = false; };
    if (!c) return mal('Esta Mesa no tiene servidor.');
    btn.disabled = true; err.hidden = true;
    try {
      if (f.dataset.nubeform === 'correo') {
        const correo = f.correo.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return mal('Ese correo no parece bien escrito.');
        await c.pedirCodigo(correo); dlgTraer('codigo', correo);
      } else { await c.verificarCodigo(f.correo.value, f.codigo.value); await traerPaso2(); }
    } catch (x) { mal(x.message || String(x)); }
  }
  function traerEmpezar() { const c = sb(); if (!c) return; if (c.usuario()) traerPaso2(); else dlgTraer(); }
  async function traerSi() {
    if (X().NUBE.activa) return;
    lsS(TRAER, '1'); lsS(ACTIVA, '1');
    try { if (M.flush) await M.flush(); } catch (e) { /* */ }
    G.location.reload();
  }

  // ---------- clics ----------
  function alClic(e) {
    const b = e.target.closest && e.target.closest('[data-nube]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.nube;
    if (a === 'panel') { if (ESTADO.fase === 'sin_codigo' && M.entrada) M.entrada.pedirCodigo(); else panel(); }
    else if (a === 'usar') usarAqui();
    else if (a === 'esperar') usarAqui({ esperar: true });   // «Esperar más»: the 20 s, also with the other quiet (D-268)
    else if (a === 'forzar') forzar(b.dataset.visto);
    else if (a === 'recargar') G.location.reload();
    else if (a === 'entrar') { if (entradaActiva()) G.location.reload(); else if (M.web && M.web.entrar) M.web.entrar(); }
    else if (a === 'visto') visto(b.dataset.id);
    else if (a === 'encima' || a === 'descartar') reconciliar(a, false, b);
    else if (a === 'encima-todo') reconciliar('encima', true, b);
    else if (a === 'descartar-todo') reconciliar('descartar', true, b);
    else if (a === 'traer') traerEmpezar();
    else if (a === 'traer-si') traerSi();
  }
  on(D, 'click', alClic, true);
  on(D, 'submit', alEnviarTraer, true);

  // ---------- window.MESA.nube (para Claude) ----------
  M.nube = {
    version: VERSION,
    // Enciende la nube en este navegador y recarga: al abrir, primero baja (con el OK de Kevin en la Mesa real).
    activar: async (op = {}) => {
      if (!sb()) return { error: 'sin proyecto: en una copia de este Mac, pon mesa-web-proyecto (el de pruebas)' };
      if (!sb().usuario()) return { error: 'sin sesión: entra antes con «Web del cliente»' };
      // el primer ordenador (la mudanza) sube lo suyo; uno que nunca bajó nada, con arriba ya una Mesa, la trae (lote 4)
      if (!op.primero) {
        let r = null; try { r = await sb().rpc('mesa_turno_ver', { dispositivo: DISP0() }); } catch (e) { return { error: 'sin conexión con el servidor' }; }
        const m = await X().nubeAlmacen.meta().catch(() => ({}));
        if (r && r.ok && r.orden > 0 && !(m.cursor > 0)) return { error: 'arriba ya hay una Mesa y este navegador nunca bajó nada: usa «Entrar y traer tu Mesa» (o activar({primero: true}) si de verdad es el ordenador de la mudanza)' };
      }
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
    // La mudanza (lote 5, D-259): sube todos los almacenes (no solo el diario), se puede cortar y repetir; con su avance en la
    // cabecera. Después, comprobar(): solo un resumen.
    subirTodo: async () => {
      if (!X().NUBE.activa || !N) return { error: 'la nube no está encendida en este navegador' };
      TODO = { hechos: 0, total: 0 }; pintar();
      try { return await N.subirTodo({ progreso: p => { TODO = p; pintar(); } }); }
      finally { TODO = null; pintar(); }
    },
    comprobar: async () => {
      if (!X().NUBE.activa || !N) return { error: 'la nube no está encendida en este navegador' };
      return N.comprobar({ rutas: async () => { const s = new Set(); for (const a of ['files', 'tfotos', 'cfacturas', 'tareas']) for (const n of await AL().listar('mesa', a)) s.add(a + '/' + n); return s; } });
    },
    fotos: () => ({ enCola: COLA.size, fotos: fotosEnCola(), subidas: FOTOS.subidas, bajadas: FOTOS.bajadas, error: FOTOS.error, fallos: FALLOS.size, porque: [...new Set([...FALLOS.values()].map(e => e.message))].slice(0, 3) }),
    _traerResto: () => traerResto(), _verificar: () => verificarOriginales(), _traer: () => traerEmpezar(), _copia: (blob, w, h) => trabajo({ op: 'copia', blob, w, h }),
    estado: async () => {
      const e = N ? N.estado() : { fase: 'apagada' };
      return { activa: X().NUBE.activa, dispositivo: X().NUBE.activa ? DISP0() : lsG(DISP_K) || null, nombre: X().NUBE.activa ? nombreDe(DISP0()) : null, modo: X().NUBE.modo, ...e,
        sinSubirLista: (await X().nubeAlmacen.sinSubir().catch(() => [])).map(x => ({ almacen: x.a, clave: x.k, motivo: x.motivo, mensaje: x.mensaje, borrado: x.borrado })), avisos: AVS.length };
    },
    avisosHTML, avisos: () => AVS.slice(), avisosN: () => (X().NUBE.activa ? AVS.length : 0), nombreDe,
    // the phone (D-268): look, take the Mesa, let it go, force it without reloading; its face hears every state and change
    mirar: () => (N && !DORMIDA ? N.mirar() : Promise.resolve({ error: 'apagada' })), tomar: op => (N && !DORMIDA ? N.tomar(op) : Promise.resolve({ error: 'apagada' })),
    soltar: () => (N && !DORMIDA ? N.soltar() : Promise.resolve(DORMIDA ? { error: 'dormida' } : { hecho: true })), retener: v => { if (N && !DORMIDA) N.retener(v); },
    forzarAqui: visto => (N && !DORMIDA ? N.forzar(+visto) : Promise.resolve({ error: DORMIDA ? 'dormida' : 'apagada' })),   // a sleeping tab touches nothing (review 2, point 7)
    subirEncima: claves => (N && !DORMIDA ? N.subirEncima(claves) : Promise.resolve({ error: DORMIDA ? 'dormida' : 'apagada' })), descartar: claves => (N && !DORMIDA ? N.descartar(claves) : Promise.resolve({ error: DORMIDA ? 'dormida' : 'apagada' })),
    sinSubir: () => X().nubeAlmacen.sinSubir(), estadoYa: () => (N ? N.estado() : { fase: 'apagada' }), conTurno: () => !!(N && N.conTurno()),
    alEstado: f => { CARA.add(f); return () => CARA.delete(f); },
    _dormir: () => { DORMIDA = true; clearInterval(pulso); clearInterval(mirarT); if (N && N.dormir) N.dormir(); },   // another tab of this phone took over: this one does nothing more (it never lets the Mesa go: it is the same device)
    _abrir: abrir, _nucleo: () => N, _panel: panel,
    // solo para la batería: el estado pintado, los avisos releídos y un núcleo con un servidor de mentira (nunca la red)
    _estado: e => { ESTADO = { cola: 0, sinSubir: 0, ...e }; estilar(); pintar(); },
    _releerAvisos: async () => { AVS = await X().nubeAlmacen.avisos().catch(() => []); estilar(); return AVS.length; },
    _con: (servidor, almacenamiento) => { N = null; ALM_TEST = almacenamiento || null; const c = { rpc: servidor.rpc }; N = G.NubeNucleo.crear({ servidor: c, almacen: X().nubeAlmacen, reloj: { ahora: () => Date.now(), esperar: ms => new Promise(r => setTimeout(r, ms)) }, dispositivo: DISP0(), app: M.version, archivo: archivoHook, movil: MOVIL_G, efectos: (MOVIL_G ? efectosMovil : x => x)({ pausar, recargar: () => { N._recargas = (N._recargas || 0) + 1; }, estado: e => { ESTADO = e; pintar(); } }) }); X().NUBE.alApuntar = () => N.cambio(); return N; },
    _soltar: () => { clearInterval(pulso); N = null; ALM_TEST = null; X().NUBE.alApuntar = null; ESTADO = { fase: 'apagada' }; COLA.clear(); FALLOS.clear(); HU.clear(); SUBIDOS.clear(); REG = null; pintar(); },
    _off: () => { OFF.splice(0).forEach(f => f()); clearInterval(pulso); }
  };
  if (X().NUBE.activa) { sb().alCambiar(u => { const n = sb().nivel && sb().nivel(); if (u && N && (ESTADO.fase === 'sin_sesion' || (ESTADO.fase === 'sin_codigo' && n && n.aal === 'aal2'))) N.reintentar(); }); if (!MOVIL_G) trasArmazon(() => pintar()); }
  else if (conTraer() && !MOVIL_G) trasArmazon(() => pintar());   // (solo se ve en la cabecera si este navegador no tiene Mesa; el móvil no tiene cabecera)
  function estilar() { if (!D.getElementById('mesa-nube-css')) X().estilo('mesa-nube-css', ESTILO); }
  (G.MESA_CARGA = G.MESA_CARGA || {}).nube = 'ok';
  const ICO = d => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.33' stroke-linecap='round' stroke-linejoin='round'%3E${d.replace(/<path d='/g, "%3Cpath vector-effect='non-scaling-stroke' d='").replace(/'\/>/g, "'/%3E").replace(/<circle /g, "%3Ccircle vector-effect='non-scaling-stroke' ").replace(/<line /g, "%3Cline vector-effect='non-scaling-stroke' ")}%3C/svg%3E")`;
  const I_TRAER = ICO("<path d='M12 13v8l-4-4'/><path d='m12 21 4-4'/><path d='M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284'/>");
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
#mesa .nubest[data-k="traer"]::before{-webkit-mask-image:${I_TRAER};mask-image:${I_TRAER}}
#mesa .nubest[data-k="traer"]{color:var(--ink-2)}
#mesa .nubest[data-k="pausa"]::before{-webkit-mask-image:${I_PAUSA};mask-image:${I_PAUSA}}
#mesa .nubest:is([data-k="off"],[data-k="pausa"],[data-k="aviso"]){color:var(--ink-2)}
#mesa .nubest[data-k="aviso"]::before{background:var(--chg);-webkit-mask-image:${I_ALERTA};mask-image:${I_ALERTA}}
#mesa .detail[data-dlg="nube"]{z-index:21}
#mesa .nubest .nubest-t{overflow:hidden;text-overflow:ellipsis}#mesa .nubest .nubest-q{color:var(--red);font-weight:600}
@media (max-width:1100px){#mesa .nubest{max-width:200px}#mesa .nubest[data-k="ok"] .nubest-t{display:none}#mesa .nubest[data-k="ok"]{padding:0 8px}}
@media (max-width:760px){#mesa .nubest:not([data-k="traer"]) .nubest-t{display:none}#mesa .nubest{padding:0 8px}}
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
