// Calendario — Mesa de trabajo · v1.2
// The open board's month under the tray (half of the right column), Monday to Sunday as in Notion: one chip per post —
// its short name, time and the mark of its state (a dot, ✓, two ✓ or ✕: the mesa's estIco, D-081) — on a pastel of its
// type, as Notion's tags. A cancelled post says why on hover, if it has a reason (D-082). Linked both ways with the grid:
// a click opens the same post view as its cell, hovering one lights the other up. It reads the board only through the
// mesa's bridge (M._in, mesa ≥ 3.32) and is drawn again on every redraw of the grid (renderFeed → M.calendario.render):
// it keeps no copy of any post. If this file doesn't load, the mesa works as before (the tray takes the whole column).
//   Folded: a thin bar with its title and the changes not yet in Notion; the weekly count column folds too. Both are
//   remembered per browser (localStorage; if it can't be read, open).
//   Months: the board's cycles and, before them, the previous month (its published posts in grey, read only); the days
//   outside the board's cycles are dimmed.
//   Weekly count: the posts of each week on the days of the month shown, so the weeks add up to the month's total;
//   cancelled posts don't count.
//   Moving: a chip dragged to another day keeps its time and goes through the mesa's setDate, as the post view's date field
//   (it renumbers, reorders the grid, reaches a collab's boards and is one step of ⌘Z); a past day is refused.
//   Notion: the mesa doesn't read Notion live — each chip has the grid's mark of changes since the last upload (1.1: the one
//   mark of D-081, also for a caption, photo or contexto), and the header says how many dates, names or types are not uploaded yet and when the board last had Notion's data (S.notionAt: loaded or upload confirmed).
//   Vista cliente: read only — type, time and colour; no moving, no states, no Notion marks, no cancelled posts.
//   The month's step (1.2, D-084, mesa ≥ 3.68): the legend is the open board's step bar — Por empezar › Captions › Por
//   aprobar › Aprobado › Programado › Publicado, each with its mark (still the legend of the chips) — and, apart and only as a
//   legend, No aprobado and Cancelado, which are states of a post, not steps. The steps done in ink (pressed, the month goes
//   back), the current one in a black pill, the next one with a thin border (pressed, the month goes on) and the later ones
//   in grey. Every change asks first and says what will happen, with figures; a post that is behind never stops it: it is
//   listed and stays as it is. Going on to:
//     Captions      warns of the posts without a photo or a contexto
//     Por aprobar   runs «Revisar» (the feed and the stories, D-040, D-058) and shows its points
//     Aprobado      the posts «Por aprobar» become «Aprobado» (M.setEstado): the only step that changes posts
//     Programado    schedules nothing: how many are scheduled and how many are not; the approved reels, as «Reels: N por
//                   programar», with «Marcar como programados» (asks first; the same ✓ as the scheduled posts)
//     Publicado     marks the month as published; each post is still marked by hand
//   Going back changes the step only. The step and what it changes are one step of ⌘Z. Nothing of it in the vista cliente.
(function calendarioBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.2';
  if (M.calendario && M.calendario._off) { try { M.calendario._off(); } catch (e) { /* */ } }   // a previous copy on this page
  const LS_FOLD = 'mesa-cal-plegado', LS_CNT = 'mesa-cal-recuento';
  const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  // pastel of each type (Notion's tag colours); the dot of each state is the mesa's (.edot.e-<state>), other hues
  const TYPE = { 'Reel': 'reel', 'Collab Reel': 'collab', 'Foto': 'foto', 'Carrusel': 'carr', 'Trial Reel': 'trial' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssq = v => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&');
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage off: not remembered */ } }
  const NARROW = window.matchMedia ? window.matchMedia('(max-width:720px)') : { matches: false };
  const folded = () => { const v = lsGet(LS_FOLD); return v === '1' || (v == null && NARROW.matches); };   // a narrow pane starts folded
  const cntFolded = () => lsGet(LS_CNT) === '1';

  // ---------- days ('YYYY-MM-DD', Madrid) and months ('YYYY-MM') ----------
  function addMonths(m, k) { let [y, mo] = m.split('-').map(Number); mo += k; y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12 + 12) % 12 + 1; return y + '-' + String(mo).padStart(2, '0'); }
  const utc = d => { const [y, m, x] = d.split('-').map(Number); return Date.UTC(y, m - 1, x); };
  const dayAt = t => new Date(t).toISOString().slice(0, 10);
  const addDays = (d, k) => dayAt(utc(d) + k * 864e5);
  const dow = d => (new Date(utc(d)).getUTCDay() + 6) % 7;            // Monday 0 … Sunday 6
  // what the calendar spans: the previous cycle (published, read only) and the board's cycles
  function span(X) {
    const ms = X.boardMonths(), cd = X.curCd(), lo = X.cycleStart(ms[0], cd), hi = X.cycleEnd(ms[ms.length - 1], cd);
    const plo = X.cycleStart(addMonths(ms[0], -1), cd), list = [];
    for (let m = plo.slice(0, 7); m <= hi.slice(0, 7); m = addMonths(m, 1)) list.push(m);
    return { lo, hi, plo, list, first: lo.slice(0, 7) };
  }
  let view = { key: null, m: null };           // the month shown, per open board (opening another board shows its first month)

  // ---------- drawing ----------
  let hi = null;                               // {k: 'slot' | 'prev', id} lit up in both places
  function chipHTML(X, s, client) {
    const est = X.estadoDe(s), lab = X.ESTADOS.find(e => e[0] === est), t = X.localTime(s.date), mot = est === 'cancelado' ? X.motivoDe(s) : '';
    const cls = `chip ty-${TYPE[s.type] || 'otro'}${est === 'cancelado' ? ' cx' : ''}`;
    const mk = client || est === 'cancelado' ? '' : X.cambiosIco(s, 'cmk');   // the grid's own mark of changes
    const tit = `${s.name} · ${X.fmtDate(s.date)}${est === 'cancelado' ? ' · Cancelada' + (mot ? ': ' + mot : '') : ''}`;
    return `<button type="button" class="${cls}" data-slot="${esc(s.id)}" title="${esc(tit)}">`
      + `<span class="cl">${client ? '' : X.estIco(est, ` title="${esc(lab ? lab[1] : est)}"`)}<span class="cn">${esc(X.shortLabel(s.name, s.type))}</span>${mk}</span>`
      + (t ? `<span class="ct">${esc(t)}</span>` : '') + '</button>';
  }
  const pastHTML = (X, p) => `<button type="button" class="chip past" data-prev="${esc(p.id)}" title="${esc(p.name)} · ${esc(X.fmtDate(p.date))} · publicada">`
    + `<span class="cl"><span class="cn">${esc(X.shortLabel(p.name, p.type))}</span></span>${X.localTime(p.date) ? `<span class="ct">${esc(X.localTime(p.date))}</span>` : ''}</button>`;
  const when = (X, iso) => X.dOnly(iso) ? -1 : +X.localTime(iso).replace(':', '');   // a post without a time goes first, as in Notion

  function render() {
    if (mv && mv.on) { later = true; return; }   // a chip being moved: drawn again once it is let go
    const X = I(); if (!X || !X.shellReady || !X.shellReady()) return;
    const root = X.root(), sec = root && root.querySelector('.side > .cal'); if (!sec) return;
    const S = X.S; if (!S) { sec.hidden = true; return; }
    const client = root.classList.contains('client'), sp = span(X);
    if (view.key !== S.key || !sp.list.includes(view.m)) view = { key: S.key, m: sp.first };
    const m = view.m, [y, mo] = m.split('-').map(Number), today = X.hoy();
    // posts by day (sorted by time; a cancelled one is drawn crossed out, never in the vista cliente)
    const by = {};
    S.slots.forEach(s => { const d = X.localDay(s.date); if (d) (by[d] = by[d] || []).push({ s, t: when(X, s.date) }); });
    X.pastList(false).forEach(p => { const d = X.localDay(p.date); if (d && !S.slots.some(s => s.id === p.id)) (by[d] = by[d] || []).push({ p, t: when(X, p.date) }); });
    Object.values(by).forEach(a => a.sort((u, v) => u.t - v.t));
    const live = it => it.p || X.estadoDe(it.s) !== 'cancelado';       // what counts (and what the vista cliente shows)
    const first = `${m}-01`, start = addDays(first, -dow(first)), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const rows = Math.ceil((dow(first) + dim) / 7), cf = cntFolded();
    let body = DOW.map(d => `<div class="cdow">${d}</div>`).join('')
      + `<button type="button" class="cdow ccnt" data-cal="cnt" title="${cf ? 'Ver el recuento de cada semana' : 'Plegar el recuento'}" aria-expanded="${!cf}">Σ</button>`;
    let total = 0;
    for (let r = 0; r < rows; r++) {
      let n = 0;
      for (let c = 0; c < 7; c++) {
        const d = addDays(start, r * 7 + c), inM = d.slice(0, 7) === m, items = (by[d] || []).filter(it => !client || live(it));
        const k = items.filter(live).length; if (inM) n += k;
        const cls = `cday${inM ? '' : ' out'}${d < sp.plo || d > sp.hi ? ' off' : d < sp.lo ? ' prevc' : ''}${d === today ? ' today' : ''}`;
        const num = +d.slice(8) === 1 ? `${+d.slice(8)} ${X.MONTHS[+d.slice(5, 7) - 1].slice(0, 3)}` : String(+d.slice(8));
        body += `<div class="${cls}" data-day="${d}"><div class="dh"><span class="dn">${num}</span>${k > 1 && !client ? `<span class="dmany" title="${k} publicaciones este día">${k}</span>` : ''}</div>`
          + items.map(it => it.p ? pastHTML(X, it.p) : chipHTML(X, it.s, client)).join('') + '</div>';
      }
      total += n;
      body += `<div class="ccnt${n ? '' : ' z'}" title="${n} publicaci${n === 1 ? 'ón' : 'ones'} esta semana en ${X.MONTHS[mo - 1]}">${cf ? '' : n}</div>`;
    }
    if (!cf) body += `<div class="ctot">Total de ${X.MONTHS[mo - 1]}</div><div class="ccnt ctotn" title="${total} publicaci${total === 1 ? 'ón' : 'ones'} en ${X.MONTHS[mo - 1]}">${total}</div>`;
    const i = sp.list.indexOf(m), pend = M.notionChanges ? M.notionChanges().length : 0, fo = folded();
    const sync = pend ? `<span class="csync c" title="Fecha, hora, tipo o nombre cambiados aquí: se pasan a Notion al subir"><i class="dchg"></i>${pend} cambio${pend === 1 ? '' : 's'} sin subir</span>` : '<span class="csync">Igual que Notion</span>';
    const nat = `<span class="cnat" title="La mesa no lee Notion en directo: es la última vez que este mes se cargó desde Notion o se confirmó una subida">Notion a fecha de: ${S.notionAt ? esc(X.fmtDate(S.notionAt)) : '—'}</span>`;
    const leg = X.PASOS ? pasosHTML(X) : `<div class="cleg">${X.ESTADOS.map(([k, l]) => `<span>${X.estIco(k)}${esc(l)}</span>`).join('')}</div>`;   // a mesa before 3.68: the legend as it was
    const bodyEl = sec.querySelector('.calbody'), top = bodyEl ? bodyEl.scrollTop : 0;
    sec.hidden = false;
    sec.classList.toggle('fold', fo); sec.classList.toggle('nocnt', cf);
    sec.innerHTML = `<div class="calhead"><button type="button" class="cfold" data-cal="fold" aria-expanded="${!fo}" title="${fo ? 'Abrir el calendario' : 'Plegar el calendario'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg><b>Calendario</b></button>${sync}${nat}`
      + `<span class="cnav"><button type="button" data-cal="prev" aria-label="Mes anterior" ${i > 0 ? '' : 'disabled'}>‹</button><span class="cmes">${esc(cap(X.MONTHS[mo - 1]))} ${y}</span><button type="button" data-cal="next" aria-label="Mes siguiente" ${i < sp.list.length - 1 ? '' : 'disabled'}>›</button></span></div>`
      + `${leg}<div class="calbody"><div class="cgrid" style="grid-template-rows:auto repeat(${rows},minmax(58px,auto))${cf ? '' : ' auto'}">${body}</div></div>`;
    const nb = sec.querySelector('.calbody'); if (nb && top) nb.scrollTop = top;
    light();
  }

  // ---------- linked with the grid ----------
  function light() {
    const X = I(), root = X && X.root && X.root(); if (!root) return;
    root.querySelectorAll('.calhi').forEach(e => e.classList.remove('calhi'));
    if (!hi) return;
    const a = hi.k === 'prev' ? 'data-prev' : 'data-slot', q = `[${a}="${cssq(hi.id)}"]`;
    root.querySelectorAll(`.feed .grid .cell${q}, .side > .cal .chip${q}`).forEach(e => e.classList.add('calhi'));
  }
  function onOver(e) {
    const t = e.target && e.target.closest ? e.target : null; if (!t || !t.closest('#mesa')) return;
    const el = t.closest('#mesa .side > .cal .chip, #mesa .feed .grid .cell');
    const nx = el && el.dataset.slot ? { k: 'slot', id: el.dataset.slot } : el && el.dataset.prev ? { k: 'prev', id: el.dataset.prev } : null;
    if ((nx && nx.id) === (hi && hi.id) && (nx && nx.k) === (hi && hi.k)) return;
    hi = nx; light();
  }
  function onClick(e) {
    const X = I(); if (!X || !e.target.closest) return;
    const dl = e.target.closest('#mesa .detail[data-dlg="paso"] [data-cal]'); if (dl) { enPaso(dl); return; }   // the step's confirmation
    const sec = e.target.closest('#mesa .side > .cal'); if (!sec) return;
    const root = X.root(), client = root.classList.contains('client');
    const b = e.target.closest('[data-cal]');
    if (b) {
      const a = b.dataset.cal;
      if (a === 'paso') { if (!client) abrirPaso(b.dataset.paso); return; }
      if (a === 'fold') lsSet(LS_FOLD, folded() ? '0' : '1');
      else if (a === 'cnt') lsSet(LS_CNT, cntFolded() ? '0' : '1');
      else if (a === 'prev' || a === 'next') { const sp = span(X), i = sp.list.indexOf(view.m) + (a === 'prev' ? -1 : 1); if (sp.list[i]) view.m = sp.list[i]; }
      render(); return;
    }
    const ch = e.target.closest('.chip'); if (!ch || Date.now() - noClick < 400) return;   // the click that ends a move opens nothing
    if (ch.dataset.slot) { if (client) X.openIG(ch.dataset.slot, 0); else X.openDetail(ch.dataset.slot, 0); }
    else if (ch.dataset.prev) { const id = ch.dataset.prev; if (client) X.openIG(id, 0); else X.withPrev(() => X.openPast(id), 'open'); }
  }

  // ---------- the month's step (D-084) ----------
  const nDe = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;
  const PUB = k => nDe(k, 'publicación', 'publicaciones');
  function pasosHTML(X) {
    const P = X.PASOS, i = P.findIndex(p => p[0] === X.pasoDe(X.S));
    const pasos = P.map(([k, l], j) => {
      const ico = X.estIco(k, ' aria-hidden="true"'), t = `${ico}${esc(l)}`;
      if (j === i) return `<span class="cpaso act" aria-current="step" title="El mes va en ${esc(l)}">${t}</span>`;
      if (j === i + 1) return `<button type="button" class="cpaso sig" data-cal="paso" data-paso="${k}" title="Pasar el mes a ${esc(l)}">${t}</button>`;
      if (j < i) return `<button type="button" class="cpaso hecho" data-cal="paso" data-paso="${k}" title="Volver a ${esc(l)}">${t}</button>`;
      return `<span class="cpaso fut" title="Antes, el mes pasa a ${esc(P[i + 1][1])}">${t}</span>`;
    }).join('<span class="csep" aria-hidden="true">›</span>');
    const extra = ['noaprobado', 'cancelado'].map(k => `<span>${X.estIco(k, ' aria-hidden="true"')}${esc((X.ESTADOS.find(e => e[0] === k) || [k, k])[1])}</span>`).join('');
    return `<div class="cleg" role="group" aria-label="Paso del mes">${pasos}<span class="cextra" title="Estados de cada publicación, no pasos del mes">${extra}</span></div>`;
  }
  // What a change of step will do, with figures: built again when the dialog opens and after its reels are marked
  let paso = null;                             // the confirmation open: {key, to, tok}
  function abrirPaso(to, preguntaReels = false) {
    const X = I(), S = X && X.S; if (!S || !X.PASOS) return;
    if (X.locked) { X.toast('La mesa está abierta en otra pestaña: aquí no se cambia el paso.'); return; }
    const P = X.PASOS, de = X.pasoDe(S), i = P.findIndex(p => p[0] === de), j = P.findIndex(p => p[0] === to);
    if (j < 0 || j === i || j > i + 1) return;  // on: only to the next step; back: to any done
    const sube = j > i, lab = k => (X.ESTADOS.find(e => e[0] === k) || [k, k])[1];
    const t = x => { const v = Date.parse(x.date); return isNaN(v) ? Infinity : v; };   // listed by date, as the calendar
    const vivas = S.slots.filter(X.vivo).sort((a, b) => t(a) - t(b)), canc = S.slots.length - vivas.length, por = {};
    vivas.forEach(s => { const e = X.estadoDe(s); (por[e] = por[e] || []).push(s); });
    const de_ = (...es) => es.flatMap(e => por[e] || []);
    const nombres = l => l.map(s => esc(X.shortLabel(s.name, s.type))).join(', ');
    const fila = (txt, l) => `<li>${txt}${l && l.length ? `: <span>${nombres(l)}</span>` : ''}</li>`;
    const siguen = es => es.filter(e => (por[e] || []).length).map(e => fila(`${nDe(por[e].length, 'sigue', 'siguen')} en ${esc(lab(e))}`, por[e])).join('');
    const cl = X.CL.find(c => c.id === S.client), mes = (M.status && (M.status() || {}).range) || X.monthLabel(S.month);
    let cuerpo = '', lista = '';
    if (!sube) {
      lista = X.ESTADOS.filter(([e]) => (por[e] || []).length).map(([e, l]) => fila(`${por[e].length} en ${esc(l)}`, por[e])).join('');
    } else if (to === 'captions') {
      const falta = por.empezar || [];
      cuerpo = `<p class="xwhat">${nDe(vivas.length - falta.length, 'tiene', 'tienen')} foto y contexto.${falta.length ? ` ${nDe(falta.length, 'se queda', 'se quedan')} en Por empezar:` : ''}</p>`;
      lista = falta.map(s => `<li><b>${esc(X.shortLabel(s.name, s.type))}</b> <span>· ${!s.photos.length && !X.noteOf(s) ? 'sin foto ni contexto' : !s.photos.length ? 'sin foto' : 'sin contexto'}</span></li>`).join('');
    } else if (to === 'aprobar') {
      const ya = de_('aprobar', 'noaprobado', 'aprobado', 'programado', 'publicado');
      cuerpo = `<p class="xwhat">${PUB(ya.length)} con su caption elegido${ya.length - (por.aprobar || []).length ? ` (${(por.aprobar || []).length} en Por aprobar)` : ''}.</p>`;
      lista = siguen(['empezar', 'captions']);
    } else if (to === 'aprobado') {
      const pasan = por.aprobar || [], ya = de_('aprobado', 'programado', 'publicado');
      cuerpo = `<p class="xwhat"><b>${PUB(pasan.length)} ${pasan.length === 1 ? 'pasa' : 'pasan'} a Aprobado</b>${ya.length ? `; ${ya.length} ya ${ya.length === 1 ? 'estaba aprobada' : 'estaban aprobadas'}` : ''}.</p>`;
      lista = siguen(['empezar', 'captions', 'noaprobado']);
    } else if (to === 'programado') {
      const prog = de_('programado', 'publicado'), reels = (por.aprobado || []).filter(s => X.isReel(s.type)), otras = (por.aprobado || []).filter(s => !X.isReel(s.type));
      const np = (por.publicado || []).length, faltan = vivas.length - prog.length;
      cuerpo = `<p class="xwhat"><b>Programadas: ${prog.length} de ${vivas.length}</b>${np ? ` (${np} ya ${np === 1 ? 'publicada' : 'publicadas'})` : ''}; ${!faltan ? 'no falta ninguna' : faltan === 1 ? 'falta 1' : `faltan ${faltan}`}. Aquí no se programa nada: se programa con «programa».</p>`;
      if (reels.length) cuerpo += preguntaReels
        ? `<div class="cpreels cpconf"><span>¿Marcar ${nDe(reels.length, 'reel', 'reels')} como ${reels.length === 1 ? 'programado' : 'programados'}? ${reels.length === 1 ? 'Lleva' : 'Llevan'} el mismo ✓ que las programadas.</span><span class="cpbtns"><button type="button" class="btn2" data-cal="reels-no" data-paso="${to}">No</button><button type="button" class="btn" data-cal="reels-si" data-paso="${to}">Marcar</button></span></div>`
        : `<div class="cpreels"><span>Reels: <b>${reels.length} por programar</b> <span class="cpn">· ${nombres(reels)}</span></span><button type="button" class="btn2" data-cal="reels" data-paso="${to}">Marcar como programados</button></div>`;
      lista = (otras.length ? fila(`${otras.length} ${otras.length === 1 ? 'aprobada' : 'aprobadas'} por programar con «programa»`, otras) : '') + siguen(['empezar', 'captions', 'aprobar', 'noaprobado']);
    } else if (to === 'publicado') {
      const pub = por.publicado || [];
      cuerpo = `<p class="xwhat"><b>Publicadas: ${pub.length} de ${vivas.length}</b>${vivas.length - pub.length ? `; ${vivas.length - pub.length} sin marcar como ${vivas.length - pub.length === 1 ? 'publicada, que se marca' : 'publicadas, que se marcan'} a mano en cada una` : ''}.</p>`;
      lista = siguen(['empezar', 'captions', 'aprobar', 'noaprobado', 'aprobado', 'programado']);
    }
    const tok = (paso && paso.tok || 0) + 1;
    paso = { key: S.key, to, tok };
    X.showDialog('paso', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${sube ? 'Pasar' : 'Volver'} a ${esc(P[j][1])}</h3>`
      + `<p>${esc((cl && cl.name) || S.client)}, ${esc(mes)}: el mes ${sube ? 'pasa' : 'vuelve'} de ${esc(P[i][1])} a ${esc(P[j][1])}.${sube ? '' : ' Las publicaciones no cambian de estado:'}</p>`
      + cuerpo + (lista ? `<ul class="xsum cplist">${lista}</ul>` : '')
      + (sube && to === 'aprobar' ? '<div class="cprv" aria-live="polite"><p>Revisando el mes…</p></div>' : '')
      + (canc ? `<p class="cpnota">${nDe(canc, 'cancelada no cuenta', 'canceladas no cuentan')}.</p>` : '')
      + `<div class="form"><div class="row"><button type="button" class="btn2" data-act="close">Cancelar</button><button type="button" class="btn" data-cal="paso-ok" data-paso="${to}">${sube ? 'Pasar' : 'Volver'} a ${esc(P[j][1])}</button></div></div>`);
    const d = X.root().querySelector('.detail'), c = d && d.querySelector(preguntaReels ? '[data-cal="reels-si"]' : '[data-cal="paso-ok"]'); if (c) c.focus();
    if (sube && to === 'aprobar') revisarEn(tok);
  }
  const abierto = tok => { const X = I(), d = X && X.root().querySelector('.detail'); return !!(d && !d.hidden && d.dataset.dlg === 'paso' && paso && paso.tok === tok); };
  async function revisarEn(tok) {              // «Revisar» (D-040, D-058): its points in the confirmation; never a reason not to go on
    let res = null;
    try { if (M.revisar) res = await M.revisar({ historias: true }); } catch (e) { console.warn('revisión del paso:', e); }
    if (!abierto(tok)) return;
    const X = I(), box = X.root().querySelector('.detail .cprv'); if (!box) return;
    if (!res) { box.innerHTML = `<p>${M.revisar ? 'No se pudo pasar «Revisar».' : 'La revisión (revisar.js) no está cargada: no se ha pasado «Revisar».'} El mes puede pasar igualmente.</p>`; return; }
    if (!res.puntos.length) { box.innerHTML = '<p class="xwhat">Revisar: todo en orden.</p>'; return; }
    const grupos = [];
    for (const p of res.puntos) { const g = grupos[grupos.length - 1], id = p.historiaId || p.slotId; if (g && g.id === id) g.ps.push(p); else grupos.push({ id, post: p.post, h: !!p.historiaId, ps: [p] }); }
    const cuenta = [res.bloquean ? nDe(res.bloquean, 'punto bloquea', 'puntos bloquean') : '', res.avisos ? nDe(res.avisos, 'aviso', 'avisos') : ''].filter(Boolean).join(' y ');
    box.innerHTML = `<p class="xwhat">Revisar: ${cuenta}. No impide${res.bloquean ? ' pasar de paso; lo que bloquea no se sube ni se programa' : ' pasar de paso'}.</p>`
      + `<ul class="xsum cplist">${grupos.map(g => `<li><b>${esc(g.post)}</b>${g.h ? ' <span>· historia</span>' : ''}${g.ps.map(p => `<br><span class="${p.bloquea ? 'cpb' : ''}">${p.diapositiva ? `Diapositiva ${p.diapositiva}: ` : ''}${esc(p.texto)}${p.bloquea ? ' (bloquea)' : ''}</span>`).join('')}</li>`).join('')}</ul>`;
  }
  function enPaso(b) {
    const X = I(), S = X && X.S, a = b.dataset.cal, to = b.dataset.paso;
    if (!S || !paso || paso.key !== S.key) { if (X) X.closeDetail(); return; }
    if (a === 'reels') abrirPaso(to, true);
    else if (a === 'reels-no') abrirPaso(to);
    else if (a === 'reels-si') {                 // the approved reels, as the scheduled posts (they are published by hand)
      const ids = S.slots.filter(s => X.vivo(s) && X.isReel(s.type) && X.estadoDe(s) === 'aprobado').map(s => s.id);
      const r = ids.length && M.setEstado ? M.setEstado(ids, 'programado') : [], hechos = Array.isArray(r) ? r.filter(x => !x.error).length : 0;
      if (r && r.error) X.toast(r.error);
      else if (hechos) X.toast(`${nDe(hechos, 'reel marcado', 'reels marcados')} como ${hechos === 1 ? 'programado' : 'programados'}.`);
      abrirPaso(to);
    } else if (a === 'paso-ok') confirmar(to);
  }
  function confirmar(to) {
    const X = I(), S = X && X.S; paso = null;
    if (!S) return;
    if (X.locked) { X.closeDetail(); X.toast('La mesa está abierta en otra pestaña: aquí no se cambia el paso.'); return; }
    const P = X.PASOS, i = P.findIndex(p => p[0] === X.pasoDe(S)), j = P.findIndex(p => p[0] === to);
    X.closeDetail();
    if (j < 0 || j === i || j > i + 1) return;
    const ids = to === 'aprobado' && j > i ? S.slots.filter(s => X.vivo(s) && X.estadoDe(s) === 'aprobar').map(s => s.id) : [];
    S.paso = to;                                 // with the posts it approves: one save, one step of ⌘Z
    const r = ids.length ? M.setEstado(ids, 'aprobado') : null, hechos = Array.isArray(r) ? r.filter(x => !x.error).length : 0;
    if (!hechos) X.changed();
    X.toast(j > i ? `El mes pasa a ${P[j][1]}${to === 'aprobado' ? `: ${PUB(hechos)} ${hechos === 1 ? 'pasa' : 'pasan'} a Aprobado` : ''}. ⌘Z lo deshace.` : `El mes vuelve a ${P[j][1]}. ⌘Z lo deshace.`, { ms: 6000 });
  }

  // ---------- moving a post to another day (its time stays) ----------
  // Pointer events (the mesa keeps HTML drag and drop for photos from the computer); a press that doesn't move is a click.
  let mv = null, later = false, noClick = 0, scr = 0;
  const dayUnder = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#mesa .side > .cal .cday[data-day]') : null; };
  function onDown(e) {
    if (e.button !== 0 || e.pointerType === 'touch' || mv) return;
    const X = I(), ch = e.target.closest && e.target.closest('#mesa .side > .cal .chip[data-slot]');
    if (!ch || !X || X.locked || ch.classList.contains('cx') || X.root().classList.contains('client')) return;
    mv = { id: ch.dataset.slot, el: ch, x: e.clientX, y: e.clientY, on: false, over: null };
  }
  function begin() {
    const root = I().root();
    if (!mv.el.isConnected) mv.el = root.querySelector(`.side > .cal .chip[data-slot="${cssq(mv.id)}"]`);   // drawn again while pressed
    if (!mv.el) { mv = null; return false; }
    const r = mv.el.getBoundingClientRect(), g = mv.el.cloneNode(true);
    mv.dx = mv.x - r.left; mv.dy = mv.y - r.top; mv.on = true;
    g.classList.remove('calhi'); g.classList.add('cghost'); g.style.width = r.width + 'px';
    root.append(g); mv.ghost = g; mv.el.classList.add('cmoving'); root.classList.add('calmv');
    return true;
  }
  function over(day) {
    if (mv.over === day) return;
    if (mv.over) mv.over.classList.remove('cover', 'cno');
    mv.over = day; if (day) day.classList.add(day.dataset.day < I().hoy() ? 'cno' : 'cover');
  }
  function scrollNear(y) {                     // near the top or bottom edge of the month, it scrolls
    cancelAnimationFrame(scr);
    const b = I().root().querySelector('.side > .cal .calbody'); if (!b) return;
    const r = b.getBoundingClientRect(), v = y < r.top + 28 ? -8 : y > r.bottom - 28 ? 8 : 0; if (!v) return;
    const step = () => { b.scrollTop += v; scr = requestAnimationFrame(step); }; scr = requestAnimationFrame(step);
  }
  function onMove(e) {
    if (!mv) return;
    if (!mv.on && (Math.hypot(e.clientX - mv.x, e.clientY - mv.y) < 5 || !begin())) return;
    mv.ghost.style.transform = `translate(${e.clientX - mv.dx}px,${e.clientY - mv.dy}px)`;
    over(dayUnder(e.clientX, e.clientY)); scrollNear(e.clientY);
    e.preventDefault();
  }
  function end(e) {
    const m = mv; mv = null; cancelAnimationFrame(scr);
    if (!m || !m.on) return;
    const day = e && e.type === 'pointerup' ? dayUnder(e.clientX, e.clientY) || m.over : null;   // also on pointerup: a drag may send one move only
    if (m.over) m.over.classList.remove('cover', 'cno');
    m.ghost.remove(); m.el.classList.remove('cmoving'); I().root().classList.remove('calmv');
    noClick = Date.now();
    if (day) drop(m.id, day.dataset.day);
    if (later) { later = false; render(); }
  }
  function drop(id, day) {
    const X = I(), s = X && X.S && X.S.slots.find(x => x.id === id); if (!s || X.localDay(s.date) === day) return;
    if (day < X.hoy()) { X.toast('Ese día ya ha pasado: la publicación no se ha movido.'); return; }
    X.setDate(id, X.dOnly(s.date) ? day : X.madridISO(day, X.localTime(s.date)));   // the mesa's own move (says if it falls outside the board)
  }
  const onCancel = () => end(null);

  // ---------- styles (inside #mesa, with its fonts, radii and greys) ----------
  const CSS = `
#mesa .side>.cal{flex:1 1 0;min-height:0;display:flex;flex-direction:column;border-top:1px solid var(--line);background:var(--panel)}
#mesa .side>.cal.fold{flex:none}
#mesa .side>.cal.fold .cleg,#mesa .side>.cal.fold .calbody,#mesa .side>.cal.fold .cnav{display:none}
#mesa .calhead{flex:none;display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;padding:6px 10px 4px 6px;font-size:12px;color:var(--mute)}
#mesa .side>.cal.fold .calhead{padding:4px 10px 4px 6px}
#mesa .cfold{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:2px 4px;border-radius:6px;color:var(--ink);font:inherit}
#mesa .cfold:hover{background:var(--line2)}#mesa .cfold b{font-size:13px;font-weight:600}
#mesa .cfold svg{width:14px;height:14px;transition:transform .15s}#mesa .cal.fold .cfold svg{transform:rotate(-90deg)}
#mesa .csync,#mesa .cnat{white-space:nowrap}#mesa .csync.c{color:var(--chg)}#mesa .cnat{font-size:11px;color:var(--faint)}
#mesa .side>.cal.fold .cnat{display:none}
#mesa .cnav{margin-left:auto;display:inline-flex;align-items:center;gap:2px;color:var(--ink)}
#mesa .cnav button{border:0;background:none;width:24px;height:24px;border-radius:6px;font-size:17px;line-height:1;color:var(--ink)}
#mesa .cnav button:hover:not(:disabled){background:var(--line2)}#mesa .cnav button:disabled{color:var(--line);cursor:default}
#mesa .cmes{min-width:104px;text-align:center;font-weight:600;font-size:12.5px}
#mesa .cleg{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:3px 2px;padding:0 10px 6px;font-size:10.5px;color:var(--mute)}
#mesa .cleg span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
#mesa .cpaso{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;border:1px solid transparent;border-radius:999px;padding:1px 7px;background:none;font:inherit;font-size:10.5px;line-height:15px;color:var(--ink)}
#mesa button.cpaso{cursor:pointer}#mesa button.cpaso:hover{background:var(--line2)}
#mesa button.cpaso:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
#mesa .cpaso.act{background:var(--ink);border-color:var(--ink);color:#fff;font-weight:600}
#mesa .cpaso.act .e-programado,#mesa .cpaso.act .e-publicado{color:#7bd88f}
#mesa .cpaso.sig{border-color:var(--faint)}#mesa .cpaso.sig:hover{border-color:var(--ink)}
#mesa .cpaso.fut{color:var(--faint)}#mesa .cpaso.fut .edot,#mesa .cpaso.fut .eico{opacity:.5}
#mesa .cleg .csep{color:var(--faint);font-size:11px}
#mesa .cleg .cextra{gap:8px;margin-left:auto;padding-left:8px;color:var(--faint)}
#mesa .detail .cplist{max-height:30vh}#mesa .detail .cplist li span.cpb{color:var(--red)}
#mesa .detail .cpnota{font-size:12px}
#mesa .detail .cprv>p{margin:0 0 10px;color:var(--mute);font-size:12.5px}#mesa .detail .cprv>p.xwhat{color:var(--ink);font-size:13px}
#mesa .detail .cpreels{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 10px;margin:0 0 10px;padding:8px 10px;border-radius:8px;background:var(--bg);font-size:13px}
#mesa .detail .cpreels .cpn{color:var(--mute);font-size:12.5px}#mesa .detail .cpreels .cpbtns{display:inline-flex;gap:6px}
#mesa .detail .cpreels .btn,#mesa .detail .cpreels .btn2{padding:4px 10px;font-size:12.5px;min-height:30px}
#mesa .calbody{flex:1;min-height:0;overflow:auto;padding:0 10px 10px}
#mesa .cgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr)) 28px;border-left:1px solid var(--line2);border-top:1px solid var(--line2)}
#mesa .cal.nocnt .cgrid{grid-template-columns:repeat(7,minmax(0,1fr)) 16px}
#mesa .cdow{padding:3px 6px;font-size:10.5px;color:var(--mute);border-right:1px solid var(--line2);border-bottom:1px solid var(--line2);background:var(--bg)}
#mesa button.cdow.ccnt{border:0;border-right:1px solid var(--line2);border-bottom:1px solid var(--line2);padding:3px 0;font:inherit;font-size:10.5px;color:var(--mute);text-align:center}
#mesa button.cdow.ccnt:hover{color:var(--ink);background:var(--line2)}
#mesa .cday{min-width:0;display:flex;flex-direction:column;gap:2px;padding:2px 3px 4px;border-right:1px solid var(--line2);border-bottom:1px solid var(--line2)}
#mesa .cday.out .dn{color:var(--faint)}
#mesa .cday.off,#mesa .cday.prevc{background:#f6f6f6}
#mesa .dh{display:flex;align-items:center;justify-content:space-between;gap:4px;min-height:18px;padding:0 1px}
#mesa .dn{font-size:11px;color:var(--mute);line-height:18px;padding:0 4px;border-radius:999px;white-space:nowrap}
#mesa .cday.today .dn{background:var(--ink);color:#fff;font-weight:600}
#mesa .dmany{font-size:10px;line-height:15px;padding:0 5px;border-radius:999px;background:#fdf0e3;color:#9a5a1f}
#mesa .chip{display:flex;align-items:center;flex-wrap:wrap;column-gap:4px;width:100%;min-width:0;border:0;border-radius:4px;padding:2px 5px;text-align:left;font:inherit;font-size:11px;line-height:15px;cursor:pointer;color:#32302c;background:#eeeeec}
#mesa .chip .cl{flex:1 1 auto;min-width:0;max-width:100%;display:flex;align-items:center;gap:4px}
#mesa .chip .cn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
#mesa .chip .ct{flex:none;font-size:10px;opacity:.7;font-variant-numeric:tabular-nums}
#mesa .chip.ty-reel{background:#dbeddb;color:#1c3829}
#mesa .chip.ty-collab{background:#b3d9bb;color:#11301b}
#mesa .chip.ty-foto{background:#ffe2dd;color:#5d1715}
#mesa .chip.ty-carr{background:#e8deee;color:#412454}
#mesa .chip.ty-trial{background:#e3e2e0;color:#32302c}
#mesa .chip.past{background:#f1f1ef;color:var(--faint);cursor:pointer}
#mesa .chip.cx{background:#f4f4f3;color:var(--faint)}#mesa .chip.cx .cn{text-decoration:line-through}
#mesa .chip:hover{filter:brightness(.97)}
#mesa .chip .dchg{flex:none;margin:0 0 0 1px}
#mesa .chip .cmk{display:inline-flex;flex:none;width:9px;height:9px;margin:0 0 0 1px}#mesa .chip .cmk svg{width:100%;height:100%}
#mesa .side>.cal{user-select:none;-webkit-user-select:none}
#mesa .chip.cmoving{opacity:.35}
#mesa .cghost{position:fixed;left:0;top:0;z-index:30;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.18);opacity:.95}
#mesa.calmv,#mesa.calmv *{cursor:grabbing !important}
#mesa .cday.cover{background:#e8f3fe;box-shadow:inset 0 0 0 2px var(--acc)}
#mesa .cday.cno{background:#fbeeee}#mesa.calmv .cday.cno,#mesa.calmv .cday.cno *{cursor:not-allowed !important}
#mesa .chip.calhi{box-shadow:0 0 0 2px var(--ink)}
#mesa .cell.calhi::after{content:'';position:absolute;inset:0;z-index:6;pointer-events:none;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px var(--ink)}
#mesa .cgrid>.ccnt:not(button){display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--ink);background:var(--bg);border-right:1px solid var(--line2);border-bottom:1px solid var(--line2);font-variant-numeric:tabular-nums}
#mesa .cgrid>.ccnt.z{color:var(--faint);font-weight:400}
#mesa .ctot{grid-column:1/8;padding:4px 8px;text-align:right;font-size:11px;color:var(--mute);border-right:1px solid var(--line2);border-bottom:1px solid var(--line2)}
#mesa .ctotn{min-height:22px}
#mesa.client .edot,#mesa.client .eico,#mesa.client .cmk,#mesa.client .cleg,#mesa.client .csync,#mesa.client .cnat,#mesa.client .dmany,#mesa.client .chip.cx,#mesa.client .chip .dchg{display:none}
#mesa.client .chip{cursor:pointer}
@media (max-width:720px){#mesa .side>.cal:not(.fold){flex:none;height:42vh}}`;
  let style = document.getElementById('mesa-cal-css');
  if (!style) { style = document.createElement('style'); style.id = 'mesa-cal-css'; document.head.append(style); }   // in the head: the mesa's shell empties the body
  style.textContent = CSS;

  const ON = [['pointerover', onOver], ['click', onClick, false], ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', end], ['pointercancel', onCancel]];
  ON.forEach(([t, f, c]) => document.addEventListener(t, f, c !== false));
  M.calendario = {
    version: VERSION, render,
    _off: () => { ON.forEach(([t, f, c]) => document.removeEventListener(t, f, c !== false)); if (mv) onCancel(); }
  };
  render();                                     // the mesa may have drawn its board before this file arrived
})();
