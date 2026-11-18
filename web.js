// web.js · Enviar a la web del cliente (D-241, lote 2 del portal). Mesa ≥ 4.28.
// Desde el tablero abierto, Kevin envía al servidor un paquete por cliente y mes con lo que ve el cliente en su portal, ya
// filtrado aquí (lección 81): nunca la Nota, el contexto, los captions sin elegir, nombres de archivo, ids de Notion ni nada
// de otros clientes. La sesión de Kevin la lleva `portal/supa.js`; las aprobaciones y comentarios se leen en el lote 4.
(function webBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.0';
  const I = () => M._in;
  if (M.web && M.web._off) { try { M.web._off(); } catch (e) { /* una versión anterior ya no está */ } }
  const OFF = [];
  const on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, o) => I().toast(m, o);

  // ---------- El proyecto ----------
  // El real se rellena al crearlo (lote 5: su URL y su clave «publishable», públicas por diseño). En una copia de pruebas
  // servida en este Mac (127.0.0.1) manda la que diga `localStorage['mesa-web-proyecto']`; en cualquier otro sitio, nunca.
  const REAL = { url: '', publica: '' };
  const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
  function proyecto() {
    if (LOCAL) { try { const p = JSON.parse(localStorage.getItem('mesa-web-proyecto') || 'null'); if (p && p.url && p.publica) return p; } catch (e) { /* sin almacenamiento */ } }
    return REAL.url && REAL.publica ? REAL : null;
  }
  let SB = null;
  function sb() {
    const p = proyecto(); if (!p || !window.Supa) return null;
    if (!SB || SB._url !== p.url) {
      try { SB = window.Supa.crear({ url: p.url, publica: p.publica, clave: 'mesa-web-' + p.url.split('//')[1].split('.')[0] }); SB._url = p.url; }
      catch (e) { return null; }
      SB.alCambiar(() => { st.dueno = null; st.servidor = null; pedirRepaso(); });
    }
    return SB;
  }

  // ---------- Lo que ve el cliente, publicación a publicación ----------
  const TIPO = { 'Foto': 'foto', 'Carrusel': 'carrusel', 'Reel': 'reel', 'Collab Reel': 'collab_reel', 'Trial Reel': 'trial_reel' };
  const ESTADO = { empezar: 'preparando', captions: 'preparando', aprobar: 'por_aprobar', noaprobado: 'cambios', aprobado: 'aprobada', programado: 'programada', publicado: 'publicada' };
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const sha = async t => hex(await crypto.subtle.digest('SHA-256', typeof t === 'string' ? new TextEncoder().encode(t) : t));
  const pidDe = (cli, id) => sha(cli + '|' + id).then(h => h.slice(0, 16));
  const mesNatural = iso => { const d = I().localDay(iso); return d ? d.slice(0, 7) : null; };

  // Una publicación tal como la ve el cliente, sin imágenes (las imágenes se sacan al enviar). `version` es la huella de su
  // contenido: tipo, nombre, fecha, caption elegido, fotos y recortes. Una aprobación vale para una versión (D-241).
  async function fila(s, B, orden) {
    const X = I(), vivo = X.vivo(s), dia = X.localDay(s.date), sinHora = !!(dia && X.dOnly(s.date));
    const fecha = !dia ? null : sinHora ? X.madridISO(dia, '00:00') : new Date(X.ts(s.date)).toISOString();
    const caption = X.capFinal(s) || '';
    const nombre = X.shortLabel(s.name, s.type) || s.type;
    const fotos = [X.publishList(s), X.cropSig(s, B)], contenido = [TIPO[s.type] || 'foto', nombre, fecha, sinHora, caption, ...fotos];
    return {
      s, pid: await pidDe(B.client, s.id), version: await sha(JSON.stringify(contenido)), firmaFotos: await sha(JSON.stringify(fotos)),
      fila: { cliente_id: B.client, mes: mesNatural(s.date) || B.month, orden: vivo ? orden : 999, tipo: TIPO[s.type] || 'foto', nombre: nombre.slice(0, 80),
        fecha, sin_hora: sinHora, caption: caption.slice(0, 2200), estado: vivo ? (ESTADO[X.estadoDe(s)] || 'preparando') : 'preparando', visible: vivo },
    };
  }
  // El orden del feed: las fijadas primero, después las vivas por fecha (como la cuadrícula, D-152).
  function ordenFeed(B) {
    const X = I(), pins = (B.pins || []).filter(id => B.slots.some(x => x.id === id && X.vivo(x)));
    return [...pins.map(id => B.slots.find(x => x.id === id)), ...B.slots.filter(x => !pins.includes(x.id) && X.vivo(x))];
  }
  async function filas(B) {
    const orden = ordenFeed(B), out = [];
    for (const s of B.slots) out.push(await fila(s, B, Math.max(0, orden.indexOf(s))));
    return out;
  }

  // ---------- Imágenes: recortadas como en el feed, a 1440 y a 480 px, nombradas por su huella ----------
  async function lienzoA(blob, rect, w, h, lado) {
    const r = rect || { x: 0, y: 0, w, h };
    const k = Math.min(1, lado / Math.max(r.w, r.h));
    const bmp = await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(w * k)), resizeHeight: Math.max(1, Math.round(h * k)), resizeQuality: 'high' });
    const cw = Math.max(1, Math.round(r.w * k)), ch = Math.max(1, Math.round(r.h * k));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(bmp, Math.round(r.x * k), Math.round(r.y * k), cw, ch, 0, 0, cw, ch);
    if (bmp.close) bmp.close();
    const out = await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('no se pudo dibujar la imagen')), 'image/jpeg', 0.86));
    cv.width = cv.height = 0;
    return { blob: out, w: cw, h: ch };
  }
  async function imagenesDe(s, B) {
    const X = I(), out = [];
    await X.loadThumbs(X.publishList(s));
    for (const fid of X.publishList(s)) {
      const f = M.files[fid]; if (!f) throw new Error(`falta una foto de «${X.shortLabel(s.name, s.type)}» en esta Mesa`);
      const blob = await X.getBlob(fid), rect = f.design ? null : X.postRect(fid, s, B);
      const g = await lienzoA(blob, rect, f.w, f.h, 1440), m = await lienzoA(g.blob, null, g.w, g.h, 480);
      const h = await sha(await g.blob.arrayBuffer());
      out.push({ ruta: `${B.client}/${h}.jpg`, mini: `${B.client}/${h}-m.jpg`, an: g.w, al: g.h, _g: g.blob, _m: m.blob });
    }
    return out;
  }

  // ---------- El paquete del tablero abierto ----------
  // { cliente, publicaciones, sesiones, meses, pagos, problemas }. Sin imágenes; `enviar` las saca de lo que cambió.
  async function paquete() {
    const X = I(), B = X.S;
    if (!B) return { error: 'sin tablero abierto' };
    const cli = B.client, c = X.CL.find(x => x.id === cli) || {};
    const pubs = await filas(B);
    const meses = [...new Set([...pubs.map(p => p.fila.mes), ...X.boardMonths ? (X.boardMonths(B) || []) : []].filter(Boolean))].sort();
    const previo = meses.length ? X.addMonths(meses[0], -1) : null;
    const tareas = await X.idbAll('tareas').catch(() => []);
    const ses = tareas.filter(t => t.tipo === 'sesion' && !(t.sesion && t.sesion.visible === false) && /^\d{4}-\d{2}-\d{2}$/.test(t.fecha || '')
      && (Array.isArray(t.clientes) ? t.clientes : t.cliente ? [t.cliente] : []).includes(cli) && meses.includes(t.fecha.slice(0, 7)))
      .map(t => {
        const fin = t.fin && /^\d{4}-\d{2}-\d{2}$/.test(t.fin.fecha || '') && t.fin.fecha >= t.fecha ? t.fin.fecha : null;
        return { cliente_id: cli, id: String(t.id).slice(0, 60), mes: t.fecha.slice(0, 7), nombre: String(t.txt || 'Sesión').slice(0, 80),
          inicio: X.madridISO(t.fecha, /^\d\d:\d\d$/.test(t.hora || '') ? t.hora : '00:00'), fin: fin ? X.madridISO(fin, '23:59') : null, sin_hora: !/^\d\d:\d\d$/.test(t.hora || '') };
      });
    const mesesInfo = [];
    for (const m of [previo, ...meses].filter(Boolean)) {
      const r = M.informe && M.informe.ver ? await M.informe.ver(cli, m) : null;
      if (r && !r.error && (r.porque || r.resumen)) mesesInfo.push({ cliente_id: cli, mes: m, porque: r.porque || null, resumen: r.resumen || null });
    }
    if (X.cob && X.cob.leer) await X.cob.leer();
    const cob = X.cob, vivos = cob ? cob.vivos(cli) : [];
    const pagos = vivos.filter(r => +r.importe >= 0).map(r => ({ cliente_id: cli, id: String(r.id).slice(0, 80), periodo: /^\d{4}-\d{2}$/.test(r.periodo || '') ? r.periodo : null,
      concepto: r.concepto ? String(r.concepto).slice(0, 120) : null, importe_cent: Math.round((+r.importe || 0) * 100), factura: r.factura ? String(r.factura).slice(0, 40) : null,
      emitida: r.emitida || null, vence: r.vence || null, cobrada: r.cobrada || null, _pdf: r.pdf || null }));
    const q = cob ? cob.cuota(c) : null, prox = cob && q ? cob.proxima(cli) : null;
    const cliente = { id: cli, nombre: String(c.name || cli).slice(0, 80), handle: c.handle ? String(c.handle).replace(/^@/, '').slice(0, 40) : null,
      cuota_cent: q ? Math.round(q.importe * 100) : null, proxima_emision: prox && prox.emitida ? prox.emitida : null, _foto: c.foto || null };
    // Ningún texto que va a la web nombra a otro cliente (lecciones 82 y 84): si no, no se envía.
    const problemas = [], esporadicos = tareas.filter(t => t.tipo === 'esporadico' && !t.pasado && t.txt).map(t => String(t.txt));
    const textos = [...pubs.flatMap(p => [[`«${p.fila.nombre}»: nombre`, p.fila.nombre], [`«${p.fila.nombre}»: caption`, p.fila.caption]]),
      ...ses.map(x => [`sesión «${x.nombre}»`, x.nombre]), ...pagos.map(p => [`cobro ${p.factura || p.periodo || ''}: concepto`, p.concepto || ''])];
    X.mesOtros(cli, textos, m => problemas.push(m), esporadicos);
    return { cliente, publicaciones: pubs, sesiones: ses, meses: mesesInfo, mesesTablero: meses, pagos, problemas };
  }

  // ---------- Estado de la barra ----------
  const st = { clave: '', servidor: null, cambios: null, enviando: null, error: '', dueno: null, firma: '', leyendo: null };
  const IMG = new Map();   // «pid|firma de sus fotos» → sus imágenes ya enviadas en esta pestaña: un cambio de caption no las rehace
  async function leerServidor(cli) {
    const c = sb(); if (!c || !c.usuario()) return null;
    const l = await c.leer(`publicaciones?cliente_id=eq.${encodeURIComponent(cli)}&select=pid,version,estado,orden,visible,mes,nombre,fecha,sin_hora,caption,tipo,imagenes`);
    return new Map((l || []).map(r => [r.pid, r]));
  }
  const igual = (p, r) => r && r.version === p.version && r.estado === p.fila.estado && r.orden === p.fila.orden && r.visible === p.fila.visible && r.mes === p.fila.mes;
  async function repaso() {
    const X = I(), B = X && X.S, c = sb();
    if (!B || !c || !c.usuario() || st.enviando) return;
    if (st.clave !== B.key) { st.clave = B.key; st.servidor = null; st.cambios = null; st.firma = ''; }
    try {
      const pubs = await filas(B), firma = pubs.map(p => p.pid + p.version + p.fila.estado + p.fila.orden + p.fila.visible).join('|');
      if (!st.servidor) st.servidor = await leerServidor(B.client);
      if (firma === st.firma && st.cambios != null) return;
      st.firma = firma; st.error = '';
      const n = pubs.filter(p => !igual(p, st.servidor.get(p.pid))).length;
      if (n !== st.cambios) { st.cambios = n; X.renderBar(); }
    } catch (e) { const m = String(e.message || e); if (m !== st.error) { st.error = m; X.renderBar(); } }
  }
  let repasoT = 0;
  const pedirRepaso = () => { clearTimeout(repasoT); repasoT = setTimeout(() => { repaso().catch(() => { /* lo dice st.error */ }); }, 300); };

  function barra() {
    const c = sb(), X = I();
    if (!c || !X || !X.S || X.root().classList.contains('client')) return '';   // sin proyecto, o en «Vista cliente» (D-154)
    if (!c.usuario()) return '<button type="button" class="mchip ghost webbtn" data-web="entrar" title="Entra con tu correo para enviar a la web lo que ve el cliente">Web del cliente</button>';
    if (st.enviando) return `<span class="mchip webbtn" aria-live="polite">Enviando a la web… ${st.enviando.hechos}/${st.enviando.total}</span>`;
    if (st.error) return `<button type="button" class="mchip ghost webbtn mal" data-web="repasar" title="${esc(st.error)}">Web: no se pudo leer</button>`;
    if (st.cambios == null) return '<span class="mchip ghost webbtn">Web del cliente</span>';
    if (!st.cambios) return '<button type="button" class="mchip ghost webbtn" data-web="enviar" title="La web del cliente enseña lo mismo que este tablero. Enviar otra vez lo vuelve a comprobar">Web: al día</button>';
    return `<button type="button" class="mchip webbtn hay" data-web="enviar" title="Envía a la web del cliente lo que ha cambiado en este tablero">Web: ${st.cambios} ${st.cambios === 1 ? 'cambio' : 'cambios'} sin enviar · Enviar</button>`;
  }

  // ---------- Enviar ----------
  async function esDueno(c) {
    if (st.dueno != null) return st.dueno;
    try { st.dueno = (await c.rpc('es_dueno')) === true; } catch (e) { throw new Error('no se pudo comprobar la cuenta: ' + e.message); }
    return st.dueno;
  }
  async function enviar() {
    const X = I(), B = X && X.S, c = sb();
    if (!B) return { error: 'sin tablero abierto' };
    if (!c) return { error: 'sin proyecto de la web' };
    if (!c.usuario()) { dlgEntrar(); return { error: 'sin sesión' }; }
    if (st.enviando) return { error: 'ya se está enviando' };
    if (X.locked) return { error: 'esta pestaña está en pausa' };
    const clave = B.key;
    try {
      if (!(await esDueno(c))) throw new Error('esta cuenta no es la de Kevin en el servidor');
      if (M.flush) await M.flush();
      const P = await paquete();
      if (P.error) throw new Error(P.error);
      if (P.problemas.length) { dlgProblemas(P.problemas); return { error: 'nombra a otro cliente', problemas: P.problemas }; }
      const serv = st.servidor && st.clave === clave ? st.servidor : await leerServidor(B.client);
      const cambian = P.publicaciones.filter(p => p.fila.visible && (!serv.get(p.pid) || serv.get(p.pid).version !== p.version));
      st.enviando = { hechos: 0, total: cambian.length + 1 }; X.renderBar();
      // Foto del perfil del cliente y sus imágenes, sin repetir las que ya están (las rutas son la huella del contenido).
      const ya = new Set(await c.listar('fotos', B.client).catch(() => []));
      let subidas = 0;
      const subir = async (ruta, blob) => { const n = ruta.split('/').pop(); if (ya.has(n)) return; await c.subir('fotos', ruta, blob, 'image/jpeg'); ya.add(n); subidas++; };
      let foto = null;
      if (P.cliente._foto && M.files) {
        try {
          const blob = await X.getBlob(P.cliente._foto), f = M.files[P.cliente._foto] || {};
          const g = await lienzoA(blob, null, f.w || 400, f.h || 400, 240), h = await sha(await g.blob.arrayBuffer());
          foto = `${B.client}/${h}.jpg`; await subir(foto, g.blob);
        } catch (e) { foto = null; }   // sin foto de perfil, el portal pone sus iniciales
      }
      const { _foto, ...cli } = P.cliente;
      await c.insertar('clientes', [{ ...cli, foto }], { upsert: true, conflicto: 'id' });
      st.enviando.hechos++; X.renderBar();
      const imgs = new Map();
      for (const p of cambian) {
        const k = p.pid + '|' + p.firmaFotos;
        if (!IMG.has(k)) {
          const l = await imagenesDe(p.s, B);
          for (const im of l) { await subir(im.ruta, im._g); await subir(im.mini, im._m); }
          IMG.set(k, l.map(({ ruta, mini, an, al }) => ({ ruta, mini, an, al })));
        }
        imgs.set(p.pid, IMG.get(k));
        st.enviando.hechos++; X.renderBar();
      }
      const filasPub = P.publicaciones.map(p => ({ ...p.fila, pid: p.pid, version: p.version,
        imagenes: imgs.get(p.pid) || (serv.get(p.pid) && serv.get(p.pid).version === p.version ? serv.get(p.pid).imagenes : []) }));
      if (filasPub.length) await c.insertar('publicaciones', filasPub, { upsert: true, conflicto: 'cliente_id,pid' });
      // Lo que ya no está en el tablero deja de verse (no se borra: guarda sus aprobaciones y comentarios).
      const quedan = new Set(filasPub.map(f => f.pid));
      const sobran = [...serv.values()].filter(r => P.mesesTablero.includes(r.mes) && r.visible && !quedan.has(r.pid)).map(r => r.pid);
      if (sobran.length) await c.actualizar(`publicaciones?cliente_id=eq.${encodeURIComponent(B.client)}&pid=in.(${sobran.join(',')})`, { visible: false });
      const mesesIn = P.mesesTablero.map(m => `"${m}"`).join(',');
      if (P.mesesTablero.length) await c.borrar(`sesiones?cliente_id=eq.${encodeURIComponent(B.client)}&mes=in.(${mesesIn})`);
      if (P.sesiones.length) await c.insertar('sesiones', P.sesiones, { upsert: true, conflicto: 'cliente_id,id' });
      if (P.meses.length) await c.insertar('meses', P.meses, { upsert: true, conflicto: 'cliente_id,mes' });
      // Las facturas en PDF (D-237), en su carpeta privada; los cobros quitados aquí se quitan allí.
      const yaPdf = new Set(await c.listar('facturas', B.client).catch(() => []));
      const filasPago = [];
      for (const { _pdf, ...p } of P.pagos) {
        let pdf = null;
        if (_pdf) {
          const r = await X.idbGet('cfacturas', _pdf).catch(() => null);
          if (r && r.blob) {
            const n = (p.id.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'factura') + '.pdf';
            if (!yaPdf.has(n)) await c.subir('facturas', `${B.client}/${n}`, r.blob, 'application/pdf');
            pdf = `${B.client}/${n}`;
          }
        }
        filasPago.push({ ...p, pdf });
      }
      if (filasPago.length) await c.insertar('pagos', filasPago, { upsert: true, conflicto: 'cliente_id,id' });
      const ids = filasPago.map(p => `"${p.id.replace(/"/g, '')}"`).join(',');
      await c.borrar(`pagos?cliente_id=eq.${encodeURIComponent(B.client)}` + (ids ? `&id=not.in.(${ids})` : ''));
      st.servidor = await leerServidor(B.client); st.clave = B.key; st.firma = ''; st.cambios = null;
      toast(`Enviado a la web del cliente: ${filasPub.filter(f => f.visible).length} publicaciones`);
      return { ok: true, publicaciones: filasPub.filter(f => f.visible).length, imagenes: [...imgs.values()].reduce((n, l) => n + l.length, 0), subidas };
    } catch (e) {
      const m = String(e.message || e);
      toast('No se pudo enviar a la web: ' + m, { error: true });
      return { error: m };
    } finally {
      st.enviando = null; if (I()) { I().renderBar(); pedirRepaso(); }
    }
  }

  // ---------- Diálogos ----------
  function dlgEntrar(paso, correo) {
    const X = I();
    X.showDialog('web', paso === 'codigo'
      ? `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Mira tu correo</h3>
        <form class="form" data-webform="codigo" autocomplete="off"><p class="webp">Si ${esc(correo)} tiene acceso, te llega un código de 6 cifras. Vale 10 minutos.</p>
        <input type="hidden" name="correo" value="${esc(correo)}"><label for="web-cod">Código</label><input id="web-cod" name="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required>
        <p class="ferr" hidden></p><div class="row"><button type="submit" class="btn">Entrar</button></div></form>`
      : `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Web del cliente</h3>
        <form class="form" data-webform="correo" autocomplete="off"><p class="webp">Entra con tu correo para enviar a la web lo que ven tus clientes y leer lo que contestan.</p>
        <label for="web-correo">Correo</label><input id="web-correo" name="correo" type="text" inputmode="email" autocomplete="email" maxlength="120" required>
        <p class="ferr" hidden></p><div class="row"><button type="submit" class="btn">Enviarme el código</button></div></form>`);
  }
  function dlgProblemas(l) {
    I().showDialog('web', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>No se ha enviado</h3>
      <p class="webp">Hay textos que nombran a otro cliente. El cliente lo vería: cámbialos y vuelve a enviar.</p>
      <ul class="webl">${l.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="row"><button type="button" class="btn" data-act="close">Entendido</button></div>`);
  }
  async function alEnviarForm(e) {
    const f = e.target.closest && e.target.closest('form[data-webform]'); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const c = sb(), err = f.querySelector('.ferr'), btn = f.querySelector('button[type=submit]');
    const mal = m => { err.textContent = m; err.hidden = false; btn.disabled = false; };
    if (!c) return mal('La web aún no tiene proyecto.');
    btn.disabled = true; err.hidden = true;
    try {
      if (f.dataset.webform === 'correo') {
        const correo = f.correo.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return mal('Ese correo no parece bien escrito.');
        await c.pedirCodigo(correo); dlgEntrar('codigo', correo);
      } else {
        await c.verificarCodigo(f.correo.value, f.codigo.value);
        I().closeDetail(); st.dueno = null;
        if (!(await esDueno(c))) toast('Has entrado, pero esta cuenta no es la de Kevin en el servidor: pídele a Claude que la marque', { error: true });
        else toast('Has entrado en la web del cliente');
        pedirRepaso();
      }
    } catch (x) { mal(x.message || String(x)); }
  }
  function alClic(e) {
    const b = e.target.closest && e.target.closest('[data-web]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.web;
    if (a === 'entrar') dlgEntrar();
    else if (a === 'enviar') enviar();
    else if (a === 'repasar') { st.error = ''; st.servidor = null; st.firma = ''; pedirRepaso(); }
  }

  let listoP = null;
  const listo = () => listoP || (listoP = new Promise((res, rej) => {
    const t0 = Date.now(), t = setInterval(() => {
      if (window.Supa && I() && I().estilo && I().capFinal && I().mesOtros && I().cob) { clearInterval(t); res(); }
      else if (Date.now() - t0 > 30000) { clearInterval(t); rej(new Error('mesa.js o supa.js sin cargar')); }
    }, 50);
  }));
  let tic = 0;
  M.web = {
    version: VERSION, barra, enviar, paquete, listo,
    estado: () => { const c = sb(); return { proyecto: !!c, sesion: !!(c && c.usuario()), cambios: st.cambios, enviando: !!st.enviando, error: st.error }; },
    entrar: () => dlgEntrar(),
    salir: async () => { const c = sb(); if (c) await c.salir(); st.servidor = null; st.cambios = null; st.dueno = null; if (I()) I().renderBar(); },
    repasar: () => { st.servidor = null; st.firma = ''; return repaso(); },
    _sb: () => sb(),
    _off: () => { OFF.splice(0).forEach(f => f()); clearInterval(tic); clearTimeout(repasoT); },
  };
  listo().then(() => {
    on(document, 'click', alClic, true);
    on(document, 'submit', alEnviarForm, true);
    on(document, 'visibilitychange', () => { if (!document.hidden) { st.servidor = null; pedirRepaso(); } });
    I().estilo('mesa-web-css', ESTILO);
    // Cada 3 s con la pestaña a la vista: si el tablero cambió, se vuelve a contar (solo huellas, sin imágenes).
    tic = setInterval(() => { if (!document.hidden && sb() && I().S) repaso().catch(() => { /* st.error */ }); }, 3000);
    I().renderBar(); pedirRepaso();
  }).catch(() => { (window.MESA_CARGA = window.MESA_CARGA || {}).web = 'fallo'; });
  const ESTILO = `#mesa .webbtn{white-space:nowrap}
#mesa .webbtn.hay{background:var(--acc-soft);color:var(--acc-ink);border-color:transparent}
#mesa .webbtn.mal{color:var(--red)}
#mesa .webp{margin:0 0 12px;color:var(--ink-2);font-size:13px;line-height:1.45}
#mesa .webl{margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.45;color:var(--ink-2)}`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).web = 'ok';
})();
