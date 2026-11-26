// Entregas — Mesa de trabajo · v1.0 (D-290)
// The page of a client of «Solo contenido» (D-312, opción 2; it had months before, D-290): on the left all its deliveries, the
// ones not delivered by deadline and, apart, the delivered ones by month, with all its history (deadline, what, how much, its
// link, delivered); in the middle the calendar at half height (calendario.js, any month, the deliveries and sessions as chips)
// and its sessions under it, the next and those gone past; its agreement and its payments on the right. The data lives in
// mesa.js (M._in.ent, the store 'entregas'; M._in.cob for the agreement and the invoices): here nothing is kept. If this file
// doesn't load, the page says so and the rest of the Mesa is as always.
(function entregasBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.3';   // 1.3: the client's page without months: all its deliveries and its sessions, its vista cliente as its web, «caduca» (D-312). 1.2: an invoice not issued whose day passed, «con retraso» (D-304). 1.1: the vista cliente — its deliveries as the client's web shows them, only to look (D-297)
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
    ok: svg('<path d="M20 6 9 17l-5-5"/>'),
    ses: svg('<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),   // Lucide clapperboard, as its chip
    reu: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')   // Lucide users, a meeting (D-291)
  };

  // ---------- words ----------
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const corto = (d, h) => d ? `${+d.slice(8, 10)} ${MESES[+d.slice(5, 7) - 1].slice(0, 3)}${d.slice(0, 4) !== (h || hoy()).slice(0, 4) ? ' ' + d.slice(0, 4) : ''}` : '';
  const nombreMes = m => MESES[+m.slice(5, 7) - 1];
  const may = t => t.charAt(0).toUpperCase() + t.slice(1);
  const nDe = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  // ---------- what the page shows ----------
  const UI = { abierta: null, sucio: false, nueva: null, de: null };   // nueva: just made, gone if closed without «qué»; de: the client drawn     // the delivery whose fields are open; drawn again once the focus leaves them
  const col = n => { const r = I().root && I().root(); return r ? r.querySelector(`.main > .cont > .cont-${n}`) : null; };
  const colSes = () => { const r = I().root && I().root(); return r ? r.querySelector('.main > .cont > .cont-side > .cont-ses') : null; };
  const cliAbierto = () => { const X = I(); return X && X.contCli ? X.contCli() : null; };   // the client whose page is open (D-312)
  // the sessions of the client (read from 'tareas', as the posts' calendar, D-219), and again when one changes
  let SES = null, sesLee = null, SES_MAL = false;   // SES_MAL: its reading failed (never «none», lesson 94)
  async function leerSes() {
    if (sesLee) { sesLee.otra = true; return; }
    const yo = sesLee = { otra: false };
    try {
      do { yo.otra = false; let l = null; try { l = (await I().idbAll('tareas')) || []; SES_MAL = false; } catch (e) { SES_MAL = true; } if (l) SES = l.filter(t => t && t.tipo === 'sesion' && t.id); } while (yo.otra);   // also one without a date (D-312): sesListas sorts them
    } finally { if (sesLee === yo) sesLee = null; }
    pintar();
  }
  const clisDe = t => Array.isArray(t.clientes) ? t.clientes : t.cliente ? [t.cliente] : [];
  const CLASE = { foto: 'Foto', video: 'Vídeo', fotovideo: 'Foto y vídeo', libre: 'Libre', reunion: 'Reunión' };

  function filaHTML(r, h, sinCampos) {             // sinCampos: only the row (its fields are being written)
    const k = E().estado(r, h), abierta = UI.abierta === r.id;
    const sub = [r.cuanto, k === 'entregada' ? 'entregada el ' + corto(r.entregada, h) : k === 'pasada' ? 'sin entregar' : 'antes del ' + corto(r.fecha, h)].filter(Boolean).join(' · ');   // the day it went out, as its history (D-312)
    const link = r.enlace ? `<a class="en-l" href="${esc(r.enlace)}" target="_blank" rel="noopener noreferrer" title="${esc(r.enlace)}">${IC.enlace}Enlace</a>` : '<span class="en-sin">sin enlace</span>';
    // a WeTransfer link expires (D-312): «caduca», never blocking; only here, never in the vista cliente nor the portal
    const cad = r.enlace && E().caduca && E().caduca(r.enlace) ? ' · <span class="en-cad" title="Los enlaces de WeTransfer caducan (el gratuito, a los pocos días): puede que el cliente no lo abra más adelante. Por la dirección no se sabe si es de pago">caduca</span>' : '';
    const ed = abierta && !sinCampos ? `<div class="en-ed" data-id="${esc(r.id)}">`
      + `<div><label for="en-fecha">Fecha límite</label><input id="en-fecha" type="date" class="co-q" data-en="campo" data-k="fecha" value="${esc(r.fecha)}" aria-label="Fecha límite"></div>`
      + `<div class="en-w"><label for="en-que">Qué</label><input id="en-que" type="text" class="co-q" data-en="campo" data-k="que" maxlength="200" autocomplete="off" value="${esc(r.que)}" placeholder="Fotos de la sesión"></div>`
      + `<div><label for="en-cuanto">Cuánto</label><input id="en-cuanto" type="text" class="co-q" data-en="campo" data-k="cuanto" maxlength="120" autocomplete="off" value="${esc(r.cuanto)}" placeholder="40 fotos"></div>`
      + `<div class="en-w"><label for="en-enlace">Enlace</label><input id="en-enlace" type="url" class="co-q" data-en="campo" data-k="enlace" maxlength="1000" autocomplete="off" value="${esc(r.enlace)}" placeholder="https://"></div>`
      + `<div class="en-acc"><button type="button" class="lnk danger" data-en="borrar">Borrar entrega</button><button type="button" class="btn2" data-en="cerrar">Listo</button></div></div>` : '';
    return `<div class="en-f ${k}${abierta ? ' abierta' : ''}" data-id="${esc(r.id)}"><input type="checkbox" class="pp-ck en-ck" data-en="ck"${r.entregada ? ' checked' : ''} aria-label="Entregada: ${esc(r.que || 'sin título')}">`
      + `<button type="button" class="en-q" data-en="abrir" aria-expanded="${abierta}"><span class="en-d">${esc(corto(r.fecha, h))}</span><span class="en-t"><b>${esc(r.que || 'Sin título')}</b><span${cad ? ' class="en-sc"' : ''}>${esc(sub)}${cad}</span></span></button>${link}</div>${ed}`;
  }
  function izqHTML(cli) {
    // all its deliveries (D-312): those not delivered by deadline (one gone past, red) and «+ Entrega»; under them, apart, the
    // delivered ones, from the newest, by the month of their deadline. The open one is always in one of them (a new one too)
    const h = hoy(), L = E().listas(cli), cuenta = [L.nPend ? nDe(L.nPend, 'pendiente', 'pendientes') : '', L.nHechas ? nDe(L.nHechas, 'entregada', 'entregadas') : ''].filter(Boolean).join(' · ');
    const pend = L.pendientes.map(r => filaHTML(r, h)).join('');
    const hist = L.entregadas.map(g => `<p class="en-mh">${esc(may(nombreMes(g.m)))} ${g.m.slice(0, 4)}</p><div class="en-lista">${g.l.map(r => filaHTML(r, h)).join('')}</div>`).join('');
    return `<h2 class="en-h">Entregas <span>${esc(cuenta)}</span></h2>`
      + (pend ? `<div class="en-lista">${pend}</div>` : `<p class="en-vacio">${L.nHechas ? 'Nada pendiente' : 'Aún sin entregas'}</p>`)
      + `<button type="button" class="en-mas" data-en="nueva">${IC.mas}Entrega</button>`
      + (hist ? `<h2 class="en-h en-h2">Entregadas</h2>${hist}` : '');
  }
  // its sessions (D-312), under the calendar: the next ones and, apart, those gone past; «+ Sesión» and «+ Reunión» (D-291)
  const CLASE_SES = t => CLASE[t.sesion && t.sesion.clase] || 'Sesión';
  const sesFila = (t, h, pasada, ro) => {
    // the client sees «Sesión» or «Reunión» and its time, as its web (lesson 178); Kevin, its kind, or «sin hora»
    const reu = t.sesion && t.sesion.clase === 'reunion', sub = ro ? [reu ? 'Reunión' : 'Sesión', t.hora].filter(Boolean).join(' · ') : [CLASE_SES(t), t.hora].filter(x => x && x !== t.txt).join(' · ') || 'sin hora';
    const dentro = `${ro ? '<span class="en-sd">' : ''}${reu ? IC.reu : IC.ses}<span class="en-d">${t.fecha ? esc(corto(t.fecha, h)) : 'Sin fecha'}</span>${ro ? '</span>' : ''}<span class="en-t"><b>${esc(t.txt || (reu ? 'Reunión' : 'Sesión'))}</b><span>${esc(sub)}</span></span>`;
    return ro ? `<div class="en-s ro${pasada ? ' pasada' : ''}">${dentro}</div>` : `<button type="button" class="en-s${pasada ? ' pasada' : ''}" data-en="sesion" data-id="${esc(t.id)}">${dentro}</button>`;
  };
  function sesHTML(cli) {
    const h = hoy(), L = I().sesListas(SES || [], cli, h);
    const vacio = SES_MAL ? 'No se pudieron leer sus sesiones: recarga la página.' : SES === null ? 'Leyendo sus sesiones…' : 'Ninguna próxima';
    return `<h2 class="en-h">Sesiones <span>${L.proximas.length ? esc(nDe(L.proximas.length, 'próxima', 'próximas')) : ''}</span></h2>`
      + (L.proximas.length && !SES_MAL ? `<div class="en-lista">${L.proximas.map(t => sesFila(t, h)).join('')}</div>` : `<p class="en-vacio">${vacio}</p>`)
      + `<div class="en-mases"><button type="button" class="en-mas" data-en="nueva-sesion">${IC.mas}Sesión</button><button type="button" class="en-mas" data-en="nueva-reunion">${IC.mas}Reunión</button></div>`   // under the next ones, never at the foot of «Pasadas» (lesson 247)
      + (L.pasadas.length && !SES_MAL ? `<p class="en-mh">Pasadas</p><div class="en-lista">${L.pasadas.map(t => sesFila(t, h, true)).join('')}</div>` : '');
  }
  // ---------- the vista cliente (D-297, D-312): as the client's web shows them, only to look ----------
  // The same list, without the calendar: what is on its way by deadline («En camino», never «sin entregar»: that's Kevin's) and,
  // apart, the delivered ones by month, with their link (only then) and the day; under them the sessions it sees (eye open) that
  // are still to come; «Tus pagos» in the right column (M._in.vc, calendario.js); nothing of Kevin's (no «caduca»).
  function vcFila(r, h) {
    const hecha = !!r.entregada, sub = [r.cuanto, hecha ? 'entregada el ' + corto(r.entregada, h) : 'antes del ' + corto(r.fecha, h)].filter(Boolean).join(' · ');
    const der = hecha && r.enlace && E().url(r.enlace) ? `<a class="en-l" href="${esc(r.enlace)}" target="_blank" rel="noopener noreferrer">${IC.enlace}Abrir</a>` : hecha ? '' : '<span class="en-cam">En camino</span>';
    return `<div class="en-vf${hecha ? ' hecha' : ''}" data-id="${esc(r.id)}" tabindex="-1"><span class="en-d">${esc(corto(r.fecha, h))}</span><span class="en-t"><b>${esc(r.que || 'Sin título')}</b><span>${esc(sub)}</span></span>${der}</div>`;
  }
  function vcIzqHTML(cli) {
    const h = hoy(), L = E().listas(cli), con = r => String(r.que || '').trim();
    const pend = L.pendientes.filter(con), grupos = L.entregadas.map(g => ({ m: g.m, l: g.l.filter(con) })).filter(g => g.l.length), nH = grupos.reduce((n, g) => n + g.l.length, 0);
    const ses = SES_MAL ? [] : I().sesListas(SES || [], cli, h, { visibles: true }).proximas;
    const cuenta = [pend.length ? `${pend.length} en camino` : '', nH ? nDe(nH, 'entregada', 'entregadas') : ''].filter(Boolean).join(' · ');
    return `<div class="en-vc"><h2 class="en-h">Tus entregas <span>${esc(cuenta)}</span></h2>`
      + (pend.length ? `<div class="en-lista">${pend.map(r => vcFila(r, h)).join('')}</div>` : !nH ? '<p class="en-vacio">Aún no hay entregas.</p>' : '')
      + grupos.map(g => `<p class="en-mh">${esc(may(nombreMes(g.m)))} ${g.m.slice(0, 4)}</p><div class="en-lista">${g.l.map(r => vcFila(r, h)).join('')}</div>`).join('')
      + (ses.length ? `<p class="en-mh">Sesiones y reuniones</p><div class="en-lista">${ses.map(t => sesFila(t, h, false, true)).join('')}</div>` : '') + '</div>';
  }
  const vcIr = id => { const f = I().root().querySelector(`.cont-izq .en-vf[data-id="${I().cssq(id)}"]`); if (f) { f.scrollIntoView({ block: 'nearest' }); f.focus({ preventScroll: true }); } };   // a delivery's chip, in the vista cliente

  // the agreement in a line and the invoices, newest first, each one opening «Cobros» (where they're changed)
  const eurJ = n => C().eur(n).replace(/ €$/, '\u00a0€');   // «900 €» never split in a narrow column (D-312)
  const PAGO = { mensual: 'al mes', trimestral: 'cada 3 meses', semestral: 'cada 6 meses', anual: 'al año', unico: 'en un solo pago' };
  function derHTML(cli) {
    const c = I().CL.find(x => x.id === cli), h = hoy(), a = C().acuerdo(c);
    if (C().mal && C().mal()) return `<h2 class="en-h">Acuerdo y pagos</h2><p class="en-vacio">No se pudieron leer sus acuerdos o sus facturas: recarga la página.</p>`;   // never «Sin acuerdo» over a failed reading (lesson 94)
    const linea = [a && a.importe != null ? `${C().impTxt ? C().impTxt(a) : C().eur(a.importe)} ${PAGO[a.pago] || ''}`.trim() : 'Sin acuerdo: ponlo en «Cobros»', c && c.entregasDia ? `entregas antes del día ${c.entregasDia}` : ''].filter(Boolean).join(' · ');
    const l = C().vivos(cli).sort(C().orden), prox = C().proxima(cli, h), filas = [];
    if (prox && prox.virtual) filas.push({ t: `${C().nombre({ periodo: prox.mes, hasta: prox.hasta }, h)} · ${eurJ(prox.importe)}`, s: prox.tarde ? `con retraso: tocaba el ${corto(prox.emitida, h)}` : `se emite el ${corto(prox.emitida, h)}`, e: 'Sin emitir', k: 'sin' });   // D-304
    for (const r of l.slice(0, 6)) {
      const e = C().estado(r, h);
      filas.push({ t: `${C().nombre(r, h)} · ${eurJ(r.importe)}`, s: [r.factura ? 'Factura ' + r.factura : '', e.k === 'cobrada' ? 'cobrada el ' + corto(r.cobrada, h) : r.vence ? 'vence el ' + corto(r.vence, h) : r.emitida ? 'se emite el ' + corto(r.emitida, h) : ''].filter(Boolean).join(' · '),
        e: e.k === 'cobrada' ? 'Cobrada' : e.k === 'retrasada' ? `Retrasada ${e.dias} ${e.dias === 1 ? 'día' : 'días'}` : e.k === 'pendiente' ? 'Pendiente' : 'Sin emitir', k: e.k === 'cobrada' ? 'ok' : e.k === 'retrasada' ? 'tarde' : e.k === 'pendiente' ? 'pend' : 'sin' });
    }
    return `<h2 class="en-h">Acuerdo y pagos</h2>`   // Kevin's title (D-312)
      + `<button type="button" class="en-acu" data-en="cobros">${esc(linea)}</button>`
      + (filas.length ? `<div class="en-lista">${filas.map(f => `<button type="button" class="en-p" data-en="cobros"><span class="en-t"><b>${esc(f.t)}</b><span>${esc(f.s)}</span></span><span class="en-e ${f.k}">${esc(f.e)}</span></button>`).join('')}</div>` : '');
  }

  // ---------- drawing (only what changed: a field being written is never drawn over) ----------
  function pintar() {
    const X = I(), cli = cliAbierto(); if (!cli) return;
    const iz = col('izq'), de = col('der'), se = colSes(); if (!iz || !de) return;
    const k = 'cli:' + cli;
    if (UI.de && UI.de !== k) { UI.abierta = null; UI.nueva = null; }   // another client's page (salir() already let the one before go)
    UI.de = k;
    if (SES === null && !sesLee) { leerSes(); }
    const a = document.activeElement;
    if (a && iz.contains(a) && a.matches && a.matches('.en-ed input')) {   // a field being written: its row now, the rest after the field (its blur)
      UI.sucio = true;
      const r = UI.abierta && E().get(UI.abierta), f = r && iz.querySelector(`.en-f[data-id="${I().cssq(r.id)}"]`);
      if (f && !r.borrado) { const t = document.createElement('template'); t.innerHTML = filaHTML(r, hoy(), true); const n = t.content.firstElementChild; if (n && n.outerHTML !== f.outerHTML) f.replaceWith(n); }
      return;
    }
    UI.sucio = false;
    if (X.root().classList.contains('client')) {   // the vista cliente (D-297, D-312): the list; the right column is the client's (calendario.js)
      const hv = vcIzqHTML(cli); if (iz._h !== hv) { const y = iz.scrollTop; iz.innerHTML = hv; iz._h = hv; iz.scrollTop = y; }
      return;
    }
    const hi = izqHTML(cli), hd = derHTML(cli), hs = se ? sesHTML(cli) : '';
    if (iz._h !== hi) { const y = iz.scrollTop; iz.innerHTML = hi; iz._h = hi; iz.scrollTop = y; }
    if (se && se._h !== hs) { const y = se.scrollTop; se.innerHTML = hs; se._h = hs; se.scrollTop = y; }
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
    const cli = cliAbierto(); if (!cli) return;
    if (UI.abierta) await cerrarCampos(false);
    try {
      const r = await E().nueva({ cliente: cli, fecha: E().propuesta(cli, hoy()), que: '' });   // from today, by its day of deliveries
      UI.abierta = r.id; UI.nueva = r.id; UI.de = 'cli:' + cli; pintar(); enfocar('.cont-izq .en-ed [data-k="que"]');
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
  // the page left (mesa.js, renderMain): its fields close, and a new one still without «qué» goes
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
    else if (k === 'nueva-sesion' || k === 'nueva-reunion') { if (M.personal && M.personal.nuevaSesion) M.personal.nuevaSesion({ cliente: cliAbierto(), clase: k === 'nueva-reunion' ? 'reunion' : undefined }); }   // a meeting, a kind of session (D-291)
    else if (k === 'sesion') { if (M.personal && M.personal.abrirSesion) M.personal.abrirSesion(b.dataset.id, { de: `.cont-ses [data-en="sesion"][data-id="${I().cssq(b.dataset.id)}"]`, vc: false, cli: cliAbierto() }); }
    else if (k === 'cobros') C().dlgCliente(cliAbierto(), 'cobros');
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
    on(document, 'mesa-tareas', () => leerSes());   // read again, the list of before on view meanwhile (no «Leyendo…» blink, D-312)
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
#mesa .cont .en-mh{margin:16px 0 4px;font-size:13px;font-weight:600;color:var(--ink-2)}#mesa .cont .en-h + .en-mh{margin-top:4px}
#mesa .en-mases{display:flex;flex-wrap:wrap;gap:4px 16px}
#mesa .en-f{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line-2,var(--line))}
#mesa .en-ck{justify-self:center}
#mesa .en-q,#mesa .en-s,#mesa .en-p{display:grid;grid-template-columns:56px minmax(0,1fr);align-items:center;gap:10px;min-height:44px;margin:0;padding:4px 6px;border:0;border-radius:var(--r-sm);background:none;font:inherit;text-align:left;color:var(--ink);cursor:pointer}
#mesa .en-s{grid-template-columns:18px 56px minmax(0,1fr);border-top:1px solid var(--line-2,var(--line));border-radius:0}#mesa .en-s svg{width:16px;height:16px;color:var(--mute)}
#mesa .en-s.ro{grid-template-columns:64px minmax(0,1fr);cursor:default;min-height:52px;padding:8px 0}#mesa .en-s.ro:first-child{border-top:0}#mesa .en-s.ro:hover{background:none}#mesa .en-sd{display:inline-flex;align-items:center;gap:6px}   /* the client's: its date where the deliveries' is (D-312) */
#mesa .en-p{grid-template-columns:minmax(0,1fr) auto;border-top:1px solid var(--line-2,var(--line));border-radius:0;padding:8px 0}
#mesa .en-q:hover,#mesa .en-s:hover,#mesa .en-p:hover{background:var(--bg-2);transition:background-color var(--d1) var(--ease)}   /* it appears in --d1, goes at once: no trail down a list (A49-10) */
#mesa .en-q:focus-visible,#mesa .en-s:focus-visible,#mesa .en-p:focus-visible,#mesa .en-acu:focus-visible,#mesa .en-mas:focus-visible,#mesa .en-l:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
#mesa .en-d{font-size:13px;color:var(--ink-2);font-variant-numeric:tabular-nums;white-space:nowrap}
#mesa .en-f.pasada .en-d{color:var(--red);font-weight:600}
#mesa .en-t{display:flex;flex-direction:column;gap:1px;min-width:0}
#mesa .en-vf{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:52px;padding:8px 0;border-top:1px solid var(--line-2,var(--line))}
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
#mesa .en-q svg,#mesa .en-mas svg,#mesa .en-l svg,#mesa .en-s svg{fill:none;stroke:currentColor;stroke-width:1.33;stroke-linecap:round;stroke-linejoin:round}
#mesa .en-q svg :is(path,circle),#mesa .en-mas svg path,#mesa .en-l svg path,#mesa .en-s svg :is(path,circle){vector-effect:non-scaling-stroke}
#mesa .en-f .en-t span.en-cad{display:inline;color:var(--chg);font-weight:600}#mesa .en-f .en-t span.en-sc{white-space:normal}   /* its line goes on below: «caduca», the last, is never the one lost (second round) */   /* a WeTransfer link expires: only Kevin sees it (D-312) */
#mesa .cont>.cont-der .en-t b,#mesa .cont>.cont-der .en-t span{white-space:normal;overflow:visible;text-overflow:clip}   /* the agreement's column, 280–340 px: its lines go on below, never cut (D-312) */
@media (prefers-reduced-motion:reduce){#mesa .en-q:hover,#mesa .en-s:hover,#mesa .en-p:hover{transition:none}}
`;
})();
