// Sesiones — Mesa de trabajo · v1.4 (D-206, D-207, D-208, D-234)
// The personal page's sessions and sporadic clients. A session (Foto · Vídeo · Foto y vídeo · Libre) is a sheet for the client
// and for the shoot at once: its sections come from Kevin's Notion templates, each with an eye (the client will see it, or only
// Kevin), in two columns with a separator; a sporadic client has a file with its notes, sessions and tasks and can become a
// monthly one. Everything lives in the store 'tareas' (tipo 'sesion', 'esporadico', 'material'), so it travels in «⇅ Exportar»,
// and a session's photos in their own store 'tfotos' (D-206: writing in a session never writes its photos again). Nothing is
// built for the client yet: the eye is only a datum, except for the posts' calendar (D-219). Sessions never go to Notion nor
// Zernio (D-184). 1.2 (mesa ≥ 4.24): a session has several clients (`clientes`, D-217) and maybe an end (`fin`, D-218); the
// material comes from one of several named templates (D-220); «Duplicar sesión» (D-221).
//   M.material: cargar(lista) · ver()          (the template by default, «Equipo completo», which Claude loads; the lists aren't in
//                                              the code: the repo is public)
// It waits for personal.js (its card, its ⌘Z, its writing); if it doesn't load, the sessions still show in the lists.
(function sesionesBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;
  const MOVIL = document.documentElement.hasAttribute('data-movil');   // the iPhone (D-275): nothing mounted, only its view and its setters
  const VERSION = '1.11';   // 1.11: what a sporadic client sees of a session (paraCliente), its conversation in the sheet, its page's «Vista cliente» with its calendar, «Pasar a mensual» keeps its id (D-378).   // 1.10: a sporadic client's page (it was a file): its head, its agenda and calendar, its tasks and notes, its payments and its IVA; «Pasar a mensual…» with its type (D-377). 1.9: 1.9: «Reunión», one kind of session more — «Orden del día · Notas · Acuerdos», no payment, the eye crossed out by default; «Nueva reunión» from the board's calendar (D-291). 1.8: «Nueva sesión» with a day given (the board's calendar, D-285); «/-» a separator in its texts (D-283). 1.7: on the iPhone nothing mounts; M.sesiones.movil (vista, campo, editar) for the whole session (D-275). 1.6: a session's photo that hasn't come down from the server yet (lot 4 of the traspaso) waits instead of breaking the sheet, and is read again when it arrives (D-259). 1.5: with the cloud on, the loose photos are cleaned only once everything came down, and only here (D-256). 1.4: a sporadic client's file has its «Cobros», one per session and client (cobros.js); «Pasar a mensual» takes them (D-234); drawing the file never takes the focus from what is being written in it. 1.3: the sheet changes in place only what changed (D-223); seen as the client, no empty section («Aún sin detalles» if none is left) and the separator still (D-228); the end the same day, its calendar with the pointer over it; --mute for what is read (D-231). 1.2: a chip each client and «+ Cliente» (D-217); «– Fin» (D-218); fixed in «Ver como el cliente» over the board in the vista cliente (D-219); templates of material (D-220); «Duplicar sesión» (D-221). 1.1: a click writes in the sheet and the file (D-209); the sheet widens (D-210); the mood board in columns of a cell of the feed (D-211); the shots' tabs as titles (D-214); the right column 20 px inside (D-216)
  if (M.sesiones && M.sesiones._off) { try { M.sesiones._off(); } catch (e) { /* */ } }
  let P = null;                                // personal.js's own (M.personal._p)
  const OFF = [];
  const on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };

  // ---------- what a session is made of ----------
  // a meeting (D-291): one kind more, with its own template, no payment and only for Kevin by default
  const CLASES = [['foto', 'Foto', 'camara'], ['video', 'Vídeo', 'video'], ['fotovideo', 'Foto y vídeo', 'sesion'], ['libre', 'Libre', 'libre'], ['reunion', 'Reunión', 'reunion']];
  const claseTxt = k => (CLASES.find(c => c[0] === k) || CLASES[2])[1];
  const nombreDe = k => k === 'reunion' ? 'Reunión' : k === 'libre' ? 'Sesión libre' : 'Sesión de ' + claseTxt(k).toLowerCase();
  // each kind of section; the eye crossed out by default: Material, Notas, Incompletos, Transiciones and Planos recurso
  const APS = {
    orden: { n: 'Orden', t: 'texto' }, fotos: { n: 'Fotos', t: 'texto' }, planos: { n: 'Planos', t: 'planos' }, mood: { n: 'Mood board', t: 'mood' },
    material: { n: 'Material', t: 'material', oculto: true }, referencias: { n: 'Referencias', t: 'texto' }, notas: { n: 'Notas', t: 'texto', oculto: true },
    guion: { n: 'Guion', t: 'texto' }, preguntas: { n: 'Preguntas', t: 'texto' }, objetivo: { n: 'Objetivo', t: 'texto' },
    incompletos: { n: 'Incompletos', t: 'texto', oculto: true }, transiciones: { n: 'Transiciones', t: 'texto', oculto: true }, recurso: { n: 'Planos recurso', t: 'texto', oculto: true },
    ordendia: { n: 'Orden del día', t: 'texto' }, acuerdos: { n: 'Acuerdos', t: 'texto' }   // a meeting's (D-291)
  };
  const ORDEN = ['ordendia', 'orden', 'planos', 'fotos', 'mood', 'material', 'referencias', 'notas', 'acuerdos', 'guion', 'preguntas', 'objetivo', 'incompletos', 'transiciones', 'recurso'];
  // what each kind brings (Kevin's Notion template of that kind, the sections filled in 4 or more of 30 pages); a session keeps
  // its own copy and the version: changing this never touches the sessions made
  const PLANTILLA = { v: 1, foto: ['orden', 'fotos', 'mood', 'material'], video: ['orden', 'planos', 'fotos', 'mood', 'material'], fotovideo: ['orden', 'planos', 'fotos', 'mood', 'material'], libre: ['notas'], reunion: ['ordendia', 'notas', 'acuerdos'] };
  const DEF_DER = ['mood', 'material', 'notas', 'incompletos', 'referencias'];   // the right column, until moved
  function apartado(id) {
    const a = APS[id], o = { id, nombre: a.n, visible: !a.oculto };
    if (a.t === 'texto') o.texto = '';
    if (a.t === 'planos') o.pestanas = [{ id: P.nuevoId('pt'), nombre: 'Planos', items: [] }, { id: P.nuevoId('pt'), nombre: 'Vídeos', items: [] }];
    if (a.t === 'mood') o.grupos = [];
    if (a.t === 'material') o.material = { lista: matPlantilla(), hechos: [], ...(matRec() ? { plantilla: MAT_ID } : {}) };
    return o;
  }
  const tipoDe = a => (APS[a.id] ? APS[a.id].t : 'texto');   // one this version doesn't know: shown as text

  // ---------- the layout, the same for every session (this browser) ----------
  const LS = 'mesa-pp-hoja', SEP0 = 1.2 / 2.2;  // the separator by default: 1,2 : 1, as drawn
  function reparto() { try { const o = JSON.parse(P.lsGet(LS) || 'null'); if (o && Array.isArray(o.izq) && Array.isArray(o.der)) return { sep: +o.sep > 0.25 && +o.sep < 0.75 ? +o.sep : SEP0, izq: o.izq.filter(x => typeof x === 'string'), der: o.der.filter(x => typeof x === 'string') }; } catch (e) { /* */ } return { sep: SEP0, izq: [], der: [] }; }
  const guardarReparto = R => P.lsSet(LS, JSON.stringify(R));
  function columnas(r) {                       // the sections of this session in their two columns, in the remembered order
    const R = reparto(), aps = r.sesion.apartados || [], ids = aps.map(a => a.id), col = id => R.izq.includes(id) ? 'izq' : R.der.includes(id) ? 'der' : DEF_DER.includes(id) ? 'der' : 'izq';
    const orden = (c, l) => l.slice().sort((a, b) => { const L = R[c], ia = L.indexOf(a), ib = L.indexOf(b); return (ia < 0 ? 999 + ORDEN.indexOf(a) : ia) - (ib < 0 ? 999 + ORDEN.indexOf(b) : ib); });
    return { izq: orden('izq', ids.filter(id => col(id) === 'izq')), der: orden('der', ids.filter(id => col(id) === 'der')), sep: R.sep };
  }
  function mover(id, aCol, antesDe) {          // a section to a column, before another (or at its end); remembered for all
    const R = reparto(), r = rec(); if (!r) return;
    const C = columnas(r);
    for (const c of ['izq', 'der']) C[c] = C[c].filter(x => x !== id);
    const L = C[aCol], i = antesDe ? L.indexOf(antesDe) : -1; if (i < 0) L.push(id); else L.splice(i, 0, id);
    for (const c of ['izq', 'der']) { const otros = R[c].filter(x => !C.izq.includes(x) && !C.der.includes(x)); R[c] = [...C[c], ...otros]; }
    guardarReparto(R); pintarYa();
    const b = P.ov && P.ov.querySelector(`[data-ap="${CSS.escape(id)}"] [data-hj="ap-mas"]`); if (b && (!document.activeElement || document.activeElement === document.body || document.activeElement === P.ov.firstChild)) b.focus({ preventScroll: true });
  }

  // ---------- the list of material (D-208): a template in 'tareas' ('material'), copied into each session when it is made ----------
  // several templates (D-220), each a record `tipo: 'material'` with its name in `txt` and its place in `orden`; the one with
  // id 'material' is the one a new session takes («Equipo completo»: first, renamed but never deleted) and the one
  // MESA.material loads and reads
  const MAT_ID = 'material', MAT_SERIE = 'Equipo completo';
  const matRec = (id = MAT_ID) => P && P.TK.get(id);
  const matPlantilla = (id = MAT_ID) => { const m = matRec(id); return m && m.tipo === 'material' && Array.isArray(m.lista) ? P.hondo(m.lista) : []; };
  const plantillas = () => [...P.TK.values()].filter(t => t && t.tipo === 'material' && !t._b).sort((a, b) => (a.id === MAT_ID ? -1 : b.id === MAT_ID ? 1 : 0) || (+a.orden || 0) - (+b.orden || 0) || String(a.creada || '').localeCompare(String(b.creada || '')));
  const plNombre = id => { const t = matRec(id); return t && t.tipo === 'material' ? String(t.txt || '') : ''; };
  const TIPO_MAT = t => /^v/i.test(String(t || '')) ? 'video' : /^f/i.test(String(t || '')) ? 'foto' : 'ambas';
  function matNormal(l) {                      // [{nombre, familia, tipo, colgadoDe}] → the list kept, with ids; colgadoDe by name or id
    const out = [], porNombre = new Map();
    for (const x of l || []) { const n = String((x && (x.nombre || x.n)) || '').trim(); if (!n) continue; const o = { id: (x && typeof x.id === 'string' && x.id) || P.nuevoId('ma'), nombre: n, familia: String((x && x.familia) || 'Otros').trim() || 'Otros', tipo: TIPO_MAT(x && x.tipo) }; out.push(o); porNombre.set(n.toLowerCase(), o.id); }
    (l || []).forEach((x, i) => { const c = x && (x.colgadoDe || x.padre); if (!c || !out[i]) return; const id = out.some(o => o.id === c) ? c : porNombre.get(String(c).toLowerCase()); if (id && id !== out[i].id) out[i].padre = id; });
    return out;
  }
  async function matGuardar(lista, paso) {
    const now = P.ahoraISO(), m = matRec(), n = { ...(m ? P.copia(m) : { id: MAT_ID, tipo: 'material', txt: MAT_SERIE, creada: now }), lista: matNormal(lista), at: now };
    if (paso) await P.hacer([{ id: MAT_ID, despues: n }]); else await P.escribir([{ id: MAT_ID, despues: n }]);
    return n;
  }
  M.material = {
    // with the page closed, the template as it is saved (its name, D-220)
    // Claude loads Kevin's list: [{nombre, familia, tipo: 'foto' | 'video' | 'ambas', colgadoDe}]; only new, never a name of the API changed
    cargar: async lista => { await listo(); if (!Array.isArray(lista) || !lista.length) return { error: 'falta la lista' }; await P.refrescar(); if (!P.st.on) await P.cargarTK(); const n = await matGuardar(lista, false); P.pintar(); return { ok: true, n: n.lista.length }; },
    ver: async () => { await listo(); const m = await I().idbGet('tareas', MAT_ID).catch(() => null); return m && Array.isArray(m.lista) ? P.hondo(m.lista) : []; }
  };

  // ---------- a session's photos: their own store, drawn at the size they take (as D-116) ----------
  const FB = new Map();                        // photo id -> a promise of {rec, mini (url)}
  const BM = new Map();                        // 'id@WxH' -> ImageBitmap decoded at that size
  function foto(id) {                          // read once: every caller waits for the same reading
    if (!FB.has(id)) FB.set(id, (async () => { const o = { rec: null, mini: '' }; try { o.rec = await I().idbGet('tfotos', id); if (o.rec && !(o.rec.blob instanceof Blob)) { FB.delete(id); o.rec = null; } else if (o.rec && o.rec.mini instanceof Blob) o.mini = URL.createObjectURL(o.rec.mini); } catch (e) { /* gone */ } return o; })());
    return FB.get(id);
  }
  function soltarFotos() { FB.forEach(p => p.then(o => { if (o.mini) URL.revokeObjectURL(o.mini); })); FB.clear(); BM.forEach(b => { try { b.close(); } catch (e) { /* */ } }); BM.clear(); }
  let decodQ = [], decodN = 0;
  function decodificar() {                     // two at a time, off the main thread (createImageBitmap)
    while (decodN < 2 && decodQ.length) {
      const j = decodQ.shift(); if (!j.el.isConnected) continue; decodN++;
      (async () => {
        try {
          const o = await foto(j.id); if (!o.rec || !o.rec.blob || !j.el.isConnected) return;
          const k = `${j.id}@${j.w}x${j.h}`; let b = BM.get(k);
          if (!b) { b = await createImageBitmap(o.rec.blob, { resizeWidth: j.w, resizeHeight: j.h, resizeQuality: 'medium' }); BM.set(k, b); }
          if (!j.el.isConnected) return;
          const c = document.createElement('canvas'); c.width = j.w; c.height = j.h; c.getContext('2d').drawImage(b, 0, 0);
          j.el.querySelectorAll('canvas').forEach(x => x.remove()); j.el.append(c); j.el.classList.add('nitida');
        } catch (e) { /* the thumbnail stays */ } finally { decodN--; decodificar(); }
      })();
    }
  }
  // a placed photo: its thumbnail at once and, when it takes more than the thumbnail gives, its photo decoded to those pixels
  function dibujarFoto(el) {
    const id = el.dataset.f, w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    foto(id).then(o => { if (!el.isConnected) return; const im = el.querySelector('img'); if (im && o.mini && im.getAttribute('src') !== o.mini) im.src = o.mini; else if (!im && o.mini) el.insertAdjacentHTML('afterbegin', `<img src="${o.mini}" alt="" draggable="false">`); });
    const d = devicePixelRatio || 1, pw = Math.round(w * d), ph = Math.round(h * d);
    if (Math.max(pw, ph) <= 170) return;       // the thumbnail is enough (160 px)
    const k = `${id}@${pw}x${ph}`; if (el.dataset.k === k) return; el.dataset.k = k;
    decodQ.push({ el, id, w: pw, h: ph }); decodificar();
  }
  // garbage: a photo no session keeps any more (deleted, or its session gone), only at the start (no ⌘Z can bring it back)
  async function limpiar() {
    try {
      const X = I(), usadas = new Set();
      if (X.limpiezasOk && !X.limpiezasOk()) return;   // with the cloud, only once all of the server's data came down (D-256)
      for (const t of (await X.idbAll('tareas')) || []) if (t && t.tipo === 'sesion') for (const f of t.fotos || []) if (f && f.id) usadas.add(f.id);
      const t0 = Date.now() - 36e5, dia = Date.now() - 864e5;   // never one put a moment ago; never one loose since less than a day
      for (const f of (await X.idbAll('tfotos')) || []) {
        if (!f || !f.id) continue;
        if (usadas.has(f.id)) { if (f.suelta) { const { suelta, ...g } = f; await X.idbPut('tfotos', f.id, g); } continue; }
        if (+f.t > t0) continue;
        if (!f.suelta) await X.idbPut('tfotos', f.id, { ...f, suelta: Date.now() });
        else if (f.suelta < dia) await X.idbDel('tfotos', f.id);
      }
    } catch (e) { /* next time */ }
  }

  // ---------- the session being seen ----------
  const S = { vista: false, tira: false, plg: new Set(), tab: {}, campo: null, firma: '', enl: null, cosa: null };   // what the sheet shows (this visit)
  const rec = () => { const C = P && P.CARD; return C && C.ext === HOJA ? P.TK.get(C.id) : null; };
  const ap = (r, id) => (r.sesion.apartados || []).find(a => a.id === id);
  const svgI = k => P.ICO[k] || '';
  const ojoBtn = (on, cls, attrs) => `<button type="button" class="ibtn pp-hj-ojo${cls ? ' ' + cls : ''}" ${attrs} aria-pressed="${on}" title="${on ? 'Lo verá el cliente' : 'Solo para ti'}" aria-label="${on ? 'Lo verá el cliente' : 'Solo para ti'}">${on ? svgI('ojo') : svgI('ojoNo')}</button>`;
  // a session's end (D-218), in the same piece as its date and time: «– Fin» while it has none (seen with the pointer over it or
  // the focus in it); with one, «–», its date only if it is another day (else its calendar opens with its icon), its time if the
  // start has one, and ×. No date, no end
  function finHTML(r, at) {
    const f = r.fin;
    if (!f || !f.fecha) return r.fecha ? `<button type="button" class="pp-hj-fin" ${at}="fin" title="Añadir cuándo termina">– Fin</button>` : '';
    return `<span class="pp-hj-gu" aria-hidden="true">–</span><span class="pp-hj-ff${f.fecha === r.fecha ? ' mismo' : ''}"><input type="date" ${at}="fin-fecha" value="${P.esc(f.fecha)}" aria-label="Fecha de fin"></span>`
      + (r.hora ? `<input type="time" ${at}="fin-hora" value="${P.esc(f.hora || '')}" aria-label="Hora de fin">` : '')
      + `<button type="button" class="pp-hj-clx pp-hj-finx" ${at}="fin-x" title="Quitar el fin" aria-label="Quitar el fin">${svgI('x')}</button>`;
  }
  // a session's clients (D-217): a chip each (its avatar, name and ×) and «+ Cliente», the mesa's dropdown with Mensuales,
  // Esporádicos and «Nuevo esporádico» (its first option hidden: it says what the closed field shows); none, «Sin cliente»
  const opcionesMas = ya => { const o = c => `<option value="${P.esc(c.id)}">${P.esc(c.name || c.txt)}</option>`, Mn = I().CL.filter(c => !ya.includes(c.id)), E = P.esps().filter(e => !ya.includes(e.id));
    return E.length && Mn.length ? `<optgroup label="Mensuales">${Mn.map(o).join('')}</optgroup><optgroup label="Esporádicos">${E.map(o).join('')}</optgroup>` : E.length ? `<optgroup label="Esporádicos">${E.map(o).join('')}</optgroup>` : Mn.map(o).join(''); };
  function clisHTML(l, at) {                   // at: 'data-hj' in the sheet, 'data-ns' in «Nueva sesión»
    const ficha = id => { const n = P.esc((P.cliDe(id) || {}).name || ''); return `<span class="pp-hj-chip pp-hj-cl">${P.avatar(id, 'xs')}<span class="pp-hj-cln">${n}</span><button type="button" class="pp-hj-clx" ${at}="cli-x" data-c="${P.esc(id)}" title="Quitar a ${n}" aria-label="Quitar a ${n}">${svgI('x')}</button></span>`; };
    const mas = `<span class="pp-hj-chip pp-hj-clmas${l.length ? ' con' : ''}">${l.length ? svgI('mas') : svgI('cliente')}<select ${at}="cli-mas" aria-label="${l.length ? 'Otro cliente para la sesión' : 'Cliente de la sesión'}"><option value="" hidden selected>${l.length ? 'Cliente' : 'Sin cliente'}</option>${opcionesMas(l)}<option value="__nuevo" data-accion="nuevo">Nuevo esporádico</option></select></span>`;
    return l.map(ficha).join('') + mas;
  }
  const ponerClis = (x, l) => { x.clientes = [...new Set(l.filter(c => typeof c === 'string' && c))]; delete x.cliente; };   // never `cliente` again on a session
  const fotoEl = (id, w, h, meta, drag) => `<span class="pp-fo" data-f="${P.esc(id)}" style="width:${w}px;height:${h}px"${drag ? ' draggable="true"' : ''} tabindex="0" role="button" aria-label="${meta}" title="${meta}"></span>`;
  const aspecto = (r, id) => { const f = (r.fotos || []).find(x => x.id === id); return f && f.w && f.h ? f.w / f.h : 1; };
  const hechos = (a, r) => {                   // «h/n» of a section: its checkboxes in the text, its shots done, its material
    const t = tipoDe(a);
    if (t === 'texto') { const L = (P.ES() ? P.ES().lineas(a.texto || '') : []).filter(l => l.m && l.m.tipo === 'ca'); return L.length ? [L.filter(l => l.m.hecha).length, L.length] : null; }
    if (t === 'material') { const L = matDe(a, r).L; return L.length ? [L.filter(x => (a.material.hechos || []).includes(x.id)).length, L.length] : null; }
    if (t === 'mood') { const n = (a.grupos || []).reduce((s, g) => s + (g.fotos || []).length, 0); return n ? [null, n] : null; }
    return null;
  };
  function cuenta(a, r) { const h = hechos(a, r); return h ? `<span class="pp-hj-n">${h[0] == null ? h[1] : h[0] + '/' + h[1]}</span>` : ''; }
  function texto(campo, txt, vacio) {          // a text with marks: read (its checkboxes are used, D-204); written on a double click
    const vc = S.vista, h = (P.ES() ? P.ES().html(txt || '', { enlaces: true, casillas: vc ? 'vineta' : 'si' }) : P.esc(txt || ''));
    return `<div class="pp-hj-tx${h ? '' : ' vacio'}" data-campo="${P.esc(campo)}">${h}</div>`;
  }
  function aph(a, r, extra) {                  // a section's head: handle, fold, its name and count, its eye and «⋯»
    const vc = S.vista, plg = S.plg.has(a.id), nom = P.esc(a.nombre || (APS[a.id] || {}).n || a.id);
    return `<div class="pp-hj-aph">${vc ? '' : `<span class="pp-hj-asa" data-hj="asa" title="Arrastra para mover">${svgI('asa')}</span>`}`
      + `<button type="button" class="pp-hj-pl" data-hj="plegar" aria-expanded="${!plg}" title="${plg ? 'Desplegar' : 'Plegar'} ${nom.toLowerCase()}">${svgI('chev')}${extra ? `<span class="pp-hj-sr">${nom}</span>` : `<b>${nom}</b>`}</button>`
      + (extra || cuenta(a, r)) + `<span class="pp-hj-sp"></span>`
      + (vc ? '' : ojoBtn(a.visible !== false, 'sm', `data-hj="ojo-ap"`) + `<button type="button" class="ibtn pp-hj-apm" data-hj="ap-mas" aria-label="Más de ${nom}" title="Más">${svgI('mas3')}</button>`) + `</div>`;
  }
  function planosHTML(a, r) {
    const vc = S.vista, P0 = a.pestanas && a.pestanas.length ? a.pestanas : [{ id: 'p0', nombre: 'Planos', items: [] }];
    const P_ = vc && P0.some(p => (p.items || []).length) ? P0.filter(p => (p.items || []).length) : P0;   // what the client sees: a tab without elements doesn't show (D-228)
    let act = S.tab[a.id]; if (!P_.some(p => p.id === act)) { act = P_[0].id; if (!vc) S.tab[a.id] = act; }
    const pt = P_.find(p => p.id === act), sing = n => /^planos$/i.test(n) ? 'Plano' : /^v[ií]deos$/i.test(n) ? 'Vídeo' : n;
    const tabs = `<span class="pp-pl-tabs" role="tablist" aria-label="${P.esc(a.nombre || 'Planos')}">${P_.map(p => { const n = (p.items || []).length, h = (p.items || []).filter(i => i.hecho).length, c = `tab:${a.id}:${p.id}`;
      if (P.CARD.ed && S.campo === c) return `<span class="pp-pl-tab on"><span class="pp-pl-tn" data-campo="${P.esc(c)}">${P.esc(p.nombre)}</span></span>`;   // being renamed
      return `<button type="button" role="tab" class="pp-pl-tab${p.id === act ? ' on' : ''}" data-hj="tab" data-tab="${P.esc(p.id)}" aria-selected="${p.id === act}" data-campo="${P.esc(c)}"${vc ? '' : ' title="Doble clic: cambiar el nombre"'}><span class="pp-pl-tn">${P.esc(p.nombre)}</span>${n ? ` <span class="pp-hj-n">${h}/${n}</span>` : ''}</button>`; }).join('')}${vc ? '' : `<button type="button" class="ibtn pp-pl-mas" data-hj="tab-mas" title="Nueva pestaña" aria-label="Nueva pestaña">${svgI('mas')}</button>`}</span>`;
    if (S.plg.has(a.id)) return { cab: tabs, cuerpo: '' };
    const items = (pt.items || []).map(it => {
      const ref = (it.fotos || []).map(id => { const as = aspecto(r, id); return fotoEl(id, Math.round(72 * as), 72, 'Foto de referencia', false); }).join('');
      const en = (it.enlaces || []).map((u, k) => `<a class="pp-pl-en" href="${P.esc(u)}" target="_blank" rel="noopener noreferrer" data-k="${k}">${svgI('enlace')}<span>${P.esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</span></a>`).join('');
      const nueva = !vc && S.enl === it.id ? `<input type="url" class="pp-pl-ein" data-hj="en-in" placeholder="https://…" aria-label="Pegar un enlace">` : '';
      const vacia = !ref && !en && !nueva;
      return `<div class="pp-pl-it${it.hecho ? ' hecho' : ''}" data-it="${P.esc(it.id)}">${vc ? '' : `<input type="checkbox" class="pp-ck" data-hj="it-hecho" data-it="${P.esc(it.id)}"${it.hecho ? ' checked' : ''} aria-label="Hecho">`}`
        + `<div class="pp-pl-c"><div class="pp-pl-ti${it.titulo ? '' : ' vacio'}" data-campo="it:${P.esc(a.id)}:${P.esc(pt.id)}:${P.esc(it.id)}:titulo">${P.esc(it.titulo || (vc ? '' : 'Sin título'))}</div>${texto(`it:${a.id}:${pt.id}:${it.id}:texto`, it.texto, '')}</div>`
        + `<div class="pp-pl-ref" data-drop="it:${P.esc(a.id)}:${P.esc(pt.id)}:${P.esc(it.id)}">${ref ? `<div class="pp-pl-fos">${ref}</div>` : ''}${en ? `<div class="pp-pl-ens">${en}</div>` : ''}${nueva}${vacia ? `<span class="pp-pl-sin">Sin referencia</span>` : ''}${vc ? '' : `<button type="button" class="pp-pl-ena" data-hj="en-mas" title="Añadir un enlace">${svgI('enlace')}Enlace</button>`}</div></div>`;
    }).join('');
    return { cab: tabs, cuerpo: `<div class="pp-pl-items">${items}</div>${vc ? '' : `<button type="button" class="pp-cmas" data-hj="it-nuevo">${svgI('mas')}${P.esc(sing(pt.nombre))}</button>`}` };
  }
  // the mood board (D-211, C): columns as wide as a cell of the mesa's feed at 1440 px (measured: 158.7 × 211.6 px), 4 px
  // apart, each photo whole; as many columns as fit (what is left stays on the right), each photo, in its order, to the
  // shortest one; «una línea», one row as high as a cell
  const MO_COL = 157, MO_ALTO = 212, MO_GAP = 4;   // 157: 1 % under the cell, so the three columns of 4-C fit in the default split
  function moodHTML(a, r) {
    const vc = S.vista;
    const gs = (a.grupos || []).filter(g => !vc || (g.fotos || []).length).map(g => {   // what the client sees: a group without photos doesn't show (D-228)
      const una = (g.modo || 'linea') === 'linea';
      const fos = (g.fotos || []).map(id => { const as = aspecto(r, id); return fotoEl(id, una ? Math.round(MO_ALTO * as) : MO_COL, una ? MO_ALTO : Math.round(MO_COL / as), 'Mood board', false).replace('class="pp-fo"', `class="pp-fo" data-a="${as.toFixed(4)}"`); }).join('');
      return `<div class="pp-mo-g" data-g="${P.esc(g.id)}" data-drop="g:${P.esc(a.id)}:${P.esc(g.id)}"><div class="pp-mo-gh"><b class="pp-mo-gn" data-campo="g:${P.esc(a.id)}:${P.esc(g.id)}">${P.esc(g.nombre || 'Grupo')}</b><span class="pp-hj-n">${(g.fotos || []).length}</span><span class="pp-hj-sp"></span>`
        + (vc ? '' : `<div class="seg pp-tvs pp-mo-modo" role="group" aria-label="Cómo se ven"><button type="button" class="${una ? 'on' : ''}" data-hj="modo" data-m="linea" aria-pressed="${una}" title="Una línea" aria-label="Una línea">${svgI('una')}</button><button type="button" class="${una ? '' : 'on'}" data-hj="modo" data-m="todas" aria-pressed="${!una}" title="Todas" aria-label="Todas">${svgI('todas')}</button></div>`) + `</div>`
        + `<div class="pp-mo-f ${una ? 'linea' : 'todas'}${fos ? '' : ' vacio'}"${fos ? '' : ' title="Suelta aquí fotos del ordenador o de la tira"'}>${fos}</div></div>`;
    }).join('');
    return `<div class="pp-mo">${gs}</div>${vc ? '' : `<button type="button" class="pp-cmas" data-hj="g-nuevo">${svgI('mas')}Grupo</button>`}`;
  }
  // the material of a session: its own copy (or, while it has none, the list now), only what goes with its kind
  function matDe(a, r) {
    const m = a.material || { lista: [], hechos: [] }, L0 = m.lista && m.lista.length ? m.lista : matPlantilla(m.plantilla || MAT_ID), c = r.sesion.clase;
    const L = L0.filter(x => c === 'foto' ? x.tipo !== 'video' : c === 'video' ? x.tipo !== 'foto' : true);
    return { L, propia: !!(m.lista && m.lista.length) };
  }
  // the row of templates (D-220): the piece of «Mensuales · Esporádicos» (more than 5, the mesa's dropdown) and «+ Guardar como
  // plantilla»; retouched in this session, a dot on its template, «Guardar en …» and «Como plantilla nueva»
  function plsHTML(a) {
    const T = plantillas(); if (!T.length) return '';
    const m = a.material || {}, cur = m.plantilla || MAT_ID, hay = T.some(t => t.id === cur), ret = !!m.retocada;
    const pt = `<i class="pp-ma-pt" title="Con cambios en esta sesión" aria-label="Con cambios en esta sesión"></i>`;
    const sel = T.length > 5 ? `<span class="pp-hj-chip pp-ma-plsel"><select data-hj="mat-plsel" aria-label="Plantilla de material">${hay ? '' : '<option value="" hidden selected>Sin plantilla</option>'}${T.map(t => `<option value="${P.esc(t.id)}"${t.id === cur ? ' selected' : ''}>${P.esc(t.txt)}</option>`).join('')}</select></span>${ret && hay ? pt : ''}`
      : `<div class="seg pp-tvs pp-ma-pls" role="group" aria-label="Plantilla de material">${T.map(t => `<button type="button" class="${t.id === cur ? 'on' : ''}" data-hj="mat-pl" data-pl="${P.esc(t.id)}" aria-pressed="${t.id === cur}">${P.esc(t.txt)}${t.id === cur && ret ? pt : ''}</button>`).join('')}</div>`;
    const guardar = `<button type="button" class="${ret ? 'pp-ma-ge' : 'pp-cmas'}" data-hj="mat-nueva">${svgI('mas')}${ret ? 'Como plantilla nueva' : 'Guardar como plantilla'}</button>`;
    return `<div class="pp-ma-plr">${sel}<span class="pp-hj-sp"></span>${ret ? '' : guardar}</div>`
      + (ret ? `<div class="pp-ma-plr pp-ma-cmb"><span>Con cambios en esta sesión</span><span class="pp-hj-sp"></span><span class="pp-ma-gb">${hay ? `<button type="button" class="pp-ma-ge" data-hj="mat-en">Guardar en ${P.esc(plNombre(cur))}</button>` : ''}${guardar}</span></div>` : '');   // its two buttons together
  }
  function matHTML(a, r) {
    const { L } = matDe(a, r), hs = new Set((a.material && a.material.hechos) || []), ed = !S.vista;
    if (!L.length && !(ed && plantillas().length)) return `<p class="pp-pl-sin">Sin lista de material</p>`;
    if (!L.length) return `${plsHTML(a)}<p class="pp-pl-sin">Sin cosas en esta sesión</p>`;
    const fams = []; for (const x of L) if (!fams.includes(x.familia)) fams.push(x.familia);
    fams.sort((x, y) => (/^antes de salir$/i.test(y) ? 1 : 0) - (/^antes de salir$/i.test(x) ? 1 : 0));
    const orden = l => { const out = []; for (const x of l.filter(y => !y.padre || !l.some(z => z.id === y.padre))) { out.push(x); out.push(...l.filter(y => y.padre === x.id)); } return out; };
    const n = L.length, h = L.filter(x => hs.has(x.id)).length;
    // each thing: a click marks it; with the pointer over it, its × takes it out of this session (D-220); at the end of each
    // family, «+ Cosa» (written in its place: Enter puts it, Esc lets it go)
    const ficha = x => `<span class="pp-ma-w"><button type="button" class="pp-ma-c${hs.has(x.id) ? ' on' : ''}${x.padre ? ' hijo' : ''}" data-hj="mat" data-m="${P.esc(x.id)}" aria-pressed="${hs.has(x.id)}">${P.esc(x.nombre)}</button>${ed ? `<button type="button" class="pp-ma-x" data-hj="mat-x" data-m="${P.esc(x.id)}" title="Quitar de esta sesión" aria-label="Quitar ${P.esc(x.nombre)} de esta sesión">${svgI('x')}</button>` : ''}</span>`;
    const mas = f => !ed ? '' : S.cosa === f ? `<input type="text" class="pp-ma-in" data-hj="mat-in" data-fam="${P.esc(f)}" maxlength="60" aria-label="Cosa nueva de ${P.esc(f)}" placeholder="Cosa">` : `<button type="button" class="pp-ma-mas" data-hj="mat-mas" data-fam="${P.esc(f)}" aria-label="Otra cosa en ${P.esc(f)}">${svgI('mas')}Cosa</button>`;
    return (ed ? plsHTML(a) : '') + `<div class="pp-ma"><div class="pp-ma-bar">${`<span class="pp-pb" aria-hidden="true"><i style="width:${(h / n * 100).toFixed(1)}%"></i></span>`}<span>${h}/${n}</span></div>`
      + fams.map(f => { const l = orden(L.filter(x => x.familia === f)), fh = l.filter(x => hs.has(x.id)).length;
        return `<div class="pp-ma-fam${/^antes de salir$/i.test(f) ? ' antes' : ''}"><p class="pp-ma-ft"><b>${P.esc(f)}</b> <span>${fh}/${l.length}</span></p><div class="pp-ma-fi">${l.map(ficha).join('')}${mas(f)}</div></div>`; }).join('') + `</div>`;
  }
  function apHTML(a, r) {
    const t = tipoDe(a), plg = S.plg.has(a.id);
    if (t === 'planos') { const p = planosHTML(a, r); return `<section class="pp-hj-ap${plg ? ' plg' : ''}" data-ap="${P.esc(a.id)}">${aph(a, r, p.cab)}${plg ? '' : `<div class="pp-hj-apc">${p.cuerpo}</div>`}</section>`; }
    const cuerpo = plg ? '' : t === 'mood' ? moodHTML(a, r) : t === 'material' ? matHTML(a, r) : texto('ap:' + a.id, typeof a.texto === 'string' ? a.texto : '', 'Vacío');
    return `<section class="pp-hj-ap${plg ? ' plg' : ''}" data-ap="${P.esc(a.id)}">${aph(a, r)}${plg ? '' : `<div class="pp-hj-apc">${cuerpo}</div>`}</section>`;
  }
  // empty, for what the client sees (D-228): a text with nothing once spaces and line breaks are taken out; Planos without a
  // tab with elements; a mood board without a group with photos; Material without things
  function vacioAp(a, r) {
    const t = tipoDe(a);
    if (t === 'planos') return !(a.pestanas || []).some(p => (p.items || []).length);
    if (t === 'mood') return !(a.grupos || []).some(g => (g.fotos || []).length);
    if (t === 'material') return !matDe(a, r).L.length;
    return !String(typeof a.texto === 'string' ? a.texto : '').replace(/\s+/g, '');
  }
  // What its client sees of a session in its web (D-378), the same as «Ver como el cliente»: the sections with the eye open and
  // something in them, in its order; texts as written (the web draws their marks), the ids of their photos (web.js sends them
  // reduced) and Material as its families. null if the session is hidden or isn't one
  function paraCliente(r) {
    if (!r || r.tipo !== 'sesion' || !r.sesion || r.sesion.visible === false) return null;
    const fotos = [], fo = l => (l || []).map(x => typeof x === 'string' ? x : x && x.id).filter(id => typeof id === 'string' && id).map(id => { if (!fotos.includes(id)) fotos.push(id); return id; });
    const corta = (t, n) => String(t == null ? '' : t).slice(0, n);
    const contenido = (r.sesion.apartados || []).filter(a => a && a.visible !== false && !vacioAp(a, r)).map(a => {
      const t = tipoDe(a), o = { id: corta(a.id, 40), nombre: corta(a.nombre || (APS[a.id] || {}).n || a.id, 60), tipo: t };
      if (t === 'planos') o.pestanas = (a.pestanas || []).filter(p => (p.items || []).length).map(p => ({ nombre: corta(p.nombre, 40),
        items: p.items.map(it => ({ titulo: corta(it.titulo, 200), texto: corta(it.texto, 2000), fotos: fo(it.fotos), enlaces: (it.enlaces || []).map(u => typeof u === 'string' ? u : u && u.url).filter(u => typeof u === 'string' && /^https?:\/\/\S+$/.test(u) && u.length <= 1000).slice(0, 10) })) }));
      else if (t === 'mood') o.grupos = (a.grupos || []).filter(g => (g.fotos || []).length).map(g => ({ nombre: corta(g.nombre || 'Grupo', 60), modo: g.modo === 'columnas' ? 'columnas' : 'linea', fotos: fo(g.fotos) }));
      else if (t === 'material') { const fams = []; for (const x of matDe(a, r).L) { let f = fams.find(y => y.nombre === x.familia); if (!f) fams.push(f = { nombre: corta(x.familia, 60), cosas: [] }); f.cosas.push(corta(x.nombre, 80)); } o.familias = fams; }
      else o.texto = corta(typeof a.texto === 'string' ? a.texto : '', 8000);
      return o;
    });
    return { contenido, fotos };
  }
  // the sporadic clients of a session whose web has its conversation (D-378)
  const espsDe = r => P.espCli ? P.clis(r).filter(P.espCli) : [];
  function hojaHTML(r) {
    const X = I(), ses = r.sesion, vc = S.vista, vis = ses.visible !== false, nf = (r.fotos || []).length;
    // as the client sees it, neither what is struck out (D-206) nor what is empty (D-228)
    const verAp = id => { const a = ap(r, id); return a && (!vc || (vis && a.visible !== false && !vacioAp(a, r))); };
    const C = columnas(r), dos = innerWidth > 720 && (vc ? C.izq.some(verAp) && C.der.some(verAp) : C.izq.length && C.der.length);
    const nada = vc && vis && !C.izq.some(verAp) && !C.der.some(verAp);
    const col = c => C[c].filter(verAp).map(id => apHTML(ap(r, id), r)).join('');
    const faltan = ORDEN.filter(id => !ap(r, id));
    const fija = !!(P.CARD && P.CARD.vc), cls = P.clis(r).filter(P.cliOk).filter(c => !fija || c === P.CARD.cli);   // the vista cliente: only that board's client (D-219)
    // its conversation with a sporadic client (D-378): «Del cliente» at the top of the right column, for Kevin; as the client sees
    // it, its comments under the sections (to read: Kevin answers from his sheet). web.js fills them in their place (data-propio)
    const es = espsDe(r).filter(c => !fija || c === P.CARD.cli);
    const del = vc ? '' : es.map(c => `<section class="webdel pp-hj-del" data-propio data-web-ses="${P.esc(r.id)}" data-web-cli="${P.esc(c)}" aria-label="Del cliente"></section>`).join('');
    const com = vc && vis && es.length ? `<section class="pp-hj-com" data-propio data-web-ses="${P.esc(r.id)}" data-web-cli="${P.esc(es[0])}" data-web-ro aria-label="Comentarios"></section>` : '';
    const cab = `<header class="pp-hj-cab"><div class="pp-hj-t">${vc ? '' : `<input type="checkbox" class="pp-ck" data-pp="ck" data-id="${P.esc(r.id)}"${r.hecha ? ' checked' : ''} aria-label="Hecha">`}<h2 class="pp-hj-nom" data-campo="nom">${P.esc(r.txt)}</h2>${P.botonesCard(vc ? '' : ojoBtn(vis, 'pp-cb', 'data-hj="ojo"'))}</div>`
      + `<div class="pp-hj-meta">${vc ? `<span class="pp-hj-chip ro">${svgI(CLASES.find(c => c[0] === ses.clase) ? CLASES.find(c => c[0] === ses.clase)[2] : 'sesion')}${P.esc(claseTxt(ses.clase))}</span>${r.fecha ? `<span class="pp-hj-chip ro">${svgI('fecha')}${P.esc(P.tramo(r))}</span>` : ''}${cls.map(id => `<span class="pp-hj-chip ro">${P.avatar(id, 'xs')}${P.esc(P.cliDe(id).name)}</span>`).join('')}`
        : `<span class="pp-hj-chip">${svgI(CLASES.find(c => c[0] === ses.clase) ? CLASES.find(c => c[0] === ses.clase)[2] : 'sesion')}<select data-hj="clase" aria-label="Tipo de sesión">${CLASES.map(([k, l]) => `<option value="${k}"${ses.clase === k ? ' selected' : ''}>${l}</option>`).join('')}</select></span>`
        + `<span class="pp-hj-chip pp-hj-fh${r.fin ? ' confin' : ''}"><input type="date" data-hj="fecha" data-sin-fecha value="${P.esc(r.fecha || '')}" aria-label="Fecha de la sesión"><input type="time" data-hj="hora" value="${P.esc(r.hora || '')}" aria-label="Hora de la sesión">${finHTML(r, 'data-hj')}</span>`
        + clisHTML(cls, 'data-hj')
        + `<button type="button" class="pp-hj-chip pp-hj-nf" data-hj="tira" aria-expanded="${S.tira}" title="${S.tira ? 'Ocultar' : 'Ver'} las fotos de la sesión">${svgI('fotos')}${nf} ${nf === 1 ? 'foto' : 'fotos'}</button>`}`
      + `<span class="pp-hj-sp"></span>${fija ? '' : `<button type="button" class="pp-hj-vc${vc ? ' on' : ''}" data-hj="vista" aria-pressed="${vc}" title="${vc ? 'Volver a la hoja' : 'Lo que vería el cliente'}">${svgI('cliente')}Ver como el cliente</button>`}`
      + (vc ? '' : `<button type="button" class="ibtn pp-hj-mas" data-hj="mas" aria-label="Más de la sesión" title="Más">${svgI('mas3')}</button>`) + `</div>`
      + (S.tira && !vc ? `<div class="pp-hj-tira" data-drop="tira" title="Suelta aquí fotos del ordenador; arrástralas a un plano o a un grupo">${nf ? (r.fotos || []).map(f => `<span class="pp-hj-tf pp-fo" data-f="${P.esc(f.id)}" draggable="true" tabindex="0" role="button" aria-label="Foto de la sesión"></span>`).join('') : `<span class="pp-pl-sin">Sin fotos</span>`}</div>` : '') + `</header>`;
    const cuerpo = vc && !vis ? `<p class="pp-hj-oculta">${svgI('ojoNo')}El cliente no ve esta sesión</p>`
      : nada ? `<p class="pp-hj-oculta pp-hj-nada">Aún sin detalles</p>`
      : `<div class="pp-hj-cols${dos ? '' : ' una'}" style="${dos ? `grid-template-columns:minmax(0,${C.sep.toFixed(4)}fr) 17px minmax(0,${(1 - C.sep).toFixed(4)}fr)` : ''}"><div class="pp-hj-col" data-col="izq">${dos ? '' : del}${col('izq')}${dos ? '' : col('der')}${!dos && !vc && faltan.length ? `<button type="button" class="pp-cmas pp-hj-apn" data-hj="ap-nuevo">${svgI('mas')}Apartado</button>` : ''}</div>`
        + (dos && vc ? `<div class="pp-hj-sep fija" aria-hidden="true"></div><div class="pp-hj-col" data-col="der">${col('der')}</div>` : '')   // seen as the client: the line, nothing that moves (D-228)
        + (dos && !vc ? `<div class="pp-hj-sep" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Separador de las columnas" aria-valuemin="25" aria-valuemax="75" aria-valuenow="${Math.round(C.sep * 100)}" title="Arrastra para repartir · doble clic: como al principio"></div><div class="pp-hj-col" data-col="der">${del}${col('der')}${!vc && faltan.length ? `<button type="button" class="pp-cmas pp-hj-apn" data-hj="ap-nuevo">${svgI('mas')}Apartado</button>` : ''}</div>` : '') + `</div>`;
    return `<div class="pp-card pp-hj${vc ? ' vc' : ''}${P.CARD && P.CARD.ed ? ' ed' : ''}${P.CARD && P.CARD.amplia ? ' amplia' : ''}" role="dialog" aria-modal="true" aria-label="Sesión: ${P.esc(r.txt)}" tabindex="-1">${cab}${cuerpo}${com}</div>`;
  }

  // ---------- drawing the sheet ----------
  // what the sheet shows besides the record (each write leaves a new record object: compared as it is, never by its time)
  function firma(r) { return [S.vista, S.tira, [...S.plg].join(), JSON.stringify(S.tab), S.enl, S.cosa, JSON.stringify(plantillas().map(t => [t.id, t.txt, (t.lista || []).length])), P.CARD.ed, S.campo, P.lsGet(LS), innerWidth > 720, P.clis(r).map(c => (P.cliDe(c) || {}).name).join(',')].join('|'); }
  let ctlCampo = null;
  function pintar(r, o = {}) {
    const ov = P.ov; if (!ov || !r) return;
    const f = firma(r), j = JSON.stringify(r); if (!o.forzar && f === S.firma && j === S.rJ && ov.firstChild) return;
    if (P.CARD.ed && S.campo && ov.querySelector('[contenteditable]')) { guardar(false); r = rec() || r; }   // what is being written goes in first: never lost by a drawing
    S.firma = f; S.rJ = JSON.stringify(r);
    const enl = ov.querySelector('[data-hj="en-in"]'), enlV = enl ? enl.value : '';
    const c0 = ov.firstChild, y = c0 ? c0.scrollTop : 0, foco = document.activeElement && ov.contains(document.activeElement) ? claveFoco(document.activeElement) : null;
    // in place, only what changed (D-223): the text being written stays as it is, with its caret and its layer
    const viva = P.CARD.ed && S.campo ? ov.querySelector(`[data-campo="${CSS.escape(S.campo)}"][contenteditable]`) : null;
    if (ctlCampo && !viva) { ctlCampo.apagar(); ctlCampo = null; }
    P.morfar(ov, hojaHTML(r), { vivo: n => n === viva });
    if (M.controles && M.controles.mejorar) M.controles.mejorar(ov);
    if (M.web && M.web.hojaSes) M.web.hojaSes(ov);   // its conversation with a sporadic client, in its place (D-378)
    const c = ov.firstChild; if (c.scrollTop !== y) c.scrollTop = y;
    if (enlV) { const e2 = ov.querySelector('[data-hj="en-in"]'); if (e2 && e2.value !== enlV) e2.value = enlV; }
    const mi = ov.querySelector('[data-hj="mat-in"]'); if (mi && !mi._blur) { mi._blur = true; mi.addEventListener('blur', () => { if (S.cosa === mi.dataset.fam && mi.isConnected) ponerCosa(mi, false); }); }
    maquetar();
    const cl = ov.querySelector('.pp-hj-cols'); if (cl && !cl._fin) { cl._fin = true; cl.addEventListener('transitionend', ev => { if (ev.target === cl) colocarMood(); }); }   // the separator's move ends
    if (P.CARD.ed && S.campo && viva && viva.isConnected) { /* still being written: nothing to do */ }
    else if (P.CARD.ed && S.campo) escribirEn(S.campo, o.pt); else if (foco) { const b = ov.querySelector(foco); if (b) b.focus({ preventScroll: true }); else c.focus({ preventScroll: true }); } else c.focus({ preventScroll: true });
  }
  const pintarYa = () => { const r = rec(); if (r) pintar(r, { forzar: true }); };
  const claveFoco = el => { const a = el.closest('[data-hj], [data-pp], [data-campo]'); if (!a) return null; for (const k of ['hj', 'pp', 'campo']) if (a.dataset[k] != null) { const ex = a.dataset.tab ? `[data-tab="${CSS.escape(a.dataset.tab)}"]` : a.dataset.m ? `[data-m="${CSS.escape(a.dataset.m)}"]` : ''; const ap_ = a.closest('[data-ap]'); return (ap_ ? `[data-ap="${CSS.escape(ap_.dataset.ap)}"] ` : '') + `[data-${k}="${CSS.escape(a.dataset[k])}"]${ex}`; } return null; };
  // the photos where they are: a mood board's «todas» in columns of a fixed width (D-211); only their place changes when the
  // separator moves or the sheet widens, never their size
  function colocarMood() {
    const ov = P.ov; if (!ov) return;
    ov.querySelectorAll('.pp-mo-f.todas').forEach(box => {
      const fs = [...box.querySelectorAll('.pp-fo')]; if (!fs.length) { box.style.height = ''; return; }
      const W = box.clientWidth, w = Math.max(40, Math.min(MO_COL, W)), n = Math.max(1, Math.floor((W + MO_GAP) / (w + MO_GAP))), alto = new Array(n).fill(0);
      for (const el of fs) {
        let c = 0; for (let i = 1; i < n; i++) if (alto[i] < alto[c] - 0.5) c = i;   // the shortest, the leftmost on a tie
        const h = Math.round(w / (+el.dataset.a || 1));
        if (w !== MO_COL || el.style.height !== h + 'px') { el.style.width = w + 'px'; el.style.height = h + 'px'; }
        el.style.left = c * (w + MO_GAP) + 'px'; el.style.top = alto[c] + 'px'; alto[c] += h + MO_GAP;
      }
      box.style.height = (Math.max(...alto) - MO_GAP) + 'px';
    });
  }
  function maquetar() {
    const ov = P.ov; if (!ov) return;
    colocarMood();
    ov.querySelectorAll('.pp-fo').forEach(dibujarFoto);
  }
  let rzT = 0;
  function alRedimensionar() { clearTimeout(rzT); rzT = setTimeout(() => { if (rec()) { S.firma = ''; pintarYa(); } }, 120); }

  // ---------- writing in the sheet: a double click on a text writes it (D-182); Esc or a click elsewhere, back to reading ----------
  const UNA = /^(nom|tab:|g:|it:.*:titulo$)/;  // one line: Enter ends it
  function escribirEn(campo, pt) {
    const ov = P.ov, el = ov && ov.querySelector(`[data-campo="${CSS.escape(campo)}"]`); if (!el) return;
    const r = rec(), v = valorDe(r, campo);
    el.setAttribute('contenteditable', 'plaintext-only'); el.setAttribute('role', 'textbox'); el.spellcheck = true; el.classList.add('escribiendo'); el.classList.remove('vacio');
    if (!UNA.test(campo)) el.setAttribute('aria-multiline', 'true');
    el.textContent = v;
    el.focus({ preventScroll: true });
    let rg = null;
    if (pt && document.caretRangeFromPoint) { rg = document.caretRangeFromPoint(pt.x, pt.y); if (rg && !el.contains(rg.startContainer)) rg = null; }
    if (!rg) { rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); }
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg);
    if (!UNA.test(campo) && P.ES()) ctlCampo = P.ES().activar(el, { comandos: () => ['tarea', 'fecha', 'lista', 'numerada', 'casilla', 'separador'], alComando: (k, ctx) => P.comando(k, ctx, campo) });
  }
  function empezar(campo, pt) {
    if (S.vista) return;
    const C = P.CARD; if (!C) return;
    if (C.ed && S.campo === campo) return;
    const otro = C.ed && S.campo;
    if (C.ed) guardar(false);
    C.ed = true; S.campo = campo;
    // reading, a text starts being written in its place: nothing else is drawn again (D-209); a tab's name, or going from
    // one text to another, draws the sheet again with it
    const el = !otro && !/^tab:/.test(campo) && P.ov && P.ov.querySelector(`[data-campo="${CSS.escape(campo)}"]`);
    if (el) { P.ov.firstChild.classList.add('ed'); S.firma = firma(rec()); escribirEn(campo, pt); return; }
    S.firma = '';
    pintar(rec(), { forzar: true, pt });
  }
  const UNCLIC = /^(nom|ap:|it:)/;               // a click writes these; a tab's or a group's name is renamed with a double click (D-209)
  function valorDe(r, campo) {
    const p = campo.split(':');
    if (campo === 'nom') return r.txt;
    const a = ap(r, p[1]); if (!a) return '';
    if (p[0] === 'ap') return typeof a.texto === 'string' ? a.texto : '';
    if (p[0] === 'tab') return ((a.pestanas || []).find(x => x.id === p[2]) || {}).nombre || '';
    if (p[0] === 'g') return ((a.grupos || []).find(x => x.id === p[2]) || {}).nombre || '';
    if (p[0] === 'it') { const it = (((a.pestanas || []).find(x => x.id === p[2]) || {}).items || []).find(x => x.id === p[3]); return it ? it[p[4]] || '' : ''; }
    return '';
  }
  function poner(x, campo, v) {                // into a copy of the record; false if it doesn't change
    const p = campo.split(':');
    if (campo === 'nom') { const n = v.replace(/\s*\n\s*/g, ' ').trim(); if (!n || n === x.txt) return false; x.txt = n; return true; }
    const a = ap(x, p[1]); if (!a) return false;
    if (p[0] === 'ap') { if (a.texto === v) return false; a.texto = v; return true; }
    if (p[0] === 'tab') { const t = (a.pestanas || []).find(y => y.id === p[2]), n = v.replace(/\s+/g, ' ').trim(); if (!t || !n || t.nombre === n) return false; t.nombre = n; return true; }
    if (p[0] === 'g') { const g = (a.grupos || []).find(y => y.id === p[2]), n = v.replace(/\s+/g, ' ').trim(); if (!g || !n || g.nombre === n) return false; g.nombre = n; return true; }
    if (p[0] === 'it') { const it = (((a.pestanas || []).find(y => y.id === p[2]) || {}).items || []).find(y => y.id === p[3]); if (!it) return false; const n = p[4] === 'titulo' ? v.replace(/\s*\n\s*/g, ' ').trim() : v; if ((it[p[4]] || '') === n) return false; it[p[4]] = n; return true; }
    return false;
  }
  function guardar(fin) {                      // what is written goes in after a pause (D-182), a step of ⌘Z each 2 s (D-183)
    P.cardT.quitar();
    const r = rec(), ov = P.ov; if (!r || !ov || !S.campo) return;
    const el = ov.querySelector(`[data-campo="${CSS.escape(S.campo)}"]`); if (!el || !el.isContentEditable) return;
    const v = fin ? el.textContent.replace(/^\s*\n|\s+$/g, '') : el.textContent, campo = S.campo;
    P.cambiar(r.id, x => (poner(x, campo, v) ? x : null), 'hoja:' + r.id + ':' + campo).then(() => P.pintar());
    if (fin) S.campo = null;
  }
  async function volverTexto(v) {              // ⌘Z right after «Tarea» from a session's text: back to it, with «/…» (D-204)
    await P.enmendar(v.nota, x => { poner(x, v.campo, v.antes); return x; });
    P.pintar();
    if (P.abrirCard(v.nota)) { empezar(v.campo); const el = P.ov && P.ov.querySelector(`[data-campo="${CSS.escape(v.campo)}"]`); if (el && el._esc) el._esc.poner(Math.min(v.caret, el.textContent.length)); }
  }

  // ---------- the sheet's clicks, keys and changes ----------
  const cambiar = (f, junta) => { const r = rec(); return r ? P.cambiar(r.id, x => (f(x) === false ? null : x), junta).then(() => P.pintar()) : Promise.resolve(false); };
  function clic(e) {
    const t = e.target, ov = P.ov, c = ov && ov.firstChild; if (!c) return false;
    if (!c.contains(t)) return false;          // outside: it closes, writing too (personal.js)
    if (P.CARD.pd) { P.CARD.pd = false; return true; }
    if (t.closest('[data-pp="ampliar"], [data-pp="cerrar"]')) return false;   // widen and the ×: personal.js (D-209, D-210)
    const a = t.closest('[data-hj]'), k = a && a.dataset.hj, apEl = t.closest('[data-ap]'), apId = apEl && apEl.dataset.ap;
    const pt = { x: e.clientX, y: e.clientY }, txt = !k && e.detail < 2 && !S.vista && t.closest('[data-campo]');
    const escribe = txt && UNCLIC.test(txt.dataset.campo) && !t.closest('a, .pp-em.ca[data-ln]') ? txt.dataset.campo : null;
    if (P.CARD.ed && S.campo && !t.closest('[contenteditable], .pp-ecapa')) {   // writing: another text is written; elsewhere, back to reading
      if (escribe) { empezar(escribe, pt); return true; }
      P.editar(false); if (!k) return true;
    }
    if (t.closest('a.pp-ea, a.pp-pl-en')) return true;   // a link opens in another tab; the sheet stays
    const cas = t.closest('.pp-em.ca[data-ln]'); if (cas && !P.CARD.ed && !S.vista) { marcarTexto(cas); return true; }
    const fo = t.closest('.pp-fo'); if (fo && !k && e.detail < 2) { verFoto(fo.dataset.f); return true; }
    if (escribe && !P.CARD.ed && !P.seleccionando()) { empezar(escribe, pt); return true; }   // reading: a click writes where it is pressed (D-209)
    if (!k) return true;
    const r = rec(); if (!r) return true;
    if (k === 'ojo') { cambiar(x => { x.sesion.visible = x.sesion.visible === false; }); return true; }
    if (k === 'ojo-ap') { cambiar(x => { const y = ap(x, apId); if (!y) return false; y.visible = y.visible === false; }); return true; }
    if (k === 'plegar') { if (S.plg.has(apId)) S.plg.delete(apId); else S.plg.add(apId); pintarYa(); const b = P.ov.querySelector(`[data-ap="${CSS.escape(apId)}"] [data-hj="plegar"]`); if (b) b.focus({ preventScroll: true }); return true; }
    if (k === 'tab') { if (e.detail >= 2 || S.tab[apId] === a.dataset.tab) return true; S.tab[apId] = a.dataset.tab; pintarYa(); return true; }   // the tab in use: nothing to draw again
    if (k === 'tab-mas') { const id = P.nuevoId('pt'); cambiar(x => { const y = ap(x, apId); if (!y) return false; (y.pestanas = y.pestanas || []).push({ id, nombre: 'Pestaña', items: [] }); }).then(() => { S.tab[apId] = id; empezar(`tab:${apId}:${id}`); }); return true; }
    if (k === 'it-nuevo') { const pt = S.tab[apId], id = P.nuevoId('pi'); cambiar(x => { const y = ap(x, apId), p = y && (y.pestanas || []).find(q => q.id === pt); if (!p) return false; (p.items = p.items || []).push({ id, titulo: '', texto: '', fotos: [], enlaces: [] }); }).then(() => empezar(`it:${apId}:${pt}:${id}:titulo`)); return true; }
    if (k === 'g-nuevo') { const id = P.nuevoId('gr'); cambiar(x => { const y = ap(x, apId); if (!y) return false; (y.grupos = y.grupos || []).push({ id, nombre: 'Grupo', modo: 'linea', fotos: [] }); }).then(() => empezar(`g:${apId}:${id}`)); return true; }
    if (k === 'modo') { const g = t.closest('[data-g]').dataset.g, m = a.dataset.m; cambiar(x => { const y = ap(x, apId), gg = y && (y.grupos || []).find(q => q.id === g); if (!gg || (gg.modo || 'linea') === m) return false; gg.modo = m; }); return true; }
    if (k === 'mat' && !S.vista) { const id = a.dataset.m; cambiar(x => { const y = ap(x, apId); if (!y) return false; const m = matDeY(y); const h = new Set(m.hechos || []); if (h.has(id)) h.delete(id); else h.add(id); m.hechos = [...h]; }); return true; }
    if (k === 'mat-x' && !S.vista) { const id = a.dataset.m; cambiar(x => { const y = ap(x, apId); if (!y) return false; const m = matDeY(y); if (!m.lista.some(z => z.id === id)) return false; m.lista = m.lista.filter(z => z.id !== id).map(z => z.padre === id ? (({ padre, ...w }) => w)(z) : z); m.hechos = (m.hechos || []).filter(h => h !== id); m.retocada = true; }); return true; }
    if (k === 'mat-mas' && !S.vista) { S.cosa = a.dataset.fam; pintarYa(); const i = P.ov.querySelector('[data-hj="mat-in"]'); if (i) i.focus({ preventScroll: true }); return true; }
    if (k === 'mat-pl' && !S.vista) { elegirPl(apId, a.dataset.pl); return true; }
    if (k === 'mat-nueva' && !S.vista) { comoNueva(apId); return true; }
    if (k === 'mat-en' && !S.vista) { guardarEn(apId); return true; }
    if (k === 'cli-x' && !S.vista) { quitarCli(a.dataset.c); return true; }
    if (k === 'fin' && !S.vista) { cambiar(x => { if (!x.fecha || x.fin) return false; x.fin = P.finNuevo(x); }).then(() => { const i = P.ov && (P.ov.querySelector('[data-hj="fin-hora"]') || P.ov.querySelector('[data-hj="fin-fecha"]')), g = i && M.controles && M.controles.gemelo && M.controles.gemelo(i); if (g) (g.firstChild || g).focus({ preventScroll: true }); }); return true; }
    if (k === 'fin-x' && !S.vista) { cambiar(x => { if (!x.fin) return false; delete x.fin; }).then(() => { const b = P.ov && P.ov.querySelector('[data-hj="fin"]'); if (b) b.focus({ preventScroll: true }); }); return true; }
    if (k === 'tira') { S.tira = !S.tira; pintarYa(); return true; }
    if (k === 'vista' && !P.CARD.vc) { if (P.CARD.ed) P.editar(false); S.vista = !S.vista; pintarYa(); const b = P.ov.querySelector('[data-hj="vista"]'); if (b) b.focus({ preventScroll: true }); return true; }
    if (k === 'mas') { const q = a.getBoundingClientRect(); P.abrirMenu(q.left, q.bottom + 4, P.menuSesion(r.id, [['material', 'Editar plantillas', () => editarLista()]]), a); return true; }
    if (k === 'ap-mas') { const q = a.getBoundingClientRect(); P.abrirMenu(q.left, q.bottom + 4, menuAp(apId), a); return true; }
    if (k === 'ap-nuevo') { const q = a.getBoundingClientRect(); P.abrirMenu(q.left, q.bottom + 4, ORDEN.filter(id => !ap(r, id)).map(id => ['ap-' + id, APS[id].n, () => anadirAp(id)]), a); return true; }
    if (k === 'en-mas') { S.enl = t.closest('[data-it]').dataset.it; pintarYa(); const i = P.ov.querySelector('[data-hj="en-in"]'); if (i) i.focus(); return true; }
    return true;
  }
  function dbl(e) {
    if (S.vista) return;
    const t = e.target;
    if (t.closest('.pp-hj-sep')) { const R = reparto(); R.sep = SEP0; guardarReparto(R); pintarYa(); return; }   // the separator: back to how it started (as D-148)
    if (P.CARD.peq) return;                      // the double click that opened it writes nothing under the pointer (D-209)
    if (t.closest('[contenteditable], .pp-ck, button:not([data-campo]), a, input, select')) return;
    const f = t.closest('[data-campo]'); if (f) empezar(f.dataset.campo, { x: e.clientX, y: e.clientY });
  }
  function tecla(e) {
    const t = e.target, k = e.key;
    if ((k === ' ' || k === 'Enter') && t.matches && t.matches('.pp-em.ca[data-ln]') && !P.CARD.ed && !S.vista) { e.preventDefault(); e.stopImmediatePropagation(); marcarTexto(t); return true; }
    if (t.matches && t.matches('.pp-fo[tabindex]')) {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); e.stopImmediatePropagation(); verFoto(t.dataset.f); return true; }
      if (k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) { e.preventDefault(); e.stopImmediatePropagation(); const q = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: q.left + 8, clientY: q.bottom })); return true; }
    }
    if (P.CARD.ed && S.campo && UNA.test(S.campo) && k === 'Enter' && !e.isComposing && t.isContentEditable) { e.preventDefault(); e.stopImmediatePropagation(); P.editar(false); return true; }
    if (k === 'Enter' && t === P.ov.firstChild) { e.preventDefault(); return true; }   // the sheet has no «write all»: a double click on a text writes it
    if (t.matches && t.matches('[data-hj="mat-in"]')) {
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); S.cosa = null; pintarYa(); const b = P.ov.querySelector(`[data-hj="mat-mas"][data-fam="${CSS.escape(t.dataset.fam)}"]`); if (b) b.focus({ preventScroll: true }); return true; }
      if (k === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); ponerCosa(t, true); return true; }
      return false;
    }
    if (t.matches && t.matches('[data-hj="en-in"]')) {
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); S.enl = null; pintarYa(); return true; }
      if (k === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); anadirEnlace(t); return true; }
      return false;
    }
    if (t.matches && t.matches('.pp-hj-sep:not(.fija)') && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home')) {
      e.preventDefault(); const R = reparto(); R.sep = k === 'Home' ? SEP0 : Math.max(0.3, Math.min(0.7, R.sep + (k === 'ArrowRight' ? 0.02 : -0.02))); guardarReparto(R); pintarYa(); const s = P.ov.querySelector('.pp-hj-sep'); if (s) s.focus(); return true;
    }
    if (k === 'Escape' && !P.CARD.ed && S.vista && !P.CARD.vc) { e.preventDefault(); e.stopImmediatePropagation(); S.vista = false; pintarYa(); return true; }
    return false;
  }
  function escribir(e) {
    if (e.target.matches && e.target.matches('[data-hj="en-in"], [data-hj="mat-in"]')) return;
    if (P.CARD.ed && S.campo && e.target.isContentEditable) P.cardT.poner(() => guardar(false));
  }
  function cambio(e) {
    const t = e.target, k = t.dataset && t.dataset.hj;
    if (k === 'clase') { const v = t.value; cambiar(x => { if (x.sesion.clase === v) return false; x.sesion.clase = v; const ya = new Set(x.sesion.apartados.map(y => y.id)); for (const id of PLANTILLA[v] || []) if (!ya.has(id)) x.sesion.apartados.push(apartado(id)); }); return true; }   // the new kind's sections that are missing; none goes
    // the start moves its end with it, keeping the length (D-218); without a date, no end
    if (k === 'fecha') { const v = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : ''; cambiar(x => { if ((x.fecha || '') === v) return false; P.moverInicio(x, v); }); return true; }
    if (k === 'hora') { const v = /^\d{2}:\d{2}/.test(t.value) ? t.value.slice(0, 5) : ''; cambiar(x => { if ((x.hora || '') === v) return false; P.moverInicio(x, x.fecha, v); }); return true; }
    if (k === 'fin-fecha' || k === 'fin-hora') { const r = rec(); if (!r || !r.fin) return true; const f = { ...r.fin }; if (k === 'fin-fecha') { if (!/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { pintarYa(); return true; } f.fecha = t.value; } else if (/^\d{2}:\d{2}/.test(t.value)) f.hora = t.value.slice(0, 5); else delete f.hora;
      if (!P.finOk(r, f)) { I().toast('El fin no puede ser antes del inicio.', { key: 'fin-antes' }); S.firma = ''; pintarYa(); return true; }   // not taken: back to the one before
      cambiar(x => { if (JSON.stringify(x.fin) === JSON.stringify(f)) return false; x.fin = f; }); return true; }
    if (k === 'mat-plsel') { const v = t.value, apId = t.closest('[data-ap]').dataset.ap; if (v && matRec(v)) elegirPl(apId, v); return true; }
    if (k === 'cli-mas') { const v = t.value; t.value = ''; if (v === '__nuevo') { pedirEsp(e2 => anadirCli(e2.id)); return true; } if (v && P.cliDe(v)) anadirCli(v); return true; }   // one more client (D-217): a step of ⌘Z
    if (k === 'it-hecho') { const it = t.dataset.it, apId = t.closest('[data-ap]').dataset.ap, pt = S.tab[apId]; cambiar(x => { const y = ap(x, apId), p = y && (y.pestanas || []).find(q => q.id === pt), i = p && (p.items || []).find(q => q.id === it); if (!i) return false; i.hecho = t.checked; if (!i.hecho) delete i.hecho; }); return true; }
    return false;
  }
  // the session's own material (made from its template when it has none yet)
  function matDeY(y) { const m = y.material = y.material || { lista: [], hechos: [] }; if (!m.lista || !m.lista.length) { m.lista = matPlantilla(m.plantilla || MAT_ID); if (!m.plantilla && matRec()) m.plantilla = MAT_ID; } return m; }
  // another template: this session's copy is its list now; what was marked stays marked by its name; a step of ⌘Z, no question
  function elegirPl(apId, id) {
    const T = matRec(id); if (!T || T.tipo !== 'material') return;
    cambiar(x => { const y = ap(x, apId); if (!y) return false; const m = y.material = y.material || { lista: [], hechos: [] };
      if (m.plantilla === id && !m.retocada && m.lista && m.lista.length) return false;
      const antes = m.lista && m.lista.length ? m.lista : matPlantilla(m.plantilla || MAT_ID), nueva = matPlantilla(id), porNombre = new Map(nueva.map(z => [z.nombre.toLowerCase(), z.id]));
      const hechos = (m.hechos || []).map(h => { const o = antes.find(z => z.id === h); return o && porNombre.get(o.nombre.toLowerCase()); }).filter(Boolean);
      y.material = { lista: nueva, hechos: [...new Set(hechos)], plantilla: id }; });
  }
  // «+ Cosa»: in this session only (its template doesn't change until it is saved)
  function ponerCosa(inp, foco) {
    const n = inp.value.trim(), fam = inp.dataset.fam, apId = inp.closest('[data-ap]').dataset.ap; S.cosa = null;
    if (!n) { pintarYa(); return; }
    cambiar(x => { const y = ap(x, apId); if (!y) return false; const m = matDeY(y); m.lista.push({ id: P.nuevoId('ma'), nombre: n, familia: fam, tipo: 'ambas' }); m.retocada = true; })
      .then(() => { if (!foco) return; S.cosa = fam; pintarYa(); const i = P.ov && P.ov.querySelector('[data-hj="mat-in"]'); if (i) i.focus({ preventScroll: true }); });   // Enter: another one
  }
  // «Guardar en …»: this session's list goes to its template; one step of ⌘Z with the session, which isn't retouched any more
  function guardarEn(apId) {
    const r = rec(), y = r && ap(r, apId), m = y && y.material; if (!m || !m.plantilla || !matRec(m.plantilla)) return;
    const now = P.ahoraISO(), T = { ...P.copia(matRec(m.plantilla)), lista: P.hondo(matDe(y, { sesion: { clase: 'fotovideo' } }).L), at: now }, x = P.copia(r);
    const yy = ap(x, apId); yy.material = { ...yy.material, lista: P.hondo(T.lista) }; delete yy.material.retocada; x.at = now;
    P.hacer([{ id: T.id, despues: T }, { id: x.id, despues: x }]).then(() => P.pintar());
  }
  // «+ Guardar como plantilla» / «Como plantilla nueva»: its name in the mesa's dialog; the session takes it
  function comoNueva(apId) {
    const X = I(), r = rec(); if (!r) return; let hecho = false;
    X.showDialog('pp-plantilla', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Plantilla nueva</h3><form class="form pp-plf" autocomplete="off"><label for="pp-pl-n">Nombre</label><input id="pp-pl-n" type="text" maxlength="40" required><p class="ferr" hidden></p><div class="row"><button type="submit" class="btn">Guardar plantilla</button></div></form>`);
    const det = X.root().querySelector('.detail'), f = det.querySelector('form'), i = f.querySelector('input'), err = f.querySelector('.ferr');
    f.addEventListener('submit', async ev => {
      ev.preventDefault(); const n = i.value.replace(/\s+/g, ' ').trim(); if (!n || hecho) return;
      if (plantillas().some(t => String(t.txt).toLowerCase() === n.toLowerCase())) { err.textContent = 'Ya hay una plantilla con ese nombre.'; err.hidden = false; return; }
      const r1 = rec() || r, y = ap(r1, apId); if (!y) { X.closeDetail(); return; }
      const now = P.ahoraISO(), id = P.nuevoId('ml'), T = { id, tipo: 'material', txt: n, lista: P.hondo(matDe(y, { sesion: { clase: 'fotovideo' } }).L), orden: plantillas().reduce((o, t) => Math.max(o, +t.orden || 0), 0) + 1, creada: now, at: now };
      const x = P.copia(r1), yy = ap(x, apId); yy.material = { ...(yy.material || { hechos: [] }), lista: P.hondo(T.lista), plantilla: id }; delete yy.material.retocada; x.at = now;
      hecho = true; await P.hacer([{ id, despues: T }, { id: x.id, despues: x }]);
      X.closeDetail(); P.pintar();
    });
    i.focus();
  }
  const anadirCli = id => cambiar(x => { const l = P.clis(x); if (l.includes(id)) return false; ponerClis(x, [...l, id]); });
  const quitarCli = id => cambiar(x => { const l = P.clis(x); if (!l.includes(id)) return false; ponerClis(x, l.filter(c => c !== id)); });
  function marcarTexto(cas) {                  // a checkbox in a section's text, read: marked (a step of ⌘Z, D-204)
    const f = cas.closest('[data-campo]'), campo = f && f.dataset.campo, r = rec(); if (!campo || !r || !P.ES()) return;
    const n = P.ES().alternar(valorDe(r, campo), +cas.dataset.ln); if (n == null) return;
    cambiar(x => (poner(x, campo, n) ? undefined : false));
  }
  function anadirEnlace(inp) {
    const u = inp.value.trim(), it = inp.closest('[data-it]').dataset.it, apId = inp.closest('[data-ap]').dataset.ap, pt = S.tab[apId];
    S.enl = null;
    if (!/^https?:\/\/\S+$/i.test(u)) { pintarYa(); return; }
    cambiar(x => { const y = ap(x, apId), p = y && (y.pestanas || []).find(q => q.id === pt), i = p && (p.items || []).find(q => q.id === it); if (!i) return false; (i.enlaces = i.enlaces || []).push(u); });
  }
  function menuAp(apId) {                      // a section's «⋯» and right click: move it (also from the keyboard) or take it away
    const r = rec(), C = columnas(r), col = C.izq.includes(apId) ? 'izq' : 'der', L = C[col], i = L.indexOf(apId), dos = innerWidth > 720;
    return [['otra', 'Mover a la otra columna', () => mover(apId, col === 'izq' ? 'der' : 'izq'), !dos],
      ['subir', 'Subir', () => mover(apId, col, L[i - 1]), i <= 0], ['bajar', 'Bajar', () => mover(apId, col, L[i + 2]), i >= L.length - 1], '-',
      ['quitar', 'Quitar apartado', () => cambiar(x => { x.sesion.apartados = x.sesion.apartados.filter(y => y.id !== apId); })]];
  }
  function anadirAp(id) { cambiar(x => { if (ap(x, id)) return false; x.sesion.apartados.push(apartado(id)); }); }
  function menu(e) {                           // right click in the sheet (D-201): a photo, a link, a shot, a tab, a section
    const t = e.target, r = rec(); if (!r || S.vista) return false;
    const apEl = t.closest('[data-ap]'), apId = apEl && apEl.dataset.ap, fo = t.closest('.pp-fo');
    if (fo && t.closest('.pp-hj-tira')) { e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, [['borrar', 'Borrar la foto', () => borrarFoto(fo.dataset.f)]]); return true; }
    if (fo && apEl) { const d = fo.closest('[data-drop]'); e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, [['quitar', 'Quitar de aquí', () => quitarDe(d.dataset.drop, fo.dataset.f)]]); return true; }
    const en = t.closest('a.pp-pl-en'); if (en) { const it = en.closest('[data-it]').dataset.it, pt = S.tab[apId], k = +en.dataset.k; e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, [['quitar', 'Quitar el enlace', () => cambiar(x => { const y = ap(x, apId), p = y && (y.pestanas || []).find(q => q.id === pt), i = p && (p.items || []).find(q => q.id === it); if (!i) return false; i.enlaces.splice(k, 1); })]]); return true; }
    const tab = t.closest('.pp-pl-tab'); if (tab) { const id = tab.dataset.tab, a = ap(r, apId); e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, [['borrar', 'Borrar pestaña', () => cambiar(x => { const y = ap(x, apId); y.pestanas = y.pestanas.filter(q => q.id !== id); }), (a.pestanas || []).length <= 1]]); return true; }
    const it = t.closest('[data-it]'); if (it && apEl) { const pt = S.tab[apId], n = ((ap(r, apId).pestanas || []).find(q => q.id === pt) || {}).nombre || ''; e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, [['borrar', /^v[ií]deos$/i.test(n) ? 'Borrar vídeo' : /^planos$/i.test(n) ? 'Borrar plano' : 'Borrar', () => cambiar(x => { const y = ap(x, apId), p = y && (y.pestanas || []).find(q => q.id === pt); if (!p) return false; p.items = p.items.filter(q => q.id !== it.dataset.it); })]]); return true; }
    const g = t.closest('[data-g]'); if (g && apEl) { e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, [['borrar', 'Borrar grupo', () => cambiar(x => { const y = ap(x, apId); y.grupos = y.grupos.filter(q => q.id !== g.dataset.g); })]]); return true; }
    if (apEl && t.closest('.pp-hj-aph')) { e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, menuAp(apId)); return true; }
    if (t.closest('.pp-hj-cab')) { e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, P.menuSesion(r.id, [['material', 'Editar plantillas', () => editarLista()]])); return true; }
    return false;
  }
  function quitarDe(drop, id) {                // «Quitar de aquí»: the photo stays in the session
    const p = drop.split(':');
    cambiar(x => { const y = ap(x, p[1]); if (!y) return false;
      if (p[0] === 'g') { const g = (y.grupos || []).find(q => q.id === p[2]); if (!g) return false; g.fotos = g.fotos.filter(f => f !== id); }
      else { const pt = (y.pestanas || []).find(q => q.id === p[2]), i = pt && (pt.items || []).find(q => q.id === p[3]); if (!i) return false; i.fotos = i.fotos.filter(f => f !== id); } });
  }
  function borrarFoto(id) {                    // «Borrar la foto»: from the session and from everywhere it was placed
    cambiar(x => { x.fotos = (x.fotos || []).filter(f => f.id !== id); if (!x.fotos.length) delete x.fotos;
      for (const a of x.sesion.apartados || []) { (a.pestanas || []).forEach(p => (p.items || []).forEach(i => { i.fotos = (i.fotos || []).filter(f => f !== id); })); (a.grupos || []).forEach(g => { g.fotos = (g.fotos || []).filter(f => f !== id); }); } });
  }
  function verFoto(id) {                       // a session's photo big, in the mesa's dialog (Esc, the × or a click outside close it)
    foto(id).then(o => {
      if (!o.rec || !(o.rec.blob instanceof Blob)) return;
      const X = I(), u = URL.createObjectURL(o.rec.blob), r = rec();
      X.showDialog('pp-foto', `<button class="x" data-act="close" aria-label="Cerrar">×</button><div class="tvwrap"><img class="tvimg" src="${u}" alt=""></div><div class="tvbar"><span class="tvname"><b>${P.esc(r ? r.txt : '')}</b> · ${o.rec.w}×${o.rec.h}</span></div>`);
      const det = X.root().querySelector('.detail');
      const mo = new MutationObserver(() => { if (det.hidden || det.dataset.dlg !== 'pp-foto') { mo.disconnect(); URL.revokeObjectURL(u); } });
      mo.observe(det, { attributes: true, attributeFilter: ['hidden', 'data-dlg'] });
    });
  }

  // ---------- photos dragged: from the strip to a shot or a group; from the computer, saved (D-206) ----------
  const TIPO = 'application/x-pp-foto';
  let sobre = null;
  const marcar = el => { if (sobre && sobre !== el) sobre.classList.remove('pp-drop'); sobre = el; if (el) el.classList.add('pp-drop'); };
  function destino(t) { const d = t.closest && t.closest('[data-drop]'); return d && P.ov && P.ov.contains(d) ? d : null; }
  function arrastre(e) {
    const t = e.target;
    if (e.type === 'dragstart') { const f = t.closest && t.closest('.pp-fo[draggable="true"]'); if (!f || S.vista) return; e.dataTransfer.setData(TIPO, f.dataset.f); e.dataTransfer.effectAllowed = 'copy'; return; }
    if (![...(e.dataTransfer.types || [])].includes(TIPO)) return;
    const d = destino(t), vale = d && d.dataset.drop !== 'tira';
    if (e.type === 'dragleave') { if (!P.ov.contains(e.relatedTarget)) marcar(null); return; }
    e.preventDefault();
    if (e.type === 'dragover' || e.type === 'dragenter') { e.dataTransfer.dropEffect = vale ? 'copy' : 'none'; marcar(vale ? d : null); return; }
    marcar(null);
    if (e.type === 'drop' && vale) poner1(d.dataset.drop, [e.dataTransfer.getData(TIPO)]);
  }
  function poner1(drop, ids) {                 // a photo in a shot's references or a group (it can be in several places)
    const p = drop.split(':');
    cambiar(x => { const y = ap(x, p[1]); if (!y) return false; let l;
      if (p[0] === 'g') { const g = (y.grupos || []).find(q => q.id === p[2]); if (!g) return false; l = g.fotos = g.fotos || []; }
      else { const pt = (y.pestanas || []).find(q => q.id === p[2]), i = pt && (pt.items || []).find(q => q.id === p[3]); if (!i) return false; l = i.fotos = i.fotos || []; }
      let n = 0; for (const id of ids) if (id && !l.includes(id) && (x.fotos || []).some(f => f.id === id)) { l.push(id); n++; } if (!n) return false; });
  }
  // files from the computer over the sheet: on a shot or a group, saved and placed there; anywhere else, only in the strip
  function archivos(e) {
    if (S.vista) { e.dataTransfer.dropEffect = 'none'; return; }
    const d = destino(e.target), vale = d && d.dataset.drop !== 'tira' ? d : null;
    if (e.type === 'dragleave') { if (!P.ov.contains(e.relatedTarget)) marcar(null); return; }
    if (e.type === 'dragover' || e.type === 'dragenter') { e.dataTransfer.dropEffect = 'copy'; marcar(vale || P.ov.querySelector('.pp-hj-tira') || null); return; }
    marcar(null);
    if (e.type !== 'drop' || !P.puede()) return;
    const fs = [...e.dataTransfer.files].filter(P.esImagen); if (!fs.length) return;
    const r0 = rec(); if (!r0) return;
    (async () => {
      const got = []; for (const f of fs) { try { got.push(await P.rebajar(f)); } catch (err) { /* one that can't be read doesn't go in */ } }
      if (!got.length) return;
      for (const g of got) await I().idbPut('tfotos', g.id, { id: g.id, w: g.w, h: g.h, blob: g.blob, mini: g.mini, sesion: r0.id, t: Date.now() });   // first the photos: a session never points at one that isn't there
      const p = vale ? vale.dataset.drop.split(':') : null;
      await P.cambiar(r0.id, x => {
        x.fotos = [...(x.fotos || []), ...got.map(g => ({ id: g.id, w: g.w, h: g.h }))];
        if (p) { const y = ap(x, p[1]); if (y) { if (p[0] === 'g') { const gg = (y.grupos || []).find(q => q.id === p[2]); if (gg) gg.fotos = [...(gg.fotos || []), ...got.map(g => g.id)]; } else { const pt = (y.pestanas || []).find(q => q.id === p[2]), i = pt && (pt.items || []).find(q => q.id === p[3]); if (i) i.fotos = [...(i.fotos || []), ...got.map(g => g.id)]; } } }
        return x;
      });
      if (!p) S.tira = true;
      P.pintar();
    })();
  }

  // ---------- moving sections by their handle; the separator ----------
  let mov = null;
  function alPuntero(e) {
    const ov = P.ov; if (!ov || !rec() || e.button !== 0) return;
    const asa = e.target.closest('.pp-hj-asa'), sep = e.target.closest('.pp-hj-sep:not(.fija)');
    if (!asa && !sep) return;
    e.preventDefault();
    const cols = ov.querySelector('.pp-hj-cols'), rc = cols.getBoundingClientRect();
    if (sep) { mov = { sep: true, rc, el: sep, x0: e.clientX, cols }; sep.setPointerCapture(e.pointerId); sep.classList.add('mov'); cols.classList.add('mov'); return; }
    const sec = asa.closest('[data-ap]');
    const linea = document.createElement('div'); linea.className = 'pp-hj-linea'; cols.append(linea);
    const fant = sec.querySelector('.pp-hj-aph').cloneNode(true); fant.className = 'pp-hj-aph pp-hj-fant'; ov.firstChild.append(fant);
    mov = { id: sec.dataset.ap, sec, linea, fant, x0: e.clientX, y0: e.clientY, dx: e.clientX - sec.getBoundingClientRect().left, dy: e.clientY - sec.getBoundingClientRect().top };
    sec.classList.add('mov'); asa.setPointerCapture(e.pointerId);
    seguir(e);
  }
  function seguir(e) {
    if (!mov) return;
    const ov = P.ov, cols = ov && ov.querySelector('.pp-hj-cols'); if (!cols) return;
    mov.ex = e.clientX; mov.ey = e.clientY;
    if (mov.sep) { if (Math.abs(e.clientX - (mov.x0 || e.clientX)) < 3 && !mov.x) { mov.x0 = mov.x0 || e.clientX; return; } const x = Math.max(0.3, Math.min(0.7, (e.clientX - mov.rc.left) / mov.rc.width)); cols.style.gridTemplateColumns = `minmax(0,${x.toFixed(4)}fr) 17px minmax(0,${(1 - x).toFixed(4)}fr)`; mov.x = x; if (!mov.raf) mov.raf = requestAnimationFrame(() => { if (mov) mov.raf = 0; colocarMood(); }); return; }
    const c = ov.firstChild.getBoundingClientRect();
    mov.fant.style.transform = `translate(${Math.round(e.clientX - c.left - mov.dx)}px,${Math.round(e.clientY - c.top - mov.dy + ov.firstChild.scrollTop)}px)`;
    const cs = [...cols.querySelectorAll('.pp-hj-col')], col = cs.find(x => { const q = x.getBoundingClientRect(); return e.clientX >= q.left && e.clientX <= q.right; }) || cs[e.clientX < cols.getBoundingClientRect().left + cols.clientWidth / 2 ? 0 : cs.length - 1];
    const secs = [...col.querySelectorAll(':scope > .pp-hj-ap')].filter(x => x !== mov.sec);
    const antes = secs.find(x => { const q = x.getBoundingClientRect(); return e.clientY < q.top + q.height / 2; });
    const qc = col.getBoundingClientRect(), qr = cols.getBoundingClientRect(), y = antes ? antes.getBoundingClientRect().top - 6 : (secs.length ? secs[secs.length - 1].getBoundingClientRect().bottom + 6 : qc.top + 8);
    Object.assign(mov.linea.style, { left: (qc.left - qr.left) + 'px', width: qc.width + 'px', top: (y - qr.top) + 'px' });
    mov.col = col.dataset.col; mov.antes = antes ? antes.dataset.ap : null;
  }
  function soltar() {
    if (!mov) return;
    const m = mov; mov = null;
    if (m.sep) { m.el.classList.remove('mov'); m.cols.classList.remove('mov'); if (m.x) { const R = reparto(); R.sep = m.x; guardarReparto(R); pintarYa(); } return; }   // not moved: nothing is drawn again (its double click lands on the same element)
    m.linea.remove(); m.fant.remove(); m.sec.classList.remove('mov');
    if (m.col && Math.hypot(m.ex - m.x0, m.ey - m.y0) > 4) mover(m.id, m.col, m.antes);
  }

  // ---------- «Nueva sesión» (Q2): the mesa's dialog ----------
  let DLG = null;                              // {estado, ctx, campo, desde, cambiando}
  function nueva({ ctx, campo, desde, fecha, clase }) {   // fecha: a day given (the posts' calendar's right click, D-285); clase: 'reunion' (D-291)
    const cli = campo === 'nueva' ? (P.st.tcli || P.st.nueva.cliente || '') : (desde && desde.tipo === 'esporadico' ? desde.id : desde && desde.cliente) || '';
    const k = CLASES.some(c => c[0] === clase) ? clase : 'fotovideo';
    DLG = { origen: document.activeElement, estado: { nombre: nombreDe(k), tocado: false, clase: k, ojoTocado: false, fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') ? fecha : '', hora: '', fin: null, clientes: P.cliDe(cli) ? [cli] : [], visible: k !== 'reunion' }, ctx, campo, desde };   // a meeting, the eye crossed out (D-291)
    dialogo();
  }
  function dialogo() {
    const X = I(), E = DLG.estado;
    X.showDialog('pp-sesion', `<button class="x" data-act="close" aria-label="Cerrar">×</button><div class="pp-ns-cab"><h3>${E.clase === 'reunion' ? 'Nueva reunión' : 'Nueva sesión'}</h3>${ojoBtn(E.visible, 'pp-cb', 'data-ns="ojo"')}</div>`
      + `<form class="form pp-ns" autocomplete="off"><label for="pp-ns-nom">Nombre</label><input id="pp-ns-nom" type="text" maxlength="80" value="${P.esc(E.nombre)}" required>`
      + `<label id="pp-ns-tl">Tipo</label><div class="pp-ns-tipos" role="radiogroup" aria-labelledby="pp-ns-tl">${CLASES.map(([k, l, ic]) => `<button type="button" role="radio" class="pp-ns-t${E.clase === k ? ' on' : ''}" data-ns="clase" data-k="${k}" aria-checked="${E.clase === k}" tabindex="${E.clase === k ? 0 : -1}">${svgI(ic)}<span>${l}</span></button>`).join('')}</div>`
      + `<div class="pp-ns-2"><div><label for="pp-ns-fecha">Fecha y hora</label><span class="pp-ns-fh"><input id="pp-ns-fecha" type="date" data-sin-fecha value="${P.esc(E.fecha)}" aria-label="Fecha de la sesión"><input id="pp-ns-hora" type="time" value="${P.esc(E.hora)}" aria-label="Hora de la sesión"></span><span class="pp-ns-fin${E.fin ? ' confin' : ''}">${finHTML(E, 'data-ns')}</span></div>`
      + `<div><label id="pp-ns-cl">Clientes</label><div class="pp-ns-cli" role="group" aria-labelledby="pp-ns-cl">${clisHTML(E.clientes, 'data-ns')}</div></div></div>`
      + `<div class="row"><button type="submit" class="btn">${E.clase === 'reunion' ? 'Crear reunión' : 'Crear sesión'}</button></div></form>`);
    const det = X.root().querySelector('.detail'), f = det.querySelector('form.pp-ns'), nom = f.querySelector('#pp-ns-nom');
    nom.addEventListener('input', () => { E.nombre = nom.value; E.tocado = true; });
    const ojo = det.querySelector('[data-ns="ojo"]'), pintarOjo = () => { ojo.setAttribute('aria-pressed', String(E.visible)); ojo.title = ojo.ariaLabel = E.visible ? 'Lo verá el cliente' : 'Solo para ti'; ojo.innerHTML = E.visible ? svgI('ojo') : svgI('ojoNo'); };
    ojo.addEventListener('click', () => { E.visible = !E.visible; E.ojoTocado = true; pintarOjo(); });
    // a meeting: its title, its button and, unless the eye was touched, the eye crossed out (D-291)
    const h3 = det.querySelector('.pp-ns-cab h3'), sub = det.querySelector('form.pp-ns [type="submit"]');
    const tipos = [...det.querySelectorAll('[data-ns="clase"]')], elegir = (b, foco) => { const antes = E.clase; E.clase = b.dataset.k; tipos.forEach(x => { const s = x === b; x.classList.toggle('on', s); x.setAttribute('aria-checked', String(s)); x.tabIndex = s ? 0 : -1; }); if (!E.tocado) { E.nombre = nombreDe(E.clase); nom.value = E.nombre; }
      const r = E.clase === 'reunion'; h3.textContent = r ? 'Nueva reunión' : 'Nueva sesión'; sub.textContent = r ? 'Crear reunión' : 'Crear sesión';
      if (!E.ojoTocado && (antes === 'reunion') !== r) { E.visible = !r; pintarOjo(); }
      if (foco) b.focus(); };
    tipos.forEach((b, i) => { b.addEventListener('click', () => elegir(b)); b.addEventListener('keydown', ev => { const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0; if (!d) return; ev.preventDefault(); elegir(tipos[(i + d + tipos.length) % tipos.length], true); }); });
    const fe = det.querySelector('#pp-ns-fecha'), ho = det.querySelector('#pp-ns-hora'), cz = det.querySelector('.pp-ns-cli');
    // the end (D-218), under «Fecha y hora»: only its place is drawn again; the start moves it keeping the length
    const fz = det.querySelector('.pp-ns-fin');
    const pintarFin = foco => { fz.classList.toggle('confin', !!E.fin); fz.innerHTML = finHTML(E, 'data-ns'); if (M.controles && M.controles.mejorar) M.controles.mejorar(fz); const f = foco && fz.querySelector(foco); if (f) { const g = M.controles && M.controles.gemelo && M.controles.gemelo(f); (g ? g.firstChild || g : f).focus({ preventScroll: true }); } };
    const inicio = (fecha, hora) => { const x = { tipo: 'sesion', fecha: E.fecha, hora: E.hora, ...(E.fin ? { fin: { ...E.fin } } : {}) }; P.moverInicio(x, fecha, hora); E.fecha = x.fecha || ''; E.hora = x.hora || ''; E.fin = x.fin || null; setTimeout(() => pintarFin(), 0); };
    fe.addEventListener('change', () => inicio(/^\d{4}-\d{2}-\d{2}$/.test(fe.value) ? fe.value : ''));
    ho.addEventListener('change', () => inicio(E.fecha, /^\d{2}:\d{2}/.test(ho.value) ? ho.value.slice(0, 5) : ''));
    fz.addEventListener('click', ev => { const b = ev.target.closest('[data-ns]'); if (!b) return;
      if (b.dataset.ns === 'fin' && E.fecha) { E.fin = P.finNuevo(E); pintarFin(E.hora ? '[data-ns="fin-hora"]' : '[data-ns="fin-fecha"]'); }
      else if (b.dataset.ns === 'fin-x') { E.fin = null; pintarFin('[data-ns="fin"]'); } });
    fz.addEventListener('change', ev => { const t = ev.target, k = t.dataset.ns; if (!E.fin || (k !== 'fin-fecha' && k !== 'fin-hora')) return; const f = { ...E.fin };
      if (k === 'fin-fecha') { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) f.fecha = t.value; } else if (/^\d{2}:\d{2}/.test(t.value)) f.hora = t.value.slice(0, 5); else delete f.hora;
      if (P.finOk(E, f)) E.fin = f; else I().toast('El fin no puede ser antes del inicio.', { key: 'fin-antes' });
      setTimeout(() => pintarFin(), 0); });
    // its clients: only their place is drawn again (the rest of the dialog, as it is: what is typed, the focus)
    const pintarCli = foco => { cz.innerHTML = clisHTML(E.clientes, 'data-ns'); if (M.controles && M.controles.mejorar) M.controles.mejorar(cz); const f = foco && cz.querySelector(foco); if (f) { const g = M.controles && M.controles.gemelo && M.controles.gemelo(f); (g || f).focus({ preventScroll: true }); } };
    const nuevoEsp = () => pedirEsp(e2 => { if (e2 && !E.clientes.includes(e2.id)) E.clientes.push(e2.id); dialogo(); }, () => dialogo());
    cz.addEventListener('change', ev => { const t = ev.target; if (!t.matches('[data-ns="cli-mas"]')) return; const v = t.value; t.value = ''; if (v === '__nuevo') { nuevoEsp(); return; } if (v && P.cliDe(v) && !E.clientes.includes(v)) { E.clientes.push(v); setTimeout(() => pintarCli('[data-ns="cli-mas"]'), 0); } });
    cz.addEventListener('mx-accion', nuevoEsp);
    cz.addEventListener('click', ev => { const b = ev.target.closest('[data-ns="cli-x"]'); if (!b) return; E.clientes = E.clientes.filter(c => c !== b.dataset.c); pintarCli('[data-ns="cli-mas"]'); });
    f.addEventListener('submit', ev => { ev.preventDefault(); crear(); });
    if (M.controles && M.controles.mejorar) M.controles.mejorar(det);
    nom.focus(); nom.select();
    vigilarCierre(det);
  }
  function vigilarCierre(det) {                // closed without making it: «/…» stays as it was and the focus goes back
    const dl = DLG;
    const mo = new MutationObserver(() => {
      if (DLG !== dl) { mo.disconnect(); return; }
      if (det.dataset.dlg === 'pp-esp' || det.dataset.dlg === 'pp-sesion' && !det.hidden) { if (det.dataset.dlg === 'pp-esp') mo.disconnect(); return; }   // «Nuevo esporádico» on top: it comes back to this one
      mo.disconnect(); const d = DLG; DLG = null; if (d && !d.hecho) volverFoco(d);
    });
    mo.observe(det, { attributes: true, attributeFilter: ['hidden', 'data-dlg'] });
  }
  function volverFoco(d) {
    if (d.campo === 'nueva') { const i = P.page && P.page.querySelector('[data-pp="nueva"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return; }
    const el = d.ctx && d.ctx.ctl && d.ctx.ctl.el; if (el && el.isConnected) { el.focus({ preventScroll: true }); d.ctx.ctl.poner(Math.min(d.ctx.b, el.textContent.length)); return; }
    if (d.origen && d.origen.isConnected) d.origen.focus({ preventScroll: true });
  }
  // made: the session and «/…» turned into its name (in a note, «Detalles» or a text) are one step of ⌘Z; then its sheet opens
  async function crear() {
    const d = DLG; if (!d || !P.puede()) return;
    const E = d.estado, X = I(), nombre = String(E.nombre || '').trim() || nombreDe(E.clase);
    d.hecho = true;
    const now = P.ahoraISO(), r = { id: P.nuevoId('ss'), tipo: 'sesion', txt: nombre, creada: now, at: now, sesion: { clase: E.clase, visible: !!E.visible, plantilla: PLANTILLA.v, apartados: (PLANTILLA[E.clase] || PLANTILLA.fotovideo).map(apartado) } };
    if (E.fecha) r.fecha = E.fecha; if (E.hora) r.hora = E.hora; r.clientes = E.clientes.filter(c => P.cliDe(c)); if (E.fin && E.fecha && P.finOk(r, E.fin)) r.fin = { ...E.fin };
    const cambios = [{ id: r.id, despues: r }];
    if ((d.campo === 'nota' || d.campo === 'det') && d.desde && P.CARD && P.CARD.id === d.desde.id) {
      P.guardarCard(false); P.cardT.quitar();   // what was written in the card goes in first
      const k = P.TK.get(d.desde.id), t = d.ctx.texto.slice(0, d.ctx.a) + nombre + d.ctx.texto.slice(d.ctx.b);
      if (k && !k._b) { const n = P.copia(k); if (d.campo === 'nota') n.txt = t; else if (t) n.detalles = t; else delete n.detalles; n.at = now; cambios.push({ id: k.id, despues: n }); }   // a task not made yet stays unmade (D-204)
      P.cerrarCard(true);
    }
    X.closeDetail(); DLG = null;
    if (d.campo === 'nueva') { const i = P.page && P.page.querySelector('[data-pp="nueva"]'); if (i) i.value = ''; }
    else if (P.CARD) P.cerrarCard(true);
    await P.hacer(cambios);
    P.pintar(); P.abrirCard(r.id);
  }

  // ---------- sporadic clients (E2, D-207) ----------
  function pedirEsp(alCrear, alCerrar) {       // the name, in the mesa's dialog; Enter never deletes
    const X = I(); let hecho = false;
    X.showDialog('pp-esp', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Nuevo esporádico</h3><form class="form pp-espf" autocomplete="off"><label for="pp-esp-n">Nombre</label><input id="pp-esp-n" type="text" maxlength="60" required><p class="ferr" hidden></p><div class="row"><button type="submit" class="btn">Crear esporádico</button></div></form>`);
    const det = X.root().querySelector('.detail'), f = det.querySelector('form'), i = f.querySelector('input'), err = f.querySelector('.ferr');
    f.addEventListener('submit', async ev => {
      ev.preventDefault(); const n = i.value.trim(); if (!n) return;
      if ([...X.CL.map(c => c.name), ...P.esps().map(e => e.txt)].some(x => String(x).toLowerCase() === n.toLowerCase())) { err.textContent = 'Ya hay un cliente con ese nombre.'; err.hidden = false; return; }
      const now = P.ahoraISO(), e2 = { id: P.nuevoId('es'), tipo: 'esporadico', txt: n, creada: now, at: now };
      hecho = true; await P.hacer([{ id: e2.id, despues: e2 }]);
      X.closeDetail(); P.pintar(); if (alCrear) alCrear(e2);
    });
    const mo = new MutationObserver(() => { if (det.hidden || det.dataset.dlg !== 'pp-esp') { mo.disconnect(); if (!hecho && alCerrar) setTimeout(alCerrar, 0); } });
    mo.observe(det, { attributes: true, attributeFilter: ['hidden', 'data-dlg'] });
    i.focus();
  }
  // ---------- a sporadic client's page (lote 5 de la 4.55, D-377; it was a file over the page, D-207): drawn by personal.js in
  // the place of the page; its head («‹ Esporádicos», its name written with a click, «Esporádico desde…», «+ Sesión», «+ Reunión»,
  // «+ Tarea», «+ Nota», «⋯») and three columns: its agenda and its calendar (calendario.js, the «Solo contenido» one) · its tasks
  // (the page's list, only its own) and its notes · its payments (cobros.js), with their totals and its IVA ----------
  const PG = { ed: false, fuera: null, id: null };   // its name being written (of which client); what ends it from outside
  // left without ending it (the page closed, another client's): nothing is being written any more
  function nomVigente() {
    if (!PG.ed) return false;
    const n = P.page && P.page.querySelector('.pp-ep-nom.escribiendo');
    if (n && P.st && P.st.esp === PG.id) return true;
    PG.ed = false; if (PG.fuera) { document.removeEventListener('pointerdown', PG.fuera, true); PG.fuera = null; }
    return false;
  }
  const MESL0 = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ATRAS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';   // Lucide chevron-left
  const icoSes = k => { const c = k.sesion && k.sesion.clase; return svgI(c === 'foto' ? 'camara' : c === 'video' ? 'video' : c === 'libre' ? 'libre' : c === 'reunion' ? 'reunion' : 'sesion'); };
  const ivaEsp = e => e && e.sinIva === true ? 0 : 21;   // what its new payments take (D-377; a monthly one's, D-374)
  // its «Vista cliente» (D-378): what its client sees in its web, the same: its sessions (with a day and the eye open) with their
  // calendar · its tasks and notes it sees, to read · «Tus pagos». A session opens as the client sees it (fixed, D-219)
  function paginaVcHTML(e, R) {
    const X = I(), hoy = X.hoy(), id = e.id, esc = P.esc;
    const ss = P.sesiones().filter(k => P.conCli(k, id) && k.fecha && !(k.sesion && k.sesion.visible === false)), t = k => (k.fecha || '') + ' ' + (k.hora || '');
    const prox = ss.filter(k => P.ultDia(k) >= hoy).sort((a, b) => t(a).localeCompare(t(b))), pas = ss.filter(k => P.ultDia(k) < hoy).sort((a, b) => t(b).localeCompare(t(a)));
    const coms = M.web && M.web.coms ? M.web.coms(id) : [];
    const fila = k => { const n = coms.filter(x => x.sesion === k.id).length;
      return `<button type="button" class="pp-es-s pp-ep-vs" data-pp="ep-vses" data-id="${esc(k.id)}" title="${esc((k.sesion && k.sesion.clase === 'reunion' ? 'Reunión' : 'Sesión') + ' · ' + k.txt)}"><span class="pp-es-d">${esc(P.tramo(k))}</span>${icoSes(k)}<b>${esc(k.txt)}${n ? `<span class="pp-ep-nc">${n === 1 ? '1 comentario' : n + ' comentarios'}</span>` : ''}</b></button>`; };
    const grupo = (tt, l) => l.length ? `<section class="pp-ep-gr"><h3 class="pp-gt pp-ep-sub">${tt} <span>${l.length}</span></h3><div class="pp-es-l">${l.map(fila).join('')}</div></section>` : '';
    const tk = P.tareas().filter(k => k.cliente === id && k.visible === true).sort((a, b) => String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')) || String(a.creada || '').localeCompare(String(b.creada || '')));
    const ns = P.notas().filter(k => k.cliente === id && k.visible === true);
    const MS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], dia = f => f ? `${+f.slice(8)} ${MS[+f.slice(5, 7) - 1]}` : '';
    const pp = I().vc && I().vc.lado ? I().vc.lado.find(x => x.id === 'pagos') : null;
    let pagos = ''; try { pagos = pp ? pp.html({ cliente: id, mes: hoy.slice(0, 7), S: null }) || '' : ''; } catch (err) { pagos = ''; }
    return `<div class="pp-ep vc" data-esp="${esc(id)}">`
      + `<div class="pp-ep-cab"><div class="pp-ep-id">${P.avatar(id, 'lg')}<div class="pp-ep-t"><h1 class="pp-ep-nom">${esc(e.txt)}</h1></div></div><span class="pp-ep-sp"></span>`
      + `<div class="pp-ep-acc"><label class="sw pp-ep-vcs"><input type="checkbox" data-pp="ep-vc" checked> Vista cliente</label></div></div>`
      + `<div class="pp-ep-cols"><div class="pp-ep-ag"><section class="pp-ep-p pp-ep-citas" aria-label="Tus sesiones"><h2 class="pp-ep-h">Tus sesiones</h2>`
      + (ss.length ? grupo('Próximas', prox) + grupo('Pasadas', pas) : '<p class="pp-ep-vacio">Aún no hay sesiones</p>')
      + `</section><div class="side pp-ep-side"><section class="cal" data-propio data-vc data-cli="${esc(id)}" aria-label="Calendario"></section></div></div>`
      + `<section class="pp-ep-p pp-ep-tn" aria-label="Tareas y notas"><h2 class="pp-ep-h">Tareas <span>${tk.length}</span></h2>`
      + (tk.length ? `<div class="pp-ep-vtl">${tk.map(k => `<div class="pp-ep-vt${k.hecha ? ' hecha' : ''}"><span class="pp-ep-vd">${esc(dia(k.fecha))}</span><span class="pp-ep-vx">${esc(k.txt)}</span></div>`).join('')}</div>` : '<p class="pp-ep-vacio">Sin tareas</p>')
      + `<h2 class="pp-ep-h pp-ep-h2">Notas <span>${ns.length}</span></h2>` + (ns.length ? ns.map(n => `<div class="pp-ep-vn">${P.leerTxt(n.txt, { casillas: 'vineta', enlaces: true })}</div>`).join('') : '<p class="pp-ep-vacio">Sin notas</p>') + `</section>`
      + `<section class="pp-ep-p pp-ep-cob pp-ep-vpg" aria-label="Tus pagos">${pagos || '<h2 class="pp-ep-h">Tus pagos</h2><p class="pp-ep-vacio">Sin facturas</p>'}</section></div></div>`;
  }
  function paginaHTML(e0, R) {
    const e = P.TK.get(e0.id) || e0, X = I(), hoy = X.hoy(), id = e.id, esc = P.esc;   // its record (espDe gives its name as a client's)
    if (P.st && P.st.espVc === id) return paginaVcHTML(e, R);   // its «Vista cliente» (D-378)
    const ss = P.sesiones().filter(k => P.conCli(k, id)), tk = P.tareas().filter(k => k.cliente === id), ns = P.notas().filter(k => k.cliente === id);
    const t = k => (k.fecha || '') + ' ' + (k.hora || '');
    const prox = ss.filter(k => k.fecha && P.ultDia(k) >= hoy).sort((a, b) => t(a).localeCompare(t(b))), sinf = ss.filter(k => !k.fecha), pas = ss.filter(k => k.fecha && P.ultDia(k) < hoy).sort((a, b) => t(b).localeCompare(t(a)));
    const fila = k => { const d = k.fecha ? P.difD(hoy, k.fecha) : null, reu = k.sesion && k.sesion.clase === 'reunion';
      return `<button type="button" class="pp-es-s" data-tid="${esc(k.id)}" data-pp="tver" data-id="${esc(k.id)}" title="${esc((reu ? 'Reunión' : 'Sesión') + ' · ' + k.txt)}"><span class="pp-es-d${d != null && d >= 0 ? ' prox' : ''}">${k.fecha ? esc(P.tramo(k)) : ''}</span>${icoSes(k)}<b>${esc(k.txt)}</b>${d === 0 ? '<i>hoy</i>' : d === 1 ? '<i>mañana</i>' : ''}</button>`; };
    const grupo = (tt, l) => l.length ? `<section class="pp-ep-gr"><h3 class="pp-gt pp-ep-sub">${tt} <span>${l.length}</span></h3><div class="pp-es-l">${l.map(fila).join('')}</div></section>` : '';   // as the groups of Tareas (D-371)
    const desde = e.creada ? `${MESL0[+e.creada.slice(5, 7) - 1]} ${e.creada.slice(0, 4)}` : '';
    const mas = svgI('mas'), nT = tk.filter(k => !k.hecha).length;
    const pn = `<div class="pp-pn">${ns.map(n => `<div class="pp-pt" data-nid="${esc(n.id)}" data-pp="tver" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="Nota: ${esc(n.txt)}"><div class="pp-ptx">${P.leerTxt(n.txt, { casillas: 'no' })}</div>${P.ojoTN(n)}</div>`).join('')}</div>`;   // its eye (D-378)
    return `<div class="pp-ep" data-esp="${esc(id)}">`
      + `<div class="pp-ep-cab"><button type="button" class="pp-ep-vol" data-pp="ep-volver">${ATRAS}Esporádicos</button>`
      + `<div class="pp-ep-id">${P.avatar(id, 'lg')}<div class="pp-ep-t"><h1 class="pp-ep-nom" data-pp="ep-nom" tabindex="-1" title="Clic: cambiar el nombre">${esc(e.txt)}</h1>${desde ? `<p>Esporádico desde ${desde}</p>` : ''}</div></div><span class="pp-ep-sp"></span>`
      + `<div class="pp-ep-acc"><button type="button" class="btn" data-pp="ep-sesion">${mas}Sesión</button><button type="button" class="btn2" data-pp="ep-reunion">${mas}Reunión</button><button type="button" class="btn2" data-pp="ep-tarea">${mas}Tarea</button><button type="button" class="btn2" data-pp="ep-nota">${mas}Nota</button>`
      + `<label class="sw pp-ep-vcs"><input type="checkbox" data-pp="ep-vc"> Vista cliente</label>`   // what its client sees in its web (D-378)
      + `<button type="button" class="ibtn pp-ep-mas" data-pp="ep-mas" aria-label="Más del esporádico" title="Más">${svgI('mas3')}</button></div></div>`
      + `<div class="pp-ep-cols"><div class="pp-ep-ag"><section class="pp-ep-p pp-ep-citas" aria-label="Agenda"><h2 class="pp-ep-h">Agenda</h2>`
      + (ss.length ? grupo('Próximas', prox) + grupo('Sin fecha', sinf) + grupo('Pasadas', pas) : '<p class="pp-ep-vacio">Sin sesiones ni reuniones</p>')
      + `</section><div class="side pp-ep-side"><section class="cal" data-propio data-cli="${esc(id)}" aria-label="Calendario"></section></div></div>`
      + `<section class="pp-ep-p pp-ep-tn" aria-label="Tareas y notas"><h2 class="pp-ep-h">Tareas <span>${nT}</span></h2>${tk.length ? P.tareasHTML(R, { cli: id }) : '<p class="pp-ep-vacio">Sin tareas</p>'}`
      + `<h2 class="pp-ep-h pp-ep-h2">Notas <span>${ns.length}</span></h2>${ns.length ? pn : '<p class="pp-ep-vacio">Sin notas</p>'}</section>`
      + cobrosHTML(e) + `</div></div>`;
  }
  // its payments: Cobrado and Pendiente, its IVA and the table of always (one per session and client, D-234, or one free, D-377)
  function cobrosHTML(e) {
    const CO = M.cobrosUI, C = I().cob; if (!CO || !C) return `<section class="pp-ep-p pp-ep-cob" aria-label="Cobros"><h2 class="pp-ep-h">Cobros</h2><p class="pp-ep-vacio">${(window.MESA_CARGA || {}).cobros === 'fallo' ? 'No se pudieron cargar los cobros (cobros.js): recarga la página.' : 'Cargando los cobros…'}</p></section>`;
    const vv = C.vivos(e.id), suma = l => Math.round(l.reduce((n, r) => n + (+r.importe || 0), 0) * 100) / 100, cob = suma(vv.filter(r => r.cobrada)), pend = suma(vv.filter(r => !r.cobrada));
    const si = ivaEsp(e) === 0, iva = `<span class="co-ivw pp-ep-iv"><span class="co-ivl" aria-hidden="true">IVA</span><select class="co-q co-ivs" data-pp="ep-iva" aria-label="IVA del esporádico" title="Sin IVA: el de sus cobros nuevos; los que ya tiene no cambian"><option value="21"${si ? '' : ' selected'}>21 %</option><option value="0"${si ? ' selected' : ''}>Sin IVA</option></select></span>`;
    const tot = C.mal && C.mal() ? '' : `<div class="pp-ep-tot"><div><span>Cobrado</span><b>${P.esc(C.eur(cob))}</b></div><div${pend ? ' class="pend"' : ''}><span>Pendiente</span><b>${P.esc(C.eur(pend))}</b></div></div>`;
    return `<section class="pp-ep-p pp-ep-cob" aria-label="Cobros"><h2 class="pp-ep-h">Cobros${vv.length ? ` <span>${vv.length}</span>` : ''}${iva}</h2>${tot}${CO.html(e.id, { esp: true })}</section>`;
  }
  const espDePg = () => { const st = P.st, r = st && st.esp ? P.TK.get(st.esp) : null; return r && r.tipo === 'esporadico' && !r.pasado ? r : null; };   // its record
  // its name, written in its place (a click puts the caret there); Enter or leaving keeps it, Esc goes back
  function nomEscribir(pt) {
    const n = P.page && P.page.querySelector('.pp-ep-nom'); if (!n || nomVigente()) return;
    PG.ed = true; PG.id = P.st && P.st.esp; n.setAttribute('contenteditable', 'plaintext-only'); n.setAttribute('role', 'textbox'); n.removeAttribute('title'); n.classList.add('escribiendo'); n.focus({ preventScroll: true });
    let rg = pt && document.caretRangeFromPoint ? document.caretRangeFromPoint(pt.x, pt.y) : null; if (rg && !n.contains(rg.startContainer)) rg = null;
    if (!rg) { rg = document.createRange(); rg.selectNodeContents(n); rg.collapse(false); }
    const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg);
    // a press elsewhere or the focus to another element ends it (saved); the window losing the focus doesn't
    const fuera = ev => { if (ev.type === 'pointerdown' ? !n.contains(ev.target) : ev.target === n && ev.relatedTarget && !n.contains(ev.relatedTarget)) nomFin(true); };
    PG.fuera = fuera; document.addEventListener('pointerdown', fuera, true); n.addEventListener('focusout', fuera);
  }
  function nomFin(guardar) {
    if (!PG.ed) return; PG.ed = false;
    if (PG.fuera) { document.removeEventListener('pointerdown', PG.fuera, true); const n0 = P.page && P.page.querySelector('.pp-ep-nom'); if (n0) n0.removeEventListener('focusout', PG.fuera); PG.fuera = null; }
    const e0 = espDePg(), n = P.page && P.page.querySelector('.pp-ep-nom'); if (!e0 || !n) { P.pintar(); return; }
    const v = n.textContent.replace(/\s+/g, ' ').trim();
    n.removeAttribute('contenteditable'); n.removeAttribute('role'); n.classList.remove('escribiendo'); n.title = 'Clic: cambiar el nombre';
    if (!guardar || !v || v === e0.txt) { n.textContent = e0.txt; P.pintar(); return; }
    if ([...I().CL.map(c => c.name), ...P.esps().filter(x => x.id !== e0.id).map(x => x.txt)].some(x => String(x).toLowerCase() === v.toLowerCase())) { n.textContent = e0.txt; I().toast('Ya hay un cliente con ese nombre.'); P.pintar(); return; }
    if (!P.puede()) { n.textContent = e0.txt; I().toast('La mesa está abierta en otra pestaña: pulsa «Usar aquí».'); P.pintar(); return; }
    P.cambiar(e0.id, x => { x.txt = v; return x; }).then(ok => { if (!ok) I().toast('No se pudo guardar el nombre.'); P.pintar(); });
  }
  function pagClic(k, a, e) {
    const e0 = espDePg(); if (!e0) return; nomVigente();
    if (P.st.espVc === e0.id) { if (k === 'ep-vses') P.abrirCard(a.dataset.id, { vc: true, de: `[data-pp="ep-vses"][data-id="${CSS.escape(a.dataset.id)}"]` }); return; }   // its «Vista cliente»: a session as its client sees it (D-378)
    if (k === 'ep-nom') { if (!PG.ed && !P.seleccionando()) nomEscribir({ x: e.clientX, y: e.clientY }); return; }
    if (PG.ed) nomFin(true);
    if (k === 'ep-volver') { P.salirEsp(); return; }
    if (k === 'ep-sesion' || k === 'ep-reunion') { nueva({ ctx: null, campo: 'ficha', desde: e0, clase: k === 'ep-reunion' ? 'reunion' : undefined }); return; }
    if (k === 'ep-tarea' || k === 'ep-nota') { P.borrador({ cliente: e0.id, tipo: k === 'ep-nota' ? 'nota' : 'tarea', de: `[data-pp="${k}"]` }); return; }
    if (k === 'ep-mas') { const q = a.getBoundingClientRect(); P.abrirMenu(q.right - 220, q.bottom + 4, [['pasar', 'Pasar a mensual…', () => pasar(e0)], ...P.menuEsp(e0.id)], a); }
  }
  // its IVA (D-377): «Sin IVA» goes to its new payments; a step of ⌘Z, with «Deshacer»
  function pagCambio(t) {
    if (t.matches('[data-pp="ep-vc"]')) { const e0 = espDePg(); if (e0) { nomVigente(); if (PG.ed) nomFin(true); P.st.espVc = t.checked ? e0.id : null; P.pintar(); } return true; }   // its «Vista cliente» (D-378)
    if (!t.matches('[data-pp="ep-iva"]')) return false;
    const e0 = espDePg(); if (!e0) return true;
    const si = t.value === '0', antes = e0.sinIva === true; if (si === antes) return true;
    if (!P.puede()) { t.value = antes ? '0' : '21'; P.pintar(); I().toast('La mesa está abierta en otra pestaña: pulsa «Usar aquí».'); return true; }
    const poner = v => P.cambiar(e0.id, x => { if (v) x.sinIva = true; else delete x.sinIva; return x; }).then(ok => { P.pintar(); return ok; });
    poner(si).then(ok => !ok ? I().toast('No se pudo guardar su IVA.') : I().toast(si ? 'Sin IVA: sus cobros nuevos irán sin IVA; los que ya tiene no cambian.' : 'Con IVA (21 %) en sus cobros nuevos.', { action: 'Deshacer', ms: 6000, onAction: () => poner(antes) }));
    return true;
  }
  function pagTecla(e) {
    if (!nomVigente()) {   // its name, focused (as the page opens), is written with Enter
      const h = e.key === 'Enter' && !e.isComposing && e.target && e.target.matches && e.target.matches('.pp-ep-nom');
      if (h) { e.preventDefault(); e.stopImmediatePropagation(); nomEscribir(null); return true; }
      return false;
    }
    const n = P.page && P.page.querySelector('.pp-ep-nom'); if (!n) return false;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); nomFin(false); n.focus({ preventScroll: true }); return true; }   // also with the focus gone (another window)
    if (e.target !== n) return false;
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); nomFin(true); n.focus({ preventScroll: true }); return true; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); nomFin(false); n.focus({ preventScroll: true }); return true; }
    return true;                               // the rest is typed (the page's keys aren't for it)
  }
  function pagTras(page) { if (M.calendario && M.calendario.render) M.calendario.render(); }   // its calendar, in its place (its section is kept)
  // «Pasar a mensual»: asked first (it isn't undone with ⌘Z); the mesa's client is made without months (Claude makes them, D-184),
  // its sessions, tasks and notes go to it, the page stays; the sporadic record stays, marked as passed and hidden, so that an
  // older file imported doesn't bring it back
  function pasar(e0) {
    const X = I(), C = X.cob, id = e0.id, ns = n => n;
    const nS = P.sesiones().filter(k => P.conCli(k, id)).length, nT = P.tareas().filter(k => k.cliente === id).length, nN = P.notas().filter(k => k.cliente === id).length, nC = C ? C.vivos(id).length : 0;
    const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`, cosas = [nS && pl(nS, 'sesión', 'sesiones'), nT && pl(nT, 'tarea', 'tareas'), nN && pl(nN, 'nota', 'notas'), nC && pl(nC, 'cobro', 'cobros')].filter(Boolean);
    const lleva = (cosas.length ? `Se lleva ${cosas.length > 1 ? cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1] : cosas[0]}` : 'Pasa sin sesiones, tareas, notas ni cobros') + (e0.sinIva ? ', y su «Sin IVA»' : '') + '.';
    const TIP = [['redes', 'Gestión de redes', 'Tendrá su pestaña arriba; sus meses los crea Claude.'], ['contenido', 'Solo contenido', 'Tendrá su pestaña arriba, con su página de entregas.']];
    let tipo = 'redes';
    X.showDialog('pp-pasar', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Pasar «${P.esc(e0.txt)}» a mensual</h3>`
      + `<form class="form pp-pasf" autocomplete="off"><label id="pp-pas-tl">Tipo de cliente</label><div class="pp-ns-tipos pp-pas-t" role="radiogroup" aria-labelledby="pp-pas-tl">${TIP.map(([k, l], i) => `<button type="button" role="radio" class="pp-ns-t${i ? '' : ' on'}" data-k="${k}" aria-checked="${!i}" tabindex="${i ? -1 : 0}">${l}</button>`).join('')}</div>`
      + `<p class="pp-pas-p" data-pas="lleva">${P.esc(lleva)} ${TIP[0][2]}</p><p class="pp-pas-p pp-pas-no">No se deshace: ni con ⌘Z ni volviendo a esporádico.</p><div class="row"><button type="submit" class="btn" data-pp-pasar="1">Pasar a mensual</button></div></form>`);
    const det = X.root().querySelector('.detail'), f = det.querySelector('form.pp-pasf'), b = f.querySelector('[data-pp-pasar]'), ts = [...f.querySelectorAll('.pp-pas-t [data-k]')], txt = f.querySelector('[data-pas="lleva"]');
    const elegir = (x, foco) => { tipo = x.dataset.k; ts.forEach(y => { const s0 = y === x; y.classList.toggle('on', s0); y.setAttribute('aria-checked', String(s0)); y.tabIndex = s0 ? 0 : -1; }); txt.textContent = `${lleva} ${TIP.find(z => z[0] === tipo)[2]}`; if (foco) x.focus(); };
    ts.forEach(x => x.addEventListener('click', () => elegir(x)));
    f.querySelector('.pp-pas-t').addEventListener('keydown', ev => { const i = ts.indexOf(document.activeElement); if (i < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return; ev.preventDefault(); elegir(ts[(i + (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? ts.length - 1 : 1)) % ts.length], true); });
    ts[0].focus();
    f.addEventListener('submit', async ev => {
      ev.preventDefault(); if (b.disabled) return;
      if (X.CL.some(c => String(c.name).trim().toLowerCase() === String(e0.txt).trim().toLowerCase())) { X.closeDetail(); X.toast(`Ya hay un cliente mensual que se llama «${e0.txt}»: cambia antes el nombre del esporádico.`, { ms: 7000 }); return; }
      b.disabled = true;
      // its id stays (D-378): its web (its account, its comments, its invoices) goes with it; the server never changes a client's id
      let c; try { c = await M.addClient({ id: e0.id, name: e0.txt, servicio: tipo }); } catch (err) { X.toast('No se pudo: ' + ((err && err.message) || err)); b.disabled = false; return; }
      let sinIvaMal = false; try { if (e0.sinIva && C && C.ivaPoner) await C.ivaPoner(c.id, true); } catch (err) { sinIvaMal = true; }   // its «Sin IVA» goes with it (D-377); if not, said
      try { if (C) for (const r of C.vivos(e0.id)) await C.parche(r.id, { cliente: c.id }); }   // its payments go with it first (D-234)
      catch (err) { X.toast('No se pudo pasar sus cobros: ' + ((err && err.message) || err), { ms: 8000 }); b.disabled = false; return; }
      const now = P.ahoraISO(), cambios = [];
      // a session shared with others: only its part (D-217)
      const pasa = x => { if (x.tipo === 'esporadico' || !P.conCli(x, e0.id)) return false; if (x.tipo === 'sesion') ponerClis(x, P.clis(x).map(id => id === e0.id ? c.id : id)); else x.cliente = c.id; return true; };
      for (const k of P.vivos()) { const n = P.copia(k); if (pasa(n)) { n.at = now; cambios.push({ id: k.id, despues: n }); } }
      const ne = P.copia(P.TK.get(e0.id)); ne.pasado = { cliente: c.id, at: now }; ne.at = now; cambios.push({ id: e0.id, despues: ne });
      await P.escribir(cambios);
      P.remapH(pasa, e0.id);   // its own steps go: it can't come back unpassed
      if (P.st.tcli === e0.id) P.st.tcli = c.id;
      X.closeDetail(); if (P.CARD && P.CARD.id === e0.id) P.cerrarCard(true);
      P.cvistaPoner('mensuales'); if (P.st.esp === e0.id) P.salirEsp(false); await P.refrescar(); P.pintar();
      X.toast((tipo === 'contenido' ? `«${e0.txt}» ya es de solo contenido: tiene su pestaña arriba.` : `«${e0.txt}» ya es mensual: sus meses los crea Claude.`) + (sinIvaMal ? ' No se pudo pasar su «Sin IVA»: ponlo en «Editar cliente · Cobros».' : ''), sinIvaMal ? { ms: 9000 } : undefined);
    });
  }

  // ---------- «Duplicar sesión» (D-221): a whole copy to start from — its sections and its photos, these with new ids in their
  // own store (and in its shots, groups and strip), so deleting one never deletes it from the other; «Copia de …», without
  // date, time, end, clients nor done, its material unmarked from the same template; its sheet opens; one step of ⌘Z ----------
  async function duplicar(id) {
    const r0 = P.TK.get(id); if (!r0 || r0.tipo !== 'sesion' || !P.puede()) return;
    const X = I(), now = P.ahoraISO(), nid = P.nuevoId('ss'), mapa = new Map(), fotos = [];
    for (const f of r0.fotos || []) {
      const o = await X.idbGet('tfotos', f.id).catch(() => null); if (!o || !o.blob) continue;   // one that hasn't come down (lot 4) goes with its reference: it comes down later
      const fid = P.nuevoId('tf'); const { suelta, ...g } = o;
      await X.idbPut('tfotos', fid, { ...g, id: fid, sesion: nid, t: Date.now() }); mapa.set(f.id, fid); fotos.push({ ...f, id: fid });
    }
    const x = P.copia(r0), re = l => (l || []).map(f => mapa.get(f)).filter(Boolean);
    Object.assign(x, { id: nid, txt: 'Copia de ' + r0.txt, creada: now, at: now, clientes: [] });
    for (const k of ['fecha', 'hora', 'fin', 'hecha', 'cliente', 'fotos']) delete x[k];
    if (fotos.length) x.fotos = fotos;
    for (const a of x.sesion.apartados || []) {
      (a.pestanas || []).forEach(pt => (pt.items || []).forEach(i => { i.fotos = re(i.fotos); }));
      (a.grupos || []).forEach(g => { g.fotos = re(g.fotos); });
      if (a.material) a.material.hechos = [];
    }
    if (P.CARD && P.CARD.id === id) { if (P.CARD.ed) guardar(true); }
    await P.hacer([{ id: nid, despues: x }]);
    P.pintar(); P.abrirCard(nid);
  }

  // ---------- «Editar plantillas» (D-208, D-220): each template, its name, its place and its things; «Guardar» is one step ----------
  function editarLista() {
    const X = I(), ED = plantillas().map(t => ({ id: t.id, txt: String(t.txt || ''), lista: matPlantilla(t.id), orden: +t.orden || 0 }));
    if (!ED.length) ED.push({ id: MAT_ID, txt: MAT_SERIE, lista: [], orden: 0, nueva: true });
    let cur = Math.max(0, ED.findIndex(t => t.id === ((rec() && (ap(rec(), 'material') || {}).material || {}).plantilla || MAT_ID)));
    const fila = (x, L) => `<div class="pp-ml-f" data-id="${P.esc(x.id || '')}"><input type="text" class="pp-ml-n" value="${P.esc(x.nombre || '')}" aria-label="Nombre" maxlength="60"><input type="text" class="pp-ml-fa" value="${P.esc(x.familia || '')}" aria-label="Familia" list="pp-ml-fams" maxlength="40">`
      + `<select class="pp-ml-t" aria-label="Para"><option value="ambas"${x.tipo !== 'foto' && x.tipo !== 'video' ? ' selected' : ''}>Las dos</option><option value="foto"${x.tipo === 'foto' ? ' selected' : ''}>Foto</option><option value="video"${x.tipo === 'video' ? ' selected' : ''}>Vídeo</option></select>`
      + `<select class="pp-ml-p" aria-label="Colgada de"><option value="">Suelta</option>${L.filter(y => y.id !== x.id).map(y => `<option value="${P.esc(y.id)}"${x.padre === y.id ? ' selected' : ''}>${P.esc(y.nombre)}</option>`).join('')}</select>`
      + `<button type="button" class="pp-csx" data-ml="x" title="Quitar" aria-label="Quitar ${P.esc(x.nombre || 'la fila')}">${svgI('x')}</button></div>`;
    const leerForm = det => { const t = ED[cur], n = det.querySelector('.pp-mpl-n'); if (!t || !n) return; t.txt = n.value; t.lista = [...det.querySelectorAll('.pp-ml-f')].map(r => ({ id: r.dataset.id || undefined, nombre: r.querySelector('.pp-ml-n').value, familia: r.querySelector('.pp-ml-fa').value, tipo: r.querySelector('.pp-ml-t').value, colgadoDe: r.querySelector('.pp-ml-p').value || undefined })).filter(x => x.nombre.trim()); };
    const pintarD = foco => {
      const t = ED[cur], L = t.lista, serie = t.id === MAT_ID;
      X.showDialog('pp-material', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Plantillas de material</h3>`
        + `<div class="seg pp-tvs pp-mpl-tabs" role="group" aria-label="Plantilla">${ED.map((x, i) => `<button type="button" class="${i === cur ? 'on' : ''}" data-ml="pl" data-i="${i}" aria-pressed="${i === cur}">${P.esc(x.txt || 'Sin nombre')}</button>`).join('')}</div>`
        + `<form class="form pp-ml" autocomplete="off"><div class="pp-mpl-cab"><label for="pp-mpl-n">Nombre</label><input id="pp-mpl-n" class="pp-mpl-n" type="text" maxlength="40" value="${P.esc(t.txt)}">`
        + `<button type="button" class="btn2 pp-mpl-b" data-ml="antes" title="Mover la plantilla antes"${serie || cur <= 1 ? ' disabled' : ''}>Antes</button><button type="button" class="btn2 pp-mpl-b" data-ml="despues" title="Mover la plantilla después"${serie || cur >= ED.length - 1 ? ' disabled' : ''}>Después</button>`
        + `<button type="button" class="btn2 pp-mpl-x" data-ml="borrar"${serie ? ' disabled title="La plantilla de serie no se borra"' : ''}>Borrar plantilla</button></div><p class="ferr" hidden></p>`
        + `<div class="pp-ml-cab" aria-hidden="true"><span>Cosa</span><span>Familia</span><span>Para</span><span>Colgada de</span><span></span></div><div class="pp-ml-l">${matNormal(L).map(x => fila(x, matNormal(L))).join('')}</div>`
        + `<datalist id="pp-ml-fams">${[...new Set(ED.flatMap(x => x.lista.map(y => y.familia)).filter(Boolean))].map(f => `<option value="${P.esc(f)}">`).join('')}</datalist><button type="button" class="pp-cmas" data-ml="mas">${svgI('mas')}Cosa</button><div class="row"><button type="submit" class="btn">Guardar</button></div></form>`);
      const det = X.root().querySelector('.detail'), f = det.querySelector('form'), l = f.querySelector('.pp-ml-l'), err = f.querySelector('.ferr');
      if (M.controles && M.controles.mejorar) M.controles.mejorar(det);
      det.querySelector('.pp-mpl-tabs').addEventListener('click', e => { const b = e.target.closest('[data-ml="pl"]'); if (!b || +b.dataset.i === cur) return; leerForm(det); cur = +b.dataset.i; pintarD(`[data-ml="pl"][data-i="${cur}"]`); });
      f.addEventListener('click', e => {
        const b = e.target.closest('[data-ml]'); if (!b || b.disabled) return;
        if (b.dataset.ml === 'x') { b.closest('.pp-ml-f').remove(); return; }
        if (b.dataset.ml === 'mas') { const d = document.createElement('div'); d.innerHTML = fila({ id: P.nuevoId('ma'), nombre: '', familia: (l.lastElementChild && l.lastElementChild.querySelector('.pp-ml-fa').value) || '', tipo: 'ambas' }, []); l.append(d.firstChild); if (M.controles && M.controles.mejorar) M.controles.mejorar(l); l.lastElementChild.querySelector('.pp-ml-n').focus(); return; }
        if (b.dataset.ml === 'antes' || b.dataset.ml === 'despues') { leerForm(det); const j = cur + (b.dataset.ml === 'antes' ? -1 : 1); if (j < 1 || j >= ED.length) return; [ED[cur], ED[j]] = [ED[j], ED[cur]]; cur = j; pintarD(`[data-ml="${b.dataset.ml}"]`); return; }
        if (b.dataset.ml === 'borrar') { ED.splice(cur, 1); cur = Math.max(0, cur - 1); pintarD('.pp-mpl-n'); }
      });
      f.addEventListener('submit', async e => {
        e.preventDefault(); leerForm(det);
        const nombres = ED.map(x => x.txt.replace(/\s+/g, ' ').trim());
        if (nombres.some(n => !n)) { err.textContent = 'Cada plantilla necesita su nombre.'; err.hidden = false; return; }
        if (new Set(nombres.map(n => n.toLowerCase())).size !== nombres.length) { err.textContent = 'Hay dos plantillas con el mismo nombre.'; err.hidden = false; return; }
        const now = P.ahoraISO(), cambios = [], quedan = new Set(ED.map(x => x.id));
        ED.forEach((x, i) => { const o = matRec(x.id), n = { ...(o ? P.copia(o) : { id: x.id, tipo: 'material', creada: now }), txt: nombres[i], lista: matNormal(x.lista), orden: i, at: now };
          if (!o || JSON.stringify([o.txt, o.lista, +o.orden || 0]) !== JSON.stringify([n.txt, n.lista, n.orden])) cambios.push({ id: x.id, despues: n }); });
        for (const t of plantillas()) if (!quedan.has(t.id) && t.id !== MAT_ID) cambios.push({ id: t.id, despues: null });   // the sessions keep their copy (D-208)
        if (cambios.length) await P.hacer(cambios);
        X.closeDetail(); P.pintar();
      });
      const fo = foco && det.querySelector(foco); (fo || f.querySelector('.pp-mpl-n')).focus();
    };
    pintarD();
  }

  // ---------- the two kinds of card this file draws (personal.js keeps the card itself) ----------
  const HOJA = {
    cls: 'pp-hoja', pintar: (r, o = {}) => {
      if (S._id !== r.id) { S._id = r.id; S.vista = false; S.tira = false; S.plg.clear(); S.tab = {}; S.enl = null; S.campo = null; S.cosa = null; }
      if (P.CARD.vc) { S.vista = true; S.tira = false; }   // opened from the board in the vista cliente: fixed in «Ver como el cliente» (D-219)
      if (o.forzar && !P.CARD.ed) S.campo = null;
      const a = !o.forzar && M.controles && M.controles.abierto && M.controles.abierto(); if (a && P.ov && P.ov.contains(a.de)) return;   // a dropdown of the sheet open: it is finishing its gesture
      pintar(r, o);
    },
    clic, dbl, tecla, menu, cambio, escribir, archivos,
    ampliar: () => maquetar(),                 // widened or back (D-210): as many columns of the mood board as fit now
    guardar: fin => guardar(fin),
    cerrar: () => { if (ctlCampo) { ctlCampo.apagar(); ctlCampo = null; } S._id = null; S.firma = ''; mov = null; decodQ = []; soltarFotos(); },
    nueva, volverTexto, duplicar
  };
  const PAGINA = {
    pagina: (e, R) => paginaHTML(e, R), tras: pagTras, pagClic, pagCambio, pagTecla, ocupada: () => nomVigente(),
    vivo: n => n.nodeType === 1 && n.classList.contains('pp-ep-nom') && nomVigente(),   // its name being written: left as it is by a drawing
    // opened from the line of its payments (D-235): its «Cobros» in sight, the focus on its first control
    aCobros: page => requestAnimationFrame(() => { const sc = page && page.querySelector('.pp-ep-cob'); if (!sc) return; sc.scrollIntoView({ block: 'nearest' }); const b = sc.querySelector('[data-co="num"], [data-co="con"], [data-co="nuevo-ses"]'); if (b) b.focus({ preventScroll: true }); }),
    enfocar: page => requestAnimationFrame(() => { const h = page && page.querySelector('.pp-ep-nom'); if (h) h.focus({ preventScroll: true }); }),
    nuevo: () => pedirEsp(e2 => { if (e2) P.abrirEsp(e2.id); })   // made: its page (D-377)
  };

  // ---------- mounting: once personal.js is there ----------
  let listoP = null;
  const listo = () => listoP || (listoP = new Promise(res => { const t = setInterval(() => { if (M.personal && M.personal._p && I() && I().idbAll) { clearInterval(t); res(); } }, 100); }));
  listo().then(() => {
    P = M.personal._p;
    if (MOVIL) return;   // the iPhone (D-275): no listeners, no style, no limpiar() (it writes tfotos on its own: R1)
    P.EXT.sesion = HOJA; P.EXT.ficha = PAGINA;
    on(document, 'contextmenu', e => { const C = P.CARD; if (C && C.ext && C.ext.menu && P.enCard(e.target)) C.ext.menu(e); }, true);
    for (const ty of ['dragstart', 'dragenter', 'dragover', 'dragleave', 'drop']) on(document, ty, e => { const C = P.CARD; if (C && C.ext === HOJA && P.enCard(e.target)) arrastre(e); });
    on(document, 'pointerdown', e => { const C = P.CARD; if (C && C.ext === HOJA && P.enCard(e.target)) alPuntero(e); });
    on(document, 'pointermove', e => { if (mov) seguir(e); });
    on(document, 'pointerup', () => { if (mov) soltar(); });
    on(document, 'pointercancel', () => { if (mov) { const m = mov; mov = null; if (m.linea) m.linea.remove(); if (m.fant) m.fant.remove(); pintarYa(); } });
    on(window, 'resize', () => { if (rec()) alRedimensionar(); });
    on(document, 'mx-accion', e => { if (rec() && e.target.matches && e.target.matches('[data-hj="cli-mas"]')) pedirEsp(e2 => anadirCli(e2.id), () => { const r = rec(); if (r) P.abrirCard(r.id); }); });
    I().estilo('mesa-ses-css', ESTILO);
    if (P.page && P.st.on) P.pintar();
    setTimeout(limpiar, 8000);
  });
  // ---------- the iPhone (D-275): a session seen whole and edited field by field, with these same rules ----------
  // vista(id): the session as Kevin sees it on the Mac (not «as the client»), its sections in the Mac's order in one column (left, then
  // right). campo(id, campo, sub): what a field holds now (what was seen). editar(id, campo, valor): one field — the start (its end
  // moves with it, D-218), the clients (monthly and sporadic, none made here), a thing of the material (the template copied at the
  // first mark, as on the Mac), the name and the text of a text section. Each, a step of the tasks' ⌘Z.
  async function vistaMovil(id) {
    await listo(); await P.cargarTK(); const r = P.TK.get(id); if (!r || r.tipo !== 'sesion' || r._b || !r.sesion) return null;
    const C = columnas(r), orden = [...C.izq, ...C.der];
    const aps = orden.map(k => ap(r, k)).filter(Boolean).map(a => {
      const t = tipoDe(a), h = hechos(a, r), o = { id: a.id, tipo: t, nombre: a.nombre || (APS[a.id] || {}).n || a.id, visible: a.visible !== false, cuenta: h ? { hechas: h[0], n: h[1] } : null };
      if (t === 'texto') o.texto = typeof a.texto === 'string' ? a.texto : '';
      if (t === 'planos') o.pestanas = (a.pestanas || []).map(p => ({ id: p.id, nombre: p.nombre, items: (p.items || []).map(i => ({ id: i.id, titulo: i.titulo || '', texto: i.texto || '', hecho: !!i.hecho, fotos: (i.fotos || []).slice() })) }));
      if (t === 'mood') o.grupos = (a.grupos || []).map(g => ({ id: g.id, nombre: g.nombre || '', fotos: (g.fotos || []).slice() }));
      if (t === 'planos') { const it = o.pestanas.flatMap(p => p.items); if (it.length) o.cuenta = { hechas: it.filter(i => i.hecho).length, n: it.length }; }
      if (t === 'material') {   // as matHTML on the Mac: each thing in its own family, «Antes de salir» first, a hung thing right after its own
        const L = matDe(a, r).L, hs = new Set((a.material && a.material.hechos) || []), fams = [], fa = x => x.familia || 'Otros';
        for (const x of L) if (!fams.includes(fa(x))) fams.push(fa(x));
        fams.sort((x, y) => (/^antes de salir$/i.test(y) ? 1 : 0) - (/^antes de salir$/i.test(x) ? 1 : 0));
        const orden = l => { const out = []; for (const x of l.filter(y => !y.padre || !l.some(z => z.id === y.padre))) { out.push(x); out.push(...l.filter(y => y.padre === x.id)); } return out; };
        o.material = { familias: fams.map(f => { const cosas = orden(L.filter(x => fa(x) === f)).map(x => ({ id: x.id, nombre: x.nombre, hecha: hs.has(x.id), ...(x.padre ? { de: x.padre } : {}) })); return { nombre: f, cosas, hechas: cosas.filter(c => c.hecha).length }; }),
          hechas: L.filter(x => hs.has(x.id)).length, n: L.length };
      }
      return o;
    });
    // clientes: as the Mac reads them (a session from before 4.24 has only «cliente»); the face shows the ones it knows
    return { id: r.id, nombre: String(r.txt || ''), clase: claseTxt(r.sesion.clase), visible: r.sesion.visible !== false, fecha: r.fecha || '', hora: r.hora || '', fin: r.fin ? { ...r.fin } : null,
      clientes: P.clis(r), apartados: aps, fotos: (r.fotos || []).map(f => ({ id: f.id, w: f.w, h: f.h })) };
  }
  async function campoMovil(id, campo, sub) {
    await listo(); await P.cargarTK(); const r = P.TK.get(id); if (!r || r.tipo !== 'sesion' || r._b || !r.sesion) return { error: 'no existe' };
    if (campo === 'nombre') return { v: String(r.txt || '') };
    if (campo === 'inicio') return { v: { fecha: r.fecha || '', hora: r.hora || '' } };
    if (campo === 'clientes') return { v: [...P.clis(r)].sort() };
    const a = sub && ap(r, sub.ap); if (!a) return { error: 'no existe' };
    if (campo === 'material') return { v: { hecho: !!((a.material && a.material.hechos) || []).includes(sub.m) } };
    if (campo === 'texto') return { v: typeof a.texto === 'string' ? a.texto : '' };
    return { error: 'campo no válido' };
  }
  async function editarMovil(id, campo, v) {
    await listo(); await P.cargarTK(); const r = P.TK.get(id); if (!r || r.tipo !== 'sesion' || r._b || !r.sesion) return { error: 'no existe' };
    if (I().locked) return { error: 'sin turno' };
    let f = null;
    if (campo === 'nombre') { const n = String(v ?? '').replace(/\s*\n\s*/g, ' ').trim(); if (!n) return { error: 'una sesión necesita un nombre' }; f = x => { x.txt = n; return x; }; }
    else if (campo === 'inicio') {
      const o = v || {}; if ((o.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(o.fecha)) || (o.hora && !/^\d{2}:\d{2}$/.test(o.hora)) || (o.hora && !o.fecha)) return { error: 'fecha no válida' };
      f = x => { P.moverInicio(x, o.fecha || '', o.fecha ? o.hora || '' : undefined); return x; };   // its end moves with it, keeping the length (D-218); without a date the hour stays, as on the Mac
    } else if (campo === 'clientes') { if (!Array.isArray(v)) return { error: 'clientes no válidos' }; f = x => { const ya = new Set(P.clis(x)); ponerClis(x, v.filter(c => typeof c === 'string' && (P.cliDe(c) || ya.has(c)))); return x; }; }   // one it no longer knows, kept if it was there
    else if (campo === 'material') {
      const o = v || {}; f = x => { const y = ap(x, o.ap); if (!y || tipoDe(y) !== 'material') return null; const m = matDeY(y); if (!m.lista.some(z => z.id === o.m)) return null; const h = new Set(m.hechos || []); if (o.hecho) h.add(o.m); else h.delete(o.m); m.hechos = [...h]; return x; };
    } else if (campo === 'texto') { const o = v || {}; f = x => { const y = ap(x, o.ap); if (!y || tipoDe(y) !== 'texto') return null; y.texto = String(o.texto ?? ''); return x; }; }
    else return { error: 'campo no válido' };
    return (await P.cambiar(id, f)) ? { ok: true } : { error: I().locked ? 'sin turno' : campo === 'material' || campo === 'texto' ? 'no existe' : 'no se pudo guardar' };
  }
  M.sesiones = {
    version: VERSION, plantilla: () => P.hondo(PLANTILLA),
    movil: { vista: vistaMovil, campo: campoMovil, editar: editarMovil },
    paraCliente: r => paraCliente(r && r.id ? r : null),   // what a sporadic client sees of a session in its web (D-378)
    _test: { limpiar, reparto: () => reparto(), S: () => ({ ...S, plg: [...S.plg] }), decodificados: () => BM.size,
      crear: async o => { await listo(); const now = P.ahoraISO(), c = PLANTILLA[o.clase] ? o.clase : 'fotovideo', r = { id: P.nuevoId('ss'), tipo: 'sesion', txt: o.txt || nombreDe(c), creada: now, at: now, sesion: { clase: c, visible: o.visible !== false, plantilla: PLANTILLA.v, apartados: PLANTILLA[c].map(apartado) } }; if (o.fecha) r.fecha = o.fecha; if (o.hora) r.hora = o.hora; ponerClis(r, o.clientes || (o.cliente ? [o.cliente] : [])); if (o.fin && r.fecha) r.fin = { ...o.fin }; await P.hacer([{ id: r.id, despues: r }]); return P.copia(r); } },
    _off: () => { OFF.forEach(f => f()); OFF.length = 0; if (P) { delete P.EXT.sesion; delete P.EXT.ficha; } soltarFotos(); }
  };

  // ---------- style: only the mesa's tokens (D-131), its icons and stroke (D-168), its scale and weights (D-172) ----------
  const ESTILO = `
#mesa .pp-ov.pp-hoja{padding:28px 16px}
#mesa .pp-card.pp-hj:focus-visible{outline:none}
#mesa .pp-card.pp-hj{width:min(1180px,100%);max-height:100%;height:100%;padding:0;display:flex;flex-direction:column;overflow:auto}
#mesa .pp-hj-cab{padding:22px 26px 6px}
#mesa .pp-hj-t{display:flex;align-items:center;gap:12px}
#mesa .pp-hj-t .pp-ck{width:17px;height:17px}
#mesa .pp-hj-nom{flex:1;min-width:0;margin:-2px 0 -2px -6px;padding:3px 6px;border-radius:var(--r-sm);font-size:20px;font-weight:800;line-height:1.3;overflow-wrap:anywhere;outline:none}
#mesa .pp-ov .escribiendo{cursor:text}
#mesa .pp-hj-ojo{display:inline-flex;align-items:center;justify-content:center}
#mesa .pp-hj-ojo.sm{width:26px;height:26px;background:none}
#mesa .pp-hj-ojo[aria-pressed="false"]{color:var(--mute)}
#mesa .pp-hj-ojo.sm svg{width:15px;height:15px}
/* widened (D-210): the whole page under the mesa's header, its two columns at the whole width */
#mesa .pp-ov.pp-hoja.amplia{padding:0}
#mesa .pp-ov .pp-card.pp-hj.amplia{width:100%;max-width:none;height:100%;border-radius:0;box-shadow:none;padding:0;display:flex}
#mesa .pp-ov.amplia .pp-hj-cab{padding:22px 40px 6px}
#mesa .pp-ov.amplia .pp-hj-cols{padding:6px 32px 28px 40px}
#mesa .pp-hj svg,#mesa .pp-ep svg,#mesa .pp-ns-cab svg,#mesa .pp-ns svg,#mesa .pp-ml svg{stroke-width:var(--i-trazo)}
#mesa .pp-hj svg path,#mesa .pp-hj svg rect,#mesa .pp-hj svg circle,#mesa .pp-ep svg path,#mesa .pp-ep svg rect,#mesa .pp-ep svg circle,#mesa .pp-ns-cab svg path,#mesa .pp-ns-cab svg circle,#mesa .pp-ns svg path,#mesa .pp-ns svg rect,#mesa .pp-ns svg circle,#mesa .pp-ml svg path{vector-effect:non-scaling-stroke}
#mesa .pp-hj-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0 0 29px}
#mesa .pp-hj-chip{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 4px 0 10px;border:0;border-radius:var(--r-pill);background:var(--bg-2);font:inherit;font-size:12.5px;color:var(--ink-2)}
#mesa .pp-hj-chip.ro{padding:0 12px 0 10px}
#mesa .pp-hj-chip > svg{flex:none;width:14px;height:14px;color:var(--mute)}
#mesa .pp-hj-chip .mx-sel,#mesa .pp-hj-chip .mx-f{min-height:26px;height:26px;border-color:transparent;background:none}
#mesa .pp-hj-chip .mx-sel:hover,#mesa .pp-hj-chip .mx-f:hover{border-color:var(--line-strong)}
#mesa .pp-hj-chip .pp-ava.xs{width:18px;height:18px;font-size:9.5px}
#mesa .pp-hj-cl{padding:0 3px 0 6px}
#mesa .pp-hj-cln{min-width:0;max-width:15em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mesa .pp-hj-clx{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;padding:0;border-radius:50%;background:none;color:var(--mute);cursor:pointer;transition:background var(--d1) var(--ease),color var(--d1) var(--ease)}
#mesa .pp-hj-clx svg{width:13px;height:13px}#mesa .pp-hj-clx:hover{background:var(--bg-3);color:var(--ink)}#mesa .pp-hj-clx:active{transform:scale(.97)}
#mesa .pp-hj-clx:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
#mesa .pp-hj-clmas.con{padding:0 0 0 8px;background:none;color:var(--acc-ink);transition:background var(--d1) var(--ease),box-shadow var(--d1) var(--ease)}
#mesa .pp-hj-clmas.con > svg{color:var(--acc-ink)}#mesa .pp-hj-clmas.con:hover{background:var(--acc-soft)}
#mesa .pp-hj-clmas.con .mx-sel{padding:0 10px 0 0;color:var(--acc-ink);font-weight:600}#mesa .pp-hj-clmas.con .mx-sel:not(#mx){border-color:transparent;box-shadow:none}
#mesa .pp-hj-clmas.con:has(.mx-abierto),#mesa .pp-hj-clmas.con:has(.mx-sel:focus-visible){background:var(--acc-soft);box-shadow:0 0 0 3px var(--ring)}
#mesa .pp-hj-clmas.con .mx-sel::after,#mesa .pp-hj-clmas.con .mx-z{display:none}
#mesa .pp-hj-meta > .pp-hj-sp,#mesa .pp-ma-plr > .pp-hj-sp{display:none}#mesa .pp-hj-meta > .pp-hj-vc,#mesa .pp-ma-gb,#mesa .pp-ma-plr > .pp-cmas{margin-left:auto}
#mesa .pp-hj.vc .pp-hj-meta,#mesa .pp-hj.vc .pp-hj-tira{margin-left:0}
#mesa .pp-ns-cli{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
#mesa .pp-hj-fin{flex:none;opacity:0;pointer-events:none;margin:0 0 0 -2px;padding:0 9px;min-height:26px;border:0;border-radius:var(--r-pill);background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--acc-ink);white-space:nowrap;cursor:pointer;transition:opacity var(--d1) var(--ease),background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-hj-fh:hover .pp-hj-fin,#mesa .pp-hj-fh:focus-within .pp-hj-fin,#mesa .pp-ns-2 > div:hover .pp-hj-fin,#mesa .pp-ns-2 > div:focus-within .pp-hj-fin{opacity:1;pointer-events:auto}
#mesa .pp-hj-fin:hover{background:var(--acc-soft)}#mesa .pp-hj-fin:active{transform:scale(.97)}#mesa .pp-hj-fin:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
#mesa .pp-hj-gu{flex:none;color:var(--mute);margin:0 -1px}
#mesa .pp-hj-ff{display:inline-flex;min-width:0}
#mesa .pp-hj-ff.mismo .mx-cal:not(#mx){opacity:0;pointer-events:none;transition:opacity var(--d1) var(--ease)}
#mesa .pp-hj-ff.mismo{order:1}#mesa .pp-hj-ff.mismo ~ .pp-hj-finx{order:2}   /* its kept place after the end's time: «12:00 – 14:00» reads together (D-231) */   /* the end the same day: its calendar only with the pointer over it or the focus, its place kept (D-231) */
#mesa .pp-hj-fh:hover .pp-hj-ff.mismo .mx-cal:not(#mx),#mesa .pp-hj-fh:focus-within .pp-hj-ff.mismo .mx-cal:not(#mx),#mesa .pp-ns-2 > div:hover .pp-hj-ff.mismo .mx-cal:not(#mx),#mesa .pp-ns-2 > div:focus-within .pp-hj-ff.mismo .mx-cal:not(#mx){opacity:1;pointer-events:auto}
#mesa .pp-hj-ff.mismo .mx-in:not(#mx){width:0;padding:0}#mesa .pp-hj-ff.mismo .mx-in:not(#mx):focus-visible{width:10.2ch;padding:0 2px 0 10px}
#mesa .pp-hj-fh.confin{padding-right:3px}
#mesa .pp-ns-fin{display:flex;align-items:center;gap:6px;min-height:30px;margin-top:6px;min-width:0}#mesa .pp-ns-fin:empty{display:none}#mesa .pp-ns-fin .pp-hj-fin{margin-left:-9px}
#mesa .pp-ns-fin .pp-hj-ff.mismo .mx-f:not(#mx){border-color:transparent;background:none}
#mesa button.pp-hj-chip{padding:0 12px 0 10px;cursor:pointer;transition:background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa button.pp-hj-chip:hover{background:var(--bg-3)}#mesa button.pp-hj-chip[aria-expanded="true"]{background:var(--panel-2);box-shadow:var(--shadow-xs);color:var(--ink)}
#mesa .pp-hj-sp{flex:1}
#mesa .pp-hj-vc{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 10px;border:0;border-radius:var(--r-pill);background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--ink-2);cursor:pointer;transition:background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-hj-vc svg{width:15px;height:15px}#mesa .pp-hj-vc:hover{background:var(--bg-2);color:var(--ink)}#mesa .pp-hj-vc.on{background:var(--acc-soft);color:var(--acc-ink)}
#mesa .pp-hj-mas svg,#mesa .pp-hj-apm svg{width:16px;height:16px}
#mesa .pp-hj-tira{display:flex;gap:6px;overflow-x:auto;margin:12px 0 4px 29px;padding:6px;border-radius:var(--r-md);background:var(--bg-2)}
#mesa .pp-hj-tf.pp-fo{flex:none;width:64px;height:64px;cursor:grab}
#mesa .pp-hj-tf.pp-fo img{object-fit:cover}
#mesa .pp-hj-cols{display:grid;grid-template-columns:minmax(0,1.2fr) 17px minmax(0,1fr);flex:1 0 auto;padding:6px 18px 28px 26px;position:relative;transition:grid-template-columns var(--d-m) var(--ease-m)}
#mesa .pp-hj-cols.una{grid-template-columns:minmax(0,1fr)}
#mesa .pp-hj-cols.mov{transition:none}
#mesa .pp-hj-col{min-width:0;display:flex;flex-direction:column;gap:26px;padding:14px 4px 0}
#mesa .pp-hj-col[data-col="der"]{padding-left:24px}   /* 20 px more inside: its sections' handle has its own room, off the separator's (D-216) */
#mesa .pp-hj-sep{position:relative;cursor:col-resize;outline:none}
#mesa .pp-hj-sep::before{content:'';position:absolute;top:0;bottom:0;left:8px;width:1px;background:var(--line2);transition:background var(--d1) var(--ease)}
#mesa .pp-hj-sep::after{content:'';position:absolute;top:120px;left:5px;width:7px;height:28px;border-radius:var(--r-pill);background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line);transition:background var(--d1) var(--ease)}
#mesa .pp-hj-sep:not(.fija):hover::before,#mesa .pp-hj-sep.mov::before{background:var(--line-strong)}#mesa .pp-hj-sep.fija{cursor:auto}#mesa .pp-hj-sep.fija::after{display:none}   /* as the client sees it: the line alone (D-228) */#mesa .pp-hj-sep:focus-visible::after{box-shadow:0 0 0 2px var(--focus)}
#mesa .pp-hj-ap{min-width:0}
#mesa .pp-hj-ap.mov{opacity:.4}
#mesa .pp-hj-aph{position:relative;display:flex;align-items:center;gap:6px;min-height:32px;margin:0 0 6px -18px;padding-left:18px}
#mesa .pp-hj-asa{position:absolute;left:-2px;top:50%;margin-top:-9px;display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;color:var(--faint);cursor:grab;opacity:0;transition:opacity var(--d1) var(--ease)}
#mesa .pp-hj-asa svg{width:14px;height:14px}
#mesa .pp-hj-aph:hover .pp-hj-asa,#mesa .pp-hj-aph:focus-within .pp-hj-asa{opacity:1}
#mesa .pp-hj-pl{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:3px 8px 3px 2px;border-radius:var(--r-pill);font:inherit;color:var(--ink);cursor:pointer;transition:background var(--d1) var(--ease)}
#mesa .pp-hj-pl svg{width:15px;height:15px;color:var(--mute);transition:transform var(--d-m) var(--ease-m)}
#mesa .pp-hj-ap.plg .pp-hj-pl svg{transform:rotate(-90deg)}
#mesa .pp-hj-pl b{font-size:var(--cx-tit-fs);font-weight:var(--cx-tit-fw);letter-spacing:var(--cx-tit-ls)}
#mesa .pp-hj-pl:hover{background:var(--bg-2)}
#mesa .pp-hj-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
#mesa .pp-hj-n{font-size:12px;color:var(--mute)}
#mesa .pp-hj-apm{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity var(--d1) var(--ease)}
#mesa .pp-hj-aph:hover .pp-hj-apm,#mesa .pp-hj-apm:focus-visible,#mesa .pp-hj-apm[aria-expanded="true"]{opacity:1}
#mesa .pp-hj-pl:focus-visible,#mesa .pp-hj-ojo:focus-visible,#mesa .pp-hj-apm:focus-visible,#mesa .pp-hj-vc:focus-visible,#mesa .pp-hj-mas:focus-visible,#mesa .pp-pl-tab:focus-visible,#mesa .pp-pl-mas:focus-visible,#mesa .pp-ma-c:focus-visible,#mesa .pp-pl-ena:focus-visible,#mesa button.pp-hj-chip:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp-hj-apc{min-width:0;animation:pp-dentro var(--d-m) var(--ease-m)}
#mesa .pp-hj-tx{min-height:22px;margin-left:-6px;padding:2px 6px;border-radius:var(--r-xs);font-size:14px;line-height:1.55;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere;outline:none}
#mesa .pp-hj-tx.escribiendo{min-height:26px}
#mesa .pp-hj-tx.vacio{min-height:26px;border-radius:var(--r-sm);box-shadow:inset 0 0 0 1px var(--line2)}
#mesa .pp-mo-f.vacio{min-height:56px;border-radius:var(--r-md);box-shadow:inset 0 0 0 1px var(--line2)}
#mesa .pp-fo:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp-hj-linea{position:absolute;height:2px;border-radius:var(--r-pill);background:var(--acc);pointer-events:none}
#mesa .pp-hj-fant{position:absolute;left:0;top:0;z-index:5;margin:0;padding:4px 12px 4px 18px;border-radius:var(--r-md);background:var(--panel-2);box-shadow:var(--shadow-lg);pointer-events:none;width:300px}
#mesa .pp-hj-oculta{display:flex;align-items:center;gap:8px;margin:40px 26px;font-size:14px;color:var(--mute)}#mesa .pp-ov.amplia .pp-hj-oculta{margin-inline:40px}   /* where the title starts */
#mesa .pp-card.pp-hj:not(.amplia):has(> .pp-hj-oculta){height:auto}   /* one line, no sheet of the whole height (D-228) */#mesa .pp-hj-oculta svg{width:18px;height:18px}
#mesa .pp-hj-apn{align-self:flex-start;margin-top:-6px}
/* the photos placed: each one whole, at the size it takes */
#mesa .pp-fo{position:relative;flex:none;display:inline-block;overflow:hidden;border-radius:var(--r-xs);background:var(--bg-3)}
#mesa .pp-fo img,#mesa .pp-fo canvas{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:contain}
#mesa .pp-hj .pp-fo{cursor:zoom-in}#mesa .pp-hj .pp-fo[draggable="true"]{cursor:grab}
/* shots: tabs, each one with its references on the right */
/* the tabs as the sections' titles (D-214, 7-A): the title's letter, its count as the sections', the other one in --mute (D-231) */
#mesa .pp-pl-tabs{display:flex;align-items:center;gap:2px;flex:1;min-width:0;overflow-x:auto;margin-left:-6px}
#mesa .pp-hj-pl:has(.pp-hj-sr){padding-right:0}
#mesa .pp-pl-tab{display:inline-flex;align-items:baseline;gap:6px;border:0;background:none;padding:3px 8px 3px 6px;font:inherit;color:var(--mute);cursor:pointer;white-space:nowrap;border-radius:var(--r-pill);transition:color var(--d1) var(--ease),background var(--d1) var(--ease)}
#mesa .pp-pl-tab .pp-pl-tn{font-size:var(--cx-tit-fs);font-weight:var(--cx-tit-fw);letter-spacing:var(--cx-tit-ls)}
#mesa .pp-pl-tab .pp-hj-n{color:inherit}#mesa .pp-pl-tab:hover{background:var(--bg-2);color:var(--mute)}
#mesa .pp-pl-tab.on{color:var(--ink)}#mesa .pp-pl-tab.on .pp-hj-n{color:var(--mute)}
#mesa .pp-pl-tab:focus-visible,#mesa .pp-pl-mas:focus-visible{outline-offset:-2px}
#mesa .pp-pl-tabs .pp-pl-tn.escribiendo{padding:2px 4px;margin:-2px -4px}
#mesa .pp-pl-ti.escribiendo{min-height:22px}
#mesa .pp-pl-mas{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center}#mesa .pp-pl-mas svg{width:15px;height:15px}
#mesa .pp-pl-items{display:flex;flex-direction:column}
#mesa .pp-pl-it{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(0,auto);column-gap:8px;padding:14px 0 14px;border-bottom:1px solid var(--line2)}
#mesa .pp-pl-it:last-child{border-bottom:0}
#mesa .pp-pl-it > .pp-ck{margin:3px 0 0 4px}
#mesa .pp-pl-c{min-width:0}
#mesa .pp-pl-ti{margin-left:-6px;padding:1px 6px;border-radius:var(--r-xs);font-size:14px;font-weight:600;outline:none;overflow-wrap:anywhere}
#mesa .pp-pl-ti.vacio{color:var(--mute);font-weight:400}
#mesa .pp-pl-it.hecho .pp-pl-ti{text-decoration:line-through;color:var(--mute)}
#mesa .pp-pl-c .pp-hj-tx{font-size:13px;color:var(--ink-2);margin-top:2px}
#mesa .pp-pl-ref{display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:220px;min-width:110px}
#mesa .pp-pl-fos{display:flex;flex-wrap:wrap;gap:4px}
#mesa .pp-pl-ens{display:flex;flex-direction:column;gap:3px;max-width:100%}
#mesa .pp-pl-en{display:inline-flex;align-items:center;gap:4px;max-width:100%;font-size:12px;color:var(--acc-ink);text-decoration:none}
#mesa .pp-pl-en span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mesa .pp-pl-en:hover span{text-decoration:underline}#mesa .pp-pl-en svg{flex:none;width:12px;height:12px}
#mesa .pp-pl-ein{width:100%;height:26px;border:0;padding:0 8px;font:inherit;font-size:12px;outline:none;color:var(--ink)}
#mesa .pp-pl-sin{font-size:12px;color:var(--mute)}
#mesa .pp-pl-ena{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:2px 6px;margin-left:-6px;border-radius:var(--r-pill);font:inherit;font-size:12px;color:var(--mute);cursor:pointer;opacity:0;transition:opacity var(--d1) var(--ease),background var(--d1) var(--ease)}
#mesa .pp-pl-ena svg{width:12px;height:12px}#mesa .pp-pl-it:hover .pp-pl-ena,#mesa .pp-pl-ena:focus-visible{opacity:1}#mesa .pp-pl-ena:hover{background:var(--bg-2);color:var(--ink)}
#mesa .pp-hj .pp-cmas{margin-top:8px}
/* mood board */
#mesa .pp-mo{display:flex;flex-direction:column;gap:18px}
#mesa .pp-mo-gh{display:flex;align-items:center;gap:8px;margin:0 0 8px}
#mesa .pp-mo-gn{font-size:13.5px;font-weight:600;padding:1px 6px;margin-left:-6px;border-radius:var(--r-xs);outline:none}
#mesa .pp-mo-modo button{min-width:30px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center}#mesa .pp-mo-modo svg{width:14px;height:14px}
#mesa .pp-mo-f{display:flex;gap:4px;min-height:40px}
#mesa .pp-mo-f.linea{overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}
#mesa .pp-mo-f.todas{display:block;position:relative}
#mesa .pp-mo-f.todas .pp-fo{position:absolute;left:0;top:0}
#mesa .pp-mo-g.pp-drop,#mesa .pp-pl-ref.pp-drop,#mesa .pp-hj-tira.pp-drop{border-radius:var(--r-md)}
/* material (Ma2 + Ma3): «Antes de salir» first, the rest by families, each thing a chip marked with a click */
#mesa .pp-ma{display:flex;flex-direction:column;gap:14px}
#mesa .pp-ma-bar{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--mute)}#mesa .pp-ma-bar .pp-pb{flex:1;width:auto;height:4px}
#mesa .pp-ma-fam.antes{padding:10px;border-radius:var(--r-md);background:var(--bg-2)}
#mesa .pp-ma-ft{margin:0 0 8px;font-size:13px}#mesa .pp-ma-ft b{font-weight:600}#mesa .pp-ma-ft span{color:var(--mute);font-size:12px}
#mesa .pp-ma-fi{display:flex;flex-wrap:wrap;gap:6px}
#mesa .pp-ma-c{display:inline-flex;align-items:center;gap:8px;min-height:30px;padding:0 12px 0 9px;border:0;border-radius:var(--r-pill);background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line);font:inherit;font-size:12.5px;color:var(--ink-2);cursor:pointer;transition:background var(--d1) var(--ease),box-shadow var(--d1) var(--ease),color var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-ma-plr{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin:0 0 12px}#mesa .pp-ma-plr .seg button{white-space:nowrap}
#mesa .pp-ma-plr .pp-cmas{margin:0;color:var(--acc-ink)}#mesa .pp-ma-gb{display:inline-flex;flex-wrap:wrap;gap:8px}#mesa .pp-ma-cmb{margin-top:-4px}#mesa .pp-ma-cmb > span:first-child{font-size:12.5px;font-weight:600;color:var(--chg)}
#mesa .pp-ma-pt{display:inline-block;width:6px;height:6px;margin:0 0 0 6px;border-radius:50%;background:var(--chg);vertical-align:middle}#mesa .pp-ma-plr > .pp-ma-pt{margin-left:-6px}
#mesa .pp-ma-ge{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 12px;border:0;border-radius:var(--r-pill);background:var(--bg-2);font:inherit;font-size:12.5px;font-weight:600;color:var(--ink-2);cursor:pointer;transition:background var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-ma-ge svg{width:14px;height:14px}#mesa .pp-ma-ge:hover{background:var(--bg-3);color:var(--ink)}#mesa .pp-ma-ge:active{transform:scale(.97)}#mesa .pp-ma-ge:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp-ma-w{position:relative;display:inline-flex}
#mesa .pp-ma-x{position:absolute;right:-6px;top:-6px;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:0;padding:0;border-radius:50%;background:var(--bg-3);box-shadow:0 0 0 2px var(--panel);color:var(--ink-2);cursor:pointer;opacity:0;pointer-events:none;transition:opacity var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-ma-fam.antes .pp-ma-x{box-shadow:0 0 0 2px var(--bg-2)}#mesa .pp-ma-x:active{transform:scale(.97)}
#mesa .pp-ma-x svg{width:12px;height:12px}#mesa .pp-ma-x:hover{background:var(--line-strong);color:var(--ink)}
#mesa .pp-ma-w:hover .pp-ma-x,#mesa .pp-ma-w:focus-within .pp-ma-x{opacity:1;pointer-events:auto}
#mesa .pp-ma-x:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
#mesa .pp-ma-mas{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 12px 0 9px;border:1px dashed var(--line-strong);border-radius:var(--r-pill);background:none;font:inherit;font-size:12.5px;color:var(--mute);cursor:pointer;transition:background var(--d1) var(--ease),color var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-ma-mas svg{width:13px;height:13px}#mesa .pp-ma-mas:hover{background:var(--bg-2);color:var(--ink)}#mesa .pp-ma-mas:active{transform:scale(.97)}#mesa .pp-ma-mas:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .pp-ma-in{min-height:30px;width:12em;max-width:100%;box-sizing:border-box;padding:0 12px;border:1px solid color-mix(in srgb,var(--acc) 50%,transparent);border-radius:var(--r-pill);background:none;font:inherit;font-size:12.5px;color:var(--ink);outline:0}   /* what is written in the page: one thin line (D-213) */
#mesa .pp-mpl-tabs{margin:2px 0 14px;flex-wrap:wrap}
#mesa .pp-mpl-cab{display:flex;align-items:center;gap:8px;margin:0 0 12px}#mesa .pp-mpl-cab label{margin:0}#mesa .pp-mpl-cab .pp-mpl-n{flex:1;min-width:0}
#mesa .pp-mpl-b{flex:none}
#mesa .pp-ma-c::before{content:'';flex:none;width:11px;height:11px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--mute);transition:background var(--d1) var(--ease),box-shadow var(--d1) var(--ease)}
#mesa .pp-ma-c:hover{box-shadow:inset 0 0 0 1px var(--line-strong);color:var(--ink)}
#mesa .pp-ma-c.on{background:var(--acc-soft);box-shadow:none;color:var(--acc-ink)}#mesa .pp-ma-c.on::before{background:var(--acc);box-shadow:none}
#mesa .pp-ma-c:active,#mesa button.pp-hj-chip:active,#mesa .pp-hj-vc:active{transform:scale(.97)}
/* client view: what the client would see */
#mesa .pp-hj.vc .pp-hj-aph{margin-left:0;padding-left:0}
#mesa .pp-hj.vc .pp-pl-it{grid-template-columns:minmax(0,1fr) minmax(0,auto)}
/* «Nueva sesión» (Q2) */
#mesa .detail[data-dlg="pp-sesion"] .card.dlg{max-width:500px;width:100%}
#mesa .pp-ns-cab{display:flex;align-items:center;gap:12px;margin:0 0 4px}#mesa .pp-ns-cab h3{margin:0 64px 0 0}
#mesa .pp-ns-cab .pp-hj-ojo{position:absolute;top:12px;right:44px}
#mesa .pp-ns-tipos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
#mesa .pp-ns-t{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:58px;padding:8px 4px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--panel-2);font:inherit;font-size:12.5px;font-weight:600;color:var(--ink-2);cursor:pointer;transition:background var(--d1) var(--ease),border-color var(--d1) var(--ease),color var(--d1) var(--ease),transform var(--d1) var(--ease)}
#mesa .pp-ns-t svg{width:17px;height:17px}#mesa .pp-ns-t:hover{border-color:var(--line-strong);color:var(--ink)}
#mesa .pp-ns-t.on{background:var(--acc-soft);border-color:var(--acc);color:var(--acc-ink)}
#mesa .pp-ns-t:focus-visible{outline:2px solid var(--focus);outline-offset:2px}#mesa .pp-ns-t:active{transform:scale(.97)}
#mesa .pp-ns-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
#mesa .pp-ns-2 > div{display:flex;flex-direction:column;min-width:0}
#mesa .pp-ns-fh{display:flex;gap:6px;min-width:0}#mesa .pp-ns-fh .mx-f{min-width:0}
#mesa .detail[data-dlg="pp-material"] .card.dlg{max-width:720px;width:100%}
#mesa .pp-ml-cab,#mesa .pp-ml-f{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) 104px minmax(0,1fr) 26px;gap:6px;align-items:center}
#mesa .pp-ml-cab{font-size:11.5px;color:var(--mute);margin:0 0 4px}
#mesa .pp-ml-l{display:flex;flex-direction:column;gap:6px;max-height:min(52vh,460px);overflow:auto;padding:2px}
#mesa .pp-ml-f input{min-width:0}
/* a sporadic client's page (D-377): the page's place, its head and three columns, each its own scroll; at 980 or less, one */
#mesa .pp-ava.lg{width:44px;height:44px;font-size:16px}
#mesa .pp-es-l{display:flex;flex-direction:column}
#mesa .pp-es-s{display:grid;grid-template-columns:150px 18px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:38px;padding:4px 6px;margin-left:-6px;border:0;border-bottom:1px solid var(--line2);background:none;font:inherit;font-size:13px;color:var(--ink);text-align:left;cursor:pointer;border-radius:var(--r-xs);transition:background var(--d1) var(--ease)}
#mesa .pp-es-s:hover{background:var(--bg-2)}#mesa .pp-es-s svg{width:16px;height:16px;color:var(--mute)}
#mesa .pp-es-s b{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#mesa .pp-es-s i{font-style:normal;font-size:12px;font-weight:600;color:var(--acc-ink)}
#mesa .pp-es-d{font-size:12.5px;color:var(--mute)}#mesa .pp-es-d.prox{color:var(--ink);font-weight:600}
#mesa .pp.pp-ep-on:not([hidden]){display:flex;flex-direction:column;overflow:hidden;padding-bottom:20px}
#mesa .pp-ep{flex:1;min-height:0;display:flex;flex-direction:column}
#mesa .pp-ep-cab{flex:none;display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:6px 0 14px}
#mesa .pp-ep-vol{display:inline-flex;align-items:center;gap:2px;min-height:32px;margin:0 6px 0 -6px;padding:0 8px 0 2px;border:0;border-radius:var(--r-pill);background:none;font:inherit;font-size:13px;font-weight:600;color:var(--acc-ink);cursor:pointer;transition:background var(--d1) ease-out}
#mesa .pp-ep-vol svg{width:16px;height:16px}#mesa .pp-ep-vol:hover{background:var(--bg-2)}
#mesa .pp-ep-id{display:flex;align-items:center;gap:12px;min-width:0}#mesa .pp-ep-t{min-width:0}
#mesa .pp-ep h1.pp-ep-nom{margin:0 0 0 -6px;padding:2px 6px;border-radius:var(--r-sm);font-size:22px;font-weight:800;line-height:1.25;letter-spacing:-.01em;overflow-wrap:anywhere;cursor:text}
#mesa .pp-ep-nom:hover:not(.escribiendo){background:var(--bg-2)}#mesa .pp-ep-nom.escribiendo{background:none;box-shadow:inset 0 0 0 1px var(--pp-escr);outline:none}   /* what is written, D-213 */
#mesa .pp-ep-t p{margin:1px 0 0;font-size:12.5px;color:var(--mute)}
#mesa .pp-ep-sp{flex:1}
#mesa .pp-ep-acc{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#mesa .pp-ep-acc .pp-ep-vcs{margin:0 2px 0 6px}   /* «Vista cliente» (D-378) */
#mesa .pp-ep.vc .pp-ep-cab{min-height:56px}
#mesa .pp-ep-nc{display:block;font-weight:400;font-size:12.5px;color:var(--mute);margin-top:1px}
#mesa .pp-ep-vtl{display:flex;flex-direction:column}
#mesa .pp-ep-vt{display:grid;grid-template-columns:52px minmax(0,1fr);column-gap:10px;align-items:baseline;padding:8px 2px;border-bottom:1px solid var(--line);font-size:13.5px}
#mesa .pp-ep-vt:last-child{border-bottom:0}#mesa .pp-ep-vd{font-size:12.5px;color:var(--mute);white-space:nowrap}#mesa .pp-ep-vt.hecha .pp-ep-vx{text-decoration:line-through;color:var(--mute)}
#mesa .pp-ep-vn{background:var(--panel-2);border-radius:var(--r-sm);padding:10px 12px;font-size:13.5px;line-height:1.45;margin:0 0 8px}
#mesa .pp-ep-acc svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}#mesa .pp-ep-acc .ibtn svg{width:18px;height:18px}
#mesa .pp-ep-cols{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(320px,380px);gap:12px}
#mesa .pp-ep-ag{min-height:0;display:grid;grid-template-rows:minmax(0,auto) minmax(300px,1fr);gap:12px}
#mesa .pp-ep-p{min-width:0;min-height:0;overflow-y:auto;overscroll-behavior:contain;background:var(--panel);border-radius:var(--r-lg);padding:14px 18px 16px}
#mesa .pp-ep-side{min-height:0;background:none}#mesa .pp-ep .pp-ep-side,#mesa.hv-on .pp-ep .pp-ep-side{flex:none}   /* never the board's stories' column (historias.js) */#mesa .pp-ep .pp-ep-side>.cal:not(.fold){flex:1 1 auto;height:100%;min-height:0;border-top:0;border-radius:var(--r-lg)}   /* over the calendar's own narrow rule (42vh) */
#mesa .pp-ep-side>.cal .calhead{padding:12px 12px 4px 18px}
#mesa .pp-ep h2.pp-ep-h{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;font-size:17px;font-weight:800;letter-spacing:-.025em;color:var(--ink)}
#mesa .pp-ep-h>span:not(.co-ivw){font-size:13px;font-weight:400;letter-spacing:0;color:var(--mute)}
#mesa .pp-ep h2.pp-ep-h2{margin-top:22px}
#mesa .pp-ep h3.pp-ep-sub{margin:0;padding:4px 0}#mesa .pp-ep-gr + .pp-ep-gr{margin-top:14px}
#mesa .pp-ep-vacio{margin:0;font-size:13px;color:var(--mute)}
#mesa .pp-ep-p .pp-es-s{grid-template-columns:150px 18px minmax(0,1fr) auto}#mesa .pp-ep-p .pp-es-l>.pp-es-s:last-child{border-bottom:0}
#mesa .pp-ep-tn .pp-tk .pp-avs{display:none}
#mesa .pp-ep-tn .pp-tk.pp-tg,#mesa .pp-ep-tn .pp-sinf .pp-tk.pp-tg{grid-template-columns:42px 32px minmax(0,1fr)}#mesa .pp-ep-tn .pp-sinf .pp-tfv{display:block}
#mesa .pp-ep-tn .pp-tv{display:block}#mesa .pp-ep-tn .pp-sinf{margin:14px 0 0;padding:10px 0 0;border-left:0;border-top:1px solid var(--line2)}#mesa .pp-ep-tn .pp-sinf .pp-sub{padding:4px 10px}
#mesa .pp-ep-tn .pp-pn{margin:2px 0 0}
#mesa .pp-ep-h .pp-ep-iv{margin-left:auto;align-self:center;font-size:13px;font-weight:400;letter-spacing:0}#mesa .pp-ep-iv .co-ivs + .mx-sel{width:auto;min-width:96px}
#mesa .pp-ep-tot{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 14px}
#mesa .pp-ep-tot>div{padding:10px 12px;border-radius:var(--r-md);background:var(--bg-2)}
#mesa .pp-ep-tot span{display:block;font-size:12px;color:var(--mute)}
#mesa .pp-ep-tot b{display:block;margin-top:2px;font-size:18px;font-weight:800;letter-spacing:-.01em;color:var(--ink)}#mesa .pp-ep-tot .pend b{color:var(--chg)}   /* pending, as its state (.co-e.pend) */
#mesa .pp-pas-t{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0 12px}
#mesa .pp-pas-p{margin:0 0 10px;font-size:13px;line-height:1.5;color:var(--ink-2)}#mesa .pp-pas-p.pp-pas-no{color:var(--ink);font-weight:600}
@media (min-width:981px) and (max-width:1240px){#mesa .pp-ep-cols{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr)}#mesa .pp-ep-ag{grid-row:1 / span 2}}   /* two columns: its tasks over its payments */
@media (max-width:980px){#mesa .pp.pp-ep-on:not([hidden]){display:block;overflow-y:auto}#mesa .pp-ep{display:block}#mesa .pp-ep-cols{display:flex;flex-direction:column;flex:none}#mesa .pp-ep-ag{display:flex;flex-direction:column}#mesa .pp-ep-cols .pp-ep-p,#mesa .pp-ep-side{flex:none;overflow:visible}#mesa .pp-ep .pp-ep-side>.cal:not(.fold){height:auto;min-height:420px}}
@media (max-width:720px){
  #mesa .pp-ov.pp-hoja{padding:16px 10px}#mesa .pp-ov.pp-hoja.amplia{padding:0}
  #mesa .pp-ov.amplia .pp-hj-cab{padding:18px 16px 4px}#mesa .pp-ov.amplia .pp-hj-cols{padding:6px 14px 24px 22px}
  #mesa .pp-hj-cab{padding:18px 16px 4px}#mesa .pp-hj-meta{margin-left:0}#mesa .pp-hj-tira{margin-left:0}#mesa .pp-hj-oculta,#mesa .pp-ov.amplia .pp-hj-oculta{margin:32px 16px}
  #mesa .pp-hj-cols{padding:6px 14px 24px 22px}
  #mesa .pp-pl-it{grid-template-columns:28px minmax(0,1fr)}#mesa .pp-pl-ref{grid-column:2;max-width:none;margin-top:8px}
  #mesa .pp-ns-tipos{grid-template-columns:repeat(2,minmax(0,1fr))}#mesa .pp-ns-2{grid-template-columns:minmax(0,1fr)}
  #mesa .pp-es-sec{margin-left:0}#mesa .pp-es-s{grid-template-columns:116px 18px minmax(0,1fr) auto}
  #mesa .pp-ml-cab{display:none}#mesa .pp-ml-f{grid-template-columns:minmax(0,1fr) minmax(0,1fr);padding:8px 0;border-bottom:1px solid var(--line2)}
}
@media (prefers-reduced-motion:reduce){#mesa .pp-hj-cols,#mesa .pp-hj-pl svg,#mesa .pp-hj-fin,#mesa .pp-hj-ff.mismo .mx-cal:not(#mx){transition:none}#mesa .pp-hj-apc{animation:none}#mesa .pp-ma-c:active,#mesa button.pp-hj-chip:active,#mesa .pp-hj-vc:active,#mesa .pp-ns-t:active,#mesa .pp-hj-clx:active,#mesa .pp-hj-fin:active,#mesa .pp-ma-mas:active,#mesa .pp-ma-ge:active,#mesa .pp-ma-x:active{transform:none}}
`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).sesiones = 'ok';
})();
