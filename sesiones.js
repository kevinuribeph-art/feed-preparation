// Sesiones — Mesa de trabajo · v1.0 (D-206, D-207, D-208)
// The personal page's sessions and sporadic clients. A session (Foto · Vídeo · Foto y vídeo · Libre) is a sheet for the client
// and for the shoot at once: its sections come from Kevin's Notion templates, each with an eye (the client will see it, or only
// Kevin), in two columns with a separator; a sporadic client has a file with its notes, sessions and tasks and can become a
// monthly one. Everything lives in the store 'tareas' (tipo 'sesion', 'esporadico', 'material'), so it travels in «⇅ Exportar»,
// and a session's photos in their own store 'tfotos' (D-206: writing in a session never writes its photos again). Nothing is
// built for the client yet: the eye is only a datum. Sessions never go to Notion nor Zernio (D-184).
//   M.material: cargar(lista) · ver()          (the list of material, which Claude loads; it isn't in the code: the repo is public)
// It waits for personal.js (its card, its ⌘Z, its writing); if it doesn't load, the sessions still show in the lists.
(function sesionesBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;
  const VERSION = '1.1';   // 1.1: a click writes in the sheet and the file (D-209); the sheet widens (D-210); the mood board in columns of a cell of the feed (D-211); the shots' tabs as titles (D-214); the right column 20 px inside (D-216)
  if (M.sesiones && M.sesiones._off) { try { M.sesiones._off(); } catch (e) { /* */ } }
  let P = null;                                // personal.js's own (M.personal._p)
  const OFF = [];
  const on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };

  // ---------- what a session is made of ----------
  const CLASES = [['foto', 'Foto', 'camara'], ['video', 'Vídeo', 'video'], ['fotovideo', 'Foto y vídeo', 'sesion'], ['libre', 'Libre', 'libre']];
  const claseTxt = k => (CLASES.find(c => c[0] === k) || CLASES[2])[1];
  const nombreDe = k => k === 'libre' ? 'Sesión libre' : 'Sesión de ' + claseTxt(k).toLowerCase();
  // each kind of section; the eye crossed out by default: Material, Notas, Incompletos, Transiciones and Planos recurso
  const APS = {
    orden: { n: 'Orden', t: 'texto' }, fotos: { n: 'Fotos', t: 'texto' }, planos: { n: 'Planos', t: 'planos' }, mood: { n: 'Mood board', t: 'mood' },
    material: { n: 'Material', t: 'material', oculto: true }, referencias: { n: 'Referencias', t: 'texto' }, notas: { n: 'Notas', t: 'texto', oculto: true },
    guion: { n: 'Guion', t: 'texto' }, preguntas: { n: 'Preguntas', t: 'texto' }, objetivo: { n: 'Objetivo', t: 'texto' },
    incompletos: { n: 'Incompletos', t: 'texto', oculto: true }, transiciones: { n: 'Transiciones', t: 'texto', oculto: true }, recurso: { n: 'Planos recurso', t: 'texto', oculto: true }
  };
  const ORDEN = ['orden', 'planos', 'fotos', 'mood', 'material', 'referencias', 'notas', 'guion', 'preguntas', 'objetivo', 'incompletos', 'transiciones', 'recurso'];
  // what each kind brings (Kevin's Notion template of that kind, the sections filled in 4 or more of 30 pages); a session keeps
  // its own copy and the version: changing this never touches the sessions made
  const PLANTILLA = { v: 1, foto: ['orden', 'fotos', 'mood', 'material'], video: ['orden', 'planos', 'fotos', 'mood', 'material'], fotovideo: ['orden', 'planos', 'fotos', 'mood', 'material'], libre: ['notas'] };
  const DEF_DER = ['mood', 'material', 'notas', 'incompletos', 'referencias'];   // the right column, until moved
  function apartado(id) {
    const a = APS[id], o = { id, nombre: a.n, visible: !a.oculto };
    if (a.t === 'texto') o.texto = '';
    if (a.t === 'planos') o.pestanas = [{ id: P.nuevoId('pt'), nombre: 'Planos', items: [] }, { id: P.nuevoId('pt'), nombre: 'Vídeos', items: [] }];
    if (a.t === 'mood') o.grupos = [];
    if (a.t === 'material') o.material = { lista: matPlantilla(), hechos: [] };
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
  const MAT_ID = 'material';
  const matRec = () => P && P.TK.get(MAT_ID);
  const matPlantilla = () => { const m = matRec(); return m && Array.isArray(m.lista) ? P.hondo(m.lista) : []; };
  const TIPO_MAT = t => /^v/i.test(String(t || '')) ? 'video' : /^f/i.test(String(t || '')) ? 'foto' : 'ambas';
  function matNormal(l) {                      // [{nombre, familia, tipo, colgadoDe}] → the list kept, with ids; colgadoDe by name or id
    const out = [], porNombre = new Map();
    for (const x of l || []) { const n = String((x && (x.nombre || x.n)) || '').trim(); if (!n) continue; const o = { id: (x && typeof x.id === 'string' && x.id) || P.nuevoId('ma'), nombre: n, familia: String((x && x.familia) || 'Otros').trim() || 'Otros', tipo: TIPO_MAT(x && x.tipo) }; out.push(o); porNombre.set(n.toLowerCase(), o.id); }
    (l || []).forEach((x, i) => { const c = x && (x.colgadoDe || x.padre); if (!c || !out[i]) return; const id = out.some(o => o.id === c) ? c : porNombre.get(String(c).toLowerCase()); if (id && id !== out[i].id) out[i].padre = id; });
    return out;
  }
  async function matGuardar(lista, paso) {
    const now = P.ahoraISO(), m = matRec(), n = { ...(m ? P.copia(m) : { id: MAT_ID, tipo: 'material', txt: 'Material', creada: now }), lista: matNormal(lista), at: now };
    if (paso) await P.hacer([{ id: MAT_ID, despues: n }]); else await P.escribir([{ id: MAT_ID, despues: n }]);
    return n;
  }
  M.material = {
    // Claude loads Kevin's list: [{nombre, familia, tipo: 'foto' | 'video' | 'ambas', colgadoDe}]; only new, never a name of the API changed
    cargar: async lista => { await listo(); if (!Array.isArray(lista) || !lista.length) return { error: 'falta la lista' }; await P.refrescar(); const n = await matGuardar(lista, false); P.pintar(); return { ok: true, n: n.lista.length }; },
    ver: async () => { await listo(); const m = await I().idbGet('tareas', MAT_ID).catch(() => null); return m && Array.isArray(m.lista) ? P.hondo(m.lista) : []; }
  };

  // ---------- a session's photos: their own store, drawn at the size they take (as D-116) ----------
  const FB = new Map();                        // photo id -> a promise of {rec, mini (url)}
  const BM = new Map();                        // 'id@WxH' -> ImageBitmap decoded at that size
  function foto(id) {                          // read once: every caller waits for the same reading
    if (!FB.has(id)) FB.set(id, (async () => { const o = { rec: null, mini: '' }; try { o.rec = await I().idbGet('tfotos', id); if (o.rec && o.rec.mini) o.mini = URL.createObjectURL(o.rec.mini); } catch (e) { /* gone */ } return o; })());
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
  const S = { vista: false, tira: false, plg: new Set(), tab: {}, campo: null, firma: '', enl: null };   // what the sheet shows (this visit)
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
    const P_ = a.pestanas && a.pestanas.length ? a.pestanas : [{ id: 'p0', nombre: 'Planos', items: [] }], vc = S.vista;
    let act = S.tab[a.id]; if (!P_.some(p => p.id === act)) act = S.tab[a.id] = P_[0].id;
    const pt = P_.find(p => p.id === act), sing = n => /^planos$/i.test(n) ? 'Plano' : /^v[ií]deos$/i.test(n) ? 'Vídeo' : n;
    const tabs = `<span class="pp-pl-tabs" role="tablist" aria-label="${P.esc(a.nombre || 'Planos')}">${P_.map(p => { const n = (p.items || []).length, h = (p.items || []).filter(i => i.hecho).length, c = `tab:${a.id}:${p.id}`;
      if (P.CARD.ed && S.campo === c) return `<span class="pp-pl-tab on"><span class="pp-pl-tn" data-campo="${P.esc(c)}">${P.esc(p.nombre)}</span></span>`;   // being renamed
      return `<button type="button" role="tab" class="pp-pl-tab${p.id === act ? ' on' : ''}" data-hj="tab" data-tab="${P.esc(p.id)}" aria-selected="${p.id === act}" data-campo="${P.esc(c)}" title="Doble clic: cambiar el nombre"><span class="pp-pl-tn">${P.esc(p.nombre)}</span>${n ? ` <span class="pp-hj-n">${h}/${n}</span>` : ''}</button>`; }).join('')}${vc ? '' : `<button type="button" class="ibtn pp-pl-mas" data-hj="tab-mas" title="Nueva pestaña" aria-label="Nueva pestaña">${svgI('mas')}</button>`}</span>`;
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
    const gs = (a.grupos || []).map(g => {
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
    const m = a.material || { lista: [], hechos: [] }, L0 = m.lista && m.lista.length ? m.lista : matPlantilla(), c = r.sesion.clase;
    const L = L0.filter(x => c === 'foto' ? x.tipo !== 'video' : c === 'video' ? x.tipo !== 'foto' : true);
    return { L, propia: !!(m.lista && m.lista.length) };
  }
  function matHTML(a, r) {
    const { L } = matDe(a, r), hs = new Set((a.material && a.material.hechos) || []);
    if (!L.length) return `<p class="pp-pl-sin">Sin lista de material</p>`;
    const fams = []; for (const x of L) if (!fams.includes(x.familia)) fams.push(x.familia);
    fams.sort((x, y) => (/^antes de salir$/i.test(y) ? 1 : 0) - (/^antes de salir$/i.test(x) ? 1 : 0));
    const orden = l => { const out = []; for (const x of l.filter(y => !y.padre || !l.some(z => z.id === y.padre))) { out.push(x); out.push(...l.filter(y => y.padre === x.id)); } return out; };
    const n = L.length, h = L.filter(x => hs.has(x.id)).length;
    return `<div class="pp-ma"><div class="pp-ma-bar">${`<span class="pp-pb" aria-hidden="true"><i style="width:${(h / n * 100).toFixed(1)}%"></i></span>`}<span>${h}/${n}</span></div>`
      + fams.map(f => { const l = orden(L.filter(x => x.familia === f)), fh = l.filter(x => hs.has(x.id)).length;
        return `<div class="pp-ma-fam${/^antes de salir$/i.test(f) ? ' antes' : ''}"><p class="pp-ma-ft"><b>${P.esc(f)}</b> <span>${fh}/${l.length}</span></p><div class="pp-ma-fi">${l.map(x => `<button type="button" class="pp-ma-c${hs.has(x.id) ? ' on' : ''}${x.padre ? ' hijo' : ''}" data-hj="mat" data-m="${P.esc(x.id)}" aria-pressed="${hs.has(x.id)}">${P.esc(x.nombre)}</button>`).join('')}</div></div>`; }).join('') + `</div>`;
  }
  function apHTML(a, r) {
    const t = tipoDe(a), plg = S.plg.has(a.id);
    if (t === 'planos') { const p = planosHTML(a, r); return `<section class="pp-hj-ap${plg ? ' plg' : ''}" data-ap="${P.esc(a.id)}">${aph(a, r, p.cab)}${plg ? '' : `<div class="pp-hj-apc">${p.cuerpo}</div>`}</section>`; }
    const cuerpo = plg ? '' : t === 'mood' ? moodHTML(a, r) : t === 'material' ? matHTML(a, r) : texto('ap:' + a.id, typeof a.texto === 'string' ? a.texto : '', 'Vacío');
    return `<section class="pp-hj-ap${plg ? ' plg' : ''}" data-ap="${P.esc(a.id)}">${aph(a, r)}${plg ? '' : `<div class="pp-hj-apc">${cuerpo}</div>`}</section>`;
  }
  function hojaHTML(r) {
    const X = I(), ses = r.sesion, vc = S.vista, vis = ses.visible !== false, nf = (r.fotos || []).length;
    const C = columnas(r), dos = innerWidth > 720 && C.izq.length && C.der.length;
    const verAp = id => { const a = ap(r, id); return a && (!vc || (vis && a.visible !== false)); };
    const col = c => C[c].filter(verAp).map(id => apHTML(ap(r, id), r)).join('');
    const faltan = ORDEN.filter(id => !ap(r, id));
    const fija = !!(P.CARD && P.CARD.vc), cls = P.clis(r).filter(P.cliOk).filter(c => !fija || c === P.CARD.cli);   // the vista cliente: only that board's client (D-219)
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
      : `<div class="pp-hj-cols${dos ? '' : ' una'}" style="${dos ? `grid-template-columns:minmax(0,${C.sep.toFixed(4)}fr) 17px minmax(0,${(1 - C.sep).toFixed(4)}fr)` : ''}"><div class="pp-hj-col" data-col="izq">${col('izq')}${dos ? '' : col('der')}${!dos && !vc && faltan.length ? `<button type="button" class="pp-cmas pp-hj-apn" data-hj="ap-nuevo">${svgI('mas')}Apartado</button>` : ''}</div>`
        + (dos ? `<div class="pp-hj-sep" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Separador de las columnas" aria-valuemin="25" aria-valuemax="75" aria-valuenow="${Math.round(C.sep * 100)}" title="Arrastra para repartir · doble clic: como al principio"></div><div class="pp-hj-col" data-col="der">${col('der')}${!vc && faltan.length ? `<button type="button" class="pp-cmas pp-hj-apn" data-hj="ap-nuevo">${svgI('mas')}Apartado</button>` : ''}</div>` : '') + `</div>`;
    return `<div class="pp-card pp-hj${vc ? ' vc' : ''}${P.CARD && P.CARD.ed ? ' ed' : ''}${P.CARD && P.CARD.amplia ? ' amplia' : ''}" role="dialog" aria-modal="true" aria-label="Sesión: ${P.esc(r.txt)}" tabindex="-1">${cab}${cuerpo}</div>`;
  }

  // ---------- drawing the sheet ----------
  // what the sheet shows besides the record (each write leaves a new record object: compared as it is, never by its time)
  function firma(r) { return [S.vista, S.tira, [...S.plg].join(), JSON.stringify(S.tab), S.enl, P.CARD.ed, S.campo, P.lsGet(LS), innerWidth > 720, P.clis(r).map(c => (P.cliDe(c) || {}).name).join(',')].join('|'); }
  let ctlCampo = null;
  function pintar(r, o = {}) {
    const ov = P.ov; if (!ov || !r) return;
    const f = firma(r), j = JSON.stringify(r); if (!o.forzar && f === S.firma && j === S.rJ && ov.firstChild) return;
    if (P.CARD.ed && S.campo && ov.querySelector('[contenteditable]')) { guardar(false); r = rec() || r; }   // what is being written goes in first: never lost by a drawing
    S.firma = f; S.rJ = JSON.stringify(r);
    const enl = ov.querySelector('[data-hj="en-in"]'), enlV = enl ? enl.value : '';
    const c0 = ov.firstChild, y = c0 ? c0.scrollTop : 0, foco = document.activeElement && ov.contains(document.activeElement) ? claveFoco(document.activeElement) : null;
    if (ctlCampo) { ctlCampo.apagar(); ctlCampo = null; }
    ov.innerHTML = hojaHTML(r);
    if (M.controles && M.controles.mejorar) M.controles.mejorar(ov);
    const c = ov.firstChild; c.scrollTop = y;
    if (enlV) { const e2 = ov.querySelector('[data-hj="en-in"]'); if (e2) e2.value = enlV; }
    maquetar();
    const cl = ov.querySelector('.pp-hj-cols'); if (cl) cl.addEventListener('transitionend', ev => { if (ev.target === cl) colocarMood(); });   // the separator's move ends
    if (P.CARD.ed && S.campo) escribirEn(S.campo, o.pt); else if (foco) { const b = ov.querySelector(foco); if (b) b.focus({ preventScroll: true }); else c.focus({ preventScroll: true }); } else c.focus({ preventScroll: true });
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
    if (!UNA.test(campo) && P.ES()) ctlCampo = P.ES().activar(el, { comandos: () => ['tarea', 'fecha', 'lista', 'numerada', 'casilla'], alComando: (k, ctx) => P.comando(k, ctx, campo) });
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
    if (k === 'mat' && !S.vista) { const id = a.dataset.m; cambiar(x => { const y = ap(x, apId); if (!y) return false; const m = y.material = y.material || { lista: [], hechos: [] }; if (!m.lista || !m.lista.length) m.lista = matPlantilla(); const h = new Set(m.hechos || []); if (h.has(id)) h.delete(id); else h.add(id); m.hechos = [...h]; }); return true; }
    if (k === 'cli-x' && !S.vista) { quitarCli(a.dataset.c); return true; }
    if (k === 'fin' && !S.vista) { cambiar(x => { if (!x.fecha || x.fin) return false; x.fin = P.finNuevo(x); }).then(() => { const i = P.ov && P.ov.querySelector('[data-hj="fin-hora"], [data-hj="fin-fecha"]'), g = i && M.controles && M.controles.gemelo && M.controles.gemelo(i); if (g) (g.firstChild || g).focus({ preventScroll: true }); }); return true; }
    if (k === 'fin-x' && !S.vista) { cambiar(x => { if (!x.fin) return false; delete x.fin; }).then(() => { const b = P.ov && P.ov.querySelector('[data-hj="fin"]'); if (b) b.focus({ preventScroll: true }); }); return true; }
    if (k === 'tira') { S.tira = !S.tira; pintarYa(); return true; }
    if (k === 'vista' && !P.CARD.vc) { if (P.CARD.ed) P.editar(false); S.vista = !S.vista; pintarYa(); const b = P.ov.querySelector('[data-hj="vista"]'); if (b) b.focus({ preventScroll: true }); return true; }
    if (k === 'mas') { const q = a.getBoundingClientRect(); P.abrirMenu(q.left, q.bottom + 4, P.menuSesion(r.id, [['material', 'Editar la lista de material', () => editarLista()]]), a); return true; }
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
    if (t.matches && t.matches('[data-hj="en-in"]')) {
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); S.enl = null; pintarYa(); return true; }
      if (k === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); anadirEnlace(t); return true; }
      return false;
    }
    if (t.matches && t.matches('.pp-hj-sep') && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home')) {
      e.preventDefault(); const R = reparto(); R.sep = k === 'Home' ? SEP0 : Math.max(0.3, Math.min(0.7, R.sep + (k === 'ArrowRight' ? 0.02 : -0.02))); guardarReparto(R); pintarYa(); const s = P.ov.querySelector('.pp-hj-sep'); if (s) s.focus(); return true;
    }
    if (k === 'Escape' && !P.CARD.ed && S.vista && !P.CARD.vc) { e.preventDefault(); e.stopImmediatePropagation(); S.vista = false; pintarYa(); return true; }
    return false;
  }
  function escribir(e) {
    if (e.target.matches && e.target.matches('[data-hj="en-in"]')) return;
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
    if (k === 'cli-mas') { const v = t.value; t.value = ''; if (v === '__nuevo') { pedirEsp(e2 => anadirCli(e2.id)); return true; } if (v && P.cliDe(v)) anadirCli(v); return true; }   // one more client (D-217): a step of ⌘Z
    if (k === 'it-hecho') { const it = t.dataset.it, apId = t.closest('[data-ap]').dataset.ap, pt = S.tab[apId]; cambiar(x => { const y = ap(x, apId), p = y && (y.pestanas || []).find(q => q.id === pt), i = p && (p.items || []).find(q => q.id === it); if (!i) return false; i.hecho = t.checked; if (!i.hecho) delete i.hecho; }); return true; }
    return false;
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
    if (t.closest('.pp-hj-cab')) { e.preventDefault(); P.abrirMenu(e.clientX, e.clientY, P.menuSesion(r.id, [['material', 'Editar la lista de material', () => editarLista()]])); return true; }
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
      if (!o.rec || !o.rec.blob) return;
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
    const asa = e.target.closest('.pp-hj-asa'), sep = e.target.closest('.pp-hj-sep');
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
  function nueva({ ctx, campo, desde }) {
    const cli = campo === 'nueva' ? (P.st.tcli || P.st.nueva.cliente || '') : (desde && desde.tipo === 'esporadico' ? desde.id : desde && desde.cliente) || '';
    DLG = { origen: document.activeElement, estado: { nombre: nombreDe('fotovideo'), tocado: false, clase: 'fotovideo', fecha: '', hora: '', fin: null, clientes: P.cliDe(cli) ? [cli] : [], visible: true }, ctx, campo, desde };
    dialogo();
  }
  function dialogo() {
    const X = I(), E = DLG.estado;
    X.showDialog('pp-sesion', `<button class="x" data-act="close" aria-label="Cerrar">×</button><div class="pp-ns-cab"><h3>Nueva sesión</h3>${ojoBtn(E.visible, 'pp-cb', 'data-ns="ojo"')}</div>`
      + `<form class="form pp-ns" autocomplete="off"><label for="pp-ns-nom">Nombre</label><input id="pp-ns-nom" type="text" maxlength="80" value="${P.esc(E.nombre)}" required>`
      + `<label id="pp-ns-tl">Tipo</label><div class="pp-ns-tipos" role="radiogroup" aria-labelledby="pp-ns-tl">${CLASES.map(([k, l, ic]) => `<button type="button" role="radio" class="pp-ns-t${E.clase === k ? ' on' : ''}" data-ns="clase" data-k="${k}" aria-checked="${E.clase === k}" tabindex="${E.clase === k ? 0 : -1}">${svgI(ic)}<span>${l}</span></button>`).join('')}</div>`
      + `<div class="pp-ns-2"><div><label for="pp-ns-fecha">Fecha y hora</label><span class="pp-ns-fh"><input id="pp-ns-fecha" type="date" data-sin-fecha value="${P.esc(E.fecha)}" aria-label="Fecha de la sesión"><input id="pp-ns-hora" type="time" value="${P.esc(E.hora)}" aria-label="Hora de la sesión"></span><span class="pp-ns-fin${E.fin ? ' confin' : ''}">${finHTML(E, 'data-ns')}</span></div>`
      + `<div><label id="pp-ns-cl">Clientes</label><div class="pp-ns-cli" role="group" aria-labelledby="pp-ns-cl">${clisHTML(E.clientes, 'data-ns')}</div></div></div>`
      + `<div class="row"><button type="submit" class="btn">Crear sesión</button></div></form>`);
    const det = X.root().querySelector('.detail'), f = det.querySelector('form.pp-ns'), nom = f.querySelector('#pp-ns-nom');
    nom.addEventListener('input', () => { E.nombre = nom.value; E.tocado = true; });
    det.querySelector('[data-ns="ojo"]').addEventListener('click', ev => { E.visible = !E.visible; const b = ev.currentTarget; b.setAttribute('aria-pressed', String(E.visible)); b.title = b.ariaLabel = E.visible ? 'Lo verá el cliente' : 'Solo para ti'; b.innerHTML = E.visible ? svgI('ojo') : svgI('ojoNo'); });
    const tipos = [...det.querySelectorAll('[data-ns="clase"]')], elegir = (b, foco) => { E.clase = b.dataset.k; tipos.forEach(x => { const s = x === b; x.classList.toggle('on', s); x.setAttribute('aria-checked', String(s)); x.tabIndex = s ? 0 : -1; }); if (!E.tocado) { E.nombre = nombreDe(E.clase); nom.value = E.nombre; } if (foco) b.focus(); };
    tipos.forEach((b, i) => { b.addEventListener('click', () => elegir(b)); b.addEventListener('keydown', ev => { const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0; if (!d) return; ev.preventDefault(); elegir(tipos[(i + d + tipos.length) % tipos.length], true); }); });
    const fe = det.querySelector('#pp-ns-fecha'), ho = det.querySelector('#pp-ns-hora'), cz = det.querySelector('.pp-ns-cli');
    // the end (D-218), under «Fecha y hora»: only its place is drawn again; the start moves it keeping the length
    const fz = det.querySelector('.pp-ns-fin');
    const pintarFin = foco => { fz.classList.toggle('confin', !!E.fin); fz.innerHTML = finHTML(E, 'data-ns'); if (M.controles && M.controles.mejorar) M.controles.mejorar(fz); const f = foco && fz.querySelector(foco); if (f) { const g = M.controles && M.controles.gemelo && M.controles.gemelo(f); (g ? g.firstChild || g : f).focus({ preventScroll: true }); } };
    const inicio = (fecha, hora) => { const x = { tipo: 'sesion', fecha: E.fecha, hora: E.hora, ...(E.fin ? { fin: { ...E.fin } } : {}) }; P.moverInicio(x, fecha, hora); E.fecha = x.fecha || ''; E.hora = x.hora || ''; E.fin = x.fin || null; setTimeout(() => pintarFin(), 0); };
    fe.addEventListener('change', () => inicio(/^\d{4}-\d{2}-\d{2}$/.test(fe.value) ? fe.value : ''));
    ho.addEventListener('change', () => inicio(E.fecha, /^\d{2}:\d{2}/.test(ho.value) ? ho.value.slice(0, 5) : ''));
    fz.addEventListener('click', ev => { const b = ev.target.closest('[data-ns]'); if (!b) return;
      if (b.dataset.ns === 'fin' && E.fecha) { E.fin = P.finNuevo(E); pintarFin('[data-ns="fin-hora"], [data-ns="fin-fecha"]'); }
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
  // a sporadic client's file: its notes (post-its), its sessions and tasks, «+ Sesión», «+ Tarea» and «Pasar a mensual»
  const F = { campo: null, firma: '' };
  function fichaHTML(e) {
    const hoy = I().hoy(), ss = P.sesiones().filter(k => P.conCli(k, e.id)).sort((a, b) => String(b.fecha || '9').localeCompare(String(a.fecha || '9'))), ts = P.tareas().filter(k => k.cliente === e.id).sort((a, b) => String(a.fecha || '9').localeCompare(String(b.fecha || '9'))), ns = P.notas().filter(k => k.cliente === e.id);
    const desde = e.creada ? `${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+e.creada.slice(5, 7) - 1]} ${e.creada.slice(0, 4)}` : '';
    const ses = k => { const ico = k.sesion && k.sesion.clase === 'foto' ? 'camara' : k.sesion && k.sesion.clase === 'video' ? 'video' : k.sesion && k.sesion.clase === 'libre' ? 'libre' : 'sesion', d = k.fecha ? P.difD(hoy, k.fecha) : null;
      return `<button type="button" class="pp-es-s" data-pp="tver" data-id="${P.esc(k.id)}"><span class="pp-es-d${d != null && d >= 0 ? ' prox' : ''}">${k.fecha ? P.esc(P.tramo(k)) : 'Sin fecha'}</span>${svgI(ico)}<b>${P.esc(k.txt)}</b>${d === 0 ? '<i>hoy</i>' : d === 1 ? '<i>mañana</i>' : ''}</button>`; };
    return `<div class="pp-card pp-es" role="dialog" aria-modal="true" aria-label="Esporádico: ${P.esc(e.txt)}" tabindex="-1"><div class="pp-es-cab">${P.avatar(e.id, 'lg')}<div class="pp-es-t"><h2 class="pp-es-nom" data-campo="nom">${P.esc(e.txt)}</h2>${desde ? `<p>Esporádico desde ${desde}</p>` : ''}</div>${P.botonesCard(`<button type="button" class="ibtn pp-cb pp-hj-mas" data-es="mas" aria-label="Más del esporádico" title="Más">${svgI('mas3')}</button>`, false)}</div>`
      + (ns.length ? `<section class="pp-es-sec"><h3>Notas <span>${ns.length}</span></h3><div class="pp-pn">${ns.map(n => `<div class="pp-pt" data-nid="${P.esc(n.id)}" data-pp="tver" data-id="${P.esc(n.id)}" tabindex="0" role="button" aria-label="Nota: ${P.esc(n.txt)}"><div class="pp-ptx">${P.leerTxt(n.txt, { casillas: 'no' })}</div></div>`).join('')}</div></section>` : '')
      + `<section class="pp-es-sec"><h3>Sesiones <span>${ss.length}</span></h3><div class="pp-es-l">${ss.map(ses).join('')}</div><button type="button" class="pp-cmas" data-es="sesion">${svgI('mas')}Sesión</button></section>`
      + `<section class="pp-es-sec"><h3>Tareas <span>${ts.filter(k => !k.hecha).length}</span></h3><div class="pp-es-l">${ts.map(k => `<div class="pp-tk${k.hecha ? ' hecha' : ''}" data-tid="${P.esc(k.id)}"><input type="checkbox" class="pp-ck" data-pp="ck" data-id="${P.esc(k.id)}"${k.hecha ? ' checked' : ''} aria-label="Hecha"><span class="pp-tt" data-pp="tver" data-id="${P.esc(k.id)}" tabindex="0" role="button">${P.esc(k.txt)}</span>${k.fecha ? `<span class="pp-tf">${P.esc(P.diaHora(k.fecha).replace(/ \d{4}$/, ''))}</span>` : ''}</div>`).join('')}</div><button type="button" class="pp-cmas" data-es="tarea">${svgI('mas')}Tarea</button></section>`
      + `<div class="pp-es-pie"><button type="button" class="btn2" data-es="pasar" title="Le crea su cliente en la Mesa (sin meses: los crea Claude) y le pasa sus sesiones, tareas y notas. No se deshace con ⌘Z.">Pasar a mensual</button></div></div>`;
  }
  function fichaPintar(e, o = {}) {
    const ov = P.ov; if (!ov || !e) return;
    const f = JSON.stringify([e, P.CARD.ed, P.vivos().filter(k => P.conCli(k, e.id))]);
    if (!o.forzar && f === F.firma && ov.firstChild) return; F.firma = f;
    ov.innerHTML = fichaHTML(e);
    const c = ov.firstChild;
    if (P.CARD.ed) { const n = c.querySelector('[data-campo="nom"]'); n.setAttribute('contenteditable', 'plaintext-only'); n.setAttribute('role', 'textbox'); n.classList.add('escribiendo'); n.focus(); const rg = document.createRange(); rg.selectNodeContents(n); rg.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); }
    else c.focus({ preventScroll: true });
  }
  const espRec = () => { const C = P.CARD; return C && C.ext === FICHA ? P.TK.get(C.id) : null; };
  function fichaClic(e) {
    const t = e.target, c = P.ov && P.ov.firstChild; if (!c || !c.contains(t)) return false;
    if (P.CARD.pd) { P.CARD.pd = false; return true; }
    if (t.closest('[data-pp="cerrar"]')) return false;   // the ×: personal.js (D-209)
    const e0 = espRec(); if (!e0) return true;
    if (P.CARD.ed && !t.closest('[contenteditable]')) { P.editar(false); return true; }
    if (!P.CARD.ed && e.detail < 2 && t.closest('[data-campo="nom"]') && !P.seleccionando()) { fichaEscribir({ x: e.clientX, y: e.clientY }); return true; }   // its name: a click writes it (D-209)
    const a = t.closest('[data-es]'), k = a && a.dataset.es;
    if (k === 'mas') { const q = a.getBoundingClientRect(); P.abrirMenu(q.left, q.bottom + 4, P.menuEsp(e0.id), a); return true; }
    if (k === 'sesion') { nueva({ ctx: null, campo: 'ficha', desde: e0 }); return true; }
    if (k === 'tarea') { P.cerrarCard(true); P.borrador({ cliente: e0.id }); return true; }
    if (k === 'pasar') { pasar(e0); return true; }
    const v = t.closest('[data-pp="tver"]'); if (v && !t.closest('.pp-ck')) { P.abrirCard(v.dataset.id); return true; }
    return true;
  }
  function fichaDbl(e) { if (!P.CARD.peq && e.target.closest('[data-campo="nom"]') && !P.CARD.ed) fichaEscribir(null); }
  function fichaEscribir(pt) {                 // the name, written in its place (nothing else drawn again), the caret where it was pressed
    const n = P.ov && P.ov.querySelector('.pp-es [data-campo="nom"]'); if (!n) return;
    P.CARD.ed = true; F.firma = JSON.stringify([espRec(), true, P.vivos().filter(k => P.conCli(k, P.CARD.id))]);
    n.setAttribute('contenteditable', 'plaintext-only'); n.setAttribute('role', 'textbox'); n.classList.add('escribiendo'); n.focus({ preventScroll: true });
    let rg = pt && document.caretRangeFromPoint ? document.caretRangeFromPoint(pt.x, pt.y) : null; if (rg && !n.contains(rg.startContainer)) rg = null;
    if (!rg) { rg = document.createRange(); rg.selectNodeContents(n); rg.collapse(false); }
    const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg);
  }
  function fichaTecla(e) {
    if (P.CARD.ed && e.key === 'Enter' && !e.isComposing && e.target.isContentEditable) { e.preventDefault(); e.stopImmediatePropagation(); P.editar(false); return true; }
    if (!P.CARD.ed && e.key === 'Enter' && e.target === P.ov.firstChild) { e.preventDefault(); return true; }
    if (!P.CARD.ed && (e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-pp="tver"]')) { e.preventDefault(); P.abrirCard(e.target.dataset.id); return true; }
    return false;
  }
  function fichaGuardar() {
    const e0 = espRec(), n = P.ov && P.ov.querySelector('[data-campo="nom"][contenteditable]'); if (!e0 || !n) return;
    const v = n.textContent.replace(/\s+/g, ' ').trim(); if (!v || v === e0.txt) return;
    if ([...I().CL.map(c => c.name), ...P.esps().filter(x => x.id !== e0.id).map(x => x.txt)].some(x => String(x).toLowerCase() === v.toLowerCase())) { I().toast('Ya hay un cliente con ese nombre.'); return; }
    P.cambiar(e0.id, x => { x.txt = v; return x; }).then(() => P.pintar());
  }
  // «Pasar a mensual»: asked first (it isn't undone with ⌘Z); the mesa's client is made without months (Claude makes them, D-184),
  // its sessions, tasks and notes go to it, the page stays; the sporadic record stays, marked as passed and hidden, so that an
  // older file imported doesn't bring it back
  function pasar(e0) {
    const X = I();
    X.showDialog('pp-pasar', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Pasar «${P.esc(e0.txt)}» a mensual</h3><p>Se crea su cliente en la Mesa, sin meses: los crea Claude. Sus sesiones, tareas y notas pasan a él. No se deshace con ⌘Z.</p><div class="row"><button type="button" class="btn" data-pp-pasar="1">Pasar a mensual</button></div>`);
    const det = X.root().querySelector('.detail'), b = det.querySelector('[data-pp-pasar]'); b.focus();
    b.addEventListener('click', async () => {
      if (X.CL.some(c => String(c.name).trim().toLowerCase() === String(e0.txt).trim().toLowerCase())) { X.closeDetail(); X.toast(`Ya hay un cliente mensual que se llama «${e0.txt}»: cambia antes el nombre del esporádico.`, { ms: 7000 }); return; }
      b.disabled = true;
      let c; try { c = await M.addClient({ name: e0.txt }); } catch (err) { X.toast('No se pudo: ' + ((err && err.message) || err)); b.disabled = false; return; }
      const now = P.ahoraISO(), cambios = [];
      // a session shared with others: only its part (D-217)
      const pasa = x => { if (x.tipo === 'esporadico' || !P.conCli(x, e0.id)) return false; if (x.tipo === 'sesion') ponerClis(x, P.clis(x).map(id => id === e0.id ? c.id : id)); else x.cliente = c.id; return true; };
      for (const k of P.vivos()) { const n = P.copia(k); if (pasa(n)) { n.at = now; cambios.push({ id: k.id, despues: n }); } }
      const ne = P.copia(P.TK.get(e0.id)); ne.pasado = { cliente: c.id, at: now }; ne.at = now; cambios.push({ id: e0.id, despues: ne });
      await P.escribir(cambios);
      P.remapH(pasa, e0.id);   // its own steps go: it can't come back unpassed
      if (P.st.tcli === e0.id) P.st.tcli = c.id;
      X.closeDetail(); if (P.CARD && P.CARD.id === e0.id) P.cerrarCard(true);
      P.st.cvista = 'mensuales'; await P.refrescar(); P.pintar();
      X.toast(`«${e0.txt}» ya es mensual: sus meses los crea Claude.`);
    });
  }

  // ---------- «Editar la lista» (D-208): one row each thing, «+ Cosa», «Guardar» ----------
  function editarLista() {
    const X = I(), L = matPlantilla();
    const fila = x => `<div class="pp-ml-f" data-id="${P.esc(x.id || '')}"><input type="text" class="pp-ml-n" value="${P.esc(x.nombre || '')}" aria-label="Nombre" maxlength="60"><input type="text" class="pp-ml-fa" value="${P.esc(x.familia || '')}" aria-label="Familia" list="pp-ml-fams" maxlength="40">`
      + `<select class="pp-ml-t" aria-label="Para"><option value="ambas"${x.tipo !== 'foto' && x.tipo !== 'video' ? ' selected' : ''}>Las dos</option><option value="foto"${x.tipo === 'foto' ? ' selected' : ''}>Foto</option><option value="video"${x.tipo === 'video' ? ' selected' : ''}>Vídeo</option></select>`
      + `<select class="pp-ml-p" aria-label="Colgada de"><option value="">Suelta</option>${L.filter(y => y.id !== x.id).map(y => `<option value="${P.esc(y.id)}"${x.padre === y.id ? ' selected' : ''}>${P.esc(y.nombre)}</option>`).join('')}</select>`
      + `<button type="button" class="pp-csx" data-ml="x" title="Quitar" aria-label="Quitar ${P.esc(x.nombre || 'la fila')}">${svgI('x')}</button></div>`;
    X.showDialog('pp-material', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Lista de material</h3><form class="form pp-ml" autocomplete="off"><div class="pp-ml-cab" aria-hidden="true"><span>Cosa</span><span>Familia</span><span>Para</span><span>Colgada de</span><span></span></div><div class="pp-ml-l">${L.map(fila).join('')}</div>`
      + `<datalist id="pp-ml-fams">${[...new Set(L.map(x => x.familia))].map(f => `<option value="${P.esc(f)}">`).join('')}</datalist><button type="button" class="pp-cmas" data-ml="mas">${svgI('mas')}Cosa</button><div class="row"><button type="submit" class="btn">Guardar</button></div></form>`);
    const det = X.root().querySelector('.detail'), f = det.querySelector('form'), l = f.querySelector('.pp-ml-l');
    if (M.controles && M.controles.mejorar) M.controles.mejorar(det);
    f.addEventListener('click', e => {
      const b = e.target.closest('[data-ml]'); if (!b) return;
      if (b.dataset.ml === 'x') { b.closest('.pp-ml-f').remove(); return; }
      if (b.dataset.ml === 'mas') { const d = document.createElement('div'); d.innerHTML = fila({ id: P.nuevoId('ma'), nombre: '', familia: (l.lastElementChild && l.lastElementChild.querySelector('.pp-ml-fa').value) || '', tipo: 'ambas' }); l.append(d.firstChild); if (M.controles && M.controles.mejorar) M.controles.mejorar(l); l.lastElementChild.querySelector('.pp-ml-n').focus(); }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const out = [...l.querySelectorAll('.pp-ml-f')].map(r => ({ id: r.dataset.id || undefined, nombre: r.querySelector('.pp-ml-n').value, familia: r.querySelector('.pp-ml-fa').value, tipo: r.querySelector('.pp-ml-t').value, colgadoDe: r.querySelector('.pp-ml-p').value || undefined })).filter(x => x.nombre.trim());
      await matGuardar(out, true); X.closeDetail(); P.pintar();
    });
    const i = f.querySelector('.pp-ml-n'); if (i) i.focus();
  }

  // ---------- the two kinds of card this file draws (personal.js keeps the card itself) ----------
  const HOJA = {
    cls: 'pp-hoja', pintar: (r, o = {}) => {
      if (S._id !== r.id) { S._id = r.id; S.vista = false; S.tira = false; S.plg.clear(); S.tab = {}; S.enl = null; S.campo = null; }
      if (P.CARD.vc) { S.vista = true; S.tira = false; }   // opened from the board in the vista cliente: fixed in «Ver como el cliente» (D-219)
      if (o.forzar && !P.CARD.ed) S.campo = null;
      const a = !o.forzar && M.controles && M.controles.abierto && M.controles.abierto(); if (a && P.ov && P.ov.contains(a.de)) return;   // a dropdown of the sheet open: it is finishing its gesture
      pintar(r, o);
    },
    clic, dbl, tecla, menu, cambio, escribir, archivos,
    ampliar: () => maquetar(),                 // widened or back (D-210): as many columns of the mood board as fit now
    guardar: fin => guardar(fin),
    cerrar: () => { if (ctlCampo) { ctlCampo.apagar(); ctlCampo = null; } S._id = null; S.firma = ''; mov = null; decodQ = []; soltarFotos(); },
    nueva, volverTexto
  };
  const FICHA = {
    cls: 'pp-ficha', pintar: (e, o) => fichaPintar(e, o), clic: fichaClic, dbl: fichaDbl, tecla: fichaTecla, guardar: () => fichaGuardar(),
    menu: e => { if (e.target.closest('.pp-es-cab')) { e.preventDefault(); const e0 = espRec(); if (e0) P.abrirMenu(e.clientX, e.clientY, P.menuEsp(e0.id)); return true; } return false; },
    cerrar: () => { F.firma = ''; }, nuevo: () => pedirEsp(e2 => { if (e2) { P.st.cvista = 'esporadicos'; P.pintar(); } })
  };

  // ---------- mounting: once personal.js is there ----------
  let listoP = null;
  const listo = () => listoP || (listoP = new Promise(res => { const t = setInterval(() => { if (M.personal && M.personal._p && I() && I().idbAll) { clearInterval(t); res(); } }, 100); }));
  listo().then(() => {
    P = M.personal._p;
    P.EXT.sesion = HOJA; P.EXT.ficha = FICHA;
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
  M.sesiones = {
    version: VERSION, plantilla: () => P.hondo(PLANTILLA),
    _test: { limpiar, reparto: () => reparto(), S: () => ({ ...S, plg: [...S.plg] }), decodificados: () => BM.size,
      crear: async o => { await listo(); const now = P.ahoraISO(), c = PLANTILLA[o.clase] ? o.clase : 'fotovideo', r = { id: P.nuevoId('ss'), tipo: 'sesion', txt: o.txt || nombreDe(c), creada: now, at: now, sesion: { clase: c, visible: o.visible !== false, plantilla: PLANTILLA.v, apartados: PLANTILLA[c].map(apartado) } }; if (o.fecha) r.fecha = o.fecha; if (o.hora) r.hora = o.hora; ponerClis(r, o.clientes || (o.cliente ? [o.cliente] : [])); if (o.fin && r.fecha) r.fin = { ...o.fin }; await P.hacer([{ id: r.id, despues: r }]); return P.copia(r); } },
    _off: () => { OFF.forEach(f => f()); OFF.length = 0; if (P) { delete P.EXT.sesion; delete P.EXT.ficha; } soltarFotos(); }
  };

  // ---------- style: only the mesa's tokens (D-131), its icons and stroke (D-168), its scale and weights (D-172) ----------
  const ESTILO = `
#mesa .pp-ov.pp-hoja,#mesa .pp-ov.pp-ficha{padding:28px 16px}
#mesa .pp-card.pp-hj:focus-visible,#mesa .pp-card.pp-es:focus-visible{outline:none}
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
#mesa .pp-hj svg,#mesa .pp-es svg,#mesa .pp-ns-cab svg,#mesa .pp-ns svg,#mesa .pp-ml svg{stroke-width:var(--i-trazo)}
#mesa .pp-hj svg path,#mesa .pp-hj svg rect,#mesa .pp-hj svg circle,#mesa .pp-es svg path,#mesa .pp-es svg rect,#mesa .pp-es svg circle,#mesa .pp-ns-cab svg path,#mesa .pp-ns-cab svg circle,#mesa .pp-ns svg path,#mesa .pp-ns svg rect,#mesa .pp-ns svg circle,#mesa .pp-ml svg path{vector-effect:non-scaling-stroke}
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
#mesa .pp-hj-clmas.con{padding:0 0 0 8px;background:none;color:var(--acc);transition:background var(--d1) var(--ease)}
#mesa .pp-hj-clmas.con > svg{color:var(--acc)}#mesa .pp-hj-clmas.con:hover{background:var(--acc-soft)}
#mesa .pp-hj-clmas.con .mx-sel{padding:0 10px 0 0;color:var(--acc);font-weight:600}#mesa .pp-hj-clmas.con .mx-sel:not(#mx){border-color:transparent}
#mesa .pp-hj-clmas.con .mx-sel::after,#mesa .pp-hj-clmas.con .mx-z{display:none}
#mesa .pp-ns-cli{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
#mesa .pp-hj-fin{flex:none;max-width:0;overflow:hidden;opacity:0;margin:0 0 0 -2px;padding:0;min-height:26px;border:0;border-radius:var(--r-pill);background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--acc);white-space:nowrap;cursor:pointer;transition:max-width var(--d-m) var(--ease-m),padding var(--d-m) var(--ease-m),opacity var(--d1) var(--ease),background var(--d1) var(--ease)}
#mesa .pp-hj-fh:hover .pp-hj-fin,#mesa .pp-hj-fh:focus-within .pp-hj-fin,#mesa .pp-ns-2 > div:hover .pp-hj-fin,#mesa .pp-ns-2 > div:focus-within .pp-hj-fin{max-width:5em;padding:0 9px;opacity:1}
#mesa .pp-hj-fin:hover{background:var(--acc-soft)}#mesa .pp-hj-fin:active{transform:scale(.97)}#mesa .pp-hj-fin:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
#mesa .pp-hj-gu{flex:none;color:var(--mute);margin:0 -1px}
#mesa .pp-hj-ff{display:inline-flex;min-width:0}
#mesa .pp-hj-ff.mismo .mx-in:not(#mx){width:0;padding:0}#mesa .pp-hj-ff.mismo .mx-in:not(#mx):focus-visible{width:10.2ch;padding:0 2px 0 10px}
#mesa .pp-hj-fh.confin{padding-right:3px}
#mesa .pp-ns-fin{display:flex;align-items:center;gap:6px;min-height:30px;margin-top:6px;min-width:0}#mesa .pp-ns-fin .pp-hj-fin{margin-left:-9px}
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
#mesa .pp-hj-sep:hover::before,#mesa .pp-hj-sep.mov::before{background:var(--line-strong)}#mesa .pp-hj-sep:focus-visible::after{box-shadow:0 0 0 2px var(--focus)}
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
#mesa .pp-hj-oculta{display:flex;align-items:center;gap:8px;margin:40px 29px;font-size:14px;color:var(--mute)}#mesa .pp-hj-oculta svg{width:18px;height:18px}
#mesa .pp-hj-apn{align-self:flex-start;margin-top:-6px}
/* the photos placed: each one whole, at the size it takes */
#mesa .pp-fo{position:relative;flex:none;display:inline-block;overflow:hidden;border-radius:var(--r-xs);background:var(--bg-3)}
#mesa .pp-fo img,#mesa .pp-fo canvas{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:contain}
#mesa .pp-hj .pp-fo{cursor:zoom-in}#mesa .pp-hj .pp-fo[draggable="true"]{cursor:grab}
/* shots: tabs, each one with its references on the right */
/* the tabs as the sections' titles (D-214, 7-A): the title's letter, its count as the sections', the other one in --faint */
#mesa .pp-pl-tabs{display:flex;align-items:center;gap:2px;flex:1;min-width:0;overflow-x:auto;margin-left:-6px}
#mesa .pp-hj-pl:has(.pp-hj-sr){padding-right:0}
#mesa .pp-pl-tab{display:inline-flex;align-items:baseline;gap:6px;border:0;background:none;padding:3px 8px 3px 6px;font:inherit;color:var(--faint);cursor:pointer;white-space:nowrap;border-radius:var(--r-pill);transition:color var(--d1) var(--ease),background var(--d1) var(--ease)}
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
#mesa .pp-pl-ti.vacio{color:var(--faint);font-weight:400}
#mesa .pp-pl-it.hecho .pp-pl-ti{text-decoration:line-through;color:var(--mute)}
#mesa .pp-pl-c .pp-hj-tx{font-size:13px;color:var(--ink-2);margin-top:2px}
#mesa .pp-pl-ref{display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:220px;min-width:110px}
#mesa .pp-pl-fos{display:flex;flex-wrap:wrap;gap:4px}
#mesa .pp-pl-ens{display:flex;flex-direction:column;gap:3px;max-width:100%}
#mesa .pp-pl-en{display:inline-flex;align-items:center;gap:4px;max-width:100%;font-size:12px;color:var(--acc-ink);text-decoration:none}
#mesa .pp-pl-en span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mesa .pp-pl-en:hover span{text-decoration:underline}#mesa .pp-pl-en svg{flex:none;width:12px;height:12px}
#mesa .pp-pl-ein{width:100%;height:26px;border:0;padding:0 8px;font:inherit;font-size:12px;outline:none;color:var(--ink)}
#mesa .pp-pl-sin{font-size:12px;color:var(--faint)}
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
/* a sporadic client's file */
#mesa .pp-card.pp-es{width:min(720px,100%);padding:24px 28px 22px}
#mesa .pp-es-cab{display:flex;align-items:flex-start;gap:14px;margin:0 0 6px}
#mesa .pp-ava.lg{width:44px;height:44px;font-size:16px}
#mesa .pp-es-t{flex:1;min-width:0}#mesa .pp-es-t p{margin:2px 0 0;font-size:12.5px;color:var(--mute)}
#mesa .pp-es-nom{margin:-2px 0 -2px -6px;padding:3px 6px;border-radius:var(--r-sm);font-size:20px;font-weight:800;line-height:1.3;outline:none;overflow-wrap:anywhere}

#mesa .pp-es-sec{margin:20px 0 0 58px}
#mesa .pp-es-sec h3{margin:0 0 8px;font-size:14px;font-weight:600}#mesa .pp-es-sec h3 span{font-weight:400;color:var(--mute);font-size:12.5px}
#mesa .pp-es-l{display:flex;flex-direction:column}
#mesa .pp-es-s{display:grid;grid-template-columns:150px 18px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:38px;padding:4px 6px;margin-left:-6px;border:0;border-bottom:1px solid var(--line2);background:none;font:inherit;font-size:13px;color:var(--ink);text-align:left;cursor:pointer;border-radius:var(--r-xs);transition:background var(--d1) var(--ease)}
#mesa .pp-es-s:hover{background:var(--bg-2)}#mesa .pp-es-s svg{width:16px;height:16px;color:var(--mute)}
#mesa .pp-es-s b{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#mesa .pp-es-s i{font-style:normal;font-size:12px;font-weight:600;color:var(--acc-ink)}
#mesa .pp-es-d{font-size:12.5px;color:var(--mute)}#mesa .pp-es-d.prox{color:var(--ink);font-weight:600}
#mesa .pp-es-pie{display:flex;justify-content:flex-end;margin:22px 0 0;padding:14px 0 0;border-top:1px solid var(--line2)}
@media (max-width:720px){
  #mesa .pp-ov.pp-hoja,#mesa .pp-ov.pp-ficha{padding:16px 10px}#mesa .pp-ov.pp-hoja.amplia{padding:0}
  #mesa .pp-ov.amplia .pp-hj-cab{padding:18px 16px 4px}#mesa .pp-ov.amplia .pp-hj-cols{padding:6px 14px 24px 22px}
  #mesa .pp-hj-cab{padding:18px 16px 4px}#mesa .pp-hj-meta{margin-left:0}#mesa .pp-hj-tira{margin-left:0}
  #mesa .pp-hj-cols{padding:6px 14px 24px 22px}
  #mesa .pp-pl-it{grid-template-columns:28px minmax(0,1fr)}#mesa .pp-pl-ref{grid-column:2;max-width:none;margin-top:8px}
  #mesa .pp-ns-tipos{grid-template-columns:repeat(2,minmax(0,1fr))}#mesa .pp-ns-2{grid-template-columns:minmax(0,1fr)}
  #mesa .pp-es-sec{margin-left:0}#mesa .pp-es-s{grid-template-columns:116px 18px minmax(0,1fr) auto}
  #mesa .pp-ml-cab{display:none}#mesa .pp-ml-f{grid-template-columns:minmax(0,1fr) minmax(0,1fr);padding:8px 0;border-bottom:1px solid var(--line2)}
}
@media (prefers-reduced-motion:reduce){#mesa .pp-hj-cols,#mesa .pp-hj-pl svg,#mesa .pp-hj-fin{transition:none}#mesa .pp-hj-apc{animation:none}#mesa .pp-ma-c:active,#mesa button.pp-hj-chip:active,#mesa .pp-hj-vc:active,#mesa .pp-ns-t:active{transform:none}}
`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).sesiones = 'ok';
})();
