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
  const lsG = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  // ---------- El proyecto ----------
  // El real se rellena al crearlo (lote 5: su URL y su clave «publishable», públicas por diseño). En una copia de pruebas
  // servida en este Mac (127.0.0.1) manda la que diga `localStorage['mesa-web-proyecto']` y nunca el real; fuera de este Mac, siempre el real.
  const REAL = { url: 'https://ipqeywhhuncpnqkvfxpn.supabase.co', publica: 'sb_publishable_Gqu_MN2jOnjKLp9aYkTjyg_hqWBqZ2E' };
  const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
  function proyecto() {
    if (LOCAL) { try { const p = JSON.parse(localStorage.getItem('mesa-web-proyecto') || 'null'); if (p && p.url && p.publica) return p; } catch (e) { /* sin almacenamiento */ } return null; }
    return REAL.url && REAL.publica ? REAL : null;
  }
  let SB = null;
  function sb() {
    const p = proyecto(); if (!p || !window.Supa) return null;
    if (!SB || SB._url !== p.url) {
      try { SB = window.Supa.crear({ url: p.url, publica: p.publica, clave: 'mesa-web-' + p.url.split('//')[1].split('.')[0] }); SB._url = p.url; }
      catch (e) { return null; }
      SB.alCambiar(() => { st.dueno = null; st.servidor = null; st.cambios = null; conv.clear(); RESP.clear(); HECHAS.clear(); if (I() && I().render) I().render(); pedirRepaso(); });
    }
    return SB;
  }

  // ---------- Lo que ve el cliente, publicación a publicación ----------
  const TIPO = { 'Foto': 'foto', 'Carrusel': 'carrusel', 'Reel': 'reel', 'Collab Reel': 'collab_reel', 'Trial Reel': 'trial_reel' };
  const ESTADO = { empezar: 'preparando', captions: 'preparando', aprobar: 'por_aprobar', noaprobado: 'cambios', aprobado: 'aprobada', programado: 'programada', publicado: 'publicada' };
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const sha = async t => hex(await crypto.subtle.digest('SHA-256', typeof t === 'string' ? new TextEncoder().encode(t) : t));
  const PID = new Map();
  const pidDe = async (cli, id) => { const k = cli + '|' + id; if (!PID.has(k)) PID.set(k, (await sha(k)).slice(0, 16)); return PID.get(k); };
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
  // La cuenta de la agencia no es «otro cliente»: sus créditos (@uribe.visuals) pueden salir en un caption (lección 84).
  const AGENCIA = ['uribe'];
  async function paquete(B0) {
    const X = I(), B = B0 || X.S;
    if (!B) return { error: 'sin tablero abierto' };
    const cli = B.client, c = X.CL.find(x => x.id === cli) || {};
    const pubs = await filas(B);
    const meses = [...new Set([...pubs.map(p => p.fila.mes), ...X.boardMonths ? (X.boardMonths(B) || []) : []].filter(Boolean))].sort();
    const previo = meses.length ? X.addMonths(meses[0], -1) : null;
    const tareas = await X.idbAll('tareas');   // si falla, no se envía (una lectura fallida no es «sin sesiones»: lección 94)
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
    const cob = X.cob, H = X.hoy(), vivos = cob ? cob.vivos(cli) : [];
    // solo lo que enseña «Tus pagos»: pendientes, retrasados y cobrados; nunca un borrador sin emitir (D-237)
    const pagos = vivos.filter(r => +r.importe >= 0 && ['pendiente', 'retrasada', 'cobrada'].includes(cob.estado(r, H).k)).map(r => ({ cliente_id: cli, id: String(r.id).slice(0, 80), periodo: /^\d{4}-\d{2}$/.test(r.periodo || '') ? r.periodo : null,
      concepto: r.concepto ? String(r.concepto).slice(0, 120) : null, importe_cent: Math.round((+r.importe || 0) * 100), factura: r.factura ? String(r.factura).slice(0, 40) : null,
      emitida: r.emitida || null, vence: r.vence || null, cobrada: r.cobrada || null, _pdf: r.pdf || null }));
    const q = cob ? cob.cuota(c) : null, prox = cob && q ? cob.proxima(cli) : null;
    const cliente = { id: cli, nombre: String(c.name || cli).slice(0, 80), handle: c.handle ? String(c.handle).replace(/^@/, '').slice(0, 40) : null,
      cuota_cent: q ? Math.round(q.importe * 100) : null, proxima_emision: prox && prox.emitida ? prox.emitida : null, _foto: c.foto || null };
    // Ningún texto que va a la web nombra a otro cliente (lecciones 82 y 84): si no, no se envía.
    const problemas = [], esporadicos = tareas.filter(t => t.tipo === 'esporadico' && !t.pasado && t.txt).map(t => String(t.txt));
    const textos = [...pubs.flatMap(p => [[`«${p.fila.nombre}», nombre`, p.fila.nombre], [`«${p.fila.nombre}», caption`, p.fila.caption]]),
      ...ses.map(x => [`sesión «${x.nombre}»`, x.nombre]), ...pagos.map(p => [`cobro ${p.factura || p.periodo || ''}, concepto`, p.concepto || ''])];
    mesesInfo.forEach(r => { (r.porque && r.porque.partes || []).forEach((q, i) => textos.push([`por qué de ${r.mes}`, q.t], [`por qué de ${r.mes}`, q.x]));
      if (r.resumen) { (r.resumen.posts || []).forEach(q => textos.push([`resumen de ${r.mes}`, q.nombre])); textos.push([`resumen de ${r.mes}`, r.resumen.frase || '']); } });
    // La propia agencia no pasa esta comprobación: sus captions enseñan trabajos para clientes y su web solo la ve Kevin (D-245).
    if (!AGENCIA.includes(cli)) X.mesOtros(cli, textos, m => problemas.push(m), esporadicos, AGENCIA.filter(a => a !== cli));
    const mesesQuitar = [previo, ...meses].filter(m => m && !mesesInfo.some(r => r.mes === m));
    return { cliente, publicaciones: pubs, sesiones: ses, meses: mesesInfo, mesesTablero: meses, mesesQuitar, pagos, problemas };
  }

  // ---------- Estado de la barra ----------
  const st = { clave: '', servidor: null, cambios: null, enviando: null, error: '', dueno: null, firma: '', leyendo: null, extra: null, extraT: 0 };
  const IMG = new Map();   // «pid|firma de sus fotos» → sus imágenes ya enviadas en esta pestaña: un cambio de caption no las rehace
  async function leerServidor(cli, B) {
    const c = sb(); if (!c || !c.usuario()) return null;
    const ms = B ? [...new Set([...(I().boardMonths ? I().boardMonths(B) || [] : []), ...B.slots.map(s => mesNatural(s.date)).filter(Boolean)])] : [];
    const l = await c.leer(`publicaciones?cliente_id=eq.${encodeURIComponent(cli)}&select=pid,version,estado,orden,visible,mes,nombre,fecha,sin_hora,caption,tipo,imagenes` + (ms.length ? `&mes=in.(${ms.map(m => `"${m}"`).join(',')})` : ''));
    return new Map((l || []).map(r => [r.pid, r]));
  }
  const igual = (p, r) => r && r.version === p.version && r.estado === p.fila.estado && r.orden === p.fila.orden && r.visible === p.fila.visible && r.mes === p.fila.mes;
  // Las del servidor que se ven y ya no están en este tablero, salvo las de otro tablero del mismo cliente (un ciclo que
  // comparte mes, D-153): esas son de aquel tablero.
  async function sobranDe(B, pubs, serv) {
    const quedan = new Set(pubs.map(p => p.pid)), cand = [...serv.values()].filter(r => r.visible && !quedan.has(r.pid));
    if (!cand.length) return [];
    const otros = new Set(), cli = b => b.client || (String(b.key || '').match(/^(.+)-\d{4}-\d{2}$/) || [])[1];
    for (const b of (await I().idbAll('boards')) || []) if (b && b.key !== B.key && cli(b) === B.client) for (const s of b.slots || []) otros.add(await pidDe(B.client, s.id));
    return cand.filter(r => !otros.has(r.pid)).map(r => r.pid);
  }
  // Lo que no es una publicación (cliente, sesiones, porqué y resumen, cobros) cuenta como un cambio si no es lo último
  // que se envió desde aquí (su huella, por proyecto y tablero).
  const claveHuella = B => { const c = sb(); return 'mesa-web-huella:' + (c ? c._url : '') + ':' + B.key; };
  const huellaExtra = P => sha(JSON.stringify([P.cliente, P.sesiones, P.meses, P.mesesQuitar, P.pagos]));
  async function repaso(todo) {
    const X = I(), B = X && X.S, c = sb();
    if (!B || !c || !c.usuario() || st.enviando || X.locked) return;
    if (st.clave !== B.key) { st.clave = B.key; st.servidor = null; st.cambios = null; st.firma = ''; st.extra = null; leerConversacion().catch(() => null); }
    try {
      if (st.dueno == null) { await esDueno(c); X.renderBar(); }
      if (st.dueno === false) return;   // otra cuenta: la barra lo dice y no ofrece nada
      const pubs = await filas(B), firma = pubs.map(p => p.pid + p.version + p.fila.estado + p.fila.orden + p.fila.visible).join('|');
      if (!st.servidor) {
        st.servidor = await leerServidor(B.client, B); st.firma = '';
        const d = X.root().querySelector('.detail'); if (d && !d.hidden && d.querySelector('.webdel[data-sin-serv]')) pintarDetalle(d);
      }
      if (I().S !== B) return;
      if (todo || st.extra == null || Date.now() - st.extraT > 30000) {   // leer tareas, informe y cobros, cada 30 s como mucho
        st.extraT = Date.now();
        const P = await paquete(B); if (I().S !== B) return;
        const e = P.error ? 0 : (await huellaExtra(P)) === lsG(claveHuella(B)) ? 0 : 1;
        if (e !== st.extra) { st.extra = e; st.firma = ''; }
      }
      const errorAntes = st.error; st.error = '';
      if (firma === st.firma && st.cambios != null) { if (errorAntes) X.renderBar(); return; }
      const sobran = await sobranDe(B, pubs, st.servidor); if (I().S !== B) return;
      st.firma = firma;
      const n = pubs.filter(p => !igual(p, st.servidor.get(p.pid))).length + sobran.length + st.extra;
      if (n !== st.cambios || errorAntes) { st.cambios = n; X.renderBar(); }
    } catch (e) { const m = String(e.message || e); if (m !== st.error) { st.error = m; X.renderBar(); } }
  }
  let repasoT = 0;
  const pedirRepaso = () => { clearTimeout(repasoT); repasoT = setTimeout(() => { repaso(true).catch(() => { /* lo dice st.error */ }); }, 300); };

  function barra() {
    const c = sb(), X = I();
    if (!c || !X || !X.S || X.root().classList.contains('client')) return '';   // sin proyecto, o en «Vista cliente» (D-154)
    if (!c.usuario()) return '<button type="button" class="mchip webbtn" data-web="entrar" title="Entra con tu correo para enviar a la web lo que ve el cliente"><span>Web del cliente</span></button>';
    if (st.dueno === false) return '<button type="button" class="mchip webbtn mal" data-web="salir" title="Has entrado con una cuenta que no es la de Kevin en el servidor. Pulsa para salir"><span>Web: otra cuenta</span></button>';
    if (st.enviando) return `<span class="mchip webbtn quieto" aria-live="polite" aria-busy="true"><span><span class="w2">Enviando a la web…</span><span class="w2n">Web…</span>${st.enviando.total ? ` ${st.enviando.hechos}/${st.enviando.total}` : ''}</span></span>`;
    if (st.error) return `<button type="button" class="mchip webbtn mal" data-web="repasar" title="${esc(st.error)}. Pulsa para volver a intentarlo"><span>Web: <span class="w2">no se pudo leer</span><span class="w2n">error</span></span></button>`;
    if (st.cambios == null) return '<span class="mchip webbtn quieto" aria-busy="true"><span>Web: leyendo…</span></span>';
    if (!st.cambios) return '<button type="button" class="mchip ghost webbtn" data-web="enviar" title="La web del cliente enseña lo mismo que este tablero. Pulsa para comprobarlo y enviar otra vez"><span>Web: al día</span></button>';
    return `<button type="button" class="mchip webbtn hay" data-web="enviar" title="Envía a la web del cliente lo que ha cambiado en este tablero (${st.cambios} ${st.cambios === 1 ? 'cambio' : 'cambios'})"><span>Web: ${st.cambios}<span class="w1"> ${st.cambios === 1 ? 'cambio' : 'cambios'}</span><span class="w2"> sin enviar</span><span class="w1"> · Enviar</span></span></button>`;
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
    if (X.locked) { toast('Esta pestaña está en pausa: recárgala para enviar a la web', { error: true }); return { error: 'esta pestaña está en pausa' }; }
    const cli = B.client, ce = encodeURIComponent(cli);
    // Todo va al tablero con el que se pulsó «Enviar»: si se abre otro a mitad, se para (lo ya enviado queda bien enviado).
    const sigue = () => { if (I().S !== B) throw new Error('cambiaste de tablero mientras se enviaba: vuelve a enviar este'); };
    st.enviando = { hechos: 0, total: 0 }; X.renderBar();   // un envío a la vez desde el primer clic
    try {
      if (!(await esDueno(c))) throw new Error('esta cuenta no es la de Kevin en el servidor');
      await leerConversacion().catch(() => null); sigue();   // antes de enviar, lo que ha decidido el cliente (y su marca de leído)
      if (M.flush) await M.flush(); sigue();
      const P = await paquete(B); sigue();
      if (P.error) throw new Error(P.error);
      if (P.problemas.length) { dlgProblemas(P.problemas); return { error: 'nombra a otro cliente', problemas: P.problemas }; }
      const serv = st.servidor && st.clave === B.key ? st.servidor : await leerServidor(cli, B); sigue();
      const cambian = P.publicaciones.filter(p => p.fila.visible && (!serv.get(p.pid) || serv.get(p.pid).version !== p.version));
      st.enviando = { hechos: 0, total: cambian.length }; X.renderBar();
      // Foto del perfil del cliente y sus imágenes, sin repetir las que ya están (las rutas son la huella del contenido).
      const ya = new Set(await c.listar('fotos', cli).catch(() => []));
      let subidas = 0;
      const subir = async (ruta, blob) => { const n = ruta.split('/').pop(); if (ya.has(n)) return; await c.subir('fotos', ruta, blob, 'image/jpeg'); ya.add(n); subidas++; };
      let foto = null;
      if (P.cliente._foto && M.files) {
        try {
          const blob = await X.getBlob(P.cliente._foto), f = M.files[P.cliente._foto] || {};
          const g = await lienzoA(blob, null, f.w || 400, f.h || 400, 240), h = await sha(await g.blob.arrayBuffer());
          foto = `${cli}/${h}.jpg`; await subir(foto, g.blob);
        } catch (e) { foto = null; }   // sin foto de perfil, el portal pone sus iniciales
      }
      sigue();
      const { _foto, ...cliente } = P.cliente;
      await c.insertar('clientes', [{ ...cliente, foto }], { upsert: true, conflicto: 'id' });
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
        sigue();
      }
      const filasPub = P.publicaciones.map(p => ({ ...p.fila, pid: p.pid, version: p.version,
        imagenes: imgs.get(p.pid) || (serv.get(p.pid) && serv.get(p.pid).version === p.version ? serv.get(p.pid).imagenes : []) }));
      if (filasPub.length) await c.insertar('publicaciones', filasPub, { upsert: true, conflicto: 'cliente_id,pid' });
      // Lo que ya no está en el tablero deja de verse (no se borra: guarda sus aprobaciones y comentarios).
      const sobran = await sobranDe(B, P.publicaciones, serv);
      if (sobran.length) await c.actualizar(`publicaciones?cliente_id=eq.${ce}&pid=in.(${sobran.join(',')})`, { visible: false });
      // Sesiones: primero las de ahora y después se quitan las que ya no están (si algo falla a medias, no se queda sin ninguna).
      const enMeses = m => m.length ? `&mes=in.(${m.map(x => `"${x}"`).join(',')})` : '';
      if (P.sesiones.length) await c.insertar('sesiones', P.sesiones, { upsert: true, conflicto: 'cliente_id,id' });
      if (P.mesesTablero.length) await c.borrar(`sesiones?cliente_id=eq.${ce}${enMeses(P.mesesTablero)}` + (P.sesiones.length ? `&id=not.in.(${P.sesiones.map(x => `"${x.id.replace(/"/g, '')}"`).join(',')})` : ''));
      if (P.meses.length) await c.insertar('meses', P.meses, { upsert: true, conflicto: 'cliente_id,mes' });
      if (P.mesesQuitar.length) await c.borrar(`meses?cliente_id=eq.${ce}${enMeses(P.mesesQuitar)}`);
      // Las facturas en PDF (D-237), en su carpeta privada y nombradas por su huella: un PDF cambiado es otro archivo.
      const yaPdf = new Set(await c.listar('facturas', cli).catch(() => []));
      const filasPago = [], usados = new Set();
      for (const { _pdf, ...p } of P.pagos) {
        let pdf = null;
        if (_pdf) {
          const r = await X.idbGet('cfacturas', _pdf).catch(() => null);
          if (r && r.blob) {
            const n = (await sha(await r.blob.arrayBuffer())) + '.pdf';
            if (!yaPdf.has(n)) { await c.subir('facturas', `${cli}/${n}`, r.blob, 'application/pdf'); yaPdf.add(n); }
            pdf = `${cli}/${n}`; usados.add(n);
          }
        }
        filasPago.push({ ...p, pdf });
      }
      if (filasPago.length) await c.insertar('pagos', filasPago, { upsert: true, conflicto: 'cliente_id,id' });
      const ids = filasPago.map(p => `"${p.id.replace(/"/g, '')}"`).join(',');
      await c.borrar(`pagos?cliente_id=eq.${ce}` + (ids ? `&id=not.in.(${ids})` : ''));
      const sueltos = [...yaPdf].filter(n => !usados.has(n)).map(n => `${cli}/${n}`);
      if (sueltos.length) await c.quitar('facturas', sueltos).catch(() => null);   // los que ya no son de ningún cobro
      lsS(claveHuella(B), await huellaExtra(P));
      st.servidor = await leerServidor(cli, B); st.clave = B.key; st.firma = ''; st.cambios = null; st.extra = 0; st.extraT = Date.now(); st.error = '';
      toast(`Enviado a la web del cliente: ${filasPub.filter(f => f.visible).length} publicaciones`);
      return { ok: true, publicaciones: filasPub.filter(f => f.visible).length, ocultas: sobran.length, imagenes: [...imgs.values()].reduce((n, l) => n + l.length, 0), subidas };
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
        <p class="ferr" hidden></p><div class="row"><button type="button" class="btn2" data-web="entrar">Usar otro correo</button><button type="submit" class="btn">Entrar</button></div></form>`
      : `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Web del cliente</h3>
        <form class="form" data-webform="correo" autocomplete="off"><p class="webp">Entra con tu correo para enviar a la web lo que ven tus clientes y leer lo que contestan.</p>
        <label for="web-correo">Correo</label><input id="web-correo" name="correo" type="text" inputmode="email" autocomplete="email" maxlength="120" required>
        <p class="ferr" hidden></p><div class="row"><button type="submit" class="btn">Enviarme el código</button></div></form>`);
  }
  function dlgProblemas(l) {
    const corto = x => String(x).replace(/; el cliente lo ve.*$/, '');
    I().showDialog('web', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>No se ha enviado</h3>
      <p class="webp">Hay textos que nombran a otro cliente. El cliente lo vería: dilo sin su nombre (por ejemplo, «una colaboración») y vuelve a enviar.</p>
      <ul class="webl">${l.slice(0, 12).map(x => `<li>${esc(corto(x))}</li>`).join('')}${l.length > 12 ? `<li>y ${l.length - 12} más</li>` : ''}</ul>
      <div class="form"><div class="row"><button type="button" class="btn" data-act="close">Entendido</button></div></div>`);
  }
  async function alEnviarForm(e) {
    const f = e.target.closest && e.target.closest('form[data-webform]'); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const c = sb(), err = f.querySelector('.ferr'), btn = f.querySelector('button[type=submit]');
    const mal = m => { m = String(m || 'No se pudo').trim(); m = m[0].toUpperCase() + m.slice(1); if (!/[.!?]$/.test(m)) m += '.'; err.textContent = m; err.hidden = false; btn.disabled = false; };
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
    else if (a === 'salir') M.web.salir();
    else if (a === 'repasar') { st.error = ''; st.servidor = null; st.firma = ''; st.extra = null; st.cambios = null; I().renderBar(); pedirRepaso(); }
  }

  // ---------- Lote 4: lo que contestan los clientes (D-244) ----------
  // Las decisiones del cliente ponen el estado como lo pondría Kevin (Aprobado; No aprobado con su motivo en el servidor;
  // retirada, el de sus datos), sin ser un paso de su ⌘Z (lección 87) y solo si son de la versión de ahora. Los comentarios
  // se leen del servidor y se pintan con textContent; Kevin contesta y los marca resueltos desde la ventana de la publicación.
  const C_APR = 'id,cliente_id,pid,version,decision,motivo,diapositiva,autor_nombre,hora';
  const C_COM = 'id,cliente_id,pid,version,diapositiva,texto,autor_nombre,de_kevin,hora,resuelto';
  const conv = new Map();   // tablero → { clave, aprs, coms, visto, pidDe: Map slotId→pid, version: Map pid→versión local, slot: Map pid→publicación }
  const HECHAS = new Set();  // decisiones ya tratadas en esta pestaña: no se vuelven a aplicar si no se pudo guardar lo leído
  const ESTV = { aprobada: 'aprobado', cambios: 'noaprobado' };
  const borradores = new Map(), abiertos = new Set(); let foco = null;
  // Los pid de los otros tableros del mismo cliente: lo nuevo de ellos se trata al abrirlos, y la marca de leído no los pasa.
  async function pidsOtros(B) {
    const out = [], cli = b => b.client || (String(b.key || '').match(/^(.+)-\d{4}-\d{2}$/) || [])[1];
    for (const b of (await I().idbAll('boards')) || []) if (b && b.key !== B.key && cli(b) === B.client) for (const s of b.slots || []) out.push(await pidDe(B.client, s.id));
    return [...new Set(out)];
  }
  async function leerConversacion(avisar = true) {
    const X = I(), B = X && X.S, c = sb(); if (!B || !c || !c.usuario() || X.locked) return null;
    if (!(await esDueno(c))) return null;
    const sigue = () => X.S === B && !X.locked;
    const pubs = await filas(B); if (!sigue()) return null;   // otro tablero mientras se calculaba: nada se aplica a otro
    const cli = encodeURIComponent(B.client), pids = pubs.map(p => p.pid), antes = conv.get(B.key);
    const C0 = { clave: B.key, aprs: [], coms: [], visto: null, pidDe: new Map(pubs.map(p => [p.s.id, p.pid])), version: new Map(pubs.map(p => [p.pid, p.version])), slot: new Map(pubs.map(p => [p.pid, p.s])) };
    if (pids.length) {
      // solo lo de las publicaciones de este tablero, lo más nuevo primero (el servidor da 1000 filas como mucho)
      const en = `&pid=in.(${pids.join(',')})`;
      const [aprs, coms, lec] = await Promise.all([c.leer(`aprobaciones?select=${C_APR}&cliente_id=eq.${cli}${en}&order=hora.desc&limit=1000`),
        c.leer(`comentarios?select=${C_COM}&cliente_id=eq.${cli}${en}&order=hora.desc&limit=1000`), c.leer(`lecturas?select=visto_hasta&cliente_id=eq.${cli}`)]);
      if (!sigue()) return null;
      C0.aprs = (aprs || []).reverse(); C0.coms = (coms || []).reverse(); C0.visto = (lec && lec[0] && lec[0].visto_hasta) || null;
    }
    conv.set(B.key, C0);
    // la decisión nueva de cada publicación: solo si es de la versión de ahora y la Mesa la tiene «En revisión» o en el
    // estado que puso la decisión anterior del cliente; si Kevin la movió después (Programado, Cancelado…), no se toca
    const porPid = new Map(); C0.aprs.forEach(a => { if (!porPid.has(a.pid)) porPid.set(a.pid, []); porPid.get(a.pid).push(a); });
    const aplicar = [], cuenta = { aprobada: 0, cambios: 0, retirada: 0 }, sinTocar = [], fallan = [];
    for (const [pid, l] of porPid) {
      const ult = l[l.length - 1], s = C0.slot.get(pid);
      if (!s || HECHAS.has(ult.id) || (C0.visto && ult.hora <= C0.visto)) continue;
      HECHAS.add(ult.id);
      if (C0.version.get(pid) !== ult.version) continue;   // de una versión anterior: sale en la ventana, no cambia nada
      const prev = l.slice(0, -1).reverse().find(a => a.version === ult.version), ePrev = prev ? ESTV[prev.decision] || '' : '';
      const v = ESTV[ult.decision] || '', est = X.estadoDe(s);
      if (v && est === v) continue;
      const puede = ult.decision === 'retirada' ? !!ePrev && est === ePrev : est === 'aprobar' || (!!ePrev && est === ePrev);
      if (puede) aplicar.push({ s, v, a: ult }); else if (!(ult.decision === 'retirada' && est === 'aprobar')) sinTocar.push({ s, a: ult });
    }
    if (aplicar.length) {
      const r = X.estadoWeb(aplicar.map(x => [x.s.id, x.v]));
      r.forEach((why, i) => { if (why) { fallan.push(aplicar[i].a); HECHAS.delete(aplicar[i].a.id); } else cuenta[aplicar[i].a.decision]++; });
    }
    // la marca de leído (por cliente) llega hasta justo antes de lo primero sin tratar: lo nuevo de otro tablero o lo que falló
    try {
      if (pids.length) {
        const otros = await pidsOtros(B); if (!sigue()) return null;
        let lim = fallan.map(a => a.hora).sort()[0] || null;
        if (otros.length) {
          const fuera = `&pid=in.(${otros.join(',')})` + (C0.visto ? `&hora=gt.${encodeURIComponent(C0.visto)}` : '');
          const [oa, oc] = await Promise.all([c.leer(`aprobaciones?select=hora&cliente_id=eq.${cli}${fuera}&order=hora.asc&limit=1`),
            c.leer(`comentarios?select=hora&cliente_id=eq.${cli}&de_kevin=is.false${fuera}&order=hora.asc&limit=1`)]);
          [oa && oa[0] && oa[0].hora, oc && oc[0] && oc[0].hora].filter(Boolean).forEach(h => { if (!lim || h < lim) lim = h; });
        }
        const max = [...C0.aprs, ...C0.coms].reduce((m, x) => ((!lim || x.hora < lim) && x.hora > m ? x.hora : m), C0.visto || '');
        if (max && max !== C0.visto) { await c.insertar('lecturas', [{ cliente_id: B.client, visto_hasta: max }], { upsert: true, conflicto: 'user_id,cliente_id' }); C0.visto = max; olvidarRespuestas(B.client); }
      }
    } catch (e) { /* se vuelve a intentar en la siguiente lectura; lo ya aplicado no se repite (HECHAS) */ }
    const n = cuenta.aprobada + cuenta.cambios + cuenta.retirada;
    if ((n || sinTocar.length) && avisar && !X.root().classList.contains('client')) {
      const nom = (X.CL.find(x => x.id === B.client) || {}).name || B.client, pl = (k, u, p) => (k === 1 ? `1 ${u}` : `${k} ${p}`);
      const hechas = [cuenta.aprobada && pl(cuenta.aprobada, 'aprobada', 'aprobadas'), cuenta.cambios && pl(cuenta.cambios, 'con cambios pedidos', 'con cambios pedidos'), cuenta.retirada && pl(cuenta.retirada, 'decisión retirada', 'decisiones retiradas')].filter(Boolean);
      const s0 = sinTocar[0] && sinTocar[0].s, que = { aprobada: 'la aprobó', cambios: 'pidió cambios', retirada: 'retiró su decisión' };
      const no = sinTocar.length === 1 ? `«${X.shortLabel(s0.name, s0.type)}»: ${que[sinTocar[0].a.decision]} en su web, pero ya la habías movido; no la he cambiado`
        : sinTocar.length ? `${sinTocar.length} decisiones de su web sobre publicaciones que ya habías movido; no las he cambiado` : '';
      toast(`${nom}: ` + [hechas.length ? hechas.join(', ') + ' desde su web' : '', no].filter(Boolean).join('. '));
    }
    if (!antes || antes.clave !== C0.clave || JSON.stringify([antes.aprs, antes.coms]) !== JSON.stringify([C0.aprs, C0.coms]) || n) {
      X.render();
      const d = X.root().querySelector('.detail');
      if (d && !d.hidden && d.dataset.slot && C0.pidDe.has(d.dataset.slot) && !d.dataset.dlg) X.refreshDetail();
    }
    return C0;
  }
  const actual = () => { const X = I(), B = X && X.S, C0 = B && conv.get(B.key); return C0 && C0.clave === B.key ? C0 : null; };
  const sinLeer = (C0, pid) => { const l = lsG('mesa-web-leido:' + pid); return C0.coms.filter(x => x.pid === pid && !x.de_kevin && !x.resuelto && x.hora > l).length; };
  // La marca de la casilla: comentarios del cliente sin leer (solo un número; el texto nunca entra en el HTML).
  function marca(s) {
    const X = I(), c = sb(); if (!X || !X.S || !c || !c.usuario() || st.dueno === false || X.root().classList.contains('client')) return '';
    const C0 = actual(), pid = C0 && C0.pidDe.get(s.id); if (!pid) return '';
    const n = sinLeer(C0, pid); if (!n) return '';
    return `<span class="webmk" title="${n === 1 ? '1 comentario del cliente sin leer' : n + ' comentarios del cliente sin leer'}">${ICO_MSG}${n}</span>`;
  }
  const ICO_MSG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
  function detalle(s) {
    const X = I(), c = sb(); if (!c || !c.usuario() || st.dueno === false || !X.S || X.root().classList.contains('client')) return '';
    return `<section class="webdel" data-web-slot="${esc(s.id)}" aria-label="Del cliente"></section>`;
  }
  function nodo(tag, at, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(at || {})) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : String(v)); }
    for (const x of kids.flat()) if (x != null && x !== false) el.append(x.nodeType ? x : document.createTextNode(String(x)));
    return el;
  }
  const cuando = iso => { const X = I(), d = X.localDay(iso), h = X.localTime(iso); return (d === X.hoy() ? 'hoy' : X.fmtDate(d)) + (h ? ' · ' + h : ''); };
  function pintarDetalle(d) {
    const sec = d && d.querySelector('.webdel'); if (!sec) return;
    const X = I(), B = X.S, id = sec.dataset.webSlot, C0 = actual(), pid = C0 && C0.pidDe.get(id);
    if (!C0) { sec.replaceChildren(nodo('h4', { class: 'webh', text: 'Del cliente' }), nodo('p', { class: 'webp', text: 'Leyendo lo que ha contestado…' })); leerConversacion().catch(() => {}); return; }
    const vAhora = C0.version.get(pid), serv = st.servidor && st.servidor.get(pid);
    sec.toggleAttribute('data-sin-serv', !serv);   // se repinta cuando llega lo del servidor
    const aprs = C0.aprs.filter(a => a.pid === pid), coms = C0.coms.filter(x => x.pid === pid), ult = aprs[aprs.length - 1];
    const sinL = sinLeer(C0, pid);
    const items = [...coms.map(x => ({ t: x.hora, x })), ...aprs.filter(a => a.decision === 'cambios').map(a => ({ t: a.hora, a }))].sort((p, q) => p.t.localeCompare(q.t));
    const lista = nodo('ol', { class: 'webl' }, items.map(({ x, a }) => {
      const r = x || a, vieja = r.version !== vAhora, res = !!(x && x.resuelto);
      return nodo('li', { class: 'webcm' + (x && x.de_kevin ? ' kv' : '') + (vieja || res ? ' res' : '') },
        nodo('span', { class: 'webq' }, nodo('b', { text: x && x.de_kevin ? 'Tú' : r.autor_nombre }), ' · ' + cuando(r.hora) + (a ? ' · pidió cambios' : '') + (vieja ? ' · de una versión anterior' : '') + (res ? ' · resuelto' : '')),
        r.diapositiva ? nodo('span', { class: 'websl', text: 'Diapositiva ' + r.diapositiva }) : null,
        nodo('p', { text: x ? x.texto : a.motivo }),
        x && !x.de_kevin && !x.resuelto ? nodo('button', { type: 'button', class: 'lnk webres', text: 'Marcar como resuelto', onclick: e => resolver(x, e.currentTarget, d) }) : null);
    }));
    const empieza = !items.length;   // sin conversación, Kevin la empieza
    const ta = nodo('textarea', { class: 'webta', rows: '2', placeholder: empieza ? 'Escribe al cliente…' : 'Responder al cliente…', 'aria-label': empieza ? 'Escribir al cliente' : 'Responder al cliente', maxlength: '2000' });
    ta.value = borradores.get(pid) || '';
    const env = nodo('button', { type: 'button', class: 'btn2 webenv', text: empieza ? 'Enviar' : 'Responder', disabled: !ta.value.trim() });
    const err = nodo('p', { class: 'ferr', hidden: true });
    ta.addEventListener('input', () => { borradores.set(pid, ta.value); env.disabled = !ta.value.trim(); });
    ta.addEventListener('focus', () => { foco = pid; });
    ta.addEventListener('blur', e => { if (e.relatedTarget) foco = null; });
    env.addEventListener('click', async () => {
      const t = ta.value.trim(); if (!t || !serv) return; env.disabled = true; err.hidden = true;
      try {
        await sb().insertar('comentarios', [{ cliente_id: B.client, pid, version: serv.version, texto: t }]);
        borradores.delete(pid); ta.value = ''; foco = pid;
        await leerConversacion(false); pintarDetalle(d);   // su respuesta a la vista enseguida, con el foco en el campo
      } catch (e) { err.textContent = 'No se pudo enviar: ' + (e.message || e); err.hidden = false; env.disabled = false; }
    });
    // la última decisión arriba, salvo «pidió cambios», que ya va en la lista con su motivo
    const estado = ult && ult.decision !== 'cambios' ? nodo('p', { class: 'webp' }, nodo('b', { text: ult.autor_nombre }), ' ' + ({ aprobada: 'la aprobó', retirada: 'retiró su decisión' }[ult.decision]) + ' · ' + cuando(ult.hora) + (ult.version !== vAhora ? ' · era una versión anterior' : '')) : null;
    // sin conversación, una línea: el cuadro de escribir sale al pedirlo (o si ya había un borrador)
    const abierto = items.length || ult || ta.value || abiertos.has(pid);
    if (!abierto) {
      sec.classList.add('vacia');
      sec.replaceChildren(...[nodo('h4', { class: 'webh' }, 'Del cliente', nodo('span', { class: 'webq', text: 'Aún no ha dicho nada' })),
        serv ? nodo('button', { type: 'button', class: 'lnk webabrir', text: 'Escribir al cliente', onclick: () => { abiertos.add(pid); foco = pid; pintarDetalle(d); } }) : null].filter(Boolean));
      return;
    }
    sec.classList.remove('vacia');
    sec.replaceChildren(...[nodo('h4', { class: 'webh' }, 'Del cliente', sinL ? nodo('span', { class: 'webn', text: sinL === 1 ? '1 nueva' : sinL + ' nuevas' }) : null), estado,
      items.length ? lista : null,
      serv ? nodo('div', { class: 'webesc' }, ta, env) : nodo('p', { class: 'webp', text: 'Envía esta publicación a la web para poder escribir aquí.' }), err].filter(Boolean));
    if (items.length) lista.scrollTop = lista.scrollHeight;   // lo último, a la vista
    if (foco === pid) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); }
    const ult2 = coms.reduce((m, x) => (x.hora > m ? x.hora : m), '');
    if (ult2 && ult2 > lsG('mesa-web-leido:' + pid)) { lsS('mesa-web-leido:' + pid, ult2); setTimeout(() => X.renderFeed && X.renderFeed(), 0); }
  }
  async function resolver(x, b, d) {
    b.disabled = true;
    try {
      await sb().actualizar(`comentarios?id=eq.${encodeURIComponent(x.id)}`, { resuelto: new Date().toISOString() });
      await leerConversacion(false); pintarDetalle(d);
      const sig = d.querySelector('.webres') || d.querySelector('.webta'); if (sig) sig.focus({ preventScroll: true });   // el foco no se va detrás del diálogo
    } catch (e) { b.disabled = false; toast('No se pudo marcar como resuelto: ' + (e.message || e), { error: true }); }
  }
  // ---------- «Ha contestado» en la página personal (D-244) ----------
  // Lo que los clientes han dicho desde su web y Kevin aún no ha visto (posterior a su marca de leído de ese cliente): la página
  // personal lo pone en «Esperando al cliente». Se lee cada 2 minutos; al abrir el tablero del cliente queda leído.
  const RESP = new Map();   // 'cliente|slotId' → 'aprobó' · 'pidió cambios' · 'retiró su decisión' · 'ha comentado'
  function olvidarRespuestas(cli) {
    let n = 0; for (const k of [...RESP.keys()]) if (k.startsWith(cli + '|')) { RESP.delete(k); n++; }
    if (n && M.personal && M.personal.abierta && M.personal.abierta()) M.personal.render();
  }
  async function leerRespuestas() {
    const X = I(), c = sb(); if (!X || !c || !c.usuario() || X.locked) return;
    if (!(await esDueno(c))) return;
    const desde = new Date(Date.now() - 60 * 864e5).toISOString();
    const [aprs, coms, lec] = await Promise.all([c.leer(`aprobaciones?select=cliente_id,pid,version,decision,hora&hora=gt.${desde}&order=hora.asc`),
      c.leer(`comentarios?select=cliente_id,pid,hora&de_kevin=is.false&resuelto=is.null&hora=gt.${desde}&order=hora.asc`), c.leer('lecturas?select=cliente_id,visto_hasta')]);
    const visto = new Map((lec || []).map(r => [r.cliente_id, r.visto_hasta]));
    const nuevo = new Map();   // 'cli|pid' → la última cosa nueva
    for (const a of aprs || []) if (!visto.get(a.cliente_id) || a.hora > visto.get(a.cliente_id)) nuevo.set(a.cliente_id + '|' + a.pid, { ...a, dec: true });
    for (const x of coms || []) { const k = x.cliente_id + '|' + x.pid, o = nuevo.get(k); if ((!visto.get(x.cliente_id) || x.hora > visto.get(x.cliente_id)) && (!o || x.hora > o.hora)) nuevo.set(k, x); }
    const clis = new Set([...nuevo.values()].map(x => x.cliente_id)), out = new Map();
    if (clis.size) {
      for (const b of (await X.idbAll('boards')) || []) {
        const cli = b && (b.client || (String(b.key || '').match(/^(.+)-\d{4}-\d{2}$/) || [])[1]); if (!clis.has(cli)) continue;
        for (const s of b.slots || []) {
          const x = nuevo.get(cli + '|' + await pidDe(cli, s.id)); if (!x) continue;
          let t = 'ha comentado';
          if (x.dec) { const v = (await fila(s, b, 0).catch(() => null) || {}).version; t = v === x.version ? { aprobada: 'aprobó', cambios: 'pidió cambios', retirada: 'retiró su decisión' }[x.decision] : 'ha contestado'; }
          out.set(cli + '|' + s.id, t);
        }
      }
    }
    if (JSON.stringify([...out]) === JSON.stringify([...RESP])) return;
    RESP.clear(); out.forEach((v, k) => RESP.set(k, v));
    if (M.personal && M.personal.abierta && M.personal.abierta()) M.personal.render();
  }
  const contestado = (cli, id) => RESP.get(cli + '|' + id) || '';
  let listoP = null;
  const listo = () => listoP || (listoP = new Promise((res, rej) => {
    const t0 = Date.now(), t = setInterval(() => {
      if (window.Supa && I() && I().estilo && I().capFinal && I().mesOtros && I().estadoWeb && I().cob) { clearInterval(t); res(); }
      else if (Date.now() - t0 > 30000) { clearInterval(t); rej(new Error('mesa.js o supa.js sin cargar')); }
    }, 50);
  }));
  let tic = 0, tic2 = 0;
  M.web = {
    version: VERSION, barra, enviar, paquete, listo, marca, detalle, pintarDetalle, leer: leerConversacion, contestado, leerRespuestas,
    estado: () => { const c = sb(); return { proyecto: !!c, sesion: !!(c && c.usuario()), cambios: st.cambios, enviando: !!st.enviando, error: st.error }; },
    entrar: () => dlgEntrar(),
    salir: async () => { const c = sb(); if (c) await c.salir(); st.servidor = null; st.cambios = null; st.dueno = null; if (I()) I().renderBar(); },
    repasar: () => { st.servidor = null; st.firma = ''; st.extra = null; return repaso(true); },
    _sb: () => sb(),
    _off: () => { OFF.splice(0).forEach(f => f()); clearInterval(tic); clearInterval(tic2); clearTimeout(repasoT); },
  };
  listo().then(() => {
    on(document, 'click', alClic, true);
    on(document, 'submit', alEnviarForm, true);
    on(document, 'visibilitychange', () => { if (!document.hidden) { st.servidor = null; st.firma = ''; st.extra = null; pedirRepaso(); leerConversacion().catch(() => null); leerRespuestas().catch(() => null); } });
    I().estilo('mesa-web-css', ESTILO);
    // Cada 3 s con la pestaña a la vista: si el tablero cambió, se vuelve a contar (solo huellas, sin imágenes).
    tic = setInterval(() => { if (!document.hidden && sb() && I().S) repaso().catch(() => { /* st.error */ }); }, 3000);
    tic2 = setInterval(() => { if (document.hidden || !sb()) return; if (I().S) leerConversacion().catch(() => { /* el siguiente */ }); leerRespuestas().catch(() => { /* el siguiente */ }); }, 120000);
    I().renderBar(); pedirRepaso(); leerRespuestas().catch(() => null);
  }).catch(() => { (window.MESA_CARGA = window.MESA_CARGA || {}).web = 'fallo'; });
  const ESTILO = `#mesa .webbtn{white-space:nowrap;border-color:var(--line);color:var(--ink);font-weight:600}
#mesa.client .webbtn,#mesa.client .webmk,#mesa.client .webdel{display:none}
#mesa .mchip.webbtn.hay{background:var(--acc-soft);color:var(--acc-ink);border-color:transparent}
#mesa .mchip.webbtn.hay:hover{background:color-mix(in srgb,var(--acc-soft),var(--acc) 12%);border-color:transparent;color:var(--acc-ink)}
#mesa .mchip.webbtn.mal,#mesa .mchip.webbtn.mal:hover{color:var(--red)}
#mesa .mchip.webbtn.ghost{border-color:transparent;color:var(--ink-2);font-weight:400}
#mesa span.webbtn.quieto{pointer-events:none;border-color:transparent;background:var(--bg-2);color:var(--ink-2);font-weight:400;font-variant-numeric:tabular-nums}
#mesa .webbtn .w2n{display:none}
@media (max-width:1180px){#mesa .webbtn .w1{display:none}}
@media (max-width:1000px){#mesa .webbtn .w2{display:none}#mesa .webbtn .w2n{display:inline}}
#mesa .cell:has(.webmk) .lab{padding-right:44px}
#mesa .detail[data-dlg="web"]{align-items:flex-start;padding-top:clamp(16px,10vh,96px)}
#mesa #web-cod{max-width:14ch;font-variant-numeric:tabular-nums;letter-spacing:.2em}
#mesa .webp{margin:0 0 12px;color:var(--mute);font-size:13px;line-height:1.5}
#mesa .dlg .webl{margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.45;color:var(--ink-2)}
#mesa .webdel{margin:0 0 14px;padding:12px 14px;border-radius:12px;background:var(--bg);display:flex;flex-direction:column;gap:10px}
#mesa .webdel.vacia{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:8px 14px;gap:4px 12px}
#mesa .webdel.vacia .webh,#mesa .webabrir{white-space:nowrap}
#mesa .webdel.vacia .webh{font-weight:600}#mesa .webdel.vacia .webq{font-weight:400}
#mesa .webabrir{font-size:12px;min-height:32px;padding:4px 0}
#mesa .webh{margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}
#mesa .webn{font-size:11px;font-weight:600;background:var(--acc);color:var(--on-acc);border-radius:999px;padding:1px 7px}
#mesa .webdel .webp{margin:0}#mesa .webdel .webp b{color:var(--ink)}
#mesa .webdel .webl{list-style:none;margin:0;padding:0 4px 0 0;display:flex;flex-direction:column;gap:10px;max-height:260px;overflow:auto;overscroll-behavior:contain}
#mesa .webcm{display:flex;flex-direction:column;gap:2px}
#mesa .webcm.kv{padding-left:10px;border-left:2px solid var(--line-strong)}
#mesa .webcm.res p{color:var(--mute)}
#mesa .webq{font-size:12px;color:var(--mute)}#mesa .webq b{color:var(--ink);font-weight:600}
#mesa .webcm p{margin:0;font-size:13px;line-height:1.45;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}
#mesa .websl{align-self:flex-start;font-size:11px;background:var(--bg-2);border-radius:999px;padding:1px 8px;color:var(--ink-2)}
#mesa .webres{align-self:flex-start;font-size:12px;padding:4px 0}
#mesa .webesc{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;align-items:flex-end}
#mesa .webta{flex:1 1 220px;min-height:52px;resize:vertical;border:1px solid var(--line);border-radius:var(--r-md);background:var(--panel-2);color:var(--ink);padding:8px 10px;font:inherit;font-size:13px;line-height:1.4}
#mesa .webta:focus{outline:0;border-color:var(--ink);box-shadow:0 0 0 3px var(--ring)}
#mesa .webmk{position:absolute;right:6px;bottom:6px;z-index:2;display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 7px 0 5px;border-radius:999px;background:var(--acc);color:var(--on-acc);font-size:12px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.3)}
#mesa .webmk svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).web = 'ok';
})();
