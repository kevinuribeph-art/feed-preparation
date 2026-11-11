// Página personal — Mesa de trabajo · v1.1 (D-180, D-181)
// The page the logo opens: every client at a glance. Four figures (what went past, what goes out today and tomorrow, what waits
// for the client, what is left to schedule), the notices behind them, a block per client (its two months as a line of steps
// and its week) and the tasks and notes, which live only here (IndexedDB 'tareas', with their photos, mesa ≥ 4.16). It reads
// what the mesa knows and changes no post: a notice opens its post in its board. The mesa starts on it, except after a reload
// inside a client, and never waits for this file: without it the logo is not a button and the last client opens.
//   M.personal: abrir() · cerrar() · abierta() · render() · datos() · tareas() · tarea({txt, fecha?, cliente?, tipo?}) ·
//   hecha(id, v) · borrar(id) · deshacer() · rehacer() · estado() · set(o)
(function personalBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.2';   // 1.2: a task's date offers «Sin fecha» (D-188)
  if (M.personal && M.personal._off) { try { M.personal._off(); } catch (e) { /* */ } }

  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const INI = ['D', 'L', 'M', 'X', 'J', 'V', 'S'], DS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const LS_FILA = 'mesa-pp-fila', LS_ALC = 'mesa-pp-alcance', LS_VISTA = 'mesa-pp-vista';   // remembered in this browser
  const SS_CLI = 'mesa-pp-cliente';            // this tab left the page for a client: a reload stays there
  const TOPE = 8;                              // lines of a group before «N más»
  const FOTO_PX = 1600, MINI_PX = 160;         // a task's photo, lowered; and the thumbnail drawn
  const svg = b => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
  const ICO = {                                // Lucide (ISC), one stroke (D-168)
    foto: svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    historias: svg('<path d="M10.1 2.182a10 10 0 0 1 3.8 0m0 19.636a10 10 0 0 1-3.8 0m7.509-18.097a10 10 0 0 1 2.69 2.7M2.182 13.9a10 10 0 0 1 0-3.8m18.097 7.509a10 10 0 0 1-2.7 2.69M21.818 10.1a10 10 0 0 1 0 3.8M3.721 6.391a10 10 0 0 1 2.7-2.69m-.03 16.578a10 10 0 0 1-2.69-2.7"/>'),
    cliente: svg('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
    nota: svg('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>'),
    fecha: svg('<path d="M8 2v4m8-4v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
    texto: svg('<path d="M15 18H3"/><path d="M17 6H3"/><path d="M21 12H3"/>'),
    mas: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
  };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage off */ } };
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const espera = ms => new Promise(r => setTimeout(r, ms));
  // days as 'YYYY-MM-DD' (Madrid's, from the mesa)
  const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const addD = (d, n) => new Date(utc(d) + n * 864e5).toISOString().slice(0, 10);
  const dow = d => new Date(utc(d)).getUTCDay();
  const difD = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
  const corto = d => `${+d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]}`;
  const finMes = m => addD(I().addMonths(m, 1) + '-01', -1);
  const lunes = d => addD(d, -((dow(d) + 6) % 7));
  const nuevoId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- state: what the visit shows (D-180: on entering, Tareas folded, Clientes and Avisos open, «Tareas» of Avisos off) ----------
  const PLG0 = { tareas: true, clientes: false, avisos: false };
  const st = {
    on: false, filtro: null, modo: 'semana', desp: 0, abiertos: new Set(), plg: { ...PLG0 }, avTareas: false,
    tcli: null, tsem: 0, tmes: 0, ttodas: false, nueva: { fecha: '', cliente: '', fotos: [] },
    fila: [1, 2, 5].includes(+lsGet(LS_FILA)) ? +lsGet(LS_FILA) : 2,
    alcance: ['sem', '1m', '2m', '3m'].includes(lsGet(LS_ALC)) ? lsGet(LS_ALC) : '1m',
    vista: ['lista', 'semana', 'mes'].includes(lsGet(LS_VISTA)) ? lsGet(LS_VISTA) : 'lista'
  };
  let D = null;                                // what was read: {CL, boards, S}
  const TK = new Map();                        // the tasks and notes: id -> record
  const PEND = new Map();                      // writes not yet in IndexedDB: id -> record | null (deleted)
  const MINI = new Map();                      // a task photo's id -> object URL of its thumbnail
  let page = null, montada = false, quedarse = 0, retomando = false, leyendo = null, tic = null, bc = null;
  const EV = [];                               // listeners to take away (_off)
  const on = (t, ty, f, o) => { t.addEventListener(ty, f, o); EV.push([t, ty, f, o]); };

  // ---------- what the mesa knows ----------
  const MANUAL = ['noaprobado', 'aprobado', 'programado', 'publicado', 'cancelado', 'empezar', 'captions', 'aprobar'];
  // another board's state as it was saved (as the vencidas of the client's other boards, D-120); the open board's, the mesa's own
  const estadoDe = (s, B) => { const X = I(); if (B && X.S && B === X.S) return X.estadoDe(s); const v = s.estado && s.estado.v; return v && MANUAL.includes(v) ? v : X.estadoAuto(s); };
  const mesesDe = B => Array.from({ length: B.span || 1 }, (_, i) => I().addMonths(B.month, i));
  function pasoDe(B, m) {                      // the month's step (D-084, D-119); another board's with its saved states
    const X = I(); if (X.S && B === X.S) return X.pasoDe(B, m);
    const ms = mesesDe(B); if (!ms.includes(m)) m = ms[0];
    const g = (X.pasosDe(B) || {})[m]; if (X.PASOS.some(p => p[0] === g)) return g;
    const vivas = (B.slots || []).filter(s => estadoDe(s, B) !== 'cancelado' && X.mesDe(s, B) === m);
    return vivas.length ? X.PASOS[Math.min(...vivas.map(s => X.PASO_DE[estadoDe(s, B)] ?? 0))][0] : 'empezar';
  }
  const esCarrusel = s => s.type === 'Carrusel' || (s.type === 'Foto' && (s.photos || []).length > 1);
  const tipoTxt = s => I().isReel(s.type) ? s.type : esCarrusel(s) ? 'Carrusel' : 'Foto';

  let gen = 0;                                 // writes so far: a reading keeps what was written while it read
  const TOCADA = new Map();                    // id -> the write (gen) that last touched it
  async function leer() {
    const X = I(), B0 = X.S, g0 = gen;
    const boards = ((await X.idbAll('boards')) || []).filter(b => b && b.month && Array.isArray(b.slots)).map(b => (B0 && b.key === B0.key ? B0 : b));
    const ts = (await X.idbAll('tareas').catch(() => [])) || [];
    const antes = new Map(TK);
    TK.clear(); for (const t of ts) if (t && t.id) TK.set(t.id, t);
    for (const [id, g] of TOCADA) if (g > g0) { const r = antes.get(id); if (r) TK.set(id, r); else TK.delete(id); }   // written while this read
    for (const [id, r] of PEND) { if (r) TK.set(id, r); else TK.delete(id); }   // a write still on its way wins over what was read
    return { CL: X.CL.slice(), boards };
  }
  const kits = {};                             // clientId -> the kit's accent colour (null: none)
  function kitColor(cid, D) {                  // only for a client with designs (its kit exists): no 404 for the others
    if (cid in kits) return Promise.resolve(kits[cid]);
    if (!D.boards.some(b => b.client === cid && b.slots.some(s => s.design))) return Promise.resolve(null);
    return (kits[cid] = fetch('kits/' + encodeURIComponent(cid) + '.json').then(r => r.ok ? r.json() : null).then(k => {
      const g = k && (k.grupos || []).find(x => /acento/i.test(x.nombre)), c = g && k.colores && k.colores[g.colores[0]];
      return (kits[cid] = /^#[0-9a-f]{6}$/i.test(c || '') ? c : null);
    }).catch(() => (kits[cid] = null)));
  }
  const claro = hex => { const n = parseInt(String(hex).slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 160; };

  // the period of the figures and the clients: Semana = today and 6 days (‹ › by weeks); Mes = a calendar month from today on
  function ventana() {
    const hoy = I().hoy();
    if (st.modo === 'mes') { const m = I().addMonths(hoy.slice(0, 7), st.desp), w0 = m + '-01', w1 = finMes(m); return { w0, w1, a0: w0 < hoy ? hoy : w0, a1: w1, dias: Array.from({ length: difD(w0, w1) + 1 }, (_, i) => addD(w0, i)) }; }
    const w0 = addD(hoy, 7 * st.desp), w1 = addD(w0, 6);
    return { w0, w1, a0: w0, a1: w1, dias: Array.from({ length: 7 }, (_, i) => addD(w0, i)) };
  }
  const rangoTxt = V => st.modo === 'mes' ? MESL[+V.w0.slice(5, 7) - 1] + ' ' + V.w0.slice(0, 4) : (V.w0.slice(5, 7) === V.w1.slice(5, 7) ? `${+V.w0.slice(8, 10)}` : corto(V.w0)) + ' – ' + corto(V.w1);

  // every post once (a collab is in two boards): the open board's copy, or the last saved; its clients in the tabs' order
  function posts(D) {
    const X = I(), by = new Map(), orden = D.CL.map(c => c.id);
    for (const B of D.boards) for (const s of B.slots) {
      const o = by.get(s.id);
      if (!o) { by.set(s.id, { s, B, clientes: [B.client], copias: [s] }); continue; }
      if (!o.clientes.includes(B.client)) o.clientes.push(B.client);
      o.copias.push(s);
      if (B === X.S || (o.B !== X.S && String(B.savedAt || '') > String(o.B.savedAt || ''))) { o.s = s; o.B = B; }
    }
    for (const o of by.values()) o.clientes.sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
    return [...by.values()];
  }
  // what doesn't depend on the period, once per reading: each post's state, day, time and kind, the stories, by client.
  // Madrid's day of a date costs (Intl): each date string once
  const memo = f => { const m = new Map(); return x => { let v = m.get(x); if (v === undefined) { v = f(x); m.set(x, v); } return v; }; };
  function prep(D) {
    if (D._p) return D._p;
    const X = I(), dia = memo(X.localDay), hora = memo(d => X.dOnly(d) ? '' : X.localTime(d)), P = posts(D), porCli = new Map(), hs = [], hsCli = new Map();
    for (const o of P) {
      const d = o.s.date;
      Object.assign(o, { e0: estadoDe(o.s, o.B), dia: d ? dia(d) : null, hora: d ? hora(d) : '', ts: d ? X.ts(d) : 0, sinHora: !d || X.dOnly(d), reel: X.isReel(o.s.type) });
      o.k = o.reel ? 'r' : esCarrusel(o.s) ? 'c' : 'f';
      for (const c of o.clientes) { if (!porCli.has(c)) porCli.set(c, []); porCli.get(c).push(o); }
    }
    const vistas = new Set();
    for (const B of D.boards) X.hsDe(B).forEach((h, j) => {
      const hid = (h && h.id) || B.key + '|' + j;
      if (!h || h.cancelada || !h.date || vistas.has(hid)) return; vistas.add(hid);
      const x = { client: B.client, B, dia: dia(h.date), prog: !!h.zernio }; hs.push(x);
      if (!hsCli.has(B.client)) hsCli.set(B.client, []); hsCli.get(B.client).push(x);
    });
    return (D._p = { P, porCli, hs, hsCli });
  }
  // its moment passed (as the mesa's yaPaso): without a time, its day is over; with one, that minute
  const paso_ = (o, t, hoy) => !!o.s.date && (o.sinHora ? o.dia < hoy : o.ts <= t);
  // since when it waits for the client (mesa ≥ 4.16 keeps it): the oldest of its copies in that state; null if unknown
  function desde(o, e) {
    const l = o.copias.map(s => s.esperaCliente).filter(x => x && x.v === e && x.desde).map(x => x.desde).sort();
    return l[0] || null;
  }

  function calcular(D) {
    const X = I(), t = X.ahora(), hoy = X.hoy(), man = addD(hoy, 1), V = ventana();
    const enV = d => d && d >= V.a0 && d <= V.a1;
    const items = [], Q = prep(D), P = Q.P;
    for (const o of P) {
      const { s, B, e0, dia, hora, reel } = o; if (e0 === 'cancelado' || !s.date) continue;
      const ya = paso_(o, t, hoy), e = e0 === 'programado' && ya && X.programadaAlDia(s) && !(s.estado && s.estado.tarde) ? 'publicado' : e0;   // D-120: one that passes on its own counts as published
      if (e === 'publicado') continue;
      const base = { tipo: 'post', s, B, clientes: o.clientes, e, dia, hora, reel, ts: o.ts };
      if (ya) { items.push({ ...base, cat: 'pasado', mano: reel && e === 'aprobado' }); continue; }
      if (dia === hoy || dia === man) { items.push({ ...base, cat: 'hoy', mano: reel && e !== 'programado' }); continue; }
      if (e === 'aprobar' || e === 'noaprobado') {
        const d0 = desde(o, e), lleva = d0 ? difD(X.localDay(d0), hoy) : 0, pronto = enV(dia);
        if (pronto || lleva > 3) { items.push({ ...base, cat: 'espera', pronto, lleva: lleva > 3 ? lleva : 0 }); continue; }
      }
      if (enV(dia) && e !== 'programado') items.push({ ...base, cat: 'falta', aMano: reel });   // a reel too: it is scheduled by hand (D-181)
    }
    const hist = new Map();                    // the stories: one line per client and day, only those not scheduled
    for (const h of Q.hs) {
      if (h.dia < hoy) continue;               // past stories don't count (the vencidas of D-120 aren't widened)
      const k = h.client + '|' + h.dia, g = hist.get(k) || { client: h.client, dia: h.dia, n: 0, sin: 0, B: h.B };
      g.n++; if (!h.prog) g.sin++; hist.set(k, g);
    }
    for (const g of hist.values()) {
      if (!g.sin) continue;
      const it = { tipo: 'historias', clientes: [g.client], B: g.B, dia: g.dia, n: g.n, sin: g.sin, ts: utc(g.dia) };
      if (g.dia === hoy || g.dia === man) items.push({ ...it, cat: 'hoy' });
      else if (enV(g.dia)) items.push({ ...it, cat: 'falta' });
    }
    if (st.avTareas) for (const k of TK.values()) {   // the tasks, only with the switch of Avisos (D-180)
      if (k.tipo !== 'tarea' || !k.fecha) continue;
      const hechaAntes = k.hecha && X.localDay(k.hecha) < hoy; if (hechaAntes) continue;
      const it = { tipo: 'tarea', k, clientes: k.cliente ? [k.cliente] : [], dia: k.fecha, ts: utc(k.fecha), hecha: !!k.hecha };
      if (k.fecha < hoy) items.push({ ...it, cat: 'pasado' }); else if (k.fecha === hoy) items.push({ ...it, cat: 'hoy' });
    }
    items.sort((a, b) => a.ts - b.ts || (a.tipo === 'historias') - (b.tipo === 'historias'));
    const cuenta = c => items.filter(x => x.cat === c && !x.hecha).length;
    const filas = D.CL.map(c => fila(c, D, Q, V, enV, hoy));
    return { items, filas, V, hoy, man, cifras: { pasado: cuenta('pasado'), hoy: cuenta('hoy'), espera: cuenta('espera'), falta: cuenta('falta') } };
  }
  function fila(c, D, Q, V, enV, hoy) {        // a client's block
    const X = I(), bs = D.boards.filter(b => b.client === c.id), cd = +c.cycleDay || 1;
    const m1 = X.cycleOfDay(V.a0, cd) || V.a0.slice(0, 7);
    const meses = [m1, X.addMonths(m1, 1)].map(m => {
      const B = bs.filter(b => mesesDe(b).includes(m)).sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0] || null;
      return { m, B, paso: B ? pasoDe(B, m) : null };
    });
    const dias = V.dias.map(d => ({ d, f: 0, c: 0, r: 0, h: 0, t: 0, nombres: [] })), at = Object.fromEntries(dias.map(x => [x.d, x]));
    let pubs = 0, pubSin = 0, hs = 0, hsSin = 0;
    for (const o of Q.porCli.get(c.id) || []) {
      const e = o.e0; if (e === 'cancelado' || !o.s.date) continue;
      const d = o.dia, x = at[d];
      if (x) { x[o.k]++; x.nombres.push(o.s.name); }
      if (enV(d)) { pubs++; if (!['programado', 'publicado'].includes(e)) pubSin++; }   // reels too (D-181)
    }
    for (const h of Q.hsCli.get(c.id) || []) { const x = at[h.dia]; if (x) x.h++; if (enV(h.dia)) { hs++; if (!h.prog) hsSin++; } }
    const tk = [...TK.values()].filter(k => k.tipo === 'tarea' && k.cliente === c.id && !k.hecha);
    for (const k of tk) if (k.fecha && at[k.fecha]) at[k.fecha].t++;
    return { c, meses, dias, pubs, pubSin, hs, hsSin, tareas: tk.length };
  }

  // ---------- pieces ----------
  const cliDe = id => ((D && D.CL) || I().CL).find(c => c.id === id) || null;
  const inic = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
  const nombreC = id => esc((cliDe(id) || { name: id }).name);
  function avatar(cid, cls = '') {
    const c = cliDe(cid) || { name: '?' }, f = c.foto && M.files[c.foto];
    if (f && f.thumbUrl) return `<span class="pp-ava ${cls}" aria-hidden="true"><img src="${f.thumbUrl}" alt=""></span>`;
    const k = kits[cid];
    return `<span class="pp-ava ${cls}${typeof k === 'string' ? ' kit' + (claro(k) ? ' claro' : '') : ''}"${typeof k === 'string' ? ` style="--pp-kit:${esc(k)}"` : ''} aria-hidden="true">${esc(inic(c.name))}</span>`;
  }
  // the figures and the groups go by urgency, in one order (D-180, chosen by Claude): what waits for the client blocks what
  // is left to schedule
  const GRUPOS = [['pasado', 'Se ha pasado'], ['hoy', 'Hoy y mañana'], ['espera', 'Esperando al cliente'], ['falta', 'Falta programar']];
  function cifras(R) {
    return `<div class="pp-cifras" role="group" aria-label="Avisos">${GRUPOS.map(([k, l]) => { const n = R.cifras[k];
      return `<button type="button" class="pp-cifra${k === 'pasado' && n ? ' rojo' : ''}${st.filtro === k ? ' on' : ''}" data-pp="filtro" data-k="${k}" aria-pressed="${st.filtro === k}"${n || st.filtro === k ? '' : ' disabled'}><b>${n}</b><span>${l}</span></button>`; }).join('')}</div>`;
  }
  function periodo(R) {
    const s = st.modo === 'semana', t = rangoTxt(R.V);
    return `<div class="pp-periodo"><div class="seg" role="group" aria-label="Periodo"><button type="button" class="${s ? 'on' : ''}" data-pp="modo" data-m="semana" aria-pressed="${s}">Semana</button><button type="button" class="${s ? '' : 'on'}" data-pp="modo" data-m="mes" aria-pressed="${!s}">Mes</button></div>`
      + `<span class="pp-nav"><button type="button" class="ibtn pp-ant" data-pp="desp" data-d="-1" aria-label="${s ? 'Semana anterior' : 'Mes anterior'}" title="${s ? 'Semana anterior' : 'Mes anterior'}">‹</button><span class="pp-rango" data-pp="rango" title="${esc(t)} · doble clic: ${s ? 'esta semana' : 'este mes'}">${esc(t)}</span><button type="button" class="ibtn pp-sig" data-pp="desp" data-d="1" aria-label="${s ? 'Semana siguiente' : 'Mes siguiente'}" title="${s ? 'Semana siguiente' : 'Mes siguiente'}">›</button></span></div>`;
  }
  const estLbl = e => (I().ESTADOS.find(x => x[0] === e) || [e, e])[1];
  function cuando(x, R) {
    if (x.cat === 'pasado') return `<span class="pp-cu rojo">${esc(corto(x.dia))}</span>`;
    if (x.cat === 'hoy') return `<span class="pp-cu">${x.tipo === 'post' ? esc(x.hora) : ''}</span>`;
    return `<span class="pp-cu">${esc(corto(x.dia))}</span>`;
  }
  function mini(x) {                           // the post's photo (its thumbnail) with its type over it; a single photo has none
    if (x.tipo !== 'post') return `<span class="pp-afoto vacia">${x.tipo === 'tarea' ? ICO.fecha : ICO.historias}</span>`;
    const f = x.s.photos && x.s.photos[0] && M.files[x.s.photos[0]], ty = tipoTxt(x.s) === 'Foto' ? '' : I().tipoPost(x.s).ico;
    return f && f.thumbUrl ? `<span class="pp-afoto"><img src="${f.thumbUrl}" alt="" loading="lazy" decoding="async">${ty ? `<i>${ty}</i>` : ''}</span>` : `<span class="pp-afoto vacia">${ty || ICO.foto}</span>`;
  }
  function aviso(x, R) {
    const avs = `<span class="pp-avs">${x.clientes.slice(0, 2).map(c => avatar(c, 'xs')).join('')}</span>`, quien = x.clientes.map(nombreC).join(' × ');
    if (x.tipo === 'tarea') return `<div class="pp-av tarea${x.hecha ? ' hecha' : ''}" data-tid="${esc(x.k.id)}"><span class="pp-avs"><input type="checkbox" class="pp-ck" data-pp="ck" data-id="${esc(x.k.id)}"${x.hecha ? ' checked' : ''} aria-label="Hecha"></span>${cuando(x, R)}${mini(x)}<span class="pp-nm" data-pp="tver" data-id="${esc(x.k.id)}" tabindex="0" role="button"><b>${esc(x.k.txt)}</b>${x.clientes.length ? ` <i>${quien}</i>` : ''}</span><span class="pp-est"></span></div>`;
    if (x.tipo === 'historias') {
      const cu = x.dia === R.hoy ? 'hoy' : x.dia === R.man ? 'mañana' : 'el ' + corto(x.dia);
      return `<button type="button" class="pp-av" data-pp="hs" data-key="${esc(x.B.key)}" title="${x.n} ${x.n === 1 ? 'historia' : 'historias'} ${cu} · ${x.sin} sin programar">${avs}${cuando(x, R)}${mini(x)}<span class="pp-nm"><b>${x.sin} ${x.sin === 1 ? 'historia' : 'historias'}${x.cat === 'hoy' ? ' ' + cu : ''} sin programar</b> <i>${quien}</i></span><span class="pp-est"></span></button>`;
    }
    let est = `${I().estIco(x.e, ' aria-hidden="true"')}${esc(estLbl(x.e))}`;
    if (x.mano) est = `<span class="pp-mano">publicar a mano</span>`;
    if (x.aMano) est += ` <span class="pp-por">· se programa a mano</span>`;   // D-181: its state stays, as the reasons of a wait
    if (x.cat === 'espera') { const r = []; if (x.pronto) { const n = difD(R.hoy, x.dia); r.push(n === 1 ? 'sale mañana' : `sale en ${n} días`); } if (x.lleva) r.push(`lleva ${x.lleva} días`); est += ` <span class="pp-por">· ${r.join(' · ')}</span>`; }
    return `<button type="button" class="pp-av" data-pp="abrir" data-key="${esc(x.B.key)}" data-slot="${esc(x.s.id)}" title="${esc(x.s.name)} · ${esc(tipoTxt(x.s))} · ${esc(corto(x.dia))}${x.hora ? ' ' + esc(x.hora) : ''}">${avs}${cuando(x, R)}${mini(x)}<span class="pp-nm"><b>${esc(x.s.name)}</b> <i>${quien}</i></span><span class="pp-est">${est}</span></button>`;
  }
  function avisos(R) {
    const html = GRUPOS.filter(([c]) => !st.filtro || st.filtro === c).map(([c, t]) => {
      let l = R.items.filter(x => x.cat === c); if (!l.length) return '';
      const n = l.filter(x => !x.hecha).length, todo = st.abiertos.has(c) || st.filtro === c, mas = l.length - TOPE;
      if (!todo && mas > 0) l = l.slice(0, TOPE);
      let filas = '', man = false;
      for (const x of l) { if (c === 'hoy' && !man && x.dia === R.man) { man = true; filas += `<p class="pp-sub">Mañana</p>`; } filas += aviso(x, R); }
      return `<section class="pp-grupo" data-cat="${c}"><h3 class="pp-gt">${t} <span>${n}</span></h3><div class="pp-lista">${filas}${!todo && mas > 0 ? `<button type="button" class="pp-mas" data-pp="mas" data-c="${c}">${mas} más</button>` : ''}</div></section>`;
    }).join('');
    return html || `<p class="pp-orden">Todo en orden</p>`;
  }
  function paso(B, m, p) {                     // the month's steps as a line of 6, its state above, both in its colour (A3d)
    const mes = `<span class="pp-mes">${MES[+m.slice(5, 7) - 1]}</span>`;
    if (!B) return `<span class="pp-pasos sin">${mes}<span class="pp-sin">sin tablero</span></span>`;
    const P = I().PASOS, i = Math.max(0, P.findIndex(x => x[0] === p)), lab = esc(P[i][1]);
    return `<span class="pp-pasos" title="${esc(MESL[+m.slice(5, 7) - 1])}: ${lab} (paso ${i + 1} de ${P.length})">${mes}<span class="pp-lc"><span class="pp-ll" data-e="${p}">${I().estIco(p, ' aria-hidden="true"')}${lab}</span><span class="pp-bar" data-e="${p}" aria-hidden="true">${P.map((x, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span></span></span>`;
  }
  function tira(f, R) {
    return `<span class="pp-tira${st.modo === 'mes' ? ' mes' : ''}" style="--n:${f.dias.length}">${f.dias.map(x => {
      const dots = '<i class="pp-dot f"></i>'.repeat(x.f) + '<i class="pp-dot c"></i>'.repeat(x.c) + '<i class="pp-dot r"></i>'.repeat(x.r) + (x.h ? '<i class="pp-dot h"></i>' : '') + (x.t ? '<i class="pp-dot t"></i>' : '');
      const tit = [corto(x.d), ...x.nombres, x.h ? x.h + (x.h === 1 ? ' historia' : ' historias') : '', x.t ? x.t + (x.t === 1 ? ' tarea' : ' tareas') : ''].filter(Boolean).join(' · ');
      return `<span class="pp-dia${x.d === R.hoy ? ' hoy' : ''}${x.d < R.hoy ? ' pas' : ''}" title="${esc(tit)}">${dots}</span>`; }).join('')}</span>`;
  }
  function cabDias(R) {
    return `<span class="pp-cab pp-tira${st.modo === 'mes' ? ' mes' : ''}" style="--n:${R.V.dias.length}" aria-hidden="true">${R.V.dias.map(d => `<span class="${d === R.hoy ? 'hoy' : ''}">${st.modo === 'mes' ? (+d.slice(8, 10) % 7 === 1 || d === R.hoy ? +d.slice(8, 10) : '') : `${INI[dow(d)]}<b>${+d.slice(8, 10)}</b>`}</span>`).join('')}</span>`;
  }
  function cuentas(f) {
    const a = [];
    if (f.pubs) a.push(`${f.pubs} ${f.pubs === 1 ? 'publicación' : 'publicaciones'}${f.pubSin ? ` · ${f.pubSin} sin programar` : ''}`);
    if (f.hs) a.push(`${f.hs} ${f.hs === 1 ? 'historia' : 'historias'}${f.hsSin ? ` · ${f.hsSin} sin programar` : ''}`);
    if (f.tareas) a.push(`${f.tareas} ${f.tareas === 1 ? 'tarea' : 'tareas'}`);
    return `<span class="pp-cuentas">${a.map(x => `<span>${x}</span>`).join('')}</span>`;
  }
  function bloque(f, R) {
    const m = f.meses[0];
    return `<button type="button" class="pp-blq" data-pp="cliente" data-c="${esc(f.c.id)}"${m.B ? ` data-key="${esc(m.B.key)}"` : ''}><span class="pp-l1"><span class="pp-quien">${avatar(f.c.id)}<span class="pp-cn">${esc(f.c.name)}</span></span>${cuentas(f)}</span>`
      + `<span class="pp-l2">${f.meses.map(x => paso(x.B, x.m, x.paso)).join('')}</span>${tira(f, R)}</button>`;
  }
  const cabPlg = (k, t, n, pl) => `<button type="button" class="pp-fold" data-pp="plegar" data-p="${k}" aria-expanded="${!pl}" title="${pl ? 'Desplegar' : 'Plegar'} ${t.toLowerCase()}"><b>${t}</b>${n ? `<span>${n}</span>` : ''}</button>`;

  // ---------- tasks and notes ----------
  const tareas = () => [...TK.values()].filter(k => k.tipo === 'tarea');
  const notas = () => [...TK.values()].filter(k => k.tipo === 'nota').sort((a, b) => String(a.creada).localeCompare(String(b.creada)));
  const hechaHoy = (k, hoy) => !!k.hecha && I().localDay(k.hecha) >= hoy;
  const RANGO = { sem: ['1 semana', '1S'], '1m': ['1 mes', '1M'], '2m': ['2 meses', '2M'], '3m': ['3 meses', '3M'] };
  function alcance(hoy) {                      // back and ahead from today
    if (st.alcance === 'sem') return [addD(hoy, -7), addD(hoy, 7)];
    const n = +st.alcance.charAt(0), dd = hoy.slice(7);
    const lim = (m, d) => { const f = finMes(m); return (m + d) > f ? f : m + d; };
    return [lim(I().addMonths(hoy.slice(0, 7), -n), dd), lim(I().addMonths(hoy.slice(0, 7), n), dd)];
  }
  const barraPg = (h, n) => `<span class="pp-pb" aria-hidden="true"><i style="width:${(h / n * 100).toFixed(1)}%"></i></span>`;
  const fotosURL = f => { if (!f || !f.mini) return ''; let u = MINI.get(f.id); if (!u) { u = URL.createObjectURL(f.mini); MINI.set(f.id, u); } return u; };
  function tareasHTML(R) {
    const X = I(), hoy = R.hoy, todas = tareas(), fin = addD(hoy, 6);
    const conT = R.filas.map(f => f.c).filter(c => [...TK.values()].some(k => k.cliente === c.id && !(k.hecha && X.localDay(k.hecha) < hoy)));   // the clients with tasks or notes
    if (st.tcli && !conT.some(c => c.id === st.tcli)) st.tcli = null;
    const l = todas.filter(k => !st.tcli || k.cliente === st.tcli);
    const venc = k => !k.hecha && k.fecha && k.fecha < hoy;
    const diaTxt = d => d === hoy ? 'hoy' : d > hoy && d <= fin ? `${DS[dow(d)]} ${+d.slice(8, 10)}` : corto(d);
    const ck = k => `<input type="checkbox" class="pp-ck" data-pp="ck" data-id="${esc(k.id)}"${k.hecha ? ' checked' : ''} aria-label="Hecha">`;
    const ver = k => `data-pp="tver" data-id="${esc(k.id)}" tabindex="0" role="button"`;   // a click or Enter opens it big (D-182)
    // its details, an icon; its subtasks, a thin bar with how many are done (D-183); without them the line doesn't change
    const mas = (k, tt) => { const n = (k.subtareas || []).length, h = n ? k.subtareas.filter(x => x.hecha).length : 0, d = !!String(k.detalles || '').trim();
      if (!n && !d) return tt;
      return `<span class="pp-col"><span class="pp-tl">${tt}${d ? `<span class="pp-tdet" title="Con detalles">${ICO.texto}</span>` : ''}</span>${n ? `<span class="pp-pg${h === n ? ' todo' : ''}" title="${h} de ${n} subtareas hechas">${barraPg(h, n)}${h}/${n}</span>` : ''}</span>`; };
    const av = k => !st.tcli && k.cliente ? avatar(k.cliente, 'xs') : '';
    const fotos = (k, cls = '') => (k.fotos || []).length ? `<button type="button" class="pp-tfo ${cls}" data-pp="foto" data-id="${esc(k.id)}" title="${k.fotos.length === 1 ? 'Ver la foto' : `Ver las ${k.fotos.length} fotos`}" aria-label="Ver la foto"><img src="${fotosURL(k.fotos[0])}" alt="">${k.fotos.length > 1 ? `<b>${k.fotos.length}</b>` : ''}</button>` : '';
    const linea = (k, fecha = true) => `<div class="pp-tk${k.hecha ? ' hecha' : ''}" data-tid="${esc(k.id)}">${ck(k)}${mas(k, `<span class="pp-tt" ${ver(k)}>${esc(k.txt)}</span>`)}${fotos(k)}${fecha && k.fecha ? `<span class="pp-tf${venc(k) ? ' rojo' : ''}">${diaTxt(k.fecha)}</span>` : ''}${av(k)}</div>`;
    let celda = null;                          // the day being drawn (Semana): an overdue task from before says its date
    const ficha = k => `<div class="pp-fi${k.hecha ? ' hecha' : ''}${venc(k) ? ' venc' : ''}" data-tid="${esc(k.id)}">${ck(k)}${mas(k, `<span class="pp-tt" ${ver(k)}>${esc(k.txt)}${venc(k) && k.fecha !== celda ? ` <i>${esc(corto(k.fecha))}</i>` : ''}</span>`)}${fotos(k, 'mini')}${av(k)}</div>`;
    const cli = st.tcli ? cliDe(st.tcli) : null, N = st.nueva;
    const pend = N.fotos.length ? `<span class="pp-tfo pp-npend"><img src="${fotosURL(N.fotos[0])}" alt="">${N.fotos.length > 1 ? `<b>${N.fotos.length}</b>` : ''}</span>` : '';
    const nfecha = `<span class="pp-ncampo${N.fecha ? '' : ' vacio'}" data-k="fecha"><input type="date" class="pp-nfecha" data-sin-fecha value="${esc(N.fecha)}" aria-label="Fecha de la tarea"></span>`;
    const ncli = cli ? '' : `<span class="pp-ncampo${N.cliente ? '' : ' vacio'}" data-k="cliente"><select class="pp-ncli" aria-label="Cliente de la tarea"><option value="">Sin cliente</option>${R.filas.map(f => `<option value="${esc(f.c.id)}"${N.cliente === f.c.id ? ' selected' : ''}>${esc(f.c.name)}</option>`).join('')}</select></span>`;
    const nueva = `<div class="pp-nueva" data-tid="nueva"><input type="text" class="pp-nin" data-pp="nueva" placeholder="${cli ? 'Nueva tarea para ' + esc(cli.name) : 'Nueva tarea'}" aria-label="Nueva tarea" autocomplete="off">${pend}${nfecha}${ncli}`
      + `<button type="button" class="ibtn pp-ib" data-pp="nota-campo" title="Guardar como nota${cli ? ' de ' + esc(cli.name) : ''}" aria-label="Guardar como nota">${ICO.nota}</button>`
      + `<button type="button" class="ibtn pp-ib${N.fecha ? ' puesta' : ''}" data-pp="nfecha" title="Fecha" aria-label="Fecha">${ICO.fecha}</button>`
      + (cli ? '' : `<button type="button" class="ibtn pp-ib${N.cliente ? ' puesta' : ''}" data-pp="ncli" title="Cliente" aria-label="Cliente">${ICO.cliente}</button>`) + `</div>`;
    const filtro = conT.length ? `<div class="pp-tcl" role="group" aria-label="Ver las tareas de"><button type="button" class="pp-tc todos${st.tcli ? '' : ' on'}" data-pp="tcli" data-c="" aria-pressed="${!st.tcli}">Todos</button>${conT.map(c => `<button type="button" class="pp-tc${st.tcli === c.id ? ' on' : ''}" data-pp="tcli" data-c="${esc(c.id)}" aria-pressed="${st.tcli === c.id}" title="${esc(c.name)}" aria-label="${esc(c.name)}">${avatar(c.id)}</button>`).join('')}</div>` : '<span></span>';
    const sw = `<label class="sw pp-sw"><input type="checkbox" data-pp="ttodas"${st.ttodas ? ' checked' : ''}> Todas</label>`;
    let izq = '', barra = '', der = '';
    if (st.vista === 'lista') {
      const [r0, r1] = alcance(hoy), en = d => d >= r0 && d <= r1;
      // apagado: what is left to do up to the scope and what was done today (struck out until tomorrow); encendido: also what
      // was done, within the scope. The overdue ones, always (D-180)
      const lf = l.filter(k => k.fecha && (venc(k) || (st.ttodas ? en(k.fecha) : ((!k.hecha && k.fecha <= r1 && k.fecha >= hoy) || (hechaHoy(k, hoy) && k.fecha <= r1))))).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.creada).localeCompare(String(b.creada)));
      barra = `<span class="pp-tsw"><div class="seg pp-rg" role="group" aria-label="Hasta dónde">${Object.keys(RANGO).map(k => `<button type="button" class="${st.alcance === k ? 'on' : ''}" data-pp="alcance" data-r="${k}" aria-pressed="${st.alcance === k}" title="${RANGO[k][0]} atrás y adelante">${RANGO[k][1]}</button>`).join('')}</div>${sw}</span>`;
      izq = lf.length ? `<div class="pp-lista">${lf.map(k => linea(k)).join('')}</div>` : `<p class="pp-orden">${l.some(k => k.fecha) ? 'Nada con fecha aquí' : 'Ninguna con fecha'}</p>`;
      const sinV = l.filter(k => !k.fecha && (st.ttodas ? (!k.hecha || en(X.localDay(k.hecha))) : (!k.hecha || hechaHoy(k, hoy))));
      if (sinV.length) der = `<div class="pp-sinf"><p class="pp-sub">Sin fecha <span>${sinV.filter(k => !k.hecha).length}</span></p><div class="pp-lista">${sinV.map(k => linea(k, false)).join('')}</div></div>`;
    } else {
      const ver = k => st.ttodas || !k.hecha || hechaHoy(k, hoy);
      // today's cell also holds the overdue ones from before what is seen (those seen are on their own day)
      const enDia = (d, desde) => l.filter(k => k.fecha === d && ver(k)).concat(desde ? l.filter(k => venc(k) && k.fecha < desde).sort((a, b) => a.fecha < b.fecha ? -1 : 1) : []);
      const nav = (t, ant, sig, dbl) => `<span class="pp-nav"><button type="button" class="ibtn pp-ant" data-pp="tnav" data-d="-1" aria-label="${ant}" title="${ant}">‹</button><span class="pp-rango" data-pp="trango" title="${esc(t)} · doble clic: ${dbl}">${esc(t)}</span><button type="button" class="ibtn pp-sig" data-pp="tnav" data-d="1" aria-label="${sig}" title="${sig}">›</button></span>`;
      if (st.vista === 'semana') {
        const lun = addD(lunes(hoy), 7 * st.tsem), dias = Array.from({ length: 7 }, (_, i) => addD(lun, i));
        const t = (lun.slice(5, 7) === dias[6].slice(5, 7) ? `${+lun.slice(8, 10)}` : corto(lun)) + ' – ' + corto(dias[6]);
        barra = `<span class="pp-tsw">${nav(t, 'Semana anterior', 'Semana siguiente', 'esta semana')}${sw}</span>`;
        izq = `<div class="pp-sem">${dias.map(d => `<div class="pp-sd${d === hoy ? ' hoy' : ''}${d < hoy ? ' pas' : ''}"><p class="pp-sh">${INI[dow(d)]} <b>${+d.slice(8, 10)}</b></p>${(celda = d, enDia(d, d === hoy ? lun : null)).map(ficha).join('')}</div>`).join('')}</div>`;
      } else {
        const m = X.addMonths(hoy.slice(0, 7), st.tmes), d0 = m + '-01', ini = lunes(d0), fm = finMes(m), n = Math.ceil((difD(ini, fm) + 1) / 7) * 7;
        const t = MESL[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
        barra = `<span class="pp-tsw">${nav(t, 'Mes anterior', 'Mes siguiente', 'este mes')}${sw}</span>`;
        izq = `<div class="pp-mesg"><div class="pp-mcab" aria-hidden="true">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div><div class="pp-mgrid">${Array.from({ length: n }, (_, i) => addD(ini, i)).map(d => {
          const fuera = d.slice(0, 7) !== m, ks = fuera ? [] : enDia(d, d === hoy ? d0 : null);
          return `<div class="pp-md${d === hoy ? ' hoy' : ''}${fuera ? ' fuera' : ''}"><span class="pp-mn">${+d.slice(8, 10)}</span>${ks.slice(0, 2).map(k => `<span class="pp-mt${k.hecha ? ' hecha' : ''}${venc(k) ? ' venc' : ''}" data-tid="${esc(k.id)}" ${ver(k)} title="${esc(k.txt)}${venc(k) ? ' · ' + esc(corto(k.fecha)) : ''}">${(k.fotos || []).length ? `<img src="${fotosURL(k.fotos[0])}" alt="">` : ''}${esc(k.txt)}${(k.subtareas || []).length ? ` · ${k.subtareas.filter(x => x.hecha).length}/${k.subtareas.length}` : ''}</span>`).join('')}${ks.length > 2 ? `<span class="pp-mm">${ks.length - 2} más</span>` : ''}</div>`; }).join('')}</div></div>`;
      }
    }
    const ns = st.vista === 'lista' ? notas().filter(n => st.tcli ? n.cliente === st.tcli : !n.cliente) : [];
    const pn = ns.length ? `<div class="pp-pn">${ns.map(n => `<div class="pp-pt" data-nid="${esc(n.id)}" ${ver(n)} aria-label="Nota: ${esc(n.txt)}"><p class="pp-ptx">${esc(n.txt)}</p></div>`).join('')}</div>` : '';
    return `<div class="pp-pc">${nueva}<div class="pp-tfila">${filtro}${barra}</div>${pn}<div class="pp-tv${der ? ' dos' : ''}"><div class="pp-tvi">${izq}</div>${der}</div></div>`;
  }
  const segVista = () => `<div class="seg pp-tvs" role="group" aria-label="Vista de las tareas">${[['lista', 'Lista'], ['semana', 'Semana'], ['mes', 'Mes']].map(([k, l]) => `<button type="button" class="${st.vista === k ? 'on' : ''}" data-pp="tvista" data-v="${k}" aria-pressed="${st.vista === k}">${l}</button>`).join('')}</div>`;
  const segFila = () => `<div class="seg pp-tvs pp-pfn" role="group" aria-label="Clientes por fila">${[1, 2, 5].map(n => `<button type="button" class="${st.fila === n ? 'on' : ''}" data-pp="fila" data-n="${n}" aria-pressed="${st.fila === n}" title="${n} por fila" aria-label="${n} por fila">${n}</button>`).join('')}</div>`;

  // ---------- the page ----------
  // the clients that fit in a row at this width (a block needs 180 px): «1 · 2 · 5» is the most, never squeezed
  function anchoClientes() {                   // the width the clients' grid gets, from the page's
    if (!page || !page.clientWidth) return 1000;
    const movil = innerWidth <= 720, rail = !movil && !st.plg.avisos;
    return Math.min(page.clientWidth - (movil ? 24 : 40), 1480) - (rail ? 436 : 0) - 16;
  }
  const caben = () => Math.max(1, Math.floor((anchoClientes() + 8) / 188));
  function pagina(R) {
    const pl = st.plg, cols = Math.max(1, Math.min(st.fila, R.filas.length || 1, caben()));
    const nTar = tareas().filter(k => !k.hecha).length, nAv = R.cifras.pasado + R.cifras.hoy + R.cifras.espera + R.cifras.falta;
    const P = [
      { k: 'tareas', t: 'Tareas', n: nTar, cls: 'pp-tareas', extra: segVista, html: () => tareasHTML(R) },
      { k: 'clientes', t: 'Clientes', n: R.filas.length, cls: 'pp-clientes', extra: segFila,
        html: () => R.filas.length ? `<div class="pp-pc"><div class="pp-bcab" style="--cols:${cols}" aria-hidden="true">${Array.from({ length: cols }, () => cabDias(R)).join('')}</div><div class="pp-bgrid${cols > 2 || (anchoClientes() - (cols - 1) * 8) / cols < 380 ? ' estrecha' : ''}" style="--cols:${cols}">${R.filas.map(f => bloque(f, R)).join('')}</div></div>` : '<div class="pp-pc"><p class="pp-orden">Sin clientes</p></div>' },
      { k: 'avisos', t: 'Avisos', n: nAv }
    ];
    const arriba = P.filter(x => pl[x.k]), izq = P.filter(x => !pl[x.k] && x.k !== 'avisos'), rail = !pl.avisos;
    const cls = !rail ? ' sin-rail' : !izq.length ? ' solo-rail' : '';
    return `<div class="pp-in${cls}"><div class="pp-top">${cifras(R)}${periodo(R)}</div>`
      + `<div class="pp-izq">${arriba.length ? `<div class="pp-tabs">${arriba.map(x => `<section class="pp-plg fold" data-panel="${x.k}">${cabPlg(x.k, x.t, x.n, true)}</section>`).join('')}</div>` : ''}`
      + izq.map(x => `<section class="${x.cls} pp-plg" data-panel="${x.k}"><div class="pp-phr"><h2 class="pp-ph">${cabPlg(x.k, x.t, x.n, false)}</h2>${x.extra()}</div>${x.html()}</section>`).join('') + `</div>`
      + (rail ? `<aside class="pp-rail"><div class="pp-avisos pp-plg" data-panel="avisos"><div class="pp-phr"><h2 class="pp-ph">${cabPlg('avisos', 'Avisos', nAv, false)}</h2><label class="sw pp-sw"><input type="checkbox" data-pp="avtareas"${st.avTareas ? ' checked' : ''}> Tareas</label></div><div class="pp-grupos">${avisos(R)}</div></div></aside>` : '') + `</div>`;
  }

  // ---------- drawing: from what was read (sync), and reading again (async) ----------
  let R = null, ultimo = '';
  function pintar(R0) {
    if (!st.on || !page || !D) return;
    R = R0 || calcular(D);
    const html = pagina(R);
    if (html === ultimo && page.firstChild) { pintarCard(); return; }   // nothing changed: what is open (a dropdown, a caret, a composition) stays; the card follows its record
    ultimo = html;
    // what is being typed survives the drawing: the new task's text, the caret, the focus
    const a = document.activeElement, enPag = a && page.contains(a);
    const clave = enPag ? (a.dataset.pp ? `[data-pp="${a.dataset.pp}"]${a.dataset.id ? `[data-id="${CSS.escape(a.dataset.id)}"]` : ''}${a.dataset.k ? `[data-k="${CSS.escape(a.dataset.k)}"]` : ''}${a.dataset.c != null ? `[data-c="${CSS.escape(a.dataset.c)}"]` : ''}${a.dataset.v ? `[data-v="${CSS.escape(a.dataset.v)}"]` : ''}${a.dataset.r ? `[data-r="${CSS.escape(a.dataset.r)}"]` : ''}${a.dataset.n ? `[data-n="${CSS.escape(a.dataset.n)}"]` : ''}${a.dataset.p ? `[data-p="${CSS.escape(a.dataset.p)}"]` : ''}` : null) : null;
    const inp = page.querySelector('[data-pp="nueva"]'), txt = inp ? inp.value : '', sel = inp && a === inp ? [inp.selectionStart, inp.selectionEnd] : null;
    const y = page.scrollTop;
    page.innerHTML = html;
    if (M.controles && M.controles.mejorar) M.controles.mejorar(page);
    const n = page.querySelector('[data-pp="nueva"]'); if (n && txt) n.value = txt;
    if (clave) { const b = page.querySelector(clave); if (b) { b.focus({ preventScroll: true }); if (sel && b === n) b.setSelectionRange(sel[0], sel[1]); } }
    page.scrollTop = y;
    pintarCard();
  }
  async function refrescar() {
    if (!st.on || !page) return;
    if (leyendo) { leyendo.otra = true; return leyendo.p; }
    const yo = leyendo = { otra: false, p: null };
    yo.p = (async () => {
      try {
        do {
          yo.otra = false;
          const d = await leer(), X = I();
          D = d;
          // the first time, what is known at once; the thumbnails and the kits' colours follow (a second drawing, only if they change)
          if (!page.firstChild && !notaEnCurso()) pintar();
          const r0 = calcular(D), quiero = d.CL.map(c => c.foto).filter(Boolean);
          for (const x of r0.items) if (x.tipo === 'post' && x.s.photos && x.s.photos[0]) quiero.push(x.s.photos[0]);   // the thumbnails in sight, never their photos
          const falta = [...new Set(quiero)].filter(id => !(M.files[id] && M.files[id].thumbUrl));
          await Promise.all([Promise.all(d.CL.map(c => kitColor(c.id, d))), falta.length ? X.loadThumbs(falta).catch(() => {}) : null]);
        } while (yo.otra);
        if (ocupada()) pendiente = true; else pintar();   // computed again (a click meanwhile may have changed what is seen); the same page isn't drawn again
      } finally { if (leyendo === yo) leyendo = null; }
    })();
    return yo.p;
  }
  let pendiente = false, componiendo = false;  // a drawing put off while something is being written or chosen
  const notaEnCurso = () => !!(CARD && CARD.ed && enCard(document.activeElement));   // writing in the card (D-182)
  const ocupada = () => notaEnCurso() || componiendo || !!menu || !!(M.controles && M.controles.abierto && M.controles.abierto() && page && page.contains(M.controles.abierto().de));
  // a drawing put off is done as soon as what held it closes (a control, the menu, a composition, a note left)
  const retomar = () => { if (pendiente && st.on) setTimeout(() => { if (pendiente && st.on && !ocupada()) { pendiente = false; pintar(); } }, 0); };

  // ---------- opening and closing ----------
  function colocar() {                         // the page after the header; the logo is its button (not in «Vista cliente»)
    const X = I(), root = X && X.root && X.root(); if (!root || !X.shellReady()) return;
    const ab = root.querySelector('.appbar'); if (!ab) return;
    if (!page) { page = document.createElement('section'); page.className = 'pp'; page.hidden = true; page.setAttribute('aria-label', 'Página personal'); }
    if (page.parentNode !== root) ab.after(page);
    let b = ab.querySelector('.brand');
    if (b && b.tagName !== 'BUTTON') { const n = document.createElement('button'); n.type = 'button'; n.className = 'brand pp-logo'; n.innerHTML = b.innerHTML; n.dataset.pp = 'logo'; b.replaceWith(n); b = n; }
    if (b) { const cli = root.classList.contains('client'); if (cli) { b.removeAttribute('title'); b.removeAttribute('aria-label'); b.tabIndex = -1; } else { b.title = 'Página personal'; b.setAttribute('aria-label', 'Página personal'); b.tabIndex = 0; } if (st.on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  }
  function abrir() {
    const X = I(), root = X && X.root && X.root(); if (!root || !X.shellReady() || root.classList.contains('client')) return false;
    if (M.libre && M.libre.abierto && M.libre.abierto()) return false;   // the editor covers the mesa: it is closed with its own buttons
    if (M.diseno && M.diseno.abierto && M.diseno.abierto()) return false;
    const det = root.querySelector('.detail'); if (det && !det.hidden && X.closeDetail) X.closeDetail();
    // each visit starts the same (D-180): Tareas folded, Clientes and Avisos open, the tasks out of Avisos, no figure chosen
    st.plg = { ...PLG0 }; st.avTareas = false; st.filtro = null; st.abiertos.clear();
    st.on = true; ssSet(SS_CLI, null);
    root.classList.add('pp-on'); colocar(); page.hidden = false; page.scrollTop = 0;
    if (D) pintar();
    refrescar();
    return true;
  }
  function cerrar() {
    const X = I(), root = X && X.root && X.root();
    if (!st.on) return;
    st.on = false; ssSet(SS_CLI, '1'); cerrarMenu(); if (CARD) { if (CARD.ed) guardarCard(); quitarCard(); }
    if (root) root.classList.remove('pp-on');
    if (page) { page.hidden = true; page.innerHTML = ''; }
    colocar();
    if (X && X.renderBar && X.S) { try { X.render(); } catch (e) { /* */ } }   // the board, as it is now
    if (X && X.vencRevisar) X.vencRevisar(false).catch(() => {});
  }
  // a board opened from the page: if it can't open (a photo upload running, a board gone), the page comes back as it was
  const falloDe = r => typeof r === 'string' ? r : r && r.error ? String(r.error) : null;
  function volver(f) {
    const X = I(), root = X.root(); st.on = true; ssSet(SS_CLI, null);
    root.classList.add('pp-on'); page.hidden = false; ultimo = ''; colocar(); pintar();
    X.toast('No se pudo abrir: ' + f);
  }
  async function abrirTablero(f) { let r; cerrar(); try { r = await f(); } catch (e) { r = String((e && e.message) || e); } const x = falloDe(r); if (x) volver(x); return !x; }
  async function abrirPost(key, slotId) {      // a notice: its board, with its post's window open
    const X = I();
    if (X.S && X.S.key === key) cerrar(); else if (!(await abrirTablero(() => M.open(key)))) return;
    if (slotId && I().S && I().S.slots.some(s => s.id === slotId)) I().openDetail(slotId, 0);
  }
  async function abrirCliente(cid, key) {      // a client's block: its board in the month seen (if it has one), else as a tab does
    const X = I();
    if (key) { if (X.S && X.S.key === key) cerrar(); else await abrirTablero(() => M.open(key)); return; }
    if (X.curClient === cid && X.S) cerrar(); else await abrirTablero(() => M.openClient(cid));
  }

  // ---------- tasks: saved at once, a step of their own ⌘Z (D-180) ----------
  const H = { u: [], r: [] };                  // steps: [{id, antes, despues}]
  const copia = r => r ? { ...r, ...(r.fotos ? { fotos: r.fotos.slice() } : {}), ...(r.subtareas ? { subtareas: r.subtareas.map(x => ({ ...x })) } : {}) } : null;
  async function escribir(cambios) {           // [{id, despues|null}]
    const X = I();
    gen++;
    for (const c of cambios) { TOCADA.set(c.id, gen); PEND.set(c.id, c.despues || null); if (c.despues) TK.set(c.id, c.despues); else { soltarFotos(TK.get(c.id)); TK.delete(c.id); } }
    try { for (const c of cambios) { if (c.despues) await X.idbPut('tareas', c.id, c.despues); else await X.idbDel('tareas', c.id); } }
    catch (e) { X.toast('No se pudo guardar la tarea: ' + ((e && e.message) || e)); }
    finally { for (const c of cambios) if (PEND.get(c.id) === (c.despues || null)) PEND.delete(c.id); }
    if (bc) { try { bc.postMessage({ t: 'tareas' }); } catch (e) { /* */ } }
  }
  function soltarFotos(r) { for (const f of (r && r.fotos) || []) { const u = MINI.get(f.id); if (u && ![...TK.values()].some(k => k !== r && (k.fotos || []).some(g => g.id === f.id))) { URL.revokeObjectURL(u); MINI.delete(f.id); } } }
  function puede() { const X = I(); return !!X && !X.locked; }
  async function hacer(cambios, junta) {       // cambios: [{id, despues}]; antes are taken here
    if (!puede() || !cambios.length) return false;
    const paso = cambios.map(c => ({ id: c.id, antes: copia(TK.get(c.id) || null), despues: c.despues ? copia(c.despues) : null }));
    const u = H.u[H.u.length - 1];
    if (junta && u && u.junta === junta && Date.now() - u.t < 2000) { paso.forEach(p => { const q = u.find(x => x.id === p.id); if (q) q.despues = p.despues; else u.push(p); }); u.t = Date.now(); }
    else { paso.junta = junta || null; paso.t = Date.now(); H.u.push(paso); if (H.u.length > 60) H.u.shift(); }
    H.r = [];
    await escribir(paso.map(p => ({ id: p.id, despues: p.despues })));
    return true;
  }
  async function deshacer(re) {
    if (!puede()) return false;
    const de = re ? H.r : H.u, a = re ? H.u : H.r, paso = de.pop(); if (!paso) return false;
    a.push(paso);
    await escribir(paso.map(p => ({ id: p.id, despues: copia(re ? p.despues : p.antes) })));
    pintar(); pintarCard(true); return true;
  }
  const ahoraISO = () => new Date(I().ahora()).toISOString();
  async function nuevaTarea(o = {}) {
    const txt = String(o.txt || '').trim(), tipo = o.tipo === 'nota' ? 'nota' : 'tarea';
    if (!txt && tipo === 'tarea') return null;
    const now = ahoraISO(), r = { id: nuevoId(tipo === 'nota' ? 'nt' : 'tk'), tipo, txt, creada: now, at: now };
    if (o.fecha && /^\d{4}-\d{2}-\d{2}$/.test(o.fecha) && tipo === 'tarea') r.fecha = o.fecha;
    if (o.cliente && cliDe(o.cliente)) r.cliente = o.cliente;
    if (Array.isArray(o.fotos) && o.fotos.length && tipo === 'tarea') r.fotos = o.fotos.slice();
    return (await hacer([{ id: r.id, despues: r }])) ? r : null;
  }
  const cambiar = (id, f, junta) => { const r = TK.get(id); if (!r) return Promise.resolve(false); const n = f(copia(r)); if (!n) return Promise.resolve(false); n.at = ahoraISO(); return hacer([{ id, despues: n }], junta); };
  const marcar = (id, v) => cambiar(id, r => { if (v) r.hecha = ahoraISO(); else delete r.hecha; return r; });
  const borrar = id => TK.has(id) ? hacer([{ id, despues: null }]) : Promise.resolve(false);

  // a photo dropped on a task or on «Nueva tarea»: lowered to a JPEG of 1600 px and a thumbnail, never to the tray
  async function rebajar(file) {
    const bm = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const lienzo = (px, q) => { const k = Math.min(1, px / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bm.width * k)); c.height = Math.max(1, Math.round(bm.height * k)); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return new Promise((res, rej) => c.toBlob(b => b ? res({ b, w: c.width, h: c.height }) : rej(new Error('sin imagen')), 'image/jpeg', q)); };
    try { const g = await lienzo(FOTO_PX, 0.85), m = await lienzo(MINI_PX, 0.8); return { id: nuevoId('tf'), w: g.w, h: g.h, blob: g.b, mini: m.b }; }
    finally { if (bm.close) bm.close(); }
  }
  const esImagen = f => /^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name || '');
  function verFoto(id, i0 = 0) {               // the photo big, in the mesa's dialog (Esc, the × or a click outside close it)
    const X = I(), r = TK.get(id); if (!r || !(r.fotos || []).length) return;
    let i = Math.max(0, Math.min(r.fotos.length - 1, +i0 || 0)); const f = r.fotos[i];
    const u = URL.createObjectURL(f.blob);
    X.showDialog('pp-foto', `<button class="x" data-act="close" aria-label="Cerrar">×</button><div class="tvwrap"><img class="tvimg" src="${u}" alt=""></div><div class="tvbar"><span class="tvname"><b>${esc(r.txt)}</b> · ${f.w}×${f.h}${r.fotos.length > 1 ? ` · ${i + 1} de ${r.fotos.length}` : ''}</span></div>`);
    const det = X.root().querySelector('.detail'); det.dataset.ppFoto = id;
    const ir = n => { i = (i + n + r.fotos.length) % r.fotos.length; const g = r.fotos[i], img = det.querySelector('.tvimg'), nm = det.querySelector('.tvname'); if (!img) return; URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(g.blob); if (nm) nm.innerHTML = `<b>${esc(r.txt)}</b> · ${g.w}×${g.h} · ${i + 1} de ${r.fotos.length}`; };
    const mo = new MutationObserver(() => { if (det.hidden || det.dataset.dlg !== 'pp-foto') { mo.disconnect(); const img = det.querySelector('.tvimg'); if (img) URL.revokeObjectURL(img.src); URL.revokeObjectURL(u); } });
    mo.observe(det, { attributes: true, attributeFilter: ['hidden', 'data-dlg'] });
    if (r.fotos.length > 1) det.querySelector('.tvwrap').insertAdjacentHTML('beforeend', `<button class="nav prev" data-pp="fnav" data-d="-1" aria-label="Foto anterior">‹</button><button class="nav next" data-pp="fnav" data-d="1" aria-label="Foto siguiente">›</button>`);
    det._ppIr = ir;
  }

  // ---------- a task or a note big (D-182): a click opens it to read, a double click writes in it ----------
  // One card over the page, in the mesa's root (the photo's dialog and the controls' menus go above it). Reading: another click
  // or Esc closes it (a click on it waits what a double click lasts, a click outside closes at once). Writing: what is written
  // goes in on its own; a click outside or Esc goes back to reading. The checkbox and the photos work as in small (D-180).
  const DBL = 300;                             // what a double click lasts
  let CARD = null, ov = null;                  // {id, ed, peq, t0, cierre, de, pd}
  const enCard = el => !!(ov && el && el.nodeType === 1 && ov.contains(el));
  const pocoMov = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fechaLarga = d => `${DS[dow(d)]} ${+d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]}${d.slice(0, 4) !== I().hoy().slice(0, 4) ? ' ' + d.slice(0, 4) : ''}`;
  function htmlCard(r, ed) {
    const X = I(), ce = ed ? ' contenteditable="plaintext-only" spellcheck="true" role="textbox"' : '';
    if (r.tipo === 'nota') return `<div class="pp-card nota${ed ? ' ed' : ''}" role="dialog" aria-modal="true" aria-label="Nota" tabindex="-1"><p class="pp-cn" data-pp="cn" data-id="${esc(r.id)}"${ce}${ed ? ' aria-multiline="true" aria-label="Nota"' : ''}>${esc(r.txt)}</p></div>`;
    const venc = !r.hecha && r.fecha && r.fecha < X.hoy(), c = r.cliente ? cliDe(r.cliente) : null;
    const fecha = ed ? `<span class="pp-cmf"><input type="date" class="pp-cfecha" data-sin-fecha data-id="${esc(r.id)}" value="${esc(r.fecha || '')}" aria-label="Fecha de la tarea"></span>`
      : r.fecha ? `<span class="${venc ? 'rojo' : ''}">${ICO.fecha}${esc(fechaLarga(r.fecha))}</span>` : '';
    const cli = ed ? `<span class="pp-cmf">${ICO.cliente}<select class="pp-ccli" data-id="${esc(r.id)}" aria-label="Cliente de la tarea"><option value="">Sin cliente</option>${((D && D.CL) || X.CL).map(x => `<option value="${esc(x.id)}"${r.cliente === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></span>`
      : c ? `<span>${avatar(c.id, 'xs')}${esc(c.name)}</span>` : '';
    const fotos = (r.fotos || []).length ? `<div class="pp-cfo">${r.fotos.map((f, i) => `<button type="button" class="pp-tfo" data-pp="foto" data-id="${esc(r.id)}" data-i="${i}" title="Ver la foto" aria-label="Ver la foto"><img src="${fotosURL(f)}" alt=""></button>`).join('')}</div>` : '';
    return `<div class="pp-card${ed ? ' ed' : ''}${r.hecha ? ' hecha' : ''}" role="dialog" aria-modal="true" aria-label="Tarea" tabindex="-1">`
      + `<div class="pp-ch"><input type="checkbox" class="pp-ck" data-pp="ck" data-id="${esc(r.id)}"${r.hecha ? ' checked' : ''} aria-label="Hecha"><p class="pp-ct" data-pp="ct" data-id="${esc(r.id)}"${ce}${ed ? ' aria-label="Tarea"' : ''}>${esc(r.txt)}</p></div>`
      + (fecha || cli ? `<div class="pp-cm">${fecha}${cli}</div>` : '') + fotos + detSub(r, ed) + `</div>`;
  }
  // its details and its subtasks (D-183): the details, one field that takes no room in small when empty; the subtasks, each with
  // its checkbox (also while reading), a thin bar with how many are done, «+ Subtarea» to add one
  const filaSub = (rid, x, ed) => `<div class="pp-csub${x.hecha ? ' hecha' : ''}" data-sid="${esc(x.id)}"><input type="checkbox" class="pp-ck" data-pp="csck" data-id="${esc(rid)}" data-sid="${esc(x.id)}"${x.hecha ? ' checked' : ''} aria-label="Hecha">`
    + (ed ? `<input type="text" class="pp-cst" data-pp="cst" data-id="${esc(rid)}" data-sid="${esc(x.id)}" value="${esc(x.txt)}" aria-label="Subtarea" autocomplete="off" spellcheck="true"><button type="button" class="pp-csx" data-pp="csx" title="Quitar" aria-label="Quitar la subtarea">${ICO.x}</button>` : `<span>${esc(x.txt)}</span>`) + `</div>`;
  function detSub(r, ed) {
    const dt = String(r.detalles || ''), subs = r.subtareas || [], n = subs.length, h = subs.filter(x => x.hecha).length;
    const det = ed ? `<div class="pp-cd" data-pp="cd" data-id="${esc(r.id)}" contenteditable="plaintext-only" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Detalles" data-ph="Detalles">${esc(dt)}</div>`
      : `<div class="pp-cd${dt.trim() ? '' : ' vacio'}">${dt.trim() ? esc(dt) : 'Detalles'}</div>`;
    return det + `<div class="pp-cs">${n ? `<div class="pp-csh">${barraPg(h, n)}<span>${h}/${n}</span></div>` : ''}<div class="pp-csl">${subs.map(x => filaSub(r.id, x, ed)).join('')}</div>`
      + `<button type="button" class="pp-cmas" data-pp="cmas">${ICO.mas}Subtarea</button></div>`;
  }
  function barraEd() {                         // writing: the bar as the rows are (an empty new one doesn't count yet)
    const cs = ov && ov.querySelector('.pp-cs'); if (!cs) return;
    const fs = [...cs.querySelectorAll('.pp-csub')].filter(f => !f.dataset.nueva || f.querySelector('.pp-cst').value.trim());
    const n = fs.length, h = fs.filter(f => f.querySelector('.pp-ck').checked).length; let hd = cs.querySelector('.pp-csh');
    if (!n) { if (hd) hd.remove(); return; }
    if (!hd) { hd = document.createElement('div'); hd.className = 'pp-csh'; cs.prepend(hd); }
    hd.innerHTML = `${barraPg(h, n)}<span>${h}/${n}</span>`;
  }
  function nuevaSub(tras) {                    // a new subtask, being written: it goes in once something is written in it
    if (!CARD) return;
    if (!CARD.ed) editar(true);
    const l = ov && ov.querySelector('.pp-csl'); if (!l) return;
    const d = document.createElement('div'); d.innerHTML = filaSub(CARD.id, { id: 'nueva', txt: '' }, true);
    const f = d.firstChild; f.dataset.nueva = '1';
    if (tras) tras.after(f); else l.append(f);
    f.querySelector('.pp-cst').focus();
  }
  function quitarSub(f, foco) {
    if (!f || !CARD) return;
    const p = f.previousElementSibling, n = f.nextElementSibling; f.remove(); guardarCard(false); barraEd();
    const g = foco === 'antes' ? p : (n || p), i = g && g.querySelector('.pp-cst');
    if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } else { const d = ov.querySelector(foco === 'antes' ? '[data-pp="cd"]' : '[data-pp="cmas"]'); if (d) d.focus(); }
  }
  function pintarCard(forzar) {                // the card as the record is now; while writing, only when forced
    if (!CARD || !ov) return;
    const r = TK.get(CARD.id); if (!r) { cerrarCard(true); return; }
    if (CARD.ed && !forzar) { CARD.pend = true; return; }
    CARD.pend = false;
    const enfocada = enCard(document.activeElement);
    ov.innerHTML = htmlCard(r, CARD.ed);
    if (M.controles && M.controles.mejorar) M.controles.mejorar(ov);
    if (enfocada && !CARD.ed) ov.firstChild.focus({ preventScroll: true });
  }
  function abrirCard(id, o = {}) {
    const r = TK.get(id), X = I(); if (!r || !st.on) return false;
    cerrarMenu(); if (CARD) quitarCard();
    ov = document.createElement('div'); ov.className = 'pp-ov entra'; ov.dataset.pp = 'ov';
    ov.addEventListener('animationend', e => { if (e.target.classList.contains('pp-card')) e.currentTarget.classList.remove('entra'); });
    X.root().append(ov);
    CARD = { id, ed: !!o.ed, peq: !o.ed, t0: Date.now(), cierre: 0, de: `[data-pp="tver"][data-id="${CSS.escape(id)}"]` };
    setTimeout(() => { if (CARD && CARD.id === id) CARD.peq = false; }, 600);   // the second click of the double click that opened it
    ov.innerHTML = htmlCard(r, CARD.ed);
    if (M.controles && M.controles.mejorar) M.controles.mejorar(ov);
    if (CARD.ed) enfocar(null); else ov.firstChild.focus({ preventScroll: true });
    return true;
  }
  function quitarCard() { if (!ov) return; clearTimeout(CARD && CARD.cierre); ov.remove(); CARD = null; ov = null; }
  function cerrarCard(ya) {
    if (!CARD) return;
    clearTimeout(CARD.cierre);
    if (CARD.ed && !ya) { guardarCard(); if (!CARD) return; }   // what was written goes in first (an empty note has gone with its card)
    const o = ov, de = CARD.de; CARD = null; ov = null;
    if (ya || pocoMov()) o.remove(); else { o.classList.add('sale'); setTimeout(() => o.remove(), 130); }
    const b = de && page && page.querySelector(de); if (b) b.focus({ preventScroll: true });
    retomar();
  }
  // the caret where the double click was (on the title, the note or a field), else at the end of the title or the note
  function enfocar(pt) {
    if (!ov) return;
    const campos = [...ov.querySelectorAll('[contenteditable], .pp-card input[type="text"], .pp-card textarea')];
    let rg = null;
    if (pt && document.caretRangeFromPoint) { rg = document.caretRangeFromPoint(pt.x, pt.y); if (rg && !campos.some(f => f.contains(rg.startContainer))) rg = null; }
    const f = rg ? campos.find(x => x.contains(rg.startContainer)) : campos[0]; if (!f) return;
    f.focus({ preventScroll: true });
    if (f.isContentEditable) {
      const sel = getSelection(); if (!rg) { rg = document.createRange(); rg.selectNodeContents(f); rg.collapse(false); }
      sel.removeAllRanges(); sel.addRange(rg);
    }
  }
  function editar(on, pt) {
    if (!CARD || CARD.ed === on) return;
    if (!on) { guardarCard(); if (!CARD) return; }
    CARD.ed = on; clearTimeout(CARD.cierre);
    pintarCard(true);
    if (on) enfocar(pt); else if (ov) ov.firstChild.focus({ preventScroll: true });
  }
  // what is written in the card: the title (never empty: an empty one goes back) and a note (empty, it goes, and one never
  // written leaves no step of ⌘Z)
  let cardT = null;
  function guardarCard(fin = true) {           // fin: writing ends (the blank subtasks go, the details are trimmed)
    clearTimeout(cardT); cardT = null;
    if (!CARD || !ov) return;
    const id = CARD.id, r = TK.get(id); if (!r) return;
    const t = ov.querySelector('[data-pp="ct"], [data-pp="cn"]'); if (!t) return;
    const txt = r.tipo === 'nota' ? t.textContent : t.textContent.replace(/\s*\n\s*/g, ' ').trim();
    if (r.tipo !== 'nota') {
      const cd = ov.querySelector('[data-pp="cd"]'), ed = !!ov.querySelector('.pp-cst, [data-pp="cd"]');
      let det = cd ? cd.textContent : String(r.detalles || ''); if (fin) det = det.replace(/^\s*\n|\s+$/g, '');
      let subs = ed ? [...ov.querySelectorAll('.pp-csub')].map(f => {
        const i = f.querySelector('.pp-cst'), c = f.querySelector('.pp-ck'); if (!i) return null;
        if (f.dataset.nueva) { if (!i.value.trim()) return null; const sid = nuevoId('st'); delete f.dataset.nueva; f.dataset.sid = sid; f.querySelectorAll('[data-sid]').forEach(x => { x.dataset.sid = sid; }); }
        const o = { id: f.dataset.sid, txt: fin ? i.value.trim() : i.value }; if (c.checked) o.hecha = true; return o;
      }).filter(Boolean) : (r.subtareas || []).map(x => ({ ...x }));
      if (fin) subs = subs.filter(x => x.txt);
      const n = { txt: txt || r.txt, detalles: det, subtareas: subs }, a = { txt: r.txt, detalles: String(r.detalles || ''), subtareas: r.subtareas || [] };
      if (JSON.stringify(n) !== JSON.stringify(a)) cambiar(id, x => { x.txt = n.txt; if (det) x.detalles = det; else delete x.detalles; if (subs.length) x.subtareas = subs; else delete x.subtareas; return x; }, 'card:' + id).then(() => pintar());
      return;
    }
    if (!txt.trim()) {
      if (!fin) return;
      const u = H.u[H.u.length - 1];
      if (u && u.length === 1 && u[0].id === id && !u[0].antes && !String((u[0].despues || {}).txt || '').trim() && puede()) { H.u.pop(); escribir([{ id, despues: null }]).then(() => pintar()); }
      else hacer([{ id, despues: null }], 'card:' + id).then(() => pintar());
      quitarCard(); retomar(); return;
    }
    if (txt !== r.txt) cambiar(id, x => { x.txt = txt; return x; }, 'card:' + id).then(() => pintar());
  }

  // ---------- the right-click menu of a task or a note (the mesa's menu, .cpmenu) ----------
  let menu = null;
  function cerrarMenu() { if (!menu) return; const m = menu; menu = null; m.el.remove(); retomar(); document.removeEventListener('pointerdown', m.fuera, true); document.removeEventListener('keydown', m.tecla, true); window.removeEventListener('blur', cerrarMenu); window.removeEventListener('resize', cerrarMenu); }
  function abrirMenu(x, y, items) {
    cerrarMenu();
    const root = I().root(), el = document.createElement('div'); el.className = 'cpmenu pp-menu'; el.setAttribute('role', 'menu');
    el.innerHTML = items.map(([a, t]) => `<button type="button" role="menuitem" data-a="${a}">${t}</button>`).join('');
    el.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b) return; const it = items.find(i => i[0] === b.dataset.a); cerrarMenu(); if (it) it[2](); });
    root.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`; el.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    const m = menu = { el, fuera: e => { if (!el.contains(e.target)) cerrarMenu(); }, tecla: e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarMenu(); } } };
    document.addEventListener('pointerdown', m.fuera, true); document.addEventListener('keydown', m.tecla, true);
    window.addEventListener('blur', cerrarMenu); window.addEventListener('resize', cerrarMenu);
    const b0 = el.querySelector('button'); if (b0) b0.focus();
  }

  // ---------- events ----------
  function camposNueva() {                     // what is chosen stays in the field, its icon goes; nothing chosen, the icon again
    const N = st.nueva;
    for (const [k, v, b] of [['fecha', N.fecha, 'nfecha'], ['cliente', N.cliente, 'ncli']]) {
      const w = page.querySelector(`.pp-ncampo[data-k="${k}"]`), i = page.querySelector(`[data-pp="${b}"]`);
      if (w) w.classList.toggle('vacio', !v); if (i) i.classList.toggle('puesta', !!v);
    }
    setTimeout(() => { const n = page && page.querySelector('[data-pp="nueva"]'); if (n && !(M.controles && M.controles.abierto && M.controles.abierto())) n.focus({ preventScroll: true }); }, 0);
  }
  function abrirCampo(k) {                     // «Fecha» or «Cliente» of «Nueva tarea»: the mesa's own control, open
    const w = page.querySelector(`.pp-ncampo[data-k="${k}"]`); if (!w) return;
    w.classList.remove('vacio');
    const nat = w.querySelector('input, select'), g = M.controles && M.controles.gemelo && M.controles.gemelo(nat);
    const tgt = g ? (g.querySelector('input') || g) : nat;
    if (tgt) { tgt.focus(); tgt.click(); }
  }
  async function crearDesdeCampo(comoNota) {
    const inp = page.querySelector('[data-pp="nueva"]'), txt = inp ? inp.value.trim() : '', N = st.nueva;
    const cliente = st.tcli || N.cliente || '';
    if (comoNota) {
      const r = await nuevaTarea({ tipo: 'nota', txt, cliente }); if (!r) return;
      if (inp) inp.value = '';
      if (st.vista !== 'lista') { st.vista = 'lista'; lsSet(LS_VISTA, 'lista'); }
      pintar();
      if (!txt) abrirCard(r.id, { ed: true });   // a blank note opens big, writing (D-182)
      return;
    }
    if (!txt) return;
    const r = await nuevaTarea({ txt, fecha: N.fecha, cliente, fotos: N.fotos }); if (!r) return;
    st.nueva = { fecha: '', cliente: '', fotos: [] };
    if (inp) inp.value = '';
    pintar();
    const n = page.querySelector('[data-pp="nueva"]'); if (n) n.focus();
  }
  function alClic(e) {
    const X = I(); if (!X || !X.root) return;
    const root = X.root(); if (!root || !root.contains(e.target)) return;
    if (st.on && e.target.closest('.tabs [data-act="client"], .tab.add')) { if (e.target.closest('[data-act="client"]') && e.target.closest('[data-act="client"]').dataset.id === X.curClient) cerrar(); return; }   // another client: its tab opens it (and M.openClient closes the page)
    if (CARD && enCard(e.target)) { clicCard(e); return; }
    // a task or a note in small: a click opens it big (D-182); its checkbox and its photo, as before
    const it = st.on && page && page.contains(e.target) && !e.target.closest('.pp-ck, [data-pp="foto"]') && e.target.closest('[data-tid]:not([data-tid="nueva"]), [data-nid]');
    if (it && TK.has(it.dataset.tid || it.dataset.nid)) { abrirCard(it.dataset.tid || it.dataset.nid); return; }
    const a = e.target.closest('[data-pp]'); if (!a) return;
    const k = a.dataset.pp;
    if (k === 'logo') { if (!root.classList.contains('client')) { if (st.on) page.scrollTop = 0; else abrir(); } return; }
    if (!st.on || (!page.contains(a) && k !== 'fnav')) return;
    if (k === 'fnav') { const det = root.querySelector('.detail'); if (det._ppIr) det._ppIr(+a.dataset.d); return; }
    if (k === 'filtro') { st.filtro = st.filtro === a.dataset.k ? null : a.dataset.k; if (st.filtro && st.plg.avisos) st.plg.avisos = false; pintar(); return; }
    if (k === 'modo') { if (st.modo !== a.dataset.m) { st.modo = a.dataset.m; st.desp = 0; pintar(); refrescar(); } return; }
    if (k === 'desp') { st.desp += +a.dataset.d; pintar(); refrescar(); return; }
    if (k === 'mas') { st.abiertos.add(a.dataset.c); pintar(); return; }
    if (k === 'plegar') { st.plg[a.dataset.p] = !st.plg[a.dataset.p]; pintar(); const b = page.querySelector(`[data-pp="plegar"][data-p="${a.dataset.p}"]`); if (b) b.focus({ preventScroll: true }); return; }
    if (k === 'fila') { st.fila = +a.dataset.n; lsSet(LS_FILA, String(st.fila)); pintar(); return; }
    if (k === 'tvista') { st.vista = a.dataset.v; lsSet(LS_VISTA, st.vista); pintar(); return; }
    if (k === 'alcance') { st.alcance = a.dataset.r; lsSet(LS_ALC, st.alcance); pintar(); return; }
    if (k === 'tnav') { if (st.vista === 'semana') st.tsem += +a.dataset.d; else st.tmes += +a.dataset.d; pintar(); return; }
    if (k === 'tcli') { st.tcli = a.dataset.c || null; pintar(); return; }
    if (k === 'nota-campo') { crearDesdeCampo(true); return; }
    if (k === 'nfecha') { abrirCampo('fecha'); return; }
    if (k === 'ncli') { abrirCampo('cliente'); return; }
    if (k === 'foto') { verFoto(a.dataset.id, a.dataset.i); return; }
    if (k === 'cliente') { abrirCliente(a.dataset.c, a.dataset.key); return; }
    if (k === 'abrir') { abrirPost(a.dataset.key, a.dataset.slot); return; }
    if (k === 'hs') { (async () => { const key = a.dataset.key; if (X.S && X.S.key === key) cerrar(); else if (!(await abrirTablero(() => M.open(key)))) return; if (M.hs && M.hs.ver) M.hs.ver(true); })(); return; }
  }
  // a click on the card: its checkbox and photos work; outside it closes at once (writing, it goes back to reading); on it, it
  // waits what a double click lasts; the second click of a double click never closes it
  function clicCard(e) {
    const t = e.target, c = ov.firstChild;
    if (CARD.pd) { CARD.pd = false; return; }   // the click that closed one of the mesa's menus or calendars
    const a = t.closest('[data-pp]'), k = a && a.dataset.pp;
    if (k === 'foto') { verFoto(a.dataset.id, a.dataset.i); return; }
    if (k === 'cmas') { nuevaSub(); return; }
    if (k === 'csx') { quitarSub(a.closest('.pp-csub')); return; }
    if (t.closest('.pp-ck, input, select, button, [contenteditable="plaintext-only"], .mx-sel, .mx-f')) return;
    if (e.detail >= 2) { clearTimeout(CARD.cierre); return; }
    CARD.peq = false;
    const fuera = !c.contains(t);
    if (CARD.ed) { if (fuera) editar(false); return; }
    if (fuera) { cerrarCard(); return; }
    clearTimeout(CARD.cierre); CARD.cierre = setTimeout(() => { if (CARD && !CARD.ed) cerrarCard(); }, DBL);
  }
  function alDobleClic(e) {
    if (CARD && enCard(e.target)) {            // writing, where it was double clicked (the double click that opened it: at the end)
      clearTimeout(CARD.cierre);
      if (!CARD.ed && !e.target.closest('.pp-ck, [data-pp="foto"]')) editar(true, CARD.peq ? null : { x: e.clientX, y: e.clientY });
      return;
    }
    if (!st.on || !page || !page.contains(e.target)) return;
    if (e.target.closest('[data-pp="rango"]')) { st.desp = 0; pintar(); refrescar(); }
    else if (e.target.closest('[data-pp="trango"]')) { if (st.vista === 'semana') st.tsem = 0; else st.tmes = 0; pintar(); }
  }
  function alCambiar(e) {
    if (!st.on || !page || !(page.contains(e.target) || enCard(e.target))) return;
    const t = e.target;
    // the card's date and client (D-182): saved at once, the card stays as it is (its control is finishing its gesture)
    if (t.matches('.pp-cfecha')) { const v = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : ''; cambiar(t.dataset.id, x => { if (v) x.fecha = v; else delete x.fecha; return x; }).then(() => pintar()); return; }
    if (t.matches('.pp-ccli')) { const v = t.value && cliDe(t.value) ? t.value : ''; cambiar(t.dataset.id, x => { if (v) x.cliente = v; else delete x.cliente; return x; }).then(() => pintar()); return; }
    if (t.matches('[data-pp="ttodas"]')) { st.ttodas = t.checked; pintar(); return; }
    if (t.matches('[data-pp="avtareas"]')) { st.avTareas = t.checked; pintar(); return; }
    // «Fecha» and «Cliente» of «Nueva tarea»: only the field changes (the mesa's control is still finishing its gesture)
    if (t.matches('.pp-nfecha')) { st.nueva.fecha = t.value || ''; camposNueva(); return; }
    if (t.matches('.pp-ncli')) { st.nueva.cliente = t.value || ''; camposNueva(); return; }
    if (t.matches('[data-pp="ck"]')) { marcar(t.dataset.id, t.checked).then(() => pintar()); return; }
    if (t.matches('[data-pp="csck"]')) {       // a subtask (D-183): marking them all doesn't mark the task
      const f = t.closest('.pp-csub'); if (f) f.classList.toggle('hecha', t.checked);
      if (CARD && CARD.ed) { barraEd(); guardarCard(false); return; }
      const sid = t.dataset.sid; cambiar(t.dataset.id, x => { const y = (x.subtareas || []).find(z => z.id === sid); if (!y) return null; if (t.checked) y.hecha = true; else delete y.hecha; return x; });
      pintar();                                // the record changed already: the bar now, not after the write
    }
  }
  function alTeclear(e) {
    if (!st.on || !page) return;
    const t = e.target;
    if (CARD) {                                // the card: Esc goes back to reading or closes; Enter on it writes (D-182)
      const det = I().root().querySelector('.detail'), ctl = M.controles && M.controles.abierto && M.controles.abierto();
      if (e.key === 'Escape' && !ctl && !(det && !det.hidden) && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); if (CARD.ed) editar(false); else cerrarCard(); return; }
      if (e.key === 'Enter' && !CARD.ed && t === ov.firstChild) { e.preventDefault(); editar(true); return; }
      if (e.key === 'Enter' && t.matches && t.matches('[data-pp="ct"]') && !e.isComposing) {   // the title is one line: Enter goes to the details
        e.preventDefault(); const d = ov.querySelector('[data-pp="cd"]'); if (d) { d.focus(); const g = getSelection(), rg = document.createRange(); rg.selectNodeContents(d); rg.collapse(false); g.removeAllRanges(); g.addRange(rg); } return;
      }
      if (t.matches && t.matches('[data-pp="cst"]') && !e.isComposing && !e.metaKey && !e.ctrlKey) {
        if (e.key === 'Enter') { e.preventDefault(); if (t.value.trim()) nuevaSub(t.closest('.pp-csub')); return; }
        if (e.key === 'Backspace' && !t.value) { e.preventDefault(); quitarSub(t.closest('.pp-csub'), 'antes'); return; }
      }
    }
    // ⌘Z / ⇧⌘Z: the tasks' own, never the hidden board's; a text being written undoes its own typing
    if ((e.metaKey || e.ctrlKey) && !e.altKey && String(e.key).toLowerCase() === 'z') {
      const det = I().root().querySelector('.detail');
      if ((t && (t.isContentEditable || (t.tagName === 'INPUT' && /^(text|search|)$/.test(t.type || '')) || t.tagName === 'TEXTAREA')) || (det && !det.hidden)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      deshacer(e.shiftKey); return;
    }
    if (!page.contains(t)) return;
    if (t.matches('[data-pp="nueva"]') && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); crearDesdeCampo(false); return; }
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[data-pp="tver"]')) { e.preventDefault(); abrirCard(t.dataset.id); return; }
  }
  function alEscribir(e) {                     // what is written in the card goes in after a pause (D-182, D-183)
    const p = e.target.closest && e.target.closest('[data-pp="ct"], [data-pp="cn"], [data-pp="cd"], [data-pp="cst"]'); if (!p || !st.on || !CARD || !enCard(p)) return;
    if (p.dataset.pp === 'cst') barraEd();
    clearTimeout(cardT); cardT = setTimeout(() => guardarCard(false), 400);
  }
  function alMenu(e) {
    if (!st.on || !page || !page.contains(e.target)) return;
    const t = e.target.closest('[data-tid]:not([data-tid="nueva"])'), n = e.target.closest('[data-nid]');
    if (n) { e.preventDefault(); const id = n.dataset.nid; abrirMenu(e.clientX, e.clientY, [['borrar', 'Borrar nota', async () => { await borrar(id); pintar(); }]]); return; }
    if (!t || !TK.has(t.dataset.tid)) return;
    e.preventDefault();
    const id = t.dataset.tid, r = TK.get(id), l = [];
    if ((r.fotos || []).length) l.push(['sinfotos', r.fotos.length === 1 ? 'Quitar la foto' : 'Quitar las fotos', async () => { await cambiar(id, x => { delete x.fotos; return x; }); pintar(); }]);
    l.push(['borrar', 'Borrar tarea', async () => { await borrar(id); pintar(); }]);
    abrirMenu(e.clientX, e.clientY, l);
  }
  // files over the page: only a task or «Nueva tarea» takes them; nothing reaches the hidden board's tray
  const conArchivos = e => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files');
  let sobre = null;
  const marcarSobre = el => { if (sobre && sobre !== el) sobre.classList.remove('pp-drop'); sobre = el; if (el) el.classList.add('pp-drop'); };
  const destino = e => { const t = e.target.closest && e.target.closest('[data-tid]'); return t && (t.dataset.tid === 'nueva' || TK.has(t.dataset.tid)) ? t : null; };
  function alArrastrar(e) {                    // capture on the mesa: with the page open, files only go to the page's targets
    if (!st.on || !conArchivos(e)) return;
    const dentro = page && page.contains(e.target);
    if (e.type === 'dragleave') { if (!dentro || !page.contains(e.relatedTarget)) marcarSobre(null); return; }
    e.preventDefault(); e.stopPropagation();
    const t = dentro ? destino(e) : null;
    if (e.type === 'dragover' || e.type === 'dragenter') { e.dataTransfer.dropEffect = t ? 'copy' : 'none'; marcarSobre(t); return; }
    marcarSobre(null);
    if (e.type !== 'drop' || !t || !puede()) return;
    const fs = [...e.dataTransfer.files].filter(esImagen); if (!fs.length) return;
    (async () => {
      const got = []; for (const f of fs) { try { got.push(await rebajar(f)); } catch (err) { /* one that can't be read doesn't go in */ } }
      if (!got.length) return;
      if (t.dataset.tid === 'nueva') { st.nueva.fotos = st.nueva.fotos.concat(got); pintar(); const n = page.querySelector('[data-pp="nueva"]'); if (n) n.focus(); return; }
      await cambiar(t.dataset.tid, x => { x.fotos = (x.fotos || []).concat(got); return x; });
      pintar();
    })();
  }

  // ---------- mounting ----------
  function montar() {
    if (montada) return; montada = true;
    const X = I();
    X.estilo('mesa-pp-css', ESTILO);
    colocar();
    const root = X.root();
    on(document, 'click', alClic, true);
    on(document, 'dblclick', alDobleClic);
    on(document, 'change', alCambiar);
    on(window, 'keydown', alTeclear, true);
    on(document, 'input', alEscribir);
    on(document, 'compositionstart', e => { if (page && page.contains(e.target)) componiendo = true; });
    on(document, 'compositionend', () => { componiendo = false; retomar(); });
    for (const ty of ['pointerup', 'keyup', 'focusout']) on(document, ty, retomar, true);
    on(document, 'contextmenu', alMenu, true);
    on(window, 'pointerdown', e => { if (CARD) CARD.pd = enCard(e.target) && !!(M.controles && M.controles.abierto && M.controles.abierto()); }, true);
    for (const ty of ['dragenter', 'dragover', 'dragleave', 'drop']) on(document, ty, alArrastrar, true);
    // the shell is built again (a reload of the code) or «Vista cliente» changes: the logo follows
    const mo = new MutationObserver(() => { const r = I() && I().root && I().root(); if (r && r !== root) return; colocar(); });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    EV.push([{ removeEventListener: () => mo.disconnect() }, 'mo', null]);
    // up to date on its own: every minute (D-120's sweep), on coming back to the tab and with another tab's tasks
    tic = setInterval(() => { if (st.on && document.visibilityState === 'visible') refrescar(); }, 60000);
    on(document, 'visibilitychange', () => { if (st.on && document.visibilityState === 'visible') refrescar(); });
    let rT = 0; on(window, 'resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (st.on && !ocupada()) pintar(); }, 120); });   // fewer clients a row when they don't fit
    try { bc = new BroadcastChannel('mesa-personal'); bc.onmessage = e => { if (e.data && e.data.t === 'tareas' && st.on) refrescar(); }; } catch (e) { bc = null; }
    // «Usar aquí» opens the board again: with the page open, it stays, with what the other tab saved
    on(document, 'click', e => { if (st.on && e.target.closest && e.target.closest('[data-act="takeover"]')) retomando = Date.now(); }, true);
    // opening a board (a tab, the skill through window.MESA, the battery) leaves the page; an import or «Usar aquí» don't
    for (const k of ['open', 'openClient', 'init']) {
      const f = M[k]; if (typeof f !== 'function' || f._pp) continue;
      const g = function (...a) {
        if (retomando && Date.now() - retomando < 10000) { retomando = false; quedarse++; const p = f.apply(this, a); Promise.resolve(p).catch(() => {}).finally(() => { quedarse--; if (st.on) refrescar(); }); return p; }
        if (st.on && !quedarse) cerrar();
        return f.apply(this, a);
      };
      g._pp = f; M[k] = g;
    }
    retomando = false;
    if (typeof M.importData === 'function' && !M.importData._pp) {
      const f = M.importData, g = async function (...a) { quedarse++; try { return await f.apply(this, a); } finally { quedarse--; if (st.on) refrescar(); } };
      g._pp = f; M.importData = g;
    }
    // the mesa starts on the page: not in «Vista cliente» nor after a reload inside a client (this tab's session)
    if (!root.classList.contains('client') && ssGet(SS_CLI) !== '1') abrir();
  }
  M.personal = {
    version: VERSION, abrir, cerrar, abierta: () => st.on, render: refrescar,
    datos: async () => { const d = await leer(); return calcular(d); },
    tareas: async () => { await leer(); return [...TK.values()].map(copia); },
    tarea: o => nuevaTarea(o), hecha: (id, v = true) => marcar(id, v), borrar, deshacer: () => deshacer(false), rehacer: () => deshacer(true),
    estado: () => ({ ...st, abiertos: [...st.abiertos], plg: { ...st.plg }, nueva: { ...st.nueva, fotos: st.nueva.fotos.length } }),
    set: o => { Object.assign(st, o); pintar(); return refrescar(); },
    _test: { rebajar, H: () => ({ u: H.u.length, r: H.r.length }), olvidar: () => { H.u = []; H.r = []; } },
    _off: () => {
      clearInterval(tic); cerrarMenu(); quitarCard(); EV.forEach(([t, ty, f, o]) => t.removeEventListener(ty, f, o)); EV.length = 0;
      if (bc) { try { bc.close(); } catch (e) { /* */ } }
      for (const k of ['open', 'openClient', 'init', 'importData']) if (M[k] && M[k]._pp) M[k] = M[k]._pp;
      MINI.forEach(u => URL.revokeObjectURL(u)); MINI.clear();
    }
  };

  // ---------- style: only the mesa's tokens (D-131), its icons and stroke (D-168), its scale and weights (D-172) ----------
  const ESTILO = `
