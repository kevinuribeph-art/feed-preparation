// «Editar cliente» → «Estilo» (D-356): each client's style, what its page «Skill» in Notion held — its tones in their order, the
// text under Notion's headings and what Claude learned — only for Kevin and Claude: web.js never reads it. The data and the
// skills' calls (MESA.estilo.ver, cambiar, aprender) are in mesa.js; this is only the tab. Folding sections, one open at a time,
// each with its summary on the right; «Guardar» keeps the whole tab (all or nothing, as MESA.estilo.cambiar).
(() => {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.0';   // 1.0: the tab, its seven sections and «Guardar» (D-356); only what was changed here is saved, so what Claude
  // wrote meanwhile stays; a tab with changes not saved is never redrawn from outside
  const I = () => M._in;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // the seven sections and their fields, under Notion's headings (the skills read them by these keys)
  const SECC = [
    ['tonos', 'Tonos', null],
    ['escritura', 'Escritura', [['tono', 'Tono y escritura', 'Idioma, voz, vocabulario, emojis, hashtags, créditos, especificidad, longitud…'], ['direccion', 'Dirección y horario', 'La línea de las 3 opciones; la de fin de semana, si la hay']]],
    ['marca', 'Marca', [['contexto', 'Contexto de marca', ''], ['restricciones', 'Restricciones de contenido', ''], ['operacion', 'Modelo de operación', ''], ['servicios', 'Servicios o líneas de contenido', ''], ['publico', 'Público objetivo', '']]],
    ['calendario', 'Calendario', [['objetivos', 'Objetivos y frecuencia', ''], ['horario', 'Horario de publicación', 'Actual, test, cuándo revisarlo, historial'], ['fechas', 'Fechas clave propias', '']]],
    ['reglas', 'Reglas de este cliente', [['reglas', 'Reglas de este cliente', 'Nombres de las publicaciones, mes anterior desde Instagram, por tandas…']]],
    ['historias', 'Historias', [['historias', 'Perfil de historias', 'Ritmo, material, nombres, diseño, aprobación']]],
    ['aprendizajes', 'Aprendizajes', null]
  ];
  const DE_TXT = { captions: 'Captions', historias: 'Historias', otro: 'Otro' };
  let abierta = 'tonos';                   // the section last opened, while the page lives
  const primeraLinea = t => String(t || '').split('\n').map(x => x.replace(/^[-*•\s]+/, '').trim()).find(Boolean) || '';
  function resumen(k, r) {
    if (k === 'tonos') return r.tonos.map(t => t.nombre).join(' · ') || 'Sin tonos';
    if (k === 'aprendizajes') { const n = r.aprendizajes.length, f = r.aprendizajes.find(a => a.fecha); return n ? `${n}${f ? ' · el último, del ' + I().fmtDate(f.fecha) : ''}` : 'Ninguno todavía'; }
    const campos = SECC.find(x => x[0] === k)[2];
    return campos.map(([c]) => primeraLinea(r.secciones[c])).find(Boolean) || 'Vacío';
  }
  const area = (name, v, rows, ph, al) => `<textarea name="${name}" rows="${rows}"${ph ? ` placeholder="${esc(ph)}"` : ''}${al ? ` aria-label="${esc(al)}"` : ''} spellcheck="true">${esc(v || '')}</textarea>`;
  function cuerpo(k, r) {
    if (k === 'tonos') {
      const l = r.tonos.slice(); while (l.length < 3) l.push({ nombre: '', como: '' });
      return `<ol class="est-tonos">${l.map((t, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><input type="text" name="tono-n-${i}" maxlength="80" value="${esc(t.nombre)}" placeholder="Nombre del tono" aria-label="Nombre del tono ${i + 1}">${area('tono-c-' + i, t.como, 3, 'Cómo suena', 'Cómo suena el tono ' + (i + 1))}</li>`).join('')}</ol>`;
    }
    if (k === 'aprendizajes') {
      if (!r.aprendizajes.length) return '<p class="est-vacio">Claude los apunta con «analiza» y diseno-historias.</p>';
      return `<ul class="est-ap">${r.aprendizajes.map((a, i) => { const f = `${a.fecha ? I().fmtDate(a.fecha) : 'sin fecha'} · ${DE_TXT[a.de] || a.de}`; return `<li><span class="f" aria-hidden="true">${esc(f)}</span>${area('apr-' + i, a.texto, 2, '', 'Aprendizaje: ' + f)}</li>`; }).join('')}</ul><p class="est-vacio">Para quitar uno, vacía su texto y guarda.</p>`;
    }
    const campos = SECC.find(x => x[0] === k)[2];
    return `<div class="est-g">${campos.map(([c, l, ph]) => `<label>${esc(l)}${area('sec-' + c, r.secciones[c], Math.min(14, Math.max(3, String(r.secciones[c] || '').split('\n').length + 1)), ph, '')}</label>`).join('')}</div>`;
  }
  function pie(r) {
    if (!r.at) return 'Sin estilo todavía';
    return `Lo ${r.por === 'kevin' ? 'cambiaste' : 'cambió Claude'} el ${esc(I().fmtDate(r.at))}`;
  }
  function pintar(p, cid) { p.innerHTML = pane(cid); delete p.dataset.sucio; }
  function pane(cid) {
    const r = I().estDe(cid); DIBUJO.set(cid, r);   // what this drawing shows: «Guardar» compares with it
    return '<p class="est-nota">Solo para ti y para Claude: nunca va a la web del cliente.</p>'
      + SECC.map(([k, t]) => `<div class="est-sec${k === abierta ? ' on' : ''}" data-k="${k}"><button type="button" class="est-h" aria-expanded="${k === abierta}" aria-controls="est-b-${k}"><b>${esc(t)}</b><span>${esc(resumen(k, r))}</span><i aria-hidden="true"></i></button><div class="est-b" id="est-b-${k}">${cuerpo(k, r)}</div></div>`).join('')
      + `<p class="ferr est-err" hidden></p><div class="row"><span class="left muted est-pie">${pie(r)}</span><button type="button" class="btn" data-est="guardar">Guardar</button></div>`;
  }
  // everything in the tab, as MESA.estilo.cambiar takes it: the tones with a name, every heading ('' empties it), the learnings
  // still with text (their date and kind, as they were)
  // only what was changed here against what was drawn (DIBUJO), so what Claude wrote meanwhile stays: a heading, its own; the
  // tones, the whole list; the learnings, those drawn with their edits plus the ones added since, on top
  const DIBUJO = new Map();   // client → its style as the tab drew it
  const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function recoger(p, cid) {
    const d = DIBUJO.get(cid) || I().estDe(cid), v = n => { const e = p.querySelector(`[name="${n}"]`); return e ? e.value : null; }, out = {}, sinNombre = [];
    const tonos = []; for (let i = 0; p.querySelector(`[name="tono-n-${i}"]`); i++) { const n = v('tono-n-' + i).trim(), c = (v('tono-c-' + i) || '').trim(); if (n) tonos.push({ nombre: n, como: c }); else if (c) sinNombre.push(i + 1); }
    if (sinNombre.length) return { error: `El tono ${sinNombre.join(' y ')} tiene «Cómo suena» pero no nombre` };
    if (!mismo(tonos, d.tonos.map(t => ({ nombre: t.nombre, como: t.como.trim() })))) out.tonos = tonos;
    const secciones = {}; SECC.forEach(([, , c]) => (c || []).forEach(([k]) => { const x = v('sec-' + k); if (x != null && x.trim() !== String(d.secciones[k] || '').trim()) secciones[k] = x; }));
    if (Object.keys(secciones).length) out.secciones = secciones;
    const editados = d.aprendizajes.map((a, i) => ({ ...a, texto: v('apr-' + i) ?? a.texto }));
    if (editados.some((a, i) => a.texto !== d.aprendizajes[i].texto)) {
      const ahora = I().estDe(cid).aprendizajes, nuevos = ahora.filter(a => !d.aprendizajes.some(x => mismo(x, a)));
      out.aprendizajes = [...nuevos, ...editados.filter(a => String(a.texto || '').trim())];
    }
    return out;
  }
  async function guardar(b) {
    const p = b.closest('#ecp-estilo'), cid = p && p.dataset.estCli; if (!cid) return;
    const err = p.querySelector('.est-err'); err.hidden = true;
    b.disabled = true;
    try {
      const cambio = recoger(p, cid);
      if (cambio.error) { err.textContent = cambio.error; err.hidden = false; return; }
      if (!Object.keys(cambio).length) { pintar(p, cid); I().toast('Nada que guardar'); return; }
      const r = await M.estilo.cambiar(cid, cambio, { por: 'kevin' });
      if (!r || r.error) { err.textContent = (r && r.problemas && r.problemas[0]) || (r && r.error) || 'No se ha guardado'; err.hidden = false; return; }
      pintar(p, cid); I().toast('Estilo guardado');
      const g = p.querySelector('[data-est="guardar"]'); if (g) g.focus();   // the focus stays where it was, not on the page
    } finally { b.disabled = false; }
  }
  function abrirSec(h) {
    const s = h.parentElement, on = !s.classList.contains('on');
    s.parentElement.querySelectorAll('.est-sec').forEach(x => { x.classList.remove('on'); x.querySelector('.est-h').setAttribute('aria-expanded', 'false'); });
    if (on) { s.classList.add('on'); h.setAttribute('aria-expanded', 'true'); abierta = s.dataset.k; }
  }
  // a change typed marks the tab: nothing from outside redraws it until it is saved
  document.addEventListener('input', e => { const p = e.target.closest && e.target.closest('#mesa #ecp-estilo'); if (p) p.dataset.sucio = '1'; });
  document.addEventListener('click', e => {
    const t = e.target; if (!t.closest || !t.closest('#mesa #ecp-estilo')) return;
    const h = t.closest('.est-h'); if (h) { abrirSec(h); return; }
    const g = t.closest('[data-est="guardar"]'); if (g) { e.preventDefault(); guardar(g); }
  });
  // a change from elsewhere (Claude, another tab, the cloud) redraws the tab, unless it has changes not saved
  document.addEventListener('mesa-estilos', () => {
    const p = document.querySelector('#mesa #ecp-estilo'); if (!p || p.dataset.sucio) return;
    const cid = p.dataset.estCli; if (cid) pintar(p, cid);
  });
  const ESTILO = `
#mesa .est{font-size:13px;color:var(--ink);container-type:inline-size}
#mesa .est-nota{margin:0 0 12px;font-size:12.5px;color:var(--mute)}
#mesa .est-sec{border-top:1px solid var(--line2)}#mesa .est-sec:last-of-type{border-bottom:1px solid var(--line2)}
#mesa .est-h{all:unset;box-sizing:border-box;display:flex;align-items:baseline;gap:12px;width:100%;padding:12px 2px;cursor:pointer}
#mesa .est-h:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:var(--r-xs)}
#mesa .est-h b{font-size:15px;font-weight:800;letter-spacing:-.01em;min-width:170px}
#mesa .est-h span{flex:1;min-width:0;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .est-h i{width:16px;height:16px;flex:none;align-self:center;background:currentColor;color:var(--ink-2);-webkit-mask:var(--chev) center/16px no-repeat;mask:var(--chev) center/16px no-repeat;transition:transform var(--d1) ease-out}
#mesa .est-sec.on .est-h i{transform:rotate(180deg)}
#mesa .est-b{display:none;padding:0 2px 16px}#mesa .est-sec.on .est-b{display:block}
#mesa .est-tonos{list-style:none;margin:0;padding:0;display:grid;gap:8px}
#mesa .est-tonos li{display:grid;grid-template-columns:22px 170px minmax(0,1fr);gap:10px;align-items:start}
#mesa .est-tonos .n{font-weight:600;color:var(--acc-ink);padding-top:9px;text-align:center;font-variant-numeric:tabular-nums}
#mesa .est-g{display:grid;gap:12px}#mesa .est-g label{display:block;font-size:12.5px;font-weight:600;color:var(--ink);margin:0}
#mesa .est-g textarea{margin-top:4px}
#mesa .est textarea,#mesa .est input[type=text]{display:block;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:var(--r-md);background:var(--panel-2);color:var(--ink);font:13px/1.45 var(--font)}
#mesa .est textarea{resize:vertical;padding:8px 11px;min-height:58px}#mesa .est input[type=text]{height:34px;padding:0 11px}
#mesa .est textarea:hover,#mesa .est input[type=text]:hover{border-color:var(--line-strong)}#mesa .est textarea:focus,#mesa .est input[type=text]:focus{outline:0;border-color:var(--ink);box-shadow:0 0 0 3px var(--ring)}
#mesa .est textarea::placeholder,#mesa .est input::placeholder{color:var(--faint,var(--mute))}
#mesa .est-ap{list-style:none;margin:0;padding:0;display:grid;gap:10px}#mesa .est-ap .f{display:block;margin:0 0 4px;color:var(--mute);font-size:12.5px;font-variant-numeric:tabular-nums}
#mesa .est-vacio{margin:8px 0 0;color:var(--mute);font-size:12.5px}
#mesa .est .row{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:16px}#mesa .est .row .left{margin-right:auto;font-size:12.5px;color:var(--mute)}
@container (max-width: 560px){#mesa .est-tonos li{grid-template-columns:22px minmax(0,1fr)}#mesa .est-tonos li textarea{grid-column:2}#mesa .est-h b{min-width:0}}
`;
  const st = document.createElement('style'); st.dataset.mod = 'estilo'; st.textContent = ESTILO; document.head.append(st);
  M.estiloUI = { version: VERSION, pane, _secc: SECC };
  (window.MESA_CARGA = window.MESA_CARGA || {}).estilo = 'ok';
})();
