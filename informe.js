// Informe — Mesa de trabajo · v1.0 (D-240)
// In the vista cliente, the why of the month the calendar shows (the tab «Por qué este calendario») and how the month before
// it went («Cómo fue <mes>», under «Tus pagos» in the right column), from what Claude loads with MESA.informe (D-238); the
// client never writes them. Both follow the calendar's month. Without data: «En camino» for a month after the last one with
// data (or, for the summary, a month not over yet); nothing for an earlier month without it, nor for a client that has none.
// If this file doesn't load, the vista cliente is the one of the 4.26.
(function informeBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.0';
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
  const cifra = n => n >= 1e6 ? num(n / 1e6, { maximumFractionDigits: 1 }) + ' M' : n >= 1000 ? num(n / 1000, { maximumFractionDigits: 1 }) + ' mil' : num(n);
  const exacta = n => num(n);   // «1400», «11.200» (the RAE: no point with four figures)
  const corto = d => +d.slice(8, 10) + ' ' + nomMes(d).slice(0, 3);   // «3 oct»
  // the change against the month before: its text, its kind (sube / baja / igual / sin) and what it says in full
  function cambio(v, a, mAnt) {
    if (a == null) return { t: 'sin datos de ' + nomMes(mAnt), k: 'sin', l: `Sin datos de ${nomMes(mAnt)} para comparar` };
    if (a === 0) return v ? { t: `antes, 0`, k: 'sin', l: `En ${nomMes(mAnt)}, 0` } : { t: 'igual', k: 'igual', l: `Igual que en ${nomMes(mAnt)}` };
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
    const W = 320, H = 100, TOP = 22, max = Math.max(1, ...P.map(p => p.alcance));
    const best = P.reduce((a, p, i) => p.alcance > P[a].alcance ? i : a, 0), band = W / n, bw = Math.min(24, Math.max(2, band - 2));
    const cols = P.map((p, i) => {
      const x = i * band + (band - bw) / 2, h = p.alcance ? Math.max(2, Math.round(p.alcance / max * H)) : 0, y = TOP + H - h, r = Math.min(4, bw / 2, h);
      const d = h ? `M${x.toFixed(1)},${TOP + H} V${(y + r).toFixed(1)} Q${x.toFixed(1)},${y} ${(x + r).toFixed(1)},${y} H${(x + bw - r).toFixed(1)} Q${(x + bw).toFixed(1)},${y} ${(x + bw).toFixed(1)},${(y + r).toFixed(1)} V${TOP + H} Z` : '';
      const tit = `${p.nombre} · ${p.tipo} · ${corto(p.fecha)} · ${exacta(p.alcance)} de alcance`;
      return `<g class="if-c${i === best ? ' top' : ''}"><title>${esc(tit)}</title><rect class="if-hit" x="${(i * band).toFixed(1)}" y="0" width="${band.toFixed(1)}" height="${TOP + H}"/>${d ? `<path class="if-b" d="${d}"/>` : ''}</g>`;
    }).join('');
    const bx = best * band + band / 2, by = TOP + H - Math.max(2, Math.round(P[best].alcance / max * H)) - 6;
    const nom = P[best].nombre.length > 26 ? P[best].nombre.slice(0, 25).trimEnd() + '…' : P[best].nombre;
    const anc = bx < W * 0.3 ? ['start', Math.max(0, bx - bw / 2)] : bx > W * 0.7 ? ['end', Math.min(W, bx + bw / 2)] : ['middle', bx];
    const lab = `<text class="if-v" x="${anc[1].toFixed(1)}" y="${Math.max(12, by)}" text-anchor="${anc[0]}">${esc(nom)} · ${esc(cifra(P[best].alcance))}</text>`;
    const ejes = `<line class="if-eje" x1="0" x2="${W}" y1="${TOP + H + 0.5}" y2="${TOP + H + 0.5}"/><text x="0" y="${TOP + H + 16}">${esc(corto(P[0].fecha))}</text>${n > 1 ? `<text x="${W}" y="${TOP + H + 16}" text-anchor="end">${esc(corto(P[n - 1].fecha))}</text>` : ''}`;
    const aria = `Alcance de cada publicación de ${nomMes(mes)}, ${n === 1 ? 'una publicación' : n + ' publicaciones'}; la de más alcance, ${P[best].nombre}, con ${exacta(P[best].alcance)}`;
    const tabla = `<div class="if-sr"><table><caption>Alcance de cada publicación de ${esc(nomMes(mes))}</caption><thead><tr><th>Publicación</th><th>Tipo</th><th>Fecha</th><th>Alcance</th></tr></thead><tbody>${P.map(p => `<tr><td>${esc(p.nombre)}</td><td>${esc(p.tipo)}</td><td>${esc(corto(p.fecha))}</td><td>${esc(exacta(p.alcance))}</td></tr>`).join('')}</tbody></table></div>`;   // in a box: a table ignores width:1px
    return `<h3 class="if-sub">Alcance de cada publicación</h3><svg class="if-ch" viewBox="0 0 ${W} ${TOP + H + 20}" role="img" aria-label="${esc(aria)}">${cols}${ejes}${lab}</svg>${tabla}`;
  }
  function tiposHTML(res) {
    const T = res.tipos || []; if (!T.length) return '';
    const max = Math.max(1, ...T.map(t => t.alcance));
    return `<h3 class="if-sub">Alcance medio por tipo</h3><div class="if-tp">${T.map(t => `<span>${esc(t.tipo)}</span><i style="width:${Math.max(t.alcance ? 1 : 0, t.alcance / max * 100).toFixed(1)}%" title="${esc(`${t.tipo}: ${exacta(t.alcance)} de alcance medio`)}"></i><em>${esc(cifra(t.alcance))}</em>`).join('')}</div>`;
  }
  const NOMBRES = { alcance: 'Alcance', interacciones: 'Interacciones', guardados: 'Guardados', publicaciones: 'Publicaciones' };
  function comoFueHTML(ctx) {
    const cli = ctx && ctx.cliente, m = ctx && ctx.mes; if (!cli || !m || !listo()) return '';
    const { rs } = datos(cli); if (!rs) return '';             // a client without any summary sees nothing new
    const p = antes(m), r = D().get(cli, p), h = hoy().slice(0, 7);
    const cab = x => `<h2 class="if-h">Cómo fue ${esc(mesTxt(p))}${x ? ` <span>${x}</span>` : ''}</h2>`;
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
  function pintar() { const r = I() && I().root && I().root(); if (r && r.classList.contains('client') && I().vc) I().vc.pintar(); }
  let mesHoy = null;
  function alMinuto() { const h = hoy().slice(0, 7); if (mesHoy && h !== mesHoy) pintar(); mesHoy = h; }   // a new month in Madrid: «En camino» may change

  // ---------- mounting ----------
  let listoP = null;
  const esperar = () => listoP || (listoP = new Promise((res, rej) => { const t0 = Date.now(), t = setInterval(() => { if (I() && I().mes && I().vc && I().estilo) { clearInterval(t); res(); } else if (Date.now() - t0 > 30000) { clearInterval(t); rej(new Error('mesa.js sin meses')); } }, 50); }));
  M.informeUI = {
    version: VERSION,
    porque: porqueHTML, comoFue: comoFueHTML,
    _off: () => { OFF.splice(0).forEach(f => f()); if (I() && I().vc) { I().vc.quitar('pestana', 'porque'); I().vc.quitar('lado', 'comofue'); } }
  };
  esperar().then(() => {
    I().estilo('mesa-if-css', ESTILO);
    on(document, 'mesa-meses', pintar);
    const t = setInterval(alMinuto, 60000); OFF.push(() => clearInterval(t)); mesHoy = hoy().slice(0, 7);
    I().vc.poner('pestana', { id: 'porque', orden: 10, titulo: 'Por qué este calendario', html: porqueHTML });
    I().vc.poner('lado', { id: 'comofue', orden: 20, html: comoFueHTML });
    pintar();
  }).catch(() => { (window.MESA_CARGA = window.MESA_CARGA || {}).informe = 'fallo'; });   // a mesa.js without 'meses' (an old cached one): the vista cliente of the 4.26

  // ---------- style (the mesa's tokens; light and dark come with them) ----------
  const ESTILO = `
#mesa{--barra:#998F85}
:root[data-theme="dark"] #mesa,#mesa[data-theme="dark"]{--barra:#9E9388}
#mesa .if-pq{display:flex;flex-direction:column;gap:10px;max-width:62ch;margin:0;font-size:14px;line-height:1.5;color:var(--ink-2)}
#mesa .if-pq p{margin:0}#mesa .if-pq b{font-weight:600;color:var(--ink)}
#mesa .if-camino{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:var(--r-md);background:var(--bg);color:var(--ink-2);font-size:14px;line-height:1.5}
#mesa .if-camino svg{width:20px;height:20px;flex:none;margin-top:1px;fill:none;stroke:currentColor;color:var(--mute);stroke-width:var(--i-trazo);stroke-linecap:round;stroke-linejoin:round}
#mesa .if-camino svg *{vector-effect:non-scaling-stroke}
#mesa .if-camino p{margin:0}#mesa .if-camino b{display:block;font-weight:600;color:var(--ink)}
#mesa .if-cf{color:var(--ink)}
#mesa .if-h{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0 0 12px;font-size:17px;font-weight:800;letter-spacing:-.01em}
#mesa .if-h span{font-size:13px;font-weight:400;letter-spacing:0;color:var(--mute)}
#mesa .if-fs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#mesa .if-f{display:flex;flex-direction:column;gap:2px;min-width:0;padding:10px 12px;border-radius:var(--r-sm);background:var(--bg)}
#mesa .if-f span{font-size:12px;color:var(--mute)}
#mesa .if-f b{font-size:22px;font-weight:800;line-height:1.15;letter-spacing:-.02em;color:var(--ink)}
#mesa .if-f i{font-style:normal;font-size:12px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .if-f i.sube{color:var(--ok)}#mesa .if-f i.baja{color:var(--red)}
#mesa .if-fr0{margin:10px 0 0;font-size:13px;color:var(--mute)}
#mesa .if-sub{margin:18px 0 8px;font-size:13px;font-weight:600;color:var(--ink)}
#mesa .if-ch{display:block;width:100%;height:auto;overflow:visible}
#mesa .if-ch .if-b{fill:var(--barra);transition:fill var(--d1) ease-out}#mesa .if-ch .top .if-b{fill:var(--acc)}
#mesa .if-ch .if-hit{fill:transparent}
#mesa .if-ch .if-c:hover .if-b{fill:var(--ink-2)}#mesa .if-ch .top:hover .if-b{fill:var(--acc-hover)}
#mesa .if-ch .if-eje{stroke:var(--line);stroke-width:1}
#mesa .if-ch text{font:12px var(--font);fill:var(--mute)}#mesa .if-ch text.if-v{font-weight:600;fill:var(--ink)}
#mesa .if-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
#mesa .if-tp{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px 10px;font-size:13px;color:var(--ink-2)}
#mesa .if-tp i{display:block;height:10px;border-radius:0 4px 4px 0;background:var(--barra)}
#mesa .if-tp em{font-style:normal;text-align:right;color:var(--ink)}
#mesa .if-frase{margin:16px 0 0;font-size:14px;line-height:1.5;color:var(--ink-2);max-width:62ch}
@media (prefers-reduced-motion:reduce){#mesa .if-ch .if-b{transition:none}}
`;
  (window.MESA_CARGA = window.MESA_CARGA || {}).informe = 'ok';
})();
