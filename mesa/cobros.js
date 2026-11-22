// Cobros — Mesa de trabajo · v1.0 (D-232 a D-237)
// A client's invoices as they are drawn and done: the «Cobros» tab of «Editar cliente» (a monthly client: its fee and the
// table of its invoices), the same table in a sporadic client's file (sesiones.js) and «Tus pagos» in the vista cliente
// (only that client's, through M._in.vc). The data, its states and its sums live in mesa.js (M._in.cob, M.cobros): here a
// PDF is never read to draw a line. If this file doesn't load, «Editar cliente» is the one of always and the client sees no
// «Tus pagos».
(function cobrosBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.2';   // 1.2: «Acuerdo» instead of «Cuota mensual» — how often it pays, from when, for how long, whether it renews and when to renegotiate, with its line; «+ Factura» of its stretch; in «Tus pagos», «al mes» only if it pays each month and each invoice by its first month, as the client's web gets them until lot D (D-288). 1.1: a PDF that hasn't come down from the server yet (lot 4 of the traspaso) says so (D-259)
  const I = () => M._in, C = () => M._in.cob, P = () => (M.personal && M.personal._p) || null;
  if (M.cobrosUI && M.cobrosUI._off) { try { M.cobrosUI._off(); } catch (e) { /* */ } }
  const OFF = [];
  const on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoy = () => I().hoy();
  const toast = (m, o) => I().toast(m, o);
  const UNDO = 6000;

  // ---------- icons (Lucide, the mesa's stroke, D-168) ----------
  const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
  const IC = {
    euro: svg('<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>'),
    descarga: svg('<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'),
    subir: svg('<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'),
    doc: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
    ok: svg('<path d="M20 6 9 17l-5-5"/>'),
    reloj: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    alerta: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    mas: svg('<path d="M5 12h14"/><path d="M12 5v14"/>')
  };

  // ---------- words ----------
  const eur = n => C().eur(n);
  const mesTxt = (m, h) => { const n = C().MESES[+m.slice(5, 7) - 1]; return n + (m.slice(0, 4) !== h.slice(0, 4) ? ' ' + m.slice(0, 4) : ''); };
  const corto = (d, h) => d ? C().corto(d) + (d.slice(0, 4) !== (h || hoy()).slice(0, 4) ? ' ' + d.slice(0, 4) : '') : '';
  const may = t => t.charAt(0).toUpperCase() + t.slice(1);
  // what Kevin sees of each one: its state and the date that matters
  function estK(r, h) {
    const e = C().estado(r, h);
    if (e.k === 'cobrada') return { k: e.k, cls: 'ok', t: 'Cobrada', f: 'cobrada el ' + corto(r.cobrada, h) };
    if (e.k === 'retrasada') return { k: e.k, cls: 'tarde', t: `Retrasada ${e.dias} día${e.dias === 1 ? '' : 's'}`, f: 'venció el ' + corto(r.vence, h), dias: e.dias };
    if (e.k === 'pendiente') return { k: e.k, cls: 'pend', t: 'Pendiente', f: r.vence ? 'vence el ' + corto(r.vence, h) : 'emitida el ' + corto(r.emitida, h) };
    return { k: e.k, cls: 'sin', t: 'Sin emitir', f: r.emitida ? 'se emite el ' + corto(r.emitida, h) : 'sin fecha' };
  }
  const pdfNombre = (r, h) => (r.factura || C().nombre(r, h)) + '.pdf';
  const facturaDe = (r, h) => r.factura ? 'factura ' + r.factura : 'factura de ' + (C().MES.test(r.periodo || '') ? mesTxt(r.periodo, h) : C().nombre(r, h));

  // ---------- the table (a monthly client in «Editar cliente», a sporadic one in its file) ----------
  const UI = { det: null, ant: new Set() };      // the invoice whose dates are open; the clients whose older payments show
  const cliRec = id => I().CL.find(c => c.id === id) || null;
  // the agreement (D-288): how often it pays, each payment, the day it's issued and its term; from when, for how long, whether it
  // renews and when to renegotiate (only Kevin's); a line that sums it up under them
  const MESC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const acuVal = (a, k) => {                     // what each field shows, as it's kept
    if (!a) return '';
    if (k === 'importe') return a.importe != null ? eur(a.importe) : '';
    if (k === 'dia') return a.dia != null ? String(a.dia) : '';
    if (k === 'plazo') return a.plazo != null ? `${a.plazo} ${a.plazo === 1 ? 'día' : 'días'}` : '';
    if (k === 'desde') return a.desde ? `${MESC[+a.desde.slice(5, 7) - 1]} ${a.desde.slice(0, 4)}` : '';
    if (k === 'meses') return a.meses ? `${a.meses} ${a.meses === 1 ? 'mes' : 'meses'}` : '';
    return '';
  };
  function cuotaHTML(c) {
    const a = C().acuerdo ? C().acuerdo(c) : null, pago = a ? a.pago : 'mensual', renueva = !a || a.renueva !== false, sinFin = !a || !a.meses;
    const campo = (k, l, ph, im) => `<div><label for="co-a-${k}">${l}</label><input id="co-a-${k}" type="text" class="co-q" data-co="cuota" data-k="${k}" inputmode="${im}" autocomplete="off" value="${esc(acuVal(a, k))}" placeholder="${ph}"></div>`;
    const res = C().resumen ? C().resumen(c) : '';
    return `<div class="co-acu-t"><h4>Acuerdo</h4><span>«Renegociar el» solo lo ves tú</span></div><div class="co-cuota co-acu">`
      + `<div><label for="co-a-pago">Pago</label><select id="co-a-pago" class="co-q" data-co="cuota" data-k="pago">${(C().PAGOS || [['mensual', 'Cada mes']]).map(([v, t]) => `<option value="${v}"${v === pago ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`
      + campo('importe', 'Importe de cada pago', 'Importe', 'decimal') + campo('dia', 'Se emite el día', '1-28', 'numeric') + campo('plazo', 'Vence a los', 'Días', 'numeric')
      + campo('desde', 'Cubre desde', 'may 2026', 'text') + campo('meses', 'Duración', 'Sin fin', 'numeric')
      + `<div><label for="co-a-renueva">Al acabar</label><select id="co-a-renueva" class="co-q" data-co="cuota" data-k="renueva"${sinFin ? ' disabled title="Sin duración, no acaba"' : ''}><option value="si"${renueva ? ' selected' : ''}>Se renueva</option><option value="no"${renueva ? '' : ' selected'}>Se acaba</option></select></div>`
      + `<div><label for="co-a-renegociar">Renegociar el</label><input id="co-a-renegociar" type="date" class="co-q" data-co="cuota" data-k="renegociar" data-sin-fecha value="${esc((a && a.renegociar) || '')}" aria-label="Renegociar el acuerdo el"></div>`
      + `</div><p class="co-acu-n"${res ? '' : ' hidden'}>${esc(res)}</p>`;
  }
  // a month written as «may 2026», «mayo 2026», «05/2026» or «2026-05»; '' empty; undefined, not a month
  function leerMes(v) {
    v = String(v || '').trim().toLowerCase(); if (!v) return '';
    let m = v.match(/^(\d{4})-(\d{1,2})$/); if (m) return +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2].padStart(2, '0')}` : undefined;
    m = v.match(/^(\d{1,2})\s*[/.-]\s*(\d{4})$/); if (m) return +m[1] >= 1 && +m[1] <= 12 ? `${m[2]}-${m[1].padStart(2, '0')}` : undefined;
    m = v.match(/^([a-záéíóúñ]+)\.?(?:\s+de)?\s+(\d{4})$/); if (m) { const i = MESC.findIndex(x => m[1].startsWith(x) || (x === 'sep' && m[1].startsWith('set'))); return i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, '0')}` : undefined; }
    return undefined;
  }
  function filaHTML(r, h, esp) {
    const s = estK(r, h), id = esc(r.id), nom = C().nombre(r, h), quien = esc(nom), abierta = UI.det === r.id;
    const pdf = r.pdf
      ? `<span class="co-pdf"><button type="button" class="co-pn" data-co="ver-pdf" title="Descargar el PDF">${IC.doc}<span>${esc(pdfNombre(r, h))}</span></button><button type="button" class="co-x" data-co="quitar" aria-label="Quitar el PDF de ${quien}" title="Quitar el PDF">${IC.x}</button></span>`
      : `<button type="button" class="co-mini" data-co="subir" title="O suelta el PDF sobre la fila">${IC.subir}Subir PDF</button>`;
    const acc = s.k === 'cobrada' ? '' : `<button type="button" class="co-mini" data-co="cobrada" title="Cobrada hoy">${IC.ok}Cobrada</button>`;
    const fila = `<tr class="co-f" data-id="${id}"><td class="co-m">${quien}</td>`
      + `<td class="co-n" data-l="Factura"><input type="text" class="co-in" data-co="num" maxlength="40" autocomplete="off" value="${esc(r.factura || '')}" placeholder="Nº" aria-label="Número de la factura de ${quien}"></td>`
      + `<td class="co-i" data-l="Importe"><input type="text" class="co-in co-imp" data-co="imp" inputmode="decimal" autocomplete="off" value="${+r.importe ? esc(eur(r.importe)) : ''}" placeholder="Importe" aria-label="Importe de ${quien}"></td>`
      + `<td class="co-s"><span class="co-e ${s.cls}">${esc(s.t)}</span></td>`
      + `<td class="co-fc"><button type="button" class="co-fe" data-co="fechas" aria-expanded="${abierta}" aria-controls="co-d-${id}" title="Fechas de emisión, vencimiento y cobro">${esc(s.f)}</button></td>`
      + `<td class="co-p">${pdf}</td><td class="co-a">${acc}</td></tr>`;
    const fecha = (k, t) => `<label class="co-fl"><span>${t}</span><input type="date" data-co="fecha" data-k="${k}" data-sin-fecha value="${esc(r[k] || '')}" aria-label="${t} · ${quien}"></label>`;
    const det = abierta ? `<tr class="co-det" data-id="${id}" data-p="det" id="co-d-${id}"><td colspan="7"><div class="co-fs">${fecha('emitida', 'Emitida')}${fecha('vence', 'Vence')}${fecha('cobrada', 'Cobrada')}</div></td></tr>` : '';
    return fila + det;
  }
  const mesNueva = (cli, h) => { const ms = C().vivos(cli).filter(r => C().MES.test(r.periodo || '')).map(r => C().hasta ? C().hasta(r) : r.periodo).sort(); return ms.length ? I().addMonths(ms[ms.length - 1], 1) : h.slice(0, 7); };   // after its last month (a stretch's, D-288)
  // the sessions of a sporadic client that have no invoice of it yet (one per session and client, D-234)
  function sesSinCobro(cli) {
    const p = P(); if (!p || !p.TK) return [];
    const usadas = new Set(C().vivos(cli).map(r => r.periodo));
    return [...p.TK.values()].filter(k => k.tipo === 'sesion' && !k._b && !(k.sesion && k.sesion.clase === 'reunion') && (Array.isArray(k.clientes) ? k.clientes : [k.cliente]).includes(cli) && !usadas.has(k.id))   // a meeting has no payment (D-291)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  }
  // «+ Factura» of a monthly client: the next stretch without an invoice, from the month after the last one invoiced (D-288)
  function pieMensual(cli, h) {
    const c = cliRec(cli), q = C().cuota(c), m = mesNueva(cli, h), t = q && C().libre ? C().libre(q, C().vivos(cli), m) : q ? { de: m, hasta: m, importe: q.importe } : null;
    const n0 = C().nombre({ periodo: t ? t.de : m, ...(t && t.hasta !== t.de ? { hasta: t.hasta } : {}) }, h), nom = n0.charAt(0).toLowerCase() + n0.slice(1);   // as the table names it
    return `<button type="button" class="co-mas" data-co="nueva" data-m="${t ? t.de : m}" data-h="${t ? t.hasta : m}" data-i="${t ? t.importe : ''}"${t ? '' : q ? ' disabled title="El acuerdo ya acabó"' : ' disabled title="Pon antes el importe, el día en que se emite y a cuántos días vence (y desde cuándo cubre, si no paga cada mes)"'}>${IC.mas}Factura de ${esc(nom)}</button>`;
  }
  // the table of a client's invoices, newest first; o.esp: a sporadic client (a session each, no fee)
  function tabla(cli, o = {}) {
    const h = hoy(), l = C().vivos(cli).sort(C().orden), c = o.esp ? null : cliRec(cli);
    let pie;
    if (o.esp) {
      const ss = sesSinCobro(cli), n = ss.length;
      pie = `<button type="button" class="pp-cmas" data-co="nuevo-ses"${n ? '' : ` disabled title="${C().vivos(cli).length ? 'Todas sus sesiones tienen su cobro' : 'Aún no tiene sesiones'}"`}>${IC.mas}Cobro</button>`;
    } else {
      pie = pieMensual(cli, h);
    }
    const cuerpo = l.length
      ? `<table class="co-t"><thead><tr><th>${o.esp ? 'Sesión' : 'Mes'}</th><th>Factura</th><th class="co-i">Importe</th><th>Estado</th><th>Fecha</th><th>PDF</th><th><span class="co-vh0">Acción</span></th></tr></thead><tbody>${l.map(r => filaHTML(r, h, o.esp)).join('')}</tbody></table>`
      : `<p class="co-vacio">Aún sin ${o.esp ? 'cobros' : 'facturas'}</p>`;
    return `<div class="co${o.esp ? ' co-esp' : ''}" data-co-cli="${esc(cli)}">${o.esp ? '' : cuotaHTML(c)}${cuerpo}<div class="co-pie">${pie}</div></div>`;
  }
  // what the sporadic client's file compares to draw itself again (D-223)
  const firma = cli => { const h = hoy(); return JSON.stringify([h, UI.det, C().vivos(cli).sort(C().orden).map(r => [r.id, r.at]), sesSinCobro(cli).map(k => k.id)]); };

  // ---------- drawing again ----------
  const morf = (el, html) => { const p = P(); if (p && p.morfar) p.morfar(el, html); else el.innerHTML = html; };
  const pane = () => { const r = I().root && I().root(); return r ? r.querySelector('.detail[data-dlg="editclient"] .co-pane') : null; };
  function pintar() {
    const d = pane(); if (d) morf(d, tabla(d.dataset.coCli));
    const p = P(); if (p && p.CARD && p.CARD.ext && p.CARD.ext.cls === 'pp-ficha' && p.pintarCard) p.pintarCard();   // a sporadic client's file
    const r = I().root && I().root(); if (r && r.classList.contains('client') && I().vc) I().vc.pintar();   // «Tus pagos»
  }
  const filaDe = el => el && el.closest ? el.closest('tr.co-f[data-id], tr.co-det[data-id]') : null;
  const cliDe = el => { const t = el && el.closest && el.closest('[data-co-cli]'); return t ? t.dataset.coCli : null; };
  const enfocar = sel => requestAnimationFrame(() => { const e = (I().root() || document).querySelector(sel); if (e) e.focus({ preventScroll: false }); });
  const fallo = e => toast('No se pudo: ' + String((e && e.message) || e), { ms: 8000, key: 'fallo' });

  // ---------- doing ----------
  async function guardar(id, cambio) {               // over the record as it is when written (D-232)
    try { return await C().parche(id, cambio); } catch (e) { fallo(e); return null; }
  }
  async function cuota(inp) {                      // a field of the agreement (D-288), saved on its own
    const cid = cliDe(inp), c = cliRec(cid); if (!c) return;
    const a0 = C().acuerdo(c) || { pago: 'mensual', importe: null, dia: null, plazo: null, desde: '', meses: null, renueva: true, renegociar: '' }, k = inp.dataset.k, v = String(inp.value || '').trim();
    let val = null;
    if (k === 'pago') val = v || 'mensual';
    else if (k === 'renueva') val = v !== 'no';
    else if (k === 'renegociar') val = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : v ? undefined : '';
    else if (k === 'desde') val = leerMes(v);
    else if (v) {
      if (k === 'importe') { val = C().importe(v); if (isNaN(val) || !(val > 0)) val = undefined; }
      else if (k === 'dia') { val = /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 28 ? +v : undefined; }
      else if (k === 'meses') { const m = v.match(/^(\d{1,3})\s*(mes(es)?)?$/i); val = m && +m[1] >= 1 && +m[1] <= 120 ? +m[1] : undefined; }
      else { const m = v.match(/^(\d{1,3})\s*(d[ií]as?)?$/i); val = m && +m[1] <= 365 ? +m[1] : undefined; }
    }
    if (val === undefined) {
      toast({ importe: 'El importe no es válido (450 o «1.470,50»).', dia: 'El día en que se emite va del 1 al 28.', plazo: 'El plazo son los días hasta que vence (de 0 a 365).', desde: 'Escribe el mes y el año: «may 2026».', meses: 'La duración son meses, de 1 a 120 (vacía, sin fin).', renegociar: 'No es una fecha.' }[k] || 'No es válido.');
      pintarCuota(inp, c); return;
    }
    const texto = k === 'desde' || k === 'renegociar';
    if (texto ? (a0[k] || '') === val : (a0[k] ?? null) === val) { pintarCuota(inp, c); return; }
    const a = { ...a0, [k]: val };
    const vacia = a.pago === 'mensual' && a.importe == null && a.dia == null && a.plazo == null && !a.desde && !a.meses && !a.renegociar;
    try { await C().acuGuardar(cid, vacia ? null : a); } catch (e) { fallo(e); }
    const c2 = cliRec(cid); pintarCuota(inp, c2);
    const caja = inp.closest('.co'); if (caja) {     // its line, «Al acabar» and «+ Factura» change with it (the fields stay as they are)
      const n = caja.querySelector('.co-acu-n'), res = C().resumen ? C().resumen(c2) : ''; if (n) { n.textContent = res; n.hidden = !res; }
      const ren = caja.querySelector('[data-k="renueva"]'), a = C().acuerdo(c2); if (ren) { ren.disabled = !(a && a.meses); ren.title = ren.disabled ? 'Sin duración, no acaba' : ''; }
      const pie = caja.querySelector('.co-pie'); if (pie) pie.innerHTML = pieMensual(cid, hoy());
    }
  }
  function pintarCuota(inp, c) {                    // the field as it's kept (also the one with the focus)
    const a = C().acuerdo(c), k = inp.dataset.k;
    if (k === 'pago') inp.value = a ? a.pago : 'mensual';
    else if (k === 'renueva') inp.value = !a || a.renueva !== false ? 'si' : 'no';
    else if (k === 'renegociar') inp.value = (a && a.renegociar) || '';
    else inp.value = acuVal(a, k);
  }
  async function numero(inp) {
    const f = filaDe(inp), r = f && C().get(f.dataset.id); if (!r) return;
    const v = inp.value.trim().slice(0, 40); if (v === (r.factura || '')) { inp.value = v; return; }
    await guardar(r.id, { factura: v });
  }
  async function importe(inp) {
    const f = filaDe(inp), r = f && C().get(f.dataset.id); if (!r) return;
    const v = inp.value.trim(), n = v ? C().importe(v) : 0;
    if (isNaN(n)) { toast('El importe no es válido (450 o «1.470,50»).'); inp.value = +r.importe ? eur(r.importe) : ''; return; }
    inp.value = n ? eur(n) : '';
    if (n !== (+r.importe || 0)) await guardar(r.id, { importe: n });
  }
  async function fecha(inp) {
    const f = filaDe(inp), r = f && C().get(f.dataset.id); if (!r) return;
    const k = inp.dataset.k, v = inp.value || '';
    if (v === (r[k] || '')) return;
    const n = { ...r, [k]: v };
    if (n.emitida && n.vence && n.vence < n.emitida) { toast('Vence antes de emitirse: no se cambia.'); pintar(); return; }
    await guardar(r.id, { [k]: v });
  }
  async function nueva(btn) {
    const cid = cliDe(btn), c = cliRec(cid), q = C().cuota(c); if (!q) return;
    const m = btn.dataset.m, h = btn.dataset.h, id = C().nuevoId();   // its stretch (D-288)
    const imp = +btn.dataset.i > 0 ? +btn.dataset.i : q.importe;   // a part of its stretch, in proportion (D-288)
    try { await C().guardar({ id, cliente: cid, periodo: m, ...(h && h > m ? { hasta: h } : {}), concepto: '', importe: imp, factura: '', ...C().fechas(m, q), cobrada: '', pdf: '' }); } catch (e) { fallo(e); return; }
    enfocar(`tr.co-f[data-id="${id}"] [data-co="num"]`);
  }
  function nuevoSes(btn) {
    const cid = cliDe(btn), p = P(), ss = sesSinCobro(cid); if (!p || !ss.length) return;
    const r = btn.getBoundingClientRect();
    p.abrirMenu(r.left, r.bottom + 4, ss.map(k => [k.id, esc(k.txt || 'Sesión') + (k.fecha ? ` <span class="co-mf">· ${esc(corto(k.fecha))}</span>` : ''), async () => {
      const id = C().nuevoId();
      try { await C().guardar({ id, cliente: cid, periodo: k.id, concepto: String(k.txt || 'Sesión'), importe: 0, factura: '', emitida: '', vence: '', cobrada: '', pdf: '' }); } catch (e) { fallo(e); return; }
      enfocar(`tr.co-f[data-id="${id}"] [data-co="imp"]`);
    }]), btn);
  }
  async function cobrada(btn) {
    const f = filaDe(btn); if (!f) return; const id = f.dataset.id;
    if (await guardar(id, { cobrada: hoy() })) enfocar(`tr.co-f[data-id="${id}"] [data-co="fechas"]`);
  }
  function fechas(btn) {
    const f = filaDe(btn); if (!f) return; const id = f.dataset.id;
    UI.det = UI.det === id ? null : id; pintar();
    if (UI.det) enfocar(`tr.co-det[data-id="${id}"] .co-fl .mx-f, tr.co-det[data-id="${id}"] .co-fl input`);
  }
  // a PDF: «Subir PDF», a drop on its row or Claude (M.cobros.adjuntar); only PDF, up to 10 MB
  let elegir = null;
  function subir(id) {
    if (!elegir) { elegir = document.createElement('input'); elegir.type = 'file'; elegir.accept = 'application/pdf,.pdf'; elegir.hidden = true; elegir.className = 'co-archivo'; document.body.append(elegir);
      elegir.addEventListener('change', () => { const f = elegir.files && elegir.files[0], i = elegir.dataset.id; elegir.value = ''; if (f && i) poner(i, f); }); }
    elegir.dataset.id = id; elegir.click();
  }
  async function poner(id, file) {
    let x; try { x = await C().pdfPoner(id, file, file.name); } catch (e) { fallo(e); return; }
    if (x.error) { toast(x.error, { ms: 6000 }); return; }
    enfocar(`tr.co-f[data-id="${id}"] [data-co="ver-pdf"]`);
    if (x.antes) toast('PDF sustituido.', { action: 'Deshacer', ms: UNDO, onAction: async () => { try { await C().pdfVolver(id, x.antes); } catch (e) { fallo(e); } } });   // one dropped by mistake on another row
  }
  async function quitar(btn) {
    const f = filaDe(btn), r = f && C().get(f.dataset.id); if (!r || !r.pdf) return;
    let g = null; try { const x = await I().idbGet('cfacturas', r.pdf); if (x && x.blob instanceof Blob) g = { ...x, blob: new Blob([await x.blob.arrayBuffer()], { type: 'application/pdf' }) }; else if (x && x.blob) g = { ...x }; } catch (e) { /* */ }   // its bytes, for «Deshacer»
    if (!(await guardar(r.id, { pdf: '' }))) return;
    enfocar(`tr.co-f[data-id="${r.id}"] [data-co="subir"]`);
    toast('PDF quitado.', { action: 'Deshacer', ms: UNDO, onAction: async () => { try { await C().pdfVolver(r.id, g); } catch (e) { fallo(e); } } });
  }
  async function borrar(id) {
    const r = C().get(id); if (!r || r.borrado) return;
    const tab = r.cliente, sig = (() => { const t = I().root().querySelector(`tr.co-f[data-id="${CSS.escape(id)}"]`); let n = t && t.nextElementSibling; while (n && !n.matches('tr.co-f')) n = n.nextElementSibling; return n ? n.dataset.id : null; })();
    let x; try { x = await C().borrar(id); } catch (e) { fallo(e); return; }
    if (!x) return;
    if (UI.det === id) UI.det = null;
    enfocar(sig ? `tr.co-f[data-id="${sig}"] [data-co="num"]` : `[data-co-cli="${tab}"] .co-mas, [data-co-cli="${tab}"] [data-co="nuevo-ses"]`);
    toast('Factura borrada.', { action: 'Deshacer', ms: UNDO, onAction: async () => { try { await C().devolver(x); } catch (e) { fallo(e); } } });
  }
  async function descargar(id, comoCliente) {
    const r = C().get(id); if (!r || !r.pdf) return;
    let f = null; try { f = await I().idbGet('cfacturas', r.pdf); } catch (e) { /* */ }
    if (!f || !(f.blob instanceof Blob)) { toast(f && f.blob ? 'Ese PDF aún no ha llegado a este ordenador: llega en un momento.' : 'Ese PDF ya no está en este navegador.'); return; }
    const h = hoy(), nom = (r.factura ? 'Factura ' + r.factura : 'Factura de ' + (C().MES.test(r.periodo || '') ? mesTxt(r.periodo, h) : C().nombre(r, h))).replace(/[\\/:*?"<>|]+/g, '-') + '.pdf';
    const url = URL.createObjectURL(f.blob), a = document.createElement('a');
    a.href = url; a.download = nom; a.hidden = true; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (!comoCliente) return;
  }
  function menuFila(id, x, y, foco) {
    const p = P(); if (!p || !p.abrirMenu) return;
    p.abrirMenu(x, y, [['co-borrar', 'Borrar factura', () => borrar(id)]], foco);
  }

  // ---------- the tabs of «Editar cliente» ----------
  function tab(t, foco) {
    const d = I().root().querySelector('.detail[data-dlg="editclient"]'); if (!d) return;
    d.querySelectorAll('.ectab').forEach(b => { const si = b.dataset.t === t; b.classList.toggle('on', si); b.setAttribute('aria-selected', String(si)); b.tabIndex = si ? 0 : -1; });
    const fd = d.querySelector('#ecp-datos'), fc = d.querySelector('#ecp-cobros'); if (fd) fd.hidden = t !== 'datos'; if (fc) fc.hidden = t !== 'cobros';
    if (foco) { const b = d.querySelector(`.ectab[data-t="${t}"]`); if (b) b.focus(); }
  }

  // ---------- «Tus pagos» (vista cliente): only this client's, never Kevin's sums nor another client ----------
  function pagosHTML(ctx) {
    const cli = ctx && ctx.cliente; if (!cli) return '';
    const h = hoy(), c = cliRec(cli), q = C().cuota(c), l = C().vivos(cli).map(r => ({ r, e: C().estado(r, h) }));
    const deber = l.filter(x => x.e.k === 'pendiente' || x.e.k === 'retrasada').sort((a, b) => C().clave(a.r).localeCompare(C().clave(b.r)));
    const pagadas = l.filter(x => x.e.k === 'cobrada').sort((a, b) => C().orden(a.r, b.r));
    const prox = C().proxima(cli, h);
    if (!q && !deber.length && !pagadas.length && !prox) return '';
    const venc = deber.filter(x => x.e.k === 'retrasada').length, suma = deber.reduce((n, x) => n + (+x.r.importe || 0), 0);
    const ver = UI.ant.has(cli), N = Math.max(0, pagadas.length - 3);
    const linea = ({ r, e }) => {
      const nom = C().nombre(r, h, true), nf = r.factura ? 'la factura ' + r.factura : 'la factura de ' + nom.toLowerCase();
      const t = e.k === 'cobrada' ? 'pagada el ' + corto(r.cobrada, h) : e.k === 'retrasada' ? 'venció el ' + corto(r.vence, h) : r.vence ? 'vence el ' + corto(r.vence, h) : 'emitida el ' + corto(r.emitida, h);
      const chip = e.k === 'cobrada' ? `<span class="co-ce ok">${IC.ok}Pagada</span>` : e.k === 'retrasada' ? `<span class="co-ce rojo">${IC.alerta}Pendiente</span>` : `<span class="co-ce pend">${IC.reloj}Pendiente</span>`;
      const dl = r.pdf ? `<button type="button" class="co-dw" data-co="dl" data-id="${esc(r.id)}" title="Descargar ${esc(nf)} (PDF)" aria-label="Descargar ${esc(nf)} (PDF)">${IC.descarga}</button>` : '<span class="co-dw0"></span>';
      return `<li data-id="${esc(r.id)}"><span class="m">${esc(nom)} · ${esc(eur(r.importe))}</span><span class="n">${r.factura ? 'Factura ' + esc(r.factura) + '<span class="co-pt"> · </span><span class="co-nw">' + esc(t) + '</span>' : `<span class="co-nw">${esc(may(t))}</span>`}</span>${chip}${dl}</li>`;
    };
    const lis = [...deber, ...pagadas.slice(0, 3), ...(ver ? pagadas.slice(3) : [])].map(linea).join('');
    const px = prox ? `<p class="co-vprox">${IC.doc}La de ${esc(C().MESES[+prox.mes.slice(5, 7) - 1])} se emite ${prox.emitida >= h ? 'el ' + esc(corto(prox.emitida, h)) : 'en unos días'}</p>` : '';
    return `<div class="co-pagos"><h2 class="co-vh">Tus pagos${q && q.pago === 'mensual' ? ` <span>${esc(eur(q.importe))} al mes</span>` : ''}</h2>`
      + (deber.length ? `<p class="co-vp">Pendiente de pago <b>${esc(eur(suma))}</b>${venc ? ` <span class="rojo">· ${venc} vencida${venc === 1 ? '' : 's'}</span>` : ''}</p>` : '')
      + (lis ? `<ul class="co-vl">${lis}</ul>` : '')
      + (N ? `<button type="button" class="co-ver" data-co="ver-ant" data-c="${esc(cli)}" aria-expanded="${ver}">${ver ? 'Ocultar las anteriores' : `Ver las anteriores (${N})`}</button>` : '')
      + px + `</div>`;
  }

  // ---------- events ----------
  function alClic(e) {
    const b = e.target.closest && e.target.closest('[data-co]'); if (!b || b.disabled) return;
    const k = b.dataset.co;
    if (e.detail > 1 && k !== 'tab') return;      // the second click of a double click does nothing (lesson 57): no second invoice, no chooser under the ×
    if (k === 'tab') { tab(b.dataset.t, true); return; }
    if (k === 'dl') { e.preventDefault(); descargar(b.dataset.id, true); return; }
    if (k === 'ver-ant') { const c = b.dataset.c; if (UI.ant.has(c)) UI.ant.delete(c); else UI.ant.add(c); if (I().vc) I().vc.pintar(); enfocar('[data-co="ver-ant"]'); return; }
    const f = filaDe(b);
    if (k === 'nueva') nueva(b);
    else if (k === 'nuevo-ses') nuevoSes(b);
    else if (k === 'fechas') fechas(b);
    else if (k === 'cobrada') cobrada(b);
    else if (k === 'subir' && f) subir(f.dataset.id);
    else if (k === 'quitar') quitar(b);
    else if (k === 'ver-pdf' && f) descargar(f.dataset.id, false);
  }
  let colaQ = Promise.resolve();                // the fee's fields one after another: each one reads what the last one saved
  function alCambiar(e) {
    const t = e.target; if (!t.dataset || !t.dataset.co) return;
    const k = t.dataset.co;
    if (k === 'cuota') { colaQ = colaQ.then(() => cuota(t)).catch(() => {}); } else if (k === 'num') numero(t); else if (k === 'imp') importe(t); else if (k === 'fecha') fecha(t);
  }
  function alTecla(e) {
    const t = e.target;
    if (t.classList && t.classList.contains('ectab') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const ts = [...t.parentNode.querySelectorAll('.ectab')], i = ts.indexOf(t), n = e.key === 'Home' ? 0 : e.key === 'End' ? ts.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + ts.length) % ts.length;
      e.preventDefault(); e.stopPropagation(); tab(ts[n].dataset.t, true); return;
    }
    const k = t.dataset && t.dataset.co;
    if (k === 'cuota' || k === 'num' || k === 'imp') {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); alCambiar({ target: t }); return; }
      if (e.key === 'Escape') { escCampo(e); return; }   // first Esc puts the field back; the next one closes what is open
    }
    const f = filaDe(t);
    if (f && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); e.stopPropagation(); const r = t.getBoundingClientRect(); menuFila(f.dataset.id, r.left, r.bottom + 4, t); }
  }
  // Esc in a field that changed: back to what is saved, and nothing else closes (true); else false
  function escCampo(e) {
    const t = e.target, k = t && t.dataset && t.dataset.co; if (k !== 'cuota' && k !== 'num' && k !== 'imp') return false;
    const c = cliRec(cliDe(t)), f = filaDe(t), r = f && C().get(f.dataset.id);
    const v0 = k === 'cuota' ? (() => { const x = document.createElement('input'); x.dataset.k = t.dataset.k; pintarCuota(x, c); return x.value; })() : k === 'num' ? (r && r.factura) || '' : r && +r.importe ? eur(r.importe) : '';
    if (t.value === v0) return false;
    e.preventDefault(); e.stopPropagation(); t.value = v0; return true;
  }
  function alMenu(e) {
    const f = filaDe(e.target); if (!f || !f.closest('.co')) return;
    e.preventDefault(); e.stopPropagation(); menuFila(f.dataset.id, e.clientX, e.clientY);
  }
  const hayArchivos = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
  let sobre = null;
  const marca = f => { if (sobre && sobre !== f) sobre.classList.remove('co-drop'); sobre = f; if (f) f.classList.add('co-drop'); };
  function alArrastre(e) {
    const f = e.target.closest && e.target.closest('tr.co-f[data-id]');
    if (e.type === 'dragleave') { if (sobre && (!e.relatedTarget || !sobre.contains(e.relatedTarget))) marca(null); return; }
    if (!f || !hayArchivos(e)) { if (e.type === 'drop' || !f) marca(null); return; }
    e.preventDefault(); e.stopPropagation();       // never to the tray nor to a post (mesa.js)
    if (e.type === 'dragover' || e.type === 'dragenter') { e.dataTransfer.dropEffect = 'copy'; marca(f); return; }
    marca(null); const file = e.dataTransfer.files && e.dataTransfer.files[0]; if (file) poner(f.dataset.id, file);
  }
  let dia = null;
  function alMinuto() { const h = hoy(); if (dia && h !== dia) pintar(); dia = h; }   // past midnight in Madrid the states change (D-121)

  // ---------- mounting ----------
  let listoP = null;
  const listo = () => listoP || (listoP = new Promise((res, rej) => { const t0 = Date.now(), t = setInterval(() => { if (I() && I().cob && I().vc && I().estilo) { clearInterval(t); res(); } else if (Date.now() - t0 > 30000) { clearInterval(t); rej(new Error('mesa.js sin cobros')); } }, 50); }));
  M.cobrosUI = {
    version: VERSION,
    pane: cli => tabla(cli),                       // the «Cobros» tab of «Editar cliente» (mesa.js)
    tabla, firma, html: (cli, o) => tabla(cli, o), pagos: pagosHTML, estK, IC, tab, escCampo,
    abierto: () => { UI.det = null; }, cerrado: () => { UI.det = null; },
    _test: { UI, descargar, borrar },
    _off: () => { OFF.splice(0).forEach(f => f()); if (I() && I().vc) I().vc.quitar('lado', 'pagos'); }
  };
  listo().then(() => {
    on(document, 'click', alClic);
    on(document, 'change', alCambiar);
    on(document, 'keydown', alTecla, true);
    on(document, 'contextmenu', alMenu, true);
    for (const ty of ['dragenter', 'dragover', 'dragleave', 'drop']) on(document, ty, alArrastre, true);
    on(document, 'mesa-cobros', pintar);
    const t = setInterval(alMinuto, 60000); OFF.push(() => clearInterval(t)); dia = hoy();
    I().vc.poner('lado', { id: 'pagos', orden: 10, html: pagosHTML });
    I().estilo('mesa-co-css', ESTILO);
    const d = pane(); if (d) pintar();
  }).catch(() => { (window.MESA_CARGA = window.MESA_CARGA || {}).cobros = 'fallo'; });   // a mesa.js without invoices (an old cached one): «Editar cliente» as always

  const ESTILO = `
#mesa .ectabs{display:flex;gap:4px;margin:4px 0 16px}
#mesa .ectab{border:0;background:none;font:inherit;font-size:14px;padding:6px 12px;border-radius:var(--r-pill);color:var(--mute);cursor:pointer;transition:background var(--d1) ease-out,color var(--d1) ease-out,transform var(--d1) ease-out}
#mesa .ectab:hover:not(.on){background:var(--co-hov,var(--bg-2));color:var(--ink)}#mesa .ectab.on{background:var(--ink);color:var(--on-ink);font-weight:600;cursor:default}
#mesa .ectab:focus-visible{outline:2px solid var(--focus);outline-offset:2px}#mesa .ectab:active:not(.on){transform:scale(.97)}
#mesa .co{container-type:inline-size;font-size:13px;color:var(--ink)}
#mesa .card.ec2{--co-sep:var(--line2);--co-hov:var(--bg-2)}:root[data-theme="dark"] #mesa .card.ec2,#mesa[data-theme="dark"] .card.ec2{--co-sep:var(--line);--co-hov:var(--bg)}
#mesa .co svg,#mesa .co-pagos svg,#mesa .co-mf svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:var(--i-trazo);stroke-linecap:round;stroke-linejoin:round}
#mesa .co svg *,#mesa .co-pagos svg *{vector-effect:non-scaling-stroke}
#mesa .co-cuota{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 18px}
#mesa .co-acu-t{display:flex;align-items:baseline;gap:10px;margin:0 0 10px}#mesa .co-acu-t h4{margin:0;font-size:15px;font-weight:800;letter-spacing:-.015em;color:var(--ink)}#mesa .co-acu-t span{font-size:12.5px;color:var(--mute)}
#mesa .co-cuota.co-acu{grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 8px}
#mesa .co-acu-n{margin:0 0 18px;font-size:12.5px;line-height:1.45;color:var(--ink-2)}
#mesa .co-acu .mx-sel,#mesa .co-acu .mx-f{display:flex;width:100%;border-radius:var(--r-md)}#mesa .co-acu .mx-f .mx-in{flex:1;min-width:0}   /* the Mesa's dropdowns and date as wide as the fields beside them */
#mesa .co-cuota label{display:block;margin:0 0 6px;font-size:12.5px;font-weight:600}
#mesa .co-q{width:100%;box-sizing:border-box;height:32px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--panel-2);padding:0 12px;font:13px var(--font);color:var(--ink);transition:border-color var(--d1) ease-out,box-shadow var(--d1) ease-out}
#mesa .co-q:hover{border-color:var(--line-strong)}#mesa .co-q:focus{outline:0;border-color:var(--ink);box-shadow:0 0 0 3px var(--ring)}
#mesa .co-q::placeholder,#mesa .co-in::placeholder{color:var(--mute)}
#mesa .co-t{width:100%;border-collapse:collapse}
#mesa .co-t th{padding:0 10px 8px 0;font-size:12.5px;font-weight:400;color:var(--mute);text-align:left;white-space:nowrap}
#mesa .co-t td{padding:5px 10px 5px 0;border-top:1px solid var(--co-sep,var(--line2));white-space:nowrap;vertical-align:middle}
#mesa .co-t th:last-child,#mesa .co-t td:last-child{padding-right:0}
#mesa .co-t .co-i{text-align:right}
#mesa .co-vh0{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#mesa .co-m{font-weight:400;max-width:120px;overflow:hidden;text-overflow:ellipsis}
#mesa .co-in{box-sizing:border-box;height:28px;margin-left:-7px;padding:0 6px;border:1px solid transparent;border-radius:var(--r-sm);background:none;font:inherit;color:var(--ink);transition:border-color var(--d1) ease-out,box-shadow var(--d1) ease-out,background var(--d1) ease-out}
#mesa .co-n .co-in{width:76px}#mesa .co-in.co-imp{width:70px;margin:0 -7px 0 0;text-align:right}
#mesa .co-in:hover{border-color:var(--line)}#mesa .co-in:focus{outline:0;border-color:var(--ink);box-shadow:0 0 0 3px var(--ring);background:var(--panel-2)}
#mesa .co-e{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--r-xs);font-size:12.5px;font-weight:600;line-height:18px}
#mesa .co-e.ok{background:var(--ok-soft);color:var(--ok)}#mesa .co-e.pend{background:var(--chg-soft);color:var(--chg)}#mesa .co-e.tarde{background:var(--red-soft);color:var(--red)}#mesa .co-e.sin{background:var(--bg-2);color:var(--mute)}
#mesa .co-fe{display:inline-flex;align-items:center;min-height:28px;max-width:132px;margin-left:-6px;padding:4px 6px;white-space:normal;text-align:left;line-height:1.3;border:0;border-radius:var(--r-sm);background:none;font:inherit;color:var(--mute);cursor:pointer;transition:background var(--d1) ease-out,color var(--d1) ease-out,transform var(--d1) ease-out}
#mesa .co-fe:hover,#mesa .co-fe[aria-expanded="true"]{background:var(--co-hov,var(--bg-2));color:var(--ink)}
#mesa .co-mini{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:1px solid var(--line-strong);border-radius:var(--r-pill);background:var(--panel-2);font:inherit;font-size:12.5px;color:var(--ink-2);white-space:nowrap;cursor:pointer;transition:background var(--d1) ease-out,border-color var(--d1) ease-out,color var(--d1) ease-out,transform var(--d1) ease-out}
#mesa .co-mini:hover{background:var(--co-hov,var(--bg-2));color:var(--ink)}#mesa .co-mini svg{width:14px;height:14px}
#mesa .co-pdf{display:inline-grid;grid-template-columns:minmax(0,1fr) 28px;align-items:center;width:136px;max-width:100%;margin-left:-4px}
#mesa .co-pn{display:inline-flex;align-items:center;gap:5px;min-width:0;justify-self:start;max-width:100%;height:28px;padding:0 4px;margin-left:0;border:0;border-radius:var(--r-sm);background:none;font:inherit;font-size:12.5px;color:var(--ink-2);cursor:pointer}
#mesa .co-pn span{overflow:hidden;text-overflow:ellipsis}#mesa .co-pn svg{color:var(--mute)}#mesa .co-pn:hover{background:var(--co-hov,var(--bg-2));color:var(--ink)}
#mesa .co-x{display:inline-grid;place-items:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:var(--r-sm);background:none;color:var(--mute);cursor:pointer}
#mesa .co-x:hover{background:var(--co-hov,var(--bg-2));color:var(--ink)}#mesa .co-x svg{width:14px;height:14px}
#mesa .co-a{text-align:right}
#mesa :is(.co-in,.co-fe,.co-mini,.co-pn,.co-x,.co-mas,.co-dw,.co-ver):focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa :is(.co-fe,.co-mini,.co-pn,.co-x,.co-mas,.co-dw,.co-ver):active:not(:disabled){transform:scale(.97)}
#mesa :is(.co-pn,.co-x,.co-mas,.co-ver){transition:background var(--d1) ease-out,color var(--d1) ease-out,transform var(--d1) ease-out}
#mesa tr.co-f.co-drop td{background:var(--co-hov,var(--bg-2))}
#mesa .co-det td{border-top:0;padding:0 0 10px}
#mesa .co-fs{display:flex;flex-wrap:wrap;gap:10px 18px;padding:10px 12px;border-radius:var(--r-md);background:var(--bg)}
#mesa .co-fl{display:flex;align-items:center;gap:8px;margin:0;font-size:12.5px;font-weight:600}
#mesa .co-vacio{margin:4px 0 0;color:var(--mute)}
#mesa .co-pie{display:flex;margin:10px 0 0}
#mesa .co-mas{display:inline-flex;align-items:center;gap:6px;padding:6px 4px;margin-left:-4px;border:0;border-radius:var(--r-sm);background:none;font:inherit;font-size:13px;font-weight:600;color:var(--acc-ink);cursor:pointer}
#mesa .co-mas:disabled{color:var(--faint);cursor:default}#mesa .co-mas:hover:not(:disabled){background:var(--co-hov,var(--bg-2))}
#mesa .co-mf{font-weight:400;color:var(--mute)}
#mesa .co-esp .co-pie{margin:0}#mesa .co-esp .co-vacio{margin:0}#mesa .co-esp .co-t tr.co-f:first-child{padding-top:4px}
@container (max-width: 699px){
  #mesa .co-t,#mesa .co-t tbody{display:block}#mesa .co-t thead{display:none}
  #mesa .co-t tr.co-f{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"m f s" "n n i" "p p a";align-items:center;gap:4px 10px;padding:10px 0;border-top:1px solid var(--co-sep,var(--line2))}
  #mesa .co-t tr.co-f.co-drop{background:var(--co-hov,var(--bg-2));box-shadow:0 0 0 6px var(--co-hov,var(--bg-2));border-radius:var(--r-sm)}#mesa .co-t tr.co-f.co-drop td{background:none}
  #mesa .co-t tr.co-f:first-child{border-top:0}
  #mesa .co-t tr.co-f td{display:block;padding:0;border:0}
  #mesa .co-t .co-m{grid-area:m;max-width:none;font-weight:600}#mesa .co-t .co-s{grid-area:s;justify-self:end}#mesa .co-t .co-n{grid-area:n}#mesa .co-t .co-i{grid-area:i;text-align:right}
  #mesa .co-t .co-fc{grid-area:f}#mesa .co-t .co-p{grid-area:p}#mesa .co-t .co-a{grid-area:a}
  #mesa .co-t .co-n,#mesa .co-t .co-i{display:flex;align-items:center;gap:8px}#mesa .co-t .co-i{justify-content:flex-end}
  #mesa .co-t .co-n::before,#mesa .co-t .co-i::before{content:attr(data-l);font-size:12.5px;color:var(--mute)}
  #mesa .co-n .co-in{margin-left:0}#mesa .co-pdf{width:auto;max-width:100%;grid-template-columns:auto 28px}
  #mesa .co-t tr.co-det{display:block}#mesa .co-t tr.co-det td{display:block;padding:0 0 10px}
  #mesa .co-cuota{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}#mesa .co-cuota:not(.co-acu) > div:first-child{grid-column:1 / -1}#mesa .co-cuota.co-acu{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
}
#mesa .co-pagos{color:var(--ink);container-type:inline-size}
@container (max-width:420px){#mesa .co-vl .co-pt{display:none}#mesa .co-vl .n .co-nw{display:block}}
#mesa .co-vh{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0 0 12px;font-size:17px;font-weight:800;letter-spacing:-.01em}
#mesa .co-vh span{font-size:13px;font-weight:400;letter-spacing:0;color:var(--mute)}
#mesa .co-vp{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;margin:-4px 0 12px;font-size:13.5px;color:var(--ink-2)}
#mesa .co-vp b{font-size:18px;font-weight:800;color:var(--ink)}#mesa .co-vp .rojo{color:var(--red);font-weight:600}
#mesa .co-vl{display:flex;flex-direction:column;margin:0;padding:0;list-style:none}
#mesa .co-vl li{display:grid;grid-template-columns:minmax(0,1fr) auto 32px;align-items:center;gap:2px 10px;padding:10px 0;border-top:1px solid var(--line2)}
#mesa .co-vl li:first-child{border-top:0;padding-top:0}
#mesa .co-vl .m{font-size:14px;font-weight:600}#mesa .co-vl .co-nw{white-space:nowrap}#mesa .co-vl .n{grid-column:1;font-size:12.5px;line-height:1.4;color:var(--mute)}
#mesa .co-ce{grid-row:1 / span 2;grid-column:2;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--r-pill);font-size:12.5px;font-weight:600;white-space:nowrap}
#mesa .co-ce svg{width:14px;height:14px}
#mesa .co-ce.ok{background:var(--ok-soft);color:var(--ok)}#mesa .co-ce.pend{background:var(--chg-soft);color:var(--chg)}#mesa .co-ce.rojo{background:var(--red-soft);color:var(--red)}
#mesa .co-dw,#mesa .co-dw0{grid-row:1 / span 2;grid-column:3;width:32px;height:32px}
#mesa .co-dw{display:inline-grid;place-items:center;padding:0;border:0;border-radius:var(--r-sm);background:none;color:var(--ink-2);cursor:pointer;transition:background var(--d1) ease-out,color var(--d1) ease-out,transform var(--d1) ease-out}
#mesa .co-dw:hover{background:var(--bg-2);color:var(--ink)}#mesa .co-dw svg{width:18px;height:18px}
#mesa .co-ver{display:inline-flex;margin-top:8px;padding:4px 0;border:0;background:none;font:inherit;font-size:13px;color:var(--acc-ink);cursor:pointer}
#mesa .co-ver:hover{text-decoration:underline}
#mesa .co-vprox{display:flex;align-items:center;gap:6px;margin:12px 0 0;font-size:13px;color:var(--mute)}
@media (prefers-reduced-motion:reduce){#mesa :is(.ectab,.co-q,.co-in,.co-fe,.co-mini,.co-dw,.co-pn,.co-x,.co-mas,.co-ver){transition:none}#mesa :is(.ectab,.co-fe,.co-mini,.co-pn,.co-x,.co-mas,.co-dw,.co-ver):active:not(:disabled){transform:none}}
`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).cobros = 'ok';
})();
