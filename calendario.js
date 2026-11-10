// Calendario — Mesa de trabajo · v1.5
// The open board's month under the tray (its share of the right column, D-148), Monday to Sunday as in Notion: one chip per post —
// its short name, time and the mark of its state (a dot, ✓, two ✓ or ✕: the mesa's estIco, D-081) — on a pastel of its
// type, as Notion's tags. A cancelled post says why on hover, if it has a reason (D-082). Linked both ways with the grid:
// a click opens the same post view as its cell, hovering one lights the other up. It reads the board only through the
// mesa's bridge (M._in, mesa ≥ 3.32) and is drawn again on every redraw of the grid (renderFeed → M.calendario.render):
// it keeps no copy of any post. If this file doesn't load, the mesa works as before (the tray takes the whole column).
//   Folded: a thin bar with its title and the changes not yet in Notion (1.16: with the tray folded too, a tab beside the
//   tray's; pressing it opens it, D-148); the weekly count column folds too. Both are
//   remembered per browser (localStorage; if it can't be read, open).
//   Months: the board's cycles and, before them, the previous month (its published posts in grey, read only); the days
//   outside the board's cycles are dimmed. 1.17 (D-153): so are, with their chips muted in their type's colour, the days of
//   another month of the board that show in the month seen (the calendar's month decides, not the step bar's cycle); they
//   work as the others (open, drag, drop) and their chips go back to full colour on hover, focus or the grid's link.
//   Weekly count: the posts of each week on the days of the month shown, so the weeks add up to the month's total;
//   cancelled posts don't count.
//   Moving: a chip dragged to another day keeps its time and goes through the mesa's setDate, as the post view's date field
//   (it renumbers, reorders the grid, reaches a collab's boards and is one step of ⌘Z); a past day is refused.
//   Notion: the mesa doesn't read Notion live — each chip has the grid's mark of changes since the last upload (1.1: the one
//   mark of D-081, also for a caption, photo or contexto), and the header says how many dates, names or types are not uploaded yet and when the board last had Notion's data (S.notionAt: loaded or upload confirmed).
//   Vista cliente: read only — type, time and colour; no moving, no states, no Notion marks, no cancelled posts.
//   Look (1.16, D-147, mesa ≥ 4.06): the date's calendar (controles.js, D-136) — ‹ month year ›, initials in grey, days out of
//   the month in grey, today with its outline, rounded days without grid lines — with the same tokens (--cx-*, mesa.js).
//   The month's step (1.2, D-084, mesa ≥ 3.68): the legend is the open board's step bar — Por empezar › Captions › Por
//   aprobar › Aprobado › Programado › Publicado, each with its mark (still the legend of the chips) — and, apart and only as a
//   legend, No aprobado and Cancelado, which are states of a post, not steps. The steps done in ink (pressed, the month goes
//   back), the current one in a black pill, the next one with a thin border (pressed, the month goes on) and the later ones
//   in grey. 1.11 (D-121, D-120, mesa ≥ 3.92): a board opens on today's month, today marked; if the board doesn't hold today, on
//   its month nearest to today (‹ › are kept until another board opens). A vencida (not cancelled nor published, its moment
//   passed and not a Programada that passes to Publicado on its own) has a thin red border and its time in red; «N
//   vencidas» in the header opens the window that lists the client's, those of its earlier boards too, by date, each with
//   «Ya se publicó», «Reprogramar» and «Cancelar», one step of ⌘Z each. Nothing of it in the vista cliente.
//   1.10 (D-119, mesa ≥ 3.91): each month of the board has its own step, and the bar is the one of the month the
//   calendar shows (‹ › go to another's); a calendar month that only shows the end of a cycle shows that cycle's; the
//   previous cycle, read only, has the bar as a legend that is not pressed. Going on carries and lists the posts of that
//   month only, and «Revisar» looks at that month and its stories. 1.3 (D-085, mesa ≥ 3.69): going on carries the posts in the step it leaves (M.setEstado), never a cancelled
//   one nor one put back by hand in its post view; a post already past the new step is not touched. Going on to:
//     Captions      nothing is forced: Captions follows from a photo (1.4: the contexto doesn't count, D-086)
//     Por aprobar   nothing is forced (a chosen caption); runs «Revisar» (the feed and the stories, D-040, D-058) first
//     Aprobado      Por aprobar → Aprobado; No aprobado stays
//     Programado    1.5 (D-087): everything approved but the reels (Reel, Collab Reel, Trial Reel) → Programado; the
//                   reels stay in Aprobado, marked by hand as they are finished, and are not behind at this step
//     Publicado     Programado → Publicado
//   Behind: not cancelled and, after the change, before the month's step; listed by date with why («retrasada a mano», «sin
//   foto», «sin caption elegido», «No aprobado», «sin programar»…). With nothing behind (and, to Por aprobar, no points in
//   «Revisar») the step changes straight away with a toast; otherwise it asks, and Cancelar, × or Esc change nothing.
//   Going back changes the step only, straight away. The step and what it moves are one step of ⌘Z. Nothing of it in the
//   vista cliente; nothing of Zernio, captions or emails.
(function calendarioBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.20';   // 1.20: the chips' hours without tabular figures (D-175). 1.18: «Notion a fecha de» in a title, a double click on the month's name, no «Cancelar» / «Cerrar» in its dialogs (D-155, D-156, D-159, D-160). 1.17: the days of another month of the board, dimmed as the previous month's, with their chips muted (D-153). 1.16: the look of the date's calendar, with its tokens (D-147); folds with the column, and is a tab with the tray folded (D-148)
  if (M.calendario && M.calendario._off) { try { M.calendario._off(); } catch (e) { /* */ } }   // a previous copy on this page
  const LS_FOLD = 'mesa-cal-plegado', LS_CNT = 'mesa-cal-recuento';
  const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  // pastel of each type (Notion's tag colours); the dot of each state is the mesa's (.edot.e-<state>), other hues
  const TYPE = { 'Reel': 'reel', 'Collab Reel': 'collab', 'Foto': 'foto', 'Carrusel': 'carr', 'Trial Reel': 'trial' };
  const { esc, cssq, lsGet, lsSet, addMonths, utc } = M._in;   // the mesa's own helpers
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const NARROW = window.matchMedia ? window.matchMedia('(max-width:720px)') : { matches: false };
  const folded = () => { const v = lsGet(LS_FOLD); return v === '1' || (v == null && NARROW.matches); };   // a narrow pane starts folded
  const cntFolded = () => lsGet(LS_CNT) === '1';

  // ---------- days ('YYYY-MM-DD', Madrid) and months ('YYYY-MM') ----------
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
  let view = { key: null, m: null };           // the month shown, per open board (opening another board shows today's, D-121)
  // the month a board opens on: today's, if the board holds it; else its month nearest to today (D-121)
  const mesInicial = (X, sp) => { const t = X.hoy(); return t < sp.lo ? sp.lo.slice(0, 7) : t > sp.hi ? sp.hi.slice(0, 7) : t.slice(0, 7); };

  // ---------- drawing ----------
  let hi = null;                               // {k: 'slot' | 'prev', id} lit up in both places
  function chipHTML(X, s, client) {
    const est = X.estadoDe(s), lab = X.ESTADOS.find(e => e[0] === est), t = X.localTime(s.date), mot = est === 'cancelado' ? X.motivoDe(s) : '';
    const venc = !client && !!X.vencida && X.vencida(s);   // its moment passed (D-120)
    const cls = `chip ty-${TYPE[s.type] || 'otro'}${est === 'cancelado' ? ' cx' : ''}${venc ? ' venc' : ''}`;
    const mk = client || est === 'cancelado' ? '' : X.cambiosIco(s, 'cmk');   // the grid's own mark of changes
    const tit = `${s.name} · ${X.fmtDate(s.date)}${est === 'cancelado' ? ' · Cancelada' + (mot ? ': ' + mot : '') : ''}${venc ? ' · Vencida' : ''}`;
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
    if (view.key !== S.key || !sp.list.includes(view.m)) view = { key: S.key, m: mesInicial(X, sp) };
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
        // out of the board (off), its previous cycle (prevc) or another month of the board that shows here (otromes, D-153)
        const cls = `cday${inM ? '' : ' out'}${d < sp.plo || d > sp.hi ? ' off' : d < sp.lo ? ' prevc' : inM ? '' : ' otromes'}${d === today ? ' today' : ''}`;
        const num = +d.slice(8) === 1 ? `${+d.slice(8)} ${X.MONTHS[+d.slice(5, 7) - 1].slice(0, 3)}` : String(+d.slice(8));
        body += `<div class="${cls}" data-day="${d}"><div class="dh"><span class="dn">${num}</span>${k > 1 && !client ? `<span class="dmany" title="${k} publicaciones este día">${k}</span>` : ''}</div>`
          + items.map(it => it.p ? pastHTML(X, it.p) : chipHTML(X, it.s, client)).join('') + '</div>';
      }
      total += n;
      body += `<div class="ccnt${n ? '' : ' z'}" title="${n} publicaci${n === 1 ? 'ón' : 'ones'} esta semana en ${X.MONTHS[mo - 1]}">${cf ? '' : n}</div>`;
    }
    if (!cf) body += `<div class="ctot">Total de ${X.MONTHS[mo - 1]}</div><div class="ccnt ctotn" title="${total} publicaci${total === 1 ? 'ón' : 'ones'} en ${X.MONTHS[mo - 1]}">${total}</div>`;
    const i = sp.list.indexOf(m), pend = M.notionChanges ? M.notionChanges().length : 0, fo = folded();
    // «Notion a fecha de» is no longer a text of its own: it goes in the title of the line that already speaks of Notion (D-160)
    const nat = `Notion a fecha de: ${S.notionAt ? esc(X.fmtDate(S.notionAt)) : '—'}`;
    const sync = pend ? `<span class="csync c" title="Fecha, hora, tipo o nombre cambiados aquí: se pasan a Notion al subir · ${nat}"><i class="dchg"></i>${pend} cambio${pend === 1 ? '' : 's'} sin subir</span>` : `<span class="csync" title="${nat} · la mesa no lee Notion en directo: es la última vez que este mes se cargó desde Notion o se confirmó una subida">Igual que Notion</span>`;
    // a double click on the month's name goes back to the month the board opens with (D-121), as ‹ › without a step of ⌘Z (D-159)
    const ini = mesInicial(X, sp), mesNom = `${cap(X.MONTHS[mo - 1])} ${y}`;
    const mesTit = `${mesNom} · doble clic: ${ini === today.slice(0, 7) ? 'el mes de hoy' : 'el más cercano a hoy'}`;
    const leg = pasosHTML(X, mesBarra(X, m));
    const nv = !client && X.vencidas ? X.vencidas().length : 0;
    const vh = nv ? `<button type="button" class="cvenc" data-cal="venc" title="Ver las vencidas y resolverlas">${nv} vencida${nv === 1 ? '' : 's'}</button>` : '';
    const bodyEl = sec.querySelector('.calbody'), top = bodyEl ? bodyEl.scrollTop : 0;
    sec.hidden = false;
    sec.classList.toggle('fold', fo); sec.classList.toggle('nocnt', cf);
    sec.innerHTML = `<div class="calhead"><button type="button" class="cfold" data-cal="fold" aria-expanded="${!fo}" title="${fo ? 'Abrir el calendario' : 'Plegar el calendario'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg><b>Calendario</b></button>${vh}${sync}`
      + `<span class="cnav"><button type="button" data-cal="prev" aria-label="Mes anterior" ${i > 0 ? '' : 'disabled'}>‹</button><span class="cmes" title="${esc(mesTit)}">${esc(mesNom)}</span><button type="button" data-cal="next" aria-label="Mes siguiente" ${i < sp.list.length - 1 ? '' : 'disabled'}>›</button></span></div>`
      + `${leg}<div class="calbody"><div class="cgrid" style="grid-template-rows:24px repeat(${rows},minmax(58px,auto))${cf ? '' : ' 26px'}">${body}</div></div>`;
    const nb = sec.querySelector('.calbody'); if (nb && top) nb.scrollTop = top;
    light();
    vencPintar(true);                            // the vencidas' window, if it is open (a ⌘Z, a change from elsewhere)
    cambPintar();                                // and the changed ones' (D-126)
  }

  // the fold opens and closes with its height, the same movement as the editor's sections (D-137): from where it is, so a
  // second click halfway goes back from there; with «reduce motion», a short fade
  function pliegue(sec, h0) {
    if (sec._plFin) sec._plFin();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { sec.classList.add('cal-fade'); setTimeout(() => sec.classList.remove('cal-fade'), 220); return; }
    const h1 = sec.getBoundingClientRect().height;   // where it goes: as it is drawn now
    if (Math.abs(h1 - h0) < 1) return;
    let t = 0;
    const fin = () => { clearTimeout(t); sec.removeEventListener('transitionend', alFin); sec._plFin = null; sec.classList.remove('cal-anim'); ['height', 'flex', 'overflow', 'transition'].forEach(k => { sec.style[k] = ''; }); };
    const alFin = e => { if (e.target === sec && e.propertyName === 'height') fin(); };
    sec.classList.add('cal-anim'); sec.style.transition = 'none'; sec.style.flex = '0 0 auto'; sec.style.overflow = 'hidden'; sec.style.height = h0 + 'px';
    void sec.offsetHeight;
    sec.style.transition = 'height var(--d-m) var(--ease-m)'; sec.style.height = h1 + 'px';
    sec.addEventListener('transitionend', alFin); t = setTimeout(fin, 700); sec._plFin = fin;
  }

  function plegar(X, sec) {
    const cambiar = () => { lsSet(LS_FOLD, folded() ? '0' : '1'); render(); };
    if (X.colPliegue) { X.colPliegue('cal', cambiar); return; }   // the mesa moves the column (D-148)
    const h0 = sec.getBoundingClientRect().height; cambiar(); pliegue(sec, h0);
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
    const dv = e.target.closest('#mesa .detail[data-dlg="venc"] [data-cal]'); if (dv) { enVenc(dv); return; }   // the vencidas' window (D-120)
    const dc = e.target.closest('#mesa .detail[data-dlg="cambios"] [data-cal]'); if (dc) { enCamb(dc); return; }   // the changed ones' (D-126)
    const sec = e.target.closest('#mesa .side > .cal'); if (!sec) return;
    const root = X.root(), client = root.classList.contains('client');
    const b = e.target.closest('[data-cal]');
    if (b) {
      const a = b.dataset.cal;
      if (a === 'paso') { if (!client) abrirPaso(b.dataset.paso, b.dataset.mes); return; }
      if (a === 'venc') { if (!client) abrirVencidas(); return; }
      if (a === 'fold') { plegar(X, sec); return; }
      if (a === 'cnt') lsSet(LS_CNT, cntFolded() ? '0' : '1');
      else if (a === 'prev' || a === 'next') { const sp = span(X), i = sp.list.indexOf(view.m) + (a === 'prev' ? -1 : 1); if (sp.list[i]) view.m = sp.list[i]; }
      render(); return;
    }
    if (sec.classList.contains('fold') && !client && e.target.closest('.calhead') && sec.parentNode.querySelector(':scope > .tray.fold')) { plegar(X, sec); return; }   // its tab (D-148)
    const ch = e.target.closest('.chip'); if (!ch || Date.now() - noClick < 400) return;   // the click that ends a move opens nothing
    if (ch.dataset.slot) { if (client) X.openIG(ch.dataset.slot, 0); else X.openDetail(ch.dataset.slot, 0); }
    else if (ch.dataset.prev) { const id = ch.dataset.prev; if (client) X.openIG(id, 0); else X.withPrev(() => X.openPast(id), 'open'); }
  }

  // ---------- the month's step (D-084) ----------
  const nDe = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;
  const PUB = k => nDe(k, 'publicación', 'publicaciones');
  // the board's cycle whose bar shows with the calendar month m: its own, or the one whose end it shows; null: the previous
  // cycle (read only)
  const mesBarra = (X, m) => { const ms = X.boardMonths(); return ms.includes(m) ? m : ms.filter(c => c < m).pop() || null; };
  function pasosHTML(X, mb) {
    const P = X.PASOS, i = mb ? P.findIndex(p => p[0] === X.pasoDe(X.S, mb)) : -9;
    const pasos = P.map(([k, l], j) => {
      const ico = X.estIco(k, ' aria-hidden="true"'), t = `${ico}${esc(l)}`;
      if (!mb) return `<span class="cpaso ro" title="Mes anterior: solo lectura">${t}</span>`;
      if (j === i) return `<span class="cpaso act" aria-current="step" title="El mes va en ${esc(l)}">${t}</span>`;
      if (j === i + 1) return `<button type="button" class="cpaso sig" data-cal="paso" data-paso="${k}" data-mes="${mb}" title="Pasar el mes a ${esc(l)}">${t}</button>`;
      if (j < i) return `<button type="button" class="cpaso hecho" data-cal="paso" data-paso="${k}" data-mes="${mb}" title="Volver a ${esc(l)}">${t}</button>`;
      return `<span class="cpaso fut" title="Antes, el mes pasa a ${esc(P[i + 1][1])}">${t}</span>`;
    }).join('<span class="csep" aria-hidden="true">›</span>');
    const extra = ['noaprobado', 'cancelado'].map(k => `<span>${X.estIco(k, ' aria-hidden="true"')}${esc((X.ESTADOS.find(e => e[0] === k) || [k, k])[1])}</span>`).join('');
    return `<div class="cleg${mb ? '' : ' ro'}" role="group" aria-label="${mb ? 'Paso del mes' : 'Mes anterior: solo lectura'}">${pasos}<span class="cextra" title="Estados de cada publicación, no pasos del mes">${extra}</span></div>`;
  }
  // A step on carries the posts in the step it leaves (D-085), never a cancelled one nor one put back by hand: Por aprobar →
  // Aprobado; everything approved but the reels (also Collab Reel and Trial Reel) → Programado (D-087): the reels are marked
  // by hand, so at that step an approved reel is not behind; Programado → Publicado. Captions and Por aprobar follow from the posts' data: nothing is forced. No
  // aprobado stays, and a post already past the new step is not touched.
  const LLEVA = { aprobado: 'aprobar', programado: 'aprobado', publicado: 'programado' };
  const retr = (X, s) => !!(X.retrasada && X.retrasada(s));
  const nivel = (X, e) => X.PASO_DE[e] ?? 0;
  const porFecha = (a, b) => { const t = x => { const v = Date.parse(x.date); return isNaN(v) ? Infinity : v; }; return t(a) - t(b); };   // listed by date, as the calendar
  const delMes = (X, S, m) => S.slots.filter(s => !X.mesDe || X.mesDe(s) === m);   // the posts of that month of the board (D-119)
  const mueven = (X, L, to) => LLEVA[to] ? L.filter(s => X.vivo(s) && !retr(X, s) && X.estadoDe(s) === LLEVA[to] && (to !== 'programado' || !X.isReel(s.type))).sort(porFecha) : [];
  const reelAMano = (X, s, to) => to === 'programado' && X.isReel(s.type) && X.estadoDe(s) === 'aprobado';   // marked by hand (D-087)
  const reelsAMano = (X, L, to) => L.filter(s => X.vivo(s) && reelAMano(X, s, to)).length;
  // why a post stays behind, in a few words
  function porQue(X, s) {
    const e = X.estadoDe(s), v = s.estado && s.estado.v;
    if (X.retenida(s)) return 'retrasada a mano';
    if (e === 'empezar') return 'sin foto';    // the contexto doesn't count (D-086)
    if (e === 'captions') return 'sin caption elegido';
    if (e === 'noaprobado') return 'No aprobado';
    if (e === 'aprobar') return v === 'aprobado' ? 'cambió tras aprobarla' : v === 'noaprobado' ? 'cambió tras no aprobarla' : 'sin aprobar';
    return e === 'aprobado' ? 'sin programar' : 'sin publicar';
  }
  // behind: not cancelled and, after the change, in a state before the month's step (j); an approved reel at Programado is not
  const atrasadas = (X, L, j, van, to) => L.filter(s => X.vivo(s) && !van.includes(s) && !reelAMano(X, s, to) && nivel(X, X.estadoDe(s)) < j).sort(porFecha);
  const nombres = (X, l) => l.map(s => esc(X.shortLabel(s.name, s.type))).join(', ');
  const lleva = (to, k) => `${PUB(k)} ${k === 1 ? 'pasa' : 'pasan'} a ${{ aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado' }[to]}`;
  const quedanReels = n => `${nDe(n, 'reel se queda', 'reels se quedan')} en Aprobado, para marcar${n === 1 ? 'lo' : 'los'} a mano`;
  function revisarHTML(res) {                  // «Revisar» (D-040, D-058): its points; never a reason not to go on
    if (!res) return `<p>${M.revisar ? 'No se pudo pasar «Revisar».' : 'La revisión (revisar.js) no está cargada: no se ha pasado «Revisar».'} El mes puede pasar igualmente.</p>`;
    if (!res.puntos.length) return '<p class="xwhat">Revisar: todo en orden.</p>';
    const grupos = [];
    for (const p of res.puntos) { const g = grupos[grupos.length - 1], id = p.historiaId || p.slotId; if (g && g.id === id) g.ps.push(p); else grupos.push({ id, post: p.post, h: !!p.historiaId, ps: [p] }); }
    const cuenta = [res.bloquean ? nDe(res.bloquean, 'punto bloquea', 'puntos bloquean') : '', res.avisos ? nDe(res.avisos, 'aviso', 'avisos') : ''].filter(Boolean).join(' y ');
    return `<p class="xwhat">Revisar: ${cuenta}. No impide${res.bloquean ? ' pasar de paso; lo que bloquea no se sube ni se programa' : ' pasar de paso'}.</p>`
      + `<ul class="xsum cplist">${grupos.map(g => `<li><b>${esc(g.post)}</b>${g.h ? ' <span>· historia</span>' : ''}${g.ps.map(p => `<br><span class="${p.bloquea ? 'cpb' : ''}">${p.diapositiva ? `Diapositiva ${p.diapositiva}: ` : ''}${esc(p.texto)}${p.bloquea ? ' (bloquea)' : ''}</span>`).join('')}</li>`).join('')}</ul>`;
  }
  // A step on goes straight on, with a toast, when nothing stays behind (and, to Por aprobar, «Revisar» gives no points);
  // otherwise it asks, saying what changes, what stays behind and why, and «Revisar»'s points. Back: the step only, straight.
  let paso = null;                             // the confirmation open: {key, to, m, tok}
  let revisando = null;                        // a step on to Por aprobar waiting for «Revisar»: the board's key
  async function abrirPaso(to, m) {
    let X = I(), S = X && X.S; if (!S || !X.PASOS) return;
    if (!X.boardMonths().includes(m)) m = X.boardMonths()[0];
    if (X.locked) { X.toast('La mesa está abierta en otra pestaña: aquí no se cambia el paso.'); return; }
    const P = X.PASOS, de = X.pasoDe(S, m), i = P.findIndex(p => p[0] === de), j = P.findIndex(p => p[0] === to);
    if (j < 0 || j === i || j > i + 1) return;  // on: only to the next step; back: to any done
    if (j < i) { aplicar(X, S, to, m); return; }
    let res = null;
    if (to === 'aprobar') {                      // «Revisar» first: what it says decides whether to ask
      if (revisando) return;
      const key = S.key; revisando = key;
      const aviso = setTimeout(() => X.toast('Revisando el mes antes de pasar a Por aprobar…', { key: 'paso-revisar', ms: 60000 }), 400);
      try { if (M.revisar) res = await M.revisar({ historias: true, mes: m }); } catch (e) { console.warn('revisión del paso:', e); }
      clearTimeout(aviso); revisando = null;
      X = I(); S = X && X.S;
      if (X) X.root().querySelectorAll('.toasts [data-msg="paso-revisar"]').forEach(t => t.remove());
      if (!S || S.key !== key || X.pasoDe(S, m) !== de || X.locked) return;   // the month changed meanwhile: nothing
    }
    const L = delMes(X, S, m), van = mueven(X, L, to), tarde = atrasadas(X, L, j, van, to);
    if (!tarde.length && (to !== 'aprobar' || (res && !res.puntos.length))) { aplicar(X, S, to, m); return; }
    const vivas = L.filter(X.vivo), canc = L.length - vivas.length;
    const cl = X.CL.find(c => c.id === S.client), mes = X.rangeLabel ? X.rangeLabel(m, 1, false, X.curCd()) : X.monthLabel(m);
    const alDia = vivas.filter(s => !tarde.includes(s));   // what goes on with the month: how many have what the step asks for
    const k = to === 'captions' ? alDia.filter(s => s.photos.length).length : to === 'aprobar' && X.estadoAuto ? alDia.filter(s => X.estadoAuto(s) === 'aprobar').length : 0;
    const cuerpo = LLEVA[to] ? `<p class="xwhat"><b>${van.length ? lleva(to, van.length) : 'Ninguna publicación cambia de estado'}</b>${van.length ? `: <span class="cpn">${nombres(X, van)}</span>` : ''}.${reelsAMano(X, L, to) ? ` ${cap(quedanReels(reelsAMano(X, L, to)))}.` : ''}</p>`
      : to === 'captions' ? `<p class="xwhat">${nDe(k, 'tiene', 'tienen')} foto.</p>` : `<p class="xwhat">${PUB(k)} con su caption elegido.</p>`;
    const lista = tarde.length ? `<p>${nDe(tarde.length, 'se queda atrás', 'se quedan atrás')}:</p><ul class="xsum cplist">${tarde.map(s => `<li><b>${esc(X.shortLabel(s.name, s.type))}</b> <span>· ${esc(porQue(X, s))}</span></li>`).join('')}</ul>` : '';
    const tok = (paso && paso.tok || 0) + 1;
    paso = { key: S.key, to, m, tok };
    // no «<cliente>, <mes>: el mes pasa de X a Y.» (the step bar and the title say it, D-156) nor «Cancelar» (D-155)
    X.showDialog('paso', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Pasar a ${esc(P[j][1])}</h3>`
      + cuerpo + lista
      + (to === 'aprobar' ? `<div class="cprv">${revisarHTML(res)}</div>` : '')
      + (canc ? `<p class="cpnota">${nDe(canc, 'cancelada no cuenta', 'canceladas no cuentan')}.</p>` : '')
      + `<div class="form"><div class="row"><button type="button" class="btn" data-cal="paso-ok" data-paso="${to}">Pasar a ${esc(P[j][1])}</button></div></div>`);
    const d = X.root().querySelector('.detail'), c = d && d.querySelector('[data-cal="paso-ok"]'); if (c) c.focus();
  }
  function enPaso(b) {
    const X = I(), S = X && X.S;
    if (!S || !paso || paso.key !== S.key) { if (X) X.closeDetail(); return; }
    if (b.dataset.cal === 'paso-ok') confirmar(b.dataset.paso, paso.m);
  }
  function confirmar(to, m) {
    const X = I(), S = X && X.S; paso = null;
    if (!S) return;
    X.closeDetail();
    if (X.locked) { X.toast('La mesa está abierta en otra pestaña: aquí no se cambia el paso.'); return; }
    if (!X.boardMonths().includes(m)) return;
    const P = X.PASOS, i = P.findIndex(p => p[0] === X.pasoDe(S, m)), j = P.findIndex(p => p[0] === to);
    if (j < 0 || j === i || j > i + 1) return;
    aplicar(X, S, to, m);
  }
  // the step of month m and the posts of m it carries (counted again now): one save, one step of ⌘Z
  function aplicar(X, S, to, m) {
    const P = X.PASOS, i = P.findIndex(p => p[0] === X.pasoDe(S, m)), j = P.findIndex(p => p[0] === to), sube = j > i, L = delMes(X, S, m);
    const van = sube ? mueven(X, L, to) : [];
    S.pasos = { ...(X.pasosDe ? X.pasosDe(S) : {}), [m]: to }; delete S.paso;
    const r = van.length ? M.setEstado(van.map(s => s.id), to) : null, hechos = Array.isArray(r) ? r.filter(x => !x.error).length : 0;
    if (!hechos) X.changed();
    const nr = sube ? reelsAMano(X, L, to) : 0;
    X.toast(sube ? `El mes pasa a ${P[j][1]}${hechos ? `: ${lleva(to, hechos)}` : ''}${nr ? `; ${quedanReels(nr)}` : ''}. ⌘Z lo deshace.` : `El mes vuelve a ${P[j][1]}; las publicaciones no cambian. ⌘Z lo deshace.`, { ms: 6000 });
  }

  // ---------- the vencidas (D-120) ----------
  // The client's vencidas, by date: this board's and those of its earlier boards, which say their month and open in their
  // board. «Ya se publicó» → Publicado. «Reprogramar» → a day and time ahead inside its board (a Programada warns that
  // Zernio keeps the old one, D-103; its stories go with it, D-057); one of another board opens there, and one whose board
  // has no day ahead can't. «Cancelar» → with its reason (D-082). Each one a step of ⌘Z; nothing of Zernio or Notion.
  const EST_TXT = { empezar: 'Por empezar', captions: 'Captions', aprobar: 'Por aprobar', noaprobado: 'No aprobado', aprobado: 'Aprobado', programado: 'Programada' };
  let vabre = null;                            // the row with its form open: {k, que: 'rep' | 'can'}
  const vk = v => v.key + '|' + v.id;
  function vencHTML(X) {
    const l = X.vencidas(), S = X.S, cd = X.curCd();
    const cab = `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${l.length ? `${l.length} vencida${l.length === 1 ? '' : 's'}` : 'Vencidas'}</h3>`;
    if (!l.length) return cab + '<p>No queda ninguna vencida.</p>';   // no «Cerrar»: the × (D-155)
    const hoy = X.hoy(), fin = X.cycleEnd(S.month && X.boardMonths()[X.boardMonths().length - 1], cd);
    const fila = v => {
      const k = vk(v), f = vabre && vabre.k === k ? vabre.que : null, s = v.aqui ? X.slot(v.id) : null;
      const donde = v.aqui ? '' : ` · <span class="votro">${esc(X.rangeLabel ? X.rangeLabel(v.mes, 1, false, X.curCd()) : v.mes)}, otro tablero</span>`;
      const no = !v.futuro ? ` disabled title="${v.aqui ? 'Su mes ya no tiene días por delante' : 'Su tablero ya no tiene días por delante'}: muévela en Notion o cancélala."` : v.aqui ? '' : ' title="Se abre en su tablero"';
      let form = '';
      if (f === 'rep' && s) {
        const hora = X.dOnly(s.date) ? '' : X.localTime(s.date), dia = hora ? hoy : addDays(hoy, 1);
        form = `<div class="vform"><input type="date" data-v="dia" min="${hoy}" max="${fin}" value="${dia <= fin ? dia : fin}" aria-label="Día"><input type="time" data-v="hora" value="${esc(hora)}" aria-label="Hora"><button type="button" class="btn" data-cal="v-rep-ok">Mover</button><button type="button" class="btn2" data-cal="v-x">No</button></div>`;
      } else if (f === 'can') form = `<div class="vform"><input type="text" data-v="motivo" placeholder="Motivo (opcional)" maxlength="300" aria-label="Motivo"><button type="button" class="btn" data-cal="v-can-ok">Cancelar la publicación</button><button type="button" class="btn2" data-cal="v-x">No</button></div>`;
      return `<li data-k="${esc(k)}"><button type="button" class="vnom" data-cal="v-abrir" title="Abrir la publicación${v.aqui ? '' : ' en su tablero'}"><b>${esc(X.shortLabel(v.name, v.type))}</b></button>`
        + ` <span class="vque">· ${esc(X.fmtDate(v.date))} · ${esc(EST_TXT[v.estado] || v.estado)}${v.movida ? ', movida después de programarla' : ''}${donde}</span>`
        + (f ? form : `<div class="vacc"><button type="button" class="btn2" data-cal="v-pub">Ya se publicó</button><button type="button" class="btn2" data-cal="v-rep"${no}>Reprogramar</button><button type="button" class="btn2" data-cal="v-can">Cancelar</button></div>`) + '</li>';
    };
    return cab + '<p class="cpnota">Cada cambio se deshace con ⌘Z; no toca Zernio ni Notion.</p>'   // D-156
      + `<ul class="vlist">${l.map(fila).join('')}</ul>`;
  }
  function abrirVencidas() {
    const X = I(); if (!X || !X.S || !X.vencidas || X.root().classList.contains('client')) return;
    vabre = null;
    X.showDialog('venc', vencHTML(X));
  }
  function vencPintar(desdeFuera) {            // drawn again; from a redraw of the mesa, not while one of its fields is in use
    const X = I(), d = X && X.root && X.root().querySelector('.detail[data-dlg="venc"]'); if (!d || d.hidden || !X.S) return;
    if (desdeFuera && d.contains(document.activeElement) && document.activeElement.matches('input')) return;
    const c = d.querySelector('.card'); if (!c) return;
    const h = vencHTML(X); if (c._h === h) return;
    const dentro = c.contains(document.activeElement);
    c.innerHTML = h; c._h = h;
    const i = c.querySelector('.vform input[data-v="motivo"], .vform input[data-v="dia"]'); if (i && !desdeFuera) i.focus();
    else if (dentro && !c.contains(document.activeElement)) { const x = c.querySelector('.x'); if (x) x.focus(); }   // the focus stays in it: on the × (D-155)
  }
  async function enVenc(b) {
    const X = I(), S = X && X.S, li = b.closest('li[data-k]'), a = b.dataset.cal; if (!S) { if (X) X.closeDetail(); return; }
    const v = li && X.vencidas().find(x => vk(x) === li.dataset.k);
    if (a === 'v-x') { vabre = null; vencPintar(); return; }
    if (!v) { vencPintar(); return; }
    if (a === 'v-abrir' || (a === 'v-rep' && !v.aqui)) {   // one of another board opens in its board
      X.closeDetail();
      if (!v.aqui) { const r = await M.open(v.key); if (r === 'no existe' || (r && r.error)) { I().toast('No se pudo abrir su tablero.'); return; } }
      const Y = I(); if (Y && Y.slot(v.id)) Y.openDetail(v.id, 0);
      return;
    }
    if (X.locked) { X.toast('La mesa está abierta en otra pestaña: aquí no se cambia nada.'); return; }
    const nom = `«${X.shortLabel(v.name, v.type)}»`;
    if (a === 'v-pub') {
      const r = v.aqui ? M.setEstado(v.id, 'publicado') : X.fueraEstado(v.key, v.id, { v: 'publicado' });
      if ((Array.isArray(r) && r[0] && r[0].error) || (typeof r === 'string' && r)) { X.toast('No se pudo: ' + (Array.isArray(r) ? r[0].error : r) + '.'); return; }
      X.toast(`${nom} pasa a Publicado. ⌘Z lo deshace.`, { key: 'venc-accion', ms: 6000 });
    } else if (a === 'v-rep' || a === 'v-can') { vabre = { k: vk(v), que: a === 'v-rep' ? 'rep' : 'can' }; vencPintar(); return; }
    else if (a === 'v-can-ok') {
      const mot = String((li.querySelector('input[data-v="motivo"]') || {}).value || '').trim();
      const r = v.aqui ? M.setEstado(v.id, 'cancelado', mot ? { motivo: mot } : {}) : X.fueraEstado(v.key, v.id, mot ? { v: 'cancelado', motivo: mot } : { v: 'cancelado' });
      if ((Array.isArray(r) && r[0] && r[0].error) || (typeof r === 'string' && r)) { X.toast('No se pudo: ' + (Array.isArray(r) ? r[0].error : r) + '.'); return; }
      vabre = null;
      X.toast(`${nom} se cancela${mot ? ': ' + mot : ''}. ⌘Z lo deshace.`, { key: 'venc-accion', ms: 6000 });
    } else if (a === 'v-rep-ok') {
      const s = X.slot(v.id), dia = (li.querySelector('input[data-v="dia"]') || {}).value, hora = (li.querySelector('input[data-v="hora"]') || {}).value;
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) { X.toast('Elige un día.'); return; }
      const iso = hora ? X.madridISO(dia, hora) : dia, ya = X.ahora();
      if (hora ? Date.parse(iso) <= ya : dia <= X.hoy()) { X.toast(hora ? 'Elige un día y una hora por delante.' : 'Elige un día por delante.'); return; }
      const r = X.setDate(v.id, iso);
      if (r !== true) { if (r !== 'fuera de la mesa' && r !== 'publicada') X.toast('No se pudo: ' + r + '.'); return; }   // the mesa's setDate says why
      vabre = null;
      X.toast(`${nom} pasa al ${X.fmtDate(iso)}. ⌘Z lo deshace.`, { key: 'venc-accion', ms: 6000 });
    }
    vencPintar();
  }
  function onKey(e) {                          // Enter in a field of the vencidas' window: its button; Esc: closes the form
    const t = e.target; if (!t || !t.matches || !t.matches('#mesa .detail[data-dlg="venc"] .vform input')) return;
    if (e.key === 'Enter') { e.preventDefault(); const b = t.closest('.vform').querySelector('[data-cal="v-rep-ok"], [data-cal="v-can-ok"]'); if (b) b.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); vabre = null; vencPintar(); }
  }

  // ---------- the changed ones (D-126) ----------
  // «N cambiadas» of the month's bar (any change, each post once: D-144) opens one list, as the vencidas' window: the open board's posts
  // changed after their upload or with a new date, by date, each one once, with «Cambió: …» as their mark of changes says
  // it (D-081). Its name opens the post. No actions: «sube» puts them right.
  const cambiadas = X => X.S.slots.filter(s => X.vivo(s) && (X.slotStatus(s) === 'chg' || X.dateChg(s))).sort((a, b) => X.ts(a.date) - X.ts(b.date));
  function cambHTML(X) {
    const l = cambiadas(X), n = l.length, c = (X.CL || []).find(x => x.id === X.curClient);
    const cab = `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${n ? `${n} publicaci${n === 1 ? 'ón' : 'ones'} con cambios` : 'Con cambios'}</h3>`;
    if (!n) return cab + '<p>No queda ninguna con cambios sin subir.</p>';   // no «Cerrar»: the × (D-155)
    const fila = s => `<li data-k="${esc(s.id)}"><button type="button" class="vnom" data-cal="c-abrir" title="Abrir la publicación"><b>${esc(X.shortLabel(s.name, s.type))}</b></button>`
      + ` <span class="vque">· ${esc(X.fmtDate(s.date))} · Cambió: ${esc(X.listaY(X.cambiosDe(s)))}</span></li>`;
    const nr = X.nameChg ? X.S.slots.filter(s => X.vivo(s) && X.nameChg(s)).length : 0;   // what the bar's «con fecha nueva» said in its title (D-144)
    return cab + `<p class="cpnota">Cambiaron después de subirlas a Notion. Se resuelven con «sube ${esc(c ? c.name : 'el cliente')}»${nr ? `: al subirlas se renombra${nr === 1 ? ' 1 publicación' : `n ${nr} publicaciones`} para que la numeración cuadre` : ''}.</p>`
      + `<ul class="vlist">${l.map(fila).join('')}</ul>`;
  }
  function abrirCambios() {
    const X = I(); if (!X || !X.S || !X.cambiosDe || X.root().classList.contains('client')) return;
    X.showDialog('cambios', cambHTML(X));
  }
  function cambPintar() {                      // drawn again with the mesa (a ⌘Z, a change from elsewhere)
    const X = I(), d = X && X.root && X.root().querySelector('.detail[data-dlg="cambios"]'); if (!d || d.hidden || !X.S || !X.cambiosDe) return;
    const c = d.querySelector('.card'); if (!c) return;
    const h = cambHTML(X); if (c._h === h) return;
    const dentro = c.contains(document.activeElement);
    c.innerHTML = h; c._h = h;
    if (dentro && !c.contains(document.activeElement)) { const x = c.querySelector('.x'); if (x) x.focus(); }   // D-155
  }
  function enCamb(b) {
    const X = I(), li = b.closest('li[data-k]'); if (!X || !X.S) { if (X) X.closeDetail(); return; }
    if (b.dataset.cal !== 'c-abrir' || !li) return;
    X.closeDetail();
    if (X.slot(li.dataset.k)) X.openDetail(li.dataset.k, 0);
  }

  // ---------- moving a post to another day (its time stays) ----------
  // Pointer events (the mesa keeps HTML drag and drop for photos from the computer); a press that doesn't move is a click.
  let mv = null, later = false, noClick = 0, scr = 0;
  const dayUnder = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#mesa .side > .cal .cday[data-day]') : null; };
  function onDown(e) {
    if (e.button !== 0 || e.pointerType === 'touch' || mv) return;
    const X = I(), ch = e.target.closest && e.target.closest('#mesa .side > .cal .chip[data-slot]');
    if (!ch || !X || X.locked || ch.classList.contains('cx') || X.root().classList.contains('client')) return;
    const s = X.S && X.S.slots.find(x => x.id === ch.dataset.slot);
    mv = { id: ch.dataset.slot, el: ch, x: e.clientX, y: e.clientY, on: false, over: null, pub: !!s && X.estadoDe(s) === 'publicado' };   // a published one never lands (D-103)
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
    mv.over = day; if (day) day.classList.add(mv.pub || day.dataset.day < I().hoy() ? 'cno' : 'cover');
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
    if (X.estadoDe(s) === 'publicado') { X.toast('Ya está publicada: no se mueve.', { key: 'mover-publicada' }); return; }
    if (day < X.hoy()) { X.toast('Ese día ya ha pasado: la publicación no se ha movido.'); return; }
    X.setDate(id, X.dOnly(s.date) ? day : X.madridISO(day, X.localTime(s.date)));   // the mesa's own move (says if it falls outside the board)
  }
  const onCancel = () => end(null);

  // ---------- styles (inside #mesa, with its fonts, radii and greys) ----------
  const CSS = `
#mesa .side>.cal{flex:var(--cal-g,1) 1 0;min-height:0;display:flex;flex-direction:column;border-top:1px solid var(--line);background:var(--panel)}
#mesa .side>.cal.fold{flex:none}
#mesa .side>.cal.fold .cleg,#mesa .side>.cal.fold .calbody,#mesa .side>.cal.fold .cnav{display:none}
#mesa .calhead{flex:none;display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;padding:6px 10px 4px 6px;font-size:12px;color:var(--mute)}
#mesa .side>.cal.fold .calhead{padding:4px 10px 4px 6px}
#mesa .cfold{display:inline-flex;align-items:center;gap:5px;border:0;background:none;padding:3px 8px 3px 6px;border-radius:var(--r-pill);color:var(--ink);font:inherit;transition:background var(--d1) ease-out}
#mesa .cfold:hover{background:var(--bg-2)}#mesa .cfold b{font-size:var(--cx-tit-fs);font-weight:var(--cx-tit-fw);letter-spacing:var(--cx-tit-ls)}
#mesa .cfold svg{width:14px;height:14px;transition:transform var(--d-m) var(--ease-m)}#mesa .cal.fold .cfold svg{transform:rotate(-90deg)}
#mesa .csync,#mesa .cnat{white-space:nowrap}#mesa .csync.c{color:var(--chg)}#mesa .cnat{font-size:11px;color:var(--faint)}
#mesa .side>.cal.fold .cnat{display:none}
#mesa .side>.cal.fold.cal-anim .cleg{display:flex}#mesa .side>.cal.fold.cal-anim .calbody{display:block}#mesa .side>.cal.fold.cal-anim .cnav{display:inline-flex}
#mesa .side>.cal.fold.cal-anim .cleg,#mesa .side>.cal.fold.cal-anim .calbody,#mesa .side>.cal.fold.cal-anim .cnav{animation:cal-fuera var(--d-m) var(--ease-m) forwards}
#mesa .side>.cal.cal-anim:not(.fold) .cleg,#mesa .side>.cal.cal-anim:not(.fold) .calbody,#mesa .side>.cal.cal-anim:not(.fold) .cnav{animation:cal-dentro var(--d-m) var(--ease-m)}
#mesa .side>.cal.fold.cal-anim .cfold svg{animation:cal-ch-f var(--d-m) var(--ease-m)}#mesa .side>.cal.cal-anim:not(.fold) .cfold svg{animation:cal-ch-a var(--d-m) var(--ease-m)}
@keyframes cal-fuera{to{opacity:0}}@keyframes cal-dentro{from{opacity:0}}@keyframes cal-ch-f{from{transform:none}}@keyframes cal-ch-a{from{transform:rotate(-90deg)}}
@media (prefers-reduced-motion:reduce){#mesa .side>.cal.cal-fade .cleg,#mesa .side>.cal.cal-fade .calbody{animation:cal-dentro .15s linear !important}}
#mesa .cnav{margin-left:auto;display:inline-flex;align-items:center;gap:2px;color:var(--ink)}
#mesa .cnav button{position:relative;border:0;background:none;width:var(--cx-nav);height:var(--cx-nav);padding:0;border-radius:var(--r-pill);font-size:0;color:var(--ink);cursor:pointer;transition:background var(--d1) ease-out}
#mesa .cnav button::before{content:'';position:absolute;inset:0;margin:auto;width:16px;height:16px;background:currentColor;-webkit-mask:var(--i-chev) center/contain no-repeat;mask:var(--i-chev) center/contain no-repeat;transform:rotate(90deg)}#mesa .cnav button[data-cal="next"]::before{transform:rotate(-90deg)}
#mesa .cnav button:hover:not(:disabled){background:var(--cx-hov)}#mesa .cnav button:disabled{color:var(--faint);cursor:default}
#mesa .cmes{min-width:124px;text-align:center;font-size:var(--cx-tit-fs);font-weight:var(--cx-tit-fw);letter-spacing:var(--cx-tit-ls);-webkit-user-select:none;user-select:none}
#mesa .cleg{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:3px 2px;padding:0 10px 6px;font-size:10.5px;color:var(--mute)}
#mesa .cleg span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
#mesa .cpaso{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;border:1px solid transparent;border-radius:999px;padding:1px 7px;background:none;font:inherit;font-size:10.5px;line-height:15px;color:var(--ink)}
#mesa button.cpaso{cursor:pointer;transition:background var(--d1) ease-out,border-color var(--d1) ease-out}#mesa button.cpaso:hover{background:var(--bg-2)}
#mesa button.cpaso:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .cpaso.act{background:var(--ink);border-color:var(--ink);color:var(--on-ink);font-weight:600}
#mesa .cpaso.act .e-programado,#mesa .cpaso.act .e-publicado{color:var(--ok-on-ink)}
#mesa .cpaso.sig{border-color:var(--faint)}#mesa .cpaso.sig:hover{background:var(--bg);border-color:var(--line-strong);color:var(--ink)}
#mesa .cpaso.fut{color:var(--faint)}#mesa .cpaso.fut .edot,#mesa .cpaso.fut .eico{opacity:.5}
#mesa .cpaso.ro{color:var(--mute)}
#mesa .cvenc{border:0;background:none;padding:0;font:inherit;font-size:12px;font-weight:600;color:var(--red);cursor:pointer;white-space:nowrap;text-decoration:none;text-underline-offset:2px}#mesa .cvenc:hover{text-decoration:underline}
#mesa .chip.venc{box-shadow:inset 0 0 0 1.5px var(--red)}#mesa .chip.venc .ct{color:var(--red);font-weight:600}
#mesa .vlist{list-style:none;margin:8px 0 0;padding:0;max-height:min(60vh,520px);overflow:auto}
#mesa .vlist li{padding:10px 0;border-top:1px solid var(--line2)}
#mesa .vlist .vnom{border:0;background:none;padding:0;font:inherit;color:var(--ink);cursor:pointer}#mesa .vlist .vnom:hover b{text-decoration:underline}
#mesa .vlist .vque{font-size:12px;color:var(--mute)}#mesa .vlist .votro{color:var(--ink)}
#mesa .vacc,#mesa .vform{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}#mesa .vacc button,#mesa .vform button{font-size:12px;min-height:28px;padding:0 12px}
#mesa .vacc button[disabled]{opacity:.4;cursor:default}
#mesa .vform input{font:inherit;font-size:12px;min-height:28px;padding:0 8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel-2);color:var(--ink);transition:border-color var(--d1) ease-out,box-shadow var(--d1) ease-out}#mesa .vform input:focus{outline:0;border-color:var(--ink);box-shadow:0 0 0 3px var(--ring)}#mesa .vform input[type=text]{flex:1;min-width:160px}
#mesa .cleg .csep{position:relative;display:inline-block;width:10px;height:10px;vertical-align:middle;color:var(--faint);font-size:0}#mesa .cleg .csep::before{content:'';position:absolute;inset:0;background:currentColor;-webkit-mask:var(--i-chev-r) center/contain no-repeat;mask:var(--i-chev-r) center/contain no-repeat}
#mesa .cleg .cextra{gap:8px;margin-left:auto;padding-left:8px;color:var(--faint)}
#mesa .detail .cplist{max-height:30vh}#mesa .detail .cplist li span.cpb{color:var(--red)}
#mesa .detail .cpnota{font-size:12px}
#mesa .detail .cprv>p{margin:0 0 10px;color:var(--mute);font-size:12.5px}#mesa .detail .cprv>p.xwhat{color:var(--ink);font-size:13px}
#mesa .detail .xwhat .cpn{color:var(--mute);font-size:12.5px}
#mesa .calbody{flex:1;min-height:0;overflow:auto;padding:0 10px 10px}
#mesa .cgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr)) 28px;gap:var(--cx-gap);min-height:100%}
#mesa .cal.nocnt .cgrid{grid-template-columns:repeat(7,minmax(0,1fr)) 16px}
#mesa .cdow{padding:3px 6px;font-size:10.5px;font-weight:600;color:var(--cx-wk-c)}
#mesa button.cdow.ccnt::before{content:'';position:absolute;inset:0;margin:auto;width:12px;height:12px;background:currentColor;-webkit-mask:var(--i-sigma) center/contain no-repeat;mask:var(--i-sigma) center/contain no-repeat}
#mesa button.cdow.ccnt{position:relative;border:0;padding:0;border-radius:var(--cx-r);background:none;font:inherit;font-size:0;font-weight:600;color:var(--cx-wk-c);text-align:center;cursor:pointer;transition:background var(--d1) ease-out,color var(--d1) ease-out}
#mesa button.cdow.ccnt:hover{color:var(--ink);background:var(--cx-hov)}
#mesa .cday{position:relative;min-width:0;display:flex;flex-direction:column;gap:2px;padding:2px 3px 4px;border-radius:var(--cx-r);background:var(--cx-casilla)}
#mesa .cday.off,#mesa .cday.prevc,#mesa .cday.otromes{background:none}
#mesa .cday.out .dn,#mesa .cday.off .dn,#mesa .cday.prevc .dn,#mesa .cday.otromes .dn{color:var(--cx-otro)}
#mesa .cday.today{box-shadow:var(--cx-hoy)}
#mesa .dh{display:flex;align-items:center;justify-content:space-between;gap:4px;min-height:18px;padding:0 1px}
#mesa .dn{font-size:11px;font-weight:400;font-variant-numeric:tabular-nums;color:var(--ink);line-height:18px;padding:0 4px;white-space:nowrap}
#mesa .cday.today .dn{font-weight:600}
#mesa .dmany{font-size:10.5px;line-height:15px;padding:0 6px;border-radius:var(--r-pill);background:var(--chg-soft);color:var(--chg)}
#mesa .chip{display:flex;align-items:center;flex-wrap:wrap;column-gap:4px;width:100%;min-width:0;border:0;border-radius:var(--r-xs);padding:2px 6px;text-align:left;font:inherit;font-size:11px;line-height:15px;cursor:pointer;--cb:var(--ty-trial);--ci:var(--ty-trial-ink);color:var(--ci);background:var(--cb);transition:filter var(--d1) ease-out,background-color var(--d1) ease-out,color var(--d1) ease-out}
#mesa .chip .cl{flex:1 1 auto;min-width:0;max-width:100%;display:flex;align-items:center;gap:4px}
#mesa .chip .cn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400}
#mesa .chip .ct{flex:none;font-size:10.5px;opacity:.75}
#mesa .chip.ty-reel{--cb:var(--ty-reel);--ci:var(--ty-reel-ink)}
#mesa .chip.ty-collab{--cb:var(--ty-collab);--ci:var(--ty-collab-ink)}
#mesa .chip.ty-foto{--cb:var(--ty-foto);--ci:var(--ty-foto-ink)}
#mesa .chip.ty-carr{--cb:var(--ty-carr);--ci:var(--ty-carr-ink)}
#mesa .chip.ty-trial{--cb:var(--ty-trial);--ci:var(--ty-trial-ink)}
#mesa .cday.otromes .chip:not(.cx):not(.past):not(:hover):not(:focus-visible):not(.calhi){background:color-mix(in srgb,var(--cb) 45%,transparent);color:color-mix(in srgb,var(--ci) 55%,transparent)}
#mesa .chip.past{background:var(--ty-past);color:var(--faint);cursor:pointer}
#mesa .chip.cx{background:var(--ty-past);color:var(--faint)}#mesa .chip.cx .cn{text-decoration:line-through}
#mesa .chip:hover{filter:brightness(.97)}
#mesa .chip .dchg{flex:none;margin:0 0 0 1px}
#mesa .chip .cmk{display:inline-flex;flex:none;width:9px;height:9px;margin:0 0 0 1px}#mesa .chip .cmk svg{width:100%;height:100%}
#mesa .side>.cal{user-select:none;-webkit-user-select:none}
#mesa .chip.cmoving{opacity:.35}
#mesa .cghost{position:fixed;left:0;top:0;z-index:30;pointer-events:none;box-shadow:var(--shadow-drag);opacity:.95}
#mesa.calmv,#mesa.calmv *{cursor:grabbing !important}
#mesa .cday.cover{background:var(--acc-soft);box-shadow:inset 0 0 0 2px var(--acc)}
#mesa .cday.cno{background:var(--red-soft)}#mesa.calmv .cday.cno,#mesa.calmv .cday.cno *{cursor:not-allowed !important}
#mesa .chip.calhi{box-shadow:0 0 0 2px var(--ink)}
#mesa .cell.calhi::after{content:'';position:absolute;inset:0;z-index:6;pointer-events:none;box-shadow:inset 0 0 0 2px var(--on-photo),inset 0 0 0 4px var(--ink)}
#mesa .cgrid>.ccnt:not(button){display:flex;align-items:center;justify-content:center;font:600 11px var(--font);color:var(--ink);font-variant-numeric:tabular-nums}
#mesa .cgrid>.ccnt.z{color:var(--cx-otro);font-weight:400}
#mesa .ctot{grid-column:1/8;padding:4px 8px;text-align:right;font-size:11px;color:var(--mute)}
#mesa .ctotn{min-height:22px}
#mesa.client .edot,#mesa.client .eico,#mesa.client .cmk,#mesa.client .cleg,#mesa.client .csync,#mesa.client .cnat,#mesa.client .dmany,#mesa.client .chip.cx,#mesa.client .chip .dchg{display:none}
#mesa.client .chip{cursor:pointer}
@media (max-width:720px){#mesa .side>.cal:not(.fold){flex:none;height:42vh}}`;
  I().estilo('mesa-cal-css', CSS);

  function onDbl(e) {                            // the month's name: back to the month the board opens with (D-159)
    const X = I(); if (!X || !e.target.closest || !e.target.closest('#mesa .side > .cal .cmes') || !X.S) return;
    const ini = mesInicial(X, span(X)); if (view.m !== ini) { view.m = ini; render(); }
  }
  const ON = [['pointerover', onOver], ['click', onClick, false], ['dblclick', onDbl, false], ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', end], ['pointercancel', onCancel], ['keydown', onKey]];
  ON.forEach(([t, f, c]) => document.addEventListener(t, f, c !== false));
  M.calendario = {
    version: VERSION, render, vencidas: abrirVencidas, cambios: abrirCambios,
    _off: () => { ON.forEach(([t, f, c]) => document.removeEventListener(t, f, c !== false)); if (mv) onCancel(); }
  };
  render();                                     // the mesa may have drawn its board before this file arrived
  (window.MESA_CARGA = window.MESA_CARGA || {}).calendario = 'ok';   // it ran to the end: a module that throws while loading is told apart (D-115)
})();
