// Revisión — Mesa de trabajo · v1.0
// «Revisar» (the board's bar) lists, by post and slide, what to look at in the open board before uploading or scheduling
// it; a click opens that point (the editor on its slide, or the post's view). The same review runs by itself (mesa.js
// calls auto) when the skill uploads to Notion («sube», M.startUpload) or schedules with Zernio («programa»,
// M.startZernio), on the posts sent, and after «⇅ Exportar» (with the empty holes of the other boards, D-037). Only an
// empty photo hole stops a post (the mesa refuses it itself, D-035); the rest only warns (D-040):
//   hueco      an empty photo hole in what is published
//   numeración a numbered text (D-038), or one written by hand like «02 / 11», that is not its slide's place and total
//   resolución a photo with fewer than 1080 px across the slide's width (its reframe, or as drawn in the slide)
//   margen     a text whose ink goes outside the margin of the client's kit (lienzo.margen)
//   formato    a Foto or Carrusel outside what Instagram takes by API (4:5 to 1.91:1: 3:4 does not go)
// The weight (8 MB, JPEG only) and the widest side (1440 px) are not listed: «programa» always sends a JPEG under 8 MB and
// Instagram scales a wider one down. It reads the board only through the mesa's bridge (M._in, mesa ≥ 3.43), and texts
// and photos as libre.js draws them (M.libre.rev, libre ≥ 1.18); without libre (or the kit) those checks are left out.
//   M.revisar({slots?, ver?}) -> Promise<{ok (nothing blocks), bloquean, avisos, puntos: [{slotId, post, diapositiva
//     (1…, null: the whole post), tipo, bloquea, texto, donde ('editor'|'post')}]}>; ver: shown in the mesa
// If this file doesn't load, the mesa works as before (no «Revisar»; uploads still refuse empty holes).
(function revisarBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.0';
  const MIN_PX = 1080, IG_MIN = 4 / 5, IG_MAX = 1.91, TOL = 0.005;
  const ORDEN = { hueco: 0, numeración: 1, resolución: 2, margen: 3, formato: 4 };
  const corto = t => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > 28 ? t.slice(0, 27) + '…' : t; };
  const listar = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0] || '';
  const nDe = (n, a, b) => `${n} ${n === 1 ? a : b}`;

  // libre.js and diseno.js load on their own (async): wait for them a little
  const C = () => window.MESA_CARGA || {}, pausa = () => new Promise(r => setTimeout(r, 100));
  async function listos() { for (let i = 0; i < 50 && !(M.libre && M.libre.rev) && C().libre !== 'fallo'; i++) await pausa(); }
  async function margenDe(cid) {               // the kit's margin, a fraction of the width (0: no kit, or none in it)
    for (let i = 0; i < 50 && !M.diseno && C().diseno !== 'fallo'; i++) await pausa();
    if (!(M.diseno && M.diseno.kit) || !cid) return 0;
    try { const k = await M.diseno.kit(cid); return k && k.lienzo && +k.lienzo.margen > 0 ? +k.lienzo.margen / (+k.lienzo.ancho || 1080) : 0; } catch (e) { return 0; }
  }
  const fmtDe = r => Math.abs(r - 3 / 4) < 0.01 ? '3:4' : Math.abs(r - 9 / 16) < 0.01 ? '9:16' : Math.abs(r - 2 / 3) < 0.01 ? '2:3' : String(Math.round(r * 100) / 100).replace('.', ',') + ':1';

  async function revisar(opts = {}) {
    const B = I() && I().S, nada = { ok: true, bloquean: 0, avisos: 0, puntos: [], key: B ? B.key : null };
    if (!B || (opts.slots && !opts.slots.length)) return nada;
    await listos();
    const X = I(), R = M.libre && M.libre.rev;
    let mg = null;                               // the kit is read only when there is a text to measure
    const solo = opts.slots ? new Set(opts.slots) : null, puntos = [];
    for (const s of B.slots.slice()) {
      if (!X.vivo(s) || (solo && !solo.has(s.id))) continue;
      const pub = X.publishList(s), n = pub.length; if (!n) continue;
      const add = (i, tipo, texto, o = {}) => puntos.push({ slotId: s.id, post: s.name || '', diapositiva: i == null ? null : i + 1, tipo, bloquea: !!o.bloquea, texto, donde: o.donde || (i == null ? 'post' : 'editor') });
      const hv = new Set(X.huecosVacios(s, B.slots)), formato = [];
      for (let i = 0; i < n; i++) {
        const fid = pub[i], f = M.files[fid] || {}, comp = X.lComp(s, fid, B.slots);
        if (hv.has(i + 1)) add(i, 'hueco', 'hueco de foto vacío: no se sube ni se programa hasta llenarlo', { bloquea: true });
        if (comp && R) {                         // drawn in the editor: what «Aplicar» drew, on its own size
          const W = f.w || 1440, H = f.h || Math.round(W * 5 / 4), tol = 2 * W / 1080, fuera = [];
          let px = Infinity;
          for (const e of comp.els || []) {
            if (!e || e.oculto) continue;
            if (e.t === 'foto' && e.src) { const r = await R.medida(e, W, H); if (r) px = Math.min(px, r.px); continue; }
            if (e.t !== 'texto') continue;
            const txt = String(e.txt ?? '');
            if (e.num) { const t = R.numTxt(e, i, n); if (txt !== t) add(i, 'numeración', `la numeración dice «${txt}» y le toca «${t}»`); }
            else if (R.numAMano(txt)) { const k = R.NUM_RE.exec(txt); if (+k[1] !== i + 1 || +k[2] !== n) add(i, 'numeración', `«${txt.trim()}» no cuadra: es la ${i + 1} de ${n}`); }
            if (txt.trim() && mg == null) mg = await margenDe(B.client);
            const m = mg * W;
            if (m && txt.trim()) { const b = await R.medida(e, W, H); if (b && (b.x0 < m - tol || b.x1 > W - m + tol || b.y0 < m - tol || b.y1 > H - m + tol)) fuera.push(`«${corto(txt)}»`); }
          }
          if (Math.round(px) < MIN_PX) add(i, 'resolución', `foto de menos de 1080 px: equivale a ${Math.round(px)} px de ancho`);
          if (fuera.length) add(i, 'margen', `${fuera.length === 1 ? 'texto fuera' : fuera.length + ' textos fuera'} del margen del kit: ${listar(fuera)}`);
          if (f.w && f.h) formato.push(f.w / f.h);
        } else if (!f.w || !f.h) continue;       // a photo not loaded in the mesa: nothing to measure
        else if (!f.design) {                    // a photo with the mesa's reframe
          const r = X.postRect(fid, s);
          if (Math.round(r.w) < MIN_PX) add(i, 'resolución', `foto de menos de 1080 px: ${Math.round(r.w)} px de ancho tal como está encuadrada`, { donde: 'post' });
          formato.push(r.w / r.h);
        } else if (f.w && f.h) formato.push(f.w / f.h);   // drawn by «Diseñar» (1080 wide): only its format
      }
      const malo = formato.find(r => r < IG_MIN - TOL || r > IG_MAX + TOL);
      if (X.isCarousel(s.type) && malo != null) add(null, 'formato', `formato ${fmtDe(malo)}: Instagram, por API, solo admite de 4:5 a 1,91:1`);
    }
    const pos = new Map(B.slots.map((s, i) => [s.id, [String(s.date || ''), i]]));   // by publication date, as the calendar
    const antes = (a, b) => { const x = pos.get(a.slotId), y = pos.get(b.slotId); return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]; };
    puntos.sort((a, b) => antes(a, b) || (a.diapositiva ?? 0) - (b.diapositiva ?? 0) || ORDEN[a.tipo] - ORDEN[b.tipo]);
    if (!I().S || I().S.key !== B.key) return nada;   // another board opened meanwhile: this one is not the one in view
    const bloquean = puntos.filter(p => p.bloquea).length, res = { ok: !bloquean, bloquean, avisos: puntos.length - bloquean, puntos, key: B.key };
    if (opts.ver) ver(res, 'revisar');
    return res;
  }

  // ---------- the list, in the mesa's dialog ----------
  const TITULO = { revisar: 'Revisión antes de subir o programar', sube: 'Revisión antes de subir a Notion', programa: 'Revisión antes de programar', exportar: 'Mesa exportada' };
  const cuenta = res => [res.bloquean ? nDe(res.bloquean, 'punto bloquea', 'puntos bloquean') : '', res.avisos ? nDe(res.avisos, 'aviso', 'avisos') : ''].filter(Boolean).join(' y ');
  function resumen(res) {
    if (!res.puntos.length) return 'Todo en orden: nada que revisar.';
    return cuenta(res) + '.' + (res.bloquean ? ' Lo que bloquea no se sube ni se programa; los avisos, sí.' : ' Los avisos no impiden subir ni programar.') + ' Pulsa uno para abrirlo.';
  }
  function ver(res, motivo, o = {}) {
    const X = I(), B = X.S, esc = X.esc;
    const c = B && X.CL.find(x => x.id === B.client), donde = B ? `${(c && c.name) || B.client}, ${X.monthLabel(B.month)}` : '';
    const grupos = [];
    for (const p of res.puntos) { const g = grupos[grupos.length - 1]; if (g && g.slotId === p.slotId) g.ps.push(p); else grupos.push({ slotId: p.slotId, post: p.post, ps: [p] }); }
    const otros = o.otros || [];
    const lista = grupos.length ? `<ul class="rv">${grupos.map(g => `<li><b>${esc(g.post)}</b><ul>${g.ps.map(p => `<li><button type="button" class="rv-i${p.bloquea ? ' rv-b' : ''}" data-act="rv-ir" data-slot="${esc(p.slotId)}" data-k="${p.diapositiva ? p.diapositiva - 1 : 0}"${p.donde === 'editor' ? ' data-ed="1"' : ''}>${p.diapositiva ? `Diapositiva ${p.diapositiva}: ` : ''}${esc(p.texto)}${p.bloquea ? ' <i>(bloquea)</i>' : ''}</button></li>`).join('')}</ul></li>`).join('')}</ul>` : '';
    const fuera = otros.length ? `<p>${otros.length === 1 ? 'Y un hueco de foto vacío en otro mes' : `Y huecos de foto vacíos en ${otros.length} publicaciones de otros meses`} (la copia los lleva tal cual):</p>`
      + `<ul class="xsum">${otros.map(h => `<li><b>${esc(h.post)}</b>: ${h.diapositivas.length === 1 ? 'diapositiva' : 'diapositivas'} ${h.diapositivas.join(', ')} <span>· ${esc(h.cliente)}, ${esc(h.mes)}</span></li>`).join('')}</ul>` : '';
    const msg = o.msg ? `${esc(o.msg)}. ` : '';
    X.showDialog('revisar', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${TITULO[motivo] || TITULO.revisar}</h3>`
      + `<p>${msg}${B ? `${esc(donde)}: ${esc(resumen(res))}` : ''}</p>${lista}${fuera}`
      + '<div class="form"><div class="row"><button type="button" class="btn" data-act="close">Entendido</button></div></div>');
    const b = X.root().querySelector('.detail .btn[data-act="close"]'); if (b) b.focus();
  }

  // ---------- by itself: «sube», «programa» and «⇅ Exportar» ----------
  // The skill sends a post's photos in one call or several in a row: those of the next 1.5 s join the same review.
  // Each review belongs to the board it was asked on: if another board is open by then, it is dropped.
  let AUTO = null;
  function auto(motivo, ids, o = {}) {
    const key = I() && I().S ? I().S.key : null;
    if (motivo === 'exportar') return (revisar.ultima = mostrar(motivo, null, key, o));
    if (AUTO && AUTO.motivo === motivo && AUTO.key === key) clearTimeout(AUTO.t); else AUTO = { motivo, key, ids: new Set() };
    (ids || []).forEach(id => AUTO.ids.add(id));
    const a = AUTO;
    a.t = setTimeout(() => { if (AUTO === a) AUTO = null; revisar.ultima = mostrar(motivo, [...a.ids], key); }, 1500);
    return null;
  }
  async function mostrar(motivo, ids, key, o = {}) {
    try {
      const X = I(); if (!X) throw new Error('sin mesa');
      const res = X.S && X.S.key === key ? await revisar(ids ? { slots: ids } : {}) : { ok: true, bloquean: 0, avisos: 0, puntos: [], key };
      const B = X.S; if (!B || B.key !== key || res.key !== key) res.puntos = [];
      const otros = (o.huecos || []).filter(h => `${h.client}-${h.month}` !== key);
      if (!res.puntos.length && !otros.length) { if (o.msg) X.toast(o.msg, { ms: 7000 }); return res; }
      const cliente = X.root().classList.contains('client');   // «Vista cliente»: nothing of this in front of the client
      if (cliente && motivo !== 'exportar') return res;
      // the editor, or a post or dialog in use: never closed under the person; a note says where to look
      const d = X.root().querySelector('.detail'), ocupado = (M.libre && M.libre.abierto && M.libre.abierto()) || (d && !d.hidden && d.dataset.dlg !== 'revisar');
      if (ocupado && motivo !== 'exportar') { X.toast(`${TITULO[motivo]}: ${cuenta(res)}. Pulsa «Revisar» para verlos.`, { ms: 9000 }); return res; }
      ver(res, motivo, { msg: o.msg, otros });
      return res;
    } catch (e) {                              // the export's notice is never lost (D-037): mesa.js shows it as before
      console.warn('revisión:', e);
      if (o.fallo) o.fallo();
      return null;
    }
  }

  const CSS = `#mesa .rv{list-style:none;margin:10px 0 0;padding:0;max-height:min(52vh,460px);overflow:auto}
#mesa .rv>li{margin:0 0 10px}#mesa .rv>li>b{font-size:13.5px}#mesa .rv ul{list-style:none;margin:3px 0 0;padding:0}
#mesa .rv-i{display:block;width:100%;box-sizing:border-box;padding:4px 8px;border:0;border-radius:6px;background:none;color:var(--ink);font:inherit;font-size:13px;text-align:left;cursor:pointer}
#mesa .rv-i:hover,#mesa .rv-i:focus-visible{background:var(--line2);outline:0}#mesa .rv-i.rv-b{color:var(--red)}#mesa .rv-i i{font-style:normal;font-weight:600}`;
  let style = document.getElementById('mesa-rv-css');
  if (!style) { style = document.createElement('style'); style.id = 'mesa-rv-css'; document.head.append(style); }   // in the head: the mesa's shell empties the body
  style.textContent = CSS;

  revisar.version = VERSION; revisar.auto = auto; revisar.ultima = null;
  revisar.ver = (opts = {}) => revisar({ ...opts, ver: true });
  revisar._reset = () => { if (AUTO) clearTimeout(AUTO.t); AUTO = null; };   // tests: a pending review never reaches the next one
  M.revisar = revisar;
})();
