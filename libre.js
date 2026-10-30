// Editor libre de diapositivas — Mesa de trabajo · v1.18
// «Editar historia» (v1.26, mesa 3.53): a story (historias.js) opens as a reel's cover, one 9:16 page, and may start empty.
// «Editar diapositivas» (a carousel) / «Editar foto» (a photo post) / «Editar portada» (a reel) in the post view: each slide
// becomes a free composition —
// photos in frames (move, scale, rotate, flip, crop, border, corners, shadow, frames), texts, logos and stickers of the client,
// shapes and lines, over a colour background with an optional veil and texture — and «Aplicar a la casilla» draws it as a JPEG
// that goes in the slot exactly as drawn (file flagged design:true, uploaded as rendered, like «Diseñar»). A slide that is
// not touched stays the photo it was, with the mesa's own reframe.
//   s.libre = {v:1, slides:{<renderedFileId>: comp}}    the composition behind each rendered image of the post
//   comp = {bg:'#rrggbb', velo:null|{tipo:'plano'|'grad', color, op, dir:'abajo'|'arriba'|'izq'|'der', alc}, tex:null|{tipo, op},
//           els:[el] (back to front), rej?:{n, g}, origen?: where its blocks were before a change of proportion (aProporcion)}
//   every el: {id, t, x, y, w, h (frame, fractions of the slide), rot (°), op (opacity), lock, oculto, g (group id), sh (shadow 0–1),
//            mano (moved by hand: a new proportion leaves it where it is)}
//   'foto':  src, cx, cy, z (the photo inside the frame, as the mesa's reframe), fx, fy, b (border, fraction of the width), bc,
//            r (corners, 0–1 of half the short side), marco (null|'polaroid'|'pelicula'|'cinta'), fit (margin while «Encajar» holds),
//            pan ({id, n, k}: one of the n linked copies of a photo that crosses slides, on the k-th of them)
//   'texto': txt, font {n, file (kits/…)|css}, peso, size (fraction of the width), color, al ('izq'|'cen'|'der'), lh, ls (em),
//            may (capitals); h follows the text; num ({f: 'a'|'b'|'c'}: automatic numbering, txt is its number for the slide's
//            place, NUMF; never on the cover), pil ({c}: a pill behind the text, padded, its box's height)
//   'logo':  src (a client's logo or sticker: protected file 'kit-<cliente>-logo-…'), fx, fy
//   'forma': forma ('rect'|'elipse'|'linea'|'flecha'), color, r, b, bc; a line or an arrow: trazo (null: continuous|'disc'|
//            'punt'), puntas (an arrow: 'der'|'izq'|'dos'), its stroke h·H / TRAZO[forma] (an arrow's box is its heads' width)
//   'hueco': a free photo hole (v1.9): color (its fill, null: none, the background shows), b, bc, r (as 'forma'), textos
//            ([texto el]: its label and guide text, x, y, w, h fractions of the hole's area, size of the slide's width)
//   a 'foto' that filled a hole carries it: hueco (the 'hueco' element or the empty frame as it was; deleting the photo gives it back)
//   comp.previa: the slide as it was before its last template (with its own previa, up to PREVIAS deep; rat: its W/H)
// The client's colours, templates and logos live on the client record: c.libre = {colores, plantillas:[{id, nombre, comp, fmt
// (its format's name, from 1.16), rat (W/H)}], logos}.
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
// v1.8 (mesa 3.31): «Copiar» on the selection bar and «Copiar diapositiva» (⌘C with nothing chosen): a whole slide pastes in
// after the chosen one (or into a new empty slide, or a reel's cover), in this post or another of the client; what is pasted
// keeps its place, and on a slide of another proportion each block keeps its corner or edge (enSuSitio).
// v1.9 (mesa 3.33): the photo hole is an element of the slide ('hueco'): its area, its layer and its guide text. A photo
// dropped on a free one (in the editor, or «Sustituir» / «Añadir» on the post's cell) fills that area exactly, in its
// layer, and its marks go; it is then a normal photo that keeps the hole and gives it back, as it was, when deleted.
// «Sustituir» on a hole already filled changes the photo and fits it to the hole again. The drawn holes of before (a group
// with a «HUECO DE FOTO…» text) become one when a board opens (migrar).
// v1.10 (mesa 3.34): the photo in a hole keeps its proportion. A hole a sangre (the whole slide: a cover) is filled, as
// before; one inside the margin (an inner slide) takes the photo whole, the biggest that fits, centred, with the slide's
// background in the strips. Double click on that photo switches it (filling ⇄ whole); «Encuadrar» stays on its button.
// A slide whose background is the templates' provisional #2B231F gets Ink #16110E when a photo goes into its hole.
// Photos already in holes are not moved.
// v1.11 (mesa 3.35): a change of proportion starts from where each block was before the first one (comp.origen), never
// from the last: going back to that format, or through any other and back, leaves what was not moved by hand as it was.
// v1.12 (mesa 3.36): a photo already used asks before it goes onto a slide (D-022): its nearest use — this slide, this post
// or the mesa's — and «Usar igualmente» / «Cancelar»; several at once, one list with «Usar todas» / «Saltar repetidas».
// v1.13 (mesa 3.37): the magnet on the eight handles (a corner: the nearer edge, the other side keeps the proportion), ⌥
// resizes from the centre; while dragging or resizing it measures in px (to the nearest element or the slide's edge), marks
// equal gaps and sizes and sticks to them, and to the kit's margin. «Guías» (⌘G): rulers and the post's guides,
// s.guias = {x:[px], y:[px]} (px of a 1080-wide slide), never drawn in a slide. ⌥⌘G / ⇧⌥⌘G group and ungroup; ⌥⌘C / ⌥⌘V
// copy a text's style onto other texts; the arrows move 1 px (⇧: 10 px).
// v1.14 (mesa 3.38): «H» on the tray's landscape photos, as the mesa's tray; the magnet's slide centre green and dashed; a
// slide with something on it asks before it goes, then «Deshacer»; a chip with the chosen photo's or hole's proportion
// (also in «Proporción del marco» when no button is on); ⌘D with nothing chosen duplicates the slide; «Zona del grid» (⌘P,
// also in «⋯»): on the cover, what the profile crops in 3:4, darkened, only in the editor. ⌘P never prints here.
// v1.15 (mesa 3.39): the grey area around the slide is the editor's: a click deselects, a drag chooses what ends up inside
// its rectangle (⇧ adds), a double click is «Ajustar», a right click opens Pegar / Pegar estilo / Añadir texto / Añadir
// forma, space + drag moves the view; a pinch or ⌘ + wheel zooms on the pointer and never the page. T and R add a text
// and a rectangle. None of it while writing in a text.
// v1.16 (mesa 3.40): «Guardar como plantilla» keeps the whole slide without asking (a hole where each photo was), with its
// format: the list goes by format. Applying one asks Solo textos (the format of its texts on the slide's own, in order) /
// Solo fotos (its holes, the slide's photos into them in order) / Todo; the slide keeps what it had (comp.previa) and
// «Quitar plantilla» gives it back. An empty hole no longer stops «Aplicar» (the post can't go up), and a hole's label and
// guide text never go into the drawn image.
// v1.17 (mesa 3.42): «Numeración» on a text (02 / 7 · 2/7 · 02): its number is its slide's place among all of them, the
// cover counts and never shows it; it follows every change of the slides, in the editor and in the mesa (the drawn images
// are drawn again, sync); a post with texts like «02 / 11» offers to turn them into it. Arrows (one head or two), lines
// with a stroke in px of 1080 (continuous, dashed, dotted) and pills (a text with a pill behind it).
// v1.18 (mesa 3.43): M.libre.rev, for «Revisar» (revisar.js): a text's ink and a photo's px as drawn, and the numbering.
// v1.19 (mesa 3.44): the tray is the client's, the mesa's (D-041): «Sin usar / Todas» as there, ✓ on a photo used in a
// publication of any month or on a slide of this post; M.libre.bandeja() draws it again.
// v1.20 (mesa 3.46): a text's frame, handles and click are its lines', not its box (D-043): as wide as its longest line,
// where its alignment draws it; the box's width still says where they break. A frame of the list's proportion, the photo
// not cropped by it, has its button on in «Proporción del marco» instead of the proportion written under it (D-044).
(function libreBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.26';
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
  const ROSA = '#ff2d95', IGUAL = '#8a3ffc', GUIA = '#00a2c7', CENTRO = '#00a651';   // the magnet's lines and measures · equal gaps and sizes · the post's guides · the slide's centre (dashed)
  const RG = 18;                               // the rulers' thickness (screen px)
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
  // this viewer's choices, kept in the browser: the tray open or closed, «Seguidas» in «Ver todas», the panel's open sections, «Guías» open,
  // «Zona del grid» shown
  const LS_TR = 'mesa-lb-bandeja', LS_SEG = 'mesa-lb-seguidas', LS_PL = 'mesa-lb-secciones', LS_RG = 'mesa-lb-guias', LS_ZG = 'mesa-lb-zona', LS_ZH = 'mesa-lb-zona-historia';
  const lsLeer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsPoner = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* a private window: not kept */ } };
  const ABIERTAS = new Set((lsLeer(LS_PL) || '').split(',').filter(Boolean));

  class LbError extends Error {}
  const need = (ok, msg) => { if (!ok) throw new LbError(msg); };
  const LOCKED = 'La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de editar.';
  const ESCRIBIENDO = 'Estás escribiendo en un texto: termina (Esc o un clic fuera) y vuelve a soltar la foto.';

  // ---------- slot helpers ----------
  const isLibSlot = s => !!s && (I().isCarousel(s.type) || s.type === 'Foto' || I().isReel(s.type) || s.type === 'Historia');   // a reel: its cover, one 9:16 page
  const esHist = s => !!s && s.type === 'Historia';   // a story (D-055): one 9:16 page, as a reel's cover (E.reel), that may start empty; it lives in S.historias, never in S.slots
  const conHist = S => [...S.slots, ...(S.historias || [])];
  const entries = s => (s && s.libre && s.libre.slides) || {};
  const srcsOf = comp => ((comp && comp.els) || []).map(e => e.src).filter(Boolean);
  const fotosDe = comp => ((comp && comp.els) || []).filter(e => e.t === 'foto');
  function compOf(S, fid) {                    // the composition behind a rendered image: on its post, or on the post it came from
    for (const s of S.slots) { const c = entries(s)[fid]; if (c) return { s, comp: c }; }
    return null;
  }
  // a composition's signature for «changed?»: a text's height follows its font, which may load after opening, and its origin
  // (aProporcion) is not what it shows
  const firma = c => JSON.stringify(c, function (k, v) { return (k === 'h' && this && this.t === 'texto') || k === 'origen' ? undefined : v; });

  // ---------- automatic numbering (v1.17) ----------
  // a numbered text is its slide's place among all the post's slides, the cover counted; on the cover it shows nothing
  const NUMF = { a: (n, t) => `${pad2(n)} / ${t}`, b: (n, t) => `${n}/${t}`, c: n => pad2(n) };
  const numTxt = (e, i, n) => i ? (NUMF[e.num.f] || NUMF.a)(i + 1, n) : '';
  const NUM_RE = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/;   // a text written by hand like «02 / 11»: offered to become one (not a date like «28/10»)
  const numAMano = t => { const m = NUM_RE.exec(String(t || '')); return !!m && +m[1] >= 1 && +m[1] <= +m[2] && +m[2] >= 2 && +m[2] <= 20; };
  const numViejo = (comp, i, n) => !!comp && comp.els.some(e => e.t === 'texto' && e.num && e.txt !== numTxt(e, i, n));
  function numerar(comp, i, n, W, H) {   // slide i of n: its numbered texts to its place; true if one changed
    let c = false;
    for (const e of comp.els) if (e.t === 'texto' && e.num) { const t = numTxt(e, i, n); if (e.txt !== t) { e.txt = t; ajustarTexto(e, W, H); c = true; } }
    return c;
  }

  // ---------- photo holes ----------
  // A hole is a 'hueco' element, or a photo frame with no photo. A photo dropped on one takes its place among the layers,
  // never stretched: of its own orientation it fills the hole (scaled to cover it, centred, what is left over cropped);
  // of another, the editor asks (D-050): filling it, or whole (the biggest that fits, centred, the background in the
  // strips). Where nobody is asked (a template, a drop on the mesa) a hole a sangre is filled and one inside the margin
  // takes it whole, and an empty frame keeps its own rules (colocar). A 'hueco''s fill, border and texts go; the photo
  // carries the hole (el.hueco) and gives it back, as it was, when it is deleted (sacar), even moved or scaled. Any
  // 'hueco' counts, locked or not.
  const libre = e => !e.oculto && (e.t === 'hueco' || (e.t === 'foto' && !e.src && !e.lock));
  const lleno = e => e.t === 'foto' && !!e.src && !!e.hueco && !e.pan && !e.lock && !e.oculto;   // a photo in a hole: another can take its place
  const huecosDe = comp => ((comp && comp.els) || []).filter(libre);   // the free ones, in drawing order
  const huecosTodos = comp => ((comp && comp.els) || []).filter(e => libre(e) || lleno(e));   // free or filled, in drawing order
  const areaHueco = e => e.hueco || e;   // where a hole is: its photo may be smaller than it
  const enHueco = (h, t) => ({ ...t, x: h.x + t.x * h.w, y: h.y + t.y * h.h, w: t.w * h.w, h: (t.h || 0) * h.h });   // a hole's text, on the slide
  const textosDe = comp => comp.els.flatMap(e => e.t === 'texto' ? [e] : e.t === 'hueco' ? e.textos || [] : []);
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
  const alHueco = (el, h) => Object.assign(el, { x: h.x, y: h.y, w: h.w, h: h.h, rot: h.rot || 0, cx: 0.5, cy: 0.5, z: 1 });   // the frame is the hole's area, the photo covers it, centred
  const aSangre = h => h.x <= 0.001 && h.y <= 0.001 && h.x + h.w >= 0.999 && h.y + h.h >= 0.999;   // a hole that is the whole slide (a cover's)
  function ajustarHueco(el, h, W, H) {   // the whole photo, the biggest that fits in the hole's area, centred: the frame shrinks to it
    alHueco(el, h);
    const f = el.src && M.files[el.src]; if (!f) return el;
    const bw = h.w * W, bh = h.h * H, ar = f.w / f.h;
    let w = bw, hh = bw / ar; if (hh > bh) { hh = bh; w = bh * ar; }
    return Object.assign(el, { x: r4(h.x + (bw - w) / 2 / W), y: r4(h.y + (bh - hh) / 2 / H), w: r4(w / W), h: r4(hh / H) });
  }
  // a hole's photo fitted to it again: filling it (llena) or whole inside it; by default as its hole asks
  function encajeHueco(el, W, H, llena = aSangre(el.hueco)) {
    delete el.fit; delete el.rat; delete el.mano;
    return llena ? alHueco(el, el.hueco) : ajustarHueco(el, el.hueco, W, H);
  }
  // the photo covers its hole's whole area (to a pixel): no strips
  const cubreHueco = (el, W, H) => { const h = el.hueco, ex = 1 / W, ey = 1 / H; return el.x <= h.x + ex && el.y <= h.y + ey && el.x + el.w >= h.x + h.w - ex && el.y + el.h >= h.y + h.h - ey; };
  const PROVISIONAL = '#2b231f', INK = '#16110E';   // the templates' provisional hole colour (in no kit) and the brand's Ink
  const sinProvisional = comp => { if (String(comp.bg || '').toLowerCase() === PROVISIONAL) comp.bg = INK; };
  const coincide = (f, h, W, H) => { const d = M.files[f]; return !!d && orienta(d.w, d.h) === orienta(h.w * W, h.h * H); };   // photo f and hole h (its area), the same way round
  const llenaSola = (f, h, W, H) => coincide(f, h, W, H) || aSangre(h);   // where nobody can be asked
  // photo f into free hole h (slide W×H): a 'hueco' gives way to the photo, in its layer; an empty frame keeps its frame.
  // llena: filling the hole, or whole inside it; not given, nobody is asked. Returns the photo's element.
  function rellenar(comp, h, f, W, H, llena) {
    const vacio = clone(h); delete vacio.hueco;
    if (h.t === 'hueco') {
      const el = encajeHueco({ ...fotoEl(f), op: h.op ?? 1, hueco: vacio }, W, H, llena ?? llenaSola(f, h, W, H));
      comp.els.splice(comp.els.indexOf(h), 1, el);
      sinProvisional(comp);
      return el;
    }
    Object.assign(h, { src: f, cx: 0.5, cy: 0.5, z: 1, hueco: vacio });
    if (llena == null) colocar(h, W, H); else encajeHueco(h, W, H, llena);
    sinProvisional(comp);
    return h;
  }
  function reajustar(comp, el, f, W, H, llena = llenaSola(f, el.hueco, W, H)) {   // a hole already filled takes photo f: fitted to the hole again
    el.src = f; encajeHueco(el, W, H, llena); sinProvisional(comp);
    return el;
  }
  function sacar(comp, quita) {      // the elements quita(e) leave the slide; a photo that filled a hole gives it back, in its layer (an empty frame is the hole: it goes)
    comp.els = comp.els.flatMap(e => {
      if (!quita(e)) return [e];
      if (e.t !== 'foto' || !e.hueco || !e.src) return [];
      const h = clone(e.hueco); if (!h.id || comp.els.some(q => q !== e && q.id === h.id)) h.id = uid();
      return [h];
    });
  }
  // Before 1.9 a hole was drawn by hand or by a script: a group with a text «HUECO DE FOTO…», the hole's other texts («…
  // Borra este hueco y suelta la foto…») and, on an inner slide, the rectangle they sit in (a cover has none: the slide's
  // background is the hole). Each one becomes a 'hueco' in the same layer (the rectangle's, or its lowest text's): the
  // rectangle's area, fill and border, or the whole slide; its texts the group's marks, an inner one no longer saying «a
  // sangre» (the photo goes inside the margin). The rest of the slide stays as it is. Returns whether anything changed.
  const plano = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const esRotulo = e => e.t === 'texto' && /^\s*HUECO DE FOTO\b/.test(plano(e.txt));
  const esMarca = e => esRotulo(e) || (e.t === 'texto' && /BORRA ESTE HUECO|SUELTA LA FOTO/.test(plano(e.txt)));
  const rodea = (q, e) => { const cx = e.x + e.w / 2, cy = e.y + e.h / 2; return q.t === 'forma' && q.forma === 'rect' && cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h; };   // the hole's frame: the rectangle its caption sits in
  function migrarComp(comp) {
    if (!comp || !Array.isArray(comp.els)) return false;
    let n = 0;
    for (let rot; (rot = comp.els.find(esRotulo)); n++) {
      const els = comp.els, grupo = rot.g ? els.filter(q => q.g === rot.g) : [rot];
      const marco = grupo.find(q => rodea(q, rot)), marcas = grupo.filter(esMarca);
      const a = marco ? { x: marco.x, y: marco.y, w: marco.w, h: marco.h } : { x: 0, y: 0, w: 1, h: 1 };
      const capa = marco || els.find(q => marcas.includes(q));
      const texto = t => {
        const o = clone(t); ['id', 'g', 'lock', 'mano'].forEach(k => delete o[k]);
        Object.assign(o, { x: r4((t.x - a.x) / a.w), y: r4((t.y - a.y) / a.h), w: r4(t.w / a.w), h: r4((t.h || 0) / a.h) });
        if (marco) o.txt = String(o.txt ?? '').replace(/\s+a\s+sangre\b/gi, '');
        return o;
      };
      const h = { id: uid(), t: 'hueco', ...a, rot: marco ? marco.rot || 0 : 0, op: marco ? marco.op ?? 1 : 1, lock: !!(marco && marco.lock), sh: marco ? marco.sh || 0 : 0,
        color: marco && hexOk(marco.color) ? marco.color : null, b: marco ? marco.b || 0 : 0, bc: marco && hexOk(marco.bc) ? marco.bc : null, r: marco ? marco.r || 0 : 0, textos: marcas.map(texto) };
      if (capa.oculto) h.oculto = true;
      if (rot.g && grupo.some(q => q !== marco && !marcas.includes(q))) h.g = rot.g;   // other layers of its group stay grouped with it
      comp.els = els.flatMap(q => q === capa ? [h] : q === marco || marcas.includes(q) ? [] : [q]);
    }
    return n > 0;
  }
  const migrado = c => { migrarComp(c); return c; };
  function migrar(S) {               // a board (mesa: when it opens): every slide drawn here; the ids of the posts that changed
    const ids = [];
    for (const s of (S && S.slots) || []) if (Object.values(entries(s)).map(migrarComp).some(Boolean)) ids.push(s.id);
    return ids;
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
    const px = (el.size || 0.06) * W, pil = el.pil ? { x: PIL_X * px, y: PIL_Y * px } : null, maxW = Math.max(1, el.w * W - (pil ? 2 * pil.x : 0)), ls = (el.ls || 0) * px;
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
    return { out, px, lh: px * (el.lh || 1.2), ls, pil };
  }
  const PIL_X = 0.6, PIL_Y = 0.3;              // a pill's padding around its text, in em
  const altoTexto = L => Math.max(L.lh, L.out.length * L.lh) + (L.pil ? 2 * L.pil.y : 0);
  function ajustarTexto(el, W, H) { MC.save(); const L = lineas(MC, el, W); MC.restore(); el.h = r4(altoTexto(L) / H); }   // its height follows its lines

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
  function pathRR(ctx, x, y, w, h, r) { ctx.beginPath(); rr(ctx, x, y, w, h, r); }
  function rr(ctx, x, y, w, h, r) {   // a rounded rectangle, added to the path
    r = Math.max(0, Math.min(r, w / 2, h / 2));
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
  // a photo's border «Fuera» (D-047): around its frame, without covering the photo; its width in px, 0 when inside or none.
  // On a photo over the whole slide (a sangre) it stays in the slide: the photo shrinks inside it, keeping its proportion
  const cubre = el => !el.rot && aSangre(el);
  const bordeFuera = (el, W) => el.t === 'foto' && el.bo === 'fuera' && el.b > 0 && !cubre(el) ? el.b * W : 0;
  function drawSangre(ctx, el, W, H, img, k, ph) {
    const bw = el.b * W, iw = W - 2 * bw, ih = H - 2 * bw, s = Math.max(iw / W, ih / H), r = (el.r || 0) * Math.min(iw, ih) / 2;
    ctx.save(); pathRR(ctx, bw, bw, iw, ih, r); ctx.clip();
    drawFoto(ctx, { ...el, x: 0.5 + (el.x - 0.5) * s, y: 0.5 + (el.y - 0.5) * s, w: el.w * s, h: el.h * s, b: 0, r: 0, sh: 0 }, W, H, img, k, ph);
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= el.op ?? 1; ctx.beginPath(); ctx.rect(0, 0, W, H); rr(ctx, bw, bw, iw, ih, r); ctx.fillStyle = hexOk(el.bc) ? el.bc : '#ffffff'; ctx.fill('evenodd'); ctx.restore();
  }
  function drawFoto(ctx, el, W, H, img, k, ph) {
    const fw = el.w * W, fh = el.h * H; if (fw < 0.5 || fh < 0.5) return;
    if (el.bo === 'fuera' && el.b > 0 && cubre(el)) { drawSangre(ctx, el, W, H, img, k, ph); return; }
    const r = (el.r || 0) * Math.min(fw, fh) / 2, bw = (el.b || 0) * W, o = bordeFuera(el, W), ib = hueco(el, fw, fh), card = el.marco === 'polaroid' || el.marco === 'pelicula';
    ctx.save();
    ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    if (el.sh > 0) { ctx.save(); sombra(ctx, el, W, k); pathRR(ctx, -fw / 2 - o, -fh / 2 - o, fw + 2 * o, fh + 2 * o, r && r + o); ctx.fillStyle = card && el.marco === 'polaroid' ? '#fbfaf7' : '#000'; ctx.fill(); ctx.restore(); }
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
    if (bw > 0 && !card && !o) { ctx.lineWidth = bw * 2; ctx.strokeStyle = hexOk(el.bc) ? el.bc : '#ffffff'; pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.stroke(); }
    ctx.restore();
    if (bw > 0 && card && !o) { ctx.save(); pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.clip(); ctx.lineWidth = bw * 2; ctx.strokeStyle = hexOk(el.bc) ? el.bc : '#ffffff'; ctx.stroke(); ctx.restore(); }
    if (o) { ctx.beginPath(); rr(ctx, -fw / 2 - o, -fh / 2 - o, fw + 2 * o, fh + 2 * o, r && r + o); rr(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.fillStyle = hexOk(el.bc) ? el.bc : '#ffffff'; ctx.fill('evenodd'); }
    if (el.marco === 'cinta') {                // two strips of tape over the top corners
      const m2 = Math.min(fw, fh), tw = m2 * 0.3, th = m2 * 0.085; ctx.fillStyle = 'rgba(243,234,205,.82)';
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * (fw / 2 - tw * 0.22), -fh / 2 + th * 0.2); ctx.rotate(s * Math.PI / 4.6); ctx.fillRect(-tw / 2, -th / 2, tw, th); ctx.restore(); }
    }
    ctx.restore();
  }
  function drawTexto(ctx, el, W, H, k, ph) {
    ctx.save();
    const L = lineas(ctx, el, W), fw = el.w * W, fh = altoTexto(L), px = L.pil ? L.pil.x : 0, py = L.pil ? L.pil.y : 0;
    ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    const vacio = !L.out.some(s => s.trim());
    if (L.pil && (!vacio || (ph && !el.num))) {   // the pill, as wide as the longest line (and its padding), takes the shadow; empty, only in the editor
      const lw = Math.min(fw, Math.max(0, ...L.out.map(s => medir(ctx, s, L.ls))) + 2 * px), x0 = el.al === 'der' ? fw / 2 - lw : el.al === 'cen' ? -lw / 2 : -fw / 2;
      ctx.save(); if (el.sh > 0) sombra(ctx, el, W, k); pathRR(ctx, x0, -fh / 2, lw, fh, Math.min(fh, L.lh + 2 * py) / 2); ctx.fillStyle = hexOk(el.pil.c) ? el.pil.c : '#ffffff'; ctx.fill(); ctx.restore();
    } else if (el.sh > 0) sombra(ctx, el, W, k);
    ctx.fillStyle = hexOk(el.color) ? el.color : '#ffffff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    if (vacio && ph) { ctx.fillStyle = 'rgba(128,128,128,.6)'; ctx.fillText(el.num ? 'Nº' : 'Texto', -fw / 2 + px, -fh / 2 + py + (L.lh - L.px) / 2 + L.px * 0.8); }   // a number on the cover: only its place, in the editor
    L.out.forEach((s, i) => {
      const lw = medir(ctx, s, L.ls), x = el.al === 'der' ? fw / 2 - px - lw : el.al === 'cen' ? -lw / 2 : -fw / 2 + px, y = -fh / 2 + py + i * L.lh + (L.lh - L.px) / 2 + L.px * 0.8;
      if (HAS_LS || !L.ls) ctx.fillText(s, x, y);
      else { let cx = x; for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + L.ls; } }
    });
    ctx.restore();
  }
  // a logo or sticker in one flat colour (D-046): its shape and transparency, drawn once per image, colour and size in pixels
  const TINTE = new Map();
  function tenido(m, src, c, w, h) {
    const key = [src, c, w, h].join('|'), t = TINTE.get(key);
    if (t && t.im === m.im) return t.cv;
    if (TINTE.size > 40) TINTE.clear();
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(m.im, 0, 0, w, h); x.globalCompositeOperation = 'source-in'; x.fillStyle = c; x.fillRect(0, 0, w, h);
    TINTE.set(key, { im: m.im, cv }); return cv;
  }
  function drawLogo(ctx, el, W, H, img, k, ph) {
    const fw = el.w * W, fh = el.h * H; if (fw < 0.5 || fh < 0.5) return;
    const m = el.src ? img(el.src) : null;
    ctx.save(); ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    if (el.sh > 0) sombra(ctx, el, W, k);
    ctx.scale(el.fx ? -1 : 1, el.fy ? -1 : 1);
    if (m) ctx.drawImage(hexOk(el.tint) ? tenido(m, el.src, el.tint.toLowerCase(), Math.max(1, Math.min(4096, Math.round(fw * k))), Math.max(1, Math.min(4096, Math.round(fh * k)))) : m.im, -fw / 2, -fh / 2, fw, fh);
    else if (ph) { ctx.strokeStyle = 'rgba(128,128,128,.7)'; ctx.setLineDash([6, 5]); ctx.strokeRect(-fw / 2, -fh / 2, fw, fh); }
    ctx.restore();
  }
  const TRAZO = { linea: 1, flecha: 4 };      // a line's or an arrow's box height, in strokes (an arrow's: its heads' width)
  // a line or an arrow as one path (one fill, one shadow): its stroke t, continuous, dashed (3t, gaps of 2t) or dotted (dots
  // of t, 2t apart), stretched so both ends are on a dash or a dot; an arrow's heads are as wide as its box
  function trazo(ctx, el, fw, fh) {
    const t = fh / TRAZO[el.forma], p = el.forma === 'flecha' ? el.puntas || 'der' : '', iz = p === 'izq' || p === 'dos', de = p === 'der' || p === 'dos';
    const hl = p ? Math.min(fh * 0.9, fw / (iz && de ? 2.5 : 1.5)) : 0, a = -fw / 2 + (iz ? hl : 0), L = Math.max(0, fw - (iz ? hl : 0) - (de ? hl : 0));
    ctx.beginPath();
    if (el.trazo === 'disc') { const n = Math.max(1, Math.round((L + 2 * t) / (5 * t))), s = L / (5 * n * t - 2 * t); for (let i = 0; i < n; i++) ctx.rect(a + i * 5 * t * s, -t / 2, 3 * t * s, t); }
    else if (el.trazo === 'punt') { const r = t / 2, n = L > t ? Math.max(2, Math.round((L - t) / (2 * t)) + 1) : 1, sp = n > 1 ? (L - t) / (n - 1) : 0; for (let i = 0; i < n; i++) { const cx = n > 1 ? a + r + i * sp : a + L / 2; ctx.moveTo(cx + r, 0); ctx.arc(cx, 0, r, 0, Math.PI * 2); } }
    else ctx.rect(a - (iz ? 1 : 0), -t / 2, L + (iz ? 1 : 0) + (de ? 1 : 0), t);   // into the heads: no seam
    if (de) { ctx.moveTo(fw / 2, 0); ctx.lineTo(fw / 2 - hl, fh / 2); ctx.lineTo(fw / 2 - hl, -fh / 2); ctx.closePath(); }   // all wound alike: the overlaps fill
    if (iz) { ctx.moveTo(-fw / 2, 0); ctx.lineTo(-fw / 2 + hl, -fh / 2); ctx.lineTo(-fw / 2 + hl, fh / 2); ctx.closePath(); }
  }
  function drawForma(ctx, el, W, H, k) {
    const fw = el.w * W, fh = el.h * H; if (fw < 0.5 || fh < 0.5) return;
    ctx.save(); ctx.translate(el.x * W + fw / 2, el.y * H + fh / 2);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    if (TRAZO[el.forma]) { if (el.sh > 0) sombra(ctx, el, W, k); trazo(ctx, el, fw, fh); ctx.fillStyle = hexOk(el.color) ? el.color : '#ffffff'; ctx.fill(); ctx.restore(); return; }
    const path = () => { if (el.forma === 'elipse') { ctx.beginPath(); ctx.ellipse(0, 0, fw / 2, fh / 2, 0, 0, Math.PI * 2); } else pathRR(ctx, -fw / 2, -fh / 2, fw, fh, el.forma === 'linea' ? 0 : (el.r || 0) * Math.min(fw, fh) / 2); };
    ctx.save(); if (el.sh > 0) sombra(ctx, el, W, k); path(); ctx.fillStyle = hexOk(el.color) ? el.color : '#ffffff'; ctx.fill(); ctx.restore();
    if (el.b > 0 && el.forma !== 'linea') { path(); ctx.save(); ctx.clip(); ctx.lineWidth = el.b * W * 2; ctx.strokeStyle = hexOk(el.bc) ? el.bc : '#000000'; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  function drawHueco(ctx, el, W, H, k, ph) {   // a free hole: its fill and border (as a rectangle), then its texts
    const fw = el.w * W, fh = el.h * H; if (fw < 0.5 || fh < 0.5) return;
    const cx = el.x * W + fw / 2, cy = el.y * H + fh / 2, r = (el.r || 0) * Math.min(fw, fh) / 2, ts = el.textos || [];
    ctx.save(); ctx.translate(cx, cy);
    if (el.rot) ctx.rotate(el.rot * Math.PI / 180);
    ctx.globalAlpha *= el.op ?? 1;
    if (hexOk(el.color)) { ctx.save(); if (el.sh > 0) sombra(ctx, el, W, k); pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.fillStyle = el.color; ctx.fill(); ctx.restore(); }
    if (el.b > 0) { pathRR(ctx, -fw / 2, -fh / 2, fw, fh, r); ctx.save(); ctx.clip(); ctx.lineWidth = el.b * W * 2; ctx.strokeStyle = hexOk(el.bc) ? el.bc : '#000000'; ctx.stroke(); ctx.restore(); }
    else if (ph && !hexOk(el.color) && !ts.length) { ctx.strokeStyle = 'rgba(128,128,128,.7)'; ctx.lineWidth = 2 / k; ctx.setLineDash([6 / k, 5 / k]); ctx.strokeRect(-fw / 2, -fh / 2, fw, fh); ctx.setLineDash([]); }
    ctx.translate(-cx, -cy);
    if (!FUERA) for (const t of ts) drawTexto(ctx, enHueco(el, t), W, H, k, false);   // its label and guide text: never in the image (D-035)
    ctx.restore();
  }
  let FUERA = false;               // drawing the image that leaves the editor (or its preview), not the editor's
  function drawEl(ctx, el, W, H, img, k, ph) {
    if (el.oculto) return;
    if (el.t === 'texto') drawTexto(ctx, el, W, H, k, ph);
    else if (el.t === 'hueco') drawHueco(ctx, el, W, H, k, ph);
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
  let APL = 0, CLIP = null, ESTILO = null;   // «Aplicar» running; what was copied {els | slide (a whole comp), rat (W/H of its slide), client} (kept between posts of the same client); a text's style {st, client} (⌥⌘C)
  const curSlot = () => { if (!E) return null; const S = I() && I().S, s = S && S === E.board ? conHist(S).find(x => x.id === E.slotId) : null; return s && (s.design || null) === E.dz && isLibSlot(s) ? s : null; };   // a designed post: the very design it opened with
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
    if (TRAZO[forma]) { const h = 6 * TRAZO[forma] / H; return { id: uid(), t: 'forma', forma, x: 0.15, y: r4(0.5 - h / 2), w: 0.7, h: r4(h), ...base, color: '#ffffff', r: 0, b: 0, bc: '#000000', ...(forma === 'flecha' ? { puntas: 'der' } : {}) }; }   // a stroke of 6 px (of 1440)
    return { id: uid(), t: 'forma', forma, x: r4((W - s) / 2 / W), y: r4((H - s * (forma === 'rect' ? 0.6 : 1)) / 2 / H), w: 0.4, h: r4(s * (forma === 'rect' ? 0.6 : 1) / H), ...base, color: '#ffffff', r: 0, b: 0, bc: '#000000' };
  }
  function pildoraEl() {              // a short text with a pill behind it, centred: white on a photo or a dark background, else black
    const c = compAt(E.i), { W, H } = sizeAt(E.i), claro = fotosDe(c).length > 0 || lum(hexOk(c.bg) ? c.bg : '#ffffff') < 0.4;
    const el = Object.assign(textoEl(claro ? '#000000' : '#ffffff'), { txt: 'Etiqueta', size: 0.035, x: 0.3, w: 0.4, pil: { c: claro ? '#ffffff' : '#000000' } });
    ajustarTexto(el, W, H); el.y = r4(0.5 - el.h / 2); return el;
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
  const firmaG = () => JSON.stringify(['x', 'y'].map(k => [...E.guias[k]].sort((a, b) => a - b)));   // the post's guides, in any order
  function pendiente() {
    if (!E) return false;
    if (E.car && E.fmt !== E.fmt0) return true;
    if (firmaG() !== E.guias0) return true;
    if (!I().same(E.sl.map(x => x.key).filter(k => k || !E.historia), E.photos0)) return true;
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
      await Promise.all(textosDe(comp).filter(e => e.font && e.font.file).map(e => fuente(e.font).p.catch(() => {})));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      for (const f of srcsOf(comp)) if (!cache.has(f)) { const bmp = await createImageBitmap(await I().getBlob(f), { imageOrientation: 'from-image' }); cache.set(f, { im: bmp }); }
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      FUERA = true; try { drawComp(x, comp, W, H, f => cache.get(f) || null, 1, false); } finally { FUERA = false; }
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
      const s = conHist(S).find(x => x.id === slotId); need(s, 'Esa publicación ya no está en la mesa.');
      need(isLibSlot(s), 'El editor es para carruseles, fotos y portadas de reel.');
      need(!I().isReel(s.type) || s.photos.length, 'El reel no tiene portada: ponle una foto antes de editarla.');
      const dz = s.design || null;                          // a designed carousel: its applied images are the slides
      need(!dz || ((I().isCarousel(s.type) || I().isReel(s.type)) && s.photos.length && I().same(s.photos, (dz.out || []).filter(Boolean))), 'Aplica antes el diseño en «Diseñar»: el editor trabaja sobre sus imágenes.');
      need(!(M.diseno && M.diseno.aplicando && M.diseno.aplicando()), 'Espera: el diseñador está aplicando un diseño.');
      need(!(E && E.busy), 'Espera: el editor está aplicando una publicación.');
      need(!APL && !REDO.has(slotId) && !NUMQ.has(slotId), 'Espera: la mesa está redibujando una publicación.');   // its images would change under the editor
      if (E) cerrar(true);
      await I().loadThumbs([...s.photos, ...S.slots.flatMap(x => Object.values(entries(x)).flatMap(srcsOf)), ...S.tray, ...(esHist(s) ? Object.values(entries(s)).flatMap(srcsOf) : [])]);
      need(I().S === S && conHist(S).includes(s) && (s.design || null) === dz && !(I().switching && I().switching()), 'La mesa cambió: vuelve a pulsar «Editar».');
      need(!(E && E.busy), 'Espera: el editor está aplicando una publicación.');
      need(!APL && !REDO.has(slotId) && !NUMQ.has(slotId), 'Espera: la mesa está redibujando una publicación.');   // its images would change under the editor
      if (E) cerrar(true);
      const marca = I().histMarca ? I().histMarca() : null;   // the whole session is one step of the mesa's ⌘Z
      if (I().clearToasts) I().clearToasts();               // an «Deshacer» left in a toast would change the post behind the editor
      const car = I().isCarousel(s.type), fmt0 = car ? s.fmt || 'v45' : null;
      E = { slotId, board: S, dz, car, reel: I().isReel(s.type) || esHist(s), historia: esHist(s), tipo: s.type, fmt: fmt0, fmt0, sl: [], i: 0, sel: null, mas: [], crop: null, pick: null, zoom: 1, finEscr: -1e4, iman: true, hist: { undo: [], redo: [], tag: null, t: 0 },
        bm: new Map(), marca, photos0: s.photos.slice(), kit: null, plant: [], logos: [], fkit: [], estilos: [], tcol: [], trOpen: bandejaAbierta(), trKey: '', trSel: [], vuelven: new Set(), menuOn: false, flm: false, fuentes: [...FUENTES_MESA, ...FUENTES_MAC], drag: null, guides: [], cotas: [], busy: false, raf: 0, k: 1, sz: { W: OUT_W, H: OUT_W * 1.25 },
        guias: { x: ((s.guias && s.guias.x) || []).slice(), y: ((s.guias && s.guias.y) || []).slice() }, reglas: lsLeer(LS_RG) === '1', zona: esHist(s) ? lsLeer(LS_ZH) !== '0' : lsLeer(LS_ZG) === '1', margen: 0 };
      E.guias0 = firmaG();
      E.sl = s.photos.map(key => {
        const f = esHist(s) && entries(s)[key] ? { s, comp: entries(s)[key] } : compOf(S, key), fmt = car ? null : I().cropOf(key, s).fmt;   // a story's own: a duplicate shares its image until it is applied
        if (f) { const comp = migrado(clone(f.comp)); return { key, out: true, from: f.s !== s ? f.s.id : null, comp, raw: null, base: firma(comp), fmt, fmt0: fmt }; }
        const raw = rawComp(key);
        return { key, out: false, from: null, comp: null, raw, base: firma(raw), fmt, fmt0: fmt };
      });
      if (esHist(s) && !E.sl.length) { const x = blankSlide(s.fondo || '#ffffff'); x.fmt0 = x.fmt; x.base = firma(x.comp); E.sl = [x]; }   // not designed yet: an empty page, unchanged until something goes on it
      E.i = clamp(idx || 0, 0, E.sl.length - 1);
      const d0 = car && fmt0 === 'h' && M.files[s.photos[0]];
      E.rat0 = d0 && d0.design ? I().fmtRatio('h', d0.w, d0.h) : null;
      const b0 = E.sl.map(x => x.comp && firma(x.comp));   // a crossing photo whose slides were reordered in the mesa comes apart: not a change made here
      repararPan(); E.sl.forEach((x, i) => { if (x.comp && x.base === b0[i]) x.base = firma(x.comp); });
      E.sl.forEach((x, i) => { if (x.comp) { const d = x.out && M.files[x.key], { W, H } = sizeAt(i); x.rat = d ? d.w / d.h : W / H; } });   // the proportion its texts are placed for: the one it was drawn in
      recolocar();                                         // a slide drawn in another proportion (its post changed type or format): its texts to their place now
      renumerar();                                         // its numbers, if its slides moved in the mesa (sync draws them again; if not, «Aplicar»)
      if (opts.fmt && FMTS[opts.fmt]) formatoEd(opts.fmt, true);
      injectCSS();
      build(s);
      cargarCliente();
      ofrecerNumeros();
      if (opts.foto) desdeBandeja([opts.foto], { i: null, p: null });   // a photo dropped on a story in the view: as if clicked in this tray, with its warning
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
  // texts written by hand like «02 / 11»: one question to make them all automatic («Ahora no»: not again for this post here)
  const SIN_NUM = new Set();
  function ofrecerNumeros() {
    const key = E.board.key + ':' + E.slotId; if (SIN_NUM.has(key) || E.sl.length < 2) return;
    const ts = []; E.sl.forEach((x, i) => { if (x.comp) x.comp.els.forEach(e => { if (e.t === 'texto' && !e.num && !e.oculto && numAMano(e.txt)) ts.push([i, e.id, e.txt.trim()]); }); });
    if (!ts.length) return;
    const portada = ts.some(([i]) => !i);
    preguntar(ts.length === 1 ? `¿Numerar «${ts[0][2]}» automáticamente?` : `¿Numerar automáticamente los ${ts.length} textos como «${ts[0][2]}»?`,
      `El número pasa a ser la posición de su diapositiva y el total, portada incluida, y se pone al día solo al añadir, borrar, mover o duplicar diapositivas.${portada ? ' En la portada no se ve: la portada nunca lleva número.' : ''}`,
      [['seguir', 'Ahora no', 'btn2'], ['num', 'Convertir', 'btn']], v => {
        if (v !== 'num') { SIN_NUM.add(key); return; }
        mut(null, () => ts.forEach(([i, id, t]) => { const e = E.sl[i] && E.sl[i].comp && E.sl[i].comp.els.find(q => q.id === id); if (e) e.num = { f: /\s\/|\/\s|^0/.test(t) ? 'a' : 'b' }; }));   // spaced or with its zero: «02 / 7»
      });
    E.askNo = () => SIN_NUM.add(key);
  }
  function blankSlide(bg) { const comp = { bg, velo: null, els: [] }; return { key: null, out: false, from: null, comp, raw: null, base: null, fmt: E && !E.car ? (E.reel ? 'r916' : 'v45') : null, fmt0: null }; }
  function cerrar(silent) {
    if (!E) return { ok: true };
    const e = E; E = null;
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', sinEspacio, true); window.removeEventListener('blur', sinEspacio);
    window.removeEventListener('resize', fvDibujar); if (e.fvUrl) URL.revokeObjectURL(e.fvUrl);
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
    d.innerHTML = `<div class="lb-askc" role="alertdialog" aria-label="${esc(t)}"><h4>${esc(t)}</h4>${Array.isArray(p) ? `<ul class="lb-askl">${p.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ul>` : p ? `<p>${esc(p)}</p>` : ''}${campo != null ? `<input type="text" class="lb-askin" maxlength="40" value="${esc(campo)}">` : ''}<div class="lb-btns">${btns.map(([v, l, c]) => `<button type="button" class="${c}" data-ask="${v}">${esc(l)}</button>`).join('')}</div></div>`;
    const done = v => { const inp = d.querySelector('.lb-askin'), txt = inp ? inp.value : null; E.askNo = null; cerrarPregunta(); (on || (x => { if (x === 'salir') cerrar(); else if (x === 'aplicar') aplicar(); }))(v, txt); };
    d.addEventListener('click', ev => { const b = ev.target.closest('[data-ask]'); if (!b && ev.target !== d) return; done(b ? b.dataset.ask : 'seguir'); });
    E.el.append(d); E.ask = d; E.askOk = () => done(btns[btns.length - 1][0]);   // Enter in the field (onKey)
    const f = d.querySelector('.lb-askin') || d.querySelector('[data-ask="seguir"]'); if (f) { f.focus(); if (f.select) f.select(); }
  }
  function cerrarPregunta() { if (E && E.ask) { const no = E.askNo; E.askNo = null; E.ask.remove(); E.ask = null; if (no) no(); } }   // askNo: a warning closed without an answer (Esc) is Cancelar
  function sync() {     // called on every mesa render: the editor closes when its board or post is gone
    numerosMesa();
    if (!E || E.busy) return;
    if (!curSlot()) { cerrar(true); if (I() && I().toast) I().toast('El editor se ha cerrado: la publicación cambió o ya no está en la mesa.'); }
    else bandeja();
  }

  // a post whose slides changed in the mesa (moved, added, taken out, a new cover) with numbered texts no longer at their place:
  // its drawn images are drawn again (redibujar), once for each order of its photos
  const NUM_VISTO = new Map();
  function numerosMesa() {
    const S = I() && I().S;
    if (!S || APL || (E && E.busy) || I().locked || (I().uploadsBusy && I().uploadsBusy()) || (M.diseno && M.diseno.aplicando && M.diseno.aplicando())) return;
    let n = 0;
    for (const s of S.slots) {
      if (s.design || !s.photos.length || (E && E.board === S && E.slotId === s.id)) continue;   // the open post: the editor numbers it
      const k = S.key + ':' + s.id, sig = s.photos.join('|'); if (NUM_VISTO.get(k) === sig) continue;
      NUM_VISTO.set(k, sig);
      if (s.photos.some((key, j) => { const f = compOf(S, key); return f && numViejo(f.comp, j, s.photos.length); })) { NUMQ.add(s.id); n++; }
    }
    if (n) drenar();
  }

  // ---------- the client's colours, fonts, templates and logos (kit JSON + client record c.libre) ----------
  async function cargarCliente() {
    const owner = E, cid = E.board.client; if (!cid) return;
    const fk = [];
    let kit = null, est = [], tcol = [], mg = 0;
    if (M.diseno && M.diseno.kit) {
      try {
        const raw = await M.diseno.kit(cid);
        kit = paletaKit(raw);
        if (raw && raw.fuentes) for (const f of Object.values(raw.fuentes)) if (f && f.archivo && !fk.some(q => q.file === f.archivo)) fk.push({ n: f.familia || f.archivo, file: f.archivo, w: f.peso || 400, kit: true });
        est = estilosKit(raw); mg = raw && raw.lienzo && +raw.lienzo.margen > 0 ? +raw.lienzo.margen / (+raw.lienzo.ancho || 1080) : 0;   // the margin (D-014), a fraction of the width
        tcol = ((raw && raw.colores_texto && raw.colores_texto.principales) || []).map(k => raw.colores && raw.colores[k]).filter(hexOk).map(c => c.toLowerCase());
      } catch (e) { /* this client has no design kit */ }
    }
    const c = await I().idbGet('clients', cid), lib = (c && c.libre) || {};
    if (E !== owner) return;
    E.kit = kit; E.fkit = fk; E.estilos = est; E.tcol = tcol; E.margen = mg; E.fuentes = [...fk, ...FUENTES_MESA.filter(f => !fk.some(q => q.file === f.file)), ...FUENTES_MAC];
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
  function renumerar() { const n = E.sl.length; E.sl.forEach((x, i) => { if (x.comp) { const { W, H } = sizeAt(i); numerar(x.comp, i, n, W, H); } }); }   // after every change: slides added, deleted, moved, duplicated or pasted
  function despues(quiet) {
    renumerar();
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
      E.sl.forEach((x, j) => { if (j !== E.i && x.comp) sacar(x.comp, e => !!(e.pan && e.pan.id === id && (n === 1 || e.pan.k >= n))); });
      if (n === 1) { delete m.pan; return; }
      for (let t = 0; t < falta; t++) E.sl.push(blankSlide(c.bg || '#ffffff'));
      m.pan = { id, n, k: k0 };
      for (let k = 0; k < n; k++) {
        const x = E.sl[b + k]; if (b + k === E.i) continue;
        const cc = x.comp || (x.comp = clone(x.raw)); if (cc.els.some(e => e.pan && e.pan.id === id)) continue;
        const e = { ...clone(m), id: uid(), pan: { id, n, k } }; delete e.g; delete e.hueco;
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
#mesa .lb-trh{margin-bottom:6px;font-size:12.5px;color:var(--mute)}#mesa .lb-trh b{color:var(--ink);font-weight:600}#mesa .lb-trh .seg{display:inline-flex;vertical-align:middle;margin-right:8px}#mesa .lb-trh .seg button{padding:2px 8px;font-size:12px}
#mesa .lb-trs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}#mesa .lb-tph{flex:none;width:72px;cursor:grab}
#mesa .lb-tph.elegida{outline:3px solid var(--acc);outline-offset:-3px}
#mesa .lb-tph .hs{bottom:5px}
#mesa .lb-ttl p.lb-guion{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;max-width:min(60vw,720px);white-space:pre-line}
#mesa .lb-tph .hb{position:absolute;top:5px;left:5px;font-size:9.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.55);border-radius:4px;padding:0 4px;pointer-events:none}
#mesa .lb-tph.uso::after{content:'✓';position:absolute;right:3px;bottom:3px;width:16px;height:16px;border-radius:50%;background:var(--acc);color:#fff;font-size:11.5px;line-height:16px;text-align:center}
#mesa .lb-tray.over,#mesa .lb-scroll.over{outline:2px dashed var(--acc);outline-offset:-4px}#mesa .lb-it.over canvas{outline-color:var(--acc)}
#mesa .lb-marq{position:fixed;z-index:6;border:1px solid #0095f6;background:rgba(0,149,246,.08);pointer-events:none}
#mesa .lb-menu.lb-cm{position:fixed;top:0;right:auto;z-index:20}#mesa .lb-menu.lb-cm button{display:flex;justify-content:space-between;align-items:center}#mesa .lb-menu.lb-cm button:disabled{color:var(--faint);background:none;cursor:default}
#mesa .lb-ghostn{position:fixed;z-index:31;min-width:20px;height:20px;margin:-42px 0 0 22px;padding:0 5px;box-sizing:border-box;border-radius:10px;background:var(--acc);color:#fff;font-size:12px;font-weight:700;line-height:20px;text-align:center;pointer-events:none}
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
#mesa .lb-askl{list-style:none;margin:0 0 8px;padding:0;max-height:min(50vh,300px);overflow:auto;font-size:13px}#mesa .lb-askl li{padding:5px 0;border-top:1px solid var(--line2)}#mesa .lb-askl li span{display:block;color:var(--mute);font-size:12.5px}
#mesa .lb-askimg{display:block;max-width:100%;max-height:150px;margin:0 auto 10px;border-radius:6px}
#mesa .lb-askc h4{margin:0 0 6px;font-size:15px}#mesa .lb-askc p{margin:0 0 6px;color:var(--mute);font-size:13px}
#mesa .lb-askin{display:block;width:100%;box-sizing:border-box;margin:8px 0 4px;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:inherit;font-size:13px}#mesa .lb-askin:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
#mesa .lb-it,#mesa .lb-allit{position:relative}#mesa .lb-it.lb-drg,#mesa .lb-allit.lb-drg{opacity:.4}
#mesa .lb-it.lb-dl::before,#mesa .lb-it.lb-dr::after{content:'';position:absolute;left:0;right:0;height:3px;border-radius:2px;background:var(--acc)}#mesa .lb-it.lb-dl::before{top:-8px}#mesa .lb-it.lb-dr::after{bottom:-8px}
#mesa .lb-allit.lb-dl::before,#mesa .lb-allit.lb-dr::after{content:'';position:absolute;top:0;bottom:0;width:3px;border-radius:2px;background:var(--acc)}#mesa .lb-allit.lb-dl::before{left:-10px}#mesa .lb-allit.lb-dr::after{right:-10px}
#mesa .lb-pv{position:absolute;inset:0;z-index:25;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
#mesa .lb-pv .igtop{align-self:stretch}#mesa .lb-pvt{flex:1;min-width:0;color:rgba(255,255,255,.85);font-size:12.5px}#mesa .lb-pvc{position:absolute;inset:0;width:100%;height:100%;display:block}
#mesa .lb-fv{position:fixed;inset:0;z-index:60;background:#000;display:flex;align-items:center;justify-content:center;cursor:zoom-out}#mesa .lb-fv img{display:block;width:100%;height:100%;object-fit:contain}#mesa .lb-fv canvas{display:block}
#mesa .lb-rng.lb-mix input{opacity:.4}#mesa .lb-rng.lb-mix output{font-style:italic}#mesa .lb-fan{display:flex;align-items:center;gap:8px}#mesa .lb-fan .lb-num{width:84px}
#mesa .lb-fvt{position:absolute;left:16px;top:12px;right:16px;color:rgba(255,255,255,.8);font-size:12.5px;text-shadow:0 1px 3px rgba(0,0,0,.8);pointer-events:none}
#mesa .lb-fmtw{display:inline-flex;align-items:center;gap:6px}#mesa .lb-fmtl{font-size:12.5px;color:var(--mute)}
#mesa .lb-mas{position:relative;display:inline-flex}
#mesa .lb-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:12;display:flex;flex-direction:column;min-width:220px;padding:4px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14)}
#mesa .lb-menu[hidden],#mesa .lb-fl[hidden],#mesa .lb-atajos[hidden],#mesa .lb-flm[hidden]{display:none}
#mesa .lb-menu button,#mesa .lb-flm button{border:0;background:none;border-radius:7px;padding:8px 10px;text-align:left;font-size:13px;color:var(--ink)}
#mesa .lb-menu button:hover,#mesa .lb-flm button:hover:not(:disabled){background:var(--line2)}#mesa .lb-menu .lb-kb{margin-left:12px;color:var(--mute)}
#mesa .lb-menu [aria-checked]::before{content:'';display:inline-block;width:18px}#mesa .lb-menu [aria-checked="true"]::before{content:'✓'}
#mesa .lb-help{position:absolute;right:12px;top:2px;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--mute);font-size:13px;font-weight:600;padding:0}
#mesa .lb-help:hover,#mesa .lb-help[aria-expanded="true"]{color:var(--ink);border-color:var(--ink)}
#mesa .lb-atajos{position:absolute;right:12px;bottom:calc(100% + 6px);z-index:12;width:min(400px,calc(100vw - 32px));max-height:min(70vh,520px);overflow:auto;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);font-size:12.5px}
#mesa .lb-atajos h4{margin:0 0 8px;font-size:13px}#mesa .lb-atajos dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0}
#mesa .lb-atajos dt{font-weight:600;white-space:nowrap}#mesa .lb-atajos dd{margin:0;color:var(--mute)}#mesa .lb-atajos p{margin:10px 0 0;color:var(--mute)}
#mesa .lb-cvw{position:relative}
#mesa .lb-scroll.reglas{padding-top:44px;padding-left:44px}
#mesa .lb-rx,#mesa .lb-ry{position:absolute;background:var(--panel);color:var(--mute);touch-action:none}#mesa .lb-rx[hidden],#mesa .lb-ry[hidden]{display:none}
#mesa .lb-rx{left:0;top:-22px;cursor:row-resize;border-bottom:1px solid var(--line)}#mesa .lb-ry{top:0;left:-22px;cursor:col-resize;border-right:1px solid var(--line)}
#mesa .lb-fl{position:absolute;z-index:4;display:flex;flex-wrap:wrap;width:max-content;max-width:100%;box-sizing:border-box;gap:2px;padding:3px;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.14);line-height:1.4;white-space:nowrap}
#mesa .lb-fl>button{border:0;background:none;border-radius:7px;padding:6px 10px;font-size:12.5px;color:var(--ink)}
#mesa .lb-fl>button:hover:not(:disabled),#mesa .lb-fl>button[aria-expanded="true"]{background:var(--line2)}#mesa .lb-fl>button:disabled{opacity:.35;cursor:default}
#mesa .lb-fl>button.del{color:var(--chg)}
#mesa .lb-rat{position:absolute;z-index:4;padding:2px 8px;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;font-size:11.5px;line-height:1.5;white-space:nowrap;pointer-events:none}#mesa .lb-rat[hidden]{display:none}
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
    el.innerHTML = `<header class="lb-head"><div class="lb-ttl"><h3>${esc(s.name)}</h3><p${E.historia ? ' class="lb-guion"' : ''}${E.historia && s.note ? ` title="${esc(s.note)}"` : ''}>${E.historia ? `Editar historia${s.note ? ` · ${esc(s.note)}` : ''}` : `${E.tipo === 'Foto' ? 'Editar foto' : E.reel ? 'Editar portada' : 'Editar diapositivas'} · ${E.dz ? 'diseño de «Diseñar»: si aplicas cambios, queda fijado como imagen' : 'lo que no toques se queda como está'}`}</p></div>`
      + (E.reel ? '<span class="lb-fmtw"><span class="lb-fmtl">' + (E.historia ? 'Historia' : 'Portada del reel') + ' · 9:16</span></span>' : `<span class="lb-fmtw"><span class="lb-fmtl">${E.car ? 'Diapositivas' : 'Diapositiva'}</span><div class="seg lb-fmt" role="group" aria-label="Formato de ${E.car ? 'las diapositivas' : 'la diapositiva'}">${Object.entries(FMTS).map(([k, l]) => `<button type="button" data-lb="fmt" data-v="${k}">${l}</button>`).join('')}</div></span>`)
      + '<span class="lb-tools"><button type="button" class="lb-ib" data-lb="undo" title="Deshacer (⌘Z)" aria-label="Deshacer">↶</button><button type="button" class="lb-ib" data-lb="redo" title="Rehacer (⇧⌘Z)" aria-label="Rehacer">↷</button></span>'
      + '<span class="lb-tools"><button type="button" class="lb-ib" data-lb="zout" title="Alejar" aria-label="Alejar">−</button><output class="lb-zv">100 %</output><button type="button" class="lb-ib" data-lb="zin" title="Acercar" aria-label="Acercar">+</button><button type="button" class="lb-ib" data-lb="zfit" title="Ver la diapositiva entera">Ajustar</button></span>'
      + `<button type="button" class="lb-ib${E.reglas ? ' on' : ''}" data-lb="guias" aria-pressed="${E.reglas}" title="Reglas y guías (⌘G): arrastra desde una regla para crear una guía y fuera de la diapositiva para borrarla. No salen al exportar">Guías</button>`
      + '<button type="button" class="lb-ib" data-lb="preview" title="Cómo se verá en Instagram, como en la vista cliente">Vista previa</button>'
      + '<span class="lb-mas"><button type="button" class="lb-ib" data-lb="mas" title="Más" aria-label="Más opciones" aria-haspopup="menu" aria-expanded="false">⋯</button>'
      + '<span class="lb-menu" role="menu" hidden><button type="button" role="menuitem" data-lb="todas">Ver todas las diapositivas</button>'
      + '<button type="button" role="menuitemcheckbox" data-lb="iman" aria-checked="true" title="Al arrastrar o ampliar: alinea con los bordes, el centro, el margen del kit, las guías y los otros elementos; mide las distancias y marca los espacios y tamaños iguales (con ⌘ pulsado no actúa)">Imán al arrastrar</button>'
      + (E.historia ? '<button type="button" role="menuitemcheckbox" data-lb="zona" aria-checked="false" title="Oscurece lo que Instagram tapa en una historia: deja el texto y los logos fuera de ahí. No sale al exportar">Zona segura <span class="lb-kb">⌘P</span></button></span></span>' : '<button type="button" role="menuitemcheckbox" data-lb="zona" aria-checked="false" title="En la portada, oscurece lo que el perfil de Instagram recorta al mostrarla en 3:4. No sale al exportar">Zona del grid <span class="lb-kb">⌘P</span></button></span></span>')
      + '<span class="lb-state" aria-live="polite"></span><button type="button" class="btn2" data-lb="cerrar">Cerrar</button><button type="button" class="btn" data-lb="aplicar">' + (E.historia ? 'Aplicar a la historia' : 'Aplicar a la casilla') + '</button></header>'
      + '<div class="lb-body"><nav class="lb-list" aria-label="Diapositivas"></nav>'
      + `<section class="lb-mid"><div class="lb-scroll${E.reglas ? ' reglas' : ''}"><div class="lb-cvw"><canvas class="lb-cv" aria-label="Diapositiva"></canvas>`
      + `<canvas class="lb-rx" aria-hidden="true"${E.reglas ? '' : ' hidden'}></canvas><canvas class="lb-ry" aria-hidden="true"${E.reglas ? '' : ' hidden'}></canvas>`
      + '<div class="lb-fl" role="toolbar" aria-label="Elemento elegido" hidden></div><div class="lb-rat" hidden></div></div></div>'
      + '<p class="lb-hint" aria-live="polite" hidden></p>'
      + `<div class="lb-tray" id="lb-tray" hidden></div><div class="lb-foot"><button type="button" class="lb-trb" data-lb="bandeja" aria-expanded="false" aria-controls="lb-tray" title="Bandeja: sus fotos, para ponerlas en la diapositiva"><span class="lb-trn">Bandeja</span>${FLECHA}</button>`
      + `<button type="button" class="lb-help" data-lb="atajos" aria-label="Atajos de teclado" aria-expanded="false" title="Atajos de teclado">?</button><div class="lb-atajos" role="dialog" aria-label="Atajos de teclado" hidden>${ATAJOS}</div></div></section>`
      + '<aside class="lb-panel"></aside></div><div class="lb-all" hidden></div><div class="lb-menu lb-cm" role="menu" aria-label="Fuera de la diapositiva" hidden></div><input type="file" class="lb-logoin" accept="image/png,image/webp,image/jpeg" multiple hidden>';
    root.append(el);
    // the mesa behind can't be reached with Tab while the editor is open (toasts stay usable)
    E.inert = [...root.children].filter(c => c !== el && !c.matches('.toasts, .lock, style') && !c.hasAttribute('inert'));
    E.inert.forEach(c => c.setAttribute('inert', ''));
    E.el = el; E.cv = el.querySelector('.lb-cv'); E.ctx = E.cv.getContext('2d'); E.scroll = el.querySelector('.lb-scroll'); E.allEl = el.querySelector('.lb-all');
    const ae = document.activeElement; if (ae && ae.blur && root.contains(ae)) ae.blur();
    el.focus({ preventScroll: true });
    wire(el);
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', sinEspacio, true); window.addEventListener('blur', sinEspacio);
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
    q('[data-lb="iman"]').setAttribute('aria-checked', String(E.iman)); q('[data-lb="zona"]').setAttribute('aria-checked', String(E.zona));
    const gb = q('[data-lb="guias"]'); gb.classList.toggle('on', E.reglas); gb.setAttribute('aria-pressed', String(E.reglas));
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
    if (E.fv) fvDibujar();
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
    if (E.zAncla) { const a = E.zAncla, r = E.cv.getBoundingClientRect(); E.zAncla = null; E.scroll.scrollLeft += r.left + a.x * E.k - a.cx; E.scroll.scrollTop += r.top + a.y * E.k - a.cy; }   // zoomed on the pointer: it stays on the same point
    const x = E.ctx, k = E.k * dpr;
    x.setTransform(k, 0, 0, k, 0, 0); x.imageSmoothingQuality = 'high';
    const comp = compAt(E.i);
    comp.els.forEach(e => { if (e.t === 'texto') ajustarTexto(e, W, H); });   // a text's frame follows its lines (its font may have just loaded)
    drawComp(x, comp, W, H, viewImg, k, true);
    const el = selEl();
    if (el && E.crop === el.id) cropView(x, el, W, H, k);
    if (E.zona && E.i === 0) verZona(x, W, H);
    if (E.reglas) verGuias(x, W, H);
    if (E.cambio || E.ojo) verHuecos(x, W, H);
    const ss = selEls(); ss.forEach(e => marco(x, e, W, H, ss.length === 1 && !E.cambio));
    posBarra(); posRat();
    for (const g of E.guides) {
      const c = g.x != null ? Math.abs(g.x - W / 2) < 1e-6 : Math.abs(g.y - H / 2) < 1e-6;   // the slide's centre: green and dashed
      x.save(); x.strokeStyle = c ? CENTRO : ROSA; x.lineWidth = 1 / E.k; if (c) x.setLineDash([6 / E.k, 4 / E.k]); x.beginPath(); if (g.x != null) { x.moveTo(g.x, 0); x.lineTo(g.x, H); } else { x.moveTo(0, g.y); x.lineTo(W, g.y); } x.stroke(); x.restore();
    }
    if (E.cotas.length) dibujarCotas(x);
    if (E.reglas) reglas();
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
  // the holes a photo can go to: only on the editor's canvas, never in what is drawn for the post
  function verHuecos(x, W, H) {
    const hs = E.cambio ? huecosCambio() : compAt(E.i).els.filter(e => e.id === E.ojo), u = 1 / E.k;
    for (const e of hs) {
      const g = geoCaja(areaHueco(e), W, H);
      x.save(); x.translate(g.cx, g.cy); x.rotate(g.a);
      x.fillStyle = 'rgba(0,149,246,.28)'; x.fillRect(-g.w / 2, -g.h / 2, g.w, g.h);
      x.lineWidth = 2 * u; x.strokeStyle = '#0095f6'; x.setLineDash([7 * u, 5 * u]); x.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h);
      x.restore();
    }
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
    if (el.t === 'forma' && TRAZO[el.forma]) return HANDLES.filter(([a, b]) => a && !b);
    const big = Math.min(g.w, g.h) * E.k >= 46;
    return HANDLES.filter(([a, b]) => el.t === 'logo' ? a && b : el.t === 'texto' ? a && (b || g.w * E.k >= 46) : (a && b) || big);
  }
  function geoCaja(el, W, H) { const w = el.w * W, h = el.h * H; return { cx: el.x * W + w / 2, cy: el.y * H + h / 2, w, h, a: (el.rot || 0) * Math.PI / 180 }; }
  // what the editor draws around an element and takes its clicks on (and the magnet's edges): a text's lines, not its box (D-043)
  function geo(el, W, H) {
    const g = geoCaja(el, W, H), c = el.t === 'texto' ? cenido(el, W) : null, o = c ? 0 : bordeFuera(el, W);   // a photo: with its border «Fuera» (D-047)
    return c ? { ...g, cx: g.cx + c.o * Math.cos(g.a), cy: g.cy + c.o * Math.sin(g.a), w: c.w } : o ? { ...g, w: g.w + 2 * o, h: g.h + 2 * o } : g;
  }
  // a text's lines across: as wide as the longest one (a pill's, with its padding), where its alignment draws them; o, their
  // centre from the box's. The box's width (el.w) is still where its lines break. Empty, null: the whole box
  const CENIDO = new Map();
  function cenido(el, W) {
    const f = el.font || {}, key = [el.txt, el.size, el.w, el.ls, el.lh, el.may ? 1 : 0, el.pil ? 1 : 0, el.al, f.file || f.css || '', f.w, el.peso, f.file ? (fuente(f).ok ? 1 : 0) : 1, W].join('|');
    if (CENIDO.has(key)) return CENIDO.get(key);
    MC.save();
    const L = lineas(MC, el, W), fw = el.w * W, px = L.pil ? L.pil.x : 0, lw = L.out.some(s => s.trim()) ? Math.max(0, ...L.out.map(s => medir(MC, s, L.ls))) + 2 * px : 0;
    MC.restore();
    const w = L.pil ? Math.min(fw, lw) : lw, c = w > 0 ? { w, o: el.al === 'der' ? (fw - w) / 2 : el.al === 'cen' ? 0 : -(fw - w) / 2 } : null;
    if (CENIDO.size > 500) CENIDO.clear();
    CENIDO.set(key, c);
    return c;
  }
  function local(g, p) { const dx = p.x - g.cx, dy = p.y - g.cy, c = Math.cos(-g.a), s = Math.sin(-g.a); return { x: dx * c - dy * s, y: dx * s + dy * c }; }
  function world(g, l) { const c = Math.cos(g.a), s = Math.sin(g.a); return { x: g.cx + l.x * c - l.y * s, y: g.cy + l.x * s + l.y * c }; }
  function aabb(el, W, H, caja) { const g = (caja ? geoCaja : geo)(el, W, H), ps = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => world(g, { x: a * g.w / 2, y: b * g.h / 2 })); const xs = ps.map(p => p.x), ys = ps.map(p => p.y); return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) }; }
  // caja: the elements' boxes (a format's change places them as before D-043), not what the editor shows of them
  function union(els, W, H, caja) { const bs = els.map(e => aabb(e, W, H, caja)); return { l: Math.min(...bs.map(b => b.l)), r: Math.max(...bs.map(b => b.r)), t: Math.min(...bs.map(b => b.t)), b: Math.max(...bs.map(b => b.b)) }; }
  // a thin line still takes a click a few screen pixels around it
  const inside = (el, p) => { const { W, H } = E.sz, g = geo(el, W, H), l = local(g, p), m = 6 / E.k; return Math.abs(l.x) <= Math.max(g.w / 2, m) && Math.abs(l.y) <= Math.max(g.h / 2, m); };
  function hitEl(p) { const c = compAt(E.i); for (let k = c.els.length - 1; k >= 0; k--) if (!c.els[k].oculto && inside(c.els[k], p)) return c.els[k]; return null; }
  function hitHandle(el, p) {
    const { W, H } = E.sz, g = geo(el, W, H), l = local(g, p), r = 10 / E.k;
    if (Math.hypot(l.x, l.y + g.h / 2 + ROT_D / E.k) <= r) return { rot: true };
    for (const [hx, hy] of asas(el, g)) if (Math.abs(l.x - hx * g.w / 2) <= r && Math.abs(l.y - hy * g.h / 2) <= r) return { hx, hy };
    return null;
  }
  // the magnet: slide edges and centre, the kit's margin, the post's guides (while shown; not the one being dragged, sin)
  // and the other elements' edges and centres
  function targets(skip, sin) {
    const { W, H } = E.sz, xs = [0, W / 2, W], ys = [0, H / 2, H];
    if (E.margen) { const m = E.margen * W; xs.push(m, W - m); ys.push(m, H - m); }
    if (E.reglas) for (const k of ['x', 'y']) E.guias[k].forEach((v, i) => { if (!(sin && sin.eje === k && sin.i === i)) (k === 'x' ? xs : ys).push(v / PX); });
    for (const o of compAt(E.i).els) if (!skip.includes(o.id) && !o.oculto) { const b = aabb(o, W, H); xs.push(b.l, (b.l + b.r) / 2, b.r); ys.push(b.t, (b.t + b.b) / 2, b.b); }
    return { xs, ys };
  }
  function nearest(vals, cands) {     // the smallest move that puts one of vals on a candidate (within SNAP)
    let best = null;
    for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) * E.k <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c }; }
    return best;
  }
  const mejor = (a, b) => !a ? b : !b ? a : Math.abs(b.d) < Math.abs(a.d) ? b : a;   // the nearer of two snaps (a on a tie)
  // ---------- the magnet's measures (px of a 1080-wide slide), only while dragging or resizing ----------
  const casi = (a, b) => Math.abs(a - b) * PX < 0.5;   // the same measure, to the pixel
  function cajas(skip) { const { W, H } = E.sz; return compAt(E.i).els.filter(o => !skip.includes(o.id) && !o.oculto).map(o => aabb(o, W, H)); }
  const cruzaY = (a, o) => o.t < a.b - 0.5 && o.b > a.t + 0.5, cruzaX = (a, o) => o.l < a.r - 0.5 && o.r > a.l + 0.5;
  function vecinos(b, bs) {          // the nearest box on each side of b, among those facing it
    let L = null, R = null, T = null, B = null;
    for (const o of bs) {
      if (cruzaY(b, o)) { if (o.r <= b.l + 0.5 && (!L || o.r > L.r)) L = o; if (o.l >= b.r - 0.5 && (!R || o.l < R.l)) R = o; }
      if (cruzaX(b, o)) { if (o.b <= b.t + 0.5 && (!T || o.b > T.b)) T = o; if (o.t >= b.b - 0.5 && (!B || o.t < B.t)) B = o; }
    }
    return { L, R, T, B };
  }
  function huecos(bs) {              // the gaps between neighbouring boxes: across (x) and down (y)
    const x = [], y = [];
    for (const a of bs) {
      let r = null, d = null;
      for (const o of bs) {
        if (o === a) continue;
        if (cruzaY(a, o) && o.l >= a.r + 0.5 && (!r || o.l < r.l)) r = o;
        if (cruzaX(a, o) && o.t >= a.b + 0.5 && (!d || o.t < d.t)) d = o;
      }
      if (r) x.push({ g: r.l - a.r, a, b: r });
      if (d) y.push({ g: d.t - a.b, a, b: d });
    }
    return { x, y };
  }
  function iguales(b, bs, hs) {      // where b's first edge (xa, ya) or last (xz, yz) leaves a gap the same as one between two other boxes, or the same on both sides
    const v = vecinos(b, bs), o = { xa: [], xz: [], ya: [], yz: [] };
    for (const q of hs.x) { if (v.L) o.xa.push(v.L.r + q.g); if (v.R) o.xz.push(v.R.l - q.g); }
    for (const q of hs.y) { if (v.T) o.ya.push(v.T.b + q.g); if (v.B) o.yz.push(v.B.t - q.g); }
    if (v.L && v.R) o.xa.push((v.L.r + v.R.l - (b.r - b.l)) / 2);
    if (v.T && v.B) o.ya.push((v.T.b + v.B.t - (b.b - b.t)) / 2);
    return o;
  }
  // what the magnet shows around b: on each side the distance to the nearest box (or to the slide's edge), in violet when it
  // equals another gap (that one too) or the other side; resizing (tam), the elements of the same width or height
  function medidas(b, skip, tam) {
    const { W, H } = E.sz, bs = cajas(skip), hs = huecos(bs), v = vecinos(b, bs), out = [], refs = new Set();
    const mid = (a1, a2, c1, c2) => (Math.max(a1, c1) + Math.min(a2, c2)) / 2;
    const pon = (x1, y1, x2, y2, g, igual) => { if (g * PX >= 0.5) out.push({ x1, y1, x2, y2, v: g, igual }); };
    const lado = (o, g, otro, lista) => { if (!o) return false; const eq = lista.filter(q => casi(q.g, g)); eq.forEach(q => refs.add(q)); return eq.length > 0 || (otro != null && casi(g, otro)); };
    const gL = v.L ? b.l - v.L.r : b.l, gR = v.R ? v.R.l - b.r : W - b.r, gT = v.T ? b.t - v.T.b : b.t, gB = v.B ? v.B.t - b.b : H - b.b;
    const yL = v.L ? mid(b.t, b.b, v.L.t, v.L.b) : (b.t + b.b) / 2, yR = v.R ? mid(b.t, b.b, v.R.t, v.R.b) : (b.t + b.b) / 2;
    const xT = v.T ? mid(b.l, b.r, v.T.l, v.T.r) : (b.l + b.r) / 2, xB = v.B ? mid(b.l, b.r, v.B.l, v.B.r) : (b.l + b.r) / 2;
    pon(b.l - gL, yL, b.l, yL, gL, lado(v.L, gL, v.R ? gR : null, hs.x));
    pon(b.r, yR, b.r + gR, yR, gR, lado(v.R, gR, v.L ? gL : null, hs.x));
    pon(xT, b.t - gT, xT, b.t, gT, lado(v.T, gT, v.B ? gB : null, hs.y));
    pon(xB, b.b, xB, b.b + gB, gB, lado(v.B, gB, v.T ? gT : null, hs.y));
    for (const q of refs) {
      if (hs.x.includes(q)) { const y = mid(q.a.t, q.a.b, q.b.t, q.b.b); pon(q.a.r, y, q.b.l, y, q.g, true); }
      else { const x = mid(q.a.l, q.a.r, q.b.l, q.b.r); pon(x, q.a.b, x, q.b.t, q.g, true); }
    }
    if (tam) for (const [k, n, lim] of [['ancho', o => o.r - o.l, W], ['alto', o => o.b - o.t, H]]) {
      if (!tam[k]) continue;
      const igual = bs.filter(o => n(o) < lim - 0.5 && casi(n(o), n(b)));   // not a box as wide as the slide: its edges say it already
      if (igual.length) [b, ...igual].forEach(o => out.push({ [k]: o, v: n(o), igual: true }));
    }
    return out;
  }
  function dibujarCotas(x) {         // a measure: a line with ends and its value in a label that reads on light and dark photos
    const u = 1 / E.k, { W, H } = E.sz;
    const cx = E.guides.some(g => g.x != null && Math.abs(g.x - W / 2) < 1e-6), cy = E.guides.some(g => g.y != null && Math.abs(g.y - H / 2) < 1e-6);
    x.save(); x.lineWidth = u; x.font = `600 ${11 * u}px -apple-system, "Helvetica Neue", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const c of E.cotas) {
      let { x1, y1, x2, y2 } = c;
      if (c.ancho) { const o = c.ancho, y = o.b + 18 * u <= H ? o.b + 9 * u : o.b - 9 * u; x1 = o.l; x2 = o.r; y1 = y2 = y; }
      if (c.alto) { const o = c.alto, xx = o.r + 18 * u <= W ? o.r + 9 * u : o.r - 9 * u; y1 = o.t; y2 = o.b; x1 = x2 = xx; }
      const col = c.igual ? IGUAL : ROSA, hz = y1 === y2, t = 4 * u;
      x.strokeStyle = col; x.beginPath();
      if (c.igual || !(hz ? cy && Math.abs(y1 - H / 2) < 1e-6 : cx && Math.abs(x1 - W / 2) < 1e-6)) { x.moveTo(x1, y1); x.lineTo(x2, y2); }   // on the centre line shown: only its ends and value
      if (hz) { x.moveTo(x1, y1 - t); x.lineTo(x1, y1 + t); x.moveTo(x2, y2 - t); x.lineTo(x2, y2 + t); }
      else { x.moveTo(x1 - t, y1); x.lineTo(x1 + t, y1); x.moveTo(x2 - t, y2); x.lineTo(x2 + t, y2); }
      x.stroke();
      etiqueta(x, String(Math.round(c.v * PX)), (x1 + x2) / 2, (y1 + y2) / 2, col);
    }
    x.restore();
  }
  function etiqueta(x, s, cx, cy, col) {   // white on colour, with a soft shadow: legible on any photo (the font is set by the caller)
    const u = 1 / E.k, w = x.measureText(s).width + 10 * u, h = 16 * u, { W, H } = E.sz;
    cx = clamp(cx, w / 2 + 2 * u, W - w / 2 - 2 * u); cy = clamp(cy, h / 2 + 2 * u, H - h / 2 - 2 * u);   // whole inside the slide
    x.save(); x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 3; x.fillStyle = col; x.beginPath();
    if (x.roundRect) x.roundRect(cx - w / 2, cy - h / 2, w, h, 4 * u); else x.rect(cx - w / 2, cy - h / 2, w, h);
    x.fill(); x.restore(); x.fillStyle = '#fff'; x.fillText(s, cx, cy + 0.5 * u);
  }
  // ---------- «Guías»: rulers in px of a 1080-wide slide and the post's guides (the same on all its slides) ----------
  // Never in a rendered slide: only the editor's canvas draws them. Closed, they neither show nor attract.
  // «Zona del grid» (⌘P): on the cover, what the Instagram profile crops when it shows it in 3:4, centred, darkened. Only here:
  // never in the thumbnails, the preview, «Aplicar» or the feed
  function zonaGrid(W, H) {
    if (E.historia) { const t = H * 250 / 1920, b = H * 340 / 1920, l = W * 65 / 1080; return [[0, 0, W, t], [0, H - b, W, b], [0, t, l, H - t - b], [W - l, t, l, H - t - b]]; }   // a story: Instagram's own bars (D-055)
    const r = W / H; if (Math.abs(r / 0.75 - 1) <= 0.005) return [];
    if (r > 0.75) { const s = (W - H * 0.75) / 2; return [[0, 0, s, H], [W - s, 0, s, H]]; }
    const s = (H - W / 0.75) / 2; return [[0, 0, W, s], [0, H - s, W, s]];
  }
  function verZona(x, W, H) { x.save(); x.fillStyle = 'rgba(0,0,0,.55)'; for (const [a, b, c, d] of zonaGrid(W, H)) x.fillRect(a, b, c, d); x.restore(); }
  function zona(on) {
    E.zona = on; lsPoner(E.historia ? LS_ZH : LS_ZG, on ? '1' : '0'); head(); pedir();
    if (!on || !E.sl.length || E.historia) return;
    if (E.i !== 0) I().toast('Zona del grid: se ve en la portada, la diapositiva 1.');
    else { const { W, H } = sizeAt(0); if (!zonaGrid(W, H).length) I().toast('En 3:4 el perfil no recorta nada.'); }
  }
  function guias(on) {
    E.reglas = on; lsPoner(LS_RG, on ? '1' : '0');
    E.scroll.classList.toggle('reglas', on); E.el.querySelectorAll('.lb-rx, .lb-ry').forEach(r => { r.hidden = !on; });
    head(); pedir();
  }
  function hitGuia(p) {
    const { W, H } = E.sz, r = 4 / E.k;
    for (const k of ['x', 'y']) for (let i = E.guias[k].length - 1; i >= 0; i--) { const v = E.guias[k][i] / PX; if (k === 'x' ? v <= W && Math.abs(p.x - v) <= r : v <= H && Math.abs(p.y - v) <= r) return { eje: k, i }; }
    return null;
  }
  function guiaDown(e) {             // from a ruler, a new guide: the top one across, the left one down
    if (e.button !== 0 || E.busy || !E.sl.length || !E.reglas) return;
    E.drag = { t: 'guia', eje: e.currentTarget.classList.contains('lb-rx') ? 'y' : 'x', i: null, v: null, fuera: true };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    e.preventDefault();
  }
  function moverGuia(d, p, e) {      // a guide follows the pointer (and the magnet); out of the slide it goes
    const { W, H } = E.sz, x = d.eje === 'x', lim = x ? W : H;
    let v = x ? p.x : p.y;
    d.fuera = v < 0 || v > lim;
    if (!d.fuera && E.iman && !(e.metaKey || e.ctrlKey)) { const t = targets([], d), s = nearest([v], x ? t.xs : t.ys); if (s) v = s.at; }
    d.v = clamp(v, 0, lim); pedir();
  }
  function soltarGuia(d) {
    if (d.v == null) return;         // a click: nothing changes
    const a = E.guias[d.eje];
    if (d.i != null) a.splice(d.i, 1);
    if (!d.fuera) a.push(Math.round(d.v * PX * 10) / 10);
    head();
  }
  function verGuias(x, W, H) {
    const u = 1 / E.k, d = E.drag && E.drag.t === 'guia' ? E.drag : null, linea = (k, v) => { x.beginPath(); if (k === 'x') { x.moveTo(v, 0); x.lineTo(v, H); } else { x.moveTo(0, v); x.lineTo(W, v); } x.stroke(); };
    x.save(); x.strokeStyle = GUIA; x.lineWidth = u;
    for (const k of ['x', 'y']) E.guias[k].forEach((v, i) => { if (!(d && d.eje === k && d.i === i && d.v != null)) linea(k, v / PX); });
    if (d && d.v != null && !d.fuera) {
      linea(d.eje, d.v);
      x.font = `600 ${11 * u}px -apple-system, "Helvetica Neue", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      etiqueta(x, String(Math.round(d.v * PX)), d.eje === 'x' ? d.v : 22 * u, d.eje === 'x' ? 14 * u : d.v, GUIA);
    }
    x.restore();
  }
  function reglas() {                // the rulers along the slide's top and left edges, with the guides marked on them
    const cw = E.cv.clientWidth, ch = E.cv.clientHeight, s = E.k / PX, { H } = E.sz, d = E.drag && E.drag.t === 'guia' ? E.drag : null;
    const paso = [50, 100, 200, 500, 1000].find(q => q * s >= 44) || 1000, sub = paso / (paso * s / 5 >= 6 ? 5 : 2);
    for (const [cv, horiz] of [[E.el.querySelector('.lb-rx'), true], [E.el.querySelector('.lb-ry'), false]]) {
      const dpr = window.devicePixelRatio || 1, w = horiz ? cw : RG, h = horiz ? RG : ch, max = horiz ? 1080 : H * PX;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
      const x = cv.getContext('2d'), col = getComputedStyle(cv).color;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
      x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 1; x.font = '9px -apple-system, "Helvetica Neue", sans-serif'; x.textBaseline = 'top';
      x.beginPath();
      for (let v = 0; v <= max + 0.01; v += sub) {
        const at = Math.round(v * s) + 0.5, big = Math.abs(v / paso - Math.round(v / paso)) < 1e-6, l = big ? 8 : 4;
        if (horiz) { x.moveTo(at, RG); x.lineTo(at, RG - l); } else { x.moveTo(RG, at); x.lineTo(RG - l, at); }
        if (big) { if (horiz) x.fillText(String(Math.round(v)), at + 2, 1); else { x.save(); x.translate(1, at + 2); x.rotate(Math.PI / 2); x.fillText(String(Math.round(v)), 0, -10); x.restore(); } }
      }
      x.stroke();
      const k = horiz ? 'x' : 'y', marcas = E.guias[k].map((v, i) => (d && d.eje === k && d.i === i && d.v != null ? null : v)).filter(v => v != null);
      if (d && d.eje === k && d.v != null && !d.fuera) marcas.push(d.v * PX);
      x.fillStyle = GUIA;
      for (const v of marcas) { const at = v * s; x.beginPath(); if (horiz) { x.moveTo(at - 5, 0); x.lineTo(at + 5, 0); x.lineTo(at, 7); } else { x.moveTo(0, at - 5); x.lineTo(0, at + 5); x.lineTo(7, at); } x.fill(); }
    }
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
      if (x.comp && x.rat && Math.abs(x.rat - r) > 0.005) aProporcion(x.comp, W, Math.round(W / x.rat), H);   // as «Aplicar»'s check: a 1080 copy is the same proportion
      x.rat = r;
    });
  }
  // A composition keeps its origin, comp.origen = {rat, els: {id: {g, p, m}}}: where each text, shape and logo was (g) in the
  // proportion it was laid out in (rat), the place the last change of proportion gave it (p) and what that change did to it
  // (m, reubicar). Every change starts from the origin, never from the last one (k shrinks when zones would overlap, so one
  // change does not undo another): back in that proportion each one is exactly as it was, and a round trip through any
  // other changes nothing. One resized or restyled since (p no longer matches) gets its origin from where it is now, that
  // change undone (alOrigen); one added since takes its place now as its origin. The others are not touched.
  const SITIO = ['x', 'y', 'w', 'h', 'size', 'b'];
  function sitio(e) { const o = {}; SITIO.forEach(k => { if (e[k] != null) o[k] = e[k]; }); if (e.t === 'hueco') o.ts = (e.textos || []).map(t => t.size); return o; }
  function ponerSitio(e, o) { SITIO.forEach(k => { if (o[k] != null) e[k] = o[k]; }); if (o.ts) (e.textos || []).forEach((t, n) => { if (o.ts[n] != null) t.size = o.ts[n]; }); return e; }
  const puesto = e => { const o = sitio(e); if (e.t === 'texto') delete o.h; return JSON.stringify(o); };   // a text's height follows its font
  function aProporcion(comp, W, H0, H1) {
    const mano = new Set(comp.els.filter(e => e.mano).map(e => e.g || e.id));   // a block moved by hand stays where it is
    const mov = comp.els.filter(e => e.t !== 'foto' && !mano.has(e.g || e.id));
    if (!mov.length) { delete comp.origen; return; }
    const o = comp.origen && comp.origen.rat > 0 && comp.origen.els ? comp.origen : (comp.origen = { rat: W / H0, els: {} }), Ho = Math.round(W / o.rat);
    for (const id of Object.keys(o.els)) if (!comp.els.some(e => e.id === id)) delete o.els[id];
    for (const e of mov) { const q = o.els[e.id]; if (!q) o.els[e.id] = { g: sitio(e) }; else if (q.p !== puesto(e)) q.g = alOrigen(e, q.m, W, H0, Ho); }
    const c = { els: comp.els.map(e => mov.includes(e) ? ponerSitio(clone(e), o.els[e.id].g) : e) };   // the slide as it was in its origin
    const hecho = Math.abs(o.rat - W / H1) > 0.005 ? reubicar(c, W, Ho, H1) : new Map();
    mov.forEach(e => {
      const q = c.els[comp.els.indexOf(e)], s = o.els[e.id], m = hecho.get(q);
      ponerSitio(e, sitio(q)); s.p = puesto(e); if (m) s.m = m.map(r4); else delete s.m;
    });
  }
  function alOrigen(e, m, W, H, Ho) {   // where e is now on W×H, the last change (m) undone: its place on the origin's W×Ho
    const g = sitio(e); if (!m) return g;   // that change kept its fractions (a background, or no change)
    const [ax, bx, k, cy] = m;
    Object.assign(g, { x: r4((e.x * W - bx) / ax / W), w: r4(e.w / ax), y: r4((e.y * H - cy) / k / Ho), h: r4(e.h * H / k / Ho) });
    if (g.size != null) g.size = r4(g.size / k);
    if (g.b) g.b = r4(g.b / k);
    if (g.ts) g.ts = g.ts.map(v => r4((v || 0.06) / k));
    return g;
  }
  // From W×H0 to W×H1. Each block — an element, or a group — that is not a photo, not a background (half the slide or more)
  // and not moved by hand keeps its zone (top, middle or bottom of the slide) and scales by k: k is the ratio of the short
  // sides, less when the zones would overlap or go past a margin of 4 % of the short side. Across, a text keeps its
  // alignment edge and its line breaks (box and letters scale alike), a small shape or logo keeps the side of the slide it
  // is on (a text inside it goes with it) and a line or a bar keeps its length. Photos keep their own frame rules.
  function reubicar(comp, W, H0, H1) {   // always from a composition's origin (aProporcion)
    const grupos = new Map(), B = [], ancla = new Map();
    for (const e of comp.els) { if (e.t === 'foto') continue; const g = e.g || e.id; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(e); }
    for (const els of grupos.values()) {
      if (els.some(e => e.mano)) continue;
      const b = union(els, W, H0, true); if ((b.r - b.l) * (b.b - b.t) >= 0.5 * W * H0) continue;
      const cy = (b.t + b.b) / 2 / H0;
      B.push({ els, b, zy: cy < 0.4 ? 0 : cy > 0.6 ? 2 : 1 });
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
    if (!B.length) return new Map();
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
    const { Y } = plan(k), hecho = new Map();
    for (const q of B) for (const e of q.els) {
      const A = ancla.get(e), x0 = e.x * W, w0 = e.w * W;
      hecho.set(e, [A != null ? k : 1, A != null ? A * (1 - k) : 0, k, Y[q.zy](0)]);   // in px: x·ax + bx (w·ax), y·k + cy (h, size, borders ·k)
      if (A != null) Object.assign(e, { x: r4((A + (x0 - A) * k) / W), w: r4(w0 * k / W) });
      Object.assign(e, { y: r4(Y[q.zy](e.y * H0) / H1), h: r4(e.h * H0 * k / H1) });
      if (e.t === 'texto') e.size = r4((e.size || 0.06) * k);
      if ((e.t === 'forma' || e.t === 'hueco') && e.b) e.b = r4(e.b * k);
      if (e.t === 'hueco') (e.textos || []).forEach(t => { t.size = r4((t.size || 0.06) * k); });
    }
    return hecho;
  }
  function transformarHTML(els) {
    const fotos = els.filter(e => e.t === 'foto'); if (!fotos.length) return '';
    const e0 = fotos.find(e => e.id === E.sel) || fotos[0], { W, H } = sizeAt(E.i), nom = e => e.rat || ratLista(e, W, H), r0 = nom(e0);
    const ori = E.tOri || (r0 ? (RATIOS.h.some(([n]) => n === r0) && r0 !== '1:1' ? 'h' : 'v') : e0.w * W > e0.h * H * 1.01 ? 'h' : 'v');
    const rat = fotos.every(e => nom(e) === r0) ? r0 : null, off = fotos.every(e => e.lock);
    return `<div class="lb-sec"><h4>Proporción del marco${fotos.length > 1 ? ` <span>· de las ${fotos.length} fotos</span>` : ''}</h4>${seg('t-ori', [['v', 'Vertical'], ['h', 'Horizontal']], ori)}`
      + `<div class="lb-btns">${RATIOS[ori].map(([n, r]) => `<button type="button" class="btn2${rat === n ? ' on' : ''}" data-lb="t-rat" data-v="${n}" data-r="${r}"${off ? ' disabled' : ''}>${n}</button>`).join('')}</div>`
      + (fotos.length === 1 && !RATIOS[ori].some(([n]) => n === rat) ? `<p class="lb-p lb-ratp">${esc(ratTxt(e0, W, H))}</p>` : '')
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
    c.els = [...cs.map((q, k) => { const o = old[k], e = fotoEl(fotos[k] || null); if (o) Object.assign(e, { b: o.b, bc: o.bc, r: o.r, sh: o.sh, op: o.op ?? 1 }, o.bo ? { bo: o.bo } : {}); return Object.assign(e, { x: r4(q.x / W), y: r4(q.y / H), w: r4(q.w / W), h: r4(q.h / H) }); }), ...otros];
    c.rej = { n: name, g };
  }
  function separar(c, g) {             // the gap of the grid in place: same photos, same cells
    const { W, H } = sizeAt(E.i), cs = cells(c.rej.n, W, H, g * W);
    fotosDe(c).forEach((e, k) => { const q = cs[k]; if (!q) return; Object.assign(e, { x: r4(q.x / W), y: r4(q.y / H), w: r4(q.w / W), h: r4(q.h / H), rot: 0 }); if (e.hueco) Object.assign(e.hueco, { x: e.x, y: e.y, w: e.w, h: e.h, rot: 0 }); delete e.fit; delete e.rat; if (e.src) setPhoto(e, {}); });
    c.rej.g = g;
  }

  // ---------- pointer ----------
  function toSlide(e) { const r = E.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / E.k, y: (e.clientY - r.top) / E.k }; }
  function onDown(e) {
    if (e.button !== 0 || E.busy || !E.sl.length) return;
    E.el.focus({ preventScroll: true });
    const p = toSlide(e), sel = selEl();
    if (E.cambio) { e.preventDefault(); const t = huecosCambio().reverse().find(q => inside(areaHueco(q), p)); if (t) intercambiar(t.id); else salirCambio(); return; }   // «Intercambiar» waits for a hole: any other click cancels it
    let d = null;
    if (E.crop) { const el = compAt(E.i).els.find(x => x.id === E.crop); if (el && inside(el, p)) d = { t: 'pan', id: el.id, p0: p, el0: clone(el) }; else { E.crop = null; panel(); } }
    if (!d && sel && !sel.lock && !multi() && !e.shiftKey) { const h = hitHandle(sel, p); if (h) d = h.rot ? { t: 'rot', id: sel.id, el0: clone(sel) } : { t: 'size', id: sel.id, el0: clone(sel), hx: h.hx, hy: h.hy }; }
    if (!d && E.reglas && !e.shiftKey) { const g = hitGuia(p); if (g) d = { t: 'guia', eje: g.eje, i: g.i, v: null }; }   // a guide over an element: the guide
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
    if (d.t === 'guia') { moverGuia(d, p, e); return; }
    if (!d.step) { if (d.lock || (d.t === 'move' && Math.hypot(p.x - d.p0.x, p.y - d.p0.y) * E.k < 3)) return; paso(); ensure(); d.step = true; if (d.t !== 'pan') aMano(d.t === 'move' ? d.el0s.map(o => o.id) : [d.id]); }
    const els = compAt(E.i).els, el = els.find(x => x.id === d.id); if (!el) return;
    const mag = E.iman && !(e.metaKey || e.ctrlKey);
    E.guides = []; E.cotas = [];
    if (d.t === 'move') {
      let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      const ids = d.el0s.map(o => o.id), girado = d.el0s.some(o => o.rot);   // a turned element: lines as before, no measures
      if (mag && d.el0s.length) {
        const b = union(d.el0s, W, H), t = targets(ids);
        const lx = nearest([b.l + dx, (b.l + b.r) / 2 + dx, b.r + dx], t.xs), ly = nearest([b.t + dy, (b.t + b.b) / 2 + dy, b.b + dy], t.ys);
        let sx = lx, sy = ly;
        if (!girado) {                // or the same gap as between two other elements, or the same on both sides
          const bs = cajas(ids), ig = iguales({ l: b.l + dx, r: b.r + dx, t: b.t + dy, b: b.b + dy }, bs, huecos(bs));
          sx = mejor(lx, mejor(nearest([b.l + dx], ig.xa), nearest([b.r + dx], ig.xz)));
          sy = mejor(ly, mejor(nearest([b.t + dy], ig.ya), nearest([b.b + dy], ig.yz)));
        }
        if (sx) { dx += sx.d; if (sx === lx) E.guides.push({ x: sx.at }); }
        if (sy) { dy += sy.d; if (sy === ly) E.guides.push({ y: sy.at }); }
      }
      for (const o of d.el0s) { const q = els.find(x => x.id === o.id); if (q) { q.x = r4(o.x + dx / W); q.y = r4(o.y + dy / H); delete q.fit; } }
      if (mag && !girado && d.el0s.length) E.cotas = medidas(union(els.filter(q => ids.includes(q.id)), W, H), ids);
    } else if (d.t === 'size') {
      const g0 = geo(d.el0, W, H), cen = e.altKey, f = cen ? 2 : 1;   // ⌥: from the centre, the opposite side (or the four) moving too
      const A = cen ? { x: g0.cx, y: g0.cy } : world(g0, { x: -d.hx * g0.w / 2, y: -d.hy * g0.h / 2 }), ga = { ...g0, cx: A.x, cy: A.y }, l = local(ga, p), MIN = 0.03 * W;
      let w = g0.w, h = g0.h, eje = 'x';
      const prop = el.t === 'logo' || (d.hx && d.hy && (!e.shiftKey || el.t === 'texto'));
      if (prop) { const s = f * (l.x * d.hx * g0.w + l.y * d.hy * g0.h) / (g0.w * g0.w + g0.h * g0.h); w = g0.w * s; h = g0.h * s; if (w < MIN || h < MIN) { const k = MIN / Math.min(g0.w, g0.h); w = g0.w * k; h = g0.h * k; } }
      else { if (d.hx) w = Math.max(MIN, f * l.x * d.hx); if (d.hy) h = Math.max(el.t === 'forma' ? 2 : MIN, f * l.y * d.hy); delete el.rat; }   // a side: the frame is cropped, its format is no longer the one chosen
      if (mag && !el.rot) {           // the edges being dragged stick to the lines (slide, margin, guides, elements) or take another element's width or height
        const t = targets([el.id]), bs = cajas([el.id]);
        const tira = (dir, a0, n, cands, tams) => {   // the new size along one axis, and how far its edge moves for it
          const s = nearest(cen ? [a0 - n / 2, a0 + n / 2] : [a0 + dir * n], cands), q = nearest([n], tams);
          let r = s ? { n: (cen ? 2 : 1) * Math.abs(s.at - a0), d: Math.abs(s.d), at: s.at } : null;
          if (q && (!r || Math.abs(q.d) / f < r.d)) r = { n: q.at, d: Math.abs(q.d) / f, at: null };
          return r;
        };
        const sx = d.hx ? tira(d.hx, A.x, w, t.xs, bs.map(b => b.r - b.l)) : null, sy = d.hy ? tira(d.hy, A.y, h, t.ys, bs.map(b => b.b - b.t)) : null;
        if (prop) {                   // a corner: the axis whose edge is nearer; the other follows the proportion
          const s = sx && (!sy || sx.d <= sy.d) ? sx : sy, k = s ? s.n / (s === sx ? w : h) : 1;
          if (s && w * k >= MIN && h * k >= MIN) { w *= k; h *= k; eje = s === sx ? 'x' : 'y'; if (s.at != null) E.guides.push(s === sx ? { x: s.at } : { y: s.at }); }
        } else {
          if (sx && sx.n >= MIN) { w = sx.n; if (sx.at != null) E.guides.push({ x: sx.at }); }
          if (sy && sy.n >= (el.t === 'forma' ? 2 : MIN)) { h = sy.n; if (sy.at != null) E.guides.push({ y: sy.at }); }
        }
      }
      const o = bordeFuera(d.el0, W);   // a border «Fuera» (D-047): the frame is the box less the border; a corner keeps the photo's proportion
      if (o && prop) { if (eje === 'y') w = (g0.w - 2 * o) * (h - 2 * o) / (g0.h - 2 * o) + 2 * o; else h = (g0.h - 2 * o) * (w - 2 * o) / (g0.w - 2 * o) + 2 * o; }
      if (el.t === 'texto') {         // its lines were resized (D-043): a corner scales the text and the width they break at, a side sets that width (½ px over, so the longest line still fits)
        const s0 = d.el0.size || 0.06;
        if (prop) { el.size = r4(s0 * w / g0.w); el.w = r4(d.el0.w * el.size / s0 + 0.0005); } else el.w = r4(w / W + 0.0005);
        ajustarTexto(el, W, H);
        const c = cenido(el, W), cw = c ? c.w : el.w * W, o = c ? c.o : 0, hh = el.h * H, C = cen ? A : world(ga, { x: d.hx * cw / 2, y: d.hy * hh / 2 });
        el.x = r4((C.x - o * Math.cos(g0.a) - el.w * W / 2) / W); el.y = d.hy ? r4((C.y - o * Math.sin(g0.a) - hh / 2) / H) : d.el0.y; delete el.fit;   // a text keeps its top when only its width changes
      } else {
        const C = cen ? A : world(ga, { x: d.hx * w / 2, y: d.hy * h / 2 }), mw = Math.max(1, w - 2 * o), mh = Math.max(1, h - 2 * o);
        el.w = r4(mw / W); el.h = r4(mh / H); el.x = r4((C.x - mw / 2) / W); el.y = r4((C.y - mh / 2) / H); delete el.fit;
      }
      if (el.src) setPhoto(el, {});
      if (mag && !el.rot) E.cotas = medidas(aabb(el, W, H), [el.id], { ancho: !!d.hx, alto: !!d.hy });
    } else if (d.t === 'rot') {
      const g0 = geo(d.el0, W, H);
      let a = Math.atan2(p.y - g0.cy, p.x - g0.cx) * 180 / Math.PI + 90;
      a = ((a + 180) % 360 + 360) % 360 - 180;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else if (mag) for (const q of [-180, -90, 0, 90, 180]) if (Math.abs(a - q) < 4) a = q;
      el.rot = Math.round(a * 10) / 10; if (el.rot === -180) el.rot = 180;
      const c = el.t === 'texto' && cenido(el, W);   // a text turns around its lines' centre, where its frame is (D-043)
      if (c && c.o) { const r = el.rot * Math.PI / 180; el.x = r4((g0.cx - c.o * Math.cos(r)) / W - el.w / 2); el.y = r4((g0.cy - c.o * Math.sin(r)) / H - el.h / 2); }
      delete el.fit;
    } else if (d.t === 'pan') {
      const f = el.src && M.files[el.src]; if (!f) return;
      const g0 = geoCaja(d.el0, W, H), ib = hueco(d.el0, g0.w, g0.h), sr = srcRect(d.el0, f.w, f.h, ib.w, ib.h), s = ib.w / sr.w;
      const dl = local({ ...g0, cx: 0, cy: 0 }, { x: p.x - d.p0.x, y: p.y - d.p0.y });
      const ddx = d.el0.fx ? -dl.x : dl.x, ddy = d.el0.fy ? -dl.y : dl.y;
      setPhoto(el, { cx: d.el0.cx - ddx / s / f.w, cy: d.el0.cy - ddy / s / f.h });
    }
    if (d.t !== 'pan' && d.t !== 'rot' && E.sel === el.id) syncNums(el);
    pedir();
  }
  function onUp() {
    if (!E || !E.drag) return;
    const d = E.drag; E.drag = null; E.guides = []; E.cotas = [];
    if (d.t === 'guia') { soltarGuia(d); pedir(); return; }
    if (d.step) { despues(true); lista(); }
    else if (d.t === 'move') {
      const el = compAt(E.i).els.find(x => x.id === d.id);
      if (d.reduce && el) seleccionar(el);       // a click on one of several selected: only that one
      else if (el && el.t === 'foto' && !el.src && !d.lock && !multi()) E.pick = { modo: 'fill', id: el.id };
      else if (el && el.t === 'hueco' && !multi()) E.pick = { modo: 'fill', id: el.id };
    }
    panel(); pedir();
  }
  function cursor(e) {
    if (E.busy || !E.sl.length) return;
    if (E.esp && hayZoom()) { mano(); return; }
    const p = toSlide(e), sel = selEl();
    let c = 'default';
    if (E.cambio) { if (huecosCambio().some(q => inside(areaHueco(q), p))) c = 'pointer'; }
    else if (E.crop) { const el = compAt(E.i).els.find(x => x.id === E.crop); if (el && inside(el, p)) c = 'grab'; }
    else {
      const h = sel && !sel.lock && !multi() ? hitHandle(sel, p) : null;
      const g = !h && E.reglas ? hitGuia(p) : null;
      if (h) c = h.rot ? 'grab' : !h.hx ? 'ns-resize' : !h.hy ? 'ew-resize' : h.hx === h.hy ? 'nwse-resize' : 'nesw-resize';
      else if (g) c = g.eje === 'x' ? 'col-resize' : 'row-resize';
      else { const el = hitEl(p); if (el) c = el.lock ? 'pointer' : 'move'; }
    }
    if (E.cv.style.cursor !== c) E.cv.style.cursor = c;
  }
  function onDbl(e) {
    if (!E.sl.length || E.busy) return;
    const el = hitEl(toSlide(e)); if (!el || el.lock) return;
    if (el.t === 'texto') { seleccionar(el); E.pick = null; panel(); const ta = E.el.querySelector('.lb-panel textarea[data-lb="txt"]'); if (ta) { ta.focus(); ta.select(); } pedir(); return; }
    if (el.t !== 'foto' || !el.src) return;
    if (el.hueco && !el.pan) {   // a photo in a hole: covering it → whole inside it; with strips → covering it
      const { W, H } = sizeAt(E.i); E.crop = null; E.pick = null;
      mut(null, () => { const c = ensure(), x = c.els.find(q => q.id === el.id); if (!x) return; encajeHueco(x, W, H, !cubreHueco(x, W, H)); sinProvisional(c); seleccionar(x); });
      return;
    }
    seleccionar(el); E.crop = el.id; E.pick = null; panel(); pedir();
  }
  function onWheel(e) {
    if (!E) return;
    menuCtx(false);
    if (E.crop && e.target === E.cv && E.sl.length) {   // framing a photo: the wheel or a pinch on the slide zooms the photo
      const el = compAt(E.i).els.find(x => x.id === E.crop); if (!el) return;
      e.preventDefault(); mut('zoomfoto', () => { const c = ensure(), x = c.els.find(q => q.id === el.id); setPhoto(x, { z: (x.z || 1) * Math.exp(-e.deltaY * 0.0025) }); }, true); syncNums(selEl());
      return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();             // a pinch (ctrl + wheel) or ⌘ + wheel: never the page's zoom, anywhere in the editor
    if (E.sl.length && !E.busy && !escribiendo() && E.scroll.contains(e.target)) zoomEn(E.zoom * Math.exp(-e.deltaY * 0.01), e);
  }
  function onGesto(e) {             // Safari: the pinch comes as gestures, not as ctrl + wheel
    if (!E) return;
    e.preventDefault();
    if (e.type === 'gesturestart') { E.g0 = E.zoom; return; }
    if (E.sl.length && !E.busy && !escribiendo() && !(E.crop && e.target === E.cv) && E.scroll.contains(e.target)) zoomEn((E.g0 || E.zoom) * e.scale, e);
  }
  function zoom(z) { E.zoom = clamp(z, 0.4, 4); head(); pedir(); }
  function zoomEn(z, e) {           // zoom keeping the point under the pointer where it is (frame() moves the view once the size is new)
    const r = E.cv.getBoundingClientRect();
    E.zAncla = { cx: e.clientX, cy: e.clientY, x: (e.clientX - r.left) / E.k, y: (e.clientY - r.top) / E.k };
    zoom(z);
  }

  // ---------- the grey area around the slide: part of the editor ----------
  // a click deselects, a drag chooses what ends up inside its rectangle (⇧ adds), a double click is «Ajustar», a right
  // click opens a menu, space + drag moves the view. Nothing of it while writing in a text: a click there only ends it.
  const esTexto = t => !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio', 'color'].includes(t.type)));
  const escribiendo = () => { const t = document.activeElement; return esTexto(t) && t.tagName !== 'SELECT'; };   // a font list left focused is not writing
  function gris(e) {                // on the grey itself, not on the slide, the rulers, the bar or a scrollbar
    const sc = E.scroll, cvw = sc.firstElementChild;
    if (e.target !== sc && e.target !== cvw) return false;
    const r = sc.getBoundingClientRect();
    return e.clientX - r.left - sc.clientLeft < sc.clientWidth && e.clientY - r.top - sc.clientTop < sc.clientHeight;
  }
  const hayZoom = () => E.scroll.scrollWidth > E.scroll.clientWidth + 1 || E.scroll.scrollHeight > E.scroll.clientHeight + 1;
  function sobreGris() {            // the pointer is over the slide or the grey around it
    const p = E.ptr; if (!p || !E.allEl.hidden) return false;
    const r = E.scroll.getBoundingClientRect();
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }
  function mano() {                 // the cursor while space is held: a hand, if there is a view to move
    const c = E.esp && hayZoom() ? (E.vista ? 'grabbing' : 'grab') : '';
    E.scroll.style.cursor = c;
    if (c || /grab/.test(E.cv.style.cursor)) E.cv.style.cursor = c;   // let go: the slide's own cursor on the next move
  }
  function terminarEscritura() {    // the first click outside a text being written only ends the writing
    const t = document.activeElement; if (t && t.blur) t.blur();
    E.el.focus({ preventScroll: true }); E.finEscr = performance.now();
  }
  function grisDown(e) {
    if (!E || E.busy) return;
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {   // a right click (on a Mac also ctrl + click): the menu's, never a click
      if (gris(e) && escribiendo()) { e.preventDefault(); terminarEscritura(); E.sinMenu = performance.now(); }   // writing: it only ends it, no menu
      return;
    }
    if (E.esp && e.button === 0) {  // space + drag: the view moves
      e.preventDefault(); e.stopPropagation();
      if (hayZoom()) { E.vista = { x: e.clientX, y: e.clientY, l: E.scroll.scrollLeft, t: E.scroll.scrollTop }; try { E.scroll.setPointerCapture(e.pointerId); } catch (er) { /* */ } mano(); }
      return;
    }
    if (e.button !== 0 || !gris(e)) return;
    e.preventDefault();
    if (E.cmOn) { menuCtx(false); E.finEscr = performance.now(); return; }   // a click with the menu open only closes it
    if (escribiendo()) { terminarEscritura(); return; }
    if (performance.now() - E.finEscr < 600) return;     // the second click of a double click that ended the writing (or closed the menu)
    E.el.focus({ preventScroll: true });
    if (!E.sl.length) return;
    E.marq = { p0: toSlide(e), x0: e.clientX, y0: e.clientY, add: e.shiftKey, ids0: e.shiftKey ? selIds() : [], on: false };
    try { E.scroll.setPointerCapture(e.pointerId); } catch (er) { /* */ }
  }
  function grisMove(e) {
    if (!E) return;
    if ((E.vista || E.marq) && e.type === 'pointermove' && !(e.buttons & 1)) { grisUp(null); return; }   // its pointerup was lost
    if (E.vista) { E.scroll.scrollLeft = E.vista.l - (e.clientX - E.vista.x); E.scroll.scrollTop = E.vista.t - (e.clientY - E.vista.y); return; }
    const m = E.marq; if (!m) return;
    if (!m.on && Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < 3) return;
    m.on = true; m.p1 = toSlide(e);
    marcarRect(m);
  }
  function grisUp(e) {
    if (!E) return;
    const fin = !!e && e.type === 'pointerup';   // where it was let go counts too (a drag can end with no move seen)
    if (E.vista) { if (fin) grisMove(e); E.vista = null; mano(); return; }
    const m = E.marq; if (!m) return;
    if (fin) grisMove(e);
    E.marq = null;
    const d = E.el.querySelector('.lb-marq'); if (d) d.remove();
    if (fin && !m.on && !m.add) { soltar(); E.pick = null; E.crop = null; }   // a click on the grey (not a cancelled one): nothing chosen
    panel(); pedir();
  }
  function marcarRect(m) {          // the rectangle on screen (only over the grey and the slide) and what is inside it, chosen
    const a = { l: Math.min(m.p0.x, m.p1.x), r: Math.max(m.p0.x, m.p1.x), t: Math.min(m.p0.y, m.p1.y), b: Math.max(m.p0.y, m.p1.y) };
    const rc = E.cv.getBoundingClientRect(), rs = E.scroll.getBoundingClientRect(), k = E.k;
    const L = Math.max(rs.left, rc.left + a.l * k), R = Math.min(rs.right, rc.left + a.r * k), T = Math.max(rs.top, rc.top + a.t * k), B = Math.min(rs.bottom, rc.top + a.b * k);
    let d = E.el.querySelector('.lb-marq');
    if (!d) { d = document.createElement('div'); d.className = 'lb-marq'; E.el.append(d); }
    Object.assign(d.style, { left: L + 'px', top: T + 'px', width: Math.max(0, R - L) + 'px', height: Math.max(0, B - T) + 'px' });
    const c = compAt(E.i), { W, H } = E.sz;
    const dentro = el => { const b = aabb(el, W, H); return b.l >= a.l && b.r <= a.r && b.t >= a.t && b.b <= a.b; };
    const ids = new Set();           // hidden or locked ones on their own, never; a group whole, as a click, when all its visible ones are inside
    for (const el of c.els) {
      if (!el.g) { if (!el.oculto && !el.lock && dentro(el)) ids.add(el.id); continue; }
      const gr = c.els.filter(q => q.g === el.g), vis = gr.filter(q => !q.oculto);
      if (vis.length && vis.every(dentro)) gr.forEach(q => ids.add(q.id));
    }
    const all = [...m.ids0, ...[...ids].filter(id => !m.ids0.includes(id))];
    E.sel = all[0] || null; E.mas = all.slice(1); E.crop = null; E.pick = null;
    pedir();
  }
  function onCtx(e) {               // a right click on the grey: «Pegar», «Pegar estilo», «Añadir texto», «Añadir forma»
    if (!E) return;
    menuCtx(false);
    if (!gris(e)) return;           // on the slide or the panel: the browser's menu, as before
    e.preventDefault();
    if (E.marq) { E.marq = null; const d = E.el.querySelector('.lb-marq'); if (d) d.remove(); }
    if (E.busy || performance.now() - (E.sinMenu || -1e4) < 1000) return;
    if (escribiendo()) { terminarEscritura(); return; }
    const cb = clip(), hay = E.sl.length > 0;
    const est = !!(ESTILO && ESTILO.client === E.board.client && selEls().some(q => q.t === 'texto' && !q.lock));
    const it = (lb, txt, kb, on, v) => `<button type="button" role="menuitem" data-lb="${lb}"${v ? ` data-v="${v}"` : ''}${on ? '' : ' disabled'}>${txt}<span class="lb-kb">${kb}</span></button>`;
    const m = E.el.querySelector('.lb-cm');
    m.innerHTML = it('paste', 'Pegar', '⌘V', !!cb && (!!cb.slide || hay)) + it('paste-est', 'Pegar estilo', '⌥⌘V', est && hay)
      + it('add-txt', 'Añadir texto', 'T', hay) + it('add-forma', 'Añadir forma', 'R', hay, 'rect');
    m.hidden = false; E.cmOn = true;
    const w = m.offsetWidth, h = m.offsetHeight, vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    m.style.left = Math.max(4, Math.min(e.clientX, vw - w - 4)) + 'px'; m.style.top = Math.max(4, Math.min(e.clientY, vh - h - 4)) + 'px';
    const b = m.querySelector('button:not(:disabled)'); if (b) b.focus({ preventScroll: true });
  }
  function menuCtx(on) {
    if (!E || (!on && !E.cmOn)) return;
    E.cmOn = on; const m = E.el.querySelector('.lb-cm'); m.hidden = !on;
    if (!on && m.contains(document.activeElement)) E.el.focus({ preventScroll: true });
  }

  // ---------- the panel ----------
  const pxf = v => Math.round(v) + ' px';
  const OUTF = { 'velo-op': pct, 'velo-alc': pct, 'tex-op': pct, b: v => (v * 100).toFixed(1) + ' %', r: pct, sh: pct, op: pct, z: v => (+v).toFixed(2) + '×', fit: pct, gap: v => (v * 100).toFixed(1) + ' %', size: v => pxf(v * 1080), lh: v => (+v).toFixed(2), ls: v => (+v).toFixed(2), gr: v => String(Math.round(v * 2) / 2).replace('.', ',') + ' px' };
  const rng = (act, label, v, min, max, step, mix) => `<label class="lb-rng${mix ? ' lb-mix' : ''}"><span>${label}</span><input type="range" data-lb="${act}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${mix ? 'Varios' : OUTF[act](v)}</output></label>`;
  const USO = { bg: 'fondo', tc: 'texto', fc: 'relleno', pc: 'relleno', bc: 'borde', 'velo-c': 'velo', lc: 'texto' };
  function sws(act, curC, orig) {  // «Kit <marca>» (its groups for this picker) and «Básicos»; a colour shows once, where it first appears; orig: no colour is a choice («Original»)
    const seen = new Set(), uso = USO[act], cc = hexOk(curC) ? curC.toLowerCase() : orig ? '' : '#ffffff';
    const nuevos = os => os.filter(o => !seen.has(o.c) && seen.add(o.c));
    const gs = (E.kit ? E.kit.grupos : []).filter(g => !g.usos || g.usos.includes(uso)).map(g => ({ n: g.n, os: nuevos(g.cols.map(k => ({ c: k.c, t: k.n + ' · ' + k.c }))) })).filter(g => g.os.length);
    const bas = nuevos(BASICOS.map(([c, n]) => ({ c, t: n + ' · ' + c })));
    const sw = o => `<button type="button" class="lb-sw${o.c === cc ? ' on' : ''}" style="background:${o.c}" data-lb="${act}" data-c="${o.c}" title="${esc(o.t)}" aria-label="${esc(o.t)}"></button>`;
    const fuera = 'Color actual · fuera de esta lista';   // an element's colour that this picker does not offer: kept, and shown so it can be replaced
    return '<div class="lb-cols">' + (seen.has(cc) || !cc ? '' : `<div class="lb-swf"><span class="lb-sw on" style="background:${cc}" role="img" title="${fuera} (${cc})" aria-label="${fuera} (${cc})"></span>${fuera}</div>`)
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
    (I().bandejaVista ? I().bandejaVista({ todas: false, sin: E.slotId }).map(x => x.f) : S.tray).forEach(add);   // the tray's, as «Sin usar» shows them (D-041)
    return out;
  }
  const NOMBRE = { foto: 'Foto', texto: 'Texto', logo: 'Logo', forma: 'Forma' };
  const FORMAS = { rect: 'Rectángulo', elipse: 'Círculo', linea: 'Línea', flecha: 'Flecha' };
  function nombreEl(e) {
    if (e.t === 'texto') { const t = String(e.txt || '').replace(/\s+/g, ' ').trim(); return `${e.num ? 'Numeración' : e.pil ? 'Píldora' : 'Texto'} <i>${e.num && !t ? 'oculta en la portada' : `«${esc(t.length > 24 ? t.slice(0, 23) + '…' : t || 'vacío')}»`}</i>`; }
    if (e.t === 'forma') return FORMAS[e.forma] || 'Forma';
    if (e.t === 'hueco') return 'Hueco de foto';
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
  const grosor = el => Math.round(el.h * sizeAt(E.i).H * PX / TRAZO[el.forma] * 2) / 2;   // a line's or an arrow's stroke, in px of 1080
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
  function fuenteSel(el, mix) {
    const ls = E.fuentes, i = mix ? -2 : ls.findIndex(f => el.font && (f.file ? f.file === el.font.file : f.css === el.font.css)), opt = (f, k) => `<option value="${k}"${k === i ? ' selected' : ''}>${esc(f.n)}</option>`;
    const grp = (lbl, pred) => { const o = ls.map((f, k) => pred(f) ? opt(f, k) : '').join(''); return o ? `<optgroup label="${lbl}">${o}</optgroup>` : ''; };
    return `<select class="lb-sel" data-lb="font" aria-label="Fuente">${mix ? '<option value="-1" selected>Varias</option>' : ''}${i === -1 && el.font ? `<option value="-1" selected>${esc(el.font.n || 'Fuente')}</option>` : ''}${grp('Del kit del cliente', f => f.kit)}${grp('De la mesa', f => f.file && !f.kit)}${grp('Del Mac', f => !f.file)}</select>`;
  }
  // several chosen (D-048): the settings they all have, applied to all at once (one ⌘Z). A value that differs says so
  // («Varios», no button or colour marked) and changes nothing until it is touched
  const COMUN = { texto: ['size', 'font', 'peso', 'tal', 'tc', 'sh'], foto: ['fan', 'b', 'bo', 'bc', 'r', 'sh'], logo: ['lc', 'sh'], forma: ['fc', 'sh'], hueco: ['sh'] };
  const VAL = { size: e => e.size || 0.06, font: e => e.font ? e.font.file || e.font.css || '' : '', peso: e => String(e.peso || 400), tal: e => e.al || 'izq', tc: e => (e.color || '#ffffff').toLowerCase(), sh: e => e.sh || 0,
    fan: e => Math.round(e.w * 1080), b: e => e.b || 0, bo: e => e.bo || '', bc: e => (e.bc || '#ffffff').toLowerCase(), r: e => e.r || 0, lc: e => hexOk(e.tint) ? e.tint.toLowerCase() : '', fc: e => (e.color || '#ffffff').toLowerCase() };
  function comunHTML(ss) {
    const ts = [...new Set(ss.map(e => e.t))], hay = k => ts.every(t => (COMUN[t] || []).includes(k)), e0 = ss[0];
    const mix = k => ss.some(e => VAL[k](e) !== VAL[k](e0)), lbl = (t, k) => `<span class="lb-l">${t}${mix(k) ? ' · varios' : ''}</span>`;
    let h = '';
    if (hay('font')) h += lbl('Fuente', 'font') + fuenteSel(e0, mix('font'));
    if (hay('size')) h += rng('size', 'Tamaño', VAL.size(e0), 0.015, 0.25, 0.001, mix('size'));
    if (hay('peso') && ss.every(e => !(e.font && e.font.file))) h += lbl('Grosor', 'peso') + seg('peso', [['300', 'Fina'], ['400', 'Normal'], ['600', 'Semi'], ['700', 'Negrita']], mix('peso') ? null : VAL.peso(e0));
    if (hay('tal')) h += lbl('Alineación', 'tal') + seg('tal', [['izq', 'Izquierda'], ['cen', 'Centro'], ['der', 'Derecha']], mix('tal') ? null : VAL.tal(e0));
    if (hay('tc')) h += lbl('Color', 'tc') + sws('tc', mix('tc') ? null : VAL.tc(e0), mix('tc'));
    if (hay('lc')) h += lbl('Color', 'lc') + `<div class="lb-btns" style="margin-top:0"><button type="button" class="btn2${!mix('lc') && !VAL.lc(e0) ? ' on' : ''}" data-lb="lc" data-c="" title="Sus colores, como se subieron">Original</button></div>${sws('lc', mix('lc') ? null : VAL.lc(e0), true)}`;
    if (hay('fc')) h += lbl('Color', 'fc') + sws('fc', mix('fc') ? null : VAL.fc(e0), mix('fc'));
    if (hay('fan')) h += `<label class="lb-l lb-fan">Tamaño · ancho en px <input type="number" class="lb-num" data-lb="fan" min="4" step="1" value="${mix('fan') ? '' : VAL.fan(e0)}" placeholder="Varios"></label>`;
    if (hay('b')) h += rng('b', 'Borde', VAL.b(e0), 0, 0.06, 0.001, mix('b')) + seg('bo', [['', 'Dentro'], ['fuera', 'Fuera']], mix('bo') ? null : VAL.bo(e0)) + lbl('Color del borde', 'bc') + sws('bc', mix('bc') ? null : VAL.bc(e0), mix('bc'));
    if (hay('r')) h += rng('r', 'Esquinas', VAL.r(e0), 0, 1, 0.01, mix('r'));
    if (hay('sh')) h += rng('sh', 'Sombra', VAL.sh(e0), 0, 1, 0.01, mix('sh'));
    return h ? `<div class="lb-sec"><h4>Lo que comparten <span>· cambia los ${ss.length} a la vez</span></h4>${h}${hay('fan') ? '<p class="lb-p">El ancho cambia cada foto sin deformarla, desde su esquina de arriba a la izquierda.</p>' : ''}</div>` : '';
  }
  function panel() {
    if (!E || !E.el) return;
    const p = E.el.querySelector('.lb-panel'), top = p.scrollTop, x = cur();
    if (!x) { p.innerHTML = `<div class="lb-sec"><h4>Sin diapositivas</h4><p class="lb-p">Añade una y, dentro, sus fotos.</p><div class="lb-btns"><button type="button" class="btn2" data-lb="sl-add">+ Diapositiva sin foto</button>${clip() && clip().slide ? pegarHTML() : ''}</div></div>`; return; }
    if (E.pick) {
      const ls = fotosDisponibles(), pe = compAt(E.i).els.find(q => q.id === E.pick.id), t = E.pick.modo === 'add' ? 'Añadir una foto' : E.pick.modo === 'rep' && !(pe && pe.t === 'hueco') ? 'Reemplazar la foto' : 'Foto para el hueco';
      p.innerHTML = `<div class="lb-sec"><h4>${t} <span>· de esta publicación y de la bandeja</span></h4>`
        + (ls.length ? `<div class="lb-photos">${ls.map(f => `<button type="button" class="lb-ph" data-lb="pickf" data-f="${esc(f)}" title="${esc(M.files[f].name || '')}"><img src="${M.files[f].thumbUrl || ''}" alt=""></button>`).join('')}</div>` : '<p class="lb-p">No hay fotos: añádelas a la bandeja de la mesa.</p>')
        + '<div class="lb-btns"><button type="button" class="btn2" data-lb="pick-x">Cancelar</button></div></div>';
      return;
    }
    const c = compAt(E.i), el = selEl();
    let h = '';
    if (multi()) {
      const ss = selEls(), grp = ss[0] && ss[0].g && ss.every(e => e.g === ss[0].g);
      h += `<div class="lb-sec"><h4>${ss.length} elementos <span>· ${grp ? 'agrupados' : 'elegidos'}</span></h4><div class="lb-btns">${grp ? '<button type="button" class="btn2" data-lb="ungroup" title="⇧⌥⌘G">Desagrupar</button>' : '<button type="button" class="btn" data-lb="group" title="⌥⌘G">Agrupar</button>'}</div>`
        + `<span class="lb-l">Alinear entre ellos</span><div class="lb-btns">${[['izq', '⇤ Izquierda'], ['cen', '↔ Centro'], ['der', '⇥ Derecha'], ['arr', '⤒ Arriba'], ['med', '↕ Medio'], ['aba', '⤓ Abajo']].map(([v, l]) => `<button type="button" class="btn2" data-lb="al" data-v="${v}">${l}</button>`).join('')}</div>`
        + rng('op', 'Opacidad', ss[0] ? ss[0].op ?? 1 : 1, 0, 1, 0.01, ss.some(e => (e.op ?? 1) !== (ss[0].op ?? 1))) + '<p class="lb-p">Arrastra cualquiera para moverlos juntos.</p></div>';
      h += comunHTML(ss) + transformarHTML(ss) + capasHTML(c);
    } else if (el) {
      if (el.t === 'foto') {
        const crop = E.crop === el.id;
        h += `<div class="lb-sec"><h4>Foto <span>· ${el.lock ? 'bloqueada' : crop ? 'encuadrando: arrastra la foto dentro del marco' : 'elegida'}</span></h4>`;
        if (crop) h += rng('z', 'Zoom', el.z || 1, 1, 3, 0.01) + '<div class="lb-btns"><button type="button" class="btn2" data-lb="crop-c">Centrar</button><button type="button" class="btn" data-lb="crop">Listo</button></div>';
        else h += `<div class="lb-btns"><button type="button" class="btn2" data-lb="crop"${!el.src || el.lock ? ' disabled' : ''} title="Mover y ampliar la foto dentro de su marco${el.hueco && !el.pan ? '' : ' (o doble clic)'}">Encuadrar</button><button type="button" class="btn2" data-lb="rep">${el.src ? 'Reemplazar' : 'Elegir foto'}</button>`
          + `<button type="button" class="btn2${el.fit != null ? ' on' : ''}" data-lb="encajar"${!el.src || el.lock ? ' disabled' : ''} title="La foto entera, centrada, con el fondo alrededor">Encajar</button><button type="button" class="btn2" data-lb="llenar"${el.lock ? ' disabled' : ''} title="${el.pan ? `La foto ocupa las ${el.pan.n} diapositivas` : 'La foto ocupa toda la diapositiva'}">Llenar</button></div>`
          + (el.fit != null ? rng('fit', 'Margen', el.fit, 0, 0.2, 0.005) : '');
        if (el.hueco) h += '<p class="lb-p">Llena un hueco de la plantilla: doble clic para verla entera o llenando el hueco. Si la borras, el hueco vuelve como era.</p>';
        h += '</div>' + cruzarHTML(el) + transformarHTML([el]);
        h += plegable('estilo', 'Marco y estilo', 'borde, esquinas, sombra', `<div class="lb-sub"><h5>Marco</h5>${seg('marco', [['', 'Ninguno'], ['polaroid', 'Polaroid'], ['pelicula', 'Película'], ['cinta', 'Cinta']], el.marco || '')}</div>`
          + `<div class="lb-sub"><h5>Estilo</h5>${rng('b', 'Borde', el.b || 0, 0, 0.06, 0.001)}${seg('bo', [['', 'Dentro'], ['fuera', 'Fuera']], el.bo || '')}<span class="lb-l">Color del borde</span>${sws('bc', el.bc || '#ffffff')}${rng('r', 'Esquinas', el.r || 0, 0, 1, 0.01)}${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}</div>`);
        h += girarHTML(el, true);
      } else if (el.t === 'texto') {
        const css = !(el.font && el.font.file);
        const est = E.estilos.length ? estiloDe(el) : null;
        const n = E.sl.length, k = Math.max(2, E.i + 1);   // the formats, with this slide's number (on the cover, the 2nd's)
        h += `<div class="lb-sec"><h4>${el.num ? 'Numeración' : el.pil ? 'Píldora' : 'Texto'} <span>· ${el.num ? (E.i ? 'automática' : 'oculta en la portada') : 'doble clic en el texto para escribir'}</span></h4>`
          + (el.num ? `${seg('num-f', Object.entries(NUMF).map(([f, fn]) => [f, fn(k, n)]), el.num.f)}<p class="lb-p">${E.i ? 'Es la posición de esta diapositiva y el total, portada incluida; se pone al día sola al añadir, borrar, mover o duplicar diapositivas.' : 'La portada nunca lleva número: aquí no se ve, y vuelve a verse si la diapositiva deja de ser la primera.'}</p><div class="lb-btns"><button type="button" class="btn2" data-lb="num" data-v="" title="Queda como un texto normal, con el número de ahora">Quitar numeración</button></div>`
            : `<textarea class="lb-ta" data-lb="txt" rows="3" aria-label="Texto">${esc(el.txt || '')}</textarea>` + (E.i ? '<div class="lb-btns"><button type="button" class="btn2" data-lb="num" data-v="a" title="El texto pasa a ser el número de la diapositiva y el total (02 / 7) y se pone al día solo">Numeración</button></div>' : ''))
          + (E.estilos.length ? `<span class="lb-l">Estilo de la marca</span><div class="lb-btns" style="margin-top:0">${E.estilos.map(st => `<button type="button" class="btn2${est && est.k === st.k ? ' on' : ''}" data-lb="est" data-v="${esc(st.k)}" title="Fuente, tamaño, interlineado y espaciado de «${esc(st.n)}» del kit">${esc(st.n)}</button>`).join('')}</div>` : '')
          + `<span class="lb-l">Fuente</span>${fuenteSel(el)}${rng('size', 'Tamaño', el.size || 0.06, 0.015, 0.25, 0.001)}`
          + (css ? `<span class="lb-l">Grosor</span>${seg('peso', [['300', 'Fina'], ['400', 'Normal'], ['600', 'Semi'], ['700', 'Negrita']], String(el.peso || 400))}` : '')
          + `<span class="lb-l">Alineación</span><div class="lb-btns" style="margin-top:0">${seg('tal', [['izq', 'Izquierda'], ['cen', 'Centro'], ['der', 'Derecha']], el.al || 'izq')}<button type="button" class="btn2${el.may ? ' on' : ''}" data-lb="may" title="Todo en mayúsculas">MAYÚS</button></div>`
          + `${rng('lh', 'Interlineado', el.lh || 1.2, 0.7, 2.2, 0.01)}${rng('ls', 'Espaciado', el.ls || 0, -0.1, 0.6, 0.005)}`
          + `<span class="lb-l">Color</span>${sws('tc', el.color || '#ffffff')}<span class="lb-l">Píldora</span>${seg('pil', [['', 'Sin píldora'], ['1', 'Con píldora']], el.pil ? '1' : '')}${el.pil ? sws('pc', el.pil.c) : ''}${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}</div>`;
        h += girarHTML(el, false);
      } else if (el.t === 'logo') {
        h += `<div class="lb-sec"><h4>Logo <span>· ${esc((M.files[el.src] || {}).name || '')}</span></h4><span class="lb-l" style="margin-top:0">Color</span>`
          + `<div class="lb-btns" style="margin-top:0"><button type="button" class="btn2${hexOk(el.tint) ? '' : ' on'}" data-lb="lc" data-c="" title="Sus colores, como se subió">Original</button></div>${sws('lc', el.tint, true)}`
          + `${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}<p class="lb-p">Un color pasa todo el logo a ese color, con su forma. Las esquinas lo escalan sin deformarlo.</p></div>`;
        h += girarHTML(el, true);
      } else if (el.t === 'hueco') {
        h += `<div class="lb-sec"><h4>Hueco de foto <span>· libre</span></h4><div class="lb-btns"><button type="button" class="btn" data-lb="rep">Elegir foto</button></div>`
          + '<p class="lb-p">Suelta aquí una foto (de la bandeja o del ordenador) o elígela: entra en su capa y, con su misma orientación, lo rellena; si no, te pregunta cómo. Si luego la borras, el hueco vuelve.</p></div>';
      } else {
        const tr = TRAZO[el.forma];
        h += `<div class="lb-sec"><h4>${FORMAS[el.forma] || 'Forma'}</h4><span class="lb-l" style="margin-top:0">${tr ? 'Color' : 'Relleno'}</span>${sws('fc', el.color || '#ffffff')}`
          + (tr ? rng('gr', 'Grosor', grosor(el), 1, 60, 0.5) + `<span class="lb-l">Trazo</span>${seg('trazo', [['', 'Continuo'], ['disc', 'Discontinuo'], ['punt', 'Punteado']], el.trazo || '')}`
              + (el.forma === 'flecha' ? `<span class="lb-l">Puntas</span>${seg('puntas', [['der', 'Una →'], ['izq', 'Una ←'], ['dos', 'Las dos ↔']], el.puntas || 'der')}` : '')
            : `${rng('b', 'Borde', el.b || 0, 0, 0.03, 0.0005)}<span class="lb-l">Color del borde</span>${sws('bc', el.bc || '#000000')}`)
          + (el.forma === 'rect' ? rng('r', 'Esquinas', el.r || 0, 0, 1, 0.01) : '') + `${rng('sh', 'Sombra', el.sh || 0, 0, 1, 0.01)}</div>`;
        h += girarHTML(el, false);
      }
      h += medidasHTML(el) + capasHTML(c);
    } else {
      const v = c.velo, n0 = E.i + 1, est = !x.key ? 'nueva, sin foto' : x.out || changedSl(x) ? 'editada' : 'foto sin editar';
      const solo = fotosDe(c).filter(e => e.src && M.files[e.src] && !M.files[e.src].design);
      h += `<div class="lb-sec"><h4>Diapositiva ${n0} <span>· ${est}</span></h4><div class="lb-btns"><button type="button" class="btn2" data-lb="add">+ Foto</button><button type="button" class="btn2" data-lb="add-txt">+ Texto</button><button type="button" class="btn2" data-lb="add-forma" data-v="rect">+ Rectángulo</button><button type="button" class="btn2" data-lb="add-forma" data-v="elipse">+ Círculo</button><button type="button" class="btn2" data-lb="add-forma" data-v="linea">+ Línea</button><button type="button" class="btn2" data-lb="add-forma" data-v="flecha">+ Flecha</button><button type="button" class="btn2" data-lb="add-pil">+ Píldora</button>${pegarHTML()}<button type="button" class="btn2" data-lb="sl-copy" title="⌘C sin nada elegido: con su fondo, velo y textura, para pegarla en esta u otra publicación">Copiar diapositiva</button>`
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
      const tpl = t => `<div class="lb-tp"><canvas data-lb="tpl" data-id="${esc(t.id)}" title="Aplicar «${esc(t.nombre)}» a esta diapositiva"></canvas><span>${esc(t.nombre)}</span><button type="button" data-lb="tpl-del" data-id="${esc(t.id)}" title="Borrar la plantilla" aria-label="Borrar la plantilla">×</button></div>`;
      const grupos = [...PLANT_FMT, ''].map(f => [f, E.plant.filter(t => (PLANT_FMT.includes(t.fmt) ? t.fmt : '') === f)]).filter(([, ts]) => ts.length);   // by format; those saved before 1.16 have none
      h += `<div class="lb-sec"><h4>Plantillas <span>· del cliente, para cualquier mes</span></h4>${E.plant.length ? grupos.map(([f, ts]) => `<span class="lb-l">${f || 'Sin formato'}</span><div class="lb-tpls">${ts.map(tpl).join('')}</div>`).join('') : '<p class="lb-p" style="margin:0 0 8px">Guarda una diapositiva entera y reutilízala: al aplicarla eliges solo sus textos, solo sus huecos de foto o todo.</p>'}`
        + `<div class="lb-btns"><button type="button" class="btn2" data-lb="tpl-save"${c.els.length || c.velo || c.tex || c.bg !== '#ffffff' ? '' : ' disabled'}>Guardar como plantilla</button>${c.previa ? '<button type="button" class="btn2" data-lb="tpl-quitar" title="La diapositiva vuelve a como estaba antes de su última plantilla">Quitar plantilla</button>' : ''}</div></div>`;
      h += capasHTML(c);
    }
    p.innerHTML = h; p.scrollTop = top;
    p.querySelectorAll('canvas[data-lb="tpl"]').forEach(cv => { const t = E.plant.find(q => q.id === cv.dataset.id); if (t) dibujarPlantilla(cv, t); });
    const pista = E.el.querySelector('.lb-hint'), enc = !!(el && E.crop === el.id);   // a hint only while reframing or choosing where to swap (the rest: «?»)
    pista.hidden = !enc && !E.cambio; pista.textContent = E.cambio ? 'Intercambiar: pulsa otro hueco de esta diapositiva · Esc o un clic fuera de un hueco para cancelar' : enc ? 'Encuadrando: arrastra la foto dentro del marco · rueda o «Zoom» para acercar · Esc o «Listo» para terminar' : '';
    barra();
  }
  // ---------- the bar over the selection: Duplicar · Bloquear · Delante / detrás · Borrar ----------
  function barra() {
    const fl = E && E.el && E.el.querySelector('.lb-fl'); if (!fl) return;
    const ss = E.sl.length && !E.crop && !E.pick && !E.cambio ? selEls() : [];
    if (!ss.length) { fl.hidden = true; fl.innerHTML = ''; E.flm = false; posRat(); return; }
    const c = compAt(E.i), n = c.els.length, idx = ss.map(e => c.els.indexOf(e)), el = selEl();
    const lock = ss.every(e => e.lock), arriba = idx.every(k => k >= n - ss.length), abajo = idx.every(k => k < ss.length);
    const it = (v, l, t, off) => `<button type="button" role="menuitem" data-lb="${v}" title="${t}"${off ? ' disabled' : ''}>${l}</button>`;
    fl.innerHTML = '<button type="button" data-lb="copy" title="Copiar (⌘C): ⌘V lo pega en el mismo sitio, en esta u otra diapositiva o publicación">Copiar</button>'
      + '<button type="button" data-lb="dup" title="Duplicar (⌘D)">Duplicar</button>'
      + `<button type="button" data-lb="lock" aria-pressed="${lock}">${lock ? 'Desbloquear' : 'Bloquear'}</button>`
      + (!multi() && el && lleno(el) ? `<button type="button" data-lb="cambio" title="Cambiar esta foto con otro hueco de la diapositiva"${huecosCambio().length ? '' : ' disabled'}>Intercambiar</button>` : '')
      + `<button type="button" data-lb="flm" aria-haspopup="menu" aria-expanded="${E.flm}"${arriba && abajo ? ' disabled' : ''}>Delante / detrás</button>`
      + (!multi() && el && el.g ? '<button type="button" data-lb="ungroup" title="⇧⌥⌘G">Desagrupar</button>' : '')
      + `<button type="button" class="del" data-lb="del" title="Borrar (⌫)"${lock ? ' disabled' : ''}>Borrar</button>`
      + `<span class="lb-flm" role="menu"${E.flm ? '' : ' hidden'}>${it('front', 'Al frente', '⇧⌘]', arriba)}${it('fwd', 'Adelante', '⌘]', arriba)}${it('bwd', 'Atrás', '⌘[', abajo)}${it('back', 'Al fondo', '⇧⌘[', abajo)}</span>`;
    fl.hidden = false; posBarra(); posRat();
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
  // a photo's or a hole's proportion: a name of the list (within 1 %) or «Libre · 1,37:1»; a photo cropped by its frame, both
  const ratNombre = (r, libre) => { const q = [...RATIOS.v, ...RATIOS.h].find(([, v]) => Math.abs(r / v - 1) <= 0.01); return q ? q[0] : `${libre ? 'Libre · ' : ''}${r.toFixed(2).replace('.', ',')}:1`; };
  function ratTxt(el, W, H) {
    if (!el || (el.t !== 'foto' && el.t !== 'hueco') || !(el.w > 0 && el.h > 0)) return '';
    const fw = el.w * W, fh = el.h * H, f = el.t === 'foto' && el.src && M.files[el.src], ib = hueco(el, fw, fh);
    return f && f.w > 0 && f.h > 0 && Math.abs((f.w / f.h) / (ib.w / ib.h) - 1) > 0.01 ? `Foto ${ratNombre(f.w / f.h)} · marco ${ratNombre(fw / fh)}` : ratNombre(fw / fh, true);
  }
  // the frame in a proportion of the list, the photo not cropped by it: its button is on in «Proporción del marco» (D-044)
  const ratLista = (el, W, H) => { const t = ratTxt(el, W, H); return [...RATIOS.v, ...RATIOS.h].some(([n]) => n === t) ? t : null; };
  function posRat() {              // the chip under the one photo or hole chosen (under the bar if the bar went under it)
    const c = E.el.querySelector('.lb-rat'); if (!c) return;
    const fl = E.el.querySelector('.lb-fl'), ss = E.sl.length && !E.crop && !E.pick ? selEls() : [], { W, H } = E.sz, t = ss.length === 1 ? ratTxt(ss[0], W, H) : '';
    if (!t) { c.hidden = true; return; }
    if (c.textContent !== t) c.textContent = t;
    c.hidden = false;
    const b = aabb(ss[0], W, H), k = E.k, cw = W * k, ch = H * k, w = c.offsetWidth, h = c.offsetHeight, m = 8, ft = fl ? parseFloat(fl.style.top) || 0 : 0;
    let y = b.b * k + m;
    if (fl && !fl.hidden && fl.style.visibility !== 'hidden' && ft >= b.b * k - 1) y = ft + fl.offsetHeight + 4;
    if (y + h > ch - m) y = Math.min(b.b * k, ch) - h - m;
    c.style.left = Math.round(clamp((b.l + b.r) / 2 * k - w / 2, m, Math.max(m, cw - w - m))) + 'px'; c.style.top = Math.round(clamp(y, m, Math.max(m, ch - h - m))) + 'px';
  }
  function dibujarPlantilla(cv, t) {
    const { W } = sizeAt(E.i), H = t.rat > 0 ? Math.round(W / t.rat) : sizeAt(E.i).H, w = 150, h = Math.round(w * H / W); cv.width = w; cv.height = h;   // in its own format
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
    FUERA = true; try { drawComp(x, compAt(E.pvI), W, H, viewImg, k, false); } finally { FUERA = false; }
  }
  // F: see it big, over the whole window (D-045): the chosen photo, original and whole; else the slide as it leaves the
  // editor (no guides, grid zone, selection or hole labels). Only a view: it never goes into an image.
  function verGrande(on) {
    if (E.fv) { E.fv.remove(); if (E.fvUrl) URL.revokeObjectURL(E.fvUrl); E.fv = E.fvUrl = null; window.removeEventListener('resize', fvDibujar); }
    if (!on) { E.el.focus({ preventScroll: true }); return; }
    if (!E.sl.length) return;
    const el = selIds().length === 1 ? selEl() : null, src = el && el.t === 'foto' && el.src && M.files[el.src] ? el.src : null, f = src && M.files[src];
    const fv = E.fv = document.createElement('div'); fv.className = 'lb-fv'; fv.setAttribute('role', 'dialog'); fv.setAttribute('aria-label', f ? 'La foto, en grande' : 'La diapositiva, en grande');
    fv.innerHTML = `<span class="lb-fvt">${f ? `${esc(f.name || 'Foto')} · ${f.w} × ${f.h} px, entera` : `Diapositiva ${E.i + 1}`} · Esc o F para cerrar</span>${f ? '<img alt="">' : '<canvas></canvas>'}`;
    E.el.append(fv);
    if (f) { const owner = E; I().getBlob(src).then(b => { if (E !== owner || E.fv !== fv || !b) return; E.fvUrl = URL.createObjectURL(b); fv.querySelector('img').src = E.fvUrl; }).catch(() => {}); }
    else { E.fvI = E.i; window.addEventListener('resize', fvDibujar); fvDibujar(); }
  }
  function fvDibujar() {           // the slide in F's view (again when its photos have loaded or the window changes)
    const cv = E && E.fv && E.fv.querySelector('canvas'); if (!cv || !E.sl[E.fvI]) return;
    const { W, H } = sizeAt(E.fvI), r = E.fv.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), dpr = window.devicePixelRatio || 1;
    cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; cv.width = Math.max(1, Math.round(W * s * dpr)); cv.height = Math.max(1, Math.round(H * s * dpr));
    const x = cv.getContext('2d'), k = cv.width / W; x.setTransform(k, 0, 0, k, 0, 0); x.imageSmoothingQuality = 'high';
    FUERA = true; try { drawComp(x, compAt(E.fvI), W, H, viewImg, k, false); } finally { FUERA = false; }
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
  function nudge(dx, dy) {          // px of a 1080-wide slide: the chosen element lands on a whole pixel, the rest move with it
    const ss = selEls().filter(e => !e.lock); if (!ss.length) return;
    const H1 = E.sz.H * PX, p = ss.find(e => e.id === E.sel) || ss[0];
    const ddx = dx ? (Math.round(p.x * 1080) + dx) / 1080 - p.x : 0, ddy = dy ? (Math.round(p.y * H1) + dy) / H1 - p.y : 0;
    onEl(e => { if (e.lock) return; e.x = r4(e.x + ddx); e.y = r4(e.y + ddy); delete e.fit; if (e.t !== 'foto') e.mano = true; }, 'nudge', true);
    syncNums(selEl());
  }
  // ⌥⌘C · ⌥⌘V: a text's look onto other texts, in this or another slide or post of the client (its fonts and colours are
  // the kit's); never the words, the place or the box's width
  const ESTILO_K = ['font', 'peso', 'size', 'color', 'lh', 'ls', 'al', 'may'];
  function copiarEstilo() {
    const t = selEls().find(e => e.t === 'texto');
    if (!t) { I().toast('Elige un texto para copiar su estilo.'); return; }
    ESTILO = { client: E.board.client, st: Object.fromEntries(ESTILO_K.filter(k => t[k] !== undefined).map(k => [k, clone(t[k])])) };
    I().toast('Estilo copiado: pégalo con ⌥⌘V en otros textos, en esta u otra diapositiva o publicación.');
  }
  function pegarEstilo() {
    if (!ESTILO || ESTILO.client !== E.board.client) { I().toast('Copia antes el estilo de un texto con ⌥⌘C.'); return; }
    const ids = selEls().filter(e => e.t === 'texto' && !e.lock).map(e => e.id);
    if (!ids.length) { I().toast('Elige uno o varios textos para pegarles el estilo.'); return; }
    const { W, H } = sizeAt(E.i);
    mut(null, () => ensure().els.forEach(e => {
      if (!ids.includes(e.id)) return;
      for (const k of ESTILO_K) { if (k in ESTILO.st) e[k] = clone(ESTILO.st[k]); else delete e[k]; }
      ajustarTexto(e, W, H);
    }));
  }
  function duplicarSl() {          // ⌘D with nothing chosen: a copy of the open slide goes in after it, as «Pegar diapositiva» (no warning, D-022)
    if (E.reel || !E.sl.length) return;
    if (E.car && E.sl.length >= MAX_SLIDES) { I().toast('Un carrusel admite como máximo 20 diapositivas (límite de Instagram).'); return; }
    mut(null, () => {
      const c0 = compAt(E.i), comp = { ...clone(c0), els: copias(c0.els, false) }, { W, H } = sizeAt(E.i), x = blankSlide(comp.bg || '#ffffff');
      delete comp.origen; delete comp.previa;   // a new slide: «Quitar plantilla» is the original's
      if (!E.car) x.fmt = fmtAt(E.i);
      x.comp = comp; x.rat = W / H; E.sl.splice(E.i + 1, 0, x); E.i += 1; soltar(); E.crop = null;
    });
    if (!E.allEl.hidden) verTodas(true);
  }
  function borrarSl(i) {           // with something on it (a photo, an element), it asks first; then «Deshacer» (as ⌘Z, while nothing else changed)
    if (!E.sl[i]) return;
    const ya = () => {
      mut(null, () => { E.sl.splice(i, 1); E.i = clamp(E.i > i ? E.i - 1 : E.i, 0, Math.max(0, E.sl.length - 1)); soltar(); E.crop = null; });
      const owner = E, h = E.hist, top = h.undo[h.undo.length - 1];
      I().toast(`Diapositiva ${i + 1} borrada.`, { key: 'lb-sl-del', ms: 7000, action: 'Deshacer', onAction: () => {
        if (E !== owner) { I().toast('El editor ya está cerrado: ese borrado no se deshace desde aquí.'); return; }
        if (E.busy) return;
        if (h.undo.length && h.undo[h.undo.length - 1] === top) deshacer(true); else I().toast('Ese borrado ya no se deshace desde el aviso: usa ⌘Z.');
      } });
      if (!E.allEl.hidden) verTodas(true);
    };
    if (compAt(i).els.length) preguntar(`¿Borrar la diapositiva ${i + 1}?`, null, [['seguir', 'Cancelar', 'btn2'], ['borrar', 'Borrar', 'btn']], v => { if (v === 'borrar') ya(); });
    else ya();
  }
  function copiar(todo) {          // the selected elements; nothing selected (or «Copiar diapositiva»): the whole slide, its background, veil and texture too
    if (!E.sl.length) return;
    const ss = todo ? [] : selEls(), { W, H } = sizeAt(E.i), de = { client: E.board.client, rat: W / H };
    if (ss.length) { CLIP = { ...de, els: clone(ss) }; I().toast(ss.length === 1 ? 'Copiado: pégalo con ⌘V en esta u otra diapositiva, en el mismo sitio.' : `${ss.length} elementos copiados: pégalos con ⌘V, en el mismo sitio.`); }
    else { CLIP = { ...de, slide: clone(compAt(E.i)) }; I().toast('Diapositiva copiada: pégala con ⌘V en esta u otra publicación del cliente.'); }
    panel();
  }
  const clip = () => CLIP && E && CLIP.client === E.board.client ? CLIP : null;   // another client's photos and logos never go into this one's posts
  const pegarHTML = () => { const cb = clip(); return !cb ? '' : cb.slide ? `<button type="button" class="btn2" data-lb="paste" title="⌘V: ${E.reel ? 'en lugar de la portada' : 'detrás de la elegida (o en ella, si es nueva y está vacía)'}">${E.reel ? 'Pegar como portada' : 'Pegar diapositiva'}</button>` : '<button type="button" class="btn2" data-lb="paste" title="⌘V: en el mismo sitio">Pegar</button>'; };
  function copias(els, suelta) {   // new ids and groups; a photo that crossed slides stands alone; a file no longer here leaves a hole
    const g = {};
    return els.map(e0 => { const e = clone(e0); e.id = uid(); if (suelta) { e.lock = false; delete e.hueco; } delete e.pan; if (e.g) e.g = g[e.g] || (g[e.g] = uid()); if (e.src && !M.files[e.src]) e.src = null; return e; });
  }
  function pegar() {
    const cb = clip(); if (!cb) return;
    if (cb.slide) { pegarSl(cb); return; }
    if (!E.sl.length) return;
    mut(null, () => {
      const c = ensure(), nw = copias(cb.els, true);
      enSuSitio(nw, cb.rat, E.i);
      const dup = nw.every(e => c.els.some(o => Math.abs(o.x - e.x) < 1e-3 && Math.abs(o.y - e.y) < 1e-3 && Math.abs(o.w - e.w) < 1e-3));   // on itself: a little aside
      if (dup) nw.forEach(e => { e.x = r4(e.x + 0.03); e.y = r4(e.y + 0.03); });
      c.els.push(...nw); E.sel = nw[0].id; E.mas = nw.slice(1).map(e => e.id); E.crop = null;
    });
  }
  function pegarSl(cb) {           // a new slide still empty, or a reel's cover, takes it; else it goes in after the chosen one
    const x0 = cur(); if (E.reel && !x0) return;
    const llena = E.reel || (x0 && !x0.key && !compAt(E.i).els.length);
    if (!llena && E.car && E.sl.length >= MAX_SLIDES) { I().toast('Un carrusel admite como máximo 20 diapositivas (límite de Instagram).'); return; }
    mut(null, () => {
      const comp = { ...clone(cb.slide), els: copias(cb.slide.els, false) }; delete comp.origen; delete comp.previa;   // new ids: its origin is where it lands; what it was before a template stays with the original
      let x = x0;
      if (!llena) { x = blankSlide(comp.bg || '#ffffff'); if (x0 && !E.car) x.fmt = fmtAt(E.i); E.i = x0 ? E.i + 1 : 0; E.sl.splice(E.i, 0, x); }
      enSuSitio(comp.els, cb.rat, E.i);
      const { W, H } = sizeAt(E.i);
      x.comp = comp; x.rat = W / H; soltar(); E.crop = null;
    });
  }
  // What is pasted stays where it was: in pixels on a slide of the same proportion. On another, each block (an element, or a
  // group) keeps the corner or edge of the slide it is nearest to (top, middle or bottom; left, centre or right), its distance
  // to it and its size, scaled by k (the ratio of the short sides, as a new format). A background — half the slide or more —
  // stretches with the slide; a photo that «Encaja» fits again, and every photo is clamped in its new frame.
  function enSuSitio(els, rat, i) {
    const { W, H: H1 } = sizeAt(i), H0 = W / rat;
    if (!(rat > 0) || Math.abs(rat - W / H1) <= 0.005) return;   // as «Aplicar»'s check: the same proportion
    const k = Math.min(W, H1) / Math.min(W, H0), grupos = new Map();
    for (const e of els) { const g = e.g || e.id; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(e); }
    for (const blq of grupos.values()) {
      const b = union(blq, W, H0, true); if ((b.r - b.l) * (b.b - b.t) >= 0.5 * W * H0) continue;
      const cx = (b.l + b.r) / 2 / W, cy = (b.t + b.b) / 2 / H0, zy = cy < 0.4 ? 0 : cy > 0.6 ? 1 : 0.5;
      const ax = cx < 0.4 ? 0 : cx > 0.6 ? W : W / 2, ay0 = zy * H0, ay1 = zy * H1;
      for (const e of blq) {
        Object.assign(e, { x: r4((ax + (e.x * W - ax) * k) / W), w: r4(e.w * k), y: r4((ay1 + (e.y * H0 - ay0) * k) / H1), h: r4(e.h * H0 * k / H1) });
        if (e.t === 'texto') e.size = r4((e.size || 0.06) * k);
        if (e.b) e.b = r4(e.b * k);
        if (e.t === 'hueco') (e.textos || []).forEach(t => { t.size = r4((t.size || 0.06) * k); });
      }
    }
    for (const e of els) if (e.t === 'foto' && e.src) { if (e.fit != null) encajar(e, e.fit, i); else setPhoto(e, {}, i); }
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
    if (E.cmOn) menuCtx(false);
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
      case 'zona': menu(false); zona(!E.zona); return;
      case 'guias': guias(!E.reglas); return;
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
      case 'sl-del': if (!E.reel) borrarSl(+b.dataset.i); return;
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
      case 'tr-fil': if (I().trayFiltro) I().trayFiltro(b.dataset.v); bandeja(); return;   // the same filter as the mesa's tray
      case 'tr-add': {
        const f = b.dataset.f;
        if (b._meta) { E.trSel = E.trSel.includes(f) ? E.trSel.filter(q => q !== f) : [...E.trSel, f]; bandeja(); return; }   // ⌘ + click: one more or one less of the chosen
        if (E.trSel.length) { E.trSel = []; bandeja(); }
        desdeBandeja([f], { i: null, p: null });
        return;
      }
      case 'cambio': { const el = selEl(); if (!el || multi() || !lleno(el) || !huecosCambio().length) return; E.cambio = el.id; E.crop = null; E.pick = null; panel(); pedir(); return; }
      case 'add-txt': { const hayFoto = fotosDe(compAt(E.i)).length > 0; nuevo(textoEl(hayFoto ? '#ffffff' : '#000000')); const el = selEl(); if (el) ajustarTexto(el, E.sz.W, E.sz.H); return; }
      case 'add-forma': nuevo(formaEl(b.dataset.v, E.sz.W, E.sz.H)); return;
      case 'add-pil': nuevo(pildoraEl()); return;
      case 'num': { const f = b.dataset.v; if (f && !E.i) return; onEl(el => { if (el.t !== 'texto') return; if (f) el.num = { f }; else delete el.num; }); return; }   // never on the cover; taken off, the text keeps its number as it is
      case 'num-f': onEl(el => { if (el.t === 'texto' && el.num && NUMF[b.dataset.v]) el.num.f = b.dataset.v; }); return;
      case 'pil': { const { W, H } = sizeAt(E.i); onEl(el => { if (el.t !== 'texto') return; if (b.dataset.v) el.pil = { c: (el.pil && el.pil.c) || (lum(hexOk(el.color) ? el.color : '#ffffff') > 0.4 ? '#000000' : '#ffffff') }; else delete el.pil; ajustarTexto(el, W, H); }); return; }
      case 'pc': onEl(el => { if (el.t === 'texto' && el.pil) el.pil.c = col(); }, 'pc'); return;
      case 'trazo': onEl(el => { if (el.t !== 'forma' || !TRAZO[el.forma]) return; if (b.dataset.v) el.trazo = b.dataset.v; else delete el.trazo; }); return;
      case 'puntas': onEl(el => { if (el.t === 'forma' && el.forma === 'flecha') el.puntas = b.dataset.v; }); return;
      case 'add-est': { const el = textoMarca(b.dataset.v); if (el) nuevo(el); return; }
      case 'est': { const st = E.estilos.find(q => q.k === b.dataset.v); if (st) onEl(el => { if (el.t === 'texto') conEstilo(el, st); }); return; }
      case 'logo': if (M.files[b.dataset.f]) nuevo(logoEl(b.dataset.f, E.sz.W, E.sz.H)); return;
      case 'logo-up': E.el.querySelector('.lb-logoin').click(); return;
      case 'rep': { const el = selEl(); if (el) { E.pick = { modo: 'rep', id: el.id }; panel(); } return; }
      case 'pick-x': E.pick = null; panel(); return;
      case 'pickf': {
        const f = b.dataset.f, pk = E.pick, owner = E; if (!pk || !M.files[f] || !E.sl.length) return;
        avisar(fotoIt([f]), E.i, pk.id).then(r => {
          if (!r || !r.length || E !== owner || E.pick !== pk) return;
          E.pick = null;
          const h = pk.modo === 'add' ? null : compAt(E.i).els.find(q => q.id === pk.id);
          if (h && (h.t === 'hueco' || (h.t === 'foto' && (!h.src || (h.hueco && !h.pan))))) { repartir([{ f, h }], 0); return; }   // a hole, free or filled (D-050)
          mut(null, () => {
            const c = ensure();
            if (pk.modo === 'add') { const e = fotoEl(f); const top = c.els.reduce((a, q, i) => q.t === 'foto' ? i + 1 : a, 0); c.els.splice(top, 0, e); E.sel = e.id; E.mas = []; encajar(e, 0.08); delete e.fit; }   // a new photo goes above the photos, under texts and logos
            else { const e = c.els.find(q => q.id === pk.id); if (e) { e.src = f; e.cx = 0.5; e.cy = 0.5; e.z = 1; if (pk.modo === 'fill') { const { W, H } = sizeAt(E.i); colocar(e, W, H); } else if (e.fit != null) encajar(e, e.fit); E.sel = e.id; E.mas = []; } }
          });
        });
        return;
      }
      case 'bc': onEl(el => { el.bc = col(); }, 'bc'); return;
      case 'tc': onEl(el => { if (el.t === 'texto') el.color = col(); }, 'tc'); return;
      case 'fc': onEl(el => { if (el.t === 'forma') el.color = col(); }, 'fc'); return;
      case 'lc': onEl(el => { if (el.t !== 'logo') return; if (hexOk(b.dataset.c)) el.tint = col(); else delete el.tint; }, 'lc'); return;
      case 'bg': mut('bg', () => { ensure().bg = col(); }); return;
      case 'velo': mut(null, () => { const c = ensure(); c.velo = b.dataset.v ? { tipo: b.dataset.v, color: (c.velo && c.velo.color) || '#000000', op: (c.velo && c.velo.op) || 0.35, dir: (c.velo && c.velo.dir) || 'abajo', alc: (c.velo && c.velo.alc) || 0.6 } : null; }); return;
      case 'velo-c': mut('velo-c', () => { const c = ensure(); if (c.velo) c.velo.color = col(); }); return;
      case 'velo-dir': mut(null, () => { const c = ensure(); if (c.velo) c.velo.dir = b.dataset.v; }); return;
      case 'tex': mut(null, () => { const c = ensure(); if (b.dataset.v) c.tex = { tipo: b.dataset.v, op: (c.tex && c.tex.op) || 0.35 }; else delete c.tex; }); return;
      case 'grid': mut(null, () => { const c = ensure(); rejilla(c, b.dataset.v, c.rej ? c.rej.g : E.gap ?? 0.02); soltar(); E.crop = null; }); return;
      case 'tpl': elegirPlantilla(b.dataset.id); return;
      case 'tpl-save': guardarPlantilla(); return;
      case 'tpl-quitar': quitarPlantilla(); return;
      case 'tpl-del': { const t = E.plant.find(q => q.id === b.dataset.id); if (t) preguntar(`¿Borrar la plantilla «${t.nombre}»?`, 'Se borra para este cliente; las diapositivas ya hechas con ella no cambian.', [['seguir', 'Cancelar', 'btn2'], ['borrar', 'Borrar', 'btn']], v => { if (v === 'borrar') guardarCliente(l => ({ ...l, plantillas: (l.plantillas || []).filter(q => q.id !== t.id) })); }); return; }
      case 'crop': { const el = selEl(); if (!el || el.t !== 'foto') return; E.crop = E.crop === el.id ? null : el.src && !el.lock ? el.id : null; panel(); pedir(); return; }
      case 'crop-c': onEl(el => setPhoto(el, { cx: 0.5, cy: 0.5, z: 1 })); return;
      case 'encajar': onEl(el => { if (el.t === 'foto') encajar(el, el.fit != null ? el.fit : 0); }); return;
      case 'llenar': onEl(el => { if (el.t === 'foto') llenar(el); }); return;
      case 'bo': onEl(el => { if (el.t !== 'foto') return; if (b.dataset.v) el.bo = 'fuera'; else delete el.bo; }); return;
      case 'marco': onEl(el => { if (el.t !== 'foto') return; el.marco = b.dataset.v || null; if (el.marco) delete el.fit; setPhoto(el, {}); }); return;
      case 'rotl': onEl(el => { el.rot = ((Math.round((el.rot || 0) - 90) + 540) % 360) - 180; delete el.fit; }); return;
      case 'rotr': onEl(el => { el.rot = ((Math.round((el.rot || 0) + 90) + 540) % 360) - 180; delete el.fit; }); return;
      case 'flipx': onEl(el => { el.fx = !el.fx; }); return;
      case 'flipy': onEl(el => { el.fy = !el.fy; }); return;
      case 'peso': onEl(el => { if (el.t === 'texto') el.peso = +b.dataset.v; }); return;
      case 'al': if (b.dataset.v && !multi()) return; alinear(b.dataset.v); return;
      case 'al1': alinear(b.dataset.v); return;
      case 'may': onEl(el => { if (el.t === 'texto') el.may = !el.may; }); return;
      case 'tal': { const { W, H } = sizeAt(E.i); onEl(el => { if (el.t === 'texto') { el.al = b.dataset.v; ajustarTexto(el, W, H); } }); return; }
      case 'front': case 'fwd': case 'bwd': case 'back': E.flm = false; orden(a); return;
      case 'dup': {
        const ids = selIds(); if (!ids.length) return;
        mut(null, () => { const c = ensure(), g = {}, nw = []; for (const el of c.els.filter(q => ids.includes(q.id))) { const e = clone(el); e.id = uid(); e.lock = false; if (e.g) e.g = g[e.g] || (g[e.g] = uid()); e.x = r4(e.x + 0.03); e.y = r4(e.y + 0.03); delete e.fit; delete e.pan; delete e.hueco; nw.push(e); } c.els.push(...nw); E.sel = nw[0].id; E.mas = nw.slice(1).map(e => e.id); });
        return;
      }
      case 'copy': copiar(); return;
      case 'sl-copy': copiar(true); return;
      case 'paste': pegar(); return;
      case 'paste-est': pegarEstilo(); return;
      case 'lock': { const all = selEls().every(e => e.lock); onEl(el => { el.lock = !all; if (el.lock && E.crop === el.id) E.crop = null; }); return; }
      case 'del': {
        const ss = selEls(); if (!ss.length) return;
        if (ss.every(e => e.lock)) { I().toast(ss.length > 1 ? 'Están bloqueados: desbloquéalos para borrarlos.' : 'Está bloqueado: desbloquéalo para borrarlo.'); return; }
        mut(null, () => {
          const c = ensure(), ids = ss.filter(e => !e.lock).map(e => e.id), pans = ss.filter(e => !e.lock && e.pan).map(e => e.pan.id);
          sacar(c, e => ids.includes(e.id)); soltar(); E.crop = null; E.pick = null;   // a photo that filled a hole leaves the hole as it was
          if (pans.length) E.sl.forEach((x, j) => { if (j !== E.i && x.comp) sacar(x.comp, e => !!(e.pan && pans.includes(e.pan.id))); });   // a crossing photo goes from all its slides
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
    if (E.cmOn && fuera('.lb-cm')) { menuCtx(false); n = true; }
    return n;
  }
  function onInput(t) {           // sliders and fields of the panel
    const a = t.dataset.lb;
    if (a === 'txt') { const v = t.value; onEl(el => { if (el.t === 'texto' && !el.num) { el.txt = v; ajustarTexto(el, E.sz.W, E.sz.H); } }, 'txt', true); return; }
    if (a === 'font') { const f = E.fuentes[+t.value]; if (!f) return; onEl(el => { if (el.t !== 'texto') return; el.font = { n: f.n, ...(f.file ? { file: f.file, w: f.w } : { css: f.css }) }; ajustarTexto(el, E.sz.W, E.sz.H); }); return; }
    const v = +t.value;
    if (OUTF[a] && t.nextElementSibling) t.nextElementSibling.textContent = OUTF[a](v);
    if (t.closest('.lb-mix')) t.closest('.lb-mix').classList.remove('lb-mix');
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
      case 'fan': if (v >= 4) onEl(el => { if (el.t !== 'foto' || el.lock) return; const k = v / 1080 / el.w; el.w = r4(v / 1080); el.h = r4(el.h * k); delete el.fit; if (el.src) setPhoto(el, {}); }, 'fan', true); return;
      case 'z': onEl(el => setPhoto(el, { z: v }), 'z', true); return;
      case 'fit': onEl(el => { if (el.t === 'foto') encajar(el, v); }, 'fit', true); return;
      case 'size': onEl(el => { if (el.t === 'texto') { el.size = v; ajustarTexto(el, W, H); } }, 'size', true); syncNums(selEl()); return;
      case 'gr': { const Hs = sizeAt(E.i).H; onEl(el => { const f = el.t === 'forma' && TRAZO[el.forma]; if (!f) return; const h0 = el.h; el.h = r4(v * f / (Hs * PX)); el.y = r4(el.y + (h0 - el.h) / 2); }, 'gr', true); syncNums(selEl()); return; }   // around its centre
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
        if (a === 'man' || a === 'mal') {   // the panel is not rebuilt while typing: the button of a proportion of the list on (D-044), or the proportion as the chip says
          E.el.querySelectorAll('.lb-panel [data-lb="t-rat"].on').forEach(b => b.classList.remove('on'));
          const ss = selEls(), rb = E.el.querySelector('.lb-panel [data-lb="t-rat"]'), rp = E.el.querySelector('.lb-panel .lb-ratp');
          if (ss.length === 1 && ss[0].t === 'foto' && rb) {
            const t = ratTxt(ss[0], W, H), on = [...E.el.querySelectorAll('.lb-panel [data-lb="t-rat"]')].find(b => b.dataset.v === t);
            if (on) { on.classList.add('on'); if (rp) rp.remove(); } else if (rp) rp.textContent = t; else rb.parentNode.insertAdjacentHTML('afterend', `<p class="lb-p lb-ratp">${esc(t)}</p>`);
          }
        }
        return;
      }
    }
  }
  // ---------- templates (D-033 to D-036) ----------
  // «Guardar como plantilla»: the whole slide, without asking — texts, logos, shapes, background, veil and texture as they
  // are, and a hole where each photo was (a frame with no photo, or the hole a photo filled) —, named «Plantilla N», with its
  // format: the list goes by format.
  const PLANT_FMT = ['4:5', '3:4', '1:1', 'Horizontal', '9:16'];
  const fmtNombre = i => E.reel ? '9:16' : FMTS[fmtAt(i)] || '4:5';
  function guardarPlantilla() {
    if (!E || !E.sl.length) return;
    const c = compAt(E.i), comp = clone(c), { W, H } = sizeAt(E.i);
    delete comp.origen; delete comp.previa;
    comp.els.forEach(e => { if (e.t === 'foto') { e.src = null; e.cx = 0.5; e.cy = 0.5; e.z = 1; } delete e.lock; delete e.pan; });
    const n = E.plant.reduce((a, q) => { const m = /^Plantilla (\d+)$/.exec(q.nombre || ''); return m ? Math.max(a, +m[1]) : a; }, E.plant.length) + 1;
    const t = { id: 't' + Date.now().toString(36), nombre: `Plantilla ${n}`, comp, fmt: fmtNombre(E.i), rat: r4(W / H), at: new Date().toISOString() };
    guardarCliente(l => ({ ...l, plantillas: [...(l.plantillas || []), t].slice(-24) })).then(ok => ok && I().toast(`«${t.nombre}» guardada para este cliente (${t.fmt}).`));
  }
  // the template's photo holes: a frame of the template (its photo was taken out when it was saved) or a hole a photo filled
  const esHuecoT = e => e.t === 'hueco' || e.t === 'foto';
  function elegirPlantilla(id) {   // what of it goes on this slide
    const t = E.plant.find(q => q.id === id); if (!t) return;
    preguntar(`Aplicar «${t.nombre}»`, [['Solo textos', 'su formato en los textos de esta diapositiva, por orden; el texto no cambia'], ['Solo fotos', 'sus huecos; las fotos de esta diapositiva entran en ellos por orden'], ['Todo', 'la diapositiva entera, con las fotos en sus huecos']],
      [['seguir', 'Cancelar', 'btn2'], ['textos', 'Solo textos', 'btn2'], ['fotos', 'Solo fotos', 'btn2'], ['todo', 'Todo', 'btn']], v => { if (v === 'textos' || v === 'fotos' || v === 'todo') aplicarPlantilla(id, v); });
  }
  // A template on the open slide (one step of ⌘Z). The slide keeps what it had (comp.previa) for «Quitar plantilla».
  // Solo textos: each text of the slide, in drawing order, takes the place and style of the template's text in that order
  // (never its words); the template's texts left over come in with «Titular» (the biggest) or «Texto». Solo fotos: the
  // slide's photos and holes give way to the template's holes, in the layer of the first of them, and its photos go into
  // them in order, as one dropped on each (D-018); texts, logos, shapes and background stay. Todo: the whole template, the
  // photos into its holes in the same way. Photos with no hole left go back to the tray when it is applied.
  const ESTILO_T = ['x', 'y', 'w', 'rot', 'size', 'font', 'peso', 'color', 'al', 'lh', 'ls', 'may'];
  const PREVIAS = 5;
  const firmaSin = c => firma({ ...c, previa: undefined });   // the slide itself, not what it was
  function aplicarPlantilla(id, modo) {
    const t = E.plant.find(q => q.id === id); if (!t) return;
    const { W, H } = sizeAt(E.i), tc = migrado(clone(t.comp));   // a template saved with a drawn hole of before
    if (t.rat > 0 && Math.abs(t.rat - W / H) > 0.005) aProporcion(tc, W, Math.round(W / t.rat), H);   // of another format: its blocks to their zones, as a change of format (D-019)
    const tt = tc.els.filter(e => e.t === 'texto' && !e.oculto);
    if (modo === 'textos' && !tt.length) { I().toast('Esta plantilla no tiene textos.'); return; }
    if (modo === 'fotos' && !tc.els.some(esHuecoT)) { I().toast('Esta plantilla no tiene huecos de foto.'); return; }
    mut(null, () => {
      const c = ensure(), fotos = fotosDe(c).filter(e => !e.oculto).map(e => e.src).filter(Boolean), g = {};   // a hidden photo takes no hole
      const antes = clone(c); antes.rat = r4(W / H);
      for (let p = antes, d = 1; p.previa; p = p.previa, d++) if (d >= PREVIAS) { delete p.previa; break; }
      const nuevo = e => {             // an element of the template, for this slide: new ids, its groups too; a filled hole is the hole
        const n = e.t === 'foto' && e.hueco ? clone(e.hueco) : clone(e);
        n.id = uid(); if (n.g) n.g = g[n.g] || (g[n.g] = uid());
        if (n.t === 'foto') Object.assign(n, { src: null, cx: 0.5, cy: 0.5, z: 1 });
        else if (n.t === 'logo' && n.src && !M.files[n.src]) n.src = null;
        return n;
      };
      const llenar = hs => {           // a hole as a photo dropped on it (D-018); a frame of the template keeps its place, as before 1.16
        let k = 0;
        for (const h of hs) {
          if (h.oculto) continue;
          const f = fotos[k++]; if (!f) break;
          if (h.t === 'hueco') { rellenar(c, h, f, W, H); continue; }
          Object.assign(h, { src: f, cx: 0.5, cy: 0.5, z: 1, hueco: clone(h) });   // it gives the hole back when it is deleted (D-052)
          if (h.fit != null) { const r = h.rot || 0; encajar(h, h.fit); h.rot = r; }
        }
      };
      if (modo === 'textos') {
        const st = c.els.filter(e => e.t === 'texto' && !e.oculto), mayor = tt.reduce((a, e) => (e.size || 0) > (a.size || 0) ? e : a, tt[0]);
        tt.forEach((e, k) => {
          const d = st[k];
          if (d) { ESTILO_T.forEach(p => { if (e[p] !== undefined) d[p] = clone(e[p]); else delete d[p]; }); delete d.mano; return; }
          const n = { ...clone(e), id: uid(), txt: e === mayor ? 'Titular' : 'Texto' }; delete n.g; delete n.mano; delete n.lock; delete n.num; delete n.pil;
          c.els.push(n);
        });
      } else if (modo === 'fotos') {
        const sale = e => e.t === 'foto' || e.t === 'hueco', at = c.els.findIndex(sale), resto = c.els.filter(e => !sale(e));
        const pos = at < 0 ? 0 : c.els.slice(0, at).filter(e => !sale(e)).length, hs = tc.els.filter(esHuecoT).map(nuevo);
        c.els = [...resto.slice(0, pos), ...hs, ...resto.slice(pos)];
        if (tc.rej) c.rej = clone(tc.rej); else delete c.rej;
        llenar(hs);
      } else {
        c.bg = tc.bg; c.velo = clone(tc.velo); if (tc.tex) c.tex = clone(tc.tex); else delete c.tex;
        c.els = tc.els.map(nuevo);
        if (tc.rej) c.rej = clone(tc.rej); else delete c.rej;
        llenar(c.els.filter(esHuecoT));
      }
      delete c.origen;             // where the template put things is where a change of proportion starts from
      c.previa = antes;
      mantenerRat(cur(), E.i);     // a frame given a format keeps it on a slide of another format
      renumerar();                 // its numbered texts to this slide's place before its signature
      antes.tras = firmaSin(c);    // the slide as the template left it: changed since, «Quitar plantilla» asks
      soltar(); E.crop = null;
    });
  }
  // the slide as it was before its last template (one step of ⌘Z); changed since the template, it asks first. A photo no
  // longer in the mesa leaves its hole; laid out in another format, it goes to this one as a change of format does.
  function quitarPlantilla() {
    const x = cur(), p = x && x.comp && x.comp.previa; if (!p) return;
    const ya = () => {
      if (!E || cur() !== x || !x.comp || x.comp.previa !== p) return;
      mut(null, () => {
        const c = clone(p), { W, H } = sizeAt(E.i);
        if (c.rat > 0 && Math.abs(c.rat - W / H) > 0.005) aProporcion(c, W, Math.round(W / c.rat), H);
        delete c.rat; delete c.tras;
        sacar(c, e => e.t === 'foto' && e.src && !M.files[e.src]);
        fotosDe(c).forEach(e => { if (e.fit != null && e.src) encajar(e, e.fit); });   // «Encajar» holds in this format
        x.comp = c;
        mantenerRat(x, E.i);
        soltar(); E.crop = null;
      });
    };
    if (p.tras && firmaSin(x.comp) === p.tras) { ya(); return; }
    preguntar('¿Quitar la plantilla?', 'La diapositiva vuelve a como estaba antes de la plantilla y se pierden los cambios hechos después en ella.', [['seguir', 'Cancelar', 'btn2'], ['quitar', 'Quitar plantilla', 'btn']], v => { if (v === 'quitar') ya(); });
  }

  function wire(el) {
    el.addEventListener('click', e => {
      if (!E) return;                // the click that closed the editor («Salir sin aplicar») still bubbles here
      if (E.noClick) { E.noClick = false; return; }
      cerrarMenus(e.target);
      if (E.pv && e.target === E.pv) { preview(false); return; }   // a click outside the post closes the preview
      if (E.fv && E.fv.contains(e.target)) { verGrande(false); return; }
      const b = e.target.closest('[data-lb]'); if (!b || !el.contains(b) || E.busy) return;
      if ((b.tagName === 'INPUT' && b.type !== 'button') || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA') return;
      if (b.dataset.lb === 'logo' && e.altKey) { const f = b.dataset.f; preguntar('¿Quitar este logo del kit?', 'Las diapositivas ya hechas con él no cambian.', [['seguir', 'Cancelar', 'btn2'], ['q', 'Quitar', 'btn']], v => { if (v === 'q') guardarCliente(l => ({ ...l, logos: (l.logos || []).filter(q => q !== f) })); }); return; }
      b._shift = e.shiftKey; b._meta = e.metaKey || e.ctrlKey;
      act(b.dataset.lb, b);
    });
    el.addEventListener('pointerdown', e => { if (E && E.cambio && (e.target !== E.cv || e.button !== 0)) { salirCambio(); if (E.scroll.contains(e.target)) e.stopPropagation(); } }, true);   // a click outside the slide cancels «Intercambiar»
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
    el.addEventListener('wheel', onWheel, { passive: false });   // on the whole editor: a pinch never zooms the page
    el.addEventListener('gesturestart', onGesto, { passive: false }); el.addEventListener('gesturechange', onGesto, { passive: false });   // Safari's pinch
    el.querySelectorAll('.lb-rx, .lb-ry').forEach(r => { r.addEventListener('pointerdown', guiaDown); r.addEventListener('pointermove', onMove); r.addEventListener('pointerup', onUp); r.addEventListener('pointercancel', onUp); });
    const sc = E.scroll;           // the grey area around the slide
    sc.addEventListener('pointerdown', grisDown, true);   // first: with space held, the slide doesn't take the click
    sc.addEventListener('pointermove', grisMove); sc.addEventListener('pointerup', grisUp); sc.addEventListener('pointercancel', grisUp);
    sc.addEventListener('dblclick', e => { if (!E || !gris(e) || E.busy || E.esp || !E.sl.length || escribiendo() || performance.now() - E.finEscr < 600) return; zoom(1); });
    sc.addEventListener('scroll', () => menuCtx(false));
    el.addEventListener('contextmenu', onCtx);
    el.addEventListener('pointermove', e => { E && (E.ptr = { x: e.clientX, y: e.clientY }); }, true);
    el.addEventListener('pointerleave', () => { if (E) E.ptr = null; });
  }
  function sinEspacio(e) {         // space let go (or ⌘, as a Mac sends no keyup for a key let go with ⌘ held; or the window left): no more hand
    if (!E || !E.esp || (e.type === 'keyup' && e.key !== ' ' && e.key !== 'Meta')) return;
    if (e.key === ' ') e.preventDefault();   // a focused button doesn't take it as a press
    E.esp = false; mano();
  }
  function onKey(e) {
    if (!E) { window.removeEventListener('keydown', onKey, true); return; }
    e.stopImmediatePropagation();
    if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyP' || String(e.key).toLowerCase() === 'p')) e.preventDefault();   // with the editor open ⌘P never prints
    if (E.busy) { if (!e.metaKey) e.preventDefault(); return; }
    if (!E.el.isConnected || !curSlot()) { cerrar(true); return; }
    if (E.ask) {
      if (e.key === 'Escape') { e.preventDefault(); cerrarPregunta(); }
      else if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('lb-askin')) { e.preventDefault(); E.askOk(); }
      else if ((e.key === '1' || e.key === '2') && E.ask.classList.contains('lb-ask12')) { e.preventDefault(); if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) E.ask.querySelectorAll('[data-ask]')[+e.key - 1].click(); }   // held down, it never answers the next question
      return;
    }
    if (E.fv) {                     // F's view: Esc or F close it, no other key acts on what it hides
      if (e.key === 'Escape' || (String(e.key).toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey)) { e.preventDefault(); verGrande(false); }
      return;
    }
    if (E.pv) {                     // the preview: Esc closes it, ← → go through the slides
      if (e.key === 'Escape') { e.preventDefault(); preview(false); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const j = E.pvI + (e.key === 'ArrowLeft' ? -1 : 1); if (j >= 0 && j < E.sl.length) { E.pvI = j; pintarPv(); } }
      return;
    }
    if (E.cambio) { if (e.key === 'Escape') { e.preventDefault(); salirCambio(); } return; }   // «Intercambiar» waits for a hole: no other key acts
    const t = e.target, typing = esTexto(t);
    const mod = (e.metaKey || e.ctrlKey) && !e.altKey, k = String(e.key).toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (cerrarMenus(null)) return;
      if (typing && t.blur) { t.blur(); E.el.focus({ preventScroll: true }); return; }
      if (E.trSel.length) { E.trSel = []; bandeja(); return; }
      if (E.pick) { E.pick = null; panel(); } else if (E.crop) { E.crop = null; panel(); pedir(); } else if (!E.allEl.hidden) verTodas(false); else if (E.sel) { soltar(); panel(); pedir(); } else pedirCerrar();
      return;
    }
    if (typing) return;
    if (E.cmOn && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {   // the right-click menu: the arrows go through its items
      e.preventDefault();
      const bs = [...E.el.querySelectorAll('.lb-cm button:not(:disabled)')], n = bs.length, j = bs.indexOf(document.activeElement), ab = e.key === 'ArrowDown';
      if (n) bs[j < 0 ? (ab ? 0 : n - 1) : (j + (ab ? 1 : -1) + n) % n].focus();
      return;
    }
    if (E.cmOn && !['Enter', 'Tab', ' ', 'Shift'].includes(e.key)) menuCtx(false);   // another key: the menu goes
    const sola = !e.metaKey && !e.ctrlKey && !e.altKey, teclado = t && t !== E.el && t !== document.body && t.matches && t.matches(':focus-visible');
    if (e.key === ' ' && sola && !E.cmOn && !teclado && sobreGris()) { e.preventDefault(); if (!E.esp) { E.esp = true; mano(); } return; }   // space over the slide or the grey: the hand
    if (sola && !e.shiftKey && (k === 't' || k === 'r')) { if (E.sl.length && !e.repeat) { e.preventDefault(); if (k === 't') act('add-txt'); else act('add-forma', { dataset: { v: 'rect' } }); } return; }
    if (sola && !e.shiftKey && k === 'f') { if (E.sl.length && !e.repeat) { e.preventDefault(); verGrande(true); } return; }
    if (t && t.classList && t.classList.contains('lb-it') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!E.allEl.hidden) verTodas(false); elegir(+t.dataset.i); return; }
    if (mod && k === 'z') { e.preventDefault(); deshacer(!e.shiftKey); return; }
    if (mod && k === 'y') { e.preventDefault(); deshacer(false); return; }
    if (mod && k === 'c') { if (E.sl.length && !E.crop) { e.preventDefault(); copiar(); } return; }   // nothing chosen: the whole slide
    if (mod && k === 'v') { if (clip()) { e.preventDefault(); pegar(); } return; }
    if (mod && k === 'd') { e.preventDefault(); if (E.sel) act('dup'); else if (!e.repeat) duplicarSl(); return; }
    if (mod && k === 'p') { if (!e.repeat) zona(!E.zona); return; }
    if (mod && k === 'g') { if (!e.shiftKey) { e.preventDefault(); guias(!E.reglas); } return; }
    // ⌥ changes the letter a key types on a Mac (⌥G: ©): these go by the key itself (by the letter when no key is given)
    const alt = (e.metaKey || e.ctrlKey) && e.altKey, tecla = l => e.code ? e.code === 'Key' + l.toUpperCase() : k === l;
    if (alt && tecla('g')) { e.preventDefault(); if (E.sel) act(e.shiftKey ? 'ungroup' : 'group'); return; }
    if (alt && !e.shiftKey && tecla('c')) { e.preventDefault(); copiarEstilo(); return; }
    if (alt && !e.shiftKey && tecla('v')) { e.preventDefault(); pegarEstilo(); return; }
    if (mod && k === 'a') { if (E.sl.length) { e.preventDefault(); const ids = compAt(E.i).els.filter(q => !q.oculto).map(q => q.id); E.sel = ids[0] || null; E.mas = ids.slice(1); E.crop = null; panel(); pedir(); } return; }
    if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { if (E.sel) { e.preventDefault(); orden(e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'fwd') : (e.shiftKey ? 'back' : 'bwd')); } return; }
    if (mod && (k === '+' || k === '=' || k === '-')) { e.preventDefault(); zoom(E.zoom * (k === '-' ? 1 / 1.25 : 1.25)); return; }
    if (mod && k === '0') { e.preventDefault(); zoom(1); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { if (E.sel) { e.preventDefault(); act('del'); } return; }
    if (e.key.startsWith('Arrow')) {
      if (t && t.closest && t.closest('.seg, .lb-rng')) return;
      e.preventDefault();
      if (e.altKey && !mod) { moverSl(E.i, E.i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)); return; }   // ⌥ + arrows: the slide moves
      if (E.sel) { const s = e.shiftKey ? 10 : 1; nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0); }
      else elegir(E.i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1));
    }
  }

  // ---------- the tray in a drawer under the slide, and photos dropped from the computer ----------
  // «?»: the shortcuts, once a line under the slide
  const ATAJOS = '<h4>Atajos de teclado</h4><dl>' + [
    ['Clic', 'elegir · con ⇧, varios'],
    ['Arrastrar', 'mover · esquinas: tamaño · lados: recortar (o el ancho de un texto) · círculo: girar'],
    ['⌥ al ampliar', 'desde el centro: una esquina, los cuatro lados con la proporción (con ⇧, sin ella); un lado, también el opuesto'],
    ['Doble clic', 'encuadrar la foto (la de un hueco: entera o llenándolo) o escribir el texto'],
    ['Flechas', 'mover 1 px (con ⇧, 10 px) · ⌥ + flechas: mover la diapositiva'],
    ['⌘C · ⌘V', 'copiar y pegar en el mismo sitio, también en otra diapositiva o publicación · sin nada elegido: la diapositiva entera'],
    ['⌘D · ⌫', 'duplicar · borrar · sin nada elegido, ⌘D duplica la diapositiva y la pone detrás'],
    ['⌥⌘C · ⌥⌘V', 'copiar el estilo de un texto (fuente, peso, tamaño, color, interlineado, espaciado, alineación y mayúsculas) y pegarlo en uno o varios textos, también de otra diapositiva o publicación'],
    ['⌥⌘G', 'agrupar (⇧⌥⌘G: desagrupar) · ⌘A: elegir todo'],
    ['⌘G', 'guías: reglas arriba y a la izquierda; arrastra desde una para crear una guía y fuera de la diapositiva para borrarla'],
    ['⌘P', 'zona del grid (en una historia, zona segura: lo que tapa Instagram): en la portada, oscurece lo que el perfil de Instagram recorta al mostrarla en 3:4 (no sale al exportar)'],
    ['⌘] · ⌘[', 'adelante · atrás (con ⇧: al frente · al fondo)'],
    ['⌘Z', 'deshacer (⇧⌘Z: rehacer)'],
    ['⌘+ · ⌘−', 'acercar · alejar (también pellizcando o con ⌘ + rueda, hacia el puntero) · ⌘0: entera'],
    ['Espacio + arrastrar', 'mover la vista cuando hay zoom'],
    ['Fuera de la diapositiva', 'clic: soltar la selección · arrastrar: elegir lo que quede dentro (con ⇧, sumarlo) · doble clic: ajustar · clic derecho: pegar y añadir'],
    ['T · R', 'añadir un texto · un rectángulo'],
    ['F', 'ver en grande, en toda la ventana: la foto elegida, original y entera · sin una foto elegida, la diapositiva · Esc, F o un clic: cerrar'],
    ['⌘ al arrastrar', 'sin imán (con él, distancias en px, espacios y tamaños iguales en violeta, el centro de la diapositiva en verde discontinuo) · ⇧ al girar: de 15° en 15°'],
    ['⌘ + clic en la bandeja', 'elegir varias fotos: arrastrar una de ellas se las lleva todas · Esc: soltarlas'],
    ['1 · 2', 'en la pregunta de una foto que no coincide con su hueco: rellenar el recuadro · mantener el formato de la foto · Esc: no ponerla'],
    ['Esc', 'soltar la selección o terminar de encuadrar'],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl><p>Suelta fotos del ordenador en la diapositiva o en la bandeja.</p>';
  const FLECHA = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const hayArchivos = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
  function enUso() { const u = new Set(); E.sl.forEach((x, i) => fotosDe(compAt(i)).forEach(e => { if (e.src) u.add(e.src); })); return u; }
  // a tray photo with ✓ that is in another post of this month goes in as a copy, as in the mesa (D-041)
  const conCopias = fs => I().paraPoner && !E.historia ? I().paraPoner(fs, E.slotId) : Promise.resolve(fs);   // a story uses the photo where it is
  // the client's tray as the mesa shows it (D-041): [{f, u}], u = used in a publication of any month (this post: as it is
  // here, its slides) — with «Sin usar», only the ones without ✓
  function trayFotos(todas) {
    const uso = enUso();
    const vista = I().bandejaVista ? I().bandejaVista({ todas, sin: E.slotId, mas: uso }).filter(x => !isKit(x.f)) : E.board.tray.filter(f => M.files[f] && !M.files[f].design && !isKit(f)).map(f => ({ f, u: uso.has(f) }));
    return [...[...E.vuelven].filter(f => M.files[f] && !uso.has(f) && !vista.some(x => x.f === f)).map(f => ({ f, u: false })), ...vista];   // a photo another took the place of is back in the tray at once, not only when it is applied
  }
  function bandeja() {               // drawn again only when it shows something else
    if (!E || !E.el) return;
    const todas = !!(I().trayTodas && I().trayTodas()), box = E.el.querySelector('.lb-tray'), b = E.el.querySelector('.lb-trb'), fs = trayFotos(todas), n = fs.filter(x => !x.u).length, uso = enUso();
    E.trSel = E.trSel.filter(f => fs.some(x => x.f === f));   // only what it shows stays chosen
    b.querySelector('.lb-trn').textContent = n ? `Bandeja · ${n}` : 'Bandeja';
    b.setAttribute('aria-expanded', String(E.trOpen)); b.title = E.trOpen ? 'Cerrar la bandeja' : `Bandeja: ${n === 1 ? '1 foto sin usar' : `${n} fotos sin usar`}, para ponerlas en la diapositiva`;
    const key = E.trOpen ? (todas ? 't:' : 's:') + fs.map(x => x.f + (x.u ? '+' : '') + (x.h ? '~' : '') + (E.trSel.includes(x.f) ? '*' : '') + (M.files[x.f].thumbUrl || '')).join(',') : '';
    if (key === E.trKey && box.hidden === !E.trOpen) return;
    E.trKey = key; box.hidden = !E.trOpen;
    const sx = (box.querySelector('.lb-trs') || {}).scrollLeft || 0;
    const tit = x => esc(M.files[x.f].name || '') + (uso.has(x.f) ? ' · ya está en una diapositiva' : x.u ? ' · ya usada en una publicación' : '') + (x.h ? ' · usada en una historia' : '');
    box.innerHTML = !E.trOpen ? '' : `<div class="lb-trh">${seg('tr-fil', [['sin', 'Sin usar'], ['todas', 'Todas']], todas ? 'todas' : 'sin')}<b>Bandeja</b> <span>· ${fs.length ? 'clic: a esta diapositiva · o arrástrala donde la quieras · ⌘ + clic: elegir varias · ' : ''}suelta aquí fotos del ordenador para guardarlas en ella</span></div>`
      + (fs.length ? `<div class="lb-trs">${fs.map(x => `<button type="button" class="lb-ph lb-tph${x.u ? ' uso' : ''}${E.trSel.includes(x.f) ? ' elegida' : ''}" data-lb="tr-add" data-f="${esc(x.f)}" title="${tit(x)}"><img src="${M.files[x.f].thumbUrl || ''}" alt="" draggable="false">${M.files[x.f].w > M.files[x.f].h ? '<span class="hb" title="Horizontal">H</span>' : ''}${x.h ? '<span class="hs" title="Usada en una historia"></span>' : ''}</button>`).join('')}</div>` : `<p class="lb-p" style="margin:0 0 4px">${todas ? 'La bandeja está vacía.' : 'No hay fotos sin usar: mira «Todas».'}</p>`);
    const tr = box.querySelector('.lb-trs'); if (tr) tr.scrollLeft = sx;
  }
  // a photo used before (D-022): before it goes onto slide i, its nearest use — this slide (without the element excl it
  // replaces), another slide of this post, or what the mesa finds — and «Usar igualmente» / «Cancelar» (several: a list,
  // «Usar todas» / «Saltar repetidas»). items [{f?, name, size}] -> the ones that go in, or null (nothing changes)
  const fotoIt = fs => fs.filter(f => M.files[f]).map(f => ({ f, name: M.files[f].name, size: M.files[f].size }));
  async function avisar(items, i, excl) {
    const owner = E, s = curSlot(); if (!owner || !s || !items.length || !I().usoFoto) return items;
    const kOf = f => { const x = M.files[f]; return x ? x.name + '|' + x.size : null; }, aqui = new Set(), post = new Set();
    E.sl.forEach((x, j) => fotosDe(compAt(j)).forEach(e => { const k = e.src && e.id !== excl && kOf(e.src); if (k) (j === i ? aqui : post).add(k); }));
    const rep = [];
    for (const it of items) { const k = it.name + '|' + it.size, u = E.historia ? await I().usoHistoria(it.name, it.size, s) : await I().usoFoto(it.name, it.size, { slot: s.id, skip: s.id, a: aqui.has(k) ? 1 : post.has(k) ? 2 : null }); if (u) rep.push({ it, u }); }   // a story: being used is what it is for; only a post still to come warns (D-056)
    if (E !== owner) return null;
    if (!rep.length) return items;
    const one = items.length === 1;
    return new Promise(res => {
      preguntar(one ? rep[0].u.txt : `${rep.length === 1 ? (E.historia ? '1 foto sale después en el feed' : '1 foto ya usada') : `${rep.length} ${E.historia ? 'fotos salen después en el feed' : 'fotos ya usadas'}`} de ${items.length}`, one ? rep[0].it.name : rep.map(r => [r.it.name, r.u.txt]),
        one ? [['seguir', 'Cancelar', 'btn2'], ['usar', 'Usar igualmente', 'btn']] : [['saltar', 'Saltar repetidas', 'btn2'], ['usar', 'Usar todas', 'btn']],
        v => res(E !== owner ? null : v === 'usar' ? items : v === 'saltar' ? items.filter(it => !rep.some(r => r.it === it)) : null));
      E.askNo = () => res(null);
    });
  }
  // photo f and hole h of the open slide that don't match: filling it (true), whole (false) or, with Esc or a click outside, neither (null)
  const ORI_F = { h: 'horizontal', v: 'vertical', q: 'cuadrada' }, ORI_H = { h: 'horizontal', v: 'vertical', q: 'cuadrado' };
  function preguntaEncaje(f, h, esc) {
    const owner = E, d = M.files[f], a = areaHueco(h), { W, H } = sizeAt(E.i);
    return new Promise(res => {
      const fin = v => { if (E === owner) { E.ojo = null; pedir(); } res(v); };
      E.ojo = h.id; pedir();
      preguntar(`Esta foto es ${ORI_F[orienta(d.w, d.h)]} y el recuadro, ${ORI_H[orienta(a.w * W, a.h * H)]}`, esc,
        [['llena', '1 · Rellenar el recuadro', 'btn2'], ['entera', '2 · Mantener el formato de la foto', 'btn2']], v => fin(v === 'llena' ? true : v === 'entera' ? false : null));
      E.askNo = () => fin(null);
      E.ask.classList.add('lb-ask12');
      const im = document.createElement('img'); im.className = 'lb-askimg'; im.alt = ''; im.src = d.thumbUrl || '';
      E.ask.querySelector('.lb-askc').prepend(im);
      E.el.focus({ preventScroll: true });   // no button holds the keys: only 1, 2 and Esc answer
    });
  }
  // photos into holes of the open slide, pares [{f, h}] (a filled one: its photo goes back to the tray), one step of ⌘Z:
  // first the ones of the hole's orientation, then a question for each of the others. sobran: the ones with no hole, left in
  // the tray. -> how many went in and how many didn't fit
  async function repartir(pares, sobran) {
    const owner = E, { W, H } = sizeAt(E.i); let dado = false, puestas = 0;
    E.pick = null; E.crop = null;
    const pon = (lista, llena) => {
      if (!dado) { paso(); dado = true; }
      const c = ensure();
      for (const { f, h: h0 } of lista) {
        const h = c.els.find(q => q.id === h0.id); if (!h) continue;
        if (h.src) E.vuelven.add(h.src);
        E.sel = (h.src ? reajustar(c, h, f, W, H, llena) : rellenar(c, h, f, W, H, llena)).id; E.mas = []; puestas++;
      }
      despues();
    };
    const iguales = pares.filter(x => coincide(x.f, areaHueco(x.h), W, H));
    if (iguales.length) pon(iguales, true);
    for (const x of pares) {
      if (iguales.includes(x)) continue;
      const llena = await preguntaEncaje(x.f, x.h, 'Esc: no ponerla.');
      if (E !== owner) return null;
      if (llena != null) pon([x], llena);
    }
    if (!puestas) panel();
    if (sobran) I().toast(sobran === 1 ? '1 foto no cabe: no queda hueco libre y sigue en la bandeja.' : `${sobran} fotos no caben: no quedan huecos libres y siguen en la bandeja.`, { ms: 6000 });
    return { puestas, sobran };
  }
  // «Intercambiar»: the holes the chosen photo can change places with, and its change with hole id; each photo goes in by
  // the same rule, one step of ⌘Z. Nothing changes until both are answered: Esc in a question cancels it all
  const huecosCambio = () => { const a = selEl(); return huecosTodos(compAt(E.i)).filter(e => e !== a && !e.lock); };
  function salirCambio() { if (!E.cambio) return; E.cambio = null; panel(); pedir(); }
  async function intercambiar(id) {
    const owner = E, c0 = compAt(E.i), a = c0.els.find(q => q.id === E.cambio), b = c0.els.find(q => q.id === id), { W, H } = sizeAt(E.i);
    E.cambio = null; panel(); pedir();
    if (!a || !b) return;
    const encaje = async (f, h) => coincide(f, areaHueco(h), W, H) ? true : preguntaEncaje(f, h, 'Esc: dejarlas como estaban.');
    const fa = a.src, fb = b.src, ra = await encaje(fa, b);
    if (E !== owner || ra == null) return;
    const rb = fb ? await encaje(fb, a) : null;
    if (E !== owner || (fb && rb == null)) return;
    mut(null, () => {
      const c = ensure(), x = c.els.find(q => q.id === a.id), y = c.els.find(q => q.id === b.id); if (!x || !y) return;
      const giro = { fx: x.fx, fy: x.fy };   // a flipped photo stays flipped: it is the photo's
      if (fb) { Object.assign(x, { fx: y.fx, fy: y.fy }); reajustar(c, x, fb, W, H, rb); Object.assign(reajustar(c, y, fa, W, H, ra), giro); E.sel = y.id; }
      else { const n = rellenar(c, y, fa, W, H, ra); Object.assign(n, giro); sacar(c, e => e === x); E.sel = n.id; }
      E.mas = [];
    });
  }
  // the photos that go on a slide with holes (D-050): one, into the hole under the pointer or the one chosen, else the first
  // free one of its orientation, else the first free one; several, each into a free one of its orientation, in drawing order,
  // and the rest into those left. null: no hole for it there, it is a loose photo as ever
  function planHuecos(fs, p, c, s0) {
    const { W, H } = sizeAt(E.i), libres = huecosDe(c);
    if (fs.length === 1) {
      const f = fs[0], h = p ? huecosTodos(c).reverse().find(q => inside(areaHueco(q), p))
        : (s0 && huecosTodos(c).find(q => q.id === s0.id)) || libres.find(q => coincide(f, q, W, H)) || libres[0];
      return h ? { pares: [{ f, h }], sobran: 0 } : p ? null : { pares: [], sobran: 1 };
    }
    const pares = [], resto = [], quedan = libres.slice();
    for (const f of fs) { const j = quedan.findIndex(q => coincide(f, q, W, H)); if (j < 0) resto.push(f); else pares.push({ f, h: quedan.splice(j, 1)[0] }); }
    for (const f of resto) if (quedan.length) pares.push({ f, h: quedan.shift() });
    return { pares, sobran: fs.length - pares.length };
  }
  // photos onto slide i (null: the one open). On a slide with holes, into them (planHuecos); else as new photos above the
  // others, at the pointer when there is one; a post with no slide gets one. -> how many went in and how many didn't fit
  async function ponerFotos(fs, p, i) {
    fs = fs.filter(f => M.files[f] && !M.files[f].design && !isKit(f)); if (!fs.length || !E || E.busy) return null;
    if (E.ask) cerrarPregunta();
    if (E.pv) preview(false);
    if (E.fv) verGrande(false);
    if (!E.allEl.hidden) verTodas(false);
    if (E.cambio) salirCambio();
    const otra = i != null && E.sl[i] && i !== E.i, s0 = !otra && !p ? selEl() : null, c0 = E.sl.length ? compAt(otra ? i : E.i) : null;
    if (huecosTodos(c0).length) {
      if (otra) elegir(i);
      const plan = planHuecos(fs, p, c0, s0);
      if (plan) return repartir(plan.pares, plan.sobran);
    }
    mut(null, () => {
      if (!E.sl.length) { E.sl.push(blankSlide('#ffffff')); E.i = 0; } else if (otra) E.i = i;
      E.pick = null; E.crop = null;
      const c = ensure(), { W, H } = sizeAt(E.i), ids = [];
      fs.forEach((f, k) => {
        const e = fotoEl(f), top = c.els.reduce((a, q, j) => q.t === 'foto' ? j + 1 : a, 0);
        c.els.splice(top, 0, e); encajar(e, 0.08); delete e.fit;
        const d = k * 0.03, cx = p ? p.x / W : e.x + e.w / 2 + d, cy = p ? p.y / H : e.y + e.h / 2 + d;
        e.x = r4(clamp(cx - e.w / 2 + (p ? d : 0), 0, 1 - e.w)); e.y = r4(clamp(cy - e.h / 2 + (p ? d : 0), 0, 1 - e.h));
        ids.push(e.id);
      });
      E.sel = ids[ids.length - 1]; E.mas = [];
    });
    if (otra) { const it = E.el.querySelectorAll('.lb-list .lb-it')[E.i]; if (it) it.scrollIntoView({ block: 'nearest' }); }
    return { puestas: fs.length, sobran: 0 };
  }
  // the filled hole a single photo would replace there (D-022 doesn't count the photo that goes)
  function aSustituir(p, i) {
    if (!E.sl.length || (i != null && i !== E.i)) return undefined;
    const e = p ? huecosTodos(compAt(E.i)).reverse().find(q => inside(areaHueco(q), p)) : selEl();
    return e && lleno(e) ? e.id : undefined;
  }
  // tray photos to a place t ({i, p}, see destino): the warning first (D-022), a copy if it is used this month (D-041)
  function desdeBandeja(fs, t) {
    const owner = E;
    avisar(fotoIt(fs), t.i != null ? t.i : E.i, fs.length === 1 ? aSustituir(t.p, t.i) : undefined).then(r => r && r.length && E === owner ? conCopias(r.map(x => x.f)) : null).then(go => { if (go && go.length && E === owner) ponerFotos(go, t.p, t.i); });
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
    if (!E || E.busy || E.ask) return;
    if (I().locked) { I().toast(LOCKED); return; }
    const owner = E, files = [...(e.dataTransfer.files || [])], guardar = !!e.target.closest('.lb-tray'), t = guardar ? null : destino(e) || { i: null, p: null };
    if (!files.length) return;
    if (t && t.el === E.scroll && t.i == null && !t.p && escribiendo()) { I().toast(ESCRIBIENDO); return; }   // onto the grey while writing: nothing
    let go = files;
    if (!guardar) {       // onto a slide: the warning first (into the tray they just go in)
      const r = await avisar(files.filter(f => f && f.size).map(f => ({ f, name: f.name, size: f.size })), t.i != null ? t.i : E.i, files.length === 1 ? aSustituir(t.p, t.i) : undefined);
      if (!r || E !== owner) return;
      go = r.map(x => x.f); if (!go.length) return;
    }
    const got = await M.addFiles(go, null, { tray: true });
    if (E !== owner) return;
    bandeja();
    if (!got || !got.length) return;
    if (guardar) { if (!E.trOpen) { E.trOpen = true; bandeja(); } I().toast(got.length === 1 ? 'Foto guardada en la bandeja.' : `${got.length} fotos guardadas en la bandeja.`); return; }
    const r = await ponerFotos(got, t.p, t.i);
    if (E === owner && r && r.puestas && !r.sobran) I().toast(`${r.puestas === 1 ? 'Foto puesta' : `${r.puestas} fotos puestas`} en la diapositiva ${E.i + 1}. Quedan en la bandeja hasta que apliques.`);
  }
  function arrastrarBandeja(e) {     // a tray photo dragged onto the slide or onto a slide of the strip (a click puts it on the open one)
    const b = e.target.closest('.lb-tph'); if (!b || e.button !== 0 || !E || E.busy) return;
    const f = b.dataset.f, x0 = e.clientX, y0 = e.clientY, owner = E; let g = null, gn = null;
    const lote = E.trSel.includes(f) ? [...E.el.querySelectorAll('.lb-tph')].map(q => q.dataset.f).filter(q => E.trSel.includes(q)) : [f];   // one of the chosen takes them all, in the tray's order
    const move = ev => {
      if (E !== owner) return;
      if (!g) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        g = document.createElement('img'); g.className = 'lb-ghost'; g.alt = ''; g.src = (M.files[f] || {}).thumbUrl || ''; E.el.append(g);
        if (lote.length > 1) { gn = document.createElement('span'); gn.className = 'lb-ghostn'; gn.textContent = lote.length; E.el.append(gn); }
      }
      g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; if (gn) { gn.style.left = ev.clientX + 'px'; gn.style.top = ev.clientY + 'px'; } resaltar(ev);
    };
    const end = drop => ev => {
      document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', cancel, true);
      if (g) g.remove();
      if (gn) gn.remove();
      if (E !== owner) return;
      resaltar(null);
      const lejos = Math.hypot(ev.clientX - x0, ev.clientY - y0) >= 6;   // released far away before any move was seen: a drag too
      if (!drop || !(g || lejos)) return;
      E.noClick = true; setTimeout(() => { if (E === owner) E.noClick = false; }, 0);
      const t = destino(ev); if (t && t.el === E.scroll && t.i == null && !t.p && escribiendo()) { I().toast(ESCRIBIENDO); return; }
      if (!t) return;
      if (lote.length > 1) { E.trSel = []; bandeja(); }
      desdeBandeja(lote, t);
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
      // an empty hole goes in as it is (the post is marked and never goes up, D-035); a photo or logo whose file is gone can't be drawn
      E.sl.forEach((x, i) => { if (x.comp) need(!x.comp.els.some(e => !e.oculto && (e.t === 'logo' ? !(e.src && M.files[e.src]) : e.t === 'foto' && e.src && !M.files[e.src])), `Diapositiva ${i + 1}: tiene una foto o un logo que ya no está. Elígelo o bórralo.`); });
      if (!pendiente()) { cerrar(); return; }
      E.busy = true; APL++; counted = true; head();
      const fmtCh = E.car && E.fmt !== E.fmt0, outs = [], made = [];
      try {
        for (let i = 0; i < E.sl.length; i++) {
          const x = E.sl[i];
          const f0 = x.key && M.files[x.key], sz = sizeAt(i), off = !f0 || Math.abs(f0.w / f0.h - sz.W / sz.H) > 0.005;   // ratio, not pixels: a cross-Mac copy is 1080 wide
          const redo = !isRaw(x) && (!x.key || !x.out || changedSl(x) || fmtCh || (!E.car && x.fmt !== x.fmt0) || off);
          if (!redo) { outs.push(x.key); continue; }
          const id = await guardarImagen(await renderOut(i), E.car ? `${s.name} ${pad2(i + 1)}.jpg` : E.reel && !E.historia ? `${s.name} portada.jpg` : `${s.name}.jpg`);
          outs.push(id); made.push(id);
        }
      } catch (e) { for (const f of made) { try { await I().deleteIfUnused(f); } catch (er) { /* the sweep takes it */ } } throw e; }
      if (!(E === owner && I().S === S && conHist(S).includes(s) && I().same(s.photos, E.photos0) && (s.design || null) === E.dz && !I().locked && !I().uploadsBusy())) {   // changed while drawing: nothing is used
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
      if (E.guias.x.length || E.guias.y.length) s.guias = { x: E.guias.x.slice(), y: E.guias.y.slice() }; else delete s.guias;   // px of a 1080-wide slide; only the editor draws them
      if (Object.keys(lib).length) s.libre = { v: 1, slides: lib }; else delete s.libre;
      if (E.car) {
        s.fmt = E.fmt;
        if (fmtCh) outs.forEach(f => { if (!lib[f]) S.crops[f] = { ...I().baseCrop(f, S), cx: 0.5, cy: 0.5, z: 1 }; });   // the photos left as they were: centred, as a format change does
      } else if (!E.reel) E.sl.forEach((x, i) => { const f = outs[i]; if (lib[f]) S.crops[f] = { fmt: x.fmt, cx: 0.5, cy: 0.5, z: 1 }; else if (x.fmt !== x.fmt0) S.crops[f] = { ...I().baseCrop(f, S), fmt: x.fmt, cx: 0.5, cy: 0.5, z: 1 }; });   // a reel cover keeps no format of its own: the mesa shows it 9:16
      const used = new Set([...outs, ...Object.values(lib).flatMap(srcsOf)]);
      if (!E.historia) S.tray = S.tray.filter(f => !used.has(f));   // photos now in the post leave the tray; a discard in a story stays, marked (D-056)
      const after = I().refsOf(S), lost = [...before].filter(f => !after.has(f) && M.files[f]);
      S.tray.unshift(...lost.filter(f => !M.files[f].design && !isKit(f)));   // photos the post no longer uses go back to the tray (never a logo)
      E.applied = true;
      I().changed();
      if (I().histJuntar && E.marca) I().histJuntar(E.marca);
      const i0 = E.i, slotId = E.slotId, fijo = !!E.dz, reel = E.reel, historia = E.historia;
      E.busy = false; APL--; counted = false;
      cerrar(true);
      if (historia) { if (M.hs) M.hs.tras(slotId); }
      else if (I().S === S && I().openDetail) I().openDetail(slotId, Math.min(i0, Math.max(0, s.photos.length - 1)));
      const n = made.length;
      I().toast((n ? historia ? 'Historia aplicada.' : reel ? 'Portada aplicada: se sube tal cual.' : `${n === 1 ? 'Diapositiva aplicada' : `${n} diapositivas aplicadas`}: se suben tal cual.` : 'Cambios aplicados a la casilla.') + (fijo ? reel ? ' El diseño queda fijado como imagen; su foto está en la bandeja.' : ' El diseño queda fijado como imagen; sus fotos están en la bandeja.' : ''), { ms: fijo ? 8000 : 5000 });
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
  // Without opening the editor. «Sustituir»: only slide 1 changes — its first hole (a free one is filled, a filled one takes
  // the new photo, fitted to it again), else its biggest photo; texts, layers and veil stay as they are. «Añadir», and the
  // other photos of a «Sustituir»: each one into the first slide with a free hole (a slide whose hole is free counts as
  // empty), in order; with no hole left, a new slide at the end (as before). The slides touched are drawn again in the
  // carousel's own proportion. One step of the mesa's ⌘Z.
  async function casilla(slotId, ids, modo) {
    let counted = false;
    const made = [];
    try {
      need(I(), 'La mesa no tiene el puente del editor: actualiza mesa.js (3.25 o posterior).');
      const S = I().S; need(S, 'No hay ninguna mesa abierta.');
      need(!I().locked, LOCKED);
      const s = S.slots.find(x => x.id === slotId); need(s && I().isCarousel(s.type) && !s.design, 'Esa publicación ya no está en la mesa.');
      need(!(E && E.busy) && !APL, 'Espera: el editor está dibujando una publicación.');
      need(!(M.diseno && M.diseno.aplicando && M.diseno.aplicando()), 'Espera: el diseñador está aplicando un diseño.');
      need(!I().uploadsBusy(), 'Espera a que termine la subida a Notion.');
      ids = [...new Set(ids || [])].filter(f => M.files[f] && !M.files[f].design && !isKit(f) && !s.photos.includes(f));
      if (!ids.length) return { ok: true, cambios: 0 };
      const photos0 = s.photos.slice(), d0 = M.files[photos0[0]] || { w: 4, h: 5 };
      const W = OUT_W, H = Math.round(OUT_W / I().fmtRatio(s.fmt || 'v45', d0.w, d0.h));   // the carousel keeps its proportion
      const sl = photos0.map(key => { const f = compOf(S, key); return { key, from: f && f.s !== s ? f.s : null, comp: f ? migrado(clone(f.comp)) : null, mod: false }; });
      const outs = photos0.slice(), nuevas = [], rest = ids.slice();
      let portada = false, hp = false;
      if (modo !== 'add') {
        const f = rest.shift(), x = sl[0];
        if (!x) nuevas.push(f);
        else if (!x.comp) { outs[0] = f; portada = true; }      // slide 1 is a photo, not drawn here: the photo changes, as always
        else if ((hp = x.comp.els.find(e => !e.oculto && (e.t === 'hueco' || (e.t === 'foto' && e.hueco))) || false)) {   // its first hole, free or filled
          need(!hp.pan, 'La foto de la portada cruza diapositivas: cámbiala en «Editar».');
          if (hp.t === 'hueco') rellenar(x.comp, hp, f, W, H); else reajustar(x.comp, hp, f, W, H);
          x.mod = portada = true;
        } else {
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
      if (portada) partes.push(hp ? 'Hueco de la portada rellenado' : sl[0] && sl[0].mod ? 'Foto de la portada cambiada (los textos se quedan)' : 'Foto de la portada cambiada');
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
  const REDO = new Set(), NUMQ = new Set();   // posts waiting to be drawn again: in their new format · with their numbers
  function drenar() {   // what waited, once nothing is being drawn (a new format also brings its numbers up to date)
    if (APL || (E && E.busy) || !(REDO.size || NUMQ.size)) return;
    const ids = [...REDO], ns = [...NUMQ].filter(id => !REDO.has(id)); REDO.clear(); NUMQ.clear();
    setTimeout(() => { ids.forEach(id => redibujar(id)); ns.forEach(id => redibujar(id, true)); }, 0);
  }
  async function redibujar(slotId, soloNum) {   // soloNum: only its numbers (numerosMesa), every slide keeps its own format
    let counted = false;
    const made = [], cola = soloNum ? NUMQ : REDO;
    try {
      const S = I() && I().S, s = S && S.slots.find(x => x.id === slotId);
      if (!s || s.design || !s.photos.length || I().locked || !(s.libre || (soloNum && s.photos.some(k => compOf(S, k))))) return { ok: true, cambios: 0 };   // its numbered images may be another post's compositions
      if ((E && E.busy) || APL) { cola.add(slotId); return { ok: true, pendiente: true }; }
      if (soloNum && ((E && E.board === S && E.slotId === slotId) || I().uploadsBusy() || (M.diseno && M.diseno.aplicando && M.diseno.aplicando()))) { NUM_VISTO.delete(S.key + ':' + slotId); return { ok: true, pendiente: true }; }   // the open editor numbers it; busy: looked at again on the next render
      need(!(M.diseno && M.diseno.aplicando && M.diseno.aplicando()), 'Espera: el diseñador está aplicando un diseño.');
      need(!I().uploadsBusy(), 'Espera a que termine la subida a Notion.');
      const photos0 = s.photos.slice(), d0 = M.files[photos0[0]] || { w: 4, h: 5 };
      const W = OUT_W, H = Math.round(OUT_W / I().fmtRatio(I().cropOf(photos0[0], s).fmt, d0.w, d0.h)), R = W / H;   // the format the mesa shows the post in
      const n = photos0.length, sl = photos0.map((key, j) => {
        const f = compOf(S, key), d = M.files[key]; if (!f || !d) return null;
        const prop = !soloNum && Math.abs(d.w / d.h - R) > 0.005;   // drawn in another format; or its numbers are not its place now
        return prop || numViejo(f.comp, j, n) ? { key, from: f.s !== s ? f.s : null, comp: migrado(clone(f.comp)), H0: Math.round(W * d.h / d.w), prop } : null;
      });
      if (!sl.some(Boolean)) return { ok: true, cambios: 0 };
      const solo = !sl.some(x => x && x.prop);             // only its numbering
      APL++; counted = true; I().setBusy('dz', solo ? 'Poniendo al día la numeración…' : 'Dibujando en el formato nuevo…');
      const outs = photos0.slice(), tipo0 = s.type, reel = I().isReel(tipo0);
      for (let j = 0; j < sl.length; j++) {
        const x = sl[j]; if (!x) continue;
        const Hj = x.prop ? H : x.H0;
        if (x.prop) {
          aProporcion(x.comp, W, x.H0, H);
          fotosDe(x.comp).forEach(e => { if (!e.src) return; if (e.fit != null) encajarWH(e, e.fit, W, H); else if (e.rat && RVAL[e.rat]) marcoRat(e, RVAL[e.rat], e.w * W * e.h * H, W, H); });
        }
        numerar(x.comp, j, n, W, Hj);
        outs[j] = await guardarImagen(await dibujar(x.comp, W, Hj), reel ? `${s.name} portada.jpg` : `${s.name} ${pad2(j + 1)}.jpg`); made.push(outs[j]);
      }
      if (I().S === S && S.slots.includes(s) && s.type !== tipo0) { for (const f of made.splice(0)) { try { await I().deleteIfUnused(f); } catch (e) { /* */ } } REDO.add(slotId); return { ok: true, pendiente: true }; }   // its type changed again: drawn for the type it has now
      if (!(I().S === S && S.slots.includes(s) && I().same(s.photos, photos0) && !s.design && !I().locked)) {
        if (solo) { for (const f of made.splice(0)) { try { await I().deleteIfUnused(f); } catch (e) { /* */ } } if (I().S === S && S.slots.includes(s)) cola.add(slotId); return { ok: true, pendiente: true }; }   // its numbers: again, for what it has now
        throw new LbError(`${s.name} cambió mientras se dibujaba: ábrela en «Editar» y aplica para pasarla al formato nuevo.`);
      }
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
      I().toast(solo ? `${s.name}: numeración al día (${made.length === 1 ? 'una diapositiva redibujada' : `${made.length} diapositivas redibujadas`}).` : `${s.name}: ${made.length === 1 ? 'la imagen editada se ha redibujado' : `${made.length} imágenes editadas se han redibujado`} en su formato nuevo.`, { ms: 5000 });
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

  // «Revisar» (revisar.js, mesa ≥ 3.43), as «Aplicar» draws it on a W×H slide: a text, the box of its ink (its lines, or
  // its pill) turned with it, in px; a photo, how many of its px go across the whole slide's width
  async function medida(el, W, H) {
    if (el.t === 'foto') {
      const f = el.src && M.files[el.src]; if (!f || !f.w) return null;
      const ib = hueco(el, el.w * W, el.h * H), sr = srcRect(el, f.w, f.h, ib.w, ib.h);
      return ib.w > 0 && sr.w > 0 ? { px: sr.w * W / ib.w } : null;
    }
    if (el.t !== 'texto') return null;
    if (el.font && el.font.file) await fuente(el.font).p.catch(() => {});   // its own font, or what «Aplicar» falls back to
    MC.save();
    const L = lineas(MC, el, W), fw = el.w * W, fh = altoTexto(L), px = L.pil ? L.pil.x : 0, py = L.pil ? L.pil.y : 0;
    let a = Infinity, b = -Infinity, t = Infinity, u = -Infinity;
    if (L.pil && L.out.some(s => s.trim())) {
      const lw = Math.min(fw, Math.max(0, ...L.out.map(s => medir(MC, s, L.ls))) + 2 * px);
      a = el.al === 'der' ? fw / 2 - lw : el.al === 'cen' ? -lw / 2 : -fw / 2; b = a + lw; t = -fh / 2; u = fh / 2;
    } else L.out.forEach((s, i) => {                // across, its advance; up and down, its glyphs from the baseline, as drawTexto
      if (!s.trim()) return;
      const lw = medir(MC, s, L.ls), x = el.al === 'der' ? fw / 2 - px - lw : el.al === 'cen' ? -lw / 2 : -fw / 2 + px, y = -fh / 2 + py + i * L.lh + (L.lh - L.px) / 2 + L.px * 0.8;
      const k = MC.measureText(s), up = k.actualBoundingBoxAscent ?? L.px * 0.8, dn = k.actualBoundingBoxDescent ?? L.px * 0.2;
      a = Math.min(a, x); b = Math.max(b, x + lw); t = Math.min(t, y - up); u = Math.max(u, y + dn);
    });
    MC.restore();
    if (!(a <= b)) return null;
    const r = (el.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), cx = el.x * W + fw / 2, cy = el.y * H + fh / 2;
    const p = [[a, t], [b, t], [a, u], [b, u]].map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]);
    return { x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), y0: Math.min(...p.map(q => q[1])), y1: Math.max(...p.map(q => q[1])) };
  }

  M.libre = { version: VERSION, abrir, cerrar: () => cerrar(), sync, abierto: () => !!E, aplicando: () => APL > 0, aplicar: () => aplicar(), casilla, redibujar, migrar, _ed: () => E, bandeja: () => { if (E) bandeja(); },
    rev: { medida, numTxt, numAMano, NUM_RE },   // «Revisar» (revisar.js)
    _dibujar: () => { if (!E) return; if (E.raf) { cancelAnimationFrame(E.raf); E.raf = 0; } frame(); } };   // tests: draw now (a hidden tab gets no frames)
  // a board the mesa opened before this file loaded: its drawn holes become the element too (not a step of ⌘Z)
  { const S = I() && I().S, ids = S && !I().locked ? migrar(S) : []; if (ids.length) { ids.forEach(id => I().histAmend(id)); I().save(); } }
})();
