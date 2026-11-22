// Informe — Mesa de trabajo · v1.0 (D-240)
// In the vista cliente, the why of the month the calendar shows (the tab «Por qué este calendario») and how the month before
// it went («Cómo fue <mes>», under «Tus pagos» in the right column), from what Claude loads with MESA.informe (D-238); the
// client never writes them. Both follow the calendar's month. Without data: «En camino» for a month after the last one with
// data (or, for the summary, a month not over yet); nothing for an earlier month without it, nor for a client that has none.
// If this file doesn't load, the vista cliente is the one of the 4.26.
(function informeBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.1';   // 1.1: «Ver más en Zernio» right under the title of «Cómo fue» (D-294)
  const I = () => M._in, D = () => M._in.mes;
  if (M.informeUI && M.informeUI._off) { try { M.informeUI._off(); } catch (e) { /* */ } }
  const OFF = [];
  const on = (t, ty, f, o) => { t.addEventListener(ty, f, o); OFF.push(() => t.removeEventListener(ty, f, o)); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoy = () => I().hoy();

  // ---------- words and figures (Spain's format: «18,4 mil», «+12 %») ----------
  const MESES = () => D().MESES;
  const nomMes = m => MESES()[+m.slice(5, 7) - 1] || '';
  const mesTxt = m => nomMes(m) + (m.slice(0, 4) !== hoy().slice(0, 4) ? ' ' + m.slice(0, 4) : '');   // «octubre», «diciembre 2025»
  const may = t => t.charAt(0).toUpperCase() + t.slice(1);
  const antes = m => { let [y, mo] = m.split('-').map(Number); mo--; if (!mo) { mo = 12; y--; } return y + '-' + String(mo).padStart(2, '0'); };
  const num = (n, o) => Number(n).toLocaleString('es-ES', o);
  const cifra = n => n >= 999950 ? num(n / 1e6, { maximumFractionDigits: 1 }) + ' mill.' : n >= 1000 ? num(n / 1000, { maximumFractionDigits: 1 }) + ' mil' : num(n);   // never «1000 mil»
  const exacta = n => num(n);   // «1400», «11.200» (the RAE: no point with four figures)
  const corto = d => +d.slice(8, 10) + ' ' + nomMes(d).slice(0, 3);   // «3 oct»
  // the change against the month before: its text, its kind (sube / baja / igual / sin) and what it says in full
  function cambio(v, a, mAnt) {
    if (a == null) return { t: 'sin datos de ' + nomMes(mAnt), k: 'sin', l: `Sin datos de ${nomMes(mAnt)} para comparar` };
    if (a === 0) return v ? { t: 'frente a 0', k: 'sin', l: `En ${nomMes(mAnt)}, 0` } : { t: 'igual', k: 'igual', l: `Igual que en ${nomMes(mAnt)}` };
    const p = Math.round((v - a) / a * 100);
    if (!p) return { t: 'igual', k: 'igual', l: `Igual que en ${nomMes(mAnt)} (${exacta(a)})` };
    return { t: (p > 0 ? '+' : '−') + num(Math.abs(p)) + ' %', k: p > 0 ? 'sube' : 'baja', l: `${p > 0 ? '+' : '−'}${num(Math.abs(p))} % frente a ${nomMes(mAnt)} (${exacta(a)})` };
  }

  // ---------- icons (Lucide, the mesa's stroke, D-168) ----------
  const RELOJ_ARENA = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>';
  const camino = x => `<div class="if-camino">${RELOJ_ARENA}<p><b>En camino</b>${esc(x)}</p></div>`;

  // what a client has: the last month with a why and the last with a summary
  function datos(cli) {
    const l = D().deCliente(cli);
    let pq = '', rs = ''; l.forEach(r => { if (r.porque && r.mes > pq) pq = r.mes; if (r.resumen && r.mes > rs) rs = r.mes; });
    return { pq, rs };
  }
  const listo = () => { const d = I() && I().mes; return !!(d && d.listo() && !d.mal()); };   // read (a failed reading is not «no data»)
  // what each part drew, kept until the months change (here or in another tab) or the day does: a redraw without changes
  // composes nothing again
  let gen = 0; const MEMO = new Map();
  const memo = (k, f) => (ctx) => { const cli = ctx && ctx.cliente, m = ctx && ctx.mes; if (!cli || !m || !listo()) return '';
    const key = `${k}|${gen}|${hoy()}|${cli}|${m}|${metricas(cli)}`; if (MEMO.has(key)) return MEMO.get(key); if (MEMO.size > 60) MEMO.clear(); const h = f(ctx); MEMO.set(key, h); return h; };

  // the client's link of its metrics in Zernio (D-292), only https: «Ver más en Zernio» right under the title (D-294)
  const metricas = cli => { const c = (I().CL || []).find(x => x.id === cli), u = c && c.metricas; return u && I().metricasOk && I().metricasOk(u) && /^https:\/\//.test(u) ? u : ''; };
  const EXT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
  const zernio = cli => { const u = metricas(cli); return u ? `<a class="if-zernio" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Ver más en Zernio${EXT}</a>` : ''; };

  // ---------- the tab «Por qué este calendario» ----------
  function porqueHTML(ctx) {
    const cli = ctx && ctx.cliente, m = ctx && ctx.mes; if (!cli || !m || !listo()) return '';
    const r = D().get(cli, m);
    if (r && r.porque) return `<div class="if-pq">${r.porque.partes.map(p => `<p><b>${esc(p.t)}${/[.:?!]$/.test(p.t) ? '' : '.'}</b> ${esc(p.x)}</p>`).join('')}</div>`;
    const { pq } = datos(cli);
    return pq && m > pq ? camino(`El porqué de ${nomMes(m)} llega con su calendario.`) : '';
  }

  // ---------- «Cómo fue <mes anterior>» in the right column ----------
  // each post's reach as columns in date order: one series in the neutral --barra, the best in the accent with its name and
  // figure written (emphasis); a title per column, the chart's aria-label and a table for screen readers (dataviz)
  function grafica(res, mes) {
    const P = res.posts, n = P.length; if (!n) return '';
    const max = Math.max(1, ...P.map(p => p.alcance)), best = P.reduce((a, p, i) => p.alcance > P[a].alcance ? i : a, 0);
    const alto = v => v ? Math.max(2, v / max * 100) : 0;   // % of the plot; a post with reach shows at least 2 px
    // the best's label: centred over its column if it fits in the chart (320 px at least), else from the column's edge with
    // more room, cut to fit (width estimated per letter at 12 px, capitals wider)
    const ancho = t => [...t].reduce((a, ch) => a + (/[A-ZÁÉÍÓÚÑ@MW]/.test(ch) ? 9 : /[\s.,·]/.test(ch) ? 3.5 : 6.8), 0);
    const W = 320, band = W / n, bw = Math.min(24, band - 4), cx = (best + 0.5) * band, bi = cx - bw / 2, bd = cx + bw / 2, fig = ' · ' + cifra(P[best].alcance);
    let nom = P[best].nombre.length > 26 ? P[best].nombre.slice(0, 25).trimEnd() + '…' : P[best].nombre, lado = 'medio';
    if (cx - ancho(nom + fig) / 2 < 0 || cx + ancho(nom + fig) / 2 > W) {
      lado = W - bi >= bd ? 'ini' : 'fin'; const sitio = lado === 'ini' ? W - bi : bd;
      while (nom.length > 1 && ancho(nom + fig) > sitio) nom = nom.slice(0, -2).trimEnd() + '…';
    }
    const cols = P.map((p, i) => {
      const h = alto(p.alcance), tit = `${p.nombre} · ${p.tipo} · ${corto(p.fecha)} · ${exacta(p.alcance)} de alcance`;
      const lab = i === best ? `<b class="if-v ${lado}">${esc(nom)} · ${esc(cifra(p.alcance))}</b>` : '';
      const fecha = i === 0 || i === n - 1 ? `<em class="if-d ${n === 1 ? 'medio' : i ? 'fin' : 'ini'}">${esc(corto(p.fecha))}</em>` : '';
      return `<span class="if-c${i === best ? ' top' : ''}" title="${esc(tit)}"><i style="height:${h.toFixed(1)}%">${lab}${fecha}</i></span>`;
    }).join('');
    const aria = `Alcance de cada publicación de ${nomMes(mes)}, ${n === 1 ? 'una publicación' : n + ' publicaciones'}; la de más alcance, ${P[best].nombre}, con ${exacta(P[best].alcance)}`;
    const tabla = `<div class="if-sr"><table><caption>Alcance de cada publicación de ${esc(nomMes(mes))}</caption><thead><tr><th>Publicación</th><th>Tipo</th><th>Fecha</th><th>Alcance</th></tr></thead><tbody>${P.map(p => `<tr><td>${esc(p.nombre)}</td><td>${esc(p.tipo)}</td><td>${esc(corto(p.fecha))}</td><td>${esc(exacta(p.alcance))}</td></tr>`).join('')}</tbody></table></div>`;   // in a box: a table ignores width:1px
    // HTML, not SVG: the columns keep their 24 px and the letters their 12 px at any width (an SVG would scale them); the best's
    // label and the first and last dates hang from their column, so they follow it
    const medio = n > 40 ? 0.5 : n > 24 ? 1 : 2;   // half the gap between columns: 4 px, less with many (they never vanish)
    return `<h3 class="if-sub">Alcance de cada publicación</h3><div class="if-ch" role="img" aria-label="${esc(aria)}"><div class="if-cols" style="--g:${medio}px">${cols}</div></div>${tabla}`;
  }
  function tiposHTML(res) {
    const T = res.tipos || []; if (!T.length) return '';
    const max = Math.max(1, ...T.map(t => t.alcance));
    return `<h3 class="if-sub">Alcance medio por tipo</h3><div class="if-tp">${T.map(t => `<span>${esc(t.tipo)}</span><i style="--w:${Math.max(t.alcance ? 1 : 0, t.alcance / max * 100).toFixed(1)}%" title="${esc(`${t.tipo}: ${exacta(t.alcance)} de alcance medio`)}"></i><em>${esc(cifra(t.alcance))}</em>`).join('')}</div>`;
  }
  const NOMBRES = { alcance: 'Alcance', interacciones: 'Interacciones', guardados: 'Guardados', publicaciones: 'Publicaciones' };
  function comoFueHTML(ctx) {
    const cli = ctx && ctx.cliente, m = ctx && ctx.mes; if (!cli || !m || !listo()) return '';
    const { rs } = datos(cli); if (!rs) return '';             // a client without any summary sees nothing new
    const p = antes(m), r = D().get(cli, p), h = hoy().slice(0, 7);
    const cab = x => `<h2 class="if-h">Cómo fue ${esc(mesTxt(p))}${x ? ` <span>${x}</span>` : ''}</h2>${zernio(cli)}`;
    if (!(r && r.resumen)) {
      if (p >= h) return `<div class="if-cf">${cab('')}${camino(`${may(nomMes(p))} aún no ha terminado: el resumen llega los primeros días de ${nomMes(m)}.`)}</div>`;
      if (p > rs) return `<div class="if-cf">${cab('')}${camino(`El resumen de ${nomMes(p)} llega en unos días.`)}</div>`;
      return '';
    }
    const res = r.resumen, c = res.cifras, ant = antes(p), npub = c.publicaciones.valor;
    const fichas = ['alcance', 'interacciones', 'guardados', 'publicaciones'].map(k => {
      const v = c[k].valor, d = cambio(v, c[k].anterior, ant);
      return `<div class="if-f"><span>${NOMBRES[k]}</span><b title="${esc(exacta(v))}">${esc(cifra(v))}</b><i class="${d.k}" title="${esc(d.l)}">${esc(d.t)}</i></div>`;
    }).join('');
    const frente = MESES_OK(c) ? `<p class="if-fr0">Frente a ${esc(nomMes(ant))}</p>` : '';
    return `<div class="if-cf">${cab(npub === 1 ? '1 publicación' : `${esc(num(npub))} publicaciones`)}<div class="if-fs">${fichas}</div>${frente}${grafica(res, p)}${tiposHTML(res)}<p class="if-frase">${esc(res.frase)}</p></div>`;
  }
  const MESES_OK = c => Object.values(c).some(x => x.anterior != null);

  // ---------- drawing again ----------
  function pintar() { gen++; const r = I() && I().root && I().root(); if (r && r.classList.contains('client') && I().vc) I().vc.pintar(); }
  let mesHoy = null;
  function alMinuto() { const h = hoy().slice(0, 7); if (mesHoy && h !== mesHoy) pintar(); mesHoy = h; }   // a new month in Madrid: «En camino» may change

  // ---------- mounting ----------
  let listoP = null;
  const esperar = () => listoP || (listoP = new Promise((res, rej) => { const t0 = Date.now(), t = setInterval(() => { if (I() && I().mes && I().vc && I().estilo) { clearInterval(t); res(); } else if (Date.now() - t0 > 30000) { clearInterval(t); rej(new Error('mesa.js sin meses')); } }, 50); }));
  M.informeUI = {
    version: VERSION,
    porque: memo('pq', porqueHTML), comoFue: memo('cf', comoFueHTML),
    _off: () => { OFF.splice(0).forEach(f => f()); if (I() && I().vc) { I().vc.quitar('pestana', 'porque'); I().vc.quitar('lado', 'comofue'); } }
  };
  esperar().then(() => {
    I().estilo('mesa-if-css', ESTILO);
    on(document, 'mesa-meses', pintar);
    const t = setInterval(alMinuto, 60000); OFF.push(() => clearInterval(t)); mesHoy = hoy().slice(0, 7);
    I().vc.poner('pestana', { id: 'porque', orden: 10, titulo: 'Por qué este calendario', html: M.informeUI.porque });
    I().vc.poner('lado', { id: 'comofue', orden: 20, html: M.informeUI.comoFue });
    pintar();
  }).catch(() => { (window.MESA_CARGA = window.MESA_CARGA || {}).informe = 'fallo'; });   // a mesa.js without 'meses' (an old cached one): the vista cliente of the 4.26

  // ---------- style (the mesa's tokens; light and dark come with them) ----------
  const ESTILO = `
#mesa{--barra:#998F85;--barra-top:var(--acc);--barra-top-hov:var(--acc-hover)}
:root[data-theme="dark"] #mesa,#mesa[data-theme="dark"]{--barra:#726960;--barra-top:var(--acc-ink);--barra-top-hov:color-mix(in srgb,var(--acc-ink) 80%,var(--ink))}
#mesa .if-pq{display:flex;flex-direction:column;gap:10px;max-width:62ch;margin:0;font-size:14px;line-height:1.5;color:var(--ink-2)}
#mesa .if-pq p{margin:0}#mesa .if-pq b{font-weight:600;color:var(--ink)}
#mesa .if-camino{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:var(--r-md);background:var(--bg);color:var(--ink-2);font-size:14px;line-height:1.5}
#mesa .if-camino svg{width:20px;height:20px;flex:none;margin-top:1px;fill:none;stroke:currentColor;color:var(--mute);stroke-width:var(--i-trazo);stroke-linecap:round;stroke-linejoin:round}
#mesa .if-camino svg *{vector-effect:non-scaling-stroke}
#mesa .if-camino p{margin:0}#mesa .if-camino b{display:block;font-weight:600;color:var(--ink)}
#mesa .if-cf{color:var(--ink)}
#mesa .if-h{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0 0 12px;font-size:17px;font-weight:800;letter-spacing:-.01em}
#mesa .if-h span{font-size:13px;font-weight:400;letter-spacing:0;color:var(--mute)}
#mesa .if-zernio{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;margin:-4px 0 14px;border-radius:var(--r-pill);background:var(--acc-soft);color:var(--acc-ink);font-size:14px;font-weight:600;text-decoration:none;transition:background var(--d1) ease-out}
#mesa .if-zernio:hover{background:color-mix(in srgb,var(--acc-soft),var(--acc) 12%)}
#mesa .if-zernio:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
#mesa .if-zernio svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:var(--i-trazo);stroke-linecap:round;stroke-linejoin:round}#mesa .if-zernio svg *{vector-effect:non-scaling-stroke}
#mesa .if-fs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#mesa .if-f{display:flex;flex-direction:column;gap:2px;min-width:0;padding:10px 12px;border-radius:var(--r-sm);background:var(--bg)}
#mesa .if-f span{font-size:12px;color:var(--mute)}
#mesa .if-f b{font-size:22px;font-weight:800;line-height:1.15;letter-spacing:-.02em;color:var(--ink)}
#mesa .if-f i{font-style:normal;font-size:12px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .if-f i.sube{color:var(--ok)}#mesa .if-f i.baja{color:var(--red)}
#mesa .if-fr0{margin:10px 0 0;font-size:13px;color:var(--mute)}
#mesa .if-sub{margin:14px 0 6px;font-size:13px;font-weight:600;color:var(--ink)}
#mesa .if-ch{position:relative;padding-bottom:20px}
#mesa .if-cols{display:flex;align-items:stretch;height:144px;padding-top:24px;box-sizing:border-box;border-bottom:1px solid var(--line)}
#mesa .if-c{position:relative;flex:1 1 0;min-width:0;display:flex;align-items:flex-end;justify-content:center;padding:0 var(--g)}#mesa .if-c:first-child{padding-left:0}#mesa .if-c:last-child{padding-right:0}   /* the gap is part of each column's target */
#mesa .if-c i{position:relative;display:block;width:100%;max-width:24px;border-radius:4px 4px 0 0;background:var(--barra);transition:background var(--d1) ease-out}
#mesa .if-c.top i{background:var(--barra-top)}
#mesa .if-c:hover i{background:var(--ink-2)}#mesa .if-c.top:hover i{background:var(--barra-top-hov)}
#mesa .if-v,#mesa .if-d{position:absolute;white-space:nowrap;font-size:12px;font-style:normal;line-height:1;pointer-events:none}
#mesa .if-v{bottom:calc(100% + 6px);font-weight:600;color:var(--ink)}
#mesa .if-d{top:calc(100% + 6px);color:var(--mute)}
#mesa .if-v.medio,#mesa .if-d.medio{left:50%;transform:translateX(-50%)}#mesa .if-v.ini,#mesa .if-d.ini{left:0}#mesa .if-v.fin,#mesa .if-d.fin{right:0}
#mesa .if-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
#mesa .if-tp{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:0 10px;max-width:460px;font-size:13px;color:var(--ink-2)}
#mesa .if-tp i{position:relative;display:block;height:24px}
#mesa .if-tp i::before{content:'';position:absolute;top:7px;bottom:7px;left:0;width:var(--w);border-radius:0 4px 4px 0;background:var(--barra);transition:background var(--d1) ease-out}   /* the whole track is its target */
#mesa .if-tp i:hover::before{background:var(--ink-2)}
#mesa .if-tp em{font-style:normal;text-align:right;color:var(--ink)}
#mesa .if-frase{margin:14px 0 0;font-size:14px;line-height:1.5;color:var(--ink-2);max-width:62ch}
@media (prefers-reduced-motion:reduce){#mesa .if-c i,#mesa .if-tp i::before{transition:none}}
`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).informe = 'ok';
})();
