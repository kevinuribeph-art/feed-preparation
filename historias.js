// Historias — Mesa de trabajo · v1.1
// The month's Instagram stories, beside the grid, never in it (D-054). A switch in the board's bar shows, instead of the
// grid, one rail per day: that day's post, if any, and its stories in order, 9:16. From there a story is added, duplicated,
// dragged to another place or day, timed, linked to the post it supports, cancelled, deleted or opened in the free editor
// («Editar historia», libre.js as a reel's cover: one 9:16 page, D-055). The tray beside it is the client's (D-041), and a
// photo dropped on a story opens that story's editor with it.
// A story lives in the board's b.historias, apart from S.slots, so nothing of the feed sees it; mesa.js keeps what can't
// depend on this file: ⌘Z, the files they use, export, a post's stories following it (D-057) and the rule of not showing a
// photo before its post (D-056). Stories are read and changed only through the mesa's bridge (M._in, mesa ≥ 3.53). If this
// file doesn't load, the mesa works as before (no switch) and the stories stay saved.
//   M.hs: barra() the switch · render() · ver(on) · activo() · lista() · estado(h) · anadir(day, {time?, slotId?, note?, fondo?})
//   duplicar(id) · mover(id, day, idx) · setFecha(id, day, time) · enlazar(id, slotId | null) · cancelar(id) · reactivar(id)
//   borrar(id) · setNota(id, text) · editar(id, {foto?}) · soltar(id, fileId) · tras(id)
// The skill diseno-historias works with these (D-059):
//   M.historias(ids?) (one id, a list or none = the open board's) -> [{id, date (UTC), dateMadrid ('YYYY-MM-DD HH:MM'), order (1… in its
//     day; null if cancelled), slotId | null, state ('por diseñar' | 'diseñada' | 'programada' | 'cancelada'), note, files: [fileId],
//     zernioId | null, changed (a programmed one that changed here since), cambios: ['fecha' | 'imagen' | 'cancelada'],
//     problems: [{tipo, bloquea, texto}] (without measuring: the safe zone and the px only in M.revisar({historias: 'solo'}))}]
//   await M.cargarHistorias([{date (with Z or its offset), order (1… in its day), slotId?, note, fondo? (a colour of the kit's
//     backgrounds)}], {replace?}) -> [{id, date, order, result: 'creada' | 'sustituida' | 'ya diseñada' | 'programada'} | {error}], in
//     the order given. The same day and order is the same story: one still to design is rewritten; a designed one only with
//     replace (its image goes), and a programmed one never. Without fondo it finishes at once, before its promise resolves.
//   M.marcarHistoriasProgramadas([{id, zernioId}]) -> [{id, state} | {id, error}]: refuses one with a point that stops it. Again
//     after updating it in Zernio: it stops being changed. zernioId null: it is no longer in Zernio.
// Scheduling: tools/zernio.mjs presign -> M.startZernio([{fileId (of files), slotId (the story's id), url, publicUrl}]), which refuses
// one with a point that stops it -> M.waitZernio -> tools/zernio.mjs schedule, one post per story at its date.
// Designing from outside (D-062, D-063; the photos come with M.importarFotos, D-061):
//   M.plantillasHistoria() -> [{id, nombre, campos}], the open client's: the templates of its kit (kit «historias») on c.libre.plantillas.
//   await M.disenarHistoria(id, {plantilla, foto? (fileId), titular?, etiqueta?, texto?, dato?, serie?: {n, total}}, {replace?}) -> {id, state,
//     problems: [{tipo, bloquea, texto}]}, and error if it was refused and nothing changed: a programmed or cancelled one never,
//     a designed one only with replace, a photo of a later post never (D-056), a field its template doesn't have.
(function historiasBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.3';
  if (M.hs && M.hs._off) { try { M.hs._off(); } catch (e) { /* */ } }   // a previous copy on this page
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssq = v => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&');
  const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const utc = d => { const [y, m, x] = d.split('-').map(Number); return Date.UTC(y, m - 1, x); };
  const dayAt = t => new Date(t).toISOString().slice(0, 10);
  let ON = false, abierta = null;              // the view is on; the story whose dialog is open

  const puede = () => { const X = I(); if (!X || !X.S) return false; if (X.locked) { X.toast('La mesa está abierta en otra pestaña: pulsa «Usar aquí».'); return false; } return true; };
  const lista = () => { const X = I(); return X && X.S ? X.hsDe(X.S) : []; };
  const porId = id => lista().find(h => h.id === id) || null;
  const estado = h => (h.cancelada ? 'cancelada' : h.zernio ? 'programada' : (h.photos || []).length ? 'diseñada' : 'por diseñar');
  const delDia = (day, sin) => { const X = I(); return lista().filter(h => !h.cancelada && h !== sin && X.localDay(h.date) === day).sort((a, b) => X.ts(a.date) - X.ts(b.date)); };
  const hecho = () => { const X = I(); X.hNorm(X.S); X.changed(); };
  // what changed in a programmed story since it was marked: derived, so undoing a change takes it off
  const cambiosDe = h => { const X = I(), z = h.zernio; return !z ? [] : [...(h.cancelada ? ['cancelada'] : []), ...(X.sameDate(h.date, z.date) ? [] : ['fecha']), ...((h.photos || [])[0] === z.file ? [] : ['imagen'])]; };

  // ---------- what can be done with a story ----------
  function anadir(day, o = {}) {
    if (!puede()) return null;
    const X = I(), S = X.S, ultima = delDia(day).pop(), post = S.slots.filter(X.vivo).find(s => X.localDay(s.date) === day && !X.dOnly(s.date));
    let date = o.time ? X.madridISO(day, o.time) : ultima ? X.isoDe(X.ts(ultima.date) + 6e4) : post ? X.isoDe(X.ts(post.date) + 30 * 6e4) : X.madridISO(day, '12:00');   // behind the day's last, or half an hour after its post
    for (const x of delDia(day)) if (Math.abs(X.ts(x.date) - X.ts(date)) < 6e4) date = X.isoDe(X.ts(x.date) + 6e4);   // at the same time as others: behind them, in the order they are added
    const h = { id: 'h-' + X.newId(), type: 'Historia', name: '', date, slotId: null, note: o.note || '', photos: [] };
    if (o.fondo) h.fondo = o.fondo;
    if (o.slotId) { const s = S.slots.find(x => x.id === o.slotId); if (s) { h.slotId = s.id; h.postDate = s.date; } }
    S.historias = [...X.hsDe(S), h];
    hecho();
    return h.id;
  }
  function duplicar(id) {
    const h = porId(id); if (!h || !puede()) return null;
    const X = I(), c = JSON.parse(JSON.stringify(h));
    c.id = 'h-' + X.newId(); c.date = X.isoDe(X.ts(h.date) + 6e4);
    delete c.zernio; delete c.cancelada; delete c.porPost;   // a copy of a programmed or cancelled one starts free
    X.S.historias = [...X.hsDe(X.S), c];
    hecho();
    return c.id;
  }
  // to place idx among that day's stories. Within a day they swap times, so the day's moments stay; to another day it goes
  // beside its neighbours, or keeps its time on an empty day
  function mover(id, day, idx) {
    const h = porId(id); if (!h || h.cancelada || !puede()) return;
    const X = I(), resto = delDia(day, h), i = Math.max(0, Math.min(idx, resto.length));
    if (X.localDay(h.date) === day) {
      const horas = [...resto, h].map(x => x.date).sort((a, b) => X.ts(a) - X.ts(b)), orden = [...resto.slice(0, i), h, ...resto.slice(i)];
      if (orden.every((x, k) => x.date === horas[k])) return;
      orden.forEach((x, k) => { x.date = horas[k]; });
    } else {
      const a = resto[i - 1], b = resto[i];
      h.date = a ? X.isoDe(X.ts(a.date) + 6e4) : b ? X.isoDe(X.ts(b.date) - 6e4) : X.madridISO(day, X.localTime(h.date) || '12:00');
    }
    hecho();
  }
  function setFecha(id, day, time) {
    const h = porId(id); if (!h || !puede()) return;
    const X = I(); if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || !/^\d\d:\d\d$/.test(time || '')) return;
    h.date = X.madridISO(day, time);
    hecho();
  }
  function enlazar(id, slotId) {
    const h = porId(id); if (!h || !puede()) return;
    const X = I(), s = slotId ? X.S.slots.find(x => x.id === slotId) : null;
    if (slotId && !s) return;
    if (s) { h.slotId = s.id; h.postDate = s.date; } else { h.slotId = null; delete h.postDate; }
    if (h.porPost) { delete h.porPost; delete h.cancelada; }   // it was cancelled only by the post it no longer follows
    hecho();
  }
  function cancelar(id) { const h = porId(id); if (!h || h.cancelada || !puede()) return; h.cancelada = true; delete h.porPost; hecho(); }
  function reactivar(id) {
    const h = porId(id); if (!h || !h.cancelada || !puede()) return;
    const X = I(), s = h.slotId && X.S.slots.find(x => x.id === h.slotId);
    if (h.slotId && (!s || !X.vivo(s))) { X.toast('Su publicación está cancelada: reactívala o desenlaza la historia.'); return; }
    delete h.cancelada; delete h.porPost; hecho();
  }
  function borrar(id) {                        // only one not in Zernio; the ⌘Z brings it back
    const h = porId(id); if (!h || h.zernio || !puede()) return;
    const X = I(); X.S.historias = X.hsDe(X.S).filter(x => x !== h);
    if (!X.S.historias.length) delete X.S.historias;
    X.changed();
    X.toast('Historia borrada. ⌘Z la devuelve.');
  }
  function setNota(id, txt) { const h = porId(id); if (!h || !puede() || h.note === txt) return; h.note = txt; I().changed(); }
  async function editar(id, o = {}) {
    const h = porId(id); if (!h) return { error: 'no existe' };
    const X = I();
    if (h.cancelada) { X.toast('Está cancelada: reactívala para editarla.'); return { error: 'cancelada' }; }
    if (!(M.libre && M.libre.abrir)) { X.toast((window.MESA_CARGA || {}).libre === 'fallo' ? 'No se pudo cargar el editor (libre.js): recarga la página.' : 'Cargando el editor…'); return { error: 'sin editor' }; }
    cerrarDlg();
    return M.libre.abrir(id, 0, o);
  }
  const soltar = (id, fileId) => editar(id, { foto: fileId });
  const tras = () => { ver(true); };           // back from the editor: the view, as it is now

  // ---------- what the skill uses ----------
  function historias(ids) {
    const X = I(); if (!X || !X.S) return [];
    const solo = ids == null ? null : new Set([].concat(ids));
    return lista().filter(h => !solo || solo.has(h.id)).map(h => {
      const c = cambiosDe(h), dia = X.localDay(h.date);
      return { id: h.id, date: h.date, dateMadrid: `${dia} ${X.localTime(h.date)}`, order: h.cancelada ? null : delDia(dia).indexOf(h) + 1, slotId: h.slotId || null, state: estado(h), note: h.note || '', files: (h.photos || []).slice(), zernioId: h.zernio ? h.zernio.id : null, changed: c.length > 0, cambios: c, problems: X.hProblemas(h) };
    });
  }
  async function cargarHistorias(items, opts = {}) {
    let X = I(); if (!X || !X.S) return { error: 'no hay mesa abierta' };
    if (X.locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    const S = X.S, list = [].concat(items ?? []);
    let fondos = null;
    if (list.some(it => it && it.fondo)) {
      for (let i = 0; i < 50 && !(M.libre && M.libre.fondosKit) && (window.MESA_CARGA || {}).libre !== 'fallo'; i++) await new Promise(r => setTimeout(r, 100));
      fondos = M.libre && M.libre.fondosKit ? await M.libre.fondosKit(S.client) : null;
      X = I(); if (!X || X.S !== S) return { error: 'la mesa cambió mientras se cargaban: vuelve a intentarlo' };
    }
    const res = list.map(() => null), dias = new Map();
    list.forEach((it, i) => {
      const t = it && !X.dOnly(it.date) ? X.ts(it.date) : 0, day = t ? X.localDay(it.date) : null, s = it && it.slotId ? S.slots.find(x => x.id === it.slotId) : null;
      const fondo = it && it.fondo ? String(it.fondo).toLowerCase() : null;
      const mal = !it ? 'historia vacía' : !t ? 'fecha no válida: tiene que llevar hora y Z o su diferencia' : it.slotId && !s ? 'esa publicación no está en este tablero' : !s && !X.inBoard(day) ? 'fuera de la mesa' : fondo && !/^#[0-9a-f]{6}$/.test(fondo) ? 'fondo no válido' : fondo && fondos && !fondos.includes(fondo) ? 'ese fondo no es del kit del cliente' : '';
      if (mal) { res[i] = { error: mal, ...(it && it.date ? { date: it.date } : {}) }; return; }
      if (!dias.has(day)) dias.set(day, []);
      dias.get(day).push({ it, i, t, s, fondo });
    });
    const quedan = new Map(), hechas = [];
    for (const [day, a] of dias) {
      const antes = delDia(day);                 // the day as it was: the same order is the same story
      a.sort((x, y) => (+x.it.order || 1e9) - (+y.it.order || 1e9) || x.t - y.t);
      let ult = -Infinity;
      for (const { it, i, t, s, fondo } of a) {
        const e = +it.order > 0 ? antes[+it.order - 1] : null;
        if (e && e.zernio) { res[i] = { id: e.id, result: 'programada' }; quedan.set(i, e); continue; }
        if (e && (e.photos || []).length && !opts.replace) { res[i] = { id: e.id, result: 'ya diseñada' }; quedan.set(i, e); continue; }
        const h = e || { id: 'h-' + X.newId(), type: 'Historia', name: '', photos: [] };
        if (e) { h.photos = []; delete h.libre; delete h.guias; delete h.fondo; }
        const v = Math.max(t, ult + 6e4); ult = v;   // the same time: one behind another, in their order
        h.date = X.isoDe(v); h.note = String(it.note ?? ''); h.slotId = s ? s.id : null;
        if (s) h.postDate = s.date; else delete h.postDate;
        if (fondo) h.fondo = fondo;
        if (!e) S.historias = [...X.hsDe(S), h];
        res[i] = { id: h.id, result: e ? 'sustituida' : 'creada' }; quedan.set(i, h); hechas.push(h);
      }
    }
    if (hechas.length) hecho();
    quedan.forEach((h, i) => { res[i].date = h.date; res[i].order = h.cancelada ? null : delDia(X.localDay(h.date)).indexOf(h) + 1; });
    return res;
  }
  function marcarHistoriasProgramadas(list) {
    const X = I(); if (!X || !X.S) return { error: 'no hay mesa abierta' };
    if (X.locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    let n = 0;
    const out = [].concat(list ?? []).map(it => {
      const id = it && it.id, h = porId(id); if (!h) return { id, error: 'no existe' };
      if (it.zernioId == null || it.zernioId === '') { if (h.zernio) { delete h.zernio; n++; } return { id, state: estado(h) }; }
      if (h.cancelada) return { id, error: 'está cancelada' };
      const b = X.hProblemas(h).find(p => p.bloquea); if (b) return { id, error: b.texto };
      h.zernio = { id: String(it.zernioId), date: h.date, file: h.photos[0] }; n++;
      return { id, state: estado(h) };
    });
    if (n) X.changed();
    return out;
  }

  // ---------- story templates of the client's kit, and designing a story from outside (D-062, D-063) ----------
  const HW = 1440, HH = 2560, AS = HW / HH;    // as «Aplicar» draws a story; AS turns a fraction of the width into one of the height
  const r4 = v => Math.round(v * 1e4) / 1e4, low = c => String(c).toLowerCase(), pad2 = n => String(n).padStart(2, '0');
  const elBase = { rot: 0, op: 1, lock: false, sh: 0 };
  const MUESTRA = { titular: 'Titular de la historia', etiqueta: 'Etiqueta', texto: 'Texto de la historia.', dato: '85 %' };
  const camposDe = p => [...(p.foto ? ['foto'] : []), ...(p.bloque || []).map(b => b.campo), ...(p.fila ? ['serie'] : [])];
  const cargaLibre = async () => { for (let i = 0; i < 50 && !(M.libre && M.libre.hist && M.libre.rev && M.diseno) && (window.MESA_CARGA || {}).libre !== 'fallo'; i++) await new Promise(r => setTimeout(r, 100)); return !!(M.libre && M.libre.hist && M.libre.rev); };

  // t = the kit's «historias» with its fonts resolved and one template in t.p; d = the fields. {comp, avisos}
  async function componer(t, d, logo) {
    const { altoDe } = M.libre.hist, { medida } = M.libre.rev, p = t.p, avisos = [], eid = () => 'e' + I().newId();
    const alto = el => altoDe(el, HW, HH);
    const texto = (st, txt, color, x, w, o = {}) => ({ id: eid(), t: 'texto', txt, x, y: 0, w, h: 0.1, ...elBase, font: { ...st.font }, peso: st.font.w, size: st.size, color: low(color), al: 'izq', lh: st.lh || 1.2, ls: st.ls || 0, may: !!st.may, ...o });
    const forma = (forma, x, y, w, h, color, o = {}) => ({ id: eid(), t: 'forma', forma, x: r4(x), y: r4(y), w: r4(w), h: r4(h), ...elBase, color: low(color), r: 0, b: 0, bc: '#000000', ...o });
    const centrar = async (el, yc) => {        // by its ink, not its box
      await alto(el); el.y = r4(yc - el.h / 2);
      const b = await medida(el, HW, HH); if (b) el.y = r4(el.y + (yc * HH - (b.y0 + b.y1) / 2) / HH);
    };
    const c = { bg: low(p.bg || '#ffffff'), velo: p.velo ? { tipo: 'grad', color: low(p.velo.color), op: p.velo.op, dir: 'abajo', alc: p.velo.alc } : null, els: [] };
    let tope = 0;
    if (p.foto) {
      const [x, y, w, h] = p.foto;
      c.els.push({ id: eid(), t: 'foto', src: d.foto || null, x, y, w, h, cx: 0.5, cy: 0.5, z: 1, ...elBase, fx: false, fy: false, b: 0, bc: '#ffffff', r: 0 });
      if (y + h < 1) tope = y + h;
    }
    if (p.cabecera) {
      const k = t.cabecera, o = p.cabecera, m = t.margen, lado = k.lado * AS, yc = k.y + lado / 2;
      if (logo) c.els.push({ id: eid(), t: 'logo', src: logo.id, x: m, y: r4(yc - k.lado * AS * (logo.h / logo.w) / 2), w: k.lado, h: r4(k.lado * AS * (logo.h / logo.w)), ...elBase, fx: false, fy: false });
      else {
        const g = 'g' + I().newId();
        c.els.push(forma('rect', m, k.y, k.lado, lado, o.cuadrado, { g }));
        const u = texto({ font: k.font, size: k.letra_size, lh: 1 }, k.letra, o.letra, m, k.lado, { al: 'cen', g });
        await centrar(u, yc); c.els.push(u);
      }
      const ma = texto({ font: k.font, size: k.marca_size, lh: 1, ls: k.marca_ls }, k.marca, o.marca, k.marca_x, 0.5);
      await centrar(ma, yc); c.els.push(ma);
      tope = Math.max(tope, k.y + lado);
    }
    const blq = [];
    for (const b of p.bloque || []) {
      const txt = String(d[b.campo] ?? '').trim(); if (!txt) continue;
      const st = t.estilos[b.estilo || b.campo], w = st.w || t.ancho, el = texto(st, txt, b.color, t.margen, w);
      const n = await alto(el);
      if (b.si_no_cabe && n > b.max_lineas) { const s2 = t.estilos[b.si_no_cabe]; Object.assign(el, { size: s2.size, lh: s2.lh, ls: s2.ls || 0, font: { ...s2.font }, peso: s2.font.w }); await alto(el); }   // too many lines: the smaller headline
      if (b.max_palabras) { const nw = txt.split(/\s+/).length; if (nw > b.max_palabras) avisos.push({ tipo: 'no cabe', bloquea: false, texto: `el texto lleva ${nw} palabras: unas ${b.max_palabras} como máximo` }); }
      blq.push({ el, sep: (b.sep ?? t.separacion) * AS });
    }
    let y = p.base || 0;                         // anchored by its foot, as a text only grows downwards in the editor
    for (let i = blq.length - 1; i >= 0; i--) { y -= blq[i].el.h; blq[i].el.y = r4(y); if (i) y -= blq[i].sep; }
    blq.forEach(b => c.els.push(b.el));
    if (blq.length && tope && y < tope) avisos.push({ tipo: 'no cabe', bloquea: false, texto: 'el texto no cabe: se monta sobre lo que tiene encima' });
    if (p.fila && d.serie) {
      const f = t.fila, st = t.estilos.etiqueta, { n, total } = d.serie;
      const num = texto(st, `${pad2(n)} / ${pad2(total)}`, p.fila.numero, t.margen, 0.4);
      await centrar(num, f.y); c.els.push(num);
      if (n < total) {
        const g = 'g' + I().newId(), lado = f.diametro * AS, h = 4 * f.flecha_trazo * AS;   // an arrow's box is 4 strokes high (TRAZO in libre.js)
        c.els.push(forma('elipse', f.borde - f.diametro, f.y - lado / 2, f.diametro, lado, f.circulo, { g }));
        c.els.push(forma('flecha', f.borde - f.diametro / 2 - f.flecha_w / 2, f.y - h / 2, f.flecha_w, h, f.flecha, { g, puntas: 'der' }));
      } else {
        const fin = texto(st, f.final, f.final_color, r4(f.borde - 0.5 + (st.ls || 0) * st.size), 0.5, { al: 'der' });   // the spacing after its last letter stays out of the edge
        await centrar(fin, f.y); c.els.push(fin);
      }
    }
    return { comp: c, avisos };
  }

  // The kit's templates onto the client's own (c.libre.plantillas), once: one Kevin deletes doesn't come back (c.libre.historiasKit).
  // libreAt stays: this isn't a change that should win over another Mac's newer templates in an import (D-042).
  const SIN_KIT = new Set(), SEMBRANDO = new Map();
  const logoPorNombre = async (c, nombre) => {
    const X = I(), want = low(nombre);
    for (const id of (c.libre && c.libre.logos) || []) { const r = await X.idbGet('files', id).catch(() => null); if (r && low(r.name) === want && r.w) return { id, w: r.w, h: r.h }; }
    return null;
  };
  async function plantillaDe(H, kit, p, c) {
    const fnt = k => { const f = kit.fuentes[k]; return { n: f.familia, file: f.archivo, w: f.peso }; };
    const estilos = {}; for (const [k, e] of Object.entries(H.estilos)) estilos[k] = { ...e, font: fnt(e.fuente) };
    const def = { margen: H.margen, ancho: H.ancho, separacion: H.separacion, cabecera: { ...H.cabecera, font: fnt(H.cabecera.fuente) }, estilos, fila: H.fila, p };
    const logo = p.cabecera && p.cabecera.logo ? await logoPorNombre(c, p.cabecera.logo) : null;
    const { comp } = await componer(def, p.fila && p.fila.siempre ? { ...MUESTRA, serie: { n: 1, total: 3 } } : MUESTRA, logo);
    return { id: 'historia-' + p.id, nombre: p.nombre, comp, fmt: '9:16', rat: r4(AS), at: new Date().toISOString(), historia: { v: H.v, campos: camposDe(p), def, logo: !!logo } };
  }
  async function sembrar(cid) {
    if (!cid || !await cargaLibre()) return;
    const X = I(); if (!X || X.locked) return;
    let kit = null; try { kit = await M.diseno.kit(cid); } catch (e) { /* no kit */ }
    const H = kit && kit.historias;
    if (!H || !Array.isArray(H.plantillas)) { SIN_KIT.add(cid); return; }
    SIN_KIT.delete(cid);
    const c = await X.idbGet('clients', cid); if (!c) return;
    const nuevas = new Map();
    if ((c.libre || {}).historiasKit !== H.v) for (const p of H.plantillas) nuevas.set('historia-' + p.id, await plantillaDe(H, kit, p, c));
    else for (const t of c.libre.plantillas || []) if (t.historia && !t.historia.logo && t.historia.def.p.cabecera && t.historia.def.p.cabecera.logo && await logoPorNombre(c, t.historia.def.p.cabecera.logo)) nuevas.set(t.id, await plantillaDe(H, kit, t.historia.def.p, c));   // its logo has arrived
    if (!nuevas.size || I().locked) return;
    const c2 = await X.idbGet('clients', cid); if (!c2) return;   // what changed meanwhile stays
    const lib = c2.libre || {}, ps = lib.plantillas || [];
    c2.libre = { ...lib, historiasKit: H.v, plantillas: [...ps.map(t => nuevas.get(t.id) || t), ...[...nuevas.values()].filter(t => !ps.some(q => q.id === t.id))] };
    await X.idbPut('clients', cid, c2); await X.loadClients();
  }
  const asegurar = cid => {                    // one at a time per client
    if (!SEMBRANDO.has(cid)) SEMBRANDO.set(cid, sembrar(cid).finally(() => SEMBRANDO.delete(cid)));
    return SEMBRANDO.get(cid);
  };
  // the templates a story can be designed from: right after a client's first opening they may take a moment to be there
  function plantillasHistoria() {
    const X = I(); if (!X || !X.S) return [];
    const c = (X.CL || []).find(x => x.id === X.S.client), ps = (c && c.libre && c.libre.plantillas) || [];
    return ps.filter(t => t.historia).map(t => ({ id: t.id, nombre: t.nombre, campos: t.historia.campos.slice() }));
  }
  const CAMPOS = ['foto', 'titular', 'etiqueta', 'texto', 'dato', 'serie'];
  async function disenar(id, d, o) {
    let X = I(); if (!X || !X.S) return { id, error: 'no hay mesa abierta' };
    const S = X.S, h = porId(id); if (!h) return { id, error: 'esa historia no está en este tablero' };
    const no = error => ({ id, state: estado(h), problems: X.hProblemas(h), error });
    if (X.locked) return no('locked: la mesa está abierta en otra pestaña; no se ha guardado nada');
    if (h.zernio) return no('está programada: no se toca');
    if (h.cancelada) return no('está cancelada');
    if ((h.photos || []).length && !o.replace) return no('ya está diseñada: usa replace para sustituirla');
    if (!await cargaLibre()) return no('no se pudo cargar el editor (libre.js)');
    await asegurar(S.client).catch(() => {});
    X = I(); if (X.S !== S) return no('la mesa cambió: vuelve a intentarlo');
    const c = (X.CL || []).find(x => x.id === S.client), t = ((c && c.libre && c.libre.plantillas) || []).find(q => q.id === d.plantilla && q.historia);
    if (!t) return no(`no existe la plantilla «${d.plantilla}» en este cliente`);
    const campos = t.historia.campos, def = t.historia.def, p = def.p, lleva = k => d[k] != null && d[k] !== '';
    const sobran = CAMPOS.filter(k => lleva(k) && !campos.includes(k));
    if (sobran.length) return no(`«${t.nombre}» no lleva ${sobran.join(', ')}: lleva ${campos.join(', ')}`);
    if (!campos.some(lleva)) return no('sin nada que poner en la plantilla');
    if (lleva('serie')) { const { n, total } = d.serie; if (!Number.isInteger(n) || !Number.isInteger(total) || n < 1 || n > total) return no('serie no válida: {n, total}, con n de 1 a total'); }
    else if (p.fila && p.fila.siempre) return no(`«${t.nombre}» necesita serie: {n, total}`);
    if (lleva('foto')) {
      await X.loadThumbs([d.foto]);
      const f = M.files[d.foto]; if (!f || f.design || String(d.foto).startsWith('kit-')) return no('esa foto no está en la mesa');
      const u = await X.usoHistoria(f.name, f.size, h); if (u) return no(u.txt);   // D-056: no one to ask here, so it doesn't go in
    }
    const logo = p.cabecera && p.cabecera.logo ? await logoPorNombre(c, p.cabecera.logo) : null;
    const { comp, avisos } = await componer(def, d, logo);
    const r = await M.libre.hist.pintar(id, comp); if (r.error) return no(r.error);
    const foto = comp.els.find(e => e.t === 'foto' && e.src), m = foto && await M.libre.rev.medida(foto, HW, HH);
    if (m && m.px < HW && Math.round(m.px) >= 1080) avisos.push({ tipo: 'resolución', bloquea: false, texto: `la foto se amplía: equivale a ${Math.round(m.px)} px de ancho y la historia sale a ${HW}` });   // under 1080, «Revisar» says it
    const rv = M.revisar ? (await M.revisar({ historias: 'solo' })).puntos.filter(q => q.historiaId === id).map(q => ({ tipo: q.tipo, bloquea: q.bloquea, texto: q.texto })) : I().hProblemas(h);
    return { id, state: estado(h), problems: [...rv, ...avisos] };
  }
  let colaD = Promise.resolve();
  const disenarHistoria = (id, datos, opts) => { const pr = colaD.then(() => disenar(id, datos || {}, opts || {})); colaD = pr.catch(() => {}); return pr; };

  // ---------- the view ----------
  const barra = () => { const n = lista().filter(h => !h.cancelada).length; return `<div class="hvsw" role="group" aria-label="Qué se ve"><button type="button" data-hv="ver" data-v="0" aria-pressed="${!ON}"${ON ? '' : ' class="on"'}>Feed</button><button type="button" data-hv="ver" data-v="1" aria-pressed="${ON}"${ON ? ' class="on"' : ''}>Historias${n ? ` <i>${n}</i>` : ''}</button></div>`; };
  function ver(on) { ON = !!on; const X = I(); if (!X) return; render(); X.renderBar(); }
  function dias() {                            // the board's days, and any a story has moved beyond them (with its post)
    const X = I(), ms = X.boardMonths(), cd = X.curCd(), lo = X.cycleStart(ms[0], cd), hi = X.cycleEnd(ms[ms.length - 1], cd), out = new Set();
    for (let t = utc(lo); t <= utc(hi); t += 864e5) out.add(dayAt(t));
    lista().forEach(h => out.add(X.localDay(h.date)));
    return [...out].sort();
  }
  const diaTxt = d => { const X = I(), [, m, x] = d.split('-'); return `<b>${+x}</b> ${X.MONTHS[+m - 1].slice(0, 3)}<span>${DOW[new Date(utc(d)).getUTCDay()]}</span>`; };
  function postHTML(s) {
    const X = I(), f = M.files[(s.photos || [])[0]];
    return `<div class="hv-post" title="${esc(s.name)}">${f && f.thumbUrl ? `<img src="${f.thumbUrl}" alt="" draggable="false">` : '<div class="hv-nof"></div>'}<span>${esc(X.localTime(s.date) || 'sin hora')}</span></div>`;
  }
  function cardHTML(h) {
    const X = I(), e = estado(h), f = M.files[(h.photos || [])[0]], s = h.slotId && X.S.slots.find(x => x.id === h.slotId), mal = X.adelantos(h).length;
    return `<div class="hv-card e-${e.replace(' ', '-')}${mal ? ' mal' : ''}" data-h="${esc(h.id)}" role="button" tabindex="0" title="${esc(h.name)}${s ? ` · apoya a ${esc(s.name)}` : ''}${mal ? ' · enseña una foto antes de su post' : ''}">`
      + `<div class="hv-img">${f && f.thumbUrl ? `<img src="${f.thumbUrl}" alt="" draggable="false">` : `<p>${esc(h.note || 'Sin diseñar')}</p>`}</div>`
      + `<div class="hv-pie"><b>${esc(X.localTime(h.date))}</b>${s ? '<span class="hv-lk" aria-label="Enlazada">↪</span>' : ''}</div><div class="hv-est">${e}${cambiosDe(h).length ? ' · cambió' : ''}</div></div>`;
  }
  function render() {
    const X = I(); if (!X || !X.shellReady()) return;
    if (X.S && X.S.client && !SIN_KIT.has(X.S.client) && !((X.CL || []).find(c => c.id === X.S.client) || { libre: {} }).libre?.historiasKit) asegurar(X.S.client).catch(() => {});   // the kit's story templates, once (D-062)
    const root = X.root(), box = root.querySelector('.main > section.hv');   // the panel, not the cells' .dot.hv (D-035)
    root.classList.toggle('hv-on', ON && !!X.S);
    if (!box) return;
    box.hidden = !(ON && X.S);
    if (box.hidden) { if (abierta) cerrarDlg(); return; }
    const top = box.scrollTop, S = X.S, ds = dias(), vivas = lista().filter(h => !h.cancelada).length;
    const canc = lista().filter(h => h.cancelada), hoy = X.hoy();
    box.innerHTML = `<p class="hv-res">${vivas ? `${vivas} ${vivas === 1 ? 'historia' : 'historias'} en este mes` : 'Aún no hay historias en este mes: pulsa + en un día.'}</p>`
      + ds.map(d => {
        const posts = S.slots.filter(s => X.vivo(s) && X.localDay(s.date) === d), hs = delDia(d);
        return `<div class="hv-rail${d === hoy ? ' hoy' : ''}${posts.length || hs.length ? '' : ' vacio'}" data-day="${d}"><div class="hv-dia">${diaTxt(d)}</div><div class="hv-posts">${posts.map(postHTML).join('')}</div>`
          + `<div class="hv-cards">${hs.map(cardHTML).join('')}<button type="button" class="hv-add" data-hv="add" data-day="${d}" title="Añadir una historia a este día" aria-label="Añadir una historia al ${+d.slice(8)}">+</button></div></div>`;
      }).join('')
      + (canc.length ? `<div class="hv-rail hv-canc"><div class="hv-dia">Canceladas</div><div class="hv-posts"></div><div class="hv-cards">${canc.map(cardHTML).join('')}</div></div>` : '');
    box.scrollTop = top;
    if (abierta) { const h = porId(abierta), d = root.querySelector('.detail'); if (h && d && !d.hidden && d.dataset.dlg === 'historia') d.querySelector('.card').innerHTML = dlgHTML(h); else if (!h) cerrarDlg(); }
  }
  // ---------- one story's dialog ----------
  function dlgHTML(h) {
    const X = I(), e = estado(h), f = M.files[(h.photos || [])[0]], posts = X.S.slots.filter(X.vivo), mal = X.adelantos(h);
    return `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${esc(h.name)}</h3>`
      + `<div class="hv-dlg"><div class="hv-img hv-big">${f && f.thumbUrl ? `<img src="${f.thumbUrl}" alt="">` : '<p>Sin diseñar</p>'}</div><div class="form hv-form">`
      + (mal.length ? `<p class="hv-mal">${mal.map(a => `Enseña una foto antes de que salga en el feed: ${esc(a.post)}, ${esc(X.hFecha(a.date))}.`).join('<br>')}</p>` : '')
      + `<p class="hv-e">Estado: ${e}${h.porPost ? ', porque su publicación lo está' : ''}${cambiosDe(h).length ? `. Cambió aquí después de programarla (${cambiosDe(h).join(', ')}): falta actualizar Zernio` : ''}</p>`
      + `<label>Día y hora (Madrid)<span class="hv-fh"><input type="date" data-hv-c="dia" value="${X.localDay(h.date)}"${h.cancelada ? ' disabled' : ''}><input type="time" data-hv-c="hora" value="${esc(X.localTime(h.date))}"${h.cancelada ? ' disabled' : ''}></span></label>`
      + `<label>Publicación que apoya<select data-hv-c="post"><option value="">Ninguna</option>${posts.map(s => `<option value="${esc(s.id)}"${s.id === h.slotId ? ' selected' : ''}>${esc(s.name)} · ${esc(X.hFecha(s.date))}</option>`).join('')}</select></label>`
      + `<label>Nota<textarea data-hv-c="nota" rows="4" placeholder="El guion de esta historia">${esc(h.note || '')}</textarea></label>`
      + `<div class="row"><button type="button" class="btn" data-hv="editar"${h.cancelada ? ' disabled' : ''}>Editar historia</button><button type="button" class="btn2" data-hv="duplicar">Duplicar</button>`
      + (h.cancelada ? '<button type="button" class="btn2" data-hv="reactivar">Reactivar</button>' : '<button type="button" class="btn2" data-hv="cancelar">Cancelar</button>')
      + (h.zernio ? '' : '<button type="button" class="btn2" data-hv="borrar">Borrar</button>') + '</div></div></div>';
  }
  function abrirDlg(id) { const h = porId(id), X = I(); if (!h || !X) return; abierta = id; X.showDialog('historia', dlgHTML(h)); }
  function cerrarDlg() { const X = I(); abierta = null; const d = X && X.root() && X.root().querySelector('.detail'); if (d && !d.hidden && d.dataset.dlg === 'historia') X.closeDetail(); }

  // ---------- clicks, fields and dragging a story ----------
  function onClick(e) {
    const X = I(); if (!X || !X.root() || !X.root().contains(e.target)) return;
    if (noClick) { noClick = false; return; }
    const b = e.target.closest('[data-hv]');
    if (b) {
      const a = b.dataset.hv, id = abierta;
      if (a === 'ver') ver(b.dataset.v === '1');
      else if (a === 'ir') { ver(true); abrirDlg(b.dataset.id); }   // a point of «Revisar»
      else if (a === 'add') { const nid = anadir(b.dataset.day); if (nid) abrirDlg(nid); }
      else if (a === 'editar') editar(id);
      else if (a === 'duplicar') { const nid = duplicar(id); if (nid) abrirDlg(nid); }
      else if (a === 'cancelar') cancelar(id);
      else if (a === 'reactivar') reactivar(id);
      else if (a === 'borrar') { borrar(id); cerrarDlg(); }
      return;
    }
    const c = e.target.closest('.hv-card[data-h]');
    if (c) { const f = X.pick(); if (f) { X.pickOff(); soltar(c.dataset.h, f); } else abrirDlg(c.dataset.h); }   // a photo picked in the tray, then the story
  }
  function onChange(e) {
    const t = e.target, c = t.dataset && t.dataset.hvC; if (!c || !abierta) return;
    const h = porId(abierta); if (!h) return;
    const X = I(), box = t.closest('.hv-form');
    if (c === 'nota') setNota(abierta, t.value);
    else if (c === 'post') enlazar(abierta, t.value || null);
    else setFecha(abierta, box.querySelector('[data-hv-c="dia"]').value || X.localDay(h.date), box.querySelector('[data-hv-c="hora"]').value || X.localTime(h.date));
  }
  function onKey(e) { const c = e.target.closest && e.target.closest('.hv-card[data-h]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirDlg(c.dataset.h); } }
  let mv = null, noClick = false;
  function onDown(e) {
    if (e.button || !(e.target.closest)) return;
    const c = e.target.closest('#mesa .main > section.hv .hv-card[data-h]'); if (!c || c.closest('.hv-canc')) return;
    mv = { id: c.dataset.h, el: c, x: e.clientX, y: e.clientY, pid: e.pointerId, on: false };
  }
  // where the pointer would put it: {day, idx}, and the mark
  function destino(x, y) {
    const t = document.elementFromPoint(x, y), rail = t && t.closest && t.closest('#mesa .main > section.hv .hv-rail[data-day]'); if (!rail) return null;
    const cards = [...rail.querySelectorAll('.hv-card[data-h]')].filter(c => c !== mv.el);
    let idx = cards.length;
    for (let i = 0; i < cards.length; i++) { const r = cards[i].getBoundingClientRect(); if (y < r.bottom && x < r.left + r.width / 2) { idx = i; break; } }
    return { day: rail.dataset.day, idx, rail, antes: cards[idx] || rail.querySelector('.hv-add') };
  }
  function limpiaMarca() { document.querySelectorAll('#mesa .hv-mark').forEach(n => n.classList.remove('hv-mark')); }
  function onMove(e) {
    if (!mv || e.pointerId !== mv.pid) return;
    if (!mv.on) {
      if (Math.hypot(e.clientX - mv.x, e.clientY - mv.y) < 6) return;
      mv.on = true;
      const r = mv.el.getBoundingClientRect(), g = mv.el.cloneNode(true);
      g.classList.add('hv-ghost'); g.style.width = r.width + 'px'; g.removeAttribute('data-h');
      mv.ghost = g; I().root().append(g); mv.el.classList.add('hv-src');
    }
    mv.ghost.style.transform = `translate(${e.clientX + 6}px,${e.clientY + 6}px)`;
    limpiaMarca();
    const d = destino(e.clientX, e.clientY); if (d && d.antes) d.antes.classList.add('hv-mark');
  }
  function fin(e, soltado) {
    if (!mv || (e && e.pointerId !== mv.pid)) return;
    const m = mv, d = soltado && m.on ? destino(e.clientX, e.clientY) : null;
    mv = null;
    if (m.ghost) m.ghost.remove();
    m.el.classList.remove('hv-src'); limpiaMarca();
    if (m.on) { noClick = true; setTimeout(() => { noClick = false; }, 0); }
    if (d) mover(m.id, d.day, d.idx);
  }
  const onUp = e => fin(e, true), onCancel = e => fin(e, false);

  const CSS = `#mesa.hv-on:not(.client) .feed{display:none}#mesa.client .main > section.hv,#mesa.client .hvsw{display:none}
#mesa .main > section.hv{flex:1 1 0;min-width:0;overflow-y:auto;background:var(--bg);border-right:1px solid var(--line);padding:10px 14px 24px;box-sizing:border-box}
#mesa.hv-on:not(.client) .side{flex:0 0 min(420px,38vw)}#mesa.hv-on .tcount{white-space:nowrap}
#mesa .hvsw{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;flex:none}
#mesa .hvsw button{border:0;background:none;color:var(--mute);font:inherit;font-size:12.5px;padding:4px 11px;cursor:pointer}#mesa .hvsw button.on{background:var(--ink);color:#fff}
#mesa .hvsw i{font-style:normal;font-weight:600;margin-left:2px}
#mesa .hv-res{margin:2px 0 10px;color:var(--mute);font-size:13px}
#mesa .hv-rail{display:grid;grid-template-columns:62px auto 1fr;gap:10px;padding:10px 0;border-top:1px solid var(--line2);align-items:start}
#mesa .hv-rail.vacio{padding:4px 0;align-items:center}#mesa .hv-rail.hoy .hv-dia b{color:var(--acc)}
#mesa .hv-dia{font-size:12px;color:var(--mute);line-height:1.25}#mesa .hv-dia b{font-size:17px;color:var(--ink)}#mesa .hv-dia span{display:block}
#mesa .hv-rail.vacio .hv-dia span{display:none}
#mesa .hv-posts{display:flex;gap:6px}#mesa .hv-post{width:60px;font-size:11.5px;color:var(--mute);text-align:center}
#mesa .hv-post img,#mesa .hv-nof{display:block;width:60px;height:75px;object-fit:cover;border-radius:4px;background:var(--line2);margin-bottom:3px}
#mesa .hv-cards{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;min-width:0}
#mesa .hv-card{width:88px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:6px;outline-offset:2px}
#mesa .hv-img{aspect-ratio:9/16;border-radius:6px;overflow:hidden;background:var(--line2);border:1px solid var(--line);box-sizing:border-box}
#mesa .hv-img img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}
#mesa .hv-img p{margin:0;padding:6px;font-size:10.5px;line-height:1.3;color:var(--mute);height:100%;overflow:hidden;box-sizing:border-box;overflow-wrap:anywhere}
#mesa .hv-pie{display:flex;justify-content:space-between;font-size:12px;margin-top:3px}#mesa .hv-lk{color:var(--acc)}
#mesa .hv-est{font-size:11px;color:var(--mute)}#mesa .hv-card.e-programada .hv-est{color:var(--ok)}
#mesa .hv-card.mal .hv-img{border:2px solid var(--red)}#mesa .hv-card.mal .hv-est{color:var(--red)}
#mesa .hv-card.e-cancelada{opacity:.55}#mesa .hv-src{opacity:.35}
#mesa .hv-ghost{position:fixed;left:0;top:0;z-index:40;pointer-events:none;opacity:.9;box-shadow:0 6px 18px rgba(0,0,0,.25)}
#mesa .hv-mark{box-shadow:-5px 0 0 -2px var(--acc)}
#mesa .hv-add{width:34px;height:34px;border:1px dashed var(--line);border-radius:50%;background:none;color:var(--mute);font:inherit;font-size:17px;line-height:1;cursor:pointer;align-self:center}
#mesa .hv-add:hover,#mesa .hv-add:focus-visible{border-color:var(--ink);color:var(--ink);outline:0}
#mesa .hv-rail.vacio .hv-add{width:26px;height:26px;font-size:14px}
#mesa .hv-dlg{display:grid;grid-template-columns:150px 1fr;gap:14px;margin-top:8px}#mesa .hv-big{width:150px}
#mesa .hv-form label{display:block;font-size:12.5px;color:var(--mute);margin:0 0 9px}
#mesa .hv-form input,#mesa .hv-form select,#mesa .hv-form textarea{display:block;width:100%;box-sizing:border-box;margin-top:3px;font:inherit;font-size:13px;color:var(--ink);padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--panel)}
#mesa .hv-fh{display:flex;gap:6px}#mesa .hv-fh input{flex:1;min-width:0}
#mesa .hv-e{margin:0 0 9px;font-size:13px}#mesa .hv-mal{margin:0 0 9px;font-size:13px;color:var(--red)}
#mesa .hv-form .row{display:flex;flex-wrap:wrap;gap:6px}
@media (max-width:720px){#mesa.hv-on:not(.client) .side{flex:none}#mesa .main > section.hv{flex:1;border-right:0;border-bottom:1px solid var(--line)}#mesa .hv-dlg{grid-template-columns:1fr}#mesa .hv-big{width:110px}}`;
  let style = document.getElementById('mesa-hv-css');
  if (!style) { style = document.createElement('style'); style.id = 'mesa-hv-css'; document.head.append(style); }   // in the head: the mesa's shell empties the body
  style.textContent = CSS;

  const EV = [['click', onClick, false], ['change', onChange, false], ['keydown', onKey, false], ['pointerdown', onDown, true], ['pointermove', onMove, true], ['pointerup', onUp, true], ['pointercancel', onCancel, true]];
  EV.forEach(([t, f, c]) => document.addEventListener(t, f, c));
  M.historias = historias; M.cargarHistorias = cargarHistorias; M.marcarHistoriasProgramadas = marcarHistoriasProgramadas;
  M.plantillasHistoria = plantillasHistoria; M.disenarHistoria = disenarHistoria;
  M.hs = {
    version: VERSION, barra, render, ver, activo: () => ON, lista, estado, anadir, duplicar, mover, setFecha, enlazar, cancelar, reactivar, borrar, setNota, editar, soltar, tras, asegurar,
    _off: () => { EV.forEach(([t, f, c]) => document.removeEventListener(t, f, c)); if (mv) { if (mv.ghost) mv.ghost.remove(); mv = null; } }
  };
  if (I() && I().shellReady && I().shellReady()) { render(); I().renderBar(); }   // the mesa may have drawn its board before this file arrived
})();
