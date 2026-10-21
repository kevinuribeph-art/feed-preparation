// Diseñador de carruseles y portadas de reel — Mesa de trabajo · v1.0
// Turns a carousel's (or a reel's) photos and the texts approved in the chat into the finished images, with the
// client's design kit (kits/<cliente>.json, drawn by kits/motor.js → window.DisenoMotor).
// The design lives on the slot and is saved with the board (and shared with linked copies of the publication):
//   s.design = {v:1, kit:'<clientId>', fmt:'v45'|'v34'|'h'|'r916', serie, slides:[{tipo, titulo, texto, entradilla,
//               contacto, src:fileId|null, ov:{lugar, alinear, dx, dy, escala, color, velo}}], out:[fileIds]|null,
//               sig (signature of what was applied), at, outAt}
// «Aplicar a la casilla» renders every slide at full size and puts the images in the slot (files flagged design:true:
// uploaded to Notion exactly as rendered); the original photos then live only in slides[].src. A 'final' slide always
// uses the client's fixed final photo (kit override final.foto = protected file 'kit-<clientId>-final').
// Claude drives it through M.diseno (cargar / estado / abrir / aplicar / ver / kit / ajustarKit / fijarFinal);
// Kevin through the editor that «Diseñar» opens in the post view. Uses the mesa's bridge M._in (mesa.js ≥ 3.18).
(function disenoBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const ENG = () => window.DisenoMotor;
  const VERSION = '1.1';
  const FMTS = { v45: '4:5', v34: '3:4', h: 'Horizontal' };
  const TIPOS_CAR = ['portada', 'ficha', 'final'];
  const TIPO_LABEL = { portada: 'Portada', ficha: 'Ficha', final: 'Final', reel: 'Portada de reel' };
  const ESC_MIN = 0.6, ESC_MAX = 1.6, ESC_STEP = 0.05;
  const MAX_SLIDES = 20;                       // Instagram's limit for a carousel
  const MAX_MSG = 'Un carrusel admite como máximo 20 diapositivas (límite de Instagram).';
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const str = v => v == null ? '' : String(v);
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const pad2 = n => String(n).padStart(2, '0');
  const nowISO = () => new Date().toISOString();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- errors: every public call returns a plain object; {error:'…'} in Spanish ----------
  class DzError extends Error { constructor(m, slide) { super(m); if (slide != null) this.slide = slide; } }   // slide: index of the slide at fault
  const need = (ok, msg, slide) => { if (!ok) throw new DzError(msg, slide); };
  const LOCKED = 'La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de diseñar.';
  const NO_ENGINE = 'El motor de diseño no está cargado (kits/motor.js): recarga la página.';
  const NO_DESIGN = 'Esta publicación aún no tiene diseño: carga los textos con cargar() o ábrela con «Diseñar».';
  const NO_FINAL = 'Falta la foto final del cliente: elígela en «Diseñar» («Usar otra foto como final del cliente»).';
  const api = fn => async (...a) => {
    try { return await fn(...a); }
    catch (e) { if (e instanceof DzError) return e.slide != null ? { error: e.message, diapositiva: e.slide + 1 } : { error: e.message }; console.warn('diseño:', e); return { error: 'Error del diseñador: ' + String((e && e.message) || e) }; }
  };

  // ---------- slot helpers ----------
  function board() { need(I(), 'La mesa no tiene el puente del diseñador: actualiza mesa.js (3.18 o posterior).'); const S = I().S; need(S, 'No hay ninguna mesa abierta.'); return S; }
  function slotOf(id) {
    const S = board(), s = S.slots.find(x => x.id === id);
    need(s, 'No existe esa publicación en la mesa abierta.');
    need(I().isCarousel(s.type) || I().isReel(s.type), 'Solo se diseñan carruseles y reels.');
    return s;
  }
  const isReelS = s => I().isReel(s.type);
  const outsOf = s => (s.design && s.design.out) || [];
  const isOut = (s, f) => outsOf(s).includes(f) || !!(M.files[f] && M.files[f].design);
  const rawPhotos = s => s.photos.filter(f => !isOut(s, f));                       // photos Kevin placed (not rendered ones)
  const srcsOf = s => s.design ? s.design.slides.map(x => x.src).filter(Boolean) : [];
  const isApplied = s => { const o = outsOf(s); return !!o.length && I().same(s.photos, o); };
  const nameOf = f => (M.files[f] || {}).name || f;
  const blankSlide = (tipo, src) => ({ tipo, titulo: '', texto: '', entradilla: '', contacto: null, src: src || null, ov: {} });
  const remember = s => { s.design.known = rawPhotos(s); };   // the post's photos the design has seen (newer ones are absorbed on open)
  // photos dropped from a design go back to the tray when nothing else uses them (never lose a photo)
  function rescue(ids) {
    const S = I().S, refs = I().refsOf(S);
    const back = [...new Set(ids)].filter(f => f && !refs.has(f) && !String(f).startsWith('kit-') && !(M.files[f] && M.files[f].design));
    if (back.length) { S.tray.unshift(...back); I().renderTray(); }
    return back;
  }
  // photos no slide uses any more leave the post (when Kevin had put them there) and go back to the tray
  function release(s, ids) {
    const used = new Set(srcsOf(s)), gone = [...new Set(ids)].filter(f => f && !used.has(f) && s.photos.includes(f) && !isOut(s, f));
    if (gone.length) s.photos = s.photos.filter(f => !gone.includes(f));
    return { gone, back: rescue(ids) };
  }
  // one format per carousel: the design's (rendered images keep the one they were made with until applied again)
  const syncFmt = s => { if (s.design && I().isCarousel(s.type) && FMTS[s.design.fmt] && !s.photos.some(f => isOut(s, f))) s.fmt = s.design.fmt; };

  // the post's type changed in Notion (called by the mesa while it loads the board, before it is open): a carousel design
  // becomes a reel cover with the cover's title, a reel design a carousel cover with the reel's title; the post gets its
  // source photos back and the rendered images are left for deletion. Pending «Aplicar». The design it had is kept
  // whole in design.stash (its photos stay referenced, out of the tray) and comes back when the type does.
  const kindOf = d => d && Array.isArray(d.slides) && d.slides.length ? (d.slides[0].tipo === 'reel' ? 'r' : 'c') : null;
  function retipo(s, to) {
    const d = s.design; if (!kindOf(d)) return null;
    const dk = kindOf(d), tk = I().isReel(to) ? 'r' : I().isCarousel(to) ? 'c' : 'f';
    if (dk === tk) return null;
    const outs = (d.out || []).filter(Boolean), srcs = d.slides.filter(x => x.tipo !== 'final').map(x => x.src).filter(Boolean);
    const extra = (s.photos || []).filter(f => !outs.includes(f) && !srcs.includes(f) && !(M.files[f] && M.files[f].design));
    const at = nowISO(), all = [...new Set([...srcs, ...extra])];
    if (tk === 'f') { s.photos = all; s.design = { ...d, out: null, sig: null, at }; return { tray: [], dead: outs }; }   // dormant, whole
    const { stash, ...cur } = d, keep = JSON.parse(JSON.stringify({ ...cur, out: null, sig: null }));
    const back = kindOf(stash) === tk ? JSON.parse(JSON.stringify(stash)) : null;
    let nd, photos, tray = [];
    if (tk === 'r') {
      const cover = d.slides.find(x => x.tipo === 'portada') || d.slides.find(x => x.tipo !== 'final') || d.slides[0], src = cover.src || all[0] || null;
      nd = back || { v: 1, kit: d.kit, fmt: 'r916', serie: '', slides: [blankSlide('reel', src)] };
      const old = nd.slides[0].src; nd.slides[0].titulo = str(cover.titulo); if (src) nd.slides[0].src = src;
      if (old && old !== nd.slides[0].src && !srcs.includes(old)) tray.push(old);
      photos = nd.slides[0].src ? [nd.slides[0].src] : [];
      tray.push(...extra.filter(f => f !== nd.slides[0].src));      // the carousel's own photos stay with the kept design
    } else {
      const r0 = d.slides[0], src = r0.src || all[0] || null;
      nd = back || { v: 1, kit: d.kit, fmt: 'v45', serie: '', slides: [blankSlide('portada', src)] };
      const cov = nd.slides.find(x => x.tipo === 'portada') || nd.slides.find(x => x.tipo !== 'final') || nd.slides[0], old = cov.src;
      cov.titulo = str(r0.titulo); if (src) cov.src = src;
      const used = nd.slides.filter(x => x.tipo !== 'final').map(x => x.src).filter(Boolean);
      if (old && !used.includes(old)) tray.push(old);
      photos = [...new Set([...used, ...all])];
      s.fmt = FMTS[nd.fmt] ? nd.fmt : 'v45';
    }
    s.design = { ...nd, kit: nd.kit || d.kit, out: null, sig: null, at, known: photos.slice(), stash: keep };
    s.photos = photos;
    return { tray: [...new Set(tray)].filter(f => !photos.includes(f)), dead: outs };
  }
  // «Sustituir» on a designed carousel: the photo of the cover slide (the one the post shows) changes; never a new slide
  function sustituir(s, fid) {
    const d = s.design, first = s.photos[0];
    const sl = d.slides.find(x => x.tipo !== 'final' && x.src === first) || d.slides.find(x => x.tipo !== 'final');
    if (!sl) { if (!s.photos.includes(fid)) s.photos.push(fid); return; }
    const prev = sl.src; sl.src = fid;
    if (first && !isOut(s, first)) s.photos[0] = fid; else if (!first) s.photos.push(fid);   // not applied yet: the post shows the new photo
    s.photos = [...new Set(s.photos)];
    d.at = nowISO();
    release(s, [prev]); remember(s);
  }

  // ---------- kit: kits/<clientId>.json + the client's override (client record field `kit`) ----------
  const BASE = {};                             // clientId -> Promise<{kit} | {missing} | {bad: where}>
  const kitUrl = cid => new URL('kits/' + encodeURIComponent(cid) + '.json', location.href).href;
  const BASEV = {};                            // clientId -> base kit once read (null = none or broken), for the synchronous checks
  function jsonWhere(e, t) {                   // «línea 61, columna 5» from the parser's message
    const m = String((e && e.message) || ''), lc = m.match(/line (\d+) column (\d+)/i), pos = m.match(/position (\d+)/i);
    if (lc) return `línea ${lc[1]}, columna ${lc[2]}`;
    if (pos) { const before = t.slice(0, +pos[1]).split('\n'); return `línea ${before.length}, columna ${before[before.length - 1].length + 1}`; }
    return 'no es un JSON válido';
  }
  // fresh: read the file again (cache 'reload': a kit edited or restored on disk counts without reloading the page, whatever its date)
  async function baseKit(cid, fresh) {
    if (fresh || !BASE[cid]) BASE[cid] = fetch(kitUrl(cid), { cache: 'reload' }).then(async r => {
      if (!r.ok) return { missing: true };
      const t = await r.text();
      try { return { kit: JSON.parse(t) }; } catch (e) { return { bad: jsonWhere(e, t) }; }
    }).catch(() => ({ missing: true }));
    const k = await BASE[cid];
    if (!k.kit) delete BASE[cid];
    BASEV[cid] = k.kit || null;
    need(!k.bad, `El kit kits/${cid}.json tiene un error de formato (${k.bad}).`);
    return k.kit || null;
  }
  // objects merge key by key; arrays and values replace; null removes the key (back to the kit's value)
  function deepMerge(base, patch) {
    const out = isObj(base) ? { ...base } : {};
    for (const [k, v] of Object.entries(patch || {})) {
      if (v === null) delete out[k];
      else if (isObj(v)) out[k] = deepMerge(isObj(out[k]) ? out[k] : {}, v);
      else out[k] = clone(v);
    }
    return out;
  }
  async function rawKit(cid, fresh) {
    const base = await baseKit(cid, fresh);
    need(base, `Este cliente aún no tiene kit de diseño (kits/${cid}.json).`);
    const c = await I().idbGet('clients', cid);
    const ov = (c && c.kit) || {};
    return { raw: deepMerge(base, ov), ov, base, c };
  }
  const ENGK = {};                             // clientId -> {key, kit: Promise} (fonts loaded once per kit)
  // the engine loads on its own (async script): wait for it a little before saying it isn't there
  async function motor() {
    if ((window.MESA_CARGA || {}).motor !== 'fallo' && I() && I().toast) I().toast('Cargando el motor de diseño…');
    for (let i = 0; i < 150 && !(ENG() && ENG().usarKit) && (window.MESA_CARGA || {}).motor !== 'fallo'; i++) await new Promise(r => setTimeout(r, 100));
    return ENG();
  }
  async function engineKit(cid, fresh) {
    const E0 = ENG() && ENG().usarKit ? ENG() : await motor(); need(E0 && E0.usarKit && E0.dibujar, NO_ENGINE);
    const r = await rawKit(cid, fresh), key = JSON.stringify(r.raw);
    if (!ENGK[cid] || ENGK[cid].key !== key) ENGK[cid] = { key, kit: E0.usarKit(clone(r.raw), new URL('kits/', location.href).href) };
    try { return { kit: await ENGK[cid].kit, raw: r.raw, ov: r.ov }; }
    catch (e) { delete ENGK[cid]; throw new DzError('No se pudo preparar el kit de diseño: ' + String((e && e.message) || e)); }
  }
  const finalIdOf = raw => { const f = raw && raw.final && raw.final.foto; return typeof f === 'string' && f ? f : null; };
  async function finalReady(raw) {             // the client's final photo, loaded in the mesa (null = none)
    const id = finalIdOf(raw); if (!id) return null;
    await I().loadThumbs([id]);
    return M.files[id] ? id : null;
  }
  const effSrc = (sl, fin) => sl.tipo === 'final' ? fin : sl.src;
  // what the applied images depend on, in two parts: the post's own (texts, adjustments, photos and their reframe, format,
  // name) and the kit's (only what the engine reads for these slides). A change after applying = «cambios sin aplicar».
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  function sigOf(s, raw) {
    const d = s.design, crops = I().S.crops || {}, k = raw || {}, fin = finalIdOf(k), fz = k.final || {};
    const tipos = [...new Set(d.slides.map(x => x.tipo))];
    const own = [d.fmt, str(d.serie), d.slides.map(sl => { const src = effSrc(sl, fin); return [sl.tipo, str(sl.titulo), str(sl.texto), str(sl.entradilla), sl.contacto ?? null, sl.ov || {}, src || null, src ? crops[src] || null : null]; })];
    const piezas = Object.fromEntries(tipos.map(t => [t, (k.piezas || {})[t] || null]));
    const cols = new Set(['blanco', 'carbon', ...tipos.map(t => piezas[t] && piezas[t].color), ...d.slides.map(x => x.ov && x.ov.color)].filter(Boolean));
    const kitPart = [k.fuentes, k.escala, k.lienzo, k.formatos, k.velo, k.variacion, piezas, k.marca, k.cliente, [...cols].sort().map(c => [c, (k.colores || {})[c] || null]),
      d.slides.some(x => x.tipo === 'final' && x.contacto == null) ? fz.contacto ?? null : null, tipos.includes('final') ? [fin, fz.fotoAt || null] : null];
    return hash(JSON.stringify(own)) + '.' + hash(JSON.stringify(kitPart));
  }
  // synchronous state for the mesa (post view, upload plan): 'ok' = applied and up to date, 'chg' = not, null = no design.
  // Until the client's kit file has been read once, only the post's own part is compared.
  function rawSync(cid) {
    const c = ((I() && I().CL) || []).find(x => x.id === cid), ov = (c && c.kit) || {};
    if (BASEV[cid] === undefined && !BASE[cid]) baseKit(cid).catch(() => {});
    return BASEV[cid] ? { raw: deepMerge(BASEV[cid], ov), partial: false } : { raw: deepMerge({}, ov), partial: true };
  }
  // the base kits of the board's designs, read again before M.init resolves: plan() right after a load must already
  // know whether a design is out of date (its kit changed since it was applied). Boards without designs: nothing.
  async function prepararKits(S) {
    const ids = [...new Set(((S && S.slots) || []).filter(s => s.design).map(s => s.design.kit || S.client))];
    if (!ids.length) return;
    await Promise.race([Promise.all(ids.map(cid => baseKit(cid, true).catch(() => {}))), new Promise(r => setTimeout(r, 5000))]);
  }
  function estadoDe(s) {
    if (!s || !s.design || !I()) return null;
    if (!isApplied(s)) return 'chg';
    const r = rawSync(s.design.kit), a = String(s.design.sig || ''), b = sigOf(s, r.raw);
    return (r.partial ? a.split('.')[0] === b.split('.')[0] : a === b) ? 'ok' : 'chg';
  }
  // canvas size of every slide of a design: the first photo decides a horizontal one (an Instagram carousel has one ratio)
  function sizeOf(kit, d, fin) {
    const first = d.slides.map(sl => effSrc(sl, fin)).find(f => f && M.files[f]);
    const f = first ? M.files[first] : { w: 1080, h: 1350 };
    return { ...ENG().tamano(kit, d.fmt, f.w, f.h), sw: f.w, sh: f.h };
  }
  const rectOf = (src, W, H) => { const f = M.files[src]; return I().rectFor(f.w, f.h, W / H, I().baseCrop(src, I().S)); };   // the mesa's reframe of that photo
  const slideFor = sl => ({ tipo: sl.tipo, titulo: str(sl.titulo), texto: str(sl.texto), entradilla: str(sl.entradilla), contacto: sl.contacto == null ? null : String(sl.contacto), ov: clone(sl.ov || {}) });   // contacto null = the kit's
  const pageOf = (s, i) => isReelS(s) ? null : i + 1;
  const AV = {};                               // 'slotId:i' -> {key, avisos, decision}: valid only for the inputs it was drawn from
  function avKey(s, i, rawHash, sz, fin) {
    const d = s.design, sl = d.slides[i], src = effSrc(sl, fin), crops = I().S.crops || {}, f = src && M.files[src];
    return hash(JSON.stringify([d.fmt, str(d.serie), slideFor(sl), src || null, src ? crops[src] || null : null, f ? [f.w, f.h] : null, pageOf(s, i), rawHash, sz ? [sz.W, sz.H] : null]));
  }
  const avGet = (s, i, key) => { const c = AV[s.id + ':' + i]; return c && c.key === key ? c : null; };
  const kitHash = raw => hash(JSON.stringify(raw || {}));
  // A manual offset (ov.dx/dy) is stored in px of the canvas it was set on (ov.h = that canvas' height) and never
  // rewritten by a format change: each drawing scales it to the current canvas and keeps the block on it (whole and
  // within the kit's margin on another canvas; at least 25 % on its own). Back to the first format = exactly where it was.
  const EXT_H = { v45: 1350, v34: 1440, h: 608, r916: 1920 };   // offsets saved before ov.h existed: the format's usual height
  function stampOffsets(d, H) { d.slides.forEach(sl => { if (sl.ov && (sl.ov.dx || sl.ov.dy) && !sl.ov.h && H) sl.ov.h = H; }); }
  function ovAt(ov0, sz) {
    const ov = clone(ov0 || {}); delete ov.h;
    if (ov0 && ov0.h && ov0.h !== sz.H && ov.dy) ov.dy = Math.round(ov.dy * sz.H / ov0.h);
    return ov;
  }
  const slideAt = (sl, sz) => ({ ...slideFor(sl), ov: ovAt(sl.ov, sz) });
  function clampOv(sl, ov, res, sz) {
    const b = res && res.bloque; if (!b || (!ov.dx && !ov.dy)) return null;
    const fit = !!(sl.ov && sl.ov.h && sl.ov.h !== sz.H), m0 = Math.round(72 * (sz.factor || 1));
    const box = (v, pos, size, max) => {
      if (!fit || size > max) return lim(v, pos, size, max);
      const m = size + 2 * m0 <= max ? m0 : (max - size) / 2;
      return Math.max(m - pos, Math.min(max - m - size - pos, v));
    };
    const dx = ov.dx || 0, dy = ov.dy || 0, nx = Math.round(box(dx, b.x - dx, b.w, sz.W)), ny = Math.round(box(dy, b.y - dy, b.h, sz.H));
    if (nx === dx && ny === dy) return null;
    const o = { ...ov }; if (nx) o.dx = nx; else delete o.dx; if (ny) o.dy = ny; else delete o.dy;
    return o;
  }

  // full-size render of slide i (aplicar, ver; noBlob: only its warnings, for estado)
  async function renderFull(s, i, kit, fin, sz, rawHash, noBlob) {
    const d = s.design, sl = d.slides[i], src = effSrc(sl, fin), f = M.files[src], k0 = rawHash != null ? avKey(s, i, rawHash, sz, fin) : null;
    let blob0;
    try { blob0 = await I().getBlob(src); } catch (e) { throw new DzError(`La foto de la diapositiva ${i + 1} ya no está en la mesa: elige otra en «Diseñar».`); }
    const bmp = await createImageBitmap(blob0, { imageOrientation: 'from-image' });
    try {
      const r = rectOf(src, sz.W, sz.H), k = bmp.width / f.w, rc = { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
      const o = { fmt: d.fmt, pagina: pageOf(s, i), serie: str(d.serie), srcW: sz.sw, srcH: sz.sh }, slide = slideAt(sl, sz);
      let res = await ENG().render(kit, slide, bmp, rc, o);
      const adj = clampOv(sl, slide.ov, res, sz);
      if (adj) { res.canvas.width = res.canvas.height = 0; res = await ENG().render(kit, { ...slide, ov: adj }, bmp, rc, o); }
      const blob = noBlob ? null : await ENG().aBlob(res.canvas, 0.92);
      const out = { blob, w: res.canvas.width, h: res.canvas.height, decision: res.decision, bloque: res.bloque, avisos: res.avisos || [] };
      res.canvas.width = res.canvas.height = 0;
      if (k0) AV[s.id + ':' + i] = { key: k0, avisos: out.avisos, decision: out.decision };
      return out;
    } finally { bmp.close(); }
  }
  function checkPhotos(s, fin) {
    s.design.slides.forEach((sl, i) => {
      if (sl.tipo === 'final') need(fin, NO_FINAL, i);
      else { need(sl.src, `La diapositiva ${i + 1} no tiene foto: elígela en «Diseñar».`, i); need(M.files[sl.src], `La foto de la diapositiva ${i + 1} ya no está en la mesa: elige otra en «Diseñar».`, i); }
    });
  }

  // ---------- API ----------
  // Texts approved in the chat. Carousel: tipo by default 'portada' first, then 'ficha' ('final' only when given);
  // reel: one 'reel' slide, 9:16. Reloading keeps each slide's photo and adjustments (by position).
  async function cargar(slotId, opts = {}) {
    const s = slotOf(slotId), S = I().S;
    need(!I().locked, LOCKED);
    opts = opts || {};
    const reel = isReelS(s), list = Array.isArray(opts.slides) ? opts.slides : [];
    need(list.length, 'Faltan las diapositivas: slides:[{tipo?, titulo, texto?, entradilla?, contacto?}].');
    need(list.every(isObj), 'Cada diapositiva es un objeto {tipo?, titulo, texto?, entradilla?, contacto?}.');
    need(reel || list.length <= MAX_SLIDES, MAX_MSG);
    const cid = (s.design && s.design.kit) || S.client;
    await rawKit(cid);
    let fmt = 'r916';
    if (!reel) {
      fmt = opts.fmt != null ? String(opts.fmt) : (s.design && FMTS[s.design.fmt] ? s.design.fmt : FMTS[s.fmt] ? s.fmt : 'v45');
      need(FMTS[fmt], `Formato de carrusel no válido: «${opts.fmt}» (usa v45, v34 o h).`);
    }
    const avisos = [];
    if (reel && list.length > 1) avisos.push('Un reel lleva una sola portada: se usa solo el primer texto.');
    const old = s.design ? s.design.slides : [];
    await I().loadThumbs(old.map(x => x.src).filter(Boolean));
    const slides = (reel ? list.slice(0, 1) : list).map((x, i) => {
      let tipo = reel ? 'reel' : x.tipo;
      if (!reel && !TIPOS_CAR.includes(tipo)) { need(tipo == null || tipo === '', `Tipo de diapositiva no válido: «${tipo}» (portada, ficha o final).`); tipo = i === 0 ? 'portada' : 'ficha'; }
      const o = old[i] || {};
      return { tipo, titulo: str(x.titulo), texto: str(x.texto), entradilla: str(x.entradilla),
        contacto: x.contacto != null ? str(x.contacto) : null, src: o.src || null, ov: isObj(o.ov) ? clone(o.ov) : {} };   // contacto only when given: else the kit's
    });
    // slides still without a photo take the slot's photos not used yet, in order (a final uses the client's)
    const used = new Set(slides.map(x => x.src).filter(Boolean)), free = rawPhotos(s).filter(f => !used.has(f));
    for (const sl of slides) if (!sl.src && sl.tipo !== 'final' && free.length) sl.src = free.shift();
    const d0 = s.design;
    s.design = { v: 1, kit: cid, fmt, serie: opts.serie != null ? str(opts.serie) : d0 ? str(d0.serie) : '', slides, out: d0 ? d0.out || null : null, sig: d0 ? d0.sig || null : null, at: nowISO() };
    if (d0 && d0.outAt) s.design.outAt = d0.outAt;
    if (d0 && d0.stash) s.design.stash = d0.stash;          // the design kept from its other type (Notion) stays
    if (d0 && d0.fmt !== fmt) stampOffsets(s.design, EXT_H[d0.fmt]);
    release(s, old.slice(slides.length).map(x => x.src));
    remember(s); syncFmt(s);
    I().changed();
    if (E && E.slotId === slotId) edReload();
    const st = await estado(slotId);
    if (avisos.length) st.avisos = avisos;
    return st;
  }

  async function estado(slotId) {
    const s = slotOf(slotId), d = s.design;
    if (!d) return { slot: s.id, nombre: s.name, tipo: s.type, diseno: false, fotos: rawPhotos(s).map(f => ({ fileId: f, name: nameOf(f) })) };
    let raw = null; try { raw = (await rawKit(d.kit)).raw; } catch (e) { /* kit gone: still report */ }
    const fin = raw ? await finalReady(raw) : null;
    await I().loadThumbs(srcsOf(s));
    const aplicado = isApplied(s), used = new Set(srcsOf(s)), cur = await avisosActuales(s, raw, fin);
    return {
      slot: s.id, nombre: s.name, tipo: s.type, kit: d.kit, fmt: d.fmt, serie: d.serie,
      aplicado, desactualizado: aplicado && !!raw && d.sig !== sigOf(s, raw),
      fotoFinal: fin ? nameOf(fin) : null,
      slides: d.slides.map((sl, i) => {
        const src = effSrc(sl, fin);
        const av = [...slideAvisos(sl, src), ...(cur[i] || [])];
        return { n: i + 1, tipo: sl.tipo, titulo: sl.titulo, texto: sl.texto, entradilla: sl.entradilla, contacto: sl.contacto ?? null,
          ...(sl.tipo === 'final' ? { contactoUsado: sl.contacto ?? (raw && raw.final ? raw.final.contacto ?? null : null) } : {}), src: src || null, foto: src ? nameOf(src) : null, ov: clone(sl.ov || {}), avisos: av, ...(cur[i] ? {} : { avisosPendientes: true }) };
      }),
      fotosSinUsar: rawPhotos(s).filter(f => !used.has(f)).map(f => ({ fileId: f, name: nameOf(f) })),
      archivos: outsOf(s).map(f => ({ fileId: f, name: s.photos.includes(f) ? I().dName(s, f) : nameOf(f), enCasilla: s.photos.includes(f) })),
      ...(d.avisos && d.avisos.length && aplicado ? { avisosAplicados: d.avisos.slice() } : {})
    };
  }
  // what a slide lacks (the engine's warnings come after), the same words in estado() and in the editor
  const slideAvisos = (sl, src) => [...(!src || !M.files[src] ? [sl.tipo === 'final' ? 'Falta la foto final del cliente' : 'Falta la foto'] : []), ...(!str(sl.titulo).trim() ? ['Sin título'] : [])];
  // the engine's warnings for each slide as it is now (from the latest drawing of exactly that, or drawn now); null = pending
  async function avisosActuales(s, raw, fin) {
    const d = s.design, rh = kitHash(raw);
    let eng = null; if (raw && ENG() && ENG().usarKit) { try { eng = await engineKit(d.kit); } catch (e) { /* no engine or fonts: pending */ } }
    const sz = eng ? sizeOf(eng.kit, d, fin) : null;
    const out = [];
    for (let i = 0; i < d.slides.length; i++) {
      const c = sz && avGet(s, i, avKey(s, i, rh, sz, fin)), src = effSrc(d.slides[i], fin);
      if (c) { out.push(c.avisos); continue; }
      if (eng && src && M.files[src]) { try { out.push((await renderFull(s, i, eng.kit, fin, sz, rh, true)).avisos); continue; } catch (e) { /* pending */ } }
      out.push(null);
    }
    return out;
  }

  // Renders every slide at full size into new design files and puts them in the slot (reel: the cover).
  let APL = 0;                                 // «Aplicar» running (the mesa's sweep of unused rendered images waits)
  async function aplicar(slotId) {
    APL++;
    try { return await aplicarNow(slotId); } finally { APL--; }
  }
  async function aplicarNow(slotId) {
    const s = slotOf(slotId), S = I().S;
    need(!I().locked, LOCKED);
    need(!I().uploadsBusy(), 'Espera a que termine la subida a Notion.');
    need(s.design && s.design.slides.length, NO_DESIGN);
    const d = s.design, reel = isReelS(s);
    need(reel || d.slides.length <= MAX_SLIDES, MAX_MSG);
    const { kit, raw } = await engineKit(d.kit, true);
    const fin = await finalReady(raw);
    await I().loadThumbs(srcsOf(s));
    checkPhotos(s, fin);
    const sz = sizeOf(kit, d, fin), sig = sigOf(s, raw), rh = kitHash(raw), done = [], avisos = [], notas = [];   // sig first: an edit made while rendering stays «sin aplicar»
    const pre = i => reel ? '' : `Diapositiva ${i + 1}: `;
    for (let i = 0; i < d.slides.length; i++) {
      const r = await renderFull(s, i, kit, fin, sz, rh);
      done.push(r);
      if (!str(d.slides[i].titulo).trim()) avisos.push(reel ? 'Sin título' : pre(i) + 'sin título');
      r.avisos.forEach(a => avisos.push(pre(i) + a));
    }
    need(I().S === S && S.slots.includes(s) && s.design === d, 'La mesa cambió mientras se aplicaba el diseño: vuelve a intentarlo.');
    const outs = [];
    for (let i = 0; i < done.length; i++) {
      const r = done[i], name = reel ? `${s.name} portada.jpg` : `${s.name} ${pad2(i + 1)}.jpg`;
      const { w, h, thumb } = await I().makeThumb(r.blob);
      const id = I().newId();
      await I().idbPut('files', id, { name, size: r.blob.size, type: 'image/jpeg', w, h, lastModified: Date.now(), blob: r.blob, thumb, design: true });
      M.files[id] = { name, size: r.blob.size, type: 'image/jpeg', w, h, thumbUrl: URL.createObjectURL(thumb), design: true };
      M.thumbBlobs[id] = thumb;
      outs.push(id);
    }
    const old = outsOf(s).filter(f => !outs.includes(f)), used = new Set(srcsOf(s));
    const unused = rawPhotos(s).filter(f => !used.has(f));
    if (unused.length) { S.tray.unshift(...unused.filter(f => !S.tray.includes(f))); notas.push(`${unused.length === 1 ? 'Una foto de la casilla no se usa en el diseño: vuelve' : `${unused.length} fotos de la casilla no se usan en el diseño: vuelven`} a la bandeja.`); }
    s.photos = outs.slice();
    if (!reel) s.fmt = d.fmt;
    d.out = outs; d.sig = sig; d.outAt = nowISO(); d.avisos = avisos.slice(); remember(s);
    I().changed(); if (!(E && E.slotId === slotId)) I().refreshDetail();   // with the editor open, closing it refreshes the post (once: no image load cut short)
    for (const f of old) { try { await I().deleteIfUnused(f); } catch (e) { /* kept */ } }
    if (E && E.slotId === slotId) edHead();
    return { ok: true, archivos: outs.map(f => ({ fileId: f, name: I().dName(s, f), w: M.files[f].w, h: M.files[f].h, kb: Math.round(M.files[f].size / 1024) })), avisos, ...(notas.length ? { notas } : {}) };
  }

  // Renders slide n (1-based) into M.out.diseno (a JPEG Blob) so Claude can look at it.
  async function ver(slotId, n) {
    const s = slotOf(slotId); need(s.design && s.design.slides.length, NO_DESIGN);
    const d = s.design, i = (+n || 1) - 1;
    need(i >= 0 && i < d.slides.length, `No existe la diapositiva ${n} (hay ${d.slides.length}).`);
    const { kit, raw } = await engineKit(d.kit);
    const fin = await finalReady(raw);
    await I().loadThumbs(srcsOf(s));
    const sl = d.slides[i], src = effSrc(sl, fin);
    if (sl.tipo === 'final') need(fin, NO_FINAL); else need(src && M.files[src], `La diapositiva ${i + 1} no tiene foto: elígela en «Diseñar».`);
    const r = await renderFull(s, i, kit, fin, sizeOf(kit, d, fin), kitHash(raw));
    M.out.diseno = r.blob;
    return { n: i + 1, w: r.w, h: r.h, kb: Math.round(r.blob.size / 1024), decision: r.decision, bloque: r.bloque, avisos: r.avisos };
  }

  async function kit(clientId) { need(I(), 'La mesa no tiene el puente del diseñador: actualiza mesa.js (3.18 o posterior).'); const S = I().S; const cid = clientId || (S && S.client); need(cid, 'Indica el cliente.'); return clone((await rawKit(cid, true)).raw); }

  // Per-client override of the kit (sizes, colours, rules…), stored on the client record: travels with export/import.
  // patch keys set to null go back to the kit's value; patch === null clears every override but the final photo.
  async function ajustarKit(clientId, patch) {
    need(patch === null || isObj(patch), 'ajustarKit espera un objeto con los cambios (null en una clave la devuelve al valor del kit).');
    const { base } = await rawKit(clientId);
    const c = await I().idbGet('clients', clientId); need(c, 'No existe ese cliente.');
    const ov0 = c.kit || {};
    c.kit = patch === null ? (ov0.final && ov0.final.foto ? { final: { foto: ov0.final.foto, fotoAt: ov0.final.fotoAt } } : {}) : deepMerge(ov0, patch);
    c.kitAt = nowISO();
    await I().idbPut('clients', clientId, c); await I().loadClients();
    delete ENGK[clientId];
    if (E && E.cid === clientId) edKitChanged();
    return { ok: true, override: clone(c.kit), kit: deepMerge(base, c.kit) };
  }

  // The client's fixed final photo: a copy of that mesa photo in the protected file 'kit-<clientId>-final'.
  async function fijarFinal(clientId, fileId) {
    await rawKit(clientId);
    const c = await I().idbGet('clients', clientId); need(c, 'No existe ese cliente.');
    const rec = await I().idbGet('files', fileId); need(rec && rec.blob, 'Esa foto no está en la mesa.');
    const id = await putFinal(clientId, { name: rec.name, size: rec.size, type: rec.type, w: rec.w, h: rec.h, lastModified: rec.lastModified || 0, blob: rec.blob, thumb: rec.thumb, ...(rec.reduced ? { reduced: true } : {}) });
    return { ok: true, fileId: id, name: nameOf(id) };
  }
  async function fijarFinalArchivo(clientId, file) {   // a photo dropped on the editor (not added to the tray)
    need(file && OK_TYPES.includes(file.type), 'La foto final tiene que ser JPG o PNG.');
    const { w, h, thumb } = await I().makeThumb(file);
    return putFinal(clientId, { name: file.name, size: file.size, type: file.type, w, h, lastModified: file.lastModified || 0, blob: file, thumb });
  }
  async function putFinal(cid, rec) {
    const id = `kit-${cid}-final`, at = nowISO();
    rec.name = 'Foto final · ' + String(rec.name || 'foto.jpg').replace(/^Foto final · /, '');
    await I().idbPut('files', id, rec);
    if (M.files[id]) URL.revokeObjectURL(M.files[id].thumbUrl);
    delete M.files[id]; delete M.blobs[id]; delete M.thumbBlobs[id];
    if (M.bigUrls && M.bigUrls[id]) { URL.revokeObjectURL(M.bigUrls[id]); delete M.bigUrls[id]; }
    await I().loadThumbs([id]);
    const c = await I().idbGet('clients', cid);
    c.kit = deepMerge(c.kit || {}, { final: { foto: id, fotoAt: at } }); c.kitAt = at;
    await I().idbPut('clients', cid, c); await I().loadClients();
    delete ENGK[cid];
    if (E && E.cid === cid) edKitChanged(true);
    return id;
  }

  // ---------- editor ----------
  const CSS = `
#mesa .dz{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;background:var(--bg);outline:0}
#mesa .dz-head{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--line)}
#mesa .dz-ttl{flex:1 1 170px;min-width:0}
#mesa .dz-ttl h3{margin:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .dz-ttl p{margin:2px 0 0;color:var(--mute);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .dz-serie{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mute);white-space:nowrap}
#mesa .dz-in{display:block;width:100%;border:1px solid var(--line);border-radius:8px;padding:7px 9px;min-height:32px;font-family:inherit;font-size:13px;line-height:1.4;color:var(--ink);background:var(--panel)}
#mesa .dz-serie .dz-in{width:190px}
#mesa .dz-in:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
#mesa textarea.dz-in{resize:vertical;min-height:60px}
#mesa .dz-state{font-size:11.5px;font-weight:600;border-radius:999px;padding:3px 10px;background:var(--line2);color:var(--mute);white-space:nowrap}
#mesa .dz-state.chg{background:#fdeee6;color:var(--chg)}#mesa .dz-state.ok{background:#e7f4ea;color:var(--ok)}
#mesa .dz-head .btn:disabled{opacity:.6;cursor:default}
#mesa .dz .seg button{padding:5px 9px}
#mesa .dz-body{flex:1;min-height:0;display:grid;grid-template-columns:136px minmax(0,1fr) 316px}
#mesa .dz-list{overflow-y:auto;padding:12px 10px 16px;background:var(--panel);border-right:1px solid var(--line2)}
#mesa .dz-it{margin:0 0 12px;cursor:pointer;user-select:none}
#mesa .dz-it canvas{display:block;width:100%;height:auto;border-radius:3px;background:#e6e6e6;outline:2px solid transparent;outline-offset:2px}
#mesa .dz-it.on canvas{outline-color:var(--acc)}
#mesa .dz-it:hover:not(.on) canvas{outline-color:var(--line)}
#mesa .dz-n{display:flex;align-items:center;gap:5px;margin-top:5px;font-size:11.5px;color:var(--mute);white-space:nowrap}
#mesa .dz-n b{color:var(--ink);font-weight:600}
#mesa .dz-mv{margin-left:auto;display:flex}
#mesa .dz-mv button{border:0;background:none;width:20px;height:22px;border-radius:5px;font-size:10.5px;line-height:22px;padding:0;color:var(--mute)}
#mesa .dz-mv button:hover:not(:disabled){background:var(--line2);color:var(--ink)}
#mesa .dz-mv button:disabled{opacity:.25;cursor:default}
#mesa .dz-add{width:100%;font-size:12.5px;padding:6px 4px}
#mesa .dz-mid{min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;overflow:hidden}
#mesa .dz-cv{display:block;flex:none;background:#e6e6e6;box-shadow:0 4px 22px rgba(0,0,0,.16);touch-action:none}
#mesa .dz-cvw{position:relative;flex:none;line-height:0}#mesa .dz-cvw.reframe .thirds{opacity:1}
#mesa .dz-foot{flex:none;max-width:100%;text-align:center}
#mesa .dz-av{list-style:none;margin:0 0 4px;padding:0;font-size:12.5px;color:var(--chg)}
#mesa .dz-av li{margin:2px 0}
#mesa .dz-hint{margin:0;color:var(--mute);font-size:12px}
#mesa .dz-panel{overflow-y:auto;padding:0 16px 24px;background:var(--panel);border-left:1px solid var(--line2)}
#mesa .dz-sec{padding:12px 0 14px;border-bottom:1px solid var(--line2)}#mesa .dz-sec:last-child{border-bottom:0}
#mesa .dz-sec h4{margin:0 0 8px;font-size:13px;font-weight:600}#mesa .dz-sec h4 span,#mesa .dz-l span{font-weight:400;color:var(--mute);font-size:12px}
#mesa .dz-l{display:block;font-size:12.5px;font-weight:600;margin:12px 0 5px}#mesa .dz-sec h4+.dz-l{margin-top:0}
#mesa .dz-p{margin:0;font-size:13px}
#mesa .dz-row{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;margin-top:8px}
#mesa .dz-photos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
#mesa .dz-ph{position:relative;aspect-ratio:3/4;border:0;padding:0;border-radius:5px;overflow:hidden;background:#efefef}
#mesa .dz-ph.on{outline:3px solid var(--acc);outline-offset:-3px}
#mesa .dz-ph img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
#mesa .dz-ph i{position:absolute;top:3px;left:3px;font-style:normal;font-size:9.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.55);border-radius:4px;padding:0 4px;pointer-events:none}
#mesa .dz-fin{display:flex;gap:10px;align-items:center;margin-bottom:6px}
#mesa .dz-fin img{flex:none;width:54px;height:68px;object-fit:cover;border-radius:5px;display:block;background:#efefef}
#mesa .dz-fin b{display:block;font-size:12.5px}#mesa .dz-fin span{display:block;font-size:11.5px;color:var(--mute);overflow-wrap:anywhere}
#mesa .dz-drop{border:1.5px dashed #c7c7c7;border-radius:10px;padding:14px 10px;text-align:center;color:var(--mute);font-size:12.5px;background:var(--bg);cursor:pointer;margin-top:8px}
#mesa .dz-drop.over{border-color:var(--acc);background:#e8f3fe;color:var(--ink)}
#mesa .dz-size{display:inline-flex;align-items:center;gap:8px}
#mesa .dz-size .btn2{min-width:42px;font-weight:600}#mesa .dz-size .btn2:disabled{opacity:.35;cursor:default}
#mesa .dz-size output{min-width:3.6em;text-align:center;font-variant-numeric:tabular-nums;font-size:12.5px}
#mesa .dz-sws{display:flex;flex-wrap:wrap;gap:9px;align-items:center}
#mesa .dz-sw{width:26px;height:26px;border-radius:50%;border:1px solid rgba(0,0,0,.18);padding:0}
#mesa .dz-sw.on{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--acc)}
#mesa .dz-auto{border:1px solid var(--line);border-radius:999px;background:var(--panel);font-size:12px;padding:4px 11px;min-height:28px}
#mesa .dz-auto.on{background:var(--ink);border-color:var(--ink);color:#fff}
#mesa .dz-velo{display:flex;align-items:center;gap:10px}#mesa .dz-velo input{flex:1;min-width:0}
#mesa .dz-velo output{min-width:2.6em;text-align:right;font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--mute)}
#mesa .dz-dec{font-weight:400;color:var(--mute);font-size:12px}
#mesa .dz-max{margin:6px 2px 0;font-size:11px;line-height:1.35}
@media (max-width:900px){#mesa .dz-body{grid-template-columns:112px minmax(0,1fr);grid-template-rows:minmax(220px,52%) minmax(0,1fr)}#mesa .dz-panel{grid-column:1/-1;border-left:0;border-top:1px solid var(--line2)}#mesa .dz-mid{padding:10px}#mesa .dz-list{grid-row:1;padding:10px 8px}#mesa .dz-add{font-size:11.5px;padding:5px 2px;white-space:nowrap}#mesa .dz-serie .dz-in{width:140px}#mesa .dz-n{flex-wrap:wrap}#mesa .dz-mv{margin-left:-4px;width:100%}}`;
  function injectCSS() { if (document.getElementById('dz-css')) return; const st = document.createElement('style'); st.id = 'dz-css'; st.textContent = CSS; document.head.append(st); }

  let E = null;     // the open editor: {slotId, board, cid, kit, raw, rawHash, fin, sel, sz, el, cv, ctx, off, need, last, thumbs, bm, capas, raf, saveT, drag, …}
  const curSlot = () => { if (!E) return null; const S = I() && I().S, s = S && S === E.board ? S.slots.find(x => x.id === E.slotId) : null; return s && s.design && (I().isCarousel(s.type) || I().isReel(s.type)) ? s : null; };
  const D = () => curSlot().design;
  // at least 25 % of a moved text block (and 80 px each way) stays on the canvas: never out of reach
  const lim = (v, pos, size, max) => { const keep = Math.min(size, Math.max(size * 0.25, 80)); return Math.max(keep - size - pos, Math.min(max - keep - pos, v)); };
  // a new design from the slot's photos (first «Diseñar» without texts from Claude)
  function newDesign(s, cid) {
    const reel = isReelS(s), raw = rawPhotos(s);
    const slides = reel ? [blankSlide('reel', raw[0])] : (raw.length ? raw.slice(0, MAX_SLIDES) : [null]).map((f, i) => blankSlide(i === 0 ? 'portada' : 'ficha', f));
    return { v: 1, kit: cid, fmt: reel ? 'r916' : FMTS[s.fmt] ? s.fmt : 'v45', serie: '', slides, out: null, sig: null, at: nowISO(), known: raw };
  }
  // photos put in the post since the design last saw it: they fill slides without a photo, then become new fichas
  // (before a final, up to 20 slides); returns the message for Kevin (null = nothing new)
  function absorb(s) {
    const d = s.design, used = new Set(srcsOf(s)), known = new Set(d.known || []);
    const extra = rawPhotos(s).filter(f => !used.has(f) && !known.has(f));
    if (!extra.length) return null;
    if (isReelS(s)) { const old = d.slides[0].src; d.slides[0].src = extra[0]; release(s, [old]); return 'La portada del reel usa la foto nueva de la casilla.'; }
    let filled = 0;
    for (const sl of d.slides) if (!sl.src && sl.tipo !== 'final' && extra.length) { sl.src = extra.shift(); filled++; }
    const room = Math.max(0, MAX_SLIDES - d.slides.length), add = extra.slice(0, room), left = extra.length - add.length;
    const k = d.slides.length && d.slides[d.slides.length - 1].tipo === 'final' ? d.slides.length - 1 : d.slides.length;
    d.slides.splice(k, 0, ...add.map(f => blankSlide('ficha', f)));
    const n = add.length;
    return [n && `Añadida${n === 1 ? '' : 's'} ${n} diapositiva${n === 1 ? '' : 's'} con fotos nuevas de la casilla.`,
      filled && `${filled === 1 ? 'Una foto nueva de la casilla va en una diapositiva' : `${filled} fotos nuevas de la casilla van en diapositivas`} que no tenía${filled === 1 ? '' : 'n'} foto.`,
      left && `${left === 1 ? 'Una foto nueva no cabe' : `${left} fotos nuevas no caben`}: un carrusel admite como máximo 20 diapositivas (Instagram).`].filter(Boolean).join(' ');
  }

  async function abrir(slotId) {
    try {
      const s = slotOf(slotId), S = I().S;
      need(!I().locked, LOCKED);
      if (E) cerrar();
      const cid = (s.design && s.design.kit) || S.client;
      const { kit, raw } = await engineKit(cid, true);   // the kit file is read again: edited on disk counts
      const fin = await finalReady(raw);
      await I().loadThumbs(srcsOf(s));
      need(I().S === S && S.slots.includes(s) && (I().isCarousel(s.type) || I().isReel(s.type)) && !(I().switching && I().switching()), 'La mesa cambió: vuelve a pulsar «Diseñar».');
      if (E) cerrar();
      let changedNow = false, msg = null;
      if (!s.design) { s.design = newDesign(s, cid); changedNow = true; }
      else if ((msg = absorb(s))) { remember(s); changedNow = true; }
      const f0 = s.fmt; syncFmt(s); if (s.fmt !== f0) changedNow = true;
      injectCSS();
      E = { slotId, board: S, cid, kit, raw, rawHash: kitHash(raw), fin, sel: 0, need: new Set(), last: [], thumbs: new WeakMap(), bm: new Map(), q: [], dec: 0, tick: 0, capas: new Map(), raf: 0, saveT: 0, pickFinal: false, busy: false, drag: null };
      E.sz = sizeOf(kit, s.design, fin);
      build(s);
      if (changedNow) { s.design.at = nowISO(); I().save(); }
      if (msg) I().toast(msg);
      return { ok: true, slot: s.id, diapositivas: s.design.slides.length, ...(msg ? { aviso: msg } : {}) };
    } catch (e) {
      const m = e instanceof DzError ? e.message : 'No se pudo abrir el diseñador: ' + String((e && e.message) || e);
      if (!(e instanceof DzError)) console.warn('diseño:', e);
      if (I() && I().toast) I().toast(m);
      return { error: m };
    }
  }

  function build(s) {
    const root = I().root(), reel = isReelS(s), d = s.design;
    const el = document.createElement('div');
    el.className = 'dz'; el.tabIndex = -1;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Diseñar ' + s.name);
    el.innerHTML = `<header class="dz-head"><div class="dz-ttl"><h3>${esc(s.name)}</h3><p class="dz-sub"></p></div>`
      + (reel ? '' : `<div class="seg dz-fmt" role="group" aria-label="Formato del carrusel">${Object.entries(FMTS).map(([k, l]) => `<button type="button" data-dz="fmt" data-v="${k}">${l}</button>`).join('')}</div>`
        + `<label class="dz-serie">Nombre del carrusel <input type="text" class="dz-in dz-serin" placeholder="Ej.: POR QUÉ FILIPINAS" value="${esc(d.serie)}"></label>`)
      + '<span class="dz-state" aria-live="polite"></span><button type="button" class="btn2" data-dz="cerrar">Cerrar</button><button type="button" class="btn" data-dz="aplicar">Aplicar a la casilla</button></header>'
      + '<div class="dz-body"><nav class="dz-list" aria-label="Diapositivas"></nav>'
      + '<section class="dz-mid"><div class="dz-cvw"><canvas class="dz-cv" aria-label="Vista previa"></canvas><div class="thirds" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div class="dz-foot"><ul class="dz-av"></ul><p class="dz-hint">Arrastra el texto para moverlo · arrastra la foto para reencuadrarla</p></div></section>'
      + '<aside class="dz-panel"></aside></div><input type="file" class="dz-file" accept="image/jpeg,image/png,image/webp" hidden>';
    root.append(el);
    // the mesa behind can't be reached with Tab while the editor is open (toasts stay usable: «Deshacer»)
    E.inert = [...root.children].filter(c => c !== el && !c.matches('.toasts, .lock, style') && !c.hasAttribute('inert'));
    E.inert.forEach(c => c.setAttribute('inert', ''));
    E.el = el; E.cv = el.querySelector('.dz-cv'); E.ctx = E.cv.getContext('2d');
    E.off = document.createElement('canvas'); E.offCtx = E.off.getContext('2d');
    const ae = document.activeElement; if (ae && ae.blur && root.contains(ae)) ae.blur();
    el.focus({ preventScroll: true });
    wireEditor(el);
    window.addEventListener('keydown', onKey, true);
    E.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fitCanvas) : null;
    if (E.ro) E.ro.observe(el.querySelector('.dz-mid'));
    edAll();
  }
  // everything again (open, format change, reload from Claude)
  // keep: the panel is updated in place (a kit or final-photo change: the field being edited keeps its native undo)
  function edAll(keep) {
    if (!E) return;
    const d = D(); E.sel = Math.max(0, Math.min(d.slides.length - 1, E.sel));
    E.cv.width = E.sz.W; E.cv.height = E.sz.H;
    if (!keep) E.capas.clear();       // a kit change keeps the photo layers (they don't depend on it)
    E.last = [];
    edHead(); edList(); edPanel(!keep); fitCanvas();
    dirty('all');
  }
  function edReload() {        // the design was replaced from outside (cargar)
    if (!E) return; const s = curSlot(); if (!s) { cerrar(); return; }
    I().loadThumbs(srcsOf(s)).then(() => { if (!E || !curSlot()) return; E.sz = sizeOf(E.kit, s.design, E.fin); edAll(); });
  }
  async function edKitChanged(finalToo) {
    if (!E) return;
    const e0 = E;
    try {
      const { kit, raw } = await engineKit(E.cid);
      if (E !== e0 || !curSlot()) return;
      E.kit = kit; E.raw = raw; E.rawHash = kitHash(raw);
      if (finalToo) { const old = E.fin; E.fin = await finalReady(raw); if (E !== e0) return; dropBitmap(old); dropBitmap(E.fin); E.pickFinal = false; }
      E.sz = sizeOf(E.kit, D(), E.fin); edAll(true);
    } catch (e) { I().toast(e instanceof DzError ? e.message : String(e)); }
  }

  function edHead() {
    if (!E) return; const s = curSlot(); if (!s) return;
    const d = s.design, reel = isReelS(s), n = d.slides.length;
    E.el.querySelector('.dz-sub').textContent = reel ? `${s.type} · portada 9:16 · ${E.sz.W}×${E.sz.H}` : `Carrusel · ${n} diapositiva${n === 1 ? '' : 's'} · ${E.sz.W}×${E.sz.H}`;
    E.el.querySelectorAll('.dz-fmt button').forEach(b => { const on = b.dataset.v === d.fmt; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const st = E.el.querySelector('.dz-state'), ap = isApplied(s);
    const chg = ap && d.sig !== sigOf(s, E.raw);
    st.className = 'dz-state' + (ap ? (chg ? ' chg' : ' ok') : '');
    st.textContent = !ap ? (d.out ? 'Sin aplicar en la casilla' : 'Sin aplicar') : chg ? 'Cambios sin aplicar' : 'Aplicado';
  }

  // the element a rebuilt part of the editor should give the focus back to
  const cssv = v => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&');
  function focusKey(el) {
    if (!el || !el.dataset) return null;
    if (el.dataset.dz) return `[data-dz="${cssv(el.dataset.dz)}"]` + (el.dataset.v != null ? `[data-v="${cssv(el.dataset.v)}"]` : '') + (el.dataset.f != null ? `[data-f="${cssv(el.dataset.f)}"]` : '') + (el.dataset.i != null ? `[data-i="${cssv(el.dataset.i)}"]` : '');
    if (el.id) return '#' + cssv(el.id);
    return el.classList && el.classList.length ? '.' + [...el.classList].map(cssv).join('.') : null;
  }
  function refocus(box, key) {
    if (!key) return;
    const n = box.querySelector(key);
    if (n && !n.disabled) n.focus({ preventScroll: true });
    else if (n) { const alt = [...(n.parentElement || box).querySelectorAll('button:not([disabled])')][0]; if (alt) alt.focus({ preventScroll: true }); }
  }

  // left: one live thumbnail per slide
  function thumbOf(sl) {
    let c = E.thumbs.get(sl);
    const tw = 216, th = Math.round(tw * E.sz.H / E.sz.W);
    if (!c || c.width !== tw || c.height !== th) { c = document.createElement('canvas'); c.width = tw; c.height = th; E.thumbs.set(sl, c); }
    return c;
  }
  function edList(focusSel) {
    const d = D(), reel = isReelS(curSlot()), n = d.slides.length, list = E.el.querySelector('.dz-list');
    const ae = document.activeElement, key = focusSel || (ae && list.contains(ae) ? focusKey(ae) : null);
    list.innerHTML = d.slides.map((sl, i) => `<div class="dz-it${i === E.sel ? ' on' : ''}" data-dz="sel" data-i="${i}" role="button" tabindex="0" aria-label="Diapositiva ${i + 1}: ${TIPO_LABEL[sl.tipo] || sl.tipo}"><span class="dz-cvs"></span>`
      + `<div class="dz-n"><b>${pad2(i + 1)}</b>${esc(TIPO_LABEL[sl.tipo] || sl.tipo)}${reel ? '' : `<span class="dz-mv"><button type="button" data-dz="up" data-i="${i}" title="Subir" aria-label="Subir la diapositiva ${i + 1}" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-dz="down" data-i="${i}" title="Bajar" aria-label="Bajar la diapositiva ${i + 1}" ${i === n - 1 ? 'disabled' : ''}>▼</button><button type="button" data-dz="del" data-i="${i}" title="Quitar" aria-label="Quitar la diapositiva ${i + 1}" ${n < 2 ? 'disabled' : ''}>×</button></span>`}</div></div>`).join('')
      + (reel ? '' : `<button type="button" class="btn2 dz-add" data-dz="add" ${n >= MAX_SLIDES ? `disabled title="${esc(MAX_MSG)}"` : ''}>+ Diapositiva</button>${n >= MAX_SLIDES ? '<p class="dz-hint dz-max">Máximo 20 diapositivas (límite de Instagram).</p>' : ''}`);
    list.querySelectorAll('.dz-cvs').forEach((sp, i) => sp.replaceWith(thumbOf(d.slides[i])));
    refocus(list, key);
  }

  // right: the selected slide's controls. The panel is updated section by section, and the text fields stay while the
  // same slide (and type) is shown: the caret, the focus and the field's own ⌘Z survive every other adjustment
  function segHTML(act, opts, cur, label) {
    return `<div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v, l]) => `<button type="button" data-dz="${act}" data-v="${v}" class="${cur === v ? 'on' : ''}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  }
  function availPhotos(s) {     // this design's photos, the slot's and the tray's
    const S = I().S;
    return [...new Set([...srcsOf(s), ...rawPhotos(s), ...S.tray])].filter(f => M.files[f] && !M.files[f].design && !String(f).startsWith('kit-'));
  }
  function photosHTML(s, cur, act) {
    const list = availPhotos(s);
    if (!list.length) return '<p class="muted" style="margin:0">No hay fotos: añádelas a la casilla o a la bandeja.</p>';
    const uses = {};
    s.design.slides.forEach((x, k) => { if (x.tipo !== 'final' && x.src) (uses[x.src] = uses[x.src] || []).push(pad2(k + 1)); });
    return `<div class="dz-photos">${list.map(f => `<button type="button" class="dz-ph${f === cur ? ' on' : ''}" data-dz="${act}" data-f="${esc(f)}" title="${esc(M.files[f].name)}" aria-pressed="${f === cur}"><img src="${M.files[f].thumbUrl}" alt="" draggable="false">${uses[f] ? `<i>${uses[f].join(' · ')}</i>` : ''}</button>`).join('')}</div>`;
  }
  function zoomHTML(src) {
    const c = I().baseCrop(src, I().S);
    return `<div class="dz-row"><label class="zoom">Zoom <input type="range" class="dz-zoomr" min="1" max="3" step="0.01" value="${c.z || 1}"></label><button type="button" class="lnk" data-dz="centrar">Centrar</button></div>`;
  }
  function fotoHTML(s, sl) {
    if (sl.tipo === 'final') {
      const f = E.fin && M.files[E.fin];
      let h = f ? `<div class="dz-fin"><img src="${f.thumbUrl}" alt="" draggable="false"><div><b>Foto final del cliente</b><span>${esc(f.name.replace(/^Foto final · /, ''))} · la misma en todos sus carruseles</span></div></div>${zoomHTML(E.fin)}`
        : '<p class="dz-p">Este cliente aún no tiene foto final.</p>';
      if (f) h += `<button type="button" class="lnk" data-dz="otrafinal" style="padding-left:0">Usar otra foto como final del cliente</button>`;
      if (!f || E.pickFinal) h += `<div style="margin-top:8px">${photosHTML(s, null, 'setfinal')}</div><div class="dz-drop" data-dz="pickfile">Suelta aquí la foto final (JPG o PNG) o pulsa para elegirla</div>`;
      return h;
    }
    return photosHTML(s, sl.src, 'src') + (sl.src && M.files[sl.src] ? zoomHTML(sl.src) : availPhotos(s).length ? '<p class="dz-hint" style="margin-top:8px">Elige la foto de esta diapositiva.</p>' : '');
  }
  const hasCrop = src => !!(src && I().S.crops && I().S.crops[src]);
  function panelSecs(s, sl) {
    const d = s.design, i = E.sel, ov = sl.ov || {}, reel = isReelS(s), e = ov.escala || 1, va = ov.velo == null, last = E.last[i];
    const sec = (k, h) => [k, `<div class="dz-sec" data-sec="${k}">${h}</div>`];
    const vv = va ? (last && last.decision ? +last.decision.velo || 0 : 0) : ov.velo;
    return [
      sec('diseno', `<h4>Diseño <span>· diapositiva ${pad2(i + 1)}</span></h4>` + (reel ? '<p class="dz-p">Portada de reel <span class="muted">· 9:16; en el perfil se ve el centro 3:4</span></p>' : segHTML('tipo', [['portada', 'Portada'], ['ficha', 'Ficha'], ['final', 'Final']], sl.tipo, 'Diseño de la diapositiva'))),
      sec('foto', `<h4>Foto</h4>${fotoHTML(s, sl)}`),
      sec('texto', `<h4>Texto</h4><label class="dz-l" for="dz-f-titulo">Título <span>· Intro = salto de línea</span></label><textarea id="dz-f-titulo" class="dz-in" data-f="titulo" rows="2"></textarea>`
        + (sl.tipo === 'ficha' ? '<label class="dz-l" for="dz-f-texto">Texto</label><textarea id="dz-f-texto" class="dz-in" data-f="texto" rows="3"></textarea>' : '')
        + (sl.tipo === 'final' ? `<label class="dz-l" for="dz-f-entr">Entradilla</label><textarea id="dz-f-entr" class="dz-in" data-f="entradilla" rows="2"></textarea><label class="dz-l" for="dz-f-cont">Contacto <span>· vacío = el del kit</span></label><textarea id="dz-f-cont" class="dz-in" data-f="contacto" rows="2" placeholder="${esc((E.raw.final || {}).contacto || '')}"></textarea>` : '')),
      sec('tam', `<h4>Tamaño del texto</h4><div class="dz-size"><button type="button" class="btn2" data-dz="esc" data-v="-1" aria-label="Texto más pequeño" ${e <= ESC_MIN + 1e-6 ? 'disabled' : ''}>A−</button><output>${Math.round(e * 100)} %</output><button type="button" class="btn2" data-dz="esc" data-v="1" aria-label="Texto más grande" ${e >= ESC_MAX - 1e-6 ? 'disabled' : ''}>A+</button></div>`),
      sec('pos', `<h4>Posición <span class="dz-dec" data-dec="lugar"></span></h4>${segHTML('lugar', [['', 'Auto'], ['arriba', 'Arriba'], ['abajo', 'Abajo'], ['centro', 'Centro']], ov.lugar || '', 'Posición del texto')}`
        + `<label class="dz-l">Alineación <span class="dz-dec" data-dec="alinear"></span></label>${segHTML('alinear', [['', 'Auto'], ['izquierda', 'Izquierda'], ['centro', 'Centro'], ['derecha', 'Derecha']], ov.alinear || '', 'Alineación del texto')}`),
      sec('color', `<h4>Color del texto <span class="dz-dec" data-dec="color"></span></h4><div class="dz-sws"><button type="button" class="dz-auto${ov.color ? '' : ' on'}" data-dz="color" data-v="" aria-pressed="${!ov.color}">Auto</button>`
        + Object.entries(E.raw.colores || {}).map(([k, c]) => `<button type="button" class="dz-sw${ov.color === k ? ' on' : ''}" data-dz="color" data-v="${esc(k)}" style="background:${esc(c)}" title="${esc(k.replace(/_/g, ' '))}" aria-label="${esc(k.replace(/_/g, ' '))}" aria-pressed="${ov.color === k}"></button>`).join('') + '</div>'),
      sec('velo', `<h4>Velo <span class="dz-dec" data-dec="velo"></span></h4><div class="dz-velo"><button type="button" class="dz-auto${va ? ' on' : ''}" data-dz="veloauto" aria-pressed="${va}">Auto</button><input type="range" class="dz-velor" min="0" max="0.9" step="0.01" value="${vv}" aria-label="Opacidad del velo"><output class="dz-velov">${Math.round(vv * 100)} %</output></div>`),
      sec('reset', `<button type="button" class="btn2" data-dz="reset" ${Object.keys(ov).length || hasCrop(effSrc(sl, E.fin)) ? '' : 'disabled'}>Restablecer ajustes</button>`)
    ];
  }
  function edPanel(force) {
    const s = curSlot(), sl = s.design.slides[E.sel], p = E.el.querySelector('.dz-panel'), top = p.scrollTop;
    const secs = panelSecs(s, sl), ae = document.activeElement, key = ae && p.contains(ae) ? focusKey(ae) : null;
    const same = !force && E.pSlide === sl && E.pTipo === sl.tipo && E.pHtml && p.children.length === secs.length;
    if (!same) {
      p.innerHTML = secs.map(x => x[1]).join('');
      p.querySelectorAll('[data-f]').forEach(t => { t.value = str(sl[t.dataset.f]); });   // by value: a leading line break survives
    } else {
      secs.forEach(([k, h], j) => {
        if (k === 'texto' || E.pHtml[k] === h) return;
        const tpl = document.createElement('div'); tpl.innerHTML = h; p.children[j].replaceWith(tpl.firstElementChild);
      });
      const ct = p.querySelector('#dz-f-cont'); if (ct) ct.placeholder = str((E.raw.final || {}).contacto);   // the kit's contact, in place
    }
    E.pSlide = sl; E.pTipo = sl.tipo; E.pHtml = Object.fromEntries(secs);
    p.scrollTop = top;
    if (key && !(ae && ae.isConnected)) refocus(p, key);
    edDecision();
  }
  // what «Auto» decided for the selected slide (after each render)
  function edDecision() {
    if (!E) return; const sl = D().slides[E.sel], ov = sl.ov || {}, r = E.last[E.sel], dec = r && r.decision;
    const set = (k, t) => { const x = E.el.querySelector(`.dz-dec[data-dec="${k}"]`); if (x) x.textContent = t; };
    set('lugar', !ov.lugar && dec && dec.lugar ? '· auto: ' + dec.lugar : '');
    set('alinear', !ov.alinear && dec && dec.alinear ? '· auto: ' + dec.alinear : '');
    set('color', !ov.color && dec && dec.color ? '· auto: ' + String(dec.color).replace(/_/g, ' ') : '');
    set('velo', ov.velo == null && dec ? '· auto: ' + Math.round((+dec.velo || 0) * 100) + ' %' : '');
    if (ov.velo == null && dec) { const rg = E.el.querySelector('.dz-velor'), o = E.el.querySelector('.dz-velov'); if (rg && document.activeElement !== rg) rg.value = +dec.velo || 0; if (o) o.textContent = Math.round((+dec.velo || 0) * 100) + ' %'; }
    const ul = E.el.querySelector('.dz-av'), src = effSrc(sl, E.fin);
    const off = avGet(curSlot(), E.sel, avKey(curSlot(), E.sel, E.rawHash, E.sz, E.fin));   // the ones estado()/aplicar() give
    const av = [...slideAvisos(sl, src), ...(src && M.files[src] ? (off ? off.avisos : r && r.avisos) || [] : [])];   // the same list as estado()
    const html = av.map(a => `<li>${esc(a)}</li>`).join('');
    if (ul.innerHTML !== html) { ul.innerHTML = html; fitCanvas(); }
  }

  // ---------- drawing (rAF; photo layer cached; only dibujar on edits) ----------
  function dirty(what) {
    if (!E) return;
    const n = D().slides.length;
    if (what === 'all') for (let i = 0; i < n; i++) E.need.add(i);
    else if (what === 'sel' || what == null) E.need.add(E.sel);
    else [].concat(what).forEach(i => { if (Number.isInteger(i) && i >= 0 && i < n) E.need.add(i); });
    if (!E.raf) E.raf = requestAnimationFrame(frame);
  }
  function dirtySrc(src) { const d = D(); d.slides.forEach((sl, i) => { if (effSrc(sl, E.fin) === src) E.need.add(i); }); if (!E.raf) E.raf = requestAnimationFrame(frame); }
  // Photos are decoded at the size the preview needs (the crop drawn at W×H, rounded up to a step of √2, never above the
  // original), two at a time, and only a few are kept: the drawn photo layers (capas, W×H) are what the redraws use, so a
  // carousel of 20 photos of 24–33 MP no longer holds gigabytes of bitmaps. «Aplicar» still decodes each photo whole.
  const BM_KEEP = 4;              // decoded photos kept besides the selected slide's and the ones still to draw
  const needScale = (r, W) => { const n = Math.min(1, W / Math.max(1, r.w)); return n >= 1 ? 1 : Math.min(1, Math.pow(Math.SQRT2, Math.ceil(Math.log(n) / Math.log(Math.SQRT2) - 1e-9))); };
  function dropBitmap(src) { if (!E || !src) return; const b = E.bm.get(src); if (b && b.bmp) b.bmp.close(); E.bm.delete(src); for (const k of [...E.capas.keys()]) if (k.startsWith(src + '|')) E.capas.delete(k); }
  // the decoded photo for src at scale ≥ s if there is one; else a blurrier one meanwhile (or null), and it is asked for
  function bitmapNow(src, s, urgent) {
    let ent = E.bm.get(src);
    if (!ent) { ent = { t: 0, s: 0, want: 0 }; E.bm.set(src, ent); }
    ent.t = ++E.tick;
    if (ent.err) return false;
    if (ent.bmp && ent.s >= s - 1e-6) return ent.bmp;
    if (ent.want < s - 1e-6 || urgent) {
      ent.want = Math.max(ent.want, s);
      E.q = E.q.filter(x => x !== src); if (urgent) E.q.unshift(src); else E.q.push(src);
      pump();
    }
    return ent.bmp || null;
  }
  function pump() {
    const e0 = E;
    while (E && E.dec < 2 && E.q.length) {
      const src = E.q.shift(), ent = E.bm.get(src), f = M.files[src];
      if (!ent || ent.busy || !f || (ent.bmp && ent.s >= ent.want - 1e-6)) continue;
      const s = ent.want, o = s >= 1 ? { imageOrientation: 'from-image' }
        : { imageOrientation: 'from-image', resizeWidth: Math.max(1, Math.round(f.w * s)), resizeHeight: Math.max(1, Math.round(f.h * s)), resizeQuality: 'high' };
      ent.busy = true; E.dec++;
      I().getBlob(src).then(b => createImageBitmap(b, o))
        .then(b => {
          if (E !== e0 || E.bm.get(src) !== ent) { b.close(); return; }
          if (ent.bmp) ent.bmp.close();
          ent.bmp = b; ent.s = Math.min(1, s); ent.t = ++E.tick;   // the scale asked for (its pixel size is rounded: never compare that)
          trimBitmaps(); if (curSlot()) dirtySrc(src);
        })
        .catch(() => { if (E === e0 && E.bm.get(src) === ent && !ent.bmp) { ent.err = true; if (curSlot()) dirtySrc(src); } })
        .finally(() => {
          ent.busy = false; if (E !== e0) return;
          E.dec--;
          if (E.bm.get(src) === ent && !ent.err && ent.want > ent.s + 1e-6 && !E.q.includes(src)) E.q.push(src);
          pump();
        });
    }
  }
  // close the decoded photos nobody needs now (the selected slide's and the ones still to draw stay)
  function trimBitmaps() {
    if (!E || !curSlot()) return;
    const d = D(), keep = new Set([effSrc(d.slides[E.sel] || {}, E.fin)]);
    for (const i of E.need) if (d.slides[i]) keep.add(effSrc(d.slides[i], E.fin));
    const live = [...E.bm.entries()].filter(([, v]) => v.bmp);
    let n = live.length;
    for (const [k, v] of live.filter(([k, v]) => !v.busy && !keep.has(k)).sort((a, b) => a[1].t - b[1].t)) {
      if (n <= BM_KEEP) break;
      v.bmp.close(); E.bm.delete(k); n--;
    }
  }
  let PH = null;
  function placeholder() { if (!PH) { PH = document.createElement('canvas'); PH.width = 540; PH.height = 540; const x = PH.getContext('2d'); x.fillStyle = '#b9b4ab'; x.fillRect(0, 0, 540, 540); } return PH; }
  // draws slide i into ctx; null = its photo is still loading
  function drawSlide(i, ctx) {
    const s = curSlot(), d = s.design, sl = d.slides[i], src = effSrc(sl, E.fin), { W, H } = E.sz;
    let capa = null, key;
    if (src && M.files[src]) {
      const f = M.files[src], r = rectOf(src, W, H), sn = needScale(r, W);
      key = [src, W, H, r.x.toFixed(1), r.y.toFixed(1), r.w.toFixed(1), r.h.toFixed(1)].join('|');
      capa = E.capas.get(key);
      const bmp = !capa || capa.s < sn - 1e-6 || i === E.sel ? bitmapNow(src, sn, i === E.sel) : null;   // the selected slide's photo stays at hand (pan, zoom)
      if (bmp === false) { capa = null; key = null; }
      else if (bmp && (!capa || capa.s < Math.min(sn, E.bm.get(src).s) - 1e-6)) {        // first layer, or a sharper one
        const k = bmp.width / f.w;
        capa = ENG().capaFoto(bmp, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }, W, H);
        capa.s = E.bm.get(src).s; capa.origen = { w: r.w, h: r.h, bw: f.w, bh: f.h };   // the photo's own pixels, whatever the decoded size
      }
      else if (!capa) return null;
    }
    if (!key) { key = ['-', W, H].join('|'); capa = E.capas.get(key); if (!capa) { const ph = placeholder(); capa = ENG().capaFoto(ph, { x: 0, y: 0, w: ph.width, h: ph.height }, W, H); capa.s = 1; } }
    E.capas.delete(key); E.capas.set(key, capa);
    while (E.capas.size > d.slides.length + 3) E.capas.delete(E.capas.keys().next().value);
    if (ctx.canvas.width !== W || ctx.canvas.height !== H) { ctx.canvas.width = W; ctx.canvas.height = H; }
    const opts = { W, H, factor: E.sz.factor, pagina: pageOf(s, i), serie: str(d.serie) };
    const slide = slideAt(sl, E.sz);
    let res = ENG().dibujar(ctx, E.kit, capa, slide, opts);
    const adj = clampOv(sl, slide.ov, res, E.sz);
    if (adj) res = ENG().dibujar(ctx, E.kit, capa, { ...slide, ov: adj }, opts);
    res.ov = adj || slide.ov;          // where the block is drawn: a drag starts from there
    E.last[i] = res;
    return res;
  }
  // the warnings listed are the ones «Aplicar» will give: once the edit settles, the selected slide is checked with its
  // photo at full size (the preview draws a reduced copy, whose contrast can differ by hundredths)
  async function checkAvisos() {
    if (!E) return; const e0 = E, s = curSlot(); if (!s) return;
    const i = E.sel, sl = s.design.slides[i], src = effSrc(sl, E.fin);
    if (!src || !M.files[src] || avGet(s, i, avKey(s, i, E.rawHash, E.sz, E.fin))) return;
    try { await renderFull(s, i, E.kit, E.fin, E.sz, E.rawHash, true); } catch (e) { return; }
    if (E === e0 && curSlot() === s && E.sel === i) edDecision();
  }
  function toThumb(i, from) { const sl = D().slides[i], c = thumbOf(sl), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(from, 0, 0, c.width, c.height); }
  function frame() {
    if (!E) return;
    E.raf = 0;
    if (!curSlot()) { cerrar(); return; }
    const n = D().slides.length;
    for (const i of [...E.need]) if (!(Number.isInteger(i) && i >= 0 && i < n)) E.need.delete(i);
    let more = false;
    try {
      if (E.need.has(E.sel) && drawSlide(E.sel, E.ctx)) { E.need.delete(E.sel); toThumb(E.sel, E.cv); edDecision(); clearTimeout(E.avT); E.avT = setTimeout(checkAvisos, 600); }
      for (const j of [...E.need]) {                    // one other thumbnail per frame (the first whose photo is ready)
        if (j === E.sel || !drawSlide(j, E.offCtx)) continue;
        E.need.delete(j); toThumb(j, E.off); more = [...E.need].some(k => k !== E.sel); break;
      }
    } catch (e) { console.warn('diseño:', e); }
    trimBitmaps();
    if (more && !E.raf) E.raf = requestAnimationFrame(frame);
  }
  function fitCanvas() {
    if (!E) return;
    const mid = E.el.querySelector('.dz-mid'), foot = E.el.querySelector('.dz-foot');
    const aw = Math.max(120, mid.clientWidth - 32), ah = Math.max(120, mid.clientHeight - 32 - (foot ? foot.offsetHeight + 10 : 0));
    const k = Math.min(aw / E.sz.W, ah / E.sz.H);
    E.cv.style.width = Math.round(E.sz.W * k) + 'px'; E.cv.style.height = Math.round(E.sz.H * k) + 'px';
  }

  // ---------- editing ----------
  function touch(all) {         // the design changed: saved (debounced) through the mesa, header updated
    const s = curSlot(); if (!s) return;
    s.design.at = nowISO(); remember(s);
    clearTimeout(E.saveT); E.saveT = setTimeout(() => { if (E) E.saveT = 0; I().save(); }, 300);
    edHead();
    if (all) dirty('all');
  }
  // a drag in progress ends where it is (Escape, ↑/↓, closing, leaving the page): what is seen is what is saved
  // rule-of-thirds lines over the preview: only while the photo is being reframed (panning, and a moment after zoom or «Centrar»)
  function tercios(on) { const w = E && E.el.querySelector('.dz-cvw'); if (w) w.classList.toggle('reframe', !!on); }
  function flashTercios() {
    if (!E) return;
    tercios(true); clearTimeout(E.tercT);
    E.tercT = setTimeout(() => { if (E && !(E.drag && E.drag.mode === 'pan')) tercios(false); }, 1000);
  }
  function endDrag() {
    if (!E || !E.drag) return;
    if (E.drag.mode === 'pan') tercios(false);
    E.drag = null; E.cv.style.cursor = '';
    if (curSlot()) { touch(); edPanel(); }
  }
  function select(i) {
    if (E.drag) endDrag();
    const n = D().slides.length; i = Math.max(0, Math.min(n - 1, i));
    if (i === E.sel) return;
    E.sel = i; E.pickFinal = false;
    E.el.querySelectorAll('.dz-it').forEach((it, k) => it.classList.toggle('on', k === i));
    edPanel(); dirty('sel');
    const it = E.el.querySelectorAll('.dz-it')[i]; if (it && it.scrollIntoView) it.scrollIntoView({ block: 'nearest' });
  }
  function resizeIfNeeded() {   // a horizontal carousel follows its first photo
    const sz = sizeOf(E.kit, D(), E.fin);
    if (sz.W !== E.sz.W || sz.H !== E.sz.H) { E.sz = sz; edAll(); return true; }
    E.sz = sz; return false;
  }
  function setSrc(i, f) {
    const s = curSlot(), S = I().S, d = s.design, sl = d.slides[i], old = sl.src;
    if (old === f) return;
    const before = s.photos.slice(), fromTray = S.tray.includes(f);
    sl.src = f;
    if (fromTray) S.tray = S.tray.filter(x => x !== f);
    const { back } = release(s, [old]);                   // the replaced photo leaves the post when no slide uses it
    I().renderTray();
    touch();
    if (!resizeIfNeeded()) { edPanel(); dirty([i]); }
    if (!back.length) return;
    const after = s.photos.slice();
    I().toast('La foto anterior vuelve a la bandeja.', { action: 'Deshacer', ms: 6000, onAction: () => {
      // only while nothing else changed: the slide is still there with that photo (an old «Deshacer» never loses a photo)
      if (curSlot() !== s || I().S !== S || s.design !== d || !d.slides.includes(sl) || sl.src !== f || !I().same(s.photos, after) || !back.every(x => S.tray.includes(x))) { I().toast('No se puede deshacer: el diseño ha cambiado.'); return; }
      sl.src = old; S.tray = S.tray.filter(x => !back.includes(x)); if (fromTray && !S.tray.includes(f)) S.tray.unshift(f); s.photos = before;
      rescue([f, old]); I().renderTray(); touch();
      if (!resizeIfNeeded()) { edPanel(); dirty([d.slides.indexOf(sl)]); }
    } });
  }
  function setCropFor(src, patch) {   // the mesa's reframe of that photo (S.crops), clamped for this design's ratio
    const S = I().S, f = M.files[src]; if (!f) return;
    const st = I().baseCrop(src, S);
    const next = { fmt: st.fmt, cx: patch.cx ?? st.cx, cy: patch.cy ?? st.cy, z: Math.max(1, Math.min(3, patch.z ?? st.z ?? 1)) };
    const r = I().rectFor(f.w, f.h, E.sz.W / E.sz.H, next);
    next.cx = +((r.x + r.w / 2) / f.w).toFixed(4); next.cy = +((r.y + r.h / 2) / f.h).toFixed(4);
    S.crops = S.crops || {}; S.crops[src] = next;
    dirtySrc(src);
  }
  // the order the slides had, removed ones included (in their places): «Deshacer» puts a slide back where it was even
  // after other removals and their undos, in any order
  function refOrder() { const d = D(); if (!E.ref || E.refD !== d) { E.ref = d.slides.slice(); E.refD = d; } return E.ref; }
  function moveSlide(i, dir) {
    const d = D(), j = i + dir; if (j < 0 || j >= d.slides.length) return;
    [d.slides[i], d.slides[j]] = [d.slides[j], d.slides[i]];
    { const r = refOrder(), cur = d.slides.filter(x => r.includes(x)); let n = 0; E.ref = r.map(x => d.slides.includes(x) ? cur[n++] : x); }
    if (E.sel === i) E.sel = j; else if (E.sel === j) E.sel = i;
    const btn = dir < 0 ? 'up' : 'down', canAgain = dir < 0 ? j > 0 : j < d.slides.length - 1;   // the focus follows the slide
    touch(); if (!resizeIfNeeded()) { edList(`[data-dz="${canAgain ? btn : dir < 0 ? 'down' : 'up'}"][data-i="${j}"]`); edPanel(); edHead(); dirty('all'); }
  }
  function addSlide() {          // a new ficha after the selected slide (before it when it is the final)
    const d = D(); if (d.slides.length >= MAX_SLIDES) { I().toast(MAX_MSG); return; }
    const k = d.slides[E.sel].tipo === 'final' ? E.sel : E.sel + 1, r = refOrder(), nw = blankSlide('ficha', null), before = d.slides[k];
    d.slides.splice(k, 0, nw);
    r.splice(before ? r.indexOf(before) : r.length, 0, nw);
    E.sel = k;
    touch(); edList(d.slides.length >= MAX_SLIDES ? `.dz-it[data-i="${k}"]` : '[data-dz="add"]'); edPanel(); edHead(); dirty('all');
  }
  let DELN = 0;                  // each removal its own toast (two alike never merge: each keeps its «Deshacer»)
  function delSlide(i) {
    const s = curSlot(), d = s.design; if (d.slides.length < 2) return;
    const prevSl = d.slides[i - 1] || null, nextSl = d.slides[i + 1] || null;
    refOrder();
    const before = s.photos.slice(), [gone] = d.slides.splice(i, 1), srcAt = gone.src;
    if (E.sel >= d.slides.length) E.sel = d.slides.length - 1; else if (E.sel > i) E.sel--;
    const { back, gone: left } = release(s, [gone.src]), after = s.photos.slice(), m = d.slides.length;
    touch(); if (!resizeIfNeeded()) { edList(m > 1 ? `[data-dz="del"][data-i="${Math.min(i, m - 1)}"]` : `.dz-it[data-i="0"]`); edPanel(); edHead(); dirty('all'); }
    const slotId = s.id, B = I().S;
    const t0 = str(gone.titulo).trim().split('\n')[0], tt = t0 ? ` («${t0.length > 28 ? t0.slice(0, 27) + '…' : t0}»)` : '';
    I().toast(`Diapositiva ${i + 1}${tt} quitada${back.length ? '; su foto vuelve a la bandeja' : ''}.`, { key: 'dz-del-' + (++DELN), action: 'Deshacer', ms: 6000, onAction: () => {
      const s2 = curSlot();
      if (!s2 || s2.id !== slotId || I().S !== B || s2.design !== d || d.slides.includes(gone) || gone.src !== srcAt || d.slides.length >= MAX_SLIDES) { I().toast('No se puede deshacer: el diseño ha cambiado.'); return; }
      if (back.length) { B.tray = B.tray.filter(x => !back.includes(x)); I().renderTray(); }
      if (I().same(s2.photos, after)) s2.photos = before;
      else left.forEach(f => { if (!s2.photos.includes(f)) s2.photos.splice(Math.min(Math.max(0, before.indexOf(f)), s2.photos.length), 0, f); });
      const r = E.refD === d ? E.ref : null, at = r ? r.indexOf(gone) : -1;   // before the first slide that followed it, else after the last that preceded it
      let k = -1;
      if (at >= 0) { for (const y of r.slice(at + 1)) { const q = d.slides.indexOf(y); if (q >= 0) { k = q; break; } } if (k < 0) for (const y of r.slice(0, at).reverse()) { const q = d.slides.indexOf(y); if (q >= 0) { k = q + 1; break; } } }
      if (k < 0) { const pi = prevSl ? d.slides.indexOf(prevSl) : -1, ni = nextSl ? d.slides.indexOf(nextSl) : -1; k = pi >= 0 ? pi + 1 : ni >= 0 ? ni : Math.min(i, d.slides.length); }
      d.slides.splice(k, 0, gone); E.sel = k;
      rescue([...back, srcAt]);
      touch(); if (!resizeIfNeeded()) { edList(); edPanel(); edHead(); dirty('all'); }
    } });
  }

  function appliedMsg(r) {
    const n = r.archivos.length, k = r.avisos.length;
    return `Diseño aplicado: ${n === 1 ? 'la portada está' : `las ${n} imágenes están`} en la casilla.`
      + (k ? ` ${k === 1 ? 'Un aviso' : `${k} avisos`}: «${r.avisos[0]}»${k > 1 ? ' (todos, en la publicación)' : ''}.` : '') + (r.notas ? ' ' + r.notas.join(' ') : '');
  }
  async function edAplicar(btn) {
    if (!E || E.busy) return;
    const e0 = E;
    if (E.drag) endDrag();
    E.busy = true; btn.disabled = true; btn.textContent = 'Aplicando…';
    if (E.saveT) { clearTimeout(E.saveT); E.saveT = 0; I().save(); }
    let changedKit = false;
    try { const { raw } = await rawKit(E.cid, true); changedKit = E === e0 && kitHash(raw) !== E.rawHash; } catch (e) { /* aplicar() reports it */ }
    if (changedKit) {        // the kit file changed since the preview: show it first, never apply what Kevin has not seen
      btn.disabled = false; btn.textContent = 'Aplicar a la casilla';
      await edKitChanged(true);
      if (E === e0) E.busy = false;
      I().toast('El kit ha cambiado: revisa la vista previa y vuelve a aplicar.', { ms: 9000 });
      return;
    }
    let r = null, err = null;
    try { r = await aplicar(e0.slotId); } catch (e) { err = e; }
    btn.disabled = false; btn.textContent = 'Aplicar a la casilla';
    const msg = err ? (err instanceof DzError ? err.message : 'No se pudo aplicar el diseño: ' + String((err && err.message) || err)) : appliedMsg(r);
    if (err && !(err instanceof DzError)) console.warn('diseño:', err);
    if (E !== e0) { I().toast(msg, { ms: 9000 }); return; }   // closed meanwhile: aplicar() already refreshed the post view
    E.busy = false;
    if (err) { I().toast(msg); if (err.slide != null && curSlot()) select(err.slide); return; }
    cerrar();
    I().toast(msg, { ms: r.avisos.length ? 9000 : 4200 });
  }

  function wireEditor(el) {
    // the mesa's own handlers (on its root) never see what happens in the editor
    ['click', 'input', 'change', 'pointerdown', 'dblclick', 'dragstart', 'wheel'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
    el.addEventListener('click', e => {
      if (E && !curSlot()) { cerrar(); return; }
      const a = e.target.closest('[data-dz]'); if (!a || !E || a.disabled) return;
      if (E.drag) endDrag();
      const act = a.dataset.dz, s = curSlot(), d = s.design, i = E.sel, sl = d.slides[i];
      sl.ov = sl.ov || {};
      if (act === 'cerrar') cerrar();
      else if (act === 'aplicar') edAplicar(a);
      else if (act === 'sel') { if (!e.target.closest('.dz-mv')) select(+a.dataset.i); }
      else if (act === 'up' || act === 'down') moveSlide(+a.dataset.i, act === 'up' ? -1 : 1);
      else if (act === 'del') delSlide(+a.dataset.i);
      else if (act === 'add') addSlide();
      else if (act === 'fmt') {
        if (d.fmt !== a.dataset.v && FMTS[a.dataset.v]) { stampOffsets(d, E.sz.H); d.fmt = a.dataset.v; syncFmt(s); touch(); E.sz = sizeOf(E.kit, d, E.fin); edAll(); }
      }
      else if (act === 'tipo') {
        const v = a.dataset.v; if (v === sl.tipo) return;
        sl.tipo = v;
        touch(); E.pickFinal = false;
        if (!resizeIfNeeded()) { edList(); edPanel(); dirty('sel'); }
      }
      else if (act === 'src') setSrc(i, a.dataset.f);
      else if (act === 'centrar') { const src = effSrc(sl, E.fin); if (src) { flashTercios(); setCropFor(src, { cx: 0.5, cy: 0.5, z: 1 }); touch(); edPanel(); } }
      else if (act === 'otrafinal') { E.pickFinal = !E.pickFinal; edPanel(); }
      else if (act === 'setfinal') { const f = a.dataset.f; M.diseno.fijarFinal(E.cid, f).then(r => { if (r && r.error) I().toast(r.error); else I().toast('Foto final del cliente cambiada: se usa en todos sus carruseles.'); }); }
      else if (act === 'pickfile') { const inp = el.querySelector('.dz-file'); if (inp) inp.click(); }
      else if (act === 'esc') {
        const v = Math.round(Math.max(ESC_MIN, Math.min(ESC_MAX, (sl.ov.escala || 1) + (+a.dataset.v) * ESC_STEP)) * 100) / 100;
        if (v === 1) delete sl.ov.escala; else sl.ov.escala = v;
        touch(); edPanel(); dirty('sel');
      }
      else if (act === 'lugar' || act === 'alinear') {
        if (a.dataset.v) sl.ov[act] = a.dataset.v; else delete sl.ov[act];
        delete sl.ov.dx; delete sl.ov.dy; delete sl.ov.h;    // a new position starts from its own place
        touch(); edPanel(); dirty('sel');
      }
      else if (act === 'color') { if (a.dataset.v) sl.ov.color = a.dataset.v; else delete sl.ov.color; touch(); edPanel(); dirty('sel'); }
      else if (act === 'veloauto') { if (sl.ov.velo != null) { delete sl.ov.velo; touch(); edPanel(); dirty('sel'); } }
      else if (act === 'reset') {                            // everything back to automatic, the photo's reframe included
        sl.ov = {};
        const src = effSrc(sl, E.fin); if (hasCrop(src)) { delete I().S.crops[src]; dirtySrc(src); }
        touch(); edPanel(); dirty('sel');
      }
    });
    el.addEventListener('input', e => {
      if (!E || !curSlot()) return;
      const t = e.target, d = D(), sl = d.slides[E.sel];
      if (t.matches('[data-f]')) { sl[t.dataset.f] = t.dataset.f === 'contacto' && t.value === '' ? null : t.value; touch(); dirty('sel'); }
      else if (t.matches('.dz-serin')) { d.serie = t.value; touch(true); }
      else if (t.matches('.dz-zoomr')) { const src = effSrc(sl, E.fin); if (src) { flashTercios(); setCropFor(src, { z: +t.value }); touch(); const rs = el.querySelector('[data-dz="reset"]'); if (rs) rs.disabled = false; } }
      else if (t.matches('.dz-velor')) {
        sl.ov = sl.ov || {}; sl.ov.velo = Math.round(+t.value * 100) / 100;
        const o = el.querySelector('.dz-velov'); if (o) o.textContent = Math.round(sl.ov.velo * 100) + ' %';
        const b = el.querySelector('[data-dz="veloauto"]'); if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }
        const rs = el.querySelector('[data-dz="reset"]'); if (rs) rs.disabled = false;
        touch(); dirty('sel');
      }
    });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('.dz-file')) { const f = t.files && t.files[0]; t.value = ''; if (f && E) setFinalFile(f); }
    });
    // a photo file dropped on the final photo's box: becomes the client's final photo
    el.addEventListener('dragover', e => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      const z = e.target.closest && e.target.closest('.dz-drop');
      el.querySelectorAll('.dz-drop.over').forEach(x => { if (x !== z) x.classList.remove('over'); });
      if (z) { z.classList.add('over'); e.dataTransfer.dropEffect = 'copy'; } else e.dataTransfer.dropEffect = 'none';
    });
    el.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('.dz-drop'); if (z && !(e.relatedTarget && z.contains(e.relatedTarget))) z.classList.remove('over'); });
    el.addEventListener('drop', e => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      el.querySelectorAll('.dz-drop.over').forEach(x => x.classList.remove('over'));
      const z = e.target.closest && e.target.closest('.dz-drop'), f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (z && f) setFinalFile(f); else I().toast('Para añadir fotos a la mesa, cierra el diseñador y suéltalas en la bandeja.');
    });
    // preview: drag the text block to move it, the photo to reframe it
    const cv = el.querySelector('.dz-cv');
    const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * E.sz.W / r.width, y: (e.clientY - r.top) * E.sz.H / r.height, k: E.sz.W / r.width }; };
    const inBlock = p => { const r = E.last[E.sel], b = r && r.bloque, pad = 18; return !!b && p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad; };
    const canPan = src => { if (!src || !M.files[src]) return false; const f = M.files[src], r = rectOf(src, E.sz.W, E.sz.H); return r.w < f.w - 1 || r.h < f.h - 1; };
    cv.addEventListener('pointermove', e => {
      if (!E || E.drag || !curSlot()) return;
      const src = effSrc(D().slides[E.sel], E.fin);
      cv.style.cursor = inBlock(at(e)) ? 'move' : canPan(src) ? 'grab' : 'default';
    });
    cv.addEventListener('pointerdown', e => {
      if (!E || e.button !== 0) return;
      if (!curSlot()) { cerrar(); return; }
      const p0 = at(e), sl = D().slides[E.sel], src = effSrc(sl, E.fin);
      let g;
      if (inBlock(p0)) { sl.ov = sl.ov || {}; const L = E.last[E.sel], b = L.bloque, dx = (L.ov && L.ov.dx) || 0, dy = (L.ov && L.ov.dy) || 0; g = { mode: 'text', sl, dx, dy, bx: b.x - dx, by: b.y - dy, bw: b.w, bh: b.h }; }
      else if (src && M.files[src]) { const f = M.files[src], r0 = rectOf(src, E.sz.W, E.sz.H); g = { mode: 'pan', sl, src, cx: (r0.x + r0.w / 2) / f.w, cy: (r0.y + r0.h / 2) / f.h, fw: r0.w / f.w, fh: r0.h / f.h }; }
      else return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
      E.drag = g; cv.style.cursor = g.mode === 'text' ? 'move' : 'grabbing';
      if (g.mode === 'pan') { clearTimeout(E.tercT); tercios(true); }
      const mv = ev => {
        if (!E || E.drag !== g) return;
        const p = at(ev);
        if (g.mode === 'text') {
          const v = sl.ov; v.dx = Math.round(lim(g.dx + p.x - p0.x, g.bx, g.bw, E.sz.W)); v.dy = Math.round(lim(g.dy + p.y - p0.y, g.by, g.bh, E.sz.H)); v.h = E.sz.H;
          if (!v.dx) delete v.dx; if (!v.dy) delete v.dy; if (!v.dx && !v.dy) delete v.h; dirty('sel');
        }
        else setCropFor(g.src, { cx: g.cx - (p.x - p0.x) / E.sz.W * g.fw, cy: g.cy - (p.y - p0.y) / E.sz.H * g.fh });
      };
      const up = () => {
        cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
        if (E && E.drag === g) endDrag();
      };
      cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    });
  }
  async function setFinalFile(f) {
    if (!E) return;
    try { await fijarFinalArchivo(E.cid, f); I().toast('Foto final del cliente cambiada: se usa en todos sus carruseles.'); }
    catch (e) { I().toast(e instanceof DzError ? e.message : 'No se pudo leer esa foto.'); }
  }

  // keyboard: captured while the editor is open, so the mesa's Escape / arrows / ⌘Z don't fire under it
  function onKey(e) {
    if (!E) { window.removeEventListener('keydown', onKey, true); return; }
    if (!E.el.isConnected || !curSlot()) { cerrar(); return; }
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    const t = e.target, typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'button'));
    if (!typing && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !(t && t.closest && t.closest('.seg'))) { e.preventDefault(); select(E.sel + (e.key === 'ArrowUp' ? -1 : 1)); }
    else if (!typing && t && t.classList && t.classList.contains('dz-it') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+t.dataset.i); }   // ▲ ▼ × inside work as buttons
  }

  function cerrar() {
    if (!E) return { ok: true };
    if (E.drag && curSlot()) endDrag();
    const e = E; E = null;
    window.removeEventListener('keydown', onKey, true);
    if (e.raf) cancelAnimationFrame(e.raf);
    clearTimeout(e.avT); clearTimeout(e.tercT);
    if (e.ro) e.ro.disconnect();
    const S = I() && I().S;
    if (e.saveT) { clearTimeout(e.saveT); if (S === e.board) I().save(); }
    for (const b of e.bm.values()) if (b.bmp) b.bmp.close();
    for (const c of e.capas.values()) if (c && c.canvas) c.canvas.width = c.canvas.height = 0;
    e.bm.clear(); e.capas.clear(); e.q = [];
    e.off.width = e.off.height = 0;
    // every canvas freed and the editor's tree cut: whichever way it closed («Cerrar», Esc, Claude), nothing of it stays
    // reachable from a node the browser still holds (the pressed button, the last focus)
    if (e.el) {
      const all = [...e.el.querySelectorAll('*')];
      all.forEach(n => { if (n.tagName === 'CANVAS') n.width = n.height = 0; });
      e.el.remove(); all.forEach(n => n.remove());               // each node on its own: one still held (a handle, DevTools) keeps nothing else
    }
    (e.inert || []).forEach(c => c.removeAttribute('inert'));
    if (I() && S === e.board) {
      I().refreshDetail(); I().renderFeed();
      const b = I().root() && I().root().querySelector('.detail [data-act="disenar"]'); if (b) b.focus({ preventScroll: true });   // back where the editor was opened
    }
    return { ok: true };
  }
  // the page is being hidden or left: the edit in flight is saved now (the mesa then writes it synchronously)
  function volcar() {
    if (!E) return;
    if (E.drag && curSlot()) endDrag();
    if (E.saveT) { clearTimeout(E.saveT); E.saveT = 0; if (I().S === E.board) I().save(); }
  }

  // called by the mesa on every render: an editor whose board or post is gone closes; the kits of the board's designs
  // are read once so the post view and the upload plan can tell an up-to-date design synchronously
  function sync() {
    if (E && (!E.el.isConnected || !curSlot())) cerrar();
    const S = I() && I().S; if (!S) return;
    for (const s of S.slots) {
      const cid = s.design && s.design.kit;
      if (cid && BASEV[cid] === undefined && !BASE[cid]) baseKit(cid).then(k => { if (k && I()) I().refreshDetail(); }).catch(() => {});
    }
  }

  M.diseno = {
    version: VERSION,
    cargar: api(cargar), estado: api(estado), aplicar: api(aplicar), ver: api(ver),
    kit: api(kit), ajustarKit: api(ajustarKit), fijarFinal: api(fijarFinal),
    abrir, cerrar, estadoDe, prepararKits, sync, volcar, aplicando: () => APL > 0, _retipo: retipo, _sustituir: sustituir,
    abierto: () => E ? { slot: E.slotId, diapositiva: E.sel + 1, W: E.sz.W, H: E.sz.H, bloque: (E.last[E.sel] || {}).bloque || null, decision: (E.last[E.sel] || {}).decision || null } : null
  };
  // loaded after the mesa opened a board (async script): its designs are checked now and the views say so
  { const S = I() && I().S; if (S && S.slots.some(s => s.design)) prepararKits(S).then(() => { if (I() && I().S === S) { I().render(); I().refreshDetail(); } }).catch(() => {}); }
})();
