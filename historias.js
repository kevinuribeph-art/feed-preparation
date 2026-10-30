// Historias — Mesa de trabajo · v1.0
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
(function historiasBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.0';
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
      + `<div class="hv-pie"><b>${esc(X.localTime(h.date))}</b>${s ? '<span class="hv-lk" aria-label="Enlazada">↪</span>' : ''}</div><div class="hv-est">${e}</div></div>`;
  }
  function render() {
    const X = I(); if (!X || !X.shellReady()) return;
    const root = X.root(), box = root.querySelector('.hv');
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
      + `<p class="hv-e">Estado: ${e}${h.porPost ? ', porque su publicación lo está' : ''}</p>`
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
    const c = e.target.closest('#mesa .hv .hv-card[data-h]'); if (!c || c.closest('.hv-canc')) return;
    mv = { id: c.dataset.h, el: c, x: e.clientX, y: e.clientY, pid: e.pointerId, on: false };
  }
  // where the pointer would put it: {day, idx}, and the mark
  function destino(x, y) {
    const t = document.elementFromPoint(x, y), rail = t && t.closest && t.closest('#mesa .hv .hv-rail[data-day]'); if (!rail) return null;
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

  const CSS = `#mesa.hv-on:not(.client) .feed{display:none}#mesa.client .hv,#mesa.client .hvsw{display:none}
#mesa .hv{flex:1 1 0;min-width:0;overflow-y:auto;background:var(--bg);border-right:1px solid var(--line);padding:10px 14px 24px;box-sizing:border-box}
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
@media (max-width:720px){#mesa.hv-on:not(.client) .side{flex:none}#mesa .hv{flex:1;border-right:0;border-bottom:1px solid var(--line)}#mesa .hv-dlg{grid-template-columns:1fr}#mesa .hv-big{width:110px}}`;
  let style = document.getElementById('mesa-hv-css');
  if (!style) { style = document.createElement('style'); style.id = 'mesa-hv-css'; document.head.append(style); }   // in the head: the mesa's shell empties the body
  style.textContent = CSS;

  const EV = [['click', onClick, false], ['change', onChange, false], ['keydown', onKey, false], ['pointerdown', onDown, true], ['pointermove', onMove, true], ['pointerup', onUp, true], ['pointercancel', onCancel, true]];
  EV.forEach(([t, f, c]) => document.addEventListener(t, f, c));
  M.hs = {
    version: VERSION, barra, render, ver, activo: () => ON, lista, estado, anadir, duplicar, mover, setFecha, enlazar, cancelar, reactivar, borrar, setNota, editar, soltar, tras,
    _off: () => { EV.forEach(([t, f, c]) => document.removeEventListener(t, f, c)); if (mv) { if (mv.ghost) mv.ghost.remove(); mv = null; } }
  };
  if (I() && I().shellReady && I().shellReady()) { render(); I().renderBar(); }   // the mesa may have drawn its board before this file arrived
})();
