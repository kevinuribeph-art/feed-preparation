// Cobros — Mesa de trabajo · v1.0 (D-232 a D-237)
// A client's invoices as they are drawn and done: the «Cobros» tab of «Editar cliente» (a monthly client: its fee and the
// table of its invoices), the same table in a sporadic client's file (sesiones.js) and «Tus pagos» in the vista cliente
// (only that client's, through M._in.vc). The data, its states and its sums live in mesa.js (M._in.cob, M.cobros): here a
// PDF is never read to draw a line. If this file doesn't load, «Editar cliente» is the one of always and the client sees no
// «Tus pagos».
(function cobrosBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.4';   // 1.4: the agreement's fields with options (D-304); the list of agreements, each with its invoices, «Nuevo acuerdo», «Termina en» and the packages' catalog (D-305 to D-307); «Tus pagos» from when to when and what it includes (D-308); «Se factura» (D-309). 1.3: «Tus pagos» of the vista cliente with its stretch — «Pago semestral · 2700 €», «Cubre may – oct 2026 · el siguiente, el 1 nov» and each invoice «Mayo – octubre» (D-297). 1.2: «Acuerdo» instead of «Cuota mensual» — how often it pays, from when, for how long, whether it renews and when to renegotiate, with its line; «+ Factura» of its stretch; in «Tus pagos», «al mes» only if it pays each month and each invoice by its first month, as the client's web gets them until lot D (D-288). 1.1: a PDF that hasn't come down from the server yet (lot 4 of the traspaso) says so (D-259)
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
    mas: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    chev: svg('<path d="m9 18 6-6-6-6"/>'),
    atras: svg('<path d="m15 18-6-6 6-6"/>')
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
  const UI = { det: null, ant: new Set(), abre: new Map(), vista: new Map() };   // the invoice whose dates are open; the clients whose older payments show; each agreement folded or open ('cli|id'); a client's «Cobros» on its packages (D-305, D-307)
  const cliRec = id => I().CL.find(c => c.id === id) || null;
  // the agreement (D-288): how often it pays, each payment, the day it's issued and its term; from when, for how long, whether it
  // renews and when to renegotiate (only Kevin's); a line that sums it up under them
  const MESC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const acuVal = (a, k) => {                     // what each field holds, as it's kept (D-304: the dropdowns and the month, their values)
    if (!a) return '';
    if (k === 'importe') return a.importe != null ? eur(a.importe) : '';
    if (k === 'dia') return a.dia != null ? String(a.dia) : '';
    if (k === 'plazo') return a.plazo != null ? String(a.plazo) : '';
    if (k === 'desde') return a.desde || '';
    if (k === 'meses') return a.meses ? String(a.meses) : '';
    return '';
  };
  const mesesEntre = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  // «Vence a los»: 7 · 15 · 30 días · Otro… (a number in its place); a term kept outside the list, an option of its own (D-304)
  function plazoSel(v, sx) {
    const l = [7, 15, 30]; if (v != null && !l.includes(v)) l.push(v); l.sort((x, y) => x - y);
    return `<select id="co-a-plazo${sx}" class="co-q" data-co="cuota" data-k="plazo">${v == null ? '<option value="" selected hidden>Elige</option>' : ''}${l.map(d => `<option value="${d}"${d === v ? ' selected' : ''}>${d} ${d === 1 ? 'día' : 'días'}</option>`).join('')}<option value="otro" data-accion="numero">Otro…</option></select>`;
  }
  // «Duración»: 1 mes · 3 meses · 6 meses · 1 año · Sin fin · Otra… (the last month of each cycle in a calendar of months, kept
  // in months; without «Cubre desde», it can't be counted: off) (D-304)
  function mesesSel(a, sx) {
    const v = a && a.meses ? a.meses : null, l = [[1, '1 mes'], [3, '3 meses'], [6, '6 meses'], [12, '1 año']];
    if (v && !l.some(x => x[0] === v)) l.push([v, v % 12 === 0 ? `${v / 12} años` : `${v} meses`]); l.sort((x, y) => x[0] - y[0]);
    const desde = a && a.desde ? a.desde : '', marca = desde && v ? I().addMonths(desde, v - 1) : '', ren = !a || a.renueva !== false;
    return `<select id="co-a-meses${sx}" class="co-q" data-co="cuota" data-k="meses" data-mes-t="${ren ? 'Último mes del primer ciclo' : 'Último mes del acuerdo'}"${desde ? ` data-mes-n="${ren ? `El ciclo empieza en ${esc(mesC0(desde))}; se repite igual.` : `Empieza en ${esc(mesC0(desde))}.`}" data-min="${desde}"` : ''}${marca ? ` data-mes="${marca}"` : ''}>${l.map(([n, t]) => `<option value="${n}"${n === v ? ' selected' : ''}>${t}</option>`).join('')}<option value=""${v ? '' : ' selected'}>Sin fin</option><option value="otra" data-accion="mes"${desde ? '' : ' disabled'}>Otra…</option></select>`;
  }
  // «Paquete» (D-307): the catalog's, «Personalizado» and «Editar paquetes…»; one no longer in the catalog, by the name it kept
  function paqueteSel(a, sx) {
    const p = a && a.paquete, cat = C().paquetes ? C().paquetes() : [], v = !p ? '' : p.id === 'personalizado' ? 'personalizado' : cat.some(x => x.id === p.id) ? p.id : 'copia';
    return `<select id="co-a-paquete${sx}" class="co-q" data-co="cuota" data-k="paquete">${v ? '' : '<option value="" selected hidden>Elige</option>'}${cat.map(x => `<option value="${esc(x.id)}"${x.id === v ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}${v === 'copia' ? `<option value="copia" selected>${esc(p.nombre)}</option>` : ''}<option value="personalizado"${v === 'personalizado' ? ' selected' : ''}>Personalizado</option><option value="editar" data-accion="paquetes" data-icono="no">Editar paquetes…</option></select>`;
  }
  // what a package includes, as chips; editable (a «Personalizado» agreement, a package of the catalog) with × and «Añadir…»
  function incluyeHTML(l, ed, de, id) {
    if (!ed && !(l && l.length)) return '';
    const chips = (l || []).map((t, i) => `<li><span>${esc(t)}</span>${ed ? `<button type="button" class="co-ix" data-co="inc-quitar" data-i="${i}" aria-label="Quitar «${esc(t)}»" title="Quitar">${IC.x}</button>` : ''}</li>`).join('');
    return `<ul class="co-inc${ed ? '' : ' ro'}" data-co-inc="${de}" data-id="${esc(id)}" aria-label="Lo que incluye">${chips}${ed && (l || []).length < 20 ? `<li class="co-inc-mas"><input type="text" class="co-inc-in" data-co="inc-nuevo" maxlength="80" autocomplete="off" placeholder="Añadir…" aria-label="Añadir a lo que incluye"></li>` : ''}</ul>`;
  }
  // the fields of an agreement (D-288, D-304 to D-307); sx: what makes their ids unique in the list
  function camposHTML(a, sx) {
    const pago = a ? a.pago : 'mensual', renueva = !a || a.renueva !== false, sinFin = !a || !a.meses;
    const campo = (k, l, ph, im) => `<div><label for="co-a-${k}${sx}">${l}</label><input id="co-a-${k}${sx}" type="text" class="co-q" data-co="cuota" data-k="${k}" inputmode="${im}" autocomplete="off" value="${esc(acuVal(a, k))}" placeholder="${ph}"></div>`;
    const dia = I().diaSel ? I().diaSel(`id="co-a-dia${sx}" class="co-q" data-co="cuota" data-k="dia"`, a && a.dia != null ? a.dia : '', !(a && a.dia != null)) : '';
    const p = a && a.paquete, res = a && C().resumenA ? C().resumenA(a) : '', tit = a && C().tituloA ? C().tituloA(a) : '';
    return `<div class="co-cuota co-acu">`
      + `<div><label for="co-a-paquete${sx}">Paquete</label>${paqueteSel(a, sx)}</div>`
      + `<div><label for="co-a-pago${sx}">Pago</label><select id="co-a-pago${sx}" class="co-q" data-co="cuota" data-k="pago">${(C().PAGOS || [['mensual', 'Cada mes']]).map(([v, t]) => `<option value="${v}"${v === pago ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`
      + campo('importe', 'Importe de cada pago', 'Importe', 'decimal')
      + `<div><label for="co-a-dia${sx}">Se emite el día</label>${dia}</div>`
      + `<div><label for="co-a-adelanto${sx}">Se factura</label><select id="co-a-adelanto${sx}" class="co-q" data-co="cuota" data-k="adelanto"><option value="no"${a && a.adelanto ? '' : ' selected'}>El mismo mes</option><option value="si"${a && a.adelanto ? ' selected' : ''}>El mes antes</option></select></div>`   // D-309
      + `<div><label for="co-a-plazo${sx}">Vence a los</label>${plazoSel(a && a.plazo != null ? a.plazo : null, sx)}</div>`
      + `<div><label for="co-a-desde${sx}">Cubre desde</label><input id="co-a-desde${sx}" type="month" class="co-q" data-co="cuota" data-k="desde" data-sin-fecha value="${esc((a && a.desde) || '')}" aria-label="Cubre desde"></div>`
      + `<div><label for="co-a-meses${sx}">Duración</label>${mesesSel(a, sx)}</div>`
      + `<div><label for="co-a-renueva${sx}">Al acabar</label><select id="co-a-renueva${sx}" class="co-q" data-co="cuota" data-k="renueva"${sinFin ? ' disabled title="Sin duración, no acaba"' : ''}><option value="si"${renueva ? ' selected' : ''}>Se renueva</option><option value="no"${renueva ? '' : ' selected'}>Se acaba</option></select></div>`
      + `<div><label for="co-a-renegociar${sx}">Renegociar el</label><input id="co-a-renegociar${sx}" type="date" class="co-q" data-co="cuota" data-k="renegociar" data-sin-fecha value="${esc((a && a.renegociar) || '')}" aria-label="Renegociar el acuerdo el"></div>`
      + `<div><label for="co-a-termina${sx}">Termina en</label><input id="co-a-termina${sx}" type="month" class="co-q" data-co="cuota" data-k="termina" data-sin-fecha placeholder="Sigue" value="${esc((a && a.termina) || '')}"${a && a.desde ? ` min="${a.desde}"` : ''} aria-label="Termina en" title="Vacío: sigue. Manda sobre «Duración» y «Al acabar»"></div>`
      + `</div>${p ? incluyeHTML(p.incluye, p.id === 'personalizado', 'acu', a.id) : ''}<p class="co-acu-n"${res ? '' : ' hidden'}${tit ? ` title="${esc(tit)}"` : ''}>${esc(res)}</p>`;
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
  // after its last month (a stretch's, D-288); of an agreement, after the last of its own invoices (one of the next agreement
  // made first doesn't leave it without its month: revisión del lote B), or with none of its own, after the client's last
  const mesNueva = (cli, h, a) => {
    const todas = C().vivos(cli).filter(r => C().MES.test(r.periodo || '')), suyas = a && C().delMes ? todas.filter(r => { const q = C().delMes(cli, r.periodo); return q && q.id === a.id; }) : [];
    const ms = (suyas.length ? suyas : todas.filter(r => !a || !a.cubreHasta || r.periodo <= a.cubreHasta)).map(r => C().hasta ? C().hasta(r) : r.periodo).sort();
    return ms.length ? I().addMonths(ms[ms.length - 1], 1) : h.slice(0, 7);
  };
  // the sessions of a sporadic client that have no invoice of it yet (one per session and client, D-234)
  function sesSinCobro(cli) {
    const p = P(); if (!p || !p.TK) return [];
    const usadas = new Set(C().vivos(cli).map(r => r.periodo));
    return [...p.TK.values()].filter(k => k.tipo === 'sesion' && !k._b && !(k.sesion && k.sesion.clase === 'reunion') && (Array.isArray(k.clientes) ? k.clientes : [k.cliente]).includes(cli) && !usadas.has(k.id))   // a meeting has no payment (D-291)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  }
  // «+ Factura» of an agreement: its next stretch without an invoice, from the month after the last one invoiced (D-288); one that
  // ended has none (D-305)
  function pieMensual(cli, h, a) {
    const q = a && C().completo(a) ? a : null, hm = h.slice(0, 7);
    if (a && a.cubreHasta && a.cubreHasta < hm) return '';
    let m = mesNueva(cli, h, a); if (a && a.desde && m < a.desde) m = a.desde;
    // this month without its invoice while a later one is made (the month before, D-309): this one first (revisión del lote B)
    if (m > hm && (!a || ((!a.desde || a.desde <= hm) && (!a.cubreHasta || hm <= a.cubreHasta))) && C().cubre && !C().cubre(C().vivos(cli), hm)) m = hm;
    const t = q ? C().libre(q, C().vivos(cli), m) : null;
    const n0 = C().nombre({ periodo: t ? t.de : m, ...(t && t.hasta !== t.de ? { hasta: t.hasta } : {}) }, h), nom = n0.charAt(0).toLowerCase() + n0.slice(1);   // as the table names it
    return `<button type="button" class="co-mas" data-co="nueva" data-acu="${a ? esc(a.id) : ''}" data-m="${t ? t.de : m}" data-h="${t ? t.hasta : m}" data-i="${t ? t.importe : ''}"${t ? '' : q ? ' disabled title="El acuerdo ya acabó"' : ' disabled title="Pon antes el importe, el día en que se emite y a cuántos días vence (y desde cuándo cubre, si no paga cada mes)"'}>${IC.mas}Factura de ${esc(nom)}</button>`;
  }
  const PAGO_K = { mensual: 'cada mes', trimestral: 'cada 3 meses', semestral: 'cada 6 meses', anual: 'una vez al año', unico: 'un solo pago' };
  const mesC0 = m => `${MESC[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
  const estadoA = (a, hm) => a.cubreHasta && a.cubreHasta < hm ? 'fin' : a.desde && a.desde > hm ? 'prox' : 'ahora';
  // a card's head (D-305): «Desde may 2026 · cada 6 meses, se renueva · Ahora»; an ended one, its months; one to come, «Empieza»
  function cabeza(a, est) {
    // «cada mes · se renueva cada 6 meses»; cut by «Termina en», the next agreement or a cycle that doesn't renew, «· hasta nov 2026»
    // (revisión del lote B: «cada mes, se renueva» read as «renews each month»)
    const ciclo = n => n === 1 ? 'cada mes' : n === 12 ? 'cada año' : n % 12 === 0 ? `cada ${n / 12} años` : `cada ${n} meses`;
    const pago = (PAGO_K[a.pago] || '') + (a.pago === 'unico' ? '' : a.cubreHasta && est !== 'fin' ? ` · hasta ${mesC0(a.cubreHasta)}` : a.meses && a.renueva ? (C().paso && a.meses === C().paso(a) ? ' · se renueva' : ` · se renueva ${ciclo(a.meses)}`) : '');   // «cada 6 meses · se renueva», not twice
    const pagos = (C().resumenA(a).split(' · ').find(x => /€/.test(x)) || '');
    const t = est === 'fin' ? (a.desde ? `${mesC0(a.desde)} – ${mesC0(a.cubreHasta)}` : `Hasta ${mesC0(a.cubreHasta)}`) : a.desde ? `Desde ${mesC0(a.desde)} · ${pago}` : may(pago);
    const chip = est === 'fin' ? '<span class="co-ach fin">Terminado</span>' : est === 'prox' ? '<span class="co-ach prox">Empieza</span>' : '<span class="co-ach ok">Ahora</span>';
    return { t, sub: [a.paquete ? a.paquete.nombre : '', pagos].filter(Boolean).join(' · '), chip };
  }
  const tablaFilas = (rows, h, esp) => rows.length
    ? `<table class="co-t"><thead><tr><th>${esp ? 'Sesión' : 'Mes'}</th><th>Factura</th><th class="co-i">Importe</th><th>Estado</th><th>Fecha</th><th>PDF</th><th><span class="co-vh0">Acción</span></th></tr></thead><tbody>${rows.map(r => filaHTML(r, h, esp)).join('')}</tbody></table>`
    : `<p class="co-vacio">Aún sin ${esp ? 'cobros' : 'facturas'}</p>`;
  // one agreement: its head, and open, its fields, what its package includes, its line, its invoices and «+ Factura» (D-305)
  function cardHTML(cli, a, rows, h, abierta, est, i, varios) {
    const hd = a ? cabeza(a, est) : null, aid = a ? esc(a.id) : '';
    const hh = hd ? `<b>${esc(hd.t)}</b>${!abierta && hd.sub ? `<span class="co-acs">· ${esc(hd.sub)}</span>` : ''}<span class="co-sp"></span>${hd.chip}` : '<b>Acuerdo</b><span class="co-acs">sin rellenar</span>';
    const cab = varios && a ? `<button type="button" class="co-ac-h" data-co="acu-pleg" aria-expanded="${abierta}" title="${abierta ? 'Plegar' : 'Ver este acuerdo'}">${IC.chev}${hh}</button>` : `<div class="co-ac-h"${a ? ' tabindex="0" title="Clic derecho o ⇧F10: borrar el acuerdo"' : ''}>${hh}</div>`;
    if (!abierta) return `<section class="co-ac pleg" data-acu="${aid}">${cab}</section>`;
    return `<section class="co-ac" data-acu="${aid}">${cab}<div class="co-ac-b">${camposHTML(a, '-' + i)}${tablaFilas(rows, h)}${est === 'fin' ? '' : `<div class="co-pie">${pieMensual(cli, h, a)}</div>`}</div></section>`;
  }
  // the catalog of packages (D-307), in the place of the agreements, from «Editar paquetes…» of a «Paquete»
  function paquetesHTML(cli) {
    const l = C().paquetes ? C().paquetes() : [];
    return `<div class="co co-paqs" data-co-cli="${esc(cli)}"><button type="button" class="co-volver" data-co="paq-volver">${IC.atras}Acuerdos</button>`
      + `<div class="co-acu-t"><h4>Paquetes</h4><span class="co-sp"></span><button type="button" class="co-mas" data-co="paq-nuevo">${IC.mas}Paquete</button></div>`
      + (l.length ? l.map(p => `<section class="co-paq" data-paq="${esc(p.id)}"><div class="co-paq-h"><input type="text" class="co-q co-pq-n" data-co="paq-nombre" maxlength="60" value="${esc(p.nombre)}" aria-label="Nombre del paquete" autocomplete="off"><label class="co-pq-p"><input type="text" class="co-q" data-co="paq-precio" inputmode="decimal" value="${p.precio != null ? esc(eur(p.precio)) : ''}" placeholder="Precio" aria-label="Precio de ${esc(p.nombre)} al mes" autocomplete="off"><span>al mes</span></label></div>${incluyeHTML(p.incluye, true, 'paq', p.id)}</section>`).join('')
        : `<p class="co-vacio">Aún sin paquetes: «Paquete» crea el primero.</p>`)
      + `<p class="co-nota">Cambiar un paquete no cambia los acuerdos que ya lo usan: cada uno guarda lo que incluía.</p></div>`;
  }
  // the table of a client's invoices, newest first; o.esp: a sporadic client (a session each, no fee). A monthly client: its
  // agreements, newest first, each with the invoices whose first month it covers (D-305); today's open, the rest folded
  function tabla(cli, o = {}) {
    const h = hoy(), l = C().vivos(cli).sort(C().orden);
    if (o.esp) {
      const ss = sesSinCobro(cli), n = ss.length;
      const pie = `<button type="button" class="pp-cmas" data-co="nuevo-ses"${n ? '' : ` disabled title="${C().vivos(cli).length ? 'Todas sus sesiones tienen su cobro' : 'Aún no tiene sesiones'}"`}>${IC.mas}Cobro</button>`;
      return `<div class="co co-esp" data-co-cli="${esc(cli)}">${tablaFilas(l, h, true)}<div class="co-pie">${pie}</div></div>`;
    }
    if (UI.vista.get(cli) === 'paquetes') return paquetesHTML(cli);
    if (C().mal && C().mal()) return `<div class="co" data-co-cli="${esc(cli)}"><p class="co-vacio">No se pudieron leer sus acuerdos o sus facturas: recarga la página antes de cambiar nada.</p></div>`;   // never an empty card over what couldn't be read (revisión del lote B)
    const acus = C().acuerdos ? C().acuerdos(cli) : [], hm = h.slice(0, 7);
    const delMes = m => { let out = null; for (const a of acus) if ((!a.desde || a.desde <= m) && (!a.cubreHasta || m <= a.cubreHasta)) out = a; return out; };
    const de = new Map(acus.map(a => [a.id, []])), sin = [];
    for (const r of l) { const a = C().MES.test(r.periodo || '') ? delMes(r.periodo) : null; if (a) de.get(a.id).push(r); else sin.push(r); }
    const hoyA = delMes(hm) || acus.find(a => a.desde && a.desde > hm) || acus[acus.length - 1], varios = acus.length > 1;
    const abierta = a => { const k = cli + '|' + a.id; return UI.abre.has(k) ? UI.abre.get(k) : !!(hoyA && a.id === hoyA.id); };
    const cards = acus.length ? [...acus].reverse().map((a, i) => cardHTML(cli, a, de.get(a.id), h, !varios || abierta(a), estadoA(a, hm), i, varios)).join('') : cardHTML(cli, null, [], h, true, 'ahora', 0, false);
    const otras = (acus.length ? sin : l);
    return `<div class="co" data-co-cli="${esc(cli)}"><div class="co-acu-t"><h4>${acus.length > 1 ? 'Acuerdos' : 'Acuerdo'}</h4><span>«Renegociar el» solo lo ves tú</span><span class="co-sp"></span>${acus.length ? `<button type="button" class="co-mas" data-co="acu-nuevo" title="Sube o baja de categoría: un acuerdo nuevo desde un mes; el de ahora cubre hasta el mes de antes">${IC.mas}Nuevo acuerdo</button>` : ''}</div>`
      + cards + (otras.length ? `<section class="co-ac co-ac-sin"><div class="co-ac-h"><b>${acus.length ? 'Otras facturas' : 'Facturas'}</b>${acus.length ? '<span class="co-acs">fuera de los acuerdos</span>' : ''}</div><div class="co-ac-b">${tablaFilas(otras, h)}</div></section>` : '')
      + `</div>`;
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
  const aidDe = el => { const t = el && el.closest && el.closest('[data-acu]'); return t ? t.dataset.acu : ''; };
  const acuPor = (cid, aid) => aid && C().acuerdos ? (C().acuerdos(cid).find(x => x.id === aid) || null) : null;
  // ctx: its client, agreement and value when it changed (one after another in a queue: a field drawn again meanwhile is no longer
  // in the page)
  async function cuota(inp, ctx) {                 // a field of an agreement (D-288; of the list, D-305), saved on its own
    const cid = (ctx && ctx.cid) || cliDe(inp), c = cliRec(cid); if (!c) return;
    const aid = ctx && ctx.aid != null ? ctx.aid : aidDe(inp), k = inp.dataset.k, v = String((ctx && ctx.v != null ? ctx.v : inp.value) || '').trim();
    if (C().acuLeer) await C().acuLeer().catch(() => {});
    if (C().mal && C().mal()) { toast('No se pudieron leer los acuerdos: recarga la página antes de cambiarlos.'); pintar(); return; }   // nothing over what couldn't be read (revisión del lote B)
    let a1 = acuPor(cid, aid);
    if (!a1 && aid) return;                        // its agreement went meanwhile: nothing written (revisión del lote B)
    if (!a1) { const hoy = C().acuerdo ? C().acuerdo(c) : null; a1 = hoy ? acuPor(cid, hoy.id) : null; }   // an empty card: the field before in the queue may have made it; then only this field
    const a0 = a1 || { pago: 'mensual', importe: null, dia: null, plazo: null, desde: '', meses: null, renueva: true, renegociar: '', termina: '', paquete: null, adelanto: false };
    if (k === 'paquete') return cambiarPaquete(cid, a1, v);
    let val = null;
    if (k === 'pago') val = v || 'mensual';
    else if (k === 'renueva') val = v !== 'no';
    else if (k === 'adelanto') val = v === 'si';   // D-309
    else if (k === 'renegociar') val = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : v ? undefined : '';
    else if (k === 'desde' || k === 'termina') val = leerMes(v);
    else if (v) {
      if (k === 'importe') { val = C().importe(v); if (isNaN(val) || !(val > 0)) val = undefined; }
      else if (k === 'dia') { val = /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 28 ? +v : undefined; }
      else if (k === 'meses') { const m = v.match(/^(\d{1,3})\s*(mes(es)?)?$/i); val = m && +m[1] >= 1 && +m[1] <= 120 ? +m[1] : undefined; }
      else { const m = v.match(/^(\d{1,3})\s*(d[ií]as?)?$/i); val = m && +m[1] <= 365 ? +m[1] : undefined; }
    }
    if (val === undefined || (k === 'termina' && val && a0.desde && val < a0.desde) || (k === 'desde' && val && a0.termina && val > a0.termina)) {   // D-306, both ways (revisión del lote B)
      toast(val !== undefined ? (k === 'desde' ? '«Cubre desde» no puede ir después de «Termina en».' : '«Termina en» no puede ir antes de «Cubre desde».') : { importe: 'El importe no es válido (450 o «1.470,50»).', dia: 'El día en que se emite va del 1 al 28.', plazo: 'El plazo son los días hasta que vence (de 0 a 365).', desde: 'Escribe el mes y el año: «may 2026».', termina: 'Escribe el mes y el año: «mar 2027».', meses: 'La duración son meses, de 1 a 120 (vacía, sin fin).', renegociar: 'No es una fecha.' }[k] || 'No es válido.');
      pintarCuota(inp, cid, aid); return;
    }
    const texto = k === 'desde' || k === 'renegociar' || k === 'termina';
    if (texto ? (a0[k] || '') === val : (a0[k] ?? null) === val) { pintarCuota(inp, cid, aid); return; }
    try {
      if (a1) await C().acuCambiar(cid, a1.id, { [k]: val });
      else { const a = { ...a0, [k]: val }, vacia = a.pago === 'mensual' && a.importe == null && a.dia == null && a.plazo == null && !a.desde && !a.meses && !a.renegociar && !a.termina && !a.adelanto; if (!vacia) await C().acuGuardar(cid, a); }
    } catch (e) { fallo(e); pintar(); }
  }
  // «Paquete» (D-307): a package of the catalog (a copy of what it includes and, paying each month, its price when the amount was
  // empty or that of the package it had), or «Personalizado» (what it includes, written here)
  async function cambiarPaquete(cid, a1, v) {
    const p = (C().paquetes ? C().paquetes() : []).find(x => x.id === v);
    let paquete;
    if (v === 'personalizado') paquete = { id: 'personalizado', nombre: 'Personalizado', incluye: (a1 && a1.paquete && a1.paquete.incluye) || [] };
    else if (p) paquete = { id: p.id, nombre: p.nombre, incluye: p.incluye };
    else return;
    if (a1 && a1.paquete && a1.paquete.id === paquete.id) return;
    const cambio = { paquete }, viejo = a1 && a1.paquete && C().paqGet ? C().paqGet(a1.paquete.id) : null;
    if (p && p.precio != null && (!a1 || a1.pago === 'mensual') && (!a1 || a1.importe == null || (viejo && viejo.precio === a1.importe))) cambio.importe = p.precio;
    try { if (a1) await C().acuCambiar(cid, a1.id, cambio); else await C().acuGuardar(cid, { pago: 'mensual', ...cambio }); } catch (e) { fallo(e); pintar(); }
  }
  // what a «Personalizado» agreement or a package includes: one thing more, or one less (D-307)
  async function incluye(el, quitar) {
    const box = el.closest('[data-co-inc]'); if (!box) return;
    const de = box.dataset.coInc, id = box.dataset.id, cid = cliDe(el);
    const l0 = de === 'acu' ? (((acuPor(cid, id) || {}).paquete || {}).incluye || []) : ((C().paqGet && C().paqGet(id)) || {}).incluye || [];
    let l;
    if (quitar) l = l0.filter((x, i) => i !== +el.dataset.i);
    else { const t = el.value.trim().replace(/\s+/g, ' '); if (!t) return; if (l0.some(x => x.toLowerCase() === t.toLowerCase())) { el.value = ''; return; } l = [...l0, t.slice(0, 80)].slice(0, 20); el.value = ''; }
    const foco = quitar ? `[data-co-inc="${de}"][data-id="${CSS.escape(id)}"] [data-co="inc-nuevo"]` : `[data-co-inc="${de}"][data-id="${CSS.escape(id)}"] [data-co="inc-nuevo"]`;
    try {
      if (de === 'acu') { const a = acuPor(cid, id); if (a && a.paquete) await C().acuCambiar(cid, id, { paquete: { ...a.paquete, incluye: l } }); }
      else await C().paqCambiar(id, { incluye: l });
    } catch (e) { fallo(e); }
    enfocar(foco);
  }
  // a package's name and price (D-307)
  async function paqCampo(inp) {
    const s = inp.closest('[data-paq]'), id = s && s.dataset.paq, p = id && C().paqGet ? C().paqGet(id) : null; if (!p || p.borrado) return;
    const v = inp.value.trim();
    if (inp.dataset.co === 'paq-nombre') {
      if (!v) { toast('El paquete necesita un nombre.'); inp.value = p.nombre; return; }
      if (v === p.nombre) return;
      try { await C().paqCambiar(id, { nombre: v }); } catch (e) { fallo(e); }
    } else {
      const n = v ? C().importe(v) : null;
      if (v && (isNaN(n) || !(n > 0))) { toast('El precio no es válido (450 o «1.470,50»).'); inp.value = p.precio != null ? eur(p.precio) : ''; return; }
      inp.value = n ? eur(n) : '';
      if ((n || null) === (p.precio ?? null)) return;
      try { await C().paqCambiar(id, { precio: n }); } catch (e) { fallo(e); }
    }
  }
  // «Duración · Otra…»: the last month of each cycle, chosen in a calendar of months, kept as months from «Cubre desde» (D-304)
  async function duracionHasta(n, ult) {
    const a = acuPor(cliDe(n), aidDe(n)); if (!a || !a.desde || !/^\d{4}-\d{2}$/.test(ult || '')) return;
    if (ult < a.desde) { toast('El último mes no puede ir antes de «Cubre desde».'); return; }
    const m = mesesEntre(a.desde, ult) + 1; if (m > 120) { toast('La duración va hasta 10 años.'); return; }
    await cuota({ dataset: n.dataset, value: String(m), closest: s => n.closest(s) });
  }
  // «Vence a los · Otro…»: a number in its place; Intro or leaving it saves it, Esc goes back as it was (D-304)
  function otroNumero(n) {
    const tw = n._mx; if (!tw || !tw.isConnected) return;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'co-q co-otro'; inp.inputMode = 'numeric'; inp.autocomplete = 'off'; inp.placeholder = 'Días'; inp.dataset.co = 'cuota-otro';
    inp.setAttribute('aria-label', 'Vence a los (días)');
    tw.style.display = 'none'; tw.after(inp); inp.focus();
    let hecho = false;
    const volver = foco => { if (hecho) return; hecho = true; inp.remove(); tw.style.display = ''; if (foco && tw.isConnected) tw.focus({ preventScroll: true }); };
    const guardarOtro = () => {
      if (hecho) return; const v = inp.value.trim(); if (!v) { volver(true); return; }
      const m = v.match(/^(\d{1,3})\s*(d[ií]as?)?$/i); if (!m || +m[1] > 365) { toast('El plazo son los días hasta que vence (de 0 a 365).'); inp.select(); return; }
      volver(true); colaQ = colaQ.then(() => cuota({ dataset: n.dataset, value: m[1], closest: s => n.closest(s) })).catch(() => {});
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); guardarOtro(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); volver(true); } });
    inp.addEventListener('blur', () => setTimeout(guardarOtro, 0));
  }
  function alAccion(e) {
    const n = e.target, d = e.detail || {}; if (!n || !n.dataset || n.dataset.co !== 'cuota') return;
    if (d.accion === 'mes' && n.dataset.k === 'meses') colaQ = colaQ.then(() => duracionHasta(n, d.valor)).catch(() => {});
    else if (d.accion === 'numero') otroNumero(n);
    else if (d.accion === 'paquetes') { const cid = cliDe(n); UI.vista.set(cid, 'paquetes'); pintar(); enfocar('.co-paqs [data-co="paq-volver"]'); }   // D-307
  }
  function pintarCuota(inp, cid, aid) {             // the field as it's kept (also the one with the focus)
    const a = aid ? acuPor(cid, aid) : C().acuerdo(cliRec(cid)), k = inp.dataset.k;
    if (k === 'pago') inp.value = a ? a.pago : 'mensual';
    else if (k === 'renueva') inp.value = !a || a.renueva !== false ? 'si' : 'no';
    else if (k === 'renegociar') inp.value = (a && a.renegociar) || '';
    else if (k === 'termina') inp.value = (a && a.termina) || '';
    else if (k === 'adelanto') inp.value = a && a.adelanto ? 'si' : 'no';
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
    const cid = cliDe(btn), q = acuPor(cid, btn.dataset.acu); if (!q || !C().completo(q)) return;   // its agreement's (D-305)
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
  // With an agreement that isn't monthly (D-297): «Pago semestral · 2700 €» in its title and, under it, the stretch that covers
  // today and when the next one is issued; each invoice named by its stretch. Never the date to renegotiate (that's Kevin's).
  const PAGO_VC = { trimestral: 'Pago trimestral', semestral: 'Pago semestral', anual: 'Pago anual', unico: 'Pago único' };
  const mesC = m => C().MESES[+m.slice(5, 7) - 1].slice(0, 3);
  const tramoTxt = (de, ha) => de === ha ? `${mesC(de)} ${de.slice(0, 4)}` : de.slice(0, 4) === ha.slice(0, 4) ? `${mesC(de)} – ${mesC(ha)} ${ha.slice(0, 4)}` : `${mesC(de)} ${de.slice(0, 4)} – ${mesC(ha)} ${ha.slice(0, 4)}`;
  function pagosHTML(ctx) {
    const cli = ctx && ctx.cliente; if (!cli) return '';
    const h = hoy(), c = cliRec(cli), q = C().cuota(c, h.slice(0, 7)), l = C().vivos(cli).map(r => ({ r, e: C().estado(r, h) }));   // the agreement of today (D-305)
    const deber = l.filter(x => x.e.k === 'pendiente' || x.e.k === 'retrasada').sort((a, b) => C().clave(a.r).localeCompare(C().clave(b.r)));
    const pagadas = l.filter(x => x.e.k === 'cobrada').sort((a, b) => C().orden(a.r, b.r));
    const prox = C().proxima(cli, h);
    if (!q && !deber.length && !pagadas.length && !prox) return '';
    const venc = deber.filter(x => x.e.k === 'retrasada').length, suma = deber.reduce((n, x) => n + (+x.r.importe || 0), 0);
    const ver = UI.ant.has(cli), N = Math.max(0, pagadas.length - 3);
    const linea = ({ r, e }) => {
      const nom = C().nombre(r, h), nf = r.factura ? 'la factura ' + r.factura : 'la factura de ' + nom.toLowerCase();
      const t = e.k === 'cobrada' ? 'pagada el ' + corto(r.cobrada, h) : e.k === 'retrasada' ? 'venció el ' + corto(r.vence, h) : r.vence ? 'vence el ' + corto(r.vence, h) : 'emitida el ' + corto(r.emitida, h);
      const chip = e.k === 'cobrada' ? `<span class="co-ce ok">${IC.ok}Pagada</span>` : e.k === 'retrasada' ? `<span class="co-ce rojo">${IC.alerta}Pendiente</span>` : `<span class="co-ce pend">${IC.reloj}Pendiente</span>`;
      const dl = r.pdf ? `<button type="button" class="co-dw" data-co="dl" data-id="${esc(r.id)}" title="Descargar ${esc(nf)} (PDF)" aria-label="Descargar ${esc(nf)} (PDF)">${IC.descarga}</button>` : '<span class="co-dw0"></span>';
      return `<li data-id="${esc(r.id)}"><span class="m">${esc(nom)} · ${esc(eur(r.importe))}</span><span class="n">${r.factura ? 'Factura ' + esc(r.factura) + '<span class="co-pt"> · </span><span class="co-nw">' + esc(t) + '</span>' : `<span class="co-nw">${esc(may(t))}</span>`}</span>${chip}${dl}</li>`;
    };
    const lis = [...deber, ...pagadas.slice(0, 3), ...(ver ? pagadas.slice(3) : [])].map(linea).join('');
    const tramo = q && q.pago !== 'mensual', tr = tramo && C().tramo ? C().tramo(q, h.slice(0, 7)) : null;
    // the agreement from when to when (D-308): a monthly one in its title; one of stretches too, whether it renews, and «Cubre» its
    // stretch of today (D-297); the next one by its date, never its month: it's issued the month before (D-304)
    const rg = q && C().rango ? C().rango(q, h.slice(0, 7)) : null, nb = m => mesC0(m).replace(' ', '\u00a0'), rgT = rg ? (rg.hasta ? (rg.hasta === rg.de ? nb(rg.de) : `${nb(rg.de)} – ${nb(rg.hasta)}`) : `desde ${nb(rg.de)}`) : '';   // one month once, never split (revisión del lote B)
    const sig = prox ? (prox.emitida >= h ? 'el ' + corto(prox.emitida, h) : 'en unos días') : '';
    const sigue = tramo && q.pago !== 'unico' && prox && prox.emitida >= h ? ` · el siguiente, ${esc(sig)}` : '';
    const cubre = tr ? `<p class="co-vcubre">Cubre <b>${esc(tramoTxt(tr.de, tr.hasta))}</b>${sigue}</p>` : '';
    const px = prox && !tramo ? `<p class="co-vprox">${IC.doc}El siguiente, ${esc(sig)}</p>` : '';   // with a stretch, it's in «Cubre …»
    const inc = q && q.paquete && q.paquete.incluye && q.paquete.incluye.length ? `<p class="co-vinc">Incluye ${esc(q.paquete.incluye.join(' · '))}</p>` : '';   // what its package includes (D-307)
    const sub = q && q.pago === 'mensual' ? `${eur(q.importe)} al mes${rgT ? ' · ' + rgT : ''}` : tramo ? `${PAGO_VC[q.pago] || 'Pago'} · ${eur(q.importe)}${rgT ? ' · ' + rgT + (q.pago !== 'unico' && q.renueva && !q.cubreHasta ? ', se\u00a0renueva' : '') : ''}` : '';
    return `<div class="co-pagos"><h2 class="co-vh">Tus pagos${sub ? ` <span>${esc(sub)}</span>` : ''}</h2>${inc}${cubre}`
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
    else if (k === 'acu-pleg') { const cid = cliDe(b), aid = aidDe(b), key = cid + '|' + aid; UI.abre.set(key, b.getAttribute('aria-expanded') !== 'true'); pintar(); enfocar(`[data-co-cli="${CSS.escape(cid)}"] [data-acu="${CSS.escape(aid)}"] [data-co="acu-pleg"]`); }   // D-305
    else if (k === 'acu-nuevo') acuNuevo(b);
    else if (k === 'paq-volver') { const cid = cliDe(b); UI.vista.delete(cid); pintar(); enfocar(`[data-co-cli="${CSS.escape(cid)}"] [data-k="paquete"] + .mx-sel`); }   // D-307
    else if (k === 'paq-nuevo') paqNuevo();
    else if (k === 'inc-quitar') incluye(b, true);
  }
  // «Nuevo acuerdo» (D-305): from the next month, with today's fields to start from; it opens, its «Cubre desde» ready
  async function acuNuevo(b) {
    const cid = cliDe(b); let n = null;
    try { n = await C().acuNuevo(cid); } catch (e) { fallo(e); return; }
    if (!n) return;
    UI.abre.set(cid + '|' + n.id, true); pintar();
    enfocar(`[data-co-cli="${CSS.escape(cid)}"] [data-acu="${CSS.escape(n.id)}"] [data-k="desde"] + .mx-f .mx-in`);
    toast('Acuerdo nuevo desde el mes que viene: el de ahora cubre hasta este mes.', { ms: 6000 });
  }
  async function paqNuevo() {
    let n = null; try { n = await C().paqNuevo({ nombre: 'Paquete nuevo' }); } catch (e) { fallo(e); return; }
    if (n) requestAnimationFrame(() => { const i = (I().root() || document).querySelector(`[data-paq="${CSS.escape(n.id)}"] [data-co="paq-nombre"]`); if (i) { i.focus(); i.select(); } });
  }
  async function borrarAcu(cid, aid) {
    let x; try { x = await C().acuBorrar(aid); } catch (e) { fallo(e); return; }
    if (!x) return;
    toast('Acuerdo borrado.', { action: 'Deshacer', ms: UNDO, onAction: async () => { try { await C().acuDevolver(x.rec); } catch (e) { fallo(e); } } });
  }
  async function borrarPaq(id) {
    let x; try { x = await C().paqBorrar(id); } catch (e) { fallo(e); return; }
    if (!x) return;
    toast('Paquete borrado: los acuerdos que lo tenían lo conservan.', { action: 'Deshacer', ms: UNDO, onAction: async () => { try { await C().paqDevolver(x.rec); } catch (e) { fallo(e); } } });
  }
  let colaQ = Promise.resolve();                // the fee's fields one after another: each one reads what the last one saved
  function alCambiar(e) {
    const t = e.target; if (!t.dataset || !t.dataset.co) return;
    const k = t.dataset.co;
    if (k === 'cuota') { const ctx = { cid: cliDe(t), aid: aidDe(t), v: t.value }; colaQ = colaQ.then(() => cuota(t, ctx)).catch(() => {}); } else if (k === 'num') numero(t); else if (k === 'imp') importe(t); else if (k === 'fecha') fecha(t);
    else if (k === 'paq-nombre' || k === 'paq-precio') colaQ = colaQ.then(() => paqCampo(t)).catch(() => {});   // D-307
    else if (k === 'inc-nuevo') colaQ = colaQ.then(() => incluye(t, false)).catch(() => {});
  }
  function alTecla(e) {
    const t = e.target;
    if (t.classList && t.classList.contains('ectab') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const ts = [...t.parentNode.querySelectorAll('.ectab')], i = ts.indexOf(t), n = e.key === 'Home' ? 0 : e.key === 'End' ? ts.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + ts.length) % ts.length;
      e.preventDefault(); e.stopPropagation(); tab(ts[n].dataset.t, true); return;
    }
    const k = t.dataset && t.dataset.co;
    if (k === 'cuota' || k === 'num' || k === 'imp' || k === 'paq-nombre' || k === 'paq-precio' || k === 'inc-nuevo') {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (k === 'inc-nuevo') { colaQ = colaQ.then(() => incluye(t, false)).catch(() => {}); return; } alCambiar({ target: t }); return; }
      if (e.key === 'Escape') { escCampo(e); return; }   // first Esc puts the field back; the next one closes what is open
    }
    const f = filaDe(t);
    if (f && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); e.stopPropagation(); const r = t.getBoundingClientRect(); menuFila(f.dataset.id, r.left, r.bottom + 4, t); return; }
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) { const r = t.getBoundingClientRect(); if (menuAcuPaq(t, r.left, r.bottom + 4, t)) { e.preventDefault(); e.stopPropagation(); } }
  }
  // an agreement's head or a package: «Borrar acuerdo» / «Borrar paquete», with «Deshacer» (lesson 131)
  function menuAcuPaq(el, x, y, foco) {
    const p = P(); if (!p || !p.abrirMenu || !el.closest || !el.closest('.co')) return false;
    const h = el.closest('.co-ac-h'), ac = h && h.closest('[data-acu]'), pq = el.closest('[data-paq]');
    if (ac && ac.dataset.acu) { const cid = cliDe(el), aid = ac.dataset.acu; p.abrirMenu(x, y, [['co-borrar-acu', 'Borrar acuerdo', () => borrarAcu(cid, aid)]], foco); return true; }
    if (pq && !el.closest('input')) { const id = pq.dataset.paq; p.abrirMenu(x, y, [['co-borrar-paq', 'Borrar paquete', () => borrarPaq(id)]], foco); return true; }
    return false;
  }
  // Esc in a field that changed: back to what is saved, and nothing else closes (true); else false
  function escCampo(e) {
    const t = e.target, k = t && t.dataset && t.dataset.co; if (!['cuota', 'num', 'imp', 'paq-nombre', 'paq-precio', 'inc-nuevo'].includes(k)) return false;
    const f = filaDe(t), r = f && C().get(f.dataset.id), pq = t.closest('[data-paq]'), pr = pq && C().paqGet ? C().paqGet(pq.dataset.paq) : null;
    const v0 = k === 'cuota' ? (() => { const x = document.createElement('input'); x.dataset.k = t.dataset.k; pintarCuota(x, cliDe(t), aidDe(t)); return x.value; })() : k === 'num' ? (r && r.factura) || ''
      : k === 'paq-nombre' ? (pr && pr.nombre) || '' : k === 'paq-precio' ? (pr && pr.precio != null ? eur(pr.precio) : '') : k === 'inc-nuevo' ? '' : r && +r.importe ? eur(r.importe) : '';
    if (t.value === v0) return false;
    e.preventDefault(); e.stopPropagation(); t.value = v0; return true;
  }
  function alMenu(e) {
    const f = filaDe(e.target);
    if (!f || !f.closest('.co')) { if (menuAcuPaq(e.target, e.clientX, e.clientY)) { e.preventDefault(); e.stopPropagation(); } return; }
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
    on(document, 'mx-accion', alAccion);
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
#mesa .co-vcubre{margin:-6px 0 12px;font-size:13.5px;color:var(--ink-2)}#mesa .co-vcubre b{font-weight:600;color:var(--ink)}
#mesa .co-vinc{margin:-6px 0 12px;font-size:13px;line-height:1.45;color:var(--mute)}
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
#mesa .co-sp{flex:1}#mesa .co-acu-t{align-items:center}#mesa .co-acu-t .co-mas{margin:0 -4px 0 0}
#mesa .co-ac{border:1px solid var(--line);border-radius:var(--r-md);background:var(--panel-2);margin:0 0 12px}
#mesa .co-ac.pleg,#mesa .co-ac.co-ac-sin{background:none}
#mesa .co-ac-h{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;min-height:44px;padding:10px 14px;border:0;border-radius:var(--r-md);background:none;font:inherit;font-size:13px;color:var(--ink);text-align:left}
#mesa button.co-ac-h{cursor:pointer;transition:background var(--d1) ease-out}#mesa button.co-ac-h:hover{background:var(--co-hov,var(--bg-2))}
#mesa .co-ac-h b{flex:none;font-size:14px;font-weight:600}
#mesa .co-ac-h svg{flex:none;width:16px;height:16px;color:var(--mute);transition:transform var(--d-m) var(--ease-m)}#mesa .co-ac-h[aria-expanded="true"] svg{transform:rotate(90deg)}
#mesa .co-acs{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--mute)}
#mesa .co-ach{flex:none;padding:2px 8px;border-radius:var(--r-xs);font-size:12.5px;font-weight:600;line-height:18px}
#mesa .co-ach.ok{background:var(--ok-soft);color:var(--ok)}#mesa .co-ach.fin{background:var(--bg-2);color:var(--mute)}#mesa .co-ach.prox{background:var(--bg-2);color:var(--ink-2)}
#mesa .co-acu .co-q:not(select){padding:0 10px;font-size:12.5px}
:root[data-theme="dark"] #mesa button.co-ac-h:hover,#mesa[data-theme="dark"] button.co-ac-h:hover{background:var(--bg-3)}
#mesa .co-ac-b{padding:0 14px 12px}#mesa .co-ac .co-cuota.co-acu{margin:2px 0 10px}#mesa .co-ac .co-acu-n{margin:0 0 12px}#mesa .co-ac .co-pie{margin:8px 0 0}
#mesa .co-inc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;padding:0;list-style:none}
#mesa .co-inc li{display:inline-flex;align-items:center;gap:2px;min-height:24px;box-sizing:border-box;padding:0 3px 0 10px;border-radius:var(--r-pill);background:var(--bg-2);font-size:12.5px;color:var(--ink-2)}
#mesa .co-inc.ro li{padding:0 10px}
#mesa .co-ix{display:inline-grid;place-items:center;width:22px;height:22px;padding:0;border:0;border-radius:var(--r-pill);background:none;color:var(--mute);cursor:pointer;transition:background var(--d1) ease-out,color var(--d1) ease-out}
#mesa .co-ix:hover{background:var(--line2);color:var(--ink)}#mesa .co-ix svg{width:12px;height:12px}
#mesa .co-inc li.co-inc-mas{padding:0;background:none}
#mesa .co-inc-in{box-sizing:border-box;width:150px;height:24px;padding:0 10px;border:1px dashed var(--line-strong);border-radius:var(--r-pill);background:none;font:12.5px var(--font);color:var(--ink)}
#mesa .co-inc-in::placeholder{color:var(--mute)}#mesa .co-inc-in:focus{outline:0;border-style:solid;border-color:var(--ink);box-shadow:0 0 0 3px var(--ring)}
#mesa .co-volver{display:inline-flex;align-items:center;gap:2px;margin:0 0 10px -6px;padding:4px 6px 4px 2px;border:0;border-radius:var(--r-sm);background:none;font:inherit;font-size:13px;font-weight:600;color:var(--acc-ink);cursor:pointer}
#mesa .co-volver svg{width:16px;height:16px}#mesa .co-volver:hover{background:var(--co-hov,var(--bg-2))}
#mesa .co-paq{margin:0 0 12px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--panel-2)}
#mesa .co-paq-h{display:flex;align-items:center;gap:12px;margin:0 0 10px}#mesa .co-paq .co-inc{margin:0}
#mesa .co-pq-n{flex:1;min-width:0;font-weight:600}
#mesa .co-pq-p{display:inline-flex;align-items:center;gap:6px;flex:none;margin:0;font-size:12.5px;font-weight:400;color:var(--mute)}#mesa .co-pq-p .co-q{width:110px;text-align:right}
#mesa .co-nota{margin:4px 0 0;font-size:12.5px;line-height:1.45;color:var(--mute)}
#mesa :is(.co-ac-h,.co-ix,.co-volver):focus-visible{outline:2px solid var(--focus);outline-offset:2px}
@media (prefers-reduced-motion:reduce){#mesa .co-ac-h svg,#mesa button.co-ac-h,#mesa .co-ix{transition:none}}
@media (prefers-reduced-motion:reduce){#mesa :is(.ectab,.co-q,.co-in,.co-fe,.co-mini,.co-dw,.co-pn,.co-x,.co-mas,.co-ver){transition:none}#mesa :is(.ectab,.co-fe,.co-mini,.co-pn,.co-x,.co-mas,.co-dw,.co-ver):active:not(:disabled){transform:none}}
`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).cobros = 'ok';
})();
