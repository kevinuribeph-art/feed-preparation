// Descargar — Mesa de trabajo · v1.0
// The photos of posts of the open board, to take away without asking Claude (D-083). ⌘+click on a cell of the month
// chooses it or takes it away (Ctrl+click elsewhere), as in the tray (D-077); a click without ⌘ in the feed, Esc or
// another board empty the choice. With something chosen, «Descargar (n)» in the month bar opens one dialog: the chosen
// posts by date, the nearest to today first, each with its pieces in small (a carousel's slides, a Foto's pages, a reel's
// cover), all ticked, to untick what isn't wanted. In the same dialog, «Con textos / Solo la foto» (the piece without its
// texts and logos) and the width: Original (the most its photo gives without enlarging it, up to 36 MP) · 1440 · 1080 px,
// in JPEG. One piece is saved as a JPG; several, in one ZIP «cliente-AAAA-MM» made here, without any library (stored, not
// compressed: a JPEG doesn't shrink). Each file is named «AAAA-MM-DD_post_nn.jpg». One piece at a time, with a bar and
// «Cancelar», so 24 MP photos don't hang the page. Never another client's photos nor the whole mesa: only the posts chosen
// in the open board. Reads the board only through the mesa's bridge (M._in, mesa ≥ 3.67) and draws the editor's slides with
// M.libre.pieza (libre ≥ 1.35). If this file doesn't load, the mesa works as before (⌘+click on a cell opens it).
(function descargarBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.6';   // 1.5: «Con textos / Solo la foto» only with a ticked piece with texts; no «Cancelar» nor help texts (D-155, D-156, D-162)
  if (M.descargar && M.descargar._off) { try { M.descargar._off(); } catch (e) { /* */ } }   // a previous copy on this page
  const { esc, cssq, nOf } = M._in;   // the mesa's own helpers
  const MAX_PX = 36e6;                         // «Original» never goes over 36 MP (a canvas that big still draws everywhere)
  const CANCELADA = 'cancelada';
  const pausa = () => new Promise(r => setTimeout(r, 0));

  // ---------- the choice: posts of the open board, in the order chosen ----------
  let eleg = [], elegKey = null;
  const piezas = s => I().publishList(s).filter(f => M.files[f]);   // what is published of it: slides, pages or a reel's cover
  function vigentes() {                        // the chosen still there, alive and with a photo; another board empties it
    const X = I(), B = X && X.S;
    if (!B) { eleg = []; elegKey = null; return eleg; }
    if (elegKey !== B.key) { eleg = []; elegKey = B.key; }
    eleg = eleg.filter(id => { const s = B.slots.find(x => x.id === id); return s && X.vivo(s) && piezas(s).length; });
    return eleg;
  }
  function marcar() {                          // after every redraw of the grid (renderFeed)
    const X = I(), root = X && X.root && X.root(); if (!root) return;
    const ids = new Set(vigentes());
    root.querySelectorAll('.feed .grid .cell[data-slot]').forEach(c => c.classList.toggle('dlsel', ids.has(c.dataset.slot)));
  }
  function barra() {                           // the month bar's button (renderBar)
    const n = I() ? vigentes().length : 0;
    return n ? `<button type="button" class="mchip dlbtn" data-dl="abrir" title="Descarga las fotos de las publicaciones elegidas con ⌘+clic">Descargar (${n})</button>` : '';
  }
  function redibujar() { const X = I(); marcar(); if (X && X.renderBar) X.renderBar(); }
  function elegir(id) {
    const X = I(), s = X.S && X.S.slots.find(x => x.id === id); if (!s) return;
    vigentes();
    const k = eleg.indexOf(id);
    if (k >= 0) eleg.splice(k, 1);
    else if (!piezas(s).length) { X.toast('Esa publicación no tiene ninguna foto que descargar.'); return; }
    else eleg.push(id);
    redibujar();
  }
  function vaciar() { if (!eleg.length) return; eleg = []; redibujar(); }

  // ---------- the dialog ----------
  const val = (d, n) => { const r = d.querySelector(`input[name="${n}"]:checked`); return r ? r.value : null; };
  const lejania = s => { const t = Date.parse(s.date); return isNaN(t) ? Infinity : Math.abs(t - Date.now()); };
  const limpio = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9.]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  function zipNombre() {
    const X = I(), c = X.CL.find(x => x.id === X.curClient), m = String(X.S.month || '').slice(0, 7);
    return `${(limpio(c ? c.name : X.S.client) || 'cliente').toLowerCase()}-${m}`;
  }
  const nombre = (s, i) => `${I().localDay(s.date) || 'sin-fecha'}_${limpio(s.name) || 'publicacion'}_${String(i + 1).padStart(2, '0')}.jpg`;
  // the piece in small, framed as it is published: a plain photo with the mesa's crop, a drawn one whole
  function mini(s, f) {
    const X = I(), d = M.files[f] || {}, r = d.design || !d.w ? { x: 0, y: 0, w: d.w || 4, h: d.h || 5 } : X.postRect(f, s);
    const st = `width:${(d.w / r.w * 100).toFixed(3)}%;height:${(d.h / r.h * 100).toFixed(3)}%;left:${(-r.x / r.w * 100).toFixed(3)}%;top:${(-r.y / r.h * 100).toFixed(3)}%`;
    return `<span class="dl-im" style="aspect-ratio:${(r.w / r.h).toFixed(4)}"><img src="${d.thumbUrl || ''}" style="${d.w ? st : 'width:100%;height:100%'}" alt=""></span>`;
  }
  function abrir() {
    const X = I(), B = X.S, ids = vigentes(); if (!ids.length || job) return;
    const posts = ids.map(id => B.slots.find(x => x.id === id)).sort((a, b) => lejania(a) - lejania(b) || String(a.date).localeCompare(String(b.date)));
    const lista = posts.map(s => {
      const reel = X.isReel(s.type), pz = piezas(s), tipo = X.tipoPost(s).txt;
      return `<section class="dl-post" data-slot="${esc(s.id)}"><div class="dl-ph"><b>${esc(s.name)}</b><span>${esc(X.fmtDate(s.date))} · ${esc(tipo)}</span>`   // no «· N piezas» / «· su portada»: its thumbnails say it (D-156)
        + (pz.length > 1 ? `<button type="button" class="lnk" data-dl="todas" data-slot="${esc(s.id)}">Ninguna</button>` : '') + '</div><div class="dl-pzs">'
        + pz.map((f, i) => `<label class="dl-pz" title="${esc(nombre(s, i))}"><input type="checkbox" data-slot="${esc(s.id)}" data-f="${esc(f)}" data-i="${i}" checked>${mini(s, f)}<span class="dl-n">${reel ? 'Portada' : String(i + 1).padStart(2, '0')}</span></label>`).join('')
        + '</div></section>';
    }).join('');
    // no «<cliente> · N publicaciones, de la más cercana…»: the client is the tab behind; the order, the list itself (D-156)
    X.showDialog('descargar', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Descargar fotos</h3>`
      // «Con textos / Solo la foto» only when a piece has texts (a design of the editor or of «Diseñar»): otherwise both are the same (D-162)
      + '<div class="dl-ops">' + (posts.some(s => piezas(s).some(f => conTextos(s, f))) ? '<div class="dl-op" role="radiogroup" aria-label="Textos"><label class="dl-ch"><input type="radio" name="dl-txt" value="con" checked><span>Con textos</span></label><label class="dl-ch"><input type="radio" name="dl-txt" value="sin"><span>Solo la foto</span></label></div>' : '')
      + '<div class="dl-op" role="radiogroup" aria-label="Resolución"><label class="dl-ch"><input type="radio" name="dl-res" value="orig" checked><span>Original</span></label><label class="dl-ch"><input type="radio" name="dl-res" value="1440"><span>1440</span></label><label class="dl-ch"><input type="radio" name="dl-res" value="1080"><span>1080</span></label><span class="dl-u">px de ancho · JPEG</span></div></div>'
      + `<div class="dl-list">${lista}</div>`
      + '<div class="dl-prog" hidden><div class="dl-barra"><i></i></div><span class="dl-pt"></span></div><p class="ferr dl-err" hidden></p>'
      + '<div class="form"><div class="row"><span class="left muted dl-res"></span><button type="button" class="btn" data-dl="ir">Descargar</button></div></div>');   // no «Cancelar»: the ×, Esc or a click outside (D-155)
    const d = X.root().querySelector('.detail .card.dlg'); if (d) resumen(d);
  }
  function resumen(d) {                        // how many pieces and where they go, on every change
    const n = d.querySelectorAll('.dl-pz input:checked').length, b = d.querySelector('[data-dl="ir"]'), r = d.querySelector('.dl-res');
    if (b) b.disabled = !n || !!job;
    if (r) r.textContent = !n ? 'Nada marcado' : n === 1 ? '1 pieza · un JPG' : `${n} piezas · ${zipNombre()}.zip`;
    d.querySelectorAll('[data-dl="todas"]').forEach(t => { const any = d.querySelector(`.dl-pz input[data-slot="${cssq(t.dataset.slot)}"]:checked`); t.textContent = any ? 'Ninguna' : 'Todas'; });
    // «Con textos / Solo la foto» only while a ticked piece has texts: unticked, both would give the same (D-162)
    const tx = d.querySelector('.dl-op[aria-label="Textos"]');
    if (tx) { const B = I().S; tx.hidden = ![...d.querySelectorAll('.dl-pz input:checked')].some(i => { const s = B && B.slots.find(x => x.id === i.dataset.slot); return s && conTextos(s, i.dataset.f); }); }
  }

  // ---------- one piece as a JPEG ----------
  const tope = (W, r) => Math.max(1, Math.min(Math.round(W), Math.floor(Math.sqrt(MAX_PX / r))));   // r = height / width
  async function jpeg(c) { const b = await new Promise((res, rej) => c.toBlob(x => x ? res(x) : rej(new Error('no se pudo hacer el JPEG')), 'image/jpeg', 0.92)); c.width = c.height = 0; return b; }
  // a rectangle of a stored photo (in the mesa's measures), w px wide; the very file when nothing changes
  async function recorte(fid, r, ancho) {
    const X = I(), f = M.files[fid], blob = await X.getBlob(fid);
    const W = tope(ancho === 'orig' ? r.w : +ancho, r.h / r.w), H = Math.max(1, Math.round(W * r.h / r.w));
    if (r.x < 1 && r.y < 1 && Math.abs(r.w - f.w) < 1 && Math.abs(r.h - f.h) < 1 && W === f.w && blob.type === 'image/jpeg') return { blob, w: f.w, h: f.h };
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    try {
      const k = bmp.width / f.w, c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = 'high';
      x.drawImage(bmp, r.x * k, r.y * k, r.w * k, r.h * k, 0, 0, W, H);
      return { blob: await jpeg(c), w: W, h: H };
    } finally { bmp.close(); }
  }
  const sinTextos = c => ({ ...c, els: (c.els || []).filter(e => e && e.t !== 'texto' && e.t !== 'logo') });   // «Solo la foto»
  function conTextos(s, fid) {                 // «Solo la foto» would change it: texts or logos of the editor, or a «Diseñar» image
    const comp = I().lComp(s, fid);
    if (comp) return (comp.els || []).some(e => e && (e.t === 'texto' || e.t === 'logo'));
    return !!(M.files[fid] || {}).design;
  }
  const libreLista = () => I().esperar(() => M.libre && M.libre.pieza, 'libre');
  // o: {textos, ancho: 'orig' | '1440' | '1080'} → {blob, w, h}
  async function pieza(s, fid, o) {
    const X = I(), f = M.files[fid]; if (!f) throw new Error('la foto no está en la mesa');
    const comp = X.lComp(s, fid);
    if (comp) {                                 // drawn in the editor: drawn again at the size asked, with or without texts
      if (!await libreLista()) throw new Error('el editor no se ha cargado: recarga la mesa');
      const W0 = f.w || 1440, H0 = f.h || Math.round(W0 * 1.25), c = o.textos ? comp : sinTextos(comp);
      let W = +o.ancho;
      if (o.ancho === 'orig') {                 // the slide's width at which its smallest photo is drawn 1:1
        let px = Infinity;
        for (const e of c.els || []) if (e && !e.oculto && e.t === 'foto' && e.src && M.files[e.src]) { const m = await M.libre.rev.medida(e, W0, H0); if (m && m.px) px = Math.min(px, m.px); }
        W = isFinite(px) ? px : W0;
      }
      W = tope(W, H0 / W0); const H = Math.max(1, Math.round(W * H0 / W0));
      return { blob: await M.libre.pieza(c, W, H), w: W, h: H };
    }
    if (f.design) {                             // drawn by «Diseñar» (diseno.js): as it was drawn; without texts, its photo
      const d = s.design, k = d && d.out ? d.out.indexOf(fid) : -1, src = !o.textos && k >= 0 && d.slides[k] ? d.slides[k].src : null;
      if (src && M.files[src]) { const p = M.files[src]; return recorte(src, X.rectFor(p.w, p.h, f.w / f.h, (X.S.crops || {})[src] || { cx: 0.5, cy: 0.5, z: 1 }), o.ancho); }
      return recorte(fid, { x: 0, y: 0, w: f.w, h: f.h }, o.ancho);
    }
    return recorte(fid, X.postRect(fid, s), o.ancho);   // a photo with the mesa's crop
  }

  // ---------- the ZIP: stored entries, CRC-32, UTF-8 names ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  async function crc32(blob, parar) {          // by 4 MB, letting the page breathe between them
    let c = 0xFFFFFFFF;
    for (let o = 0; o < blob.size; o += 4194304) {
      if (parar && parar()) throw new Error(CANCELADA);
      const u = new Uint8Array(await blob.slice(o, o + 4194304).arrayBuffer());
      for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8);
      await pausa();
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  async function zip(files, parar) {           // files: [{name, blob}] → a Blob
    const enc = new TextEncoder(), loc = [], cen = [], d = new Date();
    const tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), sz = f.blob.size, crc = await crc32(f.blob, parar);
      if (off + 30 + nm.length + sz > 0xFFFFFFFF || files.length > 65535) throw new Error('el ZIP pasaría de 4 GB: elige menos piezas o un ancho menor');
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, tm, 2], [12, dt, 2], [14, crc, 4], [18, sz, 4], [22, sz, 4], [26, nm.length, 2], [28, 0, 2]].forEach(([p, v, n]) => n === 4 ? h.setUint32(p, v, true) : h.setUint16(p, v, true));
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, tm, 2], [14, dt, 2], [16, crc, 4], [20, sz, 4], [24, sz, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([p, v, n]) => n === 4 ? c.setUint32(p, v, true) : c.setUint16(p, v, true));
      loc.push(h.buffer, nm, f.blob); cen.push(c.buffer, nm);
      off += 30 + nm.length + sz;
    }
    const tam = cen.reduce((n, p) => n + p.byteLength, 0), e = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, tam, 4], [16, off, 4], [20, 0, 2]].forEach(([p, v, n]) => n === 4 ? e.setUint32(p, v, true) : e.setUint16(p, v, true));
    return new Blob([...loc, ...cen, e.buffer], { type: 'application/zip' });
  }
  function bajar(blob, name) {                 // a normal download: the browser takes it to Descargas
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; a.hidden = true; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 120000);
  }

  // ---------- the download: one piece at a time ----------
  let job = null;
  async function ir(card) {
    const X = I(), B = X.S; if (job || !B) return;
    const sel = [...card.querySelectorAll('.dl-pz input:checked')].map(i => ({ s: B.slots.find(x => x.id === i.dataset.slot), f: i.dataset.f, i: +i.dataset.i })).filter(x => x.s);
    if (!sel.length) return;
    const tg = card.querySelector('.dl-op[aria-label="Textos"]'), o = { textos: !tg || tg.hidden || val(card, 'dl-txt') !== 'sin', ancho: val(card, 'dl-res') || 'orig' };
    const det = X.root().querySelector('.detail'), mio = job = { card };
    const parar = () => job !== mio || !card.isConnected || det.hidden || det.dataset.dlg !== 'descargar';
    const prog = card.querySelector('.dl-prog'), bar = prog.querySelector('i'), pt = prog.querySelector('.dl-pt'), err = card.querySelector('.dl-err');
    const paso = (k, t) => { bar.style.width = (100 * k / (sel.length + (sel.length > 1 ? 1 : 0))).toFixed(1) + '%'; pt.textContent = t; };
    card.querySelectorAll('input, [data-dl]').forEach(x => { x.disabled = true; });
    prog.hidden = false; err.hidden = true; card.classList.add('dl-run');
    const files = [], usados = new Set();
    try {
      for (let k = 0; k < sel.length; k++) {
        if (parar()) throw new Error(CANCELADA);
        const { s, f, i } = sel[k];
        paso(k, `Pieza ${k + 1} de ${sel.length} · ${s.name}`);
        await pausa();
        const r = await pieza(s, f, o);
        let nm = nombre(s, i); for (let j = 2; usados.has(nm); j++) nm = nombre(s, i).replace(/\.jpg$/, `-${j}.jpg`);
        usados.add(nm); files.push({ name: nm, blob: r.blob, w: r.w, h: r.h, slotId: s.id });
      }
      if (parar()) throw new Error(CANCELADA);
      let blob = files[0].blob, name = files[0].name;
      if (files.length > 1) { paso(sel.length, 'Preparando el ZIP…'); blob = await zip(files, parar); name = zipNombre() + '.zip'; }
      if (parar()) throw new Error(CANCELADA);
      paso(sel.length + (sel.length > 1 ? 1 : 0), 'Listo');
      bajar(blob, name);
      M.descargar.ultimo = { name, bytes: blob.size, piezas: files.map(x => ({ name: x.name, w: x.w, h: x.h, slotId: x.slotId })) };
      X.closeDetail();
      X.toast(`Descargado ${name}: ${nOf(files.length, 'pieza', 'piezas')}, ${(blob.size / 1048576).toFixed(1).replace('.', ',')} MB. Está en Descargas.`, { ms: 7000 });
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg === CANCELADA) { if (det.hidden || det.dataset.dlg !== 'descargar') X.toast('Descarga cancelada: no se ha guardado nada.'); }
      else if (card.isConnected) { err.textContent = 'No se pudo descargar: ' + msg + '.'; err.hidden = false; prog.hidden = true; card.querySelectorAll('input, [data-dl]').forEach(x => { x.disabled = false; }); card.classList.remove('dl-run'); }
      else X.toast('No se pudo descargar: ' + msg + '.');
    } finally { if (job === mio) job = null; if (card.isConnected) resumen(card); }
  }

  // ---------- events (capture: a ⌘+click on a cell never reaches the mesa, which would open it) ----------
  function onClick(e) {
    const X = I(); if (!X || !X.S || !X.root || !e.target || !e.target.closest) return;
    const root = X.root(); if (!root || !root.contains(e.target)) return;
    const b = e.target.closest('[data-dl]');
    if (b) {
      const a = b.dataset.dl, card = b.closest('.card.dlg');
      if (a === 'abrir') abrir();
      else if (a === 'ir' && card) ir(card);
      else if (a === 'todas' && card) { const ins = [...card.querySelectorAll(`.dl-pz input[data-slot="${cssq(b.dataset.slot)}"]`)], on = ins.some(i => i.checked); ins.forEach(i => { i.checked = !on; }); resumen(card); }
      return;
    }
    const cell = e.target.closest('.feed .grid .cell[data-slot]');
    if ((e.metaKey || e.ctrlKey) && cell && !X.locked) { e.preventDefault(); e.stopPropagation(); elegir(cell.dataset.slot); return; }
    if (eleg.length && !e.metaKey && !e.ctrlKey && e.target.closest('.feed')) vaciar();   // a click without ⌘ does what it always did and empties the choice
  }
  function onChange(e) { const card = e.target && e.target.closest && e.target.closest('.detail[data-dlg="descargar"] .card.dlg'); if (card) resumen(card); }
  function onKey(e) {
    if (e.key !== 'Escape' || !eleg.length) return;
    const X = I(), root = X && X.root && X.root(), det = root && root.querySelector('.detail');
    if (!root || (det && !det.hidden) || (M.libre && M.libre.abierto && M.libre.abierto()) || root.querySelector('.cpmenu')) return;   // Esc closes what is open first (a folder's menu too)
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    vaciar();
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  window.addEventListener('keydown', onKey, true);

  // ---------- styles (inside #mesa, with its fonts, radii and greys) ----------
  const CSS = `
#mesa .cell.dlsel::before{content:'';position:absolute;inset:0;z-index:4;pointer-events:none;box-shadow:inset 0 0 0 3px var(--acc),inset 0 0 0 5px var(--on-photo)}
#mesa .mchip.dlbtn{background:var(--acc);border-color:var(--acc);color:var(--on-acc);font-weight:600}#mesa .mchip.dlbtn:hover{background:var(--acc-hover);border-color:var(--acc-hover)}
#mesa .detail[data-dlg="descargar"] .card.dlg{max-width:min(94vw,760px);width:min(94vw,760px)}
#mesa .dl-ops{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin:10px 0 12px}
#mesa .dl-op{display:inline-flex;align-items:center;gap:0;flex-wrap:wrap}#mesa .dl-op[hidden]{display:none}
#mesa .dl-ch{position:relative;display:inline-flex}
#mesa .dl-ch input{position:absolute;opacity:0;pointer-events:none}
#mesa .dl-ch span{font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;min-height:30px;padding:0 13px;border:1px solid var(--line);margin-left:-1px;background:var(--panel-2);color:var(--ink);font-size:12.5px;font-weight:400;cursor:pointer;user-select:none;transition:background var(--d1) ease-out,border-color var(--d1) ease-out}
#mesa .dl-ch span:hover{background:var(--bg)}
#mesa .dl-ch:first-of-type span{border-radius:var(--r-pill) 0 0 var(--r-pill);margin-left:0;padding-left:15px}#mesa .dl-ch:last-of-type span{border-radius:0 var(--r-pill) var(--r-pill) 0;padding-right:15px}
#mesa .dl-ch input:checked+span{background:var(--ink);border-color:var(--ink);color:var(--on-ink);font-weight:600;position:relative;z-index:1}
#mesa .dl-ch input:focus-visible+span{outline:2px solid var(--focus);outline-offset:2px}
#mesa .dl-u{margin-left:8px;font-size:12px;color:var(--mute)}
#mesa .dl-list{max-height:min(52vh,460px);overflow:auto;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2)}
#mesa .dl-post{padding:10px 0;border-top:1px solid var(--line2)}#mesa .dl-post:first-child{border-top:0}
#mesa .dl-ph{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px;font-size:13px}#mesa .dl-ph span{color:var(--mute);font-size:12px}
#mesa .dl-ph .lnk{margin-left:auto;padding:2px 4px}
#mesa .dl-pzs{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 4px}
#mesa .dl-pz{position:relative;flex:none;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
#mesa .dl-pz input{position:absolute;top:5px;left:5px;z-index:2;width:16px;height:16px;margin:0;accent-color:var(--acc)}
#mesa .dl-im{position:relative;display:block;height:92px;overflow:hidden;border-radius:var(--r-xs);background:var(--cell-ph);transition:opacity var(--d1) ease-out}
#mesa .dl-im img{position:absolute;max-width:none}
#mesa .dl-pz input:not(:checked)~.dl-im{opacity:.35}
#mesa .dl-n{font-size:11px;color:var(--mute);font-variant-numeric:tabular-nums}
#mesa .dl-prog{margin:12px 0 0;display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--mute)}
#mesa .dl-barra{height:6px;border-radius:var(--r-pill);background:var(--bg-2);overflow:hidden}#mesa .dl-barra i{display:block;height:100%;width:0;background:var(--acc);transition:width .2s ease}
#mesa .dl-prog[hidden]{display:none}
#mesa .card.dl-run .dl-ch span,#mesa .card.dl-run .dl-pz{cursor:default}#mesa .card.dl-run [data-dl]{opacity:.45}
@media (max-width:560px){#mesa .dl-im{height:72px}#mesa .dl-ops{gap:8px}}`;
  I().estilo('mesa-dl-css', CSS);

  M.descargar = {
    version: VERSION, barra, marcar, elegir, vaciar, abrir, elegidas: () => (I() ? vigentes().slice() : []),
    _pieza: pieza, _zip: zip, _crc32: crc32,    // tests
    _off: () => { document.removeEventListener('click', onClick, true); document.removeEventListener('change', onChange, true); window.removeEventListener('keydown', onKey, true); }
  };
  (window.MESA_CARGA = window.MESA_CARGA || {}).descargar = 'ok';
  if (I() && I().S) redibujar();               // a board already open when this file arrives
})();
