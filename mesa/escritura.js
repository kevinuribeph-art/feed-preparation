// Escritura — Mesa de trabajo · v1.2 (D-202, D-203, D-283, D-286)
// Quick writing in the personal page's free texts: a note, a task's «Detalles» and a session's texts (never a task's title,
// a caption, a context, the editor's texts nor any other field). Marks at the start of a line (after its indent of 0, 2,
// 4… spaces) and followed by a space: «- » a bullet, «1. » a numbered line (1 to 3 digits), «[] » or «[ ] » a checkbox and
// «[x] » a checkbox done. What is kept is plain text with its marks, never HTML: «⇅ Exportar», an older tab and
// MESA.personal.tareas() read the same as before. The marks are drawn as they are written (L1: the browser's highlighted
// ranges hide or grey them and a layer draws the bullet and the checkbox over them; without that API, the marks only in grey,
// L2) and when read (html()). The «/» menu (M2) at the start of a line offers what is worth it in that field (D-201).
//   M.escritura: version · activar(el, o) → ctl · html(txt, o) · alternar(txt, ln) · lineas(txt) · marca(linea) ·
//   fechaTxt(iso) · menuAbierto() · cerrarMenu()
// If this file doesn't load, the fields work as before: plain text, the browser's keys.
(function escrituraBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.2';   // 1.2: in the iPhone the «/» menu goes in its face and stays over its keyboard, within what the visual viewport shows (D-286). 1.1: bullets and numbers in terracotta (the number in 600 when read), «/.» a list and «/-» a separator «⸻», Tab 4 spaces and a level against the line above, the numbers written again with Tab, ⇧Tab and Intro (D-283)
  if (M.escritura && M.escritura._off) { try { M.escritura._off(); } catch (e) { /* */ } }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTilde = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const raiz = () => { const X = I(); return (X && X.root && X.root()) || document.getElementById('mesa') || document.getElementById('movil') || document.body; };   // the iPhone's face (D-286)
  const svg = b => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
  const ICO = {                                // Lucide (ISC), one stroke (D-168)
    sesion: svg('<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    tarea: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>'),
    fecha: svg('<path d="M8 2v4m8-4v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
    lista: svg('<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>'),
    numerada: svg('<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
    casilla: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
    separador: svg('<path d="M5 12h14"/>')
  };
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], DS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  // «sáb 21 nov» (with the year when it isn't this one): a date written into a note
  function fechaTxt(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return '';
    const X = I(), hoy = X && X.hoy ? X.hoy() : new Date().toISOString().slice(0, 10), w = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay();
    return `${DS[w]} ${+d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]}${d.slice(0, 4) !== hoy.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}`;
  }

  // ---------- the marks ----------
  // at the start of a line, after an even indent, the mark and a normal space (U+0020: «- » looks the same and isn't one)
  const RE = /^((?:  )*)(-|\d{1,3}\.|\[[ xX]?\])( )/;
  function marca(t) {
    const m = RE.exec(t); if (!m) return null;
    const k = m[2], tipo = k === '-' ? 'vi' : k.charAt(0) === '[' ? 'ca' : 'nu';
    return { ind: m[1].length, k, tipo, fin: m[0].length, hecha: tipo === 'ca' && /x/i.test(k), n: tipo === 'nu' ? parseInt(k, 10) : 0 };
  }
  // a separator (D-283): a line with only «⸻» (U+2E3B, a dash nobody types by hand), made from «/-»; read and written, a thin line
  const SEP = '\u2E3B', esSep = t => t.trim() === SEP;
  function lineas(txt) { const L = []; let o = 0; for (const t of String(txt == null ? '' : txt).split('\n')) { L.push({ o, t, m: marca(t), se: esSep(t) }); o += t.length + 1; } return L; }
  const lineaEn = (L, x) => { let l = L[0]; for (const y of L) { if (y.o <= x) l = y; else break; } return l; };
  // the links: http(s) up to a space, without the punctuation that closes a sentence
  const URLRE = /\bhttps?:\/\/[^\s<>"«»]+/g;
  function urls(s) {
    const out = []; let m; URLRE.lastIndex = 0;
    while ((m = URLRE.exec(s))) { let u = m[0]; const c = /[.,;:!?)\]'”’]+$/.exec(u); if (c) u = u.slice(0, -c[0].length); if (u.length > 8) out.push([m.index, u]); URLRE.lastIndex = m.index + Math.max(1, u.length); }
    return out;
  }
  function conEnlaces(s, vivos) {
    let h = '', i = 0;
    for (const [a, u] of urls(s)) { h += esc(s.slice(i, a)) + (vivos ? `<a class="pp-ea" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>` : `<span class="pp-ea">${esc(u)}</span>`); i = a + u.length; }
    return h + esc(s.slice(i));
  }
  // to read: one line each; the marks drawn over their own text (the same width as when written), the line's text hangs after
  // its mark. o.casillas: 'si' (a click marks them, data-ln), 'no' (drawn only: the small post-it), 'vineta' (as bullets: what
  // the client would see); o.enlaces: links that open (in another tab)
  function html(txt, o = {}) {
    const cas = o.casillas || 'si', L = lineas(txt);
    if (L.length === 1 && !L[0].t) return '';
    return L.map((l, i) => {
      const p = l.m;
      if (l.se) return '<div class="pp-el se" role="separator"></div>';
      if (!p) return `<div class="pp-el">${l.t ? conEnlaces(l.t, o.enlaces) : '<br>'}</div>`;
      const rest = l.t.slice(p.fin), ind = p.ind ? `<span class="pp-ei">${' '.repeat(p.ind)}</span>` : '';
      let mk;
      if (p.tipo === 'nu') mk = `<span class="pp-em nu">${esc(p.k)} </span>`;
      else if (p.tipo === 'vi' || cas === 'vineta') mk = `<span class="pp-em vi" aria-hidden="true"><span class="pp-emk">${esc(p.k)}</span> </span>`;
      else mk = `<span class="pp-em ca${p.hecha ? ' on' : ''}"${cas === 'si' ? ` role="checkbox" aria-checked="${p.hecha}" tabindex="0" data-ln="${i}" aria-label="${p.hecha ? 'Hecha' : 'Sin hacer'}"` : ' aria-hidden="true"'}><span class="pp-emk">${esc(p.k)}</span> </span>`;
      const hecha = p.tipo === 'ca' && p.hecha && cas !== 'vineta';
      return `<div class="pp-el ${p.tipo}${hecha ? ' hecha' : ''}">${ind}${mk}<span class="pp-et">${rest ? conEnlaces(rest, o.enlaces) : '<br>'}</span></div>`;
    }).join('');
  }
  // a checkbox marked or unmarked: «[] » ↔ «[x] » on line ln; null if that line has none
  function alternar(txt, ln) {
    const L = String(txt == null ? '' : txt).split('\n'), p = marca(L[ln] || '');
    if (!p || p.tipo !== 'ca') return null;
    L[ln] = L[ln].slice(0, p.ind) + (p.hecha ? '[]' : '[x]') + L[ln].slice(p.ind + p.k.length);
    return L.join('\n');
  }

  // ---------- levels and numbers (D-283) ----------
  // Tab puts 4 spaces and ⇧Tab goes back to the level above; a level counts against the lines above it, so a note of before
  // (with 2) keeps its sublists. In a numbered list, Tab, ⇧Tab and Intro write the numbers again in the text: each run counts
  // on from its first, which keeps its number only if it already was the first of a run and didn't move (a list that starts
  // at 5 goes on at 5); a run that starts now starts at 1. Only in the block of list lines around what changed.
  const sangria = t => /^ */.exec(t)[0].length;
  function corridas(L) {                       // for each numbered line, the index of its run's first; -1 for the rest
    const r = L.map(() => -1);
    for (let i = 0; i < L.length; i++) {
      const p = L[i].m; if (!p || p.tipo !== 'nu' || r[i] >= 0) continue;
      r[i] = i;
      for (let j = i + 1; j < L.length; j++) {
        const q = L[j].m;
        if (q && q.tipo === 'nu' && q.ind === p.ind) { r[j] = i; continue; }
        if (L[j].t.trim() && !L[j].se && sangria(L[j].t) > p.ind) continue;   // deeper: its children
        break;
      }
    }
    return r;
  }
  const primerasDe = L => new Set(corridas(L).map((f, i) => (f === i ? i : -1)).filter(i => i >= 0));
  function numerar(txt, i0, i1, primeras, movidas) {
    const L = lineas(txt), R = corridas(L), dentro = l => !!l && !!l.t.trim() && !l.se && (!!l.m || sangria(l.t) > 0);
    let a = Math.min(i0, L.length - 1), b = Math.min(i1, L.length - 1);
    while (a > 0 && dentro(L[a - 1])) a--; while (b < L.length - 1 && dentro(L[b + 1])) b++;
    const out = L.map(l => l.t), n = {};
    for (let i = a; i <= b; i++) {
      const f = R[i]; if (f < 0) continue;
      n[f] = f in n ? n[f] + 1 : (f === i && primeras.has(f) && !movidas.has(f) ? L[f].m.n : 1);
      const p = L[i].m, k = n[f] + '.';
      if (k !== p.k) out[i] = L[i].t.slice(0, p.ind) + k + L[i].t.slice(p.ind + p.k.length);
    }
    return out.join('\n');
  }
  // Tab: the level of the children of the line above it at its level (a sublist there, of 4 or of 2 of before), or 4 more
  function nivelDentro(L, i) {
    const ind = L[i].m.ind;
    for (let j = i - 1; j >= 0; j--) {
      const l = L[j]; if (!l.t.trim() || l.se) break;
      const s0 = sangria(l.t); if (s0 > ind || !l.m) continue;
      if (s0 < ind) break;                     // its parent: no sister above, one level more
      let h = Infinity; for (let x = j + 1; x < i; x++) { const s1 = sangria(L[x].t); if (L[x].t.trim() && s1 > ind) h = Math.min(h, s1); }
      return h < Infinity ? h : ind + 4;
    }
    return ind + 4;
  }
  // ⇧Tab: the level of its parent (the nearest line above with a mark and less indent), or none
  function nivelFuera(L, i) {
    const ind = L[i].m.ind;
    for (let j = i - 1; j >= 0; j--) { const l = L[j]; if (!l.t.trim() || l.se) break; if (l.m && l.m.ind < ind) return l.m.ind; }
    return 0;
  }
  // the caret of the old text in the new one, line by line (Tab and the numbers change only the start of each line)
  function caretEn(t, t2, x) {
    const L = lineas(t), L2 = lineas(t2), l = lineaEn(L, x), i = L.indexOf(l), l2 = L2[i]; if (!l2) return t2.length;
    const col = x - l.o, ini = l.m ? l.m.fin : sangria(l.t);
    return l2.o + (col >= ini ? Math.max(0, Math.min(l2.t.length, col + l2.t.length - l.t.length)) : Math.min(col, l2.t.length));
  }

  // ---------- a field being written in: its text, its caret ----------
  const conRes = () => !!(window.CSS && CSS.highlights && window.Highlight);   // L1; without it, L2
  function nodos(el) {                         // its text nodes, each with where it starts (as textContent reads them)
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = []; let o = 0, n;
    while ((n = w.nextNode())) { out.push({ n, o }); o += n.data.length; }
    return { L: out, len: o };
  }
  const texto = el => el.textContent;
  function punto(el, x, N) {                   // a text offset as a DOM position
    const { L } = N || nodos(el);
    if (!L.length) return [el, 0];
    for (const t of L) if (x <= t.o + t.n.data.length) return [t.n, Math.max(0, x - t.o)];
    const u = L[L.length - 1]; return [u.n, u.n.data.length];
  }
  function rango(el, a, b, N) { const r = document.createRange(), p = punto(el, a, N), q = punto(el, b, N); r.setStart(p[0], p[1]); r.setEnd(q[0], q[1]); return r; }
  const offDe = (el, node, off) => { const r = document.createRange(); r.setStart(el, 0); r.setEnd(node, off); return r.toString().length; };
  function caret(el) {
    const s = getSelection(); if (!s || !s.rangeCount) return null;
    const r = s.getRangeAt(0); if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
    return { a: offDe(el, r.startContainer, r.startOffset), b: offDe(el, r.endContainer, r.endOffset) };
  }
  function poner(el, a, b = a) { const s = getSelection(), r = rango(el, a, b); s.removeAllRanges(); s.addRange(r); }
  // text through the browser's editing: a line break is «insertLineBreak» (a «\n» in the text, as Enter puts it); «insertText»
  // with a «\n» would make a <div>, which the text read (textContent) loses
  function meter(s) {
    const P = s.split('\n');
    P.forEach((x, i) => { if (i) document.execCommand('insertLineBreak', false); if (x) document.execCommand('insertText', false, x); });
  }
  // a change made here goes through the browser's editing (a step of its own ⌘Z, as what is typed)
  function reemplazar(ctl, a, b, s) {
    const el = ctl.el; if (document.activeElement !== el) el.focus({ preventScroll: true });
    poner(el, a, b); ctl.propio++;
    try { if (s) meter(s); else if (a !== b) document.execCommand('delete', false); }
    finally { ctl.propio--; }
    dibujar(ctl);
  }

  function aplicar(ctl, t, t2, ca, cb) {      // t → t2 through the browser's editing, over what differs; the caret at ca–cb
    if (t2 !== t) {
      let p = 0; while (p < t.length && p < t2.length && t[p] === t2[p]) p++;
      let q = 0; while (q < t.length - p && q < t2.length - p && t[t.length - 1 - q] === t2[t2.length - 1 - q]) q++;
      reemplazar(ctl, p, t.length - q, t2.slice(p, t2.length - q));
    }
    poner(ctl.el, ca, cb);
  }

  // ---------- drawing while writing (L1, or L2 without highlights) ----------
  const ACT = new Set();                       // the fields being written in
  const RES = ['pp-em', 'pp-en', 'pp-eh', 'pp-ea', 'pp-es'];
  function juntar() {                          // the highlights: one set each for every field being written in
    if (!conRes()) return;
    const g = { 'pp-em': [], 'pp-en': [], 'pp-eh': [], 'pp-ea': [], 'pp-es': [] };
    for (const c of ACT) if (c.res) for (const k of RES) g[k].push(...c.res[k]);
    for (const k of RES) { if (g[k].length) CSS.highlights.set(k, new Highlight(...g[k])); else CSS.highlights.delete(k); }
  }
  function dibujar(ctl) {
    ctl.rq = 0;
    const el = ctl.el; if (!el.isConnected) { apagar(ctl); return; }
    const t = texto(el), L = lineas(t), res = { 'pp-em': [], 'pp-en': [], 'pp-eh': [], 'pp-ea': [], 'pp-es': [] }, marcas = [], L1 = conRes(), N = nodos(el);
    for (let i = 0; i < L.length; i++) {
      const l = L[i], p = l.m;
      if (l.se && L1) { const r = rango(el, l.o, l.o + l.t.length, N); res['pp-es'].push(r); marcas.push({ se: true, r }); continue; }
      if (p) {
        const a = l.o + p.ind, b = a + p.k.length, r = rango(el, a, b, N);
        if (p.tipo === 'nu') res['pp-en'].push(r); else res['pp-em'].push(r);
        marcas.push({ p, r, ln: i });
        if (p.hecha && l.t.length > p.fin) res['pp-eh'].push(rango(el, l.o + p.fin, l.o + l.t.length, N));
      }
      if (l.t.length > 8 && l.t.includes('http')) for (const [x, u] of urls(l.t)) res['pp-ea'].push(rango(el, l.o + x, l.o + x + u.length, N));
    }
    ctl.res = res; ctl.L = L;
    juntar();
    // the layer: the bullet and the checkbox over their own text (L1); without highlights, the marks under a veil (L2)
    // measured in the field's own pixels: while its card opens it is scaled (from .97), and the drawings must not move
    const c = ctl.capa, b0 = c.getBoundingClientRect(), k = (el.getBoundingClientRect().width / el.offsetWidth) || 1; let h = '';
    const cs = getComputedStyle(el), izq = (el.getBoundingClientRect().left - b0.left) / k + el.clientLeft + parseFloat(cs.paddingLeft), ancho = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    for (const m of marcas) {
      if (m.se) { const q = m.r.getClientRects()[0] || m.r.getBoundingClientRect(); if (q) h += `<span class="pp-ecm se" style="left:${izq.toFixed(1)}px;top:${((q.top - b0.top) / k).toFixed(1)}px;width:${Math.max(0, ancho).toFixed(1)}px;height:${(q.height / k).toFixed(1)}px"></span>`; continue; }
      if (L1 && m.p.tipo === 'nu') continue;
      const q = m.r.getClientRects()[0]; if (!q) continue;
      const pos = `left:${((q.left - b0.left) / k).toFixed(1)}px;top:${((q.top - b0.top) / k).toFixed(1)}px;width:${(q.width / k).toFixed(1)}px;height:${(q.height / k).toFixed(1)}px`;
      if (!L1) { h += `<span class="pp-ecm gris" style="${pos}"></span>`; continue; }
      h += m.p.tipo === 'vi' ? `<span class="pp-ecm vi" style="${pos}"></span>`
        : `<span class="pp-ecm ca${m.p.hecha ? ' on' : ''}" style="${pos}" data-ln="${m.ln}" title="${m.p.hecha ? 'Hecha' : 'Sin hacer'}"></span>`;
    }
    if (c._h !== h) { c.innerHTML = h; c._h = h; }
  }
  const programar = ctl => { if (!ctl.rq) ctl.rq = requestAnimationFrame(() => dibujar(ctl)); };
  // the field's own background, for the veil of L2
  function fondo(el) { for (let x = el; x && x.nodeType === 1; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) return c; } return ''; }

  // ---------- turning a field on ----------
  // o: { subtareas: true (a task's «Detalles»: «[] » becomes a subtask), comandos: () => ['sesion', …], desc: {k: text},
  //      alComando(k, ctx), alCasilla({txt, hecha, deshacer}), alPegarCasillas([{txt, hecha}]) }
  function activar(el, o = {}) {
    if (el._esc && el._esc.el === el && ACT.has(el._esc)) return el._esc;
    const ctl = { el, o, propio: 0, conv: null, cmd: null, menu: null, res: null, rq: 0, L: [] };
    const c = ctl.capa = document.createElement('div'); c.className = 'pp-ecapa'; c.setAttribute('aria-hidden', 'true');
    el.after(c);
    const cs = getComputedStyle(el); c.style.fontSize = cs.fontSize; c.style.color = cs.color;   // its drawings measure and colour as its text
    if (!conRes()) { const f = fondo(el); if (f) c.style.setProperty('--pp-efondo', f); }
    ctl.on = [
      [el, 'input', e => alInput(ctl, e)], [el, 'keydown', e => alTecla(ctl, e)], [el, 'beforeinput', e => antesInput(ctl, e)],
      [el, 'paste', e => alPegar(ctl, e)], [el, 'compositionend', () => { programar(ctl); if (ctl.menu) menuAlDia(ctl); }],
      [el, 'blur', () => { if (ctl.menu && !ctl.menu.quieto) cerrarMenu(ctl); }],
      [c, 'pointerdown', e => { const x = e.target.closest('.pp-ecm.ca'); if (x) { e.preventDefault(); e.stopPropagation(); } }],
      [c, 'click', e => { const x = e.target.closest('.pp-ecm.ca'); if (!x) return; e.preventDefault(); e.stopPropagation(); marcarLinea(ctl, +x.dataset.ln); }]
    ];
    ctl.on.forEach(([t, ty, f]) => t.addEventListener(ty, f));
    el._esc = ctl; ACT.add(ctl);
    dibujar(ctl);
    ctl.apagar = () => apagar(ctl);
    ctl.reemplazar = (a, b, s) => reemplazar(ctl, a, b, s);
    ctl.caret = () => caret(el);
    ctl.poner = (a, b) => poner(el, a, b);
    ctl.texto = () => texto(el);
    ctl.dibujar = () => dibujar(ctl);
    return ctl;
  }
  function apagar(ctl) {
    if (!ACT.has(ctl)) return;
    if (ctl.menu) cerrarMenu(ctl);
    ctl.on.forEach(([t, ty, f]) => t.removeEventListener(ty, f));
    if (ctl.rq) cancelAnimationFrame(ctl.rq);
    ctl.capa.remove(); ACT.delete(ctl); ctl.res = null; juntar();
    if (ctl.el._esc === ctl) delete ctl.el._esc;
  }
  // a checkbox drawn while writing, clicked: «[] » ↔ «[x] » in the text (a step of the browser's ⌘Z, as typing)
  function marcarLinea(ctl, ln) {
    const t = texto(ctl.el), L = lineas(t), l = L[ln]; if (!l || !l.m || l.m.tipo !== 'ca') return;
    const c = caret(ctl.el), a = l.o + l.m.ind, b = a + l.m.k.length;
    reemplazar(ctl, a, b, l.m.hecha ? '[]' : '[x]');
    if (c) { const d = (l.m.hecha ? 2 : 3) - l.m.k.length, f = x => (x > b ? x + d : x); poner(ctl.el, f(c.a), f(c.b)); }
    ctl.el.dispatchEvent(new Event('input', { bubbles: true }));   // the host saves what is written, as typing
  }

  // ---------- what is typed ----------
  // a line typed as a block (some ways of typing or dictating make a <div> per line): back to plain text with «\n», the caret
  // where it was; what the field keeps is its textContent, which would lose those lines
  function normalizar(ctl) {
    const el = ctl.el, s = getSelection(), M0 = '\uE000';
    if (s && s.rangeCount && el.contains(s.getRangeAt(0).startContainer)) { const r = s.getRangeAt(0).cloneRange(); r.collapse(true); r.insertNode(document.createTextNode(M0)); }
    let out = '';
    const ir = n => { for (const x of [...n.childNodes]) {
      if (x.nodeType === 3) out += x.data;
      else if (x.nodeName === 'BR') { if (!(x.parentNode !== el && x.parentNode.childNodes.length === 1)) out += '\n'; }
      else if (/^(DIV|P)$/.test(x.nodeName)) { if (out && !out.endsWith('\n')) out += '\n'; else if (out) out += '\n'; ir(x); }
      else ir(x);
    } };
    ir(el);
    out = out.replace(/^\n/, '');
    const i = out.indexOf(M0); out = out.replace(M0, '');
    el.textContent = out;
    if (i >= 0) poner(el, i);
  }
  function alInput(ctl, e) {
    if (ctl.propio) return;
    ctl.tras = null;
    if (!e.isComposing && ctl.el.querySelector('div, p')) normalizar(ctl);
    programar(ctl);
    if (e.isComposing) return;
    const el = ctl.el, c = caret(el);
    // a mark just completed with its space: drawn from now on; a ⌘Z right after leaves it written (a hard space)
    if (e.inputType === 'insertText' && e.data === ' ' && c && c.a === c.b) {
      const t = texto(el), L = lineas(t), l = lineaEn(L, c.a - 1), p = l && l.m;
      if (p && c.a === l.o + p.fin) {
        ctl.conv = { off: c.a - 1 };
        if (p.tipo === 'ca' && ctl.o.subtareas && ctl.o.alCasilla) { ctl.conv = null; queueMicrotask(() => { if (ACT.has(ctl)) aSubtarea(ctl, l, p); }); return; }   // after the edit that typed it (never one edit inside another)
      }
    }
    if (e.inputType === 'insertText' && e.data === '/' && c && c.a === c.b && !ctl.menu && ctl.o.comandos) {
      const t = texto(el), L = lineas(t), l = lineaEn(L, c.a - 1);
      if (/^ *$/.test(t.slice(l.o, c.a - 1))) abrirMenu(ctl, c.a - 1);
    }
    if (ctl.menu) menuAlDia(ctl);
  }
  // «[] » in «Detalles»: the line leaves the text and becomes a subtask, where the caret goes (D-183); what follows it on the
  // line is its text. ⌘Z right after (before writing in it) takes it away and puts «[] » back, as a hard space (the host's)
  function aSubtarea(ctl, l, p, txt, volver) {
    const el = ctl.el, t = texto(el), resto = txt != null ? txt : l.t.slice(p.fin);
    const fin = l.o + l.t.length, a = fin < t.length ? l.o : Math.max(0, l.o - 1), b = fin < t.length ? fin + 1 : fin;
    const linea = l.t.slice(0, p.ind) + p.k + ' ' + resto;
    reemplazar(ctl, a, b, '');
    const deshacer = () => {
      const t2 = texto(el), ins = fin < t.length ? linea + '\n' : (a > 0 ? '\n' : '') + linea;
      reemplazar(ctl, Math.min(a, t2.length), Math.min(a, t2.length), ins);
      const at = Math.min(a, t2.length) + (fin < t.length ? linea.length : ins.length); poner(el, at); dibujar(ctl);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    el.dispatchEvent(new Event('input', { bubbles: true }));   // the host saves the text without the line
    ctl.o.alCasilla({ txt: resto, hecha: p.hecha, deshacer: volver || deshacer });
  }
  function antesInput(ctl, e) {
    if (e.inputType === 'historyUndo' && (ctl.conv || ctl.cmd || ctl.tras)) { e.preventDefault(); deshacerPropio(ctl); return; }
    if (e.inputType === 'insertText' && e.data && !ctl.propio && !e.isComposing) {   // typed on a separator's line: on a line of its own under it (D-283)
      const c = caret(ctl.el), t = texto(ctl.el), l = c && lineaEn(lineas(t), c.a);
      if (l && l.se && c.a === c.b) { e.preventDefault(); const fin = l.o + l.t.length; reemplazar(ctl, fin, fin, '\n' + e.data); ctl.el.dispatchEvent(new Event('input', { bubbles: true })); return; }
    }
    // a line typed as a paragraph (not the Enter key: dictation, other ways of typing): a «\n», and in a list it goes on
    if (e.inputType === 'insertParagraph' && !ctl.propio && !e.isComposing) {
      e.preventDefault();
      if (!seguirLista(ctl)) { const c = caret(ctl.el); if (c) reemplazar(ctl, c.a, c.b, '\n'); ctl.el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  }
  // Enter on a list line: the list goes on (the number up), or an empty item ends it; false if the caret isn't in a list
  function seguirLista(ctl) {
    const el = ctl.el, c = caret(el); if (!c) return false;
    const t = texto(el), L = lineas(t), l = lineaEn(L, c.a), p = l.m;
    if (!p || c.a < l.o + p.fin) return false;
    if (!t.slice(l.o + p.fin, l.o + l.t.length).trim() && c.a === c.b) reemplazar(ctl, l.o, l.o + p.fin, '');
    else {
      const ins = '\n' + ' '.repeat(p.ind) + (p.tipo === 'vi' ? '-' : p.tipo === 'nu' ? (p.n + 1) + '.' : '[]') + ' ';
      if (p.tipo !== 'nu') reemplazar(ctl, c.a, c.b, ins);
      else {                                   // the new line and the numbers after it in one edit, one step of ⌘Z (D-283)
        const i = L.indexOf(l), sigue = new Set([...primerasDe(L)].map(f => (f > i ? f + 1 : f))), t1 = t.slice(0, c.a) + ins + t.slice(c.b), x = caretEn(t1, numerar(t1, i, i + 1, sigue, new Set()), c.a + ins.length);
        aplicar(ctl, t, numerar(t1, i, i + 1, sigue, new Set()), x, x);
      }
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  // ⌘Z right after converting or using a command: the Mesa's, not the browser's
  function deshacerPropio(ctl) {
    if (ctl.tras) {                             // the ⌘Z after the Mesa's: what was typed before it goes, never the Mesa's own step undone
      const t = ctl.tras; ctl.tras = null;
      if (texto(ctl.el).slice(t.a, t.b) !== t.s) return false;
      reemplazar(ctl, t.a, t.b, ''); poner(ctl.el, t.a); ctl.el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (ctl.cmd) { const c = ctl.cmd; ctl.cmd = null; ctl.conv = null; c(); if (ctl.cmdQ) { ctl.tras = ctl.cmdQ; ctl.cmdQ = null; } return true; }
    if (ctl.conv) {
      const v = ctl.conv; ctl.conv = null;
      if (texto(ctl.el).charAt(v.off) !== ' ') return false;
      reemplazar(ctl, v.off, v.off + 1, ' '); poner(ctl.el, v.off + 1);
      ctl.el.dispatchEvent(new Event('input', { bubbles: true }));
      const L = lineas(texto(ctl.el)), l = lineaEn(L, v.off), a = l.o + (/^ */.exec(l.t)[0].length);
      ctl.tras = { a, b: v.off + 1, s: texto(ctl.el).slice(a, v.off + 1) };
      return true;
    }
    return false;
  }
  const MODS = ['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'];
  function alTecla(ctl, e) {
    if (e.isComposing || e.keyCode === 229) return;
    const el = ctl.el, k = e.key;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && String(k).toLowerCase() === 'z') {
      if ((ctl.conv || ctl.cmd || ctl.tras) && deshacerPropio(ctl)) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (ctl.menu && menuTecla(ctl, e)) { e.preventDefault(); e.stopPropagation(); return; }
    if (!MODS.includes(k)) { ctl.conv = null; ctl.cmd = null; ctl.tras = null; ctl.cmdQ = null; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = caret(el); if (!c) return;
    const t = texto(el), L = lineas(t), l = lineaEn(L, c.a), p = l.m;
    if (k === 'Enter' && !e.shiftKey && p && c.a >= l.o + p.fin) {   // ⇧Intro, or not in a list: the browser's line break, as before
      e.preventDefault(); e.stopPropagation(); seguirLista(ctl); return;
    }
    { const i = L.indexOf(l), an = L[i - 1];   // ⌫ at the start of the line under a separator: the separator goes, never glued to the text (D-283)
      if (k === 'Backspace' && !e.shiftKey && c.a === c.b && c.a === l.o && an && an.se) { e.preventDefault(); e.stopPropagation(); reemplazar(ctl, an.o, l.o, ''); poner(el, an.o); return; } }
    if (k === 'Backspace' && !e.shiftKey && p && c.a === c.b && c.a === l.o + p.fin) {   // right behind a mark: it goes whole
      e.preventDefault(); e.stopPropagation(); reemplazar(ctl, l.o + p.ind, l.o + p.fin, ''); return;
    }
    if (k === 'Tab') {                         // in a list: a level in (4 spaces) or out (D-283); elsewhere it leaves the field, as before
      const ls = L.filter(x => x.o + x.t.length >= c.a && x.o <= c.b), en = ls.filter(x => x.m);
      if (!en.length) return;
      e.preventDefault(); e.stopPropagation();
      const i0 = L.indexOf(ls[0]), i1 = L.indexOf(ls[ls.length - 1]), ip = L.indexOf(en[0]);
      const d = (e.shiftKey ? nivelFuera(L, ip) : nivelDentro(L, ip)) - en[0].m.ind;
      if (!d) return;
      const out = L.map(x => x.t), movidas = new Set();
      for (let i = i0; i <= i1; i++) { const x = L[i]; if (!x.m) continue; out[i] = ' '.repeat(Math.max(0, x.m.ind + d)) + x.t.slice(x.m.ind); movidas.add(i); }
      const t2 = numerar(out.join('\n'), i0, i1, primerasDe(L), movidas);
      if (t2 === t) return;
      aplicar(ctl, t, t2, caretEn(t, t2, c.a), caretEn(t, t2, c.b));
      return;
    }
  }
  // pasting is the browser's (plain text, its line breaks as «\n», at once); in «Detalles», the «[] » lines pasted become
  // subtasks (D-183) and only the rest goes into the text
  function alPegar(ctl, e) {
    if (!ctl.o.subtareas || !ctl.o.alPegarCasillas) return;
    const cd = e.clipboardData, s0 = cd && cd.getData('text/plain'); if (!s0) return;
    const cas = [], resto = [];
    for (const x of s0.replace(/\r\n?/g, '\n').split('\n')) { const p = marca(x); if (p && p.tipo === 'ca') cas.push({ txt: x.slice(p.fin), hecha: p.hecha }); else resto.push(x); }
    if (!cas.length) return;
    e.preventDefault();
    const c = caret(ctl.el), s = resto.join('\n');
    if (c && s) { reemplazar(ctl, c.a, c.b, s); ctl.el.dispatchEvent(new Event('input', { bubbles: true })); }
    ctl.o.alPegarCasillas(cas);
  }

  // ---------- the «/» menu (M2: each command with what it does, and its keys; Kevin's choice, an exception to D-133) ----------
  const CMD = {
    sesion: { t: 'Sesión', d: 'Una hoja de sesión de foto o vídeo', a: ['sesion'] },
    tarea: { t: 'Tarea', d: 'Una tarea nueva, para escribirla', a: ['tarea'] },
    fecha: { t: 'Fecha', d: 'Escribe una fecha', a: ['fecha', 'dia'] },
    lista: { t: 'Lista', m: '-', d: 'Empieza una lista', a: ['lista', 'vinetas', '.'] },   // «/.» (D-283; «-» is now the separator's)
    numerada: { t: 'Lista numerada', m: '1.', d: 'Empieza una lista numerada', a: ['lista numerada', 'numerada', 'numeros', '1.'] },
    casilla: { t: 'Casilla', m: '[]', d: 'Una casilla para tachar', a: ['casilla', '[]'] },
    separador: { t: 'Separador', sep: true, d: 'Una línea para separar partes', a: ['separador', 'linea', '-'] }   // «/-», only from here (D-283)
  };
  const GRUPO = ['sesion', 'tarea', 'fecha'];
  let MENU = null;                              // the field whose menu is open
  function abrirMenu(ctl, ini) {
    cerrarMenu();
    const el = document.createElement('div');
    el.className = 'cpmenu pp-sm'; el.setAttribute('role', 'listbox'); el.setAttribute('aria-label', 'Comandos');
    el.addEventListener('pointerdown', e => e.preventDefault());   // the caret stays in the field
    el.addEventListener('pointermove', e => { const b = e.target.closest('[data-k]'); if (b && ctl.menu && b.dataset.k !== ctl.menu.act) { ctl.menu.act = b.dataset.k; marcarAct(ctl); } });
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) usar(ctl, b.dataset.k); });
    raiz().append(el);
    ctl.menu = { ini, q: '', act: null, el, ks: [] }; MENU = ctl;
    ctl.el.setAttribute('aria-expanded', 'true');
    menuAlDia(ctl);
  }
  function cerrarMenu(ctl) {
    ctl = ctl || MENU; if (!ctl || !ctl.menu) return;
    ctl.menu.el.remove(); ctl.menu = null; if (MENU === ctl) MENU = null;
    ctl.el.removeAttribute('aria-expanded'); ctl.el.removeAttribute('aria-activedescendant');
  }
  function menuAlDia(ctl) {
    const m = ctl.menu; if (!m) return;
    const t = texto(ctl.el), c = caret(ctl.el);
    if (!c || c.a !== c.b || t.charAt(m.ini) !== '/' || c.a <= m.ini) { cerrarMenu(ctl); return; }
    const q = t.slice(m.ini + 1, c.a);
    if (/\s/.test(q)) { cerrarMenu(ctl); return; }   // a space: the menu goes, what was written stays as text
    m.q = q; pintarMenu(ctl);
  }
  function pintarMenu(ctl) {
    const m = ctl.menu, n = sinTilde(m.q), ks = ctl.o.comandos().filter(k => CMD[k] && (!n || CMD[k].a.some(a => sinTilde(a).split(' ').some(w => w.startsWith(n)) || sinTilde(a).startsWith(n))));
    m.ks = ks;
    if (!ks.includes(m.act)) m.act = ks[0] || null;
    if (!ks.length) { m.el.hidden = true; return; }
    m.el.hidden = false;
    const fila = k => { const d = (ctl.o.desc && ctl.o.desc[k]) || CMD[k].d; return `<button type="button" class="pp-smo" role="option" id="pp-smo-${k}" data-k="${k}" tabindex="-1"><span class="pp-smi">${ICO[k]}</span><span class="pp-smt"><b>${esc(CMD[k].t)}${CMD[k].m ? ` <span class="pp-smm">«${esc(CMD[k].m)}»</span>` : ''}</b><span>${esc(d)}</span></span></button>`; };
    const a = ks.filter(k => GRUPO.includes(k)), b = ks.filter(k => !GRUPO.includes(k));
    m.el.innerHTML = (a.length ? `<div class="pp-smg">${a.map(fila).join('')}</div>` : '') + (a.length && b.length ? '<hr>' : '') + (b.length ? `<div class="pp-smg">${b.map(fila).join('')}</div>` : '')
      + `<p class="pp-smp" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> elegir <kbd>Intro</kbd> usar <kbd>Esc</kbd> dejar «/»</p>`;
    marcarAct(ctl); colocarMenu(ctl);
  }
  function marcarAct(ctl) {
    const m = ctl.menu; if (!m) return;
    m.el.querySelectorAll('.pp-smo').forEach(b => { const on = b.dataset.k === m.act; b.classList.toggle('act', on); b.setAttribute('aria-selected', String(on)); });
    if (m.act) ctl.el.setAttribute('aria-activedescendant', 'pp-smo-' + m.act);
  }
  // under the «/», or above it when it doesn't fit below; always inside what is seen: the visual viewport, so in the iPhone never under
  // its keyboard (D-286; in the Mac, without zoom, it is the window)
  function colocarMenu(ctl) {
    const m = ctl.menu, r = ancla(ctl); if (!r) return;
    const vv = window.visualViewport, v0 = vv ? Math.max(0, vv.offsetTop) : 0, e = m.el, vw = document.documentElement.clientWidth, vh = vv ? v0 + vv.height : innerHeight, g = 8;
    e.style.left = '0px'; e.style.top = '0px';
    const w = e.offsetWidth, h = e.getBoundingClientRect().height, abajo = vh - r.bottom - 6 - g, arriba = r.top - v0 - 6 - g, sube = h > abajo && arriba > abajo;
    e.style.left = Math.round(Math.max(g, Math.min(r.left - 10, vw - w - g))) + 'px';
    e.style.top = Math.floor(Math.max(v0 + g, Math.min(sube ? r.top - 6 - h : r.bottom + 6, vh - h - g))) + 'px';   // always inside what is seen
    e.classList.toggle('arriba', sube);
  }
  function ancla(ctl) {
    const m = ctl.menu, el = ctl.el;
    if (m.ancla) return m.ancla();
    const t = texto(el); if (t.charAt(m.ini) !== '/') return null;
    const q = rango(el, m.ini, m.ini + 1).getClientRects()[0];
    return q || el.getBoundingClientRect();
  }
  function menuTecla(ctl, e) {
    const m = ctl.menu, k = e.key;
    if (k === 'Escape') { cerrarMenu(ctl); return true; }   // the menu goes, «/…» stays written
    if (!m.ks.length) return false;
    if (k === 'ArrowDown' || k === 'ArrowUp') { const i = m.ks.indexOf(m.act), n = m.ks.length; m.act = m.ks[(i + (k === 'ArrowDown' ? 1 : -1) + n) % n]; marcarAct(ctl); return true; }
    if (k === 'Enter' && !e.shiftKey) { if (m.act) { if (ctl.campo) ctl.usarCampo(m.act); else usar(ctl, m.act); } return true; }
    return false;
  }
  // a command used: «/…» goes; ⌘Z right after puts back what was there before it, in one step (the host's part too)
  function usar(ctl, k) {
    const m = ctl.menu; if (!m) return;
    const el = ctl.el, t = texto(el), c = caret(el), a = m.ini, b = c && c.a > a ? c.a : a + 1 + m.q.length;
    cerrarMenu(ctl);
    const antes = { t, caret: b };
    const volver = () => { reemplazar(ctl, 0, texto(el).length, antes.t); poner(el, antes.caret); el.dispatchEvent(new Event('input', { bubbles: true })); };
    if (CMD[k].sep) {                           // a separator: «⸻» on its own line, the caret on the next one (D-283)
      reemplazar(ctl, a, b, SEP + '\n');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      ctl.cmd = volver; ctl.cmdQ = { a, b, s: t.slice(a, b) };
      return;
    }
    if (CMD[k].m) {                             // a mark: written where «/…» was
      if (k === 'casilla' && ctl.o.subtareas && ctl.o.alCasilla) {   // in «Detalles», a subtask (D-183)
        const L = lineas(t), l = lineaEn(L, a), resto = t.slice(b, l.o + l.t.length);
        reemplazar(ctl, a, b, '[] ');
        const L2 = lineas(texto(el)), l2 = lineaEn(L2, a);
        aSubtarea(ctl, l2, l2.m || { ind: 0, k: '[]', fin: 3, hecha: false }, resto, volver);   // ⌘Z right after: «/…» back, not «[] »
        return;
      }
      reemplazar(ctl, a, b, CMD[k].m + ' ');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      ctl.cmd = volver; ctl.cmdQ = { a, b, s: t.slice(a, b) };   // a second ⌘Z takes «/…» away
      return;
    }
    const ctx = {
      a, b, texto: t, ctl, rect: () => { const q = rango(el, Math.min(a, texto(el).length), Math.min(a, texto(el).length)).getClientRects()[0]; return q || el.getBoundingClientRect(); },
      quitar: () => { reemplazar(ctl, a, b, ''); el.dispatchEvent(new Event('input', { bubbles: true })); },
      poner: s => { reemplazar(ctl, a, b, s); el.dispatchEvent(new Event('input', { bubbles: true })); },
      volver,
      deshacerCon: f => { ctl.cmd = () => { f(); volver(); }; }   // the host's part undone with the text
    };
    if (ctl.o.alComando) ctl.o.alComando(k, ctx);
  }
  // a menu for a plain <input> («Nueva tarea»): anchored under the field, only «Sesión» there (D-201)
  function enCampo(inp, o) {
    if (inp._escC) return inp._escC;
    const ctl = { el: inp, o, menu: null, campo: true };
    const al = () => {
      const v = inp.value, c = inp.selectionStart;
      if (!ctl.menu) { if (/^ *\/$/.test(v.slice(0, c))) abrirMenuCampo(ctl, c - 1); return; }
      const m = ctl.menu; if (v.charAt(m.ini) !== '/' || c <= m.ini) { cerrarMenu(ctl); return; }
      const q = v.slice(m.ini + 1, c); if (/\s/.test(q)) { cerrarMenu(ctl); return; }
      m.q = q; pintarMenu(ctl);
    };
    inp.addEventListener('input', e => { if (!e.isComposing) al(); });
    inp.addEventListener('compositionend', al);
    inp.addEventListener('keydown', e => {
      if (e.isComposing || e.keyCode === 229 || !ctl.menu) return;
      if (menuTecla(ctl, e)) { e.preventDefault(); e.stopPropagation(); }
    });
    inp.addEventListener('blur', () => cerrarMenu(ctl));
    ctl.usarCampo = k => { const m = ctl.menu, a = m.ini, b = a + 1 + m.q.length, v = inp.value; cerrarMenu(ctl); if (o.alComando) o.alComando(k, { a, b, texto: v, volver: () => { inp.value = v; inp.setSelectionRange(b, b); } }); };
    inp._escC = ctl; return ctl;
  }
  function abrirMenuCampo(ctl, ini) {
    cerrarMenu();
    const el = document.createElement('div');
    el.className = 'cpmenu pp-sm'; el.setAttribute('role', 'listbox'); el.setAttribute('aria-label', 'Comandos');
    el.addEventListener('pointerdown', e => e.preventDefault());
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) ctl.usarCampo(b.dataset.k); });
    raiz().append(el);
    ctl.menu = { ini, q: '', act: null, el, ks: [], ancla: () => ctl.el.getBoundingClientRect() }; MENU = ctl;
    pintarMenu(ctl);
  }
  // ---------- the page around ----------
  function alSel() {                           // the caret left the «/…» being written: the menu goes
    const c = MENU; if (!c || c.campo || !c.menu) return;
    if (document.activeElement !== c.el) return;
    menuAlDia(c);
  }
  function alFuera(e) { const c = MENU; if (c && c.menu && !c.menu.el.contains(e.target) && e.target !== c.el && !c.el.contains(e.target)) cerrarMenu(c); }
  function alMover() { const c = MENU; if (c && c.menu && !c.menu.el.hidden) colocarMenu(c); for (const x of ACT) programar(x); }
  document.addEventListener('selectionchange', alSel);
  document.addEventListener('pointerdown', alFuera, true);
  window.addEventListener('resize', alMover);
  document.addEventListener('scroll', alMover, true);
  const VV = window.visualViewport;            // the iPhone's keyboard moves what is seen without a resize of the window (D-286)
  if (VV) { VV.addEventListener('resize', alMover); VV.addEventListener('scroll', alMover); }

  // ---------- style: the mesa's tokens (D-131), its icons and stroke (D-168), its scale and weights (D-172) ----------
  const ESTILO = `
#mesa ::highlight(pp-em){color:transparent}
#mesa ::highlight(pp-en){color:var(--acc-ink)}
#mesa ::highlight(pp-es){color:transparent}
#mesa ::highlight(pp-eh){color:var(--mute);text-decoration:line-through}
#mesa ::highlight(pp-ea){color:var(--acc-ink);text-decoration:underline}
#mesa .pp-card.nota ::highlight(pp-en){color:var(--postit-marca)}
#mesa .pp-card.nota ::highlight(pp-eh){color:color-mix(in oklab,var(--postit-ink) 55%,var(--postit-2))}
#mesa .pp-card.nota ::highlight(pp-ea){color:var(--postit-ink)}
#mesa .pp-ecapa{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:1}
#mesa .pp-ecm{position:absolute;pointer-events:none}
#mesa .pp-ecm.gris{background:var(--pp-efondo,var(--panel));opacity:.45}
#mesa .pp-ecm.vi::before,#mesa .pp-em.vi .pp-emk::before{content:'';position:absolute;left:50%;top:50%;width:.3em;height:.3em;margin:-.15em 0 0 -.15em;border-radius:50%;background:var(--pp-marca,var(--acc-ink))}
#mesa .pp-ecm.se::before,#mesa .pp-el.se::before{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:var(--pp-raya,var(--line-strong))}
#mesa .pp-el.se{position:relative;height:1.1em;margin:.25em 0}
#mesa .pp-ecm.ca{pointer-events:auto;cursor:pointer}
#mesa .pp-ecm.ca::before,#mesa .pp-em.ca .pp-emk::before{content:'';position:absolute;right:-.02em;top:50%;width:.8em;height:.8em;margin:-.4em 0 0;box-sizing:border-box;border-radius:50%;box-shadow:inset 0 0 0 1.5px currentColor;opacity:.75;transition:background var(--d1) var(--ease),box-shadow var(--d1) var(--ease)}
#mesa .pp-ecm.ca:hover::before,#mesa .pp-em.ca[data-ln]:hover .pp-emk::before{opacity:1}
#mesa .pp-ecm.ca.on::before,#mesa .pp-em.ca.on .pp-emk::before{background:var(--acc);box-shadow:none;opacity:1}
#mesa .pp-ecm.ca.on::after,#mesa .pp-em.ca.on .pp-emk::after{content:'';position:absolute;right:.1em;top:50%;width:.56em;height:.56em;margin:-.28em 0 0;background:var(--on-acc);-webkit-mask:var(--i-check) center/100% no-repeat;mask:var(--i-check) center/100% no-repeat}
#mesa .pp-el{display:flex;min-width:0}
#mesa .pp-ei,#mesa .pp-em{flex:none;white-space:pre}
#mesa .pp-em.vi,#mesa .pp-em.ca{color:transparent}
#mesa .pp-emk{position:relative;display:inline-block;color:transparent}
#mesa .pp-em.ca .pp-emk::before{box-shadow:inset 0 0 0 1.5px var(--pp-tinta,var(--ink-2))}
#mesa .pp-em.ca[data-ln]{cursor:pointer;outline:none}
#mesa .pp-el.ca .pp-et{padding-left:.22em}   /* read, a little air after the checkbox (written, its mark is only its own text) */
#mesa .pp-em.ca[data-ln]:focus-visible .pp-emk{outline:2px solid var(--focus);outline-offset:2px;border-radius:50%}
#mesa .pp-em.nu{color:var(--pp-marca,var(--acc-ink));font-weight:600}   /* read only: written, the highlight changes only its colour (D-283) */
#mesa .pp-et{flex:1;min-width:0}
#mesa .pp-el.hecha .pp-et{text-decoration:line-through;color:var(--mute)}
#mesa .pp-ea{color:var(--acc-ink);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
#mesa a.pp-ea{cursor:pointer}#mesa a.pp-ea:hover{text-decoration-thickness:2px}
#mesa a.pp-ea:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:var(--r-xs)}
#mesa .pp-card.nota .pp-el.hecha .pp-et,#mesa .pp-pt .pp-el.hecha .pp-et{color:color-mix(in oklab,var(--postit-ink) 55%,var(--postit-2))}
#mesa .pp-card.nota .pp-ea,#mesa .pp-pt .pp-ea{color:var(--postit-ink)}
#mesa .pp-card.nota,#mesa .pp-pt{--pp-tinta:var(--postit-ink);--pp-marca:var(--postit-marca);--pp-raya:color-mix(in oklab,var(--postit-ink) 35%,var(--postit-2))}
/* the «/» menu (M2) */
#mesa .pp-sm{position:fixed;z-index:72;width:288px;max-width:calc(100vw - 16px);padding:6px;animation:pp-smin var(--d2) var(--ease)}
#mesa .pp-sm.arriba{animation-name:pp-smup}
@keyframes pp-smin{from{opacity:0;transform:translateY(-3px)}}@keyframes pp-smup{from{opacity:0;transform:translateY(3px)}}
#mesa .pp-sm[hidden]{display:none}
#mesa .pp-smg{display:flex;flex-direction:column;gap:1px}
#mesa .pp-sm .pp-smo{justify-content:flex-start;gap:10px;width:100%;min-height:44px;padding:5px 8px;font:inherit;cursor:pointer}
#mesa .pp-sm .pp-smo.act,#mesa .pp-sm .pp-smo.act:hover{background:var(--bg-2)}
#mesa .pp-smi{flex:none;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--r-sm);background:var(--bg-2);color:var(--ink-2)}
#mesa .pp-smo.act .pp-smi{background:var(--panel-2);box-shadow:var(--shadow-xs)}
#mesa .pp-smi svg{width:16px;height:16px;stroke-width:var(--i-trazo)}
#mesa .pp-smi svg path,#mesa .pp-smi svg rect,#mesa .pp-smi svg circle{vector-effect:non-scaling-stroke}
#mesa .pp-smt{display:flex;flex-direction:column;min-width:0;text-align:left;line-height:1.3}
#mesa .pp-smt b{font-size:13px;font-weight:600;color:var(--ink)}
#mesa .pp-smm{font-weight:400;color:var(--mute)}
#mesa .pp-smt > span{font-size:12px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .pp-smp{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:4px 0 0;padding:6px 8px 2px;border-top:1px solid var(--line2);font-size:11.5px;color:var(--mute)}
#mesa .pp-smp kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border:1px solid var(--line);border-bottom-width:2px;border-radius:var(--r-xs);background:var(--bg);font:600 11px/1 var(--font);color:var(--ink-2)}
#mesa .pp-smp kbd + kbd{margin-left:-1px}#mesa .pp-smp kbd:not(:first-child){margin-left:6px}#mesa .pp-smp kbd + kbd{margin-left:2px}
@media (prefers-reduced-motion:reduce){#mesa .pp-sm,#mesa .pp-sm.arriba{animation:none}#mesa .pp-ecm.ca::before{transition:none}}
`;
  function estilo() {
    const X = I();
    if (X && X.estilo) X.estilo('mesa-es-css', ESTILO);
    else if (!document.getElementById('mesa-es-css')) { const s = document.createElement('style'); s.id = 'mesa-es-css'; s.textContent = ESTILO; document.head.append(s); }
  }
  estilo();

  M.escritura = {
    version: VERSION, activar, html, alternar, lineas, marca, fechaTxt, urls, enCampo,
    menuAbierto: () => !!(MENU && MENU.menu && !MENU.menu.el.hidden),
    menuDe: el => !!(MENU && MENU.el === el && MENU.menu && !MENU.menu.el.hidden),
    cerrarMenu: () => cerrarMenu(),
    pendiente: el => !!(el && el._esc && (el._esc.conv || el._esc.cmd || el._esc.tras)),
    deshacer: el => !!(el && el._esc && deshacerPropio(el._esc)),
    _off: () => {
      cerrarMenu(); [...ACT].forEach(apagar);
      document.removeEventListener('selectionchange', alSel); document.removeEventListener('pointerdown', alFuera, true);
      window.removeEventListener('resize', alMover); document.removeEventListener('scroll', alMover, true);
      if (VV) { VV.removeEventListener('resize', alMover); VV.removeEventListener('scroll', alMover); }
    }
  };
  (window.MESA_CARGA = window.MESA_CARGA || {}).escritura = 'ok';
})();
