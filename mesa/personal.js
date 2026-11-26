// Página personal — Mesa de trabajo · v1.3 (D-180, D-181, D-202–D-205)
// The page the logo opens: every client at a glance. Four figures (what went past, what goes out today and tomorrow, what waits
// for the client, what is left to schedule), the notices behind them, a block per client (its two months as a line of steps
// and its week) and the tasks and notes, which live only here (IndexedDB 'tareas', with their photos, mesa ≥ 4.16). It reads
// what the mesa knows and changes no post: a notice opens its post in its board. The mesa starts on it, except after a reload
// inside a client, and never waits for this file: without it the logo is not a button and the last client opens.
//   M.personal: abrir() · cerrar() · abierta() · render() · datos() · tareas() · tarea({txt, fecha?, cliente?, tipo?}) ·
//   hecha(id, v) · borrar(id) · deshacer() · rehacer() · estado() · set(o)
//   abrirSesion(id, {de, vc, cli}): a session's sheet over the board, from the posts' calendar (1.5, D-219)
(function personalBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.19';   // 1.19: the last month's «Cómo fue» in «Hoy» from the 3rd, with the clients that published and have no summary yet (D-362). 1.18: a delivery gone past and a «Solo contenido» client's block open its page (D-312); each day of Semana, Mes and the clients' strips under the mouse (D-313). 1.17: an invoice not issued whose day passed says «con retraso» (D-304). 1.16: a notice's and a task's mark from the core, marcaDe and marcaT; a task not done tinted as a post not scheduled, in Avisos and Tareas; at hover the row keeps its tint (D-300). 1.15: «Acuerdos» in Avisos, 14 days before renegotiating and, gone past, in «Se ha pasado» (D-288); a sporadic client from «Nuevo cliente» (D-289); a «Solo contenido» client's block counts its deliveries and one gone past goes to «Se ha pasado» (D-290). 1.14: from the board's calendar, a session or a task with that day and the client, a session duplicated or deleted with «Deshacer» (D-285); «/-» a separator (D-283). 1.13: campo/editar de una tarea o nota desde el iPhone (D-272), _p.clis y esps para la sesión (D-275). 1.12: in the iPhone (data-movil) nothing mounts; datos(o), lista(), valor(id), nuevoId(tipo) and a task with its id for the phone (D-267). 1.11: the symbol's button says «Clic: tu página · Clic derecho: copias» (D-263). 1.10: a photo of a task or note that hasn't come down from the server yet (lot 4 of the traspaso) shows nothing and says so, instead of breaking the page (D-259). 1.9: the cloud's activity notices, first in Avisos (D-257). 1.8: «aprobó / pidió cambios / ha comentado en su web» en «Esperando al cliente» (D-244). 1.7: each client's most urgent payment under its block, which opens its «Cobros», and the sums paid this month and pending in the header of Clientes (D-235); a late invoice in «Se ha pasado» (D-236); «Borrar esporádico» off with payments (D-234). 1.6: today's posts not scheduled, tinted amber in Avisos (D-222); the page and a card change in place only what changed (D-223); widen and reduce in the ×'s box (D-224); Tareas as this tab left it (D-225); a session in 600 with its clapperboard in --ty-ses-ink (D-226); square corners where a session goes on, --mute for what is read, «Fecha» / «Cliente» with the pointer over them, widening with a transform (D-231). 1.5: a session's several clients shown once, «A · B» and the first one's avatar with «+N» (D-217); its end in Avisos, Lista, Semana and Mes, «Reprogramar» keeps its length (D-218); its sheet opens over the board from the posts' calendar (D-219); «Duplicar sesión» in its menu (D-221). 1.4: a click writes, Esc and the × close (D-209); a session's sheet widens (D-210); «Hoy» and «Mañana» apart (D-212); one thin line on what is written (D-213). 1.3: the note and the details write with marks and the «/» menu (escritura.js, D-202–D-204); the card widens (D-205). 1.2: a task's date offers «Sin fecha» (D-188); what is not scheduled stands out in «Hoy y mañana» and «Se ha pasado» (D-190); each month's step is its most delayed post's (D-192)
  if (M.personal && M.personal._off) { try { M.personal._off(); } catch (e) { /* */ } }

  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const INI = ['D', 'L', 'M', 'X', 'J', 'V', 'S'], DS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const LS_FILA = 'mesa-pp-fila', LS_ALC = 'mesa-pp-alcance', LS_VISTA = 'mesa-pp-vista';   // remembered in this browser
  const SS_CLI = 'mesa-pp-cliente';            // this tab left the page for a client: a reload stays there
  const SS_TAREAS = 'mesa-pp-tareas';          // Tareas folded ('1') or open ('0') as this tab left it (D-225); a new tab, folded
  const TOPE = 8;                              // lines of a group before «N más»
  const FOTO_PX = 1600, MINI_PX = 160;         // a task's photo, lowered; and the thumbnail drawn
  const svg = b => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
  const ICO = {                                // Lucide (ISC), one stroke (D-168)
    foto: svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    historias: svg('<path d="M10.1 2.182a10 10 0 0 1 3.8 0m0 19.636a10 10 0 0 1-3.8 0m7.509-18.097a10 10 0 0 1 2.69 2.7M2.182 13.9a10 10 0 0 1 0-3.8m18.097 7.509a10 10 0 0 1-2.7 2.69M21.818 10.1a10 10 0 0 1 0 3.8M3.721 6.391a10 10 0 0 1 2.7-2.69m-.03 16.578a10 10 0 0 1-2.69-2.7"/>'),
    cliente: svg('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
    nota: svg('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>'),
    fecha: svg('<path d="M8 2v4m8-4v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
    euro: svg('<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>'),
    reloj: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    grafica: svg('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
    reunion: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),   // Lucide users: a meeting (D-291)
    entrega: svg('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>'),   // Lucide package (D-290)
    alerta: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
    hecho: svg('<path d="M20 6 9 17l-5-5"/>'),
    texto: svg('<path d="M15 18H3"/><path d="M17 6H3"/><path d="M21 12H3"/>'),
    mas: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    // maximize-2 and minimize-2 drawn in the ×'s box, units 6 to 18 of 24 (12 + (v − 12) · 2/3), the same stroke (D-224)
    ampliar: svg('<path d="M14 6h4v4"/><path d="m18 6-4.667 4.667"/><path d="m6 18 4.667-4.667"/><path d="M10 18H6v-4"/>'),
    sesion: svg('<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    camara: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'),
    video: svg('<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>'),
    libre: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
    fotos: svg('<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>'),
    ojo: svg('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'),
    ojoNo: svg('<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>'),
    una: svg('<rect width="20" height="12" x="2" y="6" rx="2"/>'),
    todas: svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
    enlace: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    mas3: svg('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'),
    asa: svg('<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>'),
    chev: svg('<path d="m6 9 6 6 6-6"/>'),
    reducir: svg('<path d="m13.333 10.667 4.667-4.667"/><path d="M17.333 10.667h-4V6.667"/><path d="m6 18 4.667-4.667"/><path d="M6.667 13.333h4v4"/>')
  };
  const ES = () => (M.escritura && M.escritura.html ? M.escritura : null);   // the quick writing (escritura.js, D-202); without it, plain text as before
  const leerTxt = (t, o) => { const E = ES(); return E ? E.html(t, o) : esc(t); };
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
    tcli: null, tsem: 0, tmes: 0, ttodas: false, nueva: { fecha: '', cliente: '', fotos: [] }, cvista: 'mensuales',
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
  // its data still decides what can't hold (as the mesa's estadoDe, D-085, D-192): one put back by hand never past its data, an
  // approved or turned down one without a chosen caption falls back; whether it changed after approval isn't known here (D-180)
  const ATRAS = { empezar: 0, captions: 1, aprobar: 2 };
  const estadoDe = (s, B) => {
    const X = I(); if (B && X.S && B === X.S) return X.estadoDe(s);
    const v = s.estado && s.estado.v, a = X.estadoAuto(s); if (!v || !MANUAL.includes(v)) return a;
    if (v in ATRAS) return ATRAS[v] < ATRAS[a] ? v : a;
    return (v === 'aprobado' || v === 'noaprobado') && a !== 'aprobar' ? a : v;
  };
  const mesesDe = B => Array.from({ length: B.span || 1 }, (_, i) => I().addMonths(B.month, i));
  function pasoDe(B, m) {                      // the month's step, its most delayed post's (D-119, D-192); another board's with its saved states
    const X = I(); if (X.S && B === X.S) return X.pasoDe(B, m);
    const ms = mesesDe(B); if (!ms.includes(m)) m = ms[0];
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
    ponerTK((await X.idbAll('tareas').catch(() => [])) || [], g0);
    if (X.mes && X.mes.leer && !X.mes.listo()) await X.mes.leer().catch(() => {});   // each month's «Cómo fue», for its notice (D-362)
    return { CL: X.CL.slice(), boards };
  }
  function ponerTK(ts, g0) {
    const antes = new Map(TK);
    TK.clear(); for (const t of ts) if (t && t.id) TK.set(t.id, t);
    for (const [id, r] of antes) if (r._b) TK.set(id, r);   // a new task still being written (not made yet) stays
    for (const [id, g] of TOCADA) if (g > g0) { const r = antes.get(id); if (r) TK.set(id, r); else TK.delete(id); }   // written while this read
    for (const [id, r] of PEND) { if (r) TK.set(id, r); else TK.delete(id); }   // a write still on its way wins over what was read
  }
  async function cargarTK() { const g0 = gen; ponerTK((await I().idbAll('tareas').catch(() => [])) || [], g0); }   // without the page (a session's sheet over the board, D-219)
  const avisar = () => { try { document.dispatchEvent(new CustomEvent('mesa-tareas')); } catch (e) { /* */ } };   // the posts' calendar draws its sessions again
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
      if (dia === hoy || dia === man) { items.push({ ...base, cat: dia === hoy ? 'hoy' : 'man', mano: reel && e !== 'programado' }); continue; }   // today and tomorrow apart (D-212)
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
      if (g.dia === hoy || g.dia === man) items.push({ ...it, cat: g.dia === hoy ? 'hoy' : 'man' });
      else if (enV(g.dia)) items.push({ ...it, cat: 'falta' });
    }
    if (st.avTareas) for (const k of vivos()) {   // the tasks and the sessions, only with the switch of Avisos (D-180, D-206)
      if ((k.tipo !== 'tarea' && k.tipo !== 'sesion') || !k.fecha) continue;
      const hechaAntes = k.hecha && X.localDay(k.hecha) < hoy; if (hechaAntes) continue;
      const ses = k.tipo === 'sesion', conH = ses && /^\d{2}:\d{2}$/.test(k.hora || '');
      const it = { tipo: ses ? 'sesion' : 'tarea', k, clientes: clis(k).filter(cliOk), dia: k.fecha, hora: ses ? k.hora || '' : '', ts: conH ? X.ts(X.madridISO(k.fecha, k.hora)) : utc(k.fecha), hecha: !!k.hecha };   // its time is Madrid's, as the posts'
      // a session the day before and each day it lasts, with its time on its first day; from the day after its end, if not
      // done, gone past (a task: only its day) (D-206, D-218)
      const ult = ultDia(k);
      if (ult < hoy) items.push({ ...it, cat: 'pasado' }); else if (k.fecha <= hoy) items.push({ ...it, cat: 'hoy', ...(k.fecha < hoy ? { hora: '', sigue: true } : {}) }); else if (ses && k.fecha === man) items.push({ ...it, cat: 'man' });
    }
    const CB = X.cob;                           // an invoice not paid after it was due: in «Se ha pasado», with or without «Tareas» (D-236)
    if (CB) for (const r of CB.vivos()) {
      const e = CB.estado(r, hoy); if (e.k !== 'retrasada') continue;
      const c = cliDe(r.cliente); if (!c) continue;
      items.push({ tipo: 'cobro', r, dias: e.dias, clientes: [r.cliente], dia: r.vence, ts: utc(r.vence), cat: 'pasado' });
    }
    // a delivery of a «Solo contenido» client gone past without delivering (D-290): in «Se ha pasado», as a late invoice
    const EN = X.ent;
    if (EN && X.esContenido) for (const c of D.CL) {
      if (!X.esContenido(c.id)) continue;
      for (const r of EN.vivas(c.id)) {
        if (EN.estado(r, hoy) !== 'pasada') continue;
        items.push({ tipo: 'entrega', r, B: null, clientes: [c.id], dia: r.fecha, ts: utc(r.fecha), cat: 'pasado' });   // it opens the client's page, with it open (D-312): no board
      }
    }
    // an agreement to renegotiate (D-288): 14 days before, in «Acuerdos»; its day gone, in «Se ha pasado»; no figure of its own
    if (CB && CB.acuerdo) for (const c of D.CL) {
      const a = CB.acuerdo(c); if (!a || !a.renegociar) continue;
      const n = difD(hoy, a.renegociar); if (n > 14) continue;
      items.push({ tipo: 'acuerdo', c, a, n, clientes: [c.id], dia: a.renegociar, ts: utc(a.renegociar), cat: n < 0 ? 'pasado' : 'acuerdos' });
    }
    // the last month's «Cómo fue» (D-362): from the 3rd (its last posts still add reach a couple of days), one notice in «Hoy»
    // with the monthly clients that published that month and have no summary of it yet; it goes on its own once Claude loads
    // it (calendar-creator: «cómo fue [mes]»), all the clients at once
    const MS = X.mes;
    if (MS && MS.listo && MS.listo() && +hoy.slice(8, 10) >= 3) {
      const pm = X.addMonths(hoy.slice(0, 7), -1);
      const faltan = D.CL.filter(c => !(X.esContenido && X.esContenido(c.id)) && !(MS.get(c.id, pm) || {}).resumen
        && (Q.porCli.get(c.id) || []).some(o => o.e0 !== 'cancelado' && o.dia && o.dia.slice(0, 7) === pm)).map(c => c.id);
      if (faltan.length) items.push({ tipo: 'informe', mes: pm, clientes: faltan, dia: hoy, ts: utc(hoy), cat: 'hoy' });
    }
    for (const x of items) x.marca = marcaDe(x);   // the Mac and the iPhone only put its class (D-287, D-300)
    items.sort((a, b) => a.ts - b.ts || (a.tipo === 'historias') - (b.tipo === 'historias'));
    const cuenta = c => items.filter(x => x.cat === c && !x.hecha).length;
    const filas = D.CL.map(c => fila(c, D, Q, V, enV, hoy));
    return { items, filas, V, hoy, man, cifras: { pasado: cuenta('pasado'), hoy: cuenta('hoy'), man: cuenta('man'), espera: cuenta('espera'), falta: cuenta('falta') } };
  }
  // a notice's mark (D-190, D-222, D-300): what isn't scheduled or isn't done, today amber, tomorrow its band, gone past red; a
  // task as a post; a session only once it went past (one of today, as it is); the stories, none; an invoice, a delivery or an
  // agreement gone past, red
  function marcaDe(x) {
    if (x.cat !== 'hoy' && x.cat !== 'man' && x.cat !== 'pasado') return '';
    if (x.tipo === 'post') return x.e !== 'programado' && x.e !== 'publicado' ? x.cat : '';
    if (x.tipo === 'tarea') return x.hecha ? '' : x.cat;
    if (x.tipo === 'sesion') return !x.hecha && x.cat === 'pasado' ? 'pasado' : '';
    if (x.tipo === 'historias' || x.tipo === 'informe') return '';
    return x.cat === 'pasado' ? 'pasado' : '';
  }
  // a task's mark in Tareas (D-300): not done, today, tomorrow or gone past; a session only once it went past (as in Avisos
  // and in the iPhone's «Hoy»: one of today, as it is); a note, none
  const marcaT = (k, hoy) => k.hecha || !k.fecha ? '' : k.tipo === 'sesion' ? (ultDia(k) < hoy ? 'pasado' : '') : k.tipo !== 'tarea' ? '' : k.fecha < hoy ? 'pasado' : k.fecha === hoy ? 'hoy' : k.fecha === addD(hoy, 1) ? 'man' : '';
  const mkCls = m => m ? ' pp-mk-' + m : '';
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
    const tk = vivos().filter(k => k.tipo === 'tarea' && k.cliente === c.id && !k.hecha);
    for (const k of tk) if (k.fecha && at[k.fecha]) at[k.fecha].t++;
    const cont = !!(X.esContenido && X.esContenido(c.id)) && !!X.ent;   // D-290: its deliveries, a dot each on its day
    let ents = 0, entSin = 0;
    if (cont) {
      for (const r of X.ent.vivas(c.id)) { const x = at[r.fecha]; if (x) { x.e = (x.e || 0) + 1; x.nombres.push(r.que || 'Entrega'); } if (enV(r.fecha)) { ents++; if (!r.entregada) entSin++; } }
      meses.forEach(m => { const l = X.ent.vivas(c.id).filter(r => r.fecha.slice(0, 7) === m.m); m.ent = { n: l.length, h: l.filter(r => r.entregada).length }; });
    }
    return { c, meses, dias, pubs, pubSin, hs, hsSin, tareas: tk.length, cont, ents, entSin };
  }

  // ---------- pieces ----------
  // a client: one with a board (the mesa's) or a sporadic one (D-207), never in the tabs nor where the clients with a board are read
  const esps = () => [...TK.values()].filter(k => k.tipo === 'esporadico' && !k.pasado && !k._b).sort((a, b) => String(a.txt).localeCompare(String(b.txt), 'es'));
  const espDe = id => { const k = id && TK.get(id); return k && k.tipo === 'esporadico' && !k.pasado ? { id: k.id, name: k.txt, esporadico: true } : null; };
  const cliDe = id => ((D && D.CL) || []).find(c => c.id === id) || (I().CL || []).find(c => c.id === id) || espDe(id);   // the page's reading may be older than a client made since (D-285: from the board)
  // a session has several clients (D-217): `clientes`; one saved before the 4.24 still says `cliente`. A task or a note, one
  const clis = k => !k ? [] : k.tipo === 'sesion' && Array.isArray(k.clientes) ? k.clientes.filter(c => typeof c === 'string' && c) : k.cliente ? [k.cliente] : [];
  const conCli = (k, c) => !!c && clis(k).includes(c);
  const inic = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
  const nombreC = id => esc((cliDe(id) || { name: id }).name);
  function avatar(cid, cls = '') {
    const c = cliDe(cid) || { name: '?' }, f = c.foto && M.files[c.foto];
    if (f && f.thumbUrl) return `<span class="pp-ava ${cls}" aria-hidden="true"><img src="${f.thumbUrl}" alt=""></span>`;
    const k = kits[cid];
    return `<span class="pp-ava ${cls}${typeof k === 'string' ? ' kit' + (claro(k) ? ' claro' : '') : ''}"${typeof k === 'string' ? ` style="--pp-kit:${esc(k)}"` : ''} aria-hidden="true">${esc(inic(c.name))}</span>`;
  }
  // several clients (a session's, D-217): the first one's avatar and «+N»; their names in its title
  const avatarN = (l, cls = 'xs') => !l.length ? '' : l.length === 1 ? avatar(l[0], cls) : `<span class="pp-avn" title="${l.map(nombreC).join(' · ')}">${avatar(l[0], cls)}<span>+${l.length - 1}</span></span>`;
  // the figures and the groups go by urgency, in one order (D-180, chosen by Claude): what waits for the client blocks what
  // is left to schedule; «Hoy» and «Mañana», a figure each, and one group, «Hoy» with «Mañana» under it (D-212)
  const GRUPOS = [['acuerdos', 'Acuerdos'], ['pasado', 'Se ha pasado'], ['hoy', 'Hoy'], ['espera', 'Esperando al cliente'], ['falta', 'Falta programar']];   // «Acuerdos» first, as drawn (D-288)
  const CIFRAS = [['pasado', 'Se ha pasado'], ['hoy', 'Hoy'], ['man', 'Mañana'], ['espera', 'Esperando al cliente'], ['falta', 'Falta programar']];
  function cifras(R) {
    return `<div class="pp-cifras" role="group" aria-label="Avisos">${CIFRAS.map(([k, l]) => { const n = R.cifras[k];
      return `<button type="button" class="pp-cifra${k === 'pasado' && n ? ' rojo' : ''}${st.filtro === k ? ' on' : ''}" data-pp="filtro" data-k="${k}" aria-pressed="${st.filtro === k}"${n || st.filtro === k ? '' : ' disabled'}><b>${n}</b><span>${l}</span></button>`; }).join('')}</div>`;
  }
  function periodo(R) {
    const s = st.modo === 'semana', t = rangoTxt(R.V);
    return `<div class="pp-periodo"><div class="seg" role="group" aria-label="Periodo"><button type="button" class="${s ? 'on' : ''}" data-pp="modo" data-m="semana" aria-pressed="${s}">Semana</button><button type="button" class="${s ? '' : 'on'}" data-pp="modo" data-m="mes" aria-pressed="${!s}">Mes</button></div>`
      + `<span class="pp-nav"><button type="button" class="ibtn pp-ant" data-pp="desp" data-d="-1" aria-label="${s ? 'Semana anterior' : 'Mes anterior'}" title="${s ? 'Semana anterior' : 'Mes anterior'}">‹</button><span class="pp-rango" data-pp="rango" title="${esc(t)} · doble clic: ${s ? 'esta semana' : 'este mes'}">${esc(t)}</span><button type="button" class="ibtn pp-sig" data-pp="desp" data-d="1" aria-label="${s ? 'Semana siguiente' : 'Mes siguiente'}" title="${s ? 'Semana siguiente' : 'Mes siguiente'}">›</button></span></div>`;
  }
  const estLbl = e => (I().ESTADOS.find(x => x[0] === e) || [e, e])[1];
  function cuando(x, R) {
    if (x.cat === 'pasado') return `<span class="pp-cu rojo">${esc(corto(x.dia))}${x.tipo === 'sesion' && x.hora ? `<br>${esc(x.hora)}` : ''}</span>`;
    if (x.cat === 'hoy' || x.cat === 'man') return `<span class="pp-cu">${x.tipo === 'post' || x.tipo === 'sesion' ? esc(x.hora) : ''}</span>`;
    return `<span class="pp-cu">${esc(corto(x.dia))}</span>`;
  }
  function mini(x) {                           // the post's photo (its thumbnail) with its type over it; a single photo has none
    if (x.tipo !== 'post') return `<span class="pp-afoto vacia">${x.tipo === 'tarea' ? ICO.fecha : x.tipo === 'sesion' ? (esReunion(x.k) ? ICO.reunion : ICO.sesion) : ICO.historias}</span>`;
    const f = x.s.photos && x.s.photos[0] && M.files[x.s.photos[0]], ty = tipoTxt(x.s) === 'Foto' ? '' : I().tipoPost(x.s).ico;
    return f && f.thumbUrl ? `<span class="pp-afoto"><img src="${f.thumbUrl}" alt="" loading="lazy" decoding="async">${ty ? `<i>${ty}</i>` : ''}</span>` : `<span class="pp-afoto vacia">${ty || ICO.foto}</span>`;
  }
  function aviso(x, R) {
    const avs = `<span class="pp-avs">${x.clientes.slice(0, 2).map(c => avatar(c, 'xs')).join('')}</span>`, quien = x.clientes.map(nombreC).join(x.tipo === 'sesion' ? ' · ' : ' × ');   // a collab's two clients; a session's, as a list (D-217)
    // a session gone past: its checkbox and «Reprogramar» (the mesa's calendar; a step of ⌘Z, D-206)
    const repro = x.tipo === 'sesion' && x.cat === 'pasado' && !x.hecha ? `<button type="button" class="btn2 pp-repro" data-pp="reprog" data-id="${esc(x.k.id)}" title="Otra fecha para la sesión">${ICO.fecha}Reprogramar</button>` : '';
    const mk = `${x.marca ? ' sinprog' : ''}${x.marca === 'hoy' ? ' pp-avhoy' : ''}`;   // the core's mark (D-300)
    if (x.tipo === 'tarea' || x.tipo === 'sesion') return `<div class="pp-av tarea${x.hecha ? ' hecha' : ''}${x.tipo === 'sesion' ? ' ses' : ''}${repro ? ' repro' : ''}${mk}" data-tid="${esc(x.k.id)}"><span class="pp-avs"><input type="checkbox" class="pp-ck" data-pp="ck" data-id="${esc(x.k.id)}"${x.hecha ? ' checked' : ''} aria-label="Hecha"></span>${cuando(x, R)}${mini(x)}<span class="pp-nm" data-pp="tver" data-id="${esc(x.k.id)}" tabindex="0" role="button"><b>${esc(x.k.txt)}</b>${x.clientes.length ? ` <i>${quien}</i>` : ''}</span><span class="pp-est"></span>${repro}</div>`;
    if (x.tipo === 'entrega') {                 // a delivery gone past (D-290): its board on its row, as a late invoice
      const r = x.r, n = -difD(R.hoy, r.fecha);
      return `<button type="button" class="pp-av${mk}" data-pp="entrega" data-c="${esc(r.cliente)}" data-id="${esc(r.id)}"${x.B ? ` data-key="${esc(x.B.key)}"` : ''} title="${esc(r.que || 'Entrega')} · venció el ${esc(corto(r.fecha))}">${avs}${cuando(x, R)}<span class="pp-afoto vacia">${ICO.entrega}</span><span class="pp-nm"><b>${esc(r.que || 'Entrega sin título')}</b> <i>${quien}</i></span><span class="pp-est">Sin entregar · hace ${n} ${n === 1 ? 'día' : 'días'}</span></button>`;
    }
    if (x.tipo === 'informe') {                 // the last month's «Cómo fue» (D-362): a reminder; Claude loads it, nothing opens
      const mt = MESL[+x.mes.slice(5, 7) - 1];
      return `<div class="pp-av pp-avinf" title="${esc('Dile a Claude «cómo fue ' + mt + '»: lo carga de todos los clientes a la vez')}">${avs}${cuando(x, R)}<span class="pp-afoto vacia">${ICO.grafica}</span><span class="pp-nm"><b>Falta el «Cómo fue» de ${esc(mt)}</b></span><span class="pp-est">${esc(x.clientes.map(nombreC).join(' · '))}</span></div>`;
    }
    if (x.tipo === 'acuerdo') {                 // renegotiate (D-288): the clock where the photo goes; gone past, tinted red as a late invoice
      const t = acuerdoCuando(x);
      return `<button type="button" class="pp-av${mk} pp-avco" data-pp="cobro" data-c="${esc(x.c.id)}" title="Renegociar el acuerdo de ${esc(x.c.name)} · ${esc(corto(x.dia))}">${avs}${cuando(x, R)}<span class="pp-afoto vacia">${ICO.reloj}</span><span class="pp-nm"><b>Renegociar el acuerdo</b> <i>${quien}</i></span><span class="pp-est">${esc(t)}</span></button>`;
    }
    if (x.tipo === 'cobro') {                   // tinted red as what isn't scheduled (D-190), the euro where the photo goes (D-236)
      const C = I().cob, r = x.r, nf = r.factura ? 'Factura ' + r.factura : 'Factura de ' + C.nombre(r).toLowerCase();
      return `<button type="button" class="pp-av${mk} pp-avco" data-pp="cobro" data-c="${esc(r.cliente)}" data-id="${esc(r.id)}" title="${esc(nf)} · ${esc(C.eur(r.importe))} · venció el ${esc(corto(r.vence))}">${avs}${cuando(x, R)}<span class="pp-afoto vacia">${ICO.euro}</span><span class="pp-nm"><b>${esc(nf)} · ${esc(C.eur(r.importe))}</b> <i>${quien}</i></span><span class="pp-est">Retrasada ${x.dias} ${x.dias === 1 ? 'día' : 'días'} · sin cobrar</span></button>`;
    }
    if (x.tipo === 'historias') {
      const cu = x.dia === R.hoy ? 'hoy' : x.dia === R.man ? 'mañana' : 'el ' + corto(x.dia);
      return `<button type="button" class="pp-av" data-pp="hs" data-key="${esc(x.B.key)}" title="${x.n} ${x.n === 1 ? 'historia' : 'historias'} ${cu} · ${x.sin} sin programar">${avs}${cuando(x, R)}${mini(x)}<span class="pp-nm"><b>${x.sin} ${x.sin === 1 ? 'historia' : 'historias'}${x.cat === 'hoy' || x.cat === 'man' ? ' ' + cu : ''} sin programar</b> <i>${quien}</i></span><span class="pp-est"></span></button>`;
    }
    let est = `${I().estIco(x.e, ' aria-hidden="true"')}${esc(estLbl(x.e))}`;
    if (x.mano) est = `<span class="pp-mano">publicar a mano</span>`;
    if (x.aMano) est += ` <span class="pp-por">· se programa a mano</span>`;   // D-181: its state stays, as the reasons of a wait
    if (x.cat === 'espera') { const r = [], w = M.web && M.web.contestado ? M.web.contestado(x.B.client, x.s.id) : ''; if (w) r.push(`<b class="pp-web">${esc(w)} en su web</b>`); if (x.pronto) { const n = difD(R.hoy, x.dia); r.push(n === 1 ? 'sale mañana' : `sale en ${n} días`); } if (x.lleva) r.push(`lleva ${x.lleva} días`); est += ` <span class="pp-por">· ${r.join(' · ')}</span>`; }
    // not scheduled yet in «Hoy y mañana» or «Se ha pasado»: a mark that stands out, louder once it passed (D-190); reels too;
    // today's, louder than tomorrow's: the row tinted amber, its band, time and state in --chg (D-222); by row, as «Hoy» and
    // «Mañana» share the group. The rule is the core's (marcaDe, D-300)
    return `<button type="button" class="pp-av${mk}" data-pp="abrir" data-key="${esc(x.B.key)}" data-slot="${esc(x.s.id)}" title="${esc(x.s.name)} · ${esc(tipoTxt(x.s))} · ${esc(corto(x.dia))}${x.hora ? ' ' + esc(x.hora) : ''}">${avs}${cuando(x, R)}${mini(x)}<span class="pp-nm"><b>${esc(x.s.name)}</b> <i>${quien}</i></span><span class="pp-est">${est}</span></button>`;
  }
  const esReunion = k => !!(k && k.sesion && k.sesion.clase === 'reunion');   // a meeting (D-291): its own drawing
  // what an agreement to renegotiate says under its title: when, and what it covers (D-288)
  function acuerdoCuando(x) {
    const C = I().cob, n = x.n, cu = n === 0 ? 'hoy' : n === 1 ? 'mañana' : n > 1 ? `en ${n} días` : n === -1 ? 'ayer' : `hace ${-n} días`;
    const fin = C.fin ? C.fin(x.a) : '', ult = C.vivos(x.c.id).filter(r => C.MES.test(r.periodo || '')).map(r => C.hasta(r)).sort().pop();
    const fc = C.finCiclo ? C.finCiclo(x.a, I().hoy().slice(0, 7)) : fin;   // the cycle in course (a renewed one, too)
    const ch = x.a.cubreHasta || '';   // «Termina en» or the next agreement first: it ends there, it doesn't renew (revisión del lote B)
    const cubre = ch && (!fin || ch <= fc || !x.a.renueva) ? `acaba en ${C.mesCorto(ch)}` : fin ? (x.a.renueva && x.a.pago !== 'unico' ? `se renueva el 1 ${C.mesCorto(I().addMonths(fc, 1))}` : `acaba en ${C.mesCorto(fin)}`) : ult ? `cubre hasta ${C.mesCorto(ult)}` : '';
    return [cu, cubre].filter(Boolean).join(' · ');
  }
  // «Hoy N» the group's title and «Mañana N» under it; nothing today and something tomorrow: «Nada para hoy»; with the figure
  // «Hoy» only today's, with «Mañana» only tomorrow's (D-212)
  function avisos(R) {
    const f = st.filtro, sinH = l => l.filter(x => !x.hecha).length;
    const filas = (c, l) => { const todo = st.abiertos.has(c) || f === c, mas = l.length - TOPE;
      return (todo || mas <= 0 ? l : l.slice(0, TOPE)).map(x => aviso(x, R)).join('') + (!todo && mas > 0 ? `<button type="button" class="pp-mas" data-pp="mas" data-c="${c}">${mas} más</button>` : ''); };
    const grupo = (c, t, n, cuerpo) => `<section class="pp-grupo" data-cat="${c}"><h3 class="pp-gt">${t}${n == null ? '' : ` <span>${n}</span>`}</h3><div class="pp-lista">${cuerpo}</div></section>`;
    const html = GRUPOS.map(([c, t]) => {
      if (c === 'hoy') {
        const h = R.items.filter(x => x.cat === 'hoy'), m = R.items.filter(x => x.cat === 'man');
        if (f === 'man') return m.length ? grupo('hoy', 'Mañana', sinH(m), filas('man', m)) : '';
        if (f && f !== 'hoy') return '';
        if (f === 'hoy' || !m.length) return h.length ? grupo('hoy', t, sinH(h), filas('hoy', h)) : '';
        return grupo('hoy', t, h.length ? sinH(h) : null, (h.length ? filas('hoy', h) : `<p class="pp-nada">Nada para hoy</p>`) + `<p class="pp-sub">Mañana <span>${sinH(m)}</span></p>` + filas('man', m));
      }
      if (f && f !== c) return '';
      const l = R.items.filter(x => x.cat === c); if (!l.length) return '';
      return grupo(c, t, sinH(l), filas(c, l));
    }).join('');
    // the cloud's activity notices (nube.js, D-257): one line each, first, without a figure of their own (as D-236)
    const nube = !f && M.nube && M.nube.avisosHTML ? M.nube.avisosHTML() : '';
    return (nube + html) || `<p class="pp-orden">Todo en orden</p>`;
  }
  function paso(B, m, p) {                     // the month's steps as a line of 6, its state above, both in its colour (A3d)
    const mes = `<span class="pp-mes">${MES[+m.slice(5, 7) - 1]}</span>`;
    if (!B) return `<span class="pp-pasos sin">${mes}<span class="pp-sin">sin tablero</span></span>`;
    const P = I().PASOS, i = Math.max(0, P.findIndex(x => x[0] === p)), lab = esc(P[i][1]);
    return `<span class="pp-pasos" title="${esc(MESL[+m.slice(5, 7) - 1])}: ${lab} (paso ${i + 1} de ${P.length})">${mes}<span class="pp-lc"><span class="pp-ll" data-e="${p}">${I().estIco(p, ' aria-hidden="true"')}${lab}</span><span class="pp-bar" data-e="${p}" aria-hidden="true">${P.map((x, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span></span></span>`;
  }
  // a «Solo contenido» month (D-290): how many of its deliveries went out, instead of the steps of a feed
  function pasoEnt(x) {
    const mes = `<span class="pp-mes">${MES[+x.m.slice(5, 7) - 1]}</span>`, e = x.ent || { n: 0, h: 0 };
    return `<span class="pp-pasos sin">${mes}<span class="pp-sin">${e.n ? `${e.h} de ${e.n} ${e.n === 1 ? 'entregada' : 'entregadas'}` : 'sin entregas'}</span></span>`;
  }
  function tira(f, R) {
    return `<span class="pp-tira${st.modo === 'mes' ? ' mes' : ''}" style="--n:${f.dias.length}">${f.dias.map(x => {
      const dots = '<i class="pp-dot f"></i>'.repeat(x.f) + '<i class="pp-dot c"></i>'.repeat(x.c) + '<i class="pp-dot r"></i>'.repeat(x.r) + '<i class="pp-dot e"></i>'.repeat(x.e || 0) + (x.h ? '<i class="pp-dot h"></i>' : '') + (x.t ? '<i class="pp-dot t"></i>' : '');
      const tit = [corto(x.d), ...x.nombres, x.h ? x.h + (x.h === 1 ? ' historia' : ' historias') : '', x.t ? x.t + (x.t === 1 ? ' tarea' : ' tareas') : ''].filter(Boolean).join(' · ');
      return `<span class="pp-dia${x.d === R.hoy ? ' hoy' : ''}${x.d < R.hoy ? ' pas' : ''}" title="${esc(tit)}">${dots}</span>`; }).join('')}</span>`;
  }
  function cabDias(R) {
    return `<span class="pp-cab pp-tira${st.modo === 'mes' ? ' mes' : ''}" style="--n:${R.V.dias.length}" aria-hidden="true">${R.V.dias.map(d => `<span class="${d === R.hoy ? 'hoy' : ''}">${st.modo === 'mes' ? (+d.slice(8, 10) % 7 === 1 || d === R.hoy ? +d.slice(8, 10) : '') : `${INI[dow(d)]}<b>${+d.slice(8, 10)}</b>`}</span>`).join('')}</span>`;
  }
  function cuentas(f) {
    const a = [];
    if (f.cont && f.ents) a.push(`${f.ents} ${f.ents === 1 ? 'entrega' : 'entregas'}${f.entSin ? ` · ${f.entSin} sin entregar` : ''}`);   // D-290
    if (f.pubs) a.push(`${f.pubs} ${f.pubs === 1 ? 'publicación' : 'publicaciones'}${f.pubSin ? ` · ${f.pubSin} sin programar` : ''}`);
    if (f.hs) a.push(`${f.hs} ${f.hs === 1 ? 'historia' : 'historias'}${f.hsSin ? ` · ${f.hsSin} sin programar` : ''}`);
    if (f.tareas) a.push(`${f.tareas} ${f.tareas === 1 ? 'tarea' : 'tareas'}`);
    return `<span class="pp-cuentas">${a.map(x => `<span>${x}</span>`).join('')}</span>`;
  }
  function bloque(f, R, hueco) {
    const m = f.meses[0];
    return `<div class="pp-bw" data-c="${esc(f.c.id)}"><button type="button" class="pp-blq" data-pp="cliente" data-c="${esc(f.c.id)}"${m.B && !f.cont ? ` data-key="${esc(m.B.key)}"` : ''}><span class="pp-l1"><span class="pp-quien">${avatar(f.c.id)}<span class="pp-cn">${esc(f.c.name)}</span></span>${cuentas(f)}</span>`
      + `<span class="pp-l2">${f.meses.map(x => f.cont ? pasoEnt(x) : paso(x.B, x.m, x.paso)).join('')}</span>${tira(f, R)}</button>${cobLinea(f.c.id, f.c.name, hueco)}</div>`;
  }
  // a client's payment that matters most, under its block (D-235): retrasada before pendiente, pendiente before sin emitir;
  // all paid, the last one; a click opens its «Cobros». hueco: another block of the row has one, the same height stays
  function cobLinea(cid, nombre, hueco) {
    const C = I().cob, u = C && C.urgente(cid); if (!u) return hueco ? '<span class="pp-cob vacia" aria-hidden="true"></span>' : '';
    const { r, e } = u, imp = C.eur(r.importe), d = x => C.corto(x) + (x && x.slice(0, 4) !== I().hoy().slice(0, 4) ? ' ' + x.slice(0, 4) : '');
    const [cls, ico, txt] = e.k === 'retrasada' ? ['tarde', ICO.alerta, `Retrasada ${e.dias} ${e.dias === 1 ? 'día' : 'días'} · ${imp}`]
      : e.k === 'pendiente' ? ['pend', ICO.reloj, `Pendiente · ${imp}${r.vence ? ' · vence el ' + d(r.vence) : ''}`]
      : e.k === 'sinemitir' ? ['sin', ICO.libre, `Factura sin emitir · ${imp}${r.tarde ? ' · con retraso' : ''}`]   // its day passed (D-304)
      : ['ok', ICO.hecho, `Cobrada · ${imp} · ${d(r.cobrada)}`];
    return `<button type="button" class="pp-cob ${cls}" data-pp="cobro" data-c="${esc(cid)}" title="Cobros de ${esc(nombre)}">${ico}<span>${esc(txt)}</span></button>`;
  }
  const conCob = l => { const C = I().cob; return !!(C && l.some(id => C.urgente(id))); };
  // Kevin's sums in the header of Clientes, monthly and sporadic whatever the selector says: paid this month, pending of any
  function ingresos() {
    const C = I().cob, t = C && C.totales(null, id => !!cliDe(id)); if (!t || !t.hay) return '';
    return `<span class="pp-ing" title="Cobrado este mes y pendiente de cobrar">${ICO.euro}<span><b>${esc(C.eur(t.cobrado))}</b> cobrado</span><span><b>${esc(C.eur(t.pendiente))}</b> pendiente</span></span>`;
  }
  const cabPlg = (k, t, n, pl) => `<button type="button" class="pp-fold" data-pp="plegar" data-p="${k}" aria-expanded="${!pl}" title="${pl ? 'Desplegar' : 'Plegar'} ${t.toLowerCase()}"><b>${t}</b>${n ? `<span>${n}</span>` : ''}</button>`;

  // ---------- tasks and notes ----------
  const vivos = () => [...TK.values()].filter(k => !k._b);   // what is made (a new task still being written isn't, D-203)
  const tareas = () => vivos().filter(k => k.tipo === 'tarea');
  const sesiones = () => vivos().filter(k => k.tipo === 'sesion');   // a session goes where a task goes (D-206)
  const enLista = () => vivos().filter(k => k.tipo === 'tarea' || k.tipo === 'sesion');
  const notas = () => vivos().filter(k => k.tipo === 'nota').sort((a, b) => String(a.creada).localeCompare(String(b.creada)));
  const cliOk = id => !!cliDe(id);
  // the clients of a dropdown: the monthly ones and, apart, the sporadic ones (D-207)
  const opcionesCli = (sel, CL) => { const E = esps(), o = c => `<option value="${esc(c.id)}"${sel === c.id ? ' selected' : ''}>${esc(c.name || c.txt)}</option>`;
    return `<option value="">Sin cliente</option>` + (E.length ? `<optgroup label="Mensuales">${CL.map(o).join('')}</optgroup><optgroup label="Esporádicos">${E.map(o).join('')}</optgroup>` : CL.map(o).join('')); };
  const hechaHoy = (k, hoy) => !!k.hecha && I().localDay(k.hecha) >= hoy;
  const RANGO = { sem: ['1 semana', '1S'], '1m': ['1 mes', '1M'], '2m': ['2 meses', '2M'], '3m': ['3 meses', '3M'] };
  function alcance(hoy) {                      // back and ahead from today
    if (st.alcance === 'sem') return [addD(hoy, -7), addD(hoy, 7)];
    const n = +st.alcance.charAt(0), dd = hoy.slice(7);
    const lim = (m, d) => { const f = finMes(m); return (m + d) > f ? f : m + d; };
    return [lim(I().addMonths(hoy.slice(0, 7), -n), dd), lim(I().addMonths(hoy.slice(0, 7), n), dd)];
  }
  const barraPg = (h, n) => `<span class="pp-pb" aria-hidden="true"><i style="width:${(h / n * 100).toFixed(1)}%"></i></span>`;
  const fotosURL = f => { if (!f || !(f.mini instanceof Blob)) return ''; let u = MINI.get(f.id); if (!u) { u = URL.createObjectURL(f.mini); MINI.set(f.id, u); } return u; };
  function tareasHTML(R) {
    const X = I(), hoy = R.hoy, todas = enLista(), fin = addD(hoy, 6);
    const conT = [...R.filas.map(f => f.c), ...esps().map(e => ({ id: e.id, name: e.txt }))].filter(c => vivos().some(k => conCli(k, c.id) && k.tipo !== 'esporadico' && !(k.hecha && X.localDay(k.hecha) < hoy)));   // the clients with tasks, sessions or notes (a sporadic one too, D-207)
    if (st.tcli && !conT.some(c => c.id === st.tcli)) st.tcli = null;
    const l = todas.filter(k => !st.tcli || conCli(k, st.tcli));
    const venc = k => !k.hecha && k.fecha && ultDia(k) < hoy;   // a session, once its last day passed (D-218)
    const diaTxt = d => d === hoy ? 'hoy' : d > hoy && d <= fin ? `${DS[dow(d)]} ${+d.slice(8, 10)}` : corto(d);
    const ck = k => `<input type="checkbox" class="pp-ck" data-pp="ck" data-id="${esc(k.id)}"${k.hecha ? ' checked' : ''} aria-label="Hecha">`;
    const ver = k => `data-pp="tver" data-id="${esc(k.id)}" tabindex="0" role="button"`;   // a click or Enter opens it big (D-182)
    // its details, an icon; its subtasks, a thin bar with how many are done (D-183); without them the line doesn't change
    const mas = (k, tt) => { const n = (k.subtareas || []).length, h = n ? k.subtareas.filter(x => x.hecha).length : 0, d = !!String(k.detalles || '').trim();
      if (!n && !d) return tt;
      return `<span class="pp-col"><span class="pp-tl">${tt}${d ? `<span class="pp-tdet" title="Con detalles">${ICO.texto}</span>` : ''}</span>${n ? `<span class="pp-pg${h === n ? ' todo' : ''}" title="${h} de ${n} subtareas hechas">${barraPg(h, n)}${h}/${n}</span>` : ''}</span>`; };
    const av = k => st.tcli ? '' : avatarN(clis(k).filter(cliOk));
    const fotos = (k, cls = '') => (k.fotos || []).length ? `<button type="button" class="pp-tfo ${cls}" data-pp="foto" data-id="${esc(k.id)}" title="${k.fotos.length === 1 ? 'Ver la foto' : `Ver las ${k.fotos.length} fotos`}" aria-label="Ver la foto"><img src="${fotosURL(k.fotos[0])}" alt="">${k.fotos.length > 1 ? `<b>${k.fotos.length}</b>` : ''}</button>` : '';
    // a session: as a task, with the clapperboard and its time (never tabular figures, D-175)
    const ses = k => k.tipo === 'sesion' ? (esReunion(k) ? `<span class="pp-tses" title="Reunión">${ICO.reunion}</span>` : `<span class="pp-tses" title="Sesión">${ICO.sesion}</span>`) : '';
    const hora = k => k.tipo === 'sesion' && k.hora ? ` · ${esc(k.hora)}` : '';
    const linea = (k, fecha = true) => `<div class="pp-tk${k.hecha ? ' hecha' : ''}${k.tipo === 'sesion' ? ' ses' : ''}${mkCls(marcaT(k, hoy))}" data-tid="${esc(k.id)}">${ck(k)}${ses(k)}${mas(k, `<span class="pp-tt" ${ver(k)}>${esc(k.txt)}</span>`)}${k.tipo === 'sesion' ? '' : fotos(k)}${fecha && k.fecha ? `<span class="pp-tf${venc(k) ? ' rojo' : ''}">${k.tipo === 'sesion' && k.fin ? esc(tramo(k, diaTxt)) : diaTxt(k.fecha) + hora(k)}</span>` : !fecha && k.hora ? `<span class="pp-tf">${esc(k.hora)}</span>` : ''}${av(k)}</div>`;
    let celda = null;                          // the day being drawn (Semana): an overdue task from before says its date
    // a session of several days goes on: square corners where it continues, by its real days (D-231)
    const sigue = (k, d) => k.tipo === 'sesion' && d && enTramo(k, d) && ultDia(k) > k.fecha ? `${k.fecha < d ? ' sigue-i' : ''}${d < ultDia(k) ? ' sigue-d' : ''}` : '';
    const ficha = k => `<div class="pp-fi${k.hecha ? ' hecha' : ''}${venc(k) ? ' venc' : ''}${k.tipo === 'sesion' ? ' ses' : ''}${sigue(k, celda)}${mkCls(marcaT(k, hoy))}" data-tid="${esc(k.id)}">${ck(k)}${ses(k)}${mas(k, `<span class="pp-tt" ${ver(k)}>${k.tipo === 'sesion' && k.hora && (!celda || celda === k.fecha) ? `<em>${esc(k.hora)}</em> ` : ''}${esc(k.txt)}${venc(k) && k.fecha !== celda ? ` <i>${esc(corto(k.fecha))}</i>` : ''}</span>`)}${k.tipo === 'sesion' ? '' : fotos(k, 'mini')}${av(k)}</div>`;
    const cli = st.tcli ? cliDe(st.tcli) : null, N = st.nueva;
    const pend = N.fotos.length ? `<span class="pp-tfo pp-npend"><img src="${fotosURL(N.fotos[0])}" alt="">${N.fotos.length > 1 ? `<b>${N.fotos.length}</b>` : ''}</span>` : '';
    const nfecha = `<span class="pp-ncampo${N.fecha ? '' : ' vacio'}" data-k="fecha"><input type="date" class="pp-nfecha" data-sin-fecha value="${esc(N.fecha)}" aria-label="Fecha de la tarea"></span>`;
    const ncli = cli ? '' : `<span class="pp-ncampo${N.cliente ? '' : ' vacio'}" data-k="cliente"><select class="pp-ncli" aria-label="Cliente de la tarea">${opcionesCli(N.cliente, R.filas.map(f => f.c))}</select></span>`;
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
      const lf = l.filter(k => k.fecha && (venc(k) || (st.ttodas ? en(k.fecha) : ((!k.hecha && k.fecha <= r1 && ultDia(k) >= hoy) || (hechaHoy(k, hoy) && k.fecha <= r1))))).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.hora || '').localeCompare(String(b.hora || '')) || String(a.creada).localeCompare(String(b.creada)));
      barra = `<span class="pp-tsw"><div class="seg pp-rg" role="group" aria-label="Hasta dónde">${Object.keys(RANGO).map(k => `<button type="button" class="${st.alcance === k ? 'on' : ''}" data-pp="alcance" data-r="${k}" aria-pressed="${st.alcance === k}" title="${RANGO[k][0]} atrás y adelante">${RANGO[k][1]}</button>`).join('')}</div>${sw}</span>`;
      izq = lf.length ? `<div class="pp-lista">${lf.map(k => linea(k)).join('')}</div>` : `<p class="pp-orden">${l.some(k => k.fecha) ? 'Nada con fecha aquí' : 'Ninguna con fecha'}</p>`;
      const sinV = l.filter(k => !k.fecha && (st.ttodas ? (!k.hecha || en(X.localDay(k.hecha))) : (!k.hecha || hechaHoy(k, hoy))));
      if (sinV.length) der = `<div class="pp-sinf"><p class="pp-sub">Sin fecha <span>${sinV.filter(k => !k.hecha).length}</span></p><div class="pp-lista">${sinV.map(k => linea(k, false)).join('')}</div></div>`;
    } else {
      const ver = k => st.ttodas || !k.hecha || hechaHoy(k, hoy);
      // today's cell also holds the overdue ones from before what is seen (those seen are on their own day)
      const enDia = (d, desde) => l.filter(k => enTramo(k, d) && ver(k)).concat(desde ? l.filter(k => venc(k) && ultDia(k) < desde).sort((a, b) => a.fecha < b.fecha ? -1 : 1) : []);
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
          return `<div class="pp-md${d === hoy ? ' hoy' : ''}${fuera ? ' fuera' : ''}"><span class="pp-mn">${+d.slice(8, 10)}</span>${ks.slice(0, 2).map(k => `<span class="pp-mt${k.hecha ? ' hecha' : ''}${venc(k) ? ' venc' : ''}${k.tipo === 'sesion' ? ' ses' : ''}${sigue(k, d)}${mkCls(marcaT(k, hoy))}" data-tid="${esc(k.id)}" ${ver(k)} title="${k.tipo === 'sesion' ? 'Sesión: ' : ''}${esc(k.txt)}${k.tipo === 'sesion' && k.fin ? ' · ' + esc(tramo(k)) : k.hora ? ' · ' + esc(k.hora) : ''}${venc(k) ? ' · ' + esc(corto(k.fecha)) : ''}">${k.tipo === 'sesion' ? ICO.sesion + (k.hora && k.fecha === d ? `<span class="pp-mh">${esc(k.hora)}</span> ` : '') : (k.fotos || []).length ? `<img src="${fotosURL(k.fotos[0])}" alt="">` : ''}${esc(k.txt)}${(k.subtareas || []).length ? ` · ${k.subtareas.filter(x => x.hecha).length}/${k.subtareas.length}` : ''}</span>`).join('')}${ks.length > 2 ? `<span class="pp-mm">${ks.length - 2} más</span>` : ''}</div>`; }).join('')}</div></div>`;
      }
    }
    const ns = st.vista === 'lista' ? notas().filter(n => st.tcli ? n.cliente === st.tcli : !n.cliente) : [];
    // the small post-it draws the marks without using them: a click opens the note (D-202)
    const pn = ns.length ? `<div class="pp-pn">${ns.map(n => `<div class="pp-pt" data-nid="${esc(n.id)}" ${ver(n)} aria-label="Nota: ${esc(n.txt)}"><div class="pp-ptx">${leerTxt(n.txt, { casillas: 'no' })}</div></div>`).join('')}</div>` : '';
    return `<div class="pp-pc">${nueva}<div class="pp-tfila">${filtro}${barra}</div>${pn}<div class="pp-tv${der ? ' dos' : ''}"><div class="pp-tvi">${izq}</div>${der}</div></div>`;
  }
  const segVista = () => `<div class="seg pp-tvs" role="group" aria-label="Vista de las tareas">${[['lista', 'Lista'], ['semana', 'Semana'], ['mes', 'Mes']].map(([k, l]) => `<button type="button" class="${st.vista === k ? 'on' : ''}" data-pp="tvista" data-v="${k}" aria-pressed="${st.vista === k}">${l}</button>`).join('')}</div>`;
  // «Mensuales · Esporádicos» in the head of «Clientes» (E2, D-207), the same piece as «Lista · Semana · Mes» (D-199)
  const segCli = (nm, ne) => `<div class="seg pp-tvs pp-tcv" role="group" aria-label="Clientes">${[['mensuales', 'Mensuales', nm], ['esporadicos', 'Esporádicos', ne]].map(([k, l, n]) => `<button type="button" class="${st.cvista === k ? 'on' : ''}" data-pp="cvista" data-v="${k}" aria-pressed="${st.cvista === k}">${l} <span>${n}</span></button>`).join('')}</div>`;
  const diaHora = (d, h) => `${DS[dow(d)]} ${+d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]}${d.slice(0, 4) !== I().hoy().slice(0, 4) ? ' ' + d.slice(0, 4) : ''}${h ? ' · ' + h : ''}`;
  // a session's end (D-218): `fin: {fecha, hora?}`; its last day, its when with the end and its start moved keeping the length
  const ultDia = k => k && k.tipo === 'sesion' && k.fin && k.fin.fecha > (k.fecha || '') ? k.fin.fecha : k && k.fecha;
  const enTramo = (k, d) => k.fecha === d || (k.tipo === 'sesion' && !!k.fecha && k.fecha < d && d <= ultDia(k));
  function tramo(k, dia = diaHora) {           // «sáb 21 nov · 10:30 – 12:30», «… – dom 22 nov · 18:00», «sáb 21 nov – dom 22 nov»
    if (!k.fecha) return '';
    const f = k.fin, a = dia(k.fecha) + (k.hora ? ' · ' + k.hora : '');
    if (!f || !f.fecha || (f.fecha === k.fecha && !f.hora)) return a;
    return f.fecha === k.fecha ? `${a} – ${f.hora}` : `${a} – ${dia(f.fecha)}${f.hora ? ' · ' + f.hora : ''}`;
  }
  const minDe = h => +h.slice(0, 2) * 60 + +h.slice(3, 5), hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  function correr(fecha, hora, min) { const t = minDe(hora) + min, d = Math.floor(t / 1440); return { fecha: addD(fecha, d), hora: hhmm(t - d * 1440) }; }
  // into a copy of the record: the start to `fecha` (and `hora`, if given); the end keeps the length; no start, no end
  function moverInicio(x, fecha, hora) {
    const f0 = x.fecha || '', h0 = x.hora || ''; if (hora === undefined) hora = h0;
    if (!fecha) { delete x.fecha; delete x.fin; if (hora) x.hora = hora; else delete x.hora; return; }
    if (x.fin && x.fin.fecha && f0) {
      const dd = difD(f0, fecha);
      if (h0 && hora && x.fin.hora) x.fin = correr(x.fin.fecha, x.fin.hora, dd * 1440 + minDe(hora) - minDe(h0));
      else { x.fin = { ...x.fin, fecha: addD(x.fin.fecha, dd) }; if (!hora) delete x.fin.hora; }
    }
    x.fecha = fecha; if (hora) x.hora = hora; else delete x.hora;
    if (x.fin && x.fin.fecha <= fecha && !x.fin.hora) delete x.fin;   // its own day without a time says nothing
  }
  // a new end (or none): never before its start (D-218)
  const finOk = (x, f) => !f || (!!x.fecha && !!f.fecha && (f.fecha > x.fecha || (f.fecha === x.fecha && (!f.hora || !x.hora || f.hora >= x.hora))));
  const finNuevo = x => x.hora ? correr(x.fecha, x.hora, 60) : { fecha: addD(x.fecha, 1) };   // with a time, an hour after; without, the next day
  // a sporadic client's block: its initial in a neutral circle, its name, its sessions (the last one), its tasks and notes and its
  // next session in a band; a click opens its file (sesiones.js)
  function espHTML(cols) {
    const hoy = I().hoy(), E = esps(), hueco = conCob(E.map(e => e.id));
    const bl = E.map(e => {
      const ss = sesiones().filter(k => conCli(k, e.id)), ts = tareas().filter(k => k.cliente === e.id && !k.hecha), ns = notas().filter(k => k.cliente === e.id);
      const pas = ss.filter(k => k.fecha && k.fecha <= hoy).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0], sig = ss.filter(k => k.fecha && k.fecha >= hoy && !k.hecha).sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? -1 : 1)[0];
      const c1 = ss.length ? `${ss.length} ${ss.length === 1 ? 'sesión' : 'sesiones'}${pas ? ` · la última, ${diaHora(pas.fecha).replace(/ \d{4}$/, '')}` : ''}` : '';
      const c2 = [ts.length ? `${ts.length} ${ts.length === 1 ? 'tarea' : 'tareas'}` : '', ns.length ? `${ns.length} ${ns.length === 1 ? 'nota' : 'notas'}` : ''].filter(Boolean).join(' · ');
      const b = `<button type="button" class="pp-blq pp-esb" data-pp="esp" data-id="${esc(e.id)}" title="${esc(e.txt)}"><span class="pp-l1"><span class="pp-quien">${avatar(e.id)}<span class="pp-cn">${esc(e.txt)}</span></span><span class="pp-cuentas">${c1 ? `<span>${esc(c1)}</span>` : ''}${c2 ? `<span>${esc(c2)}</span>` : ''}</span></span>`
        + (sig ? `<span class="pp-esf">${ICO.sesion}<b>${esc(sig.txt)}</b><span>${esc(diaHora(sig.fecha, sig.hora))}</span></span>` : '') + `</button>`;
      return `<div class="pp-bw" data-c="${esc(e.id)}">${b}${cobLinea(e.id, e.txt, hueco)}</div>`;
    }).join('');
    return `<div class="pp-pc">${E.length ? `<div class="pp-bgrid pp-esg${cols > 2 ? ' estrecha' : ''}" style="--cols:${cols}">${bl}</div>` : ''}<button type="button" class="pp-cmas pp-esn" data-pp="esp-nuevo">${ICO.mas}Esporádico</button></div>`;
  }
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
    const nTar = enLista().filter(k => !k.hecha).length, nAv = R.cifras.pasado + R.cifras.hoy + R.cifras.man + R.cifras.espera + R.cifras.falta + (M.nube && M.nube.avisosN ? M.nube.avisosN() : 0), nE = esps().length;
    const P = [
      { k: 'tareas', t: 'Tareas', n: nTar, cls: 'pp-tareas', extra: segVista, html: () => tareasHTML(R) },
      { k: 'clientes', t: 'Clientes', n: R.filas.length, sinN: true, cls: 'pp-clientes', extra: segFila, tras: () => segCli(R.filas.length, nE), medio: ingresos,
        html: () => st.cvista === 'esporadicos' ? espHTML(Math.max(1, Math.min(st.fila, nE || 1, caben())))
          : R.filas.length ? `<div class="pp-pc"><div class="pp-bcab" style="--cols:${cols}" aria-hidden="true">${Array.from({ length: cols }, () => cabDias(R)).join('')}</div><div class="pp-bgrid${cols > 2 || (anchoClientes() - (cols - 1) * 8) / cols < 380 ? ' estrecha' : ''}" style="--cols:${cols}">${(h => R.filas.map(f => bloque(f, R, h)).join(''))(conCob(R.filas.map(f => f.c.id)))}</div></div>` : '<div class="pp-pc"><p class="pp-orden">Sin clientes</p></div>' },
      { k: 'avisos', t: 'Avisos', n: nAv }
    ];
    const arriba = P.filter(x => pl[x.k]), izq = P.filter(x => !pl[x.k] && x.k !== 'avisos'), rail = !pl.avisos;
    const cls = !rail ? ' sin-rail' : !izq.length ? ' solo-rail' : '';
    return `<div class="pp-in${cls}"><div class="pp-top">${cifras(R)}${periodo(R)}</div>`
      + `<div class="pp-izq">${arriba.length ? `<div class="pp-tabs">${arriba.map(x => `<section class="pp-plg fold" data-panel="${x.k}">${cabPlg(x.k, x.t, x.n, true)}</section>`).join('')}</div>` : ''}`
      + izq.map(x => `<section class="${x.cls} pp-plg" data-panel="${x.k}"><div class="pp-phr"><span class="pp-phl"><h2 class="pp-ph">${cabPlg(x.k, x.t, x.sinN ? 0 : x.n, false)}</h2>${x.tras ? x.tras() : ''}</span>${x.medio ? x.medio() : ''}${x.extra()}</div>${x.html()}</section>`).join('') + `</div>`
      + (rail ? `<aside class="pp-rail"><div class="pp-avisos pp-plg" data-panel="avisos"><div class="pp-phr"><h2 class="pp-ph">${cabPlg('avisos', 'Avisos', nAv, false)}</h2><label class="sw pp-sw"><input type="checkbox" data-pp="avtareas"${st.avTareas ? ' checked' : ''}> Tareas</label></div><div class="pp-grupos">${avisos(R)}</div></div></aside>` : '') + `</div>`;
  }

  // ---------- drawing: from what was read (sync), and reading again (async) ----------
  let R = null, ultimo = '';
  function pintar(R0) {
    if (!st.on || !page || !D) { if (CARD && CARD.tablero) pintarCard(); return; }   // a session's sheet over the board (D-219)
    R = R0 || calcular(D);
    const html = pagina(R);
    if (html === ultimo && page.firstChild) { pintarCard(); return; }   // nothing changed: what is open (a dropdown, a caret, a composition) stays; the card follows its record
    ultimo = html;
    // what is being typed survives the drawing: the new task's text, the caret, the focus
    const a = document.activeElement, enPag = a && page.contains(a);
    const clave = enPag ? (a.dataset.pp ? `[data-pp="${a.dataset.pp}"]${a.dataset.id ? `[data-id="${CSS.escape(a.dataset.id)}"]` : ''}${a.dataset.k ? `[data-k="${CSS.escape(a.dataset.k)}"]` : ''}${a.dataset.c != null ? `[data-c="${CSS.escape(a.dataset.c)}"]` : ''}${a.dataset.v ? `[data-v="${CSS.escape(a.dataset.v)}"]` : ''}${a.dataset.r ? `[data-r="${CSS.escape(a.dataset.r)}"]` : ''}${a.dataset.n ? `[data-n="${CSS.escape(a.dataset.n)}"]` : ''}${a.dataset.p ? `[data-p="${CSS.escape(a.dataset.p)}"]` : ''}` : null) : null;
    const inp = page.querySelector('[data-pp="nueva"]'), txt = inp ? inp.value : '', sel = inp && a === inp ? [inp.selectionStart, inp.selectionEnd] : null;
    const y = page.scrollTop;
    morfar(page, html);                        // in place: nothing runs its entrance again nor is drawn again (D-223)
    if (M.controles && M.controles.mejorar) M.controles.mejorar(page);
    const n = page.querySelector('[data-pp="nueva"]'); if (n && txt) n.value = txt;
    if (n && ES() && ES().enCampo) ES().enCampo(n, { comandos: () => (EXT.sesion && EXT.sesion.nueva ? ['sesion'] : []), alComando: (k, ctx) => comando(k, ctx, 'nueva') });
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
  const ocupada = () => notaEnCurso() || componiendo || !!menu || !!(ES() && ES().menuAbierto()) || !!(M.controles && M.controles.abierto && M.controles.abierto() && page && page.contains(M.controles.abierto().de));
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
    if (b) { const cli = root.classList.contains('client'); if (cli) { b.removeAttribute('title'); b.removeAttribute('aria-label'); b.tabIndex = -1; } else { b.title = X.AYUDA_LOGO || 'Página personal'; b.setAttribute('aria-label', 'Página personal'); b.tabIndex = 0; } if (st.on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }   // its title, the right click's copies too (D-263)
  }
  function abrir() {
    const X = I(), root = X && X.root && X.root(); if (!root || !X.shellReady() || root.classList.contains('client')) return false;
    if (M.libre && M.libre.abierto && M.libre.abierto()) return false;   // the editor covers the mesa: it is closed with its own buttons
    if (M.diseno && M.diseno.abierto && M.diseno.abierto()) return false;
    const det = root.querySelector('.detail'); if (det && !det.hidden && X.closeDetail) X.closeDetail();
    if (CARD && CARD.tablero) cerrarCard();    // a session's sheet over the board (D-219)
    // each visit starts the same (D-180): Clientes and Avisos open, the tasks out of Avisos, no figure chosen; Tareas as this tab
    // left it, folded in a new tab (D-225)
    const tg = ssGet(SS_TAREAS);
    st.plg = { ...PLG0, tareas: tg === '0' ? false : tg === '1' ? true : PLG0.tareas }; st.avTareas = false; st.filtro = null; st.abiertos.clear(); st.cvista = 'mensuales';
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
    if (X.curClient === cid && (X.S || (X.contCli && X.contCli() === cid))) cerrar(); else await abrirTablero(() => M.openClient(cid));   // also its page, of a client of «Solo contenido» (D-312)
  }

  // ---------- the iPhone's list of tasks (D-267) ----------
  // What is left to do (also what went past) and what was done today, then what has no date and the notes: each with its group
  // by the same rules as the page's Lista (a session counts to its last day, D-218); the phone only draws it
  function listaMovil() {
    const X = I(), hoy = X.hoy(), man = addD(hoy, 1), venc = k => !k.hecha && !!k.fecha && ultDia(k) < hoy;
    const l = [...enLista().filter(k => venc(k) || !k.hecha || hechaHoy(k, hoy)), ...notas()];
    const ORD = { pasado: 0, hoy: 1, man: 2, despues: 3, sinfecha: 4 };
    return l.map(k => {
      const g = k.tipo === 'nota' || !k.fecha ? 'sinfecha' : venc(k) ? 'pasado' : k.fecha <= hoy ? 'hoy' : k.fecha === man ? 'man' : 'despues';
      const n = (k.subtareas || []).length;
      return { id: k.id, tipo: k.tipo, txt: String(k.txt || ''), fecha: k.fecha || null, hora: k.tipo === 'sesion' ? k.hora || '' : '', fin: k.fecha ? ultDia(k) : null,
        clientes: clis(k).filter(cliOk), hecha: k.hecha || null, venc: venc(k), grupo: g, marca: marcaT(k, hoy), detalles: String(k.detalles || ''), subtareas: n ? { n, hechas: k.subtareas.filter(x => x.hecha).length } : null,
        fotos: (k.fotos || []).length, creada: k.creada || null };
    }).sort((a, b) => ORD[a.grupo] - ORD[b.grupo] || String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.hora).localeCompare(String(b.hora)) || (a.tipo === 'nota') - (b.tipo === 'nota') || String(a.creada || '').localeCompare(String(b.creada || '')));
  }

  // ---------- tasks: saved at once, a step of their own ⌘Z (D-180) ----------
  const H = { u: [], r: [] };                  // steps: [{id, antes, despues}]
  const hondo = o => JSON.parse(JSON.stringify(o));   // a session's part and the list of material: plain data, copied whole (D-206)
  const copia = r => r ? { ...r, ...(r.fotos ? { fotos: r.fotos.slice() } : {}), ...(r.subtareas ? { subtareas: r.subtareas.map(x => ({ ...x })) } : {}), ...(r.sesion ? { sesion: hondo(r.sesion) } : {}), ...(r.lista ? { lista: hondo(r.lista) } : {}), ...(Array.isArray(r.clientes) ? { clientes: r.clientes.slice() } : {}), ...(r.fin ? { fin: { ...r.fin } } : {}) } : null;
  async function escribir(cambios) {           // [{id, despues|null}]
    const X = I();
    gen++;
    for (const c of cambios) { TOCADA.set(c.id, gen); PEND.set(c.id, c.despues || null); if (c.despues) TK.set(c.id, c.despues); else { soltarFotos(TK.get(c.id)); TK.delete(c.id); } }
    let bien = true;
    try { for (const c of cambios) { if (c.despues) await X.idbPut('tareas', c.id, c.despues); else await X.idbDel('tareas', c.id); } }
    catch (e) { bien = false; X.toast('No se pudo guardar la tarea: ' + ((e && e.message) || e)); }
    finally { for (const c of cambios) if (PEND.get(c.id) === (c.despues || null)) PEND.delete(c.id); }
    if (bc) { try { bc.postMessage({ t: 'tareas' }); } catch (e) { /* */ } }
    avisar();
    return bien;   // the phone needs to know (review of lot 4, point 6); the desk already said it in the toast
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
    return escribir(paso.map(p => ({ id: p.id, despues: p.despues })));   // false if IndexedDB failed
  }
  async function deshacer(re, sinCard) {        // sinCard: the card being written in stays as it is (a «/» command undone, D-204)
    if (!puede()) return false;
    const de = re ? H.r : H.u, a = re ? H.u : H.r, paso = de.pop(); if (!paso) return false;
    a.push(paso);
    await escribir(paso.map(p => ({ id: p.id, despues: copia(re ? p.despues : p.antes) })));
    pintar(); if (!sinCard) pintarCard(true); return true;
  }
  const ahoraISO = () => new Date(I().ahora()).toISOString();
  async function nuevaTarea(o = {}) {
    const txt = String(o.txt || '').trim(), tipo = o.tipo === 'nota' ? 'nota' : 'tarea';
    if (!txt && tipo === 'tarea') return null;
    // an id given (the iPhone's operation, D-267): made once — done again, the one already made
    const id0 = typeof o.id === 'string' && /^(tk|nt)[a-z0-9]{6,24}$/.test(o.id) ? o.id : null;
    if (id0 && TK.has(id0)) return copia(TK.get(id0));
    const now = ahoraISO(), r = { id: id0 || nuevoId(tipo === 'nota' ? 'nt' : 'tk'), tipo, txt, creada: now, at: now };
    if (o.fecha && /^\d{4}-\d{2}-\d{2}$/.test(o.fecha) && tipo === 'tarea') r.fecha = o.fecha;
    if (o.cliente && cliDe(o.cliente)) r.cliente = o.cliente;
    if (Array.isArray(o.fotos) && o.fotos.length && tipo === 'tarea') r.fotos = o.fotos.slice();
    return (await hacer([{ id: r.id, despues: r }])) ? r : null;
  }
  const cambiar = (id, f, junta) => { const r = TK.get(id); if (!r) return Promise.resolve(false); const n = f(copia(r)); if (!n) return Promise.resolve(false); n.at = ahoraISO();
    if (r._b) { Object.defineProperty(n, '_b', { value: true, enumerable: false, configurable: true }); TK.set(id, n); return Promise.resolve(true); }   // a new task not made yet (D-203): in memory only
    return hacer([{ id, despues: n }], junta); };
  const marcar = (id, v) => cambiar(id, r => { if (v) r.hecha = ahoraISO(); else delete r.hecha; return r; });
  // the iPhone edits a task or a note field by field (D-272), with the rules of the Mac's card (D-182, D-183): the title (a task's in one
  // line; empty, refused), the date and the client (valid or none), the details (trimmed; empty, none) and each subtask on its own (its id
  // comes with the operation). A note: only its text. Each change, a step of the tasks' ⌘Z. campo(id, campo, sid) is what is there now.
  async function campoTarea(id, campo, sid) {
    await cargarTK(); const r = TK.get(id); if (!r || r._b || !/^(tarea|nota)$/.test(r.tipo)) return { error: 'no existe' };
    if (campo === 'txt') return { v: String(r.txt || '') };
    if (campo === 'fecha') return { v: r.fecha || '' };
    if (campo === 'cliente') return { v: r.cliente || '' };
    if (campo === 'detalles') return { v: String(r.detalles || '') };
    if (campo === 'subtarea') { const y = (r.subtareas || []).find(x => x.id === sid); return { v: y ? { txt: String(y.txt || ''), hecha: !!y.hecha } : null }; }
    return { error: 'campo no válido' };
  }
  async function editarTarea(id, campo, v) {
    if (!puede()) return { error: 'sin turno' };
    await cargarTK(); const r = TK.get(id); if (!r || r._b || !/^(tarea|nota)$/.test(r.tipo)) return { error: 'no existe' };
    const nota = r.tipo === 'nota'; let f = null;
    if (campo === 'txt') { const t = nota ? String(v ?? '').replace(/\s+$/, '') : String(v ?? '').replace(/\s*\n\s*/g, ' ').trim(); if (!t.trim()) return { error: nota ? 'una nota necesita un texto' : 'una tarea necesita un texto' }; f = x => { x.txt = t; return x; }; }
    else if (nota) return { error: 'campo no válido' };
    else if (campo === 'fecha') { if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: 'fecha no válida' }; f = x => { if (v) x.fecha = v; else delete x.fecha; return x; }; }
    else if (campo === 'cliente') { if (v && !cliDe(v)) return { error: 'cliente no válido' }; f = x => { if (v) x.cliente = v; else delete x.cliente; return x; }; }
    else if (campo === 'detalles') { const d = String(v ?? '').replace(/^\s*\n|\s+$/g, ''); f = x => { if (d) x.detalles = d; else delete x.detalles; return x; }; }
    else if (campo === 'subtarea') {
      const o = v || {}, sid = o.sid, t = String(o.txt ?? '').trim();
      if (typeof sid !== 'string' || !/^st[a-z0-9]{2,30}$/.test(sid)) return { error: 'subtarea no válida' };
      if ((o.accion === 'nueva' || o.accion === 'texto') && !t) return { error: 'una subtarea necesita un texto' };
      if (o.accion === 'nueva') f = x => { const l = x.subtareas || []; if (!l.some(y => y.id === sid)) x.subtareas = [...l, { id: sid, txt: t, ...(o.hecha ? { hecha: true } : {}) }]; return x; };
      else if (o.accion === 'quitar') f = x => { const l = (x.subtareas || []).filter(y => y.id !== sid); if (l.length) x.subtareas = l; else delete x.subtareas; return x; };
      else if (o.accion === 'hecha') f = x => { const y = (x.subtareas || []).find(z => z.id === sid); if (!y) return null; if (o.hecha) y.hecha = true; else delete y.hecha; return x; };
      else if (o.accion === 'texto') f = x => { const y = (x.subtareas || []).find(z => z.id === sid); if (!y) return null; y.txt = t; return x; };
      else return { error: 'subtarea no válida' };
    } else return { error: 'campo no válido' };
    if (campo === 'subtarea' && (v.accion === 'hecha' || v.accion === 'texto') && !(r.subtareas || []).some(y => y.id === v.sid)) return { error: 'no existe' };
    return (await cambiar(id, f)) ? { ok: true } : { error: puede() ? 'no se pudo guardar' : 'sin turno' };
  }
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
    if (!(f.blob instanceof Blob)) { X.toast('Esa foto aún no ha llegado a este ordenador: llega en un momento.'); return; }   // lot 4
    const u = URL.createObjectURL(f.blob);
    X.showDialog('pp-foto', `<button class="x" data-act="close" aria-label="Cerrar">×</button><div class="tvwrap"><img class="tvimg" src="${u}" alt=""></div><div class="tvbar"><span class="tvname"><b>${esc(r.txt)}</b> · ${f.w}×${f.h}${r.fotos.length > 1 ? ` · ${i + 1} de ${r.fotos.length}` : ''}</span></div>`);
    const det = X.root().querySelector('.detail'); det.dataset.ppFoto = id;
    const ir = n => { const j = (i + n + r.fotos.length) % r.fotos.length, g = r.fotos[j], img = det.querySelector('.tvimg'), nm = det.querySelector('.tvname'); if (!img) return; if (!(g.blob instanceof Blob)) { I().toast('Esa foto aún no ha llegado a este ordenador: llega en un momento.'); return; } i = j; URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(g.blob); if (nm) nm.innerHTML = `<b>${esc(r.txt)}</b> · ${g.w}×${g.h} · ${i + 1} de ${r.fotos.length}`; };
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
  // the icon that widens the card to the whole page under the mesa's header, and brings it back (D-205); top right, in this
  // order and where they exist: the eye, widen and the × (D-209), 32 px buttons with 18 px icons, side by side, as the mesa's ×
  const ampBtn = () => { const a = !!(CARD && CARD.amplia); return `<button type="button" class="ibtn pp-cb pp-amp" data-pp="ampliar" title="${a ? 'Reducir' : 'Ampliar'}" aria-label="${a ? 'Reducir' : 'Ampliar'}" aria-pressed="${a}">${a ? ICO.reducir : ICO.ampliar}</button>`; };
  const botonesCard = (ojo = '', amp = true) => `<span class="pp-cbs">${ojo}${amp ? ampBtn() : ''}<button type="button" class="ibtn pp-cb pp-cx" data-pp="cerrar" title="Cerrar" aria-label="Cerrar">${ICO.x}</button></span>`;
  function htmlCard(r, ed) {
    const X = I(), ce = ed ? ' contenteditable="plaintext-only" spellcheck="true" role="textbox"' : '', amp = CARD && CARD.amplia ? ' amplia' : '';
    if (r.tipo === 'nota') return `<div class="pp-card nota${ed ? ' ed' : ''}${amp}" role="dialog" aria-modal="true" aria-label="Nota" tabindex="-1">${botonesCard()}<div class="pp-cn" data-pp="cn" data-id="${esc(r.id)}"${ce}${ed ? ' aria-multiline="true" aria-label="Nota"' : ''}>${ed ? esc(r.txt) : leerTxt(r.txt, { enlaces: true })}</div></div>`;
    const venc = !r.hecha && r.fecha && r.fecha < X.hoy(), c = r.cliente ? cliDe(r.cliente) : null;
    const fecha = ed ? `<span class="pp-cmf"><input type="date" class="pp-cfecha" data-sin-fecha data-id="${esc(r.id)}" value="${esc(r.fecha || '')}" aria-label="Fecha de la tarea"></span>`
      : r.fecha ? `<span class="pp-cml${venc ? ' rojo' : ''}" data-pp="lfecha">${ICO.fecha}${esc(fechaLarga(r.fecha))}</span>` : `<span class="pp-cml vacio" data-pp="lfecha">${ICO.fecha}Fecha</span>`;   // read: a click writes and opens its control (D-209)
    const cli = ed ? `<span class="pp-cmf">${ICO.cliente}<select class="pp-ccli" data-id="${esc(r.id)}" aria-label="Cliente de la tarea">${opcionesCli(r.cliente, (D && D.CL) || X.CL)}</select></span>`
      : c ? `<span class="pp-cml" data-pp="lcli">${avatar(c.id, 'xs')}${esc(c.name)}</span>` : `<span class="pp-cml vacio" data-pp="lcli">${ICO.cliente}Cliente</span>`;
    const fotos = (r.fotos || []).length ? `<div class="pp-cfo">${r.fotos.map((f, i) => `<button type="button" class="pp-tfo" data-pp="foto" data-id="${esc(r.id)}" data-i="${i}" title="Ver la foto" aria-label="Ver la foto"><img src="${fotosURL(f)}" alt=""></button>`).join('')}</div>` : '';
    return `<div class="pp-card${ed ? ' ed' : ''}${r.hecha ? ' hecha' : ''}${amp}" role="dialog" aria-modal="true" aria-label="Tarea" tabindex="-1">`
      + `<div class="pp-ch"><input type="checkbox" class="pp-ck" data-pp="ck" data-id="${esc(r.id)}"${r.hecha ? ' checked' : ''} aria-label="Hecha"><p class="pp-ct" data-pp="ct" data-id="${esc(r.id)}"${ce}${ed ? ' aria-label="Tarea"' : ''}>${esc(r.txt)}</p>${botonesCard()}</div>`
      + `<div class="pp-cm">${fecha}${cli}</div>` + fotos + detSub(r, ed) + `</div>`;
  }
  // its details and its subtasks (D-183): the details, one field that takes no room in small when empty; the subtasks, each with
  // its checkbox (also while reading), a thin bar with how many are done, «+ Subtarea» to add one
  const filaSub = (rid, x, ed) => `<div class="pp-csub${x.hecha ? ' hecha' : ''}" data-sid="${esc(x.id)}"><input type="checkbox" class="pp-ck" data-pp="csck" data-id="${esc(rid)}" data-sid="${esc(x.id)}"${x.hecha ? ' checked' : ''} aria-label="Hecha">`
    + (ed ? `<input type="text" class="pp-cst" data-pp="cst" data-id="${esc(rid)}" data-sid="${esc(x.id)}" value="${esc(x.txt)}" aria-label="Subtarea" autocomplete="off" spellcheck="true"><button type="button" class="pp-csx" data-pp="csx" title="Quitar" aria-label="Quitar la subtarea">${ICO.x}</button>` : `<span>${esc(x.txt)}</span>`) + `</div>`;
  function detSub(r, ed) {
    const dt = String(r.detalles || ''), subs = r.subtareas || [], n = subs.length, h = subs.filter(x => x.hecha).length;
    const det = ed ? `<div class="pp-cd" data-pp="cd" data-id="${esc(r.id)}" contenteditable="plaintext-only" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Detalles" data-ph="Detalles">${esc(dt)}</div>`
      : `<div class="pp-cd${dt.trim() ? '' : ' vacio'}">${dt.trim() ? leerTxt(dt, { enlaces: true }) : 'Detalles'}</div>`;
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
  function nuevaSub(tras, o = {}) {            // a new subtask, being written: it goes in once something is written in it
    if (!CARD) return null;
    if (!CARD.ed) editar(true);
    const l = ov && ov.querySelector('.pp-csl'); if (!l) return null;
    const d = document.createElement('div'); d.innerHTML = filaSub(CARD.id, { id: 'nueva', txt: o.txt || '', hecha: !!o.hecha }, true);
    const f = d.firstChild; f.dataset.nueva = '1';
    if (tras) tras.after(f); else l.append(f);
    if (o.foco !== false) { const i = f.querySelector('.pp-cst'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    return f;
  }
  // «[] » typed in «Detalles»: the line became a subtask, written here (D-183, D-203); ⌘Z right after (before writing in
  // it) takes it away and puts «[] » back in the text
  function casillaASub(o) {
    const f = nuevaSub(null, { txt: o.txt, hecha: o.hecha }); if (!f) return;
    CARD.subPend = { f, v: f.querySelector('.pp-cst').value, deshacer: o.deshacer };
    barraEd(); if (o.txt.trim()) guardarCard(false);
  }
  function pegarSubs(l) {                      // «[] » lines pasted in «Detalles»: subtasks, after the others
    for (const x of l) if (x.txt.trim()) nuevaSub(null, { txt: x.txt, hecha: x.hecha, foco: false });
    barraEd(); guardarCard(false);
  }
  function deshacerSub() {
    const p = CARD && CARD.subPend; if (!p) return false;
    CARD.subPend = null;
    if (!p.f.isConnected) return false;
    p.f.remove(); barraEd();
    p.deshacer(); guardarCard(false);
    return true;
  }
  // writing in the card: the note and «Detalles» take the marks and the «/» menu (escritura.js, D-202–D-204)
  function cmdsDe(campo) {
    const ext = EXT.sesion && EXT.sesion.nueva ? ['sesion'] : [];
    return campo === 'det' ? [...ext, 'fecha', 'lista', 'numerada', 'casilla', 'separador'] : [...ext, 'tarea', 'fecha', 'lista', 'numerada', 'casilla', 'separador'];   // «/-» (D-283)
  }
  function activarCampos() {
    const E = ES(); if (!E || !ov || !CARD || !CARD.ed) return;
    const cn = ov.querySelector('[data-pp="cn"][contenteditable]');
    if (cn) E.activar(cn, { comandos: () => cmdsDe('nota'), alComando: (k, ctx) => comando(k, ctx, 'nota') });
    const cd = ov.querySelector('[data-pp="cd"][contenteditable]');
    if (cd) E.activar(cd, { subtareas: true, comandos: () => cmdsDe('det'), desc: { fecha: 'Le pone la fecha a la tarea', casilla: 'Una subtarea' }, alComando: (k, ctx) => comando(k, ctx, 'det'), alCasilla: casillaASub, alPegarCasillas: pegarSubs });
  }
  function apagarCampos() { if (ov) ov.querySelectorAll('[contenteditable]').forEach(x => { if (x._esc && x._esc.apagar) x._esc.apagar(); }); }
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
    if (CARD.ext) { CARD.ext.pintar(r, { forzar }); return; }   // the sheet and the file look after their own writing (D-223)
    apagarCampos();
    ponerCard(htmlCard(r, CARD.ed));
    if (M.controles && M.controles.mejorar) M.controles.mejorar(ov);
    activarCampos();
    if (enfocada && !CARD.ed) ov.firstChild.focus({ preventScroll: true });
  }
  // ---------- changing in place only what changed (D-223) ----------
  // The page, a card and a session's sheet are drawn from HTML; instead of writing them again whole, each live node takes the
  // new one's attributes and children, matched by its tag and its data key. What stays keeps everything: its entrance never
  // runs again (pp-dentro), a photo keeps what it drew, the focus, the caret, a composition and an open dropdown stay. A
  // control's twin (controles.js) goes with its native, which is kept only while it would be drawn the same.
  const CLAVES = ['f', 'ap', 'it', 'tid', 'sid', 'g', 'panel', 'slot', 'id', 'cat', 'tab', 'pp', 'hj', 'p', 'v', 'k', 'm', 'c', 'campo', 'key'];
  function claveDe(n) {
    if (n.nodeType !== 1) return '#' + n.nodeType;
    let k = n.tagName; const d = n.dataset;
    for (const c of CLAVES) if (d[c] != null && !(c === 'k' && n.classList.contains('pp-fo'))) k += '|' + c + '=' + d[c];   // a photo's data-k is its drawing
    return k;
  }
  const ajeno = n => n.nodeType === 1 && (n._nat || n.classList.contains('pp-ecapa'));   // a twin (controles.js), a writing layer (escritura.js)
  // a native control as drawn, without what controles.js added to it
  function propio(a) { const c = a.cloneNode(true); c.classList.remove('mx-nat'); if (!c.classList.length) c.removeAttribute('class'); c.removeAttribute('tabindex'); c.removeAttribute('aria-hidden'); return c.outerHTML; }
  // a native control kept as it is: drawn the same and showing the value it would be drawn with (a value refused, as an end
  // before the start, goes back to the one before)
  function nativoIgual(x, y) {
    if (propio(x) !== y.outerHTML) return false;
    if (x.tagName === 'INPUT') return x.value === (y.getAttribute('value') || '');
    if (x.tagName === 'SELECT') { const o = y.querySelector('option[selected]') || y.querySelector('option'); return x.value === (o ? (o.hasAttribute('value') ? o.getAttribute('value') : o.textContent) : ''); }
    return true;
  }
  function quitarNodo(n) { if (n._mx && n._mx.parentNode) n._mx.remove(); n.remove(); }
  function morfAttrs(a, b) {
    for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    for (const at of b.attributes) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  }
  function morfNodo(a, b, o) {
    if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    if (o.vivo && o.vivo(a)) return;                    // left as it is (a text being written)
    if (a._mx) return;                                  // a native control kept: the same, with its twin's marks (mx-nat, tabindex, aria-hidden)
    if (a.isEqualNode(b)) return;
    if (a.classList.contains('pp-fo') && b.classList.contains('pp-fo')) {   // the same photo keeps its drawing until it has the new one
      const k = a.dataset.k, nit = a.classList.contains('nitida');
      morfAttrs(a, b); if (k) a.dataset.k = k; if (nit) a.classList.add('nitida');
      return;
    }
    morfAttrs(a, b);
    if (a.tagName === 'INPUT') {
      if (a.type === 'checkbox' || a.type === 'radio') { if (a.checked !== b.hasAttribute('checked')) a.checked = b.hasAttribute('checked'); }
      else if (a !== document.activeElement && a.value !== (b.getAttribute('value') || '')) a.value = b.getAttribute('value') || '';
      return;
    }
    if (a.tagName === 'TEXTAREA') { if (a !== document.activeElement && a.value !== b.value) a.value = b.value; return; }
    morfHijos(a, [...b.childNodes], o);
  }
  function morfHijos(cont, nuevos, o = {}) {
    const viejos = [...cont.childNodes].filter(n => !ajeno(n)), mapa = new Map();
    for (const n of viejos) { const k = claveDe(n); if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(n); }
    // first who stays (a native control only if it would be drawn the same), then out what goes: a node moved in the DOM
    // runs its entrance again, so the ones that stay move only when the order really changed
    const par = nuevos.map(y => { const l = mapa.get(claveDe(y)), x = l && l.length ? l.shift() : null; return x && (!x._mx || nativoIgual(x, y)) ? x : null; });
    const vale = new Set(par.filter(Boolean));
    for (const n of viejos) if (!vale.has(n)) quitarNodo(n);
    let tras = null;                                     // the last node placed (its twin goes after it)
    nuevos.forEach((y, i) => {
      const x = par[i], n = x || y;
      if (x) morfNodo(x, y, o);
      let ref = tras ? tras.nextSibling : cont.firstChild; while (ref && ajeno(ref)) ref = ref.nextSibling;   // a twin or a layer stays after its own
      if (n !== ref) cont.insertBefore(n, ref);
      if (n._mx && n._mx.parentNode === cont && n.nextSibling !== n._mx) n.after(n._mx);
      tras = n;
    });
  }
  // the container's content as `html`: the nodes that are the same stay; {vivo: node => true to leave it as it is}
  function morfar(cont, html, o) {
    if (!cont) return;
    if (!cont.firstChild) { cont.innerHTML = html; return; }
    const t = document.createElement('template'); t.innerHTML = html;
    morfHijos(cont, [...t.content.childNodes], o);
    marcadas(cont);
  }
  // a checkbox shows what was drawn (a click the record didn't take goes back), as when it was written again whole
  function marcadas(cont) { cont.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(i => { const v = i.hasAttribute('checked'); if (i.checked !== v) i.checked = v; }); }
  // the card's content and classes change and the card stays: going from reading to writing never runs its entrance again
  // (no blink, D-209); its children too, in place (D-223)
  function ponerCard(html) {
    const c = ov && ov.firstChild, t = document.createElement('template'); t.innerHTML = html; const n = t.content.firstElementChild;
    if (!c || !n || c.nodeType !== 1 || c.tagName !== n.tagName) { ov.innerHTML = html; return; }
    morfAttrs(c, n); morfHijos(c, [...n.childNodes]); marcadas(c);
  }
  // the kinds of card other files draw (sesiones.js: a session's sheet, a sporadic client's file): {pintar, clic, dbl, tecla,
  // menu, guardar, cerrar}; this file keeps the card itself (its layer, its opening and closing, its ⌘Z)
  const EXT = {};
  function abrirCard(id, o = {}) {
    // over the board (D-219): the page closed, a session's sheet opened from the posts' calendar (in the vista cliente, read
    // only, fixed in «Ver como el cliente», naming only that board's client); a card opened from it stays over the board
    const X = I(), root = X.root(), tab = o.tablero != null ? !!o.tablero : !st.on, vc = tab && (o.vc != null ? !!o.vc : root.classList.contains('client')), cli = tab ? o.cli || (X.S && X.S.client) || null : null;
    const r = TK.get(id); if (!r || !(st.on || tab)) return false;
    cerrarMenu(); if (CARD) quitarCard();
    const ext = o.ext || (r.tipo === 'sesion' && EXT.sesion ? EXT.sesion : r.tipo === 'esporadico' && EXT.ficha ? EXT.ficha : null);
    ov = document.createElement('div'); ov.className = 'pp-ov entra' + (ext ? ' ' + ext.cls : ''); ov.dataset.pp = 'ov';
    ov.addEventListener('animationend', e => { if (e.target.classList.contains('pp-card')) e.currentTarget.classList.remove('entra'); });
    X.root().append(ov);
    CARD = { id, ed: !!o.ed, peq: !o.ed, t0: Date.now(), cierre: 0, de: o.de || `[data-pp="tver"][data-id="${CSS.escape(id)}"]`, amplia: false, ext, tablero: tab, vc: tab && vc, cli: tab ? cli : null };
    root.classList.toggle('pp-card-on', tab);   // the board under it takes no keys, nor the focus (inert)
    root.querySelectorAll(':scope > .appbar, :scope > .bar, :scope > .main').forEach(el => { el.inert = tab; });
    setTimeout(() => { if (CARD && CARD.id === id) CARD.peq = false; }, 600);   // the second click of the double click that opened it
    if (ext) { ext.pintar(r, { ...o, forzar: true }); return true; }
    ov.innerHTML = htmlCard(r, CARD.ed);
    if (M.controles && M.controles.mejorar) M.controles.mejorar(ov);
    activarCampos();
    if (CARD.ed) enfocar(null); else ov.firstChild.focus({ preventScroll: true });
    return true;
  }
  function soltarBorrador() { for (const [id, k] of TK) if (k._b && (!CARD || CARD.id !== id)) TK.delete(id); }
  function quitarCard() { if (!ov) return; clearTimeout(CARD && CARD.cierre); apagarCampos(); if (CARD && CARD.ext && CARD.ext.cerrar) CARD.ext.cerrar(); ov.remove(); CARD = null; ov = null; soltarBorrador(); sinTablero(); }
  const sinTablero = () => { const X = I(), root = X && X.root && X.root(); if (!root) return; root.classList.remove('pp-card-on'); root.querySelectorAll(':scope > .appbar, :scope > .bar, :scope > .main').forEach(el => { el.inert = false; }); };
  function cerrarCard(ya) {
    if (!CARD) return;
    clearTimeout(CARD.cierre);
    if (CARD.ed && !ya) { guardarCard(); if (!CARD) return; }   // what was written goes in first (an empty note has gone with its card)
    apagarCampos(); if (CARD.ext && CARD.ext.cerrar) CARD.ext.cerrar();
    const o = ov, de = CARD.de, tab = CARD.tablero; CARD = null; ov = null; soltarBorrador(); cerradaT = Date.now(); sinTablero();
    if (ya || pocoMov()) o.remove(); else { o.classList.add('sale'); setTimeout(() => o.remove(), 130); }
    const dn = tab ? I().root() : page, b = de && dn && dn.querySelector(de); if (b) b.focus({ preventScroll: true });   // over the board: back to its chip
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
  function editar(on, pt, sel) {               // sel: the field to write in (a subtask: the caret at its end) or the control to open (D-209)
    if (!CARD || CARD.ed === on) return;
    if (!on) { guardarCard(); if (!CARD) return; }
    CARD.ed = on; clearTimeout(CARD.cierre); CARD.subPend = null;
    pintarCard(true);
    if (!on) { if (ov) ov.firstChild.focus({ preventScroll: true }); return; }
    const f = sel && ov && ov.querySelector(sel);
    if (!f) { enfocar(pt); return; }
    if (f.matches('.pp-cst')) { f.focus({ preventScroll: true }); f.setSelectionRange(f.value.length, f.value.length); return; }
    const g = M.controles && M.controles.gemelo && M.controles.gemelo(f), tgt = g ? (g.querySelector('input') || g) : f;   // its date or client: the mesa's own control, open
    tgt.focus({ preventScroll: true }); tgt.click();
  }
  // the card to the whole page under the mesa's header and back (D-205): the same card, only wider; what is being written stays
  function ampliar(on) {
    if (!CARD || !ov || (CARD.ext && !CARD.ext.ampliar) || CARD.amplia === on) return;   // a session's sheet widens too (D-210)
    CARD.amplia = on; CARD.ampT = Date.now();
    const c = ov.querySelector('.pp-card'), r0 = c && c.animate && !pocoMov() ? c.getBoundingClientRect() : null;   // where it is seen (also half way)
    if (c && c._amp) { c._amp.cancel(); c._amp = null; }
    if (c) c.classList.toggle('amplia', on);
    ov.classList.toggle('amplia', on); colocarAmplia();
    // from where it was to where it is, 0.2 s with --ease-m, with transforms only: nothing is drawn again (D-205, D-210, D-231);
    // with «reducir movimiento», at once
    if (r0) {
      const r1 = c.getBoundingClientRect();
      if (r1.width && r1.height) {
        const sx = r0.width / r1.width, sy = r0.height / r1.height, dx = r0.left - r1.left, dy = r0.top - r1.top;
        const ease = getComputedStyle(ov).getPropertyValue('--ease-m').trim() || 'ease-out';
        c._amp = c.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: 200, easing: ease });
        for (const h of c.children) h.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 200 });   // the content, never seen stretched
        c._amp.onfinish = c._amp.oncancel = () => { if (c._amp && c._amp.playState !== 'running') c._amp = null; };
      }
    }
    const b = ov.querySelector('[data-pp="ampliar"]'), l = on ? 'Reducir' : 'Ampliar';   // the same button: the focus stays on it
    if (b) { b.title = l; b.setAttribute('aria-label', l); b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? ICO.reducir : ICO.ampliar; }
    if (CARD.ext && CARD.ext.ampliar) CARD.ext.ampliar(on);
    // the writing layers measure their text: once the card is in its place (never half way through its transition)
    const capas = () => { if (ov) ov.querySelectorAll('[contenteditable]').forEach(x => { if (x._esc && x._esc.dibujar) x._esc.dibujar(); }); };
    if (c && c._amp) c._amp.finished.then(capas, () => {}); else requestAnimationFrame(capas);
  }
  function colocarAmplia() {                   // under the header, which keeps working
    if (!ov) return;
    if (!CARD || !CARD.amplia) { ov.style.top = ''; return; }
    const root = I().root(), ab = root.querySelector('.appbar'), t = ab ? Math.round(ab.getBoundingClientRect().bottom - root.getBoundingClientRect().top) : 0;
    ov.style.top = t + 'px';
  }
  // what is written in the card: the title (never empty: an empty one goes back) and a note (empty, it goes, and one never
  // written leaves no step of ⌘Z)
  let cardT = null;
  function guardarCard(fin = true) {           // fin: writing ends (the blank subtasks go, the details are trimmed)
    clearTimeout(cardT); cardT = null;
    if (!CARD || !ov) return;
    const id = CARD.id, r = TK.get(id); if (!r) return;
    if (CARD.ext) { if (CARD.ext.guardar) CARD.ext.guardar(fin); return; }
    const t = ov.querySelector('[data-pp="ct"], [data-pp="cn"]'); if (!t) return;
    const txt = r.tipo === 'nota' ? t.textContent : t.textContent.replace(/\s*\n\s*/g, ' ').trim();
    if (r._b) {                                // a task not made yet («Tarea» of the «/» menu): made with its first title, a step of its own; closed without one, it isn't (D-203)
      if (!txt) return;
      const cd = ov.querySelector('[data-pp="cd"]'), subs = [...ov.querySelectorAll('.pp-csub')].map(f => { const i = f.querySelector('.pp-cst'), c = f.querySelector('.pp-ck'); return i && i.value.trim() ? { id: nuevoId('st'), txt: i.value.trim(), ...(c.checked ? { hecha: true } : {}) } : null; }).filter(Boolean);
      const n = copia(r); n.txt = txt; n.at = ahoraISO(); const det = cd ? cd.textContent.replace(/^\s*\n|\s+$/g, '') : ''; if (det) n.detalles = det; if (subs.length) n.subtareas = subs;
      TK.delete(id); CARD.cmdVolver = null;
      ov.querySelectorAll('.pp-csub[data-nueva]').forEach((f, i) => { const s = subs[i]; if (s) { delete f.dataset.nueva; f.dataset.sid = s.id; f.querySelectorAll('[data-sid]').forEach(x => { x.dataset.sid = s.id; }); } });
      hacer([{ id, despues: n }]).then(() => pintar());
      return;
    }
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

  // ---------- the «/» menu's commands (D-204): «Fecha», «Tarea» (and «Sesión», sesiones.js) ----------
  function comando(k, ctx, campo) {
    if (k === 'fecha') return cmdFecha(ctx, campo);
    if (k === 'tarea') return cmdTarea(ctx, campo);
    if (k === 'sesion' && EXT.sesion && EXT.sesion.nueva) return EXT.sesion.nueva({ ctx, campo, desde: campo !== 'nueva' && CARD ? TK.get(CARD.id) : null });
  }
  // the mesa's own calendar (D-136), under the «/» that asked for it; closed without a day, nothing changes
  function pedirFecha(r0, o, alElegir) {
    const X = I(), root = X.root(), w = document.createElement('span');
    w.className = 'pp-fpick'; w.style.left = Math.round(r0.left) + 'px'; w.style.top = Math.round(r0.top) + 'px'; w.style.height = Math.round(r0.height || 18) + 'px';
    w.innerHTML = `<input type="date"${o.sinFecha ? ' data-sin-fecha' : ''} value="${esc(o.valor || '')}" aria-label="Fecha">`;
    root.append(w);
    const inp = w.firstChild; let hecho = false, vig = 0;
    const fin = () => { if (hecho) return; hecho = true; clearInterval(vig); setTimeout(() => w.remove(), 0); };
    inp.addEventListener('change', () => { const v = /^\d{4}-\d{2}-\d{2}$/.test(inp.value) ? inp.value : ''; fin(); alElegir(v); });
    if (M.controles && M.controles.mejorar) {
      M.controles.mejorar(w); const g = M.controles.gemelo(inp), t = g && g.querySelector('input');
      if (!t) { fin(); return; }
      t.focus({ preventScroll: true }); t.click();
      vig = setInterval(() => { const a = M.controles.abierto(); if (!a || a.de !== inp) { fin(); if (o.alCerrar) o.alCerrar(); } }, 120);
    } else { try { inp.showPicker(); } catch (e) { fin(); } inp.addEventListener('blur', () => setTimeout(fin, 300)); }
  }
  function cmdFecha(ctx, campo) {
    const id = CARD.id, el = ctx.ctl.el, r0 = ctx.rect(), vuelta = () => { if (el.isConnected) { el.focus({ preventScroll: true }); ctx.ctl.poner(ctx.b); } };
    pedirFecha(r0, { sinFecha: campo === 'det', valor: campo === 'det' ? (TK.get(id) || {}).fecha : '', alCerrar: vuelta }, v => {
      if (!CARD || CARD.id !== id || !el.isConnected) return;
      el.focus({ preventScroll: true });
      if (campo !== 'det') { if (!v) { vuelta(); return; } ctx.poner(ES().fechaTxt(v)); ctx.ctl.cmd = ctx.volver; return; }   // in a note or a session's text, written as text
      // in «Detalles», the task's date (D-182) and «/…» goes: one step of its own; ⌘Z right after puts both back
      ctx.quitar(); clearTimeout(cardT); cardT = null;
      const det = el.textContent, f = ov.querySelector('.pp-cfecha');
      cambiar(id, x => { if (v) x.fecha = v; else delete x.fecha; x.detalles = det; if (!det) delete x.detalles; return x; }).then(() => pintar());
      if (f) f.value = v;
      ctx.ctl.cmd = () => { deshacer(false, true).then(() => { const k = TK.get(id), g = ov && ov.querySelector('.pp-cfecha'); if (g && k) g.value = k.fecha || ''; }); ctx.volver(); };
    });
  }
  // «Tarea»: «/…» goes from the note and a new task opens big, its title being written; closed without a title it isn't made.
  // ⌘Z right after (its title still empty) closes it and the note comes back as it was, with «/…»
  function cmdTarea(ctx, campo) {                // in a note or a session's text («campo»: which one); a session gives its date too
    const r = TK.get(CARD.id); if (!r) return;
    const v = { nota: r.id, antes: ctx.texto, caret: ctx.b, campo };
    ctx.quitar(); cerrarCard();
    const k = borrador({ cliente: clis(r).filter(cliOk)[0], fecha: r.tipo === 'sesion' ? r.fecha : undefined });
    if (k && CARD) CARD.cmdVolver = v;
  }
  function borrador(o = {}) {
    const now = ahoraISO(), r = { id: nuevoId('tk'), tipo: 'tarea', txt: '', creada: now, at: now };
    if (o.cliente && cliOk(o.cliente)) r.cliente = o.cliente;
    if (o.fecha && /^\d{4}-\d{2}-\d{2}$/.test(o.fecha)) r.fecha = o.fecha;
    Object.defineProperty(r, '_b', { value: true, enumerable: false, configurable: true });   // never in a copy, an export or a write
    TK.set(r.id, r);
    abrirCard(r.id, { ed: true, de: o.de });
    return r;
  }
  async function volverDeTarea() {
    const v = CARD && CARD.cmdVolver; if (!v) return;
    CARD.cmdVolver = null; cerrarCard(true);
    const r = TK.get(v.nota);
    if (r && r.tipo === 'sesion') { if (EXT.sesion && EXT.sesion.volverTexto) await EXT.sesion.volverTexto(v); return; }   // a session's text (sesiones.js)
    await enmendar(v.nota, x => { x.txt = v.antes; return x; });
    pintar();
    if (abrirCard(v.nota, { ed: true })) { const el = ov && ov.querySelector('[data-pp="cn"]'); if (el && el._esc) el._esc.poner(Math.min(v.caret, el.textContent.length)); }
  }
  // the last step on this record takes the change in (so a ⌘Z goes back to before it as one), or a step of its own
  async function enmendar(id, f) {
    const u = H.u[H.u.length - 1], p = u && u.length === 1 && u[0].id === id ? u[0] : null, r = TK.get(id); if (!r) return false;
    if (!p) return cambiar(id, f);
    const n = f(copia(r)); if (!n) return false; n.at = ahoraISO(); p.despues = copia(n); H.r = [];
    await escribir([{ id, despues: n }]); return true;
  }

  // ---------- the right-click menu of a task or a note (the mesa's menu, .cpmenu) ----------
  let menu = null;
  function cerrarMenu() { if (!menu) return; const m = menu; menu = null; m.el.remove(); retomar(); document.removeEventListener('pointerdown', m.fuera, true); document.removeEventListener('keydown', m.tecla, true); window.removeEventListener('blur', cerrarMenu); window.removeEventListener('resize', cerrarMenu); }
  function abrirMenu(x, y, items, foco) {     // foco: where the focus goes back when it closes (a «⋯» opened from the keyboard)
    cerrarMenu();
    const root = I().root(), el = document.createElement('div'); el.className = 'cpmenu pp-menu'; el.setAttribute('role', 'menu');
    el.innerHTML = items.map(x => x === '-' ? '<hr>' : `<button type="button" role="menuitem" data-a="${x[0]}"${x[3] ? ' disabled' : ''}${x[4] ? ` title="${esc(x[4])}"` : ''}>${x[1]}</button>`).join('');   // [action, text, do, off, title]; '-' a line
    el.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return; const it = items.find(i => i[0] === b.dataset.a), f = menu && menu.foco; cerrarMenu(); if (it) it[2](); if (f && f.isConnected && (!document.activeElement || document.activeElement === document.body)) f.focus({ preventScroll: true }); });
    root.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`; el.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    const m = menu = { el, fuera: e => { if (!el.contains(e.target)) cerrarMenu(); }, tecla: e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const f = m.foco; cerrarMenu(); if (f && f.isConnected) f.focus({ preventScroll: true }); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const bs = [...el.querySelectorAll('button:not(:disabled)')], i = bs.indexOf(document.activeElement); const n = bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]; if (n) n.focus(); }
    } };
    document.addEventListener('pointerdown', m.fuera, true); document.addEventListener('keydown', m.tecla, true);
    window.addEventListener('blur', cerrarMenu); window.addEventListener('resize', cerrarMenu);
    const b0 = el.querySelector('button:not(:disabled)'); if (b0) b0.focus();
    m.foco = foco;
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
  let cerradaT = 0;
  function alClic(e) {
    const X = I(); if (!X || !X.root) return;
    const root = X.root(); if (!root || !root.contains(e.target)) return;
    if (e.detail >= 2 && !CARD && Date.now() - cerradaT < DBL + 200) { e.preventDefault(); e.stopPropagation(); return; }   // the second click of the double click that closed a card: never on what was under it (D-209)
    if (st.on && e.target.closest('.tabs [data-act="client"]')) { if (e.target.closest('[data-act="client"]') && e.target.closest('[data-act="client"]').dataset.id === X.curClient) cerrar(); return; }   // another client: its tab opens it (and M.openClient closes the page)
    if (CARD && enCard(e.target)) { clicCard(e); return; }
    // a task or a note in small: a click opens it big (D-182); its checkbox and its photo, as before
    const it = st.on && page && page.contains(e.target) && !e.target.closest('.pp-ck, [data-pp="foto"], [data-pp="reprog"]') && e.target.closest('[data-tid]:not([data-tid="nueva"]), [data-nid]');
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
    if (k === 'plegar') { st.plg[a.dataset.p] = !st.plg[a.dataset.p]; if (a.dataset.p === 'tareas') ssSet(SS_TAREAS, st.plg.tareas ? '1' : '0'); pintar(); const b = page.querySelector(`[data-pp="plegar"][data-p="${a.dataset.p}"]`); if (b) b.focus({ preventScroll: true }); return; }
    if (k === 'fila') { st.fila = +a.dataset.n; lsSet(LS_FILA, String(st.fila)); pintar(); return; }
    if (k === 'tvista') { st.vista = a.dataset.v; lsSet(LS_VISTA, st.vista); pintar(); return; }
    if (k === 'alcance') { st.alcance = a.dataset.r; lsSet(LS_ALC, st.alcance); pintar(); return; }
    if (k === 'tnav') { if (st.vista === 'semana') st.tsem += +a.dataset.d; else st.tmes += +a.dataset.d; pintar(); return; }
    if (k === 'tcli') { st.tcli = a.dataset.c || null; pintar(); return; }
    if (k === 'nota-campo') { crearDesdeCampo(true); return; }
    if (k === 'cvista') { st.cvista = a.dataset.v === 'esporadicos' ? 'esporadicos' : 'mensuales'; pintar(); return; }   // E2 (D-207)
    if (k === 'esp') { abrirCard(a.dataset.id, { de: `[data-pp="esp"][data-id="${CSS.escape(a.dataset.id)}"]` }); return; }
    if (k === 'esp-nuevo') { if (EXT.ficha && EXT.ficha.nuevo) EXT.ficha.nuevo(); return; }
    if (k === 'reprog') { reprogramar(a.dataset.id, a); return; }
    if (k === 'nfecha') { abrirCampo('fecha'); return; }
    if (k === 'ncli') { abrirCampo('cliente'); return; }
    if (k === 'foto') { verFoto(a.dataset.id, a.dataset.i); return; }
    if (k === 'cliente') { abrirCliente(a.dataset.c, a.dataset.key); return; }
    if (k === 'entrega') { const id = a.dataset.id; (async () => { await abrirCliente(a.dataset.c, a.dataset.key); if (M.entregasUI && M.entregasUI.abrir) setTimeout(() => M.entregasUI.abrir(id), 60); })(); return; }   // D-290
    if (k === 'cobro') { const c = a.dataset.c; if (espDe(c)) { abrirCard(c); if (EXT.ficha && EXT.ficha.aCobros) EXT.ficha.aCobros(); } else if (I().cob) I().cob.dlgCliente(c, 'cobros'); return; }   // its «Cobros» (D-235)
    if (k === 'abrir') { abrirPost(a.dataset.key, a.dataset.slot); return; }
    if (k === 'hs') { (async () => { const key = a.dataset.key; if (X.S && X.S.key === key) cerrar(); else if (!(await abrirTablero(() => M.open(key)))) return; if (M.hs && M.hs.ver) M.hs.ver(true); })(); return; }
  }
  function marcarEnTexto(cas) {                // «[] » ↔ «[x] » in the note or the details, read: a step of the tasks' ⌘Z (D-204)
    const E = ES(), id = CARD && CARD.id, r = id && TK.get(id); if (!E || !r) return;
    const ln = +cas.dataset.ln, det = !!cas.closest('.pp-cd'), n = E.alternar(det ? r.detalles : r.txt, ln); if (n == null) return;
    const foco = document.activeElement === cas;
    cambiar(id, x => { if (det) x.detalles = n; else x.txt = n; return x; }).then(() => {
      pintar();
      if (foco && ov) { const b = ov.querySelector(`${det ? '.pp-cd' : '.pp-cn'} .pp-em.ca[data-ln="${ln}"]`); if (b) b.focus({ preventScroll: true }); }
    });
  }
  // a click on the card (D-209): open, a click writes where it is pressed (the title, the note, «Detalles», a subtask; the date
  // or the client also opens its control); what works with a click works as before (its checkbox, a checkbox or a link drawn
  // in the text, its photos, its buttons); a click outside or its × closes it, also writing (what is written goes in); the
  // second click of a double click never closes it nor moves the caret
  const seleccionando = () => { const s = getSelection(); return !!(s && !s.isCollapsed && s.anchorNode && enCard(s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode)); };
  function clicCard(e) {
    const t = e.target, c = ov.firstChild;
    if (CARD.pd) { CARD.pd = false; return; }   // the click that closed one of the mesa's menus, calendars or the «/» menu
    if (CARD.ext && CARD.ext.clic && CARD.ext.clic(e)) return;
    const a = t.closest('[data-pp]'), k = a && a.dataset.pp;
    if (k === 'ampliar') { if (e.detail < 2) ampliar(!CARD.amplia); return; }   // the second click of a double click: nothing
    if (k === 'cerrar') { if (e.detail < 2) cerrarCard(); return; }
    const cas = t.closest('.pp-em.ca[data-ln]'); if (cas && !CARD.ed) { marcarEnTexto(cas); return; }   // a checkbox drawn in the text, read: marked (D-204)
    if (t.closest('a.pp-ea')) return;          // a link opens in another tab; the card stays (D-204)
    if (k === 'foto') { verFoto(a.dataset.id, a.dataset.i); return; }
    if (k === 'cmas') { nuevaSub(); return; }
    if (k === 'csx') { quitarSub(a.closest('.pp-csub')); return; }
    if (t.closest('.pp-ck, input, select, button, [contenteditable="plaintext-only"], .mx-sel, .mx-f')) return;
    if (e.detail >= 2) return;                 // the double click decides (alDobleClic)
    CARD.peq = false;
    if (!c.contains(t)) { cerrarCard(); return; }   // outside: closed at once, writing too
    if (CARD.ed || CARD.ext || seleccionando()) return;   // writing, the click is the field's; text being selected stays selected
    const ctl = t.closest('[data-pp="lfecha"], [data-pp="lcli"]');
    if (ctl) { editar(true, null, ctl.dataset.pp === 'lfecha' ? '.pp-cfecha' : '.pp-ccli'); return; }
    const sub = t.closest('.pp-csub[data-sid]');
    if (sub) { editar(true, null, `.pp-cst[data-sid="${CSS.escape(sub.dataset.sid)}"]`); return; }
    if (t.closest('[data-pp="ct"], [data-pp="cn"], .pp-cd')) editar(true, { x: e.clientX, y: e.clientY });
  }
  function alDobleClic(e) {
    if (CARD && enCard(e.target)) {            // writing, where it was double clicked (the double click that opened it: at the end)
      clearTimeout(CARD.cierre);
      if (CARD.ampT && Date.now() - CARD.ampT < DBL) return;   // the second click of a double click on «Ampliar», now under it (a sheet too)
      if (CARD.ext) { if (CARD.ext.dbl) CARD.ext.dbl(e); return; }
      if (e.target.closest('[data-pp="ampliar"], [data-pp="cerrar"], a.pp-ea, .pp-em.ca[data-ln]')) return;
      if (!CARD.ed && !e.target.closest('.pp-ck, [data-pp="foto"]')) editar(true, CARD.peq ? null : { x: e.clientX, y: e.clientY });
      return;
    }
    if (!st.on || !page || !page.contains(e.target)) return;
    if (e.target.closest('[data-pp="rango"]')) { st.desp = 0; pintar(); refrescar(); }
    else if (e.target.closest('[data-pp="trango"]')) { if (st.vista === 'semana') st.tsem = 0; else st.tmes = 0; pintar(); }
  }
  function alCambiar(e) {
    if (!enCard(e.target) && !(st.on && page && page.contains(e.target))) return;
    const t = e.target;
    if (CARD && CARD.ext && enCard(t) && CARD.ext.cambio && CARD.ext.cambio(e)) return;   // a session's sheet, a sporadic client's file (sesiones.js)
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
    if (!(st.on && page) && !(CARD && CARD.tablero)) return;
    if (e.key === 'Escape' && M.cobrosUI && M.cobrosUI.escCampo && M.cobrosUI.escCampo(e)) return;   // a payment's field changed: back to what is saved (D-234)
    if (menu && e.key === 'Escape') return;    // the menu closes on its own (its keys), never the card under it
    const t = e.target;
    if (CARD) {                                // the card: Esc goes back to reading or closes; Enter on it writes (D-182)
      const det = I().root().querySelector('.detail'), ctl = M.controles && M.controles.abierto && M.controles.abierto();
      if (e.key === 'Escape' && ES() && ES().menuAbierto()) return;   // the «/» menu closes on its own and «/…» stays (D-204)
      if (CARD.ext && CARD.ext.tecla && !ctl && !(det && !det.hidden) && CARD.ext.tecla(e)) return;
      // Esc closes it, writing too (what is written goes in) and widened too (D-209); what is open over it closes first
      if (e.key === 'Escape' && !ctl && !(det && !det.hidden) && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); cerrarCard(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && t.matches && t.matches('.pp-em.ca[data-ln]') && enCard(t) && !CARD.ed) { e.preventDefault(); marcarEnTexto(t); return; }
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
      // right after «Tarea» of the «/» menu (its title still empty) or «[] » that became a subtask: the Mesa's (D-203, D-204)
      if (!e.shiftKey && CARD && CARD.cmdVolver && t && t.matches && t.matches('[data-pp="ct"]') && !t.textContent.trim()) { e.preventDefault(); e.stopImmediatePropagation(); volverDeTarea(); return; }
      if (!e.shiftKey && CARD && CARD.subPend && t && t.matches && t.matches('.pp-cst') && CARD.subPend.f.contains(t) && t.value === CARD.subPend.v) { e.preventDefault(); e.stopImmediatePropagation(); deshacerSub(); return; }
      const det = I().root().querySelector('.detail');
      if ((t && (t.isContentEditable || (t.tagName === 'INPUT' && /^(text|search|)$/.test(t.type || '')) || t.tagName === 'TEXTAREA')) || (det && !det.hidden)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (CARD && CARD.tablero) { const L = e.shiftKey ? H.r : H.u, p = L[L.length - 1]; if (CARD.vc || !p || !p.some(x => x.id === CARD.id || ((x.antes || x.despues || {}).tipo === 'material'))) return; }   // over the board: never a step of the hidden page
      deshacer(e.shiftKey); return;
    }
    if (!page || !page.contains(t)) return;
    if (t.matches('[data-pp="nueva"]') && e.key === 'Enter' && !e.isComposing && !(ES() && ES().menuDe(t))) { e.preventDefault(); crearDesdeCampo(false); return; }
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[data-pp="tver"]')) { e.preventDefault(); abrirCard(t.dataset.id); return; }
  }
  function alEscribir(e) {                     // what is written in the card goes in after a pause (D-182, D-183)
    if (CARD && CARD.ext && enCard(e.target)) { if (CARD.ext.escribir) CARD.ext.escribir(e); return; }
    const p = e.target.closest && e.target.closest('[data-pp="ct"], [data-pp="cn"], [data-pp="cd"], [data-pp="cst"]'); if (!p || !CARD || !(st.on || CARD.tablero) || !enCard(p)) return;   // over the board too (D-219)
    if (p.dataset.pp === 'cst') { barraEd(); if (CARD.subPend && CARD.subPend.f.contains(p) && p.value !== CARD.subPend.v) CARD.subPend = null; }
    if (p.dataset.pp === 'ct' && CARD.cmdVolver && p.textContent.trim()) CARD.cmdVolver = null;
    clearTimeout(cardT); cardT = setTimeout(() => guardarCard(false), 400);
  }
  function alMenu(e) {
    if (!st.on || !page || !page.contains(e.target)) return;
    const t = e.target.closest('[data-tid]:not([data-tid="nueva"])'), n = e.target.closest('[data-nid]');
    if (n) { e.preventDefault(); const id = n.dataset.nid; abrirMenu(e.clientX, e.clientY, [['borrar', 'Borrar nota', async () => { await borrar(id); pintar(); }]]); return; }
    const eb = e.target.closest('[data-pp="esp"]');
    if (eb && TK.has(eb.dataset.id)) { e.preventDefault(); const id = eb.dataset.id; abrirMenu(e.clientX, e.clientY, menuEsp(id)); return; }
    if (!t || !TK.has(t.dataset.tid)) return;
    e.preventDefault();
    const id = t.dataset.tid, r = TK.get(id), l = [];
    if (r.tipo === 'sesion') { abrirMenu(e.clientX, e.clientY, menuSesion(id)); return; }
    if ((r.fotos || []).length) l.push(['sinfotos', r.fotos.length === 1 ? 'Quitar la foto' : 'Quitar las fotos', async () => { await cambiar(id, x => { delete x.fotos; return x; }); pintar(); }]);
    l.push(['borrar', 'Borrar tarea', async () => { await borrar(id); pintar(); }]);
    abrirMenu(e.clientX, e.clientY, l);
  }
  // a session's menu (right click and its «⋯»): «Quitar las fotos» if it has any (also where they were placed) and «Borrar sesión»
  function menuSesion(id, extra) {
    const r = TK.get(id), n = (r && r.fotos || []).length, l = [];
    if (n) l.push(['sinfotos', n === 1 ? 'Quitar la foto' : 'Quitar las fotos', async () => { await cambiar(id, x => { delete x.fotos; if (x.sesion) for (const a of x.sesion.apartados || []) { (a.pestanas || []).forEach(p => (p.items || []).forEach(i => { i.fotos = []; })); (a.grupos || []).forEach(g => { g.fotos = []; }); } return x; }); pintar(); }]);
    if (extra) l.push(...extra);
    if (EXT.sesion && EXT.sesion.duplicar) l.push(['duplicar', 'Duplicar sesión', () => EXT.sesion.duplicar(id)]);   // D-221
    l.push(['borrar', 'Borrar sesión', async () => { if (CARD && CARD.id === id) cerrarCard(true); await borrar(id); pintar(); }]);
    return l;
  }
  // a sporadic client's: «Borrar esporádico», off while it has sessions, tasks or notes (D-201, D-207)
  function menuEsp(id) {
    const tiene = vivos().some(k => conCli(k, id) && k.tipo !== 'esporadico') || !!(I().cob && I().cob.vivos(id).length);   // a session shared with others too (D-217); its payments (D-234)
    return [['borrar', 'Borrar esporádico', async () => { if (CARD && CARD.id === id) cerrarCard(true); await borrar(id); pintar(); }, tiene, tiene ? 'Tiene sesiones, tareas, notas o cobros' : '']];
  }
  // «Reprogramar» of a session gone past: the mesa's calendar under the button; the new day, a step of ⌘Z (D-206)
  function reprogramar(id, b) {
    const r = TK.get(id); if (!r) return;
    pedirFecha(b.getBoundingClientRect(), { valor: r.fecha || '' }, v => { if (v && v !== r.fecha) cambiar(id, x => { moverInicio(x, v); return x; }).then(() => pintar()); });   // its end keeps the length (D-218)
  }
  // files over the page: only a task or «Nueva tarea» takes them; nothing reaches the hidden board's tray
  const conArchivos = e => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files');
  let sobre = null;
  const marcarSobre = el => { if (sobre && sobre !== el) sobre.classList.remove('pp-drop'); sobre = el; if (el) el.classList.add('pp-drop'); };
  const destino = e => { const t = e.target.closest && e.target.closest('[data-tid]'); return t && (t.dataset.tid === 'nueva' || (TK.has(t.dataset.tid) && TK.get(t.dataset.tid).tipo === 'tarea')) ? t : null; };   // a session's photos go in its sheet, to their own store (D-206)
  function alArrastrar(e) {                    // capture on the mesa: with the page open, files only go to the page's targets
    if (!(st.on || (CARD && CARD.tablero)) || !conArchivos(e)) return;   // over the board too: never to its tray
    if (CARD && CARD.ext && enCard(e.target)) { if (e.type !== 'dragleave') { e.preventDefault(); e.stopPropagation(); } if (CARD.ext.archivos) CARD.ext.archivos(e); else if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'; return; }
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
    // the click that closes a dropdown, the mesa's calendar, the «/» menu or a right-click menu doesn't count for the card (D-209)
    on(window, 'pointerdown', e => { if (CARD) CARD.pd = enCard(e.target) && !!((M.controles && M.controles.abierto && M.controles.abierto()) || menu || (ES() && ES().menuAbierto())); }, true);
    on(window, 'pointerup', () => { if (CARD && CARD.pd) setTimeout(() => { if (CARD) CARD.pd = false; }, 0); }, true);   // its click, if any, came already
    for (const ty of ['dragenter', 'dragover', 'dragleave', 'drop']) on(document, ty, alArrastrar, true);
    // the shell is built again (a reload of the code) or «Vista cliente» changes: the logo follows
    const mo = new MutationObserver(() => { const r = I() && I().root && I().root(); if (r && r !== root) return; colocar(); });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    EV.push([{ removeEventListener: () => mo.disconnect() }, 'mo', null]);
    // up to date on its own: every minute (D-120's sweep), on coming back to the tab and with another tab's tasks
    tic = setInterval(() => { if (st.on && document.visibilityState === 'visible') refrescar(); }, 60000);
    on(document, 'visibilitychange', () => { if (st.on && document.visibilityState === 'visible') refrescar(); });
    let rT = 0; on(window, 'resize', () => { if (CARD && CARD.amplia) colocarAmplia(); clearTimeout(rT); rT = setTimeout(() => { if (st.on && !ocupada()) pintar(); }, 120); });   // fewer clients a row when they don't fit
    on(document, 'mesa-cobros', () => { if (!st.on) return; if (ocupada()) pendiente = true; else pintar(); });   // the invoices changed (D-235)
    on(document, 'mesa-entregas', () => { if (!st.on) return; if (ocupada()) pendiente = true; else pintar(); });   // the deliveries changed (D-290)
    on(document, 'mesa-meses', () => { if (!st.on) return; if (ocupada()) pendiente = true; else pintar(); });   // a month's «Cómo fue» came in (D-362)
    try { bc = new BroadcastChannel('mesa-personal'); bc.onmessage = e => { if (!e.data || e.data.t !== 'tareas') return; if (st.on) refrescar(); else if (CARD && CARD.tablero) { cargarTK().then(() => pintarCard()); } avisar(); }; } catch (e) { bc = null; }
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
      const f = M.importData, g = async function (...a) { quedarse++; try { return await f.apply(this, a); } finally { quedarse--; if (st.on) refrescar(); avisar(); if (bc) { try { bc.postMessage({ t: 'tareas' }); } catch (e) { /* */ } } } };   // the other tabs' calendars too
      g._pp = f; M.importData = g;
    }
    // the mesa starts on the page: not in «Vista cliente» nor after a reload inside a client (this tab's session)
    if (!root.classList.contains('client') && ssGet(SS_CLI) !== '1') abrir();
  }
  // what sesiones.js reads (one file, one page: never a name of window.MESA, D-206)
  // a sporadic client passed to a monthly one (D-207): the steps of ⌘Z that bring back one of its records bring it with its new client
  function remapH(f, sinId) {
    for (const L of [H.u, H.r]) { for (let i = L.length - 1; i >= 0; i--) { const paso = L[i]; if (sinId) for (let j = paso.length - 1; j >= 0; j--) if (paso[j].id === sinId) paso.splice(j, 1); if (!paso.length) { L.splice(i, 1); continue; } for (const p of paso) { if (p.antes) f(p.antes); if (p.despues) f(p.despues); } } }
  }
  const _p = {
    EXT, TK, I, esc, ICO, st, avatar, avatarN, cliDe, clis, conCli, cliOk, esps, sesiones, tareas, notas, vivos, opcionesCli, diaHora, tramo, ultDia, marcaT, moverInicio, finOk, finNuevo, corto, fechaLarga, addD, dow, difD, acuerdoCuando, MESL,
    hacer, cambiar, enmendar, escribir, deshacer, copia, hondo, nuevoId, ahoraISO, puede, borrar, marcar, rebajar, esImagen, verFoto, remapH, guardarCard, ampliar, colocarAmplia,
    pintar, refrescar, cargarTK, abrirCard, cerrarCard, quitarCard, pintarCard, editar, borrador, pedirFecha, comando, menuSesion, menuEsp,
    abrirMenu, cerrarMenu, ES, leerTxt, lsGet, lsSet, enCard, pocoMov, DBL, fotosURL, botonesCard, ponerCard, seleccionando, morfar,
    get CARD() { return CARD; }, get ov() { return ov; }, get page() { return page; },
    cardT: { quitar: () => { clearTimeout(cardT); cardT = null; }, poner: f => { clearTimeout(cardT); cardT = setTimeout(f, 400); } }
  };
  M.personal = {
    version: VERSION, abrir, cerrar, abierta: () => st.on, render: refrescar, _p,
    // a session's sheet over the board, from the posts' calendar (D-219): {de, vc, cli}
    abrirSesion: async (id, o = {}) => { if (!EXT.sesion) return false; if (!st.on) await cargarTK(); const r = TK.get(id); if (!r || r.tipo !== 'sesion') return false; return abrirCard(id, { ...o, tablero: !st.on }); },
    // the posts' calendar's right click (D-285), over the board: a session with that day and the client; a task in big with them,
    // made only once it has a title (D-204); a session duplicated (D-221) or deleted, this one with «Deshacer»
    nuevaSesion: async (o = {}) => { if (!EXT.sesion || !EXT.sesion.nueva) return false; if (!st.on) await cargarTK(); EXT.sesion.nueva({ desde: o.cliente ? { cliente: o.cliente } : null, fecha: o.fecha, clase: o.clase }); return true; },   // clase: 'reunion' (D-291)
    nuevaTarea: async (o = {}) => { if (!st.on) await cargarTK(); return !!borrador({ cliente: o.cliente, fecha: o.fecha, de: o.de }); },
    // «Nuevo cliente · Esporádico» of the symbol's menu (D-289): made as always (D-207), then the page on «Esporádicos»
    nuevoEsporadico: async nombre => {
      const n = String(nombre || '').trim().slice(0, 60); if (!n) return { error: 'Escribe el nombre del cliente.' };
      await cargarTK();
      if ([...(I().CL || []).map(c => c.name), ...esps().map(e => e.txt)].some(x => String(x).toLowerCase() === n.toLowerCase())) return { error: 'Ya hay un cliente con ese nombre.' };
      if (!puede()) return { error: 'La mesa está abierta en otra pestaña: pulsa «Usar aquí».' };
      const now = ahoraISO(), e2 = { id: nuevoId('es'), tipo: 'esporadico', txt: n, creada: now, at: now };
      if (!(await hacer([{ id: e2.id, despues: e2 }]))) return { error: 'No se pudo guardar.' };
      if (!st.on) abrir();                       // each visit starts on «Mensuales» (D-180): this one, on its new client's
      st.cvista = 'esporadicos'; pintar();
      return { ok: true, id: e2.id };
    },
    duplicarSesion: async id => { if (!EXT.sesion || !EXT.sesion.duplicar) return false; if (!st.on) await cargarTK(); const r = TK.get(id); if (!r || r.tipo !== 'sesion') return false; await EXT.sesion.duplicar(id); return true; },
    borrarSesion: async id => {
      if (!st.on) await cargarTK();
      const r = TK.get(id); if (!r || r._b || r.tipo !== 'sesion') return false;
      const antes = copia(r);
      if (CARD && CARD.id === id) cerrarCard(true);
      if (!(await borrar(id))) return false;
      if (st.on) pintar();
      I().toast(`Sesión «${r.txt}» borrada.`, { action: 'Deshacer', ms: 6000, onAction: async () => { if (TK.has(id)) return; if (await hacer([{ id, despues: antes }]) && st.on) pintar(); } });
      return true;
    },
    // o (the iPhone, D-267): the period and the «Tareas» switch to sum with, without changing this page's own
    datos: async o => { const d = await leer(); if (!o) return calcular(d); const g = Object.fromEntries(Object.keys(o).map(k => [k, st[k]])); Object.assign(st, o); try { return calcular(d); } finally { Object.assign(st, g); } },
    lista: async () => { await cargarTK(); return listaMovil(); },
    valor: async id => { await cargarTK(); const r = TK.get(id); return r && !r._b ? copia(r) : null; },
    nuevoId: tipo => nuevoId(tipo === 'nota' ? 'nt' : tipo === 'sub' ? 'st' : 'tk'),   // a task's id before it is made (the iPhone's operation, D-267); a subtask's (D-272)
    campo: (id, campo, sid) => campoTarea(id, campo, sid), editar: (id, campo, v) => editarTarea(id, campo, v),   // the iPhone edits field by field (D-272)
    tareas: async () => { await leer(); return vivos().map(copia); },
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
#mesa .pp-cifras{flex:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}
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
#mesa .pp-sub{font-size:12px;color:var(--mute);padding:8px 10px 2px}#mesa .pp-sub span{margin-left:4px}
#mesa .pp-nada{margin:0;font-size:12.5px;color:var(--mute);padding:6px 10px 18px}
#mesa .pp-lista{display:flex;flex-direction:column;gap:1px}
#mesa .pp-av{display:grid;grid-template-columns:28px 42px 32px minmax(0,1fr);align-items:center;column-gap:10px;width:100%;min-height:52px;padding:5px 10px;border:0;background:none;border-radius:var(--r-sm);font:inherit;font-size:13px;color:var(--ink);text-align:left;cursor:pointer;transition:background var(--d1) var(--ease)}
#mesa .pp-av > :is(.pp-avs,.pp-cu,.pp-afoto){grid-row:1 / span 2}
#mesa .pp-av .pp-nm{align-self:end}#mesa .pp-av .pp-est{grid-column:4;align-self:start;margin-top:-2px}
#mesa .pp-av.tarea .pp-nm,#mesa .pp-av:not(:has(.pp-est:not(:empty))) .pp-nm{grid-row:1 / span 2;align-self:center}
#mesa .pp-av .pp-est:empty{display:none}
#mesa .pp-av.tarea{cursor:default}
#mesa .pp-av.pp-avinf{cursor:default}#mesa .pp-av.pp-avinf:active{transform:none}   /* the «Cómo fue» notice: a reminder, nothing opens (D-362) */
#mesa button.pp-av:hover{background:var(--bg-2)}
#mesa .pp-grupo[data-cat="hoy"] .pp-av.sinprog{box-shadow:inset 3px 0 0 var(--chg)}#mesa .pp-grupo[data-cat="hoy"] .pp-av.sinprog .pp-cu{color:var(--chg);font-weight:600}
#mesa .pp-grupo[data-cat="hoy"] .pp-av.pp-avhoy{background:var(--chg-soft)}#mesa .pp-grupo[data-cat="hoy"] button.pp-av.pp-avhoy:hover{background:var(--chg-soft);box-shadow:inset 3px 0 0 var(--chg),inset 0 0 0 1px var(--chg)}   /* D-300: at hover the row keeps its tint (4.87:1 light, 7.26:1 dark) and a thin ring of its colour */
#mesa .pp-grupo[data-cat="hoy"] .pp-av.pp-avhoy :is(.pp-est,.pp-mano){color:var(--chg);font-weight:600}
#mesa .pp-grupo[data-cat="pasado"] .pp-av.sinprog{background:var(--red-soft);box-shadow:inset 3px 0 0 var(--red)}#mesa .pp-grupo[data-cat="pasado"] button.pp-av.sinprog:hover{background:var(--red-soft);box-shadow:inset 3px 0 0 var(--red),inset 0 0 0 1px var(--red)}   /* D-300: the red no longer darkens (it fell to 3.96:1) */
#mesa .pp-grupo[data-cat="pasado"] .pp-av.sinprog .pp-est,#mesa .pp-grupo[data-cat="pasado"] .pp-av.sinprog .pp-mano{color:var(--red);font-weight:600}
#mesa .pp-grupo[data-cat="hoy"] .pp-av.tarea.pp-avhoy:hover{box-shadow:inset 3px 0 0 var(--chg),inset 0 0 0 1px var(--chg)}#mesa .pp-grupo[data-cat="pasado"] .pp-av.tarea.sinprog:hover{box-shadow:inset 3px 0 0 var(--red),inset 0 0 0 1px var(--red)}   /* D-300: a task or a session, as a post */
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
#mesa .pp-est .pp-web{color:var(--acc-ink);font-weight:600}
#mesa .pp-mano{color:var(--ink-2);font-weight:600}
#mesa .pp-av.hecha .pp-nm b,#mesa .pp-tk.hecha .pp-tt,#mesa .pp-fi.hecha .pp-tt{text-decoration:line-through;color:var(--mute);font-weight:400}
#mesa .pp-mas{align-self:flex-start;border:0;background:none;border-radius:var(--r-pill);font:inherit;font-size:12.5px;font-weight:600;color:var(--ink-2);padding:4px 10px;margin:2px 0 0 112px;cursor:pointer}
#mesa .pp-mas:hover{background:var(--bg-2);color:var(--ink)}
#mesa .pp-orden{font-size:13px;color:var(--mute);padding:6px 10px}
/* the avatar: its photo, or its initial in its kit's colour */
#mesa .pp-ava{flex:none;width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;background:var(--bg-3);color:var(--ink-2);font-size:12.5px;font-weight:800;line-height:1}
#mesa .pp-ava.xs{width:20px;height:20px;font-size:10.5px}
#mesa .pp-avn{display:inline-flex;align-items:center;gap:3px;flex:none}#mesa .pp-avn > span:last-child{font-size:11px;font-weight:600;color:var(--mute);font-variant-numeric:normal}
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
#mesa .pp-dot.h{box-shadow:inset 0 0 0 1.5px var(--story)}#mesa .pp-dot.e{border-radius:1.5px;background:var(--acc)}#mesa .pp-dot.t{border-radius:1.5px;background:var(--mute)}
#mesa .pp-cab span{display:flex;flex-direction:column;align-items:center;font-size:10.5px;line-height:1.2;color:var(--mute)}
#mesa .pp-cab b{font-weight:400}#mesa .pp-cab .hoy{color:var(--ink);font-weight:600}#mesa .pp-cab .hoy b{font-weight:600}
#mesa .pp-tira.mes.pp-cab span{font-size:9.5px}
#mesa .pp-pfn button{min-width:32px;padding:0 10px}
/* the tasks */
#mesa .pp-nueva{display:flex;align-items:center;gap:2px;height:32px;padding:0 2px 0 10px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel-2);margin-bottom:6px;transition:border-color var(--d1) var(--ease),box-shadow var(--d1) var(--ease)}
#mesa .pp-nueva:focus-within{border-color:var(--pp-escr);box-shadow:none}
#mesa .pp-nin{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none;height:30px;padding:0}
#mesa .pp-nin::placeholder{color:var(--mute)}
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
#mesa .pp-tk.pp-mk-hoy{background:var(--chg-soft);box-shadow:inset 3px 0 0 var(--chg)}#mesa .pp-tk.pp-mk-hoy .pp-tf{color:var(--chg);font-weight:600}#mesa .pp-tk.pp-mk-man{box-shadow:inset 3px 0 0 var(--chg)}
#mesa .pp-tk.pp-mk-pasado{background:var(--red-soft);box-shadow:inset 3px 0 0 var(--red)}   /* D-300: a task not done, as a post not scheduled */
#mesa .pp-tk.pp-mk-hoy:hover{background:var(--chg-soft);box-shadow:inset 3px 0 0 var(--chg),inset 0 0 0 1px var(--chg)}#mesa .pp-tk.pp-mk-pasado:hover{background:var(--red-soft);box-shadow:inset 3px 0 0 var(--red),inset 0 0 0 1px var(--red)}
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
#mesa .pp-fi.sigue-i,#mesa .pp-mt.sigue-i{border-top-left-radius:0;border-bottom-left-radius:0}#mesa .pp-fi.sigue-d,#mesa .pp-mt.sigue-d{border-top-right-radius:0;border-bottom-right-radius:0}
#mesa .pp-fi .pp-tt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-wrap-style:pretty}
#mesa .pp-fi .pp-tt i{font-style:normal;color:var(--red);font-weight:600}
#mesa .pp-fi .pp-ck{margin-top:1px;width:13px;height:13px}#mesa .pp-fi .pp-ava.xs{width:16px;height:16px;font-size:9.5px;margin-left:auto}#mesa .pp-fi .pp-avn{margin-left:auto}#mesa .pp-fi .pp-avn .pp-ava.xs{margin-left:0}
#mesa .pp-fi.venc .pp-tt{color:var(--red)}#mesa .pp-fi.pp-mk-hoy{background:var(--chg-soft)}#mesa .pp-fi.pp-mk-pasado{background:var(--red-soft)}   /* D-300: in Semana and Mes, only the tint (the cell already says today) */
#mesa .pp-mcab,#mesa .pp-mgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:var(--cx-gap)}
#mesa .pp-mcab span{font-size:10.5px;color:var(--cx-wk-c);padding:0 4px 4px}
#mesa .pp-md{display:flex;flex-direction:column;gap:2px;min-width:0;min-height:68px;padding:4px;border-radius:var(--cx-r);background:var(--panel)}
#mesa .pp-md.hoy{box-shadow:var(--cx-hoy)}#mesa .pp-md.fuera{background:none}
#mesa .pp-sd:hover,#mesa .pp-md:hover,#mesa .pp-dia:hover{background:var(--cx-hov);transition:background-color var(--d1) var(--ease)}   /* each day under the mouse, as the date's calendar: in --d1, gone at once (D-313, A49-10) */
#mesa .pp-sd:hover,#mesa .pp-md:hover,#mesa .pp-dia:hover{background:var(--bg-3)}   /* Semana and Mes sit on a card of --bg-2, --cx-hov's tone, and the strip on a block that turns --bg-2 under the mouse: one step deeper, or the day would melt into it (D-313) */
@media (prefers-reduced-motion:reduce){#mesa .pp-sd:hover,#mesa .pp-md:hover,#mesa .pp-dia:hover{transition:none}}
#mesa .pp-mn{font-size:10.5px;color:var(--mute);line-height:1.2}#mesa .pp-md.hoy .pp-mn{color:var(--ink);font-weight:600}#mesa .pp-md.fuera .pp-mn{color:var(--cx-otro)}
#mesa .pp-mt{display:block;min-width:0;padding:2px 5px;border-radius:var(--r-xs);background:var(--panel-2);box-shadow:var(--shadow-xs);font-size:11.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .pp-mt img{width:14px;height:14px;border-radius:3px;object-fit:cover;vertical-align:-3px;margin-right:4px}
#mesa .pp-mt.venc{color:var(--red)}#mesa .pp-mt.pp-mk-hoy{background:var(--chg-soft)}#mesa .pp-mt.pp-mk-pasado{background:var(--red-soft)}#mesa .pp-mt.hecha{text-decoration:line-through;color:var(--mute)}
#mesa .pp-mm{font-size:10.5px;color:var(--mute);padding:0 4px}
/* the notes: small post-its in a row above the list */
#mesa .pp-pn{display:flex;gap:8px;margin:0 0 12px;overflow-x:auto;padding:2px 2px 4px;margin-left:-2px}
#mesa .pp-pt{position:relative;display:flex;flex:0 0 172px;height:64px;padding:8px 10px;min-width:0;border-radius:var(--r-xs);background:var(--postit-2);color:var(--postit-ink);box-shadow:var(--shadow-xs);font-size:12px;line-height:1.35}
#mesa .pp-ptx{flex:1;margin:0;min-width:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}
#mesa .pp-ptx .pp-el{display:block}
#mesa .pp-pt{cursor:pointer;transition:box-shadow var(--d1) var(--ease)}#mesa .pp-pt:hover{box-shadow:var(--shadow-xs),0 0 0 1px var(--postit-3)}
#mesa .pp [data-pp="tver"]{cursor:pointer;outline:none}#mesa .pp :is(.pp-tk,.pp-fi,.pp-av.tarea){cursor:pointer}
#mesa .pp [data-pp="tver"]:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:var(--r-xs)}
/* sessions (D-206): as a task, with the clapperboard and their time; «Reprogramar» when one went past */
#mesa .pp-tses{flex:none;display:inline-flex;width:15px;height:15px;color:var(--mute)}#mesa .pp-tses svg{width:15px;height:15px}
#mesa .pp-fi .pp-tses{margin-top:1px;width:13px;height:13px}#mesa .pp-fi .pp-tses svg{width:13px;height:13px}
#mesa .pp-fi .pp-tt em{font-style:normal;color:var(--mute)}
#mesa .pp-mt.ses svg{width:11px;height:11px;margin-right:3px;vertical-align:-1px;color:var(--mute)}
#mesa .pp-tk.ses:not(.hecha) .pp-tt,#mesa .pp-fi.ses:not(.hecha) .pp-tt,#mesa .pp-mt.ses:not(.hecha){font-weight:600}#mesa .pp-mt .pp-mh{font-weight:400}   /* D-226: a session stands out among the tasks; its time, as in Lista and Semana */
#mesa .pp-tk.ses:not(.hecha) .pp-tses,#mesa .pp-fi.ses:not(.hecha) .pp-tses,#mesa .pp-mt.ses:not(.hecha) svg{color:var(--ty-ses-ink)}
#mesa .pp-av.repro{grid-template-columns:28px 42px 32px minmax(0,1fr) auto}
#mesa .pp-repro{grid-row:1 / span 2;grid-column:5}
#mesa .pp-repro svg{width:13px;height:13px}
#mesa .pp-av.ses .pp-cu{line-height:1.25}
/* the sporadic clients (E2, D-207): «Mensuales · Esporádicos» next to the title, their blocks, «+ Esporádico» */
#mesa .pp-phl{display:inline-flex;align-items:center;gap:12px;min-width:0;flex-wrap:wrap}
#mesa .pp-tcv button span{font-weight:400;color:var(--mute);margin-left:3px}#mesa .pp-tcv button.on span{color:var(--ink-2)}
#mesa .pp-esb{gap:10px}
#mesa .pp-esf{display:flex;align-items:center;gap:8px;min-width:0;padding:7px 10px;border-radius:var(--r-sm);background:var(--bg-2);font-size:12.5px}
#mesa .pp-esf svg{flex:none;width:14px;height:14px;color:var(--mute)}
#mesa .pp-esf b{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .pp-esf span{flex:none;color:var(--mute);white-space:nowrap}
#mesa .pp-esb:hover .pp-esf{background:var(--bg-3)}
#mesa .pp-esn{margin:6px 0 2px 8px}
/* a client's payments (D-235): the line under its block, opening its «Cobros», and the sums in the header */
#mesa .pp-bw{display:flex;flex-direction:column;min-width:0;border-radius:var(--r-md);transition:background var(--d1) var(--ease)}
#mesa .pp-bw > .pp-blq{flex:1 1 auto}
#mesa .pp-cob{display:flex;align-items:center;gap:6px;align-self:flex-start;max-width:calc(100% - 16px);min-height:26px;margin:-2px 0 6px 8px;padding:2px 4px;border:0;border-radius:var(--r-sm);background:none;font:inherit;font-size:12.5px;line-height:1.35;text-align:left;color:var(--mute);cursor:pointer}
#mesa .pp-cob span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#mesa .pp-cob svg{flex:none;width:14px;height:14px}
#mesa .pp-cob.tarde{color:var(--red);font-weight:600}#mesa .pp-cob.pend{color:var(--chg)}
#mesa .pp-cob:hover{background:var(--bg-2)}
#mesa .pp-cob:focus-visible{outline:2px solid var(--focus);outline-offset:1px}#mesa .pp-cob:active{transform:scale(.97)}#mesa .pp-cob{transition:background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-cob.vacia{visibility:hidden;pointer-events:none}
#mesa .pp-cmas:disabled,#mesa .pp-cmas:disabled:hover,#mesa .pp-cmas:disabled:active{color:var(--faint);background:none;cursor:default;transform:none}
#mesa .pp-ing{display:inline-flex;align-items:center;gap:6px 12px;font-size:13px;color:var(--mute);white-space:nowrap}#mesa .pp-clientes > .pp-phr{flex-wrap:wrap}
#mesa .pp-ing b{font-weight:800;color:var(--ink)}#mesa .pp-ing svg{width:16px;height:16px;flex:none}
#mesa .pp-clientes > .pp-phr{container-type:inline-size}@container (max-width:740px){#mesa .pp-clientes > .pp-phr > .pp-ing{order:3;flex-basis:100%}}
/* a task or a note big (D-182): one card over the page, to read; a double click writes in it */
#mesa .pp-ov{position:absolute;inset:0;z-index:4;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:16px}
#mesa .pp-ov.entra{animation:pp-ovin var(--d2) var(--ease)}#mesa .pp-ov.entra .pp-card{animation:pp-cardin var(--d2) var(--ease)}
#mesa .pp-ov.sale{pointer-events:none;animation:pp-ovout var(--d1) var(--ease) forwards}#mesa .pp-ov.sale .pp-card{animation:pp-cardout var(--d1) var(--ease) forwards}
@keyframes pp-ovin{from{opacity:0}}@keyframes pp-ovout{to{opacity:0}}
@keyframes pp-cardin{from{opacity:0;transform:scale(.97)}}@keyframes pp-cardout{to{opacity:0;transform:scale(.97)}}
#mesa .pp-ov svg{stroke-width:var(--i-trazo)}#mesa .pp-ov svg :is(path,rect,circle,line){vector-effect:non-scaling-stroke}
#mesa .pp-card{position:relative;width:min(560px,100%);max-height:calc(100% - 32px);overflow:auto;background:var(--panel);color:var(--ink);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);padding:22px 24px 20px;outline:none}
#mesa .pp-ch{display:flex;align-items:flex-start;gap:12px}
#mesa .pp-ch .pp-ck{margin-top:6px;width:17px;height:17px}
#mesa .pp-ct{flex:1;min-width:0;margin:-2px 0 -2px -6px;padding:3px 6px;border-radius:var(--r-sm);font-size:20px;font-weight:800;line-height:1.3;text-wrap:pretty;overflow-wrap:anywhere;outline:none}
#mesa .pp-card.hecha .pp-ct{text-decoration:line-through;color:var(--mute)}
#mesa .pp-cm{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;min-height:28px;margin:10px 0 0 29px;font-size:12.5px;color:var(--ink-2)}
#mesa .pp-cm > span{display:inline-flex;align-items:center;gap:6px}#mesa .pp-cm svg{flex:none;width:14px;height:14px;color:var(--mute)}
#mesa .pp-cm .rojo{color:var(--red);font-weight:600}#mesa .pp-cm .rojo svg{color:var(--red)}
#mesa .pp-cmf :is(.mx-sel,.mx-f){min-height:28px;height:28px;border-color:transparent;background:var(--bg-2);border-radius:var(--r-pill)}
#mesa .pp-cmf :is(.mx-sel,.mx-f):hover{border-color:var(--line-strong)}
#mesa .pp-cfo{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0 29px}#mesa .pp-cfo .pp-tfo{width:56px;height:56px;border-radius:var(--r-sm)}
/* what is written in the page (D-213, 6-A): the field being written, one line of 1 px in terracotta at 50 %, no background
   nor ring; the others in a card being written look as read (nothing moves going from reading to writing) */
#mesa{--pp-escr:color-mix(in oklab,var(--acc-ink) 50%,transparent)}
#mesa .pp-card.ed .pp-ct:focus,#mesa .pp-card.ed .pp-cd:focus,#mesa .pp-card.ed .pp-cn:focus,#mesa .pp-cst:focus,#mesa .pp-ov .escribiendo,#mesa .pp-pl-ein{background:none;box-shadow:inset 0 0 0 1px var(--pp-escr);border-radius:var(--r-sm);outline:none}
#mesa .pp-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
#mesa .pp-tl{display:flex;align-items:center;gap:6px;min-width:0}#mesa .pp-col .pp-tt{flex:0 1 auto;min-width:0}#mesa .pp-fi .pp-tl{align-items:flex-start}
#mesa .pp-tdet{flex:none;display:inline-flex;width:14px;height:14px;color:var(--mute)}#mesa .pp-tdet svg{width:14px;height:14px}#mesa .pp-fi .pp-tdet{margin-top:1px}
#mesa .pp-pg{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1;color:var(--mute)}
#mesa .pp-pb{position:relative;flex:none;width:64px;height:3px;border-radius:var(--r-pill);background:var(--line2);overflow:hidden}
#mesa .pp-pb i{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--acc)}#mesa .pp-pg.todo .pp-pb i{background:var(--ok)}#mesa .pp-fi .pp-pb{width:44px}
#mesa .pp-cd{margin:16px 0 0 19px;padding:8px 10px;min-height:22px;border-radius:var(--r-sm);cursor:text;font-size:14px;line-height:1.5;color:var(--ink-2);white-space:pre-wrap;overflow-wrap:anywhere;outline:none}
#mesa .pp-cd.vacio{color:var(--mute)}
#mesa .pp-card.ed .pp-cd:empty::before{content:attr(data-ph);color:var(--mute)}
#mesa .pp-cs{margin:14px 0 0 29px}
#mesa .pp-csh{display:flex;align-items:center;gap:10px;margin:0 0 6px;font-size:12px;color:var(--mute)}#mesa .pp-csh .pp-pb{flex:1;width:auto;height:4px}
#mesa .pp-csub{display:flex;align-items:center;gap:10px;min-height:32px;padding:0 6px;margin-left:-6px;border-radius:var(--r-sm);font-size:13.5px}
#mesa .pp-csub > span{flex:1;min-width:0;overflow-wrap:anywhere}#mesa .pp-csub.hecha > span,#mesa .pp-csub.hecha .pp-cst{text-decoration:line-through;color:var(--mute)}
#mesa .pp-cst{flex:1;min-width:0;height:28px;border:0;border-radius:var(--r-xs);padding:0 8px;margin-left:-8px;font:inherit;font-size:13.5px;color:var(--ink);background:none;outline:none}
#mesa .pp-csx{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;padding:0;background:none;border-radius:var(--r-xs);color:var(--mute);cursor:pointer;transition:background var(--d1) var(--ease)}
#mesa .pp-csx:hover{background:var(--bg-3);color:var(--ink)}#mesa .pp-csx svg{width:14px;height:14px}
#mesa .pp-cmas{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0 -4px;padding:5px 8px;border:0;background:none;border-radius:var(--r-pill);font:inherit;font-size:12.5px;font-weight:600;color:var(--acc-ink);cursor:pointer;transition:background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-cmas svg{width:14px;height:14px}#mesa .pp-cmas:hover{background:var(--acc-soft)}#mesa .pp-cmas:active{transform:scale(.97)}
#mesa :is(.pp-cmas,.pp-csx):focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp-card.nota{width:min(440px,100%);min-height:280px;display:flex;background:var(--postit-2);color:var(--postit-ink);border-radius:var(--r-sm);padding:22px 24px}
#mesa .pp-cn{flex:1;min-width:0;margin:-6px -8px;padding:6px 8px;border-radius:var(--r-sm);font-size:16px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;outline:none}
#mesa .pp-card.nota.ed .pp-cn{cursor:text}
/* widen (D-205): the icon on the top right; widened, the whole page under the mesa's header */
/* top right: the eye, widen and the × (D-209), 32 px buttons with 18 px icons, side by side, drawn as the mesa's × */
#mesa .pp-cbs{display:inline-flex;align-items:center;flex:none}
#mesa .pp-card > .pp-cbs,#mesa .pp-ch > .pp-cbs{position:absolute;top:19px;right:16px;z-index:2}
#mesa .pp-cb{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;color:var(--ink-2)}
#mesa .pp-cb:hover{background:var(--bg-2);color:var(--ink)}
#mesa .pp-cb svg{width:18px;height:18px}
#mesa .pp-cb:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp-ch{padding-right:60px}
#mesa .pp-card.nota{padding-right:92px}
#mesa .pp-card.nota .pp-cb{color:color-mix(in oklab,var(--postit-ink) 62%,var(--postit-2))}
#mesa .pp-card.nota .pp-cb:hover{background:var(--postit-3);color:var(--postit-ink)}
/* read, a click writes where it is pressed (D-209): the text cursor says so; the date and the client open their control */
#mesa .pp-card .pp-ct,#mesa .pp-card .pp-cn,#mesa .pp-card .pp-cd,#mesa .pp-csub > span{cursor:text}
#mesa .pp-cml{cursor:pointer;border-radius:var(--r-xs)}#mesa .pp-cml:hover{color:var(--ink)}#mesa .pp-cml.vacio{color:var(--mute);opacity:0;transition:opacity var(--d1) var(--ease)}#mesa .pp-cml.vacio svg{color:inherit}#mesa .pp-cml.vacio:hover{color:var(--ink)}
#mesa .pp-cm:hover .pp-cml.vacio,#mesa .pp-card:focus-visible .pp-cml.vacio,#mesa .pp-cm:focus-within .pp-cml.vacio{opacity:1}   /* «Fecha» and «Cliente» of a task without them, only with the pointer over them or the focus, their place kept (D-231) */
#mesa .pp-ov.amplia{padding:0;background:var(--bg);align-items:stretch;justify-content:stretch}
#mesa .pp-ov.amplia .pp-card{width:100%;max-width:none;max-height:none;height:100%;min-height:0;border-radius:0;box-shadow:none;padding:44px 56px 48px}#mesa .pp-ov.amplia .pp-card:focus-visible{outline-offset:-2px}
#mesa .pp-ov.amplia .pp-card.nota{padding:52px 64px 48px;background:var(--postit-2)}
#mesa .pp-card.amplia > .pp-cbs{top:16px;right:16px}#mesa .pp-card.amplia .pp-ch > .pp-cbs{top:46px;right:48px}
#mesa .pp-card.amplia:not(.nota){display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,470px);column-gap:56px;align-content:start}
#mesa .pp-card.amplia > .pp-ch,#mesa .pp-card.amplia > .pp-cm,#mesa .pp-card.amplia > .pp-cfo{grid-column:1 / -1}
#mesa .pp-card.amplia > .pp-cd{grid-column:1;margin-top:24px}
#mesa .pp-card.amplia > .pp-cs{grid-column:2;margin:30px 0 0}
#mesa .pp-card.amplia .pp-ct{font-size:26px}#mesa .pp-card.amplia .pp-ch .pp-ck{margin-top:10px}
#mesa .pp-card.amplia .pp-cn{font-size:16px}
#mesa .pp-fpick{position:fixed;width:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1}
/* a task's photo, big */
#mesa .detail[data-dlg="pp-foto"] .card.dlg{max-width:min(94vw,980px);width:auto;padding:12px 12px 10px}
@media (prefers-reduced-motion:reduce){#mesa .pp-bw,#mesa .pp-cob{transition:none}#mesa .pp-cob:active{transform:none}#mesa .pp-cml.vacio{transition:none}#mesa .pp-pc{animation:none}#mesa .pp-ov.entra .pp-card{animation-name:pp-ovin}#mesa .pp-ov.sale .pp-card{animation:none}#mesa .pp-cmas:active{transform:none}#mesa .pp :is(.pp-fold,.pp-cifra,.ibtn,.pp-tc,button.pp-av,.pp-blq,.pp-mas,button.pp-tfo):active,#mesa .brand.pp-logo:active svg{transform:none}}
@media (max-width:720px){
  #mesa .pp{padding:4px 12px 24px}
  #mesa .pp-cifra{padding:10px 10px 11px}#mesa .pp-cifra span{font-size:12px}
  #mesa .pp-in{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "izq" "rail"}
  #mesa .pp-top{flex-direction:column;align-items:stretch;gap:6px}#mesa .pp-periodo{padding:0 8px 6px}
  #mesa .pp-bgrid,#mesa .pp-bcab{grid-template-columns:minmax(0,1fr)}#mesa .pp-bcab > .pp-cab + .pp-cab{display:none}
  #mesa .pp-sem{grid-template-columns:repeat(4,minmax(0,1fr))}#mesa .pp-sd{min-height:84px}
  #mesa .pp-tv.dos{grid-template-columns:minmax(0,1fr)}#mesa .pp-md{min-height:52px}#mesa .pp-mt{font-size:10.5px}
  #mesa .pp-av{column-gap:8px}
  #mesa .pp-ov.amplia .pp-card{padding:28px 16px 32px}#mesa .pp-ov.amplia .pp-card.nota{padding:56px 20px 32px}#mesa .pp-card.amplia .pp-ch{padding-right:68px}#mesa .pp-card.amplia .pp-ch > .pp-cbs{top:30px;right:8px}
  #mesa .pp-card.amplia:not(.nota){grid-template-columns:minmax(0,1fr)}#mesa .pp-card.amplia > .pp-cs{grid-column:1;margin:14px 0 0 29px}
}
`;
  // the mesa never waits for this file: this file waits for the mesa's shell (put in the body when the mesa opens)
  (function esperarShell() {
    if (document.documentElement.hasAttribute('data-movil')) return;   // the iPhone (D-267): no page, only its sums and its tasks
    const listo = () => { const X = I(); return !!(X && X.shellReady && X.shellReady() && X.idbAll && X.estilo); };
    if (listo()) return montar();
    let t = 0; const mo = new MutationObserver(() => { if (listo()) { mo.disconnect(); clearInterval(t); montar(); } });
    mo.observe(document.body || document.documentElement, { childList: true });
    t = setInterval(() => { if (listo()) { mo.disconnect(); clearInterval(t); montar(); } }, 250);
  })();
  (window.MESA_CARGA = window.MESA_CARGA || {}).personal = 'ok';   // it ran to the end: a module that throws while loading is told apart (D-115)
})();
