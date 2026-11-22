// Entregas — Mesa de trabajo · v1.0 (D-290)
// The board of a client of «Solo contenido» (tablero A): in the left column its deliveries of the month (deadline, what, how
// much, its link, delivered) and its sessions; the calendar in the middle (calendario.js, with the deliveries as chips); its
// agreement and its payments on the right. The data lives in mesa.js (M._in.ent, the store 'entregas'; M._in.cob for the
// agreement and the invoices): here nothing is kept. If this file doesn't load, the board says so and the rest of the Mesa
// is as always.
(function entregasBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.1';   // 1.1: the vista cliente — its deliveries as the client's web shows them, only to look (D-297)
  const I = () => M._in, E = () => M._in.ent, C = () => M._in.cob;
  if (M.entregasUI && M.entregasUI._off) { try { M.entregasUI._off(); } catch (e) { /* */ } }
  const OFF = [];
  const on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoy = () => I().hoy();
  const toast = (m, o) => I().toast(m, o);
  const UNDO = 6000;

  // ---------- icons (Lucide, the mesa's stroke, D-168) ----------
  const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
  const IC = {
    enlace: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    mas: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    ok: svg('<path d="M20 6 9 17l-5-5"/>')
  };

  // ---------- words ----------
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const corto = (d, h) => d ? `${+d.slice(8, 10)} ${MESES[+d.slice(5, 7) - 1].slice(0, 3)}${d.slice(0, 4) !== (h || hoy()).slice(0, 4) ? ' ' + d.slice(0, 4) : ''}` : '';
  const nombreMes = m => MESES[+m.slice(5, 7) - 1];
  const may = t => t.charAt(0).toUpperCase() + t.slice(1);

  // ---------- what the board shows ----------
  const UI = { abierta: null, sucio: false, nueva: null, de: null };   // nueva: just made, gone if closed without «qué»; de: the board drawn     // the delivery whose fields are open; drawn again once the focus leaves them
  const col = n => { const r = I().root && I().root(); return r ? r.querySelector(`.main > .cont > .cont-${n}`) : null; };
  function meses() {                              // the board's months (AAAA-MM), as its chips say
    const S = I().S; if (!S) return [];
    const l = []; for (let i = 0; i < (S.span || 1); i++) l.push(I().addMonths(S.month, i));
    return l;
  }
  // the sessions of the client (read from 'tareas', as the posts' calendar, D-219), and again when one changes
  let SES = null, sesLee = null;
  async function leerSes() {
    if (sesLee) { sesLee.otra = true; return; }
    const yo = sesLee = { otra: false };
    try {
      do { yo.otra = false; SES = ((await I().idbAll('tareas').catch(() => [])) || []).filter(t => t && t.tipo === 'sesion' && t.id && /^\d{4}-\d{2}-\d{2}$/.test(t.fecha || '')); } while (yo.otra);
    } finally { if (sesLee === yo) sesLee = null; }
    pintar();
  }
  const clisDe = t => Array.isArray(t.clientes) ? t.clientes : t.cliente ? [t.cliente] : [];
  const CLASE = { foto: 'Foto', video: 'Vídeo', fotovideo: 'Foto y vídeo', libre: 'Libre', reunion: 'Reunión' };

  function filaHTML(r, h, sinCampos) {             // sinCampos: only the row (its fields are being written)
    const k = E().estado(r, h), abierta = UI.abierta === r.id;
    const sub = [r.cuanto, k === 'entregada' ? 'entregada' : k === 'pasada' ? 'sin entregar' : 'antes del ' + corto(r.fecha, h)].filter(Boolean).join(' · ');
    const link = r.enlace ? `<a class="en-l" href="${esc(r.enlace)}" target="_blank" rel="noopener noreferrer" title="${esc(r.enlace)}">${IC.enlace}Enlace</a>` : '<span class="en-sin">sin enlace</span>';
    const ed = abierta && !sinCampos ? `<div class="en-ed" data-id="${esc(r.id)}">`
      + `<div><label for="en-fecha">Fecha límite</label><input id="en-fecha" type="date" class="co-q" data-en="campo" data-k="fecha" value="${esc(r.fecha)}" aria-label="Fecha límite"></div>`
      + `<div class="en-w"><label for="en-que">Qué</label><input id="en-que" type="text" class="co-q" data-en="campo" data-k="que" maxlength="200" autocomplete="off" value="${esc(r.que)}" placeholder="Fotos de la sesión"></div>`
      + `<div><label for="en-cuanto">Cuánto</label><input id="en-cuanto" type="text" class="co-q" data-en="campo" data-k="cuanto" maxlength="120" autocomplete="off" value="${esc(r.cuanto)}" placeholder="40 fotos"></div>`
      + `<div class="en-w"><label for="en-enlace">Enlace</label><input id="en-enlace" type="url" class="co-q" data-en="campo" data-k="enlace" maxlength="1000" autocomplete="off" value="${esc(r.enlace)}" placeholder="https://"></div>`
      + `<div class="en-acc"><button type="button" class="lnk danger" data-en="borrar">Borrar entrega</button><button type="button" class="btn2" data-en="cerrar">Listo</button></div></div>` : '';
    return `<div class="en-f ${k}${abierta ? ' abierta' : ''}" data-id="${esc(r.id)}"><input type="checkbox" class="pp-ck en-ck" data-en="ck"${r.entregada ? ' checked' : ''} aria-label="Entregada: ${esc(r.que || 'sin título')}">`
      + `<button type="button" class="en-q" data-en="abrir" aria-expanded="${abierta}"><span class="en-d">${esc(corto(r.fecha, h))}</span><span class="en-t"><b>${esc(r.que || 'Sin título')}</b><span>${esc(sub)}</span></span></button>${link}</div>${ed}`;
  }
  function izqHTML() {
    // the deliveries of the board's months, counted in «N de M», with the ones gone past before them on top; then, apart and
    // not counted, those of the month after (a month's content goes out by the start of the next, as drawn: «antes del 5 dic»);
    // the open one always shows (a new one never hides)
    const S = I().S, cli = S.client, h = hoy(), ms = meses(), ini = ms[0] + '-01', finMes = ms[ms.length - 1] + '-31', sigM = I().addMonths(ms[ms.length - 1], 1);
    const todas = E().vivas(cli), delMes = todas.filter(r => r.fecha >= ini && r.fecha <= finMes), sig = todas.filter(r => r.fecha.slice(0, 7) === sigM);
    const antes = todas.filter(r => r.fecha < ini && E().estado(r, h) === 'pasada'), vistas = new Set([...antes, ...delMes, ...sig].map(r => r.id));
    const extra = UI.abierta && !vistas.has(UI.abierta) && E().get(UI.abierta) && !E().get(UI.abierta).borrado ? [E().get(UI.abierta)] : [];
    const hechas = delMes.filter(r => r.entregada).length, mesTxt = ms.length > 1 ? `${nombreMes(ms[0])} – ${nombreMes(ms[ms.length - 1])}` : nombreMes(ms[0]);
    const filas = [...antes, ...delMes, ...extra].map(r => filaHTML(r, h)).join(''), filasSig = sig.map(r => filaHTML(r, h)).join('');
    const ses = (SES || []).filter(t => clisDe(t).includes(cli) && t.fecha >= ini && t.fecha <= finMes).sort((a, b) => String(a.fecha + (a.hora || '')).localeCompare(String(b.fecha + (b.hora || ''))));
    const sesF = ses.map(t => `<button type="button" class="en-s" data-en="sesion" data-id="${esc(t.id)}"><span class="en-d">${esc(corto(t.fecha, h))}</span><span class="en-t"><b>${esc(t.txt || 'Sesión')}</b><span>${esc([CLASE[t.sesion && t.sesion.clase] || 'Sesión', t.hora].filter(x => x && x !== t.txt).join(' · ') || 'sin hora')}</span></span></button>`).join('');
    return `<h2 class="en-h">Entregas <span>${esc(mesTxt)}${delMes.length ? ` · ${hechas} de ${delMes.length} entregada${delMes.length === 1 ? '' : 's'}` : ''}</span></h2>`
      + (filas ? `<div class="en-lista">${filas}</div>` : `<p class="en-vacio">Aún sin entregas este mes</p>`)
      + (filasSig ? `<p class="en-sub">${esc(may(nombreMes(sigM)))} <span>${sig.length}</span></p><div class="en-lista">${filasSig}</div>` : '')
      + `<button type="button" class="en-mas" data-en="nueva">${IC.mas}Entrega</button>`
      + `<h2 class="en-h en-h2">Sesiones <span>${ses.length ? `${ses.length} este mes` : ''}</span></h2>`
      + (sesF ? `<div class="en-lista">${sesF}</div>` : `<p class="en-vacio">Aún sin sesiones este mes</p>`)
      + `<button type="button" class="en-mas" data-en="nueva-sesion">${IC.mas}Sesión</button>`;
  }
  // ---------- the vista cliente (D-297): as the client's web shows them, only to look ----------
  // The deliveries of the board's months, «N de M entregadas»; each one with what, how much and its deadline; delivered, its
  // link (only then) and the day; not yet, «En camino» (never «sin entregar»: that's Kevin's); those of the month after, apart.
  // The sessions go in the calendar; «Tus pagos» in the right column (M._in.vc, calendario.js); nothing of Kevin's.
  function vcFila(r, h) {
    const hecha = !!r.entregada, sub = [r.cuanto, hecha ? 'entregada el ' + corto(r.entregada, h) : 'antes del ' + corto(r.fecha, h)].filter(Boolean).join(' · ');
    const der = hecha && r.enlace && E().url(r.enlace) ? `<a class="en-l" href="${esc(r.enlace)}" target="_blank" rel="noopener noreferrer">${IC.enlace}Abrir</a>` : hecha ? '' : '<span class="en-cam">En camino</span>';
    return `<div class="en-vf${hecha ? ' hecha' : ''}" data-id="${esc(r.id)}" tabindex="-1"><span class="en-d">${esc(corto(r.fecha, h))}</span><span class="en-t"><b>${esc(r.que || 'Sin título')}</b><span>${esc(sub)}</span></span>${der}</div>`;
  }
  function vcIzqHTML() {
    const S = I().S, cli = S.client, h = hoy(), ms = meses(), ini = ms[0] + '-01', finMes = ms[ms.length - 1] + '-31', sigM = I().addMonths(ms[ms.length - 1], 1);
    const todas = E().vivas(cli).filter(r => String(r.que || '').trim()), delMes = todas.filter(r => r.fecha >= ini && r.fecha <= finMes).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const sig = todas.filter(r => r.fecha.slice(0, 7) === sigM).sort((a, b) => a.fecha.localeCompare(b.fecha)), hechas = delMes.filter(r => r.entregada).length;
    const mesTxt = ms.length > 1 ? `${nombreMes(ms[0])} – ${nombreMes(ms[ms.length - 1])}` : nombreMes(ms[0]);
    return `<div class="en-vc"><h2 class="en-h">Tus entregas <span>${esc(may(mesTxt))}${delMes.length ? ` · ${hechas} de ${delMes.length} entregada${delMes.length === 1 ? '' : 's'}` : ''}</span></h2>`
      + (delMes.length ? `<div class="en-lista">${delMes.map(r => vcFila(r, h)).join('')}</div>` : '<p class="en-vacio">Este mes aún no tiene entregas</p>')
      + (sig.length ? `<p class="en-sub">${esc(may(nombreMes(sigM)))} <span>${sig.length}</span></p><div class="en-lista">${sig.map(r => vcFila(r, h)).join('')}</div>` : '') + '</div>';
  }
  const vcIr = id => { const f = I().root().querySelector(`.cont-izq .en-vf[data-id="${I().cssq(id)}"]`); if (f) { f.scrollIntoView({ block: 'nearest' }); f.focus({ preventScroll: true }); } };   // a delivery's chip, in the vista cliente

  // the agreement in a line and the invoices, newest first, each one opening «Cobros» (where they're changed)
  const PAGO = { mensual: 'al mes', trimestral: 'cada 3 meses', semestral: 'cada 6 meses', anual: 'al año', unico: 'en un solo pago' };
  function derHTML() {
    const cli = I().S.client, c = I().CL.find(x => x.id === cli), h = hoy(), a = C().acuerdo(c);
    const linea = [a && a.importe != null ? `${C().eur(a.importe)} ${PAGO[a.pago] || ''}`.trim() : 'Sin acuerdo: ponlo en «Cobros»', c && c.entregasDia ? `entregas antes del día ${c.entregasDia}` : ''].filter(Boolean).join(' · ');
    const l = C().vivos(cli).sort(C().orden), prox = C().proxima(cli, h), filas = [];
    if (prox && prox.virtual) filas.push({ t: `${C().nombre({ periodo: prox.mes, hasta: prox.hasta }, h)} · ${C().eur(prox.importe)}`, s: `se emite el ${corto(prox.emitida, h)}`, e: 'Sin emitir', k: 'sin' });
    for (const r of l.slice(0, 6)) {
      const e = C().estado(r, h);
      filas.push({ t: `${C().nombre(r, h)} · ${C().eur(r.importe)}`, s: [r.factura ? 'Factura ' + r.factura : '', e.k === 'cobrada' ? 'cobrada el ' + corto(r.cobrada, h) : r.vence ? 'vence el ' + corto(r.vence, h) : r.emitida ? 'se emite el ' + corto(r.emitida, h) : ''].filter(Boolean).join(' · '),
        e: e.k === 'cobrada' ? 'Cobrada' : e.k === 'retrasada' ? `Retrasada ${e.dias} ${e.dias === 1 ? 'día' : 'días'}` : e.k === 'pendiente' ? 'Pendiente' : 'Sin emitir', k: e.k === 'cobrada' ? 'ok' : e.k === 'retrasada' ? 'tarde' : e.k === 'pendiente' ? 'pend' : 'sin' });
    }
    return `<h2 class="en-h">Acuerdo <span>Solo contenido</span></h2>`
      + `<button type="button" class="en-acu" data-en="cobros">${esc(linea)}</button>`
      + (filas.length ? `<div class="en-lista">${filas.map(f => `<button type="button" class="en-p" data-en="cobros"><span class="en-t"><b>${esc(f.t)}</b><span>${esc(f.s)}</span></span><span class="en-e ${f.k}">${esc(f.e)}</span></button>`).join('')}</div>` : '');
  }

  // ---------- drawing (only what changed: a field being written is never drawn over) ----------
  function pintar() {
    const X = I(); if (!X || !X.S || !X.esContenido || !X.esContenido(X.S.client)) return;
    const iz = col('izq'), de = col('der'); if (!iz || !de) return;
    if (UI.de && UI.de !== X.S.key) { UI.de = X.S.key; UI.abierta = null; UI.nueva = null; }   // another board (salir() already let the one before go)
    UI.de = X.S.key;
    if (SES === null && !sesLee) { leerSes(); }
    const a = document.activeElement;
    if (a && iz.contains(a) && a.matches && a.matches('.en-ed input')) {   // a field being written: its row now, the rest after the field (its blur)
      UI.sucio = true;
      const r = UI.abierta && E().get(UI.abierta), f = r && iz.querySelector(`.en-f[data-id="${I().cssq(r.id)}"]`);
      if (f && !r.borrado) { const t = document.createElement('template'); t.innerHTML = filaHTML(r, hoy(), true); const n = t.content.firstElementChild; if (n && n.outerHTML !== f.outerHTML) f.replaceWith(n); }
      return;
    }
    UI.sucio = false;
    if (X.root().classList.contains('client')) {   // the vista cliente (D-297): the right column is the client's (calendario.js)
      const hv = vcIzqHTML(); if (iz._h !== hv) { const y = iz.scrollTop; iz.innerHTML = hv; iz._h = hv; iz.scrollTop = y; }
      return;
    }
    const hi = izqHTML(), hd = derHTML();
    if (iz._h !== hi) { const y = iz.scrollTop; iz.innerHTML = hi; iz._h = hi; iz.scrollTop = y; }
    if (de._h !== hd) { de.innerHTML = hd; de._h = hd; }
  }
  const enfocar = sel => requestAnimationFrame(() => { const r = I().root(), e = r && r.querySelector(sel); if (e) e.focus(); });
  const fallo = e => toast('No se pudo: ' + String((e && e.message) || e), { ms: 8000, key: 'fallo' });

  // ---------- doing ----------
  // its fields close; a new one still without «qué» goes, without a word (as a task without a title, D-204); the focus back on its
  // row, or on «+ Entrega» if it went
  async function cerrarCampos(foco) {
    const was = UI.abierta, nueva = was && UI.nueva === was;
    UI.abierta = null; UI.nueva = null;
    // decided over what is saved: the field being written goes in first and every write in course ends (a click right after a
    // «change» never sees the record of before; second round of the cold review)
    await soltarCampo(was); await E().esperar(); await new Promise(r => setTimeout(r, 0));   // and its cache, after it
    const nuevaVacia = nueva && !String((E().get(was) || {}).que || '').trim();
    if (nuevaVacia) { try { await E().borrar(was); } catch (e) { /* it stays, «Sin título» */ } }
    pintar();
    if (foco) enfocar(nuevaVacia ? '.cont-izq [data-en="nueva"]' : `.cont-izq .en-f[data-id="${I().cssq(was)}"] .en-q`);
  }
  async function nueva() {
    const S = I().S; if (!S) return;
    if (UI.abierta) await cerrarCampos(false);
    const ini = meses()[0] + '-01', h = hoy(), desde = h > ini ? h : ini;
    try {
      const r = await E().nueva({ cliente: S.client, fecha: E().propuesta(S.client, desde), que: '' });
      UI.abierta = r.id; UI.nueva = r.id; UI.de = S.key; pintar(); enfocar('.cont-izq .en-ed [data-k="que"]');
    } catch (e) { fallo(e); }
  }
  async function campo(inp) {
    const ed = inp.closest('.en-ed'), id = ed && ed.dataset.id, r = id && E().get(id); if (!r || r.borrado) return;
    const k = inp.dataset.k, v = String(inp.value || '').trim();
    if (k === 'fecha' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { toast('La fecha límite no puede quedar vacía.'); inp.value = r.fecha; return; }
    if (k === 'enlace' && v && !E().url(v)) { toast('El enlace tiene que empezar por https:// (Drive, WeTransfer…).'); inp.value = r.enlace || ''; return; }
    if ((r[k] || '') === v) return;
    try { await E().cambiar(id, { [k]: v }); } catch (e) { fallo(e); inp.value = r[k] || ''; }
  }
  async function marcar(ck) {
    const f = ck.closest('.en-f'), id = f && f.dataset.id; if (!id) return;
    try { await E().cambiar(id, { entregada: ck.checked ? hoy() : '' }); } catch (e) { fallo(e); ck.checked = !ck.checked; }
  }
  async function borrar(id) {
    let b = null; try { b = await E().borrar(id); } catch (e) { fallo(e); return; }
    if (!b) return;
    UI.abierta = null; UI.nueva = null; pintar(); enfocar('.cont-izq [data-en="nueva"]');   // the focus where it can go on
    toast(`Entrega «${b.rec.que || 'sin título'}» borrada.`, { action: 'Deshacer', ms: UNDO, onAction: () => E().devolver(b.rec).catch(fallo) });
  }
  function abrir(id) {                             // from the calendar's chip too: its row, open, in sight
    const r = E().get(id); if (!r || r.borrado) return false;
    if (UI.abierta && UI.abierta !== id) cerrarCampos(false);
    UI.abierta = id; pintar();
    requestAnimationFrame(() => { const f = col('izq') && col('izq').querySelector(`.en-f[data-id="${I().cssq(id)}"]`); if (f) { f.scrollIntoView({ block: 'nearest' }); const q = f.parentNode.querySelector('.en-ed [data-k="que"]'); if (q) q.focus({ preventScroll: true }); } });
    return true;
  }

  // a field being written goes in before the column is drawn again (its «change» would never come); with an id, only that one's
  async function soltarCampo(id) {
    const a = document.activeElement; if (!(a && a.matches && a.matches('.main > .cont .en-ed input'))) return;
    if (id && a.closest('.en-ed').dataset.id !== id) return;
    if (a.dataset.en === 'campo') await campo(a);
    a.blur();
  }
  // the board left (mesa.js, renderMain): its fields close, and a new one still without «qué» goes
  function salir() { if (UI.abierta) cerrarCampos(false); UI.de = null; }

  // ---------- events ----------
  async function alClic(e) {
    const b = e.target.closest && e.target.closest('.main > .cont [data-en]'); if (!b || b.disabled) return;
    const k = b.dataset.en, f = b.closest('.en-f'), id = (f && f.dataset.id) || (b.closest('.en-ed') && b.closest('.en-ed').dataset.id);
    if (k === 'ck' || k === 'campo') return;
    if (e.detail > 1) return;                       // the second click of a double click does nothing (lesson 57)
    if (k === 'abrir' || k === 'cerrar' || k === 'borrar' || k === 'nueva') await soltarCampo();
    if (k === 'abrir') { const otra = UI.abierta !== id; if (UI.abierta) await cerrarCampos(!otra); if (otra) { UI.abierta = id; pintar(); enfocar('.cont-izq .en-ed [data-k="que"]'); } }
    else if (k === 'cerrar') await cerrarCampos(true);
    else if (k === 'borrar' && id) borrar(id);
    else if (k === 'nueva') nueva();
    else if (k === 'nueva-sesion') { if (M.personal && M.personal.nuevaSesion) M.personal.nuevaSesion({ cliente: I().S.client }); }
    else if (k === 'sesion') { if (M.personal && M.personal.abrirSesion) M.personal.abrirSesion(b.dataset.id, { de: `.cont-izq [data-en="sesion"][data-id="${I().cssq(b.dataset.id)}"]`, vc: false, cli: I().S.client }); }
    else if (k === 'cobros') C().dlgCliente(I().S.client, 'cobros');
  }
  function alCambiar(e) {
    const t = e.target; if (!t.closest || !t.closest('.main > .cont')) return;
    if (t.dataset.en === 'ck') marcar(t); else if (t.dataset.en === 'campo') campo(t);
  }
  function alTecla(e) {
    const t = e.target; if (!t.closest || !t.closest('.main > .cont .en-ed')) return;
    if (e.key === 'Enter' && t.matches('input:not([type="date"])')) { e.preventDefault(); campo(t); return; }
    if (e.key === 'Escape') {                       // first back to what is saved; then the fields close
      const r = E().get(t.closest('.en-ed').dataset.id), v0 = r ? (r[t.dataset.k] || '') : '';
      e.preventDefault(); e.stopPropagation();
      if (t.dataset.k && t.value !== v0 && t.type !== 'date') { t.value = v0; return; }
      t.blur(); cerrarCampos(true);
    }
  }
  function alSalir(e) {                             // a field left: what waited is drawn now
    const t = e.target; if (!UI.sucio || !t.closest || !t.closest('.main > .cont .en-ed')) return;
    setTimeout(() => { const a = document.activeElement; if (!(a && a.closest && a.closest('.main > .cont .en-ed'))) pintar(); }, 0);
  }

  // ---------- mounting ----------
  let listoP = null;
  const listo = () => listoP || (listoP = new Promise((res, rej) => { const t0 = Date.now(), t = setInterval(() => { if (I() && I().ent && I().cob && I().estilo) { clearInterval(t); res(); } else if (Date.now() - t0 > 30000) { clearInterval(t); rej(new Error('mesa.js sin entregas')); } }, 50); }));
  M.entregasUI = {
    version: VERSION, pintar, abrir, salir, irA: vcIr,
    _test: { UI },
    _off: () => { OFF.splice(0).forEach(f => f()); }
  };
  listo().then(() => {
    on(document, 'click', alClic);
    on(document, 'change', alCambiar);
    on(document, 'keydown', alTecla, true);
    on(document, 'focusout', alSalir);
    on(document, 'mesa-entregas', () => pintar());
    on(document, 'mesa-cobros', () => pintar());
    on(document, 'mesa-tareas', () => { SES = null; leerSes(); });
    I().estilo('mesa-en-css', ESTILO);
    if (I().render) I().render();                 // a board drawn before this file arrived says «Cargando…»
    (window.MESA_CARGA = window.MESA_CARGA || {}).entregas = 'ok';
  }).catch(() => { (window.MESA_CARGA = window.MESA_CARGA || {}).entregas = 'fallo'; if (I() && I().render) I().render(); });

  const ESTILO = `
#mesa .cont .en-h{display:flex;align-items:baseline;gap:8px;margin:0 0 6px;font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-.025em}
#mesa .cont .en-h span{font-size:13px;font-weight:400;color:var(--mute)}#mesa .cont .en-h2{margin-top:26px}
#mesa .cont .en-lista{display:flex;flex-direction:column}
#mesa .cont .en-vacio{margin:10px 0 4px;font-size:13px;color:var(--mute)}
#mesa .cont .en-sub{margin:14px 0 2px;font-size:13px;font-weight:600;color:var(--ink-2)}#mesa .cont .en-sub span{font-weight:400;color:var(--mute)}
#mesa .en-f{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line-2,var(--line))}
#mesa .en-ck{justify-self:center}
#mesa .en-q,#mesa .en-s,#mesa .en-p{display:grid;grid-template-columns:56px minmax(0,1fr);align-items:center;gap:10px;min-height:44px;margin:0;padding:4px 6px;border:0;border-radius:var(--r-sm);background:none;font:inherit;text-align:left;color:var(--ink);cursor:pointer;transition:background var(--d1) ease-out}
#mesa .en-s{grid-template-columns:56px minmax(0,1fr);border-top:1px solid var(--line-2,var(--line));border-radius:0}
#mesa .en-p{grid-template-columns:minmax(0,1fr) auto;border-top:1px solid var(--line-2,var(--line));border-radius:0;padding:8px 0}
#mesa .en-q:hover,#mesa .en-s:hover,#mesa .en-p:hover{background:var(--bg-2)}
#mesa .en-q:focus-visible,#mesa .en-s:focus-visible,#mesa .en-p:focus-visible,#mesa .en-acu:focus-visible,#mesa .en-mas:focus-visible,#mesa .en-l:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
#mesa .en-d{font-size:13px;color:var(--ink-2);font-variant-numeric:tabular-nums;white-space:nowrap}
#mesa .en-f.pasada .en-d{color:var(--red);font-weight:600}
#mesa .en-t{display:flex;flex-direction:column;gap:1px;min-width:0}
#mesa .en-vf{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;min-height:52px;padding:8px 0;border-top:1px solid var(--line-2,var(--line))}
#mesa .en-vf:first-child{border-top:0}#mesa .en-vf:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:var(--r-sm)}
#mesa .en-cam{font-size:12.5px;font-weight:600;padding:3px 10px;border-radius:var(--r-pill);background:var(--bg-2);color:var(--ink-2);white-space:nowrap}
#mesa .en-vf .en-l{font-weight:600}
#mesa .en-t b{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .en-t span{font-size:12px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .en-f.pasada .en-t span{color:var(--red)}
#mesa .en-l{display:inline-flex;align-items:center;gap:5px;padding:4px 6px;border-radius:var(--r-sm);font-size:12.5px;color:var(--acc-ink);text-decoration:none;white-space:nowrap}
#mesa .en-l:hover{background:var(--acc-soft)}#mesa .en-l svg{width:14px;height:14px}
#mesa .en-sin{font-size:12px;color:var(--mute);white-space:nowrap;padding:0 6px}
#mesa .en-ed{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:10px 12px;margin:0 0 10px 32px;padding:12px;border-radius:var(--r-md);background:var(--bg-2)}
#mesa .en-ed .en-w{grid-column:span 1}#mesa .en-ed .mx-f{display:flex;width:100%}#mesa .en-ed .mx-f .mx-in{flex:1;min-width:0}#mesa .en-ed label{display:block;margin:0 0 5px;font-size:12px;font-weight:600;color:var(--ink-2)}
#mesa .en-acc{grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;gap:8px}
#mesa .en-mas{display:inline-flex;align-items:center;gap:6px;margin:8px 0 0;padding:6px 8px 6px 4px;border:0;border-radius:var(--r-sm);background:none;font:inherit;font-size:13px;font-weight:600;color:var(--acc-ink);cursor:pointer}
#mesa .en-mas:hover{background:var(--acc-soft)}#mesa .en-mas svg{width:16px;height:16px}
#mesa .en-acu{display:block;width:100%;margin:2px 0 10px;padding:4px 0;border:0;background:none;font:inherit;font-size:13px;line-height:1.45;text-align:left;color:var(--ink-2);cursor:pointer}
#mesa .en-acu:hover{color:var(--ink)}
#mesa .en-e{font-size:12.5px;font-weight:600;white-space:nowrap}#mesa .en-e.ok{color:var(--ok)}#mesa .en-e.tarde{color:var(--red)}#mesa .en-e.pend{color:var(--chg)}#mesa .en-e.sin{color:var(--mute);font-weight:400}
#mesa .en-q svg,#mesa .en-mas svg,#mesa .en-l svg{fill:none;stroke:currentColor;stroke-width:1.33;stroke-linecap:round;stroke-linejoin:round}
#mesa .en-q svg path,#mesa .en-mas svg path,#mesa .en-l svg path{vector-effect:non-scaling-stroke}
@media (prefers-reduced-motion:reduce){#mesa :is(.en-q,.en-s,.en-p){transition:none}}
`;
})();