#mesa .brand.pp-logo{align-self:stretch;border:0;border-bottom:2px solid transparent;background:none;color:var(--ink);margin:0 11px 0 -7px;padding:2px 7px 0;font:inherit;cursor:pointer;transition:border-color var(--d1) var(--ease)}
#mesa .brand.pp-logo svg{transition:transform var(--d1) var(--ease)}
#mesa .brand.pp-logo:hover{border-bottom-color:var(--line-strong)}#mesa.pp-on .brand.pp-logo,#mesa.pp-on .brand.pp-logo:hover{border-bottom-color:var(--acc)}
#mesa .brand.pp-logo:active svg{transform:scale(.97)}
#mesa .brand.pp-logo:focus-visible{outline:2px solid var(--focus);outline-offset:-2px;border-radius:var(--r-xs)}
#mesa.client .brand.pp-logo{cursor:default;pointer-events:none;border-bottom-color:transparent}
#mesa.pp-on .tabs .tab.on{color:var(--mute);font-weight:400;border-bottom-color:transparent}
#mesa.pp-on .tabs .tedit{display:none}
#mesa:not(.pp-on) .appbar .tema{display:none}
#mesa.pp-on > :is(.bar,.main){display:none}
#mesa .pp{flex:1;min-height:0;overflow:auto;background:var(--bg);padding:6px 20px 32px;scrollbar-gutter:stable;
  --pp-f:color-mix(in oklab,var(--ty-foto-ink) 58%,var(--ty-foto));--pp-c:color-mix(in oklab,var(--ty-carr-ink) 58%,var(--ty-carr));--pp-r:color-mix(in oklab,var(--ty-reel-ink) 58%,var(--ty-reel));--pp-st:var(--ink);--pp-tx:var(--ink)}
