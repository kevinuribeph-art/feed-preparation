// Controles — Mesa de trabajo · v1.0
// The Mesa's own dropdowns and date and time fields, in its look, light and dark (D-135 and D-136). Every <select>,
// <input type="date"> and <input type="time"> inside the mesa stays in the page as the source of truth (its value and its
// «change»), hidden, with a twin drawn right after it: the mesa, its modules, window.MESA and the tests keep reading and
// listening to the native one, and this file only sets its value and fires its events as the browser does. A twin follows
// its native when the code changes it (value, options, disabled, title). The menus open in one layer of their own, above the
// windows, so nothing clips them, also at 720 px; they close with a click outside, Esc, a scroll or a resize.
//   Dropdown: ↑ ↓ Home End Re Pág Av Pág and letters move, Enter or Space choose, Esc closes, Tab leaves.
//   Date: typed («29/12», «29 dic», «29», «29/12/2026»); ↑ ↓ a day (⇧ a week), Re Pág / Av Pág a month; the calendar opens
//   with a click on the field and ⌥↓ takes the keys into it (← → a day, ↑ ↓ a week, Enter chooses, Esc goes back).
//   Time: typed («1930», «19:30», «9.5», «19»); ↑ ↓ the time before or after in the list (every 15 min, the exact time kept
//   among them), ⇧ an hour; the list opens with a click on the field.
// If this file doesn't load, the mesa keeps the browser's own controls.
(function controlesBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.0';
  if (M.controles && M.controles._off) { try { M.controles._off(); } catch (e) { /* */ } }   // a previous copy on this page
  const QS = 'select, input[type="date"], input[type="time"]';
  const PV = { SELECT: Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value'), INPUT: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') };
  const PSI = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const PASO = 15;                             // minutes between two times of the list
  const MAX_TALLA = 80;                        // a dropdown is as wide as its longest option (as a <select>), up to this many
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const raiz = () => { const X = I(); return (X && X.root && X.root()) || document.getElementById('mesa'); };
  const pocoMov = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const p2 = n => String(n).padStart(2, '0');
  const sinTilde = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const leer = n => PV[n.tagName].get.call(n);
  const poner = (n, v) => PV[n.tagName].set.call(n, v);
  let uid = 0;
  const dato = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false });

  // ---------- dates and times as text ----------
  const iso = d => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  const deIso = v => new Date(Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)));
  const sumarDias = (v, n) => { const d = deIso(v); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  function sumarMeses(v, n) {                  // the same day of the month, or its last day
    const d = deIso(v), y = d.getUTCFullYear(), m = d.getUTCMonth() + n, ult = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return iso(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), ult))));
  }
  const diaSemana = v => (deIso(v).getUTCDay() + 6) % 7;   // 0 = Monday
  function hoyISO() {
    const X = I(); if (X && X.hoy) { try { return X.hoy(); } catch (e) { /* */ } }
    const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }
  const fmtFecha = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '';
  // «29/12/2026», «29/12», «29-12-26», «29 dic», «29 de diciembre», «29», «2912», «2026-12-29»; with no year, the one nearest
  // to the date it had (so «3/1» typed in December is next January)
  function leerFecha(s, ref) {
    const t = sinTilde(String(s || '').trim()).replace(/\s+de(l)?\s+/g, ' ').replace(/[.,]$/, '').replace(/^(lun|mar|mie|jue|vie|sab|dom)[a-z]*\.?\s+/, '');
    if (!t) return null;
    const r0 = /^\d{4}-\d{2}-\d{2}$/.test(ref || '') ? ref : hoyISO(), ry = +r0.slice(0, 4), rm = +r0.slice(5, 7);
    let d, m, y = null, r;
    if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) { y = +r[1]; m = +r[2]; d = +r[3]; }
    else if ((r = /^(\d{1,2})[/\-. ](\d{1,2})(?:[/\-. ](\d{2}|\d{4}))?$/.exec(t))) { d = +r[1]; m = +r[2]; if (r[3]) y = +r[3]; }
    else if ((r = /^(\d{1,2}) ?([a-z]{3,})\.?(?: (\d{2}|\d{4}))?$/.exec(t))) {
      const k = MES.findIndex(x => x.startsWith(r[2].slice(0, 3)) || (r[2].startsWith('set') && x === 'septiembre')); if (k < 0) return null;
      d = +r[1]; m = k + 1; if (r[3]) y = +r[3];
    }
    else if ((r = /^(\d{1,2})$/.exec(t))) { d = +r[1]; m = rm; y = ry; }
    else if ((r = /^(\d{2})(\d{2})(\d{2}|\d{4})?$/.exec(t))) { d = +r[1]; m = +r[2]; if (r[3]) y = +r[3]; }
    else return null;
    if (y != null && y < 100) y += 2000;
    if (y == null) { y = ry; if (m - rm > 6) y--; else if (rm - m > 6) y++; }
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? iso(dt) : null;
  }
  // «19:30», «19.30», «19h30», «1930», «930», «19», «7»
  function leerHora(s) {
    const t = String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/h$/, '');
    let h, m, r;
    if ((r = /^(\d{1,2})[:.,h'](\d{1,2})$/.exec(t))) { h = +r[1]; m = +r[2]; }
    else if (/^\d{1,4}$/.test(t)) { if (t.length <= 2) { h = +t; m = 0; } else { h = +t.slice(0, -2); m = +t.slice(-2); } }
    else return null;
    return h < 24 && m < 60 ? p2(h) + ':' + p2(m) : null;
  }
  const aMin = v => +v.slice(0, 2) * 60 + +v.slice(3, 5);
  const deMin = n => p2(Math.floor(n / 60)) + ':' + p2(n % 60);
  function horas(v) {                          // the list: every 15 minutes and, in its place, the exact time it has
    const L = []; for (let t = 0; t < 1440; t += PASO) L.push(deMin(t));
    if (v && !L.includes(v)) { L.push(v); L.sort(); }
    return L;
  }

  // ---------- twins ----------
  function etiqueta(n) {                       // the text of the <label> around it, without the controls' own text
    const l = n.closest('label'); if (!l) return '';
    return [...l.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim();
  }
  const nombre = n => n.getAttribute('aria-label') || etiqueta(n);
  function mejorar(n) {
    if (n._mx || !n.isConnected || (n.tagName === 'SELECT' && (n.multiple || n.size > 1))) return;   // a list box stays as it is
    const r = raiz(); if (!r || !r.contains(n) || n.closest('.mx-pop')) return;
    const tipo = n.tagName === 'SELECT' ? 'sel' : n.getAttribute('type') === 'time' ? 'hora' : 'fecha';
    const g = tipo === 'sel' ? gemeloSel() : gemeloCampo(tipo);
    dato(n, '_mx', g); dato(g, '_nat', n); dato(g, '_tipo', tipo); dato(g, '_dentro', false); dato(g, '_html', '');
    if (tipo !== 'sel') dato(g.firstChild, '_sync', '');
    n.classList.add('mx-nat'); n.tabIndex = -1; n.setAttribute('aria-hidden', 'true');
    n.after(g);
    const P = PV[n.tagName];
    Object.defineProperty(n, 'value', { configurable: true, get() { return P.get.call(this); }, set(v) { P.set.call(this, v); pintar(this); } });
    if (tipo === 'sel') Object.defineProperty(n, 'selectedIndex', { configurable: true, get() { return PSI.get.call(this); }, set(v) { PSI.set.call(this, v); pintar(this); } });
    n.addEventListener('focus', alFocoNativo);
    pintar(n);
    if (document.activeElement === n) alFocoNativo({ currentTarget: n });   // given the focus before it had its twin
    else recuperar(n);
  }
  function gemeloSel() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mx-sel';
    b.setAttribute('role', 'combobox'); b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => { if (abierto && abierto.g === b) cerrar(true); else abrirSel(b); });
    b.addEventListener('focus', () => entra(b)); b.addEventListener('blur', () => sale(b));
    return b;
  }
  function gemeloCampo(tipo) {
    const g = document.createElement('span'), hora = tipo === 'hora';
    g.className = 'mx-f ' + (hora ? 'mx-time' : 'mx-date');
    g.innerHTML = `<input type="text" class="mx-in" autocomplete="off" spellcheck="false" inputmode="numeric" role="combobox" aria-autocomplete="none" aria-expanded="false" aria-haspopup="${hora ? 'listbox' : 'dialog'}"><button type="button" class="mx-cal" tabindex="-1" aria-label="${hora ? 'Abrir la lista de horas' : 'Abrir el calendario'}"></button>`;
    const inp = g.firstChild, bt = g.lastChild;
    inp.addEventListener('input', e => { e.stopPropagation(); if (abierto && abierto.g === g) seguir(); });
    inp.addEventListener('change', e => e.stopPropagation());   // its own events stay here: the native one fires the mesa's
    inp.addEventListener('click', () => { if (!(abierto && abierto.g === g)) abrirCampo(g, false); });
    bt.addEventListener('pointerdown', e => e.preventDefault());   // the keys stay in the field
    bt.addEventListener('click', () => { if (abierto && abierto.g === g) cerrar(true); else { abrirCampo(g, false); inp.focus({ preventScroll: true }); } });
    for (const x of [inp, bt]) { x.addEventListener('focus', () => entra(g)); x.addEventListener('blur', () => sale(g)); }
    return g;
  }
  // the twin shows what its native has; a field being typed in keeps what is typed until it is confirmed
  function pintar(n) {
    const g = n._mx; if (!g) return;
    const dis = !!n.disabled, lab = nombre(n);
    if (g._tipo === 'sel') {
      const o = n.options[PSI.get.call(n)], txt = o ? (o.label || o.textContent) : '';
      const ops = [...n.options].filter(x => !x.hidden);
      const html = `<span class="mx-v"><span class="mx-t">${esc(txt)}</span>${ops.length <= MAX_TALLA ? `<span class="mx-z" aria-hidden="true">${ops.map(x => `<span>${esc(x.label || x.textContent)}</span>`).join('')}</span>` : ''}</span>`;
      if (g._html !== html) { g.innerHTML = html; g._html = html; }
      g.disabled = dis;
      if (lab) g.setAttribute('aria-label', lab); else g.removeAttribute('aria-label');
      if (n.title) g.title = n.title; else g.removeAttribute('title');
      return;
    }
    const inp = g.firstChild, bt = g.lastChild, v = leer(n), hora = g._tipo === 'hora';
    const txt = hora ? (v || '').slice(0, 5) : fmtFecha(v);
    if (!(document.activeElement === inp && inp.value !== inp._sync)) { inp.value = txt; inp._sync = txt; }
    inp.disabled = bt.disabled = dis; g.classList.toggle('mx-dis', dis);
    inp.placeholder = hora ? '--:--' : 'dd/mm/aaaa';
    inp.setAttribute('aria-label', lab || (hora ? 'Hora' : 'Fecha'));
    g.title = [n.title, hora ? 'Escribe la hora o usa ↑ ↓ (15 min; ⇧, una hora)' : 'Escribe la fecha o usa ↑ ↓ (un día; ⇧, una semana)'].filter(Boolean).join(' · ');
    if (abierto && abierto.g === g && !hora && abierto.marca !== (leerFecha(inp.value, v) || v)) seguir();
  }
  function alFocoNativo(e) {                   // the code gives the focus to its native (after a redraw): it goes to the twin
    const g = e.currentTarget._mx; if (!g || !g.isConnected) return;
    const t = g._tipo === 'sel' ? g : g.firstChild; if (!t.disabled) t.focus({ preventScroll: true });
  }
  // a control that is chosen and drawn again right after (the window redrawn by its change) keeps the focus, as it had it
  let ultimo = null;
  const firma = n => [n.tagName, n.getAttribute('type') || '', [...n.classList].filter(c => c !== 'mx-nat').join('.'), n.getAttribute('aria-label') || '', ...Object.entries(n.dataset).map(([k, v]) => k + '=' + v)].join('|');
  function recuperar(n) {
    if (!ultimo || Date.now() - ultimo.t > 1500 || ultimo.f !== firma(n)) return;
    const a = document.activeElement; if (a && a !== document.body && a.isConnected) return;
    ultimo = null; const g = n._mx; (g._tipo === 'sel' ? g : g.firstChild).focus({ preventScroll: true });
  }
  function disparar(n) {                       // what the browser fires when its own control is changed by hand
    const g = n._mx, a = document.activeElement;
    if (g && a && (a === g || g.contains(a) || (abierto && abierto.pop.contains(a)))) ultimo = { f: firma(n), t: Date.now() };
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // the native one is told when its control gets and loses the focus, as if it were itself (the mesa resets a date typed
  // outside the board when its field is left; the story window keeps the field in use as it is)
  function entra(g) {
    if (g._dentro) return; g._dentro = true; g.classList.add('mx-foco');
    const n = g._nat; if (n && n.isConnected) n.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  }
  function sale(g) {
    setTimeout(() => {
      const a = document.activeElement;
      if (a && (g.contains(a) || (abierto && abierto.g === g && abierto.pop.contains(a)))) return;
      if (!g._dentro) return;
      g._dentro = false; g.classList.remove('mx-foco');
      if (abierto && abierto.g === g) cerrar(false);
      if (!g.isConnected) return;
      if (g._tipo !== 'sel') confirmar(g);
      const n = g._nat; if (n && n.isConnected) n.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }, 0);
  }

  // ---------- the layer of the menus ----------
  let abierto = null;                          // { g, pop, tipo, act, vista, foco, marca }
  function crearPop(cls, role) {
    const p = document.createElement('div');
    p.className = 'mx-pop ' + cls; p.setAttribute('role', role); p.id = 'mx-p' + (++uid);
    p.addEventListener('pointerdown', e => e.preventDefault());   // the focus stays on the control
    raiz().append(p);                          // made when it opens: the editor's inert covers only what was there before
    return p;
  }
  function colocar(pop, g) {                   // under its control, or above if there is more room there; always in the window
    const a = g.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8, sep = 6;
    pop.style.maxHeight = ''; pop.style.left = '0px'; pop.style.top = '0px';
    const w = Math.min(pop.offsetWidth, vw - 2 * m), h = pop.offsetHeight;
    const abajo = vh - a.bottom - sep - m, arriba = a.top - sep - m, sube = h > abajo && arriba > abajo;
    const alto = Math.min(h, Math.max(120, sube ? arriba : abajo));
    if (alto < h) pop.style.maxHeight = alto + 'px';
    pop.style.maxWidth = (vw - 2 * m) + 'px';
    pop.style.left = Math.round(Math.min(Math.max(m, a.left), vw - m - w)) + 'px';
    pop.style.top = Math.round(sube ? a.top - sep - alto : a.bottom + sep) + 'px';
    pop.classList.toggle('arriba', sube);
  }
  function mostrar(pop) { void pop.offsetWidth; pop.classList.add('on'); }
  function vigilar(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    document[f]('pointerdown', fuera, true); document[f]('scroll', alDeslizar, true);
    window[f]('resize', alCambiar); window[f]('blur', alCambiar);
  }
  function fuera(e) { const a = abierto; if (a && !a.pop.contains(e.target) && !a.g.contains(e.target)) cerrar(false); }
  function alDeslizar(e) {                     // the page moves under it: it closes (its own list scrolls inside)
    const a = abierto, t = e.target; if (!a) return;
    if (t && t.nodeType === 1 && (a.pop.contains(t) || a.g.contains(t))) return;
    cerrar(false);
  }
  function alCambiar() { if (abierto) cerrar(false); }
  function cerrar(foco) {
    const a = abierto; if (!a) return;
    abierto = null; vigilar(false);
    const g = a.g, pop = a.pop, c = a.tipo === 'sel' ? g : g.firstChild;
    c.setAttribute('aria-expanded', 'false'); c.removeAttribute('aria-activedescendant'); c.removeAttribute('aria-controls');
    g.classList.remove('mx-abierto');
    pop.classList.remove('on'); pop.classList.add('fuera');
    setTimeout(() => pop.remove(), pocoMov() ? 140 : 180);
    if (foco && g.isConnected && !c.disabled) c.focus({ preventScroll: true });
  }

  // ---------- dropdown ----------
  function abrirSel(b) {
    const n = b._nat; if (!n || n.disabled) return;
    cerrar(false);
    const pop = crearPop('mx-list', 'listbox'), lab = b.getAttribute('aria-label');
    if (lab) pop.setAttribute('aria-label', lab);
    const fila = o => o.hidden ? '' : `<div class="mx-o" role="option" id="${pop.id}-${o.index}" data-i="${o.index}" aria-selected="${o.selected}"${o.disabled ? ' aria-disabled="true"' : ''}>${esc(o.label || o.textContent)}</div>`;
    pop.innerHTML = [...n.children].map(c => c.tagName === 'OPTGROUP' ? `<div role="group" aria-label="${esc(c.label)}"><div class="mx-gl" aria-hidden="true">${esc(c.label)}</div>${[...c.children].map(fila).join('')}</div>` : c.tagName === 'OPTION' ? fila(c) : '').join('');
    pop.style.minWidth = b.offsetWidth + 'px';
    abierto = { g: b, pop, tipo: 'sel', act: -1 };
    b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-controls', pop.id); b.classList.add('mx-abierto');
    pop.addEventListener('pointermove', e => { const o = e.target.closest('.mx-o'); if (o && !o.hasAttribute('aria-disabled') && abierto && +o.dataset.i !== abierto.act) activar(+o.dataset.i, 0, false); });
    pop.addEventListener('click', e => { const o = e.target.closest('.mx-o'); if (o && !o.hasAttribute('aria-disabled')) elegir(b, +o.dataset.i); });
    colocar(pop, b); activar(PSI.get.call(n), 0, true); mostrar(pop); vigilar(true);
  }
  function activar(i, paso, centrar) {
    const a = abierto; if (!a) return;
    const L = [...a.pop.querySelectorAll('.mx-o')], en = L.filter(o => !o.hasAttribute('aria-disabled'));
    let o = L.find(x => (a.tipo === 'sel' ? +x.dataset.i : x.dataset.v) === i) || null;
    if (paso) { let k = en.indexOf(o); if (k < 0) k = paso > 0 ? -1 : en.length; o = en[Math.max(0, Math.min(en.length - 1, k + paso))] || null; }
    else if (o && o.hasAttribute('aria-disabled')) o = null;
    L.forEach(x => x.classList.toggle('act', x === o));
    a.act = o ? (a.tipo === 'sel' ? +o.dataset.i : o.dataset.v) : (a.tipo === 'sel' ? -1 : null);
    const c = a.tipo === 'sel' ? a.g : a.g.firstChild;
    if (o) { c.setAttribute('aria-activedescendant', o.id); ver(a.pop, o, centrar); } else c.removeAttribute('aria-activedescendant');
  }
  function ver(box, o, centrar) {              // its list scrolls by itself: nothing else moves (that would close it)
    const t = o.offsetTop, h = o.offsetHeight, H = box.clientHeight;
    if (centrar) box.scrollTop = t - (H - h) / 2;
    else if (t < box.scrollTop + 4) box.scrollTop = t - 4;
    else if (t + h > box.scrollTop + H - 4) box.scrollTop = t + h - H + 4;
  }
  function primero(fin) { const a = abierto, en = [...a.pop.querySelectorAll('.mx-o:not([aria-disabled])')], o = fin ? en[en.length - 1] : en[0]; if (o) activar(a.tipo === 'sel' ? +o.dataset.i : o.dataset.v, 0, false); }
  let tecleo = '', tecleoT = 0;
  function buscar(ch) {                        // letters typed in a row go to the first option that starts with them
    const a = abierto, now = Date.now(); tecleo = (now - tecleoT < 700 ? tecleo : '') + sinTilde(ch); tecleoT = now;
    const en = [...a.pop.querySelectorAll('.mx-o:not([aria-disabled])')], k0 = en.findIndex(o => +o.dataset.i === a.act), d = tecleo.length === 1 ? 1 : 0;
    const orden = [...en.slice(k0 + d), ...en.slice(0, Math.max(0, k0 + d))];
    const o = orden.find(x => sinTilde(x.textContent).replace(/^@/, '').startsWith(tecleo)); if (o) activar(+o.dataset.i, 0, false);
  }
  function elegir(b, i) {
    const n = b._nat; cerrar(true);
    if (!n || i == null || i < 0 || i === PSI.get.call(n)) return;
    const o = n.options[i]; if (!o || o.disabled) return;
    PSI.set.call(n, i); pintar(n); disparar(n);
  }
  function teclaSel(e, b) {
    const k = e.key, open = abierto && abierto.g === b;
    if (e.metaKey || e.ctrlKey) return;
    const para = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(k)) { para(); abrirSel(b); if (k === 'Home' || k === 'End') primero(k === 'End'); }
      else if (k.length === 1 && !e.altKey) { para(); abrirSel(b); buscar(k); }
      return;
    }
    if (k === 'ArrowDown' || k === 'ArrowUp') { para(); if (e.altKey) elegir(b, abierto.act); else activar(abierto.act, k === 'ArrowDown' ? 1 : -1, false); }
    else if (k === 'PageDown' || k === 'PageUp') { para(); activar(abierto.act, k === 'PageDown' ? 8 : -8, false); }
    else if (k === 'Home' || k === 'End') { para(); primero(k === 'End'); }
    else if (k === 'Enter' || k === ' ') { para(); elegir(b, abierto.act); }
    else if (k === 'Escape') { para(); cerrar(true); }
    else if (k === 'Tab') cerrar(false);
    else if (k.length === 1 && !e.altKey) { para(); buscar(k); }
  }

  // ---------- date and time fields ----------
  function teclaCampo(e, inp) {
    const g = inp.parentNode, k = e.key, hora = g._tipo === 'hora', open = abierto && abierto.g === g;
    if (e.metaKey || e.ctrlKey) return;
    const para = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if ((k === 'ArrowDown' && e.altKey) || k === 'F4') { para(); if (!open) abrirCampo(g, !hora); else if (!hora) focoGrid(); return; }
    if (k === 'ArrowUp' || k === 'ArrowDown') { para(); paso(g, k === 'ArrowUp' ? 1 : -1, e.shiftKey, false); return; }
    if (!hora && (k === 'PageUp' || k === 'PageDown')) { para(); paso(g, k === 'PageUp' ? 1 : -1, false, true); return; }
    if (k === 'Enter') { confirmar(g); if (open) { para(); cerrar(false); } return; }
    if (k === 'Escape') {
      if (open) { para(); cerrar(false); if (inp.value !== inp._sync) inp.value = inp._sync; }
      else if (inp.value !== inp._sync) { para(); inp.value = inp._sync; }
      return;
    }
    if (k === 'Tab' && open) cerrar(false);
  }
  function paso(g, dir, grande, mes) {         // a step, as the browser's arrows: written and given to the native at once
    const n = g._nat, inp = g.firstChild; if (!n || n.disabled) return;
    if (g._tipo === 'hora') {
      const cur = leerHora(inp.value) || (leer(n) || '').slice(0, 5) || '12:00';
      let v;
      if (grande) v = deMin((aMin(cur) + dir * 60 + 1440) % 1440);
      else { const L = horas(cur), i = L.indexOf(cur); v = L[(i + dir + L.length) % L.length]; }
      ponerCampo(g, v);
    } else {
      const base = leerFecha(inp.value, leer(n)) || leer(n) || hoyISO();
      let v = mes ? sumarMeses(base, dir) : sumarDias(base, dir * (grande ? 7 : 1));
      if (n.min && v < n.min) v = n.min > base ? base : n.min;
      if (n.max && v > n.max) v = n.max < base ? base : n.max;
      ponerCampo(g, v);
    }
  }
  function ponerCampo(g, v) {
    const n = g._nat, inp = g.firstChild, txt = g._tipo === 'hora' ? v : fmtFecha(v);
    inp.value = txt; inp._sync = txt;
    if (leer(n) !== v) { poner(n, v); disparar(n); }
    if (abierto && abierto.g === g) seguir();
  }
  function confirmar(g) {                      // what was typed, when it is confirmed (Enter, leaving it); unreadable: back as it was
    const n = g._nat, inp = g.firstChild, hora = g._tipo === 'hora';
    if (!n || inp.value === inp._sync) return;
    const raw = inp.value.trim();
    if (!raw) { if (!n.required && leer(n)) { poner(n, ''); inp._sync = ''; disparar(n); } else inp.value = inp._sync; return; }
    const v = hora ? leerHora(raw) : leerFecha(raw, leer(n));
    if (!v) { inp.value = inp._sync; return; }
    const txt = hora ? v : fmtFecha(v); inp.value = txt; inp._sync = txt;
    if (leer(n) !== v) { poner(n, v); disparar(n); }
  }
  function abrirCampo(g, alGrid) {
    const n = g._nat; if (!n || n.disabled) return;
    if (abierto && abierto.g === g) { if (alGrid) focoGrid(); return; }
    cerrar(false);
    const hora = g._tipo === 'hora', inp = g.firstChild;
    const pop = crearPop(hora ? 'mx-list mx-tlist' : 'mx-calpop', hora ? 'listbox' : 'dialog');
    abierto = { g, pop, tipo: g._tipo, act: null };
    inp.setAttribute('aria-expanded', 'true'); inp.setAttribute('aria-controls', pop.id); g.classList.add('mx-abierto');
    if (hora) {
      pop.setAttribute('aria-label', 'Horas');
      const v = (leer(n) || '').slice(0, 5);
      pop.innerHTML = horas(v).map((h, k) => `<div class="mx-o" role="option" id="${pop.id}-${k}" data-v="${h}" aria-selected="${h === v}">${h}</div>`).join('');
      pop.style.minWidth = Math.max(g.offsetWidth, 112) + 'px';
      pop.addEventListener('pointermove', e => { const o = e.target.closest('.mx-o'); if (o && abierto && o.dataset.v !== abierto.act) activar(o.dataset.v, 0, false); });
      pop.addEventListener('click', e => { const o = e.target.closest('.mx-o'); if (o) { ponerCampo(g, o.dataset.v); cerrar(true); } });
      colocar(pop, g); seguir(true);
    } else {
      pop.setAttribute('aria-modal', 'false');
      const v = leerFecha(inp.value, leer(n)) || leer(n) || hoyISO();
      Object.assign(abierto, { vista: { y: +v.slice(0, 4), m: +v.slice(5, 7) - 1 }, foco: v, marca: v });
      pop.addEventListener('click', calClic);
      pop.addEventListener('focusin', () => entra(g)); pop.addEventListener('focusout', () => sale(g));
      calPintar(0); colocar(pop, g);
    }
    mostrar(pop); vigilar(true);
    if (alGrid) focoGrid();
  }
  function seguir(centrar) {                   // what is typed moves the list or the calendar with it, without choosing yet
    const a = abierto; if (!a) return;
    const inp = a.g.firstChild, n = a.g._nat;
    if (a.tipo === 'hora') {
      const v = leerHora(inp.value) || (leer(n) || '').slice(0, 5);
      const L = [...a.pop.querySelectorAll('.mx-o')].map(o => o.dataset.v), cerca = v ? (L.includes(v) ? v : L.find(x => x > v) || L[L.length - 1]) : '12:00';
      const vn = (leer(n) || '').slice(0, 5);
      a.pop.querySelectorAll('.mx-o').forEach(o => o.setAttribute('aria-selected', String(o.dataset.v === vn)));
      activar(cerca, 0, !!centrar || !L.includes(v));
      return;
    }
    const v = leerFecha(inp.value, leer(n)) || leer(n); if (!v) return;
    const dir = v.slice(0, 7) === `${a.vista.y}-${p2(a.vista.m + 1)}` ? 0 : v > `${a.vista.y}-${p2(a.vista.m + 1)}` ? 1 : -1;
    a.marca = v; a.foco = v; a.vista = { y: +v.slice(0, 4), m: +v.slice(5, 7) - 1 };
    calPintar(dir);
  }
  // the calendar: a month, Monday first, six rows so it never changes height; outside the board's days, they can't be chosen
  function calPintar(dir) {
    const a = abierto; if (!a || a.tipo !== 'fecha') return;
    const n = a.g._nat, { y, m } = a.vista, min = n.min || '', max = n.max || '', sel = leer(n), hoy = hoyISO();
    const d1 = new Date(Date.UTC(y, m, 1)), ini = Date.UTC(y, m, 1 - (d1.getUTCDay() + 6) % 7);
    const ant = iso(new Date(Date.UTC(y, m, 0))), sig = iso(new Date(Date.UTC(y, m + 1, 1)));
    let filas = '';
    for (let f = 0; f < 6; f++) {
      filas += '<div class="mx-row" role="row">';
      for (let c = 0; c < 7; c++) {
        const d = new Date(ini + (f * 7 + c) * 864e5), v = iso(d), otro = d.getUTCMonth() !== m, dis = (min && v < min) || (max && v > max);
        filas += `<button type="button" class="mx-d${otro ? ' otro' : ''}${v === hoy ? ' hoy' : ''}${v === a.marca && v !== sel ? ' marca' : ''}" role="gridcell" data-v="${v}" tabindex="${v === a.foco ? 0 : -1}" aria-selected="${v === sel}"${v === hoy ? ' aria-current="date"' : ''}${dis ? ' disabled' : ''} aria-label="${DIA[c]} ${d.getUTCDate()} de ${MES[d.getUTCMonth()]} de ${d.getUTCFullYear()}">${d.getUTCDate()}</button>`;
      }
      filas += '</div>';
    }
    const titulo = `${MES[m][0].toUpperCase()}${MES[m].slice(1)} ${y}`, hoyNo = (min && hoy < min) || (max && hoy > max);
    a.pop.innerHTML = `<div class="mx-ch"><button type="button" class="mx-nav ant" data-d="-1" aria-label="Mes anterior"${min && ant < min ? ' disabled' : ''}></button><b aria-live="polite">${titulo}</b><button type="button" class="mx-nav sig" data-d="1" aria-label="Mes siguiente"${max && sig > max ? ' disabled' : ''}></button></div>`
      + `<div class="mx-wk" aria-hidden="true">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>`
      + `<div class="mx-days${dir ? (dir > 0 ? ' mx-de' : ' mx-iz') : ''}" role="grid" aria-label="${titulo}">${filas}</div>`
      + `<div class="mx-cf"><button type="button" class="mx-hoy"${hoyNo ? ' disabled' : ''}>Hoy</button></div>`;
  }
  function focoGrid() { const a = abierto; const b = a && a.pop.querySelector('.mx-d[tabindex="0"]:not(:disabled)') || (a && a.pop.querySelector('.mx-d:not(:disabled)')); if (b) b.focus({ preventScroll: true }); }
  function irMes(dir) {
    const a = abierto, y = a.vista.y, m = a.vista.m + dir;
    a.vista = { y: y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    const ult = new Date(Date.UTC(a.vista.y, a.vista.m + 1, 0)).getUTCDate();
    a.foco = `${a.vista.y}-${p2(a.vista.m + 1)}-${p2(Math.min(+a.foco.slice(8, 10), ult))}`;
    calPintar(dir);
  }
  function calClic(e) {
    const a = abierto; if (!a) return;
    const d = e.target.closest('.mx-d'); if (d) { if (!d.disabled) { ponerCampo(a.g, d.dataset.v); cerrar(true); } return; }
    const nv = e.target.closest('.mx-nav');
    if (nv) {
      if (nv.disabled) return;
      const dentro = a.pop.contains(document.activeElement), d = nv.dataset.d; irMes(+d);
      if (dentro) { const x = a.pop.querySelector(`.mx-nav[data-d="${d}"]`); if (x && !x.disabled) x.focus({ preventScroll: true }); else focoGrid(); }   // the keys stay where they were
      return;
    }
    const h = e.target.closest('.mx-hoy'); if (h && !h.disabled) { ponerCampo(a.g, hoyISO()); cerrar(true); }
  }
  function calTecla(e) {
    const a = abierto; if (!a) return;
    const k = e.key, t = e.target, para = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (k === 'Escape') { para(); cerrar(true); return; }
    if (k === 'Tab') {                         // the keys go round inside it until Esc or a day
      const fs = [...a.pop.querySelectorAll('button:not(:disabled)')].filter(b => !b.classList.contains('mx-d') || b.tabIndex === 0);
      const i = fs.indexOf(t); para(); const x = fs[(i + (e.shiftKey ? -1 : 1) + fs.length) % fs.length]; if (x) x.focus({ preventScroll: true });
      return;
    }
    if (!t.classList || !t.classList.contains('mx-d')) { if (k === 'Enter' || k === ' ') e.stopImmediatePropagation(); return; }
    const n = a.g._nat, f0 = a.foco;
    let d = null;
    if (k === 'ArrowLeft') d = sumarDias(f0, -1); else if (k === 'ArrowRight') d = sumarDias(f0, 1);
    else if (k === 'ArrowUp') d = sumarDias(f0, -7); else if (k === 'ArrowDown') d = sumarDias(f0, 7);
    else if (k === 'PageUp') d = sumarMeses(f0, e.shiftKey ? -12 : -1); else if (k === 'PageDown') d = sumarMeses(f0, e.shiftKey ? 12 : 1);
    else if (k === 'Home') d = sumarDias(f0, -diaSemana(f0)); else if (k === 'End') d = sumarDias(f0, 6 - diaSemana(f0));
    else if (k === 'Enter' || k === ' ') { para(); if (!t.disabled) { ponerCampo(a.g, t.dataset.v); cerrar(true); } return; }
    if (!d) return;
    para();
    if (n.min && d < n.min) d = n.min; if (n.max && d > n.max) d = n.max;
    const mv = d.slice(0, 7), mc = `${a.vista.y}-${p2(a.vista.m + 1)}`;
    a.foco = d; if (mv !== mc) a.vista = { y: +d.slice(0, 4), m: +d.slice(5, 7) - 1 };
    calPintar(mv === mc ? 0 : mv > mc ? 1 : -1); focoGrid();
  }

  // ---------- the keys ----------
  // One listener on the window, in the capture phase and from the start, so it hears them before the editor and the
  // designer, which take every key while they are open: a key it uses goes no further; the rest, as before.
  function alTeclear(e) {
    const t = e.target; if (!t || t.nodeType !== 1) return;
    if (t.classList.contains('mx-sel') && t._nat) teclaSel(e, t);
    else if (t.classList.contains('mx-in') && t.parentNode && t.parentNode._nat) teclaCampo(e, t);
    else if (abierto && abierto.tipo === 'fecha' && abierto.pop.contains(t)) calTecla(e);
  }
  function alSoltar(e) {                       // Space opened a dropdown on keydown: its keyup doesn't click it again
    const t = e.target; if (e.key === ' ' && t && t.classList && t.classList.contains('mx-sel')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  window.addEventListener('keydown', alTeclear, true); window.addEventListener('keyup', alSoltar, true);

  // ---------- watching the mesa ----------
  const mo = new MutationObserver(recs => {
    let nuevos = null;
    const anota = x => (nuevos || (nuevos = new Set())).add(x);
    for (const r of recs) {
      const t = r.target;
      if (r.type === 'attributes') { if (t._mx) pintar(t); continue; }
      for (const x of r.addedNodes) {
        if (x.nodeType !== 1) continue;
        if (x.matches(QS)) anota(x);
        else if (x.firstElementChild && (x.getElementsByTagName('select').length || x.getElementsByTagName('input').length)) x.querySelectorAll(QS).forEach(anota);
      }
      for (const x of r.removedNodes) if (x.nodeType === 1 && x._mx && !x.isConnected && x._mx.isConnected) x._mx.remove();   // a native taken away alone
      if (t.nodeType === 1 && (t.tagName === 'SELECT' || t.tagName === 'OPTGROUP' || t.tagName === 'OPTION')) { const s = t.closest('select'); if (s && s._mx) pintar(s); }   // its options changed
    }
    if (nuevos) nuevos.forEach(mejorar);
    if (abierto && (!abierto.g.isConnected || !abierto.g.getClientRects().length)) cerrar(false);   // its control went away
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: false, attributes: true, attributeFilter: ['disabled', 'title', 'min', 'max', 'hidden', 'aria-label'] });
  document.querySelectorAll(QS).forEach(mejorar);

  // ---------- styles (inside #mesa: its tokens, light and dark) ----------
  const CSS = `
#mesa .mx-nat{position:absolute !important;width:1px !important;height:1px !important;min-width:0 !important;min-height:0 !important;margin:0 !important;padding:0 !important;border:0 !important;opacity:0 !important;pointer-events:none !important;overflow:hidden !important;clip-path:inset(50%) !important;flex:none !important}
#mesa .mx-sel{position:relative;display:inline-flex;align-items:center;max-width:100%;min-width:0;box-sizing:border-box;margin:0;font:500 12.5px var(--font);color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:0 30px 0 10px;min-height:32px;cursor:pointer;text-align:left;letter-spacing:normal;transition:border-color var(--d1) ease-out,box-shadow var(--d1) ease-out,background-color var(--d1) ease-out}
#mesa .mx-sel::after{content:'';position:absolute;right:9px;top:50%;width:14px;height:14px;margin-top:-7px;background:var(--mute);-webkit-mask:var(--i-chev) center/contain no-repeat;mask:var(--i-chev) center/contain no-repeat;transition:transform var(--d-m) var(--ease-m)}
#mesa .mx-sel.mx-abierto::after{transform:rotate(180deg)}
#mesa .mx-v{display:grid;min-width:0;flex:1}#mesa .mx-t,#mesa .mx-z>span{grid-area:1/1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#mesa .mx-z{display:contents}#mesa .mx-z>span{visibility:hidden;height:0}
#mesa .mx-sel:hover:not(:disabled),#mesa .mx-f:hover:not(.mx-dis){border-color:var(--line-strong)}
#mesa .mx-sel:focus-visible,#mesa .mx-sel.mx-abierto,#mesa .mx-f.mx-foco,#mesa .mx-f.mx-abierto{outline:0;border-color:var(--ink);box-shadow:0 0 0 3px var(--ring)}
#mesa .mx-sel:disabled{opacity:.5;cursor:default}
#mesa .mx-f{display:inline-flex;align-items:center;box-sizing:border-box;min-height:32px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r-sm);vertical-align:middle;transition:border-color var(--d1) ease-out,box-shadow var(--d1) ease-out}
#mesa .mx-f.mx-dis{opacity:.5}
#mesa .mx-f .mx-in:not(#mx){flex:1 1 auto;box-sizing:content-box;width:10.2ch;min-width:0;height:30px;min-height:0;margin:0;padding:0 2px 0 10px;border:0;border-radius:0;background:none;box-shadow:none;outline:0;font:500 12.5px var(--font);color:var(--ink);font-variant-numeric:tabular-nums;cursor:text}
#mesa .mx-time .mx-in:not(#mx){width:5.2ch}
#mesa .mx-f .mx-in::placeholder{color:var(--faint)}
#mesa .mx-f .mx-cal:not(#mx){position:relative;flex:none;width:28px;height:28px;min-height:0;margin:0 1px 0 0;padding:0;border:0;border-radius:6px;background:none;color:var(--mute);cursor:pointer;transition:background-color var(--d1) ease-out,color var(--d1) ease-out}
#mesa .mx-cal::before{content:'';position:absolute;inset:0;margin:auto;width:15px;height:15px;background:currentColor;-webkit-mask:var(--i-cal) center/contain no-repeat;mask:var(--i-cal) center/contain no-repeat}
#mesa .mx-time .mx-cal::before{-webkit-mask-image:var(--i-clock);mask-image:var(--i-clock)}
#mesa .mx-f .mx-cal:not(#mx):hover:not(:disabled),#mesa .mx-f.mx-abierto .mx-cal:not(#mx){background:var(--bg-2);color:var(--ink)}
#mesa .mx-f .mx-cal:disabled{cursor:default}
#mesa .ubsel+.mx-sel{max-width:100%}#mesa .persel+.mx-sel:not(#mx){flex:none;width:10.6em;max-width:100%}
#mesa .lb-sel+.mx-sel:not(#mx){display:flex;width:100%;min-height:34px;font-size:13px;padding:0 30px 0 10px}
#mesa .hv-lin select+.mx-sel:not(#mx){flex:1;min-width:0;font-size:13px;font-weight:400}#mesa .hv-fh .mx-f{flex:1;min-width:0}#mesa .hv-fh .mx-in:not(#mx){font-size:13px;font-weight:400}
#mesa .vform .mx-f{min-height:28px}#mesa .vform .mx-in:not(#mx){height:26px;font-size:12px}#mesa .vform .mx-cal:not(#mx){width:24px;height:24px}
#mesa .mx-pop{position:fixed;z-index:80;box-sizing:border-box;margin:0;padding:6px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--shadow-lg);font:13px/1.35 var(--font);opacity:0;transform:translateY(-6px) scale(.98);transform-origin:top left;transition:opacity .18s ease-out,transform var(--d-m) var(--ease-m);pointer-events:none}
#mesa .mx-pop.arriba{transform:translateY(6px) scale(.98);transform-origin:bottom left}
#mesa .mx-pop.on{opacity:1;transform:none;pointer-events:auto}
#mesa .mx-pop.fuera{opacity:0;transition:opacity .14s ease-in,transform .14s ease-in;pointer-events:none}
#mesa .mx-list{max-height:360px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;max-width:min(440px,calc(100vw - 16px))}
#mesa .mx-o{position:relative;display:flex;align-items:center;min-height:32px;padding:0 12px 0 32px;border-radius:var(--r-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;color:var(--ink);transition:background-color 60ms linear}
#mesa .mx-o.act{background:var(--bg-2)}
#mesa .mx-o[aria-selected="true"]{font-weight:600}
#mesa .mx-o[aria-selected="true"]::before{content:'';position:absolute;left:10px;top:50%;width:14px;height:14px;margin-top:-7px;background:var(--acc-ink);-webkit-mask:var(--i-check) center/contain no-repeat;mask:var(--i-check) center/contain no-repeat}
#mesa .mx-o[aria-disabled="true"]{color:var(--faint);cursor:default;background:none}
#mesa .mx-gl{padding:8px 12px 4px 32px;font-size:11px;font-weight:600;color:var(--mute)}#mesa [role="group"]+[role="group"] .mx-gl{margin-top:4px;border-top:1px solid var(--line2);padding-top:10px}
#mesa .mx-tlist{max-height:288px}#mesa .mx-tlist .mx-o{font-variant-numeric:tabular-nums;padding-right:16px}
#mesa .mx-calpop{width:280px;padding:12px 12px 8px}
#mesa .mx-ch{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px}#mesa .mx-ch b{font-size:14px;font-weight:800;letter-spacing:-.015em}
#mesa .mx-nav{position:relative;width:30px;height:30px;padding:0;border:0;border-radius:var(--r-pill);background:none;color:var(--ink);cursor:pointer;transition:background-color var(--d1) ease-out}
#mesa .mx-nav::before{content:'';position:absolute;inset:0;margin:auto;width:16px;height:16px;background:currentColor;-webkit-mask:var(--i-chev) center/contain no-repeat;mask:var(--i-chev) center/contain no-repeat;transform:rotate(90deg)}#mesa .mx-nav.sig::before{transform:rotate(-90deg)}
#mesa .mx-nav:hover:not(:disabled){background:var(--bg-2)}#mesa .mx-nav:disabled{color:var(--line-strong);cursor:default}
#mesa .mx-wk,#mesa .mx-row{display:grid;grid-template-columns:repeat(7,1fr)}#mesa .mx-wk{margin:0 0 2px;font-size:11px;font-weight:600;color:var(--mute);text-align:center;line-height:24px}
#mesa .mx-days{display:grid;gap:2px}
#mesa .mx-days.mx-de{animation:mx-de var(--d-m) var(--ease-m)}#mesa .mx-days.mx-iz{animation:mx-iz var(--d-m) var(--ease-m)}
@keyframes mx-de{from{opacity:0;transform:translateX(14px)}}@keyframes mx-iz{from{opacity:0;transform:translateX(-14px)}}
#mesa .mx-d{height:34px;margin:0;padding:0;border:0;border-radius:var(--r-sm);background:none;font:500 13px var(--font);color:var(--ink);font-variant-numeric:tabular-nums;cursor:pointer;transition:background-color var(--d1) ease-out,color var(--d1) ease-out}
#mesa .mx-d.otro{color:var(--faint)}#mesa .mx-d:hover:not(:disabled){background:var(--bg-2)}
#mesa .mx-d.hoy{box-shadow:inset 0 0 0 1px var(--line-strong)}
#mesa .mx-d.marca{box-shadow:inset 0 0 0 1.5px var(--acc)}
#mesa .mx-d[aria-selected="true"]:not(#mx){background:var(--acc);color:var(--on-acc);font-weight:700}
#mesa .mx-d:disabled{color:var(--line-strong);cursor:default}#mesa .mx-d.otro:disabled{color:var(--line)}
#mesa .mx-d:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
#mesa .mx-cf{display:flex;justify-content:flex-end;margin:8px -4px 0;padding:6px 0 0;border-top:1px solid var(--line2)}
#mesa .mx-hoy{margin:0;padding:6px 10px;border:0;border-radius:var(--r-sm);background:none;color:var(--acc-ink);font:600 12.5px var(--font);cursor:pointer;transition:background-color var(--d1) ease-out}#mesa .mx-hoy:hover:not(:disabled){background:var(--bg-2)}#mesa .mx-hoy:disabled{color:var(--faint);cursor:default}
#mesa .mx-nav:focus-visible,#mesa .mx-hoy:focus-visible{outline:0;box-shadow:0 0 0 3px var(--ring)}
@media (prefers-reduced-motion:reduce){#mesa .mx-pop:not(#mx),#mesa .mx-pop.arriba:not(#mx){transform:none !important;transition:opacity .12s linear !important}#mesa .mx-days.mx-de,#mesa .mx-days.mx-iz{animation:none !important}#mesa .mx-sel::after{transition:none !important}}`;
  if (I() && I().estilo) I().estilo('mesa-mx-css', CSS);
  else { const st = document.createElement('style'); st.id = 'mesa-mx-css'; st.textContent = CSS; document.head.append(st); }

  M.controles = {
    version: VERSION,
    gemelo: n => (n && n._mx) || null,         // the control drawn for a native one (tests)
    abierto: () => (abierto ? { tipo: abierto.tipo, pop: abierto.pop, de: abierto.g._nat } : null),
    cerrar: () => cerrar(false),
    _leerFecha: leerFecha, _leerHora: leerHora, _horas: horas,   // tests
    _off: () => { mo.disconnect(); cerrar(false); window.removeEventListener('keydown', alTeclear, true); window.removeEventListener('keyup', alSoltar, true); }
  };
  (window.MESA_CARGA = window.MESA_CARGA || {}).controles = 'ok';
})();
