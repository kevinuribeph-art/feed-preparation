// Editor libre de diapositivas — Mesa de trabajo · v1.2
// «Editar diapositivas» (a carousel) / «Editar foto» (a photo post) in the post view: each slide becomes a free composition —
// photos in frames (move, scale, rotate, flip, crop, border, corners, shadow, frames), texts, logos and stickers of the client,
// shapes and lines, over a colour background with an optional veil and texture — and «Aplicar a la casilla» draws it as a JPEG
// that goes in the slot exactly as drawn (file flagged design:true, uploaded as rendered, like «Diseñar»). A slide that is
// not touched stays the photo it was, with the mesa's own reframe.
//   s.libre = {v:1, slides:{<renderedFileId>: comp}}    the composition behind each rendered image of the post
//   comp = {bg:'#rrggbb', velo:null|{tipo:'plano'|'grad', color, op, dir:'abajo'|'arriba'|'izq'|'der', alc}, tex:null|{tipo, op},
//           els:[el] (back to front), rej?:{n, g}}
//   every el: {id, t, x, y, w, h (frame, fractions of the slide), rot (°), op (opacity), lock, oculto, g (group id), sh (shadow 0–1)}
//   'foto':  src, cx, cy, z (the photo inside the frame, as the mesa's reframe), fx, fy, b (border, fraction of the width), bc,
//            r (corners, 0–1 of half the short side), marco (null|'polaroid'|'pelicula'|'cinta'), fit (margin while «Encajar» holds)
//   'texto': txt, font {n, file (kits/…)|css}, peso, size (fraction of the width), color, al ('izq'|'cen'|'der'), lh, ls (em),
//            may (capitals); h follows the text
//   'logo':  src (a client's logo or sticker: protected file 'kit-<cliente>-logo-…'), fx, fy
//   'forma': forma ('rect'|'elipse'|'linea'), color, r, b, bc
// The client's colours, templates and logos live on the client record: c.libre = {colores, plantillas:[{id, nombre, comp}], logos}.
// A post designed with «Diseñar» (s.design) is not edited here, and the other way round. Uses the mesa's bridge M._in (mesa.js ≥ 3.25).
(function libreBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.2';
  const OUT_W = 1440;                          // width of a rendered slide (the most Instagram keeps; the app shows 1080)
  const PX = 1080 / OUT_W;                     // the panel speaks in pixels of a 1080-wide slide
  const VIEW_LONG = 2048;                      // photos drawn in the editor are scaled to this; «Aplicar» reads them at full size
  const MAX_SLIDES = 20;                       // Instagram's limit for a carousel
  const FMTS = { v45: '4:5', v34: '3:4', q11: '1:1', h: 'Horizontal' };
  const BASICOS = ['#ffffff', '#000000', '#f3f1ec', '#262626'];
  const ROT_D = 26;                            // screen px from a frame's top edge to its rotation handle
  const SNAP = 7;                              // screen px within which the magnet aligns
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pad2 = n => String(n).padStart(2, '0');
  const hexOk = v => /^#[0-9a-f]{6}$/i.test(String(v || ''));
  const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const pct = v => Math.round(v * 100) + ' %';
  const r4 = v => Math.round(v * 1e4) / 1e4;
  const isKit = f => String(f || '').startsWith('kit-');   // a client's protected file (logo): never a tray photo

  class LbError extends Error {}
  const need = (ok, msg) => { if (!ok) throw new LbError(msg); };
  const LOCKED = 'La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de editar.';

  // ---------- slot helpers ----------
  const isLibSlot = s => !!s && (I().isCarousel(s.type) || s.type === 'Foto');
  const entries = s => (s && s.libre && s.libre.slides) || {};
  const srcsOf = comp => ((comp && comp.els) || []).map(e => e.src).filter(Boolean);
  const fotosDe = comp => ((comp && comp.els) || []).filter(e => e.t === 'foto');
  function compOf(S, fid) {                    // the composition behind a rendered image: on its post, or on the post it came from
    for (const s of S.slots) { const c = entries(s)[fid]; if (c) return { s, comp: c }; }
    return null;
  }
  // a composition's signature for «changed?»: a text's height follows its font, which may load after opening
  const firma = c => JSON.stringify(c, function (k, v) { return k === 'h' && this && this.t === 'texto' ? undefined : v; });

  // ---------- fonts: the client's kit, the mesa's own (kits/fonts) and the Mac's ----------
  const FUENTES_MESA = [{ n: 'Newsreader', file: 'fonts/Newsreader-Display-Light.ttf', w: 300 }, { n: 'Libre Franklin Light', file: 'fonts/LibreFranklin-Light.ttf', w: 300 }, { n: 'Libre Franklin', file: 'fonts/LibreFranklin-Regular.ttf', w: 400 }];
  const FUENTES_MAC = [['Helvetica Neue', '"Helvetica Neue", Helvetica, Arial, sans-serif'], ['Avenir Next', '"Avenir Next", Avenir, "Helvetica Neue", sans-serif'], ['Futura', 'Futura, "Century Gothic", sans-serif'],
    ['Gill Sans', '"Gill Sans", "Gill Sans MT", sans-serif'], ['Optima', 'Optima, Candara, sans-serif'], ['Didot', 'Didot, "Bodoni 72", "Bodoni MT", serif'], ['Baskerville', 'Baskerville, "Baskerville Old Face", serif'],
    ['Georgia', 'Georgia, serif'], ['American Typewriter', '"American Typewriter", "Courier New", monospace'], ['Snell Roundhand', '"Snell Roundhand", "Apple Chancery", cursive']].map(([n, css]) => ({ n, css }));
  const FONTS = new Map();                     // kits/ file -> {name, ok, p}
  function fuente(f) {                         // a font file registered once; its promise settles when it can be drawn
    let r = FONTS.get(f.file);
    if (!r) {
      r = { name: 'LB ' + String(f.file).replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, ''), ok: false };
      r.p = (async () => {
        const res = await fetch('kits/' + f.file); if (!res.ok) throw new Error('No se encuentra la fuente ' + f.file);
        const face = new FontFace(r.name, await res.arrayBuffer(), { weight: String(f.w || 400) });
        await face.load(); document.fonts.add(face); r.ok = true;
        if (E) { E.reMini = true; pedir(); }
      })();
      r.p.catch(() => { r.err = true; });
      FONTS.set(f.file, r);
    }
    return r;
  }
  function fontCss(el, px) {
    const f = el.font || {};
    if (f.file) return `${f.w || 400} ${px}px "${fuente(f).name}", "Helvetica Neue", sans-serif`;
    return `${el.peso || 400} ${px}px ${f.css || '"Helvetica Neue", Helvetica, Arial, sans-serif'}`;
  }
  const HAS_LS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  const MC = document.createElement('canvas').getContext('2d');   // measures texts outside any drawing
  const medir = (ctx, s, ls) => ctx.measureText(s).width + (HAS_LS || !ls ? 0 : ls * Math.max(0, [...s].length - 1));
  function lineas(ctx, el, W) {                // the text in lines that fit its box: by words, a word too long by letters
    const px = (el.size || 0.06) * W, maxW = Math.max(1, el.w * W), ls = (el.ls || 0) * px;
    ctx.font = fontCss(el, px); if (HAS_LS) ctx.letterSpacing = ls + 'px';
    const txt = String(el.txt ?? ''), out = [];
    for (const par of (el.may ? txt.toLocaleUpperCase('es') : txt).split('\n')) {
      let line = '';
      for (let w of par.split(/ +/)) {
        const t = line ? line + ' ' + w : w;
        if (medir(ctx, t, ls) <= maxW) { line = t; continue; }
        if (line) { out.push(line); line = ''; }
        while ([...w].length > 1 && medir(ctx, w, ls) > maxW) { const ch = [...w]; let k = ch.length - 1; while (k > 1 && medir(ctx, ch.slice(0, k).join(''), ls) > maxW) k--; out.push(ch.slice(0, k).join('')); w = ch.slice(k).join(''); }
        line = w;
      }
      out.push(line);
    }
    return { out, px, lh: px * (el.lh || 1.2), ls };
  }
  function ajustarTexto(el, W, H) { MC.save(); const L = lineas(MC, el, W); MC.restore(); el.h = r4(Math.max(L.lh, L.out.length * L.lh) / H); }   // its height follows its lines

  // ---------- textures (the same tiles in the editor and in «Aplicar») ----------
  const TEXS = { grano: 'Grano', papel: 'Papel', polvo: 'Polvo' };
  const TILE = {};
  function azar(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function tile(tipo) {
    if (TILE[tipo]) return TILE[tipo];
    const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'), R = azar(tipo.length * 7919 + 17), im = x.createImageData(n, n), d = im.data;
    for (let i = 0; i < n * n; i++) {
      let v = 255, a = 255;
      if (tipo === 'grano') v = 128 + (R() - 0.5) * 210;        // overlay: mid grey ± noise
      else if (tipo === 'papel') v = 238 + (R() - 0.5) * 26;     // multiply: light warm paper
      else a = R() > 0.9982 ? 150 + R() * 105 : 0;               // screen: sparse dust
      d[i * 4] = v; d[i * 4 + 1] = tipo === 'papel' ? v - 5 : v; d[i * 4 + 2] = tipo === 'papel' ? v - 14 : v; d[i * 4 + 3] = a;
    }
    x.putImageData(im, 0, 0);
    if (tipo === 'papel') for (let k = 0; k < 260; k++) { x.strokeStyle = `rgba(140,120,90,${(0.05 + R() * 0.07).toFixed(3)})`; x.lineWidth = 0.6 + R(); x.beginPath(); const px = R() * n, py = R() * n; x.moveTo(px, py); x.quadraticCurveTo(px + (R() - 0.5) * 40, py + (R() - 0.5) * 40, px + (R() - 0.5) * 70, py + (R() - 0.5) * 70); x.stroke(); }
    return (TILE[tipo] = c);
  }
  function drawTex(ctx, t, W, H) {
    if (!t || !TEXS[t.tipo] || !(t.op > 0)) return;
    const c = tile(t.tipo);
    ctx.save(); ctx.globalAlpha = t.op; ctx.globalCompositeOperation = t.tipo === 'grano' ? 'overlay' : t.tipo === 'papel' ? 'multiply' : 'screen';
    for (let y = 0; y < H; y += 512) for (let x = 0; x < W; x += 512) ctx.drawImage(c, x, y);
    ctx.restore();
  }

  // ---------- drawing (one function for the editor, its thumbnails and «Aplicar») ----------
  function pathRR(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath();
    if (!r) { ctx.rect(x, y, w, h); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const srcRect = (el, pw, ph, fw, fh) => I().rectFor(pw, ph, fw / fh, { cx: el.cx, cy: el.cy, z: el.z });
  function hueco(el, fw, fh) {                 // the photo inside its frame («Marco»): {x, y, w, h} around the frame's centre
    const m = Math.min(fw, fh);
    if (el.marco === 'polaroid') { const p = m * 0.06; return { x: -fw / 2 + p, y: -fh / 2 + p, w: fw - 2 * p, h: Math.max(1, fh - p - m * 0.2) }; }
    if (el.marco === 'pelicula') { const p = m * 0.035, q = m * 0.11; return { x: -fw / 2 + p, y: -fh / 2 + q, w: fw - 2 * p, h: Math.max(1, fh - 2 * q) }; }
    return { x: -fw / 2, y: -fh / 2, w: fw, h: fh };
  }
  function sombra(ctx, el, W, k) { ctx.shadowColor = `rgba(0,0,0,${(0.2 + 0.35 * el.sh).toFixed(3)})`; ctx.shadowBlur = W * 0.05 * el.sh * k; ctx.shadowOffsetY = W * 0.016 * el.sh * k; }
  // k: device pixels per slide unit (shadows are not scaled by the canvas transform); ph: draw empty frames as placeholders
  function drawFoto(ctx, el, W, H, img, k, ph) {
    const fw = el.w * W, fh = el.h * H; if (fw < 0.5 || fh < 0.5) return;
    const r = (el.r || 0) * Math.min(fw, fh) / 2, bw = (el.b || 0) * W, ib = hueco(el, fw, fh), card = el.marco === 'polaroid' || el.marco === 'pelicula';
    ctx.save();
    ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    if (el.sh > 0) { ctx.save(); sombra(ctx, el, W, k); pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.fillStyle = card && el.marco === 'polaroid' ? '#fbfaf7' : '#000'; ctx.fill(); ctx.restore(); }
    if (card) {
      pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.fillStyle = el.marco === 'polaroid' ? '#fbfaf7' : '#141414'; ctx.fill();
      if (el.marco === 'pelicula') {             // the perforations of the strip, above and below the photo
        const q = Math.min(fw, fh) * 0.11, hw = q * 0.42, hh = q * 0.3, step = q * 0.78; ctx.fillStyle = '#e9e4d8';
        for (let x = -fw / 2 + step / 2; x < fw / 2 - hw; x += step) for (const y of [-fh / 2 + (q - hh) / 2, fh / 2 - (q + hh) / 2]) { pathRR(ctx, x, y, hw, hh, hh * 0.25); ctx.fill(); }
      }
    }
    if (card) { ctx.beginPath(); ctx.rect(ib.x, ib.y, ib.w, ib.h); } else pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r);
    ctx.save(); ctx.clip();
    const m = el.src ? img(el.src) : null, f = el.src && M.files[el.src];
    if (m && f) {
      const sr = srcRect(el, f.w, f.h, ib.w, ib.h), ks = m.im.width / f.w;
      ctx.save(); ctx.translate(ib.x + ib.w / 2, ib.y + ib.h / 2); ctx.scale(el.fx ? -1 : 1, el.fy ? -1 : 1);
      ctx.drawImage(m.im, sr.x * ks, sr.y * ks, sr.w * ks, sr.h * ks, -ib.w / 2, -ib.h / 2, ib.w, ib.h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#d9d5cd'; ctx.fillRect(ib.x, ib.y, ib.w, ib.h);
      if (ph && !el.src) { ctx.fillStyle = '#8a8478'; ctx.font = `600 ${Math.max(12, Math.min(ib.w, ib.h) * 0.09)}px -apple-system,BlinkMacSystemFont,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+ Foto', ib.x + ib.w / 2, ib.y + ib.h / 2); }
    }
    if (bw > 0 && !card) { ctx.lineWidth = bw * 2; ctx.strokeStyle = hexOk(el.bc) ? el.bc : '#ffffff'; pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.stroke(); }
    ctx.restore();
    if (bw > 0 && card) { ctx.save(); pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.clip(); ctx.lineWidth = bw * 2; ctx.strokeStyle = hexOk(el.bc) ? el.bc : '#ffffff'; ctx.stroke(); ctx.restore(); }
    if (el.marco === 'cinta') {                // two strips of tape over the top corners
      const m2 = Math.min(fw, fh), tw = m2 * 0.3, th = m2 * 0.085; ctx.fillStyle = 'rgba(243,234,205,.82)';
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * (fw / 2 - tw * 0.22), -fh / 2 + th * 0.2); ctx.rotate(s * Math.PI / 4.6); ctx.fillRect(-tw / 2, -th / 2, tw, th); ctx.restore(); }
    }
    ctx.restore();
  }
  function drawTexto(ctx, el, W, H, k, ph) {
    ctx.save();
    const L = lineas(ctx, el, W), fw = el.w * W, fh = Math.max(L.lh, L.out.length * L.lh);
    ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    if (el.sh > 0) sombra(ctx, el, W, k);
    ctx.fillStyle = hexOk(el.color) ? el.color : '#ffffff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const vacio = !L.out.some(s => s.trim());
    if (vacio && ph) { ctx.fillStyle = 'rgba(128,128,128,.6)'; ctx.fillText('Texto', -fw / 2, -fh / 2 + (L.lh - L.px) / 2 + L.px * 0.8); }
    L.out.forEach((s, i) => {
      const lw = medir(ctx, s, L.ls), x = el.al === 'der' ? fw / 2 - lw : el.al === 'cen' ? -lw / 2 : -fw / 2, y = -fh / 2 + i * L.lh + (L.lh - L.px) / 2 + L.px * 0.8;
      if (HAS_LS || !L.ls) ctx.fillText(s, x, y);
      else { let cx = x; for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + L.ls; } }
    });
    ctx.restore();
  }
  function drawLogo(ctx, el, W, H, img, k, ph) {
    const fw = el.w * W, fh = el.h * H; if (fw < 0.5 || fh < 0.5) return;
    const m = el.src ? img(el.src) : null;
    ctx.save(); ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    if (el.sh > 0) sombra(ctx, el, W, k);
    ctx.scale(el.fx ? -1 : 1, el.fy ? -1 : 1);
    if (m) ctx.drawImage(m.im, -fw / 2, -fh / 2, fw, fh);
    else if (ph) { ctx.strokeStyle = 'rgba(128,128,128,.7)'; ctx.setLineDash([6, 5]); ctx.strokeRect(-fw / 2, -fh / 2, fw, fh); }
    ctx.restore();
  }
  function drawForma(ctx, el, W, H, k) {
    const fw = el.w * W, fh = el.h * H; if (fw < 0.5 || fh < 0.5) return;
    ctx.save(); ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    const path = () => { if (el.forma === 'elipse') { ctx.beginPath(); ctx.ellipse(0, 0, fw / 2, fh / 2, 0, 0, Math.PI * 2); } else pathRR(ctx, -fw / 2, -fh / 2, fw, fh, el.forma === 'linea' ? 0 : (el.r || 0) * Math.min(fw, fh) / 2); };
    ctx.save(); if (el.sh > 0) sombra(ctx, el, W, k); path(); ctx.fillStyle = hexOk(el.color) ? el.color : '#ffffff'; ctx.fill(); ctx.restore();
    if (el.b > 0 && el.forma !== 'linea') { path(); ctx.save(); ctx.clip(); ctx.lineWidth = el.b * W * 2; ctx.strokeStyle = hexOk(el.bc) ? el.bc : '#000000'; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  function drawEl(ctx, el, W, H, img, k, ph) {
    if (el.oculto) return;
    if (el.t === 'texto') drawTexto(ctx, el, W, H, k, ph);
    else if (el.t === 'logo') drawLogo(ctx, el, W, H, img, k, ph);
    else if (el.t === 'forma') drawForma(ctx, el, W, H, k);
    else drawFoto(ctx, el, W, H, img, k, ph);
  }
  function drawVelo(ctx, v, W, H) {
    if (!v || !(v.op > 0)) return;
    const col = hexOk(v.color) ? v.color : '#000000';
    if (v.tipo === 'grad') {
      const a = clamp(v.alc ?? 0.6, 0.1, 1), d = v.dir || 'abajo';
      const [x0, y0, x1, y1] = d === 'arriba' ? [0, 0, 0, H * a] : d === 'izq' ? [0, 0, W * a, 0] : d === 'der' ? [W, 0, W - W * a, 0] : [0, H, 0, H - H * a];
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, rgba(col, v.op)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g;
    } else ctx.fillStyle = rgba(col, v.op);
    ctx.fillRect(0, 0, W, H);
  }
  // the veil goes over the photos and under texts, logos and shapes that are above the topmost photo (the text reads on it)
  function drawComp(ctx, comp, W, H, img, k, ph) {
    ctx.fillStyle = hexOk(comp.bg) ? comp.bg : '#ffffff'; ctx.fillRect(0, 0, W, H);
    const els = comp.els, top = els.reduce((a, e, i) => e.t === 'foto' ? i : a, -1);
    els.forEach((el, i) => { if (i <= top) drawEl(ctx, el, W, H, img, k, ph); });
    drawVelo(ctx, comp.velo, W, H);
    els.forEach((el, i) => { if (i > top) drawEl(ctx, el, W, H, img, k, ph); });
    drawTex(ctx, comp.tex, W, H);
  }

  // ---------- the open editor ----------
  let E = null;      // {slotId, board, car, fmt, fmt0, sl:[slide], i, sel, mas, crop, pick, zoom, iman, hist, bm, marca, photos0, kit, mios, plant, logos, fkit, …}
  // slide: {key: the file in the post (photo or rendered image) | null (new), out: key is a rendered image with its composition,
  //         from: id of the post that composition was on (moved here), comp: null (untouched photo) | comp, raw: the photo as
  //         the mesa shows it (comp of an untouched photo), base: signature of the slide as opened, fmt, fmt0 (photo posts)}
  let APL = 0, CLIP = null;   // «Aplicar» running; what was copied {els, client} (kept between posts of the same client)
  const curSlot = () => { if (!E) return null; const S = I() && I().S, s = S && S === E.board ? S.slots.find(x => x.id === E.slotId) : null; return s && !s.design && isLibSlot(s) ? s : null; };
  const cur = () => E.sl[E.i];
  const EMPTY = { bg: '#ffffff', velo: null, els: [] };
  const compAt = i => { const x = E.sl[i]; return x ? x.comp || x.raw : EMPTY; };
  const selEl = () => { const c = E.sl[E.i] && compAt(E.i); return c && E.sel ? c.els.find(e => e.id === E.sel) || null : null; };
  const selIds = () => E.sel ? [E.sel, ...E.mas.filter(id => id !== E.sel)] : [];
  const selEls = () => { const ids = selIds(); return compAt(E.i).els.filter(e => ids.includes(e.id)); };
  const multi = () => selIds().length > 1;
  function soltar() { E.sel = null; E.mas = []; }
  function seleccionar(el, add) {              // a click selects the element, or its whole group; with ⇧ it adds or takes away
    if (!el) { soltar(); return; }
    const grupo = el.g ? compAt(E.i).els.filter(e => e.g === el.g).map(e => e.id) : [el.id];
    if (!add) { E.sel = el.id; E.mas = grupo.filter(id => id !== el.id); return; }
    const ids = selIds();
    if (ids.includes(el.id)) { const rest = ids.filter(id => !grupo.includes(id)); E.sel = rest[0] || null; E.mas = rest.slice(1); }
    else if (!E.sel) { E.sel = el.id; E.mas = grupo.filter(id => id !== el.id); }
    else E.mas = [...new Set([...E.mas, ...grupo])];
  }
  function ensure() { const x = cur(); if (!x.comp) x.comp = clone(x.raw); return x.comp; }   // a photo slide becomes a composition on its first change
  const changedSl = x => !!x.comp && firma(x.comp) !== x.base;
  const isRaw = x => !x.out && !!x.key && !changedSl(x);   // a photo slide not edited (or edited back to the photo): stays the photo
  const base = { rot: 0, op: 1, lock: false, sh: 0 };
  function fotoEl(src, c) { return { id: uid(), t: 'foto', src, x: 0, y: 0, w: 1, h: 1, cx: c ? c.cx ?? 0.5 : 0.5, cy: c ? c.cy ?? 0.5 : 0.5, z: c ? c.z || 1 : 1, ...base, fx: false, fy: false, b: 0, bc: '#ffffff', r: 0 }; }
  function textoEl(color) { const f = (E.fuentes && E.fuentes[0]) || FUENTES_MAC[0]; return { id: uid(), t: 'texto', txt: 'Escribe aquí', x: 0.1, y: 0.42, w: 0.8, h: 0.1, ...base, font: { n: f.n, ...(f.file ? { file: f.file, w: f.w } : { css: f.css }) }, peso: 400, size: 0.075, color, al: 'cen', lh: 1.15, ls: 0, may: false }; }
  function formaEl(forma, W, H) {
    const s = 0.4 * W;
    if (forma === 'linea') return { id: uid(), t: 'forma', forma, x: 0.15, y: r4(0.5 - 3 / H), w: 0.7, h: r4(6 / H), ...base, color: '#ffffff', r: 0, b: 0, bc: '#000000' };
    return { id: uid(), t: 'forma', forma, x: r4((W - s) / 2 / W), y: r4((H - s * (forma === 'rect' ? 0.6 : 1)) / 2 / H), w: 0.4, h: r4(s * (forma === 'rect' ? 0.6 : 1) / H), ...base, color: '#ffffff', r: 0, b: 0, bc: '#000000' };
  }
  function logoEl(src, W, H) { const f = M.files[src] || { w: 1, h: 1 }, w = 0.25 * W, h = w * f.h / f.w; return { id: uid(), t: 'logo', src, x: r4((W - w) / 2 / W), y: r4((H - h) / 2 / H), w: 0.25, h: r4(h / H), ...base, fx: false, fy: false }; }
  // the photo as the mesa shows it now (a new format centres it, as the mesa does)
  function rawComp(key, centred) { const el = fotoEl(key, centred ? null : I().baseCrop(key, E.board)); el.id = 'r0'; return { bg: '#ffffff', velo: null, els: [el] }; }
  function fmtAt(i) { return E.car ? E.fmt : (E.sl[i] && E.sl[i].fmt) || 'v45'; }
  function ratioAt(i) {   // «Horizontal» takes the ratio of the photo (a carousel's: its first slide's), never of an image drawn from it
    const x = E.car ? E.sl[0] : E.sl[i], c = x && (x.comp || x.raw), e = c && fotosDe(c).find(q => q.src && M.files[q.src] && !M.files[q.src].design);
    const d = e ? M.files[e.src] : x && x.key && M.files[x.key] ? M.files[x.key] : { w: 4, h: 5 };
    return I().fmtRatio(fmtAt(i), d.w, d.h);
  }
  const sizeAt = i => ({ W: OUT_W, H: Math.round(OUT_W / ratioAt(i)) });
  function pendiente() {
    if (!E) return false;
    if (E.car && E.fmt !== E.fmt0) return true;
    if (!I().same(E.sl.map(x => x.key), E.photos0)) return true;
    return E.sl.some(x => changedSl(x) || (!E.car && x.fmt !== x.fmt0));
  }

  // ---------- photos for the editor: scaled once, loaded on demand ----------
  function viewImg(src) {
    if (!E) return null;
    const b = E.bm.get(src);
    if (b) return b.im ? b : null;
    const rec = { im: null }, owner = E; E.bm.set(src, rec);
    (async () => {
      try {
        const bmp = await createImageBitmap(await I().getBlob(src), { imageOrientation: 'from-image' });
        const k = Math.min(1, VIEW_LONG / Math.max(bmp.width, bmp.height));
        let im = bmp;
        if (k < 1) { const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height); bmp.close(); im = c; }
        if (E !== owner) { if (im.close) im.close(); return; }
        rec.im = im; E.reMini = true; pedir();
      } catch (e) { rec.err = true; }
    })();
    return null;
  }
  async function renderOut(i) {               // slide i at full size: a JPEG Blob
    const comp = E.sl[i].comp, { W, H } = sizeAt(i), cache = new Map();
    try {
      await Promise.all(comp.els.filter(e => e.t === 'texto' && e.font && e.font.file).map(e => fuente(e.font).p.catch(() => {})));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      for (const f of srcsOf(comp)) if (!cache.has(f)) { const bmp = await createImageBitmap(await I().getBlob(f), { imageOrientation: 'from-image' }); cache.set(f, { im: bmp }); }
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      drawComp(x, comp, W, H, f => cache.get(f) || null, 1, false);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('No se pudo exportar la imagen')), 'image/jpeg', 0.92));
      c.width = c.height = 0;
      return blob;
    } finally { for (const r of cache.values()) r.im.close(); }
  }

  // ---------- open / close ----------
  async function abrir(slotId, idx, opts = {}) {
    try {
      need(I(), 'La mesa no tiene el puente del editor: actualiza mesa.js (3.25 o posterior).');
      const S = I().S; need(S, 'No hay ninguna mesa abierta.');
      need(!I().locked, LOCKED);
      const s = S.slots.find(x => x.id === slotId); need(s, 'Esa publicación ya no está en la mesa.');
      need(isLibSlot(s), 'El editor es para carruseles y publicaciones de foto.');
      need(!s.design, 'Este carrusel tiene un diseño de «Diseñar»: el editor no puede abrirlo.');
      need(!(E && E.busy), 'Espera: el editor está aplicando una publicación.');
      if (E) cerrar(true);
      await I().loadThumbs([...s.photos, ...S.slots.flatMap(x => Object.values(entries(x)).flatMap(srcsOf)), ...S.tray]);
      need(I().S === S && S.slots.includes(s) && !s.design && !(I().switching && I().switching()), 'La mesa cambió: vuelve a pulsar «Editar».');
      need(!(E && E.busy), 'Espera: el editor está aplicando una publicación.');
      if (E) cerrar(true);
      const marca = I().histMarca ? I().histMarca() : null;   // the whole session is one step of the mesa's ⌘Z
      if (I().clearToasts) I().clearToasts();               // an «Deshacer» left in a toast would change the post behind the editor
      const car = I().isCarousel(s.type), fmt0 = car ? s.fmt || 'v45' : null;
      E = { slotId, board: S, car, fmt: fmt0, fmt0, sl: [], i: 0, sel: null, mas: [], crop: null, pick: null, zoom: 1, iman: true, hist: { undo: [], redo: [], tag: null, t: 0 },
        bm: new Map(), marca, photos0: s.photos.slice(), kit: [], mios: [], plant: [], logos: [], fkit: [], fuentes: [...FUENTES_MESA, ...FUENTES_MAC], drag: null, guides: [], busy: false, raf: 0, k: 1, sz: { W: OUT_W, H: OUT_W * 1.25 } };
      E.sl = s.photos.map(key => {
        const f = compOf(S, key), fmt = car ? null : I().cropOf(key, s).fmt;
        if (f) { const comp = clone(f.comp); return { key, out: true, from: f.s !== s ? f.s.id : null, comp, raw: null, base: firma(comp), fmt, fmt0: fmt }; }
        const raw = rawComp(key);
        return { key, out: false, from: null, comp: null, raw, base: firma(raw), fmt, fmt0: fmt };
      });
      E.i = clamp(idx || 0, 0, E.sl.length - 1);
      if (opts.fmt && FMTS[opts.fmt]) formatoEd(opts.fmt, true);
      injectCSS();
      build(s);
      cargarCliente();
      if (opts.fmt) I().toast('Formato cambiado en el editor: pulsa «Aplicar a la casilla» para redibujar las diapositivas editadas.', { ms: 7000 });
      return { ok: true, slot: s.id, diapositivas: E.sl.length };
    } catch (e) {
      const m = e instanceof LbError ? e.message : 'No se pudo abrir el editor: ' + String((e && e.message) || e);
      if (!(e instanceof LbError)) console.warn('editor:', e);
      if (I() && I().toast) I().toast(m);
      return { error: m };
    }
  }
  function blankSlide(bg) { const comp = { bg, velo: null, els: [] }; return { key: null, out: false, from: null, comp, raw: null, base: null, fmt: E && !E.car ? 'v45' : null, fmt0: null }; }
  function cerrar(silent) {
    if (!E) return { ok: true };
    const e = E; E = null;
    window.removeEventListener('keydown', onKey, true);
    if (e.raf) cancelAnimationFrame(e.raf);
    if (e.ro) e.ro.disconnect();
    for (const b of e.bm.values()) if (b.im && b.im.close) b.im.close();
    if (e.inert) e.inert.forEach(c => c.removeAttribute('inert'));
    if (e.el) e.el.remove();
    if (!e.applied && e.marca && I() && I().histJuntar) I().histJuntar(e.marca);   // a tidy-up at opening joins the step before it
    if (!silent && I() && I().S === e.board && I().refreshDetail) I().refreshDetail();
    return { ok: true };
  }
  function pedirCerrar() {
    if (!E || E.busy) return;
    if (!pendiente()) { cerrar(); return; }
    preguntar('¿Salir sin aplicar?', 'Los cambios de esta sesión no llegan a la casilla.', [['seguir', 'Seguir editando', 'btn2'], ['salir', 'Salir sin aplicar', 'btn2'], ['aplicar', 'Aplicar y salir', 'btn']]);
  }
  // the editor's own dialog (the desktop app's browser has no window.prompt): btns [[value, label, class]]; on(value, text)
  function preguntar(t, p, btns, on, campo) {
    cerrarPregunta();
    const d = document.createElement('div'); d.className = 'lb-ask';
    d.innerHTML = `<div class="lb-askc" role="alertdialog" aria-label="${esc(t)}"><h4>${esc(t)}</h4>${p ? `<p>${esc(p)}</p>` : ''}${campo != null ? `<input type="text" class="lb-askin" maxlength="40" value="${esc(campo)}">` : ''}<div class="lb-btns">${btns.map(([v, l, c]) => `<button type="button" class="${c}" data-ask="${v}">${esc(l)}</button>`).join('')}</div></div>`;
    const done = v => { const inp = d.querySelector('.lb-askin'), txt = inp ? inp.value : null; cerrarPregunta(); (on || (x => { if (x === 'salir') cerrar(); else if (x === 'aplicar') aplicar(); }))(v, txt); };
    d.addEventListener('click', ev => { const b = ev.target.closest('[data-ask]'); if (!b && ev.target !== d) return; done(b ? b.dataset.ask : 'seguir'); });
    E.el.append(d); E.ask = d; E.askOk = () => done(btns[btns.length - 1][0]);   // Enter in the field (onKey)
    const f = d.querySelector('.lb-askin') || d.querySelector('[data-ask="seguir"]'); if (f) { f.focus(); if (f.select) f.select(); }
  }
  function cerrarPregunta() { if (E && E.ask) { E.ask.remove(); E.ask = null; } }
  function sync() {     // called on every mesa render: the editor closes when its board or post is gone
    if (!E || E.busy) return;
    if (!curSlot()) { cerrar(true); if (I() && I().toast) I().toast('El editor se ha cerrado: la publicación cambió o ya no está en la mesa.'); }
  }

  // ---------- the client's colours, fonts, templates and logos (kit JSON + client record c.libre) ----------
  async function cargarCliente() {
    const owner = E, cid = E.board.client; if (!cid) return;
    const kit = [], fk = [];
    if (M.diseno && M.diseno.kit) {
      try {
        const raw = await M.diseno.kit(cid);
        if (raw && raw.colores) for (const [n, c] of Object.entries(raw.colores)) if (hexOk(c)) kit.push({ n: n.replace(/_/g, ' '), c: c.toLowerCase() });
        if (raw && raw.fuentes) for (const f of Object.values(raw.fuentes)) if (f && f.archivo && !fk.some(q => q.file === f.archivo)) fk.push({ n: f.familia || f.archivo, file: f.archivo, w: f.peso || 400, kit: true });
      } catch (e) { /* this client has no design kit */ }
    }
    const c = await I().idbGet('clients', cid), lib = (c && c.libre) || {};
    if (E !== owner) return;
    E.kit = kit; E.fkit = fk; E.fuentes = [...fk, ...FUENTES_MESA.filter(f => !fk.some(q => q.file === f.file)), ...FUENTES_MAC];
    E.mios = (lib.colores || []).filter(hexOk); E.plant = Array.isArray(lib.plantillas) ? lib.plantillas : [];
    E.logos = (lib.logos || []).filter(Boolean); await I().loadThumbs(E.logos); E.logos = E.logos.filter(f => M.files[f]);
    if (E !== owner) return;
    panel();
  }
  async function guardarCliente(fn) {
    const owner = E, cid = E.board.client;
    if (!cid) { I().toast('Esta mesa no tiene cliente: no se puede guardar en su kit.'); return false; }
    const c = await I().idbGet('clients', cid); if (!c) { I().toast('No encuentro el cliente de esta mesa.'); return false; }
    c.libre = fn(clone(c.libre || {})); c.libreAt = new Date().toISOString();
    await I().idbPut('clients', cid, c); await I().loadClients();
    if (E === owner) { E.mios = (c.libre.colores || []).filter(hexOk); E.plant = c.libre.plantillas || []; E.logos = (c.libre.logos || []).filter(f => M.files[f]); panel(); }
    return true;
  }
  // a logo or sticker of the client: kept as PNG (its transparency), at most 1600 px, in a protected file of the client
  async function subirLogos(files) {
    const cid = E.board.client; if (!cid) { I().toast('Esta mesa no tiene cliente: no se puede guardar en su kit.'); return; }
    const ids = [];
    for (const file of files) {
      if (!/^image\/(png|webp|jpeg)$/.test(file.type)) { I().toast(`${file.name}: usa PNG (mejor, con transparencia), WebP o JPG.`); continue; }
      try {
        const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
        const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
        const t = document.createElement('canvas'), kt = Math.min(1, 240 / Math.max(c.width, c.height)); t.width = Math.max(1, Math.round(c.width * kt)); t.height = Math.max(1, Math.round(c.height * kt));
        t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
        const thumb = await new Promise((res, rej) => t.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
        const id = `kit-${cid}-logo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name = String(file.name || 'logo').replace(/\.[^.]+$/, '') + '.png';
        await I().idbPut('files', id, { name, size: blob.size, type: 'image/png', w: c.width, h: c.height, lastModified: Date.now(), blob, thumb, logo: true });
        M.files[id] = { name, size: blob.size, type: 'image/png', w: c.width, h: c.height, thumbUrl: URL.createObjectURL(thumb) }; M.thumbBlobs[id] = thumb;
        ids.push(id);
      } catch (e) { I().toast(`${file.name}: no se pudo leer la imagen.`); }
    }
    if (ids.length && await guardarCliente(l => ({ ...l, logos: [...(l.logos || []), ...ids] }))) I().toast(ids.length === 1 ? 'Logo guardado para este cliente: púlsalo para añadirlo.' : `${ids.length} logos guardados para este cliente.`);
  }

  // ---------- history of the editor (⌘Z / ⇧⌘Z) ----------
  const estado = () => JSON.stringify({ sl: E.sl, i: E.i, fmt: E.fmt });
  function paso(tag) {          // before a change; a burst with the same tag (a slider, the arrows, typing) is one step
    const h = E.hist, now = Date.now();
    if (tag && h.tag === tag && now - h.t < 1500) { h.t = now; return; }
    h.undo.push(estado()); if (h.undo.length > 120) h.undo.shift();
    h.redo = []; h.tag = tag || null; h.t = now;
  }
  function deshacer(back) {
    const h = E.hist, from = back ? h.undo : h.redo, to = back ? h.redo : h.undo;
    if (!from.length) return;
    to.push(estado());
    const st = JSON.parse(from.pop());
    E.sl = st.sl; E.fmt = st.fmt; E.i = clamp(st.i, 0, Math.max(0, E.sl.length - 1)); h.tag = null; E.crop = null; E.pick = null;
    const ids = compAt(E.i).els.map(e => e.id);
    if (E.sel && !ids.includes(E.sel)) soltar(); else E.mas = E.mas.filter(id => ids.includes(id));
    todo();
  }
  function mut(tag, fn, quiet) { paso(tag); fn(); despues(quiet); }
  function despues(quiet) { E.reMini = true; pedir(); head(); if (!quiet) { panel(); lista(); } }
  function todo() { lista(); panel(); head(); pedir(); }

  // ---------- the editor's window ----------
  const CSS = `
#mesa .lb{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;background:var(--bg);outline:0}
#mesa .lb-head{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--line)}
#mesa .lb-ttl{flex:1 1 170px;min-width:0}#mesa .lb-ttl h3{margin:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .lb-ttl p{margin:2px 0 0;color:var(--mute);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .lb-state{font-size:11.5px;font-weight:600;border-radius:999px;padding:3px 10px;background:var(--line2);color:var(--mute);white-space:nowrap}
#mesa .lb-state.chg{background:#fdeee6;color:var(--chg)}
#mesa .lb-head .btn:disabled,#mesa .lb-head .btn2:disabled{opacity:.6;cursor:default}
#mesa .lb .seg button{padding:5px 9px}
#mesa .lb-tools{display:inline-flex;align-items:center;gap:4px}
#mesa .lb-ib{border:1px solid var(--line);background:var(--panel);border-radius:8px;min-width:32px;height:32px;padding:0 9px;font-size:13px;color:var(--ink)}
#mesa .lb-ib:disabled{opacity:.35;cursor:default}#mesa .lb-ib.on{background:var(--ink);border-color:var(--ink);color:#fff}
#mesa .lb-zv{min-width:3.6em;text-align:center;font-size:12.5px;font-variant-numeric:tabular-nums}
#mesa .lb-body{flex:1;min-height:0;display:grid;grid-template-columns:132px minmax(0,1fr) 316px}
#mesa .lb-list{overflow-y:auto;padding:12px 10px 16px;background:var(--panel);border-right:1px solid var(--line2)}
#mesa .lb-it{margin:0 0 12px;cursor:pointer;user-select:none;outline:0}
#mesa .lb-it canvas{display:block;width:100%;height:auto;border-radius:3px;background:#e6e6e6;box-shadow:0 0 0 1px var(--line);outline:2px solid transparent;outline-offset:2px}
#mesa .lb-it.on canvas{outline-color:var(--acc)}#mesa .lb-it:hover:not(.on) canvas,#mesa .lb-it:focus-visible canvas{outline-color:var(--line)}
#mesa .lb-n{display:flex;align-items:center;gap:4px;margin-top:5px;font-size:11.5px;color:var(--mute);white-space:nowrap}
#mesa .lb-n b{color:var(--ink);font-weight:600}#mesa .lb-n em{font-style:normal;color:var(--chg);font-weight:700}
#mesa .lb-mv{margin-left:auto;display:flex}
#mesa .lb-mv button{border:0;background:none;width:19px;height:22px;border-radius:5px;font-size:10.5px;line-height:22px;padding:0;color:var(--mute)}
#mesa .lb-mv button:hover:not(:disabled){background:var(--line2);color:var(--ink)}#mesa .lb-mv button:disabled{opacity:.25;cursor:default}
#mesa .lb-add{width:100%;font-size:12.5px;padding:6px 4px}
#mesa .lb-mid{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
#mesa .lb-scroll{flex:1;min-height:0;overflow:auto;display:flex;padding:18px}
#mesa .lb-cvw{margin:auto;flex:none;line-height:0}
#mesa .lb-cv{display:block;background:#e6e6e6;box-shadow:0 4px 22px rgba(0,0,0,.16);touch-action:none}
#mesa .lb-hint{flex:none;margin:0;padding:4px 12px 10px;text-align:center;color:var(--mute);font-size:12px}
#mesa .lb-panel{overflow-y:auto;padding:0 16px 24px;background:var(--panel);border-left:1px solid var(--line2)}
#mesa .lb-sec{padding:12px 0 14px;border-bottom:1px solid var(--line2)}#mesa .lb-sec:last-child{border-bottom:0}
#mesa .lb-sec h4{margin:0 0 8px;font-size:13px;font-weight:600}#mesa .lb-sec h4 span{font-weight:400;color:var(--mute);font-size:12px}
#mesa .lb-p{margin:6px 0 0;font-size:12.5px;color:var(--mute)}
#mesa .lb-l{display:block;font-size:12.5px;font-weight:600;margin:12px 0 6px}
#mesa .lb-sws{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
#mesa .lb-sw{width:24px;height:24px;border-radius:50%;border:1px solid rgba(0,0,0,.18);padding:0}
#mesa .lb-sw.on{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--acc)}
#mesa .lb-pick{width:26px;height:26px;padding:0;border:1px dashed #b5b5b5;border-radius:50%;background:none;cursor:pointer;overflow:hidden}
#mesa .lb-pick::-webkit-color-swatch-wrapper{padding:3px}#mesa .lb-pick::-webkit-color-swatch{border:0;border-radius:50%}
#mesa .lb-more{width:26px;height:26px;border-radius:50%;border:1px dashed #b5b5b5;background:var(--panel);color:var(--mute);font-size:15px;line-height:1;padding:0}#mesa .lb-more:hover{border-color:var(--ink);color:var(--ink)}
#mesa .lb-rng{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:12.5px}#mesa .lb-rng span{flex:none;width:72px}
#mesa .lb-rng input{flex:1;min-width:0}#mesa .lb-rng output{min-width:3em;text-align:right;color:var(--mute);font-variant-numeric:tabular-nums}
#mesa .lb-num{width:64px;border:1px solid var(--line);border-radius:8px;padding:5px 7px;font:inherit;font-size:12.5px}
#mesa .lb-nums{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}#mesa .lb-nums label{font-size:11.5px;color:var(--mute)}#mesa .lb-nums .lb-num{width:100%;box-sizing:border-box;margin-top:2px}
#mesa .lb-ta{display:block;width:100%;box-sizing:border-box;min-height:70px;resize:vertical;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:inherit;font-size:13px;line-height:1.4}
#mesa .lb-ta:focus,#mesa .lb-sel:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
#mesa .lb-sel{display:block;width:100%;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;background:var(--panel)}
#mesa .lb-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#mesa .lb-btns .btn2,#mesa .lb-btns .btn{padding:5px 9px;font-size:12.5px}
#mesa .lb-btns .btn2.on{background:var(--ink);border-color:var(--ink);color:#fff}
#mesa .lb-photos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
#mesa .lb-ph{position:relative;aspect-ratio:1;border:0;padding:0;border-radius:5px;overflow:hidden;background:#efefef}#mesa .lb-ph:hover{outline:3px solid var(--acc);outline-offset:-3px}
#mesa .lb-ph img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
#mesa .lb-ph.logo{background:repeating-conic-gradient(#d9d9d9 0 25%,#f4f4f4 0 50%) 0 0/12px 12px}#mesa .lb-ph.logo img{object-fit:contain;padding:6px;box-sizing:border-box}
#mesa .lb-ph .x{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:11px;line-height:18px;text-align:center}
#mesa .lb-grids{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#mesa .lb-g{border:1px solid var(--line);border-radius:6px;background:var(--panel);padding:6px;height:56px}#mesa .lb-g:hover{border-color:var(--ink)}
#mesa .lb-g svg{width:100%;height:100%;display:block}
#mesa .lb-tpls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}
#mesa .lb-tp{position:relative;min-width:0}#mesa .lb-tp canvas{width:100%;height:auto;display:block;border-radius:4px;cursor:pointer;outline:1px solid var(--line2)}
#mesa .lb-tp canvas:hover{outline:2px solid var(--acc)}
#mesa .lb-tp span{display:block;font-size:11px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px}
#mesa .lb-tp button{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:12px;line-height:20px;padding:0}
#mesa .lb-caps{border:1px solid var(--line2);border-radius:8px;overflow:hidden}
#mesa .lb-cap{display:flex;align-items:center;gap:2px;padding:4px 6px 4px 9px;font-size:12.5px;cursor:pointer;border-top:1px solid var(--line2)}#mesa .lb-cap:first-child{border-top:0}
#mesa .lb-cap:hover{background:var(--bg)}#mesa .lb-cap.on{background:#e8f3fe}
#mesa .lb-capn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mesa .lb-capn i{font-style:normal;color:var(--mute)}
#mesa .lb-cap button{border:0;background:none;width:22px;height:22px;border-radius:5px;padding:0;font-size:11px;color:var(--mute)}
#mesa .lb-cap button:hover:not(:disabled){background:var(--line2);color:var(--ink)}#mesa .lb-cap button:disabled{opacity:.25}
#mesa .lb-cap.off .lb-capn{opacity:.45}
#mesa .lb-all{position:absolute;inset:0;z-index:20;background:var(--bg);overflow:auto;padding:16px 20px}
#mesa .lb-allh{display:flex;align-items:center;gap:12px;margin-bottom:14px}#mesa .lb-allh h4{margin:0;font-size:15px;flex:1}
#mesa .lb-allg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:18px}
#mesa .lb-allit{border:0;background:none;padding:0;text-align:left;font-size:12px;color:var(--mute)}
#mesa .lb-allit canvas{display:block;width:100%;height:auto;border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.12);outline:2px solid transparent;outline-offset:3px;margin-bottom:6px}
#mesa .lb-allit.on canvas,#mesa .lb-allit:hover canvas{outline-color:var(--acc)}
#mesa .lb-ask{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}
#mesa .lb-askc{background:var(--panel);border-radius:12px;padding:18px 18px 16px;max-width:400px;box-shadow:0 10px 40px rgba(0,0,0,.25)}
#mesa .lb-askc h4{margin:0 0 6px;font-size:15px}#mesa .lb-askc p{margin:0 0 6px;color:var(--mute);font-size:13px}
#mesa .lb-askin{display:block;width:100%;box-sizing:border-box;margin:8px 0 4px;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:inherit;font-size:13px}#mesa .lb-askin:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
@media (max-width:900px){#mesa .lb-body{grid-template-columns:104px minmax(0,1fr);grid-template-rows:minmax(240px,55%) minmax(0,1fr)}#mesa .lb-panel{grid-column:1/-1;border-left:0;border-top:1px solid var(--line2)}#mesa .lb-list{grid-row:1;padding:10px 8px}#mesa .lb-scroll{padding:10px}#mesa .lb-add{font-size:11.5px;padding:5px 2px}}`;
  function injectCSS() { let st = document.getElementById('lb-css'); if (!st) { st = document.createElement('style'); st.id = 'lb-css'; document.head.append(st); } if (st.textContent !== CSS) st.textContent = CSS; }

  function build(s) {
    const root = I().root(), el = document.createElement('div');
    el.className = 'lb'; el.tabIndex = -1;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Editar ' + s.name);
    el.innerHTML = `<header class="lb-head"><div class="lb-ttl"><h3>${esc(s.name)}</h3><p>${E.car ? 'Editar diapositivas' : 'Editar foto'} · lo que no toques se queda como está</p></div>`
      + `<div class="seg lb-fmt" role="group" aria-label="Formato">${Object.entries(FMTS).map(([k, l]) => `<button type="button" data-lb="fmt" data-v="${k}">${l}</button>`).join('')}</div>`
      + '<span class="lb-tools"><button type="button" class="lb-ib" data-lb="undo" title="Deshacer (⌘Z)" aria-label="Deshacer">↶</button><button type="button" class="lb-ib" data-lb="redo" title="Rehacer (⇧⌘Z)" aria-label="Rehacer">↷</button></span>'
      + '<span class="lb-tools"><button type="button" class="lb-ib" data-lb="zout" title="Alejar" aria-label="Alejar">−</button><output class="lb-zv">100 %</output><button type="button" class="lb-ib" data-lb="zin" title="Acercar" aria-label="Acercar">+</button><button type="button" class="lb-ib" data-lb="zfit" title="Ver la diapositiva entera">Ajustar</button></span>'
      + '<button type="button" class="lb-ib" data-lb="iman" title="Imán: alinea con los bordes, el centro y los otros elementos al arrastrar (con ⌘ pulsado no actúa)">Imán</button>'
      + '<button type="button" class="lb-ib" data-lb="todas" title="Todas las diapositivas en grande">Ver todas</button>'
      + '<span class="lb-state" aria-live="polite"></span><button type="button" class="btn2" data-lb="cerrar">Cerrar</button><button type="button" class="btn" data-lb="aplicar">Aplicar a la casilla</button></header>'
      + '<div class="lb-body"><nav class="lb-list" aria-label="Diapositivas"></nav>'
      + '<section class="lb-mid"><div class="lb-scroll"><div class="lb-cvw"><canvas class="lb-cv" aria-label="Diapositiva"></canvas></div></div>'
      + '<p class="lb-hint">Clic: elegir (⇧ para varios) · arrastra para mover · esquinas: tamaño · lados: recortar o ancho del texto · círculo: girar · doble clic: encuadrar la foto o escribir · ⌘C ⌘V · ⌘G agrupar · ⌘Z</p></section>'
      + '<aside class="lb-panel"></aside></div><div class="lb-all" hidden></div><input type="file" class="lb-logoin" accept="image/png,image/webp,image/jpeg" multiple hidden>';
    root.append(el);
    // the mesa behind can't be reached with Tab while the editor is open (toasts stay usable)
    E.inert = [...root.children].filter(c => c !== el && !c.matches('.toasts, .lock, style') && !c.hasAttribute('inert'));
    E.inert.forEach(c => c.setAttribute('inert', ''));
    E.el = el; E.cv = el.querySelector('.lb-cv'); E.ctx = E.cv.getContext('2d'); E.scroll = el.querySelector('.lb-scroll'); E.allEl = el.querySelector('.lb-all');
    const ae = document.activeElement; if (ae && ae.blur && root.contains(ae)) ae.blur();
    el.focus({ preventScroll: true });
    wire(el);
    window.addEventListener('keydown', onKey, true);
    E.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => pedir()) : null;
    if (E.ro) E.ro.observe(E.scroll);
    todo();
  }
  function head() {
    if (!E || !E.el) return;
    const q = s => E.el.querySelector(s), p = pendiente(), st = q('.lb-state');
    st.textContent = E.busy ? 'Aplicando…' : p ? 'Cambios sin aplicar' : 'Sin cambios'; st.className = 'lb-state' + (p && !E.busy ? ' chg' : '');
    q('[data-lb="undo"]').disabled = !E.hist.undo.length || E.busy; q('[data-lb="redo"]').disabled = !E.hist.redo.length || E.busy;
    q('[data-lb="aplicar"]').disabled = E.busy; q('[data-lb="cerrar"]').disabled = E.busy;
    q('.lb-zv').textContent = Math.round(E.zoom * 100) + ' %';
    q('[data-lb="iman"]').classList.toggle('on', E.iman);
    const f = fmtAt(E.i);
    E.el.querySelectorAll('.lb-fmt button').forEach(b => { const on = b.dataset.v === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  function lista() {
    const nav = E.el.querySelector('.lb-list'), top = nav.scrollTop, n = E.sl.length;
    nav.innerHTML = E.sl.map((x, i) => {
      const tag = !x.key ? 'nueva' : x.out || changedSl(x) ? 'editada' : 'foto';
      return `<div class="lb-it${i === E.i ? ' on' : ''}" data-lb="sl" data-i="${i}" tabindex="0" role="button" aria-label="Diapositiva ${i + 1}"><canvas></canvas>`
        + `<div class="lb-n"><b>${i + 1}</b> ${tag}${changedSl(x) || (!E.car && x.fmt !== x.fmt0) ? ' <em title="Cambios sin aplicar">•</em>' : ''}<span class="lb-mv">`
        + `<button type="button" data-lb="sl-up" data-i="${i}" title="Mover antes" aria-label="Mover antes"${i === 0 ? ' disabled' : ''}>▲</button>`
        + `<button type="button" data-lb="sl-dn" data-i="${i}" title="Mover después" aria-label="Mover después"${i === n - 1 ? ' disabled' : ''}>▼</button>`
        + `<button type="button" data-lb="sl-del" data-i="${i}" title="Quitar la diapositiva (su foto vuelve a la bandeja al aplicar)" aria-label="Quitar la diapositiva">×</button></span></div></div>`;
    }).join('') + `<button type="button" class="btn2 lb-add" data-lb="sl-add" title="Una diapositiva solo con color de fondo, detrás de la elegida">+ Diapositiva sin foto</button>`;
    nav.scrollTop = top;
    minis();
  }
  function mini(cv, i, w) {
    const { W, H } = sizeAt(i), h = Math.round(w * H / W);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const x = cv.getContext('2d'), k = w / W; x.setTransform(k, 0, 0, k, 0, 0); x.imageSmoothingQuality = 'high';
    drawComp(x, compAt(i), W, H, viewImg, k, false);
  }
  function minis() {
    if (!E) return;
    E.el.querySelectorAll('.lb-list .lb-it canvas').forEach((cv, i) => { if (E.sl[i]) mini(cv, i, 216); });
    if (!E.allEl.hidden) E.allEl.querySelectorAll('canvas').forEach((cv, i) => { if (E.sl[i]) mini(cv, i, 360); });
  }
  function verTodas(on) {
    const a = E.allEl;
    if (!on) { a.hidden = true; a.innerHTML = ''; return; }
    a.innerHTML = `<div class="lb-allh"><h4>Todas las diapositivas</h4><button type="button" class="btn2" data-lb="todas">Volver</button></div><div class="lb-allg">`
      + E.sl.map((x, i) => `<button type="button" class="lb-allit${i === E.i ? ' on' : ''}" data-lb="sl" data-i="${i}"><canvas></canvas>Diapositiva ${i + 1}${!x.key ? ' · nueva' : x.out || changedSl(x) ? ' · editada' : ''}</button>`).join('') + '</div>';
    a.hidden = false; minis();
  }
  function elegir(i) {
    if (!E || !E.sl.length) return;
    const n = clamp(i, 0, E.sl.length - 1); if (n === E.i) return;
    E.i = n; soltar(); E.crop = null; E.pick = null;
    E.el.querySelectorAll('.lb-list .lb-it').forEach((it, k) => it.classList.toggle('on', k === n));
    const it = E.el.querySelectorAll('.lb-list .lb-it')[n]; if (it) it.scrollIntoView({ block: 'nearest' });
    panel(); head(); pedir();
  }

  // ---------- the canvas: drawing (rAF) ----------
  function pedir() { if (E && !E.raf) E.raf = requestAnimationFrame(frame); }
  function frame() {
    if (!E) return;
    E.raf = 0;
    E.cv.style.visibility = E.sl.length ? '' : 'hidden';
    if (!E.sl.length) return;
    const { W, H } = E.sz = sizeAt(E.i), sc = E.scroll, cs = getComputedStyle(sc);
    const aw = Math.max(80, sc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), ah = Math.max(80, sc.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    E.k = Math.min(aw / W, ah / H) * E.zoom;
    const dpr = window.devicePixelRatio || 1, cw = Math.round(W * E.k), ch = Math.round(H * E.k);
    if (E.cv.width !== Math.round(cw * dpr) || E.cv.height !== Math.round(ch * dpr)) { E.cv.width = Math.round(cw * dpr); E.cv.height = Math.round(ch * dpr); E.cv.style.width = cw + 'px'; E.cv.style.height = ch + 'px'; }
    const x = E.ctx, k = E.k * dpr;
    x.setTransform(k, 0, 0, k, 0, 0); x.imageSmoothingQuality = 'high';
    const comp = compAt(E.i);
    comp.els.forEach(e => { if (e.t === 'texto') ajustarTexto(e, W, H); });   // a text's frame follows its lines (its font may have just loaded)
    drawComp(x, comp, W, H, viewImg, k, true);
    const el = selEl();
    if (el && E.crop === el.id) cropView(x, el, W, H, k);
    const ss = selEls(); ss.forEach(e => marco(x, e, W, H, ss.length === 1));
    for (const g of E.guides) { x.save(); x.strokeStyle = '#ff2d95'; x.lineWidth = 1 / E.k; x.beginPath(); if (g.x != null) { x.moveTo(g.x, 0); x.lineTo(g.x, H); } else { x.moveTo(0, g.y); x.lineTo(W, g.y); } x.stroke(); x.restore(); }
    if (E.reMini) { clearTimeout(E.miniT); E.miniT = setTimeout(() => { if (!E) return; if (E.drag) { pedir(); return; } E.reMini = false; minis(); }, 80); }   // thumbnails once a drag stops
  }
  // the frame being reframed: the whole photo shows faintly around it
  function cropView(x, el, W, H, k) {
    const m = el.src && viewImg(el.src), f = el.src && M.files[el.src]; if (!m || !f) return;
    const fw = el.w * W, fh = el.h * H, ib = hueco(el, fw, fh), sr = srcRect(el, f.w, f.h, ib.w, ib.h), s = ib.w / sr.w;
    x.save(); x.translate(el.x * W + fw / 2, el.y * H + fh / 2); if (el.rot) x.rotate(el.rot * Math.PI / 180); x.translate(ib.x + ib.w / 2, ib.y + ib.h / 2); x.scale(el.fx ? -1 : 1, el.fy ? -1 : 1);
    x.globalAlpha = 0.38; x.drawImage(m.im, 0, 0, m.im.width, m.im.height, -ib.w / 2 - sr.x * s, -ib.h / 2 - sr.y * s, f.w * s, f.h * s); x.restore();
    drawEl(x, el, W, H, viewImg, k, true);
  }
  function marco(x, el, W, H, solo) {
    const g = geo(el, W, H), u = 1 / E.k;
    x.save(); x.translate(g.cx, g.cy); x.rotate(g.a);
    x.lineWidth = 1.5 * u; x.strokeStyle = '#0095f6';
    if (el.lock || el.oculto || !solo) x.setLineDash([5 * u, 4 * u]);
    x.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h); x.setLineDash([]);
    if (solo && !el.lock && E.crop !== el.id) {
      x.beginPath(); x.moveTo(0, -g.h / 2); x.lineTo(0, -g.h / 2 - ROT_D * u); x.stroke();
      x.beginPath(); x.arc(0, -g.h / 2 - ROT_D * u, 6 * u, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.stroke();
      const hs = 9 * u;
      for (const [hx, hy] of asas(el, g)) { x.fillStyle = '#fff'; x.fillRect(hx * g.w / 2 - hs / 2, hy * g.h / 2 - hs / 2, hs, hs); x.strokeRect(hx * g.w / 2 - hs / 2, hy * g.h / 2 - hs / 2, hs, hs); }
    }
    if (el.lock && solo) { x.fillStyle = '#0095f6'; x.font = `600 ${12 * u}px -apple-system,sans-serif`; x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText('🔒', -g.w / 2 + 6 * u, -g.h / 2 + 6 * u); }
    x.restore();
  }

  // ---------- geometry (slide units: OUT_W wide) ----------
  const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  function asas(el, g) {           // a logo only scales; a text scales from the corners and changes its width from the sides; a line only stretches
    if (el.t === 'forma' && el.forma === 'linea') return HANDLES.filter(([a, b]) => a && !b);
    const big = Math.min(g.w, g.h) * E.k >= 46;
    return HANDLES.filter(([a, b]) => el.t === 'logo' ? a && b : el.t === 'texto' ? a && (b || g.w * E.k >= 46) : (a && b) || big);
  }
  function geo(el, W, H) { const w = el.w * W, h = el.h * H; return { cx: el.x * W + w / 2, cy: el.y * H + h / 2, w, h, a: (el.rot || 0) * Math.PI / 180 }; }
  function local(g, p) { const dx = p.x - g.cx, dy = p.y - g.cy, c = Math.cos(-g.a), s = Math.sin(-g.a); return { x: dx * c - dy * s, y: dx * s + dy * c }; }
  function world(g, l) { const c = Math.cos(g.a), s = Math.sin(g.a); return { x: g.cx + l.x * c - l.y * s, y: g.cy + l.x * s + l.y * c }; }
  function aabb(el, W, H) { const g = geo(el, W, H), ps = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => world(g, { x: a * g.w / 2, y: b * g.h / 2 })); const xs = ps.map(p => p.x), ys = ps.map(p => p.y); return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) }; }
  function union(els, W, H) { const bs = els.map(e => aabb(e, W, H)); return { l: Math.min(...bs.map(b => b.l)), r: Math.max(...bs.map(b => b.r)), t: Math.min(...bs.map(b => b.t)), b: Math.max(...bs.map(b => b.b)) }; }
  // a thin line still takes a click a few screen pixels around it
  const inside = (el, p) => { const { W, H } = E.sz, g = geo(el, W, H), l = local(g, p), m = 6 / E.k; return Math.abs(l.x) <= Math.max(g.w / 2, m) && Math.abs(l.y) <= Math.max(g.h / 2, m); };
  function hitEl(p) { const c = compAt(E.i); for (let k = c.els.length - 1; k >= 0; k--) if (!c.els[k].oculto && inside(c.els[k], p)) return c.els[k]; return null; }
  function hitHandle(el, p) {
    const { W, H } = E.sz, g = geo(el, W, H), l = local(g, p), r = 10 / E.k;
    if (Math.hypot(l.x, l.y + g.h / 2 + ROT_D / E.k) <= r) return { rot: true };
    for (const [hx, hy] of asas(el, g)) if (Math.abs(l.x - hx * g.w / 2) <= r && Math.abs(l.y - hy * g.h / 2) <= r) return { hx, hy };
    return null;
  }
  // the magnet: slide edges and centre, and the other elements' edges and centres
  function targets(skip) {
    const { W, H } = E.sz, xs = [0, W / 2, W], ys = [0, H / 2, H];
    for (const o of compAt(E.i).els) if (!skip.includes(o.id) && !o.oculto) { const b = aabb(o, W, H); xs.push(b.l, (b.l + b.r) / 2, b.r); ys.push(b.t, (b.t + b.b) / 2, b.b); }
    return { xs, ys };
  }
  function nearest(vals, cands) {     // the smallest move that puts one of vals on a candidate (within SNAP)
    let best = null;
    for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) * E.k <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c }; }
    return best;
  }
  function setPhoto(el, patch) {      // the photo inside its frame, clamped like the mesa's reframe
    Object.assign(el, patch); el.z = clamp(el.z || 1, 1, 3);
    const f = el.src && M.files[el.src]; if (!f || el.t !== 'foto') return;
    const { W, H } = sizeAt(E.i), ib = hueco(el, el.w * W, el.h * H), r = srcRect(el, f.w, f.h, ib.w, ib.h);
    el.cx = r4((r.x + r.w / 2) / f.w); el.cy = r4((r.y + r.h / 2) / f.h);
  }
  function encajar(el, m, i = E.i) {  // the whole photo, centred, inside the slide less a margin (fraction of the width)
    const f = el.src && M.files[el.src]; if (!f) return;
    const { W, H } = sizeAt(i), aw = W - 2 * m * W, ah = H - 2 * m * W, ar = f.w / f.h;
    let w = aw, h = aw / ar; if (h > ah) { h = ah; w = ah * ar; }
    Object.assign(el, { w: r4(w / W), h: r4(h / H), x: r4((W - w) / 2 / W), y: r4((H - h) / 2 / H), cx: 0.5, cy: 0.5, z: 1, rot: 0, fit: m, marco: null });
  }
  function llenar(el) { Object.assign(el, { x: 0, y: 0, w: 1, h: 1, cx: 0.5, cy: 0.5, z: 1, rot: 0 }); delete el.fit; }
  // a grid of n cells (px) with gap g between them and around them
  function cells(name, W, H, g) {
    const split = (x, y, w, h, n, vert) => Array.from({ length: n }, (_, k) => vert ? { x, y: y + k * ((h - (n - 1) * g) / n + g), w, h: (h - (n - 1) * g) / n } : { x: x + k * ((w - (n - 1) * g) / n + g), y, w: (w - (n - 1) * g) / n, h });
    const iw = W - 2 * g, ih = H - 2 * g;
    if (name === '2h') return split(g, g, iw, ih, 2, false);
    if (name === '2v') return split(g, g, iw, ih, 2, true);
    if (name === '3h') return split(g, g, iw, ih, 3, false);
    if (name === '3v') return split(g, g, iw, ih, 3, true);
    if (name === '3a') { const [a, b] = split(g, g, iw, ih, 2, false); return [a, ...split(b.x, b.y, b.w, b.h, 2, true)]; }
    const [t, u] = split(g, g, iw, ih, 2, true); return [...split(t.x, t.y, t.w, t.h, 2, false), ...split(u.x, u.y, u.w, u.h, 2, false)];
  }
  const GRIDS = [['2h', '2 en columna'], ['2v', '2 en fila'], ['3a', '1 grande + 2'], ['3h', '3 en columna'], ['3v', '3 en fila'], ['4', '4 (2 × 2)']];
  function rejilla(c, name, g) {       // the slide's photos go into the cells in order (styles kept by position); texts, logos and shapes stay on top
    const { W, H } = sizeAt(E.i), cs = cells(name, W, H, g * W), old = fotosDe(c), fotos = old.map(e => e.src).filter(Boolean), otros = c.els.filter(e => e.t !== 'foto');
    c.els = [...cs.map((q, k) => { const o = old[k], e = fotoEl(fotos[k] || null); if (o) Object.assign(e, { b: o.b, bc: o.bc, r: o.r, sh: o.sh, op: o.op ?? 1 }); return Object.assign(e, { x: r4(q.x / W), y: r4(q.y / H), w: r4(q.w / W), h: r4(q.h / H) }); }), ...otros];
    c.rej = { n: name, g };
  }
  function separar(c, g) {             // the gap of the grid in place: same photos, same cells
    const { W, H } = sizeAt(E.i), cs = cells(c.rej.n, W, H, g * W);
    fotosDe(c).forEach((e, k) => { const q = cs[k]; if (!q) return; Object.assign(e, { x: r4(q.x / W), y: r4(q.y / H), w: r4(q.w / W), h: r4(q.h / H), rot: 0 }); delete e.fit; if (e.src) setPhoto(e, {}); });
    c.rej.g = g;
  }

  // ---------- pointer ----------
  function toSlide(e) { const r = E.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / E.k, y: (e.clientY - r.top) / E.k }; }
  function onDown(e) {
    if (e.button !== 0 || E.busy || !E.sl.length) return;
    E.el.focus({ preventScroll: true });
    const p = toSlide(e), sel = selEl();
    let d = null;
    if (E.crop) { const el = compAt(E.i).els.find(x => x.id === E.crop); if (el && inside(el, p)) d = { t: 'pan', id: el.id, p0: p, el0: clone(el) }; else { E.crop = null; panel(); } }
    if (!d && sel && !sel.lock && !multi() && !e.shiftKey) { const h = hitHandle(sel, p); if (h) d = h.rot ? { t: 'rot', id: sel.id, el0: clone(sel) } : { t: 'size', id: sel.id, el0: clone(sel), hx: h.hx, hy: h.hy }; }
    if (!d) {
      const el = hitEl(p);
      if (el) {
        const was = selIds().includes(el.id), many = multi();
        if (e.shiftKey) { seleccionar(el, true); E.pick = null; panel(); if (!selIds().includes(el.id)) { pedir(); return; } }
        else if (!was) { seleccionar(el); E.pick = null; panel(); }
        const movil = selEls().filter(x => !x.lock);
        d = { t: 'move', id: el.id, p0: p, el0s: movil.map(clone), lock: !movil.some(x => x.id === el.id), reduce: was && many && !e.shiftKey && !el.g };
      } else if (E.sel || E.pick) { soltar(); E.pick = null; panel(); }
    }
    pedir();
    if (!d) return;
    d.step = false; E.drag = d;
    try { E.cv.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    e.preventDefault();
  }
  function onMove(e) {
    if (!E) return;
    if (!E.drag) { cursor(e); return; }
    const d = E.drag, p = toSlide(e), { W, H } = E.sz;
    if (!d.step) { if (d.lock || (d.t === 'move' && Math.hypot(p.x - d.p0.x, p.y - d.p0.y) * E.k < 3)) return; paso(); ensure(); d.step = true; }
    const els = compAt(E.i).els, el = els.find(x => x.id === d.id); if (!el) return;
    const mag = E.iman && !(e.metaKey || e.ctrlKey);
    E.guides = [];
    if (d.t === 'move') {
      let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      if (mag && d.el0s.length) {
        const b = union(d.el0s, W, H), t = targets(d.el0s.map(o => o.id));
        const sx = nearest([b.l + dx, (b.l + b.r) / 2 + dx, b.r + dx], t.xs), sy = nearest([b.t + dy, (b.t + b.b) / 2 + dy, b.b + dy], t.ys);
        if (sx) { dx += sx.d; E.guides.push({ x: sx.at }); }
        if (sy) { dy += sy.d; E.guides.push({ y: sy.at }); }
      }
      for (const o of d.el0s) { const q = els.find(x => x.id === o.id); if (q) { q.x = r4(o.x + dx / W); q.y = r4(o.y + dy / H); delete q.fit; } }
    } else if (d.t === 'size') {
      const g0 = geo(d.el0, W, H), A = world(g0, { x: -d.hx * g0.w / 2, y: -d.hy * g0.h / 2 }), ga = { ...g0, cx: A.x, cy: A.y }, l = local(ga, p), MIN = 0.03 * W;
      let w = g0.w, h = g0.h;
      const prop = el.t === 'logo' || (d.hx && d.hy && (!e.shiftKey || el.t === 'texto'));
      if (prop) { const s = (l.x * d.hx * g0.w + l.y * d.hy * g0.h) / (g0.w * g0.w + g0.h * g0.h); w = g0.w * s; h = g0.h * s; if (w < MIN || h < MIN) { const k = MIN / Math.min(g0.w, g0.h); w = g0.w * k; h = g0.h * k; } }
      else { if (d.hx) w = Math.max(MIN, l.x * d.hx); if (d.hy) h = Math.max(el.t === 'forma' ? 2 : MIN, l.y * d.hy); }
      if (mag && !el.rot) {           // the edge being dragged sticks to the slide's and the other elements' lines
        const t = targets([el.id]);
        if (d.hx) { const edge = A.x + d.hx * w, s = nearest([edge], t.xs); if (s) { const nw = Math.abs(s.at - A.x); if (nw >= MIN) { if (prop) h = h * nw / w; w = nw; E.guides.push({ x: s.at }); } } }
        if (d.hy && !prop) { const edge = A.y + d.hy * h, s = nearest([edge], t.ys); if (s) { const nh = Math.abs(s.at - A.y); if (nh >= MIN) { h = nh; E.guides.push({ y: s.at }); } } }
      }
      if (el.t === 'texto') { if (prop) el.size = r4((d.el0.size || 0.06) * w / g0.w); el.w = r4(w / W); ajustarTexto(el, W, H); h = el.h * H; }
      const C = world(ga, { x: d.hx * w / 2, y: d.hy * h / 2 });
      el.w = r4(w / W); el.h = r4(h / H); el.x = r4((C.x - w / 2) / W); el.y = r4((C.y - h / 2) / H); delete el.fit;
      if (el.t === 'texto' && !d.hy) el.y = d.el0.y;   // a text keeps its top when only its width changes
      if (el.src) setPhoto(el, {});
    } else if (d.t === 'rot') {
      const g0 = geo(d.el0, W, H);
      let a = Math.atan2(p.y - g0.cy, p.x - g0.cx) * 180 / Math.PI + 90;
      a = ((a + 180) % 360 + 360) % 360 - 180;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else if (mag) for (const q of [-180, -90, 0, 90, 180]) if (Math.abs(a - q) < 4) a = q;
      el.rot = Math.round(a * 10) / 10; if (el.rot === -180) el.rot = 180;
      delete el.fit;
    } else if (d.t === 'pan') {
      const f = el.src && M.files[el.src]; if (!f) return;
      const g0 = geo(d.el0, W, H), ib = hueco(d.el0, g0.w, g0.h), sr = srcRect(d.el0, f.w, f.h, ib.w, ib.h), s = ib.w / sr.w;
      const dl = local({ ...g0, cx: 0, cy: 0 }, { x: p.x - d.p0.x, y: p.y - d.p0.y });
      const ddx = d.el0.fx ? -dl.x : dl.x, ddy = d.el0.fy ? -dl.y : dl.y;
      setPhoto(el, { cx: d.el0.cx - ddx / s / f.w, cy: d.el0.cy - ddy / s / f.h });
    }
    if (d.t !== 'pan' && d.t !== 'rot' && E.sel === el.id) syncNums(el);
    pedir();
  }
  function onUp() {
    if (!E || !E.drag) return;
    const d = E.drag; E.drag = null; E.guides = [];
    if (d.step) { despues(true); lista(); }
    else if (d.t === 'move') {
      const el = compAt(E.i).els.find(x => x.id === d.id);
      if (d.reduce && el) seleccionar(el);       // a click on one of several selected: only that one
      else if (el && el.t === 'foto' && !el.src && !d.lock && !multi()) E.pick = { modo: 'fill', id: el.id };
    }
    panel(); pedir();
  }
  function cursor(e) {
    if (E.busy || !E.sl.length) return;
    const p = toSlide(e), sel = selEl();
    let c = 'default';
    if (E.crop) { const el = compAt(E.i).els.find(x => x.id === E.crop); if (el && inside(el, p)) c = 'grab'; }
    else {
      const h = sel && !sel.lock && !multi() ? hitHandle(sel, p) : null;
      if (h) c = h.rot ? 'grab' : !h.hx ? 'ns-resize' : !h.hy ? 'ew-resize' : h.hx === h.hy ? 'nwse-resize' : 'nesw-resize';
      else { const el = hitEl(p); if (el) c = el.lock ? 'pointer' : 'move'; }
    }
    if (E.cv.style.cursor !== c) E.cv.style.cursor = c;
  }
  function onDbl(e) {
    if (!E.sl.length || E.busy) return;
    const el = hitEl(toSlide(e)); if (!el || el.lock) return;
    if (el.t === 'texto') { seleccionar(el); E.pick = null; panel(); const ta = E.el.querySelector('.lb-panel textarea[data-lb="txt"]'); if (ta) { ta.focus(); ta.select(); } pedir(); return; }
    if (el.t !== 'foto' || !el.src) return;
    seleccionar(el); E.crop = el.id; E.pick = null; panel(); pedir();
  }
  function onWheel(e) {
    if (!E.sl.length) return;
    if (E.crop) {
      const el = compAt(E.i).els.find(x => x.id === E.crop); if (!el) return;
      e.preventDefault(); mut('zoomfoto', () => { const c = ensure(), x = c.els.find(q => q.id === el.id); setPhoto(x, { z: (x.z || 1) * Math.exp(-e.deltaY * 0.0025) }); }, true); syncNums(selEl());
      return;
    }
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(E.zoom * Math.exp(-e.deltaY * 0.01)); }
  }
  function zoom(z) { E.zoom = clamp(z, 0.4, 4); head(); pedir(); }

  // ---------- the panel ----------
  const pxf = v => Math.round(v) + ' px';
  const OUTF = { 'velo-op': pct, 'velo-alc': pct, 'tex-op': pct, b: v => (v * 100).toFixed(1) + ' %', r: pct, sh: pct, op: pct, z: v => (+v).toFixed(2) + '×', fit: pct, gap: v => (v * 100).toFixed(1) + ' %', size: v => pxf(v * 1080), lh: v => (+v).toFixed(2), ls: v => (+v).toFixed(2) };
  const rng = (act, label, v, min, max, step) => `<label class="lb-rng"><span>${label}</span><input type="range" data-lb="${act}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${OUTF[act](v)}</output></label>`;
  function sws(act, curC, extra) {
    const seen = new Set(), all = [];
    const add = (c, t, mio) => { c = String(c).toLowerCase(); if (!hexOk(c) || seen.has(c)) return; seen.add(c); all.push({ c, t, mio }); };
    E.kit.forEach(k => add(k.c, 'Kit: ' + k.n)); E.mios.forEach(c => add(c, 'Color guardado (Alt + clic para quitarlo)', true)); BASICOS.forEach(c => add(c, c));
    const cc = hexOk(curC) ? curC.toLowerCase() : '#ffffff';
    return `<div class="lb-sws">${extra || ''}${all.map(o => `<button type="button" class="lb-sw${o.c === cc ? ' on' : ''}" style="background:${o.c}" data-lb="${act}" data-c="${o.c}" title="${esc(o.t)}" aria-label="${esc(o.t)}"${o.mio ? ' data-mio="1"' : ''}></button>`).join('')}`
      + `<input type="color" class="lb-pick" data-lb="${act}" value="${cc}" title="Otro color" aria-label="Otro color">`
      + `<button type="button" class="lb-more" data-lb="color-save" data-c="${cc}" title="Guardar ${cc} en los colores del cliente" aria-label="Guardar este color">+</button></div>`;
  }
  const seg = (act, opts, v) => `<div class="seg" role="group">${opts.map(([k, l]) => `<button type="button" data-lb="${act}" data-v="${k}" class="${k === v ? 'on' : ''}" aria-pressed="${k === v}">${l}</button>`).join('')}</div>`;
  function gridSvg(name) { const cs = cells(name, 40, 50, 3); return `<svg viewBox="0 0 40 50" aria-hidden="true"><rect x="0" y="0" width="40" height="50" rx="2" fill="#efefef"/>${cs.map(q => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" rx="1" fill="#b9b4ab"/>`).join('')}</svg>`; }
  function fotosDisponibles() {    // this post's photos (and the ones in its compositions), then the tray's
    const S = E.board, seen = new Set(), out = [];
    const add = f => { if (f && !isKit(f) && M.files[f] && !M.files[f].design && !seen.has(f)) { seen.add(f); out.push(f); } };
    E.sl.forEach(x => { if (x.key && !x.out) add(x.key); if (x.comp) fotosDe(x.comp).forEach(e => add(e.src)); });
    E.photos0.forEach(f => { const c = compOf(S, f); if (c) fotosDe(c.comp).forEach(e => add(e.src)); });
    S.tray.forEach(add);
    return out;
  }
  const NOMBRE = { foto: 'Foto', texto: 'Texto', logo: 'Logo', forma: 'Forma' };
  const FORMAS = { rect: 'Rectángulo', elipse: 'Círculo', linea: 'Línea' };
  function nombreEl(e) {
    if (e.t === 'texto') { const t = String(e.txt || '').replace(/\s+/g, ' ').trim(); return `Texto <i>«${esc(t.length > 24 ? t.slice(0, 23) + '…' : t || 'vacío')}»</i>`; }
    if (e.t === 'forma') return FORMAS[e.forma] || 'Forma';
    if (e.t === 'logo') return `Logo <i>${esc((M.files[e.src] || {}).name || '')}</i>`;
    return `Foto <i>${esc(e.src ? (M.files[e.src] || {}).name || '' : 'hueco vacío')}</i>`;
  }
  function capasHTML(c) {
    if (!c.els.length) return '';
    const ids = selIds(), n = c.els.length;
    return `<div class="lb-sec"><h4>Capas <span>· arriba, lo que está delante · ⇧ + clic para elegir varias</span></h4><div class="lb-caps">${c.els.map((e, k) => ({ e, k })).reverse().map(({ e, k }) => `<div class="lb-cap${ids.includes(e.id) ? ' on' : ''}${e.oculto ? ' off' : ''}" data-lb="cap" data-id="${esc(e.id)}"><span class="lb-capn">${e.g ? '⛓ ' : ''}${nombreEl(e)}</span>`
      + `<button type="button" data-lb="cap-ver" data-id="${esc(e.id)}" title="${e.oculto ? 'Mostrar' : 'Ocultar (no sale en la imagen)'}" aria-label="${e.oculto ? 'Mostrar' : 'Ocultar'}">${e.oculto ? '◌' : '◉'}</button>`
      + `<button type="button" data-lb="cap-lock" data-id="${esc(e.id)}" title="${e.lock ? 'Desbloquear' : 'Bloquear'}" aria-label="${e.lock ? 'Desbloquear' : 'Bloquear'}">${e.lock ? '🔒' : '🔓'}</button>`
      + `<button type="button" data-lb="cap-up" data-id="${esc(e.id)}" title="Adelante" aria-label="Adelante"${k === n - 1 ? ' disabled' : ''}>▲</button><button type="button" data-lb="cap-dn" data-id="${esc(e.id)}" title="Atrás" aria-label="Atrás"${k === 0 ? ' disabled' : ''}>▼</button></div>`).join('')}</div></div>`;
  }
  function medidasHTML(el) {
    const { H } = sizeAt(E.i), v = (a, val, dis) => `<label>${a}<input type="number" class="lb-num" data-lb="m${a.toLowerCase()}" step="1" value="${Math.round(val)}"${dis ? ' disabled' : ''}></label>`;
    return `<div class="lb-sec"><h4>Medidas <span>· en píxeles de una diapositiva de 1080 de ancho</span></h4><div class="lb-nums">${v('X', el.x * 1080)}${v('Y', el.y * H * PX)}${v('An', el.w * 1080)}${v('Al', el.h * H * PX, el.t === 'texto')}</div>`
      + rng('op', 'Opacidad', el.op ?? 1, 0, 1, 0.01)
      + `<div class="lb-btns"><button type="button" class="btn2" data-lb="al1" data-v="h" title="Centrar a lo ancho de la diapositiva">Centrar ↔</button><button type="button" class="btn2" data-lb="al1" data-v="v" title="Centrar a lo alto de la diapositiva">Centrar ↕</button></div></div>`;
  }
  function organizarHTML(el, c) {
    const k = c.els.indexOf(el), n = c.els.length;
    return `<div class="lb-sec"><h4>Organizar</h4><div class="lb-btns"><button type="button" class="btn2" data-lb="front"${k === n - 1 ? ' disabled' : ''} title="⇧⌘]">Al frente</button><button type="button" class="btn2" data-lb="fwd"${k === n - 1 ? ' disabled' : ''} title="⌘]">Adelante</button><button type="button" class="btn2" data-lb="bwd"${k === 0 ? ' disabled' : ''} title="⌘[">Atrás</button><button type="button" class="btn2" data-lb="back"${k === 0 ? ' disabled' : ''} title="⇧⌘[">Al fondo</button></div>`
      + `<div class="lb-btns"><button type="button" class="btn2" data-lb="dup" title="⌘D">Duplicar</button><button type="button" class="btn2" data-lb="copy" title="⌘C">Copiar</button>${clip() ? '<button type="button" class="btn2" data-lb="paste" title="⌘V">Pegar</button>' : ''}<button type="button" class="btn2${el.lock ? ' on' : ''}" data-lb="lock">${el.lock ? 'Desbloquear' : 'Bloquear'}</button><button type="button" class="btn2" data-lb="del" title="⌫"${el.lock ? ' disabled' : ''}>Borrar</button></div>`
      + (el.g ? '<div class="lb-btns"><button type="button" class="btn2" data-lb="ungroup" title="⇧⌘G">Desagrupar</button></div>' : '')
      + '<p class="lb-p">Flechas: mover poco a poco (con ⇧, más). Esc: soltar la selección.</p></div>';
  }
  function girarHTML(el, voltear) {
    return `<div class="lb-sec"><h4>Girar${voltear ? ' y voltear' : ''}</h4><div class="lb-btns" style="align-items:center"><label style="font-size:12.5px;display:flex;align-items:center;gap:6px">Ángulo <input type="number" class="lb-num" data-lb="rot" step="1" min="-180" max="180" value="${Math.round((el.rot || 0) * 10) / 10}">°</label>`
      + `<button type="button" class="btn2" data-lb="rotl" title="Girar 90° a la izquierda">⟲ 90°</button><button type="button" class="btn2" data-lb="rotr" title="Girar 90° a la derecha">⟳ 90°</button></div>`
      + (voltear ? `<div class="lb-btns"><button type="button" class="btn2${el.fx ? ' on' : ''}" data-lb="flipx">Voltear ↔</button><button type="button" class="btn2${el.fy ? ' on' : ''}" data-lb="flipy">Voltear ↕</button></div>` : '') + '</div>';
  }
  function fuenteSel(el) {
    const ls = E.fuentes, i = ls.findIndex(f => el.font && (f.file ? f.file === el.font.file : f.css === el.font.css)), opt = (f, k) => `<option value="${k}"${k === i ? ' selected' : ''}>${esc(f.n)}</option>`;
    const grp = (lbl, pred) => { const o = ls.map((f, k) => pred(f) ? opt(f, k) : '').join(''); return o ? `<optgroup label="${lbl}">${o}</optgroup>` : ''; };
    return `<select class="lb-sel" data-lb="font" aria-label="Fuente">${i < 0 && el.font ? `<option value="-1" selected>${esc(el.font.n || 'Fuente')}</option>` : ''}${grp('Del kit del cliente', f => f.kit)}${grp('De la mesa', f => f.file && !f.kit)}${grp('Del Mac', f => !f.file)}</select>`;
  }
  function panel() {
    if (!E || !E.el) return;
    const p = E.el.querySelector('.lb-panel'), top = p.scrollTop, x = cur();
    if (!x) { p.innerHTML = '<div class="lb-sec"><h4>Sin diapositivas</h4><p class="lb-p">Añade una y, dentro, sus fotos.</p><div class="lb-btns"><button type="button" class="btn2" data-lb="sl-add">+ Diapositiva sin foto</button></div></div>'; return; }
    if (E.pick) {
      const ls = fotosDisponibles(), t = E.pick.modo === 'add' ? 'Añadir una foto' : E.pick.modo === 'rep' ? 'Reemplazar la foto' : 'Foto para el hueco';
      p.innerHTML = `<div class="lb-sec"><h4>${t} <span>· de esta publicación y de la bandeja</span></h4>`
        + (ls.length ? `<div class="lb-photos">${ls.map(f => `<button type="button" class="lb-ph" data-lb="pickf" data-f="${esc(f)}" title="${esc(M.files[f].name || '')}"><img src="${M.files[f].thumbUrl || ''}" alt=""></button>`).join('')}</div>` : '<p class="lb-p">No hay fotos: añádelas a la bandeja de la mesa.</p>')
        + '<div class="lb-btns"><button type="button" class="btn2" data-lb="pick-x">Cancelar</button></div></div>';
      return;
    }
    const c = compAt(E.i), el = selEl();
    let h = '';
    if (multi()) {
      const ss = selEls(), grp = ss[0] && ss[0].g && ss.every(e => e.g === ss[0].g);
      h += `<div class="lb-sec"><h4>${ss.length} elementos <span>· ${grp ? 'agrupados' : 'elegidos'}</span></h4><div class="lb-btns">${grp ? '<button type="button" class="btn2" data-lb="ungroup" title="⇧⌘G">Desagrupar</button>' : '<button type="button" class="btn" data-lb="group" title="⌘G">Agrupar</button>'}<button type="button" class="btn2" data-lb="dup" title="⌘D">Duplicar</button><button type="button" class="btn2" data-lb="copy" title="⌘C">Copiar</button><button type="button" class="btn2" data-lb="lock">Bloquear o desbloquear</button><button type="button" class="btn2" data-lb="del" title="⌫">Borrar</button></div>`
        + `<span class="lb-l">Alinear entre ellos</span><div class="lb-btns">${[['izq', '⇤ Izquierda'], ['cen', '↔ Centro'], ['der', '⇥ Derecha'], ['arr', '⤒ Arriba'], ['med', '↕ Medio'], ['aba', '⤓ Abajo']].map(([v, l]) => `<button type="button" class="btn2" data-lb="al" data-v="${v}">${l}</button>`).join('')}</div>`
        + rng('op', 'Opacidad', ss[0] ? ss[0].op ?? 1 : 1, 0, 1, 0.01) + '<p class="lb-p">Arrastra cualquiera para moverlos juntos.</p></div>';
      h += capasHTML(c);
    } else if (el) {
      if (el.t === 'foto') {
        const crop = E.crop === el.id;
        h += `<div class="lb-sec"><h4>Foto <span>· ${el.lock ? 'bloqueada' : crop ? 'encuadrando: arrastra la foto dentro del marco' : 'elegida'}</span></h4>`;
        if (crop) h += rng('z', 'Zoom', el.z || 1, 1, 3, 0.01) + '<div class="lb-btns"><button type="button" class="btn2" data-lb="crop-c">Centrar</button><button type="button" class="btn" data-lb="crop">Listo</button></div>';
        else h += `<div class="lb-btns"><button type="button" class="btn2" data-lb="crop"${!el.src || el.lock ? ' disabled' : ''} title="Mover y ampliar la foto dentro de su marco (o doble clic)">Encuadrar</button><button type="button" class="btn2" data-lb="rep">${el.src ? 'Reemplazar' : 'Elegir foto'}</button>`
          + `<button type="button" class="btn2${el.fit != null ? ' on' : ''}" data-lb="encajar"${!el.src || el.lock ? ' disabled' : ''} title="La foto entera, centrada, con el fondo alrededor">Encajar</button><button type="button" class="btn2" data-lb="llenar"${el.lock ? ' disabled' : ''} title="La foto ocupa toda la diapositiva">Llenar</button></div>`
          + (el.fit != null ? rng('fit', 'Margen', el.fit, 0, 0.2, 0.005) : '');
        h += '</div>';
        h += `<div class="lb-sec"><h4>Marco</h4>${seg('marco', [['', 'Ninguno'], ['polaroid', 'Polaroid'], ['pelicula', 'Película'], ['cinta', 'Cinta']], el.marco || '')}</div>`;
        h += `<div class="lb-sec"><h4>Estilo</h4>${rng('b', 'Borde', el.b || 0, 0, 0.06, 0.001)}<span class="lb-l">Color del borde</span>${sws('bc', el.bc || '#ffffff')}${rng('r', 'Esquinas', el.r || 0, 0, 1, 0.01)}${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}</div>`;
        h += girarHTML(el, true);
      } else if (el.t === 'texto') {
        const css = !(el.font && el.font.file);
        h += `<div class="lb-sec"><h4>Texto <span>· doble clic en el texto para escribir</span></h4><textarea class="lb-ta" data-lb="txt" rows="3" aria-label="Texto">${esc(el.txt || '')}</textarea>`
          + `<span class="lb-l">Fuente</span>${fuenteSel(el)}${rng('size', 'Tamaño', el.size || 0.06, 0.015, 0.25, 0.001)}`
          + (css ? `<span class="lb-l">Grosor</span>${seg('peso', [['300', 'Fina'], ['400', 'Normal'], ['600', 'Semi'], ['700', 'Negrita']], String(el.peso || 400))}` : '')
          + `<span class="lb-l">Alineación</span><div class="lb-btns" style="margin-top:0">${seg('al', [['izq', 'Izquierda'], ['cen', 'Centro'], ['der', 'Derecha']], el.al || 'izq')}<button type="button" class="btn2${el.may ? ' on' : ''}" data-lb="may" title="Todo en mayúsculas">MAYÚS</button></div>`
          + `${rng('lh', 'Interlineado', el.lh || 1.2, 0.7, 2.2, 0.01)}${rng('ls', 'Espaciado', el.ls || 0, -0.1, 0.6, 0.005)}`
          + `<span class="lb-l">Color</span>${sws('tc', el.color || '#ffffff')}${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}</div>`;
        h += girarHTML(el, false);
      } else if (el.t === 'logo') {
        h += `<div class="lb-sec"><h4>Logo <span>· ${esc((M.files[el.src] || {}).name || '')}</span></h4>${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}<p class="lb-p">Las esquinas lo escalan sin deformarlo.</p></div>`;
        h += girarHTML(el, true);
      } else {
        h += `<div class="lb-sec"><h4>${FORMAS[el.forma] || 'Forma'}</h4><span class="lb-l" style="margin-top:0">Relleno</span>${sws('fc', el.color || '#ffffff')}`
          + (el.forma !== 'linea' ? `${rng('b', 'Borde', el.b || 0, 0, 0.03, 0.0005)}<span class="lb-l">Color del borde</span>${sws('bc', el.bc || '#000000')}` : '')
          + (el.forma === 'rect' ? rng('r', 'Esquinas', el.r || 0, 0, 1, 0.01) : '') + `${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}</div>`;
        h += girarHTML(el, false);
      }
      h += medidasHTML(el) + organizarHTML(el, c) + capasHTML(c);
    } else {
      const v = c.velo, n0 = E.i + 1, est = !x.key ? 'nueva, sin foto' : x.out || changedSl(x) ? 'editada' : 'foto sin editar';
      const solo = fotosDe(c).filter(e => e.src && M.files[e.src] && !M.files[e.src].design);
      h += `<div class="lb-sec"><h4>Diapositiva ${n0} <span>· ${est}</span></h4><div class="lb-btns"><button type="button" class="btn2" data-lb="add">+ Foto</button><button type="button" class="btn2" data-lb="add-txt">+ Texto</button><button type="button" class="btn2" data-lb="add-forma" data-v="rect">+ Rectángulo</button><button type="button" class="btn2" data-lb="add-forma" data-v="elipse">+ Círculo</button><button type="button" class="btn2" data-lb="add-forma" data-v="linea">+ Línea</button>${clip() ? '<button type="button" class="btn2" data-lb="paste" title="⌘V">Pegar</button>' : ''}`
        + (!isRaw(x) && x.key && solo.length ? `<button type="button" class="btn2" data-lb="sl-orig" title="La diapositiva vuelve a ser la foto, sin edición">Quitar la edición</button>` : '') + '</div>'
        + (c.els.length ? '<p class="lb-p">Clic en un elemento para moverlo, girarlo o darle estilo.</p>' : '') + '</div>';
      h += `<div class="lb-sec"><h4>Logos y pegatinas <span>· del cliente</span></h4>${E.logos.length ? `<div class="lb-photos">${E.logos.map(f => `<button type="button" class="lb-ph logo" data-lb="logo" data-f="${esc(f)}" title="Añadir ${esc(M.files[f].name || '')} (Alt + clic: quitarlo del kit)"><img src="${M.files[f].thumbUrl || ''}" alt=""></button>`).join('')}</div>` : '<p class="lb-p" style="margin:0">Sube el logo del cliente (mejor PNG con transparencia) y queda guardado para todos sus meses.</p>'}`
        + '<div class="lb-btns"><button type="button" class="btn2" data-lb="logo-up">Subir logo o pegatina</button></div></div>';
      h += `<div class="lb-sec"><h4>Fondo <span>· kit de marca y tus colores</span></h4>${sws('bg', c.bg)}</div>`;
      h += `<div class="lb-sec"><h4>Velo <span>· encima de las fotos, debajo del texto</span></h4>${seg('velo', [['', 'Ninguno'], ['plano', 'Plano'], ['grad', 'Degradado']], v ? v.tipo : '')}`
        + (v ? `<span class="lb-l">Color</span>${sws('velo-c', v.color)}${rng('velo-op', 'Intensidad', v.op, 0.05, 0.9, 0.01)}` + (v.tipo === 'grad' ? `<span class="lb-l">Desde</span>${seg('velo-dir', [['abajo', 'Abajo'], ['arriba', 'Arriba'], ['izq', 'Izquierda'], ['der', 'Derecha']], v.dir || 'abajo')}${rng('velo-alc', 'Alcance', v.alc ?? 0.6, 0.2, 1, 0.01)}` : '') : '') + '</div>';
      h += `<div class="lb-sec"><h4>Textura <span>· encima de todo</span></h4>${seg('tex', [['', 'Ninguna'], ...Object.entries(TEXS)], c.tex ? c.tex.tipo : '')}${c.tex ? rng('tex-op', 'Intensidad', c.tex.op, 0.05, 1, 0.01) : ''}</div>`;
      h += `<div class="lb-sec"><h4>Rejilla <span>· de 2 a 4 fotos</span></h4><div class="lb-grids">${GRIDS.map(([k, l]) => `<button type="button" class="lb-g" data-lb="grid" data-v="${k}" title="${l}" aria-label="Rejilla: ${l}">${gridSvg(k)}</button>`).join('')}</div>`
        + rng('gap', 'Separación', c.rej ? c.rej.g : E.gap ?? 0.02, 0, 0.08, 0.001) + '<p class="lb-p">Las fotos de la diapositiva van a los huecos por orden; un hueco vacío se rellena con un clic.</p></div>';
      h += `<div class="lb-sec"><h4>Plantillas <span>· del cliente, para cualquier mes</span></h4>${E.plant.length ? `<div class="lb-tpls">${E.plant.map(t => `<div class="lb-tp"><canvas data-lb="tpl" data-id="${esc(t.id)}" title="Aplicar «${esc(t.nombre)}» a esta diapositiva"></canvas><span>${esc(t.nombre)}</span><button type="button" data-lb="tpl-del" data-id="${esc(t.id)}" title="Borrar la plantilla" aria-label="Borrar la plantilla">×</button></div>`).join('')}</div>` : '<p class="lb-p" style="margin:0 0 8px">Guarda una diapositiva y reutiliza su composición: las fotos de cada diapositiva entran en sus huecos; textos y logos se quedan.</p>'}`
        + `<div class="lb-btns"><button type="button" class="btn2" data-lb="tpl-save"${c.els.length || c.velo || c.tex || c.bg !== '#ffffff' ? '' : ' disabled'}>Guardar como plantilla</button></div></div>`;
      h += capasHTML(c);
    }
    p.innerHTML = h; p.scrollTop = top;
    p.querySelectorAll('canvas[data-lb="tpl"]').forEach(cv => { const t = E.plant.find(q => q.id === cv.dataset.id); if (t) dibujarPlantilla(cv, t); });
  }
  function dibujarPlantilla(cv, t) {
    const { W, H } = sizeAt(E.i), w = 150, h = Math.round(w * H / W); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'), k = w / W; x.setTransform(k, 0, 0, k, 0, 0);
    drawComp(x, t.comp, W, H, viewImg, k, false);
  }
  function syncNums(el) {          // the panel's values follow a drag, without rebuilding it
    if (!el || !E.el) return;
    const p = E.el.querySelector('.lb-panel'), z = p.querySelector('input[data-lb="z"]'); if (z) { z.value = el.z || 1; z.nextElementSibling.textContent = OUTF.z(el.z || 1); }
    const r = p.querySelector('input[data-lb="rot"]'); if (r && document.activeElement !== r) r.value = Math.round((el.rot || 0) * 10) / 10;
    const { H } = sizeAt(E.i), put = (k, v) => { const i = p.querySelector(`input[data-lb="${k}"]`); if (i && document.activeElement !== i) i.value = Math.round(v); };
    put('mx', el.x * 1080); put('my', el.y * H * PX); put('man', el.w * 1080); put('mal', el.h * H * PX);
    const s = p.querySelector('input[data-lb="size"]'); if (s && el.t === 'texto') { s.value = el.size; s.nextElementSibling.textContent = OUTF.size(el.size); }
  }

  // ---------- actions ----------
  function onEl(fn, tag, quiet) {  // a change to the selected element (to every selected one when several)
    const ids = selIds(); if (!ids.length) return;
    mut(tag, () => { const c = ensure(); c.els.filter(q => ids.includes(q.id)).forEach(el => fn(el, c)); }, quiet);
  }
  function orden(dir) {
    const ids = selIds(); if (!ids.length) return;
    mut(null, () => {
      const c = ensure(), mov = c.els.filter(e => ids.includes(e.id)), rest = c.els.filter(e => !ids.includes(e.id));
      if (dir === 'front') { c.els = [...rest, ...mov]; return; }
      if (dir === 'back') { c.els = [...mov, ...rest]; return; }
      const idx = mov.map(e => c.els.indexOf(e)), k = dir === 'fwd' ? Math.min(c.els.length - 1, Math.max(...idx) + 1) : Math.max(0, Math.min(...idx) - 1), other = c.els[k];
      if (!other || ids.includes(other.id)) return;
      const at = rest.indexOf(other); rest.splice(dir === 'fwd' ? at + 1 : at, 0, ...mov); c.els = rest;
    });
  }
  function nudge(dx, dy) {
    if (!selEls().some(e => !e.lock)) return;
    const { W, H } = E.sz;
    onEl(e => { if (e.lock) return; e.x = r4(e.x + dx / W); e.y = r4(e.y + dy / H); delete e.fit; }, 'nudge', true);
    syncNums(selEl());
  }
  function copiar() { const ss = selEls(); if (!ss.length) return; CLIP = { els: clone(ss), client: E.board.client }; I().toast(ss.length === 1 ? 'Copiado: pégalo en esta u otra diapositiva con ⌘V.' : `${ss.length} elementos copiados: pégalos con ⌘V.`); panel(); }
  const clip = () => CLIP && E && CLIP.client === E.board.client ? CLIP.els : null;   // another client's photos and logos never go into this one's posts
  function pegar() {
    if (!clip() || !E.sl.length) return;
    mut(null, () => {
      const c = ensure(), g = {}, ids = [];
      const dup = clip().every(e => c.els.some(o => Math.abs(o.x - e.x) < 1e-3 && Math.abs(o.y - e.y) < 1e-3 && Math.abs(o.w - e.w) < 1e-3));
      for (const e0 of clip()) {
        const e = clone(e0); e.id = uid(); e.lock = false; if (e.g) e.g = g[e.g] || (g[e.g] = uid());
        if (e.src && !M.files[e.src]) e.src = null;
        if (dup) { e.x = r4(e.x + 0.03); e.y = r4(e.y + 0.03); }
        c.els.push(e); ids.push(e.id);
      }
      E.sel = ids[0]; E.mas = ids.slice(1); E.crop = null;
    });
  }
  function alinear(v) {            // the selected elements along the edge or centre of the selection (one alone: of the slide)
    const ss = selEls(); if (!ss.length) return;
    const { W, H } = E.sz, B = ss.length > 1 ? union(ss, W, H) : { l: 0, r: W, t: 0, b: H };
    onEl(e => {
      if (e.lock) return;
      const b = aabb(e, W, H);
      const dx = v === 'izq' ? B.l - b.l : v === 'der' ? B.r - b.r : v === 'cen' || v === 'h' ? (B.l + B.r - b.l - b.r) / 2 : 0;
      const dy = v === 'arr' ? B.t - b.t : v === 'aba' ? B.b - b.b : v === 'med' || v === 'v' ? (B.t + B.b - b.t - b.b) / 2 : 0;
      e.x = r4(e.x + dx / W); e.y = r4(e.y + dy / H); delete e.fit;
    });
  }
  function formatoEd(f, quiet) {
    if (!FMTS[f] || f === fmtAt(E.i)) return;
    const apply = () => {
      const upd = x => { if (x.key && !x.out) { const fresh = E.car ? f !== E.fmt0 || x.fmt !== x.fmt0 : f !== x.fmt0; x.raw = rawComp(x.key, fresh); if (!x.comp) x.base = firma(x.raw); } };
      if (E.car) { E.fmt = f; E.sl.forEach(upd); } else { const x = cur(); x.fmt = f; upd(x); }
      E.sl.forEach((x, i) => fotosDe(x.comp).forEach(e => { if (e.fit != null && e.src) encajar(e, e.fit, i); }));   // «Encajar» holds in the new format
    };
    if (quiet) { apply(); return; }
    mut(null, apply);
  }
  function nuevo(el) { mut(null, () => { const c = ensure(); c.els.push(el); E.sel = el.id; E.mas = []; E.crop = null; E.pick = null; }); }
  function act(a, b) {
    const x = E.sl.length ? cur() : null, col = () => (b.value || b.dataset.c).toLowerCase(), picked = !!(b && b.value && b.type === 'color');
    switch (a) {
      case 'cerrar': pedirCerrar(); return;
      case 'aplicar': aplicar(); return;
      case 'undo': deshacer(true); return;
      case 'redo': deshacer(false); return;
      case 'zin': zoom(E.zoom * 1.25); return;
      case 'zout': zoom(E.zoom / 1.25); return;
      case 'zfit': zoom(1); return;
      case 'iman': E.iman = !E.iman; head(); return;
      case 'todas': verTodas(E.allEl.hidden); return;
      case 'fmt': if (E.sl.length) formatoEd(b.dataset.v); return;
      case 'sl': if (!E.allEl.hidden) verTodas(false); elegir(+b.dataset.i); return;
      case 'sl-up': case 'sl-dn': { const i = +b.dataset.i, j = i + (a === 'sl-up' ? -1 : 1); if (j < 0 || j >= E.sl.length) return; mut(null, () => { [E.sl[i], E.sl[j]] = [E.sl[j], E.sl[i]]; if (E.i === i) E.i = j; else if (E.i === j) E.i = i; }); return; }
      case 'sl-del': { const i = +b.dataset.i; mut(null, () => { E.sl.splice(i, 1); E.i = clamp(E.i > i ? E.i - 1 : E.i, 0, Math.max(0, E.sl.length - 1)); soltar(); E.crop = null; }); return; }
      case 'sl-add': {
        if (E.car && E.sl.length >= MAX_SLIDES) { I().toast('Un carrusel admite como máximo 20 diapositivas (límite de Instagram).'); return; }
        mut(null, () => { const bg = E.sl.length ? compAt(E.i).bg || '#ffffff' : '#ffffff', at = E.sl.length ? E.i + 1 : 0; E.sl.splice(at, 0, blankSlide(bg)); E.i = at; soltar(); E.crop = null; }); return;
      }
      case 'sl-orig': {
        const e = fotosDe(compAt(E.i)).find(q => q.src && M.files[q.src] && !M.files[q.src].design); if (!e) return;
        if (E.sl.some((o, k) => k !== E.i && o.key === e.src)) { I().toast('Esa foto ya es otra diapositiva de esta publicación.'); return; }
        mut(null, () => { const raw = rawComp(e.src, E.car ? E.fmt !== E.fmt0 : false); Object.assign(x, { key: e.src, out: false, from: null, comp: null, raw, base: firma(raw) }); soltar(); E.crop = null; });
        return;
      }
      case 'add': E.pick = { modo: 'add' }; soltar(); panel(); return;
      case 'add-txt': { const hayFoto = fotosDe(compAt(E.i)).length > 0; nuevo(textoEl(hayFoto ? '#ffffff' : '#262626')); const el = selEl(); if (el) ajustarTexto(el, E.sz.W, E.sz.H); return; }
      case 'add-forma': nuevo(formaEl(b.dataset.v, E.sz.W, E.sz.H)); return;
      case 'logo': if (M.files[b.dataset.f]) nuevo(logoEl(b.dataset.f, E.sz.W, E.sz.H)); return;
      case 'logo-up': E.el.querySelector('.lb-logoin').click(); return;
      case 'rep': { const el = selEl(); if (el) { E.pick = { modo: 'rep', id: el.id }; panel(); } return; }
      case 'pick-x': E.pick = null; panel(); return;
      case 'pickf': {
        const f = b.dataset.f, pk = E.pick; if (!pk || !M.files[f] || !E.sl.length) return;
        E.pick = null;
        mut(null, () => {
          const c = ensure();
          if (pk.modo === 'add') { const e = fotoEl(f); const top = c.els.reduce((a, q, i) => q.t === 'foto' ? i + 1 : a, 0); c.els.splice(top, 0, e); E.sel = e.id; E.mas = []; encajar(e, 0.08); delete e.fit; }   // a new photo goes above the photos, under texts and logos
          else { const e = c.els.find(q => q.id === pk.id); if (e) { e.src = f; e.cx = 0.5; e.cy = 0.5; e.z = 1; if (e.fit != null) encajar(e, e.fit); E.sel = e.id; E.mas = []; } }
        });
        return;
      }
      case 'bc': onEl(el => { el.bc = col(); }, 'bc', picked); if (picked) panelSw('bc', b.value); return;
      case 'tc': onEl(el => { if (el.t === 'texto') el.color = col(); }, 'tc', picked); if (picked) panelSw('tc', b.value); return;
      case 'fc': onEl(el => { if (el.t === 'forma') el.color = col(); }, 'fc', picked); if (picked) panelSw('fc', b.value); return;
      case 'bg': mut('bg', () => { ensure().bg = col(); }, picked); if (picked) panelSw('bg', b.value); return;
      case 'velo': mut(null, () => { const c = ensure(); c.velo = b.dataset.v ? { tipo: b.dataset.v, color: (c.velo && c.velo.color) || '#000000', op: (c.velo && c.velo.op) || 0.35, dir: (c.velo && c.velo.dir) || 'abajo', alc: (c.velo && c.velo.alc) || 0.6 } : null; }); return;
      case 'velo-c': mut('velo-c', () => { const c = ensure(); if (c.velo) c.velo.color = col(); }, picked); if (picked) panelSw('velo-c', b.value); return;
      case 'velo-dir': mut(null, () => { const c = ensure(); if (c.velo) c.velo.dir = b.dataset.v; }); return;
      case 'tex': mut(null, () => { const c = ensure(); if (b.dataset.v) c.tex = { tipo: b.dataset.v, op: (c.tex && c.tex.op) || 0.35 }; else delete c.tex; }); return;
      case 'grid': mut(null, () => { const c = ensure(); rejilla(c, b.dataset.v, c.rej ? c.rej.g : E.gap ?? 0.02); soltar(); E.crop = null; }); return;
      case 'tpl': aplicarPlantilla(b.dataset.id); return;
      case 'tpl-save': guardarPlantilla(); return;
      case 'tpl-del': { const t = E.plant.find(q => q.id === b.dataset.id); if (t) preguntar(`¿Borrar la plantilla «${t.nombre}»?`, 'Se borra para este cliente; las diapositivas ya hechas con ella no cambian.', [['seguir', 'Cancelar', 'btn2'], ['borrar', 'Borrar', 'btn']], v => { if (v === 'borrar') guardarCliente(l => ({ ...l, plantillas: (l.plantillas || []).filter(q => q.id !== t.id) })); }); return; }
      case 'color-save': { const c = String(b.dataset.c || '').toLowerCase(); if (!hexOk(c)) return; if (E.mios.includes(c) || E.kit.some(k => k.c === c)) { I().toast('Ese color ya está en los colores del cliente.'); return; } guardarCliente(l => ({ ...l, colores: [...(l.colores || []), c].slice(-16) })).then(ok => ok && I().toast('Color guardado para este cliente.')); return; }
      case 'crop': { const el = selEl(); if (!el || el.t !== 'foto') return; E.crop = E.crop === el.id ? null : el.src && !el.lock ? el.id : null; panel(); pedir(); return; }
      case 'crop-c': onEl(el => setPhoto(el, { cx: 0.5, cy: 0.5, z: 1 })); return;
      case 'encajar': onEl(el => { if (el.t === 'foto') encajar(el, el.fit != null ? el.fit : 0); }); return;
      case 'llenar': onEl(el => { if (el.t === 'foto') { llenar(el); setPhoto(el, {}); } }); return;
      case 'marco': onEl(el => { if (el.t !== 'foto') return; el.marco = b.dataset.v || null; if (el.marco) delete el.fit; setPhoto(el, {}); }); return;
      case 'rotl': onEl(el => { el.rot = ((Math.round((el.rot || 0) - 90) + 540) % 360) - 180; delete el.fit; }); return;
      case 'rotr': onEl(el => { el.rot = ((Math.round((el.rot || 0) + 90) + 540) % 360) - 180; delete el.fit; }); return;
      case 'flipx': onEl(el => { el.fx = !el.fx; }); return;
      case 'flipy': onEl(el => { el.fy = !el.fy; }); return;
      case 'peso': onEl(el => { if (el.t === 'texto') el.peso = +b.dataset.v; }); return;
      case 'al': if (b.dataset.v && !multi()) return; alinear(b.dataset.v); return;
      case 'al1': alinear(b.dataset.v); return;
      case 'may': onEl(el => { if (el.t === 'texto') el.may = !el.may; }); return;
      case 'front': case 'fwd': case 'bwd': case 'back': orden(a); return;
      case 'dup': {
        const ids = selIds(); if (!ids.length) return;
        mut(null, () => { const c = ensure(), g = {}, nw = []; for (const el of c.els.filter(q => ids.includes(q.id))) { const e = clone(el); e.id = uid(); e.lock = false; if (e.g) e.g = g[e.g] || (g[e.g] = uid()); e.x = r4(e.x + 0.03); e.y = r4(e.y + 0.03); delete e.fit; nw.push(e); } c.els.push(...nw); E.sel = nw[0].id; E.mas = nw.slice(1).map(e => e.id); });
        return;
      }
      case 'copy': copiar(); return;
      case 'paste': pegar(); return;
      case 'lock': { const all = selEls().every(e => e.lock); onEl(el => { el.lock = !all; if (el.lock && E.crop === el.id) E.crop = null; }); return; }
      case 'del': {
        const ss = selEls(); if (!ss.length) return;
        if (ss.every(e => e.lock)) { I().toast(ss.length > 1 ? 'Están bloqueados: desbloquéalos para borrarlos.' : 'Está bloqueado: desbloquéalo para borrarlo.'); return; }
        mut(null, () => { const c = ensure(), ids = ss.filter(e => !e.lock).map(e => e.id); c.els = c.els.filter(e => !ids.includes(e.id)); soltar(); E.crop = null; });
        return;
      }
      case 'group': { const ids = selIds(); if (ids.length < 2) return; const g = uid(); onEl(el => { el.g = g; }); return; }
      case 'ungroup': { const el = selEl(); if (!el) return; const ids = el.g && !multi() ? compAt(E.i).els.filter(e => e.g === el.g).map(e => e.id) : selIds(); mut(null, () => { ensure().els.forEach(e => { if (ids.includes(e.id)) delete e.g; }); E.mas = []; }); return; }
      case 'cap': { const el = compAt(E.i).els.find(e => e.id === b.dataset.id); if (!el) return; seleccionar(el, b._shift); E.crop = null; E.pick = null; panel(); pedir(); return; }
      case 'cap-ver': case 'cap-lock': { const id = b.dataset.id; mut(null, () => { const e = ensure().els.find(q => q.id === id); if (!e) return; if (a === 'cap-ver') e.oculto = !e.oculto; else e.lock = !e.lock; }); return; }
      case 'cap-up': case 'cap-dn': { const id = b.dataset.id; mut(null, () => { const c = ensure(), k = c.els.findIndex(q => q.id === id), j = k + (a === 'cap-up' ? 1 : -1); if (k < 0 || j < 0 || j >= c.els.length) return; [c.els[k], c.els[j]] = [c.els[j], c.els[k]]; }); return; }
    }
  }
  function panelSw(act, v) {      // a colour picked with the native picker: the swatch ring follows without rebuilding the panel
    E.el.querySelectorAll(`.lb-panel .lb-sw[data-lb="${act}"]`).forEach(s => s.classList.toggle('on', s.dataset.c === String(v).toLowerCase()));
    const sv = E.el.querySelector(`.lb-panel input.lb-pick[data-lb="${act}"]`); if (sv) { const more = sv.nextElementSibling; if (more) more.dataset.c = String(v).toLowerCase(); }
  }
  function onInput(t) {           // sliders and fields of the panel
    const a = t.dataset.lb;
    if (t.type === 'color') { act(a, t); return; }
    if (a === 'txt') { const v = t.value; onEl(el => { if (el.t === 'texto') { el.txt = v; ajustarTexto(el, E.sz.W, E.sz.H); } }, 'txt', true); return; }
    if (a === 'font') { const f = E.fuentes[+t.value]; if (!f) return; onEl(el => { if (el.t !== 'texto') return; el.font = { n: f.n, ...(f.file ? { file: f.file, w: f.w } : { css: f.css }) }; ajustarTexto(el, E.sz.W, E.sz.H); }); return; }
    const v = +t.value;
    if (OUTF[a] && t.nextElementSibling) t.nextElementSibling.textContent = OUTF[a](v);
    const c0 = compAt(E.i), { W, H } = E.sz;
    switch (a) {
      case 'velo-op': if (c0.velo) mut('velo-op', () => { ensure().velo.op = v; }, true); return;
      case 'velo-alc': if (c0.velo) mut('velo-alc', () => { ensure().velo.alc = v; }, true); return;
      case 'tex-op': if (c0.tex) mut('tex-op', () => { ensure().tex.op = v; }, true); return;
      case 'gap': if (!c0.rej || fotosDe(c0).length !== cells(c0.rej.n, 1, 1, 0).length) { E.gap = v; if (c0.rej) mut('gap', () => { ensure().rej.g = v; }, true); return; } mut('gap', () => separar(ensure(), v), true); return;
      case 'b': onEl(el => { el.b = v; }, 'b', true); return;
      case 'r': onEl(el => { el.r = v; }, 'r', true); return;
      case 'sh': onEl(el => { el.sh = v; }, 'sh', true); return;
      case 'op': onEl(el => { el.op = v; }, 'op', true); return;
      case 'z': onEl(el => setPhoto(el, { z: v }), 'z', true); return;
      case 'fit': onEl(el => { if (el.t === 'foto') encajar(el, v); }, 'fit', true); return;
      case 'size': onEl(el => { if (el.t === 'texto') { el.size = v; ajustarTexto(el, W, H); } }, 'size', true); syncNums(selEl()); return;
      case 'lh': onEl(el => { if (el.t === 'texto') { el.lh = v; ajustarTexto(el, W, H); } }, 'lh', true); return;
      case 'ls': onEl(el => { if (el.t === 'texto') { el.ls = v; ajustarTexto(el, W, H); } }, 'ls', true); return;
      case 'rot': if (Number.isFinite(v)) onEl(el => { el.rot = clamp(Math.round(v * 10) / 10, -180, 180); delete el.fit; }, 'rot', true); return;
      case 'mx': case 'my': case 'man': case 'mal': {
        if (!Number.isFinite(v)) return;
        onEl(el => {
          if (a === 'mx') el.x = r4(v / 1080);
          else if (a === 'my') el.y = r4(v / (H * PX));
          else if (a === 'man') { const w = Math.max(4, v) / 1080; if (el.t === 'logo') el.h = r4(el.h * w / el.w); el.w = r4(w); if (el.t === 'texto') ajustarTexto(el, W, H); }
          else if (el.t !== 'texto') { const h = Math.max(2, v) / (H * PX); if (el.t === 'logo') el.w = r4(el.w * h / el.h); el.h = r4(h); }
          delete el.fit; if (el.t === 'foto' && el.src) setPhoto(el, {});
        }, a, true);
        return;
      }
    }
  }
  function guardarPlantilla() {
    const n = E.plant.length + 1;
    preguntar('Guardar como plantilla', 'La composición de esta diapositiva —textos y logos incluidos, sin sus fotos— para cualquier mes de este cliente.', [['seguir', 'Cancelar', 'btn2'], ['ok', 'Guardar', 'btn']], (v, nombre) => { if (v === 'ok') guardarPlantillaYa(nombre, n); }, `Plantilla ${n}`);
  }
  function guardarPlantillaYa(nombre, n) {
    if (!E || !E.sl.length) return;
    const c = compAt(E.i), comp = clone(c); comp.els.forEach(e => { if (e.t === 'foto') { e.src = null; e.cx = 0.5; e.cy = 0.5; e.z = 1; } delete e.lock; });
    const t = { id: 't' + Date.now().toString(36), nombre: String(nombre || '').trim().slice(0, 40) || `Plantilla ${n}`, comp, at: new Date().toISOString() };
    guardarCliente(l => ({ ...l, plantillas: [...(l.plantillas || []), t].slice(-24) })).then(ok => ok && I().toast(`Plantilla «${t.nombre}» guardada para este cliente.`));
  }
  function aplicarPlantilla(id) {
    const t = E.plant.find(q => q.id === id); if (!t) return;
    mut(null, () => {
      const c = ensure(), fotos = fotosDe(c).map(e => e.src).filter(Boolean), g = {};
      let k = 0;
      c.bg = t.comp.bg; c.velo = clone(t.comp.velo); if (t.comp.tex) c.tex = clone(t.comp.tex); else delete c.tex;
      c.els = t.comp.els.map(e => {
        const n = { ...clone(e), id: uid() }; if (n.g) n.g = g[n.g] || (g[n.g] = uid());
        if (n.t === 'foto') { n.src = fotos[k++] || null; n.cx = 0.5; n.cy = 0.5; n.z = 1; if (n.fit != null && n.src) { encajar(n, n.fit); n.rot = e.rot || 0; } }
        else if (n.src && !M.files[n.src]) n.src = null;
        return n;
      });
      if (t.comp.rej) c.rej = clone(t.comp.rej); else delete c.rej;
      soltar(); E.crop = null;
    });
  }

  function wire(el) {
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-lb]'); if (!b || !el.contains(b) || E.busy) return;
      if ((b.tagName === 'INPUT' && b.type !== 'button') || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA') return;
      if (b.dataset.mio && e.altKey) { const c = b.dataset.c; guardarCliente(l => ({ ...l, colores: (l.colores || []).filter(q => q !== c) })); return; }
      if (b.dataset.lb === 'logo' && e.altKey) { const f = b.dataset.f; preguntar('¿Quitar este logo del kit?', 'Las diapositivas ya hechas con él no cambian.', [['seguir', 'Cancelar', 'btn2'], ['q', 'Quitar', 'btn']], v => { if (v === 'q') guardarCliente(l => ({ ...l, logos: (l.logos || []).filter(q => q !== f) })); }); return; }
      b._shift = e.shiftKey;
      act(b.dataset.lb, b);
    });
    el.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.lb && !E.busy) onInput(t); });
    el.querySelector('.lb-logoin').addEventListener('change', e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) subirLogos(fs); });
    const cv = E.cv;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('dblclick', onDbl);
    cv.addEventListener('wheel', onWheel, { passive: false });
  }
  function onKey(e) {
    if (!E) { window.removeEventListener('keydown', onKey, true); return; }
    e.stopImmediatePropagation();
    if (E.busy) { if (!e.metaKey) e.preventDefault(); return; }
    if (!E.el.isConnected || !curSlot()) { cerrar(true); return; }
    if (E.ask) { if (e.key === 'Escape') { e.preventDefault(); cerrarPregunta(); } else if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('lb-askin')) { e.preventDefault(); E.askOk(); } return; }
    const t = e.target, typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio', 'color'].includes(t.type)));
    const mod = (e.metaKey || e.ctrlKey) && !e.altKey, k = String(e.key).toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typing && t.blur) { t.blur(); E.el.focus({ preventScroll: true }); return; }
      if (E.pick) { E.pick = null; panel(); } else if (E.crop) { E.crop = null; panel(); pedir(); } else if (!E.allEl.hidden) verTodas(false); else if (E.sel) { soltar(); panel(); pedir(); } else pedirCerrar();
      return;
    }
    if (typing) return;
    if (t && t.classList && t.classList.contains('lb-it') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!E.allEl.hidden) verTodas(false); elegir(+t.dataset.i); return; }
    if (mod && k === 'z') { e.preventDefault(); deshacer(!e.shiftKey); return; }
    if (mod && k === 'y') { e.preventDefault(); deshacer(false); return; }
    if (mod && k === 'c') { if (E.sel) { e.preventDefault(); copiar(); } return; }
    if (mod && k === 'v') { if (clip()) { e.preventDefault(); pegar(); } return; }
    if (mod && k === 'd') { if (E.sel) { e.preventDefault(); act('dup'); } return; }
    if (mod && k === 'g') { if (E.sel) { e.preventDefault(); act(e.shiftKey ? 'ungroup' : 'group'); } return; }
    if (mod && k === 'a') { if (E.sl.length) { e.preventDefault(); const ids = compAt(E.i).els.filter(q => !q.oculto).map(q => q.id); E.sel = ids[0] || null; E.mas = ids.slice(1); E.crop = null; panel(); pedir(); } return; }
    if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { if (E.sel) { e.preventDefault(); orden(e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'fwd') : (e.shiftKey ? 'back' : 'bwd')); } return; }
    if (mod && (k === '+' || k === '=' || k === '-')) { e.preventDefault(); zoom(E.zoom * (k === '-' ? 1 / 1.25 : 1.25)); return; }
    if (mod && k === '0') { e.preventDefault(); zoom(1); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { if (E.sel) { e.preventDefault(); act('del'); } return; }
    if (e.key.startsWith('Arrow')) {
      if (t && t.closest && t.closest('.seg, .lb-rng')) return;
      e.preventDefault();
      if (E.sel) { const s = (e.shiftKey ? 10 : 1) * OUT_W / 540; nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0); }
      else elegir(E.i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1));
    }
  }

  // ---------- «Aplicar a la casilla» ----------
  async function aplicar() {
    if (!E || E.busy) return;
    const s = curSlot(), S = E.board, owner = E;
    let counted = false;
    try {
      need(s, 'La publicación ya no está en la mesa.');
      need(!I().locked, LOCKED);
      need(!I().uploadsBusy(), 'Espera a que termine la subida a Notion.');
      need(I().same(s.photos, E.photos0), 'La publicación cambió mientras editabas: cierra el editor y vuelve a abrirlo.');
      need(!E.car || E.sl.length <= MAX_SLIDES, 'Un carrusel admite como máximo 20 diapositivas (límite de Instagram).');
      E.sl.forEach((x, i) => { if (x.comp) need(!x.comp.els.some(e => !e.oculto && (e.t === 'foto' || e.t === 'logo') && (!e.src || !M.files[e.src])), `Diapositiva ${i + 1}: tiene un hueco sin foto o un logo que ya no está. Elígelo o bórralo.`); });
      if (!pendiente()) { cerrar(); return; }
      E.busy = true; APL++; counted = true; head();
      const fmtCh = E.car && E.fmt !== E.fmt0, outs = [], made = [];
      try {
        for (let i = 0; i < E.sl.length; i++) {
          const x = E.sl[i];
          const f0 = x.key && M.files[x.key], sz = sizeAt(i), off = !f0 || Math.abs(f0.w / f0.h - sz.W / sz.H) > 0.005;   // ratio, not pixels: a cross-Mac copy is 1080 wide
          const redo = !isRaw(x) && (!x.key || !x.out || changedSl(x) || fmtCh || (!E.car && x.fmt !== x.fmt0) || off);
          if (!redo) { outs.push(x.key); continue; }
          const blob = await renderOut(i);
          const name = E.car ? `${s.name} ${pad2(i + 1)}.jpg` : `${s.name}.jpg`;
          const { w, h, thumb } = await I().makeThumb(blob);
          const id = I().newId();
          await I().idbPut('files', id, { name, size: blob.size, type: 'image/jpeg', w, h, lastModified: Date.now(), blob, thumb, design: true });
          M.files[id] = { name, size: blob.size, type: 'image/jpeg', w, h, thumbUrl: URL.createObjectURL(thumb), design: true };
          M.thumbBlobs[id] = thumb;
          outs.push(id); made.push(id);
        }
      } catch (e) { for (const f of made) { try { await I().deleteIfUnused(f); } catch (er) { /* the sweep takes it */ } } throw e; }
      if (!(E === owner && I().S === S && S.slots.includes(s) && I().same(s.photos, E.photos0) && !s.design && !I().locked && !I().uploadsBusy())) {   // changed while drawing: nothing is used
        for (const f of made) { try { await I().deleteIfUnused(f); } catch (e) { /* the sweep takes it */ } }
        throw new LbError('La mesa cambió mientras se aplicaba: vuelve a intentarlo.');
      }
      const before = I().refsOf(S), lib = {};
      for (const [k, c] of Object.entries(entries(s))) if (!E.photos0.includes(k)) lib[k] = c;   // images of this post that are elsewhere now keep their composition
      E.sl.forEach((x, i) => { if (!isRaw(x)) lib[outs[i]] = x.comp; });
      E.sl.forEach(x => {               // a composition moved here with its image leaves the post it was on
        if (!x.from || !x.key) return;
        const o = S.slots.find(z => z.id === x.from); if (!o || !entries(o)[x.key]) return;
        delete o.libre.slides[x.key]; if (!Object.keys(o.libre.slides).length) delete o.libre;
      });
      s.photos = outs.slice();
      if (Object.keys(lib).length) s.libre = { v: 1, slides: lib }; else delete s.libre;
      if (E.car) {
        s.fmt = E.fmt;
        if (fmtCh) outs.forEach(f => { if (!lib[f]) S.crops[f] = { ...I().baseCrop(f, S), cx: 0.5, cy: 0.5, z: 1 }; });   // the photos left as they were: centred, as a format change does
      } else E.sl.forEach((x, i) => { const f = outs[i]; if (lib[f]) S.crops[f] = { fmt: x.fmt, cx: 0.5, cy: 0.5, z: 1 }; else if (x.fmt !== x.fmt0) S.crops[f] = { ...I().baseCrop(f, S), fmt: x.fmt, cx: 0.5, cy: 0.5, z: 1 }; });
      const used = new Set([...outs, ...Object.values(lib).flatMap(srcsOf)]);
      S.tray = S.tray.filter(f => !used.has(f));           // photos now in the post leave the tray
      const after = I().refsOf(S), lost = [...before].filter(f => !after.has(f) && M.files[f]);
      S.tray.unshift(...lost.filter(f => !M.files[f].design && !isKit(f)));   // photos the post no longer uses go back to the tray (never a logo)
      E.applied = true;
      I().changed();
      if (I().histJuntar && E.marca) I().histJuntar(E.marca);
      const i0 = E.i, slotId = E.slotId;
      E.busy = false; APL--; counted = false;
      cerrar(true);
      if (I().S === S && I().openDetail) I().openDetail(slotId, Math.min(i0, Math.max(0, s.photos.length - 1)));
      const n = made.length;
      I().toast(n ? `${n === 1 ? 'Diapositiva aplicada' : `${n} diapositivas aplicadas`}: se suben tal cual.` : 'Cambios aplicados a la casilla.');
      for (const f of lost.filter(f => M.files[f] && M.files[f].design)) { try { await I().deleteIfUnused(f); } catch (e) { /* kept */ } }
    } catch (e) {
      if (counted) { APL--; counted = false; }
      if (E === owner && E.busy) { E.busy = false; head(); }
      const m = e instanceof LbError ? e.message : 'No se pudo aplicar: ' + String((e && e.message) || e);
      if (!(e instanceof LbError)) console.warn('editor:', e);
      if (I() && I().toast) I().toast(m, { ms: 7000 });
    }
  }

  M.libre = { version: VERSION, abrir, cerrar: () => cerrar(), sync, abierto: () => !!E, aplicando: () => APL > 0, aplicar: () => aplicar(), _ed: () => E };
})();
