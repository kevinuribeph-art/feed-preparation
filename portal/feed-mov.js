// La cabecera de meses del feed continuo del portal (y su movimiento): la misma que la «Vista cliente» de la Mesa (mesa.js,
// `cabNodo`/`cabRender`/`cabColocar`, D-323), escrita para el portal: sin estilos en línea (CSP del portal: solo CSSOM, como
// `style.transform` y `style.setProperty`), sin innerHTML y con las flechas del sprite del portal. No sabe nada del portal: le dan
// los meses y le dicen cuál es el activo; ella avisa cuando se pulsa un mes o una flecha.
(function (g) {
  'use strict';
  const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };

  // [‹] [ el mes anterior | el mes que se ve, en una píldora fija | el siguiente ] [›]. Una tira con todos los meses del cliente,
  // cada uno en un hueco del mismo ancho (--fm-w, W); la ventana enseña 3; la píldora (fija sobre el hueco del centro) lleva una
  // segunda tira en --on-ink recortada a ella: un solo número mueve las dos (mover(v): el hueco v, centrado en la píldora).
  // o: { icono(n) → svg, alPulsar(key) (un mes o una flecha) }
  function cabecera(o) {
    const nodo = el('div', 'fm-cab'); nodo.setAttribute('role', 'group'); nodo.setAttribute('aria-label', 'Meses');
    const inn = el('div', 'fm-in'), vent = el('div', 'fm-vent'), tira = el('div', 'fm-tira'), pild = el('div', 'fm-pild'), tira2 = el('div', 'fm-tira fm-tira2');
    const fl = d => { const b = el('button', 'fm-fl'); b.type = 'button'; b.dataset.d = d; b.setAttribute('aria-label', d < 0 ? 'Mes anterior' : 'Mes siguiente'); b.title = d < 0 ? 'Mes anterior' : 'Mes siguiente'; const i = o.icono && o.icono(d < 0 ? 'left' : 'right'); if (i) b.append(i); return b; };
    const bI = fl(-1), bD = fl(1);
    pild.setAttribute('aria-hidden', 'true'); pild.append(tira2); vent.append(tira, pild); inn.append(bI, vent, bD); nodo.append(inn);
    let meses = [], activo = null, WN = 0, W = 0, X = null, sig = '', PX = 0;
    const huecos = () => [...tira.children];
    const iDe = k => meses.findIndex(m => m.key === k);
    function vecino(d, desde) { const i = iDe(desde || activo); const j = i + d; return j >= 0 && j < meses.length ? meses[j].key : null; }
    function medirNombres() {            // el ancho de los huecos: el nombre más largo (una lectura de diseño, solo cuando cambian los meses)
      nodo.style.removeProperty('--fm-w');
      const w = Math.max(0, ...huecos().map(h => h.offsetWidth));
      WN = w ? Math.max(56, Math.ceil(w)) : 0; W = WN; X = null;
      if (W) nodo.style.setProperty('--fm-w', W + 'px');
    }
    function poner(lista) {              // los meses, del más viejo al más nuevo: [{key, label, title}]
      const s = lista.map(m => m.key + '=' + m.label).join(',');
      nodo.hidden = !lista.length;
      if (s === sig) return false;
      sig = s; meses = lista.slice();
      tira.replaceChildren(...meses.map(m => { const b = el('button', 'fm-mes'); b.type = 'button'; b.dataset.mes = m.key; b.textContent = m.label; b.title = m.title || m.label; return b; }));
      tira2.replaceChildren(...meses.map(m => { const s2 = el('span', 'fm-mes'); s2.textContent = m.label; return s2; }));
      if (nodo.isConnected) medirNombres(); else WN = 0;
      return true;
    }
    // el mes activo: aria-current, solo los 3 de la ventana se enfocan y se leen, y las flechas apagadas en los extremos
    function marcar(key) {
      activo = key; const i = Math.max(0, iDe(key));
      huecos().forEach((h, j) => {
        const ve = Math.abs(j - i) <= 1;
        if (h.tabIndex !== (ve ? 0 : -1)) h.tabIndex = ve ? 0 : -1;
        if (ve) h.removeAttribute('aria-hidden'); else h.setAttribute('aria-hidden', 'true');
        if (j === i) h.setAttribute('aria-current', 'true'); else h.removeAttribute('aria-current');
      });
      [bI, bD].forEach(b => { if (vecino(+b.dataset.d)) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); });
      foco();
    }
    function mover(v) {                  // el hueco v (con decimales) centrado en la píldora: solo transform, nada que mida
      if (!W) return; const x = (1 - v) * W; if (x === X) return; X = x;
      tira.style.transform = `translateX(${x}px)`; tira2.style.transform = `translateX(${x - W}px)`;
    }
    // su sitio: centrada sobre la rejilla y nunca más ancha (si no cabe, los huecos se estrechan); una lectura de diseño, cuando
    // cambia el tamaño o los meses, nunca al deslizar
    function colocar(grid) {
      if (!nodo.isConnected || nodo.hidden) return;
      if (!WN) { medirNombres(); if (!WN) return; }
      const extra = inn.offsetWidth - vent.offsetWidth + 2;
      const r = grid && grid.offsetWidth ? grid.getBoundingClientRect() : null;
      const w = r ? Math.max(40, Math.min(WN, Math.floor((r.width - extra) / 3))) : W;
      if (w !== W) { W = w; X = null; nodo.style.setProperty('--fm-w', w + 'px'); }
      const iw = extra + 3 * W;
      if (r) { const s = nodo.getBoundingClientRect(), want = r.left + (r.width - iw) / 2 - s.left; PX = want >= -0.5 && want + iw <= s.width + 0.5 ? Math.max(0, Math.round(want * 2) / 2) : 0; }
      const tx = PX ? `translateX(${PX}px)` : '';
      if (inn.style.transform !== tx) inn.style.transform = tx;
    }
    function foco() {                    // el aro del mes activo, en la píldora; un mes con aro: sin la degradación de los bordes
      const a = document.activeElement, en = !!(a && vent.contains(a) && a.classList.contains('fm-mes') && a.matches(':focus-visible'));
      vent.classList.toggle('fpild', en && a.getAttribute('aria-current') === 'true');
      vent.classList.toggle('fmes', en);
    }
    nodo.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button'); if (!b || !nodo.contains(b)) return;
      if (b.classList.contains('fm-fl')) { if (b.getAttribute('aria-disabled') !== 'true') { const k = vecino(+b.dataset.d); if (k) o.alPulsar(k, 'flecha'); } return; }
      if (b.dataset.mes) o.alPulsar(b.dataset.mes, 'mes');
    });
    nodo.addEventListener('keydown', e => {   // ← → con el foco en la cabecera: el mes de antes o el de después (el foco va con él)
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      e.preventDefault(); e.stopPropagation();
      const k = vecino(e.key === 'ArrowLeft' ? -1 : 1); if (!k) return;
      const enMes = e.target.classList && e.target.classList.contains('fm-mes');
      o.alPulsar(k, 'tecla');
      if (enMes) { const h = huecos()[iDe(k)]; if (h) h.focus({ preventScroll: true }); foco(); }
    });
    nodo.addEventListener('focusin', foco); nodo.addEventListener('focusout', () => setTimeout(foco, 0));
    vent.addEventListener('scroll', () => { vent.scrollLeft = 0; });   // un mes con el foco nunca desliza la ventana
    return { nodo, poner, marcar, mover, colocar, activo: () => activo, ancho: () => W, indice: iDe, meses: () => meses.slice() };
  }

  g.FeedMov = { cabecera };
})(window);
