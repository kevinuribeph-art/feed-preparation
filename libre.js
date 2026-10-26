// Editor libre de diapositivas — Mesa de trabajo · v1.6
// «Editar diapositivas» (a carousel) / «Editar foto» (a photo post) / «Editar portada» (a reel) in the post view: each slide
// becomes a free composition —
// photos in frames (move, scale, rotate, flip, crop, border, corners, shadow, frames), texts, logos and stickers of the client,
// shapes and lines, over a colour background with an optional veil and texture — and «Aplicar a la casilla» draws it as a JPEG
// that goes in the slot exactly as drawn (file flagged design:true, uploaded as rendered, like «Diseñar»). A slide that is
// not touched stays the photo it was, with the mesa's own reframe.
//   s.libre = {v:1, slides:{<renderedFileId>: comp}}    the composition behind each rendered image of the post
//   comp = {bg:'#rrggbb', velo:null|{tipo:'plano'|'grad', color, op, dir:'abajo'|'arriba'|'izq'|'der', alc}, tex:null|{tipo, op},
//           els:[el] (back to front), rej?:{n, g}}
//   every el: {id, t, x, y, w, h (frame, fractions of the slide), rot (°), op (opacity), lock, oculto, g (group id), sh (shadow 0–1),
//            mano (moved by hand: a new proportion leaves it where it is)}
//   'foto':  src, cx, cy, z (the photo inside the frame, as the mesa's reframe), fx, fy, b (border, fraction of the width), bc,
//            r (corners, 0–1 of half the short side), marco (null|'polaroid'|'pelicula'|'cinta'), fit (margin while «Encajar» holds),
//            pan ({id, n, k}: one of the n linked copies of a photo that crosses slides, on the k-th of them)
//   'texto': txt, font {n, file (kits/…)|css}, peso, size (fraction of the width), color, al ('izq'|'cen'|'der'), lh, ls (em),
//            may (capitals); h follows the text
//   'logo':  src (a client's logo or sticker: protected file 'kit-<cliente>-logo-…'), fx, fy
//   'forma': forma ('rect'|'elipse'|'linea'), color, r, b, bc
// The client's colours, templates and logos live on the client record: c.libre = {colores, plantillas:[{id, nombre, comp}], logos}.
// A post designed with «Diseñar» (s.design) opens here with its applied images as the slides (v1.4); applying a change fixes
// the design as images (s.design goes, its photos go back to the tray). The other way round, an edited post is not designed.
// Uses the mesa's bridge M._in (mesa.js ≥ 3.25).
// v1.3 (mesa 3.26): a Foto has pages like a carousel; «Transformar» gives a photo's frame a format (vertical or horizontal)
// and leaves it ready to reframe (el.rat = the format chosen, kept while the frame keeps its proportion); slides are dragged
// into order in the strip and in «Ver todas» (also ⌥ + arrows); «Preview» shows the post as the vista cliente will.
// v1.4 (mesa 3.27): «Llenar» keeps the reframe; designed carousels open here; the brand's text styles (kit «escala»);
// the tray in a drawer under the slide (click or drag a photo onto it); photos dropped from the computer go to the slide.
// v1.5: «Cruzar diapositivas» (a photo across slides in a row, el.pan, its copies linked); «Ver todas» shows them «Seguidas»;
// the photo's panel shows its main actions and folds the rest; a bar over the selection (Duplicar, Bloquear, Delante /
// detrás, Borrar); «Vista previa», «Ver todas» and «Imán» in «⋯»; the shortcuts behind «?»; the tray open and named.
// v1.6 (mesa 3.29): photo holes — a photo dropped on a hole (a real one, or a drawn «HUECO DE FOTO» group) fills it and the
// hole's marker layers go; one whose orientation is not the hole's goes in whole (as «Encajar»). «Sustituir» / «Añadir» on
// the post's cell (casilla) keep the texts and fill the holes in order, without opening the editor. A new proportion puts
// texts, shapes and logos back in their zone (not the ones moved by hand); a carousel drawn in Horizontal keeps its ratio.
// «Editar portada» on a reel: its cover is one 9:16 page (a designed reel opens with its applied cover, as a carousel).
// A post that changes type: its images drawn here are drawn again in the new format (redibujar).
(function libreBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.7';
  const OUT_W = 1440;                          // width of a rendered slide (the most Instagram keeps; the app shows 1080)
  const PX = 1080 / OUT_W;                     // the panel speaks in pixels of a 1080-wide slide
  const VIEW_LONG = 2048;                      // photos drawn in the editor are scaled to this; «Aplicar» reads them at full size
  const MAX_SLIDES = 20;                       // Instagram's limit for a carousel
  // «Transformar»: the frame formats (w/h); 1:1 is in both
  const RATIOS = { v: [['3:4', 3 / 4], ['4:5', 4 / 5], ['9:16', 9 / 16], ['2:3', 2 / 3], ['1:1', 1]], h: [['4:3', 4 / 3], ['5:4', 5 / 4], ['16:9', 16 / 9], ['3:2', 3 / 2], ['1:1', 1]] };
  const FMTS = { v45: '4:5', v34: '3:4', q11: '1:1', h: 'Horizontal' };
  const BASICOS = [['#000000', 'Negro'], ['#ffffff', 'Blanco']];   // in every colour picker, after the kit
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
  // this viewer's choices, kept in the browser: the tray open or closed, «Seguidas» in «Ver todas», the panel's open sections
  const LS_TR = 'mesa-lb-bandeja', LS_SEG = 'mesa-lb-seguidas', LS_PL = 'mesa-lb-secciones';
  const lsLeer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsPoner = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* a private window: not kept */ } };
  const ABIERTAS = new Set((lsLeer(LS_PL) || '').split(',').filter(Boolean));

  class LbError extends Error {}
  const need = (ok, msg) => { if (!ok) throw new LbError(msg); };
  const LOCKED = 'La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de editar.';

  // ---------- slot helpers ----------
  const isLibSlot = s => !!s && (I().isCarousel(s.type) || s.type === 'Foto' || I().isReel(s.type));   // a reel: its cover, one 9:16 page
  const entries = s => (s && s.libre && s.libre.slides) || {};
  const srcsOf = comp => ((comp && comp.els) || []).map(e => e.src).filter(Boolean);
  const fotosDe = comp => ((comp && comp.els) || []).filter(e => e.t === 'foto');
  function compOf(S, fid) {                    // the composition behind a rendered image: on its post, or on the post it came from
    for (const s of S.slots) { const c = entries(s)[fid]; if (c) return { s, comp: c }; }
    return null;
  }
  // a composition's signature for «changed?»: a text's height follows its font, which may load after opening
  const firma = c => JSON.stringify(c, function (k, v) { return k === 'h' && this && this.t === 'texto' ? undefined : v; });

  // ---------- photo holes ----------
  // A real hole is a photo frame with no photo. A drawn one (the kit's templates) is a group with a rectangle and a text
  // «HUECO DE FOTO…»: its marker layers are that rectangle and the hole's own texts («HUECO DE FOTO · n / 7», «… Borra este
  // hueco y suelta la foto…»); any other text, even one in that group, is never one of them.
  const plano = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const esRotulo = e => e.t === 'texto' && /^\s*HUECO DE FOTO\b/.test(plano(e.txt));
  const esMarca = e => esRotulo(e) || (e.t === 'texto' && /BORRA ESTE HUECO|SUELTA LA FOTO/.test(plano(e.txt)));
  const rodea = (q, e) => { const cx = e.x + e.w / 2, cy = e.y + e.h / 2; return q.t === 'forma' && q.forma === 'rect' && cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h; };   // the hole's frame: the rectangle its caption sits in
  function huecosDe(comp) {                    // in drawing order: {el} (a real hole) | {g, marcas: [ids]} (a drawn one)
    const els = (comp && comp.els) || [], out = [], vistos = new Set();
    for (const e of els) {
      if (e.t === 'foto' && !e.src && !e.lock && !e.oculto) { out.push({ el: e }); continue; }
      if (!e.g || vistos.has(e.g)) continue;
      vistos.add(e.g);
      const grupo = els.filter(q => q.g === e.g);
      const rot = grupo.find(esRotulo), marco = rot && grupo.filter(q => rodea(q, rot));
      if (marco && marco.length) out.push({ g: e.g, marcas: [...marco, ...grupo.filter(esMarca)].map(q => q.id) });
    }
    return out;
  }
  const orienta = (w, h) => w > h * 1.05 ? 'h' : h > w * 1.05 ? 'v' : 'q';
  // the photo just put in frame el (slide W×H): one whose orientation is not the frame's goes in whole, centred, with the
  // slide's colour around (as «Encajar»), never cropped nor stretched; a frame with «Encajar» keeps it
  function colocar(el, W, H) {
    const d = el.src && M.files[el.src]; if (!d) return;
    if (el.fit != null) { encajarWH(el, el.fit, W, H); return; }
    if (orienta(d.w, d.h) === orienta(el.w * W, el.h * H)) return;
    if (!el.pan && el.x <= 0.001 && el.y <= 0.001 && el.w >= 0.999 && el.h >= 0.999) encajarWH(el, 0, W, H);   // the whole slide: «Encajar», which holds in another format
    else dentro(el, W, H);
  }
  // photo f into hole h: a drawn hole gives way to the photo full bleed, at the back (under every text and shape), its
  // marker layers gone; a real one keeps its frame. Returns the photo's element.
  function rellenar(comp, h, f, W, H) {
    let el = h.el;
    if (el) Object.assign(el, { src: f, cx: 0.5, cy: 0.5, z: 1 });
    else { comp.els = comp.els.filter(q => !h.marcas.includes(q.id)); el = fotoEl(f); comp.els.unshift(el); }
    colocar(el, W, H);
    return el;
  }

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
  let E = null;      // {slotId, board, car, fmt, fmt0, sl:[slide], i, sel, mas, crop, pick, zoom, iman, hist, bm, marca, photos0, kit, plant, logos, fkit, …}
  // slide: {key: the file in the post (photo or rendered image) | null (new), out: key is a rendered image with its composition,
  //         from: id of the post that composition was on (moved here), comp: null (untouched photo) | comp, raw: the photo as
  //         the mesa shows it (comp of an untouched photo), base: signature of the slide as opened, fmt, fmt0 (photo posts)}
  let APL = 0, CLIP = null;   // «Aplicar» running; what was copied {els, client} (kept between posts of the same client)
  const curSlot = () => { if (!E) return null; const S = I() && I().S, s = S && S === E.board ? S.slots.find(x => x.id === E.slotId) : null; return s && (s.design || null) === E.dz && isLibSlot(s) ? s : null; };   // a designed post: the very design it opened with
  const cur = () => E.sl[E.i];
  const EMPTY = { bg: '#ffffff', velo: null, els: [] };
  const compAt = i => { const x = E.sl[i]; return x ? x.comp || x.raw : EMPTY; };
  const selEl = () => { const c = E.sl[E.i] && compAt(E.i); return c && E.sel ? c.els.find(e => e.id === E.sel) || null : null; };
  const selIds = () => E.sel ? [E.sel, ...E.mas.filter(id => id !== E.sel)] : [];
  const selEls = () => { const ids = selIds(); return compAt(E.i).els.filter(e => ids.includes(e.id)); };
  const multi = () => selIds().length > 1;
  function soltar() { E.sel = null; E.mas = []; E.tOri = null; }
  function seleccionar(el, add) {              // a click selects the element, or its whole group; with ⇧ it adds or takes away
    if (!el) { soltar(); return; }
    const grupo = el.g ? compAt(E.i).els.filter(e => e.g === el.g).map(e => e.id) : [el.id];
    if (!add) { if (E.sel !== el.id) E.tOri = null; E.sel = el.id; E.mas = grupo.filter(id => id !== el.id); return; }
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
  function ratioAt(i) {   // «Horizontal» takes the ratio of the photo (a carousel's: its first slide's), never of an image drawn from it;
    if (E.car && E.rat0 && E.fmt === E.fmt0) return E.rat0;   // a carousel already drawn in Horizontal keeps its own while its format stays
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
  async function renderOut(i) { const { W, H } = sizeAt(i); return dibujar(E.sl[i].comp, W, H); }   // slide i at full size: a JPEG Blob
  async function dibujar(comp, W, H) {        // a composition at W×H: a JPEG Blob (the editor open or not)
    const cache = new Map();
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
      need(isLibSlot(s), 'El editor es para carruseles, fotos y portadas de reel.');
      need(!I().isReel(s.type) || s.photos.length, 'El reel no tiene portada: ponle una foto antes de editarla.');
      const dz = s.design || null;                          // a designed carousel: its applied images are the slides
      need(!dz || ((I().isCarousel(s.type) || I().isReel(s.type)) && s.photos.length && I().same(s.photos, (dz.out || []).filter(Boolean))), 'Aplica antes el diseño en «Diseñar»: el editor trabaja sobre sus imágenes.');
      need(!(M.diseno && M.diseno.aplicando && M.diseno.aplicando()), 'Espera: el diseñador está aplicando un diseño.');
      need(!(E && E.busy), 'Espera: el editor está aplicando una publicación.');
      if (E) cerrar(true);
      await I().loadThumbs([...s.photos, ...S.slots.flatMap(x => Object.values(entries(x)).flatMap(srcsOf)), ...S.tray]);
      need(I().S === S && S.slots.includes(s) && (s.design || null) === dz && !(I().switching && I().switching()), 'La mesa cambió: vuelve a pulsar «Editar».');
      need(!(E && E.busy), 'Espera: el editor está aplicando una publicación.');
      if (E) cerrar(true);
      const marca = I().histMarca ? I().histMarca() : null;   // the whole session is one step of the mesa's ⌘Z
      if (I().clearToasts) I().clearToasts();               // an «Deshacer» left in a toast would change the post behind the editor
      const car = I().isCarousel(s.type), fmt0 = car ? s.fmt || 'v45' : null;
      E = { slotId, board: S, dz, car, reel: I().isReel(s.type), tipo: s.type, fmt: fmt0, fmt0, sl: [], i: 0, sel: null, mas: [], crop: null, pick: null, zoom: 1, iman: true, hist: { undo: [], redo: [], tag: null, t: 0 },
        bm: new Map(), marca, photos0: s.photos.slice(), kit: null, plant: [], logos: [], fkit: [], estilos: [], tcol: [], trOpen: bandejaAbierta(), trKey: '', menuOn: false, flm: false, fuentes: [...FUENTES_MESA, ...FUENTES_MAC], drag: null, guides: [], busy: false, raf: 0, k: 1, sz: { W: OUT_W, H: OUT_W * 1.25 } };
      E.sl = s.photos.map(key => {
        const f = compOf(S, key), fmt = car ? null : I().cropOf(key, s).fmt;
        if (f) { const comp = clone(f.comp); return { key, out: true, from: f.s !== s ? f.s.id : null, comp, raw: null, base: firma(comp), fmt, fmt0: fmt }; }
        const raw = rawComp(key);
        return { key, out: false, from: null, comp: null, raw, base: firma(raw), fmt, fmt0: fmt };
      });
      E.i = clamp(idx || 0, 0, E.sl.length - 1);
      const d0 = car && fmt0 === 'h' && M.files[s.photos[0]];
      E.rat0 = d0 && d0.design ? I().fmtRatio('h', d0.w, d0.h) : null;
      const b0 = E.sl.map(x => x.comp && firma(x.comp));   // a crossing photo whose slides were reordered in the mesa comes apart: not a change made here
      repararPan(); E.sl.forEach((x, i) => { if (x.comp && x.base === b0[i]) x.base = firma(x.comp); });
      E.sl.forEach((x, i) => { if (x.comp) { const d = x.out && M.files[x.key], { W, H } = sizeAt(i); x.rat = d ? d.w / d.h : W / H; } });   // the proportion its texts are placed for: the one it was drawn in
      recolocar();                                         // a slide drawn in another proportion (its post changed type or format): its texts to their place now
      if (opts.fmt && FMTS[opts.fmt]) formatoEd(opts.fmt, true);
      injectCSS();
      build(s);
      cargarCliente();
      if (opts.fmt) I().toast('Formato cambiado en el editor: pulsa «Aplicar a la casilla» para redibujar las diapositivas editadas.', { ms: 7000 });
      else if (dz) I().toast(E.reel ? 'Reel diseñado: su portada entra como imagen. Si aplicas cambios, el diseño queda fijado así y su foto vuelve a la bandeja (⌘Z en la mesa lo deshace).' : 'Carrusel diseñado: sus diapositivas entran como imagen. Si aplicas cambios, el diseño queda fijado así y sus fotos vuelven a la bandeja (⌘Z en la mesa lo deshace).', { ms: 9000 });
      return { ok: true, slot: s.id, diapositivas: E.sl.length };
    } catch (e) {
      const m = e instanceof LbError ? e.message : 'No se pudo abrir el editor: ' + String((e && e.message) || e);
      if (!(e instanceof LbError)) console.warn('editor:', e);
      if (I() && I().toast) I().toast(m);
      return { error: m };
    }
  }
  function blankSlide(bg) { const comp = { bg, velo: null, els: [] }; return { key: null, out: false, from: null, comp, raw: null, base: null, fmt: E && !E.car ? (E.reel ? 'r916' : 'v45') : null, fmt0: null }; }
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
    else bandeja();
  }

  // ---------- the client's colours, fonts, templates and logos (kit JSON + client record c.libre) ----------
  async function cargarCliente() {
    const owner = E, cid = E.board.client; if (!cid) return;
    const fk = [];
    let kit = null, est = [], tcol = [];
    if (M.diseno && M.diseno.kit) {
      try {
        const raw = await M.diseno.kit(cid);
        kit = paletaKit(raw);
        if (raw && raw.fuentes) for (const f of Object.values(raw.fuentes)) if (f && f.archivo && !fk.some(q => q.file === f.archivo)) fk.push({ n: f.familia || f.archivo, file: f.archivo, w: f.peso || 400, kit: true });
        est = estilosKit(raw); tcol = ((raw && raw.colores_texto && raw.colores_texto.principales) || []).map(k => raw.colores && raw.colores[k]).filter(hexOk).map(c => c.toLowerCase());
      } catch (e) { /* this client has no design kit */ }
    }
    const c = await I().idbGet('clients', cid), lib = (c && c.libre) || {};
    if (E !== owner) return;
    E.kit = kit; E.fkit = fk; E.estilos = est; E.tcol = tcol; E.fuentes = [...fk, ...FUENTES_MESA.filter(f => !fk.some(q => q.file === f.file)), ...FUENTES_MAC];
    E.plant = Array.isArray(lib.plantillas) ? lib.plantillas : [];
    E.logos = (lib.logos || []).filter(Boolean); await I().loadThumbs(E.logos); E.logos = E.logos.filter(f => M.files[f]);
    if (E !== owner) return;
    panel();
  }
  // the kit's colours for the pickers: its «grupos» in order, each one only in the pickers of its «usos» (all without them);
  // a kit without «grupos» is one group with every colour. Keys of «colores» left out of every group are not offered.
  const USOS = ['fondo', 'texto', 'relleno', 'borde', 'velo'];
  function paletaKit(raw) {
    const C = (raw && raw.colores) || {}, col = k => hexOk(C[k]) ? { n: String(k).replace(/_/g, ' '), c: C[k].toLowerCase() } : null;
    let gs = (Array.isArray(raw && raw.grupos) ? raw.grupos : []).filter(g => g && Array.isArray(g.colores)).map(g => {
      const usos = Array.isArray(g.usos) ? g.usos.filter(u => USOS.includes(u)) : [];
      return { n: String(g.nombre || '').trim(), cols: g.colores.map(col).filter(Boolean), usos: usos.length ? usos : null };
    }).filter(g => g.cols.length);
    if (!gs.length) gs = [{ n: 'Colores', cols: Object.keys(C).map(col).filter(Boolean), usos: null }].filter(g => g.cols.length);
    return gs.length ? { n: String(raw.marca || raw.cliente || '').trim(), grupos: gs } : null;
  }
  // the brand's text styles (kit «escala», px of a 1080-wide slide): the designer's fonts, weights, spacing and capitals
  const ESTILO_N = { portada: 'Portada', titular: 'Titular', entradilla: 'Entradilla', texto: 'Texto', etiqueta: 'Etiqueta' };
  function estilosKit(raw) {
    const F = (raw && raw.fuentes) || {}, L = (raw && raw.lienzo) || {}, A = +L.ancho || 1080;
    return Object.entries((raw && raw.escala) || {}).map(([k, e]) => {
      const f = e && F[e.fuente]; if (!f || !f.archivo || !(+e.px > 0)) return null;
      const ancho = +(k === 'texto' || k === 'etiqueta' ? L.ancho_max_texto : L.ancho_max_titulo) || A * 0.8;
      return { k, n: ESTILO_N[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '), font: { n: f.familia || f.archivo, file: f.archivo, w: f.peso || 400 },
        size: r4(e.px / A), lh: +e.interlineado || 1.2, ls: +e.espaciado || 0, may: !!e.mayusculas, m: r4((+L.margen || 72) / A), w: r4(Math.min(ancho / A, 1 - 2 * (+L.margen || 72) / A)) };
    }).filter(Boolean);
  }
  const conEstilo = (el, st) => { const { W, H } = sizeAt(E.i); Object.assign(el, { font: { ...st.font }, peso: st.font.w, size: st.size, lh: st.lh, ls: st.ls, may: st.may }); ajustarTexto(el, W, H); };
  const estiloDe = el => el.font && E.estilos.find(st => st.font.file === el.font.file && Math.abs(st.size - (el.size || 0)) < 1e-4 && st.lh === el.lh && st.ls === (el.ls || 0) && st.may === !!el.may);
  const lum = hex => { const n = parseInt(hex.slice(1), 16), f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); };
  function textoMarca(k) {           // a text in a brand style: on a photo, the kit's lightest text colour; on a plain background, the one that reads best
    const st = E.estilos.find(q => q.k === k); if (!st) return null;
    const c = compAt(E.i), bg = hexOk(c.bg) ? c.bg : '#ffffff', hay = fotosDe(c).length > 0, cs = E.tcol.length ? E.tcol : ['#ffffff', '#000000'];
    const color = hay ? cs.reduce((a, q) => lum(q) > lum(a) ? q : a) : cs.reduce((a, q) => Math.abs(lum(q) - lum(bg)) > Math.abs(lum(a) - lum(bg)) ? q : a);
    const el = textoEl(color); Object.assign(el, { x: st.m, w: st.w, al: 'izq' }); conEstilo(el, st);
    return el;
  }
  async function guardarCliente(fn) {
    const owner = E, cid = E.board.client;
    if (!cid) { I().toast('Esta mesa no tiene cliente: no se puede guardar en su kit.'); return false; }
    const c = await I().idbGet('clients', cid); if (!c) { I().toast('No encuentro el cliente de esta mesa.'); return false; }
    c.libre = fn(clone(c.libre || {})); c.libreAt = new Date().toISOString();
    await I().idbPut('clients', cid, c); await I().loadClients();
    if (E === owner) { E.plant = c.libre.plantillas || []; E.logos = (c.libre.logos || []).filter(f => M.files[f]); panel(); }
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
  function despues(quiet) {
    if (repararPan()) I().toast('La foto que cruzaba diapositivas se ha separado: cada diapositiva conserva su parte.', { ms: 6000 });
    enlazar(); recolocar();
    E.reMini = true; pedir(); head(); if (!quiet) { panel(); lista(); bandeja(); }
  }
  function todo() { lista(); panel(); head(); pedir(); bandeja(); }
  function bandejaAbierta() { const v = lsLeer(LS_TR); return v ? v === '1' : !(window.matchMedia && matchMedia('(max-width:900px)').matches); }

  // ---------- «Cruzar diapositivas»: one photo across n slides in a row (carousels) ----------
  // Each slide holds a copy of the same frame, el.pan = {id, n, k}: k is the slide's place in the run (0 = first) and the
  // copy sits k slide widths to the left of the first one (x = x0 − k), so every slide draws its own window of one frame
  // and the seams meet to the pixel. The copy on the open slide is the one edited; the others follow it (enlazar).
  const PAN_PROPIO = ['id', 'g', 'pan'];
  function enlazar() {
    if (!E || !E.car || !E.sl.length) return;
    for (const m of compAt(E.i).els) {
      if (!m.pan) continue;
      E.sl.forEach((x, j) => {
        if (j === E.i || !x.comp) return;
        const e = x.comp.els.find(q => q.pan && q.pan.id === m.pan.id); if (!e) return;
        for (const k of Object.keys(e)) if (!PAN_PROPIO.includes(k) && !(k in m)) delete e[k];
        for (const [k, v] of Object.entries(m)) if (!PAN_PROPIO.includes(k)) e[k] = clone(v);
        e.x = m.x + m.pan.k - e.pan.k;
      });
    }
  }
  // a run stays linked while its copies are on slides in a row, in order; otherwise (a slide moved, taken out or added in
  // the middle) the copies come apart and each slide keeps its piece. Returns true when a run came apart that way.
  function repararPan() {
    if (!E) return false;
    const runs = new Map();
    E.sl.forEach((x, j) => {
      if (!x.comp) return;
      const vistos = new Set();
      for (const e of x.comp.els) {
        if (!e.pan) continue;
        if (!E.car || e.t !== 'foto' || vistos.has(e.pan.id)) { delete e.pan; continue; }
        vistos.add(e.pan.id);
        if (!runs.has(e.pan.id)) runs.set(e.pan.id, []);
        runs.get(e.pan.id).push({ j, e });
      }
    });
    let roto = false;
    for (const r of runs.values()) {
      const seguidos = r.length > 1 && r.every((q, t) => !t || (q.j === r[t - 1].j + 1 && q.e.pan.k === r[t - 1].e.pan.k + 1));
      if (!seguidos) { if (r.length > 1) roto = true; r.forEach(q => delete q.e.pan); continue; }
      const k0 = r[0].e.pan.k; r.forEach(q => { q.e.pan.k -= k0; q.e.pan.n = r.length; });   // the same pieces, counted from the first
    }
    return roto;
  }
  // the selected photo crosses into the next slides (n = 1: it stays on this one alone); missing slides are added at the end.
  // A photo still inside its slide, or one filling its run, fills the n slides; one already crossing keeps its place.
  function cruzar(n) {
    const el = selEl(); if (!E.car || !el || el.t !== 'foto' || !el.src || el.lock) return;
    const k0 = el.pan ? el.pan.k : 0, b = E.i - k0, falta = Math.max(0, b + n - E.sl.length);
    if (n > 1 && n <= k0) return;
    if (E.sl.length + falta > MAX_SLIDES) { I().toast('Un carrusel admite como máximo 20 diapositivas (límite de Instagram).'); return; }
    mut(null, () => {
      const c = ensure(), m = c.els.find(q => q.id === el.id), id = m.pan ? m.pan.id : 'p' + uid(), n0 = m.pan ? m.pan.n : 1;
      const llena = m.pan ? Math.abs(m.x + k0) < 1e-3 && Math.abs(m.w - n0) < 1e-3 && Math.abs(m.y) < 1e-3 && Math.abs(m.h - 1) < 1e-3 : m.x >= -1e-3 && m.x + m.w <= 1 + 1e-3;
      E.sl.forEach((x, j) => { if (j !== E.i && x.comp) x.comp.els = x.comp.els.filter(e => !(e.pan && e.pan.id === id && (n === 1 || e.pan.k >= n))); });
      if (n === 1) { delete m.pan; return; }
      for (let t = 0; t < falta; t++) E.sl.push(blankSlide(c.bg || '#ffffff'));
      m.pan = { id, n, k: k0 };
      for (let k = 0; k < n; k++) {
        const x = E.sl[b + k]; if (b + k === E.i) continue;
        const cc = x.comp || (x.comp = clone(x.raw)); if (cc.els.some(e => e.pan && e.pan.id === id)) continue;
        const e = { ...clone(m), id: uid(), pan: { id, n, k } }; delete e.g;
        const top = cc.els.reduce((a, q, t) => q.t === 'foto' ? t + 1 : a, 0); cc.els.splice(top, 0, e);   // above the slide's photos, under its texts and logos
      }
      if (llena) llenar(m);
    });
    I().toast(n === 1 ? 'La foto ya no cruza: se queda solo en esta diapositiva.' : `La foto cruza las diapositivas ${b + 1} a ${b + n}${falta ? ` (${falta === 1 ? '1 nueva' : falta + ' nuevas'})` : ''}.`);
  }
  function cruzarHTML(el) {
    if (!E.car || el.t !== 'foto' || !el.src) return '';
    const n = el.pan ? el.pan.n : 1, k = el.pan ? el.pan.k : 0, b = E.i - k;
    const op = [1, 2, 3, 4, 5].map(v => { const off = el.lock || (v > 1 && v <= k) || E.sl.length + Math.max(0, b + v - E.sl.length) > MAX_SLIDES; return `<button type="button" data-lb="cruzar" data-v="${v}" class="${v === n ? 'on' : ''}" aria-pressed="${v === n}"${off ? ' disabled' : ''}>${v === 1 ? 'Solo esta' : v}</button>`; }).join('');
    const txt = n > 1 ? `Va de la diapositiva ${b + 1} a la ${b + n}. Muévela, amplíala o reencuádrala en cualquiera: las otras la siguen. «Llenar» la reparte entre las ${n}.` : 'Elige en cuántas diapositivas sigue, contando esta. Si faltan, se añaden al final.';
    return `<div class="lb-sec"><h4>Cruzar diapositivas <span>· la foto sigue en las de al lado</span></h4><div class="seg" role="group" aria-label="Diapositivas que cruza la foto">${op}</div><p class="lb-p">${txt}</p></div>`;
  }

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
#mesa .lb-mv button,#mesa .lb-ord button{border:0;background:none;width:24px;height:24px;border-radius:6px;font-size:11.5px;line-height:24px;padding:0;color:var(--mute)}
#mesa .lb-mv button:hover:not(:disabled){background:var(--line2);color:var(--ink)}#mesa .lb-mv button:disabled,#mesa .lb-ord button:disabled{opacity:.3;cursor:default}
#mesa .lb-ord{position:absolute;top:4px;right:4px;display:flex;flex-direction:column;background:rgba(255,255,255,.92);border-radius:7px;box-shadow:0 1px 4px rgba(0,0,0,.18)}
#mesa .lb-ord button{color:var(--ink)}#mesa .lb-ord button:hover:not(:disabled){background:var(--line2)}
@media (hover:hover) and (min-width:901px){#mesa .lb-it:not(:hover):not(:focus-within) .lb-ord{display:none}}
#mesa .lb-add{width:100%;font-size:12.5px;padding:6px 4px}
#mesa .lb-mid{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
#mesa .lb-scroll{flex:1;min-height:0;overflow:auto;display:flex;padding:18px}
#mesa .lb-cvw{margin:auto;flex:none;line-height:0}
#mesa .lb-cv{display:block;background:#e6e6e6;box-shadow:0 4px 22px rgba(0,0,0,.16);touch-action:none}
#mesa .lb-hint{flex:none;margin:0;padding:4px 12px 2px;text-align:center;color:var(--mute);font-size:12.5px}
#mesa .lb-foot{flex:none;position:relative;display:flex;justify-content:center;align-items:center;min-height:32px;margin:2px 0 4px}
#mesa .lb-trb{display:flex;align-items:center;gap:4px;height:28px;padding:0 6px 0 10px;border:0;border-radius:6px;background:none;color:var(--mute);font-size:12.5px}
#mesa .lb-trb:hover{background:var(--line2);color:var(--ink)}#mesa .lb-trb svg{transition:transform .18s}#mesa .lb-trb[aria-expanded="true"] svg{transform:rotate(180deg)}
#mesa .lb-tray{flex:none;margin:6px 14px 2px;padding:8px 10px 6px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
#mesa .lb-trh{margin-bottom:6px;font-size:12.5px;color:var(--mute)}#mesa .lb-trh b{color:var(--ink);font-weight:600}
#mesa .lb-trs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}#mesa .lb-tph{flex:none;width:72px;cursor:grab}
#mesa .lb-tph.uso::after{content:'✓';position:absolute;right:3px;bottom:3px;width:16px;height:16px;border-radius:50%;background:var(--acc);color:#fff;font-size:11.5px;line-height:16px;text-align:center}
#mesa .lb-tray.over,#mesa .lb-scroll.over{outline:2px dashed var(--acc);outline-offset:-4px}#mesa .lb-it.over canvas{outline-color:var(--acc)}
#mesa .lb-ghost{position:fixed;z-index:30;width:64px;height:64px;object-fit:cover;border-radius:6px;transform:translate(-50%,-50%);pointer-events:none;opacity:.85;box-shadow:0 6px 18px rgba(0,0,0,.25)}
#mesa .lb-panel{overflow-y:auto;padding:0 16px 24px;background:var(--panel);border-left:1px solid var(--line2)}
#mesa .lb-sec{padding:12px 0 14px;border-bottom:1px solid var(--line2)}#mesa .lb-sec:last-child{border-bottom:0}
#mesa .lb-sec h4{margin:0 0 8px;font-size:13px;font-weight:600}#mesa .lb-sec h4 span{font-weight:400;color:var(--mute);font-size:12.5px}
#mesa .lb-p{margin:6px 0 0;font-size:12.5px;color:var(--mute)}
#mesa .lb-l{display:block;font-size:12.5px;font-weight:600;margin:12px 0 6px}
#mesa .lb-sws{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
#mesa .lb-sw{width:24px;height:24px;border-radius:50%;border:1px solid rgba(0,0,0,.18);padding:0}
#mesa .lb-sw.on{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--acc)}
#mesa .lb-swk{margin:10px 0 6px;font-size:12px;font-weight:600}#mesa .lb-cols>.lb-swk:first-child{margin-top:0}
#mesa .lb-swgs{display:flex;flex-wrap:wrap;gap:8px 18px}#mesa .lb-swg>span{display:block;margin-bottom:5px;font-size:11.5px;color:var(--mute)}
#mesa .lb-swf{display:flex;align-items:center;gap:9px;margin-bottom:10px;font-size:12px;color:var(--mute)}#mesa .lb-swf .lb-sw{flex:none;box-sizing:border-box}
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
#mesa .lb-ph .x{position:absolute;top:2px;right:2px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:11.5px;line-height:24px;text-align:center}
#mesa .lb-grids{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#mesa .lb-g{border:1px solid var(--line);border-radius:6px;background:var(--panel);padding:6px;height:56px}#mesa .lb-g:hover{border-color:var(--ink)}
#mesa .lb-g svg{width:100%;height:100%;display:block}
#mesa .lb-tpls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}
#mesa .lb-tp{position:relative;min-width:0}#mesa .lb-tp canvas{width:100%;height:auto;display:block;border-radius:4px;cursor:pointer;outline:1px solid var(--line2)}
#mesa .lb-tp canvas:hover{outline:2px solid var(--acc)}
#mesa .lb-tp span{display:block;font-size:11.5px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px}
#mesa .lb-tp button{position:absolute;top:3px;right:3px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:12.5px;line-height:24px;padding:0}
#mesa .lb-caps{border:1px solid var(--line2);border-radius:8px;overflow:hidden}
#mesa .lb-cap{display:flex;align-items:center;gap:2px;padding:4px 6px 4px 9px;font-size:12.5px;cursor:pointer;border-top:1px solid var(--line2)}#mesa .lb-cap:first-child{border-top:0}
#mesa .lb-cap:hover{background:var(--bg)}#mesa .lb-cap.on{background:#e8f3fe}
#mesa .lb-capn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mesa .lb-capn i{font-style:normal;color:var(--mute)}
#mesa .lb-cap button{border:0;background:none;width:24px;height:24px;border-radius:5px;padding:0;font-size:11.5px;color:var(--mute)}
#mesa .lb-cap button:hover:not(:disabled){background:var(--line2);color:var(--ink)}#mesa .lb-cap button:disabled{opacity:.25}
#mesa .lb-cap.off .lb-capn{opacity:.45}
#mesa .lb-all{position:absolute;inset:0;z-index:20;background:var(--bg);overflow:auto;padding:16px 20px}
#mesa .lb-allh{display:flex;align-items:center;gap:12px;margin-bottom:14px}#mesa .lb-allh h4{margin:0;font-size:15px;flex:1}
#mesa .lb-allg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:18px}
#mesa .lb-allit{border:0;background:none;padding:0;text-align:left;font-size:12.5px;color:var(--mute)}
#mesa .lb-allit canvas{display:block;width:100%;height:auto;border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.12);outline:2px solid transparent;outline-offset:3px;margin-bottom:6px}
#mesa .lb-allit.on canvas,#mesa .lb-allit:hover canvas{outline-color:var(--acc)}
#mesa .lb-ask{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}
#mesa .lb-askc{background:var(--panel);border-radius:12px;padding:18px 18px 16px;max-width:400px;box-shadow:0 10px 40px rgba(0,0,0,.25)}
#mesa .lb-askc h4{margin:0 0 6px;font-size:15px}#mesa .lb-askc p{margin:0 0 6px;color:var(--mute);font-size:13px}
#mesa .lb-askin{display:block;width:100%;box-sizing:border-box;margin:8px 0 4px;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:inherit;font-size:13px}#mesa .lb-askin:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
#mesa .lb-it,#mesa .lb-allit{position:relative}#mesa .lb-it.lb-drg,#mesa .lb-allit.lb-drg{opacity:.4}
#mesa .lb-it.lb-dl::before,#mesa .lb-it.lb-dr::after{content:'';position:absolute;left:0;right:0;height:3px;border-radius:2px;background:var(--acc)}#mesa .lb-it.lb-dl::before{top:-8px}#mesa .lb-it.lb-dr::after{bottom:-8px}
#mesa .lb-allit.lb-dl::before,#mesa .lb-allit.lb-dr::after{content:'';position:absolute;top:0;bottom:0;width:3px;border-radius:2px;background:var(--acc)}#mesa .lb-allit.lb-dl::before{left:-10px}#mesa .lb-allit.lb-dr::after{right:-10px}
#mesa .lb-pv{position:absolute;inset:0;z-index:25;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
#mesa .lb-pv .igtop{align-self:stretch}#mesa .lb-pvt{flex:1;min-width:0;color:rgba(255,255,255,.85);font-size:12.5px}#mesa .lb-pvc{position:absolute;inset:0;width:100%;height:100%;display:block}
#mesa .lb-fmtw{display:inline-flex;align-items:center;gap:6px}#mesa .lb-fmtl{font-size:12.5px;color:var(--mute)}
#mesa .lb-mas{position:relative;display:inline-flex}
#mesa .lb-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:12;display:flex;flex-direction:column;min-width:220px;padding:4px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
#mesa .lb-menu[hidden],#mesa .lb-fl[hidden],#mesa .lb-atajos[hidden],#mesa .lb-flm[hidden]{display:none}
#mesa .lb-menu button,#mesa .lb-flm button{border:0;background:none;border-radius:7px;padding:8px 10px;text-align:left;font-size:13px;color:var(--ink)}
#mesa .lb-menu button:hover,#mesa .lb-flm button:hover:not(:disabled){background:var(--line2)}
#mesa .lb-menu [aria-checked]::before{content:'';display:inline-block;width:18px}#mesa .lb-menu [aria-checked="true"]::before{content:'✓'}
#mesa .lb-help{position:absolute;right:12px;top:2px;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--mute);font-size:13px;font-weight:600;padding:0}
#mesa .lb-help:hover,#mesa .lb-help[aria-expanded="true"]{color:var(--ink);border-color:var(--ink)}
#mesa .lb-atajos{position:absolute;right:12px;bottom:calc(100% + 6px);z-index:12;width:min(400px,calc(100vw - 32px));max-height:min(70vh,520px);overflow:auto;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);font-size:12.5px}
#mesa .lb-atajos h4{margin:0 0 8px;font-size:13px}#mesa .lb-atajos dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0}
#mesa .lb-atajos dt{font-weight:600;white-space:nowrap}#mesa .lb-atajos dd{margin:0;color:var(--mute)}#mesa .lb-atajos p{margin:10px 0 0;color:var(--mute)}
#mesa .lb-cvw{position:relative}
#mesa .lb-fl{position:absolute;z-index:4;display:flex;gap:2px;padding:3px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.14);line-height:1.4;white-space:nowrap}
#mesa .lb-fl>button{border:0;background:none;border-radius:7px;padding:6px 10px;font-size:12.5px;color:var(--ink)}
#mesa .lb-fl>button:hover:not(:disabled),#mesa .lb-fl>button[aria-expanded="true"]{background:var(--line2)}#mesa .lb-fl>button:disabled{opacity:.35;cursor:default}
#mesa .lb-fl>button.del{color:var(--chg)}
#mesa .lb-flm{position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;min-width:140px;padding:4px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
#mesa .lb-flm button:disabled{opacity:.35;cursor:default}
#mesa details.lb-pl{padding:0}#mesa details.lb-pl>summary{display:flex;align-items:center;gap:8px;padding:12px 0;cursor:pointer;list-style:none;font-size:13px;font-weight:600}
#mesa details.lb-pl>summary::-webkit-details-marker{display:none}
#mesa details.lb-pl>summary span{margin-left:auto;font-weight:400;font-size:12.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa details.lb-pl>summary::after{content:'›';color:var(--mute);font-size:15px;line-height:1;transition:transform .15s}#mesa details.lb-pl[open]>summary::after{transform:rotate(90deg)}
#mesa details.lb-pl>.lb-plc{padding:0 0 14px}#mesa details.lb-pl .lb-plc>.lb-sub{margin:0 0 12px}#mesa details.lb-pl .lb-plc>.lb-sub:last-child{margin-bottom:0}
#mesa .lb-sub h5{margin:0 0 6px;font-size:12.5px;font-weight:600}
#mesa .lb-allh .seg{margin-right:auto}
#mesa .lb-allg.seguidas{display:flex;gap:0;overflow-x:auto;padding:4px 0 10px}#mesa .lb-allg.seguidas::before,#mesa .lb-allg.seguidas::after{content:'';margin:auto}
#mesa .lb-allg.seguidas .lb-allit{flex:none;width:var(--lbw,240px)}
#mesa .lb-allg.seguidas .lb-allit canvas{border-radius:0;box-shadow:none;outline:0;margin:0}#mesa .lb-allg.seguidas .lb-allit.on canvas{outline:0}
#mesa .lb-allg.seguidas .lb-allt{display:none}
#mesa .lb-seam{position:absolute;top:0;bottom:0;left:0;width:0;border-left:1.5px dashed rgba(255,255,255,.95);box-shadow:-1px 0 0 rgba(0,0,0,.18);pointer-events:none}
#mesa .lb-allg:not(.seguidas) .lb-seam{display:none}
#mesa .lb-allnota{margin:12px 0 0;text-align:center;color:var(--mute);font-size:12.5px}
@media (max-width:900px){#mesa .lb-body{grid-template-columns:104px minmax(0,1fr);grid-template-rows:minmax(240px,55%) minmax(0,1fr)}#mesa .lb-panel{grid-column:1/-1;border-left:0;border-top:1px solid var(--line2)}#mesa .lb-list{grid-row:1;padding:10px 8px}#mesa .lb-scroll{padding:10px}#mesa .lb-add{font-size:11.5px;padding:5px 2px}}`;
  function injectCSS() { let st = document.getElementById('lb-css'); if (!st) { st = document.createElement('style'); st.id = 'lb-css'; document.head.append(st); } if (st.textContent !== CSS) st.textContent = CSS; }

  function build(s) {
    const root = I().root(), el = document.createElement('div');
    el.className = 'lb'; el.tabIndex = -1;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Editar ' + s.name);
    el.innerHTML = `<header class="lb-head"><div class="lb-ttl"><h3>${esc(s.name)}</h3><p>${E.tipo === 'Foto' ? 'Editar foto' : E.reel ? 'Editar portada' : 'Editar diapositivas'} · ${E.dz ? 'diseño de «Diseñar»: si aplicas cambios, queda fijado como imagen' : 'lo que no toques se queda como está'}</p></div>`
      + (E.reel ? '<span class="lb-fmtw"><span class="lb-fmtl">Portada del reel · 9:16</span></span>' : `<span class="lb-fmtw"><span class="lb-fmtl">${E.car ? 'Diapositivas' : 'Diapositiva'}</span><div class="seg lb-fmt" role="group" aria-label="Formato de ${E.car ? 'las diapositivas' : 'la diapositiva'}">${Object.entries(FMTS).map(([k, l]) => `<button type="button" data-lb="fmt" data-v="${k}">${l}</button>`).join('')}</div></span>`)
      + '<span class="lb-tools"><button type="button" class="lb-ib" data-lb="undo" title="Deshacer (⌘Z)" aria-label="Deshacer">↶</button><button type="button" class="lb-ib" data-lb="redo" title="Rehacer (⇧⌘Z)" aria-label="Rehacer">↷</button></span>'
      + '<span class="lb-tools"><button type="button" class="lb-ib" data-lb="zout" title="Alejar" aria-label="Alejar">−</button><output class="lb-zv">100 %</output><button type="button" class="lb-ib" data-lb="zin" title="Acercar" aria-label="Acercar">+</button><button type="button" class="lb-ib" data-lb="zfit" title="Ver la diapositiva entera">Ajustar</button></span>'
      + '<button type="button" class="lb-ib" data-lb="preview" title="Cómo se verá en Instagram, como en la vista cliente">Vista previa</button>'
      + '<span class="lb-mas"><button type="button" class="lb-ib" data-lb="mas" title="Más" aria-label="Más opciones" aria-haspopup="menu" aria-expanded="false">⋯</button>'
      + '<span class="lb-menu" role="menu" hidden><button type="button" role="menuitem" data-lb="todas">Ver todas las diapositivas</button>'
      + '<button type="button" role="menuitemcheckbox" data-lb="iman" aria-checked="true" title="Alinea con los bordes, el centro y los otros elementos al arrastrar (con ⌘ pulsado no actúa)">Imán al arrastrar</button></span></span>'
      + '<span class="lb-state" aria-live="polite"></span><button type="button" class="btn2" data-lb="cerrar">Cerrar</button><button type="button" class="btn" data-lb="aplicar">Aplicar a la casilla</button></header>'
      + '<div class="lb-body"><nav class="lb-list" aria-label="Diapositivas"></nav>'
      + '<section class="lb-mid"><div class="lb-scroll"><div class="lb-cvw"><canvas class="lb-cv" aria-label="Diapositiva"></canvas><div class="lb-fl" role="toolbar" aria-label="Elemento elegido" hidden></div></div></div>'
      + '<p class="lb-hint" aria-live="polite" hidden></p>'
      + `<div class="lb-tray" id="lb-tray" hidden></div><div class="lb-foot"><button type="button" class="lb-trb" data-lb="bandeja" aria-expanded="false" aria-controls="lb-tray" title="Bandeja: sus fotos, para ponerlas en la diapositiva"><span class="lb-trn">Bandeja</span>${FLECHA}</button>`
      + `<button type="button" class="lb-help" data-lb="atajos" aria-label="Atajos de teclado" aria-expanded="false" title="Atajos de teclado">?</button><div class="lb-atajos" role="dialog" aria-label="Atajos de teclado" hidden>${ATAJOS}</div></div></section>`
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
    q('[data-lb="iman"]').setAttribute('aria-checked', String(E.iman));
    const f = fmtAt(E.i);
    E.el.querySelectorAll('.lb-fmt button').forEach(b => { const on = b.dataset.v === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  function lista() {
    const nav = E.el.querySelector('.lb-list'), top = nav.scrollTop, n = E.sl.length;
    nav.innerHTML = E.sl.map((x, i) => {
      const tag = !x.key ? 'nueva' : x.out || changedSl(x) ? 'editada' : 'foto';
      return `<div class="lb-it${i === E.i ? ' on' : ''}" data-lb="sl" data-i="${i}" tabindex="0" role="button" aria-label="Diapositiva ${i + 1}" title="Arrástrala para cambiar el orden (o ⌥ + flechas)"><canvas></canvas>`
        + (n > 1 ? `<span class="lb-ord"><button type="button" data-lb="sl-up" data-i="${i}" title="Mover antes" aria-label="Mover antes"${i === 0 ? ' disabled' : ''}>▲</button>`
        + `<button type="button" data-lb="sl-dn" data-i="${i}" title="Mover después" aria-label="Mover después"${i === n - 1 ? ' disabled' : ''}>▼</button></span>` : '')
        + `<div class="lb-n"><b>${i + 1}</b> ${tag}${changedSl(x) || (!E.car && x.fmt !== x.fmt0) ? ' <em title="Cambios sin aplicar">•</em>' : ''}<span class="lb-mv">`
        + (E.reel ? '' : `<button type="button" data-lb="sl-del" data-i="${i}" title="Quitar la diapositiva (su foto vuelve a la bandeja al aplicar)" aria-label="Quitar la diapositiva">×</button>`) + '</span></div></div>';
    }).join('') + (E.reel ? '' : `<button type="button" class="btn2 lb-add" data-lb="sl-add" title="Una diapositiva solo con color de fondo, detrás de la elegida">+ Diapositiva sin foto</button>`);
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
    if (E.pv) pvDibujar();
  }
  function verTodas(on) {
    const a = E.allEl;
    if (!on) { a.hidden = true; a.innerHTML = ''; return; }
    const sg = lsLeer(LS_SEG) === '1';
    a.innerHTML = `<div class="lb-allh"><h4>Todas las diapositivas</h4>${seg('seguidas', [['0', 'Separadas'], ['1', 'Seguidas']], sg ? '1' : '0')}<button type="button" class="btn2" data-lb="todas">Volver</button></div><div class="lb-allg${sg ? ' seguidas' : ''}">`
      + E.sl.map((x, i) => `<button type="button" class="lb-allit${i === E.i ? ' on' : ''}" data-lb="sl" data-i="${i}" aria-label="Diapositiva ${i + 1}">${i ? '<span class="lb-seam"></span>' : ''}<canvas></canvas><span class="lb-allt">Diapositiva ${i + 1}${!x.key ? ' · nueva' : x.out || changedSl(x) ? ' · editada' : ''}</span></button>`).join('') + '</div>'
      + (sg ? '<p class="lb-allnota">Así se unen al deslizar. Que el corte (la línea discontinua) no caiga sobre caras ni textos.</p>' : '');
    a.hidden = false;
    if (sg) a.querySelector('.lb-allg').style.setProperty('--lbw', clamp(Math.floor((a.clientWidth - 48) / Math.max(1, E.sl.length)), 140, 360) + 'px');
    minis();
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
    posBarra();
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
  function setPhoto(el, patch, i = E.i) {   // the photo inside its frame, clamped like the mesa's reframe
    Object.assign(el, patch); el.z = clamp(el.z || 1, 1, 3);
    const f = el.src && M.files[el.src]; if (!f || el.t !== 'foto') return;
    const { W, H } = sizeAt(i), ib = hueco(el, el.w * W, el.h * H), r = srcRect(el, f.w, f.h, ib.w, ib.h);
    el.cx = r4((r.x + r.w / 2) / f.w); el.cy = r4((r.y + r.h / 2) / f.h);
  }
  function encajar(el, m, i = E.i) { const { W, H } = sizeAt(i); encajarWH(el, m, W, H); }
  function encajarWH(el, m, W, H) {   // the whole photo, centred, inside the slide less a margin (fraction of the width); a crossing photo: inside its slides
    const f = el.src && M.files[el.src]; if (!f) return;
    const n = el.pan ? el.pan.n : 1, k = el.pan ? el.pan.k : 0;
    const aw = n * W - 2 * m * W, ah = H - 2 * m * W, ar = f.w / f.h;
    let w = aw, h = aw / ar; if (h > ah) { h = ah; w = ah * ar; }
    Object.assign(el, { w: r4(w / W), h: r4(h / H), x: r4((n * W - w) / 2 / W) - k, y: r4((H - h) / 2 / H), cx: 0.5, cy: 0.5, z: 1, rot: 0, fit: m, marco: null }); delete el.rat;
  }
  function dentro(el, W, H) {         // the whole photo, centred in the frame it has (the frame shrinks to it)
    const f = el.src && M.files[el.src]; if (!f) return;
    const bw = el.w * W, bh = el.h * H, ar = f.w / f.h;
    let w = bw, h = bw / ar; if (h > bh) { h = bh; w = bh * ar; }
    Object.assign(el, { x: r4(el.x + (bw - w) / 2 / W), y: r4(el.y + (bh - h) / 2 / H), w: r4(w / W), h: r4(h / H), cx: 0.5, cy: 0.5, z: 1 }); delete el.rat;
  }
  // the frame takes the whole slide (a crossing photo: its n slides) and keeps the reframe: the same part of the photo
  // (same centre and area), only bigger
  function llenar(el, i = E.i) {
    const f = el.src && M.files[el.src], { W, H } = sizeAt(i), n = el.pan ? el.pan.n : 1;
    const old = f ? (() => { const ib = hueco(el, el.w * W, el.h * H); return srcRect(el, f.w, f.h, ib.w, ib.h); })() : null;
    Object.assign(el, { x: el.pan ? -el.pan.k : 0, y: 0, w: n, h: 1, rot: 0 }); delete el.fit; delete el.rat;
    if (!old) { Object.assign(el, { cx: 0.5, cy: 0.5, z: 1 }); return; }
    const ib = hueco(el, n * W, H), R = ib.w / ib.h, cw = f.w / f.h > R ? f.h * R : f.w;   // the cover crop's width at the new ratio
    setPhoto(el, { cx: (old.x + old.w / 2) / f.w, cy: (old.y + old.h / 2) / f.h, z: r4(cw / Math.sqrt(old.w * old.h * R)) }, i);
  }
  // ---------- «Transformar»: the selected photos' frames take a format ----------
  // Same area as the frame chosen first (several photos end up identical), centred where each was and inside the slide;
  // the photo fills it again (zoom 1) and, one photo alone, the reframe opens at once
  const RVAL = Object.fromEntries([...RATIOS.v, ...RATIOS.h]);
  function marcoRat(e, R, A, W, H) {
    let w = Math.sqrt(A * R), h = Math.sqrt(A / R); const k = Math.min(1, W / w, H / h); w *= k; h *= k;
    const cx = (e.x + e.w / 2) * W, cy = (e.y + e.h / 2) * H;
    Object.assign(e, { x: r4(clamp(cx - w / 2, 0, W - w) / W), y: r4(clamp(cy - h / 2, 0, H - h) / H), w: r4(w / W), h: r4(h / H) }); delete e.fit;
  }
  function transformar(nombre, R) {
    const fotos = selEls().filter(e => e.t === 'foto' && !e.lock); if (!fotos.length || !(R > 0)) return;
    const { W, H } = sizeAt(E.i), p = fotos.find(e => e.id === E.sel) || fotos[0], A = p.w * W * p.h * H, ids = fotos.map(e => e.id);
    mut(null, () => {
      for (const e of ensure().els.filter(q => ids.includes(q.id))) { marcoRat(e, R, A, W, H); e.rat = nombre; e.z = 1; if (e.src) setPhoto(e, {}); }
      E.crop = ids.length === 1 && fotos[0].src ? ids[0] : null;
    });
  }
  // a new slide format changes the frames' proportion on screen: a transformed one keeps its own (same area)
  function mantenerRat(x, i) {
    const { W, H } = sizeAt(i);
    fotosDe(x.comp).forEach(e => { if (e.rat && RVAL[e.rat]) { marcoRat(e, RVAL[e.rat], e.w * W * e.h * H, W, H); if (e.src) setPhoto(e, {}, i); } });
  }
  // ---------- another proportion: texts, shapes and logos keep their place ----------
  // el.mano: moved, resized or turned by hand (drag, arrows, «Alinear», exact measures) — a new proportion leaves it alone
  function aMano(ids) { compAt(E.i).els.forEach(e => { if (ids.includes(e.id) && e.t !== 'foto') e.mano = true; }); }
  function recolocar() {             // a slide whose proportion changed (its format, or its first photo in Horizontal)
    E.sl.forEach((x, i) => {
      const { W, H } = sizeAt(i), r = W / H;
      if (x.comp && x.rat && Math.abs(x.rat - r) > 0.005) {   // as «Aplicar»'s check: a 1080 copy is the same proportion
        reubicar(x.comp, W, Math.round(W / x.rat), H, x.zonas || (x.zonas = {}));
        if (x.base) igualar(x.comp, JSON.parse(x.base));
      }
      x.rat = r;
    });
  }
  function igualar(c, b) {           // back in the proportion it opened with: what only differs by rounding is as it was
    for (const e of c.els) {
      const o = b.els && b.els.find(q => q.id === e.id), ks = e.t === 'texto' ? ['x', 'y', 'w', 'size'] : ['x', 'y', 'w', 'h', 'b'];
      if (o && ks.every(k => Math.abs((e[k] || 0) - (o[k] || 0)) < 3e-4)) ks.forEach(k => { if (o[k] != null) e[k] = o[k]; });
    }
  }
  // From W×H0 to W×H1. Each block — an element, or a group — that is not a photo, not a background (half the slide or more)
  // and not moved by hand keeps its zone (top, middle or bottom of the slide) and scales by k: k is the ratio of the short
  // sides, less when the zones would overlap or go past a margin of 4 % of the short side. Across, a text keeps its
  // alignment edge and its line breaks (box and letters scale alike), a small shape or logo keeps the side of the slide it
  // is on (a text inside it goes with it) and a line or a bar keeps its length. Photos keep their own frame rules.
  function reubicar(comp, W, H0, H1, zonas = {}) {   // zonas: the zone each block took the first time (a round trip comes back)
    const grupos = new Map(), B = [], ancla = new Map();
    for (const e of comp.els) { if (e.t === 'foto') continue; const g = e.g || e.id; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(e); }
    for (const [g, els] of grupos) {
      if (els.some(e => e.mano)) continue;
      const b = union(els, W, H0); if ((b.r - b.l) * (b.b - b.t) >= 0.5 * W * H0) continue;
      const cy = (b.t + b.b) / 2 / H0;
      if (zonas[g] == null) zonas[g] = cy < 0.4 ? 0 : cy > 0.6 ? 2 : 1;
      B.push({ els, b, zy: zonas[g] });
      for (const e of els) {         // a small shape or logo (not a line nor a bar): the side it is on
        const l = e.x * W, w = e.w * W, h = e.h * H0, c = l + w / 2;
        if (e.t !== 'texto' && w < 3 * h && h < 3 * w) ancla.set(e, c < 0.4 * W ? l : c > 0.6 * W ? l + w : c);
      }
      for (const e of els) {         // a text: its alignment edge, or the one of the shape it sits in
        if (e.t !== 'texto') continue;
        const l = e.x * W, w = e.w * W, cx = l + w / 2, cy = (e.y + e.h / 2) * H0;
        const caja = els.find(q => ancla.has(q) && cx >= q.x * W && cx <= (q.x + q.w) * W && cy >= q.y * H0 && cy <= (q.y + q.h) * H0);
        ancla.set(e, caja ? ancla.get(caja) : e.al === 'der' ? l + w : e.al === 'cen' ? cx : l);
      }
    }
    if (!B.length) return;
    const m = 0.04 * Math.min(W, H1), gap = 0.02 * H1, z = [0, 1, 2].map(n => B.filter(q => q.zy === n));
    const plan = k => {              // where the zones go with k: the top one from the top, the bottom one from the bottom (both kept off the margin), the middle one around the centre
      const st = z[0].length ? Math.max(0, m - Math.min(...z[0].map(q => q.b.t)) * k) : 0, sb = z[2].length ? Math.max(0, m - (H0 - Math.max(...z[2].map(q => q.b.b))) * k) : 0;
      const Y = [y => y * k + st, y => H1 / 2 + (y - H0 / 2) * k, y => H1 - (H0 - y) * k - sb];
      const iv = z.map((q, n) => q.length ? [Math.min(...q.map(o => Y[n](o.b.t))), Math.max(...q.map(o => Y[n](o.b.b)))] : null).filter(Boolean);
      let ok = iv.every(v => v[0] >= m - 0.5 && v[1] <= H1 - m + 0.5);
      for (let n = 1; n < iv.length; n++) if (iv[n][0] < iv[n - 1][1] + gap) ok = false;
      return { ok, Y };
    };
    let k = Math.min(W, H1) / Math.min(W, H0);
    for (const [e, A] of ancla) {   // growing, nothing goes past the side margins
      const l = e.x * W, r = l + e.w * W;
      if (l < A - 0.5) k = Math.min(k, Math.max(1, (A - m) / (A - l)));
      if (r > A + 0.5) k = Math.min(k, Math.max(1, (W - m - A) / (r - A)));
    }
    if (!plan(k).ok) { let lo = 0.25, hi = k; for (let t = 0; t < 24; t++) { const md = (lo + hi) / 2; if (plan(md).ok) lo = md; else hi = md; } k = lo; }
    const { Y } = plan(k);
    for (const q of B) for (const e of q.els) {
      const A = ancla.get(e), x0 = e.x * W, w0 = e.w * W;
      if (A != null) Object.assign(e, { x: r4((A + (x0 - A) * k) / W), w: r4(w0 * k / W) });
      Object.assign(e, { y: r4(Y[q.zy](e.y * H0) / H1), h: r4(e.h * H0 * k / H1) });
      if (e.t === 'texto') e.size = r4((e.size || 0.06) * k);
      if (e.t === 'forma' && e.b) e.b = r4(e.b * k);
    }
  }
  function transformarHTML(els) {
    const fotos = els.filter(e => e.t === 'foto'); if (!fotos.length) return '';
    const e0 = fotos.find(e => e.id === E.sel) || fotos[0], { W, H } = sizeAt(E.i);
    const ori = E.tOri || (e0.rat ? (RATIOS.h.some(([n]) => n === e0.rat) && e0.rat !== '1:1' ? 'h' : 'v') : e0.w * W > e0.h * H * 1.01 ? 'h' : 'v');
    const rat = fotos.every(e => e.rat === e0.rat) ? e0.rat : null, off = fotos.every(e => e.lock);
    return `<div class="lb-sec"><h4>Proporción del marco${fotos.length > 1 ? ` <span>· de las ${fotos.length} fotos</span>` : ''}</h4>${seg('t-ori', [['v', 'Vertical'], ['h', 'Horizontal']], ori)}`
      + `<div class="lb-btns">${RATIOS[ori].map(([n, r]) => `<button type="button" class="btn2${rat === n ? ' on' : ''}" data-lb="t-rat" data-v="${n}" data-r="${r}"${off ? ' disabled' : ''}>${n}</button>`).join('')}</div>`
      + (fotos.length > 1 ? '<p class="lb-p">Todas quedan con la misma proporción y tamaño.</p>' : '') + '</div>';
  }
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
    fotosDe(c).forEach((e, k) => { const q = cs[k]; if (!q) return; Object.assign(e, { x: r4(q.x / W), y: r4(q.y / H), w: r4(q.w / W), h: r4(q.h / H), rot: 0 }); delete e.fit; delete e.rat; if (e.src) setPhoto(e, {}); });
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
    if (!d.step) { if (d.lock || (d.t === 'move' && Math.hypot(p.x - d.p0.x, p.y - d.p0.y) * E.k < 3)) return; paso(); ensure(); d.step = true; if (d.t !== 'pan') aMano(d.t === 'move' ? d.el0s.map(o => o.id) : [d.id]); }
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
      else { if (d.hx) w = Math.max(MIN, l.x * d.hx); if (d.hy) h = Math.max(el.t === 'forma' ? 2 : MIN, l.y * d.hy); delete el.rat; }   // a side: the frame is cropped, its format is no longer the one chosen
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
  const USO = { bg: 'fondo', tc: 'texto', fc: 'relleno', bc: 'borde', 'velo-c': 'velo' };
  function sws(act, curC) {        // «Kit <marca>» (its groups for this picker) and «Básicos»; a colour shows once, where it first appears
    const seen = new Set(), uso = USO[act], cc = hexOk(curC) ? curC.toLowerCase() : '#ffffff';
    const nuevos = os => os.filter(o => !seen.has(o.c) && seen.add(o.c));
    const gs = (E.kit ? E.kit.grupos : []).filter(g => !g.usos || g.usos.includes(uso)).map(g => ({ n: g.n, os: nuevos(g.cols.map(k => ({ c: k.c, t: k.n + ' · ' + k.c }))) })).filter(g => g.os.length);
    const bas = nuevos(BASICOS.map(([c, n]) => ({ c, t: n + ' · ' + c })));
    const sw = o => `<button type="button" class="lb-sw${o.c === cc ? ' on' : ''}" style="background:${o.c}" data-lb="${act}" data-c="${o.c}" title="${esc(o.t)}" aria-label="${esc(o.t)}"></button>`;
    const fuera = 'Color actual · fuera de esta lista';   // an element's colour that this picker does not offer: kept, and shown so it can be replaced
    return '<div class="lb-cols">' + (seen.has(cc) ? '' : `<div class="lb-swf"><span class="lb-sw on" style="background:${cc}" role="img" title="${fuera} (${cc})" aria-label="${fuera} (${cc})"></span>${fuera}</div>`)
      + (gs.length ? `<div class="lb-swk">Kit ${esc(E.kit.n)}</div><div class="lb-swgs">${gs.map(g => `<div class="lb-swg">${g.n ? `<span>${esc(g.n)}</span>` : ''}<div class="lb-sws">${g.os.map(sw).join('')}</div></div>`).join('')}</div>` : '')
      + `<div class="lb-swk">Básicos</div><div class="lb-sws">${bas.map(sw).join('')}</div></div>`;
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
  // a section folded under its title: open or closed as this viewer left it, for every element and every post
  const plegable = (k, titulo, resumen, html) => `<details class="lb-sec lb-pl" data-pl="${k}"${ABIERTAS.has(k) ? ' open' : ''}><summary>${titulo}<span>${resumen}</span></summary><div class="lb-plc">${html}</div></details>`;
  function capasHTML(c) {
    if (!c.els.length) return '';
    const ids = selIds(), n = c.els.length;
    return plegable('capas', 'Capas', String(n), `<p class="lb-p" style="margin:0 0 8px">Arriba, lo que está delante. ⇧ + clic para elegir varias.</p><div class="lb-caps">${c.els.map((e, k) => ({ e, k })).reverse().map(({ e, k }) => `<div class="lb-cap${ids.includes(e.id) ? ' on' : ''}${e.oculto ? ' off' : ''}" data-lb="cap" data-id="${esc(e.id)}"><span class="lb-capn">${e.g ? '⛓ ' : ''}${nombreEl(e)}</span>`
      + `<button type="button" data-lb="cap-ver" data-id="${esc(e.id)}" title="${e.oculto ? 'Mostrar' : 'Ocultar (no sale en la imagen)'}" aria-label="${e.oculto ? 'Mostrar' : 'Ocultar'}">${e.oculto ? '◌' : '◉'}</button>`
      + `<button type="button" data-lb="cap-lock" data-id="${esc(e.id)}" title="${e.lock ? 'Desbloquear' : 'Bloquear'}" aria-label="${e.lock ? 'Desbloquear' : 'Bloquear'}">${e.lock ? '🔒' : '🔓'}</button>`
      + `<button type="button" data-lb="cap-up" data-id="${esc(e.id)}" title="Adelante" aria-label="Adelante"${k === n - 1 ? ' disabled' : ''}>▲</button><button type="button" data-lb="cap-dn" data-id="${esc(e.id)}" title="Atrás" aria-label="Atrás"${k === 0 ? ' disabled' : ''}>▼</button></div>`).join('')}</div>`);
  }
  function medidasHTML(el) {
    const { H } = sizeAt(E.i), v = (a, val, dis) => `<label>${a}<input type="number" class="lb-num" data-lb="m${a.toLowerCase()}" step="1" value="${Math.round(val)}"${dis ? ' disabled' : ''}></label>`;
    return plegable('medidas', 'Medidas exactas', 'en píxeles', `<div class="lb-nums">${v('X', el.x * 1080)}${v('Y', el.y * H * PX)}${v('An', el.w * 1080)}${v('Al', el.h * H * PX, el.t === 'texto')}</div>`
      + rng('op', 'Opacidad', el.op ?? 1, 0, 1, 0.01)
      + `<div class="lb-btns"><button type="button" class="btn2" data-lb="al1" data-v="h" title="Centrar a lo ancho de la diapositiva">Centrar ↔</button><button type="button" class="btn2" data-lb="al1" data-v="v" title="Centrar a lo alto de la diapositiva">Centrar ↕</button></div>`
      + '<p class="lb-p">En píxeles de una diapositiva de 1080 de ancho.</p>');
  }
  function girarHTML(el, voltear) {
    return plegable('girar', `Girar${voltear ? ' y voltear' : ''}`, `${Math.round((el.rot || 0) * 10) / 10}°${el.fx || el.fy ? ' · volteada' : ''}`, `<div class="lb-btns" style="align-items:center;margin-top:0"><label style="font-size:12.5px;display:flex;align-items:center;gap:6px">Ángulo <input type="number" class="lb-num" data-lb="rot" step="1" min="-180" max="180" value="${Math.round((el.rot || 0) * 10) / 10}">°</label>`
      + `<button type="button" class="btn2" data-lb="rotl" title="Girar 90° a la izquierda">⟲ 90°</button><button type="button" class="btn2" data-lb="rotr" title="Girar 90° a la derecha">⟳ 90°</button></div>`
      + (voltear ? `<div class="lb-btns"><button type="button" class="btn2${el.fx ? ' on' : ''}" data-lb="flipx">Voltear ↔</button><button type="button" class="btn2${el.fy ? ' on' : ''}" data-lb="flipy">Voltear ↕</button></div>` : ''));
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
      h += `<div class="lb-sec"><h4>${ss.length} elementos <span>· ${grp ? 'agrupados' : 'elegidos'}</span></h4><div class="lb-btns">${grp ? '<button type="button" class="btn2" data-lb="ungroup" title="⇧⌘G">Desagrupar</button>' : '<button type="button" class="btn" data-lb="group" title="⌘G">Agrupar</button>'}</div>`
        + `<span class="lb-l">Alinear entre ellos</span><div class="lb-btns">${[['izq', '⇤ Izquierda'], ['cen', '↔ Centro'], ['der', '⇥ Derecha'], ['arr', '⤒ Arriba'], ['med', '↕ Medio'], ['aba', '⤓ Abajo']].map(([v, l]) => `<button type="button" class="btn2" data-lb="al" data-v="${v}">${l}</button>`).join('')}</div>`
        + rng('op', 'Opacidad', ss[0] ? ss[0].op ?? 1 : 1, 0, 1, 0.01) + '<p class="lb-p">Arrastra cualquiera para moverlos juntos.</p></div>';
      h += transformarHTML(ss) + capasHTML(c);
    } else if (el) {
      if (el.t === 'foto') {
        const crop = E.crop === el.id;
        h += `<div class="lb-sec"><h4>Foto <span>· ${el.lock ? 'bloqueada' : crop ? 'encuadrando: arrastra la foto dentro del marco' : 'elegida'}</span></h4>`;
        if (crop) h += rng('z', 'Zoom', el.z || 1, 1, 3, 0.01) + '<div class="lb-btns"><button type="button" class="btn2" data-lb="crop-c">Centrar</button><button type="button" class="btn" data-lb="crop">Listo</button></div>';
        else h += `<div class="lb-btns"><button type="button" class="btn2" data-lb="crop"${!el.src || el.lock ? ' disabled' : ''} title="Mover y ampliar la foto dentro de su marco (o doble clic)">Encuadrar</button><button type="button" class="btn2" data-lb="rep">${el.src ? 'Reemplazar' : 'Elegir foto'}</button>`
          + `<button type="button" class="btn2${el.fit != null ? ' on' : ''}" data-lb="encajar"${!el.src || el.lock ? ' disabled' : ''} title="La foto entera, centrada, con el fondo alrededor">Encajar</button><button type="button" class="btn2" data-lb="llenar"${el.lock ? ' disabled' : ''} title="${el.pan ? `La foto ocupa las ${el.pan.n} diapositivas` : 'La foto ocupa toda la diapositiva'}">Llenar</button></div>`
          + (el.fit != null ? rng('fit', 'Margen', el.fit, 0, 0.2, 0.005) : '');
        h += '</div>' + cruzarHTML(el) + transformarHTML([el]);
        h += plegable('estilo', 'Marco y estilo', 'borde, esquinas, sombra', `<div class="lb-sub"><h5>Marco</h5>${seg('marco', [['', 'Ninguno'], ['polaroid', 'Polaroid'], ['pelicula', 'Película'], ['cinta', 'Cinta']], el.marco || '')}</div>`
          + `<div class="lb-sub"><h5>Estilo</h5>${rng('b', 'Borde', el.b || 0, 0, 0.06, 0.001)}<span class="lb-l">Color del borde</span>${sws('bc', el.bc || '#ffffff')}${rng('r', 'Esquinas', el.r || 0, 0, 1, 0.01)}${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}</div>`);
        h += girarHTML(el, true);
      } else if (el.t === 'texto') {
        const css = !(el.font && el.font.file);
        const est = E.estilos.length ? estiloDe(el) : null;
        h += `<div class="lb-sec"><h4>Texto <span>· doble clic en el texto para escribir</span></h4><textarea class="lb-ta" data-lb="txt" rows="3" aria-label="Texto">${esc(el.txt || '')}</textarea>`
          + (E.estilos.length ? `<span class="lb-l">Estilo de la marca</span><div class="lb-btns" style="margin-top:0">${E.estilos.map(st => `<button type="button" class="btn2${est && est.k === st.k ? ' on' : ''}" data-lb="est" data-v="${esc(st.k)}" title="Fuente, tamaño, interlineado y espaciado de «${esc(st.n)}» del kit">${esc(st.n)}</button>`).join('')}</div>` : '')
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
      h += medidasHTML(el) + capasHTML(c);
    } else {
      const v = c.velo, n0 = E.i + 1, est = !x.key ? 'nueva, sin foto' : x.out || changedSl(x) ? 'editada' : 'foto sin editar';
      const solo = fotosDe(c).filter(e => e.src && M.files[e.src] && !M.files[e.src].design);
      h += `<div class="lb-sec"><h4>Diapositiva ${n0} <span>· ${est}</span></h4><div class="lb-btns"><button type="button" class="btn2" data-lb="add">+ Foto</button><button type="button" class="btn2" data-lb="add-txt">+ Texto</button><button type="button" class="btn2" data-lb="add-forma" data-v="rect">+ Rectángulo</button><button type="button" class="btn2" data-lb="add-forma" data-v="elipse">+ Círculo</button><button type="button" class="btn2" data-lb="add-forma" data-v="linea">+ Línea</button>${clip() ? '<button type="button" class="btn2" data-lb="paste" title="⌘V">Pegar</button>' : ''}`
        + (!isRaw(x) && x.key && (solo.length || (!x.out && M.files[x.key] && M.files[x.key].design)) ? `<button type="button" class="btn2" data-lb="sl-orig" title="La diapositiva vuelve a ser la foto, sin edición">Quitar la edición</button>` : '') + '</div>'
        + (c.els.length ? '<p class="lb-p">Clic en un elemento para moverlo, girarlo o darle estilo.</p>' : '') + '</div>';
      if (E.estilos.length) h += `<div class="lb-sec"><h4>Textos de la marca <span>· fuentes y pesos del kit</span></h4><div class="lb-btns" style="margin-top:0">${E.estilos.map(st => `<button type="button" class="btn2 lb-est" data-lb="add-est" data-v="${esc(st.k)}" style="font-family:'${fuente(st.font).name}',sans-serif;font-weight:${st.font.w}" title="Añadir un texto «${esc(st.n)}»: luego se escribe, se mueve y se cambia como cualquier texto">${esc(st.n)}</button>`).join('')}</div></div>`;
      h += `<div class="lb-sec"><h4>Logos y pegatinas <span>· del cliente</span></h4>${E.logos.length ? `<div class="lb-photos">${E.logos.map(f => `<button type="button" class="lb-ph logo" data-lb="logo" data-f="${esc(f)}" title="Añadir ${esc(M.files[f].name || '')} (Alt + clic: quitarlo del kit)"><img src="${M.files[f].thumbUrl || ''}" alt=""></button>`).join('')}</div>` : '<p class="lb-p" style="margin:0">Sube el logo del cliente (mejor PNG con transparencia) y queda guardado para todos sus meses.</p>'}`
        + '<div class="lb-btns"><button type="button" class="btn2" data-lb="logo-up">Subir logo o pegatina</button></div></div>';
      h += `<div class="lb-sec"><h4>Fondo</h4>${sws('bg', c.bg)}</div>`;
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
    const pista = E.el.querySelector('.lb-hint'), enc = !!(el && E.crop === el.id);   // a hint only while reframing (the rest: «?»)
    pista.hidden = !enc; pista.textContent = enc ? 'Encuadrando: arrastra la foto dentro del marco · rueda o «Zoom» para acercar · Esc o «Listo» para terminar' : '';
    barra();
  }
  // ---------- the bar over the selection: Duplicar · Bloquear · Delante / detrás · Borrar ----------
  function barra() {
    const fl = E && E.el && E.el.querySelector('.lb-fl'); if (!fl) return;
    const ss = E.sl.length && !E.crop && !E.pick ? selEls() : [];
    if (!ss.length) { fl.hidden = true; fl.innerHTML = ''; E.flm = false; return; }
    const c = compAt(E.i), n = c.els.length, idx = ss.map(e => c.els.indexOf(e)), el = selEl();
    const lock = ss.every(e => e.lock), arriba = idx.every(k => k >= n - ss.length), abajo = idx.every(k => k < ss.length);
    const it = (v, l, t, off) => `<button type="button" role="menuitem" data-lb="${v}" title="${t}"${off ? ' disabled' : ''}>${l}</button>`;
    fl.innerHTML = '<button type="button" data-lb="dup" title="Duplicar (⌘D)">Duplicar</button>'
      + `<button type="button" data-lb="lock" aria-pressed="${lock}">${lock ? 'Desbloquear' : 'Bloquear'}</button>`
      + `<button type="button" data-lb="flm" aria-haspopup="menu" aria-expanded="${E.flm}"${arriba && abajo ? ' disabled' : ''}>Delante / detrás</button>`
      + (!multi() && el && el.g ? '<button type="button" data-lb="ungroup" title="⇧⌘G">Desagrupar</button>' : '')
      + `<button type="button" class="del" data-lb="del" title="Borrar (⌫)"${lock ? ' disabled' : ''}>Borrar</button>`
      + `<span class="lb-flm" role="menu"${E.flm ? '' : ' hidden'}>${it('front', 'Al frente', '⇧⌘]', arriba)}${it('fwd', 'Adelante', '⌘]', arriba)}${it('bwd', 'Atrás', '⌘[', abajo)}${it('back', 'Al fondo', '⇧⌘[', abajo)}</span>`;
    fl.hidden = false; posBarra();
  }
  function posBarra() {            // over the selection and its rotation handle; else under it; else inside, at its top
    const fl = E.el.querySelector('.lb-fl'); if (!fl || fl.hidden) return;
    const ss = selEls(); if (!ss.length) return;
    fl.style.visibility = E.drag && E.drag.step ? 'hidden' : '';
    const { W, H } = E.sz, b = union(ss, W, H), k = E.k, cw = W * k, ch = H * k, bw = fl.offsetWidth, bh = fl.offsetHeight, m = 8;
    const rot = ss.length === 1 && !ss[0].lock ? ROT_D + 8 : 0;
    let y = b.t * k - rot - m - bh;
    if (y < m) y = b.b * k + m;
    if (y + bh > ch - m) y = clamp(b.t * k, 0, ch) + m;
    y = clamp(y, m, Math.max(m, ch - bh - m));
    fl.style.left = Math.round(clamp((b.l + b.r) / 2 * k - bw / 2, m, Math.max(m, cw - bw - m))) + 'px'; fl.style.top = Math.round(y) + 'px';
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

  // ---------- slides into another place: the strip's ▲▼, a drag (strip or «Ver todas») and ⌥ + arrows ----------
  function moverSl(i, j) {
    if (!E || E.busy || !E.sl[i]) return;
    j = clamp(j, 0, E.sl.length - 1); if (i === j) return;
    mut(null, () => { const x0 = E.sl[E.i], [x] = E.sl.splice(i, 1); E.sl.splice(j, 0, x); E.i = Math.max(0, E.sl.indexOf(x0)); });
    if (!E.allEl.hidden) verTodas(true);
    const it = E.el.querySelectorAll('.lb-list .lb-it')[E.i]; if (it) it.scrollIntoView({ block: 'nearest' });
  }
  function arrastrar(e) {          // pointerdown on a slide of the strip or of «Ver todas»: a click chooses it, a drag moves it
    const it = e.button === 0 && E && !E.busy && e.target.closest && e.target.closest('.lb-it, .lb-allit');
    if (!it || e.target.closest('.lb-mv, .lb-ord')) return;
    const i = +it.dataset.i, grid = it.classList.contains('lb-allit'), box = it.parentElement, sc = grid ? E.allEl : box, x0 = e.clientX, y0 = e.clientY;
    const items = () => [...box.querySelectorAll(grid ? '.lb-allit' : '.lb-it')];
    let on = false, to = null;
    const aim = ev => {             // the place it would drop at: before or after the nearest slide
      let best = null;
      items().forEach((t, k) => { const r = t.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = Math.hypot(ev.clientX - cx, ev.clientY - cy); t.classList.remove('lb-dl', 'lb-dr'); if (!best || d < best.d) best = { d, k, t, after: grid ? ev.clientX > cx : ev.clientY > cy }; });
      if (!best) return;
      best.t.classList.add(best.after ? 'lb-dr' : 'lb-dl');
      to = best.k + (best.after ? 1 : 0); if (to > i) to--;
    };
    const mv = ev => {
      if (!E) return;
      if (!on) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; on = true; it.classList.add('lb-drg'); }
      aim(ev);
      const r = sc.getBoundingClientRect(); if (ev.clientY < r.top + 30) sc.scrollTop -= 14; else if (ev.clientY > r.bottom - 30) sc.scrollTop += 14;
    };
    const end = drop => ev => {
      window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true);
      if (!E) return;
      if (drop && !on && Math.hypot(ev.clientX - x0, ev.clientY - y0) >= 6) on = true;   // released far away before any move was seen
      if (drop && on) aim(ev);
      items().forEach(t => t.classList.remove('lb-drg', 'lb-dl', 'lb-dr'));
      if (!on) return;
      E.noClick = true; setTimeout(() => { if (E) E.noClick = false; }, 0);   // the click that ends a drag chooses nothing
      if (drop && to != null && to !== i) moverSl(i, to);
    };
    const up = end(true), cancel = end(false);
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', cancel, true);
  }

  // ---------- «Vista previa»: the post as the vista cliente will show it once uploaded (the slides as they are here) ----------
  function preview(on) {
    if (!on) { if (E.pv) { E.pv.remove(); E.pv = null; } E.el.focus({ preventScroll: true }); return; }
    if (!E.sl.length) { I().toast('No hay diapositivas que ver.'); return; }
    if (!I().igPieces) { I().toast('Actualiza la mesa (3.26 o posterior) para ver la vista previa.'); return; }
    if (!E.pv) { E.pv = document.createElement('div'); E.pv.className = 'lb-pv'; E.pv.setAttribute('role', 'dialog'); E.pv.setAttribute('aria-label', 'Vista previa'); E.el.append(E.pv); }
    E.pvI = E.i; pintarPv();
  }
  async function pintarPv() {
    const owner = E, s = curSlot(); if (!E || !E.pv || !s) return;
    const i = clamp(E.pvI, 0, E.sl.length - 1), n = E.sl.length, { W, H } = sizeAt(i);
    const P = await I().igPieces(s, W / H); if (E !== owner || !E.pv) return;
    const nav = n > 1 ? `<button type="button" class="nav prev" data-lb="pv-nav" data-d="-1" aria-label="Anterior"${i === 0 ? ' hidden' : ''}>${P.CHEV.l}</button><button type="button" class="nav next" data-lb="pv-nav" data-d="1" aria-label="Siguiente"${i === n - 1 ? ' hidden' : ''}>${P.CHEV.r}</button><div class="dots">${E.sl.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : '';
    const cap = P.cap ? `<div class="igcap">${P.av}<div class="igct"><b>${P.handle}</b> ${P.cap}</div></div>` : '';
    E.pv.innerHTML = `<div class="igwrap"><div class="igtop"><span class="lb-pvt">Vista previa · así se verá en Instagram${P.cap ? '' : ' · sin caption elegido todavía'}</span><button type="button" class="igx" data-lb="preview" aria-label="Cerrar la vista previa">×</button></div>`
      + `<div class="igcard${P.cap ? ' hascap' : ''}"><div class="igmedia" style="width:${P.tam.w}px;height:${P.tam.h}px"><canvas class="lb-pvc"></canvas>${nav}</div>`
      + `<div class="igside"><header class="ighead">${P.av}<b>${P.handle}</b><span class="igmore" aria-hidden="true">${P.IGI.more}</span></header><div class="igbody">${cap}</div>`
      + `<div class="igacts" aria-hidden="true">${P.IGI.heart}${P.IGI.comment}${P.IGI.repost}${P.IGI.share}<span class="igsave">${P.IGI.save}</span></div>`
      + `<div class="iglikes">Les gusta a <b>uribe.visuals</b> y <b>otras personas</b></div><div class="igdate">${P.fecha}</div>`
      + `<div class="igadd" aria-hidden="true">${P.IGI.emoji}<span>Añade un comentario…</span><b>Publicar</b></div></div></div></div>`;
    E.pvI = i;
    pvDibujar();
  }
  function pvDibujar() {           // the slide in the preview (again when its photos have loaded)
    const cv = E && E.pv && E.pv.querySelector('.lb-pvc'); if (!cv || !E.sl[E.pvI]) return;
    const { W, H } = sizeAt(E.pvI), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    const x = cv.getContext('2d'), k = cv.width / W; x.setTransform(k, 0, 0, k, 0, 0); x.imageSmoothingQuality = 'high';
    drawComp(x, compAt(E.pvI), W, H, viewImg, k, false);
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
    onEl(e => { if (e.lock) return; e.x = r4(e.x + dx / W); e.y = r4(e.y + dy / H); delete e.fit; if (e.t !== 'foto') e.mano = true; }, 'nudge', true);
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
        const e = clone(e0); e.id = uid(); e.lock = false; delete e.pan; if (e.g) e.g = g[e.g] || (g[e.g] = uid());
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
      e.x = r4(e.x + dx / W); e.y = r4(e.y + dy / H); delete e.fit; if (e.t !== 'foto') e.mano = true;
    });
  }
  function formatoEd(f, quiet) {
    if (E.reel || !FMTS[f] || f === fmtAt(E.i)) return;   // a reel's cover is 9:16
    const apply = () => {
      const upd = x => { if (x.key && !x.out) { const fresh = E.car ? f !== E.fmt0 || x.fmt !== x.fmt0 : f !== x.fmt0; x.raw = rawComp(x.key, fresh); if (!x.comp) x.base = firma(x.raw); } };
      if (E.car) { E.fmt = f; E.sl.forEach(upd); } else { const x = cur(); x.fmt = f; upd(x); }
      E.sl.forEach((x, i) => fotosDe(x.comp).forEach(e => { if (e.fit != null && e.src) encajar(e, e.fit, i); }));   // «Encajar» holds in the new format
      E.sl.forEach((x, i) => { if (x.comp) mantenerRat(x, i); });                                                    // and so does «Transformar»
      recolocar();                                                                                                     // texts, shapes and logos to their place
    };
    if (quiet) { apply(); return; }
    mut(null, apply);
  }
  function nuevo(el) { mut(null, () => { const c = ensure(); c.els.push(el); E.sel = el.id; E.mas = []; E.crop = null; E.pick = null; }); }
  function act(a, b) {
    const x = E.sl.length ? cur() : null, col = () => String(b.dataset.c).toLowerCase();
    switch (a) {
      case 'cerrar': pedirCerrar(); return;
      case 'aplicar': aplicar(); return;
      case 'undo': deshacer(true); return;
      case 'redo': deshacer(false); return;
      case 'zin': zoom(E.zoom * 1.25); return;
      case 'zout': zoom(E.zoom / 1.25); return;
      case 'zfit': zoom(1); return;
      case 'mas': menu(!E.menuOn); return;
      case 'atajos': atajos(E.el.querySelector('.lb-atajos').hidden); return;
      case 'iman': E.iman = !E.iman; menu(false); head(); return;
      case 'todas': menu(false); verTodas(E.allEl.hidden); return;
      case 'seguidas': lsPoner(LS_SEG, b.dataset.v === '1' ? '1' : '0'); verTodas(true); return;
      case 'flm': E.flm = !E.flm; barra(); return;
      case 'cruzar': cruzar(+b.dataset.v); return;
      case 'preview': preview(!E.pv); return;
      case 'pv-nav': { const j = E.pvI + +b.dataset.d; if (j >= 0 && j < E.sl.length) { E.pvI = j; pintarPv(); } return; }
      case 't-ori': E.tOri = b.dataset.v; panel(); return;
      case 't-rat': transformar(b.dataset.v, +b.dataset.r); return;
      case 'fmt': if (E.sl.length) formatoEd(b.dataset.v); return;
      case 'sl': if (!E.allEl.hidden) verTodas(false); elegir(+b.dataset.i); return;
      case 'sl-up': case 'sl-dn': { const i = +b.dataset.i; moverSl(i, i + (a === 'sl-up' ? -1 : 1)); return; }
      case 'sl-del': { if (E.reel) return; const i = +b.dataset.i; mut(null, () => { E.sl.splice(i, 1); E.i = clamp(E.i > i ? E.i - 1 : E.i, 0, Math.max(0, E.sl.length - 1)); soltar(); E.crop = null; }); return; }
      case 'sl-add': {
        if (E.reel) return;                      // a reel keeps its one cover
        if (E.car && E.sl.length >= MAX_SLIDES) { I().toast('Un carrusel admite como máximo 20 diapositivas (límite de Instagram).'); return; }
        mut(null, () => { const bg = E.sl.length ? compAt(E.i).bg || '#ffffff' : '#ffffff', at = E.sl.length ? E.i + 1 : 0; E.sl.splice(at, 0, blankSlide(bg)); E.i = at; soltar(); E.crop = null; }); return;
      }
      case 'sl-orig': {
        const e = fotosDe(compAt(E.i)).find(q => q.src && M.files[q.src] && !M.files[q.src].design);
        if (!e) { if (x.key && !x.out) mut(null, () => { const raw = rawComp(x.key, E.car ? E.fmt !== E.fmt0 : false); Object.assign(x, { comp: null, raw, base: firma(raw) }); soltar(); E.crop = null; }); return; }   // a designed image: back to itself
        if (E.sl.some((o, k) => k !== E.i && o.key === e.src)) { I().toast('Esa foto ya es otra diapositiva de esta publicación.'); return; }
        mut(null, () => { const raw = rawComp(e.src, E.car ? E.fmt !== E.fmt0 : false); Object.assign(x, { key: e.src, out: false, from: null, comp: null, raw, base: firma(raw) }); soltar(); E.crop = null; });
        return;
      }
      case 'add': E.pick = { modo: 'add' }; soltar(); panel(); return;
      case 'bandeja': E.trOpen = !E.trOpen; lsPoner(LS_TR, E.trOpen ? '1' : '0'); bandeja(); return;
      case 'tr-add': ponerFotos([b.dataset.f], null, null); return;
      case 'add-txt': { const hayFoto = fotosDe(compAt(E.i)).length > 0; nuevo(textoEl(hayFoto ? '#ffffff' : '#000000')); const el = selEl(); if (el) ajustarTexto(el, E.sz.W, E.sz.H); return; }
      case 'add-forma': nuevo(formaEl(b.dataset.v, E.sz.W, E.sz.H)); return;
      case 'add-est': { const el = textoMarca(b.dataset.v); if (el) nuevo(el); return; }
      case 'est': { const st = E.estilos.find(q => q.k === b.dataset.v); if (st) onEl(el => { if (el.t === 'texto') conEstilo(el, st); }); return; }
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
          else { const e = c.els.find(q => q.id === pk.id); if (e) { e.src = f; e.cx = 0.5; e.cy = 0.5; e.z = 1; if (pk.modo === 'fill') { const { W, H } = sizeAt(E.i); colocar(e, W, H); } else if (e.fit != null) encajar(e, e.fit); E.sel = e.id; E.mas = []; } }
        });
        return;
      }
      case 'bc': onEl(el => { el.bc = col(); }, 'bc'); return;
      case 'tc': onEl(el => { if (el.t === 'texto') el.color = col(); }, 'tc'); return;
      case 'fc': onEl(el => { if (el.t === 'forma') el.color = col(); }, 'fc'); return;
      case 'bg': mut('bg', () => { ensure().bg = col(); }); return;
      case 'velo': mut(null, () => { const c = ensure(); c.velo = b.dataset.v ? { tipo: b.dataset.v, color: (c.velo && c.velo.color) || '#000000', op: (c.velo && c.velo.op) || 0.35, dir: (c.velo && c.velo.dir) || 'abajo', alc: (c.velo && c.velo.alc) || 0.6 } : null; }); return;
      case 'velo-c': mut('velo-c', () => { const c = ensure(); if (c.velo) c.velo.color = col(); }); return;
      case 'velo-dir': mut(null, () => { const c = ensure(); if (c.velo) c.velo.dir = b.dataset.v; }); return;
      case 'tex': mut(null, () => { const c = ensure(); if (b.dataset.v) c.tex = { tipo: b.dataset.v, op: (c.tex && c.tex.op) || 0.35 }; else delete c.tex; }); return;
      case 'grid': mut(null, () => { const c = ensure(); rejilla(c, b.dataset.v, c.rej ? c.rej.g : E.gap ?? 0.02); soltar(); E.crop = null; }); return;
      case 'tpl': aplicarPlantilla(b.dataset.id); return;
      case 'tpl-save': guardarPlantilla(); return;
      case 'tpl-del': { const t = E.plant.find(q => q.id === b.dataset.id); if (t) preguntar(`¿Borrar la plantilla «${t.nombre}»?`, 'Se borra para este cliente; las diapositivas ya hechas con ella no cambian.', [['seguir', 'Cancelar', 'btn2'], ['borrar', 'Borrar', 'btn']], v => { if (v === 'borrar') guardarCliente(l => ({ ...l, plantillas: (l.plantillas || []).filter(q => q.id !== t.id) })); }); return; }
      case 'crop': { const el = selEl(); if (!el || el.t !== 'foto') return; E.crop = E.crop === el.id ? null : el.src && !el.lock ? el.id : null; panel(); pedir(); return; }
      case 'crop-c': onEl(el => setPhoto(el, { cx: 0.5, cy: 0.5, z: 1 })); return;
      case 'encajar': onEl(el => { if (el.t === 'foto') encajar(el, el.fit != null ? el.fit : 0); }); return;
      case 'llenar': onEl(el => { if (el.t === 'foto') llenar(el); }); return;
      case 'marco': onEl(el => { if (el.t !== 'foto') return; el.marco = b.dataset.v || null; if (el.marco) delete el.fit; setPhoto(el, {}); }); return;
      case 'rotl': onEl(el => { el.rot = ((Math.round((el.rot || 0) - 90) + 540) % 360) - 180; delete el.fit; }); return;
      case 'rotr': onEl(el => { el.rot = ((Math.round((el.rot || 0) + 90) + 540) % 360) - 180; delete el.fit; }); return;
      case 'flipx': onEl(el => { el.fx = !el.fx; }); return;
      case 'flipy': onEl(el => { el.fy = !el.fy; }); return;
      case 'peso': onEl(el => { if (el.t === 'texto') el.peso = +b.dataset.v; }); return;
      case 'al': if (b.dataset.v && !multi()) return; alinear(b.dataset.v); return;
      case 'al1': alinear(b.dataset.v); return;
      case 'may': onEl(el => { if (el.t === 'texto') el.may = !el.may; }); return;
      case 'front': case 'fwd': case 'bwd': case 'back': E.flm = false; orden(a); return;
      case 'dup': {
        const ids = selIds(); if (!ids.length) return;
        mut(null, () => { const c = ensure(), g = {}, nw = []; for (const el of c.els.filter(q => ids.includes(q.id))) { const e = clone(el); e.id = uid(); e.lock = false; if (e.g) e.g = g[e.g] || (g[e.g] = uid()); e.x = r4(e.x + 0.03); e.y = r4(e.y + 0.03); delete e.fit; delete e.pan; nw.push(e); } c.els.push(...nw); E.sel = nw[0].id; E.mas = nw.slice(1).map(e => e.id); });
        return;
      }
      case 'copy': copiar(); return;
      case 'paste': pegar(); return;
      case 'lock': { const all = selEls().every(e => e.lock); onEl(el => { el.lock = !all; if (el.lock && E.crop === el.id) E.crop = null; }); return; }
      case 'del': {
        const ss = selEls(); if (!ss.length) return;
        if (ss.every(e => e.lock)) { I().toast(ss.length > 1 ? 'Están bloqueados: desbloquéalos para borrarlos.' : 'Está bloqueado: desbloquéalo para borrarlo.'); return; }
        mut(null, () => {
          const c = ensure(), ids = ss.filter(e => !e.lock).map(e => e.id), pans = ss.filter(e => !e.lock && e.pan).map(e => e.pan.id);
          c.els = c.els.filter(e => !ids.includes(e.id)); soltar(); E.crop = null;
          if (pans.length) E.sl.forEach((x, j) => { if (j !== E.i && x.comp) x.comp.els = x.comp.els.filter(e => !(e.pan && pans.includes(e.pan.id))); });   // a crossing photo goes from all its slides
        });
        return;
      }
      case 'group': { const ids = selIds(); if (ids.length < 2) return; const g = uid(); onEl(el => { el.g = g; }); return; }
      case 'ungroup': { const el = selEl(); if (!el) return; const ids = el.g && !multi() ? compAt(E.i).els.filter(e => e.g === el.g).map(e => e.id) : selIds(); mut(null, () => { ensure().els.forEach(e => { if (ids.includes(e.id)) delete e.g; }); E.mas = []; }); return; }
      case 'cap': { const el = compAt(E.i).els.find(e => e.id === b.dataset.id); if (!el) return; seleccionar(el, b._shift); E.crop = null; E.pick = null; panel(); pedir(); return; }
      case 'cap-ver': case 'cap-lock': { const id = b.dataset.id; mut(null, () => { const e = ensure().els.find(q => q.id === id); if (!e) return; if (a === 'cap-ver') e.oculto = !e.oculto; else e.lock = !e.lock; }); return; }
      case 'cap-up': case 'cap-dn': { const id = b.dataset.id; mut(null, () => { const c = ensure(), k = c.els.findIndex(q => q.id === id), j = k + (a === 'cap-up' ? 1 : -1); if (k < 0 || j < 0 || j >= c.els.length) return; [c.els[k], c.els[j]] = [c.els[j], c.els[k]]; }); return; }
    }
  }
  function menu(on) { E.menuOn = on; E.el.querySelector('.lb-menu').hidden = !on; E.el.querySelector('[data-lb="mas"]').setAttribute('aria-expanded', String(on)); }
  function atajos(on) { E.el.querySelector('.lb-atajos').hidden = !on; E.el.querySelector('[data-lb="atajos"]').setAttribute('aria-expanded', String(on)); }
  function cerrarMenus(t) {        // the «⋯» menu, the shortcuts and the bar's «Delante / detrás» close with Esc or a click elsewhere
    const fuera = q => !(t && t.closest && t.closest(q));
    let n = false;
    if (E.menuOn && fuera('.lb-mas')) { menu(false); n = true; }
    if (!E.el.querySelector('.lb-atajos').hidden && fuera('.lb-atajos, [data-lb="atajos"]')) { atajos(false); n = true; }
    if (E.flm && fuera('.lb-fl')) { E.flm = false; barra(); n = true; }
    return n;
  }
  function onInput(t) {           // sliders and fields of the panel
    const a = t.dataset.lb;
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
      case 'rot': if (Number.isFinite(v)) onEl(el => { el.rot = clamp(Math.round(v * 10) / 10, -180, 180); delete el.fit; if (el.t !== 'foto') el.mano = true; }, 'rot', true); return;
      case 'mx': case 'my': case 'man': case 'mal': {
        if (!Number.isFinite(v)) return;
        onEl(el => {
          if (el.t !== 'foto') el.mano = true;
          if (a === 'mx') el.x = r4(v / 1080);
          else if (a === 'my') el.y = r4(v / (H * PX));
          else if (a === 'man') { const w = Math.max(4, v) / 1080; if (el.t === 'logo') el.h = r4(el.h * w / el.w); el.w = r4(w); if (el.t === 'texto') ajustarTexto(el, W, H); }
          else if (el.t !== 'texto') { const h = Math.max(2, v) / (H * PX); if (el.t === 'logo') el.w = r4(el.w * h / el.h); el.h = r4(h); }
          delete el.fit; if (a === 'man' || a === 'mal') delete el.rat; if (el.t === 'foto' && el.src) setPhoto(el, {});
        }, a, true);
        if (a === 'man' || a === 'mal') E.el.querySelectorAll('.lb-panel [data-lb="t-rat"].on').forEach(b => b.classList.remove('on'));   // the panel is not rebuilt while typing
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
    const c = compAt(E.i), comp = clone(c); comp.els.forEach(e => { if (e.t === 'foto') { e.src = null; e.cx = 0.5; e.cy = 0.5; e.z = 1; } delete e.lock; delete e.pan; });
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
      mantenerRat(cur(), E.i);   // a frame given a format keeps it on a slide of another format
      soltar(); E.crop = null;
    });
  }

  function wire(el) {
    el.addEventListener('click', e => {
      if (!E) return;                // the click that closed the editor («Salir sin aplicar») still bubbles here
      if (E.noClick) { E.noClick = false; return; }
      cerrarMenus(e.target);
      if (E.pv && e.target === E.pv) { preview(false); return; }   // a click outside the post closes the preview
      const b = e.target.closest('[data-lb]'); if (!b || !el.contains(b) || E.busy) return;
      if ((b.tagName === 'INPUT' && b.type !== 'button') || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA') return;
      if (b.dataset.lb === 'logo' && e.altKey) { const f = b.dataset.f; preguntar('¿Quitar este logo del kit?', 'Las diapositivas ya hechas con él no cambian.', [['seguir', 'Cancelar', 'btn2'], ['q', 'Quitar', 'btn']], v => { if (v === 'q') guardarCliente(l => ({ ...l, logos: (l.logos || []).filter(q => q !== f) })); }); return; }
      b._shift = e.shiftKey;
      act(b.dataset.lb, b);
    });
    el.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.lb && !E.busy) onInput(t); });
    el.querySelector('.lb-list').addEventListener('pointerdown', arrastrar);
    el.querySelector('.lb-panel').addEventListener('toggle', e => { const k = e.target.dataset && e.target.dataset.pl; if (!k) return; if (e.target.open) ABIERTAS.add(k); else ABIERTAS.delete(k); lsPoner(LS_PL, [...ABIERTAS].join(',')); }, true);
    el.querySelector('.lb-tray').addEventListener('pointerdown', arrastrarBandeja);
    el.addEventListener('dragover', e => { if (!hayArchivos(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; resaltar(e); });   // not the mesa's: a photo dropped here is for this editor
    el.addEventListener('dragleave', e => { if (!e.relatedTarget || !el.contains(e.relatedTarget)) resaltar(null); });
    el.addEventListener('drop', e => { if (!hayArchivos(e)) return; e.preventDefault(); e.stopPropagation(); resaltar(null); soltarArchivos(e); });
    E.allEl.addEventListener('pointerdown', arrastrar);
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
    if (E.pv) {                     // the preview: Esc closes it, ← → go through the slides
      if (e.key === 'Escape') { e.preventDefault(); preview(false); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const j = E.pvI + (e.key === 'ArrowLeft' ? -1 : 1); if (j >= 0 && j < E.sl.length) { E.pvI = j; pintarPv(); } }
      return;
    }
    const t = e.target, typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio', 'color'].includes(t.type)));
    const mod = (e.metaKey || e.ctrlKey) && !e.altKey, k = String(e.key).toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (cerrarMenus(null)) return;
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
      if (e.altKey && !mod) { moverSl(E.i, E.i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)); return; }   // ⌥ + arrows: the slide moves
      if (E.sel) { const s = (e.shiftKey ? 10 : 1) * OUT_W / 540; nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0); }
      else elegir(E.i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1));
    }
  }

  // ---------- the tray in a drawer under the slide, and photos dropped from the computer ----------
  // «?»: the shortcuts, once a line under the slide
  const ATAJOS = '<h4>Atajos de teclado</h4><dl>' + [
    ['Clic', 'elegir · con ⇧, varios'],
    ['Arrastrar', 'mover · esquinas: tamaño · lados: recortar (o el ancho de un texto) · círculo: girar'],
    ['Doble clic', 'encuadrar la foto o escribir el texto'],
    ['Flechas', 'mover poco a poco (con ⇧, más) · ⌥ + flechas: mover la diapositiva'],
    ['⌘C · ⌘V', 'copiar y pegar, también en otra diapositiva o publicación'],
    ['⌘D · ⌫', 'duplicar · borrar'],
    ['⌘G', 'agrupar (⇧⌘G: desagrupar) · ⌘A: elegir todo'],
    ['⌘] · ⌘[', 'adelante · atrás (con ⇧: al frente · al fondo)'],
    ['⌘Z', 'deshacer (⇧⌘Z: rehacer)'],
    ['⌘+ · ⌘−', 'acercar · alejar (también pellizcando o con ⌘ + rueda) · ⌘0: entera'],
    ['⌘ al arrastrar', 'sin imán · ⇧ al girar: de 15° en 15°'],
    ['Esc', 'soltar la selección o terminar de encuadrar'],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl><p>Suelta fotos del ordenador en la diapositiva o en la bandeja.</p>';
  const FLECHA = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const hayArchivos = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
  const trayFotos = () => E.board.tray.filter(f => M.files[f] && !M.files[f].design && !isKit(f));
  function enUso() { const u = new Set(); E.sl.forEach((x, i) => fotosDe(compAt(i)).forEach(e => { if (e.src) u.add(e.src); })); return u; }
  function bandeja() {               // drawn again only when it shows something else
    if (!E || !E.el) return;
    const box = E.el.querySelector('.lb-tray'), b = E.el.querySelector('.lb-trb'), fs = trayFotos(), uso = enUso();
    b.querySelector('.lb-trn').textContent = fs.length ? `Bandeja · ${fs.length}` : 'Bandeja';
    b.setAttribute('aria-expanded', String(E.trOpen)); b.title = E.trOpen ? 'Cerrar la bandeja' : `Bandeja: ${fs.length === 1 ? '1 foto' : `${fs.length} fotos`}, para ponerlas en la diapositiva`;
    const key = E.trOpen ? fs.map(f => f + (uso.has(f) ? '+' : '') + (M.files[f].thumbUrl || '')).join(',') : '';
    if (key === E.trKey && box.hidden === !E.trOpen) return;
    E.trKey = key; box.hidden = !E.trOpen;
    const sx = (box.querySelector('.lb-trs') || {}).scrollLeft || 0;
    box.innerHTML = !E.trOpen ? '' : `<div class="lb-trh"><b>Bandeja</b> <span>· ${fs.length ? 'clic: a esta diapositiva · o arrástrala donde la quieras · ' : ''}suelta aquí fotos del ordenador para guardarlas en ella</span></div>`
      + (fs.length ? `<div class="lb-trs">${fs.map(f => `<button type="button" class="lb-ph lb-tph${uso.has(f) ? ' uso' : ''}" data-lb="tr-add" data-f="${esc(f)}" title="${esc(M.files[f].name || '')}${uso.has(f) ? ' · ya está en una diapositiva' : ''}"><img src="${M.files[f].thumbUrl || ''}" alt="" draggable="false"></button>`).join('')}</div>` : '<p class="lb-p" style="margin:0 0 4px">La bandeja está vacía.</p>');
    const tr = box.querySelector('.lb-trs'); if (tr) tr.scrollLeft = sx;
  }
  // photos onto slide i (null: the one open): the first into the empty frame under the pointer (or the one selected),
  // the rest as new photos above the others, at the pointer when there is one; a post with no slide gets one
  function ponerFotos(fs, p, i) {
    fs = fs.filter(f => M.files[f] && !M.files[f].design && !isKit(f)); if (!fs.length || !E || E.busy) return;
    if (E.ask) cerrarPregunta();
    if (E.pv) preview(false);
    if (!E.allEl.hidden) verTodas(false);
    const otra = i != null && E.sl[i] && i !== E.i, s0 = !otra && !p ? selEl() : null;
    mut(null, () => {
      if (!E.sl.length) { E.sl.push(blankSlide('#ffffff')); E.i = 0; } else if (otra) E.i = i;
      E.pick = null; E.crop = null;
      const c = ensure(), { W, H } = sizeAt(E.i), hs = huecosDe(c);
      const deEl = e => e && hs.find(h => h.el ? h.el === e : e.g === h.g);   // the hole an element is, or is a layer of
      const hole = p ? deEl(hitEl(p)) : (s0 && deEl(c.els.find(q => q.id === s0.id))) || hs[0], ids = [];   // no point: the hole selected, or the slide's first
      fs.forEach((f, k) => {
        if (!k && hole) { ids.push(rellenar(c, hole, f, W, H).id); return; }
        const e = fotoEl(f), top = c.els.reduce((a, q, j) => q.t === 'foto' ? j + 1 : a, 0);
        c.els.splice(top, 0, e); encajar(e, 0.08); delete e.fit;
        const d = (k - (hole ? 1 : 0)) * 0.03, cx = p ? p.x / W : e.x + e.w / 2 + d, cy = p ? p.y / H : e.y + e.h / 2 + d;
        e.x = r4(clamp(cx - e.w / 2 + (p ? d : 0), 0, 1 - e.w)); e.y = r4(clamp(cy - e.h / 2 + (p ? d : 0), 0, 1 - e.h));
        ids.push(e.id);
      });
      E.sel = ids[ids.length - 1]; E.mas = [];
    });
    if (otra) { const it = E.el.querySelectorAll('.lb-list .lb-it')[E.i]; if (it) it.scrollIntoView({ block: 'nearest' }); }
  }
  // where a photo would land: a slide of the strip, a point of the slide, or around it (centred on the slide open)
  function destino(ev) {
    const t = document.elementFromPoint(ev.clientX, ev.clientY), li = t && t.closest && t.closest('.lb-list .lb-it');
    if (li) return { i: [...E.el.querySelectorAll('.lb-list .lb-it')].indexOf(li), p: null, el: li };
    const r = E.cv.getBoundingClientRect(), m = E.scroll.getBoundingClientRect(), en = q => ev.clientX >= q.left && ev.clientX <= q.right && ev.clientY >= q.top && ev.clientY <= q.bottom;
    if (E.sl.length && en(r)) return { i: null, p: toSlide(ev), el: E.scroll };
    if (en(m)) return { i: null, p: null, el: E.scroll };
    return null;
  }
  function resaltar(ev) {
    E.el.querySelectorAll('.lb-mid .over, .lb-list .over').forEach(q => q.classList.remove('over'));
    if (!ev) return;
    const tray = ev.target.closest && ev.target.closest('.lb-tray'), t = tray ? { el: tray } : destino(ev) || { el: E.scroll };
    t.el.classList.add('over');
  }
  async function soltarArchivos(e) {
    if (!E || E.busy) return;
    if (I().locked) { I().toast(LOCKED); return; }
    const owner = E, files = [...(e.dataTransfer.files || [])], guardar = !!e.target.closest('.lb-tray'), t = guardar ? null : destino(e) || { i: null, p: null };
    if (!files.length) return;
    const got = await M.addFiles(files, null, { tray: true });
    if (E !== owner) return;
    bandeja();
    if (!got || !got.length) return;
    if (guardar) { if (!E.trOpen) { E.trOpen = true; bandeja(); } I().toast(got.length === 1 ? 'Foto guardada en la bandeja.' : `${got.length} fotos guardadas en la bandeja.`); return; }
    ponerFotos(got, t.p, t.i);
    I().toast(`${got.length === 1 ? 'Foto puesta' : `${got.length} fotos puestas`} en la diapositiva ${E.i + 1}. Quedan en la bandeja hasta que apliques.`);
  }
  function arrastrarBandeja(e) {     // a tray photo dragged onto the slide or onto a slide of the strip (a click puts it on the open one)
    const b = e.target.closest('.lb-tph'); if (!b || e.button !== 0 || !E || E.busy) return;
    const f = b.dataset.f, x0 = e.clientX, y0 = e.clientY, owner = E; let g = null;
    const move = ev => {
      if (E !== owner) return;
      if (!g) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; g = document.createElement('img'); g.className = 'lb-ghost'; g.alt = ''; g.src = (M.files[f] || {}).thumbUrl || ''; E.el.append(g); }
      g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; resaltar(ev);
    };
    const end = drop => ev => {
      document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', cancel, true);
      if (g) g.remove();
      if (E !== owner) return;
      resaltar(null);
      const lejos = Math.hypot(ev.clientX - x0, ev.clientY - y0) >= 6;   // released far away before any move was seen: a drag too
      if (!drop || !(g || lejos)) return;
      E.noClick = true; setTimeout(() => { if (E === owner) E.noClick = false; }, 0);
      const t = destino(ev); if (t) ponerFotos([f], t.p, t.i);
    };
    const up = end(true), cancel = end(false);
    document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', cancel, true);
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
          const id = await guardarImagen(await renderOut(i), E.car ? `${s.name} ${pad2(i + 1)}.jpg` : E.reel ? `${s.name} portada.jpg` : `${s.name}.jpg`);
          outs.push(id); made.push(id);
        }
      } catch (e) { for (const f of made) { try { await I().deleteIfUnused(f); } catch (er) { /* the sweep takes it */ } } throw e; }
      if (!(E === owner && I().S === S && S.slots.includes(s) && I().same(s.photos, E.photos0) && (s.design || null) === E.dz && !I().locked && !I().uploadsBusy())) {   // changed while drawing: nothing is used
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
      if (E.dz) delete s.design;      // the design is fixed as these images: its source photos go back to the tray (below)
      s.photos = outs.slice();
      if (Object.keys(lib).length) s.libre = { v: 1, slides: lib }; else delete s.libre;
      if (E.car) {
        s.fmt = E.fmt;
        if (fmtCh) outs.forEach(f => { if (!lib[f]) S.crops[f] = { ...I().baseCrop(f, S), cx: 0.5, cy: 0.5, z: 1 }; });   // the photos left as they were: centred, as a format change does
      } else if (!E.reel) E.sl.forEach((x, i) => { const f = outs[i]; if (lib[f]) S.crops[f] = { fmt: x.fmt, cx: 0.5, cy: 0.5, z: 1 }; else if (x.fmt !== x.fmt0) S.crops[f] = { ...I().baseCrop(f, S), fmt: x.fmt, cx: 0.5, cy: 0.5, z: 1 }; });   // a reel cover keeps no format of its own: the mesa shows it 9:16
      const used = new Set([...outs, ...Object.values(lib).flatMap(srcsOf)]);
      S.tray = S.tray.filter(f => !used.has(f));           // photos now in the post leave the tray
      const after = I().refsOf(S), lost = [...before].filter(f => !after.has(f) && M.files[f]);
      S.tray.unshift(...lost.filter(f => !M.files[f].design && !isKit(f)));   // photos the post no longer uses go back to the tray (never a logo)
      E.applied = true;
      I().changed();
      if (I().histJuntar && E.marca) I().histJuntar(E.marca);
      const i0 = E.i, slotId = E.slotId, fijo = !!E.dz, reel = E.reel;
      E.busy = false; APL--; counted = false;
      cerrar(true);
      if (I().S === S && I().openDetail) I().openDetail(slotId, Math.min(i0, Math.max(0, s.photos.length - 1)));
      const n = made.length;
      I().toast((n ? reel ? 'Portada aplicada: se sube tal cual.' : `${n === 1 ? 'Diapositiva aplicada' : `${n} diapositivas aplicadas`}: se suben tal cual.` : 'Cambios aplicados a la casilla.') + (fijo ? reel ? ' El diseño queda fijado como imagen; su foto está en la bandeja.' : ' El diseño queda fijado como imagen; sus fotos están en la bandeja.' : ''), { ms: fijo ? 8000 : 5000 });
      for (const f of lost.filter(f => M.files[f] && M.files[f].design)) { try { await I().deleteIfUnused(f); } catch (e) { /* kept */ } }
    } catch (e) {
      if (counted) { APL--; counted = false; }
      if (E === owner && E.busy) { E.busy = false; head(); }
      const m = e instanceof LbError ? e.message : 'No se pudo aplicar: ' + String((e && e.message) || e);
      if (!(e instanceof LbError)) console.warn('editor:', e);
      if (I() && I().toast) I().toast(m, { ms: 7000 });
    } finally { drenar(); }
  }

  async function guardarImagen(blob, name) {   // a drawn slide into the mesa's files (uploaded as it is): its id
    const { w, h, thumb } = await I().makeThumb(blob), id = I().newId();
    await I().idbPut('files', id, { name, size: blob.size, type: 'image/jpeg', w, h, lastModified: Date.now(), blob, thumb, design: true });
    M.files[id] = { name, size: blob.size, type: 'image/jpeg', w, h, thumbUrl: URL.createObjectURL(thumb), design: true };
    M.thumbBlobs[id] = thumb;
    return id;
  }

  // ---------- photos dropped on the post's cell (mesa: «Sustituir» / «Añadir» on a carousel drawn here) ----------
  // Without opening the editor. «Sustituir»: only the photo of slide 1 changes (its biggest one; texts, layers and veil stay
  // as they are, the photo under the texts). «Añadir», and the other photos of a «Sustituir»: each one into the first slide
  // with a hole still empty, in order, its marker layers gone; with no hole left, a new slide at the end (as before). The
  // slides touched are drawn again in the carousel's own proportion. One step of the mesa's ⌘Z.
  async function casilla(slotId, ids, modo) {
    let counted = false;
    const made = [];
    try {
      need(I(), 'La mesa no tiene el puente del editor: actualiza mesa.js (3.25 o posterior).');
      const S = I().S; need(S, 'No hay ninguna mesa abierta.');
      need(!I().locked, LOCKED);
      const s = S.slots.find(x => x.id === slotId); need(s && I().isCarousel(s.type) && !s.design, 'Esa publicación ya no está en la mesa.');
      need(!(E && E.busy) && !APL, 'Espera: el editor está aplicando una publicación.');
      need(!(M.diseno && M.diseno.aplicando && M.diseno.aplicando()), 'Espera: el diseñador está aplicando un diseño.');
      need(!I().uploadsBusy(), 'Espera a que termine la subida a Notion.');
      ids = [...new Set(ids || [])].filter(f => M.files[f] && !M.files[f].design && !isKit(f) && !s.photos.includes(f));
      if (!ids.length) return { ok: true, cambios: 0 };
      const photos0 = s.photos.slice(), d0 = M.files[photos0[0]] || { w: 4, h: 5 };
      const W = OUT_W, H = Math.round(OUT_W / I().fmtRatio(s.fmt || 'v45', d0.w, d0.h));   // the carousel keeps its proportion
      const sl = photos0.map(key => { const f = compOf(S, key); return { key, from: f && f.s !== s ? f.s : null, comp: f ? clone(f.comp) : null, mod: false }; });
      const outs = photos0.slice(), nuevas = [], rest = ids.slice();
      let portada = false;
      if (modo !== 'add') {
        const f = rest.shift(), x = sl[0];
        if (!x) nuevas.push(f);
        else if (!x.comp) { outs[0] = f; portada = true; }      // slide 1 is a photo, not drawn here: the photo changes, as always
        else {
          const el = fotosDe(x.comp).filter(e => e.src && !e.oculto).reduce((a, e) => !a || e.w * e.h > a.w * a.h ? e : a, null);
          if (el) { need(!el.pan, 'La foto de la portada cruza diapositivas: cámbiala en «Editar».'); Object.assign(el, { src: f, cx: 0.5, cy: 0.5, z: 1 }); colocar(el, W, H); }
          else { const h = huecosDe(x.comp)[0]; if (h) rellenar(x.comp, h, f, W, H); else { const e = fotoEl(f); x.comp.els.unshift(e); colocar(e, W, H); } }
          x.mod = portada = true;
        }
      }
      const llenas = [];
      for (const f of rest) {
        const j = sl.findIndex(x => x.comp && huecosDe(x.comp).length);
        if (j < 0) { nuevas.push(f); continue; }
        rellenar(sl[j].comp, huecosDe(sl[j].comp)[0], f, W, H); sl[j].mod = true; llenas.push(j + 1);
      }
      APL++; counted = true; I().setBusy('dz', 'Dibujando el carrusel…');
      for (let j = 0; j < sl.length; j++) {
        if (!sl[j].mod) continue;
        outs[j] = await guardarImagen(await dibujar(sl[j].comp, W, H), `${s.name} ${pad2(j + 1)}.jpg`); made.push(outs[j]);
      }
      if (!(I().S === S && S.slots.includes(s) && I().same(s.photos, photos0) && !s.design && !I().locked && !I().uploadsBusy())) throw new LbError('La mesa cambió mientras se dibujaba: vuelve a soltar la foto.');
      const before = I().refsOf(S), lib = { ...entries(s) };
      sl.forEach((x, j) => {
        if (!x.mod) return;
        delete lib[x.key]; lib[outs[j]] = x.comp;
        const o = x.from; if (o && o.libre && o.libre.slides[x.key]) { delete o.libre.slides[x.key]; if (!Object.keys(o.libre.slides).length) delete o.libre; }   // a composition moved here leaves the post it was on
      });
      ids.forEach(f => S.slots.forEach(o => { if (o !== s && o.photos.includes(f)) o.photos = o.photos.filter(q => q !== f); }));   // a photo is in one post only
      s.photos = [...outs, ...nuevas];
      if (Object.keys(lib).length) s.libre = { v: 1, slides: lib }; else delete s.libre;
      const used = new Set([...s.photos, ...Object.values(lib).flatMap(srcsOf)]);
      S.tray = S.tray.filter(f => !used.has(f));
      const after = I().refsOf(S), lost = [...before].filter(f => !after.has(f) && M.files[f]);
      S.tray.unshift(...lost.filter(f => !M.files[f].design && !isKit(f)));   // the photo replaced goes back to the tray
      APL--; counted = false; I().setBusy('dz', null);
      I().changed();
      const nl = llenas.length, nn = nuevas.length, partes = [];
      if (portada) partes.push(sl[0] && sl[0].mod ? 'Foto de la portada cambiada (los textos se quedan)' : 'Foto de la portada cambiada');
      if (nl) partes.push(nl === 1 ? `Hueco de la diapositiva ${llenas[0]} rellenado` : `Huecos de las diapositivas ${llenas.slice(0, -1).join(', ')} y ${llenas[nl - 1]} rellenados`);
      if (nn) partes.push(`${nn === 1 ? '1 diapositiva nueva' : nn + ' diapositivas nuevas'} al final (no quedan huecos)`);
      I().toast(partes.join(' · ') + (made.length ? '. Se suben tal cual.' : '.'), { ms: 6000 });
      for (const f of lost.filter(f => M.files[f] && M.files[f].design)) { try { await I().deleteIfUnused(f); } catch (e) { /* kept */ } }
      return { ok: true, cambios: made.length, portada, rellenas: llenas, nuevas: nuevas.length };
    } catch (e) {
      for (const f of made) { try { await I().deleteIfUnused(f); } catch (er) { /* the sweep takes it */ } }
      const m = e instanceof LbError ? e.message : 'No se pudo poner la foto: ' + String((e && e.message) || e);
      if (!(e instanceof LbError)) console.warn('editor:', e);
      if (I() && I().toast) I().toast(m, { ms: 7000 });
      return { error: m };
    } finally { if (counted) { APL--; if (I()) I().setBusy('dz', null); } drenar(); }
  }

  // ---------- a post that changed type (mesa: setType): its images drawn here go to the new format ----------
  // A reel's cover is 9:16, a Foto's or a carousel's pages take the post's format: an image drawn here in another
  // proportion is drawn again from its composition (texts to their place, as a format change in the editor; «Encajar»
  // and «Transformar» hold). Part of the type change in the mesa's ⌘Z. Asked while something is being drawn, or when the
  // type changes again meanwhile, it runs again once that is over.
  const REDO = new Set();
  function drenar() { if (!APL && !(E && E.busy) && REDO.size) { const ids = [...REDO]; REDO.clear(); setTimeout(() => ids.forEach(id => redibujar(id)), 0); } }   // what waited, once nothing is being drawn
  async function redibujar(slotId) {
    let counted = false;
    const made = [];
    try {
      const S = I() && I().S, s = S && S.slots.find(x => x.id === slotId);
      if (!s || s.design || !s.libre || !s.photos.length || I().locked) return { ok: true, cambios: 0 };
      if ((E && E.busy) || APL) { REDO.add(slotId); return { ok: true, pendiente: true }; }
      need(!(M.diseno && M.diseno.aplicando && M.diseno.aplicando()), 'Espera: el diseñador está aplicando un diseño.');
      need(!I().uploadsBusy(), 'Espera a que termine la subida a Notion.');
      const photos0 = s.photos.slice(), d0 = M.files[photos0[0]] || { w: 4, h: 5 };
      const W = OUT_W, H = Math.round(OUT_W / I().fmtRatio(I().cropOf(photos0[0], s).fmt, d0.w, d0.h)), R = W / H;   // the format the mesa shows the post in
      const sl = photos0.map(key => { const f = compOf(S, key), d = M.files[key]; return f && d && Math.abs(d.w / d.h - R) > 0.005 ? { key, from: f.s !== s ? f.s : null, comp: clone(f.comp), H0: Math.round(W * d.h / d.w) } : null; });
      if (!sl.some(Boolean)) return { ok: true, cambios: 0 };
      APL++; counted = true; I().setBusy('dz', 'Dibujando en el formato nuevo…');
      const outs = photos0.slice(), tipo0 = s.type, reel = I().isReel(tipo0);
      for (let j = 0; j < sl.length; j++) {
        const x = sl[j]; if (!x) continue;
        reubicar(x.comp, W, x.H0, H);
        fotosDe(x.comp).forEach(e => { if (!e.src) return; if (e.fit != null) encajarWH(e, e.fit, W, H); else if (e.rat && RVAL[e.rat]) marcoRat(e, RVAL[e.rat], e.w * W * e.h * H, W, H); });
        outs[j] = await guardarImagen(await dibujar(x.comp, W, H), reel ? `${s.name} portada.jpg` : `${s.name} ${pad2(j + 1)}.jpg`); made.push(outs[j]);
      }
      if (I().S === S && S.slots.includes(s) && s.type !== tipo0) { for (const f of made.splice(0)) { try { await I().deleteIfUnused(f); } catch (e) { /* */ } } REDO.add(slotId); return { ok: true, pendiente: true }; }   // its type changed again: drawn for the type it has now
      if (!(I().S === S && S.slots.includes(s) && I().same(s.photos, photos0) && !s.design && !I().locked)) throw new LbError(`${s.name} cambió mientras se dibujaba: ábrela en «Editar» y aplica para pasarla al formato nuevo.`);
      const lib = { ...entries(s) };
      sl.forEach((x, j) => {
        if (!x) return;
        delete lib[x.key]; lib[outs[j]] = x.comp;
        const o = x.from; if (o && o.libre && o.libre.slides[x.key]) { delete o.libre.slides[x.key]; if (!Object.keys(o.libre.slides).length) delete o.libre; }   // a composition moved here leaves the post it was on
      });
      s.photos = outs; s.libre = { v: 1, slides: lib };
      APL--; counted = false; I().setBusy('dz', null);
      if (I().histAmend) { I().histAmend(s.id); sl.forEach(x => { if (x && x.from) I().histAmend(x.from.id); }); }   // with the type change: ⌘Z undoes both
      I().changed(); I().refreshDetail();
      I().toast(`${s.name}: ${made.length === 1 ? 'la imagen editada se ha redibujado' : `${made.length} imágenes editadas se han redibujado`} en su formato nuevo.`, { ms: 5000 });
      for (const x of sl) if (x) { try { await I().deleteIfUnused(x.key); } catch (e) { /* kept */ } }
      return { ok: true, cambios: made.length };
    } catch (e) {
      for (const f of made) { try { await I().deleteIfUnused(f); } catch (er) { /* the sweep takes it */ } }
      const m = e instanceof LbError ? e.message : 'No se pudo redibujar en el formato nuevo: ' + String((e && e.message) || e);
      if (!(e instanceof LbError)) console.warn('editor:', e);
      if (I() && I().toast) I().toast(m, { ms: 7000 });
      return { error: m };
    } finally {
      if (counted) { APL--; if (I()) I().setBusy('dz', null); }
      drenar();
    }
  }

  M.libre = { version: VERSION, abrir, cerrar: () => cerrar(), sync, abierto: () => !!E, aplicando: () => APL > 0, aplicar: () => aplicar(), casilla, redibujar, _ed: () => E };
})();
