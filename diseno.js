// Diseñador de carruseles y portadas de reel — Mesa de feed · v1.0
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
  const VERSION = '1.0';
  const FMTS = { v45: '4:5', v34: '3:4', h: 'Horizontal' };
  const TIPOS_CAR = ['portada', 'ficha', 'final'];
  const TIPO_LABEL = { portada: 'Portada', ficha: 'Ficha', final: 'Final', reel: 'Portada de reel' };
  const ESC_MIN = 0.6, ESC_MAX = 1.6, ESC_STEP = 0.05;
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

  // ---------- kit: kits/<clientId>.json + the client's override (client record field `kit`) ----------
  const BASE = {};                             // clientId -> Promise<base kit JSON | null>
  const kitUrl = cid => new URL('kits/' + encodeURIComponent(cid) + '.json', location.href).href;
  const BASEV = {};                            // clientId -> base kit once fetched (null = none), for the synchronous checks
  async function baseKit(cid) {
    if (!BASE[cid]) BASE[cid] = fetch(kitUrl(cid), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
    const k = await BASE[cid]; if (!k) delete BASE[cid];
    BASEV[cid] = k || null;
    return k;
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
  async function rawKit(cid) {
    const base = await baseKit(cid);
    need(base, `Este cliente aún no tiene kit de diseño (kits/${cid}.json).`);
    const c = await I().idbGet('clients', cid);
    const ov = (c && c.kit) || {};
    return { raw: deepMerge(base, ov), ov, base, c };
  }
  const ENGK = {};                             // clientId -> {key, kit: Promise} (fonts loaded once per kit)
  async function engineKit(cid) {
    const E0 = ENG(); need(E0 && E0.usarKit && E0.dibujar, NO_ENGINE);
    const r = await rawKit(cid), key = JSON.stringify(r.raw);
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
    if (BASEV[cid] === undefined && !BASE[cid]) baseKit(cid);
    return BASEV[cid] ? { raw: deepMerge(BASEV[cid], ov), partial: false } : { raw: deepMerge({}, ov), partial: true };
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
  const AV = {};                               // 'slotId:i' -> {avisos, decision} of the latest render

  // full-size render of slide i (aplicar, ver)
  async function renderFull(s, i, kit, fin, sz) {
    const d = s.design, sl = d.slides[i], src = effSrc(sl, fin), f = M.files[src];
    let blob0;
    try { blob0 = await I().getBlob(src); } catch (e) { throw new DzError(`La foto de la diapositiva ${i + 1} ya no está en la mesa: elige otra en «Diseñar».`); }
    const bmp = await createImageBitmap(blob0, { imageOrientation: 'from-image' });
    try {
      const r = rectOf(src, sz.W, sz.H), k = bmp.width / f.w;
      const res = await ENG().render(kit, slideFor(sl), bmp, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }, { fmt: d.fmt, pagina: pageOf(s, i), serie: str(d.serie), srcW: sz.sw, srcH: sz.sh });
      const blob = await ENG().aBlob(res.canvas, 0.92);
      const out = { blob, w: res.canvas.width, h: res.canvas.height, decision: res.decision, bloque: res.bloque, avisos: res.avisos || [] };
      res.canvas.width = res.canvas.height = 0;
      AV[s.id + ':' + i] = { avisos: out.avisos, decision: out.decision };
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
    release(s, old.slice(slides.length).map(x => x.src));
    remember(s);
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
    const aplicado = isApplied(s), used = new Set(srcsOf(s));
    return {
      slot: s.id, nombre: s.name, tipo: s.type, kit: d.kit, fmt: d.fmt, serie: d.serie,
      aplicado, desactualizado: aplicado && !!raw && d.sig !== sigOf(s, raw),
      fotoFinal: fin ? nameOf(fin) : null,
      slides: d.slides.map((sl, i) => {
        const src = effSrc(sl, fin), last = AV[s.id + ':' + i];
        const av = [...(!src || !M.files[src] ? [sl.tipo === 'final' ? 'Falta la foto final del cliente' : 'Falta la foto'] : []), ...(!str(sl.titulo).trim() ? ['Sin título'] : []), ...((last && last.avisos) || [])];
        return { n: i + 1, tipo: sl.tipo, titulo: sl.titulo, texto: sl.texto, entradilla: sl.entradilla, contacto: sl.contacto ?? null,
          ...(sl.tipo === 'final' ? { contactoUsado: sl.contacto ?? (raw && raw.final ? raw.final.contacto ?? null : null) } : {}), src: src || null, foto: src ? nameOf(src) : null, ov: clone(sl.ov || {}), avisos: av };
      }),
      fotosSinUsar: rawPhotos(s).filter(f => !used.has(f)).map(f => ({ fileId: f, name: nameOf(f) })),
      archivos: outsOf(s).map(f => ({ fileId: f, name: nameOf(f), enCasilla: s.photos.includes(f) }))
    };
  }

  // Renders every slide at full size into new design files and puts them in the slot (reel: the cover).
  async function aplicar(slotId) {
    const s = slotOf(slotId), S = I().S;
    need(!I().locked, LOCKED);
    need(!I().uploadsBusy(), 'Espera a que termine la subida a Notion.');
    need(s.design && s.design.slides.length, NO_DESIGN);
    const d = s.design, reel = isReelS(s);
    const { kit, raw } = await engineKit(d.kit);
    const fin = await finalReady(raw);
    await I().loadThumbs(srcsOf(s));
    checkPhotos(s, fin);
    const sz = sizeOf(kit, d, fin), sig = sigOf(s, raw), done = [], avisos = [];   // sig first: an edit made while rendering stays «sin aplicar»
    for (let i = 0; i < d.slides.length; i++) {
      const r = await renderFull(s, i, kit, fin, sz);
      done.push(r); r.avisos.forEach(a => avisos.push(`Diapositiva ${i + 1}: ${a}`));
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
    if (unused.length) { S.tray.unshift(...unused.filter(f => !S.tray.includes(f))); avisos.push(`${unused.length === 1 ? 'Una foto de la casilla no se usa en el diseño: vuelve' : `${unused.length} fotos de la casilla no se usan en el diseño: vuelven`} a la bandeja.`); }
    s.photos = outs.slice();
    if (!reel) s.fmt = d.fmt;
    d.out = outs; d.sig = sig; d.outAt = nowISO(); remember(s);
    I().changed();
    for (const f of old) { try { await I().deleteIfUnused(f); } catch (e) { /* kept */ } }
    if (E && E.slotId === slotId) edHead();
    return { ok: true, archivos: outs.map(f => ({ fileId: f, name: M.files[f].name, w: M.files[f].w, h: M.files[f].h, kb: Math.round(M.files[f].size / 1024) })), avisos };
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
    const r = await renderFull(s, i, kit, fin, sizeOf(kit, d, fin));
    M.out.diseno = r.blob;
    return { n: i + 1, w: r.w, h: r.h, kb: Math.round(r.blob.size / 1024), decision: r.decision, bloque: r.bloque, avisos: r.avisos };
  }

  async function kit(clientId) { need(I(), 'La mesa no tiene el puente del diseñador: actualiza mesa.js (3.18 o posterior).'); const S = I().S; const cid = clientId || (S && S.client); need(cid, 'Indica el cliente.'); return clone((await rawKit(cid)).raw); }

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
@media (max-width:900px){#mesa .dz-body{grid-template-columns:96px minmax(0,1fr);grid-template-rows:minmax(220px,52%) minmax(0,1fr)}#mesa .dz-panel{grid-column:1/-1;border-left:0;border-top:1px solid var(--line2)}#mesa .dz-mid{padding:10px}#mesa .dz-list{grid-row:1;padding:10px 8px}#mesa .dz-add{font-size:11.5px;padding:5px 2px;white-space:nowrap}#mesa .dz-serie .dz-in{width:140px}#mesa .dz-n{flex-wrap:wrap}#mesa .dz-mv{margin-left:-4px;width:100%}}`;
  function injectCSS() { if (document.getElementById('dz-css')) return; const st = document.createElement('style'); st.id = 'dz-css'; st.textContent = CSS; document.head.append(st); }

  let E = null;     // the open editor: {slotId, board, cid, kit, raw, fin, sel, sz, el, cv, ctx, off, need, last, thumbs, bm, capas, raf, saveT, …}
  const curSlot = () => { if (!E) return null; const S = I() && I().S, s = S && S === E.board ? S.slots.find(x => x.id === E.slotId) : null; return s && s.design && (I().isCarousel(s.type) || I().isReel(s.type)) ? s : null; };
  const D = () => curSlot().design;

  // a new design from the slot's photos (first «Diseñar» without texts from Claude)
  function newDesign(s, cid) {
    const reel = isReelS(s), raw = rawPhotos(s);
    const slides = reel ? [blankSlide('reel', raw[0])] : (raw.length ? raw : [null]).map((f, i) => blankSlide(i === 0 ? 'portada' : 'ficha', f));
    return { v: 1, kit: cid, fmt: reel ? 'r916' : FMTS[s.fmt] ? s.fmt : 'v45', serie: '', slides, out: null, sig: null, at: nowISO(), known: raw };
  }
  // photos put in the post since the design last saw it: they fill slides without a photo, then become new fichas
  // (before a final); returns the message for Kevin (null = nothing new)
  function absorb(s) {
    const d = s.design, used = new Set(srcsOf(s)), known = new Set(d.known || []);
    const extra = rawPhotos(s).filter(f => !used.has(f) && !known.has(f));
    if (!extra.length) return null;
    if (isReelS(s)) { const old = d.slides[0].src; d.slides[0].src = extra[0]; release(s, [old]); return 'La portada del reel usa la foto nueva de la casilla.'; }
    let filled = 0;
    for (const sl of d.slides) if (!sl.src && sl.tipo !== 'final' && extra.length) { sl.src = extra.shift(); filled++; }
    const k = d.slides.length && d.slides[d.slides.length - 1].tipo === 'final' ? d.slides.length - 1 : d.slides.length;
    d.slides.splice(k, 0, ...extra.map(f => blankSlide('ficha', f)));
    const n = extra.length;
    return [n && `Añadida${n === 1 ? '' : 's'} ${n} diapositiva${n === 1 ? '' : 's'} con fotos nuevas de la casilla.`,
      filled && `${filled === 1 ? 'Una foto nueva de la casilla va en una diapositiva' : `${filled} fotos nuevas de la casilla van en diapositivas`} que no tenía${filled === 1 ? '' : 'n'} foto.`].filter(Boolean).join(' ');
  }

  async function abrir(slotId) {
    try {
      const s = slotOf(slotId), S = I().S;
      need(!I().locked, LOCKED);
      if (E) cerrar();
      const cid = (s.design && s.design.kit) || S.client;
      const { kit, raw } = await engineKit(cid);
      need(I().S === S && S.slots.includes(s), 'La mesa cambió: vuelve a pulsar «Diseñar».');
      let changedNow = false, msg = null;
      if (!s.design) { s.design = newDesign(s, cid); changedNow = true; }
      else if ((msg = absorb(s))) { remember(s); changedNow = true; }
      const fin = await finalReady(raw);
      await I().loadThumbs(srcsOf(s));
      if (E) cerrar();
      injectCSS();
      E = { slotId, board: S, cid, kit, raw, fin, sel: 0, need: new Set(), last: [], thumbs: new WeakMap(), bm: new Map(), capas: new Map(), raf: 0, saveT: 0, pickFinal: false, busy: false };
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
        + `<label class="dz-serie">Nombre del carrusel <input type="text" class="dz-in dz-serin" maxlength="60" placeholder="Ej.: POR QUÉ FILIPINAS" value="${esc(d.serie)}"></label>`)
      + '<span class="dz-state" aria-live="polite"></span><button type="button" class="btn2" data-dz="cerrar">Cerrar</button><button type="button" class="btn" data-dz="aplicar">Aplicar a la casilla</button></header>'
      + '<div class="dz-body"><nav class="dz-list" aria-label="Diapositivas"></nav>'
      + '<section class="dz-mid"><canvas class="dz-cv" aria-label="Vista previa"></canvas><div class="dz-foot"><ul class="dz-av"></ul><p class="dz-hint">Arrastra el texto para moverlo · arrastra la foto para reencuadrarla</p></div></section>'
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
  function edAll() {
    if (!E) return;
    const d = D(); E.sel = Math.max(0, Math.min(d.slides.length - 1, E.sel));
    E.cv.width = E.sz.W; E.cv.height = E.sz.H;
    E.capas.clear(); E.last = [];
    edHead(); edList(); edPanel(); fitCanvas();
    dirty('all');
  }
  function edReload() {        // the design was replaced from outside (cargar)
    if (!E) return; const s = curSlot(); if (!s) { cerrar(); return; }
    I().loadThumbs(srcsOf(s)).then(() => { if (!E) return; E.sz = sizeOf(E.kit, s.design, E.fin); edAll(); });
  }
  async function edKitChanged(finalToo) {
    if (!E) return;
    const e0 = E;
    try {
      const { kit, raw } = await engineKit(E.cid);
      if (E !== e0) return;
      E.kit = kit; E.raw = raw;
      if (finalToo) { const old = E.fin; E.fin = await finalReady(raw); if (E !== e0) return; dropBitmap(old); dropBitmap(E.fin); E.pickFinal = false; }
      E.sz = sizeOf(E.kit, D(), E.fin); edAll();
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

  // left: one live thumbnail per slide
  function thumbOf(sl) {
    let c = E.thumbs.get(sl);
    const tw = 216, th = Math.round(tw * E.sz.H / E.sz.W);
    if (!c || c.width !== tw || c.height !== th) { c = document.createElement('canvas'); c.width = tw; c.height = th; E.thumbs.set(sl, c); }
    return c;
  }
  function edList() {
    const d = D(), reel = isReelS(curSlot()), n = d.slides.length, list = E.el.querySelector('.dz-list');
    list.innerHTML = d.slides.map((sl, i) => `<div class="dz-it${i === E.sel ? ' on' : ''}" data-dz="sel" data-i="${i}" role="button" tabindex="0" aria-label="Diapositiva ${i + 1}: ${TIPO_LABEL[sl.tipo] || sl.tipo}"><span class="dz-cvs"></span>`
      + `<div class="dz-n"><b>${pad2(i + 1)}</b>${esc(TIPO_LABEL[sl.tipo] || sl.tipo)}${reel ? '' : `<span class="dz-mv"><button type="button" data-dz="up" data-i="${i}" title="Subir" aria-label="Subir la diapositiva ${i + 1}" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-dz="down" data-i="${i}" title="Bajar" aria-label="Bajar la diapositiva ${i + 1}" ${i === n - 1 ? 'disabled' : ''}>▼</button><button type="button" data-dz="del" data-i="${i}" title="Quitar" aria-label="Quitar la diapositiva ${i + 1}" ${n < 2 ? 'disabled' : ''}>×</button></span>`}</div></div>`).join('')
      + (reel ? '' : '<button type="button" class="btn2 dz-add" data-dz="add">+ Diapositiva</button>');
    list.querySelectorAll('.dz-cvs').forEach((sp, i) => sp.replaceWith(thumbOf(d.slides[i])));
  }

  // right: the selected slide's controls
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
  function edPanel() {
    const s = curSlot(), d = s.design, i = E.sel, sl = d.slides[i], ov = sl.ov || {}, reel = isReelS(s);
    const e = ov.escala || 1, va = ov.velo == null, last = E.last[i];
    let h = `<div class="dz-sec"><h4>Diseño <span>· diapositiva ${pad2(i + 1)}</span></h4>`
      + (reel ? '<p class="dz-p">Portada de reel <span class="muted">· 9:16; en el perfil se ve el centro 3:4</span></p>' : segHTML('tipo', [['portada', 'Portada'], ['ficha', 'Ficha'], ['final', 'Final']], sl.tipo, 'Diseño de la diapositiva')) + '</div>';
    h += `<div class="dz-sec"><h4>Foto</h4>${fotoHTML(s, sl)}</div>`;
    h += `<div class="dz-sec"><h4>Texto</h4><label class="dz-l" for="dz-f-titulo">Título <span>· Intro = salto de línea</span></label><textarea id="dz-f-titulo" class="dz-in" data-f="titulo" rows="2">${esc(sl.titulo)}</textarea>`
      + (sl.tipo === 'ficha' ? `<label class="dz-l" for="dz-f-texto">Texto</label><textarea id="dz-f-texto" class="dz-in" data-f="texto" rows="3">${esc(sl.texto)}</textarea>` : '')
      + (sl.tipo === 'final' ? `<label class="dz-l" for="dz-f-entr">Entradilla</label><textarea id="dz-f-entr" class="dz-in" data-f="entradilla" rows="2">${esc(sl.entradilla)}</textarea><label class="dz-l" for="dz-f-cont">Contacto <span>· vacío = el del kit</span></label><input type="text" id="dz-f-cont" class="dz-in" data-f="contacto" value="${esc(sl.contacto ?? '')}" placeholder="${esc((E.raw.final || {}).contacto || '')}">` : '') + '</div>';
    h += `<div class="dz-sec"><h4>Tamaño del texto</h4><div class="dz-size"><button type="button" class="btn2" data-dz="esc" data-v="-1" aria-label="Texto más pequeño" ${e <= ESC_MIN + 1e-6 ? 'disabled' : ''}>A−</button><output>${Math.round(e * 100)} %</output><button type="button" class="btn2" data-dz="esc" data-v="1" aria-label="Texto más grande" ${e >= ESC_MAX - 1e-6 ? 'disabled' : ''}>A+</button></div></div>`;
    h += `<div class="dz-sec"><h4>Posición <span class="dz-dec" data-dec="lugar"></span></h4>${segHTML('lugar', [['', 'Auto'], ['arriba', 'Arriba'], ['abajo', 'Abajo'], ['centro', 'Centro']], ov.lugar || '', 'Posición del texto')}`
      + `<label class="dz-l">Alineación <span class="dz-dec" data-dec="alinear"></span></label>${segHTML('alinear', [['', 'Auto'], ['izquierda', 'Izquierda'], ['centro', 'Centro'], ['derecha', 'Derecha']], ov.alinear || '', 'Alineación del texto')}</div>`;
    h += `<div class="dz-sec"><h4>Color del texto <span class="dz-dec" data-dec="color"></span></h4><div class="dz-sws"><button type="button" class="dz-auto${ov.color ? '' : ' on'}" data-dz="color" data-v="" aria-pressed="${!ov.color}">Auto</button>`
      + Object.entries(E.raw.colores || {}).map(([k, c]) => `<button type="button" class="dz-sw${ov.color === k ? ' on' : ''}" data-dz="color" data-v="${esc(k)}" style="background:${esc(c)}" title="${esc(k.replace(/_/g, ' '))}" aria-label="${esc(k.replace(/_/g, ' '))}" aria-pressed="${ov.color === k}"></button>`).join('') + '</div></div>';
    const vv = va ? (last && last.decision ? +last.decision.velo || 0 : 0) : ov.velo;
    h += `<div class="dz-sec"><h4>Velo <span class="dz-dec" data-dec="velo"></span></h4><div class="dz-velo"><button type="button" class="dz-auto${va ? ' on' : ''}" data-dz="veloauto" aria-pressed="${va}">Auto</button><input type="range" class="dz-velor" min="0" max="0.9" step="0.05" value="${vv}" aria-label="Opacidad del velo"><output class="dz-velov">${Math.round(vv * 100)} %</output></div></div>`;
    h += `<div class="dz-sec"><button type="button" class="btn2" data-dz="reset" ${Object.keys(ov).length ? '' : 'disabled'}>Restablecer ajustes</button></div>`;
    const p = E.el.querySelector('.dz-panel'), top = p.scrollTop;
    p.innerHTML = h; p.scrollTop = top;
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
    const av = [...(!src || !M.files[src] ? [sl.tipo === 'final' ? 'Falta la foto final del cliente.' : 'Falta la foto de esta diapositiva.'] : []), ...((r && r.avisos) || [])];
    const html = av.map(a => `<li>${esc(a)}</li>`).join('');
    if (ul.innerHTML !== html) { ul.innerHTML = html; fitCanvas(); }
  }

  // ---------- drawing (rAF; photo layer cached; only dibujar on edits) ----------
  function dirty(what) {
    if (!E) return;
    const n = D().slides.length;
    if (what === 'all') for (let i = 0; i < n; i++) E.need.add(i);
    else if (what === 'sel' || what == null) E.need.add(E.sel);
    else [].concat(what).forEach(i => E.need.add(i));
    if (!E.raf) E.raf = requestAnimationFrame(frame);
  }
  function dirtySrc(src) { const d = D(); d.slides.forEach((sl, i) => { if (effSrc(sl, E.fin) === src) E.need.add(i); }); if (!E.raf) E.raf = requestAnimationFrame(frame); }
  function dropBitmap(src) { if (!E || !src) return; const b = E.bm.get(src); if (b && b.bmp) b.bmp.close(); E.bm.delete(src); for (const k of [...E.capas.keys()]) if (k.startsWith(src + '|')) E.capas.delete(k); }
  function bitmapNow(src) {
    const c = E.bm.get(src);
    if (c) return c.bmp || (c.err ? false : null);
    const ent = {}, e0 = E; E.bm.set(src, ent);
    I().getBlob(src).then(b => createImageBitmap(b, { imageOrientation: 'from-image' }))
      .then(b => { if (E !== e0 || E.bm.get(src) !== ent) { b.close(); return; } ent.bmp = b; dirtySrc(src); })
      .catch(() => { ent.err = true; if (E === e0) dirtySrc(src); });
    return null;
  }
  let PH = null;
  function placeholder() { if (!PH) { PH = document.createElement('canvas'); PH.width = 540; PH.height = 540; const x = PH.getContext('2d'); x.fillStyle = '#b9b4ab'; x.fillRect(0, 0, 540, 540); } return PH; }
  // draws slide i into ctx; null = its photo is still loading
  function drawSlide(i, ctx) {
    const s = curSlot(), d = s.design, sl = d.slides[i], src = effSrc(sl, E.fin), { W, H } = E.sz;
    let bmp = null, rect, key;
    if (src && M.files[src]) bmp = bitmapNow(src);
    if (bmp === null && src && M.files[src]) return null;
    if (bmp) {
      const f = M.files[src], r = rectOf(src, W, H), k = bmp.width / f.w;
      rect = { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
      key = [src, W, H, rect.x.toFixed(1), rect.y.toFixed(1), rect.w.toFixed(1), rect.h.toFixed(1)].join('|');
    } else { bmp = placeholder(); rect = { x: 0, y: 0, w: bmp.width, h: bmp.height }; key = ['-', W, H].join('|'); }
    let capa = E.capas.get(key);
    if (!capa) { capa = ENG().capaFoto(bmp, rect, W, H); E.capas.set(key, capa); while (E.capas.size > d.slides.length + 3) E.capas.delete(E.capas.keys().next().value); }
    else { E.capas.delete(key); E.capas.set(key, capa); }
    if (ctx.canvas.width !== W || ctx.canvas.height !== H) { ctx.canvas.width = W; ctx.canvas.height = H; }
    const res = ENG().dibujar(ctx, E.kit, capa, slideFor(sl), { W, H, factor: E.sz.factor, pagina: pageOf(s, i), serie: str(d.serie) });
    E.last[i] = res;
    AV[s.id + ':' + i] = { avisos: res.avisos || [], decision: res.decision };
    return res;
  }
  function toThumb(i, from) { const sl = D().slides[i], c = thumbOf(sl), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(from, 0, 0, c.width, c.height); }
  function frame() {
    if (!E) return;
    E.raf = 0;
    if (!curSlot()) { cerrar(); return; }
    const n = D().slides.length;
    for (const i of [...E.need]) if (i >= n) E.need.delete(i);
    let more = false;
    try {
      if (E.need.has(E.sel) && drawSlide(E.sel, E.ctx)) { E.need.delete(E.sel); toThumb(E.sel, E.cv); edDecision(); }
      for (const j of [...E.need]) {                    // one other thumbnail per frame (the first whose photo is ready)
        if (j === E.sel || !drawSlide(j, E.offCtx)) continue;
        E.need.delete(j); toThumb(j, E.off); more = [...E.need].some(k => k !== E.sel); break;
      }
    } catch (e) { console.warn('diseño:', e); }
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
  function select(i) {
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
      if (curSlot() !== s || I().S !== S || sl.src !== f || !I().same(s.photos, after) || !back.every(x => S.tray.includes(x))) { I().toast('No se puede deshacer: el diseño ya ha cambiado.'); return; }
      sl.src = old; S.tray = S.tray.filter(x => !back.includes(x)); if (fromTray && !S.tray.includes(f)) S.tray.unshift(f); s.photos = before;
      I().renderTray(); touch();
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
  function moveSlide(i, dir) {
    const d = D(), j = i + dir; if (j < 0 || j >= d.slides.length) return;
    [d.slides[i], d.slides[j]] = [d.slides[j], d.slides[i]];
    if (E.sel === i) E.sel = j; else if (E.sel === j) E.sel = i;
    touch(); if (!resizeIfNeeded()) { edList(); edPanel(); edHead(); dirty('all'); }
  }
  function addSlide() {          // a new ficha after the selected slide (before it when it is the final)
    const d = D(), k = d.slides[E.sel].tipo === 'final' ? E.sel : E.sel + 1;
    d.slides.splice(k, 0, blankSlide('ficha', null));
    E.sel = k;
    touch(); edList(); edPanel(); edHead(); dirty('all');
  }
  function delSlide(i) {
    const s = curSlot(), d = s.design; if (d.slides.length < 2) return;
    const before = s.photos.slice(), [gone] = d.slides.splice(i, 1);
    if (E.sel >= d.slides.length) E.sel = d.slides.length - 1; else if (E.sel > i) E.sel--;
    const { back } = release(s, [gone.src]), after = s.photos.slice();
    touch(); if (!resizeIfNeeded()) { edList(); edPanel(); edHead(); dirty('all'); }
    const slotId = s.id, B = I().S;
    I().toast(`Diapositiva ${i + 1} quitada${back.length ? '; su foto vuelve a la bandeja' : ''}.`, { action: 'Deshacer', ms: 6000, onAction: () => {
      const s2 = curSlot(); if (!s2 || s2.id !== slotId || I().S !== B || s2.design !== d) { I().toast('No se puede deshacer: el diseño ya ha cambiado.'); return; }
      if (back.length) { B.tray = B.tray.filter(x => !back.includes(x)); I().renderTray(); }
      if (I().same(s2.photos, after)) s2.photos = before;
      d.slides.splice(Math.min(i, d.slides.length), 0, gone); E.sel = Math.min(i, d.slides.length - 1);
      touch(); if (!resizeIfNeeded()) { edList(); edPanel(); edHead(); dirty('all'); }
    } });
  }

  async function edAplicar(btn) {
    if (!E || E.busy) return;
    const e0 = E;
    E.busy = true; btn.disabled = true; btn.textContent = 'Aplicando…';
    if (E.saveT) { clearTimeout(E.saveT); E.saveT = 0; I().save(); }
    let r = null, err = null;
    try { r = await aplicar(E.slotId); } catch (e) { err = e; }
    btn.disabled = false; btn.textContent = 'Aplicar a la casilla';
    if (E !== e0) return;
    E.busy = false;
    if (err) {
      if (!(err instanceof DzError)) console.warn('diseño:', err);
      I().toast(err instanceof DzError ? err.message : 'No se pudo aplicar el diseño: ' + String((err && err.message) || err));
      if (err.slide != null && curSlot()) select(err.slide);
      return;
    }
    const n = r.archivos.length, nc = r.avisos.filter(a => !/bandeja/.test(a)).length;
    cerrar();
    I().toast(`Diseño aplicado: ${n === 1 ? 'la portada está' : `las ${n} imágenes están`} en la casilla.` + (nc ? ' Revisa los avisos de contraste.' : ''));
  }

  function wireEditor(el) {
    // the mesa's own handlers (on its root) never see what happens in the editor
    ['click', 'input', 'change', 'pointerdown', 'dblclick', 'dragstart', 'wheel'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
    el.addEventListener('click', e => {
      if (E && !curSlot()) { cerrar(); return; }
      const a = e.target.closest('[data-dz]'); if (!a || !E || a.disabled) return;
      const act = a.dataset.dz, d = D(), i = E.sel, sl = d.slides[i];
      sl.ov = sl.ov || {};
      if (act === 'cerrar') cerrar();
      else if (act === 'aplicar') edAplicar(a);
      else if (act === 'sel') { if (!e.target.closest('.dz-mv')) select(+a.dataset.i); }
      else if (act === 'up' || act === 'down') moveSlide(+a.dataset.i, act === 'up' ? -1 : 1);
      else if (act === 'del') delSlide(+a.dataset.i);
      else if (act === 'add') addSlide();
      else if (act === 'fmt') { if (d.fmt !== a.dataset.v && FMTS[a.dataset.v]) { d.fmt = a.dataset.v; touch(); E.sz = sizeOf(E.kit, d, E.fin); edAll(); } }
      else if (act === 'tipo') {
        const v = a.dataset.v; if (v === sl.tipo) return;
        sl.tipo = v;
        touch(); E.pickFinal = false;
        if (!resizeIfNeeded()) { edList(); edPanel(); dirty('sel'); }
      }
      else if (act === 'src') setSrc(i, a.dataset.f);
      else if (act === 'centrar') { const src = effSrc(sl, E.fin); if (src) { setCropFor(src, { cx: 0.5, cy: 0.5, z: 1 }); touch(); edPanel(); } }
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
        delete sl.ov.dx; delete sl.ov.dy;                    // a new position starts from its own place
        touch(); edPanel(); dirty('sel');
      }
      else if (act === 'color') { if (a.dataset.v) sl.ov.color = a.dataset.v; else delete sl.ov.color; touch(); edPanel(); dirty('sel'); }
      else if (act === 'veloauto') { if (sl.ov.velo != null) { delete sl.ov.velo; touch(); edPanel(); dirty('sel'); } }
      else if (act === 'reset') { sl.ov = {}; touch(); edPanel(); dirty('sel'); }
    });
    el.addEventListener('input', e => {
      if (!E || !curSlot()) return;
      const t = e.target, d = D(), sl = d.slides[E.sel];
      if (t.matches('[data-f]')) { sl[t.dataset.f] = t.dataset.f === 'contacto' && t.value === '' ? null : t.value; touch(); dirty('sel'); }
      else if (t.matches('.dz-serin')) { d.serie = t.value; touch(true); }
      else if (t.matches('.dz-zoomr')) { const src = effSrc(sl, E.fin); if (src) { setCropFor(src, { z: +t.value }); touch(); } }
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
      if (inBlock(p0)) { sl.ov = sl.ov || {}; const b = E.last[E.sel].bloque, dx = sl.ov.dx || 0, dy = sl.ov.dy || 0; g = { mode: 'text', dx, dy, bx: b.x - dx, by: b.y - dy, bw: b.w, bh: b.h }; }
      else if (src && M.files[src]) { const f = M.files[src], r0 = rectOf(src, E.sz.W, E.sz.H); g = { mode: 'pan', src, cx: (r0.x + r0.w / 2) / f.w, cy: (r0.y + r0.h / 2) / f.h, fw: r0.w / f.w, fh: r0.h / f.h }; }
      else return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
      E.drag = g; cv.style.cursor = g.mode === 'text' ? 'move' : 'grabbing';
      const mv = ev => {
        if (!E || E.drag !== g) return;
        const p = at(ev);
        if (g.mode === 'text') {             // at least 25 % of the block (and 80 px each way) stays on the canvas
          const lim = (v, pos, size, max) => { const keep = Math.min(size, Math.max(size * 0.25, 80)); return Math.max(keep - size - pos, Math.min(max - keep - pos, v)); };
          const v = sl.ov; v.dx = Math.round(lim(g.dx + p.x - p0.x, g.bx, g.bw, E.sz.W)); v.dy = Math.round(lim(g.dy + p.y - p0.y, g.by, g.bh, E.sz.H));
          if (!v.dx) delete v.dx; if (!v.dy) delete v.dy; dirty('sel');
        }
        else setCropFor(g.src, { cx: g.cx - (p.x - p0.x) / E.sz.W * g.fw, cy: g.cy - (p.y - p0.y) / E.sz.H * g.fh });
      };
      const up = () => {
        cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
        if (!E || E.drag !== g) return;
        E.drag = null; cv.style.cursor = '';
        touch(); edPanel();
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
    else if (!typing && t && t.closest && t.closest('.dz-it') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+t.closest('.dz-it').dataset.i); }
  }

  function cerrar() {
    if (!E) return { ok: true };
    const e = E; E = null;
    window.removeEventListener('keydown', onKey, true);
    if (e.raf) cancelAnimationFrame(e.raf);
    if (e.ro) e.ro.disconnect();
    const S = I() && I().S;
    if (e.saveT) { clearTimeout(e.saveT); if (S === e.board) I().save(); }
    for (const b of e.bm.values()) if (b.bmp) b.bmp.close();
    e.bm.clear(); e.capas.clear();
    e.off.width = e.off.height = 0;
    if (e.el) e.el.remove();
    (e.inert || []).forEach(c => c.removeAttribute('inert'));
    if (I() && S === e.board) { I().refreshDetail(); I().renderFeed(); }
    return { ok: true };
  }

  // called by the mesa on every render: an editor whose board or post is gone closes; the kits of the board's designs
  // are read once so the post view and the upload plan can tell an up-to-date design synchronously
  function sync() {
    if (E && (!E.el.isConnected || !curSlot())) cerrar();
    const S = I() && I().S; if (!S) return;
    for (const s of S.slots) {
      const cid = s.design && s.design.kit;
      if (cid && BASEV[cid] === undefined && !BASE[cid]) baseKit(cid).then(k => { if (k && I()) I().refreshDetail(); });
    }
  }

  M.diseno = {
    version: VERSION,
    cargar: api(cargar), estado: api(estado), aplicar: api(aplicar), ver: api(ver),
    kit: api(kit), ajustarKit: api(ajustarKit), fijarFinal: api(fijarFinal),
    abrir, cerrar, estadoDe, sync,
    abierto: () => E ? { slot: E.slotId, diapositiva: E.sel + 1, W: E.sz.W, H: E.sz.H, bloque: (E.last[E.sel] || {}).bloque || null, decision: (E.last[E.sel] || {}).decision || null } : null
  };
})();