#mesa .pp[hidden]{display:none}
#mesa .pp svg{stroke-width:var(--i-trazo)}#mesa .pp svg :is(path,rect,circle,line){vector-effect:non-scaling-stroke}
#mesa .pp :is(h2,h3,p){margin:0}#mesa .pp :is(h2,h3){text-wrap-style:balance}#mesa .pp p{text-wrap-style:pretty}
#mesa .pp :is(.pp-cifra,.pp-av,.pp-blq,.pp-mas,.pp-ck,.pp-fold,.pp-tc,.pp-tfo):focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp :is(.pp-ant,.pp-sig){font-size:0;position:relative}
#mesa .pp :is(.pp-ant,.pp-sig)::before{content:'';position:absolute;inset:0;margin:auto;width:16px;height:16px;background:currentColor;-webkit-mask:var(--i-chev-l) center/100% no-repeat;mask:var(--i-chev-l) center/100% no-repeat}
#mesa .pp .pp-sig::before{-webkit-mask-image:var(--i-chev-r);mask-image:var(--i-chev-r)}
#mesa .pp .ibtn:active:not(:disabled),#mesa .pp :is(button.pp-av,.pp-blq,.pp-mas,button.pp-tfo):active{transform:scale(.97)}   /* D-171: every button shrinks when pressed */
#mesa .pp :is(button.pp-av,.pp-blq,.pp-mas,button.pp-tfo){transition:background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp .ibtn:disabled{color:var(--faint);background:none;cursor:default}
#mesa .pp-in{display:grid;grid-template-columns:minmax(0,1fr) 420px;grid-template-areas:"top top" "izq rail";gap:16px;max-width:1480px;margin:0 auto}
#mesa .pp-in.sin-rail{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "izq"}
#mesa .pp-in.solo-rail{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "izq" "rail"}
/* the figures and the period */
#mesa .pp-top{grid-area:top;display:flex;align-items:center;gap:24px;background:var(--bg-2);border-radius:var(--r-lg);padding:6px}
#mesa .pp-cifras{flex:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
#mesa .pp-cifra{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px;border:0;background:none;border-radius:var(--r-md);padding:12px 14px 13px;color:var(--ink);text-align:left;cursor:pointer;font:inherit;transition:background var(--d1) var(--ease),box-shadow var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-cifra b{font-size:26px;font-weight:800;line-height:1;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
#mesa .pp-cifra span{font-size:12.5px;line-height:1.25;color:var(--mute)}
#mesa .pp-cifra.rojo b{color:var(--red)}
#mesa .pp-cifra:hover:not(:disabled){background:var(--bg-3)}
#mesa .pp-cifra.on,#mesa .pp-cifra.on:hover{background:var(--panel-2);box-shadow:var(--shadow-sm)}
#mesa .pp-cifra.on span{color:var(--ink);font-weight:600}
#mesa .pp-cifra:active:not(:disabled){transform:scale(.97)}
#mesa .pp-cifra:disabled{cursor:default}#mesa .pp-cifra:disabled :is(b,span){color:var(--faint)}
#mesa .pp-periodo{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-right:10px}
#mesa .pp-nav{display:inline-flex;align-items:center;gap:2px}
#mesa .pp-rango{min-width:104px;text-align:center;font-size:13px;font-weight:600;color:var(--ink);user-select:none;cursor:default}
/* the columns and the folding panels (as the tray and the calendar, D-148) */
#mesa .pp-izq{grid-area:izq;display:flex;flex-direction:column;gap:16px;min-width:0;align-self:start}
#mesa .pp-rail{grid-area:rail;min-width:0;align-self:start}
#mesa .pp-phr{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px}
#mesa .pp-fold{display:inline-flex;align-items:center;gap:6px;border:0;background:none;border-radius:var(--r-pill);padding:3px 10px 3px 4px;font:inherit;color:var(--ink);cursor:pointer;transition:background var(--d1) var(--ease)}
#mesa .pp-fold::before{content:'';width:16px;height:16px;background:currentColor;-webkit-mask:var(--i-chev) center/100% no-repeat;mask:var(--i-chev) center/100% no-repeat;transition:transform var(--d-m) var(--ease-m)}
#mesa .pp-plg.fold .pp-fold::before{transform:rotate(-90deg)}
#mesa .pp-fold b{font-size:var(--cx-tit-fs);font-weight:var(--cx-tit-fw);letter-spacing:var(--cx-tit-ls)}
#mesa .pp-fold span{font-size:13px;color:var(--mute)}
#mesa .pp-fold:hover{background:var(--bg-2)}#mesa .pp-tareas .pp-fold:hover{background:var(--bg-3)}
#mesa .pp-fold:active{transform:scale(.97)}
#mesa .pp-pc{animation:pp-dentro var(--d-m) var(--ease-m)}
@keyframes pp-dentro{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
#mesa .pp-tabs{display:flex;align-items:flex-start;gap:4px;position:relative;margin-bottom:-6px}
#mesa .pp-tabs::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--line);pointer-events:none}
#mesa .pp-tabs > .pp-plg{flex:0 1 auto;min-width:0;height:40px;padding:0;border:1px solid var(--line);border-bottom:0;border-radius:var(--r-md) var(--r-md) 0 0;background:var(--panel);display:flex;align-items:center}
#mesa .pp-tabs > .pp-plg .pp-fold{height:39px;border-radius:var(--r-md) var(--r-md) 0 0;padding:0 14px 0 8px}
#mesa .pp-tabs > .pp-plg .pp-fold:hover{background:var(--panel-2)}
#mesa .pp-clientes{background:var(--panel);border-radius:var(--r-lg);padding:8px 8px 8px}
#mesa .pp-tareas{background:var(--bg-2);border-radius:var(--r-lg);padding:8px 10px 10px}
#mesa .pp-avisos{background:var(--panel);border-radius:var(--r-lg);padding:8px 6px 10px}
#mesa .pp-avisos .pp-phr{padding:0 4px}
#mesa .pp-in.solo-rail .pp-grupos{columns:380px 4;column-gap:28px}
#mesa .pp-in.solo-rail .pp-grupo{break-inside:avoid;margin:0 0 18px}
/* the notices (V2: the post's photo, its type over it) */
#mesa .pp-grupo + .pp-grupo{margin-top:18px}
#mesa .pp-gt{display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:600;color:var(--ink);padding:0 10px 6px}
#mesa .pp-gt span{font-weight:400;color:var(--mute)}
#mesa .pp-sub{font-size:12px;color:var(--mute);padding:8px 10px 2px}
#mesa .pp-lista{display:flex;flex-direction:column;gap:1px}
#mesa .pp-av{display:grid;grid-template-columns:28px 42px 32px minmax(0,1fr);align-items:center;column-gap:10px;width:100%;min-height:52px;padding:5px 10px;border:0;background:none;border-radius:var(--r-sm);font:inherit;font-size:13px;color:var(--ink);text-align:left;cursor:pointer;transition:background var(--d1) var(--ease)}
#mesa .pp-av > :is(.pp-avs,.pp-cu,.pp-afoto){grid-row:1 / span 2}
#mesa .pp-av .pp-nm{align-self:end}#mesa .pp-av .pp-est{grid-column:4;align-self:start;margin-top:-2px}
#mesa .pp-av.tarea .pp-nm,#mesa .pp-av:not(:has(.pp-est:not(:empty))) .pp-nm{grid-row:1 / span 2;align-self:center}
#mesa .pp-av .pp-est:empty{display:none}
#mesa .pp-av.tarea{cursor:default}
#mesa button.pp-av:hover{background:var(--bg-2)}
#mesa .pp-avs{display:inline-flex;align-items:center}
#mesa .pp-avs .pp-ava:first-child{position:relative;z-index:1;box-shadow:0 0 0 2px var(--panel)}#mesa .pp-avs .pp-ava + .pp-ava{margin-left:-7px}
#mesa .pp-av .pp-avs:has(.pp-ck){justify-content:center}
#mesa .pp-cu{font-size:12.5px;color:var(--mute);white-space:nowrap}#mesa .pp-cu.rojo{color:var(--red);font-weight:600}
#mesa .pp-afoto{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:40px;border-radius:var(--r-xs);overflow:hidden;background:var(--bg-2);color:var(--mute)}
#mesa .pp-afoto img{width:100%;height:100%;object-fit:cover;display:block}
#mesa .pp-afoto svg{width:16px;height:16px}
#mesa .pp-afoto.vacia{background:none}
#mesa .pp-afoto i{position:absolute;top:3px;right:3px;display:inline-flex;color:var(--on-photo);filter:drop-shadow(0 0 1.5px var(--photo-shade))}#mesa .pp-afoto i svg{width:11px;height:11px}
#mesa .pp-nm{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .pp-nm b{font-weight:600}#mesa .pp-nm i{font-style:normal;color:var(--mute);margin-left:4px}
#mesa .pp-est{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mute);white-space:nowrap;min-width:0;overflow:hidden}
#mesa .pp-est .pp-por{color:var(--ink-2)}
#mesa .pp-mano{color:var(--ink-2);font-weight:600}
#mesa .pp-av.hecha .pp-nm b,#mesa .pp-tk.hecha .pp-tt,#mesa .pp-fi.hecha .pp-tt{text-decoration:line-through;color:var(--mute);font-weight:400}
#mesa .pp-mas{align-self:flex-start;border:0;background:none;border-radius:var(--r-pill);font:inherit;font-size:12.5px;font-weight:600;color:var(--ink-2);padding:4px 10px;margin:2px 0 0 112px;cursor:pointer}
#mesa .pp-mas:hover{background:var(--bg-2);color:var(--ink)}
#mesa .pp-orden{font-size:13px;color:var(--mute);padding:6px 10px}
/* the avatar: its photo, or its initial in its kit's colour */
#mesa .pp-ava{flex:none;width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;background:var(--bg-3);color:var(--ink-2);font-size:12.5px;font-weight:800;line-height:1}
#mesa .pp-ava.xs{width:20px;height:20px;font-size:10.5px}
#mesa .pp-ava img{width:100%;height:100%;object-fit:cover;display:block}
#mesa .pp-ava.kit{background:var(--pp-kit);color:var(--on-photo)}#mesa .pp-ava.kit.claro{color:var(--photo-ink)}
/* the clients' blocks */
#mesa .pp-bcab,#mesa .pp-bgrid{display:grid;grid-template-columns:repeat(var(--cols,2),minmax(0,1fr));column-gap:8px}
#mesa .pp-bcab{padding:0 12px 4px;column-gap:32px}
#mesa .pp-bgrid{row-gap:4px}
#mesa .pp-blq{display:flex;flex-direction:column;align-items:stretch;gap:8px;width:100%;min-width:0;padding:10px 12px 12px;border:0;background:none;border-radius:var(--r-md);font:inherit;color:var(--ink);text-align:left;cursor:pointer;transition:background var(--d1) var(--ease)}
#mesa .pp-blq:hover{background:var(--bg-2)}
#mesa .pp-l1{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
#mesa .pp-quien{display:flex;align-items:center;gap:10px;min-width:0}
#mesa .pp-cn{min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .pp-cuentas{display:flex;flex-direction:column;align-items:flex-end;font-size:12px;line-height:1.45;color:var(--mute);white-space:nowrap}
#mesa .pp-l2{display:flex;gap:18px;flex-wrap:nowrap;min-width:0}
#mesa .pp-blq > .pp-tira{margin-top:auto}
#mesa .pp-bgrid.estrecha .pp-l1{flex-direction:column;align-items:flex-start;gap:6px}
#mesa .pp-bgrid.estrecha .pp-cuentas{align-items:flex-start;white-space:normal}
#mesa .pp-bgrid.estrecha .pp-l2{flex-direction:column;gap:8px;min-height:84px}
#mesa .pp-bgrid.estrecha .pp-cn{white-space:normal}
#mesa .pp-bgrid.estrecha .pp-bar i{width:14px}
#mesa .pp-pasos{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;min-height:32px}
#mesa .pp-mes{font-size:11.5px;color:var(--mute);width:24px;flex:none}
#mesa .pp-sin{font-size:12px;color:var(--mute)}
#mesa .pp-lc{display:flex;flex-direction:column;gap:6px;min-width:0}
#mesa .pp-ll{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;line-height:1.15;color:var(--pp-tx);white-space:nowrap}
#mesa .pp-bar{display:inline-flex;gap:3px}
#mesa .pp-bar i{display:block;width:17px;height:4px;border-radius:var(--r-pill);background:var(--bg-3)}
#mesa .pp-bar i.on{background:var(--pp-st)}
#mesa .pp [data-e="empezar"]{--pp-st:var(--st-empezar-aro);--pp-tx:var(--mute)}
#mesa .pp [data-e="captions"]{--pp-st:var(--st-captions);--pp-tx:color-mix(in oklab,var(--st-captions) 55%,var(--ink))}
#mesa .pp [data-e="aprobar"]{--pp-st:var(--st-aprobar);--pp-tx:color-mix(in oklab,var(--st-aprobar) 58%,var(--ink))}
#mesa .pp :is([data-e="aprobado"],[data-e="programado"],[data-e="publicado"]){--pp-st:var(--ok);--pp-tx:var(--ok)}
#mesa .pp-tira{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:var(--cx-gap);width:100%}
#mesa .pp-dia{height:30px;border-radius:var(--cx-r);background:var(--cx-casilla);display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:2px;padding:3px}
#mesa .pp-tira.mes .pp-dia{height:26px;border-radius:var(--r-xs);padding:2px 1px;flex-direction:column;flex-wrap:nowrap;align-items:center}
#mesa .pp-dia.hoy{box-shadow:var(--cx-hoy)}
#mesa .pp-dia.pas .pp-dot:not(.h){background:var(--faint)}#mesa .pp-dia.pas .pp-dot.h{box-shadow:inset 0 0 0 1.5px var(--faint)}
#mesa .pp-dot{display:block;width:6px;height:6px;border-radius:50%}
#mesa .pp-tira.mes .pp-dot{width:4px;height:4px}
#mesa .pp-dot.f{background:var(--pp-f)}#mesa .pp-dot.c{background:var(--pp-c)}#mesa .pp-dot.r{background:var(--pp-r)}
#mesa .pp-dot.h{box-shadow:inset 0 0 0 1.5px var(--story)}#mesa .pp-dot.t{border-radius:1.5px;background:var(--mute)}
#mesa .pp-cab span{display:flex;flex-direction:column;align-items:center;font-size:10.5px;line-height:1.2;color:var(--mute)}
#mesa .pp-cab b{font-weight:400}#mesa .pp-cab .hoy{color:var(--ink);font-weight:600}#mesa .pp-cab .hoy b{font-weight:600}
#mesa .pp-tira.mes.pp-cab span{font-size:9.5px}
#mesa .pp-pfn button{min-width:32px;padding:0 10px}
/* the tasks */
#mesa .pp-nueva{display:flex;align-items:center;gap:2px;height:32px;padding:0 2px 0 10px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel-2);margin-bottom:6px;transition:border-color var(--d1) var(--ease),box-shadow var(--d1) var(--ease)}
#mesa .pp-nueva:focus-within{border-color:var(--ink);box-shadow:0 0 0 3px var(--ring)}
#mesa .pp-nin{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none;height:30px;padding:0}
#mesa .pp-nin::placeholder{color:var(--faint)}
#mesa .pp-ib{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center}#mesa .pp-ib svg{width:15px;height:15px}
#mesa .pp-ib.puesta{display:none}
#mesa .pp-ncampo{flex:none;display:inline-flex;align-items:center}#mesa .pp-ncampo.vacio{display:none}
#mesa .pp-ncampo{margin:0 2px}#mesa .pp-ncampo :is(.mx-sel,.mx-f){min-height:26px;height:26px;border-color:transparent;background:var(--bg-2);border-radius:var(--r-pill)}
#mesa .pp-ncampo :is(.mx-sel,.mx-f):hover{border-color:var(--line-strong)}
#mesa .pp .pp-nin:focus-visible{outline:0}
#mesa .pp-tcl{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
#mesa .pp-tc{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0;border:0;border-radius:var(--r-pill);background:none;font:inherit;cursor:pointer;transition:box-shadow var(--d1) var(--ease),background var(--d1) var(--ease)}
#mesa .pp-tc.todos{padding:0 12px;font-size:12.5px;font-weight:600;color:var(--ink-2);background:var(--bg-3)}
#mesa .pp-tc.todos:hover{color:var(--ink)}
#mesa .pp-tc.on{box-shadow:0 0 0 2px var(--bg-2),0 0 0 4px var(--acc)}
#mesa .pp-tc.todos.on{background:var(--panel-2);color:var(--ink)}
#mesa .pp-tc:not(.on):hover .pp-ava{box-shadow:0 0 0 2px var(--line-strong)}
#mesa .pp-tc:active{transform:scale(.97)}
#mesa .pp-tfila{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin:2px 0 10px}
#mesa .pp-tsw{display:inline-flex;align-items:center;gap:14px}
#mesa .pp-sw{min-height:32px}
#mesa .pp-rg button{padding:0 10px}
#mesa .pp-tv{display:block}
#mesa .pp-tv.dos{display:grid;grid-template-columns:minmax(0,1fr) 268px;gap:10px;align-items:start}
#mesa .pp-tk{display:flex;align-items:center;gap:10px;min-height:32px;padding:4px 10px;border-radius:var(--r-sm);font-size:13px}
#mesa .pp-tk:hover{background:var(--bg-3)}
#mesa .pp-tt{flex:1;min-width:0}
#mesa .pp-tf{font-size:12px;color:var(--mute);white-space:nowrap}#mesa .pp-tf.rojo{color:var(--red);font-weight:600}
#mesa .pp-ck{appearance:none;-webkit-appearance:none;flex:none;width:15px;height:15px;margin:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--mute);background:none;cursor:pointer;position:relative;transition:background var(--d1) var(--ease),box-shadow var(--d1) var(--ease)}
#mesa .pp-ck:hover{box-shadow:inset 0 0 0 1.5px var(--ink)}
#mesa .pp-ck:checked{background:var(--acc);box-shadow:none}
#mesa .pp-ck:checked::before{content:'';position:absolute;inset:2.5px;background:var(--on-acc);-webkit-mask:var(--i-check) center/100% no-repeat;mask:var(--i-check) center/100% no-repeat}
#mesa .pp-sinf{background:var(--bg-3);border-radius:var(--r-md);padding:2px 4px 6px}
#mesa .pp-sinf .pp-sub{padding:8px 8px 2px}#mesa .pp-sinf .pp-sub span{color:var(--mute)}
#mesa .pp-sinf .pp-tk:hover{background:var(--bg-2)}
#mesa .pp-tfo{position:relative;flex:none;display:inline-flex;width:28px;height:28px;padding:0;border:0;border-radius:var(--r-xs);overflow:hidden;background:none;box-shadow:inset 0 0 0 1px var(--line);cursor:zoom-in}
#mesa .pp-tfo img{width:100%;height:100%;object-fit:cover;display:block}
#mesa .pp-tfo b{position:absolute;right:1px;bottom:1px;min-width:13px;height:13px;padding:0 3px;border-radius:var(--r-pill);background:var(--photo-chip-2);color:var(--on-photo);font-size:9.5px;font-weight:600;line-height:13px;text-align:center}
#mesa .pp-tfo.mini{width:20px;height:20px;margin-left:auto}
#mesa .pp-nueva .pp-tfo{width:24px;height:24px;cursor:default}
#mesa .pp-drop{background:var(--acc-soft) !important;box-shadow:inset 0 0 0 1.5px var(--acc) !important}
#mesa .pp-sem{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
#mesa .pp-sd{display:flex;flex-direction:column;gap:4px;min-width:0;min-height:120px;padding:6px;border-radius:var(--r-sm);background:var(--panel)}
#mesa .pp-sd.hoy{box-shadow:var(--cx-hoy)}#mesa .pp-sd.pas{background:var(--bg)}
#mesa .pp-sh{margin:0 0 2px;font-size:10.5px;color:var(--mute)}#mesa .pp-sh b{font-weight:400}#mesa .pp-sd.hoy .pp-sh{color:var(--ink);font-weight:600}#mesa .pp-sd.hoy .pp-sh b{font-weight:600}
#mesa .pp-fi{display:flex;align-items:flex-start;gap:6px;padding:6px;border-radius:var(--r-xs);background:var(--panel-2);box-shadow:var(--shadow-xs);font-size:12px;line-height:1.3}
#mesa .pp-fi .pp-tt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-wrap-style:pretty}
#mesa .pp-fi .pp-tt i{font-style:normal;color:var(--red);font-weight:600}
#mesa .pp-fi .pp-ck{margin-top:1px;width:13px;height:13px}#mesa .pp-fi .pp-ava.xs{width:16px;height:16px;font-size:9.5px;margin-left:auto}
#mesa .pp-fi.venc .pp-tt{color:var(--red)}
#mesa .pp-mcab,#mesa .pp-mgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:var(--cx-gap)}
#mesa .pp-mcab span{font-size:10.5px;color:var(--cx-wk-c);padding:0 4px 4px}
#mesa .pp-md{display:flex;flex-direction:column;gap:2px;min-width:0;min-height:68px;padding:4px;border-radius:var(--cx-r);background:var(--panel)}
#mesa .pp-md.hoy{box-shadow:var(--cx-hoy)}#mesa .pp-md.fuera{background:none}
#mesa .pp-mn{font-size:10.5px;color:var(--mute);line-height:1.2}#mesa .pp-md.hoy .pp-mn{color:var(--ink);font-weight:600}#mesa .pp-md.fuera .pp-mn{color:var(--cx-otro)}
#mesa .pp-mt{display:block;min-width:0;padding:2px 5px;border-radius:var(--r-xs);background:var(--panel-2);box-shadow:var(--shadow-xs);font-size:11.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .pp-mt img{width:14px;height:14px;border-radius:3px;object-fit:cover;vertical-align:-3px;margin-right:4px}
#mesa .pp-mt.venc{color:var(--red)}#mesa .pp-mt.hecha{text-decoration:line-through;color:var(--mute)}
#mesa .pp-mm{font-size:10.5px;color:var(--mute);padding:0 4px}
/* the notes: small post-its in a row above the list */
#mesa .pp-pn{display:flex;gap:8px;margin:0 0 12px;overflow-x:auto;padding:2px 2px 4px;margin-left:-2px}
#mesa .pp-pt{position:relative;display:flex;flex:0 0 172px;height:64px;padding:8px 10px;min-width:0;border-radius:var(--r-xs);background:var(--postit-2);color:var(--postit-ink);box-shadow:var(--shadow-xs);font-size:12px;line-height:1.35}
#mesa .pp-ptx{flex:1;margin:0;min-width:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#mesa .pp-pt{cursor:pointer;transition:box-shadow var(--d1) var(--ease)}#mesa .pp-pt:hover{box-shadow:var(--shadow-xs),0 0 0 1px var(--postit-3)}
#mesa .pp [data-pp="tver"]{cursor:pointer;outline:none}#mesa .pp :is(.pp-tk,.pp-fi,.pp-av.tarea){cursor:pointer}
#mesa .pp [data-pp="tver"]:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:var(--r-xs)}
/* a task or a note big (D-182): one card over the page, to read; a double click writes in it */
#mesa .pp-ov{position:absolute;inset:0;z-index:4;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:16px}
#mesa .pp-ov.entra{animation:pp-ovin var(--d2) var(--ease)}#mesa .pp-ov.entra .pp-card{animation:pp-cardin var(--d2) var(--ease)}
#mesa .pp-ov.sale{pointer-events:none;animation:pp-ovout var(--d1) var(--ease) forwards}#mesa .pp-ov.sale .pp-card{animation:pp-cardout var(--d1) var(--ease) forwards}
@keyframes pp-ovin{from{opacity:0}}@keyframes pp-ovout{to{opacity:0}}
@keyframes pp-cardin{from{opacity:0;transform:scale(.97)}}@keyframes pp-cardout{to{opacity:0;transform:scale(.97)}}
#mesa .pp-ov svg{stroke-width:var(--i-trazo)}#mesa .pp-ov svg :is(path,rect,circle,line){vector-effect:non-scaling-stroke}
#mesa .pp-card{width:min(560px,100%);max-height:calc(100% - 32px);overflow:auto;background:var(--panel);color:var(--ink);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);padding:22px 24px 20px;outline:none}
#mesa .pp-ch{display:flex;align-items:flex-start;gap:12px}
#mesa .pp-ch .pp-ck{margin-top:6px;width:17px;height:17px}
#mesa .pp-ct{flex:1;min-width:0;margin:0 0 0 -6px;padding:1px 6px;border-radius:var(--r-xs);font-size:20px;font-weight:650;line-height:1.3;text-wrap:pretty;overflow-wrap:anywhere;outline:none}
#mesa .pp-card.hecha .pp-ct{text-decoration:line-through;color:var(--mute)}
#mesa .pp-cm{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;margin:10px 0 0 29px;font-size:12.5px;color:var(--ink-2)}
#mesa .pp-cm > span{display:inline-flex;align-items:center;gap:6px}#mesa .pp-cm svg{flex:none;width:14px;height:14px;color:var(--mute)}
#mesa .pp-cm .rojo{color:var(--red);font-weight:600}#mesa .pp-cm .rojo svg{color:var(--red)}
#mesa .pp-cmf :is(.mx-sel,.mx-f){min-height:28px;height:28px;border-color:transparent;background:var(--bg-2);border-radius:var(--r-pill)}
#mesa .pp-cmf :is(.mx-sel,.mx-f):hover{border-color:var(--line-strong)}
#mesa .pp-cfo{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0 29px}#mesa .pp-cfo .pp-tfo{width:56px;height:56px;border-radius:var(--r-sm)}
#mesa .pp-card.ed .pp-ct{background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);cursor:text}
#mesa .pp-card.ed .pp-ct:focus{background:var(--panel);box-shadow:inset 0 0 0 1.5px var(--focus)}
#mesa .pp-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
#mesa .pp-tl{display:flex;align-items:center;gap:6px;min-width:0}#mesa .pp-col .pp-tt{flex:0 1 auto;min-width:0}#mesa .pp-fi .pp-tl{align-items:flex-start}
#mesa .pp-tdet{flex:none;display:inline-flex;width:14px;height:14px;color:var(--mute)}#mesa .pp-tdet svg{width:14px;height:14px}#mesa .pp-fi .pp-tdet{margin-top:1px}
#mesa .pp-pg{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1;color:var(--mute)}
#mesa .pp-pb{position:relative;flex:none;width:64px;height:3px;border-radius:var(--r-pill);background:var(--line2);overflow:hidden}
#mesa .pp-pb i{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--acc)}#mesa .pp-pg.todo .pp-pb i{background:var(--ok)}#mesa .pp-fi .pp-pb{width:44px}
#mesa .pp-cd{margin:16px 0 0 19px;padding:8px 10px;min-height:22px;border-radius:var(--r-sm);font-size:14px;line-height:1.5;color:var(--ink-2);white-space:pre-wrap;overflow-wrap:anywhere;outline:none}
#mesa .pp-cd.vacio{color:var(--faint)}
#mesa .pp-card.ed .pp-cd{min-height:66px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);cursor:text}
#mesa .pp-card.ed .pp-cd:focus{background:var(--panel);box-shadow:inset 0 0 0 1.5px var(--focus)}#mesa .pp-card.ed .pp-cd:empty::before{content:attr(data-ph);color:var(--faint)}
#mesa .pp-cs{margin:14px 0 0 29px}
#mesa .pp-csh{display:flex;align-items:center;gap:10px;margin:0 0 6px;font-size:12px;color:var(--mute)}#mesa .pp-csh .pp-pb{flex:1;width:auto;height:4px}
#mesa .pp-csub{display:flex;align-items:center;gap:10px;min-height:32px;padding:0 6px;margin-left:-6px;border-radius:var(--r-sm);font-size:13.5px}
#mesa .pp-csub > span{flex:1;min-width:0;overflow-wrap:anywhere}#mesa .pp-csub.hecha > span,#mesa .pp-csub.hecha .pp-cst{text-decoration:line-through;color:var(--mute)}
#mesa .pp-cst{flex:1;min-width:0;height:28px;border:0;border-radius:var(--r-xs);padding:0 8px;margin-left:-8px;font:inherit;font-size:13.5px;color:var(--ink);background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);outline:none}
#mesa .pp-cst:focus{background:var(--panel);box-shadow:inset 0 0 0 1.5px var(--focus)}
#mesa .pp-csx{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;padding:0;background:none;border-radius:var(--r-xs);color:var(--mute);cursor:pointer;transition:background var(--d1) var(--ease)}
#mesa .pp-csx:hover{background:var(--bg-3);color:var(--ink)}#mesa .pp-csx svg{width:14px;height:14px}
#mesa .pp-cmas{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0 -4px;padding:5px 8px;border:0;background:none;border-radius:var(--r-pill);font:inherit;font-size:12.5px;font-weight:600;color:var(--acc);cursor:pointer;transition:background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-cmas svg{width:14px;height:14px}#mesa .pp-cmas:hover{background:var(--acc-soft)}#mesa .pp-cmas:active{transform:scale(.97)}
#mesa :is(.pp-cmas,.pp-csx):focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp-card.nota{width:min(440px,100%);min-height:280px;display:flex;background:var(--postit-2);color:var(--postit-ink);border-radius:var(--r-sm);padding:22px 24px}
#mesa .pp-cn{flex:1;min-width:0;margin:0;font-size:16px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;outline:none}
#mesa .pp-card.nota.ed{box-shadow:var(--shadow-lg),0 0 0 2px var(--postit-3)}#mesa .pp-card.nota.ed .pp-cn{cursor:text}
/* a task's photo, big */
#mesa .detail[data-dlg="pp-foto"] .card.dlg{max-width:min(94vw,980px);width:auto;padding:12px 12px 10px}
@media (prefers-reduced-motion:reduce){#mesa .pp-pc{animation:none}#mesa .pp-ov.entra .pp-card{animation-name:pp-ovin}#mesa .pp-ov.sale .pp-card{animation:none}#mesa .pp-cmas:active{transform:none}#mesa .pp :is(.pp-fold,.pp-cifra,.ibtn,.pp-tc,button.pp-av,.pp-blq,.pp-mas,button.pp-tfo):active,#mesa .brand.pp-logo:active svg{transform:none}}
@media (max-width:720px){
  #mesa .pp{padding:4px 12px 24px}
  #mesa .pp-cifra{padding:10px 10px 11px}#mesa .pp-cifra span{font-size:12px}
  #mesa .pp-in{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "izq" "rail"}
  #mesa .pp-top{flex-direction:column;align-items:stretch;gap:6px}#mesa .pp-periodo{padding:0 8px 6px}
  #mesa .pp-bgrid,#mesa .pp-bcab{grid-template-columns:minmax(0,1fr)}#mesa .pp-bcab > .pp-cab + .pp-cab{display:none}
  #mesa .pp-sem{grid-template-columns:repeat(4,minmax(0,1fr))}#mesa .pp-sd{min-height:84px}
  #mesa .pp-tv.dos{grid-template-columns:minmax(0,1fr)}#mesa .pp-md{min-height:52px}#mesa .pp-mt{font-size:10.5px}
  #mesa .pp-av{column-gap:8px}
}
`;
  // the mesa never waits for this file: this file waits for the mesa's shell (put in the body when the mesa opens)
  (function esperarShell() {
    const listo = () => { const X = I(); return !!(X && X.shellReady && X.shellReady() && X.idbAll && X.estilo); };
    if (listo()) return montar();
    let t = 0; const mo = new MutationObserver(() => { if (listo()) { mo.disconnect(); clearInterval(t); montar(); } });
    mo.observe(document.body || document.documentElement, { childList: true });
    t = setInterval(() => { if (listo()) { mo.disconnect(); clearInterval(t); montar(); } }, 250);
  })();
  (window.MESA_CARGA = window.MESA_CARGA || {}).personal = 'ok';   // it ran to the end: a module that throws while loading is told apart (D-115)
})();
